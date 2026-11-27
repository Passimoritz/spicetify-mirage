// node tests/unit/hardening.test.js
// Härtung aus der Durchsicht 1.34: alles, was von außen kommt (geteilte Schema-Codes, Sicherungen, die Reparatur-Datei,
// Nachrichten an die Overlay-App), wird geprüft, bevor es in ein Stylesheet, einen Dateinamen oder den Speicher gelangt.
// Dazu die Blitz-Merker der Bühnenbilder, der Neuverbindungs-Wecker des Stream-Deck-Plugins und die Endcodes der
// Prüfwerkzeuge.
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const http = require("http");
const vm = require("vm");
const { spawnSync } = require("child_process");
const { load } = require("./load.js");

const ROOT = path.join(__dirname, "..", "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

/* ---- Browser-Attrappe für config.js und remote.js */
const store = new Map();
const sheets = [];
const mkEl = () => {
  const e = { id: "", textContent: "", isConnected: false, dataset: {}, classList: { toggle() {}, add() {}, remove() {}, contains: () => false } };
  sheets.push(e);
  return e;
};
Object.assign(globalThis, {
  window: { Spicetify: { Config: { color_scheme: "Mirage" }, Platform: {} } },
  document: {
    hidden: true,
    documentElement: { dataset: {}, classList: { toggle() {}, add() {}, remove() {}, contains: () => false } },
    head: { append: (...els) => els.forEach((e) => (e.isConnected = true)) },
    createElement: mkEl,
    querySelector: () => null,
    addEventListener() {},
  },
  localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
  matchMedia: () => ({ matches: false, addEventListener() {} }),
  addEventListener() {},
  fetch: () => Promise.reject(new Error("offline")),
});
if (!globalThis.navigator) globalThis.navigator = { language: "en", languages: ["en"] };

/* ---- 1) Farbschemata: nur sechsstellige Hex-Werte erreichen das Stylesheet */
{
  // gespeicherte Einstellungen mit einem eingeschleusten Schema und kaputten Arten – wie nach einem bösen Import
  const evil = "000}*{display:none!important}html{";
  store.set("mirage:settings", JSON.stringify({
    schemeCfg: "Mirage",
    pinned: null,
    plRecent: "nope",
    blur: 12,
    customSchemes: {
      Evil: { text: "FFFFFF", subtext: "CCCCCC", main: evil, button: "B69CFF", "button-active": "D4C6FF", notification: "7C5CFF" },
      Good: { text: "FFFFFF", subtext: "CCCCCC", main: "101010", button: "B69CFF", "button-active": "D4C6FF", notification: "7C5CFF" },
    },
  }));
  const C = load("config.js");

  assert.ok(C.isHex("B69CFF") && C.isHex("b69cff"));
  for (const bad of ["B69CF", "B69CFFF", "#B69CFF", "GGGGGG", evil, "", null, undefined, 123456, ["B69CFF"]]) assert.ok(!C.isHex(bad), `kein Hex: ${String(bad)}`);

  // Laden: kaputte Arten fallen auf den Standard zurück, gültige Werte bleiben
  assert.deepStrictEqual(C.cfg.pinned, {}, "pinned: null wird nicht übernommen");
  assert.deepStrictEqual(C.cfg.plRecent, [], "plRecent als Text wird nicht übernommen");
  assert.strictEqual(C.cfg.blur, 12);
  assert.ok(!("Evil" in C.cfg.customSchemes) && !("Evil" in C.SCHEMES), "Schema mit CSS im Farbwert wird verworfen");
  assert.ok("Good" in C.cfg.customSchemes && "Good" in C.SCHEMES);

  // Baukasten: nur vier echte Farben ergeben ein Schema
  const ok = C.buildScheme({ base: "101018", accent: "B69CFF", deep: "7C5CFF", light: "D4C6FF" });
  assert.ok(C.validScheme(ok), "abgeleitetes Schema ist gültig");
  assert.strictEqual(Object.keys(ok).length, 18);
  assert.strictEqual(C.buildScheme({ base: evil, accent: "B69CFF", deep: "7C5CFF", light: "D4C6FF" }), null);
  assert.strictEqual(C.buildScheme({ accent: "B69CFF" }), null, "unvollständiger Code wirft nicht, sondern ergibt nichts");
  assert.strictEqual(C.buildScheme(undefined), null);
  assert.ok(C.buildScheme({ base: "F4F1FA", accent: "6B4EE6", deep: "7C5CFF", light: "4F35C9" }).light === true, "helle Grundfarbe = helles Schema");

  // selbst ein Schema, das an der Prüfung vorbei in SCHEMES steht, schreibt keinen fremden Text ins Stylesheet
  C.SCHEMES.Sneaky = { ...ok, card: evil };
  C.applyScheme("Sneaky");
  const css = sheets.find((s) => s.id === "mirage-scheme").textContent;
  assert.ok(css.includes("--spice-main:#101018;"), "gültige Werte stehen im Stylesheet");
  assert.ok(!css.includes("display:none") && !css.includes("--spice-card"), "der ungültige Wert fehlt ganz");
  assert.strictEqual((css.match(/\}/g) || []).length, 1, "genau eine Regel");
  delete C.SCHEMES.Sneaky;

  // Einstellungen einlesen (Code oder Datei)
  assert.strictEqual(C.cleanSettings(null), null);
  assert.strictEqual(C.cleanSettings([1, 2]), null);
  assert.strictEqual(C.cleanSettings("x"), null);
  const d = C.cleanSettings({ pinned: null, lyricPicks: [], gameTour: {}, blur: "40", particles: 0, scheme: "Pearl", zoomOff1155: true, neuIn2: { a: 1 }, customSchemes: { A: { main: evil }, B: ok } });
  assert.ok(!("pinned" in d) && !("lyricPicks" in d) && !("gameTour" in d), "Objekt/Liste/null an falscher Stelle fällt weg");
  assert.strictEqual(d.blur, "40", "einfache Werte bleiben (Regler speichern auch Text)");
  assert.strictEqual(d.particles, 0);
  assert.strictEqual(d.zoomOff1155, true, "Merker ohne Standardwert bleiben");
  assert.deepStrictEqual(d.neuIn2, { a: 1 }, "unbekannte Schlüssel einer neueren Version bleiben");
  assert.deepStrictEqual(Object.keys(d.customSchemes), ["B"]);
  assert.deepStrictEqual(C.cleanSchemes("x"), {});
  assert.deepStrictEqual(C.cleanSchemes({ ["x".repeat(25)]: ok }), {}, "Name höchstens 24 Zeichen");
}

