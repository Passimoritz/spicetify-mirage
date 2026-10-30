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
      VERSION = true ? "1.4.0" : "dev";
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
          k_view: "Cover \xB7 lyrics \xB7 visualizer \xB7 mix \xB7 party",
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
          k_queue: "Up next",
          overlayDownload: "Download the Overlay app",
          overlayAllDownloads: "All downloads",
          overlayConnected: "\u25CF Overlay connected",
          overlayMissing: "\u25CB Overlay not running \u2013 install it with the button below, then start it once",
          onlineLyrics: "Search lyrics online",
          onlineLyricsHint: "If Spotify has none, Mirage asks LRCLIB \u2013 only title, artist, album and length are sent",
          emptyTitle: "No lyrics for this song",
          emptyText: "Neither Spotify nor LRCLIB has lyrics for it yet.",
          emptyTextOff: "Spotify has none. Turn on \u201CSearch lyrics online\u201D in the settings to look further.",
          instrTitle: "Instrumental",
          instrText: "No words \u2013 just let the music play.",
          showViz: "Show visualizer",
          searchWeb: "Search the web",
          lyrPick: "Choose version",
          lyrPicked: "chosen",
          lyrNone: "No lyrics",
          lyrAuto: "Automatic",
          lyrAutoHint: "Spotify first, then the best LRCLIB match",
          lyrNoVersions: "LRCLIB has no other versions of this song",
          lyrSynced: "time-synced",
          lyrPlain: "plain text",
          karaoke: "Karaoke word by word",
          karaokeHint: "Words light up one after another \u2013 exact with Spotify syllable timing, otherwise estimated",
          font: "Font",
          fontHint: "Applies to all of Spotify",
          font_outfit: "Outfit",
          font_jakarta: "Jakarta",
          font_manrope: "Manrope",
          font_sora: "Sora",
          font_lexend: "Lexend",
          font_nunito: "Nunito",
          font_system: "System",
          shareMonth: "Your month in colours",
          monthKicker: "Mirage \xB7 last 30 days",
          monthTitle: "Your month in colours",
          monthDays: "days",
          monthDaily: "Listening time per day",
          monthSongs: "Top songs",
          trToggle: "Translation",
          trShow: "Show translation",
          trHide: "Hide translation",
          party_rave: "Rave",
          party_rock: "Rock",
          party_pop: "Pop",
          tabMix: "Mix",
          tabParty: "Party",
          party_auto: "Auto",
          party_bass: "Bass",
          party_chill: "Chill",
          partySection: "Party mode",
          partySectionHint: "Auto picks a style for each song from the artist's genres, tempo and loudness",
          partyLevel: "Intensity",
          partyLevel1: "Soft",
          partyLevel2: "Normal",
          partyLevel3: "Max",
          partyFlash: "Colour flashes",
          partyFlashHint: "Soft colour washes on the beat, never more than a few per second. Off with reduced motion",
          scanCode: "Scan in Spotify",
          partyJam: "Show Jam guests",
          partyJamHint: "During a Spotify Jam, the profile pictures of everyone in it (you too) float at the edges",
          jamYou: "You"
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
          k_view: "Cover \xB7 Liedtext \xB7 Visualizer \xB7 Mix \xB7 Party",
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
          k_queue: "Als N\xE4chstes",
          overlayDownload: "Overlay-App herunterladen",
          overlayAllDownloads: "Alle Downloads",
          overlayConnected: "\u25CF Overlay verbunden",
          overlayMissing: "\u25CB Overlay l\xE4uft nicht \u2013 mit dem Knopf unten installieren und einmal starten",
          onlineLyrics: "Liedtext online suchen",
          onlineLyricsHint: "Hat Spotify keinen, fragt Mirage bei LRCLIB \u2013 daf\xFCr gehen nur Titel, K\xFCnstler, Album und L\xE4nge raus",
          emptyTitle: "Kein Liedtext f\xFCr diesen Song",
          emptyText: "Weder Spotify noch LRCLIB haben ihn bisher.",
          emptyTextOff: "Spotify hat keinen. Schalte in den Einstellungen \u201ELiedtext online suchen\u201C ein, um weiter zu suchen.",
          instrTitle: "Instrumental",
          instrText: "Keine Worte \u2013 einfach die Musik laufen lassen.",
          showViz: "Visualizer zeigen",
          searchWeb: "Im Netz suchen",
          lyrPick: "Fassung w\xE4hlen",
          lyrPicked: "gew\xE4hlt",
          lyrNone: "Kein Liedtext",
          lyrAuto: "Automatisch",
          lyrAutoHint: "Erst Spotify, dann der beste LRCLIB-Treffer",
          lyrNoVersions: "LRCLIB hat keine weiteren Fassungen dieses Songs",
          lyrSynced: "zeitgenau",
          lyrPlain: "nur Text",
          karaoke: "Karaoke Wort f\xFCr Wort",
          karaokeHint: "W\xF6rter leuchten nacheinander auf \u2013 mit Spotify-Silbenzeiten genau, sonst gesch\xE4tzt",
          font: "Schrift",
          fontHint: "Gilt f\xFCr ganz Spotify",
          font_outfit: "Outfit",
          font_jakarta: "Jakarta",
          font_manrope: "Manrope",
          font_sora: "Sora",
          font_lexend: "Lexend",
          font_nunito: "Nunito",
          font_system: "System",
          shareMonth: "Dein Monat in Farben",
          monthKicker: "Mirage \xB7 letzte 30 Tage",
          monthTitle: "Dein Monat in Farben",
          monthDays: "Tage",
          monthDaily: "H\xF6rzeit pro Tag",
          monthSongs: "Top-Songs",
          trToggle: "\xDCbersetzung",
          trShow: "\xDCbersetzung einblenden",
          trHide: "\xDCbersetzung ausblenden",
          party_rave: "Rave",
          party_rock: "Rock",
          party_pop: "Pop",
          tabMix: "Mix",
          tabParty: "Party",
          party_auto: "Auto",
          party_bass: "Bass",
          party_chill: "Chill",
          partySection: "Party-Modus",
          partySectionHint: "Auto w\xE4hlt pro Song einen Stil aus Genre, Tempo und Lautheit",
          partyLevel: "St\xE4rke",
          partyLevel1: "Sanft",
          partyLevel2: "Normal",
          partyLevel3: "Maximal",
          partyFlash: "Farbblitze",
          partyFlashHint: "Weiche Farbfl\xE4chen im Takt, h\xF6chstens wenige pro Sekunde. Aus bei \u201EWeniger Bewegung\u201C",
          scanCode: "In Spotify scannen",
          partyJam: "Jam-G\xE4ste zeigen",
          partyJamHint: "L\xE4uft ein Spotify-Jam, schweben die Profilbilder aller Teilnehmer (auch deins) am Rand",
          jamYou: "Du"
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
          tip: "Mode immersif : Ctrl + Maj + M ou le bouton rond en haut. \xC0 l'int\xE9rieur, 1 \xB7 2 \xB7 3 changent la vue.",
          vizSection: "Visualiseur",
          vizSectionHint: "Apparence du visualiseur en mode immersif \u2013 appliqu\xE9 en direct",
          viz_bars: "Barres",
          viz_wave: "Onde",
          viz_dots: "Points",
          vizBars: "Nombre de barres",
          vizHeight: "Hauteur",
          vizSmooth: "Fluidit\xE9",
          vizGlow: "Lueur",
          vizRings: "Anneaux en rythme",
          vizMirror: "En miroir",
          vizSpin: "Rotation lente",
          scheme: "Palette de couleurs",
          schemeHint: "Change aussit\xF4t \u2013 Mirage suit la pochette en direct",
          glass: "Vrai verre",
          glassHint: "Floute en direct derri\xE8re chaque panneau \u2013 plus \xE9l\xE9gant, mais tr\xE8s gourmand",
          c_shuffle: "Al\xE9atoire (S)",
          c_repeat: "R\xE9p\xE9ter (R)",
          c_like: "J'aime (L)",
          c_mute: "Muet",
          c_full: "Plein \xE9cran (F)",
          c_volume: "Volume (\u2191 \u2193)",
          presetTitle: "Apparence & performances",
          presetHint: "Un clic r\xE8gle tout \u2013 ajuste en dessous",
          preset_full: "Complet",
          preset_balanced: "\xC9quilibr\xE9",
          preset_light: "L\xE9ger",
          preset_calm: "Calme",
          presetCustom: "Personnalis\xE9 \u2013 tu as modifi\xE9 des r\xE9glages",
          perfStepped: "Mirage tournait ici \xE0 {fps} fps et est pass\xE9 \xE0 \xAB {preset} \xBB pour rester fluide.",
          autoPerf: "Adapter automatiquement",
          autoPerfHint: "Descend d'un niveau si ton PC ne suit pas",
          costly: "Consomme performances et batterie",
          safeMode: "Spotify {v} a chang\xE9 sa structure \u2013 Mirage est pass\xE9 en mode sans \xE9chec (couleurs uniquement). Une mise \xE0 jour de Mirage corrigera cela.",
          share: "Partager en image",
          shareNow: "Partager le titre en cours",
          shareWeek: "Ta semaine en couleurs",
          shareCopied: "Image copi\xE9e \u2013 et enregistr\xE9e dans T\xE9l\xE9chargements",
          shareSaved: "Image enregistr\xE9e dans T\xE9l\xE9chargements",
          weekKicker: "Mirage \xB7 7 derniers jours",
          weekTitle: "Ta semaine en couleurs",
          weekSongs: "titres",
          weekMinutes: "minutes",
          weekColours: "Couleurs de tes pochettes",
          weekArtists: "Les plus \xE9cout\xE9s",
          weekEmpty: "\xC9coute quelques titres \u2013 ta semaine va se remplir.",
          weekScheme: "Palette pr\xE9f\xE9r\xE9e : {s}",
          keysTitle: "Raccourcis clavier",
          k_play: "Lecture / pause",
          k_seek: "Avancer/reculer de 5 s",
          k_vol: "Volume",
          k_view: "Pochette \xB7 paroles \xB7 visualiseur \xB7 Mix \xB7 F\xEAte",
          k_like: "J'aime",
          k_shuffle: "Al\xE9atoire",
          k_repeat: "R\xE9p\xE9ter",
          k_full: "Plein \xE9cran",
          k_next: "Suivant / pr\xE9c\xE9dent",
          k_close: "Fermer",
          unsynced: "Ces paroles ne sont pas synchronis\xE9es \u2013 elles d\xE9filent librement.",
          g_colours: "Couleurs",
          g_background: "Arri\xE8re-plan",
          g_motion: "Animations",
          g_immersive: "Mode immersif",
          g_builder: "Cr\xE9e ta propre palette",
          g_overlay: "Overlay",
          g_more: "Partage, sauvegarde & aide",
          freeze: "Figer les couleurs",
          freezeHint: "Garde les couleurs actuelles, quoi qu'il joue",
          pinAlbum: "Retenir les couleurs de cet album",
          unpinAlbum: "Oublier les couleurs de cet album",
          pinnedAlbum: "Cet album aura d\xE9sormais toujours ces couleurs",
          unpinnedAlbum: "Couleurs de l'album oubli\xE9es",
          playlistSchemeOn: "Utiliser \xAB {s} \xBB pour cette playlist",
          playlistSchemeOff: "La playlist utilise \xAB {s} \xBB \u2013 retirer",
          lyrSize: "Taille des paroles",
          lyrGap: "Interligne",
          translate: "Traduire les paroles",
          translateHint: "Affiche une traduction sous chaque ligne \u2013 les lignes sont envoy\xE9es \xE0 Google Traduction",
          canvas: "Vid\xE9os Canvas",
          canvasHint: "Les courtes vid\xE9os en boucle de Spotify derri\xE8re la pochette, si disponibles",
          viz_particles: "Particules",
          viz_line: "Ligne",
          viz_bottom: "Barres en bas",
          c_base: "Arri\xE8re-plan",
          c_accent: "Accent",
          c_deep: "Fonc\xE9",
          c_light: "Clair",
          schemeName: "Nom de ta palette",
          schemeCodeHint: "Colle un code de palette ici pour l'importer",
          schemeSave: "Enregistrer la palette",
          schemeCopy: "Copier en code",
          schemeImport: "Importer le code",
          schemeNameTaken: "Choisis un nom qui n'est pas celui d'une palette int\xE9gr\xE9e",
          schemeDelete: "Supprimer la palette",
          copied: "Copi\xE9",
          badCode: "Ce code ne semble pas valide",
          settingsCodeHint: "Colle un code de r\xE9glages ici pour l'importer",
          exportSettings: "Copier les r\xE9glages",
          importSettings: "Importer les r\xE9glages",
          diagnostics: "Copier le diagnostic",
          reset: "R\xE9initialiser",
          resetConfirm: "R\xE9initialiser tous les r\xE9glages de Mirage ? Tes palettes et couleurs retenues sont conserv\xE9es.",
          welcomeTitle: "Bienvenue dans Mirage",
          welcomeText: "Ctrl + Maj + M ouvre le mode immersif. Les r\xE9glages sont dans le menu de ton profil.",
          welcomeImmersive: "Essayer le mode immersif",
          c_smart: "Smart Shuffle (S)",
          c_queue: "\xC0 suivre (Q)",
          c_devices: "Appareils",
          c_timer: "Minuteur de veille",
          queueEmpty: "File d'attente vide",
          devicesNone: "Aucun autre appareil trouv\xE9",
          deviceActive: "Lecture ici",
          timerTrack: "Fin de ce titre",
          timerOff: "D\xE9sactiv\xE9",
          timerLeft: "encore {m} min",
          k_queue: "\xC0 suivre",
          overlayDownload: "T\xE9l\xE9charger l'app Overlay",
          overlayAllDownloads: "Tous les t\xE9l\xE9chargements",
          overlayConnected: "\u25CF Overlay connect\xE9",
          overlayMissing: "\u25CB Overlay inactif \u2013 installe-le avec le bouton ci-dessous, puis lance-le une fois",
          onlineLyrics: "Chercher les paroles en ligne",
          onlineLyricsHint: "Si Spotify n'en a pas, Mirage interroge LRCLIB \u2013 seuls le titre, l'artiste, l'album et la dur\xE9e sont envoy\xE9s",
          emptyTitle: "Pas de paroles pour ce titre",
          emptyText: "Ni Spotify ni LRCLIB n'ont encore de paroles pour ce titre.",
          emptyTextOff: "Spotify n'en a pas. Active \xAB Chercher les paroles en ligne \xBB dans les r\xE9glages pour aller plus loin.",
          instrTitle: "Instrumental",
          instrText: "Pas de paroles \u2013 laisse simplement la musique jouer.",
          showViz: "Afficher le visualiseur",
          searchWeb: "Chercher sur le web",
          lyrPick: "Choisir la version",
          lyrPicked: "choisie",
          lyrNone: "Pas de paroles",
          lyrAuto: "Automatique",
          lyrAutoHint: "D'abord Spotify, puis le meilleur r\xE9sultat LRCLIB",
          lyrNoVersions: "LRCLIB n'a pas d'autre version de ce titre",
          lyrSynced: "synchronis\xE9es",
          lyrPlain: "texte seul",
          karaoke: "Karaok\xE9 mot \xE0 mot",
          karaokeHint: "Les mots s'allument l'un apr\xE8s l'autre \u2013 pr\xE9cis avec le timing des syllabes de Spotify, sinon estim\xE9",
          font: "Police",
          fontHint: "S'applique \xE0 tout Spotify",
          font_outfit: "Outfit",
          font_jakarta: "Jakarta",
          font_manrope: "Manrope",
          font_sora: "Sora",
          font_lexend: "Lexend",
          font_nunito: "Nunito",
          font_system: "Syst\xE8me",
          shareMonth: "Ton mois en couleurs",
          monthKicker: "Mirage \xB7 30 derniers jours",
          monthTitle: "Ton mois en couleurs",
          monthDays: "jours",
          monthDaily: "Temps d'\xE9coute par jour",
          monthSongs: "Top titres",
          trToggle: "Traduction",
          trShow: "Afficher la traduction",
          trHide: "Masquer la traduction",
          party_rave: "Rave",
          party_rock: "Rock",
          party_pop: "Pop",
          tabMix: "Mix",
          tabParty: "F\xEAte",
          party_auto: "Auto",
          party_bass: "Basses",
          party_chill: "Chill",
          partySection: "Mode f\xEAte",
          partySectionHint: "Auto choisit un style par titre selon le genre, le tempo et le volume",
          partyLevel: "Intensit\xE9",
          partyLevel1: "Douce",
          partyLevel2: "Normale",
          partyLevel3: "Max",
          partyFlash: "Flashs de couleur",
          partyFlashHint: "Douces vagues de couleur en rythme, jamais plus de quelques-unes par seconde. D\xE9sactiv\xE9 avec \xAB r\xE9duire les animations \xBB",
          scanCode: "Scanner dans Spotify",
          partyJam: "Afficher les invit\xE9s du Jam",
          partyJamHint: "Pendant un Jam Spotify, les photos de profil de tous les participants (toi aussi) flottent sur les bords",
          jamYou: "Toi"
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
          tip: "Modo inmersivo: Ctrl + May\xFAs + M o el bot\xF3n redondo de arriba. Dentro, 1 \xB7 2 \xB7 3 cambian la vista.",
          vizSection: "Visualizador",
          vizSectionHint: "Aspecto del visualizador en modo inmersivo \u2013 se aplica al instante",
          viz_bars: "Barras",
          viz_wave: "Onda",
          viz_dots: "Puntos",
          vizBars: "N\xFAmero de barras",
          vizHeight: "Altura",
          vizSmooth: "Suavidad",
          vizGlow: "Brillo",
          vizRings: "Anillos al ritmo",
          vizMirror: "En espejo",
          vizSpin: "Rotaci\xF3n lenta",
          scheme: "Esquema de colores",
          schemeHint: "Cambia al instante \u2013 Mirage sigue la portada en directo",
          glass: "Cristal real",
          glassHint: "Desenfoca en directo detr\xE1s de cada panel \u2013 m\xE1s elegante, pero consume mucho rendimiento",
          c_shuffle: "Aleatorio (S)",
          c_repeat: "Repetir (R)",
          c_like: "Me gusta (L)",
          c_mute: "Silenciar",
          c_full: "Pantalla completa (F)",
          c_volume: "Volumen (\u2191 \u2193)",
          presetTitle: "Aspecto y rendimiento",
          presetHint: "Un clic lo ajusta todo \u2013 afina abajo",
          preset_full: "Completo",
          preset_balanced: "Equilibrado",
          preset_light: "Ligero",
          preset_calm: "Tranquilo",
          presetCustom: "Personalizado \u2013 has cambiado algunos interruptores",
          perfStepped: "Mirage iba aqu\xED a {fps} fps y ha cambiado a \xAB{preset}\xBB para mantenerse fluido.",
          autoPerf: "Ajustar autom\xE1ticamente",
          autoPerfHint: "Baja un nivel si tu PC no da abasto",
          costly: "Consume rendimiento y bater\xEDa",
          safeMode: "Spotify {v} ha cambiado su estructura \u2013 Mirage est\xE1 en modo seguro (solo colores). Una actualizaci\xF3n de Mirage lo soluciona.",
          share: "Compartir como imagen",
          shareNow: "Compartir lo que suena",
          shareWeek: "Tu semana en colores",
          shareCopied: "Imagen copiada \u2013 y guardada en Descargas",
          shareSaved: "Imagen guardada en Descargas",
          weekKicker: "Mirage \xB7 \xFAltimos 7 d\xEDas",
          weekTitle: "Tu semana en colores",
          weekSongs: "canciones",
          weekMinutes: "minutos",
          weekColours: "Colores de tus portadas",
          weekArtists: "Lo m\xE1s escuchado",
          weekEmpty: "Escucha algunas canciones \u2013 tu semana se ir\xE1 llenando.",
          weekScheme: "Esquema favorito: {s}",
          keysTitle: "Atajos de teclado",
          k_play: "Reproducir / pausar",
          k_seek: "Saltar 5 s",
          k_vol: "Volumen",
          k_view: "Portada \xB7 letra \xB7 visualizador \xB7 Mezcla \xB7 Fiesta",
          k_like: "Me gusta",
          k_shuffle: "Aleatorio",
          k_repeat: "Repetir",
          k_full: "Pantalla completa",
          k_next: "Siguiente / anterior",
          k_close: "Cerrar",
          unsynced: "Esta letra no est\xE1 sincronizada \u2013 se desplaza libremente.",
          g_colours: "Colores",
          g_background: "Fondo",
          g_motion: "Animaciones",
          g_immersive: "Modo inmersivo",
          g_builder: "Crea tu propio esquema",
          g_overlay: "Overlay",
          g_more: "Compartir, copia de seguridad y ayuda",
          freeze: "Congelar colores",
          freezeHint: "Mantiene los colores actuales, suene lo que suene",
          pinAlbum: "Recordar los colores de este \xE1lbum",
          unpinAlbum: "Olvidar los colores de este \xE1lbum",
          pinnedAlbum: "Este \xE1lbum tendr\xE1 siempre estos colores",
          unpinnedAlbum: "Colores del \xE1lbum olvidados",
          playlistSchemeOn: "Usar \xAB{s}\xBB para esta playlist",
          playlistSchemeOff: "La playlist usa \xAB{s}\xBB \u2013 quitar",
          lyrSize: "Tama\xF1o de la letra",
          lyrGap: "Interlineado",
          translate: "Traducir la letra",
          translateHint: "Muestra una traducci\xF3n bajo cada l\xEDnea \u2013 las l\xEDneas se env\xEDan a Google Translate",
          canvas: "V\xEDdeos Canvas",
          canvasHint: "Los v\xEDdeos cortos en bucle de Spotify detr\xE1s de la portada, cuando los hay",
          viz_particles: "Part\xEDculas",
          viz_line: "L\xEDnea",
          viz_bottom: "Barras abajo",
          c_base: "Fondo",
          c_accent: "Acento",
          c_deep: "Oscuro",
          c_light: "Claro",
          schemeName: "Nombre de tu esquema",
          schemeCodeHint: "Pega aqu\xED un c\xF3digo de esquema para importarlo",
          schemeSave: "Guardar esquema",
          schemeCopy: "Copiar como c\xF3digo",
          schemeImport: "Importar c\xF3digo",
          schemeNameTaken: "Ponle un nombre que no sea de un esquema incluido",
          schemeDelete: "Eliminar esquema",
          copied: "Copiado",
          badCode: "Ese c\xF3digo no parece correcto",
          settingsCodeHint: "Pega aqu\xED un c\xF3digo de ajustes para importarlo",
          exportSettings: "Copiar ajustes",
          importSettings: "Importar ajustes",
          diagnostics: "Copiar diagn\xF3stico",
          reset: "Restablecer",
          resetConfirm: "\xBFRestablecer todos los ajustes de Mirage? Tus esquemas y colores recordados se conservan.",
          welcomeTitle: "Te damos la bienvenida a Mirage",
          welcomeText: "Ctrl + May\xFAs + M abre el modo inmersivo. Los ajustes est\xE1n en el men\xFA de tu perfil.",
          welcomeImmersive: "Probar el modo inmersivo",
          c_smart: "Smart Shuffle (S)",
          c_queue: "A continuaci\xF3n (Q)",
          c_devices: "Dispositivos",
          c_timer: "Temporizador",
          queueEmpty: "No hay nada en la cola",
          devicesNone: "No se encontraron otros dispositivos",
          deviceActive: "Sonando aqu\xED",
          timerTrack: "Final de esta canci\xF3n",
          timerOff: "Desactivado",
          timerLeft: "quedan {m} min",
          k_queue: "A continuaci\xF3n",
          overlayDownload: "Descargar la app Overlay",
          overlayAllDownloads: "Todas las descargas",
          overlayConnected: "\u25CF Overlay conectado",
          overlayMissing: "\u25CB Overlay no est\xE1 en marcha \u2013 inst\xE1lalo con el bot\xF3n de abajo y \xE1brelo una vez",
          onlineLyrics: "Buscar letras en l\xEDnea",
          onlineLyricsHint: "Si Spotify no tiene, Mirage consulta LRCLIB \u2013 solo se env\xEDan t\xEDtulo, artista, \xE1lbum y duraci\xF3n",
          emptyTitle: "No hay letra para esta canci\xF3n",
          emptyText: "Ni Spotify ni LRCLIB tienen todav\xEDa su letra.",
          emptyTextOff: "Spotify no tiene. Activa \xABBuscar letras en l\xEDnea\xBB en los ajustes para buscar m\xE1s.",
          instrTitle: "Instrumental",
          instrText: "Sin palabras \u2013 deja que suene la m\xFAsica.",
          showViz: "Mostrar visualizador",
          searchWeb: "Buscar en la web",
          lyrPick: "Elegir versi\xF3n",
          lyrPicked: "elegida",
          lyrNone: "Sin letra",
          lyrAuto: "Autom\xE1tico",
          lyrAutoHint: "Primero Spotify, luego el mejor resultado de LRCLIB",
          lyrNoVersions: "LRCLIB no tiene otras versiones de esta canci\xF3n",
          lyrSynced: "sincronizada",
          lyrPlain: "solo texto",
          karaoke: "Karaoke palabra por palabra",
          karaokeHint: "Las palabras se iluminan una tras otra \u2013 exacto con los tiempos de s\xEDlabas de Spotify, si no, estimado",
          font: "Fuente",
          fontHint: "Se aplica a todo Spotify",
          font_outfit: "Outfit",
          font_jakarta: "Jakarta",
          font_manrope: "Manrope",
          font_sora: "Sora",
          font_lexend: "Lexend",
          font_nunito: "Nunito",
          font_system: "Sistema",
          shareMonth: "Tu mes en colores",
          monthKicker: "Mirage \xB7 \xFAltimos 30 d\xEDas",
          monthTitle: "Tu mes en colores",
          monthDays: "d\xEDas",
          monthDaily: "Tiempo de escucha por d\xEDa",
          monthSongs: "Canciones top",
          trToggle: "Traducci\xF3n",
          trShow: "Mostrar traducci\xF3n",
          trHide: "Ocultar traducci\xF3n",
          party_rave: "Rave",
          party_rock: "Rock",
          party_pop: "Pop",
          tabMix: "Mezcla",
          tabParty: "Fiesta",
          party_auto: "Auto",
          party_bass: "Bajos",
          party_chill: "Chill",
          partySection: "Modo fiesta",
          partySectionHint: "Auto elige un estilo por canci\xF3n seg\xFAn el g\xE9nero, el tempo y el volumen",
          partyLevel: "Intensidad",
          partyLevel1: "Suave",
          partyLevel2: "Normal",
          partyLevel3: "M\xE1x.",
          partyFlash: "Destellos de color",
          partyFlashHint: "Suaves r\xE1fagas de color al ritmo, nunca m\xE1s de unas pocas por segundo. Desactivado con \xABreducir movimiento\xBB",
          scanCode: "Escanear en Spotify",
          partyJam: "Mostrar invitados del Jam",
          partyJamHint: "Durante un Jam de Spotify, las fotos de perfil de todos los participantes (t\xFA tambi\xE9n) flotan en los bordes",
          jamYou: "T\xFA"
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
          tip: "Modalit\xE0 immersiva: Ctrl + Maiusc + M o il pulsante rotondo in alto. All'interno 1 \xB7 2 \xB7 3 cambiano vista.",
          vizSection: "Visualizzatore",
          vizSectionHint: "Aspetto del visualizzatore in modalit\xE0 immersiva \u2013 si applica subito",
          viz_bars: "Barre",
          viz_wave: "Onda",
          viz_dots: "Punti",
          vizBars: "Numero di barre",
          vizHeight: "Altezza",
          vizSmooth: "Morbidezza",
          vizGlow: "Bagliore",
          vizRings: "Anelli a ritmo",
          vizMirror: "Speculare",
          vizSpin: "Rotazione lenta",
          scheme: "Schema colori",
          schemeHint: "Cambia subito \u2013 Mirage segue la copertina in tempo reale",
          glass: "Vetro reale",
          glassHint: "Sfoca in tempo reale dietro ogni pannello \u2013 pi\xF9 elegante, ma pesa molto sulle prestazioni",
          c_shuffle: "Casuale (S)",
          c_repeat: "Ripeti (R)",
          c_like: "Mi piace (L)",
          c_mute: "Muto",
          c_full: "Schermo intero (F)",
          c_volume: "Volume (\u2191 \u2193)",
          presetTitle: "Aspetto e prestazioni",
          presetHint: "Un clic imposta tutto \u2013 rifinisci qui sotto",
          preset_full: "Completo",
          preset_balanced: "Bilanciato",
          preset_light: "Leggero",
          preset_calm: "Calmo",
          presetCustom: "Personalizzato \u2013 hai cambiato singole opzioni",
          perfStepped: "Qui Mirage girava a {fps} fps ed \xE8 passato a \u201C{preset}\u201D per restare fluido.",
          autoPerf: "Adatta automaticamente",
          autoPerfHint: "Scende di un livello se il PC non sta al passo",
          costly: "Consuma prestazioni e batteria",
          safeMode: "Spotify {v} ha cambiato struttura \u2013 Mirage \xE8 passato in modalit\xE0 sicura (solo colori). Un aggiornamento di Mirage risolve il problema.",
          share: "Condividi come immagine",
          shareNow: "Condividi il brano in riproduzione",
          shareWeek: "La tua settimana a colori",
          shareCopied: "Immagine copiata \u2013 e salvata in Download",
          shareSaved: "Immagine salvata in Download",
          weekKicker: "Mirage \xB7 ultimi 7 giorni",
          weekTitle: "La tua settimana a colori",
          weekSongs: "brani",
          weekMinutes: "minuti",
          weekColours: "Colori delle tue copertine",
          weekArtists: "I pi\xF9 ascoltati",
          weekEmpty: "Ascolta qualche brano \u2013 la tua settimana si riempir\xE0.",
          weekScheme: "Schema preferito: {s}",
          keysTitle: "Scorciatoie da tastiera",
          k_play: "Riproduci / pausa",
          k_seek: "Salta di 5 s",
          k_vol: "Volume",
          k_view: "Copertina \xB7 testo \xB7 visualizzatore \xB7 Mix \xB7 Festa",
          k_like: "Mi piace",
          k_shuffle: "Casuale",
          k_repeat: "Ripeti",
          k_full: "Schermo intero",
          k_next: "Successivo / precedente",
          k_close: "Chiudi",
          unsynced: "Questo testo non \xE8 sincronizzato \u2013 scorre liberamente.",
          g_colours: "Colori",
          g_background: "Sfondo",
          g_motion: "Animazioni",
          g_immersive: "Modalit\xE0 immersiva",
          g_builder: "Crea il tuo schema",
          g_overlay: "Overlay",
          g_more: "Condividi, backup e aiuto",
          freeze: "Blocca i colori",
          freezeHint: "Mantiene i colori attuali, qualunque cosa suoni",
          pinAlbum: "Ricorda i colori di questo album",
          unpinAlbum: "Dimentica i colori di questo album",
          pinnedAlbum: "Questo album avr\xE0 sempre questi colori",
          unpinnedAlbum: "Colori dell'album dimenticati",
          playlistSchemeOn: "Usa \u201C{s}\u201D per questa playlist",
          playlistSchemeOff: "La playlist usa \u201C{s}\u201D \u2013 rimuovi",
          lyrSize: "Dimensione del testo",
          lyrGap: "Interlinea",
          translate: "Traduci il testo",
          translateHint: "Mostra una traduzione sotto ogni riga \u2013 le righe vengono inviate a Google Traduttore",
          canvas: "Video Canvas",
          canvasHint: "I brevi video in loop di Spotify dietro la copertina, dove disponibili",
          viz_particles: "Particelle",
          viz_line: "Linea",
          viz_bottom: "Barre in basso",
          c_base: "Sfondo",
          c_accent: "Accento",
          c_deep: "Scuro",
          c_light: "Chiaro",
          schemeName: "Nome del tuo schema",
          schemeCodeHint: "Incolla qui un codice schema per importarlo",
          schemeSave: "Salva schema",
          schemeCopy: "Copia come codice",
          schemeImport: "Importa codice",
          schemeNameTaken: "Scegli un nome diverso da quello di uno schema integrato",
          schemeDelete: "Elimina schema",
          copied: "Copiato",
          badCode: "Questo codice non sembra corretto",
          settingsCodeHint: "Incolla qui un codice impostazioni per importarlo",
          exportSettings: "Copia impostazioni",
          importSettings: "Importa impostazioni",
          diagnostics: "Copia diagnostica",
          reset: "Ripristina",
          resetConfirm: "Ripristinare tutte le impostazioni di Mirage? I tuoi schemi e i colori memorizzati restano.",
          welcomeTitle: "Benvenuto in Mirage",
          welcomeText: "Ctrl + Maiusc + M apre la modalit\xE0 immersiva. Le impostazioni sono nel menu del profilo.",
          welcomeImmersive: "Prova la modalit\xE0 immersiva",
          c_smart: "Smart Shuffle (S)",
          c_queue: "In coda (Q)",
          c_devices: "Dispositivi",
          c_timer: "Timer di spegnimento",
          queueEmpty: "Niente in coda",
          devicesNone: "Nessun altro dispositivo trovato",
          deviceActive: "In riproduzione qui",
          timerTrack: "Fine di questo brano",
          timerOff: "Disattivato",
          timerLeft: "ancora {m} min",
          k_queue: "In coda",
          overlayDownload: "Scarica l'app Overlay",
          overlayAllDownloads: "Tutti i download",
          overlayConnected: "\u25CF Overlay connesso",
          overlayMissing: "\u25CB Overlay non in esecuzione \u2013 installalo con il pulsante qui sotto e avvialo una volta",
          onlineLyrics: "Cerca testi online",
          onlineLyricsHint: "Se Spotify non ne ha, Mirage chiede a LRCLIB \u2013 vengono inviati solo titolo, artista, album e durata",
          emptyTitle: "Nessun testo per questo brano",
          emptyText: "N\xE9 Spotify n\xE9 LRCLIB hanno ancora il testo.",
          emptyTextOff: "Spotify non ne ha. Attiva \u201CCerca testi online\u201D nelle impostazioni per cercare oltre.",
          instrTitle: "Strumentale",
          instrText: "Niente parole \u2013 lascia suonare la musica.",
          showViz: "Mostra visualizzatore",
          searchWeb: "Cerca sul web",
          lyrPick: "Scegli versione",
          lyrPicked: "scelta",
          lyrNone: "Nessun testo",
          lyrAuto: "Automatico",
          lyrAutoHint: "Prima Spotify, poi il miglior risultato di LRCLIB",
          lyrNoVersions: "LRCLIB non ha altre versioni di questo brano",
          lyrSynced: "sincronizzato",
          lyrPlain: "solo testo",
          karaoke: "Karaoke parola per parola",
          karaokeHint: "Le parole si illuminano una dopo l'altra \u2013 precise con i tempi delle sillabe di Spotify, altrimenti stimate",
          font: "Carattere",
          fontHint: "Vale per tutto Spotify",
          font_outfit: "Outfit",
          font_jakarta: "Jakarta",
          font_manrope: "Manrope",
          font_sora: "Sora",
          font_lexend: "Lexend",
          font_nunito: "Nunito",
          font_system: "Sistema",
          shareMonth: "Il tuo mese a colori",
          monthKicker: "Mirage \xB7 ultimi 30 giorni",
          monthTitle: "Il tuo mese a colori",
          monthDays: "giorni",
          monthDaily: "Tempo di ascolto al giorno",
          monthSongs: "Brani top",
          trToggle: "Traduzione",
          trShow: "Mostra traduzione",
          trHide: "Nascondi traduzione",
          party_rave: "Rave",
          party_rock: "Rock",
          party_pop: "Pop",
          tabMix: "Mix",
          tabParty: "Festa",
          party_auto: "Auto",
          party_bass: "Bassi",
          party_chill: "Chill",
          partySection: "Modalit\xE0 festa",
          partySectionHint: "Auto sceglie uno stile per ogni brano in base a genere, tempo e volume",
          partyLevel: "Intensit\xE0",
          partyLevel1: "Leggera",
          partyLevel2: "Normale",
          partyLevel3: "Max",
          partyFlash: "Lampi di colore",
          partyFlashHint: "Morbide ondate di colore a tempo, mai pi\xF9 di poche al secondo. Disattivati con \xABriduci movimento\xBB",
          scanCode: "Scansiona in Spotify",
          partyJam: "Mostra gli ospiti del Jam",
          partyJamHint: "Durante un Jam di Spotify, le foto profilo di tutti i partecipanti (anche la tua) fluttuano ai bordi",
          jamYou: "Tu"
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
          tip: "Modo imersivo: Ctrl + Shift + M ou o bot\xE3o redondo no topo. Dentro, 1 \xB7 2 \xB7 3 trocam a vis\xE3o.",
          vizSection: "Visualizador",
          vizSectionHint: "Apar\xEAncia do visualizador no modo imersivo \u2013 aplica na hora",
          viz_bars: "Barras",
          viz_wave: "Onda",
          viz_dots: "Pontos",
          vizBars: "N\xFAmero de barras",
          vizHeight: "Altura",
          vizSmooth: "Suavidade",
          vizGlow: "Brilho",
          vizRings: "An\xE9is na batida",
          vizMirror: "Espelhado",
          vizSpin: "Rota\xE7\xE3o lenta",
          scheme: "Esquema de cores",
          schemeHint: "Muda na hora \u2013 o Mirage acompanha a capa ao vivo",
          glass: "Vidro real",
          glassHint: "Desfoca ao vivo atr\xE1s de cada painel \u2013 mais bonito, mas pesa bastante no desempenho",
          c_shuffle: "Aleat\xF3rio (S)",
          c_repeat: "Repetir (R)",
          c_like: "Curtir (L)",
          c_mute: "Sem som",
          c_full: "Tela cheia (F)",
          c_volume: "Volume (\u2191 \u2193)",
          presetTitle: "Apar\xEAncia e desempenho",
          presetHint: "Um clique ajusta tudo \u2013 refine abaixo",
          preset_full: "Completo",
          preset_balanced: "Equilibrado",
          preset_light: "Leve",
          preset_calm: "Calmo",
          presetCustom: "Personalizado \u2013 voc\xEA alterou op\xE7\xF5es individuais",
          perfStepped: "O Mirage estava rodando a {fps} fps aqui e mudou para \u201C{preset}\u201D para continuar fluido.",
          autoPerf: "Ajustar automaticamente",
          autoPerfHint: "Desce um n\xEDvel se o seu PC n\xE3o der conta",
          costly: "Consome desempenho e bateria",
          safeMode: "O Spotify {v} mudou sua estrutura \u2013 o Mirage entrou no modo seguro (s\xF3 cores). Uma atualiza\xE7\xE3o do Mirage resolve isso.",
          share: "Compartilhar como imagem",
          shareNow: "Compartilhar o que est\xE1 tocando",
          shareWeek: "Sua semana em cores",
          shareCopied: "Imagem copiada \u2013 e salva em Downloads",
          shareSaved: "Imagem salva em Downloads",
          weekKicker: "Mirage \xB7 \xFAltimos 7 dias",
          weekTitle: "Sua semana em cores",
          weekSongs: "m\xFAsicas",
          weekMinutes: "minutos",
          weekColours: "Cores das suas capas",
          weekArtists: "Mais ouvidos",
          weekEmpty: "Ou\xE7a algumas m\xFAsicas \u2013 sua semana vai se enchendo.",
          weekScheme: "Esquema favorito: {s}",
          keysTitle: "Atalhos de teclado",
          k_play: "Tocar / pausar",
          k_seek: "Pular 5 s",
          k_vol: "Volume",
          k_view: "Capa \xB7 letra \xB7 visualizador \xB7 Mix \xB7 Festa",
          k_like: "Curtir",
          k_shuffle: "Aleat\xF3rio",
          k_repeat: "Repetir",
          k_full: "Tela cheia",
          k_next: "Pr\xF3xima / anterior",
          k_close: "Fechar",
          unsynced: "Esta letra n\xE3o est\xE1 sincronizada \u2013 ela rola livremente.",
          g_colours: "Cores",
          g_background: "Fundo",
          g_motion: "Anima\xE7\xF5es",
          g_immersive: "Modo imersivo",
          g_builder: "Crie seu pr\xF3prio esquema",
          g_overlay: "Overlay",
          g_more: "Compartilhar, backup e ajuda",
          freeze: "Congelar cores",
          freezeHint: "Mant\xE9m as cores atuais, n\xE3o importa o que toque",
          pinAlbum: "Lembrar as cores deste \xE1lbum",
          unpinAlbum: "Esquecer as cores deste \xE1lbum",
          pinnedAlbum: "Este \xE1lbum agora sempre ter\xE1 estas cores",
          unpinnedAlbum: "Cores do \xE1lbum esquecidas",
          playlistSchemeOn: "Usar \u201C{s}\u201D nesta playlist",
          playlistSchemeOff: "A playlist usa \u201C{s}\u201D \u2013 remover",
          lyrSize: "Tamanho da letra",
          lyrGap: "Espa\xE7amento entre linhas",
          translate: "Traduzir letra",
          translateHint: "Mostra uma tradu\xE7\xE3o abaixo de cada linha \u2013 as linhas s\xE3o enviadas ao Google Tradutor",
          canvas: "V\xEDdeos Canvas",
          canvasHint: "Os v\xEDdeos curtos em loop do Spotify atr\xE1s da capa, quando dispon\xEDveis",
          viz_particles: "Part\xEDculas",
          viz_line: "Linha",
          viz_bottom: "Barras embaixo",
          c_base: "Fundo",
          c_accent: "Destaque",
          c_deep: "Escuro",
          c_light: "Claro",
          schemeName: "Nome do seu esquema",
          schemeCodeHint: "Cole um c\xF3digo de esquema aqui para import\xE1-lo",
          schemeSave: "Salvar esquema",
          schemeCopy: "Copiar como c\xF3digo",
          schemeImport: "Importar c\xF3digo",
          schemeNameTaken: "Escolha um nome que n\xE3o seja de um esquema inclu\xEDdo",
          schemeDelete: "Excluir esquema",
          copied: "Copiado",
          badCode: "Esse c\xF3digo n\xE3o parece correto",
          settingsCodeHint: "Cole um c\xF3digo de configura\xE7\xF5es aqui para import\xE1-lo",
          exportSettings: "Copiar configura\xE7\xF5es",
          importSettings: "Importar configura\xE7\xF5es",
          diagnostics: "Copiar diagn\xF3stico",
          reset: "Redefinir",
          resetConfirm: "Redefinir todas as configura\xE7\xF5es do Mirage? Seus esquemas e cores salvas continuam.",
          welcomeTitle: "Boas-vindas ao Mirage",
          welcomeText: "Ctrl + Shift + M abre o modo imersivo. As configura\xE7\xF5es ficam no menu do seu perfil.",
          welcomeImmersive: "Experimentar o modo imersivo",
          c_smart: "Smart Shuffle (S)",
          c_queue: "A seguir (Q)",
          c_devices: "Dispositivos",
          c_timer: "Timer de desligamento",
          queueEmpty: "Nada na fila",
          devicesNone: "Nenhum outro dispositivo encontrado",
          deviceActive: "Tocando aqui",
          timerTrack: "Fim desta m\xFAsica",
          timerOff: "Desligado",
          timerLeft: "faltam {m} min",
          k_queue: "A seguir",
          overlayDownload: "Baixar o app Overlay",
          overlayAllDownloads: "Todos os downloads",
          overlayConnected: "\u25CF Overlay conectado",
          overlayMissing: "\u25CB Overlay n\xE3o est\xE1 rodando \u2013 instale com o bot\xE3o abaixo e abra uma vez",
          onlineLyrics: "Buscar letras online",
          onlineLyricsHint: "Se o Spotify n\xE3o tiver, o Mirage consulta o LRCLIB \u2013 s\xF3 t\xEDtulo, artista, \xE1lbum e dura\xE7\xE3o s\xE3o enviados",
          emptyTitle: "Sem letra para esta m\xFAsica",
          emptyText: "Nem o Spotify nem o LRCLIB t\xEAm a letra ainda.",
          emptyTextOff: "O Spotify n\xE3o tem. Ative \u201CBuscar letras online\u201D nas configura\xE7\xF5es para procurar mais.",
          instrTitle: "Instrumental",
          instrText: "Sem palavras \u2013 s\xF3 deixe a m\xFAsica tocar.",
          showViz: "Mostrar visualizador",
          searchWeb: "Pesquisar na web",
          lyrPick: "Escolher vers\xE3o",
          lyrPicked: "escolhida",
          lyrNone: "Sem letra",
          lyrAuto: "Autom\xE1tico",
          lyrAutoHint: "Primeiro o Spotify, depois o melhor resultado do LRCLIB",
          lyrNoVersions: "O LRCLIB n\xE3o tem outras vers\xF5es desta m\xFAsica",
          lyrSynced: "sincronizada",
          lyrPlain: "s\xF3 texto",
          karaoke: "Karaok\xEA palavra por palavra",
          karaokeHint: "As palavras acendem uma ap\xF3s a outra \u2013 exato com o tempo das s\xEDlabas do Spotify, sen\xE3o estimado",
          font: "Fonte",
          fontHint: "Vale para todo o Spotify",
          font_outfit: "Outfit",
          font_jakarta: "Jakarta",
          font_manrope: "Manrope",
          font_sora: "Sora",
          font_lexend: "Lexend",
          font_nunito: "Nunito",
          font_system: "Sistema",
          shareMonth: "Seu m\xEAs em cores",
          monthKicker: "Mirage \xB7 \xFAltimos 30 dias",
          monthTitle: "Seu m\xEAs em cores",
          monthDays: "dias",
          monthDaily: "Tempo de escuta por dia",
          monthSongs: "M\xFAsicas mais tocadas",
          trToggle: "Tradu\xE7\xE3o",
          trShow: "Mostrar tradu\xE7\xE3o",
          trHide: "Ocultar tradu\xE7\xE3o",
          party_rave: "Rave",
          party_rock: "Rock",
          party_pop: "Pop",
          tabMix: "Mix",
          tabParty: "Festa",
          party_auto: "Auto",
          party_bass: "Grave",
          party_chill: "Chill",
          partySection: "Modo festa",
          partySectionHint: "Auto escolhe um estilo por m\xFAsica a partir do g\xEAnero, do andamento e do volume",
          partyLevel: "Intensidade",
          partyLevel1: "Suave",
          partyLevel2: "Normal",
          partyLevel3: "M\xE1x.",
          partyFlash: "Flashes de cor",
          partyFlashHint: "Ondas suaves de cor no ritmo, nunca mais que algumas por segundo. Desligado com \u201Creduzir movimento\u201D",
          scanCode: "Escanear no Spotify",
          partyJam: "Mostrar convidados do Jam",
          partyJamHint: "Durante um Jam do Spotify, as fotos de perfil de todos os participantes (a sua tamb\xE9m) flutuam nas bordas",
          jamYou: "Voc\xEA"
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
          tip: "Meeslepende modus: Ctrl + Shift + M of de ronde knop bovenaan. Daarin wisselen 1 \xB7 2 \xB7 3 de weergave.",
          vizSection: "Visualizer",
          vizSectionHint: "Uiterlijk van de visualizer in de immersieve modus \u2013 werkt meteen",
          viz_bars: "Balken",
          viz_wave: "Golf",
          viz_dots: "Stippen",
          vizBars: "Aantal balken",
          vizHeight: "Hoogte",
          vizSmooth: "Vloeiendheid",
          vizGlow: "Gloed",
          vizRings: "Ringen op de beat",
          vizMirror: "Gespiegeld",
          vizSpin: "Langzaam draaien",
          scheme: "Kleurenschema",
          schemeHint: "Wisselt direct \u2013 Mirage volgt de hoes live",
          glass: "Echt glas",
          glassHint: "Vervaagt live achter elk paneel \u2013 chiquer, maar kost veel prestaties",
          c_shuffle: "Shuffle (S)",
          c_repeat: "Herhalen (R)",
          c_like: "Liken (L)",
          c_mute: "Dempen",
          c_full: "Volledig scherm (F)",
          c_volume: "Volume (\u2191 \u2193)",
          presetTitle: "Uiterlijk & prestaties",
          presetHint: "E\xE9n klik stelt alles in \u2013 verfijn hieronder",
          preset_full: "Volledig",
          preset_balanced: "Gebalanceerd",
          preset_light: "Licht",
          preset_calm: "Rustig",
          presetCustom: "Aangepast \u2013 je hebt losse schakelaars gewijzigd",
          perfStepped: "Mirage draaide hier op {fps} fps en is overgeschakeld naar \u2018{preset}\u2019 om soepel te blijven.",
          autoPerf: "Automatisch aanpassen",
          autoPerfHint: "Gaat een stap omlaag als je pc het niet bijhoudt",
          costly: "Kost prestaties en accu",
          safeMode: "Spotify {v} heeft zijn opbouw gewijzigd \u2013 Mirage draait in veilige modus (alleen kleuren). Een update van Mirage lost dit op.",
          share: "Delen als afbeelding",
          shareNow: "Huidig nummer delen",
          shareWeek: "Jouw week in kleuren",
          shareCopied: "Afbeelding gekopieerd \u2013 en opgeslagen in Downloads",
          shareSaved: "Afbeelding opgeslagen in Downloads",
          weekKicker: "Mirage \xB7 afgelopen 7 dagen",
          weekTitle: "Jouw week in kleuren",
          weekSongs: "nummers",
          weekMinutes: "minuten",
          weekColours: "Kleuren van je hoezen",
          weekArtists: "Meest beluisterd",
          weekEmpty: "Luister een paar nummers \u2013 je week vult zich vanzelf.",
          weekScheme: "Favoriete schema: {s}",
          keysTitle: "Sneltoetsen",
          k_play: "Afspelen / pauzeren",
          k_seek: "5 s spoelen",
          k_vol: "Volume",
          k_view: "Hoes \xB7 songtekst \xB7 visualizer \xB7 Mix \xB7 Feest",
          k_like: "Liken",
          k_shuffle: "Shuffle",
          k_repeat: "Herhalen",
          k_full: "Volledig scherm",
          k_next: "Volgende / vorige",
          k_close: "Sluiten",
          unsynced: "Deze songtekst is niet gesynchroniseerd \u2013 hij loopt niet mee.",
          g_colours: "Kleuren",
          g_background: "Achtergrond",
          g_motion: "Animaties",
          g_immersive: "Immersieve modus",
          g_builder: "Maak je eigen schema",
          g_overlay: "Overlay",
          g_more: "Delen, back-up & hulp",
          freeze: "Kleuren bevriezen",
          freezeHint: "Houdt de huidige kleuren, wat er ook speelt",
          pinAlbum: "Kleuren van dit album onthouden",
          unpinAlbum: "Kleuren van dit album vergeten",
          pinnedAlbum: "Dit album krijgt nu altijd deze kleuren",
          unpinnedAlbum: "Albumkleuren vergeten",
          playlistSchemeOn: "\u2018{s}\u2019 gebruiken voor deze playlist",
          playlistSchemeOff: "Playlist gebruikt \u2018{s}\u2019 \u2013 verwijderen",
          lyrSize: "Tekstgrootte",
          lyrGap: "Regelafstand",
          translate: "Songtekst vertalen",
          translateHint: "Toont onder elke regel een vertaling \u2013 de regels worden naar Google Translate gestuurd",
          canvas: "Canvas-video's",
          canvasHint: "Spotify's korte video-loops achter de hoes, waar beschikbaar",
          viz_particles: "Deeltjes",
          viz_line: "Lijn",
          viz_bottom: "Balken onderaan",
          c_base: "Achtergrond",
          c_accent: "Accent",
          c_deep: "Diep",
          c_light: "Licht",
          schemeName: "Naam van je schema",
          schemeCodeHint: "Plak hier een schemacode om hem te importeren",
          schemeSave: "Schema opslaan",
          schemeCopy: "Kopi\xEBren als code",
          schemeImport: "Code importeren",
          schemeNameTaken: "Kies een naam die geen ingebouwd schema is",
          schemeDelete: "Schema verwijderen",
          copied: "Gekopieerd",
          badCode: "Die code lijkt niet te kloppen",
          settingsCodeHint: "Plak hier een instellingencode om hem te importeren",
          exportSettings: "Instellingen kopi\xEBren",
          importSettings: "Instellingen importeren",
          diagnostics: "Diagnose kopi\xEBren",
          reset: "Herstellen",
          resetConfirm: "Alle Mirage-instellingen herstellen? Je eigen schema's en onthouden kleuren blijven bewaard.",
          welcomeTitle: "Welkom bij Mirage",
          welcomeText: "Ctrl + Shift + M opent de immersieve modus. De instellingen vind je in je profielmenu.",
          welcomeImmersive: "Immersieve modus proberen",
          c_smart: "Smart Shuffle (S)",
          c_queue: "Hierna (Q)",
          c_devices: "Apparaten",
          c_timer: "Slaaptimer",
          queueEmpty: "Niets in de wachtrij",
          devicesNone: "Geen andere apparaten gevonden",
          deviceActive: "Speelt hier",
          timerTrack: "Einde van dit nummer",
          timerOff: "Uit",
          timerLeft: "nog {m} min",
          k_queue: "Hierna",
          overlayDownload: "Overlay-app downloaden",
          overlayAllDownloads: "Alle downloads",
          overlayConnected: "\u25CF Overlay verbonden",
          overlayMissing: "\u25CB Overlay draait niet \u2013 installeer hem met de knop hieronder en start hem \xE9\xE9n keer",
          onlineLyrics: "Songteksten online zoeken",
          onlineLyricsHint: "Heeft Spotify er geen, dan vraagt Mirage het aan LRCLIB \u2013 alleen titel, artiest, album en duur worden verstuurd",
          emptyTitle: "Geen songtekst voor dit nummer",
          emptyText: "Spotify noch LRCLIB heeft er al een songtekst voor.",
          emptyTextOff: "Spotify heeft er geen. Zet \u2018Songteksten online zoeken\u2019 aan in de instellingen om verder te zoeken.",
          instrTitle: "Instrumentaal",
          instrText: "Geen woorden \u2013 laat de muziek gewoon spelen.",
          showViz: "Visualizer tonen",
          searchWeb: "Zoeken op internet",
          lyrPick: "Versie kiezen",
          lyrPicked: "gekozen",
          lyrNone: "Geen songtekst",
          lyrAuto: "Automatisch",
          lyrAutoHint: "Eerst Spotify, dan de beste treffer van LRCLIB",
          lyrNoVersions: "LRCLIB heeft geen andere versies van dit nummer",
          lyrSynced: "gesynchroniseerd",
          lyrPlain: "alleen tekst",
          karaoke: "Karaoke woord voor woord",
          karaokeHint: "Woorden lichten na elkaar op \u2013 exact met Spotify's lettergreeptiming, anders geschat",
          font: "Lettertype",
          fontHint: "Geldt voor heel Spotify",
          font_outfit: "Outfit",
          font_jakarta: "Jakarta",
          font_manrope: "Manrope",
          font_sora: "Sora",
          font_lexend: "Lexend",
          font_nunito: "Nunito",
          font_system: "Systeem",
          shareMonth: "Jouw maand in kleuren",
          monthKicker: "Mirage \xB7 afgelopen 30 dagen",
          monthTitle: "Jouw maand in kleuren",
          monthDays: "dagen",
          monthDaily: "Luistertijd per dag",
          monthSongs: "Topnummers",
          trToggle: "Vertaling",
          trShow: "Vertaling tonen",
          trHide: "Vertaling verbergen",
          party_rave: "Rave",
          party_rock: "Rock",
          party_pop: "Pop",
          tabMix: "Mix",
          tabParty: "Feest",
          party_auto: "Auto",
          party_bass: "Bas",
          party_chill: "Chill",
          partySection: "Feestmodus",
          partySectionHint: "Auto kiest per nummer een stijl op basis van genre, tempo en volume",
          partyLevel: "Intensiteit",
          partyLevel1: "Zacht",
          partyLevel2: "Normaal",
          partyLevel3: "Max",
          partyFlash: "Kleurflitsen",
          partyFlashHint: "Zachte kleurgolven op de beat, nooit meer dan een paar per seconde. Uit bij \u2018minder beweging\u2019",
          scanCode: "Scan in Spotify",
          partyJam: "Jam-gasten tonen",
          partyJamHint: "Tijdens een Spotify Jam zweven de profielfoto's van alle deelnemers (ook die van jou) langs de randen",
          jamYou: "Jij"
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
          tip: "Tryb immersyjny: Ctrl + Shift + M lub okr\u0105g\u0142y przycisk u g\xF3ry. W \u015Brodku 1 \xB7 2 \xB7 3 zmieniaj\u0105 widok.",
          vizSection: "Wizualizator",
          vizSectionHint: "Wygl\u0105d wizualizatora w trybie immersyjnym \u2013 zmiany dzia\u0142aj\u0105 od razu",
          viz_bars: "S\u0142upki",
          viz_wave: "Fala",
          viz_dots: "Kropki",
          vizBars: "Liczba s\u0142upk\xF3w",
          vizHeight: "Wysoko\u015B\u0107",
          vizSmooth: "P\u0142ynno\u015B\u0107",
          vizGlow: "Po\u015Bwiata",
          vizRings: "Pier\u015Bcienie w rytm",
          vizMirror: "Lustrzane odbicie",
          vizSpin: "Powolny obr\xF3t",
          scheme: "Schemat kolor\xF3w",
          schemeHint: "Zmienia si\u0119 od razu \u2013 Mirage na \u017Cywo pod\u0105\u017Ca za ok\u0142adk\u0105",
          glass: "Prawdziwe szk\u0142o",
          glassHint: "Rozmywa na \u017Cywo t\u0142o za ka\u017Cdym panelem \u2013 wygl\u0105da lepiej, ale mocno obci\u0105\u017Ca komputer",
          c_shuffle: "Losowo (S)",
          c_repeat: "Powtarzaj (R)",
          c_like: "Polub (L)",
          c_mute: "Wycisz",
          c_full: "Pe\u0142ny ekran (F)",
          c_volume: "G\u0142o\u015Bno\u015B\u0107 (\u2191 \u2193)",
          presetTitle: "Wygl\u0105d i wydajno\u015B\u0107",
          presetHint: "Jedno klikni\u0119cie ustawia wszystko \u2013 dopracuj poni\u017Cej",
          preset_full: "Pe\u0142ny",
          preset_balanced: "Zr\xF3wnowa\u017Cony",
          preset_light: "Lekki",
          preset_calm: "Spokojny",
          presetCustom: "W\u0142asny \u2013 zmieniono pojedyncze prze\u0142\u0105czniki",
          perfStepped: "Mirage dzia\u0142a\u0142 tu w {fps} fps i prze\u0142\u0105czy\u0142 si\u0119 na \u201E{preset}\u201D, aby wszystko by\u0142o p\u0142ynne.",
          autoPerf: "Dostosuj automatycznie",
          autoPerfHint: "Obni\u017Ca poziom o jeden, gdy komputer nie nad\u0105\u017Ca",
          costly: "Obci\u0105\u017Ca wydajno\u015B\u0107 i bateri\u0119",
          safeMode: "Spotify {v} zmieni\u0142 swoj\u0105 struktur\u0119 \u2013 Mirage dzia\u0142a w trybie awaryjnym (tylko kolory). Aktualizacja Mirage to naprawi.",
          share: "Udost\u0119pnij jako obraz",
          shareNow: "Udost\u0119pnij bie\u017C\u0105cy utw\xF3r",
          shareWeek: "Tw\xF3j tydzie\u0144 w kolorach",
          shareCopied: "Obraz skopiowany \u2013 i zapisany w Pobranych",
          shareSaved: "Obraz zapisany w Pobranych",
          weekKicker: "Mirage \xB7 ostatnie 7 dni",
          weekTitle: "Tw\xF3j tydzie\u0144 w kolorach",
          weekSongs: "utwor\xF3w",
          weekMinutes: "minut",
          weekColours: "Kolory Twoich ok\u0142adek",
          weekArtists: "Najcz\u0119\u015Bciej s\u0142uchane",
          weekEmpty: "Pos\u0142uchaj kilku utwor\xF3w \u2013 Tw\xF3j tydzie\u0144 si\u0119 zape\u0142ni.",
          weekScheme: "Ulubiony schemat: {s}",
          keysTitle: "Skr\xF3ty klawiszowe",
          k_play: "Odtw\xF3rz / pauza",
          k_seek: "Przewi\u0144 o 5 s",
          k_vol: "G\u0142o\u015Bno\u015B\u0107",
          k_view: "Ok\u0142adka \xB7 tekst \xB7 wizualizator \xB7 Miks \xB7 Impreza",
          k_like: "Polub",
          k_shuffle: "Losowo",
          k_repeat: "Powtarzaj",
          k_full: "Pe\u0142ny ekran",
          k_next: "Nast\u0119pny / poprzedni",
          k_close: "Zamknij",
          unsynced: "Ten tekst nie jest zsynchronizowany \u2013 przewija si\u0119 swobodnie.",
          g_colours: "Kolory",
          g_background: "T\u0142o",
          g_motion: "Animacje",
          g_immersive: "Tryb immersyjny",
          g_builder: "Stw\xF3rz w\u0142asny schemat",
          g_overlay: "Overlay",
          g_more: "Udost\u0119pnianie, kopia i pomoc",
          freeze: "Zamro\u017A kolory",
          freezeHint: "Zachowuje obecne kolory, niezale\u017Cnie od tego, co gra",
          pinAlbum: "Zapami\u0119taj kolory tego albumu",
          unpinAlbum: "Zapomnij kolory tego albumu",
          pinnedAlbum: "Ten album b\u0119dzie teraz zawsze mia\u0142 te kolory",
          unpinnedAlbum: "Kolory albumu zapomniane",
          playlistSchemeOn: "U\u017Cyj \u201E{s}\u201D dla tej playlisty",
          playlistSchemeOff: "Playlista u\u017Cywa \u201E{s}\u201D \u2013 usu\u0144",
          lyrSize: "Rozmiar tekstu",
          lyrGap: "Odst\u0119p mi\u0119dzy wierszami",
          translate: "T\u0142umacz tekst",
          translateHint: "Pokazuje t\u0142umaczenie pod ka\u017Cdym wierszem \u2013 wiersze s\u0105 wysy\u0142ane do T\u0142umacza Google",
          canvas: "Filmy Canvas",
          canvasHint: "Kr\xF3tkie zap\u0119tlone filmy Spotify za ok\u0142adk\u0105, je\u015Bli s\u0105 dost\u0119pne",
          viz_particles: "Cz\u0105steczki",
          viz_line: "Linia",
          viz_bottom: "S\u0142upki na dole",
          c_base: "T\u0142o",
          c_accent: "Akcent",
          c_deep: "Ciemny",
          c_light: "Jasny",
          schemeName: "Nazwa Twojego schematu",
          schemeCodeHint: "Wklej tutaj kod schematu, aby go zaimportowa\u0107",
          schemeSave: "Zapisz schemat",
          schemeCopy: "Kopiuj jako kod",
          schemeImport: "Importuj kod",
          schemeNameTaken: "Wybierz nazw\u0119, kt\xF3ra nie nale\u017Cy do wbudowanego schematu",
          schemeDelete: "Usu\u0144 schemat",
          copied: "Skopiowano",
          badCode: "Ten kod nie wygl\u0105da poprawnie",
          settingsCodeHint: "Wklej tutaj kod ustawie\u0144, aby go zaimportowa\u0107",
          exportSettings: "Kopiuj ustawienia",
          importSettings: "Importuj ustawienia",
          diagnostics: "Kopiuj diagnostyk\u0119",
          reset: "Resetuj",
          resetConfirm: "Zresetowa\u0107 wszystkie ustawienia Mirage? W\u0142asne schematy i zapami\u0119tane kolory zostan\u0105.",
          welcomeTitle: "Witaj w Mirage",
          welcomeText: "Ctrl + Shift + M otwiera tryb immersyjny. Ustawienia znajdziesz w menu profilu.",
          welcomeImmersive: "Wypr\xF3buj tryb immersyjny",
          c_smart: "Smart Shuffle (S)",
          c_queue: "Nast\u0119pne (Q)",
          c_devices: "Urz\u0105dzenia",
          c_timer: "Wy\u0142\u0105cznik czasowy",
          queueEmpty: "Kolejka jest pusta",
          devicesNone: "Nie znaleziono innych urz\u0105dze\u0144",
          deviceActive: "Gra tutaj",
          timerTrack: "Koniec tego utworu",
          timerOff: "Wy\u0142.",
          timerLeft: "zosta\u0142o {m} min",
          k_queue: "Nast\u0119pne",
          overlayDownload: "Pobierz aplikacj\u0119 Overlay",
          overlayAllDownloads: "Wszystkie pliki do pobrania",
          overlayConnected: "\u25CF Overlay po\u0142\u0105czony",
          overlayMissing: "\u25CB Overlay nie dzia\u0142a \u2013 zainstaluj go przyciskiem poni\u017Cej i uruchom raz",
          onlineLyrics: "Szukaj tekst\xF3w online",
          onlineLyricsHint: "Je\u015Bli Spotify go nie ma, Mirage pyta LRCLIB \u2013 wysy\u0142ane s\u0105 tylko tytu\u0142, wykonawca, album i d\u0142ugo\u015B\u0107",
          emptyTitle: "Brak tekstu dla tego utworu",
          emptyText: "Ani Spotify, ani LRCLIB nie maj\u0105 jeszcze tego tekstu.",
          emptyTextOff: "Spotify go nie ma. W\u0142\u0105cz \u201ESzukaj tekst\xF3w online\u201D w ustawieniach, aby szuka\u0107 dalej.",
          instrTitle: "Instrumentalny",
          instrText: "Bez s\u0142\xF3w \u2013 po prostu s\u0142uchaj muzyki.",
          showViz: "Poka\u017C wizualizator",
          searchWeb: "Szukaj w sieci",
          lyrPick: "Wybierz wersj\u0119",
          lyrPicked: "wybrana",
          lyrNone: "Brak tekstu",
          lyrAuto: "Automatycznie",
          lyrAutoHint: "Najpierw Spotify, potem najlepsze trafienie z LRCLIB",
          lyrNoVersions: "LRCLIB nie ma innych wersji tego utworu",
          lyrSynced: "zsynchronizowany",
          lyrPlain: "sam tekst",
          karaoke: "Karaoke s\u0142owo po s\u0142owie",
          karaokeHint: "S\u0142owa pod\u015Bwietlaj\u0105 si\u0119 po kolei \u2013 dok\u0142adnie z czasami sylab Spotify, w przeciwnym razie szacunkowo",
          font: "Czcionka",
          fontHint: "Dotyczy ca\u0142ego Spotify",
          font_outfit: "Outfit",
          font_jakarta: "Jakarta",
          font_manrope: "Manrope",
          font_sora: "Sora",
          font_lexend: "Lexend",
          font_nunito: "Nunito",
          font_system: "Systemowa",
          shareMonth: "Tw\xF3j miesi\u0105c w kolorach",
          monthKicker: "Mirage \xB7 ostatnie 30 dni",
          monthTitle: "Tw\xF3j miesi\u0105c w kolorach",
          monthDays: "dni",
          monthDaily: "Czas s\u0142uchania dziennie",
          monthSongs: "Top utwory",
          trToggle: "T\u0142umaczenie",
          trShow: "Poka\u017C t\u0142umaczenie",
          trHide: "Ukryj t\u0142umaczenie",
          party_rave: "Rave",
          party_rock: "Rock",
          party_pop: "Pop",
          tabMix: "Miks",
          tabParty: "Impreza",
          party_auto: "Auto",
          party_bass: "Bas",
          party_chill: "Chill",
          partySection: "Tryb imprezy",
          partySectionHint: "Auto dobiera styl do ka\u017Cdego utworu wed\u0142ug gatunku, tempa i g\u0142o\u015Bno\u015Bci",
          partyLevel: "Intensywno\u015B\u0107",
          partyLevel1: "\u0141agodna",
          partyLevel2: "Normalna",
          partyLevel3: "Maks.",
          partyFlash: "B\u0142yski koloru",
          partyFlashHint: "\u0141agodne fale koloru w rytm, najwy\u017Cej kilka na sekund\u0119. Wy\u0142\u0105czone przy \u201Eograniczeniu ruchu\u201D",
          scanCode: "Zeskanuj w Spotify",
          partyJam: "Poka\u017C go\u015Bci Jamu",
          partyJamHint: "Podczas Jamu w Spotify zdj\u0119cia profilowe wszystkich uczestnik\xF3w (tak\u017Ce twoje) unosz\u0105 si\u0119 przy kraw\u0119dziach",
          jamYou: "Ty"
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
          bright: "Arka plan parlakl\u0131\u011F\u0131",
          dynamicHint: "T\xFCm aray\xFCz \u015Fark\u0131n\u0131n renklerine b\xFCr\xFCn\xFCr",
          particlesHint: "Arka planda s\xFCz\xFClen \u0131\u015F\u0131k noktalar\u0131",
          beatHint: "Spotify ritim verisi sa\u011Flad\u0131\u011F\u0131nda vuru\u015Flarla titre\u015Fir",
          cascadeHint: "Sayfa de\u011Fi\u015Ftirdi\u011Finde i\xE7erik kayarak gelir",
          vinylHint: "Alttaki kapak d\xF6nen bir pla\u011Fa d\xF6n\xFC\u015F\xFCr",
          tiltHint: "Kartlar fare imlecine do\u011Fru e\u011Filir",
          burstHint: "Bir \u015Fark\u0131y\u0131 be\u011Fendi\u011Finde k\u0131v\u0131lc\u0131m ya\u011Fmuru",
          overlay: "Mirage Overlay",
          overlayHint: "\u015Eark\u0131 de\u011Fi\u015Fikliklerini Spotify d\u0131\u015F\u0131ndaki overlay uygulamas\u0131na g\xF6nder",
          grainHint: "Arka plan \xFCzerinde ince bir parazit",
          calmHint: "T\xFCm arka plan animasyonlar\u0131n\u0131 durdurur",
          vizSection: "G\xF6rselle\u015Ftirici",
          vizSectionHint: "S\xFCr\xFCkleyici moddaki g\xF6rselle\u015Ftiricinin g\xF6r\xFCn\xFCm\xFC \u2013 de\u011Fi\u015Fiklikler an\u0131nda uygulan\u0131r",
          viz_bars: "\xC7ubuklar",
          viz_wave: "Dalga",
          viz_dots: "Noktalar",
          vizBars: "\xC7ubuk say\u0131s\u0131",
          vizHeight: "Y\xFCkseklik",
          vizSmooth: "Yumu\u015Fakl\u0131k",
          vizGlow: "Par\u0131lt\u0131",
          vizRings: "Ritimde halkalar",
          vizMirror: "Aynal\u0131",
          vizSpin: "Yava\u015F d\xF6n\xFC\u015F",
          scheme: "Renk \u015Femas\u0131",
          schemeHint: "An\u0131nda de\u011Fi\u015Fir \u2013 Mirage kapa\u011F\u0131 canl\u0131 takip eder",
          glass: "Ger\xE7ek cam",
          glassHint: "Her panelin arkas\u0131n\u0131 canl\u0131 bulan\u0131kla\u015Ft\u0131r\u0131r \u2013 daha \u015F\u0131k ama \xE7ok performans harcar",
          c_shuffle: "Kar\u0131\u015F\u0131k (S)",
          c_repeat: "Tekrarla (R)",
          c_like: "Be\u011Fen (L)",
          c_mute: "Sessiz",
          c_full: "Tam ekran (F)",
          c_volume: "Ses (\u2191 \u2193)",
          tip: "S\xFCr\xFCkleyici mod: Ctrl + Shift + M veya \xFCstteki daire d\xFC\u011Fmesi. \u0130\xE7eride: 1 \xB7 2 \xB7 3 g\xF6r\xFCn\xFCm, Bo\u015Fluk oynat, \u2190 \u2192 sar, \u2191 \u2193 ses, L be\u011Fen, S kar\u0131\u015F\u0131k, R tekrarla, F tam ekran.",
          presetTitle: "G\xF6r\xFCn\xFCm ve performans",
          presetHint: "Tek t\u0131kla her \u015Fey ayarlan\u0131r \u2013 a\u015Fa\u011F\u0131da ince ayar yap",
          preset_full: "Tam",
          preset_balanced: "Dengeli",
          preset_light: "Hafif",
          preset_calm: "Sakin",
          presetCustom: "\xD6zel \u2013 tek tek anahtarlar\u0131 de\u011Fi\u015Ftirdin",
          perfStepped: "Mirage burada {fps} fps ile \xE7al\u0131\u015F\u0131yordu ve ak\u0131c\u0131 kalmak i\xE7in \u201C{preset}\u201D ayar\u0131na ge\xE7ti.",
          autoPerf: "Otomatik uyarla",
          autoPerfHint: "Bilgisayar\u0131n yeti\u015Femezse bir seviye d\xFC\u015Fer",
          costly: "Performans ve pil harcar",
          safeMode: "Spotify {v} yap\u0131s\u0131n\u0131 de\u011Fi\u015Ftirdi \u2013 Mirage g\xFCvenli moda ge\xE7ti (yaln\u0131zca renkler). Bir Mirage g\xFCncellemesi bunu d\xFCzeltir.",
          share: "G\xF6rsel olarak payla\u015F",
          shareNow: "\xC7alan \u015Fark\u0131y\u0131 payla\u015F",
          shareWeek: "Renklerle haftan",
          shareCopied: "G\xF6rsel kopyaland\u0131 \u2013 ve \u0130ndirilenler'e kaydedildi",
          shareSaved: "G\xF6rsel \u0130ndirilenler'e kaydedildi",
          weekKicker: "Mirage \xB7 son 7 g\xFCn",
          weekTitle: "Renklerle haftan",
          weekSongs: "\u015Fark\u0131",
          weekMinutes: "dakika",
          weekColours: "Kapaklar\u0131n\u0131n renkleri",
          weekArtists: "En \xE7ok dinlenenler",
          weekEmpty: "Birka\xE7 \u015Fark\u0131 dinle \u2013 haftan dolmaya ba\u015Flas\u0131n.",
          weekScheme: "Favori \u015Fema: {s}",
          keysTitle: "Klavye k\u0131sayollar\u0131",
          k_play: "Oynat / duraklat",
          k_seek: "5 sn sar",
          k_vol: "Ses",
          k_view: "Kapak \xB7 s\xF6zler \xB7 g\xF6rselle\u015Ftirici \xB7 Kar\u0131\u015F\u0131k \xB7 Parti",
          k_like: "Be\u011Fen",
          k_shuffle: "Kar\u0131\u015F\u0131k",
          k_repeat: "Tekrarla",
          k_full: "Tam ekran",
          k_next: "Sonraki / \xF6nceki",
          k_close: "Kapat",
          unsynced: "Bu s\xF6zler zamanl\u0131 de\u011Fil \u2013 serbest\xE7e kayar.",
          g_colours: "Renkler",
          g_background: "Arka plan",
          g_motion: "Animasyonlar",
          g_immersive: "S\xFCr\xFCkleyici mod",
          g_builder: "Kendi \u015Feman\u0131 olu\u015Ftur",
          g_overlay: "Overlay",
          g_more: "Payla\u015F, yedekle ve yard\u0131m",
          freeze: "Renkleri dondur",
          freezeHint: "Ne \xE7alarsa \xE7als\u0131n mevcut renkleri korur",
          pinAlbum: "Bu alb\xFCm\xFCn renklerini hat\u0131rla",
          unpinAlbum: "Bu alb\xFCm\xFCn renklerini unut",
          pinnedAlbum: "Bu alb\xFCm art\u0131k hep bu renkleri alacak",
          unpinnedAlbum: "Alb\xFCm renkleri unutuldu",
          playlistSchemeOn: "Bu \xE7alma listesi i\xE7in \u201C{s}\u201D kullan",
          playlistSchemeOff: "\xC7alma listesi \u201C{s}\u201D kullan\u0131yor \u2013 kald\u0131r",
          lyrSize: "S\xF6z boyutu",
          lyrGap: "Sat\u0131r aral\u0131\u011F\u0131",
          translate: "S\xF6zleri \xE7evir",
          translateHint: "Her sat\u0131r\u0131n alt\u0131nda \xE7eviri g\xF6sterir \u2013 sat\u0131rlar Google \xC7eviri'ye g\xF6nderilir",
          canvas: "Canvas videolar\u0131",
          canvasHint: "Spotify'\u0131n kapak arkas\u0131ndaki k\u0131sa d\xF6ng\xFC videolar\u0131, varsa",
          viz_particles: "Par\xE7ac\u0131klar",
          viz_line: "\xC7izgi",
          viz_bottom: "Alt \xE7ubuklar",
          c_base: "Arka plan",
          c_accent: "Vurgu",
          c_deep: "Koyu",
          c_light: "A\xE7\u0131k",
          schemeName: "\u015Eeman\u0131n ad\u0131",
          schemeCodeHint: "\u0130\xE7e aktarmak i\xE7in bir \u015Fema kodunu buraya yap\u0131\u015Ft\u0131r",
          schemeSave: "\u015Eemay\u0131 kaydet",
          schemeCopy: "Kod olarak kopyala",
          schemeImport: "Kodu i\xE7e aktar",
          schemeNameTaken: "Yerle\u015Fik bir \u015Femaya ait olmayan bir ad ver",
          schemeDelete: "\u015Eemay\u0131 sil",
          copied: "Kopyaland\u0131",
          badCode: "Bu kod do\u011Fru g\xF6r\xFCnm\xFCyor",
          settingsCodeHint: "\u0130\xE7e aktarmak i\xE7in bir ayar kodunu buraya yap\u0131\u015Ft\u0131r",
          exportSettings: "Ayarlar\u0131 kopyala",
          importSettings: "Ayarlar\u0131 i\xE7e aktar",
          diagnostics: "Tan\u0131lamay\u0131 kopyala",
          reset: "S\u0131f\u0131rla",
          resetConfirm: "T\xFCm Mirage ayarlar\u0131 s\u0131f\u0131rlans\u0131n m\u0131? Kendi \u015Femalar\u0131n ve hat\u0131rlanan renkler kal\u0131r.",
          welcomeTitle: "Mirage'a ho\u015F geldin",
          welcomeText: "Ctrl + Shift + M s\xFCr\xFCkleyici modu a\xE7ar. Ayarlar profil men\xFCnde.",
          welcomeImmersive: "S\xFCr\xFCkleyici modu dene",
          c_smart: "Smart Shuffle (S)",
          c_queue: "S\u0131radaki (Q)",
          c_devices: "Cihazlar",
          c_timer: "Uyku zamanlay\u0131c\u0131s\u0131",
          queueEmpty: "S\u0131rada hi\xE7bir \u015Fey yok",
          devicesNone: "Ba\u015Fka cihaz bulunamad\u0131",
          deviceActive: "Burada \xE7al\u0131yor",
          timerTrack: "Bu \u015Fark\u0131n\u0131n sonu",
          timerOff: "Kapal\u0131",
          timerLeft: "{m} dk kald\u0131",
          k_queue: "S\u0131radaki",
          overlayDownload: "Overlay uygulamas\u0131n\u0131 indir",
          overlayAllDownloads: "T\xFCm indirmeler",
          overlayConnected: "\u25CF Overlay ba\u011Fl\u0131",
          overlayMissing: "\u25CB Overlay \xE7al\u0131\u015Fm\u0131yor \u2013 a\u015Fa\u011F\u0131daki d\xFC\u011Fmeyle kur, sonra bir kez ba\u015Flat",
          onlineLyrics: "S\xF6zleri \xE7evrimi\xE7i ara",
          onlineLyricsHint: "Spotify'da yoksa Mirage LRCLIB'e sorar \u2013 yaln\u0131zca ba\u015Fl\u0131k, sanat\xE7\u0131, alb\xFCm ve s\xFCre g\xF6nderilir",
          emptyTitle: "Bu \u015Fark\u0131 i\xE7in s\xF6z yok",
          emptyText: "Ne Spotify'da ne de LRCLIB'de hen\xFCz s\xF6zleri var.",
          emptyTextOff: "Spotify'da yok. Daha fazla aramak i\xE7in ayarlarda \u201CS\xF6zleri \xE7evrimi\xE7i ara\u201Dy\u0131 a\xE7.",
          instrTitle: "Enstr\xFCmantal",
          instrText: "S\xF6z yok \u2013 m\xFCzi\u011Fin keyfini \xE7\u0131kar.",
          showViz: "G\xF6rselle\u015Ftiriciyi g\xF6ster",
          searchWeb: "Web'de ara",
          lyrPick: "S\xFCr\xFCm se\xE7",
          lyrPicked: "se\xE7ildi",
          lyrNone: "S\xF6z yok",
          lyrAuto: "Otomatik",
          lyrAutoHint: "\xD6nce Spotify, sonra en iyi LRCLIB e\u015Fle\u015Fmesi",
          lyrNoVersions: "LRCLIB'de bu \u015Fark\u0131n\u0131n ba\u015Fka s\xFCr\xFCm\xFC yok",
          lyrSynced: "zamanl\u0131",
          lyrPlain: "d\xFCz metin",
          karaoke: "Kelime kelime karaoke",
          karaokeHint: "Kelimeler tek tek yanar \u2013 Spotify hece zamanlamas\u0131yla tam, de\u011Filse tahmini",
          font: "Yaz\u0131 tipi",
          fontHint: "T\xFCm Spotify i\xE7in ge\xE7erli",
          font_outfit: "Outfit",
          font_jakarta: "Jakarta",
          font_manrope: "Manrope",
          font_sora: "Sora",
          font_lexend: "Lexend",
          font_nunito: "Nunito",
          font_system: "Sistem",
          shareMonth: "Renklerle ay\u0131n",
          monthKicker: "Mirage \xB7 son 30 g\xFCn",
          monthTitle: "Renklerle ay\u0131n",
          monthDays: "g\xFCn",
          monthDaily: "G\xFCnl\xFCk dinleme s\xFCresi",
          monthSongs: "En iyi \u015Fark\u0131lar",
          trToggle: "\xC7eviri",
          trShow: "\xC7eviriyi g\xF6ster",
          trHide: "\xC7eviriyi gizle",
          party_rave: "Rave",
          party_rock: "Rock",
          party_pop: "Pop",
          tabMix: "Kar\u0131\u015F\u0131k",
          tabParty: "Parti",
          party_auto: "Otomatik",
          party_bass: "Bas",
          party_chill: "Sakin",
          partySection: "Parti modu",
          partySectionHint: "Otomatik, her \u015Fark\u0131 i\xE7in t\xFCre, tempoya ve ses d\xFCzeyine g\xF6re bir stil se\xE7er",
          partyLevel: "Yo\u011Funluk",
          partyLevel1: "Hafif",
          partyLevel2: "Normal",
          partyLevel3: "Maksimum",
          partyFlash: "Renk fla\u015Flar\u0131",
          partyFlashHint: "Ritimle yumu\u015Fak renk dalgalar\u0131, saniyede en fazla birka\xE7 tane. Hareketi azalt a\xE7\u0131kken kapal\u0131",
          scanCode: "Spotify'da tara",
          partyJam: "Jam konuklar\u0131n\u0131 g\xF6ster",
          partyJamHint: "Spotify Jam s\u0131ras\u0131nda t\xFCm kat\u0131l\u0131mc\u0131lar\u0131n (senin de) profil foto\u011Fraflar\u0131 kenarlarda s\xFCz\xFCl\xFCr",
          jamYou: "Sen"
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
          bright: "\u042F\u0440\u043A\u043E\u0441\u0442\u044C \u0444\u043E\u043D\u0430",
          dynamicHint: "\u0412\u0435\u0441\u044C \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441 \u043F\u0440\u0438\u043D\u0438\u043C\u0430\u0435\u0442 \u0446\u0432\u0435\u0442\u0430 \u043F\u0435\u0441\u043D\u0438",
          particlesHint: "\u041F\u0430\u0440\u044F\u0449\u0438\u0435 \u0441\u0432\u0435\u0442\u044F\u0449\u0438\u0435\u0441\u044F \u0442\u043E\u0447\u043A\u0438 \u043D\u0430 \u0444\u043E\u043D\u0435",
          beatHint: "\u041F\u0443\u043B\u044C\u0441\u0438\u0440\u0443\u0435\u0442 \u0432 \u0442\u0430\u043A\u0442, \u043A\u043E\u0433\u0434\u0430 Spotify \u043F\u0435\u0440\u0435\u0434\u0430\u0451\u0442 \u0434\u0430\u043D\u043D\u044B\u0435 \u043E \u0440\u0438\u0442\u043C\u0435",
          cascadeHint: "\u0421\u043E\u0434\u0435\u0440\u0436\u0438\u043C\u043E\u0435 \u043F\u043B\u0430\u0432\u043D\u043E \u0432\u044A\u0435\u0437\u0436\u0430\u0435\u0442 \u043F\u0440\u0438 \u0441\u043C\u0435\u043D\u0435 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u044B",
          vinylHint: "\u041E\u0431\u043B\u043E\u0436\u043A\u0430 \u0432\u043D\u0438\u0437\u0443 \u043F\u0440\u0435\u0432\u0440\u0430\u0449\u0430\u0435\u0442\u0441\u044F \u0432\u043E \u0432\u0440\u0430\u0449\u0430\u044E\u0449\u0443\u044E\u0441\u044F \u043F\u043B\u0430\u0441\u0442\u0438\u043D\u043A\u0443",
          tiltHint: "\u041A\u0430\u0440\u0442\u043E\u0447\u043A\u0438 \u043D\u0430\u043A\u043B\u043E\u043D\u044F\u044E\u0442\u0441\u044F \u043A \u0443\u043A\u0430\u0437\u0430\u0442\u0435\u043B\u044E \u043C\u044B\u0448\u0438",
          burstHint: "\u0414\u043E\u0436\u0434\u044C \u0438\u0441\u043A\u0440, \u043A\u043E\u0433\u0434\u0430 \u0442\u0435\u0431\u0435 \u043D\u0440\u0430\u0432\u0438\u0442\u0441\u044F \u043F\u0435\u0441\u043D\u044F",
          overlay: "Mirage Overlay",
          overlayHint: "\u041E\u0442\u043F\u0440\u0430\u0432\u043B\u044F\u0442\u044C \u0441\u043C\u0435\u043D\u0443 \u043F\u0435\u0441\u0435\u043D \u0432 \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0435-\u043E\u0432\u0435\u0440\u043B\u0435\u0439 \u0432\u043D\u0435 Spotify",
          grainHint: "\u041B\u0451\u0433\u043A\u0438\u0439 \u0448\u0443\u043C \u043F\u043E\u0432\u0435\u0440\u0445 \u0444\u043E\u043D\u0430",
          calmHint: "\u041E\u0441\u0442\u0430\u043D\u0430\u0432\u043B\u0438\u0432\u0430\u0435\u0442 \u0432\u0441\u0435 \u0444\u043E\u043D\u043E\u0432\u044B\u0435 \u0430\u043D\u0438\u043C\u0430\u0446\u0438\u0438",
          vizSection: "\u0412\u0438\u0437\u0443\u0430\u043B\u0438\u0437\u0430\u0442\u043E\u0440",
          vizSectionHint: "\u0412\u0438\u0434 \u0432\u0438\u0437\u0443\u0430\u043B\u0438\u0437\u0430\u0442\u043E\u0440\u0430 \u0432 \u0440\u0435\u0436\u0438\u043C\u0435 \u043F\u043E\u0433\u0440\u0443\u0436\u0435\u043D\u0438\u044F \u2013 \u043C\u0435\u043D\u044F\u0435\u0442\u0441\u044F \u0441\u0440\u0430\u0437\u0443",
          viz_bars: "\u0421\u0442\u043E\u043B\u0431\u0438\u043A\u0438",
          viz_wave: "\u0412\u043E\u043B\u043D\u0430",
          viz_dots: "\u0422\u043E\u0447\u043A\u0438",
          vizBars: "\u0427\u0438\u0441\u043B\u043E \u0441\u0442\u043E\u043B\u0431\u0438\u043A\u043E\u0432",
          vizHeight: "\u0412\u044B\u0441\u043E\u0442\u0430",
          vizSmooth: "\u041F\u043B\u0430\u0432\u043D\u043E\u0441\u0442\u044C",
          vizGlow: "\u0421\u0432\u0435\u0447\u0435\u043D\u0438\u0435",
          vizRings: "\u041A\u043E\u043B\u044C\u0446\u0430 \u0432 \u0442\u0430\u043A\u0442",
          vizMirror: "\u0417\u0435\u0440\u043A\u0430\u043B\u044C\u043D\u043E",
          vizSpin: "\u041C\u0435\u0434\u043B\u0435\u043D\u043D\u043E\u0435 \u0432\u0440\u0430\u0449\u0435\u043D\u0438\u0435",
          scheme: "\u0426\u0432\u0435\u0442\u043E\u0432\u0430\u044F \u0441\u0445\u0435\u043C\u0430",
          schemeHint: "\u041F\u0435\u0440\u0435\u043A\u043B\u044E\u0447\u0430\u0435\u0442\u0441\u044F \u043C\u0433\u043D\u043E\u0432\u0435\u043D\u043D\u043E \u2013 Mirage \u0441\u043B\u0435\u0434\u0443\u0435\u0442 \u0437\u0430 \u043E\u0431\u043B\u043E\u0436\u043A\u043E\u0439 \u0432\u0436\u0438\u0432\u0443\u044E",
          glass: "\u041D\u0430\u0441\u0442\u043E\u044F\u0449\u0435\u0435 \u0441\u0442\u0435\u043A\u043B\u043E",
          glassHint: "\u0420\u0430\u0437\u043C\u044B\u0432\u0430\u0435\u0442 \u0444\u043E\u043D \u0437\u0430 \u043A\u0430\u0436\u0434\u043E\u0439 \u043F\u0430\u043D\u0435\u043B\u044C\u044E \u0432\u0436\u0438\u0432\u0443\u044E \u2013 \u043A\u0440\u0430\u0441\u0438\u0432\u0435\u0435, \u043D\u043E \u0441\u0438\u043B\u044C\u043D\u043E \u043D\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u0442 \u0441\u0438\u0441\u0442\u0435\u043C\u0443",
          c_shuffle: "\u041F\u0435\u0440\u0435\u043C\u0435\u0448\u0430\u0442\u044C (S)",
          c_repeat: "\u041F\u043E\u0432\u0442\u043E\u0440 (R)",
          c_like: "\u041D\u0440\u0430\u0432\u0438\u0442\u0441\u044F (L)",
          c_mute: "\u0411\u0435\u0437 \u0437\u0432\u0443\u043A\u0430",
          c_full: "\u041F\u043E\u043B\u043D\u044B\u0439 \u044D\u043A\u0440\u0430\u043D (F)",
          c_volume: "\u0413\u0440\u043E\u043C\u043A\u043E\u0441\u0442\u044C (\u2191 \u2193)",
          tip: "\u0420\u0435\u0436\u0438\u043C \u043F\u043E\u0433\u0440\u0443\u0436\u0435\u043D\u0438\u044F: Ctrl + Shift + M \u0438\u043B\u0438 \u043A\u0440\u0443\u0433\u043B\u0430\u044F \u043A\u043D\u043E\u043F\u043A\u0430 \u0432\u0432\u0435\u0440\u0445\u0443. \u0412\u043D\u0443\u0442\u0440\u0438: 1 \xB7 2 \xB7 3 \u0432\u0438\u0434, \u041F\u0440\u043E\u0431\u0435\u043B \u0432\u043E\u0441\u043F\u0440\u043E\u0438\u0437\u0432\u0435\u0434\u0435\u043D\u0438\u0435, \u2190 \u2192 \u043F\u0435\u0440\u0435\u043C\u043E\u0442\u043A\u0430, \u2191 \u2193 \u0433\u0440\u043E\u043C\u043A\u043E\u0441\u0442\u044C, L \u043D\u0440\u0430\u0432\u0438\u0442\u0441\u044F, S \u043F\u0435\u0440\u0435\u043C\u0435\u0448\u0430\u0442\u044C, R \u043F\u043E\u0432\u0442\u043E\u0440, F \u043F\u043E\u043B\u043D\u044B\u0439 \u044D\u043A\u0440\u0430\u043D.",
          presetTitle: "\u0412\u0438\u0434 \u0438 \u043F\u0440\u043E\u0438\u0437\u0432\u043E\u0434\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C",
          presetHint: "\u041E\u0434\u0438\u043D \u043A\u043B\u0438\u043A \u043D\u0430\u0441\u0442\u0440\u0430\u0438\u0432\u0430\u0435\u0442 \u0432\u0441\u0451 \u2013 \u0442\u043E\u043D\u043A\u0430\u044F \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430 \u043D\u0438\u0436\u0435",
          preset_full: "\u041F\u043E\u043B\u043D\u044B\u0439",
          preset_balanced: "\u0421\u0431\u0430\u043B\u0430\u043D\u0441\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u044B\u0439",
          preset_light: "\u041B\u0451\u0433\u043A\u0438\u0439",
          preset_calm: "\u0421\u043F\u043E\u043A\u043E\u0439\u043D\u044B\u0439",
          presetCustom: "\u0421\u0432\u043E\u0439 \u2013 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u0435 \u043F\u0435\u0440\u0435\u043A\u043B\u044E\u0447\u0430\u0442\u0435\u043B\u0438 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u044B",
          perfStepped: "Mirage \u0440\u0430\u0431\u043E\u0442\u0430\u043B \u0437\u0434\u0435\u0441\u044C \u0441 {fps} fps \u0438 \u043F\u0435\u0440\u0435\u043A\u043B\u044E\u0447\u0438\u043B\u0441\u044F \u043D\u0430 \xAB{preset}\xBB, \u0447\u0442\u043E\u0431\u044B \u0432\u0441\u0451 \u0448\u043B\u043E \u043F\u043B\u0430\u0432\u043D\u043E.",
          autoPerf: "\u041D\u0430\u0441\u0442\u0440\u0430\u0438\u0432\u0430\u0442\u044C \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438",
          autoPerfHint: "\u041F\u043E\u043D\u0438\u0436\u0430\u0435\u0442 \u0443\u0440\u043E\u0432\u0435\u043D\u044C \u043D\u0430 \u0441\u0442\u0443\u043F\u0435\u043D\u044C, \u0435\u0441\u043B\u0438 \u041F\u041A \u043D\u0435 \u0441\u043F\u0440\u0430\u0432\u043B\u044F\u0435\u0442\u0441\u044F",
          costly: "\u0420\u0430\u0441\u0445\u043E\u0434\u0443\u0435\u0442 \u0440\u0435\u0441\u0443\u0440\u0441\u044B \u0438 \u0437\u0430\u0440\u044F\u0434 \u0431\u0430\u0442\u0430\u0440\u0435\u0438",
          safeMode: "Spotify {v} \u0438\u0437\u043C\u0435\u043D\u0438\u043B \u0441\u0432\u043E\u044E \u0441\u0442\u0440\u0443\u043A\u0442\u0443\u0440\u0443 \u2013 Mirage \u0440\u0430\u0431\u043E\u0442\u0430\u0435\u0442 \u0432 \u0431\u0435\u0437\u043E\u043F\u0430\u0441\u043D\u043E\u043C \u0440\u0435\u0436\u0438\u043C\u0435 (\u0442\u043E\u043B\u044C\u043A\u043E \u0446\u0432\u0435\u0442\u0430). \u041E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0435 Mirage \u044D\u0442\u043E \u0438\u0441\u043F\u0440\u0430\u0432\u0438\u0442.",
          share: "\u041F\u043E\u0434\u0435\u043B\u0438\u0442\u044C\u0441\u044F \u043A\u0430\u0440\u0442\u0438\u043D\u043A\u043E\u0439",
          shareNow: "\u041F\u043E\u0434\u0435\u043B\u0438\u0442\u044C\u0441\u044F \u0442\u0435\u043A\u0443\u0449\u0435\u0439 \u043F\u0435\u0441\u043D\u0435\u0439",
          shareWeek: "\u0422\u0432\u043E\u044F \u043D\u0435\u0434\u0435\u043B\u044F \u0432 \u0446\u0432\u0435\u0442\u0430\u0445",
          shareCopied: "\u041A\u0430\u0440\u0442\u0438\u043D\u043A\u0430 \u0441\u043A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u043D\u0430 \u2013 \u0438 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0430 \u0432 \xAB\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0438\xBB",
          shareSaved: "\u041A\u0430\u0440\u0442\u0438\u043D\u043A\u0430 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0430 \u0432 \xAB\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0438\xBB",
          weekKicker: "Mirage \xB7 \u043F\u043E\u0441\u043B\u0435\u0434\u043D\u0438\u0435 7 \u0434\u043D\u0435\u0439",
          weekTitle: "\u0422\u0432\u043E\u044F \u043D\u0435\u0434\u0435\u043B\u044F \u0432 \u0446\u0432\u0435\u0442\u0430\u0445",
          weekSongs: "\u043F\u0435\u0441\u0435\u043D",
          weekMinutes: "\u043C\u0438\u043D\u0443\u0442",
          weekColours: "\u0426\u0432\u0435\u0442\u0430 \u0442\u0432\u043E\u0438\u0445 \u043E\u0431\u043B\u043E\u0436\u0435\u043A",
          weekArtists: "\u0427\u0430\u0449\u0435 \u0432\u0441\u0435\u0433\u043E",
          weekEmpty: "\u041F\u043E\u0441\u043B\u0443\u0448\u0430\u0439 \u043D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u043F\u0435\u0441\u0435\u043D \u2013 \u043D\u0435\u0434\u0435\u043B\u044F \u043D\u0430\u0447\u043D\u0451\u0442 \u0437\u0430\u043F\u043E\u043B\u043D\u044F\u0442\u044C\u0441\u044F.",
          weekScheme: "\u041B\u044E\u0431\u0438\u043C\u0430\u044F \u0441\u0445\u0435\u043C\u0430: {s}",
          keysTitle: "\u0421\u043E\u0447\u0435\u0442\u0430\u043D\u0438\u044F \u043A\u043B\u0430\u0432\u0438\u0448",
          k_play: "\u0412\u043E\u0441\u043F\u0440\u043E\u0438\u0437\u0432\u0435\u0434\u0435\u043D\u0438\u0435 / \u043F\u0430\u0443\u0437\u0430",
          k_seek: "\u041F\u0435\u0440\u0435\u043C\u043E\u0442\u043A\u0430 \u043D\u0430 5 \u0441",
          k_vol: "\u0413\u0440\u043E\u043C\u043A\u043E\u0441\u0442\u044C",
          k_view: "\u041E\u0431\u043B\u043E\u0436\u043A\u0430 \xB7 \u0442\u0435\u043A\u0441\u0442 \xB7 \u0432\u0438\u0437\u0443\u0430\u043B\u0438\u0437\u0430\u0442\u043E\u0440 \xB7 \u041C\u0438\u043A\u0441 \xB7 \u0412\u0435\u0447\u0435\u0440\u0438\u043D\u043A\u0430",
          k_like: "\u041D\u0440\u0430\u0432\u0438\u0442\u0441\u044F",
          k_shuffle: "\u041F\u0435\u0440\u0435\u043C\u0435\u0448\u0430\u0442\u044C",
          k_repeat: "\u041F\u043E\u0432\u0442\u043E\u0440",
          k_full: "\u041F\u043E\u043B\u043D\u044B\u0439 \u044D\u043A\u0440\u0430\u043D",
          k_next: "\u0421\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0439 / \u043F\u0440\u0435\u0434\u044B\u0434\u0443\u0449\u0438\u0439",
          k_close: "\u0417\u0430\u043A\u0440\u044B\u0442\u044C",
          unsynced: "\u042D\u0442\u043E\u0442 \u0442\u0435\u043A\u0441\u0442 \u043D\u0435 \u0441\u0438\u043D\u0445\u0440\u043E\u043D\u0438\u0437\u0438\u0440\u043E\u0432\u0430\u043D \u2013 \u043E\u043D \u043F\u0440\u043E\u043A\u0440\u0443\u0447\u0438\u0432\u0430\u0435\u0442\u0441\u044F \u0441\u0432\u043E\u0431\u043E\u0434\u043D\u043E.",
          g_colours: "\u0426\u0432\u0435\u0442\u0430",
          g_background: "\u0424\u043E\u043D",
          g_motion: "\u0410\u043D\u0438\u043C\u0430\u0446\u0438\u0438",
          g_immersive: "\u0420\u0435\u0436\u0438\u043C \u043F\u043E\u0433\u0440\u0443\u0436\u0435\u043D\u0438\u044F",
          g_builder: "\u0421\u0432\u043E\u044F \u0441\u0445\u0435\u043C\u0430",
          g_overlay: "\u041E\u0432\u0435\u0440\u043B\u0435\u0439",
          g_more: "\u041F\u043E\u0434\u0435\u043B\u0438\u0442\u044C\u0441\u044F, \u0440\u0435\u0437\u0435\u0440\u0432\u043D\u0430\u044F \u043A\u043E\u043F\u0438\u044F \u0438 \u0441\u043F\u0440\u0430\u0432\u043A\u0430",
          freeze: "\u0417\u0430\u043C\u043E\u0440\u043E\u0437\u0438\u0442\u044C \u0446\u0432\u0435\u0442\u0430",
          freezeHint: "\u0421\u043E\u0445\u0440\u0430\u043D\u044F\u0435\u0442 \u0442\u0435\u043A\u0443\u0449\u0438\u0435 \u0446\u0432\u0435\u0442\u0430, \u0447\u0442\u043E \u0431\u044B \u043D\u0438 \u0438\u0433\u0440\u0430\u043B\u043E",
          pinAlbum: "\u0417\u0430\u043F\u043E\u043C\u043D\u0438\u0442\u044C \u0446\u0432\u0435\u0442\u0430 \u044D\u0442\u043E\u0433\u043E \u0430\u043B\u044C\u0431\u043E\u043C\u0430",
          unpinAlbum: "\u0417\u0430\u0431\u044B\u0442\u044C \u0446\u0432\u0435\u0442\u0430 \u044D\u0442\u043E\u0433\u043E \u0430\u043B\u044C\u0431\u043E\u043C\u0430",
          pinnedAlbum: "\u042D\u0442\u043E\u0442 \u0430\u043B\u044C\u0431\u043E\u043C \u0442\u0435\u043F\u0435\u0440\u044C \u0432\u0441\u0435\u0433\u0434\u0430 \u043F\u043E\u043B\u0443\u0447\u0430\u0435\u0442 \u044D\u0442\u0438 \u0446\u0432\u0435\u0442\u0430",
          unpinnedAlbum: "\u0426\u0432\u0435\u0442\u0430 \u0430\u043B\u044C\u0431\u043E\u043C\u0430 \u0437\u0430\u0431\u044B\u0442\u044B",
          playlistSchemeOn: "\u0418\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u044C \xAB{s}\xBB \u0434\u043B\u044F \u044D\u0442\u043E\u0433\u043E \u043F\u043B\u0435\u0439\u043B\u0438\u0441\u0442\u0430",
          playlistSchemeOff: "\u041F\u043B\u0435\u0439\u043B\u0438\u0441\u0442 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0435\u0442 \xAB{s}\xBB \u2013 \u0443\u0431\u0440\u0430\u0442\u044C",
          lyrSize: "\u0420\u0430\u0437\u043C\u0435\u0440 \u0442\u0435\u043A\u0441\u0442\u0430",
          lyrGap: "\u041C\u0435\u0436\u0441\u0442\u0440\u043E\u0447\u043D\u044B\u0439 \u0438\u043D\u0442\u0435\u0440\u0432\u0430\u043B",
          translate: "\u041F\u0435\u0440\u0435\u0432\u043E\u0434\u0438\u0442\u044C \u0442\u0435\u043A\u0441\u0442",
          translateHint: "\u041F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0435\u0442 \u043F\u0435\u0440\u0435\u0432\u043E\u0434 \u043F\u043E\u0434 \u043A\u0430\u0436\u0434\u043E\u0439 \u0441\u0442\u0440\u043E\u043A\u043E\u0439 \u2013 \u0441\u0442\u0440\u043E\u043A\u0438 \u043E\u0442\u043F\u0440\u0430\u0432\u043B\u044F\u044E\u0442\u0441\u044F \u0432 Google \u041F\u0435\u0440\u0435\u0432\u043E\u0434\u0447\u0438\u043A",
          canvas: "\u0412\u0438\u0434\u0435\u043E Canvas",
          canvasHint: "\u041A\u043E\u0440\u043E\u0442\u043A\u0438\u0435 \u0437\u0430\u0446\u0438\u043A\u043B\u0435\u043D\u043D\u044B\u0435 \u0432\u0438\u0434\u0435\u043E Spotify \u0437\u0430 \u043E\u0431\u043B\u043E\u0436\u043A\u043E\u0439, \u0435\u0441\u043B\u0438 \u0435\u0441\u0442\u044C",
          viz_particles: "\u0427\u0430\u0441\u0442\u0438\u0446\u044B",
          viz_line: "\u041B\u0438\u043D\u0438\u044F",
          viz_bottom: "\u0421\u0442\u043E\u043B\u0431\u0438\u043A\u0438 \u0441\u043D\u0438\u0437\u0443",
          c_base: "\u0424\u043E\u043D",
          c_accent: "\u0410\u043A\u0446\u0435\u043D\u0442",
          c_deep: "\u0422\u0451\u043C\u043D\u044B\u0439",
          c_light: "\u0421\u0432\u0435\u0442\u043B\u044B\u0439",
          schemeName: "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0441\u0445\u0435\u043C\u044B",
          schemeCodeHint: "\u0412\u0441\u0442\u0430\u0432\u044C \u0441\u044E\u0434\u0430 \u043A\u043E\u0434 \u0441\u0445\u0435\u043C\u044B, \u0447\u0442\u043E\u0431\u044B \u0438\u043C\u043F\u043E\u0440\u0442\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0435\u0451",
          schemeSave: "\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u0441\u0445\u0435\u043C\u0443",
          schemeCopy: "\u041A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u043A\u0430\u043A \u043A\u043E\u0434",
          schemeImport: "\u0418\u043C\u043F\u043E\u0440\u0442\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u043A\u043E\u0434",
          schemeNameTaken: "\u0412\u044B\u0431\u0435\u0440\u0438 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435, \u043D\u0435 \u0441\u043E\u0432\u043F\u0430\u0434\u0430\u044E\u0449\u0435\u0435 \u0441\u043E \u0432\u0441\u0442\u0440\u043E\u0435\u043D\u043D\u043E\u0439 \u0441\u0445\u0435\u043C\u043E\u0439",
          schemeDelete: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0441\u0445\u0435\u043C\u0443",
          copied: "\u0421\u043A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u043D\u043E",
          badCode: "\u041F\u043E\u0445\u043E\u0436\u0435, \u043A\u043E\u0434 \u043D\u0435\u0432\u0435\u0440\u043D\u044B\u0439",
          settingsCodeHint: "\u0412\u0441\u0442\u0430\u0432\u044C \u0441\u044E\u0434\u0430 \u043A\u043E\u0434 \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043A, \u0447\u0442\u043E\u0431\u044B \u0438\u043C\u043F\u043E\u0440\u0442\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0438\u0445",
          exportSettings: "\u041A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438",
          importSettings: "\u0418\u043C\u043F\u043E\u0440\u0442\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438",
          diagnostics: "\u041A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0434\u0438\u0430\u0433\u043D\u043E\u0441\u0442\u0438\u043A\u0443",
          reset: "\u0421\u0431\u0440\u043E\u0441\u0438\u0442\u044C",
          resetConfirm: "\u0421\u0431\u0440\u043E\u0441\u0438\u0442\u044C \u0432\u0441\u0435 \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438 Mirage? \u0421\u0432\u043E\u0438 \u0441\u0445\u0435\u043C\u044B \u0438 \u0437\u0430\u043F\u043E\u043C\u043D\u0435\u043D\u043D\u044B\u0435 \u0446\u0432\u0435\u0442\u0430 \u043E\u0441\u0442\u0430\u043D\u0443\u0442\u0441\u044F.",
          welcomeTitle: "\u0414\u043E\u0431\u0440\u043E \u043F\u043E\u0436\u0430\u043B\u043E\u0432\u0430\u0442\u044C \u0432 Mirage",
          welcomeText: "Ctrl + Shift + M \u043E\u0442\u043A\u0440\u044B\u0432\u0430\u0435\u0442 \u0440\u0435\u0436\u0438\u043C \u043F\u043E\u0433\u0440\u0443\u0436\u0435\u043D\u0438\u044F. \u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438 \u043D\u0430\u0445\u043E\u0434\u044F\u0442\u0441\u044F \u0432 \u043C\u0435\u043D\u044E \u043F\u0440\u043E\u0444\u0438\u043B\u044F.",
          welcomeImmersive: "\u041F\u043E\u043F\u0440\u043E\u0431\u043E\u0432\u0430\u0442\u044C \u0440\u0435\u0436\u0438\u043C \u043F\u043E\u0433\u0440\u0443\u0436\u0435\u043D\u0438\u044F",
          c_smart: "Smart Shuffle (S)",
          c_queue: "\u0414\u0430\u043B\u0435\u0435 \u0432 \u043E\u0447\u0435\u0440\u0435\u0434\u0438 (Q)",
          c_devices: "\u0423\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0430",
          c_timer: "\u0422\u0430\u0439\u043C\u0435\u0440 \u0441\u043D\u0430",
          queueEmpty: "\u041E\u0447\u0435\u0440\u0435\u0434\u044C \u043F\u0443\u0441\u0442\u0430",
          devicesNone: "\u0414\u0440\u0443\u0433\u0438\u0435 \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0430 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u044B",
          deviceActive: "\u0418\u0433\u0440\u0430\u0435\u0442 \u0437\u0434\u0435\u0441\u044C",
          timerTrack: "\u041A\u043E\u043D\u0435\u0446 \u044D\u0442\u043E\u0439 \u043F\u0435\u0441\u043D\u0438",
          timerOff: "\u0412\u044B\u043A\u043B.",
          timerLeft: "\u043E\u0441\u0442\u0430\u043B\u043E\u0441\u044C {m} \u043C\u0438\u043D",
          k_queue: "\u0414\u0430\u043B\u0435\u0435 \u0432 \u043E\u0447\u0435\u0440\u0435\u0434\u0438",
          overlayDownload: "\u0421\u043A\u0430\u0447\u0430\u0442\u044C \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0435 Overlay",
          overlayAllDownloads: "\u0412\u0441\u0435 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438",
          overlayConnected: "\u25CF Overlay \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0451\u043D",
          overlayMissing: "\u25CB Overlay \u043D\u0435 \u0437\u0430\u043F\u0443\u0449\u0435\u043D \u2013 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u0438 \u0435\u0433\u043E \u043A\u043D\u043E\u043F\u043A\u043E\u0439 \u043D\u0438\u0436\u0435 \u0438 \u0437\u0430\u043F\u0443\u0441\u0442\u0438 \u043E\u0434\u0438\u043D \u0440\u0430\u0437",
          onlineLyrics: "\u0418\u0441\u043A\u0430\u0442\u044C \u0442\u0435\u043A\u0441\u0442\u044B \u043E\u043D\u043B\u0430\u0439\u043D",
          onlineLyricsHint: "\u0415\u0441\u043B\u0438 \u0443 Spotify \u043D\u0435\u0442 \u0442\u0435\u043A\u0441\u0442\u0430, Mirage \u0441\u043F\u0440\u0430\u0448\u0438\u0432\u0430\u0435\u0442 LRCLIB \u2013 \u043E\u0442\u043F\u0440\u0430\u0432\u043B\u044F\u044E\u0442\u0441\u044F \u0442\u043E\u043B\u044C\u043A\u043E \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435, \u0438\u0441\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044C, \u0430\u043B\u044C\u0431\u043E\u043C \u0438 \u0434\u043B\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C",
          emptyTitle: "\u041D\u0435\u0442 \u0442\u0435\u043A\u0441\u0442\u0430 \u0434\u043B\u044F \u044D\u0442\u043E\u0439 \u043F\u0435\u0441\u043D\u0438",
          emptyText: "\u041D\u0438 \u0443 Spotify, \u043D\u0438 \u0443 LRCLIB \u043F\u043E\u043A\u0430 \u043D\u0435\u0442 \u0442\u0435\u043A\u0441\u0442\u0430.",
          emptyTextOff: "\u0423 Spotify \u0442\u0435\u043A\u0441\u0442\u0430 \u043D\u0435\u0442. \u0412\u043A\u043B\u044E\u0447\u0438 \xAB\u0418\u0441\u043A\u0430\u0442\u044C \u0442\u0435\u043A\u0441\u0442\u044B \u043E\u043D\u043B\u0430\u0439\u043D\xBB \u0432 \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430\u0445, \u0447\u0442\u043E\u0431\u044B \u0438\u0441\u043A\u0430\u0442\u044C \u0434\u0430\u043B\u044C\u0448\u0435.",
          instrTitle: "\u0418\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u0430\u043B",
          instrText: "\u0411\u0435\u0437 \u0441\u043B\u043E\u0432 \u2013 \u043F\u0440\u043E\u0441\u0442\u043E \u043D\u0430\u0441\u043B\u0430\u0436\u0434\u0430\u0439\u0441\u044F \u043C\u0443\u0437\u044B\u043A\u043E\u0439.",
          showViz: "\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u044C \u0432\u0438\u0437\u0443\u0430\u043B\u0438\u0437\u0430\u0442\u043E\u0440",
          searchWeb: "\u0418\u0441\u043A\u0430\u0442\u044C \u0432 \u0438\u043D\u0442\u0435\u0440\u043D\u0435\u0442\u0435",
          lyrPick: "\u0412\u044B\u0431\u0440\u0430\u0442\u044C \u0432\u0435\u0440\u0441\u0438\u044E",
          lyrPicked: "\u0432\u044B\u0431\u0440\u0430\u043D\u043E",
          lyrNone: "\u0411\u0435\u0437 \u0442\u0435\u043A\u0441\u0442\u0430",
          lyrAuto: "\u0410\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438",
          lyrAutoHint: "\u0421\u043D\u0430\u0447\u0430\u043B\u0430 Spotify, \u0437\u0430\u0442\u0435\u043C \u043B\u0443\u0447\u0448\u0435\u0435 \u0441\u043E\u0432\u043F\u0430\u0434\u0435\u043D\u0438\u0435 \u0438\u0437 LRCLIB",
          lyrNoVersions: "\u0412 LRCLIB \u043D\u0435\u0442 \u0434\u0440\u0443\u0433\u0438\u0445 \u0432\u0435\u0440\u0441\u0438\u0439 \u044D\u0442\u043E\u0439 \u043F\u0435\u0441\u043D\u0438",
          lyrSynced: "\u0441\u0438\u043D\u0445\u0440\u043E\u043D\u0438\u0437\u0438\u0440\u043E\u0432\u0430\u043D",
          lyrPlain: "\u0442\u043E\u043B\u044C\u043A\u043E \u0442\u0435\u043A\u0441\u0442",
          karaoke: "\u041A\u0430\u0440\u0430\u043E\u043A\u0435 \u043F\u043E \u0441\u043B\u043E\u0432\u0430\u043C",
          karaokeHint: "\u0421\u043B\u043E\u0432\u0430 \u043F\u043E\u0434\u0441\u0432\u0435\u0447\u0438\u0432\u0430\u044E\u0442\u0441\u044F \u043F\u043E \u043E\u0447\u0435\u0440\u0435\u0434\u0438 \u2013 \u0442\u043E\u0447\u043D\u043E \u043F\u043E \u0441\u043B\u043E\u0433\u0430\u043C \u0438\u0437 Spotify, \u0438\u043D\u0430\u0447\u0435 \u043F\u0440\u0438\u0431\u043B\u0438\u0437\u0438\u0442\u0435\u043B\u044C\u043D\u043E",
          font: "\u0428\u0440\u0438\u0444\u0442",
          fontHint: "\u041F\u0440\u0438\u043C\u0435\u043D\u044F\u0435\u0442\u0441\u044F \u043A\u043E \u0432\u0441\u0435\u043C\u0443 Spotify",
          font_outfit: "Outfit",
          font_jakarta: "Jakarta",
          font_manrope: "Manrope",
          font_sora: "Sora",
          font_lexend: "Lexend",
          font_nunito: "Nunito",
          font_system: "\u0421\u0438\u0441\u0442\u0435\u043C\u043D\u044B\u0439",
          shareMonth: "\u0422\u0432\u043E\u0439 \u043C\u0435\u0441\u044F\u0446 \u0432 \u0446\u0432\u0435\u0442\u0430\u0445",
          monthKicker: "Mirage \xB7 \u043F\u043E\u0441\u043B\u0435\u0434\u043D\u0438\u0435 30 \u0434\u043D\u0435\u0439",
          monthTitle: "\u0422\u0432\u043E\u0439 \u043C\u0435\u0441\u044F\u0446 \u0432 \u0446\u0432\u0435\u0442\u0430\u0445",
          monthDays: "\u0434\u043D\u0435\u0439",
          monthDaily: "\u0412\u0440\u0435\u043C\u044F \u043F\u0440\u043E\u0441\u043B\u0443\u0448\u0438\u0432\u0430\u043D\u0438\u044F \u043F\u043E \u0434\u043D\u044F\u043C",
          monthSongs: "\u0422\u043E\u043F \u043F\u0435\u0441\u0435\u043D",
          trToggle: "\u041F\u0435\u0440\u0435\u0432\u043E\u0434",
          trShow: "\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u044C \u043F\u0435\u0440\u0435\u0432\u043E\u0434",
          trHide: "\u0421\u043A\u0440\u044B\u0442\u044C \u043F\u0435\u0440\u0435\u0432\u043E\u0434",
          party_rave: "Rave",
          party_rock: "Rock",
          party_pop: "Pop",
          tabMix: "\u041C\u0438\u043A\u0441",
          tabParty: "\u0412\u0435\u0447\u0435\u0440\u0438\u043D\u043A\u0430",
          party_auto: "\u0410\u0432\u0442\u043E",
          party_bass: "\u0411\u0430\u0441",
          party_chill: "\u0427\u0438\u043B\u043B",
          partySection: "\u0420\u0435\u0436\u0438\u043C \u0432\u0435\u0447\u0435\u0440\u0438\u043D\u043A\u0438",
          partySectionHint: "\xAB\u0410\u0432\u0442\u043E\xBB \u043F\u043E\u0434\u0431\u0438\u0440\u0430\u0435\u0442 \u0441\u0442\u0438\u043B\u044C \u0434\u043B\u044F \u043A\u0430\u0436\u0434\u043E\u0439 \u043F\u0435\u0441\u043D\u0438 \u043F\u043E \u0436\u0430\u043D\u0440\u0443, \u0442\u0435\u043C\u043F\u0443 \u0438 \u0433\u0440\u043E\u043C\u043A\u043E\u0441\u0442\u0438",
          partyLevel: "\u0418\u043D\u0442\u0435\u043D\u0441\u0438\u0432\u043D\u043E\u0441\u0442\u044C",
          partyLevel1: "\u041C\u044F\u0433\u043A\u043E",
          partyLevel2: "\u041E\u0431\u044B\u0447\u043D\u043E",
          partyLevel3: "\u041C\u0430\u043A\u0441\u0438\u043C\u0443\u043C",
          partyFlash: "\u0426\u0432\u0435\u0442\u043E\u0432\u044B\u0435 \u0432\u0441\u043F\u044B\u0448\u043A\u0438",
          partyFlashHint: "\u041C\u044F\u0433\u043A\u0438\u0435 \u0446\u0432\u0435\u0442\u043E\u0432\u044B\u0435 \u0432\u043E\u043B\u043D\u044B \u0432 \u0442\u0430\u043A\u0442, \u043D\u0435 \u0431\u043E\u043B\u044C\u0448\u0435 \u043D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u0438\u0445 \u0432 \u0441\u0435\u043A\u0443\u043D\u0434\u0443. \u041E\u0442\u043A\u043B\u044E\u0447\u0435\u043D\u044B \u043F\u0440\u0438 \xAB\u0443\u043C\u0435\u043D\u044C\u0448\u0435\u043D\u0438\u0438 \u0434\u0432\u0438\u0436\u0435\u043D\u0438\u044F\xBB",
          scanCode: "\u0421\u043A\u0430\u043D\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0432 Spotify",
          partyJam: "\u041F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0442\u044C \u0433\u043E\u0441\u0442\u0435\u0439 Jam",
          partyJamHint: "\u0412\u043E \u0432\u0440\u0435\u043C\u044F Jam \u0432 Spotify \u0444\u043E\u0442\u043E \u043F\u0440\u043E\u0444\u0438\u043B\u0435\u0439 \u0432\u0441\u0435\u0445 \u0443\u0447\u0430\u0441\u0442\u043D\u0438\u043A\u043E\u0432 (\u0438 \u0442\u0432\u043E\u0451) \u043F\u043B\u0430\u0432\u0430\u044E\u0442 \u043F\u043E \u043A\u0440\u0430\u044F\u043C",
          jamYou: "\u0422\u044B"
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
          calm: "\u0421\u043F\u043E\u043A\u0456\u0439\u043D\u0438\u0439 \u0440\u0435\u0436\u0438\u043C",
          dialog: "\u0420\u0435\u0436\u0438\u043C \u0437\u0430\u043D\u0443\u0440\u0435\u043D\u043D\u044F Mirage",
          vizBeat: "\u0412\u0456\u0437\u0443\u0430\u043B\u0456\u0437\u0430\u0442\u043E\u0440 \xB7 \u0443 \u0442\u0430\u043A\u0442",
          vizAmbient: "\u0412\u0456\u0437\u0443\u0430\u043B\u0456\u0437\u0430\u0442\u043E\u0440 \xB7 \u0435\u043C\u0431\u0456\u0454\u043D\u0442",
          seek: "\u041F\u043E\u0437\u0438\u0446\u0456\u044F \u0432 \u043F\u0456\u0441\u043D\u0456",
          prev: "\u041D\u0430\u0437\u0430\u0434",
          play: "\u0412\u0456\u0434\u0442\u0432\u043E\u0440\u0438\u0442\u0438/\u041F\u0430\u0443\u0437\u0430",
          next: "\u0414\u0430\u043B\u0456",
          dynamic: "\u041A\u043E\u043B\u044C\u043E\u0440\u0438 \u0437 \u043E\u0431\u043A\u043B\u0430\u0434\u0438\u043D\u043A\u0438",
          dynamicHint: "\u0423\u0432\u0435\u0441\u044C \u0456\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441 \u043D\u0430\u0431\u0443\u0432\u0430\u0454 \u043A\u043E\u043B\u044C\u043E\u0440\u0456\u0432 \u043F\u0456\u0441\u043D\u0456",
          particles: "\u0421\u0432\u0456\u0442\u043B\u043E\u0432\u0438\u0439 \u043F\u0438\u043B",
          particlesHint: "\u041F\u043B\u0430\u0432\u0443\u0447\u0456 \u0441\u0432\u0456\u0442\u043B\u043E\u0432\u0456 \u0442\u043E\u0447\u043A\u0438 \u043D\u0430 \u0442\u043B\u0456",
          beat: "\u0422\u043B\u043E \u0432 \u0442\u0430\u043A\u0442",
          beatHint: "\u041F\u0443\u043B\u044C\u0441\u0443\u0454 \u0432 \u0442\u0430\u043A\u0442, \u043A\u043E\u043B\u0438 Spotify \u043D\u0430\u0434\u0430\u0454 \u0434\u0430\u043D\u0456 \u043F\u0440\u043E \u0440\u0438\u0442\u043C",
          cascade: "\u0410\u043D\u0456\u043C\u0430\u0446\u0456\u0457 \u0441\u0442\u043E\u0440\u0456\u043D\u043E\u043A",
          cascadeHint: "\u0412\u043C\u0456\u0441\u0442 \u043F\u043B\u0430\u0432\u043D\u043E \u0437'\u044F\u0432\u043B\u044F\u0454\u0442\u044C\u0441\u044F \u043F\u0456\u0434 \u0447\u0430\u0441 \u0437\u043C\u0456\u043D\u0438 \u0441\u0442\u043E\u0440\u0456\u043D\u043A\u0438",
          vinyl: "\u0412\u0456\u043D\u0456\u043B\u043E\u0432\u0430 \u043E\u0431\u043A\u043B\u0430\u0434\u0438\u043D\u043A\u0430",
          vinylHint: "\u041E\u0431\u043A\u043B\u0430\u0434\u0438\u043D\u043A\u0430 \u0432\u043D\u0438\u0437\u0443 \u043F\u0435\u0440\u0435\u0442\u0432\u043E\u0440\u044E\u0454\u0442\u044C\u0441\u044F \u043D\u0430 \u043F\u043B\u0430\u0442\u0456\u0432\u043A\u0443, \u0449\u043E \u043E\u0431\u0435\u0440\u0442\u0430\u0454\u0442\u044C\u0441\u044F",
          tilt: "3D-\u043A\u0430\u0440\u0442\u043A\u0438",
          tiltHint: "\u041A\u0430\u0440\u0442\u043A\u0438 \u043D\u0430\u0445\u0438\u043B\u044F\u044E\u0442\u044C\u0441\u044F \u0434\u043E \u0432\u043A\u0430\u0437\u0456\u0432\u043D\u0438\u043A\u0430 \u043C\u0438\u0448\u0456",
          burst: "\u0412\u0438\u0431\u0443\u0445 \u0441\u0435\u0440\u0434\u0435\u0446\u044C",
          burstHint: "\u0414\u043E\u0449 \u0456\u0441\u043A\u043E\u0440, \u043A\u043E\u043B\u0438 \u0442\u043E\u0431\u0456 \u043F\u043E\u0434\u043E\u0431\u0430\u0454\u0442\u044C\u0441\u044F \u043F\u0456\u0441\u043D\u044F",
          overlay: "Mirage Overlay",
          overlayHint: "\u041D\u0430\u0434\u0441\u0438\u043B\u0430\u0442\u0438 \u0437\u043C\u0456\u043D\u0443 \u043F\u0456\u0441\u0435\u043D\u044C \u0443 \u0437\u0430\u0441\u0442\u043E\u0441\u0443\u043D\u043E\u043A-\u043E\u0432\u0435\u0440\u043B\u0435\u0439 \u043F\u043E\u0437\u0430 Spotify",
          grain: "\u0417\u0435\u0440\u043D\u043E \u043F\u043B\u0456\u0432\u043A\u0438",
          grainHint: "\u041B\u0435\u0433\u043A\u0438\u0439 \u0448\u0443\u043C \u043F\u043E\u0432\u0435\u0440\u0445 \u0442\u043B\u0430",
          calmHint: "\u0417\u0443\u043F\u0438\u043D\u044F\u0454 \u0432\u0441\u0456 \u0444\u043E\u043D\u043E\u0432\u0456 \u0430\u043D\u0456\u043C\u0430\u0446\u0456\u0457",
          blur: "\u0420\u043E\u0437\u043C\u0438\u0442\u0442\u044F \u0441\u043A\u043B\u0430 (\u043B\u0438\u0448\u0435 \u0441\u043F\u0440\u0430\u0432\u0436\u043D\u0454 \u0441\u043A\u043B\u043E)",
          bright: "\u042F\u0441\u043A\u0440\u0430\u0432\u0456\u0441\u0442\u044C \u0442\u043B\u0430",
          vizSection: "\u0412\u0456\u0437\u0443\u0430\u043B\u0456\u0437\u0430\u0442\u043E\u0440",
          vizSectionHint: "\u0412\u0438\u0433\u043B\u044F\u0434 \u0432\u0456\u0437\u0443\u0430\u043B\u0456\u0437\u0430\u0442\u043E\u0440\u0430 \u0432 \u0440\u0435\u0436\u0438\u043C\u0456 \u0437\u0430\u043D\u0443\u0440\u0435\u043D\u043D\u044F \u2013 \u0437\u043C\u0456\u043D\u044E\u0454\u0442\u044C\u0441\u044F \u043E\u0434\u0440\u0430\u0437\u0443",
          viz_bars: "\u0421\u0442\u043E\u0432\u043F\u0447\u0438\u043A\u0438",
          viz_wave: "\u0425\u0432\u0438\u043B\u044F",
          viz_dots: "\u041A\u0440\u0430\u043F\u043A\u0438",
          vizBars: "\u041A\u0456\u043B\u044C\u043A\u0456\u0441\u0442\u044C \u0441\u0442\u043E\u0432\u043F\u0447\u0438\u043A\u0456\u0432",
          vizHeight: "\u0412\u0438\u0441\u043E\u0442\u0430",
          vizSmooth: "\u041F\u043B\u0430\u0432\u043D\u0456\u0441\u0442\u044C",
          vizGlow: "\u0421\u044F\u0439\u0432\u043E",
          vizRings: "\u041A\u0456\u043B\u044C\u0446\u044F \u0432 \u0442\u0430\u043A\u0442",
          vizMirror: "\u0414\u0437\u0435\u0440\u043A\u0430\u043B\u044C\u043D\u043E",
          vizSpin: "\u041F\u043E\u0432\u0456\u043B\u044C\u043D\u0435 \u043E\u0431\u0435\u0440\u0442\u0430\u043D\u043D\u044F",
          scheme: "\u041A\u043E\u043B\u0456\u0440\u043D\u0430 \u0441\u0445\u0435\u043C\u0430",
          schemeHint: "\u041F\u0435\u0440\u0435\u043C\u0438\u043A\u0430\u0454\u0442\u044C\u0441\u044F \u043C\u0438\u0442\u0442\u0454\u0432\u043E \u2013 Mirage \u0441\u0442\u0435\u0436\u0438\u0442\u044C \u0437\u0430 \u043E\u0431\u043A\u043B\u0430\u0434\u0438\u043D\u043A\u043E\u044E \u043D\u0430\u0436\u0438\u0432\u043E",
          glass: "\u0421\u043F\u0440\u0430\u0432\u0436\u043D\u0454 \u0441\u043A\u043B\u043E",
          glassHint: "\u0420\u043E\u0437\u043C\u0438\u0432\u0430\u0454 \u0442\u043B\u043E \u0437\u0430 \u043A\u043E\u0436\u043D\u043E\u044E \u043F\u0430\u043D\u0435\u043B\u043B\u044E \u043D\u0430\u0436\u0438\u0432\u043E \u2013 \u0433\u0430\u0440\u043D\u0456\u0448\u0435, \u0430\u043B\u0435 \u0441\u0438\u043B\u044C\u043D\u043E \u043D\u0430\u0432\u0430\u043D\u0442\u0430\u0436\u0443\u0454 \u0441\u0438\u0441\u0442\u0435\u043C\u0443",
          c_shuffle: "\u041F\u0435\u0440\u0435\u043C\u0456\u0448\u0430\u0442\u0438 (S)",
          c_repeat: "\u041F\u043E\u0432\u0442\u043E\u0440 (R)",
          c_like: "\u041F\u043E\u0434\u043E\u0431\u0430\u0454\u0442\u044C\u0441\u044F (L)",
          c_mute: "\u0411\u0435\u0437 \u0437\u0432\u0443\u043A\u0443",
          c_full: "\u041F\u043E\u0432\u043D\u0438\u0439 \u0435\u043A\u0440\u0430\u043D (F)",
          c_volume: "\u0413\u0443\u0447\u043D\u0456\u0441\u0442\u044C (\u2191 \u2193)",
          tip: "\u0420\u0435\u0436\u0438\u043C \u0437\u0430\u043D\u0443\u0440\u0435\u043D\u043D\u044F: Ctrl + Shift + M \u0430\u0431\u043E \u043A\u0440\u0443\u0433\u043B\u0430 \u043A\u043D\u043E\u043F\u043A\u0430 \u0432\u0433\u043E\u0440\u0456. \u0423\u0441\u0435\u0440\u0435\u0434\u0438\u043D\u0456: 1 \xB7 2 \xB7 3 \u0432\u0438\u0433\u043B\u044F\u0434, \u041F\u0440\u043E\u0431\u0456\u043B \u0432\u0456\u0434\u0442\u0432\u043E\u0440\u0435\u043D\u043D\u044F, \u2190 \u2192 \u043F\u0435\u0440\u0435\u043C\u043E\u0442\u0443\u0432\u0430\u043D\u043D\u044F, \u2191 \u2193 \u0433\u0443\u0447\u043D\u0456\u0441\u0442\u044C, L \u043F\u043E\u0434\u043E\u0431\u0430\u0454\u0442\u044C\u0441\u044F, S \u043F\u0435\u0440\u0435\u043C\u0456\u0448\u0430\u0442\u0438, R \u043F\u043E\u0432\u0442\u043E\u0440, F \u043F\u043E\u0432\u043D\u0438\u0439 \u0435\u043A\u0440\u0430\u043D.",
          presetTitle: "\u0412\u0438\u0433\u043B\u044F\u0434 \u0456 \u043F\u0440\u043E\u0434\u0443\u043A\u0442\u0438\u0432\u043D\u0456\u0441\u0442\u044C",
          presetHint: "\u041E\u0434\u0438\u043D \u043A\u043B\u0456\u043A \u043D\u0430\u043B\u0430\u0448\u0442\u043E\u0432\u0443\u0454 \u0432\u0441\u0435 \u2013 \u0442\u043E\u0447\u043D\u0435 \u043D\u0430\u043B\u0430\u0448\u0442\u0443\u0432\u0430\u043D\u043D\u044F \u043D\u0438\u0436\u0447\u0435",
          preset_full: "\u041F\u043E\u0432\u043D\u0438\u0439",
          preset_balanced: "\u0417\u0431\u0430\u043B\u0430\u043D\u0441\u043E\u0432\u0430\u043D\u0438\u0439",
          preset_light: "\u041B\u0435\u0433\u043A\u0438\u0439",
          preset_calm: "\u0421\u043F\u043E\u043A\u0456\u0439\u043D\u0438\u0439",
          presetCustom: "\u0412\u043B\u0430\u0441\u043D\u0438\u0439 \u2013 \u043E\u043A\u0440\u0435\u043C\u0456 \u043F\u0435\u0440\u0435\u043C\u0438\u043A\u0430\u0447\u0456 \u0437\u043C\u0456\u043D\u0435\u043D\u043E",
          perfStepped: "Mirage \u043F\u0440\u0430\u0446\u044E\u0432\u0430\u0432 \u0442\u0443\u0442 \u0456\u0437 {fps} fps \u0456 \u043F\u0435\u0440\u0435\u0439\u0448\u043E\u0432 \u043D\u0430 \xAB{preset}\xBB, \u0449\u043E\u0431 \u0443\u0441\u0435 \u0431\u0443\u043B\u043E \u043F\u043B\u0430\u0432\u043D\u043E.",
          autoPerf: "\u041D\u0430\u043B\u0430\u0448\u0442\u043E\u0432\u0443\u0432\u0430\u0442\u0438 \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u043D\u043E",
          autoPerfHint: "\u0417\u043D\u0438\u0436\u0443\u0454 \u0440\u0456\u0432\u0435\u043D\u044C \u043D\u0430 \u043E\u0434\u0438\u043D, \u044F\u043A\u0449\u043E \u041F\u041A \u043D\u0435 \u0432\u0441\u0442\u0438\u0433\u0430\u0454",
          costly: "\u0412\u0438\u0442\u0440\u0430\u0447\u0430\u0454 \u0440\u0435\u0441\u0443\u0440\u0441\u0438 \u0439 \u0437\u0430\u0440\u044F\u0434 \u0431\u0430\u0442\u0430\u0440\u0435\u0457",
          safeMode: "Spotify {v} \u0437\u043C\u0456\u043D\u0438\u0432 \u0441\u0432\u043E\u044E \u0441\u0442\u0440\u0443\u043A\u0442\u0443\u0440\u0443 \u2013 Mirage \u043F\u0440\u0430\u0446\u044E\u0454 \u0432 \u0431\u0435\u0437\u043F\u0435\u0447\u043D\u043E\u043C\u0443 \u0440\u0435\u0436\u0438\u043C\u0456 (\u043B\u0438\u0448\u0435 \u043A\u043E\u043B\u044C\u043E\u0440\u0438). \u041E\u043D\u043E\u0432\u043B\u0435\u043D\u043D\u044F Mirage \u0446\u0435 \u0432\u0438\u043F\u0440\u0430\u0432\u0438\u0442\u044C.",
          share: "\u041F\u043E\u0434\u0456\u043B\u0438\u0442\u0438\u0441\u044F \u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u043D\u044F\u043C",
          shareNow: "\u041F\u043E\u0434\u0456\u043B\u0438\u0442\u0438\u0441\u044F \u043F\u043E\u0442\u043E\u0447\u043D\u043E\u044E \u043F\u0456\u0441\u043D\u0435\u044E",
          shareWeek: "\u0422\u0432\u0456\u0439 \u0442\u0438\u0436\u0434\u0435\u043D\u044C \u0443 \u043A\u043E\u043B\u044C\u043E\u0440\u0430\u0445",
          shareCopied: "\u0417\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u043D\u044F \u0441\u043A\u043E\u043F\u0456\u0439\u043E\u0432\u0430\u043D\u043E \u2013 \u0456 \u0437\u0431\u0435\u0440\u0435\u0436\u0435\u043D\u043E \u0432 \xAB\u0417\u0430\u0432\u0430\u043D\u0442\u0430\u0436\u0435\u043D\u043D\u044F\xBB",
          shareSaved: "\u0417\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u043D\u044F \u0437\u0431\u0435\u0440\u0435\u0436\u0435\u043D\u043E \u0432 \xAB\u0417\u0430\u0432\u0430\u043D\u0442\u0430\u0436\u0435\u043D\u043D\u044F\xBB",
          weekKicker: "Mirage \xB7 \u043E\u0441\u0442\u0430\u043D\u043D\u0456 7 \u0434\u043D\u0456\u0432",
          weekTitle: "\u0422\u0432\u0456\u0439 \u0442\u0438\u0436\u0434\u0435\u043D\u044C \u0443 \u043A\u043E\u043B\u044C\u043E\u0440\u0430\u0445",
          weekSongs: "\u043F\u0456\u0441\u0435\u043D\u044C",
          weekMinutes: "\u0445\u0432\u0438\u043B\u0438\u043D",
          weekColours: "\u041A\u043E\u043B\u044C\u043E\u0440\u0438 \u0442\u0432\u043E\u0457\u0445 \u043E\u0431\u043A\u043B\u0430\u0434\u0438\u043D\u043E\u043A",
          weekArtists: "\u041D\u0430\u0439\u0447\u0430\u0441\u0442\u0456\u0448\u0435",
          weekEmpty: "\u041F\u043E\u0441\u043B\u0443\u0445\u0430\u0439 \u043A\u0456\u043B\u044C\u043A\u0430 \u043F\u0456\u0441\u0435\u043D\u044C \u2013 \u0442\u0438\u0436\u0434\u0435\u043D\u044C \u043F\u043E\u0447\u043D\u0435 \u0437\u0430\u043F\u043E\u0432\u043D\u044E\u0432\u0430\u0442\u0438\u0441\u044F.",
          weekScheme: "\u0423\u043B\u044E\u0431\u043B\u0435\u043D\u0430 \u0441\u0445\u0435\u043C\u0430: {s}",
          keysTitle: "\u0421\u043F\u043E\u043B\u0443\u0447\u0435\u043D\u043D\u044F \u043A\u043B\u0430\u0432\u0456\u0448",
          k_play: "\u0412\u0456\u0434\u0442\u0432\u043E\u0440\u0435\u043D\u043D\u044F / \u043F\u0430\u0443\u0437\u0430",
          k_seek: "\u041F\u0435\u0440\u0435\u043C\u043E\u0442\u0443\u0432\u0430\u043D\u043D\u044F \u043D\u0430 5 \u0441",
          k_vol: "\u0413\u0443\u0447\u043D\u0456\u0441\u0442\u044C",
          k_view: "\u041E\u0431\u043A\u043B\u0430\u0434\u0438\u043D\u043A\u0430 \xB7 \u0442\u0435\u043A\u0441\u0442 \xB7 \u0432\u0456\u0437\u0443\u0430\u043B\u0456\u0437\u0430\u0442\u043E\u0440 \xB7 \u041C\u0456\u043A\u0441 \xB7 \u0412\u0435\u0447\u0456\u0440\u043A\u0430",
          k_like: "\u041F\u043E\u0434\u043E\u0431\u0430\u0454\u0442\u044C\u0441\u044F",
          k_shuffle: "\u041F\u0435\u0440\u0435\u043C\u0456\u0448\u0430\u0442\u0438",
          k_repeat: "\u041F\u043E\u0432\u0442\u043E\u0440",
          k_full: "\u041F\u043E\u0432\u043D\u0438\u0439 \u0435\u043A\u0440\u0430\u043D",
          k_next: "\u041D\u0430\u0441\u0442\u0443\u043F\u043D\u0430 / \u043F\u043E\u043F\u0435\u0440\u0435\u0434\u043D\u044F",
          k_close: "\u0417\u0430\u043A\u0440\u0438\u0442\u0438",
          unsynced: "\u0426\u0435\u0439 \u0442\u0435\u043A\u0441\u0442 \u043D\u0435 \u0441\u0438\u043D\u0445\u0440\u043E\u043D\u0456\u0437\u043E\u0432\u0430\u043D\u043E \u2013 \u0432\u0456\u043D \u043F\u0440\u043E\u043A\u0440\u0443\u0447\u0443\u0454\u0442\u044C\u0441\u044F \u0432\u0456\u043B\u044C\u043D\u043E.",
          g_colours: "\u041A\u043E\u043B\u044C\u043E\u0440\u0438",
          g_background: "\u0422\u043B\u043E",
          g_motion: "\u0410\u043D\u0456\u043C\u0430\u0446\u0456\u0457",
          g_immersive: "\u0420\u0435\u0436\u0438\u043C \u0437\u0430\u043D\u0443\u0440\u0435\u043D\u043D\u044F",
          g_builder: "\u0412\u043B\u0430\u0441\u043D\u0430 \u0441\u0445\u0435\u043C\u0430",
          g_overlay: "\u041E\u0432\u0435\u0440\u043B\u0435\u0439",
          g_more: "\u041F\u043E\u0434\u0456\u043B\u0438\u0442\u0438\u0441\u044F, \u0440\u0435\u0437\u0435\u0440\u0432\u043D\u0430 \u043A\u043E\u043F\u0456\u044F \u0439 \u0434\u043E\u0432\u0456\u0434\u043A\u0430",
          freeze: "\u0417\u0430\u043C\u043E\u0440\u043E\u0437\u0438\u0442\u0438 \u043A\u043E\u043B\u044C\u043E\u0440\u0438",
          freezeHint: "\u0417\u0431\u0435\u0440\u0456\u0433\u0430\u0454 \u043F\u043E\u0442\u043E\u0447\u043D\u0456 \u043A\u043E\u043B\u044C\u043E\u0440\u0438, \u0445\u043E\u0447 \u0431\u0438 \u0449\u043E \u0433\u0440\u0430\u043B\u043E",
          pinAlbum: "\u0417\u0430\u043F\u0430\u043C'\u044F\u0442\u0430\u0442\u0438 \u043A\u043E\u043B\u044C\u043E\u0440\u0438 \u0446\u044C\u043E\u0433\u043E \u0430\u043B\u044C\u0431\u043E\u043C\u0443",
          unpinAlbum: "\u0417\u0430\u0431\u0443\u0442\u0438 \u043A\u043E\u043B\u044C\u043E\u0440\u0438 \u0446\u044C\u043E\u0433\u043E \u0430\u043B\u044C\u0431\u043E\u043C\u0443",
          pinnedAlbum: "\u0426\u0435\u0439 \u0430\u043B\u044C\u0431\u043E\u043C \u0442\u0435\u043F\u0435\u0440 \u0437\u0430\u0432\u0436\u0434\u0438 \u043C\u0430\u0442\u0438\u043C\u0435 \u0446\u0456 \u043A\u043E\u043B\u044C\u043E\u0440\u0438",
          unpinnedAlbum: "\u041A\u043E\u043B\u044C\u043E\u0440\u0438 \u0430\u043B\u044C\u0431\u043E\u043C\u0443 \u0437\u0430\u0431\u0443\u0442\u043E",
          playlistSchemeOn: "\u0412\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u043E\u0432\u0443\u0432\u0430\u0442\u0438 \xAB{s}\xBB \u0434\u043B\u044F \u0446\u044C\u043E\u0433\u043E \u043F\u043B\u0435\u0439\u043B\u0438\u0441\u0442\u0430",
          playlistSchemeOff: "\u041F\u043B\u0435\u0439\u043B\u0438\u0441\u0442 \u0432\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u043E\u0432\u0443\u0454 \xAB{s}\xBB \u2013 \u043F\u0440\u0438\u0431\u0440\u0430\u0442\u0438",
          lyrSize: "\u0420\u043E\u0437\u043C\u0456\u0440 \u0442\u0435\u043A\u0441\u0442\u0443",
          lyrGap: "\u041C\u0456\u0436\u0440\u044F\u0434\u043A\u043E\u0432\u0438\u0439 \u0456\u043D\u0442\u0435\u0440\u0432\u0430\u043B",
          translate: "\u041F\u0435\u0440\u0435\u043A\u043B\u0430\u0434\u0430\u0442\u0438 \u0442\u0435\u043A\u0441\u0442",
          translateHint: "\u041F\u043E\u043A\u0430\u0437\u0443\u0454 \u043F\u0435\u0440\u0435\u043A\u043B\u0430\u0434 \u043F\u0456\u0434 \u043A\u043E\u0436\u043D\u0438\u043C \u0440\u044F\u0434\u043A\u043E\u043C \u2013 \u0440\u044F\u0434\u043A\u0438 \u043D\u0430\u0434\u0441\u0438\u043B\u0430\u044E\u0442\u044C\u0441\u044F \u0434\u043E Google \u041F\u0435\u0440\u0435\u043A\u043B\u0430\u0434\u0430\u0447\u0430",
          canvas: "\u0412\u0456\u0434\u0435\u043E Canvas",
          canvasHint: "\u041A\u043E\u0440\u043E\u0442\u043A\u0456 \u0437\u0430\u0446\u0438\u043A\u043B\u0435\u043D\u0456 \u0432\u0456\u0434\u0435\u043E Spotify \u0437\u0430 \u043E\u0431\u043A\u043B\u0430\u0434\u0438\u043D\u043A\u043E\u044E, \u044F\u043A\u0449\u043E \u0454",
          viz_particles: "\u0427\u0430\u0441\u0442\u0438\u043D\u043A\u0438",
          viz_line: "\u041B\u0456\u043D\u0456\u044F",
          viz_bottom: "\u0421\u0442\u043E\u0432\u043F\u0447\u0438\u043A\u0438 \u0437\u043D\u0438\u0437\u0443",
          c_base: "\u0422\u043B\u043E",
          c_accent: "\u0410\u043A\u0446\u0435\u043D\u0442",
          c_deep: "\u0422\u0435\u043C\u043D\u0438\u0439",
          c_light: "\u0421\u0432\u0456\u0442\u043B\u0438\u0439",
          schemeName: "\u041D\u0430\u0437\u0432\u0430 \u0441\u0445\u0435\u043C\u0438",
          schemeCodeHint: "\u0412\u0441\u0442\u0430\u0432 \u0441\u044E\u0434\u0438 \u043A\u043E\u0434 \u0441\u0445\u0435\u043C\u0438, \u0449\u043E\u0431 \u0456\u043C\u043F\u043E\u0440\u0442\u0443\u0432\u0430\u0442\u0438 \u0457\u0457",
          schemeSave: "\u0417\u0431\u0435\u0440\u0435\u0433\u0442\u0438 \u0441\u0445\u0435\u043C\u0443",
          schemeCopy: "\u041A\u043E\u043F\u0456\u044E\u0432\u0430\u0442\u0438 \u044F\u043A \u043A\u043E\u0434",
          schemeImport: "\u0406\u043C\u043F\u043E\u0440\u0442\u0443\u0432\u0430\u0442\u0438 \u043A\u043E\u0434",
          schemeNameTaken: "\u041E\u0431\u0435\u0440\u0438 \u043D\u0430\u0437\u0432\u0443, \u0449\u043E \u043D\u0435 \u0437\u0431\u0456\u0433\u0430\u0454\u0442\u044C\u0441\u044F \u0437 \u0432\u0431\u0443\u0434\u043E\u0432\u0430\u043D\u043E\u044E \u0441\u0445\u0435\u043C\u043E\u044E",
          schemeDelete: "\u0412\u0438\u0434\u0430\u043B\u0438\u0442\u0438 \u0441\u0445\u0435\u043C\u0443",
          copied: "\u0421\u043A\u043E\u043F\u0456\u0439\u043E\u0432\u0430\u043D\u043E",
          badCode: "\u0421\u0445\u043E\u0436\u0435, \u043A\u043E\u0434 \u043D\u0435\u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u0438\u0439",
          settingsCodeHint: "\u0412\u0441\u0442\u0430\u0432 \u0441\u044E\u0434\u0438 \u043A\u043E\u0434 \u043D\u0430\u043B\u0430\u0448\u0442\u0443\u0432\u0430\u043D\u044C, \u0449\u043E\u0431 \u0456\u043C\u043F\u043E\u0440\u0442\u0443\u0432\u0430\u0442\u0438 \u0457\u0445",
          exportSettings: "\u041A\u043E\u043F\u0456\u044E\u0432\u0430\u0442\u0438 \u043D\u0430\u043B\u0430\u0448\u0442\u0443\u0432\u0430\u043D\u043D\u044F",
          importSettings: "\u0406\u043C\u043F\u043E\u0440\u0442\u0443\u0432\u0430\u0442\u0438 \u043D\u0430\u043B\u0430\u0448\u0442\u0443\u0432\u0430\u043D\u043D\u044F",
          diagnostics: "\u041A\u043E\u043F\u0456\u044E\u0432\u0430\u0442\u0438 \u0434\u0456\u0430\u0433\u043D\u043E\u0441\u0442\u0438\u043A\u0443",
          reset: "\u0421\u043A\u0438\u043D\u0443\u0442\u0438",
          resetConfirm: "\u0421\u043A\u0438\u043D\u0443\u0442\u0438 \u0432\u0441\u0456 \u043D\u0430\u043B\u0430\u0448\u0442\u0443\u0432\u0430\u043D\u043D\u044F Mirage? \u0412\u043B\u0430\u0441\u043D\u0456 \u0441\u0445\u0435\u043C\u0438 \u0439 \u0437\u0430\u043F\u0430\u043C'\u044F\u0442\u043E\u0432\u0430\u043D\u0456 \u043A\u043E\u043B\u044C\u043E\u0440\u0438 \u0437\u0430\u043B\u0438\u0448\u0430\u0442\u044C\u0441\u044F.",
          welcomeTitle: "\u041B\u0430\u0441\u043A\u0430\u0432\u043E \u043F\u0440\u043E\u0441\u0438\u043C\u043E \u0434\u043E Mirage",
          welcomeText: "Ctrl + Shift + M \u0432\u0456\u0434\u043A\u0440\u0438\u0432\u0430\u0454 \u0440\u0435\u0436\u0438\u043C \u0437\u0430\u043D\u0443\u0440\u0435\u043D\u043D\u044F. \u041D\u0430\u043B\u0430\u0448\u0442\u0443\u0432\u0430\u043D\u043D\u044F \u0454 \u0432 \u043C\u0435\u043D\u044E \u043F\u0440\u043E\u0444\u0456\u043B\u044E.",
          welcomeImmersive: "\u0421\u043F\u0440\u043E\u0431\u0443\u0432\u0430\u0442\u0438 \u0440\u0435\u0436\u0438\u043C \u0437\u0430\u043D\u0443\u0440\u0435\u043D\u043D\u044F",
          c_smart: "Smart Shuffle (S)",
          c_queue: "\u0414\u0430\u043B\u0456 \u0432 \u0447\u0435\u0440\u0437\u0456 (Q)",
          c_devices: "\u041F\u0440\u0438\u0441\u0442\u0440\u043E\u0457",
          c_timer: "\u0422\u0430\u0439\u043C\u0435\u0440 \u0441\u043D\u0443",
          queueEmpty: "\u0427\u0435\u0440\u0433\u0430 \u043F\u043E\u0440\u043E\u0436\u043D\u044F",
          devicesNone: "\u0406\u043D\u0448\u0438\u0445 \u043F\u0440\u0438\u0441\u0442\u0440\u043E\u0457\u0432 \u043D\u0435 \u0437\u043D\u0430\u0439\u0434\u0435\u043D\u043E",
          deviceActive: "\u0413\u0440\u0430\u0454 \u0442\u0443\u0442",
          timerTrack: "\u041A\u0456\u043D\u0435\u0446\u044C \u0446\u0456\u0454\u0457 \u043F\u0456\u0441\u043D\u0456",
          timerOff: "\u0412\u0438\u043C\u043A.",
          timerLeft: "\u0437\u0430\u043B\u0438\u0448\u0438\u043B\u043E\u0441\u044F {m} \u0445\u0432",
          k_queue: "\u0414\u0430\u043B\u0456 \u0432 \u0447\u0435\u0440\u0437\u0456",
          overlayDownload: "\u0417\u0430\u0432\u0430\u043D\u0442\u0430\u0436\u0438\u0442\u0438 \u0437\u0430\u0441\u0442\u043E\u0441\u0443\u043D\u043E\u043A Overlay",
          overlayAllDownloads: "\u0423\u0441\u0456 \u0437\u0430\u0432\u0430\u043D\u0442\u0430\u0436\u0435\u043D\u043D\u044F",
          overlayConnected: "\u25CF Overlay \u043F\u0456\u0434'\u0454\u0434\u043D\u0430\u043D\u043E",
          overlayMissing: "\u25CB Overlay \u043D\u0435 \u0437\u0430\u043F\u0443\u0449\u0435\u043D\u043E \u2013 \u0432\u0441\u0442\u0430\u043D\u043E\u0432\u0438 \u0439\u043E\u0433\u043E \u043A\u043D\u043E\u043F\u043A\u043E\u044E \u043D\u0438\u0436\u0447\u0435 \u0439 \u0437\u0430\u043F\u0443\u0441\u0442\u0438 \u043E\u0434\u0438\u043D \u0440\u0430\u0437",
          onlineLyrics: "\u0428\u0443\u043A\u0430\u0442\u0438 \u0442\u0435\u043A\u0441\u0442\u0438 \u043E\u043D\u043B\u0430\u0439\u043D",
          onlineLyricsHint: "\u042F\u043A\u0449\u043E \u0432 Spotify \u043D\u0435\u043C\u0430\u0454 \u0442\u0435\u043A\u0441\u0442\u0443, Mirage \u0437\u0430\u043F\u0438\u0442\u0443\u0454 LRCLIB \u2013 \u043D\u0430\u0434\u0441\u0438\u043B\u0430\u044E\u0442\u044C\u0441\u044F \u043B\u0438\u0448\u0435 \u043D\u0430\u0437\u0432\u0430, \u0432\u0438\u043A\u043E\u043D\u0430\u0432\u0435\u0446\u044C, \u0430\u043B\u044C\u0431\u043E\u043C \u0456 \u0442\u0440\u0438\u0432\u0430\u043B\u0456\u0441\u0442\u044C",
          emptyTitle: "\u041D\u0435\u043C\u0430\u0454 \u0442\u0435\u043A\u0441\u0442\u0443 \u0434\u043B\u044F \u0446\u0456\u0454\u0457 \u043F\u0456\u0441\u043D\u0456",
          emptyText: "\u041D\u0456 \u0432 Spotify, \u043D\u0456 \u0432 LRCLIB \u043F\u043E\u043A\u0438 \u043D\u0435\u043C\u0430\u0454 \u0442\u0435\u043A\u0441\u0442\u0443.",
          emptyTextOff: "\u0423 Spotify \u0442\u0435\u043A\u0441\u0442\u0443 \u043D\u0435\u043C\u0430\u0454. \u0423\u0432\u0456\u043C\u043A\u043D\u0438 \xAB\u0428\u0443\u043A\u0430\u0442\u0438 \u0442\u0435\u043A\u0441\u0442\u0438 \u043E\u043D\u043B\u0430\u0439\u043D\xBB \u0443 \u043D\u0430\u043B\u0430\u0448\u0442\u0443\u0432\u0430\u043D\u043D\u044F\u0445, \u0449\u043E\u0431 \u0448\u0443\u043A\u0430\u0442\u0438 \u0434\u0430\u043B\u0456.",
          instrTitle: "\u0406\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u0430\u043B",
          instrText: "\u0411\u0435\u0437 \u0441\u043B\u0456\u0432 \u2013 \u043F\u0440\u043E\u0441\u0442\u043E \u043D\u0430\u0441\u043E\u043B\u043E\u0434\u0436\u0443\u0439\u0441\u044F \u043C\u0443\u0437\u0438\u043A\u043E\u044E.",
          showViz: "\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u0438 \u0432\u0456\u0437\u0443\u0430\u043B\u0456\u0437\u0430\u0442\u043E\u0440",
          searchWeb: "\u0428\u0443\u043A\u0430\u0442\u0438 \u0432 \u0456\u043D\u0442\u0435\u0440\u043D\u0435\u0442\u0456",
          lyrPick: "\u0412\u0438\u0431\u0440\u0430\u0442\u0438 \u0432\u0435\u0440\u0441\u0456\u044E",
          lyrPicked: "\u0432\u0438\u0431\u0440\u0430\u043D\u043E",
          lyrNone: "\u0411\u0435\u0437 \u0442\u0435\u043A\u0441\u0442\u0443",
          lyrAuto: "\u0410\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u043D\u043E",
          lyrAutoHint: "\u0421\u043F\u0435\u0440\u0448\u0443 Spotify, \u043F\u043E\u0442\u0456\u043C \u043D\u0430\u0439\u043A\u0440\u0430\u0449\u0438\u0439 \u0437\u0431\u0456\u0433 \u0456\u0437 LRCLIB",
          lyrNoVersions: "\u0423 LRCLIB \u043D\u0435\u043C\u0430\u0454 \u0456\u043D\u0448\u0438\u0445 \u0432\u0435\u0440\u0441\u0456\u0439 \u0446\u0456\u0454\u0457 \u043F\u0456\u0441\u043D\u0456",
          lyrSynced: "\u0441\u0438\u043D\u0445\u0440\u043E\u043D\u0456\u0437\u043E\u0432\u0430\u043D\u043E",
          lyrPlain: "\u043B\u0438\u0448\u0435 \u0442\u0435\u043A\u0441\u0442",
          karaoke: "\u041A\u0430\u0440\u0430\u043E\u043A\u0435 \u0441\u043B\u043E\u0432\u043E \u0437\u0430 \u0441\u043B\u043E\u0432\u043E\u043C",
          karaokeHint: "\u0421\u043B\u043E\u0432\u0430 \u043F\u0456\u0434\u0441\u0432\u0456\u0447\u0443\u044E\u0442\u044C\u0441\u044F \u043F\u043E \u0447\u0435\u0440\u0437\u0456 \u2013 \u0442\u043E\u0447\u043D\u043E \u0437\u0430 \u0441\u043A\u043B\u0430\u0434\u0430\u043C\u0438 \u0437\u0456 Spotify, \u0456\u043D\u0430\u043A\u0448\u0435 \u043F\u0440\u0438\u0431\u043B\u0438\u0437\u043D\u043E",
          font: "\u0428\u0440\u0438\u0444\u0442",
          fontHint: "\u0417\u0430\u0441\u0442\u043E\u0441\u043E\u0432\u0443\u0454\u0442\u044C\u0441\u044F \u0434\u043E \u0432\u0441\u044C\u043E\u0433\u043E Spotify",
          font_outfit: "Outfit",
          font_jakarta: "Jakarta",
          font_manrope: "Manrope",
          font_sora: "Sora",
          font_lexend: "Lexend",
          font_nunito: "Nunito",
          font_system: "\u0421\u0438\u0441\u0442\u0435\u043C\u043D\u0438\u0439",
          shareMonth: "\u0422\u0432\u0456\u0439 \u043C\u0456\u0441\u044F\u0446\u044C \u0443 \u043A\u043E\u043B\u044C\u043E\u0440\u0430\u0445",
          monthKicker: "Mirage \xB7 \u043E\u0441\u0442\u0430\u043D\u043D\u0456 30 \u0434\u043D\u0456\u0432",
          monthTitle: "\u0422\u0432\u0456\u0439 \u043C\u0456\u0441\u044F\u0446\u044C \u0443 \u043A\u043E\u043B\u044C\u043E\u0440\u0430\u0445",
          monthDays: "\u0434\u043D\u0456\u0432",
          monthDaily: "\u0427\u0430\u0441 \u043F\u0440\u043E\u0441\u043B\u0443\u0445\u043E\u0432\u0443\u0432\u0430\u043D\u043D\u044F \u0437\u0430 \u0434\u043D\u044F\u043C\u0438",
          monthSongs: "\u0422\u043E\u043F \u043F\u0456\u0441\u0435\u043D\u044C",
          trToggle: "\u041F\u0435\u0440\u0435\u043A\u043B\u0430\u0434",
          trShow: "\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u0438 \u043F\u0435\u0440\u0435\u043A\u043B\u0430\u0434",
          trHide: "\u0421\u0445\u043E\u0432\u0430\u0442\u0438 \u043F\u0435\u0440\u0435\u043A\u043B\u0430\u0434",
          party_rave: "Rave",
          party_rock: "Rock",
          party_pop: "Pop",
          tabMix: "\u041C\u0456\u043A\u0441",
          tabParty: "\u0412\u0435\u0447\u0456\u0440\u043A\u0430",
          party_auto: "\u0410\u0432\u0442\u043E",
          party_bass: "\u0411\u0430\u0441",
          party_chill: "\u0427\u0438\u043B",
          partySection: "\u0420\u0435\u0436\u0438\u043C \u0432\u0435\u0447\u0456\u0440\u043A\u0438",
          partySectionHint: "\xAB\u0410\u0432\u0442\u043E\xBB \u0434\u043E\u0431\u0438\u0440\u0430\u0454 \u0441\u0442\u0438\u043B\u044C \u0434\u043B\u044F \u043A\u043E\u0436\u043D\u043E\u0457 \u043F\u0456\u0441\u043D\u0456 \u0437\u0430 \u0436\u0430\u043D\u0440\u043E\u043C, \u0442\u0435\u043C\u043F\u043E\u043C \u0456 \u0433\u0443\u0447\u043D\u0456\u0441\u0442\u044E",
          partyLevel: "\u0406\u043D\u0442\u0435\u043D\u0441\u0438\u0432\u043D\u0456\u0441\u0442\u044C",
          partyLevel1: "\u041C'\u044F\u043A\u043E",
          partyLevel2: "\u0417\u0432\u0438\u0447\u0430\u0439\u043D\u043E",
          partyLevel3: "\u041C\u0430\u043A\u0441\u0438\u043C\u0443\u043C",
          partyFlash: "\u041A\u043E\u043B\u044C\u043E\u0440\u043E\u0432\u0456 \u0441\u043F\u0430\u043B\u0430\u0445\u0438",
          partyFlashHint: "\u041C'\u044F\u043A\u0456 \u043A\u043E\u043B\u044C\u043E\u0440\u043E\u0432\u0456 \u0445\u0432\u0438\u043B\u0456 \u0432 \u0442\u0430\u043A\u0442, \u043D\u0435 \u0431\u0456\u043B\u044C\u0448\u0435 \u043A\u0456\u043B\u044C\u043A\u043E\u0445 \u043D\u0430 \u0441\u0435\u043A\u0443\u043D\u0434\u0443. \u0412\u0438\u043C\u043A\u043D\u0435\u043D\u0456 \u043F\u0440\u0438 \xAB\u0437\u043C\u0435\u043D\u0448\u0435\u043D\u043D\u0456 \u0440\u0443\u0445\u0443\xBB",
          scanCode: "\u0421\u043A\u0430\u043D\u0443\u0432\u0430\u0442\u0438 \u0432 Spotify",
          partyJam: "\u041F\u043E\u043A\u0430\u0437\u0443\u0432\u0430\u0442\u0438 \u0433\u043E\u0441\u0442\u0435\u0439 Jam",
          partyJamHint: "\u041F\u0456\u0434 \u0447\u0430\u0441 Jam \u0443 Spotify \u0444\u043E\u0442\u043E \u043F\u0440\u043E\u0444\u0456\u043B\u0456\u0432 \u0443\u0441\u0456\u0445 \u0443\u0447\u0430\u0441\u043D\u0438\u043A\u0456\u0432 (\u0456 \u0442\u0432\u043E\u0454) \u043F\u043B\u0438\u0432\u0443\u0442\u044C \u043A\u0440\u0430\u044F\u043C\u0438",
          jamYou: "\u0422\u0438"
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
          bright: "\u80CC\u666F\u306E\u660E\u308B\u3055",
          dynamicHint: "\u30A4\u30F3\u30BF\u30FC\u30D5\u30A7\u30FC\u30B9\u5168\u4F53\u304C\u66F2\u306E\u8272\u306B\u67D3\u307E\u308A\u307E\u3059",
          particlesHint: "\u80CC\u666F\u306B\u5149\u306E\u7C92\u304C\u3075\u308F\u308A\u3068\u6F02\u3044\u307E\u3059",
          beatHint: "Spotify \u304C\u30D3\u30FC\u30C8\u60C5\u5831\u3092\u63D0\u4F9B\u3059\u308B\u3068\u62CD\u306B\u5408\u308F\u305B\u3066\u8108\u6253\u3061\u307E\u3059",
          cascadeHint: "\u30DA\u30FC\u30B8\u3092\u5207\u308A\u66FF\u3048\u308B\u3068\u30B3\u30F3\u30C6\u30F3\u30C4\u304C\u3059\u3063\u3068\u73FE\u308C\u307E\u3059",
          vinylHint: "\u4E0B\u90E8\u306E\u30B8\u30E3\u30B1\u30C3\u30C8\u304C\u56DE\u8EE2\u3059\u308B\u30EC\u30B3\u30FC\u30C9\u306B\u306A\u308A\u307E\u3059",
          tiltHint: "\u30AB\u30FC\u30C9\u304C\u30DE\u30A6\u30B9\u30DD\u30A4\u30F3\u30BF\u30FC\u306E\u65B9\u3078\u50BE\u304D\u307E\u3059",
          burstHint: "\u66F2\u306B\u3044\u3044\u306D\u3059\u308B\u3068\u706B\u82B1\u304C\u821E\u3044\u307E\u3059",
          overlay: "Mirage Overlay",
          overlayHint: "\u66F2\u306E\u5207\u308A\u66FF\u3048\u3092 Spotify \u5916\u306E\u30AA\u30FC\u30D0\u30FC\u30EC\u30A4\u30A2\u30D7\u30EA\u306B\u9001\u4FE1\u3057\u307E\u3059",
          grainHint: "\u80CC\u666F\u306B\u7D30\u304B\u306A\u30CE\u30A4\u30BA\u3092\u91CD\u306D\u307E\u3059",
          calmHint: "\u80CC\u666F\u30A2\u30CB\u30E1\u30FC\u30B7\u30E7\u30F3\u3092\u3059\u3079\u3066\u6B62\u3081\u307E\u3059",
          vizSection: "\u30D3\u30B8\u30E5\u30A2\u30E9\u30A4\u30B6\u30FC",
          vizSectionHint: "\u30A4\u30DE\u30FC\u30B7\u30D6\u30E2\u30FC\u30C9\u3067\u306E\u30D3\u30B8\u30E5\u30A2\u30E9\u30A4\u30B6\u30FC\u306E\u898B\u305F\u76EE \u2013 \u3059\u3050\u306B\u53CD\u6620\u3055\u308C\u307E\u3059",
          viz_bars: "\u30D0\u30FC",
          viz_wave: "\u6CE2\u5F62",
          viz_dots: "\u30C9\u30C3\u30C8",
          vizBars: "\u30D0\u30FC\u306E\u6570",
          vizHeight: "\u9AD8\u3055",
          vizSmooth: "\u306A\u3081\u3089\u304B\u3055",
          vizGlow: "\u30B0\u30ED\u30FC",
          vizRings: "\u30D3\u30FC\u30C8\u306B\u5408\u308F\u305B\u305F\u30EA\u30F3\u30B0",
          vizMirror: "\u30DF\u30E9\u30FC",
          vizSpin: "\u3086\u3063\u304F\u308A\u56DE\u8EE2",
          scheme: "\u30AB\u30E9\u30FC\u30B9\u30AD\u30FC\u30E0",
          schemeHint: "\u3059\u3050\u306B\u5207\u308A\u66FF\u308F\u308A\u307E\u3059 \u2013 Mirage \u306F\u30B8\u30E3\u30B1\u30C3\u30C8\u306B\u30EA\u30A2\u30EB\u30BF\u30A4\u30E0\u3067\u8FFD\u5F93",
          glass: "\u672C\u7269\u306E\u30AC\u30E9\u30B9",
          glassHint: "\u5404\u30D1\u30CD\u30EB\u306E\u80CC\u5F8C\u3092\u30EA\u30A2\u30EB\u30BF\u30A4\u30E0\u3067\u307C\u304B\u3057\u307E\u3059 \u2013 \u4E0A\u8CEA\u3067\u3059\u304C\u3001\u8CA0\u8377\u304C\u5927\u304D\u304F\u306A\u308A\u307E\u3059",
          c_shuffle: "\u30B7\u30E3\u30C3\u30D5\u30EB (S)",
          c_repeat: "\u30EA\u30D4\u30FC\u30C8 (R)",
          c_like: "\u3044\u3044\u306D (L)",
          c_mute: "\u30DF\u30E5\u30FC\u30C8",
          c_full: "\u5168\u753B\u9762 (F)",
          c_volume: "\u97F3\u91CF (\u2191 \u2193)",
          tip: "\u30A4\u30DE\u30FC\u30B7\u30D6\u30E2\u30FC\u30C9: Ctrl + Shift + M \u307E\u305F\u306F\u4E0A\u90E8\u306E\u4E38\u3044\u30DC\u30BF\u30F3\u3002\u30E2\u30FC\u30C9\u5185: 1 \xB7 2 \xB7 3 \u8868\u793A\u5207\u66FF\u3001Space \u518D\u751F\u3001\u2190 \u2192 \u30B7\u30FC\u30AF\u3001\u2191 \u2193 \u97F3\u91CF\u3001L \u3044\u3044\u306D\u3001S \u30B7\u30E3\u30C3\u30D5\u30EB\u3001R \u30EA\u30D4\u30FC\u30C8\u3001F \u5168\u753B\u9762\u3002",
          presetTitle: "\u898B\u305F\u76EE\u3068\u30D1\u30D5\u30A9\u30FC\u30DE\u30F3\u30B9",
          presetHint: "\u30EF\u30F3\u30AF\u30EA\u30C3\u30AF\u3067\u4E00\u62EC\u8A2D\u5B9A \u2013 \u7D30\u304B\u3044\u8ABF\u6574\u306F\u4E0B\u3067",
          preset_full: "\u30D5\u30EB",
          preset_balanced: "\u30D0\u30E9\u30F3\u30B9",
          preset_light: "\u30E9\u30A4\u30C8",
          preset_calm: "\u63A7\u3048\u3081",
          presetCustom: "\u30AB\u30B9\u30BF\u30E0 \u2013 \u500B\u5225\u306E\u30B9\u30A4\u30C3\u30C1\u3092\u5909\u66F4\u3057\u307E\u3057\u305F",
          perfStepped: "\u3053\u3053\u3067\u306F Mirage \u304C {fps} fps \u3067\u52D5\u4F5C\u3057\u3066\u3044\u305F\u305F\u3081\u3001\u306A\u3081\u3089\u304B\u3055\u3092\u4FDD\u3064\u305F\u3081\u300C{preset}\u300D\u306B\u5207\u308A\u66FF\u3048\u307E\u3057\u305F\u3002",
          autoPerf: "\u81EA\u52D5\u3067\u8ABF\u6574",
          autoPerfHint: "PC \u306E\u51E6\u7406\u304C\u8FFD\u3044\u3064\u304B\u306A\u3044\u5834\u5408\u306B 1 \u6BB5\u968E\u4E0B\u3052\u307E\u3059",
          costly: "\u30D1\u30D5\u30A9\u30FC\u30DE\u30F3\u30B9\u3068\u30D0\u30C3\u30C6\u30EA\u30FC\u3092\u6D88\u8CBB\u3057\u307E\u3059",
          safeMode: "Spotify {v} \u306E\u69CB\u9020\u304C\u5909\u308F\u3063\u305F\u305F\u3081\u3001Mirage \u306F\u30BB\u30FC\u30D5\u30E2\u30FC\u30C9 (\u8272\u306E\u307F) \u3067\u52D5\u4F5C\u3057\u3066\u3044\u307E\u3059\u3002Mirage \u3092\u66F4\u65B0\u3059\u308B\u3068\u76F4\u308A\u307E\u3059\u3002",
          share: "\u753B\u50CF\u3068\u3057\u3066\u5171\u6709",
          shareNow: "\u518D\u751F\u4E2D\u306E\u66F2\u3092\u5171\u6709",
          shareWeek: "\u3042\u306A\u305F\u306E 1 \u9031\u9593\u3092\u8272\u3067",
          shareCopied: "\u753B\u50CF\u3092\u30B3\u30D4\u30FC\u3057\u3001\u30C0\u30A6\u30F3\u30ED\u30FC\u30C9\u30D5\u30A9\u30EB\u30C0\u30FC\u306B\u3082\u4FDD\u5B58\u3057\u307E\u3057\u305F",
          shareSaved: "\u753B\u50CF\u3092\u30C0\u30A6\u30F3\u30ED\u30FC\u30C9\u30D5\u30A9\u30EB\u30C0\u30FC\u306B\u4FDD\u5B58\u3057\u307E\u3057\u305F",
          weekKicker: "Mirage \xB7 \u904E\u53BB 7 \u65E5\u9593",
          weekTitle: "\u3042\u306A\u305F\u306E 1 \u9031\u9593\u3092\u8272\u3067",
          weekSongs: "\u66F2",
          weekMinutes: "\u5206",
          weekColours: "\u30B8\u30E3\u30B1\u30C3\u30C8\u306E\u8272",
          weekArtists: "\u3088\u304F\u8074\u3044\u305F\u3082\u306E",
          weekEmpty: "\u4F55\u66F2\u304B\u8074\u3044\u3066\u307F\u307E\u3057\u3087\u3046 \u2013 1 \u9031\u9593\u304C\u8272\u3067\u57CB\u307E\u3063\u3066\u3044\u304D\u307E\u3059\u3002",
          weekScheme: "\u304A\u6C17\u306B\u5165\u308A\u306E\u30B9\u30AD\u30FC\u30E0: {s}",
          keysTitle: "\u30AD\u30FC\u30DC\u30FC\u30C9\u30B7\u30E7\u30FC\u30C8\u30AB\u30C3\u30C8",
          k_play: "\u518D\u751F / \u4E00\u6642\u505C\u6B62",
          k_seek: "5 \u79D2\u30B7\u30FC\u30AF",
          k_vol: "\u97F3\u91CF",
          k_view: "\u30B8\u30E3\u30B1\u30C3\u30C8 \xB7 \u6B4C\u8A5E \xB7 \u30D3\u30B8\u30E5\u30A2\u30E9\u30A4\u30B6\u30FC \xB7 \u30DF\u30C3\u30AF\u30B9 \xB7 \u30D1\u30FC\u30C6\u30A3\u30FC",
          k_like: "\u3044\u3044\u306D",
          k_shuffle: "\u30B7\u30E3\u30C3\u30D5\u30EB",
          k_repeat: "\u30EA\u30D4\u30FC\u30C8",
          k_full: "\u5168\u753B\u9762",
          k_next: "\u6B21\u3078 / \u524D\u3078",
          k_close: "\u9589\u3058\u308B",
          unsynced: "\u3053\u306E\u6B4C\u8A5E\u306F\u6642\u9593\u540C\u671F\u3055\u308C\u3066\u3044\u307E\u305B\u3093 \u2013 \u81EA\u7531\u306B\u30B9\u30AF\u30ED\u30FC\u30EB\u3057\u307E\u3059\u3002",
          g_colours: "\u8272",
          g_background: "\u80CC\u666F",
          g_motion: "\u30A2\u30CB\u30E1\u30FC\u30B7\u30E7\u30F3",
          g_immersive: "\u30A4\u30DE\u30FC\u30B7\u30D6\u30E2\u30FC\u30C9",
          g_builder: "\u81EA\u5206\u3060\u3051\u306E\u30B9\u30AD\u30FC\u30E0\u3092\u4F5C\u308B",
          g_overlay: "\u30AA\u30FC\u30D0\u30FC\u30EC\u30A4",
          g_more: "\u5171\u6709\u30FB\u30D0\u30C3\u30AF\u30A2\u30C3\u30D7\u30FB\u30D8\u30EB\u30D7",
          freeze: "\u8272\u3092\u56FA\u5B9A",
          freezeHint: "\u4F55\u304C\u518D\u751F\u3055\u308C\u3066\u3082\u4ECA\u306E\u8272\u3092\u4FDD\u3061\u307E\u3059",
          pinAlbum: "\u3053\u306E\u30A2\u30EB\u30D0\u30E0\u306E\u8272\u3092\u8A18\u61B6",
          unpinAlbum: "\u3053\u306E\u30A2\u30EB\u30D0\u30E0\u306E\u8272\u3092\u5FD8\u308C\u308B",
          pinnedAlbum: "\u3053\u306E\u30A2\u30EB\u30D0\u30E0\u306F\u4ECA\u5F8C\u3044\u3064\u3082\u3053\u306E\u8272\u306B\u306A\u308A\u307E\u3059",
          unpinnedAlbum: "\u30A2\u30EB\u30D0\u30E0\u306E\u8272\u3092\u524A\u9664\u3057\u307E\u3057\u305F",
          playlistSchemeOn: "\u3053\u306E\u30D7\u30EC\u30A4\u30EA\u30B9\u30C8\u306B\u300C{s}\u300D\u3092\u4F7F\u3046",
          playlistSchemeOff: "\u30D7\u30EC\u30A4\u30EA\u30B9\u30C8\u306F\u300C{s}\u300D\u3092\u4F7F\u7528\u4E2D \u2013 \u89E3\u9664",
          lyrSize: "\u6B4C\u8A5E\u306E\u30B5\u30A4\u30BA",
          lyrGap: "\u884C\u9593",
          translate: "\u6B4C\u8A5E\u3092\u7FFB\u8A33",
          translateHint: "\u5404\u884C\u306E\u4E0B\u306B\u7FFB\u8A33\u3092\u8868\u793A\u3057\u307E\u3059 \u2013 \u6B4C\u8A5E\u306E\u884C\u306F Google \u7FFB\u8A33\u306B\u9001\u4FE1\u3055\u308C\u307E\u3059",
          canvas: "Canvas \u52D5\u753B",
          canvasHint: "\u30B8\u30E3\u30B1\u30C3\u30C8\u306E\u80CC\u5F8C\u306B Spotify \u306E\u77ED\u3044\u30EB\u30FC\u30D7\u52D5\u753B\u3092\u8868\u793A (\u3042\u308B\u5834\u5408)",
          viz_particles: "\u30D1\u30FC\u30C6\u30A3\u30AF\u30EB",
          viz_line: "\u30E9\u30A4\u30F3",
          viz_bottom: "\u4E0B\u90E8\u306E\u30D0\u30FC",
          c_base: "\u80CC\u666F",
          c_accent: "\u30A2\u30AF\u30BB\u30F3\u30C8",
          c_deep: "\u30C7\u30A3\u30FC\u30D7",
          c_light: "\u30E9\u30A4\u30C8",
          schemeName: "\u30B9\u30AD\u30FC\u30E0\u306E\u540D\u524D",
          schemeCodeHint: "\u30B9\u30AD\u30FC\u30E0\u30B3\u30FC\u30C9\u3092\u3053\u3053\u306B\u8CBC\u308A\u4ED8\u3051\u3066\u8AAD\u307F\u8FBC\u307F\u307E\u3059",
          schemeSave: "\u30B9\u30AD\u30FC\u30E0\u3092\u4FDD\u5B58",
          schemeCopy: "\u30B3\u30FC\u30C9\u3068\u3057\u3066\u30B3\u30D4\u30FC",
          schemeImport: "\u30B3\u30FC\u30C9\u3092\u8AAD\u307F\u8FBC\u3080",
          schemeNameTaken: "\u5185\u8535\u30B9\u30AD\u30FC\u30E0\u3068\u91CD\u306A\u3089\u306A\u3044\u540D\u524D\u3092\u4ED8\u3051\u3066\u304F\u3060\u3055\u3044",
          schemeDelete: "\u30B9\u30AD\u30FC\u30E0\u3092\u524A\u9664",
          copied: "\u30B3\u30D4\u30FC\u3057\u307E\u3057\u305F",
          badCode: "\u30B3\u30FC\u30C9\u304C\u6B63\u3057\u304F\u306A\u3044\u3088\u3046\u3067\u3059",
          settingsCodeHint: "\u8A2D\u5B9A\u30B3\u30FC\u30C9\u3092\u3053\u3053\u306B\u8CBC\u308A\u4ED8\u3051\u3066\u8AAD\u307F\u8FBC\u307F\u307E\u3059",
          exportSettings: "\u8A2D\u5B9A\u3092\u30B3\u30D4\u30FC",
          importSettings: "\u8A2D\u5B9A\u3092\u8AAD\u307F\u8FBC\u3080",
          diagnostics: "\u8A3A\u65AD\u60C5\u5831\u3092\u30B3\u30D4\u30FC",
          reset: "\u30EA\u30BB\u30C3\u30C8",
          resetConfirm: "Mirage \u306E\u8A2D\u5B9A\u3092\u3059\u3079\u3066\u30EA\u30BB\u30C3\u30C8\u3057\u307E\u3059\u304B\uFF1F \u81EA\u4F5C\u306E\u30B9\u30AD\u30FC\u30E0\u3068\u8A18\u61B6\u3057\u305F\u8272\u306F\u6B8B\u308A\u307E\u3059\u3002",
          welcomeTitle: "Mirage \u3078\u3088\u3046\u3053\u305D",
          welcomeText: "Ctrl + Shift + M \u3067\u30A4\u30DE\u30FC\u30B7\u30D6\u30E2\u30FC\u30C9\u304C\u958B\u304D\u307E\u3059\u3002\u8A2D\u5B9A\u306F\u30D7\u30ED\u30D5\u30A3\u30FC\u30EB\u30E1\u30CB\u30E5\u30FC\u306B\u3042\u308A\u307E\u3059\u3002",
          welcomeImmersive: "\u30A4\u30DE\u30FC\u30B7\u30D6\u30E2\u30FC\u30C9\u3092\u8A66\u3059",
          c_smart: "Smart Shuffle (S)",
          c_queue: "\u6B21\u306B\u518D\u751F (Q)",
          c_devices: "\u30C7\u30D0\u30A4\u30B9",
          c_timer: "\u30B9\u30EA\u30FC\u30D7\u30BF\u30A4\u30DE\u30FC",
          queueEmpty: "\u30AD\u30E5\u30FC\u306F\u7A7A\u3067\u3059",
          devicesNone: "\u4ED6\u306E\u30C7\u30D0\u30A4\u30B9\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093",
          deviceActive: "\u3053\u306E\u30C7\u30D0\u30A4\u30B9\u3067\u518D\u751F\u4E2D",
          timerTrack: "\u3053\u306E\u66F2\u306E\u7D42\u308F\u308A",
          timerOff: "\u30AA\u30D5",
          timerLeft: "\u6B8B\u308A {m} \u5206",
          k_queue: "\u6B21\u306B\u518D\u751F",
          overlayDownload: "Overlay \u30A2\u30D7\u30EA\u3092\u30C0\u30A6\u30F3\u30ED\u30FC\u30C9",
          overlayAllDownloads: "\u3059\u3079\u3066\u306E\u30C0\u30A6\u30F3\u30ED\u30FC\u30C9",
          overlayConnected: "\u25CF Overlay \u306B\u63A5\u7D9A\u6E08\u307F",
          overlayMissing: "\u25CB Overlay \u304C\u8D77\u52D5\u3057\u3066\u3044\u307E\u305B\u3093 \u2013 \u4E0B\u306E\u30DC\u30BF\u30F3\u304B\u3089\u30A4\u30F3\u30B9\u30C8\u30FC\u30EB\u3057\u3001\u4E00\u5EA6\u8D77\u52D5\u3057\u3066\u304F\u3060\u3055\u3044",
          onlineLyrics: "\u30AA\u30F3\u30E9\u30A4\u30F3\u3067\u6B4C\u8A5E\u3092\u691C\u7D22",
          onlineLyricsHint: "Spotify \u306B\u6B4C\u8A5E\u304C\u306A\u3044\u5834\u5408\u3001Mirage \u304C LRCLIB \u306B\u554F\u3044\u5408\u308F\u305B\u307E\u3059 \u2013 \u9001\u4FE1\u3055\u308C\u308B\u306E\u306F\u30BF\u30A4\u30C8\u30EB\u3001\u30A2\u30FC\u30C6\u30A3\u30B9\u30C8\u3001\u30A2\u30EB\u30D0\u30E0\u3001\u9577\u3055\u306E\u307F",
          emptyTitle: "\u3053\u306E\u66F2\u306E\u6B4C\u8A5E\u306F\u3042\u308A\u307E\u305B\u3093",
          emptyText: "Spotify \u306B\u3082 LRCLIB \u306B\u3082\u307E\u3060\u6B4C\u8A5E\u304C\u3042\u308A\u307E\u305B\u3093\u3002",
          emptyTextOff: "Spotify \u306B\u306F\u6B4C\u8A5E\u304C\u3042\u308A\u307E\u305B\u3093\u3002\u8A2D\u5B9A\u3067\u300C\u30AA\u30F3\u30E9\u30A4\u30F3\u3067\u6B4C\u8A5E\u3092\u691C\u7D22\u300D\u3092\u30AA\u30F3\u306B\u3059\u308B\u3068\u3001\u3055\u3089\u306B\u63A2\u305B\u307E\u3059\u3002",
          instrTitle: "\u30A4\u30F3\u30B9\u30C8\u30A5\u30EB\u30E1\u30F3\u30BF\u30EB",
          instrText: "\u6B4C\u8A5E\u306F\u3042\u308A\u307E\u305B\u3093 \u2013 \u97F3\u697D\u3092\u305D\u306E\u307E\u307E\u697D\u3057\u3093\u3067\u304F\u3060\u3055\u3044\u3002",
          showViz: "\u30D3\u30B8\u30E5\u30A2\u30E9\u30A4\u30B6\u30FC\u3092\u8868\u793A",
          searchWeb: "\u30A6\u30A7\u30D6\u3067\u691C\u7D22",
          lyrPick: "\u30D0\u30FC\u30B8\u30E7\u30F3\u3092\u9078\u629E",
          lyrPicked: "\u9078\u629E\u6E08\u307F",
          lyrNone: "\u6B4C\u8A5E\u306A\u3057",
          lyrAuto: "\u81EA\u52D5",
          lyrAutoHint: "\u307E\u305A Spotify\u3001\u6B21\u306B LRCLIB \u306E\u6700\u9069\u306A\u5019\u88DC",
          lyrNoVersions: "LRCLIB \u306B\u306F\u3053\u306E\u66F2\u306E\u4ED6\u306E\u30D0\u30FC\u30B8\u30E7\u30F3\u304C\u3042\u308A\u307E\u305B\u3093",
          lyrSynced: "\u6642\u9593\u540C\u671F",
          lyrPlain: "\u30C6\u30AD\u30B9\u30C8\u306E\u307F",
          karaoke: "\u5358\u8A9E\u3054\u3068\u306E\u30AB\u30E9\u30AA\u30B1",
          karaokeHint: "\u5358\u8A9E\u304C\u9806\u306B\u5149\u308A\u307E\u3059 \u2013 Spotify \u306E\u97F3\u7BC0\u30BF\u30A4\u30DF\u30F3\u30B0\u304C\u3042\u308C\u3070\u6B63\u78BA\u3001\u306A\u3051\u308C\u3070\u63A8\u5B9A",
          font: "\u30D5\u30A9\u30F3\u30C8",
          fontHint: "Spotify \u5168\u4F53\u306B\u9069\u7528\u3055\u308C\u307E\u3059",
          font_outfit: "Outfit",
          font_jakarta: "Jakarta",
          font_manrope: "Manrope",
          font_sora: "Sora",
          font_lexend: "Lexend",
          font_nunito: "Nunito",
          font_system: "\u30B7\u30B9\u30C6\u30E0",
          shareMonth: "\u3042\u306A\u305F\u306E 1 \u304B\u6708\u3092\u8272\u3067",
          monthKicker: "Mirage \xB7 \u904E\u53BB 30 \u65E5\u9593",
          monthTitle: "\u3042\u306A\u305F\u306E 1 \u304B\u6708\u3092\u8272\u3067",
          monthDays: "\u65E5",
          monthDaily: "1 \u65E5\u3042\u305F\u308A\u306E\u518D\u751F\u6642\u9593",
          monthSongs: "\u30C8\u30C3\u30D7\u30BD\u30F3\u30B0",
          trToggle: "\u7FFB\u8A33",
          trShow: "\u7FFB\u8A33\u3092\u8868\u793A",
          trHide: "\u7FFB\u8A33\u3092\u975E\u8868\u793A",
          party_rave: "Rave",
          party_rock: "Rock",
          party_pop: "Pop",
          tabMix: "\u30DF\u30C3\u30AF\u30B9",
          tabParty: "\u30D1\u30FC\u30C6\u30A3\u30FC",
          party_auto: "\u81EA\u52D5",
          party_bass: "\u30D9\u30FC\u30B9",
          party_chill: "\u30C1\u30EB",
          partySection: "\u30D1\u30FC\u30C6\u30A3\u30FC\u30E2\u30FC\u30C9",
          partySectionHint: "\u81EA\u52D5\u3067\u306F\u30B8\u30E3\u30F3\u30EB\u30FB\u30C6\u30F3\u30DD\u30FB\u97F3\u91CF\u304B\u3089\u66F2\u3054\u3068\u306B\u30B9\u30BF\u30A4\u30EB\u3092\u9078\u3073\u307E\u3059",
          partyLevel: "\u5F37\u3055",
          partyLevel1: "\u63A7\u3048\u3081",
          partyLevel2: "\u6A19\u6E96",
          partyLevel3: "\u6700\u5927",
          partyFlash: "\u30AB\u30E9\u30FC\u30D5\u30E9\u30C3\u30B7\u30E5",
          partyFlashHint: "\u30D3\u30FC\u30C8\u306B\u5408\u308F\u305B\u305F\u3084\u308F\u3089\u304B\u306A\u8272\u306E\u6CE2\u30021\u79D2\u306B\u6570\u56DE\u307E\u3067\u3002\u300C\u8996\u5DEE\u52B9\u679C\u3092\u6E1B\u3089\u3059\u300D\u3067\u30AA\u30D5",
          scanCode: "Spotify\u3067\u30B9\u30AD\u30E3\u30F3",
          partyJam: "Jam\u306E\u53C2\u52A0\u8005\u3092\u8868\u793A",
          partyJamHint: "Spotify Jam\u4E2D\u306F\u3001\u53C2\u52A0\u8005\u5168\u54E1\uFF08\u3042\u306A\u305F\u3082\uFF09\u306E\u30D7\u30ED\u30D5\u30A3\u30FC\u30EB\u753B\u50CF\u304C\u753B\u9762\u306E\u7AEF\u306B\u6D6E\u304B\u3073\u307E\u3059",
          jamYou: "\u3042\u306A\u305F"
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
          bright: "\uBC30\uACBD \uBC1D\uAE30",
          dynamicHint: "\uC778\uD130\uD398\uC774\uC2A4 \uC804\uCCB4\uAC00 \uACE1\uC758 \uC0C9\uC73C\uB85C \uBB3C\uB4ED\uB2C8\uB2E4",
          particlesHint: "\uBC30\uACBD\uC5D0 \uB5A0\uB2E4\uB2C8\uB294 \uBE5B \uC785\uC790",
          beatHint: "Spotify\uAC00 \uBE44\uD2B8 \uB370\uC774\uD130\uB97C \uC81C\uACF5\uD558\uBA74 \uBC15\uC790\uC5D0 \uB9DE\uCDB0 \uB9E5\uB3D9\uD569\uB2C8\uB2E4",
          cascadeHint: "\uD398\uC774\uC9C0\uB97C \uC804\uD658\uD558\uBA74 \uCF58\uD150\uCE20\uAC00 \uBD80\uB4DC\uB7FD\uAC8C \uB4E4\uC5B4\uC635\uB2C8\uB2E4",
          vinylHint: "\uD558\uB2E8\uC758 \uCEE4\uBC84\uAC00 \uD68C\uC804\uD558\uB294 \uB808\uCF54\uB4DC\uB85C \uBC14\uB01D\uB2C8\uB2E4",
          tiltHint: "\uCE74\uB4DC\uAC00 \uB9C8\uC6B0\uC2A4 \uD3EC\uC778\uD130 \uCABD\uC73C\uB85C \uAE30\uC6B8\uC5B4\uC9D1\uB2C8\uB2E4",
          burstHint: "\uACE1\uC5D0 \uC88B\uC544\uC694\uB97C \uB204\uB974\uBA74 \uBD88\uAF43\uC774 \uC3DF\uC544\uC9D1\uB2C8\uB2E4",
          overlay: "Mirage Overlay",
          overlayHint: "\uACE1 \uBCC0\uACBD\uC744 Spotify \uC678\uBD80\uC758 \uC624\uBC84\uB808\uC774 \uC571\uC73C\uB85C \uBCF4\uB0C5\uB2C8\uB2E4",
          grainHint: "\uBC30\uACBD \uC704\uC5D0 \uBBF8\uC138\uD55C \uB178\uC774\uC988",
          calmHint: "\uBAA8\uB4E0 \uBC30\uACBD \uC560\uB2C8\uBA54\uC774\uC158\uC744 \uBA48\uCDA5\uB2C8\uB2E4",
          vizSection: "\uBE44\uC8FC\uC5BC\uB77C\uC774\uC800",
          vizSectionHint: "\uBAB0\uC785 \uBAA8\uB4DC\uC758 \uBE44\uC8FC\uC5BC\uB77C\uC774\uC800 \uBAA8\uC591 \u2013 \uBC14\uB85C \uC801\uC6A9\uB429\uB2C8\uB2E4",
          viz_bars: "\uB9C9\uB300",
          viz_wave: "\uD30C\uD615",
          viz_dots: "\uC810",
          vizBars: "\uB9C9\uB300 \uAC1C\uC218",
          vizHeight: "\uB192\uC774",
          vizSmooth: "\uBD80\uB4DC\uB7EC\uC6C0",
          vizGlow: "\uAD11\uCC44",
          vizRings: "\uBE44\uD2B8\uC5D0 \uB9DE\uCD98 \uB9C1",
          vizMirror: "\uC88C\uC6B0 \uB300\uCE6D",
          vizSpin: "\uB290\uB9B0 \uD68C\uC804",
          scheme: "\uC0C9 \uAD6C\uC131\uD45C",
          schemeHint: "\uC989\uC2DC \uC804\uD658 \u2013 Mirage\uAC00 \uCEE4\uBC84\uB97C \uC2E4\uC2DC\uAC04\uC73C\uB85C \uB530\uB77C\uAC11\uB2C8\uB2E4",
          glass: "\uC9C4\uC9DC \uC720\uB9AC",
          glassHint: "\uBAA8\uB4E0 \uD328\uB110 \uB4A4\uB97C \uC2E4\uC2DC\uAC04\uC73C\uB85C \uD750\uB9AC\uAC8C \uD569\uB2C8\uB2E4 \u2013 \uB354 \uACE0\uAE09\uC2A4\uB7FD\uC9C0\uB9CC \uC131\uB2A5\uC744 \uB9CE\uC774 \uC501\uB2C8\uB2E4",
          c_shuffle: "\uC154\uD50C (S)",
          c_repeat: "\uBC18\uBCF5 (R)",
          c_like: "\uC88B\uC544\uC694 (L)",
          c_mute: "\uC74C\uC18C\uAC70",
          c_full: "\uC804\uCCB4 \uD654\uBA74 (F)",
          c_volume: "\uBCFC\uB968 (\u2191 \u2193)",
          tip: "\uBAB0\uC785 \uBAA8\uB4DC: Ctrl + Shift + M \uB610\uB294 \uC0C1\uB2E8\uC758 \uC6D0\uD615 \uBC84\uD2BC. \uBAA8\uB4DC \uC548\uC5D0\uC11C: 1 \xB7 2 \xB7 3 \uBCF4\uAE30 \uC804\uD658, Space \uC7AC\uC0DD, \u2190 \u2192 \uD0D0\uC0C9, \u2191 \u2193 \uBCFC\uB968, L \uC88B\uC544\uC694, S \uC154\uD50C, R \uBC18\uBCF5, F \uC804\uCCB4 \uD654\uBA74.",
          presetTitle: "\uBAA8\uC591 \uBC0F \uC131\uB2A5",
          presetHint: "\uD074\uB9AD \uD55C \uBC88\uC73C\uB85C \uBAA8\uB450 \uC124\uC815 \u2013 \uC544\uB798\uC5D0\uC11C \uC138\uBD80 \uC870\uC815",
          preset_full: "\uC804\uCCB4",
          preset_balanced: "\uADE0\uD615",
          preset_light: "\uAC00\uBCCD\uAC8C",
          preset_calm: "\uCC28\uBD84\uD558\uAC8C",
          presetCustom: "\uC0AC\uC6A9\uC790 \uC9C0\uC815 \u2013 \uAC1C\uBCC4 \uC2A4\uC704\uCE58\uB97C \uBCC0\uACBD\uD588\uC2B5\uB2C8\uB2E4",
          perfStepped: "Mirage\uAC00 \uC5EC\uAE30\uC11C {fps} fps\uB85C \uC2E4\uD589\uB418\uC5B4 \uBD80\uB4DC\uB7FD\uAC8C \uC720\uC9C0\uD558\uB824\uACE0 \u201C{preset}\u201D(\uC73C)\uB85C \uC804\uD658\uD588\uC2B5\uB2C8\uB2E4.",
          autoPerf: "\uC790\uB3D9\uC73C\uB85C \uC870\uC815",
          autoPerfHint: "PC\uAC00 \uB530\uB77C\uAC00\uC9C0 \uBABB\uD558\uBA74 \uD55C \uB2E8\uACC4 \uB0AE\uCDA5\uB2C8\uB2E4",
          costly: "\uC131\uB2A5\uACFC \uBC30\uD130\uB9AC\uB97C \uC18C\uBAA8\uD569\uB2C8\uB2E4",
          safeMode: "Spotify {v}\uC758 \uAD6C\uC870\uAC00 \uBC14\uB00C\uC5B4 Mirage\uAC00 \uC548\uC804 \uBAA8\uB4DC(\uC0C9\uC0C1\uB9CC)\uB85C \uC804\uD658\uB418\uC5C8\uC2B5\uB2C8\uB2E4. Mirage\uB97C \uC5C5\uB370\uC774\uD2B8\uD558\uBA74 \uD574\uACB0\uB429\uB2C8\uB2E4.",
          share: "\uC774\uBBF8\uC9C0\uB85C \uACF5\uC720",
          shareNow: "\uC9C0\uAE08 \uC7AC\uC0DD \uC911\uC778 \uACE1 \uACF5\uC720",
          shareWeek: "\uC0C9\uC73C\uB85C \uBCF4\uB294 \uB098\uC758 \uD55C \uC8FC",
          shareCopied: "\uC774\uBBF8\uC9C0\uB97C \uBCF5\uC0AC\uD588\uACE0 \uB2E4\uC6B4\uB85C\uB4DC \uD3F4\uB354\uC5D0\uB3C4 \uC800\uC7A5\uD588\uC2B5\uB2C8\uB2E4",
          shareSaved: "\uC774\uBBF8\uC9C0\uB97C \uB2E4\uC6B4\uB85C\uB4DC \uD3F4\uB354\uC5D0 \uC800\uC7A5\uD588\uC2B5\uB2C8\uB2E4",
          weekKicker: "Mirage \xB7 \uCD5C\uADFC 7\uC77C",
          weekTitle: "\uC0C9\uC73C\uB85C \uBCF4\uB294 \uB098\uC758 \uD55C \uC8FC",
          weekSongs: "\uACE1",
          weekMinutes: "\uBD84",
          weekColours: "\uB0B4 \uCEE4\uBC84\uB4E4\uC758 \uC0C9",
          weekArtists: "\uAC00\uC7A5 \uB9CE\uC774 \uB4E4\uC74C",
          weekEmpty: "\uBA87 \uACE1 \uB4E4\uC5B4 \uBCF4\uC138\uC694 \u2013 \uD55C \uC8FC\uAC00 \uCC44\uC6CC\uC9D1\uB2C8\uB2E4.",
          weekScheme: "\uC990\uACA8 \uC4F0\uB294 \uAD6C\uC131\uD45C: {s}",
          keysTitle: "\uD0A4\uBCF4\uB4DC \uB2E8\uCD95\uD0A4",
          k_play: "\uC7AC\uC0DD / \uC77C\uC2DC\uC815\uC9C0",
          k_seek: "5\uCD08 \uD0D0\uC0C9",
          k_vol: "\uBCFC\uB968",
          k_view: "\uCEE4\uBC84 \xB7 \uAC00\uC0AC \xB7 \uBE44\uC8FC\uC5BC\uB77C\uC774\uC800 \xB7 \uBBF9\uC2A4 \xB7 \uD30C\uD2F0",
          k_like: "\uC88B\uC544\uC694",
          k_shuffle: "\uC154\uD50C",
          k_repeat: "\uBC18\uBCF5",
          k_full: "\uC804\uCCB4 \uD654\uBA74",
          k_next: "\uB2E4\uC74C / \uC774\uC804",
          k_close: "\uB2EB\uAE30",
          unsynced: "\uC774 \uAC00\uC0AC\uB294 \uC2DC\uAC04 \uB3D9\uAE30\uD654\uB418\uC9C0 \uC54A\uC544 \uC790\uC720\uB86D\uAC8C \uC2A4\uD06C\uB864\uB429\uB2C8\uB2E4.",
          g_colours: "\uC0C9\uC0C1",
          g_background: "\uBC30\uACBD",
          g_motion: "\uC560\uB2C8\uBA54\uC774\uC158",
          g_immersive: "\uBAB0\uC785 \uBAA8\uB4DC",
          g_builder: "\uB098\uB9CC\uC758 \uAD6C\uC131\uD45C \uB9CC\uB4E4\uAE30",
          g_overlay: "\uC624\uBC84\uB808\uC774",
          g_more: "\uACF5\uC720, \uBC31\uC5C5 \uBC0F \uB3C4\uC6C0\uB9D0",
          freeze: "\uC0C9\uC0C1 \uACE0\uC815",
          freezeHint: "\uBB34\uC5C7\uC774 \uC7AC\uC0DD\uB418\uB4E0 \uD604\uC7AC \uC0C9\uC744 \uC720\uC9C0\uD569\uB2C8\uB2E4",
          pinAlbum: "\uC774 \uC568\uBC94\uC758 \uC0C9 \uAE30\uC5B5\uD558\uAE30",
          unpinAlbum: "\uC774 \uC568\uBC94\uC758 \uC0C9 \uC78A\uAE30",
          pinnedAlbum: "\uC774\uC81C \uC774 \uC568\uBC94\uC740 \uD56D\uC0C1 \uC774 \uC0C9\uC744 \uC0AC\uC6A9\uD569\uB2C8\uB2E4",
          unpinnedAlbum: "\uC568\uBC94 \uC0C9\uC744 \uC78A\uC5C8\uC2B5\uB2C8\uB2E4",
          playlistSchemeOn: "\uC774 \uD50C\uB808\uC774\uB9AC\uC2A4\uD2B8\uC5D0 \u201C{s}\u201D \uC0AC\uC6A9",
          playlistSchemeOff: "\uD50C\uB808\uC774\uB9AC\uC2A4\uD2B8\uAC00 \u201C{s}\u201D \uC0AC\uC6A9 \uC911 \u2013 \uD574\uC81C",
          lyrSize: "\uAC00\uC0AC \uD06C\uAE30",
          lyrGap: "\uC904 \uAC04\uACA9",
          translate: "\uAC00\uC0AC \uBC88\uC5ED",
          translateHint: "\uAC01 \uC904 \uC544\uB798\uC5D0 \uBC88\uC5ED\uC744 \uD45C\uC2DC\uD569\uB2C8\uB2E4 \u2013 \uAC00\uC0AC \uC904\uC740 Google \uBC88\uC5ED\uC73C\uB85C \uC804\uC1A1\uB429\uB2C8\uB2E4",
          canvas: "Canvas \uB3D9\uC601\uC0C1",
          canvasHint: "\uCEE4\uBC84 \uB4A4\uC5D0 Spotify\uC758 \uC9E7\uC740 \uBC18\uBCF5 \uB3D9\uC601\uC0C1 \uD45C\uC2DC(\uC788\uB294 \uACBD\uC6B0)",
          viz_particles: "\uC785\uC790",
          viz_line: "\uC120",
          viz_bottom: "\uD558\uB2E8 \uB9C9\uB300",
          c_base: "\uBC30\uACBD",
          c_accent: "\uAC15\uC870",
          c_deep: "\uC9D9\uC740 \uC0C9",
          c_light: "\uBC1D\uC740 \uC0C9",
          schemeName: "\uAD6C\uC131\uD45C \uC774\uB984",
          schemeCodeHint: "\uAD6C\uC131\uD45C \uCF54\uB4DC\uB97C \uC5EC\uAE30\uC5D0 \uBD99\uC5EC \uB123\uC5B4 \uAC00\uC838\uC624\uC138\uC694",
          schemeSave: "\uAD6C\uC131\uD45C \uC800\uC7A5",
          schemeCopy: "\uCF54\uB4DC\uB85C \uBCF5\uC0AC",
          schemeImport: "\uCF54\uB4DC \uAC00\uC838\uC624\uAE30",
          schemeNameTaken: "\uAE30\uBCF8 \uC81C\uACF5 \uAD6C\uC131\uD45C\uC640 \uACB9\uCE58\uC9C0 \uC54A\uB294 \uC774\uB984\uC744 \uC9C0\uC815\uD558\uC138\uC694",
          schemeDelete: "\uAD6C\uC131\uD45C \uC0AD\uC81C",
          copied: "\uBCF5\uC0AC\uB428",
          badCode: "\uC62C\uBC14\uB978 \uCF54\uB4DC\uAC00 \uC544\uB2CC \uAC83 \uAC19\uC2B5\uB2C8\uB2E4",
          settingsCodeHint: "\uC124\uC815 \uCF54\uB4DC\uB97C \uC5EC\uAE30\uC5D0 \uBD99\uC5EC \uB123\uC5B4 \uAC00\uC838\uC624\uC138\uC694",
          exportSettings: "\uC124\uC815 \uBCF5\uC0AC",
          importSettings: "\uC124\uC815 \uAC00\uC838\uC624\uAE30",
          diagnostics: "\uC9C4\uB2E8 \uC815\uBCF4 \uBCF5\uC0AC",
          reset: "\uCD08\uAE30\uD654",
          resetConfirm: "Mirage \uC124\uC815\uC744 \uBAA8\uB450 \uCD08\uAE30\uD654\uD560\uAE4C\uC694? \uC9C1\uC811 \uB9CC\uB4E0 \uAD6C\uC131\uD45C\uC640 \uAE30\uC5B5\uD55C \uC0C9\uC740 \uC720\uC9C0\uB429\uB2C8\uB2E4.",
          welcomeTitle: "Mirage\uC5D0 \uC624\uC2E0 \uAC83\uC744 \uD658\uC601\uD569\uB2C8\uB2E4",
          welcomeText: "Ctrl + Shift + M\uC73C\uB85C \uBAB0\uC785 \uBAA8\uB4DC\uB97C \uC5FD\uB2C8\uB2E4. \uC124\uC815\uC740 \uD504\uB85C\uD544 \uBA54\uB274\uC5D0 \uC788\uC2B5\uB2C8\uB2E4.",
          welcomeImmersive: "\uBAB0\uC785 \uBAA8\uB4DC \uCCB4\uD5D8\uD558\uAE30",
          c_smart: "Smart Shuffle (S)",
          c_queue: "\uB2E4\uC74C \uC7AC\uC0DD (Q)",
          c_devices: "\uAE30\uAE30",
          c_timer: "\uCDE8\uCE68 \uD0C0\uC774\uBA38",
          queueEmpty: "\uB300\uAE30\uC5F4\uC774 \uBE44\uC5B4 \uC788\uC2B5\uB2C8\uB2E4",
          devicesNone: "\uB2E4\uB978 \uAE30\uAE30\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4",
          deviceActive: "\uC774 \uAE30\uAE30\uC5D0\uC11C \uC7AC\uC0DD \uC911",
          timerTrack: "\uC774 \uACE1\uC774 \uB05D\uB0A0 \uB54C",
          timerOff: "\uB044\uAE30",
          timerLeft: "{m}\uBD84 \uB0A8\uC74C",
          k_queue: "\uB2E4\uC74C \uC7AC\uC0DD",
          overlayDownload: "Overlay \uC571 \uB2E4\uC6B4\uB85C\uB4DC",
          overlayAllDownloads: "\uBAA8\uB4E0 \uB2E4\uC6B4\uB85C\uB4DC",
          overlayConnected: "\u25CF Overlay \uC5F0\uACB0\uB428",
          overlayMissing: "\u25CB Overlay\uAC00 \uC2E4\uD589 \uC911\uC774 \uC544\uB2D9\uB2C8\uB2E4 \u2013 \uC544\uB798 \uBC84\uD2BC\uC73C\uB85C \uC124\uCE58\uD55C \uB4A4 \uD55C \uBC88 \uC2E4\uD589\uD558\uC138\uC694",
          onlineLyrics: "\uC628\uB77C\uC778\uC5D0\uC11C \uAC00\uC0AC \uCC3E\uAE30",
          onlineLyricsHint: "Spotify\uC5D0 \uAC00\uC0AC\uAC00 \uC5C6\uC73C\uBA74 Mirage\uAC00 LRCLIB\uC5D0 \uC694\uCCAD\uD569\uB2C8\uB2E4 \u2013 \uC81C\uBAA9, \uC544\uD2F0\uC2A4\uD2B8, \uC568\uBC94, \uAE38\uC774\uB9CC \uC804\uC1A1\uB429\uB2C8\uB2E4",
          emptyTitle: "\uC774 \uACE1\uC758 \uAC00\uC0AC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4",
          emptyText: "Spotify\uC640 LRCLIB \uBAA8\uB450 \uC544\uC9C1 \uAC00\uC0AC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.",
          emptyTextOff: "Spotify\uC5D0 \uAC00\uC0AC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4. \uC124\uC815\uC5D0\uC11C \u201C\uC628\uB77C\uC778\uC5D0\uC11C \uAC00\uC0AC \uCC3E\uAE30\u201D\uB97C \uCF1C\uBA74 \uB354 \uCC3E\uC544\uBD05\uB2C8\uB2E4.",
          instrTitle: "\uC5F0\uC8FC\uACE1",
          instrText: "\uAC00\uC0AC\uAC00 \uC5C6\uC5B4\uC694 \u2013 \uC74C\uC545\uC744 \uADF8\uB300\uB85C \uC990\uAE30\uC138\uC694.",
          showViz: "\uBE44\uC8FC\uC5BC\uB77C\uC774\uC800 \uBCF4\uAE30",
          searchWeb: "\uC6F9\uC5D0\uC11C \uAC80\uC0C9",
          lyrPick: "\uBC84\uC804 \uC120\uD0DD",
          lyrPicked: "\uC120\uD0DD\uB428",
          lyrNone: "\uAC00\uC0AC \uC5C6\uC74C",
          lyrAuto: "\uC790\uB3D9",
          lyrAutoHint: "\uBA3C\uC800 Spotify, \uADF8\uB2E4\uC74C LRCLIB\uC758 \uAC00\uC7A5 \uC798 \uB9DE\uB294 \uACB0\uACFC",
          lyrNoVersions: "LRCLIB\uC5D0 \uC774 \uACE1\uC758 \uB2E4\uB978 \uBC84\uC804\uC774 \uC5C6\uC2B5\uB2C8\uB2E4",
          lyrSynced: "\uC2DC\uAC04 \uB3D9\uAE30\uD654",
          lyrPlain: "\uD14D\uC2A4\uD2B8\uB9CC",
          karaoke: "\uB2E8\uC5B4\uBCC4 \uAC00\uB77C\uC624\uCF00",
          karaokeHint: "\uB2E8\uC5B4\uAC00 \uCC28\uB840\uB85C \uBE5B\uB0A9\uB2C8\uB2E4 \u2013 Spotify \uC74C\uC808 \uD0C0\uC774\uBC0D\uC774 \uC788\uC73C\uBA74 \uC815\uD655\uD558\uAC8C, \uC5C6\uC73C\uBA74 \uCD94\uC815",
          font: "\uAE00\uAF34",
          fontHint: "Spotify \uC804\uCCB4\uC5D0 \uC801\uC6A9\uB429\uB2C8\uB2E4",
          font_outfit: "Outfit",
          font_jakarta: "Jakarta",
          font_manrope: "Manrope",
          font_sora: "Sora",
          font_lexend: "Lexend",
          font_nunito: "Nunito",
          font_system: "\uC2DC\uC2A4\uD15C",
          shareMonth: "\uC0C9\uC73C\uB85C \uBCF4\uB294 \uB098\uC758 \uD55C \uB2EC",
          monthKicker: "Mirage \xB7 \uCD5C\uADFC 30\uC77C",
          monthTitle: "\uC0C9\uC73C\uB85C \uBCF4\uB294 \uB098\uC758 \uD55C \uB2EC",
          monthDays: "\uC77C",
          monthDaily: "\uD558\uB8E8 \uCCAD\uCDE8 \uC2DC\uAC04",
          monthSongs: "\uC778\uAE30 \uACE1",
          trToggle: "\uBC88\uC5ED",
          trShow: "\uBC88\uC5ED \uD45C\uC2DC",
          trHide: "\uBC88\uC5ED \uC228\uAE30\uAE30",
          party_rave: "Rave",
          party_rock: "Rock",
          party_pop: "Pop",
          tabMix: "\uBBF9\uC2A4",
          tabParty: "\uD30C\uD2F0",
          party_auto: "\uC790\uB3D9",
          party_bass: "\uBCA0\uC774\uC2A4",
          party_chill: "\uCE60",
          partySection: "\uD30C\uD2F0 \uBAA8\uB4DC",
          partySectionHint: "\uC790\uB3D9\uC740 \uC7A5\uB974, \uD15C\uD3EC, \uC74C\uB7C9\uC5D0 \uB530\uB77C \uACE1\uB9C8\uB2E4 \uC2A4\uD0C0\uC77C\uC744 \uACE0\uB985\uB2C8\uB2E4",
          partyLevel: "\uAC15\uB3C4",
          partyLevel1: "\uBD80\uB4DC\uB7FD\uAC8C",
          partyLevel2: "\uBCF4\uD1B5",
          partyLevel3: "\uCD5C\uB300",
          partyFlash: "\uCEEC\uB7EC \uD50C\uB798\uC2DC",
          partyFlashHint: "\uBE44\uD2B8\uC5D0 \uB9DE\uCD98 \uBD80\uB4DC\uB7EC\uC6B4 \uC0C9 \uBB3C\uACB0, \uCD08\uB2F9 \uBA87 \uBC88 \uC774\uD558. \uB3D9\uC791 \uC904\uC774\uAE30\uB97C \uCF1C\uBA74 \uAEBC\uC9D1\uB2C8\uB2E4",
          scanCode: "Spotify\uC5D0\uC11C \uC2A4\uCE94",
          partyJam: "Jam \uCC38\uC5EC\uC790 \uD45C\uC2DC",
          partyJamHint: "Spotify Jam \uC911\uC5D0\uB294 \uBAA8\uB4E0 \uCC38\uC5EC\uC790(\uB098 \uD3EC\uD568)\uC758 \uD504\uB85C\uD544 \uC0AC\uC9C4\uC774 \uAC00\uC7A5\uC790\uB9AC\uC5D0 \uB5A0 \uC788\uC2B5\uB2C8\uB2E4",
          jamYou: "\uB098"
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
          bright: "\u80CC\u666F\u4EAE\u5EA6",
          dynamicHint: "\u6574\u4E2A\u754C\u9762\u968F\u6B4C\u66F2\u7684\u914D\u8272\u53D8\u5316",
          particlesHint: "\u80CC\u666F\u4E2D\u6F02\u6D6E\u7684\u5149\u70B9",
          beatHint: "Spotify \u63D0\u4F9B\u8282\u62CD\u6570\u636E\u65F6\u968F\u8282\u62CD\u8109\u52A8",
          cascadeHint: "\u5207\u6362\u9875\u9762\u65F6\u5185\u5BB9\u6ED1\u5165",
          vinylHint: "\u5E95\u90E8\u7684\u5C01\u9762\u53D8\u6210\u65CB\u8F6C\u7684\u5531\u7247",
          tiltHint: "\u5361\u7247\u671D\u9F20\u6807\u6307\u9488\u65B9\u5411\u503E\u659C",
          burstHint: "\u559C\u6B22\u4E00\u9996\u6B4C\u65F6\u8FF8\u51FA\u706B\u82B1",
          overlay: "Mirage Overlay",
          overlayHint: "\u5C06\u5207\u6B4C\u4FE1\u606F\u53D1\u9001\u5230 Spotify \u4E4B\u5916\u7684\u60AC\u6D6E\u7A97\u5E94\u7528",
          grainHint: "\u80CC\u666F\u4E0A\u53E0\u52A0\u7EC6\u5FAE\u566A\u70B9",
          calmHint: "\u505C\u6B62\u6240\u6709\u80CC\u666F\u52A8\u753B",
          vizSection: "\u53EF\u89C6\u5316",
          vizSectionHint: "\u6C89\u6D78\u6A21\u5F0F\u4E2D\u53EF\u89C6\u5316\u7684\u5916\u89C2 \u2013 \u7ACB\u5373\u751F\u6548",
          viz_bars: "\u67F1\u72B6",
          viz_wave: "\u6CE2\u5F62",
          viz_dots: "\u5706\u70B9",
          vizBars: "\u67F1\u5B50\u6570\u91CF",
          vizHeight: "\u9AD8\u5EA6",
          vizSmooth: "\u5E73\u6ED1\u5EA6",
          vizGlow: "\u5149\u6655",
          vizRings: "\u968F\u8282\u62CD\u7684\u5149\u73AF",
          vizMirror: "\u955C\u50CF",
          vizSpin: "\u7F13\u6162\u65CB\u8F6C",
          scheme: "\u914D\u8272\u65B9\u6848",
          schemeHint: "\u5373\u65F6\u5207\u6362 \u2013 Mirage \u5B9E\u65F6\u8DDF\u968F\u5C01\u9762",
          glass: "\u771F\u5B9E\u73BB\u7483",
          glassHint: "\u5728\u6BCF\u4E2A\u9762\u677F\u540E\u5B9E\u65F6\u6A21\u7CCA \u2013 \u66F4\u7CBE\u81F4\uFF0C\u4F46\u5F88\u8017\u6027\u80FD",
          c_shuffle: "\u968F\u673A\u64AD\u653E (S)",
          c_repeat: "\u91CD\u590D (R)",
          c_like: "\u559C\u6B22 (L)",
          c_mute: "\u9759\u97F3",
          c_full: "\u5168\u5C4F (F)",
          c_volume: "\u97F3\u91CF (\u2191 \u2193)",
          tip: "\u6C89\u6D78\u6A21\u5F0F\uFF1ACtrl + Shift + M \u6216\u9876\u90E8\u7684\u5706\u5F62\u6309\u94AE\u3002\u5728\u6A21\u5F0F\u4E2D\uFF1A1 \xB7 2 \xB7 3 \u5207\u6362\u89C6\u56FE\uFF0CSpace \u64AD\u653E\uFF0C\u2190 \u2192 \u5FEB\u8FDB/\u5FEB\u9000\uFF0C\u2191 \u2193 \u97F3\u91CF\uFF0CL \u559C\u6B22\uFF0CS \u968F\u673A\u64AD\u653E\uFF0CR \u91CD\u590D\uFF0CF \u5168\u5C4F\u3002",
          presetTitle: "\u5916\u89C2\u4E0E\u6027\u80FD",
          presetHint: "\u4E00\u952E\u5168\u90E8\u8BBE\u7F6E \u2013 \u53EF\u5728\u4E0B\u65B9\u5FAE\u8C03",
          preset_full: "\u5B8C\u6574",
          preset_balanced: "\u5747\u8861",
          preset_light: "\u8F7B\u91CF",
          preset_calm: "\u5B89\u9759",
          presetCustom: "\u81EA\u5B9A\u4E49 \u2013 \u4F60\u66F4\u6539\u4E86\u4E2A\u522B\u5F00\u5173",
          perfStepped: "Mirage \u5728\u6B64\u4EC5\u4EE5 {fps} fps \u8FD0\u884C\uFF0C\u5DF2\u5207\u6362\u5230\u201C{preset}\u201D\u4EE5\u4FDD\u6301\u6D41\u7545\u3002",
          autoPerf: "\u81EA\u52A8\u8C03\u6574",
          autoPerfHint: "\u7535\u8111\u8DDF\u4E0D\u4E0A\u65F6\u81EA\u52A8\u964D\u4F4E\u4E00\u6863",
          costly: "\u6D88\u8017\u6027\u80FD\u548C\u7535\u91CF",
          safeMode: "Spotify {v} \u66F4\u6539\u4E86\u754C\u9762\u7ED3\u6784 \u2013 Mirage \u5DF2\u5207\u6362\u5230\u5B89\u5168\u6A21\u5F0F\uFF08\u4EC5\u914D\u8272\uFF09\u3002\u66F4\u65B0 Mirage \u5373\u53EF\u4FEE\u590D\u3002",
          share: "\u5206\u4EAB\u4E3A\u56FE\u7247",
          shareNow: "\u5206\u4EAB\u6B63\u5728\u64AD\u653E",
          shareWeek: "\u4F60\u8FD9\u4E00\u5468\u7684\u8272\u5F69",
          shareCopied: "\u56FE\u7247\u5DF2\u590D\u5236 \u2013 \u5E76\u5DF2\u4FDD\u5B58\u5230\u201C\u4E0B\u8F7D\u201D",
          shareSaved: "\u56FE\u7247\u5DF2\u4FDD\u5B58\u5230\u201C\u4E0B\u8F7D\u201D",
          weekKicker: "Mirage \xB7 \u6700\u8FD1 7 \u5929",
          weekTitle: "\u4F60\u8FD9\u4E00\u5468\u7684\u8272\u5F69",
          weekSongs: "\u9996\u6B4C",
          weekMinutes: "\u5206\u949F",
          weekColours: "\u4F60\u7684\u5C01\u9762\u8272\u5F69",
          weekArtists: "\u6700\u5E38\u6536\u542C",
          weekEmpty: "\u542C\u51E0\u9996\u6B4C\u5427 \u2013 \u4F60\u7684\u4E00\u5468\u4F1A\u6162\u6162\u5145\u5B9E\u8D77\u6765\u3002",
          weekScheme: "\u6700\u7231\u7684\u914D\u8272\uFF1A{s}",
          keysTitle: "\u952E\u76D8\u5FEB\u6377\u952E",
          k_play: "\u64AD\u653E / \u6682\u505C",
          k_seek: "\u5FEB\u8FDB/\u5FEB\u9000 5 \u79D2",
          k_vol: "\u97F3\u91CF",
          k_view: "\u5C01\u9762 \xB7 \u6B4C\u8BCD \xB7 \u53EF\u89C6\u5316 \xB7 \u6DF7\u5408 \xB7 \u6D3E\u5BF9",
          k_like: "\u559C\u6B22",
          k_shuffle: "\u968F\u673A\u64AD\u653E",
          k_repeat: "\u91CD\u590D",
          k_full: "\u5168\u5C4F",
          k_next: "\u4E0B\u4E00\u9996 / \u4E0A\u4E00\u9996",
          k_close: "\u5173\u95ED",
          unsynced: "\u8FD9\u4EFD\u6B4C\u8BCD\u6CA1\u6709\u65F6\u95F4\u540C\u6B65 \u2013 \u5B83\u4F1A\u81EA\u7531\u6EDA\u52A8\u3002",
          g_colours: "\u914D\u8272",
          g_background: "\u80CC\u666F",
          g_motion: "\u52A8\u753B",
          g_immersive: "\u6C89\u6D78\u6A21\u5F0F",
          g_builder: "\u521B\u5EFA\u81EA\u5DF1\u7684\u914D\u8272",
          g_overlay: "\u60AC\u6D6E\u7A97",
          g_more: "\u5206\u4EAB\u3001\u5907\u4EFD\u4E0E\u5E2E\u52A9",
          freeze: "\u51BB\u7ED3\u914D\u8272",
          freezeHint: "\u65E0\u8BBA\u64AD\u653E\u4EC0\u4E48\u90FD\u4FDD\u6301\u5F53\u524D\u914D\u8272",
          pinAlbum: "\u8BB0\u4F4F\u8FD9\u5F20\u4E13\u8F91\u7684\u914D\u8272",
          unpinAlbum: "\u5FD8\u8BB0\u8FD9\u5F20\u4E13\u8F91\u7684\u914D\u8272",
          pinnedAlbum: "\u8FD9\u5F20\u4E13\u8F91\u4ECA\u540E\u5C06\u59CB\u7EC8\u4F7F\u7528\u8FD9\u4E9B\u914D\u8272",
          unpinnedAlbum: "\u5DF2\u5FD8\u8BB0\u4E13\u8F91\u914D\u8272",
          playlistSchemeOn: "\u4E3A\u6B64\u6B4C\u5355\u4F7F\u7528\u201C{s}\u201D",
          playlistSchemeOff: "\u6B4C\u5355\u6B63\u5728\u4F7F\u7528\u201C{s}\u201D \u2013 \u79FB\u9664",
          lyrSize: "\u6B4C\u8BCD\u5927\u5C0F",
          lyrGap: "\u884C\u8DDD",
          translate: "\u7FFB\u8BD1\u6B4C\u8BCD",
          translateHint: "\u5728\u6BCF\u884C\u4E0B\u65B9\u663E\u793A\u7FFB\u8BD1 \u2013 \u6B4C\u8BCD\u884C\u4F1A\u53D1\u9001\u5230 Google \u7FFB\u8BD1",
          canvas: "Canvas \u89C6\u9891",
          canvasHint: "\u5728\u5C01\u9762\u540E\u65B9\u64AD\u653E Spotify \u7684\u77ED\u5FAA\u73AF\u89C6\u9891\uFF08\u5982\u6709\uFF09",
          viz_particles: "\u7C92\u5B50",
          viz_line: "\u7EBF\u6761",
          viz_bottom: "\u5E95\u90E8\u67F1\u72B6",
          c_base: "\u80CC\u666F",
          c_accent: "\u5F3A\u8C03\u8272",
          c_deep: "\u6DF1\u8272",
          c_light: "\u6D45\u8272",
          schemeName: "\u914D\u8272\u540D\u79F0",
          schemeCodeHint: "\u5728\u6B64\u7C98\u8D34\u914D\u8272\u4EE3\u7801\u5373\u53EF\u5BFC\u5165",
          schemeSave: "\u4FDD\u5B58\u914D\u8272",
          schemeCopy: "\u590D\u5236\u4E3A\u4EE3\u7801",
          schemeImport: "\u5BFC\u5165\u4EE3\u7801",
          schemeNameTaken: "\u8BF7\u8D77\u4E00\u4E2A\u4E0E\u5185\u7F6E\u914D\u8272\u4E0D\u540C\u7684\u540D\u79F0",
          schemeDelete: "\u5220\u9664\u914D\u8272",
          copied: "\u5DF2\u590D\u5236",
          badCode: "\u8FD9\u4E2A\u4EE3\u7801\u4F3C\u4E4E\u4E0D\u6B63\u786E",
          settingsCodeHint: "\u5728\u6B64\u7C98\u8D34\u8BBE\u7F6E\u4EE3\u7801\u5373\u53EF\u5BFC\u5165",
          exportSettings: "\u590D\u5236\u8BBE\u7F6E",
          importSettings: "\u5BFC\u5165\u8BBE\u7F6E",
          diagnostics: "\u590D\u5236\u8BCA\u65AD\u4FE1\u606F",
          reset: "\u91CD\u7F6E",
          resetConfirm: "\u8981\u91CD\u7F6E Mirage \u7684\u6240\u6709\u8BBE\u7F6E\u5417\uFF1F\u4F60\u81EA\u5DF1\u7684\u914D\u8272\u548C\u8BB0\u4F4F\u7684\u989C\u8272\u4F1A\u4FDD\u7559\u3002",
          welcomeTitle: "\u6B22\u8FCE\u4F7F\u7528 Mirage",
          welcomeText: "Ctrl + Shift + M \u6253\u5F00\u6C89\u6D78\u6A21\u5F0F\u3002\u8BBE\u7F6E\u4F4D\u4E8E\u4E2A\u4EBA\u8D44\u6599\u83DC\u5355\u4E2D\u3002",
          welcomeImmersive: "\u8BD5\u8BD5\u6C89\u6D78\u6A21\u5F0F",
          c_smart: "Smart Shuffle (S)",
          c_queue: "\u63A5\u4E0B\u6765\u64AD\u653E (Q)",
          c_devices: "\u8BBE\u5907",
          c_timer: "\u7761\u7720\u5B9A\u65F6\u5668",
          queueEmpty: "\u961F\u5217\u4E3A\u7A7A",
          devicesNone: "\u672A\u627E\u5230\u5176\u4ED6\u8BBE\u5907",
          deviceActive: "\u6B63\u5728\u6B64\u8BBE\u5907\u64AD\u653E",
          timerTrack: "\u672C\u9996\u6B4C\u7ED3\u675F\u65F6",
          timerOff: "\u5173\u95ED",
          timerLeft: "\u5269\u4F59 {m} \u5206\u949F",
          k_queue: "\u63A5\u4E0B\u6765\u64AD\u653E",
          overlayDownload: "\u4E0B\u8F7D Overlay \u5E94\u7528",
          overlayAllDownloads: "\u6240\u6709\u4E0B\u8F7D",
          overlayConnected: "\u25CF Overlay \u5DF2\u8FDE\u63A5",
          overlayMissing: "\u25CB Overlay \u672A\u8FD0\u884C \u2013 \u7528\u4E0B\u65B9\u6309\u94AE\u5B89\u88C5\uFF0C\u7136\u540E\u542F\u52A8\u4E00\u6B21",
          onlineLyrics: "\u5728\u7EBF\u641C\u7D22\u6B4C\u8BCD",
          onlineLyricsHint: "\u5982\u679C Spotify \u6CA1\u6709\u6B4C\u8BCD\uFF0CMirage \u4F1A\u67E5\u8BE2 LRCLIB \u2013 \u53EA\u53D1\u9001\u6807\u9898\u3001\u827A\u4EBA\u3001\u4E13\u8F91\u548C\u65F6\u957F",
          emptyTitle: "\u8FD9\u9996\u6B4C\u6CA1\u6709\u6B4C\u8BCD",
          emptyText: "Spotify \u548C LRCLIB \u76EE\u524D\u90FD\u6CA1\u6709\u8FD9\u9996\u6B4C\u7684\u6B4C\u8BCD\u3002",
          emptyTextOff: "Spotify \u6CA1\u6709\u6B4C\u8BCD\u3002\u5728\u8BBE\u7F6E\u4E2D\u6253\u5F00\u201C\u5728\u7EBF\u641C\u7D22\u6B4C\u8BCD\u201D\u4EE5\u8FDB\u4E00\u6B65\u67E5\u627E\u3002",
          instrTitle: "\u7EAF\u97F3\u4E50",
          instrText: "\u6CA1\u6709\u6B4C\u8BCD \u2013 \u5C3D\u60C5\u4EAB\u53D7\u97F3\u4E50\u5427\u3002",
          showViz: "\u663E\u793A\u53EF\u89C6\u5316",
          searchWeb: "\u5728\u7F51\u4E0A\u641C\u7D22",
          lyrPick: "\u9009\u62E9\u7248\u672C",
          lyrPicked: "\u5DF2\u9009\u62E9",
          lyrNone: "\u65E0\u6B4C\u8BCD",
          lyrAuto: "\u81EA\u52A8",
          lyrAutoHint: "\u5148\u7528 Spotify\uFF0C\u518D\u7528 LRCLIB \u7684\u6700\u4F73\u5339\u914D",
          lyrNoVersions: "LRCLIB \u6CA1\u6709\u8FD9\u9996\u6B4C\u7684\u5176\u4ED6\u7248\u672C",
          lyrSynced: "\u65F6\u95F4\u540C\u6B65",
          lyrPlain: "\u7EAF\u6587\u672C",
          karaoke: "\u9010\u5B57\u5361\u62C9 OK",
          karaokeHint: "\u6B4C\u8BCD\u9010\u5B57\u4EAE\u8D77 \u2013 \u6709 Spotify \u97F3\u8282\u65F6\u95F4\u65F6\u7CBE\u786E\uFF0C\u5426\u5219\u4E3A\u4F30\u7B97",
          font: "\u5B57\u4F53",
          fontHint: "\u5E94\u7528\u4E8E\u6574\u4E2A Spotify",
          font_outfit: "Outfit",
          font_jakarta: "Jakarta",
          font_manrope: "Manrope",
          font_sora: "Sora",
          font_lexend: "Lexend",
          font_nunito: "Nunito",
          font_system: "\u7CFB\u7EDF",
          shareMonth: "\u4F60\u8FD9\u4E2A\u6708\u7684\u8272\u5F69",
          monthKicker: "Mirage \xB7 \u6700\u8FD1 30 \u5929",
          monthTitle: "\u4F60\u8FD9\u4E2A\u6708\u7684\u8272\u5F69",
          monthDays: "\u5929",
          monthDaily: "\u6BCF\u65E5\u6536\u542C\u65F6\u957F",
          monthSongs: "\u70ED\u95E8\u6B4C\u66F2",
          trToggle: "\u7FFB\u8BD1",
          trShow: "\u663E\u793A\u7FFB\u8BD1",
          trHide: "\u9690\u85CF\u7FFB\u8BD1",
          party_rave: "Rave",
          party_rock: "Rock",
          party_pop: "Pop",
          tabMix: "\u6DF7\u5408",
          tabParty: "\u6D3E\u5BF9",
          party_auto: "\u81EA\u52A8",
          party_bass: "\u4F4E\u97F3",
          party_chill: "\u653E\u677E",
          partySection: "\u6D3E\u5BF9\u6A21\u5F0F",
          partySectionHint: "\u81EA\u52A8\u6A21\u5F0F\u4F1A\u6839\u636E\u6D41\u6D3E\u3001\u8282\u594F\u548C\u54CD\u5EA6\u4E3A\u6BCF\u9996\u6B4C\u9009\u62E9\u98CE\u683C",
          partyLevel: "\u5F3A\u5EA6",
          partyLevel1: "\u67D4\u548C",
          partyLevel2: "\u6807\u51C6",
          partyLevel3: "\u6700\u5F3A",
          partyFlash: "\u8272\u5F69\u95EA\u5149",
          partyFlashHint: "\u968F\u8282\u62CD\u51FA\u73B0\u7684\u67D4\u548C\u8272\u5F69\uFF0C\u6BCF\u79D2\u6700\u591A\u51E0\u6B21\u3002\u5F00\u542F\u201C\u51CF\u5F31\u52A8\u6001\u6548\u679C\u201D\u65F6\u5173\u95ED",
          scanCode: "\u5728 Spotify \u4E2D\u626B\u63CF",
          partyJam: "\u663E\u793A Jam \u6210\u5458",
          partyJamHint: "Spotify Jam \u8FDB\u884C\u65F6\uFF0C\u6240\u6709\u6210\u5458\uFF08\u5305\u62EC\u4F60\uFF09\u7684\u5934\u50CF\u4F1A\u5728\u8FB9\u7F18\u8F7B\u8F7B\u6F02\u6D6E",
          jamYou: "\u4F60"
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
        onlineLyrics: true,
        karaoke: true,
        font: "outfit",
        lyricPicks: {},
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
        partyStyle: "auto",
        partyLevel: 2,
        partyFlash: true,
        partyJam: true,
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
        const segs = (d.segments || []).map((s) => ({ t: s.start, l: s.loudness_max, p: s.pitches || [] }));
        const gaps = d.beats.slice(1, 200).map((b, i) => b.start - d.beats[i].start).filter((g) => g > 0.2 && g < 2).sort((a, b) => a - b);
        const bpm = Number(d.track?.tempo) || (gaps.length ? 60 / gaps[gaps.length >> 1] : 0);
        const avg = segs.length ? segs.reduce((n, s) => n + s.l, 0) / segs.length : -12;
        audio.data = {
          beats: d.beats.map((b) => ({ t: b.start, c: b.confidence ?? 1 })),
          bars: (d.bars || []).map((b) => ({ t: b.start })),
          segs,
          bpm: Math.round(bpm),
          loud: Number(d.track?.loudness) || avg,
          avg
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

  // src/lyrics.js
  function getLyrics(uri) {
    if (!/^spotify:(track|local):/.test(uri || "")) return Promise.resolve(null);
    const pick = cfg.onlineLyrics ? cfg.lyricPicks?.[uri] || "" : "";
    const key = uri + (cfg.onlineLyrics ? "|web" : "") + "|" + pick;
    if (!lyricCache.has(key)) lyricCache.set(key, fetchLyrics(uri, pick));
    return lyricCache.get(key);
  }
  async function fetchLyrics(uri, pick) {
    const item = currentItem();
    const meta = item?.uri === uri ? songMeta(item) : metaCache.get(uri) || null;
    if (meta) metaCache.set(uri, meta);
    if (pick) {
      const hit = await lrclib("get/" + encodeURIComponent(pick));
      const got = hit && fromHit(hit);
      if (got) return got;
    }
    const own = uri.startsWith("spotify:track:") ? await fetchSpotify(uri) : null;
    if (own || !cfg.onlineLyrics || !meta) return own;
    return fetchLrclib(meta);
  }
  async function fetchSpotify(uri) {
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
      // SYLLABLE_SYNCED ist genauso zeitgenau, liefert aber zusätzlich Silbenzeiten (für Karaoke)
      synced: L.syncType === "LINE_SYNCED" || L.syncType === "SYLLABLE_SYNCED",
      lang: L.language || "",
      source: "spotify",
      lines: L.lines.map((l) => {
        const line = { t: Number(l.startTimeMs) || 0, text: (l.words || "").trim() || "\u266A" };
        const syl = (l.syllables || []).filter((x) => x && x.startTimeMs != null && Number(x.numChars) > 0);
        if (syl.length) line.syl = syl.map((x) => ({ t: Number(x.startTimeMs), n: Number(x.numChars) }));
        return line;
      })
    } : null;
  }
  function songMeta(item) {
    const m = item.metadata || {};
    const ms = Number(m.duration) || Number(item.duration?.milliseconds) || Number(S.Player.data?.duration) || 0;
    return {
      title: titleOf(item),
      artist: m.artist_name || artistOf(item).split(", ")[0] || "",
      album: m.album_title || item.album?.name || "",
      sec: Math.round(ms / 1e3)
    };
  }
  async function lrclib(path) {
    try {
      const res = await fetch(LRCLIB + path, { headers: { "Lrclib-Client": "mirage (https://github.com/Passimoritz/spicetify-mirage)" } });
      return res.ok ? await res.json() : null;
    } catch {
      return null;
    }
  }
  async function fetchLrclib(meta) {
    if (!meta.title || !meta.artist) return null;
    const qs = (o) => Object.entries(o).filter(([, v]) => v).map(([k, v]) => k + "=" + encodeURIComponent(v)).join("&");
    const title = cleanTitle(meta.title) || meta.title;
    let hit = meta.sec ? await lrclib("get?" + qs({ track_name: title, artist_name: meta.artist, album_name: meta.album, duration: meta.sec })) : null;
    if (!hit?.syncedLyrics && !hit?.plainLyrics && !hit?.instrumental) {
      const list = await lrclib("search?" + qs({ track_name: title, artist_name: meta.artist }));
      const fits = (Array.isArray(list) ? list : []).filter((x) => !meta.sec || Math.abs((x.duration || 0) - meta.sec) <= 4);
      fits.sort((a, b) => !!b.syncedLyrics - !!a.syncedLyrics || Math.abs(a.duration - meta.sec) - Math.abs(b.duration - meta.sec));
      hit = fits[0] || null;
    }
    return hit ? fromHit(hit) : null;
  }
  function fromHit(hit) {
    const base = { lang: "", source: "lrclib", lrcId: hit.id };
    if (hit.instrumental) return { ...base, synced: false, instrumental: true, lines: [] };
    const synced = parseLrc(hit.syncedLyrics || "");
    if (synced.length) return { ...base, synced: true, lines: synced };
    const plain = (hit.plainLyrics || "").split(/\r?\n/).map((x) => x.trim());
    while (plain.length && !plain[plain.length - 1]) plain.pop();
    return plain.length ? { ...base, synced: false, lines: plain.map((text) => ({ t: 0, text: text || "\u266A" })) } : null;
  }
  async function lyricVersions(uri) {
    const meta = metaCache.get(uri) || (currentItem()?.uri === uri ? songMeta(currentItem()) : null);
    if (!meta?.title) return [];
    const title = cleanTitle(meta.title) || meta.title;
    const q = (o) => Object.entries(o).filter(([, v]) => v).map(([k, v]) => k + "=" + encodeURIComponent(v)).join("&");
    let list = await lrclib("search?" + q({ track_name: title, artist_name: meta.artist }));
    if (!Array.isArray(list) || !list.length) list = await lrclib("search?" + q({ q: `${title} ${meta.artist}` }));
    const diff = (x) => meta.sec ? Math.abs((x.duration || 0) - meta.sec) : 0;
    return (Array.isArray(list) ? list : []).filter((x) => x.syncedLyrics || x.plainLyrics || x.instrumental).sort((a, b) => !!b.syncedLyrics - !!a.syncedLyrics || diff(a) - diff(b)).slice(0, 12).map((x) => ({ id: x.id, title: x.trackName, artist: x.artistName, album: x.albumName, sec: Math.round(x.duration || 0), synced: !!x.syncedLyrics, instrumental: !!x.instrumental }));
  }
  function pickLyrics(uri, id) {
    const picks = { ...cfg.lyricPicks || {} };
    delete picks[uri];
    if (id) picks[uri] = String(id);
    const keys = Object.keys(picks);
    for (const k of keys.slice(0, Math.max(0, keys.length - 200))) delete picks[k];
    cfg.lyricPicks = picks;
    save();
  }
  function parseLrc(lrc) {
    const out = [];
    for (const row of lrc.split(/\r?\n/)) {
      const marks = [...row.matchAll(/\[(\d+):(\d+(?:[.:]\d+)?)\]/g)];
      if (!marks.length) continue;
      const text = row.slice(marks[marks.length - 1].index + marks[marks.length - 1][0].length).trim() || "\u266A";
      for (const m of marks) out.push({ t: Math.round((Number(m[1]) * 60 + Number(m[2].replace(":", "."))) * 1e3), text });
    }
    return out.sort((a, b) => a.t - b.t);
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
  var lyricCache, metaCache, cleanTitle, LRCLIB, trCache, canvasCache;
  var init_lyrics = __esm({
    "src/lyrics.js"() {
      init_core();
      init_config();
      init_player();
      lyricCache = lru(60);
      metaCache = lru(60);
      cleanTitle = (s) => s.replace(/\s+-\s+.*(remaster|version|edit|live|mix|mono|stereo).*$/i, "").replace(/\s*[([](feat|ft|with)\.?\s[^)\]]*[)\]]/gi, "").trim();
      LRCLIB = "https://lrclib.net/api/";
      trCache = lru(40);
      canvasCache = lru(60);
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
  async function spotifyCode(uri) {
    if (!/^spotify:(track|episode|album|playlist|artist|show):/.test(uri || "")) return null;
    try {
      const res = await fetch(`https://scannables.scdn.co/uri/plain/svg/000000/white/640/${uri}`);
      if (!res.ok) return null;
      let svg = await res.text();
      if (!/<svg/.test(svg)) return null;
      svg = svg.replace(/(<rect x="0" y="0"[^>]*?)fill="#000000"/, '$1fill="none"');
      const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
      try {
        return await loadImage(url);
      } finally {
        setTimeout(() => URL.revokeObjectURL(url), 5e3);
      }
    } catch {
      return null;
    }
  }
  async function nowPlayingCard() {
    const item = currentItem();
    if (!item) return;
    const c = covers(item);
    const [img, code] = await Promise.all([loadImage(c.big || c.small, true), spotifyCode(item.uri)]);
    const pal = palette();
    const [cv, x] = canvas();
    backdrop(x, pal, img);
    const size = code ? 660 : 760, X = (W - size) / 2, Y = code ? 110 : 150;
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
    if (code) {
      const cw = 520, ch = 130, cx = (W - cw) / 2, cy = Y + size + 278;
      x.save();
      x.shadowColor = css(pal[0], 0.45);
      x.shadowBlur = 50;
      rounded(x, cx, cy, cw, ch, ch / 2);
      x.fillStyle = "rgba(8,7,14,0.62)";
      x.fill();
      x.restore();
      rounded(x, cx, cy, cw, ch, ch / 2);
      x.lineWidth = 2.5;
      x.strokeStyle = bar;
      x.stroke();
      x.drawImage(code, cx + 56, cy + 14, 408, 102);
      x.fillStyle = "rgba(255,255,255,0.5)";
      x.font = `600 22px ${FONT}`;
      x.fillText(t("scanCode").toUpperCase(), W / 2, cy + ch + 44);
    } else {
      rounded(x, 240, Y + size + 270, W - 480, 10, 5);
      x.fillStyle = bar;
      x.fill();
    }
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
    const song = titleOf(item) + (artist ? " \xB7 " + artist : "");
    if (titleOf(item)) (d.tracks ||= {})[song] = (d.tracks[song] || 0) + 1;
    if (colors?.[0]) d.hues[Math.floor(rgb2hsl(colors[0])[0] / 30) % 12]++;
    d.schemes[cfg.scheme] = (d.schemes[cfg.scheme] || 0) + 1;
    for (const k of Object.keys(all).sort().slice(0, -35)) delete all[k];
    try {
      localStorage.setItem(STATS, JSON.stringify(all));
    } catch {
    }
  }
  function period(days) {
    const all = loadStats();
    const from = new Date(Date.now() - (days - 1) * 864e5).toISOString().slice(0, 10);
    const sum = { n: 0, ms: 0, artists: {}, tracks: {}, hues: Array(12).fill(0), schemes: {}, active: 0, daily: [] };
    for (let i = days - 1; i >= 0; i--) sum.daily.push((all[new Date(Date.now() - i * 864e5).toISOString().slice(0, 10)]?.ms || 0) / 6e4);
    for (const [day, d] of Object.entries(all)) {
      if (day < from) continue;
      sum.n += d.n;
      sum.ms += d.ms;
      if (d.n) sum.active++;
      for (const [s, v] of Object.entries(d.tracks || {})) sum.tracks[s] = (sum.tracks[s] || 0) + v;
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
  async function monthCard() {
    const m = period(30);
    const hueRank = m.hues.map((v, i) => [v, i]).filter(([v]) => v > 0).sort((a, b) => b[0] - a[0]);
    const pal = hueRank.length ? hueRank.slice(0, 3).map(([, i]) => hsl2rgb([i * 30 + 15, 0.75, 0.62])) : palette();
    while (pal.length < 3) pal.push(pal[0]);
    const [cv, x] = canvas();
    backdrop(x, pal, null);
    x.textAlign = "left";
    x.fillStyle = css(pal[0]);
    x.font = `600 30px ${FONT}`;
    x.fillText(t("monthKicker").toUpperCase(), 90, 160);
    x.fillStyle = "#fff";
    x.font = `800 88px ${FONT}`;
    x.fillText(t("monthTitle"), 84, 262);
    const big = [[String(m.n), t("weekSongs")], [String(Math.round(m.ms / 6e4)), t("weekMinutes")], [String(m.active), t("monthDays")]];
    big.forEach(([v, label], i) => {
      const X2 = 90 + i * 310;
      x.fillStyle = "#fff";
      x.font = `800 100px ${FONT}`;
      x.fillText(v, X2, 420);
      x.fillStyle = "rgba(255,255,255,0.65)";
      x.font = `500 32px ${FONT}`;
      x.fillText(label, X2, 466);
    });
    x.fillStyle = "rgba(255,255,255,0.65)";
    x.font = `500 30px ${FONT}`;
    x.fillText(t("weekColours"), 90, 562);
    const total = hueRank.reduce((s, [v]) => s + v, 0) || 1;
    let X = 90;
    for (const [v, i] of hueRank) {
      const wdt = (W - 180) * v / total;
      x.fillStyle = css(hsl2rgb([i * 30 + 15, 0.75, 0.62]));
      rounded(x, X, 586, Math.max(wdt - 6, 6), 70, 16);
      x.fill();
      X += wdt;
    }
    if (!hueRank.length) {
      x.fillStyle = "rgba(255,255,255,0.12)";
      rounded(x, 90, 586, W - 180, 70, 16);
      x.fill();
    }
    x.fillStyle = "rgba(255,255,255,0.65)";
    x.fillText(t("monthDaily"), 90, 742);
    const peak = Math.max(...m.daily, 1), bw = (W - 180) / m.daily.length;
    m.daily.forEach((v, i) => {
      const h = v ? Math.max(8, v / peak * 130) : 4;
      x.fillStyle = v ? css(pal[i % 3 === 2 ? 1 : 0], 0.9) : "rgba(255,255,255,0.14)";
      rounded(x, 90 + i * bw + 2, 900 - h, bw - 4, h, 5);
      x.fill();
    });
    const cols = [[t("weekArtists"), Object.entries(m.artists)], [t("monthSongs"), Object.entries(m.tracks)]];
    cols.forEach(([label, list], c) => {
      const CX = 90 + c * 470;
      x.fillStyle = "rgba(255,255,255,0.65)";
      x.font = `500 30px ${FONT}`;
      x.fillText(label, CX, 990);
      const top = list.sort((a, b) => b[1] - a[1]).slice(0, 3);
      top.forEach(([name, n], i) => {
        const Y = 1060 + i * 72;
        x.fillStyle = css(pal[i % 3]);
        x.font = `800 38px ${FONT}`;
        x.fillText(String(i + 1), CX, Y);
        x.fillStyle = "#fff";
        x.font = `700 38px ${FONT}`;
        x.fillText(fit(x, name.split(" \xB7 ")[0], 290), CX + 46, Y);
        x.fillStyle = "rgba(255,255,255,0.55)";
        x.font = `500 26px ${FONT}`;
        x.textAlign = "right";
        x.fillText(`${n}\xD7`, CX + 420, Y);
        x.textAlign = "left";
      });
      if (!top.length) {
        x.fillStyle = "rgba(255,255,255,0.6)";
        x.font = `500 32px ${FONT}`;
        x.fillText(t("weekEmpty").split(" \u2013 ")[0], CX, 1060);
      }
    });
    watermark(x);
    deliver(cv, "mirage-month.png");
  }
  var W, H, css, FONT, STATS, today, lastRecorded, week;
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
      week = () => period(7);
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
  function restoreVolume() {
    if (fadeFrom == null) return;
    const v = fadeFrom;
    fadeFrom = null;
    try {
      S.Player.setVolume(v);
    } catch {
    }
  }
  function stopSleep() {
    S.Player.pause ? S.Player.pause() : S.Player.togglePlay();
    clearInterval(fadeTick);
    setTimeout(restoreVolume, 900);
  }
  function fadeStep() {
    let left, span;
    if (sleepAt) {
      left = sleepAt - Date.now();
      span = Math.min(12e4, sleepTotal * 0.3);
    } else if (sleepEndOfTrack) {
      left = (S.Player.getDuration?.() || 0) - (S.Player.getProgress?.() || 0);
      span = 2e4;
    } else return;
    if (!S.Player.isPlaying() || left > span || left <= 0) return;
    if (fadeFrom == null) fadeFrom = S.Player.getVolume?.() ?? 1;
    try {
      S.Player.setVolume(Math.max(0.02, fadeFrom * (left / span)));
    } catch {
    }
  }
  function setSleep(minutes) {
    clearTimeout(sleepTimer);
    clearInterval(fadeTick);
    restoreVolume();
    sleepAt = 0;
    sleepEndOfTrack = false;
    if (minutes === "track") {
      sleepEndOfTrack = true;
      fadeTick = setInterval(fadeStep, 500);
      return;
    }
    if (!minutes) return;
    sleepTotal = minutes * 6e4;
    sleepAt = Date.now() + sleepTotal;
    fadeTick = setInterval(fadeStep, 500);
    sleepTimer = setTimeout(() => {
      sleepAt = 0;
      if (S.Player.isPlaying()) stopSleep();
      else {
        clearInterval(fadeTick);
        restoreVolume();
      }
    }, sleepTotal);
  }
  function go(uri) {
    const [, type, id] = String(uri || "").split(":");
    if (!id || !["album", "artist", "show", "episode"].includes(type)) return false;
    S.Platform?.History?.push?.(`/${type}/${id}`);
    return true;
  }
  var api, playerState, MODE, contextUri, nativeButton, lastMode, connect, canConnect, sleepTimer, sleepAt, sleepEndOfTrack, sleepTotal, fadeTick, fadeFrom, isFading, sleepState, albumOf, artistUriOf;
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
      sleepTotal = 0;
      fadeTick = 0;
      fadeFrom = null;
      S.Player.addEventListener?.("songchange", () => {
        if (!sleepEndOfTrack) return;
        sleepEndOfTrack = false;
        stopSleep();
      });
      isFading = () => fadeFrom != null;
      sleepState = () => sleepEndOfTrack ? "track" : sleepAt ? Math.max(1, Math.round((sleepAt - Date.now()) / 6e4)) : 0;
      albumOf = (item) => item?.album?.uri || item?.metadata?.album_uri || "";
      artistUriOf = (item) => item?.artists?.[0]?.uri || item?.metadata?.artist_uri || "";
    }
  });

  // src/party.js
  async function artistGenres(item) {
    const uri = item?.artists?.[0]?.uri || item?.metadata?.artist_uri || "";
    const id = uri.split(":")[2];
    if (!id) return [];
    if (genreCache.has(id)) return genreCache.get(id);
    const job = (async () => {
      try {
        const a = await S.CosmosAsync.get(`https://api.spotify.com/v1/artists/${id}`);
        return Array.isArray(a?.genres) ? a.genres.map((g) => String(g).toLowerCase()) : [];
      } catch {
        return [];
      }
    })();
    genreCache.set(id, job);
    return job;
  }
  function pickProfile(genres, bpm, loud) {
    const text = genres.join(" | ");
    for (const [k, re] of GENRES) if (re.test(text)) return { key: k, why: genres[0] || "" };
    const energy = clamp((loud + 16) / 12, 0, 1);
    if (energy < 0.35 || bpm && bpm < 80) return { key: "chill", why: "" };
    if (bpm >= 118 && bpm <= 135 && energy > 0.6) return { key: "rave", why: "" };
    if (bpm >= 80 && bpm < 105) return { key: "bass", why: "" };
    if (bpm > 140 && energy > 0.7) return { key: "rock", why: "" };
    return { key: "pop", why: "" };
  }
  var PROFILES, PROFILE_KEYS, GENRES, genreCache, party;
  var init_party = __esm({
    "src/party.js"() {
      init_core();
      init_config();
      init_audio();
      PROFILES = {
        rave: { style: "bars", mirror: true, spin: true, height: 1.55, pulse: 0.09, shake: 0, flash: "bar", ring: 1, glow: 1 },
        bass: { style: "bottom", mirror: false, spin: false, height: 1.8, pulse: 0.12, shake: 7, flash: "bar", ring: 2, glow: 0.8 },
        rock: { style: "wave", mirror: true, spin: false, height: 1.6, pulse: 0.08, shake: 10, flash: "beat", ring: 2, glow: 1 },
        pop: { style: "particles", mirror: true, spin: true, height: 1.45, pulse: 0.07, shake: 0, flash: "bar", ring: 1, glow: 1 },
        chill: { style: "wave", mirror: true, spin: true, height: 1.1, pulse: 0.035, shake: 0, flash: "", ring: 4, glow: 0.6 }
      };
      PROFILE_KEYS = Object.keys(PROFILES);
      GENRES = [
        ["chill", /lo-?fi|chill|ambient|acoustic|jazz|classical|piano|folk|soul|r&b|rnb|bossa|sleep|meditation|singer-songwriter|soundtrack|orchestra/],
        ["rock", /rock|metal|punk|grunge|core\b|emo|hardcore|garage/],
        ["bass", /hip ?hop|rap|trap|drill|grime|phonk|reggaeton|dancehall|afro|urbano|boom bap|gangsta/],
        ["rave", /edm|house|techno|trance|dubstep|drum and bass|dnb|electro|hardstyle|rave|bass music|garage house|big room|psytrance|eurodance/],
        ["pop", /pop|dance|disco|funk|latin|k-pop|schlager|indie/]
      ];
      genreCache = lru(100);
      party = /* @__PURE__ */ (() => {
        let uri = "", picked = "", info = { key: "pop", why: "", bpm: 0 }, token = 0;
        let lastBeat = -1, lastBar = -1, flash = 0, flashCol = 0, shake = 0, drop = 0;
        const calm = () => cfg.calm || matchMedia("(prefers-reduced-motion: reduce)").matches;
        async function prepare(item) {
          const u = item?.uri || "";
          if (u + "|" + cfg.partyStyle === picked) return info;
          picked = u + "|" + cfg.partyStyle;
          uri = u;
          const my = ++token;
          lastBeat = lastBar = -1;
          const genres = cfg.partyStyle === "auto" ? await artistGenres(item) : [];
          if (my !== token) return info;
          const bpm = audio.uri === u ? audio.data?.bpm || 0 : 0;
          const loud = audio.uri === u ? audio.data?.loud ?? -10 : -10;
          const auto = pickProfile(genres, bpm, loud);
          info = { key: cfg.partyStyle !== "auto" && PROFILES[cfg.partyStyle] ? cfg.partyStyle : auto.key, why: auto.why, bpm };
          return info;
        }
        function refine() {
          if (!audio.data || audio.uri !== uri) return;
          if (info.bpm !== audio.data.bpm) {
            info.bpm = audio.data.bpm;
            if (cfg.partyStyle === "auto" && !info.why) info.key = pickProfile([], info.bpm, audio.data.loud).key;
          }
        }
        function step(sec, dt, playing) {
          refine();
          const P = PROFILES[info.key];
          const lvl = [0.6, 1, 1.45][clamp(cfg.partyLevel, 1, 3) - 1];
          const d = audio.uri === uri ? audio.data : null;
          let hit = false, barHit = false, conf = 0.8;
          if (d && playing) {
            const bi = seek(d.beats, sec, "t");
            const every = info.bpm > 145 ? 2 : 1;
            if (bi >= 0 && bi !== lastBeat) {
              lastBeat = bi;
              if (bi % every === 0) {
                hit = true;
                conf = clamp(d.beats[bi].c + 0.3, 0, 1);
              }
            }
            const ba = d.bars?.length ? seek(d.bars, sec, "t") : Math.floor(Math.max(bi, 0) / 4);
            if (ba >= 0 && ba !== lastBar) {
              lastBar = ba;
              barHit = true;
            }
            const s = d.segs[Math.max(seek(d.segs, sec, "t"), 0)];
            const target = s ? clamp((s.l - d.avg - 1.5) / 5, 0, 1) : 0;
            drop += (target - drop) * (1 - Math.exp(-dt * (target > drop ? 6 : 1.2)));
          } else drop *= Math.exp(-dt * 2);
          const fx = !calm();
          const strong = P.flash === "beat" ? hit && lastBeat % 2 === 0 : P.flash === "bar" ? barHit : false;
          if (fx && cfg.partyFlash && strong) {
            flash = Math.min(1, 0.55 + drop * 0.45) * lvl;
            flashCol = (flashCol + 1) % 3;
          }
          flash *= Math.exp(-dt * 5.5);
          if (fx && P.shake && hit) shake = P.shake * lvl * (0.6 + drop * 0.6) * conf;
          shake *= Math.exp(-dt * 14);
          return { P, lvl, hit, barHit, conf, drop, flash, flashCol, shake: fx ? shake : 0 };
        }
        return { prepare, step, get info() {
          return info;
        }, PROFILES, PROFILE_KEYS };
      })();
    }
  });

  // src/jam.js
  async function myself() {
    if (me) return me;
    try {
      const u = await S.Platform?.UserAPI?.getUser?.();
      if (u) me = { username: u.username || "", name: u.displayName || u.username || "", img: u.images?.[0]?.url || u.avatarUrl || "" };
    } catch {
    }
    return me;
  }
  async function jamMembers() {
    let s = null;
    try {
      s = S.Platform?.SocialConnectAPI?.getCurrentSession?.() || null;
    } catch {
    }
    const list = (s?.sessionMembers || []).filter((m) => m && !m.isAnonymous);
    if (!list.length) return [];
    const self = await myself();
    const out = list.map((m) => ({
      id: String(m.id || m.username || m.displayName),
      name: m.displayName || m.username || "",
      img: m.largeImageUrl || m.imageUrl || "",
      me: !!self && !!m.username && m.username === self.username,
      host: !!s.sessionOwnerId && m.id === s.sessionOwnerId
    }));
    if (self && !out.some((m) => m.me)) out.unshift({ id: "me", name: self.name, img: self.img, me: true, host: !!s.isSessionOwner });
    return out.length > 1 ? out : [];
  }
  var me;
  var init_jam = __esm({
    "src/jam.js"() {
      init_core();
      me = null;
    }
  });

  // src/immersive.js
  var ICON, MODES, LYR, VIZ, immersive;
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
      init_party();
      init_jam();
      ICON = {
        prev: '<svg viewBox="0 0 24 24"><path d="M6 5h2v14H6zm3.5 7L20 5v14z"/></svg>',
        next: '<svg viewBox="0 0 24 24"><path d="M16 5h2v14h-2zM4 5l10.5 7L4 19z"/></svg>',
        play: '<svg viewBox="0 0 24 24"><path d="M7 4v16l13-8z"/></svg>',
        pause: '<svg viewBox="0 0 24 24"><path d="M6 4h4v16H6zm8 0h4v16h-4z"/></svg>',
        orb: '<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8z"/><path d="M8 4.2a3.8 3.8 0 0 1 3.8 3.8h-1.3A2.5 2.5 0 0 0 8 5.5z"/></svg>',
        back: '<svg viewBox="0 0 24 24"><path d="M15.4 5.4 14 4l-8 8 8 8 1.4-1.4L8.8 12z"/></svg>',
        translate: '<svg viewBox="0 0 24 24"><path d="M12.9 15.1 10.4 12.6l.1-.1A17.4 17.4 0 0 0 14.1 6H17V4h-7V2H8v2H1v2h11.2A15.7 15.7 0 0 1 9 11.4 15.6 15.6 0 0 1 6.7 8h-2a17.6 17.6 0 0 0 2.9 4.5l-5.1 5L4 19l5-5 3.1 3.1zM18.5 10h-2L12 22h2l1.1-3h4.8l1.1 3h2zm-2.6 7 1.6-4.3 1.6 4.3z"/></svg>',
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
        ["viz", "tabViz"],
        ["mix", "tabMix"],
        ["party", "tabParty"]
      ];
      LYR = /* @__PURE__ */ new Set(["lyrics", "mix", "party"]);
      VIZ = /* @__PURE__ */ new Set(["viz", "mix", "party"]);
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
      <div class="m-im-bg" aria-hidden="true"><i></i><i></i><video class="m-im-canvas" muted loop playsinline preload="none"></video></div>
      <div class="m-im-flash" aria-hidden="true"></div>
      <div class="m-im-jam" hidden></div>
      <canvas class="m-im-viz"></canvas>
      <div class="m-im-drag" aria-hidden="true"></div>
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
      <div class="m-im-lyrbar">
        <button type="button" class="m-im-trbtn" hidden aria-pressed="false">${ICON.translate}<span></span><i aria-hidden="true"></i></button>
        <button type="button" class="m-im-lyrsrc" hidden><span></span><b></b></button>
      </div>
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
            lyrsrc: el2.querySelector(".m-im-lyrsrc"),
            trbtn: el2.querySelector(".m-im-trbtn"),
            ind: el2.querySelector(".m-im-ind"),
            canvas: el2.querySelector(".m-im-viz"),
            flash: el2.querySelector(".m-im-flash"),
            jam: el2.querySelector(".m-im-jam"),
            bg: el2.querySelector(".m-im-bg"),
            shuffle: el2.querySelector(".m-im-shuffle"),
            repeat: el2.querySelector(".m-im-repeat"),
            like: el2.querySelector(".m-im-like"),
            mute: el2.querySelector(".m-im-mute"),
            volume: el2.querySelector(".m-im-volume"),
            full: el2.querySelector(".m-im-full")
          };
          vctx = q.canvas.getContext("2d");
          q.lyrsrc.querySelector("b").textContent = t("lyrPick");
          q.lyrsrc.onclick = () => showSide(side === "versions" ? null : "versions");
          q.trbtn.querySelector("span").textContent = t("trToggle");
          q.trbtn.onclick = () => {
            cfg.translate = !cfg.translate;
            save();
            showTrBtn();
            if (cfg.translate) addTranslations(lyrToken);
            else {
              q.inner.querySelectorAll(".m-im-tr").forEach((n) => n.remove());
              active = -2;
            }
          };
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
        let hazeSrc = "";
        function setHaze(src) {
          if (!el2 || !src || src === hazeSrc) return;
          hazeSrc = src;
          const [a, b] = q.bg.querySelectorAll("i");
          const front = a.classList.contains("is-on") ? a : b.classList.contains("is-on") ? b : null;
          const back = front === a ? b : a;
          const img = new Image();
          img.onload = img.onerror = () => {
            if (hazeSrc !== src) return;
            back.style.backgroundImage = `url("${src}")`;
            requestAnimationFrame(() => {
              back.classList.add("is-on");
              front?.classList.remove("is-on");
            });
          };
          img.src = src;
        }
        function sizeCanvas() {
          if (!q.canvas) return;
          const budget = Math.sqrt(3e6 / Math.max(1, innerWidth * innerHeight));
          const dpr = Math.max(0.6, Math.min(devicePixelRatio || 1, 1.5, budget));
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
            if (LYR.has(mode)) loadLyrics();
            if (mode === "party") party.prepare(currentItem()).then(updateKicker);
            else resetParty();
            sizeCanvas();
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
          if (m === "party") {
            const p = party.info;
            q.kicker.textContent = ["Party", t("party_" + p.key), p.bpm ? p.bpm + " BPM" : ""].filter(Boolean).join(" \xB7 ");
            return;
          }
          q.kicker.textContent = m === "viz" ? t(audio.data ? "vizBeat" : "vizAmbient") : m === "lyrics" ? t("lyrics") : m === "mix" ? t("tabMix") : t("now");
        }
        let partyFx = false;
        function resetParty() {
          if (!partyFx) return;
          partyFx = false;
          q.flash.style.opacity = "0";
          q.wrap.style.translate = "";
        }
        let lastJam = -1e9, jamKey = "";
        async function showJam() {
          const list = cfg.partyJam ? await jamMembers() : [];
          const key = list.map((m) => m.id + m.img).join("|");
          if (key === jamKey) return;
          jamKey = key;
          q.jam.textContent = "";
          q.jam.hidden = !list.length;
          const shown = list.slice(0, 10);
          shown.forEach((m, i) => {
            const left = i % 2 === 0, row = i >> 1, rows = Math.ceil(shown.length / 2);
            const f = document.createElement("figure");
            f.className = "m-jam-p" + (m.me ? " is-me" : "") + (m.host ? " is-host" : "");
            f.style.cssText = `--i:${i};left:${left ? 4 + row % 2 * 3 : 89 - row % 2 * 3}%;top:${20 + (row + 0.5) / rows * 56}%`;
            const pic = document.createElement(m.img ? "img" : "span");
            if (m.img) {
              pic.src = m.img;
              pic.alt = "";
              pic.referrerPolicy = "no-referrer";
            } else pic.textContent = (m.name || "?").trim().charAt(0).toUpperCase();
            const cap = document.createElement("figcaption");
            cap.textContent = m.me ? t("jamYou") : m.name;
            f.append(pic, cap);
            q.jam.append(f);
          });
          if (list.length > shown.length) {
            const more = document.createElement("figure");
            more.className = "m-jam-p is-more";
            more.style.cssText = "--i:10;left:89%;top:86%";
            more.textContent = "+" + (list.length - shown.length);
            q.jam.append(more);
          }
        }
        let lyrToken = 0;
        function emptyLyrics(instrumental) {
          const item = currentItem();
          const box = document.createElement("div");
          box.className = "m-im-empty" + (instrumental ? " is-instrumental" : "");
          box.innerHTML = '<div class="m-im-empty-icon" aria-hidden="true">' + (instrumental ? "<i></i><i></i><i></i><i></i><i></i>" : '<svg viewBox="0 0 24 24"><path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6Z"/></svg>') + '</div><b></b><p></p><div class="m-im-empty-actions"></div>';
          box.querySelector("b").textContent = t(instrumental ? "instrTitle" : "emptyTitle");
          box.querySelector("p").textContent = t(instrumental ? "instrText" : cfg.onlineLyrics ? "emptyText" : "emptyTextOff");
          const actions = box.querySelector(".m-im-empty-actions");
          const viz = document.createElement("button");
          viz.type = "button";
          viz.className = "m-im-empty-btn is-primary";
          viz.textContent = t("showViz");
          viz.onclick = () => setMode("viz", true);
          actions.append(viz);
          if (!instrumental && item) {
            const web = document.createElement("a");
            web.className = "m-im-empty-btn";
            web.textContent = t("searchWeb");
            web.target = "_blank";
            web.rel = "noopener";
            web.href = "https://www.google.com/search?q=" + encodeURIComponent(`${titleOf(item)} ${artistOf(item).split(", ")[0]} lyrics`);
            actions.append(web);
          }
          return box;
        }
        let words = [];
        function wordTimes(lines, i) {
          const l = lines[i];
          const parts = l.text.split(/\s+/).filter(Boolean);
          const next = lines[i + 1]?.t ?? l.t + 6e3;
          if (l.syl?.length) {
            const marks = [];
            let c = 0;
            l.syl.forEach((s, k) => {
              marks.push({ from: c, to: c + s.n, a: s.t, b: l.syl[k + 1]?.t ?? Math.min(next, s.t + 900) });
              c += s.n;
            });
            let pos = 0;
            return parts.map((w) => {
              const from = l.text.indexOf(w, pos);
              pos = from + w.length;
              const hit = marks.filter((m) => m.to > from && m.from < pos);
              return hit.length ? { text: w, a: hit[0].a, b: hit[hit.length - 1].b } : { text: w, a: l.t, b: l.t + 1 };
            });
          }
          const chars = parts.reduce((n, w) => n + w.length + 2, 0);
          const span = Math.max(300, Math.min(next - l.t - 150, Math.max(1100, chars * 85)));
          let at = l.t;
          return parts.map((w) => {
            const d = span * (w.length + 2) / chars;
            const out = { text: w, a: at, b: at + d };
            at += d;
            return out;
          });
        }
        function showSource(got) {
          const picked = !!cfg.lyricPicks?.[lyrUri];
          q.lyrsrc.hidden = !cfg.onlineLyrics || !/^spotify:(track|local):/.test(lyrUri);
          q.lyrsrc.querySelector("span").textContent = got ? (got.source === "lrclib" ? "LRCLIB" : "Spotify") + (picked ? " \xB7 " + t("lyrPicked") : "") : t("lyrNone");
        }
        async function showVersions(body, item) {
          const uri = lyrUri;
          item(t("loading"));
          const list = await lyricVersions(uri);
          if (side !== "versions" || uri !== lyrUri) return;
          body.textContent = "";
          const cur = lyr?.lrcId ? String(lyr.lrcId) : "";
          const pickedId = cfg.lyricPicks?.[uri] || "";
          const choose = (id) => {
            pickLyrics(uri, id);
            lyrUri = "";
            loadLyrics();
            showSide(null);
          };
          item(t("lyrAuto"), t("lyrAutoHint"), null, pickedId ? () => choose("") : null, !pickedId);
          if (!list.length) return item(t("lyrNoVersions"));
          for (const v of list) {
            const kind = v.instrumental ? t("instrTitle") : v.synced ? t("lyrSynced") : t("lyrPlain");
            const sub = [v.album, v.sec ? fmt(v.sec * 1e3) : "", kind].filter(Boolean).join(" \xB7 ");
            const on = String(v.id) === (pickedId || cur);
            item(`${v.title} \u2013 ${v.artist}`, sub, null, on ? null : () => choose(v.id), on);
          }
        }
        async function loadLyrics() {
          const uri = currentItem()?.uri || "";
          if (uri === lyrUri && lyr !== void 0) return;
          const token = ++lyrToken;
          lyrUri = uri;
          lyr = void 0;
          q.inner.style.transition = "none";
          q.inner.style.transform = "";
          void q.inner.offsetHeight;
          q.inner.style.transition = "";
          q.lyrics.classList.remove("is-unsynced");
          el2.classList.remove("is-karaoke");
          q.lyrsrc.hidden = true;
          q.trbtn.hidden = true;
          words = [];
          q.inner.innerHTML = '<div class="m-im-lyrics-note"></div>';
          q.inner.firstChild.textContent = t("loading");
          const got = await getLyrics(uri);
          if (token !== lyrToken) return;
          lyr = got;
          active = -2;
          q.inner.textContent = "";
          q.inner.classList.remove("is-in");
          void q.inner.offsetWidth;
          q.inner.classList.add("is-in");
          showSource(got);
          if (!got || got.instrumental) {
            q.inner.append(emptyLyrics(!!got));
            return;
          }
          const karaoke = cfg.karaoke && got.synced;
          el2.classList.toggle("is-karaoke", karaoke);
          q.lyrics.classList.toggle("is-unsynced", !got.synced);
          const frag = document.createDocumentFragment();
          if (!got.synced) {
            const note = document.createElement("div");
            note.className = "m-im-lyrics-note is-small";
            note.textContent = t("unsynced");
            frag.append(note);
          }
          got.lines.forEach((l, i) => {
            const d = document.createElement("div");
            d.className = "m-im-line";
            d.dataset.t = l.t;
            if (karaoke && l.text !== "\u266A") {
              const box = document.createElement("span");
              box.className = "m-im-words";
              const list = [];
              for (const w of wordTimes(got.lines, i)) {
                const s = document.createElement("span");
                s.className = "m-w";
                s.textContent = w.text;
                box.append(s, " ");
                list.push({ el: s, a: w.a, b: w.b, p: -1 });
              }
              d.append(box);
              words[i] = list;
            } else d.textContent = l.text;
            frag.append(d);
          });
          q.inner.append(frag);
          showTrBtn();
          if (cfg.translate) addTranslations(token);
        }
        async function addTranslations(token) {
          const uri = lyrUri, got = lyr;
          if (!got?.lines?.length || got.instrumental) return;
          const tr = await translateLines(uri, got, LANG);
          if (token !== lyrToken || !tr || !cfg.translate) return;
          const lines = q.inner.querySelectorAll(".m-im-line");
          tr.forEach((text, i) => {
            if (!text || !lines[i] || lines[i].querySelector(".m-im-tr") || text.toLowerCase() === got.lines[i].text.toLowerCase()) return;
            const d = document.createElement("span");
            d.className = "m-im-tr";
            d.textContent = text;
            lines[i].append(d);
          });
          active = -2;
        }
        function showTrBtn() {
          const lang = (lyr?.lang || "").slice(0, 2).toLowerCase();
          q.trbtn.hidden = !lyr?.lines?.length || lyr.instrumental || lang === LANG;
          q.trbtn.classList.toggle("is-on", !!cfg.translate);
          q.trbtn.setAttribute("aria-pressed", String(!!cfg.translate));
          q.trbtn.title = t(cfg.translate ? "trHide" : "trShow");
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
          const ws = i >= 0 && words[i];
          if (ws) {
            for (const w of ws) {
              const p = Math.round(clamp((pos - w.a) / (w.b - w.a), 0, 1) * 50) / 50;
              if (p !== w.p) {
                w.p = p;
                w.el.style.setProperty("--p", p);
              }
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
          const mode = el2.dataset.mode;
          const V = { style: cfg.vizStyle, mirror: cfg.vizMirror, height: cfg.vizHeight / 100, glow: cfg.vizGlow, rings: cfg.vizRings, spin: cfg.vizSpin, pulse: 0.035, ring: 1 };
          if (mode === "mix" && V.style === "line") V.style = "wave";
          const px = mode === "party" ? party.step(sec, dt, playing) : null;
          if (px) {
            const P = px.P;
            Object.assign(V, {
              style: P.style,
              mirror: P.mirror,
              spin: P.spin,
              glow: true,
              rings: true,
              ring: P.ring,
              height: V.height * P.height * (1 + px.drop * 0.35),
              pulse: P.pulse * px.lvl * (1 + px.drop * 0.6)
            });
          }
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
              const c = clamp(audio.data.beats[bi].c + 0.3, 0, 1);
              if (V.rings && bi % V.ring === 0) rings.push(px ? { r: R, a: (0.7 + px.drop * 0.3) * c, w: 3 + px.drop * 4 } : { r: R, a: 0.6 * c, w: 2 });
            }
          }
          const mirror = V.mirror;
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
          const maxLen = Math.min(vw, vh) * 0.11 * V.height * (px ? Math.min(1, R * 0.8 / (Math.min(vw, vh) * 0.11 * V.height)) : 1);
          const rot = V.spin ? tt * (px ? 0.12 : 0.06) : 0;
          ctx.globalCompositeOperation = "lighter";
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          const glow = ctx.createRadialGradient(cx, cy, R * 0.8, cx, cy, R + maxLen * 1.2);
          glow.addColorStop(0, rgba2(pal[0], (0.16 + b * 0.22) * (px ? 1.6 + px.drop : 1)));
          glow.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = glow;
          const gr = R + maxLen * 1.2;
          ctx.fillRect(cx - gr, cy - gr, gr * 2, gr * 2);
          const ang = (i) => i / N * Math.PI * 2 - Math.PI / 2 + rot;
          const tip = (i) => R + 4 * dpr + vals[i] * maxLen;
          if (V.style === "bottom") {
            const bw = vw / N, base = vh - 8 * dpr;
            for (let gi = 0; gi < 3; gi++) {
              ctx.fillStyle = rgba2(pal[gi], 0.85);
              ctx.beginPath();
              for (let i = gi; i < N; i += 3) {
                const h = 6 * dpr + vals[i] * vh * 0.32 * V.height;
                ctx.rect(i * bw + bw * 0.15, base - h, bw * 0.7, h);
              }
              ctx.fill();
            }
          } else if (V.style === "line") {
            const mid = cy;
            for (const [w, col, al] of [[10, pal[1], V.glow ? 0.14 : 0], [2.5, pal[2], 0.95]]) {
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
          } else if (V.style === "particles") {
            for (let i = 0; i < N; i++) {
              const a = ang(i) + tt * 0.15 * (i % 2 ? 1 : -1), e = tip(i) + Math.sin(tt * 2 + i) * 6 * dpr;
              const r2 = (1.5 + vals[i] * 4) * dpr;
              ctx.fillStyle = rgba2(pal[i % 3], 0.35 + vals[i] * 0.6);
              ctx.beginPath();
              ctx.arc(cx + Math.cos(a) * e, cy + Math.sin(a) * e, r2, 0, Math.PI * 2);
              ctx.fill();
            }
          } else if (V.style === "wave") {
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
            if (V.glow) {
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
            const passes = V.style === "bars" && V.glow ? [[9, 0.15], [3, 0.95]] : [[3, 0.95]];
            for (const [w, al] of passes) {
              ctx.lineWidth = w * dpr;
              groups.forEach((idx, gi) => {
                ctx.beginPath();
                for (const i of idx) {
                  const c = Math.cos(ang(i)), sn = Math.sin(ang(i)), e = tip(i);
                  if (V.style === "dots") {
                    ctx.moveTo(cx + c * e + 3 * dpr, cy + sn * e);
                    ctx.arc(cx + c * e, cy + sn * e, 3 * dpr, 0, Math.PI * 2);
                  } else {
                    ctx.moveTo(cx + c * R, cy + sn * R);
                    ctx.lineTo(cx + c * e, cy + sn * e);
                  }
                }
                if (V.style === "dots") {
                  ctx.fillStyle = rgba2(pal[gi], al);
                  ctx.fill();
                } else {
                  ctx.strokeStyle = rgba2(pal[gi], al);
                  ctx.stroke();
                }
              });
            }
          }
          rings = rings.filter((g) => g.a > 0.02);
          for (const g of rings) {
            g.r += 300 * dt * dpr;
            g.a *= Math.exp(-dt * 2.8);
            ctx.lineWidth = (g.w || 2) * dpr;
            ctx.strokeStyle = rgba2(pal[2], g.a);
            ctx.beginPath();
            ctx.arc(cx, cy, g.r, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.globalCompositeOperation = "source-over";
          const pulse = (1 + b * V.pulse).toFixed(3);
          if (pulse !== lastPulse) q.wrap.style.scale = lastPulse = pulse;
          if (px) {
            partyFx = true;
            const op = (px.flash * 0.42).toFixed(2);
            if (q.flash.style.opacity !== op) q.flash.style.opacity = op;
            if (px.flashCol !== lastFlashCol) {
              lastFlashCol = px.flashCol;
              const c = pal[px.flashCol];
              q.flash.style.background = `radial-gradient(70% 60% at 50% 45%, rgba(${c[0]},${c[1]},${c[2]},0.9), rgba(${c[0]},${c[1]},${c[2]},0) 72%)`;
            }
            const sh = px.shake > 0.3 ? `${((Math.random() * 2 - 1) * px.shake).toFixed(1)}px ${((Math.random() * 2 - 1) * px.shake * 0.6).toFixed(1)}px` : "";
            if (q.wrap.style.translate !== sh) q.wrap.style.translate = sh;
          }
        }
        let lastPulse = "", lastFlashCol = -1;
        function frame(now) {
          raf = requestAnimationFrame(frame);
          const pos = S.Player.getProgress?.() || 0;
          const dur = S.Player.getDuration?.() || 0;
          q.fill.style.transform = `scaleX(${dur ? clamp(pos / dur, 0, 1).toFixed(4) : 0})`;
          if (now - lastText > 250) {
            lastText = now;
            q.pos.textContent = fmt(pos);
            q.dur.textContent = fmt(dur);
            syncState();
          }
          const mode = el2.dataset.mode;
          if (LYR.has(mode)) drawLyrics(pos);
          if (VIZ.has(mode)) drawViz(pos, now);
          if (mode === "party" && now - lastJam > 3e3) {
            lastJam = now;
            showJam();
          }
          if (!VIZ.has(mode) && lastPulse) {
            q.wrap.style.scale = "";
            lastPulse = "";
          }
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
        const KEYS = [["Space", "k_play"], ["\u2190 \u2192", "k_seek"], ["\u2191 \u2193", "k_vol"], ["1 \u2013 5", "k_view"], ["L", "k_like"], ["S", "k_shuffle"], ["R", "k_repeat"], ["F", "k_full"], ["N / P", "k_next"], ["Q", "k_queue"], ["Esc", "k_close"], ["?", "keysTitle"]];
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
          q.side.querySelector("b").textContent = t({ queue: "c_queue", devices: "c_devices", timer: "c_timer", versions: "lyrPick" }[kind]);
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
          } else if (kind === "versions") {
            showVersions(body, item);
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
          if (LYR.has(el2.dataset.mode)) loadLyrics();
          if (el2.dataset.mode === "party") party.prepare(item).then(updateKicker);
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
            el2 && LYR.has(el2.dataset.mode) && loadLyrics();
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
        function haze(img, alpha, period2, dir, ox, oy, op) {
          if (!img || alpha <= 0) return;
          const D = Math.max(W2, H2) * 1.8;
          const k = 1.15 + 0.2 * tri(clock / period2);
          ctx.save();
          ctx.globalCompositeOperation = op;
          ctx.globalAlpha = alpha;
          ctx.translate(ox, oy);
          ctx.rotate(dir * (clock / period2) * TAU);
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
      init_controls();
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
          ws.onopen = () => {
            if (ws !== sock) return;
            sendTrack();
            watchVolume(true);
          };
          ws.onclose = () => {
            if (ws !== sock) return;
            ws = null;
            watchVolume(false);
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
              send({ type: "debug-start", hidden: document.hidden, version: VERSION, vol: {
                api: typeof S.Player.getVolume?.(),
                pb: typeof S.Platform?.PlaybackAPI?._volume,
                read: readVolume()
              } });
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
          watchVolume(false);
          try {
            ws?.close();
          } catch {
          }
          ws = null;
        }
        let volTimer = 0, lastVol = null;
        const num = (v) => typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : null;
        function readVolume() {
          let v = num(S.Player.getVolume?.());
          if (v === null) v = num(S.Platform?.PlaybackAPI?._volume);
          if (v === null) {
            const bar = document.querySelector('[data-testid="volume-bar"] [style*="--progress-bar-transform"]');
            const m = bar && /(-?[\d.]+)%/.exec(bar.style.getPropertyValue("--progress-bar-transform"));
            if (m) v = num(Number(m[1]) / 100);
          }
          return v;
        }
        function watchVolume(on) {
          clearInterval(volTimer);
          lastVol = null;
          if (!on) return;
          volTimer = setInterval(() => {
            const v = readVolume();
            if (v === null) return;
            const muted = !!S.Player.getMute?.() || v === 0;
            const key = Math.round(v * 100) + (muted ? "m" : "");
            if (lastVol !== null && key !== lastVol && !isFading()) send({ type: "volume", value: v, muted });
            lastVol = key;
          }, 250);
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

  // src/fonts.js
  function load(keys) {
    const fam = keys.map((k) => FONTS[k]?.[1]).filter((f) => f && !loaded.has(f));
    if (!fam.length) return;
    fam.forEach((f) => loaded.add(f));
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?" + fam.map((f) => `family=${f}:wght@400;500;600;700;800`).join("&") + "&display=swap";
    document.head.append(link);
  }
  function applyFont() {
    const k = FONTS[cfg.font] ? cfg.font : "outfit";
    load([k]);
    if (k === "outfit") root.style.removeProperty("--m-font");
    else root.style.setProperty("--m-font", stackOf(k));
  }
  var FONTS, STACK, loaded, stackOf, preloadFonts;
  var init_fonts = __esm({
    "src/fonts.js"() {
      init_core();
      init_config();
      FONTS = {
        outfit: ["Outfit", ""],
        jakarta: ["Plus Jakarta Sans", "Plus+Jakarta+Sans"],
        manrope: ["Manrope", "Manrope"],
        sora: ["Sora", "Sora"],
        lexend: ["Lexend", "Lexend"],
        nunito: ["Nunito", "Nunito"],
        system: ["", ""]
      };
      STACK = '"Segoe UI Variable Display", "Segoe UI", system-ui, -apple-system, sans-serif';
      loaded = /* @__PURE__ */ new Set();
      stackOf = (k) => FONTS[k]?.[0] ? `"${FONTS[k][0]}", ${STACK}` : STACK;
      preloadFonts = () => load(Object.keys(FONTS));
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
    applyFont();
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
    preloadFonts();
    const fontSeg = seg(Object.keys(FONTS).map((k) => [k, t("font_" + k)]), FONTS[cfg.font] ? cfg.font : "outfit", (k) => {
      cfg.font = k;
      save();
      applyFont();
    });
    Object.keys(FONTS).forEach((k, i) => fontSeg.children[i].style.fontFamily = stackOf(k));
    kids.push(group(t("g_colours"), false, toggle("dynamic", refreshColors), toggle("freeze", refreshColors), head(t("font"), t("fontHint")), fontSeg));
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
        toggle("onlineLyrics", () => immersive.reloadLyrics()),
        toggle("karaoke", () => immersive.reloadLyrics()),
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
        }),
        // Party-Modus: Profil automatisch (Genre/Tempo) oder fest, Stärke, weiche Farbblitze
        head(t("partySection"), t("partySectionHint")),
        seg([["auto", t("party_auto")], ...PROFILE_KEYS.map((k) => [k, t("party_" + k)])], cfg.partyStyle, (k) => {
          cfg.partyStyle = k;
          save();
          immersive.refresh();
        }),
        el("small", "m-note", t("partyLevel")),
        seg([[1, t("partyLevel1")], [2, t("partyLevel2")], [3, t("partyLevel3")]], cfg.partyLevel, (k) => {
          cfg.partyLevel = k;
          save();
        }),
        toggle("partyFlash", () => {
        }),
        toggle("partyJam", () => {
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
    const os = String(S.Platform?.operatingSystem || navigator.platform || "").toLowerCase();
    const file = /win/.test(os) ? "Mirage-Overlay-Setup.exe" : /mac|osx|darwin/.test(os) ? "Mirage-Overlay.dmg" : "Mirage-Overlay.AppImage";
    const ovState = el("small", "m-note", t(bridge.connected() ? "overlayConnected" : "overlayMissing"));
    const ovRow = el("div", "m-actions");
    ovRow.append(
      button(t("overlayDownload"), () => window.open(`https://github.com/Passimoritz/spicetify-mirage/releases/latest/download/${file}`, "_blank"), "is-primary"),
      button(t("overlayAllDownloads"), () => window.open("https://github.com/Passimoritz/spicetify-mirage/releases/latest", "_blank"))
    );
    kids.push(group(t("g_overlay"), false, toggle("overlay"), ovState, ovRow));
    const foot = el("div", "m-actions");
    const dataIn = el("input", "m-text");
    dataIn.placeholder = t("settingsCodeHint");
    foot.append(
      button(t("shareNow"), () => nowPlayingCard()),
      button(t("shareWeek"), () => weekCard()),
      button(t("shareMonth"), () => monthCard()),
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
      init_fonts();
      init_party();
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
          if (/^Digit[1-5]$/.test(e.code)) immersive.setMode(MODES[+e.code.slice(5) - 1][0], true);
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
          const b = new S.Topbar.Button(t("immersive"), ICON.orb, () => immersive.toggle());
          b.element?.classList.add("m-orb-btn");
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
