# Changelog

All notable changes to Mirage are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Release notes on GitHub are generated from the matching section of this file when a `v*` tag is pushed.

## [Unreleased]

<!-- Filled in by the theme author: add Added / Changed / Fixed / Removed entries here before tagging the next release. -->

## [1.4.2] – 2026-10-30

### Fixed

- The visualizer no longer goes blank or freezes on some songs: incomplete Spotify analysis data (missing loudness, pitches or beat confidence) used to spread NaN values and stop Party mode from drawing at all. Bad values are now replaced, and a failed frame resets the visualizer instead of breaking it until reload.
- No more errors while Spotify is minimized (the canvas was 0 px wide).

## [1.4.1] – 2026-10-30

### Changed

- Party mode has its own visualizer: a fine ring of bars in a colour gradient around the cover, a glowing line over the tips instead of the filled wave, and sparks that fly off the cover on the beat (more in drops). Colours are boosted to be vivid; grey covers get Mirage tones. Bass songs add low bars along the bottom edge.

### Fixed

- Mix mode: the progress bar and times are centred under the title on wide windows.
- Overlay app: "Start with Windows" is re-registered at every start, so the entry follows the app after an update, a reinstall or a switch from a development copy.

## [1.4.0] – 2026-10-30

### Added

- Immersive mode "Mix" (key 4): cover, lyrics and visualizer at once. A round cover sits in the visualizer ring with the synced lyrics beside it, and all controls stay. Lyrics and visualizer settings apply here too.
- Immersive mode "Party" (key 5): bigger and on the beat. Each song gets a profile from the artist's genres, or from tempo and loudness when Spotify knows no genre: Rave, Bass, Rock, Pop or Chill. The profile sets the visualizer style, how strongly the cover pulses or shakes, how often rings appear, and soft colour washes per bar. Loud drops push everything further, and very fast songs run in half time. The current lyric line is shown large in the middle, and the kicker shows e.g. "Party · Rave · 128 BPM".
- Party mode shows who is in your Spotify Jam: everyone's profile picture (you too, with an accent ring; the host with a small dot) floats softly at the edges and updates as people join or leave. Can be switched off ("Show Jam guests").
- Settings → Immersive: party style (automatic or fixed), intensity (soft, normal, max) and colour flashes on or off. The flashes are coloured washes, not white strobes, never more than a few per second, and they stay off with the system's "reduce motion" setting.
- Share image "Now playing": with the scannable Spotify Code in a glass capsule under the title. Point the Spotify camera at it to open the song directly.

### Changed

- Keys 1–5 switch the immersive views; the shortcut help and README list the new modes.

## [1.3.1] – 2026-10-30

### Added

- Immersive lyrics: a "Translation" switch next to "Choose version" shows or hides the translation with one click.
- All 14 languages are now complete in the theme and the overlay app. Before, French, Spanish, Italian, Portuguese, Dutch, Polish, Turkish, Russian, Ukrainian, Japanese, Korean and Chinese fell back to English for most newer texts.

### Changed

- The immersive button in the top bar is easier to find: an accent-coloured orb with a soft glow.

### Fixed

- Immersive mode: the Spotify window can be dragged again (also onto another screen) from the strip along the top; double-click maximises it.
- Volume display in the overlay app: Mirage now also reads the volume from Spotify's playback API or the volume slider when `getVolume()` returns nothing, which happens in some Spotify versions.
- The active lyric line no longer gets cut off on the right when it grows.
- Search suggestions under the search field and the small playlist header that appears when scrolling are no longer see-through.
- Smoother immersive mode: the visualizer draws at a capped resolution on large screens, the background crossfades without recomputing its blur, the progress bar and cover pulse no longer trigger layout every frame, and lyrics fade in instead of sliding across on a song change.

## [1.3.0] – 2026-10-30

### Added

