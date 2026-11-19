# Hotfix — taxa no cartão de crédito

Correção do fluxo de pagamento com cartão de crédito quando há taxa percentual manual.

## Problema corrigido
A interface somava a taxa do cartão ao valor final cobrado e, em seguida, comparava esse valor com o total-base da venda. Assim, uma venda de R$ 100,00 paga integralmente no cartão com 10% de taxa virava R$ 110,00 e era interpretada incorretamente como pagamento excedente, desabilitando **Confirmar venda**.

## Regra corrigida
- O valor-base distribuído entre os meios de pagamento é usado para validar se a venda foi quitada.
- A taxa do cartão é adicionada separadamente ao total cobrado.
- A taxa não é tratada como pagamento excedente nem como troco.
- Pagamentos combinados continuam válidos.
- Venda a prazo continua exigindo cliente quando houver saldo devedor.
- Dinheiro continua permitindo troco somente nas regras já existentes.
- O resumo do pagamento passa a exibir **Taxas do cartão** e **Total com taxas** quando houver taxa.

## Exemplos validados
- R$ 100,00 no cartão + 10%: confirma normalmente; total com taxa R$ 110,00.
- R$ 50,00 no cartão + 10% e R$ 50,00 no PIX: confirma normalmente; total com taxa R$ 105,00.
- R$ 95,00 no cartão + 10% sem venda a prazo: continua bloqueado por faltar R$ 5,00 do valor-base.
- Venda parcialmente a prazo: continua exigindo cliente cadastrado.
- R$ 120,00 em dinheiro para venda de R$ 100,00: continua gerando R$ 20,00 de troco.

O cálculo persistido no backend já separava corretamente valor-base e taxa; o defeito estava na validação da tela de pagamento e foi corrigido.
