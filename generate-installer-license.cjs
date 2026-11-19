const fs=require('fs');
const path=require('path');
const crypto=require('crypto');

const root=path.resolve(__dirname,'..');
const keyFile=path.join(root,'CHAVES-INSTALACAO-UNI-PDV-3.1.txt');
const nsisOut=path.join(root,'build','installer-keys.nsh');
const jsOut=path.join(root,'electron','license-keys.generated.js');

function normalize(v){return String(v||'').trim().toUpperCase();}
if(!fs.existsSync(keyFile)){
  console.error('Arquivo de chaves não encontrado:',keyFile);
  process.exit(1);
}
const keys=fs.readFileSync(keyFile,'utf8')
  .split(/\r?\n/)
  .map(normalize)
  .filter(x=>x && !x.startsWith('#'));
const unique=[...new Set(keys)];
if(!unique.length){console.error('Nenhuma chave de instalação válida encontrada.');process.exit(1);}
if(unique.length!==keys.length){console.error('Existem chaves duplicadas no arquivo TXT.');process.exit(1);}
const format=/^UNI31-[A-Z2-9]{4}(?:-[A-Z2-9]{4}){3}$/;
const bad=unique.filter(k=>!format.test(k));
if(bad.length){console.error('Chaves com formato inválido:',bad.join(', '));process.exit(1);}

const nsis=[];
nsis.push('; Arquivo gerado automaticamente. Não editar manualmente.');
nsis.push('; Fonte: CHAVES-INSTALACAO-UNI-PDV-3.1.txt');
nsis.push('Function UniPDVCheckInstallKey');
nsis.push('  StrCpy $LicenseKeyValid "0"');
unique.forEach((k,i)=>{
  nsis.push(`  ${i===0?'${If}':'${ElseIf}'} $LicenseKey == "${k}"`);
  nsis.push('    StrCpy $LicenseKeyValid "1"');
});
nsis.push('  ${EndIf}');
nsis.push('FunctionEnd');
nsis.push('');
fs.mkdirSync(path.dirname(nsisOut),{recursive:true});
fs.writeFileSync(nsisOut,nsis.join('\r\n'),'utf8');

const hashes=unique.map(k=>crypto.createHash('sha256').update(k).digest('hex'));
const js=[
  "// Gerado automaticamente por scripts/generate-installer-license.cjs.",
  "// Contém somente hashes SHA-256 das chaves válidas.",
  `'use strict';`,
  `module.exports = ${JSON.stringify(hashes,null,2)};`,
  ''
].join('\n');
fs.writeFileSync(jsOut,js,'utf8');
console.log(`Licenciamento sincronizado: ${unique.length} chave(s).`);
console.log('NSIS:',nsisOut);
console.log('Runtime:',jsOut);
