// Vergleicht den Spotify-Nachbau der Tests (tests/e2e/fake-spotify.js) mit der installierten Spotify- und Spicetify-Version.
// Liest nur Dateien. Nach einem Spotify-Update ausführen: npm run check:spotify
const fs = require("fs"), path = require("path");

const wrapperPath = path.join(process.env.LOCALAPPDATA || "", "spicetify", "jsHelper", "spicetifyWrapper.js");
const xpuiDir = path.join(process.env.APPDATA || "", "Spotify", "Apps", "xpui");
if (!fs.existsSync(wrapperPath) || !fs.existsSync(xpuiDir)) {
  console.log("Spotify oder Spicetify nicht gefunden, nichts zu prüfen.");
  process.exit(0);
}
const wrapper = fs.readFileSync(wrapperPath, "utf8");
const files = fs.readdirSync(xpuiDir).filter((f) => /\.(js|css)$/.test(f));
const inClient = (text) => files.some((f) => fs.readFileSync(path.join(xpuiDir, f), "utf8").includes(text));

// so verhält sich der Nachbau; ändert sich hier etwas, muss er angepasst werden
const CHECKS = [
  ["setMute klickt auf .volume-bar__icon-button", () => wrapper.includes('setMute:e=>{e!==Spicetify.Player.getMute()&&document.querySelector(".volume-bar__icon-button")?.click()}')],
  ["diesen Knopf gibt es im Client nicht (darum Lautstärke statt setMute)", () => !inClient("volume-bar__icon-button")],
  ["getMute liest die Lautstärke", () => wrapper.includes("getMute:()=>Spicetify.Player.getVolume()===0")],
  ["getVolume liest PlaybackAPI._volume", () => wrapper.includes("getVolume:()=>Spicetify.Platform.PlaybackAPI._volume")],
  ["setVolume geht an PlaybackAPI.setVolume", () => wrapper.includes("setVolume:e=>{Spicetify.Platform.PlaybackAPI.setVolume(e)}")],
  ["PlaybackAPI hat setVolume und _volume", () => inClient("async setVolume(e){this._playbackService.setVolume(") && inClient("this._volume=e")],
  ["Queue ist origin._queue._state ?? _queue._queue", () => wrapper.includes("Spicetify.Player.origin?._queue?._state??Spicetify.Player.origin?._queue?._queue")],
  ["die Warteschlange hat _queue und kein _state", () => inClient("_queue=null;_queueState;") && !inClient("_queue=null;_queueState;_state")],
  ["next ruft skipToNext", () => wrapper.includes("next:()=>{Spicetify.Player.origin.skipToNext()}")],
  ["seek behandelt Kommazahlen von 0 bis 1 als Anteil", () => wrapper.includes("!Number.isInteger(e)&&e>=0&&e<=1?Math.round(e*Spicetify.Player.origin._state.duration):e")],
  ["play ruft resume, pause ruft pause", () => wrapper.includes("play:()=>{Spicetify.Player.origin.resume()}") && wrapper.includes("pause:()=>{Spicetify.Player.origin.pause()}")],
  ["getProgress rechnet aus timestamp und positionAsOfTimestamp", () => wrapper.includes("(e.isPaused?0:Date.now()-e.timestamp)+e.positionAsOfTimestamp")],
];
// Stellen, die die Hintergrundfarbe als Schrift nutzen: bei Mirage durchsichtig, darum in user.css einzeln behandelt
const HANDLED = [".Psc6sReKFsPXwnz1kvAR", ".MhQ4IslqUKbPFP5sNq10", ".POWlFlLUUtmA_JBtM3Wo", ".avnj48VJ0oJ6tMx7lYZl.LCj7BdHyyr0Su0kPxcQq", "._ZnH9lmh923t4tl8cMA3", ".lZy6JZ8BZVFg6777c7tA"];
const usesBg = new Set();
for (const f of files.filter((x) => x.endsWith(".css"))) {
  for (const m of fs.readFileSync(path.join(xpuiDir, f), "utf8").matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    // alle Encore-Flächenfarben, die Mirage durchsichtig oder fast durchsichtig macht (user.css, .encore-dark-theme)
    if (/(^|;)color:var\(--background-(base|press|highlight|tinted-base|tinted-highlight)\)/.test(m[2])) m[1].split(",").forEach((x) => usesBg.add(x.trim()));
  }
}
const fresh = [...usesBg].filter((x) => !HANDLED.includes(x));
CHECKS.push([`keine neue Schrift in Hintergrundfarbe${fresh.length ? ": " + fresh.join(", ") : ""}`, () => !fresh.length]);
let bad = 0;
for (const [name, test] of CHECKS) {
  const pass = !!test();
  if (!pass) bad++;
  console.log(`${pass ? "ok    " : "ANDERS"} ${name}`);
}
console.log(bad ? `\n${bad} Abweichung(en): tests/e2e/fake-spotify.js und die Spiele prüfen.` : "\nDer Nachbau passt zur installierten Version.");
process.exit(bad ? 1 : 0);
