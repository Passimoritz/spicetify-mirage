// Rendert assets/hero.svg zu assets/preview.png (Vorschaubild für den Spicetify Marketplace).
// Aufruf:  overlay\node_modules\.bin\electron tools/render-preview.js
const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");

const svg = path.join(__dirname, "..", "assets", "hero.svg");
const out = path.join(__dirname, "..", "assets", "preview.png");

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1280, height: 440, show: false, frame: false, useContentSize: true });
  await win.loadFile(svg);
  await new Promise((r) => setTimeout(r, 2500)); // Animationen kurz laufen lassen
  const img = await win.webContents.capturePage();
  fs.writeFileSync(out, img.toPNG());
  console.log("geschrieben:", out, img.getSize());
  app.quit();
});
