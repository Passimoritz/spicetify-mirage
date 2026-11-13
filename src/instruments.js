import { S, clamp } from "./core.js";
import { cfg } from "./config.js";
import { audio } from "./audio.js";
import { currentItem } from "./player.js";
import { KINDS, kindOf } from "./instrkinds.js";
import { heardMoments } from "./instrsound.js";

/* ---------------------------------------------------------------- Instrumente */
// OB ein Instrument auf der Aufnahme spielt, steht in den Credits des Songs (Spotify, sonst MusicBrainz
// über die ISRC-Nummer): das ist sicher, kein Raten. WANN es im Vordergrund ist, verrät die Klangfarbe
// der Analyse (Tonhöhen-Klarheit, Helligkeit, Rauschanteil, Anschlag) – nur die deutlichsten Stellen des
// Songs zählen, und nur für Instrumente, die die Credits bestätigen. Ohne Credits: keine Instrument-Effekte.
// Welche Credits zu welcher Art gehören, steht in instrkinds.js (Bläser, Saxofon, Gitarre, Klavier, Streicher, Chor,
// Schlagzeug, Bass, Synthesizer, Akkordeon, Flöte, Harfe).

// gefundene Credits bleiben gespeichert (je Song), damit niemand zweimal gefragt wird; kam keine Antwort
// (offline, Dienst überlastet), wird erst nach einem Tag wieder gefragt – nicht bei jedem Abspielen
// („2“: seit es Schlagzeug, Bass, Synthesizer, Akkordeon, Flöte und Harfe gibt – die alten Einträge kennen sie nicht)
const LS = "mirage:instruments2", RETRY = 24 * 3600e3;
let store = {};
try {
  store = JSON.parse(localStorage.getItem(LS) || "{}") || {};
} catch {}
function persist() {
  const keys = Object.keys(store);
  if (keys.length > 400) for (const k of keys.slice(0, keys.length - 400)) delete store[k];
  try {
    localStorage.setItem(LS, JSON.stringify(store));
  } catch {}
}
// MusicBrainz erlaubt eine Anfrage pro Sekunde; meldet es Überlastung (503), eine Minute Pause
let mbNext = 0;
async function mbFetch(url) {
  const wait = Math.max(0, mbNext - Date.now());
  mbNext = Date.now() + wait + 1100;
  await new Promise((r) => setTimeout(r, wait));
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 6000);
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { Accept: "application/json" } });
    if (res.status === 503) mbNext = Math.max(mbNext, Date.now() + 60e3);
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
const jobs = new Map();
function credited(uri) {
  if (!uri?.startsWith("spotify:track:")) return Promise.resolve(new Set());
  const known = store[uri];
  if (Array.isArray(known)) return Promise.resolve(new Set(known));
  if (known?.miss && Date.now() - known.miss < RETRY) return Promise.resolve(new Set());
  if (jobs.has(uri)) return jobs.get(uri);
  const job = (async () => {
    const id = uri.split(":")[2], found = new Set();
    let answered = false;
    try {
      const c = await S.CosmosAsync.get(`https://spclient.wg.spotify.com/track-credits-view/v0/experimental/${id}/credits`);
      for (const rc of c?.roleCredits || []) for (const a of rc.artists || []) for (const sr of a.subroles || []) {
        const k = kindOf(sr);
        if (k) found.add(k);
      }
      if (c?.roleCredits) answered = true;
    } catch {}
    if (cfg.partyOnline) {
      try {
        const tr = await S.CosmosAsync.get(`https://api.spotify.com/v1/tracks/${id}`);
        const isrc = tr?.external_ids?.isrc;
        if (isrc && /^[A-Z0-9]{12}$/i.test(isrc)) {
          const mb = await mbFetch(`https://musicbrainz.org/ws/2/isrc/${encodeURIComponent(isrc)}?inc=artist-rels&fmt=json`);
          for (const rec of mb?.recordings || []) for (const rel of rec.relations || []) {
            if (rel.type !== "instrument") continue;
            for (const at of rel.attributes || []) {
              const k = kindOf(at);
              if (k) found.add(k);
            }
          }
          if (mb) answered = true;
        }
      } catch {}
    }
    store[uri] = answered ? [...found] : { miss: Date.now() };
    persist();
    jobs.delete(uri);
    return found;
  })();
  jobs.set(uri, job);
  return job;
}

