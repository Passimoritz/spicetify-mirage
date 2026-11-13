/* ------------------------------------------------------------------ DTLS 1.2 mit PSK (für Hue Entertainment) */
// Node kann kein DTLS, und die gepflegte Bibliothek braucht unter Electron ein natives Zusatzmodul. Hue spricht nur
// eine einzige Variante: DTLS 1.2, Pre-Shared Key, TLS_PSK_WITH_AES_128_GCM_SHA256 (RFC 6347, 5246, 4279, 5288).
// Genau die steht hier, mit Nodes crypto und dgram – ohne Zertifikate, ohne Neuverhandlung, ohne Sitzungs-
// wiederaufnahme, nur als Client. Ablauf:
//   ClientHello → (HelloVerifyRequest → ClientHello mit Cookie) → ServerHello, [ServerKeyExchange], ServerHelloDone
//   → ClientKeyExchange (PSK-Identität), ChangeCipherSpec, Finished → ChangeCipherSpec, Finished
// Danach gehen Anwendungsdaten (die HueStream-Bilder) verschlüsselt als einzelne Datensätze raus.
const crypto = require("crypto");
const dgram = require("dgram");
const net = require("net");
const EventEmitter = require("events");

const CT = { ccs: 20, alert: 21, handshake: 22, app: 23 };
const HS = { clientHello: 1, serverHello: 2, helloVerify: 3, serverKeyExchange: 12, certificateRequest: 13, serverHelloDone: 14, clientKeyExchange: 16, finished: 20 };
const V12 = 0xfefd, V10 = 0xfeff;
// TLS_PSK_WITH_AES_128_GCM_SHA256; dazu das Signal „sichere Neuverhandlung“ (wir verhandeln nie neu)
const SUITE = 0x00a8, SCSV = 0x00ff;

/* ---- Bausteine (einzeln getestet: tests/dtls/vectors.test.js) */
const hmac = (key, data) => crypto.createHmac("sha256", key).update(data).digest();
// PRF aus RFC 5246, Abschnitt 5, mit SHA-256
function prf(secret, label, seed, len) {
  const s = Buffer.concat([Buffer.from(label, "ascii"), seed]), out = [];
  let a = s, n = 0;
  while (n < len) {
    a = hmac(secret, a);
    const p = hmac(secret, Buffer.concat([a, s]));
    out.push(p);
    n += p.length;
  }
  return Buffer.concat(out).subarray(0, len);
}
// RFC 4279, Abschnitt 2: N Nullbytes, dann der Schlüssel – je mit Länge davor
function pskPremaster(psk) {
  const n = psk.length, b = Buffer.alloc(4 + 2 * n);
  b.writeUInt16BE(n, 0);
  b.writeUInt16BE(n, 2 + n);
  psk.copy(b, 4 + n);
  return b;
}
// AES-128-GCM hat keine MAC-Schlüssel: je 16 Byte Schlüssel und 4 Byte fester Teil der Nonce (RFC 5288)
function keyBlock(master, clientRandom, serverRandom) {
  const kb = prf(master, "key expansion", Buffer.concat([serverRandom, clientRandom]), 40);
  return { cKey: kb.subarray(0, 16), sKey: kb.subarray(16, 32), cIv: kb.subarray(32, 36), sIv: kb.subarray(36, 40) };
}
// Epoche (2 Byte) + Satznummer (6 Byte): in DTLS zugleich der ausdrückliche Teil der Nonce
function seqBytes(epoch, seq) {
  const b = Buffer.alloc(8);
  b.writeUInt16BE(epoch, 0);
  b.writeUIntBE(seq, 2, 6);
  return b;
}
// zusätzliche Daten für GCM: seq_num + Typ + Version + Länge des Klartexts (RFC 5246, 6.2.3.3)
function aadOf(epoch, seq, type, len) {
  const b = Buffer.alloc(13);
  seqBytes(epoch, seq).copy(b, 0);
  b[8] = type;
  b.writeUInt16BE(V12, 9);
  b.writeUInt16BE(len, 11);
  return b;
}
// verschlüsseln: Ergebnis = Geheimtext + 16 Byte Prüfwert
function gcmSeal(key, salt, explicit, aad, plain) {
  const c = crypto.createCipheriv("aes-128-gcm", key, Buffer.concat([salt, explicit]));
  c.setAAD(aad);
  return Buffer.concat([c.update(plain), c.final(), c.getAuthTag()]);
}
// entschlüsseln; null, wenn der Prüfwert nicht stimmt
function gcmOpen(key, salt, explicit, aad, data) {
  if (data.length < 16) return null;
  try {
    const d = crypto.createDecipheriv("aes-128-gcm", key, Buffer.concat([salt, explicit]));
    d.setAAD(aad);
    d.setAuthTag(data.subarray(data.length - 16));
    return Buffer.concat([d.update(data.subarray(0, data.length - 16)), d.final()]);
  } catch {
    return null;
  }
}
// Datensatz: Typ, Version, Epoche, Satznummer, Länge, Inhalt
function record(type, epoch, seq, body) {
  const h = Buffer.alloc(13);
  h[0] = type;
  h.writeUInt16BE(V12, 1);
  seqBytes(epoch, seq).copy(h, 3);
  h.writeUInt16BE(body.length, 11);
  return Buffer.concat([h, body]);
}
function parseRecords(buf) {
  const out = [];
  for (let o = 0; o + 13 <= buf.length; ) {
    const len = buf.readUInt16BE(o + 11);
    if (o + 13 + len > buf.length) break;
    out.push({ type: buf[o], version: buf.readUInt16BE(o + 1), epoch: buf.readUInt16BE(o + 3), seq: buf.readUIntBE(o + 5, 6), body: buf.subarray(o + 13, o + 13 + len) });
    o += 13 + len;
  }
  return out;
}
// Handshake-Nachricht am Stück (fragment_offset 0, fragment_length = Länge). So geht sie auch in den Hash ein.
function hsMessage(type, seq, body) {
  const h = Buffer.alloc(12);
  h[0] = type;
  h.writeUIntBE(body.length, 1, 3);
  h.writeUInt16BE(seq, 4);
  h.writeUIntBE(0, 6, 3);
  h.writeUIntBE(body.length, 9, 3);
  return Buffer.concat([h, body]);
}
function clientHello(random, cookie) {
  const suites = Buffer.alloc(6);
  suites.writeUInt16BE(4, 0);
  suites.writeUInt16BE(SUITE, 2);
  suites.writeUInt16BE(SCSV, 4);
  const v = Buffer.alloc(2);
  v.writeUInt16BE(V12, 0);
  // Version, Zufall, keine Sitzungs-ID, Cookie, Verfahren, keine Kompression, keine Erweiterungen
  return Buffer.concat([v, random, Buffer.from([0, cookie.length]), cookie, suites, Buffer.from([1, 0])]);
}
function parseServerHello(b) {
  if (b.length < 38) return null;
  const sid = b[34];
  if (b.length < 35 + sid + 3) return null;
  return { version: b.readUInt16BE(0), random: Buffer.from(b.subarray(2, 34)), suite: b.readUInt16BE(35 + sid), compression: b[37 + sid] };
}

