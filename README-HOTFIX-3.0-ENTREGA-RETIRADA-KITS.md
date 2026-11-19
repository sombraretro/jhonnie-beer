# Uni-PDV 3.0 — Hotfix Entrega / Retirada / Kits

Alterações aplicadas sobre a versão `Uni-PDV-3.0-Final-Source`.

## 1. Destino da compra no ato da venda
- Antes do pagamento, o operador escolhe **Retirada na loja** ou **Entrega ao cliente**.
- Venda marcada para entrega exige cliente selecionado.
- O destino é gravado na venda e exibido em **Vendas**, no relatório diário e no cupom.
- O agendamento da entrega continua disponível na Agenda; o tipo operacional (loja/app) pode ser definido ali.

## 2. Retirada / sangria de caixa
- Novo botão **Registrar retirada** no menu Caixa, disponível com caixa aberto.
- Valor e motivo são obrigatórios.
- Registra caixa, operador, horário e motivo.
- A retirada não pode exceder o saldo estimado do caixa.
- O fechamento passa a considerar: **valor inicial + vendas - retiradas**.
- Retiradas aparecem na interface de Relatórios e nas exportações PDF e Excel.

## 3. Exclusão de Kits / Combos
- Novo botão **Excluir** no cadastro de Kits / Combos.
- A exclusão é lógica (`active=0`), preservando vendas históricas.
- A exclusão é bloqueada quando o Kit / Combo está em orçamento com status **ABERTO**.

## Arquivos funcionais alterados
- `electron/main.js`
- `electron/preload.js`
- `src/main.jsx`

## Validação realizada
- `node --check electron/main.js`
- `node --check electron/preload.js`
- análise sintática JSX sem erros

Use o processo de build Windows 3.0 já existente neste projeto (`BUILD-WINDOWS-3.0.bat` ou os scripts do `package.json`).
