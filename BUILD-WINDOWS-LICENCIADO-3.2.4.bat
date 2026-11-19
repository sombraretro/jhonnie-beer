@echo off
setlocal EnableExtensions
cd /d "%~dp0"
echo ======================================================
echo Uni-PDV 3.2.4 LICENCIADO - Chave unica offline - x64
 echo ======================================================
where nvm >nul 2>&1
if %errorlevel%==0 (
  call nvm use 24.22.1
  if errorlevel 1 exit /b 1
)
node --version
if errorlevel 1 goto :bad
call npm --version
if errorlevel 1 goto :bad
if not exist package.json goto :bad
if not exist scripts\verify-license-build.cjs goto :bad
echo.
echo [1/4] Instalando dependencias Windows...
call npm install
if errorlevel 1 goto :bad
echo.
echo [2/4] Validando as 50 chaves do instalador...
node scripts\verify-license-build.cjs
if errorlevel 1 goto :bad
echo.
echo [3/4] Preparando compilador nativo C++...
call npm config delete msvs_version >nul 2>&1
set TrackFileAccess=false
set GYP_MSVS_VERSION=2026
echo.
echo [4/4] Compilando Vite, Electron e NSIS...
call npm run dist:win
if errorlevel 1 goto :bad
echo.
echo CONCLUIDO: release\Uni-PDV-Licenciado-Setup-3.2.4-x64.exe
exit /b 0
:bad
echo ERRO: build interrompido. Consulte a primeira falha acima.
exit /b 1
