/* ---------------------------------------------------------------- Treffer bei Deezer und iTunes */
// Rein und ohne Abhängigkeiten (Unit-Tests, Testlabor): passt ein Suchtreffer zum laufenden Song?
// Ein falscher Treffer ist schlimmer als keiner – er brächte ein falsches Tempo und ein falsches Genre.

const norm = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, "");
const bareTitle = (s) => String(s || "").replace(/\s+-\s+.*$/, "").replace(/\s*[([].*?[)\]]/g, "").trim();
// gleicher Künstler: einer enthält den anderen („Beyoncé“ / „Beyoncé, JAY-Z“), ohne Akzente und Zeichen
const sameArtist = (a, b) => {
  const x = norm(a), y = norm(b);
  return !!x && !!y && (x.includes(y) || y.includes(x));
};
const sameTitle = (a, b) => {
  const x = norm(bareTitle(a)), y = norm(bareTitle(b));
  // gleich, oder einer beginnt mit dem anderen und ist kaum länger („Hello“ ≠ „Hello Kitty“)
  return !!x && !!y && (x === y || (Math.min(x.length, y.length) >= Math.max(x.length, y.length) * 0.75 && (x.startsWith(y) || y.startsWith(x))));
};

// Deezer-Suchtreffer ({ id, title, artist }) → der passende Song: gleicher Künstler, möglichst gleicher Titel
function pickDeezer(list, title, artist) {
  const mine = (list || []).filter((h) => sameArtist(h.artist?.name ?? h.artist, artist));
  return mine.find((h) => sameTitle(h.title, title)) || null;
}
// iTunes-Treffer → Genre: nur Treffer vom selben Künstler, gleicher Titel zählt doppelt, das häufigste gewinnt
function pickApple(list, title, artist) {
  const votes = {};
  for (const r of list || []) {
    if (!sameArtist(r.artistName, artist) || !r.primaryGenreName) continue;
    const w = sameTitle(r.trackName, title) ? 2 : 1;
    votes[r.primaryGenreName] = (votes[r.primaryGenreName] || 0) + w;
  }
  return Object.entries(votes).sort((x, y) => y[1] - x[1])[0]?.[0] || "";
}

export { pickDeezer, pickApple, sameArtist, sameTitle, bareTitle, norm };
