/* Mirage – Demo-Seite. Ohne Build, ohne fremde Skripte.
   Farben: dieselbe Rechnung wie src/color.js + src/hsl.js (64×64 abtasten → quantize → shape → onGround). */
(function () {
  "use strict";

  /* ================================================================ Farbe (aus src/hsl.js) */
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const hueGap = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
  const rgb2hsl = ([r, g, b]) => {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return [0, 0, l];
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h * 60, s, l];
  };
  const hsl2rgb = ([h, s, l]) => {
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [f(0), f(8), f(4)].map((v) => Math.round(v * 255));
  };
  const lum = (rgb) => {
    const [r, g, b] = rgb.map((v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (x, y) => {
    const [hi, lo] = [lum(x), lum(y)].sort((p, q) => q - p);
    return (hi + 0.05) / (lo + 0.05);
  };
  function readable([h, s, l], bg, step, min = 4.5) {
    let rgb = hsl2rgb([h, s, l]);
    for (let i = 0; i < 12 && contrast(rgb, bg) < min; i++) rgb = hsl2rgb([h, s, (l = clamp(l + step, 0.05, 0.95))]);
    return rgb;
  }
  const INK = [11, 10, 18];
  const PAPER = [244, 241, 250];
  function onGround(hsA, hsB, hsC, light) {
    const bg = light ? PAPER : INK;
    const a = readable([hsA[0], hsA[1], light ? 0.42 : 0.68], bg, light ? -0.04 : 0.04);
    const b = light ? readable([hsB[0], hsB[1], 0.4], PAPER, -0.04, 3) : readable([hsB[0], hsB[1], 0.52], [10, 23, 29], 0.04, 3);
    const c = readable([hsC[0], hsC[1], light ? 0.3 : 0.84], bg, light ? -0.04 : 0.04);
    return [a, b, c];
  }
  const darkGround = (pal) => {
    const hs = pal.map((c) => rgb2hsl(c).slice(0, 2));
    return onGround(hs[0], hs[1], hs[2], false);
  };
  // aus src/color.js
  function shape(colors) {
    const [h1, s1] = rgb2hsl(colors[0]);
    const second = colors[1] ? rgb2hsl(colors[1]) : null;
    if (s1 < 0.08 && (!second || second[1] < 0.08)) return null;
    const gray = s1 < 0.12;
    const sec = second || [(h1 + 40) % 360, s1, 0.5];
    return onGround(
      [h1, gray ? s1 : clamp(s1, 0.5, 0.95)],
      [sec[0], gray ? sec[1] : clamp(sec[1], 0.45, 0.95)],
      [(h1 + 12) % 360, gray ? s1 : clamp(s1 * 0.8, 0.35, 0.85)],
      false,
    );
  }
  function quantize(data) {
    const buckets = new Map();
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 200) continue;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      const e = buckets.get(key) || { r: 0, g: 0, b: 0, n: 0 };
      e.r += r; e.g += g; e.b += b; e.n++;
      buckets.set(key, e);
    }
    const ranked = [...buckets.values()]
      .map((e) => {
        const rgb = [e.r / e.n, e.g / e.n, e.b / e.n].map(Math.round);
        const [h, s, l] = rgb2hsl(rgb);
        const lightOk = l > 0.12 && l < 0.92 ? 1 : 0.15;
        return { rgb, h, s, score: e.n * (0.2 + s * s * 2) * lightOk };
      })
      .sort((x, y) => y.score - x.score);
    if (!ranked.length) return null;
    const first = ranked[0];
    const partner = ranked.find((c) => hueGap(c.h, first.h) > 28 && c.s > 0.15) || null;
    return shape([first.rgb, partner && partner.rgb]);
  }
  const hexRgb = (h) => [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  const rgbHex = (c) => "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
  const css = (c, a) => (a == null ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${a})`);
  const mix = (x, y, f) => x.map((v, i) => Math.round(v + (y[i] - v) * f));

  // Schreibweise wie Mirage/color.ini (button / notification / button-active)
  const SCHEMES = {
    Mirage: { main: "07060C", text: "F5F3FF", sub: "B9B4CC", a: "B69CFF", b: "7C5CFF", c: "D4C6FF" },
    Obsidian: { main: "050505", text: "F2F2F2", sub: "A8A8A8", a: "E8E8E8", b: "707070", c: "FFFFFF" },
    Sakura: { main: "0E070B", text: "FFF2F6", sub: "D9B3C1", a: "FF8FB8", b: "E0507F", c: "FFB8D2" },
    Abyss: { main: "03090C", text: "EAFBFF", sub: "9CC3CF", a: "4FE3FF", b: "1AA6C2", c: "9AF0FF" },
    Ember: { main: "0C0705", text: "FFF6EE", sub: "D6B8A0", a: "FF9F45", b: "E06A1A", c: "FFC48A" },
    Pearl: { main: "F4F1FA", text: "1D1A2B", sub: "5D5873", a: "6B4EE6", b: "7C5CFF", c: "4F35C9", light: true },
  };
  const schemePal = (n) => [SCHEMES[n].a, SCHEMES[n].b, SCHEMES[n].c].map(hexRgb);

  /* ================================================================ Grundlagen */
  const root = document.documentElement;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduceQ = matchMedia("(prefers-reduced-motion: reduce)");
  let reduced = reduceQ.matches;
  const DPR = () => Math.min(2, window.devicePixelRatio || 1);
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* privat */ } },
  };
  const fmt = (ms) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };
  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // Schranke für Blitze wie src/flashcap.js: mind. 0,34 s Abstand → höchstens 3 pro Sekunde
  const flashCap = (() => {
    let last = -Infinity;
    return (t) => {
      if (t < last) last = t;
      if (t - last < 340) return false;
      last = t;
      return true;
    };
  })();

  /* ================================================================ Sprache */
  const T = {
    en: {
      skip: "Skip to content", navTheme: "Theme", navImm: "Immersive", navParty: "Party", navOverlay: "Overlay", navInstall: "Install",
      heroEyebrow: "Spicetify theme · free and open source", heroT1: "Spotify, made of", heroT2: "glass and light.",
      heroLede: "Mirage turns Spotify into frosted glass. Behind it, the album cover drifts like a soft mist, and every song repaints the buttons, titles and progress bar in its own colours.",
      ctaInstall: "Install Mirage", ctaTry: "Try it below", appAria: "Spotify with Mirage (demo)", search: "What do you want to play?",
      library: "Your Library", chipPl: "Playlists", chipAl: "Albums", chipAr: "Artists", playlist: "Public playlist", nowPlaying: "Now playing",
      like: "Like this song", colTitle: "Title", colAlbum: "Album", npView: "Now playing view", lyricsPreview: "Lyrics",
      prev: "Previous song", next: "Next song", play: "Play", pause: "Pause", seek: "Song position", openImm: "Open immersive mode",
      dockAria: "Demo controls", pickCover: "Play a cover", pickScheme: "Colour scheme",
      palFrom: "Taken from the cover", palGray: "Cover without colour · scheme colours", palFixed: "Fixed colours of this scheme",
      heroNote: "No sound plays here. Covers are abstract art drawn in your browser, and their colours are picked with the same code the theme uses.",
      factsAria: "Highlights", f1b: "Cover colours", f1: "picked live, always readable", f2b: "Living background", f2: "mist, aurora and light dust",
      f3b: "6 colour schemes", f3: "one of them light", f4b: "On the beat", f4: "calm when nothing plays",
      immEyebrow: "Immersive mode", immTitle: "One click, and Spotify becomes a stage.",
      immLede: "Full screen, made for the TV or a quiet evening. Pick a view: the big cover, lyrics that light up as they are sung, a visualizer, or the party stage.",
      views: "Views", tCover: "Cover", tLyrics: "Lyrics", tViz: "Visualizer", tParty: "Party", realShot: "Real screenshot", liveDemo: "Back to live demo",
      lyrSr: "Demo lyrics: the current line fills syllable by syllable as it is sung.",
      vizStyle: "Visualizer style", vBars: "Bars", vWave: "Wave", vTunnel: "Tunnel", vGalaxy: "Galaxy",
      drop: "Let the drop come", dropBusy: "Here it comes …", noFlash: "No flashes",
      immNote: "Mirage has 11 visualizer styles and a fifth view, Mix. Flashes are capped at three per second; “No flashes” turns them off completely and is on by itself when your system asks for less motion.",
      realAlt: "Real screenshot of this view in Mirage",
      partyEyebrow: "Party mode", partyTitle: "Your friends join with their phones.",
      partyLede: "No app to install. The stage follows the music – 318 styles from house to folk, each with its own light show – and guests play along in their browser.",
      s1t: "Scan the code", s1: "The TV shows a QR code. Guests scan it and pick a name and a colour.",
      s2t: "Phones light up", s2: "Every phone glows in the song's colours on the beat – all at once or as a wave through the room.",
      s3t: "Play and wish songs", s3: "Quizzes, races and karaoke on the phone. Song wishes go into a queue you control.",
      phJoin: "You're in!", phName: "Your name", phColour: "Your colour", phGo: "Let's go", phQuiz: "WHO'S SINGING?", phWish: "Wish a song",
      gamesTitle: "games, played on the phone", moreGames: "Show all {n} games", gFilter: "Filter games", cAll: "All", cMusic: "Music", cQuick: "Quick", cParty: "Party", cDrink: "Drinking 18+",
      pp1: "Teams of 2 to 4", pp2: "Join late, keep your points", pp3: "Karaoke is scored on the phone – the recording never leaves it", pp4: "Photo wall only shows what you approve", pp5: "A host phone can start and skip games",
      ovEyebrow: "Mirage Overlay · companion app", ovTitle: "The song, on top of every window.",
      ovLede: "A small extra app for Windows, macOS and Linux. When the song changes, it shows a short announcement over games, browsers and videos – in the colours of the cover. It is optional: the theme works without it.",
      ovStyle: "Style", stIsland: "Island", stCard: "Card", stBanner: "Banner", stMinimal: "Minimal", ovPos: "Position on screen",
      ovNext: "Next song", ovVol: "Change volume", ovEdge: "Edge light (party mode)", ovHint: "Tip: hover the announcement – it turns into a mini player.",
      deskAria: "Fake desktop showing the overlay (demo)",
      pos: ["Top left", "Top centre", "Top right", "Middle left", "Centre", "Middle right", "Bottom left", "Bottom centre", "Bottom right"],
      op1: "4 more styles: Lyrics, Visualizer, Mini strip, Cover bubble", op2: "Volume bar when you change the volume", op3: "Tray menu", op4: "Updates itself", op5: "Puts the theme back after a Spotify update", op6: "First-start setup finds your lights",
      howTitle: "How it fits together", flSrc: "Spotify + Mirage theme", flSrcS: "knows the song, its colours and the beat",
      flLink: "a private line inside your own computer", flApp: "Mirage Overlay app", flAppS: "sits in the tray, passes it on",
      o1: "Announcements", o1s: "over every window, plus mini player and volume bar", o2: "Edge light", o2s: "your screen edges glow with the party",
      o3: "OBS for streamers", o3s: "and", o4: "Room lights", o4s: "(also fast Entertainment streaming)",
      privacy: "Everything stays on your computer and in your home network. The app only goes online to look for updates on GitHub and, during setup, to find a Hue bridge.",
      instEyebrow: "Install", instTitle: "One line, and you're done.",
      instLede: "Copy the line for your system, paste it into a terminal and press Enter. It installs Spicetify if needed and then Mirage.",
      yourSystem: "Your system", winHint: "Open PowerShell (Start menu → type “PowerShell”) and paste:", unixHint: "Open the Terminal and paste:",
      does1: "Installs Spicetify if it is missing (with its official installer)", does2: "Copies Mirage and switches it on", does3: "Safe to run again at any time, for example after a Spotify update",
      needs: "You need the Spotify desktop app from spotify.com (on Windows not the Microsoft Store version).",
      copy: "Copy", copied: "Copied!", marketHint: "Already using Spicetify? Mirage is also in the Spicetify Marketplace under Themes.",
      ovDl: "Overlay app (optional)", dlHint: "The first start walks you through everything, including your lights.", readme: "Read the full guide on GitHub",
      source: "Source on GitHub", notAff: "Not affiliated with Spotify.", announce: "Now playing: {t} by {a}",
      title: "Mirage – a living Spicetify theme",
    },
    de: {
      skip: "Zum Inhalt springen", navTheme: "Theme", navImm: "Immersiv", navParty: "Party", navOverlay: "Overlay", navInstall: "Installieren",
      heroEyebrow: "Spicetify-Theme · kostenlos und offen", heroT1: "Spotify, gemacht aus", heroT2: "Glas und Licht.",
      heroLede: "Mirage macht aus Spotify mattes Glas. Dahinter treibt das Albumcover wie ein weicher Nebel, und jeder Song färbt Knöpfe, Titel und Fortschrittsbalken in seinen eigenen Farben.",
      ctaInstall: "Mirage installieren", ctaTry: "Gleich hier ausprobieren", appAria: "Spotify mit Mirage (Demo)", search: "Was willst du hören?",
      library: "Deine Bibliothek", chipPl: "Playlists", chipAl: "Alben", chipAr: "Künstler", playlist: "Öffentliche Playlist", nowPlaying: "Jetzt läuft",
      like: "Song merken", colTitle: "Titel", colAlbum: "Album", npView: "Ansicht „Jetzt läuft“", lyricsPreview: "Songtext",
      prev: "Vorheriger Song", next: "Nächster Song", play: "Abspielen", pause: "Pause", seek: "Stelle im Song", openImm: "Immersiv-Modus öffnen",
      dockAria: "Demo-Steuerung", pickCover: "Spiel ein Cover", pickScheme: "Farbschema",
      palFrom: "Aus dem Cover genommen", palGray: "Cover ohne Farbe · Schemafarben", palFixed: "Feste Farben dieses Schemas",
      heroNote: "Hier läuft kein Ton. Die Cover sind abstrakte Bilder, die dein Browser malt, und ihre Farben wählt derselbe Code wie im Theme.",
      factsAria: "Das Wichtigste", f1b: "Coverfarben", f1: "live gewählt, immer lesbar", f2b: "Lebender Hintergrund", f2: "Nebel, Polarlicht und Lichtstaub",
      f3b: "6 Farbschemata", f3: "eines davon hell", f4b: "Im Takt", f4: "ruhig, wenn nichts läuft",
      immEyebrow: "Immersiv-Modus", immTitle: "Ein Klick, und Spotify wird zur Bühne.",
      immLede: "Vollbild, gemacht für den Fernseher oder einen ruhigen Abend. Wähle eine Ansicht: das große Cover, Songtext, der beim Singen aufleuchtet, einen Visualizer oder die Party-Bühne.",
      views: "Ansichten", tCover: "Cover", tLyrics: "Songtext", tViz: "Visualizer", tParty: "Party", realShot: "Echter Screenshot", liveDemo: "Zurück zur Live-Demo",
      lyrSr: "Demo-Songtext: Die aktuelle Zeile füllt sich Silbe für Silbe, während sie gesungen wird.",
      vizStyle: "Visualizer-Stil", vBars: "Balken", vWave: "Welle", vTunnel: "Tunnel", vGalaxy: "Galaxie",
      drop: "Den Drop kommen lassen", dropBusy: "Gleich ist es so weit …", noFlash: "Keine Blitze",
      immNote: "Mirage hat 11 Visualizer-Stile und eine fünfte Ansicht, Mix. Blitze sind auf drei pro Sekunde begrenzt; „Keine Blitze“ schaltet sie ganz ab und ist von selbst an, wenn dein System um weniger Bewegung bittet.",
      realAlt: "Echter Screenshot dieser Ansicht in Mirage",
      partyEyebrow: "Party-Modus", partyTitle: "Deine Freunde machen mit dem Handy mit.",
      partyLede: "Keine App nötig. Die Bühne folgt der Musik – 318 Stile von House bis Folk, jeder mit eigener Lichtshow – und die Gäste spielen im Browser mit.",
      s1t: "Code scannen", s1: "Der Fernseher zeigt einen QR-Code. Gäste scannen ihn und wählen Namen und Farbe.",
      s2t: "Handys leuchten", s2: "Jedes Handy leuchtet im Takt in den Farben des Songs – alle zugleich oder als Welle durch den Raum.",
      s3t: "Spielen und Songs wünschen", s3: "Quiz, Wettrennen und Karaoke am Handy. Songwünsche landen in einer Liste, die du steuerst.",
      phJoin: "Du bist dabei!", phName: "Dein Name", phColour: "Deine Farbe", phGo: "Los geht's", phQuiz: "WER SINGT HIER?", phWish: "Song wünschen",
      gamesTitle: "Spiele, gespielt am Handy", moreGames: "Alle {n} Spiele zeigen", gFilter: "Spiele filtern", cAll: "Alle", cMusic: "Musik", cQuick: "Schnell", cParty: "Party", cDrink: "Trinkspiele 18+",
      pp1: "Teams von 2 bis 4", pp2: "Später einsteigen, Punkte behalten", pp3: "Karaoke wird am Handy bewertet – die Aufnahme verlässt es nie", pp4: "Die Fotowand zeigt nur, was du freigibst", pp5: "Ein Gastgeber-Handy kann Spiele starten und überspringen",
      ovEyebrow: "Mirage Overlay · Begleit-App", ovTitle: "Der Song, über jedem Fenster.",
      ovLede: "Eine kleine Zusatz-App für Windows, macOS und Linux. Wechselt der Song, zeigt sie kurz eine Ansage über Spielen, Browsern und Videos – in den Farben des Covers. Sie ist freiwillig: Das Theme läuft auch ohne sie.",
      ovStyle: "Stil", stIsland: "Insel", stCard: "Karte", stBanner: "Banner", stMinimal: "Minimal", ovPos: "Stelle auf dem Bildschirm",
      ovNext: "Nächster Song", ovVol: "Lautstärke ändern", ovEdge: "Kantenlicht (Party-Modus)", ovHint: "Tipp: Fahr mit der Maus über die Ansage – sie wird zum Mini-Player.",
      deskAria: "Nachgebauter Desktop mit dem Overlay (Demo)",
      pos: ["Oben links", "Oben Mitte", "Oben rechts", "Mitte links", "Mitte", "Mitte rechts", "Unten links", "Unten Mitte", "Unten rechts"],
      op1: "4 weitere Stile: Songtext, Visualizer, Mini-Leiste, Cover-Blase", op2: "Lautstärke-Anzeige, wenn du lauter oder leiser machst", op3: "Menü im Infobereich", op4: "Aktualisiert sich selbst", op5: "Bringt das Theme nach einem Spotify-Update zurück", op6: "Die Einrichtung beim ersten Start findet deine Lampen",
      howTitle: "So hängt alles zusammen", flSrc: "Spotify + Mirage-Theme", flSrcS: "kennt Song, Farben und Takt",
      flLink: "eine private Leitung in deinem eigenen Computer", flApp: "Mirage-Overlay-App", flAppS: "sitzt im Infobereich und gibt es weiter",
      o1: "Ansagen", o1s: "über jedem Fenster, dazu Mini-Player und Lautstärke-Anzeige", o2: "Kantenlicht", o2s: "die Bildschirmränder leuchten mit der Party",
      o3: "OBS für Streamer", o3s: "und", o4: "Raumlicht", o4s: "(auch schnelles Entertainment-Streaming)",
      privacy: "Alles bleibt auf deinem Computer und in deinem Heimnetz. Online geht die App nur, um auf GitHub nach Updates zu sehen, und bei der Einrichtung, um eine Hue-Bridge zu finden.",
      instEyebrow: "Installieren", instTitle: "Eine Zeile, und fertig.",
      instLede: "Kopiere die Zeile für dein System, füge sie in ein Terminal ein und drück Enter. Sie installiert Spicetify, falls nötig, und dann Mirage.",
      yourSystem: "Dein System", winHint: "Öffne PowerShell (Startmenü → „PowerShell“ tippen) und füge ein:", unixHint: "Öffne das Terminal und füge ein:",
      does1: "Installiert Spicetify, falls es fehlt (mit dessen offiziellem Installer)", does2: "Kopiert Mirage und schaltet es ein", does3: "Kann jederzeit erneut laufen, zum Beispiel nach einem Spotify-Update",
      needs: "Du brauchst die Spotify-Desktop-App von spotify.com (unter Windows nicht die Version aus dem Microsoft Store).",
      copy: "Kopieren", copied: "Kopiert!", marketHint: "Du nutzt Spicetify schon? Mirage gibt es auch im Spicetify Marketplace unter Themes.",
      ovDl: "Overlay-App (freiwillig)", dlHint: "Der erste Start führt dich durch alles, auch durch deine Lampen.", readme: "Die ganze Anleitung auf GitHub",
      source: "Quelltext auf GitHub", notAff: "Kein Angebot von Spotify.", announce: "Jetzt läuft: {t} von {a}",
      title: "Mirage – ein lebendiges Spicetify-Theme",
    },
  };
  const urlLang = new URLSearchParams(location.search).get("lang");
  let lang = urlLang === "de" || urlLang === "en" ? urlLang : store.get("mirage-demo-lang") || ((navigator.languages || [navigator.language || "en"]).some((l) => /^de\b/i.test(l)) ? "de" : "en");
  if (!T[lang]) lang = "en";
  const t = (k) => (T[lang][k] != null ? T[lang][k] : T.en[k]);

  /* ================================================================ Cover (im Browser gemalt) */
  const S = 320;
  const lin = (x, x0, y0, x1, y1, stops) => {
    const g = x.createLinearGradient(x0, y0, x1, y1);
    stops.forEach(([o, c]) => g.addColorStop(o, c));
    return g;
  };
  function blob(x, cx, cy, r, color) {
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, color);
    g.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, S, S);
  }
  const COVERS = [
    { title: "Velvet Hours", artist: "Lumen Atlas", album: "Night Bloom", dur: 192000, bpm: 118, style: "SYNTH-POP",
      draw(x, r) {
        x.fillStyle = lin(x, 0, 0, S, S, [[0, "#1d0636"], [0.55, "#4a1170"], [1, "#2a0a3f"]]);
        x.fillRect(0, 0, S, S);
        blob(x, S * 0.3, S * 0.35, S * 0.55, "rgba(181,74,255,0.9)");
        blob(x, S * 0.75, S * 0.7, S * 0.5, "rgba(255,92,170,0.85)");
        blob(x, S * 0.65, S * 0.2, S * 0.3, "rgba(255,170,220,0.6)");
        x.strokeStyle = "rgba(255,230,250,0.5)";
        x.lineWidth = 2;
        for (let i = 0; i < 5; i++) {
          x.beginPath(); x.arc(S * 0.5, S * 0.55, 40 + i * 22, 0, Math.PI * 2);
          x.globalAlpha = 0.5 - i * 0.08; x.stroke();
        }
        x.globalAlpha = 1;
        for (let i = 0; i < 30; i++) {
          x.fillStyle = `rgba(255,220,245,${0.3 + r() * 0.6})`;
          x.beginPath(); x.arc(r() * S, r() * S, r() * 2 + 0.5, 0, Math.PI * 2); x.fill();
        }
      } },
    { title: "Tidal Glass", artist: "Coastline Theory", album: "Deep Blue Hours", dur: 245000, bpm: 96, style: "CHILLWAVE",
      draw(x, r) {
        x.fillStyle = lin(x, 0, 0, 0, S, [[0, "#04223f"], [1, "#021226"]]);
        x.fillRect(0, 0, S, S);
        ["#0a4f86", "#0e78b0", "#13a3c8", "#4fd1d9", "#b8f1ee"].forEach((c, i) => {
          const base = S * 0.28 + i * S * 0.14, amp = 10 + r() * 14, f = 0.018 + r() * 0.012, ph = r() * 6;
          x.fillStyle = c; x.globalAlpha = 0.9;
          x.beginPath(); x.moveTo(0, S);
          for (let px = 0; px <= S; px += 4) x.lineTo(px, base + Math.sin(px * f + ph) * amp);
          x.lineTo(S, S); x.closePath(); x.fill();
        });
        x.globalAlpha = 1;
        blob(x, S * 0.78, S * 0.18, S * 0.22, "rgba(220,250,255,0.75)");
      } },
    { title: "Golden Hour Drive", artist: "Sola Vista", album: "Heatwave", dur: 178000, bpm: 124, style: "HOUSE",
      draw(x) {
        x.fillStyle = lin(x, 0, 0, 0, S, [[0, "#ff5e1a"], [0.45, "#ff9a2e"], [0.7, "#ffc85a"], [1, "#ff7a2a"]]);
        x.fillRect(0, 0, S, S);
        x.fillStyle = lin(x, 0, S * 0.25, 0, S * 0.75, [[0, "#fff3c4"], [1, "#ffb347"]]);
        x.beginPath(); x.arc(S / 2, S * 0.56, S * 0.27, 0, Math.PI * 2); x.fill();
        x.fillStyle = "#c2321b";
        for (let i = 0; i < 6; i++) x.fillRect(0, S * 0.58 + i * 14, S, 3 + i * 1.5);
        x.fillStyle = lin(x, 0, S * 0.72, 0, S, [[0, "#8f2414"], [1, "#4a0f0a"]]);
        x.beginPath();
        x.moveTo(0, S * 0.8); x.lineTo(S * 0.35, S * 0.7); x.lineTo(S * 0.6, S * 0.78); x.lineTo(S, S * 0.68); x.lineTo(S, S); x.lineTo(0, S);
        x.fill();
      } },
    { title: "Canopy", artist: "Moss & Ember", album: "Understory", dur: 221000, bpm: 104, style: "INDIE FOLK",
      draw(x, r) {
        x.fillStyle = lin(x, 0, 0, S, S, [[0, "#0c3320"], [1, "#05190f"]]);
        x.fillRect(0, 0, S, S);
        const greens = ["#1f6b3a", "#2f8f46", "#4cae4f", "#86c95a", "#c4e27a"];
        for (let i = 0; i < 70; i++) {
          x.save(); x.translate(r() * S, r() * S); x.rotate(r() * Math.PI * 2);
          x.fillStyle = greens[Math.floor(r() * greens.length)]; x.globalAlpha = 0.7 + r() * 0.3;
          const w = 14 + r() * 34;
          x.beginPath(); x.ellipse(0, 0, w, w * 0.38, 0, 0, Math.PI * 2); x.fill();
          x.restore();
        }
        x.globalAlpha = 1;
        blob(x, S * 0.5, S * 0.1, S * 0.45, "rgba(230,255,170,0.45)");
      } },
    { title: "Contact Sheet", artist: "Silent Film Club", album: "Grayscale", dur: 207000, bpm: 92, style: "JAZZ",
      draw(x) {
        x.fillStyle = "#121212"; x.fillRect(0, 0, S, S);
        for (let i = 14; i > 0; i--) {
          x.fillStyle = i % 2 ? "#e9e9e9" : "#1a1a1a";
          x.beginPath(); x.arc(S * 0.62, S * 0.42, i * 15, 0, Math.PI * 2); x.fill();
        }
        x.fillStyle = "#7a7a7a"; x.fillRect(S * 0.08, S * 0.78, S * 0.5, 10);
        x.fillStyle = "#bdbdbd"; x.fillRect(S * 0.08, S * 0.84, S * 0.32, 6);
      } },
    { title: "Neon Static", artist: "Arcade Ghosts", album: "Afterglow City", dur: 258000, bpm: 128, style: "SYNTHWAVE",
      draw(x) {
        x.fillStyle = "#08041a"; x.fillRect(0, 0, S, S);
        x.fillStyle = lin(x, 0, 0, 0, S * 0.55, [[0, "#06020f"], [1, "#16061f"]]); x.fillRect(0, 0, S, S * 0.55);
        x.fillStyle = lin(x, 0, S * 0.12, 0, S * 0.55, [[0, "#ff4fd8"], [1, "#ff1f8f"]]);
        x.beginPath(); x.arc(S / 2, S * 0.55, S * 0.32, Math.PI, 0); x.fill();
        x.fillStyle = "#06020f";
        for (let i = 0; i < 5; i++) x.fillRect(S * 0.15, S * 0.36 + i * 11, S * 0.7, 2 + i * 1.2);
        x.lineCap = "round"; x.shadowBlur = 12; x.shadowColor = "#00f0ff"; x.strokeStyle = "#00e5ff"; x.lineWidth = 3;
        for (let i = -8; i <= 8; i++) { x.beginPath(); x.moveTo(S / 2 + i * 8, S * 0.55); x.lineTo(S / 2 + i * 60, S); x.stroke(); }
        for (let i = 0; i < 7; i++) {
          const y = S * 0.55 + Math.pow(i / 7, 1.8) * S * 0.45;
          x.beginPath(); x.moveTo(0, y); x.lineTo(S, y); x.stroke();
        }
        x.shadowBlur = 0;
      } },
  ];
  // Einmal malen, wie theme.js abtasten (64 px), Hintergrund-Dunst vorab weichzeichnen (billig)
  COVERS.forEach((cv, i) => {
    const c = document.createElement("canvas");
    c.width = c.height = S;
    cv.draw(c.getContext("2d"), rng(1000 + i * 77));
    cv.canvas = c;
    cv.src = c.toDataURL("image/jpeg", 0.88);
    const sm = document.createElement("canvas");
    sm.width = sm.height = 64;
    const sx = sm.getContext("2d", { willReadFrequently: true });
    sx.drawImage(c, 0, 0, 64, 64);
    cv.pal = quantize(sx.getImageData(0, 0, 64, 64).data);
    // Dunst: erst winzig (Weichzeichnen ohne ctx.filter, läuft auch in Safari), dann wieder groß + dunkler
    const tiny = document.createElement("canvas");
    tiny.width = tiny.height = 10;
    tiny.getContext("2d").drawImage(c, 0, 0, 10, 10);
    const hz = document.createElement("canvas");
    hz.width = hz.height = 96;
    const hx = hz.getContext("2d");
    hx.imageSmoothingQuality = "high";
    hx.drawImage(tiny, -6, -6, 108, 108);
    hx.fillStyle = "rgba(7,6,12,0.28)";
    hx.fillRect(0, 0, 96, 96);
    cv.haze = hz.toDataURL("image/jpeg", 0.9);
  });

  // Demo-Songtexte (eigene Zeilen, Silben mit ·)
  const LYRICS = [
    ["Hold the light a lit·tle long·er", "Let the col·ours fill the room", "Ev·ery cho·rus paints the ceil·ing", "Ev·ery heart·beat sounds like you",
      "We are drift·ing through the ne·on", "Un·der·neath a glass·y sky", "Turn it up and let it shim·mer", "Some·thing gold·en in your eyes"],
    ["Waves are fold·ing in·to morn·ing", "Salt and sil·ver on the shore", "I can hear the o·cean hum·ming", "Like it knew us all be·fore",
      "Stay a while, the tide is turn·ing", "Ev·ery sec·ond feels like blue"],
    ["Dash·board lights and fad·ing sum·mer", "High·way hum·ming un·der·neath", "Win·dows down, the ra·di·o's burn·ing", "Ev·ery mile a lit·tle sweet",
      "Chase the sun un·til it's go·ing", "Paint the sky in tan·ge·rine"],
  ];

  /* ================================================================ Zustand */
  const st = { idx: 0, playing: true, pos: 0, scheme: "Mirage", tab: "cover", viz: "bars", real: false, noFlash: reduced, liked: new Set(), ovStyle: "island", ovPos: 1, edge: false };
  const cur = () => COVERS[st.idx];
  // Leinwand-Farben gleiten in 1,4 s ins neue Cover (wie palette() in color.js)
  let palNow = schemePal("Mirage"), palFrom = null, palTo = palNow, palT0 = 0;
  function pal(now) {
    if (!palFrom) return palTo;
    const f = (now - palT0) / 1400;
    if (f >= 1) { palFrom = null; return palTo; }
    const e = f * f * (3 - 2 * f);
    return palTo.map((c, i) => mix(palFrom[i], c, e));
  }

  /* ================================================================ Farben anwenden */
  const app = $("[data-app]");
  const swatches = $("[data-swatches]");
  const palLabel = $("[data-pal-label]");
  let palKey = "palFrom";
  function applyColors() {
    const sc = SCHEMES[st.scheme];
    const light = !!sc.light;
    let p, key;
    if (st.scheme === "Mirage") {
      p = cur().pal || schemePal("Mirage");
      key = cur().pal ? "palFrom" : "palGray";
    } else {
      p = schemePal(st.scheme);
      key = "palFixed";
    }
    // Seite und Immersiv bleiben dunkel: helle Schemata bekommen dort helle Leitfarben (darkGround)
    const page = light ? darkGround(p) : p;
    ["--m-a", "--m-b", "--m-c"].forEach((v, i) => root.style.setProperty(v, css(page[i])));
    const now = performance.now();
    palFrom = pal(now).map((c) => c.slice());
    palTo = page;
    palT0 = now;
    // Fenster: Schema-Flächen
    const main = hexRgb(sc.main);
    app.classList.toggle("is-light", light);
    app.style.setProperty("--s-main", main.join(","));
    app.style.setProperty("--s-text", "#" + sc.text);
    app.style.setProperty("--s-sub", "#" + sc.sub);
    app.style.setProperty("--s-line", light ? "rgba(29,26,43,0.09)" : "rgba(255,255,255,0.07)");
    app.style.setProperty("--s-hi", light ? "rgba(29,26,43,0.06)" : "rgba(255,255,255,0.06)");
    if (light) {
      ["--a", "--b", "--c"].forEach((v, i) => app.style.setProperty(v, css(p[i])));
      app.style.setProperty("--on-a", "#fff");
    } else {
      ["--a", "--b", "--c", "--on-a"].forEach((v) => app.style.removeProperty(v));
    }
    palKey = key;
    palLabel.textContent = t(key);
    swatches.innerHTML = p
      .map((c, i) => `<span class="sw-item"><span class="sw-chip" style="background:${css(c)};color:${css(c)}"></span><span><b>${"ABC"[i]}</b>${rgbHex(c)}</span></span>`)
      .join("");
  }

  /* ================================================================ Oberfläche aufbauen */
  const coversEl = $("[data-covers]");
  const schemesEl = $("[data-schemes]");
  const lib = $("[data-library]");
  const tracks = $("[data-tracks]");
  COVERS.forEach((cv, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "cv-btn";
    b.dataset.play = i;
    b.setAttribute("aria-pressed", "false");
    b.innerHTML = `<img alt="" src="${cv.src}" width="48" height="48">`;
    coversEl.append(b);
    const li = document.createElement("li");
    li.innerHTML = `<button type="button" data-play="${i}"><img alt="" src="${cv.src}" width="40" height="40"><span><span class="t">${cv.album}</span><span class="s">Album · ${cv.artist}</span></span></button>`;
    lib.append(li);
    const row = document.createElement("button");
    row.type = "button";
    row.className = "tl-row";
    row.dataset.play = i;
    row.innerHTML = `<span class="n">${i + 1}</span><span class="ti"><img alt="" src="${cv.src}" width="36" height="36"><span><span class="tt">${cv.title}</span><span class="ta">${cv.artist}</span></span></span><span class="al">${cv.album}</span><span class="du">${fmt(cv.dur)}</span>`;
    tracks.append(row);
  });
  Object.keys(SCHEMES).forEach((n) => {
    const sc = SCHEMES[n];
    const b = document.createElement("button");
    b.type = "button";
    b.className = "sc-btn";
    b.dataset.scheme = n;
    b.setAttribute("aria-pressed", String(n === st.scheme));
    const dot = n === "Mirage" ? "conic-gradient(from 200deg, #ff8fb8, #b69cff, #4fe3ff, #ffc85a, #ff8fb8)" : `linear-gradient(135deg, #${sc.c}, #${sc.a} 55%, #${sc.main})`;
    b.innerHTML = `<span class="sc-dot" style="background:${dot}"></span>${n}`;
    schemesEl.append(b);
  });
  function labelCovers() {
    $$("[data-play]").forEach((b) => {
      const cv = COVERS[+b.dataset.play];
      b.setAttribute("aria-label", `${t("play")}: ${cv.title} – ${cv.artist}`);
    });
  }

  /* ================================================================ Wiedergabe */
  const hazeImgs = $$("[data-haze]");
  let hazeSlot = 0;
  const announceEl = $("[data-announce]");
  function setSong(i, user) {
    st.idx = (i + COVERS.length) % COVERS.length;
    st.pos = 0;
    const cv = cur();
    $$("[data-cur-img]").forEach((im) => (im.src = cv.src));
    $$("[data-cur-title]").forEach((el) => (el.textContent = cv.title));
    $$("[data-cur-artist]").forEach((el) => (el.textContent = cv.artist));
    $$(".cv-btn").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.play === st.idx)));
    $$(".lib [data-play]").forEach((b) => b.setAttribute("aria-current", String(+b.dataset.play === st.idx)));
    $$(".tl-row").forEach((r) => {
      const on = +r.dataset.play === st.idx;
      r.setAttribute("aria-current", String(on));
      $(".n", r).innerHTML = on ? '<span class="eqi" aria-hidden="true"><i></i><i></i><i></i></span>' : String(+r.dataset.play + 1);
    });
    $("[data-dur]").textContent = fmt(cv.dur);
    // Dunst überblenden
    hazeSlot ^= 1;
    hazeImgs[hazeSlot].src = cv.haze;
    hazeImgs[hazeSlot].classList.add("on");
    hazeImgs[hazeSlot ^ 1].classList.remove("on");
    root.style.setProperty("--haze", `url(${cv.haze})`);
    $("[data-party-tag]").textContent = `PARTY · ${cv.style} · ${cv.bpm} BPM`;
    applyColors();
    buildLyrics();
    party.reset();
    announceOverlay();
    if (user) announceEl.textContent = t("announce").replace("{t}", cv.title).replace("{a}", cv.artist);
  }
  function setPlaying(on) {
    st.playing = on;
    root.classList.toggle("is-paused", !on);
    root.classList.toggle("is-playing", on);
    root.style.setProperty("--spin", on ? "running" : "paused");
    $$("[data-toggle]").forEach((b) => b.setAttribute("aria-label", t(on ? "pause" : "play")));
    $("[data-ov]").classList.toggle("paused", !on);
  }
  document.addEventListener("click", (e) => {
    const pl = e.target.closest("[data-play]");
    if (pl) {
      setSong(+pl.dataset.play, true);
      setPlaying(true);
      return;
    }
    const sc = e.target.closest("[data-scheme]");
    if (sc) {
      st.scheme = sc.dataset.scheme;
      $$("[data-scheme]").forEach((b) => b.setAttribute("aria-pressed", String(b === sc)));
      applyColors();
      return;
    }
    if (e.target.closest("[data-toggle]")) return setPlaying(!st.playing);
    if (e.target.closest("[data-next]")) return setSong(st.idx + 1, true);
    if (e.target.closest("[data-prev]")) return setSong(st.pos > 3000 ? st.idx : st.idx - 1, true);
    const like = e.target.closest("[data-like]");
    if (like) {
      const on = !st.liked.has(st.idx);
      on ? st.liked.add(st.idx) : st.liked.delete(st.idx);
      like.setAttribute("aria-pressed", String(on));
    }
  });
  // Fortschritt: klicken und mit Pfeiltasten springen
  const prog = $("[data-prog]");
  function seekTo(ms) {
    st.pos = clamp(ms, 0, cur().dur - 500);
    paintProgress(true);
  }
  prog.addEventListener("click", (e) => {
    const r = prog.getBoundingClientRect();
    seekTo(((e.clientX - r.left) / r.width) * cur().dur);
  });
  prog.addEventListener("keydown", (e) => {
    const step = { ArrowRight: 5000, ArrowUp: 5000, ArrowLeft: -5000, ArrowDown: -5000 }[e.key];
    if (step) { e.preventDefault(); seekTo(st.pos + step); }
    if (e.key === "Home") { e.preventDefault(); seekTo(0); }
    if (e.key === "End") { e.preventDefault(); seekTo(cur().dur - 2000); }
  });
  const fills = $$("[data-fill]");
  const posEl = $("[data-time]");
  let lastPaint = 0;
  function paintProgress(force) {
    const now = performance.now();
    if (!force && now - lastPaint < 120) return;
    lastPaint = now;
    const f = st.pos / cur().dur;
    fills.forEach((b) => (b.style.width = (f * 100).toFixed(2) + "%"));
    posEl.textContent = fmt(st.pos);
    prog.setAttribute("aria-valuenow", String(Math.round(f * 100)));
    prog.setAttribute("aria-valuetext", `${fmt(st.pos)} / ${fmt(cur().dur)}`);
  }

  /* ================================================================ Takt */
  const beatOf = () => (st.pos / 60000) * cur().bpm;
  const kickOf = (b) => Math.pow(1 - (b - Math.floor(b)), 3);

  /* ================================================================ Schleife: läuft nur, was sichtbar ist */
  const tasks = [];
  const io = new IntersectionObserver((list) => {
    list.forEach((en) => {
      tasks.forEach((tk) => { if (tk.el === en.target) tk.vis = en.isIntersecting; });
      en.target.classList.toggle("off", !en.isIntersecting);
    });
  }, { rootMargin: "80px" });
  function task(el, fn) {
    tasks.push({ el, fn, vis: false });
    io.observe(el);
  }
  $$(".sec, .hero").forEach((s) => io.observe(s));
  let rafId = 0, lastT = 0;
  function frame(now) {
    rafId = requestAnimationFrame(frame);
    const dt = Math.min(100, now - (lastT || now));
    lastT = now;
    if (st.playing) {
      st.pos += dt;
      if (st.pos >= cur().dur) setSong(st.idx + 1, false);
    }
    paintProgress(false);
    const b = beatOf();
    const k = st.playing && !reduced ? kickOf(b) : 0;
    const p = pal(now);
    for (const tk of tasks) if (tk.vis) tk.fn(now, dt, b, k, p);
  }
  function start() {
    if (!rafId && !document.hidden) { lastT = 0; rafId = requestAnimationFrame(frame); }
  }
  function stop() {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));

  /* ================================================================ Lichtstaub (Seite) */
  const world = $(".world");
  const dustC = $("[data-dust]");
  const dctx = dustC.getContext("2d");
  let motes = [];
  function sizeDust() {
    const d = DPR();
    dustC.width = Math.round(innerWidth * d);
    dustC.height = Math.round(innerHeight * d);
    dctx.setTransform(d, 0, 0, d, 0, 0);
    const r = rng(7);
    const n = Math.round(clamp((innerWidth * innerHeight) / 22000, 24, 80));
    motes = Array.from({ length: n }, () => ({ x: r() * innerWidth, y: r() * innerHeight, s: 0.6 + r() * 1.8, v: 0.04 + r() * 0.12, ph: r() * 6.28, c: r() < 0.7 ? 2 : 0 }));
  }
  let dustLast = 0, worldBeat = -1;
  task(world, (now, dt, b, k, p) => {
    // Staub reicht mit 30 Bildern pro Sekunde
    if (now - dustLast < 32) return;
    dustLast = now;
    const kb = Math.round(k * 20) / 20;
    if (kb !== worldBeat) { worldBeat = kb; world.style.setProperty("--beat", kb); }
    dctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const m of motes) {
      if (!reduced) {
        m.y -= m.v * (1 + k * 2);
        m.x += Math.sin(now / 3000 + m.ph) * 0.15;
        if (m.y < -10) { m.y = innerHeight + 10; m.x = Math.random() * innerWidth; }
      }
      const a = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(now / 900 + m.ph)) + k * 0.25;
      dctx.fillStyle = css(p[m.c], a.toFixed(2));
      dctx.beginPath();
      dctx.arc(m.x, m.y, m.s * (1 + k * 0.4), 0, 6.283);
      dctx.fill();
    }
  });
  sizeDust();
  addEventListener("resize", sizeDust);

  /* ================================================================ Immersiv: Tabs */
  const screen = $("[data-screen]");
  const tabs = $$("[role=tab][data-tab]");
  const realBtn = $("[data-real]");
  const realImg = $("[data-real-img]");
  const REAL = { cover: "img/mode-cover.jpg", lyrics: "img/mode-lyrics.jpg", viz: "img/mode-viz.jpg", party: "img/mode-party.jpg" };
  function selectTab(name, focus) {
    st.tab = name;
    tabs.forEach((b) => {
      const on = b.dataset.tab === name;
      b.setAttribute("aria-selected", String(on));
      b.tabIndex = on ? 0 : -1;
      if (on && focus) b.focus();
      $("#" + b.getAttribute("aria-controls")).hidden = !on;
    });
    if (name === "viz" || name === "party") sizeCanvases();
    if (name === "lyrics") placeLyrics(true);
    showReal();
  }
  tabs.forEach((b, i) => {
    b.addEventListener("click", () => selectTab(b.dataset.tab));
    b.addEventListener("keydown", (e) => {
      let j = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
      if (j == null) return;
      e.preventDefault();
      j = (j + tabs.length) % tabs.length;
      selectTab(tabs[j].dataset.tab, true);
    });
  });
  function showReal() {
    realBtn.setAttribute("aria-pressed", String(st.real));
    realBtn.textContent = t(st.real ? "liveDemo" : "realShot");
    realImg.hidden = !st.real;
    if (st.real) {
      realImg.src = REAL[st.tab];
      realImg.alt = t("realAlt");
    }
  }
  realBtn.addEventListener("click", () => { st.real = !st.real; showReal(); });

  /* ================================================================ Immersiv: Songtext */
  const linesBox = $("[data-lines]");
  const track = document.createElement("div");
  track.className = "vl-track";
  linesBox.append(track);
  const miniLyric = $("[data-mini-lyric]");
  let lyr = [], lyrLine = -1;
  function buildLyrics() {
    const set = LYRICS[st.idx % LYRICS.length];
    track.innerHTML = "";
    lyr = set.map((line) => {
      const el = document.createElement("p");
      el.className = "ln";
      const syl = [];
      line.split(" ").forEach((w, wi) => {
        if (wi) el.append(" ");
        w.split("·").forEach((s) => {
          const sp = document.createElement("span");
          sp.className = "sy";
          sp.textContent = s;
          el.append(sp);
          syl.push({ el: sp, w: Math.max(1, s.replace(/[^a-z']/gi, "").length * 0.6 + 1) });
        });
      });
      const tot = syl.reduce((a, s) => a + s.w, 0);
      let acc = 0;
      syl.forEach((s) => { s.a = acc / tot; acc += s.w; s.b = acc / tot; });
      track.append(el);
      return { el, syl, text: line.replace(/·/g, "") };
    });
    lyrLine = -1;
  }
  function placeLyrics(force) {
    const b = beatOf();
    const n = lyr.length;
    // eine Zeile = 8 Schläge
    const li = Math.floor(b / 8) % n;
    if (li !== lyrLine || force) {
      lyrLine = li;
      lyr.forEach((l, i) => {
        l.el.classList.toggle("cur", i === li);
        l.el.classList.toggle("past", i < li);
        if (i !== li) l.syl.forEach((s) => s.el.style.removeProperty("--p"));
      });
      const el = lyr[li].el;
      track.style.transform = `translateY(${-(el.offsetTop + el.offsetHeight / 2)}px)`;
      miniLyric.textContent = lyr[li].text;
    }
    return li;
  }
  task(screen, (now, dt, b, k) => {
    if (st.real) return;
    screen.style.setProperty("--beat", (Math.round(k * 20) / 20).toString());
    if (st.tab === "lyrics") {
      const li = placeLyrics(false);
      // gesungen wird in den ersten 80 % der Zeile
      const f = clamp(((b / 8) % 1) / 0.8, 0, 1);
      for (const s of lyr[li].syl) {
        const p = clamp((f - s.a) / (s.b - s.a), 0, 1);
        s.el.style.setProperty("--p", (p * 100).toFixed(1) + "%");
      }
    } else if (st.tab === "viz") drawViz(now, b, k);
    else if (st.tab === "party") party.draw(now, dt, b, k);
  });
  // Mini-Songtext im Fenster rechts
  task(app, () => placeLyrics(false));

  /* ================================================================ Leinwände */
  const vizC = $("[data-viz]");
  const partyC = $("[data-party]");
  const vctx = vizC.getContext("2d");
  const pctx = partyC.getContext("2d");
  function fit(c, x) {
    const d = DPR();
    const w = c.clientWidth, h = c.clientHeight;
    if (!w || !h) return;
    c.width = Math.round(w * d);
    c.height = Math.round(h * d);
    x.setTransform(d, 0, 0, d, 0, 0);
    c._w = w; c._h = h;
  }
  function sizeCanvases() {
    fit(vizC, vctx);
    fit(partyC, pctx);
    party.layout();
  }
  new ResizeObserver(() => sizeCanvases()).observe(screen);

  /* ================================================================ Visualizer */
  const BANDS = 96;
  const spec = new Float32Array(BANDS);
  function spectrum(now, b, k) {
    const tt = now / 1000;
    const hat = st.playing ? Math.pow(1 - ((b * 2) % 1), 4) : 0;
    for (let i = 0; i < BANDS; i++) {
      const f = i / BANDS;
      let v = 0.18 + 0.32 * (0.5 + 0.5 * Math.sin(tt * 1.7 + i * 0.31)) * (0.6 + 0.4 * Math.sin(tt * 0.9 + i * 0.13));
      v += k * Math.pow(1 - f, 2.2) * 0.7 + hat * f * 0.22 * (0.5 + 0.5 * Math.sin(i * 1.7 + tt * 3));
      v *= st.playing ? 1 : 0.25;
      if (reduced) v = 0.2 + v * 0.3;
      spec[i] += (v - spec[i]) * 0.25;
    }
  }
  let galaxy = null;
  function drawViz(now, b, k) {
    const x = vctx, w = vizC._w, h = vizC._h;
    if (!w) return;
    const p = pal(now);
    spectrum(now, b, k);
    x.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h * 0.52, R = Math.min(w, h);
    const tt = now / 1000;
    x.globalCompositeOperation = "lighter";
    if (st.viz === "bars") {
      const r0 = R * (w < 600 ? 0.17 : 0.105);
      for (let ring = 0; ring < 3; ring++) {
        x.strokeStyle = css(p[ring === 1 ? 1 : 2], 0.12 - ring * 0.03 + k * 0.06);
        x.lineWidth = 1.5;
        x.beginPath(); x.arc(cx, cy, r0 * (1.25 + ring * 0.45 + k * 0.05), 0, 6.283); x.stroke();
      }
      const n = BANDS * 2;
      for (let j = 0; j < n; j++) {
        const i = j < BANDS ? j : n - 1 - j; // gespiegelt
        const v = spec[i];
        const a = (j / n) * 6.283 - Math.PI / 2 + (reduced ? 0 : tt * 0.05);
        const len = R * 0.04 + v * R * 0.2;
        const x1 = cx + Math.cos(a) * (r0 + 6), y1 = cy + Math.sin(a) * (r0 + 6);
        const x2 = cx + Math.cos(a) * (r0 + 6 + len), y2 = cy + Math.sin(a) * (r0 + 6 + len);
        const g = x.createLinearGradient(x1, y1, x2, y2);
        g.addColorStop(0, css(p[1], 0.9));
        g.addColorStop(0.6, css(p[0], 0.9));
        g.addColorStop(1, css(p[2], 0.9));
        x.strokeStyle = g;
        x.lineWidth = Math.max(1.5, (6.283 * r0) / n - 1.4);
        x.lineCap = "round";
        x.beginPath(); x.moveTo(x1, y1); x.lineTo(x2, y2); x.stroke();
      }
    } else if (st.viz === "wave") {
      for (let L = 0; L < 3; L++) {
        const col = p[[1, 0, 2][L]];
        const g = x.createLinearGradient(0, cy - R * 0.3, 0, cy + R * 0.3);
        g.addColorStop(0, css(col, 0));
        g.addColorStop(0.5, css(col, 0.32 - L * 0.06));
        g.addColorStop(1, css(col, 0));
        x.fillStyle = g;
        x.beginPath();
        x.moveTo(0, cy);
        for (let px = 0; px <= w; px += 8) {
          const i = Math.floor((px / w) * (BANDS - 1));
          const amp = spec[i] * R * (0.22 - L * 0.04);
          x.lineTo(px, cy - Math.sin(px * (0.006 + L * 0.003) + tt * (1.2 + L * 0.5)) * amp - amp * 0.3);
        }
        for (let px = w; px >= 0; px -= 8) {
          const i = Math.floor((px / w) * (BANDS - 1));
          const amp = spec[i] * R * (0.22 - L * 0.04);
          x.lineTo(px, cy + Math.sin(px * (0.006 + L * 0.003) + tt * (1.2 + L * 0.5) + 1) * amp + amp * 0.3);
        }
        x.closePath();
        x.fill();
      }
    } else if (st.viz === "tunnel") {
      const n = 14;
      const sp = reduced ? 0.02 : 0.18 + k * 0.05;
      for (let i = 0; i < n; i++) {
        const z = ((i / n + tt * sp) % 1);
        const s = Math.pow(z, 2.2) * R * 1.1 + R * 0.02;
        const col = p[i % 3];
        x.strokeStyle = css(col, (0.08 + z * 0.5) * (0.7 + spec[(i * 7) % BANDS]));
        x.lineWidth = 1 + z * 4;
        x.save();
        x.translate(cx, cy);
        x.rotate(tt * 0.1 + z * 0.8);
        const rr = s * 0.18;
        x.beginPath();
        x.roundRect ? x.roundRect(-s / 2, -s / 2, s, s, rr) : x.rect(-s / 2, -s / 2, s, s);
        x.stroke();
        x.restore();
      }
    } else {
      if (!galaxy) {
        const r = rng(42);
        galaxy = Array.from({ length: 760 }, () => ({ arm: Math.floor(r() * 3), d: Math.pow(r(), 0.7), o: (r() - 0.5) * 0.5, s: 0.5 + r() * 1.6, c: Math.floor(r() * 3) }));
      }
      const rot = reduced ? 0 : tt * 0.12;
      for (const s of galaxy) {
        const v = spec[Math.floor(s.d * (BANDS - 1))];
        const a = s.arm * 2.094 + s.d * 4.2 + s.o + rot;
        const rr = R * (0.08 + s.d * 0.42) * (1 + v * 0.12);
        x.fillStyle = css(p[s.c], 0.35 + v * 0.6);
        x.beginPath();
        x.arc(cx + Math.cos(a) * rr * 1.25, cy + Math.sin(a) * rr * 0.72, s.s * (1 + v * 1.4), 0, 6.283);
        x.fill();
      }
    }
    x.globalCompositeOperation = "source-over";
  }
  $$("[data-viz-style]").forEach((b) =>
    b.addEventListener("click", () => {
      st.viz = b.dataset.vizStyle;
      $("#view-viz").dataset.style = st.viz;
      $$("[data-viz-style]").forEach((o) => o.setAttribute("aria-pressed", String(o === b)));
    }),
  );

  /* ================================================================ Party-Bühne */
  const party = (() => {
    let crowd = [], sparks = [], drop = null, flash = 0, swap = 0;
    const dropBtn = $("[data-drop]");
    function layout() {
      const w = partyC._w, h = partyC._h;
      if (!w) return;
      const r = rng(9);
      crowd = [];
      // drei Reihen: hinten klein und im Dunst, vorne groß und angeschnitten
      [[0.105, 0.935, 30], [0.14, 0.975, 38], [0.19, 1.03, 48]].forEach(([sc, gy, gap], row) => {
        const s = h * sc;
        const step = Math.max(gap * (w / 1100), s * 0.55);
        for (let px = -step * r(); px < w + step; px += step * (0.75 + r() * 0.5)) {
          crowd.push({ row, x: px, s: s * (0.88 + r() * 0.22), gy: h * gy, build: 0.8 + r() * 0.45, hair: Math.floor(r() * 7), arms: r() < 0.35 ? 2 : r() < 0.55 ? 1 : 0, side: r() < 0.5 ? -1 : 1, ph: r() * 0.3, amp: 0.5 + r() * 0.8, rim: Math.floor(r() * 3) });
        }
      });
    }
    function reset() {
      drop = null;
      sparks = [];
      if (dropBtn) { dropBtn.disabled = false; dropBtn.textContent = t("drop"); }
    }
    dropBtn.addEventListener("click", () => {
      if (drop) return;
      if (!st.playing) setPlaying(true);
      drop = { b0: Math.ceil(beatOf()) };
      dropBtn.disabled = true;
      dropBtn.textContent = t("dropBusy");
    });
    function head(x, cx, cy, r, hair) {
      x.beginPath();
      x.ellipse(cx, cy, r * 0.84, r, 0, 0, 6.283);
      if (hair === 5) x.arc(cx, cy - r * 0.15, r * 1.22, 0, 6.283);
      x.fill();
      x.beginPath();
      if (hair === 1) x.roundRect ? x.roundRect(cx - r * 1.02, cy - r * 1.05, r * 2.04, r * 2.6, r) : x.rect(cx - r, cy - r, r * 2, r * 2.6);
      else if (hair === 2) x.arc(cx, cy - r * 1.15, r * 0.48, 0, 6.283);
      else if (hair === 3) x.ellipse(cx + r * 0.95, cy + r * 0.25, r * 0.32, r * 0.75, 0.35, 0, 6.283);
      else if (hair === 4) { x.ellipse(cx, cy - r * 0.35, r * 0.95, r * 0.7, 0, Math.PI, 0); x.rect(cx - r * 1.55, cy - r * 0.42, r * 1.2, r * 0.22); }
      else if (hair === 6) { x.ellipse(cx, cy - r * 0.3, r * 0.98, r * 0.95, 0, Math.PI, 0); x.moveTo(cx + r * 0.3, cy - r * 1.3); x.arc(cx, cy - r * 1.3, r * 0.3, 0, 6.283); }
      else x.ellipse(cx, cy - r * 0.2, r * 0.9, r * 0.85, 0, Math.PI, 0);
      x.fill();
    }
    function person(x, p, lift, armsUp) {
      const s = p.s, cx = p.x, gy = p.gy - lift;
      const sw = s * 0.21 * p.build;
      const shY = gy - s * 0.52;
      const hr = s * 0.105;
      const hy = shY - s * 0.05 - hr * 0.95;
      x.beginPath();
      x.moveTo(cx - sw * 1.08, p.gy + lift + 4);
      x.lineTo(cx - sw, shY + s * 0.09);
      x.quadraticCurveTo(cx - sw, shY, cx - sw * 0.55, shY - s * 0.01);
      x.lineTo(cx + sw * 0.55, shY - s * 0.01);
      x.quadraticCurveTo(cx + sw, shY, cx + sw, shY + s * 0.09);
      x.lineTo(cx + sw * 1.08, p.gy + lift + 4);
      x.closePath();
      x.fill();
      x.fillRect(cx - s * 0.045, hy + hr * 0.5, s * 0.09, shY - hy);
      head(x, cx, hy, hr, p.hair);
      if (armsUp > 0.02) {
        x.lineWidth = s * 0.085;
        x.lineCap = "round";
        x.lineJoin = "round";
        const both = p.arms === 2 || armsUp > 1;
        [-1, 1].forEach((side) => {
          if (!both && side !== p.side) return;
          const u = Math.min(1, armsUp);
          const sx = cx + side * sw * 0.78, sy = shY + s * 0.05;
          const ex = sx + side * s * (0.13 + 0.03 * u), ey = sy - s * 0.2 * u;
          const hx = sx + side * s * (0.12 + 0.08 * u), hy2 = sy - s * 0.47 * u;
          x.beginPath(); x.moveTo(sx, sy); x.lineTo(ex, ey); x.lineTo(hx, hy2); x.stroke();
        });
      }
    }
    function draw(now, dt, b, k) {
      const x = pctx, w = partyC._w, h = partyC._h;
      if (!w) return;
      if (!crowd.length) layout();
      const p0 = pal(now);
      // Farbtausch beim Drop: Leitfarben rotieren
      const p = [p0[(0 + swap) % 3], p0[(1 + swap) % 3], p0[(2 + swap) % 3]];
      const tt = now / 1000;
      const calm = reduced ? 0.2 : 1;
      // Ablauf des Drops: 8 Schläge Aufbau (der letzte dunkel), dann 16 Schläge volle Energie
      let build = 0, dark = false, hype = 0;
      if (drop) {
        const db = b - drop.b0;
        if (db < 0) build = 0;
        else if (db < 7) build = db / 7;
        else if (db < 8) { build = 1; dark = true; }
        else if (db < 24) {
          if (!drop.hit) {
            drop.hit = true;
            swap = (swap + 1) % 3;
            if (!st.noFlash && flashCap(now)) flash = 1;
            const r = Math.random;
            for (let i = 0; i < (reduced ? 0 : 90); i++) sparks.push({ x: w / 2 + (r() - 0.5) * w * 0.3, y: h * 0.3, vx: (r() - 0.5) * 6, vy: -2 - r() * 5, c: Math.floor(r() * 3), life: 1 });
          }
          hype = 1 - (db - 8) / 16;
        } else reset();
      }
      const energy = dark ? 0.12 : 0.6 + build * 0.25 + hype * 0.4;
      // Hintergrund
      const bg = x.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, css(mix(p[1], [6, 5, 10], 0.55)));
      bg.addColorStop(0.55, css(mix(p[1], [6, 5, 10], 0.82)));
      bg.addColorStop(1, css(mix(p[0], [4, 3, 8], 0.9)));
      x.fillStyle = bg;
      x.fillRect(0, 0, w, h);
      const glow = x.createRadialGradient(w / 2, h * 0.42, 0, w / 2, h * 0.42, Math.max(w, h) * 0.6);
      glow.addColorStop(0, css(p[0], 0.28 * energy + k * 0.06));
      glow.addColorStop(1, css(p[0], 0));
      x.fillStyle = glow;
      x.fillRect(0, 0, w, h);
      // Traverse mit Scheinwerfern, Lichtkegel
      const lamps = w < 600 ? 6 : 9;
      x.globalCompositeOperation = "lighter";
      for (let i = 0; i < lamps; i++) {
        const lx = ((i + 0.5) / lamps) * w, ly = h * 0.035;
        const spread = 1 - build * 0.85 + hype * 0.4;
        const ang = Math.sin(tt * (0.6 + build * 1.4 + hype * 0.6) * calm + i * 0.9) * 0.55 * spread + (lx - w / 2) / w * -0.6 * build;
        const wid = (0.05 + hype * 0.05 + (1 - build) * 0.02) * (1 + k * 0.3);
        const len = h * 1.2;
        const col = p[i % 3];
        const a = (0.16 + k * 0.1 * calm + hype * 0.1) * energy;
        const g = x.createLinearGradient(lx, ly, lx + Math.sin(ang) * len, ly + Math.cos(ang) * len);
        g.addColorStop(0, css(col, a * 1.8));
        g.addColorStop(1, css(col, 0));
        x.fillStyle = g;
        x.beginPath();
        x.moveTo(lx, ly);
        x.lineTo(lx + Math.sin(ang - wid) * len, ly + Math.cos(ang - wid) * len);
        x.lineTo(lx + Math.sin(ang + wid) * len, ly + Math.cos(ang + wid) * len);
        x.closePath();
        x.fill();
        x.fillStyle = css(mix(col, [255, 255, 255], 0.5), 0.5 + k * 0.4 * energy);
        x.beginPath(); x.arc(lx, ly, 3 + k * 2, 0, 6.283); x.fill();
      }
      // Mitte: Cover-Kugel mit Ring
      const R = Math.min(w, h) * 0.15 * (1 + k * 0.03 * calm);
      const cx = w / 2, cy = h * (w < 600 ? 0.45 : 0.36);
      x.strokeStyle = css(p[2], 0.25 + k * 0.25);
      x.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) { x.beginPath(); x.arc(cx, cy, R * (1.25 + i * 0.32 + k * 0.08 * calm), 0, 6.283); x.stroke(); }
      x.globalCompositeOperation = "source-over";
      x.save();
      x.beginPath(); x.arc(cx, cy, R, 0, 6.283); x.clip();
      x.globalAlpha = dark ? 0.4 : 1;
      x.drawImage(cur().canvas, cx - R, cy - R, R * 2, R * 2);
      x.restore();
      x.globalAlpha = 1;
      // Funken nach dem Drop
      if (sparks.length) {
        x.globalCompositeOperation = "lighter";
        for (const s of sparks) {
          s.x += s.vx; s.y += s.vy; s.vy += 0.12; s.life -= dt / 2600;
          x.fillStyle = css(p[s.c], Math.max(0, s.life));
          x.fillRect(s.x, s.y, 3, 3);
        }
        sparks = sparks.filter((s) => s.life > 0 && s.y < h);
        x.globalCompositeOperation = "source-over";
      }
      // Publikum: Silhouetten mit Randlicht in Songfarben, hintere Reihen im Dunst
      const rows = [css(mix(p[1], [10, 8, 18], 0.62)), css(mix(p[1], [6, 5, 10], 0.82)), "#050409"];
      for (const pp of crowd) {
        const local = b - pp.ph;
        const bounce = st.playing && !reduced ? Math.pow(1 - (local - Math.floor(local)), 2.5) : 0;
        const crouch = build * pp.s * 0.1 * calm;
        const lift = (bounce * pp.amp * pp.s * 0.05 * (energy + hype * 0.8) - crouch) * calm;
        const arms = dark ? 0 : hype > 0 ? 1.2 : build > 0 ? (pp.arms ? 0.25 : 0) : pp.arms ? 0.75 + 0.25 * Math.sin(tt * 2 + pp.ph * 9) : 0;
        x.fillStyle = x.strokeStyle = css(p[pp.rim], 0.55 + k * 0.25);
        x.save(); x.translate(0, -1.6); person(x, pp, lift, arms); x.restore();
        x.fillStyle = x.strokeStyle = rows[pp.row];
        person(x, pp, lift, arms);
      }
      // Blitz (durch die Schranke) klingt in 0,25 s ab
      if (flash > 0) {
        x.fillStyle = `rgba(255,255,255,${(flash * 0.55).toFixed(3)})`;
        x.fillRect(0, 0, w, h);
        flash = Math.max(0, flash - dt / 250);
      }
    }
    return { layout, reset, draw };
  })();
  const noFlashBox = $("[data-noflash]");
  noFlashBox.checked = st.noFlash;
  noFlashBox.addEventListener("change", () => {
    st.noFlash = noFlashBox.checked;
    $("[data-edge]").classList.toggle("calm", st.noFlash);
  });

  /* ================================================================ Party mit Freunden */
  const steps = $$("[data-step]");
  const phScreens = $$("[data-ph]");
  const phone = $("[data-phone]");
  let stepIdx = 0, stepAuto = true, stepT = 0;
  function setStep(i) {
    stepIdx = i;
    steps.forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.step === i)));
    phScreens.forEach((s) => s.classList.toggle("on", +s.dataset.ph === i));
  }
  steps.forEach((b) => b.addEventListener("click", () => { stepAuto = false; setStep(+b.dataset.step); }));
  setStep(0);
  task(phone, (now, dt, b, k) => {
    phone.style.setProperty("--beat", (Math.round((st.noFlash ? k * 0.5 : k) * 20) / 20).toString());
    if (stepAuto && !reduced && (stepT += dt) > 4500) { stepT = 0; setStep((stepIdx + 1) % 3); }
  });

  // Spiele (Namen und Zeilen wie in src/i18n.js / src/i18n-games.js)
  const GAMES = [
    ["music", "🎤", "Who's singing?", "Wer singt hier?", "The next song starts hidden – who names the artist first?", "Der nächste Song startet verdeckt – wer erkennt den Künstler zuerst?"],
    ["music", "🎵", "Name that song", "Wie heißt der Song?", "The next song starts hidden: which title is it?", "Der nächste Song startet verdeckt: Welcher Titel ist es?"],
    ["music", "⏱️", "Intro flash", "Intro-Blitz", "Only the first 5 seconds of the next song: what's it called?", "Nur die ersten 5 Sekunden des nächsten Songs: Wie heißt er?"],
    ["music", "✏️", "Lyric gaps", "Liedtext-Lücken", "An upcoming line with a missing word – solved when it's sung", "Eine kommende Zeile mit fehlendem Wort – aufgelöst, wenn sie gesungen wird"],
    ["music", "📜", "Next line", "Nächste Zeile", "Which lyric line comes next? Solved the moment it's sung", "Welche Zeile kommt als Nächstes? Aufgelöst, wenn sie gesungen wird"],
    ["music", "🕵️", "Real or fake?", "Echt oder Fake?", "A line from the current song, sometimes with a swapped word. Spot the fake", "Eine Zeile aus dem laufenden Song, manchmal mit vertauschtem Wort. Erkennt die Fälschung"],
    ["music", "🥁", "Beat hit", "Beat-Treffer", "Tap along to the beat on your phone: the tightest timing wins", "Tippt am Handy im Takt mit: Das beste Timing gewinnt"],
    ["music", "📅", "Older or newer?", "Älter oder jünger?", "Two songs, a short clip of each: which one came out first?", "Zwei Songs, von jedem ein kurzes Stück: Welcher ist zuerst erschienen?"],
    ["music", "🖼️", "Cover puzzle", "Cover-Rätsel", "A cover goes from blocky to sharp, the music stays off", "Ein Cover wird von grob verpixelt langsam scharf, die Musik bleibt aus"],
    ["music", "⚔️", "Song duel", "Song-Duell", "Two clips, the room votes. The winner takes on the next song", "Zwei Ausschnitte, der Raum stimmt ab. Der Sieger tritt gegen den nächsten Song an"],
    ["quick", "✋", "Music stop", "Musik-Stopp", "The music stops suddenly: tap too early or too late and you're out", "Die Musik stoppt plötzlich: Wer zu früh oder zu spät tippt, fliegt raus"],
    ["quick", "⚡", "Fastest finger", "Schnellster Finger", "Wait for the signal, then tap. Too early loses the round", "Warten, bis das Signal kommt, dann tippen. Zu früh verliert die Runde"],
    ["quick", "👆", "Tap race", "Tipp-Rennen", "15 seconds, one button: most taps wins", "15 Sekunden, ein Knopf: Wer am meisten tippt, gewinnt"],
    ["quick", "💃", "Dance battle", "Tanz-Battle", "Two teams shake their phones for 30 seconds", "Zwei Teams schütteln 30 Sekunden lang ihre Handys"],
    ["quick", "💣", "Hot potato", "Heiße Kartoffel", "A bomb travels from phone to phone: pass it on before it blows up", "Eine Bombe wandert von Handy zu Handy: Gib sie weiter, bevor sie hochgeht"],
    ["party", "🤔", "Who would most likely …?", "Wer würde am ehesten …?", "Vote for a guest. Whoever sides with the majority scores", "Stimmt für einen Gast ab. Wer mit der Mehrheit stimmt, bekommt Punkte"],
    ["party", "🎙️", "Keep singing", "Sing weiter", "The music goes silent mid-song. Are you still in time when it comes back?", "Mitten im Song wird es still. Seid ihr noch im Takt, wenn die Musik zurückkommt?"],
    ["party", "🎶", "Karaoke", "Karaoke", "One guest sings, their phone listens and scores timing, notes and singing along", "Einer singt, sein Handy hört zu und gibt Punkte für Timing, Töne und Dabeisein"],
    ["party", "🏆", "Tournament", "Turnier", "Several games in a row, one ranking across all of them", "Mehrere Spiele hintereinander, eine Rangliste über alle"],
    ["party", "🎱", "Music bingo", "Musik-Bingo", "Every phone gets its own card of song titles. Four in a row wins", "Jedes Handy bekommt eine eigene Karte mit Songtiteln. Vier in einer Reihe gewinnen"],
    ["party", "🎡", "Wheel of fortune", "Glücksrad", "Spins on the big screen and sets something off – no phones needed", "Dreht sich auf dem großen Bild und löst etwas aus – ganz ohne Handys"],
    ["drink", "🙈", "Never have I ever", "Ich hab noch nie", "One statement per round. Whoever has done it takes a sip", "Eine Aussage pro Runde. Wer es schon getan hat, trinkt einen Schluck"],
    ["drink", "🍻", "Sip quiz", "Schluck-Quiz", "Guess the artist. Wrong answer or too slow: one sip", "Errate den Künstler. Falsch oder zu langsam: ein Schluck"],
    ["drink", "🚨", "Word alarm", "Wort-Alarm", "Mirage picks a word from the song. Every time it's sung: one sip", "Mirage wählt ein Wort aus dem Song. Jedes Mal, wenn es gesungen wird: ein Schluck"],
    ["drink", "👉", "Who would … (sip edition)", "Wer würde … (Schluck-Ausgabe)", "Vote for a guest. Most votes takes a sip", "Stimmt für einen Gast. Die meisten Stimmen trinken einen Schluck"],
    ["drink", "🍀", "Sip wheel", "Schluck-Rad", "Spin the wheel: it decides who drinks", "Dreht das Rad: Es entscheidet, wer trinkt"],
  ];
  const gamesEl = $("[data-games]");
  let gCat = "all", gAll = false;
  const moreBtn = $("[data-more]");
  const narrow = matchMedia("(max-width: 760px)");
  function renderGames() {
    const de = lang === "de";
    const list = GAMES.filter((g) => gCat === "all" || g[0] === gCat);
    // schmal: erst 6 Spiele, der Rest auf Knopfdruck
    const cut = narrow.matches && !gAll && list.length > 8;
    moreBtn.hidden = !cut;
    moreBtn.textContent = t("moreGames").replace("{n}", list.length);
    moreBtn.setAttribute("aria-expanded", String(!cut));
    const catName = { music: t("cMusic"), quick: t("cQuick"), party: t("cParty"), drink: "18+" };
    gamesEl.innerHTML = (cut ? list.slice(0, 6) : list)
      .map((g, i) => `<li class="game glass" style="animation-delay:${Math.min(i, 12) * 30}ms"><span class="game-ic" aria-hidden="true">${g[1]}</span><span class="game-tx"><b>${de ? g[3] : g[2]}</b><span>${de ? g[5] : g[4]}</span><span class="tag">${catName[g[0]]}</span></span></li>`)
      .join("");
  }
  $("[data-games-count]").textContent = String(GAMES.length);
  moreBtn.addEventListener("click", () => {
    gAll = true;
    renderGames();
    const next = gamesEl.children[6];
    if (next) { next.tabIndex = -1; next.focus({ preventScroll: true }); }
  });
  narrow.addEventListener("change", renderGames);
  $$("[data-cat]").forEach((b) =>
    b.addEventListener("click", () => {
      gCat = b.dataset.cat;
      $$("[data-cat]").forEach((o) => o.setAttribute("aria-pressed", String(o === b)));
      renderGames();
    }),
  );

  /* ================================================================ Overlay */
  const ovStage = $("[data-ov-stage]");
  const ov = $("[data-ov]");
  const posGrid = $("[data-ov-pos]");
  const V = ["top", "middle", "bottom"], H = ["left", "center", "right"];
  for (let i = 0; i < 9; i++) {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.pos = i;
    b.setAttribute("aria-pressed", String(i === st.ovPos));
    posGrid.append(b);
  }
  let ovTimer = 0;
  function layoutOverlay() {
    ovStage.className = `ov-stage st-${st.ovStyle} v-${V[Math.floor(st.ovPos / 3)]} h-${H[st.ovPos % 3]}`;
  }
  function announceOverlay() {
    clearTimeout(ovTimer);
    ov.classList.remove("in", "open");
    void ov.offsetWidth;
    ov.classList.add("in");
    // Insel: erst die kleine Pille, dann aufziehen
    if (st.ovStyle === "island") ovTimer = setTimeout(() => ov.classList.add("open"), reduced ? 0 : 450);
  }
  $$("[data-ov-style]").forEach((b) =>
    b.addEventListener("click", () => {
      st.ovStyle = b.dataset.ovStyle;
      $$("[data-ov-style]").forEach((o) => o.setAttribute("aria-pressed", String(o === b)));
      layoutOverlay();
      announceOverlay();
    }),
  );
  posGrid.addEventListener("click", (e) => {
    const b = e.target.closest("[data-pos]");
    if (!b) return;
    st.ovPos = +b.dataset.pos;
    $$("[data-pos]", posGrid).forEach((o) => o.setAttribute("aria-pressed", String(o === b)));
    layoutOverlay();
    announceOverlay();
  });
  $("[data-ov-next]").addEventListener("click", () => setSong(st.idx + 1, true));
  // Mini-Player-Knöpfe auf der Ansage (Maus); per Tastatur gibt es die Knöpfe daneben
  $(".ov-ctl").addEventListener("click", (e) => {
    const i = [...e.currentTarget.children].indexOf(e.target.closest("i"));
    if (i === 0) setSong(st.idx - 1, true);
    if (i === 1) setPlaying(!st.playing);
    if (i === 2) setSong(st.idx + 1, true);
  });
  const vol = $("[data-volpill]");
  let volT = 0, volV = 0.64;
  $("[data-ov-vol]").addEventListener("click", () => {
    volV = volV > 0.5 ? 0.3 + Math.random() * 0.15 : 0.7 + Math.random() * 0.2;
    vol.style.setProperty("--v", volV.toFixed(2));
    $("em", vol).textContent = String(Math.round(volV * 100));
    vol.classList.add("in");
    clearTimeout(volT);
    volT = setTimeout(() => vol.classList.remove("in"), 1800);
  });
  // Kantenlicht: Formel wie overlay/edge.html, Schläge durch die Blitz-Schranke
  const edge = $("[data-edge]");
  const edgeBox = $("[data-ov-edge]");
  edgeBox.addEventListener("change", () => {
    st.edge = edgeBox.checked;
    edge.classList.toggle("on", st.edge);
    edge.classList.toggle("calm", st.noFlash);
  });
  let edgeK = 0, edgeLastBeat = -1;
  task($("[data-desk]"), (now, dt, b) => {
    if (!st.edge) return;
    const beat = Math.floor(b);
    if (beat !== edgeLastBeat) {
      edgeLastBeat = beat;
      if (!st.noFlash && st.playing && flashCap(now)) edgeK = 1;
    }
    edgeK = Math.max(0, edgeK - dt / 300);
    const kick = st.noFlash ? 0 : edgeK;
    const e = st.playing ? 0.7 : 0.2;
    const a = Math.min(1, 0.1 + kick * 0.5 + 0.18) * (0.45 + e * 0.55);
    edge.style.setProperty("--edge", a.toFixed(3));
  });

  /* ================================================================ Aufbau-Diagramm */
  const flow = $("[data-flow]");
  const svg = $("[data-flow-svg]");
  function drawFlow() {
    if (getComputedStyle(svg).display === "none") return;
    const fr = flow.getBoundingClientRect();
    const box = (n) => {
      const r = $(`[data-fl="${n}"]`).getBoundingClientRect();
      return { l: r.left - fr.left, r: r.right - fr.left, y: r.top - fr.top + r.height / 2 };
    };
    const src = box("src"), appB = box("app");
    const paths = [`M${src.r},${src.y} L${appB.l},${appB.y}`];
    ["o1", "o2", "o3", "o4"].forEach((o) => {
      const ob = box(o);
      const mx = (appB.r + ob.l) / 2;
      paths.push(`M${appB.r},${appB.y} C${mx},${appB.y} ${mx},${ob.y} ${ob.l},${ob.y}`);
    });
    svg.setAttribute("viewBox", `0 0 ${fr.width} ${fr.height}`);
    svg.innerHTML = paths.map((d) => `<path class="base" d="${d}"/><path class="run" d="${d}"/>`).join("");
  }
  new ResizeObserver(drawFlow).observe(flow);

  /* ================================================================ Installation */
  const osTabs = $$("[data-os]");
  function selectOs(os, focus) {
    osTabs.forEach((b) => {
      const on = b.dataset.os === os;
      b.setAttribute("aria-selected", String(on));
      b.tabIndex = on ? 0 : -1;
      if (on && focus) b.focus();
      $("#" + b.getAttribute("aria-controls")).hidden = !on;
    });
  }
  osTabs.forEach((b, i) => {
    b.addEventListener("click", () => selectOs(b.dataset.os));
    b.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        selectOs(osTabs[(i + 1) % 2].dataset.os, true);
      }
    });
  });
  const ua = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || navigator.userAgent;
  const os = /win/i.test(ua) ? "win" : /mac|iphone|ipad/i.test(ua) ? "mac" : /linux|x11|cros/i.test(ua) ? "linux" : "";
  selectOs(os && os !== "win" ? "unix" : "win");
  $$("[data-dl-os]").forEach((a) => a.classList.toggle("mine", a.dataset.dlOs === os));
  $$("[data-copy]").forEach((b) =>
    b.addEventListener("click", async () => {
      const text = $("#" + b.dataset.copy).textContent;
      let ok = false;
      try {
        await navigator.clipboard.writeText(text);
        ok = true;
      } catch {
        const r = document.createRange();
        r.selectNodeContents($("#" + b.dataset.copy));
        const s = getSelection();
        s.removeAllRanges();
        s.addRange(r);
        try { ok = document.execCommand("copy"); } catch { ok = false; }
      }
      if (ok) {
        b.textContent = t("copied");
        announceEl.textContent = t("copied");
        setTimeout(() => (b.textContent = t("copy")), 1800);
      }
    }),
  );

  /* ================================================================ Sprache anwenden */
  function applyLang(l) {
    lang = l;
    root.lang = l;
    store.set("mirage-demo-lang", l);
    $$("[data-i18n]").forEach((el) => { const v = t(el.dataset.i18n); if (typeof v === "string") el.textContent = v; });
    $$("[data-i18n-aria]").forEach((el) => el.setAttribute("aria-label", t(el.dataset.i18nAria)));
    $$("[data-lang]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === l)));
    $$("[data-pos]", posGrid).forEach((b, i) => b.setAttribute("aria-label", t("pos")[i]));
    document.title = t("title");
    palLabel.textContent = t(palKey);
    labelCovers();
    setPlaying(st.playing);
    renderGames();
    showReal();
    if (!$("[data-drop]").disabled) $("[data-drop]").textContent = t("drop");
    requestAnimationFrame(drawFlow);
  }
  $$("[data-lang]").forEach((b) => b.addEventListener("click", () => applyLang(b.dataset.lang)));

  /* ================================================================ Bewegung */
  reduceQ.addEventListener("change", (e) => {
    reduced = e.matches;
    if (reduced) { st.noFlash = true; noFlashBox.checked = true; }
  });

  /* ================================================================ Start */
  layoutOverlay();
  setSong(0, false);
  setPlaying(true);
  applyLang(lang);
  selectTab("cover");
  start();
})();
