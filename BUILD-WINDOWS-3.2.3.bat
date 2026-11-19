@echo off
setlocal EnableExtensions
cd /d "%~dp0"
echo ======================================================
echo Uni-PDV 3.2.3 - Windows x64 e integracao Android
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
if not exist scripts\generate-installer-license.cjs goto :bad
echo.
echo [1/4] Instalando as dependencias do Windows...
call npm install
if errorlevel 1 goto :bad
echo.
echo [2/4] Gerando os arquivos de licenciamento do instalador...
node scripts\generate-installer-license.cjs
if errorlevel 1 goto :bad
echo.
echo [3/4] Preparando ambiente nativo C++...
call npm config delete msvs_version >nul 2>&1
set TrackFileAccess=false
set GYP_MSVS_VERSION=2026
echo.
echo [4/4] Compilando interface, modulos nativos e instalador NSIS...
call npm run dist:win
if errorlevel 1 goto :bad
echo.
echo CONCLUIDO. Instalador esperado em release\Uni-PDV-Integrado-Setup-3.2.3-x64.exe
exit /b 0
:bad
echo.
echo ERRO: build interrompido. Consulte a primeira mensagem de erro acima.
exit /b 1
