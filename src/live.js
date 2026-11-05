import QRCode from "qrcode";
import { S } from "./core.js";
import { cfg } from "./config.js";
import { currentItem, titleOf, artistOf } from "./player.js";

/* ---------------------------------------------------------------- Live-Link: Handys leuchten mit */
// Über jedes Netz (WLAN, mobile Daten) und ohne Overlay-App: das Theme schickt den Lichtzustand an einen
// öffentlichen Relay (MQTT über WebSocket), Ende-zu-Ende verschlüsselt (AES-GCM). Kanal und Schlüssel sind
// zufällig und stehen nur im QR-Link hinter dem „#“ – dieser Teil verlässt das Handy nie (auch GitHub Pages
// sieht ihn nicht); ohne QR-Code kein Zugang, und weil GCM jede Nachricht prüft, kann auch niemand etwas
// unterschieben. Gesendet wird nur, solange der Party-Modus läuft; 10 Minuten danach verfällt der Schlüssel.

// Kleinstmöglicher MQTT-3.1.1-Client über WebSocket: verbinden, veröffentlichen, abonnieren, Ping.
// Mehrere öffentliche Relays: wer zuerst antwortet, wird benutzt; fällt einer aus, der nächste.
const BROKERS = ["wss://broker.hivemq.com:8884/mqtt", "wss://broker.emqx.io:8084/mqtt"];
const te = new TextEncoder();
const mqStr = (s) => {
  const b = te.encode(s);
  return [b.length >> 8, b.length & 255, ...b];
};
const mqLen = (n) => {
  const o = [];
  do {
    let d = n % 128;
    n = Math.floor(n / 128);
    if (n) d |= 128;
    o.push(d);
  } while (n);
  return o;
};
const mqPkt = (h, body) => new Uint8Array([h, ...mqLen(body.length), ...body]);
function mqttOpen(url, { onReady, onMessage, onClose }) {
  const ws = new WebSocket(url, "mqtt");
  ws.binaryType = "arraybuffer";
  let buf = new Uint8Array(0), ping = 0;
  ws.onopen = () => {
    const id = "mirage-" + Math.random().toString(36).slice(2, 12);
    ws.send(mqPkt(0x10, [...mqStr("MQTT"), 4, 2, 0, 60, ...mqStr(id)]));
  };
  ws.onmessage = (e) => {
    const add = new Uint8Array(e.data), nb = new Uint8Array(buf.length + add.length);
    nb.set(buf);
    nb.set(add, buf.length);
    buf = nb;
    // ein WebSocket-Rahmen kann mehrere oder halbe MQTT-Pakete enthalten
    for (;;) {
      if (buf.length < 2) break;
      let len = 0, mul = 1, i = 1, b;
      do {
        if (i >= buf.length) return;
        b = buf[i++];
        len += (b & 127) * mul;
        mul *= 128;
      } while (b & 128);
      if (buf.length < i + len) break;
      const type = buf[0] >> 4, body = buf.subarray(i, i + len);
      buf = buf.slice(i + len);
      if (type === 2 && body[1] === 0) {
        ping = setInterval(() => ws.readyState === 1 && ws.send(new Uint8Array([0xc0, 0])), 30000);
        onReady?.(api);
      } else if (type === 3) {
        const tl = (body[0] << 8) | body[1];
        onMessage?.(body.slice(2 + tl), new TextDecoder().decode(body.slice(2, 2 + tl)));
      }
    }
  };
  ws.onclose = ws.onerror = () => {
    clearInterval(ping);
    if (api.closed) return;
    api.closed = true;
    onClose?.();
  };
  const api = {
    closed: false,
    publish: (topic, payload, retain) => ws.readyState === 1 && ws.send(mqPkt(0x30 | (retain ? 1 : 0), [...mqStr(topic), ...payload])),
    subscribe: (topic) => ws.readyState === 1 && ws.send(mqPkt(0x82, [0, 1, ...mqStr(topic), 0])),
    close: () => {
      api.closed = true;
      clearInterval(ping);
      try {
        ws.send(new Uint8Array([0xe0, 0]));
        ws.close();
      } catch {}
    },
  };
  return api;
}

const PAGE = "https://passimoritz.github.io/spicetify-mirage/live/";