// Klangfarben-Karte: je Viertelsekunde, wie sehr der Klang nach dem jeweiligen Instrument aussieht
const STEP = 0.25;
const maps = new WeakMap();
function pct(arr, q) {
  const s = Float32Array.from(arr).sort();
  return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : 0;
}
function moments(d, kinds) {
  const key = [...kinds].sort().join(",");
  const old = maps.get(d);
  if (old?.key === key) return old;
  const segs = d.segs;
  const n = Math.ceil((segs[segs.length - 1].t + 2) / STEP);
  const B = segs.map((s) => s.b), F = segs.map((s) => s.f), K = segs.map((s) => s.k), L = segs.map((s) => s.l);
  const rng = (A) => [pct(A, 0.1), pct(A, 0.9)];
  const [b0, b1] = rng(B), [f0, f1] = rng(F), [k0, k1] = rng(K), [l0, l1] = rng(L);
  const nm = (v, lo, hi) => clamp((v - lo) / (hi - lo || 1), 0, 1);
  const out = { key };
  for (const kind of kinds) out[kind] = new Float32Array(n);
  segs.forEach((s, i) => {
    if (!s.p.length) return;
    const mean = s.p.reduce((a, v) => a + v, 0) / 12;
    const T = clamp((1 - mean) * 1.3 - 0.15, 0, 1); // ein klarer Ton statt Geräusch
    const nb = nm(s.b, b0, b1), nf = nm(s.f, f0, f1), nk = nm(s.k, k0, k1), nl = nm(s.l, l0, l1);
    const sc = {
      brass: T > 0.55 && nb > 0.6 && nk > 0.45 && nf < 0.5 ? T * nb : 0,
      sax: T > 0.55 && nb > 0.35 && nb < 0.78 && nf < 0.45 && nk < 0.65 ? T * (1 - Math.abs(nb - 0.56) * 2) : 0,
      guitar: nf > 0.55 && nb > 0.55 && nl > 0.6 ? nf * nb : 0,
      piano: nk > 0.7 && T > 0.45 && nb < 0.78 ? nk * T : 0,
      strings: T > 0.6 && nk < 0.35 && nf < 0.4 ? T * (1 - nk) : 0,
      choir: T > 0.5 && nb < 0.45 && nk < 0.4 && nf < 0.5 ? T * (1 - nb) : 0,
      // Schlagzeug-Solo: laut, harter Anschlag und kaum ein klarer Ton – sonst spielt die Band mit
      drums: T < 0.3 && nk > 0.6 && nl > 0.55 ? (1 - T) * nk : 0,
      // Bass im Vordergrund: dunkler, klarer Ton mit Druck
      bass: T > 0.5 && nb < 0.3 && nl > 0.5 && nf < 0.45 ? T * (1 - nb) : 0,
      // Synthesizer: heller, stehender Ton ohne Anschlag (Flächen und Leads)
      synth: T > 0.5 && nb > 0.55 && nk < 0.45 && nf < 0.55 ? T * nb * (1 - nk) : 0,
      // Akkordeon: getragener Zungenklang in der Mitte
      accordion: T > 0.5 && nb > 0.4 && nb < 0.8 && nk < 0.5 && nf < 0.5 ? T * (1 - Math.abs(nb - 0.6) * 2) : 0,
      // Flöte: sehr reiner, heller Ton, weich angeblasen
      flute: T > 0.65 && nb > 0.5 && nk < 0.4 && nf < 0.35 ? T * (1 - nk) : 0,
      // Harfe: reiner Ton, aber gezupft
      harp: T > 0.6 && nk > 0.5 && nf < 0.35 && nb > 0.3 && nb < 0.8 ? T * nk : 0,
    };
    const a = Math.floor(s.t / STEP), e = Math.max(a + 1, Math.floor((segs[i + 1]?.t ?? s.t + 0.3) / STEP));
    for (const kind of kinds) for (let x = a; x < e && x < n; x++) out[kind][x] = Math.max(out[kind][x], sc[kind]);
  });
  for (const kind of kinds) {
    const raw = out[kind], sm = new Float32Array(n);
    for (let x = 0; x < n; x++) {
      let sum = 0, cnt = 0;
      for (let y = Math.max(0, x - 2); y <= Math.min(n - 1, x + 1); y++) [sum, cnt] = [sum + raw[y], cnt + 1];
      sm[x] = sum / cnt;
    }
    // nur die deutlichsten Stellen: über dem 85. Perzentil des ganzen Songs (höchstens 0,8), absolut über 0,42,
    // mindestens 0,75 s am Stück – klingt das halbe Lied so, zählen nur seine stärksten Momente
    const thr = clamp(pct(sm, 0.85), 0.42, 0.8);
    const lv = new Float32Array(n);
    for (let x = 0; x < n; ) {
      if (sm[x] <= thr) {
        x++;
        continue;
      }
      let y = x;
      while (y < n && sm[y] > thr) y++;
      if (y - x >= 3) for (let z = x; z < y; z++) lv[z] = clamp(((sm[z] - thr) / (1 - thr)) * 1.6 + 0.35, 0, 1);
      x = y;
    }
    out[kind] = lv;
  }
  maps.set(d, out);
  return out;
}

