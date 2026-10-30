import { S, loadImage } from "./core.js";
import { t } from "./i18n.js";
import { cfg } from "./config.js";
import { palette, rgb2hsl, hsl2rgb } from "./color.js";
import { currentItem, covers, titleOf, artistOf } from "./player.js";

/* ---------------------------------------------------------------- Teilbare Karten */
// Bilder im Hochformat 1080 × 1350 (passt für Instagram, Discord, X) im Mirage-Look.
const W = 1080, H = 1350;
const css = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const FONT = '"Outfit", "Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif';

function canvas() {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  return [c, c.getContext("2d")];
}
// Hintergrund: tiefes Dunkel, darüber weiche Lichtflecken in den Songfarben
function backdrop(x, pal, img) {
  x.fillStyle = "#07060c";
  x.fillRect(0, 0, W, H);
  if (img) {
    x.save();
    x.filter = "blur(70px) saturate(1.7) brightness(0.55)";
    x.drawImage(img, -200, -200, W + 400, H + 400);
    x.restore();
  }
  for (const [cx, cy, r, c, a] of [[200, 160, 620, pal[0], 0.45], [960, 420, 520, pal[1], 0.4], [520, 1260, 680, pal[2], 0.25]]) {
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, css(c, a));
    g.addColorStop(1, css(c, 0));
    x.fillStyle = g;
    x.fillRect(0, 0, W, H);
  }
}
function rounded(x, X, Y, w, h, r) {
  x.beginPath();
  x.roundRect ? x.roundRect(X, Y, w, h, r) : x.rect(X, Y, w, h);
}
// Text auf eine Breite kürzen (mit …)
function fit(x, text, max) {
  if (x.measureText(text).width <= max) return text;
  while (text.length > 1 && x.measureText(text + "…").width > max) text = text.slice(0, -1);
  return text + "…";
}
function watermark(x) {
  x.font = `600 30px ${FONT}`;
  x.fillStyle = "rgba(255,255,255,0.55)";
  x.textAlign = "center";
  x.fillText("Mirage · for Spotify", W / 2, H - 56);
}

// Bild in die Zwischenablage UND als Datei – was davon klappt, hängt vom System ab
async function deliver(c, name) {
  const blob = await new Promise((r) => c.toBlob(r, "image/png"));
  if (!blob) return;
  let copied = false;
  try {
    await navigator.clipboard.write([new window.ClipboardItem({ "image/png": blob })]);
    copied = true;
  } catch {}
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 2000);
  try {
    S.showNotification?.(t(copied ? "shareCopied" : "shareSaved"), false, 4000);
  } catch {}
}

async function nowPlayingCard() {
  const item = currentItem();
  if (!item) return;
  const c = covers(item);
  const img = await loadImage(c.big || c.small, true);
  const pal = palette();
  const [cv, x] = canvas();
  backdrop(x, pal, img);
  const size = 760, X = (W - size) / 2, Y = 150;
  x.save();
  x.shadowColor = css(pal[1], 0.55);
  x.shadowBlur = 90;
  x.shadowOffsetY = 30;
  rounded(x, X, Y, size, size, 36);
  x.fillStyle = "#000";
  x.fill();
  x.restore();
  if (img) {
    x.save();
    rounded(x, X, Y, size, size, 36);
    x.clip();
    x.drawImage(img, X, Y, size, size);
    x.restore();
  }
  x.textAlign = "center";
  x.fillStyle = css(pal[2]);
  x.font = `600 28px ${FONT}`;
  x.fillText(t("now").toUpperCase(), W / 2, Y + size + 90);
  x.fillStyle = "#fff";
  x.font = `800 64px ${FONT}`;
  x.fillText(fit(x, titleOf(item), W - 140), W / 2, Y + size + 170);
  x.fillStyle = "rgba(255,255,255,0.72)";
  x.font = `500 38px ${FONT}`;
  x.fillText(fit(x, artistOf(item), W - 160), W / 2, Y + size + 230);
  // Farbleiste: die drei Leitfarben des Songs
  const bar = x.createLinearGradient(240, 0, W - 240, 0);
  pal.forEach((p, i) => bar.addColorStop(i / 2, css(p)));
  rounded(x, 240, Y + size + 270, W - 480, 10, 5);
  x.fillStyle = bar;
  x.fill();
  watermark(x);
  deliver(cv, "mirage-now-playing.png");
}

