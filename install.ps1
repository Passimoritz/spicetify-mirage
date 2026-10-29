# Mirage - installer for Windows
#   powershell -ExecutionPolicy Bypass -File install.ps1 [-Scheme Mirage|Obsidian|Sakura|Abyss|Ember|Pearl] [-Overlay] [-NoApp]
#
# NOTE: keep this file pure ASCII. Windows PowerShell 5.1 reads scripts without a BOM
# as ANSI, so characters like an en dash or umlauts break the parser.
param(
  [string]$Scheme = "Mirage",
  [switch]$Overlay,
  [switch]$NoApp
)
$ErrorActionPreference = "Stop"

function Fail($msg) {
  Write-Host $msg -ForegroundColor Red
  exit 1
}

if (-not (Get-Command spicetify -ErrorAction SilentlyContinue)) {
  Fail "Spicetify not found - install it first: https://spicetify.app"
}

# 1) copy the theme into Spicetify's Themes folder
$dest = Join-Path $env:APPDATA "spicetify\Themes\Mirage"
New-Item -ItemType Directory -Force $dest | Out-Null
Copy-Item (Join-Path $PSScriptRoot "Mirage\*") $dest -Force
Write-Host "Theme copied to $dest" -ForegroundColor Green

# 2) Mirage App (custom app: own page in Spotify's sidebar)
if (-not $NoApp) {
  $appDest = Join-Path $env:APPDATA "spicetify\CustomApps\mirage"
  New-Item -ItemType Directory -Force $appDest | Out-Null
  Copy-Item (Join-Path $PSScriptRoot "MirageApp\*") $appDest -Force -Exclude README.md
  $apps = (spicetify config custom_apps) -join " "
  if ($apps -notmatch "mirage") { spicetify config custom_apps mirage | Out-Null }
  Write-Host "Mirage App copied to $appDest" -ForegroundColor Green
}

# 3) activate and apply
spicetify config current_theme Mirage color_scheme $Scheme inject_css 1 replace_colors 1 inject_theme_js 1
if ($LASTEXITCODE -ne 0) { Fail "spicetify config failed" }
spicetify apply
if ($LASTEXITCODE -ne 0) { Fail "spicetify apply failed" }

# 4) optional: overlay app (needs Node.js)
if ($Overlay) {
  if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
    Fail "Node.js/npm not found - install Node.js from https://nodejs.org, then run again with -Overlay"
  }
  Push-Location (Join-Path $PSScriptRoot "overlay")
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
  & (Join-Path $PSScriptRoot "overlay\start.cmd")
  Write-Host "Mirage Overlay started - look for the ring icon in the tray." -ForegroundColor Green
}
