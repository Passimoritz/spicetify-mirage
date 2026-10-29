import { immersive } from "./immersive.js";

/* ---------------------------------------------------------------- Bühne */
// Der ganze Umgebungs-Hintergrund (Cover-Licht, Aurora, Puls, Lichtstaub, Vignette) wird in
// EIN Canvas in Viertel-Auflösung gezeichnet (dust.js). Früher waren das sieben bildschirm-
// füllende Ebenen, zwei davon 1,8 × 1,8 Fenster groß und drehend – Spotifys GPU-Prozess
// brauchte dafür über einen ganzen Prozessorkern. Nur das Filmkorn bleibt als feste Ebene,
// weil es scharf sein muss.
const stage = document.createElement("div");
stage.id = "mirage-stage";
stage.innerHTML = '<canvas class="m-ambient"></canvas><div class="m-grain"></div>';
document.body.prepend(stage);

let lastHaze = "";
const listeners = [];
// dust.js meldet sich hier an (umgekehrter Import wäre ein Kreis beim Laden der Module)
const onHaze = (fn) => listeners.push(fn);

function showHaze(src) {
  if (!src || src === lastHaze) return;
  lastHaze = src;
  for (const fn of listeners) fn(src);
  immersive.setHaze(src);
}

export { stage, showHaze, lastHaze, onHaze };
