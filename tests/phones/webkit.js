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

async function launchWebkit(playwright) {
  const browser = await playwright.webkit.launch({ headless: true });

  async function open({ url, width, height, dpr, ua, lang, initScript }) {
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: dpr,
      isMobile: true,
      hasTouch: true,
      userAgent: ua,
      locale: lang,
    });
    if (initScript) await context.addInitScript(initScript);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push("Ausnahme: " + String(e.message).split("\n")[0]));
    page.on("console", (m) => m.type() === "error" && errors.push("console.error: " + m.text()));
    page.on("requestfailed", (r) => errors.push("Browser: " + r.url() + " " + (r.failure()?.errorText || "")));
    await page.goto(url, { waitUntil: "domcontentloaded" });
    return {
      errors,
      // als Text übergeben: Playwright wertet ihn wie die DevTools im Seitenkontext aus
      eval: (expression) => page.evaluate(expression),
      close: () => context.close(),
    };
  }
  return { name: "WebKit " + browser.version(), open, close: () => browser.close() };
}

module.exports = { loadPlaywright, launchWebkit };
