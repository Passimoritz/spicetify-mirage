// Eigener Deflate-Packer (RFC 1951, roh) für tools/lazydata.js. Warum nicht zlib aus Node: dessen Ausgabe hängt von der
// zlib-Fassung (jede Node-Version bringt ihre mit) und sogar vom Prozessor ab (Chromiums zlib rechnet mit SIMD anders) –
// `npm run check` in der CI (Node 20) würde dann ein anderes theme.js bauen als auf dem eigenen Rechner. Dieser Packer
// ist reines JS ohne Zufall: gleiche Eingabe, gleiche Bytes. Ausgepackt wird mit src/lazydata.js (inflateRaw).
"use strict";

const LBASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
const LEXT = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
const DBASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
const DEXT = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
const CLORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

const lenSym = (len) => {
  let s = 0;
  while (s < 28 && LBASE[s + 1] <= len) s++;
  return s;
};
const distSym = (d) => {
  let s = 0;
  while (s < 29 && DBASE[s + 1] <= d) s++;
  return s;
};

// Huffman-Längen (höchstens maxBits) aus Häufigkeiten; feste Reihenfolge bei Gleichstand → immer dasselbe Ergebnis
function lengths(freq, maxBits) {
  const n = freq.length;
  let f = Array.from(freq);
  for (;;) {
    const nodes = [];
    for (let i = 0; i < n; i++) if (f[i]) nodes.push({ w: f[i], id: i, sym: i });
    const out = new Array(n).fill(0);
    if (nodes.length === 0) return out;
    if (nodes.length === 1) {
      out[nodes[0].sym] = 1;
      return out;
    }
    let next = n;
    const cmp = (a, b) => a.w - b.w || a.id - b.id;
    let list = nodes.sort(cmp);
    while (list.length > 1) {
      const [a, b] = [list[0], list[1]];
      const p = { w: a.w + b.w, id: next++, kids: [a, b] };
      list = list.slice(2);
      // einsortieren (stabil nach Gewicht, dann Nummer)
      let lo = 0, hi = list.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (cmp(list[mid], p) < 0) lo = mid + 1;
        else hi = mid;
      }
      list.splice(lo, 0, p);
    }
    let max = 0;
    const walk = (node, d) => {
      if (node.kids) for (const k of node.kids) walk(k, d + 1);
      else {
        out[node.sym] = d;
        if (d > max) max = d;
      }
    };
    walk(list[0], 0);
    if (max <= maxBits) return out;
    f = f.map((x) => (x ? Math.max(1, x >> 1) : 0));
  }
}

// kanonische Codes, bitweise umgedreht (Deflate schreibt Huffman-Codes vom höchsten Bit an)
function codes(lens) {
  const count = new Array(16).fill(0), next = new Array(16).fill(0);
  for (const l of lens) if (l) count[l]++;
  let code = 0;
  for (let b = 1; b < 16; b++) {
    code = (code + count[b - 1]) << 1;
    next[b] = code;
  }
  return lens.map((l) => {
    if (!l) return 0;
    let c = next[l]++, r = 0;
    for (let i = 0; i < l; i++, c >>= 1) r = (r << 1) | (c & 1);
    return r;
  });
}

