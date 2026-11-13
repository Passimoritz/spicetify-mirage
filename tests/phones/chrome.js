// Treiber für ein installiertes Chrome oder Edge: startet es unsichtbar (headless), stumm und mit einem
// eigenen Wegwerf-Profil, und steuert es über das DevTools-Protokoll. Kein Playwright nötig.
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");

function findBrowser() {
  const env = process.env;
  const list = [
    env.CHROME_PATH,
    env.PROGRAMFILES && path.join(env.PROGRAMFILES, "Google/Chrome/Application/chrome.exe"),
    env["PROGRAMFILES(X86)"] && path.join(env["PROGRAMFILES(X86)"], "Google/Chrome/Application/chrome.exe"),
    env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, "Google/Chrome/Application/chrome.exe"),
    env["PROGRAMFILES(X86)"] && path.join(env["PROGRAMFILES(X86)"], "Microsoft/Edge/Application/msedge.exe"),
    env.PROGRAMFILES && path.join(env.PROGRAMFILES, "Microsoft/Edge/Application/msedge.exe"),
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/microsoft-edge",
  ];
  return list.find((p) => p && fs.existsSync(p)) || "";
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function launchChrome(exe, tmpRoot) {
  // eigenes Profil im Arbeitsordner: das Profil des Nutzers wird nie angefasst
  const profile = fs.mkdtempSync(path.join(tmpRoot, "profile-"));
  const child = spawn(
    exe,
    [
      "--headless=new",
      "--mute-audio",
      "--remote-debugging-port=0",
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--disable-sync",
      "--disable-component-update",
      "--disable-background-networking",
      // Kamera-Abfrage würde ohne Bildschirm ewig warten: gleich ablehnen, wie ein Gast, der „Nein“ tippt
      "--deny-permission-prompts",
      // kein Zugriff ins Internet: alles außer dem eigenen Rechner löst nicht auf
      "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1",
      ...(process.platform === "linux" ? ["--no-sandbox", "--disable-gpu"] : []),
      "about:blank",
    ],
    { stdio: "ignore", windowsHide: true },
  );
  let exited = false;
  child.on("exit", () => (exited = true));
  // Chrome schreibt Port und Adresse der Steuerverbindung in sein Profil
  const portFile = path.join(profile, "DevToolsActivePort");
  let wsUrl = "";
  for (let i = 0; i < 150 && !wsUrl; i++) {
    if (exited) throw new Error("Browser hat sich sofort beendet");
    try {
      const [port, p] = fs.readFileSync(portFile, "utf8").trim().split("\n");
      if (port && p) wsUrl = `ws://127.0.0.1:${port.trim()}${p.trim()}`;
    } catch {}
    if (!wsUrl) await sleep(100);
  }
  if (!wsUrl) {
    child.kill();
    throw new Error("Browser hat keine Steuerverbindung geöffnet");
  }
  const ws = new WebSocket(wsUrl, { perMessageDeflate: false });
  await new Promise((ok, no) => ws.once("open", ok).once("error", no));

  let seq = 0;
  const waiting = new Map(), listeners = new Map();
  ws.on("message", (raw) => {
    const m = JSON.parse(raw);
    if (m.id && waiting.has(m.id)) {
      const { ok, no } = waiting.get(m.id);
      waiting.delete(m.id);
      m.error ? no(new Error(m.error.message)) : ok(m.result);
    } else if (m.sessionId) listeners.get(m.sessionId)?.(m);
  });
  const send = (method, params = {}, sessionId) =>
    new Promise((ok, no) => {
      const id = ++seq;
      waiting.set(id, { ok, no });
      ws.send(JSON.stringify({ id, method, params, sessionId }));
    });
  const version = (await send("Browser.getVersion")).product;

  // Eine Seite wie auf einem Handy öffnen. Jede bekommt einen eigenen Kontext (eigener Speicher, wie ein frisches Gerät).
  async function open({ url, width, height, dpr, ua, lang, initScript }) {
    const { browserContextId } = await send("Target.createBrowserContext");
    const { targetId } = await send("Target.createTarget", { url: "about:blank", browserContextId });
    const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
    const cmd = (m, p) => send(m, p, sessionId);
    const errors = [];
    listeners.set(sessionId, (m) => {
      if (m.method === "Runtime.exceptionThrown") {
        const d = m.params.exceptionDetails;
        errors.push("Ausnahme: " + (d.exception?.description || d.text).split("\n")[0]);
      } else if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") {
        errors.push("console.error: " + m.params.args.map((a) => a.value ?? a.description ?? "").join(" "));
      } else if (m.method === "Log.entryAdded" && m.params.entry.level === "error") {
        errors.push("Browser: " + m.params.entry.text + (m.params.entry.url ? " (" + m.params.entry.url + ")" : ""));
      }
    });
    await cmd("Page.enable");
    await cmd("Runtime.enable");
    await cmd("Log.enable");
    await cmd("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: dpr, mobile: true, screenWidth: width, screenHeight: height });
    await cmd("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    await cmd("Emulation.setUserAgentOverride", { userAgent: ua, acceptLanguage: lang, platform: /iPhone/.test(ua) ? "iPhone" : "Linux armv81" });
    if (initScript) await cmd("Page.addScriptToEvaluateOnNewDocument", { source: initScript });
    await cmd("Page.navigate", { url });
    return {
      errors,
      // Steuerbefehle direkt (Messungen: CPU-Drosselung, Leistungswerte)
      cmd,
      async eval(expression) {
        const r = await cmd("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
        if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
        return r.result.value;
      },
      async close() {
        listeners.delete(sessionId);
        await send("Target.disposeBrowserContext", { browserContextId }).catch(() => {});
      },
    };
  }

  async function close() {
    await Promise.race([send("Browser.close").catch(() => {}), sleep(3000)]);
    for (let i = 0; i < 50 && !exited; i++) await sleep(100);
    // läuft er dann noch, hart beenden – kein Browser darf nach dem Test übrig bleiben
    if (!exited) child.kill();
    try {
      ws.terminate();
    } catch {}
    try {
      fs.rmSync(profile, { recursive: true, force: true, maxRetries: 20, retryDelay: 150 });
    } catch {}
  }
  return { name: version, open, close };
}

module.exports = { findBrowser, launchChrome };
