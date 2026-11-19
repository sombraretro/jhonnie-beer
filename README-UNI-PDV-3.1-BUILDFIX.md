# Uni-PDV 3.1 — correção do build NSIS

Correções deste pacote:

- Protege o código de licenciamento offline com `!ifndef BUILD_UNINSTALLER`, porque o electron-builder compila primeiro um desinstalador temporário. Isso evita o warning NSIS 6010 (`UniPDVLicensePageCreate not referenced`) tratado como erro.
- Mantém a página de chave no instalador assistido e a gravação local da licença.
- Substitui dois ícones Lucide indisponíveis na versão instalada (`Handbag` e `ClipboardClock`) por equivalentes compatíveis (`ShoppingBag` e `CalendarClock`).
- Preserva as 50 chaves, o sistema offline, banco, recursos e versão 3.1.0.

Build:

```bat
cd /d C:\Temp\Uni-PDV-3.1
BUILD-WINDOWS-3.1.bat
```

Saída esperada: `release\Uni-PDV-Setup-3.1-x64.exe`.
