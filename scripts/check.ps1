# Vera5 — local quality gate (lint + unit tests)
$ErrorActionPreference = "Stop"
$ExtensionRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\extension")).Path

Push-Location $ExtensionRoot
try {
  npm run lint
  npm run test
  Write-Host "Quality gate passed (lint + test)."
}
finally {
  Pop-Location
}
