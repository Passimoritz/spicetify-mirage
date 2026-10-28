# Mirage – Installation für Windows
#   powershell -ExecutionPolicy Bypass -File install.ps1 [-Scheme Mirage|Obsidian|Sakura|Abyss|Ember] [-Overlay]
param(
  [string]$Scheme = "Mirage",
  [switch]$Overlay
)
$ErrorActionPreference = "Stop"

if (-not (Get-Command spicetify -ErrorAction SilentlyContinue)) {
  Write-Host "Spicetify not found – see https://spicetify.app" -ForegroundColor Red
  exit 1
}

$dest = Join-Path $env:APPDATA "spicetify\Themes\Mirage"
New-Item -ItemType Directory -Force $dest | Out-Null
Copy-Item (Join-Path $PSScriptRoot "Mirage\*") $dest -Force

spicetify config current_theme Mirage color_scheme $Scheme inject_css 1 replace_colors 1 inject_theme_js 1
spicetify apply

if ($Overlay) {
  Push-Location (Join-Path $PSScriptRoot "overlay")
  npm install --no-audit --no-fund
  if (-not (Test-Path "node_modules\electron\dist\electron.exe")) { node node_modules\electron\install.js }
  Pop-Location
  & (Join-Path $PSScriptRoot "overlay\start.cmd")
}
