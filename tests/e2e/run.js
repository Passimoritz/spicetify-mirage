// End-to-End-Test aller Party-Spiele: das echte Theme (Mirage/theme.js) und die echte Handy-Seite (docs/live) reden über
// einen echten MQTT-Relay miteinander. Drei Gäste treten über den gescannten QR-Code bei und spielen mit echten
// Mausklicks: ist ein Knopf verdeckt oder liegt er außerhalb des Bildes, schlägt der Test fehl.
//   npm run test:games                     alles
//   E2E_ONLY=quiz,bomb npm run test:games  nur diese
//   E2E_RELAY=public npm run test:games    über die echten öffentlichen Relays statt lokal
const { app, BrowserWindow, session } = require("electron");
const fs = require("fs"), path = require("path"), http = require("http");
const { startBroker } = require("./broker.js");

const ROOT = path.join(__dirname, "..", ".."), OUT = path.join(__dirname, "out");
const LIVE = path.join(ROOT, "docs", "live");
const PUBLIC = process.env.E2E_RELAY === "public";
const ONLY = (process.env.E2E_ONLY || "").split(",").filter(Boolean);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ICON = { quiz: "🎤", title: "🎵", intro: "⏱️", gap: "✏️", next: "📜", tf: "🕵️", beat: "🥁", stop: "✋", fast: "⚡", taps: "👆", battle: "💃", bomb: "💣", likely: "🤔", sing: "🎙️", wheel: "🎡", never: "🙈", dquiz: "🍻", alarm: "🚨", dlikely: "👉", dwheel: "🍀" };
const SETTINGS = { gameRounds: 2, gameAsk: 14, gameBreak: 2, gameDur: 10, gameClip: 6, gameJoin: 120, gameSfx: 0.7, partyLive: true, partyWishes: true };

app.on("window-all-closed", () => {});
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
app.commandLine.appendSwitch("disable-gpu");
// Tests sind immer lautlos: kein Ton aus den Lautsprechern, auch nicht von den Soundeffekten
app.commandLine.appendSwitch("mute-audio");

function ok(cond, msg) {
  if (!cond) throw new Error(msg);
}
async function until(fn, ms, what) {
  const t0 = Date.now();
  let last;
  while (Date.now() - t0 < ms) {
    last = await fn();
    if (last) return last;
    await wait(80);
  }
  throw new Error(`Zeitüberschreitung (${ms} ms): ${what}`);
}

class Win {
  constructor(name, win) {
    this.name = name;
    this.win = win;
    this.wc = win.webContents;
    this.wc.setAudioMuted(true);
    this.errors = [];
    this.wc.on("console-message", (_e, level, msg) => {
      if (level >= 3 && !/Failed to load resource|net::ERR|Autofill|ResizeObserver/.test(msg)) this.errors.push(msg.slice(0, 400));
    });
    this.wc.on("render-process-gone", (_e, d) => this.errors.push("Renderer weg: " + d.reason));
  }
  js(code) {
    return this.wc.executeJavaScript(code);
  }
  // Echter Klick: das Element muss an dieser Stelle wirklich oben liegen
  async click(sel, opts = {}) {
    const spec = JSON.stringify({ sel, ...opts });
    const look = () => this.js(`(() => {
      const o = ${spec};
      let list = [...document.querySelectorAll(o.sel)].filter((e) => e.getClientRects().length);
      if (o.text) list = list.filter((e) => e.textContent.includes(o.text));
      const el = list[o.index || 0];
      if (!el) return { miss: true };
      el.scrollIntoView({ block: "center", inline: "center" });
      const r = el.getBoundingClientRect(), x = Math.round(r.left + r.width / 2), y = Math.round(r.top + r.height / 2);
      const hit = document.elementFromPoint(x, y);
      const name = (e) => e ? (e.tagName + "." + String(e.className).slice(0, 60)) : "nichts";
      return { x, y, on: !!hit && (hit === el || el.contains(hit)), hit: name(hit), off: x < 0 || y < 0 || x > innerWidth || y > innerHeight };
    })()`);
    let p = await look();
    // während eines Ansichtswechsels (View Transition) liegt kurz nichts Klickbares oben
    for (let n = 0; n < 15 && !p.miss && !p.on && p.hit.startsWith("HTML"); n++) {
      await wait(100);
      p = await look();
    }
    ok(!p.miss, `${this.name}: „${sel}${opts.text ? " " + opts.text : ""}“ nicht sichtbar`);
    ok(!p.off, `${this.name}: „${sel}“ liegt außerhalb des Bildes`);
    ok(p.on, `${this.name}: „${sel}“ ist verdeckt von ${p.hit}`);
    this.wc.sendInputEvent({ type: "mouseMove", x: p.x, y: p.y });
    await wait(15);
    this.wc.sendInputEvent({ type: "mouseDown", x: p.x, y: p.y, button: "left", clickCount: 1 });
    await wait(15);
    this.wc.sendInputEvent({ type: "mouseUp", x: p.x, y: p.y, button: "left", clickCount: 1 });
    await wait(30);
  }
  async shot(file) {
    try {
      fs.writeFileSync(file, (await this.wc.capturePage()).toPNG());
    } catch {}
  }
}

// große Leinwand
const big = {
  state: () => T.js(`(() => {
    const g = document.querySelector("#mirage-immersive .m-im-game"), im = document.getElementById("mirage-immersive");
    return { ...__sp.now(), open: !!g, k: g?.dataset.k, st: g?.dataset.st, text: g?.innerText.replace(/\\s+/g, " ").slice(0, 300) || "", lock: im.classList.contains("is-game-lock"),
      opts: [...(g?.querySelectorAll(".m-g-otx") || [])].map((x) => x.textContent), right: g?.querySelector(".m-g-opt.is-right .m-g-otx")?.textContent,
      chips: g?.querySelectorAll(".m-g-chip").length || 0, replay: !!g?.querySelector(".m-g-replay") };
  })()`),
  hover: async () => {
    T.wc.sendInputEvent({ type: "mouseMove", x: 640, y: 300 + Math.floor(Math.random() * 40) });
    await wait(60);
  },
};
const phoneState = (ph) => ph.js(`(() => {
  const g = document.getElementById("game"), tiles = [...g.querySelectorAll(".tile")];
  return { hidden: g.hidden, k: g.dataset.k, st: g.dataset.st, round: g.querySelector(".grd")?.textContent || "", text: g.innerText.replace(/\\s+/g, " ").slice(0, 300),
    tiles: tiles.map((t) => t.querySelector("span").textContent), right: tiles.findIndex((t) => t.classList.contains("right")), verdict: g.querySelector(".gverdict")?.className || "",
    h2: g.querySelector("h2")?.textContent || "" };
})()`);
const allPhones = (fn, ms, what) => until(async () => {
  const s = await Promise.all(P.map(phoneState));
  return s.every(fn) && s;
}, ms, what);

let T, P = [], brokers = [], hash = "";

/* ---------------------------------------------------------------- Ablauf */
async function openGame(k) {
  await big.hover();
  await T.click(".m-im-gamebtn");
  await until(() => T.js(`!document.querySelector(".m-im-side").hidden`), 2000, "Spiele-Liste geht auf");
  await T.click(".m-im-side-body .m-im-side-item", { text: ICON[k] });
}
async function joinAll(k, who = P) {
  await until(async () => (await big.state()).st === "join", 4000, "Warteraum auf dem großen Bild");
  if (!hash) await connectPhones();
  await until(async () => (await Promise.all(who.map(phoneState))).every((s) => !s.hidden && s.k === k && s.st === "join"), 12000, "Handys zeigen den Warteraum");
  for (const ph of who) await ph.click("#game button.go");
  await until(async () => (await big.state()).chips === who.length, 6000, `${who.length} Gäste auf dem großen Bild`);
  await big.hover();
  await T.click(".m-g-go");
}
// Gäste scannen den QR-Code vom großen Bild
async function connectPhones() {
  await until(() => T.js(`!!document.querySelector(".m-g-qr")?.naturalWidth`), 8000, "QR-Code im Warteraum");
  await T.js(fs.readFileSync(path.join(LIVE, "qr.js"), "utf8") + ";1");
  const url = await T.js(`(async () => {
    const im = document.querySelector(".m-g-qr"), c = document.createElement("canvas");
    c.width = c.height = 640;
    const x = c.getContext("2d");
    x.fillStyle = "#fff";
    x.fillRect(0, 0, 640, 640);
    x.drawImage(im, 0, 0, 640, 640);
    return jsQR(x.getImageData(0, 0, 640, 640).data, 640, 640)?.data || "";
  })()`);
  ok(url.includes("#c=") && url.includes("&k="), "QR-Code enthält keinen Mirage-Link: " + url.slice(0, 80));
  hash = url.slice(url.indexOf("#"));
  await Promise.all(P.map(async (ph) => {
    await ph.win.loadURL(PAGE + hash);
    await ph.js(`localStorage.setItem("mlName", ${JSON.stringify(ph.name)}); localStorage.setItem("mlSfx", "0"); 1`);
    await ph.wc.executeJavaScript("location.reload(); 1").catch(() => {});
  }));
  await wait(800);
}
async function close() {
  await big.hover();
  if ((await big.state()).open) await T.click(".m-g-x");
}
const tileOf = (s, want) => s.tiles.findIndex((x) => x === want);
const tile = (i) => [".tile", { index: i }];

/* ---- Prüfungen nach jedem Spiel */
async function afterGame(k) {
  await until(async () => {
    const s = await big.state();
    return !s.open && !s.lock && s.vol === 0.7;
  }, 4000, `${k}: Spiel ist zu, Sperre aus, Lautstärke zurück`);
  await allPhones((s) => s.hidden, 3000, `${k}: Handys zeigen kein Spiel mehr`);
  const errs = [T, ...P].flatMap((w) => w.errors.splice(0).map((e) => w.name + ": " + e));
  ok(!errs.length, "Fehler in der Konsole:\n  " + errs.slice(0, 5).join("\n  "));
  await T.js(`__sp.reset(); __sp.log.notes.length = 0; 1`);
  await wait(400);
}
const noBadNotes = async (k) => {
  const notes = await T.js(`__sp.log.notes.filter((n) => n.err)`);
  ok(!notes.length, `${k}: Fehlermeldung auf dem großen Bild: ${notes.map((n) => n.msg).join("; ")}`);
};

