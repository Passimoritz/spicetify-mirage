// Vergleicht den Spotify-Nachbau der Tests (tests/e2e/fake-spotify.js) mit der installierten Spotify- und Spicetify-Version.
// Liest nur Dateien. Nach einem Spotify-Update ausführen: npm run check:spotify
//   node tools/check-spotify.js --xpui <Ordner>   ein frisch entpackter Client ohne Spicetify (nächtliche Prüfung auf GitHub):
//                                                 dann nur die Prüfungen am Client, die am Spicetify-Wrapper entfallen
//   node tools/check-spotify.js --port 9222       Port der Live-Prüfung (Spotify mit --remote-debugging-port gestartet)
// Dazu ein Bericht ohne Einfluss auf das Ergebnis: welche Schlüssel des Produktzustands
// (Spicetify.Platform.ProductStateAPI.getValues()) zum Filter für explizite Inhalte gehören könnten – im Client
// (alle Schlüssel mit „explicit“, die neben dem Produktzustand stehen) und, wenn Spotify mit offenem Debug-Port
// läuft, live aus getValues() selbst.
const fs = require("fs"), path = require("path"), http = require("http");

const arg = (name) => {
  const i = process.argv.indexOf("--" + name);
  return i > 0 ? process.argv[i + 1] : "";
};
const wrapperPath = path.join(process.env.LOCALAPPDATA || "", "spicetify", "jsHelper", "spicetifyWrapper.js");
const xpuiDir = arg("xpui") || path.join(process.env.APPDATA || "", "Spotify", "Apps", "xpui");
const hasWrapper = !arg("xpui") && fs.existsSync(wrapperPath);
if (arg("xpui") && !fs.existsSync(xpuiDir)) {
  // ausdrücklich genannter Ordner fehlt: das ist ein Fehler (CI), kein „nichts zu prüfen“
  console.error("Ordner aus --xpui nicht gefunden: " + xpuiDir);
  process.exit(2);
}
if (!fs.existsSync(xpuiDir) || (!arg("xpui") && !hasWrapper)) {
  console.log("Spotify oder Spicetify nicht gefunden, nichts zu prüfen.");
  process.exit(0);
}
const wrapper = hasWrapper ? fs.readFileSync(wrapperPath, "utf8") : "";
const files = fs.readdirSync(xpuiDir).filter((f) => /\.(js|css)$/.test(f));
const texts = new Map();
const read = (f) => {
  if (!texts.has(f)) texts.set(f, fs.readFileSync(path.join(xpuiDir, f), "utf8"));
  return texts.get(f);
};
const inClient = (text) => files.some((f) => read(f).includes(text));
// die genaue Version steht im Client selbst (seit 1.3 in xpui-modules.js)
const version = files.filter((f) => f.endsWith(".js")).map((f) => /clientVersion:"(\d+\.\d+\.\d+\.\d+\.g[0-9a-f]+)"/.exec(read(f))).find(Boolean)?.[1];
console.log(`Spotify ${version || "(Version unbekannt)"}${hasWrapper ? "" : " – ohne Spicetify, nur Prüfungen am Client"}\n`);

