// Mirage – Custom App für Spicetify. Eine eigene Seite in Spotifys Seitenleiste: Status von
// Theme und Overlay, Farbschemata, „Deine Woche in Farben“, Schnellaktionen, Overlay-Download
// und die Reparatur nach Spotify-Updates. Spricht über window.Mirage mit dem Theme; ohne Theme
// zeigt sie, wie man es installiert. Kein Build-Schritt: Spicetify lädt diese Datei direkt.

/* global Spicetify */
// eslint-disable-next-line no-unused-vars
function render() {
  return Spicetify.React.createElement(MirageApp, null);
}

const REPO = "https://github.com/Passimoritz/spicetify-mirage";
const h = (...a) => Spicetify.React.createElement(...a);

const TEXT = {
  en: {
    kicker: "Spicetify theme", tagline: "Spotify as frosted glass – every song repaints the interface in its album colours.",
    themeOn: "Theme active", themeOff: "Theme not active", overlayOn: "Overlay connected", overlayOff: "Overlay not running", overlayDisabled: "Overlay off",
    actions: "Right now", immersive: "Immersive mode", settings: "Mirage settings", shareNow: "Share now playing", shareWeek: "Share my week",
    schemes: "Colour scheme", schemesHint: "Switches instantly – Mirage follows the cover live",
    week: "Your week in colours", songs: "songs", minutes: "minutes", topArtists: "Most played", weekEmpty: "Play a few songs – your week fills up here.",
    overlay: "Mirage Overlay", overlayText: "Shows every song change above all windows – on any screen, with lyrics or a visualizer if you like.",
    overlayHow: "Install it with the installer script (Windows) or start.sh (macOS / Linux). The theme finds it automatically.",
    overlayGuide: "Install guide", releases: "Downloads",
    fix: "After a Spotify update", fixText: "Spotify updates overwrite Spicetify. If Mirage is suddenly gone, run the repair once – it fixes Spicetify for every future update too.",
    fixDownload: "Download fix-spicetify.cmd", fixGuide: "Guide for macOS / Linux",
    notActive: "The Mirage theme isn't active yet.", notActiveHow: "Marketplace → Themes → Mirage → Install. Or run install.ps1 from the repository.",
    links: "More", github: "GitHub", discussions: "Show your setup", bug: "Report a problem", diag: "Copy diagnostics", copied: "Copied",
    safe: "Safe mode – Spotify changed its layout. Update Mirage or report it.",
  },
  de: {
    kicker: "Spicetify-Theme", tagline: "Spotify als Milchglas – jeder Song färbt die Oberfläche in seine Albumfarben.",
    themeOn: "Theme aktiv", themeOff: "Theme nicht aktiv", overlayOn: "Overlay verbunden", overlayOff: "Overlay läuft nicht", overlayDisabled: "Overlay aus",
    actions: "Jetzt", immersive: "Immersiv-Modus", settings: "Mirage-Einstellungen", shareNow: "Aktuellen Song teilen", shareWeek: "Meine Woche teilen",
    schemes: "Farbschema", schemesHint: "Wechselt sofort – Mirage folgt live dem Cover",
    week: "Deine Woche in Farben", songs: "Songs", minutes: "Minuten", topArtists: "Am meisten gehört", weekEmpty: "Hör ein paar Songs – hier füllt sich deine Woche.",
    overlay: "Mirage Overlay", overlayText: "Zeigt jeden Songwechsel über allen Fenstern – auf jedem Bildschirm, auf Wunsch mit Liedtext oder Visualizer.",
    overlayHow: "Installieren mit dem Installer-Script (Windows) oder start.sh (macOS / Linux). Das Theme findet es von selbst.",
    overlayGuide: "Anleitung", releases: "Downloads",
    fix: "Nach einem Spotify-Update", fixText: "Spotify-Updates überschreiben Spicetify. Ist Mirage plötzlich weg, einmal die Reparatur starten – sie hält auch für alle künftigen Updates.",
    fixDownload: "fix-spicetify.cmd herunterladen", fixGuide: "Anleitung für macOS / Linux",
    notActive: "Das Mirage-Theme ist noch nicht aktiv.", notActiveHow: "Marketplace → Themes → Mirage → Installieren. Oder install.ps1 aus dem Repository starten.",
    links: "Mehr", github: "GitHub", discussions: "Zeig dein Setup", bug: "Problem melden", diag: "Diagnose kopieren", copied: "Kopiert",
    safe: "Sicherer Modus – Spotify hat seinen Aufbau geändert. Mirage aktualisieren oder melden.",
  },
};
const lang = (() => {
  let l = "";
  try { l = Spicetify.Locale?.getLocale?.() || navigator.language || "en"; } catch {}
  return String(l).toLowerCase().startsWith("de") ? "de" : "en";
})();
const t = (k) => TEXT[lang][k] ?? TEXT.en[k] ?? k;

