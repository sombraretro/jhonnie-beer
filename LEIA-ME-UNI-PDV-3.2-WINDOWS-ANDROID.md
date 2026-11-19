# Uni-PDV 3.2 — integração Windows + Android

## O que mudou

Este projeto atualiza o **Uni-PDV 3.1** enviado, utilizando os padrões organizacionais do NL Nail Designer e preservando os menus, temas, licença e banco de dados existentes do Uni-PDV.

### Windows
- Todos os menus anteriores permanecem (Início, Caixa, Vendas, Orçamentos, Agenda, Produtos, Kits/Combos, Clientes, Fornecedores, Estoque, Compras e Financeiro, Relatórios, Fiscal, Anotações, Backup, E-mails, Diagnóstico, Atividades, Ajuda e Configurações).
- Menus adicionais: **Análise de Estoque**, **Rentabilidade**, **Metas Financeiras** e **Compras** (visão de compras/despesas sem duplicar operações existentes).
- Configurações organizadas em seções, incluindo login Android e aparelhos vinculados (somente Administrador). Cores/temas originais preservados.
- Cadastro de produtos distingue **Produto físico** (estoque e preços normais) e **Serviço** (sem estoque; duração em minutos). Ambas as modalidades podem ser vendidas, inclusive juntas; kits/combos padrões podem consumir componentes físicos. Estoque de produtos por peso é preservado.
- NFC-e anterior permanece para vendas de mercadorias. **Não** emite NFC-e para venda com serviço ou kit com serviço: exige procedimento fiscal apropriado, como NFS-e ou regras aplicáveis.
- Indicadores de lucro são **estimados**: custos ausentes impedem apuração confiável, e não representam lucro contábil/fiscal. Metas não zeram durante a digitação.
- Integração HTTPS com fingerprint SHA-256, login Android individual e vínculo de um operador por dispositivo até liberação administrativa.

### Android (pasta mobile-expo)
- Interface inspirada no NL Mobile: cartões, navegação inferior, cabeçalho de conexão e áreas seguras do Android.
- Produtos, Serviços, Kits/Combos, Clientes, Vendas com carrinho misto, Caixa, Orçamentos, Histórico e Agenda mensal/diária.
- A ligação com o Windows usa TCP **17444**, não interfere com o NL na porta 17443.
- Operações dependem do **Windows aberto na mesma rede Wi-Fi privada**. Não sincroniza offline nem tem banco próprio de vendas.

## Compilação Windows

**Antes:** backup de `%APPDATA%\PDV-Loja` e de `C:\Temp\Projetos\Uni-PDV` (ou a pasta de código usada). O instalador conserva o sistema de licenciamento do pacote original.

Com Visual Studio 2026 (C++ instalado), Python 3, Node.js 24.22.1 e npm:

```powershell
cd C:\Temp\Projetos\Uni-PDV-3.2
nvm use 24.22.1
.\BUILD-WINDOWS-3.2.bat
```

O script reutiliza o gerador de chaves e o `electron-builder` originais. Instalador esperado: `release\Uni-PDV-Integrado-Setup-3.2.0-x64.exe`. Requer recompilação de `better-sqlite3` para Electron 37. Não use o Node 16 do projeto NL Legacy.

## Vincular Android

1. No Windows, entre como **Administrador**, acesse **Configurações > Integração Android** e configure login/senha Android de cada operador.
2. No topo do Windows, menu **Android > Ativar / mostrar conexão segura**; anote IP local, porta **17444** e fingerprint SHA-256.
3. Garanta Windows e aparelho no mesmo Wi-Fi e perfil de rede **Privado**. Se necessário, executar como administrador `LIBERAR-UNI-ANDROID-REDE-PRIVADA.bat` para abrir somente TCP 17444 no perfil Privado.
4. No app, configure o IP e cole o SHA-256 exibido no Windows. Faça login com as credenciais Android desse operador.
5. Se outro operador precisar usar esse celular, o Administrador deve abrir **Configurações > Integração Android > Liberar aparelho**. O logout normal não remove o vínculo, deliberadamente.

O APK é gerado em outro processo pelo Expo EAS. Veja `mobile-expo/README-UNI-PDV-MOBILE.md`.

## Testes e limitações

Os testes automatizados direcionados de autenticação, metas/indicadores, revogação de aparelho, consulta sem refresh em loop e idempotência de vendas foram executados via SQLite de teste. **A compilação nativa do instalador NSIS e do APK EAS, o Expo Doctor e a validação em celulares reais ainda precisam ser realizados no ambiente do usuário.**

Módulos de emissão de notas de serviço (NFS-e) não foram adicionados. Dados fiscais/sensíveis não são expostos pelo servidor móvel. Não expor a porta do servidor na internet.
