// Handy-Seite mit einer gespielten Party: der Test schickt verschlüsselte Lichtzustände wie das Theme (gleicher
// Schlüssel aus dem Link) über den lokalen Relay und liest, was die Seite daraus macht. Kein Ton, kein Netz.
const crypto = require("crypto");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// wie seal() im Theme: 12 Byte IV, dann AES-GCM-Text samt Prüfsumme
function sealWith(key) {
  return (obj) => {
    const iv = crypto.randomBytes(12), c = crypto.createCipheriv("aes-128-gcm", key, iv);
    const ct = Buffer.concat([c.update(JSON.stringify(obj)), c.final(), c.getAuthTag()]);
    return Buffer.concat([iv, ct]);
  };
}
function openWith(key) {
  return (buf) => {
    try {
      const d = crypto.createDecipheriv("aes-128-gcm", key, buf.subarray(0, 12));
      d.setAuthTag(buf.subarray(buf.length - 16));
      return JSON.parse(Buffer.concat([d.update(buf.subarray(12, buf.length - 16)), d.final()]).toString());
    } catch {
      return null;
    }
  };
}

// ein Lichtzustand wie aus live.feed (nur die Felder, die die Seite braucht)
const state = (o = {}) => ({ v: 1, on: 1, s: Date.now(), bpm: 120, bi: 0, ph: 0, e: 0.5, k: 0, d: 0, b: 0, pal: [[200, 40, 90], [40, 90, 200], [90, 200, 40]], t: "Song", a: "Artist", img: "", ly: "", lyn: "", g: null, w: null, poll: null, nx: "", fx: null, ...o });

async function party(browser, env, { url, device, lang, channel, key, initScript }) {
  const topic = "mirage-live/" + channel;
  const page = await browser.open({ url, width: device.width, height: device.height, dpr: device.dpr, ua: device.ua, lang, initScript });
  const seal = sealWith(key);
  const send = (o) => env.broker.publish(topic, seal(state(o)));
  // senden wie das Theme (8× je Sekunde), bis die Seite leuchtet
  for (let i = 0; i < 60; i++) {
    send({});
    if (await page.eval(`document.body.classList.contains("on")`).catch(() => false)) break;
    await sleep(125);
  }
  // eine Weile mit diesem Zustand weitersenden
  const hold = async (o, ms) => {
    for (const t0 = Date.now(); Date.now() - t0 < ms; ) {
      send(o);
      await sleep(125);
    }
  };
  return { page, send, hold, topic, open: openWith(key) };
}

// Blitz, Schockring und lange Vibration beim Drop mitzählen (haptic ist eine globale Funktion der Seite)
const WATCH = `(() => {
  window.__w = { flash: 0, white: 0, long: 0 };
  const h0 = haptic;
  haptic = (parts) => { if (parts.some(([, ms]) => ms >= 200)) __w.long++; return h0(parts); };
  setInterval(() => {
    __w.flash = Math.max(__w.flash, show.flash);
    if (show.rings.some((g) => g.c[0] === 255 && g.c[1] === 255 && g.c[2] === 255)) __w.white++;
  }, 20);
  return 1;
})()`;

