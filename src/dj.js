/* ---------------------------------------------------------------- DJ-Helfer */
// Drei Werkzeuge für Partys:
// · Passende nächste Songs: aus der Warteschlange die, die harmonisch (Camelot-Rad), im Tempo (auch halbes/
//   doppeltes) und in der Energie am besten an den laufenden Song anschließen – mit einem Klick als Nächstes.
// · „Energie halten“: bei jedem Songwechsel schaut Mirage auf die nächsten Songs; käme als Nächstes ein deutlicher
//   Bruch (viel ruhiger, ganz andere Tonart und Tempo), zieht es den am besten passenden vor. Damit er später nicht
//   doppelt läuft, wird er an seiner alten Stelle übersprungen.
// · „Reihenfolge anwenden“: ordnet die nächsten Songs zu einer Kette, in der jeder an den vorigen anschließt
//   (Tonart, Tempo, Energiekurve – die Rechnung steht in djorder.js), mit „Rückgängig“. Dafür verschiebt Mirage die
//   Songs mit Spotifys eigener Funktion (PlayerAPI.reorderQueue, dieselbe wie beim Ziehen in der Warteschlange).
//   Fehlt sie in einer Spotify-Version, bleibt es bei der nummerierten Liste als Vorschlag.
// Tempo, Tonart und Lautheit kommen aus Spotifys Audio-Analyse – höchstens eine Anfrage zugleich, mit Pause bei
// Fehlern und einem Zwischenspeicher, damit nicht jeder Song immer wieder geladen wird.
import { S } from "./core.js";
import { cfg } from "./config.js";
import { camelot } from "./library.js";
import { lock } from "./lock.js";
import { PLR } from "./player.js";
import { fit, orderQueue, chainScore, sameRef, planMove } from "./djorder.js";

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

/* ---- Reihenfolge anwenden */
// Der Block, der sortiert wird: die nächsten Songs gleicher Herkunft (erst die eigene Warteschlange, sonst die
// Playlist), höchstens 25. Nie über die Grenze hinweg – eingereihte und Playlist-Songs zu mischen, bringt Spotify
// durcheinander. anchor = was direkt danach kommt (die Stelle, vor die der Block wieder gesetzt wird).
const trackOf = (x) => x?.contextTrack || x;
const refOf = (x) => ({ uri: trackOf(x).uri, uid: trackOf(x).uid });
function queueBlock(max = 25) {
  const items = [];
  let anchor = null;
  for (const x of S.Queue?.nextTracks || []) {
    const tr = trackOf(x);
    if (!tr?.uri?.startsWith("spotify:track:") || !tr.metadata?.title || (items.length && x.provider !== items[0].provider) || items.length >= max) {
      anchor = tr?.uri ? x : null;
      break;
    }
    items.push(x);
  }
  return { items, anchor };
}
const canReorder = () => typeof S.Platform?.PlayerAPI?.reorderQueue === "function";
// refs in dieser Reihenfolge an den Anfang des Blocks setzen und nachsehen, ob Spotify es übernommen hat
async function moveBlock(refs, anchor) {
  const plan = planMove((S.Queue?.nextTracks || []).map(refOf), refs, anchor);
  if (!plan) return false;
  const { live } = plan;
  await S.Platform.PlayerAPI.reorderQueue(plan.move, { before: plan.before });
  // Spotify meldet die neue Warteschlange erst einen Moment später
  for (let k = 0; k < 12; k++) {
    await new Promise((r) => setTimeout(r, 150));
    const got = (S.Queue?.nextTracks || []).map(refOf).filter((n) => live.some((r) => sameRef(r, n)));
    if (got.length === live.length && got.every((n, i) => sameRef(n, live[i]))) return true;
  }
  return false;
}
let undo = null;
// → { state: "done", n, from, to } | "same" | "few" | "locked" | "fail" | "list" (nur Vorschlag, mit order)
async function sortQueue(curUri) {
  if (lock.on) return { state: "locked" };
  const { items, anchor } = queueBlock();
  if (items.length < 3) return { state: "few" };
  const cur = await info(curUri), infos = [];
  for (const x of items) infos.push(await info(trackOf(x).uri));
  if (infos.filter(Boolean).length < 3) return { state: "few" };
  const order = orderQueue(cur, infos);
  if (order.every((i, k) => i === k)) return { state: "same" };
  const pct = (list) => Math.round(chainScore(cur, list) * 100);
  const res = {
    n: items.length, from: pct(infos), to: pct(order.map((i) => infos[i])),
    order: order.map((i) => ({ title: trackOf(items[i]).metadata.title, artist: trackOf(items[i]).metadata.artist_name || "", info: infos[i] })),
  };
  if (!canReorder()) return { state: "list", ...res };
  // die Warteschlange kann sich beim Laden der Daten geändert haben (Songwechsel): dann lieber nichts tun
  const again = queueBlock().items;
  if (lock.on || again.length !== items.length || again.some((x, i) => !sameRef(refOf(x), refOf(items[i])))) return { state: "fail" };
  const before = items.map(refOf), anchorRef = anchor ? refOf(anchor) : null;
  try {
    if (!(await moveBlock(order.map((i) => before[i]), anchorRef))) return { state: "fail", ...res };
  } catch {
    return { state: "fail", ...res };
  }
  undo = { before, anchor: anchorRef };
  return { state: "done", ...res };
}
// alte Reihenfolge wiederherstellen (Songs, die inzwischen liefen, fehlen einfach)
async function undoSort() {
  if (!undo || lock.on || !canReorder()) return false;
  const u = undo;
  undo = null;
  try {
    return await moveBlock(u.before, u.anchor);
  } catch {
    return false;
  }
}

export const dj = { info, suggest, onSong, fit, sortQueue, undoSort, canUndo: () => !!undo, canReorder };