/* ---------------------------------------------------------------- Woche in Farben */
// Pro Tag: Anzahl Songs, Minuten, Künstler und die Farbtöne der Cover (12 Töpfe).
// Bleibt lokal in Spotify (localStorage), wird nirgendwohin gesendet.
const STATS = "mirage:stats";
const today = () => new Date().toISOString().slice(0, 10);
function loadStats() {
  try {
    return JSON.parse(localStorage.getItem(STATS) || "{}");
  } catch {
    return {};
  }
}
let lastRecorded = "";
function record(item, colors) {
  if (!item?.uri || item.uri === lastRecorded || !item.uri.startsWith("spotify:track:")) return;
  lastRecorded = item.uri;
  const all = loadStats();
  const d = (all[today()] ||= { n: 0, ms: 0, artists: {}, hues: Array(12).fill(0), schemes: {} });
  d.n++;
  d.ms += Number(item.duration?.milliseconds || item.metadata?.duration || S.Player.getDuration?.() || 0);
  const artist = (artistOf(item) || "").split(",")[0].trim();
  if (artist) d.artists[artist] = (d.artists[artist] || 0) + 1;
  // für die Monatskarte: Top-Songs (ältere Tage haben das Feld noch nicht)
  const song = titleOf(item) + (artist ? " · " + artist : "");
  if (titleOf(item)) (d.tracks ||= {})[song] = (d.tracks[song] || 0) + 1;
  if (colors?.[0]) d.hues[Math.floor(rgb2hsl(colors[0])[0] / 30) % 12]++;
  d.schemes[cfg.scheme] = (d.schemes[cfg.scheme] || 0) + 1;
  // nur die letzten 35 Tage behalten
  for (const k of Object.keys(all).sort().slice(0, -35)) delete all[k];
  try {
    localStorage.setItem(STATS, JSON.stringify(all));
  } catch {}
}
// die letzten `days` Tage zusammengezählt; `daily` = Minuten je Tag, ältester zuerst
function period(days) {
  const all = loadStats();
  const from = new Date(Date.now() - (days - 1) * 864e5).toISOString().slice(0, 10);
  const sum = { n: 0, ms: 0, artists: {}, tracks: {}, hues: Array(12).fill(0), schemes: {}, active: 0, daily: [] };
  for (let i = days - 1; i >= 0; i--) sum.daily.push((all[new Date(Date.now() - i * 864e5).toISOString().slice(0, 10)]?.ms || 0) / 60000);
  for (const [day, d] of Object.entries(all)) {
    if (day < from) continue;
    sum.n += d.n;
    sum.ms += d.ms;
    if (d.n) sum.active++;
    for (const [s, v] of Object.entries(d.tracks || {})) sum.tracks[s] = (sum.tracks[s] || 0) + v;
    for (const [a, v] of Object.entries(d.artists)) sum.artists[a] = (sum.artists[a] || 0) + v;
    d.hues.forEach((v, i) => (sum.hues[i] += v));
    for (const [s, v] of Object.entries(d.schemes || {})) sum.schemes[s] = (sum.schemes[s] || 0) + v;
  }
  return sum;
}
const week = () => period(7);

