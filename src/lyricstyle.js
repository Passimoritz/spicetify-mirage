/* ---------------------------------------------------------------- Verspielter Liedtext-Stil */
// Option „Verspielter Stil“ (cfg.lyrPlayful, Standard aus): der Liedtext spielt mit dem Song. Laute, betonte Wörter
// werden größer und kräftiger, leise und gehauchte dünner und blasser; gerufene Zeilen stehen in Großbuchstaben;
// ein gehaltener Ton dehnt sein Wort, solange er klingt; Wörter landen auf dem Schlag, der Refrain wippt im Takt;
// Wortbilder bekommen eine kleine Bewegung (Feuer flackert, Regen tropft, das Herz pocht …); Hintergrundgesang steht
// klein und schräg daneben, Duett-Stimmen auf ihrer Seite.
//
// Hier steht nur die Entscheidung – einmal je Song (und noch einmal, wenn die Analyse nachkommt), nie im Bild:
// planPlayful() rechnet aus Wortzeiten, Lautheit (Spotify-Segmente: loudness_max) und Takt Klassen und CSS-Variablen,
// paintPlayful() setzt sie an die Zeilen. Bewegt wird ausschließlich per CSS (transform/opacity, Mirage/user.css);
// „Ruhig“, „Keine Blitze“, „Leicht“ und „weniger Bewegung“ regelt das Stylesheet. Testbar: tests/unit/lyricstyle.test.js.
import { planSong } from "./director.js";
import { matchAny, detectLangs } from "./words.js";
import { bgFlags } from "./lyricvoices.js";

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const median = (arr) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[s.length >> 1];
};
// letzter Index mit arr[i][key] <= at
function seek(arr, at, key) {
  let lo = 0, hi = arr.length - 1, r = -1;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    if (arr[m][key] <= at) {
      r = m;
      lo = m + 1;
    } else hi = m - 1;
  }
  return r;
}

/* ---- Lautheit eines Worts: das Lauteste der Analyse zwischen Anfang und Ende (Millisekunden) */
// segs: [{ t: Sekunden, l: dB }] wie audio.js sie ablegt. Ohne Segment im Wort zählt das, das gerade klingt.
export function wordLoud(segs, a, b) {
  if (!segs?.length || !Number.isFinite(a)) return null;
  const k0 = seek(segs, a / 1000, "t");
  let m = null;
  // Segmente, die im Wort beginnen (eins, das genau am Anfang einsetzt, gehört dazu)
  for (let k = k0 >= 0 && segs[k0].t * 1000 >= a - 20 ? k0 : k0 + 1; k < segs.length && segs[k].t * 1000 < b; k++) m = Math.max(m ?? -99, segs[k].l);
  return m ?? (k0 >= 0 ? segs[k0].l : null);
}

/* ---- Betonung je Wort */
// Buchstaben, die groß und klein kennen: nur dann sagt die Schreibweise etwas („I“ allein zählt nicht)
const CASED = /[\p{Lu}\p{Ll}]/gu;
const capsOf = (s) => {
  const all = String(s || "").match(CASED) || [];
  const up = all.filter((c) => c === c.toUpperCase() && c !== c.toLowerCase()).length;
  return { n: all.length, up };
};
const isCaps = (s) => {
  const { n, up } = capsOf(s);
  return n >= 2 && up === n;
};
// gehaucht/geflüstert: Füllsilben ohne Inhalt („mm“, „ah“, „ooh“) sind leise Ausschmückung
const BREATH = /^[(（]?(?:m+|h?m+|a+h+|o+h+|o+|u+h+|ha+|hah|shh+|sh+)[)）,.…]*$/i;

