/* ---------------------------------------------------------------- Namen der Spielarten für Menüs und Anzeigen */
// genreName("emo") → „Emo“, familyName("urban") → „Hip-Hop & R&B“, detectedLabel(party.info) → „Erkannt: Emo (Rock)“.
// Ohne Sprache: die der App. Die Rechnung steht in genre-label.js (testbar ohne Spotify).
import { I18N, LANG } from "./i18n.js";
import { namesFrom } from "./genre-label.js";

const { genreName, familyName, detectedLabel } = namesFrom(I18N, LANG);

export { genreName, familyName, detectedLabel };
