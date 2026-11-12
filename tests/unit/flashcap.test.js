// node tests/unit/flashcap.test.js
const assert = require("assert");

const { load } = require("./load.js");

(() => {
  const { createFlashCap, FLASH_GAP } = load("flashcap.js");
  assert.ok(FLASH_GAP > 1 / 3, "Abstand muss über einer Drittelsekunde liegen");

  // jede Bildrate, jeder Auslöser in jedem Bild: nie mehr als 3 Blitze in einer Sekunde
  for (const fps of [24, 30, 60, 144, 1000]) {
    const cap = createFlashCap(), hits = [];
    for (let i = 0; i < fps * 20; i++) {
      const t = i / fps;
      if (cap.take(t)) hits.push(t);
    }
    assert.ok(hits.length > 20, "es blitzt überhaupt");
    for (let i = 0; i < hits.length; i++) {
      const n = hits.filter((h) => h >= hits[i] && h < hits[i] + 1).length;
      assert.ok(n <= 3, `${fps} fps: ${n} Blitze in einer Sekunde`);
    }
  }

  // zufällige Auslöser (Kick, Snare, Drop durcheinander)
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const cap = createFlashCap(), hits = [];
  for (let t = 0; t < 120; t += rnd() * 0.08) if (cap.take(t)) hits.push(t);
  for (let i = 1; i < hits.length; i++) assert.ok(hits[i] - hits[i - 1] >= FLASH_GAP);

  // Uhr springt zurück: kein Blitz direkt danach
  const c2 = createFlashCap();
  assert.equal(c2.take(100), true);
  assert.equal(c2.take(5), false);
  assert.equal(c2.take(5.2), false);
  assert.equal(c2.take(5.35), true);
  assert.equal(c2.free(5.5), false);
  assert.equal(c2.free(5.7), true);
  console.log("flashcap: ok");
})();
