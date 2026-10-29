#!/bin/sh
# Startet Mirage Overlay auf macOS und Linux im Hintergrund (Gegenstück zu start.cmd).
# Einmalig ausführbar machen: chmod +x start.sh  – danach ./start.sh [--hidden] [--no-gpu]
# --no-gpu hilft unter Linux, wenn das Overlay statt durchsichtig schwarz hinterlegt erscheint.
cd "$(dirname "$0")" || exit 1
if [ ! -x node_modules/.bin/electron ] || [ ! -d node_modules/ws ]; then
  command -v npm >/dev/null 2>&1 || { echo "Bitte zuerst Node.js (mit npm) installieren: https://nodejs.org"; exit 1; }
  echo "Installiere Abhängigkeiten …"
  npm install || exit 1
fi
nohup ./node_modules/.bin/electron . "$@" >/dev/null 2>&1 &
