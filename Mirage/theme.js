// Mirage – the living layer behind the glass.
// Pulls colours from the album art, puts a cover haze + aurora + light dust behind the UI,
// pulses on the beat, adds the immersive mode (cover · lyrics · visualizer) and reports
// song changes to the Mirage Overlay app (announcements outside of Spotify).
(function mirage() {
  const S = window.Spicetify;
  if (!S?.Player?.addEventListener || !S?.Platform || !S?.CosmosAsync || !document.body) {
    setTimeout(mirage, 300);
    return;
  }
  if (window.__mirage) return;
  window.__mirage = true;

  const root = document.documentElement;

  /* ---------------------------------------------------------------- Sprachen */
  // Fehlt eine Übersetzung, gilt Englisch – so funktioniert das Theme in jeder Sprache.
  const I18N = {
    en: {
      menu: "Mirage settings", immersive: "Mirage immersive mode", back: "Back", dialog: "Mirage immersive mode",
      tabCover: "Cover", tabLyrics: "Lyrics", tabViz: "Visualizer",
      now: "Now playing", lyrics: "Lyrics", vizBeat: "Visualizer · on the beat", vizAmbient: "Visualizer · ambient",
      loading: "Loading lyrics …", noLyrics: "Spotify has no lyrics for this song.", nothing: "Nothing playing",
      seek: "Position in song", prev: "Previous", play: "Play/Pause", next: "Next",
      dynamic: "Colours from the cover", dynamicHint: "The whole interface takes on the song's colours",
      particles: "Light dust", particlesHint: "Floating specks of light in the background",
      beat: "Background on the beat", beatHint: "Pulses with the beats when Spotify provides beat data",
      cascade: "Page animations", cascadeHint: "Content glides in when you switch pages",
      vinyl: "Vinyl cover", vinylHint: "The cover at the bottom becomes a spinning record",
      tilt: "3D cards", tiltHint: "Cards tilt towards the mouse pointer",
      burst: "Heart burst", burstHint: "A shower of sparks when you like a song",
      overlay: "Mirage Overlay", overlayHint: "Send song changes to the overlay app outside of Spotify",
      grain: "Film grain", grainHint: "Fine noise over the background",
      calm: "Calm mode", calmHint: "Stops all background animations",
      blur: "Glass blur (real glass only)", bright: "Background brightness",
      glass: "Real glass", glassHint: "Blurs live behind every panel – looks richer, costs a lot of performance",
      c_shuffle: "Shuffle (S)", c_repeat: "Repeat (R)", c_like: "Like (L)", c_mute: "Mute", c_full: "Full screen (F)", c_volume: "Volume (↑ ↓)",
      tip: "Immersive mode: Ctrl + Shift + M or the circle button at the top. Inside: 1 · 2 · 3 view, Space play, ← → seek, ↑ ↓ volume, L like, S shuffle, R repeat, F full screen.",
    },
    de: {
      menu: "Mirage-Einstellungen", immersive: "Mirage Immersiv-Modus", back: "Zurück", dialog: "Mirage Immersiv-Modus",
      tabCover: "Cover", tabLyrics: "Liedtext", tabViz: "Visualizer",
      now: "Läuft gerade", lyrics: "Liedtext", vizBeat: "Visualizer · im Takt", vizAmbient: "Visualizer · Ambient",
      loading: "Liedtext wird geladen …", noLyrics: "Für diesen Song hat Spotify keinen Liedtext.", nothing: "Nichts läuft",
      seek: "Position im Song", prev: "Zurück", play: "Wiedergabe/Pause", next: "Weiter",
      dynamic: "Farben aus dem Cover", dynamicHint: "Die ganze Oberfläche nimmt die Farben des Songs an",
      particles: "Lichtstaub", particlesHint: "Schwebende Lichtpunkte im Hintergrund",
      beat: "Hintergrund im Takt", beatHint: "Pulsiert mit den Beats, wenn Spotify Taktdaten liefert",
      cascade: "Seiten-Animationen", cascadeHint: "Inhalte gleiten beim Seitenwechsel herein",
      vinyl: "Vinyl-Cover", vinylHint: "Das Cover unten wird zur Platte und dreht sich",
      tilt: "3D-Karten", tiltHint: "Karten neigen sich zum Mauszeiger",
      burst: "Herz-Explosion", burstHint: "Funkenregen, wenn du einen Song likest",
      overlay: "Mirage Overlay", overlayHint: "Songwechsel an die Overlay-App außerhalb von Spotify senden",
      grain: "Filmkorn", grainHint: "Feines Rauschen über dem Hintergrund",
      calm: "Ruhiger Modus", calmHint: "Hält alle Hintergrund-Animationen an",
      blur: "Glas-Unschärfe (nur echtes Glas)", bright: "Helligkeit des Hintergrunds",
      glass: "Echtes Glas", glassHint: "Verwischt live hinter jeder Fläche – edler, kostet aber viel Leistung",
      c_shuffle: "Zufallswiedergabe (S)", c_repeat: "Wiederholen (R)", c_like: "Liken (L)", c_mute: "Stumm", c_full: "Vollbild (F)", c_volume: "Lautstärke (↑ ↓)",
      tip: "Immersiv-Modus: Strg + Umschalt + M oder der Kreis-Knopf oben. Darin: 1 · 2 · 3 Ansicht, Leertaste Wiedergabe, ← → spulen, ↑ ↓ Lautstärke, L liken, S Zufall, R Wiederholen, F Vollbild.",
    },
    fr: {
      menu: "Réglages Mirage", immersive: "Mode immersif Mirage", back: "Retour", dialog: "Mode immersif Mirage",
      tabCover: "Pochette", tabLyrics: "Paroles", tabViz: "Visualiseur",
      now: "En cours de lecture", lyrics: "Paroles", vizBeat: "Visualiseur · en rythme", vizAmbient: "Visualiseur · ambiance",
      loading: "Chargement des paroles …", noLyrics: "Spotify n'a pas de paroles pour ce titre.", nothing: "Aucune lecture",
      seek: "Position dans le titre", prev: "Précédent", play: "Lecture/Pause", next: "Suivant",
      dynamic: "Couleurs de la pochette", dynamicHint: "Toute l'interface prend les couleurs du titre",
      particles: "Poussière de lumière", particlesHint: "Points lumineux flottants en arrière-plan",
      beat: "Fond en rythme", beatHint: "Pulse sur les temps quand Spotify fournit les données",
      cascade: "Animations de page", cascadeHint: "Le contenu glisse à chaque changement de page",
      vinyl: "Pochette vinyle", vinylHint: "La pochette devient un disque qui tourne",
      tilt: "Cartes 3D", tiltHint: "Les cartes s'inclinent vers le pointeur",
      burst: "Explosion de cœurs", burstHint: "Une pluie d'étincelles quand tu aimes un titre",
      overlay: "Mirage Overlay", overlayHint: "Envoyer les changements de titre à l'app overlay",
      grain: "Grain de film", grainHint: "Léger bruit sur l'arrière-plan",
      calm: "Mode calme", calmHint: "Arrête toutes les animations d'arrière-plan",
      blur: "Flou du verre", bright: "Luminosité du fond",
      tip: "Mode immersif : Ctrl + Maj + M ou le bouton rond en haut. À l'intérieur, 1 · 2 · 3 changent la vue.",
    },
    es: {
      menu: "Ajustes de Mirage", immersive: "Modo inmersivo Mirage", back: "Volver", dialog: "Modo inmersivo Mirage",
      tabCover: "Portada", tabLyrics: "Letra", tabViz: "Visualizador",
      now: "Sonando ahora", lyrics: "Letra", vizBeat: "Visualizador · al ritmo", vizAmbient: "Visualizador · ambiente",
      loading: "Cargando letra …", noLyrics: "Spotify no tiene letra para esta canción.", nothing: "No suena nada",
      seek: "Posición en la canción", prev: "Anterior", play: "Reproducir/Pausa", next: "Siguiente",
      dynamic: "Colores de la portada", dynamicHint: "Toda la interfaz adopta los colores de la canción",
      particles: "Polvo de luz", particlesHint: "Puntos de luz flotando en el fondo",
      beat: "Fondo al ritmo", beatHint: "Late con los beats cuando Spotify da los datos",
      cascade: "Animaciones de página", cascadeHint: "El contenido entra deslizándose al cambiar de página",
      vinyl: "Portada de vinilo", vinylHint: "La portada se convierte en un disco que gira",
      tilt: "Tarjetas 3D", tiltHint: "Las tarjetas se inclinan hacia el puntero",
      burst: "Explosión de corazones", burstHint: "Lluvia de chispas al dar me gusta",
      overlay: "Mirage Overlay", overlayHint: "Enviar cambios de canción a la app overlay",
      grain: "Grano de película", grainHint: "Ruido fino sobre el fondo",
      calm: "Modo tranquilo", calmHint: "Detiene todas las animaciones del fondo",
      blur: "Desenfoque del cristal", bright: "Brillo del fondo",
      tip: "Modo inmersivo: Ctrl + Mayús + M o el botón redondo de arriba. Dentro, 1 · 2 · 3 cambian la vista.",
    },
    it: {
      menu: "Impostazioni Mirage", immersive: "Modalità immersiva Mirage", back: "Indietro", dialog: "Modalità immersiva Mirage",
      tabCover: "Copertina", tabLyrics: "Testo", tabViz: "Visualizzatore",
      now: "In riproduzione", lyrics: "Testo", vizBeat: "Visualizzatore · a tempo", vizAmbient: "Visualizzatore · ambient",
      loading: "Caricamento testo …", noLyrics: "Spotify non ha il testo di questo brano.", nothing: "Niente in riproduzione",
      seek: "Posizione nel brano", prev: "Precedente", play: "Riproduci/Pausa", next: "Successivo",
      dynamic: "Colori dalla copertina", dynamicHint: "Tutta l'interfaccia prende i colori del brano",
      particles: "Polvere di luce", particlesHint: "Punti luminosi fluttuanti sullo sfondo",
      beat: "Sfondo a tempo", beatHint: "Pulsa sui battiti quando Spotify fornisce i dati",
      cascade: "Animazioni di pagina", cascadeHint: "I contenuti scivolano dentro al cambio pagina",
      vinyl: "Copertina vinile", vinylHint: "La copertina diventa un disco che gira",
      tilt: "Schede 3D", tiltHint: "Le schede si inclinano verso il puntatore",
      burst: "Esplosione di cuori", burstHint: "Pioggia di scintille quando metti mi piace",
      overlay: "Mirage Overlay", overlayHint: "Invia i cambi di brano all'app overlay",
      grain: "Grana", grainHint: "Leggero rumore sullo sfondo",
      calm: "Modalità calma", calmHint: "Ferma tutte le animazioni dello sfondo",
      blur: "Sfocatura vetro", bright: "Luminosità dello sfondo",
      tip: "Modalità immersiva: Ctrl + Maiusc + M o il pulsante rotondo in alto. All'interno 1 · 2 · 3 cambiano vista.",
    },
    pt: {
      menu: "Configurações do Mirage", immersive: "Modo imersivo Mirage", back: "Voltar", dialog: "Modo imersivo Mirage",
      tabCover: "Capa", tabLyrics: "Letra", tabViz: "Visualizador",
      now: "Tocando agora", lyrics: "Letra", vizBeat: "Visualizador · no ritmo", vizAmbient: "Visualizador · ambiente",
      loading: "Carregando letra …", noLyrics: "O Spotify não tem letra para esta música.", nothing: "Nada tocando",
      seek: "Posição na música", prev: "Anterior", play: "Tocar/Pausar", next: "Próxima",
      dynamic: "Cores da capa", dynamicHint: "Toda a interface assume as cores da música",
      particles: "Poeira de luz", particlesHint: "Pontos de luz flutuando no fundo",
      beat: "Fundo no ritmo", beatHint: "Pulsa com as batidas quando o Spotify fornece os dados",
      cascade: "Animações de página", cascadeHint: "O conteúdo desliza ao trocar de página",
      vinyl: "Capa de vinil", vinylHint: "A capa vira um disco girando",
      tilt: "Cartões 3D", tiltHint: "Os cartões se inclinam para o ponteiro",
      burst: "Explosão de corações", burstHint: "Chuva de faíscas ao curtir uma música",
      overlay: "Mirage Overlay", overlayHint: "Enviar trocas de música ao app overlay",
      grain: "Granulação", grainHint: "Ruído fino sobre o fundo",
      calm: "Modo calmo", calmHint: "Para todas as animações do fundo",
      blur: "Desfoque do vidro", bright: "Brilho do fundo",
      tip: "Modo imersivo: Ctrl + Shift + M ou o botão redondo no topo. Dentro, 1 · 2 · 3 trocam a visão.",
    },
    nl: {
      menu: "Mirage-instellingen", immersive: "Mirage meeslepende modus", back: "Terug", dialog: "Mirage meeslepende modus",
      tabCover: "Hoes", tabLyrics: "Songtekst", tabViz: "Visualizer",
      now: "Nu aan het spelen", lyrics: "Songtekst", vizBeat: "Visualizer · op de beat", vizAmbient: "Visualizer · ambient",
      loading: "Songtekst laden …", noLyrics: "Spotify heeft geen songtekst voor dit nummer.", nothing: "Er speelt niets",
      seek: "Positie in nummer", prev: "Vorige", play: "Afspelen/Pauze", next: "Volgende",
      dynamic: "Kleuren uit de hoes", dynamicHint: "De hele interface neemt de kleuren van het nummer aan",
      particles: "Lichtstof", particlesHint: "Zwevende lichtpuntjes op de achtergrond",
      beat: "Achtergrond op de beat", beatHint: "Pulseert mee als Spotify beatdata levert",
      cascade: "Pagina-animaties", cascadeHint: "Inhoud glijdt binnen bij een paginawissel",
      vinyl: "Vinylhoes", vinylHint: "De hoes wordt een draaiende plaat",
      tilt: "3D-kaarten", tiltHint: "Kaarten kantelen naar de muisaanwijzer",
      burst: "Hartjesexplosie", burstHint: "Vonkenregen als je een nummer liket",
      overlay: "Mirage Overlay", overlayHint: "Nummerwissels naar de overlay-app sturen",
      grain: "Filmkorrel", grainHint: "Fijne ruis over de achtergrond",
      calm: "Rustige modus", calmHint: "Stopt alle achtergrondanimaties",
      blur: "Glasvervaging", bright: "Helderheid achtergrond",
      tip: "Meeslepende modus: Ctrl + Shift + M of de ronde knop bovenaan. Daarin wisselen 1 · 2 · 3 de weergave.",
    },
    pl: {
      menu: "Ustawienia Mirage", immersive: "Tryb immersyjny Mirage", back: "Wstecz", dialog: "Tryb immersyjny Mirage",
      tabCover: "Okładka", tabLyrics: "Tekst", tabViz: "Wizualizator",
      now: "Teraz odtwarzane", lyrics: "Tekst", vizBeat: "Wizualizator · w rytm", vizAmbient: "Wizualizator · ambient",
      loading: "Wczytywanie tekstu …", noLyrics: "Spotify nie ma tekstu tego utworu.", nothing: "Nic nie gra",
      seek: "Pozycja w utworze", prev: "Poprzedni", play: "Odtwórz/Pauza", next: "Następny",
      dynamic: "Kolory z okładki", dynamicHint: "Cały interfejs przyjmuje kolory utworu",
      particles: "Świetlny pył", particlesHint: "Unoszące się punkty światła w tle",
      beat: "Tło w rytm", beatHint: "Pulsuje z beatem, gdy Spotify podaje dane",
      cascade: "Animacje stron", cascadeHint: "Treść wsuwa się przy zmianie strony",
      vinyl: "Okładka winylowa", vinylHint: "Okładka staje się kręcącą się płytą",
      tilt: "Karty 3D", tiltHint: "Karty pochylają się w stronę kursora",
      burst: "Eksplozja serc", burstHint: "Deszcz iskier, gdy polubisz utwór",
      overlay: "Mirage Overlay", overlayHint: "Wysyłaj zmiany utworów do aplikacji overlay",
      grain: "Ziarno filmu", grainHint: "Delikatny szum na tle",
      calm: "Tryb spokojny", calmHint: "Zatrzymuje wszystkie animacje tła",
      blur: "Rozmycie szkła", bright: "Jasność tła",
      tip: "Tryb immersyjny: Ctrl + Shift + M lub okrągły przycisk u góry. W środku 1 · 2 · 3 zmieniają widok.",
    },
    tr: {
      menu: "Mirage ayarları", immersive: "Mirage sürükleyici mod", back: "Geri", dialog: "Mirage sürükleyici mod",
      tabCover: "Kapak", tabLyrics: "Şarkı sözü", tabViz: "Görselleştirici",
      now: "Şimdi çalıyor", lyrics: "Şarkı sözü", vizBeat: "Görselleştirici · ritimde", vizAmbient: "Görselleştirici · ambiyans",
      loading: "Şarkı sözleri yükleniyor …", noLyrics: "Spotify'da bu şarkının sözleri yok.", nothing: "Hiçbir şey çalmıyor",
      seek: "Şarkıdaki konum", prev: "Önceki", play: "Oynat/Duraklat", next: "Sonraki",
      dynamic: "Kapaktan renkler", particles: "Işık tozu", beat: "Ritimde arka plan", cascade: "Sayfa animasyonları",
      vinyl: "Plak kapağı", tilt: "3D kartlar", burst: "Kalp patlaması", grain: "Film greni", calm: "Sakin mod",
      blur: "Cam bulanıklığı", bright: "Arka plan parlaklığı",
    },
    ru: {
      menu: "Настройки Mirage", immersive: "Режим погружения Mirage", back: "Назад", dialog: "Режим погружения Mirage",
      tabCover: "Обложка", tabLyrics: "Текст", tabViz: "Визуализатор",
      now: "Сейчас играет", lyrics: "Текст", vizBeat: "Визуализатор · в такт", vizAmbient: "Визуализатор · эмбиент",
      loading: "Загрузка текста …", noLyrics: "У Spotify нет текста для этой песни.", nothing: "Ничего не играет",
      seek: "Позиция в треке", prev: "Назад", play: "Воспроизвести/Пауза", next: "Далее",
      dynamic: "Цвета из обложки", particles: "Световая пыль", beat: "Фон в такт", cascade: "Анимации страниц",
      vinyl: "Виниловая обложка", tilt: "3D-карточки", burst: "Взрыв сердец", grain: "Зерно плёнки", calm: "Спокойный режим",
      blur: "Размытие стекла", bright: "Яркость фона",
    },
    uk: {
      menu: "Налаштування Mirage", immersive: "Режим занурення Mirage", back: "Назад",
      tabCover: "Обкладинка", tabLyrics: "Текст", tabViz: "Візуалізатор",
      now: "Зараз грає", lyrics: "Текст", loading: "Завантаження тексту …", noLyrics: "Spotify не має тексту цієї пісні.",
      nothing: "Нічого не грає", calm: "Спокійний режим",
    },
    ja: {
      menu: "Mirage の設定", immersive: "Mirage イマーシブモード", back: "戻る", dialog: "Mirage イマーシブモード",
      tabCover: "ジャケット", tabLyrics: "歌詞", tabViz: "ビジュアライザー",
      now: "再生中", lyrics: "歌詞", vizBeat: "ビジュアライザー · ビート同期", vizAmbient: "ビジュアライザー · アンビエント",
      loading: "歌詞を読み込み中 …", noLyrics: "この曲の歌詞は Spotify にありません。", nothing: "再生していません",
      seek: "曲内の位置", prev: "前へ", play: "再生/一時停止", next: "次へ",
      dynamic: "ジャケットの色", particles: "光の粒", beat: "ビートに合わせた背景", cascade: "ページアニメーション",
      vinyl: "レコード風ジャケット", tilt: "3D カード", burst: "ハートバースト", grain: "フィルムグレイン", calm: "落ち着いたモード",
      blur: "ガラスのぼかし", bright: "背景の明るさ",
    },
    ko: {
      menu: "Mirage 설정", immersive: "Mirage 몰입 모드", back: "뒤로", dialog: "Mirage 몰입 모드",
      tabCover: "커버", tabLyrics: "가사", tabViz: "비주얼라이저",
      now: "지금 재생 중", lyrics: "가사", vizBeat: "비주얼라이저 · 비트 동기화", vizAmbient: "비주얼라이저 · 앰비언트",
      loading: "가사 불러오는 중 …", noLyrics: "Spotify에 이 곡의 가사가 없습니다.", nothing: "재생 중인 곡 없음",
      seek: "곡 내 위치", prev: "이전", play: "재생/일시정지", next: "다음",
      dynamic: "커버 색상", particles: "빛 먼지", beat: "비트에 맞춘 배경", cascade: "페이지 애니메이션",
      vinyl: "바이닐 커버", tilt: "3D 카드", burst: "하트 폭발", grain: "필름 그레인", calm: "차분한 모드",
      blur: "유리 흐림", bright: "배경 밝기",
    },
    zh: {
      menu: "Mirage 设置", immersive: "Mirage 沉浸模式", back: "返回", dialog: "Mirage 沉浸模式",
      tabCover: "封面", tabLyrics: "歌词", tabViz: "可视化",
      now: "正在播放", lyrics: "歌词", vizBeat: "可视化 · 跟随节拍", vizAmbient: "可视化 · 氛围",
      loading: "正在加载歌词 …", noLyrics: "Spotify 没有这首歌的歌词。", nothing: "未在播放",
      seek: "歌曲进度", prev: "上一首", play: "播放/暂停", next: "下一首",
      dynamic: "封面配色", particles: "光尘", beat: "随节拍的背景", cascade: "页面动画",
      vinyl: "黑胶封面", tilt: "3D 卡片", burst: "爱心爆炸", grain: "胶片颗粒", calm: "安静模式",
      blur: "玻璃模糊", bright: "背景亮度",
    },
  };
  const LANG = (() => {
    let l = "";
    try { l = S.Locale?.getLocale?.() || ""; } catch {}
    l = String(l || navigator.language || "en").toLowerCase();
    return I18N[l] ? l : I18N[l.split(/[-_]/)[0]] ? l.split(/[-_]/)[0] : "en";
  })();
  const t = (k) => I18N[LANG][k] ?? I18N.en[k] ?? k;

  /* ---------------------------------------------------------------- Einstellungen */
  const KEY = "mirage:settings";
  const schemeIsDynamic = !S.Config?.color_scheme || /mirage/i.test(S.Config.color_scheme);
  const DEFAULTS = {
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
    calm: false,
    blur: 28,
    bright: 100,
    imMode: "cover",
  };
  let cfg = { ...DEFAULTS };
  try {
    cfg = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch {}
  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(cfg));
    } catch {}
  };

  function applySettings() {
    root.classList.toggle("mirage-vinyl", cfg.vinyl);
    root.classList.toggle("mirage-no-tilt", !cfg.tilt);
    root.classList.toggle("mirage-no-grain", !cfg.grain);
    root.classList.toggle("mirage-calm", cfg.calm);
    root.classList.toggle("mirage-glass", cfg.glass);
    root.style.setProperty("--m-blur", cfg.blur + "px");
    root.style.setProperty("--m-bright", String(cfg.bright / 100));
    cfg.particles ? dust.start() : dust.stop();
    beat.sync();
    cfg.overlay ? bridge.connect() : bridge.close();
  }

  /* ---------------------------------------------------------------- Helfer */
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const hueGap = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
  // letzter Index mit arr[i][key] <= t (arr aufsteigend sortiert)
  function seek(arr, at, key) {
    let lo = 0, hi = arr.length - 1, r = -1;
    while (lo <= hi) {
      const m = (lo + hi) >> 1;
      if (arr[m][key] <= at) { r = m; lo = m + 1; } else hi = m - 1;
    }
    return r;
  }
  const fmt = (ms) => {
    const s = Math.max(0, Math.floor((ms || 0) / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };
  const imgCache = new Map();
  // Lädt und dekodiert ein Bild genau einmal; erst danach wird es angezeigt (kein Aufblitzen)
  function loadImage(url, cors) {
    const key = (cors ? "c:" : "") + url;
    if (!imgCache.has(key)) {
      imgCache.set(
        key,
        new Promise((resolve) => {
          const img = new Image();
          if (cors) img.crossOrigin = "anonymous";
          img.decoding = "async";
          img.onload = () => (img.decode ? img.decode().catch(() => {}) : Promise.resolve()).then(() => resolve(img));
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

  /* ---------------------------------------------------------------- Farbe */
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
  const hex2rgb = (h) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(h || "").trim());
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };

  // Drei Leitfarben: A (Akzent), B (tiefer Partner), C (helles Licht) – auf dunklem Glas gut lesbar.
  function shape(colors) {
    const [h1, s1] = rgb2hsl(colors[0]);
    const gray = s1 < 0.12;
    const second = colors[1] ? rgb2hsl(colors[1]) : [(h1 + 40) % 360, s1, 0.5];
    const a = hsl2rgb([h1, gray ? s1 : clamp(s1, 0.5, 0.95), 0.68]);
    const b = hsl2rgb([second[0], gray ? second[1] : clamp(second[1], 0.45, 0.95), 0.52]);
    const c = hsl2rgb([(h1 + 12) % 360, gray ? s1 : clamp(s1 * 0.8, 0.35, 0.85), 0.84]);
    return [a, b, c];
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
    return shape([first.rgb, partner?.rgb]);
  }

  // Ein Durchgang: Farben + kleines Hintergrundbild (verkleinert = billig zu verwischen)
  async function analyse(url, uri) {
    const img = await loadImage(url, true);
    let colors = null, haze = null;
    if (img) {
      try {
        const c = document.createElement("canvas");
        c.width = c.height = 64;
        const x = c.getContext("2d", { willReadFrequently: true });
        x.drawImage(img, 0, 0, 64, 64);
        colors = quantize(x.getImageData(0, 0, 64, 64).data);
        haze = c.toDataURL("image/jpeg", 0.85);
      } catch {}
    }
    if (!colors) {
      try {
        const ex = await S.colorExtractor(uri);
        const a = hex2rgb(ex.VIBRANT) || hex2rgb(ex.PROMINENT);
        const b = hex2rgb(ex.DARK_VIBRANT) || hex2rgb(ex.DESATURATED);
        if (a) colors = shape([a, b]);
      } catch {}
    }
    return { colors, haze };
  }

  const FALLBACK = [[182, 156, 255], [124, 92, 255], [230, 222, 255]];
  let current = null;
  const palette = () => current || FALLBACK;

  // Farben in EINEM Schritt über ein eigenes <style> setzen: eine einzige Stilberechnung
  // statt vieler Zwischenstufen – das war die Ursache für das Flackern beim Songwechsel.
  const varSheet = document.createElement("style");
  varSheet.id = "mirage-vars";
  document.head.append(varSheet);
  function setColors(next) {
    if (current && next.every((c, i) => c.every((v, j) => Math.abs(v - current[i][j]) < 3))) return;
    current = next;
    const [a, b, c] = next.map((x) => x.join(","));
    varSheet.textContent =
      `:root{--m-a:rgb(${a});--m-a-rgb:${a};--m-b:rgb(${b});--m-b-rgb:${b};--m-c:rgb(${c});--m-c-rgb:${c};` +
      `--spice-button:rgb(${a});--spice-rgb-button:${a};--spice-button-active:rgb(${c});--spice-rgb-button-active:${c}}`;
    dust.recolor(next);
    bridge.sendTrack();
  }
  function clearColors() {
    current = null;
    varSheet.textContent = "";
    dust.recolor(null);
  }

  /* ---------------------------------------------------------------- Bühne */
  const stage = document.createElement("div");
  stage.id = "mirage-stage";
  stage.innerHTML =
    '<div class="m-art"><i></i><i></i></div><div class="m-art"><i></i><i></i></div>' +
    '<div class="m-aurora"></div><div class="m-pulse"></div><canvas></canvas>' +
    '<div class="m-grain"></div><div class="m-vignette"></div>';
  document.body.prepend(stage);
  const arts = stage.querySelectorAll(".m-art");
  let artIdx = 0, lastHaze = "", fadeUntil = 0, hazeQueue = null;

  // Überblendung zwischen zwei Ebenen; kommt während einer Blende ein neues Bild,
  // wartet es, statt die gerade ausblendende Ebene umzuschalten (kein Springen).
  function showHaze(src) {
    if (!src || src === lastHaze) return;
    const wait = fadeUntil - performance.now();
    if (wait > 0) {
      hazeQueue = src;
      clearTimeout(showHaze.t);
      showHaze.t = setTimeout(() => { const q = hazeQueue; hazeQueue = null; showHaze(q); }, wait + 30);
      return;
    }
    lastHaze = src;
    artIdx ^= 1;
    const on = arts[artIdx], off = arts[artIdx ^ 1];
    on.style.setProperty("--img", `url("${src}")`);
    requestAnimationFrame(() => {
      on.classList.add("is-on");
      off.classList.remove("is-on");
    });
    fadeUntil = performance.now() + 2300;
    immersive.setHaze(src);
  }

  /* ---------------------------------------------------------------- Taktdaten */
  const audio = { uri: "", data: null };
  async function loadAudio(uri) {
    if (!uri || audio.uri === uri) return;
    audio.uri = uri;
    audio.data = null;
    if (!uri.startsWith("spotify:track:") || typeof S.getAudioData !== "function") return;
    try {
      const d = await Promise.race([S.getAudioData(uri), new Promise((_, rej) => setTimeout(rej, 8000))]);
      if (audio.uri === uri && d?.beats?.length) {
        audio.data = {
          beats: d.beats.map((b) => ({ t: b.start, c: b.confidence ?? 1 })),
          segs: (d.segments || []).map((s) => ({ t: s.start, l: s.loudness_max, p: s.pitches || [] })),
        };
      }
    } catch {}
    beat.sync();
  }

  // 0..1: wie stark gerade ein Schlag nachklingt
  const beat = (() => {
    let raf = 0, level = 0;
    function read(sec) {
      const bs = audio.data?.beats;
      if (!bs) return 0;
      const i = seek(bs, sec, "t");
      if (i < 0) return 0;
      const since = sec - bs[i].t;
      return Math.pow(clamp(1 - since / 0.32, 0, 1), 2) * clamp(0.4 + bs[i].c, 0, 1);
    }
    function loop() {
      raf = requestAnimationFrame(loop);
      if (document.hidden) return;
      const v = read((S.Player.getProgress?.() || 0) / 1000);
      if (Math.abs(v - level) > 0.02) {
        level = v;
        stage.style.setProperty("--beat", v.toFixed(3));
      }
    }
    function sync() {
      const on = cfg.beat && !cfg.calm && !!audio.data && root.classList.contains("mirage-playing");
      root.classList.toggle("mirage-beat", on);
      cancelAnimationFrame(raf);
      if (on) raf = requestAnimationFrame(loop);
      else {
        level = 0;
        stage.style.setProperty("--beat", "0");
      }
    }
    return { sync, read, get level() { return level; } };
  })();

  /* ---------------------------------------------------------------- Lichtstaub */
  const dust = (() => {
    const cv = stage.querySelector("canvas");
    const ctx = cv.getContext("2d");
    let w = 0, h = 0, raf = 0, running = false, lastT = 0;
    let sprites = [];
    const parts = [];
    const N = 70;

    function sprite(rgb) {
      const s = document.createElement("canvas");
      s.width = s.height = 64;
      const x = s.getContext("2d");
      const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, `rgba(${rgb.join(",")},0.9)`);
      g.addColorStop(0.25, `rgba(${rgb.join(",")},0.35)`);
      g.addColorStop(1, `rgba(${rgb.join(",")},0)`);
      x.fillStyle = g;
      x.fillRect(0, 0, 64, 64);
      return s;
    }
    function recolor(cols) {
      sprites = [...(cols || FALLBACK), [255, 255, 255]].map(sprite);
    }
    function resize() {
      w = cv.width = Math.round(innerWidth * 0.75);
      h = cv.height = Math.round(innerHeight * 0.75);
    }
    function spawn(p, anywhere) {
      p.x = Math.random() * w;
      p.y = anywhere ? Math.random() * h : h + 20;
      p.r = 2 + Math.random() * 10;
      p.vy = 0.15 + Math.random() * 0.5;
      p.vx = (Math.random() - 0.5) * 0.25;
      p.ph = Math.random() * Math.PI * 2;
      p.a = 0.25 + Math.random() * 0.6;
      p.k = Math.floor(Math.random() * 4);
    }
    function frame(now) {
      raf = requestAnimationFrame(frame);
      if (now - lastT < 33 || document.hidden || paused) return;
      const dt = Math.min(3, (now - lastT) / 16.7);
      lastT = now;
      const speed = (root.classList.contains("mirage-playing") ? 1 : 0.25) * (1 + beat.level * 2.5);
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      for (const p of parts) {
        p.ph += 0.01 * dt;
        p.y -= p.vy * speed * dt;
        p.x += (p.vx + Math.sin(p.ph) * 0.2) * speed * dt;
        if (p.y < -30) spawn(p, false);
        ctx.globalAlpha = p.a * (0.6 + Math.sin(p.ph * 3) * 0.4);
        const d = p.r * 4 * (1 + beat.level * 0.4);
        ctx.drawImage(sprites[p.k] || sprites[0], p.x - d / 2, p.y - d / 2, d, d);
      }
    }
    let paused = false;
    function pause(on) {
      paused = on;
      if (on) ctx.clearRect(0, 0, w, h);
    }
    function start() {
      if (running) return;
      running = true;
      cv.style.display = "";
      resize();
      if (!sprites.length) recolor(current);
      if (!parts.length) for (let i = 0; i < N; i++) { const p = {}; spawn(p, true); parts.push(p); }
      raf = requestAnimationFrame(frame);
    }
    function stop() {
      running = false;
      cancelAnimationFrame(raf);
      ctx.clearRect(0, 0, w, h);
      cv.style.display = "none";
    }
    addEventListener("resize", () => running && resize());
    return { start, stop, recolor, pause };
  })();

  /* ---------------------------------------------------------------- Brücke zur Overlay-App */
  // Die Mirage-Overlay-App lauscht lokal; ohne App versucht das Theme es still alle 5 s erneut.
  const bridge = (() => {
    const ADDR = "ws://127.0.0.1:47321";
    let ws = null, retry = 0, wanted = false;
    function connect() {
      wanted = true;
      if (ws && ws.readyState <= 1) return;
      try {
        ws = new WebSocket(ADDR);
      } catch {
        return schedule();
      }
      ws.onopen = () => sendTrack();
      ws.onclose = () => { ws = null; schedule(); };
      ws.onerror = () => {};
      ws.onmessage = (e) => {
        let m;
        try { m = JSON.parse(e.data); } catch { return; }
        if (m.type !== "cmd") return;
        if (m.cmd === "toggle") S.Player.togglePlay();
        else if (m.cmd === "next") S.Player.next();
        else if (m.cmd === "prev") S.Player.back();
        else if (m.cmd === "hello") sendTrack();
      };
    }
    function schedule() {
      clearTimeout(retry);
      if (wanted) retry = setTimeout(connect, 5000);
    }
    function close() {
      wanted = false;
      clearTimeout(retry);
      try { ws?.close(); } catch {}
      ws = null;
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
          lang: LANG,
        })
      );
    }
    return { connect, close, sendTrack };
  })();

  /* ---------------------------------------------------------------- Karten: Licht + Neigung */
  let hoverCard = null, pending = null, queued = false;
  document.addEventListener(
    "pointermove",
    (e) => {
      pending = e;
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        const ev = pending;
        const card = ev.target.closest?.(".main-card-card, [data-encore-id='card']");
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

  /* ---------------------------------------------------------------- Seitenwechsel-Kaskade */
  let enterTimer = 0;
  function pageEnter() {
    if (!cfg.cascade || cfg.calm) return;
    const mv = document.querySelector(".Root__main-view");
    if (!mv) return;
    mv.classList.remove("m-enter");
    setTimeout(() => {
      mv.querySelectorAll(".main-gridContainer-gridContainer, [data-testid='grid-container']").forEach((g) =>
        [...g.children].slice(0, 24).forEach((c, i) => c.style.setProperty("--m-i", i))
      );
      [...mv.querySelectorAll("[role='grid'] [role='row']")].slice(0, 26).forEach((r, i) => r.style.setProperty("--m-i", i));
      void mv.offsetWidth;
      mv.classList.add("m-enter");
      clearTimeout(enterTimer);
      enterTimer = setTimeout(() => mv.classList.remove("m-enter"), 1800);
    }, 70);
  }
  try {
    S.Platform.History.listen(pageEnter);
  } catch {}

  /* ---------------------------------------------------------------- Herz-Explosion */
  function burst(x, y) {
    const box = document.createElement("div");
    box.className = "m-burst";
    box.style.left = x + "px";
    box.style.top = y + "px";
    box.append(document.createElement("b"));
    const cols = palette().map((c) => `rgb(${c.join(",")})`);
    for (let i = 0; i < 16; i++) {
      const s = document.createElement("i");
      const ang = (i / 16) * Math.PI * 2 + Math.random() * 0.3;
      const dist = 36 + Math.random() * 54;
      if (i % 3 === 0) {
        s.className = "h";
        s.textContent = "♥";
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
  // Nur sprachunabhängige Merkmale (data-testid), damit es in jeder Spotify-Sprache greift
  document.addEventListener(
    "click",
    (e) => {
      if (!cfg.burst || cfg.calm) return;
      const b = e.target.closest?.('[data-testid="add-button"], [data-testid="like-button"], [data-testid="heart-button"]');
      if (!b) return;
      const { clientX: x, clientY: y } = e;
      setTimeout(() => b.getAttribute("aria-checked") !== "false" && burst(x, y), 220);
    },
    true
  );

  /* ---------------------------------------------------------------- Liedtext */
  const lyricCache = new Map();
  async function getLyrics(uri) {
    if (!uri?.startsWith("spotify:track:")) return null;
    if (lyricCache.has(uri)) return lyricCache.get(uri);
    const id = uri.split(":")[2];
    const url = `https://spclient.wg.spotify.com/color-lyrics/v2/track/${id}?format=json&vocalRemoval=false&market=from_token`;
    let body = null;
    try {
      body = await S.CosmosAsync.get(url, null, { "app-platform": "WebPlayer" });
    } catch {
      try { body = await S.CosmosAsync.get(url); } catch {}
    }
    const L = body?.lyrics;
    const out = L?.lines?.length
      ? {
          synced: L.syncType === "LINE_SYNCED",
          lines: L.lines.map((l) => ({ t: Number(l.startTimeMs) || 0, text: (l.words || "").trim() || "♪" })),
        }
      : null;
    lyricCache.set(uri, out);
    return out;
  }

  /* ---------------------------------------------------------------- Immersiv-Modus */
  const ICON = {
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
    heartOn: '<svg viewBox="0 0 24 24"><path d="M12 21 10.6 19.7C5.4 15 2 12 2 8.3 2 5.3 4.3 3 7.3 3c1.7 0 3.3.8 4.7 2 1.4-1.2 3-2 4.7-2C19.7 3 22 5.3 22 8.3c0 3.7-3.4 6.7-8.6 11.4z"/></svg>',
    vol: '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"/></svg>',
    mute: '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9zm13.6 3 2.7-2.7-1.4-1.4-2.7 2.7-2.7-2.7-1.4 1.4 2.7 2.7-2.7 2.7 1.4 1.4 2.7-2.7 2.7 2.7 1.4-1.4z"/></svg>',
    full: '<svg viewBox="0 0 24 24"><path d="M5 5h5V3H3v7h2zm9-2v2h5v5h2V3zm5 16h-5v2h7v-7h-2zM5 14H3v7h7v-2H5z"/></svg>',
    fullOff: '<svg viewBox="0 0 24 24"><path d="M8 3v5H3v2h7V3zm8 0h-2v7h7V8h-5zM3 16h5v5h2v-7H3zm11 5h2v-5h5v-2h-7z"/></svg>',
  };
  const MODES = [
    ["cover", "tabCover"],
    ["lyrics", "tabLyrics"],
    ["viz", "tabViz"],
  ];

  const immersive = (() => {
    let el = null, raf = 0, lastText = 0, coverToken = 0;
    let q = {};
    let lyr = null, lyrUri = "", active = -2;
    const vals = new Float32Array(120);
    let rings = [], lastBeatIdx = -1, vctx = null, vw = 0, vh = 0;

    function build() {
      el = document.createElement("div");
      el.id = "mirage-immersive";
      el.setAttribute("role", "dialog");
      el.setAttribute("aria-label", t("dialog"));
      el.innerHTML = `
        <div class="m-im-bg" aria-hidden="true"><i></i></div>
        <canvas class="m-im-viz"></canvas>
        <div class="m-im-top">
          <button class="m-im-close" type="button">${ICON.back}<span class="m-l"></span><kbd>ESC</kbd></button>
          <div class="m-im-tabs" role="tablist"><span class="m-im-ind"></span>
            ${MODES.map(([k], i) => `<button type="button" role="tab" data-mode="${k}" title="${i + 1}"></button>`).join("")}
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
            <button type="button" class="m-im-sm m-im-full">${ICON.full}</button>
          </div>
        </div>
        <div class="m-im-lyrics"><div class="m-im-lyrics-inner"></div></div>`;
      document.body.append(el);
      el.querySelector(".m-im-close .m-l").textContent = t("back");
      el.querySelectorAll(".m-im-tabs button").forEach((b, i) => (b.textContent = t(MODES[i][1])));
      el.querySelector(".m-im-bar").setAttribute("aria-label", t("seek"));
      el.querySelector(".m-im-prev").setAttribute("aria-label", t("prev"));
      el.querySelector(".m-im-play").setAttribute("aria-label", t("play"));
      el.querySelector(".m-im-next").setAttribute("aria-label", t("next"));
      for (const k of ["shuffle", "repeat", "like", "mute", "full"]) {
        el.querySelector(".m-im-" + k).setAttribute("aria-label", t("c_" + k));
        el.querySelector(".m-im-" + k).title = t("c_" + k);
      }
      el.querySelector(".m-im-volume").setAttribute("aria-label", t("c_volume"));
      q = {
        cover: el.querySelector(".m-im-cover"),
        imgs: el.querySelectorAll(".m-im-cover img"),
        wrap: el.querySelector(".m-im-cover-wrap"),
        kicker: el.querySelector(".m-im-kicker"),
        title: el.querySelector(".m-im-title"),
        artist: el.querySelector(".m-im-artist"),
        fill: el.querySelector(".m-im-fill"),
        pos: el.querySelector(".m-im-pos"),
        dur: el.querySelector(".m-im-dur"),
        play: el.querySelector(".m-im-play"),
        lyrics: el.querySelector(".m-im-lyrics"),
        inner: el.querySelector(".m-im-lyrics-inner"),
        ind: el.querySelector(".m-im-ind"),
        canvas: el.querySelector(".m-im-viz"),
        bg: el.querySelector(".m-im-bg"),
        shuffle: el.querySelector(".m-im-shuffle"),
        repeat: el.querySelector(".m-im-repeat"),
        like: el.querySelector(".m-im-like"),
        mute: el.querySelector(".m-im-mute"),
        volume: el.querySelector(".m-im-volume"),
        full: el.querySelector(".m-im-full"),
      };
      vctx = q.canvas.getContext("2d");
      el.querySelector(".m-im-close").onclick = close;
      q.shuffle.onclick = () => { S.Player.toggleShuffle(); setTimeout(syncState, 120); };
      q.repeat.onclick = () => { S.Player.toggleRepeat(); setTimeout(syncState, 120); };
      q.like.onclick = (e) => {
        const was = !!S.Player.getHeart?.();
        S.Player.toggleHeart();
        if (!was && cfg.burst && !cfg.calm) burst(e.clientX, e.clientY);
        setTimeout(syncState, 200);
      };
      q.mute.onclick = () => { S.Player.toggleMute(); setTimeout(syncState, 120); };
      q.volume.oninput = () => S.Player.setVolume(Number(q.volume.value) / 100);
      q.full.onclick = toggleFull;
      el.querySelector(".m-im-prev").onclick = () => S.Player.back();
      el.querySelector(".m-im-next").onclick = () => S.Player.next();
      q.play.onclick = () => S.Player.togglePlay();
      el.querySelectorAll(".m-im-tabs button").forEach((b) => (b.onclick = () => setMode(b.dataset.mode, true)));
      el.querySelector(".m-im-bar").onclick = (e) => {
        const r = e.currentTarget.getBoundingClientRect();
        S.Player.seek(clamp((e.clientX - r.left) / r.width, 0, 1));
      };
      q.inner.addEventListener("click", (e) => {
        const line = e.target.closest(".m-im-line");
        if (line && lyr?.synced) S.Player.seek(Number(line.dataset.t) + 1);
      });
      el.addEventListener("pointermove", (e) => {
        if (cfg.calm) return;
        const x = e.clientX / innerWidth - 0.5, y = e.clientY / innerHeight - 0.5;
        q.cover.style.setProperty("--iry", (x * 18).toFixed(2) + "deg");
        q.cover.style.setProperty("--irx", (-y * 14).toFixed(2) + "deg");
        q.cover.style.setProperty("--gx", (50 + x * 80).toFixed(1) + "%");
        q.cover.style.setProperty("--gy", (50 + y * 80).toFixed(1) + "%");
      });
      addEventListener("resize", sizeCanvas);
    }

    // Erst das kleine (meist schon geladene) Cover zeigen, dann scharf überblenden
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

    // Schalterzustände aus Spotify lesen (Zufall, Wiederholen, Like, Lautstärke)
    function syncState() {
      if (!el) return;
      const P = S.Player;
      q.shuffle.classList.toggle("is-on", !!P.getShuffle?.());
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
      else document.documentElement.requestFullscreen?.().catch(() => {});
      setTimeout(syncState, 300);
    }
    // Ruhender Hintergrund aus dem Cover – ersetzt das teure Live-Verwischen der ganzen Seite
    function setHaze(src) {
      if (el && src) q.bg.style.setProperty("--img", `url("${src}")`);
    }

    function sizeCanvas() {
      if (!q.canvas) return;
      const dpr = Math.min(devicePixelRatio || 1, 1.5);
      vw = q.canvas.width = Math.round(innerWidth * dpr);
      vh = q.canvas.height = Math.round(innerHeight * dpr);
    }

    function placeIndicator() {
      const b = el.querySelector(`.m-im-tabs button[data-mode="${cfg.imMode}"]`);
      if (!b) return;
      q.ind.style.width = b.offsetWidth + "px";
      q.ind.style.transform = `translateX(${b.offsetLeft}px)`;
    }

    function setMode(mode, animate) {
      if (!MODES.some(([k]) => k === mode)) mode = "cover";
      const apply = () => {
        cfg.imMode = mode;
        save();
        el.dataset.mode = mode;
        el.querySelectorAll(".m-im-tabs button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.mode === mode)));
        placeIndicator();
        updateKicker();
        if (mode === "lyrics") loadLyrics();
        active = -2;
      };
      if (animate && document.startViewTransition && !cfg.calm && isOpen()) document.startViewTransition(apply);
      else apply();
    }

    function updateKicker() {
      if (!el) return;
      const m = el.dataset.mode;
      q.kicker.textContent = m === "viz" ? t(audio.data ? "vizBeat" : "vizAmbient") : m === "lyrics" ? t("lyrics") : t("now");
    }

    async function loadLyrics() {
      const uri = currentItem()?.uri || "";
      if (uri === lyrUri && lyr !== undefined) return;
      lyrUri = uri;
      lyr = undefined;
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
      for (const l of got.lines) {
        const d = document.createElement("div");
        d.className = "m-im-line";
        d.dataset.t = l.t;
        d.textContent = l.text;
        frag.append(d);
      }
      q.inner.append(frag);
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
      const ctx = vctx;
      ctx.clearRect(0, 0, vw, vh);
      const dpr = vw / innerWidth;
      const r = q.wrap.getBoundingClientRect();
      const cx = (r.left + r.width / 2) * dpr, cy = (r.top + r.height / 2) * dpr;
      const R = (r.width / 2) * dpr + 16 * dpr;
      const N = vals.length, half = N / 2;
      const sec = pos / 1000;
      const playing = S.Player.isPlaying();
      let b = 0;

      let pitches = null, loud = 0.5;
      if (audio.data) {
        const si = seek(audio.data.segs, sec, "t");
        const sg = audio.data.segs[Math.max(si, 0)];
        if (sg) {
          pitches = sg.p;
          loud = clamp((sg.l + 38) / 38, 0, 1);
        }
        b = beat.read(sec);
        const bi = seek(audio.data.beats, sec, "t");
        if (bi !== lastBeatIdx && bi >= 0 && playing) {
          lastBeatIdx = bi;
          rings.push({ r: R, a: 0.7 * clamp(audio.data.beats[bi].c + 0.3, 0, 1) });
        }
      }
      const tt = now / 1000;
      for (let i = 0; i < N; i++) {
        const m = i < half ? i : N - 1 - i; // spiegeln: links = rechts
        let target;
        if (pitches?.length === 12) {
          const f = (m / half) * 11;
          const lo = Math.floor(f), hi = Math.min(11, lo + 1);
          const p = pitches[lo] + (pitches[hi] - pitches[lo]) * (f - lo);
          target = (0.12 + p * 0.88) * (0.35 + loud * 0.65) + b * 0.25;
        } else {
          // ohne Taktdaten: ruhiges, organisches Wogen
          target = 0.28 + 0.22 * Math.sin(m * 0.33 + tt * 2.1) * Math.sin(m * 0.09 - tt * 1.3) + 0.12 * Math.sin(tt * 3 + m * 0.7);
        }
        if (!playing) target *= 0.25;
        vals[i] += (target - vals[i]) * 0.22;
      }
      if (cfg.calm) return;

      const pal = palette();
      const maxLen = Math.min(vw, vh) * 0.11;
      ctx.globalCompositeOperation = "lighter";
      ctx.lineCap = "round";
      const glow = ctx.createRadialGradient(cx, cy, R * 0.8, cx, cy, R + maxLen * 1.2);
      glow.addColorStop(0, `rgba(${pal[0].join(",")},${0.18 + b * 0.25})`);
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, vw, vh);

      for (let pass = 0; pass < 2; pass++) {
        ctx.lineWidth = (pass ? 3 : 9) * dpr;
        for (let i = 0; i < N; i++) {
          const ang = (i / N) * Math.PI * 2 - Math.PI / 2;
          const len = 4 * dpr + vals[i] * maxLen;
          const c = pal[i % 3 === 0 ? 2 : i % 2 ? 0 : 1];
          ctx.strokeStyle = `rgba(${c.join(",")},${pass ? 0.95 : 0.16})`;
          const cos = Math.cos(ang), sin = Math.sin(ang);
          ctx.beginPath();
          ctx.moveTo(cx + cos * R, cy + sin * R);
          ctx.lineTo(cx + cos * (R + len), cy + sin * (R + len));
          ctx.stroke();
        }
      }
      ctx.lineWidth = 2 * dpr;
      rings = rings.filter((g) => g.a > 0.02);
      for (const g of rings) {
        g.r += 5 * dpr;
        g.a *= 0.955;
        ctx.strokeStyle = `rgba(${pal[2].join(",")},${g.a})`;
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
      q.fill.style.width = (dur ? (pos / dur) * 100 : 0) + "%";
      if (now - lastText > 250) {
        lastText = now;
        q.pos.textContent = fmt(pos);
        q.dur.textContent = fmt(dur);
        syncState();
      }
      const mode = el.dataset.mode;
      if (mode === "lyrics") drawLyrics(pos);
      if (mode === "viz") drawViz(pos, now);
      else if (q.wrap.style.getPropertyValue("--pulse")) q.wrap.style.removeProperty("--pulse");
    }

    function refresh() {
      if (!el) return;
      const item = currentItem();
      setCover(item);
      q.title.textContent = titleOf(item) || t("nothing");
      q.artist.textContent = artistOf(item);
      q.play.innerHTML = S.Player.isPlaying() ? ICON.pause : ICON.play;
      lastBeatIdx = -1;
      rings = [];
      updateKicker();
      if (el.dataset.mode === "lyrics") loadLyrics();
    }

    function open() {
      if (!el) build();
      sizeCanvas();
      setMode(cfg.imMode, false);
      refresh();
      setHaze(lastHaze);
      syncState();
      el.classList.add("is-on");
      // Hintergrund dahinter ist verdeckt: anhalten spart sehr viel Leistung
      root.classList.add("mirage-im-open");
      dust.pause(true);
      requestAnimationFrame(placeIndicator);
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frame);
      q.play.focus();
    }
    function close() {
      if (!el) return;
      el.classList.remove("is-on");
      root.classList.remove("mirage-im-open");
      dust.pause(false);
      cancelAnimationFrame(raf);
      if (document.fullscreenElement) document.exitFullscreen?.();
    }
    const isOpen = () => !!el?.classList.contains("is-on");
    const playState = () => el && (q.play.innerHTML = S.Player.isPlaying() ? ICON.pause : ICON.play);
    const seekBy = (ms) => S.Player.seek(clamp((S.Player.getProgress?.() || 0) + ms, 0, S.Player.getDuration?.() || 0));
    const volBy = (d) => { S.Player.setVolume(clamp((S.Player.getVolume?.() ?? 1) + d, 0, 1)); setTimeout(syncState, 80); };
    return {
      open, close, toggle: () => (isOpen() ? close() : open()), isOpen, refresh, setMode, playState, updateKicker, setHaze,
      seekBy, volBy, toggleFull, like: () => q.like?.click(), shuffle: () => q.shuffle?.click(), repeat: () => q.repeat?.click(),
    };
  })();

  window.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.shiftKey && e.code === "KeyM") {
      e.preventDefault();
      immersive.toggle();
    } else if (immersive.isOpen()) {
      if (e.ctrlKey || e.altKey || e.metaKey || e.target.matches?.("input[type=text], textarea")) return;
      const keys = {
        Escape: () => (document.fullscreenElement ? document.exitFullscreen() : immersive.close()),
        Space: () => S.Player.togglePlay(),
        ArrowLeft: () => immersive.seekBy(-5000),
        ArrowRight: () => immersive.seekBy(5000),
        ArrowUp: () => immersive.volBy(0.05),
        ArrowDown: () => immersive.volBy(-0.05),
        KeyL: () => immersive.like(),
        KeyS: () => immersive.shuffle(),
        KeyR: () => immersive.repeat(),
        KeyF: () => immersive.toggleFull(),
        KeyN: () => S.Player.next(),
        KeyP: () => S.Player.back(),
      };
      if (/^Digit[123]$/.test(e.code)) immersive.setMode(MODES[+e.code.slice(5) - 1][0], true);
      else if (keys[e.code] && !(e.code === "Space" && e.target.closest?.("button"))) {
        e.preventDefault();
        e.stopPropagation();
        keys[e.code]();
      }
    }
  }, true);

  /* ---------------------------------------------------------------- Einstellungs-Dialog */
  function openSettings() {
    const box = document.createElement("div");
    box.className = "mirage-settings";
    for (const key of ["dynamic", "particles", "beat", "cascade", "vinyl", "tilt", "burst", "overlay", "grain", "glass", "calm"]) {
      const row = document.createElement("label");
      row.className = "m-row";
      row.innerHTML = `<span><b></b><small></small></span><input type="checkbox">`;
      row.querySelector("b").textContent = t(key);
      row.querySelector("small").textContent = t(key + "Hint");
      const cb = row.querySelector("input");
      cb.checked = !!cfg[key];
      cb.onchange = () => {
        cfg[key] = cb.checked;
        save();
        applySettings();
        if (key === "dynamic") cfg.dynamic ? onSong(false) : clearColors();
      };
      box.append(row);
    }
    for (const [key, min, max, unit] of [
      ["blur", 0, 60, "px"],
      ["bright", 40, 160, "%"],
    ]) {
      const row = document.createElement("label");
      row.className = "m-row";
      row.innerHTML = `<span><b></b><small></small></span><input type="range">`;
      row.querySelector("b").textContent = t(key);
      const hint = row.querySelector("small");
      const r = row.querySelector("input");
      Object.assign(r, { min, max, value: cfg[key] });
      hint.textContent = cfg[key] + " " + unit;
      r.oninput = () => {
        cfg[key] = Number(r.value);
        hint.textContent = r.value + " " + unit;
        save();
        applySettings();
      };
      box.append(row);
    }
    const tip = document.createElement("small");
    tip.style.cssText = "opacity:.75;padding:8px 4px 0";
    tip.textContent = t("tip");
    box.append(tip);
    S.PopupModal.display({ title: "Mirage", content: box });
  }

  try {
    new S.Menu.Item(t("menu"), false, openSettings, "brightness").register();
  } catch {}
  (function addTopbar() {
    if (!S.Topbar?.Button) return setTimeout(addTopbar, 500);
    try {
      new S.Topbar.Button(t("immersive"), ICON.orb, () => immersive.toggle());
    } catch {}
  })();

  /* ---------------------------------------------------------------- Player-Anbindung */
  function currentItem() {
    return S.Player.data?.item || S.Player.data?.track || null;
  }
  const toHttp = (u) => (u && u.startsWith("spotify:image:") ? "https://i.scdn.co/image/" + u.slice(14) : u || "");
  // klein = sofort da (die Leiste unten nutzt es schon), groß = scharf
  function covers(item) {
    const m = item?.metadata || {};
    const imgs = item?.images || [];
    const domImg = document.querySelector(
      ".main-nowPlayingWidget-coverArt img, [data-testid='CoverSlotCollapsed__container'] img, .main-coverSlotCollapsed-container img"
    )?.src;
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
      const more = Object.keys(m)
        .filter((k) => /^artist_name:\d+$/.test(k))
        .map((k) => m[k]);
      return [m.artist_name, ...more].join(", ");
    }
    return (item?.artists || []).map((a) => a.name).join(", ");
  }

  let lastUri = "", songToken = 0;
  async function onSong(isChange, attempt = 0) {
    const token = ++songToken;
    const item = currentItem();
    const c = covers(item);
    // Beim Songwechsel fehlen die Bilddaten manchmal noch – kurz nachfassen
    if (!c.big && item && attempt < 8) {
      setTimeout(() => token === songToken && onSong(isChange, attempt + 1), 250);
      return;
    }
    const changed = isChange && item?.uri !== lastUri;
    lastUri = item?.uri || "";
    loadAudio(item?.uri).then(() => immersive.updateKicker());
    if (immersive.isOpen()) immersive.refresh();
    bridge.sendTrack(changed);
    if (!c.big) return;
    const { colors, haze } = await analyse(c.big, item?.uri);
    if (token !== songToken) return;
    showHaze(haze || c.big);
    if (cfg.dynamic && colors) setColors(colors);
  }
  function onPlayPause() {
    root.classList.toggle("mirage-playing", !!S.Player.isPlaying());
    immersive.playState();
    beat.sync();
    bridge.sendTrack(false);
  }

  S.Player.addEventListener("songchange", () => onSong(true));
  S.Player.addEventListener("onplaypause", onPlayPause);

  applySettings();
  onPlayPause();
  onSong(false);
  setTimeout(pageEnter, 400);
})();
