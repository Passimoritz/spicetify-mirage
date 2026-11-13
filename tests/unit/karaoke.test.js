// node tests/unit/karaoke.test.js
// Karaoke-Wertung mit künstlichen Signalen: eine Stimme aus Grundton und Obertönen, die die Einsätze und Töne
// trifft (oder eben nicht), Stille und ein lauter Raum ohne Stimme. Echte Mikrofone und echte Räume prüft das nicht.
const assert = require("assert");
const { load } = require("./load.js");
const K = load("karaoke.js");

const SR = 48000;
// Songstelle: 6 Zeilen à 3 s ab 20 s, je 4 Silben (0 / 0,5 / 1 / 1,5 s nach Zeilenanfang)
const START = 20000;
const lines = [];
for (let k = 0; k < 12; k++) {
  const t = 8000 + k * 3000;
  lines.push({ t, text: k % 4 === 2 ? "Forever singing in the light" : `Line number ${k} goes here`, syl: [0, 500, 1000, 1500].map((d) => ({ t: t + d, n: 3 })) });
}
// Analyse: alle 0,5 s ein Abschnitt, Akkord wechselt alle 3 s (Grundton, große Terz, Quinte)
const ROOTS = [0, 5, 7, 9];
const rootAt = (ms) => ROOTS[Math.floor(ms / 3000) % 4];
const segs = [];
for (let t = 0; t < 80; t += 0.5) {
  const r = rootAt(t * 1000), p = Array.from({ length: 12 }, (_, i) => 0.05 + ((i * 7) % 5) * 0.01);
  p[r] = 1;
  p[(r + 4) % 12] = 0.7;
  p[(r + 7) % 12] = 0.6;
  segs.push({ t, p, l: -12 });
}

/* ---- Theme: Stelle wählen und verpacken */
const part = K.pickPart(lines, { pos: 0, min: 12000, max: 20000 });
assert.ok(part, "eine Stelle wird gefunden");
assert.ok(part.end - part.start >= 12000 && part.end - part.start <= 20000, "Länge passt: " + (part.end - part.start));
assert.ok(lines[part.i0].t >= 8000, "nicht ganz am Anfang");
assert.equal(lines[part.i0].text, "Forever singing in the light", "der Refrain (wiederholte Zeile) hat Vorrang");
assert.equal(K.pickPart([{ t: 9000, text: "only" }, { t: 12000, text: "two" }], { min: 12000, max: 20000 }), null, "zu wenig Text: keine Stelle");
assert.equal(K.pickPart(lines, { min: 12000, max: 20000, used: new Set(lines.map((_, i) => i)) }), null, "alles verbraucht: keine Stelle");
// lange Pause in der Stelle: nicht nehmen
const holey = [{ t: 9000, text: "a line here" }, { t: 10000, text: "b line here" }, { t: 21000, text: "c line here" }, { t: 22000, text: "d line here" }, { t: 24000, text: "e line here" }];
assert.equal(K.pickPart(holey, { min: 12000, max: 20000 }), null, "Zwischenspiel mitten in der Stelle");

const P = K.partData(lines, { i0: 4, i1: 9, start: START, end: START + 18000 }, segs);
assert.equal(P.len, 18000);
assert.equal(P.ln.length, 6);
assert.equal(P.on.length, 24, "Silbenzeiten werden zu Einsätzen");
assert.deepEqual(P.on.slice(0, 4), [0, 500, 1000, 1500]);
assert.equal(P.ch.length, ((18000 - K.CH_FROM) / K.CH_STEP) * 3, "drei Zeichen je 250 ms");
assert.deepEqual(K.chromaAt(P, 100), [rootAt(START + 100), (rootAt(START + 100) + 4) % 12, (rootAt(START + 100) + 7) % 12], "stärkste Klasse zuerst");
assert.deepEqual(K.chromaAt(P, -3000).length, 3, "auch vor der Stelle (Grundpegel)");
// nur Zeilenzeiten: ein Einsatz je Zeile
const plain = K.partData(lines.map(({ t, text }) => ({ t, text })), { i0: 4, i1: 9, start: START, end: START + 18000 }, []);
assert.deepEqual(plain.on, [0, 3000, 6000, 9000, 12000, 15000]);
assert.equal(plain.ch, "", "ohne Analyse keine Tonhöhen");
// Silbenzeiten relativ zum Zeilenanfang werden erkannt
const rel = K.partData([{ t: 30000, text: "rel one", syl: [{ t: 0, n: 2 }, { t: 400, n: 2 }] }, { t: 33000, text: "rel two" }], { i0: 0, i1: 1, start: 30000, end: 36000 }, []);
assert.deepEqual(rel.on, [0, 400, 3000]);

