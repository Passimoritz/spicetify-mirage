/* ---------------------------------------------------------------- Klang-Detektoren zur Laufzeit */
// Verbindet die Detektoren (sonic.js) mit der laufenden Party: einmal je Song (nicht im Bild) werden die Quellen
// ausgewertet, je Bild nur nachgeschlagen. Ohne Spotify und Fenster – testbar (tests/unit/sonic.test.js).
// Drei Fälle, ehrlich nach Sicherheit gestuft:
//  1. Spotify-Analyse da: Effekte zeitgenau aus den Segmenten (gridFromSegs → detectFx). Liegt die Hörprobe dazu
//     sicher im Song (Lautheitsverlauf passt, r ≥ 0,75), kommen ihre Effekte zeitgenau dazu, und ihre Instrumente
//     gelten dort mit voller Stärke.
//  2. Nur Hörprobe: die Palette des Songs (welche Instrumente, welche Effekte). Instrumente erscheinen gedämpft (×0,7)
//     und nur in Teilen, in die sie passen (Gitarrenwand im lauten Teil, Klavier im ruhigen …); Effekte nur, wenn die
//     Lichtregie den Moment selbst sieht (Aufbau → Riser, Drop → Einschlag, Stopp → Tape-Stop) UND die Hörprobe
//     bestätigt, dass der Song diesen Effekt benutzt. Scratch, Sirene, Air-Horn … lassen sich so nicht zeitlich
//     setzen – dann gar nicht.
//  3. Nichts davon: nichts (die Party reagiert wie bisher).
import { THR, gridFromSegs, detectFx, createMixer, alignPreview } from "./sonic.js";

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
// neue Instrumente (zusätzlich zu den zwölf aus den Credits, instrkinds.js)
const SOUND = ["kick", "sub808", "hats", "crash", "acguitar", "pad", "bells", "organ"];
// Palette-Art → Art der Anzeige (gleiche Bilder wie bei den Credits, wo es sie schon gibt)
const SHOW = { distguitar: "guitar", piano: "piano", strings: "strings" };
// Teil des Songs → wie gut passt die Familie hinein (0..1). drums = Schlagzeug-Spuren, loud = Gitarrenwand,
// soft = Klavier/Akustikgitarre/Glocken, hold = Flächen/Streicher/Orgel
const FAM = { kick: "drums", sub808: "drums", hats: "drums", crash: "drums", guitar: "loud", piano: "soft", acguitar: "soft", bells: "soft", strings: "hold", pad: "hold", organ: "hold" };
function partGate(fam, kind, energy) {
  const k = kind || "", e = energy ?? 0.5;
  switch (fam) {
    case "drums": return k === "intro" || k === "outro" || k === "break" ? 0 : clamp((e - 0.35) / 0.2, 0, 1);
    case "loud": return clamp((e - 0.55) / 0.15, 0, 1) * (k === "break" || k === "intro" ? 0 : 1);
    case "soft": return clamp((0.75 - e) / 0.2, 0, 1) * (k === "drop" ? 0 : 1);
    case "hold": return k === "drop" ? 0.3 : clamp((0.9 - e) / 0.3, 0.35, 1);
  }
  return 0;
}

// Effekte, die die Lichtregie selbst zeitlich sieht – nur mit Bestätigung durch die Hörprobe (Fall 2)
// pv: Palette der Effekte { art: Sicherheit } · px: Zustand der Party · sec: Songzeit · st: Gedächtnis
function directorEvents(pv, px, sec, st) {
  const ok = (k) => (pv?.[k] || 0) >= THR[k];
  if (!px) return;
  const add = (k, t, dur, c) => {
    if (st.ev.some((e) => e.k === k && Math.abs(e.t - t) < 1)) return;
    st.ev.push({ k, t, dur, c });
    if (st.ev.length > 24) st.ev.shift();
  };
  // Aufbau: Riser bis zum Drop (die Regie kennt den Abstand)
  if (px.build > 0.45 && px.toDrop < 9 && px.toDrop > 0.5 && (ok("riser") || ok("sweep")) && !st.ev.some((e) => (e.k === "riser" || e.k === "sweep") && sec < e.t + e.dur)) {
    const k = (pv.sweep || 0) > (pv.riser || 0) ? "sweep" : "riser";
    add(k, sec, px.toDrop, Math.max(pv.riser || 0, pv.sweep || 0) * 0.85);
  }
  if (px.dropHit) {
    if (ok("subdrop")) add("subdrop", sec, 1.2, pv.subdrop * 0.85);
    else if (ok("impact")) add("impact", sec, 0.9, pv.impact * 0.85);
    if (ok("downlift")) add("downlift", sec + 0.3, 2, pv.downlift * 0.85);
  }
  if (px.scn?.stop > 0.5 && (ok("tapestop") || ok("stop"))) add(ok("tapestop") ? "tapestop" : "stop", sec, 1.2, Math.max(pv.tapestop || 0, pv.stop || 0) * 0.85);
}

