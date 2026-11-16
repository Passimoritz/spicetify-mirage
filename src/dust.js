import { root } from "./core.js";
import { schemePalette, cfg } from "./config.js";
import { current } from "./color.js";
import { stage, onHaze } from "./stage.js";
import { beat, audio } from "./audio.js";
import { tier } from "./perf.js";

/* ---------------------------------------------------------------- Umgebungs-Hintergrund */
// Cover-Licht (zwei gedrehte Lagen), Aurora-Bänder, Puls, Lichtstaub und Vignette – alles in
// EINEM Canvas in Viertel-Auflösung, hochskaliert. Der Inhalt ist ohnehin weich, darum sieht
// man den Unterschied nicht; die Grafikkarte muss aber statt sieben bildschirmfüllender,
// gemischter Ebenen nur noch eine kleine Textur hochladen und einmal zeichnen. Die Licht-
// Mischungen (screen, soft-light) kosten in dieser Größe fast nichts – also gibt es sie für alle.
//
// Takt: 15 Bilder pro Sekunde (Voll 20, Leicht 10), gleichmäßig auf ganze Bildschirmbilder gelegt – so viele,
// wie der alte Wecker-Takt (Ziel 20/30/12) tatsächlich schaffte, nur ohne Stolpern. Nur wenn Musik läuft
// oder ein Cover überblendet.
// Pause, verdeckt, Immersiv offen: ein Standbild, keine Schleife.
const SCALE = 0.25, FADE = 2200;
// Bildrate je Preset: jedes Hintergrund-Bild zwingt Spotify, das ganze Fenster neu zusammenzusetzen.
// Die Bilder liegen auf ganzen Bildschirm-Refreshes (gleichmäßige Abstände). „Eigene“ bleibt im Rahmen
// des Presets, von dem man kam (aus „Leicht“ also weiter 10)
const fps = () => (cfg.preset === "full" ? 20 : tier() === "light" ? 10 : 15);
const TAU = Math.PI * 2;
const tri = (x) => 1 - Math.abs(2 * (x - Math.floor(x)) - 1); // 0 → 1 → 0 pro Periode
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

