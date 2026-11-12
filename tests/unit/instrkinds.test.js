// node tests/unit/instrkinds.test.js
const assert = require("assert");
const { load } = require("./load.js");
const { KINDS, kindOf } = load("instrkinds.js");

const expect = {
  // wie bisher
  "Tenor Saxophone": "sax", Trumpet: "brass", "French Horn": "brass", Horns: "brass", "Bass Trombone": "brass",
  "Electric Guitar": "guitar", Guitar: "guitar", "Acoustic Guitar": "", Ukulele: "", Piano: "piano", "Fender Rhodes": "piano",
  Violin: "strings", Cello: "strings", "String Arranger": "strings", Choir: "choir", "Background Vocals": "", Producer: "",
  // neu
  Drums: "drums", "Drum Kit": "drums", Percussion: "drums", "Bass Drum": "drums", Congas: "drums",
  "Drum Programming": "", "Drum Machine": "", Programmer: "",
  Bass: "bass", "Bass Guitar": "bass", "Electric Bass": "bass", "Double Bass": "bass", Contrabass: "bass", "Synth Bass": "synth",
  Bassoon: "", "Bass Clarinet": "", "Bass Vocals": "", "Bass-Baritone": "",
  Synthesizer: "synth", "Moog Synthesizer": "synth", Mellotron: "synth", Keyboards: "",
  Accordion: "accordion", "Bandoneón": "accordion", Bandoneon: "accordion", Concertina: "accordion",
  Flute: "flute", Piccolo: "flute", "Pan Pipes": "flute", "Tin Whistle": "flute", Recorder: "flute", "Bass Flute": "flute",
  "Tape Recorder": "", "Recording Engineer": "", "Recorded By": "",
  Harp: "harp", "Celtic Harp": "harp", Harpsichord: "", "Blues Harp": "", "Mouth Harp": "", "Jaw Harp": "", Harmonica: "",
};
for (const [name, kind] of Object.entries(expect)) assert.equal(kindOf(name), kind, name);
for (const k of new Set(Object.values(expect))) if (k) assert.ok(KINDS.includes(k), k);
assert.equal(KINDS.length, 12);
assert.equal(kindOf(null), "");
console.log("instrkinds: ok");
