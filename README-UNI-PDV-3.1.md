# Uni-PDV 3.1

Atualização baseada no Uni-PDV 3.0.4 com as correções de dropdowns temáticos e taxa de cartão preservadas.

## Licenciamento offline por chave

- O instalador exige uma chave Uni-PDV 3.1 em instalações que ainda não possuam uma licença local válida.
- A validação ocorre inteiramente no computador, sem consulta à internet.
- Foram geradas 50 chaves no arquivo `CHAVES-INSTALACAO-UNI-PDV-3.1.txt`.
- Ao digitar/colar uma chave válida, a própria tela do instalador a reconhece e habilita o avanço.
- A chave válida é gravada em `HKCU\Software\Uni Softwares\Uni-PDV` e em `%APPDATA%\PDV-Loja\install.key`.
- Atualizações futuras no mesmo perfil do Windows reconhecem a licença local e não precisam solicitar a chave novamente.
- O aplicativo empacotado também confere localmente a chave gravada antes de iniciar.
- Em desenvolvimento (`npm run dev`) a conferência de licença é ignorada para permitir manutenção do código.

### Gerenciamento das chaves

Você controla a lista. Para trocar, adicionar ou remover chaves:

1. Edite `CHAVES-INSTALACAO-UNI-PDV-3.1.txt`, mantendo uma chave por linha no formato `UNI31-XXXX-XXXX-XXXX-XXXX`.
2. Execute `ATUALIZAR-CHAVES-INSTALACAO.bat` ou `node scripts\generate-installer-license.cjs`.
3. Gere um novo instalador.

O gerador sincroniza automaticamente a lista usada pelo NSIS e os hashes usados pela validação local do aplicativo.

> Limitação inerente ao modelo offline: sem um servidor de ativação não há como controlar globalmente se uma mesma chave foi usada em mais de um computador. O mecanismo valida se a chave pertence à lista autorizada, mas não consulta nem registra uso em outros equipamentos.

## Interface

- Menu de operação reorganizado na ordem: **Início, Caixa, Vendas, Orçamentos e Agenda**.
- Esses cinco menus ficam sempre visíveis.
- Todos os demais menus da sidebar podem ser exibidos/ocultados em Configurações.
- Mesmo ocultando Configurações da sidebar, a engrenagem do topo continua abrindo a tela de configurações.
- Referência do operador removida do rodapé da sidebar.
- Operador no topo recebe destaque verde quando há operador selecionado.
- Status da balança só aparece no topo quando a balança está habilitada.
- Campo antigo **Operador padrão** removido das configurações.
- Botão de recolher/expandir sidebar recebeu área clicável real e prioridade de clique.
- Tema **Rainbow** passa a ser exibido como **Multicolorido**; o identificador interno foi mantido para preservar preferências existentes.
- Catálogo de ícones de categorias/subcategorias foi ampliado para atender comércio, alimentação, moda, tecnologia, saúde, pet, automotivo, serviços, indústria, construção, finanças e outros segmentos.

## Sobre

A janela **Sobre** usa a logomarca oficial da Uni Softwares fornecida pelo autor, no mesmo padrão visual aplicado ao projeto Alengo Espetinhos, com crédito a Rudnei Souza e versão 3.1.

## Build Windows x64

No Prompt de Comando:

```bat
cd /d C:\Temp\Uni-PDV-3.1
BUILD-WINDOWS-3.1.bat
```

O instalador esperado é:

`release\Uni-PDV-Setup-3.1-x64.exe`
