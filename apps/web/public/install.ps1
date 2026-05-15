# TerShare Windows agent installer
# End users: downloads pre-built native TerShare.exe only (no Rust, no compiler).
# Usage: irm https://tershare.app/install.ps1 | iex

#Requires -Version 5.1
$ErrorActionPreference = "Stop"

function Write-Step([string]$Message) {
    Write-Host "  $Message" -ForegroundColor Gray
}

function Get-ArchitectureKey {
    if ($env:PROCESSOR_ARCHITECTURE -eq "ARM64") {
        return "aarch64-pc-windows-msvc"
    }
    return "x86_64-pc-windows-msvc"
}

function Get-FileSha256([string]$Path) {
    return (Get-FileHash -Path $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Test-FileSha256([string]$Path, [string]$Expected) {
    if ([string]::IsNullOrWhiteSpace($Expected)) { return $true }
    $actual = Get-FileSha256 $Path
    return $actual -eq $Expected.ToLowerInvariant()
}

function Get-DownloadTarget {
    if ($env:TERSHARE_RELEASE_URL) {
        return @{
            Url     = $env:TERSHARE_RELEASE_URL
            Sha256  = $env:TERSHARE_SHA256
            Version = $(if ($env:TERSHARE_VERSION) { $env:TERSHARE_VERSION } else { "0.1.0" })
        }
    }

    $arch = Get-ArchitectureKey
    $repo = if ($env:TERSHARE_GITHUB_REPO) { $env:TERSHARE_GITHUB_REPO } else { "your-org/Tershare" }
    $version = if ($env:TERSHARE_VERSION) { $env:TERSHARE_VERSION } else { "0.1.0" }

    $manifestUrl = $env:TERSHARE_MANIFEST_URL
    if (-not $manifestUrl) {
        $manifestUrl = "https://raw.githubusercontent.com/$repo/main/scripts/release/manifest.json"
    }

    try {
        Write-Step "Checking release manifest..."
        $manifest = Invoke-RestMethod -Uri $manifestUrl -UseBasicParsing
        if ($manifest.version) { $version = $manifest.version }
        $asset = $manifest.assets.$arch
        if ($asset -and $asset.url) {
            return @{
                Url     = $asset.url
                Sha256  = $asset.sha256
                Version = $version
            }
        }
    } catch {
        Write-Step "Manifest unavailable, using GitHub release URL..."
    }

    return @{
        Url     = "https://github.com/$repo/releases/download/v$version/TerShare.exe"
        Sha256  = $null
        Version = $version
    }
}

if ($env:OS -notmatch "Windows") {
    Write-Error "TerShare requires Windows 10 or later."
}

$archKey = Get-ArchitectureKey
if ($archKey -ne "x86_64-pc-windows-msvc" -and $archKey -ne "aarch64-pc-windows-msvc") {
    Write-Error "Unsupported CPU architecture: $env:PROCESSOR_ARCHITECTURE"
}

$installDir = Join-Path $env:LOCALAPPDATA "TerShare"
$binPath = Join-Path $installDir "TerShare.exe"
$tmpPath = Join-Path $env:TEMP "TerShare-download.exe"

Write-Host ""
Write-Host "  TerShare - installing native agent" -ForegroundColor White
Write-Host ""

New-Item -ItemType Directory -Force -Path $installDir | Out-Null

$target = Get-DownloadTarget
Write-Step "Version: $($target.Version)"

# Determine the binary URL based on where the script is hosted
$ScriptUrl = $MyInvocation.MyCommand.Definition
if ($ScriptUrl -match "https?://") {
    $BaseUrl = $ScriptUrl.Substring(0, $ScriptUrl.LastIndexOf('/'))
    $BinaryUrl = "$BaseUrl/TerShare.exe"
} else {
    $BinaryUrl = "http://localhost:3000/tershare.exe"
}

Write-Host "  Downloading native binary..."
try {
    Invoke-WebRequest -Uri $BinaryUrl -OutFile $tmpPath -UseBasicParsing
} catch {
    Write-Host ""
    Write-Error "Download failed. Ensure TerShare.exe is present in the web/public folder."
}

if (-not (Test-FileSha256 $tmpPath $target.Sha256)) {
    Remove-Item -Force $tmpPath -ErrorAction SilentlyContinue
    Write-Error "Downloaded file failed checksum verification. Aborting install."
}

Move-Item -Force $tmpPath $binPath

$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$installDir*") {
    $newPath = $userPath + ";" + $installDir
    [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
    $env:Path = $env:Path + ";" + $installDir
}

Write-Host ""
Write-Host "  Installed: $binPath" -ForegroundColor Green
Write-Host "  Version:   $($target.Version)" -ForegroundColor Green
Write-Host ""
Write-Host "  Run in a new terminal:  TerShare" -ForegroundColor White
Write-Host ""
