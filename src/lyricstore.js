/* ---------------------------------------------------------------- Liedtext-Speicher */
// Einmal geholte Liedtexte bleiben auf dem Gerät (IndexedDB): beim nächsten Mal stehen sie sofort da, auch ohne
// Netz. Höchstens 500 Songs – der am längsten nicht gehörte fliegt zuerst raus. Ohne IndexedDB (privates
// Fenster, gesperrter Speicher) tut der Speicher einfach nichts; der Liedtext kommt dann wie bisher aus dem Netz.
const MAX = 500, DAY = 864e5;
// Spotifys eigener zeitgenauer Text ändert sich kaum. Zeitgenaue Texte anderer Quellen gelten einen Monat
// (vielleicht hat Spotify bis dahin einen eigenen), einfacher Text und „Instrumental“ sind oft nur ein
// Notbehelf – nach zwei Wochen wird neu gesucht.
const KEEP_OWN = 180 * DAY, KEEP_SYNCED = 30 * DAY, KEEP_PLAIN = 14 * DAY;
const isFresh = (e, now) => !!e?.v && now - e.at0 < (!e.v.synced ? KEEP_PLAIN : e.v.source === "spotify" ? KEEP_OWN : KEEP_SYNCED);
// keys = alle Schlüssel, ältester Zugriff zuerst → die, die über der Grenze liegen
const surplus = (keys, max = MAX) => keys.slice(0, Math.max(0, keys.length - max));

function createLyricStore(idb, { now = Date.now, max = MAX } = {}) {
  const wait = (r) => new Promise((ok, no) => {
    r.onsuccess = () => ok(r.result);
    r.onerror = () => no(r.error);
  });
  let db = null, puts = 0;
  // einmal öffnen; geht es nicht, bleibt es für diese Sitzung dabei (kein Dauerfeuer an Fehlversuchen)
  const open = () => (db ||= new Promise((ok) => {
    try {
      const r = idb.open("mirage-lyrics", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("songs", { keyPath: "k" }).createIndex("at", "at");
      r.onsuccess = () => ok(r.result);
      r.onerror = r.onblocked = () => ok(null);
    } catch {
      ok(null);
    }
  }));
  const songs = async (mode) => (await open())?.transaction("songs", mode).objectStore("songs") || null;
  // → { v, fresh } oder null. Ein abgelaufener Eintrag wird trotzdem geliefert (fresh: false):
  // ohne Netz ist der alte Text besser als keiner
  async function get(key) {
    try {
      const st = await songs("readonly");
      const e = st && (await wait(st.get(key)));
      if (!e?.v) return null;
      // Zugriff merken (für „ältester fliegt zuerst“) – höchstens einmal am Tag, nicht bei jedem Abspielen schreiben
      if (now() - e.at > DAY) (await songs("readwrite"))?.put({ ...e, at: now() });
      return { v: e.v, fresh: isFresh(e, now()) };
    } catch {
      return null;
    }
  }
  async function put(key, v) {
    try {
      const st = await songs("readwrite");
      if (!st) return;
      await wait(st.put({ k: key, v, at0: now(), at: now() }));
      // nicht bei jedem Song aufräumen: alle zehn reicht, die Grenze ist weich
      if (puts++ % 10 === 0) await prune();
    } catch {}
  }
  async function prune() {
    const st = await songs("readwrite");
    if (!st) return;
    for (const k of surplus(await wait(st.index("at").getAllKeys()), max)) st.delete(k);
  }
  async function drop(key) {
    try {
      (await songs("readwrite"))?.delete(key);
    } catch {}
  }
  return { get, put, drop, prune };
}

export { createLyricStore, isFresh, surplus, MAX };
