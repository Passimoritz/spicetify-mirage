// node tests/unit/tempo.test.js
// Tempo aus der Hörprobe (tempo.js), Treffer-Auswahl bei Deezer/iTunes (sources.js) und die Genre-Wahl aus
// mehreren Quellen mit Sicherheit (genres.js pickGenre) – alles ohne Netz, auf künstlichen Signalen.
const assert = require("assert");
const { load } = require("./load.js");
const { analyzePcm, tempoFromEnvelope, foldBpm } = load("tempo.js");
const { pickGenre, pickProfile } = load("genres.js");

// ---- künstliche Hörproben: Kick, Snare, Hi-Hats auf einem Raster (22 050 Hz, 30 s), etwas Rauschen
const SR = 22050;
function drums(bpm, { swing = false, seconds = 30, hats = true } = {}) {
  const pcm = new Float32Array(SR * seconds), P = 60 / bpm;
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  const hit = (t, f, dec, amp, noise) => {
    const i0 = Math.round(t * SR);
    for (let i = 0; i < SR * 0.25 && i0 + i < pcm.length; i++) {
      const tt = i / SR, env = Math.exp(-tt * dec);
      pcm[i0 + i] += amp * env * (noise ? rnd() : Math.sin(2 * Math.PI * f * tt));
    }
  };
  for (let b = 0; b * P < seconds; b++) {
    const t = b * P;
    if (b % 2 === 0) hit(t, 55, 18, 0.8, false); // Kick auf 1 und 3
    else hit(t, 0, 30, 0.45, true); // Snare auf 2 und 4
    // Hi-Hats auf den Achteln – mit Swing (Triolen-Gefühl) auf 2/3 des Schlags
    if (hats) for (const k of [0, swing ? 2 / 3 : 0.5]) hit(t + k * P, 0, 90, 0.12, true);
  }
  for (let i = 0; i < pcm.length; i++) pcm[i] += 0.01 * rnd();
  return pcm;
}
const close = (a, b, tol = 0.03) => Math.abs(a / b - 1) < tol;

