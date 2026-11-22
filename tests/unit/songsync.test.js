// node tests/unit/songsync.test.js
// Versatz je Song (±250-ms-Knöpfe) und „Abgleich aus“ je Song – auf einem einfachen cfg-Objekt
const assert = require("assert");
const { load } = require("./load.js");
const { songOffsetOf, nudgeSongIn, resetSongIn, autoSyncOffIn, setAutoSyncIn, LIMIT } = load("songsync.js");

const U = "spotify:track:dogdribble";
{
  const cfg = { syncSongs: {} };
  assert.equal(songOffsetOf(cfg, U), 0);
  assert.equal(nudgeSongIn(cfg, U, 250), 250);
  assert.equal(nudgeSongIn(cfg, U, 250), 500);
  assert.equal(nudgeSongIn(cfg, U, -1000), -500);
  assert.equal(songOffsetOf(cfg, U), -500);
  // auf 10 ms gerundet, höchstens ±5 s
  assert.equal(nudgeSongIn(cfg, U, 3), -500);
  assert.equal(nudgeSongIn(cfg, U, -99999), -LIMIT);
  // zurück auf 0: Eintrag verschwindet ganz
  assert.equal(resetSongIn(cfg, U), 0);
  assert.equal(U in cfg.syncSongs, false);
  nudgeSongIn(cfg, U, 250);
  nudgeSongIn(cfg, U, -250);
  assert.equal(U in cfg.syncSongs, false);
  // ohne Song nichts tun, ohne syncSongs nicht stolpern
  assert.equal(nudgeSongIn({}, "", 250), 0);
  const bare = {};
  nudgeSongIn(bare, U, 100);
  assert.deepEqual(bare.syncSongs, { [U]: 100 });
}
// höchstens 300 Songs, der zuletzt geänderte bleibt
{
  const cfg = { syncSongs: {} };
  for (let i = 0; i < 305; i++) nudgeSongIn(cfg, "spotify:track:" + i, 100);
  nudgeSongIn(cfg, "spotify:track:0", 100);
  const keys = Object.keys(cfg.syncSongs);
  assert.equal(keys.length, 300);
  assert.equal(keys[keys.length - 1], "spotify:track:0");
  assert.equal(cfg.syncSongs["spotify:track:0"], 100, "0 war schon herausgefallen und beginnt neu");
}
// Abgleich je Song aus/an
{
  const cfg = {};
  assert.equal(autoSyncOffIn(cfg, U), false);
  setAutoSyncIn(cfg, U, false);
  assert.equal(autoSyncOffIn(cfg, U), true);
  setAutoSyncIn(cfg, U, true);
  assert.equal(autoSyncOffIn(cfg, U), false);
  assert.deepEqual(cfg.syncNoAuto, {});
}
console.log("songsync: ok");
