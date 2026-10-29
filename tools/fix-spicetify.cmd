@echo off
rem Mirage - repair Spicetify after a Spotify update (Windows)
rem
rem Spotify updates itself quietly and overwrites the files Spicetify patched.
rem Afterwards Spotify starts without theme, Marketplace or extensions, and
rem "spicetify apply" fails with "backup version mismatch" or similar.
rem This script runs the full, version-independent repair:
rem   1. close Spotify            2. update the Spicetify CLI
rem   3. throw away the old backup and make a fresh one from the new Spotify
rem   4. apply theme + extensions again   5. start Spotify
rem It only uses commands every Spicetify 2.x knows, so it keeps working after
rem future Spotify and Spicetify updates.
rem
rem NOTE: keep this file pure ASCII - cmd.exe misreads umlauts and dashes.

setlocal EnableExtensions
title Mirage - Spicetify repair
echo.
echo  Mirage - Spicetify repair
echo  =========================
echo.

rem --- Spicetify installed? -------------------------------------------------
where spicetify >nul 2>nul
if errorlevel 1 (
  if exist "%LOCALAPPDATA%\spicetify\spicetify.exe" (
    set "PATH=%LOCALAPPDATA%\spicetify;%PATH%"
  ) else (
    echo  Spicetify was not found.
    echo  Install it first:  https://spicetify.app/docs/getting-started
    echo.
    pause
    exit /b 1
  )
)

rem --- Microsoft Store Spotify cannot be patched -----------------------------
if not exist "%APPDATA%\Spotify\Spotify.exe" (
  powershell -NoProfile -Command "if (Get-AppxPackage *SpotifyMusic*) { exit 1 }" >nul 2>nul
  if errorlevel 1 (
    echo  You are using the Microsoft Store version of Spotify.
    echo  Spicetify cannot modify it. Uninstall it and install Spotify from
    echo  https://www.spotify.com/download/windows/  then run this script again.
    echo.
    pause
    exit /b 1
  )
)

rem --- Spicetify refuses to run as administrator unless told so -------------
set "BYPASS="
net session >nul 2>nul
if not errorlevel 1 set "BYPASS=--bypass-admin"

echo  [1/5] Closing Spotify ...
taskkill /f /im Spotify.exe >nul 2>nul
timeout /t 2 /nobreak >nul

echo  [2/5] Updating Spicetify ...
call spicetify upgrade %BYPASS%
rem a failed upgrade (offline, already current) is not fatal

echo  [3/5] Restoring the original Spotify files ...
call spicetify restore %BYPASS% >nul 2>nul
rem fails when Spotify already replaced them - that is fine

echo  [4/5] Making a fresh backup and applying the theme ...
call spicetify backup apply %BYPASS%
if errorlevel 1 (
  echo.
  echo  First attempt failed - clearing the old backup and trying again ...
  call spicetify clear %BYPASS% >nul 2>nul
  call spicetify backup apply %BYPASS%
  if errorlevel 1 goto :failed
)

echo  [5/5] Starting Spotify ...
start "" "%APPDATA%\Spotify\Spotify.exe"
echo.
echo  Done. Mirage and your extensions are back.
echo  Spotify updated again later? Just run this file again.
echo.
pause
exit /b 0

:failed
echo.
echo  The repair did not finish. Try, in this order:
echo    1. Run this file again after a restart of the PC.
echo    2. Reinstall Spicetify:
echo         powershell -c "iwr -useb https://raw.githubusercontent.com/spicetify/cli/main/install.ps1 ^| iex"
echo    3. Open an issue with the text above:
echo         https://github.com/Passimoritz/spicetify-mirage/issues/new/choose
echo.
pause
exit /b 1
