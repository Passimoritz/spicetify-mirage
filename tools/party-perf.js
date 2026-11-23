// Party-Modus live durchmessen: das echte Theme (Mirage/theme.js) im kopflosen Electron, ein künstlicher Song mit
// bekanntem Aufbau (Aufbau → Drop → Break → Aufbau → Drop …), Preset „Voll“, Publikum an, verspielter Liedtext an.
// Gemessen werden (je Bild) der Hauptthread und der Hintergrund-Thread der Location, dazu eine Aufschlüsselung:
// Zeichenzeit der Location je Ebene, Liedtext und Bild im Hauptthread, Stil- und Layout-Neuberechnungen, GC,
// lange Aufgaben, Größe der Canvas und neue Leuchtbilder/Körperbilder (Speicher-Fehltreffer).
//   npm run perf:party                      messen, Bericht in tests/e2e/out/party-perf.json
//   npm run perf:party -- --check           zusätzlich das Budget prüfen (Exit-Code 1, wenn gerissen)
//   PERF_SECS=90 PERF_LEVEL=4 PERF_THEME=pfad/theme.js PERF_CSS=pfad/user.css npm run perf:party
// Budget (--check): relativ zu einer Eichmessung im selben Lauf (feste Canvas- und Rechenarbeit im selben Fenster),
// damit ein langsamer Rechner nicht durchfällt und ein schneller keinen Rückschritt versteckt – siehe BUDGET unten.
const { app, BrowserWindow, session, contentTracing } = require("electron");
const fs = require("fs"), path = require("path"), http = require("http");
const { SHAPES, raw } = require("../tests/unit/songshapes.js");

const ROOT = path.join(__dirname, ".."), OUT = path.join(ROOT, "tests", "e2e", "out");
const SECS = Number(process.env.PERF_SECS) || 60;
const LEVEL = Number(process.env.PERF_LEVEL) || 3;
const CHECK = process.argv.includes("--check");
const KEEP_TRACE = process.argv.includes("--trace");
const W = 1600, H = 900;
// Budget: Vielfache der Eichmessung (Median eines festen Bilds aus Verläufen, Leuchtbildern und Pfaden)
// (gemessen auf einem Desktop mit Grafikkarte: Eichung ~30–45 ms, Hauptthread p95 ~1,2 ms, Thread p95 ~2,5 ms,
// Hauptthread gesamt ~210 ms/s – die Grenzen lassen gut doppelt so viel Luft)
const BUDGET = { mainP95: 0.08, workerP95: 0.12, mainBusy: 10, longTask: 50 };
const SETTINGS = {
  preset: "full", presetBase: "full", glass: true, particles: true, grain: true, beat: true, tilt: true, cascade: true, calm: false, lite: false,
  noFlash: false, partyCrowd: true, lyrPlayful: true, lyrPlayLevel: "playful", partyLevel: LEVEL, partyLive: false, partyWishes: false,
  partyDirector: true, partyDJ: true, partyBlend: true, partyOnline: false, imMode: "party",
  // Vergleiche: PERF_SET='{"lyrPlayful":false}' schaltet einzelne Einstellungen um
  ...JSON.parse(process.env.PERF_SET || "{}"),
};
// ein Song, der die ganze Spieldauer des Test-Spotify (200 s) füllt: drei Drops, dazwischen Breaks und Aufbauten
SHAPES.perf = { bpm: 128, kick: "four", parts: [["intro", 8, -15], ["break", 8, -14], ["pre", 8, -13, { rise: -9, dip: true }], ["drop", 16, -5], ["break", 8, -15], ["pre", 8, -13, { rise: -9, dip: true }], ["drop", 16, -5], ["break", 8, -14], ["pre", 4, -12, { rise: -9, dip: true }], ["drop", 16, -5], ["outro", 8, -13]] };
const SONGS = [raw("perf"), raw("rock")].map(({ truth, ...d }) => d);

app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
// mit Grafikkarte wie Spotify (ohne gibt es Chromium in Software: dann zeichnet der Hauptthread jedes Bild die ganze
// Seite neu – das misst die Software, nicht Mirage). PERF_SW=1: ohne Grafikkarte (z. B. zum Vergleich mit den E2E-Tests)
if (process.env.PERF_SW) app.commandLine.appendSwitch("disable-gpu");
app.commandLine.appendSwitch("mute-audio");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const q = (arr, p) => {
  if (!arr.length) return 0;
  const s = arr.slice().sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};
