// Handy-Seite (docs/live/) in echten Handy-Browsern: prüft alles, was ohne laufende Party geht und sich
// zwischen Browsern unterscheidet – Start-/Scan-Bild, toter Link, kaputter Link, Breite, Sprache, gesperrter Speicher.
// Aufruf: npm run test:phones            (--need-webkit: fehlendes Playwright/WebKit ist ein Fehler, für CI)
//
// Zwei Browser-Familien:
//  - Chromium: ein installiertes Chrome oder Edge, unsichtbar und stumm, mit Handy-Maßen (chrome.js)
//  - WebKit:   nur mit Playwright (webkit.js) – ohne das Paket wird dieser Teil übersprungen
// tests/e2e/run.js bleibt der Test für die Party selbst; hier läuft nie Musik und nichts geht ins Internet.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { startServer, startBroker } = require("./server.js");
const { findBrowser, launchChrome } = require("./chrome.js");
const { loadPlaywright, launchWebkit } = require("./webkit.js");
const party = require("./party.js");

const ROOT = path.join(__dirname, "..", "..");
const TMP = path.join(__dirname, ".tmp");
const NEED_WEBKIT = process.argv.includes("--need-webkit");
// PHONES_ONLY=party: nur die Prüfungen mit gespielter Party (schneller beim Arbeiten an einer Funktion)
const ONLY_PARTY = process.env.PHONES_ONLY === "party";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const UA_IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const UA_PIXEL = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
const IPHONE = { name: "iPhone 390×844", width: 390, height: 844, dpr: 3, ua: UA_IPHONE };
const PIXEL = { name: "Pixel 412×915", width: 412, height: 915, dpr: 2.625, ua: UA_PIXEL };
// die schmalsten Handys, die noch im Umlauf sind (iPhone SE 1) bis zu großen Android-Geräten
const WIDTHS = [320, 375, 412];

// Erwartete Texte stehen hier fest drin – käme der Vergleich aus der Seite selbst, fiele eine falsche Sprache nie auf
const TEXT = {
  de: { start: "Party beitreten", wait: "Verbunden", bad: "Link unvollständig", scanBad: "Das ist kein Mirage-Code" },
  en: { start: "Join the party", wait: "Connected", bad: "Incomplete link", scanBad: "That's not a Mirage code" },
};
const LANGS = { de: "de-DE", en: "en-US" };

// Gültig gebauter Link zu einer Party, die es nicht gibt: 16 Zeichen Kanal, 16 Byte Schlüssel
const channel = crypto.randomBytes(12).toString("base64url");
const goodHash = `#c=${channel}&k=${crypto.randomBytes(16).toString("base64url")}`;
const HASH = { start: "", wait: goodHash, bad: "#c=kurz&k=AAAA" };

// Läuft vor der Seite: Relays auf den lokalen umleiten, auf Wunsch den Speicher sperren
// (Safari mit „Alle Cookies blockieren“ wirft schon beim Zugriff auf localStorage)
const initScript = (brokerPort, blockStorage) => `(() => {
  const Real = window.WebSocket;
  window.WebSocket = class extends Real {
    constructor(url, proto) { super(/^wss?:\\/\\/127\\.0\\.0\\.1[:/]/.test(url) ? url : "ws://127.0.0.1:${brokerPort}/mqtt", proto); }
  };
  ${blockStorage ? `Object.defineProperty(window, "localStorage", { get() { throw new DOMException("The operation is insecure.", "SecurityError"); } });` : ""}
})();`;

