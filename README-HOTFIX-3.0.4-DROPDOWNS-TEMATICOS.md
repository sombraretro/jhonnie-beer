# Uni-PDV 3.0.4 — Dropdowns temáticos

Correção definitiva dos menus suspensos em janelas, modais e submenus.

## Alteração principal
Os controles nativos `<select>` foram substituídos visualmente por um componente de dropdown próprio do Uni-PDV. O popup nativo do Windows/Chromium não respeita de forma consistente cores de fundo e texto em todas as combinações de tema, especialmente dentro de modais.

A versão 3.0.4 aplica o mesmo componente a todos os 47 menus suspensos existentes no aplicativo, incluindo Produtos, Categorias/Subcategorias, Clientes, Fornecedores, Kits/Combos, Agenda, Caixa, Backup, Configurações, Balança e demais telas.

## Comportamento
- tema escuro: fundo escuro e texto claro;
- tema claro: fundo claro e texto escuro;
- seleção destacada pela cor de destaque do tema;
- listas longas possuem rolagem própria;
- suporte a grupos de opções (optgroup);
- suporte a controles desabilitados;
- navegação por teclado com setas, Enter/Espaço e Esc;
- o popup é renderizado acima dos modais e não fica cortado por containers com rolagem.

Nenhuma estrutura do banco de dados foi alterada.
