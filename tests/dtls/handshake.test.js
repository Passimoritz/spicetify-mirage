// Ablauf des DTLS-Clients gegen einen kleinen nachgebauten Server auf 127.0.0.1: mit und ohne Cookie, verlorene
// Flüge (Wiederholung mit Verdoppeln), aufgeteilte Nachrichten, Identitätshinweis, falscher Schlüssel, Alarm.
// Der Server rechnet mit denselben Bausteinen – die Bausteine selbst prüfen vectors.test.js (Testvektoren) und
// run.js (gegen OpenSSL). Aufruf: node tests/dtls/handshake.test.js
const assert = require("assert");
const crypto = require("crypto");
const dgram = require("dgram");
const d = require("../../overlay/dtls.js");

const PSK = Buffer.from("00112233445566778899aabbccddeeff", "hex"), ID = "hue-app-id-123";
const sha = (list) => crypto.createHash("sha256").update(Buffer.concat(list)).digest();

function fakeServer({ psk = PSK, cookie = true, hint = "", fragment = false, dropFirstHello = false, dropFirstFinish = false, alertOnHello = false } = {}) {
  const sock = dgram.createSocket("udp4");
  const st = { hellos: 0, finishes: 0, app: [], identity: null, done: false, datagrams: 0 };
  const wseq = [0, 0], sr = crypto.randomBytes(32);
  let mseq = 0, transcript = [], cr = null, master = null, k = null, peer = null;
  const out = (recs) => sock.send(Buffer.concat(recs), peer.port, peer.address);
  const rec = (type, epoch, body) => {
    const seq = wseq[epoch]++;
    if (!epoch) return d.record(type, 0, seq, body);
    const ex = d.seqBytes(epoch, seq);
    return d.record(type, epoch, seq, Buffer.concat([ex, d.gcmSeal(k.sKey, k.sIv, ex, d.aadOf(epoch, seq, type, body.length), body)]));
  };
  sock.on("message", (buf, rinfo) => {
    peer = rinfo;
    st.datagrams++;
    for (const r of d.parseRecords(buf)) {
      let body = r.body;
      if (r.epoch === 1) {
        body = d.gcmOpen(k.cKey, k.cIv, body.subarray(0, 8), d.aadOf(1, r.seq, r.type, body.length - 24), body.subarray(8));
        if (!body) return; // falscher Schlüssel: still verwerfen
      }
      if (r.type === 23) st.app.push(body.toString());
      if (r.type !== 22) continue;
      const type = body[0], seq = body.readUInt16BE(4), msg = body.subarray(12);
      if (type === 1) {
        st.hellos++;
        if (dropFirstHello && st.hellos === 1) return;
        if (alertOnHello) return out([d.record(21, 0, 0, Buffer.from([2, 40]))]);
        cr = msg.subarray(2, 34);
        const sid = msg[34], ck = msg.subarray(36 + sid, 36 + sid + msg[35 + sid]);
        if (cookie && !ck.length) {
          // HelloVerifyRequest: Version 1.0 wie in RFC 6347 empfohlen
          mseq = 1;
          return out([rec(22, 0, d.hsMessage(3, 0, Buffer.from([0xfe, 0xff, 4, 9, 8, 7, 6])))]);
        }
        if (cookie) assert.deepStrictEqual(ck, Buffer.from([9, 8, 7, 6]), "Cookie kam falsch zurück");
        transcript = [d.hsMessage(1, seq, msg)];
        const sh = Buffer.concat([Buffer.from([0xfe, 0xfd]), sr, Buffer.from([0, 0x00, 0xa8, 0])]);
        const msgs = [d.hsMessage(2, mseq++, sh)];
        if (hint) {
          const h = Buffer.alloc(2 + hint.length);
          h.writeUInt16BE(hint.length, 0);
          h.write(hint, 2);
          msgs.push(d.hsMessage(12, mseq++, h));
        }
        msgs.push(d.hsMessage(14, mseq++, Buffer.alloc(0)));
        transcript.push(...msgs);
        if (fragment) {
          // ServerHello in zwei Stücken, in falscher Reihenfolge und in eigenen Datagrammen
          const full = msgs[0], b = full.subarray(12), cut = 20;
          const part = (off, len) => {
            const h = Buffer.from(full.subarray(0, 12));
            h.writeUIntBE(off, 6, 3);
            h.writeUIntBE(len, 9, 3);
            return Buffer.concat([h, b.subarray(off, off + len)]);
          };
          out([rec(22, 0, part(cut, b.length - cut))]);
          out([rec(22, 0, part(0, cut))]);
          out(msgs.slice(1).map((m) => rec(22, 0, m)));
        } else out(msgs.map((m) => rec(22, 0, m)));
      } else if (type === 16 && r.epoch === 0) {
        if (dropFirstFinish && !st.finishes++) return; // ganzen Flug „verlieren“
        if (master) continue; // Wiederholung
        const len = msg.readUInt16BE(0);
        st.identity = msg.subarray(2, 2 + len).toString();
        transcript.push(d.hsMessage(16, seq, msg));
        master = d.prf(d.pskPremaster(psk), "master secret", Buffer.concat([cr, sr]), 48);
        k = d.keyBlock(master, cr, sr);
      } else if (type === 20 && r.epoch === 1) {
        if (st.done) continue;
        const want = d.prf(master, "client finished", sha(transcript), 12);
        if (!msg.equals(want)) return;
        transcript.push(d.hsMessage(20, seq, msg));
        const fin = d.hsMessage(20, mseq++, d.prf(master, "server finished", sha(transcript), 12));
        st.done = true;
        out([rec(20, 0, Buffer.from([1])), rec(22, 1, fin)]);
      }
    }
  });
  return new Promise((r) => sock.bind(0, "127.0.0.1", () => r({ port: sock.address().port, st, close: () => sock.close() })));
}
const client = (port, o = {}) => new d.DtlsClient({ host: "127.0.0.1", port, identity: ID, psk: PSK, timeout: 3000, retransmit: 100, ...o });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  for (const opts of [{ cookie: true }, { cookie: false }, { hint: "Philips Hue" }, { fragment: true }, { dropFirstHello: true }, { dropFirstFinish: true }, { cookie: true, fragment: true, dropFirstFinish: true }]) {
    const srv = await fakeServer(opts);
    const c = client(srv.port);
    const t0 = Date.now();
    await c.connect();
    assert.strictEqual(srv.st.identity, ID, JSON.stringify(opts));
    for (let i = 0; i < 3; i++) c.send(Buffer.from("bild " + i));
    await sleep(50);
    assert.deepStrictEqual(srv.st.app, ["bild 0", "bild 1", "bild 2"], JSON.stringify(opts));
    if (opts.dropFirstHello) assert.strictEqual(srv.st.hellos, opts.cookie === false ? 2 : 3, "ClientHello wurde nicht wiederholt");
    if (opts.dropFirstFinish) assert.ok(Date.now() - t0 >= 100, "Wiederholung zu früh");
    c.close();
    await sleep(30);
    // close_notify kam verschlüsselt an (als Alarm-Datensatz) – danach nichts mehr
    assert.strictEqual(c.send(Buffer.from("x")), false);
    srv.close();
  }
  // falscher Schlüssel: der Server antwortet nicht mehr → Zeitüberschreitung, kein „offen“
  {
    const srv = await fakeServer({ psk: Buffer.alloc(16, 1) });
    const c = client(srv.port, { timeout: 800 });
    let closed = false;
    c.on("close", () => (closed = true));
    await assert.rejects(c.connect(), /timeout/);
    assert.ok(closed);
    // in 800 ms bei 100/200/400 ms Wartezeit: erster Versand und höchstens drei Wiederholungen des letzten Flugs
    assert.ok(srv.st.datagrams <= 6, "zu viele Wiederholungen: " + srv.st.datagrams);
    srv.close();
  }
  // Alarm der Gegenseite während des Handshakes: sofort Fehler, nicht erst nach der Zeitüberschreitung
  {
    const srv = await fakeServer({ alertOnHello: true });
    const t0 = Date.now();
    await assert.rejects(client(srv.port).connect(), /alert 40/);
    assert.ok(Date.now() - t0 < 1000);
    srv.close();
  }
  // niemand da: Zeitüberschreitung
  {
    const srv = await fakeServer();
    srv.close();
    await assert.rejects(client(srv.port, { timeout: 400 }).connect(), /timeout|ECONNREFUSED|ECONNRESET/);
  }
  // Unsinn beim Anlegen
  assert.throws(() => new d.DtlsClient({ host: "127.0.0.1", identity: ID, psk: "abc" }), /psk/);
  console.log("dtls handshake: ok");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
