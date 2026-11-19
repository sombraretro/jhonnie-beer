# PDV-Loja 1.1.0

Alterações desta versão:
- Senha de operador: somente o operador com perfil **Proprietário** ou o **Administrador** pode alterar senhas; somente Administrador cadastra novos operadores e define/alterar perfil.
- O operador autenticado é automaticamente responsável pela venda e pela abertura do caixa; não há mais seletor de operador em Vendas/Abertura de Caixa.
- Perfil do operador: foto exibida ao lado do nome no cadastro e no sistema.
- Tema Marfim: correção de contraste em janelas/modais e Kits / Combos.
- Tema Céu: texto preto nos itens laterais selecionados e botões de destaque.
- Configuração fiscal retirada de Configurações e centralizada no Menu Fiscal.
- Novo Menu lateral **E-mails**, com SMTP, teste de conexão e envio simples com anexos PDF/JPG/JPEG/PNG/BMP/XML.
- Senha SMTP armazenada usando o armazenamento seguro do Windows quando disponível.
- Banco do PDV-Loja usa `pdv-loja.db`; na atualização, se existir apenas o banco legado `pdv-ouro.db` dentro da pasta do PDV-Loja, ele é renomeado automaticamente para preservar os dados da instalação anterior.

## Observação de build
Este pacote é código-fonte. Nesta sessão não foi possível concluir `npm install` dentro do tempo disponível, portanto não há afirmação de build/instalador `.exe` validado.
