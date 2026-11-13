// Ende-zu-Ende: der DTLS-Client (overlay/dtls.js) gegen einen echten OpenSSL-Server auf 127.0.0.1
//   openssl s_server -dtls1_2 -psk <hex> -psk_identity <id> -cipher PSK-AES128-GCM-SHA256 -nocert
// Prüft Handshake (mit HelloVerifyRequest/Cookie), dass der Server die Anwendungsdaten entschlüsselt, und dass
// falscher Schlüssel bzw. falsche Identität scheitern. Ohne OpenSSL mit DTLS: Hinweis und Ende ohne Fehler –
// außer mit --require (CI), dann ist das ein Fehler.
// Aufruf: node tests/dtls/run.js [--require]     OpenSSL wählen: OPENSSL=/pfad/zu/openssl
// WIN: das OpenSSL aus mingw64 (Git Bash) beantwortet DTLS nicht; das aus Gits usr/bin schon – es wird mit probiert.
const assert = require("assert");
const dgram = require("dgram");
const fs = require("fs");
const path = require("path");
const { spawn, spawnSync } = require("child_process");
const { DtlsClient } = require("../../overlay/dtls.js");

const REQUIRE = process.argv.includes("--require");
const PSK = "0123456789abcdef0123456789abcdef", ID = "mirage-dtls-test";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function candidates() {
  const list = [process.env.OPENSSL, "openssl"];
  if (process.platform === "win32") {
    for (const base of [process.env.ProgramFiles, process.env["ProgramFiles(x86)"], process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Programs")]) {
      if (base) list.push(path.join(base, "Git", "usr", "bin", "openssl.exe"));
    }
  }
  return [...new Set(list.filter(Boolean))].filter((bin) => {
    if (path.isAbsolute(bin) && !fs.existsSync(bin)) return false;
    const r = spawnSync(bin, ["s_server", "-help"], { encoding: "utf8", timeout: 5000 });
    return !r.error && /-dtls1_2/.test((r.stdout || "") + (r.stderr || ""));
  });
}
// freier UDP-Port auf 127.0.0.1
function freePort() {
  return new Promise((resolve) => {
    const s = dgram.createSocket("udp4");
    s.bind(0, "127.0.0.1", () => {
      const p = s.address().port;
      s.close(() => resolve(p));
    });
  });
}
// Server starten (stdin bleibt offen, sonst beendet sich s_server), out sammelt alles, was er schreibt
async function server(bin, quiet = true) {
  const port = await freePort();
  const p = spawn(bin, ["s_server", "-dtls1_2", "-accept", `127.0.0.1:${port}`, "-psk", PSK, "-psk_identity", ID, "-cipher", "PSK-AES128-GCM-SHA256", "-nocert", ...(quiet ? ["-quiet"] : [])], { stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
  const srv = { port, out: "", stop: () => { try { p.kill(); } catch {} } };
  p.stdout.on("data", (d) => (srv.out += d));
  p.stderr.on("data", (d) => (srv.out += d));
  p.on("error", () => {});
  await sleep(800);
  return srv;
}
async function attempt(port, identity, psk, timeout = 5000) {
  const c = new DtlsClient({ host: "127.0.0.1", port, identity, psk: Buffer.from(psk, "hex"), timeout });
  try {
    await c.connect();
    return c;
  } catch (e) {
    return e;
  }
}

(async () => {
  let bin = null;
  for (const b of candidates()) {
    const s = await server(b);
    const c = await attempt(s.port, ID, PSK, 4000);
    if (!(c instanceof Error)) {
      c.close();
      bin = b;
    }
    s.stop();
    if (bin) break;
    console.log(`dtls: ${b} antwortet nicht auf DTLS (${c.message}) – nächster`);
  }
  if (!bin) {
    const msg = "dtls: kein OpenSSL mit funktionierendem DTLS-Server gefunden – Ende-zu-Ende-Test übersprungen";
    if (REQUIRE) {
      console.error(msg);
      process.exit(1);
    }
    console.log(msg);
    return;
  }
  console.log("dtls: OpenSSL =", bin, "–", spawnSync(bin, ["version"], { encoding: "utf8" }).stdout.trim());

  // 1) Handshake und Daten: der Server gibt entschlüsselte Anwendungsdaten auf stdout aus
  {
    const s = await server(bin);
    const c = await attempt(s.port, ID, PSK);
    assert.ok(!(c instanceof Error), "Handshake: " + c.message);
    let closed = false;
    c.on("close", () => (closed = true));
    const t0 = Date.now();
    for (let i = 0; i < 25; i++) {
      assert.strictEqual(c.send(Buffer.from(`frame ${i} mirage\n`)), true);
      await sleep(20);
    }
    await sleep(400);
    c.close();
    assert.ok(closed, "close-Ereignis fehlt");
    assert.strictEqual(c.send(Buffer.from("x")), false, "nach close darf nichts mehr rausgehen");
    await sleep(300);
    s.stop();
    for (const i of [0, 12, 24]) assert.ok(s.out.includes(`frame ${i} mirage`), `Server hat Bild ${i} nicht entschlüsselt:\n${s.out}`);
    assert.ok(!/not what we expected/i.test(s.out), "Server meldet eine fremde Identität");
    console.log(`dtls: Handshake + 25 Bilder in ${Date.now() - t0} ms ok`);
  }
  // 2) falscher Schlüssel: Finished passt nicht, der Server bricht ab (oder schweigt) – nie „verbunden“
  {
    const s = await server(bin);
    const c = await attempt(s.port, ID, "ffffffffffffffffffffffffffffffff", 4000);
    s.stop();
    assert.ok(c instanceof Error, "falscher Schlüssel wurde angenommen");
    console.log("dtls: falscher Schlüssel abgelehnt (" + c.message + ")");
  }
  // 3) andere Identität: s_server nimmt jede an und warnt nur („not what we expected“). Geprüft wird, dass die
  //    Identität genau so ankommt, wie sie gesendet wurde – die richtige oben ohne Warnung, diese mit.
  {
    const s = await server(bin, false);
    const c = await attempt(s.port, "someone-else", PSK, 4000);
    if (!(c instanceof Error)) c.close();
    await sleep(300);
    s.stop();
    assert.ok(/someone-else/.test(s.out) && /not what we expected/i.test(s.out), "Identität kam nicht wie gesendet an:\n" + s.out);
    console.log("dtls: Identität kommt unverändert an");
  }
  console.log("dtls run: ok");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
