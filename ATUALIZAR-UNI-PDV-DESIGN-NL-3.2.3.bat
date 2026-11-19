@echo off
setlocal EnableExtensions EnableDelayedExpansion
set "ORIGEM=%~dp0ARQUIVOS"
if "%~1"=="" (
    set /p "DESTINO=Informe o caminho da pasta do codigo-fonte Uni-PDV: "
) else (
    set "DESTINO=%~1"
)
if not exist "%DESTINO%\package.json" (
    echo ERRO: package.json nao encontrado em "%DESTINO%".
    exit /b 1
)
findstr /C:"uni-pdv-integrado" "%DESTINO%\package.json" >nul 2>&1
if errorlevel 1 (
    echo ERRO: pasta nao identificada como o Uni-PDV Integrado.
    exit /b 1
)
set "BACKUP=%DESTINO%\backup-design-NL-323-%RANDOM%-%RANDOM%"
mkdir "%BACKUP%\src" "%BACKUP%\electron" >nul 2>&1
if errorlevel 1 (
    echo ERRO: nao foi possivel criar a pasta de backup.
    exit /b 1
)
echo ===========================================================
echo Uni-PDV 3.2.3 - Espelho estrutural do NL Nail Designer
echo ===========================================================
echo Projeto: "%DESTINO%"
echo Backup: "%BACKUP%"
for %%F in (main.jsx uni-management.jsx uni-management.css nl-layout-polish.css workspace-tools.jsx workspace-tools.css) do (
    if exist "%DESTINO%\src\%%F" copy /y "%DESTINO%\src\%%F" "%BACKUP%\src\%%F" >nul
    copy /y "%ORIGEM%\src\%%F" "%DESTINO%\src\%%F" >nul
    if errorlevel 1 goto :erro
)
for %%F in (main.js preload.js) do (
    if exist "%DESTINO%\electron\%%F" copy /y "%DESTINO%\electron\%%F" "%BACKUP%\electron\%%F" >nul
    copy /y "%ORIGEM%\electron\%%F" "%DESTINO%\electron\%%F" >nul
    if errorlevel 1 goto :erro
)
for %%F in (package.json package-lock.json BUILD-WINDOWS-3.2.bat BUILD-WINDOWS-3.2.3.bat) do (
    if exist "%DESTINO%\%%F" copy /y "%DESTINO%\%%F" "%BACKUP%\%%F" >nul
    copy /y "%ORIGEM%\%%F" "%DESTINO%\%%F" >nul
    if errorlevel 1 goto :erro
)
echo.
echo Atualizacao da fonte aplicada. Nenhum banco de dados foi alterado.
echo Proximos comandos, na pasta do projeto:
echo   npm install
echo   npm run test:integration
echo   npm run build
echo   .\BUILD-WINDOWS-3.2.3.bat
exit /b 0
:erro
echo ERRO: copia interrompida. Arquivos anteriores estao em "%BACKUP%".
exit /b 1
