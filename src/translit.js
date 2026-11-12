/* ---------------------------------------------------------------- Lautschrift aus Tabellen */
// Kyrillisch (Russisch, Ukrainisch, Bulgarisch, Serbisch/Mazedonisch), Griechisch und Devanagari (Hindi) in
// lateinische Buchstaben – nur mit Tabellen und ein paar Regeln, ohne Wörterbuch und ohne Netz.
// Ziel ist Mitsingen, nicht Bibliotheksnorm: „щ“ wird „shch“, griechisches „ει“ wird „i“.
// Arabisch und Thai fehlen mit Absicht: Arabisch schreibt die kurzen Vokale nicht („mrhb“ kann niemand
// singen), Thai braucht Silben- und Worttrennung, die eine Tabelle nicht leistet. Beides wäre irreführend.
const CYR = /\p{Script=Cyrillic}/u, GREEK = /\p{Script=Greek}/u, DEVA = /\p{Script=Devanagari}/u;
const isUpper = (ch) => !!ch && ch !== ch.toLowerCase();
// Großschreibung übernehmen: „Щ“ → „Shch“, in einem Wort aus Großbuchstaben → „SHCH“
function cased(r, chars, i) {
  if (!r || !isUpper(chars[i])) return r;
  const next = chars[i + 1], prev = chars[i - 1];
  return isUpper(next) || (isUpper(prev) && !(next && /\p{Ll}/u.test(next))) ? r.toUpperCase() : r[0].toUpperCase() + r.slice(1);
}

/* ---- Kyrillisch */
const RU = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p",
  р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya", ў: "u", і: "i",
};
const CYR_TABLE = {
  ru: RU,
  // Ukrainisch: г = h, и = y, і = i; der Apostroph trennt nur
  uk: { ...RU, г: "h", ґ: "g", є: "ye", и: "y", і: "i", ї: "yi", "'": "", "’": "", ʼ: "" },
  // Bulgarisch: ъ ist ein Vokal, щ = sht
  bg: { ...RU, щ: "sht", ъ: "a", х: "h", ь: "y" },
  // Serbisch (und Mazedonisch): die amtliche Lateinschrift, Buchstabe für Buchstabe
  sr: { ...RU, ж: "ž", ч: "č", ш: "š", ћ: "ć", ђ: "đ", џ: "dž", љ: "lj", њ: "nj", ј: "j", х: "h", ц: "c", ѓ: "gj", ќ: "kj", ѕ: "dz" },
};
const CYR_CONS = /[бвгґджзклмнпрстфхцчшщ]/;
// Welche Sprache? Erst die Angabe der Liedtext-Quelle, sonst an den Buchstaben, die nur eine Sprache hat
function cyrLang(text, hint) {
  const h = String(hint || "").slice(0, 2).toLowerCase();
  if (h === "mk") return "sr";
  if (CYR_TABLE[h]) return h;
  const s = String(text || "").toLowerCase();
  if (/[јљњћђџѓќѕ]/.test(s)) return "sr";
  if (/[іїєґ]/.test(s) && !/[ыэъ]/.test(s)) return "uk";
  // Russisch kennt ъ nur vor е, ё, ю, я – zwischen Konsonanten oder am Wortende ist es Bulgarisch
  if (/ъ(?![еёюя])/.test(s) && !/[ыэё]/.test(s)) return "bg";
  return "ru";
}
function cyrillic(s, lang) {
  const table = CYR_TABLE[lang] || RU, chars = [...s];
  let out = "";
  for (let i = 0; i < chars.length; i++) {
    const low = chars[i].toLowerCase();
    let r = table[low];
    if (r == null) {
      out += chars[i];
      continue;
    }
    // Russisch: е klingt am Wortanfang, nach Vokal und nach ъ/ь wie „ye“
    if (lang === "ru" && low === "е" && !CYR_CONS.test((chars[i - 1] || "").toLowerCase())) r = "ye";
    out += cased(r, chars, i);
  }
  // „красивый“ → „krasivy“ statt „krasivyy“
  return out.replace(/yy\b/g, "y").replace(/YY\b/g, "Y");
}

