// Spotify-Nachbau für die End-to-End-Tests. Der Spicetify.Player ist dem echten spicetifyWrapper.js (Spicetify 2.46.7,
// Spotify 1.3.10) nachgebaut, mit seinem Verhalten und seinen Fallen:
//  - setMute/toggleMute klicken auf „.volume-bar__icon-button“; den Knopf gibt es in aktuellen Spotify-Versionen nicht
//  - Spicetify.Queue ist origin._queue._state ?? origin._queue._queue, nextTracks enthält Trennzeilen
//  - Songwechsel, Springen, Pause und Lautstärke wirken erst nach einem Moment (Lautstärke: über die Meldung des Dienstes)
//  - Platform.version wie im echten Client („1.3.10.2586.g…“); ein Test kann sie vor dem Laden über
//    localStorage „e2e:spotifyVersion“ setzen, um ein Spotify-Update nachzustellen
//  - ein neuer Song spielt von 0 los, bis gesprungen wurde; ein Sprung direkt nach dem Wechsel geht verloren
//  - bei Shuffle kommt ein anderer Song als der, den die Warteschlange als nächsten nennt
// Wird vom echten Spotify etwas anderes bekannt, gehört es hierher: tools/check-spotify.js vergleicht mit der Installation.
(() => {
  const NAMES = ["Aurora", "Blue Lake", "Cinder", "Delta Nine", "Echo Park", "Fable", "Gold Coast", "Hollow", "Ivy", "Juno", "Kite", "Lumen", "Mono", "Nova", "Opal", "Pike", "Quill", "Rook", "Sable", "Tide", "Umber", "Vale", "Wren", "Yarrow", "Zeal", "Ash", "Birch", "Cove", "Dune", "Elm", "Fern", "Glen"];
  const hex = (i) => String(i).padStart(24, "0");
  const titleOf = (a, i) => "Song of " + a + (i % 4 === 1 ? " - Remastered 2011" : i % 6 === 2 ? " (feat. Guest)" : "");
  const makeTracks = (names) =>
    names.map((a, i) => ({
      uri: `spotify:track:t${String(i).padStart(21, "0")}`,
      uid: "u" + i,
      name: titleOf(a, i),
      duration: { milliseconds: 200000 },
      metadata: { title: titleOf(a, i), artist_name: a, album_title: "Album " + i, duration: "200000", image_url: "spotify:image:ab67616d00004851" + hex(i), image_large_url: "spotify:image:ab67616d0000b273" + hex(i) },
    }));
  let tracks = makeTracks(NAMES);

  // Songs ohne Liedtext und ohne Taktdaten gibt es auch in echt
  const noLyrics = (i) => i % 7 === 3;
  // allAna: für Tests, die eine Analyse brauchen (Karaoke-Wertung), haben vorübergehend alle Songs eine
  let allAna = false;
  const noAnalysis = (i) => !allAna && i % 5 === 2;
  const idx = (uri) => tracks.findIndex((x) => x.uri === uri);
  const VERSE = ["We are dancing in the fire tonight", "Feel the rain falling on my skin", "You hold my heart inside your hand", "Money falling down from the sky", "Under silver stars we run away", "Nothing ever stays the same again", "Golden summer burning through the night", "Every window open to the street"];
  const CHORUS = ["Forever running with the morning light", "Forever singing till the morning comes"];
  const lyricLines = (i) => {
    const out = [];
    for (let n = 0; n < 60; n++) {
      const text = n % 6 === 4 ? CHORUS[0] : n % 6 === 5 ? CHORUS[1] : `${VERSE[(n + i) % VERSE.length]} ${NAMES[(n * 3 + i) % NAMES.length].split(" ")[0]}`;
      out.push({ startTimeMs: String(8000 + n * 3000), words: text });
    }
    return out;
  };

  const log = { next: 0, seek: [], dropped: 0, pause: 0, play: 0, audible: {}, notes: [], volume: [], queued: [], yearCalls: 0,
    // 1.27 actions: Song-Menü
    nav: [], added: [], created: [], clip: [], removedQ: [], skipTo: [], played: [], speed: [], taste: [], liked: [] };
  let cur = 0, shuffleJump = 0, trackStart = Date.now();
  // Eine Playlist in der Bibliothek, die gerade NICHT läuft (Quelle fürs Quiz): eigene Songs, eigene Künstler
  const PL_URI = "spotify:playlist:quizmix";
  const plTracks = Array.from({ length: 12 }, (_, i) => ({
    uri: `spotify:track:p${String(i).padStart(21, "0")}`,
    uid: "p" + i,
    name: "Mix Song " + (i + 1),
    isPlayable: true,
    duration: { milliseconds: 200000 },
    artists: [{ name: "Mix Artist " + (i + 1), uri: "spotify:artist:m" + i }],
    album: { name: "Mix Album", uri: "spotify:album:m", images: [{ url: "spotify:image:ab67616d0000b273" + hex(100 + i) }] },
    metadata: { title: "Mix Song " + (i + 1), artist_name: "Mix Artist " + (i + 1), album_title: "Mix Album", duration: "200000", image_url: "spotify:image:ab67616d00004851" + hex(100 + i) },
  }));
  // Erscheinungsjahr: die laufende Liste reihum 1985, 1995, 2015; die Playlist abwechselnd 1985 und 2015
  const yearOf = (uri) => {
    const p = plTracks.findIndex((x) => x.uri === uri);
    if (p >= 0) return p % 2 ? 2015 : 1985;
    const i = tracks.findIndex((x) => x.uri === uri);
    return i < 0 ? 0 : [1985, 1995, 2015][i % 3];
  };
  const queued = [];
  // 1.27 actions: was über PlayerAPI.addToQueue eingereiht wurde, zeigt die Warteschlange (provider „queue“) wie Spotify
  const shownQueued = new Set();
  const hearts = new Set();
  const SKIP_MS = 220, SEEK_MS = 70, PLAY_MS = 40, VOL_MS = 60, SEEK_DROP_MS = 160;

  const st = { item: tracks[0], isPaused: false, timestamp: Date.now(), positionAsOfTimestamp: 0, duration: 200000, shuffle: false, repeat: 0, context: { uri: "spotify:playlist:test" } };
  const queueState = {};
  const refreshQueue = () => {
    const wrap = (x) => ({ contextTrack: x, removed: [], blocked: [], provider: "context" });
    const n = tracks.length, next = [];
    for (let k = 1; k <= 12; k++) next.push(wrap(tracks[(cur + k) % n]));
    next.splice(5, 0, { contextTrack: { uri: "spotify:delimiter", uid: "d", metadata: { hidden: "true" } }, removed: [], blocked: [], provider: "context" });
    const mine = queued.filter((x) => shownQueued.has(x));
    next.unshift(...mine.map((x, i) => ({ contextTrack: { ...x, uid: "q" + i + x.uid }, removed: [], blocked: [], provider: "queue" })));
    const prev = [];
    for (let k = 3; k >= 1; k--) if (cur - k >= 0) prev.push(wrap(tracks[cur - k]));
    Object.assign(queueState, { track: wrap(tracks[cur]), nextTracks: next, prevTracks: prev, queueRevision: String(Date.now()) });
  };
  const pos = () => (st.isPaused ? 0 : Date.now() - st.timestamp) + st.positionAsOfTimestamp;
  const setPos = (p) => {
    st.positionAsOfTimestamp = p;
    st.timestamp = Date.now();
  };

  const fire = (name, data) => {
    const e = new Event(name);
    e.data = data;
    (P.eventListeners[name] || []).slice().forEach((f) => f(e));
  };
  const land = (i) => {
    cur = ((i % tracks.length) + tracks.length) % tracks.length;
    st.item = tracks[cur];
    st.duration = 200000;
    st.isPaused = false;
    setPos(0);
    trackStart = Date.now();
    refreshQueue();
    P.data = st;
    fire("songchange", P.data);
  };

  // ein Song aus der Warteschlange des Nutzers: läuft, ohne die Stelle in der Liste zu verschieben
  const landItem = (item) => {
    st.item = item;
    st.duration = 200000;
    st.isPaused = false;
    setPos(0);
    trackStart = Date.now();
    refreshQueue();
    P.data = st;
    fire("songchange", P.data);
  };
  const origin = {
    _state: st,
    _queue: { _queue: queueState, _queueState: { current: null, queued: [], nextUp: [] } },
    skipToNext() {
      log.next++;
      const to = cur + 1 + shuffleJump, mine = queued.shift();
      setTimeout(() => (mine ? landItem(mine) : land(to)), SKIP_MS);
    },
    skipToPrevious() {
      setTimeout(() => land(cur - 1), SKIP_MS);
    },
    pause() {
      log.pause++;
      setTimeout(() => {
        if (st.isPaused) return;
        st.positionAsOfTimestamp = pos();
        st.isPaused = true;
        fire("onplaypause", P.data);
      }, PLAY_MS);
    },
    resume() {
      log.play++;
      setTimeout(() => {
        if (!st.isPaused) return;
        st.timestamp = Date.now();
        st.isPaused = false;
        fire("onplaypause", P.data);
      }, PLAY_MS);
    },
    seekTo(ms) {
      log.seek.push(ms);
      if (Date.now() - trackStart < SEEK_DROP_MS) {
        log.dropped++;
        return;
      }
      setTimeout(() => setPos(ms), SEEK_MS);
    },
    setRepeat: (v) => (st.repeat = v),
    setShuffle: (v) => (st.shuffle = v),
  };

  // wie Spotify 1.3.10: setVolume schickt nur an den Wiedergabe-Dienst, der neue Wert kommt einen Moment später über
  // dessen Meldung (subVolume) zurück. _volume ist ein Getter/Setter um __volume; der Setter sagt dem MuteHelper
  // Bescheid (Lautstärke 0 heißt stumm, die letzte andere merkt er sich für „Ton an“ in Spotifys eigener Leiste).
  const handlers = {};
  const events = {
    addListener: (n, f) => ((handlers[n] ||= []).push(f), events),
    removeListener: (n, f) => ((handlers[n] = (handlers[n] || []).filter((x) => x !== f)), events),
    emit: (n, data) => (handlers[n] || []).slice().forEach((f) => f({ type: n, data })),
  };
  const muteHelper = {
    _volumeBehindMute: 0.35,
    _isMuted: false,
    isMuted: () => muteHelper._isMuted,
    setMuted(e) {
      if (e === muteHelper._isMuted) return;
      muteHelper._isMuted = e;
      events.emit("muted_changed", { muted: e });
    },
    onVolumeChange(e) {
      if (e !== 0) muteHelper._volumeBehindMute = e;
      muteHelper.setMuted(e === 0);
    },
    async mute() {
      if (muteHelper._isMuted) return;
      muteHelper._isMuted = true;
      events.emit("muted_changed", { muted: true });
      muteHelper._volumeBehindMute = await PlaybackAPI.getVolume();
      PlaybackAPI.setVolume(0);
    },
    async unmute() {
      if (!muteHelper._isMuted) return;
      muteHelper._isMuted = false;
      events.emit("muted_changed", { muted: false });
      PlaybackAPI.setVolume(muteHelper._volumeBehindMute);
    },
    toggleMute: () => (muteHelper._isMuted ? muteHelper.unmute() : muteHelper.mute()),
  };
  const PlaybackAPI = {
    // echt: -1, bis der Dienst die erste Lautstärke meldet – das passiert beim Start von Spotify, lange vor dem Theme
    __volume: 0.7,
    get _volume() {
      return PlaybackAPI.__volume;
    },
    set _volume(e) {
      muteHelper.onVolumeChange(e);
      PlaybackAPI.__volume = e;
    },
    _isAvailable: true,
    _isVolumeAdjustable: true,
    getMuteHelper: () => muteHelper,
    getEvents: () => events,
    getVolumeInternal: () => (PlaybackAPI._isAvailable && PlaybackAPI._isVolumeAdjustable ? PlaybackAPI._volume : -1),
    async getVolume() {
      return PlaybackAPI.getVolumeInternal();
    },
    async setVolume(v) {
      log.volume.push(v);
      // subVolume: der Dienst meldet den neuen Wert
      setTimeout(() => {
        if (PlaybackAPI._isVolumeAdjustable) PlaybackAPI._volume = v;
        events.emit("volume", { volume: PlaybackAPI.getVolumeInternal(), isLocal: true });
      }, VOL_MS);
    },
    async raiseVolume() {},
    async lowerVolume() {},
  };

  // wie im echten Wrapper
  const P = {
    origin,
    data: st,
    eventListeners: {},
    addEventListener: (e, f) => (P.eventListeners[e] ||= []).push(f),
    removeEventListener: (e, f) => {
      const a = P.eventListeners[e];
      if (a?.includes(f)) a.splice(a.indexOf(f), 1);
    },
    dispatchEvent: (e) => ((P.eventListeners[e.type] || []).forEach((f) => f(e)), !e.defaultPrevented),
    seek: (e) => origin.seekTo(!Number.isInteger(e) && e >= 0 && e <= 1 ? Math.round(e * st.duration) : e),
    getProgress: () => pos(),
    getProgressPercent: () => pos() / st.duration,
    getDuration: () => st.duration,
    setVolume: (e) => void PlaybackAPI.setVolume(e),
    increaseVolume: () => PlaybackAPI.raiseVolume(),
    decreaseVolume: () => PlaybackAPI.lowerVolume(),
    getVolume: () => PlaybackAPI._volume,
    next: () => origin.skipToNext(),
    back: () => origin.skipToPrevious(),
    togglePlay: () => (P.isPlaying() ? P.pause() : P.play()),
    isPlaying: () => !st.isPaused,
    toggleShuffle: () => origin.setShuffle(!st.shuffle),
    getShuffle: () => st.shuffle,
    setShuffle: (e) => origin.setShuffle(e),
    toggleRepeat: () => origin.setRepeat((st.repeat + 1) % 3),
    getRepeat: () => st.repeat,
    setRepeat: (e) => origin.setRepeat(e),
    getMute: () => P.getVolume() === 0,
    toggleMute: () => P.setMute(!P.getMute()),
    setMute: (e) => {
      if (e !== P.getMute()) document.querySelector(".volume-bar__icon-button")?.click();
    },
    formatTime: () => "0:00",
    getHeart: () => hearts.has(st.item.uri),
    toggleHeart: () => {
      const u = st.item.uri;
      if (hearts.has(u)) hearts.delete(u);
      else hearts.add(u);
      log.liked.push(u);
    },
    playUri: async (uri) => log.played.push(uri),
    pause: () => origin.pause(),
    play: () => origin.resume(),
  };

  refreshQueue();
  // Hörprotokoll: von welcher Songstelle an war der Song wirklich hörbar (spielt und nicht stumm)?
  setInterval(() => {
    if (pos() >= st.duration) land(cur + 1);
    if (st.isPaused || !(PlaybackAPI._volume > 0)) return;
    const u = st.item.uri, p = Math.round(pos()), a = log.audible[u];
    if (!a) log.audible[u] = { min: p, max: p };
    else {
      a.min = Math.min(a.min, p);
      a.max = Math.max(a.max, p);
    }
  }, 8);
  setInterval(() => fire("onprogress", P.data), 500);

  window.fetch = async () => ({ ok: false, status: 404, json: async () => ({}), text: async () => "" });

  const cover = "data:image/gif;base64,R0lGODlhAQABAAAAACw=";
  const button = (cls) => {
    const b = document.createElement("button");
    b.className = cls;
    return b;
  };
  window.Spicetify = {
    Player: P,
    get Queue() {
      return P.origin?._queue?._state ?? P.origin?._queue?._queue;
    },
    Platform: {
      History: { listen() {}, location: { pathname: "/playlist/x" }, push: (p) => log.nav.push(String(p)) }, version: (() => { try { return localStorage.getItem("e2e:spotifyVersion"); } catch { return null; } })() || "1.3.10.2586.g81a118a22460", PlaybackAPI,
      // 1.27 actions: Spotifys PlayerAPI (1.3.10): Warteschlange bearbeiten, zu einem Song springen, Tempo bei Podcasts
      PlayerAPI: {
        async addToQueue(list) {
          for (const x of list || []) {
            const item = [...tracks, ...plTracks].find((y) => y.uri === x.uri) || st.item;
            queued.push(item);
            shownQueued.add(item);
            log.queued.push(x.uri);
          }
          refreshQueue();
        },
        async removeFromQueue(list) {
          for (const x of list || []) {
            log.removedQ.push(x.uri);
            const i = queued.findIndex((y) => y.uri === x.uri);
            if (i >= 0) queued.splice(i, 1);
          }
          refreshQueue();
        },
        async clearQueue() {
          queued.length = 0;
          refreshQueue();
        },
        async skipTo(x) {
          log.skipTo.push(x.uri);
          const i = idx(x.uri);
          setTimeout(() => (i >= 0 ? land(i) : landItem([...plTracks, ...queued].find((y) => y.uri === x.uri) || st.item)), SKIP_MS);
        },
        getCapabilities: () => ({ canChangeSpeed: true }),
        async setSpeed(v) {
          log.speed.push(v);
          st.speed = v;
        },
      },
      RootlistAPI: {
        getContents: async () => ({ items: [{ type: "folder", name: "Party", items: [{ type: "playlist", uri: PL_URI, name: "Quiz Mix", isOwnedBySelf: true }] }, { type: "playlist", uri: "spotify:playlist:empty", name: "Leer" }] }),
        createPlaylist: async (name, pos) => {
          const uri = "spotify:playlist:new" + log.created.length;
          log.created.push({ name, pos, uri });
          return uri;
        },
      },
      PlaylistAPI: {
        getContents: async (uri) => ({ items: uri === PL_URI ? plTracks : [], totalLength: uri === PL_URI ? plTracks.length : 0 }),
        add: async (pl, uris, pos) => log.added.push({ pl, uris, pos }),
      },
      ClipboardAPI: { copy: async (text) => log.clip.push(text) },
      // „Aus deinem Geschmacksprofil ausschließen“: Sammlung ignoreinrecs
      CollectionPlatformAPI: (() => {
        const sets = { ignoreinrecs: new Set() };
        return {
          contains: async (set, uris) => uris.map((u) => !!sets[set]?.has(u)),
          add: async (set, uris) => uris.forEach((u) => (sets[set].add(u), log.taste.push("+" + u))),
          remove: async (set, uris) => uris.forEach((u) => (sets[set].delete(u), log.taste.push("-" + u))),
        };
      })(),
    },
    CosmosAsync: {
      get: async (url) => {
        const m = /color-lyrics\/v2\/track\/([A-Za-z0-9]+)/.exec(url);
        if (m) {
          const i = tracks.findIndex((x) => x.uri.endsWith(m[1]));
          if (i < 0 || noLyrics(i)) throw new Error("404");
          return { lyrics: { syncType: "LINE_SYNCED", lines: lyricLines(i), language: "en" } };
        }
        if (/artists[/]/.test(url)) return { genres: ["dance pop"] };
        // Song-Radio (1.27 actions): Spotify baut eine Radio-Playlist aus dem Song
        const seed = /inspiredby-mix[/]v2[/]seed_to_playlist[/](spotify:track:[A-Za-z0-9]+)/.exec(url);
        if (seed) return { mediaItems: [{ uri: "spotify:playlist:radio" + seed[1].slice(-6) }] };
        // Erscheinungsjahre, bis zu 50 Songs auf einmal
        const ids = /v1[/]tracks[?]ids=([A-Za-z0-9,]+)/.exec(url);
        if (ids) {
          log.yearCalls++;
          return { tracks: ids[1].split(",").map((id) => ({ id, uri: "spotify:track:" + id, album: { release_date: yearOf("spotify:track:" + id) + "-05-01" } })) };
        }
        // ein Song über seine ID (Wunsch per Spotify-Link)
        const one = /v1[/]tracks[/]([A-Za-z0-9]{22})/.exec(url);
        if (one) {
          const x = [...tracks, ...plTracks].find((y) => y.uri.endsWith(one[1]));
          if (!x) throw new Error("404");
          return { id: one[1], uri: x.uri, name: x.name, artists: [{ name: x.metadata?.artist_name || x.artists?.[0]?.name || "" }], album: { images: [] } };
        }
        // Album-Reise (views): ein Album aus der laufenden Liste, alle Songs auf einer CD
        if (/v1[/]albums[/]/.test(url)) return { name: "Glass Album", release_date: "2021-03-05", artists: [{ name: "Mirage Ensemble" }], tracks: { items: tracks.map((x, i) => ({ uri: x.uri, name: x.name, duration_ms: 200000, track_number: i + 1, disc_number: 1, artists: [{ name: x.metadata.artist_name }] })), next: null } };
        // Suche für Songwünsche: die ersten Songs der Liste
        if (/v1[/]search/.test(url)) return { tracks: { items: tracks.slice(0, 3).map((x, i) => ({ id: x.uri.split(":")[2], uri: x.uri, name: x.name, explicit: i === 1, artists: [{ name: x.metadata.artist_name }], album: { images: [] } })) } };
        return {};
      },
    },
    // Menüpunkte nach Symbol merken: Tests öffnen darüber die Einstellungen (__menu.brightness())
    Menu: { Item: class { constructor(name, sel, fn, icon) { (window.__menu ||= {})[icon || name] = fn; } register() {} } },
    Topbar: { Button: class { constructor() { this.element = button("main-topBar-button"); } } },
    PopupModal: { display: (o) => document.body.append(o.content), hide() {} },
    Config: { color_scheme: "Mirage", version: "2.46.7" },
    Locale: { getLocale: () => "de" },
    colorExtractor: async () => ({ VIBRANT: "#ff4f8b", DARK_VIBRANT: "#7c3aed" }),
    showNotification: (msg, err) => log.notes.push({ msg: String(msg), err: !!err, at: Date.now() }),
    addToQueue: async (list) => {
      for (const x of list || []) {
        const item = [...tracks, ...plTracks].find((y) => y.uri === x.uri);
        if (item) queued.push(item);
        log.queued.push(x.uri);
      }
    },
    getAudioData: async (uri) => {
      await new Promise((r) => setTimeout(r, 280));
      const i = Math.max(0, idx(uri));
      if (noAnalysis(i)) throw new Error("no analysis");
      const hook = 40 + i;
      return {
        track: { tempo: 120 + (i % 5) * 4, loudness: -6, key: 9, mode: 0 },
        beats: Array.from({ length: 400 }, (_, k) => ({ start: k * 0.5, confidence: 0.9 })),
        sections: [
          { start: 0, duration: hook, loudness: -14, tempo: 124, key: 1, mode: 1 },
          { start: hook, duration: 60, loudness: -5, tempo: 124, key: 1, mode: 1 },
          { start: hook + 60, duration: 200, loudness: -9, tempo: 124, key: 1, mode: 1 },
        ],
        // Tonhöhen und Lautheit alle 0,5 s, der Akkord wechselt alle 3 s (Grundton, große Terz, Quinte): Karaoke vergleicht damit
        segments: Array.from({ length: 400 }, (_, k) => {
          const r = [0, 5, 7, 9][Math.floor(k / 6) % 4], p = Array(12).fill(0.08);
          p[r] = 1;
          p[(r + 4) % 12] = 0.7;
          p[(r + 7) % 12] = 0.6;
          return { start: k * 0.5, duration: 0.5, loudness_max: -8, pitches: p, timbre: Array(12).fill(0) };
        }),
        bars: [],
        tatums: [],
      };
    },
  };

  // nur für die Tests
  window.__sp = {
    log,
    cover,
    now: () => ({ uri: st.item.uri, title: st.item.metadata.title, artist: st.item.metadata.artist_name, pos: Math.round(pos()), playing: !st.isPaused, vol: PlaybackAPI._volume, i: cur }),
    lyrics: (uri) => (noLyrics(Math.max(0, idx(uri))) ? [] : lyricLines(Math.max(0, idx(uri))).map((l) => l.words)),
    setShuffleJump: (n) => (shuffleJump = n),
    useArtists: (names) => {
      tracks = makeTracks(names);
      land(0);
    },
    resetArtists: () => {
      tracks = makeTracks(NAMES);
      land(0);
    },
    yearOf,
    reset: () => {
      queued.length = 0;
      if (st.isPaused) origin.resume();
      PlaybackAPI._volume = 0.7;
      shuffleJump = 0;
    },
    press: (code, extra = {}) => document.dispatchEvent(new KeyboardEvent("keydown", { code, bubbles: true, ...extra })),
    // andere Inhalte als Songs, wie Spotify sie in Player.data.item meldet: ohne Liedtext, ohne Audio-Analyse,
    // teils ohne Künstler, Cover oder Dauer
    playSpecial: (kind) => landItem(SPECIAL[kind]),
    // Wiedergabe-Kontext (Album-Reise: spotify:album:…; AI-DJ: Playlist 37i9dQZF1EYkqdzj48dyYq, metadata.lexicon_set_type „your_dj“)
    setContext: (uri, metadata) => (st.context = { uri, metadata: metadata || {} }),
    // alle Songs mit Audio-Analyse (true) oder wie sonst jeder fünfte ohne (false)
    allAnalysis: (on) => (allAna = !!on),
  };
  const SPECIAL = {
    // Podcast-Folge (auch Video-Podcasts: gleiche URI-Art, das Bild kommt aus Spotifys Videofläche)
    episode: { uri: "spotify:episode:e0000000000000000000001", uid: "e1", name: "Folge 12: Glas", metadata: { title: "Folge 12: Glas", album_title: "Glas-Funk", artist_name: "Glas-Funk", image_url: "spotify:image:ab6765630000ba8a" + hex(7), media_type: "audio", "is_podcast": "true" } },
    video: { uri: "spotify:episode:e0000000000000000000002", uid: "e2", name: "Folge 13 (Video)", metadata: { title: "Folge 13 (Video)", album_title: "Glas-Funk", image_url: "spotify:image:ab6765630000ba8a" + hex(8), media_type: "video", "is_podcast": "true" } },
    // Hörbuch-Kapitel
    chapter: { uri: "spotify:episode:c0000000000000000000003", uid: "c1", name: "Kapitel 1", metadata: { title: "Kapitel 1", album_title: "Das Glashaus", artist_name: "A. Autor", image_url: "spotify:image:ab67656300005f1f" + hex(9), is_audiobook: "true" } },
    // Werbung (kostenloses Konto): eigene URI-Art, kein Künstler, oft kein großes Bild
    ad: { uri: "spotify:ad:000000000000000000000001", uid: "a1", name: "Werbung", metadata: { title: "Spotify", is_advertisement: "true", image_url: "" } },
    // lokale Datei: kein Cover vom Bildserver, keine Analyse
    local: { uri: "spotify:local:Mirage+Ensemble:Glass+Hours:Local+Song:215", uid: "l1", name: "Local Song", metadata: { title: "Local Song", artist_name: "Mirage Ensemble", album_title: "Glass Hours", image_url: "" } },
    // AI-DJ: Ansage zwischen den Songs (läuft im DJ-Kontext, keine Musik, kein Liedtext)
    dj: { uri: "spotify:track:dj00000000000000000000x", uid: "dj", name: "DJ", metadata: { title: "DJ", artist_name: "DJ", is_dj_narration: "true", image_url: "spotify:image:ab67706f00000002" + hex(5) } },
    // so meldet Spotify 1.3.10 die Ansage: „is_narration“ am Eintrag, der Kontext ist der DJ (setContext)
    djNarration: { uri: "spotify:track:dj00000000000000000000y", uid: "dj2", name: "DJ", metadata: { title: "DJ", is_narration: "true", image_url: "spotify:image:ab67706f00000002" + hex(6) } },
    // ein Song, den der DJ spielt: trägt die Ansage davor nur als Text, ist aber Musik
    djSong: { ...tracks[1], uid: "djs", metadata: { ...tracks[1].metadata, "narration.intro.ssml": "<speak>Up next</speak>" } },
    // leer (Übergang, nichts ausgewählt)
    none: { uri: "", uid: "", name: "", metadata: {} },
  };

  addEventListener("error", (e) => console.error("PAGEERROR " + e.message + " @" + e.lineno));
  addEventListener("unhandledrejection", (e) => console.error("REJECTION " + (e.reason?.stack || e.reason)));
})();
