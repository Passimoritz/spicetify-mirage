// node tests/unit/photos.test.js
// Foto-Wand: Stücke, Zusammensetzen, Prüfsumme, Zeitlimit und Grenzen (src/photos.js)
const assert = require("assert");

const { load } = require("./load.js");
const { PHOTO, makeChunks, createAssembler, createLimiter, hashOf, toB64, fromB64 } = load("photos.js");

// ein „JPEG“: richtige Anfangs- und Endmarke, dazwischen Zufall (zum Zusammensetzen reicht das)
let seed = 11;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
function jpeg(n) {
  const u = new Uint8Array(n);
  for (let i = 0; i < n; i++) u[i] = Math.floor(rnd() * 256);
  u.set([0xff, 0xd8, 0xff, 0xe0]);
  u[n - 2] = 0xff;
  u[n - 1] = 0xd9;
  return u;
}
const shuffle = (a) => a.map((x) => [rnd(), x]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);

(async () => {
  // Base64 hin und zurück, auch über die 8-KB-Schritte hinweg
  const big = jpeg(50000);
  assert.deepStrictEqual(fromB64(toB64(big)), big);
  assert.match(await hashOf(big), /^[\w-]{43}$/);

  // Größe: auch das größte erlaubte Foto passt in wenige Stücke, jede Nachricht (verschlüsselt, mit allen
  // Feldern wie vom Handy) bleibt deutlich unter 32 KB
  const max = await makeChunks(jpeg(PHOTO.MAX_BYTES), "abcdefghij");
  assert.ok(max.length <= PHOTO.MAX_CHUNKS, `${max.length} Stücke`);
  for (const m of max) {
    const wire = JSON.stringify({ v: 1, id: "x".repeat(24), s: Date.now(), ...m, nm: "ÄÖÜ".repeat(7), c: 9 });
    const bytes = Buffer.byteLength(wire) + 12 + 16;
    assert.ok(bytes < 32 * 1024 - 1024, `Nachricht ${bytes} Bytes`);
    assert.ok(m.d.length <= PHOTO.CHUNK && m.d.length % 4 === 0 || m.i === m.n - 1);
  }

  // Zusammensetzen: durcheinander, mit Kopien – genau einmal fertig, mit denselben Bytes
  {
    const asm = createAssembler(), parts = await makeChunks(big, "photo01");
    const copies = shuffle([...parts, ...parts, parts[0]]);
    const res = [];
    for (const m of copies) res.push(await asm.add("guestA", m));
    const done = res.filter((r) => r.st === "done");
    assert.strictEqual(done.length, 1, "genau einmal fertig");
    assert.deepStrictEqual(done[0].bytes, big);
    assert.ok(res.filter((r) => r.st === "part").length >= parts.length - 1);
    assert.ok(res.some((r) => r.st === "part" && r.first), "der erste Treffer meldet einen neuen Satz");
    assert.strictEqual((await asm.add("guestA", parts[0])).st, "dup", "späte Kopie: nur bestätigen");
    assert.strictEqual(asm.open.size, 0);
    // derselbe Satz von einem anderen Gast ist ein eigener
    for (const m of parts.slice(0, -1)) assert.strictEqual((await asm.add("guestB", m)).st, "part");
  }

  // Prüfsumme: ein verändertes Stück fliegt auf, der Satz ist verworfen
  {
    const asm = createAssembler(), parts = await makeChunks(big, "photo02");
    const bad = parts.map((m) => ({ ...m }));
    bad[1].d = (bad[1].d[0] === "A" ? "B" : "A") + bad[1].d.slice(1);
    let last;
    for (const m of bad) last = await asm.add("g", m);
    assert.strictEqual(last.st, "bad");
    // falsche Prüfsumme bei richtigen Daten
    const wrong = parts.map((m) => ({ ...m, h: "A".repeat(43) }));
    for (const m of wrong) last = await asm.add("g2", m);
    assert.strictEqual(last.st, "bad");
    // ein Stück mit anderer Anzahl oder Prüfsumme mitten im Satz: weg damit
    const asm2 = createAssembler();
    assert.strictEqual((await asm2.add("g", parts[0])).st, "part");
    assert.strictEqual((await asm2.add("g", { ...parts[1], n: parts[1].n + 1 })).st, "bad");
    assert.strictEqual(asm2.open.size, 0);
  }

  // kaputte Stücke werden gar nicht erst gesammelt
  {
    const asm = createAssembler(), [m] = await makeChunks(jpeg(30000), "photo03");
    const cases = [
      { ...m, p: "x" }, { ...m, p: "../../etc" }, { ...m, h: "short" }, { ...m, n: 0 }, { ...m, n: PHOTO.MAX_CHUNKS + 1 }, { ...m, n: 2.5 },
      { ...m, i: -1 }, { ...m, i: m.n }, { ...m, d: "" }, { ...m, d: 42 }, { ...m, d: "<script>" + m.d.slice(8) }, { ...m, d: m.d + "AAAA" },
      { ...m, i: 0, n: 3, d: m.d.slice(0, 400) }, null, {},
    ];
    for (const c of cases) assert.strictEqual((await asm.add("g", c)).st, "bad", JSON.stringify(c)?.slice(0, 80));
    assert.strictEqual(asm.open.size, 0);
  }

  // zu groß oder kein JPEG: verworfen, auch mit stimmender Prüfsumme
  {
    const asm = createAssembler();
    let r;
    for (const m of await makeChunks(jpeg(PHOTO.MAX_BYTES + 3000), "photo04")) r = await asm.add("g", m);
    assert.strictEqual(r.st, "bad", "zu groß");
    const png = jpeg(4000);
    png.set([0x89, 0x50, 0x4e, 0x47]);
    for (const m of await makeChunks(png, "photo05")) r = await asm.add("g", m);
    assert.strictEqual(r.st, "bad", "kein JPEG");
  }

  // Zeitlimit: ein halber Satz verfällt, später ankommende Reste setzen nichts mehr zusammen
  {
    let t = 0;
    const asm = createAssembler({ now: () => t }), parts = await makeChunks(big, "photo06");
    for (const m of parts.slice(0, -1)) await asm.add("g", m);
    assert.strictEqual(asm.open.size, 1);
    t += PHOTO.TIMEOUT + 1;
    asm.sweep();
    assert.strictEqual(asm.open.size, 0, "halber Satz ist weg");
    assert.strictEqual((await asm.add("g", parts[parts.length - 1])).st, "part", "der Rest allein ergibt kein Foto");
  }

  // je Gast ein offener Satz, insgesamt höchstens maxOpen
  {
    const asm = createAssembler({ maxOpen: 3 }), a = await makeChunks(big, "photo07"), b = await makeChunks(big, "photo08");
    await asm.add("g", a[0]);
    await asm.add("g", b[0]);
    assert.strictEqual(asm.open.size, 1, "der neue Satz ersetzt den alten desselben Gastes");
    for (const id of ["h1", "h2", "h3", "h4"]) await asm.add(id, a[0]);
    assert.strictEqual(asm.open.size, 3);
    asm.drop("h4", "photo07");
    assert.strictEqual(asm.open.size, 2);
    asm.clear();
    assert.strictEqual(asm.open.size, 0);
  }

  // Grenzen: 30 s je Gast, 5 je Party, Warteschlange voll, insgesamt gedrosselt
  {
    let t = 1e6;
    const lim = createLimiter({ now: () => t });
    assert.strictEqual(lim.check("a", 0).st, "go");
    lim.take("a");
    const slow = lim.check("a", 0);
    assert.strictEqual(slow.st, "slow");
    assert.ok(slow.w > 25 && slow.w <= 30, "Wartezeit in Sekunden: " + slow.w);
    t += PHOTO.GAP - 1000;
    assert.strictEqual(lim.check("a", 0).st, "slow");
    t += 1000;
    assert.strictEqual(lim.check("a", 0).st, "go");
    for (let i = 1; i < PHOTO.PER_GUEST; i++) {
      lim.take("a");
      t += PHOTO.GAP;
    }
    assert.deepStrictEqual(lim.check("a", 0), { st: "max", n: PHOTO.PER_GUEST });
    assert.strictEqual(lim.check("b", PHOTO.QUEUE).st, "full", "Warteschlange voll");
    // viele Gäste auf einmal: nach dem kurzen Schwall nur noch eines je REFILL
    const lim2 = createLimiter({ now: () => t });
    let ok = 0;
    for (let i = 0; i < 20; i++) if (lim2.check("x" + i, 0).st === "go") (lim2.take("x" + i), ok++);
    assert.strictEqual(ok, PHOTO.BURST);
    t += PHOTO.REFILL;
    assert.strictEqual(lim2.check("y", 0).st, "go");
    lim2.clear();
  }

  console.log("photos: ok");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
