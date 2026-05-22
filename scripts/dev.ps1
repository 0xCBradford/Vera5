# Vera5 — start extension Vite dev server
$ErrorActionPreference = "Stop"
$ExtensionRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\extension")).Path

Push-Location $ExtensionRoot
try {
  if (-not (Test-Path "node_modules")) {
    npm install
  }
  npm run dev
}
finally {
  Pop-Location
}
