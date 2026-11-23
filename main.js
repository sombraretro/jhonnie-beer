const { app, BrowserWindow, ipcMain, dialog, Menu, net, shell } = require('electron');
const crypto=require('crypto');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
let Database;
let PDFDocument=null;
const { safeStorage } = require('electron');
const nfce = require('./nfce');
const cashDrawer = require('./cash-drawer');

const APP_NAME = 'Jhonnie Beer';
const STORE_ID = 'br.unisoftwares.jhonniebeer';
const DB_FILE = 'pdv-integrado-3.1.db';
// Base experimental isolada: não modifica os dados da instalação Legacy STABLE.
// Revisão UX experimental usa base isolada para não alterar o banco da versão STABLE.
app.setPath('userData', path.join(app.getPath('appData'),'Jhonnie Beer')); // Dados e licença separados da edição Livre
let db;
let mobileLink=null;
const now = () => new Date().toISOString();
const ok = data => ({ ok: true, data });
const fail = (message, code='APP_ERROR') => { const e=new Error(message); e.code=code; throw e; };
const sha256=v=>crypto.createHash('sha256').update(String(v)).digest('hex');
// Hash de senha versionado. Senhas legadas são atualizadas após login válido.
const PASSWORD_HASH_ITERATIONS=210000;
function hashPassword(value){const salt=crypto.randomBytes(16).toString('hex');const digest=crypto.pbkdf2Sync(String(value),salt,PASSWORD_HASH_ITERATIONS,32,'sha256').toString('hex');return `pbkdf2$${PASSWORD_HASH_ITERATIONS}$${salt}$${digest}`;}
function verifyPassword(value,stored){const raw=String(stored||'');if(raw.startsWith('pbkdf2$')){const parts=raw.split('$');if(parts.length!==4)return {valid:false,legacy:false};const iterations=Number(parts[1]),salt=parts[2],expected=parts[3];if(!Number.isInteger(iterations)||iterations<100000||iterations>1000000||!/^[a-f0-9]{32}$/.test(salt)||!/^[a-f0-9]{64}$/.test(expected))return {valid:false,legacy:false};const actual=crypto.pbkdf2Sync(String(value),salt,iterations,32,'sha256'),target=Buffer.from(expected,'hex');return {valid:actual.length===target.length&&crypto.timingSafeEqual(actual,target),legacy:false};}const legacy=sha256(value),a=Buffer.from(legacy,'hex'),b=Buffer.from(raw,'hex');return {valid:b.length===a.length&&crypto.timingSafeEqual(a,b),legacy:true};}
function validateNewPassword(value){const pass=String(value||'');if(pass.length<8)fail('A nova senha deve ter pelo menos 8 caracteres.','PASSWORD_POLICY');if(pass.length>256)fail('A senha excede o tamanho permitido.','PASSWORD_POLICY');return pass;}

const CATEGORIES = [];
const CATEGORY_ICONS = [];

