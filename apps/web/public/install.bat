@echo off
echo.
echo   TerShare - Installing Native Agent
echo   ----------------------------------
echo.

powershell -ExecutionPolicy Bypass -Command "irm https://tershare-web.vercel.app/install.ps1 | iex"

echo.
echo   Installation complete! 
echo   Please restart your terminal to start using 'tershare'.
echo.
pause
