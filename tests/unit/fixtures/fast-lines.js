// Schnelle Stellen für den verspielten Stil: Rap mit 8 Wörtern je Sekunde (Zeilen von 1 s) und kurze Zeilen von
// 0,4 s – dazu eine Spiel-Uhr, die aus dem Plan nachrechnet, wann jedes Wort lesbar ist und wann die Bewegungen einer
// Zeile enden (Auftritt, Akzent, gehaltener Ton, Abgang, Farbwechsel der Zeile). Genutzt von lyricstyle.test.js.
const RAP = [
  "fire in my heart and the bass go boom",
  "money on my mind and I never fall down",
  "hands up high when the drums go crazy",
  "set the night on fire with the lightning",
  "we gonna dance till the morning light",
  "boom boom boom let the bass explode",
];
const SHORT = ["burn it up", "fire fire", "heart beat now", "boom it goes", "jump up high", "rain on me", "go go go", "shine on"];

// Zeilen und Wörter: Rap ab 10 s (Wortabstand 125 ms), danach kurze Zeilen (je 0,4 s, Wörter alle 120 ms)
function fastSong() {
  const lines = [], words = [];
  let t = 10000;
  for (const text of RAP) {
    const ws = text.split(" ").map((x, k) => ({ text: x, a: t + k * 125, b: t + k * 125 + 110 }));
    lines.push({ t, text });
    words.push(ws);
    t += ws.length * 125;
  }
  for (const text of SHORT) {
    const ws = text.split(" ").map((x, k) => ({ text: x, a: t + k * 120, b: t + k * 120 + 100 }));
    lines.push({ t, text });
    words.push(ws);
    t += 400;
  }
  lines.push({ t: t + 3000, text: "the end of the song" });
  words.push("the end of the song".split(" ").map((x, k) => ({ text: x, a: t + 3000 + k * 300, b: t + 3000 + k * 300 + 250 })));
  // Takt mit 128 BPM (Schläge und Takte), damit auch die Schlag-Akzente vorkommen
  const beats = [], bars = [];
  for (let s = 0; s < t / 1000 + 10; s += 60 / 128) beats.push({ t: s });
  beats.forEach((b, k) => k % 4 === 0 && bars.push({ t: b.t }));
  const parts = [{ t0: 0, t1: 15, kind: "verse" }, { t0: 15, t1: 1000, kind: "chorus" }];
  return { lines, words, d: { beats, bars, segs: [], avg: -10 }, parts };
}

// Spiel-Uhr (Bildrate fr ms): Klassenwechsel im ersten Bild ab der Schwelle (sungAt), Überblendung ab dem nächsten
// Bild, Dauer --pl. → Liste der Funde (zu spät gelandet, Bewegung über den ersten Einsatz der nächsten Zeile hinaus …)
function lateReport(plan, s, sungAt, o = {}) {
  const fr = o.fr || 1000 / 60, pad = o.pad ?? fr;
  const late = [];
  const ms = (v, def = 0) => (v == null || v === "" ? def : parseFloat(v));
  const firstA = (j) => (s.words[j]?.length ? s.words[j][0].a : s.lines[j]?.t ?? Infinity);
  plan.forEach((p, i) => {
    const ws = s.words[i] || [];
    const nextA = firstA(i + 1), lineDur = (s.lines[i + 1]?.t ?? Infinity) - s.lines[i].t;
    p.words.forEach((pw, k) => {
      const w = ws[k], lead = pw.lead || 0;
      let f = Math.floor((w.a - lead - pad - 2 * fr) / fr);
      while (!sungAt({ a: w.a, lead }, f * fr, pad)) f++;
      const land = (f + 1) * fr + ms(pw.vars["--pl"]);
      if (land > w.a + fr + 0.5) late.push(`${p.t} „${w.text}“ gelandet ${Math.round(land - w.a)} ms nach dem Einsatz`);
      // Akzent (alle Durchgänge) und gehaltener Ton beginnen auf dem Einsatz
      if (pw.vars["--pac"] || pw.cls.includes("is-echo")) {
        const end = w.a + ms(pw.vars["--pad"]) * (Number(pw.vars["--pai"]) || 1);
        if (end > nextA) late.push(`${p.t} „${w.text}“ Akzent ${pw.vars["--pac"] || "echo"} läuft ${Math.round(end - nextA)} ms in die nächste Zeile`);
      }
      if (pw.cls.includes("is-p-held")) {
        const end = w.a + ms(pw.vars["--hd"]);
        if (end > nextA) late.push(`${p.t} „${w.text}“ gehaltener Ton läuft ${Math.round(end - nextA)} ms in die nächste Zeile`);
      }
      // Wortbild-Schleife (beginnt 60 ms nach dem Einsatz, endet mit der Zeile): ohne 450 ms Zeit nur ein Zucken
      if (pw.cls.includes("is-p-cue") && nextA - w.a < 450)
        late.push(`${p.t} „${w.text}“ Wortbild ohne Zeit (${Math.round(nextA - w.a)} ms bis zur nächsten Zeile)`);
    });
    // Farbe, Deckkraft und Größe der Zeile (sonst 0,5–0,7 s) und die Gleitfahrt: in der Dauer der Zeile
    const lt = p.cls.includes("is-p-fast") ? ms(p.vars["--plt"]) : 700;
    if (Number.isFinite(lineDur) && lt > lineDur) late.push(`Zeile ${i} „${s.lines[i].text}“ wechselt in ${lt} ms, ist aber nur ${lineDur} ms dran`);
    // Abgang: läuft, während die nächste Zeile dran ist – fertig, bevor die übernächste kommt
    if (p.vars["--pxo"]) {
      const nd = (s.lines[i + 2]?.t ?? Infinity) - (s.lines[i + 1]?.t ?? Infinity);
      const xt = ms(p.vars["--pxt"], 500);
      if (Number.isFinite(nd) && xt > nd) late.push(`Zeile ${i} Abgang ${Math.round(xt)} ms, nächste Zeile nur ${nd} ms`);
    }
    if (p.cls.includes("is-p-moment")) {
      const md = ms(p.vars["--pmd"], 850);
      if (md > lineDur) late.push(`Zeile ${i} großer Moment ${md} ms, Zeile nur ${lineDur} ms`);
    }
  });
  return late;
}

module.exports = { fastSong, lateReport };
