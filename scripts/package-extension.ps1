# Vera5 - build extension/dist and zip for Chrome Web Store upload (manifest at zip root; no keys)
param(
  [switch]$SkipBuild,
  [string]$OutputDir = ""
)

$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$ExtensionRoot = Join-Path $RepoRoot "extension"
$DistDir = Join-Path $ExtensionRoot "dist"
$ManifestPath = Join-Path $DistDir "manifest.json"

function Fail([string]$Message) {
  throw $Message
}

function Assert-NoSecretsInDist {
  $forbidden = @()
  if (Test-Path (Join-Path $DistDir ".env")) {
    $forbidden += ".env"
  }
  Get-ChildItem -Path $DistDir -Recurse -File -Force -ErrorAction SilentlyContinue |
    Where-Object {
      $_.Name -like ".env*" -or $_.Extension -eq ".key"
    } |
    ForEach-Object {
      $forbidden += ($_.FullName.Substring($DistDir.Length + 1))
    }
  if ($forbidden.Count -gt 0) {
    Fail ("dist/ must not contain secrets or env files before packaging:`n  " + ($forbidden -join "`n  "))
  }
}

if (-not $SkipBuild) {
  Push-Location $ExtensionRoot
  try {
    npm install
    npm run build
  }
  finally {
    Pop-Location
  }
}

if (-not (Test-Path $ManifestPath)) {
  Fail "dist/manifest.json missing - run without -SkipBuild or npm run build in extension/ first"
}

Assert-NoSecretsInDist

$manifest = Get-Content -Raw -Path $ManifestPath | ConvertFrom-Json
$version = [string]$manifest.version
if ([string]::IsNullOrWhiteSpace($version)) {
  Fail "dist/manifest.json has no version field"
}

$nameSlug = "vera5"
if (-not [string]::IsNullOrWhiteSpace($manifest.name)) {
  $nameSlug = ($manifest.name -replace "[^A-Za-z0-9]+", "-").Trim("-").ToLowerInvariant()
  if ([string]::IsNullOrWhiteSpace($nameSlug)) {
    $nameSlug = "vera5"
  }
}

if ([string]::IsNullOrWhiteSpace($OutputDir)) {
  $OutputDir = Join-Path $RepoRoot "release"
}
elseif (-not [System.IO.Path]::IsPathRooted($OutputDir)) {
  $OutputDir = Join-Path $RepoRoot $OutputDir
}

New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null

$zipName = "{0}-{1}.zip" -f $nameSlug, $version
$zipPath = Join-Path $OutputDir $zipName

if (Test-Path $zipPath) {
  Remove-Item -LiteralPath $zipPath -Force
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory(
  $DistDir,
  $zipPath,
  [System.IO.Compression.CompressionLevel]::Optimal,
  $false
)

$archive = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
try {
  $manifestEntry = @($archive.Entries | Where-Object { $_.FullName -eq "manifest.json" })
  if ($manifestEntry.Count -eq 0) {
    Fail "packaged zip does not contain manifest.json at archive root - Chrome Web Store requires manifest at zip root"
  }
}
finally {
  $archive.Dispose()
}

Write-Host "Packaged extension v$version"
Write-Host "  Source: $DistDir"
Write-Host "  Output: $zipPath"
Write-Host "Upload this zip in the Chrome Web Store Developer Dashboard."
