// node tests/unit/lyrics-match.test.js
// Knifflige Titel/Künstler/Längen, wie sie zwischen Spotify und den Liedtext-Sammlungen wirklich vorkommen.
const assert = require("assert");
const { load } = require("./load.js");
const { rankLyrics, instrumentalMeta, instrumentalText, cleanCredits, sameLyrics, tierOf, versionTags } = load("lyricmatch.js");

// c(id, Titel, Künstler, Sekunden, zeitgenau?, Album)
const c = (id, title, artist, sec, synced = true, album = "") => ({ id, title, artist, sec, synced, album });
// want: id des besten Treffers (null = keiner passt); plain: true = nur als Text (Zeiten passen nicht)
const CASES = [
  // ---- Zusätze im Titel
  ["Remaster mit Strich", { title: "Bohemian Rhapsody - Remastered 2011", artist: "Queen", sec: 354 }, [c(1, "Bohemian Rhapsody", "Queen", 355)], 1],
  ["Remaster in Klammern, The fehlt", { title: "Come Together (Remastered 2009)", artist: "The Beatles", sec: 259 }, [c(1, "Come Together", "Beatles", 259)], 1],
  ["Jahreszahl-Remaster", { title: "Dreams - 2004 Remaster", artist: "Fleetwood Mac", sec: 257 }, [c(1, "Dreams", "Fleetwood Mac", 257)], 1],
  ["with in Klammern", { title: "Stay (with Justin Bieber)", artist: "The Kid LAROI", sec: 141 }, [c(1, "Stay", "The Kid LAROI & Justin Bieber", 141)], 1],
  ["feat. ohne Klammern", { title: "Lean On feat. MØ", artist: "Major Lazer", sec: 176 }, [c(1, "Lean On", "Major Lazer & DJ Snake", 176)], 1],
  ["ft. gegen (feat.)", { title: "Cheap Thrills ft. Sean Paul", artist: "Sia", sec: 224 }, [c(1, "Cheap Thrills (feat. Sean Paul)", "Sia", 224)], 1],
  ["From-Film-Zusatz", { title: 'Let It Go - From "Frozen"/Soundtrack Version', artist: "Idina Menzel", sec: 224 }, [c(1, "Let It Go", "Idina Menzel", 224)], 1],
  ["Anime-OP-Zusatz", { title: "紅蓮華", artist: "LiSA", sec: 239 }, [c(1, "紅蓮華 (TVアニメ「鬼滅の刃」OP)", "LiSA", 239)], 1],
  ["Übersetzung in Klammern", { title: "Lemon", artist: "Kenshi Yonezu", sec: 255 }, [c(1, "Lemon (柠檬)", "Kenshi Yonezu", 255)], 1],
  ["Single Version", { title: "Heroes - Single Version", artist: "David Bowie", sec: 211 }, [c(1, "Heroes", "David Bowie", 211)], 1],
  ["Taylor's Version", { title: "Love Story (Taylor's Version)", artist: "Taylor Swift", sec: 235 }, [c(1, "Love Story", "Taylor Swift", 236)], 1],
  ["Klammer vorne bleibt Titel", { title: "(I Can't Get No) Satisfaction - Mono", artist: "The Rolling Stones", sec: 223 }, [c(1, "(I Can't Get No) Satisfaction", "The Rolling Stones", 223)], 1],
  ["Klammer vorne fehlt", { title: "(Don't Fear) The Reaper", artist: "Blue Öyster Cult", sec: 308 }, [c(1, "Don't Fear the Reaper", "Blue Oyster Cult", 308)], 1],
  ["Pt. gegen Part", { title: "Another Brick in the Wall, Pt. 2", artist: "Pink Floyd", sec: 239 }, [c(1, "Another Brick in the Wall (Part 2)", "Pink Floyd", 239)], 1],
  ["Part 1 ist nicht Part 2", { title: "Another Brick in the Wall, Pt. 1", artist: "Pink Floyd", sec: 191 }, [c(1, "Another Brick in the Wall (Part 2)", "Pink Floyd", 191)], null],
  ["Nummer im Titel", { title: "Bound 2", artist: "Kanye West", sec: 229 }, [c(1, "Bound", "Kanye West", 229)], null],
  ["& gegen and im Titel", { title: "Me and Mrs. Jones", artist: "Michael Bublé", sec: 273 }, [c(1, "Me & Mrs. Jones", "Michael Buble", 273)], 1],
  ["Apostroph fehlt", { title: "Don't Stop Me Now", artist: "Queen", sec: 209 }, [c(1, "Dont Stop Me Now", "Queen", 209)], 1],
  ["typografisches Apostroph", { title: "Don’t Start Now", artist: "Dua Lipa", sec: 183 }, [c(1, "Don't Start Now", "Dua Lipa", 183)], 1],
  ["Akzente im Titel", { title: "Café del Mar", artist: "Energy 52", sec: 446 }, [c(1, "Cafe Del Mar", "Energy 52", 446)], 1],
  ["Tippfehler-Schreibweise", { title: "Rock and Roll All Nite", artist: "KISS", sec: 168 }, [c(1, "Rock and Roll All Night", "Kiss", 168)], 1],
  ["Hey ist nicht Hey Jude", { title: "Hey", artist: "The Beatles", sec: 431 }, [c(1, "Hey Jude", "The Beatles", 431)], null],
  ["Mellow Yellow ist nicht Yellow", { title: "Yellow", artist: "Donovan", sec: 220 }, [c(1, "Mellow Yellow", "Donovan", 220)], null],
  ["Titel-Teil mit Untertitel", { title: "Sign of the Times", artist: "Harry Styles", sec: 341 }, [c(1, "Sign of the Times (Harry)", "Harry Styles", 341)], 1],
  ["exakter Titel vor Teiltitel", { title: "Dancing Queen", artist: "ABBA", sec: 231 }, [c(1, "Dancing Queen Medley Part", "ABBA", 231), c(2, "Dancing Queen", "ABBA", 231)], 2],
  ["Doppelpunkt im Titel", { title: "Star Wars: Main Title", artist: "John Williams", sec: 330 }, [c(1, "Star Wars - Main Title", "John Williams", 330)], 1],
  // ---- Künstler
  ["& gegen and im Künstler", { title: "The Sound of Silence", artist: "Simon & Garfunkel", sec: 185 }, [c(1, "The Sound of Silence", "Simon and Garfunkel", 185)], 1],
  ["The fehlt", { title: "Blinding Lights", artist: "The Weeknd", sec: 200 }, [c(1, "Blinding Lights", "Weeknd", 200)], 1],
  ["zweiter Künstler", { title: "One Kiss", artist: "Calvin Harris", artists: ["Calvin Harris", "Dua Lipa"], sec: 214 }, [c(1, "One Kiss", "Dua Lipa", 214)], 1],
  ["Künstler umgedreht", { title: "One Kiss", artist: "Calvin Harris", sec: 214 }, [c(1, "One Kiss", "Dua Lipa & Calvin Harris", 214)], 1],
  ["Komma im Namen", { title: "EARFQUAKE", artist: "Tyler, The Creator", sec: 190 }, [c(1, "EARFQUAKE", "Tyler, The Creator", 190)], 1],
  ["Earth, Wind & Fire", { title: "September", artist: "Earth, Wind & Fire", sec: 215 }, [c(1, "September", "Earth Wind and Fire", 215)], 1],
  ["AC/DC", { title: "Thunderstruck", artist: "AC/DC", sec: 292 }, [c(1, "Thunderstruck", "ACDC", 292)], 1],
  ["P!nk", { title: "So What", artist: "P!nk", sec: 215 }, [c(1, "So What", "Pink", 215)], 1],
  ["Ke$ha", { title: "TiK ToK", artist: "Ke$ha", sec: 200 }, [c(1, "Tik Tok", "Kesha", 200)], 1],
  ["JAY-Z", { title: "Empire State Of Mind", artist: "JAY-Z", sec: 276 }, [c(1, "Empire State of Mind", "Jay Z", 276)], 1],
  ["Umlaute im Künstler", { title: "Kickstart My Heart", artist: "Mötley Crüe", sec: 282 }, [c(1, "Kickstart My Heart", "Motley Crue", 282)], 1],
  ["Vollbreite Buchstaben", { title: "crossing field", artist: "ＬｉＳＡ", sec: 248 }, [c(1, "crossing field", "LiSA", 248)], 1],
  ["anderer Künstler, gleiche Länge", { title: "Hello", artist: "Adele", sec: 295 }, [c(1, "Hello", "Lionel Richie", 295)], null],
  ["Coverversion anderer Künstler", { title: "Hallelujah", artist: "Jeff Buckley", sec: 413 }, [c(1, "Hallelujah", "Leonard Cohen", 413), c(2, "Hallelujah", "Jeff Buckley", 414)], 2],
  // ---- andere Schriften
  ["Titel in anderer Schrift", { title: "Gurenge", artist: "LiSA", sec: 239 }, [c(1, "紅蓮華", "LiSA", 239)], 1],
  ["andere Schrift, Länge daneben", { title: "Gurenge", artist: "LiSA", sec: 239 }, [c(1, "紅蓮華", "LiSA", 245)], null],
  ["Künstler in Kanji", { title: "Lemon", artist: "Kenshi Yonezu", sec: 255 }, [c(1, "Lemon", "米津玄師", 255)], 1],
  ["Künstler in Kanji, Länge daneben", { title: "Lemon", artist: "Kenshi Yonezu", sec: 255 }, [c(1, "Lemon", "米津玄師", 262)], null],
  ["Titel UND Künstler fremd", { title: "Lemon", artist: "Kenshi Yonezu", sec: 255 }, [c(1, "レモン", "米津玄師", 255)], null],
  ["Kyrillisch umgeschrieben", { title: "Gruppa krovi", artist: "Kino", sec: 287 }, [c(1, "Группа крови", "Кино", 287)], 1],
  ["Ёлка/Yolka", { title: "Provans", artist: "Yolka", sec: 214 }, [c(1, "Прованс", "Ёлка", 214)], 1],
  ["Hangul-Künstler", { title: "Dynamite", artist: "BTS", sec: 199 }, [c(1, "Dynamite", "방탄소년단", 199)], 1],
  ["Hangul-Titel", { title: "Spring Day", artist: "BTS", sec: 274 }, [c(1, "봄날", "BTS", 274)], 1],
  ["Kurz- und Langzeichen", { title: "江南", artist: "林俊杰", sec: 268 }, [c(1, "江南", "林俊傑", 268)], 1],
  // ---- Fassungen
  ["Live-Fassung gewinnt", { title: "Yellow - Live in Buenos Aires", artist: "Coldplay", sec: 290 }, [c(1, "Yellow", "Coldplay", 266), c(2, "Yellow (Live in Buenos Aires)", "Coldplay", 291)], 2],
  ["Live-Album ohne Zusatz", { title: "Bohemian Rhapsody", artist: "Queen", album: "Live at Wembley Stadium", sec: 361 }, [c(1, "Bohemian Rhapsody", "Queen", 354), c(2, "Bohemian Rhapsody - Live at Wembley Stadium", "Queen", 361, true, "Live at Wembley Stadium")], 2],
  ["Remix gleicher Länge nur als Text", { title: "Blinding Lights", artist: "The Weeknd", sec: 200 }, [c(1, "Blinding Lights (Chromatics Remix)", "The Weeknd", 200)], 1, true],
  ["Original vor Remix", { title: "Blinding Lights", artist: "The Weeknd", sec: 200 }, [c(1, "Blinding Lights (Chromatics Remix)", "The Weeknd", 200), c(2, "Blinding Lights", "The Weeknd", 200)], 2],
  ["Remix sucht Remix", { title: "Physical (Mark Ronson Remix)", artist: "Dua Lipa", sec: 230 }, [c(1, "Physical", "Dua Lipa", 194), c(2, "Physical - Mark Ronson Remix", "Dua Lipa", 231)], 2],
  ["Radio Edit gleicher Länge", { title: "Levels - Radio Edit", artist: "Avicii", sec: 199 }, [c(1, "Levels", "Avicii", 199)], 1, false],
  ["Radio Edit gegen Albumfassung", { title: "Animals - Radio Edit", artist: "Martin Garrix", sec: 175 }, [c(1, "Animals", "Martin Garrix", 304), c(2, "Animals (Radio Edit)", "Martin Garrix", 175)], 2],
  ["Sped Up gleicher Länge nur Text", { title: "Die For You (Sped Up)", artist: "The Weeknd", sec: 200 }, [c(1, "Die For You", "The Weeknd", 200)], 1, true],
  ["Akustik gegen Studio", { title: "Wonderwall - Acoustic", artist: "Oasis", sec: 259 }, [c(1, "Wonderwall", "Oasis", 258)], 1, true],
  ["Instrumental gegen Gesang", { title: "Viva La Vida", artist: "Coldplay", sec: 242 }, [c(1, "Viva La Vida (Instrumental)", "Coldplay", 242)], null],
  ["Off Vocal gegen Gesang", { title: "Idol", artist: "YOASOBI", sec: 213 }, [c(1, "アイドル (Off Vocal)", "YOASOBI", 213), c(2, "Idol", "YOASOBI", 213)], 2],
  ["Sprachfassung abgelehnt", { title: "Kiss Me (Japanese Ver.)", artist: "Band", sec: 200 }, [c(1, "Kiss Me", "Band", 200)], null],
  ["Sprachfassung gefunden", { title: "Kiss Me (Japanese Ver.)", artist: "Band", sec: 200 }, [c(1, "Kiss Me", "Band", 200), c(2, "Kiss Me - Japanese Version", "Band", 201)], 2],
  ["Sprache verschieden geschrieben", { title: "Bailando - Spanish Version", artist: "Enrique Iglesias", sec: 243 }, [c(1, "Bailando (Versión en español)", "Enrique Iglesias", 243)], 1],
  ["Englische Fassung nicht fürs Original", { title: "Despacito", artist: "Luis Fonsi", sec: 229 }, [c(1, "Despacito (English Version)", "Luis Fonsi", 229), c(2, "Despacito", "Luis Fonsi", 229)], 2],
  // ---- Länge
  ["3 s daneben bleibt zeitgenau", { title: "Song", artist: "Band", sec: 200 }, [c(1, "Song", "Band", 203)], 1, false],
  ["7 s daneben nur als Text", { title: "Song", artist: "Band", sec: 200 }, [c(1, "Song", "Band", 207)], 1, true],
  ["langes Stück: 7 s noch zeitgenau", { title: "Echoes", artist: "Pink Floyd", sec: 1412 }, [c(1, "Echoes", "Pink Floyd", 1405)], 1, false],
  ["20 s daneben gar nicht", { title: "Song", artist: "Band", sec: 200 }, [c(1, "Song", "Band", 220)], null],
  ["nähere Länge gewinnt", { title: "Song", artist: "Band", sec: 200 }, [c(1, "Song", "Band", 203), c(2, "Song", "Band", 200)], 2],
  ["zeitgenau vor einfachem Text", { title: "Song", artist: "Band", sec: 200 }, [c(1, "Song", "Band", 200, false), c(2, "Song", "Band", 201)], 2],
  ["unbekannte Länge erlaubt", { title: "Song", artist: "Band", sec: 200 }, [c(1, "Song", "Band", 0)], 1],
];

