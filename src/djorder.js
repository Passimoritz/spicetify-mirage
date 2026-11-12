/* ---------------------------------------------------------------- DJ: Passung und Reihenfolge */
// Reine Rechnung ohne Spotify – darum einzeln testbar (tests/unit/djorder.test.js).
// info = { bpm, loud, cam } (cam = Camelot-Zahl mit A/B, z. B. „8A“)

/* ---- Wie gut passt b auf a? 0..1 aus Tonart, Tempo und Energie */
function camDist(a, b) {
  if (!a || !b) return 3;
  const na = parseInt(a, 10), nb = parseInt(b, 10), la = a.slice(-1), lb = b.slice(-1);
  const d = Math.min((na - nb + 12) % 12, (nb - na + 12) % 12);
  if (d === 0 && la === lb) return 0;
  if (d === 0) return 1; // Paralleltonart (8A ↔ 8B)
  if (d === 1 && la === lb) return 1; // Nachbar im Quintenzirkel
  if (d === 2 && la === lb) return 2;
  return 3;
}
function fit(a, b) {
  if (!a || !b) return 0;
  const harm = [1, 0.85, 0.45, 0.12][camDist(a.cam, b.cam)];
  // Tempo: gleich, halb oder doppelt – bis 8 % Abweichung lässt sich angleichen
  const r = b.bpm / a.bpm, dev = Math.min(Math.abs(r - 1), Math.abs(r * 2 - 1), Math.abs(r / 2 - 1));
  const tempo = Math.max(0, 1 - dev / 0.08);
  // Energie: ähnlich laut, leicht steigend ist am besten
  const dl = b.loud - a.loud, energy = Math.max(0, 1 - Math.abs(dl - 0.5) / 6);
  return harm * 0.45 + tempo * 0.35 + energy * 0.2;
}

/* ---- Reihenfolge der nächsten Songs */
// Energiekurve eines Sets: steigt bis zum Höhepunkt bei etwa 70 % und lässt danach etwas nach
const curve = (p) => (p < 0.7 ? 0.25 + 0.75 * (p / 0.7) : 1 - 0.5 * ((p - 0.7) / 0.3));
// Wie gut schließen die Songs aneinander an? Mittel aller Übergänge (ab dem laufenden Song), 0..1
function chainScore(cur, infos) {
  let sum = 0, n = 0, prev = cur;
  for (const i of infos) {
    if (!i) continue;
    if (prev) {
      sum += fit(prev, i);
      n++;
    }
    prev = i;
  }
  return n ? sum / n : 0;
}
// cur = laufender Song (oder null), infos = Daten der nächsten Songs in jetziger Reihenfolge (null = unbekannt).
// Ergebnis: die neue Reihenfolge als Liste der alten Plätze. Erst eine Kette: immer der Song, der am besten an
// den vorigen anschließt (Tonart, Tempo) und zur Stelle auf der Energiekurve passt. Dann nachbessern: einzelne
// Songs an die Stelle rücken, an der das Ganze am besten wird (die Kette allein lässt gern einen passenden Song
// liegen). Songs ohne Daten bleiben hinten, in ihrer alten Reihenfolge. Wird es nicht besser, bleibt alles, wie es ist.
function orderQueue(cur, infos) {
  const same = infos.map((_, i) => i);
  const known = same.filter((i) => infos[i]), unknown = same.filter((i) => !infos[i]);
  if (known.length < 2) return same;
  // Lautheit als Rang 0..1 innerhalb dieser Songs (die absoluten Werte liegen oft eng beieinander)
  const byLoud = known.slice().sort((a, b) => infos[a].loud - infos[b].loud || a - b);
  const energy = new Map(byLoud.map((i, r) => [i, r / (byLoud.length - 1)]));
  const left = known.slice(), out = [];
  let prev = cur || null;
  while (left.length) {
    const p = out.length / (known.length - 1);
    let best = 0, bestS = -1;
    left.forEach((i, k) => {
      const s = (prev ? fit(prev, infos[i]) * 0.75 : 0) + (1 - Math.abs(energy.get(i) - curve(p))) * 0.25;
      // bei Gleichstand gewinnt, wer ohnehin früher dran war
      if (s > bestS + 1e-9) [best, bestS] = [k, s];
    });
    const i = left.splice(best, 1)[0];
    out.push(i);
    prev = infos[i];
  }
  // Güte einer Reihenfolge: Übergänge zu drei Vierteln, Energiekurve zu einem Viertel
  const quality = (list) => {
    const shape = list.reduce((s, i, k) => s + 1 - Math.abs(energy.get(i) - curve(k / (list.length - 1))), 0) / list.length;
    return chainScore(cur, list.map((i) => infos[i])) * 0.75 + shape * 0.25;
  };
  let q = quality(out);
  for (let round = 0, moved = true; moved && round < 8; round++) {
    moved = false;
    for (let from = 0; from < out.length; from++) {
      for (let to = 0; to < out.length; to++) {
        if (to === from) continue;
        const trial = out.slice();
        trial.splice(to, 0, trial.splice(from, 1)[0]);
        const tq = quality(trial);
        if (tq > q + 1e-9) {
          out.splice(0, out.length, ...trial);
          q = tq;
          moved = true;
        }
      }
    }
  }
  const next = [...out, ...unknown];
  return chainScore(cur, next.map((i) => infos[i])) > chainScore(cur, infos) + 0.005 ? next : same;
}

/* ---- Verschieben in Spotifys Warteschlange */
// Spotifys reorderQueue(songs, { before: x }) nimmt die genannten Songs heraus und setzt sie in genau dieser
// Reihenfolge vor x; x selbst darf nicht dabei sein. Ein Song ist derselbe, wenn die uid stimmt (ohne uid: die Adresse).
const sameRef = (a, b) => (a.uid && b.uid ? a.uid === b.uid : a.uri === b.uri);
// now = Warteschlange jetzt, refs = gewünschte Reihenfolge des Blocks, anchor = was nach dem Block kommt (oder null).
// Ergebnis: was zu verschieben ist und wovor – oder null, wenn es nichts zu ordnen gibt.
function planMove(now, refs, anchor) {
  // Songs, die inzwischen gelaufen sind, fehlen einfach
  const live = refs.filter((r) => now.some((n) => sameRef(r, n)));
  if (live.length < 2) return null;
  const at = anchor && now.some((n) => sameRef(anchor, n)) && !live.some((r) => sameRef(r, anchor)) ? anchor : null;
  // ohne Song dahinter: alle vor den, der zuletzt kommen soll
  return { live, move: at ? live : live.slice(0, -1), before: at || live[live.length - 1] };
}

export { camDist, fit, orderQueue, chainScore, sameRef, planMove };