const dust = (() => {
  const cv = stage.querySelector("canvas");
  const ctx = cv.getContext("2d", { alpha: false });
  const vig = document.createElement("canvas");
  let W = 0, H = 0, timer = 0, running = false, paused = false, lastT = 0, clock = 0, aliveUntil = 0, drawnAt = 0, lvlS = 0;
  let pal = schemePalette(), base = [7, 6, 12], sprites = [];
  // Cover-Lagen: die neue blendet ein, alle älteren gemeinsam aus – auch wenn ein Wechsel mitten in die
  // Überblendung fällt (vorher sprang die halb eingeblendete Lage dann auf voll)
  let layers = [], fadeT0 = 0;
  const parts = [];

  /* ---- Bausteine, einmal vorbereitet */
  function sprite(rgb) {
    const s = document.createElement("canvas");
    s.width = s.height = 32;
    const x = s.getContext("2d");
    const g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, rgba(rgb, 0.9));
    g.addColorStop(0.25, rgba(rgb, 0.35));
    g.addColorStop(1, rgba(rgb, 0));
    x.fillStyle = g;
    x.fillRect(0, 0, 32, 32);
    return s;
  }
  function baseColor() {
    const v = getComputedStyle(root).getPropertyValue("--spice-rgb-main").split(",").map(Number);
    return v.length === 3 && v.every((n) => n >= 0) ? v : [7, 6, 12];
  }
  function recolor(cols) {
    pal = cols || schemePalette();
    base = baseColor();
    sprites = [...pal, [255, 255, 255]].map(sprite);
    if (running && !timer) draw(performance.now());
  }
  // Vignette ändert sich nur mit der Fenstergröße
  function buildVignette() {
    vig.width = W;
    vig.height = H;
    const x = vig.getContext("2d");
    x.clearRect(0, 0, W, H);
    x.save();
    x.translate(W / 2, H * 0.4);
    x.scale(W * 1.2, H * 0.9);
    const g = x.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0.4, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.75)");
    x.fillStyle = g;
    x.fillRect(-2, -2, 4, 4);
    x.restore();
    const l = x.createLinearGradient(0, 0, 0, H);
    l.addColorStop(0, "rgba(0,0,0,0.25)");
    l.addColorStop(0.3, "rgba(0,0,0,0)");
    l.addColorStop(0.7, "rgba(0,0,0,0)");
    l.addColorStop(1, "rgba(0,0,0,0.5)");
    x.fillStyle = l;
    x.fillRect(0, 0, W, H);
  }
  function resize() {
    W = cv.width = Math.max(160, Math.round(innerWidth * SCALE));
    H = cv.height = Math.max(90, Math.round(innerHeight * SCALE));
    buildVignette();
  }
  function spawn(p, anywhere) {
    p.x = Math.random() * W;
    p.y = anywhere ? Math.random() * H : H + 8;
    p.r = 0.8 + Math.random() * 4;
    p.vy = 0.06 + Math.random() * 0.2;
    p.vx = (Math.random() - 0.5) * 0.1;
    p.ph = Math.random() * TAU;
    p.a = 0.25 + Math.random() * 0.6;
    p.k = Math.floor(Math.random() * 4);
  }

  /* ---- Ebenen */
  // Cover-Lage: wie früher ein 1,8 × 1,8 Fenster großes Feld, gedreht und leicht pulsierend skaliert
  function haze(img, alpha, period, dir, ox, oy, op) {
    if (!img || alpha <= 0) return;
    const D = Math.max(W, H) * 1.8;
    const k = 1.15 + 0.2 * tri(clock / period);
    ctx.save();
    ctx.globalCompositeOperation = op;
    ctx.globalAlpha = alpha;
    ctx.translate(ox, oy);
    ctx.rotate(dir * (clock / period) * TAU);
    ctx.scale(k, k);
    ctx.drawImage(img, W / 2 - ox - D / 2, H / 2 - oy - D / 2, D, D);
    ctx.restore();
  }
  function ellipse(cx, cy, rx, ry, c, a) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(rx, ry);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, rgba(c, a));
    g.addColorStop(0.7, rgba(c, 0));
    ctx.fillStyle = g;
    ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
  }
  function aurora(light) {
    // hin und her über 28 s, wie die frühere CSS-Animation
    const p = ease(tri(clock / 56));
    const EW = W * 1.24, EH = H * 1.24, ex = -W * 0.12, ey = -H * 0.12;
    ctx.save();
    ctx.globalCompositeOperation = light ? "multiply" : "soft-light";
    ctx.globalAlpha = light ? 0.5 : 1;
    ctx.translate(W / 2 + EW * (-0.04 + 0.08 * p), H / 2 + EH * (-0.02 + 0.05 * p));
    ctx.rotate(((-4 + 9 * p) * Math.PI) / 180);
    ctx.scale(1 + 0.12 * p, 1 + 0.12 * p);
    ctx.translate(-W / 2, -H / 2);
    ellipse(ex + EW * 0.2, ey + EH * 0.3, EW * 0.4, EH * 0.35, pal[0], 0.55);
    ellipse(ex + EW * 0.8, ey + EH * 0.2, EW * 0.35, EH * 0.4, pal[1], 0.45);
    ellipse(ex + EW * 0.6, ey + EH * 0.85, EW * 0.45, EH * 0.35, pal[2], 0.35);
    ctx.restore();
  }
  function pulse(playing, lvl) {
    if (!playing) return;
    let o, s;
    if (cfg.beat && audio.data) {
      o = 0.4 + 0.6 * lvl;
      s = 1 + 0.07 * lvl;
    } else {
      const b = (1 - Math.cos((clock / 4.2) * TAU)) / 2; // ruhiges Atmen ohne Taktdaten
      o = 0.55 + 0.45 * b;
      s = 1 + 0.08 * b;
    }
    ctx.save();
    ctx.globalAlpha = o;
    ctx.translate(W / 2, H * 1.1);
    ctx.scale(s, s);
    ellipse(0, 0, W * 0.6, H * 0.6, pal[0], 0.35);
    ctx.restore();
  }
  function particles(dt, lvl) {
    if (!cfg.particles || !sprites.length) return;
    const speed = 1 + lvl * 2.5;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const p of parts) {
      if (dt) {
        p.ph += 0.01 * dt;
        p.y -= p.vy * speed * dt;
        p.x += (p.vx + Math.sin(p.ph) * 0.08) * speed * dt;
        if (p.y < -10) spawn(p, false);
      }
      ctx.globalAlpha = p.a * (0.6 + Math.sin(p.ph * 3) * 0.4);
      const d = p.r * 4 * (1 + lvl * 0.4);
      ctx.drawImage(sprites[p.k] || sprites[0], p.x - d / 2, p.y - d / 2, d, d);
    }
    ctx.restore();
  }

  /* ---- ein Bild */
  function draw(now) {
    const playing = root.classList.contains("mirage-playing");
    const moving = playing && !cfg.calm;
    // bis 100 ms zählen voll: bei 12 Bildern/s (83 ms) lief die Bewegung sonst gebremst und ungleichmäßig
    const dt = lastT ? Math.min(6, (now - lastT) / 16.7) : 0;
    lastT = now;
    if (moving) clock += (dt * 16.7) / 1000;
    const light = root.classList.contains("mirage-light");
    // Takt-Atmen geglättet: bei 12–30 Bildern/s sprang der Puls sonst von Bild zu Bild (schnell hoch, weich ab)
    const want = moving ? beat.level : 0, k = (dt * 16.7) / 1000;
    lvlS += (want - lvlS) * (1 - Math.exp(-k * (want > lvlS ? 22 : 6)));
    const lvl = lvlS;
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.fillStyle = rgba(base, 1);
    ctx.fillRect(0, 0, W, H);
    // Überblendung alt → neu
    const f = layers.length ? ease(Math.min(1, (now - fadeT0) / FADE)) : 0;
    if (f >= 1 && layers.length > 1) layers = layers.slice(-1);
    const bright = cfg.bright / 100, cur = layers[layers.length - 1]?.img;
    layers.forEach((L, i) => {
      const a = i === layers.length - 1 ? f : L.a0 * (1 - f);
      if (a <= 0.002) return;
      haze(L.img, a * (light ? 0.55 : 0.95), 70, 1, W / 2, H / 2, "source-over");
      haze(L.img, a * (light ? 0.35 : 0.55), 95, -1, W * 0.14, H * 0.86, light ? "source-over" : "screen");
    });
    if (bright < 1) {
      ctx.globalAlpha = 1 - bright;
      ctx.fillStyle = rgba(base, 1);
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    } else if (bright > 1 && cur) {
      haze(cur, (bright - 1) * 0.6, 70, 1, W / 2, H / 2, "lighter");
    }
    if (!cfg.lite) aurora(light);
    pulse(playing && !cfg.calm, lvl);
    particles(moving ? dt : 0, lvl);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = light ? 0.2 : 1;
    ctx.drawImage(vig, 0, 0);
    ctx.globalAlpha = 1;
  }

  /* ---- Takt */
  function active() {
    if (!running || paused || document.hidden) return false;
    const moving = root.classList.contains("mirage-playing") && !cfg.calm;
    return moving || performance.now() < aliveUntil;
  }
  // Gleichmäßiger Takt: der Wecker klingelt kurz vor dem gewünschten Bild, gezeichnet wird im nächsten
  // Bildschirmbild. Vorher kam nach der Wartezeit noch die Wartezeit aufs nächste Bild dazu – mal 50, mal
  // 66 ms Abstand, die langsame Drift wirkte dadurch unruhig.
  function tick() {
    timer = 0;
    if (!running || document.hidden) return;
    requestAnimationFrame(frame);
  }
  function frame(now) {
    if (!running || document.hidden) return;
    const step = 1000 / fps();
    // zu früh geweckt (Bildschirmbild vor dem Zieltermin): ein Bild weiter warten statt zu früh zu zeichnen
    if (now > drawnAt && now - drawnAt < step - 4) return void requestAnimationFrame(frame);
    draw(now);
    // im Raster bleiben; kam das Bild deutlich zu spät, ab hier neu zählen (kein Aufholen mit einem zu kurzen Abstand)
    drawnAt = Math.abs(now - drawnAt - step) < 8 ? drawnAt + step : now;
    if (active()) timer = setTimeout(tick, Math.max(0, drawnAt + step - performance.now() - 20));
    else lastT = 0;
  }
  // nach Play, Sichtbarwerden, neuem Cover oder Schließen des Immersiv-Modus
  function wake() {
    if (!running || timer) return;
    timer = setTimeout(tick, 0);
  }
  document.addEventListener("visibilitychange", wake);

  onHaze((src) => {
    const img = new Image();
    img.onload = () => {
      // läuft gerade eine Überblendung, startet die neue vom aktuellen Mischstand aus: jede Lage behält
      // ihre momentane Deckkraft und blendet von dort aus
      const now = performance.now(), f = layers.length ? ease(Math.min(1, (now - fadeT0) / FADE)) : 1;
      layers = layers.map((L, i) => ({ img: L.img, a0: i === layers.length - 1 ? f : L.a0 * (1 - f) })).filter((L) => L.a0 > 0.01).slice(-3);
      layers.push({ img, a0: 0 });
      fadeT0 = now;
      aliveUntil = fadeT0 + FADE + 100;
      wake();
    };
    img.src = src;
  });

  function pause(on) {
    paused = on;
    if (!on) wake();
  }
  function start() {
    if (!running) {
      running = true;
      cv.style.display = "";
      resize();
      recolor(current);
      if (!parts.length) for (let i = 0; i < 56; i++) { const p = {}; spawn(p, true); parts.push(p); }
    }
    // Einstellungen können sich geändert haben (Lichtstaub, Helligkeit, ruhig): neu zeichnen
    aliveUntil = Math.max(aliveUntil, performance.now() + 50);
    wake();
  }
  function stop() {
    running = false;
    clearTimeout(timer);
    timer = 0;
    cv.style.display = "none";
  }
  addEventListener("resize", () => {
    if (!running) return;
    resize();
    aliveUntil = performance.now() + 50;
    wake();
  });
  return { start, stop, recolor, pause, wake };
})();

export { dust };
