'use strict';
// UNI32 — ativação local por chave única introduzida pelo instalador.
// O conteúdo gravado fica criptografado com Electron safeStorage (DPAPI no Windows).
// Não há servidor: é impossível impedir globalmente que a mesma chave seja usada
// em dois computadores se alguém tiver acesso a ela.
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const allowedHashes = new Set(require('./install-key-hashes.generated.cjs'));

const EDITION = 'UNIPDV32-KEYONLY-1';
const RECEIPT_FORMAT = 'uni32-local-activation-v1';
const normalizeSerial = value => String(value || '').trim().toUpperCase().replace(/\s+/g, '');
const serialHash = value => crypto.createHash('sha256').update(normalizeSerial(value), 'utf8').digest('hex');
const serialAllowed = serial => /^UNI32-[A-Z2-9]{4}(?:-[A-Z2-9]{4}){3}$/.test(normalizeSerial(serial)) && allowedHashes.has(serialHash(serial));
const hashMachineId = machineId => crypto.createHash('sha256').update('UNI-PDV-Offline-v1|' + String(machineId).trim().toUpperCase()).digest('hex').toUpperCase();
function getMachineId() {
  if (process.platform === 'win32') {
    try {
      const output = execFileSync('reg.exe', ['query','HKLM\\SOFTWARE\\Microsoft\\Cryptography','/v','MachineGuid'], {
        encoding: 'utf8', windowsHide: true, timeout: 3500
      });
      const match = output.match(/MachineGuid\s+REG_SZ\s+([^\s]+)/i);
      if (match?.[1]) return match[1].trim();
    } catch {}
  }
  // Fallback somente quando MachineGuid não estiver acessível.
  return `fallback:${os.hostname()}|${os.userInfo().username}`;
}
const paths = dir => ({pending: path.join(dir,'install.key'), receipt: path.join(dir,'activation.local')});
const maskedKey = serial => `UNI32-****-****-****-${normalizeSerial(serial).slice(-4)}`;
const error = (reason, extra={}) => ({valid:false,reason,...extra});
const secureAvailable = secureStorage => !!(secureStorage && typeof secureStorage.isEncryptionAvailable==='function' && secureStorage.isEncryptionAvailable() && typeof secureStorage.encryptString==='function' && typeof secureStorage.decryptString==='function');
function status(dir, machineId, secureStorage) {
  const {receipt}=paths(dir);
  const machine = hashMachineId(machineId || getMachineId());
  if (!fs.existsSync(receipt)) return error('Aguardando ativação. Informe a chave UNI32 na instalação ou nesta tela.');
  if (!secureAvailable(secureStorage)) return error('O armazenamento protegido do Windows não está disponível.');
  try {
    const record=JSON.parse(fs.readFileSync(receipt,'utf8'));
    if (record.format !== RECEIPT_FORMAT || record.edition !== EDITION || record.machine !== machine || typeof record.encryptedSerial !== 'string') {
      return error('Esta ativação não pertence a este computador ou foi alterada.');
    }
    const serial=normalizeSerial(secureStorage.decryptString(Buffer.from(record.encryptedSerial,'base64')));
    if (!serialAllowed(serial) || serialHash(serial) !== record.serialHash) return error('Chave de ativação inválida.');
    return {valid:true,reason:'Ativação local válida.',maskedSerial:maskedKey(serial),activatedAt:record.activatedAt,edition:EDITION};
  } catch {return error('A ativação não pode ser lida neste usuário/Windows. Reative com a chave original.');}
}
function writeAtomic(file, value) {
  fs.mkdirSync(path.dirname(file),{recursive:true});
  const tmp=file+`.tmp-${crypto.randomBytes(6).toString('hex')}`;
  try {fs.writeFileSync(tmp,value,{encoding:'utf8',mode:0o600});fs.renameSync(tmp,file)}
  catch(e){try{fs.rmSync(tmp,{force:true})}catch{}throw e}
}
function activate(dir, serialInput, machineId, secureStorage) {
  const serial=normalizeSerial(serialInput);
  if (!serialAllowed(serial)) return error('A chave UNI32 não foi reconhecida. Confira a digitação.');
  if (!secureAvailable(secureStorage)) return error('O Windows não disponibilizou o armazenamento seguro necessário para a ativação.');
  try {
    const record={
      format:RECEIPT_FORMAT, edition:EDITION,
      machine:hashMachineId(machineId || getMachineId()),
      serialHash:serialHash(serial),
      encryptedSerial:secureStorage.encryptString(serial).toString('base64'),
      activatedAt:new Date().toISOString()
    };
    writeAtomic(paths(dir).receipt,JSON.stringify(record,null,2)+'\n');
    // A chave legível só é necessária até a primeira abertura do sistema.
    try{fs.rmSync(paths(dir).pending,{force:true})}catch{}
    return status(dir,machineId,secureStorage);
  }catch(e){return error('Não foi possível gravar a ativação local: '+(e?.message||String(e)))}
}
function autoActivate(dir, machineId, secureStorage) {
  const current=status(dir,machineId,secureStorage);
  if (current.valid) {
    try {fs.rmSync(paths(dir).pending,{force:true})} catch {}
    return current;
  }
  const pending=paths(dir).pending;
  try {
    if (!fs.existsSync(pending)) return current;
    const serial=fs.readFileSync(pending,'utf8').trim();
    return activate(dir,serial,machineId,secureStorage);
  } catch (e) {return error('Não foi possível concluir a ativação da instalação: '+(e?.message||String(e)))}
}
module.exports={EDITION,RECEIPT_FORMAT,normalizeSerial,serialHash,serialAllowed,hashMachineId,getMachineId,paths,maskedKey,status,activate,autoActivate};