const STYLE = `
.mirage-app{--g:rgba(255,255,255,.05);--l:rgba(255,255,255,.09);max-width:1180px;margin:0 auto;padding:32px 32px 64px;font-family:var(--m-font,"Segoe UI",system-ui,sans-serif);color:var(--spice-text)}
.mirage-app *{box-sizing:border-box}
.mirage-app .hero{position:relative;overflow:hidden;border-radius:28px;padding:40px 44px;background:linear-gradient(135deg,rgba(var(--spice-rgb-button),.22),rgba(var(--spice-rgb-notification),.14) 60%,rgba(255,255,255,.03));border:1px solid var(--l)}
.mirage-app .kicker{font:600 12px/1 var(--m-mono,ui-monospace,monospace);letter-spacing:.28em;text-transform:uppercase;opacity:.7}
.mirage-app h1{margin:14px 0 10px;font-size:64px;line-height:1;font-weight:800;letter-spacing:-.04em;background:linear-gradient(100deg,#fff 10%,var(--spice-button-active) 50%,var(--spice-button));-webkit-background-clip:text;background-clip:text;color:transparent}
.mirage-app .tagline{max-width:560px;font-size:17px;line-height:1.5;color:var(--spice-subtext)}
.mirage-app .chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:22px}
.mirage-app .chip{display:inline-flex;align-items:center;gap:8px;padding:7px 14px;border-radius:99px;background:var(--g);border:1px solid var(--l);font-size:13px;font-weight:600}
.mirage-app .dot{width:8px;height:8px;border-radius:50%;background:#8a85a0}
.mirage-app .dot.on{background:#3ddc84;box-shadow:0 0 10px #3ddc84}
.mirage-app .dot.warn{background:#ffb547;box-shadow:0 0 10px #ffb547}
.mirage-app .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:18px;margin-top:18px}
.mirage-app .card{border-radius:22px;padding:24px;background:var(--g);border:1px solid var(--l)}
.mirage-app h2{margin:0 0 6px;font-size:19px;font-weight:700}
.mirage-app .muted{color:var(--spice-subtext);font-size:14px;line-height:1.5;margin:0 0 16px}
.mirage-app .btns{display:flex;flex-wrap:wrap;gap:8px}
.mirage-app .btn{border:1px solid var(--l);background:rgba(255,255,255,.06);color:var(--spice-text);font-weight:600;font-size:14px;font-family:inherit;padding:10px 16px;border-radius:99px;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:8px;transition:background .25s,transform .25s}
.mirage-app .btn:hover{background:rgba(var(--spice-rgb-button),.2);transform:translateY(-1px)}
.mirage-app .btn.primary{background:var(--spice-button);color:var(--spice-main);border-color:transparent}
.mirage-app .btn:focus-visible,.mirage-app .scheme:focus-visible{outline:2px solid var(--spice-button-active);outline-offset:2px}
.mirage-app .schemes{display:grid;grid-template-columns:repeat(auto-fill,minmax(118px,1fr));gap:10px}
.mirage-app .scheme{border:1px solid var(--l);border-radius:16px;padding:10px;background:var(--s-main);cursor:pointer;text-align:left;font-weight:600;font-size:13px;font-family:inherit;transition:transform .25s}
.mirage-app .scheme:hover{transform:translateY(-2px)}
.mirage-app .scheme[aria-pressed=true]{outline:2px solid var(--s-a);outline-offset:2px}
.mirage-app .sw{display:flex;gap:4px;margin-bottom:10px}
.mirage-app .sw i{flex:1;height:34px;border-radius:8px}
.mirage-app .stats{display:flex;gap:40px;margin:6px 0 18px}
.mirage-app .big{font-size:44px;font-weight:800;line-height:1}
.mirage-app .small{font-size:13px;color:var(--spice-subtext);margin-top:4px}
.mirage-app .hues{display:flex;height:28px;border-radius:10px;overflow:hidden;margin-bottom:16px;background:var(--g)}
.mirage-app .hues i{height:100%}
.mirage-app ol{margin:0;padding-left:22px;line-height:1.9}
.mirage-app .safe{margin-top:16px;padding:12px 16px;border-radius:14px;background:rgba(255,181,71,.12);border:1px solid rgba(255,181,71,.4);font-size:14px}
`;

// Text auf dem Schema-Kärtchen: hell oder dunkel je nach Hintergrund des Schemas
const ink = (hex) => {
  const n = parseInt(hex, 16);
  return ((n >> 16) & 255) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11 > 150 ? "#1d1a2b" : "#fff";
};

function useMirage() {
  const R = Spicetify.React;
  const [, force] = R.useState(0);
  R.useEffect(() => {
    // leichtes Nachfragen statt Ereignissen: die Seite ist nur offen, solange man sie ansieht
    const id = setInterval(() => force((x) => x + 1), 2000);
    return () => clearInterval(id);
  }, []);
  return window.Mirage || null;
}

function Chip({ state, label }) {
  return h("span", { className: "chip" }, h("span", { className: "dot " + (state || "") }), label);
}

