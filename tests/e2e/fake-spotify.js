// Spotify-Nachbau für die End-to-End-Tests. Der Spicetify.Player ist dem echten spicetifyWrapper.js (Spicetify 2.46.4)
// nachgebaut, mit seinem Verhalten und seinen Fallen:
//  - setMute/toggleMute klicken auf „.volume-bar__icon-button“; den Knopf gibt es in aktuellen Spotify-Versionen nicht
//  - Spicetify.Queue ist origin._queue._state ?? origin._queue._queue, nextTracks enthält Trennzeilen
//  - Songwechsel, Springen, Pause und Lautstärke wirken erst nach einem Moment
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
  const noAnalysis = (i) => i % 5 === 2;
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

  const log = { next: 0, seek: [], dropped: 0, pause: 0, play: 0, audible: {}, notes: [], volume: [], queued: [], yearCalls: 0 };
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
  const SKIP_MS = 220, SEEK_MS = 70, PLAY_MS = 40, VOL_MS = 60, SEEK_DROP_MS = 160;

  const st = { item: tracks[0], isPaused: false, timestamp: Date.now(), positionAsOfTimestamp: 0, duration: 200000, shuffle: false, repeat: 0, context: { uri: "spotify:playlist:test" } };
  const queueState = {};
  const refreshQueue = () => {
    const wrap = (x) => ({ contextTrack: x, removed: [], blocked: [], provider: "context" });
    const n = tracks.length, next = [];
    for (let k = 1; k <= 12; k++) next.push(wrap(tracks[(cur + k) % n]));
    next.splice(5, 0, { contextTrack: { uri: "spotify:delimiter", uid: "d", metadata: { hidden: "true" } }, removed: [], blocked: [], provider: "context" });
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

  const PlaybackAPI = {
    _volume: 0.7,
    async setVolume(v) {
      log.volume.push(v);
      setTimeout(() => (PlaybackAPI._volume = v), VOL_MS);
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
    getHeart: () => false,
    toggleHeart: () => {},
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
      History: { listen() {}, location: { pathname: "/playlist/x" }, push() {} }, version: "1.2.80.0", PlaybackAPI, PlayerAPI: {},
      RootlistAPI: { getContents: async () => ({ items: [{ type: "folder", name: "Party", items: [{ type: "playlist", uri: PL_URI, name: "Quiz Mix", isOwnedBySelf: true }] }, { type: "playlist", uri: "spotify:playlist:empty", name: "Leer" }] }) },
      PlaylistAPI: { getContents: async (uri) => ({ items: uri === PL_URI ? plTracks : [], totalLength: uri === PL_URI ? plTracks.length : 0 }) },
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
        // Suche für Songwünsche: die ersten Songs der Liste
        if (/v1[/]search/.test(url)) return { tracks: { items: tracks.slice(0, 3).map((x, i) => ({ id: x.uri.split(":")[2], uri: x.uri, name: x.name, explicit: i === 1, artists: [{ name: x.metadata.artist_name }], album: { images: [] } })) } };
        return {};
      },
    },
    // Menüpunkte nach Symbol merken: Tests öffnen darüber die Einstellungen (__menu.brightness())
    Menu: { Item: class { constructor(name, sel, fn, icon) { (window.__menu ||= {})[icon || name] = fn; } register() {} } },
    Topbar: { Button: class { constructor() { this.element = button("main-topBar-button"); } } },
    PopupModal: { display: (o) => document.body.append(o.content), hide() {} },
    Config: { color_scheme: "Mirage", version: "2.46.4" },
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
        segments: [],
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
  };

  addEventListener("error", (e) => console.error("PAGEERROR " + e.message + " @" + e.lineno));
  addEventListener("unhandledrejection", (e) => console.error("REJECTION " + (e.reason?.stack || e.reason)));
})();