// Was die Seite gerade zeigt, plus alles, was seitlich übersteht
const SNAPSHOT = `(() => {
  const $ = (id) => document.getElementById(id);
  const w = window.innerWidth, over = [];
  for (const el of document.querySelectorAll("body *")) {
    if (el.closest("[hidden]")) continue;
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") continue;
    const r = el.getBoundingClientRect();
    if (r.width && r.height && (r.right > w + 1 || r.left < -1)) over.push((el.id ? "#" + el.id : el.tagName.toLowerCase() + "." + el.className) + " " + Math.round(r.left) + "…" + Math.round(r.right));
  }
  const btn = $("scanBtn").getBoundingClientRect();
  return {
    title: $("sTitle").textContent, text: $("sText").textContent, lang: document.documentElement.lang,
    scan: !$("scan").hidden, btn: $("scanBtn").textContent, btnH: Math.round(btn.height), msg: $("scanMsg").textContent,
    w, scrollW: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth), over: over.slice(0, 4),
    touch: navigator.maxTouchPoints, navLang: navigator.language,
  };
})()`;

const results = { ok: 0, bad: [], skipped: [] };
function check(label, problems) {
  if (problems.length) {
    results.bad.push(label);
    console.log(`  ✗ ${label}`);
    for (const p of problems) console.log(`      ${p}`);
  } else {
    results.ok++;
    console.log(`  ✓ ${label}`);
  }
}

// Seite öffnen und warten, bis der erwartete Titel da ist (oder die Zeit um ist) – dann Zustand zurückgeben
async function visit(browser, env, { device, lang, state, blockStorage = false }, until) {
  const page = await browser.open({
    url: `http://127.0.0.1:${env.web.port}/${HASH[state]}`,
    width: device.width, height: device.height, dpr: device.dpr, ua: device.ua,
    lang: LANGS[lang] || lang,
    initScript: initScript(env.broker.port, blockStorage),
  });
  let snap = null;
  for (let i = 0; i < 80; i++) {
    try {
      snap = await page.eval(SNAPSHOT);
      if (until(snap)) break;
    } catch {}
    await sleep(100);
  }
  return { page, snap };
}

// Die drei Zustände, die jeder Gast ohne Party sehen kann
async function stateCheck(browser, env, o, label) {
  const want = TEXT[o.expect || o.lang];
  const { page, snap } = await visit(browser, env, o, (s) => s.title === want[o.state]);
  const problems = [];
  if (!snap) problems.push("Seite hat nicht geantwortet");
  else {
    if (snap.title !== want[o.state]) problems.push(`Titel „${snap.title}“ statt „${want[o.state]}“ (Text: „${snap.text}“)`);
    if (snap.lang !== (o.expect || o.lang)) problems.push(`<html lang> ist „${snap.lang}“ statt „${o.expect || o.lang}“ (navigator.language: ${snap.navLang})`);
    if (!snap.text) problems.push("zweite Zeile ist leer");
    // Start und kaputter Link führen zum Scanner; beim toten Link erscheint er erst nach 12 s
    if (o.state !== "wait" && (!snap.scan || !snap.btn)) problems.push("Scan-Knopf fehlt");
    if (o.state !== "wait" && snap.btnH < 40) problems.push(`Scan-Knopf nur ${snap.btnH} px hoch (zu klein für Finger)`);
    if (snap.w !== o.device.width) problems.push(`Seitenbreite ${snap.w} statt ${o.device.width} px`);
    if (snap.scrollW > snap.w) problems.push(`Seite läuft seitlich über: ${snap.scrollW} px Inhalt bei ${snap.w} px Breite`);
    if (snap.over.length) problems.push("ragt seitlich hinaus: " + snap.over.join(", "));
    if (!snap.touch) problems.push("Touch ist nicht aktiv");
  }
  if (page.errors.length) problems.push(...page.errors.map((e) => "Fehler in der Konsole: " + e));
  if (o.state === "wait" && !env.broker.stats.subs.includes("mirage-live/" + channel)) problems.push("Seite hat den Kanal nicht abonniert");
  await page.close();
  check(label, problems);
}