let n = 0;
for (const [name, meta, cands, want, plain] of CASES) {
  const r = rankLyrics(meta, cands);
  const got = r[0]?.id ?? null;
  assert.equal(got, want, `${name}: erwartet ${want}, bekommen ${got} (${JSON.stringify(r.map((x) => [x.id, x.score, x.plainOnly]))})`);
  if (plain !== undefined && want !== null) assert.equal(r[0].plainOnly, plain, `${name}: plainOnly`);
  n++;
}
assert.ok(n >= 60, "mindestens 60 Fälle");

// ---- Instrumental
assert.equal(instrumentalMeta({ title: "Viva La Vida - Instrumental" }), true);
assert.equal(instrumentalMeta({ title: "アイドル (Off Vocal)" }), true);
assert.equal(instrumentalMeta({ title: "晴天 (伴奏)" }), true);
assert.equal(instrumentalMeta({ title: "Song (Karaoke Version)" }), true);
assert.equal(instrumentalMeta({ title: "Instrumental" }), false, "Titel selbst ist kein Zusatz");
assert.equal(instrumentalMeta({ title: "Song (Live)" }), false);
assert.equal(instrumentalText([{ text: "纯音乐，请欣赏" }]), true);
assert.equal(instrumentalText([{ text: "此歌曲为没有填词的纯音乐，请您欣赏" }]), true);
assert.equal(instrumentalText([{ text: "[Instrumental]" }]), true);
assert.equal(instrumentalText([{ text: "♪" }, { text: "(Instrumental)" }]), true);
assert.equal(instrumentalText([{ text: "Instrumental break" }, { text: "we go on" }]), false);
assert.equal(instrumentalText([]), false);

