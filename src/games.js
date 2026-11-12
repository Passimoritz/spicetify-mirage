/* ---------------------------------------------------------------- Party-Spiele */
// Zwanzig Spiele für den Party-Modus. Der PC führt Regie und zeigt alles groß, die Handys der Gäste sind die
// Controller (verschlüsselt über den Live-Link, wie die Songwünsche). Die Songs kommen aus der Spotify-
// Warteschlange, die Zeilen aus dem zeitgenauen Liedtext des laufenden Songs.
// Musik-Quiz:      Wer singt hier? · Wie heißt der Song? · Intro-Blitz · Liedtext-Lücken · Nächste Zeile · Echt oder Fake? · Beat-Treffer
// Schnelle Finger: Musik-Stopp · Schnellster Finger · Tipp-Rennen · Tanz-Battle · Heiße Kartoffel
// Party:           Wer würde am ehesten …? · Sing weiter · Glücksrad (braucht keine Handys)
// Trinkspiele:     Ich hab noch nie · Schluck-Quiz · Wort-Alarm · Wer würde (Schluck-Ausgabe) · Schluck-Rad
import { S, seek } from "./core.js";
import { cfg } from "./config.js";
import { t } from "./i18n.js";
import { live } from "./live.js";
import { audio } from "./audio.js";
import { lock } from "./lock.js";
import { sfx } from "./sfx.js";
import { readVolume, writeVolume } from "./player.js";

export const GAME_LIST = [
  { k: "quiz", cat: "gCatMusic", label: "gQuiz", hint: "gQuizHint", icon: "🎤" },
  { k: "title", cat: "gCatMusic", label: "gTitleQ", hint: "gTitleQHint", icon: "🎵" },
  { k: "intro", cat: "gCatMusic", label: "gIntro", hint: "gIntroHint", icon: "⏱️" },
  { k: "gap", cat: "gCatMusic", label: "gGap", hint: "gGapHint", icon: "✏️" },
  { k: "next", cat: "gCatMusic", label: "gNext", hint: "gNextHint", icon: "📜" },
  { k: "tf", cat: "gCatMusic", label: "gTf", hint: "gTfHint", icon: "🕵️" },
  { k: "beat", cat: "gCatMusic", label: "gBeat", hint: "gBeatHint", icon: "🥁" },
  { k: "stop", cat: "gCatQuick", label: "gStop", hint: "gStopHint", icon: "✋" },
  { k: "fast", cat: "gCatQuick", label: "gFast", hint: "gFastHint", icon: "⚡" },
  { k: "taps", cat: "gCatQuick", label: "gTaps", hint: "gTapsHint", icon: "👆" },
  { k: "battle", cat: "gCatQuick", label: "gBattle", hint: "gBattleHint", icon: "💃" },
  { k: "bomb", cat: "gCatQuick", label: "gBomb", hint: "gBombHint", icon: "💣" },
  { k: "likely", cat: "gCatParty", label: "gLikely", hint: "gLikelyHint", icon: "🤔" },
  { k: "sing", cat: "gCatParty", label: "gSing", hint: "gSingHint", icon: "🎙️" },
  { k: "wheel", cat: "gCatParty", label: "gWheel", hint: "gWheelHint", icon: "🎡" },
  { k: "never", cat: "gCatDrink", label: "gNever", hint: "gNeverHint", icon: "🙈" },
  { k: "dquiz", cat: "gCatDrink", label: "gDquiz", hint: "gDquizHint", icon: "🍻" },
  { k: "alarm", cat: "gCatDrink", label: "gAlarm", hint: "gAlarmHint", icon: "🚨" },
  { k: "dlikely", cat: "gCatDrink", label: "gDlikely", hint: "gDlikelyHint", icon: "👉" },
  { k: "dwheel", cat: "gCatDrink", label: "gDwheel", hint: "gDwheelHint", icon: "🍀" },
];
const INFO = Object.fromEntries(GAME_LIST.map((g) => [g.k, g]));
export const WHEEL_FIELDS = ["wh1", "wh2", "wh3", "wh4", "wh5", "wh6", "wh7", "wh8"];
const DRINK_FIELDS = ["gD1", "gD2", "gD3", "gD4", "gD5", "gD6", "gD7", "gD8"];
export const WHEELS = new Set(["wheel", "dwheel"]);
// So viele müssen mitmachen, damit das Spiel Sinn ergibt (Quiz geht auch nur für den Raum).
// Wer gegen sich selbst spielen kann, braucht nur ein Handy
const MIN = { stop: 2, battle: 2, bomb: 2, likely: 2, dlikely: 2, fast: 1, beat: 1, taps: 1, never: 1 };
// Spiele mit Antwort-Kacheln, und die davon, die enden dürfen, sobald alle geantwortet haben
const ASK_GAMES = new Set(["quiz", "dquiz", "title", "intro", "gap", "next", "tf", "likely", "dlikely", "never"]);
const EARLY_END = new Set(["quiz", "dquiz", "title", "intro", "tf", "likely", "dlikely", "never"]);
// Diese Spiele führen die Musik: solange sie laufen, ist die Wiedergabe für alle anderen gesperrt
const MUSIC_GAMES = new Set(["quiz", "dquiz", "title", "intro", "gap", "next", "tf", "beat", "stop", "alarm", "sing"]);
const LINE_GAMES = new Set(["gap", "next", "tf"]);
const SONG_FIELD = { quiz: "artist", dquiz: "artist", title: "title", intro: "title" };
const OUT_GAMES = new Set(["stop", "bomb"]);
const TILES = ["A", "B", "C", "D", "E", "F"];

const rounds = () => Number(cfg.gameRounds) || 5;
const askMs = () => (Number(cfg.gameAsk) || 20) * 1000;
const joinMs = () => (Number(cfg.gameJoin) || 120) * 1000;
const clipMs = () => (cfg.gameClip === 0 ? 0 : (Number(cfg.gameClip) || 12) * 1000);
const durMs = () => (Number(cfg.gameDur) || 30) * 1000;
const breakMs = () => (Number(cfg.gameBreak) || 8) * 1000;

let ctx = null, G = null, box = null, ticker = 0, boxKey = "";

const shuffle = (a) => {
  const x = a.slice();
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
};
const clean = (s, n) => String(s ?? "").replace(/\p{Cc}/gu, "").trim().slice(0, n);
const notify = (msg, err) => S.showNotification?.(msg, !!err, 4000);
const coverOf = (m) => {
  const id = String(m?.image_url || m?.image_large_url || m?.image_small_url || "").replace(/^spotify:image:/, "").replace(/^https:[/][/]i[.]scdn[.]co[/]image[/]/, "");
  return /^[A-Za-z0-9]{20,60}$/.test(id) ? "https://i.scdn.co/image/" + id : "";
};
// „Song - Remastered 2011“, „Song (feat. X)“ → „Song“: die Zusätze würden die Lösung verraten oder verwirren
const cleanTitle = (s) => String(s || "").replace(/\s+-\s+.*(remaster|version|edit|live|mix|mono|stereo).*$/i, "").replace(/\s*[([](feat|ft|with|remaster|live)[^)\]]*[)\]]/gi, "").trim();
const songOf = (x) => ({
  uri: x?.uri || "",
  title: cleanTitle(x?.metadata?.title || x?.name),
  artist: String(x?.metadata?.artist_name || x?.artists?.[0]?.name || "").split(",")[0].trim(),
  img: coverOf(x?.metadata) || x?.album?.images?.[0]?.url || "",
});
// falsche Antworten: was sonst in der Warteschlange steht oder gerade lief
const pool = () =>
  [...(S.Queue?.nextTracks || []), ...(S.Queue?.prevTracks || [])]
    .map((x) => x.contextTrack || x)
    .filter((x) => x?.uri?.startsWith("spotify:track:") && x.metadata?.title)
    .map(songOf);
const nowItem = () => S.Player.data?.item || null;
const nowUri = () => nowItem()?.uri || "";

