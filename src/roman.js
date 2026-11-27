/* ---------------------------------------------------------------- Lautschrift */
// Unter Liedtexten in Koreanisch, Japanisch und Chinesisch eine Lautschrift in lateinischen Buchstaben:
// Koreanisch rechnet Mirage selbst aus den Silben aus (Revised Romanization, ohne Lautangleichungen),
// Japanisch kommt von NetEase (die haben Romaji zu vielen Songs) oder – bei reinem Kana – auch selbst,
// Chinesisch braucht ein Wörterbuch (pinyin-pro), das erst geladen wird, wenn wirklich chinesischer Text kommt.
// Kyrillisch, Griechisch und Hindi (Devanagari) rechnet translit.js aus Tabellen.
import { CYR, GREEK, DEVA } from "./translit.js";

const HAN = /\p{Script=Han}/u, KANA = /[぀-ヿ]/, HANGUL = /[가-힣]/;

// welche Schrift die Mehrheit der Zeilen trägt (Japanisch: Kana; Chinesisch: Han ohne Kana)
function scriptOf(lines) {
  const n = { ko: 0, ja: 0, zh: 0, cyr: 0, el: 0, hi: 0 };
  for (const l of lines || []) {
    const s = l.text || "";
    if (HANGUL.test(s)) n.ko++;
    else if (KANA.test(s)) n.ja++;
    else if (HAN.test(s)) n.zh++;
    else if (CYR.test(s)) n.cyr++;
    else if (GREEK.test(s)) n.el++;
    else if (DEVA.test(s)) n.hi++;
  }
  const best = Object.entries(n).sort((a, b) => b[1] - a[1])[0];
  // Japanisch hat oft auch reine Kanji-Zeilen: zählt zusammen
  if (n.ja && n.ja + n.zh >= (lines?.length || 1) * 0.3 && n.ja >= n.ko) return "ja";
  return best[1] >= (lines?.length || 1) * 0.3 ? best[0] : "";
}

/* ---- Koreanisch: Hangul-Silben zerlegen (Anlaut, Vokal, Auslaut) */
const L = ["g", "kk", "n", "d", "tt", "r", "m", "b", "pp", "s", "ss", "", "j", "jj", "ch", "k", "t", "p", "h"];
const V = ["a", "ae", "ya", "yae", "eo", "e", "yeo", "ye", "o", "wa", "wae", "oe", "yo", "u", "wo", "we", "wi", "yu", "eu", "ui", "i"];
const T = ["", "k", "k", "k", "n", "n", "n", "t", "l", "k", "m", "l", "l", "l", "p", "l", "m", "p", "p", "t", "t", "ng", "t", "t", "k", "t", "p", "t"];
function hangul(s) {
  let out = "";
  for (const ch of s) {
    const c = ch.codePointAt(0) - 0xac00;
    if (c < 0 || c > 11171) {
      out += ch;
      continue;
    }
    out += L[Math.floor(c / 588)] + V[Math.floor((c % 588) / 28)] + T[c % 28];
  }
  return out;
}

