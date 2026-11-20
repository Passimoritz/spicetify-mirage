/* ---------------------------------------------------------------- Publikum: was die Menge tut */
// Rein rechnend (ohne Canvas) – venue.js zeichnet, dieses Modul entscheidet. Darum auch im Testlabor messbar
// (tests/lab: tanzt die Menge im Refrain mehr als in der Strophe, bleibt sie im Intro ruhig?).
// Wie echte Leute: WAS getanzt wird, kommt vom Genre (Rave springt, Rock bangt, Pop klatscht, Reggae skankt …),
// WIE VIEL vom Teil des Songs: im Intro und im Break wiegen sie sich, in der Strophe grooven sie ohne zu springen,
// im Aufbau klatschen sie mit und gehen in die Knie, im Refrain springt auch ein Pop-Publikum, beim Drop alle.
import { kin } from "./styles.js";

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
// Grundbewegung je Stil (alle weiteren Spielarten über ihren Verwandten, styles.js)
const MOVES = {
  rave: "jump", trance: "wave", hardstyle: "jump", dnb: "jump", techno: "pump", house: "bounce",
  rock: "bang", metal: "bang", punk: "jump", bass: "nod", pop: "clap", kpop: "clap", disco: "clap", country: "clap",
  latin: "bounce", afro: "bounce", reggae: "skank", chill: "sway", jazz: "sway", classical: "sway",
  edm: "jump", deephouse: "bounce", techhouse: "pump", psytrance: "jump", dubstep: "bang", garage: "bounce", eurodance: "jump",
  melodictechno: "pump", hardtechno: "pump", futurebass: "jump", electroswing: "bounce", breakbeat: "bounce", boombap: "nod",
  dancehall: "bounce", cloudrap: "sway", hardrock: "bang", postrock: "sway", ska: "skank", emo: "jump", jpop: "clap", musical: "clap",
  christmas: "sway", celtic: "clap", balkan: "jump", amapiano: "bounce", lofi: "sway", neoclassical: "sway", acoustic: "sway",
  synthwave: "nod", hyperpop: "jump", trap: "bounce", drill: "nod", phonk: "pump", rnb: "sway", soul: "clap", indie: "bounce",
  alternative: "bang", blues: "sway", schlager: "clap", ballad: "sway", gospel: "clap", reggaeton: "bounce", salsa: "bounce",
  brazil: "bounce", flamenco: "clap", bollywood: "bounce", arabic: "clap", ambient: "sway", cinematic: "sway",
};
kin(MOVES, 2);
// ruhige Fassung jeder Bewegung (Intro, Break, Outro, leise Bridge): niemand springt, der Groove bleibt im Körper
const SOFT = { jump: "bounce", pump: "nod", bounce: "bounce", bang: "nod", clap: "sway", skank: "skank", nod: "nod", wave: "sway", sway: "sway" };
// Strophe: wer im Refrain springt, wippt hier nur
const VERSE = { jump: "bounce", pump: "pump", bounce: "bounce", bang: "bang", clap: "clap", skank: "skank", nod: "nod", wave: "wave", sway: "sway" };
// Springen: Anteil der Leute, die überhaupt springen dürfen, je Bewegung (im Refrain/Drop)
const JUMP = { jump: 1, pump: 1, bounce: 1, bang: 0.45, clap: 0.45, skank: 0.25, wave: 0.6, nod: 0, sway: 0 };
const CALM = new Set(["intro", "outro", "break"]);

// Stimmung der Menge 0..1: träge (schnell hoch, langsam runter), beim Drop sofort oben
function createCrowdMind() {
  let x = 0;
  function mood(px, dt, hype) {
    // px.crowd = Gefühl des Teils (Lichtregie): in einer traurigen Bridge wiegt sich die Menge eher, als dass sie springt
    const target = clamp((Math.pow(px.energy, 1.3) * 0.85 + px.drop * 0.5 + px.build * 0.2 + (px.bass || 0) * 0.12 - px.low * 0.7 + (hype && px.energy > 0.45 ? 0.12 : 0)) * (px.crowd ?? 1), 0, 1);
    x += (target - x) * (1 - Math.exp(-dt * (target > x ? 3 : 0.8)));
    if (px.dropHit) x = Math.max(x, 0.9);
    return x;
  }
  return { mood, get x() { return x; } };
}

// Tanz für dieses Bild: Bewegung, Sprung-Anteil (jump), ab welcher Stimmung Hände hochgehen (upAt),
// Mitklatschen im Aufbau (clap 0..1) und In-die-Knie-Gehen vor dem Drop (crouch 0..1)
function dance(px, X, seated) {
  const base = seated ? "sway" : MOVES[px.key] || "clap";
  const kind = px.kind || "";
  let style = base, jump = JUMP[base] ?? 0, upAt = 0.55, clap = 0;
  if (CALM.has(kind) || (kind === "bridge" && X < 0.55)) {
    style = SOFT[base] || "sway";
    jump = 0;
    upAt = 0.8;
  } else if (kind === "verse") {
    style = VERSE[base] || base;
    // in der Strophe springt nur, wer ohnehin springt – und nur ein Teil davon
    jump = base === "jump" ? 0.35 : 0;
    upAt = 0.68;
  } else if (kind === "pre") {
    // Aufbau: Hände kommen hoch, viele klatschen im Takt mit, gesprungen wird erst auf dem Höhepunkt
    clap = base === "sway" || base === "nod" || base === "bang" ? 0 : clamp(0.4 + (px.build || 0), 0, 1);
    if (clap) style = "clap";
    jump = 0;
    upAt = 0.5;
  } else if (kind === "chorus") upAt = 0.5;
  else if (kind === "drop") {
    // Drop: alles springt, was tanzt (ruhige Genres wippen kräftig)
    style = base === "sway" || base === "nod" ? base : "jump";
    jump = base === "sway" || base === "nod" ? 0 : 1;
    upAt = 0.45;
  }
  // in Spannung vor dem Drop in die Knie, auf dem dunklen letzten Schlag ganz unten
  const crouch = clamp(Math.max(px.build || 0, px.tension || 0) + (px.blackout ? 0.4 : 0), 0, 1);
  return { style, base, jump, upAt, clap, crouch };
}

// Springt diese Person in diesem Sprung? me = ihre Stimmung, h = ihr fester Zufall je Takt (0..1)
function jumps(D, me, h, px) {
  if (!D.jump) return false;
  return (me > 0.72 && h < D.jump * (0.45 + (me - 0.72) * 2)) || (px.drop > 0.6 && me > 0.6 && h < D.jump);
}
// Will sie die Arme oben haben? (0..1) up = ihre Neigung, die Hände hochzunehmen (0..1, fest)
function armsUp(D, me, up) {
  if (D.clap > 0.3 && up < D.clap) return 0.75;
  if (me > D.upAt && up < me + 0.1 && D.style !== "sway" && D.style !== "nod") return 1;
  return D.style === "clap" && me > 0.3 ? 0.75 : 0;
}

// alle Bewegungen, die venue.js zeichnen kann
const DANCES = Object.keys(JUMP);

export { MOVES, DANCES, createCrowdMind, dance, jumps, armsUp };