// so verhält sich der Nachbau (Stand: Spotify 1.3.10.2586, Spicetify 2.46.7); ändert sich hier etwas, muss er angepasst werden.
// Ein „W:“ vorne heißt: prüft den Spicetify-Wrapper (entfällt mit --xpui)
const CHECKS = [
  ["W:setMute klickt auf .volume-bar__icon-button", () => wrapper.includes('setMute:e=>{e!==Spicetify.Player.getMute()&&document.querySelector(".volume-bar__icon-button")?.click()}')],
  ["diesen Knopf gibt es im Client nicht (darum Lautstärke statt setMute)", () => !inClient("volume-bar__icon-button")],
  ["W:getMute liest die Lautstärke", () => wrapper.includes("getMute:()=>Spicetify.Player.getVolume()===0")],
  ["W:getVolume liest PlaybackAPI._volume", () => wrapper.includes("getVolume:()=>Spicetify.Platform.PlaybackAPI._volume")],
  ["W:setVolume geht an PlaybackAPI.setVolume", () => wrapper.includes("setVolume:e=>{Spicetify.Platform.PlaybackAPI.setVolume(e)}")],
  // seit 1.3.10: setVolume schickt nur an den Dienst (mit source und connectLoggingParams), der neue Wert kommt erst
  // über subVolume zurück; _volume ist ein Getter/Setter um __volume, der Setter meldet sich beim MuteHelper
  ["PlaybackAPI.setVolume schickt nur an den Dienst", () => inClient("async setVolume(e){this._playbackService.setVolume({source:") && inClient("volume:e,connectLoggingParams:void 0})}")],
  ["PlaybackAPI._volume ist Getter/Setter um __volume", () => inClient("get _volume(){return this.__volume}set _volume(e){this._muteHelper.onVolumeChange(e),this.__volume=e}")],
  ["der neue Wert kommt über subVolume", () => inClient("this._playbackService.subVolume({},") && inClient("this._isVolumeAdjustable&&(this._volume=t)")],
  ["MuteHelper: Lautstärke 0 heißt stumm, merkt sich die letzte", () => inClient("onVolumeChange(e){0!==e&&(this._volumeBehindMute=e),this.setMuted(0===e)}")],
  ["getVolume() der PlaybackAPI ist async und liefert -1 ohne regelbares Gerät", () => inClient("async getVolume(){return this.getVolumeInternal()}") && inClient("getVolumeInternal(){return this._isAvailable&&this._isVolumeAdjustable?this._volume:-1}")],
  ["W:Queue ist origin._queue._state ?? _queue._queue", () => wrapper.includes("Spicetify.Player.origin?._queue?._state??Spicetify.Player.origin?._queue?._queue")],
  ["die Warteschlange hat _queue und kein _state", () => inClient("_queue=null;_queueState;") && !inClient("_queue=null;_queueState;_state")],
  ["W:next ruft skipToNext", () => wrapper.includes("next:()=>{Spicetify.Player.origin.skipToNext()}")],
  ["W:seek behandelt Kommazahlen von 0 bis 1 als Anteil", () => wrapper.includes("!Number.isInteger(e)&&e>=0&&e<=1?Math.round(e*Spicetify.Player.origin._state.duration):e")],
  ["W:play ruft resume, pause ruft pause", () => wrapper.includes("play:()=>{Spicetify.Player.origin.resume()}") && wrapper.includes("pause:()=>{Spicetify.Player.origin.pause()}")],
  ["W:getProgress rechnet aus timestamp und positionAsOfTimestamp", () => wrapper.includes("(e.isPaused?0:Date.now()-e.timestamp)+e.positionAsOfTimestamp")],
];
// Stellen, die die Hintergrundfarbe als Schrift nutzen: bei Mirage durchsichtig, darum in user.css einzeln behandelt
const HANDLED = [".Psc6sReKFsPXwnz1kvAR", ".MhQ4IslqUKbPFP5sNq10", ".POWlFlLUUtmA_JBtM3Wo", "._ZnH9lmh923t4tl8cMA3", ".lZy6JZ8BZVFg6777c7tA"];
const usesBg = new Set();
for (const f of files.filter((x) => x.endsWith(".css"))) {
  // user.css und colors.css legt Spicetify dazu, die gehören nicht zu Spotify
  if (/^(user|colors)\.css$/.test(f)) continue;
  for (const m of read(f).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    // alle Encore-Flächenfarben, die Mirage durchsichtig oder fast durchsichtig macht (user.css, .encore-dark-theme)
    if (/(^|;)color:var\(--background-(base|press|highlight|tinted-base|tinted-highlight)\)/.test(m[2])) m[1].split(",").forEach((x) => usesBg.add(x.trim()));
  }
}
const fresh = [...usesBg].filter((x) => !HANDLED.includes(x));
CHECKS.push([`keine neue Schrift in Hintergrundfarbe${fresh.length ? ": " + fresh.join(", ") : ""}`, () => !fresh.length]);
let bad = 0;
for (const [label, test] of CHECKS) {
  const name = label.replace(/^W:/, "");
  if (name !== label && !hasWrapper) {
    console.log(`-      ${name} (braucht Spicetify)`);
    continue;
  }
  const pass = !!test();
  if (!pass) bad++;
  console.log(`${pass ? "ok    " : "ANDERS"} ${name}`);
}
console.log(bad ? `\n${bad} Abweichung(en): tests/e2e/fake-spotify.js und die Spiele prüfen.` : "\nDer Nachbau passt zu dieser Version.");

