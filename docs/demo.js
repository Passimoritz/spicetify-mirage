/* Mirage – interactive demo
   Covers are generated in code, then analysed exactly like Mirage/theme.js does it:
   draw at 64×64 → quantize() into 4-bit buckets → shape() into three readable colours. */
(function () {
  "use strict";

  /* ------------------------------------------------------------ Palette (ported from theme.js) */
  const Palette = (() => {
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const hueGap = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
    const rgb2hsl = ([r, g, b]) => {
      r /= 255; g /= 255; b /= 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const l = (max + min) / 2;
      if (max === min) return [0, 0, l];
      const d = max - min;
      const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      return [h * 60, s, l];
    };
    const hsl2rgb = ([h, s, l]) => {
      const k = (n) => (n + h / 30) % 12;
      const a = s * Math.min(l, 1 - l);
      const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
      return [f(0), f(8), f(4)].map((v) => Math.round(v * 255));
    };
    const hex2rgb = (h) => {
      const m = /^#?([0-9a-f]{6})$/i.exec(String(h || "").trim());
      if (!m) return null;
      const n = parseInt(m[1], 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    };
    const rgb2hex = (c) => "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");

    // Three lead colours: A (accent), B (deep partner), C (bright light) – readable on dark glass.
    function shape(colors) {
      const [h1, s1] = rgb2hsl(colors[0]);
      const gray = s1 < 0.12;
      const second = colors[1] ? rgb2hsl(colors[1]) : [(h1 + 40) % 360, s1, 0.5];
      const a = hsl2rgb([h1, gray ? s1 : clamp(s1, 0.5, 0.95), 0.68]);
      const b = hsl2rgb([second[0], gray ? second[1] : clamp(second[1], 0.45, 0.95), 0.52]);
      const c = hsl2rgb([(h1 + 12) % 360, gray ? s1 : clamp(s1 * 0.8, 0.35, 0.85), 0.84]);
      return [a, b, c];
    }

    function quantize(data) {
      const buckets = new Map();
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 200) continue;
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
        const e = buckets.get(key) || { r: 0, g: 0, b: 0, n: 0 };
        e.r += r; e.g += g; e.b += b; e.n++;
        buckets.set(key, e);
      }
      const ranked = [...buckets.values()]
        .map((e) => {
          const rgb = [e.r / e.n, e.g / e.n, e.b / e.n].map(Math.round);
          const [h, s, l] = rgb2hsl(rgb);
          const lightOk = l > 0.12 && l < 0.92 ? 1 : 0.15;
          return { rgb, h, s, score: e.n * (0.2 + s * s * 2) * lightOk };
        })
        .sort((x, y) => y.score - x.score);
      if (!ranked.length) return null;
      const first = ranked[0];
      const partner = ranked.find((c) => hueGap(c.h, first.h) > 28 && c.s > 0.15) || null;
      return shape([first.rgb, partner && partner.rgb]);
    }

    return { clamp, hueGap, rgb2hsl, hsl2rgb, hex2rgb, rgb2hex, shape, quantize };
  })();

  // Node (for testing the palette logic): export and stop here.
  if (typeof document === "undefined") {
    if (typeof module !== "undefined") module.exports = Palette;
    return;
  }

  const { hex2rgb, rgb2hex, quantize } = Palette;
  const root = document.documentElement;
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const motionQuery = matchMedia("(prefers-reduced-motion: reduce)");
  let motionOK = !motionQuery.matches;

  /* ------------------------------------------------------------ Schemes (Mirage/color.ini) */
  const SCHEMES = {
    Mirage:   { main: "07060C", elev: "12101C", high: "1C1929", side: "0B0A12", text: "F5F3FF", sub: "B9B4CC", a: "B69CFF", b: "7C5CFF", c: "D4C6FF" },
    Obsidian: { main: "050505", elev: "101010", high: "1A1A1A", side: "090909", text: "F2F2F2", sub: "A8A8A8", a: "E8E8E8", b: "3A3A3A", c: "FFFFFF" },
    Sakura:   { main: "0E070B", elev: "1A0E15", high: "26141E", side: "12090E", text: "FFF2F6", sub: "D9B3C1", a: "FF8FB8", b: "E0507F", c: "FFB8D2" },
    Abyss:    { main: "03090C", elev: "081419", high: "0E1E25", side: "050D11", text: "EAFBFF", sub: "9CC3CF", a: "4FE3FF", b: "1AA6C2", c: "9AF0FF" },
    Ember:    { main: "0C0705", elev: "18100B", high: "241811", side: "100A07", text: "FFF6EE", sub: "D6B8A0", a: "FF9F45", b: "E06A1A", c: "FFC48A" },
  };
  // In color.ini: a = button, b = notification, c = button-active.

  /* ------------------------------------------------------------ Generated covers (no real album art) */
  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const S = 320;
  function lin(x, x0, y0, x1, y1, stops) {
    const g = x.createLinearGradient(x0, y0, x1, y1);
    stops.forEach(([o, c]) => g.addColorStop(o, c));
    return g;
  }
  function blob(x, cx, cy, r, color) {
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, color);
    g.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, S, S);
  }

  const COVERS = [
    {
      title: "Velvet Hours", artist: "Lumen Atlas", album: "Night Bloom", dur: 192000,
      draw(x, r) {
        x.fillStyle = lin(x, 0, 0, S, S, [[0, "#1d0636"], [0.55, "#4a1170"], [1, "#2a0a3f"]]);
        x.fillRect(0, 0, S, S);
        blob(x, S * 0.3, S * 0.35, S * 0.55, "rgba(181,74,255,0.9)");
        blob(x, S * 0.75, S * 0.7, S * 0.5, "rgba(255,92,170,0.85)");
        blob(x, S * 0.65, S * 0.2, S * 0.3, "rgba(255,170,220,0.6)");
        x.strokeStyle = "rgba(255,230,250,0.5)";
        x.lineWidth = 2;
        for (let i = 0; i < 5; i++) {
          x.beginPath();
          x.arc(S * 0.5, S * 0.55, 40 + i * 22, 0, Math.PI * 2);
          x.globalAlpha = 0.5 - i * 0.08;
          x.stroke();
        }
        x.globalAlpha = 1;
        for (let i = 0; i < 30; i++) {
          x.fillStyle = `rgba(255,220,245,${0.3 + r() * 0.6})`;
          x.beginPath(); x.arc(r() * S, r() * S, r() * 2 + 0.5, 0, Math.PI * 2); x.fill();
        }
      },
    },
    {
      title: "Tidal Glass", artist: "Coastline Theory", album: "Deep Blue Hours", dur: 245000,
      draw(x, r) {
        x.fillStyle = lin(x, 0, 0, 0, S, [[0, "#04223f"], [1, "#021226"]]);
        x.fillRect(0, 0, S, S);
        const bands = ["#0a4f86", "#0e78b0", "#13a3c8", "#4fd1d9", "#b8f1ee"];
        bands.forEach((c, i) => {
          const base = S * 0.28 + i * S * 0.14, amp = 10 + r() * 14, f = 0.018 + r() * 0.012, ph = r() * 6;
          x.fillStyle = c;
          x.beginPath();
          x.moveTo(0, S);
          for (let px = 0; px <= S; px += 4) x.lineTo(px, base + Math.sin(px * f + ph) * amp);
          x.lineTo(S, S);
          x.closePath();
          x.globalAlpha = 0.9;
          x.fill();
        });
        x.globalAlpha = 1;
        blob(x, S * 0.78, S * 0.18, S * 0.22, "rgba(220,250,255,0.75)");
      },
    },
    {
      title: "Golden Hour Drive", artist: "Sola Vista", album: "Heatwave", dur: 178000,
      draw(x) {
        x.fillStyle = lin(x, 0, 0, 0, S, [[0, "#ff5e1a"], [0.45, "#ff9a2e"], [0.7, "#ffc85a"], [1, "#ff7a2a"]]);
        x.fillRect(0, 0, S, S);
        x.fillStyle = lin(x, 0, S * 0.25, 0, S * 0.75, [[0, "#fff3c4"], [1, "#ffb347"]]);
        x.beginPath(); x.arc(S / 2, S * 0.56, S * 0.27, 0, Math.PI * 2); x.fill();
        x.fillStyle = "#c2321b";
        for (let i = 0; i < 6; i++) x.fillRect(0, S * 0.58 + i * 14, S, 3 + i * 1.5);
        x.fillStyle = lin(x, 0, S * 0.72, 0, S, [[0, "#8f2414"], [1, "#4a0f0a"]]);
        x.beginPath();
        x.moveTo(0, S * 0.8); x.lineTo(S * 0.35, S * 0.7); x.lineTo(S * 0.6, S * 0.78); x.lineTo(S, S * 0.68); x.lineTo(S, S); x.lineTo(0, S);
        x.fill();
      },
    },
    {
      title: "Canopy", artist: "Moss & Ember", album: "Understory", dur: 221000,
      draw(x, r) {
        x.fillStyle = lin(x, 0, 0, S, S, [[0, "#0c3320"], [1, "#05190f"]]);
        x.fillRect(0, 0, S, S);
        const greens = ["#1f6b3a", "#2f8f46", "#4cae4f", "#86c95a", "#c4e27a"];
        for (let i = 0; i < 70; i++) {
          x.save();
          x.translate(r() * S, r() * S);
          x.rotate(r() * Math.PI * 2);
          x.fillStyle = greens[Math.floor(r() * greens.length)];
          x.globalAlpha = 0.7 + r() * 0.3;
          const w = 14 + r() * 34;
          x.beginPath(); x.ellipse(0, 0, w, w * 0.38, 0, 0, Math.PI * 2); x.fill();
          x.restore();
        }
        x.globalAlpha = 1;
        blob(x, S * 0.5, S * 0.1, S * 0.45, "rgba(230,255,170,0.45)");
      },
    },
    {
      title: "Grayscale", artist: "Silent Film Club", album: "Contact Sheet", dur: 207000,
      draw(x) {
        x.fillStyle = "#121212";
        x.fillRect(0, 0, S, S);
        for (let i = 14; i > 0; i--) {
          x.fillStyle = i % 2 ? "#e9e9e9" : "#1a1a1a";
          x.beginPath(); x.arc(S * 0.62, S * 0.42, i * 15, 0, Math.PI * 2); x.fill();
        }
        x.fillStyle = "#7a7a7a";
        x.fillRect(S * 0.08, S * 0.78, S * 0.5, 10);
        x.fillStyle = "#bdbdbd";
        x.fillRect(S * 0.08, S * 0.84, S * 0.32, 6);
      },
    },
    {
      title: "Neon Static", artist: "Arcade Ghosts", album: "Afterglow City", dur: 258000,
      draw(x) {
        x.fillStyle = "#08041a";
        x.fillRect(0, 0, S, S);
        x.fillStyle = lin(x, 0, 0, 0, S * 0.55, [[0, "#06020f"], [1, "#16061f"]]);
        x.fillRect(0, 0, S, S * 0.55);
        // sun
        x.fillStyle = lin(x, 0, S * 0.12, 0, S * 0.55, [[0, "#ff4fd8"], [1, "#ff1f8f"]]);
        x.beginPath(); x.arc(S / 2, S * 0.55, S * 0.32, Math.PI, 0); x.fill();
        x.fillStyle = "#06020f";
        for (let i = 0; i < 5; i++) x.fillRect(S * 0.15, S * 0.36 + i * 11, S * 0.7, 2 + i * 1.2);
        // grid
        x.lineCap = "round";
        x.shadowBlur = 12;
        x.shadowColor = "#00f0ff";
        x.strokeStyle = "#00e5ff";
        x.lineWidth = 3;
        for (let i = -8; i <= 8; i++) {
          x.beginPath(); x.moveTo(S / 2 + i * 8, S * 0.55); x.lineTo(S / 2 + i * 60, S); x.stroke();
        }
        for (let i = 0; i < 7; i++) {
          const y = S * 0.55 + Math.pow(i / 7, 1.8) * S * 0.45;
          x.beginPath(); x.moveTo(0, y); x.lineTo(S, y); x.stroke();
        }
        x.shadowColor = "#b6ff00";
        x.strokeStyle = "#c6ff1a";
        x.lineWidth = 4;
        x.beginPath(); x.moveTo(0, S * 0.555); x.lineTo(S, S * 0.555); x.stroke();
        x.shadowBlur = 0;
      },
    },
  ];

  const fmt = (ms) => {
    const s = Math.max(0, Math.floor((ms || 0) / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };

  // Render each cover once, then analyse it the way theme.js does (64×64 sample).
  COVERS.forEach((cv, i) => {
    const c = document.createElement("canvas");
    c.width = c.height = S;
    cv.draw(c.getContext("2d"), rng(1000 + i * 77));
    cv.src = c.toDataURL("image/png");
    const sample = document.createElement("canvas");
    sample.width = sample.height = 64;
    const sx = sample.getContext("2d", { willReadFrequently: true });
    sx.drawImage(c, 0, 0, 64, 64);
    cv.palette = quantize(sx.getImageData(0, 0, 64, 64).data) || [[182, 156, 255], [124, 92, 255], [230, 222, 255]];
    cv.sample = sample; // also the haze image (pre-shrunk = cheap to blur)
  });

  /* ------------------------------------------------------------ Build the UI */
  const state = { idx: 0, playing: true, pos: 0, scheme: "Mirage", liked: new Set() };

  const strip = $("[data-covers]");
  const library = $("[data-library]");
  const tracks = $("[data-tracks]");
  COVERS.forEach((cv, i) => {
    const label = `Play “${cv.title}” by ${cv.artist}`;

    const b = document.createElement("button");
    b.type = "button";
    b.className = "cover-btn";
    b.dataset.play = i;
    b.setAttribute("aria-label", label);
    b.setAttribute("aria-pressed", "false");
    b.innerHTML = `<img alt="" src="${cv.src}" width="160" height="160"><span>${cv.title}</span><small>${cv.artist}</small>`;
    strip.append(b);

    const li = document.createElement("li");
    li.innerHTML =
      `<button type="button" class="lib-item" data-play="${i}" aria-label="${label}">` +
      `<img alt="" src="${cv.src}" width="44" height="44"><span><span class="t">${cv.album}</span>` +
      `<span class="s">Album · ${cv.artist}</span></span></button>`;
    library.append(li);

    const row = document.createElement("button");
    row.type = "button";
    row.className = "track";
    row.dataset.play = i;
    row.setAttribute("aria-label", `${label}, ${fmt(cv.dur)}`);
    row.innerHTML =
      `<span class="num">${i + 1}</span><span class="eq" aria-hidden="true"><i></i><i></i><i></i></span>` +
      `<span class="title-cell"><img alt="" src="${cv.src}" width="40" height="40">` +
      `<span><span class="tt">${cv.title}</span><span class="ta">${cv.artist}</span></span></span>` +
      `<span class="album">${cv.album}</span><span class="dur">${fmt(cv.dur)}</span>`;
    tracks.append(row);
  });

  const schemeBox = $("[data-schemes]");
  Object.entries(SCHEMES).forEach(([name, s]) => {
    const l = document.createElement("label");
    const dot = name === "Mirage"
      ? "conic-gradient(#ff8fb8, #4fe3ff, #b6ff00, #ff9f45, #b69cff, #ff8fb8)"
      : `linear-gradient(135deg, #${s.c}, #${s.a} 55%, #${s.b})`;
    l.innerHTML =
      `<input type="radio" name="scheme" value="${name}"${name === "Mirage" ? " checked" : ""}>` +
      `<span class="dot" style="background:${dot}" aria-hidden="true"></span>${name}` +
      (name === "Mirage" ? '<span class="sr-only"> (colours live from the cover)</span>' : "");
    schemeBox.append(l);
  });

  /* ------------------------------------------------------------ Colours */
  const swatchBox = $("[data-swatches]");
  const paletteLabel = $("[data-palette-label]");
  function currentAccents() {
    if (state.scheme === "Mirage") return COVERS[state.idx].palette;
    const s = SCHEMES[state.scheme];
    return [hex2rgb(s.a), hex2rgb(s.b), hex2rgb(s.c)];
  }
  function applyColors() {
    const s = SCHEMES[state.scheme];
    const [a, b, c] = currentAccents();
    const st = root.style;
    st.setProperty("--m-a", `rgb(${a.join(",")})`);
    st.setProperty("--m-b", `rgb(${b.join(",")})`);
    st.setProperty("--m-c", `rgb(${c.join(",")})`);
    st.setProperty("--s-main", "#" + s.main);
    st.setProperty("--s-elev", "#" + s.elev);
    st.setProperty("--s-high", "#" + s.high);
    st.setProperty("--s-side", "#" + s.side);
    st.setProperty("--s-text", "#" + s.text);
    st.setProperty("--s-sub", "#" + s.sub);
    $('meta[name="theme-color"]').setAttribute("content", "#" + s.main);
    dust.recolor([a, b, c]);

    paletteLabel.textContent = state.scheme === "Mirage" ? "Extracted from the cover" : `Fixed scheme: ${state.scheme}`;
    swatchBox.innerHTML = [["A", a], ["B", b], ["C", c]]
      .map(([k, col]) => `<span class="swatch"><i style="background:${rgb2hex(col)}"></i>${k} ${rgb2hex(col)}</span>`)
      .join("");
  }

  /* ------------------------------------------------------------ Haze: one blurred layer, cross-faded */
  const haze = $(".stage .haze");
  const hctx = haze.getContext("2d");
  const hazeFrom = document.createElement("canvas");
  hazeFrom.width = hazeFrom.height = haze.width;
  let hazeAnim = 0;
  function showHaze(sample) {
    cancelAnimationFrame(hazeAnim);
    const W = haze.width;
    if (!motionOK || !showHaze.ready) {
      hctx.globalAlpha = 1;
      hctx.drawImage(sample, 0, 0, W, W);
      showHaze.ready = true;
      return;
    }
    const fctx = hazeFrom.getContext("2d");
    fctx.clearRect(0, 0, W, W);
    fctx.drawImage(haze, 0, 0);
    const t0 = performance.now(), D = 1400;
    let lastDraw = 0;
    const step = (now) => {
      const t = Math.min(1, (now - t0) / D);
      if (now - lastDraw > 40 || t === 1) {
        // redraw ~25×/s: every redraw re-blurs the layer, so keep it cheap
        lastDraw = now;
        const e = 1 - Math.pow(1 - t, 3);
        hctx.globalAlpha = 1;
        hctx.drawImage(hazeFrom, 0, 0);
        hctx.globalAlpha = e;
        hctx.drawImage(sample, 0, 0, W, W);
        hctx.globalAlpha = 1;
      }
      if (t < 1) hazeAnim = requestAnimationFrame(step);
    };
    hazeAnim = requestAnimationFrame(step);
  }

  /* ------------------------------------------------------------ Light dust (capped, recoloured per song) */
  const dust = (() => {
    const cv = $(".stage .dust");
    const ctx = cv.getContext("2d");
    let w = 0, h = 0, sprites = [];
    const parts = [];
    const N = () => (innerWidth < 700 ? 24 : 40);
    function sprite(rgb) {
      const s = document.createElement("canvas");
      s.width = s.height = 64;
      const x = s.getContext("2d");
      const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, `rgba(${rgb.join(",")},0.9)`);
      g.addColorStop(0.25, `rgba(${rgb.join(",")},0.35)`);
      g.addColorStop(1, `rgba(${rgb.join(",")},0)`);
      x.fillStyle = g;
      x.fillRect(0, 0, 64, 64);
      return s;
    }
    function recolor(cols) { sprites = [...cols, [255, 255, 255]].map(sprite); }
    function resize() {
      w = cv.width = Math.round(innerWidth * 0.75);
      h = cv.height = Math.round(innerHeight * 0.75);
      const n = N();
      while (parts.length < n) { const p = {}; spawn(p, true); parts.push(p); }
      parts.length = n;
    }
    function spawn(p, anywhere) {
      p.x = Math.random() * w;
      p.y = anywhere ? Math.random() * h : h + 20;
      p.r = 2 + Math.random() * 10;
      p.vy = 0.15 + Math.random() * 0.5;
      p.vx = (Math.random() - 0.5) * 0.25;
      p.ph = Math.random() * Math.PI * 2;
      p.a = 0.25 + Math.random() * 0.6;
      p.k = Math.floor(Math.random() * 4);
    }
    function draw(dt, level, playing) {
      const speed = (playing ? 1 : 0.25) * (1 + level * 2.5);
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      for (const p of parts) {
        p.ph += 0.01 * dt;
        p.y -= p.vy * speed * dt;
        p.x += (p.vx + Math.sin(p.ph) * 0.2) * speed * dt;
        if (p.y < -30) spawn(p, false);
        ctx.globalAlpha = p.a * (0.6 + Math.sin(p.ph * 3) * 0.4);
        const d = p.r * 4 * (1 + level * 0.4);
        ctx.drawImage(sprites[p.k] || sprites[0], p.x - d / 2, p.y - d / 2, d, d);
      }
    }
    function clear() { ctx.clearRect(0, 0, w, h); }
    addEventListener("resize", resize);
    resize();
    return { recolor, draw, clear };
  })();

  /* ------------------------------------------------------------ Playback (simulated) + beat */
  const BPM = 120, BEAT = 60000 / BPM;
  const pulse = $(".stage .pulse");
  const fill = $("[data-fill]");
  const progress = $("[data-progress]");
  const posEl = $("[data-pos]");
  const durEl = $("[data-dur]");
  const announce = $("[data-announce]");
  let lastSec = -1;

  function renderProgress() {
    const cv = COVERS[state.idx];
    fill.style.transform = `scaleX(${Math.min(1, state.pos / cv.dur)})`;
    const sec = Math.floor(state.pos / 1000);
    if (sec !== lastSec) {
      lastSec = sec;
      posEl.textContent = fmt(state.pos);
      progress.setAttribute("aria-valuenow", String(sec));
      progress.setAttribute("aria-valuetext", `${fmt(state.pos)} of ${fmt(cv.dur)}`);
    }
  }

  function play(i, opts = {}) {
    state.idx = (i + COVERS.length) % COVERS.length;
    state.pos = 0;
    lastSec = -1;
    if (opts.autoplay !== false) state.playing = true;
    const cv = COVERS[state.idx];
    $$("[data-cur-img]").forEach((img) => { img.src = cv.src; });
    $("[data-cur-alt]").alt = `Generated cover art for “${cv.title}”`;
    $$("[data-cur-title]").forEach((el) => (el.textContent = cv.title));
    $$("[data-cur-artist]").forEach((el) => (el.textContent = cv.artist));
    $$(".cover-btn").forEach((b, k) => b.setAttribute("aria-pressed", String(k === state.idx)));
    $$(".lib-item, .track").forEach((b) => {
      if (+b.dataset.play === state.idx) b.setAttribute("aria-current", "true");
      else b.removeAttribute("aria-current");
    });
    durEl.textContent = fmt(cv.dur);
    progress.setAttribute("aria-valuemax", String(Math.floor(cv.dur / 1000)));
    $("[data-like]").setAttribute("aria-pressed", String(state.liked.has(state.idx)));
    applyColors();
    showHaze(cv.sample);
    renderProgress();
    syncPlaying();
    if (!opts.silent) announce.textContent = `Now playing ${cv.title} by ${cv.artist}`;
  }

  function syncPlaying() {
    root.classList.toggle("is-playing", state.playing);
    $$("[data-toggle]").forEach((b) => b.setAttribute("aria-label", state.playing ? "Pause" : "Play"));
  }

  // single loop: progress, beat pulse, dust (30 fps for the dust, like the theme)
  let raf = 0, last = 0, lastDust = 0;
  function tick(now) {
    raf = requestAnimationFrame(tick);
    const dt = Math.min(100, now - last);
    last = now;
    if (state.playing) {
      state.pos += dt;
      if (state.pos >= COVERS[state.idx].dur) { play(state.idx + 1, { silent: false }); return; }
    }
    renderProgress();
    if (!motionOK) return;
    const phase = (state.pos % BEAT) / BEAT;
    const level = state.playing ? Math.exp(-phase * 5) : 0;
    pulse.style.opacity = (0.42 + level * 0.4).toFixed(3);
    pulse.style.transform = `scale(${(1 + level * 0.035).toFixed(4)})`;
    if (now - lastDust >= 33) {
      dust.draw(Math.min(3, (now - lastDust) / 16.7), level * 0.6, state.playing);
      lastDust = now;
    }
  }
  function startLoop() {
    cancelAnimationFrame(raf);
    last = lastDust = performance.now();
    raf = requestAnimationFrame(tick);
  }
  function stopLoop() { cancelAnimationFrame(raf); raf = 0; }

  document.addEventListener("visibilitychange", () => {
    root.classList.toggle("tab-hidden", document.hidden);
    if (document.hidden) stopLoop(); else startLoop();
  });
  const onMotion = () => {
    motionOK = !motionQuery.matches;
    if (!motionOK) {
      dust.clear();
      pulse.style.opacity = "";
      pulse.style.transform = "";
    }
  };
  if (motionQuery.addEventListener) motionQuery.addEventListener("change", onMotion);
  else if (motionQuery.addListener) motionQuery.addListener(onMotion);

  /* ------------------------------------------------------------ Events */
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-play],[data-toggle],[data-next],[data-prev],[data-like],[data-copy]");
    if (!t) return;
    if (t.dataset.play !== undefined) {
      const i = +t.dataset.play;
      if (i === state.idx) { state.playing = !state.playing; syncPlaying(); }
      else play(i);
    } else if (t.hasAttribute("data-toggle")) {
      state.playing = !state.playing;
      syncPlaying();
    } else if (t.hasAttribute("data-next")) {
      play(state.idx + 1);
    } else if (t.hasAttribute("data-prev")) {
      if (state.pos > 3000) { state.pos = 0; lastSec = -1; renderProgress(); }
      else play(state.idx - 1);
    } else if (t.hasAttribute("data-like")) {
      const on = !state.liked.has(state.idx);
      on ? state.liked.add(state.idx) : state.liked.delete(state.idx);
      t.setAttribute("aria-pressed", String(on));
      t.setAttribute("aria-label", on ? "Remove from liked songs" : "Like this song");
      t.classList.remove("burst");
      void t.offsetWidth;
      if (on) t.classList.add("burst");
    } else if (t.hasAttribute("data-copy")) {
      const code = document.getElementById(t.dataset.copy).textContent;
      const done = () => { t.textContent = "Copied"; setTimeout(() => (t.textContent = "Copy"), 1600); };
      if (navigator.clipboard) navigator.clipboard.writeText(code).then(done, () => (t.textContent = "Select & copy"));
      else t.textContent = "Select & copy";
    }
  });

  schemeBox.addEventListener("change", (e) => {
    if (e.target.name !== "scheme") return;
    state.scheme = e.target.value;
    applyColors();
  });

  // seek: click / drag on the bar, arrow keys ±5 s, Home/End
  function seekTo(ms) {
    const d = COVERS[state.idx].dur;
    state.pos = Math.max(0, Math.min(d - 1, ms));
    lastSec = -1;
    renderProgress();
  }
  function seekFromPointer(e) {
    const r = progress.getBoundingClientRect();
    seekTo(((e.clientX - r.left) / r.width) * COVERS[state.idx].dur);
  }
  progress.addEventListener("pointerdown", (e) => {
    progress.setPointerCapture(e.pointerId);
    seekFromPointer(e);
    const move = (ev) => seekFromPointer(ev);
    const up = () => { progress.removeEventListener("pointermove", move); progress.removeEventListener("pointerup", up); };
    progress.addEventListener("pointermove", move);
    progress.addEventListener("pointerup", up);
  });
  progress.addEventListener("keydown", (e) => {
    const d = COVERS[state.idx].dur;
    const map = { ArrowRight: 5000, ArrowUp: 5000, ArrowLeft: -5000, ArrowDown: -5000, PageUp: 30000, PageDown: -30000 };
    if (e.key in map) seekTo(state.pos + map[e.key]);
    else if (e.key === "Home") seekTo(0);
    else if (e.key === "End") seekTo(d - 1000);
    else return;
    e.preventDefault();
  });

  /* ------------------------------------------------------------ Go */
  play(0, { silent: true });
  startLoop();
})();
