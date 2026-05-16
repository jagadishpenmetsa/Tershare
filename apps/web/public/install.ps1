$ErrorActionPreference = "Stop"

Write-Host "  ============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "    _______        _____ _                    " -ForegroundColor Cyan
Write-Host "   |__   __|      / ____| |                   " -ForegroundColor Cyan
Write-Host "      | | ___ _ __| (___ | |__   __ _ _ __ ___ " -ForegroundColor Cyan
Write-Host "      | |/ _ \ '__\___ \| '_ \ / _` | '__/ _ \" -ForegroundColor Cyan
Write-Host "      | |  __/ |  ____) | | | | (_| | | |  __/" -ForegroundColor Cyan
Write-Host "      |_|\___|_| |_____/|_| |_|\__,_|_|  \___|" -ForegroundColor Cyan
Write-Host ""
Write-Host "                Terminal Bridge System"
Write-Host ""
Write-Host "  ============================================================" -ForegroundColor Cyan
Write-Host ""

# 1. OS CHECK
Write-Host "[1/4] Checking system compatibility..." -ForegroundColor Yellow
if ($env:OS -ne "Windows_NT") {
    Write-Host "[ERROR] TerShare requires Windows." -ForegroundColor Red
    exit 1
}

# 2. CREATE FOLDER
Write-Host "[2/4] Creating installation directory..." -ForegroundColor Yellow
$InstallDir = "$env:LOCALAPPDATA\TerShare"
if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
}

# 3. DOWNLOAD NATIVE CODE
Write-Host "[3/4] Downloading native agent (tershare.exe)..." -ForegroundColor Yellow
$ExeUrl = "https://tershare-web.vercel.app/tershare.exe?v=$([Guid]::NewGuid().ToString())"
$ExePath = "$InstallDir\tershare.exe"

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
try {
    (New-Object System.Net.WebClient).DownloadFile($ExeUrl, $ExePath)
} catch {
    Write-Host "[ERROR] Download failed. Please check your internet connection." -ForegroundColor Red
    exit 1
}

# 4. MAKE COMMAND 'tershare' WORK
Write-Host "[4/4] Setting up 'tershare' command..." -ForegroundColor Yellow

# Update User PATH persistently
$OldPath = [Environment]::GetEnvironmentVariable('Path', 'User')
if ($OldPath -notlike "*$InstallDir*") {
    [Environment]::SetEnvironmentVariable('Path', "$OldPath;$InstallDir", 'User')
}

# Update current session PATH so it works immediately
$env:PATH = "$env:PATH;$InstallDir"

Write-Host ""
Write-Host "  ========================================" -ForegroundColor Green
Write-Host "  [SUCCESS] TerShare is installed!" -ForegroundColor Green
Write-Host "  ========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  You can now type 'tershare' to start sharing."
Write-Host ""
Write-Host "  [INFO] Trying to start TerShare now..." -ForegroundColor Cyan
Write-Host ""

# Run it immediately
& "$InstallDir\tershare.exe" --help