async function noFlashCheck(browser, env, o, check) {
  const p = await party(browser, env, o);
  const problems = [];
  try {
    if (!(await p.page.eval(`document.body.classList.contains("on")`))) problems.push("Seite leuchtet nicht (keine Party angekommen)");
    await p.page.eval(WATCH);
    // Wortbilder werden erst mit der Party nachgeladen
    for (let i = 0; i < 40 && !(await p.page.eval("!!wfx")); i++) await sleep(100);
    if (!(await p.page.eval("!!wfx"))) problems.push("fx.js wurde mit der Party nicht nachgeladen");
    // „Keine Blitze“ am PC: Drop kommt an (gedeckelt wie vom Theme, und ungedeckelt), aber nichts blitzt
    await p.hold({ d: 0, nf: 1 }, 400);
    await p.hold({ d: 1, nf: 1 }, 600);
    let w = await p.page.eval("__w");
    if (w.flash > 0.01 || w.white || w.long) problems.push(`nf=1: trotzdem Blitz ${w.flash.toFixed(2)}, weißer Ring ${w.white}, lange Vibration ${w.long}`);
    // älteres Theme ohne „nf“: wie bisher Blitz, Ring und Vibration
    await p.hold({ d: 0 }, 400);
    await p.hold({ d: 1 }, 400);
    w = await p.page.eval("__w");
    if (w.flash < 0.5 || !w.white || !w.long) problems.push(`ohne nf: Drop fehlt (Blitz ${w.flash.toFixed(2)}, weißer Ring ${w.white}, lange Vibration ${w.long})`);
    if (p.page.errors.length) problems.push(...p.page.errors.map((e) => "Fehler in der Konsole: " + e));
  } finally {
    await p.page.close();
  }
  check(`${o.device.name} · „Keine Blitze“ (nf): kein Blitz, kein Schockring, keine Drop-Vibration`, problems);
}

// Takt-Klick fürs iPhone: geprüft wird nur der Zeitplan, nie der Ton – clickAt wird durch einen Zähler ersetzt
// und es entsteht kein AudioContext
async function tickCheck(browser, env, o, check) {
  const problems = [];
  // ohne Vibration (wie Safari auf dem iPhone): der Knopf ist da, aber aus
  const ios = await party(browser, env, { ...o, initScript: o.initScript + "\ndelete Navigator.prototype.vibrate;" });
  try {
    const b = await ios.page.eval(`({ ac: !!(window.AudioContext || window.webkitAudioContext), tick: !document.getElementById("bTick").hidden, vib: !document.getElementById("bVib").hidden, on: tickOn, pressed: document.getElementById("bTick").getAttribute("aria-pressed"), label: document.querySelector("#bTick span").textContent })`);
    // ohne Web Audio (Playwrights WebKit unter Windows; das iPhone hat es) bleibt der Klick-Knopf zu Recht weg
    if (b.ac ? !b.tick || b.vib : b.tick || b.vib) problems.push(`ohne Vibration: Klick-Knopf ${b.tick ? "da" : "fehlt"}, Vibrationsknopf ${b.vib ? "da" : "weg"}, Web Audio ${b.ac ? "da" : "fehlt"}`);
    if (b.on || b.pressed !== "false") problems.push("der Klick ist von selbst an");
    if (!b.label) problems.push("Klick-Knopf ohne Text");
    await ios.page.eval(`(() => { window.__t = []; clickAt = (beat, inSec) => __t.push([beat, performance.now() / 1000 + inSec]); tickOn = true; return 1; })()`);
    // wie das Theme: Schlagnummer und Phase laufen mit der Zeit weiter
    for (const t0 = Date.now(); Date.now() - t0 < 2600; await sleep(125)) {
      const bp = ((Date.now() - t0) / 1000) * 2;
      ios.send({ bpm: 120, bi: Math.floor(bp), ph: +(bp % 1).toFixed(3) });
    }
    const t = await ios.page.eval("__t");
    const beats = t.map((x) => x[0]), gaps = t.slice(1).map((x, i) => x[1] - t[i][1]);
    if (t.length < 4) problems.push(`nur ${t.length} Klicks in 2,6 s bei 120 BPM`);
    if (beats.some((x, i) => i && x !== beats[i - 1] + 1)) problems.push("Schläge doppelt oder ausgelassen: " + beats.join(","));
    if (gaps.some((g) => Math.abs(g - 0.5) > 0.04)) problems.push("Abstand weicht vom Takt ab: " + gaps.map((g) => g.toFixed(3)).join(", "));
    const plan = await ios.page.eval(`[tickPlan(3.95, 120), tickPlan(3.5, 120), tickPlan(7.99, 60)]`);
    if (plan[0]?.beat !== 4 || Math.abs(plan[0].inSec - 0.025) > 1e-6 || plan[1] !== null || plan[2]?.beat !== 8) problems.push("tickPlan rechnet falsch: " + JSON.stringify(plan));
    if (ios.page.errors.length) problems.push(...ios.page.errors.map((e) => "Fehler in der Konsole: " + e));
  } finally {
    await ios.page.close();
  }
  // mit Vibration (Android) bleibt der Knopf weg
  const and = await party(browser, env, o);
  try {
    if (!(await and.page.eval(`document.getElementById("bTick").hidden`))) problems.push("mit Vibration steht trotzdem der Klick-Knopf da");
  } finally {
    await and.page.close();
  }
  check(`${o.device.name} · Takt-Klick: aus bis zum Antippen, ein Klick je Schlag im Takt (lautlos geprüft)`, problems);
}