/* ---- Spielstand */
function player(id, n) {
  let p = G.players.get(id);
  if (!p) {
    p = { id, n: "", p: 0, out: false, team: 0, ans: null, e: 0, early: false };
    G.players.set(id, p);
  }
  const name = clean(n, 20);
  if (name) p.n = name;
  return p;
}
const short = (id) => id.slice(-6);
const nameOf = (p) => p.n || `${t("rankGuest")} ${p.id.slice(-2).toUpperCase()}`;
const all = () => [...G.players.values()];
const alive = () => all().filter((p) => !p.out);
const top = () => all().sort((a, b) => b.p - a.p).slice(0, 5).map((p) => ({ n: nameOf(p), p: Math.round(p.p) }));
// Der Rückruf des zuletzt gestellten Weckers ist zugleich „Runde überspringen“
const after = (ms, fn) => {
  G.lastFn = fn;
  G.timers.push(setTimeout(() => G && fn(), ms));
};
// wie after, aber kein Rundenende: „Runde überspringen“ darf nicht hier landen
const later = (ms, fn) => G.timers.push(setTimeout(() => G && fn(), ms));
function clearTimers() {
  if (!G) return;
  G.timers.forEach(clearTimeout);
  G.timers = [];
  clearInterval(G.tick);
  clearTimeout(G.clipT);
  G.fuse = false;
}
// Stand veröffentlichen: an die Handys (mit dem nächsten Live-Bild) und aufs große Bild
function publish() {
  const sc = {}, out = [];
  for (const p of all().slice(0, 40)) {
    sc[short(p.id)] = Math.round(p.p);
    if (p.out) out.push(short(p.id));
  }
  // das Cover beim Rätsel bleibt auf dem großen Bild
  const pub = { ...G.view };
  delete pub.cov;
  live.setGame({ ...pub, id: G.id, k: G.k, top: top(), sc, out, n: all().length, ans: all().filter((p) => p.ans).length, names: all().slice(0, 16).map(nameOf) });
}
function show(view) {
  if (view.end && !view.dur) view.dur = view.end - Date.now();
  const prev = G.view;
  G.view = view;
  setLock(MUSIC_GAMES.has(G.k) && view.st !== "join" && view.st !== "end");
  publish();
  render();
  if (prev?.st !== view.st || prev?.r !== view.r) cue(view);
}
function setLock(on) {
  lock.on = on;
  ctx.root()?.classList.toggle("is-game-lock", on);
}
// Soundeffekt beim Wechsel in einen neuen Spielabschnitt
function cue(v) {
  const k = G.k, st = v.st;
  if (st === "join" || st === "load") return sfx.whoosh();
  if (st === "end") return sfx.fanfare();
  if (st === "ask") return sfx.go();
  if (st === "rev") {
    if (k === "never" || k === "likely" || k === "dlikely") return sfx.reveal();
    return all().some((p) => p.ans?.v === v.right) ? sfx.good() : sfx.bad();
  }
  if (k === "stop") return st === "stop" ? sfx.scratch() : st === "res" ? sfx.buzz() : undefined;
  if (k === "fast") return st === "go" ? sfx.horn() : st === "res" ? sfx.reveal() : undefined;
  if (k === "bomb") return st === "res" ? sfx.boom() : undefined;
  if (k === "battle") return st === "go" ? sfx.horn() : sfx.fanfare();
  if (k === "beat" || k === "taps") return st === "go" ? sfx.horn() : undefined;
  if (k === "alarm") return st === "hit" ? sfx.siren() : st === "res" ? sfx.reveal() : undefined;
  if (k === "sing") return st === "go" ? sfx.whoosh() : st === "res" ? sfx.fanfare() : undefined;
  if (WHEELS.has(k)) return st === "spin" ? sfx.wheel() : st === "res" ? sfx.fanfare() : undefined;
}
function hide(on) {
  // verdeckt: Titel, Künstler, Cover und Liedtext dürfen die Lösung nicht verraten
  ctx.root()?.classList.toggle("is-quiz", on === "quiz");
  ctx.root()?.classList.toggle("is-gap", on === "gap");
  live.mask(on === "quiz" ? "all" : on === "gap" ? "lyrics" : "");
}

/* ---- Start und Ende */
const FIRST = {
  quiz: () => songRound(),
  title: () => songRound(),
  gap: () => lineRound(),
  next: () => lineRound(),
  stop: () => stopPlay(),
  fast: () => fastRound(),
  battle: () => battleGo(),
  beat: () => beatGo(),
  bomb: () => bombRound(),
  likely: () => likelyRound(),
  dlikely: () => likelyRound(),
  dquiz: () => songRound(),
  intro: () => songRound(),
  tf: () => tfRound(),
  taps: () => tapsGo(),
  never: () => neverRound(),
};
function start(kind) {
  if (!ctx) return;
  stop(true);
  muteBack = 0;
  G = { k: kind, id: Math.random().toString(36).slice(2, 8), r: 0, players: new Map(), view: null, timers: [], used: new Set(), lastFn: null };
  boxKey = "";
  clearInterval(ticker);
  ticker = setInterval(() => render(true), 250);
  if (WHEELS.has(kind)) return wheelIdle();
  // Wort-Alarm läuft ohne Warteraum: niemand muss sich anmelden, um mitzutrinken
  if (kind === "alarm" || kind === "sing") {
    S.Player.play?.();
    if (kind === "alarm") {
      G.r = 1;
      alarmGo(0);
    } else singRound();
    return void ctx.changed?.();
  }
  // Warteraum: alle Spiele beginnen gleich, mit QR-Code und den Namen, die schon da sind
  show({ st: "join", end: Date.now() + joinMs() });
  after(joinMs(), beginNow);
  ctx.changed?.();
}
function beginNow() {
  if (!G || G.view?.st !== "join") return;
  if (all().length < (MIN[G.k] || 0)) {
    notify(t("gNeedPlayers"), true);
    return stop();
  }
  clearTimers();
  FIRST[G.k]?.();
  ctx.changed?.();
}
function skip() {
  if (!G) return;
  if (G.view?.st === "join") return beginNow();
  const fn = G.lastFn;
  clearTimers();
  fn?.();
}
function stop(silent) {
  if (!G) return;
  clearTimers();
  if (G.k === "stop") S.Player.play?.();
  resume();
  muteOff();
  setLock(false);
  hide("");
  live.setGame(null);
  G = null;
  clearInterval(ticker);
  box?.remove();
  box = null;
  boxKey = "";
  if (!silent) ctx.changed?.();
}
function finish() {
  clearTimers();
  resume();
  muteOff();
  hide("");
  const list = top();
  show({ st: "end", top: list });
  if (list.length) ctx.confetti?.();
  after(14000, () => stop());
  ctx.changed?.();
}

/* ---- Fragen: gemeinsamer Ablauf */
function ask(view, ms, onEnd) {
  for (const p of all()) p.ans = null;
  G.askedAt = Date.now();
  G.onAsked = onEnd;
  show({ st: "ask", r: G.r, of: rounds(), att: G.att || 0, ...view, end: Date.now() + ms });
  after(ms, onEnd);
}
// Punkte: richtig 100, dazu (abschaltbar) bis zu 100 für Schnelligkeit. Gibt zurück, wie oft was gewählt wurde.
function award() {
  const span = G.view?.dur || askMs(), d = (G.view?.o || []).map(() => 0);
  for (const p of all()) {
    if (!p.ans) continue;
    d[p.ans.v]++;
    if (p.ans.v === G.right) p.p += 100 + (cfg.gameBonus === false ? 0 : Math.round(100 * Math.max(0, 1 - (p.ans.at - G.askedAt) / span)));
  }
  return d;
}

// Trinkregel: wer falsch oder gar nicht geantwortet hat, trinkt einen Schluck
function sips() {
  if (G.k !== "dquiz" && !cfg.gameDrink) return {};
  const who = all().filter((p) => !p.ans || p.ans.v !== G.right);
  return { drink: 1, sip: who.slice(0, 8).map(nameOf), sipIds: who.slice(0, 40).map((p) => short(p.id)) };
}

