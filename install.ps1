# Mirage - installer for Windows
#
#   From a clone or an unpacked ZIP:
#     powershell -ExecutionPolicy Bypass -File install.ps1 [-Scheme Mirage|Obsidian|Sakura|Abyss|Ember|Pearl] [-Overlay]
#   Without downloading anything first (one line):
#     iwr -useb https://raw.githubusercontent.com/Passimoritz/spicetify-mirage/main/install.ps1 | iex
#
# What it does: installs Spicetify if it is missing (official installer), copies the theme,
# switches Spicetify to it and applies it. Safe to run again at any time.
#   -NoSpicetifyInstall   never install Spicetify, stop with a hint instead
#
# NOTE: keep this file pure ASCII. Windows PowerShell 5.1 reads scripts without a BOM
# as ANSI, so characters like an en dash or umlauts break the parser.
param(
  [string]$Scheme = "Mirage",
  [switch]$Overlay,
  [switch]$NoSpicetifyInstall
)

$MirageRaw = "https://raw.githubusercontent.com/Passimoritz/spicetify-mirage/main"
$MirageFix = "https://github.com/Passimoritz/spicetify-mirage/releases/latest/download/fix-spicetify.cmd"

function Step($msg) { Write-Host $msg -ForegroundColor Cyan }
function Fail($msg) { throw $msg }