const r2 = (v) => Math.round(v * 100) / 100;
const dist = (a) => ({ n: a.length, p50: r2(q(a, 0.5)), p95: r2(q(a, 0.95)), p99: r2(q(a, 0.99)), max: r2(a.length ? Math.max(...a) : 0), mean: r2(a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0) });

// Messung im Fenster: Bildabstände (rAF), lange Aufgaben, Liedtext/Bild je Bild, Zeichenzeit des Threads
const RECORDER = `(() => {
  const R = window.__perfRec = { on: false, raf: [], long: [], main: [], venue: [], stats: [], size: null, marks: [], plans: [] };
  let last = 0;
  const tick = (now) => {
    if (R.on && last) R.raf.push([now, now - last]);
    last = now;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (R.on) R.long.push([e.startTime, e.duration]); }).observe({ type: "longtask", buffered: false });
  } catch {}
  window.__miragePerf = {
    main(lyr, viz, w, h) { if (R.on) R.main.push([performance.now(), lyr, viz]); R.size = [w, h]; },
    plan(map, plan, segs) { R.plans.push([performance.now(), Math.round(map * 10) / 10, Math.round(plan * 10) / 10, segs]); },
    venue(d) { if (!R.on) return; R.venue.push([performance.now(), d.ms]); R.vsize = [d.w, d.h]; if (d.stats) R.stats.push(d.stats); },
  };
  R.mark = (name) => { R.marks.push([name, performance.now()]); console.timeStamp("perf:" + name); };
})();`;
// Eichmessung: ein festes Bild aus Lichtkegeln (Verläufe, „lighter“), Leuchtbildern und Pfaden – wie die Location
const CALIB = `(async () => {
  const c = document.createElement("canvas");
  c.width = ${W}; c.height = ${H};
  const x = c.getContext("2d"), s = document.createElement("canvas");
  s.width = s.height = 64;
  const sx = s.getContext("2d"), g0 = sx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g0.addColorStop(0, "rgba(255,200,120,1)"); g0.addColorStop(1, "rgba(255,200,120,0)");
  sx.fillStyle = g0; sx.fillRect(0, 0, 64, 64);
  const one = () => {
    const t0 = performance.now();
    x.globalCompositeOperation = "source-over";
    x.clearRect(0, 0, ${W}, ${H});
    x.globalCompositeOperation = "lighter";
    for (let i = 0; i < 40; i++) {
      const ox = (i / 40) * ${W}, g = x.createRadialGradient(ox, 30, 0, ox, 30, ${H});
      g.addColorStop(0, "rgba(120,160,255,0.4)"); g.addColorStop(0.4, "rgba(120,160,255,0.12)"); g.addColorStop(1, "rgba(120,160,255,0)");
      x.fillStyle = g; x.beginPath(); x.moveTo(ox, 30); x.lineTo(ox - 200, ${H}); x.lineTo(ox + 200, ${H}); x.closePath(); x.fill();
    }
    for (let i = 0; i < 600; i++) x.drawImage(s, (i * 37) % ${W}, (i * 53) % ${H}, 48, 48);
    let a = 0;
    for (let i = 0; i < 20000; i++) a += Math.sin(i) * Math.cos(i * 0.5);
    x.getImageData(0, 0, 1, 1);
    return performance.now() - t0 + a * 0;
  };
  const ms = [];
  for (let i = 0; i < 40; i++) { ms.push(one()); await new Promise((r) => setTimeout(r, 5)); }
  ms.sort((a, b) => a - b);
  return ms[ms.length >> 1];
})()`;