// words: [{ text, a, b, est?, bg? }] einer Zeile. o.segs/o.avg aus der Analyse (fehlen sie: nur Schreibweise und Dauer).
// → [{ e: -1..1 (leise … laut), cls: "is-p-loud" | "is-p-soft" | "", z: Größe 0.88..1.16 }]
export function emphasis(words, o = {}) {
  const W = words || [];
  if (!W.length) return [];
  const segs = o.synthetic ? null : o.segs;
  const L = W.map((w) => wordLoud(segs, w.a, w.b));
  const known = L.filter((v) => v != null);
  const lineMed = median(known), avg = Number.isFinite(o.avg) ? o.avg : lineMed;
  const timed = W.filter((w) => !w.est && w.b > w.a);
  const dMed = median(timed.map((w) => w.b - w.a)) || 1;
  const raw = W.map((w, k) => {
    let e = 0;
    if (L[k] != null) e += 0.6 * ((L[k] - lineMed) / 4) + 0.4 * ((L[k] - avg) / 6);
    // betonte Silben werden länger gesungen
    if (!w.est && w.b > w.a) e += 0.25 * clamp((w.b - w.a) / dMed - 1, -1, 1.5);
    const tx = String(w.text || "");
    if (isCaps(tx) || /!\s*[)）]?$/.test(tx)) e = Math.max(e, 0.8);
    if (w.bg || BREATH.test(tx)) e = Math.min(e, -0.6);
    return clamp(e, -1, 1);
  });
  // höchstens ein Drittel einer Zeile ist „laut“ (sonst ist nichts mehr betont) – die stärksten bleiben
  const room = Math.max(1, Math.round(W.length / 3));
  const loudest = raw.map((e, k) => [e, k]).filter(([e]) => e >= 0.45).sort((x, y) => y[0] - x[0]).slice(0, room).map(([, k]) => k);
  return raw.map((e, k) => {
    const loud = loudest.includes(k), soft = e <= -0.45;
    const z = loud ? 1 + 0.16 * e : soft ? 1 + 0.12 * e : 1;
    return { e: Math.round(e * 100) / 100, cls: loud ? "is-p-loud" : soft ? "is-p-soft" : "", z: Math.round(clamp(z, 0.88, 1.16) * 100) / 100 };
  });
}

/* ---- Gehaltene Töne: ein Wort, das viel länger klingt als die anderen der Zeile */
// → [{ held, hd: Dauer in ms }]. Geschätzte Wortzeiten (est) wissen davon nichts.
export function heldNotes(words) {
  const W = words || [];
  const dur = W.map((w) => (!w.est && w.b > w.a ? w.b - w.a : 0));
  const others = dur.filter((d) => d > 0);
  const med = median(others) || 0;
  return W.map((w, k) => {
    const d = dur[k];
    const held = d > 0 && (others.length >= 2 ? d >= Math.max(650, 2.2 * med) : d >= 1200);
    return { held, hd: held ? Math.round(d) : 0 };
  });
}

