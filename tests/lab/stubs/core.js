// Attrappe für src/core.js im Testlabor: kein Spicetify, kein Fenster
export const S = (globalThis.__labS ||= {});
export const root = { classList: { toggle() {}, contains: () => false } };
export const VERSION = "lab";
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export function seek(arr, at, key) {
  let lo = 0, hi = arr.length - 1, r = -1;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    if (arr[m][key] <= at) {
      r = m;
      lo = m + 1;
    } else hi = m - 1;
  }
  return r;
}
export function lru(max) {
  const m = new Map();
  return {
    get: (k) => m.get(k),
    set(k, v) {
      m.delete(k);
      m.set(k, v);
      if (m.size > max) m.delete(m.keys().next().value);
    },
    has: (k) => m.has(k),
  };
}
export const guard = (n, fn) => fn();
