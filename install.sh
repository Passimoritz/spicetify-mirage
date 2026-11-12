#!/usr/bin/env bash
# Mirage - installer for macOS and Linux (counterpart of install.ps1)
#
#   From a clone or an unpacked ZIP:
#     bash install.sh [--scheme Mirage|Obsidian|Sakura|Abyss|Ember|Pearl] [--overlay]
#   Without downloading anything first (one line):
#     curl -fsSL https://raw.githubusercontent.com/Passimoritz/spicetify-mirage/main/install.sh | bash
#
# What it does: installs Spicetify if it is missing (official installer), copies the theme,
# switches Spicetify to it and applies it. Safe to run again at any time.
#   --no-spicetify-install   never install Spicetify, stop with a hint instead
set -u

RAW="https://raw.githubusercontent.com/Passimoritz/spicetify-mirage/main"
SCHEME="Mirage"
OVERLAY=0
INSTALL_SPICETIFY=1

red() { printf '\033[31m%s\033[0m\n' "$*" >&2; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
yellow() { printf '\033[33m%s\033[0m\n' "$*"; }
step() { printf '\033[36m%s\033[0m\n' "$*"; }
fail() {
  echo >&2
  red "Mirage was not installed completely:"
  red "$*"
  exit 1
}

# everything lives in main(): with "curl | bash" the script arrives over stdin, and a command that
# reads stdin (an installer asking a question) would otherwise swallow the rest of it
main() {
while [ $# -gt 0 ]; do
  case "$1" in
    --scheme) [ $# -ge 2 ] || fail "--scheme needs a name, e.g. --scheme Obsidian"; SCHEME="$2"; shift 2 ;;
    --scheme=*) SCHEME="${1#--scheme=}"; shift ;;
    --overlay) OVERLAY=1; shift ;;
    --no-spicetify-install) INSTALL_SPICETIFY=0; shift ;;
    -h | --help) sed -n '2,11p' "$0" 2>/dev/null; exit 0 ;;
    *) fail "Unknown option: $1 (see --help)" ;;
  esac
done

# Spicetify must run as the normal user: as root it patches the wrong home folder
if [ "$(id -u)" -eq 0 ]; then
  fail "Do not run this installer with sudo. Run it as your normal user."
fi

OS="$(uname -s)"

# --- Spotify: Snap cannot be patched, Flatpak needs one extra step ------------
if [ "$OS" = "Linux" ]; then
  if command -v snap >/dev/null 2>&1 && snap list spotify >/dev/null 2>&1 && [ ! -d /opt/spotify ] && [ ! -d /usr/share/spotify ] &&
    [ ! -d /var/lib/flatpak/app/com.spotify.Client ] && [ ! -d "$HOME/.local/share/flatpak/app/com.spotify.Client" ]; then
    fail "Spotify is installed as a Snap. Spicetify cannot modify the Snap version.
Remove it (sudo snap remove spotify) and install Spotify from the official repository or Flatpak:
https://www.spotify.com/download/linux/ - then start it once, log in and run this installer again."
  fi
fi

# --- Spicetify: use it, find it, or install it -------------------------------
if ! command -v spicetify >/dev/null 2>&1 && [ -x "$HOME/.spicetify/spicetify" ]; then
  # installed, but this shell does not know the new PATH yet
  PATH="$HOME/.spicetify:$PATH"
fi
if ! command -v spicetify >/dev/null 2>&1; then
  [ "$INSTALL_SPICETIFY" -eq 1 ] || fail "Spicetify not found - install it first: https://spicetify.app/docs/getting-started"
  command -v curl >/dev/null 2>&1 || fail "curl is needed to install Spicetify. Install curl, or install Spicetify by hand: https://spicetify.app/docs/getting-started"
  step "Spicetify is missing - installing it with the official installer (spicetify.app) ..."
  curl -fsSL https://raw.githubusercontent.com/spicetify/cli/main/install.sh | sh ||
    fail "Spicetify could not be installed automatically.
Check your internet connection or install it by hand: https://spicetify.app/docs/getting-started"
  [ -x "$HOME/.spicetify/spicetify" ] && PATH="$HOME/.spicetify:$PATH"
  command -v spicetify >/dev/null 2>&1 ||
    fail "Spicetify was installed but is not on the PATH yet. Open a new terminal and run the installer again."
fi

