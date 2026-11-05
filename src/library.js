import { S, root } from "./core.js";
import { cfg } from "./config.js";
import { t } from "./i18n.js";
import { SEL } from "./selectors.js";

/* ---------------------------------------------------------------- Bibliothek und Alltag */
// Zwei kleine Helfer für Playlists: doppelte Songs finden und entfernen (Kontextmenü an eigenen
// Playlists) und Tempo + Tonart als Pille in jeder sichtbaren Titelzeile. Beides hängt an internen
// Spotify-Schnittstellen, die sich mit jedem Update ändern können – darum wird alles vorher geprüft
// und fehlt etwas, passiert einfach nichts (kein Fehler, kein halber Zustand).

const notify = (msg, err) => {
  try { S.showNotification?.(msg, !!err, 4000); } catch {}
};
const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
const PL = () => S.Platform?.PlaylistAPI;
const isPlaylist = (uri) => {
  try {
    if (typeof S.URI?.isPlaylistV1OrV2 === "function") return S.URI.isPlaylistV1OrV2(uri);
  } catch {}
  return /^spotify:(user:[^:]+:)?playlist:[A-Za-z0-9]+$/.test(String(uri || ""));
};

/* ---------------------------------------------------------------- Doppelte Songs */
// Welche Playlists darf man bearbeiten? Das Kontextmenü fragt synchron – darum merkt sich Mirage die
// eigenen (und gemeinsamen) Playlists aus der Bibliothek und frischt die Liste höchstens jede Minute auf.
let editable = null, editableAt = 0;
async function loadEditable() {
  const R = S.Platform?.RootlistAPI;
  if (typeof R?.getContents !== "function") return;
  editableAt = Date.now();
  try {
    const set = new Set();
    const walk = (items) => {
      for (const x of items || []) {
        if (x?.type === "folder") walk(x.items);
        else if (x?.type === "playlist" && x.uri && (x.isOwnedBySelf || x.isCollaborative || x.canAdd)) set.add(x.uri);
      }
    };
    walk((await R.getContents())?.items);
    editable = set;
  } catch {}
}
function mayEdit(uri) {
  if (Date.now() - editableAt > 60e3) loadEditable();
  // noch keine Liste (oder Spotify liefert keine): Menüpunkt zeigen, beim Klick wird genauer geprüft
  return !editable || editable.has(uri);
}

// Alle Titel einer Playlist laden. getContents blättert mit offset/limit; manche Spotify-Versionen
// ignorieren das und liefern immer alles – dann bricht die Schleife ab, statt Titel doppelt zu zählen.
async function loadAll(uri) {
  const P = PL();
  if (typeof P?.getContents !== "function") return null;
  const all = [];
  const LIMIT = 500;
  let first = "";
  for (let page = 0, offset = 0; page < 60; page++) {
    const r = await P.getContents(uri, { offset, limit: LIMIT });
    const items = Array.isArray(r?.items) ? r.items : [];
    if (!items.length || (page > 0 && items[0]?.uid && items[0].uid === first)) break;
    if (page === 0) first = items[0]?.uid || "";
    all.push(...items);
    offset += items.length;
    const total = Number(r?.totalLength ?? r?.total);
    if (items.length < LIMIT || (Number.isFinite(total) && all.length >= total)) break;
  }
  return all;
}

// Titel vergleichbar machen: Klein, ohne Akzente, ohne „(feat. …)“, „- Remastered 2011“, „(Single Version)“ …
// Remix, Live und Akustik bleiben bewusst stehen – das sind andere Aufnahmen, keine Dubletten.
const NOISE = /(feat\.?|ft\.|with |remaster|version|edit\b|mono|stereo|deluxe)/i;
function norm(s) {
  let x = String(s || "").toLowerCase();
  x = x.replace(/[([][^)\]]*[)\]]/g, (m) => (NOISE.test(m) ? " " : m));
  x = x.replace(/\s[-–]\s.*$/, (m) => (NOISE.test(m) ? "" : m));
  return x.normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^\p{L}\p{N}]+/gu, "");
}
const durMs = (it) => Number(it?.duration?.milliseconds ?? it?.duration_ms ?? it?.duration) || 0;
const artistOf = (it) => it?.artists?.[0]?.name || it?.artist?.name || "";