/* ---- Stumm schalten: niemand soll den Anfang eines Songs hören, den wir gleich überspringen */
const MUTE_KEY = "mirage:gameVol";
// Lautstärke vor dem Stummschalten. Spotify bestätigt Änderungen erst nach einem Moment: eine noch nicht bestätigte 0
// darf den gemerkten Wert nicht überschreiben, sonst bliebe die Musik für immer still.
let muteBack = 0;
function muteOn() {
  if (G.muted) return;
  G.muted = true;
  const v = readVolume();
  if (v > 0) muteBack = v;
  // war schon vor dem Spiel still: nichts zu tun und später nichts zurückzustellen
  if (!(muteBack > 0)) return;
  writeVolume(0);
  try {
    localStorage.setItem(MUTE_KEY, String(muteBack));
  } catch {}
}
function muteOff() {
  if (!G?.muted) return;
  G.muted = false;
  if (!(muteBack > 0)) return;
  const v = muteBack;
  writeVolume(v);
  try {
    localStorage.removeItem(MUTE_KEY);
  } catch {}
  // falls der Befehl im Songwechsel untergegangen ist: nachfassen
  setTimeout(() => {
    if (!G?.muted && readVolume() === 0) writeVolume(v);
  }, 700);
}
// Spotify wurde mitten im Wechsel beendet: beim nächsten Mal nicht stumm bleiben
function muteRecover() {
  try {
    const v = Number(localStorage.getItem(MUTE_KEY));
    localStorage.removeItem("mirage:gameMute");
    if (!(v > 0)) return;
    localStorage.removeItem(MUTE_KEY);
    // die Lautstärke meldet Spotify erst kurz nach dem Start
    setTimeout(() => readVolume() === 0 && writeVolume(v), 2000);
  } catch {}
}

/* ---- Musik beim Raten: nicht einfach weiterlaufen lassen */
// Eine markante Stelle statt des Intros: der erste Abschnitt, der fast so laut ist wie der lauteste.
// Am Anfang vieler Songs wird sonst der Künstlername gesungen.
function hookPos() {
  const dur = S.Player.getDuration?.() || 0;
  if (dur < 60000) return 0;
  const secs = audio.uri === nowUri() ? (audio.data?.sections || []).filter((x) => x.t >= 20 && x.t * 1000 < dur - 30000) : [];
  if (secs.length) {
    const most = Math.max(...secs.map((x) => x.l));
    return secs.find((x) => x.l >= most - 1.5).t * 1000;
  }
  return dur * 0.3;
}
// Zum nächsten Song, stumm, bis er an der richtigen Stelle steht. Danach gilt der Song, der WIRKLICH läuft:
// bei Shuffle, Warteschlange oder Autoplay ist das nicht immer der, den die Warteschlange als nächsten nennt.
function jumpNext(fromStart, done) {
  const old = nowUri();
  G.switching = true;
  G.paused = false;
  clearTimeout(G.clipT);
  muteOn();
  const ready = (item) => {
    G.switching = false;
    muteOff();
    done(item);
  };
  // erst weiter, wenn Spotify das Stummschalten bestätigt hat
  const t00 = Date.now();
  const whenSilent = (go) => {
    if (readVolume() === 0 || Date.now() - t00 > 500) return go();
    later(30, () => whenSilent(go));
  };
  whenSilent(() => {
    S.Player.next?.();
    S.Player.play?.();
    const t0 = Date.now();
    let tAudio = 0;
    const landed = () => {
      if (nowUri() && nowUri() !== old) return waitAudio();
      if (Date.now() - t0 > 3500) return ready(null);
      later(60, landed);
    };
    // die Taktdaten sagen, wo die markante Stelle liegt; lange warten wir nicht darauf
    const waitAudio = () => {
      tAudio ||= Date.now();
      const has = audio.uri === nowUri() && audio.data && !audio.data.synthetic;
      if (fromStart || has || Date.now() - tAudio > 1200) return place();
      later(60, waitAudio);
    };
    const place = () => {
      const at = Math.round(fromStart ? 0 : hookPos());
      G.clipAt = at;
      let tries = 0, t2 = 0;
      const aim = () => {
        tries++;
        t2 = Date.now();
        S.Player.seek?.(at);
        settled();
      };
      const settled = () => {
        const p = S.Player.getProgress?.() ?? 0;
        if (Math.abs(p - at) < 1200 && Date.now() - t2 > 150) return later(300, () => ready(nowItem()));
        // ein Springen direkt nach dem Songwechsel kann untergehen: nochmal
        if (Date.now() - t2 > 700) return tries < 4 ? aim() : ready(nowItem());
        later(50, settled);
      };
      aim();
    };
    landed();
  });
}
function runClip() {
  G.paused = false;
  clearTimeout(G.clipT);
  const clip = G.k === "intro" ? 5000 : clipMs();
  if (!clip || clip >= askMs()) return;
  G.clipT = setTimeout(() => {
    if (!G) return;
    S.Player.pause?.();
    G.paused = true;
    render();
  }, clip);
}
// „Nochmal abspielen“ auf dem großen Bild
function replay() {
  if (!G || !SONG_FIELD[G.k] || G.view?.st !== "ask" || G.switching) return;
  sfx.pop();
  S.Player.seek?.(G.clipAt || 0);
  S.Player.play?.();
  runClip();
  render();
}
function resume() {
  if (!G?.paused) return;
  G.paused = false;
  S.Player.play?.();
}
// Läuft hinter dem Rücken des Spiels etwas anders (Medientaste, Fernbedienung, Song zu Ende): wieder geradeziehen
function guard() {
  if (!G || G.switching) return;
  const v = G.view || {}, now = Date.now();
  if (SONG_FIELD[G.k] && v.st === "ask" && G.uri && nowUri() && nowUri() !== G.uri) {
    // der Song hat gewechselt: dieselbe Runde mit dem Song, der jetzt läuft
    clearTimers();
    G.r--;
    G.att = (G.att || 0) + 1;
    return songRound(true);
  }
  if (LINE_GAMES.has(G.k) && v.st === "ask" && G.lines && ctx.lines() !== G.lines) {
    clearTimers();
    hide("");
    G.r--;
    return G.k === "tf" ? tfRound() : lineRound();
  }
  const playing = S.Player.isPlaying?.();
  const wantPlay = (SONG_FIELD[G.k] && v.st === "ask" && !G.paused) || (LINE_GAMES.has(G.k) && v.st === "ask" && G.k !== "tf") || (G.k === "beat" && v.st === "go") || G.k === "alarm" || G.k === "sing" || (G.k === "stop" && v.st === "play");
  const wantStop = (SONG_FIELD[G.k] && v.st === "ask" && G.paused) || (G.k === "stop" && v.st === "stop");
  if (now - (G.kick || 0) > 1000) {
    if (wantPlay && !playing) {
      G.kick = now;
      S.Player.play?.();
    } else if (wantStop && playing) {
      G.kick = now;
      S.Player.pause?.();
    }
  }
}

