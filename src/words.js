/* ---------------------------------------------------------------- Wortbilder (Party-Modus) */
// Singt jemand „fire“, „Regen“, „corazón“, „星“ oder „pyaar“, antwortet die Bühne mit einem passenden Bild:
// Flammen, Regen, Herzen, Sterne … Das Wörterbuch (lexicon.js) kennt rund 65 Begriffe in 45 Sprachen mit
// ihren gängigen Formen. Die Sprache des Songs wird aus häufigen Füllwörtern und der Schrift erkannt –
// verglichen wird nur mit diesen Sprachen (plus Englisch, das fast überall vorkommt). Für Sprachen ohne
// eigenes Wörterbuch hilft auf Wunsch die englische Übersetzung des Liedtexts.
// Nicht überladen: höchstens ein Bild pro Zeile, Pausen zwischen den Bildern (kürzer bei höherer Stärke),
// dasselbe Bild erst nach einer Weile wieder, nie mehr als zwei gleichzeitig.
let LEX = {};

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(a, 0, 1).toFixed(3)})`;
const mixW = (c, f) => c.map((v) => v + (255 - v) * f);

// Schriften ohne Leerzeichen zwischen Wörtern (und Koreanisch mit angehängten Partikeln): Teilstring-Suche
const NOSPACE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}\p{Script=Hangul}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}]/u;
const TOKEN = /[\p{L}\p{M}\p{N}'’]+/gu;
// Akzente weg (für Texte, die ohne geschrieben wurden) – nicht bei Vietnamesisch, dort tragen sie die Bedeutung
const strip = (s) => s.normalize("NFD").replace(/\p{M}/gu, "").normalize("NFC");
const low = (s) => String(s || "").normalize("NFC").toLocaleLowerCase();

// Schrift → Sprachen, die sie benutzen
const SCRIPTS = [
  [/\p{Script=Hangul}/u, ["ko"]],
  [/[\p{Script=Hiragana}\p{Script=Katakana}]/u, ["ja"]],
  [/\p{Script=Han}/u, ["zh", "ja"]],
  [/\p{Script=Thai}/u, ["th"]],
  [/\p{Script=Hebrew}/u, ["he"]],
  [/\p{Script=Arabic}/u, ["ar", "fa", "ur"]],
  [/\p{Script=Devanagari}/u, ["hi"]],
  [/\p{Script=Bengali}/u, ["bn"]],
  [/\p{Script=Tamil}/u, ["ta"]],
  [/\p{Script=Gurmukhi}/u, ["pa"]],
  [/\p{Script=Greek}/u, ["el"]],
  [/\p{Script=Cyrillic}/u, ["ru", "uk", "bg", "sr"]],
];

/* ---- Begriff → Bild. pri: wichtiger gewinnt, wenn eine Zeile mehrere Treffer hat (Farben zuletzt) */
const FX = {
  fire: { fx: "flames", pri: 5 }, rain: { fx: "rain", pri: 5 }, storm: { fx: "storm", pri: 6 }, lightning: { fx: "lightning", pri: 6 },
  snow: { fx: "snow", pri: 5 }, cold: { fx: "frost", pri: 4 }, sun: { fx: "sun", pri: 4 }, summer: { fx: "sun", pri: 3 },
  moon: { fx: "moon", pri: 4 }, star: { fx: "stars", pri: 4 }, sky: { fx: "rays", pri: 2 }, heaven: { fx: "heaven", pri: 4 },
  night: { fx: "night", pri: 2 }, dark: { fx: "dark", pri: 2 }, light: { fx: "bloom", pri: 2 }, heart: { fx: "hearts", pri: 4 },
  love: { fx: "love", pri: 2 }, kiss: { fx: "kiss", pri: 4 }, heartbreak: { fx: "heartbreak", pri: 6 }, tears: { fx: "tears", pri: 4 },
  money: { fx: "money", pri: 5 }, gold: { fx: "gold", pri: 3 }, diamond: { fx: "diamond", pri: 4 }, crown: { fx: "crown", pri: 5 },
  fly: { fx: "birds", pri: 3 }, bird: { fx: "birds", pri: 4 }, butterfly: { fx: "butterflies", pri: 5 }, flower: { fx: "petals", pri: 4 },
  rose: { fx: "roses", pri: 4 }, ocean: { fx: "wave", pri: 4 }, water: { fx: "bubbles", pri: 3 }, wind: { fx: "wind", pri: 3 },
  smoke: { fx: "smoke", pri: 4 }, electric: { fx: "sparks", pri: 4 }, rainbow: { fx: "rainbow", pri: 5 }, fireworks: { fx: "fireworks", pri: 6 },
  party: { fx: "confetti", pri: 3 }, birthday: { fx: "balloons", pri: 6 }, dance: { fx: "rings", pri: 2 }, jump: { fx: "jump", pri: 3 },
  dream: { fx: "bokeh", pri: 2 }, ghost: { fx: "ghosts", pri: 5 }, angel: { fx: "feathers", pri: 5 }, devil: { fx: "hellfire", pri: 5 },
  world: { fx: "orbit", pri: 3 }, space: { fx: "galaxy", pri: 4 }, rocket: { fx: "rocket", pri: 5 }, time: { fx: "clock", pri: 2 },
  drive: { fx: "speed", pri: 3 }, city: { fx: "city", pri: 3 }, music: { fx: "notes", pri: 2 }, sing: { fx: "notes", pri: 2 },
  boom: { fx: "boom", pri: 5 }, champagne: { fx: "champagne", pri: 4 }, magic: { fx: "magic", pri: 4 }, beach: { fx: "beach", pri: 4 },
  christmas: { fx: "christmas", pri: 6 },
  red: { fx: "tint", col: [255, 40, 60], pri: 1 }, blue: { fx: "tint", col: [40, 110, 255], pri: 1 }, green: { fx: "tint", col: [40, 220, 110], pri: 1 },
  pink: { fx: "tint", col: [255, 90, 190], pri: 1 }, purple: { fx: "tint", col: [160, 70, 255], pri: 1 }, white: { fx: "tint", col: [255, 255, 255], pri: 1 },
  black: { fx: "dark", pri: 1 }, silver: { fx: "diamond", pri: 1 },
};
// Farbe, in der das gesungene Wort aufleuchtet
const GLOW = {
  flames: [255, 140, 40], hellfire: [255, 50, 30], rain: [120, 180, 255], storm: [170, 190, 255], lightning: [220, 230, 255], snow: [220, 240, 255],
  frost: [160, 220, 255], sun: [255, 210, 90], moon: [230, 230, 255], stars: [255, 240, 180], hearts: [255, 80, 130], love: [255, 110, 160],
  kiss: [255, 90, 170], heartbreak: [255, 60, 90], tears: [140, 200, 255], money: [120, 230, 120], gold: [255, 200, 60], diamond: [180, 240, 255],
  crown: [255, 205, 70], petals: [255, 150, 200], roses: [255, 50, 80], wave: [60, 170, 255], bubbles: [140, 220, 255], fireworks: [255, 220, 120],
  balloons: [255, 120, 180], rainbow: [255, 200, 120], christmas: [255, 70, 70], champagne: [255, 225, 140], magic: [200, 150, 255],
};

/* ---- Wörterbuch einmal aufbereiten */
let IDX = null;
function build() {
  IDX = {};
  for (const [lang, d] of Object.entries(LEX)) {
    const ix = { exact: new Map(), phrase: new Map(), pre: [], sub: [], stop: new Set() };
    for (const w of String(d.stop || "").split("|")) if (w.trim()) ix.stop.add(low(w.trim()));
    for (const [c, forms] of Object.entries(d.c || {})) {
      if (!FX[c]) continue;
      for (let f of String(forms).split("|")) {
        f = low(f.trim());
        if (!f) continue;
        const vars = lang === "vi" ? [f] : [...new Set([f, strip(f)])];
        for (const v of vars) {
          if (NOSPACE.test(v)) ix.sub.push([v, c]);
          else if (v.endsWith("*")) v.length >= 5 && ix.pre.push([v.slice(0, -1), c]);
          else if (v.includes(" ")) ix.phrase.set(v, c);
          else ix.exact.set(v, c);
        }
      }
    }
    // längere Teilstrings zuerst („黄金“ vor „金“)
    ix.sub.sort((a, b) => b[0].length - a[0].length);
    ix.pre.sort((a, b) => b[0].length - a[0].length);
    IDX[lang] = ix;
  }
  // Füllwörter, die mehrere Sprachen teilen („a“, „i“, „la“ …), verraten die Sprache nicht: nur eindeutige zählen
  const uses = new Map();
  for (const ix of Object.values(IDX)) for (const w of ix.stop) uses.set(w, (uses.get(w) || 0) + 1);
  for (const [lang, ix] of Object.entries(IDX)) {
    for (const w of [...ix.stop]) if ([...w].length < 2 || uses.get(w) > 1 || (lang !== "en" && IDX.en?.stop.has(w))) ix.stop.delete(w);
  }
  return IDX;
}

// Welche Wörterbücher passen zu diesem Liedtext? Schrift + häufige Füllwörter, Englisch immer dabei
function detect(lines, hint) {
  const text = lines.map((l) => l.text).join("\n");
  const langs = new Set(["en"]);
  const hits = {};
  for (const m of text.matchAll(TOKEN)) {
    const tk = low(m[0]);
    for (const [lang, ix] of Object.entries(IDX)) if (ix.stop.has(tk)) hits[lang] = (hits[lang] || 0) + 1;
  }
  // Schrift: alle Sprachen, die sie benutzen – außer die Füllwörter zeigen klar, welche es ist
  for (const [re, ls] of SCRIPTS) {
    if (!re.test(text)) continue;
    const best = Math.max(0, ...ls.map((l) => hits[l] || 0));
    ls.filter((l) => best < 3 || (hits[l] || 0) >= best * 0.45).forEach((l) => langs.add(l));
  }
  const h = String(hint || "").slice(0, 2).toLowerCase();
  if (IDX[h]) langs.add(h);
  const ranked = Object.entries(hits).sort((a, b) => b[1] - a[1]);
  const top = ranked[0]?.[1] || 0;
  for (const [lang, n] of ranked.slice(0, 3)) if (n >= 3 && n >= top * 0.45) langs.add(lang);
  return { langs: [...langs].filter((l) => IDX[l]), sure: top >= 4 || langs.size > 1 };
}

// Treffer einer Zeile: [{ c, at (Zeichenstelle), len, raw }]
function matchLine(text, langs) {
  if (!IDX) build();
  const out = [];
  const lowText = low(text);
  const toks = [];
  for (const m of String(text).matchAll(TOKEN)) toks.push({ at: m.index, raw: m[0], w: low(m[0]) });
  for (const lang of langs) {
    const ix = IDX[lang];
    if (!ix) continue;
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      // Wortgruppen („broken heart“, „cœur brisé“) vor Einzelwörtern
      for (const n of [3, 2]) {
        if (i + n > toks.length) continue;
        const ph = toks.slice(i, i + n).map((x) => x.w).join(" ");
        const c = ix.phrase.get(ph) || (lang !== "vi" && ix.phrase.get(strip(ph)));
        const end = toks[i + n - 1].at + toks[i + n - 1].raw.length;
        if (c) out.push({ c, at: t.at, len: end - t.at, raw: text.slice(t.at, end) });
      }
      let c = ix.exact.get(t.w) || (lang !== "vi" && ix.exact.get(strip(t.w)));
      if (!c && t.w.length >= 5) {
        const sw = lang === "vi" ? t.w : strip(t.w);
        c = ix.pre.find(([p]) => t.w.startsWith(p) || sw.startsWith(p))?.[1];
      }
      if (c) out.push({ c, at: t.at, len: t.raw.length, raw: t.raw });
    }
    if (ix.sub.length && NOSPACE.test(lowText)) {
      const taken = [];
      for (const [s, c] of ix.sub) {
        let k = lowText.indexOf(s);
        while (k >= 0) {
          if (!taken.some(([a, b]) => k < b && k + s.length > a)) {
            taken.push([k, k + s.length]);
            out.push({ c, at: k, len: s.length, raw: text.slice(k, k + s.length) });
          }
          k = lowText.indexOf(s, k + s.length);
        }
      }
    }
  }
  return out;
}

/* ---------------------------------------------------------------- Zeichnen */
function heartPath(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.35);
  ctx.bezierCurveTo(x - s * 1.1, y - s * 0.35, x - s * 0.5, y - s * 1.05, x, y - s * 0.45);
  ctx.bezierCurveTo(x + s * 0.5, y - s * 1.05, x + s * 1.1, y - s * 0.35, x, y + s * 0.35);
  ctx.closePath();
}
function starPath(ctx, x, y, r, pts = 5, inner = 0.45) {
  ctx.beginPath();
  for (let i = 0; i < pts * 2; i++) {
    const a = (i * Math.PI) / pts - Math.PI / 2, rr = i % 2 ? r * inner : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}

function createWordFx(lexicon, { onFire } = {}) {
  if (lexicon && lexicon !== LEX) {
    LEX = lexicon;
    IDX = null;
  }
  let off = null;
  let plan = [], queue = [], fxs = [], parts = [], lastFire = -1e9, langs = ["en"], sureLang = true, uriNow = "", st0 = {};
  const cool = new Map();
  let glowSpr = null;
  // weicher Lichtpunkt, einmal gerendert
  function glow() {
    if (glowSpr) return glowSpr;
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const x = c.getContext("2d"), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.35, "rgba(255,255,255,0.35)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    return (glowSpr = c);
  }

  /* ---- je Song: Sprachen erkennen, alle Zeilen einmal durchsuchen */
  function prepare(uri, lines, hint) {
    if (!IDX) build();
    uriNow = uri;
    queue = [];
    plan = [];
    if (!lines?.length) return;
    const d = detect(lines, hint);
    langs = d.langs;
    sureLang = d.sure;
    plan = lines.map((l) => pick(matchLine(l.text || "", langs)));
  }
  // Sprache ohne eigenes Wörterbuch: die englische Übersetzung durchsuchen (Bild dann zur Zeilenmitte)
  function addTranslated(uri, translated) {
    if (uri !== uriNow || !translated?.length) return;
    translated.forEach((tr, i) => {
      if (plan[i] || !tr) return;
      const m = pick(matchLine(tr, ["en"]));
      if (m) plan[i] = { ...m, at: -1, raw: "" };
    });
  }
  const needsTranslation = () => !sureLang;
  // höchstens ein Bild je Zeile: das wichtigste, bei Gleichstand das frühere
  function pick(ms) {
    if (!ms.length) return null;
    ms.sort((a, b) => FX[b.c].pri - FX[a.c].pri || a.at - b.at);
    return ms[0];
  }

  /* ---- Zeile i wird aktiv: Bild auf das Wort legen (Wortzeiten aus dem Liedtext) */
  function onLine(i, wt, lineStart, lineEnd, lineEl) {
    const m = plan[i];
    if (!m) return;
    let at = lineStart + (lineEnd - lineStart) * 0.3;
    if (m.at >= 0 && wt?.length) {
      // Zeichenstelle → Wort → Zeit (innerhalb des Worts anteilig, für Schriften ohne Leerzeichen)
      let pos = 0;
      const text = wt.map((w) => w.text).join(" ");
      for (const w of wt) {
        const st = text.indexOf(w.text, pos);
        pos = st + w.text.length;
        if (m.at < pos) {
          at = w.a + (w.b - w.a) * clamp((m.at - st) / Math.max(1, w.text.length), 0, 1);
          break;
        }
      }
    }
    queue.push({ at, m, lineEl, line: i });
  }

  // Abstand zwischen Bildern je Stärke (0 sanft … 4 Wahnsinn)
  const GAP = [9000, 6500, 4500, 3200, 2400];
  function tryFire(item, now, st) {
    const spec = FX[item.m.c];
    const key = spec.fx + (spec.col ? spec.col.join() : "");
    const gap = GAP[clamp(st.level | 0, 0, 4)];
    if (now - lastFire < gap) return false;
    if (now - (cool.get(key) || -1e9) < (spec.pri <= 1 ? 25000 : 30000)) return false;
    if (fxs.length >= 2) return false;
    lastFire = now;
    cool.set(key, now);
    start(spec, st);
    highlight(item, spec);
    onFire?.(item.m.c, item.m.raw || "");
    return true;
  }
  // Bild direkt starten (die TV-Ansicht bekommt den Begriff vom PC, ohne eigenes Wörterbuch)
  function fire(c, st) {
    if (!FX[c] || fxs.length >= 3) return;
    st0 = st;
    start(FX[c], st);
  }
  // das gesungene Wort leuchtet kurz in der Farbe des Bilds
  function highlight(item, spec) {
    const el = item.lineEl, raw = item.m.raw;
    if (!el?.isConnected || !raw) return;
    const col = spec.col || GLOW[spec.fx] || st0.pal?.[0] || [255, 255, 255];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let off = 0, node;
    while ((node = walker.nextNode())) {
      if (node.parentElement?.closest(".m-im-tr, .m-im-rom")) continue;
      const len = node.data.length;
      if (item.m.at < off + len) {
        const local = node.data.toLocaleLowerCase().indexOf(raw.toLocaleLowerCase(), Math.max(0, item.m.at - off - 2));
        const host = node.parentElement;
        if (host?.classList.contains("m-w")) {
          host.style.setProperty("--fxc", col.join(","));
          host.classList.remove("m-wfx");
          void host.offsetWidth;
          host.classList.add("m-wfx");
        } else if (local >= 0) {
          const r = document.createRange();
          r.setStart(node, local);
          r.setEnd(node, Math.min(len, local + raw.length));
          const s = document.createElement("span");
          s.className = "m-wfx";
          s.style.setProperty("--fxc", col.join(","));
          try {
            r.surroundContents(s);
          } catch {}
        }
        return;
      }
      off += len;
    }
  }

  /* ---- Bild starten: Partikel und/oder Bildschirm-Effekt */
  function add(n, f) {
    const room = 220 - parts.length;
    for (let i = 0; i < Math.min(n, room); i++) parts.push(f(i));
  }
  function start(spec, st) {
    const { w, h, cx, cy, R, dpr } = st;
    const pal = st.pal || [[255, 255, 255], [200, 200, 255], [255, 200, 255]];
    const k = (0.7 + 0.15 * clamp(st.level, 0, 4)) * 0.55; // dezent: wenige Partikel, bei höherer Stärke etwas mehr
    const S = dpr || 1, T = 3.4;
    const pickCol = (col) => (Array.isArray(col) ? col : col());
    const fall = (kind, n, col, o = {}) => add(Math.round(n * k), () => ({ kind, x: rnd(0, w), y: rnd(-h * 0.3, -10), vx: rnd(-20, 20) * S, vy: rnd(60, 140) * S * (o.sp || 1), rot: rnd(0, 6.3), vr: rnd(-2, 2), s: rnd(6, 13) * S * (o.sz || 1), life: 0, max: rnd(T, T + 1.5), col: pickCol(col) }));
    const rise = (kind, n, col, o = {}) => add(Math.round(n * k), () => ({ kind, x: o.fromCover ? cx + rnd(-R, R) : rnd(0, w), y: o.fromCover ? cy + rnd(-R * 0.4, R * 0.4) : h + rnd(10, h * 0.2), vx: rnd(-25, 25) * S, vy: -rnd(50, 130) * S * (o.sp || 1), rot: rnd(-0.4, 0.4), vr: rnd(-1, 1), s: rnd(7, 15) * S * (o.sz || 1), life: 0, max: rnd(T - 0.6, T + 1), col: pickCol(col) }));
    const burst = (kind, n, col, o = {}) => add(Math.round(n * k), () => {
      const a = rnd(0, Math.PI * 2), v = rnd(120, 420) * S * (o.sp || 1);
      return { kind, x: cx + Math.cos(a) * R * 0.9, y: cy + Math.sin(a) * R * 0.9, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 1.6, rot: a, vr: rnd(-2, 2), s: rnd(5, 11) * S * (o.sz || 1), life: 0, max: rnd(1.6, 2.6), col: pickCol(col) };
    });
    const palC = () => pal[(Math.random() * 3) | 0];
    const fx = { name: spec.fx, t: 0, max: T + 0.6, col: spec.col, seed: Math.random() };
    switch (spec.fx) {
      case "flames": case "hellfire":
        fx.max = 3.6;
        rise("ember", 60, () => (spec.fx === "hellfire" ? [255, rnd(30, 90), 20] : [255, rnd(120, 200), rnd(20, 60)]), { sz: 0.5, sp: 1.1, fromCover: true });
        break;
      case "rain": case "storm":
        add(Math.round(140 * k), () => ({ kind: "streak", x: rnd(-w * 0.1, w * 1.1), y: rnd(-h, 0), vx: -40 * S, vy: rnd(900, 1300) * S, s: rnd(14, 26) * S, life: 0, max: rnd(2.6, 3.6), col: [170, 200, 255] }));
        if (spec.fx === "storm") fx.bolts = [0.2, 1.4];
        break;
      case "lightning": fx.bolts = [0, 0.35]; fx.max = 1.6; break;
      case "snow": case "christmas":
        fall("flake", 70, [235, 245, 255], { sp: 0.45 });
        if (spec.fx === "christmas") burst("glint", 18, [255, 210, 110]);
        break;
      case "frost": fall("flake", 26, [210, 235, 255], { sp: 0.4, sz: 0.8 }); break;
      case "sun": case "beach": fx.max = 4; if (spec.fx === "beach") fx.wave = true; break;
      case "moon": fx.max = 4.5; break;
      case "stars": burst("star", 34, () => mixW(palC(), 0.6), { sp: 0.8 }); break;
      case "rays": fx.max = 4; break;
      case "heaven": fx.max = 4; fall("feather", 12, [255, 255, 255], { sp: 0.25, sz: 1.6 }); break;
      case "feathers": fx.rays = true; fall("feather", 18, [255, 250, 240], { sp: 0.25, sz: 1.6 }); break;
      case "night": case "dark": fx.max = 3.6; break;
      case "bloom": fx.max = 1.8; break;
      case "hearts": rise("heart", 26, () => [255, rnd(50, 110), rnd(110, 160)], { fromCover: true, sz: 1.3 }); break;
      case "love": rise("heart", 14, () => mixW([255, 90, 150], rnd(0, 0.4)), { fromCover: true, sz: 1.1, sp: 0.7 }); break;
      case "kiss": burst("heart", 20, () => [255, rnd(80, 140), rnd(170, 220)], { sz: 0.9, sp: 0.6 }); break;
      case "heartbreak": fx.max = 2.6; break;
      case "tears": fall("drop", 22, [150, 205, 255], { sp: 1.6, sz: 0.9 }); break;
      case "money":
        fall("bill", 34, [110, 200, 120], { sp: 0.6, sz: 1.5 });
        fall("coin", 20, [255, 205, 70], { sp: 1.1 });
        break;
      case "gold": burst("glint", 30, [255, 205, 80]); fx.col = [255, 190, 60]; fx.tintA = 0.06; break;
      case "diamond": burst("glint", 32, () => mixW([150, 230, 255], rnd(0.2, 0.8))); break;
      case "crown": fx.max = 3.4; burst("glint", 14, [255, 210, 90], { sp: 0.5 }); break;
      case "birds": add(Math.round(9 * k), (i) => ({ kind: "bird", x: -rnd(20, 300) * S, y: h * rnd(0.12, 0.42), vx: rnd(220, 320) * S, vy: rnd(-20, 10) * S, s: rnd(9, 15) * S, life: 0, max: 5, col: [255, 255, 255], ph: i })); fx.max = 5; break;
      case "butterflies": add(Math.round(12 * k), () => ({ kind: "fly", x: cx + rnd(-R, R), y: cy + rnd(-R * 0.3, R * 0.3), vx: rnd(-90, 90) * S, vy: -rnd(40, 110) * S, s: rnd(9, 15) * S, life: 0, max: rnd(3.5, 4.8), col: palC(), ph: rnd(0, 6) })); fx.max = 4.8; break;
      case "petals": fall("petal", 50, () => mixW(palC(), rnd(0.2, 0.5)), { sp: 0.45 }); break;
      case "roses": fall("petal", 50, () => [rnd(190, 255), rnd(20, 60), rnd(50, 90)], { sp: 0.45 }); break;
      case "wave": fx.max = 4; break;
      case "bubbles": rise("bubble", 44, [190, 230, 255], { sp: 0.7 }); break;
      case "champagne": rise("bubble", 50, [255, 225, 140], { sp: 0.9, sz: 0.6 }); break;
      case "wind": add(Math.round(40 * k), () => ({ kind: "gust", x: -rnd(0, w * 0.6), y: rnd(h * 0.1, h * 0.9), vx: rnd(700, 1100) * S, vy: rnd(-30, 30) * S, s: rnd(60, 160) * S, life: 0, max: 2.4, col: [255, 255, 255] })); fx.max = 2.6; break;
      case "smoke": rise("puff", 26, [210, 210, 230], { sp: 0.35, sz: 4 }); fx.max = 4.4; break;
      case "sparks": burst("spark", 60, () => mixW([120, 200, 255], rnd(0, 0.7)), { sp: 1.4 }); fx.flicker = true; fx.max = 1.8; break;
      case "rainbow": fx.max = 4.5; break;
      case "fireworks": fx.rockets = [0, 0.45, 0.9, 1.4].map((d) => ({ d, x: w * rnd(0.15, 0.85), y: h * rnd(0.12, 0.38), done: false })); fx.max = 3.6; break;
      case "confetti": add(Math.round(90 * k), () => ({ kind: "conf", x: rnd(0, w), y: rnd(-h * 0.4, -10), vx: rnd(-60, 60) * S, vy: rnd(120, 220) * S, rot: rnd(0, 6), vr: rnd(-8, 8), s: rnd(5, 9) * S, life: 0, max: rnd(3, 4.2), col: Math.random() < 0.5 ? palC() : [rnd(120, 255), rnd(120, 255), rnd(120, 255)] })); break;
      case "balloons": add(Math.round(14 * k), () => ({ kind: "balloon", x: rnd(w * 0.05, w * 0.95), y: h + rnd(20, 200) * S, vx: rnd(-15, 15) * S, vy: -rnd(110, 170) * S, s: rnd(18, 28) * S, life: 0, max: 6, col: [rnd(120, 255), rnd(60, 220), rnd(80, 255)], ph: rnd(0, 6) })); fx.max = 6; break;
      case "rings": case "jump": fx.rings = []; fx.max = spec.fx === "jump" ? 2.6 : 3.4; break;
      case "bokeh": case "city": add(Math.round(26 * k), () => ({ kind: "bokeh", x: rnd(0, w), y: rnd(h * 0.1, h * 0.9), vx: rnd(-14, 14) * S, vy: rnd(-12, 6) * S, s: rnd(20, 60) * S, life: 0, max: rnd(3.5, 4.5), col: spec.fx === "city" ? [rnd(200, 255), rnd(140, 220), rnd(60, 160)] : mixW(palC(), 0.3) })); fx.max = 4.5; break;
      case "ghosts": add(Math.round(6 * k), () => ({ kind: "ghost", x: rnd(w * 0.1, w * 0.9), y: h * rnd(0.55, 0.95), vx: rnd(-20, 20) * S, vy: -rnd(40, 80) * S, s: rnd(26, 40) * S, life: 0, max: 4.2, col: [220, 230, 255], ph: rnd(0, 6) })); fx.max = 4.2; break;
      case "orbit": case "galaxy": fx.max = 4.2; if (spec.fx === "galaxy") add(Math.round(70 * k), () => ({ kind: "orb", a: rnd(0, 6.3), r: rnd(R * 1.2, R * 3.2), sp: rnd(0.3, 0.9), x: 0, y: 0, s: rnd(1.5, 3.5) * S, life: 0, max: 4.2, col: mixW(palC(), rnd(0.3, 0.8)) })); break;
      case "rocket": fx.max = 2.8; add(Math.round(30 * k), () => ({ kind: "streak", x: rnd(0, w), y: h + rnd(0, h * 0.5), vx: 0, vy: -rnd(900, 1500) * S, s: rnd(30, 70) * S, life: 0, max: 2.2, col: mixW(palC(), 0.5) })); break;
      case "clock": fx.max = 3.6; break;
      case "speed": fx.max = 2.6; break;
      case "notes": rise("note", 22, () => mixW(palC(), 0.4), { fromCover: true, sz: 1.4, sp: 0.6 }); break;
      case "boom": fx.max = 1.6; burst("spark", 40, [255, 220, 160], { sp: 1.6 }); break;
      case "magic": add(Math.round(46 * k), (i) => ({ kind: "orb", a: (i / 46) * 6.28, r: R * 1.15, sp: 1.4, grow: R * 0.9, x: 0, y: 0, s: rnd(2, 4) * S, life: 0, max: 3, col: mixW([200, 150, 255], rnd(0.2, 0.8)) })); burst("glint", 16, [230, 200, 255], { sp: 0.6 }); fx.max = 3; break;
      case "tint": fx.max = 3.2; fx.tintA = 0.08; break;
    }
    fxs.push(fx);
  }

  /* ---- ein Bild zeichnen; true = es war etwas zu sehen */
  function draw(ctx, st) {
    st0 = st;
    const now = st.now;
    // fällige Wörter auslösen (zurückgespult oder weit voraus: verwerfen)
    if (queue.length) {
      queue = queue.filter((q) => {
        if (st.pos < q.at) return st.pos > q.at - 20000;
        if (st.pos - q.at < 1500 && st.playing) tryFire(q, now, st);
        return false;
      });
    }
    if (!fxs.length && !parts.length) return false;
    const dt = clamp(st.dt || 0.016, 0, 0.12), { w, h, cx, cy, dpr } = st, S = dpr || 1;
    const main = ctx;
    // eigene Ebene: die Bilder bleiben dezent und lassen das Publikum frei (unten weich ausgeblendet)
    off ||= document.createElement("canvas");
    if (off.width !== w || off.height !== h) {
      off.width = w;
      off.height = h;
    }
    ctx = off.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    for (const f of fxs) {
      f.t += dt;
      const p = f.t / f.max, env = clamp(Math.min(f.t / 0.35, (f.max - f.t) / 0.8), 0, 1);
      screen(ctx, f, p, env, st, st.pal, S);
    }
    fxs = fxs.filter((f) => f.t < f.max);
    ctx.globalCompositeOperation = "lighter";
    const sp = glow();
    for (const q of parts) {
      q.life += dt;
      if (q.kind === "orb") {
        q.a += q.sp * dt;
        const r = q.r + (q.grow ? q.grow * (q.life / q.max) : 0);
        q.x = cx + Math.cos(q.a) * r;
        q.y = cy + Math.sin(q.a) * r * 0.42;
      } else {
        if (q.drag) {
          q.vx *= Math.exp(-q.drag * dt);
          q.vy *= Math.exp(-q.drag * dt);
          q.vy += 60 * S * dt;
        }
        if (q.kind === "flake" || q.kind === "petal" || q.kind === "feather" || q.kind === "bill") q.vx += Math.sin(q.life * 2 + q.rot) * 30 * S * dt;
        if (q.kind === "fly") q.vx += Math.sin(q.life * 2.2 + q.ph) * 90 * S * dt;
        if (q.kind === "coin" || q.kind === "drop") q.vy += 220 * S * dt;
        q.x += q.vx * dt;
        q.y += q.vy * dt;
      }
      q.rot += (q.vr || 0) * dt;
      const a = clamp(Math.min(q.life / 0.25, (q.max - q.life) / 0.7), 0, 1);
      if (a > 0) part(ctx, q, a, sp, S);
    }
    parts = parts.filter((q) => q.life < q.max && q.y < h + 300 && q.y > -h && q.x > -w * 0.7 && q.x < w * 1.7);
    ctx.restore();
    ctx.globalCompositeOperation = "destination-out";
    const fade = ctx.createLinearGradient(0, h * 0.6, 0, h * 0.76);
    fade.addColorStop(0, "rgba(0,0,0,0)");
    fade.addColorStop(1, "rgba(0,0,0,1)");
    ctx.fillStyle = fade;
    ctx.fillRect(0, h * 0.6, w, h * 0.4);
    ctx.globalCompositeOperation = "source-over";
    main.save();
    main.setTransform(1, 0, 0, 1, 0, 0);
    main.globalCompositeOperation = "source-over";
    main.globalAlpha = 0.72;
    main.drawImage(off, 0, 0);
    main.restore();
    return true;
  }

  function part(ctx, q, a, sp, S) {
    const { x, y, s, col } = q;
    switch (q.kind) {
      case "ember":
        ctx.globalAlpha = a * 0.9;
        ctx.drawImage(sp, x - s * 1.6, y - s * 1.6, s * 3.2, s * 3.2);
        ctx.globalAlpha = 1;
        ctx.fillStyle = rgba(col, a);
        ctx.beginPath();
        ctx.arc(x, y, s * 0.35, 0, 6.3);
        ctx.fill();
        break;
      case "streak": {
        const x2 = x - q.vx * 0.02, y2 = y - q.vy * 0.02 - Math.sign(q.vy || 1) * s;
        const g = ctx.createLinearGradient(x, y, x2, y2);
        g.addColorStop(0, rgba(col, a * 0.55));
        g.addColorStop(1, rgba(col, 0));
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.4 * S;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        break;
      }
      case "flake":
        ctx.strokeStyle = rgba(col, a * 0.85);
        ctx.lineWidth = Math.max(1, s * 0.12);
        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
          const an = q.rot + (i * Math.PI) / 3;
          ctx.moveTo(x - Math.cos(an) * s * 0.5, y - Math.sin(an) * s * 0.5);
          ctx.lineTo(x + Math.cos(an) * s * 0.5, y + Math.sin(an) * s * 0.5);
        }
        ctx.stroke();
        break;
      case "heart":
        ctx.globalAlpha = a * 0.5;
        ctx.drawImage(sp, x - s * 2, y - s * 2, s * 4, s * 4);
        ctx.globalAlpha = 1;
        ctx.fillStyle = rgba(col, a * 0.92);
        heartPath(ctx, x, y, s);
        ctx.fill();
        break;
      case "star":
        ctx.fillStyle = rgba(col, a);
        starPath(ctx, x, y, s, 5, 0.42);
        ctx.fill();
        ctx.globalAlpha = a * 0.6;
        ctx.drawImage(sp, x - s * 2, y - s * 2, s * 4, s * 4);
        ctx.globalAlpha = 1;
        break;
      case "glint": {
        const tw = 0.5 + 0.5 * Math.sin(q.life * 14 + q.rot * 3);
        ctx.fillStyle = rgba(col, a * (0.5 + tw * 0.5));
        starPath(ctx, x, y, s * (0.8 + tw * 0.6), 4, 0.18);
        ctx.fill();
        break;
      }
      case "drop":
        ctx.fillStyle = rgba(col, a * 0.75);
        ctx.beginPath();
        ctx.moveTo(x, y - s);
        ctx.quadraticCurveTo(x + s * 0.6, y, x, y + s * 0.5);
        ctx.quadraticCurveTo(x - s * 0.6, y, x, y - s);
        ctx.fill();
        break;
      case "petal":
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(q.rot);
        ctx.scale(1, 0.55 + 0.45 * Math.sin(q.life * 3 + q.rot));
        ctx.fillStyle = rgba(col, a * 0.85);
        ctx.beginPath();
        ctx.ellipse(0, 0, s * 0.8, s * 0.45, 0, 0, 6.3);
        ctx.fill();
        ctx.restore();
        break;
      case "feather":
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.sin(q.life * 1.5 + q.rot) * 0.6);
        ctx.strokeStyle = rgba(col, a * 0.8);
        ctx.lineWidth = Math.max(1, S);
        ctx.beginPath();
        ctx.moveTo(0, -s);
        ctx.quadraticCurveTo(s * 0.25, 0, 0, s);
        ctx.stroke();
        ctx.fillStyle = rgba(col, a * 0.35);
        ctx.beginPath();
        ctx.ellipse(s * 0.1, -s * 0.1, s * 0.32, s * 0.85, 0.15, 0, 6.3);
        ctx.fill();
        ctx.restore();
        break;
      case "bill":
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(q.rot);
        ctx.scale(Math.cos(q.life * 4 + q.rot), 1);
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = rgba(col, a * 0.85);
        ctx.fillRect(-s, -s * 0.5, s * 2, s);
        ctx.strokeStyle = rgba([220, 255, 220], a * 0.7);
        ctx.lineWidth = Math.max(1, S);
        ctx.strokeRect(-s * 0.8, -s * 0.32, s * 1.6, s * 0.64);
        ctx.restore();
        ctx.globalCompositeOperation = "lighter";
        break;
      case "coin":
        ctx.fillStyle = rgba(col, a);
        ctx.beginPath();
        ctx.ellipse(x, y, s * 0.6 * Math.abs(Math.cos(q.life * 6 + q.rot)) + 1, s * 0.6, 0, 0, 6.3);
        ctx.fill();
        ctx.globalAlpha = a * 0.5;
        ctx.drawImage(sp, x - s * 1.4, y - s * 1.4, s * 2.8, s * 2.8);
        ctx.globalAlpha = 1;
        break;
      case "bird": {
        const fl = Math.sin(q.life * 9 + q.ph) * 0.6;
        ctx.strokeStyle = rgba(col, a * 0.85);
        ctx.lineWidth = Math.max(1.2, s * 0.16);
        ctx.beginPath();
        ctx.moveTo(x - s, y - s * fl);
        ctx.quadraticCurveTo(x - s * 0.4, y - s * 0.3, x, y);
        ctx.quadraticCurveTo(x + s * 0.4, y - s * 0.3, x + s, y - s * fl);
        ctx.stroke();
        break;
      }
      case "fly": {
        const fl = Math.abs(Math.sin(q.life * 11 + q.ph));
        ctx.fillStyle = rgba(mixW(col, 0.3), a * 0.85);
        for (const sd of [-1, 1]) {
          ctx.beginPath();
          ctx.ellipse(x + sd * s * 0.5 * fl, y - s * 0.15, s * 0.55 * fl + 0.5, s * 0.7, sd * 0.4, 0, 6.3);
          ctx.ellipse(x + sd * s * 0.35 * fl, y + s * 0.45, s * 0.35 * fl + 0.5, s * 0.4, -sd * 0.3, 0, 6.3);
          ctx.fill();
        }
        break;
      }
      case "bubble":
        ctx.strokeStyle = rgba(col, a * 0.7);
        ctx.lineWidth = Math.max(1, s * 0.1);
        ctx.beginPath();
        ctx.arc(x + Math.sin(q.life * 3 + q.rot) * 4 * S, y, s * 0.6, 0, 6.3);
        ctx.stroke();
        ctx.fillStyle = rgba([255, 255, 255], a * 0.5);
        ctx.beginPath();
        ctx.arc(x - s * 0.2, y - s * 0.22, s * 0.12, 0, 6.3);
        ctx.fill();
        break;
      case "gust": {
        const g = ctx.createLinearGradient(x - s, y, x, y);
        g.addColorStop(0, rgba(col, 0));
        g.addColorStop(1, rgba(col, a * 0.28));
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.5 * S;
        ctx.beginPath();
        ctx.moveTo(x - s, y);
        ctx.quadraticCurveTo(x - s * 0.5, y - 6 * S, x, y);
        ctx.stroke();
        break;
      }
      case "puff": {
        const r = s * (1 + q.life * 0.5);
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = a * 0.16;
        ctx.drawImage(sp, x - r, y - r, r * 2, r * 2);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "lighter";
        break;
      }
      case "spark":
        ctx.strokeStyle = rgba(col, a);
        ctx.lineWidth = 1.6 * S;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - q.vx * 0.03, y - q.vy * 0.03);
        ctx.stroke();
        break;
      case "conf":
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(q.rot);
        ctx.scale(Math.cos(q.life * 5 + q.rot), 1);
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = rgba(col, a * 0.9);
        ctx.fillRect(-s * 0.5, -s * 0.3, s, s * 0.6);
        ctx.restore();
        ctx.globalCompositeOperation = "lighter";
        break;
      case "balloon": {
        const bx = x + Math.sin(q.life * 1.3 + q.ph) * 12 * S;
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = rgba([255, 255, 255], a * 0.4);
        ctx.lineWidth = Math.max(1, S * 0.8);
        ctx.beginPath();
        ctx.moveTo(bx, y + s * 1.2);
        ctx.quadraticCurveTo(bx + 6 * S, y + s * 2, bx, y + s * 2.8);
        ctx.stroke();
        const g = ctx.createRadialGradient(bx - s * 0.3, y - s * 0.4, s * 0.1, bx, y, s * 1.2);
        g.addColorStop(0, rgba(mixW(col, 0.6), a * 0.95));
        g.addColorStop(1, rgba(col, a * 0.85));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(bx, y, s * 0.9, s * 1.15, 0, 0, 6.3);
        ctx.fill();
        ctx.globalCompositeOperation = "lighter";
        break;
      }
      case "bokeh":
        ctx.globalAlpha = a * 0.22;
        ctx.fillStyle = rgba(col, 1);
        ctx.beginPath();
        ctx.arc(x, y, s, 0, 6.3);
        ctx.fill();
        ctx.globalAlpha = 1;
        break;
      case "ghost": {
        const sw = Math.sin(q.life * 2 + q.ph) * 10 * S;
        ctx.globalAlpha = a * 0.22;
        ctx.drawImage(sp, x + sw - s, y - s * 1.4, s * 2, s * 2.8);
        ctx.globalAlpha = a * 0.5;
        ctx.fillStyle = "rgba(20,20,40,1)";
        ctx.globalCompositeOperation = "source-over";
        for (const ex of [-0.25, 0.25]) {
          ctx.beginPath();
          ctx.arc(x + sw + ex * s, y - s * 0.5, s * 0.09, 0, 6.3);
          ctx.fill();
        }
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 1;
        break;
      }
      case "orb":
        ctx.globalAlpha = a;
        ctx.drawImage(sp, x - s * 2, y - s * 2, s * 4, s * 4);
        ctx.globalAlpha = 1;
        break;
      case "note":
        ctx.fillStyle = rgba(col, a * 0.9);
        ctx.strokeStyle = rgba(col, a * 0.9);
        ctx.lineWidth = Math.max(1.4, s * 0.13);
        ctx.beginPath();
        ctx.ellipse(x, y, s * 0.42, s * 0.3, -0.4, 0, 6.3);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x + s * 0.38, y);
        ctx.lineTo(x + s * 0.38, y - s * 1.3);
        ctx.quadraticCurveTo(x + s * 0.9, y - s * 1.0, x + s * 0.8, y - s * 0.55);
        ctx.stroke();
        break;
    }
  }

  // Bildschirm-Effekte (env 0..1 = Ein- und Ausblenden)
  function screen(ctx, f, p, env, st, pal, S) {
    const { w, h, cx, cy, R } = st, t = f.t;
    ctx.globalCompositeOperation = "lighter";
    switch (f.name) {
      case "flames": case "hellfire": {
        // warmes Glühen um das Cover, das im Takt flackert
        const hot = f.name === "hellfire" ? [255, 40, 20] : [255, 130, 40];
        const fl = 0.75 + 0.25 * Math.sin(t * 11) * Math.sin(t * 7.3) + 0.2 * (st.beat || 0);
        const g = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 2.6);
        g.addColorStop(0, rgba(hot, 0.32 * env * fl));
        g.addColorStop(1, rgba(hot, 0));
        ctx.fillStyle = g;
        ctx.fillRect(cx - R * 2.6, cy - R * 2.6, R * 5.2, R * 5.2);
        break;
      }
      case "rain": case "storm":
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = `rgba(10,20,45,${(0.12 * env).toFixed(3)})`;
        ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = "lighter";
        if (f.bolts) bolts(ctx, f, st, S);
        break;
      case "lightning": bolts(ctx, f, st, S); break;
      case "frost": {
        const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
        g.addColorStop(0, "rgba(160,220,255,0)");
        g.addColorStop(1, rgba([170, 225, 255], 0.32 * env));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        break;
      }
      case "sun": case "beach": {
        const sx = w * 0.82, sy = h * 0.14, r = Math.min(w, h) * 0.5;
        const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
        g.addColorStop(0, rgba([255, 240, 190], 0.55 * env));
        g.addColorStop(0.25, rgba([255, 190, 90], 0.22 * env));
        g.addColorStop(1, "rgba(255,160,60,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 9; i++) {
          const a = t * 0.15 + (i / 9) * Math.PI * 2;
          ctx.strokeStyle = rgba([255, 220, 150], 0.08 * env);
          ctx.lineWidth = 22 * S;
          ctx.beginPath();
          ctx.moveTo(sx + Math.cos(a) * r * 0.12, sy + Math.sin(a) * r * 0.12);
          ctx.lineTo(sx + Math.cos(a) * r * 1.3, sy + Math.sin(a) * r * 1.3);
          ctx.stroke();
        }
        if (f.wave) waves(ctx, t, env, w, h, [60, 190, 230], S);
        break;
      }
      case "moon": {
        const mx = w * 0.16, my = h * 0.17, r = Math.min(w, h) * 0.07;
        const g = ctx.createRadialGradient(mx, my, r * 0.8, mx, my, r * 4);
        g.addColorStop(0, rgba([220, 225, 255], 0.3 * env));
        g.addColorStop(1, "rgba(200,210,255,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        // Sichel: Vollmond, dann ein versetzter Kreis in der Hintergrundfarbe der Nacht darüber
        ctx.fillStyle = rgba([240, 240, 255], 0.85 * env);
        ctx.beginPath();
        ctx.arc(mx, my, r, 0, 6.3);
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = `rgba(14,12,30,${(0.92 * env).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(mx + r * 0.45, my - r * 0.2, r * 0.9, 0, 6.3);
        ctx.fill();
        ctx.globalCompositeOperation = "lighter";
        break;
      }
      case "rays": case "heaven": case "feathers": {
        if (f.name === "feathers" && !f.rays) break;
        for (let i = 0; i < 7; i++) {
          const x0 = w * (0.2 + i * 0.1) + Math.sin(t * 0.6 + i) * 30 * S, spread = w * 0.08;
          const g = ctx.createLinearGradient(x0, 0, x0, h);
          g.addColorStop(0, rgba([255, 250, 230], 0.16 * env));
          g.addColorStop(1, "rgba(255,250,230,0)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(x0 - spread * 0.15, 0);
          ctx.lineTo(x0 + spread * 0.15, 0);
          ctx.lineTo(x0 + spread, h);
          ctx.lineTo(x0 - spread, h);
          ctx.fill();
        }
        break;
      }
      case "night": case "dark": {
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = `rgba(2,2,10,${(0.2 * env).toFixed(3)})`;
        ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = "lighter";
        if (f.name === "night") {
          const sp = glow();
          for (let i = 0; i < 40; i++) {
            const x = ((Math.sin(i * 91.7 + f.seed * 50) + 1) / 2) * w, y = ((Math.sin(i * 47.3 + f.seed * 20) + 1) / 2) * h * 0.6;
            ctx.globalAlpha = clamp(env * (0.3 + 0.4 * Math.sin(t * 3 + i)), 0, 1);
            const r = (2 + (i % 3)) * S;
            ctx.drawImage(sp, x - r * 2, y - r * 2, r * 4, r * 4);
          }
          ctx.globalAlpha = 1;
        }
        break;
      }
      case "bloom": {
        const r = Math.max(w, h) * (0.3 + p * 0.5);
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, rgba([255, 255, 255], 0.25 * env * (1 - p)));
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        break;
      }
      case "heartbreak": {
        // großes Herz über dem Cover, das in zwei Hälften zerbricht und fällt
        const s = R * 0.7, split = clamp((t - 0.7) / 1.4, 0, 1), y0 = cy - R * 1.6 + split * split * h * 0.5;
        for (const sd of [-1, 1]) {
          ctx.save();
          ctx.translate(cx + sd * split * R * 0.9, y0);
          ctx.rotate(sd * split * 0.6);
          ctx.beginPath();
          ctx.rect(sd < 0 ? -s * 1.2 : 0, -s * 1.2, s * 1.2, s * 2.4);
          ctx.clip();
          ctx.fillStyle = rgba([255, 60, 100], 0.85 * env);
          heartPath(ctx, 0, 0, s);
          ctx.fill();
          ctx.restore();
        }
        break;
      }
      case "gold": case "tint": {
        const c = f.col || [255, 255, 255];
        const g = ctx.createRadialGradient(cx, cy, R, w / 2, h / 2, Math.max(w, h) * 0.8);
        g.addColorStop(0, rgba(c, (f.tintA || 0.16) * env));
        g.addColorStop(1, rgba(c, (f.tintA || 0.16) * 0.5 * env));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        break;
      }
      case "crown": {
        const s = R * 0.55, y = cy - R * 1.35 + Math.sin(t * 2.4) * 6 * S - (1 - env) * 30 * S;
        ctx.fillStyle = rgba([255, 205, 70], 0.9 * env);
        ctx.beginPath();
        ctx.moveTo(cx - s, y + s * 0.5);
        ctx.lineTo(cx - s, y - s * 0.2);
        ctx.lineTo(cx - s * 0.5, y + s * 0.15);
        ctx.lineTo(cx, y - s * 0.55);
        ctx.lineTo(cx + s * 0.5, y + s * 0.15);
        ctx.lineTo(cx + s, y - s * 0.2);
        ctx.lineTo(cx + s, y + s * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 0.6 * env;
        ctx.drawImage(glow(), cx - s * 2, y - s * 1.6, s * 4, s * 3.2);
        ctx.globalAlpha = 1;
        break;
      }
      case "wave": waves(ctx, t, env, w, h, mixW(pal?.[1] || [60, 150, 255], 0.2), S); break;
      case "rainbow": {
        const cols = [[255, 60, 60], [255, 150, 40], [255, 230, 60], [70, 220, 90], [60, 150, 255], [150, 80, 255]];
        const r0 = R * 1.6, grow = Math.min(1, t / 1.1);
        cols.forEach((c, i) => {
          ctx.strokeStyle = rgba(c, 0.42 * env);
          ctx.lineWidth = 9 * S;
          ctx.beginPath();
          ctx.arc(cx, cy + R * 0.6, r0 + i * 10 * S, Math.PI, Math.PI + Math.PI * grow);
          ctx.stroke();
        });
        break;
      }
      case "fireworks":
        for (const r of f.rockets) {
          if (r.done || t < r.d) continue;
          r.done = true;
          const c = (pal || [[255, 220, 120]])[(Math.random() * 3) | 0];
          add(40, () => {
            const a = rnd(0, 6.3), v = rnd(160, 380) * S;
            return { kind: "spark", x: r.x, y: r.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 1.8, life: 0, max: rnd(1.2, 1.9), s: 3 * S, col: mixW(c, rnd(0, 0.6)) };
          });
        }
        break;
      case "rings": case "jump": {
        const beatIdx = st.beatIdx ?? -1;
        if (beatIdx !== f.lastBeat && (f.name === "jump" || beatIdx % 2 === 0)) {
          f.lastBeat = beatIdx;
          f.rings.push({ r: R, a: f.name === "jump" ? 0.7 : 0.5 });
        }
        const dt = st.dt || 0.016;
        for (const g of f.rings) {
          g.r += (f.name === "jump" ? 900 : 520) * S * dt;
          g.a *= Math.exp(-dt * 2.4);
          ctx.strokeStyle = rgba(pal?.[0] || [255, 255, 255], g.a * env);
          ctx.lineWidth = 3 * S;
          ctx.beginPath();
          ctx.arc(cx, cy, g.r, 0, 6.3);
          ctx.stroke();
        }
        f.rings = f.rings.filter((g) => g.a > 0.03);
        break;
      }
      case "orbit": {
        const rx = R * 2.1, ry = R * 0.6, a = t * 1.6, tilt = -0.25;
        ctx.strokeStyle = rgba(mixW(pal?.[2] || [200, 220, 255], 0.3), 0.35 * env);
        ctx.lineWidth = 2 * S;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, tilt, 0, 6.3);
        ctx.stroke();
        const ex = Math.cos(a) * rx, ey = Math.sin(a) * ry;
        const px0 = cx + ex * Math.cos(tilt) - ey * Math.sin(tilt), py0 = cy + ex * Math.sin(tilt) + ey * Math.cos(tilt);
        ctx.globalAlpha = env;
        ctx.drawImage(glow(), px0 - 22 * S, py0 - 22 * S, 44 * S, 44 * S);
        ctx.globalAlpha = 1;
        break;
      }
      case "galaxy": {
        const g = ctx.createRadialGradient(cx, cy, R, cx, cy, R * 3.4);
        g.addColorStop(0, rgba(mixW(pal?.[1] || [120, 90, 255], 0.2), 0.16 * env));
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        break;
      }
      case "rocket": {
        const y = h - (t / f.max) * h * 1.3, x = w * 0.5 + Math.sin(f.seed * 9) * w * 0.3;
        const g = ctx.createLinearGradient(x, y, x, y + h * 0.35);
        g.addColorStop(0, rgba([255, 230, 180], 0.7 * env));
        g.addColorStop(1, "rgba(255,120,40,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(x - 6 * S, y);
        ctx.lineTo(x + 6 * S, y);
        ctx.lineTo(x + 18 * S, y + h * 0.35);
        ctx.lineTo(x - 18 * S, y + h * 0.35);
        ctx.fill();
        break;
      }
      case "clock": {
        const r = R * 1.45;
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
          ctx.strokeStyle = rgba([255, 255, 255], (i % 3 ? 0.25 : 0.5) * env);
          ctx.lineWidth = (i % 3 ? 2 : 4) * S;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
          ctx.lineTo(cx + Math.cos(a) * (r + 14 * S), cy + Math.sin(a) * (r + 14 * S));
          ctx.stroke();
        }
        ctx.strokeStyle = rgba(pal?.[0] || [255, 255, 255], 0.7 * env);
        ctx.lineWidth = 3 * S;
        ctx.beginPath();
        ctx.arc(cx, cy, r + 7 * S, -Math.PI / 2, -Math.PI / 2 + t * 2.2);
        ctx.stroke();
        break;
      }
      case "speed":
        for (let i = 0; i < 60; i++) {
          const a = (i / 60) * Math.PI * 2 + f.seed * 6, ph = (t * 1.6 + ((i * 37) % 11) / 11) % 1;
          const r0 = R * 1.3 + ph * Math.max(w, h) * 0.7;
          ctx.strokeStyle = rgba([255, 255, 255], 0.22 * env * (1 - ph));
          ctx.lineWidth = 2 * S;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
          ctx.lineTo(cx + Math.cos(a) * (r0 + 80 * S), cy + Math.sin(a) * (r0 + 80 * S));
          ctx.stroke();
        }
        break;
      case "boom": {
        const r = R + p * Math.max(w, h) * 0.9;
        ctx.strokeStyle = rgba([255, 230, 190], 0.6 * (1 - p));
        ctx.lineWidth = (14 * (1 - p) + 2) * S;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, 6.3);
        ctx.stroke();
        if (t < 0.15 && !st.noFlash) {
          ctx.fillStyle = `rgba(255,240,220,${(0.16 * (1 - t / 0.15)).toFixed(3)})`;
          ctx.fillRect(0, 0, w, h);
        }
        break;
      }
      case "sparks":
        if (f.flicker && !st.noFlash && Math.random() < 0.18) {
          ctx.fillStyle = `rgba(160,210,255,${(0.12 * env).toFixed(3)})`;
          ctx.fillRect(0, 0, w, h);
        }
        break;
    }
    ctx.globalCompositeOperation = "lighter";
  }
  // Wasser: weiche, wellige Ringe, die vom Cover nach außen laufen
  function waves(ctx, t, env, w, h, c, S) {
    const { cx, cy, R } = st0;
    for (let k = 0; k < 4; k++) {
      const ph = (t * 0.45 + k / 4) % 1, r = R * (1.15 + ph * 1.9);
      ctx.strokeStyle = rgba(c, 0.32 * env * (1 - ph));
      ctx.lineWidth = 2.5 * S;
      ctx.beginPath();
      for (let i = 0; i <= 72; i++) {
        const a = (i / 72) * Math.PI * 2, rr = r + Math.sin(a * 6 + t * 2 + k) * 5 * S;
        const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * 0.9;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    void w;
    void h;
  }
  function bolts(ctx, f, st, S) {
    const { w, h } = st;
    for (let i = 0; i < f.bolts.length; i++) {
      const d = f.t - f.bolts[i];
      if (d < 0 || d > 0.35) continue;
      const a = 1 - d / 0.35;
      ctx.fillStyle = `rgba(220,230,255,${(0.14 * a).toFixed(3)})`;
      ctx.fillRect(0, 0, w, h);
      // zackiger Blitz von oben
      f["path" + i] ||= (() => {
        const pts = [[w * (0.2 + Math.random() * 0.6), 0]];
        let [x, y] = pts[0];
        while (y < h * 0.7) {
          x += rnd(-50, 50) * S;
          y += rnd(30, 70) * S;
          pts.push([x, y]);
        }
        return pts;
      })();
      for (const [lw, al] of [[10 * S, 0.25], [3 * S, 0.95]]) {
        ctx.strokeStyle = `rgba(235,240,255,${(al * a).toFixed(3)})`;
        ctx.lineWidth = lw;
        ctx.beginPath();
        f["path" + i].forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
      }
    }
  }
  function reset() {
    queue = [];
    fxs = [];
    parts = [];
  }
  return { prepare, addTranslated, onLine, draw, fire, reset, needsTranslation, get uri() { return uriNow; } };
}

// für Tests: Treffer einer Zeile in allen Sprachen
const matchAny = (text, langs, lexicon) => {
  if (lexicon && lexicon !== LEX) {
    LEX = lexicon;
    IDX = null;
  }
  return matchLine(text, langs || Object.keys(IDX || build()));
};
// Farbe, in der das Wort aufleuchtet (für die TV-Ansicht)
const glowOf = (c) => FX[c]?.col || GLOW[FX[c]?.fx] || null;

// für Tests: welche Wörterbücher ein Liedtext bekommt
const detectLangs = (texts, lexicon) => {
  if (lexicon && lexicon !== LEX) {
    LEX = lexicon;
    IDX = null;
  }
  if (!IDX) build();
  return detect(texts.map((text) => ({ text })), "").langs;
};

export { createWordFx, matchAny, detectLangs, glowOf, FX };
