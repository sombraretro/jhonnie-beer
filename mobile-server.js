'use strict';
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const hash = x => crypto.createHash('sha256').update(x).digest('hex');
const operatorAuth = require('./operator-auth');
const fault = (message, code='MOBILE') => Object.assign(new Error(message), {code});
// Lembretes de retorno apenas consultam a agenda. Classifica-los como mutacao
// causava um ciclo: consulta -> mobile:data-changed -> consulta -> ...
// Indicadores comerciais sao consultas: nao podem iniciar um novo refresh.
// Only actual mutations notify the desktop; read-only queries must not cause refresh loops.
const mutating = new Set(['sales:create','quotes:create','agenda:create','agenda:update','agenda:attendance','cash:open','customers:save']);
const readOnly = channel => !mutating.has(channel);
const shouldBroadcast=(channel,result)=>mutating.has(channel)&&result?.ok!==false;
const mobileReadable=new Set(['dashboard','ux:overview','products:list','kits:list','customers:list','sales:list','sales:detail','cash:current','quotes:list','quotes:detail','agenda:list','settings:get']);
const mobileWritable=new Set(mutating);
const privateKey = k => /password|_enc$|csc_token|login_|mobile_/i.test(k);
function scrub(s) { return Object.fromEntries(Object.entries(s || {}).filter(([k])=>!privateKey(k))); }
function install({ipcMain, getDb, app, BrowserWindow, dialog, clipboard, isolatedTestServer=false}) {
  const handlers = new Map(); const nativeHandle = ipcMain.handle.bind(ipcMain);
  let chain = Promise.resolve(), revision = Date.now(), server = null, started = false;
  const serial = fn => {const p = chain.then(fn); chain = p.catch(()=>{}); return p;};
  const changed = () => {revision++; for(const w of BrowserWindow.getAllWindows())w.webContents.send('mobile:data-changed');};
  ipcMain.handle = (channel, handler) => {
    handlers.set(channel, handler);
    nativeHandle(channel, (event,...args) => serial(async()=>{
      const result = await handler(event,...args);
      if(shouldBroadcast(channel,result))changed();
      return result;
    }));
  };
  const root = path.join(app.getPath('userData'),'android-link');
  const statePath = path.join(root,'state.json');
  let state = {sessions:{},requests:{},devices:{}};
  fs.mkdirSync(root,{recursive:true});
  if(fs.existsSync(statePath)) {try{state=JSON.parse(fs.readFileSync(statePath,'utf8'));if(!state||typeof state.sessions!=='object'||typeof state.requests!=='object')throw Error('Estado inválido');state.devices=state.devices&&typeof state.devices==='object'?state.devices:{};}catch{try{fs.renameSync(statePath,statePath+'.corrupt-'+Date.now())}catch{};state={sessions:{},requests:{},devices:{}};}}
  const save = ()=>{fs.writeFileSync(statePath+'.tmp',JSON.stringify(state),{mode:0o600});fs.renameSync(statePath+'.tmp',statePath);};
  // Credenciais CDVA não concedem sessões móveis; operadores possuem versão individual.
  function account(id){return operatorAuth.getActive(getDb(),id);}
  function tlsOptions(){
    const certPath=path.join(root,'server.crt'), keyPath=path.join(root,'server.key');
    if(!fs.existsSync(certPath)||!fs.existsSync(keyPath)){
      const forge=require('node-forge'), pair=forge.pki.rsa.generateKeyPair(2048), cert=forge.pki.createCertificate();
      cert.publicKey=pair.publicKey;cert.serialNumber='01'+crypto.randomBytes(15).toString('hex');
      cert.validity.notBefore=new Date(Date.now()-86400000);cert.validity.notAfter=new Date();cert.validity.notAfter.setFullYear(cert.validity.notAfter.getFullYear()+5);
      cert.setSubject([{name:'commonName',value:'Uni-PDV - Servidor local'}]);cert.setIssuer(cert.subject.attributes);
      cert.setExtensions([{name:'basicConstraints',cA:false},{name:'keyUsage',digitalSignature:true,keyEncipherment:true},{name:'extKeyUsage',serverAuth:true}]);
      cert.sign(pair.privateKey,forge.md.sha256.create());
      fs.writeFileSync(keyPath,forge.pki.privateKeyToPem(pair.privateKey),{mode:0o600});fs.writeFileSync(certPath,forge.pki.certificateToPem(cert));
    }
    const cert=fs.readFileSync(certPath);return {key:fs.readFileSync(keyPath),cert,minVersion:'TLSv1.2'};
  }
  let fingerprint='';
  const limits=new Map();
  function throttle(ip){const now=Date.now();let x=limits.get(ip);if(!x||now-x.start>60000){x={start:now,n:0};limits.set(ip,x);}if(++x.n>10)throw fault('Muitas tentativas. Aguarde um minuto.','RATE_LIMIT');if(limits.size>2000)limits.clear();}
  function getDeviceId(payload){const id=String(payload?.deviceId||'');if(!/^[a-f0-9-]{32,64}$/i.test(id))throw fault('Identificação do aparelho ausente ou inválida.','DEVICE');return hash(id);}
  function session(req,payload){const token=String(req.headers.authorization||'').replace(/^Bearer /,'');const id=hash(token);const s=state.sessions[id];if(!s||s.expires<Date.now()||!s.operatorId||s.deviceId!==getDeviceId(payload))throw fault('Entre novamente com seu login de operador.','AUTH');const o=account(s.operatorId);if(!o||o.credential_version!==s.version||Number(state.devices[s.deviceId]?.operatorId)!==Number(s.operatorId))throw fault('Acesso Android revogado. Entre novamente.','AUTH');return {id,...s,operator:o};}
  async function body(req){let n=0;const chunks=[];for await(const c of req){n+=c.length;if(n>6*1024*1024)throw fault('Requisição muito grande.');chunks.push(c);}return JSON.parse(Buffer.concat(chunks).toString('utf8'));}
  async function dispatch(req, payload){
    if(req.url==='/v1/login'){
      throttle(req.socket.remoteAddress);
      const operator=operatorAuth.authenticate(getDb(),payload);
      const deviceId=getDeviceId(payload);
      const existing=state.devices[deviceId];
      if(existing&&Number(existing.operatorId)!==Number(operator.id))throw fault('Este aparelho está vinculado a outro operador. Solicite ao Administrador a liberação no Windows.','DEVICE_BOUND');
      if(!existing){state.devices[deviceId]={operatorId:operator.id,boundAt:new Date().toISOString()};save();}
      const token=crypto.randomBytes(32).toString('hex'),id=hash(token);
      state.sessions[id]={version:operator.version,operatorId:operator.id,deviceId,expires:Date.now()+30*86400000,createdAt:new Date().toISOString()};save();
      return {ok:true,data:{token,user:{id:operator.id,username:operator.name,name:operator.name,photo_data:operator.photo_data},expires:state.sessions[id].expires}};
    }
    const s=session(req,payload);
    if(req.url==='/v1/session')return {ok:true,data:{id:s.operatorId,username:s.operator.name,name:s.operator.name,photo_data:s.operator.photo_data,revision}};
    if(req.url==='/v1/logout'){delete state.sessions[s.id];save();return {ok:true,data:true};}
    if(req.url==='/v1/password'){
      throttle(req.socket.remoteAddress);
      operatorAuth.changePassword(getDb(),s.operatorId,payload.current,payload.next);
      delete state.sessions[s.id];save();
      return {ok:true,data:true};
    }
    if(req.url!=='/v1/rpc')throw fault('Rota inexistente.','NOT_FOUND');
    const {channel,args=[],requestId}=payload;
    if(typeof channel!=='string'||!handlers.has(channel)||(!mobileReadable.has(channel)&&!mobileWritable.has(channel))||!Array.isArray(args))throw fault('Operação não permitida no Android.','FORBIDDEN');
    // UI de caixa/vendas consulta operadores, mas a sessão móvel só pode ver a própria identidade.
    
    // Admin-only actions must not be reachable through a normal Android session.
    if(/^(operators:|audit:|settings:set$|fiscal:(settings|save-settings|choose-certificate|issue|cancel|transmit-pending|contingency)|backup:|email:(send|save-settings|choose-attachments)|cash:close$|sales:cancel$|stock:move$|.*:(delete|restore|bulk-category)$)/.test(channel))throw fault('Ação disponível somente no PDV Windows.','FORBIDDEN');
    // Agenda Android: somente atendimentos de servico. Tarefas e recebimentos
    // permanecem exclusivos do Windows, mesmo por requisicoes RPC manuais.
    if(channel==='agenda:create' && String(args[0]?.type||'SERVICO').toUpperCase()!=='SERVICO')
      throw fault('Somente atendimentos de serviço podem ser criados pelo Android.','FORBIDDEN');
    if(channel==='agenda:attendance'){
      const rec=getDb().prepare('SELECT type FROM appointments WHERE id=?').get(Number(args[0]?.id));
      if(!rec || rec.type!=='SERVICO')
        throw fault('Somente atendimentos de serviço podem ser confirmados pelo Android.','FORBIDDEN');
    }
    // O aplicativo móvel só edita atendimentos de serviço. Não pode modificar
    // tarefas internas, entregas ou recebimentos por envio manual de RPC.
    if(channel==='agenda:update'){
      const agenda=args[0]||{};
      if(!agenda.id||String(agenda.agenda_source||'').toLowerCase()==='internal'||
         String(agenda.type||'SERVICO').toUpperCase()!=='SERVICO')
        throw fault('Somente atendimentos de serviço podem ser editados no Android.','FORBIDDEN');
      const existing=getDb().prepare('SELECT type FROM appointments WHERE id=?').get(Number(agenda.id));
      if(!existing||existing.type!=='SERVICO')
        throw fault('Atendimento não disponível para edição no Android.','FORBIDDEN');
    }
    // Enforce operator identity on server, never trust a form-supplied operator.
    if(mobileWritable.has(channel)){
      const index=0;
      if(args[index]&&typeof args[index]==='object')args[index]={...args[index],operator:s.operator.name,current_operator_id:s.operatorId,current_operator_name:s.operator.name};
    }
    const mutable=mobileWritable.has(channel);
    if(!/^[a-f0-9-]{16,64}$/i.test(requestId||''))throw fault('Identificador obrigatório.');
    const key=s.id+':'+requestId, digest=hash(JSON.stringify({channel,args}));
    const previous=state.requests[key];
    if(previous){if(previous.digest!==digest)throw fault('Identificador reutilizado com outros dados.');if(previous.result)return previous.result;throw fault('Resultado incerto. Confira o histórico no Windows antes de repetir.','UNCERTAIN');}
    // Keep a durable marker before side effects. A crash never triggers automatic replay.
    if(mutable){state.requests[key]={digest,at:Date.now()};save();}
    try{
      let result=await handlers.get(channel)({mobile:true},...args);
      if(['settings:get','fiscal:settings','email:settings'].includes(channel)&&result?.ok)result={ok:true,data:{...scrub(result.data),operator:s.operator.name,current_operator_id:String(s.operatorId),current_operator_name:s.operator.name,current_operator_photo:s.operator.photo_data}};
      if(channel==='fiscal:choose-certificate'&&result?.ok)state.sessions[s.id].certPath=result.data;
      if(channel==='email:choose-attachments'&&result?.ok)state.sessions[s.id].attachments=result.data;
      if(mutable){state.requests[key].result=result;save();if(result?.ok!==false){
        try{getDb().prepare('INSERT INTO activity_log(created_at,operator,action,entity_type,details) VALUES(?,?,?,?,?)').run(new Date().toISOString(),s.operator.name,'Operação Android',channel,`Operador #${s.operatorId} · sessão ${s.id.slice(0,12)} · origem Android`);}catch{}
        changed();
      }}
      return result;
    }catch(e){
      // Handler may have performed a side effect before throwing; never silently replay.
      throw e;
    }
  }
  function start(){
    if(started)return;started=true;const tls=tlsOptions();fingerprint=new crypto.X509Certificate(tls.cert).fingerprint256.replace(/:/g,'');
    server=https.createServer(tls,async(req,res)=>{
      res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
      try{
        if(req.method!=='POST'||req.headers.origin)throw fault('Requisição inválida.','FORBIDDEN');
        const payload=await body(req);const result=await serial(()=>dispatch(req,payload));res.end(JSON.stringify(result));
      }catch(e){res.statusCode=e.code==='AUTH'?401:e.code==='RATE_LIMIT'?429:400;res.end(JSON.stringify({ok:false,error:{code:e.code||'MOBILE',message:e.message||'Falha no servidor.'}}));}
    });
    server.requestTimeout=30000;server.headersTimeout=15000;
    server.on('error',e=>{started=false;dialog.showErrorBox('Conexão Android',e.message);});
    // Somente testes isolados: loopback em porta dinamica. Em producao, 17444 permanece inalterada.
    server.listen(isolatedTestServer===true?0:17444,isolatedTestServer===true?'127.0.0.1':'0.0.0.0');
    return server;
  }
  function info(){if(!started)start();const ips=Object.values(os.networkInterfaces()).flat().filter(x=>x.family==='IPv4'&&!x.internal).map(x=>x.address);return {port:17444,ips,fingerprint};}
  function revoke(){checkAdmin();state.sessions={};save();}
  // Administrative desktop-only API. Never expose these channels in mobileReadable.
  function checkAdmin(){const id=Number(getDb().prepare("SELECT value FROM settings WHERE key='current_operator_id'").get()?.value||0);const op=id&&getDb().prepare('SELECT id,role FROM operators WHERE id=? AND active=1').get(id);if(op?.role!=='admin')throw fault('Apenas o Administrador pode alterar credenciais e aparelhos Android.','FORBIDDEN');}
  ipcMain.handle('mobile:operators',()=>{checkAdmin();return {ok:true,data:operatorAuth.list(getDb())};});
  ipcMain.handle('mobile:operator-config',(_,data)=>{checkAdmin();if(!Number(data?.id))throw fault('Cadastre primeiro o operador no Windows.','VALIDATION');return {ok:true,data:operatorAuth.save(getDb(),data)};});
  ipcMain.handle('mobile:devices',()=>{checkAdmin();const operators=new Map(operatorAuth.list(getDb()).map(x=>[Number(x.id),x.name]));return {ok:true,data:Object.entries(state.devices).map(([id,d])=>({id,operator_id:d.operatorId,operator_name:operators.get(Number(d.operatorId))||'Operador não encontrado',bound_at:d.boundAt}))};});
  ipcMain.handle('mobile:release-device',(_,deviceId)=>{checkAdmin();const id=String(deviceId||'');if(!state.devices[id])throw fault('Aparelho não encontrado.','NOT_FOUND');delete state.devices[id];for(const [sessionId,ss] of Object.entries(state.sessions))if(ss.deviceId===id)delete state.sessions[sessionId];save();return {ok:true,data:true};});
  ipcMain.handle('mobile:info',()=>{checkAdmin();return {ok:true,data:info()};});
  const enabledPath=path.join(root,'enabled');
  function configure(){checkAdmin();fs.writeFileSync(enabledPath,'1');const x=info();dialog.showMessageBox({type:'info',title:'Uni-PDV · Android',message:'Integração Android Uni-PDV ativada',detail:`Endereço: ${x.ips.join(' ou ')}\nPorta: ${x.port}\nIdentificação SHA-256 (copie para o Android):\n${x.fingerprint}\n\nUse o mesmo Wi-Fi e o login/senha Android cadastrados no operador no Windows. Libere a porta TCP 17444 somente na rede privada. Mantenha este PDV aberto.`,buttons:['OK','Copiar identificação']}).then(r=>{if(r.response===1)clipboard?.writeText(x.fingerprint)});}
  app.on('before-quit',()=>server?.close());
  return {configure,revoke,notifyChanged:changed,startIfEnabled:()=>fs.existsSync(enabledPath)?start():null,_test:{handlers,serial,dispatch,state,session,readOnly,scrub}};
}
module.exports={install,readOnly,scrub};