/* ---- Wer singt hier? · Wie heißt der Song? · Intro-Blitz · Schluck-Quiz */
const SPARE_ARTISTS = ["Taylor Swift", "The Weeknd", "Drake", "Billie Eilish", "Ed Sheeran", "Dua Lipa", "Rihanna", "Eminem", "Coldplay", "Adele", "Queen", "Bruno Mars"];
const SPARE_TITLES = ["Blinding Lights", "Shape of You", "Bad Guy", "Levitating", "Rolling in the Deep", "Umbrella", "Viva la Vida", "Lose Yourself", "Bohemian Rhapsody", "Uptown Funk", "Anti-Hero", "Stay"];
function songRound(useCurrent) {
  G.r++;
  if (G.r > rounds()) return finish();
  hide("quiz");
  G.uri = "";
  show({ st: "load", r: G.r, of: rounds() });
  const go = (item) => {
    if (!item) {
      notify(t("gNeedQueue"), true);
      return G.r > 1 ? finish() : stop();
    }
    songAsk(songOf(item));
  };
  if (useCurrent) {
    G.clipAt = S.Player.getProgress?.() || 0;
    return go(nowItem());
  }
  jumpNext(G.k === "intro", go);
}
function songAsk(song) {
  const field = SONG_FIELD[G.k], answer = song[field];
  const own = shuffle([...new Set(pool().map((x) => x[field]))].filter((a) => a && a !== answer));
  // Warteschlange zu klein oder nur ein Künstler: das Spiel läuft trotzdem, mit bekannten Namen als falschen Antworten
  const others = [...own, ...shuffle(field === "artist" ? SPARE_ARTISTS : SPARE_TITLES).filter((a) => a !== answer && !own.includes(a))].slice(0, 3);
  if (!answer) {
    notify(t("gNeedQueue"), true);
    return G.r > 1 ? finish() : stop();
  }
  G.uri = song.uri;
  const o = shuffle([answer, ...others]);
  G.right = o.indexOf(answer);
  runClip();
  ask({ o }, askMs(), () => {
    const d = award();
    hide("");
    resume();
    show({ st: "rev", r: G.r, of: rounds(), o, d, right: G.right, title: song.title, artist: song.artist, cov: song.img, ...sips() });
    after(breakMs(), () => songRound());
  });
}