function Week({ M }) {
  const w = M.week();
  const hues = w.hues.map((v, i) => [v, i]).filter(([v]) => v > 0);
  const total = hues.reduce((s, [v]) => s + v, 0);
  const top = Object.entries(w.artists).sort((a, b) => b[1] - a[1]).slice(0, 5);
  return h(
    "div",
    { className: "card" },
    h("h2", null, t("week")),
    w.n
      ? h(
          Spicetify.React.Fragment,
          null,
          h("div", { className: "stats" },
            h("div", null, h("div", { className: "big" }, w.n), h("div", { className: "small" }, t("songs"))),
            h("div", null, h("div", { className: "big" }, Math.round(w.ms / 60000)), h("div", { className: "small" }, t("minutes")))),
          h("div", { className: "hues", "aria-hidden": true },
            hues.map(([v, i]) => h("i", { key: i, style: { width: (v / total) * 100 + "%", background: `hsl(${i * 30 + 15} 75% 60%)` } }))),
          h("div", { className: "small" }, t("topArtists")),
          h("ol", null, top.map(([a, n]) => h("li", { key: a }, `${a} · ${n}×`))),
          h("div", { className: "btns", style: { marginTop: 16 } }, h("button", { className: "btn", onClick: () => M.shareWeek() }, t("shareWeek")))
        )
      : h("p", { className: "muted" }, t("weekEmpty"))
  );
}

function MirageApp() {
  const M = useMirage();
  const [copied, setCopied] = Spicetify.React.useState(false);
  const ov = M?.overlay();
  const health = M?.health() || {};
  const safe = health.checked && (health.missing || []).some((k) => k === "mainView" || k === "nowPlayingBar");
  const link = (href, label, primary) => h("a", { className: "btn" + (primary ? " primary" : ""), href, target: "_blank", rel: "noreferrer" }, label);

  return h(
    "div",
    { className: "mirage-app" },
    h("style", null, STYLE),
    h(
      "section",
      { className: "hero" },
      h("div", { className: "kicker" }, t("kicker") + (M ? ` · v${M.version}` : "")),
      h("h1", null, "Mirage"),
      h("p", { className: "tagline" }, t("tagline")),
      h(
        "div",
        { className: "chips" },
        h(Chip, { state: M ? "on" : "warn", label: M ? t("themeOn") : t("themeOff") }),
        M && h(Chip, { state: ov.connected ? "on" : ov.enabled ? "warn" : "", label: ov.connected ? t("overlayOn") : ov.enabled ? t("overlayOff") : t("overlayDisabled") })
      ),
      safe && h("div", { className: "safe" }, t("safe"))
    ),
    h(
      "div",
      { className: "grid" },
      M
        ? h(
            "div",
            { className: "card" },
            h("h2", null, t("actions")),
            h("p", { className: "muted" }, "Ctrl + Shift + M"),
            h("div", { className: "btns" },
              h("button", { className: "btn primary", onClick: () => M.openImmersive() }, t("immersive")),
              h("button", { className: "btn", onClick: () => M.openSettings() }, t("settings")),
              h("button", { className: "btn", onClick: () => M.shareNow() }, t("shareNow")))
          )
        : h("div", { className: "card" }, h("h2", null, t("notActive")), h("p", { className: "muted" }, t("notActiveHow")), h("div", { className: "btns" }, link(REPO + "#-install", t("overlayGuide"), true))),
      M &&
        h(
          "div",
          { className: "card" },
          h("h2", null, t("schemes")),
          h("p", { className: "muted" }, t("schemesHint")),
          h("div", { className: "schemes" },
            M.schemes().map((s) =>
              h("button", { key: s.name, className: "scheme", "aria-pressed": String(s.active), style: { "--s-main": "#" + s.main, "--s-a": "#" + s.a, color: ink(s.main) }, onClick: () => M.setScheme(s.name) },
                h("div", { className: "sw" }, h("i", { style: { background: "#" + s.a } }), h("i", { style: { background: "#" + s.b } }), h("i", { style: { background: "#" + s.c } })),
                s.name)))
        ),
      M && h(Week, { M }),
      h(
        "div",
        { className: "card" },
        h("h2", null, t("overlay")),
        h("p", { className: "muted" }, t("overlayText") + " " + t("overlayHow")),
        h("div", { className: "btns" }, link(REPO + "#-mirage-overlay", t("overlayGuide"), true), link(REPO + "/releases/latest", t("releases")))
      ),
      h(
        "div",
        { className: "card" },
        h("h2", null, t("fix")),
        h("p", { className: "muted" }, t("fixText")),
        h("div", { className: "btns" },
          link(REPO + "/releases/latest/download/fix-spicetify.cmd", t("fixDownload"), true),
          link(REPO + (lang === "de" ? "/blob/main/README.de.md#-reparieren-nach-einem-spotify-update" : "#-fix-after-a-spotify-update"), t("fixGuide")))
      ),
      h(
        "div",
        { className: "card" },
        h("h2", null, t("links")),
        h("div", { className: "btns" },
          link(REPO, t("github")),
          link(REPO + "/discussions", t("discussions")),
          link(REPO + "/issues/new/choose", t("bug")),
          M &&
            h("button", {
              className: "btn",
              onClick: async () => {
                try {
                  await navigator.clipboard.writeText(M.diagnostics());
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch {}
              },
            }, copied ? t("copied") : t("diag")))
      )
    )
  );
}
