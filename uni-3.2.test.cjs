'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),os=require('node:os'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {DatabaseSync}=require('node:sqlite');
const auth=require('./operator-auth');
const mobile=require('./mobile-server');
const management=require('./uni-management');
const cashDrawer=require('./cash-drawer');
function fixture(){
 const db=new DatabaseSync(':memory:');db.transaction=fn=>(...args)=>{db.exec('BEGIN');try{const value=fn(...args);db.exec('COMMIT');return value}catch(e){db.exec('ROLLBACK');throw e}};db.exec(`CREATE TABLE operators(id INTEGER PRIMARY KEY,name TEXT,photo_data TEXT DEFAULT '',role TEXT DEFAULT 'operator',password_hash TEXT DEFAULT '',active INTEGER DEFAULT 1,created_at TEXT DEFAULT '');CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT);CREATE TABLE products(id INTEGER PRIMARY KEY,name TEXT,item_type TEXT,cost_cents INTEGER DEFAULT 0,price_cents INTEGER DEFAULT 0,sale_mode TEXT DEFAULT 'UNIT');CREATE TABLE kits(id INTEGER PRIMARY KEY,name TEXT);CREATE TABLE sales(id INTEGER PRIMARY KEY,sold_at TEXT,total_cents INTEGER,discount_cents INTEGER DEFAULT 0,delivery_cents INTEGER DEFAULT 0,status TEXT DEFAULT 'CONCLUIDA');CREATE TABLE sale_items(id INTEGER PRIMARY KEY,product_id INTEGER,kit_id INTEGER,sale_id INTEGER,name TEXT,quantity INTEGER,total_cents INTEGER,sale_mode TEXT,weight_grams INTEGER);CREATE TABLE finance_entries(id INTEGER PRIMARY KEY,entry_type TEXT,amount_cents INTEGER,status TEXT,paid_at TEXT,issue_date TEXT);`);auth.ensure(db);return db;
}
test('Autenticação Android usa credencial independente do login Windows',()=>{const db=fixture();db.prepare("INSERT INTO operators(id,name,role,active,password_hash) VALUES(1,'Operador','operator',1,'hash-original')").run();auth.save(db,{id:1,name:'Operador',mobile_login:'operador',mobile_password:'senhaSegura#123',mobile_password_confirm:'senhaSegura#123',mobile_enabled:1});assert.equal(db.prepare('SELECT password_hash FROM operators WHERE id=1').get().password_hash,'hash-original');assert.equal(auth.authenticate(db,{username:'operador',password:'senhaSegura#123'}).id,1);assert.throws(()=>auth.authenticate(db,{username:'operador',password:'invalida'}),/inválidos/);db.close()});
test('Metas e rentabilidade são calculadas no banco existente sem mutações',()=>{const db=fixture();db.exec("INSERT INTO products(id,name,item_type,cost_cents) VALUES(1,'Caderno','PRODUCT',500),(2,'Serviço','SERVICE',1500);INSERT INTO sales(id,sold_at,total_cents) VALUES(1,'2026-10-22T10:00:00',5000);INSERT INTO sale_items(id,product_id,sale_id,name,quantity,total_cents) VALUES(1,1,1,'Caderno',2,3000),(2,2,1,'Serviço',1,2000);INSERT INTO finance_entries(id,entry_type,amount_cents,status,paid_at,issue_date) VALUES(1,'COMPRA',1100,'PAGO','2026-10-22','2026-10-22');");const x=management.compute(db,{since:'2026-10-01',until:'2026-10-31'});assert.equal(x.sales_count,1);assert.equal(x.booked_revenue_cents,5000);assert.equal(x.cost_cents,2500);assert.equal(x.gross_profit_cents,2500);assert.equal(x.paid_expenses_cents,1100);db.close()});
test('Servidor vincula um operador ao aparelho, revoga e evita reexecução da venda',async()=>{
 const db=fixture();db.exec("INSERT INTO operators(id,name,role,active) VALUES(1,'Admin','admin',1),(2,'Caixa','operator',1);INSERT INTO settings(key,value) VALUES('current_operator_id','1');");
 for(const [id,name] of [[1,'admin'],[2,'caixa']])auth.save(db,{id,name:id===1?'Admin':'Caixa',mobile_login:name,mobile_password:'segredoNovo123',mobile_password_confirm:'segredoNovo123',mobile_enabled:1});
 const handlers=new Map(),ipcMain={handle:(name,fn)=>handlers.set(name,fn)};
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'uni-device-test-'));let changes=0,sales=0;
 const fakeApp={getPath:()=>dir,on:()=>{}};
 const link=mobile.install({ipcMain,getDb:()=>db,app:fakeApp,BrowserWindow:{getAllWindows:()=>[{webContents:{send:()=>changes++}}]},dialog:{},clipboard:{}});
 ipcMain.handle('products:list',()=>({ok:true,data:[{id:1,name:'Produto'}]}));
 ipcMain.handle('sales:create',()=>({ok:true,data:++sales}));
 const payload={username:'admin',password:'segredoNovo123',deviceId:crypto.randomUUID()};
 const req=(url,token='')=>({url,headers:{authorization:token?'Bearer '+token:''},socket:{remoteAddress:'127.0.0.1'}});
 const logged=await link._test.dispatch(req('/v1/login'),payload);assert.ok(logged?.data?.token);const token=logged.data.token;
 await assert.rejects(()=>link._test.dispatch(req('/v1/login'),{...payload,username:'caixa'}),/vinculado/);
 const before=changes;for(let i=0;i<5;i++)await link._test.dispatch(req('/v1/rpc',token),{deviceId:payload.deviceId,channel:'products:list',args:[],requestId:crypto.randomUUID()});assert.equal(changes,before);
 const write={deviceId:payload.deviceId,channel:'sales:create',args:[{items:[{product_id:1,quantity:1}]}],requestId:crypto.randomUUID()};
 const first=await link._test.dispatch(req('/v1/rpc',token),write);const retry=await link._test.dispatch(req('/v1/rpc',token),write);assert.deepEqual(first,retry);assert.equal(sales,1);assert.equal(changes,before+1);
 const devices=(await handlers.get('mobile:devices')()).data;assert.equal(devices.length,1);await handlers.get('mobile:release-device')(null,devices[0].id);
 await assert.rejects(()=>link._test.dispatch(req('/v1/session',token),{deviceId:payload.deviceId}),/Entre novamente/);
 const second=await link._test.dispatch(req('/v1/login'),{...payload,username:'caixa'});assert.ok(second.data.token);
 db.close();fs.rmSync(dir,{recursive:true,force:true});
});

test('Pulso ESC/POS da gaveta respeita pino 2/5 e limites de duração',()=>{assert.deepEqual([...cashDrawer.buildPulse(2,100,100)],[27,112,0,50,50]);assert.deepEqual([...cashDrawer.buildPulse(5,200,300)],[27,112,1,100,150]);assert.throws(()=>cashDrawer.buildPulse(3,100,100),/pino 2 ou 5/);});
