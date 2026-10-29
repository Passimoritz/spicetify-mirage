# Changelog

All notable changes to Mirage are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Release notes on GitHub are generated from the matching section of this file when a `v*` tag is pushed.

## [Unreleased]

<!-- Filled in by the theme author: add Added / Changed / Fixed / Removed entries here before tagging the next release. -->

## [1.0.0] – 2026-10-29

First public release.

### Added

- **Colours from the cover** – accent, buttons, progress bar, titles and selection take on the palette of the current album art, tuned so text stays readable on dark glass.
- **Living background** – the album art drifts behind the UI as a slow, blurred haze with aurora bands, floating light dust and film grain.
- **Beat pulse** – with Spotify's beat data the background, light dust and visualizer pulse in time; without it Mirage falls back to calm ambient motion.
- **3D cards** – cards tilt towards the pointer, with a light cone and glowing edge that follow the mouse.
- **Page animations** – pages blur in, grids cascade, track rows glide in one after another; the playing row glows in a flowing colour stream.
- **Vinyl & details** – the player cover turns into a spinning record, the play button gets a rotating halo, liking a song sets off a heart burst.
- **Immersive mode** (<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>M</kbd>) with three morphing views:
  - **Cover** – huge tilting cover, gradient title, progress and full controls.
  - **Lyrics** – Spotify's synced lyrics with the current line lit and centred; click a line to jump there.
  - **Visualizer** – radial spectrum around the round cover with beat rings, configurable style, bar count, height, softness, glow, rings, mirroring and rotation.
  - Shuffle, previous, play/pause, next, repeat (incl. repeat one), like, volume + mute, full screen and keyboard shortcuts.
- **Mirage Overlay** – Electron companion app (Windows) that shows song changes above every window: Island, Card, Banner and Minimal styles, screen and anchor choice, quiet hours, playback controls on hover, tray icon and autostart. Talks to the theme locally via `127.0.0.1:47321`.
- **5 colour schemes** – `Mirage` (follows the cover live) plus the fixed palettes `Obsidian`, `Sakura`, `Abyss` and `Ember`, switchable live.
- **14 languages** – English, German, French, Spanish, Italian, Portuguese, Dutch, Polish, Turkish, Russian, Ukrainian, Japanese, Korean and Chinese, with English as fallback; controls are found by language-independent markers.
- **Mirage settings** in the profile menu – toggles for every effect, real glass, calm mode, blur and brightness.
- **Diagnostics channel** – with the overlay running, the theme can write a layout report (sizes, classes, colours – no content) to help fix styling bugs after Spotify updates.
- **Accessibility** – respects *reduce motion*, visible focus rings, readable contrast on every palette.
- Windows installer script (`install.ps1`, optional `-Overlay` and `-Scheme`) and Spicetify Marketplace manifest.
- **Performance presets** – Full, Balanced, Light and Calm in one click; Mirage measures the frame rate at start and steps down one level on slow PCs; effects pause while Spotify is minimised or covered; calm mode follows the system *reduce motion* setting.
- **Much lighter on CPU and GPU** – the whole ambient background (cover light, aurora, pulse, light dust, vignette) is drawn into one quarter-resolution canvas instead of seven full-window blended layers; it runs at 20 fps (Full 30, Light 12) and only while music plays; the beat pulse reads Spotify's beat data per frame instead of running its own loop; looping decorations pause when nothing plays or the window is covered; colour and contrast watchers only check new elements. Measured on Windows with Spotify visible and playing: 16.8 % → 2.7 % CPU and 28 % → 0.8 % GPU; idle with music paused: 12.5 % → 0.1 % CPU.
- **Readability guard** – native drop-down lists, autofill and placeholders follow the theme (`color-scheme`), and a contrast watchdog fixes text that falls below 3 : 1 in menus, dialogs and settings – also on future Spotify pages.
- **Contrast-checked colours** – accent colours are lifted until they reach 4.5 : 1 on the background; almost colourless covers fall back to the scheme.
- **Pearl** – a light colour scheme, plus a **scheme builder** (four colours → full scheme) with share codes.
- **Per-album and per-playlist colours** – remember an album's colours, freeze the current colours, or give a playlist its own scheme.
- **Immersive mode** – Smart Shuffle, up next (Q), Spotify Connect devices, sleep timer, title/artist links, lyrics size and spacing, optional lyrics translation, Canvas videos where available, three new visualizer styles (particles, line, bottom bars), shortcut overview (?), share button.
- **Share cards** – "Now playing" and "Your week in colours" as 1080 × 1350 images (copied and saved).
- **Overlay** – macOS and Linux support, new *Lyrics* and *Visualizer* styles fed live by the theme.
- **Settings** – presets on top, grouped sections, ⚡ marks costly effects, export/import, reset, copy diagnostics for bug reports, first-start hint.
- **Robust against Spotify updates** – all Spotify selectors in one place, health check with safe mode, `tools/fix-spicetify.cmd` to repair Spicetify after a Spotify update.
- **Web demo** on GitHub Pages and source split into modules under `src/` (bundled with esbuild), CI with ESLint and Stylelint.

[Unreleased]: https://github.com/Passimoritz/spicetify-mirage/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/Passimoritz/spicetify-mirage/releases/tag/v1.0.0
