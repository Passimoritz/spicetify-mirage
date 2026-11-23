// Wörterbuch der Wortbilder: je Sprache die gängigen Formen von rund 200 Begriffen (Feuer, Regen, Herz, Club,
// Sehnsucht, Wüste …) und häufige Füllwörter zur Spracherkennung. Die Listen liegen als JSON daneben (lexicon/),
// esbuild bettet sie beim Bauen ins Theme ein. Format: { "<sprache>": { "stop": "a|b|…", "c": { "<begriff>": "form|form|stamm*" } } }
// lex-scen.json ergänzt die Begriffe der Szenarien (Bass, Hände hoch, Anfeuern, verrückt, weitere Farben) und
// weitere Formen bestehender Begriffe – sie werden an die vorhandenen angehängt, nicht ersetzt.
// lex-more.json bringt die neuen Bereiche (Nachtleben, Geld und Luxus, Körper und Bewegung, Gefühle, Orte und
// Zeiten, Rufe …), lex-explicit.json die derben Wörter (nie als Text gezeigt, nur Licht und Stimmung).
// Eine Form, die ein neuer Begriff übernimmt („midnight“ war bei night, „streets“ bei city), verlässt dabei den alten.
// lex-neg.json: Verneinungen je Sprache (davor: neg, danach: negPost) für wordsense.js.
import A from "./lexicon/lex-a.json";
import B from "./lexicon/lex-b.json";
import C from "./lexicon/lex-c.json";
import S from "./lexicon/lex-scen.json";
import M from "./lexicon/lex-more.json";
import X from "./lexicon/lex-explicit.json";
import N from "./lexicon/lex-neg.json";
// lex-ext.json: rund 200 weitere Begriffe der Szenarien (Konfetti, Nordlicht, Disko, Skyline, Glitch, Lob-Wörter …)
// und Zusatzformen bestehender Begriffe – nur Formen, die es in der Sprache noch nicht gab, darum einfach angehängt
import E from "./lexicon/lex-ext.json";
// lex-ext2.json: noch einmal rund 180 Begriffe (Waffen und Gewalt aus Rap/Rock/Metal – nur Licht, nie Text –,
// Tiere, Essen, Körper, Gefühle, Klänge, Technik, Mythen, Farben …), ebenso nur neue Formen
import E2 from "./lexicon/lex-ext2.json";

const LEX = { ...A, ...B, ...C };
for (const [lang, d] of [...Object.entries(S), ...Object.entries(E), ...Object.entries(E2)]) {
  const base = LEX[lang] ? { ...LEX[lang], c: { ...LEX[lang].c } } : { stop: "", c: {} };
  for (const [k, forms] of Object.entries(d.c)) base.c[k] = base.c[k] ? base.c[k] + "|" + forms : forms;
  LEX[lang] = base;
}
// neue Begriffe: übernommene Formen aus den alten Begriffen derselben Sprache streichen
for (const src of [M, X]) {
  for (const [lang, d] of Object.entries(src)) {
    const base = LEX[lang] ? { ...LEX[lang], c: { ...LEX[lang].c } } : { stop: "", c: {} };
    const taken = new Set();
    for (const forms of Object.values(d.c)) for (const f of forms.split("|")) taken.add(f);
    for (const [k, forms] of Object.entries(base.c)) {
      const keep = forms.split("|").filter((f) => !taken.has(f));
      base.c[k] = keep.join("|");
    }
    for (const [k, forms] of Object.entries(d.c)) base.c[k] = base.c[k] ? base.c[k] + "|" + forms : forms;
    LEX[lang] = base;
  }
}
// Verneinungen je Sprache: { neg: Set (davor), post: Set (danach) }
const NEG = {};
for (const [lang, d] of Object.entries(N)) {
  const sp = (s) => new Set(String(s || "").split("|").map((w) => w.trim().toLocaleLowerCase()).filter(Boolean));
  NEG[lang] = { neg: sp(d.neg), post: sp(d.negPost) };
}

export { LEX, NEG };
