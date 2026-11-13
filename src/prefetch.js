import { S } from "./core.js";
import { cfg } from "./config.js";
import { lock } from "./lock.js";
import { warmAudio } from "./audio.js";
import { warmLyrics, dropStaleLyrics } from "./lyrics.js";
import { PLR } from "./player.js";

/* ---------------------------------------------------------------- Nächsten Song vorbereiten */
// Rund 20 s vor dem Ende holt Mirage Taktdaten und Liedtext des nächsten Songs schon einmal – der Wechsel
// findet dann alles fertig vor statt mitten im Übergang zu laden. Kein Dauer-Timer: je Song EIN Wecker,
// der bei Pause abgestellt wird. Cover und Farben bereitet song.js schon beim Songstart vor.
const AHEAD = 20000;
let timer = 0, onBattery = false;
try {
  navigator.getBattery?.().then((b) => {
    const upd = () => (onBattery = !b.charging);
    upd();
    b.addEventListener("chargingchange", upd);
  });
} catch {}
// Energiesparen (fest an oder im Akkubetrieb): nichts auf Vorrat laden
const saving = () => cfg.eco === "on" || (cfg.eco === "auto" && onBattery);

function fire() {
  timer = 0;
  if (!PLR.isPlaying()) return;
  const left = (PLR.getDuration() || 0) - (PLR.getProgress() || 0);
  // zurückgespult: der Wecker war zu früh, neu stellen
  if (left > AHEAD + 3000) return plan();
  // ein Spiel führt die Musik und wählt die Songs selbst: die Warteschlange sagt dann nichts
  if (lock.on || saving()) return;
  const next = (S.Queue?.nextTracks || []).map((x) => x.contextTrack || x).find((x) => x?.uri?.startsWith("spotify:track:"));
  if (!next) return;
  warmAudio(next.uri);
  warmLyrics(next);
}
// bei Songwechsel und Play/Pause: Wecker neu stellen (oder abstellen)
function plan() {
  clearTimeout(timer);
  timer = 0;
  // schnell durchgeskippt: Liedtext-Anfragen für Songs, die weder laufen noch als Nächstes kommen, abbrechen –
  // auch wenn der Immersiv-Modus gar nicht offen ist (Overlay, Handys, Takt-Schätzung fragen ebenfalls)
  dropStaleLyrics();
  if (!PLR.isPlaying()) return;
  const dur = PLR.getDuration() || 0;
  // sehr kurze Stücke (Zwischenspiele, Werbung) lohnen nicht
  if (dur < AHEAD * 2) return;
  timer = setTimeout(fire, Math.max(1000, dur - (PLR.getProgress() || 0) - AHEAD));
}

export { plan as planPrefetch };
