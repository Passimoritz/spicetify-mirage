/* ---------------------------------------------------------------- Party-Spiele */
// Fünf Spiele für den Party-Modus. Der PC führt Regie und zeigt alles groß, die Handys der Gäste sind die
// Controller (verschlüsselt über den Live-Link, wie die Songwünsche):
// · Wer singt hier?   – ein Song startet verdeckt, wer erkennt den Künstler zuerst?
// · Liedtext-Lücken   – eine kommende Zeile mit Lücke, welches Wort fehlt? Aufgelöst, wenn sie gesungen wird.
// · Musik-Stopp       – die Musik stoppt plötzlich: wer zu früh oder zu langsam tippt, fliegt raus.
// · Tanz-Battle       – zwei Teams schütteln 30 Sekunden ihre Handys.
// · Glücksrad         – dreht sich auf dem großen Bild und löst etwas aus (braucht keine Handys).
import { S } from "./core.js";
import { t } from "./i18n.js";
import { live } from "./live.js";

const ROUNDS = 5, ASK_MS = 20000;
let ctx = null, G = null, box = null, ticker = 0;

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
    p = { id, n: "", p: 0, out: false, team: 0, ans: null, e: 0 };
    G.players.set(id, p);
  }
  const name = clean(n, 20);
  if (name) p.n = name;
  return p;
}
const nameOf = (p) => p.n || `${t("rankGuest")} ${p.id.slice(-2).toUpperCase()}`;
const top = () => [...G.players.values()].sort((a, b) => b.p - a.p).slice(0, 5).map((p) => ({ n: nameOf(p), p: p.p }));
const after = (ms, fn) => G.timers.push(setTimeout(() => G && fn(), ms));
function clearTimers() {
  G?.timers.forEach(clearTimeout);
  if (G) G.timers = [];
}
// Stand veröffentlichen: an die Handys (mit dem nächsten Live-Bild) und aufs große Bild
function show(view) {
  G.view = view;
  live.setGame({ ...view, k: G.k, top: top() });
  render();
}
function hide(on) {
  // verdeckt: Titel, Künstler, Cover und Liedtext dürfen die Lösung nicht verraten
  ctx.root()?.classList.toggle("is-quiz", on === "quiz");
  ctx.root()?.classList.toggle("is-gap", on === "gap");
  live.mask(on === "quiz" ? "all" : on === "gap" ? "lyrics" : "");
}

/* ---- Start und Ende */
function start(kind) {
  if (!ctx) return;
  stop(true);
  G = { k: kind, r: 0, players: new Map(), view: null, timers: [], used: new Set() };
  clearInterval(ticker);
  ticker = setInterval(() => render(true), 300);
  ({ quiz: quizRound, gap: gapRound, stop: stopJoin, battle: battleJoin, wheel: wheelIdle }[kind] || (() => {}))();
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
  if (!silent) ctx.changed?.();
}
function finish() {
  clearTimers();
  hide("");
  const list = top();
  show({ st: "end", top: list });
  if (list.length) ctx.confetti?.();
  after(10000, () => stop());
  ctx.changed?.();
}

/* ---- Wer singt hier? */
function quizRound() {
  G.r++;
  if (G.r > ROUNDS) return finish();
  const list = upcoming(), next = list[0];
  const others = shuffle([...new Set(list.slice(1).map((x) => x.artist))].filter((a) => a && a !== next?.artist)).slice(0, 3);
  if (!next || others.length < 3) {
    notify(t("gNeedQueue"), true);
    return G.r > 1 ? finish() : stop();
  }
  hide("quiz");
  S.Player.next?.();
  const o = shuffle([next.artist, ...others]);
  for (const p of G.players.values()) p.ans = null;
  G.right = o.indexOf(next.artist);
  G.askedAt = Date.now();
  show({ st: "ask", r: G.r, of: ROUNDS, o, end: Date.now() + ASK_MS });
  after(ASK_MS, () => {
    award();
    hide("");
    show({ st: "rev", r: G.r, of: ROUNDS, o, right: G.right, title: next.title, artist: next.artist });
    after(9000, quizRound);
  });
}
// Punkte: richtig 100, dazu bis zu 100 für Schnelligkeit
function award() {
  const span = G.view?.end ? G.view.end - G.askedAt : ASK_MS;
  for (const p of G.players.values()) {
    if (p.ans && p.ans.v === G.right) p.p += 100 + Math.round(100 * Math.max(0, 1 - (p.ans.at - G.askedAt) / span));
  }
}

