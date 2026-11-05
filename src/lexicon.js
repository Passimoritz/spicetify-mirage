// Wörterbuch der Wortbilder: je Sprache die gängigen Formen von rund 70 Begriffen (Feuer, Regen, Herz …)
// und häufige Füllwörter zur Spracherkennung. Die Listen liegen als JSON daneben (lexicon/), esbuild bettet
// sie beim Bauen ins Theme ein. Format: { "<sprache>": { "stop": "a|b|…", "c": { "<begriff>": "form|form|stamm*" } } }
import A from "./lexicon/lex-a.json";
import B from "./lexicon/lex-b.json";
import C from "./lexicon/lex-c.json";

const LEX = { ...A, ...B, ...C };

export { LEX };