/* ---- Verbindung. opts: host, port (2100), identity (String), psk (Buffer), timeout (ms bis zum fertigen
   Handshake), retransmit (ms bis zur ersten Wiederholung, verdoppelt sich), socket (nur für Tests).
   Ereignisse: "error" (Error), "close". connect() → Promise, das nach dem Handshake erfüllt ist. */
class DtlsClient extends EventEmitter {
  constructor({ host, port = 2100, identity, psk, timeout = 8000, retransmit = 500 } = {}) {
    super();
    if (!Buffer.isBuffer(psk) || !psk.length) throw new Error("psk");
    this.host = host;
    this.port = port;
    this.identity = Buffer.from(String(identity || ""), "utf8");
    this.psk = psk;
    this.timeout = timeout;
    this.rto = retransmit;
    this.state = "idle";
    this.epoch = 0;
    this.wseq = [0, 0]; // nächste Satznummer je Epoche
    this.hsSeq = 0; // nächste eigene message_seq
    this.rxSeq = 0; // nächste erwartete message_seq der Gegenseite
    this.frags = new Map();
    this.transcript = [];
    this.flight = null;
    this.timer = 0;
    this.sock = null;
  }
  connect() {
    if (this.state !== "idle") return Promise.reject(new Error("used"));
    this.state = "hello";
    return new Promise((resolve, reject) => {
      this._done = (err) => {
        clearTimeout(this.timer);
        clearTimeout(this.deadline);
        this._done = null;
        if (err) {
          this._shut();
          reject(err);
        } else resolve(this);
      };
      this.deadline = setTimeout(() => this._fail(new Error("timeout")), this.timeout);
      this.sock = dgram.createSocket(net.isIPv6(this.host) ? "udp6" : "udp4");
      this.sock.on("error", (e) => this._fail(e));
      this.sock.on("message", (buf) => {
        try {
          this._onDatagram(buf);
        } catch (e) {
          this._fail(e);
        }
      });
      this.sock.connect(this.port, this.host, () => {
        // 4 Byte Uhrzeit wie in RFC 5246 vorgesehen, der Rest Zufall
        this.random = crypto.randomBytes(32);
        this.random.writeUInt32BE(Math.floor(Date.now() / 1000) >>> 0, 0);
        this._hello(Buffer.alloc(0));
      });
    });
  }
  // Anwendungsdaten (ein HueStream-Bild) als eigener Datensatz
  send(data) {
    if (this.state !== "open") return false;
    this._out([{ type: CT.app, body: data }]);
    return true;
  }
  close() {
    if (this.state === "open") {
      // close_notify, damit die Bridge nicht erst nach 10 s merkt, dass nichts mehr kommt
      try { this._out([{ type: CT.alert, body: Buffer.from([1, 0]) }]); } catch {}
    }
    this._shut();
  }
  _shut() {
    const was = this.state;
    this.state = "closed";
    clearTimeout(this.timer);
    clearTimeout(this.deadline);
    try { this.sock?.close(); } catch {}
    this.sock = null;
    if (was !== "closed") this.emit("close");
  }
  _fail(err) {
    if (this._done) return this._done(err);
    if (this.state === "closed") return;
    this._shut();
    // ohne Zuhörer würde EventEmitter das Programm beenden – hier ist ein Fehler nur „zurück auf REST“
    if (this.listenerCount("error")) this.emit("error", err);
  }

