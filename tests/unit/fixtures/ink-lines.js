// Erfundene Zeilen (keine echten Songtexte) für die Prüfung „Zeilen überdecken sich nie“ (e2e „playful-ink“,
// lyricstyle.test.js): alles, was im verspielten Stil eng werden kann – Hintergrundgesang in Klammern als eigene,
// gekippte Zeile direkt vor einer Zeile in engen Großbuchstaben, Klammern am Zeilenende (kleine Zeile darunter),
// sehr lange Zeilen (brechen in mehrere Reihen um), ein Schlüsselwort am Zeilenende, direkt wiederholte Zeilen,
// Zählen, Frage, Umlaute und Unterlängen.
const PARTS = [
  ["verse", [
    "Wir sind rund um die Uhr besetzt",
    "(rund um die Uhr besetzt)",
    "Kommen Sie herein, der Schlüssel liegt schon lange für Sie an der Rezeption bereit",
    "(der Wellnessbereich ist selbstverständlich mit inbegriffen)",
    "IHRE MINIBAR GEHT HEUTE AUFS HAUS",
    "Gypsy jiggly quay, Äpfel und Übermut",
  ]],
  ["pre", [
    "Und du tanzt mit jedem, den du gerade willst",
    "One, two, three, four",
    "Is this the way it always ends? (always ends)",
  ]],
  ["chorus", [
    "Oh la la la, wir checken niemals aus",
    "(niemals aus, niemals aus)",
    "FEUER!",
    "Wir brennen heller als die ganze Stadt bei Nacht und keiner hält uns jemals wieder auf",
    "Boom boom boom, hier kommt der Zimmerservice",
  ]],
  ["bridge", [
    "Langsam fällt der Regen auf das leere Dach",
    "(ooh, ooh)",
    "Flüster mir noch einmal, was sonst keiner weiß und keiner jemals schreibt",
  ]],
  ["chorus", [
    "Oh la la la, wir checken niemals aus",
    "(niemals aus, niemals aus)",
    "FEUER!",
    "Wir brennen heller als die ganze Stadt bei Nacht und keiner hält uns jemals wieder auf",
    "Lass es brennen",
    "Lass es brennen",
    "LASS ES BRENNEN",
  ]],
  ["outro", ["Gute Nacht", "Gute Nacht", "(gute Nacht)"]],
];

// → { lines: [{ t, text }], words: [[{ text, a, b }]], kinds, parts: [{ t0, kind }] } – wie fixtures/playful-songs.js
function inkSong() {
  const lines = [], words = [], kinds = [], parts = [];
  let t = 4000;
  for (const [kind, ls] of PARTS) {
    parts.push({ t0: t / 1000 - 0.3, kind });
    for (const text of ls) {
      let a = t;
      const ws = text.split(/\s+/).map((tx) => {
        const d = 180 + 40 * Math.min(8, tx.length);
        const w = { text: tx, a, b: a + d };
        a += d + 60;
        return w;
      });
      lines.push({ t, text });
      words.push(ws);
      kinds.push(kind);
      t = a + 600;
    }
    t += 1800;
  }
  return { lines, words, kinds, parts };
}

module.exports = { PARTS, inkSong };
