/* ---------------------------------------------------------------- Instrumente: Credit → Art */
// Ordnet den Namen aus den Credits („Electric Bass“, „Tenor Saxophone“, „Drum Programming“) einer der Arten zu,
// für die es einen Effekt gibt. Ohne Spotify und Fenster – darum einzeln testbar (tests/unit/instrkinds.test.js).
// Die Reihenfolge der Prüfungen zählt: „Bass Trombone“ ist ein Blechbläser, „Bass Drum“ ein Schlagzeug.
const KINDS = ["brass", "sax", "guitar", "piano", "strings", "choir", "drums", "bass", "synth", "accordion", "flute", "harp"];
function kindOf(name) {
  // Akzente weg: „Bandoneón“ steht so in den Credits
  const s = String(name || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (/sax/.test(s)) return "sax";
  if (/accordion|bandoneon|concertina|melodeon/.test(s)) return "accordion";
  // Mundharmonika heißt auf Englisch auch „harp“, das Cembalo „harpsichord“ – beides ist keine Harfe
  if (/\bharp\b/.test(s) && !/jaw|mouth|blues|jew/.test(s)) return "harp";
  if (/flute|piccolo|pan ?pipes?|tin whistle|penny whistle|shakuhachi|ocarina|\brecorder\b/.test(s) && !/tape/.test(s)) return "flute";
  if (/trumpet|trombone|flugelhorn|cornet|french horn|\bhorns?\b|tuba|brass|sousaphone|euphonium/.test(s)) return "brass";
  if (/synth|moog|mellotron|theremin|vocoder/.test(s)) return "synth";
  // ein Mensch am Schlagzeug – „Drum Programming“ und „Drum Machine“ sind kein Solo wert
  if (/drum|percussion|timpani|conga|bongo|tabla|djembe|cajon/.test(s) && !/machine|programm/.test(s)) return "drums";
  if (/bass/.test(s) && !/bassoon|clarinet|vocal|voice|singer|baritone/.test(s)) return "bass";
  if (/guitar/.test(s) && !/acoustic|classical|nylon|spanish|steel|ukulele/.test(s)) return "guitar";
  if (/piano|rhodes|wurlitzer|clavinet/.test(s)) return "piano";
  if (/violin|viola|cello|string|orchestra/.test(s)) return "strings";
  if (/choir|chorus|choral/.test(s)) return "choir";
  return "";
}

export { KINDS, kindOf };
