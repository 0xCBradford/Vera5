# Vera5 - build extension/dist-firefox and zip for temporary Firefox load
# (manifest at zip root; Vite dev shell and other Chromium-only artifacts excluded)
param(
  [switch]$SkipBuild,
  [string]$OutputDir = ""
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$ExtensionRoot = Join-Path $RepoRoot "extension"
$DistDir = Join-Path $ExtensionRoot "dist-firefox"
$ManifestPath = Join-Path $DistDir "manifest.json"

function Fail([string]$Message) {
  throw $Message
}

function Normalize-ArchiveRelativePath([string]$RelativePath) {
  return ($RelativePath -replace '\\', '/').TrimStart('/')
}

function Test-ChromeOnlyArtifact([string]$RelativePath) {
  $normalized = Normalize-ArchiveRelativePath $RelativePath
  if ($normalized -eq "index.html") {
    return $true
  }
  if ($normalized -eq "manifest.firefox.json") {
    return $true
  }
  if ($normalized -match '(^|/)dev-[^/]+\.js$') {
    return $true
  }
  return $false
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
    Fail ("dist-firefox/ must not contain secrets or env files before packaging:`n  " + ($forbidden -join "`n  "))
  }
}

function Assert-FirefoxDistManifest {
  $manifest = Get-Content -Raw -Path $ManifestPath | ConvertFrom-Json
  if ($null -eq $manifest.browser_specific_settings.gecko) {
    Fail "dist-firefox/manifest.json is not a Firefox manifest (missing browser_specific_settings.gecko)"
  }
  if (-not [string]::IsNullOrWhiteSpace([string]$manifest.background.service_worker)) {
    Fail "dist-firefox/manifest.json must not ship a Chromium service_worker background entry"
  }
  $scripts = @($manifest.background.scripts)
  if ($scripts.Count -eq 0) {
    Fail "dist-firefox/manifest.json must declare background.scripts for Firefox"
  }
  return $manifest
}

function Add-DirectoryEntriesToZip {
  param(
    [string]$SourceRoot,
    [System.IO.Compression.ZipArchive]$Archive,
    [string]$CurrentRelative = ""
  )

  $currentPath = if ([string]::IsNullOrWhiteSpace($CurrentRelative)) {
    $SourceRoot
  }
  else {
    Join-Path $SourceRoot $CurrentRelative
  }

  foreach ($item in Get-ChildItem -LiteralPath $currentPath -Force) {
    $rel = if ([string]::IsNullOrWhiteSpace($CurrentRelative)) {
      $item.Name
    }
    else {
      Join-Path $CurrentRelative $item.Name
    }
    $relNormalized = Normalize-ArchiveRelativePath $rel

    if ($item.PSIsContainer) {
      Add-DirectoryEntriesToZip -SourceRoot $SourceRoot -Archive $Archive -CurrentRelative $rel
      continue
    }

    if (Test-ChromeOnlyArtifact $relNormalized) {
      Write-Host "  Excluded Chrome-only artifact: $relNormalized"
      continue
    }

    [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
      $Archive,
      $item.FullName,
      $relNormalized,
      [System.IO.Compression.CompressionLevel]::Optimal
    )
  }
}

function Assert-PackagedZip([string]$ZipPath) {
  $archive = [System.IO.Compression.ZipFile]::OpenRead($ZipPath)
  try {
    $entries = @($archive.Entries | ForEach-Object { $_.FullName.Replace('\', '/') })
    $manifestEntry = @($entries | Where-Object { $_ -eq "manifest.json" })
    if ($manifestEntry.Count -eq 0) {
      Fail "packaged zip does not contain manifest.json at archive root"
    }

    $forbiddenInZip = @($entries | Where-Object { Test-ChromeOnlyArtifact $_ })
    if ($forbiddenInZip.Count -gt 0) {
      Fail ("packaged zip must not contain Chrome-only artifacts:`n  " + ($forbiddenInZip -join "`n  "))
    }

    $manifestStream = $archive.GetEntry("manifest.json").Open()
    try {
      $reader = New-Object System.IO.StreamReader($manifestStream)
      $manifestJson = $reader.ReadToEnd()
    }
    finally {
      $manifestStream.Dispose()
    }
    $manifest = $manifestJson | ConvertFrom-Json
    if ($null -eq $manifest.browser_specific_settings.gecko) {
      Fail "packaged manifest.json is not a Firefox manifest"
    }
    if (-not [string]::IsNullOrWhiteSpace([string]$manifest.background.service_worker)) {
      Fail "packaged manifest.json must not reference a Chromium service_worker"
    }
  }
  finally {
    $archive.Dispose()
  }
}

if (-not $SkipBuild) {
  Push-Location $ExtensionRoot
  try {
    npm install
    npm run build:firefox
  }
  finally {
    Pop-Location
  }
}

if (-not (Test-Path $ManifestPath)) {
  Fail "dist-firefox/manifest.json missing - run without -SkipBuild or npm run build:firefox in extension/ first"
}

Assert-NoSecretsInDist
$manifest = Assert-FirefoxDistManifest

$version = [string]$manifest.version
if ([string]::IsNullOrWhiteSpace($version)) {
  Fail "dist-firefox/manifest.json has no version field"
}

$nameSlug = "vera5-firefox"
if (-not [string]::IsNullOrWhiteSpace($manifest.name)) {
  $derived = ($manifest.name -replace "[^A-Za-z0-9]+", "-").Trim("-").ToLowerInvariant()
  if (-not [string]::IsNullOrWhiteSpace($derived)) {
    $nameSlug = "$derived-firefox"
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

$zipArchive = [System.IO.Compression.ZipFile]::Open($zipPath, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  Add-DirectoryEntriesToZip -SourceRoot $DistDir -Archive $zipArchive
}
finally {
  $zipArchive.Dispose()
}

Assert-PackagedZip $zipPath

Write-Host "Packaged Firefox extension v$version"
Write-Host "  Source: $DistDir"
Write-Host "  Output: $zipPath"
Write-Host "Load manifest.json from the unpacked zip via about:debugging (temporary add-on)."
