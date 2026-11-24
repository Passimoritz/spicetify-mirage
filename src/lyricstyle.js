/* ---------------------------------------------------------------- Verspielter Liedtext-Stil */
// Option „Verspielter Stil“ (cfg.lyrPlayful, Standard aus; Stärke cfg.lyrPlayLevel: subtle / playful / wild): der Liedtext spielt mit dem Song wie in einem guten
// Lyric-Video. Jede Zeile bekommt eine bewusst gewählte Inszenierung („Treatment“) aus einem großen Satz – Wörter
// steigen einzeln auf, fallen herein, kommen von beiden Seiten, prallen beim Drop zusammen, ein Schlüsselwort steht
// riesig zwischen kleinen, Buchstaben laufen als Welle, Rufe stehen eng in Großbuchstaben, schneller Rap tippt sich
// herein, Balladen-Zeilen glimmen langsam auf … Gewählt wird aus Teil des Songs, Energie, Tempo und Silbendichte,
// Zeilenlänge, Stimmung, Stelle im Teil (die erste Refrain-Zeile trifft am härtesten) und Wiederholung (eine
// wiederholte Zeile wechselt ihre Inszenierung) – mit Rhythmus, damit nicht zwei Zeilen hintereinander gleich spielen.
// Was gesungen wird, zählt: der Wortsinn (wordsense.js – Verneinung, Redewendungen, Stimmung, Sicherheit) über das
// Wörterbuch (lexicon.js, rund 200 Begriffe in 45 Sprachen) gibt Wörtern eine passende Bewegung (Feuer flackert,
// Regen tropft, Kälte zittert, das Herz schlägt, „fly“ hebt ab, „fall“ fällt, „boom“ zerspringt in Buchstaben …).
// Betonung: Lautheit der Analyse, sonst Dauer, Inhaltswörter, Zeilenende, Reime und Hook-Wörter.
// Bogen des Songs: der Pre-Chorus baut auf (enger, schneller, die letzte Zeile steigt), der erste und der letzte
// Refrain schlagen als großer Moment ein, Ruf und Antwort spielen dieselbe Inszenierung von zwei Seiten, die Hook-Wörter
// tragen je Song ein Erkennungszeichen, schneller Rap stößt je Silbe, und jede Zeile geht passend zu ihrem Auftritt ab.
//
// Hier steht nur die Entscheidung – einmal je Song (und noch einmal, wenn die Analyse nachkommt), nie im Bild:
// planPlayful() rechnet Klassen und CSS-Variablen, paintPlayful() setzt sie an Zeilen und Wörter. Bewegt wird
// ausschließlich per CSS (transform/opacity, Mirage/user.css, Block „i-playful“); „Ruhig“, „Keine Blitze“, „Leicht“
// und „weniger Bewegung“ regelt das Stylesheet. Testbar: tests/unit/lyricstyle.test.js.
import { planSong as planParts } from "./director.js";
import { matchAny, detectSong } from "./words.js";
import { senseLine, planSong as planSense, EXPLICIT } from "./wordsense.js";
import { lineMood } from "./mood.js";
import { bgFlags } from "./lyricvoices.js";
import { RECIPES, TREATMENTS, FAMILIES, EASE, songDeck, allowed, wordPose, poseVars, letterPoses, leadOf, ACCENTS, fxVariant, fxVars, particleVars, exitOf } from "./lyricdeck.js";
import { lineRole, markerOk, limitFonts, covers } from "./lyricfont.js";
import { CUE_KIND } from "./lyriccolor.js";
import { categoryOf as conceptCategory } from "./concepts.js";
import { runSync } from "./idlework.js";

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const r2 = (v) => Math.round(v * 100) / 100;
const median = (arr) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[s.length >> 1];
};
// letzter Index mit arr[i][key] <= at
function seek(arr, at, key) {
  let lo = 0, hi = arr.length - 1, r = -1;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    if (arr[m][key] <= at) {
      r = m;
      lo = m + 1;
    } else hi = m - 1;
  }
  return r;
}
// fester Zufall aus dem Text: dieselbe Zeile bekommt bei jedem Aufbau dieselbe Wahl (0 … 1)
function hash01(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10007) / 10007;
}

/* ---- Lautheit eines Worts: das Lauteste der Analyse zwischen Anfang und Ende (Millisekunden) */
// segs: [{ t: Sekunden, l: dB }] wie audio.js sie ablegt. Ohne Segment im Wort zählt das, das gerade klingt.
export function wordLoud(segs, a, b) {
  if (!segs?.length || !Number.isFinite(a)) return null;
  const k0 = seek(segs, a / 1000, "t");
  let m = null;
  // Segmente, die im Wort beginnen (eins, das genau am Anfang einsetzt, gehört dazu)
  for (let k = k0 >= 0 && segs[k0].t * 1000 >= a - 20 ? k0 : k0 + 1; k < segs.length && segs[k].t * 1000 < b; k++) m = Math.max(m ?? -99, segs[k].l);
  return m ?? (k0 >= 0 ? segs[k0].l : null);
}

