// node tests/unit/livesign.test.js
// Unterschrift des PCs unter den Party-Nachrichten: das Theme (src/live.js) unterschreibt, die Handyseite
// (docs/live/index.html) prüft. Beide Teile stehen zwischen „sign:begin“ und „sign:end“ und werden hier aus den
// Dateien herausgelesen und zusammen ausgeführt – getestet wird also der Text, der ausgeliefert wird.
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..", "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const block = (file, names) => {
  const m = /\/\* ---- sign:begin[^\n]*\n([\s\S]*?)\/\* ---- sign:end \*\//.exec(read(file));
  assert.ok(m, `${file}: Abschnitt sign:begin … sign:end gefunden`);
  const ctx = vm.createContext({ crypto: globalThis.crypto, TextEncoder, btoa, atob });
  return vm.runInContext(`${m[1]}\n({ ${names.join(", ")} })`, ctx, { filename: file });
};

const theme = block("src/live.js", ["sgSign", "sgPack", "sgNew"]);
const page = block("docs/live/index.html", ["sgOpen", "sgUnpack", "sgImport", "sgBytes"]);
const TOPIC = "mirage-live/AAAAAAAAAAAAAAAAAAAAAA";

(async () => {
  /* ---- 1) Schlüssel: gepackt in den Link, auf dem Handy wieder ausgepackt */
  let odd = 0, even = 0;
  for (let i = 0; i < 24; i++) {
    const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    const raw = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
    const packed = theme.sgPack(raw);
    assert.strictEqual(packed.length, 33);
    packed[0] === 3 ? odd++ : even++;
    assert.deepStrictEqual([...page.sgUnpack(packed)], [...raw], "ausgepackt = der ungepackte Schlüssel");
  }
  assert.ok(odd && even, "beide Vorzeichen von y kamen vor");
  assert.throws(() => page.sgUnpack(new Uint8Array(32)), "falsche Länge");
  assert.throws(() => page.sgUnpack(Uint8Array.of(4, ...new Uint8Array(32))), "falsches erstes Byte");
  assert.throws(() => page.sgUnpack(Uint8Array.of(2, ...new Uint8Array(32).fill(255))), "x größer als der Körper");
  // etwa jedes zweite x liegt nicht auf der Kurve (x³ − 3x + b ist dort kein Quadrat): das fällt auf; was
  // sgUnpack durchlässt, ist ein echter Punkt (WebCrypto prüft das beim Einlesen selbst noch einmal)
  let off = 0, on = 0;
  for (let x = 1; x <= 40; x++) {
    let raw = null;
    try {
      raw = page.sgUnpack(Uint8Array.of(2 + (x & 1), ...new Uint8Array(31), x));
    } catch {
      off++;
    }
    if (raw) on += !!(await crypto.subtle.importKey("raw", raw, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]));
  }
  assert.ok(off >= 8 && on >= 8 && off + on === 40, `kein Punkt der Kurve: ${off} abgelehnt, ${on} gültig`);
  await assert.rejects(page.sgImport("AAAA"), "kaputter Schlüssel im Link wird abgelehnt");

  const host = await theme.sgNew(), other = await theme.sgNew();
  assert.strictEqual(host.pub.length, 44, "33 Bytes = 44 Zeichen im Link");
  assert.ok(/^[\w-]+$/.test(host.pub), "nur Zeichen, die in einem Link ohne Umschreibung stehen dürfen");
  assert.strictEqual(host.key.extractable, false, "der private Schlüssel lässt sich nicht auslesen");
  await assert.rejects(crypto.subtle.exportKey("pkcs8", host.key));
  const pub = await page.sgImport(host.pub), pubOther = await page.sgImport(other.pub);

  /* ---- 2) Lichtzustand: gültig angenommen, verändert oder fremd unterschrieben abgelehnt */
  const state = { v: 1, on: 1, s: 1764150000000, bpm: 120, t: "Titel „mit“ Zeichen   🎉", pal: [[1, 2, 3], [4, 5, 6], [7, 8, 9]], g: { tms: { 123456: 1, abc: 0 } }, d: 0.85 };
  const body = JSON.stringify(state);
  const text = await theme.sgSign(host.key, TOPIC, body);
  assert.strictEqual(text.length, body.length + 94, "94 Zeichen mehr je Nachricht");
  assert.strictEqual(await page.sgOpen(pub, TOPIC, text), body, "gültige Unterschrift: der unterschriebene Text kommt zurück");
  // ältere Handyseite: derselbe Text ist gültiges JSON mit allen Feldern und einem zusätzlichen „sg“
  const old = JSON.parse(text);
  assert.strictEqual(old.sg.length, 86);
  delete old.sg;
  assert.deepStrictEqual(old, state);

  assert.strictEqual(await page.sgOpen(pub, TOPIC, text.replace('"on":1', '"on":0')), null, "veränderter Inhalt");
  assert.strictEqual(await page.sgOpen(pub, TOPIC, text.replace('"bpm":120', '"bpm":121')), null);
  assert.strictEqual(await page.sgOpen(pub, TOPIC, text + " "), null, "angehängtes Zeichen");
  const flip = text.slice(0, 20) + (text[20] === "A" ? "B" : "A") + text.slice(21);
  assert.strictEqual(await page.sgOpen(pub, TOPIC, flip), null, "veränderte Unterschrift");
  assert.strictEqual(await page.sgOpen(pubOther, TOPIC, text), null, "Unterschrift eines anderen Schlüssels");
  assert.strictEqual(await page.sgOpen(pub, TOPIC, await theme.sgSign(other.key, TOPIC, body)), null, "fremder Unterschreiber");
  assert.strictEqual(await page.sgOpen(pub, TOPIC.slice(0, -1) + "B", text), null, "anderer Kanal");

  /* ---- 3) Antwort an ein Handy: gilt nur auf dessen Thema */
  const reply = JSON.stringify({ v: 1, s: 1764150000000, res: [], r: -1, wr: "max", n: 2 });
  const forA = await theme.sgSign(host.key, TOPIC + "/r/handy-aaaaaa", reply);
  assert.strictEqual(await page.sgOpen(pub, TOPIC + "/r/handy-aaaaaa", forA), reply);
  assert.strictEqual(await page.sgOpen(pub, TOPIC, forA), null, "Antwort an A als Stand für alle");
  assert.strictEqual(await page.sgOpen(pub, TOPIC + "/r/handy-bbbbbb", forA), null, "Antwort an A für B");
  assert.strictEqual(await page.sgOpen(pub, TOPIC + "/r/handy-aaaaaa", text), null, "Stand für alle als Antwort an A");

  /* ---- 4) ohne Unterschrift: mit „p“ im Link abgelehnt, ohne „p“ (älteres Theme) wie bisher angenommen */
  const over = JSON.stringify({ v: 1, on: 0, s: 1764150000000 });
  assert.strictEqual(await page.sgOpen(pub, TOPIC, over), null, "„Party beendet“ ohne Unterschrift");
  assert.strictEqual(await page.sgOpen(null, TOPIC, over), over, "kein Schlüssel im Link: Text gilt, wie er ist");
  assert.strictEqual(await page.sgOpen(null, TOPIC, text), text, "kein Schlüssel im Link, neues Theme: Text bleibt lesbar");
  // „sg“ muss das erste Feld sein und genau 86 Zeichen haben – sonst gibt es nichts zu prüfen
  const sg = JSON.parse(text).sg;
  for (const bad of ["", "{}", '{"sg":""}', `{"v":1,"sg":"${sg}","on":0}`, `{"sg":"${sg.slice(1)}",${over.slice(1)}`, `{"sg":"${"!".repeat(86)}",${over.slice(1)}`, `{"sg":"${sg}"}`, `{ "sg":"${sg}",${body.slice(1)}`]) {
    assert.strictEqual(await page.sgOpen(pub, TOPIC, bad), null, "abgelehnt: " + bad.slice(0, 30));
  }

  /* ---- 5) die beiden Seiten benutzen die Helfer auch: Senden unterschreibt, Empfangen prüft vor allem anderen */
  const live = read("src/live.js"), phone = read("docs/live/index.html");
  assert.ok(/s\.key, te\.encode\(await sgSign\(s\.sign, topic, JSON\.stringify\(obj\)\)\)/.test(live), "seal() unterschreibt, was es verschlüsselt");
  assert.ok(/client\?\.publish\(s\.topic, await seal\(s, s\.topic, state\), retain\)/.test(live), "Lichtzustand und „Party beendet“ gehen durch seal()");
  assert.ok(/const topic = `\$\{s\.topic\}\/r\/\$\{id\}`, out = await seal\(s, topic,/.test(live), "Antworten sind für ihr eigenes Thema unterschrieben");
  assert.strictEqual((live.match(/\.encrypt\(/g) || []).length, 1, "es gibt genau eine Stelle, die verschlüsselt (seal)");
  assert.ok(/&p=\$\{sign\.pub\}`/.test(live) && /hostUrl: `\$\{url\}&h=/.test(live) && /rcUrl: `\$\{url\}&h=/.test(live), "„p“ steht in allen drei Links");
  const recv = /async function receive\(m, retained, from\) \{([\s\S]*?)\n\}/.exec(phone);
  assert.ok(recv, "receive() gefunden");
  assert.ok(/await sgOpen\(hostPub, from, [^\n]*\.decrypt\(/.test(recv[1]) && /if \(text === null\) return;\s*s = JSON\.parse\(text\);/.test(recv[1]), "receive() prüft, bevor es liest");
  assert.ok(recv[1].indexOf("sgOpen(") < recv[1].indexOf("s.rcs"), "… und vor jeder Auswertung");
  assert.ok(/if \(pk\) hostPub = await sgImport\(pk\);\s*key = await/.test(phone), "ein kaputtes „p“ verhindert die Verbindung");

  console.log("livesign: ok (Schlüssel packen/auspacken, Unterschrift, Thema, ohne Unterschrift, Einbau)");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
