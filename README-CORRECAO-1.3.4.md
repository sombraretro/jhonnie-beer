# PDV-Loja 1.3.4

Correções:
- Bloquear aplicativo agora funciona pelo menu Arquivo.
- Ctrl+Shift+L bloqueia o aplicativo e retorna à tela de login.
- F11 continua alternando tela cheia.
- Tela de login: logo centralizada dentro de um quadro fixo, com object-fit contain para não cortar nem distorcer a imagem.
- Tema salvo continua sendo aplicado à tela de login.

Para recriar o instalador no Windows:

    npm install
    npm run build
    npm run dist:win
