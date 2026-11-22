/* ---------------------------------------------------------------- Tastenkürzel (eine Tabelle für alles) */
// Die Tastatursteuerung (keys.js) und die Tastenhilfe (Taste ?, immersive.js) lesen dieselbe Liste: was hier steht,
// tut auch etwas – und was etwas tut, steht in der Hilfe. Ohne Abhängigkeiten, damit die Unit-Tests sie laden können.
// id: Name der Aktion in keys.js (fehlt bei Einträgen, die nur erklären – Rechtsklick, Spieltasten, Editor)
// codes: KeyboardEvent.code, die die Aktion auslösen · kbd: so steht die Taste in der Hilfe · label: i18n-Schlüssel
// shift: nur mit Umschalt (Umschalt+F10) · group: Abschnitt in der Hilfe · kbdKey: Taste als übersetztes Wort
const SHORTCUTS = [
  { id: "play", codes: ["Space"], kbd: "Space", label: "k_play", group: "play" },
  { id: "seekBack", codes: ["ArrowLeft"], kbd: "← →", label: "k_seek", group: "play" },
  { id: "seekFwd", codes: ["ArrowRight"], group: "play" },
  { id: "volUp", codes: ["ArrowUp"], kbd: "↑ ↓", label: "k_vol", group: "play" },
  { id: "volDown", codes: ["ArrowDown"], group: "play" },
  { id: "next", codes: ["KeyN"], kbd: "N / P", label: "k_next", group: "play" },
  { id: "prev", codes: ["KeyP"], group: "play" },
  { id: "like", codes: ["KeyL"], kbd: "L", label: "k_like", group: "play" },
  { id: "shuffle", codes: ["KeyS"], kbd: "S", label: "k_shuffle", group: "play" },
  { id: "repeat", codes: ["KeyR"], kbd: "R", label: "k_repeat", group: "play" },
  { id: "view", codes: [], kbd: "1 – 6", label: "k_view", group: "view" },
  { id: "full", codes: ["KeyF", "F11"], kbd: "F / F11", label: "k_full", group: "view" },
  { id: "queue", codes: ["KeyQ"], kbd: "Q", label: "k_queue", group: "menu" },
  { id: "song", codes: ["KeyM", "ContextMenu"], kbd: "M", label: "k_song", group: "menu" },
  { id: "song", codes: ["F10"], shift: true, kbd: "⇧ F10", label: "k_songAlt", group: "menu" },
  { kbdKey: "k_rclickKey", label: "k_rclick", group: "menu" },
  { id: "addto", codes: ["KeyA"], kbd: "A", label: "k_addto", group: "menu" },
  { id: "more", codes: ["KeyO"], kbd: "O", label: "k_perf", group: "menu" },
  { kbd: "Home / End", label: "k_homeEnd", group: "menu" },
  { id: "tap", codes: ["KeyT"], kbd: "T", label: "k_tap", group: "lyrics" },
  { id: "timing", codes: ["KeyE"], kbd: "E", label: "k_timing", group: "lyrics" },
  { kbd: "Enter / ⌫", label: "k_editKeys", group: "lyrics" },
  { id: "confetti", codes: ["KeyC"], kbd: "C", label: "k_confetti", group: "party" },
  { kbd: "1 – 9 · Space", label: "k_gameKeys", group: "party" },
  { id: "close", codes: ["Escape"], kbd: "Esc", label: "k_close", group: "app" },
  { kbd: "Ctrl ⇧ M", label: "k_toggle", group: "app" },
  { id: "help", codes: [], kbd: "?", label: "keysTitle", group: "app" },
];

// Aktion zu einer Taste (oder nichts): Umschalt+F10 ist etwas anderes als F10
function shortcutFor(code, shift) {
  return SHORTCUTS.find((s) => s.id && s.codes.includes(code) && (!s.shift || shift)) || null;
}
// was die Tastenhilfe zeigt: nur Einträge mit Taste und Text, in der Reihenfolge der Tabelle
// (kbdKey: die Taste ist ein Wort, das übersetzt wird – „Rechtsklick“)
const helpRows = (views = 6) => SHORTCUTS.filter((s) => (s.kbd || s.kbdKey) && s.label).map((s) => ({ ...s, kbd: s.id === "view" ? "1 – " + views : s.kbd }));

export { SHORTCUTS, shortcutFor, helpRows };
