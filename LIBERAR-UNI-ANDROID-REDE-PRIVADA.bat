@echo off
setlocal EnableExtensions
net session >nul 2>&1
if errorlevel 1 (
  echo Execute como Administrador somente se necessario.
  exit /b 1
)
netsh advfirewall firewall add rule name="Uni-PDV Android - LAN HTTPS 17444" dir=in action=allow protocol=TCP localport=17444 profile=private
if errorlevel 1 exit /b 1
echo Porta 17444 liberada somente para perfil Privado.
exit /b 0
