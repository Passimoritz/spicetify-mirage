/* ---------------------------------------------------------------- Song-Analysen auf der Platte */
// Die Taktdaten eines Songs ändern sich nie. In IndexedDB gemerkt ist ein Song beim nächsten Mal sofort
// bereit – auch nach einem Neustart und ohne Netz. Höchstens MAX Songs, der am längsten nicht gespielte
// fliegt zuerst raus. Fehlt IndexedDB oder ist sie gesperrt, läuft alles wie vorher (nur ohne Gedächtnis).
const NAME = "mirage-analysis", STORE = "analysis", MAX = 300, FORMAT = 1;

let dbP = null;
function open() {
  if (dbP) return dbP;
  dbP = new Promise((resolve) => {
    try {
      const req = indexedDB.open(NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "uri" }).createIndex("at", "at");
      req.onsuccess = () => resolve(req.result);
      req.onerror = req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbP;
}
// eine Anfrage als Promise; Fehler enden still mit null
const done = (req) => new Promise((resolve) => {
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => resolve(null);
});
// hängt die Datenbank, wartet der Songwechsel nicht darauf
const within = (p, ms) => Promise.race([p.catch(() => null), new Promise((r) => setTimeout(() => r(null), ms))]);

// Die Klangsegmente sind der dicke Brocken (rund 1000 je Song, je 12 Tonhöhen): als Zahlenfelder gepackt
// braucht ein Song etwa 40 kB statt 300 kB. Tonhöhen in 255 Stufen – feiner zeichnet der Visualizer nicht.
function pack(data) {
  const segs = data.segs || [], n = segs.length;
  const num = new Float32Array(n * 5), p = new Uint8Array(n * 12), hp = new Uint8Array(n);
  segs.forEach((s, i) => {
    num.set([s.t, s.l, s.b, s.f, s.k], i * 5);
    if (s.p?.length === 12) {
      hp[i] = 1;
      for (let k = 0; k < 12; k++) p[i * 12 + k] = Math.round(Math.max(0, Math.min(1, s.p[k])) * 255);
    }
  });
  return { ...data, segs: { n, num, p, hp } };
}
function unpack(d) {
  const { n, num, p, hp } = d.segs;
  const segs = [];
  for (let i = 0; i < n; i++) {
    const o = i * 5;
    segs.push({ t: num[o], l: num[o + 1], p: hp[i] ? Array.from(p.subarray(i * 12, i * 12 + 12), (v) => v / 255) : [], b: num[o + 2], f: num[o + 3], k: num[o + 4] });
  }
  return { ...d, segs };
}

async function read(uri) {
  const db = await open();
  if (!db) return null;
  const store = db.transaction(STORE, "readwrite").objectStore(STORE);
  const row = await done(store.get(uri));
  if (!row || row.f !== FORMAT || !row.data?.segs?.num) return null;
  // gerade gebraucht: rückt in der Reihenfolge wieder nach vorn
  store.put({ ...row, at: Date.now() });
  return unpack(row.data);
}
async function write(uri, data) {
  const db = await open();
  if (!db) return;
  const store = db.transaction(STORE, "readwrite").objectStore(STORE);
  store.put({ uri, at: Date.now(), f: FORMAT, data: pack(data) });
  const over = ((await done(store.count())) || 0) - MAX;
  if (over <= 0) return;
  // die ältesten zuerst raus
  let left = over;
  store.index("at").openKeyCursor().onsuccess = (e) => {
    const cur = e.target.result;
    if (!cur || left-- <= 0) return;
    store.delete(cur.primaryKey);
    cur.continue();
  };
}

const analysisDb = {
  get: (uri) => within(Promise.resolve().then(() => read(uri)), 600),
  put: (uri, data) => void Promise.resolve().then(() => write(uri, data)).catch(() => {}),
};

export { analysisDb, pack, unpack };