// Schläge wie das Theme senden: Schlagnummer und Phase laufen mit der Zeit weiter
async function beats(p, ms, extra = {}, bpm = 120) {
  for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(125)) {
    const bp = ((Date.now() - t0) / 1000) * (bpm / 60);
    p.send({ bpm, bi: Math.floor(bp), ph: +(bp % 1).toFixed(3), ...extra });
  }
}
// Lichtwelle: das Handy leuchtet nur auf seinen Schlägen hell (Platz 3 von 4, Farbgruppe 2 von 3), sonst glimmt es
async function waveCheck(browser, env, o, check) {
  const problems = [];
  const SAMPLE = `(() => { window.__s = []; setInterval(() => show.beat >= 0 && __s.push([show.beat, show.wk]), 20); return 1; })()`;
  // Median der Helligkeit je Schlagart: dran / nicht dran
  const split = (s, mine) => {
    const med = (a) => (a.length ? a.sort((x, y) => x - y)[Math.floor(a.length / 2)] : NaN);
    return [med(s.filter(([b]) => mine(b)).map((x) => x[1])), med(s.filter(([b]) => !mine(b)).map((x) => x[1]))];
  };
  for (const [label, init, extra, mine] of [
    ["der Reihe nach, Platz 3 von 4", `localStorage.setItem("mlSlot", "2");`, { wv: 1, wn: 4 }, (b) => b % 4 === 2],
    ["Farbgruppen, Farbe 5 (Gruppe 2)", `localStorage.setItem("mlCol", "4");`, { wv: 2, wn: 8 }, (b) => b % 3 === 1],
  ]) {
    const p = await party(browser, env, { ...o, initScript: o.initScript + "\n" + init });
    try {
      await p.page.eval(SAMPLE);
      await beats(p, 4200, extra);
      const [on, off] = split(await p.page.eval("__s"), mine);
      // feste Grenzen, oder bei langsam zeichnenden Engines (WebKit unter Windows, ~10 Bilder/s) ein klarer Abstand
      const clear = (on > 0.45 && off < 0.3) || (on > off + 0.12 && on > off * 1.4);
      if (!clear) problems.push(`${label}: dran ${on?.toFixed(2)}, nicht dran ${off?.toFixed(2)} (erwartet hell / gedämpft)`);
      if (p.page.errors.length) problems.push(...p.page.errors.map((e) => "Fehler in der Konsole: " + e));
    } finally {
      await p.page.close();
    }
  }
  // ohne Welle (älteres Theme): alle zugleich, nichts gedämpft
  const p = await party(browser, env, o);
  try {
    await p.page.eval(SAMPLE);
    await beats(p, 1500);
    const s = await p.page.eval("__s");
    if (s.some((x) => x[1] < 0.95)) problems.push("ohne Welle ist das Licht gedämpft");
  } finally {
    await p.page.close();
  }
  check(`${o.device.name} · Lichtwelle: der Reihe nach und in Farbgruppen, ohne Welle wie bisher`, problems);
}

