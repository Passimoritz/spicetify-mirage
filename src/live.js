import QRCode from "qrcode";
import { S } from "./core.js";
import { cfg, save } from "./config.js";
import { t as tr } from "./i18n.js";
import { currentItem, titleOf, artistOf } from "./player.js";
import { PHOTO, createAssembler, createLimiter } from "./photos.js";

/* ---------------------------------------------------------------- Live-Link: Handys leuchten mit */
// Über jedes Netz (WLAN, mobile Daten) und ohne Overlay-App: das Theme schickt den Lichtzustand an einen
// öffentlichen Relay (MQTT über WebSocket), Ende-zu-Ende verschlüsselt (AES-GCM). Kanal und Schlüssel sind
// zufällig und stehen nur im QR-Link hinter dem „#“ – dieser Teil verlässt das Handy nie (auch GitHub Pages
// sieht ihn nicht). Gesendet wird nur, solange der Party-Modus läuft; 10 Minuten danach verfällt der Schlüssel.
//
// Was das garantiert – und was nicht:
//  - Lesen kann jeder, der den QR-Code hat (alle Gäste teilen sich den einen Kanalschlüssel), sonst niemand:
//    weder der Relay noch jemand ohne Link. Auch die Antworten an ein einzelnes Handy (Suchtreffer) kann jeder
//    Gast mitlesen, der es darauf anlegt.
//  - Als PC senden kann nur dieses Theme: der Relay hat keine Zugriffsregeln, und GCM allein hält nur Fremde ohne
//    Schlüssel ab, nicht die Gäste. Darum unterschreibt das Theme alles, was es an die Handys sendet (Lichtzustand,
//    „Party beendet“, jede Antwort), mit einem Schlüsselpaar, das je Party neu entsteht (ECDSA P-256). Der private
//    Schlüssel bleibt hier im Speicher und lässt sich nicht auslesen, der öffentliche steht als „p“ im Link. Die
//    Handyseite verwirft alles ohne gültige Unterschrift. Die Unterschrift gilt für genau ein Thema (Kanal, bei
//    Antworten samt Kennung des Handys); ältere, mitgeschnittene Stände nimmt die Seite nicht mehr an.
//  - Ein Gast kann weiterhin: Gast-Nachrichten unter jeder selbst gewählten Kennung senden (Wünsche, Stimmen,
//    Reaktionen, Spielantworten – also auch im Namen eines anderen Gastes oder vieler erfundener), den Relay mit
//    Unsinn fluten und die dort aufbewahrte letzte Nachricht überschreiben (neue Gäste warten dann, bis der nächste
//    echte Stand kommt). Befehle der Spielleitung und der Fernbedienung kann er nicht fälschen (eigene Schlüssel).
//  - Wer einen Link ohne „p“ weitergibt (oder ein älteres Theme benutzt), bekommt eine Seite, die nicht prüft.

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
/* ---- sign:begin (Gegenstück in docs/live/index.html; tests/unit/livesign.test.js führt beide Teile zusammen aus) */
// Unterschrift unter allem, was an die Handys geht. Unterschrieben wird „Thema, Zeilenumbruch, JSON-Text“; die
// Unterschrift (64 Bytes, 86 Zeichen) steht als erstes Feld „sg“ im selben JSON-Text. So bleibt die Nachricht für
// Handyseiten lesbar, die noch nichts davon wissen (ein Feld mehr), und die neue Seite prüft den Text, wie er ankam,
// statt ihn neu zusammenzusetzen.
const SG_ALG = { name: "ECDSA", hash: "SHA-256" }, SG_KEY = { name: "ECDSA", namedCurve: "P-256" }, SG_HEAD = '{"sg":"';
const sgB64 = (u8) => btoa(String.fromCharCode(...u8)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const sgData = (topic, body) => new TextEncoder().encode(topic + "\n" + body);
async function sgSign(key, topic, body) {
  const sig = new Uint8Array(await crypto.subtle.sign(SG_ALG, key, sgData(topic, body)));
  return SG_HEAD + sgB64(sig) + '",' + body.slice(1);
}
// öffentlicher Schlüssel für den Link, gepackt: 33 statt 65 Bytes (x und das Vorzeichen von y) – der QR-Code bleibt klein
const sgPack = (raw) => Uint8Array.of(2 + (raw[64] & 1), ...raw.subarray(1, 33));
// neues Schlüsselpaar: der private Teil lässt sich nicht auslesen (extractable: false)
async function sgNew() {
  const pair = await crypto.subtle.generateKey(SG_KEY, false, ["sign", "verify"]);
  return { key: pair.privateKey, pub: sgB64(sgPack(new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey)))) };
}
/* ---- sign:end */
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
  // Schlüsselpaar dieser Party: nur wer den privaten Teil hat (dieses Theme), kann als PC senden. Der öffentliche
  // steht als „p“ in jedem Link (Gäste, Spielleitung, Fernbedienung); ältere Handyseiten übergehen ihn.
  const sign = await sgNew();
  const url = `${PAGE}#c=${b64u(ch)}&k=${b64u(raw)}&p=${sign.pub}`;
  // Spielleitung: ein zweiter Zufallsschlüssel, nur im eigenen Link der Spielleitung. Er wird nie gesendet,
  // das Handy unterschreibt damit seine Befehle (HMAC), und nur passend unterschriebene gelten.
  const hraw = crypto.getRandomValues(new Uint8Array(16));
  const hostKey = await crypto.subtle.importKey("raw", hraw, { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  // Fernbedienung: ein dritter Schlüssel, nur in deinem eigenen Link (zusammen mit dem der Spielleitung) –
  // wer nur den Spiel-Link hat, kann die Musik nicht steuern
  const rraw = crypto.getRandomValues(new Uint8Array(16));
  const rcKey = await crypto.subtle.importKey("raw", rraw, { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  ses = { topic: "mirage-live/" + b64u(ch), key, sign: sign.key, url, qr: await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" }), hostKey, hostUrl: `${url}&h=${b64u(hraw)}`, hostQr: "", rcKey, rcUrl: `${url}&h=${b64u(hraw)}&r=${b64u(rraw)}`, rcQr: "" };
  hostSeen.clear();
  // neue Party, neuer Code: Rangliste, Sperren und die Abstimmung der letzten Party gehören nicht dazu
  guests.clear();
  seen.clear();
  refused.clear();
  lastGame.clear();
  lastRc.clear();
  lastReact.clear();
  poll = null;
  offAt = 0;
  wishes = [];
  emitWishes();
  clearPhotos();
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
    const s = ses;
    client?.publish(s.topic, await seal(s, s.topic, state), retain);
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
  id: d.uri.split(":")[2], uri: d.uri, name: d.name, is_playable: d.playability?.playable !== false, explicit: d.contentRating?.label === "EXPLICIT",
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
// Spotify-Link statt Suche: „open.spotify.com/track/…“ (auch „/intl-de/…“) oder „spotify:track:…“ wird direkt
// aufgelöst. Andere Spotify-Links (Album, Playlist, Kurzlink …) sind kein einzelner Song: freundlich ablehnen.
const TRACK_LINK = /(?:open\.spotify\.com\/(?:intl-[\w-]+\/)?track\/|spotify:track:)([A-Za-z0-9]{22})/;
const OTHER_LINK = /open\.spotify\.com\/|spotify:[a-z]+:|spotify\.link\/|spoti\.fi\//i;
// ein Song über seine ID: zuerst Spotifys eigene Abfrage (wird kaum gedrosselt), sonst die Web-API
async function trackById(id) {
  const def = S.GraphQL?.Definitions?.getTrack;
  if (def && S.GraphQL?.Request) {
    try {
      const d = (await within(S.GraphQL.Request(def, { uri: "spotify:track:" + id }), 4000))?.data?.trackUnion;
      if (d?.name) {
        const people = [...(d.firstArtist?.items || []), ...(d.otherArtists?.items || []), ...(d.artists?.items || [])];
        return fromGql({ ...d, uri: d.uri || "spotify:track:" + id, artists: { items: people } });
      }
    } catch {}
  }
  return within(S.CosmosAsync.get(`https://api.spotify.com/v1/tracks/${id}`), 4000);
}
// je Handy höchstens eine Suche gleichzeitig; wer weitertippt, bekommt danach die Antwort auf die LETZTE Eingabe
async function runSearch(id) {
  const job = searching.get(id);
  if (!job || job.busy) return;
  job.busy = true;
  while (job.next) {
    const { q, r } = job.next;
    job.next = null;
    let res = [], err = 0, nl, wr;
    try {
      const seenName = new Set(), link = TRACK_LINK.exec(q);
      // „nl“: ein Spotify-Link, aber kein Song (ältere Handyseiten zeigen dann einfach „nichts gefunden“)
      if (!link && OTHER_LINK.test(q)) nl = 1;
      else res = (link ? [await trackById(link[1])] : await searchSpotify(q)).map(remember).filter((x) => x && !seenName.has((x.t + "|" + x.a).toLowerCase()) && seenName.add((x.t + "|" + x.a).toLowerCase()));
      // Regeln der Gastgeberin: gesperrte und (auf Wunsch) „Explicit“-Songs erscheinen gar nicht erst
      // ein Link auf einen solchen Song: dem Gast sagen, warum (ältere Seiten zeigen „nichts gefunden“)
      if (link && res[0]) wr = ruleOut(res[0]) || undefined;
      res = res.filter((x) => !ruleOut(x)).slice(0, 8).map(({ i, t, a, img }) => ({ i, t, a, img }));
    } catch {
      err = 1;
    }
    // immer antworten – auch ohne Treffer oder bei einem Fehler, sonst sucht das Handy ewig
    await reply(id, { r, res, err, nl, wr });
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
  const x = { i: tr.id, uri: tr.uri || "spotify:track:" + tr.id, x: tr.explicit ? 1 : 0, t: clean(tr.name, 80), a: clean((tr.artists || []).map((y) => y.name).join(", "), 60), img: /^https:\/\/i\.scdn\.co\//.test(coverOf(tr)) ? coverOf(tr) : "" };
  tracks.set(x.i, x);
  if (tracks.size > 300) tracks.delete(tracks.keys().next().value);
  return x;
}
// unterschreiben (für genau dieses Thema), dann verschlüsseln: 12 Byte IV, danach der AES-GCM-Text
async function seal(s, topic, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, s.key, te.encode(await sgSign(s.sign, topic, JSON.stringify(obj)))));
  const out = new Uint8Array(12 + ct.length);
  out.set(iv);
  out.set(ct, 12);
  return out;
}
const emitWishes = () => setTimeout(() => window.dispatchEvent(new Event("mirage:wishes")));
// Antwort nur an ein Handy. Immer mit „res“: ältere Seiten behandeln sie dann als (fremde) Suchantwort
// und ignorieren sie, statt sie für einen Lichtzustand ohne „on“ zu halten (= „Party beendet“)
async function reply(id, obj) {
  const s = ses;
  if (!client || status !== "on" || !s) return;
  const topic = `${s.topic}/r/${id}`, out = await seal(s, topic, { v: 1, s: Date.now(), res: [], ...obj });
  client?.publish(topic, out, false);
}
/* ---- Regeln für Songwünsche (Einstellungen im Party-Modus) */
// Sperrliste: Künstler oder Wörter, mit Komma oder Zeilenumbruch getrennt, ohne Groß/klein
const blockList = () => String(cfg.wishBlock || "").toLowerCase().split(/[,;\n]/).map((x) => x.trim()).filter((x) => x.length >= 2).slice(0, 60);
function ruleOut(tr) {
  const hay = (tr.t + " " + tr.a).toLowerCase();
  if (blockList().some((w) => hay.includes(w))) return "block";
  if (cfg.wishClean && tr.x) return "explicit";
  return "";
}
// Wunsch reicht genug Stimmen: von selbst in die Warteschlange (aus, solange „wishAuto“ 0 ist)
function autoAdd(w) {
  if (!(cfg.wishAuto > 0) || w.st !== "open" || w.auto || w.v.size < cfg.wishAuto) return;
  w.auto = true;
  accept(w.i).then((ok) => ok || (w.auto = false));
}
const clean = (v, n) => String(v ?? "").replace(/\p{Cc}/gu, " ").trim().slice(0, n);
// Gäste: wer hat was gewünscht (für das Ranking im Rückblick); Reaktionen und Abstimmung brauchen keine Wünsche
const guests = new Map(); // Handy-ID → { n, wished, played, votes }
const guest = (id, n, c) => {
  const g = guests.get(id) || { n: "", c: null, wished: 0, played: 0, votes: 0 };
  if (n) g.n = n;
  if (c != null) g.c = c;
  guests.set(id, g);
  return g;
};
// Farbe eines Gastes: eine Nummer aus der festen Palette (dieselbe auf dem Handy), sonst keine
const colour = (v) => (Number.isInteger(v) && v >= 0 && v < 10 ? v : null);
/* ---- Spielleitung am Handy */
// Jeder Gast kennt den Kanalschlüssel, aber nur das Handy mit dem Link der Spielleitung kennt deren Schlüssel.
// Ein Befehl gilt, wenn seine Unterschrift stimmt, er frisch ist und noch nicht da war (mitgelesene Befehle
// lassen sich so weder fälschen noch ein zweites Mal abspielen).
const hostSeen = new Map(), lastHost = new Map();
const unB64u = (s) => Uint8Array.from(atob(String(s).replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
// Unterschrift, Frische und Einmaligkeit prüfen – für Spielleitung und Fernbedienung, je mit eigenem Schlüssel
async function signed(id, msg, key) {
  if (!key || typeof msg.hd !== "string" || msg.hd.length > 160 || typeof msg.sig !== "string" || msg.sig.length > 64) return null;
  let good = false;
  try {
    good = await crypto.subtle.verify("HMAC", key, unB64u(msg.sig), te.encode(msg.hd));
  } catch {}
  if (!good) return null;
  const [from, a, t, v, at, nonce] = msg.hd.split("|");
  if (from !== id || !nonce || Math.abs(Date.now() - Number(at)) > 600e3 || hostSeen.has(nonce)) return null;
  hostSeen.set(nonce, Date.now());
  for (const [k, when] of hostSeen) if (Date.now() - when > 1300e3) hostSeen.delete(k);
  return { a: clean(a, 8), t: clean(t, 24), v: Number(v) || 0 };
}
async function hostCommand(id, msg) {
  const c = await signed(id, msg, ses?.hostKey);
  if (c) window.dispatchEvent(new CustomEvent("mirage:host", { detail: c }));
}
/* ---- Fernbedienung für dich: Wiedergabe, Lautstärke, Stärke, Location, Spiele */
// dieselben Locations wie in den Einstellungen
const VENUES = ["auto", "club", "warehouse", "cellar", "jazzbar", "pub", "neon", "rooftop", "festival", "forest", "desert", "stadium", "beach", "skihut", "space", "cathedral", "hall", "home"];
const playing = () => {
  try {
    return !!S.Player.isPlaying();
  } catch {
    return false;
  }
};
// Stand für die Fernbedienung, Beschriftungen in deiner Sprache am PC (sie bedient ja nur du)
const rcState = () => ({
  pl: playing() ? 1 : 0, vol: Math.round((Number(S.Player.getVolume?.()) || 0) * 100), lv: cfg.partyLevel ?? 2, vn: cfg.partyVenue || "auto",
  lvs: [1, 2, 3, 4, 5].map((n) => tr("partyLevel" + n)), vns: VENUES.map((k) => [k, tr("venue_" + k)]),
});
async function remoteCommand(id, msg) {
  const c = await signed(id, msg, ses?.rcKey);
  if (!c) return;
  try {
    if (c.a === "play") S.Player.togglePlay();
    else if (c.a === "next") S.Player.next();
    else if (c.a === "prev") S.Player.back();
    else if (c.a === "vol") S.Player.setVolume(Math.max(0, Math.min(100, c.v)) / 100);
    else if (c.a === "lvl" && c.v >= 1 && c.v <= 5) {
      cfg.partyLevel = Math.round(c.v);
      save();
    } else if (c.a === "loc" && VENUES.includes(c.t)) {
      cfg.partyVenue = c.t;
      save();
    } else if (c.a === "game") window.dispatchEvent(new CustomEvent("mirage:host", { detail: { a: "open", t: c.t, v: 0 } }));
  } catch {}
  // gleich antworten, und nach dem Wechsel noch einmal (Wiedergabe und Lautstärke brauchen einen Moment)
  reply(id, { r: -1, rcs: rcState() });
  setTimeout(() => reply(id, { r: -1, rcs: rcState() }), 700);
}
async function remoteInfo() {
  const s = await prepare();
  if (!s.rcQr) s.rcQr = await QRCode.toString(s.rcUrl, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
  return { url: s.rcUrl, qr: s.rcQr };
}
async function hostInfo() {
  const s = await prepare();
  if (!s.hostQr) s.hostQr = await QRCode.toString(s.hostUrl, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
  return { url: s.hostUrl, qr: s.hostQr };
}
const lastReact = new Map(), lastGame = new Map(), refused = new Map(), lastRc = new Map();
/* ---- Reaktionen der Gäste: Herz, Feuer, Applaus, Wow */
// Je Handy höchstens eine Reaktion alle 0,7 s. Alle Taps eines Augenblicks (0,35 s, danach höchstens alle 0,6 s)
// werden zu EINER Welle zusammengefasst: viele Gäste = eine größere Welle, nie ein Regen einzelner Zeichen.
// Die Location (stagefx.js) zeichnet sie als Lichtzeichen aus der Menge. Abschaltbar („Reaktionen der Gäste“).
const REACT_KINDS = ["heart", "fire", "clap", "wow"];
// ältere Handyseiten schicken ein Emoji-Zeichen statt der Art
const OLD_REACT = { "\u2764\ufe0f": "heart", "\ud83d\udd25": "fire", "\ud83d\ude4c": "clap", "\ud83d\udc4f": "clap", "\ud83c\udf89": "wow", "\ud83d\ude02": "wow" };
const rx = { pool: null, waves: [], seq: 0, last: 0 };
function reactIn(id, kind) {
  if (!rx.pool) {
    rx.pool = { n: 0, by: new Set(), k: { heart: 0, fire: 0, clap: 0, wow: 0 } };
    setTimeout(flushReacts, Math.max(350, 600 - (Date.now() - rx.last)));
  }
  rx.pool.n++;
  rx.pool.k[kind]++;
  rx.pool.by.add(id);
}
function flushReacts() {
  const p = rx.pool;
  rx.pool = null;
  rx.last = Date.now();
  if (!p || !cfg.partyReacts) return;
  const top = REACT_KINDS.reduce((a, b) => (p.k[b] > p.k[a] ? b : a));
  rx.waves.push({ id: ++rx.seq, at: rx.last, n: p.n, g: p.by.size, k: p.k, top, sent: false });
  if (rx.waves.length > 6) rx.waves.shift();
}
// pro Bild der Location (immersive.js): die Wellen der letzten 4 s; neu übergebene melden sich einmal
// („mirage:reactwave“, für die Tests und alles, was mitzählen will)
function reactFrame() {
  if (!rx.waves.length) return null;
  const now = Date.now();
  rx.waves = rx.waves.filter((w) => now - w.at < 4000);
  for (const w of rx.waves)
    if (!w.sent) {
      w.sent = true;
      window.dispatchEvent(new CustomEvent("mirage:reactwave", { detail: { n: w.n, g: w.g, top: w.top, k: { ...w.k } } }));
    }
  return rx.waves.length ? rx.waves.map((w) => ({ id: w.id, n: w.n, k: w.k, age: (now - w.at) / 1000 })) : null;
}
async function inbound(m) {
  if (!ses || m.length < 29) return;
  let msg;
  try {
    msg = JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: m.slice(0, 12) }, ses.key, m.slice(12))));
  } catch {
    return;
  }
  const id = clean(msg?.id, 24);
  if (!/^[\w-]{6,24}$/.test(id) || !(Math.abs(Date.now() - Number(msg.s)) <= 600e3) || msg.on != null) return;
  // Spiele: Antworten und Tipps der Handys (höchstens 10 je Sekunde und Handy)
  if (msg.k === "gm") {
    if (Date.now() - (lastGame.get(id) || 0) < 100) return;
    lastGame.set(id, Date.now());
    window.dispatchEvent(new CustomEvent("mirage:game", { detail: { id, n: clean(msg.n, 20), c: colour(msg.c), a: clean(msg.a, 8), v: msg.v, r: msg.r, ms: msg.ms } }));
    return;
  }
  // Befehle der Spielleitung: höchstens 20 je Sekunde und Handy, geprüft wird die Unterschrift
  if (msg.k === "host") {
    if (Date.now() - (lastHost.get(id) || 0) < 50) return;
    lastHost.set(id, Date.now());
    return void hostCommand(id, msg);
  }
  // Fernbedienung: im Schnitt höchstens 10 je Sekunde (kurze Folgen schneller Tipps gehen durch, auch mit den
  // Wiederholungen von sendSure), nur mit der Unterschrift aus deinem eigenen Link
  if (msg.k === "rc") {
    const b = lastRc.get(id) || { n: 8, at: 0 }, n = Math.min(8, b.n + (Date.now() - b.at) / 100);
    if (n < 1) return;
    lastRc.set(id, { n: n - 1, at: Date.now() });
    if (lastRc.size > 50) lastRc.delete(lastRc.keys().next().value);
    return void remoteCommand(id, msg);
  }
  // Reaktion: nur aus der festen Auswahl, höchstens eine pro 0,7 s je Handy; gesammelt zu Wellen (reactIn)
  if (msg.k === "react") {
    const kind = REACT_KINDS.includes(msg.r) ? msg.r : OLD_REACT[msg.e];
    if (!cfg.partyReacts || !kind || Date.now() - (lastReact.get(id) || 0) < 700) return;
    lastReact.set(id, Date.now());
    if (lastReact.size > 300) lastReact.delete(lastReact.keys().next().value);
    reactIn(id, kind);
    return;
  }
  // Foto-Wand: Stücke eines Fotos (zusammengesetzt und geprüft in photos.js)
  if (msg.k === "photo") return void photoIn(id, msg);
  // Abstimmung über die nächsten Songs: eine Stimme je Handy und Abstimmung
  if (msg.k === "pvote") {
    if (!poll || poll.id !== msg.p || Date.now() > poll.end || poll.by.has(id)) return;
    const o = Number(msg.o);
    // nur ganze Zahlen: 0.5 hätte das Handy als „hat gestimmt“ gemerkt, die Stimme aber nirgends gezählt
    if (!Number.isInteger(o) || !(o >= 0 && o < poll.o.length)) return;
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
      autoAdd(w);
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
  if (!ID.test(tid)) return;
  // zu viele offene Wünsche: gleich sagen (noch vor der 45-s-Sperre, sonst bliebe es still); eine Stimme
  // für einen schon offenen Wunsch geht immer. Antworten höchstens alle 2 s je Handy.
  const mine = wishes.filter((x) => x.by === id && x.st === "open").length;
  if (cfg.wishMax > 0 && mine >= cfg.wishMax && !wishes.some((x) => x.i === tid && x.st === "open")) {
    if (Date.now() - (refused.get(id) || 0) > 2000) {
      refused.set(id, Date.now());
      reply(id, { r: -1, wr: "max", n: cfg.wishMax });
    }
    return;
  }
  const before = seen.get(id) || 0;
  if (Date.now() - before < 45e3) return;
  // die Sperre gilt ab jetzt, nicht erst nach der Nachfrage bei Spotify: sonst kämen mehrere Wünsche desselben
  // Handys durch, solange die erste Nachfrage noch läuft. Wird nichts daraus, gilt wieder der alte Stand.
  seen.set(id, Date.now());
  const undo = () => (before ? seen.set(id, before) : seen.delete(id));
  // nur echte Spotify-Songs: aus der Suche von eben, sonst noch einmal bei Spotify nachgesehen
  let tr = tracks.get(tid);
  if (!tr) {
    try {
      tr = remember(await trackById(tid));
    } catch {}
  }
  if (!tr) return void undo();
  const have = wishes.find((x) => x.uri === tr.uri);
  // Regeln: gesperrt oder „Explicit“ (die Suche zeigt solche Songs gar nicht erst, ein Link schon)
  const why = ruleOut(tr);
  if (why) return void (undo(), reply(id, { r: -1, wr: why }));
  if (have) {
    have.v.add(id);
    autoAdd(have);
  } else {
    wishes.push({ ...tr, n: name, c: colour(msg.c), by: id, v: new Set([id]), st: "open", at: Date.now() });
    guest(id, name, colour(msg.c)).wished++;
    // voll: der älteste Wunsch mit den wenigsten Stimmen fliegt raus
    const open = wishes.filter((x) => x.st === "open");
    if (open.length > 8) wishes = wishes.filter((x) => x !== open.sort((a, b) => a.v.size - b.v.size || a.at - b.at)[0]);
    autoAdd(wishes[wishes.length - 1]);
  }
  emitWishes();
}
/* ---- Foto-Wand: Fotos der Gäste, erst nach deiner Freigabe auf dem großen Bild */
// Nur im Speicher (blob:-Adressen), nie auf der Platte, in localStorage oder IndexedDB; mit der Party ist alles
// weg. Fremde Bytes werden nur in einem <img> aus einer blob:-Adresse entschlüsselt, nie anders angefasst.
let photos = []; // { p, by, n, c, url, at, st: "wait" | "ok" }
const asm = createAssembler(), lim = createLimiter(), phoSaid = new Map();
const PHO_ID = /^[\w-]{6,16}$/;
const emitPhotos = () => setTimeout(() => window.dispatchEvent(new Event("mirage:photos")));
// Antwort an das Handy, gleich zweimal (Antworten gehen ohne Wiederholung über den Relay); die Kopien von
// sendSure bekommen nicht jedes Mal eine – höchstens alle 1,5 s je Stand
function phoTell(id, p, st, extra = {}) {
  const k = id + "|" + p, last = phoSaid.get(k);
  if (last && last.st === st && Date.now() - last.at < 1500) return;
  phoSaid.set(k, { st, at: Date.now(), extra });
  if (phoSaid.size > 200) phoSaid.delete(phoSaid.keys().next().value);
  const msg = { r: -1, pho: { p, st, ...extra } };
  reply(id, msg);
  setTimeout(() => phoSaid.get(k)?.st === st && reply(id, msg), 700);
}
// Probe im <img>: lässt es sich als Bild lesen und hält es die Größe ein?
const fits = (url) => new Promise((ok) => {
  const im = new Image();
  im.onload = () => ok(im.naturalWidth > 0 && im.naturalHeight > 0 && Math.max(im.naturalWidth, im.naturalHeight) <= PHOTO.SIDE + 8);
  im.onerror = () => ok(false);
  setTimeout(() => ok(false), 5000);
  im.src = url;
});
const waiting = () => photos.filter((x) => x.st === "wait").length;
async function photoIn(id, msg) {
  const p = clean(msg.p, 16);
  if (!PHO_ID.test(p)) return;
  if (!cfg.partyPhotos) return phoTell(id, p, "off");
  const r = await asm.add(id, msg);
  if (r.st === "bad") return phoTell(id, p, "bad");
  // schon fertig (die Bestätigung ging verloren, das Handy schickt noch einmal): letzten Stand wiederholen
  if (r.st === "dup") {
    const s = phoSaid.get(id + "|" + p);
    if (s) phoTell(id, p, s.st, s.extra);
    return;
  }
  // neuer Satz oder fertig: Grenzen prüfen, sonst gar nicht erst weitersammeln
  if (r.first || r.st === "done") {
    const c = lim.check(id, waiting());
    if (c.st !== "go") {
      asm.drop(id, p);
      return phoTell(id, p, c.st, c.w ? { w: c.w } : c.n ? { n: c.n } : {});
    }
  }
  if (r.st !== "done") return;
  const url = URL.createObjectURL(new Blob([r.bytes], { type: "image/jpeg" }));
  if (!(await fits(url)) || !cfg.partyPhotos || !ses) {
    URL.revokeObjectURL(url);
    return phoTell(id, p, cfg.partyPhotos ? "bad" : "off");
  }
  lim.take(id);
  photos.push({ p, by: id, n: clean(msg.nm, 20), c: colour(msg.c), url, at: Date.now(), st: "wait" });
  phoTell(id, p, "wait");
  emitPhotos();
}
function approvePhoto(p) {
  const x = photos.find((y) => y.p === p && y.st === "wait");
  if (!x) return false;
  x.st = "ok";
  x.at = Date.now();
  phoTell(x.by, p, "ok");
  // Galerie voll: das älteste freigegebene Foto fällt raus
  const ok = photos.filter((y) => y.st === "ok");
  if (ok.length > PHOTO.GALLERY) dropPhoto(ok[0]);
  emitPhotos();
  window.dispatchEvent(new CustomEvent("mirage:photoshow", { detail: { p, url: x.url, n: x.n, c: x.c } }));
  return true;
}
function dropPhoto(x) {
  photos = photos.filter((y) => y !== x);
  URL.revokeObjectURL(x.url);
}
function rejectPhoto(p) {
  const x = photos.find((y) => y.p === p);
  if (!x) return;
  dropPhoto(x);
  phoTell(x.by, p, "no");
  emitPhotos();
}
// Party vorbei oder Foto-Wand aus: alles vergessen
function clearPhotos() {
  for (const x of photos) URL.revokeObjectURL(x.url);
  photos = [];
  asm.clear();
  lim.clear();
  phoSaid.clear();
  emitPhotos();
}
const photoList = () => photos.map(({ p, n, c, url, st, at }) => ({ p, n, c, url, st, at }));

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
const wishList = () => [...ranked(), ...wishes.filter((w) => w.st === "queued")].slice(0, 6).map((w) => ({ i: w.i, t: w.t, a: w.a, img: w.img, n: w.n, c: w.c ?? undefined, v: w.v.size, st: w.st }));

// kleines Cover für die Handykarte (Spotifys Bildserver); „spotify:image:…“ → https-Adresse
const coverUrl = (item) => {
  const m = item?.metadata || {}, raw = m.image_small_url || m.image_url || m.image_large_url || "";
  const id = String(raw).replace(/^spotify:image:/, "").replace(/^https:\/\/i\.scdn\.co\/image\//, "");
  return /^[\w]{20,60}$/.test(id) ? "https://i.scdn.co/image/" + id : "";
};

// jedes Bild im Party-Modus: höchstens 8 Nachrichten pro Sekunde; die Handyseite rechnet den Takt selbst weiter
let lastFx = null, poll = null, game = null, masked = "";
// Spielstand für die Handys; „mask“ verdeckt, was die Lösung verraten würde (Titel, Cover, Liedtext)
const setGame = (g) => (game = g);
const mask = (m) => (masked = m || "");
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
  // „Keine Blitze“ gilt auch für die Handys: „nf“ schaltet dort Blitz, Schockring und lange Drop-Vibration ab.
  // Ältere Handyseiten kennen „nf“ nicht und blitzen bei d > 0,85 – darum bleibt d dann auf 0,85 gedeckelt.
  const nf = cfg.noFlash ? 1 : 0;
  send({
    v: 1, on: 1, s: Date.now(), bpm: Math.round(bpm || 120), bi: px.beatIdx, ph: +(px.phase || 0).toFixed(3),
    e: +px.energy.toFixed(2), k: +px.kickEnv.toFixed(2), d: +(nf ? Math.min(px.drop, 0.85) : px.drop).toFixed(2), nf, b: +px.build.toFixed(2),
    pal: (pal || []).slice(0, 3).map((c) => c.map((v) => Math.round(v))), t: masked === "all" ? "?" : titleOf(item) || "", a: masked === "all" ? "" : artistOf(item) || "",
    img: masked === "all" ? "" : coverUrl(item),
    // Liedtext zum Mitsingen: aktuelle und nächste Zeile
    ly: masked ? "" : lyric?.ly || "", lyn: masked ? "" : lyric?.lyn || "",
    g: game,
    // ein angenommener Wunsch wäre im verdeckten Quiz die Lösung
    w: cfg.partyWishes ? wishList().filter((w) => masked !== "all" || w.st !== "queued") : null,
    // laufende Abstimmung, der nächste Song (für „dein Wunsch kommt gleich“)
    poll: poll && Date.now() < poll.end + 8000 ? { id: poll.id, o: poll.o, v: poll.v, end: poll.end } : null,
    nx: masked ? "" : nextUri(),
    // Reaktionen aus: die Handys blenden ihre Emoji-Leiste aus (ältere Seiten zeigen sie weiter, es kommt nur nichts an)
    rx: cfg.partyReacts ? 1 : 0,
    // Lichtwelle: Art (0 aus, 1 der Reihe nach, 2 Farbgruppen) und Zahl der Plätze; ältere Seiten leuchten alle zugleich
    wv: cfg.partyWave || 0, wn: 8,
    // Foto-Wand an: die Handys zeigen den Foto-Knopf (ältere Themes senden „pw“ nicht – dann bleibt er weg)
    pw: cfg.partyPhotos ? 1 : 0,
    fx: !masked && lastFx && Date.now() - lastFx.s < 3000 ? lastFx : null,
  }, true);
}
// Party verlassen: „aus“ melden, Verbindung schließen; nach 10 Minuten gilt der Link nicht mehr
async function stop() {
  clearTimeout(stopT);
  if (!wanted) return;
  wanted = false;
  lastFeed = 0;
  offAt = Date.now();
  // Fotos überleben die Party nicht
  clearPhotos();
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

export const live = { prepare, feed, stop, fx, reactFrame, setGame, mask, startPoll, pollState, ranking, info: () => (ses ? { url: ses.url, qr: ses.qr } : null), hostInfo, remoteInfo, status: () => status, wishes: wishList, accept, decline, photos: photoList, approvePhoto, rejectPhoto, clearPhotos };
