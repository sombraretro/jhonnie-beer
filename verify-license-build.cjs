'use strict';
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
for(const rel of ['electron/install-key-hashes.generated.cjs','electron/offline-license.cjs','electron/offline-license.html','build/installer.nsh','build/installer-keys.nsh']) {
 if(!fs.existsSync(path.join(root,rel)))throw Error('Arquivo de licença ausente: '+rel);
}
const hashes=require(path.join(root,'electron/install-key-hashes.generated.cjs'));
if(!Array.isArray(hashes)||hashes.length!==50||new Set(hashes).size!==50||hashes.some(x=>!/^[a-f0-9]{64}$/.test(x)))throw Error('Lista de 50 hashes inválida.');
const nsis=fs.readFileSync(path.join(root,'build/installer-keys.nsh'),'utf8');
if(/UNI32-[A-Z2-9]{4}(?:-[A-Z2-9]{4}){3}/.test(nsis))throw Error('Chaves legíveis foram incluídas no instalador.');
if(!nsis.includes('StrLen $0 $LicenseKey'))throw Error('Validação de formato ausente no NSIS.');
for(const privateFile of ['offline-license-private.pem','licensing-config.json','emissoes.json','CHAVES-UNI32-50-PRIVADO.txt']){
 if(fs.existsSync(path.join(root,privateFile)))throw Error('Arquivo administrativo não pode estar no projeto distribuível: '+privateFile);
}
const old=fs.readFileSync(path.join(root,'electron/offline-license.cjs'),'utf8');
if(old.includes('verifyToken')||old.includes('activation.updlicense'))throw Error('Código antigo de ativação por arquivo ainda presente.');
console.log('UNI32: 50 hashes autorizados no aplicativo; instalador sem chaves individuais; ativação offline por chave única.');