function deflateRaw(input) {
  const src = input instanceof Uint8Array ? input : new Uint8Array(input);
  const out = [];
  let acc = 0, nacc = 0;
  const put = (v, n) => {
    acc |= v << nacc;
    nacc += n;
    while (nacc >= 8) {
      out.push(acc & 255);
      acc >>>= 8;
      nacc -= 8;
    }
  };
  // LZ77: Hash über 3 Bytes, Ketten bis 128 Schritte, gierig mit einem Schritt Vorschau (wie zlib „lazy“)
  const WIN = 32768, HBITS = 15, CHAIN = 128;
  const head = new Int32Array(1 << HBITS).fill(-1), prev = new Int32Array(src.length);
  const hash = (i) => (((src[i] << 10) ^ (src[i + 1] << 5) ^ src[i + 2]) & ((1 << HBITS) - 1));
  const insert = (i) => {
    if (i + 2 >= src.length) return;
    const h = hash(i);
    prev[i] = head[h];
    head[h] = i;
  };
  const find = (i) => {
    if (i + 2 >= src.length) return [0, 0];
    let best = 0, bestD = 0, p = head[hash(i)], steps = CHAIN;
    const max = Math.min(258, src.length - i);
    while (p >= 0 && i - p <= WIN && steps-- > 0) {
      if (src[p + best] === src[i + best]) {
        let l = 0;
        while (l < max && src[p + l] === src[i + l]) l++;
        if (l > best) {
          best = l;
          bestD = i - p;
          if (l === max) break;
        }
      }
      p = prev[p];
    }
    return best >= 3 ? [best, bestD] : [0, 0];
  };
  const tokens = []; // Literal: Zahl < 256; Treffer: [Länge, Abstand]
  for (let i = 0; i < src.length; ) {
    const [l, d] = find(i);
    if (l) {
      insert(i);
      const [l2] = find(i + 1);
      if (l2 > l) {
        tokens.push(src[i]);
        i++;
        continue;
      }
      tokens.push([l, d]);
      for (let k = 1; k < l; k++) insert(i + k);
      i += l;
    } else {
      insert(i);
      tokens.push(src[i]);
      i++;
    }
  }
  // Blöcke zu je 32 000 Zeichen, jeder mit eigenen Huffman-Tabellen
  const BLOCK = 32000;
  for (let b = 0; b < tokens.length || b === 0; b += BLOCK) {
    const part = tokens.slice(b, b + BLOCK), last = b + BLOCK >= tokens.length;
    const lf = new Array(286).fill(0), df = new Array(30).fill(0);
    for (const t of part) {
      if (typeof t === "number") lf[t]++;
      else {
        lf[257 + lenSym(t[0])]++;
        df[distSym(t[1])]++;
      }
    }
    lf[256] = 1;
    // mindestens zwei Abstands-Codes (manche Entpacker mögen einen einzelnen Code nicht)
    if (df.filter(Boolean).length < 2) (df[0] ||= 1), (df[1] ||= 1);
    const ll = lengths(lf, 15), dl = lengths(df, 15);
    let hlit = 286;
    while (hlit > 257 && !ll[hlit - 1]) hlit--;
    let hdist = 30;
    while (hdist > 1 && !dl[hdist - 1]) hdist--;
    // Längen der beiden Tabellen lauflängen-kodiert (16: Vorgänger wiederholen, 17/18: Nullen)
    const all = [...ll.slice(0, hlit), ...dl.slice(0, hdist)], rl = [];
    for (let i = 0; i < all.length; ) {
      const v = all[i];
      let run = 1;
      while (i + run < all.length && all[i + run] === v) run++;
      if (v === 0 && run >= 3) {
        const r = Math.min(run, 138);
        rl.push(r >= 11 ? [18, r - 11, 7] : [17, r - 3, 3]);
        i += r;
      } else if (v !== 0 && run >= 4) {
        rl.push([v]);
        const r = Math.min(run - 1, 6);
        rl.push([16, r - 3, 2]);
        i += 1 + r;
      } else {
        rl.push([v]);
        i++;
      }
    }
    const cf = new Array(19).fill(0);
    for (const x of rl) cf[x[0]]++;
    const cl = lengths(cf, 7), cc = codes(cl);
    let hclen = 19;
    while (hclen > 4 && !cl[CLORDER[hclen - 1]]) hclen--;
    put(last ? 1 : 0, 1);
    put(2, 2);
    put(hlit - 257, 5);
    put(hdist - 1, 5);
    put(hclen - 4, 4);
    for (let i = 0; i < hclen; i++) put(cl[CLORDER[i]], 3);
    for (const x of rl) {
      put(cc[x[0]], cl[x[0]]);
      if (x.length > 1) put(x[1], x[2]);
    }
    const lc = codes(ll), dc = codes(dl);
    for (const t of part) {
      if (typeof t === "number") put(lc[t], ll[t]);
      else {
        const ls = lenSym(t[0]), ds = distSym(t[1]);
        put(lc[257 + ls], ll[257 + ls]);
        if (LEXT[ls]) put(t[0] - LBASE[ls], LEXT[ls]);
        put(dc[ds], dl[ds]);
        if (DEXT[ds]) put(t[1] - DBASE[ds], DEXT[ds]);
      }
    }
    put(lc[256], ll[256]);
  }
  if (nacc) out.push(acc & 255);
  return Buffer.from(out);
}

module.exports = { deflateRaw };