async function weekCard() {
  const w = week();
  const hueRank = w.hues.map((v, i) => [v, i]).filter(([v]) => v > 0).sort((a, b) => b[0] - a[0]);
  const pal = hueRank.length
    ? hueRank.slice(0, 3).map(([, i]) => hsl2rgb([i * 30 + 15, 0.75, 0.62]))
    : palette();
  while (pal.length < 3) pal.push(pal[0]);
  const [cv, x] = canvas();
  backdrop(x, pal, null);
  x.textAlign = "left";
  x.fillStyle = css(pal[0]);
  x.font = `600 30px ${FONT}`;
  x.fillText(t("weekKicker").toUpperCase(), 90, 170);
  x.fillStyle = "#fff";
  x.font = `800 92px ${FONT}`;
  x.fillText(t("weekTitle"), 84, 280);
  // große Zahlen
  const big = [[String(w.n), t("weekSongs")], [String(Math.round(w.ms / 60000)), t("weekMinutes")]];
  big.forEach(([v, label], i) => {
    const X = 90 + i * 470;
    x.fillStyle = "#fff";
    x.font = `800 120px ${FONT}`;
    x.fillText(v, X, 470);
    x.fillStyle = "rgba(255,255,255,0.65)";
    x.font = `500 34px ${FONT}`;
    x.fillText(label, X, 520);
  });
  // Farbspektrum der Woche: Breite je Farbton = Anteil
  const total = hueRank.reduce((s, [v]) => s + v, 0) || 1;
  let X = 90;
  x.fillStyle = "rgba(255,255,255,0.65)";
  x.font = `500 32px ${FONT}`;
  x.fillText(t("weekColours"), 90, 640);
  for (const [v, i] of hueRank) {
    const wdt = ((W - 180) * v) / total;
    x.fillStyle = css(hsl2rgb([i * 30 + 15, 0.75, 0.62]));
    rounded(x, X, 670, Math.max(wdt - 6, 6), 90, 18);
    x.fill();
    X += wdt;
  }
  if (!hueRank.length) {
    x.fillStyle = "rgba(255,255,255,0.12)";
    rounded(x, 90, 670, W - 180, 90, 18);
    x.fill();
  }
  // Top-Künstler
  x.fillStyle = "rgba(255,255,255,0.65)";
  x.font = `500 32px ${FONT}`;
  x.fillText(t("weekArtists"), 90, 860);
  const top = Object.entries(w.artists).sort((a, b) => b[1] - a[1]).slice(0, 3);
  top.forEach(([name, n], i) => {
    x.fillStyle = css(pal[i % 3]);
    x.font = `800 44px ${FONT}`;
    x.fillText(String(i + 1), 90, 940 + i * 90);
    x.fillStyle = "#fff";
    x.font = `700 48px ${FONT}`;
    x.fillText(fit(x, name, W - 360), 150, 940 + i * 90);
    x.fillStyle = "rgba(255,255,255,0.6)";
    x.font = `500 34px ${FONT}`;
    x.textAlign = "right";
    x.fillText(`${n}×`, W - 90, 940 + i * 90);
    x.textAlign = "left";
  });
  if (!top.length) {
    x.fillStyle = "rgba(255,255,255,0.6)";
    x.font = `500 38px ${FONT}`;
    x.fillText(t("weekEmpty"), 90, 940);
  }
  const fav = Object.entries(w.schemes).sort((a, b) => b[1] - a[1])[0]?.[0];
  if (fav) {
    x.fillStyle = "rgba(255,255,255,0.6)";
    x.font = `500 32px ${FONT}`;
    x.fillText(t("weekScheme").replace("{s}", fav), 90, 1220);
  }
  watermark(x);
  deliver(cv, "mirage-week.png");
}