function columnNames(table){ return db.prepare(`PRAGMA table_info(${table})`).all().map(x=>x.name); }
function addColumn(table, name, sql){ if(!columnNames(table).includes(name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${sql}`); }
function initDb(){
  try { Database = require('better-sqlite3'); } catch (e) {
    const detail = `Não foi possível carregar o banco de dados SQLite (better-sqlite3).\n\n${e?.message || e}`;
    try { fs.mkdirSync(app.getPath('userData'),{recursive:true}); fs.writeFileSync(path.join(app.getPath('userData'),'startup-error.log'), detail); } catch {}
    throw new Error(detail);
  }
  const dir=app.getPath('userData'); fs.mkdirSync(dir,{recursive:true});
  const lojaDb=path.join(dir,DB_FILE); db=new Database(lojaDb); db.pragma('journal_mode=WAL'); db.pragma('foreign_keys=ON');
  db.exec(`
  CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT);
  CREATE TABLE IF NOT EXISTS categories(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,icon TEXT,parent_id INTEGER DEFAULT NULL,active INTEGER DEFAULT 1);
  CREATE TABLE IF NOT EXISTS products(id INTEGER PRIMARY KEY AUTOINCREMENT,sku TEXT UNIQUE,barcode TEXT,name TEXT NOT NULL,category_id INTEGER,price_cents INTEGER NOT NULL DEFAULT 0,cost_cents INTEGER NOT NULL DEFAULT 0,stock INTEGER NOT NULL DEFAULT 0,min_stock INTEGER NOT NULL DEFAULT 0,unit TEXT DEFAULT 'un',active INTEGER DEFAULT 1,ncm TEXT DEFAULT '',cfop TEXT DEFAULT '',cst_csosn TEXT DEFAULT '',origin TEXT DEFAULT '0',created_at TEXT NOT NULL,updated_at TEXT NOT NULL,FOREIGN KEY(category_id) REFERENCES categories(id));
  CREATE TABLE IF NOT EXISTS kits(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,sku TEXT UNIQUE,price_cents INTEGER NOT NULL DEFAULT 0,active INTEGER DEFAULT 1,created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS kit_items(kit_id INTEGER NOT NULL,product_id INTEGER NOT NULL,quantity INTEGER NOT NULL,PRIMARY KEY(kit_id,product_id));
  CREATE TABLE IF NOT EXISTS suppliers(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,document TEXT,phone TEXT,email TEXT,address TEXT,notes TEXT,created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS finance_entries(id INTEGER PRIMARY KEY AUTOINCREMENT,entry_type TEXT NOT NULL DEFAULT 'EXPENSE',description TEXT NOT NULL,supplier_id INTEGER,category TEXT NOT NULL DEFAULT 'Outros',amount_cents INTEGER NOT NULL,due_date TEXT NOT NULL,issue_date TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'PENDENTE',paid_at TEXT,payment_method TEXT DEFAULT '',notes TEXT DEFAULT '',created_at TEXT NOT NULL,updated_at TEXT NOT NULL,FOREIGN KEY(supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL);
  CREATE INDEX IF NOT EXISTS idx_finance_entries_due ON finance_entries(due_date,status);
  CREATE INDEX IF NOT EXISTS idx_finance_entries_type ON finance_entries(entry_type,issue_date);
  CREATE TABLE IF NOT EXISTS operators(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,photo_data TEXT DEFAULT '',password_hash TEXT DEFAULT '',role TEXT NOT NULL DEFAULT 'operator',active INTEGER DEFAULT 1,created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS customers(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,phone TEXT NOT NULL,address TEXT DEFAULT '',balance_cents INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS customer_payments(id INTEGER PRIMARY KEY AUTOINCREMENT,customer_id INTEGER NOT NULL,amount_cents INTEGER NOT NULL,method TEXT DEFAULT 'Dinheiro',note TEXT DEFAULT '',created_at TEXT NOT NULL,FOREIGN KEY(customer_id) REFERENCES customers(id));
  CREATE TABLE IF NOT EXISTS sales(id INTEGER PRIMARY KEY AUTOINCREMENT,sold_at TEXT NOT NULL,total_cents INTEGER NOT NULL,payment TEXT NOT NULL,operator TEXT,customer_name TEXT,customer_document TEXT,discount_cents INTEGER NOT NULL DEFAULT 0,discount_percent REAL NOT NULL DEFAULT 0);
  CREATE TABLE IF NOT EXISTS sale_items(id INTEGER PRIMARY KEY AUTOINCREMENT,sale_id INTEGER,product_id INTEGER,kit_id INTEGER,name TEXT NOT NULL,quantity INTEGER NOT NULL,unit_price_cents INTEGER NOT NULL,total_cents INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS sale_payments(id INTEGER PRIMARY KEY AUTOINCREMENT,sale_id INTEGER NOT NULL,customer_id INTEGER,method TEXT NOT NULL,original_cents INTEGER NOT NULL,fee_percent REAL NOT NULL DEFAULT 0,fee_cents INTEGER NOT NULL DEFAULT 0,final_cents INTEGER NOT NULL,installments INTEGER NOT NULL DEFAULT 1,condition_text TEXT DEFAULT '',created_at TEXT NOT NULL,FOREIGN KEY(sale_id) REFERENCES sales(id),FOREIGN KEY(customer_id) REFERENCES customers(id));
  CREATE TABLE IF NOT EXISTS stock_movements(id INTEGER PRIMARY KEY AUTOINCREMENT,product_id INTEGER,kind TEXT NOT NULL,quantity INTEGER NOT NULL,unit_cost_cents INTEGER DEFAULT 0,reason TEXT,created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS fiscal_documents(id INTEGER PRIMARY KEY AUTOINCREMENT,sale_id INTEGER,number INTEGER NOT NULL,series TEXT NOT NULL,model TEXT NOT NULL,status TEXT NOT NULL,issued_at TEXT NOT NULL,access_key TEXT,customer_name TEXT,customer_document TEXT,total_cents INTEGER NOT NULL,xml TEXT);
  CREATE TABLE IF NOT EXISTS fiscal_items(id INTEGER PRIMARY KEY AUTOINCREMENT,document_id INTEGER,product_id INTEGER,name TEXT NOT NULL,quantity INTEGER NOT NULL,unit_price_cents INTEGER NOT NULL,total_cents INTEGER NOT NULL,ncm TEXT,cfop TEXT,cst TEXT);
  CREATE TABLE IF NOT EXISTS fiscal_events(id INTEGER PRIMARY KEY AUTOINCREMENT,document_id INTEGER NOT NULL,event_type TEXT NOT NULL,sequence INTEGER NOT NULL DEFAULT 1,status TEXT NOT NULL,protocol TEXT,reason TEXT,xml TEXT,created_at TEXT NOT NULL,FOREIGN KEY(document_id) REFERENCES fiscal_documents(id));
  CREATE TABLE IF NOT EXISTS notes(id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL DEFAULT '',content TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS cash_registers(id INTEGER PRIMARY KEY AUTOINCREMENT,opened_at TEXT NOT NULL,opening_date TEXT NOT NULL,opening_cents INTEGER NOT NULL DEFAULT 0,closed_at TEXT,closing_cents INTEGER,closing_total_cents INTEGER,closing_status TEXT NOT NULL DEFAULT 'ABERTO',operator TEXT,notes TEXT DEFAULT '');
  CREATE TABLE IF NOT EXISTS cash_withdrawals(id INTEGER PRIMARY KEY AUTOINCREMENT,cash_register_id INTEGER NOT NULL,amount_cents INTEGER NOT NULL,reason TEXT NOT NULL,operator TEXT DEFAULT '',created_at TEXT NOT NULL,FOREIGN KEY(cash_register_id) REFERENCES cash_registers(id));
  CREATE TABLE IF NOT EXISTS quotes(id INTEGER PRIMARY KEY AUTOINCREMENT,number INTEGER UNIQUE NOT NULL,created_at TEXT NOT NULL,valid_until TEXT,customer_id INTEGER,customer_name TEXT DEFAULT '',customer_phone TEXT DEFAULT '',customer_address TEXT DEFAULT '',operator TEXT DEFAULT '',subtotal_cents INTEGER NOT NULL DEFAULT 0,discount_cents INTEGER NOT NULL DEFAULT 0,discount_percent REAL NOT NULL DEFAULT 0,total_cents INTEGER NOT NULL DEFAULT 0,notes TEXT DEFAULT '',status TEXT NOT NULL DEFAULT 'ABERTO',delivery_cents INTEGER NOT NULL DEFAULT 0);
  CREATE TABLE IF NOT EXISTS quote_items(id INTEGER PRIMARY KEY AUTOINCREMENT,quote_id INTEGER NOT NULL,product_id INTEGER,kit_id INTEGER,name TEXT NOT NULL,quantity INTEGER NOT NULL,unit_price_cents INTEGER NOT NULL,total_cents INTEGER NOT NULL,FOREIGN KEY(quote_id) REFERENCES quotes(id) ON DELETE CASCADE);
  CREATE INDEX IF NOT EXISTS idx_sales_sold_at ON sales(sold_at);
  CREATE TABLE IF NOT EXISTS appointments(id INTEGER PRIMARY KEY AUTOINCREMENT,type TEXT NOT NULL,customer_id INTEGER NOT NULL,customer_name TEXT NOT NULL,title TEXT NOT NULL DEFAULT '',scheduled_at TEXT NOT NULL,alert_at TEXT,amount_cents INTEGER NOT NULL DEFAULT 0,status TEXT NOT NULL DEFAULT 'PENDENTE',attendance TEXT DEFAULT '',sale_id INTEGER,notes TEXT DEFAULT '',alerted INTEGER NOT NULL DEFAULT 0,completed_at TEXT,paid_cents INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL,FOREIGN KEY(customer_id) REFERENCES customers(id));
  CREATE TABLE IF NOT EXISTS internal_appointments(id INTEGER PRIMARY KEY AUTOINCREMENT,task_kind TEXT NOT NULL DEFAULT 'OUTRO',title TEXT NOT NULL DEFAULT '',scheduled_at TEXT NOT NULL,alert_at TEXT,status TEXT NOT NULL DEFAULT 'PENDENTE',notes TEXT DEFAULT '',alerted INTEGER NOT NULL DEFAULT 0,completed_at TEXT,created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS activity_log(id INTEGER PRIMARY KEY AUTOINCREMENT,created_at TEXT NOT NULL,operator TEXT DEFAULT '',action TEXT NOT NULL,entity_type TEXT DEFAULT '',entity_id INTEGER,details TEXT DEFAULT '');
  CREATE TABLE IF NOT EXISTS cash_drawer_events(id INTEGER PRIMARY KEY AUTOINCREMENT,created_at TEXT NOT NULL,operator TEXT DEFAULT '',source TEXT NOT NULL,sale_id INTEGER,printer TEXT DEFAULT '',pin INTEGER DEFAULT 2,success INTEGER NOT NULL DEFAULT 0,error TEXT DEFAULT '');
  CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_customer_payments_customer ON customer_payments(customer_id);
  CREATE INDEX IF NOT EXISTS idx_appointments_scheduled ON appointments(scheduled_at);
  CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status,type);
  CREATE INDEX IF NOT EXISTS idx_internal_appointments_scheduled ON internal_appointments(scheduled_at);
  CREATE INDEX IF NOT EXISTS idx_internal_appointments_status ON internal_appointments(status,task_kind);
  CREATE INDEX IF NOT EXISTS idx_sale_payments_sale ON sale_payments(sale_id);
  CREATE INDEX IF NOT EXISTS idx_cash_withdrawals_cash ON cash_withdrawals(cash_register_id,created_at);
  `);
  // Migração segura da estrutura antiga: categorias passam a aceitar subcategorias
  // e o mesmo nome pode existir em categorias principais diferentes, como no PDV-Loja.
  const catCols=columnNames('categories');
  if(!catCols.includes('parent_id')) addColumn('categories','parent_id','INTEGER DEFAULT NULL');
  if(!catCols.includes('active')) addColumn('categories','active','INTEGER DEFAULT 1');
  const catSql=String(db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='categories'").get()?.sql||'');
  if(/name\s+TEXT\s+UNIQUE/i.test(catSql)){
    db.pragma('foreign_keys = OFF');
    db.exec(`CREATE TABLE categories_new(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,icon TEXT,parent_id INTEGER DEFAULT NULL,active INTEGER DEFAULT 1);`);
    db.exec(`INSERT INTO categories_new(id,name,icon,parent_id,active) SELECT id,name,icon,parent_id,COALESCE(active,1) FROM categories;`);
    db.exec(`DROP TABLE categories;`);
    db.exec(`ALTER TABLE categories_new RENAME TO categories;`);
    db.pragma('foreign_keys = ON');
  }
  addColumn('operators','password_hash',"TEXT DEFAULT ''"); addColumn('operators','role',"TEXT NOT NULL DEFAULT 'operator'");
  // Migração segura da estrutura antiga.
  addColumn('quotes','discount_percent','REAL NOT NULL DEFAULT 0'); addColumn('quotes','delivery_cents','INTEGER NOT NULL DEFAULT 0');
  addColumn('sales','status',"TEXT NOT NULL DEFAULT 'CONCLUIDA'");
  addColumn('sales','canceled_at',"TEXT DEFAULT ''");
  addColumn('sales','canceled_reason',"TEXT DEFAULT ''");
  addColumn('sales','canceled_by',"TEXT DEFAULT ''");
  addColumn('notes','active','INTEGER NOT NULL DEFAULT 1');
  addColumn('products','item_type',"TEXT NOT NULL DEFAULT 'PRODUCT'");
  addColumn('products','duration_minutes',"INTEGER NOT NULL DEFAULT 60");
  addColumn('products','barcode',"TEXT DEFAULT ''"); addColumn('products','ncm',"TEXT DEFAULT ''"); addColumn('products','cfop',"TEXT DEFAULT ''"); addColumn('products','cst_csosn',"TEXT DEFAULT ''"); addColumn('products','origin',"TEXT DEFAULT '0'"); addColumn('products','sale_mode',"TEXT NOT NULL DEFAULT 'UNIT'"); addColumn('products','linked_unit_product_id','INTEGER'); addColumn('products','default_units_per_kg','INTEGER NOT NULL DEFAULT 0'); addColumn('products','track_unit_stock','INTEGER NOT NULL DEFAULT 0'); addColumn('products','unit_stock','INTEGER NOT NULL DEFAULT 0'); addColumn('products','unit_min_stock','INTEGER NOT NULL DEFAULT 0');
  addColumn('sale_items','sale_mode',"TEXT NOT NULL DEFAULT 'UNIT'"); addColumn('sale_items','weight_grams','INTEGER NOT NULL DEFAULT 0'); addColumn('sale_items','volume_ml','INTEGER NOT NULL DEFAULT 0'); addColumn('sale_items','unit_count','INTEGER NOT NULL DEFAULT 0'); addColumn('sale_items','linked_unit_product_id','INTEGER');
  addColumn('quote_items','sale_mode',"TEXT NOT NULL DEFAULT 'UNIT'"); addColumn('quote_items','weight_grams','INTEGER NOT NULL DEFAULT 0'); addColumn('quote_items','volume_ml','INTEGER NOT NULL DEFAULT 0'); addColumn('quote_items','unit_count','INTEGER NOT NULL DEFAULT 0'); addColumn('quote_items','linked_unit_product_id','INTEGER');
  db.exec(`CREATE TABLE IF NOT EXISTS unit_stock_movements(id INTEGER PRIMARY KEY AUTOINCREMENT,product_id INTEGER NOT NULL,kind TEXT NOT NULL,quantity INTEGER NOT NULL,reason TEXT DEFAULT '',sale_id INTEGER,created_at TEXT NOT NULL); CREATE INDEX IF NOT EXISTS idx_unit_stock_movements_sale ON unit_stock_movements(sale_id);`);
  db.exec(`CREATE TABLE IF NOT EXISTS sale_mix_items(id INTEGER PRIMARY KEY AUTOINCREMENT,sale_item_id INTEGER NOT NULL,product_id INTEGER NOT NULL,product_name TEXT NOT NULL,quantity INTEGER NOT NULL,FOREIGN KEY(sale_item_id) REFERENCES sale_items(id) ON DELETE CASCADE); CREATE INDEX IF NOT EXISTS idx_sale_mix_items_sale_item ON sale_mix_items(sale_item_id);`);
  db.exec(`CREATE TABLE IF NOT EXISTS quote_mix_items(id INTEGER PRIMARY KEY AUTOINCREMENT,quote_item_id INTEGER NOT NULL,product_id INTEGER NOT NULL,product_name TEXT NOT NULL,quantity INTEGER NOT NULL,FOREIGN KEY(quote_item_id) REFERENCES quote_items(id) ON DELETE CASCADE); CREATE INDEX IF NOT EXISTS idx_quote_mix_items_quote_item ON quote_mix_items(quote_item_id);`);
  addColumn('sale_mix_items','weight_grams','INTEGER NOT NULL DEFAULT 0'); addColumn('sale_mix_items','volume_ml','INTEGER NOT NULL DEFAULT 0');
  addColumn('quote_mix_items','weight_grams','INTEGER NOT NULL DEFAULT 0'); addColumn('quote_mix_items','volume_ml','INTEGER NOT NULL DEFAULT 0');
  addColumn('appointments','delivery_method',"TEXT DEFAULT ''"); addColumn('appointments','delivery_address',"TEXT DEFAULT ''"); addColumn('appointments','delivery_phone',"TEXT DEFAULT ''");
  addColumn('stock_movements','sale_mode',"TEXT NOT NULL DEFAULT 'UNIT'"); addColumn('stock_movements','supplier_id','INTEGER');
  addColumn('activity_log','amount_cents','INTEGER NOT NULL DEFAULT 0'); addColumn('activity_log','event_group',"TEXT DEFAULT ''");
  addColumn('customers','person_type',"TEXT NOT NULL DEFAULT 'PF'"); addColumn('customers','cpf',"TEXT DEFAULT ''"); addColumn('customers','rg',"TEXT DEFAULT ''"); addColumn('customers','cnpj',"TEXT DEFAULT ''"); addColumn('customers','email',"TEXT DEFAULT ''"); addColumn('customers','address_number',"TEXT DEFAULT ''"); addColumn('customers','address_complement',"TEXT DEFAULT ''"); addColumn('customers','neighborhood',"TEXT DEFAULT ''"); addColumn('customers','city',"TEXT DEFAULT ''"); addColumn('customers','state',"TEXT DEFAULT ''"); addColumn('customers','cep',"TEXT DEFAULT ''"); addColumn('customers','ie',"TEXT DEFAULT ''"); addColumn('customers','im',"TEXT DEFAULT ''");
  addColumn('sales','customer_name',"TEXT DEFAULT ''"); addColumn('sales','customer_document',"TEXT DEFAULT ''"); addColumn('sales','customer_id','INTEGER'); addColumn('sales','amount_paid_cents','INTEGER NOT NULL DEFAULT 0'); addColumn('sales','due_cents','INTEGER NOT NULL DEFAULT 0');
  addColumn('sales','change_cents','INTEGER NOT NULL DEFAULT 0'); addColumn('sales','delivery_cents','INTEGER NOT NULL DEFAULT 0'); addColumn('sales','delivery_required','INTEGER NOT NULL DEFAULT 0'); addColumn('sales','delivery_method',"TEXT DEFAULT ''"); addColumn('sales','discount_cents','INTEGER NOT NULL DEFAULT 0'); addColumn('sales','discount_percent','REAL NOT NULL DEFAULT 0'); addColumn('sales','payment_json',"TEXT DEFAULT '[]'"); addColumn('sales','cash_register_id','INTEGER'); addColumn('products','supplier_id','INTEGER');addColumn('sales','quote_id','INTEGER');
  addColumn('fiscal_documents','protocol','TEXT'); addColumn('fiscal_documents','response_xml','TEXT'); addColumn('fiscal_documents','qr_url','TEXT'); addColumn('fiscal_documents','xml_path','TEXT'); addColumn('fiscal_documents','environment',"TEXT DEFAULT 'homologacao'"); addColumn('fiscal_documents','tp_emis','INTEGER DEFAULT 1');
  const q=db.prepare('INSERT INTO categories(name,icon,active) SELECT ?,?,1 WHERE NOT EXISTS (SELECT 1 FROM categories WHERE lower(name)=lower(?) AND parent_id IS NULL)'); CATEGORIES.forEach((x,i)=>q.run(x,CATEGORY_ICONS[i],x)); q.run('Kits / Combos','layers','Kits / Combos');
  addColumn('kits','category_id','INTEGER'); addColumn('kits','kit_type',"TEXT NOT NULL DEFAULT 'STANDARD'"); addColumn('kits','weight_product_id','INTEGER'); addColumn('kits','mix_category_id','INTEGER'); const kitCat=db.prepare("SELECT id FROM categories WHERE name='Kits / Combos'").get(); if(kitCat){db.prepare('UPDATE kits SET category_id=? WHERE category_id IS NULL').run(kitCat.id);}
  const COD_MUN_ARACATUBA='3502804';
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode) WHERE barcode IS NOT NULL AND barcode<>'';");
  // cleanup duplicate active categories: keep the oldest ID and preserve references
  // cleanup duplicate active categories
  const dupGroups=db.prepare("SELECT lower(name) name_key, COALESCE(parent_id,0) parent_key, MIN(id) keep_id, COUNT(*) n FROM categories WHERE active=1 GROUP BY lower(name), COALESCE(parent_id,0) HAVING COUNT(*)>1").all();
  for(const g of dupGroups){
    const dups=db.prepare("SELECT id FROM categories WHERE active=1 AND lower(name)=? AND COALESCE(parent_id,0)=? AND id<>?").all(g.name_key,g.parent_key,g.keep_id);
    for(const d of dups){
      db.prepare('UPDATE products SET category_id=? WHERE category_id=?').run(g.keep_id,d.id);
      db.prepare('UPDATE categories SET parent_id=? WHERE parent_id=?').run(g.keep_id,d.id);
      db.prepare('UPDATE categories SET active=0 WHERE id=?').run(d.id);
    }
  }
  const defaults={store_name:'Jhonnie Beer',theme:'jhonnie',operator:'',current_operator_id:'',current_operator_name:'',current_operator_photo:'',current_operator_role:'',logo_data:'',fiscal_series:'1',fiscal_next_number:'1',fiscal_environment:'homologacao',company_cnpj:'',company_ie:'',company_legal_name:'',company_fantasy_name:'',company_address:'',company_phone:'',company_city_code:COD_MUN_ARACATUBA,company_crt:'1',fiscal_csc_id:'',fiscal_csc_token:'',fiscal_cert_path:'',fiscal_cert_password_enc:'',fiscal_qrcode_version:'100',fiscal_contingency_enabled:'0',fiscal_last_test:'',fiscal_xml_root:'',backup_schedule_enabled:'0',backup_frequency:'daily',backup_time:'23:00',backup_day_of_week:'1',backup_day_of_month:'1',backup_last_run:'',backup_retention_count:'30',backup_last_error:'',backup_store_id:STORE_ID,last_backup_at:'',last_backup_path:'',cash_default_opening_enabled:'0',cash_default_opening_cents:'0',ux_grouped_sidebar:'1',ux_mode:'compact',scale_enabled:'0',scale_mode:'SIMULATION',scale_port:'COM1',scale_baud_rate:'9600',scale_data_bits:'8',scale_parity:'None',scale_stop_bits:'One',scale_handshake:'None',scale_read_timeout_ms:'1800',scale_request_type:'NONE',scale_request_text:'',scale_input_unit:'kg',scale_regex:'',scale_stable_token:'',scale_allow_manual:'1',scale_last_test_at:'',scale_last_test_status:'',scale_last_error:'',email_host:'',email_port:'587',email_secure:'0',email_sender_name:'',email_user:'',email_from:'',email_password_enc:''};
  const set=db.prepare('INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)'); Object.entries(defaults).forEach(([k,v])=>set.run(k,v));
  // Migração não destrutiva: bancos legados recebem identidade apenas se ainda não tiverem uma.
  const storedBackupIdentity=db.prepare("SELECT value FROM settings WHERE key='backup_store_id'").get();
  if(!storedBackupIdentity?.value) db.prepare("INSERT INTO settings(key,value) VALUES('backup_store_id',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(STORE_ID);
  const admin=db.prepare("SELECT id FROM operators WHERE name='Administrador' AND active=1 LIMIT 1").get(); if(!admin) db.prepare('INSERT INTO operators(name,photo_data,password_hash,role,active,created_at) VALUES(?,?,?,?,?,?)').run('Administrador','',sha256('admin'),'admin',1,now()); db.prepare("UPDATE operators SET role='admin' WHERE name='Administrador'").run(); db.prepare("UPDATE operators SET role='operator' WHERE name<>'Administrador'").run();
  const currentStore=db.prepare("SELECT value FROM settings WHERE key='store_name'").get(); if(!currentStore?.value || currentStore.value==='Minha Loja') db.prepare("UPDATE settings SET value='Minha Loja' WHERE key='store_name'").run();
  const currentFantasy=db.prepare("SELECT value FROM settings WHERE key='company_fantasy_name'").get(); if(!currentFantasy?.value) db.prepare("UPDATE settings SET value='Minha Loja' WHERE key='company_fantasy_name'").run();
}

function xmlEsc(v){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');}
function colName(n){let s='';while(n>0){const r=(n-1)%26;s=String.fromCharCode(65+r)+s;n=Math.floor((n-1)/26)}return s;}
function crc32(buf){let c=0xffffffff;for(const b of buf){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^(0xedb88320&-(c&1));}return (c^0xffffffff)>>>0;}
function u16(n){const b=Buffer.alloc(2);b.writeUInt16LE(n&0xffff,0);return b;}
function u32(n){const b=Buffer.alloc(4);b.writeUInt32LE(n>>>0,0);return b;}
function zipStore(entries){const chunks=[],central=[];let offset=0;const nowDate=new Date();const dosTime=(nowDate.getHours()<<11)|(nowDate.getMinutes()<<5)|Math.floor(nowDate.getSeconds()/2);const dosDate=((nowDate.getFullYear()-1980)<<9)|((nowDate.getMonth()+1)<<5)|nowDate.getDate();for(const e of entries){const name=Buffer.from(e.name,'utf8'),data=Buffer.isBuffer(e.data)?e.data:Buffer.from(e.data,'utf8'),crc=crc32(data);const local=Buffer.concat([Buffer.from([0x50,0x4b,0x03,0x04]),u16(20),u16(0),u16(0),u16(dosTime),u16(dosDate),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),name,data]);chunks.push(local);const cent=Buffer.concat([Buffer.from([0x50,0x4b,0x01,0x02]),u16(20),u16(20),u16(0),u16(0),u16(dosTime),u16(dosDate),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset),name]);central.push(cent);offset+=local.length;}const centralBuf=Buffer.concat(central),body=Buffer.concat(chunks);const end=Buffer.concat([Buffer.from([0x50,0x4b,0x05,0x06]),u16(0),u16(0),u16(entries.length),u16(entries.length),u32(centralBuf.length),u32(body.length),u16(0)]);return Buffer.concat([body,centralBuf,end]);}
function makeXlsx(sheets){
  const entries=[];const sheetNames=sheets.map((x,i)=>x.name||`Planilha ${i+1}`);const stylesRelId=`rId${sheets.length+1}`;
  const types=['<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>'];
  sheets.forEach((_,i)=>types.push(`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`));types.push('</Types>');
  entries.push({name:'[Content_Types].xml',data:types.join('')});
  entries.push({name:'_rels/.rels',data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>'});
  entries.push({name:'docProps/core.xml',data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:creator>Uni-PDV</dc:creator><cp:lastModifiedBy>Uni-PDV</cp:lastModifiedBy><dc:title>Relatório do Uni-PDV</dc:title></cp:coreProperties>`});
  entries.push({name:'docProps/app.xml',data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Uni-PDV</Application><AppVersion>3.1</AppVersion></Properties>'});
  entries.push({name:'xl/workbook.xml',data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>${sheetNames.map((n,i)=>`<sheet name="${xmlEsc(n).slice(0,31)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`});
  entries.push({name:'xl/_rels/workbook.xml.rels',data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="${stylesRelId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`});
  entries.push({name:'xl/styles.xml',data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;R$&quot; #,##0.00"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles><dxfs count="0"/><tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/></styleSheet>'});
  sheets.forEach((sheet,si)=>{let maxCol=1;const rows=sheet.rows||[];const xmlRows=rows.map((row,ri)=>{maxCol=Math.max(maxCol,row.length);return `<row r="${ri+1}">${row.map((cell,ci)=>{const c=typeof cell==='object'&&cell!==null?cell:{value:cell};const v=c.value??'';const ref=colName(ci+1)+(ri+1);if(typeof v==='number'&&Number.isFinite(v))return `<c r="${ref}"${c.style?' s="'+c.style+'"':''}><v>${v}</v></c>`;return `<c r="${ref}" t="inlineStr"${c.style?' s="'+c.style+'"':''}><is><t xml:space="preserve">${xmlEsc(v)}</t></is></c>`;}).join('')}</row>`}).join('');entries.push({name:`xl/worksheets/sheet${si+1}.xml`,data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${colName(maxCol)}${Math.max(rows.length,1)}"/><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="15"/><sheetData>${xmlRows}</sheetData><pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/></worksheet>`});});
  return zipStore(entries);
}
function gramsLabel(v){const g=Math.max(0,Number(v||0));return `${(g/1000).toLocaleString('pt-BR',{minimumFractionDigits:3,maximumFractionDigits:3})} kg`;}
function weightedQtyLabel(grams,units=0){const base=gramsLabel(grams);const n=Math.max(0,Math.round(Number(units||0)));return n?`${base} · ${n} un.`:base;}
function scaleSettings(){const s=Object.fromEntries(db.prepare('SELECT key,value FROM settings').all().map(x=>[x.key,x.value]));return {enabled:String(s.scale_enabled||'0')==='1',mode:String(s.scale_mode||'SIMULATION'),port:String(s.scale_port||'COM1'),baudRate:Math.max(300,Number(s.scale_baud_rate||9600)),dataBits:[7,8].includes(Number(s.scale_data_bits))?Number(s.scale_data_bits):8,parity:['None','Even','Odd','Mark','Space'].includes(String(s.scale_parity))?String(s.scale_parity):'None',stopBits:['One','Two','OnePointFive'].includes(String(s.scale_stop_bits))?String(s.scale_stop_bits):'One',handshake:['None','XOnXOff','RequestToSend','RequestToSendXOnXOff'].includes(String(s.scale_handshake))?String(s.scale_handshake):'None',readTimeout:Math.min(10000,Math.max(300,Number(s.scale_read_timeout_ms||1800))),requestType:['NONE','ENQ','TEXT'].includes(String(s.scale_request_type))?String(s.scale_request_type):'NONE',requestText:String(s.scale_request_text||''),inputUnit:String(s.scale_input_unit||'kg').toLowerCase()==='g'?'g':'kg',regex:String(s.scale_regex||''),stableToken:String(s.scale_stable_token||''),allowManual:String(s.scale_allow_manual||'1')!=='0',lastTestAt:String(s.scale_last_test_at||''),lastTestStatus:String(s.scale_last_test_status||''),lastError:String(s.scale_last_error||'')};}
function setSetting(key,value){db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,String(value??''));}
function psEncoded(script){return Buffer.from(String(script),'utf16le').toString('base64');}
function runPowerShell(script,timeoutMs=5000){return new Promise((resolve,reject)=>{if(process.platform!=='win32')return reject(Object.assign(new Error('A comunicação serial da balança só está disponível no Windows.'),{code:'SCALE_WINDOWS_ONLY'}));const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-EncodedCommand',psEncoded(script)],{windowsHide:true});let out='',err='',done=false;const finish=(error)=>{if(done)return;done=true;clearTimeout(timer);if(error)return reject(error);if(child.exitCode!==0&&err.trim())return reject(new Error(err.trim()));resolve(out.trim())};child.stdout.on('data',d=>out+=d.toString());child.stderr.on('data',d=>err+=d.toString());child.on('error',finish);child.on('close',code=>{child.exitCode=code;if(code!==0)return finish(new Error(err.trim()||`PowerShell encerrou com código ${code}.`));finish()});const timer=setTimeout(()=>{try{child.kill()}catch{};finish(Object.assign(new Error('Tempo esgotado aguardando resposta da balança.'),{code:'SCALE_TIMEOUT'}))},Math.max(1500,timeoutMs));});}
function scalePsConfig(c){return `$ErrorActionPreference='Stop';$p=New-Object System.IO.Ports.SerialPort;$p.PortName='${String(c.port).replace(/'/g,"''")}';$p.BaudRate=${Number(c.baudRate)};$p.DataBits=${Number(c.dataBits)};$p.Parity=[System.IO.Ports.Parity]::${c.parity};$p.StopBits=[System.IO.Ports.StopBits]::${c.stopBits};$p.Handshake=[System.IO.Ports.Handshake]::${c.handshake};$p.ReadTimeout=${Number(c.readTimeout)};$p.WriteTimeout=${Number(c.readTimeout)};`;}
async function scaleSerialTest(){const c=scaleSettings();if(!c.enabled)fail('Ative a balança nas Configurações antes de testar.','SCALE_DISABLED');if(c.mode!=='SERIAL')return {mode:c.mode,connected:true,message:'Modo de simulação ativo.'};const script=scalePsConfig(c)+`try{$p.Open();Write-Output 'OK'}finally{if($p.IsOpen){$p.Close()};$p.Dispose()}`;try{const out=await runPowerShell(script,c.readTimeout+2500);const success=/OK/.test(out);setSetting('scale_last_test_at',now());setSetting('scale_last_test_status',success?'OK':'ERRO');setSetting('scale_last_error',success?'':'A porta não confirmou abertura.');if(!success)fail('Não foi possível abrir a porta configurada.','SCALE_CONNECTION');return {mode:c.mode,connected:true,message:`${c.port} aberta com sucesso.`};}catch(e){setSetting('scale_last_test_at',now());setSetting('scale_last_test_status','ERRO');setSetting('scale_last_error',e.message||String(e));throw e;}}
function parseScaleRaw(raw,c){const text=String(raw||'').replace(/\0/g,'').trim();if(!text)fail('A balança não retornou dados.','SCALE_EMPTY');if(c.stableToken&&!text.includes(c.stableToken))fail(`A leitura ainda não foi marcada como estável pela balança (esperado: ${c.stableToken}).`,'SCALE_UNSTABLE');let token='';if(c.regex){let re;try{re=new RegExp(c.regex,'i')}catch{fail('A expressão de leitura configurada para a balança é inválida.','SCALE_REGEX')}const m=text.match(re);if(!m)fail('A resposta da balança não corresponde ao padrão configurado.','SCALE_PARSE');token=String(m[1]??m[0]??'');}else{const m=text.match(/[-+]?\d+(?:[\.,]\d+)?/g);if(!m?.length)fail('Não foi possível localizar um peso na resposta da balança.','SCALE_PARSE');token=m[m.length-1];}const n=Number(token.replace(',','.'));if(!Number.isFinite(n))fail('O peso recebido da balança é inválido.','SCALE_PARSE');const grams=Math.round(c.inputUnit==='g'?n:n*1000);if(grams<=0)fail('A balança retornou peso zero ou negativo.','SCALE_ZERO');return {raw:text,grams,kg:grams/1000};}
async function scaleSerialCapture(){const c=scaleSettings();if(!c.enabled)fail('A balança está desativada nas Configurações.','SCALE_DISABLED');if(c.mode!=='SERIAL')fail('A captura serial só é usada quando o modo Serial está ativo.','SCALE_MODE');const req64=Buffer.from(c.requestText||'','utf8').toString('base64');let request='';if(c.requestType==='ENQ')request=`$b=[byte[]](5);$p.Write($b,0,$b.Length);`;else if(c.requestType==='TEXT')request=`$t=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${req64}'));$p.Write($t);`;const script=scalePsConfig(c)+`try{$p.Open();${request}$deadline=[DateTime]::UtcNow.AddMilliseconds(${c.readTimeout});$buf='';do{Start-Sleep -Milliseconds 60;if($p.BytesToRead -gt 0){$buf+=$p.ReadExisting();Start-Sleep -Milliseconds 100;if($p.BytesToRead -gt 0){$buf+=$p.ReadExisting()};if($buf.Length -gt 0){break}}}while([DateTime]::UtcNow -lt $deadline);Write-Output ([Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($buf)))}finally{if($p.IsOpen){$p.Close()};$p.Dispose()}`;try{const encoded=await runPowerShell(script,c.readTimeout+3000);const raw=Buffer.from(String(encoded).trim(),'base64').toString('utf8');const parsed=parseScaleRaw(raw,c);setSetting('scale_last_test_at',now());setSetting('scale_last_test_status','OK');setSetting('scale_last_error','');return {...parsed,mode:'SERIAL',port:c.port};}catch(e){setSetting('scale_last_test_at',now());setSetting('scale_last_test_status','ERRO');setSetting('scale_last_error',e.message||String(e));throw e;}}
function activityGroupFor(entityType='',action=''){
  const t=String(entityType||'').toLowerCase(),a=String(action||'').toLowerCase();
  if(t==='cash'||t==='cash_withdrawal'||a.includes('caixa'))return 'cash';
  if(t==='sale'||a.includes('venda'))return 'sales';
  if(t==='product'||t==='category'||a.includes('produto')||a.includes('categoria')||a.includes('subcategoria'))return 'products';
  if(t==='stock'||t==='stock_movement'||a.includes('estoque'))return 'stock';
  return 'system';
}
function normalizeActivityDetails(details=''){
  return String(details||'').replace(/(\d+)\s+centavos\b/gi,(_,n)=>pdfMoney(Number(n)||0));
}
function normalizeActivityRow(row){
  if(!row)return row;
  return {...row,details:normalizeActivityDetails(row.details),amount_cents:Number(row.amount_cents||0),event_group:String(row.event_group||'').trim()||activityGroupFor(row.entity_type,row.action)};
}
function periodActivityRows(key,n){
  return db.prepare(`SELECT * FROM activity_log WHERE substr(created_at,1,${n})=? ORDER BY created_at DESC,id DESC`).all(key).map(normalizeActivityRow);
}
function periodStockRows(key,n){
  return db.prepare(`SELECT sm.*,p.name product_name,p.unit,COALESCE(sm.sale_mode,p.sale_mode,'UNIT') sale_mode,s.name supplier_name
    FROM stock_movements sm
    LEFT JOIN products p ON p.id=sm.product_id
    LEFT JOIN suppliers s ON s.id=sm.supplier_id
    WHERE substr(sm.created_at,1,${n})=?
    ORDER BY sm.created_at DESC,sm.id DESC`).all(key).map(x=>{
      const q=Math.max(0,Number(x.quantity||0)),cost=Math.max(0,Number(x.unit_cost_cents||0));
      const value=['WEIGHT','MIX_WEIGHT'].includes(String(x.sale_mode||'UNIT'))?Math.round(cost*q/1000):Math.round(cost*q);
      return {...x,quantity:q,unit_cost_cents:cost,value_cents:value};
    });
}
function reportData(mode,date,month,cashSummaryFn){
  const monthly=mode==='monthly';
  const key=monthly?String(month||'').slice(0,7):String(date||'').slice(0,10);
  const n=monthly?7:10;
  const sales=monthly
    ?db.prepare("SELECT substr(s.sold_at,1,10) date,COUNT(*) count,COALESCE(SUM(s.total_cents),0) total,COALESCE(SUM(s.amount_paid_cents),0) paid,COALESCE(SUM(s.due_cents),0) due FROM sales s WHERE substr(s.sold_at,1,7)=? AND COALESCE(s.status,'CONCLUIDA')<>'CANCELADA' GROUP BY substr(s.sold_at,1,10) ORDER BY date DESC").all(key)
    :db.prepare("SELECT s.id,s.sold_at,s.operator,s.customer_name,s.total_cents,s.amount_paid_cents,s.due_cents,s.payment,s.delivery_required,s.delivery_method FROM sales s WHERE substr(s.sold_at,1,10)=? AND COALESCE(s.status,'CONCLUIDA')<>'CANCELADA' ORDER BY s.sold_at DESC").all(key);
  const totals=db.prepare(`SELECT COUNT(*) count,COALESCE(SUM(total_cents),0) total,COALESCE(SUM(amount_paid_cents),0) paid,COALESCE(SUM(due_cents),0) due FROM sales WHERE substr(sold_at,1,${n})=? AND COALESCE(status,'CONCLUIDA')<>'CANCELADA'`).get(key);
  const cash=db.prepare(`SELECT * FROM cash_registers WHERE substr(opening_date,1,${n})=? ORDER BY opened_at ${monthly?'DESC':'ASC'}`).all(key).map(c=>cashSummaryFn(c.id));
  const items=db.prepare(`SELECT si.name,COALESCE(si.sale_mode,'UNIT') sale_mode,SUM(CASE WHEN COALESCE(si.sale_mode,'UNIT') IN ('WEIGHT','MIX_WEIGHT') THEN 0 ELSE si.quantity END) quantity,SUM(CASE WHEN COALESCE(si.sale_mode,'UNIT') IN ('WEIGHT','MIX_WEIGHT') THEN COALESCE(si.weight_grams,0) ELSE 0 END) weight_grams,SUM(CASE WHEN COALESCE(si.sale_mode,'UNIT') IN ('WEIGHT','MIX_WEIGHT') THEN COALESCE(si.unit_count,0) ELSE 0 END) unit_count,SUM(si.total_cents) total_cents FROM sale_items si JOIN sales s ON s.id=si.sale_id WHERE substr(s.sold_at,1,${n})=? AND COALESCE(s.status,'CONCLUIDA')<>'CANCELADA' GROUP BY si.name,COALESCE(si.sale_mode,'UNIT') ORDER BY total_cents DESC,si.name`).all(key);
  // Rentabilidade estimada: usa o custo atual cadastrado, não um custo histórico congelado na venda.
  const profitLines=db.prepare(`SELECT si.id,si.name,si.product_id,si.kit_id,COALESCE(si.sale_mode,'UNIT') sale_mode,si.quantity,COALESCE(si.weight_grams,0) weight_grams,si.total_cents revenue_cents,
    CASE
      WHEN COALESCE(si.sale_mode,'UNIT')='MIX_WEIGHT' THEN NULL
      WHEN p.id IS NOT NULL AND COALESCE(p.cost_cents,0)>0 AND COALESCE(si.sale_mode,'UNIT')='WEIGHT' THEN ROUND(p.cost_cents*COALESCE(si.weight_grams,0)/1000.0)
      WHEN p.id IS NOT NULL AND COALESCE(p.cost_cents,0)>0 THEN p.cost_cents*COALESCE(si.quantity,0)
      WHEN si.kit_id IS NOT NULL AND COALESCE(kc.cost_cents,0)>0 THEN kc.cost_cents*COALESCE(si.quantity,0)
      ELSE NULL END estimated_cost_cents
    FROM sale_items si JOIN sales s ON s.id=si.sale_id
    LEFT JOIN products p ON p.id=si.product_id
    LEFT JOIN (SELECT ki.kit_id,SUM(ki.quantity*COALESCE(p2.cost_cents,0)) cost_cents, SUM(CASE WHEN COALESCE(p2.cost_cents,0)<=0 THEN 1 ELSE 0 END) missing_costs FROM kit_items ki JOIN products p2 ON p2.id=ki.product_id GROUP BY ki.kit_id) kc ON kc.kit_id=si.kit_id AND COALESCE(kc.missing_costs,0)=0
    WHERE substr(s.sold_at,1,${n})=? AND COALESCE(s.status,'CONCLUIDA')<>'CANCELADA'`).all(key);
  const profitMap=new Map();
  for(const line of profitLines){
    const id=line.product_id?`p:${line.product_id}`:line.kit_id?`k:${line.kit_id}`:`x:${line.name}`;
    let row=profitMap.get(id);
    if(!row){row={id,name:line.name,lines:0,costed_lines:0,revenue_cents:0,revenue_with_cost_cents:0,estimated_cost_cents:0};profitMap.set(id,row);}
    const revenue=Math.max(0,Number(line.revenue_cents||0));row.lines++;row.revenue_cents+=revenue;
    if(line.estimated_cost_cents!==null&&line.estimated_cost_cents!==undefined){row.costed_lines++;row.revenue_with_cost_cents+=revenue;row.estimated_cost_cents+=Math.max(0,Number(line.estimated_cost_cents||0));}
  }
  const profitability=[...profitMap.values()].map(x=>({...x,estimated_gross_profit_cents:x.revenue_with_cost_cents-x.estimated_cost_cents,estimated_margin_percent:x.revenue_with_cost_cents>0?Math.round((x.revenue_with_cost_cents-x.estimated_cost_cents)*10000/x.revenue_with_cost_cents)/100:null,missing_cost_lines:x.lines-x.costed_lines})).sort((a,b)=>b.estimated_gross_profit_cents-a.estimated_gross_profit_cents);
  const profitabilityTotals=profitability.reduce((t,x)=>({revenue_cents:t.revenue_cents+x.revenue_cents,revenue_with_cost_cents:t.revenue_with_cost_cents+x.revenue_with_cost_cents,estimated_cost_cents:t.estimated_cost_cents+x.estimated_cost_cents,estimated_gross_profit_cents:t.estimated_gross_profit_cents+x.estimated_gross_profit_cents,lines:t.lines+x.lines,costed_lines:t.costed_lines+x.costed_lines,missing_cost_lines:t.missing_cost_lines+x.missing_cost_lines}),{revenue_cents:0,revenue_with_cost_cents:0,estimated_cost_cents:0,estimated_gross_profit_cents:0,lines:0,costed_lines:0,missing_cost_lines:0});
  profitabilityTotals.estimated_margin_percent=profitabilityTotals.revenue_with_cost_cents>0?Math.round(profitabilityTotals.estimated_gross_profit_cents*10000/profitabilityTotals.revenue_with_cost_cents)/100:null;

  const withdrawals=db.prepare(`SELECT w.*,c.opening_date FROM cash_withdrawals w JOIN cash_registers c ON c.id=w.cash_register_id WHERE substr(w.created_at,1,${n})=? ORDER BY w.created_at DESC`).all(key);
  const withdrawalTotal=withdrawals.reduce((sum,x)=>sum+Number(x.amount_cents||0),0);
  const activities=periodActivityRows(key,n);
  const productEvents=activities.filter(x=>x.event_group==='products');
  const stockMovements=periodStockRows(key,n);
  const stockIn=stockMovements.filter(x=>String(x.kind)==='IN').length;
  const stockOut=stockMovements.filter(x=>String(x.kind)==='OUT').length;
  return {mode:monthly?'monthly':'daily',period:key,sales,totals,cash,items,profitability,profitability_totals:profitabilityTotals,withdrawals,withdrawal_total_cents:withdrawalTotal,activities,product_events:productEvents,stock_movements:stockMovements,stock_in_count:stockIn,stock_out_count:stockOut};
}
function getPdfDocument(){
  if(PDFDocument)return PDFDocument;
  try{PDFDocument=require('pdfkit');return PDFDocument;}
  catch(e){const err=new Error('O módulo de geração de PDF não está disponível. Instale pdfkit@0.14.0 antes de gerar o aplicativo.');err.code='PDF_MODULE';throw err;}
}
function pdfMoney(c){return (Number(c||0)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});}
function pdfDateOnly(v){if(!v)return '—';const raw=String(v);const d=/^\d{4}-\d{2}-\d{2}$/.test(raw)?new Date(raw+'T12:00:00'):new Date(raw);return Number.isNaN(d.getTime())?'—':d.toLocaleDateString('pt-BR');}
function pdfDateTime(v){if(!v)return '—';const d=new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleString('pt-BR');}
function pdfImageFromDataUrl(data){const m=String(data||'').match(/^data:image\/(png|jpe?g);base64,([A-Za-z0-9+/=\r\n]+)$/i);if(!m)return null;try{return Buffer.from(m[2].replace(/\s/g,''),'base64')}catch{return null}}
function pdfFormatCnpj(v){const d=String(v||'').replace(/\D/g,'').slice(0,14);return d.length===14?`${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`:String(v||'').trim();}
function pdfFormatPhone(v){const d=String(v||'').replace(/\D/g,'').slice(0,11);if(d.length===11)return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;if(d.length===10)return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;return String(v||'').trim();}
function pdfCompanyLines(settings){const lines=[];const phone=String(settings?.company_phone||'').trim();const cnpj=String(settings?.company_cnpj||'').trim();const address=String(settings?.company_address||'').trim();if(phone)lines.push(`Telefone: ${pdfFormatPhone(phone)}`);if(cnpj)lines.push(`CNPJ: ${pdfFormatCnpj(cnpj)}`);if(address)lines.push(address);return lines;}
function pdfStoreLogo(settings){const custom=pdfImageFromDataUrl(settings?.logo_data);if(custom)return custom;for(const file of [path.join(__dirname,'..','assets','icon.png'),path.join(app.getAppPath(),'assets','icon.png')]){try{if(fs.existsSync(file))return file}catch{}}return null;}
function writePdfFile(out,options,build){
  const PDF=getPdfDocument();
  return new Promise((resolve,reject)=>{
    const doc=new PDF(options);
    const stream=fs.createWriteStream(out);
    let settled=false;
    const failPdf=e=>{if(settled)return;settled=true;try{stream.destroy()}catch{};reject(e)};
    stream.on('error',failPdf);doc.on('error',failPdf);
    stream.on('finish',()=>{if(settled)return;settled=true;resolve(out)});
    doc.pipe(stream);
    try{build(doc);doc.end()}catch(e){failPdf(e)}
  });
}
function pdfRowHeight(doc,row,widths,fontSize=8,aligns=[]){
  doc.font('Helvetica').fontSize(fontSize);
  return Math.max(20,...row.map((cell,i)=>doc.heightOfString(String(cell??''),{width:Math.max(10,widths[i]-8),align:aligns[i]||'left'})+10));
}
function pdfDrawRow(doc,row,widths,{header=false,fontSize=8,aligns=[]}={}){
  const x0=doc.page.margins.left,y=doc.y,h=pdfRowHeight(doc,row,widths,fontSize,aligns);
  if(header){doc.save().fillColor('#eeeeee').rect(x0,y,widths.reduce((a,b)=>a+b,0),h).fill().restore()}
  let x=x0;
  for(let i=0;i<row.length;i++){
    const w=widths[i],align=aligns[i]||'left';
    doc.save().strokeColor('#c8c8c8').lineWidth(.5).rect(x,y,w,h).stroke().restore();
    doc.font(header?'Helvetica-Bold':'Helvetica').fontSize(fontSize).fillColor('#222222').text(String(row[i]??''),x+4,y+5,{width:w-8,height:h-8,ellipsis:true,align});
    x+=w;
  }
  doc.x=x0;doc.y=y+h;
}
function pdfTable(doc,headers,rows,widths,{fontSize=8,aligns=[]}={}){
  const bottom=()=>doc.page.height-doc.page.margins.bottom;
  const header=()=>pdfDrawRow(doc,headers,widths,{header:true,fontSize,aligns});
  if(doc.y+pdfRowHeight(doc,headers,widths,fontSize,aligns)>bottom())doc.addPage();
  header();
  for(const row of rows){
    const h=pdfRowHeight(doc,row,widths,fontSize,aligns);
    if(doc.y+h>bottom()){doc.addPage();header()}
    pdfDrawRow(doc,row,widths,{fontSize,aligns});
  }
  doc.x=doc.page.margins.left;doc.moveDown(.7);
}
async function writeQuotePdf(out,q,settings){
  return writePdfFile(out,{size:'A4',margin:40,info:{Title:`Orçamento #${q.number}`,Author:settings.store_name||'Minha Loja'}},doc=>{
    const left=doc.page.margins.left,right=doc.page.width-doc.page.margins.right,width=right-left;
    const logo=pdfStoreLogo(settings);
    const companyLines=pdfCompanyLines(settings);
    let textX=left;
    if(logo){try{doc.image(logo,left,38,{fit:[62,62],align:'center',valign:'center'});textX=left+74}catch{}}
    const companyWidth=Math.max(230,right-190-textX);
    doc.font('Helvetica-Bold').fontSize(16).fillColor('#222222').text(settings.store_name||'Minha Loja',textX,40,{width:companyWidth});
    let cy=62;
    doc.font('Helvetica').fontSize(8).fillColor('#555555');
    for(const line of companyLines){doc.text(line,textX,cy,{width:companyWidth});cy=doc.y+1}
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#444444').text('ORÇAMENTO',right-155,40,{width:155,align:'right'});
    doc.font('Helvetica-Bold').fontSize(20).fillColor('#222222').text(`#${q.number}`,right-155,55,{width:155,align:'right'});
    doc.font('Helvetica').fontSize(8).fillColor('#666666').text(`Emitido em ${pdfDateOnly(q.created_at)}`,right-180,81,{width:180,align:'right'});
    const headerBottom=Math.max(108,cy+5);
    doc.moveTo(left,headerBottom).lineTo(right,headerBottom).lineWidth(1.4).strokeColor('#333333').stroke();
    doc.y=headerBottom+14;
    const metaY=doc.y;
    const col=width/2;
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#333333').text('Cliente',left,metaY,{width:col-10});
    doc.font('Helvetica').fontSize(9).text(q.customer_name||'Cliente não informado',left,metaY+12,{width:col-10});
    doc.font('Helvetica-Bold').fontSize(8).text('Telefone',left+col,metaY,{width:col});
    doc.font('Helvetica').fontSize(9).text(q.customer_phone||'—',left+col,metaY+12,{width:col});
    doc.font('Helvetica-Bold').fontSize(8).text('Endereço',left,metaY+36,{width:col-10});
    doc.font('Helvetica').fontSize(9).text(q.customer_address||'—',left,metaY+48,{width:col-10});
    doc.font('Helvetica-Bold').fontSize(8).text('Validade',left+col,metaY+36,{width:col});
    doc.font('Helvetica').fontSize(9).text(pdfDateOnly(q.valid_until),left+col,metaY+48,{width:col});
    doc.y=metaY+78;
    const itemWidths=[width-80-110-90,80,110,90];
    pdfTable(doc,['Produto / Item','Qtd.','Valor unitário','Total'],(q.items||[]).map(i=>[String(i.sale_mode||'UNIT')==='MIX_WEIGHT'&&i.mix_items?.length?`${i.name}\n${i.mix_items.map(x=>`${x.quantity} ${x.name} · ${gramsLabel(x.weight_grams||0)}`).join(' · ')}`:i.name,['WEIGHT','MIX_WEIGHT'].includes(String(i.sale_mode||'UNIT'))?weightedQtyLabel(i.weight_grams,i.unit_count):i.quantity,`${pdfMoney(i.unit_price_cents)}${['WEIGHT','MIX_WEIGHT'].includes(String(i.sale_mode||'UNIT'))?'/kg':''}`,pdfMoney(i.total_cents)]),itemWidths,{fontSize:8,aligns:['left','right','right','right']});
    const totalsX=right-230;
    const line=(label,value,bold=false)=>{const y=doc.y;doc.font(bold?'Helvetica-Bold':'Helvetica').fontSize(bold?11:9).fillColor('#222222').text(label,totalsX,y,{width:115});doc.text(value,totalsX+115,y,{width:115,align:'right'});doc.y=Math.max(doc.y,y+(bold?17:14));};
    line('Subtotal',pdfMoney(q.subtotal_cents));
    if(Number(q.discount_cents)>0)line(`Desconto${Number(q.discount_percent)>0?` (${Number(q.discount_percent).toLocaleString('pt-BR',{maximumFractionDigits:2})}%)`:''}`,`- ${pdfMoney(q.discount_cents)}`);
    if(Number(q.delivery_cents)>0)line('Entrega',`+ ${pdfMoney(q.delivery_cents)}`);
    doc.moveTo(totalsX,doc.y+2).lineTo(right,doc.y+2).strokeColor('#333333').stroke();doc.y+=7;
    line('Total do orçamento',pdfMoney(q.total_cents),true);
    doc.x=left;
    if(q.notes){doc.moveDown(.6);doc.font('Helvetica-Bold').fontSize(9).fillColor('#222222').text('Observações',left,doc.y,{width});doc.font('Helvetica').fontSize(9).text(String(q.notes),left,doc.y,{width,align:'left'});}
    doc.x=left;doc.moveDown(.8);doc.font('Helvetica').fontSize(8).fillColor('#666666').text(`Validade deste orçamento: ${pdfDateOnly(q.valid_until)}. Este documento é um orçamento e não representa uma venda realizada.`,left,doc.y,{width,align:'left'});
    doc.x=left;doc.moveDown(1.5);doc.moveTo(left,doc.y).lineTo(right,doc.y).strokeColor('#dddddd').stroke();doc.moveDown(.5);
    doc.font('Helvetica').fontSize(7).fillColor('#777777').text(`${settings.store_name||'Minha Loja'} · Orçamento #${q.number}`,left,doc.y,{width,align:'center'});
  });
}
async function writeReportPdf(out,data,settings){
  return writePdfFile(out,{size:'A4',layout:'landscape',margin:34,info:{Title:`Relatório ${data.period}`,Author:settings.store_name||'Minha Loja'}},doc=>{
    const left=doc.page.margins.left,right=doc.page.width-doc.page.margins.right,width=right-left;
    const title=data.mode==='daily'?`Relatório diário — ${data.period}`:`Relatório mensal — ${data.period}`;
    const logo=pdfStoreLogo(settings);
    const companyLines=pdfCompanyLines(settings);
    let textX=left;
    if(logo){try{doc.image(logo,left,30,{fit:[58,58],align:'center',valign:'center'});textX=left+70}catch{}}
    const companyWidth=Math.max(300,right-280-textX);
    doc.font('Helvetica-Bold').fontSize(16).fillColor('#222222').text(settings.store_name||'Minha Loja',textX,32,{width:companyWidth});
    let cy=54;
    doc.font('Helvetica').fontSize(8).fillColor('#555555');
    for(const line of companyLines){doc.text(line,textX,cy,{width:companyWidth});cy=doc.y+1}
    doc.font('Helvetica-Bold').fontSize(14).fillColor('#222222').text('RELATÓRIO',right-250,34,{width:250,align:'right'});
    doc.font('Helvetica').fontSize(9).fillColor('#666666').text(title,right-300,56,{width:300,align:'right'});
    const headerBottom=Math.max(92,cy+5);
    doc.moveTo(left,headerBottom).lineTo(right,headerBottom).lineWidth(1.2).strokeColor('#333333').stroke();
    doc.y=headerBottom+13;
    const summary=[['Vendas',String(data.totals.count||0)],['Total vendido',pdfMoney(data.totals.total)],['Total recebido',pdfMoney(data.totals.paid)],['Débitos',pdfMoney(data.totals.due)]];
    const cardW=width/4;
    const y=doc.y;
    summary.forEach((c,i)=>{const x=left+i*cardW;doc.save().strokeColor('#cccccc').rect(x,y,cardW-6,38).stroke().restore();doc.font('Helvetica').fontSize(7).fillColor('#666666').text(c[0],x+6,y+6,{width:cardW-18});doc.font('Helvetica-Bold').fontSize(10).fillColor('#222222').text(c[1],x+6,y+18,{width:cardW-18});});
    doc.y=y+52;
    doc.x=left;doc.font('Helvetica-Bold').fontSize(11).fillColor('#222222').text('Vendas',left,doc.y,{width,align:'left'});doc.moveDown(.35);
    if(data.mode==='daily'){
      pdfTable(doc,['Data/hora','Venda','Operador','Cliente','Pagamento','Total'],(data.sales||[]).map(x=>[pdfDateTime(x.sold_at),`#${x.id}`,x.operator||'—',x.customer_name||'—',x.payment||'—',pdfMoney(x.total_cents)]),[110,45,95,150,145,95],{fontSize:7,aligns:['left','center','left','left','left','right']});
    }else{
      pdfTable(doc,['Data','Vendas','Total vendido','Recebido','Débitos'],(data.sales||[]).map(x=>[pdfDateOnly(x.date),x.count,pdfMoney(x.total),pdfMoney(x.paid),pdfMoney(x.due)]),[110,80,145,145,145],{fontSize:8,aligns:['left','right','right','right','right']});
    }
    doc.x=left;doc.font('Helvetica-Bold').fontSize(11).fillColor('#222222').text('Fechamentos de caixa',left,doc.y,{width,align:'left'});doc.moveDown(.35);
    pdfTable(doc,['Abertura','Fechamento','Operador','Inicial','Vendas','Retiradas','Saldo estimado','Status'],(data.cash||[]).map(x=>[pdfDateTime(x.opened_at),x.closed_at?pdfDateTime(x.closed_at):'—',x.operator||'—',pdfMoney(x.opening_cents),pdfMoney(x.total_sales_cents),pdfMoney(x.total_withdrawals_cents),pdfMoney(x.expected_total_cents),x.closing_status||'']),[90,90,80,75,80,80,90,65],{fontSize:6.7,aligns:['left','left','left','right','right','right','right','center']});
    if((data.withdrawals||[]).length){doc.x=left;doc.font('Helvetica-Bold').fontSize(11).fillColor('#222222').text('Retiradas / sangrias de caixa',left,doc.y,{width,align:'left'});doc.moveDown(.35);pdfTable(doc,['Data/hora','Operador','Motivo','Valor'],(data.withdrawals||[]).map(x=>[pdfDateTime(x.created_at),x.operator||'—',x.reason||'—',pdfMoney(x.amount_cents)]),[125,110,350,100],{fontSize:7,aligns:['left','left','left','right']});}
    doc.x=left;doc.font('Helvetica-Bold').fontSize(11).fillColor('#222222').text('Itens vendidos — conferência / inventário',left,doc.y,{width,align:'left'});doc.moveDown(.35);
    pdfTable(doc,['Item','Quantidade','Valor total'],(data.items||[]).map(x=>[x.name,['WEIGHT','MIX_WEIGHT'].includes(String(x.sale_mode||'UNIT'))?weightedQtyLabel(x.weight_grams,x.unit_count):x.quantity,pdfMoney(x.total_cents)]),[430,95,140],{fontSize:8,aligns:['left','right','right']});
    if((data.product_events||[]).length){
      doc.x=left;doc.font('Helvetica-Bold').fontSize(11).fillColor('#222222').text('Produtos e categorias — atividades',left,doc.y,{width,align:'left'});doc.moveDown(.35);
      pdfTable(doc,['Data/hora','Ação','Registro','Operador','Detalhes'],(data.product_events||[]).map(x=>[pdfDateTime(x.created_at),x.action||'—',`${x.entity_type||'registro'}${x.entity_id?` #${x.entity_id}`:''}`,x.operator||'Sistema',x.details||'—']),[105,145,90,95,250],{fontSize:6.7,aligns:['left','left','left','left','left']});
    }
    if((data.stock_movements||[]).length){
      doc.x=left;doc.font('Helvetica-Bold').fontSize(11).fillColor('#222222').text('Movimentações de estoque',left,doc.y,{width,align:'left'});doc.moveDown(.35);
      pdfTable(doc,['Data/hora','Mov.','Produto','Quantidade','Motivo','Valor ref.'],(data.stock_movements||[]).map(x=>[pdfDateTime(x.created_at),x.kind==='IN'?'Entrada':'Saída',x.product_name||`Produto #${x.product_id}`,['WEIGHT','MIX_WEIGHT'].includes(String(x.sale_mode||'UNIT'))?gramsLabel(x.quantity):`${x.quantity} ${x.unit||'un'}`,x.reason||'—',Number(x.value_cents||0)>0?pdfMoney(x.value_cents):'—']),[100,58,160,90,235,85],{fontSize:6.5,aligns:['left','center','left','right','left','right']});
    }
    if((data.activities||[]).length){
      doc.x=left;doc.font('Helvetica-Bold').fontSize(11).fillColor('#222222').text('Histórico de atividades',left,doc.y,{width,align:'left'});doc.moveDown(.35);
      pdfTable(doc,['Data/hora','Grupo','Ação','Operador','Detalhes','Valor'],(data.activities||[]).map(x=>[pdfDateTime(x.created_at),x.event_group||'system',x.action||'—',x.operator||'Sistema',x.details||'—',Number(x.amount_cents||0)>0?pdfMoney(x.amount_cents):'—']),[100,75,140,90,255,80],{fontSize:6.2,aligns:['left','left','left','left','left','right']});
    }
  });
}
function activity(operator,action,entityType='',entityId=null,details='',amountCents=0,eventGroup=''){
  try{
    const group=String(eventGroup||'').trim()||activityGroupFor(entityType,action);
    db.prepare('INSERT INTO activity_log(created_at,operator,action,entity_type,entity_id,details,amount_cents,event_group) VALUES(?,?,?,?,?,?,?,?)')
      .run(now(),String(operator||''),String(action||''),String(entityType||''),entityId==null?null:Number(entityId),normalizeActivityDetails(details),Math.round(Number(amountCents||0)),group);
  }catch{}
}
function uxOverview(){
  const d=new Date(),pad=n=>String(n).padStart(2,'0'),today=`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const cash=db.prepare("SELECT * FROM cash_registers WHERE closing_status='ABERTO' ORDER BY id DESC LIMIT 1").get();
  const low=db.prepare("SELECT id,name,stock,min_stock,unit,COALESCE(sale_mode,'UNIT') sale_mode,COALESCE(track_unit_stock,0) track_unit_stock,COALESCE(unit_stock,0) unit_stock,COALESCE(unit_min_stock,0) unit_min_stock FROM products WHERE active=1 AND COALESCE(item_type,'PRODUCT')='PRODUCT' AND (stock<=min_stock OR (COALESCE(track_unit_stock,0)=1 AND unit_stock<=unit_min_stock)) ORDER BY stock ASC,name LIMIT 50").all();
  const lowCount=Number(db.prepare("SELECT COUNT(*) n FROM products WHERE active=1 AND COALESCE(item_type,'PRODUCT')='PRODUCT' AND (stock<=min_stock OR (COALESCE(track_unit_stock,0)=1 AND unit_stock<=unit_min_stock))").get()?.n||0);
  const agendaCustomer=db.prepare("SELECT *, 'customer' agenda_source FROM appointments WHERE substr(scheduled_at,1,10)=? AND status='PENDENTE' ORDER BY scheduled_at LIMIT 50").all(today);
  const agendaInternal=db.prepare("SELECT id,'INTERNO' type,NULL customer_id,'Loja' customer_name,title,scheduled_at,alert_at,0 amount_cents,status,'' attendance,NULL sale_id,notes,alerted,completed_at,0 paid_cents,created_at,task_kind,'' delivery_method,'' delivery_address,'' delivery_phone,'internal' agenda_source FROM internal_appointments WHERE substr(scheduled_at,1,10)=? AND status='PENDENTE' ORDER BY scheduled_at LIMIT 50").all(today);
  const agenda=[...agendaCustomer,...agendaInternal].sort((a,b)=>String(a.scheduled_at).localeCompare(String(b.scheduled_at))).slice(0,50);
  const debt=db.prepare('SELECT COUNT(*) n,COALESCE(SUM(balance_cents),0) total FROM customers WHERE balance_cents>0').get();
  const quotes=db.prepare("SELECT COUNT(*) n FROM quotes WHERE status='ABERTO'").get();
  const sales=db.prepare("SELECT COUNT(*) n,COALESCE(SUM(total_cents),0) total FROM sales WHERE substr(sold_at,1,10)=? AND COALESCE(status,'CONCLUIDA')<>'CANCELADA'").get(today);
  const fiscal=db.prepare("SELECT COUNT(*) n FROM sales s LEFT JOIN fiscal_documents fd ON fd.sale_id=s.id WHERE fd.id IS NULL AND COALESCE(s.status,'CONCLUIDA')<>'CANCELADA'").get();
  const st=Object.fromEntries(db.prepare('SELECT key,value FROM settings').all().map(x=>[x.key,x.value]));
  const cashSales=cash?db.prepare("SELECT COUNT(*) count,COALESCE(SUM(total_cents),0) total FROM sales WHERE cash_register_id=? AND COALESCE(status,'CONCLUIDA')<>'CANCELADA'").get(cash.id):null;const cashWithdrawals=cash?Number(db.prepare('SELECT COALESCE(SUM(amount_cents),0) total FROM cash_withdrawals WHERE cash_register_id=?').get(cash.id)?.total||0):0;const cashInfo=cash?{...cash,sales_count:Number(cashSales?.count||0),total_sales_cents:Number(cashSales?.total||0),total_withdrawals_cents:cashWithdrawals,expected_total_cents:Math.max(0,Number(cash.opening_cents||0)+Number(cashSales?.total||0)-cashWithdrawals)}:null;return {today,cash:cashInfo,lowStock:low,lowStockCount:lowCount,agenda,debt,openQuotes:Number(quotes?.n||0),sales:{count:Number(sales?.n||0),total:Number(sales?.total||0)},fiscalPending:Number(fiscal?.n||0),lastBackupAt:st.last_backup_at||'',lastBackupPath:st.last_backup_path||''};
}


function backupDirectory(){ return path.join(app.getPath('documents'), APP_NAME, 'Backups'); }
function settingValue(key, value){
  db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, String(value ?? ''));
}
function backupManifestPath(filePath){ return `${filePath}.manifest.json`; }
function writeBackupManifest(filePath, createdAt=now()){
  const manifest={format:'uni-pdv-backup-manifest-v1',appId:STORE_ID,appName:APP_NAME,databaseFile:DB_FILE,createdAt};
  fs.writeFileSync(backupManifestPath(filePath), JSON.stringify(manifest,null,2), 'utf8');
  return manifest;
}
function cleanupOldBackups(dir){
  const configured=Number(db.prepare("SELECT value FROM settings WHERE key='backup_retention_count'").get()?.value||30);
  const keep=Math.max(5,Math.min(365,Number.isFinite(configured)?Math.floor(configured):30));
  const owned=[];
  for(const name of fs.readdirSync(dir)){
    if(!/^uni-pdv-backup-.*\.db$/i.test(name))continue;
    const filePath=path.join(dir,name), manifestPath=backupManifestPath(filePath);
    try{
      const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
      if(manifest?.appId===STORE_ID && fs.statSync(filePath).isFile()) owned.push({filePath,manifestPath,mtime:fs.statSync(filePath).mtimeMs});
    }catch{}
  }
  owned.sort((a,b)=>b.mtime-a.mtime);
  for(const item of owned.slice(keep)){
    try{fs.rmSync(item.filePath,{force:true});fs.rmSync(item.manifestPath,{force:true});}catch{}
  }
}
async function createStoreBackup({automatic=false,periodKey=''}={}){
  if(!db)throw new Error('O banco de dados não está disponível para backup.');
  const dir=backupDirectory();fs.mkdirSync(dir,{recursive:true});
  const stamp=new Date().toISOString().replace(/[:.]/g,'-');
  const out=path.join(dir,`uni-pdv-backup-${stamp}.db`);
  try{
    // Identidade gravada dentro do próprio banco e também em manifesto lateral.
    const identityRow=db.prepare("SELECT value FROM settings WHERE key='backup_store_id'").get();
    if(identityRow?.value && identityRow.value!==STORE_ID) throw new Error('A identidade do banco não corresponde a esta loja. O backup foi bloqueado para evitar misturar dados.');
    if(!identityRow?.value) settingValue('backup_store_id',STORE_ID);
    await db.backup(out);
    const t=now();
    writeBackupManifest(out,t);
    settingValue('last_backup_at',t);settingValue('last_backup_path',out);settingValue('backup_last_error','');
    if(periodKey)settingValue('backup_last_run',periodKey);
    activity('','Criou backup'+(automatic?' automático':''),'backup',null,out);
    cleanupOldBackups(dir);
    return out;
  }catch(error){
    try{if(fs.existsSync(out))fs.rmSync(out,{force:true});fs.rmSync(backupManifestPath(out),{force:true});}catch{}
    try{settingValue('backup_last_error',`${now()} — ${error?.message||String(error)}`);}catch{}
    try{activity('Sistema','Falha ao criar backup','backup',null,error?.message||String(error));}catch{}
    throw error;
  }
}
function localDateKey(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function startOfWeek(d){const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());x.setDate(x.getDate()-(x.getDay()+6)%7);return x;}
function scheduledBackupPeriod(d,s){
  const configuredTime=/^([01]\d|2[0-3]):[0-5]\d$/.test(String(s.backup_time||''))?String(s.backup_time):'23:00';
  const currentTime=`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  if(s.backup_frequency==='weekly'){
    const targetDow=Math.min(6,Math.max(0,Number(s.backup_day_of_week ?? 1)));
    const delta=(d.getDay()-targetDow+7)%7;
    const target=new Date(d.getFullYear(),d.getMonth(),d.getDate()-delta);
    if(delta===0 && currentTime<configuredTime)return '';
    return `weekly:${localDateKey(startOfWeek(target))}`;
  }
  if(s.backup_frequency==='monthly'){
    const desired=Math.min(31,Math.max(1,Number(s.backup_day_of_month||1)));
    const lastDay=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();
    const targetDay=Math.min(desired,lastDay);
    if(d.getDate()<targetDay || (d.getDate()===targetDay && currentTime<configuredTime))return '';
    return `monthly:${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  }
  if(currentTime<configuredTime)return '';
  return `daily:${localDateKey(d)}`;
}

function registerIpc(){
  ipcMain.handle('dashboard',()=>{const o=uxOverview();return ok({sales:{n:o.sales.count,total:o.sales.total},products:db.prepare("SELECT COUNT(*) n FROM products WHERE active=1 AND COALESCE(item_type,'PRODUCT')='PRODUCT'").get().n,lowStock:o.lowStockCount})});
  ipcMain.handle('ux:overview',()=>ok(uxOverview()));
  ipcMain.handle('ux:notifications',()=>{
    const o=uxOverview(),rows=[];
    if(o.lowStockCount)rows.push({id:'stock',kind:'warning',title:'Estoque mínimo atingido',message:`${o.lowStockCount} produto(s) estão no mínimo ou abaixo dele.`,page:'estoque',count:o.lowStockCount});
    const nd=new Date(),pp=n=>String(n).padStart(2,'0'),localNow=`${nd.getFullYear()}-${pp(nd.getMonth()+1)}-${pp(nd.getDate())}T${pp(nd.getHours())}:${pp(nd.getMinutes())}`;const overdueCustomer=Number(db.prepare("SELECT COUNT(*) n FROM appointments WHERE status='PENDENTE' AND scheduled_at<?").get(localNow)?.n||0),overdueInternal=Number(db.prepare("SELECT COUNT(*) n FROM internal_appointments WHERE status='PENDENTE' AND scheduled_at<?").get(localNow)?.n||0),overdue=overdueCustomer+overdueInternal;
    if(overdue>0)rows.push({id:'agenda-overdue',kind:'danger',title:'Compromissos pendentes',message:`${overdue} agendamento(s) estão pendentes.`,page:'agenda',count:overdue});
    if(o.openQuotes)rows.push({id:'quotes',kind:'info',title:'Orçamentos em aberto',message:`${o.openQuotes} orçamento(s) aguardam retorno.`,page:'orcamentos',count:o.openQuotes});
    if(o.fiscalPending)rows.push({id:'fiscal',kind:'warning',title:'Vendas sem NFC-e',message:`${o.fiscalPending} venda(s) ainda não possuem documento fiscal.`,page:'fiscal',count:o.fiscalPending});
    const sc=scaleSettings();
    if(sc.enabled&&sc.mode==='SERIAL'&&sc.lastTestStatus==='ERRO')rows.push({id:'scale',kind:'warning',title:'Balança requer atenção',message:`${sc.port}: ${sc.lastError||'a última comunicação não foi concluída.'}`,page:'config',count:1});
    return ok(rows);
  });
  ipcMain.handle('ux:search',(_,query='')=>{const q=String(query||'').trim();if(q.length<2)return ok([]);const like='%'+q+'%';const out=[];for(const x of db.prepare("SELECT id,name,stock,min_stock,unit,COALESCE(sale_mode,'UNIT') sale_mode FROM products WHERE active=1 AND (name LIKE ? OR COALESCE(sku,'') LIKE ? OR COALESCE(barcode,'') LIKE ?) ORDER BY name LIMIT 8").all(like,like,like))out.push({type:'product',id:x.id,title:x.name,subtitle:x.sale_mode==='WEIGHT'?`Estoque ${gramsLabel(x.stock)} · mínimo ${gramsLabel(x.min_stock)}`:`Estoque ${x.stock} ${x.unit||'un'} · mínimo ${x.min_stock}`,page:'produtos'});for(const x of db.prepare("SELECT id,name,phone,balance_cents FROM customers WHERE name LIKE ? OR COALESCE(phone,'') LIKE ? OR COALESCE(cpf,'') LIKE ? OR COALESCE(cnpj,'') LIKE ? ORDER BY name LIMIT 8").all(like,like,like,like))out.push({type:'customer',id:x.id,title:x.name,subtitle:`Cliente · saldo ${(Number(x.balance_cents||0)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}`,page:'clientes'});for(const x of db.prepare("SELECT id,number,customer_name,status,total_cents FROM quotes WHERE CAST(number AS TEXT) LIKE ? OR customer_name LIKE ? ORDER BY id DESC LIMIT 6").all(like,like))out.push({type:'quote',id:x.id,title:`Orçamento #${x.number}`,subtitle:`${x.customer_name||'Sem cliente'} · ${x.status}`,page:'orcamentos'});for(const x of db.prepare("SELECT id,sold_at,customer_name,total_cents,status FROM sales WHERE CAST(id AS TEXT) LIKE ? OR customer_name LIKE ? ORDER BY id DESC LIMIT 6").all(like,like))out.push({type:'sale',id:x.id,title:`Venda #${x.id}`,subtitle:`${x.customer_name||'Sem cliente'} · ${new Date(x.sold_at).toLocaleDateString('pt-BR')}`,page:'vendas'});return ok(out.slice(0,24));});
  ipcMain.handle('ux:diagnostics',()=>{
    const st=Object.fromEntries(db.prepare('SELECT key,value FROM settings').all().map(x=>[x.key,x.value]));
    let integrity='';try{integrity=String(db.pragma('integrity_check',{simple:true})||'ok')}catch(e){integrity=e.message}
    let foreignKeyViolations=[];try{foreignKeyViolations=db.pragma('foreign_key_check')}catch(e){foreignKeyViolations=[{error:e.message}]}
    const count=(sql)=>{try{return Number(db.prepare(sql).get()?.n||0)}catch{return -1}};
    const orphanSaleItems=count('SELECT COUNT(*) n FROM sale_items i LEFT JOIN sales s ON s.id=i.sale_id WHERE i.sale_id IS NOT NULL AND s.id IS NULL');
    const orphanSalePayments=count('SELECT COUNT(*) n FROM sale_payments p LEFT JOIN sales s ON s.id=p.sale_id WHERE s.id IS NULL');
    const invalidFinanceEntries=count("SELECT COUNT(*) n FROM finance_entries WHERE amount_cents<=0 OR status NOT IN ('PENDENTE','PAGO','CANCELADO') OR entry_type NOT IN ('COMPRA','DESPESA')");
    const backupDir=backupDirectory();const cert=String(st.fiscal_cert_path||'');const sc=scaleSettings();
    return ok({database:integrity==='ok',databaseDetail:integrity,foreignKeyViolations:foreignKeyViolations.length,foreignKeyDetails:foreignKeyViolations.slice(0,10),orphanSaleItems,orphanSalePayments,invalidFinanceEntries,backupDirectory:backupDir,backupDirectoryExists:fs.existsSync(backupDir),lastBackupAt:st.last_backup_at||'',lastBackupPath:st.last_backup_path||'',lastBackupError:st.backup_last_error||'',certificateConfigured:!!cert,certificateExists:!!cert&&fs.existsSync(cert),fiscalEnvironment:st.fiscal_environment||'homologacao',emailConfigured:!!st.email_host&&!!(st.email_from||st.email_user),scaleEnabled:sc.enabled,scaleMode:sc.mode,scalePort:sc.port,scaleLastStatus:sc.lastTestStatus,scaleLastTestAt:sc.lastTestAt,scaleLastError:sc.lastError,version:app.getVersion(),electron:process.versions.electron,node:process.versions.node,userData:app.getPath('userData')});
  });
  ipcMain.handle('scale:settings',()=>ok(scaleSettings()));
  ipcMain.handle('scale:list-ports',async()=>{if(process.platform!=='win32')return ok([]);try{const out=await runPowerShell("[System.IO.Ports.SerialPort]::GetPortNames() | Sort-Object",3000);return ok(String(out||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean));}catch{return ok([])}});
  ipcMain.handle('scale:test',async()=>ok(await scaleSerialTest()));
  ipcMain.handle('scale:capture',async()=>ok(await scaleSerialCapture()));
  ipcMain.handle('scale:status',()=>{const c=scaleSettings();return ok({enabled:c.enabled,mode:c.mode,port:c.port,ready:c.enabled&&(c.mode==='SIMULATION'||c.lastTestStatus==='OK'),lastTestAt:c.lastTestAt,lastTestStatus:c.lastTestStatus,lastError:c.lastError});});
  ipcMain.handle('activity:list',(_,opts=150)=>{
    if(typeof opts==='number')return ok(db.prepare('SELECT * FROM activity_log ORDER BY id DESC LIMIT ?').all(Math.min(1000,Math.max(1,Number(opts)||150))).map(normalizeActivityRow));
    const mode=opts?.mode==='monthly'?'monthly':'daily';
    const key=mode==='monthly'?String(opts?.month||'').slice(0,7):String(opts?.date||'').slice(0,10);
    const n=mode==='monthly'?7:10;
    const limit=Math.min(2000,Math.max(1,Number(opts?.limit)||1000));
    let rows=key?db.prepare(`SELECT * FROM activity_log WHERE substr(created_at,1,${n})=? ORDER BY created_at DESC,id DESC LIMIT ?`).all(key,limit):db.prepare('SELECT * FROM activity_log ORDER BY created_at DESC,id DESC LIMIT ?').all(limit);
    rows=rows.map(normalizeActivityRow);
    const group=String(opts?.group||'all');
    if(group!=='all')rows=rows.filter(x=>x.event_group===group);
    return ok(rows);
  });
  ipcMain.handle('settings:get',()=>ok(Object.fromEntries(db.prepare('SELECT key,value FROM settings').all().map(x=>[x.key,x.value]))));
  ipcMain.handle('settings:set',(_,s)=>{const q=db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');db.transaction(o=>Object.entries(o).forEach(([k,v])=>q.run(k,String(v))))(s);return ok(true)});
  function currentOperator(){const id=db.prepare("SELECT value FROM settings WHERE key='current_operator_id'").get()?.value;return id?db.prepare('SELECT * FROM operators WHERE id=? AND active=1').get(Number(id)):null;}
  function settingValue(key,fallback=''){return String(db.prepare('SELECT value FROM settings WHERE key=?').get(key)?.value??fallback);}
  function triggerCashDrawer(source,operator,saleId=null){
    const printer=settingValue('cash_drawer_printer_name','EPSON TM-T88V');
    const pin=Number(settingValue('cash_drawer_pin','2'));
    const pulseOnMs=Number(settingValue('cash_drawer_pulse_on_ms','100'));
    const pulseOffMs=Number(settingValue('cash_drawer_pulse_off_ms','100'));
    let result;
    try{result=cashDrawer.openDrawer({printer,pin,pulseOnMs,pulseOffMs});}catch(e){result={ok:false,error:e?.message||String(e)}}
    const error=String(result?.error||'');
    db.prepare('INSERT INTO cash_drawer_events(created_at,operator,source,sale_id,printer,pin,success,error) VALUES(?,?,?,?,?,?,?,?)').run(now(),String(operator||'Sistema'),source,saleId,printer,pin,result?.ok?1:0,error);
    activity(operator||'Sistema',result?.ok?'Abriu gaveta de dinheiro':'Falha ao abrir gaveta de dinheiro','cash_drawer',saleId,`${source==='AUTO'?'Automática':'Manual'} · ${printer} · ${result?.ok?'sucesso':error}`,0,'cash');
    return {...result,source,sale_id:saleId};
  }
  const requireLogin=()=>{const actor=currentOperator();if(!actor)fail('Faça login para continuar.','AUTH');return actor;};
  const zeCredentialsPath=()=>path.join(app.getPath('userData'),'ze-delivery-credentials.enc');
  const readZeCredentials=()=>{
    const file=zeCredentialsPath();
    if(!fs.existsSync(file))return null;
    if(!safeStorage.isEncryptionAvailable())fail('O armazenamento seguro do Windows não está disponível nesta sessão.','ZE_CREDENTIALS_STORE');
    try{
      const encrypted=fs.readFileSync(file);
      const data=JSON.parse(safeStorage.decryptString(encrypted));
      if(!data||typeof data.clientId!=='string'||typeof data.clientSecret!=='string'||!data.clientId||!data.clientSecret)throw new Error('Formato inválido');
      return data;
    }catch(e){fail('Não foi possível desbloquear as credenciais salvas neste Windows. Elas foram mantidas sem alterações. '+(e?.message||''),'ZE_CREDENTIALS_STORE')}
  };
  ipcMain.handle('ze-delivery:credentials-status',()=>{
    requireLogin();
    const data=readZeCredentials();
    return ok({configured:!!data,clientIdHint:data?(data.clientId.slice(0,2)+'••••'+data.clientId.slice(-4)):''});
  });
  ipcMain.handle('ze-delivery:credentials-save',(_,input={})=>{
    requireLogin();
    const clientId=String(input.clientId||'').trim(),clientSecret=String(input.clientSecret||'');
    if(!clientId||!clientSecret)fail('Informe o Client ID e o Client Secret.','VALIDATION');
    if(clientId.length>2048||clientSecret.length>8192||/[\u0000-\u001f]/.test(clientId)||/[\u0000-\u001f]/.test(clientSecret))fail('As credenciais possuem formato ou tamanho inválido.','VALIDATION');
    if(!safeStorage.isEncryptionAvailable())fail('O armazenamento seguro do Windows não está disponível. Nenhuma credencial foi gravada.','ZE_CREDENTIALS_STORE');
    const target=zeCredentialsPath(),temp=target+'.tmp';
    try{
      fs.mkdirSync(path.dirname(target),{recursive:true});
      const encrypted=safeStorage.encryptString(JSON.stringify({clientId,clientSecret,updatedAt:now()}));
      fs.writeFileSync(temp,encrypted,{mode:0o600});
      fs.renameSync(temp,target);
      return ok({saved:true});
    }catch(e){try{if(fs.existsSync(temp))fs.unlinkSync(temp)}catch{};fail('Não foi possível salvar as credenciais protegidas. '+(e?.message||e),'ZE_CREDENTIALS_STORE')}
  });
  ipcMain.handle('ze-delivery:credentials-delete',()=>{
    requireLogin();
    const target=zeCredentialsPath();
    try{if(fs.existsSync(target))fs.unlinkSync(target);return ok(true)}catch(e){fail('Não foi possível remover as credenciais salvas. '+(e?.message||e),'ZE_CREDENTIALS_STORE')}
  });
  ipcMain.handle('auth:login',(_,input={})=>{
    const user=String(input.username||'').trim(),pass=String(input.password||'');if(!user||!pass)fail('Informe usuário e senha.','AUTH');
    const row=db.prepare('SELECT * FROM operators WHERE lower(name)=lower(?) AND active=1 LIMIT 1').get(user);const check=row?verifyPassword(pass,row.password_hash):{valid:false,legacy:false};
    if(!row||!check.valid){activity(user||'Desconhecido','Falha de autenticação','security',row?.id||null,'Credenciais inválidas',0,'security');fail('Usuário ou senha inválidos.','AUTH');}
    if(check.legacy)db.prepare('UPDATE operators SET password_hash=? WHERE id=?').run(hashPassword(pass),row.id);
    const q=db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');q.run('current_operator_id',String(row.id));q.run('current_operator_name',row.name);q.run('current_operator_photo',row.photo_data||'');q.run('current_operator_role',row.role==='admin'?'admin':'operator');
    activity(row.name,'Login realizado','security',row.id,'Autenticação bem-sucedida',0,'security');return ok({id:row.id,name:row.name,photo_data:row.photo_data||'',role:row.role==='admin'?'admin':'operator',isAdmin:row.role==='admin'});
  });
  ipcMain.handle('auth:logout',()=>{const actor=currentOperator();if(actor)activity(actor.name,'Logout realizado','security',actor.id,'Sessão encerrada',0,'security');db.prepare("UPDATE settings SET value='' WHERE key IN ('current_operator_id','current_operator_name','current_operator_photo','current_operator_role')").run();return ok(true);});
  ipcMain.handle('auth:change-password',(_,input={})=>{const actor=requireLogin(),targetId=Number(input.target_id||actor.id);if(actor.role!=='admin'&&targetId!==actor.id)fail('Você só pode alterar a sua própria senha.','FORBIDDEN');const target=db.prepare('SELECT * FROM operators WHERE id=? AND active=1').get(targetId);if(!target)fail('Operador não encontrado.','NOT_FOUND');if(targetId===actor.id){const current=String(input.current||''),check=verifyPassword(current,target.password_hash);if(!current||!check.valid)fail('A senha atual está incorreta.','AUTH');}const pass=validateNewPassword(input.next||input.password||'');db.prepare('UPDATE operators SET password_hash=? WHERE id=? AND active=1').run(hashPassword(pass),targetId);activity(actor.name,'Alterou senha de operador','security',targetId,`Senha alterada para ${target.name}`,0,'security');return ok(true);});
  ipcMain.handle('auth:change-admin-password',(_,password)=>{const actor=requireLogin();if(actor.role!=='admin')fail('Somente o Administrador pode alterar esta senha.','FORBIDDEN');const pass=validateNewPassword(password);db.prepare("UPDATE operators SET password_hash=? WHERE name='Administrador'").run(hashPassword(pass));activity(actor.name,'Alterou senha do Administrador','security',actor.id,'Senha administrativa alterada',0,'security');return ok(true);});
  ipcMain.handle('categories:list',()=>ok(db.prepare('SELECT * FROM categories WHERE active=1 ORDER BY parent_id IS NOT NULL, name').all()));
  ipcMain.handle('categories:save',(_,c)=>{
    const name=String(c?.name||'').trim();
    if(!name)fail('Informe o nome da categoria.','VALIDATION');
    const parent=c?.parent_id?Number(c.parent_id):null;
    const id=c?.id?Number(c.id):null;
    if(name==='Kits / Combos')fail('Esta categoria é reservada pelo sistema.','VALIDATION');
    if(parent){
      const pcat=db.prepare('SELECT * FROM categories WHERE id=? AND active=1').get(parent);
      if(!pcat)fail('A categoria principal selecionada não existe.','NOT_FOUND');
      if(pcat.parent_id)fail('Subcategorias não podem conter outras subcategorias.','VALIDATION');
      if(pcat.name==='Kits / Combos')fail('Kits / Combos é reservado pelo sistema.','VALIDATION');
      if(id&&Number(id)===parent)fail('Uma categoria não pode ser subcategoria dela mesma.','VALIDATION');
    }
    const duplicate=db.prepare('SELECT id FROM categories WHERE active=1 AND lower(name)=lower(?) AND COALESCE(parent_id,0)=COALESCE(?,0) AND id<>COALESCE(?,0) LIMIT 1').get(name,parent,id||0);
    if(duplicate)fail('Já existe uma categoria com este nome neste nível.','DUPLICATE');
    const actor=currentOperator()?.name||'Sistema';
    if(id){
      const current=db.prepare('SELECT * FROM categories WHERE id=? AND active=1').get(id);
      if(!current)fail('Categoria não encontrada.','NOT_FOUND');
      if(current.name==='Kits / Combos')fail('Esta categoria é reservada pelo sistema.','FORBIDDEN');
      db.prepare('UPDATE categories SET name=?,parent_id=?,icon=?,active=1 WHERE id=?').run(name,parent,String(c.icon||current.icon||'package'),id);
      activity(actor,parent?'Editou subcategoria':'Editou categoria','category',id,`${current.name} → ${name}`,0,'products');
      return ok(id);
    }
    const r=db.prepare('INSERT INTO categories(name,icon,parent_id,active) VALUES(?,?,?,1)').run(name,String(c.icon||'package'),parent);
    const newId=Number(r.lastInsertRowid);
    activity(actor,parent?'Cadastrou subcategoria':'Cadastrou categoria','category',newId,name,0,'products');
    return ok(newId);
  });
  ipcMain.handle('categories:delete',(_,id)=>{
    const n=Number(id);
    const c=db.prepare('SELECT * FROM categories WHERE id=? AND active=1').get(n);
    if(!c)fail('Categoria não encontrada.','NOT_FOUND');
    if(c.name==='Kits / Combos')fail('A categoria Kits / Combos é reservada pelo sistema.','FORBIDDEN');
    if(db.prepare('SELECT 1 FROM categories WHERE parent_id=? AND active=1 LIMIT 1').get(n))fail('Exclua primeiro as subcategorias desta categoria.','CATEGORY_HAS_CHILDREN');
    if(db.prepare('SELECT 1 FROM products WHERE category_id=? AND active=1 LIMIT 1').get(n))fail('Não é possível excluir uma categoria que possui produtos cadastrados.','CATEGORY_HAS_PRODUCTS');
    if(db.prepare("SELECT 1 FROM kits WHERE active=1 AND COALESCE(kit_type,'STANDARD')='MIX_WEIGHT' AND mix_category_id=? LIMIT 1").get(n))fail('Esta categoria está sendo usada por um Mix por Peso. Altere o Mix antes de excluir a categoria.','CATEGORY_IN_MIX');
    db.prepare('UPDATE categories SET active=0 WHERE id=?').run(n);
    activity(currentOperator()?.name||'Sistema',c.parent_id?'Excluiu subcategoria':'Excluiu categoria','category',n,c.name,0,'products');
    return ok(true);
  });
  const localDate=()=>{const d=new Date();const m=String(d.getMonth()+1).padStart(2,'0');const day=String(d.getDate()).padStart(2,'0');return `${d.getFullYear()}-${m}-${day}`};
  const cashSummary=(cashId)=>{const id=Number(cashId);const c=db.prepare('SELECT * FROM cash_registers WHERE id=?').get(id);if(!c)return null;const sales=db.prepare("SELECT COUNT(*) count,COALESCE(SUM(total_cents),0) total FROM sales WHERE cash_register_id=? AND COALESCE(status,'CONCLUIDA')<>'CANCELADA'").get(id);const withdrawals=db.prepare('SELECT * FROM cash_withdrawals WHERE cash_register_id=? ORDER BY created_at DESC,id DESC').all(id);const totalWithdrawals=withdrawals.reduce((sum,x)=>sum+Number(x.amount_cents||0),0);const items=db.prepare("SELECT si.name,COALESCE(si.sale_mode,'UNIT') sale_mode,SUM(CASE WHEN COALESCE(si.sale_mode,'UNIT') IN ('WEIGHT','MIX_WEIGHT') THEN 0 ELSE si.quantity END) quantity,SUM(CASE WHEN COALESCE(si.sale_mode,'UNIT') IN ('WEIGHT','MIX_WEIGHT') THEN COALESCE(si.weight_grams,0) ELSE 0 END) weight_grams,SUM(CASE WHEN COALESCE(si.sale_mode,'UNIT') IN ('WEIGHT','MIX_WEIGHT') THEN COALESCE(si.unit_count,0) ELSE 0 END) unit_count,SUM(si.total_cents) total_cents FROM sale_items si JOIN sales s ON s.id=si.sale_id WHERE s.cash_register_id=? AND COALESCE(s.status,'CONCLUIDA')<>'CANCELADA' GROUP BY si.name,COALESCE(si.sale_mode,'UNIT') ORDER BY total_cents DESC").all(id);const expected=Math.max(0,Number(c.opening_cents||0)+Number(sales?.total||0)-totalWithdrawals);return {id:Number(c.id),opened_at:String(c.opened_at||''),opening_date:String(c.opening_date||''),opening_cents:Number(c.opening_cents||0),closed_at:c.closed_at?String(c.closed_at):null,closing_cents:c.closing_cents==null?null:Number(c.closing_cents),closing_total_cents:c.closing_total_cents==null?null:Number(c.closing_total_cents),closing_status:String(c.closing_status||''),operator:String(c.operator||''),notes:String(c.notes||''),sales_count:Number(sales?.count||0),total_sales_cents:Number(sales?.total||0),total_withdrawals_cents:totalWithdrawals,expected_total_cents:expected,withdrawals:withdrawals.map(x=>({id:Number(x.id),cash_register_id:Number(x.cash_register_id),amount_cents:Number(x.amount_cents||0),reason:String(x.reason||''),operator:String(x.operator||''),created_at:String(x.created_at||'')})),items:(items||[]).map(x=>({name:String(x.name||''),sale_mode:String(x.sale_mode||'UNIT'),quantity:Number(x.quantity||0),weight_grams:Number(x.weight_grams||0),unit_count:Number(x.unit_count||0),total_cents:Number(x.total_cents||0)}))};};
  ipcMain.handle('cash:current',()=>{const c=db.prepare("SELECT * FROM cash_registers WHERE closing_status='ABERTO' ORDER BY id DESC LIMIT 1").get();return ok(c?cashSummary(c.id):null)});
  ipcMain.handle('cash:open',(_,input)=>{const existing=db.prepare("SELECT * FROM cash_registers WHERE closing_status='ABERTO' ORDER BY id DESC LIMIT 1").get();if(existing)fail('Já existe um caixa aberto. Feche o caixa atual antes de abrir outro.','CASH_OPEN');const cents=Math.round(Number(input?.opening_cents||0));if(!Number.isFinite(cents)||cents<0)fail('Informe um valor inicial válido.','VALIDATION');const operator=String(input?.operator||'').trim();if(!operator)fail('Selecione o operador responsável pela abertura do caixa.','VALIDATION');const t=now();const r=db.prepare('INSERT INTO cash_registers(opened_at,opening_date,opening_cents,operator,notes) VALUES(?,?,?,?,?)').run(t,localDate(),cents,operator,String(input?.notes||''));activity(operator,'Abriu caixa','cash',r.lastInsertRowid,`Valor inicial ${pdfMoney(cents)}`,cents,'cash');return ok(cashSummary(r.lastInsertRowid))});
  ipcMain.handle('cash:close',()=>{let closedId=null;db.transaction(()=>{const c=db.prepare("SELECT * FROM cash_registers WHERE closing_status='ABERTO' ORDER BY id DESC LIMIT 1").get();if(!c)fail('Não há caixa aberto para fechar.','CASH_CLOSED');const summary=cashSummary(c.id);const expected=Number(summary?.expected_total_cents||0);const t=now();db.prepare("UPDATE cash_registers SET closed_at=?,closing_cents=?,closing_total_cents=?,closing_status='FECHADO' WHERE id=?").run(t,expected,expected,c.id);closedId=Number(c.id);activity(c.operator||'','Fechou caixa','cash',c.id,`Saldo estimado ${pdfMoney(expected)} · retiradas ${pdfMoney(Number(summary?.total_withdrawals_cents||0))}`,expected,'cash')})();return ok(cashSummary(closedId))});
  ipcMain.handle('cash:withdraw',(_,input={})=>ok(db.transaction(()=>{const c=db.prepare("SELECT * FROM cash_registers WHERE closing_status='ABERTO' ORDER BY id DESC LIMIT 1").get();if(!c)fail('Não há caixa aberto para registrar retirada.','CASH_CLOSED');const amount=Math.round(Number(input.amount_cents||0));const reason=String(input.reason||'').trim();const operator=String(input.operator||c.operator||'Caixa').trim()||'Caixa';if(!Number.isFinite(amount)||amount<=0)fail('Informe um valor de retirada maior que zero.','VALIDATION');if(reason.length<3)fail('Informe o motivo da retirada.','VALIDATION');const before=cashSummary(c.id);if(amount>Number(before?.expected_total_cents||0))fail(`A retirada não pode ser maior que o saldo estimado do caixa (${pdfMoney(before?.expected_total_cents||0)}).`,'CASH_WITHDRAWAL_LIMIT');const r=db.prepare('INSERT INTO cash_withdrawals(cash_register_id,amount_cents,reason,operator,created_at) VALUES(?,?,?,?,?)').run(c.id,amount,reason,operator,now());activity(operator,'Registrou retirada de caixa','cash_withdrawal',r.lastInsertRowid,`${reason} · ${pdfMoney(amount)}`,amount,'cash');return cashSummary(c.id)})()));
  ipcMain.handle('cash:history',(_,range={})=>{let sql='SELECT * FROM cash_registers WHERE 1=1';const args=[];if(range.from){sql+=' AND opening_date>=?';args.push(range.from)}if(range.to){sql+=' AND opening_date<=?';args.push(range.to)}return ok(db.prepare(sql+' ORDER BY opened_at DESC').all(...args).map(c=>cashSummary(c.id)))});
  ipcMain.handle('cash:drawer:open',()=>{const actor=currentOperator();if(!actor)fail('Faça login para abrir a gaveta.','AUTH');if(actor.role!=='admin'&&settingValue('cash_drawer_manual_operator_access','0')!=='1')fail('Seu perfil não tem permissão para abrir a gaveta manualmente.','FORBIDDEN');const current=db.prepare("SELECT id FROM cash_registers WHERE closing_status='ABERTO' ORDER BY id DESC LIMIT 1").get();if(!current)fail('Abra o caixa antes de acionar a gaveta.','CASH_CLOSED');return ok(triggerCashDrawer('MANUAL',actor.name,null))});
  ipcMain.handle('cash:drawer:history',(_,limit=100)=>ok(db.prepare('SELECT * FROM cash_drawer_events ORDER BY id DESC LIMIT ?').all(Math.max(1,Math.min(500,Number(limit)||100)))));
  function nextQuoteNumber(){return Number(db.prepare('SELECT COALESCE(MAX(number),0)+1 n FROM quotes').get().n||1);}
  function quoteById(id){const q=db.prepare('SELECT * FROM quotes WHERE id=?').get(id);if(!q)fail('Orçamento não encontrado','NOT_FOUND');const items=db.prepare('SELECT * FROM quote_items WHERE quote_id=? ORDER BY id').all(id).map(i=>({...i,mix_items:String(i.sale_mode||'UNIT')==='MIX_WEIGHT'?db.prepare('SELECT product_id,product_name name,quantity,weight_grams FROM quote_mix_items WHERE quote_item_id=? ORDER BY id').all(i.id):[]}));return {...q,items};}
  ipcMain.handle('quotes:list',()=>ok(db.prepare('SELECT * FROM quotes ORDER BY id DESC LIMIT 200').all()));
  ipcMain.handle('quotes:detail',(_,id)=>ok(quoteById(id)));
  ipcMain.handle('quotes:create',(_,input={})=>ok(db.transaction(()=>{
    const items=Array.isArray(input.items)?input.items:[];
    if(!items.length)fail('Adicione pelo menos um produto ao orçamento.','QUOTE_EMPTY');
    const normalized=items.map(i=>{
      const productId=i.product_id?Number(i.product_id):null;
      const kitId=i.kit_id?Number(i.kit_id):null;
      let price=Math.max(0,Number(i.unit_price_cents||0));
      let mode='UNIT',qty=Math.max(1,Math.round(Number(i.quantity||1))),grams=0,unitCount=0,linkedUnitProductId=null,total=price*qty,name=String(i.name||'Item'),mixItems=[];
      if(productId){
        const p=db.prepare("SELECT id,name,COALESCE(sale_mode,'UNIT') sale_mode,linked_unit_product_id FROM products WHERE id=? AND active=1").get(productId);
        if(!p)fail(`Produto "${name}" não encontrado.`, 'NOT_FOUND');
        mode=String(p.sale_mode||'UNIT');
        name=String(p.name||name);
        if(mode==='WEIGHT'){
          grams=Math.max(0,Math.round(Number(i.weight_grams||0)));
          if(grams<=0)fail(`Informe o peso estimado de ${name}.`,'WEIGHT_REQUIRED');
          qty=1;
          unitCount=Math.max(0,Math.round(Number(i.unit_count||0)));
          linkedUnitProductId=p.linked_unit_product_id?Number(p.linked_unit_product_id):null;
          total=Math.round(price*grams/1000);
        }
      }else if(kitId){
        const kit=db.prepare("SELECT * FROM kits WHERE id=? AND active=1").get(kitId);
        if(!kit)fail(`Kit / Combo "${name}" não encontrado.`,'NOT_FOUND');
        name=String(kit.name||name);
        price=Number(kit.price_cents||price);
        if(String(kit.kit_type||'STANDARD')==='MIX_WEIGHT'){
          mode='MIX_WEIGHT';
          mixItems=(Array.isArray(i.mix_items)?i.mix_items:[]).map(x=>({product_id:Number(x.product_id),quantity:Math.max(0,Math.round(Number(x.quantity||0))),weight_grams:Math.max(0,Math.round(Number(x.weight_grams||0)))})).filter(x=>x.product_id&&x.quantity>0);
          if(!mixItems.length)fail(`Selecione pelo menos uma cor/produto para ${name}.`,'MIX_EMPTY');
          const seen=new Set();
          for(const x of mixItems){
            if(seen.has(x.product_id))fail('Há produto repetido na composição do Mix.','MIX_DUPLICATE');
            seen.add(x.product_id);
            const p=db.prepare("SELECT p.id,p.name,p.active,p.category_id,c.parent_id,p.item_type,COALESCE(p.sale_mode,'UNIT') sale_mode FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.id=?").get(x.product_id);
            if(!p||!p.active)fail('Um produto do Mix não está disponível.','MIX_PRODUCT_NOT_FOUND');
            if(p.sale_mode!=='UNIT'||p.item_type==='SERVICE')fail(`O produto "${p.name}" precisa ser vendido por unidade para participar do Mix.`,'MIX_PRODUCT_MODE');
            if(kit.mix_category_id&&Number(p.category_id)!==Number(kit.mix_category_id)&&Number(p.parent_id)!==Number(kit.mix_category_id))fail(`O produto "${p.name}" não pertence à categoria configurada para este Mix.`,'MIX_CATEGORY');
            if(x.weight_grams<=0)fail(`Informe o peso de ${p.name} dentro do Mix ${name}.`,'MIX_WEIGHT_REQUIRED');
            x.name=p.name;
          }
          grams=mixItems.reduce((sum,x)=>sum+x.weight_grams,0);
          if(grams<=0)fail(`Informe os pesos das cores/produtos de ${name}.`,'WEIGHT_REQUIRED');
          unitCount=mixItems.reduce((sum,x)=>sum+x.quantity,0);
          qty=1;
          total=Math.round(price*grams/1000);
        }
      }
      return {product_id:productId,kit_id:kitId,name,quantity:qty,unit_price_cents:price,total_cents:total,sale_mode:mode,weight_grams:grams,unit_count:unitCount,linked_unit_product_id:linkedUnitProductId,mix_items:mixItems};
    });
    const subtotal=normalized.reduce((sum,i)=>sum+i.total_cents,0);
    const discountPercent=Math.min(100,Math.max(0,Number(input.discount_percent||0)));
    const discount=Math.min(subtotal,Math.round(subtotal*discountPercent/100));
    const delivery=Math.max(0,Number(input.delivery_cents||0));
    const total=subtotal-discount+delivery;
    const customer=input.customer_id?db.prepare('SELECT * FROM customers WHERE id=?').get(input.customer_id):null;
    if(input.customer_id&&!customer)fail('Cliente não encontrado','NOT_FOUND');
    const number=nextQuoteNumber();
    const result=db.prepare('INSERT INTO quotes(number,created_at,valid_until,customer_id,customer_name,customer_phone,customer_address,operator,subtotal_cents,discount_cents,discount_percent,total_cents,notes,status,delivery_cents) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .run(number,now(),input.valid_until||null,customer?.id||null,customer?.name||String(input.customer_name||''),customer?.phone||String(input.customer_phone||''),customer?.address||String(input.customer_address||''),String(input.operator||'Caixa'),subtotal,discount,discountPercent,total,String(input.notes||''),'ABERTO',delivery);
    const quoteId=result.lastInsertRowid;
    const ins=db.prepare('INSERT INTO quote_items(quote_id,product_id,kit_id,name,quantity,unit_price_cents,total_cents,sale_mode,weight_grams,unit_count,linked_unit_product_id) VALUES(?,?,?,?,?,?,?,?,?,?,?)');
    const mixIns=db.prepare('INSERT INTO quote_mix_items(quote_item_id,product_id,product_name,quantity,weight_grams) VALUES(?,?,?,?,?)');
    for(const i of normalized){const qi=ins.run(quoteId,i.product_id,i.kit_id,i.name,i.quantity,i.unit_price_cents,i.total_cents,i.sale_mode,i.weight_grams,i.unit_count,i.linked_unit_product_id);if(i.sale_mode==='MIX_WEIGHT')for(const x of i.mix_items||[])mixIns.run(qi.lastInsertRowid,x.product_id,x.name||'',x.quantity,x.weight_grams||0);}
    return quoteById(quoteId);
  })()));
  ipcMain.handle('quotes:update',(_,id,input={})=>ok(db.transaction(()=>{
    const quoteId=Number(id);
    const current=db.prepare('SELECT * FROM quotes WHERE id=?').get(quoteId);
    if(!current)fail('Orçamento não encontrado.','NOT_FOUND');
    if(current.status==='CONVERTIDO')fail('Orçamentos convertidos em venda não podem ser editados.','QUOTE_CONVERTED');
    const items=Array.isArray(input.items)?input.items:[];
    if(!items.length)fail('Adicione pelo menos um produto ao orçamento.','QUOTE_EMPTY');
    const normalized=items.map(i=>{
      const productId=i.product_id?Number(i.product_id):null;
      const kitId=i.kit_id?Number(i.kit_id):null;
      let price=Math.max(0,Number(i.unit_price_cents||0));
      let mode='UNIT',qty=Math.max(1,Math.round(Number(i.quantity||1))),grams=0,unitCount=0,linkedUnitProductId=null,total=price*qty,name=String(i.name||'Item'),mixItems=[];
      if(productId){
        const p=db.prepare("SELECT id,name,COALESCE(sale_mode,'UNIT') sale_mode,linked_unit_product_id FROM products WHERE id=? AND active=1").get(productId);
        if(!p)fail(`Produto "${name}" não encontrado.`,'NOT_FOUND');
        mode=String(p.sale_mode||'UNIT');
        name=String(p.name||name);
        if(mode==='WEIGHT'){
          grams=Math.max(0,Math.round(Number(i.weight_grams||0)));
          if(grams<=0)fail(`Informe o peso estimado de ${name}.`,'WEIGHT_REQUIRED');
          qty=1;
          unitCount=Math.max(0,Math.round(Number(i.unit_count||0)));
          linkedUnitProductId=p.linked_unit_product_id?Number(p.linked_unit_product_id):null;
          total=Math.round(price*grams/1000);
        }
      }else if(kitId){
        const kit=db.prepare("SELECT * FROM kits WHERE id=? AND active=1").get(kitId);
        if(!kit)fail(`Kit / Combo "${name}" não encontrado.`,'NOT_FOUND');
        name=String(kit.name||name);
        price=Number(kit.price_cents||price);
        if(String(kit.kit_type||'STANDARD')==='MIX_WEIGHT'){
          mode='MIX_WEIGHT';
          mixItems=(Array.isArray(i.mix_items)?i.mix_items:[]).map(x=>({product_id:Number(x.product_id),quantity:Math.max(0,Math.round(Number(x.quantity||0))),weight_grams:Math.max(0,Math.round(Number(x.weight_grams||0)))})).filter(x=>x.product_id&&x.quantity>0);
          if(!mixItems.length)fail(`Selecione pelo menos uma cor/produto para ${name}.`,'MIX_EMPTY');
          const seen=new Set();
          for(const x of mixItems){
            if(seen.has(x.product_id))fail('Há produto repetido na composição do Mix.','MIX_DUPLICATE');
            seen.add(x.product_id);
            const p=db.prepare("SELECT p.id,p.name,p.active,p.category_id,c.parent_id,p.item_type,COALESCE(p.sale_mode,'UNIT') sale_mode FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.id=?").get(x.product_id);
            if(!p||!p.active)fail('Um produto do Mix não está disponível.','MIX_PRODUCT_NOT_FOUND');
            if(p.sale_mode!=='UNIT'||p.item_type==='SERVICE')fail(`O produto "${p.name}" precisa ser vendido por unidade para participar do Mix.`,'MIX_PRODUCT_MODE');
            if(kit.mix_category_id&&Number(p.category_id)!==Number(kit.mix_category_id)&&Number(p.parent_id)!==Number(kit.mix_category_id))fail(`O produto "${p.name}" não pertence à categoria configurada para este Mix.`,'MIX_CATEGORY');
            if(x.weight_grams<=0)fail(`Informe o peso de ${p.name} dentro do Mix ${name}.`,'MIX_WEIGHT_REQUIRED');
            x.name=p.name;
          }
          grams=mixItems.reduce((sum,x)=>sum+x.weight_grams,0);
          if(grams<=0)fail(`Informe os pesos das cores/produtos de ${name}.`,'WEIGHT_REQUIRED');
          unitCount=mixItems.reduce((sum,x)=>sum+x.quantity,0);
          qty=1;
          total=Math.round(price*grams/1000);
        }
      }
      return {product_id:productId,kit_id:kitId,name,quantity:qty,unit_price_cents:price,total_cents:total,sale_mode:mode,weight_grams:grams,unit_count:unitCount,linked_unit_product_id:linkedUnitProductId,mix_items:mixItems};
    });
    const subtotal=normalized.reduce((sum,i)=>sum+i.total_cents,0);
    const discountPercent=Math.min(100,Math.max(0,Number(input.discount_percent||0)));
    const discount=Math.min(subtotal,Math.round(subtotal*discountPercent/100));
    const delivery=Math.max(0,Number(input.delivery_cents||0));
    const total=subtotal-discount+delivery;
    const customer=input.customer_id?db.prepare('SELECT * FROM customers WHERE id=?').get(input.customer_id):null;
    if(input.customer_id&&!customer)fail('Cliente não encontrado','NOT_FOUND');
    db.prepare('UPDATE quotes SET valid_until=?,customer_id=?,customer_name=?,customer_phone=?,customer_address=?,operator=?,subtotal_cents=?,discount_cents=?,discount_percent=?,total_cents=?,notes=?,status=?,delivery_cents=? WHERE id=?')
      .run(input.valid_until||null,customer?.id||null,customer?.name||String(input.customer_name||''),customer?.phone||String(input.customer_phone||''),customer?.address||String(input.customer_address||''),String(input.operator||current.operator||'Caixa'),subtotal,discount,discountPercent,total,String(input.notes||''),'ABERTO',delivery,quoteId);
    db.prepare('DELETE FROM quote_mix_items WHERE quote_item_id IN (SELECT id FROM quote_items WHERE quote_id=?)').run(quoteId);
    db.prepare('DELETE FROM quote_items WHERE quote_id=?').run(quoteId);
    const ins=db.prepare('INSERT INTO quote_items(quote_id,product_id,kit_id,name,quantity,unit_price_cents,total_cents,sale_mode,weight_grams,unit_count,linked_unit_product_id) VALUES(?,?,?,?,?,?,?,?,?,?,?)');
    const mixIns=db.prepare('INSERT INTO quote_mix_items(quote_item_id,product_id,product_name,quantity,weight_grams) VALUES(?,?,?,?,?)');
    for(const i of normalized){const qi=ins.run(quoteId,i.product_id,i.kit_id,i.name,i.quantity,i.unit_price_cents,i.total_cents,i.sale_mode,i.weight_grams,i.unit_count,i.linked_unit_product_id);if(i.sale_mode==='MIX_WEIGHT')for(const x of i.mix_items||[])mixIns.run(qi.lastInsertRowid,x.product_id,x.name||'',x.quantity,x.weight_grams||0);}
    activity(String(input.operator||current.operator||''),'Editou orçamento','quote',quoteId,`Orçamento #${current.number}`);
    return quoteById(quoteId);
  })()));
  ipcMain.handle('quotes:delete',(_,id)=>{
  const q=db.prepare(
    'SELECT id,status FROM quotes WHERE id=?'
  ).get(id);

  if(!q)
    fail('Orçamento não encontrado','NOT_FOUND');

  if(q.status==='CONVERTIDO')
    fail(
      'Não é possível excluir um orçamento que já foi convertido em venda.',
      'QUOTE_CONVERTED'
    );

  db.prepare(
    'DELETE FROM quote_items WHERE quote_id=?'
  ).run(id);

  db.prepare(
    'DELETE FROM quotes WHERE id=?'
  ).run(id);

  return ok(true);
});
ipcMain.handle('quotes:set-status',(_,id,status)=>{
  const quoteId=Number(id);
  const next=String(status||'').toUpperCase();

  if(!['ABERTO','INSUCESSO'].includes(next))
    fail('Status de orçamento inválido.','VALIDATION');

  const q=db.prepare(
    'SELECT * FROM quotes WHERE id=?'
  ).get(quoteId);

  if(!q)
    fail('Orçamento não encontrado.','NOT_FOUND');

  if(q.status==='CONVERTIDO')
    fail(
      'Um orçamento já convertido em venda não pode ter seu status alterado.',
      'QUOTE_CONVERTED'
    );

  db.prepare(
    'UPDATE quotes SET status=? WHERE id=?'
  ).run(next,quoteId);

  return ok(quoteById(quoteId));
});
  ipcMain.handle('quotes:pdf',async(_,id)=>{
    const q=quoteById(id);
    const settings=Object.fromEntries(db.prepare('SELECT key,value FROM settings').all().map(x=>[x.key,x.value]));
    const dir=path.join(app.getPath('documents'),'Uni-PDV Licenciado','Orcamentos');
    fs.mkdirSync(dir,{recursive:true});
    const picked=await dialog.showSaveDialog({
      title:'Salvar orçamento em PDF',
      defaultPath:path.join(dir,`Orcamento-${String(q.number).padStart(5,'0')}.pdf`),
      filters:[{name:'PDF',extensions:['pdf']}]
    });
    if(picked.canceled||!picked.filePath)return ok(false);
    const out=picked.filePath.toLowerCase().endsWith('.pdf')?picked.filePath:picked.filePath+'.pdf';
    await writeQuotePdf(out,q,settings);
    if(!fs.existsSync(out)||fs.statSync(out).size===0)fail('O PDF do orçamento não foi gravado.','PDF_WRITE');
    return ok(out);
  });
  ipcMain.handle('reports:daily',(_,date)=>ok(reportData('daily',date,'',cashSummary)));
  ipcMain.handle('reports:monthly',(_,month)=>ok(reportData('monthly','',month,cashSummary)));
  ipcMain.handle('reports:export',async(_,opts={})=>{
    const mode=opts.mode==='monthly'?'monthly':'daily';
    const data=reportData(mode,opts.date,opts.month,cashSummary);
    const format=opts.format==='xlsx'?'xlsx':'pdf';
    const base=`Relatorio-Uni-PDV-Integrado-${data.period}`;
    const ext=format==='xlsx'?'xlsx':'pdf';
    const picked=await dialog.showSaveDialog({title:`Exportar relatório em ${format.toUpperCase()}`,defaultPath:path.join(app.getPath('documents'),`${base}.${ext}`),filters:format==='xlsx'?[{name:'Excel',extensions:['xlsx']}]:[{name:'PDF',extensions:['pdf']}]});
    if(picked.canceled||!picked.filePath)return ok(false);
    const out=picked.filePath.toLowerCase().endsWith('.'+ext)?picked.filePath:picked.filePath+'.'+ext;
    if(format==='pdf'){
      const settings=Object.fromEntries(db.prepare('SELECT key,value FROM settings').all().map(x=>[x.key,x.value]));
      await writeReportPdf(out,data,settings);
      if(!fs.existsSync(out)||fs.statSync(out).size===0)fail('O arquivo PDF não pôde ser gravado no local selecionado.','PDF_WRITE');
    }else{
      const money=n=>Number(n||0)/100;
      const rowsSales=mode==='daily'?[['Data/hora','Venda','Operador','Cliente','Pagamento','Total'],...data.sales.map(x=>[new Date(x.sold_at).toLocaleString('pt-BR'),x.id,x.operator||'',x.customer_name||'',x.payment||'',{value:money(x.total_cents),style:2}])]:[['Data','Vendas','Total vendido','Recebido','Débitos'],...data.sales.map(x=>[x.date,x.count,{value:money(x.total),style:2},{value:money(x.paid),style:2},{value:money(x.due),style:2}])];
      const rowsCash=[['Abertura','Fechamento','Operador','Valor inicial','Vendas','Retiradas','Saldo estimado','Status'],...data.cash.map(x=>[new Date(x.opened_at).toLocaleString('pt-BR'),x.closed_at?new Date(x.closed_at).toLocaleString('pt-BR'):'',x.operator||'',{value:money(x.opening_cents),style:2},{value:money(x.total_sales_cents),style:2},{value:money(x.total_withdrawals_cents),style:2},{value:money(x.expected_total_cents),style:2},x.closing_status])];
      const rowsWithdrawals=[['Data/hora','Caixa','Operador','Motivo','Valor'],...(data.withdrawals||[]).map(x=>[new Date(x.created_at).toLocaleString('pt-BR'),x.cash_register_id,x.operator||'',x.reason||'',{value:money(x.amount_cents),style:2}])];
      const rowsItems=[['Item','Quantidade','Valor total'],...data.items.map(x=>[x.name,['WEIGHT','MIX_WEIGHT'].includes(String(x.sale_mode||'UNIT'))?weightedQtyLabel(x.weight_grams,x.unit_count):x.quantity,{value:money(x.total_cents),style:2}])];
      const rowsProducts=[['Data/hora','Ação','Tipo','ID','Operador','Detalhes','Valor'],...(data.product_events||[]).map(x=>[new Date(x.created_at).toLocaleString('pt-BR'),x.action||'',x.entity_type||'',x.entity_id||'',x.operator||'Sistema',x.details||'',{value:money(x.amount_cents),style:2}])];
      const rowsStock=[['Data/hora','Movimento','Produto','Quantidade','Motivo','Fornecedor','Valor de referência'],...(data.stock_movements||[]).map(x=>[new Date(x.created_at).toLocaleString('pt-BR'),x.kind==='IN'?'Entrada':'Saída',x.product_name||`Produto #${x.product_id}`,['WEIGHT','MIX_WEIGHT'].includes(String(x.sale_mode||'UNIT'))?gramsLabel(x.quantity):`${x.quantity} ${x.unit||'un'}`,x.reason||'',x.supplier_name||'',{value:money(x.value_cents),style:2}])];
      const rowsActivities=[['Data/hora','Grupo','Ação','Operador','Tipo','ID','Detalhes','Valor'],...(data.activities||[]).map(x=>[new Date(x.created_at).toLocaleString('pt-BR'),x.event_group||'system',x.action||'',x.operator||'Sistema',x.entity_type||'',x.entity_id||'',x.details||'',{value:money(x.amount_cents),style:2}])];
      const rowsSummary=[['Relatório','Uni-PDV'],['Período',data.period],['Vendas',data.totals.count||0],['Total vendido',{value:money(data.totals.total),style:2}],['Total recebido',{value:money(data.totals.paid),style:2}],['Débitos',{value:money(data.totals.due),style:2}],['Retiradas de caixa',{value:money(data.withdrawal_total_cents),style:2}],['Entradas de estoque',data.stock_in_count||0],['Saídas de estoque',data.stock_out_count||0],['Atividades registradas',(data.activities||[]).length]];
      fs.writeFileSync(out,makeXlsx([{name:'Resumo',rows:rowsSummary},{name:'Vendas',rows:rowsSales},{name:'Caixa',rows:rowsCash},{name:'Retiradas',rows:rowsWithdrawals},{name:'Itens vendidos',rows:rowsItems},{name:'Produtos-Categorias',rows:rowsProducts},{name:'Estoque',rows:rowsStock},{name:'Atividades',rows:rowsActivities}]));
    }
    return ok(out);
  });
  ipcMain.handle('notes:list',(_,search='')=>{const term=String(search||'').trim();if(term){const like='%'+term+'%';return ok(db.prepare("SELECT * FROM notes WHERE active=1 AND (title LIKE ? OR content LIKE ?) ORDER BY updated_at DESC").all(like,like));}return ok(db.prepare('SELECT * FROM notes WHERE active=1 ORDER BY updated_at DESC').all())});
  ipcMain.handle('notes:save',(_,n)=>{const title=String(n?.title||'').trim();const content=String(n?.content||'').trim();if(!content)fail('Digite o conteúdo da anotação.','VALIDATION');const t=now();if(n?.id){db.prepare('UPDATE notes SET title=?,content=?,updated_at=? WHERE id=?').run(title,content,t,n.id);return ok(Number(n.id));}const r=db.prepare('INSERT INTO notes(title,content,created_at,updated_at) VALUES(?,?,?,?)').run(title,content,t,t);return ok(Number(r.lastInsertRowid))});
  ipcMain.handle('notes:delete',(_,id)=>{if(!id)fail('Anotação inválida.','VALIDATION');db.prepare('UPDATE notes SET active=0,updated_at=? WHERE id=?').run(now(),id);activity('', 'Excluiu anotação','note',id,'Exclusão com possibilidade de desfazer');return ok(true)});
  ipcMain.handle('notes:restore',(_,id)=>{const r=db.prepare('UPDATE notes SET active=1,updated_at=? WHERE id=?').run(now(),Number(id));return ok(r.changes>0)});
  ipcMain.handle('products:restore',(_,id)=>{const n=Number(id),p=db.prepare('SELECT id,name,price_cents FROM products WHERE id=?').get(n);const r=db.prepare('UPDATE products SET active=1,updated_at=? WHERE id=?').run(now(),n);if(r.changes&&p)activity(currentOperator()?.name||'Sistema','Restaurou produto','product',n,`${p.name} · preço ${pdfMoney(p.price_cents||0)}`,Number(p.price_cents||0),'products');return ok(r.changes>0)});
  ipcMain.handle('categories:restore',(_,id)=>{const n=Number(id),c=db.prepare('SELECT id,name,parent_id FROM categories WHERE id=?').get(n);const r=db.prepare('UPDATE categories SET active=1 WHERE id=?').run(n);if(r.changes&&c)activity(currentOperator()?.name||'Sistema',c.parent_id?'Restaurou subcategoria':'Restaurou categoria','category',n,c.name,0,'products');return ok(r.changes>0)});
  ipcMain.handle('operators:list',()=>ok(db.prepare("SELECT id,name,photo_data,role,active,created_at FROM operators WHERE active=1 ORDER BY CASE WHEN role='admin' THEN 0 ELSE 1 END,name").all()));
  ipcMain.handle('operators:save',(_,o)=>{const actor=requireLogin();if(actor.role!=='admin')fail('Somente o Administrador pode cadastrar ou editar outros operadores.','FORBIDDEN');const name=String(o?.name||'').trim();if(!name)fail('Informe o nome do operador.','VALIDATION');const id=o?.id?Number(o.id):null;const existing=id?db.prepare('SELECT * FROM operators WHERE id=? AND active=1').get(id):null;if(id&&!existing)fail('Operador não encontrado.','NOT_FOUND');const pass=String(o?.password||'');if(!id&&!pass)fail('Informe uma senha para o operador.','VALIDATION');const encodedPass=pass?hashPassword(validateNewPassword(pass)):null;if(id){const ph=encodedPass||existing.password_hash;const fixedRole=existing.name==='Administrador'?'admin':'operator';db.prepare('UPDATE operators SET name=?,photo_data=?,password_hash=?,role=?,active=1 WHERE id=?').run(name,o.photo_data||existing.photo_data||'',ph,fixedRole,id);}else db.prepare('INSERT INTO operators(name,photo_data,password_hash,role,active,created_at) VALUES(?,?,?,?,?,?)').run(name,o.photo_data||'',encodedPass,'operator',1,now());activity(actor.name,id?'Editou operador':'Criou operador','security',id||null,`Operador ${name}`,0,'security');return ok(true);});
  ipcMain.handle('operators:delete',(_,id)=>{const actor=requireLogin();if(actor.role!=='admin')fail('Somente o Administrador pode desativar operadores.','FORBIDDEN');const n=Number(id),o=db.prepare('SELECT name,role FROM operators WHERE id=? AND active=1').get(n);if(!o)fail('Operador não encontrado.','NOT_FOUND');if(o.name==='Administrador')fail('O usuário Administrador não pode ser desativado.','FORBIDDEN');db.prepare('UPDATE operators SET active=0 WHERE id=?').run(n);return ok(true);});
  ipcMain.handle('image:choose',async()=>{
    const picked=await dialog.showOpenDialog({title:'Escolher imagem',filters:[{name:'Imagens',extensions:['png','jpg','jpeg','webp','ico']},{name:'Todos os arquivos',extensions:['*']}],properties:['openFile']});
    if(picked.canceled||!picked.filePaths[0]) return ok(false);
    const file=picked.filePaths[0], ext=path.extname(file).toLowerCase();
    const mime=ext==='.png'?'image/png':ext==='.jpg'||ext==='.jpeg'?'image/jpeg':ext==='.webp'?'image/webp':'image/x-icon';
    return ok(`data:${mime};base64,${fs.readFileSync(file).toString('base64')}`);
  });
  ipcMain.handle('suppliers:list',(_,search='')=>{
    const q=String(search||'').trim();
    if(!q) return ok(db.prepare('SELECT * FROM suppliers ORDER BY name').all());
    const like='%'+q+'%';
    return ok(db.prepare(`SELECT * FROM suppliers WHERE name LIKE ? OR COALESCE(document,'') LIKE ? OR COALESCE(phone,'') LIKE ? OR COALESCE(email,'') LIKE ? ORDER BY name`).all(like,like,like,like));
  });
  ipcMain.handle('suppliers:save',(_,s)=>{
    const name=String(s?.name||'').trim();
    if(!name) fail('Informe o nome do fornecedor.','VALIDATION');
    try{
      if(s.id){
        db.prepare('UPDATE suppliers SET name=?,document=?,phone=?,email=?,address=?,notes=? WHERE id=?').run(name,s.document||'',s.phone||'',s.email||'',s.address||'',s.notes||'',s.id);
      }else{
        db.prepare('INSERT INTO suppliers(name,document,phone,email,address,notes,created_at) VALUES(?,?,?,?,?,?,?)').run(name,s.document||'',s.phone||'',s.email||'',s.address||'',s.notes||'',now());
      }
      return ok(true);
    }catch(e){ fail(e.message,'SUPPLIER_SAVE_ERROR'); }
  });
  ipcMain.handle('finance:list',(_,filters={})=>{
    const from=String(filters.from||'0000-01-01'),to=String(filters.to||'9999-12-31'),type=String(filters.type||'TODOS').toUpperCase(),status=String(filters.status||'TODOS').toUpperCase(),q=String(filters.search||'').trim();
    const clauses=['issue_date BETWEEN ? AND ?'];const args=[from,to];
    if(['COMPRA','DESPESA'].includes(type)){clauses.push('entry_type=?');args.push(type)}
    if(['PENDENTE','PAGO','CANCELADO'].includes(status)){clauses.push('status=?');args.push(status)}
    if(q){clauses.push('(f.description LIKE ? OR f.category LIKE ? OR COALESCE(f.notes,\'\') LIKE ?)');args.push('%'+q+'%','%'+q+'%','%'+q+'%')}
    const rows=db.prepare(`SELECT f.*,s.name supplier_name FROM finance_entries f LEFT JOIN suppliers s ON s.id=f.supplier_id WHERE ${clauses.join(' AND ')} ORDER BY CASE f.status WHEN 'PENDENTE' THEN 0 WHEN 'PAGO' THEN 1 ELSE 2 END, f.due_date, f.id DESC`).all(...args);
    const today=new Date().toISOString().slice(0,10);const sum=(xs)=>xs.reduce((n,x)=>n+Number(x.amount_cents||0),0);
    return ok({rows,summary:{pending:sum(rows.filter(x=>x.status==='PENDENTE')),overdue:sum(rows.filter(x=>x.status==='PENDENTE'&&x.due_date<today)),paid:sum(rows.filter(x=>x.status==='PAGO')),count:rows.length}});
  });
  ipcMain.handle('finance:save',(_,a={})=>{
    const description=String(a.description||'').trim(),type=String(a.entry_type||'EXPENSE').toUpperCase(),category=String(a.category||'Outros').trim(),due=String(a.due_date||''),issue=String(a.issue_date||'');
    const amount=Math.round(Number(a.amount_cents||0));
    if(!description)fail('Informe a descrição do lançamento.','VALIDATION');
    if(!['COMPRA','DESPESA'].includes(type))fail('Tipo de lançamento inválido.','VALIDATION');
    if(!Number.isSafeInteger(amount)||amount<=0)fail('Informe um valor maior que zero.','VALIDATION');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(issue)||!/^\d{4}-\d{2}-\d{2}$/.test(due))fail('Informe as datas de lançamento e vencimento.','VALIDATION');
    const status=['PENDENTE','PAGO','CANCELADO'].includes(String(a.status||'').toUpperCase())?String(a.status).toUpperCase():'PENDENTE';
    const supplierId=a.supplier_id?Number(a.supplier_id):null;if(supplierId&&!db.prepare('SELECT id FROM suppliers WHERE id=?').get(supplierId))fail('Fornecedor não encontrado.','VALIDATION');
    const paidAt=status==='PAGO'?(String(a.paid_at||'').slice(0,10)||new Date().toISOString().slice(0,10)):null;
    if(a.id){const old=db.prepare('SELECT id FROM finance_entries WHERE id=?').get(Number(a.id));if(!old)fail('Lançamento financeiro não encontrado.','NOT_FOUND');db.prepare('UPDATE finance_entries SET entry_type=?,description=?,supplier_id=?,category=?,amount_cents=?,due_date=?,issue_date=?,status=?,paid_at=?,payment_method=?,notes=?,updated_at=? WHERE id=?').run(type,description,supplierId,category||'Outros',amount,due,issue,status,paidAt,String(a.payment_method||''),String(a.notes||''),now(),Number(a.id));return ok(Number(a.id))}
    const r=db.prepare('INSERT INTO finance_entries(entry_type,description,supplier_id,category,amount_cents,due_date,issue_date,status,paid_at,payment_method,notes,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(type,description,supplierId,category||'Outros',amount,due,issue,status,paidAt,String(a.payment_method||''),String(a.notes||''),now(),now());return ok(Number(r.lastInsertRowid));
  });
  ipcMain.handle('finance:mark-paid',(_,a={})=>{const id=Number(a.id);const row=db.prepare('SELECT * FROM finance_entries WHERE id=?').get(id);if(!row)fail('Lançamento financeiro não encontrado.','NOT_FOUND');if(row.status==='CANCELADO')fail('Um lançamento cancelado não pode ser marcado como pago.','VALIDATION');db.prepare("UPDATE finance_entries SET status='PAGO',paid_at=?,payment_method=?,updated_at=? WHERE id=?").run(String(a.paid_at||new Date().toISOString().slice(0,10)).slice(0,10),String(a.payment_method||''),now(),id);return ok(true)});
  ipcMain.handle('finance:delete',(_,id)=>{const n=Number(id);const row=db.prepare('SELECT status FROM finance_entries WHERE id=?').get(n);if(!row)fail('Lançamento financeiro não encontrado.','NOT_FOUND');if(row.status==='PAGO')fail('Lançamentos pagos não podem ser excluídos. Cancele o lançamento para manter o histórico.','VALIDATION');db.prepare("UPDATE finance_entries SET status='CANCELADO',updated_at=? WHERE id=?").run(now(),n);return ok(true)});
  ipcMain.handle('suppliers:delete',(_,id)=>{
    if(!id) fail('Fornecedor inválido.','VALIDATION');
    db.prepare('DELETE FROM suppliers WHERE id=?').run(id);
    return ok(true);
  });
  ipcMain.handle('products:list',(_,search='',categoryId=null)=>{let sql="SELECT p.*,c.name category,c.parent_id,s.name supplier_name,parent.name parent_category,linked.name linked_unit_name,linked.stock linked_unit_stock,linked.min_stock linked_unit_min_stock,linked.unit linked_unit_unit,COALESCE(linked.sale_mode,'UNIT') linked_unit_sale_mode FROM products p LEFT JOIN categories c ON c.id=p.category_id LEFT JOIN categories parent ON parent.id=c.parent_id LEFT JOIN suppliers s ON s.id=p.supplier_id LEFT JOIN products linked ON linked.id=p.linked_unit_product_id WHERE p.active=1 AND (p.name LIKE ? OR COALESCE(p.sku,'') LIKE ? OR COALESCE(p.barcode,'') LIKE ?)";let args=['%'+String(search||'')+'%','%'+String(search||'')+'%','%'+String(search||'')+'%'];if(categoryId){sql+=' AND (p.category_id=? OR c.parent_id=?)';args.push(Number(categoryId),Number(categoryId))}return ok(db.prepare(sql+' ORDER BY p.name').all(...args))});
  ipcMain.handle('products:save',(_,p)=>{
    const t=now(),actor=currentOperator()?.name||'Sistema';
    const barcode=String(p?.barcode||'').replace(/\D/g,'');
    try{
      const isService=String(p?.item_type||'PRODUCT').toUpperCase()==='SERVICE';
      const requestedMode=String(p?.sale_mode||'UNIT').toUpperCase();const mode=isService?'UNIT':(['WEIGHT','VOLUME_L','VOLUME_ML'].includes(requestedMode)?requestedMode:'UNIT');
      const stock=isService?0:Math.max(0,Math.round(Number(p?.stock||0)));
      const minStock=isService?0:Math.max(0,Math.round(Number(p?.min_stock||0)));
      let linkedUnitProductId=mode==='WEIGHT'&&p?.linked_unit_product_id?Number(p.linked_unit_product_id):null;
      const defaultUnitsPerKg=mode==='WEIGHT'?Math.max(0,Math.round(Number(p?.default_units_per_kg||0))):0;
      const trackUnitStock=mode==='WEIGHT'&&!linkedUnitProductId&&Number(p?.track_unit_stock||0)?1:0;
      const unitStock=trackUnitStock?Math.max(0,Math.round(Number(p?.unit_stock||0))):0;
      const unitMinStock=trackUnitStock?Math.max(0,Math.round(Number(p?.unit_min_stock||0))):0;
      const productName=String(p?.name||'').trim();
      if(!productName)fail('Informe o nome do produto.','VALIDATION');
      if(linkedUnitProductId){
        if(Number(p.id||0)===linkedUnitProductId)fail('O produto por peso não pode ser vinculado a ele mesmo.','VALIDATION');
        const linked=db.prepare("SELECT id,name,active,COALESCE(sale_mode,'UNIT') sale_mode FROM products WHERE id=?").get(linkedUnitProductId);
        if(!linked||!linked.active)fail('O produto unitário vinculado não foi encontrado.','LINKED_UNIT_NOT_FOUND');
        if(linked.sale_mode!=='UNIT')fail(`O produto vinculado "${linked.name}" precisa ser vendido por unidade.`,'LINKED_UNIT_MODE');
      }
      if(barcode){
        const dup=db.prepare('SELECT id,name FROM products WHERE barcode=? AND id<>? LIMIT 1').get(barcode,p.id||0);
        if(dup)fail(`O código de barras já está cadastrado no produto "${dup.name}".`,'DUPLICATE_BARCODE');
      }
      let savedId=Number(p?.id||0),current=null,stockDelta=0,unitDelta=0;
      db.transaction(()=>{
        if(savedId){
          current=db.prepare('SELECT * FROM products WHERE id=? AND active=1').get(savedId);
          if(!current)fail('Produto não encontrado.','NOT_FOUND');
          const currentMode=String(current.sale_mode||'UNIT');
          if(String(current.item_type||'PRODUCT')!==(isService?'SERVICE':'PRODUCT')){const linked=db.prepare('SELECT 1 FROM sale_items WHERE product_id=? LIMIT 1').get(savedId);if(linked)fail('Não é possível trocar produto por serviço (ou vice-versa) com histórico de vendas. Cadastre um novo item.','TYPE_LOCKED');}
          if(currentMode!==mode){
            const hasHistory=db.prepare('SELECT 1 FROM sale_items WHERE product_id=? LIMIT 1').get(savedId)||db.prepare('SELECT 1 FROM stock_movements WHERE product_id=? LIMIT 1').get(savedId)||db.prepare('SELECT 1 FROM kit_items WHERE product_id=? LIMIT 1').get(savedId)||db.prepare('SELECT 1 FROM quote_items WHERE product_id=? LIMIT 1').get(savedId);
            if(hasHistory)fail('O tipo de venda não pode ser alterado porque este produto já possui histórico de vendas, estoque ou participa de Kit/Combo. Cadastre um novo produto com o tipo desejado.','SALE_MODE_LOCKED');
          }
          if(mode==='WEIGHT'&&db.prepare('SELECT 1 FROM kit_items WHERE product_id=? LIMIT 1').get(savedId))fail('Produto vendido por peso não pode participar de Kit/Combo.','WEIGHT_IN_KIT');
          stockDelta=stock-Number(current.stock||0);
          unitDelta=unitStock-Number(current.unit_stock||0);
          db.prepare('UPDATE products SET sku=?,barcode=?,name=?,category_id=?,supplier_id=?,price_cents=?,cost_cents=?,stock=?,min_stock=?,unit=?,ncm=?,cfop=?,cst_csosn=?,origin=?,sale_mode=?,linked_unit_product_id=?,default_units_per_kg=?,track_unit_stock=?,unit_stock=?,unit_min_stock=?,updated_at=? WHERE id=?')
            .run(p.sku||null,barcode||null,productName,p.category_id||null,p.supplier_id||null,p.price_cents||0,p.cost_cents||0,stock,minStock,mode==='WEIGHT'?'kg':mode==='VOLUME_L'?'L':mode==='VOLUME_ML'?'ml':(p.unit||'un'),p.ncm||'',p.cfop||'',p.cst_csosn||'',p.origin||'0',mode,linkedUnitProductId,defaultUnitsPerKg,trackUnitStock,unitStock,unitMinStock,t,savedId);
          if(stockDelta!==0)db.prepare('INSERT INTO stock_movements(product_id,kind,quantity,unit_cost_cents,reason,created_at,sale_mode,supplier_id) VALUES(?,?,?,?,?,?,?,?)')
            .run(savedId,stockDelta>0?'IN':'OUT',Math.abs(stockDelta),p.cost_cents||current.cost_cents||0,'Ajuste no cadastro do produto',t,mode,p.supplier_id||current.supplier_id||null);
          if(trackUnitStock&&unitDelta!==0)db.prepare('INSERT INTO unit_stock_movements(product_id,kind,quantity,reason,sale_id,created_at) VALUES(?,?,?,?,?,?)')
            .run(savedId,unitDelta>0?'IN':'OUT',Math.abs(unitDelta),'Ajuste no cadastro do produto',null,t);
        }else{
          const r=db.prepare('INSERT INTO products(sku,barcode,name,category_id,supplier_id,price_cents,cost_cents,stock,min_stock,unit,ncm,cfop,cst_csosn,origin,sale_mode,linked_unit_product_id,default_units_per_kg,track_unit_stock,unit_stock,unit_min_stock,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
            .run(p.sku||null,barcode||null,productName,p.category_id||null,p.supplier_id||null,p.price_cents||0,p.cost_cents||0,stock,minStock,mode==='WEIGHT'?'kg':mode==='VOLUME_L'?'L':mode==='VOLUME_ML'?'ml':(p.unit||'un'),p.ncm||'',p.cfop||'',p.cst_csosn||'',p.origin||'0',mode,linkedUnitProductId,defaultUnitsPerKg,trackUnitStock,unitStock,unitMinStock,t,t);
          savedId=Number(r.lastInsertRowid);
          stockDelta=stock;
          unitDelta=unitStock;
          if(stock>0)db.prepare('INSERT INTO stock_movements(product_id,kind,quantity,unit_cost_cents,reason,created_at,sale_mode,supplier_id) VALUES(?,?,?,?,?,?,?,?)')
            .run(savedId,'IN',stock,p.cost_cents||0,'Estoque inicial do cadastro',t,mode,p.supplier_id||null);
          if(trackUnitStock&&unitStock>0)db.prepare('INSERT INTO unit_stock_movements(product_id,kind,quantity,reason,sale_id,created_at) VALUES(?,?,?,?,?,?)')
            .run(savedId,'IN',unitStock,'Estoque unitário inicial do cadastro',null,t);
        }
        db.prepare('UPDATE products SET item_type=?,duration_minutes=? WHERE id=?').run(isService?'SERVICE':'PRODUCT',isService?Math.max(5,Math.min(1440,Number(p.duration_minutes||60))):60,savedId);
      })();
      activity(actor,p?.id?'Editou produto':'Cadastrou produto','product',savedId,`${productName} · preço ${pdfMoney(p.price_cents||0)} · estoque ${mode==='WEIGHT'?gramsLabel(stock):`${stock} ${p.unit||'un'}`}`,Number(p.price_cents||0),'products');
      if(stockDelta!==0){
        const qtyText=mode==='WEIGHT'?gramsLabel(Math.abs(stockDelta)):`${Math.abs(stockDelta)} ${p.unit||'un'}`;
        const cost=Number(p.cost_cents||current?.cost_cents||0);
        const amount=mode==='WEIGHT'?Math.round(cost*Math.abs(stockDelta)/1000):Math.round(cost*Math.abs(stockDelta));
        activity(actor,stockDelta>0?'Entrada de estoque por cadastro':'Saída de estoque por cadastro','stock',savedId,`${productName} · ${qtyText} · ${p?.id?'ajuste de cadastro':'estoque inicial'}`,amount,'stock');
      }
      return ok(savedId);
    }catch(e){fail(e.message,e.code||'PRODUCT_SAVE_ERROR')}
  });
  ipcMain.handle('products:barcode',(_,barcode)=>{const code=String(barcode||'').replace(/\D/g,'');if(!code)fail('Código de barras vazio.','VALIDATION');const p=db.prepare("SELECT p.*,c.name category,c.parent_id,s.name supplier_name,parent.name parent_category,linked.name linked_unit_name,linked.stock linked_unit_stock,linked.min_stock linked_unit_min_stock,linked.unit linked_unit_unit,COALESCE(linked.sale_mode,'UNIT') linked_unit_sale_mode FROM products p LEFT JOIN categories c ON c.id=p.category_id LEFT JOIN categories parent ON parent.id=c.parent_id LEFT JOIN suppliers s ON s.id=p.supplier_id LEFT JOIN products linked ON linked.id=p.linked_unit_product_id WHERE p.active=1 AND p.barcode=? LIMIT 1").get(code);if(!p)fail(`Nenhum produto encontrado para o código de barras ${code}.`,'BARCODE_NOT_FOUND');return ok(p)});
  ipcMain.handle('products:bulk-category',(_,input={})=>{
    const ids=Array.isArray(input.product_ids)?input.product_ids.map(Number).filter(Boolean):[];
    const categoryId=input.category_id?Number(input.category_id):null;
    if(!ids.length)fail('Selecione pelo menos um produto.','VALIDATION');
    let categoryName='Sem categoria';
    if(categoryId){
      const c=db.prepare('SELECT id,name,active FROM categories WHERE id=? AND active=1').get(categoryId);
      if(!c)fail('Categoria/subcategoria não encontrada.','NOT_FOUND');
      categoryName=c.name;
    }
    db.transaction(()=>{const q=db.prepare('UPDATE products SET category_id=?,updated_at=? WHERE id=? AND active=1');for(const id of ids)q.run(categoryId,now(),id)})();
    activity(currentOperator()?.name||'Sistema','Alterou categoria de vários produtos','product',null,`${ids.length} produto(s) → ${categoryName}`,0,'products');
    return ok(true);
  });
  ipcMain.handle('products:delete',(_,id)=>{
    const n=Number(id);if(!n)fail('Produto inválido.','VALIDATION');
    const p=db.prepare('SELECT id,name,active,price_cents FROM products WHERE id=?').get(n);
    if(!p||!p.active)fail('Produto não encontrado.','NOT_FOUND');
    const inKit=db.prepare('SELECT 1 FROM kit_items WHERE product_id=? LIMIT 1').get(n);if(inKit)fail('Não é possível excluir este produto porque ele faz parte de um Kit / Combo. Remova o produto do kit primeiro.','PRODUCT_IN_KIT');
    const linkedBy=db.prepare("SELECT name FROM products WHERE active=1 AND linked_unit_product_id=? LIMIT 1").get(n);if(linkedBy)fail(`Não é possível excluir este produto porque ele é o estoque unitário vinculado de "${linkedBy.name}". Remova o vínculo primeiro.`,'PRODUCT_LINKED_WEIGHT');
    const mixBase=db.prepare("SELECT name FROM kits WHERE active=1 AND COALESCE(kit_type,'STANDARD')='MIX_WEIGHT' AND weight_product_id=? LIMIT 1").get(n);if(mixBase)fail(`Não é possível excluir este produto porque ele é o estoque de peso do Mix "${mixBase.name}". Altere o Mix primeiro.`,'PRODUCT_IN_MIX_WEIGHT');
    db.prepare('UPDATE products SET active=0,updated_at=? WHERE id=?').run(now(),n);
    activity(currentOperator()?.name||'Sistema','Excluiu produto','product',n,`${p.name} · preço ${pdfMoney(p.price_cents||0)}`,Number(p.price_cents||0),'products');
    return ok(true);
  });
  ipcMain.handle('stock:analysis',()=>{
    const rows=db.prepare(`SELECT p.id,p.name,p.sku,p.barcode,p.stock,p.min_stock,p.unit,p.cost_cents,p.price_cents,p.item_type,
      COALESCE(p.sale_mode,'UNIT') sale_mode,COALESCE(p.track_unit_stock,0) track_unit_stock,
      COALESCE(p.unit_stock,0) unit_stock,COALESCE(p.unit_min_stock,0) unit_min_stock,
      c.name category,s.name supplier_name,
      COALESCE((SELECT SUM(CASE WHEN COALESCE(si.sale_mode,'UNIT') IN ('WEIGHT','MIX_WEIGHT') THEN COALESCE(si.weight_grams,0) ELSE si.quantity END) FROM sale_items si JOIN sales sa ON sa.id=si.sale_id WHERE si.product_id=p.id AND sa.sold_at>=datetime('now','-90 days') AND COALESCE(sa.status,'CONCLUIDA')<>'CANCELADA'),0) sold_qty_90d,
      (SELECT MAX(sa.sold_at) FROM sale_items si JOIN sales sa ON sa.id=si.sale_id WHERE si.product_id=p.id AND COALESCE(sa.status,'CONCLUIDA')<>'CANCELADA') last_sold_at
      FROM products p LEFT JOIN categories c ON c.id=p.category_id LEFT JOIN suppliers s ON s.id=p.supplier_id WHERE p.active=1 ORDER BY p.name`).all();
    return ok(rows.map(p=>{
      const sold=Number(p.sold_qty_90d||0), stock=Number(p.stock||0), min=Number(p.min_stock||0);
      const daily=sold/90, target=Math.max(min,Math.ceil(daily*30));
      const weighted=String(p.sale_mode)==='WEIGHT';
      const low=stock<=min||(Number(p.track_unit_stock)===1&&Number(p.unit_stock)<=Number(p.unit_min_stock));
      return {...p,low_stock:low?1:0,out_of_stock:stock<=0?1:0,suggested_reorder:Math.max(0,target-stock),
        estimated_days_left:daily>0?Math.floor(stock/daily):null, no_turnover_90d:sold===0?1:0,
        excess_stock:daily>0&&stock>Math.max(min,Math.ceil(daily*60))?1:(sold===0&&stock>min?1:0),
        stock_value_cents:weighted?Math.round(Number(p.cost_cents||0)*stock/1000):Math.round(Number(p.cost_cents||0)*stock)};
    }));
  });
  ipcMain.handle('stock:move',(_,m)=>{
    const p=db.prepare("SELECT stock,cost_cents,COALESCE(sale_mode,'UNIT') sale_mode,name,unit,COALESCE(item_type,'PRODUCT') item_type,COALESCE(track_unit_stock,0) track_unit_stock,COALESCE(unit_stock,0) unit_stock FROM products WHERE id=?").get(m.product_id);
    if(!p)fail('Produto não encontrado','NOT_FOUND');
    if(p.item_type==='SERVICE')fail('Serviços não possuem movimentação de estoque.','SERVICE_STOCK');
    const qty=Math.round(Number(m.quantity));
    if(!Number.isInteger(qty)||qty<=0)fail(p.sale_mode==='WEIGHT'?'Informe um peso maior que zero.':'Quantidade inválida','VALIDATION');
    const unitQty=Math.max(0,Math.round(Number(m.unit_quantity||0)));
    const supplierId=m.kind==='IN'&&Number(m.supplier_id)>0?Number(m.supplier_id):null;
    if(supplierId&&!db.prepare('SELECT id FROM suppliers WHERE id=?').get(supplierId))fail('Fornecedor não encontrado.','SUPPLIER_NOT_FOUND');
    const kind=String(m.kind||'').toUpperCase()==='OUT'?'OUT':'IN';
    const sign=kind==='IN'?1:-1,delta=sign*qty,unitDelta=sign*unitQty;
    if(p.stock+delta<0)fail(`Estoque insuficiente para ${p.name}. Disponível: ${p.sale_mode==='WEIGHT'?gramsLabel(p.stock):p.stock}.`,'STOCK');
    if(p.track_unit_stock&&p.unit_stock+unitDelta<0)fail(`Estoque unitário insuficiente para ${p.name}. Disponível: ${p.unit_stock} un.`,'UNIT_STOCK');
    const movementTime=now(),unitCost=Math.max(0,Number(m.unit_cost_cents||p.cost_cents||0));
    db.transaction(()=>{
      db.prepare('UPDATE products SET stock=stock+?,unit_stock=unit_stock+?,updated_at=? WHERE id=?').run(delta,p.track_unit_stock?unitDelta:0,movementTime,m.product_id);
      db.prepare('INSERT INTO stock_movements(product_id,kind,quantity,unit_cost_cents,reason,created_at,sale_mode,supplier_id) VALUES(?,?,?,?,?,?,?,?)').run(m.product_id,kind,qty,unitCost,m.reason||'',movementTime,p.sale_mode,supplierId);
      if(p.track_unit_stock&&unitQty>0)db.prepare('INSERT INTO unit_stock_movements(product_id,kind,quantity,reason,sale_id,created_at) VALUES(?,?,?,?,?,?)').run(m.product_id,kind,unitQty,m.reason||'',null,movementTime);
    })();
    const qtyText=p.sale_mode==='WEIGHT'?gramsLabel(qty):`${qty} ${p.unit||'un'}`;
    const totalValue=p.sale_mode==='WEIGHT'?Math.round(unitCost*qty/1000):Math.round(unitCost*qty);
    const reason=String(m.reason||'').trim();
    activity(currentOperator()?.name||'Sistema',kind==='IN'?'Entrada de estoque':'Saída de estoque','stock',Number(m.product_id),`${p.name} · ${qtyText}${reason?` · Motivo: ${reason}`:''}${totalValue>0?` · Valor de referência ${pdfMoney(totalValue)}`:''}`,totalValue,'stock');
    return ok(true);
  });
  ipcMain.handle('kits:list',(_,categoryId=null)=>{let sql=`SELECT k.*,wp.name weight_product_name,mc.name mix_category_name,GROUP_CONCAT(ki.product_id||':'||ki.quantity) items FROM kits k LEFT JOIN kit_items ki ON ki.kit_id=k.id LEFT JOIN products wp ON wp.id=k.weight_product_id LEFT JOIN categories mc ON mc.id=k.mix_category_id WHERE k.active=1`;const args=[];if(categoryId){sql+=' AND k.category_id=?';args.push(categoryId)}return ok(db.prepare(sql+' GROUP BY k.id ORDER BY k.name').all(...args))});
  ipcMain.handle('kits:save',(_,k)=>{let id=k.id;return ok(db.transaction(()=>{const type=String(k.kit_type||'STANDARD')==='MIX_WEIGHT'?'MIX_WEIGHT':'STANDARD';const price=Math.max(0,Math.round(Number(k.price_cents||0)));if(!String(k.name||'').trim())fail('Informe o nome do combo.','VALIDATION');let weightProductId=null,mixCategoryId=null;if(type==='MIX_WEIGHT'){if(price<=0)fail('Informe o preço por kg do Mix por Peso.','VALIDATION');weightProductId=k.weight_product_id?Number(k.weight_product_id):null;mixCategoryId=k.mix_category_id?Number(k.mix_category_id):null;if(weightProductId){const wp=db.prepare("SELECT id,name,active,COALESCE(sale_mode,'UNIT') sale_mode FROM products WHERE id=?").get(weightProductId);if(!wp||!wp.active)fail('Produto-base de peso não encontrado.','NOT_FOUND');if(wp.sale_mode!=='WEIGHT')fail(`O produto-base "${wp.name}" precisa ser vendido por peso.`,'MIX_WEIGHT_BASE_MODE');}if(mixCategoryId){const mc=db.prepare('SELECT id,name,active FROM categories WHERE id=?').get(mixCategoryId);if(!mc||!mc.active)fail('Categoria de produtos do Mix não encontrada.','NOT_FOUND');}}else{for(const it of k.items||[]){const p=db.prepare("SELECT name,COALESCE(sale_mode,'UNIT') sale_mode FROM products WHERE id=? AND active=1").get(it.product_id);if(!p)fail('Produto de Kit/Combo não encontrado.','NOT_FOUND');if(p.sale_mode==='WEIGHT')fail(`O produto ${p.name} é vendido por peso e não pode ser usado em Kit/Combo normal.`, 'WEIGHT_IN_KIT');}}if(id)db.prepare('UPDATE kits SET name=?,sku=?,price_cents=?,category_id=?,kit_type=?,weight_product_id=?,mix_category_id=? WHERE id=?').run(k.name,k.sku||null,price,k.category_id||null,type,weightProductId,mixCategoryId,id);else id=db.prepare('INSERT INTO kits(name,sku,price_cents,category_id,kit_type,weight_product_id,mix_category_id,created_at) VALUES(?,?,?,?,?,?,?,?)').run(k.name,k.sku||null,price,k.category_id||null,type,weightProductId,mixCategoryId,now()).lastInsertRowid;db.prepare('DELETE FROM kit_items WHERE kit_id=?').run(id);if(type==='STANDARD')for(const it of k.items||[])db.prepare('INSERT INTO kit_items VALUES(?,?,?)').run(id,it.product_id,it.quantity);return Number(id);})())});
  ipcMain.handle('kits:delete',(_,id)=>ok(db.transaction(()=>{const kitId=Number(id);if(!kitId)fail('Kit / Combo inválido.','VALIDATION');const kit=db.prepare('SELECT * FROM kits WHERE id=? AND active=1').get(kitId);if(!kit)fail('Kit / Combo não encontrado.','NOT_FOUND');const openQuote=db.prepare("SELECT q.number FROM quote_items qi JOIN quotes q ON q.id=qi.quote_id WHERE qi.kit_id=? AND q.status='ABERTO' LIMIT 1").get(kitId);if(openQuote)fail(`Este Kit / Combo está no orçamento #${openQuote.number}, que ainda está em aberto. Remova-o do orçamento antes de excluir.`, 'KIT_IN_OPEN_QUOTE');db.prepare('UPDATE kits SET active=0 WHERE id=?').run(kitId);activity('',String(kit.kit_type||'STANDARD')==='MIX_WEIGHT'?'Excluiu Mix por Peso':'Excluiu Kit / Combo','kit',kitId,kit.name||'');return true})()));
  ipcMain.handle('customers:list',()=>ok(db.prepare('SELECT c.*,COALESCE(SUM(cp.amount_cents),0) paid_cents FROM customers c LEFT JOIN customer_payments cp ON cp.customer_id=c.id GROUP BY c.id ORDER BY c.name').all()));
  ipcMain.handle('customers:save',(_,c)=>{
    const t=now(); const type=String(c?.person_type||'PF').toUpperCase()==='PJ'?'PJ':'PF';
    const name=String(c?.name||'').trim(); if(!name)fail(type==='PJ'?'Informe a Razão Social / Nome.':'Informe o nome do cliente','VALIDATION');
    const phone=String(c.phone||'').replace(/\D/g,''); const cpf=String(c.cpf||'').replace(/\D/g,''); const cnpj=String(c.cnpj||'').replace(/\D/g,''); const cep=String(c.cep||'').replace(/\D/g,'');
    if(type==='PJ' && cnpj.length!==14)fail('Informe o CNPJ com 14 dígitos.','VALIDATION');
    if(phone && phone.length!==11)fail('O telefone, quando informado, deve ter 11 dígitos.','VALIDATION');
    const values=[name,type,cpf,String(c.rg||''),cnpj,phone,String(c.email||''),String(c.address||''),String(c.address_number||''),String(c.address_complement||''),String(c.neighborhood||''),String(c.city||''),String(c.state||'').slice(0,2).toUpperCase(),cep,String(c.ie||''),String(c.im||'')];
    if(c.id)db.prepare('UPDATE customers SET name=?,person_type=?,cpf=?,rg=?,cnpj=?,phone=?,email=?,address=?,address_number=?,address_complement=?,neighborhood=?,city=?,state=?,cep=?,ie=?,im=?,updated_at=? WHERE id=?').run(...values,t,c.id);
    else db.prepare('INSERT INTO customers(name,person_type,cpf,rg,cnpj,phone,email,address,address_number,address_complement,neighborhood,city,state,cep,ie,im,balance_cents,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,?,?)').run(...values,t,t);
    return ok(true);
  });
  ipcMain.handle('customers:ledger',(_,id)=>ok({customer:db.prepare('SELECT * FROM customers WHERE id=?').get(id),sales:db.prepare("SELECT s.*,sp.method,sp.original_cents,sp.installments,sp.fee_percent,sp.fee_cents,sp.final_cents FROM sales s LEFT JOIN sale_payments sp ON sp.sale_id=s.id WHERE s.customer_id=? ORDER BY s.sold_at DESC").all(id),payments:db.prepare('SELECT * FROM customer_payments WHERE customer_id=? ORDER BY created_at DESC').all(id)}));
  ipcMain.handle('customers:payment',(_,p)=>{if(!p.customer_id||p.amount_cents<=0)fail('Pagamento inválido','VALIDATION');db.transaction(()=>{db.prepare('INSERT INTO customer_payments(customer_id,amount_cents,method,note,created_at) VALUES(?,?,?,?,?)').run(p.customer_id,p.amount_cents,p.method||'Dinheiro',p.note||'',now());db.prepare('UPDATE customers SET balance_cents=MAX(0,balance_cents-?),updated_at=? WHERE id=?').run(p.amount_cents,now(),p.customer_id)})();return ok(true)});
  ipcMain.handle('sales:list',(_,date)=>ok(db.prepare("SELECT s.*,GROUP_CONCAT(DISTINCT (si.name||CASE WHEN COALESCE(si.sale_mode,'UNIT') IN ('WEIGHT','MIX_WEIGHT') THEN ' '||printf('%.3f',COALESCE(si.weight_grams,0)/1000.0)||' kg'||CASE WHEN COALESCE(si.unit_count,0)>0 THEN ' · '||si.unit_count||' un.' ELSE '' END||CASE WHEN COALESCE(si.sale_mode,'UNIT')='MIX_WEIGHT' THEN COALESCE(' ['||(SELECT GROUP_CONCAT(smi.quantity||' '||smi.product_name||' · '||printf('%.3f',COALESCE(smi.weight_grams,0)/1000.0)||' kg','; ') FROM sale_mix_items smi WHERE smi.sale_item_id=si.id)||']','') ELSE '' END ELSE ' x'||si.quantity END)) items,fd.id fiscal_id,fd.number fiscal_number,fd.series fiscal_series,fd.status fiscal_status,GROUP_CONCAT(DISTINCT (sp.condition_text||' · taxa '||printf('%.2f',sp.fee_percent)||'% · final '||printf('R$ %.2f',sp.final_cents/100.0))) payment_details FROM sales s LEFT JOIN sale_items si ON si.sale_id=s.id LEFT JOIN fiscal_documents fd ON fd.sale_id=s.id LEFT JOIN sale_payments sp ON sp.sale_id=s.id WHERE substr(s.sold_at,1,10)=? GROUP BY s.id ORDER BY s.sold_at DESC").all(date)));
  ipcMain.handle('sales:detail',(_,id)=>{const items=db.prepare('SELECT * FROM sale_items WHERE sale_id=?').all(id).map(i=>({...i,mix_items:String(i.sale_mode||'UNIT')==='MIX_WEIGHT'?db.prepare('SELECT product_id,product_name name,quantity,weight_grams FROM sale_mix_items WHERE sale_item_id=? ORDER BY id').all(i.id):[]}));return ok({sale:db.prepare('SELECT * FROM sales WHERE id=?').get(id),items,payments:db.prepare('SELECT * FROM sale_payments WHERE sale_id=?').all(id)})});
  ipcMain.handle('sales:cancel',(_,input={})=>ok(db.transaction(()=>{const id=Number(input.id);const reason=String(input.reason||'').trim();const operator=String(input.operator||'Administrador').trim()||'Administrador';if(!id)fail('Venda inválida.','VALIDATION');if(reason.length<5)fail('Informe o motivo do cancelamento com pelo menos 5 caracteres.','VALIDATION');const sale=db.prepare('SELECT * FROM sales WHERE id=?').get(id);if(!sale)fail('Venda não encontrada.','NOT_FOUND');if(String(sale.status||'CONCLUIDA')==='CANCELADA')fail('Esta venda já foi cancelada.','SALE_CANCELED');const fiscal=db.prepare('SELECT * FROM fiscal_documents WHERE sale_id=? ORDER BY id DESC LIMIT 1').get(id);const fiscalStatus=String(fiscal?.status||'');if(fiscal&&fiscalStatus!=='CANCELADA'&&!/^REJEITADA_/.test(fiscalStatus))fail('Esta venda possui NFC-e que ainda exige regularização fiscal. Cancele/regularize primeiro o documento no menu Fiscal.','FISCAL_REQUIRED');if(Number(sale.due_cents||0)>0&&sale.customer_id){const c=db.prepare('SELECT balance_cents FROM customers WHERE id=?').get(sale.customer_id);const laterPayment=db.prepare('SELECT id FROM customer_payments WHERE customer_id=? AND created_at>=? LIMIT 1').get(sale.customer_id,sale.sold_at);if(laterPayment)fail('Há recebimento registrado para este cliente após esta venda. Como o histórico antigo não vincula cada recebimento a uma dívida específica, o cancelamento automático foi bloqueado para proteger o saldo do cliente.','DEBT_PAYMENT_AMBIGUOUS');if(Number(c?.balance_cents||0)<Number(sale.due_cents||0))fail('O débito desta venda já foi total ou parcialmente recebido. Regularize os recebimentos do cliente antes de cancelar a venda.','DEBT_ALREADY_PAID')}const moves=db.prepare("SELECT product_id,quantity,COALESCE(sale_mode,'UNIT') sale_mode FROM stock_movements WHERE kind='OUT' AND reason=?").all('Venda #'+id);const unitMoves=db.prepare("SELECT product_id,quantity FROM unit_stock_movements WHERE kind='OUT' AND sale_id=?").all(id);const saleItemCount=Number(db.prepare('SELECT COUNT(*) n FROM sale_items WHERE sale_id=?').get(id)?.n||0);if(saleItemCount>0&&!moves.length)fail('Esta venda não possui histórico de movimentação de estoque suficiente para um cancelamento automático seguro.','STOCK_HISTORY');for(const m of moves){const pp=db.prepare("SELECT name,unit FROM products WHERE id=?").get(m.product_id),movementTime=now();db.prepare('UPDATE products SET stock=stock+?,updated_at=? WHERE id=?').run(Number(m.quantity||0),movementTime,m.product_id);db.prepare('INSERT INTO stock_movements(product_id,kind,quantity,reason,created_at,sale_mode) VALUES(?,?,?,?,?,?)').run(m.product_id,'IN',m.quantity,'Cancelamento da venda #'+id,movementTime,m.sale_mode||'UNIT');const qtyText=String(m.sale_mode||'UNIT')==='WEIGHT'?gramsLabel(m.quantity):`${Number(m.quantity||0)} ${pp?.unit||'un'}`;activity(operator,'Entrada de estoque por cancelamento','stock',m.product_id,`${pp?.name||'Produto'} · ${qtyText} · Cancelamento da venda #${id}`,0,'stock')}for(const m of unitMoves){const pp=db.prepare('SELECT name FROM products WHERE id=?').get(m.product_id),movementTime=now();db.prepare('UPDATE products SET unit_stock=unit_stock+?,updated_at=? WHERE id=?').run(Number(m.quantity||0),movementTime,m.product_id);db.prepare('INSERT INTO unit_stock_movements(product_id,kind,quantity,reason,sale_id,created_at) VALUES(?,?,?,?,?,?)').run(m.product_id,'IN',m.quantity,'Cancelamento da venda #'+id,id,movementTime);activity(operator,'Entrada de estoque unitário por cancelamento','stock',m.product_id,`${pp?.name||'Produto'} · ${Number(m.quantity||0)} un. · Cancelamento da venda #${id}`,0,'stock')}if(Number(sale.due_cents||0)>0&&sale.customer_id)db.prepare('UPDATE customers SET balance_cents=MAX(0,balance_cents-?),updated_at=? WHERE id=?').run(Number(sale.due_cents||0),now(),sale.customer_id);db.prepare("UPDATE appointments SET status='CANCELADO',completed_at=? WHERE sale_id=? AND status='PENDENTE'").run(now(),id);if(sale.quote_id)db.prepare("UPDATE quotes SET status='ABERTO' WHERE id=? AND status='CONVERTIDO'").run(sale.quote_id);db.prepare("UPDATE sales SET status='CANCELADA',canceled_at=?,canceled_reason=?,canceled_by=? WHERE id=?").run(now(),reason,operator,id);activity(operator,'Cancelou venda','sale',id,`${reason} · Total ${pdfMoney(sale.total_cents)}`,Number(sale.total_cents||0),'sales');return {id,restored_items:moves.length+unitMoves.length};})()));
  ipcMain.handle('agenda:reconcile',()=>{const d=new Date(),pad=n=>String(n).padStart(2,'0'),today=`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;const pending=db.prepare("SELECT id,scheduled_at FROM appointments WHERE type='SERVICO' AND status='PENDENTE'").all();const expired=pending.filter(a=>String(a.scheduled_at||'').slice(0,10)<today);if(expired.length){const q=db.prepare("UPDATE appointments SET attendance='NAO_COMPARECEU',status='CONCLUIDO',completed_at=? WHERE id=?");db.transaction(()=>expired.forEach(a=>q.run(now(),a.id)))()}return ok({auto_absent:expired.length})});
  ipcMain.handle('agenda:list',(_,opts={})=>{const type=String(opts.type||'');let customerRows=type&&type!=='INTERNO'?db.prepare("SELECT a.*,c.balance_cents,'customer' agenda_source FROM appointments a LEFT JOIN customers c ON c.id=a.customer_id WHERE a.type=? ORDER BY CASE WHEN a.status='PENDENTE' THEN 0 ELSE 1 END,a.scheduled_at").all(type):type==='INTERNO'?[]:db.prepare("SELECT a.*,c.balance_cents,'customer' agenda_source FROM appointments a LEFT JOIN customers c ON c.id=a.customer_id ORDER BY CASE WHEN a.status='PENDENTE' THEN 0 ELSE 1 END,a.scheduled_at").all();let internalRows=type&&type!=='INTERNO'?[]:db.prepare("SELECT id,'INTERNO' type,NULL customer_id,'Loja' customer_name,title,scheduled_at,alert_at,0 amount_cents,status,'' attendance,NULL sale_id,notes,alerted,completed_at,0 paid_cents,created_at,task_kind,'' delivery_method,'' delivery_address,'' delivery_phone,'internal' agenda_source FROM internal_appointments ORDER BY CASE WHEN status='PENDENTE' THEN 0 ELSE 1 END,scheduled_at").all();return ok([...customerRows,...internalRows].sort((a,b)=>{const ap=a.status==='PENDENTE'?0:1,bp=b.status==='PENDENTE'?0:1;return ap-bp||String(a.scheduled_at).localeCompare(String(b.scheduled_at))}))});
  ipcMain.handle('agenda:delivery-sales',(_,customerId)=>{const id=Number(customerId);if(!id)return ok([]);return ok(db.prepare("SELECT id,sold_at,total_cents,payment,status,COALESCE(delivery_required,0) delivery_required,COALESCE(delivery_method,'') delivery_method FROM sales WHERE customer_id=? AND COALESCE(status,'CONCLUIDA')<>'CANCELADA' ORDER BY COALESCE(delivery_required,0) DESC,sold_at DESC LIMIT 100").all(id))});
  ipcMain.handle('agenda:create',(_,a)=>{const type=String(a.type||'SERVICO').toUpperCase();if(!a.scheduled_at)fail('Informe a data e a hora do agendamento.','VALIDATION');if(type==='INTERNO'){const allowed=['COMPRAS_ESTOQUE','PAGAR_CONTA','INVENTARIO','OUTRO'];const taskKind=allowed.includes(String(a.task_kind||'').toUpperCase())?String(a.task_kind).toUpperCase():'OUTRO';const labels={COMPRAS_ESTOQUE:'Compra para estoque',PAGAR_CONTA:'Pagar conta da loja',INVENTARIO:'Realizar inventário',OUTRO:'Tarefa interna'};const title=String(a.title||labels[taskKind]).trim()||labels[taskKind];const r=db.prepare('INSERT INTO internal_appointments(task_kind,title,scheduled_at,alert_at,status,notes,alerted,created_at) VALUES(?,?,?,?,?,?,?,?)').run(taskKind,title,String(a.scheduled_at),a.alert_at?String(a.alert_at):null,'PENDENTE',String(a.notes||''),0,now());activity('Agenda','Criou tarefa interna','internal_appointment',Number(r.lastInsertRowid),title);return ok(Number(r.lastInsertRowid))}const customer=db.prepare('SELECT * FROM customers WHERE id=?').get(Number(a.customer_id));if(!customer)fail('Selecione um cliente cadastrado.','VALIDATION');if(type==='RECEBIMENTO'&&Number(customer.balance_cents||0)<=0)fail('Este cliente não possui saldo devedor para agendar recebimento.','VALIDATION');let title=String(a.title||(type==='RECEBIMENTO'?'Recebimento de saldo devedor':type==='ENTREGA'?'Entrega de compra confirmada':'Serviço agendado')).trim();let amount=type==='RECEBIMENTO'?Math.max(0,Number(a.amount_cents||customer.balance_cents||0)):0;let saleId=a.sale_id?Number(a.sale_id):null,deliveryMethod='',deliveryAddress='',deliveryPhone='';if(type==='ENTREGA'){if(!saleId)fail('Selecione a venda confirmada que será entregue.','VALIDATION');const sale=db.prepare("SELECT * FROM sales WHERE id=? AND customer_id=? AND COALESCE(status,'CONCLUIDA')<>'CANCELADA'").get(saleId,customer.id);if(!sale)fail('A venda selecionada não pertence ao cliente ou não está disponível para entrega.','VALIDATION');deliveryMethod=['APP','LOJA'].includes(String(a.delivery_method||'').toUpperCase())?String(a.delivery_method).toUpperCase():'LOJA';deliveryAddress=String(a.delivery_address||[customer.address,customer.address_number,customer.address_complement,customer.neighborhood,customer.city,customer.state].filter(Boolean).join(', ')).trim();deliveryPhone=String(a.delivery_phone||customer.phone||'').trim();if(!deliveryAddress)fail('Informe o endereço da entrega.','VALIDATION');title=title||`Entrega da venda #${saleId}`}const r=db.prepare('INSERT INTO appointments(type,customer_id,customer_name,title,scheduled_at,alert_at,amount_cents,status,attendance,sale_id,notes,alerted,created_at,delivery_method,delivery_address,delivery_phone) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(type==='RECEBIMENTO'?'RECEBIMENTO':type==='ENTREGA'?'ENTREGA':'SERVICO',customer.id,customer.name,title,String(a.scheduled_at),a.alert_at?String(a.alert_at):null,amount,'PENDENTE','',saleId,String(a.notes||''),0,now(),deliveryMethod,deliveryAddress,deliveryPhone);return ok(Number(r.lastInsertRowid))});
  ipcMain.handle('agenda:update',(_,a)=>{if(String(a.agenda_source||'')==='internal'||String(a.type||'').toUpperCase()==='INTERNO'){const current=db.prepare('SELECT * FROM internal_appointments WHERE id=?').get(Number(a.id));if(!current)fail('Tarefa interna não encontrada.','NOT_FOUND');if(!a.scheduled_at)fail('Informe a data e a hora do agendamento.','VALIDATION');const allowed=['COMPRAS_ESTOQUE','PAGAR_CONTA','INVENTARIO','OUTRO'];const taskKind=allowed.includes(String(a.task_kind||current.task_kind||'').toUpperCase())?String(a.task_kind||current.task_kind).toUpperCase():'OUTRO';const title=String(a.title||current.title||'Tarefa interna').trim();db.prepare('UPDATE internal_appointments SET task_kind=?,title=?,scheduled_at=?,alert_at=?,notes=?,alerted=0 WHERE id=?').run(taskKind,title,String(a.scheduled_at),a.alert_at?String(a.alert_at):null,String(a.notes||''),current.id);return ok(true)}const current=db.prepare('SELECT * FROM appointments WHERE id=?').get(Number(a.id));if(!current)fail('Agendamento não encontrado.','NOT_FOUND');const customer=db.prepare('SELECT * FROM customers WHERE id=?').get(Number(a.customer_id));if(!customer)fail('Selecione um cliente cadastrado.','VALIDATION');if(!a.scheduled_at)fail('Informe a data e a hora do agendamento.','VALIDATION');const type=current.type;const title=String(a.title||(type==='RECEBIMENTO'?'Recebimento de saldo devedor':type==='ENTREGA'?'Entrega de compra confirmada':'Serviço agendado')).trim();const amount=type==='RECEBIMENTO'?Math.max(0,Number(a.amount_cents!=null?a.amount_cents:current.amount_cents||0)):0;let saleId=current.sale_id,deliveryMethod=current.delivery_method||'',deliveryAddress=current.delivery_address||'',deliveryPhone=current.delivery_phone||'';if(type==='ENTREGA'){saleId=a.sale_id?Number(a.sale_id):saleId;if(!saleId)fail('Selecione a venda confirmada que será entregue.','VALIDATION');const sale=db.prepare("SELECT * FROM sales WHERE id=? AND customer_id=? AND COALESCE(status,'CONCLUIDA')<>'CANCELADA'").get(saleId,customer.id);if(!sale)fail('A venda selecionada não pertence ao cliente ou não está disponível para entrega.','VALIDATION');deliveryMethod=['APP','LOJA'].includes(String(a.delivery_method||deliveryMethod).toUpperCase())?String(a.delivery_method||deliveryMethod).toUpperCase():'LOJA';deliveryAddress=String(a.delivery_address||deliveryAddress||[customer.address,customer.address_number,customer.address_complement,customer.neighborhood,customer.city,customer.state].filter(Boolean).join(', ')).trim();deliveryPhone=String(a.delivery_phone||deliveryPhone||customer.phone||'').trim();if(!deliveryAddress)fail('Informe o endereço da entrega.','VALIDATION')}db.prepare('UPDATE appointments SET customer_id=?,customer_name=?,title=?,scheduled_at=?,alert_at=?,amount_cents=?,notes=?,alerted=0,sale_id=?,delivery_method=?,delivery_address=?,delivery_phone=? WHERE id=?').run(customer.id,customer.name,title,String(a.scheduled_at),a.alert_at?String(a.alert_at):null,amount,String(a.notes||''),saleId,deliveryMethod,deliveryAddress,deliveryPhone,current.id);return ok(true)});
  ipcMain.handle('agenda:due-alerts',()=>{const d=new Date(),pad=n=>String(n).padStart(2,'0'),t=`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;const rows=db.prepare("SELECT *,'customer' agenda_source FROM appointments WHERE status='PENDENTE' AND alerted=0 AND alert_at IS NOT NULL AND alert_at<=? ORDER BY alert_at").all(t),internal=db.prepare("SELECT id,'INTERNO' type,NULL customer_id,'Loja' customer_name,title,scheduled_at,alert_at,0 amount_cents,status,'' attendance,NULL sale_id,notes,alerted,completed_at,0 paid_cents,created_at,task_kind,'' delivery_method,'' delivery_address,'' delivery_phone,'internal' agenda_source FROM internal_appointments WHERE status='PENDENTE' AND alerted=0 AND alert_at IS NOT NULL AND alert_at<=? ORDER BY alert_at").all(t);if(rows.length){const q=db.prepare('UPDATE appointments SET alerted=1 WHERE id=?');db.transaction(()=>rows.forEach(x=>q.run(x.id)))()}if(internal.length){const q=db.prepare('UPDATE internal_appointments SET alerted=1 WHERE id=?');db.transaction(()=>internal.forEach(x=>q.run(x.id)))()}return ok([...rows,...internal].sort((a,b)=>String(a.alert_at).localeCompare(String(b.alert_at))))});
  ipcMain.handle('agenda:attendance',(_,x)=>{const a=db.prepare("SELECT * FROM appointments WHERE id=? AND type='SERVICO'").get(Number(x.id));if(!a)fail('Agendamento não encontrado.','NOT_FOUND');const v=x.attendance==='COMPARECEU'?'COMPARECEU':'NAO_COMPARECEU';db.prepare("UPDATE appointments SET attendance=?,status='CONCLUIDO',completed_at=? WHERE id=?").run(v,now(),a.id);return ok(true)});
  ipcMain.handle('agenda:complete-delivery',(_,x)=>{const a=db.prepare("SELECT * FROM appointments WHERE id=? AND type='ENTREGA' AND status='PENDENTE'").get(Number(x.id));if(!a)fail('Entrega não encontrada ou já concluída.','NOT_FOUND');const v=x.result==='NAO_ENTREGUE'?'NAO_ENTREGUE':'ENTREGUE';db.prepare("UPDATE appointments SET attendance=?,status='CONCLUIDO',completed_at=? WHERE id=?").run(v,now(),a.id);return ok(true)});
  ipcMain.handle('agenda:complete-task',(_,x)=>{const a=db.prepare("SELECT * FROM internal_appointments WHERE id=? AND status='PENDENTE'").get(Number(x.id));if(!a)fail('Tarefa interna não encontrada ou já concluída.','NOT_FOUND');db.prepare("UPDATE internal_appointments SET status='CONCLUIDO',completed_at=? WHERE id=?").run(now(),a.id);return ok(true)});
  ipcMain.handle('agenda:complete-payment',(_,x)=>db.transaction(()=>{const a=db.prepare("SELECT * FROM appointments WHERE id=? AND type='RECEBIMENTO' AND status='PENDENTE'").get(Number(x.id));if(!a)fail('Agendamento de recebimento não encontrado ou já concluído.','NOT_FOUND');const c=db.prepare('SELECT * FROM customers WHERE id=?').get(a.customer_id);if(!c)fail('Cliente não encontrado.','NOT_FOUND');const balance=Math.max(0,Number(c.balance_cents||0));const scheduled=Math.max(0,Number(a.amount_cents||0));const paid=Math.min(balance,scheduled>0?scheduled:balance);const remaining=Math.max(0,balance-paid);if(paid>0){db.prepare('INSERT INTO customer_payments(customer_id,amount_cents,method,note,created_at) VALUES(?,?,?,?,?)').run(c.id,paid,String(x.method||'Dinheiro'),'Recebimento agendado #'+a.id,now());db.prepare('UPDATE customers SET balance_cents=?,updated_at=? WHERE id=?').run(remaining,now(),c.id)}db.prepare("UPDATE appointments SET status='CONCLUIDO',completed_at=?,paid_cents=? WHERE id=?").run(now(),paid,a.id);return ok({paid_cents:paid,remaining_cents:remaining,scheduled_cents:scheduled,customer_name:c.name})})());
  ipcMain.handle('agenda:report',(_,opts={})=>{const mode=opts.mode==='monthly'?'monthly':'daily';const key=mode==='monthly'?String(opts.month||'').slice(0,7):String(opts.date||'').slice(0,10);const n=mode==='monthly'?7:10;const rows=db.prepare(`SELECT *,'customer' agenda_source FROM appointments WHERE substr(scheduled_at,1,${n})=? OR substr(completed_at,1,${n})=? ORDER BY scheduled_at DESC`).all(key,key),internal=db.prepare(`SELECT id,'INTERNO' type,NULL customer_id,'Loja' customer_name,title,scheduled_at,alert_at,0 amount_cents,status,'' attendance,NULL sale_id,notes,alerted,completed_at,0 paid_cents,created_at,task_kind,'' delivery_method,'' delivery_address,'' delivery_phone,'internal' agenda_source FROM internal_appointments WHERE substr(scheduled_at,1,${n})=? OR substr(completed_at,1,${n})=? ORDER BY scheduled_at DESC`).all(key,key);return ok([...rows,...internal].sort((a,b)=>String(b.scheduled_at).localeCompare(String(a.scheduled_at))))});
  ipcMain.handle('sales:create',(_,sale)=>{const result=db.transaction(()=>{
    const openCash=db.prepare("SELECT id FROM cash_registers WHERE closing_status='ABERTO' ORDER BY id DESC LIMIT 1").get();
    if(!openCash)fail('É necessário abrir o caixa antes de realizar uma venda. Abra o caixa no menu Caixa.','CASH_CLOSED');
    if(!Array.isArray(sale.items)||!sale.items.length)fail('O carrinho está vazio','VALIDATION');
let sourceQuote=null;

if(sale.quote_id){
  sourceQuote=db.prepare(
    'SELECT * FROM quotes WHERE id=?'
  ).get(Number(sale.quote_id));

  if(!sourceQuote)
    fail('Orçamento de origem não encontrado.','QUOTE_NOT_FOUND');

  if(sourceQuote.status!=='ABERTO')
    fail(
      `O orçamento #${sourceQuote.number} não está mais em aberto.`,
      'QUOTE_NOT_OPEN'
    );
}
    let subtotal=0;const requirements=new Map(),unitRequirements=new Map();
    const addRequirement=(pid,qty)=>{const id=Number(pid);if(!id)return;const row=db.prepare("SELECT COALESCE(item_type,'PRODUCT') item_type FROM products WHERE id=?").get(id);if(row?.item_type==='SERVICE')return;const n=Math.max(0,Math.round(Number(qty||0)));if(n>0)requirements.set(id,(requirements.get(id)||0)+n);};
    const addUnitRequirement=(pid,qty)=>{const id=Number(pid);const n=Math.max(0,Math.round(Number(qty||0)));if(id&&n>0)unitRequirements.set(id,(unitRequirements.get(id)||0)+n);};
    for(const i of sale.items){
      if(i.kit_id){
        const kit=db.prepare('SELECT * FROM kits WHERE id=? AND active=1').get(i.kit_id);
        if(!kit)fail('Combo não encontrado','NOT_FOUND');
        if(String(kit.kit_type||'STANDARD')==='MIX_WEIGHT'){
          const mixItems=(Array.isArray(i.mix_items)?i.mix_items:[]).map(x=>({product_id:Number(x.product_id),quantity:Math.max(0,Math.round(Number(x.quantity||0))),weight_grams:Math.max(0,Math.round(Number(x.weight_grams||0)))})).filter(x=>x.product_id&&x.quantity>0);
          if(!mixItems.length)fail(`Selecione pelo menos uma cor/produto para ${kit.name}.`,'MIX_EMPTY');
          const seen=new Set();
          for(const x of mixItems){
            if(seen.has(x.product_id))fail('Há produto repetido na composição do Mix.','MIX_DUPLICATE');
            seen.add(x.product_id);
            const p=db.prepare("SELECT p.id,p.name,p.stock,p.active,p.category_id,c.parent_id,p.item_type,COALESCE(p.sale_mode,'UNIT') sale_mode FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.id=?").get(x.product_id);
            if(!p||!p.active)fail('Um produto do Mix não está disponível.','MIX_PRODUCT_NOT_FOUND');
            if(p.sale_mode!=='UNIT'||p.item_type==='SERVICE')fail(`O produto "${p.name}" precisa ser vendido por unidade para participar do Mix.`,'MIX_PRODUCT_MODE');
            if(kit.mix_category_id&&Number(p.category_id)!==Number(kit.mix_category_id)&&Number(p.parent_id)!==Number(kit.mix_category_id))fail(`O produto "${p.name}" não pertence à categoria configurada para este Mix.`,'MIX_CATEGORY');
            if(x.weight_grams<=0)fail(`Informe o peso de ${p.name} dentro do Mix ${kit.name}.`,'MIX_WEIGHT_REQUIRED');
            addRequirement(x.product_id,x.quantity);
          }
          const grams=mixItems.reduce((sum,x)=>sum+x.weight_grams,0);
          if(grams<=0)fail(`Informe os pesos das cores/produtos de ${kit.name}.`,'WEIGHT_REQUIRED');
          if(kit.weight_product_id){
            const wp=db.prepare("SELECT id,name,active,COALESCE(sale_mode,'UNIT') sale_mode FROM products WHERE id=?").get(Number(kit.weight_product_id));
            if(!wp||!wp.active)fail(`O estoque-base de peso do Mix ${kit.name} não está disponível.`,'MIX_WEIGHT_BASE_NOT_FOUND');
            if(wp.sale_mode!=='WEIGHT')fail(`O estoque-base de peso do Mix ${kit.name} não está configurado como produto por kg.`,'MIX_WEIGHT_BASE_MODE');
            addRequirement(wp.id,grams);
          }
          subtotal+=Math.round(Number(kit.price_cents||0)*grams/1000);
        }else{
          const parts=db.prepare("SELECT ki.*,COALESCE(p.sale_mode,'UNIT') sale_mode,p.name product_name FROM kit_items ki JOIN products p ON p.id=ki.product_id WHERE ki.kit_id=?").all(i.kit_id);
          if(!parts.length)fail(`O combo ${kit.name} não possui composição`,'KIT_EMPTY');
          if(parts.some(x=>x.sale_mode==='WEIGHT'))fail(`O combo ${kit.name} possui produto vendido por peso e precisa ser ajustado antes da venda.`,'WEIGHT_IN_KIT');
          for(const x of parts)addRequirement(x.product_id,x.quantity*i.quantity);
          subtotal+=kit.price_cents*i.quantity;
        }
      }else{
        const p=db.prepare("SELECT stock,name,unit,COALESCE(sale_mode,'UNIT') sale_mode,price_cents,linked_unit_product_id,COALESCE(track_unit_stock,0) track_unit_stock,COALESCE(unit_stock,0) unit_stock FROM products WHERE id=? AND active=1").get(i.product_id);
        if(!p)fail('Produto não encontrado','NOT_FOUND');
        if(p.sale_mode==='WEIGHT'){
          const grams=Math.round(Number(i.weight_grams||0));
          if(grams<=0)fail(`Informe o peso de ${p.name}.`,'WEIGHT_REQUIRED');
          addRequirement(i.product_id,grams);
          const unitCount=Math.max(0,Math.round(Number(i.unit_count||0)));
          if(unitCount>0){
            const linkedId=Number(p.linked_unit_product_id||0);
            if(Number(p.track_unit_stock||0)===1)addUnitRequirement(i.product_id,unitCount);
            else if(linkedId){
              const linked=db.prepare("SELECT id,name,stock,active,COALESCE(sale_mode,'UNIT') sale_mode FROM products WHERE id=?").get(linkedId);
              if(!linked||!linked.active)fail(`O estoque unitário vinculado de ${p.name} não está disponível.`,'LINKED_UNIT_NOT_FOUND');
              if(linked.sale_mode!=='UNIT')fail(`O produto unitário vinculado de ${p.name} precisa ser vendido por unidade.`,'LINKED_UNIT_MODE');
              addRequirement(linkedId,unitCount);
            }
          }
          subtotal+=Math.round(Number(i.unit_price_cents||p.price_cents||0)*grams/1000);
        }else if(['VOLUME_L','VOLUME_ML'].includes(p.sale_mode)){
          const ml=Math.max(0,Math.round(Number(i.volume_ml||0)));if(ml<=0)fail(`Informe o volume de ${p.name}.`,'VOLUME_REQUIRED');addRequirement(i.product_id,ml);subtotal+=p.sale_mode==='VOLUME_L'?Math.round(Number(i.unit_price_cents||p.price_cents||0)*ml/1000):Math.round(Number(i.unit_price_cents||p.price_cents||0)*ml);
        }else{
          const qty=Math.max(1,Math.round(Number(i.quantity||1)));
          addRequirement(i.product_id,qty);
          subtotal+=Number(i.unit_price_cents||p.price_cents||0)*qty;
        }
      }
    }
    // Conferência integral antes de alterar qualquer estoque.
    for(const [pid,qty] of requirements){const p=db.prepare("SELECT stock,name,COALESCE(sale_mode,'UNIT') sale_mode FROM products WHERE id=?").get(pid);if(!p||p.stock<qty)fail(`Estoque insuficiente para ${p?.name||'produto'}. Necessário: ${p?.sale_mode==='WEIGHT'?gramsLabel(qty):qty}, disponível: ${p?.sale_mode==='WEIGHT'?gramsLabel(p.stock):p?.stock||0}`,'STOCK')}
    for(const [pid,qty] of unitRequirements){const p=db.prepare("SELECT name,COALESCE(unit_stock,0) unit_stock FROM products WHERE id=?").get(pid);if(!p||Number(p.unit_stock||0)<qty)fail(`Estoque unitário insuficiente para ${p?.name||'produto'}. Necessário: ${qty} un., disponível: ${Number(p?.unit_stock||0)} un.`,'UNIT_STOCK')}
    // Garante compatibilidade com bancos antigos antes de inserir a venda.
    if(!columnNames('sales').includes('customer_name')) addColumn('sales','customer_name',"TEXT DEFAULT ''");
    if(!columnNames('sales').includes('customer_document')) addColumn('sales','customer_document',"TEXT DEFAULT ''");
    if(!columnNames('sales').includes('customer_id')) addColumn('sales','customer_id','INTEGER');
    if(!columnNames('sales').includes('amount_paid_cents')) addColumn('sales','amount_paid_cents','INTEGER NOT NULL DEFAULT 0');
    if(!columnNames('sales').includes('due_cents')) addColumn('sales','due_cents','INTEGER NOT NULL DEFAULT 0');
    if(!columnNames('sales').includes('change_cents')) addColumn('sales','change_cents','INTEGER NOT NULL DEFAULT 0'); addColumn('sales','delivery_cents','INTEGER NOT NULL DEFAULT 0'); addColumn('sales','delivery_required','INTEGER NOT NULL DEFAULT 0'); addColumn('sales','delivery_method',"TEXT DEFAULT ''"); addColumn('sales','discount_cents','INTEGER NOT NULL DEFAULT 0'); addColumn('sales','discount_percent','REAL NOT NULL DEFAULT 0');if(!columnNames('sales').includes('quote_id')) addColumn('sales','quote_id','INTEGER');
    const payments=Array.isArray(sale.payments)?sale.payments:[];
    let paidOriginal=0, totalFees=0, paidFinal=0;
    for(const p of payments){
      if(!p.method||Number(p.original_cents||0)<=0)continue;
      const original=Number(p.original_cents||0); const fee=Math.round(original*Number(p.fee_percent||0)/100); const final=original+fee;
      paidOriginal+=original; totalFees+=fee; paidFinal+=final;
    }
    const discountPercent=Math.min(100,Math.max(0,Number(sale.discount_percent||0)));const discountCents=Math.min(subtotal,Math.round(subtotal*discountPercent/100));const delivery=Math.max(0,Number(sale.delivery_cents||0)); const total=subtotal-discountCents+delivery; const suppliedChange=Math.max(0,Number(sale.change_cents||0));const cashPayments=payments.filter(p=>p.method==='Dinheiro'&&Number(p.original_cents||0)>0);const hasCash=cashPayments.length>0;if(paidOriginal>total+suppliedChange&&!hasCash)fail('Para receber um valor maior que a venda e devolver troco, use Dinheiro.','PAYMENT');if(suppliedChange>0&&!(cashPayments.length===1&&payments.filter(p=>Number(p.original_cents||0)>0).length===1))fail('O troco só pode ser usado em uma venda paga integralmente em Dinheiro.','PAYMENT');if(suppliedChange>0&&Math.abs((cashPayments[0]?.original_cents||0)-total-suppliedChange)>0)fail('Valor de troco inválido.','PAYMENT');
    const finalTotal=total+totalFees;
    const receivedForSale=Math.max(0,paidFinal-suppliedChange);
    const due=Math.max(0,finalTotal-receivedForSale);if(due>0&&!sale.customer_id)fail('Cliente obrigatório para venda a prazo','CUSTOMER_REQUIRED');
    const customer=sale.customer_id?db.prepare('SELECT * FROM customers WHERE id=?').get(sale.customer_id):null;if(sale.customer_id&&!customer)fail('Cliente não encontrado','NOT_FOUND');
    const deliveryRequired=Number(sale.delivery_required||0)===1?1:0;const deliveryMethod=deliveryRequired&&['APP','LOJA'].includes(String(sale.delivery_method||'').toUpperCase())?String(sale.delivery_method).toUpperCase():'';if(deliveryRequired&&!customer)fail('Selecione um cliente para uma venda marcada para entrega.','DELIVERY_CUSTOMER_REQUIRED');
    const paymentLabel=payments.map(p=>p.method+(p.method==='Cartão de crédito'&&p.installments>1?` ${p.installments}x`:'' )).join(' + ')||'A prazo';
    const saleId=db.prepare(
  'INSERT INTO sales(sold_at,total_cents,payment,operator,customer_name,customer_document,customer_id,amount_paid_cents,due_cents,change_cents,delivery_cents,delivery_required,delivery_method,discount_cents,discount_percent,payment_json,cash_register_id,quote_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
).run(
  now(),
  finalTotal,
  paymentLabel,
  sale.operator||'Caixa',
  customer?.name||sale.customer_name||'',
  (customer?.person_type==='PJ'?customer?.cnpj:customer?.cpf)||sale.customer_document||'',
  sale.customer_id||null,
  receivedForSale,
  due,
  sale.change_cents||0,
  delivery,
  deliveryRequired,
  deliveryMethod,
  discountCents,
  discountPercent,
  JSON.stringify(payments),
  openCash?.id||null,
  sourceQuote?.id||null
).lastInsertRowid;
    const mixSaleIns=db.prepare('INSERT INTO sale_mix_items(sale_item_id,product_id,product_name,quantity,weight_grams) VALUES(?,?,?,?,?)');
    for(const i of sale.items){
      let mode='UNIT',qty=Math.max(1,Math.round(Number(i.quantity||1))),grams=0,volumeMl=0,unitCount=0,linkedUnitProductId=null,unitPrice=Number(i.unit_price_cents||0),itemTotal=unitPrice*qty,mixItems=[];
      if(i.kit_id){
        const kit=db.prepare('SELECT * FROM kits WHERE id=?').get(Number(i.kit_id));
        if(String(kit?.kit_type||'STANDARD')==='MIX_WEIGHT'){
          mode='MIX_WEIGHT';
          grams=Math.round(Number(i.weight_grams||0));
          mixItems=(Array.isArray(i.mix_items)?i.mix_items:[]).map(x=>({product_id:Number(x.product_id),quantity:Math.max(0,Math.round(Number(x.quantity||0))),weight_grams:Math.max(0,Math.round(Number(x.weight_grams||0)))})).filter(x=>x.product_id&&x.quantity>0);
          grams=mixItems.reduce((sum,x)=>sum+x.weight_grams,0);
          unitCount=mixItems.reduce((sum,x)=>sum+x.quantity,0);
          qty=1;
          unitPrice=Number(kit?.price_cents||unitPrice);
          itemTotal=Math.round(unitPrice*grams/1000);
        }
      }else if(i.product_id){
        const pp=db.prepare("SELECT COALESCE(sale_mode,'UNIT') sale_mode,price_cents,linked_unit_product_id FROM products WHERE id=?").get(i.product_id);
        mode=String(pp?.sale_mode||'UNIT');
        if(mode==='WEIGHT'){
          grams=Math.round(Number(i.weight_grams||0));
          unitCount=Math.max(0,Math.round(Number(i.unit_count||0)));
          linkedUnitProductId=pp?.linked_unit_product_id?Number(pp.linked_unit_product_id):null;
          qty=1;
          unitPrice=Number(i.unit_price_cents||pp?.price_cents||unitPrice);
          itemTotal=Math.round(unitPrice*grams/1000);
        }else if(['VOLUME_L','VOLUME_ML'].includes(mode)){
          volumeMl=Math.max(0,Math.round(Number(i.volume_ml||0)));qty=1;unitPrice=Number(i.unit_price_cents||pp?.price_cents||unitPrice);itemTotal=mode==='VOLUME_L'?Math.round(unitPrice*volumeMl/1000):Math.round(unitPrice*volumeMl);
        }
      }
      const si=db.prepare('INSERT INTO sale_items(sale_id,product_id,kit_id,name,quantity,unit_price_cents,total_cents,sale_mode,weight_grams,unit_count,linked_unit_product_id,volume_ml) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)')
        .run(saleId,i.kit_id?null:i.product_id,i.kit_id||null,i.name,qty,unitPrice,itemTotal,mode,grams,unitCount,linkedUnitProductId,volumeMl);
      if(mode==='MIX_WEIGHT')for(const x of mixItems){const p=db.prepare('SELECT name FROM products WHERE id=?').get(x.product_id);mixSaleIns.run(si.lastInsertRowid,x.product_id,p?.name||'',x.quantity,x.weight_grams||0);}
    }
    for(const p of payments){if(!p.original_cents)continue;const fee=Math.round(p.original_cents*Number(p.fee_percent||0)/100);const final=p.final_cents!=null?Number(p.final_cents):p.original_cents+fee;const condition=p.method==='Cartão de crédito'?`Crédito ${p.installments||1}x · taxa ${Number(p.fee_percent||0).toFixed(2)}%`:p.method;db.prepare('INSERT INTO sale_payments(sale_id,customer_id,method,original_cents,fee_percent,fee_cents,final_cents,installments,condition_text,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run(saleId,sale.customer_id||null,p.method,p.original_cents,p.fee_percent||0,fee,final,p.installments||1,condition,now())}
    for(const [pid,qty] of requirements){
      const pp=db.prepare("SELECT name,unit,COALESCE(sale_mode,'UNIT') sale_mode FROM products WHERE id=?").get(pid);
      const movementTime=now();
      db.prepare('UPDATE products SET stock=stock-?,updated_at=? WHERE id=?').run(qty,movementTime,pid);
      db.prepare('INSERT INTO stock_movements(product_id,kind,quantity,reason,created_at,sale_mode) VALUES(?,?,?,?,?,?)').run(pid,'OUT',qty,'Venda #'+saleId,movementTime,pp?.sale_mode||'UNIT');
      const mode=String(pp?.sale_mode||'UNIT');const qtyText=mode==='WEIGHT'?gramsLabel(qty):['VOLUME_L','VOLUME_ML'].includes(mode)?`${(qty/1000).toFixed(3)} L`:`${qty} ${pp?.unit||'un'}`;
      activity(sale.operator||'Caixa','Saída de estoque por venda','stock',pid,`${pp?.name||'Produto'} · ${qtyText} · Venda #${saleId}`,0,'stock');
    }
    for(const [pid,qty] of unitRequirements){
      const pp=db.prepare("SELECT name FROM products WHERE id=?").get(pid),movementTime=now();
      db.prepare('UPDATE products SET unit_stock=unit_stock-?,updated_at=? WHERE id=?').run(qty,movementTime,pid);
      db.prepare('INSERT INTO unit_stock_movements(product_id,kind,quantity,reason,sale_id,created_at) VALUES(?,?,?,?,?,?)').run(pid,'OUT',qty,'Venda #'+saleId,saleId,movementTime);
      activity(sale.operator||'Caixa','Saída de estoque unitário por venda','stock',pid,`${pp?.name||'Produto'} · ${qty} un. · Venda #${saleId}`,0,'stock');
    }
    if(customer&&due>0)db.prepare('UPDATE customers SET balance_cents=balance_cents+?,updated_at=? WHERE id=?').run(due,now(),customer.id);
    if(customer&&due>0&&sale.receipt_schedule?.scheduled_at){const rs=sale.receipt_schedule;db.prepare('INSERT INTO appointments(type,customer_id,customer_name,title,scheduled_at,alert_at,amount_cents,status,attendance,sale_id,notes,alerted,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run('RECEBIMENTO',customer.id,customer.name,'Recebimento da venda #'+saleId,String(rs.scheduled_at),rs.alert_at?String(rs.alert_at):null,due,'PENDENTE','',saleId,String(rs.notes||''),0,now())}
if(sourceQuote){
  const changed=db.prepare(
    "UPDATE quotes SET status='CONVERTIDO' WHERE id=? AND status='ABERTO'"
  ).run(sourceQuote.id);

  if(changed.changes!==1)
    fail(
      `Não foi possível converter o orçamento #${sourceQuote.number}.`,
      'QUOTE_CONVERT_FAILED'
    );
}
    activity(sale.operator||'Caixa','Registrou venda','sale',saleId,`Total ${pdfMoney(finalTotal)} · ${deliveryRequired?'Entrega ao cliente':'Retirada na loja'}`,finalTotal,'sales');
    return ok(saleId);
  })();
    if(result?.ok){
      const committed=db.prepare('SELECT amount_paid_cents,operator FROM sales WHERE id=?').get(Number(result.data));
      if(committed&&Number(committed.amount_paid_cents||0)>0&&settingValue('cash_drawer_auto_enabled','1')!=='0'){
        try{triggerCashDrawer('AUTO',committed.operator||sale?.operator||'Caixa',Number(result.data));}catch(e){activity(committed.operator||'Caixa','Falha no acionamento automático da gaveta','cash_drawer',Number(result.data),String(e?.message||e),0,'cash');}
      }
    }
    return result;
  });
  ipcMain.handle('fiscal:list',()=>ok(db.prepare(`SELECT fd.*,s.sold_at,s.payment FROM fiscal_documents fd LEFT JOIN sales s ON s.id=fd.sale_id ORDER BY fd.issued_at DESC`).all()));
  ipcMain.handle('fiscal:pending-sales',()=>ok(db.prepare("SELECT s.*,GROUP_CONCAT(si.name||CASE WHEN COALESCE(si.sale_mode,'UNIT') IN ('WEIGHT','MIX_WEIGHT') THEN ' '||printf('%.3f',COALESCE(si.weight_grams,0)/1000.0)||' kg'||CASE WHEN COALESCE(si.unit_count,0)>0 THEN ' · '||si.unit_count||' un.' ELSE '' END ELSE ' x'||si.quantity END, ', ') items FROM sales s LEFT JOIN sale_items si ON si.sale_id=s.id LEFT JOIN fiscal_documents fd ON fd.sale_id=s.id WHERE fd.id IS NULL AND COALESCE(s.status,'CONCLUIDA')<>'CANCELADA' GROUP BY s.id ORDER BY s.sold_at DESC LIMIT 100").all()));
  ipcMain.handle('fiscal:settings',()=>{const s=Object.fromEntries(db.prepare('SELECT key,value FROM settings').all().map(x=>[x.key,x.value]));delete s.fiscal_cert_password_enc;return ok(s)});
  ipcMain.handle('fiscal:save-settings',(_,s)=>{const allowed=['fiscal_series','fiscal_next_number','fiscal_environment','company_cnpj','company_ie','company_legal_name','company_fantasy_name','company_address','company_city_code','company_crt','fiscal_csc_id','fiscal_csc_token','fiscal_cert_path','fiscal_qrcode_version','fiscal_contingency_enabled'];const q=db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');db.transaction(()=>{for(const k of allowed)if(s[k]!==undefined)q.run(k,String(s[k]??''));if(s.fiscal_cert_password){if(!safeStorage.isEncryptionAvailable())fail('O Windows não disponibilizou armazenamento seguro para a senha do certificado.','CERT_STORE');q.run('fiscal_cert_password_enc',safeStorage.encryptString(String(s.fiscal_cert_password)).toString('base64'));}})();return ok(true)});
  ipcMain.handle('fiscal:choose-certificate',async()=>{const picked=await dialog.showOpenDialog({title:'Selecionar certificado digital A1',filters:[{name:'Certificado A1',extensions:['pfx','p12']},{name:'Todos os arquivos',extensions:['*']}],properties:['openFile']});return ok(picked.canceled?false:picked.filePaths[0]||false)});
  function fiscalSettings(){const s=Object.fromEntries(db.prepare('SELECT key,value FROM settings').all().map(x=>[x.key,x.value]));if(s.fiscal_cert_password_enc){try{s.__certPassword=safeStorage.decryptString(Buffer.from(s.fiscal_cert_password_enc,'base64'))}catch{throw Object.assign(new Error('Não foi possível desbloquear a senha do certificado neste Windows.'),{code:'CERT_STORE'})}}return s;}
  ipcMain.handle('fiscal:certificate-info',(_,input)=>{const s=fiscalSettings();if(input&&typeof input==='object'){if(input.path)s.fiscal_cert_path=input.path;if(input.password!==undefined&&input.password!=='')s.__certPassword=String(input.password)}else if(input!==undefined)s.__certPassword=String(input);return ok(nfce.certificateInfo(s))});
  ipcMain.handle('fiscal:test-status',async()=>{const s=fiscalSettings();if(!s.fiscal_cert_path)fail('Configure o certificado A1 antes do teste.','CERT_MISSING');return ok(await nfce.status(s))});
  ipcMain.handle('fiscal:issue',async(_,saleId)=>{
    const serviceItem=db.prepare("SELECT 1 FROM sale_items si LEFT JOIN products p ON p.id=si.product_id WHERE si.sale_id=? AND (COALESCE(p.item_type,'PRODUCT')='SERVICE' OR EXISTS (SELECT 1 FROM kit_items ki JOIN products pk ON pk.id=ki.product_id WHERE ki.kit_id=si.kit_id AND COALESCE(pk.item_type,'PRODUCT')='SERVICE')) LIMIT 1").get(Number(saleId));if(serviceItem)fail('A NFC-e não é aplicável a serviços. Para serviços ou vendas mistas, é necessária a emissão fiscal adequada (como NFS-e) fora deste emissor.','SERVICE_FISCAL');
    const s=fiscalSettings();const sale=db.prepare('SELECT * FROM sales WHERE id=?').get(saleId);if(!sale)fail('Venda não encontrada','NOT_FOUND');if(String(sale.status||'CONCLUIDA')==='CANCELADA')fail('Não é possível emitir NFC-e para uma venda cancelada.','SALE_CANCELED');if(db.prepare('SELECT id FROM fiscal_documents WHERE sale_id=?').get(saleId))fail('A venda já possui documento fiscal','DUPLICATE');
    if(!s.company_cnpj||!s.company_ie)fail('Preencha CNPJ e Inscrição Estadual na configuração fiscal.','FISCAL_CONFIG');if(!s.fiscal_csc_id||!s.fiscal_csc_token)fail('Preencha o ID e o CSC fornecidos pela SEFAZ-SP.','CSC_MISSING');if(!s.fiscal_cert_path)fail('Selecione o certificado digital A1.','CERT_MISSING');
    const number=Number(s.fiscal_next_number||1),series=String(s.fiscal_series||'1'),env=s.fiscal_environment==='producao'?'producao':'homologacao';const items=db.prepare(`SELECT si.*,p.sku,p.unit,p.ncm,p.cfop,p.cst_csosn,p.origin FROM sale_items si LEFT JOIN products p ON p.id=si.product_id WHERE si.sale_id=?`).all(saleId).map(i=>{const weighted=['WEIGHT','MIX_WEIGHT'].includes(String(i.sale_mode||'UNIT'));return {...i,quantity:weighted?Number(i.weight_grams||0)/1000:Number(i.quantity||1),product:{sku:i.sku,unit:weighted?'KG':i.unit,ncm:i.ncm,cfop:i.cfop,cst_csosn:i.cst_csosn,origin:i.origin}}});
    const cNF=String(Math.floor(Math.random()*90000000)+10000000);let doc=nfce.buildNfce({settings:s,sale,items,number,series,tpEmis:1,cNF,environment:env});const cert=nfce.loadPfx(s.fiscal_cert_path,s.__certPassword||'');doc.signedXml=nfce.signXml(doc.xml,'NFe'+doc.key,cert);const qr=nfce.addQrCode(doc.signedXml,{...doc,customer_document:sale.customer_document},s);doc.signedXml=qr.xml;doc.qrUrl=qr.url;doc.digVal=qr.digVal;doc.protocol='';doc.paymentLabel=sale.payment;
    const fiscalRoot=path.join(app.getPath('userData'),'fiscal','NFC-e',env,new Date(sale.sold_at).getFullYear().toString(),String(new Date(sale.sold_at).getMonth()+1).padStart(2,'0'));fs.mkdirSync(fiscalRoot,{recursive:true});const xmlPath=path.join(fiscalRoot,`${doc.key}-procNFe.xml`);fs.writeFileSync(xmlPath,doc.signedXml,'utf8');
    const docId=db.prepare('INSERT INTO fiscal_documents(sale_id,number,series,model,status,issued_at,access_key,customer_name,customer_document,total_cents,xml,environment,tp_emis,qr_url,xml_path) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(saleId,number,series,'65','TRANSMITINDO',now(),doc.key,sale.customer_name||'',sale.customer_document||'',sale.total_cents,doc.signedXml,env,1,doc.qrUrl,xmlPath).lastInsertRowid;
    db.prepare("INSERT INTO settings(key,value) VALUES('fiscal_next_number',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(String(number+1));
    const fi=db.prepare('INSERT INTO fiscal_items(document_id,product_id,name,quantity,unit_price_cents,total_cents,ncm,cfop,cst) VALUES(?,?,?,?,?,?,?,?,?)');for(const i of items){const p=i.product||{};fi.run(docId,i.product_id||null,i.name,i.quantity,i.unit_price_cents,i.total_cents,p.ncm||'',p.cfop||'5102',p.cst_csosn||'102');}
    try{const response=await nfce.authorize(doc,s,cert);const authorized=response.cStat==='100';const status=authorized?'AUTORIZADA':(response.cStat==='103'?'LOTE_RECEBIDO':`REJEITADA_${response.cStat||'SEM_STATUS'}`);let finalXml=doc.signedXml;if(authorized){doc.protocol=response.nProt;const nfeBody=doc.signedXml.replace(/^<\?xml[^>]*\?>/,'');finalXml=`<?xml version="1.0" encoding="UTF-8"?><nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">${nfeBody}<protNFe versao="4.00"><infProt><tpAmb>${env==='producao'?'1':'2'}</tpAmb><verAplic>SEFAZ-SP</verAplic><chNFe>${response.chNFe||doc.key}</chNFe><dhRecbto>${response.dhRecbto||now()}</dhRecbto><nProt>${response.nProt||''}</nProt><digVal>${response.digVal||doc.digVal||''}</digVal><cStat>${response.cStat}</cStat><xMotivo>${response.xMotivo||''}</xMotivo></infProt></protNFe></nfeProc>`;fs.writeFileSync(xmlPath,finalXml,'utf8');}db.prepare('UPDATE fiscal_documents SET status=?,protocol=?,response_xml=?,xml=?,xml_path=? WHERE id=?').run(status,response.nProt||'',response.raw||'',finalXml,xmlPath,docId);return ok({docId,number,series,status,key:doc.key,protocol:response.nProt||'',reason:response.xMotivo||'',xmlPath,qrUrl:doc.qrUrl});}catch(e){db.prepare('UPDATE fiscal_documents SET status=?,response_xml=? WHERE id=?').run('ERRO_COMUNICACAO',String(e.stack||e),docId);throw e;}
  });
  ipcMain.handle('fiscal:cancel',async(_,docId,justification)=>{const s=fiscalSettings();const doc=db.prepare('SELECT * FROM fiscal_documents WHERE id=?').get(docId);if(!doc||doc.status!=='AUTORIZADA')fail('Somente NFC-e autorizada pode ser cancelada.','FISCAL_STATUS');const just=String(justification||'').trim();if(just.length<15)fail('A justificativa do cancelamento deve ter no mínimo 15 caracteres.','VALIDATION');const cert=nfce.loadPfx(s.fiscal_cert_path,s.__certPassword||'');const response=await nfce.eventCancel({...doc,environment:doc.environment,protocol:doc.protocol},s,cert,just);const st=response.cStat==='135'||response.cStat==='155'?'CANCELADA':`CANCELAMENTO_REJEITADO_${response.cStat||'SEM_STATUS'}`;db.prepare('UPDATE fiscal_documents SET status=?,response_xml=? WHERE id=?').run(st,response.raw||'',docId);db.prepare('INSERT INTO fiscal_events(document_id,event_type,sequence,status,protocol,reason,xml,created_at) VALUES(?,?,?,?,?,?,?,?)').run(docId,'110111',1,st,response.nProt||'',response.xMotivo||'',response.raw||'',now());return ok({status:st,protocol:response.nProt||'',reason:response.xMotivo||''})});
  ipcMain.handle('fiscal:transmit-pending',async()=>{const s=fiscalSettings();const docs=db.prepare("SELECT * FROM fiscal_documents WHERE status='CONTINGENCIA_OFFLINE' ORDER BY issued_at").all();const results=[];const cert=nfce.loadPfx(s.fiscal_cert_path,s.__certPassword||'');for(const d of docs){try{const response=await nfce.authorize({environment:d.environment,signedXml:d.xml,key:d.access_key,number:d.number,series:d.series},s,cert);const status=response.cStat==='100'?'AUTORIZADA':`REJEITADA_${response.cStat||'SEM_STATUS'}`;let finalXml=d.xml;if(status==='AUTORIZADA'){const nfeBody=d.xml.replace(/^<\?xml[^>]*\?>/,'');finalXml=`<?xml version="1.0" encoding="UTF-8"?><nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">${nfeBody}<protNFe versao="4.00"><infProt><tpAmb>${d.environment==='producao'?'1':'2'}</tpAmb><verAplic>SEFAZ-SP</verAplic><chNFe>${response.chNFe||d.access_key}</chNFe><dhRecbto>${response.dhRecbto||now()}</dhRecbto><nProt>${response.nProt||''}</nProt><digVal>${response.digVal||''}</digVal><cStat>${response.cStat}</cStat><xMotivo>${response.xMotivo||''}</xMotivo></infProt></protNFe></nfeProc>`;}db.prepare('UPDATE fiscal_documents SET status=?,protocol=?,response_xml=?,xml=? WHERE id=?').run(status,response.nProt||'',response.raw||'',finalXml,d.id);if(d.xml_path)fs.writeFileSync(d.xml_path,finalXml,'utf8');results.push({id:d.id,status,reason:response.xMotivo||''})}catch(e){results.push({id:d.id,status:'ERRO_COMUNICACAO',reason:e.message})}}return ok(results)});
  ipcMain.handle('fiscal:danfe',async(_,docId)=>{
  const doc=db.prepare(`
    SELECT fd.*,s.payment,s.payment_json
    FROM fiscal_documents fd
    LEFT JOIN sales s ON s.id=fd.sale_id
    WHERE fd.id=?
  `).get(docId);

  if(!doc)
    fail(
      'Documento fiscal não encontrado',
      'NOT_FOUND'
    );

  const s=Object.fromEntries(
    db.prepare('SELECT key,value FROM settings')
      .all()
      .map(x=>[x.key,x.value])
  );

  const items=db.prepare(
    'SELECT * FROM fiscal_items WHERE document_id=?'
  ).all(docId);

  const qr=doc.qr_url
    ? await nfce.qrDataUrl(doc.qr_url)
    : '';

  const html=nfce.buildDanfeHtml(
    {
      ...doc,
      items,
      total:doc.total_cents/100,
      environment:doc.environment,
      key:doc.access_key,
      number:doc.number,
      series:doc.series,
      paymentLabel:doc.payment
    },
    qr,
    s
  );

  const pdfWin=new BrowserWindow({
    show:false,
    width:794,
    height:1123,
    webPreferences:{
      sandbox:false,
      contextIsolation:false,
      nodeIntegration:false
    }
  });

  try{

    await pdfWin.webContents.executeJavaScript(`
      document.open();
      document.write(${JSON.stringify(html)});
      document.close();
      true;
    `);

    await new Promise(resolve=>setTimeout(resolve,500));

    const pdf=await pdfWin.webContents.printToPDF({
      printBackground:true,
      preferCSSPageSize:true
    });

    const root=path.join(
      app.getPath('userData'),
      'fiscal',
      'DANFE'
    );

    fs.mkdirSync(root,{recursive:true});

    const out=path.join(
      root,
      `${doc.access_key||'NFCe-'+doc.id}.pdf`
    );

    fs.writeFileSync(out,pdf);

    return ok(out);

  }finally{
    if(!pdfWin.isDestroyed())
      pdfWin.close();
  }
});
  ipcMain.handle('fiscal:contingency',async(_,saleId,reason)=>{if(db.prepare("SELECT 1 FROM sale_items si LEFT JOIN products p ON p.id=si.product_id WHERE si.sale_id=? AND (COALESCE(p.item_type,'PRODUCT')='SERVICE' OR EXISTS (SELECT 1 FROM kit_items ki JOIN products pk ON pk.id=ki.product_id WHERE ki.kit_id=si.kit_id AND COALESCE(pk.item_type,'PRODUCT')='SERVICE')) LIMIT 1").get(Number(saleId)))fail('A NFC-e em contingência não pode ser utilizada para serviços.','SERVICE_FISCAL');const s=fiscalSettings();if(!s.fiscal_csc_id||!s.fiscal_csc_token)fail('Configure o CSC para gerar o QR Code da contingência.','CSC_MISSING');if(!s.fiscal_cert_path)fail('Configure o certificado A1 para emitir em contingência.','CERT_MISSING');const sale=db.prepare('SELECT * FROM sales WHERE id=?').get(saleId);if(!sale)fail('Venda não encontrada','NOT_FOUND');if(String(sale.status||'CONCLUIDA')==='CANCELADA')fail('Não é possível emitir NFC-e para uma venda cancelada.','SALE_CANCELED');const number=Number(s.fiscal_next_number||1),series=String(s.fiscal_series||'1'),env=s.fiscal_environment==='producao'?'producao':'homologacao';const items=db.prepare(`SELECT si.*,p.sku,p.unit,p.ncm,p.cfop,p.cst_csosn,p.origin FROM sale_items si LEFT JOIN products p ON p.id=si.product_id WHERE si.sale_id=?`).all(saleId).map(i=>{const weighted=['WEIGHT','MIX_WEIGHT'].includes(String(i.sale_mode||'UNIT'));return {...i,quantity:weighted?Number(i.weight_grams||0)/1000:Number(i.quantity||1),product:{sku:i.sku,unit:weighted?'KG':i.unit,ncm:i.ncm,cfop:i.cfop,cst_csosn:i.cst_csosn,origin:i.origin}}});const cNF=String(Math.floor(Math.random()*90000000)+10000000);let doc=nfce.buildNfce({settings:s,sale,items,number,series,tpEmis:9,cNF,environment:env,contingencyReason:String(reason||'Indisponibilidade técnica do ambiente autorizador')});const cert=nfce.loadPfx(s.fiscal_cert_path,s.__certPassword||'');doc.signedXml=nfce.signXml(doc.xml,'NFe'+doc.key,cert);const qr=nfce.addQrCode(doc.signedXml,{...doc,customer_document:sale.customer_document},s);doc.signedXml=qr.xml;const root=path.join(app.getPath('userData'),'fiscal','NFC-e',env,'contingencia');fs.mkdirSync(root,{recursive:true});const xmlPath=path.join(root,`${doc.key}-offline.xml`);fs.writeFileSync(xmlPath,doc.signedXml,'utf8');const docId=db.prepare('INSERT INTO fiscal_documents(sale_id,number,series,model,status,issued_at,access_key,customer_name,customer_document,total_cents,xml,environment,tp_emis,qr_url,xml_path) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(saleId,number,series,'65','CONTINGENCIA_OFFLINE',now(),doc.key,sale.customer_name||'',sale.customer_document||'',sale.total_cents,doc.signedXml,env,9,qr.url,xmlPath).lastInsertRowid;const fi=db.prepare('INSERT INTO fiscal_items(document_id,product_id,name,quantity,unit_price_cents,total_cents,ncm,cfop,cst) VALUES(?,?,?,?,?,?,?,?,?)');for(const i of items){const p=i.product||{};fi.run(docId,i.product_id||null,i.name,i.quantity,i.unit_price_cents,i.total_cents,p.ncm||'',p.cfop||'5102',p.cst_csosn||'102');}db.prepare("INSERT INTO settings(key,value) VALUES('fiscal_next_number',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(String(number+1));return ok({docId,key:doc.key,xmlPath,status:'CONTINGENCIA_OFFLINE',reason:String(reason||'Indisponibilidade técnica')})});
  ipcMain.handle('sales:print',async(_,id)=>{
    const sale=db.prepare('SELECT * FROM sales WHERE id=?').get(Number(id)); if(!sale)fail('Venda não encontrada.','NOT_FOUND');
    const items=db.prepare('SELECT * FROM sale_items WHERE sale_id=? ORDER BY id').all(Number(id)).map(i=>({...i,mix_items:String(i.sale_mode||'UNIT')==='MIX_WEIGHT'?db.prepare('SELECT product_name name,quantity,weight_grams FROM sale_mix_items WHERE sale_item_id=? ORDER BY id').all(i.id):[]}));
    const payments=db.prepare('SELECT * FROM sale_payments WHERE sale_id=? ORDER BY id').all(Number(id));
    const settings=Object.fromEntries(db.prepare('SELECT key,value FROM settings').all().map(x=>[x.key,x.value]));
    const money=c=>(Number(c||0)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
    const rows=items.map(i=>{const weighted=['WEIGHT','MIX_WEIGHT'].includes(String(i.sale_mode||'UNIT'));const detail=weighted?`${weightedQtyLabel(i.weight_grams,i.unit_count)} x ${money(i.unit_price_cents)}/kg`:`${i.quantity} x ${money(i.unit_price_cents)}`;const mix=String(i.sale_mode||'UNIT')==='MIX_WEIGHT'&&i.mix_items?.length?`<br><small>${i.mix_items.map(x=>`${x.quantity} ${xmlEsc(x.name)} · ${gramsLabel(x.weight_grams||0)}`).join(' · ')}</small>`:'';return `<tr><td>${xmlEsc(i.name)}<br><small>${detail}</small>${mix}</td><td>${money(i.total_cents)}</td></tr>`}).join('');
    const pays=payments.map(x=>`<div class="pay"><span>${xmlEsc(x.method)}</span><b>${money(x.final_cents)}</b></div>`).join('');
    const html=`<!doctype html><html><head><meta charset="utf-8"><style>@page{size:80mm auto;margin:3mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#000;width:72mm;font-size:11px;margin:0}.center{text-align:center}.line{border-top:1px dashed #000;margin:7px 0}.title{font-size:16px;font-weight:700}.store{font-size:14px;font-weight:700}table{width:100%;border-collapse:collapse}td{padding:3px 0;vertical-align:top}td:last-child{text-align:right;white-space:nowrap}.totals div,.pay{display:flex;justify-content:space-between;padding:2px 0}.total{font-size:15px;font-weight:700}.foot{text-align:center;margin-top:9px;font-size:9px}</style></head><body><div class="center store">${xmlEsc(settings.store_name||'Minha Loja')}</div><div class="center title">CUPOM DE VENDA</div><div class="center">Venda #${sale.id}</div><div class="line"></div><table>${rows}</table><div class="line"></div><div class="totals"><div><span>Subtotal</span><b>${money(items.reduce((a,x)=>a+x.total_cents,0))}</b></div>${Number(sale.discount_cents||0)>0?`<div><span>Desconto</span><b>- ${money(sale.discount_cents)}</b></div>`:''}${Number(sale.delivery_cents||0)>0?`<div><span>Entrega</span><b>+ ${money(sale.delivery_cents)}</b></div>`:''}<div class="total"><span>TOTAL</span><b>${money(sale.total_cents)}</b></div><div><span>Valor pago</span><b>${money(sale.amount_paid_cents)}</b></div><div><span>Troco</span><b>${money(sale.change_cents)}</b></div></div><div class="line"></div>${pays}<div class="line"></div><div>Data: ${new Date(sale.sold_at).toLocaleDateString('pt-BR')} ${new Date(sale.sold_at).toLocaleTimeString('pt-BR')}</div><div>Operador: ${xmlEsc(sale.operator||'Caixa')}</div>${sale.customer_name?`<div>Cliente: ${xmlEsc(sale.customer_name)}</div>`:''}<div>Destino: ${Number(sale.delivery_required||0)===1?'Entrega ao cliente':'Retirada na loja'}</div><div class="foot">Obrigado pela preferência!</div></body></html>`;
    const win=new BrowserWindow({show:false,width:420,height:900,webPreferences:{sandbox:true}});
    try{await win.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(html));await new Promise((resolve,reject)=>win.webContents.print({silent:false,printBackground:true},(success,reason)=>success?resolve():reject(new Error(reason||'Não foi possível imprimir o cupom.'))));}finally{if(!win.isDestroyed())win.close();}return ok(true);
  });
  ipcMain.handle('internet:search',async(_,query)=>{
    const q=String(query||'').trim(); if(!q)fail('Informe o que deseja pesquisar.','VALIDATION');
    const decodeHtml=x=>String(x||'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&#x27;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n))).replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCharCode(parseInt(n,16)));
    const clean=x=>decodeHtml(String(x||'').replace(/<script[\s\S]*?<\/script>/gi,'').replace(/<style[\s\S]*?<\/style>/gi,'').replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim();
    const request=url=>new Promise((resolve,reject)=>{const req=net.request({method:'GET',url,headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/136 Safari/537.36','Accept-Language':'pt-BR,pt;q=0.9,en;q=0.8','Accept':'text/html,application/xhtml+xml'}});let body='';req.on('response',res=>{res.on('data',c=>body+=c.toString('utf8'));res.on('end',()=>resolve(body))});req.on('error',reject);req.end()});
    const parseDDG=body=>{const out=[];const re=/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;let m;while((m=re.exec(body))&&out.length<10){if(!/result__a/i.test(m[0]))continue;let url=m[1];try{url=decodeURIComponent(url)}catch{}if(url.startsWith('//'))url='https:'+url;if(!/^https?:\/\//i.test(url))continue;const title=clean(m[2]);if(title&&!out.some(x=>x.url===url))out.push({title,url})}return out};
    const parseBing=body=>{const out=[];const re=/<li[^>]+class=["'][^"']*b_algo[^"']*["'][\s\S]*?<h2[^>]*><a[^>]+href=["'](https?:\/\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;let m;while((m=re.exec(body))&&out.length<10){const url=m[1],title=clean(m[2]);if(title&&!out.some(x=>x.url===url))out.push({title,url})}return out};
    const parseGoogle=body=>{const out=[];const re=/<a\b[^>]*href=[\"'](https?:\/\/[^\"']+)[\"'][^>]*>([\s\S]*?)<\/a>/gi;let m;while((m=re.exec(body))&&out.length<10){const url=m[1];if(/(^|\.)google\./i.test(new URL(url).hostname))continue;const title=clean(m[2]);if(title&&!out.some(x=>x.url===url))out.push({title,url})}return out};
    try{let body=await request('https://html.duckduckgo.com/html/?kl=br-pt&kp=-2&q='+encodeURIComponent(q));let out=parseDDG(body);if(!out.length){body=await request('https://www.bing.com/search?setlang=pt-BR&cc=br&q='+encodeURIComponent(q));out=parseBing(body)}if(!out.length){body=await request('https://www.google.com/search?hl=pt-BR&num=10&q='+encodeURIComponent(q));out=parseGoogle(body)}return ok(out)}catch(e){throw new Error('Não foi possível realizar a pesquisa na internet. Verifique a conexão do computador. '+(e?.message||''))}
  });
  ipcMain.handle('backup:verify-latest',()=>{
    const latest=db.prepare("SELECT value FROM settings WHERE key='last_backup_path'").get()?.value||'';
    if(!latest||!fs.existsSync(latest))fail('Nenhum backup local disponível para verificação.','BACKUP_NOT_FOUND');
    const manifestPath=backupManifestPath(latest);
    if(!fs.existsSync(manifestPath))fail('O backup não possui o manifesto de identificação exigido.','BACKUP_IDENTITY_INVALID');
    let manifest;
    try{manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));}catch{fail('Manifesto do backup inválido.','BACKUP_IDENTITY_INVALID')}
    if(manifest?.appId!==STORE_ID)fail('Este backup pertence a outra instalação.','BACKUP_WRONG_STORE');
    let checkDb;
    try{
      checkDb=new Database(latest,{readonly:true,fileMustExist:true});
      if(String(checkDb.pragma('quick_check',{simple:true})).toLowerCase()!=='ok')fail('Falha na verificação de integridade do SQLite.','BACKUP_INVALID');
      const identity=String(checkDb.prepare("SELECT value FROM settings WHERE key='backup_store_id'").get()?.value||'');
      if(identity!==STORE_ID)fail('Identidade interna do backup não corresponde ao Uni-PDV.','BACKUP_WRONG_STORE');
      return ok({path:latest,verified:true});
    }catch(error){if(error?.code)throw error;fail('Não foi possível validar o último backup: '+(error?.message||String(error)),'BACKUP_INVALID')}
    finally{try{checkDb?.close()}catch{}}
  });
  ipcMain.handle('backup:create',async()=>ok(await createStoreBackup()));
  ipcMain.handle('backup:schedule',(_,cfg)=>{const enabled=String(cfg?.enabled)==='1'?'1':'0';const frequency=['daily','weekly','monthly'].includes(cfg?.frequency)?cfg.frequency:'daily';const time=/^([01]\d|2[0-3]):[0-5]\d$/.test(String(cfg?.time||''))?String(cfg.time):'23:00';const dow=Math.min(6,Math.max(0,Number(cfg?.day_of_week ?? 1)));const dom=Math.min(31,Math.max(1,Number(cfg?.day_of_month ?? 1)));for(const [k,v] of Object.entries({backup_schedule_enabled:enabled,backup_frequency:frequency,backup_time:time,backup_day_of_week:String(dow),backup_day_of_month:String(dom),backup_retention_count:String(Math.max(5,Math.min(365,Math.round(Number(cfg?.keep_auto||30))||30)))}))db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(k,String(v));return ok(true)});
  ipcMain.handle('backup:restore',async()=>{
    const picked=await dialog.showOpenDialog({title:'Selecionar backup do Uni-PDV',defaultPath:backupDirectory(),filters:[{name:'Banco SQLite',extensions:['db']},{name:'Todos os arquivos',extensions:['*']}],properties:['openFile']});
    if(picked.canceled||!picked.filePaths[0])return ok(false);
    const source=picked.filePaths[0];
    const target=path.join(app.getPath('userData'),DB_FILE);
    if(path.resolve(source).toLowerCase()===path.resolve(target).toLowerCase())fail('O arquivo selecionado já é o banco em uso. Escolha um arquivo de backup.','VALIDATION');

    // Bloqueia restauração cruzada quando o backup tem identidade conhecida.
    const manifestFile=backupManifestPath(source);
    let manifest=null;
    if(fs.existsSync(manifestFile)){
      try{manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'));}catch{fail('O manifesto deste backup está inválido. A restauração foi cancelada.','BACKUP_IDENTITY_INVALID')}
      if(manifest?.appId!==STORE_ID)fail(`Este backup pertence a outra instalação ( ${manifest?.appName||manifest?.appId||'origem desconhecida'} ). Ele não pode ser restaurado em ${APP_NAME}.`,'BACKUP_WRONG_STORE');
    }

    // Valida o backup antes de tocar no banco atual.
    let checkDb=null;
    try{
      checkDb=new Database(source,{readonly:true,fileMustExist:true});
      const check=String(checkDb.pragma('quick_check',{simple:true})||'').toLowerCase();
      if(check!=='ok')fail('O arquivo selecionado não passou na verificação de integridade do SQLite. A restauração foi cancelada.','BACKUP_INVALID');
      const identityRow=checkDb.prepare("SELECT value FROM settings WHERE key='backup_store_id'").get();
      const embeddedIdentity=String(identityRow?.value||'');
      if(embeddedIdentity && embeddedIdentity!==STORE_ID)fail('Este banco pertence a outra loja. A restauração foi bloqueada para proteger os dados.','BACKUP_WRONG_STORE');
      if(!manifest && !embeddedIdentity){
        const legacyChoice=await dialog.showMessageBox({type:'warning',buttons:['Cancelar','Restaurar mesmo assim'],defaultId:0,cancelId:0,title:'Backup sem identificação da loja',message:'Este backup foi criado por uma versão antiga e não contém identificação da loja.',detail:`Só continue se tiver certeza de que o arquivo pertence à ${APP_NAME}. A restauração substituirá os dados atuais.`});
        if(legacyChoice.response!==1)return ok(false);
      }
    }catch(e){
      if(['BACKUP_INVALID','BACKUP_WRONG_STORE','BACKUP_IDENTITY_INVALID'].includes(e?.code))throw e;
      fail('Não foi possível validar o arquivo de backup. Verifique se ele é um banco SQLite válido.','BACKUP_INVALID');
    }finally{try{checkDb?.close()}catch{}}

    // Cria um ponto de retorno antes da troca.
    const backupDir=backupDirectory();
    fs.mkdirSync(backupDir,{recursive:true});
    const stamp=new Date().toISOString().replace(/[:.]/g,'-');
    const safetyBackup=path.join(backupDir,`pre-restauracao-${stamp}.db`);
    await db.backup(safetyBackup);writeBackupManifest(safetyBackup);

    const removeSidecars=()=>{
      for(const suffix of ['-wal','-shm','-journal']){
        try{const f=target+suffix;if(fs.existsSync(f))fs.rmSync(f,{force:true})}catch{}
      }
    };

    try{
      // Fecha somente o SQLite. O Electron permanece aberto.
      try{db?.close()}catch{}
      db=null;
      removeSidecars();
      fs.copyFileSync(source,target);

      // Reabre e executa as migrações da versão atual, inclusive campos da balança.
      initDb();
      activity('','Restaurou backup','backup',null,source);

      // Recarrega o renderer no mesmo processo; não depende de app.relaunch/spawn.
      setTimeout(()=>{
        for(const w of BrowserWindow.getAllWindows()){
          try{if(!w.isDestroyed())w.webContents.reload()}catch{}
        }
      },800);
      return ok({restored:true,reloaded:true,safety_backup:safetyBackup});
    }catch(e){
      // Se a abertura do banco restaurado falhar, volta automaticamente ao banco anterior.
      try{db?.close()}catch{}
      db=null;
      try{
        removeSidecars();
        fs.copyFileSync(safetyBackup,target);
        initDb();
      }catch(recoveryError){
        throw new Error('A restauração falhou e também não foi possível reabrir automaticamente o banco anterior. Backup de segurança: '+safetyBackup+' — '+(recoveryError?.message||recoveryError));
      }
      fail('A restauração não pôde ser concluída. O banco anterior foi recuperado automaticamente. '+(e?.message||e),'BACKUP_RESTORE_FAILED');
    }
  });
}
async function scheduledBackup(){
  if(!db)return;
  const s=Object.fromEntries(db.prepare('SELECT key,value FROM settings').all().map(x=>[x.key,x.value]));
  if(String(s.backup_schedule_enabled)!=='1')return;
  const d=new Date();
  const periodKey=scheduledBackupPeriod(d,s);
  if(!periodKey || String(s.backup_last_run||'')===periodKey)return;
  await createStoreBackup({automatic:true,periodKey});
}
let appStarted = false;

function startApplication() {
  if (appStarted) return;
  appStarted = true;
  try { initDb(); require('./operator-auth').ensure(db); mobileLink=require('./mobile-server').install({ipcMain,getDb:()=>db,app,BrowserWindow,dialog,clipboard:require('electron').clipboard}); registerIpc(); require('./uni-management').install(db,ipcMain); mobileLink.startIfEnabled(); setInterval(()=>scheduledBackup().catch(error=>{try{settingValue('backup_last_error',`${now()} — ${error?.message||String(error)}`)}catch{}}),30000); scheduledBackup().catch(error=>{try{settingValue('backup_last_error',`${now()} — ${error?.message||String(error)}`)}catch{}}); } catch (e) { const detail=e?.message||String(e); try{fs.mkdirSync(app.getPath('userData'),{recursive:true});fs.writeFileSync(path.join(app.getPath('userData'),'startup-error.log'),detail)}catch{}; dialog.showErrorBox('Jhonnie Beer — erro ao iniciar',detail); app.quit(); return; }
  const isDev=!app.isPackaged&&!process.argv.includes('--production');
  const win=new BrowserWindow({width:1440,height:900,minWidth:1100,minHeight:700,icon:path.join(__dirname,'icon.ico'),backgroundColor:'#0b0d10',webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false}});
  const sendTheme=(theme)=>{db.prepare("INSERT INTO settings(key,value) VALUES('theme',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(theme);win.webContents.send('theme:set',theme)};
  const themeOptions=[
    ['Café','casa'],
    ['Neve','axe'],
    ['Aço','meianoite'],
    ['Rubi','malandro'],
    ['Ametista','pombogira'],
    ['Oceano','marinheiro'],
    ['Céu','eremenino'],
    ['Floresta','caboclo'],
    ['Sol','baiano'],
    ['Âmbar','cigana'],
    ['Terra & Ouro','boiadeiro'],
    ['Vulcão','exu'],
    ['Marfim','pretovelho'],
    ['Rosa','eremenina'],
    ['Carvão & Laranja','cigano'],
    ['Ônix','encruza'],
    ['Multicolorido','rainbow'],
    ['Jhonnie Beer','jhonnie']
  ];
  const savedTheme=String(db.prepare("SELECT value FROM settings WHERE key='theme'").get()?.value||'jhonnie');
  const enterFullScreen=()=>{try{win.setKiosk(false);win.setFullScreenable(true);win.setFullScreen(true);}catch{}};
  const exitFullScreen=()=>{try{win.setKiosk(false);win.setFullScreen(false);win.setMenuBarVisibility(true);win.setAutoHideMenuBar(false);win.focus();}catch{}};
  win.on('enter-full-screen',()=>{try{win.setMenuBarVisibility(false);}catch{}});
  win.on('leave-full-screen',()=>{try{win.setMenuBarVisibility(true);win.setAutoHideMenuBar(false);win.focus();}catch{}});
  const menu=Menu.buildFromTemplate([
    {label:'Arquivo',submenu:[{label:'Bloquear aplicativo',accelerator:'Ctrl+Shift+L',click:()=>win.webContents.send('session:lock')},{type:'separator'},{role:'quit',label:'Fechar'}]},
    {label:'Editar',submenu:[{role:'undo',label:'Desfazer'},{role:'redo',label:'Refazer'},{type:'separator'},{role:'cut',label:'Recortar'},{role:'copy',label:'Copiar'},{role:'paste',label:'Colar'},{role:'selectAll',label:'Selecionar tudo'}]},
    {label:'Exibir',submenu:[{role:'reload',label:'Recarregar'},{type:'separator'},{label:'Tela cheia',click:()=>{if(win.isFullScreen())exitFullScreen();else enterFullScreen()}},{label:'Sair da tela cheia',click:()=>exitFullScreen()}]},
    {label:'Android',submenu:[{label:'Ativar / mostrar conexão segura',click:()=>{try{mobileLink?.configure()}catch(e){dialog.showErrorBox('Android',e.message||String(e))}}},{label:'Revogar todas as sessões móveis',click:()=>{try{mobileLink?.revoke();dialog.showMessageBoxSync({type:'info',message:'Sessões Android revogadas.'})}catch(e){dialog.showErrorBox('Android',e.message||String(e))}}}]},
    {label:'Tema',submenu:themeOptions.map(([label,id])=>({label,type:'radio',checked:id===savedTheme,click:()=>sendTheme(id)}))},
    {label:'Sobre',click:()=>{
      if(win.__uniAbout&&!win.__uniAbout.isDestroyed()){win.__uniAbout.show();win.__uniAbout.focus();return;}
      const art=path.join(__dirname,'uni-softwares-logo-sobre.png');
      const image=fs.existsSync(art)?`data:image/png;base64,${fs.readFileSync(art).toString('base64')}`:'';
      const w=new BrowserWindow({width:520,height:630,resizable:false,modal:true,parent:win,show:false,autoHideMenuBar:true,backgroundColor:'#0b1021',webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}});w.removeMenu();win.__uniAbout=w;w.on('closed',()=>{win.__uniAbout=null});
      const html=`<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8"></head><body style="margin:0;min-height:100vh;box-sizing:border-box;padding:24px 32px;background:linear-gradient(#090c1a,#14172a);color:#f4f5ff;font-family:Segoe UI,Arial;text-align:center"><img alt="Logo Uni Softwares" src="${image}" style="height:235px;width:235px;border-radius:50%;object-fit:contain"><h1 style="margin:10px 0 5px;color:#69dbff">Uni Softwares</h1><p style="margin:0;color:#c7cbed">Por Rudnei Souza</p><hr style="border:0;border-top:1px solid #334366;margin:16px 0"><h2 style="margin:6px 0;font-size:19px;color:#ffd29c">Uni-PDV</h2><p style="margin:4px 0;font-size:16px;font-weight:700;color:#e9bd68">Jhonnie Beer</p><p style="font-size:14px">Sistema de Ponto de Vendas · Versão 3.2.5</p><p style="font-size:12px;color:#b1b7d0">Desenvolvido em 2026</p></body></html>`;
      const aboutUrl='data:text/html;charset=utf-8,'+encodeURIComponent(html);
      w.once('ready-to-show',()=>{if(!w.isDestroyed())w.show()});
      w.loadURL(aboutUrl).then(()=>{if(!w.isDestroyed()){w.show();w.focus()}}).catch(error=>{console.error('[Sobre] Não foi possível abrir janela:',error);if(!w.isDestroyed()){w.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent('<h2 style="font-family:Arial">Uni Softwares</h2><p>Uni-PDV · Versão 3.1</p><p>Por Rudnei Souza</p>')).catch(()=>{});w.show();}});
    }}
  ]);
  Menu.setApplicationMenu(menu);
  win.webContents.setWindowOpenHandler(({url})=>{try{if(/^https?:\/\//i.test(url))shell.openExternal(url)}catch{}return {action:'deny'}});
  win.webContents.on('before-input-event',(_,input)=>{
    if(input.type==='keyDown'&&(input.key==='F11'||input.code==='F11')&&!input.isAutoRepeat){try{_.preventDefault()}catch{};if(win.isFullScreen())exitFullScreen();else enterFullScreen();return}
    if(input.type==='keyDown'&&input.key==='Escape'&&win.isFullScreen()){exitFullScreen();return}
    if(input.type==='keyDown'&&String(input.key).toUpperCase()==='L'&&input.control&&input.shift){win.webContents.send('session:lock');return}
  });
  win.webContents.on('did-fail-load',(_,code,desc)=>{if(app.isPackaged)win.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(`<html><body style="background:#0b0d10;color:#f0c75e;font-family:Arial;padding:40px"><h2>Uni-PDV</h2><p>Não foi possível carregar a interface.</p><p>${code} — ${desc}</p></body></html>`))});
  if(isDev)win.loadURL('http://127.0.0.1:5173');else{const indexPath=path.join(app.getAppPath(),'dist','index.html');if(fs.existsSync(indexPath))win.loadFile(indexPath);else win.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent('<h2>Uni-PDV</h2><p>Interface não incluída.</p>'))}
  ipcMain.handle('email:settings',()=>{const s=Object.fromEntries(db.prepare('SELECT key,value FROM settings').all().map(x=>[x.key,x.value]));delete s.email_password_enc;return ok(s)});
  ipcMain.handle('email:save-settings',(_,s)=>{const q=db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');db.transaction(()=>{for(const k of ['email_host','email_port','email_secure','email_sender_name','email_from'])if(s[k]!==undefined)q.run(k,String(s[k]??''));if(s.email_password){if(!safeStorage.isEncryptionAvailable())fail('O Windows não disponibilizou armazenamento seguro para a senha do e-mail.','EMAIL_STORE');q.run('email_password_enc',safeStorage.encryptString(String(s.email_password)).toString('base64'));}})();return ok(true)});
  ipcMain.handle('email:choose-attachments',async()=>{const r=await dialog.showOpenDialog({title:'Selecionar anexos',properties:['openFile','multiSelections'],filters:[{name:'Arquivos permitidos',extensions:['pdf','jpg','jpeg','png','bmp','xml']},{name:'Todos os arquivos',extensions:['*']} ]});return ok(r.canceled?[]:r.filePaths)});
  ipcMain.handle('email:send',async(_,input={})=>{const to=String(input.to||'').trim();if(!to)fail('Informe o destinatário.','VALIDATION');const s=Object.fromEntries(db.prepare('SELECT key,value FROM settings').all().map(x=>[x.key,x.value]));if(!s.email_host||!(s.email_from||s.email_user))fail('Configure o servidor SMTP e o endereço de e-mail do remetente no menu E-mails.','EMAIL_CONFIG');if(s.email_password_enc){try{s.email_password=safeStorage.decryptString(Buffer.from(s.email_password_enc,'base64'))}catch{fail('Não foi possível desbloquear a senha do e-mail neste Windows.','EMAIL_STORE')}}if(!s.email_password)fail('Informe a senha do e-mail e salve a configuração.','EMAIL_CONFIG');let nodemailer;try{nodemailer=require('nodemailer')}catch{fail('O módulo de envio de e-mail não está instalado. Reinstale as dependências do Uni-PDV.','EMAIL_DEP')}const authUser=s.email_from||s.email_user; const transporter=nodemailer.createTransport({host:s.email_host,port:Number(s.email_port||587),secure:String(s.email_secure)==='1',auth:{user:authUser,pass:s.email_password}});const attachments=(Array.isArray(input.attachments)?input.attachments:[]).filter(f=>['.pdf','.jpg','.jpeg','.png','.bmp','.xml'].includes(path.extname(String(f)).toLowerCase())).map(filename=>({filename:path.basename(filename),path:filename}));await transporter.sendMail({from:s.email_sender_name?`\"${String(s.email_sender_name).replace(/\"/g,'')}\" <${s.email_from||s.email_user}>`:(s.email_from||s.email_user),to,subject:String(input.subject||'Documento enviado pelo Uni-PDV'),text:String(input.text||'Segue o documento enviado pelo Uni-PDV.'),attachments});return ok(true)});
  ipcMain.handle('email:test',async()=>{return await new Promise((resolve,reject)=>{try{const s=Object.fromEntries(db.prepare('SELECT key,value FROM settings').all().map(x=>[x.key,x.value]));if(!s.email_host||!(s.email_from||s.email_user))fail('Configure o servidor SMTP e o endereço de e-mail do remetente antes do teste.','EMAIL_CONFIG');if(s.email_password_enc){try{s.email_password=safeStorage.decryptString(Buffer.from(s.email_password_enc,'base64'))}catch{fail('Não foi possível desbloquear a senha do e-mail.','EMAIL_STORE')}}const nodemailer=require('nodemailer');const authUser=s.email_from||s.email_user;const t=nodemailer.createTransport({host:s.email_host,port:Number(s.email_port||587),secure:String(s.email_secure)==='1',auth:{user:authUser,pass:s.email_password}});t.verify(err=>err?reject(err):resolve(ok(true)))}catch(e){reject(e)}})});

}

app.whenReady().then(()=>startApplication());

app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit()});