// Akku sparen: halbe Bildrate, Canvas in einfacher Auflösung – auf Wunsch und von selbst bei schwachem Akku;
// der Equalizer wird nur skaliert (kein Layout je Bild)
async function ecoCheck(browser, env, o, check) {
  const problems = [];
  const COUNT = `(() => { window.__d = 0; let l = lastDraw; setInterval(() => { if (lastDraw !== l) { __d++; l = lastDraw; } }, 4); return 1; })()`;
  const run = async (label, init) => {
    const p = await party(browser, env, { ...o, initScript: o.initScript + "\n" + init });
    try {
      await p.page.eval(COUNT);
      const t0 = Date.now();
      await beats(p, 2000);
      const r = await p.page.eval(`({ d: __d, w: document.getElementById("c").width, iw: innerWidth, dpr: devicePixelRatio, eq: document.querySelector(".eq i").style.transform, h: document.querySelector(".eq i").style.height, saving, gpu: !!navigator.userAgentData })`);
      r.fps = r.d / ((Date.now() - t0) / 1000);
      if (p.page.errors.length) problems.push(...p.page.errors.map((e) => label + ": Fehler in der Konsole: " + e));
      return r;
    } finally {
      await p.page.close();
    }
  };
  const normal = await run("normal", "");
  if (normal.saving || normal.w !== Math.round(normal.iw * Math.min(2, normal.dpr))) problems.push(`normal: Canvas ${normal.w} px bei ${normal.iw} px Breite, sparen=${normal.saving}`);
  if (!/^scaleY\(/.test(normal.eq) || normal.h) problems.push(`Equalizer: transform „${normal.eq}“, height „${normal.h}“`);
  const asked = await run("auf Wunsch", `localStorage.setItem("mlEco", "1");`);
  const low = await run("schwacher Akku", `navigator.getBattery = () => Promise.resolve({ level: 0.12, charging: false, addEventListener() {} });`);
  for (const [label, r] of [["auf Wunsch", asked], ["schwacher Akku", low]]) {
    if (!r.saving || r.w !== r.iw) problems.push(`${label}: Canvas ${r.w} px statt ${r.iw} px, sparen=${r.saving}`);
    if (r.fps > 34) problems.push(`${label}: ${r.fps.toFixed(0)} Bilder/s gemalt (höchstens ~30)`);
  }
  // die volle Bildrate nur dort verlangen, wo eine Grafikkarte zeichnet: WebKit unter Windows rechnet hier in Software
  // Normal muss deutlich mehr Bilder malen als Sparen – das gilt auf jedem Rechner. Die feste Grenze von 40/s nur
  // lokal mit Grafikkarte: auf GitHub zeichnet Chrome ohne GPU höchstens etwa 30/s
  const saverFps = Math.max(asked.fps, low.fps);
  if (normal.fps >= 25 && normal.fps < saverFps * 1.4) problems.push(`normal ${normal.fps.toFixed(0)} Bilder/s, Sparen ${saverFps.toFixed(0)}: kaum Unterschied`);
  if (normal.fps < 40 && normal.gpu && !process.env.CI) problems.push(`normal nur ${normal.fps.toFixed(0)} Bilder/s gemalt`);
  check(`${o.device.name} · Akku sparen: ~30 Bilder/s und einfache Auflösung (gewählt oder bei schwachem Akku), Equalizer ohne Layout`, problems);
}

// Ein Testfoto wie vom Handy: 1200×900 mit Rauschen (großes JPEG, die Qualität muss sinken), dazu ein
// EXIF-Block „um 90° drehen“ und ein Kommentar mit Fantasie-Ortsdaten – beides muss beim Senden verschwinden.
// Liegt danach als window.__photo (File) bereit. tests/e2e/run.js baut es genauso.
const MAKE_PHOTO = (w = 1200, h = 900) => `(async () => {
  const c = document.createElement("canvas");
  c.width = ${w};
  c.height = ${h};
  const x = c.getContext("2d"), g = x.createLinearGradient(0, 0, ${w}, ${h});
  g.addColorStop(0, "#ff5a6e");
  g.addColorStop(1, "#2fd0c8");
  x.fillStyle = g;
  x.fillRect(0, 0, ${w}, ${h});
  const im = x.getImageData(0, 0, ${w}, ${Math.round(h / 2)});
  for (let i = 0; i < im.data.length; i += 4) {
    const v = Math.random() * 255;
    im.data[i] = v;
    im.data[i + 1] = 255 - v;
    im.data[i + 2] = v / 2;
  }
  x.putImageData(im, 0, 0);
  x.fillStyle = "#fff";
  x.fillRect(${Math.round(w / 12)}, ${Math.round(h * 0.56)}, ${Math.round(w / 4)}, ${Math.round(h / 3)});
  const jpg = new Uint8Array(await (await new Promise((ok) => c.toBlob(ok, "image/jpeg", 0.95))).arrayBuffer());
  const seg = (m, body) => [0xff, m, (body.length + 2) >> 8, (body.length + 2) & 255, ...body];
  const tiff = [0x4d, 0x4d, 0, 0x2a, 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, 6, 0, 0, 0, 0, 0, 0];
  const exif = seg(0xe1, [...new TextEncoder().encode("Exif"), 0, 0, ...tiff]), com = seg(0xfe, [...new TextEncoder().encode("GPS-SECRET 48.137N 11.575E")]);
  window.__photo = new File([new Uint8Array([0xff, 0xd8, ...exif, ...com]), jpg.subarray(2)], "party.jpg", { type: "image/jpeg" });
  return window.__photo.size;
})()`;

// Foto-Wand: der Knopf nur mit „pw: 1“ (ältere Themes senden nichts), das Foto wird gedreht, verkleinert und
// ohne Metadaten in Stücken unter 32 KB gesendet, die Antwort des Themes erscheint im Fenster
async function photoCheck(browser, env, o, check) {
  const p = await party(browser, env, o);
  const problems = [];
  const btn = () => p.page.eval(`({ btn: !document.getElementById("bPhoto").hidden, dlg: !document.getElementById("pho").hidden })`);
  try {
    if ((await btn()).btn) problems.push("ohne „pw“ (älteres Theme) ist der Foto-Knopf da");
    await p.hold({ pw: 0 }, 400);
    if ((await btn()).btn) problems.push("mit pw: 0 ist der Foto-Knopf da");
    await p.hold({ pw: 1 }, 400);
    if (!(await btn()).btn) problems.push("mit pw: 1 fehlt der Foto-Knopf");
    await p.page.eval(`document.getElementById("bPhoto").click(); 1`);
    const dlg = await p.page.eval(`({ open: !document.getElementById("pho").hidden, hint: document.getElementById("phHint").textContent, cam: document.getElementById("phCam").getAttribute("capture"), acc: [...document.querySelectorAll("#pho input[type=file]")].map((i) => i.accept).join() })`);
    if (!dlg.open) problems.push("das Foto-Fenster geht nicht auf");
    if (!/erst nach der Freigabe/.test(dlg.hint) || !/nicht gespeichert/.test(dlg.hint)) problems.push("Datenschutz-Hinweis fehlt: " + dlg.hint);
    if (dlg.cam !== "environment" || dlg.acc !== "image/*,image/*") problems.push(`Dateiauswahl: capture=${dlg.cam}, accept=${dlg.acc}`);
    // Vorbereiten: gedreht nach EXIF, höchstens 640 px, unter 60 KB, keine Metadaten
    const size = await p.page.eval(MAKE_PHOTO());
    const r = await p.page.eval(`(async () => {
      const b = await photoPrep(window.__photo);
      if (!b) return null;
      window.__bytes = b;
      const s = new TextDecoder("latin1").decode(b), url = URL.createObjectURL(new Blob([b], { type: "image/jpeg" })), im = new Image();
      im.src = url;
      await im.decode();
      URL.revokeObjectURL(url);
      return { n: b.length, soi: b[0] === 0xff && b[1] === 0xd8, exif: s.includes("Exif"), secret: s.includes("GPS-SECRET"), w: im.naturalWidth, h: im.naturalHeight };
    })()`);
    if (!r) problems.push(`photoPrep lieferte nichts (Testfoto ${size} Bytes)`);
    else {
      if (!(size > 100000)) problems.push(`das Testfoto ist zu klein für die Prüfung: ${size} Bytes`);
      if (r.n > 60000 || !r.soi) problems.push(`Ergebnis ${r.n} Bytes, JPEG ${r.soi}`);
      if (r.exif || r.secret) problems.push("Metadaten sind noch drin");
      if (r.w !== 480 || r.h !== 640) problems.push(`nicht nach EXIF gedreht oder falsch verkleinert: ${r.w}×${r.h} statt 480×640`);
    }
    // Senden: Stücke mit Kennung, Nummer, Anzahl und Prüfsumme – abgefangen statt über den Relay
    await p.page.eval(`(() => { window.__sent = []; sendSure = (o) => (__sent.push(o), true); return 1; })()`);
    await p.page.eval(`photoPush(window.__bytes).then(() => 1)`);
    await sleep(2400);
    const sent = await p.page.eval(`(async () => {
      const l = __sent.filter((m) => m.k === "photo"), d = l.map((m) => m.d).join("");
      const b = Uint8Array.from(atob(d), (c) => c.charCodeAt(0));
      const h = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest("SHA-256", b)))).replace(/\\+/g, "-").replace(/\\//g, "_").replace(/=+$/, "");
      const wire = l.map((m) => JSON.stringify({ v: 1, id: myId, s: Date.now(), ...m }).length + 28);
      return { n: l.length, count: l[0]?.n, idx: l.map((m) => m.i).join(), same: l.every((m) => m.p === l[0].p && m.h === l[0].h), p: l[0]?.p, ok: b.length === __bytes.length && b.every((v, i) => v === __bytes[i]), hash: h === l[0]?.h, max: Math.max(...wire), bar: document.getElementById("phMsg").textContent };
    })()`);
    if (!sent.n || sent.n !== sent.count || sent.idx !== [...Array(sent.count).keys()].join() || !sent.same) problems.push("Stücke unvollständig: " + JSON.stringify(sent));
    if (!sent.ok || !sent.hash) problems.push("zusammengesetzt nicht dieselben Bytes oder falsche Prüfsumme");
    if (sent.max > 31 * 1024) problems.push(`eine Nachricht hat ${sent.max} Bytes (Grenze 32 KB)`);
    if (!/100 %/.test(sent.bar)) problems.push("kein Fortschritt: " + sent.bar);
    // Antwort des Themes an dieses Handy: wartet auf Freigabe, dann freigegeben
    const me = await p.page.eval("myId");
    const ack = (st) => env.broker.publish(`${p.topic}/r/${me}`, sealWith(o.key)({ v: 1, s: Date.now(), r: -1, res: [], pho: { p: sent.p, st } }));
    ack("wait");
    await sleep(500);
    let msg = await p.page.eval(`document.getElementById("phMsg").textContent`);
    if (msg !== "Gesendet – wartet auf Freigabe.") problems.push("nach dem Senden: " + msg);
    ack("ok");
    await sleep(500);
    msg = await p.page.eval(`document.getElementById("phMsg").textContent`);
    if (!/^Freigegeben/.test(msg)) problems.push("nach der Freigabe: " + msg);
    // gleich noch eins: das Handy bremst selbst (30 s)
    await p.page.eval(`photoGo(window.__photo).then(() => 1)`);
    msg = await p.page.eval(`document.getElementById("phMsg").textContent`);
    if (!/30 Sekunden/.test(msg)) problems.push("zweites Foto sofort: " + msg);
    // Foto-Wand wieder aus: Knopf weg, Fenster zu
    await p.hold({ pw: 0 }, 400);
    const off = await btn();
    if (off.btn || off.dlg) problems.push(`aus: Knopf ${off.btn ? "noch da" : "weg"}, Fenster ${off.dlg ? "offen" : "zu"}`);
    if (p.page.errors.length) problems.push(...p.page.errors.map((e) => "Fehler in der Konsole: " + e));
  } finally {
    await p.page.close();
  }
  check(`${o.device.name} · Foto-Wand: Knopf nur mit Freigabe am PC, Foto gedreht, klein, ohne Metadaten, in Stücken`, problems);
}

module.exports = { party, state, sleep, noFlashCheck, tickCheck, waveCheck, ecoCheck, photoCheck, MAKE_PHOTO };