/* ---- Japanisch: Kana nach Hepburn (Kanji kann nur ein Wörterbuch – dann gibt es hier nichts) */
const KR = {
  あ: "a", い: "i", う: "u", え: "e", お: "o", か: "ka", き: "ki", く: "ku", け: "ke", こ: "ko", さ: "sa", し: "shi", す: "su", せ: "se", そ: "so",
  た: "ta", ち: "chi", つ: "tsu", て: "te", と: "to", な: "na", に: "ni", ぬ: "nu", ね: "ne", の: "no", は: "ha", ひ: "hi", ふ: "fu", へ: "he", ほ: "ho",
  ま: "ma", み: "mi", む: "mu", め: "me", も: "mo", や: "ya", ゆ: "yu", よ: "yo", ら: "ra", り: "ri", る: "ru", れ: "re", ろ: "ro", わ: "wa", ゐ: "i", ゑ: "e", を: "o", ん: "n",
  が: "ga", ぎ: "gi", ぐ: "gu", げ: "ge", ご: "go", ざ: "za", じ: "ji", ず: "zu", ぜ: "ze", ぞ: "zo", だ: "da", ぢ: "ji", づ: "zu", で: "de", ど: "do",
  ば: "ba", び: "bi", ぶ: "bu", べ: "be", ぼ: "bo", ぱ: "pa", ぴ: "pi", ぷ: "pu", ぺ: "pe", ぽ: "po", ゔ: "vu",
  ぁ: "a", ぃ: "i", ぅ: "u", ぇ: "e", ぉ: "o", ゃ: "ya", ゅ: "yu", ょ: "yo", ゎ: "wa",
};
const SMALL = { ゃ: "a", ゅ: "u", ょ: "o" };
function kana(s) {
  if (HAN.test(s) || !KANA.test(s)) return "";
  // Katakana → Hiragana (gleiche Laute, 0x60 tiefer)
  const h = [...s].map((ch) => (ch >= "ァ" && ch <= "ヶ" ? String.fromCodePoint(ch.codePointAt(0) - 0x60) : ch));
  let out = "", dbl = false;
  for (let i = 0; i < h.length; i++) {
    const ch = h[i], nx = h[i + 1];
    if (ch === "っ") {
      dbl = true;
      continue;
    }
    if (ch === "ー") {
      out += out.match(/[aeiou]$/)?.[0] || "";
      continue;
    }
    let r = KR[ch];
    if (r == null) {
      out += ch === "　" ? " " : ch;
      dbl = false;
      continue;
    }
    // きゃ → kya, しゃ → sha, ちゃ → cha, じゃ → ja
    if (SMALL[nx] && r.endsWith("i") && r.length > 1) {
      r = /^(sh|ch|j)/.test(r) ? r.slice(0, -1) + SMALL[nx] : r.slice(0, -1) + "y" + SMALL[nx];
      i++;
    }
    if (dbl) r = (r.startsWith("ch") ? "t" : r[0]) + r;
    dbl = false;
    out += r;
  }
  return out;
}

/* ---- Chinesisch: pinyin-pro (MIT) liegt dem Theme bei und läuft in einem eigenen Thread */
// Früher kam die Bibliothek zur Laufzeit von einem CDN und lief mitten in Spotifys Seite – ohne Prüfung des Inhalts,
// mit Zugriff auf alles, was die Seite kann. Jetzt bündelt tools/build.js sie als Text (wie den Thread der
// Party-Location); gestartet wird sie erst beim ersten chinesischen Liedtext, als Blob-Thread ohne Zugriff auf die
// Seite und ohne Netz. Der Thread beendet sich nach einer Minute ohne Arbeit selbst (das Wörterbuch braucht Speicher).
let pyWorker = null, pyUrl = "", pySeq = 0, pyIdle = 0;
const pyWait = new Map();
function pyStop(fail) {
  clearTimeout(pyIdle);
  pyWorker?.terminate();
  pyWorker = null;
  if (fail) {
    for (const done of pyWait.values()) done(null);
    pyWait.clear();
  }
}
function pinyinLines(texts) {
  return new Promise((done) => {
    try {
      if (typeof __PINYIN_WORKER__ !== "string" || !window.Worker) return done(null);
      if (!pyWorker) {
        pyUrl ||= URL.createObjectURL(new Blob([__PINYIN_WORKER__], { type: "text/javascript" }));
        pyWorker = new Worker(pyUrl);
        pyWorker.onmessage = (e) => {
          const cb = pyWait.get(e.data?.id);
          pyWait.delete(e.data?.id);
          cb?.(Array.isArray(e.data?.out) ? e.data.out : null);
        };
        pyWorker.onerror = () => pyStop(true);
      }
      const id = ++pySeq;
      // hängt der Thread, wartet der Liedtext nicht ewig auf die Umschrift
      const limit = setTimeout(() => pyWait.has(id) && (pyWait.delete(id), done(null)), 15000);
      pyWait.set(id, (out) => (clearTimeout(limit), done(out)));
      // nur Zeilen mit chinesischen Zeichen gehen hinüber, die übrigen bleiben leer
      pyWorker.postMessage({ id, texts: texts.map((s) => (HAN.test(s) ? String(s) : "")) });
      clearTimeout(pyIdle);
      pyIdle = setTimeout(() => !pyWait.size && pyStop(false), 60000);
    } catch {
      pyStop(true);
      done(null);
    }
  });
}

export { scriptOf, hangul, kana, pinyinLines };
