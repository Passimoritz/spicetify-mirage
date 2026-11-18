/* ---------------------------------------------------------------- Album-Reise (Cover-Ansicht, 1.27) */
// Läuft ein Album (Kontext spotify:album:…), zeigt die Cover-Ansicht rechts eine Glas-Spalte mit der Titelliste:
// gehört (blass), läuft (hell, mit Fortschritt), kommt noch – dazu, wie lange das Album noch läuft, und die
// Mitwirkenden des laufenden Songs (dieselbe Quelle wie die Instrumente im Party-Modus: Spotifys Credits).
// Schalter im Menü „Mehr“ (oben rechts, Zeile mit Album-Symbol), gemerkt in cfg.albumPanel. Die Spalte hat eine feste Breite: ein Songwechsel
// tauscht nur Klassen und Texte, nichts verschiebt sich. Lange Alben scrollen; der laufende Titel gleitet in Sicht.
// Daten: zuerst Spotifys eigene Abfrage (GraphQL getAlbum, wie die Albumseite), sonst die Web-API.
import { S, fmt } from "./core.js";
import { t } from "./i18n.js";
import { cfg, save } from "./config.js";
import { free } from "./lock.js";

const ctxUri = () => S.Player?.data?.context?.uri || S.Player?.data?.context_uri || S.Platform?.PlayerAPI?._state?.context?.uri || "";
const albumCache = new Map(), creditCache = new Map();
const MAX_TRACKS = 600;

async function viaGraphQL(uri) {
  const def = S.GraphQL?.Definitions?.getAlbum;
  if (!def || !S.GraphQL?.Request) return null;
  let a = null;
  const tracks = [];
  for (let offset = 0; offset < MAX_TRACKS; ) {
    const r = await S.GraphQL.Request(def, { uri, locale: "", offset, limit: 50 });
    const u = r?.data?.albumUnion;
    if (!u || u.__typename !== "Album") return null;
    a ||= { name: u.name || "", artist: (u.artists?.items || []).map((x) => x.profile?.name).filter(Boolean).join(", "), year: (u.date?.isoString || "").slice(0, 4) };
    for (const it of u.tracksV2?.items || u.tracks?.items || []) {
      const x = it.track;
      if (!x?.uri) continue;
      tracks.push({ uri: x.uri, name: x.name || "", ms: x.duration?.totalMilliseconds || 0, disc: x.discNumber || 1, no: x.trackNumber || tracks.length + 1, artist: (x.artists?.items || []).map((y) => y.profile?.name).filter(Boolean).join(", ") });
    }
    const next = u.tracksV2?.pagingInfo?.nextOffset;
    if (!next || next <= offset) break;
    offset = next;
  }
  return tracks.length ? { ...a, tracks } : null;
}
async function viaWebApi(uri) {
  const id = uri.split(":")[2];
  const r = await S.CosmosAsync?.get?.(`https://api.spotify.com/v1/albums/${id}`);
  if (!r?.tracks?.items) return null;
  const tracks = [];
  let page = r.tracks;
  while (page) {
    for (const x of page.items || []) tracks.push({ uri: x.uri, name: x.name || "", ms: x.duration_ms || 0, disc: x.disc_number || 1, no: x.track_number || tracks.length + 1, artist: (x.artists || []).map((y) => y.name).join(", ") });
    if (!page.next || tracks.length >= MAX_TRACKS) break;
    page = await S.CosmosAsync.get(page.next).catch(() => null);
  }
  return tracks.length ? { name: r.name || "", artist: (r.artists || []).map((x) => x.name).join(", "), year: (r.release_date || "").slice(0, 4), tracks } : null;
}
function loadAlbum(uri) {
  if (!albumCache.has(uri)) {
    const job = (async () => {
      try {
        const a = await viaGraphQL(uri);
        if (a) return a;
      } catch {}
      try {
        return await viaWebApi(uri);
      } catch {
        return null;
      }
    })().then((a) => (a || setTimeout(() => albumCache.delete(uri), 60000), a));
    albumCache.set(uri, job);
    while (albumCache.size > 6) albumCache.delete(albumCache.keys().next().value);
  }
  return albumCache.get(uri);
}
// Credits: Rollen (Gesang/Mitwirkende, Text & Musik, Produktion) mit Namen – höchstens drei Rollen
function loadCredits(uri) {
  if (!uri?.startsWith("spotify:track:")) return Promise.resolve(null);
  if (!creditCache.has(uri)) {
    const id = uri.split(":")[2];
    creditCache.set(uri, Promise.resolve(S.CosmosAsync?.get?.(`https://spclient.wg.spotify.com/track-credits-view/v0/experimental/${id}/credits`)).then((c) => {
      const roles = (c?.roleCredits || []).map((rc) => ({ role: String(rc.roleTitle || ""), names: (rc.artists || []).map((a) => a.name).filter(Boolean) })).filter((r) => r.role && r.names.length);
      return roles.length ? roles.slice(0, 3) : null;
    }, () => null));
    while (creditCache.size > 40) creditCache.delete(creditCache.keys().next().value);
  }
  return creditCache.get(uri);
}
const ROLE = { performers: "alCredPerf", writers: "alCredWrite", producers: "alCredProd" };
// „noch 42 Min.“ / „noch 1 Std. 5 Min.“
function leftText(ms) {
  const m = Math.max(0, Math.round(ms / 60000));
  if (m < 1) return t("alLeftSoon");
  const h = Math.floor(m / 60);
  return (h ? t("alLeftH") : t("alLeft")).replace("{h}", h).replace("{m}", h ? m % 60 : m);
}

