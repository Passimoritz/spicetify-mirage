// Testlabor: ein Song (Analyse im Spotify-Format + Metadaten) durch die echte Party-Kette – Song-Karte, Regie,
// Stimmung, Party-Zustand pro Bild (60 Hz), Publikum, Instrumente, Genre – und Kennzahlen dazu.
// Mit Grundwahrheit (Harmonix: Schläge, Einsen, Teile) gegen sie gemessen, sonst Plausibilität.
const { load, loadParty } = require("./env.js");
const { tolerantF, boundaryF, LABEL, labelAt, expectFamily, spotifyStrings } = require("./metrics.js");

let M = null;
async function modules() {
  if (M) return M;
  const [A, D, SM, G, IS, P, CR, ST] = await Promise.all([
    load("audio.js", ["core", "config", "estimate", "player", "analysis-db"]),
    load("director.js"), load("songmap.js"), load("genres.js"), load("instrsound.js"), loadParty(), load("crowd.js").catch(() => null), load("styles.js"),
  ]);
  M = { shape: A.shape, planSong: D.planSong, songMap: SM.songMap, pickProfile: G.pickProfile, FAMILIES: G.FAMILIES, heard: IS.heardMoments, party: P.party, crowd: CR, kin: ST.kin };
  M.famOf = {};
  for (const [f, keys] of Object.entries(G.FAMILIES)) for (const k of keys) M.famOf[k] = f;
  return M;
}

// Publikum: Stimmung und wer springt / Hände hoch – über src/crowd.js (wenn vorhanden), sonst die alte Logik
// aus venue.js (Stand vor dem Labor, hier nachgebaut, damit „vorher“ messbar bleibt)
function crowdV0(m) {
  const MOVES = { rave: "jump", trance: "wave", hardstyle: "jump", dnb: "jump", techno: "pump", house: "bounce", rock: "bang", metal: "bang", punk: "jump", bass: "nod", pop: "clap", kpop: "clap", disco: "clap", country: "clap",
    latin: "bounce", afro: "bounce", reggae: "skank", chill: "sway", jazz: "sway", classical: "sway", edm: "jump", deephouse: "bounce", techhouse: "pump", psytrance: "jump", dubstep: "bang", garage: "bounce", eurodance: "jump",
    melodictechno: "pump", hardtechno: "pump", futurebass: "jump", electroswing: "bounce", breakbeat: "bounce", boombap: "nod", dancehall: "bounce", cloudrap: "sway", hardrock: "bang", postrock: "sway", ska: "skank", emo: "jump", jpop: "clap", musical: "clap",
    christmas: "sway", celtic: "clap", balkan: "jump", amapiano: "bounce", lofi: "sway", neoclassical: "sway", acoustic: "sway", synthwave: "nod", hyperpop: "jump", trap: "bounce", drill: "nod", phonk: "pump", rnb: "sway", soul: "clap", indie: "bounce",
    alternative: "bang", blues: "sway", schlager: "clap", ballad: "sway", gospel: "clap", reggaeton: "bounce", salsa: "bounce", brazil: "bounce", flamenco: "clap", bollywood: "bounce", arabic: "clap", ambient: "sway", cinematic: "sway" };
  m.kin(MOVES, 2);
  let x = 0;
  return {
    step(px, dt) {
      const target = Math.max(0, Math.min(1, (Math.pow(px.energy, 1.3) * 0.85 + px.drop * 0.5 + px.build * 0.2 - px.low * 0.7) * (px.crowd ?? 1)));
      x += (target - x) * (1 - Math.exp(-dt * (target > x ? 3 : 0.8)));
      if (px.dropHit) x = Math.max(x, 0.9);
      const style = MOVES[px.key] || "clap";
      // Anteil Springender (je Person p.up gleichverteilt) und erhobener Hände
      let jump = 0, up = 0;
      for (let i = 0; i < 40; i++) {
        const me = Math.max(0, Math.min(1, x + (i / 39 - 0.5) * 0.3)), pu = (i * 0.618) % 1;
        if (((style === "jump" || style === "bounce" || style === "pump") && me > 0.72 && 0.5 < 0.45 + (me - 0.72) * 2) || (px.drop > 0.6 && me > 0.6)) jump++;
        if (me > 0.55 && pu < me + 0.1 && style !== "sway" && style !== "nod") up++;
        else if (style === "clap" && me > 0.3) up += 0.75;
      }
      return { X: x, style, jump: jump / 40, up: up / 40 };
    },
  };
}