/* ---- Lied erraten: Wer singt hier? · Wie heißt der Song? · Intro-Blitz · Schluck-Quiz */
const cleanTitle = (s) => s.replace(/\s+-\s+.*(remaster|version|edit|live|mix|mono|stereo).*$/i, "").replace(/\s*[([](feat|ft|with|remaster|live)[^)\]]*[)\]]/gi, "").trim();
async function songGame(k) {
  const field = k === "quiz" || k === "dquiz" ? "artist" : "title";
  await T.js(`__sp.setShuffleJump(2); __sp.log.audible = {}; 1`);
  await openGame(k);
  await joinAll(k);
  let first = true;
  for (const r of [1, 2]) {
    const ps = await allPhones((s) => s.k === k && s.st === "ask" && s.round === `${r}/2` && s.tiles.length === 4, 15000, `${k}: Frage ${r} auf allen Handys`);
    const b = await big.state(), want = field === "artist" ? b.artist : cleanTitle(b.title);
    ok(b.st === "ask" && b.opts.length === 4, `${k}: großes Bild zeigt die Frage (${b.st})`);
    ok(b.opts.join() === ps[0].tiles.join(), `${k}: großes Bild und Handy zeigen dieselben Antworten`);
    ok(ps[0].tiles.includes(want), `${k}: die richtige Antwort „${want}“ (läuft gerade) steht zur Auswahl: ${ps[0].tiles.join(" | ")}`);
    ok(b.lock, `${k}: Wiedergabe ist gesperrt`);
    ok(b.replay, `${k}: Knopf „Nochmal abspielen“ ist da`);
    ok(b.playing && b.vol === 0.7, `${k}: Musik läuft und ist nicht stumm (spielt=${b.playing}, Lautstärke=${b.vol})`);
    const heard = await T.js(`__sp.log.audible[${JSON.stringify(b.uri)}]`);
    ok(heard, `${k}: Song war hörbar`);
    if (k === "intro") ok(heard.min < 2500, `${k}: Intro beginnt am Anfang, hörbar ab ${heard.min} ms`);
    else ok(heard.min > 15000, `${k}: vom Songanfang darf nichts zu hören sein, hörbar ab ${heard.min} ms`);
    if (first) {
      // Sperre: echter Klick auf Weiter und die Taste N ändern nichts
      const n0 = await T.js(`__sp.log.next`);
      await big.hover();
      await T.click(".m-im-next");
      await T.js(`__sp.press("KeyN"); 1`);
      await wait(400);
      ok((await T.js(`__sp.log.next`)) === n0, `${k}: Weiter ist während des Spiels gesperrt`);
      // Ausschnitt endet, Nochmal abspielen startet ihn wieder
      const clip = k === "intro" ? 5000 : 6000;
      await until(async () => !(await big.state()).playing, clip + 3000, `${k}: Ausschnitt stoppt`);
      await big.hover();
      await T.click(".m-g-replay");
      const again = await until(async () => {
        const s = await big.state();
        return s.playing && s;
      }, 1500, `${k}: Nochmal abspielen startet die Musik`);
      if (k === "intro") ok(again.pos < 2000, `${k}: Nochmal beginnt von vorn (${again.pos})`);
      first = false;
    }
    const right = tileOf(ps[0], want), wrong = (right + 1) % 4;
    await P[0].click(...tile(right));
    await P[1].click(...tile(wrong));
    await P[2].click(...tile(r === 1 ? wrong : right));
    const rev = await allPhones((s) => s.st === "rev" && s.round === `${r}/2`, 6000, `${k}: Auflösung, sobald alle geantwortet haben`);
    ok(rev[0].right === right, `${k}: Handy löst richtig auf`);
    ok(/hit/.test(rev[0].verdict), `${k}: Alpha hat richtig: ${rev[0].verdict}`);
    if (k === "dquiz") ok(/sip/.test(rev[1].verdict), `${k}: Beta muss trinken: ${rev[1].verdict}`);
    else ok(/miss/.test(rev[1].verdict), `${k}: Beta hat falsch: ${rev[1].verdict}`);
    const after = await big.state();
    ok(after.right === want, `${k}: großes Bild löst auf „${want}“ auf (${after.right})`);
    await until(async () => (await big.state()).playing, 1500, `${k}: Musik läuft bei der Auflösung`);
  }
  await allPhones((s) => s.st === "end", 12000, `${k}: Siegerehrung`);
  const end = await big.state();
  ok(/Alpha/.test(end.text.split("🥇")[1] || ""), `${k}: Alpha gewinnt: ${end.text}`);
  ok(end.vol === 0.7 && !end.lock, `${k}: am Ende nicht stumm, nicht gesperrt`);
  await noBadNotes(k);
  await close();
}

/* ---- Liedtext: Lücken, nächste Zeile, Echt oder Fake */
async function lineGame(k) {
  await openGame(k);
  await joinAll(k);
  for (const r of [1, 2]) {
    const ps = await allPhones((s) => s.k === k && s.st === "ask" && s.round === `${r}/2` && s.tiles.length >= 2, 45000, `${k}: Frage ${r} auf allen Handys`);
    const shown = ps[0].h2, b = await big.state(), lyrics = await T.js(`__sp.lyrics(${JSON.stringify(b.uri)})`);
    ok(lyrics.length, `${k}: läuft nur bei Songs mit Liedtext (${b.title})`);
    ok(shown, `${k}: Handy zeigt eine Zeile`);
    if (k === "gap") ok(shown.includes("_____"), `${k}: Zeile hat eine Lücke: ${shown}`);
    if (k === "next") ok(lyrics.includes(shown), `${k}: gezeigte Zeile stammt aus dem Song: ${shown}`);
    ok(b.playing, `${k}: Musik läuft bei der Frage`);
    for (let i = 0; i < 3; i++) await P[i].click(...tile(Math.min(i, ps[0].tiles.length - 1)));
    const rev = await allPhones((s) => s.st === "rev" && s.round === `${r}/2`, 32000, `${k}: Auflösung`);
    const right = rev[0].right;
    ok(right >= 0, `${k}: Handy zeigt die richtige Antwort`);
    const answer = rev[0].tiles[right];
    if (k === "gap") ok(lyrics.some((l) => l.toLowerCase() === shown.replace("_____", answer).toLowerCase()), `${k}: Lücke „${answer}“ ergibt die echte Zeile`);
    if (k === "next") ok(lyrics[lyrics.indexOf(shown) + 1]?.startsWith(answer) || lyrics.some((l, i) => l === shown && lyrics[i + 1]?.startsWith(answer)), `${k}: „${answer}“ folgt wirklich auf „${shown}“`);
    if (k === "tf") ok(lyrics.includes(shown) === (right === 0), `${k}: Echt/Fake stimmt für „${shown}“`);
    for (let i = 0; i < 3; i++) {
      const pick = Math.min(i, rev[i].tiles.length - 1);
      ok(new RegExp(pick === right ? "hit" : "miss").test(rev[i].verdict), `${k}: Rückmeldung für ${P[i].name} passt (${rev[i].verdict}, gewählt ${pick}, richtig ${right})`);
    }
  }
  await allPhones((s) => s.st === "end", 14000, `${k}: Siegerehrung`);
  await noBadNotes(k);
  await close();
}

/* ---- Beat-Treffer */
async function beatGame() {
  await openGame("beat");
  await joinAll("beat");
  await allPhones((s) => s.k === "beat" && s.st === "go", 5000, "beat: läuft auf den Handys");
  const look = await T.js(`(async () => {
    const g = document.querySelector(".m-im-game"), seen = new Set();
    for (let i = 0; i < 40; i++) { seen.add(g.querySelector(".m-g-light.is-on") ? [...g.querySelectorAll(".m-g-light")].findIndex((l) => l.classList.contains("is-on")) : -1); await new Promise((r) => setTimeout(r, 70)); }
    return { lights: [...seen].length, ring: !!g.querySelector(".m-g-beat"), scale: g.querySelector(".m-g-beat")?.style.scale, bpm: g.querySelector(".m-g-bpm")?.textContent };
  })()`);
  ok(look.ring && look.lights >= 2, `beat: Ring und Lichter laufen auf dem großen Bild: ${JSON.stringify(look)}`);
  ok(/\d+ BPM/.test(look.bpm), `beat: Tempo wird angezeigt: ${look.bpm}`);
  const ms = 60000 / Number(look.bpm.split(" ")[0]);
  for (let i = 0; i < 6; i++) {
    await P[0].click(".gring");
    await wait(Math.max(0, ms - 70));
  }
  const score = await P[0].js(`Number(document.getElementById("gBeatN")?.textContent || 0)`);
  ok(score > 0, `beat: Tippen im Takt bringt Punkte (${score})`);
  await until(async () => /Alpha/.test((await big.state()).text), 3000, "beat: Alpha erscheint im Rennen");
  await allPhones((s) => s.st === "end", 14000, "beat: Siegerehrung");
  await close();
}

/* ---- Musik-Stopp */
async function stopGame() {
  await openGame("stop");
  await joinAll("stop");
  await allPhones((s) => s.k === "stop" && s.st === "stop", 26000, "stop: Musik stoppt");
  await until(async () => !(await big.state()).playing, 1500, "stop: Musik ist wirklich aus");
  await P[0].click("#game button.hot");
  await P[1].click("#game button.hot");
  const r1 = await allPhones((s) => s.st === "res", 7000, "stop: Ergebnis Runde 1");
  ok(/Gamma/.test((await big.state()).text), "stop: Gamma hat nicht getippt und fliegt raus");
  ok(r1[2].text.includes("💤"), `stop: Gamma sieht, dass Gamma raus ist: ${r1[2].text}`);
  await allPhones((s) => s.st === "play", 6000, "stop: nächste Runde");
  await until(async () => (await big.state()).playing, 1500, "stop: Musik läuft wieder");
  await P[1].click("#game button.calm");
  await allPhones((s) => s.st === "end", 34000, "stop: Siegerehrung");
  ok(/Alpha/.test((await big.state()).text.split("🥇")[1] || ""), "stop: Alpha gewinnt");
  await close();
}

/* ---- Schnellster Finger */
async function fastGame() {
  await openGame("fast");
  await joinAll("fast");
  await allPhones((s) => s.k === "fast" && s.st === "go" && s.round === "1/2", 14000, "fast: Signal Runde 1");
  await P[1].click("#game button.hot");
  await P[0].click("#game button.hot");
  await allPhones((s) => s.st === "res" && s.round === "1/2", 7000, "fast: Ergebnis Runde 1");
  let b = await big.state();
  ok(/Beta.*Alpha/.test(b.text), `fast: Beta vor Alpha: ${b.text}`);
  await allPhones((s) => s.st === "ready" && s.round === "2/2", 9000, "fast: Runde 2 bereit");
  await P[2].click("#game button.calm");
  await allPhones((s) => s.st === "go" && s.round === "2/2", 14000, "fast: Signal Runde 2");
  await P[0].click("#game button.hot");
  await allPhones((s) => s.st === "res" && s.round === "2/2", 7000, "fast: Ergebnis Runde 2");
  b = await big.state();
  ok(/Alpha/.test(b.text) && !/Gamma/.test(b.text), `fast: Gamma tippte zu früh und zählt nicht: ${b.text}`);
  await allPhones((s) => s.st === "end", 9000, "fast: Siegerehrung");
  await close();
}

