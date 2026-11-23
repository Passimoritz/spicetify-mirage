// Virtuelle Uhr für die Lichter-Tests (lights-*.test.js): Date.now, setTimeout und setInterval laufen nicht mehr mit
// der Wanduhr, sondern nur, wenn der Test sie weiterstellt. So hängt kein Ergebnis davon ab, wie schnell der Rechner
// gerade ist (CI unter Last: Zeitgeber kamen zu spät, Bildraten und Abstände schwankten).
//
// Die nachgebauten Geräte reden aber echt über 127.0.0.1 (HTTP, UDP, TCP). Darum wartet die Uhr nach jedem Schritt,
// bis im Netz Ruhe ist („settle“): keine offene HTTP-Anfrage, kein Verbindungsaufbau, und einige Runden der
// Ereignisschleife lang kein neues Ereignis an einem Socket. Erst dann feuert der nächste Zeitgeber. Echte Wartezeit
// kostet nur das Netz selbst – die Zeitlogik (Blitz-Schranke, 50 Bilder/s, Takt) ist auf die Millisekunde fest.
//
//   const clock = require("./lights-clock.js").install();   // vor dem Laden von overlay/*.js
//   await clock.sleep(400);            // 400 ms virtuelle Zeit (alle fälligen Zeitgeber der Reihe nach)
//   await clock.wait(lights.stopAll()); // auf ein Promise warten, das selbst Zeitgeber braucht
//   clock.now()                        // virtuelle Zeit (= Date.now())
const net = require("net"), dgram = require("dgram"), http = require("http");

let installed = null;
function install(start = 1_700_000_000_000) {
  if (installed) return installed;
  const real = { setTimeout, clearTimeout, setInterval, clearInterval, setImmediate, now: Date.now };
  let now = start, seq = 0, activity = 0, inflight = 0;
  const timers = new Map();
  const bump = () => activity++;

  // ---- Zeitgeber
  class Timer {
    constructor(fn, ms, args, every) {
      this.id = ++seq;
      this.fn = fn;
      this.args = args;
      this.every = every;
      this.at = now + Math.max(every ? 1 : 0, Number(ms) || 0);
      timers.set(this.id, this);
    }
    ref() { return this; }
    unref() { return this; }
    hasRef() { return true; }
    refresh() { this.at = now + Math.max(this.every ? 1 : 0, 0); timers.set(this.id, this); return this; }
    [Symbol.toPrimitive]() { return this.id; }
  }
  const clear = (t) => {
    if (t != null) timers.delete(typeof t === "object" ? t.id : Number(t));
  };
  globalThis.setTimeout = (fn, ms, ...args) => new Timer(fn, ms, args, 0);
  globalThis.setInterval = (fn, ms, ...args) => new Timer(fn, ms, args, Math.max(1, Number(ms) || 0));
  globalThis.clearTimeout = clear;
  globalThis.clearInterval = clear;
  Date.now = () => now;
  const next = () => {
    let best = null;
    for (const t of timers.values()) if (!best || t.at < best.at || (t.at === best.at && t.id < best.id)) best = t;
    return best;
  };
  const fire = (t) => {
    now = Math.max(now, t.at);
    if (t.every) t.at += t.every;
    else timers.delete(t.id);
    t.fn(...t.args);
  };

  // ---- Netz beobachten: jedes Socket-Ereignis zählt als Bewegung, offene Anfragen und Verbindungsaufbauten halten fest
  for (const C of [net.Socket, dgram.Socket]) {
    const emit0 = C.prototype.emit;
    C.prototype.emit = function (...a) {
      bump();
      return emit0.apply(this, a);
    };
  }
  const connect0 = net.Socket.prototype.connect;
  net.Socket.prototype.connect = function (...a) {
    if (!this.__clockConn) {
      this.__clockConn = true;
      inflight++;
      let open = true;
      const done = () => open && ((open = false), inflight--, bump());
      this.once("connect", done);
      this.once("close", done);
      this.once("error", done);
    }
    return connect0.apply(this, a);
  };
  const end0 = http.ClientRequest.prototype.end;
  http.ClientRequest.prototype.end = function (...a) {
    if (!this.__clockReq) {
      this.__clockReq = true;
      inflight++;
      this.once("close", () => (inflight--, bump()));
    }
    return end0.apply(this, a);
  };

  const immediate = () => new Promise((r) => real.setImmediate(r));
  const realSleep = (ms) => new Promise((r) => real.setTimeout(r, ms));
  // Ruhe im Netz: keine offene Anfrage, und QUIET Runden der Ereignisschleife ohne neues Socket-Ereignis
  const QUIET = 6;
  async function settle() {
    const t0 = real.now();
    let quiet = 0, seen = activity;
    while (quiet < QUIET) {
      if (inflight > 0 && real.now() - t0 < 10000) {
        await realSleep(1);
        quiet = 0;
        seen = activity;
        continue;
      }
      await immediate();
      if (activity !== seen) [seen, quiet] = [activity, 0];
      else quiet++;
    }
  }
  // ms virtuelle Zeit vergehen lassen: fällige Zeitgeber der Reihe nach, nach jedem Ruhe im Netz
  async function sleep(ms) {
    const target = now + Math.max(0, Number(ms) || 0);
    await settle();
    for (let t = next(); t && t.at <= target; t = next()) {
      fire(t);
      await settle();
    }
    now = target;
    await settle();
  }
  // auf p warten und dabei die Uhr von Zeitgeber zu Zeitgeber weiterstellen (höchstens limit ms virtuell)
  async function wait(p, limit = 120000) {
    let done = false;
    const q = Promise.resolve(p).finally(() => (done = true));
    q.catch(() => {});
    const end = now + limit, t0 = real.now();
    await settle();
    while (!done) {
      const t = next();
      if (t && t.at <= end) {
        fire(t);
        await settle();
      } else {
        if (real.now() - t0 > 20000) throw new Error("clock.wait: Promise wird nicht fertig (kein Zeitgeber mehr fällig)");
        await realSleep(2);
      }
    }
    return q;
  }
  installed = { sleep, wait, settle, now: () => now, pending: () => timers.size, real };
  return installed;
}

module.exports = { install };
