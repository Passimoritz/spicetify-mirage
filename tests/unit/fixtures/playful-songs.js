// Erfundene, liedtext-typische Songs (keine echten Songtexte) für den verspielten Stil (lyricstyle.test.js):
// Party-Pop, Rap, Ballade, deutscher Pop und ein Club-Track. Je Teil [Art, Zeilen]; die Wortzeiten entstehen aus
// Silben und Tempo (Rap dicht, Ballade gedehnt, das letzte Wort einer Ballade-Zeile gehalten).
const SONGS = {
  party: {
    rate: 4.2,
    parts: [
      ["verse", ["Lights are low and the bass is loud", "I see you moving through the crowd", "Gold chains shining on the floor", "Baby I just want some more"]],
      ["pre", ["Hands up high, we never stop", "Turn it up until we drop"]],
      ["chorus", ["We set the night on fire", "Dancing higher and higher", "Your heart is beating like a drum", "Boom boom here we come"]],
      ["verse", ["Money falling like the rain", "Nobody here can feel the pain", "Spin me round and round again", "Party with my crazy friends"]],
      ["pre", ["Hands up high, we never stop", "Turn it up until we drop"]],
      ["chorus", ["We set the night on fire", "Dancing higher and higher", "Your heart is beating like a drum", "Boom boom here we come"]],
      ["bridge", ["When the morning light comes in", "I will whisper, let's begin"]],
      ["chorus", ["We set the night on fire", "Dancing higher and higher", "Your heart is beating like a drum", "Boom boom here we come", "(here we come)"]],
    ],
  },
  rap: {
    rate: 7.2,
    parts: [
      ["verse", ["Started from the bottom with a dream inside my pocket", "Every single night I'm on the grind and I can't stop it", "Diamonds on my wrist but I remember being broken", "Cold world, cold hearts, every door was never open", "Clock is ticking, time is money, money never sleeping", "Rain fall on the city while the sirens keep on screaming", "I don't fear the fire, I was born inside the flame", "Now they whisper when I walk in and they all know my name"]],
      ["chorus", ["We go up, up, never coming down", "Flying high above the town", "Crown on my head, I run this ground", "We go up, up, never coming down"]],
      ["verse", ["No time to waste, I'm moving fast down the highway", "Engines roaring, living life my way", "Stars in the ceiling of the car I bought my mama", "Heart of gold but I don't play around with drama", "Spinning like the world, I can't freeze, I can't fall", "Thunder in my chest, I'm standing ten feet tall", "Ghosts of yesterday, I left them in the dark", "Light it up, light it up, we're the spark"]],
      ["chorus", ["We go up, up, never coming down", "Flying high above the town", "Crown on my head, I run this ground", "We go up, up, never coming down"]],
    ],
  },
  ballad: {
    rate: 2.0,
    hold: true,
    parts: [
      ["verse", ["Snow is falling on the empty street", "I can hear the echo of your feet", "Every candle in the window burns", "Waiting here until my love returns"]],
      ["chorus", ["Hold me close before the night is gone", "Even in the dark you are my sun", "Tears are falling like the winter rain", "I will never feel this cold again"]],
      ["verse", ["Silence fills the room where we would dance", "Pictures of a long forgotten chance", "I still dream of flying next to you", "Over oceans, under skies of blue"]],
      ["chorus", ["Hold me close before the night is gone", "Even in the dark you are my sun", "Tears are falling like the winter rain", "I will never feel this cold again"]],
      ["bridge", ["Time keeps moving, but my heart stands still", "I don't need the stars, I never will"]],
      ["outro", ["Hold me close", "Hold me close"]],
    ],
  },
  deutsch: {
    rate: 3.6,
    lang: "de",
    parts: [
      ["verse", ["Die Straßen leer, der Regen fällt", "Ich such dich in der ganzen Welt", "Mein Herz schlägt laut in dieser Nacht", "Hab nie an Abschied gedacht"]],
      ["chorus", ["Wir fliegen hoch, wir fallen nicht", "Ein Feuer brennt in deinem Licht", "Tanz mit mir bis zum Morgen", "Vergiss die ganzen Sorgen"]],
      ["verse", ["Kein Geld der Welt kann das ersetzen", "Wir lachen über alle Grenzen", "Die Sterne über unserem Dach", "Ich lieg die ganze Nacht noch wach"]],
      ["chorus", ["Wir fliegen hoch, wir fallen nicht", "Ein Feuer brennt in deinem Licht", "Tanz mit mir bis zum Morgen", "Vergiss die ganzen Sorgen"]],
      ["bridge", ["Und wenn die Zeit stehen bleibt", "Flüster ich, was keiner schreibt"]],
      ["chorus", ["Wir fliegen hoch, wir fallen nicht", "Ein Feuer brennt in deinem Licht", "Tanz mit mir bis zum Morgen", "Vergiss die ganzen Sorgen"]],
    ],
  },
  club: {
    rate: 3.4,
    parts: [
      ["intro", ["Can you feel it", "Can you feel it"]],
      ["verse", ["Midnight in the city lights", "Everybody here tonight", "Body moving, feel the heat", "Lose yourself inside the beat"]],
      ["drop", ["JUMP!", "Shake it, shake it, shake it now", "Bass is dropping, take a bow", "JUMP!"]],
      ["verse", ["Neon colours on your skin", "Let the music pull you in", "Sweat is dripping from the walls", "Dancing till the curtain falls"]],
      ["drop", ["JUMP!", "Shake it, shake it, shake it now", "Bass is dropping, take a bow", "JUMP!"]],
      ["outro", ["Can you feel it", "Can you feel it"]],
    ],
  },
};

const VOW = /[aeiouyäöüáéíóú]+/gi;
const syl = (w) => Math.max(1, (w.match(VOW) || []).length);

// → { lines: [{ t, text }], words: [[{ text, a, b }]], kinds: [Art je Zeile], parts: [{ t0, kind }] (Sekunden) }
function build(name) {
  const S = SONGS[name];
  const lines = [], words = [], kinds = [], parts = [];
  let t = 4000;
  for (const [kind, ls] of S.parts) {
    parts.push({ t0: t / 1000 - 0.3, kind });
    for (const text of ls) {
      const toks = text.split(/\s+/);
      const ws = [];
      let a = t;
      toks.forEach((tx, k) => {
        let d = Math.round((syl(tx) * 1000) / S.rate);
        if (S.hold && k === toks.length - 1) d = Math.max(d, 1400);
        ws.push({ text: tx, a, b: a + d });
        a += d + 60;
      });
      lines.push({ t, text });
      words.push(ws);
      kinds.push(kind);
      t = a + (S.rate > 5 ? 200 : 700);
    }
    t += 2000;
  }
  return { lines, words, kinds, parts, lang: S.lang || "en" };
}

module.exports = { SONGS, build };