/* ---- 2) Reparatur-Datei: der CSS-Filter lässt nichts durch, das nachlädt */
{
  const { okCss } = load("remote.js");
  for (const good of [".a{color:red}", ".main-view-container{background:rgba(0,0,0,.4)!important}", "@media (min-width:900px){.b{display:none}}", ""]) assert.ok(okCss(good), good);
  for (const bad of [
    "@import 'https://x/y.css';",
    "@\\69mport 'https://x/y.css';",
    "a{background:url(https://x/p.png)}",
    "a{background:URL ('https://x')}",
    "a{background:\\75rl('https://x/?t')}",
    "a{background:image-set('https://x/p.png' 1x)}",
    "a{background:-webkit-image-set('https://x/p.png' 1x)}",
    "@font-face{font-family:x;src:local(x)}",
    "a{content:'\\41'}",
    "</style><script>1</script>",
    "a{behavior:x}",
    "x".repeat(20001),
    null, 5, {},
  ]) assert.ok(!okCss(bad), `abgelehnt: ${String(bad).slice(0, 40)}`);
}

/* ---- 3) Bühnenbilder: der Blitz-Merker eines Schusses gilt nicht für ein späteres Gewitter */
{
  const { createStageFx } = load("stagefx.js");
  const { createFlashCap } = load("flashcap.js");
  const { FAM, FAMS } = load("scenarios.js");
  const pal = [[255, 80, 120], [80, 160, 255], [255, 220, 90]];
  const base = (t, extra) => ({ t, dt: 1 / 60, vw: 1600, vh: 900, dpr: 1, cx: 800, cy: 405, R: 135, pal, quality: 2, noFlash: true, px: { scn: null }, ...extra });
  const cueOf = (f, seq, t0, extra) => ({ f, fi: FAMS.indexOf(f), t0, k: 1.15, col: null, from: "top", seq, dur: FAM[f].dur, v: 0, dir: 1, ox: 0.3, soft: false, ...extra });
  const mk = (log) => new Proxy({}, { get: (o, k) => (k in o ? o[k] : k === "fillRect" ? (x, y, w, h) => log.push({ fill: String(o.fillStyle), full: x === 0 && y === 0 && w >= 1000 }) : String(k).startsWith("create") ? () => ({ addColorStop() {} }) : () => {}), set: (o, k, v) => ((o[k] = v), true) });
  let takes = 0;
  const real = createFlashCap(), cap = { take: (t) => (takes++, real.take(t)), free: real.free };
  const sfx = createStageFx((c) => String(c), cap);
  // Schuss mit Kennung 3 (Schlüssel früher 3·16+i = 48…50) zündet mit Blitzen an
  for (let i = 0; i < 30; i++) sfx.draw(mk([]), base(10 + i / 60, { noFlash: false, flash: true, cues: [cueOf("muzzle", 3, 10)] }), {}, {});
  assert.ok(takes > 0, "der Schuss fragt die Schranke");
  // Gewitter mit Kennung 12 (früher 12·4+k = 48, 49 – dieselben Schlüssel) bei „Keine Blitze“, ohne Blitze, weich
  takes = 0;
  const log = [];
  for (let i = 0; i < 60 * 4; i++) sfx.draw(mk(log), base(20 + i / 60, { noFlash: true, flash: false, cues: [cueOf("thunder", 12, 20, { soft: true })] }), {}, {});
  assert.strictEqual(takes, 0, "weich und ohne Blitze: die Schranke wird nicht einmal gefragt");
  assert.ok(!log.some((x) => x.full && /^rgba\(200,215,255/.test(x.fill)), "kein bildfüllendes Wetterleuchten mit „Keine Blitze“");
}

/* ---- 4) Overlay-App: Name des Diagnoseberichts, WebSocket-Fehler, Befehle der Fenster */
{
  const main = read("overlay/main.js");
  const src = /const reportPhase = [^\n]+/.exec(main);
  assert.ok(src, "reportPhase gefunden");
  const reportPhase = vm.runInNewContext(`${src[0]}; reportPhase`);
  assert.strictEqual(reportPhase("boot"), "-boot");
  assert.strictEqual(reportPhase("after-nav_2"), "-after-nav_2");
  for (const bad of ["/../settings", "..\\..\\x", "a/b", "a.b", "", null, undefined, 7, {}, "x".repeat(33), "a b"]) assert.strictEqual(reportPhase(bad), "", `kein Pfad im Dateinamen: ${String(bad)}`);
  assert.ok(!/dom-report\$\{m\.phase/.test(main), "m.phase geht nicht mehr ungeprüft in den Dateinamen");
  // jede WebSocket-Verbindung hat einen Zuhörer für "error" (sonst bricht eine zu große Nachricht den Hauptprozess ab)
  const conns = main.split('wss.on("connection"').slice(1);
  assert.strictEqual(conns.length, 3, "drei Server: Theme, OBS, Steuerung");
  for (const c of conns) assert.ok(/ws\.on\("error"/.test(c.slice(0, 900)), "ws.on(\"error\") direkt in der Verbindung");
  assert.ok(/if \(!m \|\| typeof m !== "object"\) return;/.test(main), "JSON „null“ wird verworfen");
  assert.ok(/ipcMain\.on\("cmd", \(_e, c\) => CONTROL_CMDS\.has\(c\) && command\(c\)\)/.test(main), "Fenster dürfen nur die bekannten Befehle schicken");
  assert.ok(!/"yield"[^\n]*app\.exit\(0\)/.test(main), "Platz machen über app.quit (Lampen werden zurückgesetzt)");
}

/* ---- 5) Stream-Deck-Plugin: ein Fehlschlag (error + close) stellt genau einen Wecker */
{
  const html = read("streamdeck/com.passimoritz.mirage.sdPlugin/plugin.html");
  const js = /<script>([\s\S]*?)<\/script>/.exec(html)[1];
  const timers = new Map();
  let nextId = 1, made = 0;
  class FakeWS {
    constructor() {
      made++;
      // wie im Browser: Verbindung scheitert → erst "error", dann "close"
      queueMicrotask(() => { this.onerror?.({}); this.onclose?.({}); });
    }
    send() {}
  }
  const ctx = vm.createContext({ WebSocket: FakeWS, setTimeout: (fn) => (timers.set(nextId, fn), nextId++), clearTimeout: (id) => timers.delete(id), queueMicrotask, JSON, String });
  vm.runInContext(js + "\nconnectMirage();", ctx);
  const tick = () => new Promise((r) => setImmediate(r));
  (async () => {
    // zehn Runden „App läuft nicht“: es bleibt bei einem offenen Wecker und einer neuen Verbindung je Runde
    for (let round = 1; round <= 10; round++) {
      await tick();
      assert.strictEqual(timers.size, 1, `Runde ${round}: genau ein Wecker (waren ${timers.size})`);
      assert.strictEqual(made, round, `Runde ${round}: ${made} Verbindungen`);
      const [[id, fn]] = [...timers];
      timers.delete(id);
      fn();
    }
    await part6();
  })().catch((e) => { console.error(e); process.exit(1); });
}

/* ---- 6) Lampen: eine Antwort, die nach den Kopfzeilen abbricht, hält den Aufruf nicht für immer offen */
async function part6() {
  const { createLights } = require("../../overlay/lights.js");
  // Server schickt Kopfzeilen und einen halben Rumpf, dann nichts mehr (WLAN weg, Bridge startet neu)
  const open = new Set();
  const srv = http.createServer((req, res) => {
    res.writeHead(200, { "content-type": "application/json", "content-length": "100" });
    res.write('{"message":"API');
  });
  srv.on("connection", (s) => (open.add(s), s.on("close", () => open.delete(s))));
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const cfg = { haOn: true, haUrl: `http://127.0.0.1:${srv.address().port}`, haToken: "x".repeat(40), haEntities: "light.test" };
  const lights = createLights(() => cfg, () => {}, () => {});
  const t0 = Date.now();
  const out = await Promise.race([lights.haTest().then((r) => ({ r })), new Promise((r) => setTimeout(() => r("hängt"), 9000))]);
  assert.notStrictEqual(out, "hängt", "haTest() kommt nach dem Zeitlimit zurück, statt für immer offen zu bleiben");
  assert.ok(Date.now() - t0 < 8500);
  for (const s of open) s.destroy();
  await new Promise((r) => srv.close(r));
  part7();
}

/* ---- 7) DTLS: steht die Verbindung, zählt Klartext nicht mehr; erfundene Längen fordern keinen Speicher an */
function part7() {
  const { DtlsClient, record } = require("../../overlay/dtls.js");
  const c = new DtlsClient({ host: "127.0.0.1", identity: "id", psk: Buffer.alloc(16) });
  let shut = 0, failed = 0;
  c._shut = () => shut++;
  c._fail = () => failed++;
  const hs = (len, mseq) => {
    const b = Buffer.alloc(12 + 1);
    b[0] = 2; // ServerHello
    b.writeUIntBE(len, 1, 3);
    b.writeUInt16BE(mseq, 4);
    b.writeUIntBE(0, 6, 3);
    b.writeUIntBE(1, 9, 3);
    return b;
  };
  // im Handshake: ein Stück, das 16 MB ankündigt, wird nicht gesammelt
  c.state = "hello";
  c._handshake(hs(0xffffff, 5), 0);
  assert.strictEqual(c.frags.size, 0, "16 MB aus einem ungeprüften Paket: kein Speicher");
  for (let i = 0; i < 40; i++) c._handshake(hs(64, 10 + i), 0);
  assert.ok(c.frags.size <= 8, `höchstens 8 offene Nachrichten (${c.frags.size})`);
  // offen: ein Klartext-Alarm (close_notify) aus Epoche 0 beendet nichts mehr
  c.frags.clear();
  c.state = "open";
  const alert = record(21, 0, 9, Buffer.from([1, 0]));
  c._onDatagram(alert);
  assert.strictEqual(shut + failed, 0, "Klartext-Alarm nach dem Handshake wird übergangen");
  c._onDatagram(record(22, 0, 10, hs(64, 99)));
  assert.strictEqual(c.frags.size, 0, "Klartext-Handshake nach dem Handshake wird übergangen");
  try { c.close?.(); } catch {}
  part8();
}

/* ---- 8) Prüfwerkzeuge: ein ausdrücklich genannter, fehlender Eingang ist ein Fehler, kein „nichts zu prüfen“ */
function part8() {
  const run = (...args) => spawnSync(process.execPath, args, { cwd: ROOT, encoding: "utf8" });
  assert.strictEqual(run("tools/check-selectors.js", "--xpui", "./gibt-es-nicht").status, 2);
  assert.strictEqual(run("tools/check-spotify.js", "--xpui", "./gibt-es-nicht").status, 2);
  assert.strictEqual(run("tools/i18n-missing.js", "--since", "kein-solcher-stand-xyz").status, 2);

  /* ---- 9) Oberfläche: Regeln, die Mirages eigene Bedienelemente nicht mehr treffen dürfen */
  const css = read("Mirage/user.css");
  assert.ok(!/\[role="dialog"\] input:(hover|focus)/.test(css), "Dialog-Regeln für Hover/Fokus gelten nur für Textfelder, nicht für Schalter und Regler");
  assert.ok(!/::placeholder[^{]*\{\s*color: rgba\(255, 255, 255, 0\.4\) !important/.test(css), "Platzhalter mit 40 % Weiß (3,8 : 1) ist weg");
  assert.ok(/html\.mirage-light \[style\*="--lyrics-color-background"\]/.test(css), "helles Schema: Liedtext-Seite hat dunkle Schrift");
  assert.ok(/@media \(forced-colors: active\)/.test(css) && /@media \(prefers-reduced-transparency: reduce\)/.test(css));
  const focus = /:is\(#mirage-immersive, \.mirage-settings, \.mirage-welcome\) :focus-visible \{([^}]*)\}/.exec(css);
  assert.ok(focus && !/border-radius/.test(focus[1]), "der Fokusring formt das Element nicht um");
  // Regeln, die auf jedem Element der Seite probiert wurden (gemessen mit Chromiums Selektor-Statistik: zwei Drittel
  // der Zeit, die Mirages Regeln je Stil-Durchlauf kosten) – sie dürfen nicht zurückkommen
  assert.ok(!/html:not\(\.mirage-glass\) \*/.test(css), "Glas-Ausschalter ohne Stern-Regel");
  assert.ok(/html:not\(\.mirage-glass\) \{\s*--m-noglass: none;/.test(css), "Glas-Ausschalter als geerbte Variable");
  for (const m of css.matchAll(/^\s*(?:-webkit-)?backdrop-filter:\s*([^;]+);/gm)) assert.ok(/^(none|var\(--m-noglass, )/.test(m[1]), `backdrop-filter hängt am Glas-Ausschalter: ${m[1]}`);
  assert.ok(!/concert-card[^{]*:hover \*/.test(css), "Konzert-Karten: kein „:hover *“");
  assert.ok(!/^::highlight\(mirage-hit\)/m.test(css), "Fundstellen-Regel nur in den Einstellungen");
  // „:is(a, b)“ als letzter Teil eines Selektors landet im Sammelbecken für alle Elemente: aufgeteilt schreiben
  const lastIs = [...css.matchAll(/^([^{}@/]+)\{/gm)].flatMap((m) => m[1].split(/,(?![^()]*\))/)).map((s) => s.trim()).filter((s) => /(^|[\s>+~]):is\((?:[.#][\w-]+|\[[^\]]+\])(?:,\s*(?:[.#][\w-]+|\[[^\]]+\]))+\)(::[\w-]+)?$/.test(s));
  assert.deepStrictEqual(lastIs.filter((s) => !/\.Root__|#main-view|#Desktop_LeftSidebar_Id/.test(s) || /:is\(\.[\w-]+, \.[\w-]+\)$/.test(s)).slice(0, 5), [], "Selektor endet auf :is(.a, .b) – bitte als zwei Selektoren schreiben");
  // Suchvorschläge: die Platte ist so hoch wie die Liste (ab 1200 px Fensterhöhe hing die untere Hälfte ohne Hintergrund da)
  assert.ok(/\[role="listbox"\]\[id\*="searches"\]\[id\*="dropdown"\] \{[^}]*height: auto !important;[^}]*overflow: hidden;/.test(css) || /\[id\*="searches"\]\[id\*="dropdown"\]\)? \{[^}]*height: auto !important;/.test(css), "Suchvorschläge: Höhe folgt dem Inhalt");
  // Immersiv: der Kranz endet unter der Kopfleiste; Menüs sind so hoch wie ihr Inhalt
  assert.ok(/vizRect\.head/.test(read("src/immersive.js")) && /Math\.max\(maxLen \* 0\.4, Math\.min\(maxLen,/.test(read("src/immersive.js")), "Kranz wird auf den Platz unter der Kopfleiste gekürzt");
  const side = /#mirage-immersive \.m-im-side \{([^}]*)\}/.exec(css);
  assert.ok(side && /max-height:/.test(side[1]) && !/bottom:/.test(side[1]), "Menüs oben rechts: Höhe nach Inhalt");
  // Hinweis nach Spotify-Updates: die Laufzeit des Balkens übersteht „weniger Bewegung“ (sonst wäre er sofort weg)
  assert.ok(/setProperty\("animation-duration", .*"important"\)/.test(read("src/updnote.js")));
  // Antwortkacheln der Spiele: weiße Schrift mit mindestens 4,5 : 1 – am Handy und am großen Bild dieselben Farben
  const lum = (h) => [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
  const phone = read("docs/live/index.html");
  for (let i = 0; i < 6; i++) {
    const a = new RegExp(`\\.tile\\.t${i} \\{ background: #([0-9a-f]{6});`).exec(phone), b = new RegExp(`\\.m-g-opt\\.is-t${i} \\{\\s*background: #([0-9a-f]{6});`).exec(css);
    assert.ok(a && b, `Kachel ${i} gefunden`);
    assert.strictEqual(a[1], b[1], `Kachel ${i}: Handy und großes Bild gleich`);
    const ratio = 1.05 / (lum(a[1]) + 0.05);
    assert.ok(ratio >= 4.5, `Kachel ${i} (#${a[1]}): ${ratio.toFixed(2)} : 1`);
  }
  // Handy-Seite: Felder ab 16 px (iOS zoomt sonst hinein), Blitz höchstens alle 340 ms, „weniger Bewegung“ zählt
  assert.ok(/\.sheet \.name input \{[^}]*font-size: 16px/.test(phone) && /\.scan input \{[^}]*font-size: 16px/.test(phone));
  assert.ok(/!CALM_SYS && nowF - \(show\.flashAt \|\| -1e9\) >= 340/.test(phone));
  assert.ok(/\.sheet \{[^}]*visibility: hidden/.test(phone) && /body\.wish \.sheet \{[^}]*visibility: visible/.test(phone));

  console.log("hardening: ok (Schema-Import, Einstellungen, Reparatur-CSS, Blitz-Merker, Overlay, Stream Deck, Lampen, DTLS, Werkzeuge, Oberfläche)");
  process.exit(0);
}
