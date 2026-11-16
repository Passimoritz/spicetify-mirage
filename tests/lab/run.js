// Testlabor im Großen: alle Analysen (JSON im Spotify-Format, erzeugt mit testlab/scripts/analyze.py) durch die
// echte Party-Kette, parallel in Worker-Threads. Ohne Spotify, ohne Ton.
//   node tests/lab/run.js <out.jsonl> <dir|file.json> [...] [--meta map.json] [--jobs 12] [--limit N] [--filter re]
// map.json: { "<id>": { genreTop, fmaGenres, ... } } wird in die Metadaten jeder Analyse gemischt.
// Zusammenfassung je Quelle und Genre: node tests/lab/summary.js <out.jsonl>
const fs = require("fs");
const path = require("path");
const { Worker, isMainThread, parentPort, workerData } = require("worker_threads");

if (isMainThread) {
  const args = process.argv.slice(2);
  const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
  const out = args[0];
  const skip = new Set(["--meta", "--jobs", "--limit", "--filter", "--level"].flatMap((k) => (args.includes(k) ? [args.indexOf(k), args.indexOf(k) + 1] : [])));
  const inputs = args.slice(1).filter((_, i) => !skip.has(i + 1));
  let files = [];
  for (const p of inputs) {
    if (fs.statSync(p).isDirectory()) files.push(...fs.readdirSync(p).filter((f) => f.endsWith(".json")).map((f) => path.join(p, f)));
    else files.push(p);
  }
  const re = opt("--filter") ? new RegExp(opt("--filter")) : null;
  if (re) files = files.filter((f) => re.test(path.basename(f)));
  files.sort();
  const lim = +opt("--limit", 0);
  if (lim) {
    // gleichmäßig verteilt statt nur die ersten N
    const step = files.length / lim;
    files = Array.from({ length: Math.min(lim, files.length) }, (_, i) => files[Math.floor(i * step)]);
  }
  const jobs = +opt("--jobs", 12);
  const meta = opt("--meta") ? opt("--meta").split(",").reduce((a, f) => Object.assign(a, JSON.parse(fs.readFileSync(f, "utf8"))), {}) : {};
  const ws = fs.createWriteStream(out);
  let next = 0, done = 0, alive = 0;
  const t0 = Date.now();
  for (let w = 0; w < Math.min(jobs, files.length); w++) {
    alive++;
    const wk = new Worker(__filename, { workerData: { meta, level: +opt("--level", 2) } });
    const feed = () => (next < files.length ? wk.postMessage(files[next++]) : wk.postMessage(null));
    wk.on("message", (r) => {
      if (r) ws.write(JSON.stringify(r) + "\n");
      if (++done % 500 === 0) console.log(done, "/", files.length, ((Date.now() - t0) / 1000).toFixed(0) + " s");
      feed();
    });
    wk.on("error", (e) => console.error("worker", e));
    wk.on("exit", () => {
      if (--alive === 0) {
        ws.end();
        console.log("fertig:", done, "Songs in", ((Date.now() - t0) / 1000).toFixed(0), "s →", out);
      }
    });
    feed();
  }
} else {
  const { simulate } = require("./sim.js");
  parentPort.on("message", async (file) => {
    if (!file) return process.exit(0);
    try {
      const raw = JSON.parse(fs.readFileSync(file, "utf8"));
      const id = path.basename(file, ".json");
      const meta = { id, ...(raw.meta || {}), ...(workerData.meta[id] || workerData.meta[raw.meta?.id] || {}) };
      const r = await simulate(raw, meta, { level: workerData.level });
      parentPort.postMessage(r);
    } catch (e) {
      parentPort.postMessage({ id: path.basename(file), error: String(e.stack || e).slice(0, 300) });
    }
  });
}
