// Zugangsdaten bleiben bei ihrer Adresse: Import mit anderer Bridge / anderem Home Assistant löscht Schlüssel
// bzw. Token, „set“ aus einem Fenster ändert Adressen nur aus dem Einstellungsfenster, und welches Fenster
// fragt, entscheidet senderIs. Aufruf: node tests/unit/lights-addrguard.test.js
const assert = require("assert");
const { rebind, cleanPatch, senderIs, BOUND, SECRET } = require("../../overlay/secrets.js");

const cfg = { hueIp: "192.168.1.20", hueUser: "user-0123456789", hueClientKey: "0123456789ABCDEF0123456789ABCDEF", haUrl: "http://ha.local:8123", haToken: "tok-0123456789abcdefghij", lightBright: 80 };

// BOUND deckt jede Zugangsdate ab
assert.deepStrictEqual(Object.values(BOUND).flat().sort(), [...SECRET].sort());

/* ---- Import (rebind) */
{
  // andere Bridge: beide Hue-Schlüssel leer, Token bleibt
  let r = rebind({ hueIp: "10.0.0.66", lightBright: 50 }, cfg);
  assert.deepStrictEqual(r.cleared, ["hueIp"]);
  assert.deepStrictEqual(r.patch, { hueIp: "10.0.0.66", lightBright: 50, hueUser: "", hueClientKey: "" });
  // anderes Home Assistant: Token leer
  r = rebind({ haUrl: "http://evil.example:8123" }, cfg);
  assert.deepStrictEqual(r.cleared, ["haUrl"]);
  assert.strictEqual(r.patch.haToken, "");
  assert.ok(!("hueUser" in r.patch));
  // beides
  r = rebind({ haUrl: "https://x.local", hueIp: "" }, cfg);
  assert.deepStrictEqual(r.cleared.sort(), ["haUrl", "hueIp"]);
  // gleiche Adresse (auch anders geschrieben): nichts löschen
  for (const p of [{ hueIp: "192.168.1.20" }, { hueIp: " 192.168.1.20 " }, { haUrl: "HTTP://HA.local:8123/" }, { lightBright: 10 }]) {
    r = rebind(p, cfg);
    assert.deepStrictEqual(r.cleared, [], JSON.stringify(p));
    assert.deepStrictEqual(r.patch, p);
  }
  // nichts gespeichert: nichts zu löschen, Adresse wird einfach übernommen
  r = rebind({ hueIp: "10.0.0.66", haUrl: "http://a.local" }, { hueIp: "1.2.3.4", hueUser: "", haUrl: "", haToken: "" });
  assert.deepStrictEqual(r.cleared, []);
  assert.deepStrictEqual(r.patch, { hueIp: "10.0.0.66", haUrl: "http://a.local" });
  // das Original bleibt unverändert
  const p = { hueIp: "10.0.0.66" };
  rebind(p, cfg);
  assert.deepStrictEqual(p, { hueIp: "10.0.0.66" });
}

/* ---- set aus einem Fenster (cleanPatch) */
{
  // Einstellungsfenster: Adressen ja, neues Token ja, Platzhalter und Hue-Schlüssel nie
  let r = cleanPatch({ hueIp: "10.0.0.5", haUrl: "http://b.local", haToken: "new-token-0123456789abc", hueUser: "x", hueClientKey: "y", secrets: {}, secretsPlain: true, wledOn: true }, cfg, true);
  assert.deepStrictEqual(r.patch, { hueIp: "10.0.0.5", haUrl: "http://b.local", haToken: "new-token-0123456789abc", wledOn: true });
  assert.deepStrictEqual(r.dropped, []);
  assert.deepStrictEqual(cleanPatch({ haToken: "set" }, cfg, true).patch, {});
  // Assistent / anderes Fenster: Adressen und Token verworfen, der Rest geht durch
  r = cleanPatch({ hueIp: "10.0.0.5", haUrl: "http://evil.example", haToken: "zzz-0123456789abcdefghij", style: "card" }, cfg, false);
  assert.deepStrictEqual(r.patch, { style: "card" });
  assert.deepStrictEqual(r.dropped.sort(), ["haUrl", "hueIp"]);
  // unveränderte Adresse ist keine Änderung – auch nicht im Protokoll
  r = cleanPatch({ hueIp: "192.168.1.20", hueOn: true }, cfg, false);
  assert.deepStrictEqual(r.patch, { hueOn: true });
  assert.deepStrictEqual(r.dropped, []);
  // Unsinn
  for (const bad of [null, "x", [1], 5]) assert.deepStrictEqual(cleanPatch(bad, cfg, true), { patch: {}, dropped: [] });
}

/* ---- welches Fenster fragt (senderIs) mit nachgebauten Electron-Objekten */
{
  const frame = (url) => ({ url });
  const win = (url) => {
    const main = frame(url), wc = { mainFrame: main };
    return { wc, main, w: { webContents: wc, isDestroyed: () => false } };
  };
  const S = win("file:///C:/app/overlay/settings.html"), O = win("file:///C:/app/overlay/overlay.html");
  const ev = (wc, f) => ({ sender: wc, senderFrame: f });
  assert.strictEqual(senderIs(ev(S.wc, S.main), S.w, "settings.html"), true);
  assert.strictEqual(senderIs(ev(S.wc, S.main), S.w, "setup.html"), false, "falsche Seite");
  assert.strictEqual(senderIs(ev(O.wc, O.main), S.w, "settings.html"), false, "anderes Fenster");
  assert.strictEqual(senderIs(ev(S.wc, frame("file:///C:/app/overlay/settings.html")), S.w, "settings.html"), false, "Unterframe");
  assert.strictEqual(senderIs(ev(S.wc, null), S.w, "settings.html"), false);
  assert.strictEqual(senderIs(ev(S.wc, S.main), null, "settings.html"), false, "Fenster zu");
  assert.strictEqual(senderIs(ev(S.wc, S.main), { ...S.w, isDestroyed: () => true }, "settings.html"), false);
  // eine Seite, die woandershin navigiert ist (z. B. http), zählt nicht
  const N = win("https://evil.example/settings.html");
  assert.strictEqual(senderIs(ev(N.wc, N.main), N.w, "settings.html"), false);
  const H = win("file:///C:/app/overlay/settings.html#x");
  assert.strictEqual(senderIs(ev(H.wc, H.main), H.w, "settings.html"), true);
  assert.strictEqual(senderIs(null, S.w, "settings.html"), false);
}

console.log("lights-addrguard: ok");
