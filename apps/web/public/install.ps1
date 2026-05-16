$ErrorActionPreference = "Stop"
Clear-Host

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
Write-Host "`n"

function Update-Progress($Percent, $Task) {
    $barLength = 20
    $filledLength = [math]::Round(($Percent / 100) * $barLength)
    $emptyLength = $barLength - $filledLength
    $bar = "█" * $filledLength + "░" * $emptyLength
    # Clean, minimal layout: Bar + Percentage + Task
    Write-Host "`r    $bar $Percent%  $Task".PadRight(70) -ForegroundColor Green -NoNewline
}

function Animate-Progress($StartPct, $EndPct, $Task) {
    $steps = $EndPct - $StartPct
    if ($steps -le 0) { return }
    $delay = 30
    for ($i = 0; $i -le $steps; $i++) {
        $pct = $StartPct + $i
        Update-Progress $pct $Task
        Start-Sleep -Milliseconds $delay
    }
}

Animate-Progress 0 15 "Checking system compatibility..."
if ($env:OS -ne "Windows_NT") {
    Write-Host "`n`n[ERROR] TerShare requires Windows." -ForegroundColor Red
    exit 1
}

Animate-Progress 15 35 "Creating installation directory..."
$InstallDir = "$env:LOCALAPPDATA\TerShare"
if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
}

Animate-Progress 35 60 "Downloading native agent..."
$ExeUrl = "https://tershare-web.vercel.app/tershare.exe?v=$([Guid]::NewGuid().ToString())"
$ExePath = "$InstallDir\tershare.exe"

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
try {
    (New-Object System.Net.WebClient).DownloadFile($ExeUrl, $ExePath)
} catch {
    Write-Host "`n`n[ERROR] Download failed." -ForegroundColor Red
    exit 1
}

Animate-Progress 60 85 "Setting up environment commands..."
$OldPath = [Environment]::GetEnvironmentVariable('Path', 'User')
if ($OldPath -notlike "*$InstallDir*") {
    [Environment]::SetEnvironmentVariable('Path', "$OldPath;$InstallDir", 'User')
}
$env:PATH = "$env:PATH;$InstallDir"

Animate-Progress 85 100 "Finishing up..."

Write-Host "`n`n  ========================================" -ForegroundColor Green
Write-Host "  [SUCCESS] TerShare is ready to use!" -ForegroundColor Green
Write-Host "  ========================================`n" -ForegroundColor Green

Write-Host "  > Starting TerShare automatically..." -ForegroundColor DarkGray
Write-Host ""

& "$InstallDir\tershare.exe" --help
