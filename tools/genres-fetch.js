// Holt alle Genre-Namen, die Mirage je zu sehen bekommen kann, und schreibt sie nach tools/data/genres-all.json.
// Daraus baut tools/genres-map.js die Nachschlagetabelle src/genre-map.js (Name → Spielart), und
// tests/unit/genres-all.test.js prüft, dass jeder Name auf ein Profil kommt.
//   node tools/genres-fetch.js            alles neu holen (dauert ~3 Minuten, Deezer und MusicBrainz bremsen)
//   node tools/genres-fetch.js --only mb,apple  nur diese Quellen neu holen (spotify, mb, apple, deezer), Rest bleibt
//
// Quellen (Stand des Abrufs steht in der Datei unter "fetched"):
//  - Spotify: das Mikro-Genre-Universum von Every Noise at Once (Glenn McDonald, ~6 300 Namen; seit Ende 2023
//    eingefroren). Öffentliche Kopie mit Eltern-Genre je Name: Tiraya/spotify-genres (MIT),
//    https://code.thetadev.de/Tiraya/spotify-genres  (genres/genres.json, "parent" = gröberes Genre).
//    Zusätzlich die CSV von AyrtonB/EveryNoise-Watch (github.com/AyrtonB/EveryNoise-Watch, data/genre_attrs.csv).
//  - MusicBrainz: alle Genres der Datenbank, https://musicbrainz.org/ws/2/genre/all (CC0)
//  - Apple Music / iTunes: Genre-Baum unter „Music“ (id 34), https://itunes.apple.com/WebObjects/MZStoreServices.woa/ws/genres
//    in mehreren Ländern (Mirage fragt iTunes im eigenen Land – die Namen kommen dann in der Landessprache)
//  - Deezer: https://api.deezer.com/genre/{id} für alle IDs, auf Englisch und auf Deutsch (Accept-Language)
const fs = require("fs"), path = require("path");

const OUT = path.join(__dirname, "data", "genres-all.json");
const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : "";
const UA = { "User-Agent": "MirageGenreList/1.0 (genre list generator)" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, headers = {}, tries = 6) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { ...UA, ...headers } });
      if (r.ok) return r;
      if (r.status === 404) return null;
    } catch {}
    await sleep(1500 * (i + 1));
  }
  throw new Error("nicht erreichbar: " + url);
}
const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();

