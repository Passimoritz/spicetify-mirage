/* ---------------------------------------------------------------- Liedtext-Formate lesen */
// LRC (auch mit Wortzeiten), NetEase-YRC und TTML (AMLL-Sammlung, Wort für Wort). Ohne Fenster: einzeln
// testbar (tests/unit/lyricparse.test.js). Ergebnis je Zeile: { t, text, words?: [{ t, d, text, sp }], who? }

// Wörter zu einer Zeile: Leerzeichen nur, wo der Text eines hat – oder zwischen zwei lateinischen Wörtern,
// die NetEase manchmal ohne Abstand liefert („how(…)to“). Chinesisch/Japanisch bleibt ohne Abstände.
function wordLine(t, words) {
  const latin = /[\p{Script=Latin}\p{Script=Cyrillic}\p{Script=Greek}\d]/u;
  const list = words.map((w, i) => {
    const txt = w.raw.trim();
    const next = words[i + 1]?.raw.trim() || "";
    const sp = i < words.length - 1 && (/\s$/.test(w.raw) || /^\s/.test(words[i + 1].raw) || (latin.test(txt.slice(-1)) && latin.test(next.charAt(0))));
    return { t: w.t, d: w.d, text: txt, sp };
  }).filter((w) => w.text);
  return { t, text: list.map((w) => w.text + (w.sp ? " " : "")).join("").trim() || "♪", words: list };
}

// „[01:02.34] Text“ – eine Zeile darf mehrere Zeitmarken tragen (Refrain). „[offset:+300]“ heißt laut LRC:
// alles 300 ms früher zeigen – das beachten viele Quellen (Kugou setzt es), Mirage bisher nicht
const lrcMs = (m, sec) => Math.round((Number(m) * 60 + Number(String(sec).replace(":", "."))) * 1000);
function parseLrc(lrc) {
  const out = [];
  const off = Number(/^\s*\[offset:\s*([+-]?\d+)\s*\]/im.exec(lrc || "")?.[1]) || 0;
  for (const row of String(lrc || "").split(/\r?\n/)) {
    const marks = [...row.matchAll(/\[(\d+):(\d+(?:[.:]\d+)?)\]/g)];
    // Enhanced LRC: Wortzeiten in spitzen Klammern
    if (marks.length === 1 && /<\d+:\d+(?:\.\d+)?>/.test(row)) {
      const body = row.slice(marks[0].index + marks[0][0].length);
      const parts = [...body.matchAll(/<(\d+):(\d+(?:\.\d+)?)>([^<]*)/g)].map((m) => ({ t: lrcMs(m[1], m[2]) - off, raw: m[3] }));
      const words = parts.filter((w) => w.raw.trim()).map((w, i, a) => ({ ...w, d: Math.max(80, (a[i + 1]?.t ?? w.t + 600) - w.t) }));
      if (words.length) {
        out.push(wordLine(lrcMs(marks[0][1], marks[0][2]) - off, words));
        continue;
      }
    }
    if (!marks.length) continue;
    const text = row.slice(marks[marks.length - 1].index + marks[marks.length - 1][0].length).trim() || "♪";
    for (const m of marks) out.push({ t: Math.max(0, lrcMs(m[1], m[2]) - off), text });
  }
  return out.sort((a, b) => a.t - b.t);
}