/* ---- Liedtext-Lücken */
const WORD = /[\p{L}\p{M}'’]{4,}/gu;
function gapRound() {
  G.r++;
  if (G.r > ROUNDS) return finish();
  askGap(0);
}
function askGap(tries) {
  const lines = ctx.lines(), pos = ctx.pos();
  const pick = (lines || []).find((l, i) => l.t > pos + 7000 && l.t < pos + 30000 && !G.used.has(i) && (l.text || "").match(WORD) && (G.used.add(i), true));
  if (!pick) {
    // kein Liedtext oder keine passende Zeile: auf den nächsten Abschnitt oder Song warten
    if (tries > 8) {
      notify(t("gNeedLyrics"), true);
      return G.r > 1 ? finish() : stop();
    }
    show({ st: "wait", r: G.r, of: ROUNDS });
    return after(4000, () => askGap(tries + 1));
  }
  const words = pick.text.match(WORD), word = words.sort((a, b) => b.length - a.length)[0];
  const pool = [...new Set((lines || []).flatMap((l) => (l.text || "").match(WORD) || []).map((w) => w.toLocaleLowerCase()))].filter((w) => w !== word.toLocaleLowerCase());
  const close = shuffle(pool).sort((a, b) => Math.abs(a.length - word.length) - Math.abs(b.length - word.length)).slice(0, 3);
  if (close.length < 3) return after(4000, () => askGap(tries + 1));
  const o = shuffle([word.toLocaleLowerCase(), ...close]);
  const wait = pick.t - pos;
  for (const p of G.players.values()) p.ans = null;
  G.right = o.indexOf(word.toLocaleLowerCase());
  G.askedAt = Date.now();
  hide("gap");
  show({ st: "ask", r: G.r, of: ROUNDS, o, line: pick.text.replace(word, "_____"), end: Date.now() + wait });
  after(wait, () => {
    award();
    hide("");
    show({ st: "rev", r: G.r, of: ROUNDS, o, right: G.right, line: pick.text });
    after(8000, gapRound);
  });
}

/* ---- Musik-Stopp */
function stopJoin() {
  show({ st: "join", end: Date.now() + 15000 });
  after(15000, () => {
    if (G.players.size < 2) {
      notify(t("gNeedPlayers"), true);
      return stop();
    }
    stopPlay();
  });
}
const alive = () => [...G.players.values()].filter((p) => !p.out);
function stopPlay() {
  G.r++;
  const left = alive();
  if (left.length <= 1 || G.r > 8) {
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
      show({ st: "res", r: G.r, left: alive().length, out: [...G.players.values()].filter((p) => p.out).map(nameOf).slice(-4) });
      after(3000, stopPlay);
    });
  });
}

/* ---- Tanz-Battle */
function battleJoin() {
  show({ st: "join", end: Date.now() + 15000 });
  after(15000, () => {
    if (G.players.size < 2) {
      notify(t("gNeedPlayers"), true);
      return stop();
    }
    // Teams abwechselnd füllen, damit sie gleich groß sind
    shuffle([...G.players.values()]).forEach((p, i) => (p.team = i % 2));
    G.score = [0, 0];
    G.end = Date.now() + 30000;
    battleTick();
    after(30000, () => {
      clearTimers();
      const win = G.score[0] === G.score[1] ? -1 : G.score[0] > G.score[1] ? 0 : 1;
      for (const p of G.players.values()) if (p.team === win || win < 0) p.p += 100;
      if (win >= 0) ctx.confetti?.();
      show({ st: "res", a: Math.round(G.score[0]), b: Math.round(G.score[1]), win });
      after(5000, finish);
    });
  });
}
function battleTick() {
  // je Team der Durchschnitt: ein größeres Team hat keinen Vorteil
  const size = [0, 0], sum = [0, 0];
  for (const p of G.players.values()) {
    size[p.team]++;
    sum[p.team] += p.e;
  }
  G.score = [0, 1].map((k) => (size[k] ? sum[k] / size[k] : 0));
  const teams = {};
  for (const p of G.players.values()) teams[p.id.slice(-6)] = p.team;
  show({ st: "go", a: Math.round(G.score[0]), b: Math.round(G.score[1]), end: G.end, teams });
  after(500, battleTick);
}