/* ---- Tipp-Rennen */
async function tapsGame() {
  await openGame("taps");
  await joinAll("taps");
  await allPhones((s) => s.k === "taps" && s.st === "go", 5000, "taps: läuft");
  for (let i = 0; i < 14; i++) await P[0].click(".gring");
  for (let i = 0; i < 5; i++) await P[1].click(".gring");
  await until(async () => /Alpha \d*14/.test((await big.state()).text.replace(/🥇|🥈|🥉/g, "")) || /Alpha\s*14/.test((await big.state()).text), 3000, "taps: 14 Tipps von Alpha auf dem großen Bild");
  await allPhones((s) => s.st === "end", 18000, "taps: Siegerehrung");
  ok(/Alpha/.test((await big.state()).text.split("🥇")[1] || ""), "taps: Alpha gewinnt");
  await close();
}

/* ---- Tanz-Battle */
async function battleGame() {
  await openGame("battle");
  await joinAll("battle");
  const ps = await allPhones((s) => s.k === "battle" && s.st === "go", 5000, "battle: läuft");
  ok(ps.every((s) => /team [AB]/i.test(s.text)), `battle: jeder hat ein Team: ${ps[0].text}`);
  for (let i = 0; i < 8; i++) {
    await P[0].click("#game .gbody > button");
    await P[1].click("#game .gbody > button");
    await wait(120);
  }
  await until(async () => /[AB] · [1-9]/.test((await big.state()).text), 3000, "battle: Balken bewegen sich");
  await allPhones((s) => s.st === "res", 12000, "battle: Ergebnis");
  await allPhones((s) => s.st === "end", 9000, "battle: Siegerehrung");
  await close();
}

/* ---- Heiße Kartoffel */
async function bombGame() {
  await openGame("bomb");
  await joinAll("bomb");
  await allPhones((s) => s.k === "bomb" && s.st === "go", 5000, "bomb: läuft");
  let passes = 0, booms = 0, inRes = false;
  await until(async () => {
    const s = await Promise.all(P.map(phoneState));
    if (s.every((x) => x.st === "end")) return true;
    if (s[0].st === "res" && !inRes) booms++;
    inRes = s[0].st === "res";
    for (const ph of P) {
      if (await ph.js(`!!document.querySelector("#game .gbombbtn")`)) {
        const b = await big.state();
        // schon explodiert, das Handy weiß es nur noch nicht
        if (b.st !== "go") break;
        await ph.click("#game .gbombbtn");
        passes++;
        await until(async () => {
          const n = await big.state();
          return n.text !== b.text || n.st !== "go";
        }, 2500, "bomb: Bombe wandert weiter");
        await wait(500);
        break;
      }
    }
    return false;
  }, 100000, "bomb: Spiel endet");
  ok(passes >= 2 && booms >= 2, `bomb: ${passes}x weitergegeben, ${booms}x explodiert`);
  await close();
}

/* ---- Abstimmungen */
async function voteGame(k) {
  await openGame(k);
  await joinAll(k);
  for (const r of [1, 2]) {
    const ps = await allPhones((s) => s.k === k && s.st === "ask" && s.round === `${r}/2` && s.tiles.length === 3, 8000, `${k}: Frage ${r}`);
    ok(ps[0].h2.length > 8, `${k}: Frage wird angezeigt: ${ps[0].h2}`);
    for (const ph of P) await ph.click(...tile(tileOf(ps[0], "Alpha")));
    const rev = await allPhones((s) => s.st === "rev" && s.round === `${r}/2`, 6000, `${k}: Auflösung`);
    ok(rev[0].tiles[rev[0].right] === "Alpha", `${k}: Alpha hat die meisten Stimmen`);
    if (k === "dlikely") {
      ok(/sip/.test(rev[0].verdict), `${k}: Alpha trinkt: ${rev[0].verdict}`);
      ok(!/sip/.test(rev[1].verdict), `${k}: Beta trinkt nicht: ${rev[1].verdict}`);
    }
  }
  await allPhones((s) => s.st === "end", 8000, `${k}: Siegerehrung`);
  await close();
}
async function neverGame() {
  await openGame("never");
  await joinAll("never");
  for (const r of [1, 2]) {
    const ps = await allPhones((s) => s.k === "never" && s.st === "ask" && s.round === `${r}/2` && s.tiles.length === 2, 8000, `never: Frage ${r}`);
    ok(ps[0].h2.startsWith("…"), `never: Aussage wird angezeigt: ${ps[0].h2}`);
    await P[0].click(...tile(0));
    await P[1].click(...tile(1));
    await P[2].click(...tile(1));
    const rev = await allPhones((s) => s.st === "rev" && s.round === `${r}/2`, 6000, "never: Auflösung");
    ok(/sip/.test(rev[0].verdict), `never: Alpha trinkt: ${rev[0].verdict}`);
    ok(!/sip/.test(rev[1].verdict), `never: Beta trinkt nicht: ${rev[1].verdict}`);
    ok(/Alpha/.test((await big.state()).text), "never: großes Bild nennt Alpha");
  }
  await allPhones((s) => s.st === "end", 8000, "never: Siegerehrung");
  await close();
}

/* ---- Sing weiter und Wort-Alarm: ohne Warteraum */
async function ensurePhones(k) {
  if (hash) return;
  throw new Error(`${k} braucht verbundene Handys: vorher ein Spiel mit Warteraum starten`);
}
async function singGame() {
  await ensurePhones("sing");
  await openGame("sing");
  await until(async () => (await big.state()).st === "ready", 40000, "sing: Stelle gefunden");
  const b = await until(async () => {
    const s = await big.state();
    return s.st === "go" && s;
  }, 30000, "sing: Musik geht aus");
  await wait(250);
  const uri = b.uri;
  await T.js(`__sp.log.audible = {}; 1`);
  await allPhones((s) => s.k === "sing" && s.st === "go", 2500, "sing: Handys zeigen die Zeile");
  await wait(1200);
  const inSilence = await T.js(`__sp.log.audible[${JSON.stringify(uri)}] || null`);
  const s1 = await big.state();
  if (s1.st === "go") ok(!inSilence, `sing: in der stillen Stelle darf nichts zu hören sein: ${JSON.stringify(inSilence)}`);
  ok(s1.playing, "sing: Song läuft im Stillen weiter");
  await until(async () => (await big.state()).st === "res", 20000, "sing: Musik kommt zurück");
  await until(async () => (await big.state()).vol === 0.7, 1500, "sing: wieder laut");
  await close();
}
async function alarmGame() {
  await ensurePhones("alarm");
  await openGame("alarm");
  const b = await until(async () => {
    const s = await big.state();
    return s.st === "go" && s;
  }, 30000, "alarm: Wort gewählt");
  const lyrics = await T.js(`__sp.lyrics(${JSON.stringify(b.uri)})`);
  ok(lyrics.length, "alarm: Song hat Liedtext");
  await allPhones((s) => s.k === "alarm" && s.st === "go", 3000, "alarm: Handys zeigen das Wort");
  await until(async () => (await big.state()).st === "hit", 45000, "alarm: Wort wird gesungen");
  await allPhones((s) => s.st === "hit", 2000, "alarm: Handys melden den Schluck");
  await close();
}

/* ---- Glücksräder */
async function wheelGame(k) {
  await ensurePhones(k);
  await openGame(k);
  await until(() => T.js(`!!document.querySelector(".m-g-wheel")`), 3000, `${k}: Rad ist da`);
  await T.click(".m-g-wheel");
  await until(() => T.js(`document.querySelector(".m-g-wres")?.textContent === "…"`), 1500, `${k}: Klick mitten aufs Rad dreht es`);
  const res = await until(async () => {
    const t = await T.js(`document.querySelector(".m-g-wres")?.textContent`);
    return t && t !== "…" && t;
  }, 7000, `${k}: Rad bleibt stehen`);
  const ps = await until(async () => {
    const s = await Promise.all(P.map(phoneState));
    return s.every((x) => !x.hidden && x.h2 === res) && s;
  }, 3000, `${k}: Handys zeigen das Ergebnis „${res}“`);
  ok(ps.length === 3, k);
  await close();
}

