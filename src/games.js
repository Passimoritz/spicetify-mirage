/* ---------------------------------------------------------------- Party-Spiele */
// Elf Spiele für den Party-Modus. Der PC führt Regie und zeigt alles groß, die Handys der Gäste sind die
// Controller (verschlüsselt über den Live-Link, wie die Songwünsche). Die Songs kommen aus der Spotify-
// Warteschlange, die Zeilen aus dem zeitgenauen Liedtext des laufenden Songs.
// Musik-Quiz:      Wer singt hier? · Wie heißt der Song? · Liedtext-Lücken · Nächste Zeile · Beat-Treffer
// Schnelle Finger: Musik-Stopp · Schnellster Finger · Tanz-Battle · Heiße Kartoffel
// Party:           Wer würde am ehesten …? · Glücksrad (braucht keine Handys)
import { S } from "./core.js";
import { cfg } from "./config.js";
import { t } from "./i18n.js";
import { live } from "./live.js";

export const GAME_LIST = [
  { k: "quiz", cat: "gCatMusic", label: "gQuiz", hint: "gQuizHint", icon: "🎤" },
  { k: "title", cat: "gCatMusic", label: "gTitleQ", hint: "gTitleQHint", icon: "🎵" },
  { k: "gap", cat: "gCatMusic", label: "gGap", hint: "gGapHint", icon: "✏️" },
  { k: "next", cat: "gCatMusic", label: "gNext", hint: "gNextHint", icon: "📜" },
  { k: "beat", cat: "gCatMusic", label: "gBeat", hint: "gBeatHint", icon: "🥁" },
  { k: "stop", cat: "gCatQuick", label: "gStop", hint: "gStopHint", icon: "✋" },
  { k: "fast", cat: "gCatQuick", label: "gFast", hint: "gFastHint", icon: "⚡" },
  { k: "battle", cat: "gCatQuick", label: "gBattle", hint: "gBattleHint", icon: "💃" },
  { k: "bomb", cat: "gCatQuick", label: "gBomb", hint: "gBombHint", icon: "💣" },
  { k: "likely", cat: "gCatParty", label: "gLikely", hint: "gLikelyHint", icon: "🤔" },
  { k: "wheel", cat: "gCatParty", label: "gWheel", hint: "gWheelHint", icon: "🎡" },
];
const INFO = Object.fromEntries(GAME_LIST.map((g) => [g.k, g]));
export const WHEEL_FIELDS = ["wh1", "wh2", "wh3", "wh4", "wh5", "wh6", "wh7", "wh8"];
// So viele müssen mitmachen, damit das Spiel Sinn ergibt (Quiz geht auch nur für den Raum)
const MIN = { stop: 2, fast: 2, beat: 2, battle: 2, bomb: 2, likely: 2 };
const OUT_GAMES = new Set(["stop", "bomb"]);
const TILES = ["A", "B", "C", "D", "E", "F"];

