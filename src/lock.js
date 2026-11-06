import { S } from "./core.js";
import { t } from "./i18n.js";

/* ---------------------------------------------------------------- Wiedergabe-Sperre */
// Läuft ein Spiel, das die Musik führt, darf niemand Songs weiterschalten oder spulen: sonst passt die Lösung nicht mehr.
export const lock = { on: false };
export const free = () => {
  if (!lock.on) return true;
  try {
    S.showNotification?.(t("gLocked"), false, 1500);
  } catch {}
  return false;
};