/* ---- Besondere Lagen */
async function pauseScreen() {
  await T.js(`Spicetify.Player.pause(); 1`);
  await wait(4500);
  const seen = await T.js(`({ el: !!document.querySelector("#mirage-immersive .m-im-pause"), text: /Kurze Pause|Short break/.test(document.getElementById("mirage-immersive").innerText), qr: !!document.querySelector("#mirage-immersive .m-g-qr") })`);
  ok(!seen.el && !seen.text && !seen.qr, "Pausenbildschirm ist zurück: " + JSON.stringify(seen));
  await T.js(`Spicetify.Player.play(); 1`);
  await wait(200);
}
// Spotifys Tonart-Abzeichen: Schrift in --background-base, das bei Mirage durchsichtig ist
async function keyBadge() {
  const c = await T.js(`(() => {
    const st = document.createElement("style");
    st.textContent = ".Psc6sReKFsPXwnz1kvAR{color:var(--background-base)} .e2e-other{color:var(--background-base)}";
    document.head.append(st);
    const w = document.createElement("div");
    w.className = "encore-dark-theme";
    w.innerHTML = '<span id="e2eTag" data-encore-id="tag" class="e2e-other" style="background-color:#f7a8d8">8A</span>';
    document.body.append(w);
    const color = getComputedStyle(w.firstChild).color;
    w.remove();
    st.remove();
    return color;
  })()`);
  ok(!/rgba\(.*, 0\)|transparent/.test(c), "Tonart-Abzeichen hat unsichtbare Schrift: " + c);
}
async function muteButton() {
  // der Knopf sitzt in der Leiste der anderen Ansichten
  await big.hover();
  await T.click('#mirage-immersive [data-mode="lyrics"]');
  await wait(500);
  // die Leiste blendet nach dem Ansichtswechsel erst ein: ein Klick kann ins Leere gehen, darum bis zu dreimal
  const press = async (want, what) => {
    for (let i = 0; i < 3; i++) {
      await big.hover();
      await wait(250);
      await T.click(".m-im-mute");
      try {
        return await until(async () => (await big.state()).vol === want, 1200, what);
      } catch (e) {
        // ein Klick, der doch ankam, darf nicht doppelt zählen
        if (i === 2 || (await big.state()).vol !== (want === 0 ? 0.7 : 0)) throw e;
      }
    }
  };
  await until(async () => (await big.state()).vol === 0.7, 3000, "Lautstärke ist vor dem Stumm-Test zurück");
  await press(0, "Stumm-Knopf schaltet wirklich stumm");
  await press(0.7, "Stumm-Knopf stellt die Lautstärke wieder her");
  await big.hover();
  await T.click('#mirage-immersive [data-mode="party"]');
  await wait(1500);
}
// Medientaste mitten in der Frage: Pause läuft weiter, Sprung startet dieselbe Runde mit dem neuen Song
async function mediaKeys() {
  await T.js(`__sp.setShuffleJump(0); 1`);
  await openGame("quiz");
  await joinAll("quiz");
  const a = await allPhones((s) => s.st === "ask" && s.round === "1/2", 15000, "Frage 1");
  await P[0].click(...tile(0));
  await until(() => P[0].js(`!!document.querySelector("#game .tile.pick")`), 1500, "Antwort gemerkt");
  await T.js(`Spicetify.Player.pause(); 1`);
  await wait(200);
  await until(async () => (await big.state()).playing, 2500, "externe Pause wird korrigiert");
  const before = (await big.state()).uri;
  await T.js(`Spicetify.Player.next(); 1`);
  await until(async () => {
    const s = await big.state();
    return s.st === "ask" && s.uri !== before;
  }, 5000, "Runde läuft mit dem neuen Song weiter");
  const now = await until(async () => {
    const x = await big.state();
    return x.st === "ask" && x.opts.includes(x.artist) && x.opts.join() !== a[0].tiles.join() && x;
  }, 4000, "großes Bild zeigt die neuen Antworten");
  const b = await allPhones((s) => s.st === "ask" && s.round === "1/2" && s.tiles.join() === now.opts.join(), 3000, "gleiche Rundenzahl, neue Antworten auf den Handys");
  ok(b[0].tiles.includes(now.artist), `neuer Künstler „${now.artist}“ steht zur Auswahl: ${b[0].tiles}`);
  ok(a[0].tiles.join() !== b[0].tiles.join(), "Handy zeigt die neuen Antworten");
  const picked = await P[0].js(`document.querySelectorAll("#game .tile.pick").length`);
  ok(picked === 0, "nach dem Songwechsel darf Alpha neu antworten");
  await close();
}
// eine Playlist von nur einem Künstler: das Quiz bricht nicht ab
async function oneArtist() {
  await T.js(`__sp.useArtists(Array(12).fill("Solo Artist")); 1`);
  await wait(500);
  await openGame("quiz");
  await joinAll("quiz");
  const ps = await allPhones((s) => s.st === "ask" && s.tiles.length === 4, 15000, "Frage trotz nur einem Künstler");
  ok(ps[0].tiles.includes("Solo Artist"), "richtige Antwort steht zur Auswahl");
  await noBadNotes("oneArtist");
  await close();
  await T.js(`__sp.resetArtists(); 1`);
  await wait(500);
}
// Handy lädt mitten in der Runde neu: die Antwort bleibt
async function phoneReload() {
  await openGame("never");
  await joinAll("never");
  await allPhones((s) => s.k === "never" && s.st === "ask" && s.round === "1/2", 8000, "Frage");
  await P[0].click(...tile(0));
  await until(() => P[0].js(`!!document.querySelector("#game .tile.pick")`), 1500, "Antwort gemerkt");
  await P[0].js("location.reload(); 1").catch(() => {});
  await wait(600);
  await until(async () => {
    const s = await phoneState(P[0]).catch(() => null);
    return s && s.st === "ask";
  }, 8000, "Handy ist wieder da");
  ok(await P[0].js(`!!document.querySelector("#game .tile.pick")`), "nach dem Neuladen bleibt die Antwort markiert");
  await close();
}
// Funkloch: das Handy zeigt es an, verbindet sich von selbst neu, und der Gast spielt mit seinen Punkten weiter
async function offline() {
  const net = () => P[0].js(`({ lost: document.body.classList.contains("lost"), text: document.getElementById("net").textContent })`);
  await openGame("never");
  await joinAll("never");
  await allPhones((s) => s.k === "never" && s.st === "ask" && s.round === "1/2", 8000, "offline: Frage 1");
  await P[0].click(...tile(0));
  await wait(700);
  let n = await net();
  ok(!n.lost && !n.text, `offline: verbunden zeigt keinen Hinweis: ${JSON.stringify(n)}`);
  await P[0].js(`__e2eNet.cut(5000); 1`);
  n = await until(async () => (await net()).lost && (await net()), 2000, "offline: der Punkt zeigt die Unterbrechung sofort");
  ok(!n.text, `offline: ein kurzer Aussetzer bleibt ohne Text: ${n.text}`);
  await until(async () => /Offline/.test((await net()).text), 7000, "offline: nach ein paar Sekunden steht es da");
  await P[1].click(...tile(1));
  await P[2].click(...tile(1));
  await until(async () => /Alpha/.test((await big.state()).text) && (await big.state()).st === "rev", 6000, "offline: Alphas Antwort von vor dem Funkloch zählt");
  await until(async () => !(await net()).lost, 20000, "offline: das Handy verbindet sich von selbst neu");
  ok(/verbunden|Connected/.test((await net()).text), "offline: sagt, dass es wieder verbunden ist");
  await allPhones((s) => s.k === "never" && s.st === "ask" && s.round === "2/2", 12000, "offline: Alpha spielt nach dem Funkloch weiter");
  for (const ph of P) await ph.click(...tile(0));
  const end = await allPhones((s) => s.st === "end", 8000, "offline: Siegerehrung");
  ok(/ 2 (Punkte|points)/.test(end[0].text), `offline: Alpha hat die Punkte aus beiden Runden: ${end[0].text}`);
  await until(async () => !(await net()).text, 4000, "offline: der Hinweis verschwindet wieder");
  await close();
}
// Name und Farbe: einmal gefragt, auf dem großen Bild im Warteraum, an Ständen und Wünschen zu sehen, später änderbar
const BLUE = "rgb(74, 168, 255)", RED = "rgb(255, 90, 110)";
const bigGuest = (sel, name) => T.js(`(() => {
  const c = [...document.querySelectorAll(${JSON.stringify(sel)})].find((x) => x.textContent.includes(${JSON.stringify(name)}));
  return c ? { dot: c.querySelector(".m-g-dot")?.style.background || "" } : null;
})()`);
async function guestProfile() {
  const Z = P[2];
  await ensurePhones("guest-profile");
  await Z.js(`for (const k of ["mlName", "mlCol", "mlProf"]) localStorage.removeItem(k); location.reload(); 1`).catch(() => {});
  await wait(500);
  await until(() => Z.js(`!document.getElementById("prof").hidden`).catch(() => false), 10000, "profil: beim ersten Mal wird nach Name und Farbe gefragt");
  await Z.click("#pName");
  await Z.wc.insertText("Zoë");
  await Z.click("#pSw .swb", { index: 5 });
  await Z.click("#pOk");
  const me = await Z.js(`({ n: localStorage.getItem("mlName"), c: localStorage.getItem("mlCol"), asked: localStorage.getItem("mlProf"), btn: document.getElementById("bMe").textContent, bg: document.getElementById("bMe").style.background, open: !document.getElementById("prof").hidden })`);
  ok(me.n === "Zoë" && me.c === "5" && me.asked === "1" && me.btn === "Z" && me.bg === BLUE && !me.open, "profil: Name und Farbe sind gemerkt: " + JSON.stringify(me));
  // Warteraum: wer da ist, mit Namen und Farbe, und was noch fehlt
  await openGame("stop");
  await until(async () => (await big.state()).st === "join", 4000, "profil: Warteraum");
  const count = () => T.js(`document.querySelector(".m-g-jcount")?.textContent || ""`);
  await until(async () => /niemand|Nobody/.test(await count()) && /2/.test(await count()), 3000, "warteraum: leer, zwei Gäste nötig");
  await until(async () => (await phoneState(Z)).st === "join", 8000, "profil: Handy zeigt den Warteraum");
  await Z.click("#game button.go");
  await until(async () => (await bigGuest(".m-g-chips .m-g-chip", "Zoë"))?.dot === BLUE, 5000, "warteraum: Zoë steht mit ihrer Farbe auf dem großen Bild");
  ok(/1 (dabei|in the game).*1/.test(await count()), "warteraum: einer da, einer fehlt noch: " + (await count()));
  await P[0].click("#game button.go");
  await until(async () => /^2 (dabei|in the game)$/.test(await count()), 5000, "warteraum: zwei da, niemand fehlt mehr");
  const chip = await until(() => P[0].js(`(() => {
    const c = [...document.querySelectorAll("#game .gchips span")].find((x) => x.textContent === "Zoë");
    return c ? c.querySelector(".gdot")?.style.background : "";
  })()`), 4000, "warteraum: auch das Handy zeigt Zoë mit Farbe");
  ok(chip === BLUE, "warteraum: Farbe auf dem Handy: " + chip);
  await close();
  await afterGame("profil");
  // Stände: wessen sie sind
  await openGame("never");
  await joinAll("never");
  await allPhones((s) => s.st === "ask" && s.round === "1/2", 8000, "profil: Frage 1");
  for (const ph of P) await ph.click(...tile(0));
  await allPhones((s) => s.st === "rev" && s.round === "1/2", 6000, "profil: Auflösung");
  ok((await bigGuest(".m-g-board .m-g-row", "Zoë"))?.dot === BLUE, "profil: Stand auf dem großen Bild trägt Zoës Farbe");
  const mine = await Z.js(`document.querySelector("#game .grow.me")?.textContent || ""`);
  ok(mine.includes("Zoë"), "profil: der eigene Stand ist auf dem Handy hervorgehoben: " + mine);
  // später ändern: der Knopf oben rechts
  await allPhones((s) => s.st === "ask" && s.round === "2/2", 8000, "profil: Frage 2");
  await Z.click("#bMe");
  await Z.click("#pSw .swb", { index: 0 });
  await Z.click("#pOk");
  await until(async () => (await bigGuest(".m-g-who .m-g-chip", "Zoë"))?.dot === RED, 5000, "profil: die neue Farbe kommt auf dem großen Bild an");
  await close();
  await afterGame("profil");
  // Wunsch: von wem er ist
  await Z.click("#bWish");
  await wait(700);
  await Z.js(`(() => { const i = document.getElementById("wSong"); i.value = "song"; i.dispatchEvent(new Event("input")); })(); 1`);
  await until(() => Z.js(`document.querySelectorAll("#wRes li").length > 0`), 9000, "wunsch: Treffer");
  await Z.click("#wRes li button.go");
  const by = await until(() => P[0].js(`(() => {
    const s = [...document.querySelectorAll("#wList small")].find((x) => x.textContent.includes("Zoë"));
    return s ? s.querySelector(".gdot")?.style.background || "ohne" : "";
  })()`), 6000, "wunsch: die anderen sehen, von wem er ist");
  ok(by === RED, "wunsch: mit Zoës Farbe: " + by);
  const toast = await until(() => T.js(`(() => {
    const s = document.querySelector(".m-im-wishtoast small");
    return s && s.textContent.includes("Zoë") ? s.querySelector(".m-im-who")?.style.background || "ohne" : "";
  })()`), 6000, "wunsch: das große Bild nennt Zoë");
  ok(toast === RED, "wunsch: mit Farbe auf dem großen Bild: " + toast);
  await Z.click("#wClose");
  await T.js(`document.querySelector(".m-im-wishtoast .m-im-wish-all")?.click(); 1`);
  await wait(400);
  await T.js(`document.querySelector(".m-im-wish-no")?.click(); document.querySelector(".m-im-side-x")?.click(); 1`);
  // wieder Gamma, für die Fälle danach
  await Z.js(`localStorage.setItem("mlName", "Gamma"); localStorage.removeItem("mlCol"); location.reload(); 1`).catch(() => {});
  await wait(1500);
}
// Später einsteigen: ein Gast scannt mitten im Spiel, spielt ab sofort mit und behält seine Punkte auch nach dem Neuladen
async function lateJoin() {
  const L = P[2];
  await ensurePhones("late-join");
  await L.js(`sessionStorage.clear(); 1`);
  await L.win.loadURL(PAGE);
  await T.js(`__sp.setShuffleJump(0); 1`);
  await openGame("quiz");
  await joinAll("quiz", [P[0], P[1]]);
  await until(async () => (await phoneState(P[0])).st === "ask" && (await phoneState(P[0])).tiles.length === 4, 15000, "spät: Frage 1 läuft");
  await L.win.loadURL(PAGE + "?late=1" + hash);
  const late = await until(async () => {
    const s = await phoneState(L).catch(() => null);
    return s && !s.hidden && s.k === "quiz" && s;
  }, 10000, "spät: der neue Gast sieht das laufende Spiel");
  ok(late.tiles.length === 0 && (await L.js(`document.getElementById("game").dataset.late`)) === "1", "spät: erst einsteigen, dann antworten: " + late.text);
  await L.click("#game button.go");
  const now = await until(async () => {
    const s = await phoneState(L);
    return s.st === "ask" && s.tiles.length === 4 && s;
  }, 4000, "spät: nach dem Einsteigen ist die Frage da");
  await until(() => T.js(`document.querySelectorAll(".m-g-who .m-g-chip").length === 3`), 4000, "spät: das große Bild zeigt den dritten Gast");
  const b = await big.state(), right = tileOf(now, b.artist);
  ok(right >= 0, "spät: die richtige Antwort steht zur Auswahl");
  await P[0].click(...tile((right + 1) % 4));
  await P[1].click(...tile((right + 1) % 4));
  await L.click(...tile(right));
  const rev = await allPhones((s) => s.st === "rev" && s.round === "1/2", 6000, "spät: Auflösung");
  ok(/hit/.test(rev[2].verdict), "spät: die Antwort des neuen Gastes zählt: " + rev[2].verdict);
  ok(/Gamma/.test(((await big.state()).text.split("🥇")[1] || "").split("🥈")[0]), "spät: Gamma führt: " + (await big.state()).text);
  // Neuladen in einem frischen Tab: der PC kennt den Gast noch, die Punkte bleiben
  await allPhones((s) => s.st === "ask" && s.round === "2/2" && s.tiles.length === 4, 15000, "spät: Frage 2");
  await L.js(`sessionStorage.clear(); location.reload(); 1`).catch(() => {});
  await wait(600);
  const back = await until(async () => {
    const s = await phoneState(L).catch(() => null);
    return s && s.st === "ask" && s.round === "2/2" && s.tiles.length === 4 && s;
  }, 9000, "spät: nach dem Neuladen direkt wieder im Spiel");
  ok((await L.js(`document.getElementById("game").dataset.late`)) === "", "spät: kein zweites Einsteigen nötig");
  const b2 = await big.state();
  for (const ph of P) await ph.click(...tile(tileOf(back, b2.artist)));
  const end = await allPhones((s) => s.st === "end", 14000, "spät: Siegerehrung");
  const pts = Number((/(\d+) (Punkte|points)/.exec(end[2].text) || [])[1] || 0);
  ok(pts > 200, "spät: Gamma hat die Punkte aus beiden Runden: " + end[2].text);
  await close();
}
// Spielleitung am Handy: eigener QR-Code hinter einem Knopf, und nur das Handy mit diesem Link darf steuern
async function hostGame() {
  const H = P[2];
  await ensurePhones("host");
  const sideOpen = () => until(() => T.js(`!document.querySelector(".m-im-side").hidden`), 2000, "host: Spiele-Leiste geht auf");
  await big.hover();
  await T.click(".m-im-gamebtn");
  await sideOpen();
  ok(!(await T.js(`!!document.querySelector(".m-g-hostqr")`)), "host: der QR-Code der Spielleitung ist nicht von selbst zu sehen");
  await T.click(".m-im-side-body .m-im-side-item", { text: "📱" });
  await until(() => T.js(`!!document.querySelector(".m-g-hostqr img")?.naturalWidth`), 6000, "host: QR-Code nach dem Knopf");
  const url = await T.js(`(async () => {
    const im = document.querySelector(".m-g-hostqr img"), c = document.createElement("canvas");
    c.width = c.height = 760;
    const x = c.getContext("2d");
    x.fillStyle = "#fff";
    x.fillRect(0, 0, 760, 760);
    x.drawImage(im, 20, 20, 720, 720);
    return jsQR(x.getImageData(0, 0, 760, 760).data, 760, 760)?.data || "";
  })()`);
  const hostHash = url.slice(url.indexOf("#"));
  ok(hostHash.startsWith(hash + "&h=") && hostHash.length > hash.length + 20, "host: der Link trägt einen eigenen Schlüssel: " + url.slice(0, 60));
  await T.click(".m-im-side-x");
  await big.hover();
  await T.click(".m-im-gamebtn");
  await sideOpen();
  ok(!(await T.js(`!!document.querySelector(".m-g-hostqr")`)), "host: nach dem Schließen ist der QR-Code wieder weg");
  await T.click(".m-im-side-x");
  await H.win.loadURL(PAGE + "?host=1" + hostHash);
  await until(() => H.js(`document.body.classList.contains("on") && !document.getElementById("bHost").hidden`).catch(() => false), 10000, "host: das Handy der Spielleitung hat den Knopf");
  ok(await P[0].js(`document.getElementById("bHost").hidden`), "host: Gäste haben den Knopf nicht");
  // ein Spiel vom Handy aus starten
  await H.click("#bHost");
  await H.click("#hBody .hgames button", { text: "🙈" });
  await until(async () => (await big.state()).st === "join" && (await big.state()).k === "never", 5000, "host: das Spiel geht auf dem großen Bild auf");
  for (const ph of [P[0], P[1]]) {
    await until(async () => (await phoneState(ph)).st === "join", 8000, "host: Warteraum auf den Handys");
    await ph.click("#game button.go");
  }
  await until(async () => (await big.state()).chips === 2, 6000, "host: zwei Gäste im Warteraum");
  // ein Gast ohne den Schlüssel kann nichts steuern
  await P[0].js(`sendSure({ k: "host", hd: [myId, "start", "", 0, Date.now(), "abcdefgh12"].join("|"), sig: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" }); 1`);
  await wait(1200);
  ok((await big.state()).st === "join", "host: ein gefälschter Befehl eines Gastes wirkt nicht");
  await H.click("#hBody .hacts button.go");
  await until(async () => (await phoneState(P[0])).st === "ask" && (await phoneState(P[0])).round === "1/2", 6000, "host: Start vom Handy");
  await until(() => H.js(`document.querySelectorAll("#hBody .hacts button").length === 2 && !document.querySelector("#hBody .hacts button.go")`), 3000, "host: jetzt gibt es Überspringen");
  await H.click("#hBody .hacts button", { index: 0 });
  await until(async () => (await phoneState(P[0])).st === "ask" && (await phoneState(P[0])).round === "2/2", 9000, "host: Runde übersprungen");
  await P[0].click(...tile(0));
  await P[1].click(...tile(1));
  // Punkte korrigieren: Alpha bekommt 100 dazu
  await H.click("#hBody .hsteps button", { index: 2 });
  const row = await H.js(`[...document.querySelectorAll("#hBody .hrow")].findIndex((r) => r.textContent.includes("Alpha"))`);
  ok(row >= 0, "host: Alpha steht in der Liste der Spielleitung");
  await until(() => H.js(`document.querySelectorAll("#hBody .hrow b")[${row}]?.textContent === "1"`), 5000, "host: die Spielleitung sieht Alphas Stand");
  await H.click("#hBody .hrow button", { index: row * 2 + 1 });
  await until(async () => /Alpha 101/.test((await big.state()).text), 6000, "host: der korrigierte Stand steht auf dem großen Bild");
  await until(async () => / 101 (Punkte|points)/.test((await phoneState(P[0])).text), 12000, "host: und bei Alpha auf dem Handy");
  // dieselbe Nachricht noch einmal (mitgelesen und wieder abgespielt) zählt nicht doppelt: sendSure schickt jede dreimal
  await wait(1200);
  ok(/Alpha 101/.test((await big.state()).text), "host: ein Befehl gilt genau einmal: " + (await big.state()).text);
  await H.click("#hBody .hacts button.end");
  await until(async () => !(await big.state()).open, 5000, "host: Ende vom Handy");
  await until(() => H.js(`!!document.querySelector("#hBody .hgames")`), 4000, "host: danach steht wieder die Spieleliste da");
  await H.win.loadURL(PAGE + "?guest=1" + hash);
  await until(() => H.js(`document.body.classList.contains("on") && document.getElementById("bHost").hidden`).catch(() => false), 10000, "host: wieder als Gast verbunden");
}
// Spiel-Einstellungen über die echte Leiste setzen
async function openGameSettings() {
  await big.hover();
  await T.click(".m-im-gamebtn");
  await until(() => T.js(`!document.querySelector(".m-im-side").hidden`), 2000, "Spiele-Leiste geht auf");
  if (!(await T.js(`!!document.querySelector(".m-g-cfg")`))) await T.click(".m-im-side-body .m-im-side-item", { text: "⚙" });
  await until(() => T.js(`!!document.querySelector(".m-g-cfg")`), 2000, "Spiel-Einstellungen gehen auf");
}
async function gameSetting(key, index) {
  await openGameSettings();
  await T.click(`.m-g-cfg[data-key="${key}"] button`, { index });
  await until(() => T.js(`document.querySelectorAll('.m-g-cfg[data-key="${key}"] button')[${index}]?.getAttribute("aria-pressed") === "true"`), 2000, `Einstellung ${key} ist gesetzt`);
  await T.click(".m-im-side-x");
}
async function gameSource(name) {
  await openGameSettings();
  await T.click(".m-g-src");
  await until(() => T.js(`document.querySelectorAll(".m-g-srclist .m-im-side-item").length > 1`), 4000, "Playlists der Bibliothek stehen zur Wahl");
  await T.click(".m-g-srclist .m-im-side-item", name ? { text: name } : { index: 0 });
  await until(() => T.js(`!document.querySelector(".m-g-srclist") && (document.querySelector(".m-g-src")?.textContent || "")`), 2000, "Quelle ist gewählt");
  await T.click(".m-im-side-x");
}
const firstSong = async () => {
  await T.js(`__sp.resetArtists(); __sp.setShuffleJump(0); 1`);
  await wait(500);
};
// Schwierigkeit: leicht hat drei Antworten, schwer die ähnlichsten falschen
async function quizLevel() {
  await ensurePhones("quiz-level");
  await firstSong();
  await gameSetting("gameLevel", 0);
  await openGame("quiz");
  await joinAll("quiz");
  let ps = await allPhones((s) => s.st === "ask" && s.tiles.length >= 3, 15000, "leicht: Frage");
  let b = await big.state();
  ok(ps[0].tiles.length === 3 && ps[0].tiles.includes(b.artist), "leicht: drei Antworten, die richtige dabei: " + ps[0].tiles.join(" | "));
  await close();
  await afterGame("quiz");
  await firstSong();
  await gameSetting("gameLevel", 2);
  await openGame("quiz");
  await joinAll("quiz");
  ps = await allPhones((s) => s.st === "ask" && s.tiles.length >= 3, 15000, "schwer: Frage");
  b = await big.state();
  ok(b.artist === "Blue Lake" && ps[0].tiles.length === 4 && ps[0].tiles.includes(b.artist), "schwer: vier Antworten zu Blue Lake: " + b.artist + " / " + ps[0].tiles.join(" | "));
  // ähnlich heißt hier: Namen derselben Form. In der Warteschlange stehen genau drei weitere aus zwei Wörtern.
  ok(ps[0].tiles.every((x) => x.split(" ").length === 2), "schwer: die falschen Antworten sind die ähnlichsten: " + ps[0].tiles.join(" | "));
  await close();
  await afterGame("quiz");
  await gameSetting("gameLevel", 1);
}
// Quelle und Jahrzehnt: Songs aus einer gewählten Playlist statt aus der Warteschlange, auf Wunsch nur ein Jahrzehnt
async function quizSource() {
  await ensurePhones("quiz-source");
  await firstSong();
  const yearOf = (uri) => T.js(`__sp.yearOf(${JSON.stringify(uri)})`);
  await gameSource("Quiz Mix");
  await gameSetting("gameDecade", 4);
  const calls = await T.js(`__sp.log.yearCalls`);
  await openGame("quiz");
  await joinAll("quiz");
  const seen = new Set();
  for (const r of [1, 2]) {
    const ps = await allPhones((s) => s.st === "ask" && s.round === `${r}/2` && s.tiles.length === 4, 15000, `quelle: Frage ${r}`);
    const b = await big.state();
    ok(b.uri.startsWith("spotify:track:p"), "quelle: der Song kommt aus der gewählten Playlist: " + b.title);
    ok((await yearOf(b.uri)) === 2015, "quelle: nur Songs aus den 2010ern: " + (await yearOf(b.uri)));
    ok(ps[0].tiles.includes(b.artist) && ps[0].tiles.every((x) => x.startsWith("Mix Artist")), "quelle: auch die falschen Antworten kommen aus der Playlist: " + ps[0].tiles.join(" | "));
    ok(b.playing && b.vol === 0.7, "quelle: der Song ist zu hören");
    seen.add(b.uri);
    for (const ph of P) await ph.click(...tile(tileOf(ps[0], b.artist)));
    await allPhones((s) => s.st === "rev" && s.round === `${r}/2`, 6000, "quelle: Auflösung");
  }
  ok(seen.size === 2, "quelle: zwei Runden, zwei verschiedene Songs");
  await allPhones((s) => s.st === "end", 12000, "quelle: Siegerehrung");
  await noBadNotes("quelle");
  await close();
  await afterGame("quiz");
  ok((await T.js(`__sp.log.yearCalls`)) - calls === 1, "quelle: ein einziger Abruf für alle Erscheinungsjahre");
  // Jahrzehnt ohne Playlist: Songs aus der Warteschlange, aber nur die passenden
  await gameSource("");
  await gameSetting("gameDecade", 1);
  await openGame("title");
  await joinAll("title");
  await allPhones((s) => s.st === "ask" && s.tiles.length === 4, 15000, "jahrzehnt: Frage");
  let b = await big.state();
  ok(!b.uri.startsWith("spotify:track:p") && (await yearOf(b.uri)) === 1985, "jahrzehnt: Song aus der Warteschlange, aus den 80ern: " + b.title + " " + (await yearOf(b.uri)));
  await close();
  await afterGame("title");
  await gameSetting("gameDecade", 0);
  // leere Playlist: Hinweis, und das Spiel läuft mit der Warteschlange
  await gameSource("Leer");
  await openGame("quiz");
  await joinAll("quiz");
  const ps = await allPhones((s) => s.st === "ask" && s.tiles.length === 4, 15000, "leer: Frage trotz leerer Playlist");
  b = await big.state();
  ok(ps[0].tiles.includes(b.artist), "leer: es läuft mit der Warteschlange weiter");
  ok((await T.js(`__sp.log.notes.filter((n) => n.err).length`)) === 1, "leer: ein Hinweis, dass die Playlist nichts hergibt");
  await close();
  await afterGame("quiz");
  await gameSource("");
}
// Spielen ohne Handys: die Tastatur am PC ist ein Mitspieler (Ziffern antworten, Leertaste ist der Buzzer)
async function keyboardPlay() {
  const press = (code) => T.js(`__sp.press(${JSON.stringify(code)}); 1`);
  const mode = () => T.js(`document.getElementById("mirage-immersive").dataset.mode`);
  await firstSong();
  await openGame("quiz");
  await until(async () => (await big.state()).st === "join", 4000, "tastatur: Warteraum");
  ok(/Leertaste|Space/.test((await big.state()).text), "tastatur: der Warteraum sagt, wie es ohne Handy geht");
  // im Spiel wechseln die Ziffern nicht die Ansicht, und die Leertaste hält die Musik nicht an
  await press("Digit2");
  await wait(300);
  ok((await mode()) === "party" && (await big.state()).st === "join", "tastatur: die Zifferntaste lässt das Spiel offen");
  await press("Space");
  await until(async () => (await big.state()).chips === 1 && /Tastatur|Keyboard/.test((await big.state()).text), 3000, "tastatur: Leertaste meldet die Tastatur an");
  ok((await big.state()).playing, "tastatur: die Musik läuft weiter");
  await press("Enter");
  let last = "";
  for (const r of [1, 2]) {
    const b = await until(async () => {
      const s = await big.state();
      return s.st === "ask" && s.uri !== last && s.opts.length === 4 && s.opts.includes(s.artist) && s;
    }, 15000, `tastatur: Frage ${r}`);
    last = b.uri;
    ok(/1 (bis|to) 4/.test(b.text), "tastatur: die Frage nennt die Tasten: " + b.text);
    await press("Digit" + (b.opts.indexOf(b.artist) + 1));
    const rev = await until(async () => {
      const s = await big.state();
      return s.st === "rev" && s;
    }, 3000, "tastatur: die Antwort per Taste löst sofort auf");
    ok(rev.right === b.artist && rev.playing, "tastatur: richtig aufgelöst, Musik läuft");
  }
  const end = await until(async () => {
    const s = await big.state();
    return s.st === "end" && s;
  }, 12000, "tastatur: Siegerehrung");
  const pts = Number((/(?:Tastatur|Keyboard) (\d+)/.exec(end.text) || [])[1] || 0);
  ok(pts >= 200, "tastatur: zwei richtige Antworten zählen: " + end.text);
  await close();
  await afterGame("quiz");
  // Leertaste als Buzzer
  await openGame("fast");
  await until(async () => (await big.state()).st === "join", 4000, "tastatur: Warteraum Schnellster Finger");
  await press("Space");
  await until(async () => (await big.state()).chips === 1, 3000, "tastatur: angemeldet");
  await press("Enter");
  await until(async () => (await big.state()).st === "go", 14000, "tastatur: Signal");
  await press("Space");
  const res = await until(async () => {
    const s = await big.state();
    return s.st === "res" && s;
  }, 7000, "tastatur: Ergebnis");
  ok(/(Tastatur|Keyboard) \d+ ms/.test(res.text), "tastatur: die Leertaste zählt als Buzzer: " + res.text);
  await close();
}
// Ergebnis-Karte: nach dem Spiel entsteht auf Knopfdruck ein Bild mit der Rangliste
async function resultCard() {
  await ensurePhones("result-card");
  const file = path.join(OUT, "mirage-game.png");
  fs.rmSync(file, { force: true });
  await openGame("never");
  await joinAll("never");
  for (const r of [1, 2]) {
    await allPhones((s) => s.st === "ask" && s.round === `${r}/2`, 8000, `karte: Frage ${r}`);
    await P[0].click(...tile(0));
    await P[1].click(...tile(r === 1 ? 0 : 1));
    await P[2].click(...tile(1));
  }
  await until(async () => (await big.state()).st === "end", 8000, "karte: Siegerehrung");
  // mitschreiben, was auf die Karte gezeichnet wird
  await T.js(`(() => {
    const real = CanvasRenderingContext2D.prototype.fillText;
    window.__drawn = [];
    CanvasRenderingContext2D.prototype.fillText = function (text, ...rest) {
      if (this.canvas.width === 1080 && this.canvas.height === 1350) window.__drawn.push(String(text));
      return real.call(this, text, ...rest);
    };
    window.__undraw = () => (CanvasRenderingContext2D.prototype.fillText = real);
  })(); 1`);
  await big.hover();
  await T.click(".m-g-card");
  await until(() => fs.existsSync(file) && fs.statSync(file).size > 20000, 8000, "karte: das Bild wird gespeichert");
  const png = fs.readFileSync(file);
  ok(png.readUInt32BE(16) === 1080 && png.readUInt32BE(20) === 1350, "karte: Hochformat 1080 × 1350");
  const drawn = await T.js(`(() => { window.__undraw(); return window.__drawn; })()`);
  const at = (name) => drawn.indexOf(name);
  ok(at("Alpha") >= 0 && at("Alpha") < at("Beta") && at("Beta") < at("Gamma"), "karte: alle drei in der Reihenfolge der Rangliste: " + drawn.join(" | "));
  ok(drawn[at("Alpha") + 1] === "2" && drawn[at("Beta") + 1] === "1" && drawn[at("Gamma") + 1] === "0", "karte: mit ihren Punkten: " + drawn.join(" | "));
  ok(drawn.some((x) => x.includes("Ich hab noch nie") || x.includes("Never have I ever")), "karte: nennt das Spiel");
  await wait(600);
  ok((await big.state()).st === "end", "karte: die Siegerehrung bleibt stehen");
  await close();
}

