// node tests/unit/lyricstore.test.js
const assert = require("assert");
const { load } = require("./load.js");
const { createLyricStore, isFresh, surplus } = load("lyricstore.js");

// Winzige IndexedDB-Attrappe: nur was der Speicher benutzt (open, ein Store mit Index „at“, get/put/delete/getAllKeys)
function fakeIdb() {
  const rows = new Map();
  const req = (fn) => {
    const r = {};
    setTimeout(() => {
      try {
        r.result = fn();
        r.onsuccess?.();
      } catch (e) {
        r.error = e;
        r.onerror?.();
      }
    }, 0);
    return r;
  };
  const store = {
    get: (k) => req(() => (rows.has(k) ? structuredClone(rows.get(k)) : undefined)),
    put: (v) => req(() => void rows.set(v.k, structuredClone(v))),
    delete: (k) => req(() => void rows.delete(k)),
    index: () => ({ getAllKeys: () => req(() => [...rows.values()].sort((a, b) => a.at - b.at).map((x) => x.k)) }),
    createIndex: () => {},
  };
  const db = { transaction: () => ({ objectStore: () => store }), createObjectStore: () => store };
  return {
    rows,
    open: () => {
      const r = req(() => db);
      setTimeout(() => {
        r.result = db;
        r.onupgradeneeded?.();
      }, 0);
      return r;
    },
  };
}
const tick = () => new Promise((r) => setTimeout(r, 5));
const DAY = 864e5;

(async () => {
  // Haltbarkeit: Spotifys Text lange, fremde zeitgenaue einen Monat, einfacher Text zwei Wochen
  assert.equal(isFresh({ v: { synced: true, source: "spotify" }, at0: 0 }, 100 * DAY), true);
  assert.equal(isFresh({ v: { synced: true, source: "spotify" }, at0: 0 }, 181 * DAY), false);
  assert.equal(isFresh({ v: { synced: true, source: "lrclib" }, at0: 0 }, 29 * DAY), true);
  assert.equal(isFresh({ v: { synced: true, source: "lrclib" }, at0: 0 }, 31 * DAY), false);
  assert.equal(isFresh({ v: { synced: false }, at0: 0 }, 13 * DAY), true);
  assert.equal(isFresh({ v: { synced: false }, at0: 0 }, 15 * DAY), false);
  assert.equal(isFresh(null, 0), false);
  assert.deepEqual(surplus(["a", "b", "c", "d"], 3), ["a"]);
  assert.deepEqual(surplus(["a"], 3), []);

  // ohne IndexedDB: nichts wirft, nichts wird gemerkt
  for (const broken of [undefined, null, { open() { throw new Error("gesperrt"); } }]) {
    const s = createLyricStore(broken);
    await s.put("x", { synced: true, lines: [] });
    assert.equal(await s.get("x"), null);
    await s.drop("x");
  }

  // merken und wiederfinden
  let clock = 1000;
  const idb = fakeIdb();
  const s = createLyricStore(idb, { now: () => clock, max: 5 });
  const lyr = { synced: true, source: "lrclib", lines: [{ t: 0, text: "la" }] };
  await s.put("song1|web|", lyr);
  assert.deepEqual(await s.get("song1|web|"), { v: lyr, fresh: true });
  assert.equal(await s.get("song1|web|k|"), null, "anderer Schlüssel (Karaoke, gewählte Fassung) = anderer Eintrag");

  // Grenze: der am längsten nicht gehörte fliegt zuerst raus
  for (let i = 2; i <= 9; i++) {
    clock += 1000;
    await s.put("song" + i, lyr);
  }
  clock += 2 * DAY;
  assert.ok(await s.get("song2"), "noch da");
  await tick(); // der Zugriff auf song2 wird nachgetragen
  await s.prune();
  await tick();
  assert.equal(idb.rows.size, 5);
  assert.ok(idb.rows.has("song2"), "gerade gehört: bleibt");
  assert.ok(!idb.rows.has("song1|web|") && !idb.rows.has("song3"), "älteste sind weg");

  // abgelaufen: als „nicht mehr frisch“ geliefert (ohne Netz besser als nichts), drop entfernt
  await s.put("plain", { synced: false, lines: [{ t: 0, text: "la" }] });
  clock += 15 * DAY;
  assert.equal((await s.get("plain")).fresh, false);
  await s.drop("plain");
  await tick();
  assert.ok(!idb.rows.has("plain"));
  console.log("lyricstore: ok");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
