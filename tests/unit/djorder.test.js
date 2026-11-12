// node tests/unit/djorder.test.js
const assert = require("assert");
const { load } = require("./load.js");
const { camDist, fit, orderQueue, chainScore, planMove, sameRef } = load("djorder.js");

const T = (cam, bpm, loud = -8) => ({ cam, bpm, loud });

// Camelot-Abstand
assert.equal(camDist("8A", "8A"), 0);
assert.equal(camDist("8A", "8B"), 1);
assert.equal(camDist("8A", "9A"), 1);
assert.equal(camDist("12A", "1A"), 1, "das Rad schließt sich");
assert.equal(camDist("8A", "10A"), 2);
assert.equal(camDist("8A", "3B"), 3);
assert.equal(camDist("", "8A"), 3);
// Passung: gleiche Tonart und Tempo schlägt fremde Tonart; halbes/doppeltes Tempo zählt als gleich
assert.ok(fit(T("8A", 120), T("8A", 121)) > fit(T("8A", 120), T("3B", 121)));
assert.ok(fit(T("8A", 120), T("8A", 121)) > fit(T("8A", 120), T("8A", 140)));
assert.ok(Math.abs(fit(T("8A", 87), T("8A", 174)) - fit(T("8A", 87), T("8A", 87))) < 1e-9);
assert.equal(fit(null, T("8A", 120)), 0);

// Reihenfolge: ein wild gemischter Block wird zu einer Kette aus Nachbarn
const cur = T("8A", 122, -9);
const queue = [T("3B", 174, -5), T("9A", 124, -8), T("2A", 95, -11), T("8B", 121, -9), null, T("8A", 123, -8.5), T("10A", 126, -6), T("9B", 125, -7)];
const order = orderQueue(cur, queue);
assert.deepEqual(order.slice().sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6, 7], "jeder Song genau einmal");
assert.equal(order[order.length - 1], 4, "Song ohne Daten bleibt hinten");
assert.ok(chainScore(cur, order.map((i) => queue[i])) > chainScore(cur, queue) + 0.1, "die Übergänge passen deutlich besser");
// der erste Song schließt harmonisch und im Tempo an den laufenden an
assert.ok(camDist(cur.cam, queue[order[0]].cam) <= 1);
assert.ok(Math.abs(queue[order[0]].bpm - cur.bpm) <= 4);
// die Ausreißer (174 BPM in 3B, 95 BPM in 2A) stehen nicht mitten in der Kette aus 120er-Songs
const pos = (i) => order.indexOf(i);
const chain = [1, 3, 5, 6, 7].map(pos);
assert.ok(pos(0) < Math.min(...chain) || pos(0) > Math.max(...chain));
assert.ok(pos(2) < Math.min(...chain) || pos(2) > Math.max(...chain));
// gleiche Eingabe, gleiches Ergebnis
assert.deepEqual(orderQueue(cur, queue), order);

// eine schon gute Reihenfolge bleibt unangetastet
const good = [T("8A", 122, -9), T("8A", 123, -8.5), T("9A", 124, -8), T("9A", 125, -7.5)];
assert.deepEqual(orderQueue(cur, good), [0, 1, 2, 3]);
// zu wenig Daten: nichts ändern
assert.deepEqual(orderQueue(cur, [null, T("8A", 120), null]), [0, 1, 2]);
assert.deepEqual(orderQueue(cur, []), []);
// ohne Daten zum laufenden Song geht es trotzdem (Kette untereinander)
const o2 = orderQueue(null, queue);
assert.deepEqual(o2.slice().sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6, 7]);
assert.ok(chainScore(null, o2.map((i) => queue[i])) >= chainScore(null, queue));

// Energiekurve: bei gleicher Tonart und gleichem Tempo steht der lauteste Song weder ganz vorn noch ganz hinten
const flat = [T("8A", 120, -4), T("8A", 120, -12), T("8A", 120, -8), T("8A", 120, -10), T("8A", 120, -6)];
const o3 = orderQueue(T("8A", 120, -11), flat);
assert.ok(o3[0] === 1 || o3[0] === 3, "es beginnt ruhig");
assert.ok(o3.indexOf(0) >= 2 && o3.indexOf(0) < 4, "der Höhepunkt liegt hinten, aber nicht am Ende");
// ---- Verschieben: gegen Spotifys eigene Regel geprüft (aus dem Client abgeschrieben: reorderQueue in xpui-modules.js)
function spotifyReorder(tracks, list, loc) {
  const same = (a, t) => (a.uid && t.uid ? a.uid === t.uid : a.uri === t.uri);
  const o = list.find((e) => same(loc.after || loc.before, e));
  if (!o) return list;
  const s = [];
  tracks.forEach((e) => {
    const i = list.find((t) => same(e, t));
    i && s.push(i);
  });
  if (s.includes(o)) return list;
  const l = list.filter((e) => !s.includes(e)), u = l.indexOf(o);
  loc.after ? l.splice(u + 1, 0, ...s) : l.splice(u, 0, ...s);
  return l;
}
const R = (n) => ({ uri: "spotify:track:" + n, uid: "u" + n });
const names = (l) => l.map((x) => x.uri.split(":").pop()).join("");
const q0 = ["a", "b", "c", "d", "e"].map(R), delim = { uri: "spotify:delimiter", uid: "x" };
const apply = (list, refs, anchor) => {
  const plan = planMove(list, refs, anchor);
  return plan ? spotifyReorder(plan.move, list, { before: plan.before }) : list;
};
// Block a–d vor dem Song e neu ordnen
assert.equal(names(apply(q0, ["c", "a", "d", "b"].map(R), R("e"))), "cadbe");
// ganzer Rest der Warteschlange, nichts dahinter
assert.equal(names(apply(q0, ["e", "c", "a", "d", "b"].map(R), null)), "ecadb");
// Trennzeile als Anker
assert.equal(names(apply([...q0, delim], ["b", "a", "e", "d", "c"].map(R), delim)), "baedcdelimiter");
// Rückgängig, nachdem zwei Songs schon gelaufen sind: der Rest steht wieder in der alten Reihenfolge
const afterPlay = ["d", "b", "e"].map(R);
assert.equal(names(apply(afterPlay, ["a", "b", "c", "d"].map(R), R("e"))), "bde");
// der Anker ist weg (gelaufen): trotzdem ordnen
assert.equal(names(apply(["d", "b", "c"].map(R), ["b", "c", "d"].map(R), R("e"))), "bcd");
// zu wenig übrig: nichts tun
assert.equal(planMove([R("a")], ["a", "b"].map(R), null), null);
// derselbe Song zweimal in der Warteschlange: die uid unterscheidet
const twice = [{ uri: "spotify:track:a", uid: "1" }, R("b"), { uri: "spotify:track:a", uid: "2" }];
assert.equal(apply(twice, [twice[2], twice[1], twice[0]], null).map((x) => x.uid).join(""), "2ub1");
assert.ok(sameRef({ uri: "x" }, { uri: "x", uid: "1" }), "ohne uid zählt die Adresse");
console.log("djorder: ok");