- Immersive mode: karaoke word by word. In the current line each word fills up while it is sung. With Spotify's syllable timing it is exact; otherwise Mirage estimates it from the line timing. Switch: "Karaoke word by word".
- Immersive mode: "Choose version" button in the lyrics view. It lists all LRCLIB matches for the song (time-synced first, closest length first), and the choice is remembered per song. "Automatic" goes back to Spotify first. This also works when Spotify has only unsynced lyrics.
- Font choice in the settings (Colours): Outfit, Jakarta, Manrope, Sora, Lexend, Nunito or the system font, for all of Spotify.
- Sleep timer fades out: the volume goes down slowly over the last minutes (last 20 s for "end of song") and comes back after pausing.
- "Your month in colours": a share card for the last 30 days with songs, minutes, active days, cover colours, listening time per day, top artists and top songs.
- Mirage Overlay: volume bar at the bottom of the screen when you change the volume in Spotify.
- Mirage Overlay: quiet while a game, video or presentation runs fullscreen. Windows uses the system's own fullscreen signal; Linux (X11) checks the active window. Not available on macOS.
- Mirage Overlay: your own style. "Open CSS file" creates `custom.css` in the settings folder; it overrides the built-in look and changes show right away.
- Mirage Overlay: streaming mode for OBS. `http://127.0.0.1:47322/` as a browser source shows the same overlay with a transparent background. Only reachable from your own computer.
- Mirage Overlay: updates itself. It checks GitHub at start and every 6 hours and asks before restarting. Windows installs silently, the AppImage replaces itself; on macOS and .deb it opens the download page.

## [1.2.3] – 2026-10-29

### Added

- Lyrics from the web: if Spotify has no lyrics for a song, Mirage looks them up on [LRCLIB](https://lrclib.net), a free lyrics database. Time-synced lyrics are preferred, plain text is the fallback, and local files get lyrics too. Only the title, artist, album and length are sent. It is on by default and can be turned off with "Search lyrics online" in the immersive settings. The overlay's lyrics style benefits as well.
- Immersive mode: a proper view when there are no lyrics, in the colours of the cover, with buttons to show the visualizer or search the web. Instrumental tracks get their own calm variant.

### Fixed

- Immersive mode: the translation could show up twice under a line when the view and the song changed at the same moment.

## [1.2.2] – 2026-10-29

### Fixed

- Mirage Overlay: the shadow was cut off at the window edge depending on the position (worst at the bottom positions, up to 78 px). The overlay window now keeps a shadow margin on every side that grows with the size, while the card stays exactly where it was. Checked for all 6 styles × 9 positions × 2 sizes.

## [1.2.1] – 2026-10-29

### Removed

- The Mirage App (dashboard page in Spotify's sidebar) and its Marketplace listing – the theme settings and the Overlay cover everything it showed.

## [1.2.0] – 2026-10-29

### Added

- **Mirage Overlay installers** for every system, built automatically for each release: `Mirage-Overlay-Setup.exe` (Windows, one click), `Mirage-Overlay.dmg` (macOS, universal), `Mirage-Overlay.AppImage` and `.deb` (Linux) – no git or Node.js needed any more.
- Mirage settings → Overlay: shows whether the overlay is connected and downloads the right installer for your system.
- App icon for the overlay.

### Fixed

- Linux AppImage: "start with the computer" now points at the AppImage file instead of its temporary mount.

## [1.1.1] – 2026-10-29

### Fixed

- Mirage App did not open: a helper named `t` clashed with the parameters Spicetify wraps custom-app code in (`e, t, n`), so the page failed to load and the top-bar button led nowhere.

## [1.1.0] – 2026-10-29

### Added

- **Mirage App** – a custom app (page in Spotify's sidebar), listed in Marketplace → Apps: colour schemes in one click, "your week in colours" with share button, quick actions (immersive mode, settings, share now playing), Mirage Overlay status with install guide, the repair after Spotify updates and a diagnostics button for bug reports.
- `window.Mirage` – a small interface the theme offers to the app (schemes, week, overlay status, actions).
- The Windows installer now sets up the app too (`-NoApp` to skip it).

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

[Unreleased]: https://github.com/Passimoritz/spicetify-mirage/compare/v1.2.2...HEAD
[1.2.2]: https://github.com/Passimoritz/spicetify-mirage/compare/v1.2.1...v1.2.2
[1.2.1]: https://github.com/Passimoritz/spicetify-mirage/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/Passimoritz/spicetify-mirage/compare/v1.1.1...v1.2.0
[1.1.1]: https://github.com/Passimoritz/spicetify-mirage/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/Passimoritz/spicetify-mirage/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/Passimoritz/spicetify-mirage/releases/tag/v1.0.0