// Wahlfunktion „Auch am Klang erkennen“ (instrsound.js): nur wenn die Credits kein Instrument nennen
const heard = new WeakMap();
function heardOf(d) {
  if (!heard.has(d)) heard.set(d, heardMoments(d.segs));
  return heard.get(d);
}

const cur = { uri: "", kinds: new Set(), asked: false, lv: Object.fromEntries(KINDS.map((k) => [k, 0])) };
function at(sec, dt) {
  const uri = currentItem()?.uri || "";
  if (uri !== cur.uri) {
    cur.uri = uri;
    cur.kinds = new Set();
    cur.asked = false;
    credited(uri).then((k) => {
      if (cur.uri !== uri) return;
      cur.kinds = k;
      cur.asked = true;
    });
  }
  const d = audio.uri === uri ? audio.data : null;
  const real = d && !d.synthetic && d.segs?.length;
  // erst wenn die Credits geantwortet haben (oder es keine gibt) – sonst flackerte kurz ein geratenes Instrument auf
  const H = real && !cur.kinds.size && cur.asked && cfg.instrSound ? heardOf(d) : null;
  const M = real && cur.kinds.size ? moments(d, cur.kinds) : H?.kinds.length ? H : null;
  const bin = Math.max(0, Math.floor(sec / STEP));
  // höchstens zwei Instrumente zugleich – die deutlichsten
  const want = KINDS.map((k) => [k, M?.[k]?.[bin] || 0]).sort((a, b) => b[1] - a[1]);
  want.forEach(([k, v], i) => {
    const target = i < 2 ? v : 0;
    cur.lv[k] += (target - cur.lv[k]) * (1 - Math.exp(-dt * (target > cur.lv[k] ? 6 : 2.5)));
    if (cur.lv[k] < 0.01) cur.lv[k] = 0;
  });
  let chroma = null;
  if (cur.lv.piano > 0 && d?.segs) {
    let lo = 0, hi = d.segs.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (d.segs[mid].t <= sec) lo = mid;
      else hi = mid - 1;
    }
    chroma = d.segs[lo].p.length ? d.segs[lo].p : null;
  }
  return { ...cur.lv, chroma, credited: [...cur.kinds], heard: H ? [...H.kinds] : [] };
}

export const instruments = { at, kindOf, KINDS };