function createAlbumView({ layout }) {
  const panel = document.createElement("aside");
  panel.className = "m-im-album";
  panel.setAttribute("aria-label", t("alTitle"));
  panel.innerHTML = `<div class="m-al-head"><span class="m-al-kicker"></span><b class="m-al-name"></b><span class="m-al-sub"></span><span class="m-al-left" aria-live="off"></span></div>
    <ol class="m-al-list"></ol><div class="m-al-credits" hidden></div>`;
  const q = { kicker: panel.querySelector(".m-al-kicker"), name: panel.querySelector(".m-al-name"), sub: panel.querySelector(".m-al-sub"), left: panel.querySelector(".m-al-left"), list: panel.querySelector(".m-al-list"), credits: panel.querySelector(".m-al-credits") };
  q.kicker.textContent = t("alKicker");
  let uri = "", album = null, cur = -1, curUri = "", shown = false, token = 0, rows = [], prog = null, lastProg = "", lastLeft = "", host = null;
  const want = () => cfg.albumPanel !== false;
  // Menüzeile „Albumliste zeigen/ausblenden“: nur in der Cover-Ansicht, wenn ein Album läuft
  const toggle = () => {
    cfg.albumPanel = !want();
    save();
    apply(host?.dataset.mode, true);
  };
  function render() {
    q.name.textContent = album.name;
    q.sub.textContent = [album.artist, album.year].filter(Boolean).join(" · ");
    const discs = new Set(album.tracks.map((x) => x.disc)).size > 1;
    const frag = document.createDocumentFragment();
    let disc = 0;
    rows = album.tracks.map((x, i) => {
      if (discs && x.disc !== disc) {
        disc = x.disc;
        const h = document.createElement("li");
        h.className = "m-al-disc";
        h.setAttribute("aria-hidden", "true");
        h.textContent = t("alDisc").replace("{n}", disc);
        frag.append(h);
      }
      const li = document.createElement("li");
      li.className = "m-al-row";
      li.dataset.i = String(i);
      li.innerHTML = `<button type="button"><span class="m-al-no"></span><span class="m-al-t"><span></span><small></small></span><span class="m-al-dur"></span></button><i class="m-al-prog" aria-hidden="true"></i>`;
      li.querySelector(".m-al-no").textContent = String(x.no);
      li.querySelector(".m-al-t span").textContent = x.name;
      const small = li.querySelector(".m-al-t small");
      if (x.artist && x.artist !== album.artist) small.textContent = x.artist;
      else small.remove();
      li.querySelector(".m-al-dur").textContent = x.ms ? fmt(x.ms) : "";
      li.querySelector("button").onclick = () => {
        if (!free() || !S.Player?.playUri) return;
        S.Player.playUri(uri, {}, { skipTo: { uri: x.uri, index: i } });
      };
      frag.append(li);
      return li;
    });
    q.list.replaceChildren(frag);
    cur = -2;
  }
  // laufender Song: per URI, sonst (umgeleitete Songs) per Titel
  function mark(item, smooth) {
    if (!album) return;
    const u = item?.uri || "";
    let i = album.tracks.findIndex((x) => x.uri === u);
    if (i < 0) {
      const n = (item?.metadata?.title || item?.name || "").toLowerCase();
      i = n ? album.tracks.findIndex((x) => x.name.toLowerCase() === n) : -1;
    }
    if (i !== cur) {
      cur = i;
      rows.forEach((r, k) => {
        const st = cur < 0 ? "next" : k < cur ? "past" : k === cur ? "now" : "next";
        if (r.dataset.st !== st) r.dataset.st = st;
        const b = r.firstChild;
        if (k === cur) b.setAttribute("aria-current", "true");
        else b.removeAttribute("aria-current");
      });
      prog = rows[cur]?.querySelector(".m-al-prog") || null;
      lastProg = "";
      if (rows[cur]) scrollTo(rows[cur], smooth);
    }
    if (u !== curUri) {
      curUri = u;
      showCredits(u);
    }
  }
  // nur die Liste scrollt (nie die Seite): der laufende Titel steht im oberen Drittel
  function scrollTo(row, smooth) {
    const l = q.list;
    if (!l.clientHeight) return;
    const top = Math.max(0, row.offsetTop - l.clientHeight * 0.3);
    if (Math.abs(l.scrollTop - top) < 2) return;
    l.scrollTo({ top, behavior: smooth && !cfg.calm ? "smooth" : "auto" });
  }
  async function showCredits(u) {
    const my = ++token;
    const roles = await loadCredits(u);
    if (my !== token) return;
    q.credits.hidden = !roles;
    if (!roles) return q.credits.replaceChildren();
    const frag = document.createDocumentFragment();
    const h = document.createElement("b");
    h.textContent = t("alCredits");
    frag.append(h);
    for (const r of roles) {
      const row = document.createElement("div");
      const k = ROLE[r.role.toLowerCase()];
      row.innerHTML = "<span></span><span></span>";
      row.firstChild.textContent = k ? t(k) : r.role;
      row.lastChild.textContent = r.names.slice(0, 4).join(", ") + (r.names.length > 4 ? ` +${r.names.length - 4}` : "");
      frag.append(row);
    }
    q.credits.replaceChildren(frag);
  }
  // sichtbar oder nicht – der Wechsel selbst gleitet über layout() (FLIP in immersive.js)
  function apply(mode, animate) {
    if (!host) return;
    const on = mode === "cover" && !!album && want();
    if (on === shown) return;
    shown = on;
    const go = () => host.classList.toggle("has-album", on);
    if (!on && animate && panel.offsetWidth && !cfg.calm) {
      panel.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateX(18px)" }], { duration: 200, easing: "ease-in", fill: "forwards" }).finished.then(() => {
        if (!shown) layout(go, true);
        panel.getAnimations().forEach((a) => a.cancel());
      }, () => {});
      return;
    }
    layout(go, animate);
    if (on) {
      if (rows[cur]) scrollTo(rows[cur], false);
      if (animate && !cfg.calm) panel.animate([{ opacity: 0, transform: "translateX(24px)" }, { opacity: 1, transform: "none" }], { duration: 560, delay: 120, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "backwards" });
    }
  }
  // Song- oder Ansichtswechsel: Album laden (einmal je Album), Liste markieren
  async function sync(item, mode, animate) {
    const c = ctxUri();
    const next = c.startsWith("spotify:album:") ? c : "";
    if (next !== uri) {
      uri = next;
      album = null;
      rows = [];
      cur = -1;
      curUri = "";
      q.list.replaceChildren();
      q.credits.hidden = true;
      if (uri) {
        const want = uri, a = await loadAlbum(uri);
        if (want !== uri) return;
        album = a;
        if (album) render();
        // kam das Album erst später an, ist das ein eigener Wechsel: weich einblenden; die Ansicht kann sich
        // inzwischen geändert haben
        animate = true;
        mode = host?.dataset.mode;
        item = S.Player?.data?.item || item;
      }
    }
    mark(item, shown);
    apply(mode, animate);
  }
  // je Bild aus der Bildschleife: Fortschritt des laufenden Titels und die Restzeit (nur bei sichtbarer Änderung)
  function tick(pos, dur) {
    if (!shown || !album) return;
    if (prog) {
      const s = `scaleX(${dur ? Math.min(1, Math.max(0, pos / dur)).toFixed(3) : 0})`;
      if (s !== lastProg) prog.style.transform = lastProg = s;
    }
    let left = Math.max(0, (dur || 0) - pos);
    for (let k = Math.max(0, cur + 1); k < album.tracks.length; k++) left += album.tracks[k].ms;
    if (cur < 0) left = album.tracks.reduce((s, x) => s + x.ms, 0);
    const text = leftText(left);
    if (text !== lastLeft) q.left.textContent = lastLeft = text;
  }
  return {
    panel, sync, tick, toggle,
    // schmale Fenster zeigen keine Spalte (user.css) – dort auch kein Schalter
    canToggle: (mode) => mode === "cover" && !!album && innerWidth > 1000,
    get label() { return t(want() ? "alHide" : "alShow"); },
    get albumName() { return album?.name || ""; },
    attach: (h) => (host = h),
    get shown() { return shown; },
    // für die Tests
    get state() { return { uri, n: album?.tracks.length || 0, cur, shown }; },
  };
}

export { createAlbumView };