// Bedienung des Start-Bilds: Link einfügen (fremd und richtig), Kamera verweigert
async function scanCheck(browser, env, device) {
  const o = { device, lang: "de", state: "start" };
  const setLink = (v) => `(() => { const i = document.getElementById("scanLink"); i.value = ${JSON.stringify(v)}; i.dispatchEvent(new Event("input", { bubbles: true })); })()`;
  const poll = async (page, ok) => {
    let s = null;
    for (let i = 0; i < 80; i++) {
      try {
        s = await page.eval(SNAPSHOT);
        if (ok(s)) break;
      } catch {}
      await sleep(100);
    }
    return s || {};
  };

  let v = await visit(browser, env, o, (s) => s.title === TEXT.de.start);
  await v.page.eval(setLink("https://example.com/#c=" + channel + "&k=AAAA"));
  let s = await poll(v.page, (x) => x.msg);
  check(`${device.name} · fremder Link im Feld wird abgelehnt`, [
    ...(s.msg === TEXT.de.scanBad ? [] : [`Meldung „${s.msg}“ statt „${TEXT.de.scanBad}“`]),
    ...v.page.errors.map((e) => "Fehler in der Konsole: " + e),
  ]);
  await v.page.close();

  v = await visit(browser, env, o, (x) => x.title === TEXT.de.start);
  await v.page.eval(setLink(`http://127.0.0.1:${env.web.port}/${goodHash}`));
  s = await poll(v.page, (x) => x.title === TEXT.de.wait);
  check(`${device.name} · eingefügter Party-Link verbindet`, [
    ...(s.title === TEXT.de.wait ? [] : [`Titel „${s.title}“ statt „${TEXT.de.wait}“`]),
    ...v.page.errors.map((e) => "Fehler in der Konsole: " + e),
  ]);
  await v.page.close();

  v = await visit(browser, env, o, (x) => x.title === TEXT.de.start);
  const denied = await v.page.eval("T.scanDenied");
  await v.page.eval(`document.getElementById("scanBtn").click()`);
  s = await poll(v.page, (x) => x.msg);
  check(`${device.name} · Kamera verweigert: Hinweis statt leerem Bild`, [
    ...(s.msg && s.msg === denied ? [] : [`Meldung „${s.msg}“ statt „${denied}“`]),
    ...v.page.errors.map((e) => "Fehler in der Konsole: " + e),
  ]);
  await v.page.close();
}

// Alle 14 Sprachen des Themes: die Handysprache wird erkannt, und keiner Sprache fehlt ein Text
const ALL_LANGS = { fr: "fr-FR", es: "es-ES", it: "it-IT", pt: "pt-BR", nl: "nl-NL", pl: "pl-PL", tr: "tr-TR", ru: "ru-RU", uk: "uk-UA", ja: "ja-JP", ko: "ko-KR", zh: "zh-CN" };
async function langCheck(browser, env, device) {
  for (const [lang, tag] of Object.entries(ALL_LANGS)) {
    const { page, snap } = await visit(browser, env, { device, lang: tag, state: "start" }, (s) => s.lang === lang && s.title);
    const problems = [];
    if (!snap || snap.lang !== lang) problems.push(`<html lang> ist „${snap?.lang}“ statt „${lang}“`);
    const miss = await page.eval(`Object.keys(L.en).filter((k) => !(k in L[${JSON.stringify(lang)}]))`).catch((e) => ["(Fehler: " + e.message + ")"]);
    if (miss.length) problems.push("fehlende Texte: " + miss.join(", "));
    if (snap && snap.title !== (await page.eval(`L[${JSON.stringify(lang)}].scanStart[0]`))) problems.push(`Titel „${snap.title}“ ist nicht in ${lang}`);
    if (snap?.scrollW > snap?.w || snap?.over.length) problems.push("ragt seitlich hinaus: " + snap.over.join(", "));
    if (page.errors.length) problems.push(...page.errors.map((e) => "Fehler in der Konsole: " + e));
    await page.close();
    check(`${device.name} · ${tag}: Seite auf ${lang}, kein Text fehlt`, problems);
  }
}

