# Jhonnie Beer — personalização e preparação de distribuição

Esta ramificação mantém a personalização do Uni-PDV para a operação da Jhonnie Beer.

## Identidade do aplicativo

- Nome do aplicativo, janela principal, tela de login e instalador: **Jhonnie Beer**.
- Logo `Logo-Jhonnie-Beer.jpeg` utilizada na interface.
- Janela Sobre sem menu superior, mantendo a identificação Uni Softwares / Uni-PDV e acrescentando Jhonnie Beer.
- Aplicativo inicia sem a tela e a validação de ativação offline.
- Arquivos e scripts de ativação removidos desta ramificação.
- Modo Compacto com painel de atalhos agrupados por área, incluindo os módulos existentes.
- Modo Completo preservado e selecionável em Configurações > Aparência e navegação.
- Tema Jhonnie Beer (grafite, preto, dourado e bronze) definido como padrão para instalações novas.
- Ícone de categoria para gelo adicionado à lista de ícones.

## Melhorias desta revisão

- Versão do aplicativo atualizada para **3.2.7**.
- Ícone Windows `icon.ico` regenerado a partir da logo oficial da Jhonnie Beer, com múltiplas resoluções.
- Gerador reproduzível em `tools/generate-icon.py`.
- Pipeline Windows atualizado para usar o mesmo gerador, executar os testes de integração, compilar a interface e produzir o instalador NSIS como artefato do GitHub Actions.
- A Central de Notificações existente foi preservada. Ela reúne alertas de estoque mínimo, compromissos pendentes, orçamentos em aberto, vendas sem NFC-e e falhas de comunicação da balança.
- Os alertas sonoros já existentes foram preservados, incluindo o aviso de agenda e o som de confirmação de venda.

## Integração com Zé Delivery

Foi criada uma seção própria **Zé Delivery** no menu Integrações, separada da Central de Notificações, com abas de Visão geral, Configurações, Pedidos e Produtos. As preferências locais incluem identificação da loja, ambiente pretendido, modalidade padrão, aceite manual/automático futuro, alerta sonoro, sincronização de catálogo e observações.

A seção já pode ser aberta e suas preferências salvas sem credenciais. Pedidos e catálogo exibem estados vazios explícitos, sem dados fictícios. Client ID, Client Secret, tokens e chaves não são solicitados nem gravados em texto simples nesta etapa.

A comunicação real ainda depende das credenciais oficiais e da documentação técnica/contratual aplicável à conta da Jhonnie Beer. Sem isso, não é possível implementar de forma confiável autenticação, endpoints, webhooks, estados de pedido, cancelamentos, catálogo ou regras de aceite. Quando os dados oficiais forem disponibilizados, esses componentes deverão ser implementados e homologados antes de habilitar operações em produção. O fluxo atual de vendas não foi alterado por uma integração especulativa.

## Verificações

No ambiente de preparação desta revisão:

- `node --no-warnings --test uni-3.2.test.cjs`: **3 testes aprovados**.
- `npm run build`: não concluído neste ambiente; o executável local do Vite retornou `Permission denied` após a tentativa de instalação de dependências.
- Instalador Windows: não gerado localmente. O workflow `.github/workflows/jhonnie-beer-windows.yml` está configurado para gerar e disponibilizar o instalador em runner Windows do GitHub Actions.

## Compilação local no Windows

1. Instale Node.js 22 e Python 3.12.
2. Execute `npm ci`.
3. Execute `python tools/generate-icon.py`.
4. Execute `npm run dev` para validar a interface.
5. Execute `npm run test:integration`.
6. Execute `npm run dist:win`.

O instalador é produzido em `release/` com o nome `Jhonnie-Beer-Setup-3.2.7-x64.exe`.

**Importante:** antes de distribuir a versão, ainda é necessário concluir o teste visual de contraste em todas as telas/modais e executar o teste de instalação/atualização em Windows. A homologação do Zé Delivery depende das credenciais e documentação oficiais.
