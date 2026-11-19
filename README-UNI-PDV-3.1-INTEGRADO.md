# Uni-PDV 3.1 Integrado

Esta distribuição reúne no projeto Uni-PDV enviado as funcionalidades operacionais implementadas e validadas nas etapas dos projetos Casa do Boiadeiro e Casa das Velas Conde Do Mar. As alterações de licenciamento específicas daqueles projetos não foram incorporadas; a rotina de licenciamento já existente no Uni-PDV enviado foi preservada.

## Funcionalidades incorporadas

- **Backup e restauração reforçados:** rotina manual e automática compartilhada, manifesto de identidade, bloqueio de restauração cruzada quando a origem é conhecida, confirmação explícita para backups legados sem identidade, retenção limitada aos backups identificados desta instalação, registro de falhas e agendamento com recuperação quando o horário foi ultrapassado enquanto o aplicativo estava fechado.
- **Segurança e auditoria:** novas senhas com PBKDF2-HMAC-SHA256, salt aleatório e 210.000 iterações; compatibilidade com hashes SHA-256 legados com migração após login válido; comparação em tempo constante; política de senha nova de 8 a 256 caracteres; registro de eventos de autenticação e alterações de operadores/senhas.
- **Análise de estoque:** itens no mínimo/sem saldo, sem giro em 90 dias, possíveis excessos, valor estimado do estoque, cobertura estimada, sugestão de reposição e exportação CSV. Os indicadores são somente leitura e não alteram saldos.
- **Rentabilidade estimada:** indicadores diários/mensais e análise por produto/kit, excluindo vendas canceladas e sinalizando itens sem custo válido. Usa custo atualmente cadastrado; não representa lucro líquido.
- **Compras e financeiro:** lançamentos de compras/contas de fornecedor e despesas, vencimentos, categorias, observações, status, dados de pagamento, filtros e cancelamento lógico. Não movimenta estoque nem caixa automaticamente.
- **Diagnóstico:** integridade SQLite, violações de chaves estrangeiras, itens/pagamentos sem venda correspondente, lançamentos financeiros inválidos e último erro de backup; consultas somente de leitura.

## Banco de dados isolado

O banco desta versão é criado como `pdv-integrado-3.1.db` dentro da pasta de dados local do Uni-PDV (`%APPDATA%\PDV-Loja`). O banco antigo `pdv-loja.db` não é importado, renomeado nem alterado por esta versão. O identificador interno desta instalação é `br.unisoftwares.unipdv.integrado31`; os manifestos e as validações de backup usam esse identificador para reduzir o risco de misturar dados entre instalações.

A pasta local foi mantida para que o mecanismo de licença já existente continue funcionando sem alterações. O instalador usa um identificador/nome de produto próprios para facilitar testes separados. As chaves e o fluxo de licenciamento do Uni-PDV enviado foram preservados.

## Construção e validação no Windows

No ambiente de desenvolvimento Windows, na pasta extraída:

```powershell
npm install
npm run build
npm run dist:win
```

Nesta entrega foram executadas verificações de sintaxe JavaScript, análise sintática JSX/TypeScript, inspeção das rotas IPC e validação da integridade do ZIP. A compilação integral do Vite/Electron, os testes de execução do Electron e a geração do instalador não foram executados neste ambiente porque as dependências (`node_modules`) não estavam instaladas. Antes de uso real, teste com dados fictícios e confirme login, vendas, estoque, backup/restauração, NFC-e e instalação. O login inicial continua usando a credencial padrão já prevista no Uni-PDV; altere-a para uma senha exclusiva assim que entrar.
