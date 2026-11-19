@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo ================================================
echo Uni-PDV 3.1 - Sincronizar chaves de instalacao
 echo ================================================
call nvm use 24 || exit /b 1
node scripts\generate-installer-license.cjs || exit /b 1

echo.
echo Chaves sincronizadas com o instalador e com a validacao local do aplicativo.
echo Edite CHAVES-INSTALACAO-UNI-PDV-3.1.txt antes de executar este arquivo quando quiser trocar a lista.
exit /b 0
