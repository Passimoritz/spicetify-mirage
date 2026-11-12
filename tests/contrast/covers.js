// Künstliche Cover (64 × 64 RGBA – genau die Größe, auf die das Theme jedes Cover vor dem Farbauszug verkleinert).
// Fester Zufall: jeder Lauf prüft dieselben Cover, ein Fehlschlag lässt sich über den Namen wiederfinden.
const N = 64;

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// eigene Umrechnung, damit die Cover nicht von dem Code abhängen, den sie prüfen
function hsl(h, s, l) {
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)].map((v) => Math.round(v * 255));
}
const hex = (c) => "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");

// paint(x, y) → [r, g, b]; noise streut jeden Kanal um ± noise (wie JPEG-Rauschen oder Korn)
function make(name, kind, paint, noise = 0, rand = null) {
  const px = new Uint8ClampedArray(N * N * 4);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const c = paint(x, y);
      const i = (y * N + x) * 4;
      for (let k = 0; k < 3; k++) px[i + k] = c[k] + (noise ? (rand() - 0.5) * 2 * noise : 0);
      px[i + 3] = 255;
    }
  }
  return { name, kind, px };
}
const flat = (c) => () => c;

function covers() {
  const out = [];
  const r = rng(20261112);
  const add = (kind, name, paint, noise) => out.push(make(`${kind}: ${name}`, kind, paint, noise, r));

  // Reinweiß, Reinschwarz, Graustufen (auch verrauscht)
  add("weiß", "rein", flat([255, 255, 255]));
  add("schwarz", "rein", flat([0, 0, 0]));
  for (let v = 0; v <= 255; v += 5) add("grau", `Stufe ${v}`, flat([v, v, v]));
  for (let v = 16; v <= 240; v += 16) add("grau", `Stufe ${v} mit Korn`, flat([v, v, v]), 10);

  // einzelne satte Farbtöne rund um den Farbkreis, in mehreren Sättigungen und Helligkeiten
  for (let h = 0; h < 360; h += 3) {
    for (const [s, l] of [[1, 0.5], [0.85, 0.4], [0.7, 0.6], [1, 0.3], [0.6, 0.5]]) {
      add("Farbton", `h${h} s${s} l${l} ${hex(hsl(h, s, l))}`, flat(hsl(h, s, l)));
    }
  }
  // Pastell
  for (let h = 0; h < 360; h += 4) {
    for (const [s, l] of [[0.45, 0.85], [0.7, 0.88], [0.3, 0.78]]) {
      add("Pastell", `h${h} s${s} l${l} ${hex(hsl(h, s, l))}`, flat(hsl(h, s, l)));
    }
  }
  // Neon: voll gesättigt und hell, als Fläche und als Streifen auf Schwarz
  for (let h = 0; h < 360; h += 4) {
    const c = hsl(h, 1, 0.55 + (h % 3) * 0.05);
    add("Neon", `h${h} Fläche ${hex(c)}`, flat(c));
    add("Neon", `h${h} Streifen auf Schwarz ${hex(c)}`, (x, y) => (y % 16 < 5 ? c : [0, 0, 0]));
  }
  // fast farblos: genau um die Schwellen 0.08 und 0.12, ab denen das Theme ein Cover als grau behandelt
  for (let h = 0; h < 360; h += 12) {
    for (const s of [0.06, 0.09, 0.11, 0.13, 0.16]) {
      for (const l of [0.25, 0.5, 0.75]) add("fast grau", `h${h} s${s} l${l} ${hex(hsl(h, s, l))}`, flat(hsl(h, s, l)));
    }
  }
  // zwei Farben nebeneinander (hälftig, 80/20, diagonal)
  for (let i = 0; i < 300; i++) {
    const c1 = hsl(r() * 360, 0.4 + r() * 0.6, 0.2 + r() * 0.6);
    const c2 = hsl(r() * 360, 0.4 + r() * 0.6, 0.2 + r() * 0.6);
    const cut = [32, 51, 13][i % 3];
    const diag = i % 4 === 3;
    add("zwei Farben", `${hex(c1)} / ${hex(c2)} Teilung ${cut}${diag ? " diagonal" : ""}`, (x, y) => ((diag ? (x + y) / 2 : x) < cut ? c1 : c2));
  }
  // kontrastarme Paare: fast gleicher Farbton und fast gleiche Helligkeit
  for (let i = 0; i < 200; i++) {
    const h = r() * 360, s = 0.2 + r() * 0.8, l = 0.1 + r() * 0.8;
    const c1 = hsl(h, s, l);
    const c2 = hsl((h + 20 + r() * 25) % 360, s, Math.min(0.95, Math.max(0.05, l + (r() - 0.5) * 0.1)));
    add("kontrastarm", `${hex(c1)} / ${hex(c2)}`, (x, y) => ((x >> 3) + (y >> 3)) % 2 ? c1 : c2, 4);
  }
  // Hauttöne (Porträt-Cover): von sehr hell bis sehr dunkel, mit dunklem oder hellem Rand
  const skin = [[255, 224, 196], [241, 194, 160], [224, 172, 135], [198, 134, 94], [161, 102, 68], [120, 72, 46], [84, 50, 32], [58, 36, 26]];
  for (const base of skin) {
    for (let v = 0; v < 12; v++) {
      const tone = base.map((c) => Math.max(0, Math.min(255, c + (r() - 0.5) * 24)));
      const edge = v % 3 === 0 ? [12, 10, 10] : v % 3 === 1 ? [238, 234, 228] : tone.map((c) => c * 0.55);
      add("Hautton", `${hex(tone.map(Math.round))} Rand ${hex(edge.map(Math.round))}`, (x, y) => (Math.hypot(x - 32, y - 30) < 20 ? tone : edge), 6);
    }
  }
  // sehr dunkel mit EINEM hellen Fleck
  for (let h = 0; h < 360; h += 5) {
    for (const size of [2, 5, 10]) {
      const spot = hsl(h, 1, 0.6);
      const bg = hsl((h + 180) % 360, 0.3, 0.03);
      add("dunkel + Fleck", `h${h} Fleck ${size * 2}px ${hex(spot)}`, (x, y) => (Math.abs(x - 44) < size && Math.abs(y - 20) < size ? spot : bg));
    }
  }
  // sehr hell mit einem dunklen oder farbigen Fleck (weiße Cover mit Logo)
  for (let h = 0; h < 360; h += 10) {
    const spot = hsl(h, 0.9, 0.35);
    add("hell + Fleck", `h${h} ${hex(spot)}`, (x, y) => (Math.hypot(x - 32, y - 32) < 7 ? spot : [250, 250, 248]));
  }
  // Verläufe und „Fotos“: mehrere weiche Farbflecken mit Korn
  for (let i = 0; i < 200; i++) {
    const blobs = Array.from({ length: 2 + (i % 4) }, () => ({ x: r() * N, y: r() * N, c: hsl(r() * 360, r(), 0.1 + r() * 0.8), w: 8 + r() * 30 }));
    add("Foto", `Nr. ${i} ${blobs.map((b) => hex(b.c)).join(" ")}`, (x, y) => {
      let sum = 0;
      const acc = [0, 0, 0];
      for (const b of blobs) {
        const w = Math.exp(-((x - b.x) ** 2 + (y - b.y) ** 2) / (2 * b.w * b.w)) + 1e-4;
        sum += w;
        for (let k = 0; k < 3; k++) acc[k] += b.c[k] * w;
      }
      return acc.map((v) => v / sum);
    }, 8);
  }
  return out;
}

module.exports = { covers, hsl, hex };
