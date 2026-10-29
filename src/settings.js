import { S, root, VERSION } from "./core.js";
import { t } from "./i18n.js";
import { SCHEMES, BUILT_IN, applyScheme, cfg, save, resetSettings, buildScheme } from "./config.js";
import { current } from "./color.js";
import { beat } from "./audio.js";
import { dust } from "./dust.js";
import { bridge } from "./bridge.js";
import { immersive } from "./immersive.js";
import { onSong, contextUri, albumUri, effectiveScheme } from "./song.js";
import { currentItem } from "./player.js";
import { PRESET_KEYS, applyPreset, detectPreset } from "./perf.js";
import { recheckAll } from "./readability.js";
import { diagnostics } from "./selectors.js";
import { nowPlayingCard, weekCard } from "./share.js";

function applySettings() {
  applyScheme(effectiveScheme());
  root.classList.toggle("mirage-vinyl", cfg.vinyl);
  root.classList.toggle("mirage-no-tilt", !cfg.tilt);
  root.classList.toggle("mirage-no-grain", !cfg.grain);
  root.classList.toggle("mirage-calm", cfg.calm);
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
// teure Effekte tragen ein ⚡ – so sieht man, was man für mehr Akku abschaltet
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
function toggle(key, after) {
  const row = el("label", "m-row");
  const txt = el("span");
  const b = el("b", "", t(key));
  if (COSTLY.has(key)) {
    const bolt = el("i", "m-cost", "⚡");
    bolt.title = t("costly");
    b.append(" ", bolt);
  }
  txt.append(b);
  const hint = t(key + "Hint");
  if (hint !== key + "Hint") txt.append(el("small", "", hint));
  const cb = el("input");
  cb.type = "checkbox";
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
function range(key, min, max, step, unit, after) {
  const row = el("label", "m-row");
  const txt = el("span");
  const hint = el("small", "", cfg[key] + unit);
  txt.append(el("b", "", t(key)), hint);
  const r = el("input");
  Object.assign(r, { type: "range", min, max, step, value: cfg[key] });
  r.oninput = () => {
    cfg[key] = Number(r.value);
    hint.textContent = r.value + unit;
    save();
    after?.();
  };
  row.append(txt, r);
  return row;
}
function seg(options, value, onPick) {
  const s = el("div", "m-seg");
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
const encode = (prefix, obj) => prefix + btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
const decode = (prefix, text) => {
  const s = String(text || "").trim();
  if (!s.startsWith(prefix)) return null;
  try { return JSON.parse(decodeURIComponent(escape(atob(s.slice(prefix.length))))); } catch { return null; }
};

/* ---------------------------------------------------------------- Einstellungs-Dialog */
function render(box) {
  render.again = () => render(box);
  const kids = [];

  // ---- Presets
  kids.push(head(t("presetTitle"), t("presetHint")));
  kids.push(
    seg(
      [["full", t("preset_full")], ["balanced", t("preset_balanced")], ["light", t("preset_light")], ["calm", t("preset_calm")]],
      cfg.preset,
      (k) => {
        applyPreset(k);
        applySettings();
        render(box);
      }
    )
  );
  if (cfg.preset === "custom") kids.push(el("small", "m-note", t("presetCustom")));

  // ---- Schemata
  kids.push(head(t("scheme"), t("schemeHint")));
  const pick = el("div", "m-schemes");
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
  kids.push(group(t("g_colours"), false, toggle("dynamic", refreshColors), toggle("freeze", refreshColors)));
  kids.push(
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
  );
  kids.push(group(t("g_motion"), false, toggle("cascade"), toggle("vinyl"), toggle("tilt"), toggle("burst"), toggle("calm"), toggle("autoPerf")));
  const viz = [
    ["bars", t("viz_bars")], ["wave", t("viz_wave")], ["dots", t("viz_dots")],
    ["particles", t("viz_particles")], ["line", t("viz_line")], ["bottom", t("viz_bottom")],
  ];
  kids.push(
    group(
      t("g_immersive"),
      false,
      range("lyrSize", 70, 150, 5, " %", () => immersive.styleLyrics()),
      range("lyrGap", 60, 200, 10, " %", () => immersive.styleLyrics()),
      toggle("onlineLyrics", () => immersive.reloadLyrics()),
      toggle("translate", () => immersive.reloadLyrics()),
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
      toggle("vizSpin", () => {})
    )
  );

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
  kids.push(group(t("g_overlay"), false, toggle("overlay"), ovState, ovRow));

  // ---- Teilen, Sichern, Hilfe
  const foot = el("div", "m-actions");
  const dataIn = el("input", "m-text");
  dataIn.placeholder = t("settingsCodeHint");
  foot.append(
    button(t("shareNow"), () => nowPlayingCard()),
    button(t("shareWeek"), () => weekCard()),
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
    button(t("diagnostics"), async () => {
      try { await navigator.clipboard.writeText(diagnostics()); notify(t("copied")); } catch { dataIn.value = diagnostics(); }
    }),
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
  box.replaceChildren(...kids);
  box.querySelectorAll("details > summary").forEach((s) => openNow.includes(s.textContent) && (s.parentElement.open = true));
}

function openSettings() {
  const box = el("div", "mirage-settings");
  render(box);
  S.PopupModal.display({ title: "Mirage", content: box, isLarge: true });
}

// erster Start: kurz zeigen, wo alles ist
function welcome() {
  const KEY = "mirage:welcomed";
  try {
    if (localStorage.getItem(KEY)) return;
    localStorage.setItem(KEY, VERSION);
  } catch { return; }
  setTimeout(() => {
    const box = el("div", "mirage-welcome");
    box.setAttribute("role", "status");
    box.append(el("b", "", t("welcomeTitle")), el("span", "", t("welcomeText")));
    const row = el("div", "m-actions");
    row.append(
      button(t("welcomeImmersive"), () => { box.remove(); immersive.open(); }, "is-primary"),
      button(t("menu"), () => { box.remove(); openSettings(); }),
      button("×", () => box.remove(), "m-close")
    );
    box.append(row);
    document.body.append(box);
    setTimeout(() => box.isConnected && box.classList.add("is-gone"), 20000);
  }, 5000);
}

export { applySettings, openSettings, welcome };
