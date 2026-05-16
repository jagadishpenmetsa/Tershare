@echo off
setlocal enabledelayedexpansion
title TerShare Installer

echo   ============================================================
echo.
echo     _______        _____ _                    
echo    ^|__   __^|      / ____^| ^|                   
echo       ^| ^| ___ _ __^| (___ ^| ^|__   __ _ _ __ ___ 
echo       ^| ^|/ _ \ '__^\___ \^| '_ \ / _` ^| '__/ _ \
echo       ^| ^|  __/ ^|  ____) ^| ^| ^| ^| (_^| ^| ^| ^|  __/
echo       ^|_^|\___^|_^| ^|_____/^|_^| ^|_^|\__,_^|_^|  \___^|
echo.
echo                 Terminal Bridge System
echo.
echo   ============================================================
echo.

:: 1. OS CHECK
echo [1/4] Checking system compatibility...
if "%OS%" neq "Windows_NT" (
    echo [ERROR] TerShare requires Windows.
    pause
    exit /b 1
)

:: 2. CREATE FOLDER
echo [2/4] Creating installation directory...
set "INSTALL_DIR=%LOCALAPPDATA%\TerShare"
if not exist "%INSTALL_DIR%" (
    mkdir "%INSTALL_DIR%"
)

:: 3. DOWNLOAD NATIVE CODE
echo [3/4] Downloading native agent (tershare.exe)...
set "EXE_URL=https://github.com/jagadishpenmetsa/Tershare/raw/main/apps/web/public/tershare_v016.exe"
set "EXE_PATH=%INSTALL_DIR%\tershare.exe"

powershell -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object System.Net.WebClient).DownloadFile('%EXE_URL%', '%EXE_PATH%')"

if %errorlevel% neq 0 (
    echo [ERROR] Download failed. Please check your internet connection.
    pause
    exit /b 1
)

:: 4. MAKE COMMAND 'tershare' WORK
echo [4/4] Setting up 'tershare' command...

:: Update User PATH persistently
powershell -ExecutionPolicy Bypass -Command "$oldPath = [Environment]::GetEnvironmentVariable('Path', 'User'); if ($oldPath -notlike '*%INSTALL_DIR%*') { [Environment]::SetEnvironmentVariable('Path', $oldPath + ';%INSTALL_DIR%', 'User') }"

:: Update current session PATH so it works immediately
set "PATH=%PATH%;%INSTALL_DIR%"

echo.
echo   ========================================
echo   [SUCCESS] TerShare is installed!
echo   ========================================
echo.
echo   You can now type 'tershare' to start sharing.
echo.
echo   [INFO] Trying to start TerShare now...
echo.

:: Run it immediately
tershare --help

pause
