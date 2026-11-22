// node tests/unit/genres-all.test.js
// Vollständige Genre-Liste (tools/data/genres-all.json: Spotify/Every Noise, MusicBrainz, Apple, Deezer en+de):
// JEDER Name kommt auf ein Profil – genaue Regel, Tabelle (src/genre-map.js) oder wenigstens die Familie, nie „nichts“.
// Dazu von Hand geprüfte Stichproben (richtige Familie), die eigene Festlegung je Künstler und die Namen für die Anzeige.
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { load } = require("./load.js");
const { best, GENRES, APPLE, APPLE_ONLY, DEEZER_ONLY, FAMILIES, genreKey, familyOf, manualFor, pickGenre } = load("genres.js");
const { namesFrom } = load("genre-label.js");
const { GENRE_TEXT } = load("i18n-genres.js");
const { SUBGENRES_TEXT } = load("i18n-subgenres.js");

const KEYS = new Set(Object.values(FAMILIES).flat());
const data = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "tools", "data", "genres-all.json"), "utf8"));
const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();

// ---- 100 %: jeder Name jeder Quelle trifft etwas (ohne den letzten Notnagel „Pop“ von genreKey)
const lists = {
  spotify: Object.keys(data.spotify.names),
  mb: data.mb || [],
  // Apple und Deezer: je Genre-ID alle Namen (Apple in ~30 Ländern und Sprachen, Deezer Englisch und Deutsch)
  apple: Object.values(data.apple || {}).flat(),
  deezer: Object.values(data.deezer || {}).flat(),
};
assert.ok(lists.spotify.length >= 5000, `Spotify-Liste zu kurz: ${lists.spotify.length}`);
for (const [src, l] of Object.entries(lists)) assert.ok(l.length > 0, `Quelle ${src} fehlt in genres-all.json`);
const miss = [];
let total = 0;
for (const [src, l] of Object.entries(lists)) {
  const kind = src === "mb" ? "spotify" : src;
  for (const raw of l) {
    const n = norm(raw);
    if (!n) continue;
    total++;
    const store = kind === "apple" ? APPLE_ONLY[n] : kind === "deezer" ? DEEZER_ONLY[n] : "";
    const m = store || best(n)?.[0] || (kind === "spotify" ? GENRES : APPLE).find(([, re]) => re.test(n))?.[0] || (kind === "spotify" ? APPLE : GENRES).find(([, re]) => re.test(n))?.[0];
    if (!m || !KEYS.has(m)) miss.push(`${n} (${src})`);
    const k = genreKey(n, kind);
    assert.ok(KEYS.has(k), `${n}: genreKey liefert ${k}`);
  }
}
assert.ok(!miss.length, `${miss.length} von ${total} Namen ohne Profil:\n  ${miss.slice(0, 80).join("\n  ")}`);