/* ---- Griechisch (Neugriechisch, nach der Aussprache) */
const GR = {
  α: "a", β: "v", γ: "g", δ: "d", ε: "e", ζ: "z", η: "i", θ: "th", ι: "i", κ: "k", λ: "l", μ: "m", ν: "n", ξ: "x", ο: "o", π: "p", ρ: "r",
  σ: "s", ς: "s", τ: "t", υ: "y", φ: "f", χ: "ch", ψ: "ps", ω: "o",
};
const GR_PAIR = { αι: "e", ει: "i", οι: "i", υι: "i", ου: "ou", γγ: "ng", γξ: "nx", γχ: "nch", τσ: "ts", τζ: "tz" };
const GR_VOICELESS = /[θκξπσςτφχψ]/, GR_LETTER = /[α-ω]/;
function greek(s) {
  // Akzent abtrennen: Tonos fällt weg, merkt sich aber die Stelle (ein Akzent auf dem ersten Vokal oder ein
  // Trema auf dem zweiten heißt: zwei getrennte Vokale, kein Doppellaut)
  const cs = [];
  for (const ch of s.normalize("NFD")) {
    if (/[̀́͂̓̔ͅ]/.test(ch)) {
      if (cs.length) cs[cs.length - 1].acc = true;
    } else if (ch === "̈") {
      if (cs.length) cs[cs.length - 1].dia = true;
    } else cs.push({ ch, low: ch.toLowerCase() });
  }
  const chars = cs.map((c) => c.ch);
  let out = "";
  for (let i = 0; i < cs.length; i++) {
    const a = cs[i], b = cs[i + 1], two = b ? a.low + b.low : "";
    const start = !cs[i - 1] || !GR_LETTER.test(cs[i - 1].low);
    let r = GR[a.low], used = 1;
    if (r == null) {
      out += a.ch;
      continue;
    }
    if (b && !a.acc && !b.dia) {
      if (GR_PAIR[two]) [r, used] = [GR_PAIR[two], 2];
      // αυ, ευ, ηυ: „av/ev/iv“, vor stimmlosen Lauten und am Wortende „af/ef/if“
      else if (b.low === "υ" && "αεη".includes(a.low)) {
        const after = cs[i + 2]?.low || "";
        [r, used] = [GR[a.low] + (!GR_LETTER.test(after) || GR_VOICELESS.test(after) ? "f" : "v"), 2];
      }
      // μπ, ντ, γκ: am Wortanfang b, d, g – im Wort mit Nasal
      else if (two === "μπ") [r, used] = [start ? "b" : "mb", 2];
      else if (two === "ντ") [r, used] = [start ? "d" : "nd", 2];
      else if (two === "γκ") [r, used] = [start ? "g" : "ng", 2];
    }
    out += cased(r, chars, i);
    i += used - 1;
  }
  return out;
}

