# Maintainer: refresh scripts/release/manifest.json after building dist/tershare.exe
$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
$Exe = Join-Path $Root "dist\tershare.exe"
$Manifest = Join-Path $Root "scripts\release\manifest.json"
$Version = if ($env:TERSHARE_VERSION) { $env:TERSHARE_VERSION } else { "0.1.0" }
$Repo = if ($env:TERSHARE_GITHUB_REPO) { $env:TERSHARE_GITHUB_REPO } else { "your-org/Tershare" }

if (-not (Test-Path $Exe)) {
    Write-Error "Run scripts\build-agent.ps1 first to produce dist\tershare.exe"
}

$hash = (Get-FileHash $Exe -Algorithm SHA256).Hash.ToLowerInvariant()
$url = "https://github.com/$Repo/releases/download/v$Version/tershare.exe"

$obj = @{
    version = $Version
    assets  = @{
        "x86_64-pc-windows-msvc" = @{ url = $url; sha256 = $hash }
        "aarch64-pc-windows-msvc" = @{ url = $url; sha256 = $hash }
    }
} | ConvertTo-Json -Depth 5

$obj | Set-Content $Manifest -Encoding UTF8
Write-Host "Updated $Manifest (sha256: $hash)"
