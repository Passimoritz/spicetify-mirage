/* ---------------------------------------------------------------- Namen der Spielarten (rein rechnend) */
// „Erkannt: Emo (Rock)“ aus einer Texttabelle je Sprache ({ en: {...}, de: {...} }, wie I18N in i18n.js) –
// ohne Spotify und ohne Fenster, darum auch in den Unit-Tests. genre-name.js bindet sie an die echten Texte.
import { familyOf } from "./genres.js";

function namesFrom(I18N, defLang = "en") {
  const text = (k, lang) => (I18N[lang] || I18N[defLang] || I18N.en)[k] ?? I18N.en?.[k];
  // Name einer Spielart („emo“ → „Emo“); unbekannt: der Schlüssel selbst
  const genreName = (key, lang = defLang) => text("party_" + key, lang) ?? String(key || "");
  // Name einer Familie („rock“ → „Rock“, „urban“ → „Hip-Hop & R&B“)
  const familyName = (fam, lang = defLang) => text("fam_" + fam, lang) ?? String(fam || "");
  // Zeile für party.info (oder jedes {key, family, manual}): „Erkannt: Emo (Rock)“, eigene Festlegung mit Zusatz
  function detectedLabel(info, lang = defLang) {
    if (!info?.key) return "";
    const fam = info.family || familyOf(info.key);
    const g = genreName(info.key, lang), f = fam ? familyName(fam, lang) : "";
    // „Rock (Rock)“ wäre doppelt: dann ohne Klammer
    let tpl = text("genreDetected", lang) || "{g} ({f})";
    if (!f || f === g) tpl = tpl.replace(/\s*\(\{f\}\)/, "");
    const line = tpl.replace("{g}", g).replace("{f}", f);
    return info.manual ? `${line} · ${text("genreManualTag", lang) || "manual"}` : line;
  }
  return { genreName, familyName, detectedLabel };
}

export { namesFrom };
