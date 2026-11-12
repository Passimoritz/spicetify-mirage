// Zugangsdaten: Hin- und Rückweg über ein nachgebautes safeStorage, Umzug alter Klartext-Dateien,
// Verhalten ohne Schlüsselbund. Aufruf: node tests/unit/lights-secrets.test.js
const assert = require("assert");
const { createSecrets, SECRET } = require("../../overlay/secrets.js");

// nachgebautes safeStorage: „verschlüsselt“ erkennbar, aber ohne den Klartext im Ergebnis
function fakeStorage({ on = true, backend, broken = false } = {}) {
  return {
    isEncryptionAvailable: () => on,
    ...(backend ? { getSelectedStorageBackend: () => backend } : {}),
    encryptString: (s) => Buffer.from("v10" + [...Buffer.from(s, "utf8")].map((b) => (b ^ 0x5a).toString(16).padStart(2, "0")).join("")),
    decryptString: (buf) => {
      const s = String(buf);
      if (broken || !s.startsWith("v10")) throw new Error("decrypt");
      return Buffer.from(s.slice(3).match(/../g).map((h) => parseInt(h, 16) ^ 0x5a)).toString("utf8");
    },
  };
}
const HUE = "abcDEF1234567890-hueuser", KEY = "0123456789ABCDEF0123456789ABCDEF", TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.token";
const cfg = { hueIp: "192.168.1.20", hueUser: HUE, hueClientKey: KEY, haToken: TOKEN, haUrl: "http://ha.local:8123", lightBright: 80 };

assert.deepStrictEqual(SECRET, ["hueUser", "hueClientKey", "haToken"]);

// 1) Hin- und Rückweg: in der Datei steht kein Klartext, nach dem Lesen ist alles wieder da
{
  const s = createSecrets(fakeStorage());
  const disk = s.seal(cfg), text = JSON.stringify(disk);
  for (const k of SECRET) assert.ok(!(k in disk), `${k} darf nicht als Feld in der Datei stehen`);
  for (const v of [HUE, KEY, TOKEN]) assert.ok(!text.includes(v), "Klartext in der Datei");
  assert.strictEqual(disk.hueIp, "192.168.1.20");
  assert.strictEqual(disk.lightBright, 80);
  assert.deepStrictEqual(Object.keys(disk.secrets).sort(), [...SECRET].sort());
  const back = createSecrets(fakeStorage()).open(JSON.parse(text));
  assert.strictEqual(back.migrated, false);
  assert.deepStrictEqual(back.cfg, cfg);
  assert.ok(!("secrets" in back.cfg));
  assert.strictEqual(s.plain(cfg), false);
}

// 2) Umzug: alte Datei mit Klartext → migrated, nach dem Speichern verschlüsselt und Klartextfeld weg
{
  const s = createSecrets(fakeStorage());
  const old = { hueUser: HUE, haToken: TOKEN, hueOn: true };
  const opened = s.open(old);
  assert.strictEqual(opened.migrated, true);
  assert.strictEqual(opened.cfg.hueUser, HUE);
  const disk = s.seal(opened.cfg);
  assert.ok(!("hueUser" in disk) && !("haToken" in disk));
  assert.ok(!JSON.stringify(disk).includes(HUE) && !JSON.stringify(disk).includes(TOKEN));
  assert.strictEqual(disk.hueOn, true);
  // zweiter Start: nichts mehr umzuziehen
  assert.strictEqual(createSecrets(fakeStorage()).open(disk).migrated, false);
}

// 3) kein Schlüsselbund: altes Verhalten (Klartext), kein Umzug, Hinweis an
for (const st of [fakeStorage({ on: false }), fakeStorage({ backend: "basic_text" }), null]) {
  const s = createSecrets(st);
  assert.strictEqual(s.available(), false);
  const opened = s.open({ hueUser: HUE });
  assert.strictEqual(opened.migrated, false);
  const disk = s.seal(opened.cfg);
  assert.strictEqual(disk.hueUser, HUE);
  assert.ok(!("secrets" in disk));
  assert.strictEqual(s.plain(opened.cfg), true);
  assert.strictEqual(s.plain({ hueUser: "", haToken: "" }), false);
}
// LINUX mit echtem Schlüsselbund zählt als verfügbar
assert.strictEqual(createSecrets(fakeStorage({ backend: "gnome_libsecret" })).available(), true);

// 4) Blob gerade nicht lesbar (Schlüsselbund gesperrt): Wert leer, Blob bleibt in der Datei erhalten
{
  const disk = createSecrets(fakeStorage()).seal(cfg);
  for (const st of [fakeStorage({ broken: true }), fakeStorage({ on: false })]) {
    const s = createSecrets(st);
    const opened = s.open(disk);
    assert.ok(!opened.cfg.hueUser && !opened.cfg.haToken);
    const again = s.seal({ ...opened.cfg, hueUser: "", haToken: "" });
    assert.deepStrictEqual(again.secrets, disk.secrets);
  }
  // … außer der Nutzer setzt einen neuen Wert: der gewinnt
  const s = createSecrets(fakeStorage({ broken: true }));
  const opened = s.open(disk);
  const again = s.seal({ ...opened.cfg, haToken: "new-token-new-token-new-token" });
  assert.notStrictEqual(again.secrets.haToken, disk.secrets.haToken);
  assert.strictEqual(again.secrets.hueUser, disk.secrets.hueUser);
}

// 5) leere Werte und kaputte Dateien
{
  const s = createSecrets(fakeStorage());
  const disk = s.seal({ hueUser: "", haToken: "", hueOn: false });
  assert.ok(!("secrets" in disk) && !("hueUser" in disk));
  assert.deepStrictEqual(s.open({ secrets: "nope", hueOn: true }).cfg, { hueOn: true });
  assert.deepStrictEqual(s.open({ secrets: { hueUser: 5, haToken: "!!!" } }).cfg, {});
}
console.log("lights-secrets: ok");