const TIRAYA = "https://code.thetadev.de/Tiraya/spotify-genres";
async function spotify() {
  // alle Namen (genres/genres.json: [{ id, name, … }])
  const data = await (await get(`${TIRAYA}/raw/branch/main/genres/genres.json`)).json();
  const out = {};
  for (const g of data) if (g?.name) out[norm(g.name)] = "";
  // Eltern je Name aus metadata/<buchstabe>.yaml („name:“ ganz links, darunter „  parent: …“); _meta.yaml enthält
  // die Sammelbegriffe (Metagenres wie „dance“, „event“), die nur als Eltern vorkommen
  const meta = {};
  const files = await (await get(`https://code.thetadev.de/api/v1/repos/Tiraya/spotify-genres/contents/metadata`)).json();
  for (const f of files.filter((x) => /\.ya?ml$/.test(x.name))) {
    const text = await (await get(`${TIRAYA}/raw/branch/main/metadata/${f.name}`)).text();
    let cur = "";
    for (const line of text.split(/\r?\n/)) {
      const top = /^(["']?)([^#\s"'][^"']*?)\1:\s*$/.exec(line);
      if (top) {
        cur = norm(top[2]);
        if (f.name === "_meta.yaml") meta[cur] = "";
        else if (!(cur in out)) out[cur] = "";
        continue;
      }
      const p = /^ {2}parent:\s*(["']?)(.+?)\1\s*$/.exec(line);
      if (p && cur) (f.name === "_meta.yaml" ? meta : out)[cur] = norm(p[2]);
    }
    await sleep(150);
  }
  // Gegenprobe mit der zweiten Kopie: was dort zusätzlich steht, kommt ohne Eltern dazu
  try {
    const csv = await (await get("https://raw.githubusercontent.com/AyrtonB/EveryNoise-Watch/main/data/genre_attrs.csv")).text();
    for (const line of csv.split(/\r?\n/).slice(1)) {
      const name = norm(line.replace(/,[^,]*,[^,]*,[^,]*$/, "").replace(/^"|"$/g, ""));
      if (name && !(name in out)) out[name] = "";
    }
  } catch (e) {
    console.warn("EveryNoise-Watch:", e.message);
  }
  return { names: out, meta };
}

async function musicbrainz() {
  const out = new Set();
  for (let off = 0; ; off += 100) {
    const r = await get(`https://musicbrainz.org/ws/2/genre/all?fmt=json&limit=100&offset=${off}`, { Accept: "application/json" }, 10);
    const j = await r.json();
    for (const g of j.genres || []) out.add(norm(g.name));
    process.stdout.write(`\rMusicBrainz ${out.size}/${j["genre-count"]}`);
    if (off + 100 >= j["genre-count"]) break;
    await sleep(1100);
  }
  console.log();
  return [...out].sort();
}

// Länder: dieselben Sprachen wie Mirage (i18n.js) plus große Musikmärkte
const STORES = ["us", "gb", "de", "at", "ch", "fr", "es", "it", "nl", "pl", "pt", "br", "mx", "ar", "jp", "kr", "tw", "hk", "cn", "tr", "ru", "ua", "se", "in", "za", "ng", "eg", "sa", "id", "th", "ph", "vn"];
// Ergebnis je Genre-ID: [Name im ersten Land (us = Englisch), weitere Namen anderer Länder …] – dieselbe ID heißt
// überall gleich viel, so ordnet tools/genres-map.js „ロック“ und „Рок“ über „Rock“ ein
async function apple() {
  const out = {};
  const walk = (node) => {
    if (!node) return;
    const n = norm(node.name), l = (out[node.id] ||= []);
    if (n && !l.includes(n)) l.push(n);
    for (const c of Object.values(node.subgenres || {})) walk(c);
  };
  for (const cc of STORES) {
    try {
      const r = await get(`https://itunes.apple.com/WebObjects/MZStoreServices.woa/ws/genres?id=34&cc=${cc}`);
      const j = await r.json();
      walk(j["34"]);
      process.stdout.write(`\rApple ${cc} ${Object.keys(out).length}`);
    } catch (e) {
      console.warn("\nApple", cc, e.message);
    }
    await sleep(400);
  }
  console.log();
  delete out["34"];
  return out;
}

// Ergebnis je Genre-ID: [englischer Name, deutscher Name] (Deezer kennt auch Podcast-Kategorien – die stehen mit drin)
async function deezer() {
  const out = {};
  for (const lang of ["en", "de"]) {
    let miss = 0;
    for (let id = 1; id < 1200 && miss < 250; id++) {
      const r = await get(`https://api.deezer.com/genre/${id}`, { "Accept-Language": lang });
      const j = r && (await r.json());
      if (j && j.name && !j.error) {
        const n = norm(j.name), l = (out[id] ||= []);
        if (lang === "en") l.unshift(n);
        else if (!l.includes(n)) l.push(n);
        miss = 0;
      } else miss++;
      process.stdout.write(`\rDeezer ${lang} id ${id}: ${Object.keys(out).length}`);
      await sleep(110);
    }
    console.log();
  }
  return out;
}

(async () => {
  const old = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};
  const res = { ...old, fetched: { ...(old.fetched || {}) } };
  const day = new Date().toISOString().slice(0, 10);
  const run = async (key, fn) => {
    if (only && !only.split(",").includes(key)) return;
    try {
      res[key] = await fn();
      res.fetched[key] = day;
    } catch (e) {
      console.warn(key, "fehlgeschlagen:", e.message, old[key] ? "(alter Stand bleibt)" : "(fehlt)");
    }
  };
  await run("spotify", spotify);
  await run("mb", musicbrainz);
  await run("apple", apple);
  await run("deezer", deezer);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  // eine Zeile je Quelle/Eintrag: diff-freundlich und trotzdem klein
  const s = JSON.stringify(res, null, 1);
  fs.writeFileSync(OUT, s + "\n");
  const n = (x) => (Array.isArray(x) ? x.length : x ? Object.keys(x.names || x).length : 0);
  console.log(`geschrieben: ${OUT} – Spotify ${n(res.spotify)}, MusicBrainz ${n(res.mb)}, Apple ${n(res.apple)} (IDs), Deezer ${n(res.deezer)} (IDs)`);
})();
