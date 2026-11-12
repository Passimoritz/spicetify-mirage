/* ---------------------------------------------------------------- Obergrenze für Blitze */
// Fotosensible Epilepsie: mehr als drei Blitze pro Sekunde gelten als riskant (WCAG 2.3.1). Darum gibt es
// eine einzige Schranke, durch die jeder Blitz der Show muss – egal wie hoch die Stärke steht.
// Der Mindestabstand von 0,34 s lässt in jedem Fenster von einer Sekunde höchstens drei Blitze zu.
const FLASH_GAP = 0.34;
function createFlashCap(gap = FLASH_GAP) {
  let last = -Infinity;
  return {
    // true = dieser Blitz darf zünden (und zählt ab jetzt)
    take(t) {
      // Uhr sprang zurück (neuer Song, neuer Thread): lieber einen Blitz auslassen als einen zu viel
      if (t < last) last = t;
      if (t - last < gap) return false;
      last = t;
      return true;
    },
    free: (t) => t >= last && t - last >= gap,
  };
}

export { createFlashCap, FLASH_GAP };