// NetEase-YRC: „[Start,Dauer](Start,Dauer,0)Wort (Start,Dauer,0)Wort …“ – Zeilen mit „{…}“ sind Mitwirkende
function parseYrc(text) {
  const out = [];
  for (const row of String(text || "").split(/\r?\n/)) {
    const head = /^\[(\d+),(\d+)\]/.exec(row);
    if (!head) continue;
    const words = [];
    for (const m of row.slice(head[0].length).matchAll(/\((\d+),(\d+),\d+\)([^(]*)/g)) {
      if (!m[3]) continue;
      words.push({ t: Number(m[1]), d: Number(m[2]), raw: m[3] });
    }
    if (!words.length) continue;
    out.push(wordLine(Number(head[1]), words));
  }
  return out.sort((a, b) => a.t - b.t);
}

/* ---- TTML (AMLL-Sammlung, Apple-Music-Format) */
// „1:02.345“, „62.345“, „01:01:02.345“ oder „62.345s“ → ms
function ttmlMs(s) {
  const v = String(s || "").trim().replace(/s$/, "");
  if (!v) return NaN;
  const parts = v.split(":").map(Number);
  if (parts.some((x) => !Number.isFinite(x))) return NaN;
  return Math.round(parts.reduce((a, x) => a * 60 + x, 0) * 1000);
}
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const unxml = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (all, e) => (e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENT[e] ?? all));
const attr = (tag, name) => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];
// Je <p> eine Zeile, je <span begin end> ein Wort oder eine Silbe. Übersetzung und Lautschrift
// (ttm:role="x-translation"/"x-roman") fallen weg, Hintergrundgesang (x-bg) kommt in Klammern dazu.
function parseTtml(xml) {
  const out = [], agents = [];
  const body = String(xml || "").slice(Math.max(0, String(xml || "").indexOf("<body")));
  for (const pm of body.matchAll(/<p\b([^>]*)>([\s\S]*?)<\/p>/g)) {
    const words = [], stack = [];
    let skip = 0, bgOpen = false, cur = null;
    for (const m of pm[2].matchAll(/<span\b([^>]*?)(\/?)>|<\/span>|([^<]+)/g)) {
      if (m[0].startsWith("</")) {
        const top = stack.pop();
        if (top?.skip) skip--;
        if (top?.bg) bgOpen = false;
        if (top?.word) cur = null;
        continue;
      }
      if (m[0].startsWith("<span")) {
        const role = attr(m[1], "ttm:role") || "";
        const fr = { skip: /x-translation|x-roman/.test(role), bg: role === "x-bg", word: false };
        const b = ttmlMs(attr(m[1], "begin")), e = ttmlMs(attr(m[1], "end"));
        if (fr.skip) skip++;
        if (fr.bg) bgOpen = true;
        if (!fr.skip && !fr.bg && Number.isFinite(b) && !skip) {
          cur = { t: b, d: Math.max(40, (Number.isFinite(e) ? e : b + 300) - b), text: "", sp: false, bg: bgOpen };
          words.push(cur);
          fr.word = true;
        }
        if (m[2] !== "/") stack.push(fr);
        continue;
      }
      if (skip) continue;
      const txt = unxml(m[3]);
      if (cur) cur.text += txt;
      // Text zwischen den Wörtern: ein Leerzeichen trennt Wörter, sonst sind es Silben eines Worts
      else if (words.length && /\s/.test(txt)) words[words.length - 1].sp = true;
    }
    // Leerzeichen am Wortende (manche Dateien schreiben „<span>Look </span>“)
    for (const w of words) {
      if (/\s$/.test(w.text)) w.sp = true;
      w.text = w.text.trim();
    }
    const list = words.filter((w) => w.text);
    if (!list.length) continue;
    // Hintergrundgesang: von „(“ bis „)“ – so erkennt ihn auch die Karaoke-Anzeige
    list.forEach((w, i) => {
      if (!w.bg) return;
      // viele Dateien schreiben die Klammern schon selbst
      if (!list[i - 1]?.bg && !/^[(（]/.test(w.text)) w.text = "(" + w.text;
      if (!list[i + 1]?.bg && !/[)）]$/.test(w.text)) w.text += ")";
      if (!list[i - 1]?.bg && i > 0) list[i - 1].sp = true;
    });
    list[list.length - 1].sp = false;
    const begin = ttmlMs(attr(pm[1], "begin"));
    const agent = attr(pm[1], "ttm:agent") || "";
    if (agent && !agents.includes(agent)) agents.push(agent);
    out.push({
      t: Number.isFinite(begin) ? Math.min(begin, list[0].t) : list[0].t,
      text: list.map((w) => w.text + (w.sp ? " " : "")).join("").trim(),
      words: list.map(({ t, d, text, sp }) => ({ t, d, text, sp })),
      agent,
    });
  }
  // Duett: zwei oder mehr Stimmen bekommen ihre Farbe (1, 2, 3 wie bei den Namen vor den Zeilen)
  for (const l of out) {
    if (agents.length >= 2 && l.agent) l.who = String((agents.indexOf(l.agent) % 3) + 1);
    delete l.agent;
  }
  return out.sort((a, b) => a.t - b.t);
}

export { parseLrc, parseYrc, parseTtml, wordLine };