/* ---- Grundton */
const sine = (f, n, a = 0.3) => Float32Array.from({ length: n }, (_, i) => a * Math.sin((2 * Math.PI * f * i) / SR));
for (const f of [110, 196, 261.63, 440, 659.25, 880]) {
  const got = K.yin(sine(f, K.WIN), SR).f;
  assert.ok(Math.abs(got / f - 1) < 0.01, `YIN findet ${f} Hz (${got.toFixed(1)})`);
}
const pcDist = (a, b) => Math.min(Math.abs(a - b), 12 - Math.abs(a - b));
assert.ok(pcDist(K.pitchClass(440), 9) < 1e-9 && pcDist(K.pitchClass(261.63), 0) < 0.01 && pcDist(K.pitchClass(130.81), 0) < 0.01, "Tonklasse oktavunabhängig");
let seed = 7;
const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296) * 2 - 1;
assert.equal(K.yin(Float32Array.from({ length: K.WIN }, () => 0.3 * rnd()), SR).f, 0, "Rauschen hat keinen Grundton");
assert.equal(K.toneMatch(0, [0, 4, 7]), 1, "Hauptton trifft voll");
assert.equal(K.toneMatch(6, [0, 4, 7]), 0, "Tritonus trifft nicht");
assert.ok(K.toneMatch(0.5, [0, 4, 7]) > 0.6 && K.toneMatch(0.5, [0, 4, 7]) < 0.8, "ein Viertelton daneben zählt halb");

/* ---- künstliche Aufnahmen */
// Signal ab 4 s vor der Stelle bis kurz danach
const T0 = -4000, N = Math.round(((P.len + 600 - T0) / 1000) * SR);
const at = (ms) => Math.round(((ms - T0) / 1000) * SR);
// Stimme: Grundton mit drei Obertönen, weicher Einsatz, je Silbe ein Ton aus dem Akkord (Grundton, Terz, Quinte, Grundton)
function voice(buf, { late = 0, wrong = false, amp = 0.25, octave = 0 } = {}) {
  P.on.forEach((on, i) => {
    const song = START + on, r = rootAt(song), step = [0, 4, 7, 0][i % 4] + (wrong ? 6 : 0);
    const f = 261.63 * Math.pow(2, (r + step) / 12 + octave);
    const a0 = at(on + late), n = Math.round(0.42 * SR);
    for (let k = 0; k < n && a0 + k < buf.length; k++) {
      const t = k / SR, env = Math.min(1, t / 0.025) * Math.min(1, (0.42 - t) / 0.04);
      const ph = 2 * Math.PI * f * t + 0.3 * Math.sin(2 * Math.PI * 5.5 * t);
      buf[a0 + k] += amp * env * (Math.sin(ph) + 0.5 * Math.sin(2 * ph) + 0.3 * Math.sin(3 * ph) + 0.15 * Math.sin(4 * ph)) / 1.95;
    }
  });
  return buf;
}
// leiser Raum: etwas Rauschen
const quiet = () => Float32Array.from({ length: N }, () => 0.002 * rnd());
// lauter Raum: der Song selbst aus den Lautsprechern (Akkordtöne, Bass, Schlagzeug, Rauschen), auch vor der Stelle
function loudRoom(gain = () => 1) {
  const b = Float32Array.from({ length: N }, () => 0.02 * rnd());
  for (let i = 0; i < N; i++) {
    const ms = T0 + (i / SR) * 1000, r = rootAt(START + ms), t = i / SR, g = gain(ms);
    b[i] *= g;
    for (const [st, a] of [[0, 0.06], [4, 0.045], [7, 0.045], [-12, 0.08]]) b[i] += g * a * Math.sin(2 * Math.PI * 261.63 * Math.pow(2, (r + st) / 12) * t);
    const beat = ((ms % 500) + 500) % 500;
    if (beat < 120) b[i] += g * 0.25 * Math.exp(-beat / 30) * Math.sin(2 * Math.PI * 55 * (beat / 1000));
  }
  return b;
}
const take = (sig) => K.scoreTake(K.featsOf(sig, SR, T0), P);

