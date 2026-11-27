@echo off
rem Startet Mirage Overlay ohne Konsolenfenster (beim ersten Mal vorher: npm install)
if not exist "%~dp0node_modules\electron\install.js" (
  echo Bitte zuerst im Ordner "%~dp0" einmal "npm install" ausfuehren.
  pause
  exit /b 1
)
rem Seit Electron 42 laedt "npm install" das Programm selbst nicht mehr mit herunter - das holt der erste Start nach
if not exist "%~dp0node_modules\electron\dist\electron.exe" (
  echo Lade Electron herunter, das dauert einmalig einen Moment ...
  node "%~dp0node_modules\electron\install.js"
)
if not exist "%~dp0node_modules\electron\dist\electron.exe" (
  echo Electron konnte nicht geladen werden. Bitte im Ordner "%~dp0" einmal "npx install-electron" ausfuehren.
  pause
  exit /b 1
)
start "" "%~dp0node_modules\electron\dist\electron.exe" "%~dp0." %*
