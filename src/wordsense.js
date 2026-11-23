/* ---------------------------------------------------------------- Wortsinn (Party-Modus) */
// Plant je Song, auf welche gesungenen Wörter die Bühne antwortet – einmal, wenn der Liedtext da ist, statt auf
// jeden nackten Treffer im Wörterbuch zu reagieren. „Lieber nichts als falsch“:
//  · Verneinung je Sprache: „no fire“, „kein Geld“, „sin amor“, „je n'ai pas peur“, „para yok“, „Ich liebe dich
//    nicht“ → keine Antwort (oder die Gegenstimmung, wo sie passt: „no love“ wird Herzschmerz)
//  · Wortsinn: Wortgruppen sind Einheiten („set the world on fire“, „make it rain“ = Geld, nicht Regen), ein
//    Treffer in einer längeren Wortgruppe zählt nicht doppelt, „fire alarm“/„Feuerwehr“ sind kein Feuer
//  · Stimmung des Songs: in einem traurigen Lied wird aus Pyro warmes Glühen, aus „Party“ nur Farbe (soft)
//  · Wiederholung: beim ersten Mal voll, danach kleiner, im letzten Refrain wieder voll
//  · mehrere Treffer in einer Zeile → eine stärkere, kombinierte Antwort (also: weitere Begriffe)
//  · Sicherheit je Antwort (conf 0..1) mit Schwelle: häufige, vieldeutige Wörter („time“, „home“, „yeah“)
//    brauchen mehr Rückhalt als eindeutige („fireworks“, „tequila“)
// Rein rechnend und deterministisch (testbar); läuft einmal je Song, nicht je Bild.
import { lineMood } from "./mood.js";

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const TOKEN = /[\p{L}\p{M}\p{N}'’]+/gu;
const low = (s) => String(s || "").normalize("NFC").toLocaleLowerCase();
// Satzzeichen trennen Teilsätze: eine Verneinung wirkt nicht über ein Komma hinweg („no, no – fire!“)
const BREAK = /[,;.!?:()–—"“”«»¿¡]/;

// Schwelle der Sicherheit: darunter keine Antwort
const THR = 0.5;
// Sicherheit nach Art des Treffers
const HOW = { phrase: 0.95, exact: 0.82, pre: 0.62, sub: 0.7, tr: 0.62 };
// Begriffe, die in fast jedem Lied stehen oder mehrere Bedeutungen haben: weniger sicher
const CW = {
  time: 0.55, world: 0.7, light: 0.75, love: 0.75, home: 0.6, freedom: 0.72, lonely: 0.8, run: 0.7, move: 0.75, body: 0.78,
  lost: 0.68, memory: 0.75, smile: 0.78, hope: 0.78, together: 0.75, night: 0.6, sky: 0.8, heart: 0.85, music: 0.8, sing: 0.8,
  drive: 0.75, city: 0.8, street: 0.8, dream: 0.8, fly: 0.8, water: 0.8, dark: 0.8, rise: 0.75, touch: 0.75, war: 0.8, sweet: 0.75,
  victory: 0.75, everybody: 0.8, yeah: 0.65, hey: 0.7, strong: 0.78, pain: 0.8, happy: 0.8, sad: 0.85, goodbye: 0.8, sleep: 0.78,
  silence: 0.75, peace: 0.8, black: 0.75, white: 0.75, red: 0.8, blue: 0.75, green: 0.8, crown: 0.85, shake: 0.85, boss: 0.85,
  journey: 0.8, morning: 0.8, wild: 0.85, fear: 0.82, sexy: 0.92,
  // neue Begriffe (lex-ext.json), die in vielen Liedern nebenbei stehen
  god: 0.62, soul: 0.62, beautiful: 0.62, friends: 0.68, family: 0.7, truth: 0.66, faith: 0.72, promise: 0.7, regret: 0.72, lies: 0.75,
  fun: 0.72, danger: 0.78, work: 0.68, car: 0.78, phone: 0.56, lighter: 0.55, shopping: 0.58, waiting: 0.55, school: 0.58, tired: 0.58, forget: 0.55, eyes: 0.55, voice: 0.58,
  fall: 0.6, hair: 0.58, feet: 0.6, wall: 0.6, hide: 0.62, stranger: 0.62, reality: 0.62, success: 0.68, respect: 0.68, broke: 0.62, calm: 0.62,
  gentle: 0.66, numb: 0.68, doubt: 0.66, nature: 0.66, stone: 0.62, dust: 0.62, ticket: 0.66, social: 0.66, message: 0.62, crash: 0.68,
  knock: 0.66, buzz: 0.62, engine: 0.68, float: 0.66, book: 0.6, partner: 0.68, death: 0.7, kill: 0.78, shoot: 0.8, grow: 0.62, park: 0.62, screen: 0.72, stage: 0.8, crowd: 0.8, wish: 0.72, destiny: 0.78,
  infinity: 0.72, passion: 0.78, chill: 0.68, excited: 0.78, mystery: 0.75, escape: 0.72, praise: 0.9, vibes: 0.75, shatter: 0.78,
  echo: 0.75, rhythm: 0.75, tunnel: 0.78, goal: 0.72, race: 0.75, dice: 0.72,
};

/* ---- Lob-Wörter („f-words“): dasselbe Wort lobt („das ist geil“, „that beat is sick“, „c'est le feu“) oder meint
   es wörtlich („geil auf dich“, „sick of you“, „il fait chaud“). Je Sprache und Wort:
   d = Begriff ohne Hinweise (null = keine Antwort), lit = [Muster, Begriff] für die wörtliche Bedeutung (null = keine
   Antwort), sex = Begriff bei sinnlichem Zusammenhang, pr = Muster, das sicher Lob ist. Reihenfolge: wörtlich,
   sinnlich, Lob (eigenes Muster oder Lob-Umfeld der Sprache), sonst d. Lob → Begriff „praise“ (Energie). */
const PRAISE_CTX = {
  en: /\b(?:beat|beats|track|song|tune|party|club|crowd|vibe|vibes|flow|bars|verse|show|banger|tonight|dj|drop|bass|this shit|that shit)\b/,
  de: /\b(?:party|beat|song|track|abend|nacht|show|stimmung|vibe|bass|feier|konzert|leute|alter|digga|bro|musik|sound|einfach|voll|richtig|so|wie|mega|echt|ist das|war das)\b/,
  es: /\b(?:fiesta|rumba|party|ritmo|canción|cancion|noche|perreo|beat|flow|música|musica|ambiente|disco|pista)\b/,
  fr: /\b(?:soirée|soiree|son|morceau|fête|fete|teuf|beat|flow|ambiance|musique|boîte|boite|c'est|cest)\b/,
  it: /\b(?:festa|serata|pezzo|canzone|beat|flow|discoteca|musica|notte|è|e')\b/,
  pt: /\b(?:festa|baile|rolê|role|música|musica|batida|beat|noite|show|balada|é|tá)\b/,
  nl: /\b(?:feest|feestje|party|beat|nummer|plaat|avond|muziek|sfeer|echt|zo|super)\b/,
  pl: /\b(?:impreza|imprezka|bit|beat|kawałek|kawalek|numer|noc|melanż|melanz|muza|muzyka|to)\b/,
  tr: /\b(?:parti|şarkı|sarki|beat|gece|ortam|müzik|muzik)\b/,
};
const SEX_CTX = {
  en: /\b(?:body|bodies|naked|skin|lips|bed|sheets|kiss|touch|sexy|baby|babe|girl|boy|you're|youre|you are|lookin'?|looking|she's|he's|curves)\b/,
  de: /\b(?:auf dich|auf mich|nackt\w*|körper\w*|bett\w*|haut|sex\w*|lust|küss\w*|scharf|macht mich|machst mich|bin so geil|bin geil|geil auf|dein arsch|deine lippen|stöhn\w*|baby|nacht mit dir|mit dir allein|nur wir zwei)\b/,
  es: /\b(?:cuerpo|piel|cama|besos?|labios|desnud\w*|bebé|bebe|mami|papi|baby|sexy)\b/,
  fr: /\b(?:corps|peau|lit|baiser|lèvres|nue?s?|bébé|bebe|sexy|t'es|elle est)\b/,
  it: /\b(?:corpo|pelle|letto|baci|labbra|nud\w*|baby|sexy|sei)\b/,
  pt: /\b(?:corpo|pele|cama|beijo|lábios|nua|nu|gostosa|gostoso|novinha|baby|bebê)\b/,
  nl: /\b(?:lichaam|lijf|huid|bed|naakt|kus|lippen|op jou|op je|schatje|baby)\b/,
  pl: /\b(?:ciało|cialo|skóra|łóżko|lozko|nag\w*|usta|pocałun\w*|mała|mala)\b/,
  tr: /\b(?:vücud\w*|ten|yatak|dudak\w*|çıplak|ciplak|öp\w*|bebeğim|bebegim)\b/,
};
const SLANG = {
  en: {
    hot: { d: "fire", pr: /\b(?:track|song|beat|tune|record|single|verse)\b.*\bhot\b|\bhot (?:track|song|beat|right now)\b/, lit: [/\b(?:summer|sun|weather|degrees|outside|coffee|tea|sauce|stove|in here|heat|fire|burn\w*)\b/, "fire"], sex: "sexy" },
    sick: { d: null, lit: [/\bsick (?:of|and tired|in bed)\b|\b(?:feel|feeling|feelin'?|get|got|getting|make me|makes me|i'm|im) (?:so )?sick\b|lovesick|homesick|\bsick (?:to my|inside)\b/, null], pr: /\b(?:that's|thats|it's|its|is|was|so|real|pretty|mad|straight|this) sick\b(?! of)|\bsick (?:beat|track|flow|bars|drop|verse|song|party|show|tune|ride|whip|night)\b/ },
    lit: { d: "praise", lit: [/\blit (?:up|the|a|my|your|me|candles?|cigarettes?|it up)\b|\b(?:candles?|cigarettes?|lamps?|match|matches)\b/, null] },
    dope: { d: "praise", lit: [/\b(?:smok\w*|sell\w*|deal\w*|shoot\w*|need|score[ds]?|cop(?:ped)?|bag of|on) (?:some |the |that )?dope\b|\bdope (?:fiend|dealer|boy|house|sick)\b/, "drugs"] },
    killer: { d: "praise", lit: [/\b(?:serial|cold[- ]blooded|stone[- ]cold|the|a) killer\b|\bkiller (?:on the loose|instinct)\b|\b(?:murder\w*|knife|gun|blood|victim|police)\b/, null] },
    crazy: { d: "crazy", lit: [/\bcrazy (?:in love|about you|for you|'bout you|bout you|over you)\b/, "love"] },
    insane: { d: "crazy", pr: /\b(?:that's|thats|it's|its|is|was|so) insane\b|\binsane (?:beat|track|night|party|show|crowd|drop)\b/ },
    wild: { d: "wild", lit: [/\bwild (?:horses?|animals?|flowers?|west|life|card|cats?|thing)\b|\binto the wild\b|wildflowers?/, null] },
  },
  de: {
    geil: { d: "praise", sex: "sexy" },
    geile: { d: "praise", sex: "sexy" },
    geiles: { d: "praise", sex: "sexy" },
    geilen: { d: "praise", sex: "sexy" },
    geiler: { d: "praise", sex: "sexy" },
    krass: { d: "praise", lit: [/\bkrass\w* (?:unterschied|gegensatz|fehler|lüge)\b/, null] },
    krasse: { d: "praise" },
    krasser: { d: "praise" },
    heftig: { d: "praise", lit: [/\bheftig\w* (?:regen|sturm|wind|streit|schmerz\w*|schlag|kopfschmerz\w*|gewitter|kritik|fieber)\b|\b(?:regnet|stürmt|schneit|blutet|weh) \w* ?heftig\b/, null] },
    heftige: { d: "praise", lit: [/\bheftige (?:regen|sturm|wind|streit|schmerz\w*|gewitter|kritik)\b/, null] },
    fett: { d: "praise", lit: [/\b(?:zu fett|fett werden|fett geworden|fettes? essen|bauch\w*|dick und fett|fettig\w*|fett im|fett ab|speck)\b/, null] },
    fette: { d: "praise", lit: [/\bfette (?:wampe|sau|kuh|katze)\b/, null] },
    heiß: { d: "fire", sex: "sexy" },
    heiss: { d: "fire", sex: "sexy" },
  },
  es: {
    caliente: { d: "fire", sex: "sexy", pr: /\b(?:la fiesta|el party|la pista|el ambiente|la noche) (?:está|esta) (?:bien |muy )?caliente\b/ },
    brutal: { d: "praise", lit: [/\b(?:accidente|golpe|violencia|guerra|asesin\w*|crimen)\b/, null] },
    loco: { d: "crazy", lit: [/\bloc[oa]s? (?:por ti|de amor|por tu amor)\b|me vuelves loc[oa]/, "love"] },
    loca: { d: "crazy", lit: [/\bloc[oa]s? (?:por ti|de amor|por tu amor)\b|me vuelves loc[oa]/, "love"] },
    bomba: { d: "boom", pr: /\b(?:es|está|esta|qué|que) (?:una |la )?bomba\b/ },
  },
  fr: {
    chaud: { d: "fire", lit: [/\bil fait (?:trop |très |tres )?chaud\b|\bchaud dehors\b/, "fire"], sex: "sexy", pr: /\bc'est (?:trop |super |vraiment )?chaud\b|\bça va être chaud\b/ },
    bombe: { d: "boom", sex: "sexy", lit: [/\b(?:t'es|tu es|elle est|cette fille|quelle) une bombe\b/, "sexy"], pr: /\bc'est (?:de la |une )?bombe\b/ },
    fou: { d: "crazy", lit: [/\bfou (?:de toi|amoureux|d'amour)\b/, "love"], pr: /\bc'est (?:trop |complètement |vraiment )?fou\b/ },
    folle: { d: "crazy", lit: [/\bfolle (?:de toi|amoureuse|d'amour)\b/, "love"], pr: /\bsoirée (?:de )?folle\b/ },
    dingue: { d: "crazy", lit: [/\bdingue de toi\b/, "love"], pr: /\bc'est (?:trop |complètement )?dingue\b|\bsoirée dingue\b/ },
    feu: { d: "fire" },
  },
  it: {
    caldo: { d: "fire", sex: "sexy" },
    calda: { d: "fire", sex: "sexy" },
    bomba: { d: "boom", pr: /\b(?:è|e'|che|una) (?:una )?bomba\b/ },
    pazzo: { d: "crazy", lit: [/\bpazz[oa] (?:di te|d'amore|per te)\b/, "love"] },
    pazza: { d: "crazy", lit: [/\bpazz[oa] (?:di te|d'amore|per te)\b/, "love"] },
  },
  pt: {
    quente: { d: "fire", sex: "sexy" },
    foda: { d: "curse", pr: /\b(?:é|e|muito|mó|mo|tá|ta|que|mais) foda\b|\bfoda demais\b/ },
    louco: { d: "crazy", lit: [/\blouc[oa] (?:por você|por voce|por ti|de amor)\b/, "love"] },
    louca: { d: "crazy", lit: [/\blouc[oa] (?:por você|por voce|por ti|de amor)\b/, "love"] },
    bomba: { d: "boom", pr: /\b(?:é|e|tá|ta) (?:uma )?bomba\b/ },
  },
  nl: {
    geil: { d: "praise", sex: "sexy" },
    geile: { d: "praise", sex: "sexy" },
    vet: { d: "praise", lit: [/\b(?:vet eten|te vet|vetrol\w*|dik en vet|vet van|vet in)\b/, null] },
    vette: { d: "praise", lit: [/\bvette (?:hap|snack|frieten?)\b/, null] },
    ziek: { d: null, lit: [/\b(?:ben|was|word|werd|voel me|zo) ziek(?: van)?\b|\bziek (?:van|in bed|thuis)\b|\bziekenhuis\b/, null], pr: /\b(?:echt|super|zo) ziek\b(?! van)|\bziek (?:feest|nummer|beat)\b/ },
    zieke: { d: "praise" },
    gek: { d: "crazy", lit: [/\bgek (?:op jou|op je|van jou|van je|op mij)\b/, "love"] },
  },
  pl: {
    ogień: { d: "fire", pr: /\bto (?:jest )?ogień\b|\bogień na\b/ },
    bomba: { d: "boom", pr: /\b(?:to|jest) (?:jest )?bomba\b/ },
    petarda: { d: "praise", lit: [/\bpetard\w* (?:wybuch\w*|huk)\b|\b(?:rzucił\w*|odpalił\w*) petard\w*/, "boom"] },
    szalony: { d: "crazy", lit: [/\bszalon\w* (?:za tobą|z miłości)\b|\bszaleję za tobą\b/, "love"] },
  },
  tr: {
    efsane: { d: "praise" },
    ateş: { d: "fire", pr: /\bateş gibi (?:bir )?(?:parti|gece|şarkı|ortam)\b/ },
    bomba: { d: "boom", pr: /\bbomba gibi\b|\bbomba (?:oldu|parça|şarkı|gibisin)\b/ },
    deli: { d: "crazy", lit: [/\bdeli(?:ler)? gibi (?:sev\w*|aşık\w*)\b|\bsana deli\w*\b/, "love"] },
    çılgın: { d: "crazy", pr: /\bçılgın (?:gece|parti|bir gece|ortam)\b/ },
  },
};
// \b gilt in JavaScript nur für ASCII-Buchstaben („está“, „çılgın“, „heiß“): Wortgrenzen für alle Schriften
const WB = "(?:(?<![\\p{L}\\p{N}])(?=[\\p{L}\\p{N}])|(?<=[\\p{L}\\p{N}])(?![\\p{L}\\p{N}]))";
const uni = (re) => new RegExp(re.source.replace(/\\b/g, WB), "u");
for (const T of [PRAISE_CTX, SEX_CTX]) for (const k of Object.keys(T)) T[k] = uni(T[k]);
for (const words of Object.values(SLANG)) {
  for (const r of Object.values(words)) {
    if (r.lit) r.lit[0] = uni(r.lit[0]);
    if (r.pr) r.pr = uni(r.pr);
  }
}
// ein Lob-Wort in seiner Zeile deuten: Begriff oder null (keine Antwort); undefined = kein Lob-Wort
function slang(lang, raw, lt) {
  const r = SLANG[lang]?.[low(raw)];
  if (!r) return undefined;
  if (r.lit && r.lit[0].test(lt)) return r.lit[1];
  if (r.sex && SEX_CTX[lang]?.test(lt)) return r.sex;
  if (r.pr?.test(lt)) return "praise";
  if (r.d !== "praise" && r.d !== null && !r.pr && PRAISE_CTX[lang]?.test(lt) && (r.d === "crazy" || r.d === "wild")) return "praise";
  if (r.d === null && PRAISE_CTX[lang]?.test(lt)) return "praise";
  return r.d;
}
// Rufe und Zählen: eine Verneinung davor ändert nichts („no, no, yeah!“)
const NONEG = new Set(["hey", "yeah", "woo", "ole", "everybody", "comeon", "onemore", "hallelujah", "hype", "count", "handsup", "curse", "insult"]);
// Verneint → Gegenstimmung (sonst nichts)
const OPP = { love: "heartbreak", happy: "sad", lonely: "together", fear: "strong" };
// Derbe Begriffe: nie als Text, nur Licht und Stimmung
// … und Gewalt (Waffen, Töten, Krieg): ebenso nie als Text
const EXPLICIT = new Set(["sexy", "insult", "curse", "drugs", "gun", "machinegun", "shoot", "blade", "axe", "kill", "death", "grenade", "battle", "gangster", "heist", "reaper", "war", "blood"]);
// Begriffe, die in einem ruhigen/traurigen Song höchstens als Farbe kommen (Party, Rufe, Bewegung)
const LOUDC = new Set([
  "party", "fireworks", "boom", "bass", "handsup", "hype", "jump", "dance", "crazy", "club", "turnup", "weekend", "dancefloor", "dj",
  "wild", "bounce", "shots", "hey", "yeah", "woo", "ole", "everybody", "comeon", "onemore", "shake", "stomp", "clap", "getup", "curse",
]);
// nachgestellte Verneinung direkt hinter dem Wort (auch mitten im Satz)
const ADJ_POST = new Set(["tr", "hu", "hi", "ur", "pa", "bn", "ta"]);
// Füllwörter nach einer nachgestellten Verneinung
const TAIL = new Set(["mehr", "wieder", "so", "ja", "doch", "mal", "meer", "weer", "mer", "längre", "lenger", "længere", "more", "anymore", "encore", "plus", "artık"]);
// Englische Funktionswörter: ohne sie ist eine Zeile in einem anderssprachigen Song kein Englisch („hell“ = hell im
// Deutschen, „gift“ = Gift), ein englischer Treffer dann vermutlich ein falscher Freund
const EN_FN = new Set("the|you|your|you're|i'm|my|me|and|it's|we're|is|are|of|to|with|what|this|that|for|like|can't|don't|got|gonna|wanna|i|it|be|just|when|all|now|yeah".split("|"));
// Sprachen mit langen Zusammensetzungen: ein Stamm-Treffer in einem viel längeren Wort ist oft etwas anderes
const COMPOUND = new Set(["de", "nl", "sv", "da", "no", "fi", "hu", "et"]);

// Wortsinn: [Sprache ("*" = alle), Muster über die klein geschriebene Zeile, betroffener Begriff, neuer Begriff
// (null = keiner), Zuschlag auf die Sicherheit]. Das Muster gilt nur für Treffer innerhalb seiner Fundstelle.
const SENSE = [
  // Englisch
  ["en", /\bmake it rain\b/, "rain", "money", 0.15],
  ["en", /\bset (?:the|this|my|your|it) ?\w* on fire\b/, "fire", "fire", 0.2],
  ["en", /\bon fire\b/, "fire", "fire", 0.1],
  ["en", /\b(?:cease ?fire|fire (?:alarm|escape|exit|department|truck|brigade|station|hydrant)|(?:you're|you are|got|get|i'm|be) fired)\b/, "fire", null, 0],
  ["en", /\b(?:heart of gold|golden heart)\b/, "gold", "heart", 0],
  ["en", /\bfeel(?:ing|in')? (?:so )?blue\b/, "blue", "sad", 0.05],
  ["en", /\bwhat the (?:hell|heck)\b/, "devil", "curse", 0],
  ["en", /\b(?:all the|every|any|some|by the|in|on|no|last|first|next|this) time\b/, "time", null, 0],
  ["en", /\b(?:cold feet|cold shoulder)\b/, "*", null, 0],
  ["en", /\bsick and tired\b/, "tired", null, 0],
  // Waffen-Wörter, die gar keine Gewalt meinen
  ["en", /\b(?:killing|killin'?|killed|kill|kills) (?:it|the game|this|that beat)\b/, "*", "praise", 0.05],
  ["en", /\bkill(?:ing)? the (?:lights|music|engine|vibe)\b/, "kill", "blackout", 0],
  ["en", /\b(?:shots? of|tequila shots?|vodka shots?|whiskey shots?|a shot (?:of|for)|take (?:a|another) shot|do (?:a|some) shots?)\b/, "*", "shots", 0.05],
  ["en", /\bshoot(?:ing)? (?:your|my|his|her|our|their) shot\b|\bshoot for the (?:stars|moon|sky)\b|\b(?:photo ?shoot|video shoot|shooting (?:a|the) (?:video|movie|film))\b/, "shoot", null, 0],
  ["en", /\b(?:big shot|shot caller|call(?:ing)? the shots)\b/, "*", "boss", 0],
  ["en", /\b(?:phone|battery|batteries|cell) (?:is |was |'s |went )?dead\b|\bdead (?:tired|serious|end|ass|inside|silence|weight|beat)\b|\bi'?m dead\b|\bdeadline\b/, "death", null, 0],
  ["en", /\b(?:i'?d|i would|i could|i'll|i will|i'm gonna) die for you\b|\bto die for\b|\bdying to (?:see|meet|kiss|hold|know)\b/, "death", "love", 0],
  ["en", /\b(?:a|total|absolute) knockout\b|\bdressed to kill\b|\bdrop dead gorgeous\b/, "*", "beautiful", 0],
  ["en", /\bbullet train\b/, "shoot", "train", 0],
  ["de", /\b(?:zum sterben (?:schön|gern|verliebt))\b/, "death", "beautiful", 0],
  ["de", /\b(?:akku|handy) (?:ist |war )?(?:tot|leer)\b|\btoter winkel\b|\btotlachen\b/, "death", null, 0],
  ["es", /\b(?:me matas|me mata|me muero por (?:ti|vos|verte)|muero por (?:ti|vos)|me muero de amor)\b/, "*", "love", 0],
  ["pt", /\bmatar a saudade\b|\bmorrer de saudade\b/, "*", "longing", 0.05],
  ["fr", /\btu me tues\b|\bà mourir\b/, "*", "love", 0],
  ["it", /\bda morire\b/, "*", null, 0],
  ["en", /\b(?:free (?:of charge|for|ride|shipping)|for free)\b/, "freedom", null, 0],
  ["en", /\b(?:fight for|fighting for) (?:you|love|us|this)\b/, "war", "strong", 0],
  ["en", /\b(?:killing it|kill it)\b/, "*", null, 0],
  // Deutsch
  ["de", /\bfeuer und flamme\b/, "fire", "fire", 0.15],
  ["de", /\bfeuer frei\b/, "fire", "fire", 0.15],
  ["de", /\bfeuer(?:wehr|zeug|löscher|melder|alarm)/, "fire", null, 0],
  ["de", /\b(?:kalte (?:füße|schulter)|kaltes? (?:bier|getränk))\b/, "cold", null, 0],
  ["de", /\bwolke sieben\b/, "sky", "love", 0.05],
  ["de", /\b(?:zur zeit|mit der zeit|keine zeit|die zeit|zeit für|zeit zu)\b/, "time", null, 0],
  ["de", /\b(?:frei(?:tag|willig|lich|zeit))\b/, "freedom", null, 0],
  // Spanisch, Französisch, Italienisch, Portugiesisch
  ["es", /\bqu[eé] (?:rico|rica)\b/, "money", null, 0],
  ["es", /\b(?:prender|prende|prendí) (?:la|el) (?:fiesta|party|rumba)\b/, "fire", "party", 0.1],
  ["fr", /\b(?:mettre|met|mets|mis) le feu\b/, "fire", "fire", 0.15],
  ["fr", /\b(?:en feu)\b/, "fire", "fire", 0.1],
  ["it", /\b(?:in fiamme)\b/, "fire", "fire", 0.1],
  ["es", /\b(?:romp\w*|partid\w*|destroz\w*) (?:el |mi |tu )?coraz[oó]n/, "heart", "heartbreak", 0.05],
  ["it", /\b(?:spezz\w*|rott\w*) (?:il |mio |tuo )?cuore/, "heart", "heartbreak", 0.05],
  ["pt", /\b(?:partiu|partiste|quebrou|partido|quebrado) (?:o |meu |teu )?cora[cç][aã]o/, "heart", "heartbreak", 0.05],
  ["en", /\ball the \w+ in the world\b/, "world", null, 0],
  ["pt", /\b(?:pegar fogo|pega fogo|botar fogo)\b/, "fire", "fire", 0.1],
];
// Begriff → Wichtigkeit, wenn eine Zeile mehrere Treffer hat (ohne Angabe: 3). Flüche wiegen wenig: sie
// verstärken eher den anderen Begriff der Zeile („fuck yeah money“ → Geld, nur stärker)
const PRI = { curse: 1.5, yeah: 1.5, hey: 1.5, time: 1, love: 2, world: 2, light: 2, night: 2, insult: 2.5, sexy: 3.5, drugs: 3.5 };

/* ---- Zeile zerlegen: Wörter mit Stelle und ob davor ein Satzzeichen steht */
function tokens(text) {
  const out = [];
  let prev = 0;
  for (const m of String(text || "").matchAll(TOKEN)) {
    out.push({ at: m.index, end: m.index + m[0].length, w: low(m[0]), brk: BREAK.test(text.slice(prev, m.index)) });
    prev = m.index + m[0].length;
  }
  return out;
}
// Wort-Index zu einer Zeichenstelle
function tokAt(toks, at) {
  for (let i = 0; i < toks.length; i++) if (at < toks[i].end) return i;
  return toks.length - 1;
}

/* ---- Verneinung: steht vor dem Treffer (im selben Teilsatz, bis zu 4 Wörter) ein „nicht“ – oder direkt danach
   am Ende des Teilsatzes (Deutsch, Niederländisch …: „Ich liebe dich nicht“, „es regnet nicht mehr“), in Sprachen
   mit nachgestellter Verneinung auch unmittelbar dahinter (Türkisch „aşk değil bu“, Hindi „pyaar nahi“)? */
function negated(h, toks, text, neg) {
  const N = neg?.[h.lang];
  if (h.ti < 0) {
    // Schriften ohne Leerzeichen: Zeichen direkt davor / danach
    if (!N) return false;
    const before = text.slice(Math.max(0, h.at - 2), h.at), after = text.slice(h.at + h.len, h.at + h.len + 5);
    for (const w of N.neg) if (before.endsWith(w)) return true;
    for (const w of N.post) if (after.startsWith(w) || after.slice(1).startsWith(w)) return true;
    return false;
  }
  // (Französisch: „n'ai“, „n'est“ … tragen die Verneinung im Wort)
  const isNeg = (w) => N?.neg.has(w) || (h.lang === "fr" && /^n['’]/.test(w));
  for (let k = 1; k <= 4; k++) {
    const j = h.ti - k;
    if (j < 0 || toks[j + 1].brk) break;
    if (isNeg(toks[j].w)) return true;
  }
  if (N?.post.size) {
    const last = h.ti + (h.tn || 1) - 1;
    for (let k = 1; k <= 2; k++) {
      const j = last + k;
      if (j >= toks.length || toks[j].brk) break;
      if (!N.post.has(toks[j].w)) continue;
      if (k === 1 && ADJ_POST.has(h.lang)) return true;
      // sonst nur am Ende des Teilsatzes („Liebe ist nicht genug“ verneint nicht die Liebe); Füllwörter danach
      // („nicht mehr“, „pas encore“) zählen nicht
      let e = j + 1;
      while (e < toks.length && !toks[e].brk && TAIL.has(toks[e].w)) e++;
      if (e === toks.length || toks[e].brk) return true;
    }
  }
  return false;
}

/* ---- eine Zeile: Treffer → bereinigte Kandidaten mit Sicherheit */
// hits: [{ c, at, len, raw, how, lang, ti, tn }] (words.js) · o: { neg, main, tr (Übersetzung) }
function senseLine(text, hits, o = {}) {
  const lt = low(text), toks = tokens(text);
  const enLine = toks.some((t) => EN_FN.has(t.w));
  // Stelle → Wort (falls words.js keine Wortstelle mitgibt)
  for (const h of hits) {
    if (h.ti == null) {
      if (h.how === "sub") h.ti = -1;
      else {
        h.ti = tokAt(toks, h.at);
        h.tn = Math.max(1, tokAt(toks, h.at + h.len - 1) - h.ti + 1);
      }
    }
  }
  // längere Treffer zuerst: ein Treffer innerhalb einer längeren Wortgruppe fällt weg („lean on“ ≠ lean)
  const sorted = [...hits].sort((a, b) => b.len - a.len || a.at - b.at);
  const kept = [];
  for (const h of sorted) {
    if (kept.some((k) => h.at >= k.at && h.at + h.len <= k.at + k.len)) continue;
    kept.push(h);
  }
  const out = [], negAt = [];
  for (const h of kept) {
    let c = h.c, conf = (o.tr ? HOW.tr : HOW[h.how] ?? 0.8) * (CW[c] ?? 1);
    if (h.how === "sub" && [...(h.raw || "")].length < 2) conf *= 0.7;
    // kurze Wörter („ey“, „sol“) sind öfter etwas anderes
    if ((h.how === "exact" || h.how === "pre") && [...(h.raw || "")].length <= 3) conf *= 0.85;
    // Englisch in einem anderssprachigen Song: etwas weniger sicher – und ohne ein englisches Funktionswort in der
    // Zeile vermutlich ein falscher Freund („Der Mond scheint hell“)
    if (o.main && o.main !== "en" && h.lang === "en" && h.how !== "phrase") conf *= enLine ? 0.88 : 0.55;
    // Zusammensetzung („Feuerwehr“ über den Stamm „feuer*“): deutlich weniger sicher
    if (h.how === "pre" && COMPOUND.has(h.lang) && [...(h.raw || "")].length > 11) conf *= 0.7;
    // Lob-Wörter („geil“, „sick“, „krass“, „c'est chaud“): Lob, wörtlich oder sinnlich – nach den Nachbarn
    const sl = h.how === "phrase" ? undefined : slang(h.lang, h.raw, lt);
    if (sl === null) continue;
    if (sl !== undefined && sl !== c) {
      c = sl;
      conf = Math.max(conf, 0.75);
    }
    // Wortsinn: Redewendungen umdeuten oder streichen
    for (const [lang, re, from, to, plus] of SENSE) {
      if (lang !== "*" && lang !== h.lang) continue;
      if (from !== "*" && from !== c) continue;
      const m = re.exec(lt);
      if (!m || h.at < m.index - 1 || h.at > m.index + m[0].length) continue;
      if (to === null) conf = 0;
      else {
        c = to;
        conf = Math.max(conf, 0.85) + plus;
      }
      break;
    }
    if (conf <= 0) continue;
    // Verneinung
    if (!NONEG.has(c) && negated(h, toks, text, o.neg)) {
      negAt.push(h.ti);
      if (!OPP[c]) continue;
      c = OPP[c];
      conf *= 0.85;
    }
    out.push({ c, at: h.at, len: h.len, raw: h.raw, conf: clamp(conf, 0, 1.2), lang: h.lang, ti: h.ti });
  }
  // ein verneinter Teilsatz zieht die übrigen Treffer darin mit herunter („ni una estrella en el cielo“)
  for (const x of out) {
    if (x.ti < 0 || !negAt.some((n) => n >= 0 && n < x.ti && !toks.slice(n + 1, x.ti + 1).some((t) => t.brk))) continue;
    x.conf *= 0.75;
  }
  // Drogen in der Zeile: kein Rauch-Bild dazu (nichts Verherrlichendes)
  if (out.some((x) => x.c === "drugs")) for (const x of out) if (x.c === "smoke") x.conf = 0;
  // mehrere verschiedene Begriffe in einer Zeile stützen sich gegenseitig ein wenig
  const kinds = new Set(out.map((x) => x.c));
  if (kinds.size >= 2) for (const x of out) x.conf += 0.04;
  return out.filter((x) => x.conf >= THR);
}

/* ---- eine Zeile → eine Antwort (oder keine) */
// pri: Begriff → Wichtigkeit des Bilds (words.js); ohne Angabe PRI bzw. 3
function pickLine(cands, pri) {
  if (!cands.length) return null;
  const P = (c) => PRI[c] ?? pri?.(c) ?? 3;
  const best = new Map();
  for (const x of cands) if (!best.has(x.c) || best.get(x.c).conf < x.conf) best.set(x.c, x);
  const list = [...best.values()].sort((a, b) => P(b.c) * b.conf - P(a.c) * a.conf || a.at - b.at);
  const top = list[0], also = list.slice(1, 3).map((x) => x.c), n = list.length;
  return {
    c: top.c, at: top.at, len: top.len, raw: top.raw, conf: Math.min(1, top.conf + 0.05 * (n - 1)),
    // eine stärkere, kombinierte Antwort, wenn die Zeile mehrere Begriffe trägt
    k: Math.min(1.3, 1 + 0.15 * (n - 1)), also, ex: EXPLICIT.has(top.c),
  };
}

/* ---- der ganze Song */
// lines: [{ text }] · hits: je Zeile die Treffer aus words.js · o: { neg, main, pri (c → Wichtigkeit) }
// Ergebnis je Zeile: null oder { c, at, len, raw, conf, k (Stärke), rep (wievielte Wiederholung), last (letzter
// Refrain), also (weitere Begriffe), ex (derb), soft (ruhige Stelle: nur Farbe statt Knall) }
function planSong(lines, hits, o = {}) {
  const n = lines.length;
  const plan = lines.map((l, i) => pickLine(senseLine(l.text || "", hits[i] || [], o), o.pri));
  // Stimmung des Liedtexts: traurige Lieder bekommen ruhige Antworten
  let v = 0, vn = 0;
  const lineV = lines.map((l) => {
    const m = lineMood(l.text);
    if (m) {
      v += m.v * m.n;
      vn += m.n;
    }
    return m ? m.v : 0;
  });
  const songV = vn ? v / vn : 0;
  const loudHits = plan.filter((p) => p && LOUDC.has(p.c)).length;
  const sadSong = vn >= 4 && songV < -0.25 && loudHits < 3;
  // Wiederholung: gleiche Zeilen (Refrain) zählen, je Begriff die wievielte Antwort
  const norm = (s) => low(s).replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const keys = lines.map((l) => norm(l.text));
  const lastOf = new Map(), count = new Map();
  keys.forEach((k, i) => {
    lastOf.set(k, i);
    count.set(k, (count.get(k) || 0) + 1);
  });
  // Abschnitte des letzten Refrains: die letzte Wiederholung einer mehrfach gesungenen Zeile im letzten Drittel
  const seen = new Map();
  for (let i = 0; i < n; i++) {
    const p = plan[i];
    if (!p) continue;
    const r = seen.get(p.c) || 0;
    seen.set(p.c, r + 1);
    p.rep = r;
    p.last = count.get(keys[i]) >= 2 && lastOf.get(keys[i]) === i && i >= n * 0.6;
    if (r > 0 && !p.last) p.k *= 0.6;
    p.soft = sadSong || lineV[i] < -0.5;
  }
  return plan;
}

export { planSong, senseLine, pickLine, tokens, negated, EXPLICIT, THR, CW, SENSE, LOUDC };
