// node tests/unit/overlay-ui.test.js
// Oberfläche der Overlay-App, soweit sie sich ohne Electron prüfen lässt: jedes Feld der Einstellungen hat einen Namen
// für Vorleseprogramme, eine Statuszeile übersteht translate(), die neuen Texte gibt es in jeder Sprache – und der
// Hauptprozess nimmt Vorschau, CSS-Datei, Update und Videostücke nur von den Fenstern an, die sie schicken dürfen.
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..", "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

/* ---- kleine DOM-Attrappe: gerade so viel, wie translate(), say() und labelRows() brauchen */
const VOID = new Set(["input", "img", "br", "meta", "link"]);
const kebab = (k) => "data-" + k.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());
class El {
  constructor(tag, attrs = {}) {
    this.tag = tag;
    this.attrs = { ...attrs };
    this.kids = []; // Elemente und Texte (Strings) in der Reihenfolge der Seite
    this.parentElement = null;
    this.listeners = {};
    this.checked = false;
    this.clicks = 0;
    const el = this;
    this.dataset = new Proxy({}, {
      get: (_o, k) => el.attrs[kebab(String(k))],
      set: (_o, k, v) => ((el.attrs[kebab(String(k))] = String(v)), true),
      deleteProperty: (_o, k) => (delete el.attrs[kebab(String(k))], true),
      has: (_o, k) => kebab(String(k)) in el.attrs,
    });
    this.classList = {
      add: (c) => { if (!this.classList.contains(c)) this.attrs.class = ((this.attrs.class || "") + " " + c).trim(); },
      contains: (c) => (this.attrs.class || "").split(/\s+/).includes(c),
    };
  }
  get tagName() { return this.tag.toUpperCase(); }
  get id() { return this.attrs.id || ""; }
  set id(v) { this.attrs.id = String(v); }
  get type() { return this.attrs.type || (this.tag === "input" ? "text" : ""); }
  get disabled() { return "disabled" in this.attrs; }
  get children() { return this.kids.filter((k) => k instanceof El); }
  get textContent() { return this.kids.map((k) => (k instanceof El ? k.textContent : k)).join(""); }
  set textContent(v) { this.kids = v === "" ? [] : [String(v)]; }
  get previousElementSibling() { const s = this.parentElement?.children || [], i = s.indexOf(this); return i > 0 ? s[i - 1] : null; }
  get nextElementSibling() { const s = this.parentElement?.children || [], i = s.indexOf(this); return i >= 0 && i < s.length - 1 ? s[i + 1] : null; }
  hasAttribute(n) { return n in this.attrs; }
  getAttribute(n) { return n in this.attrs ? this.attrs[n] : null; }
  setAttribute(n, v) { this.attrs[n] = String(v); }
  append(...els) { for (const e of els) { if (e instanceof El) e.parentElement = this; this.kids.push(e); } }
  contains(o) { for (let e = o; e; e = e.parentElement) if (e === this) return true; return false; }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  click() { this.clicks++; if (this.type === "checkbox") this.checked = !this.checked; }
  // ein Baustein eines Selektors: tag, #id, .klasse, [attr], [attr=wert]
  is(compound) {
    let rest = compound;
    const tag = /^[a-z][a-z0-9]*/i.exec(rest);
    if (tag) { if (tag[0].toLowerCase() !== this.tag) return false; rest = rest.slice(tag[0].length); }
    for (const m of rest.matchAll(/#([\w-]+)|\.([\w-]+)|\[([\w-]+)(?:="?([^"\]]*)"?)?\]/g)) {
      if (m[1] && this.id !== m[1]) return false;
      if (m[2] && !this.classList.contains(m[2])) return false;
      if (m[3] && (!(m[3] in this.attrs) || (m[4] !== undefined && this.attrs[m[3]] !== m[4]))) return false;
    }
    return true;
  }
  matches(sel) {
    return sel.split(",").some((one) => {
      const parts = one.trim().split(/\s+/);
      if (!this.is(parts.pop())) return false;
      let up = this.parentElement;
      while (parts.length) {
        const want = parts.pop();
        while (up && !up.is(want)) up = up.parentElement;
        if (!up) return false;
        up = up.parentElement;
      }
      return true;
    });
  }
  closest(sel) { for (let e = this; e; e = e.parentElement) if (e.matches(sel)) return e; return null; }
  querySelectorAll(sel) {
    const out = [];
    const walk = (e) => { for (const k of e.children) { if (k.matches(sel)) out.push(k); walk(k); } };
    walk(this);
    return out;
  }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
}
function parse(html) {
  const root = new El("body");
  let cur = root;
  for (const m of html.matchAll(/<!--[\s\S]*?-->|<\/([a-z0-9]+)>|<([a-z0-9]+)((?:\s+[\w:-]+(?:="[^"]*")?)*)\s*\/?>|[^<]+/gi)) {
    if (m[0].startsWith("<!--")) continue;
    if (m[1]) {
      assert.strictEqual(cur.tag, m[1].toLowerCase(), `schließendes </${m[1]}> passt zu <${cur.tag}>`);
      cur = cur.parentElement;
    } else if (m[2]) {
      const attrs = {};
      for (const a of m[3].matchAll(/([\w:-]+)(?:="([^"]*)")?/g)) attrs[a[1]] = a[2] ?? "";
      const el = new El(m[2].toLowerCase(), attrs);
      cur.append(el);
      if (!VOID.has(el.tag)) cur = el;
    } else if (m[0].trim()) cur.append(m[0]);
  }
  assert.strictEqual(cur, root, "alle Elemente geschlossen");
  return root;
}
// Seite → { body, lade(make) }: die genannten Funktionen aus dem Skript der Seite, an die Attrappe gebunden
function page(file, names) {
  const html = read(file);
  const body = parse(/<body>([\s\S]*?)<script/.exec(html)[1]);
  const src = names.map((n) => {
    const m = new RegExp(`\\n  function ${n}\\([^)]*\\) \\{[\\s\\S]*?\\n  \\}`).exec(html);
    assert.ok(m, `${file}: function ${n} gefunden`);
    return m[0];
  }).join("\n");
  return { html, body, src };
}

const { make, I18N } = (() => {
  const mod = { exports: {} };
  vm.runInNewContext(read("overlay/i18n.js").replace("module.exports = { make }", "module.exports = { make, I18N }"), { module: mod });
  return mod.exports;
})();
const LANGS = Object.keys(I18N);
assert.ok(LANGS.length >= 14 && LANGS.includes("en") && LANGS.includes("de"), "Sprachen gelesen");

/* ---- 1) Einstellungen: jedes Feld hat einen Namen, der Hinweis hängt daran, der Text schaltet den Schalter */
const set = page("overlay/settings.html", ["translate", "titleScreens", "say", "labelRows"]);
const doc = {
  documentElement: {},
  querySelector: (s) => set.body.querySelector(s),
  querySelectorAll: (s) => set.body.querySelectorAll(s),
};
let selection = "";
const ui = vm.runInNewContext(
  `let t = make("en");
   const $ = (s, r = document) => r.querySelector(s);
   const $$ = (s, r = document) => [...r.querySelectorAll(s)];
   ${set.src}
   ({ translate, say, labelRows, lang: (l) => (t = make(l)) })`,
  { make, document: doc, drawCal: () => {}, getSelection: () => selection, String }
);
// das Positions-Raster baut die Seite selbst – hier von Hand
for (const v of ["top", "middle", "bottom"]) for (const h of ["left", "center", "right"]) set.body.querySelector("#grid9").append(new El("button", { "data-v": `${v}-${h}` }));

ui.translate();
ui.labelRows(doc);

const byId = (id) => {
  const hits = set.body.querySelectorAll(`[id="${id}"]`);
  assert.strictEqual(hits.length, 1, `id „${id}“ gibt es genau einmal (${hits.length})`);
  return hits[0];
};
// Name, wie ihn ein Vorleseprogramm bildet: aria-labelledby (das Feld selbst zählt mit seinem aria-label) vor aria-label
const nameOf = (el) => {
  const ids = (el.getAttribute("aria-labelledby") || "").split(/\s+/).filter(Boolean);
  if (ids.length) return ids.map((id) => (byId(id) === el ? el.getAttribute("aria-label") || "" : byId(id).textContent)).join(" ").replace(/\s+/g, " ").trim();
  return (el.getAttribute("aria-label") || "").trim();
};
{
  const fields = set.body.querySelectorAll("input, select, textarea");
  assert.ok(fields.length >= 40, `alle Felder gefunden (${fields.length})`);
  const seen = new Map();
  for (const f of fields) {
    const what = `<${f.tag} ${f.id ? "#" + f.id : f.dataset.key ? "data-key=" + f.dataset.key : f.type}>`;
    const name = nameOf(f);
    assert.ok(name.length >= 2, `${what} hat einen Namen`);
    // zwei gleichartige Felder dürfen nicht gleich heißen (z. B. die beiden Abstands-Regler, „von“ und „bis“)
    const key = f.type + "|" + name;
    assert.ok(!seen.has(key), `${what} heißt wie ${seen.get(key)}: „${name}“`);
    seen.set(key, what);
    for (const id of (f.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean)) assert.strictEqual(byId(id).tag, "small", `${what}: Beschreibung ist der Hinweis der Zeile`);
  }
  const key = (k) => set.body.querySelector(`[data-key="${k}"]`);
  assert.strictEqual(nameOf(key("onPlayPause")), "Also on play / pause");
  assert.strictEqual(byId(key("onPlayPause").getAttribute("aria-describedby")).textContent, make("en")("onPlayPauseHint"));
  assert.strictEqual(nameOf(key("quietFrom")), "Quiet hours from");
  assert.strictEqual(nameOf(key("quietTo")), "Quiet hours to");
  assert.strictEqual(nameOf(key("quietOn")), "Quiet hours");
  assert.strictEqual(nameOf(key("offsetX")), "Distance from edge horizontal");
  assert.strictEqual(nameOf(key("offsetY")), "Distance from edge vertical");
  assert.strictEqual(nameOf(key("hueOn")), "Philips Hue");
  // Zeile ohne eigene Überschrift: gehört zur Überschrift darüber; ein fester Name bleibt, wie er ist
  assert.strictEqual(nameOf(byId("hueIp")), "Philips Hue");
  assert.strictEqual(nameOf(byId("wledLeds")), "WLED LEDs");
  assert.strictEqual(nameOf(byId("haToken")), "Home Assistant Access token");
  assert.strictEqual(nameOf(byId("nanoleafIp")), "Nanoleaf IP");
  assert.strictEqual(nameOf(byId("latDev")), "Timing per device");
  assert.strictEqual(nameOf(byId("latMs")), "Timing per device ms");
  // Gruppen aus Knöpfen heißen wie ihre Zeile; das Raster nennt jede Lage übersetzt
  const mode = set.body.querySelector('.seg[data-key="mode"]');
  assert.strictEqual(mode.getAttribute("role"), "group");
  assert.strictEqual(nameOf(mode), "Show");
  assert.strictEqual(nameOf(byId("grid9")), "Position");
  assert.deepStrictEqual(byId("grid9").children.map((b) => b.getAttribute("aria-label")), ["top left", "top center", "top right", "middle left", "middle center", "middle right", "bottom left", "bottom center", "bottom right"]);

  // Klick auf den Text der Zeile schaltet ihren einen Schalter – aber nicht beim Markieren und nicht in Zeilen ohne Schalter
  const row = key("showAlbum").closest(".row"), text = row.querySelector("b").parentElement, b = row.querySelector("b");
  assert.ok(text.classList.contains("tap") && text.listeners.click?.length === 1);
  const clickOn = (target) => text.listeners.click[0]({ target });
  clickOn(b);
  assert.ok(key("showAlbum").checked && key("showAlbum").clicks === 1, "Klick auf den Namen schaltet um");
  selection = "Show album";
  clickOn(b);
  assert.strictEqual(key("showAlbum").clicks, 1, "Text markieren schaltet nicht um");
  selection = "";
  const q = key("quietOn").closest(".row");
  assert.ok(q.querySelector("b").parentElement.listeners.click, "Ruhezeiten: ein Schalter neben zwei Uhrzeiten zählt");
  const dur = key("duration").closest(".row");
  assert.ok(!dur.querySelector("b").parentElement.listeners.click, "Zeile mit Regler: kein Klick-Schalter");

  // keine fest englischen Namen mehr; Statuszeilen der Lampen melden sich alle gleich
  assert.ok(!/aria-label="(Device|ms)"/.test(set.html) && !/setAttribute\("aria-label", `\$\{v\} \$\{h\}`\)/.test(set.html));
  for (const id of ["hueState", "goveeState", "haState", "nanoleafState", "lifxState", "yeelightState"]) {
    assert.strictEqual(byId(id).getAttribute("role"), "status", id);
    assert.strictEqual(byId(id).getAttribute("aria-live"), "polite", id);
  }
}

/* ---- 2) translate() lässt eine Statuszeile mit laufendem Stand in Ruhe */
{
  const govee = byId("goveeState"), lifx = byId("lifxState"), en = make("en"), de = make("de");
  assert.strictEqual(govee.textContent, en("goveeHint"), "ohne Stand steht der Hinweis da");
  ui.say("#goveeState", "12 Govee devices found");
  ui.translate();
  assert.strictEqual(govee.textContent, "12 Govee devices found", "translate() (z. B. nach „lang“) wischt den Stand nicht weg");
  // Sprachwechsel: alles andere wird übersetzt, der Stand bleibt
  ui.lang("de");
  ui.translate();
  assert.strictEqual(govee.textContent, "12 Govee devices found");
  assert.strictEqual(lifx.textContent, de("lifxHint"), "Zeilen ohne Stand bekommen den Hinweis in der neuen Sprache");
  assert.strictEqual(set.body.querySelector('[data-t="secLights"]').textContent, de("secLights"));
  assert.strictEqual(byId("haToken").getAttribute("aria-label"), de("haToken"), "eigene Namen (data-al) werden mit übersetzt");
  assert.strictEqual(byId("grid9").children[0].getAttribute("aria-label"), "oben links");
  // leerer Text gibt die Zeile frei und holt den Hinweis zurück
  ui.say("#goveeState", "");
  assert.strictEqual(govee.textContent, de("goveeHint"));
  assert.ok(!("live" in govee.dataset));
  // Zeile ohne Hinweis: leer heißt leer
  ui.say("#hueState", "Gekoppelt");
  ui.translate();
  assert.strictEqual(byId("hueState").textContent, "Gekoppelt");
  ui.say("#hueState", "");
  assert.strictEqual(byId("hueState").textContent, "");

  // Größenänderung zeichnet nur die Bildschirmkarte neu – translate() läuft dort nicht mehr
  const resize = /addEventListener\("resize", \(\) => \{([^}]*)\}\)/.exec(set.html);
  assert.ok(resize && /buildScreens\(/.test(resize[1]) && /titleScreens\(\)/.test(resize[1]) && !/translate\(\)/.test(resize[1]));
  // wer in eine Zeile mit Hinweis schreibt, tut es über say()/sayDev()
  for (const id of ["goveeState", "haState", "nanoleafState", "lifxState", "yeelightState"]) assert.ok(!new RegExp(`\\$\\("#${id}"\\)\\.textContent = `).test(set.html), `${id} wird nicht mehr direkt beschrieben`);

  // Assistent: dieselbe Regel
  const wz = read("overlay/setup.html");
  assert.ok(/if \(!el\.dataset\.live\) el\.textContent = t\(el\.dataset\.t\)/.test(wz) && /dataset\.live = "1"/.test(wz));
  assert.ok(!/aria-label="Token"/.test(wz) && !/setAttribute\("aria-label", `\$\{v\} \$\{h\}`\)/.test(wz));
  assert.ok(/s\.inert = n !== step/.test(wz), "unsichtbare Schritte bleiben aus der Tab-Reihenfolge");
}

/* ---- 3) Texte: die neuen Schlüssel gibt es in jeder Sprache, und jede Seite nennt nur Schlüssel, die es gibt */
{
  const NEW = ["posTop", "posMiddle", "posBottom", "posLeft", "posCenter", "posRight", "axisX", "axisY", "ctlPrev", "ctlToggle", "ctlNext"];
  for (const l of LANGS) for (const k of NEW) assert.ok(typeof I18N[l][k] === "string" && I18N[l][k].trim(), `${l}.${k}`);
  // Anzahl gleich: keine Sprache hat einen Schlüssel mehr oder weniger als Englisch
  for (const l of LANGS) assert.deepStrictEqual(Object.keys(I18N[l]).filter((k) => !(k in I18N.en)), [], `${l}: nur bekannte Schlüssel`);
  for (const l of LANGS) for (const k of NEW) assert.ok(k in I18N[l]);
  for (const f of ["overlay/settings.html", "overlay/setup.html"]) for (const m of read(f).matchAll(/data-(?:t|al)="(\w+)"/g)) assert.ok(m[1] in I18N.en, `${f}: Schlüssel ${m[1]}`);
  // Overlay: die Knöpfe bekommen ihren Namen vom Hauptprozess, nicht fest auf Englisch
  const ov = read("overlay/overlay.html"), main = read("overlay/main.js");
  assert.ok(!/aria-label="(Previous|Play\/Pause|Next)"/.test(ov) && /nameButtons\(text\)/.test(ov));
  assert.ok(/prev: t\("ctlPrev"\), toggle: t\("ctlToggle"\), next: t\("ctlNext"\)/.test(main));
}

/* ---- 4) Hauptprozess: wer darf was schicken */
{
  const main = read("overlay/main.js"), cast = read("overlay/cast.js");
  assert.ok(/ipcMain\.on\("preview", \(e\) => fromUi\(e\) && preview\(\)\)/.test(main), "Vorschau nur aus Einstellungen/Assistent");
  assert.ok(/ipcMain\.on\("openCss", \(e\) => fromSettings\(e\) && openCss\(\)\)/.test(main), "CSS-Datei nur aus den Einstellungen");
  assert.ok(/ipcMain\.on\("checkUpdate", \(e\) => fromSettings\(e\) && \(/.test(main), "Update nur aus den Einstellungen");
  assert.ok(!/ipcMain\.on\("(preview|openCss)", (preview|openCss)\)/.test(main));
  // der Tray ruft preview() weiter ohne Argument
  assert.ok(/click: \(\) => preview\(\)/.test(main));
  // AppImage-Update: Neustart vormerken, dann normal beenden (before-quit setzt die Lampen zurück)
  const ask = /async function askRestart\(\) \{[\s\S]*?\n\}/.exec(main)[0];
  assert.ok(/app\.relaunch\(\{ execPath: target[^\n]*\n\s*app\.quit\(\);/.test(ask) && !/app\.exit\(/.test(ask));

  // Videostücke und Fehler nur vom Aufnahme-Fenster
  assert.ok(/const fromCap = \(e\) => !!capWin && !capWin\.isDestroyed\(\) && e\?\.sender === capWin\.webContents;/.test(cast));
  assert.ok(/ipcMain\.on\("castChunk", \(e, buf\) => \{\s*if \(!fromCap\(e\)/.test(cast));
  assert.ok(/ipcMain\.on\("castError", \(e, msg\) => \{\s*if \(!fromCap\(e\)\) return;/.test(cast));
  // Rückstau: ab 8 MB wird die Verbindung dieses Zuschauers getrennt
  assert.ok(/const MAX_BACKLOG = 8 \* 1024 \* 1024;/.test(cast) && /if \(stream\.writableLength > MAX_BACKLOG\) \{[^}]*stream\.destroy\(\)/.test(cast));
  // „close“ hängt an der Antwort, bevor zum ersten Mal gewartet wird
  const handler = cast.slice(cast.indexOf("http.createServer(async (req, res) => {"), cast.indexOf("srv.listen("));
  assert.ok(handler.indexOf('res.on("close"') > 0 && handler.indexOf('res.on("close"') < handler.indexOf("await "), "Zuhörer vor dem ersten await");
  // Server nur, solange übertragen wird: schließen, wenn nichts mehr läuft; der nächste Start öffnet ihn wieder
  assert.ok(/function idle\(keep\) \{[\s\S]*?if \(!keep\) closeServer\(\);\s*\}/.test(cast));
  assert.ok(/function closeServer\(\) \{[\s\S]*?server = null;[\s\S]*?srv\.close\(\);/.test(cast));
  assert.ok(/if \(!active\.size\) idle\(keep\);/.test(cast) && /if \(!active\.size\) idle\(\);/.test(cast));
  assert.ok(/function serve\(\) \{\s*if \(server\) return;/.test(cast));
}

console.log("overlay-ui: ok (Namen der Felder, Klick auf den Text, Statuszeilen, Texte in " + LANGS.length + " Sprachen, Absender-Prüfungen)");
