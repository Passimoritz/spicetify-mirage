import { S, root, VERSION } from "./core.js";
import { t, I18N, LANG } from "./i18n.js";
import { SCHEMES, BUILT_IN, DEFAULTS, applyScheme, cfg, save, resetSettings, buildScheme } from "./config.js";
import { current } from "./color.js";
import { beat } from "./audio.js";
import { dust } from "./dust.js";
import { bridge } from "./bridge.js";
import { immersive } from "./immersive.js";
import { onSong, contextUri, albumUri, effectiveScheme } from "./song.js";
import { currentItem } from "./player.js";
import { PRESET_KEYS, COST, applyPreset, detectPreset } from "./perf.js";
import { recheckAll } from "./readability.js";
import { diagnostics, reportUrl } from "./selectors.js";
import { refreshRemote } from "./remote.js";
import { nowPlayingCard, weekCard, monthCard } from "./share.js";
import { FONTS, applyFont, preloadFonts, stackOf } from "./fonts.js";
import { FAMILIES } from "./party.js";
import { live } from "./live.js";
import { bpm } from "./library.js";
import { GAME as GAME_IC } from "./icons.js";

function applySettings() {
  applyScheme(effectiveScheme());
  root.classList.toggle("mirage-vinyl", cfg.vinyl);
  root.classList.toggle("mirage-no-tilt", !cfg.tilt);
  root.classList.toggle("mirage-no-grain", !cfg.grain);
  root.classList.toggle("mirage-calm", cfg.calm);
  root.classList.toggle("mirage-noflash", !!cfg.noFlash);
  root.classList.toggle("mirage-glass", cfg.glass);
  root.classList.toggle("mirage-lite", !!cfg.lite);
  root.classList.toggle("mirage-rich", cfg.preset === "full");
  root.classList.toggle("mirage-bright-adjust", cfg.bright !== 100);
  root.style.setProperty("--m-blur", cfg.blur + "px");
  root.style.setProperty("--m-bright", String(cfg.bright / 100));
  // Hintergrund-Canvas läuft immer; Lichtstaub, Ruhe und Helligkeit liest es selbst aus cfg
  dust.start();
  beat.sync();
  cfg.overlay ? bridge.connect() : bridge.close();
  immersive.styleLyrics();
  applyFont();
}
// Leistung von außerhalb des Dialogs umstellen (Schnellmenü im Immersiv-Modus): dieselben Wege wie die
// Presets und Schalter im Dialog. Ist der Dialog offen, zeigt er den neuen Stand gleich mit.
function setPreset(name) {
  applyPreset(name);
  applySettings();
  render.again?.();
}
function setPerf(key, value) {
  cfg[key] = value;
  if (PRESET_KEYS.includes(key)) detectPreset();
  save();
  applySettings();
  render.again?.();
}
// nach jeder Farb- oder Schemaänderung: Farben neu holen und Lesbarkeit neu prüfen
function refreshColors() {
  applySettings();
  onSong(false);
  setTimeout(recheckAll, 600);
}

// Schema wählen
function selectScheme(name) {
  if (!SCHEMES[name]) return;
  cfg.scheme = name;
  cfg.schemeCfg = S.Config?.color_scheme || "";
  cfg.dynamic = name === "Mirage";
  save();
  refreshColors();
}

