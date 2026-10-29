<p align="center">
  <img src="https://raw.githubusercontent.com/Passimoritz/spicetify-mirage/main/assets/app-preview.png" alt="Mirage App – a page in Spotify's sidebar" width="100%">
</p>

# Mirage App

A page in Spotify's sidebar for the [Mirage theme](https://github.com/Passimoritz/spicetify-mirage):

- **Colour schemes in one click** – Mirage (live from the cover), Obsidian, Sakura, Abyss, Ember, Pearl and your own
- **Your week in colours** – songs, minutes, the colours of your covers and your most played artists, shareable as an image
- **Right now** – immersive mode, Mirage settings, share what's playing
- **Mirage Overlay** – shows whether the desktop overlay is running, with the install guide
- **After a Spotify update** – the one-click repair `fix-spicetify.cmd` and the guide for macOS / Linux

Works best together with the Mirage theme. Without it, the page shows how to install the theme.

## Install

> The Spicetify Marketplace lists custom apps but cannot install them by itself – it takes one of the two ways below.

### Windows – one command

The installer sets up the theme **and** the app:

```powershell
git clone https://github.com/Passimoritz/spicetify-mirage
cd spicetify-mirage
powershell -ExecutionPolicy Bypass -File install.ps1
```

### By hand (Windows, macOS, Linux)

1. Download this repository ([ZIP](https://github.com/Passimoritz/spicetify-mirage/archive/refs/heads/main.zip)) and copy the folder **`MirageApp`** into Spicetify's `CustomApps` folder, renamed to **`mirage`**:
   - Windows: `%appdata%\spicetify\CustomApps\mirage`
   - macOS / Linux: `~/.config/spicetify/CustomApps/mirage`
2. Run:

```bash
spicetify config custom_apps mirage
spicetify apply
```

**Mirage** now appears in Spotify's sidebar.

### Update

Run the installer again, or copy the new `MirageApp` folder over the old one and run `spicetify apply`.

### Uninstall

```bash
spicetify config custom_apps mirage-
spicetify apply
```