// exact: gleiche URI noch einmal · maybe: gleicher Titel + Künstler mit anderer URI (Single/Album-Version)
function findDuplicates(items) {
  const exact = [], maybe = [];
  const byUri = new Map(), byName = new Map();
  items.forEach((it, i) => {
    const uri = it?.uri;
    if (!uri) return;
    const row = { it, pos: i + 1 };
    if (byUri.has(uri)) {
      exact.push({ ...row, first: byUri.get(uri).pos });
      return;
    }
    byUri.set(uri, row);
    // nur Songs mit Titel und Künstler vergleichen (Folgen, lokale Dateien ohne Angaben fallen raus)
    const title = norm(it.name), artist = norm(artistOf(it));
    if (!title || !artist || !/^spotify:(track|local):/.test(uri)) return;
    const key = title + "|" + artist;
    const prev = byName.get(key);
    // sehr unterschiedliche Länge: eher ein anderes Stück mit gleichem Namen („Intro“)
    if (prev && !(durMs(prev.it) && durMs(it) && Math.abs(durMs(prev.it) - durMs(it)) > 45e3)) maybe.push({ ...row, first: prev.pos });
    else if (!prev) byName.set(key, row);
  });
  return { exact, maybe };
}

// Darf man diese Playlist bearbeiten? Metadaten wissen es genauer als die Bibliotheksliste.
async function canEdit(uri) {
  try {
    const m = await PL()?.getMetadata?.(uri);
    const p = m?.permissions;
    if (p && typeof p.canEdit === "boolean") return { ok: p.canEdit, name: m?.name || "" };
    return { ok: mayEdit(uri), name: m?.name || "" };
  } catch {
    return { ok: mayEdit(uri), name: "" };
  }
}

async function removeItems(uri, picked) {
  const P = PL();
  if (typeof P?.remove !== "function") return 0;
  let done = 0;
  // in Päckchen: sehr lange Listen auf einmal lehnt Spotify gelegentlich ab
  for (let i = 0; i < picked.length; i += 100) {
    const part = picked.slice(i, i + 100).map((x) => ({ uri: x.it.uri, uid: x.it.uid }));
    await P.remove(uri, part);
    done += part.length;
  }
  return done;
}

function dupRow(x, checked) {
  const row = el("label", "m-row m-dup");
  const txt = el("span");
  txt.append(el("b", "", x.it.name || x.it.uri), el("small", "", [artistOf(x.it), t("dupPos").replace("{a}", x.pos).replace("{b}", x.first)].filter(Boolean).join(" · ")));
  const cb = el("input");
  cb.type = "checkbox";
  cb.checked = checked;
  // ohne uid kann Spotify genau dieses Vorkommen nicht entfernen
  cb.disabled = !x.it.uid;
  row.append(txt, cb);
  return { row, cb, x };
}

function showDuplicates(uri, name, found) {
  const box = el("div", "mirage-settings m-dups");
  const picks = [];
  const section = (title, list, checked) => {
    if (!list.length) return;
    box.append(el("small", "m-note m-dups-head", title));
    for (const x of list) {
      const r = dupRow(x, checked);
      picks.push(r);
      box.append(r.row);
    }
  };
  section(t("dupExact"), found.exact, true);
  section(t("dupMaybe"), found.maybe, false);
  const go = el("button", "m-btn is-primary");
  go.type = "button";
  const count = () => picks.filter((p) => p.cb.checked && !p.cb.disabled).length;
  const label = () => {
    go.textContent = t("dupRemove").replace("{n}", count());
    go.disabled = !count();
  };
  box.addEventListener("change", label);
  label();
  go.onclick = async () => {
    const picked = picks.filter((p) => p.cb.checked && !p.cb.disabled).map((p) => p.x);
    if (!picked.length || !confirm(t("dupConfirm").replace("{n}", picked.length).replace("{p}", name || "Playlist"))) return;
    go.disabled = true;
    try {
      const n = await removeItems(uri, picked);
      S.PopupModal?.hide?.();
      notify(n ? t("dupDone").replace("{n}", n) : t("dupFailed"), !n);
    } catch {
      go.disabled = false;
      notify(t("dupFailed"), true);
    }
  };
  const actions = el("div", "m-actions");
  actions.append(go);
  box.append(actions);
  S.PopupModal.display({ title: t("dupTitle") + (name ? " · " + name : ""), content: box, isLarge: true });
}

