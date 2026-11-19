# Uni-PDV 3.0.2 — Temas, Relatórios e Atividades

Atualização de interface e auditoria do Uni-PDV.

## Correções de interface

- Todos os menus suspensos (`select`, `option` e `optgroup`) receberam contraste explícito para temas claros e escuros, inclusive em modais e janelas de configuração.
- Os títulos de grupos/assuntos da sidebar agora usam texto claro ou escuro conforme a cor real da barra lateral de cada tema.
- Os nomes comerciais dos temas foram generalizados, mantendo os mesmos IDs e paletas para preservar configurações existentes:
  - Café, Neve, Aço, Rubi, Ametista, Oceano, Céu, Floresta, Sol, Âmbar, Terra & Ouro, Vulcão, Marfim, Rosa, Carvão & Laranja, Ônix e Rainbow.
- O bloco de opções fiscais foi removido de Configurações. O módulo Fiscal dedicado continua sendo o local para configurações e operações fiscais.

## Relatórios

A tela Relatórios foi reorganizada com botões para:

- Resumo
- Vendas
- Caixa
- Produtos / Categorias
- Estoque
- Atividades

O filtro continua permitindo relatório diário ou mensal. PDF e Excel exportam o conjunto completo de informações do período.

Foram adicionados aos dados de relatório:

- abertura, fechamento e retiradas de caixa;
- vendas e destino (entrega/retirada);
- cadastros, edições, exclusões, restaurações e mudanças de categorias de produtos;
- entradas e saídas de estoque, incluindo ajustes e movimentos automáticos de vendas/cancelamentos;
- auditoria geral de atividades.

## Atividades

- Atividades podem ser filtradas por dia ou mês e por grupo.
- A visualização é separada por dia.
- Valores financeiros são armazenados em centavos internamente, mas exibidos ao operador em Reais (`R$`).
- Registros antigos que contenham texto no formato `N centavos` são normalizados para BRL na apresentação.

## Versão

- Aplicativo: 3.0.2
- Build Windows: `BUILD-WINDOWS-3.0.bat`
- Instalador esperado: `Uni-PDV-Setup-3.0.2-x64.exe`