# --- 1) theme files: next to this script, otherwise from GitHub ---------------
# with "curl | bash" there is no script file, so BASH_SOURCE is empty
SELF="${BASH_SOURCE[0]:-}"
ROOT=""
if [ -n "$SELF" ] && [ -f "$SELF" ]; then
  ROOT="$(cd "$(dirname "$SELF")" && pwd)"
fi
SRC="$ROOT/Mirage"
TMP=""
if [ -z "$ROOT" ] || [ ! -f "$SRC/user.css" ] || [ ! -f "$SRC/theme.js" ]; then
  command -v curl >/dev/null 2>&1 || fail "curl is needed to download the theme files."
  step "Downloading the theme files ..."
  TMP="$(mktemp -d 2>/dev/null || mktemp -d -t mirage)"
  trap 'rm -rf "$TMP"' EXIT
  SRC="$TMP"
  for f in user.css color.ini theme.js; do
    curl -fsSL "$RAW/Mirage/$f" -o "$SRC/$f" ||
      fail "Could not download Mirage/$f. Check your internet connection and try again."
  done
fi

# the scheme must exist, otherwise Spotify ends up with broken colours
KNOWN="$(sed -n 's/^[[:space:]]*\[\(.*\)\][[:space:]]*$/\1/p' "$SRC/color.ini" | tr -d '\r')"
MATCH="$(printf '%s\n' "$KNOWN" | grep -i -x -F -- "$SCHEME" | head -n 1)"
[ -n "$MATCH" ] || fail "Unknown colour scheme '$SCHEME'. Available: $(printf '%s' "$KNOWN" | tr '\n' ' ')"
SCHEME="$MATCH"

# Themes folder sits next to Spicetify's config file
CFG="$(spicetify -c 2>/dev/null | grep 'config-xpui\.ini' | tail -n 1)"
if [ -n "$CFG" ] && [ -f "$CFG" ]; then
  THEMES="$(dirname "$CFG")/Themes"
elif [ "$OS" = "Darwin" ]; then
  THEMES="$HOME/.config/spicetify/Themes"
else
  THEMES="${XDG_CONFIG_HOME:-$HOME/.config}/spicetify/Themes"
fi
DEST="$THEMES/Mirage"
mkdir -p "$DEST" 2>/dev/null && cp -R "$SRC/." "$DEST/" 2>/dev/null ||
  fail "Could not write to $DEST. Check the permissions of that folder and try again."
green "Theme copied to $DEST"

# --- 2) activate and apply (Spicetify restarts Spotify itself) ----------------
step "Applying the theme - Spotify restarts ..."
spicetify config current_theme Mirage color_scheme "$SCHEME" inject_css 1 replace_colors 1 inject_theme_js 1 ||
  fail "spicetify config failed - see the message above."
if ! spicetify apply; then
  # fresh Spicetify (no backup yet) or Spotify updated itself: make a backup first
  yellow "First attempt failed - making a fresh backup and trying again ..."
  if ! spicetify backup apply; then
    HINT="This usually happens right after a Spotify update. Try:
  spicetify upgrade && spicetify restore backup apply"
    if [ "$OS" = "Linux" ]; then
      HINT="$HINT
On Linux Spicetify also needs write access to Spotify's folder, for example:
  sudo chmod a+wr /opt/spotify && sudo chmod a+wr /opt/spotify/Apps -R
Flatpak and other locations: https://spicetify.app/docs/advanced-usage/installation"
    fi
    fail "spicetify apply failed. The theme files are in place, but Spotify could not be patched.
$HINT"
  fi
fi
green "Mirage is installed. Colour scheme: $SCHEME"
echo "In Spotify: Ctrl+Shift+M opens the immersive mode, the settings are in the profile menu."

# --- 3) optional: overlay app from source (needs Node.js) ---------------------
if [ "$OVERLAY" -eq 1 ]; then
  if [ -z "$ROOT" ] || [ ! -f "$ROOT/overlay/package.json" ]; then
    fail "The theme is installed. --overlay needs the full repository next to this script.
Easier: download the ready-made app: https://github.com/Passimoritz/spicetify-mirage/releases/latest"
  fi
  command -v npm >/dev/null 2>&1 ||
    fail "The theme is installed. For the overlay: Node.js/npm not found - install Node.js from https://nodejs.org, then run again with --overlay"
  (cd "$ROOT/overlay" && npm install --no-audit --no-fund) || fail "npm install failed"
  sh "$ROOT/overlay/start.sh" || fail "The overlay did not start - try: sh overlay/start.sh"
  green "Mirage Overlay started."
fi
}
main "$@"
