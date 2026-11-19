# Uni-PDV 3.2.4 — Licenciado por chave única (offline)

Esta edição do Uni-PDV Windows é separada da edição Livre 3.2.3.

## Instalação e ativação

1. O administrador guarda `CHAVES-UNI32-50-CONTROLE-PRIVADO.txt` **somente em seu computador**.
2. Durante a instalação `Uni-PDV-Licenciado-Setup-3.2.4-x64.exe`, o administrador informa **uma** chave UNI32 no instalador NSIS. Não é necessário enviar a chave ao cliente nem gerar qualquer arquivo adicional.
3. Ao abrir o aplicativo pela primeira vez, ele valida a chave entregue pelo instalador, registra uma ativação protegida pelo armazenamento seguro do Windows e elimina `install.key` (a cópia provisória legível da chave).
4. As próximas aberturas conferem a ativação localmente e **não pedem nova chave**. Uma reinstalação no mesmo perfil pode reutilizar o registro existente.
5. Se o código não tiver sido gravado na instalação, a tela de ativação permite que **o administrador** digite a chave original manualmente.

## Arquivos locais

- A edição licenciada utiliza `%APPDATA%\PDV-Loja-Licenciado` — separada da edição Livre `%APPDATA%\PDV-Loja`.
- `activation.local` guarda registro protegido com Electron `safeStorage` (DPAPI no Windows), hash da chave e identidade do computador. Não há chave em texto puro armazenada após a primeira execução bem-sucedida.
- As 50 chaves legíveis **não são incluídas no instalador**: somente hashes SHA-256 ficam dentro do aplicativo. O TXT administrativo é entregue em separado e deve permanecer privado. Os 50 códigos existem apenas no arquivo TXT administrativo, que deve permanecer privado.

## Controle das licenças

Use os campos `Cliente`, `Data`, `Computador` e `Situação` presentes no TXT para acompanhar a alocação de cada chave. Marque cada uma como `UTILIZADA` após a instalação. Faça backup do TXT privado.

**Limitação real do licenciamento 100% offline:** Não é possível impedir globalmente o uso da mesma chave em computadores diferentes se alguém obtiver uma cópia dela, pois não há servidor, comunicação nem um emissor que registre consumos. A ativação local está vinculada ao perfil e à instalação do Windows; copiar apenas `activation.local` para outra máquina não a ativa. Para impor uma ativação única global, é necessário algum registro externo ou emissão de licença por máquina.

A alteração do identificador do Windows ou do perfil do usuário poderá exigir nova ativação com a chave original.

## Compilar

```powershell
nvm use 24.22.1
npm install
npm run test:license
npm run test:integration
.\BUILD-WINDOWS-LICENCIADO-3.2.4.bat
```

Instalador esperado: `release\Uni-PDV-Licenciado-Setup-3.2.4-x64.exe`.

O Android, a porta HTTPS e as funcionalidades existentes não foram modificados.
