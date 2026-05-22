# Vera5 — production build of the extension package
$ErrorActionPreference = "Stop"
$ExtensionRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\extension")).Path

Push-Location $ExtensionRoot
try {
  npm install
  npm run build
  Write-Host "Build output: $ExtensionRoot\dist"
}
finally {
  Pop-Location
}
