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
    const b = await ios.page.eval(`({ tick: !document.getElementById("bTick").hidden, vib: !document.getElementById("bVib").hidden, on: tickOn, pressed: document.getElementById("bTick").getAttribute("aria-pressed"), label: document.querySelector("#bTick span").textContent })`);
    if (!b.tick || b.vib) problems.push(`ohne Vibration: Klick-Knopf ${b.tick ? "da" : "fehlt"}, Vibrationsknopf ${b.vib ? "da" : "weg"}`);
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
      if (!(on > 0.45) || !(off < 0.3)) problems.push(`${label}: dran ${on?.toFixed(2)}, nicht dran ${off?.toFixed(2)} (erwartet hell / gedämpft)`);
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

module.exports = { party, state, sleep, noFlashCheck, tickCheck, waveCheck };