// Trace (Chromium-Timeline) auswerten: je Thread Summen je Ereignis, lange Aufgaben, Stil/Layout, GC
function readTrace(file, ranges) {
  const ev = JSON.parse(fs.readFileSync(file, "utf8"));
  const list = Array.isArray(ev) ? ev : ev.traceEvents;
  const names = {};
  for (const e of list) if (e.ph === "M" && e.name === "thread_name") names[e.pid + ":" + e.tid] = e.args.name;
  // Anker: console.timeStamp("perf:…") liegt als TimeStamp-Ereignis im Trace
  const marks = {};
  let mainKey = "";
  for (const e of list) {
    const m = e.name === "TimeStamp" && e.args?.data?.message;
    if (m && m.startsWith("perf:")) {
      marks[m.slice(5)] = e.ts / 1000;
      mainKey = e.pid + ":" + e.tid;
    }
  }
  const mainPid = mainKey.split(":")[0];
  const per = {};
  const t0 = marks.start, t1 = marks.end;
  const inWin = (ts) => ts >= t0 && ts <= t1;
  const steady = (ts) => !ranges.some(([a, b]) => ts >= a && ts <= b);
  for (const e of list) {
    if (e.ph !== "X" || !e.dur || String(e.pid) !== mainPid) continue;
    const k = e.pid + ":" + e.tid, ts = e.ts / 1000;
    if (!inWin(ts)) continue;
    const th = (per[k] ||= { name: names[k] || k, sum: {}, cnt: {}, tasks: [], long: [], elems: 0 });
    const d = e.dur / 1000;
    th.sum[e.name] = (th.sum[e.name] || 0) + d;
    th.cnt[e.name] = (th.cnt[e.name] || 0) + 1;
    if (e.name === "UpdateLayoutTree") th.elems += e.args?.elementCount || 0;
    if (e.name === "ThreadControllerImpl::RunTask" || e.name === "RunTask") {
      th.tasks.push(d);
      if (d > BUDGET.longTask) th.long.push({ at: r2((ts - t0) / 1000), ms: r2(d), steady: steady(ts - t0) });
    }
  }
  const secs = (t1 - t0) / 1000;
  const KEYS = ["RunTask", "ThreadControllerImpl::RunTask", "FunctionCall", "FireAnimationFrame", "TimerFire", "EventDispatch", "UpdateLayoutTree", "Layout", "PrePaint", "Paint", "Layerize", "Commit", "MinorGC", "MajorGC", "V8.GC_MC_BACKGROUND_MARKING", "HitTest", "ParseHTML", "EvaluateScript", "v8.compile", "Decode Image"];
  const threads = Object.values(per).map((th) => ({
    name: th.name,
    // Millisekunden je Sekunde (Anteil Last), Anzahl je Sekunde
    msPerSec: Object.fromEntries(KEYS.filter((k) => th.sum[k]).map((k) => [k, r2(th.sum[k] / secs)])),
    perSec: Object.fromEntries(["UpdateLayoutTree", "Layout", "MinorGC", "MajorGC", "Paint"].filter((k) => th.cnt[k]).map((k) => [k, r2(th.cnt[k] / secs)])),
    styleElemsPerSec: Math.round(th.elems / secs),
    task: dist(th.tasks),
    long: th.long,
  })).filter((th) => th.task.n > 20).sort((a, b) => b.task.n * b.task.mean - a.task.n * a.task.mean);
  return { secs: r2(secs), threads };
}