/* ---------------------------------------------------------------- Gäste und Handys */
// Wunsch per Spotify-Link: ein Song-Link wird direkt aufgelöst, andere Links freundlich abgelehnt
async function linkWish() {
  const B = P[1], msg = () => B.js(`document.getElementById("wMsg").textContent`);
  await ensurePhones("link-wish");
  const type = (v) => B.js(`(() => { const i = document.getElementById("wSong"); i.value = ${JSON.stringify(v)}; i.dispatchEvent(new Event("input")); })(); 1`);
  await B.click("#bWish");
  await wait(700);
  await type("https://open.spotify.com/intl-de/track/t000000000000000000005?si=0123456789abcdef");
  const hit = await until(() => B.js(`[...document.querySelectorAll("#wRes li b")].map((b) => b.textContent)`).then((l) => l.length && l), 9000, "link: der Song aus dem Link erscheint");
  ok(hit.length === 1 && /Fable/.test(hit[0]), "link: genau der verlinkte Song: " + hit.join(" | "));
  // Album-Link: schon auf dem Handy abgelehnt, ohne Anfrage
  const other = await B.js("T.wLinkOther");
  await type("https://open.spotify.com/album/1A2B3C4D5E6F7G8H9I0J1K");
  await until(async () => (await msg()) === other, 2000, "link: ein Album-Link bekommt einen Hinweis");
  ok(!(await B.js(`document.querySelectorAll("#wRes li").length`)), "link: zum Album-Link gibt es keine Treffer");
  // ältere Handyseiten schicken den Link einfach als Suche: Mirage sagt, dass es kein Song ist
  await B.js(`rid++; ask("https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M", 0); 1`);
  await until(async () => (await msg()) === other, 9000, "link: Mirage lehnt einen Playlist-Link ab");
  await type("spotify:track:t000000000000000000005");
  await until(() => B.js(`document.querySelectorAll("#wRes li").length === 1`), 9000, "link: auch als spotify:track:-Adresse");
  await B.click("#wRes li button.go");
  await until(() => P[0].js(`[...document.querySelectorAll("#wList b")].some((b) => /Fable/.test(b.textContent))`), 8000, "link: der Wunsch steht bei allen in der Liste");
  await B.click("#wClose");
  await T.js(`document.querySelector(".m-im-wishtoast .m-im-wish-all")?.click(); 1`);
  await wait(400);
  await T.js(`document.querySelector(".m-im-wish-no")?.click(); document.querySelector(".m-im-side-x")?.click(); 1`);
}
// Regeln für Songwünsche: in den echten Einstellungen gesetzt, auf den Handys wirksam
async function setRule(key, value) {
  await T.js(`(() => {
    if (!document.querySelector(".mirage-settings")) __menu.brightness();
    const i = document.querySelector('.mirage-settings [data-key="${key}"]');
    if (i.type === "checkbox") { if (i.checked !== ${JSON.stringify(!!value)}) i.click(); }
    else { i.value = ${JSON.stringify(String(value))}; i.dispatchEvent(new Event("input", { bubbles: true })); i.dispatchEvent(new Event("change", { bubbles: true })); }
    return 1;
  })()`);
}
async function wishRules() {
  const [A, B] = P, msg = (ph) => ph.js(`document.getElementById("wMsg").textContent`);
  const type = (ph, v) => ph.js(`(() => { const i = document.getElementById("wSong"); i.value = ${JSON.stringify(v)}; i.dispatchEvent(new Event("input")); })(); 1`);
  const hits = (ph) => ph.js(`[...document.querySelectorAll("#wRes li b")].map((b) => b.textContent).join(" | ")`);
  await ensurePhones("wish-rules");
  await setRule("wishMax", 1);
  await setRule("wishBlock", "cinder, nothing");
  await setRule("wishClean", true);
  await setRule("wishAuto", 2);
  await T.js(`document.querySelector(".mirage-settings")?.remove(); 1`);
  // Suche: der gesperrte (Cinder) und der „Explicit“-Song (Blue Lake) erscheinen gar nicht
  for (const ph of [A, B]) await ph.click("#bWish");
  await wait(700);
  await type(A, "song");
  const list = await until(async () => (await hits(A)) || "", 9000, "regeln: Treffer");
  ok(list === "Song of Aurora", "regeln: nur der erlaubte Song steht in der Liste: " + list);
  await A.click("#wRes li button.go");
  await until(() => B.js(`[...document.querySelectorAll("#wList b")].some((b) => /Aurora/.test(b.textContent))`), 8000, "regeln: Auroras Wunsch ist da");
  // ein zweiter offener Wunsch desselben Gastes: abgelehnt, mit Grund
  await A.js(`lastWish = 0; 1`);
  await wait(1000);
  await type(A, "spotify:track:t000000000000000000005");
  await until(() => A.js(`document.querySelectorAll("#wRes li").length === 1`), 9000, "regeln: Link-Treffer");
  await A.click("#wRes li button.go");
  const max = (await A.js("T.wrMax")).replace("{n}", 1);
  await until(async () => (await msg(A)) === max, 6000, "regeln: zu viele offene Wünsche – das Handy sagt es");
  // gesperrter Song per Link: Grund statt „nichts gefunden“
  await type(B, "https://open.spotify.com/track/t000000000000000000002");
  const block = await B.js("T.wrBlock");
  await until(async () => (await msg(B)) === block, 9000, "regeln: gesperrter Song per Link");
  // zwei Stimmen: der Wunsch geht von selbst in die Warteschlange
  await B.click("#wList button", { text: "👍" });
  await until(() => T.js(`__sp.log.queued.includes("spotify:track:t000000000000000000000")`), 6000, "regeln: ab zwei Stimmen automatisch in der Warteschlange");
  await until(() => A.js(`/✓/.test(document.getElementById("wList").textContent)`), 6000, "regeln: die Handys zeigen ihn als angenommen");
  for (const ph of [A, B]) await ph.click("#wClose");
  for (const [k, v] of [["wishMax", 0], ["wishBlock", ""], ["wishClean", false], ["wishAuto", 0]]) await setRule(k, v);
  await T.js(`document.querySelector(".mirage-settings")?.remove(); 1`);
}
// Reaktionen: nur am Rand, insgesamt gedrosselt, abschaltbar
async function reactions() {
  await ensurePhones("reactions");
  await T.js(`(() => {
    window.__rx = [];
    new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.classList?.contains("m-im-react")) __rx.push({ at: performance.now(), left: parseFloat(n.style.left) }); }).observe(document.getElementById("mirage-immersive"), { childList: true });
    return 1;
  })()`);
  await P[0].click("#reacts button", { index: 0 });
  await until(() => T.js(`__rx.length >= 1`), 5000, "reaktion: das Emoji erscheint auf dem großen Bild");
  // 30 verschiedene Gäste auf einmal: insgesamt gedrosselt
  await T.js(`__rx.length = 0; 1`);
  await P[1].js(`for (let i = 0; i < 30; i++) sendUp({ k: "react", e: "🎉", id: "spam-" + i + "-abcdef" }); 1`);
  await wait(1500);
  const rx = await T.js(`__rx`);
  ok(rx.length >= 3 && rx.length <= 11, `reaktion: aus 30 auf einmal werden ein paar, kein Regen: ${rx.length}`);
  const mid = rx.filter((r) => r.left > 7 && r.left < 92);
  ok(!mid.length, "reaktion: nichts über der Mitte: " + mid.map((r) => r.left.toFixed(1)).join(", "));
  // ausgeschaltet: die Handys blenden die Leiste aus, und es kommt nichts mehr an
  await setRule("partyReacts", false);
  await T.js(`document.querySelector(".mirage-settings")?.remove(); 1`);
  await until(() => P[0].js(`getComputedStyle(document.getElementById("reacts")).display === "none"`), 4000, "reaktion: aus – die Handys zeigen keine Emoji-Leiste");
  await T.js(`__rx.length = 0; 1`);
  await wait(2000);
  await P[2].js(`sendUp({ k: "react", e: "🔥" }); 1`);
  await wait(1500);
  ok(!(await T.js(`__rx.length`)), "reaktion: aus – nichts erscheint");
  await setRule("partyReacts", true);
  await T.js(`document.querySelector(".mirage-settings")?.remove(); 1`);
  await until(() => P[0].js(`getComputedStyle(document.getElementById("reacts")).display !== "none"`), 4000, "reaktion: wieder an");
}
// Fernbedienung: eigener QR-Code nur auf Knopfdruck, Befehle nur mit der Unterschrift aus diesem Link
async function remoteControl() {
  const H = P[2], now = () => T.js(`__sp.now()`);
  await ensurePhones("remote");
  await T.js(`__menu.brightness(); 1`);
  ok(!(await T.js(`!!document.querySelector(".mirage-settings .m-rc-qr")`)), "fernbedienung: der QR-Code ist nicht von selbst zu sehen");
  await T.js(`document.querySelector(".mirage-settings .m-rc-btn").click(); 1`);
  await until(() => T.js(`!!document.querySelector(".mirage-settings .m-rc-qr img")?.naturalWidth`), 6000, "fernbedienung: QR-Code nach dem Knopf");
  const url = await T.js(`(async () => {
    const im = document.querySelector(".mirage-settings .m-rc-qr img"), c = document.createElement("canvas");
    c.width = c.height = 760;
    const x = c.getContext("2d");
    x.fillStyle = "#fff";
    x.fillRect(0, 0, 760, 760);
    x.drawImage(im, 20, 20, 720, 720);
    return jsQR(x.getImageData(0, 0, 760, 760).data, 760, 760)?.data || "";
  })()`);
  const rcHash = url.slice(url.indexOf("#"));
  ok(rcHash.startsWith(hash + "&h=") && /&r=[\w-]{20,}$/.test(rcHash), "fernbedienung: der Link trägt einen eigenen Schlüssel: " + url.slice(0, 60));
  await T.js(`document.querySelector(".mirage-settings .m-rc-btn").click(); 1`);
  ok(!(await T.js(`!!document.querySelector(".mirage-settings .m-rc-qr")`)), "fernbedienung: zweiter Druck verbirgt den Code wieder");
  await T.js(`document.querySelector(".mirage-settings")?.remove(); 1`);
  await H.win.loadURL(PAGE + "?rc=1" + rcHash);
  await until(() => H.js(`document.body.classList.contains("on") && !document.getElementById("bRc").hidden`).catch(() => false), 10000, "fernbedienung: das Handy hat den Knopf");
  ok(await P[0].js(`document.getElementById("bRc").hidden`), "fernbedienung: Gäste haben den Knopf nicht");
  await H.click("#bRc");
  await until(() => H.js(`document.querySelectorAll("#rcBody .rclv button").length === 5`), 6000, "fernbedienung: der Stand vom PC ist da");
  // ein Gast ohne den Schlüssel: nichts passiert
  const vol0 = (await now()).vol;
  await P[0].js(`sendSure({ k: "rc", hd: [myId, "vol", "", 5, Date.now(), "abcdefgh12"].join("|"), sig: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" }); 1`);
  await wait(1200);
  ok((await now()).vol === vol0, "fernbedienung: ein gefälschter Befehl wirkt nicht");
  // Lautstärke, nächster Song, Stärke, Location
  await H.click("#rcBody .rcrow button", { index: 4 });
  await until(async () => Math.abs((await now()).vol - (vol0 + 0.1)) < 0.011, 5000, "fernbedienung: lauter");
  const before = (await now()).uri;
  await H.click("#rcBody .rcrow button", { index: 2 });
  await until(async () => (await now()).uri !== before, 5000, "fernbedienung: nächster Song");
  await H.click("#rcBody .rclv button", { index: 4 });
  await until(() => H.js(`document.querySelectorAll("#rcBody .rclv button")[4]?.getAttribute("aria-pressed") === "true"`), 5000, "fernbedienung: Stärke 5 kommt am PC an");
  await H.js(`(() => { const s = document.querySelector("#rcBody .rcsel"); s.value = "beach"; s.dispatchEvent(new Event("change")); })(); 1`);
  await until(() => H.js(`rcS?.vn === "beach"`), 5000, "fernbedienung: Location kommt am PC an");
  // zurück: Stärke 2, Location automatisch, Lautstärke wie vorher, wieder als Gast
  await H.click("#rcBody .rclv button", { index: 1 });
  await H.js(`(() => { const s = document.querySelector("#rcBody .rcsel"); s.value = "auto"; s.dispatchEvent(new Event("change")); })(); 1`);
  await until(() => H.js(`rcS?.vn === "auto" && rcS?.lv === 2`), 5000, "fernbedienung: zurückgestellt");
  await T.js(`__sp.reset(); 1`);
  await H.win.loadURL(PAGE + "?guest=1" + hash);
  await until(() => H.js(`document.body.classList.contains("on") && document.getElementById("bRc").hidden`).catch(() => false), 10000, "fernbedienung: wieder als Gast verbunden");
}

