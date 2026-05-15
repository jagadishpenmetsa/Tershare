# Maintainer-only: compile the Rust agent into a native Windows executable.
# End users never run this — they use install.ps1 which downloads tershare.exe.

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
$AgentDir = Join-Path $Root "apps\agent"
$DistDir = Join-Path $Root "dist"
$OutExe = Join-Path $DistDir "tershare.exe"

if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
    Write-Error "Rust toolchain required for maintainers only. Install from https://rustup.rs"
}

Write-Host "Building TerShare native agent (release)..." -ForegroundColor White
Push-Location $AgentDir
try {
    cargo build --release
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
    Pop-Location
}

if (-not (Test-Path $DistDir)) {
    New-Item -ItemType Directory -Path $DistDir | Out-Null
}

$Built = Join-Path $AgentDir "target\release\tershare.exe"
Copy-Item -Force $Built $OutExe

$hash = (Get-FileHash -Path $OutExe -Algorithm SHA256).Hash.ToLowerInvariant()
Write-Host ""
Write-Host "  Built: $OutExe" -ForegroundColor Green
Write-Host "  SHA256: $hash" -ForegroundColor Gray
Write-Host ""
Write-Host "  Next: move dist\tershare.exe to apps\web\public\ and deploy." -ForegroundColor Gray
Write-Host ""

# Write checksum sidecar
$TargetFileName = "tershare.exe.sha256"
$HashPath = Join-Path -Path $DistDir -ChildPath $TargetFileName
$hash | Set-Content -Path $HashPath -NoNewline