/* ---------------------------------------------------------------- Bausteine */
// teure Effekte tragen einen Blitz – so sieht man, was man für mehr Akku abschaltet
const COSTLY = new Set(["glass", "particles", "beat", "tilt", "canvas"]);
const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
function head(title, hint) {
  const h = el("div", "m-schemes-head");
  h.append(el("b", "", title));
  if (hint) h.append(el("small", "", hint));
  return h;
}
function bolt() {
  const i = el("i", "m-cost");
  i.innerHTML = GAME_IC.fast;
  i.title = t("costly");
  i.setAttribute("role", "img");
  i.setAttribute("aria-label", t("costly"));
  return i;
}
const has = (k) => t(k) !== k;
function toggle(key, after) {
  const row = el("label", "m-row");
  const txt = el("span");
  const b = el("b", "", t(key));
  if (COSTLY.has(key)) b.append(" ", bolt());
  txt.append(b);
  const hint = t(key + "Hint");
  if (hint !== key + "Hint") txt.append(el("small", "", hint));
  const cb = el("input");
  cb.type = "checkbox";
  // sieht aus wie ein Schalter – Screenreader sagen dann „Schalter, an/aus“ statt „Kontrollkästchen“
  cb.setAttribute("role", "switch");
  cb.dataset.key = key;
  cb.checked = !!cfg[key];
  cb.onchange = () => {
    cfg[key] = cb.checked;
    if (PRESET_KEYS.includes(key)) detectPreset();
    save();
    after ? after() : applySettings();
    render.again?.();
  };
  row.append(txt, cb);
  return row;
}
// Regler: Füllung in der Akzentfarbe, Wert mit Einheit, Striche bei wenigen Stufen, Marke beim Standardwert,
// darunter in Klartext, was er kostet. Beim Ziehen ändert sich nur der Regler selbst (eine Variable am Element);
// die Wirkung (after, oft eine Variable am ganzen Dokument) läuft höchstens alle 100 ms, gespeichert wird beim Loslassen.
const COSTLY_RANGE = new Set(["blur"]);
// Regler ohne Einfluss auf die Leistung: das steht ausdrücklich dabei
const FREE_RANGE = new Set(["bright", "vizHeight", "vizSmooth"]);
let rangeN = 0;
function range(key, min, max, step, unit, after, fmt = (v) => v + unit) {
  const row = el("label", "m-row m-range");
  const top = el("span", "m-range-top");
  const name = el("b", "", t(key));
  if (COSTLY_RANGE.has(key)) name.append(" ", bolt());
  const val = el("span", "m-range-val");
  val.setAttribute("aria-hidden", "true");
  top.append(name, val);
  const r = el("input");
  Object.assign(r, { type: "range", min, max, step, value: cfg[key] });
  r.dataset.key = key;
  r.setAttribute("aria-label", t(key));
  // Striche nur, wo es wenige Stufen gibt; die Standard-Marke immer. Beides malt CSS als Hintergrund eines
  // einzigen Elements (--n Stufen, --d Lage des Standards), die Wörter an den Enden kommen aus data-lo/data-hi:
  // jedes Element mehr kostet bei jeder Farbänderung am Dokument ein Stück Neuberechnung
  const scale = el("span", "m-range-scale");
  scale.setAttribute("aria-hidden", "true");
  const steps = Math.round((max - min) / step);
  if (steps <= 16) scale.style.setProperty("--n", steps);
  else scale.classList.add("is-noticks");
  const def = DEFAULTS[key];
  if (typeof def === "number" && def >= min && def <= max) scale.style.setProperty("--d", (def - min) / (max - min));
  else scale.classList.add("is-nodef");
  if (has(key + "Lo")) Object.assign(scale.dataset, { lo: t(key + "Lo"), hi: t(key + "Hi") });
  row.append(top, r, scale);
  // Glas-Unschärfe ohne echtes Glas: sichtbar ruhiger, mit dem Hinweis, warum sie nichts tut
  const idle = key === "blur" && !cfg.glass;
  row.classList.toggle("is-idle", idle);
  const hk = idle ? "blurOff" : has(key + "Cost") ? key + "Cost" : FREE_RANGE.has(key) ? "costFree" : has(key + "Hint") ? key + "Hint" : "";
  if (hk) {
    const hint = el("small", "m-range-hint" + (hk.endsWith("Cost") ? " is-cost" : hk === "costFree" ? " is-free" : ""), t(hk));
    hint.id = "m-rh-" + ++rangeN;
    r.setAttribute("aria-describedby", hint.id);
    row.append(hint);
  }
  const show = () => {
    const v = Number(r.value), text = String(fmt(v));
    val.textContent = text;
    r.style.setProperty("--p", (v - min) / (max - min));
    r.setAttribute("aria-valuetext", v === def ? `${text} (${t("rangeDefault")})` : text);
  };
  show();
  // höchstens ein Zeitgeber, er endet von selbst; beim Loslassen (change) sofort der letzte Stand
  let at = 0, timer = 0, done = cfg[key];
  const apply = () => {
    clearTimeout(timer);
    timer = 0;
    at = performance.now();
    done = cfg[key];
    after?.();
  };
  r.oninput = () => {
    cfg[key] = Number(r.value);
    show();
    if (!after || timer) return;
    const wait = 100 - (performance.now() - at);
    if (wait <= 0) apply();
    else timer = setTimeout(apply, wait);
  };
  r.onchange = () => {
    cfg[key] = Number(r.value);
    if (after && (timer || done !== cfg[key])) apply();
    save();
  };
  return row;
}
// Preset-Knopf: Name, Balken für den Leistungsbedarf (1–3) und eine kurze Zeile, wofür es gut ist.
// Auch das Schnellmenü im Immersiv-Modus baut seine Knöpfe damit.
// Die Balken malt CSS als Hintergrund eines Elements; vorgelesen wird alles über aria-label.
function presetFill(b, k) {
  const meter = el("i", "m-meter");
  meter.dataset.cost = COST[k];
  const name = t("preset_" + k), desc = t("presetDesc_" + k);
  b.dataset.preset = k;
  b.setAttribute("aria-label", `${name}, ${desc}, ${t("costLabel").replace("{c}", t("cost" + COST[k]))}`);
  b.replaceChildren(el("b", "", name), meter, el("small", "", desc));
  return b;
}
function seg(options, value, onPick) {
  // viele Wahlmöglichkeiten (Party-Stile): umbrechen statt aus dem Fenster zu laufen
  const s = el("div", options.length > 6 ? "m-seg is-wrap" : "m-seg");
  s.setAttribute("role", "group");
  for (const [k, label] of options) {
    const b = el("button", "", label);
    b.type = "button";
    b.setAttribute("aria-pressed", String(value === k));
    b.onclick = () => {
      s.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      onPick(k);
    };
    s.append(b);
  }
  return s;
}
// Auswahlliste mit Gruppen (für die vielen Party-Stile – Knöpfe wären eine Wand)
function select(groups, value, onPick, find) {
  const s = el("select", "m-select");
  for (const [label, opts] of groups) {
    let parent = s;
    if (label) {
      parent = el("optgroup");
      parent.label = label;
      s.append(parent);
    }
    for (const [k, text] of opts) {
      const o = el("option", "", text);
      o.value = k;
      o.selected = k === value;
      parent.append(o);
    }
  }
  s.onchange = () => onPick(s.value);
  return find ? findable(s, find, onPick) : s;
}
// Suchfeld über einer langen Auswahlliste (rund 300 Party-Stile): blendet nicht passende Einträge und leere
// Gruppen aus; Enter übernimmt den ersten Treffer. Gesucht wird im Namen und in der Familie, ohne Akzente.
function findable(s, [hint, none], onPick) {
  const wrap = el("div", "m-select-find");
  const q = el("input", "m-text");
  Object.assign(q, { type: "search", placeholder: hint, spellcheck: false });
  q.setAttribute("aria-label", hint);
  const plain = (x) => String(x).toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");
  const note = el("small", "m-note", none);
  note.hidden = true;
  q.oninput = () => {
    const words = plain(q.value).split(/\s+/).filter(Boolean);
    let first = null;
    for (const g of [s, ...s.querySelectorAll("optgroup")]) {
      const opts = g === s ? [...s.children].filter((o) => o.tagName === "OPTION") : [...g.children];
      let any = false;
      for (const o of opts) {
        const text = plain(o.textContent + " " + (g.label || "") + " " + o.value);
        o.hidden = !!words.length && !words.every((w) => text.includes(w)) && o.value !== "auto";
        if (!o.hidden && o.value !== "auto") first ||= o;
        any ||= !o.hidden;
      }
      if (g !== s) g.hidden = !any;
    }
    note.hidden = !words.length || !!first;
    q.first = words.length ? first : null;
  };
  q.onkeydown = (e) => {
    if (e.key !== "Enter" || !q.first) return;
    e.preventDefault();
    s.value = q.first.value;
    onPick(s.value);
  };
  wrap.append(q, s, note);
  return wrap;
}
// Zahl mit eigenem Wort bei 0 („aus“, „beliebig viele“)
const rangeZero = (key, max, zero) => range(key, 0, max, 1, "", null, (v) => v || t(zero));
// Regeln für Songwünsche: nur sichtbar, solange Wünsche an sind (Schalter zeichnet die Einstellungen neu)
function wishRules() {
  const box = el("div", "m-wishrules");
  box.hidden = !cfg.partyWishes;
  const row = el("label", "m-row");
  const txt = el("span");
  txt.append(el("b", "", t("wishBlock")));
  const inp = el("input", "m-text");
  Object.assign(inp, { maxLength: 400, value: cfg.wishBlock || "", placeholder: t("wishBlockPh") });
  inp.dataset.key = "wishBlock";
  inp.onchange = () => {
    cfg.wishBlock = inp.value.slice(0, 400);
    save();
  };
  row.append(txt, inp);
  box.append(head(t("wishRules"), t("wishRulesHint")), rangeZero("wishMax", 5, "wishNoLimit"), row, toggle("wishClean", () => {}), rangeZero("wishAuto", 10, "wishOff"));
  return box;
}
// Fernbedienung: eigener QR-Code nur für dich, nur auf Knopfdruck und nach zwei Minuten wieder weg
// (wer ihn abfotografiert, steuert deine Musik)
function remoteButton() {
  const wrap = el("div", "m-rc");
  const btn = el("button", "m-rc-btn", t("rcBtn"));
  btn.type = "button";
  let hideT = 0;
  const hide = () => {
    clearTimeout(hideT);
    wrap.querySelector(".m-rc-qr")?.remove();
    btn.textContent = t("rcBtn");
    btn.setAttribute("aria-expanded", "false");
  };
  btn.setAttribute("aria-expanded", "false");
  btn.onclick = () => {
    if (wrap.querySelector(".m-rc-qr")) return hide();
    live.remoteInfo().then((info) => {
      if (!btn.isConnected || wrap.querySelector(".m-rc-qr")) return;
      const box = el("div", "m-rc-qr");
      const img = new Image();
      img.alt = t("rcBtn");
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(info.qr);
      box.append(img, el("small", "", t("rcHint")));
      wrap.append(box);
      btn.textContent = t("rcHide");
      btn.setAttribute("aria-expanded", "true");
      hideT = setTimeout(hide, 120e3);
    });
  };
  wrap.append(btn);
  return wrap;
}
// Live-Link: QR-Code direkt unter dem Schalter – sobald er an ist
// 1.27 perf: höchstens EIN Listener – der des zuletzt gebauten Panels. Früher meldete sich der alte erst ab, wenn
// „mirage:live“ feuerte (nur bei Party mit Handys): ohne Party hielt jedes Öffnen der Einstellungen den ganzen
// alten Einstellungsbaum (Tausende Knoten samt Listenern) für immer im Speicher.
let liveOff = null;
function livePanel() {
  liveOff?.();
  const box = el("div", "m-live");
  const draw = () => {
    if (box.dataset.seen && !box.isConnected) return window.removeEventListener("mirage:live", draw);
    box.dataset.seen = "1";
    box.replaceChildren();
    box.hidden = !cfg.partyLive;
    const info = cfg.partyLive && live.info();
    if (!info) return;
    const img = new Image();
    img.alt = "";
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(info.qr);
    const code = el("code", "", t("liveCopy"));
    code.title = info.url;
    code.setAttribute("role", "button");
    code.tabIndex = 0;
    code.onkeydown = (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), code.click());
    code.onclick = () => navigator.clipboard?.writeText(info.url).catch(() => {});
    const txt = el("div");
    txt.append(el("b", "", t("liveTitle")), el("small", "", t("liveHint")), code, el("small", "m-dim", t("liveRelay")), remoteButton());
    box.append(img, txt);
  };
  window.addEventListener("mirage:live", draw);
  liveOff = () => window.removeEventListener("mirage:live", draw);
  if (cfg.partyLive) live.prepare().then(draw, draw);
  draw();
  return box;
}
// Knopfreihen und Auswahllisten haben ihre Beschriftung als eigene Zeile darüber (Überschrift oder Hinweis):
// für Screenreader damit verknüpfen, sonst hört man nur „Gruppe“ ohne zu wissen, wofür
let labelN = 0;
function labelControls(box) {
  for (const c of box.querySelectorAll(".m-seg, .m-select, .m-schemes")) {
    if (c.hasAttribute("aria-labelledby") || c.closest("label")) continue;
    let prev = c.previousElementSibling;
    if (prev?.classList.contains("m-schemes-head")) prev = prev.querySelector("b") || prev;
    if (!prev || !(prev.matches("b, .m-note, .m-schemes-head"))) continue;
    prev.id ||= "m-lbl-" + ++labelN;
    c.setAttribute("aria-labelledby", prev.id);
  }
}
function group(title, open, ...children) {
  const d = el("details", "m-group");
  d.open = open;
  d.append(el("summary", "", title), ...children.filter(Boolean));
  return d;
}
function button(label, onClick, cls = "") {
  const b = el("button", "m-btn " + cls, label);
  b.type = "button";
  b.onclick = onClick;
  return b;
}
const notify = (msg, err) => {
  try { S.showNotification?.(msg, !!err, 3500); } catch {}
};
// „Diesen Bereich zurücksetzen“: nur die Schalter und Regler dieser Gruppe (data-key) plus die genannten
// Auswahlen gehen zurück auf DEFAULTS – eigene Schemata und alles außerhalb der Gruppe bleiben unberührt
function sectionReset(d, extra, after) {
  const row = el("div", "m-actions m-section-reset");
  row.append(button(t("resetSection"), () => {
    const title = d.querySelector("summary").textContent;
    if (!confirm(t("resetSectionConfirm").replace("{s}", title))) return;
    const keys = [...new Set([...[...d.querySelectorAll("[data-key]")].map((x) => x.dataset.key), ...(extra || [])])];
    for (const k of keys) if (k in DEFAULTS) cfg[k] = DEFAULTS[k];
    if (keys.some((k) => PRESET_KEYS.includes(k))) detectPreset();
    save();
    applySettings();
    after?.();
    render.again?.();
    notify(t("resetSectionDone").replace("{s}", title));
  }));
  d.append(row);
  return d;
}
const encode = (prefix, obj) => prefix + btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
const decode = (prefix, text) => {
  const s = String(text || "").trim();
  if (!s.startsWith(prefix)) return null;
  try { return JSON.parse(decodeURIComponent(escape(atob(s.slice(prefix.length))))); } catch { return null; }
};

