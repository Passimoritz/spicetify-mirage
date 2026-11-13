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

module.exports = { party, state, sleep, noFlashCheck };