// dasselbe über src/crowd.js (wie venue.js es nutzt): 40 Leute mit fester Neigung je Person
function crowdV1(C) {
  const mind = C.createCrowdMind();
  let bar = 0;
  return {
    step(px, dt) {
      const X = mind.mood(px, dt, false), D = C.dance(px, X, false);
      if (px.beatIdx >= 0) bar = Math.floor(px.beatIdx / 4);
      let jump = 0, up = 0;
      for (let i = 0; i < 40; i++) {
        const me = Math.max(0, Math.min(1, X + (i / 39 - 0.5) * 0.3)), pu = (i * 0.618) % 1, h = (Math.sin(i * 127.1 + bar * 311.7) * 43758.5453) % 1;
        if (C.jumps(D, me, Math.abs(h), px)) jump++;
        up += C.armsUp(D, me, pu);
      }
      return { X, style: D.style, jump: jump / 40, up: up / 40 };
    },
  };
}

const KIND_N = ["intro", "verse", "pre", "chorus", "drop", "break", "bridge", "outro"];
async function simulate(raw, meta, opt = {}) {
  const m = await modules();
  const t0 = performance.now();
  const d = m.shape(raw);
  if (!d) return null;
  const tShape = performance.now() - t0;
  const dur = raw.track?.duration || d.beats[d.beats.length - 1].t + 1;
  // ---- Genre: Spotify-artige Strings / Apple-Genre (aus den Metadaten) und nur aus dem Klang
  const minor = (() => {
    const sx = d.sections || [];
    let mn = 0, all = 0;
    sx.forEach((x, i) => {
      const len = (sx[i + 1]?.t ?? dur) - x.t;
      all += len;
      if (x.mode === 0) mn += len;
    });
    return all ? mn / all : 0;
  })();
  const genres = spotifyStrings(meta);
  // Deezer- und Harmonix-Genres stehen für Apples Genre-Namen (Mirage fragt dafür iTunes)
  const apple = meta.apple || meta.dzGenre || meta.hxGenre || "";
  const withG = m.pickProfile(genres, d.bpm, d.loud, apple, minor, opt.soundOnly ? null : undefined);
  const sound = m.pickProfile([], d.bpm, d.loud, "", minor, d);
  const key = opt.key || withG.key;
  // ---- Planung (Kosten je Song: Song-Karte + Regie, frisches Objekt)
  const t1 = performance.now();
  const plan = m.planSong(d, key);
  const tPlan = performance.now() - t1 + tShape;
  // ---- Party pro Bild
  const cfg = globalThis.__labCfg, audio = globalThis.__labAudio;
  Object.assign(cfg, { partyStyle: key, partyLevel: opt.level || 2, noFlash: !!opt.noFlash });
  audio.uri = "lab:" + (meta.id || Math.random());
  audio.data = d;
  await m.party.prepare({ uri: audio.uri });
  const crowd = m.crowd?.dance ? crowdV1(m.crowd) : crowdV0(m);
  const dt = 1 / 60;
  const hits = [], downs = [], flashes = [], drops = [], vizPeaks = [], frames = [];
  let vPrev = 0, vPrev2 = 0, stepMs = 0;
  for (let t = 0, f = 0; t < dur; t += dt, f++) {
    const s0 = performance.now();
    const px = m.party.step(t, dt, true);
    stepMs += performance.now() - s0;
    if (px.hit) hits.push(t);
    if (px.hit && px.inBar === 0) downs.push(t);
    if (px.flashGo) flashes.push(t);
    if (px.dropHit) drops.push(t);
    // Visualizer-Puls wie in immersive.js (drawViz): Akzent oder echte Kick
    const v = Math.max(px.accent * 0.75, px.kickEnv * (0.6 + 0.4 * px.I));
    if (vPrev > vPrev2 && vPrev >= v && vPrev > 0.35) vizPeaks.push(t - dt);
    [vPrev2, vPrev] = [vPrev, v];
    const c = crowd.step(px, dt, { bpm: d.bpm, t });
    if (f % 6 === 0) frames.push({ t, e: px.energy, I: px.I, kind: px.kind, X: c.X, jump: c.jump, up: c.up, style: c.style, mood: px.mood });
  }
  const out = { id: meta.id, src: meta.src || (meta.fma ? "fma" : ""), genre: meta.genreTop || meta.apple || meta.dzGenre || meta.hxGenre || "", key, keySound: sound.key, fam: m.famOf[key] || "pop", famSound: m.famOf[sound.key] || "pop",
    expect: expectFamily(meta), bpm: d.bpm, dur: +dur.toFixed(1), planMs: +tPlan.toFixed(2), stepUs: +((stepMs / frames.length / 6) * 1000).toFixed(1) };
  // ---- Blitze: höchstens 3 in jedem Fenster von 1 s, Rate je Minute
  let maxWin = 0;
  for (let i = 0; i < flashes.length; i++) {
    let j = i;
    while (j < flashes.length && flashes[j] < flashes[i] + 1) j++;
    maxWin = Math.max(maxWin, j - i);
  }
  out.flashMax1s = maxWin;
  out.flashPerMin = +((flashes.length / dur) * 60).toFixed(1);
  out.drops = drops.length;
  // ---- Schläge gegen die Analyse (Party liest das Raster richtig?) und gegen die Grundwahrheit
  const aBeats = d.beats.map((b) => b.t);
  out.hitVsAnalysis = tolerantF(hits, aBeats, 0.07).f;
  const tr = meta.truth;
  if (tr?.beats?.length > 8) {
    const lo = tr.beats[0] - 0.1, hi = tr.beats[tr.beats.length - 1] + 0.1, win = (a) => a.filter((t) => t >= lo && t <= hi);
    // halbes Zählen (>150 BPM) zählt nur jeden zweiten Schlag: dann gegen die halbe Wahrheit
    const half = d.bpm > 150;
    const tb = half ? tr.beats.filter((_, i) => i % 2 === 0) : tr.beats;
    const bf = tolerantF(win(hits), tb, 0.07), bfFull = tolerantF(win(hits), tr.beats, 0.07);
    out.beatF = +Math.max(bf.f, bfFull.f).toFixed(3);
    out.beatOff = +(bf.f >= bfFull.f ? bf.off : bfFull.off).toFixed(3);
    out.downF = +tolerantF(win(downs), tr.downbeats, 0.07).f.toFixed(3);
    out.vizF = +tolerantF(win(vizPeaks), tr.beats, 0.07).f.toFixed(3);
    out.analysisBeatF = +tolerantF(win(aBeats), tr.beats, 0.07).f.toFixed(3);
    const aBars = d.bars.map((b) => b.t);
    out.analysisDownF = +tolerantF(win(aBars), tr.downbeats, 0.07).f.toFixed(3);
  }
  // ---- Aufbau gegen die Teile der Grundwahrheit
  if (plan && tr?.segments?.length > 2) {
    const segs = tr.segments.filter(([, l]) => l !== "end");
    const bTrue = segs.map(([t]) => t).filter((t) => t > 1 && t < dur - 1);
    const bPlan = plan.parts.slice(1).map((p) => p.t0);
    out.boundF3 = +boundaryF(bPlan, bTrue, 3).f.toFixed(3);
    // Zeitanteile je Klasse der Wahrheit → was die Regie daraus macht
    const acc = {};
    for (let t = 0.5; t < dur; t += 0.5) {
      const L = LABEL(labelAt(segs, t));
      if (!L) continue;
      const pi = plan.parts.findIndex((p) => t >= p.t0 && t < p.t1);
      const k = plan.parts[pi]?.kind || "verse";
      const a = (acc[L] ||= { n: 0, peak: 0, calm: 0 });
      a.n++;
      if (k === "chorus" || k === "drop") a.peak++;
      if (k === "intro" || k === "break" || k === "outro") a.calm++;
    }
    out.peakIn = Object.fromEntries(Object.entries(acc).map(([L, a]) => [L, +(a.peak / a.n).toFixed(3)]));
    out.calmIn = Object.fromEntries(Object.entries(acc).map(([L, a]) => [L, +(a.calm / a.n).toFixed(3)]));
    // Einsatz des Grooves: Ende des Intros (Wahrheit) gegen das Ende des geplanten Intros
    const tFlow = segs[0] && LABEL(segs[0][1]) === "intro" ? segs.find(([, l]) => LABEL(l) !== "intro" && LABEL(l) !== "silence")?.[0] ?? 0 : 0;
    const pFlow = plan.parts[0].kind === "intro" ? plan.parts[1]?.t0 ?? dur : 0;
    out.flowTrue = +tFlow.toFixed(2);
    out.flowErr = +Math.abs(pFlow - tFlow).toFixed(2);
    // Drops: auf einer Teilgrenze, hinter der ein Höhepunkt (Refrain …) beginnt?
    // gut = auf einer Grenze, hinter der ein Refrain beginnt oder die aus einem ruhigen Teil herausführt
    // (Intro, Break, Bridge, Aufbau, Stille: dort setzt der Groove ein – ein Mensch spürt den Einsatz genauso)
    const goodDrop = (t) => segs.some(([s, l], i) => Math.abs(s - t) < 1.5 && (LABEL(l) === "chorus" || ["intro", "break", "bridge", "pre", "silence"].includes(LABEL(segs[i - 1]?.[1]))));
    out.dropGood = plan.drops.filter(goodDrop).length;
    out.dropBad = plan.drops.length - out.dropGood;
    // Einsätze eines Refrains nach etwas anderem: wie viele davon bekommen einen Drop?
    const starts = segs.filter(([s, l], i) => i > 0 && LABEL(l) === "chorus" && LABEL(segs[i - 1][1]) !== "chorus" && s > 4 && s < dur - 8).map(([s]) => s);
    out.chorusStarts = starts.length;
    out.dropRecall = starts.length ? +(starts.filter((s) => plan.drops.some((t) => Math.abs(t - s) < 1.5)).length / starts.length).toFixed(3) : null;
    // Publikum je Klasse der Wahrheit
    const cr = {};
    for (const fr of frames) {
      const L = LABEL(labelAt(segs, fr.t));
      if (!L) continue;
      const a = (cr[L] ||= { n: 0, X: 0, jump: 0, up: 0 });
      a.n++;
      a.X += fr.X;
      a.jump += fr.jump;
      a.up += fr.up;
    }
    // Blitze je Klasse der Wahrheit (je Minute): ruhige Teile ruhig?
    const fl = {};
    for (const t of flashes) {
      const L = LABEL(labelAt(segs, t));
      if (L) fl[L] = (fl[L] || 0) + 1;
    }
    const secs = {};
    for (const fr of frames) {
      const L = LABEL(labelAt(segs, fr.t));
      if (L) secs[L] = (secs[L] || 0) + 0.1;
    }
    out.flashIn = Object.fromEntries(Object.entries(secs).filter(([, v]) => v > 4).map(([L, v]) => [L, +((((fl[L] || 0) / v) * 60).toFixed(1))]));
    out.crowd = Object.fromEntries(Object.entries(cr).map(([L, a]) => [L, { X: +(a.X / a.n).toFixed(3), jump: +(a.jump / a.n).toFixed(3), up: +(a.up / a.n).toFixed(3) }]));
  }
  // Publikum ohne Wahrheit: folgt es der Energie? (Korrelation über die Bilder) Ruhig, wenn es ruhig ist?
  {
    const n = frames.length, mx = (k) => frames.reduce((s, f) => s + f[k], 0) / n;
    const me = mx("e"), mX = mx("X");
    let sxy = 0, sxx = 0, syy = 0;
    for (const f of frames) [sxy, sxx, syy] = [sxy + (f.e - me) * (f.X - mX), sxx + (f.e - me) ** 2, syy + (f.X - mX) ** 2];
    out.crowdCorr = sxx && syy ? +(sxy / Math.sqrt(sxx * syy)).toFixed(3) : 0;
    const calm = frames.filter((f) => f.e < 0.3);
    out.jumpWhenCalm = calm.length ? +(calm.reduce((s, f) => s + f.jump, 0) / calm.length).toFixed(3) : 0;
    const loud = frames.filter((f) => f.e > 0.75);
    out.jumpWhenLoud = loud.length ? +(loud.reduce((s, f) => s + f.jump, 0) / loud.length).toFixed(3) : 0;
    out.style = frames[frames.length >> 1]?.style || "";
  }
  // Stimmung und Teile
  if (plan) {
    const tally = {};
    for (const p of plan.parts) tally[p.emo.name] = (tally[p.emo.name] || 0) + (p.t1 - p.t0);
    out.mood = Object.entries(tally).sort((a, b) => b[1] - a[1])[0][0];
    out.kinds = plan.parts.map((p) => p.kind[0]).join("");
    out.minor = +minor.toFixed(2);
  }
  // Instrumente am Klang (Wahlfunktion): Anteil der Zeit je Instrument
  {
    const h = m.heard(d.segs);
    out.inst = {};
    for (const k of ["piano", "guitar"]) if (h?.[k]) out.inst[k] = +(h[k].reduce((s, v) => s + (v > 0 ? 1 : 0), 0) / h[k].length).toFixed(3);
  }
  return out;
}

module.exports = { simulate, modules, KIND_N };
