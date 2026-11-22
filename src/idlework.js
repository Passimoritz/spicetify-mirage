/* ---------------------------------------------------------------- Rechenarbeit in Häppchen */
// Lange Suchen (Tempo aus dem Liedtext, Regie-Plan) liefen früher am Stück – mitten im Bild ein Ruckler.
// Eine Generator-Funktion gibt mit `yield` zwischendurch Luft: runSync rechnet sie am Stück (Tests, Node),
// runIdle verteilt die Häppchen auf die Leerlaufzeiten des Browsers.
const hasIdle = () => typeof requestIdleCallback === "function";
// fn in der nächsten Leerlaufzeit (spätestens nach timeout ms)
function whenIdle(fn, timeout = 120) {
  if (hasIdle()) requestIdleCallback(() => fn(), { timeout });
  else setTimeout(fn, 0);
}
const idle = (timeout = 60) => new Promise((r) => whenIdle(r, timeout));
function runSync(g) {
  let r = g.next();
  while (!r.done) r = g.next();
  return r.value;
}
async function runIdle(g, timeout) {
  let r = g.next();
  while (!r.done) {
    await idle(timeout);
    r = g.next();
  }
  return r.value;
}

export { whenIdle, idle, runSync, runIdle };