// Als App auf dem Startbildschirm: Manifest und Icons laden, die App findet die Party von eben wieder
async function appCheck(browser, env, device) {
  const problems = [];
  let { page } = await visit(browser, env, { device, lang: "de", state: "wait" }, (s) => s.title === TEXT.de.wait);
  const m = await page.eval(`(async () => {
    const href = document.querySelector('link[rel="manifest"]')?.href;
    const man = await (await fetch(href)).json();
    const icons = [];
    for (const i of man.icons) {
      const r = await fetch(new URL(i.src, href));
      const bm = await createImageBitmap(await r.blob());
      icons.push({ src: i.src, ok: r.ok, size: bm.width + "x" + bm.height, want: i.sizes, type: r.headers.get("content-type") });
    }
    const apple = document.querySelector('link[rel="apple-touch-icon"]')?.href;
    return { name: man.name, display: man.display, start: man.start_url, icons, apple: apple && (await fetch(apple)).ok, last: JSON.parse(localStorage.getItem("mlLast") || "null")?.h, sw: !!navigator.serviceWorker?.controller };
  })()`).catch((e) => ({ err: e.message }));
  if (m.err) problems.push("Manifest: " + m.err);
  else {
    if (m.name !== "Mirage Live" || m.display !== "fullscreen" || m.start !== "./") problems.push(`Manifest: ${m.name} / ${m.display} / ${m.start}`);
    for (const i of m.icons) if (!i.ok || i.size !== i.want) problems.push(`Icon ${i.src}: ${i.size} statt ${i.want}`);
    if (!m.apple) problems.push("apple-touch-icon fehlt");
    if (m.last !== goodHash) problems.push("die Party wird nicht gemerkt: " + m.last);
    if (m.sw) problems.push("ein Service Worker steuert die Seite");
  }
  await page.close();
  // vom Startbildschirm ohne Link: zurück in die Party von eben; ist sie älter als 12 Stunden, der Scanner
  for (const [age, want, label] of [[60e3, TEXT.de.wait, "frisch"], [13 * 3600e3, TEXT.de.start, "zu alt"]]) {
    const init = initScript(env.broker.port, false) + `\nObject.defineProperty(Navigator.prototype, "standalone", { get: () => true });\ntry { localStorage.setItem("mlLast", JSON.stringify({ h: ${JSON.stringify(goodHash)}, at: Date.now() - ${age} })); } catch {}`;
    const pg = await browser.open({ url: `http://127.0.0.1:${env.web.port}/`, width: device.width, height: device.height, dpr: device.dpr, ua: device.ua, lang: "de-DE", initScript: init });
    let snap = null;
    for (let i = 0; i < 60; i++) {
      snap = await pg.eval(SNAPSHOT).catch(() => null);
      if (snap?.title === want) break;
      await sleep(100);
    }
    if (snap?.title !== want) problems.push(`App-Start (${label}): Titel „${snap?.title}“ statt „${want}“`);
    if (pg.errors.length) problems.push(...pg.errors.map((e) => "Fehler in der Konsole: " + e));
    await pg.close();
  }
  check(`${device.name} · als App: Manifest, Icons, Party von eben, kein Service Worker`, problems);
}

// Mit gespielter Party: was die Seite aus den Nachrichten des Themes macht
async function partySuite(browser, env, device) {
  const o = { url: `http://127.0.0.1:${env.web.port}/${goodHash}`, device, lang: "de-DE", channel, key: Buffer.from(new URLSearchParams(goodHash.slice(1)).get("k"), "base64url"), initScript: initScript(env.broker.port, false) };
  await party.noFlashCheck(browser, env, o, check);
  await party.tickCheck(browser, env, o, check);
  await party.waveCheck(browser, env, o, check);
}

