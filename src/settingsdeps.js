/* ---------------------------------------------------------------- Abhängigkeiten zwischen Einstellungen */
// Manche Einstellung schaltet andere still ab: „Keine Blitze“ nimmt alle Blitz-Effekte heraus, das Preset „Ruhig“
// hält jede Bewegung an. Solche Schalter zeigt der Einstellungs-Dialog ausgegraut, mit dem Hinweis „Aus wegen …“;
// ein Klick darauf springt zur Ursache.
// Erweitern: eine Zeile mehr. keys = betroffene Schalter, on(cfg) = ist die Ursache gerade aktiv,
// label = Textschlüssel des Namens der Ursache, jump = wohin der Hinweis springt
// (data-key eines Schalters im Dialog oder "preset:<name>" für einen Preset-Knopf).
const DEPENDS = [
  {
    id: "noFlash",
    keys: ["partyFlash", "partyStrobe", "partyFlashStorm", "partyShatter"],
    on: (cfg) => !!cfg.noFlash,
    label: "noFlash",
    jump: "noFlash",
  },
  {
    id: "calm",
    // was die Ruhe in burst.js, cards.js, pages.js, audio.js, immersive.js und party.js ausbremst
    keys: ["burst", "tilt", "cascade", "beat", "canvas", "partyWords", "partyBlend"],
    on: (cfg) => !!cfg.calm,
    label: "preset_calm",
    jump: "preset:calm",
  },
];

// Ursache, die diesen Schalter gerade abschaltet (die erste passende), sonst null
function blockedBy(key, cfg) {
  for (const d of DEPENDS) if (d.keys.includes(key) && d.on(cfg)) return d;
  return null;
}

export { DEPENDS, blockedBy };