function createSonicRuntime() {
  const mix = createMixer();
  const song = { uri: "", data: null, segEv: [], pv: null, al: null, ev: [], dirty: true, busy: false };
  const lv = Object.fromEntries([...SOUND, "guitar", "piano", "strings"].map((k) => [k, 0]));
  let lastSec = 0;
  // Fehlersuche/Bildproben (mirage:debug): eine Art von Hand auslösen – Instrument 4 s, Effekt 2,5 s
  const forced = { inst: {}, ev: [] };
  function force(k, sec) {
    // Instrumente: 4 s Uhrzeit, ein neuer Auslöser ersetzt die früheren
    if (k in lv) forced.inst = { [k]: Date.now() + 4000 };
    // ältere Auslöser (anderer Zeitpunkt) vergessen – sonst liefen sie nach dem Zurückspulen wieder mit
    else {
      // nur Auslöser desselben Augenblicks (Uhrzeit) bleiben – frühere liefen nach dem Zurückspulen sonst wieder mit
      const now = Date.now();
      forced.ev = [...forced.ev.filter((e) => now - e.at < 300), { k, t: sec, dur: k === "riser" || k === "sweep" ? 3 : 2.5, c: 1, at: now }];
    }
    mix.reset();
  }
  // Songwechsel / neue Daten: einmal auswerten (in einem eigenen Takt, nie im Bild)
  function prepare(uri, data, pv) {
    if (uri !== song.uri) {
      Object.assign(song, { uri, data: null, segEv: [], pv: null, al: null, ev: [], dirty: true });
      mix.reset();
    }
    if (pv && song.pv !== pv) [song.pv, song.dirty] = [pv, true];
    if (data !== song.data) [song.data, song.dirty] = [data, true];
    if (!song.dirty || song.busy) return;
    song.dirty = false;
    song.busy = true;
    const run = () => {
      song.busy = false;
      if (song.uri !== uri) return;
      const real = song.data && !song.data.synthetic && song.data.segs?.length > 40;
      const G = real ? gridFromSegs(song.data.segs) : null;
      song.segEv = G ? detectFx(G, { bpm: song.data.bpm || 0 }) : [];
      // Hörprobe im Song wiederfinden: nur bei deutlich passendem Lautheitsverlauf
      song.al = null;
      if (G && song.pv?.grid) {
        const a = alignPreview(G, song.pv.grid);
        if (a && a.r >= 0.75) song.al = { ...a, end: a.off + song.pv.grid.n / song.pv.grid.r };
      }
      const shifted = song.al ? (song.pv.events || []).map((e) => ({ ...e, t: e.t + song.al.off })) : [];
      song.ev = [...song.segEv, ...shifted].sort((a, b) => a.t - b.t);
    };
    // ~10–25 ms für einen ganzen Song: in einer Leerlaufpause des Browsers, nicht zwischen zwei Bildern
    if (typeof requestIdleCallback === "function") requestIdleCallback(run, { timeout: 3000 });
    else if (typeof setTimeout === "function") setTimeout(run, 0);
    else run();
  }
  // je Bild: Instrumenten-Stärken und laufende Effekte. opt: { lite, max }
  function frame(sec, dt, px, opt = {}) {
    if (Math.abs(sec - lastSec) > 1.5) {
      mix.reset();
      song.dyn = [];
    }
    lastSec = sec;
    const pal = song.pv?.inst || null, inAl = song.al && sec >= song.al.off && sec <= song.al.end;
    // gedämpft außerhalb der Hörprobe (Fall 2), voll wo die Hörprobe im Song liegt
    const trust = inAl ? 1 : 0.7;
    const ease = (k, target) => {
      lv[k] += (target - lv[k]) * (1 - Math.exp(-dt * (target > lv[k] ? 5 : 2)));
      if (lv[k] < 0.01) lv[k] = 0;
    };
    const want = {};
    if (pal && px) {
      for (const [k, c] of Object.entries(pal)) {
        if (!(c >= THR[k])) continue;
        const show = SHOW[k] || k;
        if (!(show in lv)) continue;
        want[show] = Math.max(want[show] || 0, partGate(FAM[show], px.kind, px.energy) * clamp(0.55 + (c - THR[k]) * 1.5, 0.55, 1) * trust);
      }
    }
    for (const [k, until] of Object.entries(forced.inst)) if (Date.now() < until) want[k] = 1;
    // höchstens zwei Schlagzeug-Spuren und zwei Klangfarben zugleich (Leicht: je eine) – die deutlichsten
    const cap = opt.lite ? 1 : 2;
    const top = (fams) => Object.entries(want).filter(([k]) => fams.includes(FAM[k])).sort((a, b) => b[1] - a[1]).slice(0, cap).map(([k]) => k);
    const keep = new Set([...top(["drums"]), ...top(["loud", "soft", "hold"])]);
    for (const k in lv) ease(k, keep.has(k) ? want[k] : 0);
    // Effekte: zeitgenaue (Fall 1) und von der Regie gesehene (Fall 2)
    if (!song.dyn) song.dyn = [];
    if (song.pv?.fx && !song.ev.length) {
      const st = { ev: song.dyn };
      directorEvents(song.pv.fx, px, sec, st);
    }
    let list = song.ev.length ? song.ev : song.dyn;
    if (forced.ev.length) list = [...list, ...forced.ev].sort((a, b) => a.t - b.t);
    const fx = mix.at(list, sec, { max: opt.lite ? 1 : opt.max ?? 3 });
    // Sidechain-Pumpen ohne Zeitangabe (nur Hörprobe): im Refrain und Drop, wo die Kick läuft
    const pump = song.pv?.fx?.pump || 0;
    if (!song.ev.length && pump >= THR.pump && px && (px.kind === "chorus" || px.kind === "drop") && fx.length < (opt.lite ? 1 : 3)) fx.push({ k: "pump", p: 0, e: clamp((px.energy - 0.5) / 0.2, 0, 1), c: pump, flash: false });
    return { lv, fx, src: song.ev.length ? (song.al ? "spotify+preview" : "spotify") : song.pv ? "preview" : "" };
  }
  return { prepare, frame, force, get song() { return song; } };
}

export { createSonicRuntime, partGate, directorEvents, SOUND, FAM };
