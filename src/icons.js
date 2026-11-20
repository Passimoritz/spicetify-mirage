// Linien-Symbole für Menüs, Knöpfe und Spiele (24 × 24, Strich in currentColor) – statt Emojis.
// Emojis sehen auf jedem System anders aus und passen nicht zum Glas; diese hier färben sich mit der Schrift.
const s = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${d}</svg>`;

const UI = {
  close: s('<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>'),
  back: s('<path d="M14.5 6l-6 6 6 6"/>'),
  chevron: s('<path d="M9.5 6l6 6-6 6"/>'),
  check: s('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  thumb: s('<path d="M7.5 10.5V20h-3v-9.5zM7.5 10.5l3.8-6.6a1.9 1.9 0 0 1 3.4 1.6L13.6 9.5h5a2 2 0 0 1 2 2.4l-1.3 6.2a2.4 2.4 0 0 1-2.4 1.9H7.5"/>'),
  gear: s('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  phone: s('<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M11 18.5h2"/>'),
  qr: s('<rect x="3.5" y="3.5" width="7" height="7" rx="1.2"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.2"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.2"/><path d="M14 14h2.5v2.5H14zM19 19h1.5M14 20.5h2.5M20.5 14v2.5"/>'),
  copy: s('<rect x="8.5" y="8.5" width="12" height="12" rx="2.5"/><path d="M15.5 8.5V6A2.5 2.5 0 0 0 13 3.5H6A2.5 2.5 0 0 0 3.5 6v7A2.5 2.5 0 0 0 6 15.5h2.5"/>'),
  play: s('<path d="M7.5 5v14l11-7z"/>'),
  skip: s('<path d="M5.5 5.5l9 6.5-9 6.5zM18.5 5.5v13"/>'),
  stop: s('<rect x="6" y="6" width="12" height="12" rx="2.5"/>'),
  queue: s('<path d="M4 6h12M4 11h12M4 16h6"/><path d="M15 14v6l5-3z"/>'),
  playlist: s('<path d="M4 6h12M4 11h12M4 16h6"/><path d="M18 18.5V11l3 1"/><circle cx="16.2" cy="18.5" r="1.8"/>'),
  add: s('<circle cx="12" cy="12" r="8.5"/><path d="M12 8v8M8 12h8"/>'),
  devices: s('<rect x="2.5" y="5" width="12.5" height="10" rx="1.6"/><path d="M5.5 19h6.5"/><rect x="17" y="9" width="4.5" height="11" rx="1.4"/>'),
  timer: s('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.6 2M9.5 2.5h5"/>'),
  share: s('<path d="M12 14.5V3.5M7.5 8L12 3.5 16.5 8"/><path d="M5 12.5v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>'),
  keyboard: s('<rect x="2.5" y="6" width="19" height="12" rx="2.5"/><path d="M6.5 10h.01M10 10h.01M13.5 10h.01M17 10h.01M7.5 14h9"/>'),
  dj: s('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2.5"/><path d="M12 3.5a8.5 8.5 0 0 1 8.5 8.5M12 6.5a5.5 5.5 0 0 1 5.5 5.5"/>'),
  poll: s('<path d="M5 20v-6M12 20V5M19 20v-9"/>'),
  recap: s('<path d="M3.5 12a8.5 8.5 0 1 0 2.5-6L3.5 8.5"/><path d="M3.5 3.5v5h5M12 8v4.5l3 2"/>'),
  confetti: s('<path d="M4 20l4.5-12 7.5 7.5z"/><path d="M13.5 4.5c.6 1.5.1 3-.9 4M19.5 10.5c-1.5-.6-3-.1-4 .9M17 3v1.5M21 7h-1.5M19.5 14.5l1 1"/>'),
  screen: s('<rect x="2.5" y="4" width="19" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>'),
  film: s('<rect x="3.5" y="4" width="17" height="16" rx="2.5"/><path d="M7.5 4v16M16.5 4v16M3.5 9h4M3.5 15h4M16.5 9h4M16.5 15h4"/>'),
  leaf: s('<path d="M5 19.5C5 11 10 5 20 4.5 20 14 14.5 19 6 19"/><path d="M5 19.5l7.5-7.5"/>'),
  flashOff: s('<path d="M13 2.5L5.5 13H11l-1 8.5 7.5-10.5H12z"/><path d="M3 3l18 18"/>'),
  music: s('<path d="M9 18V5.5l10-2V16"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>'),
  // 1.27 icons: was früher Emojis waren (Spiel-Ergebnisse, Handy-Seite, Fernbedienung)
  mic: s('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/>'),
  micOff: s('<path d="M15 9.5V6a3 3 0 0 0-5.6-1.5M9 9v2a3 3 0 0 0 4.6 2.5M5.5 11a6.5 6.5 0 0 0 10.6 5M18.5 11c0 .8-.1 1.5-.4 2.2M12 17.5V21M8.5 21h7M3.5 3.5l17 17"/>'),
  lock: s('<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8.5 10.5v-3a3.5 3.5 0 0 1 7 0v3M12 14.5v2"/>'),
  crown: s('<path d="M4 8l4 4 4-6.5 4 6.5 4-4-1.6 10H5.6z"/><path d="M6 21h12"/>'),
  mixer: s('<path d="M6 3.5v8.3M6 16.2v4.3M12 3.5v2.3M12 10.2v10.3M18 3.5v6.3M18 14.2v6.3"/><circle cx="6" cy="14" r="2.2"/><circle cx="12" cy="8" r="2.2"/><circle cx="18" cy="12" r="2.2"/>'),
  battery: s('<rect x="2.5" y="7" width="16.5" height="10" rx="2.5"/><path d="M21.5 10.5v3M6 10.5v3M9.5 10.5v3"/>'),
  camera: s('<path d="M4.5 7.5h2.8l1.8-2.5h5.8l1.8 2.5h2.8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2z"/><circle cx="12" cy="13.5" r="3.5"/>'),
  bell: s('<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 21h4"/>'),
  headphones: s('<path d="M4 17V12.5a8 8 0 0 1 16 0V17"/><rect x="3.5" y="13" width="4.5" height="7.5" rx="1.8"/><rect x="16" y="13" width="4.5" height="7.5" rx="1.8"/>'),
  boom: s('<path d="M12 2.5l1.8 5.2 5-2.5-2.5 5 5.2 1.8-5.2 1.8 2.5 5-5-2.5-1.8 5.2-1.8-5.2-5 2.5 2.5-5L2.5 12l5.2-1.8-2.5-5 5 2.5z"/>'),
  // Dabei (Karaoke): wie viel mitgesungen wurde – als Stimm-Pegel
  voice: s('<path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 10.5v3"/>'),
  user: s('<circle cx="12" cy="8" r="3.8"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>'),
  speaker: s('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/>'),
  speakerOff: s('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>'),
  gamepad: s('<path d="M7 7.5h10a4.5 4.5 0 0 1 4.4 5.4l-.8 4a2.6 2.6 0 0 1-4.5 1.2L14.5 16h-5l-1.6 2.1a2.6 2.6 0 0 1-4.5-1.2l-.8-4A4.5 4.5 0 0 1 7 7.5z"/><path d="M8 10.5v3M6.5 12h3M15.5 11h.01M17.5 13h.01"/>'),
  moon: s('<path d="M19.5 14.5A8 8 0 1 1 9.5 4.5a6.5 6.5 0 0 0 10 10z"/>'),
  shield: s('<path d="M12 3l7.5 3v5.5c0 4.5-3.2 8-7.5 9.5-4.3-1.5-7.5-5-7.5-9.5V6z"/><path d="M8.5 12l2.5 2.5 4.5-4.5"/>'),
  shake: s('<rect x="8" y="4" width="8" height="16" rx="2"/><path d="M4.5 8.5v7M2 10.5v3M19.5 8.5v7M22 10.5v3"/>'),
  draw: s('<circle cx="12" cy="12" r="8.5"/><path d="M8.5 10h7M8.5 14h7"/>'),
  prev: s('<path d="M18.5 5.5l-9 6.5 9 6.5zM5.5 5.5v13"/>'),
  pause: s('<rect x="6.5" y="5" width="3.5" height="14" rx="1.2"/><rect x="14" y="5" width="3.5" height="14" rx="1.2"/>'),
  heart: s('<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.3 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>'),
  // Medaillen 1–3: Band und Scheibe mit der Zahl; die Farbe (Gold/Silber/Bronze, mit der Coverfarbe getönt) kommt aus CSS
  medal1: s('<path d="M8 2.5l2.6 6.2M16 2.5l-2.6 6.2"/><circle cx="12" cy="15" r="6.3"/><path d="M11 13.2l1.3-1v5.6" stroke-width="1.6"/>'),
  medal2: s('<path d="M8 2.5l2.6 6.2M16 2.5l-2.6 6.2"/><circle cx="12" cy="15" r="6.3"/><path d="M10.2 13.6a1.8 1.8 0 0 1 3.5.5c0 1.5-3.6 2.3-3.6 3.8h3.7" stroke-width="1.6"/>'),
  medal3: s('<path d="M8 2.5l2.6 6.2M16 2.5l-2.6 6.2"/><circle cx="12" cy="15" r="6.3"/><path d="M10.3 12.3h3.3l-1.9 2.1a1.7 1.7 0 1 1-1.5 2.8" stroke-width="1.6"/>'),
  // 1.27 views: Uhr-Ansicht und Album-Reise
  clock: s('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
  album: s('<rect x="3.5" y="3.5" width="8.5" height="8.5" rx="1.8"/><path d="M15.5 5.5h5M15.5 9.5h5M3.5 15.5h17M3.5 19.5h12"/>'),
  // 1.27 actions: Song-Menü im Immersiv-Modus
  more: s('<circle cx="5.5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18.5" cy="12" r="1.3"/>'),
  disc: s('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2.2"/><path d="M12 6.5a5.5 5.5 0 0 0-5.5 5.5"/>'),
  radio: s('<circle cx="12" cy="12" r="2"/><path d="M8.2 8.2a5.4 5.4 0 0 0 0 7.6M15.8 8.2a5.4 5.4 0 0 1 0 7.6M5.4 5.4a9.3 9.3 0 0 0 0 13.2M18.6 5.4a9.3 9.3 0 0 1 0 13.2"/>'),
  link: s('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
  queueAdd: s('<path d="M4 6h11M4 11h11M4 16h6"/><path d="M17.5 13v7M14 16.5h7"/>'),
  excl: s('<circle cx="12" cy="12" r="8.5"/><path d="M6 6l12 12"/>'),
  podcast: s('<rect x="9" y="3" width="6" height="10" rx="3"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4"/>'),
  speed: s('<path d="M4.5 16a8 8 0 1 1 15 0"/><path d="M12 13l3.5-4"/><circle cx="12" cy="13.5" r="1.2"/>'),
  back15: s('<path d="M4.5 12A7.5 7.5 0 1 0 7 6.4"/><path d="M4.5 3.5v4h4"/><path d="M9.3 10.3l1.2-.8v5.3M13.4 9.5h2.8M13.4 9.5l-.3 2.6c.4-.3.9-.4 1.4-.4a1.6 1.6 0 0 1 0 3.2c-.6 0-1.1-.3-1.4-.7"/>'),
  fwd15: s('<path d="M19.5 12A7.5 7.5 0 1 1 17 6.4"/><path d="M19.5 3.5v4h-4"/><path d="M8.3 10.3l1.2-.8v5.3M12.4 9.5h2.8M12.4 9.5l-.3 2.6c.4-.3.9-.4 1.4-.4a1.6 1.6 0 0 1 0 3.2c-.6 0-1.1-.3-1.4-.7"/>'),
  remove: s('<circle cx="12" cy="12" r="8.5"/><path d="M8.5 12h7"/>'),
  history: s('<path d="M3.5 12a8.5 8.5 0 1 0 2.5-6L3.5 8.5"/><path d="M3.5 3.5v5h5M12 8v4.5l3 2"/>'),
};

// je Spiel ein eigenes Symbol (Schlüssel wie GAME_LIST in games.js)
const GAME = {
  quiz: s('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/>'),
  title: s('<path d="M12 17.5V4l6.5 2.5"/><circle cx="8.5" cy="17.5" r="3.5"/>'),
  intro: s('<circle cx="12" cy="13.5" r="7.5"/><path d="M12 13.5V9.5M10 2.5h4M18.5 6.5L20 5"/>'),
  gap: s('<path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3z"/><path d="M14.5 7.5l2 2"/>'),
  next: s('<path d="M4 6h12M4 11h9M4 16h6"/><path d="M15.5 13.5l4 3-4 3"/>'),
  tf: s('<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5l5 5"/><path d="M8 10.5l1.8 1.8 3.2-3.3"/>'),
  beat: s('<ellipse cx="12" cy="10" rx="8" ry="3"/><path d="M4 10v6.5c0 1.7 3.6 3 8 3s8-1.3 8-3V10"/><path d="M7.5 3.5l3 4M16.5 3.5l-3 4"/>'),
  older: s('<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),
  cover: s('<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="M20.5 15.5l-5-5-9 9"/>'),
  duel: s('<path d="M4.5 4.5l9 9M4.5 4.5h3.5M4.5 4.5V8M19.5 4.5l-9 9M19.5 4.5H16M19.5 4.5V8M7 14.5l2.5 2.5M17 14.5L14.5 17M8.3 15.7L4.5 19.5M15.7 15.7l3.8 3.8"/>'),
  stop: s('<path d="M8 13V6a1.5 1.5 0 0 1 3 0v5M11 10.5V4.5a1.5 1.5 0 0 1 3 0V11M14 10.5V6a1.5 1.5 0 0 1 3 0v8a7 7 0 0 1-7 7h-.4a6 6 0 0 1-5-2.7L3.2 15.4a1.6 1.6 0 0 1 2.6-1.8L8 16"/>'),
  fast: s('<path d="M13 2.5L5 13.5h6l-1 8 8-11h-6z"/>'),
  taps: s('<path d="M9.5 11.5v-6a1.5 1.5 0 0 1 3 0v6.5l3.4.8a2 2 0 0 1 1.5 2.2l-.6 4.3a2 2 0 0 1-2 1.7h-3.2a2 2 0 0 1-1.6-.8L6 15.6a1.5 1.5 0 0 1 2.3-1.9l1.2 1.4"/><path d="M5.5 7a5.5 5.5 0 0 1 10-2.4"/>'),
  battle: s('<circle cx="12" cy="4.5" r="2"/><path d="M5.5 6.5L12 10l6.5-3.5M12 10v4.5L8.5 21M12 14.5l4 3 1 3.5"/>'),
  bomb: s('<circle cx="10.5" cy="14" r="6.5"/><path d="M15 9.5l2.5-2.5"/><path d="M19.5 3.5l1-1M21 7h1M17.5 2.5V1.5"/>'),
  likely: s('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.4M12 17h.01"/>'),
  sing: s('<circle cx="15" cy="9" r="5"/><path d="M11.5 12.5L4 20M12 6.5l5.5 5.5"/>'),
  karaoke: UI.music,
  tour: s('<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4.5a2.5 2.5 0 0 0 2.6 3.9M17 6h2.5a2.5 2.5 0 0 1-2.6 3.9M12 14v3.5M8 21h8M9.5 17.5h5"/>'),
  bingo: s('<rect x="3.5" y="3.5" width="17" height="17" rx="2.5"/><path d="M9.2 3.5v17M14.8 3.5v17M3.5 9.2h17M3.5 14.8h17"/>'),
  wheel: s('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="1.6"/><path d="M12 3.5v6.9M12 13.6v6.9M3.5 12h6.9M13.6 12h6.9M6 6l4.9 4.9M13.1 13.1L18 18M18 6l-4.9 4.9M10.9 13.1L6 18"/>'),
  never: s('<path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c5 0 8.5 4.5 9.5 7a13 13 0 0 1-2.7 3.8M6.6 6.6A13 13 0 0 0 2.5 12c1 2.5 4.5 7 9.5 7a9.6 9.6 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>'),
  dquiz: s('<path d="M5 8h10v10.5a2.5 2.5 0 0 1-2.5 2.5h-5A2.5 2.5 0 0 1 5 18.5z"/><path d="M15 10.5h2.5a2.5 2.5 0 0 1 0 5H15M5 8a2.5 2.5 0 0 1 2.5-3.5 3 3 0 0 1 5 0A2.5 2.5 0 0 1 15 8M8.5 12v5.5M11.5 12v5.5"/>'),
  alarm: s('<path d="M6 18v-5a6 6 0 0 1 12 0v5"/><path d="M4 18h16v3H4zM12 2.5V4M4.2 5.2l1.1 1.1M19.8 5.2l-1.1 1.1M2 11h1.5M20.5 11H22"/>'),
  dlikely: s('<circle cx="16" cy="7.5" r="3"/><path d="M10.5 20.5a5.5 5.5 0 0 1 11 0"/><path d="M2.5 12.5h8M7.5 9.5l3 3-3 3"/>'),
  dwheel: s('<rect x="3.5" y="3.5" width="17" height="17" rx="3.5"/><path d="M8.5 8.5h.01M12 12h.01M15.5 15.5h.01M15.5 8.5h.01M8.5 15.5h.01" stroke-width="2.6"/>'),
};

// kleines Hilfsmittel: Symbol als <i>-Element (für Knöpfe, die mit textContent gebaut werden)
function iconEl(svg, cls = "m-ic") {
  const i = document.createElement("i");
  i.className = cls;
  i.innerHTML = svg;
  return i;
}

export { UI, GAME, iconEl };