/* ---- Betonung je Wort */
// Buchstaben, die groß und klein kennen: nur dann sagt die Schreibweise etwas („I“ allein zählt nicht)
const CASED = /[\p{Lu}\p{Ll}]/gu;
const capsOf = (s) => {
  const all = String(s || "").match(CASED) || [];
  const up = all.filter((c) => c === c.toUpperCase() && c !== c.toLowerCase()).length;
  return { n: all.length, up };
};
const isCaps = (s) => {
  const { n, up } = capsOf(s);
  return n >= 2 && up === n;
};
// gehaucht/geflüstert: Füllsilben ohne Inhalt („mm“, „ah“, „ooh“) sind leise Ausschmückung
const BREATH = /^[(（]?(?:m+|h?m+|a+h+|o+h+|o+|u+h+|ha+|hah|shh+|sh+)[)）,.…]*$/i;
// Funktionswörter der häufigsten Liedsprachen: tragen nie die Betonung (ohne Analyse die wichtigste Regel)
const FN = new Set(
  ("i me my mine you your you're we us our they them he she it it's its a an the and or but so to of in on at for with from " +
    "is are am was were be been do don't does did can can't will won't would just like that this these those what when where " +
    "i'm i'll i've gonna wanna gotta got get oh yeah ya na la no not all up down out if as by now then there here " +
    "ich du er sie es wir ihr mich dich mir dir mein dein und oder aber so zu von in im an am auf für mit ist bin bist sind war " +
    "der die das den dem des ein eine einen nicht kein noch nur wie was wenn wo da ja " +
    "yo tu él ella nosotros me te se mi tu y o pero que de en a el la los las un una es soy eres por para con no lo le " +
    "je tu il elle nous vous me te moi toi mon ma mes et ou mais que de du des le la les un une est suis pas en au " +
    "io tu lui lei noi mi ti il lo gli le e o ma che di da in con non è sono un una per eu você ele ela nós o os um uma é não com")
    .split(" "),
);
const TOKW = /[\p{L}\p{M}\p{N}'’]+/gu;
const bare = (s) => String(s || "").toLocaleLowerCase().replace(/[^\p{L}\p{M}\p{N}'’]+/gu, "").replace(/’/g, "'");
const isContent = (s) => {
  const w = bare(s);
  return [...w].length >= 3 && !FN.has(w) && !BREATH.test(w);
};
// Reim am Zeilenende: die letzten zwei, drei Buchstaben gleich (ohne das Wort selbst)
export function rhymes(a, b) {
  const x = bare(a), y = bare(b);
  if (!x || !y || x === y || x.length < 3 || y.length < 3) return false;
  const n = x.length >= 5 && y.length >= 5 ? 3 : 2;
  return x.slice(-n) === y.slice(-n);
}

// words: [{ text, a, b, est?, bg? }] einer Zeile. o.segs/o.avg aus der Analyse; fehlen sie, betonen Dauer,
// Inhaltswörter, Zeilenende (o.rhyme: das letzte Wort reimt sich), Hook-Wörter (o.hook: Set) und Schreibweise.
// o.no: Set von Wortstellen, die nie wachsen (derbe Wörter). → [{ e: -1..1 (leise … laut), cls, z: Größe 0.84..1.3 }]
export function emphasis(words, o = {}) {
  const W = words || [];
  if (!W.length) return [];
  const segs = o.synthetic ? null : o.segs;
  const L = W.map((w) => wordLoud(segs, w.a, w.b));
  const known = L.filter((v) => v != null);
  const lineMed = median(known), avg = Number.isFinite(o.avg) ? o.avg : lineMed;
  const timed = W.filter((w) => !w.est && w.b > w.a);
  const dMed = median(timed.map((w) => w.b - w.a)) || 1;
  // ohne Lautheit tragen die Faustregeln mehr Gewicht
  const fb = known.length ? 0.5 : 1;
  const last = W.length - 1;
  const raw = W.map((w, k) => {
    let e = 0;
    if (L[k] != null) e += 0.6 * ((L[k] - lineMed) / 4) + 0.4 * ((L[k] - avg) / 6);
    // betonte Silben werden länger gesungen
    if (!w.est && w.b > w.a) e += 0.3 * clamp((w.b - w.a) / dMed - 1, -1, 1.5);
    const tx = String(w.text || "");
    if (isContent(tx)) e += 0.3 * fb;
    else e -= 0.12 * fb;
    if (k === last && W.length >= 3 && isContent(tx)) e += (o.rhyme ? 0.36 : 0.2) * fb;
    if (o.hook?.has(bare(tx))) e += 0.24 * fb;
    if (isCaps(tx) || /!\s*[)）]?$/.test(tx)) e = Math.max(e, 0.8);
    if (w.bg || BREATH.test(tx)) e = Math.min(e, -0.6);
    if (o.no?.has(k)) e = Math.min(e, 0);
    return clamp(e, -1, 1);
  });
  // höchstens ein Drittel einer Zeile ist „laut“ (sonst ist nichts mehr betont) – die stärksten bleiben
  const room = Math.max(1, Math.round(W.length / 3));
  const loudest = raw.map((e, k) => [e, k]).filter(([e]) => e >= 0.45).sort((x, y) => y[0] - x[0]).slice(0, room).map(([, k]) => k);
  return raw.map((e, k) => {
    const loud = loudest.includes(k), soft = e <= -0.45;
    const z = loud ? 1 + 0.3 * e : soft ? 1 + 0.16 * e : 1;
    return { e: r2(e), cls: loud ? "is-p-loud" : soft ? "is-p-soft" : "", z: r2(clamp(z, 0.84, 1.3)) };
  });
}

/* ---- Gehaltene Töne: ein Wort, das viel länger klingt als die anderen der Zeile */
// → [{ held, hd: Dauer in ms }]. Geschätzte Wortzeiten (est) wissen davon nichts.
export function heldNotes(words) {
  const W = words || [];
  const dur = W.map((w) => (!w.est && w.b > w.a ? w.b - w.a : 0));
  const others = dur.filter((d) => d > 0);
  const med = median(others) || 0;
  return W.map((w, k) => {
    const d = dur[k];
    const held = d > 0 && (others.length >= 2 ? d >= Math.max(650, 2.2 * med) : d >= 1200);
    return { held, hd: held ? Math.round(d) : 0 };
  });
}

/* ---- Gerufene Zeile: Großbuchstaben im Text, „!“, oder Lautheits-Spitze des Songs */
// peak = lauteste Stelle der Zeile (dB), hi = Lautheit, ab der der Song „schreit“ (z. B. sein 92. Perzentil)
export function isShout(text, peak, hi) {
  const s = String(text || "");
  const { n, up } = capsOf(s);
  if (n >= 4 && up / n >= 0.7) return true;
  if (/!\s*[)）"”]?\s*$/.test(s) || /!!/.test(s)) return true;
  return peak != null && hi != null && peak >= hi && s.split(/\s+/).filter(Boolean).length <= 6;
}

/* ---- Teile des Songs */
// parts aus director.planSong ({ t0, t1, kind } in Sekunden) → Art an der Stelle t (ms)
export function sectionKind(parts, t) {
  if (!parts?.length) return "";
  const k = seek(parts, t / 1000 + 0.2, "t0");
  return k >= 0 ? parts[k].kind || "" : parts[0].kind || "";
}
// Art → Satz der Zeile: Strophe kompakt, Refrain groß und mittig, Bridge anders gesetzt, Rand ruhig
const SET = { chorus: "is-p-chorus", drop: "is-p-chorus", verse: "is-p-verse", pre: "is-p-verse", bridge: "is-p-bridge", intro: "is-p-calm", outro: "is-p-calm", break: "is-p-calm" };
export function sectionStyle(kind, { repeated = false } = {}) {
  // ohne Analyse: Zeilen, die sich wiederholen, sind Refrain – der Rest Strophe
  if (!kind) return repeated ? "is-p-chorus" : "is-p-verse";
  // die Regie ordnet ohne Liedtext ein; eine wiederholte Zeile mitten in der Strophe ist meist die Hook (ein Pre-Chorus
  // wiederholt sich dagegen fast immer – er bleibt Aufbau)
  if (kind === "verse" && repeated) return "is-p-chorus";
  return SET[kind] || "is-p-verse";
}

/* ---- Hintergrundgesang: klein, schräg, versetzt – abwechselnd, damit nicht alles gleich kippt */
export function adlibPose(k) {
  const odd = k % 2 === 1;
  return { rot: odd ? 2.5 : -3.5, dx: odd ? 1.6 : 2.4 };
}
// Ganze Zeile Hintergrundgesang? (Wörter in Klammern, „(x2)“ und „(Chorus)“ zählen nicht)
export function isAdlib(texts) {
  const f = bgFlags(texts || []);
  return f.length > 0 && f.every(Boolean);
}

/* ---- Duett: jede Stimme ihre Seite */
export function voiceSide(who) {
  return who === "1" ? "is-p-left" : who === "2" ? "is-p-right" : who === "3" ? "is-p-left" : who === "all" ? "is-p-mid" : "";
}

/* ---- Takt */
// Wort landet auf dem Schlag: Anfang höchstens tol ms neben einem Schlag (beats: [{ t: Sekunden }])
export function onBeat(a, beats, tol = 90) {
  if (!beats?.length || !Number.isFinite(a)) return false;
  const k = seek(beats, a / 1000, "t");
  const near = [beats[k], beats[k + 1]].filter(Boolean).map((b) => Math.abs(b.t * 1000 - a));
  return near.length > 0 && Math.min(...near) <= tol;
}
// Für Wippen und Schlag-Stoß per CSS-Animation: Länge eines Schlags und wie weit der jetzige schon zurückliegt.
// Einmal je Zeilenwechsel gesetzt (animation-duration/-delay) – kein Rechnen im Bild.
export function beatPhase(beats, sec) {
  if (!beats?.length) return null;
  const k = seek(beats, sec, "t");
  if (k < 0 || k + 1 >= beats.length) return null;
  const p = (beats[k + 1].t - beats[k].t) * 1000;
  if (!(p >= 250 && p <= 1500)) return null;
  return { p: Math.round(p), d: -Math.round((sec - beats[k].t) * 1000) };
}

/* ---- Silben: grob aus Vokalgruppen (Schriften ohne Vokalzeichen: je Zeichen eine) */
const VOW = /[aeiouyäöüáéíóúàèìòùâêîôûãõœæøåëïÿ]+/giu;
export function syllables(text) {
  let n = 0;
  for (const m of String(text || "").matchAll(TOKW)) {
    const w = m[0];
    if (/[\p{Script=Latin}]/u.test(w)) n += Math.max(1, (w.match(VOW) || []).length - (/[^aeiou]e$/i.test(w) && w.length > 3 ? 1 : 0));
    else if (/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(w)) n += [...w].length;
    else n += Math.max(1, Math.round([...w].length / 2.5));
  }
  return n;
}

/* ---- Wortbilder: Begriff (wordsense.js über lexicon.js) → Bewegung des Worts (CSS-Klasse is-c-<name>) */
// Je Bewegung die Begriffe, die sie auslösen. Begriffe ohne Eintrag bleiben still (lieber nichts als falsch).
const EFFECTS = {
  flame: "fire devil dragon candle", // Flackern mit warmem Schein
  heat: "sun summer desert beach tropical sweat island", // Hitzeflimmern
  drip: "rain tears water", // eintauchen, ein Tropfen löst sich
  wave: "ocean sail yacht sing music sway rainbow guitar bells", // Welle durch die Buchstaben
  jolt: "storm lightning earthquake electric", // Ruck mit Lichtblitz
  shiver: "cold fear", // Zittern, frostiger Schein
  snow: "snow", // Flocken rieseln
  beat: "heart heartbeat love kiss", // Herzschlag (doppelt)
  crack: "heartbreak pain goodbye", // knickt ein und rutscht ab
  float: "fly bird butterfly angel heaven sky rocket space jet freedom rise hallelujah pray", // hebt ab
  burst: "boom bass fireworks drums", // zerspringt in Buchstaben und fügt sich wieder
  spin: "spin crazy", // dreht sich einmal
  glint: "money gold diamond rich million bling crown luxury vip champagne silver mansion flex payday christmas", // Glanz
  star: "star sparkle", // funkelt
  neon: "neon laser", // Neonröhre glimmt (ohne Flackern im Stroboskop-Takt)
  dim: "dark black midnight blackout lonely lost moon", // dunkelt ab (nicht „night“: steht in fast jedem Lied)
  shine: "light sunrise morning wakeup hope alive smile happy", // hellt auf
  shake: "shake anger wild war beast monster hype", // bebt (auch die Rufe an die Menge: „scream“, „make some noise“)
  hush: "silence breathe sleep", // wird klein und leise
  bounce: "dance move jump bounce hips party clap stomp getup handsup turnup dancefloor club weekend birthday", // hüpft im Takt
  tick: "time", // tickt wie ein Zeiger
  drift: "dream magic smoke fog ghost wind memory longing", // schwebt träge
  dash: "drive run highway supercar train", // schießt schräg herein
  power: "strong hero legend victory pride boss", // wächst und steht
  droop: "sad", // sackt ab
  bloom: "flower rose spring wedding", // blüht auf
  sultry: "sexy touch body", // langsames, laszives Wiegen
};
const CUE = {};
for (const [fx, list] of Object.entries(EFFECTS)) for (const c of list.split(" ")) CUE[c] = fx;
// Was das Wörterbuch nicht kennt: Fallen, Steigen, Schreien, Flüstern, Anhalten, Uhr, Explodieren, Drehen –
// als Wortlisten je Sprache. Sie laufen durch denselben Wortsinn (Verneinung: „don't stop“ hält nicht an).
const EXTRA = {
  fall: {
    en: "fall falls falling fallin fell fallen sink sinking sank drown drowning",
    de: "fallen falle fällt fiel fielen sinken sinke sinkt versinken ertrinken",
    es: "caer caigo cae caes caída caemos hundo hundirme",
    fr: "tomber tombe tombé tombes tombent chute coule couler",
    it: "cadere cado cade caduta affondo",
    pt: "cair caio cai caindo queda afundar",
  },
  float: { en: "high higher highest rise rising risin", de: "hoch höher steigen steig empor", es: "alto arriba subir", fr: "haut monter", it: "salire", pt: "subir" },
  shake: {
    en: "scream screaming screamin shout shouting yell yelling loud louder",
    de: "schrei schreien schreie laut lauter brüll brüllen",
    es: "grita gritar grito",
    fr: "crier crie cri hurler hurle",
    it: "urlare urlo gridare grido",
    pt: "gritar grito grita",
  },
  hush: {
    en: "whisper whispers whispering quiet quietly softly hush",
    de: "flüster flüstern flüstere leise",
    es: "susurro susurrar susurra",
    fr: "murmure murmurer chuchote",
    it: "sussurro sussurrare",
    pt: "sussurro sussurrar",
  },
  halt: { en: "stop stopped stopping freeze frozen", de: "stopp anhalten erstarrt", es: "detente parar", fr: "arrête arrêter", it: "fermati fermare", pt: "pare parar" },
  tick: { en: "clock clocks tick tock ticking", de: "uhr ticken tick tack", es: "reloj", fr: "horloge", it: "orologio", pt: "relógio" },
  burst: { en: "explode exploding explodes bang", de: "explodieren explodiert knall knallt", es: "explota explotar", fr: "explose exploser", it: "esplodere esplode", pt: "explodir explode" },
  spin: { en: "round spinning circles", de: "dreh drehen dreht kreisen", es: "vueltas girar", fr: "tourne tourner", it: "girare gira", pt: "girar gira" },
  // Ersatzlisten für Begriffe, die das Wörterbuch (noch) nicht kennt – Schlüssel = Begriff, Bewegung über seine
  // Kategorie (CATEGORY_FX). Mehrdeutiges bleibt draußen („die“, „war“ sind Deutsch, „sang“, „tire“, „lame“ Englisch)
  gun: { en: "gun guns pistol pistols glock revolver rifle rifles shotgun trigger bullet bullets", de: "pistole pistolen gewehr gewehre knarre revolver kugel kugeln", es: "pistola pistolas rifle bala balas", fr: "pistolet flingue fusil balle balles", it: "pistola fucile proiettile proiettili", pt: "pistola fuzil bala balas" },
  shoot: { en: "shoot shoots shooting shootin shot shots", de: "schießen schieß schießt schoss schuss schüsse abdrücken", es: "disparar disparo disparos dispara", fr: "tirer tiré tirs", it: "sparare sparo spari spara", pt: "atirar tiro tiros atira" },
  machinegun: { en: "machinegun machineguns uzi ratatat ratatata", de: "maschinengewehr maschinengewehre salve salven", es: "metralleta ametralladora", fr: "mitraillette mitrailleuse", it: "mitra mitragliatrice", pt: "metralhadora" },
  blade: { en: "axe axes knife knives blade blades sword swords machete razor", de: "axt äxte messer klinge klingen schwert schwerter", es: "hacha cuchillo cuchillos espada navaja", fr: "hache couteau couteaux épée", it: "ascia coltello coltelli spada", pt: "machado faca facas espada" },
  kill: { en: "kill kills killed killing killin murder murdered dies died dying dead death", de: "töten tötet getötet töte mord ermordet sterben stirbt starb tod", es: "matar mata mató muerte muerto morir", fr: "tuer tue tué mort mourir meurtre", it: "uccidere uccide morte morto morire", pt: "matar mata morte morto morrer" },
  battle: { en: "wars warfare battle battles battlefield soldier soldiers army blood bloody bleed bleeding", de: "krieg kriege schlacht soldat soldaten armee blut blutig bluten", es: "guerra batalla soldado soldados sangre", fr: "guerre bataille soldat soldats", it: "guerra battaglia soldato sangue", pt: "guerra batalha soldado sangue" },
  bomb: { en: "bomb bombs grenade grenades dynamite", de: "bombe bomben granate dynamit", es: "bomba bombas granada", fr: "bombe bombes grenade", it: "bomba bombe granata", pt: "bomba bombas granada" },
  siren: { en: "siren sirens police cops sheriff", de: "sirene sirenen polizei bullen", es: "sirena policía", fr: "sirène sirènes police flics", it: "sirena polizia", pt: "sirene polícia" },
  car: { en: "car cars motorbike motorcycle truck plane airplane helicopter boat lambo ferrari porsche", de: "auto autos motorrad flugzeug hubschrauber boot", es: "coche carro moto avión barco", fr: "voiture moto avion bateau", it: "macchina moto aereo barca", pt: "carro moto avião barco" },
  animal: { en: "dog dogs cat cats lion lions tiger tigers wolf wolves snake snakes shark sharks bear bears eagle horse horses", de: "hund hunde katze katzen löwe löwen wolf wölfe schlange haie bär adler pferd pferde", es: "perro gato león tigre lobo serpiente tiburón oso águila caballo", fr: "chien chat lion tigre loup serpent requin ours aigle cheval", it: "cane gatto leone tigre lupo serpente squalo orso aquila cavallo", pt: "cachorro gato leão tigre lobo cobra tubarão urso águia cavalo" },
  food: { en: "pizza burger candy sugar honey cake cherry cherries chocolate", de: "zucker honig kuchen kirsche kirschen schokolade", es: "azúcar miel pastel cereza chocolate", fr: "sucre miel gâteau cerise chocolat", it: "zucchero miele torta ciliegia cioccolato", pt: "açúcar mel bolo cereja chocolate" },
  drink: { en: "wine beer whiskey tequila vodka", de: "wein bier wodka", es: "vino cerveza", fr: "vin bière", it: "vino birra", pt: "vinho cerveja" },
  tech: { en: "phone robot robots computer screen wifi digital matrix glitch virus", de: "handy roboter computer bildschirm", es: "teléfono robot pantalla", fr: "téléphone robot écran", it: "telefono robot schermo", pt: "telefone robô tela" },
  sport: { en: "ball goal goals champion champions trophy", de: "ball tor tore meister pokal", es: "balón gol campeón trofeo", fr: "ballon but champion trophée", it: "pallone gol campione trofeo", pt: "bola gol campeão troféu" },
  myth: { en: "god gods goddess phoenix unicorn zeus", de: "gott götter göttin phönix einhorn", es: "dios diosa fénix unicornio", fr: "dieu déesse phénix licorne", it: "dio dea fenice unicorno", pt: "deus deusa fênix unicórnio" },
};
// Wortgruppen, die das letzte Wort zu einem anderen Begriff machen („tommy gun“, „machine gun“ → Maschinengewehr)
const PHRASES = [[/\b(?:tommy|machine|sub-?machine)[ -]guns?\b/giu, "machinegun"]];

/* ---- Kategorien: neue Begriffe (das Wörterbuch wächst, wordsense.js liefert je Begriff eine Kategorie) bekommen über
   ihre Kategorie automatisch eine passende Bewegung. Eigene Bewegung eines Begriffs (EFFECTS) geht vor. */
export const CATEGORY_FX = {
  weapon: "shot", gunfire: "rapid", blade: "slash", death: "shatter", explosion: "burst", war: "war", violence: "war",
  siren: "siren", police: "siren", vehicle: "zoomby", transport: "zoomby", animal: "prowl", weather: "drift", food: "savor",
  drink: "savor", tech: "glitchy", sport: "kick", celebration: "bounce", party: "bounce", dance: "bounce", myth: "glint",
  religion: "float", space: "float", nature: "bloom", love: "beat", money: "glint", luxury: "glint", happy: "shine",
  sad: "droop", fear: "shiver", anger: "shake", time: "tick", music: "wave", night: "dim", light: "shine", fire: "flame",
  water: "drip", cold: "shiver", travel: "dash", city: "neon",
  // Kategorien des Wörterbuchs (src/concepts.js, CATEGORIES) – jede bekommt eine Bewegung, so hat jeder Begriff eine
  nightlife: "neon", crowd: "bounce", praise: "power", sky: "float", emotion: "shine", body: "bounce", digital: "glitchy",
  mystic: "drift", faith: "float", sound: "burst", people: "power", color: "shine", misc: "drift",
};
// Begriffe des Wörterbuchs mit eigener Bewegung (vor allem Gewalt: die Kategorie allein sagt nicht, ob Schuss oder Hieb)
const CONCEPT_FX = {
  // Asche ist grau und Rauch (dunkel), kein Feuer
  ashes: "dim", smoke: "drift",
  gun: "shot", shoot: "shot", heist: "shot", machinegun: "rapid", blade: "slash", axe: "slash", kill: "shatter", death: "shatter",
  reaper: "shatter", grenade: "burst", battle: "war", war: "war", blood: "war", gangster: "war", police: "siren", ambulance: "siren",
  shatter: "shatter", whisper: "hush", melt: "droop", hide: "hush", forget: "drift", toxic: "glitchy", magnetic: "jolt",
  infinity: "spin", paint: "bloom", train: "zoomby", car: "zoomby", motorbike: "zoomby", plane: "zoomby", helicopter: "zoomby",
  bicycle: "zoomby", engine: "zoomby", race: "zoomby", boxing: "kick", workout: "kick", martialarts: "kick", explode: "burst",
};
// Gewalt: richtet sich nach der Einstellung für derbe Inhalte (wie in Party) – aus: keine Bewegung, „sanft“: nur Farbe
export const VIOLENT_CATS = new Set(["weapon", "gunfire", "blade", "death", "explosion", "war", "violence"]);
// Ersatz-Zuordnung Begriff → Kategorie (bis das Wörterbuch sie selbst liefert; auch die Schlüssel der Ersatzlisten)
const CONCEPT_CAT = {
  gun: "weapon", pistol: "weapon", rifle: "weapon", shoot: "weapon", shot: "weapon", bullet: "weapon", weapon: "weapon",
  machinegun: "gunfire", tommygun: "gunfire", axe: "blade", knife: "blade", sword: "blade", blade: "blade",
  kill: "death", murder: "death", death: "death", dead: "death", battle: "war", war: "war", soldier: "war", army: "war", blood: "war",
  bomb: "explosion", grenade: "explosion", siren: "siren", police: "police", car: "vehicle", motorbike: "vehicle", plane: "vehicle",
  helicopter: "vehicle", boat: "vehicle", truck: "vehicle", animal: "animal", dog: "animal", cat: "animal", lion: "animal",
  tiger: "animal", wolf: "animal", snake: "animal", shark: "animal", bear: "animal", horse: "animal", eagle: "animal",
  food: "food", sweet: "food", pizza: "food", candy: "food", sugar: "food", honey: "food", cake: "food", cherry: "food", chocolate: "food",
  drink: "drink", wine: "drink", beer: "drink", whiskey: "drink", tequila: "drink", vodka: "drink", tech: "tech", phone: "tech",
  robot: "tech", computer: "tech", internet: "tech", sport: "sport", ball: "sport", goal: "sport", champion: "sport",
  trophy: "sport", myth: "myth", god: "myth", goddess: "myth", phoenix: "myth", unicorn: "myth",
};
// Kategorie eines Begriffs: eigene Zuordnung (feiner, z. B. Schuss/Hieb), sonst die des Wörterbuchs (concepts.js)
export const categoryOf = (concept, cat) => {
  if (cat) return cat;
  if (CONCEPT_CAT[concept]) return CONCEPT_CAT[concept];
  try {
    const c = conceptCategory(concept);
    return c && c !== "misc" ? c : CUE[concept] ? "" : c || "";
  } catch {
    return "";
  }
};
// Allerweltsbegriffe, die fast jedes Lied hat: nur mit eigener Bewegung, nicht über die Kategorie (sonst zappelt alles)
const COMMON = new Set(["night", "world", "home", "yeah", "hey", "everybody", "together", "friends", "woo", "comeon", "light", "dark", "move", "time", "red", "blue", "black", "white"]);
export const cueFor = (concept, cat) => CUE[concept] || CONCEPT_FX[concept] || (COMMON.has(concept) ? "" : CATEGORY_FX[categoryOf(concept, cat)] || "");
// Redewendungen ohne Gewalt: „killing it“, „a shot of tequila“, „photo shoot“, „shoot your shot“, „you're the bomb“ …
const NOT_VIOLENT = [
  /\bkill(?:s|ing|in'?|ed)? it\b/giu, /\bdressed to kill\b/giu, /\bshots? of\b/giu, /\bphoto ?shoots?\b/giu, /\bfotoshooting\w*/giu,
  /\b(?:take|took|taking|takin'?|give|gave|shoot|shootin'?|shooting) (?:a|my|your|his|her|our|their|the|one|another) shot\b/giu,
  /\bshoot(?:s|ing|in'?)? (?:a|the|my|our|this) (?:video|film|movie|scene|photo|clip)s?\b/giu, /\b(?:the|da) bomb\b/giu,
  /\bkiller (?:queen|smile|look|body|style|vibe|heels|beat)\w*/giu, /\bto die for\b/giu, /\bdying to\b/giu, /\bdead (?:tired|serious)\b/giu,
  /\bdrop[- ]dead\b/giu, /\b(?:ein|einen|nen) schuss (?:tequila|wodka|vodka|rum|liebe)\b/giu, /\bbomb(?:e|en)? ?stimmung\b/giu,
];
// groß geschrieben, aber kein Name
const NAME_OK = new Set(["god", "lord", "jesus", "heaven", "hell", "christmas", "halloween", "valentine", "paradise"]);
function peaceSpans(s) {
  const out = [];
  for (const re of NOT_VIOLENT) for (const m of s.matchAll(re)) out.push([m.index, m.index + m[0].length]);
  return out;
}
// gebrochenes Herz als Wortgruppe, die das Wörterbuch nur als „heart“ kennt: knickt ein statt zu schlagen
const BROKEN = /\b(?:br(?:oke|eak|eaks|eaking|oken)|tore|rip(?:ped)?|shatter(?:ed)?) (?:my|your|his|her|our|this) heart\b|(?:brach|brichst|bricht|gebrochen\w*) (?:mein|dein|sein|ihr)\w* herz|herz\w* (?:gebrochen|zerbrochen)/iu;
const XIDX = new Map();
for (const [fx, byLang] of Object.entries(EXTRA)) for (const [lang, words] of Object.entries(byLang)) for (const w of words.split(" ")) if (!XIDX.has(w)) XIDX.set(w, [fx, lang]);
// Wichtigkeit, wenn eine Zeile mehrere Treffer hat (zwei Bilder je Zeile höchstens)
const FXPRI = { burst: 5, flame: 5, jolt: 5, fall: 5, crack: 5, halt: 5, shot: 5, rapid: 5, slash: 5, shatter: 5, siren: 4, war: 4, float: 4, beat: 4, glint: 4, shiver: 4, drip: 4, spin: 4, shake: 4, hush: 4, neon: 4, snow: 4, star: 4 };
// laute Bewegungen in einem traurigen Lied / an einer leisen Stelle: die sanfte Schwester
const SOFTEN = { burst: "shine", bounce: "drift", shake: "crack", jolt: "shiver", dash: "drift", spin: "drift", neon: "shine", shot: "crack", rapid: "shiver", slash: "crack", shatter: "droop", zoomby: "drift", kick: "drift", glitchy: "shiver" };
// Bewegungen mit Schein (Pseudo-Element mit Deckkraft – nie text-shadow im Bild)
const GLOWS = new Set(["flame", "heat", "jolt", "shiver", "beat", "glint", "shine", "drift", "neon", "star", "snow", "siren"]);
// Bewegungen, die das Wort in Buchstaben zerlegen
const LETTERS = new Set(["burst", "wave", "slash", "shatter"]);
// die alten Ersatzlisten heißen wie ihre Bewegung; die neuen wie ihr Begriff
const XCUE = new Set(["fall", "float", "shake", "hush", "halt", "tick", "burst", "spin"]);
export const cueOf = (concept) => CUE[concept] || "";

// Treffer einer Zeile aus den Zusatzlisten im Format von words.js (für senseLine)
function extraHits(text) {
  const out = [];
  let ti = 0;
  for (const m of String(text || "").matchAll(TOKW)) {
    const w = m[0].toLocaleLowerCase().replace(/[’']/g, "'").replace(/'$/, "");
    const x = XIDX.get(w);
    if (x) out.push({ c: "x:" + x[0], at: m.index, len: m[0].length, raw: m[0], how: "exact", lang: x[1], ti, tn: 1 });
    ti++;
  }
  // Wortgruppen: der Treffer des letzten Worts bekommt den Begriff der Gruppe
  for (const [re, c] of PHRASES) {
    for (const m of String(text || "").matchAll(re)) {
      const end = m.index + m[0].length;
      const h = out.find((x) => x.at < end && x.at + x.len >= end - 1);
      if (h) h.c = "x:" + c;
    }
  }
  return out;
}

// Die eine Stelle, an der Wortbedeutung gesucht wird: Wörterbuch-Treffer (words.js, Sprache aus dem ganzen Text)
// plus Zusatzlisten, gesiebt vom Wortsinn (wordsense.js: Verneinung, Redewendungen, Sicherheit).
// o: { neg (lexicon.js), explicit: "on" | "soft" | "off" }. → (text, soft?) => [{ at, len, cue, c, conf }]
export function cueMatcher(lines, lexicon, o = {}) {
  let song = null;
  const texts = (lines || []).map((l) => String(l?.text || ""));
  const hitsOf = (s) => {
    let hits = [];
    if (lexicon) {
      try {
        song ??= detectSong(texts, lexicon);
        hits = matchAny(s, song.langs, lexicon);
      } catch {}
    }
    return hits.concat(extraHits(s));
  };
  const fn = (text, soft = false) => {
    const s = String(text || "");
    let cands = [];
    try {
      cands = senseLine(s, hitsOf(s), { neg: o.neg, main: song?.main });
    } catch {}
    const out = [];
    let peace = null;
    // Namen: ein groß geschriebenes Wort mitten in der Zeile („… from the sky Ash“, „I love you Grace“) ist meist ein
    // Name, kein Begriff – außer am Satzanfang, in Zeilen in Großbuchstaben/Titel-Schreibweise und in Sprachen, die
    // Hauptwörter groß schreiben (Deutsch)
    const words = s.match(/\p{L}[\p{L}\p{M}'’]*/gu) || [];
    const capShare = words.length ? words.filter((w) => /^\p{Lu}/u.test(w)).length / words.length : 0;
    const nouns = song?.main === "de" || (song?.langs || []).includes("de") || /\b(?:der|die|das|und|ich|nicht|mein|dein)\b/iu.test(s);
    const isName = (x) => {
      if (nouns || capShare > 0.5) return false;
      const raw = s.slice(x.at, x.at + x.len);
      if (!/^\p{Lu}\p{Ll}/u.test(raw) || NAME_OK.has(raw.toLowerCase())) return false;
      const before = s.slice(0, x.at);
      return /\p{L}/u.test(before) && !/[.!?…:"“„(]\s*$/u.test(before);
    };
    for (const x of cands) {
      if (isName(x)) continue;
      // Begriff: aus dem Wörterbuch oder aus einer Ersatzliste (x:…); Bewegung über eigene Zuordnung oder die Kategorie
      const xk = x.c.startsWith("x:") ? x.c.slice(2) : "";
      const concept = xk || x.c;
      const cat = xk && XCUE.has(xk) ? "" : categoryOf(concept, o.categoryOf?.(concept));
      let cue = xk && XCUE.has(xk) ? xk : cueFor(concept, cat);
      if (x.c === "heart" && BROKEN.test(s)) cue = "crack";
      const violent = VIOLENT_CATS.has(cat);
      // derb (nicht Gewalt): wie bisher – nur „sexy“ wiegt sich, und nur mit „derbe Inhalte: an“
      if (EXPLICIT.has(x.c) && !violent) cue = x.c === "sexy" && o.explicit === "on" ? "sultry" : "";
      if (!cue) continue;
      // Gewalt: Redewendungen („killing it“, „shot of tequila“) zählen nicht; Einstellung derbe Inhalte: aus → nichts,
      // sanft → nur die Farbe
      let calm = false;
      if (violent) {
        peace ??= peaceSpans(s);
        if (peace.some(([a, b]) => x.at < b && x.at + x.len > a)) continue;
        if (o.explicit === "off") continue;
        calm = o.explicit === "soft";
      }
      if (soft && SOFTEN[cue]) cue = SOFTEN[cue];
      out.push({ at: x.at, len: x.len, cue, c: x.c, conf: x.conf, ...(calm ? { calm } : {}) });
    }
    return out.sort((a, b) => a.at - b.at);
  };
  fn.hitsOf = hitsOf;
  fn.song = () => song;
  return fn;
}
// derbe Treffer einer Zeile (Stellen), auch wenn sie keine Bewegung bekommen: sie wachsen nie
function explicitSpans(text, hitsOf) {
  const out = [];
  try {
    for (const h of hitsOf(text)) if (EXPLICIT.has(h.c)) out.push([h.at, h.at + h.len]);
  } catch {}
  return out;
}

/* ---- Inszenierungen je Zeile: Rezepte aus dem Deck des Songs (lyricdeck.js) */
// Über 60 Rezepte (Wörter steigen, fallen, klappen auf, prallen zusammen, Buchstaben regnen, tippen sich, drehen
// sich herein …), je Song ein eigenes Deck: welche Rezepte Strophe, Pre-Chorus, Refrain (ein gemeinsames Motiv),
// Drop, Bridge und ruhige Stellen spielen. Gewählt wird je Zeile aus dem Deck ihres Teils – mit Verlauf: nie zweimal
// dasselbe hintereinander, keins über ~20 % der Zeilen, eine wiederholte Zeile wechselt.
export { TREATMENTS };
// ohne Wort-Elemente bewegt sich nur die ganze Zeile
const WORDLESS = ["plain", "punch", "tilt", "caps"];
const FAMILY_OF = {};
for (const [fam, list] of Object.entries(FAMILIES)) for (const t of list) FAMILY_OF[t] ??= fam;

export function pickTreatments(feats, deck) {
  const D = deck || songDeck("default");
  const level = D.level || "playful";
  const out = [], count = {}, byKey = new Map();
  let n = 0;
  for (let i = 0; i < feats.length; i++) {
    const f = feats[i];
    if (!f) {
      out.push("");
      continue;
    }
    const chorus = f.kind === "chorus" || f.kind === "drop";
    const quiet = f.kind === "intro" || f.kind === "outro" || f.kind === "break";
    let pool;
    if (!f.words) pool = chorus ? ["punch", "caps", "tilt", "plain"] : f.kind === "bridge" ? ["tilt", "plain"] : ["plain", "punch", "tilt"];
    else if (f.dropIn) pool = D.drop;
    else if (f.first && chorus) pool = [...D.hit, ...D.chorus];
    else if (f.shout) pool = [...D.shout, ...D.chorus];
    else if (f.rap) pool = D.rap;
    else if (chorus) pool = [...D.chorus, D.hit[0]];
    else if (f.kind === "pre") pool = D.pre;
    else if (f.kind === "bridge") pool = D.bridge;
    else if (quiet) pool = D.calm;
    else if (f.ballad) pool = [...D.ballad, ...D.verse.slice(0, 2)];
    else pool = D.verse;
    const fits = (t) => {
      const r = RECIPES[t];
      if (!r || !allowed(t, level)) return false;
      if (!f.words) return WORDLESS.includes(t);
      if (r.L && !f.lettersOk) return false;
      if (r.keyed && !(f.keyStrength >= 0.55)) return false;
      if (r.min && f.n < r.min) return false;
      if (r.max && f.n > r.max) return false;
      // sehr lange Zeilen: lieber ruhig setzen als zappeln
      if (f.n > 12 && (r.e >= 2 || r.L)) return false;
      // Ballade: höchstens die erste Refrain-Zeile darf knallen
      if (f.ballad && r.e >= 3 && !(f.first && chorus)) return false;
      return true;
    };
    const cands = new Map();
    pool.forEach((t, k) => fits(t) && !cands.has(t) && cands.set(t, 1.3 - k * 0.07));
    // alles Übrige, was passt, mit wenig Gewicht (passend zur Energie des Teils): über viele Songs taucht so jedes
    // Rezept auf, im Song bleibt das Deck tonangebend
    if (f.words) {
      const want = f.dropIn || (f.first && chorus) ? 3 : chorus ? 2.4 : quiet || f.ballad ? 0.3 : f.kind === "pre" ? 1.6 : f.rap ? 1.2 : 1;
      for (const t of TREATMENTS) if (!cands.has(t) && fits(t)) cands.set(t, 0.5 - Math.abs(RECIPES[t].e - want) * 0.2);
    }
    if (!cands.size) cands.set("plain", 0);
    const prev = out.filter(Boolean);
    const p1 = prev[prev.length - 1], p2 = prev[prev.length - 2];
    const used = byKey.get(f.key) || [];
    // Antwort auf einen Ruf: dieselbe Inszenierung gespiegelt (Richtung setzt planPlayful) – sichtbar die Antwort
    const mirror = f.resp >= 0 && f.resp < i ? out[f.resp] : "";
    let best = "plain", bv = -Infinity;
    for (const [t, base] of cands) {
      let v = base + hash01(D.seed + "|" + f.key + "|" + t + "|" + used.length) * 0.6;
      if (t === mirror) v += 3.2;
      else if (t === p1) v -= 3;
      if (t === p2) v -= 1;
      // was in den letzten sechs Zeilen schon lief, tritt zurück (sonst kreist ein Refrain durch dieselben vier)
      else if (prev.slice(-6).includes(t)) v -= 0.9;
      if (p1 && FAMILY_OF[t] && FAMILY_OF[t] === FAMILY_OF[p1] && !chorus) v -= 0.3;
      const share = n >= 5 ? (count[t] || 0) / n : 0;
      if (share > 0.1) v -= (share - 0.1) * 14;
      if (used.includes(t)) v -= 1.4 + 0.5 * used.filter((u) => u === t).length;
      if (v > bv) (bv = v), (best = t);
    }
    out.push(best);
    count[best] = (count[best] || 0) + 1;
    n++;
    byKey.set(f.key, [...used, best]);
  }
  return out;
}

/* ---- Schlüsselwort der Zeile: Wortbild > Betonung > Inhaltswort am Ende; nie derb, nie Hintergrund */
function keyWord(ws, em, cueAt, no) {
  let best = -1, bv = -Infinity;
  ws.forEach((w, k) => {
    if (w.bg || no.has(k) || !isContent(w.text)) return;
    const len = [...bare(w.text)].length;
    if (len > 12) return;
    let v = em[k].e + (cueAt.has(k) ? 0.7 : 0) + (k === ws.length - 1 ? 0.1 : 0) + Math.min(0.2, len * 0.02);
    if (v > bv) (bv = v), (best = k);
  });
  return { k: best, strength: best >= 0 ? clamp(bv, 0, 1.5) : 0 };
}
// Buchstaben-Zerlegung nur für einfache Schrift (keine Zeichen, die sich verbinden), höchstens 12 Zeichen
const SPLITTABLE = /^[\p{Script=Latin}\p{Script=Cyrillic}\p{Script=Greek}\p{N}'’!?.,-]{2,12}$/u;
const canSplit = (s) => SPLITTABLE.test(String(s || "")) && !/\p{M}/u.test(String(s || "").normalize("NFC"));
// Zeilen, deren Wörter alle in Buchstaben zerfallen dürfen: kurz (≤ 4 Wörter, ≤ 18 Buchstaben), einfache Schrift
const lettersOk = (ws, who) => !who && ws.length > 0 && ws.length <= 4 && ws.reduce((s, w) => s + [...String(w.text)].length, 0) <= 18 && ws.every((w) => canSplit(w.text) || [...String(w.text)].length < 2);

// Wort setzt ein (.is-sung): Vorlauf vor dem Einsatz, damit es genau auf dem Einsatz gelandet ist. Dieselbe Uhr wie
// die Karaoke-Füllung (pos = Songposition inkl. Versatz, je-Song-Korrektur und Tipp-Abgleich). LEAD_PAD: Chromium
// startet eine Überblendung erst mit dem nächsten Bild der Grafikkarte – genau ein Bild des Bildschirms nach dem
// Klassenwechsel. So viel früher auslösen, dann liegt die Landung auch in echt auf dem Einsatz. Ein Bild = 1000 / Hz
// (gemessene Bildschirmrate, fxenv.refreshFrom in der Bildschleife), begrenzt auf 6 … 34 ms; ungemessen: 60 Hz.
export const leadPad = (hz) => (hz > 0 ? Math.round(clamp(1000 / hz, 6, 34) * 10) / 10 : LEAD_PAD);
export const LEAD_PAD = 16.7;
export const sungAt = (w, pos, pad = LEAD_PAD) => pos >= w.a - (w.lead ? w.lead + pad : 0);
// Vorlauf der nächsten Zeile: so lange vor ihrem ersten Wort nimmt sie ihre Wartestellung ein (.is-pnext)
export const PRE_MS = 600;
// Tempo des Gesangs: alle Dauern richten sich nach der Zeit, die bis zum nächsten Einsatz bleibt – in schnellen
// Stellen (Rap, kurze Zeilen) lief sonst Bewegung über den nächsten Einsatz hinaus, und der Text wirkte langsamer als
// der Gesang. Landung höchstens 90 % des Abstands zum vorigen Einsatz (nie unter LEAD_MIN), Akzente und gehaltene Töne
// enden vor dem ersten Einsatz der nächsten Zeile, Wortbild-Schleifen (Zierde) erst ab FX_ROOM ms bis dahin, kurze
// Zeilen (unter FAST_LINE) wechseln Farbe, Größe und Lage in 80 % ihrer Dauer, der Abgang passt in die nächste Zeile.
export const LEAD_MIN = 60;
export const FX_ROOM = 450;
export const FAST_LINE = 900;
export const ACC_MIN = 120;

/* ---- Alles zusammen: einmal je Song */
// lines: Zeilen ({ t, text, who?, bg? }), wordLists[i]: Wörter der Zeile i ({ text, a, b, est?, bg?, el? }) oder leer,
// d: Analyse aus audio.js (oder null). o: { lexicon, neg (lexicon.js), explicit ("on"|"soft"|"off"), still (ohne
// Bewegung: nur Größe, Stärke, Satz, Farbe), level ("subtle"|"playful"|"wild"), seed (Song-Kennung fürs Deck),
// parts/drops (statt aus der Regie), match (eigener Treffer-Sucher, Tests) }
// → je Zeile { t: Rezept, v: Spielart, cls: [], vars: {}, font, words: [{ cls, vars, lead, chars?, tx? }] }
//   (das Ergebnis trägt zusätzlich .deck)
const planCache = new WeakMap();
function partsOf(d) {
  if (!d?.beats?.length || d.synthetic) return { parts: null, drops: [] };
  if (planCache.has(d)) return planCache.get(d);
  let r = { parts: null, drops: [] };
  try {
    const p = planParts(d, "pop", {});
    if (p) r = { parts: p.parts, drops: p.drops || [] };
  } catch {}
  planCache.set(d, r);
  return r;
}
const lineKey = (x) => String(x || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
// Stärke je Teil: Strophe zurückgenommen, Pre-Chorus baut auf (siehe unten), Refrain und Drop klar größer – der
// Unterschied zwischen den Teilen ist das, was man spürt (vorher lagen Strophe und Refrain nur 15 % auseinander)
const AMP = { chorus: 1.28, drop: 1.38, pre: 0.95, verse: 0.85, bridge: 0.9, intro: 0.75, outro: 0.75, break: 0.7 };
// Ruf und Antwort: die nächste Zeile antwortet (andere Duett-Stimme, Frage → Antwort, Echo der letzten Wörter)
const QUESTION = /[?¿？]\s*["”»)）]?\s*$/;
function answers(a, b) {
  if (!a || !b || lineKey(a.text) === lineKey(b.text)) return false;
  if (a.who && b.who && a.who !== b.who && a.who !== "all" && b.who !== "all") return true;
  if (QUESTION.test(String(a.text || ""))) return true;
  // Echo: die (höchstens fünf) Inhaltswörter der zweiten Zeile stehen am Ende der ersten
  const wb = String(b.text || "").match(TOKW) || [];
  const tail = new Set((String(a.text || "").match(TOKW) || []).slice(-4).map(bare));
  const cb = wb.filter(isContent).map(bare);
  return wb.length <= 5 && cb.length >= 1 && cb.every((w) => tail.has(w));
}
// Als Generator: yield gibt zwischen Zeilen-Häppchen Luft (immersive.js verteilt sie auf Leerlaufzeiten –
// am Stück waren es beim Songwechsel 40–60 ms in einer Aufgabe). planPlayful rechnet am Stück (Tests, Node).
export const planPlayful = (lines, wordLists, d, o) => runSync(planSteps(lines, wordLists, d, o));
// Länge der Zeile für die Größe in Party (Reihen bei voller Größe, grob aus den Zeichen): kurze Zeilen dürfen so groß
// werden wie im normalen Stil
export const lenClass = (text) => {
  const n = [...String(text || "").trim()].length;
  return !n ? "" : n <= 22 ? "is-p-len1" : n <= 40 ? "is-p-len2" : "";
};
export function* planSteps(lines, wordLists, d, o = {}) {
  const L = lines || [];
  const real = d && !d.synthetic;
  const segs = real ? d.segs : null;
  const beats = d?.beats || null;
  const bars = d?.bars || null;
  const still = !!o.still;
  const level = o.level === "subtle" || o.level === "wild" ? o.level : "playful";
  const deck = songDeck(o.seed || "lyr:" + hash01(L.map((l) => l.text).join("\n")), level);
  const { parts, drops } = o.parts !== undefined ? { parts: o.parts, drops: o.drops || [] } : partsOf(d);
  const match = o.match || cueMatcher(L, o.lexicon, { neg: o.neg, explicit: o.explicit || "on" });
  const hitsOf = match.hitsOf || (() => []);
  // Wiederholungen (Refrain ohne Analyse) – wie die Hype-Zeilen in immersive.js
  const seen = new Map();
  for (const l of L) if (lineKey(l.text).length > 6) seen.set(lineKey(l.text), (seen.get(lineKey(l.text)) || 0) + 1);
  // Hook-Wörter: Inhaltswörter, die in wiederholten Zeilen oft stehen
  const freq = new Map();
  for (const l of L) {
    if (!(seen.get(lineKey(l.text)) >= 2)) continue;
    for (const m of String(l.text || "").matchAll(TOKW)) if (isContent(m[0])) freq.set(bare(m[0]), (freq.get(bare(m[0])) || 0) + 1);
  }
  const hook = new Set([...freq].filter(([, c]) => c >= 3).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([w]) => w));
  // Lautheits-Spitzen: ab dem 92. Perzentil der Zeilen-Spitzen „schreit“ der Song
  const peaks = L.map((l, i) => {
    const ws = wordLists?.[i];
    if (!segs?.length || !ws?.length) return null;
    return Math.max(...ws.map((w) => wordLoud(segs, w.a, w.b) ?? -99));
  });
  const known = peaks.filter((v) => v != null).sort((a, b) => a - b);
  const hi = known.length >= 8 ? Math.max(known[Math.floor(known.length * 0.92)], (d?.avg ?? -12) + 4) : null;
  const pMed = known.length ? known[known.length >> 1] : null;
  // Tempo aus dem Takt (für „Ballade“)
  const bp = beats?.length > 8 ? median(beats.slice(1, 200).map((b, k) => b.t - beats[k].t).filter((x) => x > 0.25 && x < 1.5)) : 0;
  const bpm = bp ? 60 / bp : 0;
  // Stimmung und ruhige Stellen aus dem Wortsinn (wordsense.planSong: trauriges Lied → sanfte Antworten)
  let soft = [];
  if (o.lexicon && !o.match) {
    const hits = [];
    for (let i = 0; i < L.length; i++) {
      try {
        hits.push(hitsOf(String(L[i].text || "")));
      } catch {
        hits.push([]);
      }
      if (i % 8 === 7) yield;
    }
    try {
      soft = planSense(L.map((l) => ({ text: String(l.text || "") })), hits, { neg: o.neg, main: match.song?.()?.main }).map((p) => !!p?.soft);
    } catch {}
    yield;
  }
  // gerufene Zeilen höchstens jede achte – sonst ist es kein Rufen mehr
  const maxShout = Math.max(1, Math.round(L.length / 8));
  let shouts = 0, adl = 0;
  // erste gesungene Zeile nach jedem Drop: kurzer Auftritt
  const dropIn = new Set();
  for (const dt of drops || []) {
    const k = L.findIndex((l) => l.t >= dt * 1000 - 150 && String(l.text || "").trim() && l.text !== "♪");
    if (k >= 0 && L[k].t - dt * 1000 < 4000) dropIn.add(k);
  }

  // 1. Merkmale je Zeile
  let prevKind = null, prevEnd = -1e9;
  const pre = L.map((l, i) => {
    const ws = wordLists?.[i] || [];
    const text = String(l.text || "");
    const texts = ws.length ? ws.map((w) => w.text) : text.split(/\s+/).filter(Boolean);
    const adlib = !!l.bg || (texts.length > 0 && isAdlib(texts));
    const repeated = seen.get(lineKey(text)) >= 2;
    let kind = sectionKind(parts, l.t);
    if (!kind) kind = repeated ? "chorus" : "verse";
    else if (kind === "verse" && repeated) kind = "chorus";
    const shout = !l.bg && isShout(text, peaks[i], hi);
    return { l, i, ws, text, texts, adlib, repeated, kind, shout };
  });
  // Erkennungszeichen: die ein, zwei Inhaltswörter, die im Refrain am häufigsten fallen (mindestens dreimal)
  const sfreq = new Map();
  for (const p of pre) {
    if (p.adlib || (p.kind !== "chorus" && p.kind !== "drop")) continue;
    for (const m of p.text.matchAll(TOKW)) if (isContent(m[0])) sfreq.set(bare(m[0]), (sfreq.get(bare(m[0])) || 0) + 1);
  }
  const sigWords = new Set([...sfreq].filter(([, c]) => c >= 3).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 2).map(([w]) => w));
  const feats = pre.map((p) => {
    const { l, i, ws, text, texts } = p;
    if (p.adlib || !text.trim() || text === "♪") return null;
    const next = L[i + 1]?.t;
    const a = ws.length ? ws[0].a : l.t, b = ws.length ? ws[ws.length - 1].b : Math.min(next ?? l.t + 4000, l.t + 6000);
    const secs = Math.max(0.4, (b - a) / 1000);
    const rate = syllables(text) / secs;
    const n = texts.length;
    const rap = (rate >= 4.6 && n >= 7) || (rate >= 5.4 && n >= 5);
    const ballad = !rap && (rate <= 2.4 || (bpm && bpm < 84));
    let energy = { chorus: 0.4, drop: 0.7, pre: 0.15, verse: 0, bridge: -0.1, intro: -0.4, outro: -0.4, break: -0.5 }[p.kind] ?? 0;
    if (peaks[i] != null && hi != null && pMed != null && hi > pMed) energy = 0.5 * energy + clamp((peaks[i] - pMed) / (hi - pMed), -1, 1);
    if (p.shout) energy += 0.4;
    const first = (p.kind !== prevKind && prevKind !== null) || l.t - prevEnd > 7000 || prevKind === null;
    prevKind = p.kind;
    prevEnd = Math.max(l.t, b);
    const mood = lineMood(text)?.v ?? 0;
    return { i, kind: p.kind, n, rate, rap, ballad, energy: clamp(energy, -1, 1.2), shout: p.shout, first, mood, text, dropIn: dropIn.has(i), beats: !!(beats && real), words: ws.length > 0, lettersOk: lettersOk(ws, l.who), key: lineKey(text) || "#" + i };
  });

  // 1b. Bogen des Songs. Pre-Chorus: Fortschritt im Block (build 0 … 1 – der Satz wird enger, die Auftritte kürzer und
  // kräftiger), die letzte Zeile vor dem Refrain steigt (riser). Große Momente: die erste Zeile des ersten und des
  // letzten Refrains. Ruf und Antwort: die antwortende Zeile spielt dieselbe Inszenierung von der anderen Seite.
  const arc = L.map(() => ({ build: 0, riser: 0, moment: false, call: false, resp: -1 }));
  for (let i = 0; i < feats.length; ) {
    if (feats[i]?.kind !== "pre") {
      i++;
      continue;
    }
    const idx = [];
    let j = i;
    for (; j < feats.length && (!feats[j] || feats[j].kind === "pre"); j++) if (feats[j]) idx.push(j);
    idx.forEach((k, m) => (arc[k].build = r2((m + 1) / idx.length)));
    const last = idx[idx.length - 1], nx = feats.slice(last + 1).find(Boolean);
    if (nx && (nx.kind === "chorus" || nx.kind === "drop")) arc[last].riser = clamp(Math.round(L[nx.i].t - L[last].t), 800, 8000);
    i = j;
  }
  const chorusStarts = feats.filter((f) => f && f.words && f.first && (f.kind === "chorus" || f.kind === "drop")).map((f) => f.i);
  if (chorusStarts.length) {
    arc[chorusStarts[0]].moment = true;
    if (chorusStarts.length > 1) arc[chorusStarts[chorusStarts.length - 1]].moment = true;
  }
  for (let i = 0; i + 1 < L.length; i++) {
    const f = feats[i], g = feats[i + 1];
    if (!f || !g || arc[i].resp >= 0 || !answers(L[i], L[i + 1])) continue;
    arc[i].call = true;
    arc[i + 1].resp = i;
    g.resp = i;
  }

  // 2. Wörter: Betonung, Wortbilder, Schlüsselwort (vor der Wahl der Inszenierung: „key“ braucht sie)
  const infoOf = (p, i) => {
    const ws = p.ws;
    if (!ws.length) return null;
    const starts = [];
    let joined = "";
    for (const w of ws) {
      starts.push(joined.length);
      joined += String(w.text || "") + " ";
    }
    const at = (pos) => seek(starts.map((x) => ({ at: x })), pos, "at");
    // derbe Wörter wachsen nie (auch ohne eigene Bewegung)
    const no = new Set();
    for (const [s0, s1] of explicitSpans(joined, hitsOf)) for (let k = at(s0); k >= 0 && k <= at(s1 - 1); k++) no.add(k);
    const lastW = ws[ws.length - 1]?.text, nb = [L[i - 1], L[i + 1], L[i - 2]].map((x) => String(x?.text || "").trim().split(/\s+/).pop());
    const em = emphasis(ws, { segs, avg: d?.avg, synthetic: !real, rhyme: nb.some((x) => rhymes(lastW, x)), hook, no });
    // Wortbilder: die Zeile als Text, Treffer auf die Wörter zurückgelegt; höchstens zwei je Zeile, die wichtigsten.
    // Auch ohne Bewegung gesucht: die Farbe gehört zum ruhenden Satz
    const cues = new Map(), concept = new Map(), calmAt = new Set();
    const ms = match(joined, !!soft[i]).sort((x, y) => (FXPRI[y.cue] ?? 3) * (y.conf ?? 1) - (FXPRI[x.cue] ?? 3) * (x.conf ?? 1));
    for (const m of ms) {
      if (cues.size >= 2) break;
      // Wortgruppen („on fire“, „broken heart“) bewegen ihr letztes Wort – das trägt die Bedeutung
      const k = at(m.at + m.len - 1);
      if (k >= 0 && !cues.has(k) && !ws[k].bg) {
        cues.set(k, m.cue);
        if (m.calm) calmAt.add(k);
        concept.set(k, m.c);
      }
    }
    const kw = keyWord(ws, em, cues, no);
    return { em, cues, concept, kw, no, calmAt };
  };
  const wordInfo = [];
  for (let i = 0; i < pre.length; i++) {
    wordInfo.push(infoOf(pre[i], i));
    if (i % 6 === 5) yield;
  }
  feats.forEach((f, i) => {
    if (!f) return;
    const wi = wordInfo[i];
    f.keyStrength = wi ? wi.kw.strength : 0;
    f.cues = new Set(wi ? wi.cues.values() : []);
  });
  const treat = pickTreatments(feats, deck);

  // 3. Schriften: Rolle je Zeile (Rezept, Teil, Wortbild), Pinsel nur für ein Wort oder einen kurzen Ruf – dann die
  // Fenster-Regel über den ganzen Song
  const fontsRaw = pre.map((p, i) => {
    const f = feats[i], t = treat[i];
    if (!f || !t) return null;
    const line = lineRole({ ...f, t }, deck.fonts, level);
    let word = "";
    const wi = wordInfo[i];
    if (deck.fonts.includes("marker") && level !== "subtle") {
      if (level === "wild" && f.shout && markerOk(p.text, f.n) && !line) return { line: "marker", word: "" };
      if (t === "key" && wi && wi.kw.k >= 0 && markerOk(p.ws[wi.kw.k].text, 1)) word = "marker";
    }
    if (!word && !line && wi && deck.fonts.includes("wide")) for (const [k, c] of wi.cues) if ((c === "jolt" || c === "neon") && covers("wide", p.ws[k].text)) word = "wide";
    return { line, word };
  });
  const fonts = limitFonts(fontsRaw, { max: 2, share: level === "wild" ? 0.6 : 0.4 });

  // 4. Klassen und Variablen
  // erster Einsatz einer Zeile (Wortzeiten, sonst ihr Anfang) und Dauer einer Zeile bis zur nächsten
  const firstA = (j) => (j < 0 || j >= L.length ? (j < 0 ? -Infinity : Infinity) : Number.isFinite(wordLists?.[j]?.[0]?.a) ? wordLists[j][0].a : L[j].t);
  const lastA = (j) => {
    const w = wordLists?.[j];
    return w?.length && Number.isFinite(w[w.length - 1].a) ? w[w.length - 1].a : j >= 0 && j < L.length ? L[j].t : -Infinity;
  };
  const dur = (j) => (j + 1 < L.length && j < L.length ? L[j + 1].t - L[j].t : Infinity);
  const lineOf = (p, i) => {
    const { l, ws } = p;
    const lineDur = dur(i), nextA = firstA(i + 1);
    const cls = [], vars = {};
    const t = treat[i] || "";
    const R = RECIPES[t];
    cls.push(sectionStyle(sectionKind(parts, l.t), { repeated: p.repeated }));
    const lc = lenClass(p.text);
    if (lc) cls.push(lc);
    if (l.text === "♪") cls.push("is-p-note");
    if (t) cls.push("is-t-" + t);
    if (dropIn.has(i) && !still) cls.push("is-p-drop");
    const side = voiceSide(l.who);
    if (side) cls.push(side);
    if (p.adlib) {
      const pose = adlibPose(adl++);
      cls.push("is-p-adlib");
      vars["--pr"] = pose.rot + "deg";
      vars["--px"] = pose.dx + "em";
    } else if (ws.some((w) => w.bg)) {
      // Hintergrund mitten in der Zeile: nur die Neigung (die Wörter selbst tragen .is-bg)
      vars["--pr"] = adlibPose(adl++).rot + "deg";
    }
    if (shouts < maxShout && p.shout) {
      cls.push("is-p-shout");
      shouts++;
    }
    const fo = fonts[i] || { line: "", word: "" };
    if (fo.line) cls.push("is-f-" + fo.line);
    // Stimmung der ganzen Zeile als leichte Farbe (Nacht/Trauer, Hoffnung/Freude)
    const f = feats[i];
    const tint = f && !l.who ? (f.mood <= -0.5 ? "dark" : f.mood >= 0.6 ? "light" : "") : "";
    if (tint) cls.push("is-k-" + tint);
    const wi = wordInfo[i];
    // Spielart: Richtung, Stärke, Kurve – aus Deck, Teil und Wiederholung
    const kind = p.kind;
    const A = arc[i];
    // Ruf von links, Antwort von rechts (sonst fester Zufall je Zeile)
    const dir = A.call ? -1 : A.resp >= 0 ? 1 : hash01(deck.seed + "|dir|" + (f?.key || i) + "|" + i) < 0.5 ? -1 : 1;
    let amp = deck.amp * (AMP[kind] ?? 1) * (level === "wild" ? 1.15 : 1);
    if (kind === "pre") amp *= 0.85 + 0.45 * A.build;
    if (A.moment) amp *= 1.15;
    if (level === "subtle") amp = 0.55;
    if (f) {
      // ruhender Satz (gilt auch ohne Bewegung): Aufbau wird enger, der große Moment größer (nur kurze Zeilen)
      if (A.build) {
        cls.push("is-p-build");
        vars["--pbu"] = String(A.build);
      }
      if (A.moment && f.n <= 6 && [...p.text].length <= 32) cls.push("is-p-big");
      if (A.resp >= 0 && !l.who) cls.push("is-p-resp");
      if (!still) {
        if (A.moment) cls.push("is-p-moment");
        if (A.riser) {
          cls.push("is-p-riser");
          vars["--prd"] = A.riser + "ms";
        }
        // Übergabe: so geht die Zeile ab, wenn die nächste dran ist (passend zu ihrem Auftritt)
        if (t && level !== "subtle") {
          // der Abgang läuft, während die nächste Zeile dran ist: höchstens gut die Hälfte ihrer Dauer (sonst keiner)
          const nd = dur(i + 1);
          const xt = nd < FAST_LINE ? Math.round(clamp(0.55 * nd, 0, 500)) : 500;
          if (xt >= 150) {
            vars["--pxo"] = exitOf(t);
            vars["--pxd"] = String(dir);
            if (xt < 500) vars["--pxt"] = xt + "ms";
          }
        }
        // großer Moment: der Einschlag ist vorbei, bevor die nächste Zeile kommt
        if (A.moment && lineDur < 950) vars["--pmd"] = Math.round(clamp(0.9 * lineDur, 250, 850)) + "ms";
      }
    }
    // kurze Zeile: Farbe, Größe und Lage (auch die Gleitfahrt des Texts, immersive.js) in 80 % ihrer Dauer statt 0,5–0,8 s
    if (lineDur < FAST_LINE && String(l.text || "").trim()) {
      cls.push("is-p-fast");
      vars["--plt"] = Math.round(clamp(0.8 * lineDur, 150, 700)) + "ms";
    }
    const easeKey = R?.ease || (kind === "chorus" || kind === "drop" ? deck.ease[0] : deck.ease[1]);
    const v = t ? `${t}:${dir > 0 ? "r" : "l"}:${Math.round(amp * 10)}:${easeKey}` : "";
    if (t && !still) {
      vars["--pez"] = EASE[easeKey] || EASE.expo;
      if (R?.ln) cls.push("is-l-" + R.ln);
    }
    if (!wi) {
      if (tint) cls.push("is-pk");
      return { t, v, cls, vars, font: fo, words: [] };
    }
    const { em, cues, concept, kw, calmAt } = wi;
    const hold = heldNotes(ws);
    const n = ws.length, mid = (n - 1) / 2, half = Math.ceil(n / 2);
    // Aufbau: je weiter im Pre-Chorus, desto kürzer (schneller) die Landungen – bis zu 30 %, nie unter 90 ms
    const lead = still ? 0 : Math.max(90, Math.round(leadOf(t) * (1 - 0.3 * A.build)));
    // Hook-Wort der Zeile (höchstens eins): das Erkennungszeichen des Songs
    const hookAt = level === "subtle" ? -1 : ws.findIndex((w, k) => !w.bg && !wi.no.has(k) && sigWords.has(bare(w.text)));
    let coloured = !!tint;
    const wideAt = fo.word === "wide" ? [...cues].find(([, c]) => c === "jolt" || c === "neon")?.[0] : -1;
    const words = ws.map((w, k) => {
      const wc = [], wv = {};
      if (em[k].cls) wc.push(em[k].cls);
      if (em[k].z !== 1) wv["--pz"] = String(em[k].z);
      const isKey = k === kw.k && (t === "key" || t === "wave");
      if (isKey) {
        wc.push("is-p-key");
        // je länger das Wort, desto weniger wächst es; --pkn (Zeichen) begrenzt es zusätzlich auf die Spaltenbreite
        if (t === "key") wv["--pk"] = String(r2(clamp(2.6 - 0.12 * [...bare(w.text)].length, 1.6, 2.4)));
        wv["--pkn"] = String(Math.max(2, [...String(w.text)].length));
      }
      if (t === "split") wc.push(k < half ? "is-p-l" : "is-p-r");
      if (t === "stagger" && k % 2 === 1) wc.push("is-p-odd");
      if (t === "collide" && n > 1) wv["--pc"] = String(r2((k - mid) / Math.max(1, mid)));
      if ((fo.word === "marker" && k === kw.k) || k === wideAt) wc.push("is-f-" + fo.word);
      if (k === hookAt) {
        wc.push("is-p-hook", "is-p-hm-" + deck.hookMark);
        // zweite Schrift, die das Hook-Wort auf der Eins jedes zweiten Takts annimmt (immersive.js): nur kurze Zeilen, nur
        // Schriften dieses Songs, die das Wort können und etwa so breit sind wie die Liedtext-Schrift
        const alt = !still && level !== "subtle" && n <= 6 ? deck.fonts.find((r) => ["shout", "round", "serif", "marker"].includes(r) && r !== fo.line && r !== fo.word && covers(r, w.text)) : "";
        if (alt) wv["--phf"] = "var(--pf-" + alt + ")";
      }
      // Farbe aus der Bedeutung (auch ohne Bewegung; Duett-Farben haben Vorrang)
      const c = cues.get(k);
      const ck = c && !l.who ? CUE_KIND[c] : "";
      if (ck) {
        wc.push("is-k", "is-k-" + ck);
        if (ck === "fire" || ck === "gold" || ck === "neon") wc.push("is-kg");
        coloured = true;
      }
      let chars = false, tx = "";
      // Zeit bis zum nächsten Einsatz (Wort) und bis zum ersten der nächsten Zeile; Abstand zum vorigen Einsatz
      const a = Number.isFinite(w.a) ? w.a : l.t;
      const room = nextA - a, roomNext = (k + 1 < n && Number.isFinite(ws[k + 1].a) ? ws[k + 1].a : nextA) - a;
      const gapIn = a - (k > 0 && Number.isFinite(ws[k - 1].a) ? ws[k - 1].a : lastA(i - 1));
      const wl = lead ? Math.floor(clamp(Math.min(lead, 0.9 * gapIn), LEAD_MIN, lead)) : 0;
      const out = { cls: wc, vars: wv, lead: wl };
      if (!still) {
        // Wartezustand (wo das Wort vor seinem Einsatz steht) und Vorlauf
        const len = [...String(w.text)].length;
        const useLetters = !!R?.L && (lettersOk(ws, l.who) || isKey) && canSplit(w.text);
        if (!useLetters) Object.assign(wv, poseVars(wordPose(t, { k, n, dir, amp, len, key: isKey, seed: deck.seed + "|" + i })));
        if (wl) wv["--pl"] = wl + "ms";
        // gehaltener Ton: dehnt sich nur, solange die Zeile dran ist
        const hd = Math.min(hold[k].hd, Math.round(0.95 * room));
        if (hold[k].held && hd >= 200) {
          wc.push("is-p-held");
          wv["--hd"] = hd + "ms";
        }
        if (beats && real && !w.est && onBeat(w.a, beats)) wc.push("is-p-beat");
        if (bars?.length && real && !w.est && onBeat(w.a, bars, 70)) wc.push("is-p-bar");
        let acc = R?.acc || "";
        // das riesige Schlüsselwort ist selbst der Akzent: kein Stoß hinterher (er schob es über seine Nachbarn)
        if (isKey && acc === "pop") acc = "";
        // Wortbild-Bewegung ist Zierde: nur, wenn bis zur nächsten Zeile Zeit dafür bleibt (die Farbe bleibt immer)
        const fxOk = room >= FX_ROOM;
        if (c && !calmAt.has(k) && fxOk) {
          wc.push("is-p-cue", "is-c-" + c);
          // Spielart des Wortbilds: je Begriff und Song eine andere
          const fv = fxVariant(c, concept.get(k) || c, deck.fx);
          if (fv?.n) Object.assign(wv, fxVars(fv));
          if (fv?.pt && level !== "subtle") {
            wc.push("is-pt");
            Object.assign(wv, particleVars(fv.pt));
          }
          if (GLOWS.has(c)) {
            wc.push("is-cg");
            tx = String(w.text || "");
          }
          if (LETTERS.has(c) && canSplit(w.text) && !l.who && level !== "subtle") chars = true;
        }
        if (isKey && t === "wave" && canSplit(w.text) && !l.who && fxOk) chars = true;
        if (useLetters) chars = letterPoses(t, w.text, { k, n, dir, amp, seed: deck.seed + "|" + i, lead: wl });
        if (chars) {
          // bewegte Buchstaben und eine stille Kopie des ganzen Worts passen nicht übereinander: kein Schein
          if (tx) {
            wc.splice(wc.indexOf("is-cg"), 1);
            tx = "";
          }
          wc.push("is-split");
          wv["--cn"] = String([...String(w.text)].length);
        }
        // Hook-Wort: immer dasselbe Zeichen (statt des Akzents des Rezepts)
        if (k === hookAt) acc = deck.hook;
        // Echo braucht die Kopie (::before) für sich
        if (acc === "echo" && (tx || chars)) acc = "";
        if (acc === "echo") tx = String(w.text || "");
        // schneller Rap: je Silbe ein kurzer Stoß, über die gesungene Dauer des Worts verteilt (Silben grob, höchstens vier)
        let pad = ACCENTS[acc] || 0;
        if (!acc && f?.rap && !w.est && !chars && w.b - w.a >= 120) {
          const sy = clamp(syllables(w.text), 1, 4), per = Math.round((w.b - w.a) / sy);
          if (per >= 70) {
            acc = "syl";
            pad = Math.min(260, per);
            if (sy > 1) wv["--pai"] = String(sy);
          }
        }
        if (!acc && wc.includes("is-p-bar")) acc = "bar";
        else if (!acc && wc.includes("is-p-beat")) acc = "beat";
        // Akzent (alle Durchgänge) endet vor dem ersten Einsatz der nächsten Zeile und höchstens 2,5 Wortabstände
        // nach dem eigenen – zu kurz für einen sichtbaren Stoß: keiner
        let ad = pad || ACCENTS[acc] || 0;
        if (acc) {
          const cnt = Number(wv["--pai"]) || 1, cap = Math.min(0.9 * room, Math.max(180, 2.5 * roomNext));
          if (ad * cnt > cap) ad = Math.floor(cap / cnt);
          if (ad < (acc === "syl" ? 70 : ACC_MIN)) acc = "";
        }
        if (acc && level !== "subtle") {
          // Echo: nur die blasse Kopie (::before) zieht nach – das Wort selbst bekam vorher dieselbe Ausblendung als
          // Akzent und war auf dem Einsatz halb durchsichtig (e2e „playful schnell“)
          if (acc !== "echo") wv["--pac"] = "m-a-" + acc;
          wv["--pad"] = ad + "ms";
          if (acc === "echo") wc.push("is-echo");
        } else {
          delete wv["--pai"];
          if (tx && !wc.includes("is-cg")) tx = "";
        }
        if (R?.caret && !c) wc.push("is-caret");
      }
      if (chars) out.chars = chars;
      if (tx) out.tx = tx;
      return out;
    });
    if (coloured) cls.push("is-pk");
    return { t, v, cls, vars, font: fo, words };
  };
  const plan = [];
  for (let i = 0; i < pre.length; i++) {
    plan.push(lineOf(pre[i], i));
    if (i % 6 === 5) yield;
  }
  plan.deck = deck;
  return plan;
}

/* ---- Last: wie viele Elemente einer Zeile höchstens gleichzeitig animiert sind (Wörter + Buchstaben) */
// Für den Leistungs-Test: die Bewegung bleibt auf die aktive Zeile (±1) beschränkt, also zählt je Zeile.
export function motionLoad(linePlan) {
  if (!linePlan) return 0;
  let n = linePlan.cls.some((c) => c.startsWith("is-l-")) || ["punch", "slam", "collide", "tilt"].includes(linePlan.t) ? 1 : 0;
  for (const w of linePlan.words || []) {
    if (Array.isArray(w.chars)) n += w.chars.length;
    else {
      const moving = w.cls.some((c) => c.startsWith("is-c-") || c === "is-p-held" || c === "is-p-beat") || Object.keys(w.vars).some((k) => k.startsWith("--w")) || "--pac" in w.vars;
      if (moving) n++;
      if (w.chars) n += Number(w.vars["--cn"]) || 0;
    }
    if (w.cls.includes("is-cg") || w.cls.includes("is-echo")) n++;
    if (w.cls.includes("is-pt")) n++;
  }
  return n;
}

/* ---- An die Zeilen setzen (DOM) – nur beim Aufbau und wenn die Analyse nachkommt */
const PCLS = /^(is-p-|is-t-|is-c-|is-f-|is-k|is-l-)/;
const PONE = new Set(["is-cg", "is-split", "is-pt", "is-echo", "is-caret", "is-pk", "is-pnext", "is-pcar"]);
const mine = (c) => PCLS.test(c) || PONE.has(c);
// Ein Element auf seinen Soll-Stand bringen – nur die Unterschiede (Klassen, Variablen, Buchstaben, Kopie): ein
// zweites Malen (die Analyse kommt nach, Umschalten) lässt so alles Unveränderte in Ruhe, statt jede Zeile und jedes
// Wort neu berechnen zu lassen. Welche Variablen gesetzt sind, merkt sich das Element (__pv).
function sync(el, cls, vars, text, chars, tx) {
  if (!el) return;
  const want = new Set(cls || []);
  const drop = [];
  for (const c of el.classList) if (mine(c) && !want.has(c)) drop.push(c);
  if (drop.length) el.classList.remove(...drop);
  const add = [...want].filter((c) => !el.classList.contains(c));
  if (add.length) el.classList.add(...add);
  const had = el.__pv || {}, now = vars || {};
  for (const k of Object.keys(had)) if (!(k in now)) el.style.removeProperty(k);
  for (const [k, v] of Object.entries(now)) if (had[k] !== v) el.style.setProperty(k, v);
  el.__pv = { ...now };
  if ((tx || null) !== (el.dataset?.tx ?? null)) {
    if (tx) el.dataset.tx = tx;
    else delete el.dataset.tx;
  }
  if (text == null) return;
  // in Buchstaben zerlegt: nur neu, wenn sich die Zerlegung ändert; sonst wieder ein Text
  const key = chars ? JSON.stringify(chars) : "";
  const split = !!el.firstElementChild?.classList?.contains("m-ch");
  if (split && el.__pch === key) return;
  if (split) el.textContent = text;
  el.__pch = key;
  if (chars) letters(el, text, chars);
}
// Wort in Buchstaben (je .m-ch mit --ci); die Karaoke-Füllung rechnet daraus je Buchstabe ihren Stand.
// poses: je Buchstabe Wartezustand und Staffelung (--ld) aus dem Rezept
function letters(el, text, poses) {
  const doc = el.ownerDocument;
  if (!doc || el.firstElementChild) return;
  el.textContent = "";
  [...String(text)].forEach((ch, k) => {
    const s = doc.createElement("span");
    s.className = "m-ch";
    s.textContent = ch;
    s.style.setProperty("--ci", k);
    const p = Array.isArray(poses) ? poses[k] : null;
    if (p) {
      if (p.ld) s.style.setProperty("--ld", p.ld + "ms");
      for (const [kk, v] of Object.entries(p.vars)) s.style.setProperty(kk, v);
    }
    el.append(s);
  });
}
function paintLine(el, p, ws) {
  if (!el) return;
  el.__hook = undefined;
  sync(el, p?.cls, p?.vars);
  ws.cAt = -1;
  ws.caret = false;
  ws.forEach((w, k) => {
    const pw = p?.words?.[k];
    w.lead = pw?.lead || 0;
    if (pw?.cls.includes("is-caret")) ws.caret = true;
    sync(w.el, pw?.cls, pw?.vars, w.text, pw?.chars || false, pw?.tx || "");
  });
}
// lineEls: die Zeilen-Elemente (gleiche Reihenfolge wie lines), wordLists[i][k].el: das Wort-Element.
// plan = null: alles wieder entfernen (Option aus). Merkt sich den Vorlauf je Wort (wordLists[i][k].lead).
// Als Generator: zuerst die Zeilen um at (die aktive), dann nach außen – je Häppchen ein paar Zeilen
export function* paintSteps(lineEls, plan, wordLists, at = 0) {
  const n = lineEls?.length || 0;
  const c = Math.max(0, Math.min(n - 1, at | 0));
  for (let r = 0, done = 0; done < n; r++) {
    for (const i of r ? [c - r, c + r] : [c]) {
      if (i < 0 || i >= n) continue;
      paintLine(lineEls[i], plan?.[i], wordLists?.[i] || []);
      if (++done % 2 === 0) yield;
    }
  }
}
export const paintPlayful = (lineEls, plan, wordLists, at) => runSync(paintSteps(lineEls, plan, wordLists, at));

/* ---- ♪ (Instrumental-Lücke): wippt im Takt, auf der Eins stärker. Lage im Takt (vier Schläge) beim Zeilenwechsel */
// → { p: Schlaglänge, bar: Taktlänge, d: Verzögerung (negativ: so weit ist der Takt schon) } oder null
export function barPhase(beats, bars, sec) {
  const b = beatPhase(beats, sec);
  if (!b) return null;
  const bar = 4 * b.p;
  let start = null;
  if (bars?.length) {
    const k = seek(bars, sec, "t");
    if (k >= 0) start = bars[k].t;
  }
  if (start == null) {
    const k = seek(beats, sec, "t");
    start = beats[k - (k % 4)].t;
  }
  return { p: b.p, bar, d: -Math.round(((sec - start) * 1000) % bar) };
}

/* ---- ♪ im Takt, Bild für Bild aus der Songuhr (statt einer frei laufenden CSS-Schleife, die abdriftete und beim
   Neustart sprang). Jeder Schlag ist ein Hügel cos²(π·φ) (φ = Lage im Schlag 0 … 1): Spitze genau auf dem Schlag,
   null in der Mitte zwischen zwei Schlägen – dort wechseln Seite und Stärke, Wert und Steigung sind dort beide null,
   der Lauf ist also ohne Knick (C1). Auf der Eins des Takts der große Ausschlag. amp: Stärke der Stufe.
   → { y (em), r (Grad), s (Größe), beat, down } oder null */
const isDown = (beats, bars, k) => (bars?.length ? onBeat(beats[k].t * 1000, bars, 70) : k % 4 === 0);
export function notePose(beats, bars, sec, amp = 1) {
  if (!beats?.length) return null;
  const k = seek(beats, sec, "t");
  if (k < 0 || k + 1 >= beats.length) return null;
  const p = beats[k + 1].t - beats[k].t;
  if (!(p >= 0.25 && p <= 1.5)) return null;
  const ph = clamp((sec - beats[k].t) / p, 0, 1);
  const near = ph < 0.5 ? k : k + 1;
  const g = Math.cos(Math.PI * ph) ** 2;
  const down = isDown(beats, bars, near);
  const a = (down ? 1 : 0.45) * amp;
  return { y: -0.2 * a * g, r: (near % 2 ? 1 : -1) * 15 * a * g, s: 1 + 0.1 * a * g, beat: near, down };
}
// Farbe des ♪: fließt im Takt durch die Leitfarben des Covers (ring: lesbare Farben, je Takt die nächste, weich
// übergeblendet – ohne Sprung an den Taktgrenzen). → [r, g, b]
export function noteColor(ring, beats, bars, sec) {
  if (!ring?.length) return null;
  let i0 = 0, u = 0;
  if (bars?.length >= 2) {
    const k = seek(bars, sec, "t");
    if (k >= 0 && k + 1 < bars.length) {
      i0 = k;
      u = (sec - bars[k].t) / (bars[k + 1].t - bars[k].t);
    }
  } else if (beats?.length >= 2) {
    const k = seek(beats, sec, "t");
    if (k >= 0 && k + 1 < beats.length) {
      i0 = Math.floor(k / 4);
      u = ((k % 4) + (sec - beats[k].t) / (beats[k + 1].t - beats[k].t)) / 4;
    }
  }
  const x = clamp(u, 0, 1), w = x * x * (3 - 2 * x);
  const a = ring[i0 % ring.length], b = ring[(i0 + 1) % ring.length];
  return a.map((v, j) => Math.round(v + (b[j] - v) * w));
}
