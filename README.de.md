<p align="center">
  <img src="assets/hero.svg" alt="Mirage – ein lebendiges Spicetify-Theme" width="100%">
</p>

<p align="center">
  <img alt="Spicetify" src="https://img.shields.io/badge/Spicetify-2.40%2B-b69cff?style=for-the-badge&labelColor=12101c">
  <img alt="Sprachen" src="https://img.shields.io/badge/Sprachen-14-7c5cff?style=for-the-badge&labelColor=12101c">
  <img alt="Overlay" src="https://img.shields.io/badge/Overlay-Windows-4fe3ff?style=for-the-badge&labelColor=12101c">
  <img alt="Lizenz" src="https://img.shields.io/badge/Lizenz-MIT-e6deff?style=for-the-badge&labelColor=12101c">
</p>

<p align="center">
  <a href="README.md">English</a> · <b>Deutsch</b>
  <br><br>
  <a href="#-highlights">Highlights</a> ·
  <a href="#-immersiv-modus">Immersiv-Modus</a> ·
  <a href="#-mirage-overlay">Overlay</a> ·
  <a href="#-farbschemata">Farbschemata</a> ·
  <a href="#-installation">Installation</a> ·
  <a href="#-einstellungen--tasten">Tasten</a>
</p>

---

**Mirage** macht aus Spotify mattes Glas, hinter dem die Musik lebt. Jeder Song färbt die Oberfläche in den Farben seines Covers, das Cover treibt als weiches Licht langsam hinter den Flächen, und wenn Spotify Taktdaten liefert, atmet der ganze Hintergrund im Beat.

## ✦ Highlights

<table>
  <tr>
    <td width="33%" valign="top">
      <h3>🎨 Farben aus dem Cover</h3>
      Akzent, Knöpfe, Fortschritt, Titel und Auswahl nehmen die Palette des Songs an – so gewählt, dass Text auf dunklem Glas lesbar bleibt.
    </td>
    <td width="33%" valign="top">
      <h3>🌫️ Lebendiger Hintergrund</h3>
      Das Cover treibt als langsamer, weicher Nebel hinter der Oberfläche, darüber Aurora-Bänder, schwebender Lichtstaub und Filmkorn.
    </td>
    <td width="33%" valign="top">
      <h3>🥁 Im Takt</h3>
      Mit Spotifys Taktdaten pulsieren Hintergrund, Lichtstaub und Visualizer im Beat. Ohne sie bewegt sich Mirage ruhig und gleichmäßig.
    </td>
  </tr>
  <tr>
    <td valign="top">
      <h3>🃏 3D-Karten</h3>
      Karten neigen sich zum Mauszeiger, ein Lichtkegel und ein leuchtender Rand folgen der Maus.
    </td>
    <td valign="top">
      <h3>✨ Seiten-Animationen</h3>
      Seiten blenden weich ein, Raster fallen kaskadenartig herein, Titelzeilen gleiten nacheinander herein. Der laufende Song leuchtet im Farbstrom.
    </td>
    <td valign="top">
      <h3>💿 Vinyl & Details</h3>
      Das Cover im Player wird zur drehenden Platte, der Play-Knopf bekommt einen kreisenden Lichtring, beim Liken gibt es eine Herz-Explosion.
    </td>
  </tr>
</table>

## ◐ Immersiv-Modus

<kbd>Strg</kbd> + <kbd>Umschalt</kbd> + <kbd>M</kbd> oder der Kreis-Knopf oben. Drei Ansichten, die ineinander übergehen:

<p align="center"><img src="assets/immersive.svg" alt="Immersiv-Modus: Cover, Liedtext, Visualizer" width="100%"></p>

| Ansicht | Was du bekommst |
|---|---|
| **Cover** | Riesiges Cover, das sich mit der Maus neigt, Titel im Farbverlauf, Fortschritt, volle Steuerung |
| **Liedtext** | Spotifys synchronisierter Liedtext, die aktuelle Zeile leuchtet in der Mitte – Klick auf eine Zeile springt dorthin |
| **Visualizer** | Kreisförmiges Spektrum um das runde Cover, Ringe auf jedem Schlag – mit Spotifys Audioanalyse, sonst ruhige Bewegung |

Steuerung: Zufall, Zurück, Wiedergabe/Pause, Weiter, Wiederholen (auch einen Song), Liken, Lautstärke + Stumm, Vollbild.

## ◎ Mirage Overlay

Eine kleine Begleit-App, die Songwechsel **außerhalb von Spotify** anzeigt – über allen Fenstern, auf dem Bildschirm deiner Wahl. Das Theme spricht lokal mit ihr (`127.0.0.1:47321`), nichts verlässt deinen Rechner.

<p align="center"><img src="assets/overlay.svg" alt="Overlay-Stile: Insel, Karte, Banner, Minimal" width="100%"></p>

