# Uni-PDV 3.0.1 — Hotfix de inicialização / Backup

Correção aplicada após teste do instalador do Uni-PDV 3.0.

## Erro corrigido

Na inicialização, a tela principal podia falhar com:

`Backup is not defined`

A navegação já continha a página `backup:<Backup .../>`, mas o componente React `Backup` não estava definido em `src/main.jsx`.

## Correção

- Restaurado o componente `Backup` do Uni-PDV.
- Mantidos backup manual, restauração e agendamento automático diário/semanal/mensal.
- Caminho informado na interface: `Documentos → Uni-PDV → Backups`.
- Mantidas as alterações do hotfix anterior: Entrega/Retirada na venda, retirada de dinheiro do caixa com motivo e exclusão de Kits/Combos.
