/* ---------------------------------------------------------------- Regie-Plan außerhalb des Bildes */
// Song-Karte (songmap.js) und Regie-Plan (director.js) kosten je Song einige zehn Millisekunden. Früher rechnete
// party.step() sie im ersten Bild nach dem Eintreffen der Taktdaten (oder des Liedtexts) – ein sichtbarer Hänger.
// Jetzt gibt get() sofort zurück, was fertig ist, und lässt das Neue in einer Leerlaufzeit rechnen. Bis dahin
// bleibt beim selben Song der bisherige Stand (alte Taktdaten, alter Plan); ein neuer Song läuft kurz neutral.
//
// Beim Tausch sagt fade (Sekunden), wie weich der Look hinübergleitet:
//  neuer Song oder anderer Stil 0,6 (wie bisher) · bessere Taktdaten zum selben Song 1,5 (Schätzung → genauer) ·
//  nur der Liedtext kam dazu: 0, wenn er am Look nichts ändert (kein zweites Überblenden), sonst 1,5

// Fingerabdruck des Looks: Art und Stimmung je Teil und die (gerundeten) Lichtwerte
function lookOf(plan) {
  if (!plan?.parts) return "";
  return plan.parts
    .map((p) => [p.kind, p.emo?.name || "", Math.round(p.t0 * 4), ...Object.values(p.look || {}).map((v) => Math.round(Number(v) * 50))].join(":"))
    .join("|");
}
// fade beim Wechsel von prev zu next (beide { d, key, uri, ln, plan })
function fadeFor(prev, next, look = lookOf) {
  if (!prev || prev.uri !== next.uri || prev.key !== next.key) return 0.6;
  if (prev.d !== next.d) return 1.5;
  return look(prev.plan) === look(next.plan) ? 0 : 1.5;
}
const EMPTY = Object.freeze({ d: null, plan: null, map: null, fade: 0.6, uri: "" });

// build(d, key, ln) → { map, plan } (teuer) · schedule(fn) → fn später ausführen (Leerlauf)
function createPlanSwap({ build, schedule, look = lookOf }) {
  let ready = null, want = null, queued = false;
  const is = (a, d, key, uri, ln) => !!a && a.d === d && a.key === key && a.uri === uri && a.ln === ln;
  function run() {
    queued = false;
    const w = want;
    if (!w || is(ready, w.d, w.key, w.uri, w.ln)) return;
    let out = null;
    try {
      out = build(w.d, w.key, w.ln, w.uri);
    } catch {}
    const next = { ...w, plan: out?.plan ?? null, map: out?.map ?? null };
    next.fade = fadeFor(ready, next, look);
    ready = next;
  }
  // d: aktuelle Taktdaten des Songs (oder null) · key: Stil (+ Schalter) · ln: Stand des Liedtexts
  function get(d, key, uri, ln) {
    if (!d) {
      want = null;
      return EMPTY;
    }
    if (is(ready, d, key, uri, ln)) return ready;
    if (!is(want, d, key, uri, ln)) want = { d, key, uri, ln };
    if (!queued) {
      queued = true;
      schedule(run);
    }
    return ready && ready.uri === uri ? ready : EMPTY;
  }
  return { get, reset: () => ((ready = want = null), undefined) };
}

export { createPlanSwap, fadeFor, lookOf, EMPTY };
