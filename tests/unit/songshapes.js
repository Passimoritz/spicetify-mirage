// Künstliche Songs mit bekanntem Aufbau für die Tests der Lichtregie (director.test.js) und für Messungen.
// raw(): im Format von Spotifys Taktanalyse (beats, bars, sections, segments) · shaped(): so, wie audio.js sie ablegt.
// Teile: [Art, Takte, Lautheit in dB, Optionen] – rise = Lautheit steigt bis zu diesem Wert, dip = letzter Takt
// leise (die Pause vor dem Drop), hold = gehaltene Töne, key = andere Tonart (Bridge). Die Abschnittsgrenzen
// liegen absichtlich ein Stück neben der Eins – so wie bei Spotify oft auch.
const SHAPES = {
  edm: { bpm: 128, kick: "four", parts: [["intro", 8, -15], ["break", 16, -14], ["pre", 8, -13, { rise: -9, dip: true }], ["drop", 16, -5], ["break", 8, -15], ["pre", 8, -13, { rise: -9, dip: true }], ["drop", 16, -5], ["outro", 8, -13]] },
  rock: { bpm: 120, kick: "rock", parts: [["intro", 4, -12], ["verse", 8, -10], ["pre", 4, -8.5], ["chorus", 8, -5], ["verse", 8, -10], ["pre", 4, -8.5], ["chorus", 8, -5], ["bridge", 8, -9.5, { key: 4 }], ["chorus", 8, -5], ["chorus", 8, -5], ["outro", 4, -11]] },
  ballad: { bpm: 72, kick: "rock", parts: [["intro", 4, -18], ["verse", 8, -15], ["chorus", 8, -10, { hold: true }], ["verse", 8, -15], ["chorus", 8, -10, { hold: true }], ["bridge", 4, -14, { key: 2 }], ["chorus", 8, -9.5, { hold: true }], ["outro", 4, -17]] },
  trap: { bpm: 140, kick: "trap", parts: [["intro", 4, -12], ["chorus", 8, -6], ["verse", 16, -9], ["chorus", 8, -6], ["break", 4, -17], ["chorus", 8, -5], ["outro", 4, -12]] },
  dnb: { bpm: 174, kick: "dnb", parts: [["intro", 16, -14], ["pre", 8, -13, { rise: -9, dip: true }], ["drop", 16, -5], ["break", 16, -15], ["pre", 8, -13, { rise: -9, dip: true }], ["drop", 16, -5], ["outro", 8, -13]] },
};
// fester Zufall: jeder Lauf erzeugt denselben Song
function rng(seed) {
  let x = seed >>> 0 || 1;
  return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function raw(name) {
  const S = SHAPES[name], beat = 60 / S.bpm, rnd = rng(name.length * 7919);
  const beats = [], bars = [], sections = [], segments = [], truth = [];
  let t = 0.12, b = 0;
  for (const [kind, nBars, db, o = {}] of S.parts) {
    const t0 = t;
    // Spotify legt Abschnitte selten genau auf die Eins: bis zu ±0,4 s daneben
    sections.push({ start: Math.max(0, t0 + (sections.length ? (rnd() - 0.5) * 0.8 : -t0)), duration: nBars * 4 * beat, loudness: db, tempo: S.bpm, tempo_confidence: 0.8, key: o.key ?? 9, mode: 1 });
    truth.push({ kind, t0, t1: t0 + nBars * 4 * beat });
    for (let k = 0; k < nBars * 4; k++, b++) {
      const tb = t + k * beat, inBar = k % 4, f = k / (nBars * 4);
      beats.push({ start: tb, duration: beat, confidence: 0.9 });
      if (!inBar) bars.push({ start: tb, duration: beat * 4, confidence: 0.9 });
      const lastBar = k >= nBars * 4 - 4;
      const lvl = o.dip && lastBar ? -19 : o.rise != null ? db + (o.rise - db) * f : db;
      // Schlagzeug je Stil: vier auf den Boden, Rock (1 und 3 / 2 und 4), Trap (808 versetzt), DnB (1 und 2+)
      const kick = S.kick === "four" ? true : S.kick === "trap" ? inBar === 0 || (inBar === 2 && k % 8 >= 4) : S.kick === "dnb" ? inBar === 0 : inBar === 0 || inBar === 2;
      const snare = S.kick === "dnb" ? inBar === 1 || inBar === 3 : S.kick === "four" ? false : inBar === 1 || inBar === 3;
      const hold = o.hold && k % 8 < 4;
      for (const half of [0, 1]) {
        const ts = tb + half * beat * 0.5, hit = !half && (kick || snare);
        const pitches = hold ? Array.from({ length: 12 }, (_, i) => (i === 4 ? 1 : 0.2)) : Array.from({ length: 12 }, () => 0.3 + rnd() * 0.7);
        segments.push({
          start: ts, duration: beat / 2, loudness_max: lvl + (hit ? 1.5 : -2.5) + rnd() * 0.5, pitches,
          // timbre[1] Helligkeit, [2] Rauschen, [3] Anschlag
          timbre: [0, half ? 120 : kick ? 20 : snare ? 60 : 45, snare ? 70 : half ? 40 : 15, kick ? 95 : snare ? 85 : 15],
        });
      }
    }
    t += nBars * 4 * beat;
  }
  return { track: { tempo: S.bpm, loudness: -8, key: 9, mode: 1 }, beats, bars, sections, segments, tatums: [], truth };
}
// wie audio.js shape(): kurze Feldnamen
function shaped(name) {
  const d = raw(name);
  return {
    beats: d.beats.map((x) => ({ t: x.start, c: x.confidence })),
    bars: d.bars.map((x) => ({ t: x.start })),
    sections: d.sections.map((s) => ({ t: s.start, mode: s.mode, l: s.loudness, key: s.key, tempo: s.tempo, tc: s.tempo_confidence })),
    segs: d.segments.map((s) => ({ t: s.start, l: s.loudness_max, p: s.pitches, b: s.timbre[1], f: s.timbre[2], k: s.timbre[3] })),
    bpm: SHAPES[name].bpm, loud: -8, avg: -10, truth: d.truth,
  };
}

module.exports = { SHAPES, raw, shaped };
