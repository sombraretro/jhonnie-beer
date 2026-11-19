# Uni-PDV 3.2.3 — Padronização estrutural pelo NL Nail Designer

## O que mudou

- Removida **somente** a folha estrutural antiga "Layout Horizonte". As definições dos temas e paletas atuais do Uni-PDV permanecem preservadas.
- Incorporadas diretamente do NL as ferramentas de interface: favoritos, ações rápidas (Ctrl+K), central de pendências, preferências de visualização, atalhos Alt+1–5 e impressão da tela atual (Ctrl+Shift+P).
- Sidebar expandida/recolhida, cabeçalho, navegação, cartões, formulários, botões, tabelas, modais, espaçamentos e seções de configuração seguem a mesma hierarquia estrutural do NL.
- Início: aviso de caixa fechado e Painel Inteligente; os indicadores vêm dos dados do próprio Uni-PDV.
- Configurações: seções recolhíveis no padrão visual do NL e campos de integração Android preservados.
- Backup: botão Verificar último backup agora realiza verificação **real** e somente leitura da integridade SQLite e da identidade da instalação. A configuração de retenção passa a ser salva corretamente.
- **Sem alteração** na integração Android, banco SQLite, licença, NFC-e, estoque, operações de produtos/serviços, balança e demais regras de negócio.

## Instalar a fonte completa

1. Faça backup da pasta de projeto atual e do banco de dados (por exemplo, em `%APPDATA%\PDV-Loja`).
2. Extraia a fonte completa em uma pasta nova, sem copiar `node_modules` antigos.
3. Abra PowerShell na pasta que contém `package.json`.
4. Execute `nvm use 24.22.1` (ou uma versão Node suportada por Electron 37 + seu ambiente), `npm install`, `npm run test:integration`, `npm run build`.
5. Se tudo estiver correto, execute `npm run dist:win` ou o `BUILD-WINDOWS-3.2.3.bat`.
6. O instalador esperado é `release\Uni-PDV-Integrado-Setup-3.2.3-x64.exe`.

## Aplicar sobre uma instalação de fonte já existente

Extraia o ZIP de reparo e execute:

```bat
ATUALIZAR-UNI-PDV-DESIGN-NL-3.2.3.bat "C:\Temp\Projetos\Uni-PDV"
```

Substitua o exemplo pelo caminho **real** da pasta de código-fonte, não pela pasta do aplicativo já instalado. O atualizador cria uma cópia de cada arquivo substituído dentro de um diretório `backup-design-NL-323-*` no próprio projeto. Ele não acessa o banco.

## Verificação funcional recomendada no Windows

1. Teste a interface em pelo menos dois temas existentes e nos modos de sidebar expandida e recolhida.
2. Teste Início, Vendas, Produtos/Serviços, Kits/Combos, Clientes, Orçamentos e Agenda.
3. Confira Estoque, Análise, Rentabilidade, Metas Financeiras e Compras/Financeiro.
4. Confira abertura/fechamento do caixa, backup e a integração com Android na porta 17444.
5. Não utilize um banco de produção antes de confirmar visualmente os fluxos críticos no instalador compilado.

## Testes executados durante a preparação

- 3/3 testes de integração existentes aprovados.
- Sintaxe JavaScript de `electron/main.js` e `electron/preload.js` válida.
- Arquivos JSX verificados quanto à sintaxe com o parser TypeScript.
- Compilação Vite/Electron e inspeção visual **não executadas neste ambiente**, devido à ausência das dependências npm completas. Compilar e testar no Windows antes de considerar a versão final.