/* ---- Devanagari (Hindi) */
const DV_C = {
  क: "k", ख: "kh", ग: "g", घ: "gh", ङ: "n", च: "ch", छ: "chh", ज: "j", झ: "jh", ञ: "n", ट: "t", ठ: "th", ड: "d", ढ: "dh", ण: "n",
  त: "t", थ: "th", द: "d", ध: "dh", न: "n", प: "p", फ: "ph", ब: "b", भ: "bh", म: "m", य: "y", र: "r", ल: "l", व: "v", श: "sh", ष: "sh",
  स: "s", ह: "h", ळ: "l",
};
// Punkt unter dem Buchstaben (Nukta): Laute aus dem Persischen und die „geflappten“ ड़/ढ़
const DV_NUKTA = { क: "q", ख: "kh", ग: "gh", ज: "z", ड: "r", ढ: "rh", फ: "f" };
const DV_V = { अ: "a", आ: "ā", इ: "i", ई: "ī", उ: "u", ऊ: "ū", ऋ: "ri", ए: "e", ऐ: "ai", ओ: "o", औ: "au", ऑ: "o", ऍ: "e" };
const DV_M = { "ा": "ā", "ि": "i", "ी": "ī", "ु": "u", "ू": "ū", "ृ": "ri", "े": "e", "ै": "ai", "ो": "o", "ौ": "au", "ॉ": "o", "ॅ": "e" };
const VIRAMA = "्", NUKTA = "़", LABIAL = /^(p|ph|b|bh|m)$/;
function devaWord(w) {
  // Silben: Konsonant + Vokal. v === null heißt „mitgesprochenes a“ (steht nicht da), v === "" heißt keiner (Virama)
  const u = [], cs = [...w];
  for (let i = 0; i < cs.length; i++) {
    const ch = cs[i], last = u[u.length - 1];
    if (DV_C[ch]) {
      let c = DV_C[ch];
      if (cs[i + 1] === NUKTA) {
        c = DV_NUKTA[ch] || c;
        i++;
      }
      // ज्ञ spricht Hindi „gy“
      if (ch === "ज" && cs[i + 1] === VIRAMA && cs[i + 2] === "ञ") {
        c = "gy";
        i += 2;
      }
      const unit = { c, v: null, tail: "" };
      if (cs[i + 1] === VIRAMA) {
        unit.v = "";
        i++;
      } else if (DV_M[cs[i + 1]] != null) unit.v = DV_M[cs[++i]];
      u.push(unit);
    } else if (DV_V[ch]) u.push({ c: "", v: DV_V[ch], tail: "" });
    // Nasal: vor p/b/m ein m, sonst n · Hauchlaut am Ende
    else if (ch === "ं" || ch === "ँ") last && (last.tail += LABIAL.test(DV_C[cs[i + 1]] || "") ? "m" : "n");
    else if (ch === "ः") last && (last.tail += "h");
  }
  // Das mitgesprochene a fällt im Hindi oft weg: am Wortende („दिल“ = dil) und zwischen Vokal+Konsonant und
  // Konsonant+Vokal („करना“ = karnā). Von hinten nach vorn, damit nie zwei Silben nacheinander ihr a verlieren.
  const n = u.length, cut = new Array(n).fill(false);
  const hasVowel = (i) => u[i].v !== "" && !cut[i];
  if (n > 1 && u[n - 1].v === null && !u[n - 1].tail && u[n - 2].v !== "") cut[n - 1] = true;
  for (let i = n - 2; i > 0; i--) {
    if (u[i].v !== null || u[i].tail) continue;
    const prev = u[i - 1], next = u[i + 1];
    if (prev.v !== "" && !prev.tail && next.c && hasVowel(i + 1)) cut[i] = true;
  }
  return u.map((x, i) => x.c + (x.v === null ? (cut[i] ? "" : "a") : x.v) + x.tail).join("");
}
const DV_DIGIT = "०१२३४५६७८९";
function devanagari(s) {
  // NFD trennt die fertig zusammengesetzten Nukta-Buchstaben (क़ …) in Buchstabe + Punkt
  return s
    .normalize("NFD")
    .replace(/[ऀ-ॣॱ-ॿ]+/g, devaWord)
    .replace(/[०-९]/g, (d) => String(DV_DIGIT.indexOf(d)))
    .replace(/[।॥]/g, ".");
}

// script: „cyr“, „el“ oder „hi“ · lang: Sprachangabe der Liedtext-Quelle (nur für Kyrillisch nötig)
// Zeilen ohne diese Schrift bleiben leer (dann gibt es dort keine Lautschrift-Zeile)
function translitLines(script, texts, lang) {
  if (script === "cyr") {
    const l = cyrLang(texts.join("\n"), lang);
    return texts.map((s) => (CYR.test(s) ? cyrillic(s, l) : ""));
  }
  if (script === "el") return texts.map((s) => (GREEK.test(s) ? greek(s) : ""));
  if (script === "hi") return texts.map((s) => (DEVA.test(s) ? devanagari(s) : ""));
  return null;
}

export { translitLines, cyrillic, cyrLang, greek, devanagari, CYR, GREEK, DEVA };