// ---- Stichproben, von Hand geprüft: Name → Familie (und wo es darauf ankommt, die genaue Spielart)
const SAMPLES = [
  // die 31, die vorher gar nichts trafen
  ["deep tech", "electronic", "deeptech"], ["wave", "electronic"], ["sigilkore", "electronic"], ["hyperflip", "electronic"],
  ["slowed and reverb", "electronic"], ["oi", "rock", "streetpunk"], ["riot grrrl", "rock", "riotgrrrl"], ["hyphy", "urban", "hyphy"],
  ["bounce", "urban"], ["jerk", "urban", "jerk"], ["cuarteto", "latin", "cuarteto"], ["champeta", "latin", "champeta"],
  ["shatta", "africa", "shatta"], ["hamburger schule", "rock"], ["zeuhl", "rock"], ["uptempo", "electronic", "uptempo"],
  ["ghettotech", "electronic"], ["juju", "africa", "juju"], ["fuji", "africa", "juju"], ["mbalax", "africa", "mbalax"],
  ["bhojpuri", "asia", "bhojpuri"], ["tecnobrega", "latin", "tecnobrega"], ["hauntology", "experimental"],
  ["dungeon synth", "experimental", "dungeonsynth"], ["nederhop", "urban"], ["boogaloo", "latin", "mambo"], ["mambo", "latin", "mambo"],
  ["bomba", "latin"], ["plena", "latin"], ["ragga", "africa", "ragga"], ["lowercase", "calm"],
  // die 7, die nur die grobe Familie trafen (Breakcore sogar falsch Rock)
  ["bass music", "electronic"], ["new rave", "pop"], ["nederpop", "europe"], ["slowcore", "rock", "slowcore"], ["sadcore", "rock", "slowcore"],
  ["breakcore", "electronic", "breakcore"], ["electronicore", "metal"],
  // Elektronisch
  ["frenchcore", "electronic", "gabber"], ["terrorcore", "electronic", "uptempo"], ["speedcore", "electronic", "uptempo"],
  ["raggacore", "electronic", "breakcore"], ["melbourne bounce", "electronic"], ["german techno", "electronic"], ["deep euro house", "electronic"],
  ["vapor twitch", "electronic"], ["future garage", "electronic"], ["bassline", "electronic"], ["lo-fi house", "electronic"],
  ["hard trance", "electronic"], ["organic house", "electronic"], ["electroclash", "pop"], ["ghetto house", "electronic"],
  // Hip-Hop & R&B
  ["bay area hip hop", "urban", "hyphy"], ["new orleans rap", "urban"], ["chicago drill", "urban"], ["brazilian phonk", "urban"],
  ["atl trap", "urban"], ["new jersey rap", "urban"], ["pluggnb", "urban"], ["jerk rap", "urban"], ["detroit hip hop", "urban"],
  ["alternative r&b", "urban"], ["chicago soul", "urban"], ["drumless hip hop", "urban"],
  // Rock & Punk
  ["street punk", "rock", "streetpunk"], ["queercore", "rock", "riotgrrrl"], ["midwest emo", "rock", "emo"], ["math rock", "rock"],
  ["noise pop", "experimental"], ["aarhus indie", "rock"], ["crust punk", "rock"], ["skate punk", "rock"], ["anarcho-punk", "rock"],
  ["dream pop", "rock"], ["space rock", "rock"], ["blues rock", "rock"], ["neo-psychedelic", "rock"], ["hamburg indie", "rock"],
  // Metal
  ["symphonic melodic death metal", "metal"], ["atmospheric black metal", "metal"], ["sludge metal", "metal"], ["nwothm", "metal"],
  ["melodic metalcore", "metal"], ["brutal deathcore", "metal"], ["neue deutsche harte", "metal"], ["viking metal", "metal"],
  // Pop
  ["dance pop", "pop"], ["bubblegum dance", "electronic"], ["chamber pop", "pop"], ["art pop", "pop"], ["indie poptimism", "pop"],
  // Asien
  ["k-pop girl group", "asia"], ["anime rock", "asia"], ["mandopop", "asia"], ["thai pop", "asia"], ["bhojpuri pop", "asia", "bhojpuri"],
  ["filmi", "asia"], ["sufi", "asia"], ["chhattisgarhi pop", "asia", "bhojpuri"], ["j-idol", "asia"], ["vocaloid", "asia"],
  // Lateinamerika
  ["cuarteto cordobes", "latin", "cuarteto"], ["latin boogaloo", "latin", "mambo"], ["salsa choke", "latin"], ["cumbia santafesina", "latin"],
  ["tecnobrega paraense", "latin", "tecnobrega"], ["brega", "latin", "tecnobrega"], ["brega funk", "latin", "funkcarioca"],
  ["corrido", "latin"], ["reggaeton chileno", "latin"], ["rkt", "latin"], ["forro", "latin"], ["sertanejo pop", "latin"],
  ["pachanga", "latin", "mambo"],
  // Afrika & Karibik
  ["nigerian hip hop", "urban"], ["fuji music", "africa", "juju"], ["senegalese hip hop", "urban"], ["senegalese pop", "africa"],
  ["ragga hip hop", "africa", "ragga"], ["raggamuffin", "africa", "ragga"], ["ragga jungle", "electronic", "jungle"], ["gqom", "africa"],
  ["shatta martinique", "africa", "shatta"], ["soca", "africa"], ["afrobeats", "africa"], ["zouk", "africa"], ["kompa", "africa"],
  // Naher Osten, Europa, Folk, Jazz, Klassik, Ruhig, Experimentell
  ["arabic pop", "mideast"], ["turkish folk", "mideast"], ["schlager", "europe"], ["volksmusik", "europe"], ["fado", "europe"],
  ["chanson", "europe"], ["polka", "europe"], ["bluegrass", "country"], ["outlaw country", "country"], ["indie folk", "country"],
  ["bebop", "jazz"], ["jazz fusion", "jazz"], ["delta blues", "jazz"], ["gospel", "spirit"], ["worship", "spirit"], ["baroque", "classical"],
  ["opera", "classical"], ["video game music", "classical"], ["dark ambient", "experimental"], ["winter synth", "experimental", "dungeonsynth"],
  ["lo-fi beats", "calm"], ["sleep", "calm"], ["trip hop", "calm"], ["idm", "experimental"], ["harsh noise", "experimental"],
  ["christmas", "misc"], ["children's music", "misc"], ["comedy", "misc"],
];
const bad = [];
for (const [n, fam, key] of SAMPLES) {
  const k = genreKey(n);
  if (familyOf(k) !== fam || (key && k !== key)) bad.push(`„${n}“: ${key || "Familie " + fam} erwartet, ${k} (${familyOf(k)}) gewählt`);
}
assert.ok(!bad.length, bad.join("\n"));
assert.ok(SAMPLES.length >= 150, `nur ${SAMPLES.length} Stichproben`);
// pickGenre gibt die Familie mit
const r = pickGenre({ genres: ["midwest emo"] });
assert.equal(r.key, "emo");
assert.equal(r.family, "rock");
assert.equal(pickGenre({ genres: ["breakcore"] }).family, "electronic", "Breakcore ist elektronisch, nicht Rock");

