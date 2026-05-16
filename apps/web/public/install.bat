<# :
@echo off
powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-Command -ScriptBlock ([ScriptBlock]::Create((Get-Content '%~f0' -Raw)))"
exit /b %errorlevel%
#>

$ErrorActionPreference = "Stop"
Clear-Host

# 1. BIG WHITE BOX LOGO
Write-Host ""
$box = @(
    "                                                    ",
    "      _______        _____ _                        ",
    "     |__   __|      / ____| |                       ",
    "        | | ___ _ __| (___ | |__   __ _ _ __ ___    ",
    "        | |/ _ \ '__\___ \| '_ \ / _` | '__/ _ \   ",
    "        | |  __/ |  ____) | | | | (_| | | |  __/   ",
    "        |_|\___|_| |_____/|_| |_|\__,_|_|  \___|   ",
    "                                                    ",
    "               Terminal Bridge System               ",
    "                                                    "
)
foreach ($line in $box) {
    Write-Host $line -BackgroundColor White -ForegroundColor Black
}
Write-Host ""

# 2. COLORED LOADING BAR FUNCTION
function Show-LoadingBar([string]$TaskName) {
    Write-Host "`n[*] $TaskName" -ForegroundColor Cyan
    $totalBlocks = 30
    for ($i = 1; $i -le $totalBlocks; $i++) {
        $percent = [math]::Round(($i / $totalBlocks) * 100)
        $bar = "█" * $i + " " * ($totalBlocks - $i)
        Write-Host "`r    [$bar] $percent% " -ForegroundColor Green -NoNewline
        Start-Sleep -Milliseconds 30
    }
    Write-Host " Done!" -ForegroundColor Yellow
}

Show-LoadingBar "Checking system compatibility..."
if ($env:OS -ne "Windows_NT") {
    Write-Host "`n[ERROR] TerShare requires Windows." -ForegroundColor Red
    exit 1
}

Show-LoadingBar "Creating installation directory..."
$InstallDir = "$env:LOCALAPPDATA\TerShare"
if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
}

Show-LoadingBar "Downloading native agent..."
$ExeUrl = "https://github.com/jagadishpenmetsa/Tershare/raw/main/apps/web/public/tershare.exe"
$ExePath = "$InstallDir\tershare.exe"

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
try {
    (New-Object System.Net.WebClient).DownloadFile($ExeUrl, $ExePath)
} catch {
    Write-Host "`n[ERROR] Download failed." -ForegroundColor Red
    exit 1
}

Show-LoadingBar "Setting up environment commands..."
$OldPath = [Environment]::GetEnvironmentVariable('Path', 'User')
if ($OldPath -notlike "*$InstallDir*") {
    [Environment]::SetEnvironmentVariable('Path', "$OldPath;$InstallDir", 'User')
}
$env:PATH = "$env:PATH;$InstallDir"

Write-Host "`n====================================================" -ForegroundColor Green
Write-Host "             INSTALLATION COMPLETE!                 " -ForegroundColor Green
Write-Host "====================================================" -ForegroundColor Green
Write-Host ""
Write-Host " > Just type '" -NoNewline
Write-Host "tershare" -ForegroundColor Cyan -NoNewline
Write-Host "' to start sharing!"
Write-Host ""
Write-Host " [Starting TerShare automatically...]" -ForegroundColor DarkGray
Write-Host ""

& "$InstallDir\tershare.exe" --help


pause