const GRACE = 10 * 60e3, RATE = 125;
const b64u = (u8) => btoa(String.fromCharCode(...u8)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
let ses = null, client = null, brokerIx = 0, status = "off", lastSend = 0, lastFeed = 0, offAt = 0, sending = false, stopT = 0, expireT = 0, wanted = false;
const emit = () => window.dispatchEvent(new Event("mirage:live"));
const setStatus = (s) => {
  if (s === status) return;
  status = s;
  setTimeout(emit);
};

// Abgelaufene Kanäle: die zuletzt behaltene Nachricht dort beim Relay löschen (leere „retained“-Nachricht),
// damit nichts liegen bleibt. Gemerkt im Speicher, falls Spotify vorher geschlossen wird.
const CLEAR = "mirage:liveClear";
const pending = () => {
  try {
    return JSON.parse(localStorage.getItem(CLEAR) || "[]").filter((x) => typeof x === "string").slice(-20);
  } catch {
    return [];
  }
};
const setPending = (list) => {
  try {
    localStorage.setItem(CLEAR, JSON.stringify(list));
  } catch {}
};
function flushClears(c) {
  const list = pending();
  if (!list.length) return;
  for (const topic of list) c.publish(topic, [], true);
  setPending([]);
}
function retire(old) {
  if (!old) return;
  setPending([...pending().filter((x) => x !== old.topic), old.topic]);
  if (client && status === "on") return flushClears(client);
  // keine Verbindung offen: kurz eine aufbauen, nur zum Löschen
  const c = mqttOpen(BROKERS[brokerIx % BROKERS.length], {
    onReady: (api) => {
      flushClears(api);
      setTimeout(() => api.close(), 400);
    },
  });
  setTimeout(() => c.closed || c.close(), 10000);
}

// Kanal und Schlüssel: bleiben, solange gefeiert wird (und 10 Minuten danach), sonst neu
async function prepare() {
  if (ses && (lastFeed || !offAt || Date.now() - offAt < GRACE)) return ses;
  clearTimeout(expireT);
  retire(ses);
  const raw = crypto.getRandomValues(new Uint8Array(16)), ch = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
  const url = `${PAGE}#c=${b64u(ch)}&k=${b64u(raw)}`;
  ses = { topic: "mirage-live/" + b64u(ch), key, url, qr: await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" }) };
  offAt = 0;
  wishes = [];
  emitWishes();
  emit();
  return ses;
}
function connect() {
  if (client && !client.closed) return;
  setStatus("connecting");
  client = mqttOpen(BROKERS[brokerIx % BROKERS.length], {
    onReady: (api) => {
      setStatus("on");
      flushClears(api);
      // Songwünsche und Stimmen der Handys kommen auf einem eigenen Unterkanal zurück
      if (ses) api.subscribe(ses.topic + "/in");
    },
    onMessage: (m, topic) => topic === ses?.topic + "/in" && inbound(m),
    onClose: () => {
      client = null;
      setStatus(wanted ? "connecting" : "off");
      // nächster Relay, kurz warten
      if (wanted) setTimeout(() => wanted && (brokerIx++, connect()), 3000);
    },
  });
}
async function send(state, retain) {
  if (!client || status !== "on" || !ses || sending) return;
  sending = true;
  try {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, ses.key, te.encode(JSON.stringify(state))));
    const out = new Uint8Array(12 + ct.length);
    out.set(iv);
    out.set(ct, 12);
    client.publish(ses.topic, out, retain);
  } catch {}
  sending = false;
}
/* ---------------------------------------------------------------- Songwünsche von den Handys */
// Gäste suchen auf dem Handy im echten Spotify-Katalog: jede Eingabe geht (verschlüsselt mit demselben Schlüssel
// wie alles andere – ohne QR-Code kein Zugang) an Mirage, Mirage fragt Spotify und schickt die Treffer mit Cover
// zurück, nur an dieses Handy. Gewünscht wird ein echter Spotify-Song (seine ID), den Mirage noch einmal bei
// Spotify prüft. Alle Handys sehen die Liste und stimmen ab; in die Warteschlange kommt nur, was du im
// Party-Modus annimmst. Pro Handy höchstens ein Wunsch alle 45 Sekunden, höchstens 8 offen.
let wishes = [];
const seen = new Map(), searching = new Map(), tracks = new Map();
const within = (p, ms) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error("timeout")), ms))]);
// Suche wie Spotify selbst: zuerst Spotifys Schnellsuche (GraphQL „searchModalResults“, Strg+K) – immer geladen,
// verzeiht Tippfehler, findet Teile von Titel und Interpret. Dann „searchTracks“ (nur da, wenn Spotify seine
// Suchseite schon geladen hat), zuletzt die Web-API (die Spotify oft mit 429 drosselt).
const SEARCH_VARS = (q) => ({ searchTerm: q, offset: 0, limit: 20, numberOfTopResults: 20, includeAudiobooks: false, includeArtistHasConcertsField: false, includePreReleases: false, includeAlbumPreReleases: false, includeAuthors: false, includeEpisodeContentRatingsV2: false });
const fromGql = (d) => ({
  id: d.uri.split(":")[2], uri: d.uri, name: d.name, is_playable: d.playability?.playable !== false,
  artists: (d.artists?.items || []).map((a) => ({ name: a?.profile?.name || "" })),
  album: { images: (d.albumOfTrack?.coverArt?.sources || []).map((x) => ({ url: x.url, width: x.width || 0 })) },
});
async function gqlTracks(name, q) {
  const def = S.GraphQL?.Definitions?.[name];
  if (!def || !S.GraphQL?.Request) return [];
  const r = await within(S.GraphQL.Request(def, SEARCH_VARS(q)), 4000);
  const sv = r?.data?.searchV2 || {};
  return [...(sv.topResultsV2?.itemsV2 || []), ...(sv.tracksV2?.items || [])].map((x) => x?.item?.data).filter((d) => d?.uri?.startsWith("spotify:track:")).map(fromGql);
}
async function searchSpotify(q) {
  for (const name of ["searchModalResults", "searchTracks"]) {
    try {
      const list = await gqlTracks(name, q);
      if (list.length) return list;
    } catch {}
  }
  const r = await within(S.CosmosAsync.get(`https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=8`), 4000);
  return r?.tracks?.items || [];
}
// je Handy höchstens eine Suche gleichzeitig; wer weitertippt, bekommt danach die Antwort auf die LETZTE Eingabe
async function runSearch(id) {
  const job = searching.get(id);
  if (!job || job.busy) return;
  job.busy = true;
  while (job.next) {
    const { q, r } = job.next;
    job.next = null;
    let res = [], err = 0;
    try {
      const seenName = new Set();
      res = (await searchSpotify(q)).map(remember).filter((x) => x && !seenName.has((x.t + "|" + x.a).toLowerCase()) && seenName.add((x.t + "|" + x.a).toLowerCase()));
      res = res.slice(0, 8).map(({ i, t, a, img }) => ({ i, t, a, img }));
    } catch {
      err = 1;
    }
    // immer antworten – auch ohne Treffer oder bei einem Fehler, sonst sucht das Handy ewig
    if (client && status === "on" && ses) client.publish(`${ses.topic}/r/${id}`, await seal({ v: 1, s: Date.now(), r, res, err }), false);
  }
  job.busy = false;
  if (searching.size > 50) for (const [k, j] of searching) if (!j.busy) searching.delete(k);
}
const ID = /^[A-Za-z0-9]{22}$/;
// kleinstes Cover ab 64 px (für die Liste auf dem Handy)
const coverOf = (tr) => {
  const imgs = [...(tr?.album?.images || [])].sort((a, b) => (a.width || 0) - (b.width || 0));
  return (imgs.find((x) => (x.width || 0) >= 64) || imgs[imgs.length - 1])?.url || "";
};
function remember(tr) {
  if (!tr?.id || !ID.test(tr.id) || tr.is_playable === false) return null;
  const x = { i: tr.id, uri: tr.uri || "spotify:track:" + tr.id, t: clean(tr.name, 80), a: clean((tr.artists || []).map((y) => y.name).join(", "), 60), img: /^https:\/\/i\.scdn\.co\//.test(coverOf(tr)) ? coverOf(tr) : "" };
  tracks.set(x.i, x);
  if (tracks.size > 300) tracks.delete(tracks.keys().next().value);
  return x;
}
async function seal(obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, ses.key, te.encode(JSON.stringify(obj))));
  const out = new Uint8Array(12 + ct.length);
  out.set(iv);
  out.set(ct, 12);
  return out;
}
const emitWishes = () => setTimeout(() => window.dispatchEvent(new Event("mirage:wishes")));
const clean = (v, n) => String(v ?? "").replace(/\p{Cc}/gu, " ").trim().slice(0, n);
// Gäste: wer hat was gewünscht (für das Ranking im Rückblick); Reaktionen und Abstimmung brauchen keine Wünsche
const guests = new Map(); // Handy-ID → { n, wished, played, votes }
const guest = (id, n) => {
  const g = guests.get(id) || { n: "", wished: 0, played: 0, votes: 0 };
  if (n) g.n = n;
  guests.set(id, g);
  return g;
};
const lastReact = new Map();
const REACTIONS = ["🔥", "❤️", "🙌", "😂", "🎉", "👏"];
async function inbound(m) {
  if (!ses || m.length < 29) return;
  let msg;
  try {
    msg = JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: m.slice(0, 12) }, ses.key, m.slice(12))));
  } catch {
    return;
  }
  const id = clean(msg?.id, 24);
  if (!/^[\w-]{6,24}$/.test(id) || Math.abs(Date.now() - Number(msg.s)) > 600e3 || msg.on != null) return;
  // Reaktion: höchstens eine pro 0,7 s je Handy, nur aus der festen Auswahl
  if (msg.k === "react") {
    if (!REACTIONS.includes(msg.e) || Date.now() - (lastReact.get(id) || 0) < 700) return;
    lastReact.set(id, Date.now());
    window.dispatchEvent(new CustomEvent("mirage:react", { detail: msg.e }));
    return;
  }
  // Abstimmung über die nächsten Songs: eine Stimme je Handy und Abstimmung
  if (msg.k === "pvote") {
    if (!poll || poll.id !== msg.p || Date.now() > poll.end || poll.by.has(id)) return;
    const o = Number(msg.o);
    if (!(o >= 0 && o < poll.o.length)) return;
    poll.by.add(id);
    poll.v[o]++;
    guest(id).votes++;
    window.dispatchEvent(new Event("mirage:poll"));
    return;
  }
  if (!cfg.partyWishes) return;
  if (msg.k === "vote") {
    const w = wishes.find((x) => x.i === clean(msg.w, 40));
    if (w && !w.v.has(id)) {
      w.v.add(id);
      emitWishes();
    }
    return;
  }
  // Suche: höchstens alle 0,6 s je Handy; die Treffer gehen nur an dieses Handy zurück
  if (msg.k === "search") {
    const q = clean(msg.q, 80);
    if (q.length < 2) return;
    if (!searching.has(id)) searching.set(id, { busy: false, next: null });
    searching.get(id).next = { q, r: Number(msg.r) || 0 };
    runSearch(id);
    return;
  }
  if (msg.k !== "wish") return;
  const tid = clean(msg.i, 22), name = clean(msg.n, 20);
  if (!ID.test(tid) || Date.now() - (seen.get(id) || 0) < 45e3) return;
  // nur echte Spotify-Songs: aus der Suche von eben, sonst noch einmal bei Spotify nachgesehen
  let tr = tracks.get(tid);
  if (!tr) {
    try {
      tr = remember(await S.CosmosAsync.get(`https://api.spotify.com/v1/tracks/${tid}`));
    } catch {}
  }
  if (!tr) return;
  seen.set(id, Date.now());
  const have = wishes.find((x) => x.uri === tr.uri);
  if (have) have.v.add(id);
  else {
    wishes.push({ ...tr, n: name, by: id, v: new Set([id]), st: "open", at: Date.now() });
    guest(id, name).wished++;
    // voll: der älteste Wunsch mit den wenigsten Stimmen fliegt raus
    const open = wishes.filter((x) => x.st === "open");
    if (open.length > 8) wishes = wishes.filter((x) => x !== open.sort((a, b) => a.v.size - b.v.size || a.at - b.at)[0]);
  }
  emitWishes();
}
const ranked = () => wishes.filter((w) => w.st === "open").sort((a, b) => b.v.size - a.v.size || a.at - b.at);
async function accept(i) {
  const w = wishes.find((x) => x.i === i);
  if (!w || w.st !== "open") return false;
  try {
    await S.addToQueue([{ uri: w.uri }]);
  } catch {
    return false;
  }
  w.st = "queued";
  if (w.by) guest(w.by, w.n).played++;
  emitWishes();
  // eine Weile als „angenommen“ auf den Handys sichtbar, dann aus der Liste
  setTimeout(() => {
    wishes = wishes.filter((x) => x !== w);
    emitWishes();
  }, 60e3);
  return true;
}
function decline(i) {
  wishes = wishes.filter((x) => x.i !== i);
  emitWishes();
}
const wishList = () => [...ranked(), ...wishes.filter((w) => w.st === "queued")].slice(0, 6).map((w) => ({ i: w.i, t: w.t, a: w.a, img: w.img, n: w.n, v: w.v.size, st: w.st }));

