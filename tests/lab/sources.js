// Testlabor „Quellen“: was Mirage OHNE Spotify-Analyse und OHNE Spotify-Künstlergenres weiß.
// Je Song (Manifest aus einem Abruf mit rohen Deezer-/iTunes-Antworten, siehe Bericht) laufen die echten Funktionen:
// Treffer-Auswahl (sources.js), Tempo aus der Hörprobe (tempo.js, Probe mit ffmpeg dekodiert, nie abgespielt)
// und die Genre-Wahl (genres.js pickProfile / pickGenre). Gemessen gegen Harmonix (menschliches Tempo, Genre)
// bzw. das Chart-Genre von Deezer.
//   node tests/lab/sources.js <manifest.jsonl>[,<manifest2.jsonl>] <audio-dir> <out.jsonl> [--limit N] [--it itunes.jsonl]
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { load } = require("./env.js");
const { expectFamily } = require("./metrics.js");

const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const SR = 22050;

function decode(file) {
  // nur dekodieren (rohe 32-bit-Samples nach stdout) – kein Ausgabegerät, kein Ton
  const r = spawnSync("ffmpeg", ["-v", "quiet", "-i", file, "-ac", "1", "-ar", String(SR), "-f", "f32le", "-"], { maxBuffer: 64 << 20 });
  if (r.status !== 0 || !r.stdout?.length) return null;
  const b = r.stdout;
  return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.length - (b.length % 4)));
}
// Oktav-tolerant: gleich (±4 %), doppelt/halb, sonst falsch
function tempoClass(est, ref) {
  if (!est || !ref) return "none";
  const r = est / ref;
  if (Math.abs(r - 1) < 0.04) return "exact";
  if (Math.abs(r - 2) < 0.08 || Math.abs(r - 0.5) < 0.02) return "octave";
  if (Math.abs(r - 1.5) < 0.06 || Math.abs(r - 2 / 3) < 0.027) return "third";
  return "wrong";
}

(async () => {
  const T = await load("tempo.js");
  const G = await load("genres.js");
  const SRC = await load("srcmatch.js");
  const famOf = {};
  for (const [f, keys] of Object.entries(G.FAMILIES)) for (const k of keys) famOf[k] = f;
  const rows = args[0].split(",").flatMap((f) => fs.readFileSync(f, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)));
  const lim = +opt("--limit", 0);
  const list = lim ? rows.filter((_, i) => i % Math.ceil(rows.length / lim) === 0) : rows;
  // --reuse <alt.jsonl>: Tempo/Klang aus einem früheren Lauf übernehmen (nur die Genre-Wahl neu rechnen)
  const reuse = opt("--reuse") ? new Map(fs.readFileSync(opt("--reuse"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)).map((r) => [r.id, r])) : null;
  const ws = fs.createWriteStream(args[2]);
  let n = 0;
  for (const m of list) {
    const out = { id: m.id, src: m.src, genre: m.hxGenre || m.dzGenre || "", hxBpm: m.hxBpm || 0 };
    // ---- Deezer-Treffer wie Mirage ihn wählt (mit sources.js, sonst der erste Treffer vom selben Künstler)
    const dzHit = SRC?.pickDeezer ? SRC.pickDeezer(m.dzSearch || [], m.title, m.artist) : null;
    const dzOk = dzHit && m.dzTrack && dzHit.id === m.dzTrack.id;
    out.dzBpm = dzOk ? m.dzTrack.bpm || 0 : m.dzTrack?.bpm || 0;
    const appleG = SRC?.pickApple ? SRC.pickApple(m.itResults || [], m.title, m.artist) : "";
    out.apple = appleG;
    out.hasIt = !!m.itResults;
    out.dzAlbum = (m.dzAlbumGenres || []).join("|");
    // ---- Tempo aus der Hörprobe
    const old = reuse?.get(m.id);
    if (old) for (const k of ["ms", "pvBpm", "pvConf", "pvAlt", "feats", "pvHintBpm"]) if (k in old) out[k] = old[k];
    if (m.file && !old) {
      const pcm = decode(path.join(args[1], m.file));
      if (pcm) {
        const t0 = performance.now();
        const a = await T.analyzePcm(pcm, SR, 0);
        out.ms = +(performance.now() - t0).toFixed(1);
        Object.assign(out, { pvBpm: a.bpm, pvConf: a.conf, pvAlt: a.alt, feats: a.feats });
        const ah = out.dzBpm ? await T.analyzePcm(pcm, SR, out.dzBpm) : null;
        out.pvHintBpm = ah?.bpm || 0;
      }
    }
    if (out.hxBpm) {
      out.cDz = tempoClass(out.dzBpm, out.hxBpm);
      out.cPv = tempoClass(out.pvBpm, out.hxBpm);
      out.cPvFold = tempoClass(T.foldBpm(out.pvBpm), out.hxBpm);
      out.cDzFold = tempoClass(T.foldBpm(out.dzBpm, 75, 150), out.hxBpm);
    }
    // ---- Genre ohne Spotify-Künstlergenres
    const expect = expectFamily({ hxGenre: m.hxGenre, dzGenre: m.dzGenre });
    out.expect = expect;
    const bpm = T.foldBpm(out.pvHintBpm || out.pvBpm || out.dzBpm);
    const loud = out.feats ? out.feats.loud + 4 : -10;
    const fam = (k) => famOf[k] || "pop";
    const run = (label, r) => {
      out[label] = r.key;
      out[label + "Fam"] = fam(r.key);
      out[label + "Hit"] = expect.length ? expect.includes(fam(r.key)) : null;
      if (r.conf != null) out[label + "Conf"] = r.conf;
    };
    // vorher: nur iTunes-Genre (falls gefunden) + Klang aus Tempo/Lautheit
    run("old", G.pickProfile([], bpm, loud, appleG, 0));
    run("oldSound", G.pickProfile([], bpm, loud, "", 0));
    if (G.pickGenre) {
      run("new", G.pickGenre({ genres: [], apple: appleG, deezer: m.dzAlbumGenres || [], artist: m.artist, title: m.title, bpm, loud, minor: 0, sound: out.feats }));
      run("newSound", G.pickGenre({ genres: [], apple: "", deezer: [], artist: m.artist, title: m.title, bpm, loud, minor: 0, sound: out.feats }));
    }
    ws.write(JSON.stringify(out) + "\n");
    if (++n % 100 === 0) console.log(n, "/", list.length);
  }
  ws.end();
  console.log("fertig", n);
})();
