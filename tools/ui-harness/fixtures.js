// Nachbauten echter Spotify-Bausteine (Client 1.3.x, Encore e-<Version>-…) mit Spotifys Klassennamen und Attributen.
// Quelle: die React-Aufrufe in den Bündeln unter %APPDATA%\Spotify\Apps\xpui (ButtonPrimary, ButtonTertiary, Chip,
// PlayButton, Tracklisten-Zeile, Karte, Player-Steuerung …). Kein data-testid, wo der Client keins setzt (Play-Knopf
// auf Karten und im Kopf): Mirage darf sich darauf nicht verlassen.
// data-force="hover focus-visible active" erzwingt Zustände über CDP (DOM.forcePseudoState).
// E = Encore-Präfix, z. B. "e-101040" – wird aus xpui-snapshot.css gelesen, damit ein Update den Nachbau nicht bricht.

const ICON = {
  play: "<path d='m7.05 3.606 13.49 7.788a.7.7 0 0 1 0 1.212L7.05 20.394A.7.7 0 0 1 6 19.788V4.212a.7.7 0 0 1 1.05-.606'/>",
  pause: "<path d='M5.7 3a.7.7 0 0 0-.7.7v16.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V3.7a.7.7 0 0 0-.7-.7zm10 0a.7.7 0 0 0-.7.7v16.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V3.7a.7.7 0 0 0-.7-.7z'/>",
  play16: "<path d='M3 1.713a.7.7 0 0 1 1.05-.607l10.89 6.288a.7.7 0 0 1 0 1.212L4.05 14.894A.7.7 0 0 1 3 14.288z'/>",
  pause16: "<path d='M2.7 1a.7.7 0 0 0-.7.7v12.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V1.7a.7.7 0 0 0-.7-.7zm8 0a.7.7 0 0 0-.7.7v12.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V1.7a.7.7 0 0 0-.7-.7z'/>",
  shuffle: "<path d='M13.151.922a.75.75 0 1 0-1.06 1.06L13.109 3H11.16a3.75 3.75 0 0 0-2.873 1.34l-6.173 7.356A2.25 2.25 0 0 1 .39 12.5H0V14h.391a3.75 3.75 0 0 0 2.873-1.34l6.173-7.356a2.25 2.25 0 0 1 1.724-.804h1.947l-1.017 1.018a.75.75 0 0 0 1.06 1.06L15.98 3.75zM.391 3.5H0V2h.391c1.109 0 2.16.49 2.873 1.34L4.89 5.277l-.979 1.167-1.796-2.14A2.25 2.25 0 0 0 .39 3.5z'/><path d='m7.5 10.723.98-1.167.957 1.14a2.25 2.25 0 0 0 1.724.804h1.947l-1.017-1.018a.75.75 0 1 1 1.06-1.06l2.829 2.828-2.829 2.828a.75.75 0 1 1-1.06-1.06L13.109 13H11.16a3.75 3.75 0 0 1-2.873-1.34l-.787-.938z'/>",
  prev: "<path d='M3.3 1a.7.7 0 0 1 .7.7v5.15l9.95-5.744a.7.7 0 0 1 1.05.606v12.575a.7.7 0 0 1-1.05.607L4 9.149V14.3a.7.7 0 0 1-.7.7H1.7a.7.7 0 0 1-.7-.7V1.7a.7.7 0 0 1 .7-.7z'/>",
  next: "<path d='M12.7 1a.7.7 0 0 0-.7.7v5.15L2.05 1.107A.7.7 0 0 0 1 1.712v12.575a.7.7 0 0 0 1.05.607L12 9.149V14.3a.7.7 0 0 0 .7.7h1.6a.7.7 0 0 0 .7-.7V1.7a.7.7 0 0 0-.7-.7z'/>",
  repeat: "<path d='M0 4.75A3.75 3.75 0 0 1 3.75 1h8.5A3.75 3.75 0 0 1 16 4.75v5a3.75 3.75 0 0 1-3.75 3.75H9.81l1.018 1.018a.75.75 0 1 1-1.06 1.06L6.939 12.75l2.829-2.828a.75.75 0 1 1 1.06 1.06L9.811 12h2.439a2.25 2.25 0 0 0 2.25-2.25v-5a2.25 2.25 0 0 0-2.25-2.25h-8.5A2.25 2.25 0 0 0 1.5 4.75v5A2.25 2.25 0 0 0 3.75 12H5v1.5H3.75A3.75 3.75 0 0 1 0 9.75z'/>",
  add: "<path d='M11.999 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18m-11 9c0-6.075 4.925-11 11-11s11 4.925 11 11-4.925 11-11 11-11-4.925-11-11'/><path d='M17.999 12a1 1 0 0 1-1 1h-4v4a1 1 0 1 1-2 0v-4h-4a1 1 0 1 1 0-2h4V7a1 1 0 1 1 2 0v4h4a1 1 0 0 1 1 1'/>",
  added: "<path d='M1 12C1 5.925 5.925 1 12 1s11 4.925 11 11-4.925 11-11 11S1 18.075 1 12m16.398-2.38a1 1 0 0 0-1.414-1.413l-6.011 6.01-1.894-1.893a1 1 0 0 0-1.414 1.414l3.308 3.308z'/>",
  more: "<path d='M4.5 13.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3m15 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3m-7.5 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3'/>",
  search: "<path d='M10.533 1.27893C5.35215 1.27893 1.12598 5.41887 1.12598 10.5579C1.12598 15.697 5.35215 19.8369 10.533 19.8369C12.767 19.8369 14.8235 19.0671 16.4402 17.7794L20.7929 22.132C21.1834 22.5226 21.8166 22.5226 22.2071 22.132C22.5976 21.7415 22.5976 21.1083 22.2071 20.7178L17.8634 16.3741C19.1616 14.7849 19.94 12.7634 19.94 10.5579C19.94 5.41887 15.7138 1.27893 10.533 1.27893ZM3.12598 10.5579C3.12598 6.55226 6.42768 3.27893 10.533 3.27893C14.6383 3.27893 17.94 6.55226 17.94 10.5579C17.94 14.5636 14.6383 17.8369 10.533 17.8369C6.42768 17.8369 3.12598 14.5636 3.12598 10.5579Z'/>",
};