// kleines Cover für die Handykarte (Spotifys Bildserver); „spotify:image:…“ → https-Adresse
const coverUrl = (item) => {
  const m = item?.metadata || {}, raw = m.image_small_url || m.image_url || m.image_large_url || "";
  const id = String(raw).replace(/^spotify:image:/, "").replace(/^https:\/\/i\.scdn\.co\/image\//, "");
  return /^[\w]{20,60}$/.test(id) ? "https://i.scdn.co/image/" + id : "";
};

// jedes Bild im Party-Modus: höchstens 8 Nachrichten pro Sekunde; die Handyseite rechnet den Takt selbst weiter
let lastFx = null, poll = null;
// Abstimmung: die nächsten Songs zur Wahl, 45 s lang; danach entscheidet die Mehrheit
function startPoll(options) {
  poll = { id: Math.random().toString(36).slice(2, 10), o: options.slice(0, 3).map((x) => ({ t: x.t, a: x.a, img: x.img, uri: x.uri })), v: options.slice(0, 3).map(() => 0), end: Date.now() + 45000, by: new Set() };
  window.dispatchEvent(new Event("mirage:poll"));
  return poll;
}
const pollState = () => poll;
const nextUri = () => {
  const n = (S.Queue?.nextTracks || []).map((x) => x.contextTrack || x).find((x) => x?.uri?.startsWith("spotify:track:"));
  return n?.uri || "";
};
const ranking = () => [...guests.values()].filter((g) => g.n || g.wished || g.votes).sort((a, b) => b.played - a.played || b.wished - a.wished || b.votes - a.votes).slice(0, 10);
function fx(c, w) {
  lastFx = { c, w: String(w || "").slice(0, 40), s: Date.now() };
}
function feed(px, pal, bpm, lyric) {
  if (!cfg.partyLive) return;
  lastFeed = performance.now();
  wanted = true;
  clearTimeout(stopT);
  clearTimeout(expireT);
  stopT = setTimeout(stop, 2500);
  if (!ses) return void prepare();
  connect();
  if (lastFeed - lastSend < RATE) return;
  lastSend = lastFeed;
  const item = currentItem();
  send({
    v: 1, on: 1, s: Date.now(), bpm: Math.round(bpm || 120), bi: px.beatIdx, ph: +(px.phase || 0).toFixed(3),
    e: +px.energy.toFixed(2), k: +px.kickEnv.toFixed(2), d: +px.drop.toFixed(2), b: +px.build.toFixed(2),
    pal: (pal || []).slice(0, 3).map((c) => c.map((v) => Math.round(v))), t: titleOf(item) || "", a: artistOf(item) || "",
    img: coverUrl(item),
    // Liedtext zum Mitsingen: aktuelle und nächste Zeile
    ly: lyric?.ly || "", lyn: lyric?.lyn || "",
    w: cfg.partyWishes ? wishList() : null,
    // laufende Abstimmung, der nächste Song (für „dein Wunsch kommt gleich“)
    poll: poll && Date.now() < poll.end + 8000 ? { id: poll.id, o: poll.o, v: poll.v, end: poll.end } : null,
    nx: nextUri(),
    fx: lastFx && Date.now() - lastFx.s < 3000 ? lastFx : null,
  }, true);
}
// Party verlassen: „aus“ melden, Verbindung schließen; nach 10 Minuten gilt der Link nicht mehr
async function stop() {
  clearTimeout(stopT);
  if (!wanted) return;
  wanted = false;
  lastFeed = 0;
  offAt = Date.now();
  await send({ v: 1, on: 0, s: Date.now() }, true);
  setTimeout(() => {
    client?.close();
    client = null;
    setStatus("off");
  }, 400);
  // nach 10 Minuten: Schlüssel vergessen und die letzte Nachricht beim Relay löschen
  expireT = setTimeout(() => {
    if (wanted) return;
    retire(ses);
    ses = null;
    emit();
  }, GRACE);
}

export const live = { prepare, feed, stop, fx, startPoll, pollState, ranking, info: () => (ses ? { url: ses.url, qr: ses.qr } : null), status: () => status, wishes: wishList, accept, decline };
