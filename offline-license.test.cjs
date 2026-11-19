'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
// Usamos uma chave artificial apenas no processo de testes; nenhuma chave real
// das 50 autorizadas e inserida nos arquivos de codigo-fonte distribuiveis.
const serial='UNI32-TEST-TEST-TEST-TEST';
const hashesPath=require.resolve('../electron/install-key-hashes.generated.cjs');
const realHashes=require(hashesPath);
require.cache[hashesPath].exports=[...realHashes,crypto.createHash('sha256').update(serial).digest('hex')];
const lic=require('../electron/offline-license.cjs');
function safeStorageMock(secret='usuario-original'){
 const key=crypto.createHash('sha256').update(secret).digest();
 return {
  isEncryptionAvailable:()=>true,
  encryptString:value=>{
   const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv);
   const data=Buffer.concat([cipher.update(String(value),'utf8'),cipher.final()]);
   return Buffer.concat([iv,cipher.getAuthTag(),data]);
  },
  decryptString:value=>{
   const data=Buffer.from(value),cipher=crypto.createDecipheriv('aes-256-gcm',key,data.subarray(0,12));
   cipher.setAuthTag(data.subarray(12,28));
   return Buffer.concat([cipher.update(data.subarray(28)),cipher.final()]).toString('utf8');
  }
 };
}
function withDir(fn){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'uni32-keyonly-'));try{fn(dir)}finally{fs.rmSync(dir,{recursive:true,force:true})}}
test('only approved keys UNI32 are accepted',()=>{
 assert.equal(lic.serialAllowed(serial),true);
 assert.equal(lic.serialAllowed('uni32-test-test-test-test'),true);
 assert.equal(lic.serialAllowed('UNI31-TEST-TEST-TEST-TEST'),false);
 assert.equal(lic.serialAllowed('UNI32-AAAA-AAAA-AAAA-AAAA'),false);
});
test('installer key automatically activates on first run and plaintext key is removed',()=>withDir(dir=>{
 const safe=safeStorageMock();
 fs.writeFileSync(lic.paths(dir).pending,serial+'\n');
 assert.equal(lic.status(dir,'PC-A',safe).valid,false);
 const activation=lic.autoActivate(dir,'PC-A',safe);
 assert.equal(activation.valid,true);
 assert.equal(activation.maskedSerial,'UNI32-****-****-****-TEST');
 assert.equal(fs.existsSync(lic.paths(dir).pending),false);
 assert.equal(fs.existsSync(lic.paths(dir).receipt),true);
 assert.equal(fs.readFileSync(lic.paths(dir).receipt,'utf8').includes(serial),false);
 assert.equal(lic.status(dir,'PC-A',safe).valid,true);
 assert.equal(lic.autoActivate(dir,'PC-A',safe).valid,true);
}));
test('copying local activation to another computer or user does not work',()=>withDir(dir=>{
 const safe=safeStorageMock();
 assert.equal(lic.activate(dir,serial,'PC-A',safe).valid,true);
 assert.equal(lic.status(dir,'PC-B',safe).valid,false);
 assert.equal(lic.status(dir,'PC-A',safeStorageMock('outro-usuario')).valid,false);
}));
test('invalid key never creates a receipt and secure storage is required',()=>withDir(dir=>{
 assert.equal(lic.activate(dir,'UNI32-AAAA-AAAA-AAAA-AAAA','PC-A',safeStorageMock()).valid,false);
 assert.equal(fs.existsSync(lic.paths(dir).receipt),false);
 assert.equal(lic.activate(dir,serial,'PC-A',{isEncryptionAvailable:()=>false}).valid,false);
 assert.equal(fs.existsSync(lic.paths(dir).receipt),false);
}));
test('modified activation record fails and installation can be recovered with original key',()=>withDir(dir=>{
 const safe=safeStorageMock();
 assert.equal(lic.activate(dir,serial,'PC-A',safe).valid,true);
 const p=lic.paths(dir).receipt;
 const receipt=JSON.parse(fs.readFileSync(p,'utf8'));
 receipt.serialHash='0'.repeat(64);
 fs.writeFileSync(p,JSON.stringify(receipt));
 assert.equal(lic.status(dir,'PC-A',safe).valid,false);
 assert.equal(lic.activate(dir,serial,'PC-A',safe).valid,true);
 assert.equal(lic.status(dir,'PC-A',safe).valid,true);
}));
