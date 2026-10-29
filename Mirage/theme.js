(() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res, err) => function __init() {
    if (err) throw err[0];
    try {
      return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
    } catch (e) {
      throw err = [e], e;
    }
  };

  // src/core.js
  function lru(max) {
    const m = /* @__PURE__ */ new Map();
    return {
      get(k) {
        if (!m.has(k)) return void 0;
        const v = m.get(k);
        m.delete(k);
        m.set(k, v);
        return v;
      },
      set(k, v) {
        m.delete(k);
        m.set(k, v);
        if (m.size > max) m.delete(m.keys().next().value);
      },
      has: (k) => m.has(k)
    };
  }
  function seek(arr, at, key) {
    let lo = 0, hi = arr.length - 1, r = -1;
    while (lo <= hi) {
      const m = lo + hi >> 1;
      if (arr[m][key] <= at) {
        r = m;
        lo = m + 1;
      } else hi = m - 1;
    }
    return r;
  }
  function loadImage(url, cors) {
    const key = (cors ? "c:" : "") + url;
    if (!imgCache.has(key)) {
      imgCache.set(
        key,
        new Promise((resolve) => {
          const img = new Image();
          if (cors) img.crossOrigin = "anonymous";
          img.decoding = "async";
          img.onload = () => (img.decode ? img.decode().catch(() => {
          }) : Promise.resolve()).then(() => resolve(img));
          img.onerror = () => {
            imgCache.delete(key);
            resolve(null);
          };
          img.src = url;
        })
      );
      if (imgCache.size > 40) imgCache.delete(imgCache.keys().next().value);
    }
    return imgCache.get(key);
  }
  var S, VERSION, root, errors, clamp, hueGap, fmt, imgCache;
  var init_core = __esm({
    "src/core.js"() {
      S = window.Spicetify;
      VERSION = true ? "1.1.0" : "dev";
      root = document.documentElement;
      errors = [];
      addEventListener("error", (e) => errors.length < 30 && errors.push(String(e.message) + " @" + (e.lineno || "")));
      addEventListener("unhandledrejection", (e) => errors.length < 30 && errors.push("promise: " + String(e.reason)));
      clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
      hueGap = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
      fmt = (ms) => {
        const s = Math.max(0, Math.floor((ms || 0) / 1e3));
        return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
      };
      imgCache = /* @__PURE__ */ new Map();
    }
  });

  // src/config.js
  function applyScheme(name) {
    const sc = SCHEMES[name];
    activeScheme = sc ? name : "Mirage";
    const css2 = sc ? "html:root{" + Object.entries(sc).filter(([k]) => k !== "light").map(([k, v]) => `--spice-${k}:#${v};--spice-rgb-${k}:${hexRgb(v).join(",")};`).join("") + "}" : "";
    if (schemeSheet.textContent !== css2) schemeSheet.textContent = css2;
    document.documentElement.dataset.mScheme = activeScheme;
    document.documentElement.classList.toggle("mirage-light", LIGHT.has(activeScheme) || !!sc?.light);
  }
  function resetSettings() {
    const keep = { customSchemes: cfg.customSchemes, pinned: cfg.pinned, playlistSchemes: cfg.playlistSchemes };
    for (const k of Object.keys(cfg)) delete cfg[k];
    Object.assign(cfg, DEFAULTS, keep);
    save();
  }
  function buildScheme({ base, accent, deep, light }) {
    const mix = (a, b, f) => hexRgb(a).map((v, i) => Math.round(v + (hexRgb(b)[i] - v) * f));
    const hex = (rgb) => rgb.map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
    const isLight = hexRgb(base).reduce((s, v) => s + v, 0) / 3 > 140;
    const ink = isLight ? "1D1A2B" : "F5F3FF";
    return {
      text: ink,
      subtext: hex(mix(ink, base, 0.35)),
      main: base,
      "main-elevated": hex(mix(base, ink, 0.05)),
      highlight: hex(mix(base, ink, 0.09)),
      "highlight-elevated": hex(mix(base, ink, 0.14)),
      sidebar: hex(mix(base, ink, 0.025)),
      player: hex(mix(base, ink, 0.025)),
      card: hex(mix(base, ink, 0.06)),
      shadow: isLight ? "9A93B0" : "000000",
      "selected-row": hex(mix(light, ink, 0.3)),
      button: accent,
      "button-active": light,
      "button-disabled": hex(mix(base, ink, 0.25)),
      "tab-active": hex(mix(base, accent, 0.18)),
      notification: deep,
      "notification-error": "FF5C7A",
      misc: hex(mix(ink, base, 0.5)),
      ...isLight ? { light: true } : {}
    };
  }
  var SCHEMES, BUILT_IN, LIGHT, hexRgb, schemeSheet, activeScheme, schemePalette, KEY, schemeIsDynamic, DEFAULTS, cfg, save;
  var init_config = __esm({
    "src/config.js"() {
      init_core();
      SCHEMES = { "Mirage": { "text": "F5F3FF", "subtext": "B9B4CC", "main": "07060C", "main-elevated": "12101C", "highlight": "1C1929", "highlight-elevated": "262236", "sidebar": "0B0A12", "player": "0B0A12", "card": "14121E", "shadow": "000000", "selected-row": "E9E4FF", "button": "B69CFF", "button-active": "D4C6FF", "button-disabled": "4A4560", "tab-active": "2A2540", "notification": "7C5CFF", "notification-error": "FF5C7A", "misc": "8A85A0" }, "Obsidian": { "text": "F2F2F2", "subtext": "A8A8A8", "main": "050505", "main-elevated": "101010", "highlight": "1A1A1A", "highlight-elevated": "242424", "sidebar": "090909", "player": "090909", "card": "121212", "shadow": "000000", "selected-row": "FFFFFF", "button": "E8E8E8", "button-active": "FFFFFF", "button-disabled": "444444", "tab-active": "262626", "notification": "3A3A3A", "notification-error": "FF4D4D", "misc": "7A7A7A" }, "Sakura": { "text": "FFF2F6", "subtext": "D9B3C1", "main": "0E070B", "main-elevated": "1A0E15", "highlight": "26141E", "highlight-elevated": "331B28", "sidebar": "12090E", "player": "12090E", "card": "1C0F17", "shadow": "000000", "selected-row": "FFD6E4", "button": "FF8FB8", "button-active": "FFB8D2", "button-disabled": "5C3A48", "tab-active": "3A1F2D", "notification": "E0507F", "notification-error": "FF5C5C", "misc": "A07C8C" }, "Abyss": { "text": "EAFBFF", "subtext": "9CC3CF", "main": "03090C", "main-elevated": "081419", "highlight": "0E1E25", "highlight-elevated": "152A33", "sidebar": "050D11", "player": "050D11", "card": "0A171D", "shadow": "000000", "selected-row": "C9F6FF", "button": "4FE3FF", "button-active": "9AF0FF", "button-disabled": "2C4A55", "tab-active": "15303A", "notification": "1AA6C2", "notification-error": "FF6B6B", "misc": "6E929E" }, "Ember": { "text": "FFF6EE", "subtext": "D6B8A0", "main": "0C0705", "main-elevated": "18100B", "highlight": "241811", "highlight-elevated": "302016", "sidebar": "100A07", "player": "100A07", "card": "1A110C", "shadow": "000000", "selected-row": "FFE2C7", "button": "FF9F45", "button-active": "FFC48A", "button-disabled": "5A4232", "tab-active": "3A2516", "notification": "E06A1A", "notification-error": "FF4D5E", "misc": "A08670" } };
      SCHEMES.Pearl = { "text": "1D1A2B", "subtext": "5D5873", "main": "F4F1FA", "main-elevated": "FFFFFF", "highlight": "E7E2F2", "highlight-elevated": "DCD5EC", "sidebar": "EEEAF6", "player": "EEEAF6", "card": "FFFFFF", "shadow": "9A93B0", "selected-row": "2A2540", "button": "6B4EE6", "button-active": "4F35C9", "button-disabled": "C9C2DB", "tab-active": "DCD5EC", "notification": "7C5CFF", "notification-error": "D7354F", "misc": "8A85A0" };
      BUILT_IN = Object.keys(SCHEMES);
      LIGHT = /* @__PURE__ */ new Set(["Pearl"]);
      hexRgb = (h) => [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
      schemeSheet = document.createElement("style");
      schemeSheet.id = "mirage-scheme";
      document.head.append(schemeSheet);
      activeScheme = "";
      schemePalette = () => {
        const sc = SCHEMES[activeScheme || cfg.scheme] || SCHEMES.Mirage;
        return [hexRgb(sc.button), hexRgb(sc.notification), hexRgb(sc["button-active"])];
      };
      KEY = "mirage:settings";
      schemeIsDynamic = !S.Config?.color_scheme || /mirage/i.test(S.Config.color_scheme);
      DEFAULTS = {
        dynamic: schemeIsDynamic,
        particles: true,
        vinyl: true,
        tilt: true,
        beat: true,
        cascade: true,
        burst: true,
        overlay: true,
        grain: true,
        glass: false,
        // folgt der Systemeinstellung „Bewegung reduzieren“, bis man selbst schaltet
        calm: !!matchMedia?.("(prefers-reduced-motion: reduce)").matches,
        preset: "balanced",
        autoPerf: true,
        lyrSize: 100,
        lyrGap: 100,
        translate: false,
        canvas: true,
        freeze: false,
        pinned: {},
        playlistSchemes: {},
        customSchemes: {},
        blur: 28,
        bright: 100,
        imMode: "cover",
        vizStyle: "bars",
        vizBars: 120,
        vizHeight: 100,
        vizSmooth: 6,
        vizGlow: true,
        vizRings: true,
        vizMirror: true,
        vizSpin: false,
        scheme: Object.keys(SCHEMES).find((n) => n.toLowerCase() === String(S.Config?.color_scheme || "").toLowerCase()) || "Mirage"
      };
      cfg = { ...DEFAULTS };
      try {
        const saved = JSON.parse(localStorage.getItem(KEY) || "{}");
        if ("scheme" in saved && saved.schemeCfg !== (S.Config?.color_scheme || "")) {
          delete saved.scheme;
          delete saved.dynamic;
        }
        cfg = { ...DEFAULTS, ...saved };
      } catch {
      }
      for (const [name, sc] of Object.entries(cfg.customSchemes || {})) if (!BUILT_IN.includes(name)) SCHEMES[name] = sc;
      save = () => {
        try {
          localStorage.setItem(KEY, JSON.stringify(cfg));
        } catch {
        }
      };
    }
  });

  // src/i18n.js
  var I18N, LANG, t;
  var init_i18n = __esm({
    "src/i18n.js"() {
      init_core();
      I18N = {
        en: {
          menu: "Mirage settings",
          immersive: "Mirage immersive mode",
          back: "Back",
          dialog: "Mirage immersive mode",
          tabCover: "Cover",
          tabLyrics: "Lyrics",
          tabViz: "Visualizer",
          now: "Now playing",
          lyrics: "Lyrics",
          vizBeat: "Visualizer \xB7 on the beat",
          vizAmbient: "Visualizer \xB7 ambient",
          loading: "Loading lyrics \u2026",
          noLyrics: "Spotify has no lyrics for this song.",
          nothing: "Nothing playing",
          seek: "Position in song",
          prev: "Previous",
          play: "Play/Pause",
          next: "Next",
          dynamic: "Colours from the cover",
          dynamicHint: "The whole interface takes on the song's colours",
          particles: "Light dust",
          particlesHint: "Floating specks of light in the background",
          beat: "Background on the beat",
          beatHint: "Pulses with the beats when Spotify provides beat data",
          cascade: "Page animations",
          cascadeHint: "Content glides in when you switch pages",
          vinyl: "Vinyl cover",
          vinylHint: "The cover at the bottom becomes a spinning record",
          tilt: "3D cards",
          tiltHint: "Cards tilt towards the mouse pointer",
          burst: "Heart burst",
          burstHint: "A shower of sparks when you like a song",
          overlay: "Mirage Overlay",
          overlayHint: "Send song changes to the overlay app outside of Spotify",
          grain: "Film grain",
          grainHint: "Fine noise over the background",
          calm: "Calm mode",
          calmHint: "Stops all background animations",
          blur: "Glass blur (real glass only)",
          bright: "Background brightness",
          vizSection: "Visualizer",
          vizSectionHint: "Look of the visualizer in immersive mode \u2013 changes apply live",
          viz_bars: "Bars",
          viz_wave: "Wave",
          viz_dots: "Dots",
          vizBars: "Number of bars",
          vizHeight: "Height",
          vizSmooth: "Smoothness",
          vizGlow: "Glow",
          vizRings: "Rings on the beat",
          vizMirror: "Mirrored",
          vizSpin: "Slow rotation",
          scheme: "Colour scheme",
          schemeHint: "Switches instantly \u2013 Mirage follows the cover live",
          glass: "Real glass",
          glassHint: "Blurs live behind every panel \u2013 looks richer, costs a lot of performance",
          c_shuffle: "Shuffle (S)",
          c_repeat: "Repeat (R)",
          c_like: "Like (L)",
          c_mute: "Mute",
          c_full: "Full screen (F)",
          c_volume: "Volume (\u2191 \u2193)",
          tip: "Immersive mode: Ctrl + Shift + M or the circle button at the top. Inside: 1 \xB7 2 \xB7 3 view, Space play, \u2190 \u2192 seek, \u2191 \u2193 volume, L like, S shuffle, R repeat, F full screen.",
          presetTitle: "Look & performance",
          presetHint: "One click sets everything \u2013 fine-tune below",
          preset_full: "Full",
          preset_balanced: "Balanced",
          preset_light: "Light",
          preset_calm: "Calm",
          presetCustom: "Custom \u2013 you changed single switches",
          perfStepped: "Mirage ran at {fps} fps here and switched to \u201C{preset}\u201D to stay smooth.",
          autoPerf: "Adapt automatically",
          autoPerfHint: "Steps down one level if your PC can't keep up",
          costly: "Costs performance and battery",
          safeMode: "Spotify {v} changed its layout \u2013 Mirage switched to safe mode (colours only). An update of Mirage fixes it.",
          share: "Share as image",
          shareNow: "Share now playing",
          shareWeek: "Your week in colours",
          shareCopied: "Image copied \u2013 and saved to Downloads",
          shareSaved: "Image saved to Downloads",
          weekKicker: "Mirage \xB7 last 7 days",
          weekTitle: "Your week in colours",
          weekSongs: "songs",
          weekMinutes: "minutes",
          weekColours: "Colours of your covers",
          weekArtists: "Most played",
          weekEmpty: "Play a few songs \u2013 your week fills up.",
          weekScheme: "Favourite scheme: {s}",
          keysTitle: "Keyboard shortcuts",
          k_play: "Play / pause",
          k_seek: "Seek 5 s",
          k_vol: "Volume",
          k_view: "Cover \xB7 lyrics \xB7 visualizer",
          k_like: "Like",
          k_shuffle: "Shuffle",
          k_repeat: "Repeat",
          k_full: "Full screen",
          k_next: "Next / previous",
          k_close: "Close",
          unsynced: "These lyrics aren't time-synced \u2013 they scroll freely.",
          g_colours: "Colours",
          g_background: "Background",
          g_motion: "Animations",
          g_immersive: "Immersive mode",
          g_builder: "Build your own scheme",
          g_overlay: "Overlay",
          g_more: "Share, back up & help",
          freeze: "Freeze colours",
          freezeHint: "Keeps the current colours, whatever plays",
          pinAlbum: "Remember colours of this album",
          unpinAlbum: "Forget this album's colours",
          pinnedAlbum: "This album now always gets these colours",
          unpinnedAlbum: "Album colours forgotten",
          playlistSchemeOn: "Use \u201C{s}\u201D for this playlist",
          playlistSchemeOff: "Playlist uses \u201C{s}\u201D \u2013 remove",
          lyrSize: "Lyrics size",
          lyrGap: "Line spacing",
          translate: "Translate lyrics",
          translateHint: "Shows a translation under each line \u2013 the lines are sent to Google Translate",
          canvas: "Canvas videos",
          canvasHint: "Spotify's short looping videos behind the cover, where available",
          viz_particles: "Particles",
          viz_line: "Line",
          viz_bottom: "Bottom bars",
          c_base: "Background",
          c_accent: "Accent",
          c_deep: "Deep",
          c_light: "Light",
          schemeName: "Name of your scheme",
          schemeCodeHint: "Paste a scheme code here to import it",
          schemeSave: "Save scheme",
          schemeCopy: "Copy as code",
          schemeImport: "Import code",
          schemeNameTaken: "Give it a name that isn't a built-in scheme",
          schemeDelete: "Delete scheme",
          copied: "Copied",
          badCode: "That code doesn't look right",
          settingsCodeHint: "Paste a settings code here to import it",
          exportSettings: "Copy settings",
          importSettings: "Import settings",
          diagnostics: "Copy diagnostics",
          reset: "Reset",
          resetConfirm: "Reset all Mirage settings? Your own schemes and remembered colours stay.",
          welcomeTitle: "Welcome to Mirage",
          welcomeText: "Ctrl + Shift + M opens the immersive mode. Settings are in your profile menu.",
          welcomeImmersive: "Try immersive mode",
          c_smart: "Smart Shuffle (S)",
          c_queue: "Up next (Q)",
          c_devices: "Devices",
          c_timer: "Sleep timer",
          queueEmpty: "Nothing queued",
          devicesNone: "No other devices found",
          deviceActive: "Playing here",
          timerTrack: "End of this song",
          timerOff: "Off",
          timerLeft: "{m} min left",
          k_queue: "Up next"
        },
        de: {
          menu: "Mirage-Einstellungen",
          immersive: "Mirage Immersiv-Modus",
          back: "Zur\xFCck",
          dialog: "Mirage Immersiv-Modus",
          tabCover: "Cover",
          tabLyrics: "Liedtext",
          tabViz: "Visualizer",
          now: "L\xE4uft gerade",
          lyrics: "Liedtext",
          vizBeat: "Visualizer \xB7 im Takt",
          vizAmbient: "Visualizer \xB7 Ambient",
          loading: "Liedtext wird geladen \u2026",
          noLyrics: "F\xFCr diesen Song hat Spotify keinen Liedtext.",
          nothing: "Nichts l\xE4uft",
          seek: "Position im Song",
          prev: "Zur\xFCck",
          play: "Wiedergabe/Pause",
          next: "Weiter",
          dynamic: "Farben aus dem Cover",
          dynamicHint: "Die ganze Oberfl\xE4che nimmt die Farben des Songs an",
          particles: "Lichtstaub",
          particlesHint: "Schwebende Lichtpunkte im Hintergrund",
          beat: "Hintergrund im Takt",
          beatHint: "Pulsiert mit den Beats, wenn Spotify Taktdaten liefert",
          cascade: "Seiten-Animationen",
          cascadeHint: "Inhalte gleiten beim Seitenwechsel herein",
          vinyl: "Vinyl-Cover",
          vinylHint: "Das Cover unten wird zur Platte und dreht sich",
          tilt: "3D-Karten",
          tiltHint: "Karten neigen sich zum Mauszeiger",
          burst: "Herz-Explosion",
          burstHint: "Funkenregen, wenn du einen Song likest",
          overlay: "Mirage Overlay",
          overlayHint: "Songwechsel an die Overlay-App au\xDFerhalb von Spotify senden",
          grain: "Filmkorn",
          grainHint: "Feines Rauschen \xFCber dem Hintergrund",
          calm: "Ruhiger Modus",
          calmHint: "H\xE4lt alle Hintergrund-Animationen an",
          blur: "Glas-Unsch\xE4rfe (nur echtes Glas)",
          bright: "Helligkeit des Hintergrunds",
          vizSection: "Visualizer",
          vizSectionHint: "Aussehen des Visualizers im Immersiv-Modus \u2013 wirkt sofort",
          viz_bars: "Balken",
          viz_wave: "Welle",
          viz_dots: "Punkte",
          vizBars: "Anzahl Balken",
          vizHeight: "H\xF6he",
          vizSmooth: "Weichheit",
          vizGlow: "Leuchten",
          vizRings: "Ringe im Takt",
          vizMirror: "Gespiegelt",
          vizSpin: "Langsame Drehung",
          scheme: "Farbschema",
          schemeHint: "Wechselt sofort \u2013 Mirage folgt live dem Cover",
          glass: "Echtes Glas",
          glassHint: "Verwischt live hinter jeder Fl\xE4che \u2013 edler, kostet aber viel Leistung",
          c_shuffle: "Zufallswiedergabe (S)",
          c_repeat: "Wiederholen (R)",
          c_like: "Liken (L)",
          c_mute: "Stumm",
          c_full: "Vollbild (F)",
          c_volume: "Lautst\xE4rke (\u2191 \u2193)",
          tip: "Immersiv-Modus: Strg + Umschalt + M oder der Kreis-Knopf oben. Darin: 1 \xB7 2 \xB7 3 Ansicht, Leertaste Wiedergabe, \u2190 \u2192 spulen, \u2191 \u2193 Lautst\xE4rke, L liken, S Zufall, R Wiederholen, F Vollbild.",
          presetTitle: "Aussehen & Leistung",
          presetHint: "Ein Klick stellt alles ein \u2013 darunter feintunen",
          preset_full: "Voll",
          preset_balanced: "Ausgewogen",
          preset_light: "Leicht",
          preset_calm: "Ruhig",
          presetCustom: "Eigene \u2013 du hast einzelne Schalter ge\xE4ndert",
          perfStepped: "Mirage lief hier mit {fps} fps und ist auf \u201E{preset}\u201C gewechselt, damit alles fl\xFCssig bleibt.",
          autoPerf: "Automatisch anpassen",
          autoPerfHint: "Geht eine Stufe runter, wenn der PC nicht mitkommt",
          costly: "Kostet Leistung und Akku",
          safeMode: "Spotify {v} hat seinen Aufbau ge\xE4ndert \u2013 Mirage l\xE4uft im sicheren Modus (nur Farben). Ein Mirage-Update behebt das.",
          share: "Als Bild teilen",
          shareNow: "Aktuellen Song teilen",
          shareWeek: "Deine Woche in Farben",
          shareCopied: "Bild kopiert \u2013 und unter Downloads gespeichert",
          shareSaved: "Bild unter Downloads gespeichert",
          weekKicker: "Mirage \xB7 letzte 7 Tage",
          weekTitle: "Deine Woche in Farben",
          weekSongs: "Songs",
          weekMinutes: "Minuten",
          weekColours: "Farben deiner Cover",
          weekArtists: "Am meisten geh\xF6rt",
          weekEmpty: "H\xF6r ein paar Songs \u2013 deine Woche f\xFCllt sich.",
          weekScheme: "Lieblingsschema: {s}",
          keysTitle: "Tastenk\xFCrzel",
          k_play: "Wiedergabe / Pause",
          k_seek: "5 s spulen",
          k_vol: "Lautst\xE4rke",
          k_view: "Cover \xB7 Liedtext \xB7 Visualizer",
          k_like: "Liken",
          k_shuffle: "Zufall",
          k_repeat: "Wiederholen",
          k_full: "Vollbild",
          k_next: "Weiter / zur\xFCck",
          k_close: "Schlie\xDFen",
          unsynced: "Dieser Liedtext ist nicht zeitgenau \u2013 er l\xE4uft nicht mit.",
          g_colours: "Farben",
          g_background: "Hintergrund",
          g_motion: "Animationen",
          g_immersive: "Immersiv-Modus",
          g_builder: "Eigenes Schema bauen",
          g_overlay: "Overlay",
          g_more: "Teilen, sichern & Hilfe",
          freeze: "Farben einfrieren",
          freezeHint: "Beh\xE4lt die jetzigen Farben, egal was l\xE4uft",
          pinAlbum: "Farben dieses Albums merken",
          unpinAlbum: "Farben dieses Albums vergessen",
          pinnedAlbum: "Dieses Album bekommt jetzt immer diese Farben",
          unpinnedAlbum: "Album-Farben vergessen",
          playlistSchemeOn: "\u201E{s}\u201C f\xFCr diese Playlist nutzen",
          playlistSchemeOff: "Playlist nutzt \u201E{s}\u201C \u2013 entfernen",
          lyrSize: "Liedtext-Gr\xF6\xDFe",
          lyrGap: "Zeilenabstand",
          translate: "Liedtext \xFCbersetzen",
          translateHint: "Zeigt unter jeder Zeile eine \xDCbersetzung \u2013 die Zeilen gehen daf\xFCr an Google Translate",
          canvas: "Canvas-Videos",
          canvasHint: "Spotifys kurze Video-Loops hinter dem Cover, wo vorhanden",
          viz_particles: "Partikel",
          viz_line: "Linie",
          viz_bottom: "Balken unten",
          c_base: "Hintergrund",
          c_accent: "Akzent",
          c_deep: "Tief",
          c_light: "Hell",
          schemeName: "Name deines Schemas",
          schemeCodeHint: "Schema-Code hier einf\xFCgen, um ihn zu laden",
          schemeSave: "Schema speichern",
          schemeCopy: "Als Code kopieren",
          schemeImport: "Code laden",
          schemeNameTaken: "Gib einen Namen, der kein mitgeliefertes Schema ist",
          schemeDelete: "Schema l\xF6schen",
          copied: "Kopiert",
          badCode: "Der Code sieht nicht richtig aus",
          settingsCodeHint: "Einstellungs-Code hier einf\xFCgen, um ihn zu laden",
          exportSettings: "Einstellungen kopieren",
          importSettings: "Einstellungen laden",
          diagnostics: "Diagnose kopieren",
          reset: "Zur\xFCcksetzen",
          resetConfirm: "Alle Mirage-Einstellungen zur\xFCcksetzen? Eigene Schemata und gemerkte Farben bleiben.",
          welcomeTitle: "Willkommen bei Mirage",
          welcomeText: "Strg + Umschalt + M \xF6ffnet den Immersiv-Modus. Die Einstellungen findest du im Profilmen\xFC.",
          welcomeImmersive: "Immersiv-Modus ausprobieren",
          c_smart: "Smart Shuffle (S)",
          c_queue: "Als N\xE4chstes (Q)",
          c_devices: "Ger\xE4te",
          c_timer: "Schlaf-Timer",
          queueEmpty: "Nichts in der Warteschlange",
          devicesNone: "Keine anderen Ger\xE4te gefunden",
          deviceActive: "L\xE4uft hier",
          timerTrack: "Ende dieses Songs",
          timerOff: "Aus",
          timerLeft: "noch {m} min",
          k_queue: "Als N\xE4chstes"
        },
        fr: {
          menu: "R\xE9glages Mirage",
          immersive: "Mode immersif Mirage",
          back: "Retour",
          dialog: "Mode immersif Mirage",
          tabCover: "Pochette",
          tabLyrics: "Paroles",
          tabViz: "Visualiseur",
          now: "En cours de lecture",
          lyrics: "Paroles",
          vizBeat: "Visualiseur \xB7 en rythme",
          vizAmbient: "Visualiseur \xB7 ambiance",
          loading: "Chargement des paroles \u2026",
          noLyrics: "Spotify n'a pas de paroles pour ce titre.",
          nothing: "Aucune lecture",
          seek: "Position dans le titre",
          prev: "Pr\xE9c\xE9dent",
          play: "Lecture/Pause",
          next: "Suivant",
          dynamic: "Couleurs de la pochette",
          dynamicHint: "Toute l'interface prend les couleurs du titre",
          particles: "Poussi\xE8re de lumi\xE8re",
          particlesHint: "Points lumineux flottants en arri\xE8re-plan",
          beat: "Fond en rythme",
          beatHint: "Pulse sur les temps quand Spotify fournit les donn\xE9es",
          cascade: "Animations de page",
          cascadeHint: "Le contenu glisse \xE0 chaque changement de page",
          vinyl: "Pochette vinyle",
          vinylHint: "La pochette devient un disque qui tourne",
          tilt: "Cartes 3D",
          tiltHint: "Les cartes s'inclinent vers le pointeur",
          burst: "Explosion de c\u0153urs",
          burstHint: "Une pluie d'\xE9tincelles quand tu aimes un titre",
          overlay: "Mirage Overlay",
          overlayHint: "Envoyer les changements de titre \xE0 l'app overlay",
          grain: "Grain de film",
          grainHint: "L\xE9ger bruit sur l'arri\xE8re-plan",
          calm: "Mode calme",
          calmHint: "Arr\xEAte toutes les animations d'arri\xE8re-plan",
          blur: "Flou du verre",
          bright: "Luminosit\xE9 du fond",
          tip: "Mode immersif : Ctrl + Maj + M ou le bouton rond en haut. \xC0 l'int\xE9rieur, 1 \xB7 2 \xB7 3 changent la vue."
        },
        es: {
          menu: "Ajustes de Mirage",
          immersive: "Modo inmersivo Mirage",
          back: "Volver",
          dialog: "Modo inmersivo Mirage",
          tabCover: "Portada",
          tabLyrics: "Letra",
          tabViz: "Visualizador",
          now: "Sonando ahora",
          lyrics: "Letra",
          vizBeat: "Visualizador \xB7 al ritmo",
          vizAmbient: "Visualizador \xB7 ambiente",
          loading: "Cargando letra \u2026",
          noLyrics: "Spotify no tiene letra para esta canci\xF3n.",
          nothing: "No suena nada",
          seek: "Posici\xF3n en la canci\xF3n",
          prev: "Anterior",
          play: "Reproducir/Pausa",
          next: "Siguiente",
          dynamic: "Colores de la portada",
          dynamicHint: "Toda la interfaz adopta los colores de la canci\xF3n",
          particles: "Polvo de luz",
          particlesHint: "Puntos de luz flotando en el fondo",
          beat: "Fondo al ritmo",
          beatHint: "Late con los beats cuando Spotify da los datos",
          cascade: "Animaciones de p\xE1gina",
          cascadeHint: "El contenido entra desliz\xE1ndose al cambiar de p\xE1gina",
          vinyl: "Portada de vinilo",
          vinylHint: "La portada se convierte en un disco que gira",
          tilt: "Tarjetas 3D",
          tiltHint: "Las tarjetas se inclinan hacia el puntero",
          burst: "Explosi\xF3n de corazones",
          burstHint: "Lluvia de chispas al dar me gusta",
          overlay: "Mirage Overlay",
          overlayHint: "Enviar cambios de canci\xF3n a la app overlay",
          grain: "Grano de pel\xEDcula",
          grainHint: "Ruido fino sobre el fondo",
          calm: "Modo tranquilo",
          calmHint: "Detiene todas las animaciones del fondo",
          blur: "Desenfoque del cristal",
          bright: "Brillo del fondo",
          tip: "Modo inmersivo: Ctrl + May\xFAs + M o el bot\xF3n redondo de arriba. Dentro, 1 \xB7 2 \xB7 3 cambian la vista."
        },
        it: {
          menu: "Impostazioni Mirage",
          immersive: "Modalit\xE0 immersiva Mirage",
          back: "Indietro",
          dialog: "Modalit\xE0 immersiva Mirage",
          tabCover: "Copertina",
          tabLyrics: "Testo",
          tabViz: "Visualizzatore",
          now: "In riproduzione",
          lyrics: "Testo",
          vizBeat: "Visualizzatore \xB7 a tempo",
          vizAmbient: "Visualizzatore \xB7 ambient",
          loading: "Caricamento testo \u2026",
          noLyrics: "Spotify non ha il testo di questo brano.",
          nothing: "Niente in riproduzione",
          seek: "Posizione nel brano",
          prev: "Precedente",
          play: "Riproduci/Pausa",
          next: "Successivo",
          dynamic: "Colori dalla copertina",
          dynamicHint: "Tutta l'interfaccia prende i colori del brano",
          particles: "Polvere di luce",
          particlesHint: "Punti luminosi fluttuanti sullo sfondo",
          beat: "Sfondo a tempo",
          beatHint: "Pulsa sui battiti quando Spotify fornisce i dati",
          cascade: "Animazioni di pagina",
          cascadeHint: "I contenuti scivolano dentro al cambio pagina",
          vinyl: "Copertina vinile",
          vinylHint: "La copertina diventa un disco che gira",
          tilt: "Schede 3D",
          tiltHint: "Le schede si inclinano verso il puntatore",
          burst: "Esplosione di cuori",
          burstHint: "Pioggia di scintille quando metti mi piace",
          overlay: "Mirage Overlay",
          overlayHint: "Invia i cambi di brano all'app overlay",
          grain: "Grana",
          grainHint: "Leggero rumore sullo sfondo",
          calm: "Modalit\xE0 calma",
          calmHint: "Ferma tutte le animazioni dello sfondo",
          blur: "Sfocatura vetro",
          bright: "Luminosit\xE0 dello sfondo",
          tip: "Modalit\xE0 immersiva: Ctrl + Maiusc + M o il pulsante rotondo in alto. All'interno 1 \xB7 2 \xB7 3 cambiano vista."
        },
        pt: {
          menu: "Configura\xE7\xF5es do Mirage",
          immersive: "Modo imersivo Mirage",
          back: "Voltar",
          dialog: "Modo imersivo Mirage",
          tabCover: "Capa",
          tabLyrics: "Letra",
          tabViz: "Visualizador",
          now: "Tocando agora",
          lyrics: "Letra",
          vizBeat: "Visualizador \xB7 no ritmo",
          vizAmbient: "Visualizador \xB7 ambiente",
          loading: "Carregando letra \u2026",
          noLyrics: "O Spotify n\xE3o tem letra para esta m\xFAsica.",
          nothing: "Nada tocando",
          seek: "Posi\xE7\xE3o na m\xFAsica",
          prev: "Anterior",
          play: "Tocar/Pausar",
          next: "Pr\xF3xima",
          dynamic: "Cores da capa",
          dynamicHint: "Toda a interface assume as cores da m\xFAsica",
          particles: "Poeira de luz",
          particlesHint: "Pontos de luz flutuando no fundo",
          beat: "Fundo no ritmo",
          beatHint: "Pulsa com as batidas quando o Spotify fornece os dados",
          cascade: "Anima\xE7\xF5es de p\xE1gina",
          cascadeHint: "O conte\xFAdo desliza ao trocar de p\xE1gina",
          vinyl: "Capa de vinil",
          vinylHint: "A capa vira um disco girando",
          tilt: "Cart\xF5es 3D",
          tiltHint: "Os cart\xF5es se inclinam para o ponteiro",
          burst: "Explos\xE3o de cora\xE7\xF5es",
          burstHint: "Chuva de fa\xEDscas ao curtir uma m\xFAsica",
          overlay: "Mirage Overlay",
          overlayHint: "Enviar trocas de m\xFAsica ao app overlay",
          grain: "Granula\xE7\xE3o",
          grainHint: "Ru\xEDdo fino sobre o fundo",
          calm: "Modo calmo",
          calmHint: "Para todas as anima\xE7\xF5es do fundo",
          blur: "Desfoque do vidro",
          bright: "Brilho do fundo",
          tip: "Modo imersivo: Ctrl + Shift + M ou o bot\xE3o redondo no topo. Dentro, 1 \xB7 2 \xB7 3 trocam a vis\xE3o."
        },
        nl: {
          menu: "Mirage-instellingen",
          immersive: "Mirage meeslepende modus",
          back: "Terug",
          dialog: "Mirage meeslepende modus",
          tabCover: "Hoes",
          tabLyrics: "Songtekst",
          tabViz: "Visualizer",
          now: "Nu aan het spelen",
          lyrics: "Songtekst",
          vizBeat: "Visualizer \xB7 op de beat",
          vizAmbient: "Visualizer \xB7 ambient",
          loading: "Songtekst laden \u2026",
          noLyrics: "Spotify heeft geen songtekst voor dit nummer.",
          nothing: "Er speelt niets",
          seek: "Positie in nummer",
          prev: "Vorige",
          play: "Afspelen/Pauze",
          next: "Volgende",
          dynamic: "Kleuren uit de hoes",
          dynamicHint: "De hele interface neemt de kleuren van het nummer aan",
          particles: "Lichtstof",
          particlesHint: "Zwevende lichtpuntjes op de achtergrond",
          beat: "Achtergrond op de beat",
          beatHint: "Pulseert mee als Spotify beatdata levert",
          cascade: "Pagina-animaties",
          cascadeHint: "Inhoud glijdt binnen bij een paginawissel",
          vinyl: "Vinylhoes",
          vinylHint: "De hoes wordt een draaiende plaat",
          tilt: "3D-kaarten",
          tiltHint: "Kaarten kantelen naar de muisaanwijzer",
          burst: "Hartjesexplosie",
          burstHint: "Vonkenregen als je een nummer liket",
          overlay: "Mirage Overlay",
          overlayHint: "Nummerwissels naar de overlay-app sturen",
          grain: "Filmkorrel",
          grainHint: "Fijne ruis over de achtergrond",
          calm: "Rustige modus",
          calmHint: "Stopt alle achtergrondanimaties",
          blur: "Glasvervaging",
          bright: "Helderheid achtergrond",
          tip: "Meeslepende modus: Ctrl + Shift + M of de ronde knop bovenaan. Daarin wisselen 1 \xB7 2 \xB7 3 de weergave."
        },
        pl: {
          menu: "Ustawienia Mirage",
          immersive: "Tryb immersyjny Mirage",
          back: "Wstecz",
          dialog: "Tryb immersyjny Mirage",
          tabCover: "Ok\u0142adka",
          tabLyrics: "Tekst",
          tabViz: "Wizualizator",
          now: "Teraz odtwarzane",
          lyrics: "Tekst",
          vizBeat: "Wizualizator \xB7 w rytm",
          vizAmbient: "Wizualizator \xB7 ambient",
          loading: "Wczytywanie tekstu \u2026",
          noLyrics: "Spotify nie ma tekstu tego utworu.",
          nothing: "Nic nie gra",
          seek: "Pozycja w utworze",
          prev: "Poprzedni",
          play: "Odtw\xF3rz/Pauza",
          next: "Nast\u0119pny",
          dynamic: "Kolory z ok\u0142adki",
          dynamicHint: "Ca\u0142y interfejs przyjmuje kolory utworu",
          particles: "\u015Awietlny py\u0142",
          particlesHint: "Unosz\u0105ce si\u0119 punkty \u015Bwiat\u0142a w tle",
          beat: "T\u0142o w rytm",
          beatHint: "Pulsuje z beatem, gdy Spotify podaje dane",
          cascade: "Animacje stron",
          cascadeHint: "Tre\u015B\u0107 wsuwa si\u0119 przy zmianie strony",
          vinyl: "Ok\u0142adka winylowa",
          vinylHint: "Ok\u0142adka staje si\u0119 kr\u0119c\u0105c\u0105 si\u0119 p\u0142yt\u0105",
          tilt: "Karty 3D",
          tiltHint: "Karty pochylaj\u0105 si\u0119 w stron\u0119 kursora",
          burst: "Eksplozja serc",
          burstHint: "Deszcz iskier, gdy polubisz utw\xF3r",
          overlay: "Mirage Overlay",
          overlayHint: "Wysy\u0142aj zmiany utwor\xF3w do aplikacji overlay",
          grain: "Ziarno filmu",
          grainHint: "Delikatny szum na tle",
          calm: "Tryb spokojny",
          calmHint: "Zatrzymuje wszystkie animacje t\u0142a",
          blur: "Rozmycie szk\u0142a",
          bright: "Jasno\u015B\u0107 t\u0142a",
          tip: "Tryb immersyjny: Ctrl + Shift + M lub okr\u0105g\u0142y przycisk u g\xF3ry. W \u015Brodku 1 \xB7 2 \xB7 3 zmieniaj\u0105 widok."
        },
        tr: {
          menu: "Mirage ayarlar\u0131",
          immersive: "Mirage s\xFCr\xFCkleyici mod",
          back: "Geri",
          dialog: "Mirage s\xFCr\xFCkleyici mod",
          tabCover: "Kapak",
          tabLyrics: "\u015Eark\u0131 s\xF6z\xFC",
          tabViz: "G\xF6rselle\u015Ftirici",
          now: "\u015Eimdi \xE7al\u0131yor",
          lyrics: "\u015Eark\u0131 s\xF6z\xFC",
          vizBeat: "G\xF6rselle\u015Ftirici \xB7 ritimde",
          vizAmbient: "G\xF6rselle\u015Ftirici \xB7 ambiyans",
          loading: "\u015Eark\u0131 s\xF6zleri y\xFCkleniyor \u2026",
          noLyrics: "Spotify'da bu \u015Fark\u0131n\u0131n s\xF6zleri yok.",
          nothing: "Hi\xE7bir \u015Fey \xE7alm\u0131yor",
          seek: "\u015Eark\u0131daki konum",
          prev: "\xD6nceki",
          play: "Oynat/Duraklat",
          next: "Sonraki",
          dynamic: "Kapaktan renkler",
          particles: "I\u015F\u0131k tozu",
          beat: "Ritimde arka plan",
          cascade: "Sayfa animasyonlar\u0131",
          vinyl: "Plak kapa\u011F\u0131",
          tilt: "3D kartlar",
          burst: "Kalp patlamas\u0131",
          grain: "Film greni",
          calm: "Sakin mod",
          blur: "Cam bulan\u0131kl\u0131\u011F\u0131",
          bright: "Arka plan parlakl\u0131\u011F\u0131"
        },
        ru: {
          menu: "\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438 Mirage",
          immersive: "\u0420\u0435\u0436\u0438\u043C \u043F\u043E\u0433\u0440\u0443\u0436\u0435\u043D\u0438\u044F Mirage",
          back: "\u041D\u0430\u0437\u0430\u0434",
          dialog: "\u0420\u0435\u0436\u0438\u043C \u043F\u043E\u0433\u0440\u0443\u0436\u0435\u043D\u0438\u044F Mirage",
          tabCover: "\u041E\u0431\u043B\u043E\u0436\u043A\u0430",
          tabLyrics: "\u0422\u0435\u043A\u0441\u0442",
          tabViz: "\u0412\u0438\u0437\u0443\u0430\u043B\u0438\u0437\u0430\u0442\u043E\u0440",
          now: "\u0421\u0435\u0439\u0447\u0430\u0441 \u0438\u0433\u0440\u0430\u0435\u0442",
          lyrics: "\u0422\u0435\u043A\u0441\u0442",
          vizBeat: "\u0412\u0438\u0437\u0443\u0430\u043B\u0438\u0437\u0430\u0442\u043E\u0440 \xB7 \u0432 \u0442\u0430\u043A\u0442",
          vizAmbient: "\u0412\u0438\u0437\u0443\u0430\u043B\u0438\u0437\u0430\u0442\u043E\u0440 \xB7 \u044D\u043C\u0431\u0438\u0435\u043D\u0442",
          loading: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u0442\u0435\u043A\u0441\u0442\u0430 \u2026",
          noLyrics: "\u0423 Spotify \u043D\u0435\u0442 \u0442\u0435\u043A\u0441\u0442\u0430 \u0434\u043B\u044F \u044D\u0442\u043E\u0439 \u043F\u0435\u0441\u043D\u0438.",
          nothing: "\u041D\u0438\u0447\u0435\u0433\u043E \u043D\u0435 \u0438\u0433\u0440\u0430\u0435\u0442",
          seek: "\u041F\u043E\u0437\u0438\u0446\u0438\u044F \u0432 \u0442\u0440\u0435\u043A\u0435",
          prev: "\u041D\u0430\u0437\u0430\u0434",
          play: "\u0412\u043E\u0441\u043F\u0440\u043E\u0438\u0437\u0432\u0435\u0441\u0442\u0438/\u041F\u0430\u0443\u0437\u0430",
          next: "\u0414\u0430\u043B\u0435\u0435",
          dynamic: "\u0426\u0432\u0435\u0442\u0430 \u0438\u0437 \u043E\u0431\u043B\u043E\u0436\u043A\u0438",
          particles: "\u0421\u0432\u0435\u0442\u043E\u0432\u0430\u044F \u043F\u044B\u043B\u044C",
          beat: "\u0424\u043E\u043D \u0432 \u0442\u0430\u043A\u0442",
          cascade: "\u0410\u043D\u0438\u043C\u0430\u0446\u0438\u0438 \u0441\u0442\u0440\u0430\u043D\u0438\u0446",
          vinyl: "\u0412\u0438\u043D\u0438\u043B\u043E\u0432\u0430\u044F \u043E\u0431\u043B\u043E\u0436\u043A\u0430",
          tilt: "3D-\u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0438",
          burst: "\u0412\u0437\u0440\u044B\u0432 \u0441\u0435\u0440\u0434\u0435\u0446",
          grain: "\u0417\u0435\u0440\u043D\u043E \u043F\u043B\u0451\u043D\u043A\u0438",
          calm: "\u0421\u043F\u043E\u043A\u043E\u0439\u043D\u044B\u0439 \u0440\u0435\u0436\u0438\u043C",
          blur: "\u0420\u0430\u0437\u043C\u044B\u0442\u0438\u0435 \u0441\u0442\u0435\u043A\u043B\u0430",
          bright: "\u042F\u0440\u043A\u043E\u0441\u0442\u044C \u0444\u043E\u043D\u0430"
        },
        uk: {
          menu: "\u041D\u0430\u043B\u0430\u0448\u0442\u0443\u0432\u0430\u043D\u043D\u044F Mirage",
          immersive: "\u0420\u0435\u0436\u0438\u043C \u0437\u0430\u043D\u0443\u0440\u0435\u043D\u043D\u044F Mirage",
          back: "\u041D\u0430\u0437\u0430\u0434",
          tabCover: "\u041E\u0431\u043A\u043B\u0430\u0434\u0438\u043D\u043A\u0430",
          tabLyrics: "\u0422\u0435\u043A\u0441\u0442",
          tabViz: "\u0412\u0456\u0437\u0443\u0430\u043B\u0456\u0437\u0430\u0442\u043E\u0440",
          now: "\u0417\u0430\u0440\u0430\u0437 \u0433\u0440\u0430\u0454",
          lyrics: "\u0422\u0435\u043A\u0441\u0442",
          loading: "\u0417\u0430\u0432\u0430\u043D\u0442\u0430\u0436\u0435\u043D\u043D\u044F \u0442\u0435\u043A\u0441\u0442\u0443 \u2026",
          noLyrics: "Spotify \u043D\u0435 \u043C\u0430\u0454 \u0442\u0435\u043A\u0441\u0442\u0443 \u0446\u0456\u0454\u0457 \u043F\u0456\u0441\u043D\u0456.",
          nothing: "\u041D\u0456\u0447\u043E\u0433\u043E \u043D\u0435 \u0433\u0440\u0430\u0454",
          calm: "\u0421\u043F\u043E\u043A\u0456\u0439\u043D\u0438\u0439 \u0440\u0435\u0436\u0438\u043C"
        },
        ja: {
          menu: "Mirage \u306E\u8A2D\u5B9A",
          immersive: "Mirage \u30A4\u30DE\u30FC\u30B7\u30D6\u30E2\u30FC\u30C9",
          back: "\u623B\u308B",
          dialog: "Mirage \u30A4\u30DE\u30FC\u30B7\u30D6\u30E2\u30FC\u30C9",
          tabCover: "\u30B8\u30E3\u30B1\u30C3\u30C8",
          tabLyrics: "\u6B4C\u8A5E",
          tabViz: "\u30D3\u30B8\u30E5\u30A2\u30E9\u30A4\u30B6\u30FC",
          now: "\u518D\u751F\u4E2D",
          lyrics: "\u6B4C\u8A5E",
          vizBeat: "\u30D3\u30B8\u30E5\u30A2\u30E9\u30A4\u30B6\u30FC \xB7 \u30D3\u30FC\u30C8\u540C\u671F",
          vizAmbient: "\u30D3\u30B8\u30E5\u30A2\u30E9\u30A4\u30B6\u30FC \xB7 \u30A2\u30F3\u30D3\u30A8\u30F3\u30C8",
          loading: "\u6B4C\u8A5E\u3092\u8AAD\u307F\u8FBC\u307F\u4E2D \u2026",
          noLyrics: "\u3053\u306E\u66F2\u306E\u6B4C\u8A5E\u306F Spotify \u306B\u3042\u308A\u307E\u305B\u3093\u3002",
          nothing: "\u518D\u751F\u3057\u3066\u3044\u307E\u305B\u3093",
          seek: "\u66F2\u5185\u306E\u4F4D\u7F6E",
          prev: "\u524D\u3078",
          play: "\u518D\u751F/\u4E00\u6642\u505C\u6B62",
          next: "\u6B21\u3078",
          dynamic: "\u30B8\u30E3\u30B1\u30C3\u30C8\u306E\u8272",
          particles: "\u5149\u306E\u7C92",
          beat: "\u30D3\u30FC\u30C8\u306B\u5408\u308F\u305B\u305F\u80CC\u666F",
          cascade: "\u30DA\u30FC\u30B8\u30A2\u30CB\u30E1\u30FC\u30B7\u30E7\u30F3",
          vinyl: "\u30EC\u30B3\u30FC\u30C9\u98A8\u30B8\u30E3\u30B1\u30C3\u30C8",
          tilt: "3D \u30AB\u30FC\u30C9",
          burst: "\u30CF\u30FC\u30C8\u30D0\u30FC\u30B9\u30C8",
          grain: "\u30D5\u30A3\u30EB\u30E0\u30B0\u30EC\u30A4\u30F3",
          calm: "\u843D\u3061\u7740\u3044\u305F\u30E2\u30FC\u30C9",
          blur: "\u30AC\u30E9\u30B9\u306E\u307C\u304B\u3057",
          bright: "\u80CC\u666F\u306E\u660E\u308B\u3055"
        },
        ko: {
          menu: "Mirage \uC124\uC815",
          immersive: "Mirage \uBAB0\uC785 \uBAA8\uB4DC",
          back: "\uB4A4\uB85C",
          dialog: "Mirage \uBAB0\uC785 \uBAA8\uB4DC",
          tabCover: "\uCEE4\uBC84",
          tabLyrics: "\uAC00\uC0AC",
          tabViz: "\uBE44\uC8FC\uC5BC\uB77C\uC774\uC800",
          now: "\uC9C0\uAE08 \uC7AC\uC0DD \uC911",
          lyrics: "\uAC00\uC0AC",
          vizBeat: "\uBE44\uC8FC\uC5BC\uB77C\uC774\uC800 \xB7 \uBE44\uD2B8 \uB3D9\uAE30\uD654",
          vizAmbient: "\uBE44\uC8FC\uC5BC\uB77C\uC774\uC800 \xB7 \uC570\uBE44\uC5B8\uD2B8",
          loading: "\uAC00\uC0AC \uBD88\uB7EC\uC624\uB294 \uC911 \u2026",
          noLyrics: "Spotify\uC5D0 \uC774 \uACE1\uC758 \uAC00\uC0AC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.",
          nothing: "\uC7AC\uC0DD \uC911\uC778 \uACE1 \uC5C6\uC74C",
          seek: "\uACE1 \uB0B4 \uC704\uCE58",
          prev: "\uC774\uC804",
          play: "\uC7AC\uC0DD/\uC77C\uC2DC\uC815\uC9C0",
          next: "\uB2E4\uC74C",
          dynamic: "\uCEE4\uBC84 \uC0C9\uC0C1",
          particles: "\uBE5B \uBA3C\uC9C0",
          beat: "\uBE44\uD2B8\uC5D0 \uB9DE\uCD98 \uBC30\uACBD",
          cascade: "\uD398\uC774\uC9C0 \uC560\uB2C8\uBA54\uC774\uC158",
          vinyl: "\uBC14\uC774\uB2D0 \uCEE4\uBC84",
          tilt: "3D \uCE74\uB4DC",
          burst: "\uD558\uD2B8 \uD3ED\uBC1C",
          grain: "\uD544\uB984 \uADF8\uB808\uC778",
          calm: "\uCC28\uBD84\uD55C \uBAA8\uB4DC",
          blur: "\uC720\uB9AC \uD750\uB9BC",
          bright: "\uBC30\uACBD \uBC1D\uAE30"
        },
        zh: {
          menu: "Mirage \u8BBE\u7F6E",
          immersive: "Mirage \u6C89\u6D78\u6A21\u5F0F",
          back: "\u8FD4\u56DE",
          dialog: "Mirage \u6C89\u6D78\u6A21\u5F0F",
          tabCover: "\u5C01\u9762",
          tabLyrics: "\u6B4C\u8BCD",
          tabViz: "\u53EF\u89C6\u5316",
          now: "\u6B63\u5728\u64AD\u653E",
          lyrics: "\u6B4C\u8BCD",
          vizBeat: "\u53EF\u89C6\u5316 \xB7 \u8DDF\u968F\u8282\u62CD",
          vizAmbient: "\u53EF\u89C6\u5316 \xB7 \u6C1B\u56F4",
          loading: "\u6B63\u5728\u52A0\u8F7D\u6B4C\u8BCD \u2026",
          noLyrics: "Spotify \u6CA1\u6709\u8FD9\u9996\u6B4C\u7684\u6B4C\u8BCD\u3002",
          nothing: "\u672A\u5728\u64AD\u653E",
          seek: "\u6B4C\u66F2\u8FDB\u5EA6",
          prev: "\u4E0A\u4E00\u9996",
          play: "\u64AD\u653E/\u6682\u505C",
          next: "\u4E0B\u4E00\u9996",
          dynamic: "\u5C01\u9762\u914D\u8272",
          particles: "\u5149\u5C18",
          beat: "\u968F\u8282\u62CD\u7684\u80CC\u666F",
          cascade: "\u9875\u9762\u52A8\u753B",
          vinyl: "\u9ED1\u80F6\u5C01\u9762",
          tilt: "3D \u5361\u7247",
          burst: "\u7231\u5FC3\u7206\u70B8",
          grain: "\u80F6\u7247\u9897\u7C92",
          calm: "\u5B89\u9759\u6A21\u5F0F",
          blur: "\u73BB\u7483\u6A21\u7CCA",
          bright: "\u80CC\u666F\u4EAE\u5EA6"
        }
      };
      LANG = (() => {
        let l = "";
        try {
          l = S.Locale?.getLocale?.() || "";
        } catch {
        }
        l = String(l || navigator.language || "en").toLowerCase();
        return I18N[l] ? l : I18N[l.split(/[-_]/)[0]] ? l.split(/[-_]/)[0] : "en";
      })();
      t = (k) => I18N[LANG][k] ?? I18N.en[k] ?? k;
    }
  });

  // src/audio.js
  async function loadAudio(uri) {
    if (!uri || audio.uri === uri) return;
    audio.uri = uri;
    audio.data = audioCache.get(uri) || null;
    if (audio.data || !uri.startsWith("spotify:track:") || typeof S.getAudioData !== "function") {
      beat.sync();
      return;
    }
    try {
      const d = await Promise.race([S.getAudioData(uri), new Promise((_, rej) => setTimeout(rej, 8e3))]);
      if (audio.uri === uri && d?.beats?.length) {
        audio.data = {
          beats: d.beats.map((b) => ({ t: b.start, c: b.confidence ?? 1 })),
          segs: (d.segments || []).map((s) => ({ t: s.start, l: s.loudness_max, p: s.pitches || [] }))
        };
        audioCache.set(uri, audio.data);
      }
    } catch {
    }
    beat.sync();
  }
  function bands(sec) {
    const segs = audio.data?.segs;
    if (!segs?.length) return null;
    const s = segs[Math.max(seek(segs, sec, "t"), 0)];
    if (!s || s.p.length !== 12) return null;
    const loud = clamp((s.l + 38) / 38, 0, 1);
    const b = beat.read(sec);
    const out = [];
    for (let i = 0; i < 8; i++) {
      const f = i / 7 * 11, lo = Math.floor(f), hi = Math.min(11, lo + 1);
      const p = s.p[lo] + (s.p[hi] - s.p[lo]) * (f - lo);
      out.push(Number(clamp((0.1 + p * 0.9) * (0.35 + loud * 0.65) + b * 0.2, 0, 1).toFixed(3)));
    }
    return out;
  }
  var audio, audioCache, beat;
  var init_audio = __esm({
    "src/audio.js"() {
      init_core();
      init_config();
      audio = { uri: "", data: null };
      audioCache = lru(50);
      beat = /* @__PURE__ */ (() => {
        let on = false;
        function read(sec) {
          const bs = audio.data?.beats;
          if (!bs) return 0;
          const i = seek(bs, sec, "t");
          if (i < 0) return 0;
          const since = sec - bs[i].t;
          return Math.pow(clamp(1 - since / 0.32, 0, 1), 2) * clamp(0.4 + bs[i].c, 0, 1);
        }
        const now = () => (S.Player.getProgress?.() || 0) / 1e3;
        function sync() {
          on = cfg.beat && !cfg.calm && !!audio.data && root.classList.contains("mirage-playing");
          root.classList.toggle("mirage-beat", on);
        }
        return { sync, read, get level() {
          return on ? read(now()) : 0;
        } };
      })();
    }
  });

  // src/selectors.js
  function checkHealth() {
    health.missing = Object.keys(SEL).filter((k) => !document.querySelector(SEL[k]));
    health.checked = true;
    const broken = CRITICAL.filter((k) => health.missing.includes(k));
    root.classList.toggle("mirage-safe", broken.length > 0);
    const KEY2 = "mirage:seenSpotify";
    let seen = "";
    try {
      seen = localStorage.getItem(KEY2) || "";
    } catch {
    }
    if (broken.length && seen !== spotifyVersion + ":broken") {
      try {
        S.showNotification?.(t("safeMode").replace("{v}", spotifyVersion || "?"), true, 1e4);
        localStorage.setItem(KEY2, spotifyVersion + ":broken");
      } catch {
      }
    } else if (!broken.length) {
      try {
        localStorage.setItem(KEY2, spotifyVersion);
      } catch {
      }
    }
    return health;
  }
  var SEL, CRITICAL, spotifyVersion, spicetifyVersion, health, diagnostics;
  var init_selectors = __esm({
    "src/selectors.js"() {
      init_core();
      init_i18n();
      SEL = {
        mainView: ".Root__main-view, #main-view",
        grid: ".main-gridContainer-gridContainer, [data-testid='grid-container']",
        rows: "[role='grid'] [role='row']",
        card: ".main-card-card, [data-encore-id='card']",
        nowPlayingBar: ".Root__now-playing-bar, [data-testid='now-playing-bar'], footer",
        nowPlayingCover: ".main-nowPlayingWidget-coverArt img, [data-testid='CoverSlotCollapsed__container'] img, .main-coverSlotCollapsed-container img",
        likeButton: '[data-testid="add-button"], [data-testid="like-button"], [data-testid="heart-button"]',
        tintSkip: ".main-card-card, [data-encore-id='card'], [role='row'], [role='grid'], [data-testid='background-image'], .main-entityHeader-background"
      };
      CRITICAL = ["mainView", "nowPlayingBar"];
      spotifyVersion = String(S.Platform?.version || S.Config?.spotify_version || "").split(".").slice(0, 4).join(".");
      spicetifyVersion = String(S.Config?.version || "");
      health = { checked: false, missing: [], spotify: spotifyVersion, spicetify: spicetifyVersion, mirage: VERSION };
      setTimeout(checkHealth, 8e3);
      diagnostics = () => [
        `Mirage ${VERSION}`,
        `Spotify ${spotifyVersion || "?"}`,
        `Spicetify ${spicetifyVersion || "?"}`,
        `missing: ${health.checked ? health.missing.join(", ") || "none" : "not checked yet"}`,
        `safe mode: ${root.classList.contains("mirage-safe")}`,
        `scheme: ${root.dataset.mScheme || "?"} \xB7 page: ${root.dataset.mPage || "?"}`,
        `ua: ${navigator.userAgent.replace(/.*(Chrome\/[\d.]+).*/, "$1")}`
      ].join("\n");
    }
  });

  // src/burst.js
  function burst(x, y) {
    const box = document.createElement("div");
    box.className = "m-burst";
    box.style.left = x + "px";
    box.style.top = y + "px";
    box.append(document.createElement("b"));
    const cols = palette().map((c) => `rgb(${c.join(",")})`);
    for (let i = 0; i < 16; i++) {
      const s = document.createElement("i");
      const ang = i / 16 * Math.PI * 2 + Math.random() * 0.3;
      const dist = 36 + Math.random() * 54;
      if (i % 3 === 0) {
        s.className = "h";
        s.textContent = "\u2665";
      }
      s.style.setProperty("--c", cols[i % cols.length]);
      s.style.setProperty("--tx", Math.cos(ang) * dist + "px");
      s.style.setProperty("--ty", Math.sin(ang) * dist - 10 + "px");
      s.style.setProperty("--r", Math.round((Math.random() - 0.5) * 120) + "deg");
      box.append(s);
    }
    document.body.append(box);
    setTimeout(() => box.remove(), 1100);
  }
  var init_burst = __esm({
    "src/burst.js"() {
      init_selectors();
      init_config();
      init_color();
      document.addEventListener(
        "click",
        (e) => {
          if (!cfg.burst || cfg.calm) return;
          const b = e.target.closest?.(SEL.likeButton);
          if (!b) return;
          const { clientX: x, clientY: y } = e;
          setTimeout(() => b.getAttribute("aria-checked") !== "false" && burst(x, y), 220);
        },
        true
      );
    }
  });

  // src/lyrics.js
  function getLyrics(uri) {
    if (!uri?.startsWith("spotify:track:")) return Promise.resolve(null);
    if (!lyricCache.has(uri)) lyricCache.set(uri, fetchLyrics(uri));
    return lyricCache.get(uri);
  }
  async function fetchLyrics(uri) {
    const id = uri.split(":")[2];
    const url = `https://spclient.wg.spotify.com/color-lyrics/v2/track/${id}?format=json&vocalRemoval=false&market=from_token`;
    let body = null;
    try {
      body = await S.CosmosAsync.get(url, null, { "app-platform": "WebPlayer" });
    } catch {
      try {
        body = await S.CosmosAsync.get(url);
      } catch {
      }
    }
    const L = body?.lyrics;
    return L?.lines?.length ? {
      synced: L.syncType === "LINE_SYNCED",
      lang: L.language || "",
      lines: L.lines.map((l) => ({ t: Number(l.startTimeMs) || 0, text: (l.words || "").trim() || "\u266A" }))
    } : null;
  }
  async function translateLines(uri, lyr, target) {
    if (!lyr?.lines?.length) return null;
    const lang = (lyr.lang || "").slice(0, 2).toLowerCase();
    if (lang && lang === target) return null;
    const key = uri + ":" + target;
    if (trCache.has(key)) return trCache.get(key);
    const text = lyr.lines.map((l) => l.text === "\u266A" ? "" : l.text).join("\n");
    let out = null;
    try {
      const res = await fetch(
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(target)}&dt=t&q=${encodeURIComponent(text)}`
      );
      const data = await res.json();
      if (data?.[2] !== target) {
        const lines = (data?.[0] || []).map((p) => p[0]).join("").split("\n");
        out = lyr.lines.map((l, i) => l.text === "\u266A" ? "" : (lines[i] || "").trim());
      }
    } catch {
    }
    trCache.set(key, out);
    return out;
  }
  async function getCanvas(uri) {
    if (!uri?.startsWith("spotify:track:")) return null;
    if (canvasCache.has(uri)) return canvasCache.get(uri);
    let url = null;
    try {
      const G = S.GraphQL;
      const def = G?.Definitions?.canvas;
      if (def && G.Request) {
        const r = await G.Request(def, { uri });
        url = r?.data?.trackUnion?.canvas?.url || null;
        if (url && !/\.mp4(\?|$)/.test(url)) url = null;
      }
    } catch {
    }
    canvasCache.set(uri, url);
    return url;
  }
  var lyricCache, trCache, canvasCache;
  var init_lyrics = __esm({
    "src/lyrics.js"() {
      init_core();
      lyricCache = lru(60);
      trCache = lru(40);
      canvasCache = lru(60);
    }
  });

  // src/player.js
  function currentItem() {
    return S.Player.data?.item || S.Player.data?.track || null;
  }
  function covers(item) {
    const m = item?.metadata || {};
    const imgs = item?.images || [];
    const domImg = document.querySelector(SEL.nowPlayingCover)?.src;
    const big = toHttp(m.image_xlarge_url || m.image_large_url || imgs[0]?.url);
    const small = toHttp(m.image_url || m.image_small_url || imgs[imgs.length - 1]?.url) || domImg || big;
    return { small, big: big || small };
  }
  function titleOf(item) {
    return item?.metadata?.title || item?.name || "";
  }
  function artistOf(item) {
    const m = item?.metadata || {};
    if (m.artist_name) {
      const more = Object.keys(m).filter((k) => /^artist_name:\d+$/.test(k)).map((k) => m[k]);
      return [m.artist_name, ...more].join(", ");
    }
    return (item?.artists || []).map((a) => a.name).join(", ");
  }
  var toHttp;
  var init_player = __esm({
    "src/player.js"() {
      init_selectors();
      init_core();
      toHttp = (u) => u && u.startsWith("spotify:image:") ? "https://i.scdn.co/image/" + u.slice(14) : u || "";
    }
  });

  // src/share.js
  function canvas() {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    return [c, c.getContext("2d")];
  }
  function backdrop(x, pal, img) {
    x.fillStyle = "#07060c";
    x.fillRect(0, 0, W, H);
    if (img) {
      x.save();
      x.filter = "blur(70px) saturate(1.7) brightness(0.55)";
      x.drawImage(img, -200, -200, W + 400, H + 400);
      x.restore();
    }
    for (const [cx, cy, r, c, a] of [[200, 160, 620, pal[0], 0.45], [960, 420, 520, pal[1], 0.4], [520, 1260, 680, pal[2], 0.25]]) {
      const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, css(c, a));
      g.addColorStop(1, css(c, 0));
      x.fillStyle = g;
      x.fillRect(0, 0, W, H);
    }
  }
  function rounded(x, X, Y, w, h, r) {
    x.beginPath();
    x.roundRect ? x.roundRect(X, Y, w, h, r) : x.rect(X, Y, w, h);
  }
  function fit(x, text, max) {
    if (x.measureText(text).width <= max) return text;
    while (text.length > 1 && x.measureText(text + "\u2026").width > max) text = text.slice(0, -1);
    return text + "\u2026";
  }
  function watermark(x) {
    x.font = `600 30px ${FONT}`;
    x.fillStyle = "rgba(255,255,255,0.55)";
    x.textAlign = "center";
    x.fillText("Mirage \xB7 for Spotify", W / 2, H - 56);
  }
  async function deliver(c, name) {
    const blob = await new Promise((r) => c.toBlob(r, "image/png"));
    if (!blob) return;
    let copied = false;
    try {
      await navigator.clipboard.write([new window.ClipboardItem({ "image/png": blob })]);
      copied = true;
    } catch {
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.append(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 2e3);
    try {
      S.showNotification?.(t(copied ? "shareCopied" : "shareSaved"), false, 4e3);
    } catch {
    }
  }
  async function nowPlayingCard() {
    const item = currentItem();
    if (!item) return;
    const c = covers(item);
    const img = await loadImage(c.big || c.small, true);
    const pal = palette();
    const [cv, x] = canvas();
    backdrop(x, pal, img);
    const size = 760, X = (W - size) / 2, Y = 150;
    x.save();
    x.shadowColor = css(pal[1], 0.55);
    x.shadowBlur = 90;
    x.shadowOffsetY = 30;
    rounded(x, X, Y, size, size, 36);
    x.fillStyle = "#000";
    x.fill();
    x.restore();
    if (img) {
      x.save();
      rounded(x, X, Y, size, size, 36);
      x.clip();
      x.drawImage(img, X, Y, size, size);
      x.restore();
    }
    x.textAlign = "center";
    x.fillStyle = css(pal[2]);
    x.font = `600 28px ${FONT}`;
    x.fillText(t("now").toUpperCase(), W / 2, Y + size + 90);
    x.fillStyle = "#fff";
    x.font = `800 64px ${FONT}`;
    x.fillText(fit(x, titleOf(item), W - 140), W / 2, Y + size + 170);
    x.fillStyle = "rgba(255,255,255,0.72)";
    x.font = `500 38px ${FONT}`;
    x.fillText(fit(x, artistOf(item), W - 160), W / 2, Y + size + 230);
    const bar = x.createLinearGradient(240, 0, W - 240, 0);
    pal.forEach((p, i) => bar.addColorStop(i / 2, css(p)));
    rounded(x, 240, Y + size + 270, W - 480, 10, 5);
    x.fillStyle = bar;
    x.fill();
    watermark(x);
    deliver(cv, "mirage-now-playing.png");
  }
  function loadStats() {
    try {
      return JSON.parse(localStorage.getItem(STATS) || "{}");
    } catch {
      return {};
    }
  }
  function record(item, colors) {
    if (!item?.uri || item.uri === lastRecorded || !item.uri.startsWith("spotify:track:")) return;
    lastRecorded = item.uri;
    const all = loadStats();
    const d = all[today()] ||= { n: 0, ms: 0, artists: {}, hues: Array(12).fill(0), schemes: {} };
    d.n++;
    d.ms += Number(item.duration?.milliseconds || item.metadata?.duration || S.Player.getDuration?.() || 0);
    const artist = (artistOf(item) || "").split(",")[0].trim();
    if (artist) d.artists[artist] = (d.artists[artist] || 0) + 1;
    if (colors?.[0]) d.hues[Math.floor(rgb2hsl(colors[0])[0] / 30) % 12]++;
    d.schemes[cfg.scheme] = (d.schemes[cfg.scheme] || 0) + 1;
    for (const k of Object.keys(all).sort().slice(0, -35)) delete all[k];
    try {
      localStorage.setItem(STATS, JSON.stringify(all));
    } catch {
    }
  }
  function week() {
    const all = loadStats();
    const from = new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10);
    const sum = { n: 0, ms: 0, artists: {}, hues: Array(12).fill(0), schemes: {} };
    for (const [day, d] of Object.entries(all)) {
      if (day < from) continue;
      sum.n += d.n;
      sum.ms += d.ms;
      for (const [a, v] of Object.entries(d.artists)) sum.artists[a] = (sum.artists[a] || 0) + v;
      d.hues.forEach((v, i) => sum.hues[i] += v);
      for (const [s, v] of Object.entries(d.schemes || {})) sum.schemes[s] = (sum.schemes[s] || 0) + v;
    }
    return sum;
  }
  async function weekCard() {
    const w = week();
    const hueRank = w.hues.map((v, i) => [v, i]).filter(([v]) => v > 0).sort((a, b) => b[0] - a[0]);
    const pal = hueRank.length ? hueRank.slice(0, 3).map(([, i]) => hsl2rgb([i * 30 + 15, 0.75, 0.62])) : palette();
    while (pal.length < 3) pal.push(pal[0]);
    const [cv, x] = canvas();
    backdrop(x, pal, null);
    x.textAlign = "left";
    x.fillStyle = css(pal[0]);
    x.font = `600 30px ${FONT}`;
    x.fillText(t("weekKicker").toUpperCase(), 90, 170);
    x.fillStyle = "#fff";
    x.font = `800 92px ${FONT}`;
    x.fillText(t("weekTitle"), 84, 280);
    const big = [[String(w.n), t("weekSongs")], [String(Math.round(w.ms / 6e4)), t("weekMinutes")]];
    big.forEach(([v, label], i) => {
      const X2 = 90 + i * 470;
      x.fillStyle = "#fff";
      x.font = `800 120px ${FONT}`;
      x.fillText(v, X2, 470);
      x.fillStyle = "rgba(255,255,255,0.65)";
      x.font = `500 34px ${FONT}`;
      x.fillText(label, X2, 520);
    });
    const total = hueRank.reduce((s, [v]) => s + v, 0) || 1;
    let X = 90;
    x.fillStyle = "rgba(255,255,255,0.65)";
    x.font = `500 32px ${FONT}`;
    x.fillText(t("weekColours"), 90, 640);
    for (const [v, i] of hueRank) {
      const wdt = (W - 180) * v / total;
      x.fillStyle = css(hsl2rgb([i * 30 + 15, 0.75, 0.62]));
      rounded(x, X, 670, Math.max(wdt - 6, 6), 90, 18);
      x.fill();
      X += wdt;
    }
    if (!hueRank.length) {
      x.fillStyle = "rgba(255,255,255,0.12)";
      rounded(x, 90, 670, W - 180, 90, 18);
      x.fill();
    }
    x.fillStyle = "rgba(255,255,255,0.65)";
    x.font = `500 32px ${FONT}`;
    x.fillText(t("weekArtists"), 90, 860);
    const top = Object.entries(w.artists).sort((a, b) => b[1] - a[1]).slice(0, 3);
    top.forEach(([name, n], i) => {
      x.fillStyle = css(pal[i % 3]);
      x.font = `800 44px ${FONT}`;
      x.fillText(String(i + 1), 90, 940 + i * 90);
      x.fillStyle = "#fff";
      x.font = `700 48px ${FONT}`;
      x.fillText(fit(x, name, W - 360), 150, 940 + i * 90);
      x.fillStyle = "rgba(255,255,255,0.6)";
      x.font = `500 34px ${FONT}`;
      x.textAlign = "right";
      x.fillText(`${n}\xD7`, W - 90, 940 + i * 90);
      x.textAlign = "left";
    });
    if (!top.length) {
      x.fillStyle = "rgba(255,255,255,0.6)";
      x.font = `500 38px ${FONT}`;
      x.fillText(t("weekEmpty"), 90, 940);
    }
    const fav = Object.entries(w.schemes).sort((a, b) => b[1] - a[1])[0]?.[0];
    if (fav) {
      x.fillStyle = "rgba(255,255,255,0.6)";
      x.font = `500 32px ${FONT}`;
      x.fillText(t("weekScheme").replace("{s}", fav), 90, 1220);
    }
    watermark(x);
    deliver(cv, "mirage-week.png");
  }
  var W, H, css, FONT, STATS, today, lastRecorded;
  var init_share = __esm({
    "src/share.js"() {
      init_core();
      init_i18n();
      init_config();
      init_color();
      init_player();
      W = 1080;
      H = 1350;
      css = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
      FONT = '"Outfit", "Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif';
      STATS = "mirage:stats";
      today = () => (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
      lastRecorded = "";
    }
  });

  // src/controls.js
  function shuffleApi() {
    const reg = S._platform?.getRegistry?.() || S.Platform?.Registry;
    for (const name of ["ShuffleAPI", "ContextualShuffleAPI"]) {
      try {
        const v = reg?.resolve?.(Symbol.for(name));
        if (typeof v?.getAvailableShuffleModes === "function" && typeof v.setShuffle === "function") return v;
      } catch {
      }
    }
    const P = S.Platform || {};
    const known = P.ShuffleAPI || P.ContextualShuffleAPI;
    if (typeof known?.getAvailableShuffleModes === "function") return known;
    for (const v of Object.values(P)) {
      if (v && typeof v.getAvailableShuffleModes === "function" && typeof v.setShuffle === "function") return v;
    }
    return null;
  }
  function shuffleState() {
    const st = playerState();
    if (st.shuffle && st.smartShuffle) lastMode = MODE.SMART;
    else if (st.shuffle !== void 0) lastMode = st.shuffle ? MODE.ON : MODE.OFF;
    else lastMode = S.Player.getShuffle?.() ? MODE.ON : MODE.OFF;
    return lastMode;
  }
  async function cycleShuffle() {
    const now = shuffleState();
    const sh = shuffleApi(), ctx = contextUri();
    if (sh && ctx) {
      try {
        const modes = await sh.getAvailableShuffleModes(ctx) || [MODE.OFF, MODE.ON];
        const next = modes[(modes.indexOf(now) + 1) % modes.length] ?? MODE.OFF;
        await sh.setShuffle(ctx, next);
        await new Promise((r) => setTimeout(r, 350));
        if (shuffleState() !== now) return;
      } catch {
      }
    }
    const btn = nativeButton();
    if (btn) return btn.click();
    S.Player.toggleShuffle();
  }
  function upNext(max = 12) {
    const q = S.Queue?.nextTracks || S.Platform?.PlayerAPI?._queue?._queueState?.nextUp || [];
    return q.map((x) => x.contextTrack || x).filter((x) => x?.uri && !x.uri.startsWith("spotify:delimiter") && x.metadata?.title).slice(0, max).map((x) => ({
      uri: x.uri,
      title: x.metadata.title,
      artist: x.metadata.artist_name || "",
      image: (x.metadata.image_url || x.metadata.image_small_url || "").replace("spotify:image:", "https://i.scdn.co/image/")
    }));
  }
  function devices() {
    const list = connect()?.state?.devices || [];
    return list.map((d) => ({ id: d.id, name: d.name, type: d.type, active: !!d.isActive || d.id === connect()?.state?.activeDevice?.id }));
  }
  async function transfer(id) {
    try {
      await connect().transferPlayback(id);
    } catch {
    }
  }
  function setSleep(minutes) {
    clearTimeout(sleepTimer);
    sleepAt = 0;
    sleepEndOfTrack = false;
    if (minutes === "track") {
      sleepEndOfTrack = true;
      return;
    }
    if (!minutes) return;
    sleepAt = Date.now() + minutes * 6e4;
    sleepTimer = setTimeout(() => {
      sleepAt = 0;
      if (S.Player.isPlaying()) S.Player.pause ? S.Player.pause() : S.Player.togglePlay();
    }, minutes * 6e4);
  }
  function go(uri) {
    const [, type, id] = String(uri || "").split(":");
    if (!id || !["album", "artist", "show", "episode"].includes(type)) return false;
    S.Platform?.History?.push?.(`/${type}/${id}`);
    return true;
  }
  var api, playerState, MODE, contextUri, nativeButton, lastMode, connect, canConnect, sleepTimer, sleepAt, sleepEndOfTrack, sleepState, albumOf, artistUriOf;
  var init_controls = __esm({
    "src/controls.js"() {
      init_core();
      api = () => S.Platform?.PlayerAPI;
      playerState = () => api()?._state || S.Player?.origin?._state || {};
      MODE = { OFF: 0, ON: 1, SMART: 2 };
      contextUri = () => S.Player.data?.context?.uri || S.Player.data?.context_uri || playerState().context?.uri || "";
      nativeButton = () => document.querySelector('[data-testid="control-button-shuffle"]');
      lastMode = MODE.OFF;
      connect = () => S.Platform?.ConnectAPI;
      canConnect = () => typeof connect()?.transferPlayback === "function";
      sleepTimer = 0;
      sleepAt = 0;
      sleepEndOfTrack = false;
      S.Player.addEventListener?.("songchange", () => {
        if (!sleepEndOfTrack) return;
        sleepEndOfTrack = false;
        S.Player.pause ? S.Player.pause() : S.Player.togglePlay();
      });
      sleepState = () => sleepEndOfTrack ? "track" : sleepAt ? Math.max(1, Math.round((sleepAt - Date.now()) / 6e4)) : 0;
      albumOf = (item) => item?.album?.uri || item?.metadata?.album_uri || "";
      artistUriOf = (item) => item?.artists?.[0]?.uri || item?.metadata?.artist_uri || "";
    }
  });

  // src/immersive.js
  var ICON, MODES, immersive;
  var init_immersive = __esm({
    "src/immersive.js"() {
      init_core();
      init_i18n();
      init_config();
      init_color();
      init_stage();
      init_audio();
      init_dust();
      init_burst();
      init_lyrics();
      init_i18n();
      init_share();
      init_controls();
      init_player();
      ICON = {
        prev: '<svg viewBox="0 0 24 24"><path d="M6 5h2v14H6zm3.5 7L20 5v14z"/></svg>',
        next: '<svg viewBox="0 0 24 24"><path d="M16 5h2v14h-2zM4 5l10.5 7L4 19z"/></svg>',
        play: '<svg viewBox="0 0 24 24"><path d="M7 4v16l13-8z"/></svg>',
        pause: '<svg viewBox="0 0 24 24"><path d="M6 4h4v16H6zm8 0h4v16h-4z"/></svg>',
        orb: '<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8z"/><path d="M8 4.2a3.8 3.8 0 0 1 3.8 3.8h-1.3A2.5 2.5 0 0 0 8 5.5z"/></svg>',
        back: '<svg viewBox="0 0 24 24"><path d="M15.4 5.4 14 4l-8 8 8 8 1.4-1.4L8.8 12z"/></svg>',
        shuffle: '<svg viewBox="0 0 24 24"><path d="M17 3l4 4-4 4V8h-2.6l-2.2 2.6-1.3-1.5L13.4 6H17zM3 6h4.6l9.8 11H17v-3l4 4-4 4v-3h-.6L6.7 8H3zm0 10h3.7l2.2-2.6 1.3 1.5L7.6 18H3z"/></svg>',
        repeat: '<svg viewBox="0 0 24 24"><path d="M7 7h10v3l4-4-4-4v3H5v6h2zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2z"/></svg>',
        repeatOne: '<svg viewBox="0 0 24 24"><path d="M7 7h10v3l4-4-4-4v3H5v6h2zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2zm-4-2V9h-1l-2 1v1h1.5v4z"/></svg>',
        heart: '<svg viewBox="0 0 24 24"><path d="M12 21 10.6 19.7C5.4 15 2 12 2 8.3 2 5.3 4.3 3 7.3 3c1.7 0 3.3.8 4.7 2 1.4-1.2 3-2 4.7-2C19.7 3 22 5.3 22 8.3c0 3.7-3.4 6.7-8.6 11.4zm0-2.7c4.8-4.3 8-7.2 8-10 0-1.9-1.4-3.3-3.3-3.3-1.5 0-2.9.9-3.4 2.2h-2.6C10.2 5.9 8.8 5 7.3 5 5.4 5 4 6.4 4 8.3c0 2.8 3.2 5.7 8 10z"/></svg>',
        smart: '<svg viewBox="0 0 24 24"><path d="M17 3l4 4-4 4V8h-2.6l-2.2 2.6-1.3-1.5L13.4 6H17zM3 6h4.6l9.8 11H17v-3l4 4-4 4v-3h-.6L6.7 8H3zm0 10h3.7l2.2-2.6 1.3 1.5L7.6 18H3z"/><path d="M20 10.5l.7 1.6 1.6.7-1.6.7-.7 1.6-.7-1.6-1.6-.7 1.6-.7z"/></svg>',
        queue: '<svg viewBox="0 0 24 24"><path d="M3 5h13v2H3zm0 6h13v2H3zm0 6h8v2H3zm15-3V9h2v5.3a3 3 0 1 1-2 2.7z"/></svg>',
        devices: '<svg viewBox="0 0 24 24"><path d="M4 5h12v2H6v10h4v2H4zm10 4h7v12h-7zm2 2v8h3v-8zm1.5 6.2a.8.8 0 1 1 0-1.6.8.8 0 0 1 0 1.6z"/></svg>',
        timer: '<svg viewBox="0 0 24 24"><path d="M9 2h6v2H9zm3 4a8 8 0 1 1 0 16 8 8 0 0 1 0-16zm0 2a6 6 0 1 0 0 12 6 6 0 0 0 0-12zm-1 2h2v4.4l3 1.8-1 1.7-4-2.4z"/></svg>',
        share: '<svg viewBox="0 0 24 24"><path d="M12 3l4.5 4.5-1.4 1.4L13 6.8V15h-2V6.8L8.9 8.9 7.5 7.5zM5 13h2v5h10v-5h2v7H5z"/></svg>',
        heartOn: '<svg viewBox="0 0 24 24"><path d="M12 21 10.6 19.7C5.4 15 2 12 2 8.3 2 5.3 4.3 3 7.3 3c1.7 0 3.3.8 4.7 2 1.4-1.2 3-2 4.7-2C19.7 3 22 5.3 22 8.3c0 3.7-3.4 6.7-8.6 11.4z"/></svg>',
        vol: '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"/></svg>',
        mute: '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9zm13.6 3 2.7-2.7-1.4-1.4-2.7 2.7-2.7-2.7-1.4 1.4 2.7 2.7-2.7 2.7 1.4 1.4 2.7-2.7 2.7 2.7 1.4-1.4z"/></svg>',
        full: '<svg viewBox="0 0 24 24"><path d="M5 5h5V3H3v7h2zm9-2v2h5v5h2V3zm5 16h-5v2h7v-7h-2zM5 14H3v7h7v-2H5z"/></svg>',
        fullOff: '<svg viewBox="0 0 24 24"><path d="M8 3v5H3v2h7V3zm8 0h-2v7h7V8h-5zM3 16h5v5h2v-7H3zm11 5h2v-5h5v-2h-7z"/></svg>'
      };
      MODES = [
        ["cover", "tabCover"],
        ["lyrics", "tabLyrics"],
        ["viz", "tabViz"]
      ];
      immersive = (() => {
        let el2 = null, raf = 0, lastText = 0, coverToken = 0;
        let q = {};
        let lyr = null, lyrUri = "", active = -2;
        let vals = new Float32Array(120), targets = new Float32Array(120), lastVizT = 0;
        const pit = new Float32Array(12);
        const vizRect = { n: 0, r: null };
        let rings = [], lastBeatIdx = -1, vctx = null, vw = 0, vh = 0;
        function build() {
          el2 = document.createElement("div");
          el2.id = "mirage-immersive";
          el2.setAttribute("role", "dialog");
          el2.setAttribute("aria-label", t("dialog"));
          el2.innerHTML = `
      <div class="m-im-bg" aria-hidden="true"><i></i><video class="m-im-canvas" muted loop playsinline preload="none"></video></div>
      <canvas class="m-im-viz"></canvas>
      <div class="m-im-top">
        <button class="m-im-close" type="button">${ICON.back}<span class="m-l"></span><kbd>ESC</kbd></button>
        <div class="m-im-tabs" role="tablist"><span class="m-im-ind"></span>
          ${MODES.map(([k], i) => `<button type="button" role="tab" data-mode="${k}" title="${i + 1}"></button>`).join("")}
        </div>
        <div class="m-im-actions">
          <button type="button" class="m-im-sm m-im-share">${ICON.share}</button>
          <button type="button" class="m-im-sm m-im-help">?</button>
        </div>
      </div>
      <div class="m-im-cover-wrap"><div class="m-im-cover"><img alt=""><img alt=""></div></div>
      <div class="m-im-meta">
        <div class="m-im-kicker"></div>
        <div class="m-im-title"></div>
        <div class="m-im-artist"></div>
        <div class="m-im-bar" role="slider" tabindex="0"><div class="m-im-fill"></div></div>
        <div class="m-im-time"><span class="m-im-pos">0:00</span><span class="m-im-dur">0:00</span></div>
        <div class="m-im-controls">
          <button type="button" class="m-im-sm m-im-shuffle">${ICON.shuffle}</button>
          <button type="button" class="m-im-prev">${ICON.prev}</button>
          <button type="button" class="m-im-play">${ICON.play}</button>
          <button type="button" class="m-im-next">${ICON.next}</button>
          <button type="button" class="m-im-sm m-im-repeat">${ICON.repeat}</button>
        </div>
        <div class="m-im-extras">
          <button type="button" class="m-im-sm m-im-like">${ICON.heart}</button>
          <div class="m-im-vol">
            <button type="button" class="m-im-sm m-im-mute">${ICON.vol}</button>
            <input type="range" class="m-im-volume" min="0" max="100" step="1">
          </div>
          <button type="button" class="m-im-sm m-im-queue-btn">${ICON.queue}</button>
          <button type="button" class="m-im-sm m-im-dev">${ICON.devices}</button>
          <button type="button" class="m-im-sm m-im-timer">${ICON.timer}</button>
          <button type="button" class="m-im-sm m-im-full">${ICON.full}</button>
        </div>
      </div>
      <div class="m-im-lyrics"><div class="m-im-lyrics-inner"></div></div>
      <div class="m-im-side" hidden><div class="m-im-side-head"><b></b><button type="button" class="m-im-sm m-im-side-x">\xD7</button></div><div class="m-im-side-body"></div></div>
      <div class="m-im-keys" role="dialog" hidden></div>`;
          document.body.append(el2);
          el2.querySelector(".m-im-close .m-l").textContent = t("back");
          el2.querySelectorAll(".m-im-tabs button").forEach((b, i) => b.textContent = t(MODES[i][1]));
          el2.querySelector(".m-im-bar").setAttribute("aria-label", t("seek"));
          el2.querySelector(".m-im-prev").setAttribute("aria-label", t("prev"));
          el2.querySelector(".m-im-play").setAttribute("aria-label", t("play"));
          el2.querySelector(".m-im-next").setAttribute("aria-label", t("next"));
          for (const k of ["shuffle", "repeat", "like", "mute", "full"]) {
            el2.querySelector(".m-im-" + k).setAttribute("aria-label", t("c_" + k));
            el2.querySelector(".m-im-" + k).title = t("c_" + k);
          }
          el2.querySelector(".m-im-volume").setAttribute("aria-label", t("c_volume"));
          q = {
            cover: el2.querySelector(".m-im-cover"),
            imgs: el2.querySelectorAll(".m-im-cover img"),
            wrap: el2.querySelector(".m-im-cover-wrap"),
            kicker: el2.querySelector(".m-im-kicker"),
            title: el2.querySelector(".m-im-title"),
            artist: el2.querySelector(".m-im-artist"),
            fill: el2.querySelector(".m-im-fill"),
            pos: el2.querySelector(".m-im-pos"),
            dur: el2.querySelector(".m-im-dur"),
            play: el2.querySelector(".m-im-play"),
            lyrics: el2.querySelector(".m-im-lyrics"),
            inner: el2.querySelector(".m-im-lyrics-inner"),
            ind: el2.querySelector(".m-im-ind"),
            canvas: el2.querySelector(".m-im-viz"),
            bg: el2.querySelector(".m-im-bg"),
            shuffle: el2.querySelector(".m-im-shuffle"),
            repeat: el2.querySelector(".m-im-repeat"),
            like: el2.querySelector(".m-im-like"),
            mute: el2.querySelector(".m-im-mute"),
            volume: el2.querySelector(".m-im-volume"),
            full: el2.querySelector(".m-im-full")
          };
          vctx = q.canvas.getContext("2d");
          q.video = el2.querySelector(".m-im-canvas");
          q.keys = el2.querySelector(".m-im-keys");
          const share = el2.querySelector(".m-im-share"), help = el2.querySelector(".m-im-help");
          share.title = share.ariaLabel = t("share");
          help.title = help.ariaLabel = t("keysTitle");
          share.onclick = () => nowPlayingCard();
          help.onclick = () => toggleKeys();
          q.keys.onclick = () => toggleKeys(false);
          el2.querySelector(".m-im-close").onclick = close;
          q.shuffle.onclick = async () => {
            await cycleShuffle();
            setTimeout(syncState, 150);
          };
          q.title.onclick = () => go(albumOf(currentItem())) && close();
          q.artist.onclick = () => go(artistUriOf(currentItem())) && close();
          q.side = el2.querySelector(".m-im-side");
          q.sideBody = el2.querySelector(".m-im-side-body");
          el2.querySelector(".m-im-side-x").onclick = () => showSide(null);
          const qb = el2.querySelector(".m-im-queue-btn"), db = el2.querySelector(".m-im-dev"), tb = el2.querySelector(".m-im-timer");
          q.timerBtn = tb;
          for (const [b, k] of [[qb, "c_queue"], [db, "c_devices"], [tb, "c_timer"]]) b.title = b.ariaLabel = t(k);
          qb.onclick = () => showSide(side === "queue" ? null : "queue");
          db.onclick = () => showSide(side === "devices" ? null : "devices");
          tb.onclick = () => showSide(side === "timer" ? null : "timer");
          if (!canConnect()) db.hidden = true;
          q.repeat.onclick = () => {
            S.Player.toggleRepeat();
            setTimeout(syncState, 120);
          };
          q.like.onclick = (e) => {
            const was = !!S.Player.getHeart?.();
            S.Player.toggleHeart();
            if (!was && cfg.burst && !cfg.calm) {
              const r = q.like.getBoundingClientRect();
              burst(e.clientX || r.left + r.width / 2, e.clientY || r.top + r.height / 2);
            }
            setTimeout(syncState, 200);
          };
          q.mute.onclick = () => {
            S.Player.toggleMute();
            setTimeout(syncState, 120);
          };
          q.volume.oninput = () => S.Player.setVolume(Number(q.volume.value) / 100);
          q.full.onclick = toggleFull;
          el2.querySelector(".m-im-prev").onclick = () => S.Player.back();
          el2.querySelector(".m-im-next").onclick = () => S.Player.next();
          q.play.onclick = () => S.Player.togglePlay();
          el2.querySelectorAll(".m-im-tabs button").forEach((b) => b.onclick = () => setMode(b.dataset.mode, true));
          el2.querySelector(".m-im-bar").onclick = (e) => {
            const r = e.currentTarget.getBoundingClientRect();
            S.Player.seek(clamp((e.clientX - r.left) / r.width, 0, 1));
          };
          q.inner.addEventListener("click", (e) => {
            const line = e.target.closest(".m-im-line");
            if (line && lyr?.synced) S.Player.seek(Math.max(Number(line.dataset.t), 2));
          });
          el2.addEventListener("pointermove", (e) => {
            if (cfg.calm) return;
            const x = e.clientX / innerWidth - 0.5, y = e.clientY / innerHeight - 0.5;
            q.cover.style.setProperty("--iry", (x * 18).toFixed(2) + "deg");
            q.cover.style.setProperty("--irx", (-y * 14).toFixed(2) + "deg");
            q.cover.style.setProperty("--gx", (50 + x * 80).toFixed(1) + "%");
            q.cover.style.setProperty("--gy", (50 + y * 80).toFixed(1) + "%");
          });
          addEventListener("resize", sizeCanvas);
        }
        async function setCover(item) {
          const token = ++coverToken;
          const c = covers(item);
          const show = (img) => {
            if (!img || token !== coverToken) return;
            const [a, b] = q.imgs;
            const front = a.classList.contains("is-on") ? a : b;
            const back = front === a ? b : a;
            if (front.src === img.src) return;
            back.src = img.src;
            back.classList.add("is-on");
            front.classList.remove("is-on");
          };
          if (c.small) show(await loadImage(c.small));
          if (c.big && c.big !== c.small) show(await loadImage(c.big));
        }
        function syncState() {
          if (!el2) return;
          const P = S.Player;
          const sh = shuffleState();
          q.shuffle.classList.toggle("is-on", sh > 0);
          q.shuffle.classList.toggle("is-smart", sh === 2);
          const shIcon = sh === 2 ? ICON.smart : ICON.shuffle;
          if (q.shuffle.dataset.icon !== String(sh)) {
            q.shuffle.innerHTML = shIcon;
            q.shuffle.dataset.icon = String(sh);
            q.shuffle.title = q.shuffle.ariaLabel = t(sh === 2 ? "c_smart" : "c_shuffle");
          }
          q.timerBtn?.classList.toggle("is-on", !!sleepState());
          for (const b of [q.shuffle, q.repeat, q.like, q.timerBtn]) b?.setAttribute("aria-pressed", String(b.classList.contains("is-on")));
          const rep = P.getRepeat?.() || 0;
          q.repeat.classList.toggle("is-on", rep > 0);
          q.repeat.innerHTML = rep === 2 ? ICON.repeatOne : ICON.repeat;
          const liked = !!P.getHeart?.();
          q.like.classList.toggle("is-on", liked);
          q.like.innerHTML = liked ? ICON.heartOn : ICON.heart;
          const muted = !!P.getMute?.();
          q.mute.innerHTML = muted ? ICON.mute : ICON.vol;
          if (document.activeElement !== q.volume) q.volume.value = Math.round((muted ? 0 : P.getVolume?.() ?? 1) * 100);
          q.volume.style.setProperty("--v", q.volume.value + "%");
          q.full.innerHTML = document.fullscreenElement ? ICON.fullOff : ICON.full;
        }
        function toggleFull() {
          if (document.fullscreenElement) document.exitFullscreen?.();
          else document.documentElement.requestFullscreen?.().catch(() => {
          });
          setTimeout(syncState, 300);
        }
        function setHaze(src) {
          if (el2 && src) q.bg.style.setProperty("--img", `url("${src}")`);
        }
        function sizeCanvas() {
          if (!q.canvas) return;
          const dpr = Math.min(devicePixelRatio || 1, 1.5);
          vw = q.canvas.width = Math.round(innerWidth * dpr);
          vh = q.canvas.height = Math.round(innerHeight * dpr);
        }
        function placeIndicator() {
          const b = el2.querySelector(`.m-im-tabs button[data-mode="${cfg.imMode}"]`);
          if (!b) return;
          q.ind.style.width = b.offsetWidth + "px";
          q.ind.style.transform = `translateX(${b.offsetLeft}px)`;
        }
        function setMode(mode, animate) {
          if (!MODES.some(([k]) => k === mode)) mode = "cover";
          const apply = () => {
            cfg.imMode = mode;
            save();
            el2.dataset.mode = mode;
            el2.querySelectorAll(".m-im-tabs button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.mode === mode)));
            placeIndicator();
            updateKicker();
            if (mode === "lyrics") loadLyrics();
            active = -2;
          };
          if (animate && document.startViewTransition && !cfg.calm && isOpen()) {
            try {
              document.startViewTransition(apply);
            } catch {
            }
            setTimeout(() => el2.dataset.mode !== mode && apply(), 400);
          } else apply();
        }
        function updateKicker() {
          if (!el2) return;
          const m = el2.dataset.mode;
          q.kicker.textContent = m === "viz" ? t(audio.data ? "vizBeat" : "vizAmbient") : m === "lyrics" ? t("lyrics") : t("now");
        }
        async function loadLyrics() {
          const uri = currentItem()?.uri || "";
          if (uri === lyrUri && lyr !== void 0) return;
          lyrUri = uri;
          lyr = void 0;
          q.inner.style.transform = "";
          q.lyrics.classList.remove("is-unsynced");
          q.inner.innerHTML = '<div class="m-im-lyrics-note"></div>';
          q.inner.firstChild.textContent = t("loading");
          const got = await getLyrics(uri);
          if (lyrUri !== uri) return;
          lyr = got;
          active = -2;
          q.inner.textContent = "";
          if (!got) {
            q.inner.innerHTML = '<div class="m-im-lyrics-note"></div>';
            q.inner.firstChild.textContent = t("noLyrics");
            return;
          }
          q.lyrics.classList.toggle("is-unsynced", !got.synced);
          const frag = document.createDocumentFragment();
          if (!got.synced) {
            const note = document.createElement("div");
            note.className = "m-im-lyrics-note is-small";
            note.textContent = t("unsynced");
            frag.append(note);
          }
          for (const l of got.lines) {
            const d = document.createElement("div");
            d.className = "m-im-line";
            d.dataset.t = l.t;
            d.textContent = l.text;
            frag.append(d);
          }
          q.inner.append(frag);
          if (cfg.translate) {
            const tr = await translateLines(uri, got, LANG);
            if (lyrUri !== uri || !tr) return;
            const lines = q.inner.querySelectorAll(".m-im-line");
            tr.forEach((text, i) => {
              if (!text || !lines[i] || text.toLowerCase() === got.lines[i].text.toLowerCase()) return;
              const d = document.createElement("span");
              d.className = "m-im-tr";
              d.textContent = text;
              lines[i].append(d);
            });
            active = -2;
          }
        }
        function drawLyrics(pos) {
          if (!lyr?.synced) return;
          const lines = q.inner.children;
          const i = seek(lyr.lines, pos, "t");
          if (i !== active) {
            active = i;
            for (let k = 0; k < lines.length; k++) {
              const ln = lines[k];
              ln.classList.toggle("is-active", k === i);
              ln.classList.toggle("is-past", k < i);
              ln.style.setProperty("--d", Math.min(Math.abs(k - Math.max(i, 0)), 6));
            }
            const cur = lines[Math.max(i, 0)];
            if (cur) {
              const y = q.lyrics.clientHeight * 0.42 - (cur.offsetTop + cur.offsetHeight / 2);
              q.inner.style.transform = `translateY(${y}px)`;
            }
          }
        }
        function drawViz(pos, now) {
          if (!vw) sizeCanvas();
          const N = cfg.vizBars;
          if (vals.length !== N) {
            vals = new Float32Array(N);
            targets = new Float32Array(N);
          }
          const dt = Math.min(0.05, lastVizT ? (now - lastVizT) / 1e3 : 0.016);
          lastVizT = now;
          const ctx = vctx;
          ctx.clearRect(0, 0, vw, vh);
          const dpr = vw / innerWidth;
          if (!vizRect.r || vizRect.n++ % 30 === 0) vizRect.r = q.wrap.getBoundingClientRect();
          const r = vizRect.r;
          const cx = (r.left + r.width / 2) * dpr, cy = (r.top + r.height / 2) * dpr;
          const R = r.width / 2 * dpr + 16 * dpr;
          const sec = pos / 1e3;
          const playing = S.Player.isPlaying();
          let b = 0, havePitch = false, loud = 0.5;
          if (audio.data) {
            const segs = audio.data.segs;
            const si = Math.max(seek(segs, sec, "t"), 0);
            const s0 = segs[si], s1 = segs[si + 1] || s0;
            if (s0 && s0.p.length === 12) {
              const f = clamp((sec - s0.t) / Math.max(0.01, s1.t - s0.t), 0, 1);
              const e = f * f * (3 - 2 * f);
              for (let k2 = 0; k2 < 12; k2++) pit[k2] = s0.p[k2] + ((s1.p[k2] ?? s0.p[k2]) - s0.p[k2]) * e;
              loud = clamp((s0.l + (s1.l - s0.l) * e + 38) / 38, 0, 1);
              havePitch = true;
            }
            b = beat.read(sec);
            const bi = seek(audio.data.beats, sec, "t");
            if (bi !== lastBeatIdx && bi >= 0 && playing) {
              lastBeatIdx = bi;
              if (cfg.vizRings) rings.push({ r: R, a: 0.6 * clamp(audio.data.beats[bi].c + 0.3, 0, 1) });
            }
          }
          const mirror = cfg.vizMirror;
          const span = mirror ? N / 2 : N;
          const tt = now / 1e3;
          for (let i = 0; i < N; i++) {
            const m = mirror ? i < span ? i : N - 1 - i : i;
            let t2;
            if (havePitch) {
              const f = m / span * 11;
              const lo = Math.floor(f), hi = Math.min(11, lo + 1);
              const p = pit[lo] + (pit[hi] - pit[lo]) * (f - lo);
              t2 = (0.12 + p * 0.88) * (0.35 + loud * 0.65) + b * 0.22;
            } else {
              t2 = 0.28 + 0.22 * Math.sin(m * 0.33 + tt * 2.1) * Math.sin(m * 0.09 - tt * 1.3) + 0.12 * Math.sin(tt * 3 + m * 0.7);
            }
            targets[i] = playing ? t2 : t2 * 0.25;
          }
          const k = cfg.vizSmooth;
          const rise = 1 - Math.exp(-dt * (32 - 2.6 * k));
          const fall = 1 - Math.exp(-dt * (16 - 1.3 * k));
          for (let i = 0; i < N; i++) {
            const t2 = (targets[(i - 1 + N) % N] + 2 * targets[i] + targets[(i + 1) % N]) / 4;
            vals[i] += (t2 - vals[i]) * (t2 > vals[i] ? rise : fall);
          }
          if (cfg.calm) return;
          const pal = palette();
          const rgba2 = (c, al) => `rgba(${c[0]},${c[1]},${c[2]},${al})`;
          const maxLen = Math.min(vw, vh) * 0.11 * (cfg.vizHeight / 100);
          const rot = cfg.vizSpin ? tt * 0.06 : 0;
          ctx.globalCompositeOperation = "lighter";
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          const glow = ctx.createRadialGradient(cx, cy, R * 0.8, cx, cy, R + maxLen * 1.2);
          glow.addColorStop(0, rgba2(pal[0], 0.16 + b * 0.22));
          glow.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = glow;
          ctx.fillRect(cx - R * 3, cy - R * 3, R * 6, R * 6);
          const ang = (i) => i / N * Math.PI * 2 - Math.PI / 2 + rot;
          const tip = (i) => R + 4 * dpr + vals[i] * maxLen;
          if (cfg.vizStyle === "bottom") {
            const bw = vw / N, base = vh - 8 * dpr;
            for (let gi = 0; gi < 3; gi++) {
              ctx.fillStyle = rgba2(pal[gi], 0.85);
              ctx.beginPath();
              for (let i = gi; i < N; i += 3) {
                const h = 6 * dpr + vals[i] * vh * 0.32 * (cfg.vizHeight / 100);
                ctx.rect(i * bw + bw * 0.15, base - h, bw * 0.7, h);
              }
              ctx.fill();
            }
          } else if (cfg.vizStyle === "line") {
            const mid = cy;
            for (const [w, col, al] of [[10, pal[1], cfg.vizGlow ? 0.14 : 0], [2.5, pal[2], 0.95]]) {
              if (!al) continue;
              ctx.lineWidth = w * dpr;
              ctx.strokeStyle = rgba2(col, al);
              for (const dir of [-1, 1]) {
                ctx.beginPath();
                for (let i = 0; i < N; i++) {
                  const x = i / (N - 1) * vw, y = mid + dir * vals[i] * maxLen * 1.6;
                  i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
                }
                ctx.stroke();
              }
            }
          } else if (cfg.vizStyle === "particles") {
            for (let i = 0; i < N; i++) {
              const a = ang(i) + tt * 0.15 * (i % 2 ? 1 : -1), e = tip(i) + Math.sin(tt * 2 + i) * 6 * dpr;
              const r2 = (1.5 + vals[i] * 4) * dpr;
              ctx.fillStyle = rgba2(pal[i % 3], 0.35 + vals[i] * 0.6);
              ctx.beginPath();
              ctx.arc(cx + Math.cos(a) * e, cy + Math.sin(a) * e, r2, 0, Math.PI * 2);
              ctx.fill();
            }
          } else if (cfg.vizStyle === "wave") {
            ctx.beginPath();
            for (let i = 0; i <= N; i++) {
              const j = i % N, nx = (i + 1) % N;
              const x0 = cx + Math.cos(ang(j)) * tip(j), y0 = cy + Math.sin(ang(j)) * tip(j);
              const x1 = cx + Math.cos(ang(nx)) * tip(nx), y1 = cy + Math.sin(ang(nx)) * tip(nx);
              const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
              if (i === 0) ctx.moveTo(mx, my);
              else ctx.quadraticCurveTo(x0, y0, mx, my);
            }
            ctx.closePath();
            ctx.fillStyle = rgba2(pal[0], 0.16);
            ctx.fill();
            if (cfg.vizGlow) {
              ctx.lineWidth = 10 * dpr;
              ctx.strokeStyle = rgba2(pal[1], 0.14);
              ctx.stroke();
            }
            ctx.lineWidth = 2.5 * dpr;
            ctx.strokeStyle = rgba2(pal[2], 0.95);
            ctx.stroke();
          } else {
            const groups = [[], [], []];
            for (let i = 0; i < N; i++) groups[i % 3 === 0 ? 2 : i % 2 ? 0 : 1].push(i);
            const passes = cfg.vizStyle === "bars" && cfg.vizGlow ? [[9, 0.15], [3, 0.95]] : [[3, 0.95]];
            for (const [w, al] of passes) {
              ctx.lineWidth = w * dpr;
              groups.forEach((idx, gi) => {
                ctx.beginPath();
                for (const i of idx) {
                  const c = Math.cos(ang(i)), sn = Math.sin(ang(i)), e = tip(i);
                  if (cfg.vizStyle === "dots") {
                    ctx.moveTo(cx + c * e + 3 * dpr, cy + sn * e);
                    ctx.arc(cx + c * e, cy + sn * e, 3 * dpr, 0, Math.PI * 2);
                  } else {
                    ctx.moveTo(cx + c * R, cy + sn * R);
                    ctx.lineTo(cx + c * e, cy + sn * e);
                  }
                }
                if (cfg.vizStyle === "dots") {
                  ctx.fillStyle = rgba2(pal[gi], al);
                  ctx.fill();
                } else {
                  ctx.strokeStyle = rgba2(pal[gi], al);
                  ctx.stroke();
                }
              });
            }
          }
          ctx.lineWidth = 2 * dpr;
          rings = rings.filter((g) => g.a > 0.02);
          for (const g of rings) {
            g.r += 300 * dt * dpr;
            g.a *= Math.exp(-dt * 2.8);
            ctx.strokeStyle = rgba2(pal[2], g.a);
            ctx.beginPath();
            ctx.arc(cx, cy, g.r, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.globalCompositeOperation = "source-over";
          q.wrap.style.setProperty("--pulse", (1 + b * 0.035).toFixed(4));
        }
        function frame(now) {
          raf = requestAnimationFrame(frame);
          const pos = S.Player.getProgress?.() || 0;
          const dur = S.Player.getDuration?.() || 0;
          q.fill.style.width = (dur ? pos / dur * 100 : 0) + "%";
          if (now - lastText > 250) {
            lastText = now;
            q.pos.textContent = fmt(pos);
            q.dur.textContent = fmt(dur);
            syncState();
          }
          const mode = el2.dataset.mode;
          if (mode === "lyrics") drawLyrics(pos);
          if (mode === "viz") drawViz(pos, now);
          else if (q.wrap.style.getPropertyValue("--pulse")) q.wrap.style.removeProperty("--pulse");
        }
        let canvasToken = 0;
        async function setCanvas(item) {
          const token = ++canvasToken;
          const url = cfg.canvas && !cfg.calm ? await getCanvas(item?.uri) : null;
          if (token !== canvasToken || !q.video) return;
          if (!url) {
            q.video.classList.remove("is-on");
            q.video.pause();
            q.video.removeAttribute("src");
            return;
          }
          if (q.video.src !== url) q.video.src = url;
          q.video.play().then(() => q.video.classList.add("is-on")).catch(() => q.video.classList.remove("is-on"));
        }
        const KEYS = [["Space", "k_play"], ["\u2190 \u2192", "k_seek"], ["\u2191 \u2193", "k_vol"], ["1 2 3", "k_view"], ["L", "k_like"], ["S", "k_shuffle"], ["R", "k_repeat"], ["F", "k_full"], ["N / P", "k_next"], ["Q", "k_queue"], ["Esc", "k_close"], ["?", "keysTitle"]];
        function toggleKeys(force) {
          if (!q.keys) return;
          const show = force ?? q.keys.hidden;
          if (show && !q.keys.childElementCount) {
            const box = document.createElement("div");
            box.className = "m-im-keys-box";
            const h = document.createElement("b");
            h.textContent = t("keysTitle");
            box.append(h);
            for (const [k, label] of KEYS) {
              const row = document.createElement("div");
              row.innerHTML = "<kbd></kbd><span></span>";
              row.firstChild.textContent = k;
              row.lastChild.textContent = t(label);
              box.append(row);
            }
            q.keys.append(box);
          }
          q.keys.hidden = !show;
        }
        function styleLyrics() {
          el2.style.setProperty("--m-lyr-size", String(cfg.lyrSize / 100));
          el2.style.setProperty("--m-lyr-gap", String(cfg.lyrGap / 100));
        }
        let side = null;
        function showSide(kind) {
          side = kind;
          q.side.hidden = !kind;
          q.side.dataset.kind = kind || "";
          if (!kind) return;
          q.side.querySelector("b").textContent = t({ queue: "c_queue", devices: "c_devices", timer: "c_timer" }[kind]);
          const body = q.sideBody;
          body.textContent = "";
          const item = (label, sub, img, onClick, on) => {
            const b = document.createElement("button");
            b.type = "button";
            b.className = "m-im-side-item" + (on ? " is-on" : "");
            if (img) {
              const i = document.createElement("img");
              i.src = img;
              i.alt = "";
              i.loading = "lazy";
              b.append(i);
            }
            const txt = document.createElement("span");
            const l = document.createElement("b");
            l.textContent = label;
            txt.append(l);
            if (sub) {
              const s2 = document.createElement("small");
              s2.textContent = sub;
              txt.append(s2);
            }
            b.append(txt);
            if (onClick) b.onclick = onClick;
            else b.disabled = true;
            body.append(b);
          };
          if (kind === "queue") {
            const list = upNext();
            if (!list.length) return item(t("queueEmpty"));
            for (const x of list) item(x.title, x.artist, x.image, null);
          } else if (kind === "devices") {
            const list = devices();
            if (!list.length) return item(t("devicesNone"));
            for (const d of list) item(d.name, d.active ? t("deviceActive") : d.type, null, d.active ? null : async () => {
              await transfer(d.id);
              setTimeout(() => showSide("devices"), 800);
            }, d.active);
          } else if (kind === "timer") {
            const now = sleepState();
            for (const [v, label] of [[15, "15 min"], [30, "30 min"], [45, "45 min"], [60, "60 min"], ["track", t("timerTrack")], [0, t("timerOff")]]) {
              item(label, now && (now === v || v !== "track" && v && now !== "track" && now <= v && now > v - 15) ? t("timerLeft").replace("{m}", now === "track" ? "\u266A" : now) : "", null, () => {
                setSleep(v);
                showSide("timer");
                syncState();
              }, now === v);
            }
          }
        }
        function refresh() {
          if (!el2) return;
          if (side === "queue") setTimeout(() => side === "queue" && showSide("queue"), 600);
          const item = currentItem();
          setCover(item);
          setCanvas(item);
          q.title.textContent = titleOf(item) || t("nothing");
          q.artist.textContent = artistOf(item);
          q.play.innerHTML = S.Player.isPlaying() ? ICON.pause : ICON.play;
          lastBeatIdx = -1;
          rings = [];
          updateKicker();
          if (el2.dataset.mode === "lyrics") loadLyrics();
        }
        function open() {
          if (!el2) build();
          sizeCanvas();
          setMode(cfg.imMode, false);
          styleLyrics();
          refresh();
          setHaze(lastHaze);
          syncState();
          el2.classList.add("is-on");
          root.classList.add("mirage-im-open");
          dust.pause(true);
          requestAnimationFrame(placeIndicator);
          cancelAnimationFrame(raf);
          raf = requestAnimationFrame(frame);
          q.play.focus();
        }
        function close() {
          if (!el2) return;
          el2.classList.remove("is-on");
          root.classList.remove("mirage-im-open");
          q.video?.pause();
          toggleKeys(false);
          showSide(null);
          dust.pause(false);
          cancelAnimationFrame(raf);
          if (document.fullscreenElement) document.exitFullscreen?.();
        }
        const isOpen = () => !!el2?.classList.contains("is-on");
        const playState = () => el2 && (q.play.innerHTML = S.Player.isPlaying() ? ICON.pause : ICON.play);
        const seekBy = (ms) => S.Player.seek(clamp((S.Player.getProgress?.() || 0) + ms, 2, S.Player.getDuration?.() || 2));
        const volBy = (d) => {
          S.Player.setVolume(clamp((S.Player.getVolume?.() ?? 1) + d, 0, 1));
          setTimeout(syncState, 80);
        };
        return {
          open,
          close,
          toggle: () => isOpen() ? close() : open(),
          isOpen,
          refresh,
          setMode,
          playState,
          updateKicker,
          setHaze,
          seekBy,
          volBy,
          toggleFull,
          toggleKeys,
          toggleQueue: () => el2 && showSide(side === "queue" ? null : "queue"),
          styleLyrics: () => el2 && styleLyrics(),
          reloadLyrics: () => {
            lyrUri = "";
            el2 && el2.dataset.mode === "lyrics" && loadLyrics();
          },
          like: () => q.like?.click(),
          shuffle: () => q.shuffle?.click(),
          repeat: () => q.repeat?.click()
        };
      })();
    }
  });

  // src/stage.js
  function showHaze(src) {
    if (!src || src === lastHaze) return;
    lastHaze = src;
    for (const fn of listeners) fn(src);
    immersive.setHaze(src);
  }
  var stage, lastHaze, listeners, onHaze;
  var init_stage = __esm({
    "src/stage.js"() {
      init_immersive();
      stage = document.createElement("div");
      stage.id = "mirage-stage";
      stage.innerHTML = '<canvas class="m-ambient"></canvas><div class="m-grain"></div>';
      document.body.prepend(stage);
      lastHaze = "";
      listeners = [];
      onHaze = (fn) => listeners.push(fn);
    }
  });

  // src/dust.js
  var SCALE, FADE, fps, TAU, tri, ease, rgba, dust;
  var init_dust = __esm({
    "src/dust.js"() {
      init_core();
      init_config();
      init_color();
      init_stage();
      init_audio();
      SCALE = 0.25;
      FADE = 2200;
      fps = () => ({ full: 30, light: 12 })[cfg.preset] || 20;
      TAU = Math.PI * 2;
      tri = (x) => 1 - Math.abs(2 * (x - Math.floor(x)) - 1);
      ease = (x) => x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
      rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
      dust = (() => {
        const cv = stage.querySelector("canvas");
        const ctx = cv.getContext("2d", { alpha: false });
        const vig = document.createElement("canvas");
        let W2 = 0, H2 = 0, timer = 0, running = false, paused = false, lastT = 0, clock = 0, aliveUntil = 0;
        let pal = schemePalette(), base = [7, 6, 12], sprites = [];
        let cur = null, prev = null, fadeT0 = 0;
        const parts = [];
        function sprite(rgb) {
          const s = document.createElement("canvas");
          s.width = s.height = 32;
          const x = s.getContext("2d");
          const g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
          g.addColorStop(0, rgba(rgb, 0.9));
          g.addColorStop(0.25, rgba(rgb, 0.35));
          g.addColorStop(1, rgba(rgb, 0));
          x.fillStyle = g;
          x.fillRect(0, 0, 32, 32);
          return s;
        }
        function baseColor() {
          const v = getComputedStyle(root).getPropertyValue("--spice-rgb-main").split(",").map(Number);
          return v.length === 3 && v.every((n) => n >= 0) ? v : [7, 6, 12];
        }
        function recolor(cols) {
          pal = cols || schemePalette();
          base = baseColor();
          sprites = [...pal, [255, 255, 255]].map(sprite);
          if (running && !timer) draw(performance.now());
        }
        function buildVignette() {
          vig.width = W2;
          vig.height = H2;
          const x = vig.getContext("2d");
          x.clearRect(0, 0, W2, H2);
          x.save();
          x.translate(W2 / 2, H2 * 0.4);
          x.scale(W2 * 1.2, H2 * 0.9);
          const g = x.createRadialGradient(0, 0, 0, 0, 0, 1);
          g.addColorStop(0.4, "rgba(0,0,0,0)");
          g.addColorStop(1, "rgba(0,0,0,0.75)");
          x.fillStyle = g;
          x.fillRect(-2, -2, 4, 4);
          x.restore();
          const l = x.createLinearGradient(0, 0, 0, H2);
          l.addColorStop(0, "rgba(0,0,0,0.25)");
          l.addColorStop(0.3, "rgba(0,0,0,0)");
          l.addColorStop(0.7, "rgba(0,0,0,0)");
          l.addColorStop(1, "rgba(0,0,0,0.5)");
          x.fillStyle = l;
          x.fillRect(0, 0, W2, H2);
        }
        function resize() {
          W2 = cv.width = Math.max(160, Math.round(innerWidth * SCALE));
          H2 = cv.height = Math.max(90, Math.round(innerHeight * SCALE));
          buildVignette();
        }
        function spawn(p, anywhere) {
          p.x = Math.random() * W2;
          p.y = anywhere ? Math.random() * H2 : H2 + 8;
          p.r = 0.8 + Math.random() * 4;
          p.vy = 0.06 + Math.random() * 0.2;
          p.vx = (Math.random() - 0.5) * 0.1;
          p.ph = Math.random() * TAU;
          p.a = 0.25 + Math.random() * 0.6;
          p.k = Math.floor(Math.random() * 4);
        }
        function haze(img, alpha, period, dir, ox, oy, op) {
          if (!img || alpha <= 0) return;
          const D = Math.max(W2, H2) * 1.8;
          const k = 1.15 + 0.2 * tri(clock / period);
          ctx.save();
          ctx.globalCompositeOperation = op;
          ctx.globalAlpha = alpha;
          ctx.translate(ox, oy);
          ctx.rotate(dir * (clock / period) * TAU);
          ctx.scale(k, k);
          ctx.drawImage(img, W2 / 2 - ox - D / 2, H2 / 2 - oy - D / 2, D, D);
          ctx.restore();
        }
        function ellipse(cx, cy, rx, ry, c, a) {
          ctx.save();
          ctx.translate(cx, cy);
          ctx.scale(rx, ry);
          const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
          g.addColorStop(0, rgba(c, a));
          g.addColorStop(0.7, rgba(c, 0));
          ctx.fillStyle = g;
          ctx.fillRect(-1, -1, 2, 2);
          ctx.restore();
        }
        function aurora(light) {
          const p = ease(tri(clock / 56));
          const EW = W2 * 1.24, EH = H2 * 1.24, ex = -W2 * 0.12, ey = -H2 * 0.12;
          ctx.save();
          ctx.globalCompositeOperation = light ? "multiply" : "soft-light";
          ctx.globalAlpha = light ? 0.5 : 1;
          ctx.translate(W2 / 2 + EW * (-0.04 + 0.08 * p), H2 / 2 + EH * (-0.02 + 0.05 * p));
          ctx.rotate((-4 + 9 * p) * Math.PI / 180);
          ctx.scale(1 + 0.12 * p, 1 + 0.12 * p);
          ctx.translate(-W2 / 2, -H2 / 2);
          ellipse(ex + EW * 0.2, ey + EH * 0.3, EW * 0.4, EH * 0.35, pal[0], 0.55);
          ellipse(ex + EW * 0.8, ey + EH * 0.2, EW * 0.35, EH * 0.4, pal[1], 0.45);
          ellipse(ex + EW * 0.6, ey + EH * 0.85, EW * 0.45, EH * 0.35, pal[2], 0.35);
          ctx.restore();
        }
        function pulse(playing, lvl) {
          if (!playing) return;
          let o, s;
          if (cfg.beat && audio.data) {
            o = 0.4 + 0.6 * lvl;
            s = 1 + 0.07 * lvl;
          } else {
            const b = (1 - Math.cos(clock / 4.2 * TAU)) / 2;
            o = 0.55 + 0.45 * b;
            s = 1 + 0.08 * b;
          }
          ctx.save();
          ctx.globalAlpha = o;
          ctx.translate(W2 / 2, H2 * 1.1);
          ctx.scale(s, s);
          ellipse(0, 0, W2 * 0.6, H2 * 0.6, pal[0], 0.35);
          ctx.restore();
        }
        function particles(dt, lvl) {
          if (!cfg.particles || !sprites.length) return;
          const speed = 1 + lvl * 2.5;
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          for (const p of parts) {
            if (dt) {
              p.ph += 0.01 * dt;
              p.y -= p.vy * speed * dt;
              p.x += (p.vx + Math.sin(p.ph) * 0.08) * speed * dt;
              if (p.y < -10) spawn(p, false);
            }
            ctx.globalAlpha = p.a * (0.6 + Math.sin(p.ph * 3) * 0.4);
            const d = p.r * 4 * (1 + lvl * 0.4);
            ctx.drawImage(sprites[p.k] || sprites[0], p.x - d / 2, p.y - d / 2, d, d);
          }
          ctx.restore();
        }
        function draw(now) {
          const playing = root.classList.contains("mirage-playing");
          const moving = playing && !cfg.calm;
          const dt = lastT ? Math.min(3, (now - lastT) / 16.7) : 0;
          lastT = now;
          if (moving) clock += dt * 16.7 / 1e3;
          const light = root.classList.contains("mirage-light");
          const lvl = moving ? beat.level : 0;
          ctx.globalCompositeOperation = "source-over";
          ctx.globalAlpha = 1;
          ctx.fillStyle = rgba(base, 1);
          ctx.fillRect(0, 0, W2, H2);
          const f = cur ? ease(Math.min(1, (now - fadeT0) / FADE)) : 0;
          const bright = cfg.bright / 100;
          for (const [layer, a] of [[prev, 1 - f], [cur, f]]) {
            if (!layer) continue;
            haze(layer, a * (light ? 0.55 : 0.95), 70, 1, W2 / 2, H2 / 2, "source-over");
            haze(layer, a * (light ? 0.35 : 0.55), 95, -1, W2 * 0.14, H2 * 0.86, light ? "source-over" : "screen");
          }
          if (bright < 1) {
            ctx.globalAlpha = 1 - bright;
            ctx.fillStyle = rgba(base, 1);
            ctx.fillRect(0, 0, W2, H2);
            ctx.globalAlpha = 1;
          } else if (bright > 1 && cur) {
            haze(cur, (bright - 1) * 0.6, 70, 1, W2 / 2, H2 / 2, "lighter");
          }
          if (!cfg.lite) aurora(light);
          pulse(playing && !cfg.calm, lvl);
          particles(moving ? dt : 0, lvl);
          ctx.globalCompositeOperation = "source-over";
          ctx.globalAlpha = light ? 0.2 : 1;
          ctx.drawImage(vig, 0, 0);
          ctx.globalAlpha = 1;
        }
        function active() {
          if (!running || paused || document.hidden) return false;
          const moving = root.classList.contains("mirage-playing") && !cfg.calm;
          return moving || performance.now() < aliveUntil;
        }
        function tick() {
          timer = 0;
          if (!running || document.hidden) return;
          requestAnimationFrame((now) => {
            draw(now);
            if (active()) timer = setTimeout(tick, 1e3 / fps());
            else lastT = 0;
          });
        }
        function wake() {
          if (!running || timer) return;
          timer = setTimeout(tick, 0);
        }
        document.addEventListener("visibilitychange", wake);
        onHaze((src) => {
          const img = new Image();
          img.onload = () => {
            prev = cur;
            cur = img;
            fadeT0 = performance.now();
            aliveUntil = fadeT0 + FADE + 100;
            wake();
          };
          img.src = src;
        });
        function pause(on) {
          paused = on;
          if (!on) wake();
        }
        function start() {
          if (!running) {
            running = true;
            cv.style.display = "";
            resize();
            recolor(current);
            if (!parts.length) for (let i = 0; i < 56; i++) {
              const p = {};
              spawn(p, true);
              parts.push(p);
            }
          }
          aliveUntil = Math.max(aliveUntil, performance.now() + 50);
          wake();
        }
        function stop() {
          running = false;
          clearTimeout(timer);
          timer = 0;
          cv.style.display = "none";
        }
        addEventListener("resize", () => {
          if (!running) return;
          resize();
          aliveUntil = performance.now() + 50;
          wake();
        });
        return { start, stop, recolor, pause, wake };
      })();
    }
  });

  // src/pages.js
  function pageEnter() {
    if (!cfg.cascade || cfg.calm) return;
    const mv = document.querySelector(SEL.mainView);
    if (!mv) return;
    mv.classList.remove("m-enter");
    setTimeout(() => {
      mv.querySelectorAll(SEL.grid).forEach(
        (g) => [...g.children].slice(0, 24).forEach((c, i) => c.style.setProperty("--m-i", i))
      );
      [...mv.querySelectorAll(SEL.rows)].slice(0, 26).forEach((r, i) => r.style.setProperty("--m-i", i));
      void mv.offsetWidth;
      mv.classList.add("m-enter");
      clearTimeout(enterTimer);
      enterTimer = setTimeout(() => mv.classList.remove("m-enter"), 1800);
    }, 70);
  }
  function domReport() {
    try {
      domReportInner();
    } catch (e) {
      bridge.send({ type: "debug", failed: String(e && e.stack), errors });
    }
  }
  function domReportInner() {
    const tree = [];
    (function walk(el2, depth) {
      if (depth > 4 || tree.length > 160) return;
      for (const c of el2.children) {
        const r = c.getBoundingClientRect();
        tree.push(`${"  ".repeat(depth)}${c.tagName.toLowerCase()}${c.id ? "#" + c.id : ""} .${String(c.className?.baseVal ?? c.className).slice(0, 120)} [${c.dataset?.testid || ""}] ${r.width | 0}x${r.height | 0}`);
        walk(c, depth + 1);
      }
    })(document.body, 0);
    bridge.send({ type: "debug", phase: "tree", hasMainView: !!document.querySelector(SEL.mainView), tree });
    const mv = document.querySelector(SEL.mainView) || document.querySelector("main") || document.body;
    const out = [];
    const minW = mv.clientWidth * 0.4;
    for (const el2 of mv.querySelectorAll("*")) {
      if (out.length >= 80) break;
      if (el2.offsetWidth < minW || el2.offsetHeight < 30) continue;
      const r = el2.getBoundingClientRect();
      if (r.top > innerHeight) continue;
      const cs = getComputedStyle(el2);
      const pseudo = ["::before", "::after"].map((p) => {
        const c = getComputedStyle(el2, p);
        return c.content !== "none" && (c.backgroundColor !== "rgba(0, 0, 0, 0)" || c.backgroundImage !== "none") ? `${p} ${c.backgroundColor} ${c.backgroundImage.slice(0, 160)} op=${c.opacity}` : "";
      }).filter(Boolean);
      if (cs.backgroundColor === "rgba(0, 0, 0, 0)" && cs.backgroundImage === "none" && !pseudo.length) continue;
      out.push({
        tag: el2.tagName,
        cls: String(el2.className?.baseVal ?? el2.className).slice(0, 200),
        testid: el2.dataset?.testid || "",
        style: (el2.getAttribute("style") || "").slice(0, 300),
        bg: cs.backgroundColor,
        img: cs.backgroundImage.slice(0, 200),
        opacity: cs.opacity,
        tint: el2.classList.contains("m-tint"),
        rect: [r.left | 0, r.top | 0, r.width | 0, r.height | 0],
        pseudo
      });
    }
    bridge.send({ type: "debug", page: root.dataset.mPage, url: location.href, report: out, errors, vars: {
      main: getComputedStyle(root).getPropertyValue("--spice-main"),
      a: getComputedStyle(root).getPropertyValue("--m-a"),
      dynamic: cfg.dynamic,
      scheme: cfg.scheme,
      current,
      colorDiag
    } });
  }
  function markPage(loc) {
    const path = (loc || S.Platform.History.location || {}).pathname || "";
    root.dataset.mPage = path.split("/")[1] || "home";
  }
  var enterTimer;
  var init_pages = __esm({
    "src/pages.js"() {
      init_selectors();
      init_core();
      init_config();
      init_color();
      init_bridge();
      enterTimer = 0;
      try {
        S.Platform.History.listen((loc) => {
          markPage(loc);
          pageEnter();
        });
        markPage();
      } catch {
      }
    }
  });

  // src/bridge.js
  var bridge;
  var init_bridge = __esm({
    "src/bridge.js"() {
      init_core();
      init_lyrics();
      init_audio();
      init_i18n();
      init_color();
      init_player();
      init_pages();
      bridge = /* @__PURE__ */ (() => {
        const ADDR = "ws://127.0.0.1:47321";
        let ws = null, retry = 0, wanted = false;
        function connect2() {
          wanted = true;
          if (ws && ws.readyState <= 1) return;
          try {
            ws = new WebSocket(ADDR);
          } catch {
            return schedule3();
          }
          const sock = ws;
          ws.onopen = () => ws === sock && sendTrack();
          ws.onclose = () => {
            if (ws !== sock) return;
            ws = null;
            setTopics([]);
            schedule3();
          };
          ws.onerror = () => {
          };
          ws.onmessage = (e) => {
            if (ws !== sock) return;
            let m;
            try {
              m = JSON.parse(e.data);
            } catch {
              return;
            }
            if (m.type !== "cmd") return;
            if (m.cmd === "toggle") S.Player.togglePlay();
            else if (m.cmd === "next") S.Player.next();
            else if (m.cmd === "prev") S.Player.back();
            else if (m.cmd === "hello") sendTrack();
            else if (m.cmd === "subscribe") setTopics(Array.isArray(m.topics) ? m.topics : []);
            else if (m.cmd === "report") {
              send({ type: "debug-start", hidden: document.hidden });
              domReport();
            }
          };
        }
        function schedule3() {
          clearTimeout(retry);
          if (wanted) retry = setTimeout(connect2, 5e3);
        }
        function close() {
          wanted = false;
          clearTimeout(retry);
          setTopics([]);
          try {
            ws?.close();
          } catch {
          }
          ws = null;
        }
        let topics = /* @__PURE__ */ new Set(), lyricTimer = 0, levelTimer = 0, lastLine = "";
        function setTopics(list) {
          topics = new Set(list.filter((x) => x === "lyric" || x === "level"));
          clearInterval(lyricTimer);
          clearInterval(levelTimer);
          lastLine = "";
          if (topics.has("lyric")) lyricTimer = setInterval(pushLyric, 250);
          if (topics.has("level")) levelTimer = setInterval(pushLevel, 66);
        }
        async function pushLyric() {
          const uri = currentItem()?.uri || "";
          const lyr = await getLyrics(uri);
          const lines = lyr?.synced ? lyr.lines : null;
          const i = lines ? seek(lines, S.Player.getProgress?.() || 0, "t") : -1;
          const text = i >= 0 && lines[i].text !== "\u266A" ? lines[i].text : "";
          const key = uri + "|" + i;
          if (key === lastLine) return;
          lastLine = key;
          send({ type: "lyric", uri, index: i, text, next: lines?.[i + 1]?.text?.replace("\u266A", "") || "" });
        }
        function pushLevel() {
          if (!S.Player.isPlaying()) return;
          const b = bands((S.Player.getProgress?.() || 0) / 1e3);
          if (b) send({ type: "level", bands: b });
        }
        function sendTrack(changed) {
          const item = currentItem();
          if (!item || ws?.readyState !== 1) return;
          const c = covers(item);
          ws.send(
            JSON.stringify({
              type: "track",
              changed: !!changed,
              uri: item.uri,
              title: titleOf(item),
              artist: artistOf(item),
              album: item.album?.name || item.metadata?.album_title || "",
              cover: c.big || c.small,
              colors: palette().map((x) => `rgb(${x.join(",")})`),
              duration: S.Player.getDuration?.() || 0,
              progress: S.Player.getProgress?.() || 0,
              playing: !!S.Player.isPlaying(),
              lang: LANG
            })
          );
        }
        const send = (obj) => ws?.readyState === 1 && ws.send(JSON.stringify(obj));
        return { connect: connect2, close, sendTrack, send, connected: () => ws?.readyState === 1 };
      })();
    }
  });

  // src/color.js
  function readable([h, s, l], bg, step) {
    let rgb = hsl2rgb([h, s, l]);
    for (let i = 0; i < 12 && contrast(rgb, bg) < 4.5; i++) rgb = hsl2rgb([h, s, l = clamp(l + step, 0.05, 0.95)]);
    return rgb;
  }
  function shape(colors) {
    const [h1, s1] = rgb2hsl(colors[0]);
    const second = colors[1] ? rgb2hsl(colors[1]) : null;
    if (s1 < 0.08 && (!second || second[1] < 0.08)) return null;
    const gray = s1 < 0.12;
    const sec = second || [(h1 + 40) % 360, s1, 0.5];
    const light = document.documentElement.classList.contains("mirage-light");
    const bg = light ? [244, 241, 250] : [7, 6, 12];
    const a = readable([h1, gray ? s1 : clamp(s1, 0.5, 0.95), light ? 0.42 : 0.68], bg, light ? -0.04 : 0.04);
    const b = hsl2rgb([sec[0], gray ? sec[1] : clamp(sec[1], 0.45, 0.95), light ? 0.4 : 0.52]);
    const c = readable([(h1 + 12) % 360, gray ? s1 : clamp(s1 * 0.8, 0.35, 0.85), light ? 0.3 : 0.84], bg, light ? -0.04 : 0.04);
    return [a, b, c];
  }
  function quantize(data) {
    const buckets = /* @__PURE__ */ new Map();
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 200) continue;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const key = r >> 4 << 8 | g >> 4 << 4 | b >> 4;
      const e = buckets.get(key) || { r: 0, g: 0, b: 0, n: 0 };
      e.r += r;
      e.g += g;
      e.b += b;
      e.n++;
      buckets.set(key, e);
    }
    const ranked = [...buckets.values()].map((e) => {
      const rgb = [e.r / e.n, e.g / e.n, e.b / e.n].map(Math.round);
      const [h, s, l] = rgb2hsl(rgb);
      const lightOk = l > 0.12 && l < 0.92 ? 1 : 0.15;
      return { rgb, h, s, score: e.n * (0.2 + s * s * 2) * lightOk };
    }).sort((x, y) => y.score - x.score);
    if (!ranked.length) return null;
    const first = ranked[0];
    const partner = ranked.find((c) => hueGap(c.h, first.h) > 28 && c.s > 0.15) || null;
    return shape([first.rgb, partner?.rgb]);
  }
  async function analyse(url, uri) {
    const key = url + "|" + document.documentElement.classList.contains("mirage-light");
    if (analysed.has(key)) return analysed.get(key);
    const res = await analyseFresh(url, uri);
    if (res.colors || res.haze) analysed.set(key, res);
    return res;
  }
  function softHaze(src, light) {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const x = c.getContext("2d");
    x.filter = light ? "blur(5px) saturate(2) brightness(1.35)" : "blur(5px) saturate(1.5) brightness(0.66)";
    x.drawImage(src, -8, -8, 80, 80);
    return c.toDataURL("image/jpeg", 0.9);
  }
  async function analyseFresh(url, uri) {
    const img = await loadImage(url, true);
    Object.assign(colorDiag, { url: url.slice(0, 60), img: !!img, err: "", via: "" });
    let colors = null, haze = null;
    if (img) {
      try {
        const c = document.createElement("canvas");
        c.width = c.height = 64;
        const x = c.getContext("2d", { willReadFrequently: true });
        x.drawImage(img, 0, 0, 64, 64);
        colors = quantize(x.getImageData(0, 0, 64, 64).data);
        haze = softHaze(c, document.documentElement.classList.contains("mirage-light"));
        colorDiag.via = colors ? "canvas" : "canvas-leer";
      } catch (e) {
        colorDiag.err = String(e && e.message);
      }
    }
    if (!colors) {
      try {
        const ex = await S.colorExtractor(uri);
        const a = hex2rgb(ex.VIBRANT) || hex2rgb(ex.PROMINENT);
        const b = hex2rgb(ex.DARK_VIBRANT) || hex2rgb(ex.DESATURATED);
        if (a) colors = shape([a, b]);
        if (a) colorDiag.via = "extractor";
      } catch (e) {
        colorDiag.err += " | extractor: " + String(e && e.message);
      }
    }
    return { colors, haze };
  }
  function setColors(next) {
    if (current && next.every((c2, i) => c2.every((v, j) => Math.abs(v - current[i][j]) < 3))) return;
    current = next;
    const [a, b, c] = next.map((x) => x.join(","));
    varSheet.textContent = `html:root{--m-a:rgb(${a});--m-a-rgb:${a};--m-b:rgb(${b});--m-b-rgb:${b};--m-c:rgb(${c});--m-c-rgb:${c};--spice-button:rgb(${a});--spice-rgb-button:${a};--spice-button-active:rgb(${c});--spice-rgb-button-active:${c}}`;
    dust.recolor(next);
    bridge.sendTrack();
  }
  function clearColors() {
    current = null;
    varSheet.textContent = "";
    dust.recolor(null);
  }
  var rgb2hsl, hsl2rgb, hex2rgb, lum, contrast, colorDiag, analysed, current, palette, varSheet;
  var init_color = __esm({
    "src/color.js"() {
      init_core();
      init_config();
      init_dust();
      init_bridge();
      rgb2hsl = ([r, g, b]) => {
        r /= 255;
        g /= 255;
        b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        const l = (max + min) / 2;
        if (max === min) return [0, 0, l];
        const d = max - min;
        const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
        return [h * 60, s, l];
      };
      hsl2rgb = ([h, s, l]) => {
        const k = (n) => (n + h / 30) % 12;
        const a = s * Math.min(l, 1 - l);
        const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
        return [f(0), f(8), f(4)].map((v) => Math.round(v * 255));
      };
      hex2rgb = (h) => {
        const m = /^#?([0-9a-f]{6})$/i.exec(String(h || "").trim());
        if (!m) return null;
        const n = parseInt(m[1], 16);
        return [n >> 16 & 255, n >> 8 & 255, n & 255];
      };
      lum = (rgb) => {
        const [r, g, b] = rgb.map((v) => {
          v /= 255;
          return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      contrast = (x, y) => {
        const [hi, lo] = [lum(x), lum(y)].sort((p, q) => q - p);
        return (hi + 0.05) / (lo + 0.05);
      };
      colorDiag = {};
      analysed = lru(50);
      current = null;
      palette = () => current || schemePalette();
      varSheet = document.createElement("style");
      varSheet.id = "mirage-vars";
      document.head.append(varSheet);
    }
  });

  // src/song.js
  function effectiveScheme() {
    return cfg.playlistSchemes?.[contextUri2()] || cfg.scheme;
  }
  async function onSong(isChange, attempt = 0) {
    const token = ++songToken;
    const item = currentItem();
    const c = covers(item);
    if (!c.big && item && attempt < 8) {
      setTimeout(() => token === songToken && onSong(isChange, attempt + 1), 250);
      return;
    }
    const changed = isChange && item?.uri !== lastUri;
    lastUri = item?.uri || "";
    const scheme = effectiveScheme();
    applyScheme(scheme);
    const dynamic = cfg.playlistSchemes?.[contextUri2()] ? scheme === "Mirage" : cfg.dynamic;
    loadAudio(item?.uri).then(() => immersive.updateKicker());
    if (immersive.isOpen()) immersive.refresh();
    bridge.sendTrack(changed);
    if (!c.big) return;
    const { colors, haze } = await analyse(c.big, item?.uri);
    if (token !== songToken) return;
    showHaze(haze || c.big);
    record(item, colors || current);
    if (!dynamic) return clearColors();
    if (cfg.freeze && current) return;
    const pinned = cfg.pinned?.[albumUri(item)];
    if (pinned) setColors(pinned);
    else if (colors) setColors(colors);
    else clearColors();
  }
  function onPlayPause() {
    root.classList.toggle("mirage-playing", !!S.Player.isPlaying());
    immersive.playState();
    dust.wake();
    beat.sync();
    bridge.sendTrack(false);
  }
  var contextUri2, albumUri, lastUri, songToken;
  var init_song = __esm({
    "src/song.js"() {
      init_core();
      init_config();
      init_color();
      init_stage();
      init_audio();
      init_bridge();
      init_immersive();
      init_player();
      init_share();
      init_dust();
      contextUri2 = () => S.Player.data?.context?.uri || S.Player.data?.context_uri || "";
      albumUri = (item) => item?.album?.uri || item?.metadata?.album_uri || "";
      lastUri = "";
      songToken = 0;
    }
  });

  // src/perf.js
  function applyPreset(name) {
    const p = PRESETS[name];
    if (!p) return;
    Object.assign(cfg, p, { preset: name });
    save();
  }
  function detectPreset() {
    const hit = Object.entries(PRESETS).find(([, p]) => PRESET_KEYS.every((k) => !!cfg[k] === !!p[k]));
    cfg.preset = hit ? hit[0] : "custom";
  }
  function measure(onDone) {
    if (measured || !cfg.autoPerf || !ORDER.includes(cfg.preset) || cfg.preset === "light") return;
    measured = true;
    let frames = 0, start = 0, hiddenSeen = false;
    const sample = (now) => {
      if (document.hidden) hiddenSeen = true;
      if (!start) start = now;
      frames++;
      if (now - start < 5e3) return requestAnimationFrame(sample);
      const fps2 = frames * 1e3 / (now - start);
      if (hiddenSeen) {
        measured = false;
        return document.addEventListener("visibilitychange", () => !document.hidden && measure(onDone), { once: true });
      }
      if (fps2 >= 45) return;
      const next = ORDER[ORDER.indexOf(cfg.preset) + 1];
      if (!next) return;
      applyPreset(next);
      onDone();
      try {
        S.showNotification?.(t("perfStepped").replace("{fps}", Math.round(fps2)).replace("{preset}", t("preset_" + next)), false, 6e3);
      } catch {
      }
    };
    setTimeout(() => requestAnimationFrame(sample), 4e3);
  }
  var PRESETS, ORDER, PRESET_KEYS, measured, syncHidden;
  var init_perf = __esm({
    "src/perf.js"() {
      init_core();
      init_i18n();
      init_config();
      PRESETS = {
        full: { glass: true, particles: true, grain: true, beat: true, tilt: true, cascade: true, calm: false, lite: false },
        balanced: { glass: false, particles: true, grain: true, beat: true, tilt: true, cascade: true, calm: false, lite: false },
        light: { glass: false, particles: false, grain: false, beat: true, tilt: false, cascade: true, calm: false, lite: true },
        calm: { glass: false, particles: false, grain: true, beat: false, tilt: false, cascade: false, calm: true, lite: false }
      };
      ORDER = ["full", "balanced", "light"];
      PRESET_KEYS = Object.keys(PRESETS.full);
      measured = false;
      syncHidden = () => root.classList.toggle("mirage-hidden", document.hidden);
      document.addEventListener("visibilitychange", syncHidden);
      syncHidden();
    }
  });

  // src/readability.js
  function backgroundOf(el2) {
    let depth = 0;
    for (let n = el2; n && n !== document.documentElement && depth++ < 10; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.backgroundImage !== "none") return null;
      const bg = parse(cs.backgroundColor);
      if (bg && bg[3] >= 0.85) return bg;
    }
    return null;
  }
  function checkOne(el2) {
    checked.add(el2);
    if (el2.classList.contains("m-readable") || !hasText(el2)) return;
    const cs = getComputedStyle(el2);
    const fg = parse(cs.color);
    if (!fg || fg[3] < 0.3 || cs.visibility === "hidden") return;
    const bg = backgroundOf(el2);
    if (!bg || ratio(fg, bg) >= 3) return;
    el2.classList.add("m-readable", lum2(bg) > 0.4 ? "m-readable-dark" : "m-readable-light");
  }
  function check(deadline) {
    queued = false;
    const until = performance.now() + Math.min(4, deadline?.timeRemaining?.() ?? 4);
    while (pending.length && performance.now() < until) {
      const root2 = pending.pop();
      if (!root2.isConnected || checked.has(root2) || root2.closest("#mirage-immersive, #mirage-stage")) continue;
      checkOne(root2);
      for (let c = root2.firstElementChild; c; c = c.nextElementSibling) if (!checked.has(c)) pending.push(c);
    }
    if (pending.length) schedule();
  }
  function schedule() {
    if (queued) return;
    queued = true;
    (window.requestIdleCallback || setTimeout)(check, { timeout: 1500 });
  }
  function queue(node) {
    if (node?.nodeType !== 1 || checked.has(node)) return;
    if (!node.closest(SCOPES)) {
      const inner = node.querySelector?.(SCOPES);
      if (!inner) return;
      node = inner;
    }
    pending.push(node);
    schedule();
  }
  function recheckAll() {
    document.querySelectorAll(".m-readable").forEach((el2) => el2.classList.remove("m-readable", "m-readable-dark", "m-readable-light"));
    checked = /* @__PURE__ */ new WeakSet();
    document.querySelectorAll(SCOPES).forEach(queue);
  }
  var SCOPES, parse, lum2, ratio, hasText, checked, queued, pending;
  var init_readability = __esm({
    "src/readability.js"() {
      init_selectors();
      SCOPES = `[role="menu"], [role="listbox"], [role="dialog"], [role="tooltip"], .x-settings-container, ${SEL.mainView}`;
      parse = (c) => {
        const m = /rgba?\(([^)]+)\)/.exec(c || "");
        if (!m) return null;
        const [r, g, b, a = "1"] = m[1].split(/[\s,/]+/).filter(Boolean);
        return [Number(r), Number(g), Number(b), Number(a)];
      };
      lum2 = ([r, g, b]) => {
        const f = (v) => (v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      };
      ratio = (x, y) => {
        const [hi, lo] = [lum2(x), lum2(y)].sort((p, q) => q - p);
        return (hi + 0.05) / (lo + 0.05);
      };
      hasText = (el2) => {
        for (const c of el2.childNodes) if (c.nodeType === 3 && c.textContent.trim()) return true;
        return false;
      };
      checked = /* @__PURE__ */ new WeakSet();
      queued = false;
      pending = [];
      new MutationObserver((list) => {
        for (const m of list) for (const n of m.addedNodes) queue(n);
      }).observe(document.body, { subtree: true, childList: true });
      setTimeout(recheckAll, 3e3);
    }
  });

  // src/settings.js
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
    dust.start();
    beat.sync();
    cfg.overlay ? bridge.connect() : bridge.close();
    immersive.styleLyrics();
  }
  function refreshColors() {
    applySettings();
    onSong(false);
    setTimeout(recheckAll, 600);
  }
  function selectScheme(name) {
    if (!SCHEMES[name]) return;
    cfg.scheme = name;
    cfg.schemeCfg = S.Config?.color_scheme || "";
    cfg.dynamic = name === "Mirage";
    save();
    refreshColors();
  }
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
      const bolt = el("i", "m-cost", "\u26A1");
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
  function render(box) {
    render.again = () => render(box);
    const kids = [];
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
        const x = el("span", "m-scheme-del", "\xD7");
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
    const item = currentItem();
    const album = albumUri(item), ctx = contextUri2();
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
      ["bars", t("viz_bars")],
      ["wave", t("viz_wave")],
      ["dots", t("viz_dots")],
      ["particles", t("viz_particles")],
      ["line", t("viz_line")],
      ["bottom", t("viz_bottom")]
    ];
    kids.push(
      group(
        t("g_immersive"),
        false,
        range("lyrSize", 70, 150, 5, " %", () => immersive.styleLyrics()),
        range("lyrGap", 60, 200, 10, " %", () => immersive.styleLyrics()),
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
        toggle("vizGlow", () => {
        }),
        toggle("vizRings", () => {
        }),
        toggle("vizMirror", () => {
        }),
        toggle("vizSpin", () => {
        })
      )
    );
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
        try {
          await navigator.clipboard.writeText(code);
          notify(t("copied"));
        } catch {
          codeIn.value = code;
        }
      }),
      button(t("schemeImport"), () => {
        const d = decode("MIRAGE-SCHEME:", codeIn.value);
        if (!d?.colors?.accent) return notify(t("badCode"), true);
        const name = BUILT_IN.includes(d.name) ? d.name + " 2" : String(d.name).slice(0, 24);
        saveScheme(name, d.colors);
      })
    );
    kids.push(group(t("g_builder"), false, builder, nameIn, bActions, codeIn));
    kids.push(group(t("g_overlay"), false, toggle("overlay")));
    const foot = el("div", "m-actions");
    const dataIn = el("input", "m-text");
    dataIn.placeholder = t("settingsCodeHint");
    foot.append(
      button(t("shareNow"), () => nowPlayingCard()),
      button(t("shareWeek"), () => weekCard()),
      button(t("exportSettings"), async () => {
        const code = encode("MIRAGE-SETTINGS:", cfg);
        try {
          await navigator.clipboard.writeText(code);
          notify(t("copied"));
        } catch {
          dataIn.value = code;
        }
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
        try {
          await navigator.clipboard.writeText(diagnostics());
          notify(t("copied"));
        } catch {
          dataIn.value = diagnostics();
        }
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
    const openNow = [...box.querySelectorAll("details[open] > summary")].map((s) => s.textContent);
    box.replaceChildren(...kids);
    box.querySelectorAll("details > summary").forEach((s) => openNow.includes(s.textContent) && (s.parentElement.open = true));
  }
  function openSettings() {
    const box = el("div", "mirage-settings");
    render(box);
    S.PopupModal.display({ title: "Mirage", content: box, isLarge: true });
  }
  function welcome() {
    const KEY2 = "mirage:welcomed";
    try {
      if (localStorage.getItem(KEY2)) return;
      localStorage.setItem(KEY2, VERSION);
    } catch {
      return;
    }
    setTimeout(() => {
      const box = el("div", "mirage-welcome");
      box.setAttribute("role", "status");
      box.append(el("b", "", t("welcomeTitle")), el("span", "", t("welcomeText")));
      const row = el("div", "m-actions");
      row.append(
        button(t("welcomeImmersive"), () => {
          box.remove();
          immersive.open();
        }, "is-primary"),
        button(t("menu"), () => {
          box.remove();
          openSettings();
        }),
        button("\xD7", () => box.remove(), "m-close")
      );
      box.append(row);
      document.body.append(box);
      setTimeout(() => box.isConnected && box.classList.add("is-gone"), 2e4);
    }, 5e3);
  }
  var COSTLY, el, notify, encode, decode;
  var init_settings = __esm({
    "src/settings.js"() {
      init_core();
      init_i18n();
      init_config();
      init_color();
      init_audio();
      init_dust();
      init_bridge();
      init_immersive();
      init_song();
      init_player();
      init_perf();
      init_readability();
      init_selectors();
      init_share();
      COSTLY = /* @__PURE__ */ new Set(["glass", "particles", "beat", "tilt", "canvas"]);
      el = (tag, cls, text) => {
        const e = document.createElement(tag);
        if (cls) e.className = cls;
        if (text != null) e.textContent = text;
        return e;
      };
      notify = (msg, err) => {
        try {
          S.showNotification?.(msg, !!err, 3500);
        } catch {
        }
      };
      encode = (prefix, obj) => prefix + btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
      decode = (prefix, text) => {
        const s = String(text || "").trim();
        if (!s.startsWith(prefix)) return null;
        try {
          return JSON.parse(decodeURIComponent(escape(atob(s.slice(prefix.length)))));
        } catch {
          return null;
        }
      };
    }
  });

  // src/cards.js
  var hoverCard, pending2, queued2, wheelUntil;
  var init_cards = __esm({
    "src/cards.js"() {
      init_selectors();
      init_config();
      hoverCard = null;
      pending2 = null;
      queued2 = false;
      wheelUntil = 0;
      document.addEventListener(
        "wheel",
        () => {
          wheelUntil = performance.now() + 350;
          if (hoverCard) {
            hoverCard.style.setProperty("--rx", "0deg");
            hoverCard.style.setProperty("--ry", "0deg");
          }
        },
        { passive: true }
      );
      document.addEventListener(
        "pointermove",
        (e) => {
          if (e.pointerType === "touch" || performance.now() < wheelUntil) return;
          pending2 = e;
          if (queued2) return;
          queued2 = true;
          requestAnimationFrame(() => {
            queued2 = false;
            const ev = pending2;
            const card = ev.target.closest?.(SEL.card);
            if (hoverCard && hoverCard !== card) {
              hoverCard.style.setProperty("--rx", "0deg");
              hoverCard.style.setProperty("--ry", "0deg");
            }
            hoverCard = card;
            if (!card) return;
            const r = card.getBoundingClientRect();
            const px = (ev.clientX - r.left) / r.width;
            const py = (ev.clientY - r.top) / r.height;
            card.style.setProperty("--mx", px * 100 + "%");
            card.style.setProperty("--my", py * 100 + "%");
            if (cfg.tilt && !cfg.calm) {
              card.style.setProperty("--rx", ((0.5 - py) * 9).toFixed(2) + "deg");
              card.style.setProperty("--ry", ((px - 0.5) * 11).toFixed(2) + "deg");
            }
          });
        },
        { passive: true }
      );
    }
  });

  // src/tints.js
  function alphaOf(c) {
    if (!c || c === "transparent") return 0;
    const slash = /\/\s*([\d.]+)(%?)\s*\)$/.exec(c);
    if (slash) return Number(slash[1]) / (slash[2] ? 100 : 1);
    const rgba2 = /^rgba\(([^)]+)\)$/.exec(c);
    if (rgba2) return Number(rgba2[1].split(",")[3]);
    return 1;
  }
  function tame(el2, minW) {
    if (el2.classList.contains("m-tint") || el2.offsetWidth < minW || el2.offsetHeight < 40) return;
    if (el2.closest(SEL.tintSkip)) return;
    const cs = getComputedStyle(el2);
    if (/url\(["']?https?:/.test(cs.backgroundImage)) return;
    const tc = /rgba?\(([^)]+)\)/.exec(cs.color);
    if (tc) {
      const [cr, cg, cb] = tc[1].split(",").map(Number);
      if (cr * 0.3 + cg * 0.59 + cb * 0.11 < 90) return;
    }
    const alpha = alphaOf(cs.backgroundColor);
    for (const p of ["::before", "::after"]) {
      const ps = getComputedStyle(el2, p);
      if (ps.content !== "none" && (alphaOf(ps.backgroundColor) >= 0.3 || ps.backgroundImage.includes("gradient("))) {
        el2.classList.add("m-tint-pseudo");
      }
    }
    const gradient = cs.backgroundImage.includes("gradient(");
    if (alpha >= 0.3) el2.classList.add("m-tint");
    if (gradient) el2.classList.add("m-tint", "m-tint-img");
  }
  function run() {
    queued3 = false;
    if (root.classList.contains("mirage-im-open") || document.hidden) {
      return setTimeout(schedule2, 2e3);
    }
    const mv = document.querySelector(SEL.mainView);
    if (!mv) return;
    lastRun = performance.now();
    const minW = mv.clientWidth * 0.55;
    if (full) {
      full = false;
      pending3.clear();
      for (const el2 of mv.querySelectorAll(CANDIDATE)) tame(el2, minW);
      return;
    }
    const batch = [...pending3];
    pending3.clear();
    for (const node of batch) {
      if (!node.isConnected) continue;
      if (node.matches(CANDIDATE)) tame(node, minW);
      if (node.offsetWidth >= minW) for (const el2 of node.querySelectorAll(CANDIDATE)) tame(el2, minW);
    }
  }
  function schedule2() {
    if (queued3) return;
    queued3 = true;
    const wait = Math.max(0, 400 - (performance.now() - lastRun));
    setTimeout(() => (window.requestIdleCallback || setTimeout)(run, { timeout: 800 }), wait);
  }
  function scanAll() {
    full = true;
    schedule2();
  }
  var CANDIDATE, pending3, queued3, full, lastRun;
  var init_tints = __esm({
    "src/tints.js"() {
      init_selectors();
      init_core();
      CANDIDATE = "div, section, header";
      pending3 = /* @__PURE__ */ new Set();
      queued3 = false;
      full = false;
      lastRun = 0;
      (function watchTints() {
        const mv = document.querySelector(SEL.mainView);
        if (!mv) return setTimeout(watchTints, 500);
        new MutationObserver((list) => {
          for (const m of list) {
            if (m.type === "attributes") {
              if (!m.target.closest(SEL.tintSkip)) pending3.add(m.target);
            } else for (const n of m.addedNodes) if (n.nodeType === 1) pending3.add(n);
          }
          if (pending3.size) schedule2();
        }).observe(mv, { subtree: true, childList: true, attributes: true, attributeFilter: ["style"] });
        scanAll();
        try {
          S.Platform.History.listen(() => {
            scanAll();
            setTimeout(scanAll, 1500);
          });
        } catch {
        }
      })();
    }
  });

  // src/keys.js
  var init_keys = __esm({
    "src/keys.js"() {
      init_core();
      init_immersive();
      window.addEventListener("keydown", (e) => {
        if (e.ctrlKey && e.shiftKey && e.code === "KeyM") {
          e.preventDefault();
          immersive.toggle();
        } else if (immersive.isOpen()) {
          if (e.ctrlKey || e.altKey || e.metaKey || e.target.matches?.("input[type=text], textarea")) return;
          const keys = {
            Escape: () => document.fullscreenElement ? document.exitFullscreen() : immersive.close(),
            Space: () => S.Player.togglePlay(),
            ArrowLeft: () => immersive.seekBy(-5e3),
            ArrowRight: () => immersive.seekBy(5e3),
            ArrowUp: () => immersive.volBy(0.05),
            ArrowDown: () => immersive.volBy(-0.05),
            KeyL: () => immersive.like(),
            KeyS: () => immersive.shuffle(),
            KeyR: () => immersive.repeat(),
            KeyF: () => immersive.toggleFull(),
            KeyQ: () => immersive.toggleQueue(),
            KeyN: () => S.Player.next(),
            KeyP: () => S.Player.back()
          };
          if (e.key === "?") return immersive.toggleKeys();
          if (/^Digit[123]$/.test(e.code)) immersive.setMode(MODES[+e.code.slice(5) - 1][0], true);
          else if (keys[e.code] && !(e.code === "Space" && e.target.closest?.("button"))) {
            e.preventDefault();
            e.stopPropagation();
            keys[e.code]();
          }
        }
      }, true);
    }
  });

  // src/app.js
  var app_exports = {};
  var init_app = __esm({
    "src/app.js"() {
      init_core();
      init_config();
      init_color();
      init_bridge();
      init_selectors();
      init_i18n();
      init_settings();
      init_immersive();
      init_pages();
      init_song();
      init_perf();
      init_share();
      init_cards();
      init_tints();
      init_keys();
      init_readability();
      init_selectors();
      (function addMenu() {
        if (!S.Menu?.Item) return setTimeout(addMenu, 500);
        try {
          new S.Menu.Item(t("menu"), false, openSettings, "brightness").register();
          new S.Menu.Item(t("shareNow"), false, () => nowPlayingCard(), "share").register();
        } catch {
        }
      })();
      (function addTopbar() {
        if (!S.Topbar?.Button) return setTimeout(addTopbar, 500);
        try {
          new S.Topbar.Button(t("immersive"), ICON.orb, () => immersive.toggle());
        } catch {
        }
      })();
      S.Player.addEventListener("songchange", () => onSong(true));
      S.Player.addEventListener("onplaypause", onPlayPause);
      applySettings();
      onPlayPause();
      onSong(false);
      setTimeout(pageEnter, 400);
      measure(applySettings);
      welcome();
      window.Mirage = {
        version: VERSION,
        schemes: () => Object.entries(SCHEMES).map(([name, sc]) => ({ name, main: sc.main, a: sc.button, b: sc.notification, c: sc["button-active"], active: cfg.scheme === name })),
        setScheme: selectScheme,
        palette: () => palette(),
        week,
        overlay: () => ({ enabled: !!cfg.overlay, connected: bridge.connected() }),
        health: () => ({ ...health }),
        diagnostics,
        openSettings,
        openImmersive: () => immersive.open(),
        shareNow: () => nowPlayingCard(),
        shareWeek: () => weekCard()
      };
    }
  });

  // src/main.js
  (function boot() {
    const S2 = window.Spicetify;
    if (!S2?.Player?.addEventListener || !S2?.Platform || !S2?.CosmosAsync || !document.body) {
      setTimeout(boot, 300);
      return;
    }
    if (window.__mirage) return;
    window.__mirage = true;
    Promise.resolve().then(() => init_app());
  })();
})();