const good = take(voice(quiet()));
console.log("gut:", JSON.stringify(good));
assert.ok(good.s >= 75, "trifft Einsätze und Töne: hohe Wertung " + good.s);
assert.ok(good.t >= 70 && good.p >= 70 && good.d >= 90, "alle drei Teile hoch: " + JSON.stringify(good));
assert.equal(good.loud, false, "leiser Raum");

const low = take(voice(quiet(), { octave: -1 }));
assert.ok(Math.abs(low.p - good.p) <= 15, `eine Oktave tiefer zählt genauso: ${low.p} / ${good.p}`);

const late = take(voice(quiet(), { late: 300 }));
console.log("300 ms zu spät:", JSON.stringify(late));
assert.ok(late.t <= good.t - 15, `300 ms zu spät: schlechteres Timing (${late.t} gegen ${good.t})`);
assert.ok(late.d >= 80, "zu spät gesungen ist trotzdem dabei");

const off = take(voice(quiet(), { late: 80 }));
assert.ok(off.t >= good.t - 10, `80 ms Verzögerung (Lautsprecher) wird verziehen: ${off.t} / ${good.t}`);

const wrong = take(voice(quiet(), { wrong: true }));
console.log("falsche Töne:", JSON.stringify(wrong));
assert.ok(wrong.p <= 30 && wrong.p <= good.p - 40, `falsche Töne: schlechtere Töne (${wrong.p} gegen ${good.p})`);
assert.ok(wrong.t >= good.t - 15, "Timing bleibt bei falschen Tönen gut");

const silent = take(new Float32Array(N));
console.log("Stille:", JSON.stringify(silent));
assert.ok(silent.s <= 5 && silent.d === 0, "Stille: keine Wertung " + JSON.stringify(silent));
const hiss = take(quiet());
assert.ok(hiss.s <= 5, "nur Rauschen: keine Wertung " + JSON.stringify(hiss));

const room = take(loudRoom());
console.log("lauter Raum, keine Stimme:", JSON.stringify(room));
assert.ok(room.s <= 20, "lauter Raum ohne Stimme bekommt keine hohe Wertung: " + JSON.stringify(room));

const both = take(voice(loudRoom(), { amp: 0.5 }));
console.log("lauter Raum mit Stimme:", JSON.stringify(both));
assert.ok(both.s >= room.s + 30, `mit Stimme deutlich mehr als ohne (${both.s} gegen ${room.s})`);
assert.ok(both.t >= 50, "im lauten Raum trägt das Timing: " + both.t);
// der Refrain ist 5 dB lauter als die Strophe davor (dort wurde der Raum gemessen): die Lautheit der Analyse
// hebt den Raumpegel mit, sonst hielte das Handy die lauteren Lautsprecher für Gesang
const segsUp = segs.map((x) => ({ ...x, l: x.t * 1000 < START ? -14 : -9 }));
const PUp = K.partData(lines, { i0: 4, i1: 9, start: START, end: START + 18000 }, segsUp);
assert.equal(PUp.lo.length, (18000 - K.CH_FROM) / K.CH_STEP, "eine Ziffer je 250 ms");
assert.equal(K.loudAt(PUp, -2000), -13.5, "Lautheit vor der Stelle (1,5-dB-Schritte)");
assert.equal(K.loudAt(PUp, 2000), -9, "Lautheit in der Stelle");
const louder = (ms) => (ms < 0 ? 1 : Math.pow(10, 5 / 20));
const chorus = K.scoreTake(K.featsOf(loudRoom(louder), SR, T0), PUp);
console.log("lauter werdender Raum, keine Stimme:", JSON.stringify(chorus));
assert.ok(chorus.s <= 20, "lauterer Refrain ohne Stimme bekommt keine hohe Wertung: " + JSON.stringify(chorus));
// Gegenprobe: ohne die Lautheit der Analyse hielte das Handy den lauteren Refrain für Gesang
const blind = K.scoreTake(K.featsOf(loudRoom(louder), SR, T0), { ...PUp, lo: "" });
assert.ok(blind.s > chorus.s + 15, "die Lautheit macht den Unterschied: " + JSON.stringify(blind));
const chorusSung = K.scoreTake(K.featsOf(voice(loudRoom(louder), { amp: 0.8 }), SR, T0), PUp);
console.log("lauter werdender Raum mit Stimme:", JSON.stringify(chorusSung));
assert.ok(chorusSung.s >= chorus.s + 30, "mit Stimme deutlich mehr: " + JSON.stringify(chorusSung));
// die Stimme nur gut 5 dB über dem Raum: weniger sicher, aber nicht besser als klar gesungen
const faint = take(voice(loudRoom(), { amp: 0.3 }));
console.log("lauter Raum, leise Stimme:", JSON.stringify(faint));
assert.ok(faint.s <= both.s && faint.s >= room.s + 30, "leise im lauten Raum liegt dazwischen: " + JSON.stringify(faint));
// kaum lauter als der Raum (gut 2 dB): nicht vom Raum zu trennen, dann lieber keine Wertung als eine geratene
assert.ok(take(voice(loudRoom(), { amp: 0.2 })).s <= faint.s, "untergegangene Stimme zählt nicht mehr als eine hörbare");

