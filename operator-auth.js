'use strict';
// Separate, idempotent schema: never rewrites old operator IDs or Windows passwords.
const crypto=require('crypto');
const fail=(message,code='AUTH')=>{const error=new Error(message);error.code=code;throw error;};
const normalize=v=>String(v||'').trim().normalize('NFKC').toLocaleLowerCase('pt-BR');
const stored=(password,salt)=>crypto.scryptSync(password,Buffer.from(salt,'hex'),32,{N:16384,r:8,p:1,maxmem:64*1024*1024}).toString('hex');
function ensure(db){db.exec(`CREATE TABLE IF NOT EXISTS operator_mobile_auth(
 operator_id INTEGER PRIMARY KEY REFERENCES operators(id),login TEXT UNIQUE COLLATE NOCASE,
 salt TEXT, password_hash TEXT, mobile_enabled INTEGER NOT NULL DEFAULT 0,
 credential_version INTEGER NOT NULL DEFAULT 1,updated_at TEXT NOT NULL DEFAULT ''
);`);}
function publicOperator(db,id){return db.prepare(`SELECT o.id,o.name,o.photo_data,o.active,COALESCE(a.login,'') mobile_login,
 COALESCE(a.mobile_enabled,0) mobile_enabled,CASE WHEN a.password_hash IS NOT NULL THEN 1 ELSE 0 END mobile_password_set,
 COALESCE(a.credential_version,0) credential_version
 FROM operators o LEFT JOIN operator_mobile_auth a ON a.operator_id=o.id WHERE o.id=?`).get(id);}
function list(db){return db.prepare(`SELECT o.id,o.name,o.photo_data,o.active,o.created_at,
 COALESCE(a.login,'') mobile_login,COALESCE(a.mobile_enabled,0) mobile_enabled,
 CASE WHEN a.password_hash IS NOT NULL THEN 1 ELSE 0 END mobile_password_set
 FROM operators o LEFT JOIN operator_mobile_auth a ON a.operator_id=o.id WHERE o.active=1 ORDER BY o.name`).all();}
function save(db,o){
 const name=String(o?.name||'').trim();if(!name)fail('Informe o nome do operador.','VALIDATION');
 const login=normalize(o.mobile_login), password=String(o.mobile_password||''), confirm=String(o.mobile_password_confirm||'');
 if(login&&(!/^[\p{L}\p{N}._-]{3,50}$/u.test(login)))fail('Login: use 3 a 50 letras, números, ponto, _ ou hífen.','VALIDATION');
 if(password&&(password!==confirm||password.length<8||password.length>128))fail('Senha Android: mínimo 8 caracteres e confirmação idêntica.','VALIDATION');
 const enabled=o.mobile_enabled===true||String(o.mobile_enabled)==='1';
 let id=Number(o.id)||0;
 return db.transaction(()=>{
  if(id){const previous=db.prepare('SELECT id FROM operators WHERE id=?').get(id);if(!previous)fail('Operador inexistente.','NOT_FOUND');db.prepare('UPDATE operators SET name=?,photo_data=?,active=1 WHERE id=?').run(name,o.photo_data||'',id);}
  else id=Number(db.prepare('INSERT INTO operators(name,photo_data,active,created_at) VALUES(?,?,1,?)').run(name,o.photo_data||'',new Date().toISOString()).lastInsertRowid);
  const prev=db.prepare('SELECT * FROM operator_mobile_auth WHERE operator_id=?').get(id);
  if(enabled&&!login)fail('Informe o login para habilitar acesso Android.','VALIDATION');
  if(enabled&&!password&&!prev?.password_hash)fail('Defina uma senha Android antes de habilitar.','VALIDATION');
  const other=login?db.prepare('SELECT operator_id FROM operator_mobile_auth WHERE login=? COLLATE NOCASE').get(login):null;
  if(other&&other.operator_id!==id)fail('Este login já pertence a outro operador.','DUPLICATE_LOGIN');
  const salt=password?crypto.randomBytes(16).toString('hex'):prev?.salt||null;
  const digest=password?stored(password,salt):prev?.password_hash||null;
  const needsRevoke=!!password||login!==(prev?.login||'')||Number(enabled)!==Number(prev?.mobile_enabled||0);
  const version=(prev?.credential_version||0)+(needsRevoke?1:0)||1;
  db.prepare(`INSERT INTO operator_mobile_auth(operator_id,login,salt,password_hash,mobile_enabled,credential_version,updated_at)
 VALUES(?,?,?,?,?,?,?) ON CONFLICT(operator_id) DO UPDATE SET login=excluded.login,salt=excluded.salt,
 password_hash=excluded.password_hash,mobile_enabled=excluded.mobile_enabled,credential_version=excluded.credential_version,updated_at=excluded.updated_at`)
 .run(id,login||null,salt,digest,enabled?1:0,version,new Date().toISOString());
  return id;
 })();
}
function authenticate(db,credentials){const login=normalize(credentials?.username);const password=String(credentials?.password||'');
 const row=login&&db.prepare(`SELECT a.*,o.name,o.photo_data,o.active FROM operator_mobile_auth a
 JOIN operators o ON o.id=a.operator_id WHERE a.login=? COLLATE NOCASE`).get(login);
 // Fixed workload and generic error avoid identifying valid usernames via timing/error messages.
 const fakeSalt='00'.repeat(16),computed=stored(password,row?.salt||fakeSalt);
 const known=row?.password_hash||'00'.repeat(32);
 const match=crypto.timingSafeEqual(Buffer.from(computed,'hex'),Buffer.from(known,'hex'));
 if(!row||!row.active||!row.mobile_enabled||!match)fail('Login ou senha inválidos, ou operador sem acesso Android.','AUTH');
 return {id:row.operator_id,name:row.name,photo_data:row.photo_data,version:row.credential_version};
}
function changePassword(db,operatorId,current,next){
 const row=publicOperator(db,operatorId);
 if(!row?.mobile_login)fail('Acesso não configurado.','AUTH');
 authenticate(db,{username:row.mobile_login,password:current});
 if(typeof next!=='string'||next.length<8||next.length>128)fail('A nova senha deve ter de 8 a 128 caracteres.','VALIDATION');
 const salt=crypto.randomBytes(16).toString('hex');
 db.prepare('UPDATE operator_mobile_auth SET salt=?,password_hash=?,credential_version=credential_version+1,updated_at=? WHERE operator_id=?')
  .run(salt,stored(next,salt),new Date().toISOString(),operatorId);
 return true;
}
function getActive(db,id){const row=publicOperator(db,id);if(!row||!row.active||!row.mobile_enabled||!row.mobile_password_set)return null;return row;}
module.exports={ensure,list,save,authenticate,getActive,publicOperator,changePassword};
