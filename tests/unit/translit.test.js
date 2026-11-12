// node tests/unit/translit.test.js
const assert = require("assert");
const { load } = require("./load.js");
const { translitLines, cyrillic, cyrLang, greek, devanagari } = load("translit.js");
const { scriptOf } = load("roman.js");

// ---- Kyrillisch: Sprache erkennen
assert.equal(cyrLang("Я тебя люблю, объявление"), "ru");
assert.equal(cyrLang("Ти моя єдина, і я тебе кохаю"), "uk");
assert.equal(cyrLang("Аз съм тук, къде си"), "bg");
assert.equal(cyrLang("Волим те, љубави моја"), "sr");
assert.equal(cyrLang("Я тебя люблю", "uk"), "uk", "Angabe der Quelle gewinnt");
assert.equal(cyrLang("Те сакам", "mk"), "sr");

// ---- Russisch
assert.equal(cyrillic("Привет, как дела?", "ru"), "Privet, kak dela?");
assert.equal(cyrillic("Ещё", "ru"), "Yeshchyo");
assert.equal(cyrillic("красивый объезд", "ru"), "krasivy obyezd");
assert.equal(cyrillic("МОСКВА", "ru"), "MOSKVA");
assert.equal(cyrillic("Щука", "ru"), "Shchuka");
assert.equal(cyrillic("Я люблю тебя", "ru"), "Ya lyublyu tebya");
assert.equal(cyrillic("день", "ru"), "den");
// ---- Ukrainisch, Bulgarisch, Serbisch
assert.equal(cyrillic("Червона рута", "uk"), "Chervona ruta");
assert.equal(cyrillic("Україна, їжак, ґанок", "uk"), "Ukrayina, yizhak, ganok");
assert.equal(cyrillic("гарна мова", "uk"), "harna mova");
assert.equal(cyrillic("Къде си, щастие", "bg"), "Kade si, shtastie");
assert.equal(cyrillic("Љубав, џез, ђак, ћуприја", "sr"), "Ljubav, džez, đak, ćuprija");
// Latein und Zeichen bleiben stehen
assert.equal(cyrillic("Baby, я здесь!", "ru"), "Baby, ya zdes!");

// ---- Griechisch
assert.equal(greek("Καλημέρα"), "Kalimera");
assert.equal(greek("Ευχαριστώ"), "Efcharisto");
assert.equal(greek("μπορώ"), "boro");
assert.equal(greek("αυτός"), "aftos");
assert.equal(greek("αύριο"), "avrio");
assert.equal(greek("παιδί"), "pedi");
assert.equal(greek("γάιδαρος"), "gaidaros", "Akzent auf dem ersten Vokal: kein Doppellaut");
assert.equal(greek("Αγγελική"), "Angeliki");
assert.equal(greek("πέντε"), "pende");
assert.equal(greek("σ' αγαπώ, μάτια μου"), "s' agapo, matia mou");
assert.equal(greek("ΑΓΑΠΗ"), "AGAPI");

// ---- Hindi
assert.equal(devanagari("नमस्ते"), "namaste");
assert.equal(devanagari("दिल"), "dil");
assert.equal(devanagari("करना"), "karnā");
assert.equal(devanagari("मैं तुमसे प्यार करता हूँ"), "main tumse pyār kartā hūn");
assert.equal(devanagari("ज़िंदगी"), "zindagī");
assert.equal(devanagari("ज़िंदगी".normalize("NFC")), "zindagī");
assert.equal(devanagari("मोहब्बत"), "mohabbat");
assert.equal(devanagari("आदमी"), "ādmī");
assert.equal(devanagari("समझ"), "samajh");
assert.equal(devanagari("सुनहरा"), "sunahrā");
assert.equal(devanagari("लंबा हिंदी"), "lambā hindī");
assert.equal(devanagari("ज्ञान"), "gyān");
assert.equal(devanagari("मित्र"), "mitra");
assert.equal(devanagari("न"), "na");
assert.equal(devanagari("लड़का"), "larkā");
assert.equal(devanagari("तेरे बिना, baby १२"), "tere binā, baby 12");

// ---- Zeilen: Schrift erkennen, Zeilen ohne die Schrift bleiben leer
const ru = [{ text: "Я тебя люблю" }, { text: "Oh baby" }, { text: "♪" }, { text: "Никогда" }];
assert.equal(scriptOf(ru), "cyr");
assert.deepEqual(translitLines("cyr", ru.map((l) => l.text)), ["Ya tebya lyublyu", "", "", "Nikogda"]);
assert.equal(scriptOf([{ text: "Σ' αγαπώ" }, { text: "Μάτια μου" }]), "el");
assert.equal(scriptOf([{ text: "तेरे बिना" }, { text: "दिल" }]), "hi");
// die bisherigen Schriften bleiben, wie sie waren
assert.equal(scriptOf([{ text: "사랑해" }, { text: "너를" }]), "ko");
assert.equal(scriptOf([{ text: "ありがとう" }, { text: "君の名は" }]), "ja");
assert.equal(scriptOf([{ text: "我爱你" }, { text: "月亮" }]), "zh");
assert.equal(scriptOf([{ text: "Hello" }, { text: "World" }]), "");
// Arabisch und Thai: bewusst keine Lautschrift
assert.equal(scriptOf([{ text: "حبيبي" }, { text: "يا ليل" }]), "");
assert.equal(scriptOf([{ text: "รักเธอ" }]), "");
assert.equal(translitLines("ar", ["حبيبي"]), null);
console.log("translit: ok");