/* ---------------------------------------------------------------- Einstellungs-Dialog */
// Suche in den Einstellungen: zeigt nur passende Schalter, Regler und Auswahlen (mit ihrer Überschrift) und
// klappt die Gruppen auf, in denen etwas passt. Eine „Einheit“ ist eine Zeile oder eine Beschriftung samt
// den Bedienelementen bis zur nächsten Beschriftung. Gesucht wird in Name und Hinweis in der eigenen Sprache und
// zusätzlich im englischen Text derselben Einstellung (wer „color“ tippt, findet auch „Farben“), ohne Akzente;
// mehrere Wörter müssen alle passen. Treffer leuchten über die CSS-Highlight-API auf (ohne das DOM anzufassen).
let query = "";
const LABEL = ".m-row, .m-schemes-head, .m-note";
const SKIP = "summary, .m-search-bar, .m-search-none, .m-version, .m-sr, .m-section-reset";
const plain = (x) => String(x).toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");
// übersetzter Text → englischer Text (nur einmal gebaut, nur wenn nicht ohnehin Englisch)
let toEn = null;
const english = () => {
  if (toEn) return toEn;
  toEn = new Map();
  if (LANG === "en") return toEn;
  for (const [k, v] of Object.entries(I18N[LANG] || {})) if (typeof v === "string" && typeof I18N.en[k] === "string" && v !== I18N.en[k]) toEn.set(v.trim(), I18N.en[k]);
  return toEn;
};
// englische Wörter, unter denen man eine Einstellung auch sucht
const SYN = {
  color: "colour", colors: "colours", gray: "grey", theme: "scheme colour", palette: "scheme colour",
  battery: "energy power", power: "performance energy", fps: "performance smooth", lag: "performance smooth", slow: "performance",
  speed: "performance", typeface: "font", karaoke: "lyrics", words: "lyrics", text: "lyrics font",
  transparent: "glass blur", strobe: "flash", epilepsy: "flash", photosensitive: "flash", seizure: "flash",
  phone: "live guest", qr: "live", tv: "screen cast", chromecast: "screen cast", cast: "screen",
  backup: "file copy", export: "copy save file", import: "load paste", language: "translate", visualiser: "visualizer",
  spectrum: "visualizer", quiz: "game", games: "game", dark: "bright calm", brightness: "bright",
  shortcut: "keyboard", keys: "keyboard", hotkey: "keyboard", request: "wish",
};
const words = (q) => plain(q).split(/\s+/).filter(Boolean).map((w) => [w, ...(SYN[w] || "").split(" ").filter(Boolean)]);
const haystack = new WeakMap();
function textOf(els) {
  let s = haystack.get(els[0]);
  if (s != null) return s;
  const map = english(), parts = [];
  for (const e of els) {
    parts.push(e.textContent);
    for (const n of [e, ...e.querySelectorAll("b, small, summary, option, button, span")]) {
      const v = n.childNodes.length && n.firstChild.nodeType === 3 ? n.firstChild.data.trim() : "";
      if (v && map.has(v)) parts.push(map.get(v));
    }
  }
  s = plain(parts.join(" "));
  haystack.set(els[0], s);
  return s;
}
const matches = (hay, ws) => ws.every((alts) => alts.some((w) => hay.includes(w)));
// Fundstellen markieren: nur sichtbare Beschriftungen und Hinweise, nur die getippten Wörter
function highlight(box, ws) {
  const H = globalThis.Highlight, reg = globalThis.CSS?.highlights;
  if (!H || !reg) return;
  if (!ws.length) return reg.delete("mirage-hit");
  const ranges = [];
  const tw = document.createTreeWalker(box, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement?.closest("b, small, summary") && !n.parentElement.closest(".m-hide, .m-search-bar, .m-search-none") ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
  });
  for (let n = tw.nextNode(); n && ranges.length < 400; n = tw.nextNode()) {
    const low = n.data.toLowerCase();
    // nur, wo Kleinschreibung die Länge nicht ändert – sonst lägen die Markierungen neben dem Text
    if (low.length !== n.data.length) continue;
    for (const [w] of ws) {
      for (let i = low.indexOf(w); i >= 0 && ranges.length < 400; i = low.indexOf(w, i + w.length)) {
        const r = new Range();
        r.setStart(n, i);
        r.setEnd(n, i + w.length);
        ranges.push(r);
      }
    }
  }
  reg.set("mirage-hit", new H(...ranges));
}
// offene Gruppen vor dem Suchen: nach dem Leeren der Suche genau so wieder
let openBefore = null;
function applySearch(box) {
  const q = query.trim(), ws = words(q);
  const units = [];
  for (const parent of [box, ...box.querySelectorAll("details.m-group")]) {
    let unit = null;
    for (const c of parent.children) {
      if (c.matches(SKIP)) continue;
      if (c.matches(LABEL) || !unit) units.push((unit = { els: [], parent }));
      unit.els.push(c);
    }
  }
  const groups = [...box.querySelectorAll("details.m-group")];
  if (q && !openBefore) {
    openBefore = new Set(groups.filter((d) => d.open).map((d) => d.querySelector("summary").textContent));
    // das Fenster schrumpft beim Tippen nicht zusammen (sonst springt es in der Bildmitte hin und her)
    box.style.minHeight = Math.round(Math.min(box.offsetHeight, innerHeight * 0.7)) + "px";
  }
  const hit = new Set();
  let found = 0;
  for (const u of units) {
    const ok = !q || matches(textOf(u.els), ws);
    for (const e of u.els) e.classList.toggle("m-hide", !ok);
    if (ok && q) {
      hit.add(u.parent);
      found++;
    }
  }
  // beim Suchen stören die Rücksetz-Knöpfe nur: sie gelten für die ganze Gruppe, nicht für die Treffer
  for (const r of box.querySelectorAll(".m-section-reset")) r.classList.toggle("m-hide", !!q);
  for (const d of groups) {
    // passt nur der Gruppenname: die ganze Gruppe zeigen
    const whole = !!q && !hit.has(d) && matches(textOf([d.querySelector("summary")]), ws);
    if (whole) {
      for (const c of d.children) if (!c.matches("summary, .m-section-reset")) c.classList.remove("m-hide");
      found++;
    }
    d.classList.toggle("m-hide", !!q && !hit.has(d) && !whole);
    if (q && (hit.has(d) || whole)) d.open = true;
  }
  if (!q && openBefore) {
    for (const d of groups) d.open = openBefore.has(d.querySelector("summary").textContent);
    openBefore = null;
    box.style.removeProperty("min-height");
  }
  box.querySelector(".m-search-none")?.classList.toggle("m-hide", !q || found > 0);
  box.classList.toggle("is-searching", !!q);
  const count = box.querySelector(".m-search-count");
  if (count) count.textContent = q ? String(found) : "";
  highlight(box, q ? ws : []);
  // Trefferzahl leise ansagen (nur wenn sie sich ändert, sonst redet der Screenreader bei jedem Buchstaben)
  const say = box.querySelector(".m-search-say");
  const msg = !q ? "" : found ? t("searchCount").replace("{n}", found) : t("searchNone");
  if (say && say.textContent !== msg) say.textContent = msg;
}
const SEARCH_IC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true" focusable="false"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5l5 5"/></svg>';
// erstes Bedienelement im ersten Treffer (Enter / Pfeil runter im Suchfeld springt dorthin)
const firstHit = (box) => [...box.querySelectorAll("input:not(.m-search), select, button, summary")].find((x) => !x.closest(".m-hide, .m-search-bar, .m-search-none, .m-section-reset") && shown(x));
function searchBar(box) {
  const bar = el("div", "m-search-bar");
  const ic = el("span", "m-search-ic");
  ic.innerHTML = SEARCH_IC;
  const search = el("input", "m-search");
  Object.assign(search, { type: "search", placeholder: t("searchSettings"), value: query, spellcheck: false, autocomplete: "off" });
  search.setAttribute("aria-label", t("searchSettings"));
  search.setAttribute("aria-keyshortcuts", "Control+F /");
  search.title = t("searchClear");
  const count = el("span", "m-search-count");
  count.setAttribute("aria-hidden", "true");
  const kbd = el("kbd", "m-search-kbd", "/");
  kbd.setAttribute("aria-hidden", "true");
  // höchstens ein Durchlauf pro Bild: schnelles Tippen staut nichts auf
  let raf = 0;
  search.oninput = () => {
    query = search.value;
    if (!raf) raf = requestAnimationFrame(() => ((raf = 0), applySearch(box)));
  };
  search.onkeydown = (e) => {
    // Esc leert zuerst die Suche; erst das zweite Esc schließt das Fenster
    if (e.key === "Escape" && search.value) {
      e.preventDefault();
      e.stopPropagation();
      search.value = query = "";
      applySearch(box);
    } else if ((e.key === "Enter" || e.key === "ArrowDown") && search.value.trim()) {
      const f = firstHit(box);
      if (!f) return;
      e.preventDefault();
      f.focus();
      f.scrollIntoView({ block: "nearest" });
    }
  };
  bar.append(ic, search, count, kbd);
  return { bar, search };
}
function emptyState(box, search) {
  const none = el("div", "m-search-none m-hide");
  const ic = el("span", "m-search-ic");
  ic.innerHTML = SEARCH_IC;
  const clear = button(t("searchReset"), () => {
    search.value = query = "";
    applySearch(box);
    search.focus();
  });
  none.append(ic, el("b", "", t("searchNone")), el("small", "", t("searchNoneHint")), clear);
  return none;
}
// Strg + F oder „/“ springt ins Suchfeld, solange der Dialog offen ist (ein einziger Lauscher, er räumt sich selbst weg)
let findKeys = null;
function bindFind(box) {
  if (findKeys) document.removeEventListener("keydown", findKeys, true);
  findKeys = (e) => {
    if (!box.isConnected) {
      document.removeEventListener("keydown", findKeys, true);
      findKeys = null;
      return;
    }
    const typing = e.target?.matches?.("input:not([type=checkbox]):not([type=range]):not([type=radio]), textarea, select, [contenteditable]");
    const ctrlF = (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.code === "KeyF";
    if (!ctrlF && !(e.key === "/" && !typing && !e.ctrlKey && !e.altKey && !e.metaKey)) return;
    const s = box.querySelector(".m-search");
    if (!s) return;
    e.preventDefault();
    e.stopPropagation();
    s.focus();
    s.select();
  };
  document.addEventListener("keydown", findKeys, true);
}
function render(box) {
  // geschlossener Dialog: nichts neu aufbauen (setPreset/setPerf rufen das auch von außen)
  render.again = () => box.isConnected && render(box);
  const kids = [];
  const { bar, search } = searchBar(box);
  const say = el("span", "m-sr m-search-say");
  say.setAttribute("role", "status");
  kids.push(bar, say, emptyState(box, search));

  // ---- Presets
  kids.push(head(t("presetTitle"), t("presetHint")));
  const order = Object.keys(COST);
  const presets = seg(order.map((k) => [k, t("preset_" + k)]), cfg.preset, (k) => setPreset(k));
  presets.classList.add("m-presets");
  [...presets.children].forEach((b, i) => presetFill(b, order[i]));
  kids.push(presets);
  if (cfg.preset === "custom") kids.push(el("small", "m-note", t("presetCustom")));
  // Energiesparen und Selbst-Drosseln gehören zur Leistung: direkt unter die Presets statt zu den Animationen
  kids.push(
    head(t("eco"), t("ecoHint")),
    seg(["auto", "on", "off"].map((k) => [k, t("eco_" + k)]), cfg.eco, (k) => {
      cfg.eco = k;
      save();
    }),
    toggle("autoPerf")
  );

  // ---- Schemata
  kids.push(head(t("scheme"), t("schemeHint")));
  const pick = el("div", "m-schemes");
  pick.setAttribute("role", "group");
  for (const [name, sc] of Object.entries(SCHEMES)) {
    const b = el("button", "m-scheme");
    b.type = "button";
    b.setAttribute("aria-pressed", String(cfg.scheme === name));
    b.style.setProperty("--s-main", "#" + sc.main);
    b.style.setProperty("--s-a", "#" + sc.button);
    b.style.setProperty("--s-b", "#" + sc.notification);
    b.style.setProperty("--s-c", "#" + sc["button-active"]);
    b.innerHTML = `<span class="m-sw${name === "Mirage" ? " is-live" : ""}"><i></i><i></i><i></i></span><span></span>`;
    b.lastChild.textContent = name;
    b.onclick = () => {
      selectScheme(name);
      render(box);
    };
    if (!BUILT_IN.includes(name)) {
      const x = el("span", "m-scheme-del", "×");
      x.title = t("schemeDelete");
      x.setAttribute("aria-hidden", "true");
      b.setAttribute("aria-label", t("schemeDeleteKey").replace("{s}", name));
      b.setAttribute("aria-keyshortcuts", "Delete");
      b.onkeydown = (e) => e.key === "Delete" && x.click();
      x.onclick = (e) => {
        e.stopPropagation();
        delete cfg.customSchemes[name];
        delete SCHEMES[name];
        if (cfg.scheme === name) cfg.scheme = "Mirage";
        save();
        refreshColors();
        render(box);
      };
      b.append(x);
    }
    pick.append(b);
  }
  kids.push(pick);

  // ---- Farben dieses Songs / dieser Playlist
  const item = currentItem();
  const album = albumUri(item), ctx = contextUri();
  const tools = el("div", "m-actions");
  if (album && current) {
    const pinned = !!cfg.pinned[album];
    tools.append(
      button(t(pinned ? "unpinAlbum" : "pinAlbum"), () => {
        if (pinned) delete cfg.pinned[album];
        else cfg.pinned[album] = current.map((c) => [...c]);
        save();
        notify(t(pinned ? "unpinnedAlbum" : "pinnedAlbum"));
        render(box);
      })
    );
  }
  if (ctx) {
    const own = cfg.playlistSchemes[ctx];
    tools.append(
      button(own ? t("playlistSchemeOff").replace("{s}", own) : t("playlistSchemeOn").replace("{s}", cfg.scheme), () => {
        if (own) delete cfg.playlistSchemes[ctx];
        else cfg.playlistSchemes[ctx] = cfg.scheme;
        save();
        refreshColors();
        render(box);
      })
    );
  }
  if (tools.childElementCount) kids.push(tools);

  // ---- Gruppen
  preloadFonts();
  const fontSeg = seg(Object.keys(FONTS).map((k) => [k, t("font_" + k)]), FONTS[cfg.font] ? cfg.font : "outfit", (k) => {
    cfg.font = k;
    save();
    applyFont();
  });
  Object.keys(FONTS).forEach((k, i) => (fontSeg.children[i].style.fontFamily = stackOf(k)));
  kids.push(sectionReset(group(t("g_colours"), false, toggle("dynamic", refreshColors), toggle("freeze", refreshColors), head(t("font"), t("fontHint")), fontSeg), ["font"], refreshColors));
  kids.push(sectionReset(
    group(
      t("g_background"),
      false,
      toggle("particles"),
      toggle("beat"),
      toggle("grain"),
      toggle("glass"),
      range("bright", 40, 160, 1, " %", () => {
        root.style.setProperty("--m-bright", String(cfg.bright / 100));
        root.classList.toggle("mirage-bright-adjust", cfg.bright !== 100);
      }),
      range("blur", 0, 60, 1, " px", () => root.style.setProperty("--m-blur", cfg.blur + "px"))
    )
  ));
  kids.push(sectionReset(group(t("g_motion"), false, toggle("cascade"), toggle("vinyl"), toggle("tilt"), toggle("burst"), toggle("calm"), toggle("noFlash"))));
  const viz = [
    ["bars", t("viz_bars")], ["wave", t("viz_wave")], ["dots", t("viz_dots")],
    ["particles", t("viz_particles")], ["line", t("viz_line")], ["bottom", t("viz_bottom")], ["tunnel", t("viz_tunnel")],
    ["galaxy", t("viz_galaxy")], ["mountains", t("viz_mountains")], ["scope", t("viz_scope")], ["shatter", t("viz_shatter")],
    // 1.27 views
    ["wavefield", t("viz_wavefield")], ["coverdust", t("viz_coverdust")],
  ];
  kids.push(sectionReset(
    group(
      t("g_immersive"),
      false,
      range("lyrSize", 70, 150, 5, " %", () => immersive.styleLyrics()),
      range("lyrGap", 60, 200, 10, " %", () => immersive.styleLyrics()),
      toggle("onlineLyrics", () => immersive.reloadLyrics()),
      toggle("remoteFix", () => refreshRemote(true)),
      toggle("karaoke", () => immersive.reloadLyrics()),
      // [duet 1.27] Duett-Stimmen farbig (nur Farbe, kein Neuaufbau)
      toggle("lyrVoices", () => immersive.styleLyrics()),
      // i-playful: verspielter Stil (baut den Text neu auf – die Wörter brauchen dann eigene Elemente)
      toggle("lyrPlayful", () => immersive.reloadLyrics()),
      range("syncOffset", -400, 400, 10, " ms", null, (v) => (v > 0 ? "+" : "") + v + " ms"),
      toggle("translate", () => immersive.reloadLyrics()),
      toggle("romanize", () => immersive.reloadLyrics()),
      toggle("canvas", () => immersive.refresh()),
      head(t("vizSection"), t("vizSectionHint")),
      seg(viz, cfg.vizStyle, (k) => {
        cfg.vizStyle = k;
        save();
      }),
      range("vizBars", 48, 180, 12, ""),
      range("vizHeight", 50, 200, 10, " %"),
      range("vizSmooth", 1, 10, 1, ""),
      toggle("vizGlow", () => {}),
      toggle("vizRings", () => {}),
      toggle("vizMirror", () => {}),
      toggle("vizSpin", () => {}),
      toggle("mixInstruments", () => {})
    ), ["vizStyle"], () => (immersive.reloadLyrics(), immersive.refresh(), refreshRemote(true))
  ));
  // ---- Party-Modus: eine eigene Gruppe, darin nach Thema geordnet
  kids.push(sectionReset(
    group(
      t("g_party"),
      false,
      head(t("ps_style"), t("partySectionHint")),
      select(
        [["", [["auto", t("party_auto")]]], ...Object.entries(FAMILIES).map(([f, keys]) => [t("fam_" + f), keys.map((k) => [k, t("party_" + k)])])],
        cfg.partyStyle,
        (k) => {
          cfg.partyStyle = k;
          save();
          immersive.refresh();
        },
        [t("partyFind"), t("partyFindNone")]
      ),
      head(t("partyLevel"), t("partyLevelHint")),
      seg([1, 2, 3, 4, 5].map((n) => [n, t("partyLevel" + n)]), cfg.partyLevel, (k) => {
        cfg.partyLevel = k;
        save();
      }),
      el("small", "m-note", t("partyVenue")),
      seg(["auto", "club", "warehouse", "cellar", "jazzbar", "pub", "neon", "rooftop", "festival", "forest", "desert", "stadium", "beach", "skihut", "space", "cathedral", "hall", "home"].map((k) => [k, t("venue_" + k)]), cfg.partyVenue, (k) => {
        cfg.partyVenue = k;
        save();
      }),
      head(t("ps_light")),
      toggle("partyRig", () => {}),
      toggle("partyInstruments", () => {}),
      toggle("instrSound", () => {}),
      toggle("partyFlash", () => {}),
      toggle("partyLasers", () => {}),
      toggle("partyMelody", () => {}),
      toggle("partyFx", () => {}),
      toggle("partyStrobe", () => {}),
      toggle("partyZoom", () => {}),
      toggle("partyBlend", () => {}),
      head(t("ps_moments")),
      toggle("partyDirector", () => {}),
      toggle("partySlowmo", () => {}),
      toggle("partyDJ", () => {}),
      toggle("partyHype", () => immersive.reloadLyrics()),
      toggle("partyWords", () => immersive.reloadLyrics()),
      toggle("partyHandsUp", () => {}),
      toggle("partyFlashStorm", () => {}),
      toggle("partyFog", () => {}),
      toggle("partyDrones", () => {}),
      toggle("partyShatter", () => {}),
      head(t("ps_crowd")),
      toggle("partyCrowd", () => {}),
      toggle("partyJamLight", () => {}),
      toggle("partyJam", () => {}),
      head(t("ps_extras")),
      toggle("partyLive", () => cfg.partyLive && live.prepare()),
      toggle("partyWishes", () => window.dispatchEvent(new Event("mirage:wishes"))),
      wishRules(),
      toggle("partyReacts", () => {}),
      // ausgeschaltet: wartende und gezeigte Fotos sofort vergessen
      toggle("partyPhotos", () => cfg.partyPhotos || live.clearPhotos()),
      head(t("partyWave"), t("partyWaveHint")),
      seg([[0, t("waveOff")], [1, t("waveSeq")], [2, t("waveGroups")]], cfg.partyWave || 0, (k) => {
        cfg.partyWave = k;
        save();
      }),
      livePanel(),
      toggle("partyScreen", () => immersive.refresh()),
      toggle("partyRecap", () => immersive.refresh()),
      toggle("partyEdge", () => {}),
      toggle("partyOnline", () => immersive.refresh()),
      toggle("partyIdle", () => {}),
      toggle("partyQuietFps", () => {})
    ), ["partyStyle", "partyLevel", "partyVenue"], () => (immersive.reloadLyrics(), immersive.refresh(), window.dispatchEvent(new Event("mirage:wishes")))
  ));

  // ---- Schema-Baukasten
  const builder = el("div", "m-builder");
  const picks = {};
  const base = SCHEMES[cfg.scheme] || SCHEMES.Mirage;
  for (const [k, init] of [["base", base.main], ["accent", base.button], ["deep", base.notification], ["light", base["button-active"]]]) {
    const lab = el("label", "m-color");
    const inp = el("input");
    inp.type = "color";
    inp.value = "#" + init;
    picks[k] = inp;
    lab.append(inp, el("span", "", t("c_" + k)));
    builder.append(lab);
  }
  const nameIn = el("input", "m-text");
  nameIn.placeholder = t("schemeName");
  nameIn.maxLength = 24;
  const codeIn = el("input", "m-text");
  codeIn.placeholder = t("schemeCodeHint");
  nameIn.setAttribute("aria-label", nameIn.placeholder);
  codeIn.setAttribute("aria-label", codeIn.placeholder);
  const saveScheme = (name, colors) => {
    const sc = buildScheme(colors);
    SCHEMES[name] = sc;
    cfg.customSchemes[name] = sc;
    cfg.scheme = name;
    cfg.dynamic = false;
    save();
    refreshColors();
    render(box);
  };
  const colorsNow = () => Object.fromEntries(Object.entries(picks).map(([k, i]) => [k, i.value.slice(1).toUpperCase()]));
  const bActions = el("div", "m-actions");
  bActions.append(
    button(t("schemeSave"), () => {
      const name = nameIn.value.trim().slice(0, 24);
      if (!name || BUILT_IN.includes(name)) return notify(t("schemeNameTaken"), true);
      saveScheme(name, colorsNow());
    }, "is-primary"),
    button(t("schemeCopy"), async () => {
      const code = encode("MIRAGE-SCHEME:", { name: nameIn.value.trim() || "My scheme", colors: colorsNow() });
      try { await navigator.clipboard.writeText(code); notify(t("copied")); } catch { codeIn.value = code; }
    }),
    button(t("schemeImport"), () => {
      const d = decode("MIRAGE-SCHEME:", codeIn.value);
      if (!d?.colors?.accent) return notify(t("badCode"), true);
      const name = BUILT_IN.includes(d.name) ? d.name + " 2" : String(d.name).slice(0, 24);
      saveScheme(name, d.colors);
    })
  );
  kids.push(group(t("g_builder"), false, builder, nameIn, bActions, codeIn));

  // ---- Overlay: Status + passender Installer für dieses System
  const os = String(S.Platform?.operatingSystem || navigator.platform || "").toLowerCase();
  const file = /win/.test(os) ? "Mirage-Overlay-Setup.exe" : /mac|osx|darwin/.test(os) ? "Mirage-Overlay.dmg" : "Mirage-Overlay.AppImage";
  const ovState = el("small", "m-note", t(bridge.connected() ? "overlayConnected" : "overlayMissing"));
  const ovRow = el("div", "m-actions");
  ovRow.append(
    button(t("overlayDownload"), () => window.open(`https://github.com/Passimoritz/spicetify-mirage/releases/latest/download/${file}`, "_blank"), "is-primary"),
    button(t("overlayAllDownloads"), () => window.open("https://github.com/Passimoritz/spicetify-mirage/releases/latest", "_blank"))
  );
  // ---- Bibliothek: Tempo/Tonart in Titellisten · Dubletten-Suche sitzt im Rechtsklick-Menü der Playlists
  kids.push(group(t("g_library"), false, toggle("libBpm", () => bpm.refresh()), el("small", "m-note", t("libDupNote"))));
  kids.push(group(t("g_overlay"), false, toggle("overlay"), ovState, ovRow));

  // ---- Teilen, Sichern, Hilfe
  const foot = el("div", "m-actions");
  const dataIn = el("input", "m-text");
  dataIn.placeholder = t("settingsCodeHint");
  dataIn.setAttribute("aria-label", dataIn.placeholder);
  foot.append(
    button(t("shareNow"), () => nowPlayingCard()),
    button(t("shareWeek"), () => weekCard()),
    button(t("shareMonth"), () => monthCard()),
    button(t("exportSettings"), async () => {
      const code = encode("MIRAGE-SETTINGS:", cfg);
      try { await navigator.clipboard.writeText(code); notify(t("copied")); } catch { dataIn.value = code; }
    }),
    button(t("importSettings"), () => {
      const d = decode("MIRAGE-SETTINGS:", dataIn.value);
      if (!d) return notify(t("badCode"), true);
      Object.assign(cfg, d);
      for (const [n, sc] of Object.entries(cfg.customSchemes || {})) if (!BUILT_IN.includes(n)) SCHEMES[n] = sc;
      save();
      refreshColors();
      render(box);
    }),
    // dieselbe Sicherung als Datei (z. B. für einen zweiten PC)
    button(t("saveFile"), () => {
      const a = el("a");
      a.href = URL.createObjectURL(new Blob([JSON.stringify({ mirage: VERSION, settings: cfg }, null, 2)], { type: "application/json" }));
      a.download = `mirage-settings-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.append(a);
      a.click();
      setTimeout(() => (URL.revokeObjectURL(a.href), a.remove()), 2000);
      notify(t("fileSaved"));
    }),
    button(t("loadFile"), () => {
      const f = el("input");
      f.type = "file";
      f.accept = "application/json,.json";
      f.onchange = async () => {
        let d = null;
        try {
          d = JSON.parse(await f.files[0].text())?.settings;
        } catch {}
        if (!d || typeof d !== "object" || Array.isArray(d)) return notify(t("badCode"), true);
        Object.assign(cfg, d);
        for (const [n, sc] of Object.entries(cfg.customSchemes || {})) if (!BUILT_IN.includes(n)) SCHEMES[n] = sc;
        save();
        refreshColors();
        render(box);
        notify(t("fileLoaded"));
      };
      f.click();
    }),
    button(t("tourAgain"), () => {
      S.PopupModal?.hide?.();
      tour();
    }),
    button(t("diagnostics"), async () => {
      try { await navigator.clipboard.writeText(diagnostics()); notify(t("copied")); } catch { dataIn.value = diagnostics(); }
    }),
    // vorausgefülltes Issue auf GitHub: Versionen und Diagnose sind schon eingetragen
    button(t("reportBug"), () => window.open(reportUrl(), "_blank")),
    button(t("reset"), () => {
      if (!confirm(t("resetConfirm"))) return;
      resetSettings();
      refreshColors();
      render(box);
    }, "is-danger")
  );
  kids.push(group(t("g_more"), false, foot, dataIn));

  kids.push(el("small", "m-note", t("tip")), el("small", "m-note m-version", `Mirage ${VERSION}`));

  // offene Gruppen merken, damit ein Neuaufbau nicht alles zuklappt
  const openNow = [...box.querySelectorAll("details[open] > summary")].map((s) => s.textContent);
  const hadFocus = document.activeElement?.classList.contains("m-search");
  box.replaceChildren(...kids);
  bindFind(box);
  labelControls(box);
  applySearch(box);
  if (hadFocus) search.focus();
  box.querySelectorAll("details > summary").forEach((s) => openNow.includes(s.textContent) && (s.parentElement.open = true));
}

// Fokus im Fenster halten und beim Schließen dorthin zurückgeben, wo er vorher war. Spotifys Fenster macht das
// in der Regel selbst – das hier greift nur, wenn es das nicht tut, und stört sonst nicht.
// zugeklappte Gruppen haben in Chromium weiter ein Layout (content-visibility), sind aber nicht erreichbar
const shown = (x) => (x.checkVisibility ? x.checkVisibility({ visibilityProperty: true }) : x.getClientRects().length > 0);
function modalFocus(box, from) {
  let dlg = null;
  const trap = (e) => {
    if (e.key !== "Tab" || e.ctrlKey || e.altKey || e.metaKey) return;
    const list = [...dlg.querySelectorAll("button, a[href], input, select, textarea, summary, [tabindex]")].filter((x) => !x.disabled && x.tabIndex >= 0 && shown(x));
    const first = list[0], last = list[list.length - 1], cur = document.activeElement;
    const out = !dlg.contains(cur) || !list.includes(cur);
    if (!first || !(out || cur === (e.shiftKey ? first : last))) return;
    e.preventDefault();
    (e.shiftKey ? last : first).focus();
  };
  const mo = new MutationObserver(() => check());
  const check = () => {
    if (box.isConnected) {
      if (dlg) return;
      dlg = box.closest('[role="dialog"], .GenericModal') || box;
      dlg.addEventListener("keydown", trap);
      return;
    }
    if (!dlg) return;
    mo.disconnect();
    dlg.removeEventListener("keydown", trap);
    if (from?.isConnected && (!document.activeElement || document.activeElement === document.body)) from.focus();
  };
  mo.observe(document.body, { childList: true, subtree: true });
  check();
  // Fenster kam nie: nicht ewig lauschen
  setTimeout(() => !dlg && mo.disconnect(), 4000);
}
function openSettings() {
  const from = document.activeElement;
  const box = el("div", "mirage-settings");
  render(box);
  S.PopupModal.display({ title: "Mirage", content: box, isLarge: true });
  modalFocus(box, from);
}

// erster Start: kurz zeigen, wo alles ist
function welcome() {
  const KEY = "mirage:welcomed";
  try {
    if (localStorage.getItem(KEY)) return;
    localStorage.setItem(KEY, VERSION);
  } catch { return; }
  setTimeout(() => tour(true), 5000);
}
// Einführung beim ersten Start: vier kurze Schritte – Farben, Immersiv-Modus, Party, Einstellungen.
// Später jederzeit wieder unter „Teilen, sichern & Hilfe“.
const TOUR = [
  ["tour1t", "tour1"],
  ["tour2t", "tour2", () => immersive.open()],
  ["tour3t", "tour3", () => (immersive.open(), immersive.setMode("party", true))],
  ["tour4t", "tour4", () => openSettings()],
];
// auto = von selbst beim ersten Start: dann nimmt die Karte niemandem den Fokus weg (wer gerade tippt, drückte sonst
// versehentlich „Weiter“), sie wird nur leise angesagt. Von Hand geöffnet springt der Fokus hinein.
function tour(auto) {
  document.querySelector(".mirage-welcome")?.remove();
  const box = el("div", "mirage-welcome");
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-label", t("welcomeTitle"));
  if (auto === true) box.setAttribute("aria-live", "polite");
  const from = document.activeElement;
  let i = 0;
  const end = () => {
    const had = box.contains(document.activeElement);
    box.remove();
    if (had && from?.isConnected) from.focus();
    coachLater();
  };
  box.onkeydown = (e) => {
    if (e.key !== "Escape") return;
    e.stopPropagation();
    end();
  };
  const draw = () => {
    const [tk, k, act] = TOUR[i];
    const dots = el("div", "m-dots");
    dots.setAttribute("aria-hidden", "true");
    TOUR.forEach((_, j) => dots.append(el("i", j === i ? "is-on" : "")));
    const row = el("div", "m-actions");
    if (act) row.append(button(t(k + "Try"), () => { box.remove(); act(); coachLater(); }));
    row.append(
      i < TOUR.length - 1 ? button(t("tourNext"), () => { i++; box.removeAttribute("aria-live"); draw(); }, "is-primary") : button(t("tourDone"), end, "is-primary"),
      button("×", end, "m-close")
    );
    const close = row.querySelector(".m-close");
    close.title = close.ariaLabel = t("k_close");
    box.replaceChildren(el("small", "m-kick", `${i + 1} / ${TOUR.length}`), el("b", "", t(tk)), el("span", "", t(k)), dots, row);
    if (auto !== true || i > 0) box.querySelector(".is-primary")?.focus();
  };
  document.body.append(box);
  // erst einhängen, dann füllen: nur so sagt ein Screenreader den ersten Schritt an
  if (auto === true) setTimeout(draw, 150);
  else draw();
}

// Wegweiser nach der Einführung (einmal im Leben): drei kurze Hinweise direkt an den echten Knöpfen –
// Immersiv-Knopf, Party, Profilmenü mit den Einstellungen. Erst wenn nichts anderes offen ist (Immersiv-Modus,
// Einstellungen, Einführungskarte); fehlt ein Knopf (andere Spotify-Version), steht der Hinweis ohne Pfeil in der Ecke.
// Gemerkt wird schon beim Erscheinen: nach Überspringen, Fertig oder Neustart kommt er nie wieder.
const COACH_KEY = "mirage:coach";
const ORB = ".m-orb-btn";
const PROFILE = '[data-testid="user-widget-link"], .main-userWidget-box, .main-topBar-avatarButton';
const COACH = [
  ["coach1t", "coach1", ORB],
  ["coach2t", "coach2", ORB],
  ["coach3t", "coach3", PROFILE],
];
let coachWait = 0;
function coachLater() {
  try {
    if (localStorage.getItem(COACH_KEY)) return;
  } catch { return; }
  clearTimeout(coachWait);
  const t0 = Date.now();
  (function check() {
    const busy = immersive.isOpen() || document.querySelector(".mirage-settings, .mirage-welcome, .mirage-coach") || document.hidden;
    // nach zwei Minuten voller Beschäftigung: beim nächsten Start der Einführung eben nicht – nicht ewig lauern
    if (busy) return Date.now() - t0 < 120e3 && (coachWait = setTimeout(check, 700));
    coachWait = setTimeout(() => !immersive.isOpen() && !document.querySelector(".mirage-settings, .mirage-welcome") && coach(), 600);
  })();
}
function coach() {
  try {
    if (localStorage.getItem(COACH_KEY)) return;
    localStorage.setItem(COACH_KEY, VERSION);
  } catch { return; }
  const ring = el("div", "m-coach-ring");
  ring.setAttribute("aria-hidden", "true");
  const card = el("div", "mirage-coach");
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-modal", "false");
  card.setAttribute("aria-label", t("welcomeTitle"));
  const from = document.activeElement;
  let i = 0, target = null;
  const place = () => {
    const vw = innerWidth, vh = innerHeight, r = target?.isConnected ? target.getBoundingClientRect() : null;
    const ok = r && r.width > 0 && r.bottom > 0 && r.top < vh;
    card.classList.toggle("is-free", !ok);
    ring.hidden = !ok;
    if (!ok) {
      card.style.removeProperty("left");
      card.style.removeProperty("top");
      return;
    }
    const pad = 6;
    Object.assign(ring.style, { left: r.left - pad + "px", top: r.top - pad + "px", width: r.width + pad * 2 + "px", height: r.height + pad * 2 + "px" });
    const w = card.offsetWidth, h = card.offsetHeight, gap = 16;
    const below = r.bottom + gap + h < vh - 8;
    const x = Math.max(12, Math.min(vw - w - 12, r.left + r.width / 2 - w / 2));
    const y = below ? r.bottom + gap : Math.max(12, r.top - gap - h);
    card.classList.toggle("is-above", !below);
    card.style.left = x + "px";
    card.style.top = y + "px";
    card.style.setProperty("--ax", Math.max(18, Math.min(w - 18, r.left + r.width / 2 - x)) + "px");
  };
  let raf = 0;
  const onResize = () => !raf && (raf = requestAnimationFrame(() => ((raf = 0), place())));
  const end = () => {
    removeEventListener("resize", onResize);
    document.removeEventListener("keydown", onKey, true);
    const had = card.contains(document.activeElement);
    card.remove();
    ring.remove();
    if (had && from?.isConnected) from.focus();
  };
  const onKey = (e) => {
    if (e.key !== "Escape" || !card.isConnected) return;
    e.stopPropagation();
    end();
  };
  const draw = () => {
    const [tk, k, sel] = COACH[i];
    target = [...document.querySelectorAll(sel)].find((x) => x.getClientRects().length) || null;
    const row = el("div", "m-actions");
    const last = i === COACH.length - 1;
    row.append(
      button(t("coachSkip"), end, "m-coach-skip"),
      button(last ? t("tourDone") : t("tourNext"), () => (last ? end() : (i++, draw())), "is-primary")
    );
    card.replaceChildren(el("small", "m-kick", `${i + 1} / ${COACH.length}`), el("b", "", t(tk)), el("span", "", t(k)), row);
    card.classList.remove("is-step");
    // neuer Schritt: kurz einblenden (ohne Bewegung, wenn weniger Bewegung gewünscht ist – das regelt das CSS)
    void card.offsetWidth;
    card.classList.add("is-step");
    place();
    // wer gerade irgendwo tippt, behält den Fokus (sonst landete das nächste Leerzeichen auf „Weiter“)
    const typing = document.activeElement?.matches?.("input, textarea, select, [contenteditable]") && !card.contains(document.activeElement);
    if (!typing) card.querySelector(".is-primary")?.focus({ preventScroll: true });
  };
  document.body.append(ring, card);
  addEventListener("resize", onResize);
  document.addEventListener("keydown", onKey, true);
  draw();
}

export { applySettings, openSettings, welcome, tour, setPreset, setPerf, presetFill };
