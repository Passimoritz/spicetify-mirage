/* ---------------------------------------------------------------- DJ-Helfer */
// Zwei Werkzeuge für Partys:
// · Passende nächste Songs: aus der Warteschlange die, die harmonisch (Camelot-Rad), im Tempo (auch halbes/
//   doppeltes) und in der Energie am besten an den laufenden Song anschließen – mit einem Klick als Nächstes.
// · „Energie halten“: bei jedem Songwechsel schaut Mirage auf die nächsten Songs; käme als Nächstes ein deutlicher
//   Bruch (viel ruhiger, ganz andere Tonart und Tempo), zieht es den am besten passenden vor. Damit er später nicht
//   doppelt läuft, wird er an seiner alten Stelle übersprungen.
// Tempo, Tonart und Lautheit kommen aus Spotifys Audio-Analyse – höchstens eine Anfrage zugleich, mit Pause bei
// Fehlern und einem Zwischenspeicher, damit nicht jeder Song immer wieder geladen wird.
import { S } from "./core.js";
import { cfg } from "./config.js";
import { camelot } from "./library.js";
import { lock } from "./lock.js";
import { PLR } from "./player.js";

const STORE = "mirage:dj", CAP = 3000, DAY = () => Math.floor(Date.now() / 864e5);
const cache = new Map();
try {
  const raw = JSON.parse(localStorage.getItem(STORE) || "{}");
  if (raw && typeof raw === "object") for (const [id, v] of Object.entries(raw).slice(-CAP)) if (Array.isArray(v)) cache.set(id, v);
} catch {}
let saveT = 0;
function remember(id, v) {
  cache.delete(id);
  cache.set(id, v);
  while (cache.size > CAP) cache.delete(cache.keys().next().value);
  clearTimeout(saveT);
  saveT = setTimeout(() => {
    try { localStorage.setItem(STORE, JSON.stringify(Object.fromEntries(cache))); } catch {}
  }, 2000);
}
const idOf = (uri) => (String(uri || "").startsWith("spotify:track:") ? uri.slice(14) : "");
const asInfo = (v) => (v && v[0] > 0 ? { bpm: v[0], key: v[1], mode: v[2], loud: v[3], cam: camelot(v[1], v[2]) } : null);

// eine Anfrage zugleich; nach Fehlern wächst die Pause (Anfragelimit)
let chain = Promise.resolve(), pauseUntil = 0, fails = 0;
function info(uri) {
  const id = idOf(uri);
  if (!id) return Promise.resolve(null);
  const have = cache.get(id);
  if (have && (have[0] > 0 || DAY() - (have[4] || 0) < 30)) return Promise.resolve(asInfo(have));
  const job = chain.then(async () => {
    const again = cache.get(id);
    if (again && again[0] > 0) return asInfo(again);
    const wait = pauseUntil - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    if (typeof S.getAudioData !== "function") return null;
    try {
      const d = await Promise.race([S.getAudioData(uri), new Promise((_, no) => setTimeout(() => no(new Error("timeout")), 10000))]);
      const tr = d?.track;
      const v = [Math.round(Number(tr?.tempo) || 0), Number.isInteger(tr?.key) ? tr.key : -1, tr?.mode === 1 ? 1 : 0, Number(tr?.loudness) || -12, DAY()];
      remember(id, v);
      fails = 0;
      return asInfo(v);
    } catch (e) {
      fails++;
      pauseUntil = Date.now() + Math.min(60e3, (/429|rate/i.test(String(e?.message || e)) ? 5000 : 1500) * 2 ** Math.min(fails - 1, 5));
      return null;
    }
  });
  chain = job.catch(() => null);
  return job;
}

