# PDV-Loja 1.4.5 — correções consolidadas

Base: PDV-Loja 1.4.4 Agenda/Clientes.

## Alterações
- Correção da criação de orçamentos (15 colunas / 15 valores).
- Status de orçamento: ABERTO, CONVERTIDO e INSUCESSO.
- Conversão de orçamento em venda, com vínculo `quote_id` e mudança para CONVERTIDO somente após a venda concluir.
- Orçamentos convertidos não podem ser excluídos ou reabertos indevidamente.
- PDF de orçamento e relatórios gerados diretamente com PDFKit, sem janela auxiliar do Chromium.
- Impressão A4 de orçamento pelo renderer principal do aplicativo.
- Exportação Excel preservada.
- Agenda: confirmação de recebimento baixa somente o valor agendado, preservando outras dívidas do cliente.
- Edição de recebimento agendado preserva o valor original do agendamento.
- Agenda exibe valor recebido após a conclusão e informa saldo restante quando existir.
- Categorias/subcategorias: confirmação de exclusão em modal React, evitando travamentos de foco.
- Adicionar Vários preservado.
- Tema Rainbow adicionado, com fundos pretos e interface multicolorida.
- Tela Sobre atualizada para a versão 1.4.5.
- `pdfkit@0.14.0` incluído nas dependências.
- `node-gyp@12.1.0` incluído nas dependências de desenvolvimento para Visual Studio 2026.

## Build recomendado
No PowerShell, com Node 24:

```powershell
nvm use 24
npm install
npm config delete msvs_version
$env:TrackFileAccess="false"
$env:GYP_MSVS_VERSION="2026"
npm run dist:win
```

Não execute `npm audit fix --force`.