- **Wann:** bei jedem Songwechsel, dauerhaft als Mini-Player oder aus · auf Wunsch auch bei Wiedergabe/Pause · Ruhezeiten (z. B. 22:00–07:00)
- **Wo:** Hauptbildschirm, der Bildschirm mit der Maus oder jeder Bildschirm direkt auf einer Karte deiner Monitore · 9 Positionen · Feinabstand
- **Wie:** Insel, Karte, Banner oder Minimal · federnd, gleitend oder überblendend · Hintergrund aus dem Cover / dunkel / hell · Leuchten, Rundung, Größe, Deckkraft · Überschrift, Album, Zeit, Fortschrittsbalken
- **Steuerung beim Überfahren:** Zurück · Wiedergabe/Pause · Weiter direkt im Overlay
- Läuft im Infobereich, startet auf Wunsch mit Windows und spricht die Sprache, die Spotify nutzt

## ◑ Farbschemata

<p align="center"><img src="assets/schemes.svg" alt="Farbschemata" width="100%"></p>

`Mirage` folgt live dem Cover. Die anderen vier sind feste Paletten für einen ruhigeren Look.

## ⬇ Installation

### Spicetify Marketplace

**Marketplace → Themes** öffnen, nach **Mirage** suchen, installieren. Fertig.

> Der Marketplace zeigt nur **öffentliche** Repos mit dem Thema `spicetify-themes`.

### Von Hand (Windows)

```powershell
git clone https://github.com/Passimoritz/spicetify-mirage
cd spicetify-mirage
powershell -ExecutionPolicy Bypass -File install.ps1            # nur Theme
powershell -ExecutionPolicy Bypass -File install.ps1 -Overlay   # Theme + Overlay-App
```

Farbschema wählen mit `-Scheme Obsidian` (oder `Sakura`, `Abyss`, `Ember`).

### Deinstallieren

```bash
spicetify config current_theme marketplace
spicetify apply
```

## ⌨ Einstellungen & Tasten

Profilmenü → **Mirage-Einstellungen**: Farben aus dem Cover, Lichtstaub, Hintergrund im Takt, Seiten-Animationen, Vinyl, 3D-Karten, Herz-Explosion, Overlay-Verbindung, Filmkorn, echtes Glas, ruhiger Modus, Unschärfe und Helligkeit.

| Wo | Taste | Aktion |
|---|---|---|
| überall | <kbd>Strg</kbd>+<kbd>Umschalt</kbd>+<kbd>M</kbd> | Immersiv-Modus öffnen / schließen |
| immersiv | <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> | Cover · Liedtext · Visualizer |
| immersiv | <kbd>Leertaste</kbd> | Wiedergabe / Pause |
| immersiv | <kbd>←</kbd> <kbd>→</kbd> | 5 s spulen |
| immersiv | <kbd>↑</kbd> <kbd>↓</kbd> | Lautstärke |
| immersiv | <kbd>L</kbd> <kbd>S</kbd> <kbd>R</kbd> <kbd>F</kbd> | Liken · Zufall · Wiederholen · Vollbild |
| immersiv | <kbd>N</kbd> <kbd>P</kbd> | Weiter · Zurück |
| immersiv | <kbd>Esc</kbd> | Vollbild verlassen / schließen |

## 🌍 Sprachen

English, Deutsch, Français, Español, Italiano, Português, Nederlands, Polski, Türkçe, Русский, Українська, 日本語, 한국어 und 中文 – jede andere Sprache fällt auf Englisch zurück. Mirage findet Spotifys Bedienelemente über sprachunabhängige Merkmale und funktioniert deshalb in jeder Spotify-Sprache.

## ⚙ So funktioniert es

```mermaid
flowchart LR
  A[Albumcover] -->|64×64 abtasten| B(theme.js)
  B -->|Palette| C[CSS-Variablen<br/>--m-a / --m-b / --m-c]
  B -->|kleines Nebelbild| D[Hintergrund-Ebenen]
  E[Spotify-Taktdaten] --> B
  F[Spotify-Liedtext] --> G[Immersiv-Modus]
  B --> G
  B <-->|WebSocket 127.0.0.1:47321| H[Mirage Overlay]
```

- **Leistung zuerst:** Farben wechseln in einem einzigen Schritt, der Hintergrund ist ein verkleinertes Bild, das einmal verwischt und nur noch gedreht wird, und er pausiert, solange der Immersiv-Modus ihn verdeckt. Echtes Glas (Live-Unschärfe hinter jeder Fläche) ist optional.
- **Datenschutz:** kein eigener Server, kein Tracking. Liedtext und Taktdaten kommen von Spotify selbst, Schriften von Google Fonts.
- **Barrierefreiheit:** beachtet „Bewegung reduzieren“, sichtbare Fokusrahmen, lesbarer Kontrast in jeder Palette.

## Lizenz

MIT © Passimoritz