(async () => {
  for (const bpm of [92, 100, 124, 128, 140]) {
    const r = await analyzePcm(drums(bpm), SR);
    assert.ok(close(foldBpm(r.bpm), foldBpm(bpm)), `${bpm} BPM gerade → ${r.bpm}`);
    assert.ok(r.conf > 0.3, `${bpm} BPM: sicher (${r.conf})`);
  }
  // Hip-Hop mit Swing: nicht das Triolen-Raster (4/3 des Tempos) nehmen
  {
    const r = await analyzePcm(drums(88, { swing: true }), SR);
    assert.ok(close(foldBpm(r.bpm), 88), `88 BPM mit Swing → ${r.bpm}`);
  }
  // Drum & Bass: 174 → gefaltet 87 (Party zählt über 150 ohnehin halb)
  {
    const r = await analyzePcm(drums(174), SR);
    assert.ok(close(foldBpm(r.bpm), 87), `174 BPM → ${r.bpm}`);
  }
  // Deezer-Tempo als Hinweis: in derselben Oktave gilt der genauere Deezer-Wert
  {
    const r = await analyzePcm(drums(120), SR, 120.4);
    assert.equal(r.bpm, 120.4, "Deezer-Tempo ±4 % → übernommen");
  }
  // Stille / zu kurz: kein Tempo, aber kein Absturz
  assert.equal((await analyzePcm(new Float32Array(SR * 30), SR)).bpm, 0, "Stille: kein Tempo");
  assert.equal(tempoFromEnvelope(new Float32Array(100), 86), null, "zu kurz: null");
  // Pausen werden abgewartet (Browser: kein Bild bleibt hängen)
  {
    let n = 0;
    await analyzePcm(drums(110, { seconds: 10 }), SR, 0, async () => n++);
    assert.ok(n >= 2, "pause() wird zwischendurch aufgerufen");
  }
  // Klangzahlen: laut und dicht gegen leise und spärlich
  {
    const busy = await analyzePcm(drums(128), SR), calm = drums(70, { hats: false }).map((v) => v * 0.05);
    const c = await analyzePcm(calm, SR);
    assert.ok(busy.feats.loud > c.feats.loud + 15, "Lautheit in dBFS");
    assert.ok(busy.feats.density > c.feats.density, "Einsatzdichte");
  }
  assert.equal(foldBpm(180), 90);
  assert.equal(foldBpm(60), 120);
  assert.equal(foldBpm(0), 0);

  // ---- Treffer-Auswahl (sources.js braucht Spicetify nur zur Laufzeit; die Auswahl ist rein)
  const { pickDeezer, pickApple, sameArtist, sameTitle } = load("srcmatch.js");
  assert.ok(sameArtist("Beyoncé", "Beyonce, JAY-Z") && !sameArtist("Adele", "Lady Gaga"));
  assert.ok(sameTitle("Hello (Remastered 2020)", "Hello") && sameTitle("One More Time - Radio Edit", "One More Time") && !sameTitle("Hello", "Hello Kitty"));
  const dz = [
    { id: 1, title: "Hello", artist: { name: "Lionel Richie" } },
    { id: 2, title: "Hello (Live)", artist: { name: "Adele" } },
    { id: 3, title: "Someone Like You", artist: { name: "Adele" } },
  ];
  assert.equal(pickDeezer(dz, "Hello", "Adele")?.id, 2, "Deezer: gleicher Künstler und Titel");
  assert.equal(pickDeezer(dz, "Skyfall", "Adele"), null, "Deezer: falscher Titel → kein Treffer (kein falsches Tempo)");
  const it = [
    { artistName: "Kendrick Lamar", trackName: "HUMBLE.", primaryGenreName: "Hip-Hop/Rap" },
    { artistName: "Kendrick Lamar", trackName: "Other", primaryGenreName: "Pop" },
    { artistName: "Someone Else", trackName: "HUMBLE.", primaryGenreName: "Rock" },
  ];
  assert.equal(pickApple(it, "HUMBLE.", "Kendrick Lamar"), "Hip-Hop/Rap", "iTunes: gleicher Titel zählt doppelt");
  assert.equal(pickApple(it, "X", "Nobody"), "", "iTunes: fremder Künstler zählt nicht");

  // ---- Genre aus mehreren Quellen, mit Sicherheit
  // ohne jeden Namen und ohne Hörprobe: Pop mit niedriger Sicherheit – nicht mehr „Rave“ nur wegen 125 BPM und laut
  {
    const r = pickGenre({ bpm: 125, loud: -5 });
    assert.equal(r.key, "pop", "125 BPM laut ohne Namen → Pop (früher Rave/House)");
    assert.ok(r.conf < 0.3, "unsicher");
    assert.equal(pickGenre({ bpm: 92, loud: -7 }).key, "pop", "92 BPM ohne Namen → Pop (früher Hip-Hop)");
    assert.equal(pickProfile([], 125, -5, "", 0).key, "pop", "alte Form genauso");
  }
  // Deezer-Album-Genre trägt, wenn Apple fehlt
  assert.equal(pickGenre({ deezer: ["Rap/Hip Hop"], bpm: 95, loud: -6 }).key, "bass");
  assert.equal(pickGenre({ deezer: ["Filme/Videospiele"], bpm: 100, loud: -8 }).key, "pop", "Soundtrack-Album sagt nichts über den Song");
  assert.equal(pickGenre({ deezer: ["Klassik"] }).key, "classical", "deutsche Deezer-Namen");
  assert.equal(pickGenre({ deezer: ["Metal"], bpm: 160, loud: -5 }).key, "metal");
  assert.equal(pickGenre({ deezer: ["Dance"], bpm: 126, loud: -6, minor: 0.1 }).key, "house");
  // Apple zählt mehr als ein Deezer-„Pop“ (Sammelschublade)
  assert.equal(pickGenre({ apple: "Hip-Hop/Rap", deezer: ["Pop"], bpm: 90, loud: -6 }).key, "bass");
  // Künstler- und Titelwörter
  assert.equal(pickGenre({ artist: "Berliner Philharmoniker", title: "Symphony No. 5" }).key, "classical");
  assert.equal(pickGenre({ artist: "Someone", title: "Song Name (Extended Mix)", bpm: 126, loud: -6 }).key, "house", "Extended Mix → elektronisch");
  assert.equal(pickGenre({ artist: "Lil Baby", title: "Drip" }).key, "bass");
  // sichere Wahl, wenn Quellen übereinstimmen
  assert.ok(pickGenre({ apple: "Rock", deezer: ["Rock"], bpm: 140, loud: -5 }).conf > 0.7, "Apple + Deezer einig → sicher");
  // Klang aus der Hörprobe ohne Namen: ganz leise und spärlich → ruhig
  assert.equal(pickGenre({ bpm: 70, loud: -20, sound: { loud: -30, density: 1, centroid: 900, kick: 0.2 } }).key, "chill");
  console.log("tempo: ok");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
