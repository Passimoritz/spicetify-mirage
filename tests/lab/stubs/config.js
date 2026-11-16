// Attrappe für src/config.js: Party-Einstellungen wie beim Nutzer (Standardwerte), im Labor umstellbar
export const cfg = (globalThis.__labCfg ||= {
  partyStyle: "auto", partyLevel: 2, partyFlash: true, partyOnline: false, partyDirector: true, partyLasers: true, partyZoom: false,
  noFlash: false, calm: false, lite: false, preset: "", eco: "off", beat: true, instrSound: true,
});
export const save = () => {};
