import { SEL } from "./selectors.js";
import { S, root, errors } from "./core.js";
import { cfg } from "./config.js";
import { current, colorDiag } from "./color.js";
import { bridge } from "./bridge.js";

/* ---------------------------------------------------------------- Seitenwechsel-Kaskade */
let enterTimer = 0;
function pageEnter() {
  if (!cfg.cascade || cfg.calm) return;
  const mv = document.querySelector(SEL.mainView);
  if (!mv) return;
  mv.classList.remove("m-enter");
  setTimeout(() => {
    mv.querySelectorAll(SEL.grid).forEach((g) =>
      [...g.children].slice(0, 24).forEach((c, i) => c.style.setProperty("--m-i", i))
    );
    [...mv.querySelectorAll(SEL.rows)].slice(0, 26).forEach((r, i) => r.style.setProperty("--m-i", i));
    void mv.offsetWidth;
    mv.classList.add("m-enter");
    clearTimeout(enterTimer);
    enterTimer = setTimeout(() => mv.classList.remove("m-enter"), 1800);
  }, 70);
}
// Diagnose: große farbige Flächen der aktuellen Seite (inkl. ::before/::after) an die
// Overlay-App melden; sie schreibt sie lokal nach dom-report.json. Nur Aufbau, keine Inhalte.
function domReport() {
  try {
    domReportInner();
  } catch (e) {
    bridge.send({ type: "debug", failed: String(e && e.stack), errors });
  }
}
function domReportInner() {
  // Grobstruktur: 4 Ebenen ab <body> mit Klassen, testids und Größe
  const tree = [];
  (function walk(el, depth) {
    if (depth > 4 || tree.length > 160) return;
    for (const c of el.children) {
      const r = c.getBoundingClientRect();
      tree.push(`${"  ".repeat(depth)}${c.tagName.toLowerCase()}${c.id ? "#" + c.id : ""} .${String(c.className?.baseVal ?? c.className).slice(0, 120)} [${c.dataset?.testid || ""}] ${r.width | 0}x${r.height | 0}`);
      walk(c, depth + 1);
    }
  })(document.body, 0);
  bridge.send({ type: "debug", phase: "tree", hasMainView: !!document.querySelector(SEL.mainView), tree });
  const mv = document.querySelector(SEL.mainView) || document.querySelector("main") || document.body;
  const out = [];
  const minW = mv.clientWidth * 0.4;
  for (const el of mv.querySelectorAll("*")) {
    if (out.length >= 80) break;
    if (el.offsetWidth < minW || el.offsetHeight < 30) continue;
    const r = el.getBoundingClientRect();
    if (r.top > innerHeight) continue;
    const cs = getComputedStyle(el);
    const pseudo = ["::before", "::after"]
      .map((p) => {
        const c = getComputedStyle(el, p);
        return c.content !== "none" && (c.backgroundColor !== "rgba(0, 0, 0, 0)" || c.backgroundImage !== "none")
          ? `${p} ${c.backgroundColor} ${c.backgroundImage.slice(0, 160)} op=${c.opacity}`
          : "";
      })
      .filter(Boolean);
    if (cs.backgroundColor === "rgba(0, 0, 0, 0)" && cs.backgroundImage === "none" && !pseudo.length) continue;
    out.push({
      tag: el.tagName,
      cls: String(el.className?.baseVal ?? el.className).slice(0, 200),
      testid: el.dataset?.testid || "",
      style: (el.getAttribute("style") || "").slice(0, 300),
      bg: cs.backgroundColor,
      img: cs.backgroundImage.slice(0, 200),
      opacity: cs.opacity,
      tint: el.classList.contains("m-tint"),
      rect: [r.left | 0, r.top | 0, r.width | 0, r.height | 0],
      pseudo,
    });
  }
  bridge.send({ type: "debug", page: root.dataset.mPage, url: location.href, report: out, errors, vars: {
    main: getComputedStyle(root).getPropertyValue("--spice-main"), a: getComputedStyle(root).getPropertyValue("--m-a"), dynamic: cfg.dynamic, scheme: cfg.scheme, current, colorDiag,
  } });
}

// Seitentyp aus der Adresse (/user/…, /artist/…, /playlist/…) – unabhängig von Spotifys Klassennamen
function markPage(loc) {
  const path = (loc || S.Platform.History.location || {}).pathname || "";
  root.dataset.mPage = path.split("/")[1] || "home";
}
try {
  S.Platform.History.listen((loc) => {
    markPage(loc);
    pageEnter();
  });
  markPage();
} catch {}

export { pageEnter, domReport, markPage };