let T;
app.whenReady().then(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const theme = fs.readFileSync(process.env.PERF_THEME || path.join(ROOT, "Mirage", "theme.js"), "utf8"), css = fs.readFileSync(process.env.PERF_CSS || path.join(ROOT, "Mirage", "user.css"), "utf8");
  const fake = fs.readFileSync(path.join(ROOT, "tests", "e2e", "fake-spotify.js"), "utf8");
  // eigene Taktanalyse: Song 0 der künstliche Party-Song, Song 1 ein Rocksong (für den Wechsel)
  const ana = `(() => { const A = ${JSON.stringify(SONGS)}; Spicetify.getAudioData = async (uri) => { await new Promise((r) => setTimeout(r, 200)); const i = parseInt(uri.slice(-6), 10) || 0; return JSON.parse(JSON.stringify(A[i % A.length])); }; __sp.allAnalysis(true); })();`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>
<div class="Root__main-view" id="main-view" style="position:fixed;inset:0 0 90px 280px;overflow:auto"><div style="height:260px"></div><div role="grid"></div></div>
<footer><div data-testid="volume-bar"><button data-testid="volume-bar-toggle-mute-button"></button></div></footer>
<script>${fake}<\/script><script>${ana}<\/script><script>${RECORDER}<\/script>
<script>localStorage.setItem("mirage:settings", ${JSON.stringify(JSON.stringify(SETTINGS))});localStorage.setItem("mirage:welcomed", "1");<\/script>
<script>${theme.replace(/<\/script>/g, "<\\/script>")}<\/script></body></html>`;
  const srv = http.createServer((req, res) => {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(html);
  });
  await new Promise((go) => srv.listen(0, "127.0.0.1", go));
  const s = session.fromPartition("perf-" + Date.now());
  s.webRequest.onBeforeRequest((d, cb) => cb({ cancel: !/^(http|ws):\/\/(localhost|127\.0\.0\.1)|^data:|^blob:|^devtools:/.test(d.url) }));
  const win = new BrowserWindow({ width: W, height: H, useContentSize: true, show: false, webPreferences: { offscreen: true, backgroundThrottling: false, sandbox: false, contextIsolation: false, session: s } });
  win.webContents.setFrameRate(60);
  win.webContents.setAudioMuted(true);
  const errors = [];
  win.webContents.on("console-message", (_e, level, msg) => level >= 3 && !/Failed to load resource|net::ERR/.test(msg) && errors.push(msg.slice(0, 300)));
  T = (code) => win.webContents.executeJavaScript(code);
  await win.loadURL(`http://localhost:${srv.address().port}/`);
  await wait(1500);
  const calib0 = await T(CALIB);
  await T(`__sp.press("KeyM", { ctrlKey: true, shiftKey: true }); 1`);
  await wait(1200);
  await T(`document.querySelector('#mirage-immersive [data-mode="party"]')?.click(); 1`);
  // Song 0 von vorn, dann in den Aufbau vor dem ersten Drop springen (Liedtext, Analyse, Plan sind dann da)
  await T(`__sp.resetArtists(); 1`);
  await wait(4000);
  const mode = await T(`document.getElementById("mirage-immersive")?.dataset.mode`);
  if (mode !== "party") throw new Error("Party-Modus ging nicht auf: " + mode);
  await T(`Spicetify.Player.seek(45000); 1`);
  await wait(2500);
  const traceFile = path.join(OUT, "party-perf-trace.json");
  // PERF_CATS=disabled-by-default-devtools.timeline.invalidationTracking (mit --trace): wer Stil-Neuberechnungen auslöst
  const cats = ["devtools.timeline", "toplevel", "v8", ...(process.env.PERF_CATS || "").split(",").filter(Boolean)];
  await contentTracing.startRecording({ included_categories: cats, excluded_categories: ["*"] });
  await wait(300);
  await T(`__perfRec.on = true; __perfRec.mark("start"); 1`);
  const t0 = Date.now(), at = (s) => wait(Math.max(0, t0 + s * 1000 - Date.now()));
  // 0 … 0,63·SECS: Aufbau, Drop, Break · dann ans Songende springen: DJ-Übergang in den nächsten Song
  const jumpAt = Math.round(SECS * 0.63);
  await at(jumpAt);
  await T(`__perfRec.mark("seek"); Spicetify.Player.seek(186000); 1`);
  let changeAt = -1;
  while (Date.now() - t0 < SECS * 1000) {
    await wait(250);
    if (changeAt < 0 && (await T(`__sp.now().i`)) === 1) {
      changeAt = (Date.now() - t0) / 1000;
      await T(`__perfRec.mark("change"); 1`);
    }
  }
  await T(`__perfRec.mark("end"); __perfRec.on = false; 1`);
  await wait(300);
  await contentTracing.stopRecording(traceFile);
  const rec = await T(`(() => { const R = __perfRec; return { plans: R.plans, raf: R.raf, long: R.long, main: R.main, venue: R.venue, stats: R.stats, size: R.size, vsize: R.vsize, marks: R.marks,
    canvases: [...document.querySelectorAll("canvas")].filter((c) => c.width * c.height > 0).map((c) => [c.className || c.id || "canvas", c.width, c.height]),
    lyricsNodes: document.querySelectorAll("#mirage-immersive .m-im-lyrics *").length, playful: !!document.querySelector("#mirage-immersive .m-im-lyrics.is-playful"),
    quality: document.getElementById("mirage-immersive")?.dataset.mode }; })()`);
  const calib1 = await T(CALIB);
  // --shots: Bilder an markanten Stellen von Song 0 (Aufbau, Drop-Einsatz, Drop, Break) – zum Ansehen, nicht gemessen
  if (process.argv.includes("--shots")) {
    await T(`__sp.resetArtists(); 1`);
    await wait(3000);
    for (const [name, at2] of [["build", 56.5], ["lead", 60.4], ["drop", 66], ["break", 95], ["drop2", 121]]) {
      await T(`Spicetify.Player.seek(${Math.round((at2 - 1.2) * 1000)}); 1`);
      await wait(1200);
      fs.writeFileSync(path.join(OUT, `party-${name}.png`), (await win.webContents.capturePage()).toPNG());
    }
  }
  const calib = Math.min(calib0, calib1);

  // Zeitfenster: Start (performance.now) und Ausnahmen (Sprung: 2 s danach, Songwechsel: 1 s davor bis 4 s danach)
  const mark = Object.fromEntries(rec.marks);
  const st0 = mark.start, rel = (t) => t - st0;
  const ranges = [[rel(mark.seek) - 50, rel(mark.seek) + 2000]];
  if (mark.change) ranges.push([rel(mark.change) - 1500, rel(mark.change) + 4000]);
  // die ersten 1,5 s gehören noch zum Einschwingen nach dem Sprung vor der Messung
  ranges.push([0, 1500]);
  const steady = (t) => !ranges.some(([a, b]) => rel(t) >= a && rel(t) <= b);
  const raf = rec.raf.filter(([t]) => steady(t)).map(([, d]) => d);
  const mainWork = rec.main.filter(([t]) => steady(t));
  const venue = rec.venue.filter(([t]) => steady(t)).map(([, d]) => d);
  const longAll = rec.long.map(([t, d]) => ({ at: r2(rel(t) / 1000), ms: r2(d), steady: steady(t) }));
  const trace = readTrace(traceFile, ranges);
  if (!KEEP_TRACE) fs.rmSync(traceFile, { force: true });
  // Aufschlüsselung der Location (Summe aller Abrufe, je Bild gemittelt)
  const layers = {};
  let vn = 0, glowMiss = 0, bodyMiss = 0, canv = 0, last = null;
  for (const x of rec.stats) {
    vn += x.n;
    glowMiss += x.glowMiss;
    bodyMiss += x.bodyMiss;
    canv += x.canvases;
    for (const [k, v] of Object.entries(x.ms)) layers[k] = (layers[k] || 0) + v;
    last = x;
  }
  for (const k in layers) layers[k] = r2(layers[k] / Math.max(1, vn));
  const mainTh = trace.threads.find((t) => t.name === "CrRendererMain"), workTh = trace.threads.find((t) => /Worker/.test(t.name));
  const report = {
    when: new Date().toISOString(), secs: SECS, level: LEVEL, size: [W, H], calibMs: r2(calib),
    marks: { seekAt: jumpAt, changeAt: r2(changeAt) },
    frames: { interval: dist(raf), over25: raf.filter((d) => d > 25).length, fps: r2(1000 / (q(raf, 0.5) || 16.7)) },
    main: { lyricsMs: dist(mainWork.map((x) => x[1])), vizMs: dist(mainWork.map((x) => x[2])), frameMs: dist(mainWork.map((x) => x[1] + x[2])),
      // die teuersten Bilder rund um Sprung und Songwechsel (Liedtext / Bild in ms)
      worstAtChange: rec.main.filter(([t]) => !steady(t)).sort((a, b) => b[1] + b[2] - a[1] - a[2]).slice(0, 5).map(([t, l, v]) => ({ at: r2(rel(t) / 1000), lyrics: r2(l), viz: r2(v) })) },
    worker: { drawMs: dist(venue), layersMsPerFrame: layers, glowMissPerMin: r2((glowMiss / SECS) * 60), bodyMissPerMin: r2((bodyMiss / SECS) * 60), canvasesPerMin: r2((canv / SECS) * 60), caches: last && { glows: last.glows, bodies: last.bodies, people: last.people } },
    canvases: rec.canvases.concat(rec.vsize ? [["venue (Thread)", ...rec.vsize]] : []), lyricsNodes: rec.lyricsNodes, playful: rec.playful,
    longTasks: longAll,
    // Song-Karte und Regie-Plan (planswap.js, in einer Leerlaufzeit): Dauer in ms
    plans: rec.plans.map(([t, map, plan, segs]) => ({ at: r2(rel(t) / 1000), map, plan, segs })),
    trace,
    errors: errors.slice(0, 10),
  };
  const file = path.join(OUT, "party-perf.json");
  fs.writeFileSync(file, JSON.stringify(report, null, 1));
  // kurzer Bericht
  const f = (o) => `p50 ${o.p50} · p95 ${o.p95} · p99 ${o.p99} · max ${o.max} ms`;
  console.log(`Party-Messung ${SECS} s, Stufe ${LEVEL}, ${W}×${H}, Eichung ${r2(calib)} ms (verspielt: ${rec.playful})`);
  console.log(`  Bildabstand        ${f(report.frames.interval)} · über 25 ms: ${report.frames.over25}`);
  console.log(`  Hauptthread Bild   ${f(report.main.frameMs)} (Liedtext ${report.main.lyricsMs.p95}, Bild ${report.main.vizMs.p95} p95)`);
  console.log(`  Thread Location    ${f(report.worker.drawMs)}`);
  console.log(`  Ebenen je Bild     ${Object.entries(layers).map(([k, v]) => k + " " + v).join(" · ")}`);
  console.log(`  Fehltreffer/min    Leuchtbilder ${report.worker.glowMissPerMin} · Körper ${report.worker.bodyMissPerMin} · Canvas ${report.worker.canvasesPerMin}`);
  for (const th of [mainTh, workTh].filter(Boolean)) console.log(`  ${th.name.padEnd(18)} ${Object.entries(th.msPerSec).map(([k, v]) => k.replace("ThreadControllerImpl::", "") + " " + v).join(" · ")} ms/s · Stil-Elemente/s ${th.styleElemsPerSec} · ${JSON.stringify(th.perSec)}`);
  console.log(`  teuerste Bilder beim Wechsel ${report.main.worstAtChange.map((w) => `${w.at}s: Liedtext ${w.lyrics} + Bild ${w.viz} ms`).join(" · ")}`);
  console.log(`  Plan je Song      ${report.plans.map((p) => `${p.at}s: Karte ${p.map} + Plan ${p.plan} ms`).join(" · ") || "–"}`);
  console.log(`  lange Aufgaben     ${longAll.map((l) => `${l.at}s:${l.ms}ms${l.steady ? "" : "(Wechsel)"}`).join(" ") || "keine"}`);
  if (errors.length) console.log("  Fehler im Fenster: " + errors.slice(0, 3).join(" | "));
  const busy = mainTh ? mainTh.msPerSec["ThreadControllerImpl::RunTask"] || mainTh.msPerSec.RunTask || 0 : 0;
  // vergleichbar über Rechner und Läufe hinweg: geteilt durch die Eichung
  report.rel = { mainP95: r2(report.main.frameMs.p95 / calib * 100), workerP95: r2(report.worker.drawMs.p95 / calib * 100), mainBusy: r2(busy / calib), workerBusy: r2((workTh?.msPerSec.FunctionCall || 0) / calib) };
  fs.writeFileSync(file, JSON.stringify(report, null, 1));
  console.log(`  relativ zur Eichung  Hauptthread p95 ${report.rel.mainP95} % · Thread p95 ${report.rel.workerP95} % · Hauptthread gesamt ${report.rel.mainBusy}× je s · Thread gesamt ${report.rel.workerBusy}× je s`);
  console.log(`  → ${path.relative(ROOT, file)}`);
  let bad = 0;
  if (CHECK) {
    const lim = (k) => r2(BUDGET[k] * calib);
    const checks = [
      ["Hauptthread p95 (Liedtext + Bild)", report.main.frameMs.p95, lim("mainP95")],
      ["Thread Location p95", report.worker.drawMs.p95, lim("workerP95")],
      ["Hauptthread gesamt (ms je s)", busy, lim("mainBusy")],
      ["lange Aufgaben (> 50 ms) im laufenden Song", longAll.filter((l) => l.steady).length + (mainTh?.long.filter((l) => l.steady).length || 0), 0],
    ];
    for (const [name, v, max] of checks) {
      const ok = v <= max;
      if (!ok) bad++;
      console.log(`  ${ok ? "ok    " : "FEHLER"} ${name}: ${v} (Grenze ${max})`);
    }
    if (report.main.frameMs.n < SECS * 20) {
      bad++;
      console.log(`  FEHLER zu wenige Bilder gemessen: ${report.main.frameMs.n}`);
    }
  }
  srv.close();
  app.exit(bad ? 1 : 0);
}).catch((e) => {
  console.log("Messung abgebrochen: " + (e?.stack || e));
  app.exit(2);
});
