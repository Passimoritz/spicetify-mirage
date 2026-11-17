// Wörterbuch der Wortbilder: je Sprache die gängigen Formen von rund 75 Begriffen (Feuer, Regen, Herz …)
// und häufige Füllwörter zur Spracherkennung. Die Listen liegen als JSON daneben (lexicon/), esbuild bettet
// sie beim Bauen ins Theme ein. Format: { "<sprache>": { "stop": "a|b|…", "c": { "<begriff>": "form|form|stamm*" } } }
// lex-scen.json ergänzt die Begriffe der Szenarien (Bass, Hände hoch, Anfeuern, verrückt, weitere Farben) und
// weitere Formen bestehender Begriffe – sie werden an die vorhandenen angehängt, nicht ersetzt.
import A from "./lexicon/lex-a.json";
import B from "./lexicon/lex-b.json";
import C from "./lexicon/lex-c.json";
import S from "./lexicon/lex-scen.json";

const LEX = { ...A, ...B, ...C };
for (const [lang, d] of Object.entries(S)) {
  const base = LEX[lang] ? { ...LEX[lang], c: { ...LEX[lang].c } } : { stop: "", c: {} };
  for (const [k, forms] of Object.entries(d.c)) base.c[k] = base.c[k] ? base.c[k] + "|" + forms : forms;
  LEX[lang] = base;
}

export { LEX };
