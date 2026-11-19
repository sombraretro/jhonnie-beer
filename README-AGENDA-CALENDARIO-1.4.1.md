# PDV-Loja 1.4.1 — Agenda em calendário

Alteração concentrada no Menu Agenda, preservando as demais funções da versão 1.4.0.

- Agenda unificada em calendário mensal com dias clicáveis.
- Pagamentos à esquerda e serviços à direita.
- Agendamentos do dia em ordem crescente, com rolagem interna limitada.
- Inclusão de serviço ou pagamento a partir do dia escolhido.
- Seleção de cliente, horário, alerta e observações.
- Pagamentos vencidos permanecem como pendência/notificação até confirmação manual.
- Serviços não confirmados de dias anteriores são marcados automaticamente como NÃO COMPARECEU na próxima verificação/abertura do sistema.
- Confirmações manuais de comparecimento, ausência e pagamento foram mantidas.
- Relatórios existentes continuam usando a mesma tabela de agendamentos.

Observação: o build do frontend deve ser executado no Windows após `npm install`. O projeto continua usando `better-sqlite3`, portanto o empacotamento pode exigir Visual Studio Build Tools C++ conforme a configuração do ambiente.