/* ---- Wie gut passt b auf a? 0..1 aus Tonart, Tempo und Energie */
function camDist(a, b) {
  if (!a || !b) return 3;
  const na = parseInt(a, 10), nb = parseInt(b, 10), la = a.slice(-1), lb = b.slice(-1);
  const d = Math.min((na - nb + 12) % 12, (nb - na + 12) % 12);
  if (d === 0 && la === lb) return 0;
  if (d === 0) return 1; // Paralleltonart (8A ↔ 8B)
  if (d === 1 && la === lb) return 1; // Nachbar im Quintenzirkel
  if (d === 2 && la === lb) return 2;
  return 3;
}
function fit(a, b) {
  if (!a || !b) return 0;
  const harm = [1, 0.85, 0.45, 0.12][camDist(a.cam, b.cam)];
  // Tempo: gleich, halb oder doppelt – bis 8 % Abweichung lässt sich angleichen
  const r = b.bpm / a.bpm, dev = Math.min(Math.abs(r - 1), Math.abs(r * 2 - 1), Math.abs(r / 2 - 1));
  const tempo = Math.max(0, 1 - dev / 0.08);
  // Energie: ähnlich laut, leicht steigend ist am besten
  const dl = b.loud - a.loud, energy = Math.max(0, 1 - Math.abs(dl - 0.5) / 6);
  return harm * 0.45 + tempo * 0.35 + energy * 0.2;
}

const upcoming = (max) =>
  (S.Queue?.nextTracks || [])
    .map((x) => x.contextTrack || x)
    .filter((x) => x?.uri?.startsWith("spotify:track:") && x.metadata?.title)
    .slice(0, max)
    .map((x) => ({ uri: x.uri, title: x.metadata.title, artist: x.metadata.artist_name || "", image: (x.metadata.image_url || "").replace("spotify:image:", "https://i.scdn.co/image/") }));

// Vorschläge für den laufenden Song: die nächsten 25 Songs bewerten (lädt nach und nach, meldet Zwischenstände)
async function suggest(curUri, onUpdate) {
  const cur = await info(curUri);
  const list = upcoming(25).filter((x) => x.uri !== curUri);
  const out = [];
  for (const x of list) {
    const i = await info(x.uri);
    if (i) out.push({ ...x, info: i, score: fit(cur, i) });
    onUpdate?.({ cur, list: out.slice().sort((a, b) => b.score - a.score).slice(0, 6), done: false });
  }
  const best = out.sort((a, b) => b.score - a.score).slice(0, 6);
  onUpdate?.({ cur, list: best, done: true });
  return best;
}

/* ---- Energie halten */
const moved = new Map(); // uri → "queued" (vorgezogen) | "played" (vorgezogen gelaufen)
let lastSong = "";
async function onSong(curUri) {
  // nur einmal je Song (die Ansicht ruft das auch bei Einstellungsänderungen auf)
  if (!curUri || curUri === lastSong) return null;
  lastSong = curUri;
  const st = moved.get(curUri);
  // erstes Abspielen des vorgezogenen Songs: merken; kommt er an seiner alten Stelle noch einmal: überspringen
  if (st === "queued") moved.set(curUri, "played");
  else if (st === "played") {
    moved.delete(curUri);
    if (cfg.djEnergy) setTimeout(() => !lock.on && PLR.next(), 400);
    return null;
  }
  if (!cfg.djEnergy) return null;
  const cur = await info(curUri);
  const next = upcoming(8);
  if (!cur || next.length < 2) return null;
  const scored = [];
  for (const x of next) {
    const i = await info(x.uri);
    if (i) scored.push({ ...x, s: fit(cur, i) });
  }
  const first = scored.find((x) => x.uri === next[0].uri);
  const best = scored.slice().sort((a, b) => b.s - a.s)[0];
  // nur bei einem deutlichen Bruch eingreifen – sonst bleibt die Reihenfolge, wie sie ist
  if (!best || !first || best.uri === first.uri || best.s < first.s + 0.18 || first.s > 0.62) return null;
  try {
    await S.addToQueue([{ uri: best.uri }]);
    moved.set(best.uri, "queued");
    return best;
  } catch {
    return null;
  }
}

export const dj = { info, suggest, onSong, fit };
