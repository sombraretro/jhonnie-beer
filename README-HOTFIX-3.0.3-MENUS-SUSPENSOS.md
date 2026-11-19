# Uni-PDV 3.0.3 — Menus suspensos

Correção focada na legibilidade dos menus suspensos nativos (`<select>`) no Windows/Chromium.

- Todos os `select` do sistema passam a definir `color-scheme` explicitamente.
- Temas claros (Neve e Rubi) usam popup claro com texto escuro.
- Todos os demais temas usam popup escuro com texto claro.
- `option` e `optgroup` usam as cores de sistema `Canvas`/`CanvasText`, que acompanham o `color-scheme`.
- A correção cobre os 47 menus suspensos atuais e também novos `select` adicionados futuramente dentro de `.app`.
- Mantidas todas as funções e correções da versão 3.0.2.

Instalador esperado: `Uni-PDV-Setup-3.0.3-x64.exe`.