// ---- eigene Festlegung je Künstler (cfg.genreArtist): gewinnt immer, conf 1, why „manual“
const manual = { "spotify:artist:abc": "emo", def: "breakcore", ghi: "gibtsnicht" };
assert.equal(manualFor(manual, "spotify:artist:abc"), "emo");
assert.equal(manualFor(manual, "spotify:artist:def"), "breakcore", "Festlegung nur mit ID");
assert.equal(manualFor({ "spotify:artist:xyz": "salsa" }, "xyz"), "salsa", "Nachfrage nur mit ID");
assert.equal(manualFor(manual, "spotify:artist:ghi"), "", "unbekannte Spielart zählt nicht");
assert.equal(manualFor(manual, ""), "");
assert.equal(manualFor(null, "spotify:artist:abc"), "");
const m = pickGenre({ genres: ["deep house"], apple: "Dance", artistUri: "spotify:artist:abc", manual, bpm: 124 });
assert.deepEqual(m, { key: "emo", why: "manual", conf: 1, family: "rock" });
assert.equal(pickGenre({ genres: ["deep house"], artistUri: "spotify:artist:zzz", manual }).key, "deephouse", "anderer Künstler: Erkennung");

// ---- Namen für die Anzeige: „Erkannt: Emo (Rock)“
const I18N = {
  en: { ...GENRE_TEXT.en, ...SUBGENRES_TEXT.en, party_emo: "Emo", party_rock: "Rock", fam_rock: "Rock", fam_electronic: "Electronic" },
  de: { ...GENRE_TEXT.de, ...SUBGENRES_TEXT.de, party_emo: "Emo", party_rock: "Rock", fam_rock: "Rock", fam_electronic: "Elektronisch" },
};
const names = namesFrom(I18N, "de");
assert.equal(names.detectedLabel({ key: "emo", family: "rock" }), "Erkannt: Emo (Rock)");
assert.equal(names.detectedLabel({ key: "rock" }), "Erkannt: Rock", "ohne doppelte Familie");
assert.equal(names.detectedLabel({ key: "breakcore", manual: true }, "en"), "Detected: Breakcore (Electronic) · set by you");
assert.equal(names.genreName("uptempo"), "Uptempo & Terrorcore");
assert.equal(names.genreName("breakcore"), "Breakcore", "Deutsch fällt auf Englisch zurück");
assert.equal(names.familyName("rock", "en"), "Rock");

console.log(`genres-all: ok (${total} Namen aus ${Object.keys(lists).length} Quellen, alle mit Profil; ${SAMPLES.length} Stichproben)`);