// ---- Mitwirkende und Kopfzeile (Kugou, NetEase)
const kg = cleanCredits(
  [{ t: 0, text: "Yellow - Coldplay (酷玩乐队)" }, { t: 8390, text: "Lyrics by：Guy Berryman/Chris Martin" }, { t: 16790, text: "Composed by：Coldplay" }, { t: 33580, text: "Look at the stars" }],
  { title: "Yellow" }
);
assert.deepEqual(kg.map((l) => l.text), ["Look at the stars"]);
assert.deepEqual(cleanCredits([{ text: "作词 : 方文山" }, { text: "作曲 : 周杰伦" }, { text: "故事的小黄花" }], { title: "晴天" }).map((l) => l.text), ["故事的小黄花"]);
assert.deepEqual(cleanCredits([{ text: "Up - down - all around" }, { text: "x" }], { title: "Something" }).map((l) => l.text), ["Up - down - all around", "x"], "Strich im Text bleibt");

// ---- Gleicher Text? (Sprachfassung erkennen)
const L = (...a) => ({ lines: a.map((text, i) => ({ t: i * 1000, text })) });
const en = L("Look at the stars", "Look how they shine for you", "And everything you do", "Yeah they were all yellow");
const en2 = L("Look at the stars", "Look how they shine for you", "And all the things that you do", "Yeah, they were all yellow");
const es = L("Mira las estrellas", "Mira cómo brillan para ti", "Y todo lo que haces", "Sí, eran todas amarillas");
assert.equal(sameLyrics(en, en2), true);
assert.equal(sameLyrics(en, es, 0.4), false);
const zh1 = L("故事的小黄花", "从出生那年就飘着"), zh2 = L("故事的小黄花", "从出生那年就飘着");
assert.equal(sameLyrics(zh1, zh2), true, "Chinesisch ohne Leerzeichen");

// ---- Stufen
assert.equal(tierOf(null, true), 0);
assert.equal(tierOf({ lines: [{ t: 0, text: "x" }], synced: false }, true), 1);
assert.equal(tierOf({ lines: [{ t: 0, text: "x" }], synced: true }, true), 2);
assert.equal(tierOf({ lines: [{ t: 0, text: "x", words: [{ t: 0, d: 100, text: "x" }] }], synced: true }, true), 3);
assert.equal(tierOf({ lines: [{ t: 0, text: "x", words: [{ t: 0, d: 100, text: "x" }] }], synced: true }, false), 2, "Wortzeiten zählen nur mit Karaoke");
assert.equal(tierOf({ instrumental: true, lines: [] }, true), 2);
assert.equal([...versionTags("Song (Versión en español)")].join(), "lang:es");

console.log(`lyrics-match: ok (${n} Fälle)`);
