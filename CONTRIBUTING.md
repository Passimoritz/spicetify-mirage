# Contributing to Mirage

Thanks for wanting to make Mirage better! Bug reports, colour schemes, translations and code are all welcome.
Questions and loose ideas are best started in [Discussions](https://github.com/Passimoritz/spicetify-mirage/discussions).

## 🛠 Setup

You need [Spicetify](https://spicetify.app) 2.40+ and Node.js 20.19 or newer.

```bash
git clone https://github.com/Passimoritz/spicetify-mirage
cd spicetify-mirage
npm install
```

Point Spicetify at your checkout instead of a copy, so every build is picked up directly:

```bash
# Windows (PowerShell, as admin or with developer mode):
#   New-Item -ItemType SymbolicLink -Path "$env:APPDATA\spicetify\Themes\Mirage" -Target "$PWD\Mirage"
# macOS / Linux:
ln -s "$PWD/Mirage" "$(dirname "$(spicetify -c)")/Themes/Mirage"

spicetify config current_theme Mirage color_scheme Mirage inject_css 1 replace_colors 1 inject_theme_js 1
spicetify apply
```

Day-to-day loop, in two terminals:

```bash
npm run watch        # rebuilds Mirage/theme.js from src/ on every save
spicetify watch -s   # re-applies the theme and reloads Spotify when Mirage/ changes
```

## ✅ Checks

| Command | What it does |
|---|---|
| `npm run lint` | ESLint on `src/`, Stylelint on `Mirage/user.css` |
| `npm run check` | rebuilds `Mirage/theme.js` and fails if the committed bundle is out of date |
| `node tests/unit/<name>.test.js` | unit tests (CI runs every file in `tests/unit/`) |
| `npm run test:games` | plays all party games end to end, silently, with a local relay and fake Spotify |
| `npm run test:phones` | the phone page in Chrome phone emulation and WebKit |
| `npm run check:contrast` | every accent colour pair against 2,617 synthetic covers |
| `npm run check:selectors` | checks Mirage's rules against your installed Spotify |
| `npm run check:spotify` | compares the test's Spotify stand-in with your installed Spotify and Spicetify |
| `npm run ui:shots` | renders Spotify's stylesheets with Mirage in a hidden window, without Spotify |

`lint` and `check` must pass before you push; CI runs the rest.

## 🗂 Project layout

| Path | What it is |
|---|---|
| `src/` | The theme script as ES modules (`src/main.js` is the entry point). **Edit here.** |
| `Mirage/theme.js` | The bundle built from `src/` (`npm run build`). Don't edit by hand, but **do commit it**: the Marketplace loads it straight from the repo. |
| `Mirage/user.css` | All styling. Plain CSS, linted with Stylelint. |
| `Mirage/color.ini` | The colour schemes (`Mirage`, `Obsidian`, `Sakura`, `Abyss`, `Ember`, `Pearl`). |
| `overlay/` | The Mirage Overlay companion app (Electron): `cd overlay && npm install && npm start`. |
| `docs/` | GitHub Pages: the colour demo and the phone page for guests (`docs/live/`). |
| `remote/` | `fixes.json`, repairs loaded by installed themes after Spotify updates ([details](remote/README.md)). |
| `streamdeck/` | The Stream Deck plugin. |
| `tests/`, `tools/` | Tests, build script and checks. |
| `install.ps1`, `install.sh` | One-line installers for Windows and macOS/Linux. |
| `manifest.json` | Marketplace entry; CI checks that every file it references exists. |
| `assets/` | Screenshots and illustrations for the README. |

## 🎨 Adding a colour scheme

1. Add a section to `Mirage/color.ini` with all 18 keys, as hex values without `#`. Copy an existing scheme as a start: `text`, `subtext`, `main`, `main-elevated`, `highlight`, `highlight-elevated`, `sidebar`, `player`, `card`, `shadow`, `selected-row`, `button`, `button-active`, `button-disabled`, `tab-active`, `notification`, `notification-error`, `misc`.
2. Check that `text` and `subtext` stay readable on `card` and `highlight`. Dark schemes fit the glass look best; `Pearl` shows how a light one works.
3. Try it on a playlist, an album, an artist page and in immersive mode, and run `npm run check:contrast`.
4. Mention it in `README.md` **and** `README.de.md`.

Only the `Mirage` scheme follows the album cover live; every other section is a fixed palette.

## 🌍 Improving a translation

Theme strings live in `src/i18n.js` and the topic files next to it (`src/i18n-games.js`, `src/i18n-party.js`, `src/i18n-guests.js`, …). Each language is one object keyed by its code (`en`, `de`, `fr`, …).

- **Fix or complete a language:** compare it with `en`. Missing keys fall back to English, so they are exactly what needs translating.
- **Add a language:** copy the `en` block, use the language code Spotify uses (for example `sv`, `cs`), translate the values and keep the keys.
- Keep texts short: they appear in a settings dialog and on small buttons.
- The phone page has its own strings in `docs/live/index.html`, the overlay app in `overlay/i18n.js`.

## 🌱 Good first issues

- Fill in missing keys in a translation.
- Add a colour scheme (see above).
- Fix a styling glitch on a page Mirage doesn't cover well yet; attach a before/after screenshot.
- Improve keyboard focus styles or contrast in a dialog.

Look for issues labelled [`good first issue`](https://github.com/Passimoritz/spicetify-mirage/labels/good%20first%20issue).

## ✍ Commits and pull requests

Short, imperative subject lines that say what the commit does, without a trailing full stop:

```
Fix header colour block on album pages
Add Aurora colour scheme
Translate settings dialog to Polish
```

Add a body if the *why* isn't obvious (for example which Spotify version renamed a class). One topic per commit; regenerate `Mirage/theme.js` in the same commit as the `src/` change.

Pull request checklist:

- [ ] `npm run lint` and `npm run check` pass
- [ ] Tested on **Spotify X.Y.Z** with **Spicetify X.Y.Z** (write the versions in the PR)
- [ ] Checked with the *Calm* preset or *reduce motion*, if the change touches animations
- [ ] Screenshots for visual changes (personal data pixelated)
- [ ] `README.md` **and** `README.de.md` updated if user-visible behaviour changed
- [ ] User-visible changes described in the PR (the maintainer collects them in `CHANGELOG.md`)

By contributing you agree that your work is released under the [MIT License](LICENSE).