/* ---- Liedtext-Lücken · Nächste Zeile */
const WORD = /[\p{L}\p{M}'’]{4,}/gu;
const gapWord = (text) => (text.match(WORD) || []).filter((w) => w.length <= 18).sort((a, b) => b.length - a.length)[0];
function lineRound() {
  G.r++;
  if (G.r > rounds()) return finish();
  askLine(0);
}
// verbrauchte Zeilen gelten nur für diesen Song: im nächsten sind es andere
function freshLines(lines) {
  if (G.usedIn !== lines) {
    G.usedIn = lines;
    G.used = new Set();
  }
}
function askLine(tries) {
  const lines = ctx.lines() || [], pos = ctx.pos(), gap = G.k === "gap";
  freshLines(lines);
  const ahead = Math.max(20000, askMs() + 6000);
  const usable = (l, i) => !G.used.has(i) && (gap ? !!gapWord(l.text || "") : i > 0 && !!lines[i - 1].text?.trim() && (l.text || "").trim().length > 2);
  const fits = (l, i) => l.t > pos + 7000 && l.t < pos + ahead && usable(l, i);
  const i = lines.findIndex(fits), pick = lines[i];
  const retry = (ms = 4000) => {
    // kein Liedtext oder keine passende Zeile: zum nächsten Abschnitt oder Song
    if (tries > 8) {
      notify(t("gNeedLyrics"), true);
      return G.r > 1 ? finish() : stop();
    }
    show({ st: "wait", r: G.r, of: rounds() });
    after(ms, () => askLine(tries + 1));
  };
  if (!pick) {
    const far = lines.find((l, k) => l.t >= pos + ahead && usable(l, k));
    // die nächste brauchbare Zeile liegt weit weg: hinspulen statt die Runde lang zu warten
    if (far) {
      S.Player.seek?.(far.t - 10000);
      return retry(1200);
    }
    // dieser Song ist aufgebraucht oder hat keinen Text
    if (tries === 1 || tries === 4) S.Player.next?.();
    return retry(3000);
  }
  let answer, wrong, line;
  if (gap) {
    const word = gapWord(pick.text);
    answer = word.toLocaleLowerCase();
    wrong = [...new Set(lines.flatMap((l) => l.text?.match(WORD) || []).map((w) => w.toLocaleLowerCase()))].filter((w) => w !== answer && w.length <= 18);
    wrong = shuffle(wrong).sort((a, b) => Math.abs(a.length - answer.length) - Math.abs(b.length - answer.length));
    line = pick.text.replace(word, "_____");
  } else {
    answer = pick.text.trim().slice(0, 70);
    wrong = shuffle([...new Set(lines.map((l) => (l.text || "").trim().slice(0, 70)))].filter((x) => x.length > 2 && x !== answer));
    line = lines[i - 1].text.trim();
  }
  if (wrong.length < 3) return retry();
  G.used.add(i);
  const o = shuffle([answer, ...wrong.slice(0, 3)]);
  G.right = o.indexOf(answer);
  G.lines = lines;
  hide("gap");
  ask({ o, line }, pick.t - pos, () => {
    const d = award();
    hide("");
    show({ st: "rev", r: G.r, of: rounds(), o, d, right: G.right, line: pick.text, ...sips() });
    after(breakMs(), lineRound);
  });
}

/* ---- Echt oder Fake? */
function tfRound() {
  G.r++;
  if (G.r > rounds()) return finish();
  tfAsk(0);
}
function tfAsk(tries) {
  const lines = ctx.lines() || [];
  freshLines(lines);
  const words = [...new Set(lines.flatMap((l) => l.text?.match(WORD) || []).map((w) => w.toLocaleLowerCase()))].filter((w) => w.length <= 18);
  const cand = lines.map((l, i) => i).filter((i) => !G.used.has(i) && gapWord(lines[i].text || "") && lines[i].text.trim().split(/\s+/).length >= 4);
  if (!cand.length || words.length < 6) {
    if (tries > 4) {
      notify(t("gNeedLyrics"), true);
      return G.r > 1 ? finish() : stop();
    }
    if (tries === 1) S.Player.next?.();
    show({ st: "wait", r: G.r, of: rounds() });
    return after(3000, () => tfAsk(tries + 1));
  }
  const i = cand[Math.floor(Math.random() * cand.length)], real = lines[i].text.trim();
  G.used.add(i);
  const word = gapWord(real), lower = word.toLocaleLowerCase();
  const swap = shuffle(words.filter((w) => w !== lower && !real.toLocaleLowerCase().includes(w) && Math.abs(w.length - word.length) <= 3))[0];
  const fake = !!swap && Math.random() < 0.5;
  const shown = fake ? real.replace(word, word[0] === word[0].toLocaleUpperCase() ? swap[0].toLocaleUpperCase() + swap.slice(1) : swap) : real;
  const o = [t("gTrue"), t("gFalse")];
  G.right = fake ? 1 : 0;
  G.lines = lines;
  hide("gap");
  ask({ o, line: shown }, Math.min(askMs(), 15000), () => {
    const d = award();
    hide("");
    // die Auflösung kommt aus dem Song selbst: er springt zu genau dieser Zeile
    S.Player.seek?.(Math.max(lines[i].t - 400, 2));
    S.Player.play?.();
    show({ st: "rev", r: G.r, of: rounds(), o, d, right: G.right, line: real, ...sips() });
    after(breakMs(), tfRound);
  });
}

/* ---- Tipp-Rennen */
function tapsGo() {
  const end = Date.now() + 15000, tick = () => show({ st: "go", end, dur: 15000 });
  tick();
  G.tick = setInterval(tick, 1000);
  after(16500, finish);
}

/* ---- Ich hab noch nie: wer es schon getan hat, trinkt (und bekommt dafür die Punkte) */
function neverRound() {
  G.r++;
  if (G.r > rounds()) return finish();
  let i = 1 + Math.floor(Math.random() * 16);
  while (G.used.has(i) && G.used.size < 16) i = (i % 16) + 1;
  G.used.add(i);
  const o = [t("gHave"), t("gNeverDid")], q = t("gN" + i);
  G.right = -1;
  ask({ o, q }, askMs(), () => {
    const d = award(), who = all().filter((p) => p.ans?.v === 0);
    who.forEach((p) => (p.p += 1));
    show({ st: "rev", r: G.r, of: rounds(), o, d, right: 0, q, drink: 1, sip: who.slice(0, 8).map(nameOf), sipIds: who.slice(0, 40).map((p) => short(p.id)) });
    after(breakMs(), neverRound);
  });
}

/* ---- Wort-Alarm: ein häufiges Wort aus dem laufenden Song, jedes Mal ein Schluck */
const FILLER = new Set(["that", "your", "with", "this", "have", "when", "what", "just", "like", "from", "they", "will", "there", "about", "yeah", "gonna", "wanna", "dass", "wenn", "aber", "nicht", "eine", "einen", "mich", "dich", "auch", "noch", "sind"]);
function alarmGo(tries) {
  const lines = ctx.lines() || [], pos = ctx.pos(), count = new Map();
  const wordsOf = (l) => new Set((l.text || "").match(WORD)?.map((w) => w.toLocaleLowerCase()) || []);
  for (const l of lines) if (l.t > pos) for (const w of wordsOf(l)) count.set(w, (count.get(w) || 0) + 1);
  const best = [...count].filter(([w, n]) => n >= 2 && !FILLER.has(w)).sort((a, b) => b[1] - a[1]).slice(0, 4);
  if (!best.length) {
    if (tries > 4) {
      notify(t("gNeedLyrics"), true);
      return stop();
    }
    if (tries === 1) S.Player.next?.();
    show({ st: "wait" });
    return after(3000, () => alarmGo(tries + 1));
  }
  const word = best[Math.floor(Math.random() * best.length)][0];
  let hits = 0, last = -1;
  const end = () => {
    clearTimers();
    show({ st: "res", word, hits });
    // ein neuer Song, ein neues Wort, bis die Runden voll sind
    after(6000, () => {
      if (++G.r > rounds()) return stop();
      alarmGo(0);
    });
  };
  show({ st: "go", word, hits });
  G.lastFn = end;
  const lastT = lines[lines.length - 1].t;
  G.tick = setInterval(() => {
    // neuer Song: der Alarm gilt nur für diesen einen
    if (ctx.lines() !== lines) return end();
    const p = ctx.pos();
    let i = -1;
    for (let k = 0; k < lines.length && lines[k].t <= p; k++) i = k;
    if (i !== last) {
      last = i;
      if (i >= 0 && wordsOf(lines[i]).has(word)) {
        hits++;
        show({ st: "hit", word, hits });
        ctx.flashStorm?.();
        later(2200, () => G.view?.st === "hit" && show({ st: "go", word, hits }));
      }
    }
    if (p > lastT + 8000) end();
  }, 200);
}

/* ---- Musik-Stopp */
function stopPlay() {
  G.r++;
  const left = alive();
  if (left.length <= 1 || G.r > 12) {
    S.Player.play?.();
    left.forEach((p) => (p.p += 100));
    return finish();
  }
  for (const p of left) p.ans = null;
  S.Player.play?.();
  show({ st: "play", r: G.r, left: left.length });
  after(8000 + Math.random() * 12000, () => {
    S.Player.pause?.();
    show({ st: "stop", r: G.r, left: left.length, end: Date.now() + 4000 });
    after(4000, () => {
      // wer nicht getippt hat, fliegt raus; haben alle getippt, der Langsamste
      const now = alive(), none = now.filter((p) => !p.ans);
      if (none.length < now.length) none.forEach((p) => (p.out = true));
      if (!none.length) now.sort((a, b) => b.ans.ms - a.ans.ms)[0].out = true;
      show({ st: "res", r: G.r, left: alive().length, gone: all().filter((p) => p.out).map(nameOf).slice(-4) });
      after(3000, stopPlay);
    });
  });
}

/* ---- Schnellster Finger */
const FAST_PTS = [100, 70, 50, 30];
function fastRound() {
  G.r++;
  if (G.r > rounds()) return finish();
  for (const p of all()) {
    p.ans = null;
    p.early = false;
  }
  show({ st: "ready", r: G.r, of: rounds() });
  after(2500 + Math.random() * 6000, () => {
    // das Signal fällt auf den nächsten Schlag des Songs
    const beats = audio.data?.beats, p = ctx.pos() / 1000, nb = beats?.find((b) => b.t > p + 0.02);
    const fire = () => {
      show({ st: "go", r: G.r, of: rounds(), at: Date.now(), end: Date.now() + 3500 });
      after(3500, () => {
        const list = all().filter((x) => x.ans && !x.early).sort((a, b) => a.ans.ms - b.ans.ms);
        list.forEach((x, i) => (x.p += FAST_PTS[i] ?? 10));
        show({ st: "res", r: G.r, of: rounds(), win: list.slice(0, 3).map((x) => ({ n: nameOf(x), ms: x.ans.ms })) });
        after(Math.min(5000, breakMs()), fastRound);
      });
    };
    if (nb && nb.t - p < 1.5) after((nb.t - p) * 1000, fire);
    else fire();
  });
}

/* ---- Tanz-Battle */
function battleGo() {
  // Teams abwechselnd füllen, damit sie gleich groß sind
  shuffle(all()).forEach((p, i) => (p.team = i % 2));
  G.score = [0, 0];
  G.end = Date.now() + durMs();
  const tick = () => {
    // je Team der Durchschnitt: ein größeres Team hat keinen Vorteil
    const size = [0, 0], sum = [0, 0];
    for (const p of all()) {
      size[p.team]++;
      sum[p.team] += p.e;
    }
    G.score = [0, 1].map((k) => (size[k] ? sum[k] / size[k] : 0));
    const teams = {};
    for (const p of all()) teams[short(p.id)] = p.team;
    show({ st: "go", a: Math.round(G.score[0]), b: Math.round(G.score[1]), end: G.end, dur: durMs(), teams });
  };
  tick();
  G.tick = setInterval(tick, 500);
  after(durMs(), () => {
    clearTimers();
    const win = G.score[0] === G.score[1] ? -1 : G.score[0] > G.score[1] ? 0 : 1;
    for (const p of all()) if (p.team === win || win < 0) p.p += 100;
    if (win >= 0) ctx.confetti?.();
    show({ st: "res", a: Math.round(G.score[0]), b: Math.round(G.score[1]), win });
    after(5000, finish);
  });
}

/* ---- Beat-Treffer: das Handy misst, wie gut die Abstände seiner Tipps zum Tempo passen, und meldet seinen Stand */
function beatGo() {
  S.Player.play?.();
  const end = Date.now() + durMs();
  const tick = () => show({ st: "go", end, dur: durMs(), bpm: Math.round(ctx.bpm?.() || 120) });
  tick();
  G.tick = setInterval(tick, 1000);
  // kurz nachlaufen lassen: die letzten Stände sind noch unterwegs
  after(durMs() + 1500, finish);
}

/* ---- Heiße Kartoffel */
function bombRound() {
  const left = alive();
  if (left.length <= 1) {
    left.forEach((p) => (p.p += 100));
    return finish();
  }
  G.r++;
  G.holder = left[Math.floor(Math.random() * left.length)];
  bombShow();
  const span = 12000 + Math.random() * 20000, t0 = Date.now();
  // die Lunte tickt immer schneller, wann es knallt, weiß trotzdem niemand genau
  G.fuse = true;
  const burn = () => {
    if (!G?.fuse) return;
    sfx.fuse();
    later(Math.max(130, 620 * (1 - (Date.now() - t0) / span)), burn);
  };
  burn();
  after(span, () => {
    G.fuse = false;
    const gone = G.holder;
    gone.out = true;
    alive().forEach((p) => (p.p += 20));
    ctx.flashStorm?.();
    show({ st: "res", r: G.r, boom: nameOf(gone), left: alive().length });
    after(3500, bombRound);
  });
}
function bombShow() {
  G.seq = (G.seq || 0) + 1;
  show({ st: "go", r: G.r, h: short(G.holder.id), hn: nameOf(G.holder), x: G.seq, left: alive().length });
}

/* ---- Wer würde am ehesten …? */
function likelyRound() {
  G.r++;
  if (G.r > rounds()) return finish();
  const names = shuffle(all()).slice(0, 6);
  if (names.length < 2) return finish();
  let i = 1 + Math.floor(Math.random() * 20);
  while (G.used.has(i) && G.used.size < 20) i = (i % 20) + 1;
  G.used.add(i);
  const o = names.map(nameOf), q = t("gL" + i), sipGame = G.k === "dlikely";
  G.right = -1;
  ask({ o, q }, askMs(), () => {
    const d = award(), most = Math.max(...d);
    const right = most > 0 ? d.indexOf(most) : -1;
    // wer mit der Mehrheit gestimmt hat, bekommt die Punkte
    for (const p of all()) if (p.ans && right >= 0 && d[p.ans.v] === most) p.p += 50;
    // Schluck-Ausgabe: wer die meisten Stimmen hat, trinkt (bei Gleichstand alle davon)
    const drinkers = sipGame && most > 0 ? names.filter((_, k) => d[k] === most) : [];
    const extra = sipGame ? { drink: 1, sip: drinkers.map(nameOf), sipIds: drinkers.map((p) => short(p.id)) } : sips();
    if (right >= 0) ctx.handsUp?.();
    show({ st: "rev", r: G.r, of: rounds(), o, d, right, q, ...extra });
    after(breakMs(), likelyRound);
  });
}

/* ---- Sing weiter: mitten im Song wird es still, der Raum singt allein weiter */
function singRound() {
  G.r++;
  if (G.r > rounds()) return stop();
  singGo(0);
}
function singGo(tries) {
  const lines = ctx.lines() || [], pos = ctx.pos();
  freshLines(lines);
  const hasText = (l) => l && (l.text || "").trim().length > 3 && l.text !== "♪";
  // drei gesungene Zeilen hintereinander, die zusammen lang genug sind; der Refrain (wiederholte Zeilen) zuerst
  const seen = new Map();
  for (const l of lines) seen.set(l.text, (seen.get(l.text) || 0) + 1);
  const fits = (i) => !G.used.has(i) && lines[i].t > 5000 && hasText(lines[i]) && hasText(lines[i + 1]) && hasText(lines[i + 2]) && lines[i + 3] && lines[i + 3].t - lines[i].t > 5000 && lines[i + 3].t - lines[i].t < 16000;
  const idx = lines.map((_, i) => i).filter(fits);
  const at = idx.find((i) => seen.get(lines[i].text) > 1 && lines[i].t > pos) ?? idx.find((i) => lines[i].t > pos) ?? idx[0];
  if (at == null) {
    if (tries > 4) {
      notify(t("gNeedLyrics"), true);
      return stop();
    }
    if (tries === 1) S.Player.next?.();
    show({ st: "wait", r: G.r, of: rounds() });
    return after(3000, () => singGo(tries + 1));
  }
  for (let k = at; k < at + 3; k++) G.used.add(k);
  const start = lines[at].t, stopAt = lines[at + 3].t;
  // kurz vor der Stelle einsteigen, damit alle drin sind
  if (start - pos > 16000 || start < pos + 3000) S.Player.seek?.(Math.max(start - 9000, 2));
  show({ st: "ready", r: G.r, of: rounds(), line: lines[at].text });
  G.lines = lines;
  G.tick = setInterval(() => {
    if (ctx.lines() !== lines) {
      clearTimers();
      muteOff();
      G.r--;
      return singRound();
    }
    const p = ctx.pos();
    if (G.view.st === "ready" && p >= start - 60) muteOn();
    if (p < start - 60 || p >= stopAt) {
      if (p >= stopAt && G.view.st === "go") {
        clearTimers();
        muteOff();
        ctx.confetti?.();
        show({ st: "res", r: G.r, of: rounds() });
        after(breakMs(), singRound);
      }
      return;
    }
    let i = at;
    while (i + 1 < at + 3 && lines[i + 1].t <= p) i++;
    if (G.view.st !== "go" || G.view.line !== lines[i].text) show({ st: "go", r: G.r, of: rounds(), line: lines[i].text, lyn: i + 1 < at + 3 ? lines[i + 1].text : "" });
  }, 120);
  // Sicherheitsnetz: wird der Song angehalten, nicht ewig stumm bleiben
  later(stopAt - start + 30000, () => {
    clearTimers();
    muteOff();
    after(500, singRound);
  });
}

/* ---- Glücksrad */
function wheelFields() {
  if (G.k === "dwheel") return DRINK_FIELDS.map((k) => ({ k: "", text: t(k) }));
  const on = WHEEL_FIELDS.filter((k) => (cfg.gameWheel || WHEEL_FIELDS).includes(k)).map((k) => ({ k, text: t(k) }));
  const own = String(cfg.gameWheelOwn || "").split(",").map((x) => clean(x, 26)).filter(Boolean).slice(0, 8).map((text) => ({ k: "", text }));
  const list = [...on, ...own];
  return list.length >= 2 ? list : WHEEL_FIELDS.map((k) => ({ k, text: t(k) }));
}
function wheelIdle() {
  G.fields = wheelFields();
  show({ st: "idle" });
  ctx.changed?.();
}
function spin() {
  if (!G || !WHEELS.has(G.k) || G.view?.st === "spin") return;
  const n = G.fields.length, i = Math.floor(Math.random() * n), turns = (G.turns || 0) + 5;
  G.turns = turns;
  G.angle = turns * 360 - (i + 0.5) * (360 / n);
  show({ st: "spin" });
  after(5200, () => {
    if (G.k === "dwheel") ctx.flashStorm?.();
    else wheelEffect(G.fields[i].k);
    show({ st: "res", text: G.fields[i].text });
  });
}
function wheelEffect(k) {
  if (k === "wh1") ctx.confetti?.();
  else if (k === "wh2") ctx.handsUp?.();
  else if (k === "wh3") S.Player.next?.();
  else if (k === "wh4") ctx.venue?.();
  else if (k === "wh5") ctx.flashStorm?.();
  else if (k === "wh6") {
    const w = live.wishes().find((x) => x.st === "open");
    if (w) live.accept(w.i);
    else S.Player.next?.();
  }
}

/* ---- Antworten der Handys */
window.addEventListener("mirage:game", (e) => {
  if (!G) return;
  const m = e.detail, v = G.view;
  if (!m?.id || !v) return;
  const fresh = !G.players.has(m.id), p = player(m.id, m.n);
  if (fresh && v.st === "join") sfx.pop();
  if (fresh && v.st !== "join") {
    // spät dazugekommen: bei Ausscheide-Spielen nur zuschauen, beim Battle ins kleinere Team
    if (OUT_GAMES.has(G.k)) p.out = true;
    if (G.k === "battle") p.team = all().filter((x) => x.team === 0).length > all().length / 2 ? 1 : 0;
  }
  if (m.a === "join") {
    publish();
    return render();
  }
  // Fragen: eine Antwort je Runde (das Handy schickt sie zur Sicherheit mehrmals)
  if (ASK_GAMES.has(G.k) && m.a === "ans" && v.st === "ask" && m.r === v.r && !p.ans) {
    const val = Number(m.v);
    if (val >= 0 && val < v.o.length) {
      p.ans = { v: val, at: Date.now() };
      sfx.pop();
    }
    publish();
    render();
    // alle haben geantwortet: nicht warten (Lücken und Zeilen lösen sich erst beim Singen auf)
    if (EARLY_END.has(G.k) && alive().every((x) => x.ans)) {
      clearTimers();
      G.onAsked?.();
    }
    return;
  }
  if (G.k === "stop") {
    if (m.a !== "tap" || m.r !== v.r || p.out) return;
    // zu früh getippt (Musik läuft noch): raus
    if (v.st === "play") {
      if (!p.out) sfx.buzz();
      p.out = true;
    }
    else if (v.st === "stop" && !p.ans) p.ans = { ms: Math.max(0, Math.min(5000, Number(m.ms) || 5000)) };
    return;
  }
  if (G.k === "fast" && m.r === v.r) {
    if (m.a === "early" && !p.ans) p.early = true;
    else if (m.a === "tap" && v.st === "go" && !p.ans && !p.early) p.ans = { ms: Math.max(0, Math.min(5000, Number(m.ms) || 5000)) };
    return;
  }
  if (G.k === "battle" && m.a === "e" && v.st === "go") p.e += Math.max(0, Math.min(40, Number(m.v) || 0));
  if (G.k === "beat" && m.a === "sc" && v.st === "go") p.p = Math.max(0, Math.min(9999, Number(m.v) || 0));
  if (G.k === "taps" && m.a === "sc") p.p = Math.max(0, Math.min(400, Number(m.v) || 0));
  if (G.k === "bomb" && m.a === "pass" && v.st === "go" && p === G.holder && m.v === G.seq) {
    const rest = alive().filter((x) => x !== p);
    if (rest.length) {
      sfx.whoosh();
      G.holder = rest[Math.floor(Math.random() * rest.length)];
      bombShow();
    }
  }
});

/* ---- Anzeige auf dem großen Bild */
const div = (cls, text) => {
  const d = document.createElement("div");
  d.className = cls;
  if (text != null) d.textContent = text;
  return d;
};
const secs = (end) => {
  const s = Math.max(0, Math.ceil((end - Date.now()) / 1000));
  return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : s + " s";
};
function render(tickOnly) {
  if (!G) return;
  const root = ctx.root();
  if (!root) return;
  if (!box || !box.isConnected) {
    box = div("m-im-game");
    root.append(box);
    boxKey = "";
  }
  box.classList.toggle("is-compact", cfg.gameCard === "small");
  const v = G.view || {};
  // Restzeit und Balken laufen ohne Neuaufbau weiter
  const bar = box.querySelector(".m-g-bar i");
  if (bar) bar.style.width = v.end && v.dur ? Math.max(0, Math.min(100, ((v.end - Date.now()) / v.dur) * 100)) + "%" : "0";
  const c = box.querySelector(".m-g-time");
  if (c) {
    const left = v.end ? Math.ceil((v.end - Date.now()) / 1000) : 99;
    c.textContent = v.end ? secs(v.end) : "";
    // die letzten Sekunden: rot und hörbar
    const low = left <= 5 && v.st === "ask";
    c.classList.toggle("is-low", low);
    if (low && left > 0 && left !== G.tickLeft) {
      G.tickLeft = left;
      sfx.tick();
    }
  }
  if (tickOnly) return guard();
  if (WHEELS.has(G.k) && box.querySelector(".m-g-wheel")) return drawWheel(v);
  const key = [G.k, v.st, v.r, v.q, v.h, v.word, G.k === "sing" ? "" : v.line].join("|");
  if (key === boxKey) return update(v);
  boxKey = key;
  box.textContent = "";
  box.dataset.k = G.k;
  box.dataset.st = v.st || "";
  box.append(head(v));
  build(v);
  update(v);
}
function head(v) {
  const h = div("m-g-head");
  h.append(div("m-g-bar"));
  h.firstChild.append(document.createElement("i"));
  h.append(div("m-g-ic", INFO[G.k].icon), div("m-g-name", t(INFO[G.k].label)));
  if (v.r && v.of) {
    const dots = div("m-g-dots");
    for (let i = 1; i <= v.of; i++) dots.append(div(i < v.r ? "is-done" : i === v.r ? "is-now" : ""));
    h.append(dots);
  }
  h.append(div("m-g-time", v.end ? secs(v.end) : ""));
  const x = document.createElement("button");
  x.type = "button";
  x.className = "m-g-x";
  x.textContent = "×";
  x.title = x.ariaLabel = t("gEndNow");
  x.onclick = (e) => {
    e.stopPropagation();
    stop();
  };
  h.append(x);
  return h;
}
function build(v) {
  if (v.st === "end") return buildEnd(v);
  if (WHEELS.has(G.k)) return drawWheel(v, true);
  if (v.st === "join") return buildJoin();
  if (v.st === "wait") return box.append(div("m-g-sub", t("gWaitLine")));
  if (v.st === "load") return box.append(div("m-g-big m-g-pulse", "🎧"), div("m-g-sub", t("gLoadSong")));
  if (G.k === "sing") {
    if (v.st === "res") return box.append(div("m-g-big m-g-pop", t("gSingBack")));
    if (v.st === "ready") return box.append(div("m-g-big m-g-pulse", t("gSingSoon")));
    box.append(div("m-g-big is-hot m-g-pop", t("gSingNow")), div("m-g-line m-g-sline"), div("m-g-sub m-g-snext"));
    return;
  }
  if (ASK_GAMES.has(G.k)) return buildAsk(v);
  if (G.k === "taps") return box.append(div("m-g-big m-g-pulse", t("gTapsGo")), div("m-g-board"));
  if (G.k === "alarm") {
    if (v.st === "res") return box.append(div("m-g-big", t("gAlarmEnd").replace("{n}", v.hits)));
    box.append(div("m-g-sub", t("gAlarmWord")), div("m-g-big m-g-word" + (v.st === "hit" ? " is-hot m-g-pop" : ""), v.word));
    box.append(v.st === "hit" ? div("m-g-big is-hot m-g-pop", "🍺 " + t("gAlarmHit")) : div("m-g-sub", "🍺 " + v.hits));
    return;
  }
  if (G.k === "stop") {
    if (v.st === "play") box.append(div("m-g-big m-g-pulse", t("gStopPlay")));
    if (v.st === "stop") box.append(div("m-g-big is-hot m-g-pop", t("gStopNow")));
    if (v.st === "res" && v.gone?.length) box.append(div("m-g-sub is-gone", v.gone.join(" · ")));
    box.append(div("m-g-sub", t("gLeft").replace("{n}", v.left ?? alive().length)));
  } else if (G.k === "fast") {
    if (v.st === "ready") box.append(div("m-g-big m-g-pulse", t("gFastReady")));
    if (v.st === "go") box.append(div("m-g-big is-hot m-g-pop", t("gFastGo")));
    if (v.st === "res") {
      const b = div("m-g-board");
      (v.win || []).forEach((x, i) => b.append(row(["🥇", "🥈", "🥉"][i], x.n, x.ms + " ms")));
      box.append(b);
    }
  } else if (G.k === "battle") {
    box.append(div("m-g-big", v.st === "res" ? (v.win < 0 ? t("gDraw") : t("gTeamWin").replace("{t}", v.win ? "B" : "A")) : t("gShake")));
    const bars = div("m-g-battle");
    bars.append(div("m-g-team", "A"), div("m-g-team is-b", "B"));
    box.append(bars);
  } else if (G.k === "beat") {
    // Takt zum Mitsehen: Ring und vier Lichter laufen auf den Schlägen des Songs
    const lights = div("m-g-lights");
    for (let i = 0; i < 4; i++) lights.append(div("m-g-light"));
    box.append(div("m-g-beat"), lights, div("m-g-big", t("gBeatGo")), div("m-g-sub m-g-bpm"), div("m-g-board"));
    beatLoop();
  } else if (G.k === "bomb") {
    if (v.st === "go") box.append(div("m-g-bomb", "💣"), div("m-g-big", t("gBombHolder").replace("{n}", v.hn)));
    if (v.st === "res") box.append(div("m-g-bomb is-boom", "💥"), div("m-g-big is-hot", t("gBombBoom").replace("{n}", v.boom)));
    box.append(div("m-g-sub", t("gLeft").replace("{n}", v.left ?? 0)));
  }
}
function row(rank, name, val) {
  const r = div("m-g-row");
  r.append(div("m-g-rk", rank), div("m-g-nm", name), div("m-g-pt", val));
  return r;
}
function board(list) {
  const d = div("m-g-board");
  (list || []).slice(0, 5).forEach((x, i) => d.append(row(["🥇", "🥈", "🥉"][i] || String(i + 1), x.n, String(x.p))));
  return d;
}
function buildJoin() {
  const wrap = div("m-g-join"), txt = div("m-g-jtxt");
  const need = async () => {
    const info = live.info() || (await live.prepare().catch(() => null));
    if (!info || !wrap.isConnected) return;
    const img = new Image();
    img.alt = "";
    img.className = "m-g-qr";
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(info.qr);
    wrap.prepend(img);
  };
  txt.append(div("m-g-big", t("gJoinAny")), div("m-g-sub", t(INFO[G.k].hint)), div("m-g-sub", t("gJoinScan")), div("m-g-chips"));
  const go = document.createElement("button");
  go.type = "button";
  go.className = "m-g-go";
  go.textContent = t("gStartNow");
  go.onclick = (e) => {
    e.stopPropagation();
    beginNow();
  };
  txt.append(go);
  wrap.append(txt);
  box.append(wrap);
  need();
}
function buildAsk(v) {
  if (v.cov && v.st === "rev") {
    const c = div("m-g-cov"), im = new Image();
    im.alt = "";
    im.src = v.cov;
    c.append(im);
    box.append(c);
  }
  if (v.q) box.append(div("m-g-line", v.q));
  else if (v.line) box.append(div("m-g-line", v.line));
  else if (v.st === "rev") box.append(div("m-g-big", `${v.artist} – ${v.title}`));
  else if (SONG_FIELD[G.k]) {
    // was gerade zu hören ist, und der Knopf zum nochmal Hören
    const eq = div("m-g-eq");
    for (let i = 0; i < 4; i++) eq.append(document.createElement("i"));
    const again = document.createElement("button");
    again.type = "button";
    again.className = "m-g-replay";
    again.textContent = "↻ " + t("gReplay");
    again.onclick = (e) => {
      e.stopPropagation();
      replay();
    };
    const listen = div("m-g-listen");
    listen.append(eq, again);
    box.append(listen);
  } else box.append(div("m-g-big m-g-pulse", "?"));
  const opts = div("m-g-opts" + (v.o?.length > 4 ? " is-many" : ""));
  const total = (v.d || []).reduce((a, b) => a + b, 0) || 1;
  v.o?.forEach((o, i) => {
    const tile = div(`m-g-opt is-t${i}` + (v.st === "rev" ? (i === v.right ? " is-right" : " is-dim") : ""));
    if (v.st === "rev") tile.style.setProperty("--w", Math.round(((v.d?.[i] || 0) / total) * 100) + "%");
    tile.append(div("m-g-let", TILES[i]), div("m-g-otx", o));
    if (v.st === "rev") tile.append(div("m-g-cnt", String(v.d?.[i] || 0)));
    opts.append(tile);
  });
  box.append(opts);
  // wer schon geantwortet hat, leuchtet auf
  if (v.st === "ask") box.append(div("m-g-who"));
  if (v.drink && v.sip?.length) box.append(div("m-g-sub is-sip", "🍺 " + t("gSipWho").replace("{n}", v.sip.join(", "))));
  if (v.st === "rev" && all().length) box.append(board(top()));
}
let beatRaf = 0;
function beatLoop() {
  cancelAnimationFrame(beatRaf);
  const run = () => {
    if (!G || G.k !== "beat" || !box?.isConnected) return;
    const ring = box.querySelector(".m-g-beat"), lights = box.querySelectorAll(".m-g-light");
    if (!ring) return;
    const p = ctx.pos() / 1000, bpm = ctx.bpm?.() || 120, beats = audio.data?.beats;
    let i, f;
    if (beats?.length) {
      i = Math.max(0, seek(beats, p, "t"));
      f = Math.max(0, p - beats[i].t) * (bpm / 60);
    } else {
      const x = p * (bpm / 60);
      i = Math.floor(x);
      f = x - i;
    }
    ring.style.scale = (1 + 0.24 * Math.exp(-f * 5)).toFixed(3);
    lights.forEach((l, k) => l.classList.toggle("is-on", k === i % 4));
    beatRaf = requestAnimationFrame(run);
  };
  run();
}
function buildEnd(v) {
  box.append(div("m-g-big", t("gEnd")));
  const list = v.top || [];
  const pod = div("m-g-podium");
  for (const i of [1, 0, 2]) {
    const x = list[i];
    if (!x) continue;
    const col = div(`m-g-pod is-p${i}`);
    col.append(div("m-g-medal", ["🥇", "🥈", "🥉"][i]), div("m-g-pname", x.n), div("m-g-ppts", String(x.p)), div("m-g-pbar"));
    pod.append(col);
  }
  if (list.length) box.append(pod);
  if (list.length > 3) box.append(board(list.slice(3).map((x) => ({ ...x }))));
}
// was sich laufend ändert, ohne die Karte neu zu bauen
function update(v) {
  if (v.st === "join") {
    const chips = box.querySelector(".m-g-chips");
    if (chips) {
      const names = all().map(nameOf), now = names.join("|");
      if (chips.dataset.now !== now) {
        chips.dataset.now = now;
        chips.textContent = "";
        names.slice(0, 16).forEach((n) => chips.append(div("m-g-chip", n)));
      }
    }
  }
  const who = box.querySelector(".m-g-who");
  if (who) {
    const now = all().map((p) => nameOf(p) + (p.ans ? "+" : "")).join("|");
    if (who.dataset.now !== now) {
      who.dataset.now = now;
      who.textContent = "";
      all().slice(0, 20).forEach((p) => who.append(div("m-g-chip" + (p.ans ? " is-on" : ""), nameOf(p))));
    }
  }
  const eq = box.querySelector(".m-g-eq");
  if (eq) eq.classList.toggle("is-still", !!G.paused);
  const sl = box.querySelector(".m-g-sline");
  if (sl) {
    sl.textContent = v.line || "";
    box.querySelector(".m-g-snext").textContent = v.lyn || "";
  }
  if (G.k === "battle") {
    const bars = box.querySelectorAll(".m-g-team");
    if (bars.length) {
      const x = v.a || 0, y = v.b || 0, sum = x + y || 1;
      bars[0].textContent = `A · ${x}`;
      bars[1].textContent = `B · ${y}`;
      bars[0].style.flexGrow = String(Math.max(0.15, x / sum));
      bars[1].style.flexGrow = String(Math.max(0.15, y / sum));
    }
  }
  if (G.k === "beat" || G.k === "taps") {
    const b = box.querySelector(".m-g-board");
    if (b) {
      // Rennbahnen: wer vorne liegt, sieht man sofort
      const list = top(), most = Math.max(1, ...list.map((x) => x.p));
      b.textContent = "";
      list.forEach((x, i) => {
        const r = row(["🥇", "🥈", "🥉"][i] || String(i + 1), x.n, String(x.p));
        r.classList.add("has-bar");
        r.style.setProperty("--w", Math.round((x.p / most) * 100) + "%");
        b.append(r);
      });
    }
    const bpm = box.querySelector(".m-g-bpm");
    if (bpm) bpm.textContent = `${v.bpm || 120} BPM`;
  }
}
const WHEEL_COLORS = ["#ff5a6e", "#4aa8ff", "#ffc23d", "#4fd68c", "#b583ff", "#ff8f4d"];
function drawWheel(v, build) {
  if (build) {
    const f = G.fields, n = f.length, w = div("m-g-wheel"), deg = 360 / n;
    w.style.background = `conic-gradient(${f.map((_, i) => `${WHEEL_COLORS[i % (n % 6 === 1 ? 5 : 6)]} ${i * deg}deg ${(i + 1) * deg}deg`).join(",")})`;
    f.forEach((x, i) => {
      const l = div("m-g-seg");
      l.style.rotate = `${(i + 0.5) * deg}deg`;
      l.append(div("m-g-segt", x.text));
      w.append(l);
    });
    const hub = div("m-g-hub", "🎡");
    w.onclick = spin;
    const stage = div("m-g-wstage");
    stage.append(div("m-g-pin"), w, hub);
    box.append(stage, div("m-g-big m-g-wres", ""));
  }
  const w = box.querySelector(".m-g-wheel");
  if (w && G.angle != null) w.style.transform = `rotate(${G.angle}deg)`;
  const res = box.querySelector(".m-g-wres");
  if (res) res.textContent = v.st === "res" ? v.text : v.st === "spin" ? "…" : t("gSpin");
}

export const games = {
  init(c) {
    ctx = c;
    muteRecover();
  },
  start,
  stop,
  spin,
  beginNow,
  skip,
  active: () => G?.k || null,
  waiting: () => G?.view?.st === "join",
  players: () => G?.players.size || 0,
};
