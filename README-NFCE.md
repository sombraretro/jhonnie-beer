# PDV-Loja 1.1.2 — NFC-e São Paulo

Esta versão adiciona o módulo de NFC-e modelo 65 para São Paulo ao PDV-Loja.

## Implementado

- Configuração fiscal da empresa (CNPJ, IE, CRT, razão/fantasia, endereço e município IBGE).
- Ambiente de homologação e produção.
- Série e numeração NFC-e.
- Seleção de certificado digital A1 `.pfx` / `.p12`.
- Senha do A1 armazenada pelo Windows `safeStorage` do Electron, em vez de texto puro.
- Leitura/validação local do certificado e validade.
- Teste de comunicação com o WebService de status da SEFAZ-SP.
- CSC: ID e token.
- Geração da chave de acesso NFC-e modelo 65.
- XML 4.00.
- Assinatura XMLDSig envelopada com RSA-SHA1/SHA1 e certificado X.509 do A1.
- QR Code NFC-e e hash com CSC.
- QR Code específico para contingência offline (`tpEmis=9`).
- Autorização síncrona no `NFeAutorizacao4`.
- Armazenamento do XML enviado, resposta SEFAZ, protocolo e XML processado autorizado.
- DANFE NFC-e em PDF para impressão térmica/comum.
- Cancelamento por evento `110111` via `NFeRecepcaoEvento4`.
- Contingência offline e transmissão posterior das contingências pendentes.
- Histórico de eventos fiscais.
- Migração automática do banco existente; não remove o banco anterior.

## Dependências novas

- `node-forge`
- `xml-crypto`
- `@xmldom/xmldom`
- `qrcode`

## Configuração fiscal necessária

Antes da primeira emissão real, o estabelecimento precisa ter:

1. Credenciamento NFC-e na SEFAZ-SP.
2. CSC correspondente ao ambiente utilizado (homologação ou produção).
3. Certificado digital A1 válido.
4. CNPJ e IE configurados corretamente.
5. Produtos com NCM, CFOP, origem e CST/CSOSN preenchidos de acordo com a orientação fiscal do estabelecimento.
6. Testes de autorização em homologação.

A emissão em produção não é considerada validada até que uma NFC-e seja efetivamente autorizada pela SEFAZ-SP com o certificado e CSC do estabelecimento.

## Build no Windows

```powershell
npm install
npm run build
npm run dist:win
```

O instalador será gerado em `release\\PDV-Loja-Setup-1.2.3.exe`.

## Observação sobre a Reforma Tributária 2026

O módulo mantém os campos fiscais necessários para evolução do XML e foi estruturado para acompanhar as versões vigentes das Notas Técnicas NF-e/NFC-e. A matriz tributária de CBS/IBS deve ser parametrizada conforme o regime tributário e as regras efetivamente aplicáveis ao estabelecimento antes da produção.

## Controle financeiro — versão 1.1.2
- Menu **CAIXA** para abertura e fechamento diário.
- Valor inicial informado na abertura.
- Vendas realizadas enquanto houver caixa aberto são vinculadas automaticamente ao caixa.
- Fechamento apresenta valor inicial, itens vendidos e respectivos valores, total vendido e total somado à abertura.
- Menu **VENDAS** mantém o antigo PDV de vendas.
- Menu **RELATÓRIOS** com consultas diárias e mensais de vendas e fechamentos de caixa.
- Migração SQLite não destrutiva: a tabela de caixas e o vínculo das vendas são adicionados sem apagar dados existentes.


## Versão 1.1.2
Correção de integração entre a interface React e as funções de Caixa e Relatórios no preload do Electron.
