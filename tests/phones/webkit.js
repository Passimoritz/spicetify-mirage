// Treiber für WebKit (die Technik hinter Safari auf dem iPhone) über Playwright.
// Playwright ist absichtlich KEINE feste Abhängigkeit: fehlt es, meldet run.js das und überspringt diesen Teil.
// Einrichten: npm i -D playwright@1.49 && npx playwright install webkit   (in CI: siehe ci-snippet.yml)

function loadPlaywright() {
  try {
    return require("playwright");
  } catch {
    return null;
  }
}

// PHONES_LINUXLIKE=1: WebKit unter Windows hat kein Web Audio, das unter Linux (GitHub) und das iPhone schon.
// Dann ein stummer Ersatz-AudioContext (Uhr aus performance.now, Knoten ohne Ton) – so laufen dieselben Wege
// wie auf GitHub. Gibt nie einen Ton aus: es entsteht kein echter AudioContext.
const LINUXLIKE = `(() => {
  const t0 = performance.now();
  const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} });
  const node = () => ({ connect: (n) => n, disconnect() {}, start() {}, stop() {}, frequency: param(), gain: param(), type: "sine" });
  class StummerAC {
    constructor() { this.state = "suspended"; this.destination = node(); this.sampleRate = 48000; }
    get currentTime() { return (performance.now() - t0) / 1000; }
    createOscillator() { return node(); }
    createGain() { return node(); }
    resume() { this.state = "running"; return Promise.resolve(); }
    suspend() { this.state = "suspended"; return Promise.resolve(); }
    close() { this.state = "closed"; return Promise.resolve(); }
  }
  window.AudioContext = window.webkitAudioContext = StummerAC;
  delete Navigator.prototype.vibrate;
})();`;

async function launchWebkit(playwright) {
  const browser = await playwright.webkit.launch({ headless: true });
  const linuxlike = process.env.PHONES_LINUXLIKE === "1";

  async function open({ url, width, height, dpr, ua, lang, initScript }) {
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: dpr,
      isMobile: true,
      hasTouch: true,
      userAgent: ua,
      locale: lang,
    });
    // zuerst: ein Test, der Vibration nachbildet (Android), setzt sie in seinem eigenen Skript danach wieder
    if (linuxlike) await context.addInitScript(LINUXLIKE);
    // PHONES_SLOWFRAME=ms: das Bild kommt nur alle ms Millisekunden (wie eine Engine, die kaum zeichnet) – Uhren und Nachrichten laufen normal
    if (process.env.PHONES_SLOWFRAME) await context.addInitScript(`(() => { const R = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = (cb) => setTimeout(() => R(cb), ${Number(process.env.PHONES_SLOWFRAME)}); })();`);
    if (initScript) await context.addInitScript(initScript);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push("Ausnahme: " + String(e.message).split("\n")[0]));
    // Safari kennt die Viewport-Angabe interactive-widget nicht und meldet das als Fehler; andere Browser nutzen sie
    const HARMLESS = /Viewport argument key "interactive-widget" not recognized/;
    page.on("console", (m) => m.type() === "error" && !HARMLESS.test(m.text()) && errors.push("console.error: " + m.text()));
    page.on("requestfailed", (r) => errors.push("Browser: " + r.url() + " " + (r.failure()?.errorText || "")));
    await page.goto(url, { waitUntil: "domcontentloaded" });
    return {
      errors,
      // als Text übergeben: Playwright wertet ihn wie die DevTools im Seitenkontext aus
      eval: (expression) => page.evaluate(expression),
      close: () => context.close(),
    };
  }
  return { name: "WebKit " + browser.version() + (linuxlike ? " (wie Linux: stummes Web Audio, ohne Vibration)" : ""), open, close: () => browser.close() };
}

module.exports = { loadPlaywright, launchWebkit };