async function suite(browser, env, devices) {
  console.log(`\n${browser.name}`);
  if (ONLY_PARTY) return partySuite(browser, env, devices[0]);
  // Zustände in beiden Sprachen, je Gerät
  for (const device of devices) {
    for (const lang of ["de", "en"]) {
      for (const state of ["start", "wait", "bad"]) {
        await stateCheck(browser, env, { device, lang, state }, `${device.name} · ${lang} · ${state === "start" ? "Start-/Scan-Bild" : state === "wait" ? "toter Link wartet" : "kaputter Link"}`);
      }
    }
  }
  // unbekannte Sprache: englisch
  await stateCheck(browser, env, { device: devices[0], lang: "eo", expect: "en", state: "start" }, `${devices[0].name} · unbekannte Sprache fällt auf Englisch zurück`);
  // Breiten: der längere deutsche Text und der englische dürfen nirgends überstehen
  for (const width of WIDTHS) {
    for (const lang of ["de", "en"]) {
      for (const state of ["start", "wait", "bad"]) {
        await stateCheck(browser, env, { device: { ...devices[0], name: `${width} px`, width, height: 640 }, lang, state }, `${width} px breit · ${lang} · ${state}: nichts steht über`);
      }
    }
  }
  // gesperrter Speicher
  for (const device of devices) {
    for (const state of ["start", "wait"]) {
      await stateCheck(browser, env, { device, lang: "de", state, blockStorage: true }, `${device.name} · localStorage gesperrt · ${state === "start" ? "Start-Bild" : "toter Link wartet"}`);
    }
  }
  await scanCheck(browser, env, devices[0]);
  await langCheck(browser, env, devices[0]);
  await appCheck(browser, env, devices[0]);
  await partySuite(browser, env, devices[0]);
}

async function main() {
  fs.mkdirSync(TMP, { recursive: true });
  const env = { web: await startServer(path.join(ROOT, "docs", "live")), broker: await startBroker() };
  console.log("Mirage · Handy-Seite in Handy-Browsern");
  console.log(`  Seite: http://127.0.0.1:${env.web.port}/   Relay: ws://127.0.0.1:${env.broker.port} (lokal, ohne Party)`);
  let chrome = null, webkit = null;
  try {
    const exe = findBrowser();
    if (exe) {
      chrome = await launchChrome(exe, TMP);
      // iPhone-Maße in Chromium zeigen nur das Layout – Safaris eigene Eigenheiten prüft erst der WebKit-Teil
      await suite(chrome, env, [PIXEL, IPHONE]);
    } else {
      results.skipped.push("Chromium: kein Chrome oder Edge gefunden (Pfad in CHROME_PATH angeben)");
    }
    const pw = loadPlaywright();
    if (pw) {
      try {
        webkit = await launchWebkit(pw);
      } catch (e) {
        results.skipped.push("WebKit: Playwright ist da, aber WebKit startet nicht – „npx playwright install webkit“ (" + String(e.message).split("\n")[0] + ")");
      }
      if (webkit) await suite(webkit, env, [IPHONE]);
    } else {
      results.skipped.push("WebKit (Safari): Paket „playwright“ fehlt – npm i -D playwright && npx playwright install webkit");
    }
  } finally {
    await chrome?.close().catch(() => {});
    await webkit?.close().catch(() => {});
    await env.web.close();
    await env.broker.close();
    try {
      fs.rmSync(TMP, { recursive: true, force: true, maxRetries: 20, retryDelay: 150 });
    } catch {}
  }
  console.log("");
  for (const s of results.skipped) console.log(`  – übersprungen: ${s}`);
  console.log(`\n${results.bad.length ? "✗" : "✓"} ${results.ok} bestanden, ${results.bad.length} fehlgeschlagen, ${results.skipped.length} Teil(e) übersprungen`);
  const missing = NEED_WEBKIT && !webkit;
  if (missing) console.log("✗ --need-webkit: der WebKit-Teil ist nicht gelaufen");
  if (!chrome && !webkit) console.log("✗ Kein Browser gefunden – nichts geprüft");
  process.exit(results.bad.length || missing || (!chrome && !webkit) ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