/* ---- Gerufene Zeile: Großbuchstaben im Text, „!“, oder Lautheits-Spitze des Songs */
// peak = lauteste Stelle der Zeile (dB), hi = Lautheit, ab der der Song „schreit“ (z. B. sein 92. Perzentil)
export function isShout(text, peak, hi) {
  const s = String(text || "");
  const { n, up } = capsOf(s);
  if (n >= 4 && up / n >= 0.7) return true;
  if (/!\s*[)）"”]?\s*$/.test(s) || /!!/.test(s)) return true;
  return peak != null && hi != null && peak >= hi && s.split(/\s+/).filter(Boolean).length <= 6;
}

/* ---- Teile des Songs */
// parts aus director.planSong ({ t0, t1, kind } in Sekunden) → Art an der Stelle t (ms)
export function sectionKind(parts, t) {
  if (!parts?.length) return "";
  const k = seek(parts, t / 1000 + 0.2, "t0");
  return k >= 0 ? parts[k].kind || "" : parts[0].kind || "";
}
// Art → Satz der Zeile: Strophe kompakt, Refrain groß und mittig, Bridge anders gesetzt, Rand ruhig
const SET = { chorus: "is-p-chorus", drop: "is-p-chorus", verse: "is-p-verse", pre: "is-p-verse", bridge: "is-p-bridge", intro: "is-p-calm", outro: "is-p-calm", break: "is-p-calm" };
export function sectionStyle(kind, { repeated = false } = {}) {
  // ohne Analyse: Zeilen, die sich wiederholen, sind Refrain – der Rest Strophe
  if (!kind) return repeated ? "is-p-chorus" : "is-p-verse";
  // die Regie ordnet ohne Liedtext ein; eine wiederholte Zeile mitten in Strophe/Pre ist meist die Hook
  if ((kind === "verse" || kind === "pre") && repeated) return "is-p-chorus";
  return SET[kind] || "is-p-verse";
}

/* ---- Hintergrundgesang: klein, schräg, versetzt – abwechselnd, damit nicht alles gleich kippt */
export function adlibPose(k) {
  const odd = k % 2 === 1;
  return { rot: odd ? 2.5 : -3.5, dx: odd ? 1.6 : 2.4 };
}
// Ganze Zeile Hintergrundgesang? (Wörter in Klammern, „(x2)“ und „(Chorus)“ zählen nicht)
export function isAdlib(texts) {
  const f = bgFlags(texts || []);
  return f.length > 0 && f.every(Boolean);
}

/* ---- Duett: jede Stimme ihre Seite */
export function voiceSide(who) {
  return who === "1" ? "is-p-left" : who === "2" ? "is-p-right" : who === "3" ? "is-p-left" : who === "all" ? "is-p-mid" : "";
}

/* ---- Takt */
// Wort landet auf dem Schlag: Anfang höchstens tol ms neben einem Schlag (beats: [{ t: Sekunden }])
export function onBeat(a, beats, tol = 90) {
  if (!beats?.length || !Number.isFinite(a)) return false;
  const k = seek(beats, a / 1000, "t");
  const near = [beats[k], beats[k + 1]].filter(Boolean).map((b) => Math.abs(b.t * 1000 - a));
  return near.length > 0 && Math.min(...near) <= tol;
}
// Für das Wippen per CSS-Animation: Länge eines Schlags und wie weit der jetzige schon zurückliegt.
// Einmal je Zeilenwechsel gesetzt (animation-duration/-delay) – kein Rechnen im Bild.
export function beatPhase(beats, sec) {
  if (!beats?.length) return null;
  const k = seek(beats, sec, "t");
  if (k < 0 || k + 1 >= beats.length) return null;
  const p = (beats[k + 1].t - beats[k].t) * 1000;
  if (!(p >= 250 && p <= 1500)) return null;
  return { p: Math.round(p), d: -Math.round((sec - beats[k].t) * 1000) };
}

/* ---- Wortbilder: Begriff (words.js/lexicon) → kleine Bewegung */
const CUE = {
  fire: "flicker", devil: "flicker",
  rain: "drip", tears: "drip", storm: "drip",
  heart: "pulse", love: "pulse", kiss: "pulse", heartbreak: "pulse",
  fly: "rise", bird: "rise", butterfly: "rise", angel: "rise", heaven: "rise", sky: "rise", rocket: "rise", space: "rise",
  star: "twinkle", diamond: "twinkle", gold: "twinkle", magic: "twinkle",
  cold: "shiver", snow: "shiver",
};
// Was das Wörterbuch (noch) nicht kennt: Fallen und Steigen in den häufigsten Sprachen
const EXTRA = [
  [/^(?:fall|falls|falling|fallin'?|fell|fallen|sink|sinking|drown|drowning|falle|fällt|fiel|fielen|sinke|sinken|caer|caigo|cae|caes|caída|tomber|tombe|tombé|cadere|cado|cair|caio)$/iu, "fall"],
  [/^(?:high|higher|highest|rise|rising|risin'?|hoch|höher|steigen|steig|alto|alta|arriba|haut|subir)$/iu, "rise"],
];
export const cueOf = (concept) => CUE[concept] || "";
const TOKW = /[\p{L}\p{M}'’]+/gu;

// Die eine Stelle, an der Wortbedeutung gesucht wird: nutzt die Treffer von words.js (Wörterbuch, Sprache aus dem
// Text) – verbessert jemand dort das Erkennen (Verneinung, Zusammenhang), kommt es hier von selbst an.
// → (text) => [{ at, len, cue }]
export function cueMatcher(lines, lexicon) {
  let langs = null;
  return (text) => {
    const s = String(text || "");
    const out = [];
    if (lexicon) {
      try {
        langs ??= detectLangs((lines || []).map((l) => String(l?.text || "")), lexicon);
        for (const m of matchAny(s, langs, lexicon)) if (CUE[m.c]) out.push({ at: m.at, len: m.len, cue: CUE[m.c] });
      } catch {}
    }
    for (const m of s.matchAll(TOKW)) {
      if (out.some((o) => m.index < o.at + o.len && m.index + m[0].length > o.at)) continue;
      const hit = EXTRA.find(([re]) => re.test(m[0]));
      if (hit) out.push({ at: m.index, len: m[0].length, cue: hit[1] });
    }
    return out.sort((x, y) => x.at - y.at);
  };
}

/* ---- Alles zusammen: einmal je Song */
// lines: Zeilen ({ t, text, who?, bg? }), wordLists[i]: Wörter der Zeile i ({ text, a, b, est?, bg?, el? }) oder leer,
// d: Analyse aus audio.js (oder null), o.lexicon: Wörterbuch (lexicon.js), o.parts: Teile (sonst aus planSong),
// o.match: eigener Treffer-Sucher (Tests). → je Zeile { cls: [], vars: {}, words: [{ cls: [], vars: {} }] }
const planCache = new WeakMap();
function partsOf(d) {
  if (!d?.beats?.length || d.synthetic) return { parts: null, drops: [] };
  if (planCache.has(d)) return planCache.get(d);
  let r = { parts: null, drops: [] };
  try {
    const p = planSong(d, "pop", {});
    if (p) r = { parts: p.parts, drops: p.drops || [] };
  } catch {}
  planCache.set(d, r);
  return r;
}
export function planPlayful(lines, wordLists, d, o = {}) {
  const L = lines || [];
  const real = d && !d.synthetic;
  const segs = real ? d.segs : null;
  const beats = d?.beats || null;
  const { parts, drops } = o.parts !== undefined ? { parts: o.parts, drops: o.drops || [] } : partsOf(d);
  const match = o.match || cueMatcher(L, o.lexicon);
  // Wiederholungen (Refrain ohne Analyse) – wie die Hype-Zeilen in immersive.js
  const key = (x) => String(x || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
  const seen = new Map();
  for (const l of L) if (key(l.text).length > 6) seen.set(key(l.text), (seen.get(key(l.text)) || 0) + 1);
  // Lautheits-Spitzen: ab dem 92. Perzentil der Zeilen-Spitzen „schreit“ der Song
  const peaks = L.map((l, i) => {
    const ws = wordLists?.[i];
    if (!segs?.length || !ws?.length) return null;
    return Math.max(...ws.map((w) => wordLoud(segs, w.a, w.b) ?? -99));
  });
  const known = peaks.filter((v) => v != null).sort((a, b) => a - b);
  const hi = known.length >= 8 ? Math.max(known[Math.floor(known.length * 0.92)], (d?.avg ?? -12) + 4) : null;
  // gerufene Zeilen höchstens jede achte – sonst ist es kein Rufen mehr
  const maxShout = Math.max(1, Math.round(L.length / 8));
  let shouts = 0, adl = 0;
  // erste gesungene Zeile nach jedem Drop: kurzer Auftritt
  const dropIn = new Set();
  for (const dt of drops || []) {
    const k = L.findIndex((l) => l.t >= dt * 1000 - 150 && String(l.text || "").trim() && l.text !== "♪");
    if (k >= 0 && L[k].t - dt * 1000 < 4000) dropIn.add(k);
  }
  return L.map((l, i) => {
    const cls = [], vars = {};
    const ws = wordLists?.[i] || [];
    const kind = sectionKind(parts, l.t);
    cls.push(sectionStyle(kind, { repeated: seen.get(key(l.text)) >= 2 }));
    if (dropIn.has(i)) cls.push("is-p-drop");
    const side = voiceSide(l.who);
    if (side) cls.push(side);
    const texts = ws.length ? ws.map((w) => w.text) : String(l.text || "").split(/\s+/).filter(Boolean);
    if (l.bg || (texts.length && isAdlib(texts))) {
      const p = adlibPose(adl++);
      cls.push("is-p-adlib");
      vars["--pr"] = p.rot + "deg";
      vars["--px"] = p.dx + "em";
    } else if (ws.some((w) => w.bg)) {
      // Hintergrund mitten in der Zeile: nur die Neigung (die Wörter selbst tragen .is-bg)
      vars["--pr"] = adlibPose(adl++).rot + "deg";
    }
    if (shouts < maxShout && !l.bg && isShout(l.text, peaks[i], hi)) {
      cls.push("is-p-shout");
      shouts++;
    }
    if (!ws.length) return { cls, vars, words: [] };
    const em = emphasis(ws, { segs, avg: d?.avg, synthetic: !real });
    const hold = heldNotes(ws);
    // Wortbilder: die Zeile als Text, Treffer auf die Wörter zurückgelegt; höchstens zwei je Zeile
    const starts = [];
    let joined = "";
    for (const w of ws) {
      starts.push(joined.length);
      joined += String(w.text || "") + " ";
    }
    const cues = new Map();
    for (const m of match(joined)) {
      if (cues.size >= 2) break;
      // Wortgruppen („on fire“, „broken heart“) bewegen ihr letztes Wort – das trägt die Bedeutung
      const k = seek(starts.map((at) => ({ at })), m.at + m.len - 1, "at");
      if (k >= 0 && !cues.has(k) && !ws[k].bg) cues.set(k, m.cue);
    }
    const words = ws.map((w, k) => {
      const wc = [], wv = {};
      if (em[k].cls) wc.push(em[k].cls);
      if (em[k].z !== 1) wv["--pz"] = String(em[k].z);
      if (hold[k].held) {
        wc.push("is-p-held");
        wv["--hd"] = hold[k].hd + "ms";
      }
      if (beats && real && !w.est && onBeat(w.a, beats)) wc.push("is-p-beat");
      const c = cues.get(k);
      if (c) wc.push("is-p-cue", "is-p-" + c);
      return { cls: wc, vars: wv };
    });
    return { cls, vars, words };
  });
}

/* ---- An die Zeilen setzen (DOM) – nur beim Aufbau und wenn die Analyse nachkommt */
const PVARS = ["--pr", "--px", "--pz", "--hd"];
function strip(el) {
  if (!el) return;
  for (const c of [...el.classList]) if (c.startsWith("is-p-")) el.classList.remove(c);
  for (const v of PVARS) el.style.removeProperty(v);
}
// lineEls: die Zeilen-Elemente (gleiche Reihenfolge wie lines), wordLists[i][k].el: das Wort-Element.
// plan = null: alles wieder entfernen (Option aus)
export function paintPlayful(lineEls, plan, wordLists) {
  const n = lineEls?.length || 0;
  for (let i = 0; i < n; i++) {
    const el = lineEls[i], p = plan?.[i];
    strip(el);
    const ws = wordLists?.[i] || [];
    ws.forEach((w) => strip(w.el));
    if (!p) continue;
    if (p.cls.length) el.classList.add(...p.cls);
    for (const [k, v] of Object.entries(p.vars)) el.style.setProperty(k, v);
    p.words.forEach((pw, k) => {
      const wel = ws[k]?.el;
      if (!wel) return;
      if (pw.cls.length) wel.classList.add(...pw.cls);
      for (const [kk, v] of Object.entries(pw.vars)) wel.style.setProperty(kk, v);
    });
  }
}