let busy = false;
async function cleanPlaylist(uri) {
  if (busy) return;
  if (typeof PL()?.getContents !== "function" || typeof PL()?.remove !== "function" || !S.PopupModal?.display) return notify(t("dupUnsupported"), true);
  busy = true;
  try {
    const { ok, name } = await canEdit(uri);
    if (!ok) return notify(t("dupNoEdit"), true);
    notify(t("dupLoading"));
    const items = await loadAll(uri);
    if (!items) return notify(t("dupUnsupported"), true);
    const found = findDuplicates(items);
    if (!found.exact.length && !found.maybe.length) return notify(t("dupNone"));
    showDuplicates(uri, name, found);
  } catch {
    notify(t("dupUnsupported"), true);
  } finally {
    busy = false;
  }
}

// Kontextmenü: Rechtsklick auf eine eigene Playlist (Seitenleiste, Playlist-Seite „…“, Karten)
(function addDupMenu(tries = 0) {
  const CM = S.ContextMenu;
  if (!CM?.Item) return tries < 40 && setTimeout(() => addDupMenu(tries + 1), 500);
  try {
    loadEditable();
    new CM.Item(
      t("dupMenu"),
      (uris) => cleanPlaylist(uris?.[0]),
      (uris) => Array.isArray(uris) && uris.length === 1 && isPlaylist(uris[0]) && mayEdit(uris[0]),
      "playlist"
    ).register();
  } catch {}
})();

/* ---------------------------------------------------------------- Tempo und Tonart */
// Camelot-Rad: C-Dur = 8B, A-Moll = 8A. Jeder Quintschritt (+7 Halbtöne) ist eine Stunde weiter;
// eine Moll-Tonart steht auf derselben Zahl wie ihre Paralleltonart (3 Halbtöne höher).
function camelot(key, mode) {
  if (!(key >= 0 && key <= 11)) return "";
  const k = mode === 1 ? key : (key + 3) % 12;
  return ((k * 7 + 7) % 12) + 1 + (mode === 1 ? "B" : "A");
}
const NOTES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
const keyName = (key, mode) => (key >= 0 && key <= 11 ? t(mode === 1 ? "libMajor" : "libMinor").replace("{k}", NOTES[key]) : "");

// Zwischenspeicher im localStorage: id → [bpm, key, mode, Tag]. bpm 0 = Spotify hat keine Analyse –
// das wird nach 30 Tagen noch einmal versucht. Feste Obergrenze, die ältesten fliegen zuerst raus.
const STORE = "mirage:bpm", CAP = 4000, DAY = () => Math.floor(Date.now() / 864e5);
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
const known = (id) => {
  const v = cache.get(id);
  return v && (v[0] > 0 || DAY() - (v[3] || 0) < 30) ? v : null;
};

// Warteschlange: höchstens 2 Anfragen gleichzeitig, zuletzt sichtbar gewordene Zeilen zuerst.
// Bei Fehlern (Zeitüberschreitung, Anfragelimit) wächst die Pause bis auf eine Minute.
const queue = [];
const tries = new Map();
let active = 0, pauseUntil = 0, fails = 0, pumpT = 0;
function enqueue(id) {
  if (known(id) || queue.includes(id) || (tries.get(id) || 0) >= 3) return;
  queue.push(id);
  pump();
}
const dequeue = (id) => {
  const i = queue.indexOf(id);
  if (i >= 0) queue.splice(i, 1);
};
function pump() {
  clearTimeout(pumpT);
  const wait = pauseUntil - Date.now();
  if (wait > 0) {
    pumpT = setTimeout(pump, wait);
    return;
  }
  while (active < 2 && queue.length && running) {
    const id = queue.pop();
    if (known(id)) continue;
    active++;
    fetchOne(id).finally(() => {
      active--;
      pump();
    });
  }
}
async function fetchOne(id) {
  if (typeof S.getAudioData !== "function") return;
  try {
    const d = await Promise.race([S.getAudioData("spotify:track:" + id), new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 10000))]);
    const tr = d?.track;
    const bpm = Math.round(Number(tr?.tempo) || 0);
    const key = Number.isInteger(tr?.key) ? tr.key : -1;
    remember(id, [bpm, key, tr?.mode === 1 ? 1 : 0, DAY()]);
    fails = 0;
    paintId(id);
  } catch (e) {
    tries.set(id, (tries.get(id) || 0) + 1);
    fails++;
    // Anfragelimit (429) bremst härter als ein einzelner Aussetzer
    const limited = /429|rate/i.test(String(e?.message || e));
    pauseUntil = Date.now() + Math.min(60e3, (limited ? 5000 : 1500) * 2 ** Math.min(fails - 1, 6));
    if ((tries.get(id) || 0) < 3 && visibleIds().has(id)) queue.unshift(id);
  }
}