const CASES = [
  // der erste verbindet die Handys
  ["never", neverGame],
  ["quiz", () => songGame("quiz")], ["title", () => songGame("title")], ["intro", () => songGame("intro")], ["dquiz", () => songGame("dquiz")],
  ["gap", () => lineGame("gap")], ["next", () => lineGame("next")], ["tf", () => lineGame("tf")],
  ["beat", beatGame], ["stop", stopGame], ["fast", fastGame], ["taps", tapsGame], ["battle", battleGame], ["bomb", bombGame],
  ["likely", () => voteGame("likely")], ["dlikely", () => voteGame("dlikely")],
  ["sing", singGame], ["alarm", alarmGame], ["wheel", () => wheelGame("wheel")], ["dwheel", () => wheelGame("dwheel")],
  ["key-badge", keyBadge], ["pause-screen", pauseScreen], ["mute-button", muteButton], ["media-keys", mediaKeys], ["one-artist", oneArtist], ["phone-reload", phoneReload], ["offline", offline], ["guest-profile", guestProfile], ["late-join", lateJoin], ["host", hostGame], ["quiz-level", quizLevel], ["quiz-source", quizSource], ["keyboard", keyboardPlay], ["result-card", resultCard],
  ["link-wish", linkWish], ["wish-rules", wishRules], ["reactions", reactions], ["remote", remoteControl],
];

