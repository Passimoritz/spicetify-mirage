// Wortbilder für die Live-Seite der Handys (docs/live): dieselben Bilder wie im Party-Modus, aber ohne
// Wörterbuch – welcher Begriff gerade gesungen wird, schickt der PC mit. Gebaut nach docs/live/fx.js.
import { createWordFx, glowOf } from "./words.js";

window.MirageFx = { create: () => createWordFx(null), glowOf };
