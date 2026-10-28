@echo off
rem Startet Mirage Overlay ohne Konsolenfenster (beim ersten Mal vorher: npm install)
if not exist "%~dp0node_modules\electron\dist\electron.exe" (
  echo Bitte zuerst im Ordner "%~dp0" einmal "npm install" ausfuehren.
  pause
  exit /b 1
)
start "" "%~dp0node_modules\electron\dist\electron.exe" "%~dp0." %*