/* ---------------------------------------------------------------- Start */
let PAGE = "";
process.on("unhandledRejection", (e) => {
  console.log("Testlauf abgebrochen: " + (e?.stack || e));
  process.exit(2);
});
app.whenReady().then(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const map = {};
  if (!PUBLIC) {
    brokers = [await startBroker(), await startBroker()];
    map["broker.hivemq.com"] = brokers[0].port;
    map["broker.emqx.io"] = brokers[1].port;
  }
  const theme = fs.readFileSync(process.env.E2E_THEME || path.join(ROOT, "Mirage", "theme.js"), "utf8"), css = fs.readFileSync(path.join(ROOT, "Mirage", "user.css"), "utf8");
  const fake = fs.readFileSync(path.join(__dirname, "fake-spotify.js"), "utf8");
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>
<div class="Root__main-view" id="main-view" style="position:fixed;inset:0 0 90px 280px;overflow:auto"><div style="height:260px"></div><div role="grid"></div></div>
<footer><div data-testid="volume-bar"><button data-testid="volume-bar-toggle-mute-button"></button></div></footer>
<script>${fake}<\/script>
<script>localStorage.setItem("mirage:settings", ${JSON.stringify(JSON.stringify(SETTINGS))});localStorage.setItem("mirage:welcomed", "1");<\/script>
<script>${theme.replace(/<\/script>/g, "<\\/script>")}<\/script></body></html>`;
  const srv = http.createServer((q, r) => {
    const u = q.url.split(/[?#]/)[0];
    if (u === "/__theme") {
      r.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      return r.end(html);
    }
    const f = path.join(LIVE, u === "/" ? "index.html" : u.slice(1));
    if (!f.startsWith(LIVE) || !fs.existsSync(f)) {
      r.writeHead(404);
      return r.end();
    }
    r.writeHead(200, { "content-type": f.endsWith(".js") ? "text/javascript" : f.endsWith(".html") ? "text/html; charset=utf-8" : "application/octet-stream" });
    r.end(fs.readFileSync(f));
  });
  await new Promise((go) => srv.listen(0, "127.0.0.1", go));
  const base = `http://localhost:${srv.address().port}/`;
  PAGE = base;

  const make = (name, w, h, part) => {
    const s = session.fromPartition(part);
    // nichts verlässt den Rechner (außer zu den echten Relays im Modus „public“)
    s.webRequest.onBeforeRequest((d, cb) => {
      const allowed = /^(http|ws):\/\/(localhost|127\.0\.0\.1)|^data:|^blob:|^devtools:/.test(d.url) || (PUBLIC && /^wss:\/\/broker\.(hivemq\.com|emqx\.io)/.test(d.url));
      cb({ cancel: !allowed });
    });
    // gespeicherte Bilder landen ohne Dialog im Ausgabeordner der Tests
    s.on("will-download", (_e, item) => item.setSavePath(path.join(OUT, item.getFilename())));
    const win = new BrowserWindow({ width: w, height: h, useContentSize: true, show: false, webPreferences: { offscreen: true, backgroundThrottling: false, sandbox: false, contextIsolation: false, partition: part, preload: path.join(__dirname, "ws-preload.js"), additionalArguments: PUBLIC ? [] : ["--mirage-brokers=" + JSON.stringify(map)] } });
    win.webContents.setFrameRate(name === "Big" ? 24 : 6);
    return new Win(name, win);
  };
  T = make("Big", 1280, 800, "e2e-theme");
  P = ["Alpha", "Beta", "Gamma"].map((n, i) => make(n, 412, 860, "e2e-p" + i));
  await T.win.loadURL(base + "__theme");
  await Promise.all(P.map((ph) => ph.win.loadURL(base)));
  await wait(1500);
  await T.js(`__sp.press("KeyM", { ctrlKey: true, shiftKey: true }); 1`);
  await until(() => T.js(`!!document.querySelector('#mirage-immersive [data-mode="party"]')`), 4000, "Immersive geht auf");
  await wait(600);
  await T.click('#mirage-immersive [data-mode="party"]');
  await wait(2000);

  const report = [];
  let list = CASES.filter(([n]) => !ONLY.length || ONLY.includes(n));
  // Handys verbinden sich im ersten Spiel mit Warteraum
  const NO_LOBBY = new Set(["sing", "alarm", "wheel", "dwheel", "pause-screen", "mute-button", "key-badge", "guest-profile", "late-join", "host", "quiz-level", "quiz-source", "result-card"]);
  if (ONLY.length && list.every(([n]) => NO_LOBBY.has(n))) list = [CASES[0], ...list];
  const hard = setTimeout(() => {
    console.log("Gesamt-Zeitlimit erreicht");
    process.exit(2);
  }, 40 * 60e3);
  for (const [name, run] of list) {
    const t0 = Date.now();
    let error = "";
    try {
      await run();
      const k = name in ICON ? name : "Fall";
      await afterGame(k);
    } catch (e) {
      error = e.message;
      const safe = name.replace(/\W/g, "_");
      await T.shot(path.join(OUT, safe + "-big.png"));
      await Promise.all(P.map((ph) => ph.shot(path.join(OUT, `${safe}-${ph.name}.png`))));
      const stateNow = await big.state().catch(() => ({}));
      const phonesNow = await Promise.all(P.map((p) => phoneState(p).catch(() => ({}))));
      error += `\n    groß: ${JSON.stringify({ st: stateNow.st, k: stateNow.k, text: stateNow.text })}\n    handy: ${JSON.stringify(phonesNow[0]).slice(0, 300)}`;
      // aufräumen, damit der nächste Fall sauber beginnt
      await T.js(`document.querySelector(".m-g-x")?.click(); if (!document.querySelector(".m-im-side").hidden) document.querySelector(".m-im-side-x").click(); document.querySelector('#mirage-immersive [data-mode="party"]').click(); __sp.resetArtists(); __sp.reset(); __sp.log.notes.length = 0; 1`).catch(() => {});
      [T, ...P].forEach((w) => (w.errors.length = 0));
      await wait(1500);
    }
    const ms = Date.now() - t0;
    report.push({ game: name, ok: !error, ms, error });
    console.log(`${error ? "FEHLER" : "ok    "} ${name.padEnd(14)} ${(ms / 1000).toFixed(1).padStart(6)} s${error ? "\n    " + error : ""}`);
  }
  clearTimeout(hard);
  const bad = report.filter((x) => !x.ok).length;
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify({ report, brokers: brokers.map((b) => b.stats) }, null, 1));
  console.log(`\n${report.length - bad} von ${report.length} bestanden` + (brokers.length ? ` · Relay: ${JSON.stringify(brokers.map((b) => b.stats))}` : ""));
  srv.close();
  brokers.forEach((b) => b.close());
  app.exit(bad ? 1 : 0);
});