  /* -- senden: jede Wiederholung bekommt neue Satznummern, aber dieselben message_seq */
  _out(items) {
    const recs = items.map(({ type, body, epoch = this.epoch }) => {
      const seq = this.wseq[epoch]++;
      if (epoch === 0) return record(type, 0, seq, body);
      const ex = seqBytes(epoch, seq);
      return record(type, epoch, seq, Buffer.concat([ex, gcmSeal(this.k.cKey, this.k.cIv, ex, aadOf(epoch, seq, type, body.length), body)]));
    });
    // ein Flug in einem Datagramm: die Nachrichten sind klein, Hue-Bridges vertragen das
    this.sock?.send(Buffer.concat(recs));
  }
  _flight(items) {
    this.flight = items;
    this.wait = this.rto;
    this._out(items);
    this._arm();
  }
  _arm() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      if (!this.flight || this.state === "open" || this.state === "closed") return;
      // RFC 6347 4.2.4.1: Wartezeit verdoppeln (höchstens 60 s; hier begrenzt ohnehin timeout das Ganze)
      this.wait = Math.min(this.wait * 2, 60000);
      this._out(this.flight);
      this._arm();
    }, this.wait);
  }
  _hello(cookie) {
    const ch = hsMessage(HS.clientHello, this.hsSeq++, clientHello(this.random, cookie));
    // RFC 6347 4.2.6: erstes ClientHello und HelloVerifyRequest zählen nicht zum Handshake-Hash
    this.transcript = [ch];
    this._flight([{ type: CT.handshake, body: ch, epoch: 0 }]);
  }

  /* -- empfangen */
  _onDatagram(buf) {
    for (const r of parseRecords(buf)) {
      if (r.version !== V12 && r.version !== V10) continue;
      let body = r.body;
      if (r.epoch === 1) {
        // erst nach unserem Finished haben wir Schlüssel; davor (oder kaputt) still verwerfen wie vorgesehen
        if (!this.k || body.length < 24) continue;
        body = gcmOpen(this.k.sKey, this.k.sIv, body.subarray(0, 8), aadOf(1, r.seq, r.type, body.length - 24), body.subarray(8));
        if (!body) continue;
      } else if (r.epoch !== 0) continue;
      if (r.type === CT.alert) this._alert(body);
      else if (r.type === CT.ccs) {
        if (this.state === "finished" && body.length === 1 && body[0] === 1) this.peerCcs = true;
      } else if (r.type === CT.handshake) this._handshake(body, r.epoch);
      // Anwendungsdaten von der Bridge gibt es nicht
    }
  }
  _alert(b) {
    if (b.length < 2) return;
    if (b[1] === 0) return this.state === "open" ? this._shut() : this._fail(new Error("closed during handshake"));
    if (b[0] === 2) this._fail(new Error("alert " + b[1]));
  }
  _handshake(buf, epoch) {
    for (let o = 0; o + 12 <= buf.length; ) {
      const type = buf[o], len = buf.readUIntBE(o + 1, 3), mseq = buf.readUInt16BE(o + 4), off = buf.readUIntBE(o + 6, 3), flen = buf.readUIntBE(o + 9, 3);
      const frag = buf.subarray(o + 12, o + 12 + flen);
      o += 12 + flen;
      if (frag.length !== flen || off + flen > len) continue;
      if (mseq < this.rxSeq) {
        // die Gegenseite wiederholt ihren letzten Flug: unserer ist nicht angekommen
        if (this.flight && this.state !== "open") this._out(this.flight);
        continue;
      }
      // Stücke sammeln, bis die Nachricht vollständig ist (große Nachrichten kann die Gegenseite aufteilen)
      let m = this.frags.get(mseq);
      if (!m) this.frags.set(mseq, (m = { type, len, data: Buffer.alloc(len), have: new Uint8Array(len), epoch }));
      if (m.type !== type || m.len !== len) continue;
      frag.copy(m.data, off);
      m.have.fill(1, off, off + flen);
      while (this.frags.has(this.rxSeq)) {
        const x = this.frags.get(this.rxSeq);
        if (x.have.includes(0)) break;
        this.frags.delete(this.rxSeq);
        this._message(x.type, this.rxSeq++, x.data, x.epoch);
        if (this.state === "closed") return;
      }
    }
  }
  _message(type, mseq, body, epoch) {
    const full = hsMessage(type, mseq, body);
    if (this.state === "hello" && type === HS.helloVerify) {
      // Cookie zurückschicken; die Bridge zählt ab hier neu (ServerHello hat dann message_seq 1)
      if (body.length < 3 || body[2] > 255 || body.length < 3 + body[2]) throw new Error("bad HelloVerifyRequest");
      return this._hello(Buffer.from(body.subarray(3, 3 + body[2])));
    }
    if (this.state === "hello" && type === HS.serverHello) {
      const sh = parseServerHello(body);
      if (!sh || sh.version !== V12) throw new Error("server version");
      if (sh.suite !== SUITE || sh.compression !== 0) throw new Error("server cipher");
      this.serverRandom = sh.random;
      this.transcript.push(full);
      this.state = "server";
      // die Bridge hat unser ClientHello: nicht mehr wiederholen, bis wir selbst den nächsten Flug schicken
      clearTimeout(this.timer);
      this.flight = null;
      return;
    }
    if (this.state === "server" && (type === HS.serverKeyExchange || type === HS.certificateRequest)) {
      if (type === HS.certificateRequest) throw new Error("certificate requested");
      // nur ein Identitätshinweis (psk_identity_hint): für den Hash merken, sonst bedeutungslos
      this.transcript.push(full);
      return;
    }
    if (this.state === "server" && type === HS.serverHelloDone) {
      this.transcript.push(full);
      return this._finish();
    }
    if (this.state === "finished" && type === HS.finished && epoch === 1) {
      const want = prf(this.master, "server finished", crypto.createHash("sha256").update(Buffer.concat(this.transcript)).digest(), 12);
      if (!this.peerCcs || body.length !== 12 || !crypto.timingSafeEqual(body, want)) throw new Error("server finished");
      this.state = "open";
      this.flight = null;
      return this._done?.();
    }
    throw new Error(`unexpected handshake message ${type} in ${this.state}`);
  }
  _finish() {
    const id = this.identity, cke = Buffer.alloc(2 + id.length);
    cke.writeUInt16BE(id.length, 0);
    id.copy(cke, 2);
    const ckeMsg = hsMessage(HS.clientKeyExchange, this.hsSeq++, cke);
    this.transcript.push(ckeMsg);
    this.master = prf(pskPremaster(this.psk), "master secret", Buffer.concat([this.random, this.serverRandom]), 48);
    this.k = keyBlock(this.master, this.random, this.serverRandom);
    const verify = prf(this.master, "client finished", crypto.createHash("sha256").update(Buffer.concat(this.transcript)).digest(), 12);
    const fin = hsMessage(HS.finished, this.hsSeq++, verify);
    this.transcript.push(fin);
    this.state = "finished";
    this.epoch = 1;
    this._flight([
      { type: CT.handshake, body: ckeMsg, epoch: 0 },
      { type: CT.ccs, body: Buffer.from([1]), epoch: 0 },
      { type: CT.handshake, body: fin, epoch: 1 },
    ]);
  }
}

const connect = (opts) => new DtlsClient(opts).connect();

module.exports = { DtlsClient, connect, prf, pskPremaster, keyBlock, gcmSeal, gcmOpen, aadOf, seqBytes, record, parseRecords, hsMessage, clientHello, SUITE };
