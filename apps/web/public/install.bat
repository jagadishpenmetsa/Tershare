@echo off
setlocal enabledelayedexpansion
title TerShare Installer

echo/
echo ========================================
echo        TerShare Terminal Bridge
echo ========================================
echo/

:: 1. OS CHECK
echo [+] Checking system compatibility...
if "%OS%" neq "Windows_NT" (
    echo [ERROR] TerShare requires Windows.
    pause
    exit /b 1
)

:: 2. CREATE FOLDER
echo [+] Creating installation directory...
set "INSTALL_DIR=%LOCALAPPDATA%\TerShare"
if not exist "%INSTALL_DIR%" (
    mkdir "%INSTALL_DIR%"
)

:: 3. DOWNLOAD NATIVE CODE
echo [+] Downloading native agent...
set "EXE_URL=https://github.com/jagadishpenmetsa/Tershare/raw/main/apps/web/public/tershare_v016.exe"
set "EXE_PATH=%INSTALL_DIR%\tershare.exe"

powershell -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object System.Net.WebClient).DownloadFile('%EXE_URL%', '%EXE_PATH%')"

if %errorlevel% neq 0 (
    echo [ERROR] Download failed. Please check your internet connection.
    pause
    exit /b 1
)

:: 4. MAKE COMMAND 'tershare' WORK
echo [+] Setting up commands...

:: Update User PATH persistently
powershell -ExecutionPolicy Bypass -Command "$oldPath = [Environment]::GetEnvironmentVariable('Path', 'User'); if ($oldPath -notlike '*%INSTALL_DIR%*') { [Environment]::SetEnvironmentVariable('Path', $oldPath + ';%INSTALL_DIR%', 'User') }"

:: Update current session PATH so it works immediately
set "PATH=%PATH%;%INSTALL_DIR%"

echo/
echo ========================================
echo           INSTALLATION SUCCESS
echo ========================================
echo/
echo ^> Just type 'tershare' to start sharing.
echo/
echo [Starting TerShare automatically...]
echo/

:: Run it immediately
tershare --help

pause