/* ---- Filter für explizite Inhalte: Schlüssel im Produktzustand (nur Bericht, ändert das Ergebnis nicht) */
// Im Client: Zeichenketten mit „explicit“, die wie ein Schlüssel aussehen (keine Übersetzungs-Schlüssel mit Punkt)
// und neben dem Produktzustand stehen (productState, ProductState, getValues, „static identifier=“ der Einstellungen)
const PS_NEAR = /productState|ProductState|product_state|getValues|static identifier=/;
function explicitInClient() {
  const keys = new Map();
  for (const f of files.filter((x) => x.endsWith(".js"))) {
    const text = read(f);
    for (const m of text.matchAll(/["']([a-z0-9_-]*explicit[a-z0-9_-]*)["']/gi)) {
      const k = m[1];
      if (k.toLowerCase() === "explicit") continue;
      const near = PS_NEAR.test(text.slice(Math.max(0, m.index - 200), m.index + 200));
      const e = keys.get(k) || { n: 0, near: false };
      keys.set(k, { n: e.n + 1, near: e.near || near });
    }
  }
  return keys;
}
// Live: Spotify mit --remote-debugging-port, getValues() über das DevTools-Protokoll (nur lesen)
function getJson(url, ms) {
  return new Promise((ok) => {
    const req = http.get(url, { timeout: ms }, (res) => {
      let s = "";
      res.on("data", (d) => (s += d));
      res.on("end", () => {
        try {
          ok(JSON.parse(s));
        } catch {
          ok(null);
        }
      });
    });
    req.on("timeout", () => req.destroy());
    req.on("error", () => ok(null));
  });
}
async function explicitLive(port) {
  const pages = await getJson(`http://127.0.0.1:${port}/json`, 800);
  const page = (pages || []).find((p) => p.type === "page" && /xpui/.test(p.url || "") && p.webSocketDebuggerUrl);
  if (!page) return null;
  const WS = globalThis.WebSocket || require("ws");
  const ws = new WS(page.webSocketDebuggerUrl);
  const expr = `(async () => {
    const api = window.Spicetify?.Platform?.ProductStateAPI;
    if (!api?.getValues) return { missing: true };
    const v = (await api.getValues()) || {};
    return { total: Object.keys(v).length, hits: Object.fromEntries(Object.entries(v).filter(([k]) => /explicit/i.test(k))) };
  })()`;
  return new Promise((ok) => {
    const t = setTimeout(() => (ws.close(), ok({ error: "keine Antwort" })), 5000);
    ws.onopen = () => ws.send(JSON.stringify({ id: 1, method: "Runtime.evaluate", params: { expression: expr, awaitPromise: true, returnByValue: true } }));
    ws.onerror = () => (clearTimeout(t), ok({ error: "Verbindung fehlgeschlagen" }));
    ws.onmessage = (ev) => {
      const msg = JSON.parse(String(ev.data));
      if (msg.id !== 1) return;
      clearTimeout(t);
      ws.close();
      ok(msg.result?.exceptionDetails ? { error: msg.result.exceptionDetails.text } : msg.result?.result?.value || { error: "leer" });
    };
  });
}
(async () => {
  console.log("\nFilter für explizite Inhalte (ProductStateAPI.getValues()) – nur Bericht:");
  const found = [...explicitInClient()].sort((a, b) => b[1].near - a[1].near || a[0].localeCompare(b[0]));
  const near = found.filter(([, e]) => e.near);
  console.log(near.length ? `  im Client neben dem Produktzustand: ${near.map(([k]) => k).join(", ")}` : "  im Client: KEIN Schlüssel mit „explicit“ neben dem Produktzustand");
  const other = found.filter(([, e]) => !e.near).map(([k]) => k);
  if (other.length) console.log(`  weitere Kandidaten mit „explicit“: ${other.join(", ")}`);
  if (arg("xpui")) return;
  const port = Number(arg("port")) || 9222;
  const live = await explicitLive(port);
  if (!live) console.log(`  live: nicht geprüft (Spotify mit --remote-debugging-port=${port} starten)`);
  else if (live.error) console.log(`  live: nicht geprüft (${live.error})`);
  else if (live.missing) console.log("  live: Spicetify.Platform.ProductStateAPI.getValues fehlt");
  else {
    const hits = Object.entries(live.hits);
    console.log(hits.length ? `  live in getValues() (${live.total} Schlüssel): ${hits.map(([k, v]) => `${k} = ${JSON.stringify(v)}`).join(", ")}` : `  live: getValues() (${live.total} Schlüssel) hat KEINEN Schlüssel mit „explicit“`);
  }
})().finally(() => process.exit(bad ? 1 : 0));