function Install-Mirage {
  param([string]$Scheme, [bool]$Overlay, [bool]$NoSpicetifyInstall, [string]$Root)
  # local on purpose: with "iwr | iex" the script runs in the caller's session
  $ErrorActionPreference = "Stop"
  try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch {}

  # --- Spotify: the desktop version from spotify.com is required -------------
  $spotifyExe = Join-Path $env:APPDATA "Spotify\Spotify.exe"
  if (-not (Test-Path $spotifyExe)) {
    $store = $null
    try { $store = Get-AppxPackage *SpotifyMusic* } catch {}
    if ($store) {
      Fail ("You are using the Microsoft Store version of Spotify. Spicetify cannot modify it.`n" +
        "Uninstall it (Settings > Apps), install Spotify from https://www.spotify.com/download/windows/`n" +
        "start it once, log in, then run this installer again.")
    }
    # installed somewhere unusual (portable, Scoop)? Spicetify knows its own way - only warn
    Write-Host "Note: Spotify was not found in the usual place. If the next steps fail, install it from https://www.spotify.com/download/windows/ and start it once." -ForegroundColor Yellow
  }

  # --- Spicetify: use it, find it, or install it -----------------------------
  $localSpicetify = Join-Path $env:LOCALAPPDATA "spicetify"
  if (-not (Get-Command spicetify -ErrorAction SilentlyContinue)) {
    # installed, but this window does not know the new PATH yet
    if (Test-Path (Join-Path $localSpicetify "spicetify.exe")) { $env:PATH = "$localSpicetify;$env:PATH" }
  }
  if (-not (Get-Command spicetify -ErrorAction SilentlyContinue)) {
    if ($NoSpicetifyInstall) { Fail "Spicetify not found - install it first: https://spicetify.app/docs/getting-started" }
    Step "Spicetify is missing - installing it with the official installer (spicetify.app) ..."
    try {
      Invoke-WebRequest -UseBasicParsing "https://raw.githubusercontent.com/spicetify/cli/main/install.ps1" | Invoke-Expression
    } catch {
      Fail ("Spicetify could not be installed automatically: " + $_.Exception.Message + "`n" +
        "Check your internet connection or install it by hand: https://spicetify.app/docs/getting-started")
    }
    if (Test-Path (Join-Path $localSpicetify "spicetify.exe")) { $env:PATH = "$localSpicetify;$env:PATH" }
    if (-not (Get-Command spicetify -ErrorAction SilentlyContinue)) {
      Fail "Spicetify was installed but is not on the PATH yet. Close this window, open a new one and run the installer again."
    }
  }

  # Spicetify refuses to run as administrator unless told so
  $bypass = @()
  $admin = $false
  try { $admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) } catch {}
  if ($admin) {
    $bypass = @("--bypass-admin")
    Write-Host "Note: this window runs as administrator. That works, but a normal window is the safer choice." -ForegroundColor Yellow
  }

  # --- 1) theme files: next to this script, otherwise from GitHub ------------
  $src = $null
  if ($Root) { $src = Join-Path $Root "Mirage" }
  if (-not ($src -and (Test-Path (Join-Path $src "user.css")) -and (Test-Path (Join-Path $src "theme.js")))) {
    Step "Downloading the theme files ..."
    $src = Join-Path $env:TEMP "mirage-theme"
    New-Item -ItemType Directory -Force $src | Out-Null
    foreach ($f in @("user.css", "color.ini", "theme.js")) {
      try {
        Invoke-WebRequest -UseBasicParsing "$MirageRaw/Mirage/$f" -OutFile (Join-Path $src $f)
      } catch {
        Fail ("Could not download Mirage/$f : " + $_.Exception.Message + "`nCheck your internet connection and try again.")
      }
    }
  }

  # the scheme must exist, otherwise Spotify ends up with broken colours
  $known = @(Select-String -Path (Join-Path $src "color.ini") -Pattern '^\s*\[(.+?)\]\s*$' | ForEach-Object { $_.Matches[0].Groups[1].Value })
  $match = $known | Where-Object { $_ -ieq $Scheme } | Select-Object -First 1
  if (-not $match) { Fail ("Unknown colour scheme '$Scheme'. Available: " + ($known -join ", ")) }
  $Scheme = $match

  # Themes folder sits next to Spicetify's config file
  $themes = Join-Path $env:APPDATA "spicetify\Themes"
  try {
    $cfg = & spicetify -c @bypass | Where-Object { $_ -match 'config-xpui\.ini' } | Select-Object -Last 1
    if ($cfg -and (Test-Path $cfg.Trim())) { $themes = Join-Path (Split-Path $cfg.Trim()) "Themes" }
  } catch {}
  $dest = Join-Path $themes "Mirage"
  try {
    New-Item -ItemType Directory -Force $dest | Out-Null
    Copy-Item (Join-Path $src "*") $dest -Recurse -Force
  } catch {
    Fail ("Could not write to $dest : " + $_.Exception.Message + "`n" +
      "Check that the folder is not write-protected and that no antivirus tool blocks it, then try again.")
  }
  Write-Host "Theme copied to $dest" -ForegroundColor Green

  # --- 2) activate and apply (Spicetify closes and restarts Spotify itself) --
  Step "Applying the theme - Spotify restarts ..."
  & spicetify config current_theme Mirage color_scheme $Scheme inject_css 1 replace_colors 1 inject_theme_js 1 @bypass
  if ($LASTEXITCODE -ne 0) { Fail "spicetify config failed - see the message above." }
  & spicetify apply @bypass
  if ($LASTEXITCODE -ne 0) {
    # fresh Spicetify (no backup yet) or Spotify updated itself: make a backup first
    Write-Host "First attempt failed - making a fresh backup and trying again ..." -ForegroundColor Yellow
    & spicetify backup apply @bypass
    if ($LASTEXITCODE -ne 0) {
      Fail ("spicetify apply failed. The theme files are in place, but Spotify could not be patched.`n" +
        "This usually happens right after a Spotify update. Run the repair script and you are done:`n" +
        "  $MirageFix`n" +
        "(in a clone: tools\fix-spicetify.cmd)")
    }
  }
  Write-Host "Mirage is installed. Colour scheme: $Scheme" -ForegroundColor Green
  Write-Host "In Spotify: Ctrl+Shift+M opens the immersive mode, the settings are in the profile menu."

  # --- 3) optional: overlay app from source (needs Node.js) ------------------
  if ($Overlay) {
    $ov = $null
    if ($Root) { $ov = Join-Path $Root "overlay" }
    if (-not ($ov -and (Test-Path (Join-Path $ov "package.json")))) {
      Fail ("The theme is installed. -Overlay needs the full repository next to this script.`n" +
        "Easier: download the ready-made app: https://github.com/Passimoritz/spicetify-mirage/releases/latest/download/Mirage-Overlay-Setup.exe")
    }
    if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
      Fail "The theme is installed. For the overlay: Node.js/npm not found - install Node.js from https://nodejs.org, then run again with -Overlay"
    }
    Push-Location $ov
    try {
      & npm.cmd install --no-audit --no-fund
      if ($LASTEXITCODE -ne 0) { Fail "npm install failed" }
      # npm may skip Electron's download script - fetch the binary ourselves if missing
      if (-not (Test-Path "node_modules\electron\dist\electron.exe")) {
        & node node_modules\electron\install.js
        if ($LASTEXITCODE -ne 0) { Fail "Electron download failed" }
      }
    } finally {
      Pop-Location
    }
    & (Join-Path $ov "start.cmd")
    Write-Host "Mirage Overlay started - look for the ring icon in the tray." -ForegroundColor Green
  }
}

$MirageDone = $false
try {
  Install-Mirage -Scheme $Scheme -Overlay ([bool]$Overlay) -NoSpicetifyInstall ([bool]$NoSpicetifyInstall) -Root $PSScriptRoot
  $MirageDone = $true
} catch {
  Write-Host ""
  Write-Host "Mirage was not installed completely:" -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Red
}
# as a file: report failure to the caller. With "iwr | iex" an exit would close the user's window.
if (-not $MirageDone -and $PSCommandPath) { exit 1 }