/* ---------------------------------------------------------------- Monat in Farben */
// Wie die Wochenkarte, für 30 Tage: Hörzeit pro Tag als Balken, Top-Künstler und Top-Songs nebeneinander
async function monthCard() {
  const m = period(30);
  const hueRank = m.hues.map((v, i) => [v, i]).filter(([v]) => v > 0).sort((a, b) => b[0] - a[0]);
  const pal = hueRank.length ? hueRank.slice(0, 3).map(([, i]) => hsl2rgb([i * 30 + 15, 0.75, 0.62])) : palette();
  while (pal.length < 3) pal.push(pal[0]);
  const [cv, x] = canvas();
  backdrop(x, pal, null);
  x.textAlign = "left";
  x.fillStyle = css(pal[0]);
  x.font = `600 30px ${FONT}`;
  x.fillText(t("monthKicker").toUpperCase(), 90, 160);
  x.fillStyle = "#fff";
  x.font = `800 88px ${FONT}`;
  x.fillText(t("monthTitle"), 84, 262);
  const big = [[String(m.n), t("weekSongs")], [String(Math.round(m.ms / 60000)), t("weekMinutes")], [String(m.active), t("monthDays")]];
  big.forEach(([v, label], i) => {
    const X = 90 + i * 310;
    x.fillStyle = "#fff";
    x.font = `800 100px ${FONT}`;
    x.fillText(v, X, 420);
    x.fillStyle = "rgba(255,255,255,0.65)";
    x.font = `500 32px ${FONT}`;
    x.fillText(label, X, 466);
  });
  // Farbspektrum
  x.fillStyle = "rgba(255,255,255,0.65)";
  x.font = `500 30px ${FONT}`;
  x.fillText(t("weekColours"), 90, 562);
  const total = hueRank.reduce((s, [v]) => s + v, 0) || 1;
  let X = 90;
  for (const [v, i] of hueRank) {
    const wdt = ((W - 180) * v) / total;
    x.fillStyle = css(hsl2rgb([i * 30 + 15, 0.75, 0.62]));
    rounded(x, X, 586, Math.max(wdt - 6, 6), 70, 16);
    x.fill();
    X += wdt;
  }
  if (!hueRank.length) {
    x.fillStyle = "rgba(255,255,255,0.12)";
    rounded(x, 90, 586, W - 180, 70, 16);
    x.fill();
  }
  // Hörzeit pro Tag
  x.fillStyle = "rgba(255,255,255,0.65)";
  x.fillText(t("monthDaily"), 90, 742);
  const peak = Math.max(...m.daily, 1), bw = (W - 180) / m.daily.length;
  m.daily.forEach((v, i) => {
    const h = v ? Math.max(8, (v / peak) * 130) : 4;
    x.fillStyle = v ? css(pal[i % 3 === 2 ? 1 : 0], 0.9) : "rgba(255,255,255,0.14)";
    rounded(x, 90 + i * bw + 2, 900 - h, bw - 4, h, 5);
    x.fill();
  });
  // Top-Künstler | Top-Songs
  const cols = [[t("weekArtists"), Object.entries(m.artists)], [t("monthSongs"), Object.entries(m.tracks)]];
  cols.forEach(([label, list], c) => {
    const CX = 90 + c * 470;
    x.fillStyle = "rgba(255,255,255,0.65)";
    x.font = `500 30px ${FONT}`;
    x.fillText(label, CX, 990);
    const top = list.sort((a, b) => b[1] - a[1]).slice(0, 3);
    top.forEach(([name, n], i) => {
      const Y = 1060 + i * 72;
      x.fillStyle = css(pal[i % 3]);
      x.font = `800 38px ${FONT}`;
      x.fillText(String(i + 1), CX, Y);
      x.fillStyle = "#fff";
      x.font = `700 38px ${FONT}`;
      x.fillText(fit(x, name.split(" · ")[0], 290), CX + 46, Y);
      x.fillStyle = "rgba(255,255,255,0.55)";
      x.font = `500 26px ${FONT}`;
      x.textAlign = "right";
      x.fillText(`${n}×`, CX + 420, Y);
      x.textAlign = "left";
    });
    if (!top.length) {
      x.fillStyle = "rgba(255,255,255,0.6)";
      x.font = `500 32px ${FONT}`;
      x.fillText(t("weekEmpty").split(" – ")[0], CX, 1060);
    }
  });
  watermark(x);
  deliver(cv, "mirage-month.png");
}

export { nowPlayingCard, weekCard, monthCard, record, week, period };
