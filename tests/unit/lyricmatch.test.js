// node tests/unit/lyricmatch.test.js
const assert = require("assert");
const { load } = require("./load.js");
const { versionTags, baseTitle, matchScore, rankLyrics } = load("lyricmatch.js");

const tags = (t, a) => [...versionTags(t, a)].sort().join(",");
assert.equal(tags("Live and Let Die"), "", "Wort im Titel selbst zählt nicht");
assert.equal(tags("Hotel California - Live at The Forum"), "live");
assert.equal(tags("Song (Acoustic)"), "acoustic");
assert.equal(tags("Song - Remastered 2011"), "", "Remaster ist dieselbe Aufnahme");
assert.equal(tags("Song - 2009 Mono Mix"), "");
assert.equal(tags("Song (Purple Disco Machine Remix)"), "remix");
assert.equal(tags("Song [Sped Up]"), "speed");
assert.equal(tags("Song - Radio Edit"), "edit");
assert.equal(tags("Song", "Live at Wembley"), "live");
assert.equal(tags("Song", "Alive 2007"), "");
assert.equal(baseTitle("Song - Remastered 2011"), "Song");
assert.equal(baseTitle("Song (feat. X) [Live]"), "Song");
assert.equal(baseTitle("Song (Part 2)"), "Song (Part 2)");
assert.equal(baseTitle("Symphony No. 5 - Allegro"), "Symphony No. 5 - Allegro");
assert.equal(baseTitle("(I Can't Get No) Satisfaction - Mono"), "(I Can't Get No) Satisfaction");

const studio = { id: 1, title: "Song", artist: "Band", album: "Album", sec: 215, synced: true };
const live = { id: 2, title: "Song (Live)", artist: "Band", album: "Tour", sec: 262, synced: true };
const liveSame = { id: 3, title: "Song - Live", artist: "Band", album: "Tour", sec: 216, synced: true };
const plain = { id: 4, title: "Song", artist: "Band", album: "Album", sec: 215, synced: false };
const other = { id: 5, title: "Another Tune Entirely", artist: "Band", sec: 215, synced: true };
const otherArtist = { id: 6, title: "Song", artist: "Somebody Else", sec: 215, synced: true };
const instr = { id: 7, title: "Song (Instrumental)", artist: "Band", sec: 215, synced: true };
const remix = { id: 8, title: "Song (DJ X Remix)", artist: "Band", sec: 214, synced: true };

// Studiofassung: der Studioeintrag gewinnt, Live-Eintrag anderer Länge fällt raus
let r = rankLyrics({ title: "Song", artist: "Band", album: "Album", sec: 215 }, [live, plain, studio, other, otherArtist, instr, remix]);
assert.equal(r[0].id, 1);
assert.equal(r[0].plainOnly, false);
assert.ok(!r.some((x) => [2, 5, 6, 7].includes(x.id)), "andere Länge, anderer Song, anderer Künstler, Instrumental");
assert.equal(r.find((x) => x.id === 8).plainOnly, true, "Remix gleicher Länge: Zeiten nicht übernehmen");

// Remastered-Titel = Studiofassung
r = rankLyrics({ title: "Song - Remastered 2011", artist: "Band", sec: 216 }, [live, studio]);
assert.deepEqual(r.map((x) => x.id), [1]);
assert.equal(r[0].plainOnly, false);

// Live-Fassung (4:22): Live-Eintrag gewinnt, Studiotext mit 47 s weniger kommt nicht in Frage
r = rankLyrics({ title: "Song - Live at Wembley", artist: "Band", sec: 262 }, [studio, live, liveSame]);
assert.deepEqual(r.map((x) => x.id), [2]);
assert.equal(r[0].plainOnly, false);

// Live-Fassung, die zufällig so lang ist wie die Studiofassung: Studiotext nur ohne Zeiten, Live-Eintrag zuerst
r = rankLyrics({ title: "Song - Live", artist: "Band", sec: 216 }, [studio, liveSame]);
assert.deepEqual(r.map((x) => x.id), [3, 1]);
assert.equal(r[1].plainOnly, true);

// Länge: 3 s daneben bleibt zeitgenau, 8 s nur noch als Text, 20 s gar nicht
const m = { title: "Song", artist: "Band", sec: 200 };
assert.equal(matchScore(m, { ...studio, sec: 203 }).plainOnly, false);
assert.equal(matchScore(m, { ...studio, sec: 208 }).plainOnly, true);
assert.equal(matchScore(m, { ...studio, sec: 220 }).score, Infinity);
// unbekannte Länge: erlaubt, aber schlechter als ein Treffer mit passender Länge
assert.ok(matchScore(m, { ...studio, sec: 0 }).score > matchScore(m, { ...studio, sec: 200 }).score);
// zeitgenau vor einfachem Text
assert.ok(matchScore(m, { ...plain, sec: 200 }).score > matchScore(m, { ...studio, sec: 200 }).score);

// abgelehnte Einträge („Nicht der richtige Liedtext“) kommen nicht wieder, der nächstbeste rückt nach
r = rankLyrics({ title: "Song", artist: "Band", sec: 215 }, [studio, plain, studio], ["1"]);
assert.deepEqual(r.map((x) => x.id), [4]);
// mehrere Künstler: der erste zählt
assert.ok(Number.isFinite(matchScore({ title: "Song", artist: "Band, Guest", sec: 215 }, studio).score));
console.log("lyricmatch: ok");