// Klatschen und Reden ohne Ton im leisen Raum: Geräusche, aber kein Gesang
const claps = quiet();
for (let ms = 0; ms < P.len; ms += 350) {
  const a0 = at(ms + 37 * (Math.floor(ms / 350) % 5));
  for (let k = 0; k < 1800 && a0 + k < claps.length; k++) claps[a0 + k] += 0.4 * Math.exp(-k / 300) * rnd();
}
const clap = take(claps);
console.log("Klatschen:", JSON.stringify(clap));
assert.ok(clap.s <= 25, "Klatschen ist kein Singen: " + JSON.stringify(clap));
// ein einziger langer Summton über die ganze Stelle: dabei, aber ohne Einsätze und meist neben den Tönen
const hum = quiet();
for (let i = at(0); i < at(P.len); i++) hum[i] += 0.2 * Math.sin((2 * Math.PI * 233.08 * (i - at(0))) / SR);
const humm = take(hum);
console.log("Summen:", JSON.stringify(humm));
assert.ok(humm.s <= good.s - 30 && humm.t <= 30, "Dauerton: schwaches Timing " + JSON.stringify(humm));

// Mikro erst nach dem Grundpegel an: trotzdem eine Wertung
const lateMic = K.scoreTake(K.featsOf(voice(quiet()), SR, T0).filter((x) => x.t > -200), P);
assert.ok(lateMic.s >= 60, "ohne Grundpegel geht es mit einem festen Wert: " + JSON.stringify(lateMic));
// ohne Tonhöhen der Analyse: Töne nicht messbar, Wertung aus Timing und Dabei
const noCh = K.scoreTake(K.featsOf(voice(quiet()), SR, T0), { ...P, ch: "" });
assert.equal(noCh.p, -1, "Töne nicht messbar");
assert.ok(noCh.s >= 70, "ohne Analyse zählen Timing und Dabei: " + JSON.stringify(noCh));
// nur Zeilenzeiten: gröber, aber auch da trifft die Stimme
const coarse = K.scoreTake(K.featsOf(voice(quiet()), SR, T0), { ...P, on: P.ln.map((l) => l[0]) });
assert.ok(coarse.t >= 70, "Zeilenanfänge werden getroffen: " + JSON.stringify(coarse));
// halb gesungen: Dabei etwa die Hälfte
const halfSig = voice(quiet());
halfSig.fill(0, at(9000 - 100));
const half = take(halfSig);
assert.ok(half.d >= 35 && half.d <= 65, "halb gesungen: Dabei etwa die Hälfte " + JSON.stringify(half));
assert.ok(half.s < good.s - 20, "halb gesungen: weniger als ganz");
// Rechenzeit: ein Fenster muss am Handy weit unter seinen 21 ms bleiben
const sig = voice(quiet()), t1 = process.hrtime.bigint();
const fs = K.featsOf(sig, SR, T0);
const perFrame = Number(process.hrtime.bigint() - t1) / 1e6 / fs.length;
console.log(`Rechenzeit: ${perFrame.toFixed(3)} ms je Fenster`);
assert.ok(perFrame < 3, "billig genug: " + perFrame);
console.log("karaoke: ok");