const rounds = () => Number(cfg.gameRounds) || 5;
const askMs = () => (Number(cfg.gameAsk) || 20) * 1000;
const joinMs = () => (Number(cfg.gameJoin) || 30) * 1000;
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
const upcoming = () =>
  (S.Queue?.nextTracks || [])
    .map((x) => x.contextTrack || x)
    .filter((x) => x?.uri?.startsWith("spotify:track:") && x.metadata?.title)
    .map((x) => ({ title: x.metadata.title, artist: String(x.metadata.artist_name || "").split(",")[0].trim() }));

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
function clearTimers() {
  if (!G) return;
  G.timers.forEach(clearTimeout);
  G.timers = [];
  clearInterval(G.tick);
}
// Stand veröffentlichen: an die Handys (mit dem nächsten Live-Bild) und aufs große Bild
function publish() {
  const sc = {}, out = [];
  for (const p of all().slice(0, 40)) {
    sc[short(p.id)] = Math.round(p.p);
    if (p.out) out.push(short(p.id));
  }
  live.setGame({ ...G.view, id: G.id, k: G.k, top: top(), sc, out, n: all().length, ans: all().filter((p) => p.ans).length, names: all().slice(0, 16).map(nameOf) });
}
function show(view) {
  if (view.end && !view.dur) view.dur = view.end - Date.now();
  G.view = view;
  publish();
  render();
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
};
function start(kind) {
  if (!ctx) return;
  stop(true);
  G = { k: kind, id: Math.random().toString(36).slice(2, 8), r: 0, players: new Map(), view: null, timers: [], used: new Set(), lastFn: null };
  boxKey = "";
  clearInterval(ticker);
  ticker = setInterval(() => render(true), 250);
  if (kind === "wheel") return wheelIdle();
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
  show({ st: "ask", r: G.r, of: rounds(), ...view, end: Date.now() + ms });
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

/* ---- Wer singt hier? · Wie heißt der Song? */
function songRound() {
  G.r++;
  if (G.r > rounds()) return finish();
  const field = G.k === "quiz" ? "artist" : "title";
  const list = upcoming(), next = list[0];
  const others = shuffle([...new Set(list.slice(1).map((x) => x[field]))].filter((a) => a && a !== next?.[field])).slice(0, 3);
  if (!next || others.length < 3) {
    notify(t("gNeedQueue"), true);
    return G.r > 1 ? finish() : stop();
  }
  hide("quiz");
  S.Player.next?.();
  const o = shuffle([next[field], ...others]);
  G.right = o.indexOf(next[field]);
  ask({ o }, askMs(), () => {
    const d = award();
    hide("");
    show({ st: "rev", r: G.r, of: rounds(), o, d, right: G.right, title: next.title, artist: next.artist });
    after(breakMs(), songRound);
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
function askLine(tries) {
  const lines = ctx.lines() || [], pos = ctx.pos(), gap = G.k === "gap";
  const ahead = Math.max(20000, askMs() + 6000);
  const fits = (l, i) => l.t > pos + 7000 && l.t < pos + ahead && !G.used.has(i) && (gap ? !!gapWord(l.text || "") : i > 0 && !!lines[i - 1].text?.trim() && (l.text || "").trim().length > 2);
  const i = lines.findIndex(fits), pick = lines[i];
  const retry = () => {
    // kein Liedtext oder keine passende Zeile: auf den nächsten Abschnitt oder Song warten
    if (tries > 8) {
      notify(t("gNeedLyrics"), true);
      return G.r > 1 ? finish() : stop();
    }
    show({ st: "wait", r: G.r, of: rounds() });
    after(4000, () => askLine(tries + 1));
  };
  if (!pick) return retry();
  let answer, pool, line;
  if (gap) {
    const word = gapWord(pick.text);
    answer = word.toLocaleLowerCase();
    pool = [...new Set(lines.flatMap((l) => l.text?.match(WORD) || []).map((w) => w.toLocaleLowerCase()))].filter((w) => w !== answer && w.length <= 18);
    pool = shuffle(pool).sort((a, b) => Math.abs(a.length - answer.length) - Math.abs(b.length - answer.length));
    line = pick.text.replace(word, "_____");
  } else {
    answer = pick.text.trim().slice(0, 70);
    pool = shuffle([...new Set(lines.map((l) => (l.text || "").trim().slice(0, 70)))].filter((x) => x.length > 2 && x !== answer));
    line = lines[i - 1].text.trim();
  }
  if (pool.length < 3) return retry();
  G.used.add(i);
  const o = shuffle([answer, ...pool.slice(0, 3)]);
  G.right = o.indexOf(answer);
  hide("gap");
  ask({ o, line }, pick.t - pos, () => {
    const d = award();
    hide("");
    show({ st: "rev", r: G.r, of: rounds(), o, d, right: G.right, line: pick.text });
    after(breakMs(), lineRound);
  });
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
    show({ st: "go", r: G.r, of: rounds(), at: Date.now(), end: Date.now() + 3500 });
    after(3500, () => {
      const list = all().filter((p) => p.ans && !p.early).sort((a, b) => a.ans.ms - b.ans.ms);
      list.forEach((p, i) => (p.p += FAST_PTS[i] ?? 10));
      show({ st: "res", r: G.r, of: rounds(), win: list.slice(0, 3).map((p) => ({ n: nameOf(p), ms: p.ans.ms })) });
      after(Math.min(5000, breakMs()), fastRound);
    });
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

/* ---- Beat-Treffer: das Handy misst den Abstand zum Schlag und meldet seinen Punktestand */
function beatGo() {
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
  after(12000 + Math.random() * 20000, () => {
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
  const o = names.map(nameOf), q = t("gL" + i);
  G.right = -1;
  ask({ o, q }, askMs(), () => {
    const d = award(), most = Math.max(...d);
    const right = most > 0 ? d.indexOf(most) : -1;
    // wer mit der Mehrheit gestimmt hat, bekommt die Punkte
    for (const p of all()) if (p.ans && right >= 0 && d[p.ans.v] === most) p.p += 50;
    show({ st: "rev", r: G.r, of: rounds(), o, d, right, q });
    after(breakMs(), likelyRound);
  });
}

/* ---- Glücksrad */
function wheelFields() {
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
  if (!G || G.k !== "wheel" || G.view?.st === "spin") return;
  const n = G.fields.length, i = Math.floor(Math.random() * n), turns = (G.turns || 0) + 5;
  G.turns = turns;
  G.angle = turns * 360 - (i + 0.5) * (360 / n);
  show({ st: "spin" });
  after(5200, () => {
    wheelEffect(G.fields[i].k);
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
  if (["quiz", "title", "gap", "next", "likely"].includes(G.k) && m.a === "ans" && v.st === "ask" && m.r === v.r && !p.ans) {
    const val = Number(m.v);
    if (val >= 0 && val < v.o.length) p.ans = { v: val, at: Date.now() };
    publish();
    render();
    // alle haben geantwortet: nicht warten (Lücken und Zeilen lösen sich erst beim Singen auf)
    if (["quiz", "title", "likely"].includes(G.k) && alive().every((x) => x.ans)) {
      clearTimers();
      G.onAsked?.();
    }
    return;
  }
  if (G.k === "stop") {
    if (m.a !== "tap" || m.r !== v.r || p.out) return;
    // zu früh getippt (Musik läuft noch): raus
    if (v.st === "play") p.out = true;
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
  if (G.k === "bomb" && m.a === "pass" && v.st === "go" && p === G.holder && m.v === G.seq) {
    const rest = alive().filter((x) => x !== p);
    if (rest.length) {
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
const secs = (end) => Math.max(0, Math.ceil((end - Date.now()) / 1000));
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
  if (c) c.textContent = v.end ? secs(v.end) + " s" : "";
  if (tickOnly) return;
  if (G.k === "wheel" && box.querySelector(".m-g-wheel")) return drawWheel(v);
  const key = [G.k, v.st, v.r, v.q, v.line, v.h].join("|");
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
  h.append(div("m-g-time", v.end ? secs(v.end) + " s" : ""));
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
  if (G.k === "wheel") return drawWheel(v, true);
  if (v.st === "join") return buildJoin();
  if (v.st === "wait") return box.append(div("m-g-sub", t("gWaitLine")));
  if (["quiz", "title", "gap", "next", "likely"].includes(G.k)) return buildAsk(v);
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
    const ring = div("m-g-beat");
    ring.style.setProperty("--beat", (60 / (v.bpm || 120)).toFixed(3) + "s");
    box.append(ring, div("m-g-big", t("gBeatGo")), div("m-g-board"));
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
  if (v.q) box.append(div("m-g-line", v.q));
  else if (v.line) box.append(div("m-g-line", v.line));
  else if (v.st === "rev") box.append(div("m-g-big", `${v.artist} – ${v.title}`));
  else box.append(div("m-g-big m-g-pulse", "?"));
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
  if (v.st === "ask") box.append(div("m-g-sub m-g-ans"));
  if (v.st === "rev" && all().length) box.append(board(top()));
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
  const a = box.querySelector(".m-g-ans");
  if (a) a.textContent = t("gAnswered").replace("{n}", all().filter((p) => p.ans).length) + " · " + t("gPlayers").replace("{n}", all().length);
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
  if (G.k === "beat") {
    const b = box.querySelector(".m-g-board");
    if (b) {
      b.textContent = "";
      top().forEach((x, i) => b.append(row(["🥇", "🥈", "🥉"][i] || String(i + 1), x.n, String(x.p))));
    }
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