// Track-ID einer Zeile aus dem Titel-Link (/track/…) – lokale Dateien und Folgen haben keinen
const rowId = (row) => {
  const a = row.querySelector('a[data-testid="internal-track-link"], a[href*="/track/"]');
  return /\/track\/([A-Za-z0-9]{22})/.exec(a?.getAttribute("href") || "")?.[1] || "";
};
// Platz für die Pille: letzte Spalte (Herz, Dauer, „…“) – die Pille steht vorne in dieser Spalte
const endCell = (row) => row.querySelector(".main-trackList-rowSectionEnd") || [...row.querySelectorAll('[role="gridcell"]')].pop();

const visible = new Set();
const visibleIds = () => new Set([...visible].map((r) => r.dataset.mBpmId).filter(Boolean));
function paint(row) {
  const id = rowId(row);
  row.dataset.mBpmId = id;
  let pill = row.querySelector(".m-bpm");
  const v = id && known(id);
  if (!v || !v[0]) {
    pill?.remove();
    if (id && !v) enqueue(id);
    return;
  }
  const cell = endCell(row);
  if (!cell) return;
  if (!pill) pill = el("span", "m-bpm");
  if (pill.parentElement !== cell) cell.prepend(pill);
  const cam = camelot(v[1], v[2]);
  pill.textContent = cam ? `${v[0]} · ${cam}` : String(v[0]);
  pill.title = [v[0] + " BPM", keyName(v[1], v[2])].filter(Boolean).join(" · ");
}
function paintId(id) {
  for (const row of visible) if (row.isConnected && row.dataset.mBpmId === id) paint(row);
}

// Nur Zeilen im Blick laden: der IntersectionObserver meldet, was (fast) sichtbar ist
let running = false, io = null, mo = null, scanT = 0;
let observed = new WeakSet();
const PAGES = new Set(["playlist", "album", "collection"]);
function onIntersect(entries) {
  for (const e of entries) {
    const row = e.target;
    if (e.isIntersecting) {
      visible.add(row);
      paint(row);
    } else {
      visible.delete(row);
      if (row.dataset.mBpmId) dequeue(row.dataset.mBpmId);
    }
  }
}
function scan() {
  const mv = document.querySelector(SEL.mainView);
  if (!mv || !io) return;
  for (const row of mv.querySelectorAll(SEL.rows)) {
    if (!observed.has(row)) {
      observed.add(row);
      io.observe(row);
    } else if (visible.has(row) && row.dataset.mBpmId !== rowId(row)) {
      // Spotify verwendet Zeilen beim Scrollen wieder: andere ID = neu beschriften
      paint(row);
    }
  }
  for (const row of visible) if (!row.isConnected) visible.delete(row);
}
const scanSoon = () => {
  if (!scanT) scanT = setTimeout(() => { scanT = 0; scan(); }, 250);
};
function stop() {
  running = false;
  io?.disconnect();
  mo?.disconnect();
  io = mo = null;
  queue.length = 0;
  visible.clear();
  document.querySelectorAll(".m-bpm").forEach((p) => p.remove());
}
function start() {
  const mv = document.querySelector(SEL.mainView);
  if (!mv || typeof IntersectionObserver !== "function" || typeof S.getAudioData !== "function") return;
  if (!running) {
    running = true;
    // neuer Beobachter kennt noch keine Zeile
    observed = new WeakSet();
    io = new IntersectionObserver(onIntersect, { rootMargin: "200px 0px" });
    mo = new MutationObserver(scanSoon);
    mo.observe(mv, { childList: true, subtree: true, attributes: true, attributeFilter: ["href"] });
  }
  scanSoon();
}
// an/aus je nach Einstellung und Seitentyp – auf allen anderen Seiten läuft nichts mit
function refresh() {
  const want = !!cfg.libBpm && PAGES.has(root.dataset.mPage);
  if (!want) {
    if (running) stop();
    return;
  }
  // Seitenwechsel: alte Zeilen sind weg, Beobachter neu aufsetzen
  if (running) stop();
  start();
}
try {
  S.Platform?.History?.listen?.(() => setTimeout(refresh, 300));
} catch {}
setTimeout(refresh, 1500);

const bpm = { refresh };
export { bpm, camelot, findDuplicates, cleanPlaylist };
