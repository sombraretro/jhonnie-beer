@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo ================================================
echo Uni-PDV 3.1 - Build Windows x64
echo ================================================

call nvm use 24 || exit /b 1
node scripts\generate-installer-license.cjs || exit /b 1
call npm install || exit /b 1
call npm config delete msvs_version >nul 2>&1
set TrackFileAccess=false
set GYP_MSVS_VERSION=2026
call npm run dist:win || exit /b 1

echo.
echo CONCLUIDO. Verifique a pasta release.
echo Instalador esperado: Uni-PDV-Setup-3.1-x64.exe
exit /b 0
