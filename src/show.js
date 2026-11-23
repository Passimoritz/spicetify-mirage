/* ---------------------------------------------------------------- Show-Ebene der Party-Location */
// Läuft wie venue.js auch im Hintergrund-Thread. Zwei Teile:
// · Lichtrig: Moving Heads an einer Traverse, deren Muster zum Genre passen (Welle bei House, Lauflicht bei
//   Techno, Fächer bei EDM, alle aufs Cover bei Hip-Hop und Rock), Blinder auf großen Schlägen, Laserfläche
//   über der Menge im Drop, für ruhige Musik stattdessen weiches Bokeh.
// · Instrumente (nur von den Credits bestätigt): Fanfaren-Strahlen für Bläser, Rauchschwaden fürs Saxofon,
//   Blitze für die E-Gitarre, Lichttasten fürs Klavier (folgen den gespielten Tönen), Seidenbänder für
//   Streicher, ein Lichtschein von oben für den Chor, Trommelfelle unter der Traverse fürs Schlagzeug-Solo,
//   Druckwellen aus den Ecken für den Bass, eine Rechteck-Welle für den Synthesizer, ein Balg an den Rändern
//   fürs Akkordeon, ein Lufthauch aus Lichtpunkten für die Flöte, Lichtsaiten mit Glissando für die Harfe.
//   Alles liegt hinter dem Publikum (die Location zeichnet die Menge danach).
import { kin, kinSet } from "./styles.js";
import { smooth, easeInOut, wipeAt, hash, envAR } from "./fxenv.js";

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const RIG = {
  house: ["wave", "chase"], deephouse: ["wave"], techhouse: ["chase", "cross"], garage: ["wave", "chase"], disco: ["wave", "fan"],
  techno: ["chase", "cross", "point"], edm: ["fan", "cross", "wave"], rave: ["fan", "cross"], trance: ["fan", "wave"], psytrance: ["cross", "wave"],
  hardstyle: ["cross", "fan"], dnb: ["chase", "cross"], dubstep: ["point", "fan"], eurodance: ["wave", "fan"], synthwave: ["wave"], hyperpop: ["chase", "fan"],
  pop: ["wave", "fan"], kpop: ["chase", "wave"], schlager: ["wave", "fan"], rock: ["point", "fan"], metal: ["point", "fan"], punk: ["point"],
  alternative: ["point", "wave"], indie: ["wave"], latin: ["wave"], reggaeton: ["wave", "chase"], salsa: ["wave"], brazil: ["wave"], afro: ["wave"],
  bollywood: ["wave", "fan"], arabic: ["wave"], bass: ["point", "chase"], trap: ["point", "chase"], drill: ["point"], phonk: ["chase"],
  soul: ["wave"], gospel: ["fan"], country: ["wave"], reggae: ["wave"], flamenco: ["point"],
  melodictechno: ["wave", "fan"], hardtechno: ["chase", "cross"], futurebass: ["fan", "wave"], electroswing: ["wave"], breakbeat: ["chase", "point"],
  boombap: ["point"], dancehall: ["wave", "chase"], hardrock: ["point", "fan"], postrock: ["fan"], ska: ["wave", "chase"], emo: ["point"],
  jpop: ["chase", "wave"], musical: ["fan"], celtic: ["wave"], balkan: ["chase", "wave"], amapiano: ["wave"],
};
const BLIND = new Set(["hardrock", "hardtechno", "balkan", "rock", "metal", "punk", "alternative", "pop", "kpop", "schlager", "edm", "rave", "eurodance", "hardstyle", "bollywood", "gospel"]);
const SHEET = new Set(["edm", "rave", "trance", "psytrance", "techno", "techhouse", "hardstyle", "dnb", "dubstep"]);
const CALM = new Set(["chill", "ambient", "jazz", "classical", "cinematic", "ballad", "rnb", "blues", "lofi", "neoclassical", "acoustic", "cloudrap", "christmas"]);
// weitere Spielarten (styles.js): Muster und Effekte wie ihr Verwandter, außer sie sagen es anders
kin(RIG);
kinSet(BLIND, "b"), kinSet(SHEET, "w"), kinSet(CALM, "q");
const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(a, 0, 1).toFixed(3)})`;
const mixW = (c, f) => c.map((v) => v + (255 - v) * f);
// Lichtwisch: Nachzieher (Abstand im Fortschritt, Deckkraft) und die Glocke quer zur Kante (9 Stufen, flache Enden)
const WIPE_TRAIL = [[0.1, 0.22], [0.05, 0.45], [0, 1]];
const WIPE_BELL = Array.from({ length: 9 }, (_, s) => Math.pow(0.5 + 0.5 * Math.cos((Math.PI * s) / 8), 1.4));

// cap = die gemeinsame Blitz-Schranke der Bühne (flashcap.js): Blinder und Gitarrenblitze teilen sie sich mit dem Stroboskop
function createShow(glowSprite, cap) {
  let vw = 0, vh = 0;
  // prev/pt: Muster vor dem letzten Wechsel und wann er war – die Köpfe schwenken in 0,4 s hinüber statt zu springen
  const rig = { blk: -1, pat: "", prev: "", pt: -9, col: 0, drop: 0, blind: 0, sn: false, sheet: 0, wall: 0, wallOn: false, hand: 0, land: 0, landL: 0 };
  // Farbe eines Kopfes im Farbprogramm (colProg): Mischung zweier Lichtfarben – ein Speicher für alle Köpfe (keine
  // neuen Felder je Bild); cA/cB = die beiden Farben, cF = Anteil der zweiten, cBuf = die Mischung
  let cA = 0, cB = 0, cF = 0;
  const cBuf = [0, 0, 0], rampC = [0, 0, 0];
  // großes Leuchtbild (256 px) für alles, was weit gestreckt wird – sonst zeigt der Schein Ringe
  const spr = (c, r) => glowSprite(c, r > 48);
  // Winkel eines Kopfes in einem Muster (ohne die Ausrichtung im Aufbau)
  function headAngle(pat, i, u, mb, toCover) {
    let a = Math.PI / 2;
    if (pat === "fan") a += u * (1.1 + 0.35 * Math.sin((mb * Math.PI) / 4) + rig.drop * 0.6);
    else if (pat === "wave") a += 0.5 * Math.sin((mb * Math.PI) / 2 + i * 0.7);
    else if (pat === "cross") a += (i % 2 ? 1 : -1) * (0.3 + 0.28 * Math.sin((mb * Math.PI) / 4));
    else if (pat === "chase") a += u * 0.6;
    else if (pat === "point") a = toCover;
    // Ballyhoo: weite, versetzte Achten über die ganze Halle (der tragende Look nach dem Drop)
    else if (pat === "ballyhoo") a += u * 0.9 * Math.sin((mb * Math.PI) / 4 + i * 0.55) + 0.32 * Math.sin((mb * Math.PI) / 2 + i * 1.1);
    // Tilt: alle Köpfe öffnen und schließen den Fächer gemeinsam, einmal in zwei Takten
    else if (pat === "tilt") a += u * (0.25 + 0.95 * (0.5 - 0.5 * Math.cos((mb * Math.PI) / 4)));
    // Spiegel: links und rechts gegengleich – ein V, das sich mit dem Takt öffnet und schließt
    else if (pat === "mirror") a -= Math.sign(u) * (0.15 + 0.4 * (0.5 - 0.5 * Math.cos((mb * Math.PI) / 2))) * Math.min(1, Math.abs(u) * 2.4);
    // Stand: die Köpfe stehen fast still und atmen nur (Intro, Break, Outro)
    else if (pat === "still") a += u * 0.4 + 0.05 * Math.sin(mb * 0.4 + i);
    return a;
  }
  // Farbprogramm: setzt cA, cB, cF für Kopf i von n (mb = Schlag-Uhr der Regie)
  function colProg(prog, i, n, mb) {
    if (prog === "mono") {
      // alle in einer Farbe; im letzten Viertel jedes Takts gleitet sie zur nächsten
      const b = Math.floor(mb / 4), f = mb / 4 - b;
      cA = (b + rig.col) % 3;
      cF = smooth((f - 0.75) / 0.25);
    } else if (prog === "split") {
      cA = ((i & 1) + rig.col) % 3;
      cF = 0;
    } else if (prog === "chase") {
      // eine Farbwelle wandert über die Traverse, ein Durchlauf in vier Takten
      const w = (i / n) * 3 + mb / 16 * 3, b = Math.floor(w);
      cA = (((b + rig.col) % 3) + 3) % 3;
      cF = w - b;
    } else {
      cA = (i + rig.col) % 3;
      cF = 0;
    }
    cB = (cA + 1) % 3;
  }
  const beatPos = (st, px) => (px.beatIdx >= 0 ? px.beatIdx : st.t * (st.bpm / 60)) + (px.phase || 0);

  /* ---- Lichtrig */
  function drawRig(ctx, st, v, px, pal, dpr) {
    vw = st.vw;
    vh = st.vh;
    const t = st.t, dt = st.dt, key = px.key, bp = beatPos(st, px);
    // Bewegung nach der Schlag-Uhr der Lichtregie: im Break halbes Tempo, im Drum-&-Bass-Drop doppeltes –
    // stetig, ohne Sprung (Musterwechsel bleiben auf den echten Schlägen)
    const mb = px.mb ?? bp;
    const vis = px.blackout ? 0 : clamp(1 - px.low * 0.85, 0.1, 1);
    // der Drop reißt die Strahlen ins Weiße – ohne Blitze bleiben sie in ihrer Farbe
    if (px.dropHit && !st.noFlash) rig.drop = 1;
    rig.drop *= Math.exp(-dt * 3);
    // DJ-Übergabe (party.js hand 0..1, geglättet: beim Songwechsel fällt sie auf 0) und Landung auf der ersten Eins des
    // neuen Songs: die Köpfe stehen zur Mitte gerichtet und springen dann auseinander
    rig.hand += ((px.hand || 0) - rig.hand) * (1 - Math.exp(-dt * 3));
    if (px.land && rig.hand > 0.05) [rig.land, rig.landL, rig.hand] = [rig.hand * 0.55, 1, 0];
    rig.land = rig.land > 0.01 ? rig.land * Math.exp(-dt * 4) : 0;
    rig.landL = rig.landL > 0.01 ? rig.landL * Math.exp(-dt * 2.5) : 0;
    // Lichtrampe des Aufbaus: hinter der Bühne steigt ein weiches Licht (stetig, kein Pulsen) – nur in voller Qualität
    if ((px.ramp || 0) > 0.01 && st.rig && vis > 0 && (st.quality ?? 2) >= 2) {
      const r = vw * 0.6;
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = clamp((st.noFlash ? 0.1 : 0.16) * px.ramp * vis, 0, 1);
      // (Farbe in einem festen Speicher, in 16er-Stufen: keine neuen Felder je Bild, wenige Leuchtbilder)
      for (let k2 = 0; k2 < 3; k2++) rampC[k2] = st.noFlash ? pal[1][k2] : (pal[1][k2] + (255 - pal[1][k2]) * 0.6) & ~15;
      ctx.drawImage(spr(rampC, r), vw / 2 - r, vh * 0.25 - r * 0.5, r * 2, r);
      ctx.globalAlpha = 1;
    }
    const n = v.decor === "towers" || v.decor === "stands" ? 10 : v.decor === "club" ? 7 : v.decor === "beach" ? 6 : v.decor === "warehouse" ? 5 : 0;
    // Muster der Szene (Lichtregie) – auch ruhige Stile bekommen Moving Heads, wenn ihre Szene welche mitbringt
    const pats = RIG[key] || (px.rig ? [px.rig] : null);
    ctx.globalCompositeOperation = "lighter";
    if (n && pats && st.rig) {
      const blk = Math.floor(bp / 32);
      // Programm des Teils (Regie: Intro steht, Strophe läuft, Drop geht weit auf), sonst das Muster der Szene, sonst alle
      // 32 Schläge das nächste des Genres. In der DJ-Übergabe stehen die Köpfe und zeigen zur Mitte (siehe conv unten).
      const want = rig.hand > 0.6 ? "still" : px.rigP || px.rig;
      if (blk !== rig.blk || (want && want !== rig.pat)) {
        const next = want || pats[(blk + (px.scene || 0)) % pats.length];
        if (next !== rig.pat) [rig.prev, rig.pt] = [rig.pat, t];
        rig.blk = blk;
        rig.pat = next;
        rig.col = (rig.col + 1) % 3;
      }
      // Schwenk ins neue Muster (0,4 s, weich) – kein Sprung aller Köpfe auf einmal
      const swing = rig.prev && t - rig.pt >= 0 && t - rig.pt < 0.4 ? easeInOut((t - rig.pt) / 0.4) : 1;
      // Riser: die Köpfe pulsen im Aufbau immer dichter; der Einsatz eines Refrains/Drops hebt kurz an (lead: das Leitbild
      // des Höhepunkts, die Köpfe springen dabei aus der Mitte auseinander – conv der Regie)
      const ld = Math.max(px.lead || 0, rig.landL);
      // zur Mitte: Aufbau (build, conv der Regie), DJ-Übergabe (hand), Landung im neuen Song (land – springt auseinander)
      const conv = Math.max(px.build * 0.8, px.conv || 0, rig.hand * 0.55, rig.land);
      // Treffen sich die Strahlen in der Mitte, addiert sich dort ihr Licht: jeder einzelne wird dann schwächer, und ohne
      // Blitze pulsen sie dort nicht mehr mit der Kick (zehn Strahlen im selben Takt wären an der Stelle ein Blinken)
      const kp = st.noFlash ? 0.4 * (1 - conv) : 0.4;
      const y = vh * 0.035, base = vis * (0.05 + 0.15 * px.I) * (1 - kp + kp * px.kickEnv) * (1 + 0.45 * (px.pulse || 0) + 0.4 * (px.lift || 0) + 0.5 * ld) * (1 - 0.4 * conv);
      // Lichtrampe im Aufbau: die Köpfe werden weißer (ohne Blitze nicht – dort wird nur der Riser ruhig heller)
      const wR = st.noFlash ? 0 : 0.5 * (px.ramp || 0);
      // Traverse
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "rgba(8,6,16,0.7)";
      ctx.fillRect(0, y - 3 * dpr, vw, 6 * dpr);
      ctx.globalCompositeOperation = "lighter";
      // Lauflicht: die Spitze wandert stetig von Kopf zu Kopf (zwei je Schlag) statt im Halbschlag ×3/×0,25 zu springen
      const lead = (((mb * 2) % n) + n) % n;
      for (let i = 0; i < n; i++) {
        const x = vw * (0.07 + (0.86 * i) / (n - 1)), u = i / (n - 1) - 0.5;
        const toCover = Math.atan2(st.cy - y, st.cx - x);
        let a = headAngle(rig.pat, i, u, mb, toCover);
        if (swing < 1) {
          const a0 = headAngle(rig.prev, i, u, mb, toCover);
          a = a0 + (a - a0) * swing;
        }
        a += (toCover - a) * conv; // im Aufbau richten sich alle auf die Mitte
        // Helligkeit je Muster (beim Schwenk zwischen altem und neuem überblendet); das Lauflicht als weiche Kuppe
        const kOf = (pat) => {
          if (pat === "chase") {
            const d = Math.min(Math.abs(i - lead), n - Math.abs(i - lead));
            return 0.25 + 2.75 * smooth(1 - d / 1.5);
          }
          return pat === "point" ? 0.6 + px.snareEnv * 1.2 : 1;
        };
        let k = base * (CALM.has(key) ? 0.5 : 1);
        k *= swing < 1 ? kOf(rig.prev) + (kOf(rig.pat) - kOf(rig.prev)) * swing : kOf(rig.pat);
        if (k < 0.004) continue;
        // Farbe nach dem Farbprogramm des Teils; Drop: die Strahlen werden weiß und klingen stetig in ihre Farbe zurück
        colProg(px.colP, i, n, mb);
        const pa = pal[cA], pb = pal[cB];
        for (let k2 = 0; k2 < 3; k2++) cBuf[k2] = pa[k2] + (pb[k2] - pa[k2]) * cF;
        const wht = Math.max(rig.drop * 0.8, wR);
        const c = mixW(cBuf, wht);
        // (ohne Blitze: breitere, schwächere Kegel – ein weicher Lichtfächer statt scharfer Strahlen, die beim Schwenken über
        // eine Stelle dort jedes Mal hell und wieder dunkel machen; zusammen mit dem fehlenden hellen Kern, siehe unten)
        const nf = st.noFlash ? 0.55 : 1;
        const len = vh * 1.2, wd = (0.03 + px.energy * 0.015 + rig.drop * 0.02) * (px.spread ?? 1) * (1 + 0.4 * ld) / nf ** 0.9;
        // Kegel mit weichem Rand: ein breiter, schwacher Lichthof (nur in voller Qualität), der Kegel selbst und
        // ein heller, schmaler Kern – wirkt wie ein Strahl im Dunst statt wie ein flaches Dreieck
        const cone = (w, al, col) => {
          const g = ctx.createRadialGradient(x, y, 0, x, y, len);
          g.addColorStop(0, rgba(col, k * 1.6 * al * nf));
          g.addColorStop(0.4, rgba(col, k * 0.5 * al * nf));
          g.addColorStop(1, rgba(col, 0));
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + Math.cos(a - w) * len, y + Math.sin(a - w) * len);
          ctx.lineTo(x + Math.cos(a + w) * len, y + Math.sin(a + w) * len);
          ctx.closePath();
          ctx.fill();
        };
        if ((st.quality ?? 2) >= 2) cone(wd * 2.2, 0.28, c);
        cone(wd, 1, c);
        // (ohne Blitze ohne den hellen Kern: ein Strahl, der über eine Stelle zieht, wird dort sonst zu einem harten Hell-dunkel)
        if (!st.noFlash) cone(wd * 0.3, 0.55, mixW(c, 0.5));
        const r = (8 + k * 70) * dpr;
        ctx.globalAlpha = clamp(k * 5, 0, 1);
        // Leuchtbild in 1/16-Stufen des Weißanteils (sonst bräuchte jedes Bild des Abklingens neue Leuchtbilder)
        ctx.drawImage(spr(mixW(cF < 0.5 ? pa : pb, Math.round(wht * 16) / 16).map((q) => q | 0), r), x - r, y - r, r * 2, r * 2);
        ctx.globalAlpha = 1;
      }
    }
    // Blinder: warmweiße Flächen-Leuchten, die auf großen Snare-Schlägen im Refrain aufreißen
    const sn = px.snareEnv > 0.8;
    if (st.flash && st.flashGo && BLIND.has(key) && sn && !rig.sn && px.energy > 0.78 && (st.hype || px.drop > 0.3 || px.finale) && cap.take(t)) rig.blind = 1;
    rig.sn = sn;
    rig.blind *= Math.exp(-dt * 7);
    if (rig.blind > 0.02 && vis > 0) {
      for (const f of [0.22, 0.42, 0.58, 0.78]) {
        const r = vh * 0.17 * (0.6 + rig.blind * 0.4);
        ctx.globalAlpha = rig.blind * 0.8 * vis;
        ctx.drawImage(spr([255, 236, 200], r), f * vw - r, vh * 0.05 - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = rgba([255, 236, 200], 0.05 * rig.blind * vis);
      ctx.fillRect(0, 0, vw, vh);
    }
    // Laserfläche: eine dünne Lichtebene über der Menge, kippt im Takt
    // (nur wo die Regie Bühneneffekte erlaubt: Refrain und Drop)
    const want = SHEET.has(key) && st.rig && !px.blackout && (px.fxMul ?? 1) >= 0.75 && (px.drop > 0.35 || (px.energy > 0.88 && px.build < 0.1)) ? 1 : 0;
    rig.sheet += (want - rig.sheet) * (1 - Math.exp(-dt * 3));
    if (rig.sheet > 0.02) {
      const c = mixW(pal[2], 0.35), tilt = Math.sin((mb * Math.PI) / 2) * 0.04, y0 = vh * (0.6 + 0.02 * Math.sin(t * 0.4));
      for (const [lw, al] of [[14 * dpr, 0.08], [2 * dpr, 0.6]]) {
        ctx.lineWidth = lw;
        ctx.strokeStyle = rgba(c, al * rig.sheet);
        ctx.beginPath();
        ctx.moveTo(0, y0 - (tilt * vw) / 2);
        ctx.lineTo(vw, y0 + (tilt * vw) / 2);
        ctx.stroke();
      }
      ctx.lineWidth = dpr;
      ctx.strokeStyle = rgba(c, 0.14 * rig.sheet);
      ctx.beginPath();
      for (let k = -4; k <= 4; k++) {
        const a = k * 0.03 + tilt;
        ctx.moveTo(0, y0 - (tilt * vw) / 2);
        ctx.lineTo(vw, y0 - (tilt * vw) / 2 + Math.tan(a) * vw);
      }
      ctx.stroke();
    }
    // ruhige Musik: weiches Bokeh statt Moving Heads
    if ((CALM.has(key) || v.decor === "fairy") && st.rig) drawBokeh(ctx, st, px, pal, dpr);
    if (st.rig && !px.blackout) drawCues(ctx, st, px, pal, dpr, vis);
  }

  /* ---- Lichtregie: Wechsel, Momente, Stil-Signaturen (Werte aus director.js über party.js) */
  function drawCues(ctx, st, px, pal, dpr, vis) {
    const t = st.t, dt = st.dt, soft = st.noFlash ? 0.4 : 1;
    // Lichtwisch beim Teilwechsel: ein weicher Lichtschleier gleitet in zwei Schlägen (mindestens 0,8 s) über die Bühne –
    // gleitet an und aus statt mit fester Geschwindigkeit, blendet über die ersten/letzten 15 % ein und aus und zieht
    // zwei blassere Abbilder seiner letzten Lagen nach (wirkt wie Bewegungsunschärfe statt Stottern von Bild zu Bild).
    // Quer eine Glocke in 9 Stufen, nach unten weich auslaufend (elliptischer Verlauf statt einer harten Schnittkante)
    if (px.wipe >= 0) {
      const c = mixW(pal[rig.col % 3], 0.3), w = vw * 0.19, ry = vh * 0.62;
      for (const [lag, al] of WIPE_TRAIL) {
        const q = px.wipe - lag;
        if (q < 0) continue;
        const W = wipeAt(q), f = px.wdir < 0 ? 1 - W.pos : W.pos;
        const a = 0.2 * (1 - 0.3 * q) * soft * vis * W.alpha * al;
        if (a < 0.004) continue;
        ctx.save();
        ctx.translate(vw * (f * 1.3 - 0.15), vh * 0.12);
        ctx.scale(1, ry / w);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, w);
        for (let s = 0; s < 9; s++) g.addColorStop(s / 8, rgba(c, a * WIPE_BELL[s]));
        ctx.fillStyle = g;
        ctx.fillRect(-w, -w, w * 2, w * 2);
        ctx.restore();
      }
    }
    // Rock: Lichtwand auf der Eins des Refrains – eine Reihe Blinder, durch dieselbe Blitz-Schranke wie alle Blitze
    const wallNow = (px.wall || 0) > 0.5;
    if (wallNow && !rig.wallOn && st.flash && st.flashGo && !st.noFlash && cap.take(t)) rig.wall = 1;
    rig.wallOn = wallNow;
    rig.wall *= Math.exp(-dt * 5);
    if (rig.wall > 0.03) {
      const r = vh * 0.12;
      ctx.globalAlpha = rig.wall * 0.75 * vis;
      for (let k = 0; k < 6; k++) ctx.drawImage(spr([255, 240, 215], r),vw * (0.12 + 0.152 * k) - r, vh * 0.06 - r, r * 2, r * 2);
      ctx.globalAlpha = 1;
    }
    // gehaltener Ton: ein warmer Verfolger-Spot von oben auf das Cover (endet am Cover, nicht in der Menge)
    if (px.vox > 0.03) {
      const sx = vw / 2, sy = -vh * 0.05, len = Math.hypot(st.cx - sx, st.cy - sy) + (st.R || 0), a = Math.atan2(st.cy - sy, st.cx - sx), c = mixW(pal[1], 0.55);
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, len);
      g.addColorStop(0, rgba(c, 0.05 * px.vox));
      g.addColorStop(0.8, rgba(c, 0.16 * px.vox));
      g.addColorStop(1, rgba(c, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.cos(a - 0.09) * len, sy + Math.sin(a - 0.09) * len);
      ctx.lineTo(sx + Math.cos(a + 0.09) * len, sy + Math.sin(a + 0.09) * len);
      ctx.fill();
    }
    // House: die Rückwand pumpt – sie duckt sich unter jede Kick und schwillt wieder an (Sidechain)
    if (px.pump > 0.05) {
      const r = vw * 0.55;
      ctx.globalAlpha = clamp(0.1 * px.pump * px.I * (1 - (st.noFlash ? 0.3 : 0.85) * px.kickEnv) * vis, 0, 1);
      ctx.drawImage(spr(pal[0], r), vw / 2 - r, vh * 0.3 - r * 0.6, r * 2, r * 1.2);
      ctx.globalAlpha = 1;
    }
    // Trap: jede 808 drückt Licht aus dem Boden
    if (px.boom > 0.03) {
      const r = vh * (0.45 + 0.3 * px.boom);
      ctx.globalAlpha = clamp(0.3 * px.boom * vis, 0, 1);
      ctx.drawImage(spr(pal[0], r), vw / 2 - r * 1.6, vh - r * 0.6, r * 3.2, r * 1.2);
      ctx.globalAlpha = 1;
    }
    // Ballade: warmes Licht von oben, das langsam über zwei Takte atmet
    if (px.swell > 0.03) {
      const r = vw * 0.5;
      ctx.globalAlpha = clamp(0.07 * px.swell * (0.5 + 0.5 * px.I), 0, 1);
      ctx.drawImage(spr([255, 196, 140], r), vw / 2 - r, -r * 0.55, r * 2, r * 1.1);
      ctx.globalAlpha = 1;
    }
  }
  let bokeh = null;
  function drawBokeh(ctx, st, px, pal, dpr) {
    bokeh ||= Array.from({ length: 18 }, () => ({ x: Math.random(), y: Math.random(), r: 0.4 + Math.random(), ph: Math.random() * 6.3, c: Math.floor(Math.random() * 3) }));
    for (const b of bokeh) {
      b.y -= st.dt * 0.012 * (0.5 + b.r);
      if (b.y < -0.1) [b.y, b.x] = [1.1, Math.random()];
      const r = (18 + b.r * 34) * dpr;
      ctx.globalAlpha = clamp((0.05 + 0.08 * px.energy) * (0.6 + 0.4 * Math.sin(st.t * 0.7 + b.ph)), 0, 1);
      ctx.drawImage(glowSprite(pal[b.c]), b.x * vw - r, b.y * vh - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
  }

  /* ---- Instrumente */
  const ins = { sparks: [], bolts: [], keys: new Float32Array(24), kHit: false };
  function drawInst(ctx, st, px, pal, dpr) {
    vw = st.vw;
    vh = st.vh;
    const I = st.inst, t = st.t, dt = st.dt;
    if (!I || px.blackout) return;
    ctx.globalCompositeOperation = "lighter";
    // Bläser: goldene Fanfaren-Strahlen aus den unteren Ecken, der Trichter glüht, Funken steigen auf
    if (I.brass > 0.01) {
      const L = I.brass, gold = [255, 200, 90];
      for (const side of [-1, 1]) {
        const ox = side < 0 ? 0 : vw, oy = vh * 0.95;
        for (let k = 0; k < 6; k++) {
          const a = -Math.PI / 2 - side * (0.15 + k * 0.14) + Math.sin(t * 1.5 + k) * 0.03, len = vh * (0.5 + 0.4 * L);
          const g = ctx.createLinearGradient(ox, oy, ox + Math.cos(a) * len, oy + Math.sin(a) * len);
          g.addColorStop(0, rgba(gold, 0.22 * L));
          g.addColorStop(1, rgba(gold, 0));
          ctx.strokeStyle = g;
          ctx.lineWidth = (18 - k * 2) * dpr;
          ctx.beginPath();
          ctx.moveTo(ox, oy);
          ctx.lineTo(ox + Math.cos(a) * len, oy + Math.sin(a) * len);
          ctx.stroke();
        }
        const r = vh * 0.14 * (0.6 + L * 0.5);
        ctx.globalAlpha = L * 0.8;
        ctx.drawImage(spr(gold, r), ox - r, oy - r, r * 2, r * 2);
        ctx.globalAlpha = 1;
        if (Math.random() < dt * 40 * L) ins.sparks.push({ x: ox + side * -Math.random() * vw * 0.08, y: oy, vx: -side * vw * (0.05 + Math.random() * 0.08), vy: -vh * (0.3 + Math.random() * 0.4), a: 1, c: gold });
      }
    }
    // Saxofon: weiche violette Rauchschwaden steigen links und rechts auf
    if (I.sax > 0.01) {
      const L = I.sax, smoke = mixW([190, 110, 255], 0.2);
      for (const [bx, dir] of [[0.12, 1], [0.88, -1]]) {
        for (let k = 0; k < 3; k++) {
          ctx.strokeStyle = rgba(k ? mixW(pal[k], 0.3) : smoke, (0.1 - k * 0.02) * L);
          ctx.lineWidth = (44 - k * 10) * dpr;
          ctx.beginPath();
          for (let s = 0; s <= 20; s++) {
            const f = s / 20, yy = vh * (0.95 - f * 0.75);
            const xx = vw * bx + dir * Math.sin(f * 5 + t * (0.8 + k * 0.2) + k) * vw * 0.05 * (0.5 + f);
            s ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy);
          }
          ctx.stroke();
        }
      }
    }
    // E-Gitarre: Blitze von der Traverse auf den betonten Schlägen – nur wenn die Blitz-Schranke frei ist
    // (höchstens drei pro Sekunde, zusammen mit allen anderen Blitzen), mit „Keine Blitze“ gar nicht
    if (I.guitar > 0.3) {
      const hitNow = px.kickEnv > 0.8 || px.snareEnv > 0.8;
      if (hitNow && !ins.kHit && st.flashGo && !st.noFlash && cap.take(t)) {
        const pts = [];
        const x = vw * (0.15 + Math.random() * 0.7), y = vh * 0.04;
        const tx = x + (Math.random() - 0.5) * vw * 0.3, ty = vh * (0.45 + Math.random() * 0.15);
        for (let s = 0; s <= 10; s++) {
          const f = s / 10;
          pts.push([x + (tx - x) * f + (s && s < 10 ? (Math.random() - 0.5) * vw * 0.04 : 0), y + (ty - y) * f]);
        }
        ins.bolts.push({ pts, a: 1 });
      }
      ins.kHit = hitNow;
      // dazwischen knistert es an der Traverse: kleine blaue Funken – fester Zufall je Zeitfenster (1/6 s, versetzt)
      // mit weicher Hülle statt Math.random in jedem Bild (das flackerte, und je nach Bildrate anders)
      if (!st.noFlash) {
        for (let k = 0; k < 3; k++) {
          const ts = t * 6 + k / 3, slot = Math.floor(ts), id = slot * 3 + k;
          if (hash(id, 41) > 0.5 * I.guitar) continue;
          const r = (10 + hash(id, 42) * 16) * dpr;
          ctx.globalAlpha = (0.5 + hash(id, 43) * 0.5) * Math.sin(Math.PI * (ts - slot));
          ctx.drawImage(glowSprite([170, 200, 255]), hash(id, 44) * vw - r, vh * 0.035 - r, r * 2, r * 2);
        }
        ctx.globalAlpha = 1;
      }
    }
    ins.bolts = ins.bolts.filter((b) => (b.a -= dt * 5.5) > 0);
    for (const b of ins.bolts) {
      for (const [lw, c, al] of [[10 * dpr, [140, 170, 255], 0.25], [2.2 * dpr, [235, 245, 255], 0.95]]) {
        ctx.lineWidth = lw;
        ctx.strokeStyle = rgba(c, al * b.a * Math.max(I.guitar, 0.3));
        ctx.beginPath();
        b.pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
      }
    }
    // Klavier: 24 Lichttasten über der Menge, ihre Helligkeit folgt den gerade gespielten Tönen
    if (I.piano > 0.01 || ins.keys.some((k) => k > 0.01)) {
      const ch = I.chroma, w = vw / 24;
      for (let k = 0; k < 24; k++) {
        const target = ch ? (ch[k % 12] || 0) * I.piano : 0;
        ins.keys[k] += (target - ins.keys[k]) * (1 - Math.exp(-dt * (target > ins.keys[k] ? 18 : 4)));
        const L = ins.keys[k];
        if (L < 0.02) continue;
        const h = vh * (0.08 + 0.18 * L), x = k * w + w * 0.2, yb = vh * 0.84;
        const g = ctx.createLinearGradient(0, yb - h, 0, yb);
        g.addColorStop(0, rgba(pal[k % 3], 0));
        g.addColorStop(1, rgba(mixW(pal[k % 3], 0.45), 0.55 * L));
        ctx.fillStyle = g;
        ctx.fillRect(x, yb - h, w * 0.6, h);
        const r = w * 0.7;
        ctx.globalAlpha = clamp(L * 0.6, 0, 1);
        ctx.drawImage(glowSprite(pal[k % 3]), x + w * 0.3 - r, yb - r, r * 2, r * 2);
        ctx.globalAlpha = 1;
      }
    }
    // Streicher: drei lange Seidenbänder fließen quer durchs Bild
    if (I.strings > 0.01) {
      const L = I.strings;
      for (let k = 0; k < 3; k++) {
        const yy = (x) => vh * (0.28 + 0.12 * k) + Math.sin((x / vw) * Math.PI * 2.4 + t * 0.6 + k * 1.7) * vh * 0.05;
        for (const [lw, al] of [[16 * dpr, 0.06], [2 * dpr, 0.3]]) {
          ctx.lineWidth = lw;
          ctx.strokeStyle = rgba(mixW(pal[k], 0.25), al * L);
          ctx.beginPath();
          for (let s = 0; s <= 32; s++) {
            const x = (s / 32) * vw;
            s ? ctx.lineTo(x, yy(x)) : ctx.moveTo(x, yy(x));
          }
          ctx.stroke();
        }
      }
    }
    // Chor: Lichtschein von oben, langsam drehende Strahlen
    if (I.choir > 0.01) {
      const L = I.choir, ox = vw / 2, oy = -vh * 0.1;
      for (let k = 0; k < 9; k++) {
        const a = Math.PI / 2 + (k - 4) * 0.14 + Math.sin(t * 0.2) * 0.05, len = vh * 1.1;
        const g = ctx.createLinearGradient(ox, oy, ox + Math.cos(a) * len, oy + Math.sin(a) * len);
        g.addColorStop(0, rgba([255, 245, 225], 0.2 * L));
        g.addColorStop(1, rgba([255, 245, 225], 0));
        ctx.strokeStyle = g;
        ctx.lineWidth = 40 * dpr;
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.lineTo(ox + Math.cos(a) * len, oy + Math.sin(a) * len);
        ctx.stroke();
      }
    }
    // Schlagzeug-Solo: vier Trommelfelle aus Licht unter der Traverse – außen die Kick, innen die Snare,
    // ein feiner Schimmer für die Hi-Hat. Mit „Keine Blitze“ leuchten sie ruhig, statt im Schlag zu pulsen.
    if (I.drums > 0.01) {
      const L = I.drums, env = (v) => (st.noFlash ? 0.45 : 0.25 + 0.75 * v);
      [[0.2, px.kickEnv, 1], [0.4, px.snareEnv, 0.8], [0.6, px.snareEnv, 0.8], [0.8, px.kickEnv, 1]].forEach(([f, e, sz], k) => {
        const x = vw * f, y = vh * 0.13, r = vh * 0.05 * sz * (0.85 + 0.15 * env(e)), c = mixW(pal[k % 3], 0.35);
        ctx.lineWidth = 2 * dpr;
        ctx.strokeStyle = rgba(c, 0.5 * L * env(e));
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * 0.38, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = clamp(0.4 * L * env(e), 0, 1);
        ctx.drawImage(glowSprite(c.map((q) => q | 0)), x - r * 1.3, y - r * 1.3, r * 2.6, r * 2.6);
        ctx.globalAlpha = 1;
      });
      const hr = vh * 0.02;
      ctx.globalAlpha = clamp(0.35 * L * env(px.hatEnv), 0, 1);
      ctx.drawImage(glowSprite([255, 244, 214]), vw * 0.5 - hr, vh * 0.085 - hr, hr * 2, hr * 2);
      ctx.globalAlpha = 1;
    }
    // Bass: langsame Druckwellen aus den unteren Ecken (dort stehen die Boxen), dunkel und breit
    if (I.bass > 0.01) {
      // (die Wellen sind kräftiger, solange tiefe Töne wirklich klingen – px.bass, party.js/bass.js)
      const L = I.bass * (0.55 + 0.45 * (px.bass ?? 1)), c = mixW(pal[0], 0.15);
      for (const ox of [0, vw]) {
        for (let k = 0; k < 3; k++) {
          const ph = (t * 0.45 + k / 3) % 1, r = vh * (0.06 + 0.24 * ph);
          ctx.lineWidth = (14 - 8 * ph) * dpr;
          ctx.strokeStyle = rgba(c, 0.16 * L * (1 - ph));
          ctx.beginPath();
          ctx.arc(ox, vh * 0.92, r, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }
    // Synthesizer: eine Rechteck-Welle aus Licht läuft oben quer durchs Bild (wie auf einem Oszilloskop)
    if (I.synth > 0.01) {
      const L = I.synth, c = mixW(pal[2], 0.3), y0 = vh * 0.2, amp = vh * 0.035, step = vw / 16, off = (t * step * 0.9) % (step * 2);
      for (const [lw, al] of [[9 * dpr, 0.07], [1.6 * dpr, 0.5]]) {
        ctx.lineWidth = lw;
        ctx.strokeStyle = rgba(c, al * L);
        ctx.beginPath();
        for (let k = -2, up = true; k <= 18; k++, up = !up) {
          const x = k * step - off, y = y0 + (up ? -amp : amp);
          k === -2 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          ctx.lineTo(x + step, y);
        }
        ctx.stroke();
      }
    }
    // Akkordeon: ein Balg aus Lichtfalten an beiden Rändern, der langsam auf- und zugeht
    if (I.accordion > 0.01) {
      const L = I.accordion, open = 0.55 + 0.45 * Math.sin(t * 1.1), c = [255, 196, 140];
      for (const side of [-1, 1]) {
        for (let k = 0; k < 7; k++) {
          const x = (side < 0 ? 0 : vw) - side * vw * (0.012 + 0.013 * k * open), lean = (k % 2 ? 1 : -1) * vw * 0.004;
          ctx.lineWidth = 2 * dpr;
          ctx.strokeStyle = rgba(k % 2 ? c : mixW(pal[1], 0.3), (0.3 - k * 0.03) * L);
          ctx.beginPath();
          ctx.moveTo(x - lean, vh * 0.22);
          ctx.lineTo(x + lean, vh * 0.7);
          ctx.stroke();
        }
      }
    }
    // Flöte: ein Lufthauch – kleine helle Punkte ziehen in einer weichen Welle oben durchs Bild
    if (I.flute > 0.01) {
      const L = I.flute, c = [214, 240, 255];
      for (let k = 0; k < 12; k++) {
        const f = (t * 0.06 + k / 12) % 1, x = vw * (f * 1.1 - 0.05), y = vh * (0.16 + 0.05 * Math.sin(f * 9 + k * 0.6) + 0.012 * (k % 3));
        const r = (5 + (k % 4) * 2) * dpr;
        ctx.globalAlpha = clamp(0.6 * L * Math.sin(f * Math.PI), 0, 1);
        ctx.drawImage(glowSprite(c), x - r, y - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1;
    }
    // Harfe: feine Lichtsaiten von der Traverse, ein Glissando wandert langsam über sie hinweg
    if (I.harp > 0.01) {
      const L = I.harp, n = 16, gl = (t * 0.35) % 1.4 - 0.2;
      for (let k = 0; k < n; k++) {
        const f = k / (n - 1), x = vw * (0.3 + 0.4 * f), len = vh * (0.34 - 0.16 * f);
        const hit = clamp(1 - Math.abs(f - gl) * 5, 0, 1);
        const g = ctx.createLinearGradient(0, vh * 0.04, 0, vh * 0.04 + len);
        g.addColorStop(0, rgba([255, 232, 180], (0.12 + 0.4 * hit) * L));
        g.addColorStop(1, rgba([255, 232, 180], 0));
        ctx.strokeStyle = g;
        ctx.lineWidth = (1 + hit) * dpr;
        ctx.beginPath();
        ctx.moveTo(x, vh * 0.04);
        ctx.lineTo(x, vh * 0.04 + len);
        ctx.stroke();
      }
    }
    // Funken der Bläser
    ins.sparks = ins.sparks.filter((s) => (s.a -= dt * 0.9) > 0);
    for (const s of ins.sparks) {
      s.vy += vh * 0.2 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      const r = 6 * dpr;
      // weich hinein (80 ms statt voll im ersten Bild), dann langsam aus
      ctx.globalAlpha = s.a * envAR((1 - s.a) / 0.9);
      ctx.drawImage(glowSprite(s.c), s.x - r, s.y - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
  }

  return { drawRig, drawInst };
}

export { createShow };
