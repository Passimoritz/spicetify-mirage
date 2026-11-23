// Große Datentabellen (Wörterbuch lexicon/*.json, Genre-Tabelle genre-map.js) liegen im Theme gepackt vor: tools/lazydata.js
// packt sie beim Bauen mit Deflate und schreibt sie als Base64-Text hinein. Ein langer Text ist für Spotify beim Start
// fast umsonst (kein riesiges Objekt-Literal zu übersetzen), und theme.js wird deutlich kleiner.
// Ausgepackt wird erst beim ersten Zugriff – synchron, damit jeder Aufrufer bleibt, wie er ist (DecompressionStream
// ginge nur mit await). lexicon.js wärmt das Wörterbuch einige Sekunden nach dem Start in Leerlaufzeiten vor.

/* ---- Inflate (RFC 1951, rohes Deflate ohne Kopf), nach dem Vorbild von zlibs puff.c */
const LBASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
const LEXT = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
const DBASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
const DEXT = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
const CLORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

// kanonischer Huffman-Code aus den Längen: count[len] und symbol (nach Länge sortiert) für den bitweisen Weg,
// dazu eine Tafel für alle Codes bis FB Bits (die nächsten FB Bits → Zeichen << 4 | Länge): fast jeder Code ist so kurz
const FB = 10;
function huff(lengths) {
  const count = new Uint16Array(16), offs = new Uint16Array(16), symbol = new Uint16Array(lengths.length);
  for (const l of lengths) count[l]++;
  count[0] = 0;
  for (let l = 1; l < 16; l++) offs[l] = offs[l - 1] + count[l - 1];
  for (let s = 0; s < lengths.length; s++) if (lengths[s]) symbol[offs[lengths[s]]++] = s;
  const fast = new Int32Array(1 << FB), next = new Uint16Array(16);
  for (let l = 1, code = 0; l < 16; l++) next[l] = code = (code + count[l - 1]) << 1;
  for (let s = 0; s < lengths.length; s++) {
    const l = lengths[s];
    if (!l) continue;
    const c = next[l]++;
    if (l > FB) continue;
    let r = 0;
    for (let i = 0; i < l; i++) r |= ((c >> i) & 1) << (l - 1 - i);
    for (let k = r; k < 1 << FB; k += 1 << l) fast[k] = (s << 4) | l;
  }
  return { count, symbol, fast };
}

export function inflateRaw(src, sizeHint = 0) {
  let out = new Uint8Array(sizeHint || src.length * 4), op = 0;
  let pos = 0, bitbuf = 0, bitcnt = 0;
  const need = (n) => {
    if (op + n <= out.length) return;
    const o = new Uint8Array(Math.max(out.length * 2, op + n));
    o.set(out);
    out = o;
  };
  const bits = (n) => {
    while (bitcnt < n) {
      if (pos >= src.length) throw new Error("inflate: Daten zu kurz");
      bitbuf |= src[pos++] << bitcnt;
      bitcnt += 8;
    }
    const v = bitbuf & ((1 << n) - 1);
    bitbuf >>>= n;
    bitcnt -= n;
    return v;
  };
  const decode = (h) => {
    // schnell über die Tafel (am Ende der Daten fehlende Bits zählen als 0 – genommen wird nur, was wirklich da ist)
    while (bitcnt < FB && pos < src.length) {
      bitbuf |= src[pos++] << bitcnt;
      bitcnt += 8;
    }
    const e = h.fast[bitbuf & ((1 << FB) - 1)];
    if (e && (e & 15) <= bitcnt) {
      bitbuf >>>= e & 15;
      bitcnt -= e & 15;
      return e >> 4;
    }
    let code = 0, first = 0, index = 0;
    for (let len = 1; len < 16; len++) {
      code |= bits(1);
      const c = h.count[len];
      if (code - c < first) return h.symbol[index + (code - first)];
      index += c;
      first = (first + c) << 1;
      code <<= 1;
    }
    throw new Error("inflate: ungültiger Code");
  };
  let fixedL = null, fixedD = null;
  let last = 0;
  while (!last) {
    last = bits(1);
    const type = bits(2);
    if (type === 0) {
      bitbuf = 0;
      bitcnt = 0;
      const len = src[pos] | (src[pos + 1] << 8);
      pos += 4;
      need(len);
      out.set(src.subarray(pos, pos + len), op);
      op += len;
      pos += len;
      continue;
    }
    let lh, dh;
    if (type === 1) {
      if (!fixedL) {
        const l = new Uint8Array(288);
        l.fill(8, 0, 144).fill(9, 144, 256).fill(7, 256, 280).fill(8, 280, 288);
        fixedL = huff(l);
        fixedD = huff(new Uint8Array(30).fill(5));
      }
      [lh, dh] = [fixedL, fixedD];
    } else if (type === 2) {
      const nlen = bits(5) + 257, ndist = bits(5) + 1, ncode = bits(4) + 4;
      const cl = new Uint8Array(19);
      for (let i = 0; i < ncode; i++) cl[CLORDER[i]] = bits(3);
      const ch = huff(cl);
      const lens = new Uint8Array(nlen + ndist);
      for (let i = 0; i < nlen + ndist; ) {
        const sym = decode(ch);
        if (sym < 16) lens[i++] = sym;
        else {
          let rep, val = 0;
          if (sym === 16) {
            val = lens[i - 1];
            rep = 3 + bits(2);
          } else rep = sym === 17 ? 3 + bits(3) : 11 + bits(7);
          lens.fill(val, i, i + rep);
          i += rep;
        }
      }
      lh = huff(lens.subarray(0, nlen));
      dh = huff(lens.subarray(nlen));
    } else throw new Error("inflate: ungültiger Block");
    for (;;) {
      let sym = decode(lh);
      if (sym < 256) {
        need(1);
        out[op++] = sym;
      } else if (sym === 256) break;
      else {
        sym -= 257;
        const len = LBASE[sym] + bits(LEXT[sym]);
        const ds = decode(dh);
        const dist = DBASE[ds] + bits(DEXT[ds]);
        need(len);
        for (let i = 0; i < len; i++, op++) out[op] = out[op - dist];
      }
    }
  }
  return out.subarray(0, op);
}

// Base64 → gepackte Bytes → Text (UTF-8)
export function unpack(b64, size) {
  const bin = atob(b64), src = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) src[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(inflateRaw(src, size));
}

// Objekt, das erst beim ersten Zugriff entsteht: liest sich wie das fertige Objekt (Schlüssel, Object.entries, in,
// Spread), make() läuft genau einmal. Nur lesen – Änderungen gehen an das fertige Objekt dahinter.
export function lazy(make) {
  let v = null;
  const get = () => (v ??= make());
  return new Proxy(
    {},
    {
      get: (_, k) => get()[k],
      has: (_, k) => k in get(),
      ownKeys: () => Reflect.ownKeys(get()),
      getOwnPropertyDescriptor: (_, k) => {
        const d = Reflect.getOwnPropertyDescriptor(get(), k);
        if (d) d.configurable = true;
        return d;
      },
      set: (_, k, val) => ((get()[k] = val), true),
      deleteProperty: (_, k) => delete get()[k],
      getPrototypeOf: () => Object.getPrototypeOf(get()),
    },
  );
}

// gepacktes JSON (vom Build-Plugin erzeugt)
export const lazyJSON = (b64, size) => lazy(() => JSON.parse(unpack(b64, size)));
