'use strict';
// Management views calculated from the *existing* Uni-PDV database. Never alter transactions.
const asDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||''))?String(v):new Date().toISOString().slice(0,10);
const round=v=>Math.round(Number(v||0));
function range(input={}){const until=asDate(input.until), since=asDate(input.since||`${until.slice(0,7)}-01`);if(since>until)throw Error('Intervalo de datas inválido.');return {since,until};}
function compute(db,filters={}){
 const {since,until}=range(filters);
 const saleRows=db.prepare(`SELECT s.id,s.total_cents,s.discount_cents,s.delivery_cents,s.sold_at,
  si.product_id,si.kit_id,si.name,si.quantity,si.total_cents line_total,si.sale_mode,si.weight_grams,
  p.item_type,p.cost_cents,p.price_cents,p.sale_mode product_mode,
  k.name kit_name FROM sales s JOIN sale_items si ON si.sale_id=s.id
  LEFT JOIN products p ON p.id=si.product_id LEFT JOIN kits k ON k.id=si.kit_id
  WHERE substr(s.sold_at,1,10) BETWEEN ? AND ? AND COALESCE(s.status,'CONCLUIDA')<>'CANCELADA' ORDER BY s.sold_at DESC`).all(since,until);
 let revenue=0,cost=0,unknownCost=0,services=0,goods=0;
 const items=new Map(),seen=new Set();
 for(const r of saleRows){
  const id=r.product_id?`p:${r.product_id}`:`k:${r.kit_id}`,entry=items.get(id)||{id,name:r.name,sold:0,revenue_cents:0,cost_cents:0,type:r.kit_id?'COMBO':r.item_type==='SERVICE'?'SERVIÇO':'PRODUTO'};
  const line=round(r.line_total),q=Number(r.quantity||1),weighted=r.sale_mode==='WEIGHT'||r.sale_mode==='MIX_WEIGHT';
  const known=r.product_id&&r.cost_cents!==null&&r.cost_cents!==undefined&&Number(r.cost_cents)>0;
  // Kit cost is not imputed from missing historical component prices; exclude from reliable estimate.
  const lineCost=known?round(Number(r.cost_cents)*(weighted?Number(r.weight_grams||0)/1000:q)):0;
  entry.sold+=weighted?Number(r.weight_grams||0)/1000:q;entry.revenue_cents+=line;entry.cost_cents+=lineCost;
  if(!known)unknownCost++;
  items.set(id,entry);revenue+=line;cost+=lineCost;
  if(r.item_type==='SERVICE')services+=line;else goods+=line;
  seen.add(r.id);
 }
 const total=db.prepare("SELECT COALESCE(SUM(total_cents),0) total, COUNT(*) n FROM sales WHERE substr(sold_at,1,10) BETWEEN ? AND ? AND COALESCE(status,'CONCLUIDA')<>'CANCELADA'").get(since,until);
 const booked=round(total?.total||0),directCost=round(cost),grossProfit=unknownCost?null:booked-directCost;
 const purchases=db.prepare("SELECT COALESCE(SUM(amount_cents),0) total FROM finance_entries WHERE entry_type IN ('COMPRA','DESPESA') AND status='PAGO' AND COALESCE(paid_at,issue_date) BETWEEN ? AND ?").get(since,until);
 return {since,until,sales_count:seen.size,booked_revenue_cents:booked,line_revenue_cents:revenue,services_revenue_cents:services,products_revenue_cents:goods,cost_cents:directCost,gross_profit_cents:grossProfit,missing_cost_items:unknownCost,paid_expenses_cents:round(purchases?.total),products:[...items.values()].sort((a,b)=>b.revenue_cents-a.revenue_cents)};
}
function install(db,ipcMain){
 ipcMain.handle('management:insights',(_,f)=>({ok:true,data:compute(db,f)}));
 ipcMain.handle('management:profits',(_,f)=>({ok:true,data:compute(db,f).products}));
 ipcMain.handle('management:goals',()=>{let goals={revenue_cents:0,profit_cents:0};try{goals=JSON.parse(db.prepare("SELECT value FROM settings WHERE key='financial_goals_json'").get()?.value||'{}')}catch{}return {ok:true,data:goals};});
 ipcMain.handle('management:goals-set',(_,v={})=>{
  const num=k=>{const n=Number(v[k]);if(!Number.isSafeInteger(n)||n<0||n>100000000000)throw Error('Informe uma meta monetária válida.');return n};
  const goals={revenue_cents:num('revenue_cents'),profit_cents:num('profit_cents')};
  db.prepare("INSERT INTO settings(key,value) VALUES('financial_goals_json',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(JSON.stringify(goals));return {ok:true,data:goals};
 });
}
module.exports={install,compute,range};
