/* ------------------------------------------------------------------ Party auf dem Fernseher */
// Der PC rechnet die Party, der Fernseher zeigt nur das fertige Bild – wie Bildschirm-Spiegeln:
// · Chromecast / Google TV / Android TV (Google Cast): das Spotify-Fenster wird aufgenommen, als Video (WebM)
//   kodiert und über das eigene Netz an den Standard-Medienplayer des Fernsehers gestreamt.
// · Smart-TVs mit DLNA (Samsung, LG, Sony, Philips …): derselbe Stream als H.264/MKV über UPnP-AV.
// · Miracast: Windows’ eigene Funkübertragung (Win + K) – der Fernseher wird ein zweiter Bildschirm.
// Ton ist aus (Spotify spielt weiter wie gewohnt); auf Wunsch wird der PC-Ton mit in den Stream gepackt –
// dann laufen Bild und Ton auf dem Fernseher zusammen im Takt.
const http = require("http");
const dgram = require("dgram");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { BrowserWindow, desktopCapturer, session, ipcMain } = require("electron");

const PORT = 47330;

function createCast({ log = () => {}, track = () => null } = {}) {
  let bonjour = null, server = null, capWin = null, capReady = null, stream = null, token = "";
  const found = new Map(); // id → Gerät
  const active = new Map(); // id → { kind, host, stop() }
  let want = { audio: false, mime: "video/webm" };

  /* ---- Geräte finden: Google Cast (mDNS) und DLNA-Fernseher (SSDP) */
  async function scan(ms = 3500) {
    await Promise.all([scanCast(ms), scanDlna(ms)]);
    return list();
  }
  function scanCast(ms) {
    return new Promise((resolve) => {
      try {
        const { Bonjour } = require("bonjour-service");
        bonjour ||= new Bonjour();
        const browser = bonjour.find({ type: "googlecast" }, (s) => {
          const host = (s.addresses || []).find((a) => /^\d{1,3}(\.\d{1,3}){3}$/.test(a)) || s.referer?.address;
          if (!host) return;
          const txt = s.txt || {};
          // reine Lautsprecher (ohne Bildschirm) können kein Video zeigen: Bit 1 von „ca“ = Video
          const caps = Number(txt.ca || 0);
          if (caps && (caps & 1) !== 1) return;
          const id = "cast:" + String(txt.id || s.name || host);
          found.set(id, { id, kind: "cast", name: String(txt.fn || s.name || host), model: String(txt.md || "Google Cast"), host, port: s.port || 8009 });
        });
        setTimeout(() => {
          try { browser.stop(); } catch {}
          resolve();
        }, ms);
      } catch (e) {
        log("cast scan " + e);
        resolve();
      }
    });
  }
  function scanDlna(ms) {
    return new Promise((resolve) => {
      let sock;
      const seen = new Set();
      try {
        sock = dgram.createSocket({ type: "udp4", reuseAddr: true });
      } catch {
        return resolve();
      }
      sock.on("error", () => {});
      sock.on("message", (buf) => {
        const loc = /^location:\s*(\S+)/im.exec(String(buf))?.[1];
        if (!loc || seen.has(loc) || !/^http:\/\/\d{1,3}(\.\d{1,3}){3}(:\d+)?\//.test(loc)) return;
        seen.add(loc);
        describe(loc).then((d) => d && found.set(d.id, d)).catch(() => {});
      });
      sock.bind(() => {
        const msg = Buffer.from(["M-SEARCH * HTTP/1.1", "HOST: 239.255.255.250:1900", 'MAN: "ssdp:discover"', "MX: 2", "ST: urn:schemas-upnp-org:service:AVTransport:1", "", ""].join("\r\n"));
        try {
          sock.send(msg, 1900, "239.255.255.250");
          setTimeout(() => sock.send(msg, 1900, "239.255.255.250"), 700);
        } catch {}
      });
      setTimeout(() => {
        try { sock.close(); } catch {}
        // Beschreibungen kurz nachladen lassen
        setTimeout(resolve, 600);
      }, ms);
    });
  }
  function get(url, timeout = 3000) {
    return new Promise((resolve, reject) => {
      const req = http.get(url, { timeout }, (res) => {
        let s = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (s.length < 2e5 ? (s += c) : req.destroy()));
        res.on("end", () => resolve(s));
      });
      req.on("timeout", () => req.destroy(new Error("timeout")));
      req.on("error", reject);
    });
  }
  const tag = (xml, name) => new RegExp(`<(?:\\w+:)?${name}>([^<]*)</(?:\\w+:)?${name}>`, "i").exec(xml)?.[1]?.trim() || "";
  async function describe(loc) {
    const xml = await get(loc);
    const svc = [...xml.matchAll(/<service>([\s\S]*?)<\/service>/gi)].map((m) => m[1]).find((s) => /AVTransport/i.test(tag(s, "serviceType")));
    if (!svc) return null;
    const base = new URL(loc);
    const control = new URL(tag(svc, "controlURL"), base).href;
    const host = base.hostname;
    return { id: "dlna:" + (tag(xml, "UDN") || host), kind: "dlna", name: tag(xml, "friendlyName") || host, model: tag(xml, "modelName") || "DLNA", host, control };
  }
  const list = () => [...found.values()].map((d) => ({ id: d.id, kind: d.kind, name: d.name, model: d.model, host: d.host, on: active.has(d.id) }));

  /* ---- Aufnahme: verstecktes Fenster nimmt das Spotify-Fenster auf und kodiert es (MediaRecorder) */
  function lanIp(near) {
    const all = Object.values(os.networkInterfaces()).flat().filter((a) => a && a.family === "IPv4" && !a.internal);
    const pre = String(near || "").split(".").slice(0, 3).join(".");
    return (all.find((a) => a.address.startsWith(pre + ".")) || all[0])?.address || "";
  }
  async function spotifySource() {
    const src = await desktopCapturer.getSources({ types: ["window"], thumbnailSize: { width: 0, height: 0 } });
    const tr = track();
    const title = String(tr?.title || "").toLowerCase();
    // Spotify heißt beim Abspielen „Künstler – Titel“, sonst „Spotify Premium“ / „Spotify“
    return src.find((s) => title && s.name.toLowerCase().includes(title)) || src.find((s) => /^spotify/i.test(s.name)) || null;
  }
  function captureWindow() {
    if (capWin && !capWin.isDestroyed()) return capReady;
    const ses = session.fromPartition("mirage-cast");
    ses.setPermissionRequestHandler((_wc, perm, cb) => cb(perm === "media" || perm === "display-capture"));
    ses.setDisplayMediaRequestHandler(async (_req, cb) => {
      const s = await spotifySource();
      if (!s) return cb({});
      // Ton: alles, was der PC gerade ausgibt (Windows-„Loopback“) – nur wenn gewünscht
      cb(want.audio ? { video: s, audio: "loopback" } : { video: s });
    });
    capWin = new BrowserWindow({
      show: false, width: 320, height: 200, skipTaskbar: true,
      webPreferences: { session: ses, preload: path.join(__dirname, "capture-preload.js"), contextIsolation: true, sandbox: false, backgroundThrottling: false },
    });
    capReady = capWin.loadFile(path.join(__dirname, "capture.html"));
    capWin.on("closed", () => (capWin = null));
    return capReady;
  }
  ipcMain.on("castChunk", (_e, buf) => {
    if (stream && !stream.destroyed) stream.write(Buffer.from(buf));
  });
  ipcMain.on("castError", (_e, msg) => {
    log("cast capture " + msg);
    stream?.end();
  });
  function serve() {
    if (server) return;
    server = http.createServer(async (req, res) => {
      const m = /^\/m\/([\w-]+)\.(webm|mkv)$/.exec(req.url || "");
      if (!m || m[1] !== token) {
        res.writeHead(404);
        return res.end();
      }
      if (req.method === "HEAD") {
        res.writeHead(200, { "content-type": m[2] === "mkv" ? "video/x-matroska" : "video/webm", "accept-ranges": "none" });
        return res.end();
      }
      // ein Zuschauer zur Zeit: neue Anfrage → Aufnahme neu starten (Video muss mit einem Kopf beginnen)
      try { stream?.end(); } catch {}
      stream = res;
      res.writeHead(200, { "content-type": m[2] === "mkv" ? "video/x-matroska" : "video/webm", "cache-control": "no-store", "accept-ranges": "none", "transferMode.dlna.org": "Streaming" });
      await captureWindow();
      capWin?.webContents.send("castStart", { mime: m[2] === "mkv" ? "video/x-matroska" : "video/webm", audio: want.audio });
      res.on("close", () => {
        if (stream === res) {
          stream = null;
          capWin?.webContents.send("castStop");
        }
      });
    });
    server.on("error", (e) => log("cast server " + e));
    server.listen(PORT, "0.0.0.0");
  }

  /* ---- Übertragung starten / beenden */
  async function start(id, { audio = false } = {}) {
    const d = found.get(id);
    if (!d) return { error: "gone" };
    if (!(await spotifySource())) return { error: "nowindow" };
    for (const k of [...active.keys()]) stop(k);
    want = { audio: !!audio };
    token = crypto.randomBytes(12).toString("hex");
    serve();
    const ip = lanIp(d.host);
    if (!ip) return { error: "network" };
    // Chromecast: WebM (VP8) · DLNA-Fernseher: H.264 im MKV-Container (läuft fortlaufend, fast jeder Smart-TV kann H.264)
    const ext = d.kind === "dlna" ? "mkv" : "webm";
    const url = `http://${ip}:${PORT}/m/${token}.${ext}`;
    const r = d.kind === "cast" ? await startCast(d, url) : await startDlna(d, url);
    if (r.ok) active.set(id, r.ctl);
    return r.ok ? { ok: true } : r;
  }
  function startCast(d, url) {
    return new Promise((resolve) => {
      let cast;
      try {
        cast = require("castv2-client");
      } catch {
        return resolve({ error: "lib" });
      }
      const client = new cast.Client();
      let done = false;
      const finish = (r) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(r);
      };
      const timer = setTimeout(() => {
        try { client.close(); } catch {}
        finish({ error: "timeout" });
      }, 15000);
      client.on("error", (e) => {
        log("cast error " + e);
        active.delete(d.id);
        try { client.close(); } catch {}
        finish({ error: "unreachable" });
      });
      client.connect({ host: d.host, port: d.port || 8009 }, () => {
        client.launch(cast.DefaultMediaReceiver, (err, player) => {
          if (err || !player) {
            try { client.close(); } catch {}
            return finish({ error: "launch" });
          }
          const media = { contentId: url, contentType: "video/webm", streamType: "LIVE", metadata: { type: 0, metadataType: 0, title: "Mirage Party" } };
          player.load(media, { autoplay: true }, (e2) => {
            if (e2) {
              try { client.close(); } catch {}
              return finish({ error: "load" });
            }
            player.on("close", () => active.delete(d.id));
            finish({ ok: true, ctl: { stop: () => client.stop(player, () => { try { client.close(); } catch {} }) } });
          });
        });
      });
    });
  }
  function soap(control, action, body) {
    const xml = `<?xml version="1.0" encoding="utf-8"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><s:Body><u:${action} xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID>${body}</u:${action}></s:Body></s:Envelope>`;
    return new Promise((resolve) => {
      const u = new URL(control);
      const req = http.request(u, { method: "POST", timeout: 5000, headers: { "content-type": 'text/xml; charset="utf-8"', soapaction: `"urn:schemas-upnp-org:service:AVTransport:1#${action}"`, "content-length": Buffer.byteLength(xml) } }, (res) => {
        res.resume();
        res.on("end", () => resolve(res.statusCode < 300));
      });
      req.on("timeout", () => req.destroy());
      req.on("error", () => resolve(false));
      req.end(xml);
    });
  }
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  async function startDlna(d, url) {
    const meta = `<DIDL-Lite xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/"><item id="0" parentID="-1" restricted="1"><dc:title>Mirage Party</dc:title><upnp:class>object.item.videoItem</upnp:class><res protocolInfo="http-get:*:video/x-matroska:DLNA.ORG_OP=00;DLNA.ORG_FLAGS=01700000000000000000000000000000">${esc(url)}</res></item></DIDL-Lite>`;
    const ok = await soap(d.control, "SetAVTransportURI", `<CurrentURI>${esc(url)}</CurrentURI><CurrentURIMetaData>${esc(meta)}</CurrentURIMetaData>`);
    if (!ok) return { error: "load" };
    const play = await soap(d.control, "Play", "<Speed>1</Speed>");
    if (!play) return { error: "load" };
    return { ok: true, ctl: { stop: () => soap(d.control, "Stop", "") } };
  }
  function stop(id) {
    const a = active.get(id);
    active.delete(id);
    try { a?.stop(); } catch {}
    if (!active.size) {
      try { stream?.end(); } catch {}
      stream = null;
      capWin?.webContents.send("castStop");
      token = "";
    }
    return !!a;
  }
  function stopAll() {
    for (const k of [...active.keys()]) stop(k);
    try { server?.close(); } catch {}
    server = null;
    try { bonjour?.destroy(); } catch {}
    bonjour = null;
    if (capWin && !capWin.isDestroyed()) capWin.destroy();
  }
  // Miracast: Windows’ Übertragen-Leiste öffnen (wie Win + K) – danach ist der Fernseher ein Bildschirm
  function miracast() {
    if (process.platform !== "win32") return false;
    const ps = "Add-Type -Name K -Namespace W -MemberDefinition '[DllImport(\"user32.dll\")] public static extern void keybd_event(byte v, byte s, int f, int e);'; [W.K]::keybd_event(0x5B,0,0,0); [W.K]::keybd_event(0x4B,0,0,0); [W.K]::keybd_event(0x4B,0,2,0); [W.K]::keybd_event(0x5B,0,2,0)";
    require("child_process").execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", ps], { windowsHide: true }, () => {});
    return true;
  }
  return { scan, start, stop, stopAll, list, miracast };
}

module.exports = { createCast };
