# Jhonnie Beer — personalização inicial

Esta ramificação prepara a personalização do Uni-PDV para a operação da Jhonnie Beer.

## Alterações nesta etapa

- Nome do aplicativo, janela principal, tela de login e instalador: **Jhonnie Beer**.
- A logo `Logo-Jhonnie-Beer.jpeg` passa a ser utilizada na interface.
- Janela Sobre sem menu superior, mantendo a identificação Uni Softwares / Uni-PDV e acrescentando Jhonnie Beer.
- Aplicativo inicia sem a tela e a validação de ativação offline.
- Arquivos e scripts de ativação removidos desta ramificação.
- Modo Compacto com painel de atalhos agrupados por área, incluindo os módulos existentes.
- Modo Completo preservado e selecionável em Configurações > Aparência e navegação.
- Tema Jhonnie Beer (grafite, preto, dourado e bronze) incluído e definido como padrão para instalações novas.
- Ícone de categoria para gelo adicionado à lista de ícones.
- Estrutura do Vite/Electron alinhada aos arquivos-fonte localizados na raiz do repositório.

## Compilação local

1. Instale as dependências com `npm install`.
2. Execute `npm run dev` para validar a interface.
3. Execute `npm run test:integration`.
4. Gere o instalador Windows com `npm run dist:win`.

## Pendências antes da distribuição

- Gerar um arquivo ICO a partir da logo Jhonnie Beer para substituir o ícone antigo do executável e dos atalhos do Windows.
- Executar build, testes de integração e teste de instalação/atualização em Windows.
- Revisar contraste dos demais temas em todas as telas e modais.
- Homologar a integração com Zé Delivery após a liberação das credenciais oficiais.
- Testar a Central de Notificações e o aviso sonoro com pedidos de homologação.

**Importante:** esta etapa não inclui ainda a integração com Zé Delivery nem altera o fluxo de pedidos. A integração será adicionada em etapa própria, depois de validarmos a base personalizada.