function make(E) {
  const icon = (name, px = 24) => {
    const vb = /16$|shuffle|prev|next|repeat/.test(name) ? 16 : 24;
    const size = px === 16 ? "smaller" : "base";
    return `<svg data-encore-id="icon" role="img" aria-hidden="true" class="${E}-icon" viewBox="0 0 ${vb} ${vb}" style="--encore-icon-height:var(--encore-graphic-size-decorative-${size});--encore-icon-width:var(--encore-graphic-size-decorative-${size})">${ICON[name]}</svg>`;
  };
  // ButtonPrimary, nur Symbol (Play-Knopf im Kopf, auf Karten; Player-Play mit colorSet invertedLight)
  const primary = ({ size = "large", ic = "play", set = "encore-bright-accent-set", px = 24, attrs = "", label = "Play" } = {}) =>
    `<button data-encore-id="buttonPrimary" data-is-icon-only="true" class="${E}-focus-border ${E}-legacy-button-primary ${E}-legacy-button" aria-label="${label}" ${attrs}>` +
    `<span class="${E}-overflow-wrap-anywhere ${E}-button-primary__inner ${set} ${E}-button-icon-only--${size}">` +
    `<span aria-hidden="true" class="${E}-button__icon-wrapper">${icon(ic, px)}</span></span></button>`;
  // PlayButton-Hülle aus dem Client (main-playButton-PlayButton um ButtonPrimary)
  const playButton = (o = {}) => `<div class="main-playButton-PlayButton" role="div" ${o.wrap || ""}>${primary(o)}</div>`;
  // ButtonPrimary mit Text (Folgen/Speichern-Dialoge …)
  const primaryText = (text, attrs = "") =>
    `<button data-encore-id="buttonPrimary" class="${E}-text-body-medium-bold ${E}-focus-border ${E}-legacy-button-primary ${E}-legacy-button" ${attrs}>` +
    `<span class="${E}-overflow-wrap-anywhere ${E}-button-primary__inner encore-bright-accent-set ${E}-legacy-button--medium">${text}</span></button>`;
  const secondary = (text, attrs = "") =>
    `<button data-encore-id="buttonSecondary" class="${E}-text-body-small-bold ${E}-focus-border ${E}-legacy-button-secondary ${E}-legacy-button-secondary--text-base ${E}-legacy-button ${E}-legacy-button--small encore-internal-color-text-base" ${attrs}>${text}</button>`;
  const tertiary = (ic, { label = "", on = false, px = 24, attrs = "", text = "" } = {}) =>
    text
      ? `<button data-encore-id="buttonTertiary" class="${E}-legacy-button ${E}-legacy-button-tertiary ${E}-overflow-wrap-anywhere ${E}-text-body-small-bold ${E}-focus-border ${E}-legacy-button--small ${E}-button-tertiary--small encore-internal-color-text-subdued" ${attrs}>${text}</button>`
      : `<button data-encore-id="buttonTertiary" aria-label="${label}" class="${E}-legacy-button ${E}-legacy-button-tertiary ${E}-overflow-wrap-anywhere ${E}-focus-border ${E}-button-tertiary--icon-only-${px === 16 ? "small" : "medium"} ${E}-button-tertiary--icon-only encore-internal-color-text-${on ? "bright-accent" : "subdued"}" ${attrs}>` +
        `<span aria-hidden="true" class="${E}-button__icon-wrapper">${icon(ic, px)}</span></button>`;
  const chip = (text, { on = false, attrs = "" } = {}) =>
    `<button role="checkbox" aria-checked="${on}" data-encore-id="chip" class="${E}-chip ${E}-overflow-wrap-anywhere ${E}-chip--small ${E}-variant--${on ? "contrasting" : "tinted"} ${E}-variant--interactive encore-internal-color-text-base ${on ? "encore-inverted-light-set" : ""} ${E}-focus-border" ${attrs}>` +
    `<span data-encore-id="text" class="${E}-text-body-small ${E}-chip__label">${text}</span></button>`;
  const cover = (n, size = 40) =>
    `<img aria-hidden="false" draggable="false" loading="eager" alt="" width="${size}" height="${size}" class="main-image-image" style="width:${size}px;height:${size}px;background:linear-gradient(135deg,rgb(var(--m-c-rgb)),rgb(var(--m-b-rgb)));border:0" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='4'%3E%3C/svg%3E" data-n="${n}">`;

  // Tracklisten-Zeile (main-trackList-*, Zustände: aktiv = Q_VN_…, ausgewählt = cBaCr…)
  const row = (i, title, { active = false, selected = false, attrs = "" } = {}) => `
<div role="row" aria-rowindex="${i + 1}" aria-selected="${selected}">
 <div data-testid="tracklist-row" class="main-trackList-trackListRow main-trackList-trackListRowGrid${active ? " Q_VN_DjnfmJnnbShT4rU" : ""}${selected ? " cBaCr8a86htxgcL815Aw" : ""}" draggable="true" role="presentation" ${attrs}>
  <div class="main-trackList-rowSectionIndex" role="gridcell" aria-colindex="1" tabindex="-1">
   <div class="main-trackList-rowMarker">${active ? `<img class="fF97jAvlGYYHbI3_vPlV" width="14" height="14" alt="" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 14 14' fill='%23b69cff'%3E%3Crect x='1' y='4' width='2' height='10'/%3E%3Crect x='6' y='1' width='2' height='13'/%3E%3Crect x='11' y='6' width='2' height='8'/%3E%3C/svg%3E">` : `<span class="${E}-text-body-medium main-trackList-number" data-encore-id="text">${i}</span>`}
    <button class="main-trackList-rowImagePlayButton" aria-label="Play" tabindex="-1">${icon(active ? "pause16" : "play16", 16).replace(`class="${E}-icon"`, `class="${E}-icon main-trackList-rowImagePlayIcon"`)}</button>
   </div>
  </div>
  <div class="main-trackList-rowSectionStart" role="gridcell" aria-colindex="2" tabindex="-1">
   ${cover(i)}
   <div class="main-trackList-rowMainContent">
    <a draggable="false" class="${E}-text-body-medium main-trackList-rowTitle standalone-ellipsis-one-line main-trackList-rowMainContentTitle" data-encore-id="text" dir="auto" href="#" tabindex="-1">${title}</a>
    <span class="${E}-text-body-small encore-internal-color-text-subdued main-trackList-rowSubTitle standalone-ellipsis-one-line main-trackList-rowMainContentSubTitle" data-encore-id="text"><a href="#" tabindex="-1">Mirage Ensemble</a></span>
   </div>
  </div>
  <div class="main-trackList-rowSectionVariable" role="gridcell" aria-colindex="3" tabindex="-1"><span data-encore-id="text" class="${E}-text-body-small encore-internal-color-text-subdued"><a href="#" tabindex="-1">Glass Hours</a></span></div>
  <div class="main-trackList-rowSectionEnd" role="gridcell" aria-colindex="5" tabindex="-1">
   ${tertiary("added", { label: "Add to playlist", on: true, px: 16 }).replace("<button ", '<button aria-checked="true" ').replace(`class="${E}-legacy-button `, `class="main-trackList-rowAddToPlaylistButton ${E}-legacy-button `)}
   <div class="${E}-text-body-small encore-internal-color-text-subdued main-trackList-rowDuration" data-encore-id="text">3:4${i}</div>
   ${tertiary("more", { label: "More options", px: 16 }).replace(`class="${E}-legacy-button `, `class="main-trackList-rowMoreButton ${E}-legacy-button `)}
  </div>
 </div>
</div>`;

  const card = (title, attrs = "", btnAttrs = "") => `
<div class="Card" style="width:180px">
 <div data-encore-id="card" role="group" class="${E}-legacy-box ${E}-legacy-box--naked ${E}-legacy-box--interactive ${E}-card ofahUhwV8VMlglXFA3hw main-card-card" ${attrs}>
  <div class="${E}-card__on-click"></div>
  <div class="main-card-imageContainer" style="position:relative">
   <div data-encore-id="cardImage" class="${E}-card-image" style="aspect-ratio:1;border-radius:6px;background:linear-gradient(135deg,rgb(var(--m-c-rgb)),rgb(var(--m-a-rgb)) 55%,rgb(var(--m-b-rgb)))"></div>
   <div class="main-card-PlayButtonContainer">${playButton({ size: "medium", attrs: btnAttrs })}</div>
  </div>
  <a href="#" class="${E}-text-body-medium-bold main-card-cardTitleLink ${E}-card-title" data-encore-id="cardTitle">${title}</a>
  <div class="${E}-text-body-small encore-internal-color-text-subdued" data-encore-id="cardSubtitle">Playlist · Mirage</div>
 </div>
</div>`;

  const playerBar = ({ playing = false, ppAttrs = "" } = {}) => `
<div class="Root__now-playing-bar"><footer data-testid="now-playing-bar" aria-label="Now playing bar" style="height:88px;display:flex;align-items:center;gap:16px;padding:0 16px">
 <div data-testid="now-playing-widget" class="main-nowPlayingWidget-nowPlaying" style="display:flex;align-items:center;gap:12px;width:220px">
  <div class="main-nowPlayingWidget-coverArt"><div data-testid="CoverSlotCollapsed__container" class="main-coverSlotCollapsed-container">${cover(1, 56)}</div></div>
  <div class="main-nowPlayingWidget-trackInfo"><div class="${E}-text-body-small-bold" data-encore-id="text">Glass Hours</div><div class="${E}-text-marginal encore-internal-color-text-subdued" data-encore-id="text">Mirage Ensemble</div></div>
 </div>
 <div class="main-nowPlayingBar-center" style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px">
  <div data-testid="player-controls" class="player-controls" style="width:100%;max-width:722px"><div class="player-controls__buttons" style="justify-content:center;align-items:center">
   ${tertiary("shuffle", { label: "Disable shuffle", on: true, px: 16, attrs: 'role="switch" aria-checked="true" data-testid="control-button-shuffle"' }).replace(`class="${E}-legacy-button `, `class="rVP4Py0UWqb62dKlro_h ${E}-legacy-button `)}
   ${tertiary("prev", { label: "Previous", px: 16, attrs: 'data-testid="control-button-skip-back"' })}
   ${primary({ size: "small", ic: playing ? "pause16" : "play16", px: 16, set: "encore-inverted-light-set", label: playing ? "Pause" : "Play", attrs: 'data-testid="control-button-playpause" ' + ppAttrs })}
   ${tertiary("next", { label: "Next", px: 16, attrs: 'data-testid="control-button-skip-forward"' })}
   ${tertiary("repeat", { label: "Enable repeat", px: 16, attrs: 'role="checkbox" aria-checked="false" data-testid="control-button-repeat"' })}
  </div></div>
  <div class="playback-bar" style="display:flex;align-items:center;gap:8px;width:100%;max-width:520px">
   <div data-testid="playback-position" class="${E}-text-body-small encore-internal-color-text-subdued playback-bar__progress-time-elapsed" data-encore-id="text">1:24</div>
   <div data-testid="playback-progressbar" class="playback-progressbar playback-progressbar-isInteractive" style="flex:1;height:12px;position:relative">
    <div data-testid="progress-bar" class="progress-bar" style="--progress-bar-height:4px;--progress-bar-radius:2px;--progress-bar-transform:42%;--fg-color:var(--spice-text);--bg-color:rgba(var(--spice-rgb-text),.3);--is-active-fg-color:var(--spice-button);height:12px;position:relative">
     <div data-testid="progress-bar-background" class="x-progressBar-progressBarBg"><div class="x-progressBar-sliderArea"><div class="x-progressBar-fillColor"></div></div></div>
     <div data-testid="progress-bar-handle" class="progress-bar__slider" style="display:flex"></div>
    </div>
   </div>
   <div data-testid="playback-duration" class="${E}-text-body-small encore-internal-color-text-subdued main-playbackBarRemainingTime-container" data-encore-id="text">3:41</div>
  </div>
 </div>
 <div style="width:220px;display:flex;justify-content:flex-end">${tertiary("more", { label: "More", px: 16 })}</div>
</footer></div>`;

  const actionBar = (pb = {}) => `
<div class="main-actionBar-ActionBar contentSpacing" data-testid="action-bar">
 <div class="main-actionBar-ActionBarRow" data-testid="action-bar-row" style="display:flex;align-items:center;gap:24px">
  ${playButton({ size: "large", ...pb })}
  ${tertiary("shuffle", { label: "Shuffle", on: true, attrs: 'role="switch" aria-checked="true"' })}
  ${tertiary("add", { label: "Save to Your Library" })}
  ${tertiary("more", { label: "More options" })}
 </div>
</div>`;

  return [
    {
      name: "play-header",
      title: "Play im Kopf (Playlist/Album)",
      cells: [
        ["ruhig", actionBar()],
        ["Hover", actionBar({ attrs: 'data-force="hover"' })],
        ["gedrückt", actionBar({ attrs: 'data-force="hover active"' })],
        ["Tastatur-Fokus", actionBar({ attrs: 'data-force="focus focus-visible"' })],
        ["spielt", actionBar({ ic: "pause", label: "Pause" })],
      ],
    },
    {
      name: "play-card",
      title: "Karten: Play beim Überfahren",
      cells: [
        ["ruhig", card("Daily Mix 1")],
        ["Karte Hover", card("Daily Mix 1", 'data-force="hover"', "")],
        ["Knopf Hover", card("Daily Mix 1", 'data-force="hover"', 'data-force="hover"')],
        ["Knopf Fokus", card("Daily Mix 1", 'data-force="focus-within"', 'data-force="focus focus-visible"')],
      ],
      wide: true,
    },
    {
      name: "tracklist",
      title: "Tracklisten-Zeilen",
      cells: [
        [
          "ruhig · Hover · spielt · ausgewählt · ausgewählt+Hover",
          `<div role="grid" class="main-trackList-trackList main-trackList-indexable" style="--tracklist-index-column-width:16px;--row-height:56px;--grid-template-columns:[index] 16px [first] 4fr [var1] 2fr [last] minmax(120px,1fr);width:100%">
           ${row(1, "Ruhige Zeile")}${row(2, "Zeile unter der Maus", { attrs: 'data-force="hover"' })}${row(3, "Läuft gerade", { active: true })}${row(4, "Ausgewählt", { selected: true })}${row(5, "Ausgewählt + Maus", { selected: true, attrs: 'data-force="hover"' })}</div>`,
        ],
      ],
      full: true,
    },
    {
      name: "player-bar",
      title: "Player-Leiste",
      cells: [
        ["pausiert", playerBar()],
        ["Play Hover", playerBar({ ppAttrs: 'data-force="hover"' })],
        ["spielt (mirage-playing)", `<div class="mirage-playing">${playerBar({ playing: true })}</div>`],
        ["Play Fokus", playerBar({ ppAttrs: 'data-force="focus focus-visible"' })],
      ],
      full: true,
    },
    {
      name: "buttons",
      title: "Knöpfe & Chips",
      cells: [
        ["Hauptknopf", primaryText("Speichern")],
        ["Hauptknopf Hover", primaryText("Speichern", 'data-force="hover"')],
        ["Nebenknopf", secondary("Folgen")],
        ["Nebenknopf Hover", secondary("Folgen", 'data-force="hover"')],
        ["Textknopf", tertiary(null, { text: "Alle anzeigen" })],
        ["Textknopf Hover", tertiary(null, { text: "Alle anzeigen", attrs: 'data-force="hover"' })],
        ["Chips", `<div style="display:flex;gap:8px">${chip("Playlists", { on: true })}${chip("Alben")}${chip("Künstler", { attrs: 'data-force="hover"' })}</div>`],
      ],
    },
    {
      name: "search",
      title: "Suche oben",
      cells: [
        ["ruhig", search()],
        ["Fokus", search('data-force="focus focus-visible"')],
      ],
    },
    {
      name: "context-menu",
      title: "Kontextmenü",
      cells: [["Menü (2. Eintrag Hover)", contextMenu()]],
    },
  ];

  function search(attrs = "") {
    return `<div class="main-globalNav-searchSection"><div class="main-globalNav-searchContainer" style="width:420px"><form role="search">
     <div class="main-globalNav-searchInputContainer" style="position:relative;display:flex;align-items:center;height:48px;padding:0 12px;gap:8px">
      ${icon("search")}
      <input data-testid="search-input" class="${E}-text-body-medium main-globalNav-searchInputText" placeholder="Was möchtest du hören?" maxlength="800" autocorrect="off" autocapitalize="off" spellcheck="false" style="flex:1;height:40px;border:0;background:none;color:var(--spice-text);font-size:16px" ${attrs}>
     </div></form></div></div>`;
  }
  function contextMenu() {
    const item = (t, a = "") =>
      `<li role="presentation" class="main-contextMenu-menuItem"><button class="main-contextMenu-menuItemButton" role="menuitem" tabindex="-1" ${a}><span class="${E}-text-body-small main-contextMenu-menuItemLabel" data-encore-id="text" dir="auto">${t}</span></button></li>`;
    return `<div class="main-contextMenu-tippy" style="width:260px"><ul tabindex="0" role="menu" data-depth="0" class="main-contextMenu-menu" style="padding:4px;list-style:none;margin:0">${item("Zur Playlist hinzufügen")}${item("Zur Warteschlange", 'data-force="hover"')}${item("Zum Radio des Songs")}${item("Teilen")}</ul></div>`;
  }
}

module.exports = { make };