/* ---- Glücksrad */
const WHEEL = ["wh1", "wh2", "wh3", "wh4", "wh5", "wh6", "wh7", "wh8"];
function wheelIdle() {
  show({ st: "idle" });
}
function spin() {
  if (!G || G.k !== "wheel" || G.view?.st === "spin") return;
  const i = Math.floor(Math.random() * WHEEL.length), turns = (G.turns || 0) + 5;
  G.turns = turns;
  G.angle = turns * 360 - (i + 0.5) * (360 / WHEEL.length);
  show({ st: "spin" });
  after(5200, () => {
    wheelEffect(WHEEL[i]);
    show({ st: "res", text: t(WHEEL[i]) });
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
  const p = player(m.id, m.n);
  if (m.a === "join") return render();
  // Fragen: eine Antwort je Runde
  if ((G.k === "quiz" || G.k === "gap") && m.a === "ans" && v.st === "ask" && m.r === v.r && !p.ans) {
    const val = Number(m.v);
    if (val >= 0 && val < v.o.length) p.ans = { v: val, at: Date.now() };
    return;
  }
  if (G.k === "stop") {
    if (m.a !== "tap" || m.r !== v.r || p.out) return;
    // zu früh getippt (Musik läuft noch): raus
    if (v.st === "play") p.out = true;
    else if (v.st === "stop" && !p.ans) p.ans = { ms: Math.max(0, Math.min(5000, Number(m.ms) || 5000)) };
    return;
  }
  if (G.k === "battle" && m.a === "e" && v.st === "go") p.e += Math.max(0, Math.min(40, Number(m.v) || 0));
});

/* ---- Anzeige auf dem großen Bild */
const LABEL = { quiz: "gQuiz", gap: "gGap", stop: "gStop", battle: "gBattle", wheel: "gWheel" };
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
  }
  const v = G.view || {};
  // Nur die Restzeit weiterzählen: nicht jedes Mal alles neu bauen (das Rad dreht sonst nicht)
  if (tickOnly) {
    const c = box.querySelector(".m-g-time");
    if (c && v.end) c.textContent = secs(v.end) + " s";
    return;
  }
  if (G.k === "wheel" && box.querySelector(".m-g-wheel")) return drawWheel(v);
  box.textContent = "";
  box.dataset.st = v.st || "";
  const head = div("m-g-head", t(LABEL[G.k]));
  if (v.r && v.of) head.append(div("m-g-round", `${v.r} / ${v.of}`));
  if (v.end) head.append(div("m-g-time", secs(v.end) + " s"));
  box.append(head);
  if (v.st === "end") {
    box.append(div("m-g-big", t("gEnd")));
    box.append(board(v.top));
    return;
  }
  if (G.k === "wheel") return drawWheel(v, true);
  if (v.st === "join") {
    box.append(div("m-g-big", t(G.k === "stop" ? "gStopJoin" : "gBattleJoin")));
    box.append(div("m-g-sub", t("gPlayers").replace("{n}", G.players.size)));
  } else if (v.st === "wait") {
    box.append(div("m-g-sub", t("gWaitLine")));
  } else if (G.k === "quiz" || G.k === "gap") {
    if (v.line) box.append(div("m-g-line", v.line));
    else box.append(div("m-g-big", v.st === "rev" ? `${v.artist} – ${v.title}` : "?"));
    const opts = div("m-g-opts");
    v.o?.forEach((o, i) => opts.append(div("m-g-opt" + (v.st === "rev" && i === v.right ? " is-right" : ""), o)));
    box.append(opts);
    if (v.st === "rev") box.append(board(top()));
  } else if (G.k === "stop") {
    if (v.st === "play") box.append(div("m-g-big", t("gStopPlay")));
    if (v.st === "stop") box.append(div("m-g-big is-hot", t("gStopNow")));
    if (v.st === "res") box.append(div("m-g-sub", (v.out || []).join(" · ")));
    box.append(div("m-g-sub", t("gLeft").replace("{n}", v.left ?? alive().length)));
  } else if (G.k === "battle") {
    const a = v.a || 0, b = v.b || 0, sum = a + b || 1;
    const bars = div("m-g-battle");
    const ba = div("m-g-team", `A · ${a}`), bb = div("m-g-team is-b", `B · ${b}`);
    ba.style.flexGrow = String(Math.max(0.15, a / sum));
    bb.style.flexGrow = String(Math.max(0.15, b / sum));
    bars.append(ba, bb);
    box.append(div("m-g-big", v.st === "res" ? (v.win < 0 ? t("gDraw") : t("gTeamWin").replace("{t}", v.win ? "B" : "A")) : t("gShake")), bars);
  }
}
function board(list) {
  const d = div("m-g-board");
  (list || []).forEach((x, i) => d.append(div("m-g-row", `${i + 1}. ${x.n} · ${x.p}`)));
  return d;
}
function drawWheel(v, build) {
  if (build) {
    const w = div("m-g-wheel"), n = WHEEL.length;
    WHEEL.forEach((k, i) => {
      const l = div("m-g-seg", t(k));
      l.style.transform = `rotate(${(i + 0.5) * (360 / n)}deg) translateY(-37%)`;
      w.append(l);
    });
    w.onclick = spin;
    box.append(div("m-g-pin"), w, div("m-g-big m-g-wres", ""));
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
  active: () => G?.k || null,
  players: () => G?.players.size || 0,
};
