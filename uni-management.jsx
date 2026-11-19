import React,{useEffect,useMemo,useRef,useState} from 'react';
import {
  Smartphone, Search, RefreshCw, Target, Download, ChevronDown, Check,
  ListChecks, List, LayoutGrid, PackagePlus, WalletCards, BarChart3,
  Plus
} from 'lucide-react';
import './uni-management.css';

const today=()=>new Date().toISOString().slice(0,10);
const monthStart=()=>today().slice(0,7)+'-01';
const last30Start=()=>{const d=new Date();d.setDate(d.getDate()-29);return d.toISOString().slice(0,10)};
const safeNum=v=>Number.isFinite(Number(v))?Number(v):0;
const brl=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format((Number(v)||0)/100);
const fmtInt=v=>Number(v||0).toLocaleString('pt-BR');
const fmtDate=v=>{if(!v)return '—';const d=new Date(v);return Number.isNaN(d.getTime())?String(v):d.toLocaleString('pt-BR')};
const fmtDateOnly=v=>{if(!v)return '—';const s=String(v);if(/^\d{4}-\d{2}-\d{2}$/.test(s)){const[y,m,d]=s.split('-');return `${d}/${m}/${y}`;}const dt=new Date(v);return Number.isNaN(dt.getTime())?s:dt.toLocaleDateString('pt-BR')};
const weightLabel=g=>`${(Number(g||0)/1000).toLocaleString('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:3})} kg`;
const stockLabel=row=>String(row?.sale_mode||'').toUpperCase()==='WEIGHT'?weightLabel(row.stock):`${fmtInt(row.stock)} ${row.unit||'un'}`;
const minStockLabel=row=>String(row?.sale_mode||'').toUpperCase()==='WEIGHT'?weightLabel(row.min_stock):`${fmtInt(row.min_stock)} ${row.unit||'un'}`;
const soldLabel=row=>String(row?.sale_mode||'').toUpperCase()==='WEIGHT'?weightLabel(row.sold_qty_90d):fmtInt(row.sold_qty_90d);
const reorderLabel=row=>String(row?.sale_mode||'').toUpperCase()==='WEIGHT'?weightLabel(row.suggested_reorder):`${fmtInt(row.suggested_reorder)} ${row.unit||'un'}`;
const centsFromInput=v=>{const n=Number(String(v||'0').trim().replace(/\./g,'').replace(',','.'));return Number.isFinite(n)&&n>0?Math.round(n*100):0};
const calcPct=(value,total)=>total>0?Math.min(100,Math.round((Number(value||0)/Number(total))*100)):0;

const VIEW_MODE_OPTIONS={
  details:{label:'Detalhes',icon:ListChecks},
  list:{label:'Lista compacta',icon:List},
  blocks:{label:'Blocos',icon:LayoutGrid}
};
function useLocalViewMode(scope,initial='details'){
  const [value,setValue]=useState(()=>{try{const saved=localStorage.getItem(`pdv:view:${scope}`);return VIEW_MODE_OPTIONS[saved]?saved:initial}catch{return initial}});
  const change=mode=>{if(!VIEW_MODE_OPTIONS[mode])return;setValue(mode);try{localStorage.setItem(`pdv:view:${scope}`,mode)}catch{}};
  return [value,change];
}
function ViewModeMenu({value,onChange,modes=['details','list','blocks']}){
  const [open,setOpen]=useState(false);
  const current=VIEW_MODE_OPTIONS[value]||VIEW_MODE_OPTIONS.details;
  const CurrentIcon=current.icon;
  return <span className="ux-view-menu"><button type="button" className="smallbtn ux-view-trigger" onClick={()=>setOpen(v=>!v)} title="Alterar visualização"><CurrentIcon/><span>Visualização</span><ChevronDown/></button>{open&&<span className="ux-view-popover">{modes.map(mode=>{const opt=VIEW_MODE_OPTIONS[mode],Icon=opt.icon;return <button type="button" key={mode} className={value===mode?'active':''} onClick={()=>{onChange(mode);setOpen(false)}}><Icon/><span>{opt.label}</span>{value===mode&&<Check/>}</button>})}</span>}</span>;
}

export function UniManagement({type,notify}){
  const [from,setFrom]=useState(type==='goals'?last30Start():monthStart());
  const [to,setTo]=useState(today());
  const [insights,setInsights]=useState(null);
  const [stockRows,setStockRows]=useState([]);
  const [financeRows,setFinanceRows]=useState([]);
  const [stockDays,setStockDays]=useState('90');
  const [stockView,setStockView]=useLocalViewMode('uni-stock','details');
  const [search,setSearch]=useState('');
  const [tab,setTab]=useState('purchases');
  const [revenue,setRevenue]=useState('');
  const [profit,setProfit]=useState('');
  const [busy,setBusy]=useState(false);
  const [loaded,setLoaded]=useState(false);
  const [error,setError]=useState('');
  const changed=useRef(false);

  const loadGoals=async()=>{
    const g=await window.api.management.goals();
    if(!changed.current){
      setRevenue(String((Number(g?.revenue_cents||0)/100).toFixed(2)).replace('.',',').replace(/,00$/,(Number(g?.revenue_cents||0)>0?',00':'')));
      setProfit(String((Number(g?.profit_cents||0)/100).toFixed(2)).replace('.',',').replace(/,00$/,(Number(g?.profit_cents||0)>0?',00':'')));
      if(!Number(g?.revenue_cents||0)) setRevenue('');
      if(!Number(g?.profit_cents||0)) setProfit('');
    }
  };

  const load=async()=>{
    try{
      setBusy(true);
      setError('');
      if(type==='stock'){
        setStockRows(await window.api.stock.analysis());
      }else if(type==='purchases'){
        const data=await window.api.finance.list({from,to});
        setFinanceRows(data?.rows||[]);
      }else{
        setInsights(await window.api.management.insights({since:from,until:to}));
        if(type==='goals') await loadGoals();
      }
      setLoaded(true);
    }catch(e){
      setError(e?.message||String(e));
      if(notify) notify(e);
    }finally{setBusy(false)}
  };

  useEffect(()=>{load()},[type,from,to]);

  const saveGoals=async()=>{
    try{
      setBusy(true);
      await window.api.management.saveGoals({revenue_cents:centsFromInput(revenue),profit_cents:centsFromInput(profit)});
      changed.current=false;
      await load();
      notify?.('Metas financeiras salvas.');
    }catch(e){setError(e?.message||String(e));notify?.(e)}finally{setBusy(false)}
  };

  const stockBase=useMemo(()=>Array.isArray(stockRows)?stockRows.filter(r=>String(r?.item_type||'PRODUCT').toUpperCase()!=='SERVICE'):[],[stockRows]);
  const lowStock=useMemo(()=>stockBase.filter(r=>r.low_stock),[stockBase]);
  const staleItems=useMemo(()=>stockBase.filter(r=>Number(r.sold_qty_90d||0)<=0),[stockBase]);
  const inconsistentItems=useMemo(()=>stockBase.filter(r=>Number(r.stock||0)<0),[stockBase]);
  const topMoving=useMemo(()=>[...stockBase].sort((a,b)=>Number(b.sold_qty_90d||0)-Number(a.sold_qty_90d||0)).slice(0,10),[stockBase]);
  const visibleStock=useMemo(()=>{
    const q=search.trim().toLocaleLowerCase('pt-BR');
    return stockBase.filter(r=>!q||[r.name,r.sku,r.category,r.barcode].some(v=>String(v||'').toLocaleLowerCase('pt-BR').includes(q)));
  },[stockBase,search]);
  const exportCsv=()=>{
    const esc=v=>{let x=String(v??'');if(/^[\s]*[=+@\-\t\r]/.test(x)&&!/^-[0-9]+([,.][0-9]+)?$/.test(x))x="'"+x;return '"'+x.replace(/"/g,'""')+'"'};
    const csv=[['Produto','Categoria','Estoque','Mínimo','Vendido 90 dias','Reposição sugerida','Dias estimados','Sem giro','Excesso','Valor estimado'],...visibleStock.map(r=>[r.name,r.category||'',stockLabel(r),minStockLabel(r),soldLabel(r),reorderLabel(r),r.estimated_days_left??'',r.no_turnover_90d?'Sim':'Não',r.excess_stock?'Sim':'Não',brl(r.stock_value_cents||0)])].map(a=>a.map(esc).join(';')).join('\r\n');
    const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download='analise-estoque.csv';a.click();URL.revokeObjectURL(url);
  };

  const products=Array.isArray(insights?.products)?insights.products:[];
  const totals={
    revenue_cents:Number(insights?.line_revenue_cents||0),
    revenue_with_cost_cents:products.reduce((n,p)=>n+(Number(p.cost_cents||0)>0?Number(p.revenue_cents||0):0),0),
    estimated_cost_cents:Number(insights?.cost_cents||0),
    estimated_gross_profit_cents:insights?.gross_profit_cents==null?null:Number(insights?.gross_profit_cents||0),
    missing_cost_lines:Number(insights?.missing_cost_items||0)
  };
  totals.estimated_margin_percent=totals.estimated_gross_profit_cents==null||totals.revenue_with_cost_cents<=0?null:Math.round((totals.estimated_gross_profit_cents*10000)/totals.revenue_with_cost_cents)/100;

  const profitabilityRows=products.map(p=>{
    const revenueWithCost=Number(p.cost_cents||0)>0?Number(p.revenue_cents||0):0;
    const estimatedCost=Number(p.cost_cents||0);
    const grossProfit=Number(p.cost_cents||0)>0?revenueWithCost-estimatedCost:null;
    const margin=grossProfit==null||revenueWithCost<=0?null:Math.round((grossProfit*10000)/revenueWithCost)/100;
    return {...p,lines:Number(p.sold||0),revenue_with_cost_cents:revenueWithCost,estimated_cost_cents:estimatedCost,estimated_gross_profit_cents:grossProfit,estimated_margin_percent:margin,missing_cost_lines:Number(p.cost_cents||0)>0?0:1};
  });

  const actualRevenue=Number(insights?.booked_revenue_cents||0);
  const actualProfit=insights?.gross_profit_cents==null?null:Number(insights.gross_profit_cents||0);
  const revenueGoal=centsFromInput(revenue);
  const profitGoal=centsFromInput(profit);

  const purchaseRows=useMemo(()=>{
    if(tab==='purchases') return financeRows.filter(r=>String(r.entry_type||'').toUpperCase()==='COMPRA');
    if(tab==='payables') return financeRows.filter(r=>String(r.status||'').toUpperCase()!=='CANCELADO');
    return financeRows;
  },[financeRows,tab]);
  const dueTotal=purchaseRows.reduce((n,r)=>n+Number(r.amount_cents||0),0);
  const openTotal=purchaseRows.filter(r=>String(r.status||'').toUpperCase()==='PENDENTE').reduce((n,r)=>n+Number(r.amount_cents||0),0);
  const overdueTotal=purchaseRows.filter(r=>String(r.status||'').toUpperCase()==='PENDENTE'&&String(r.due_date||'')<today()).reduce((n,r)=>n+Number(r.amount_cents||0),0);
  const paidTotal=purchaseRows.filter(r=>String(r.status||'').toUpperCase()==='PAGO').reduce((n,r)=>n+Number(r.amount_cents||0),0);

  if(type==='stock') return <div className="settings">
    <div className="panel">
      <div className="toolbar inline">
        <div>
          <h2>Reposição, giro e consistência</h2>
          <p className="muted">Análise consultiva: não altera o estoque e desconsidera vendas canceladas.</p>
        </div>
        <div className="actions" style={{display:'flex',alignItems:'end',gap:10,flexWrap:'wrap'}}>
          <label>Dias sem venda
            <select value={stockDays} onChange={e=>setStockDays(e.target.value)}>
              <option value="30">30 dias</option>
              <option value="60">60 dias</option>
              <option value="90">90 dias</option>
            </select>
          </label>
          <button className="smallbtn" onClick={load} disabled={busy}><RefreshCw/> Atualizar</button>
        </div>
      </div>
      {!!error&&<p className="muted">{error}</p>}
      <p><b>{stockBase.length}</b> produtos ativos · <b>{lowStock.length}</b> em reposição · <b>{staleItems.length}</b> sem giro · <b>{inconsistentItems.length}</b> inconsistências detectadas</p>
      <div className="formgrid" style={{marginTop:12}}>
        <div>
          <h3>Reposição (estoque ≤ mínimo)</h3>
          {lowStock.length?lowStock.slice(0,8).map(item=><div key={item.id} className="simplecard" style={{minHeight:'auto',padding:'10px 12px',marginBottom:8}}><b>{item.name}</b><small>Saldo {stockLabel(item)} · mínimo {minStockLabel(item)}</small></div>):<p className="muted">Sem alertas.</p>}
        </div>
        <div>
          <h3>Sem giro no período</h3>
          {staleItems.length?staleItems.slice(0,8).map(item=><div key={item.id} className="simplecard" style={{minHeight:'auto',padding:'10px 12px',marginBottom:8}}><b>{item.name}</b><small>Última venda: sem registro · {stockLabel(item)}</small></div>):<p className="muted">Sem itens sem giro.</p>}
        </div>
      </div>
      <h3 style={{marginTop:18}}>Materiais com maior saída registrada · {stockDays} dias</h3>
      <p className="muted">Inclui somente movimentações de saída já registradas. Para estimar consumo real, informe o motivo em cada movimentação; o sistema não presume consumo automático por serviço.</p>
      <div className="table"><table><thead><tr><th>Material</th><th>Saídas</th><th>Movimentações</th><th>Última saída</th></tr></thead><tbody>{topMoving.map(item=><tr key={item.id}><td>{item.name}</td><td>{soldLabel(item)}</td><td>{fmtInt(item.movement_count||0)}</td><td>{item.last_sale_at?fmtDateOnly(item.last_sale_at):'—'}</td></tr>)}{!topMoving.length&&<tr><td colSpan="4" className="muted">Ainda não há saídas de materiais registradas neste período.</td></tr>}</tbody></table></div>
      <p className="muted">Movimentações sem motivo: 0 · saídas identificadas como perda/descartes/vencimento/quebra: 0.</p>
    </div>

    <div className="toolbar" style={{marginTop:6}}>
      <div>
        <h2>Estoque de produtos de uso interno</h2>
        <p className="muted">Controle os materiais utilizados durante os atendimentos. Esses itens não aparecem no caixa e não podem ser vendidos.</p>
      </div>
    </div>
    <div className="toolbar">
      <div className="search compact"><Search/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Pesquisar material de uso"/></div>
      <ViewModeMenu value={stockView} onChange={setStockView}/>
    </div>
    <div className={`table panel ux-collection ux-view-${stockView}`}>
      <table>
        <thead><tr><th>Produto</th><th>Saldo</th><th>Mínimo</th><th>Vendas 90 dias</th><th>Dias estimados</th><th>Reposição sugerida</th><th>Situação</th></tr></thead>
        <tbody>
          {visibleStock.map(item=><tr key={item.id}><td data-label="Produto"><b>{item.name}</b><small>{item.category||'Sem categoria'} · {item.supplier_name||'Sem fornecedor'}</small></td><td data-label="Saldo">{stockLabel(item)}</td><td data-label="Mínimo">{minStockLabel(item)}</td><td data-label="Vendas 90 dias">{soldLabel(item)}</td><td data-label="Dias estimados">{item.estimated_days_left==null?'Sem histórico':item.estimated_days_left}</td><td data-label="Reposição sugerida">{reorderLabel(item)}</td><td data-label="Situação">{item.low_stock?<span className="badge warn">Reposição</span>:item.no_turnover_90d?<span className="badge">Sem giro</span>:item.excess_stock?<span className="badge warn">Possível excesso</span>:<span className="badge ok">Regular</span>}</td></tr>)}
          {!visibleStock.length&&<tr><td colSpan="7" className="muted">Nenhum material encontrado.</td></tr>}
        </tbody>
      </table>
    </div>
  </div>;

  if(type==='profit') return <div className="settings">
    <div className="panel">
      <div className="toolbar inline"><div><h2>Rentabilidade estimada</h2><p className="muted">Calculada com o custo atual cadastrado. Não representa lucro líquido. Considera descontos proporcionais e exclui frete e taxas de cartão da receita dos itens. Itens novos usam o custo salvo na venda; itens antigos e combos podem depender do custo atual. Sem custo conhecido, a margem fica parcial.</p></div></div>
      <div className="formgrid"><label>De<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>Até<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label><div><button className="smallbtn" onClick={load} disabled={busy}><RefreshCw/> Atualizar</button></div></div>
      {!!error&&<p className="muted">{error}</p>}
      <div className="cashcards"><div><span>Receita das linhas</span><strong>{brl(totals.revenue_cents)}</strong></div><div><span>Receita com custo conhecido</span><strong>{brl(totals.revenue_with_cost_cents)}</strong></div><div><span>Custo estimado</span><strong>{brl(totals.estimated_cost_cents)}</strong></div><div><span>Lucro bruto estimado</span><strong>{totals.estimated_gross_profit_cents==null?'R$ 0,00':brl(totals.estimated_gross_profit_cents)}</strong></div><div><span>Margem estimada</span><strong>{totals.estimated_margin_percent==null?'—':`${totals.estimated_margin_percent.toLocaleString('pt-BR',{maximumFractionDigits:2})}%`}</strong></div><div><span>Linhas sem custo válido</span><strong>{totals.missing_cost_lines||0}</strong></div></div>
    </div>
    <div className="panel"><div className="table"><table><thead><tr><th>Produto / kit</th><th>Linhas</th><th>Receita</th><th>Receita com custo</th><th>Custo estimado</th><th>Lucro bruto estimado</th><th>Margem</th><th>Sem custo</th></tr></thead><tbody>{profitabilityRows.map(r=><tr key={r.id}><td>{r.name}</td><td>{r.lines}</td><td>{brl(r.revenue_cents)}</td><td>{brl(r.revenue_with_cost_cents)}</td><td>{brl(r.estimated_cost_cents)}</td><td>{r.estimated_gross_profit_cents==null?'—':brl(r.estimated_gross_profit_cents)}</td><td>{r.estimated_margin_percent==null?'—':`${r.estimated_margin_percent.toLocaleString('pt-BR',{maximumFractionDigits:2})}%`}</td><td>{r.missing_cost_lines? 'Sim':'Não'}</td></tr>)}{!profitabilityRows.length&&<tr><td colSpan="8" className="muted">Nenhuma venda no período.</td></tr>}</tbody></table></div></div>
  </div>;

  if(type==='goals') return <div className="settings">
    <div className="panel">
      <div className="toolbar inline"><div><h2>Metas Financeiras</h2><p className="muted">Defina objetivos de receita e lucro bruto estimado. O acompanhamento usa os últimos 30 dias de vendas registradas; não é previsão contábil nem lucro líquido.</p></div><Target/></div>
      <div className="formgrid"><label>Meta de receita (R$)<input inputMode="decimal" value={revenue} onChange={e=>{changed.current=true;setRevenue(e.target.value)}} placeholder="Ex.: 12000,00"/></label><label>Meta de lucro bruto estimado (R$)<input inputMode="decimal" value={profit} onChange={e=>{changed.current=true;setProfit(e.target.value)}} placeholder="Ex.: 4000,00"/></label></div>
      <div className="modalactions"><button className="primary" disabled={busy} onClick={saveGoals}>{busy?'Salvando…':'Salvar metas'}</button></div>
    </div>
    <div className="panel"><h2>Progresso · últimos 30 dias</h2>{!loaded?<p className="muted">Carregando indicadores…</p>:<div className="cashcards"><div><span>Receita realizada</span><strong>{brl(actualRevenue)}</strong><small>Meta: {revenueGoal?brl(revenueGoal):'não definida'}</small><div className="goal-track"><span style={{width:`${calcPct(actualRevenue,revenueGoal)}%`}}/></div><b>{revenueGoal?`${calcPct(actualRevenue,revenueGoal)}% da meta · faltam ${brl(Math.max(0,revenueGoal-actualRevenue))}`:'Defina uma meta para acompanhar.'}</b></div><div><span>Lucro bruto estimado</span><strong>{actualProfit==null?'Indisponível':brl(actualProfit)}</strong><small>Meta: {profitGoal?brl(profitGoal):'não definida'}</small><div className="goal-track"><span style={{width:`${actualProfit==null?0:calcPct(actualProfit,profitGoal)}%`}}/></div><b>{actualProfit==null?'Há custos ausentes ou dados insuficientes.':profitGoal?`${calcPct(actualProfit,profitGoal)}% da meta · faltam ${brl(Math.max(0,profitGoal-actualProfit))}`:'Defina uma meta para acompanhar.'}</b></div></div>}</div>
    <div className="panel"><h2>Como interpretar</h2><ul><li>Receita considera vendas de produtos e serviços informadas pelo módulo comercial.</li><li>Lucro é bruto e estimado conforme os custos cadastrados; não desconta todas as despesas fixas e impostos.</li><li>Metas ficam salvas localmente no banco de configurações deste PDV.</li></ul></div>
  </div>;

  if(type==='purchases') return <div className="settings">
    <div className="panel"><div className="toolbar inline"><div><h2>Compras e financeiro complementar</h2><p className="muted">Registro de compras, entrada de mercadorias e contas a pagar. Sem impacto automático no caixa ou na NFC-e.</p></div><div className="actions"><button className="smallbtn" onClick={load} disabled={busy}><RefreshCw/> Atualizar</button></div></div><div className="actions"><button className={tab==='purchases'?'primary':'smallbtn'} onClick={()=>setTab('purchases')}><PackagePlus/> Compras e recebimentos</button><button className={tab==='payables'?'primary':'smallbtn'} onClick={()=>setTab('payables')}><WalletCards/> Contas a pagar</button><button className={tab==='report'?'primary':'smallbtn'} onClick={()=>setTab('report')}><BarChart3/> Compromissos</button></div></div>

    {tab==='purchases'&&<div className="panel"><div className="toolbar inline"><div><h3>Compras de fornecedores</h3><p className="muted">O pedido cadastrado não altera o estoque. Confirme o recebimento apenas quando a mercadoria chegar.</p></div><button className="primary" onClick={()=>window.dispatchEvent(new CustomEvent('app:navigate',{detail:'financeiro'}))}><Plus/> Nova compra</button></div><div className="table"><table><thead><tr><th>Compra</th><th>Fornecedor</th><th>Documento</th><th>Previsão</th><th>Total</th><th>Situação</th><th>Ações</th></tr></thead><tbody>{purchaseRows.map(o=><tr key={o.id}><td>#{o.id}</td><td>{o.supplier_name||'—'}</td><td>{o.category||o.description||'—'}</td><td>{o.due_date||'—'}</td><td className="money">{brl(o.amount_cents)}</td><td><span className={`badge ${String(o.status||'').toUpperCase()==='PAGO'?'ok':String(o.status||'').toUpperCase()==='CANCELADO'?'danger':'warn'}`}>{o.status||'PENDENTE'}</span></td><td><button className="smallbtn" onClick={()=>window.dispatchEvent(new CustomEvent('app:navigate',{detail:'financeiro'}))}>Abrir</button></td></tr>)}{!purchaseRows.length&&<tr><td colSpan="7" className="muted">Nenhuma compra registrada.</td></tr>}</tbody></table></div></div>}

    {tab==='payables'&&<div className="panel"><div className="toolbar inline"><div><h3>Contas a pagar</h3><p className="muted">Compromissos registrados no financeiro complementar do Uni-PDV.</p></div><button className="primary" onClick={()=>window.dispatchEvent(new CustomEvent('app:navigate',{detail:'financeiro'}))}><Plus/> Nova conta</button></div><div className="table"><table><thead><tr><th>ID</th><th>Fornecedor</th><th>Descrição</th><th>Vencimento</th><th>Valor</th><th>Pago</th><th>Status</th><th>Ações</th></tr></thead><tbody>{purchaseRows.map(p=><tr key={p.id}><td>#{p.id}</td><td>{p.supplier_name||'—'}</td><td>{p.description}</td><td>{p.due_date}</td><td>{brl(p.amount_cents)}</td><td>{String(p.status||'').toUpperCase()==='PAGO'?brl(p.amount_cents):brl(0)}</td><td><span className={`badge ${String(p.status||'').toUpperCase()==='PAGO'?'ok':String(p.status||'').toUpperCase()==='CANCELADO'?'danger':'warn'}`}>{p.status||'PENDENTE'}</span></td><td><button className="smallbtn" onClick={()=>window.dispatchEvent(new CustomEvent('app:navigate',{detail:'financeiro'}))}>Abrir</button></td></tr>)}{!purchaseRows.length&&<tr><td colSpan="8" className="muted">Nenhum compromisso financeiro.</td></tr>}</tbody></table></div></div>}

    {tab==='report'&&<div className="panel"><div className="toolbar inline"><div><h3>Relatório de compromissos financeiros</h3><p className="muted">Vencimentos no período e pagamentos efetivamente registrados. Não inclui contas a receber de clientes.</p></div></div><div className="formgrid"><label>De<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>Até<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label></div><button className="smallbtn" onClick={load} disabled={busy}>Consultar período</button><div className="cashcards"><div><span>Compromissos com vencimento</span><strong>{brl(dueTotal)}</strong></div><div><span>Saldo em aberto</span><strong>{brl(openTotal)}</strong></div><div><span>Atrasados</span><strong>{brl(overdueTotal)}</strong></div><div><span>Pagamentos realizados no período</span><strong>{brl(paidTotal)}</strong></div></div><div className="table"><table><thead><tr><th>Vencimento</th><th>Fornecedor</th><th>Descrição</th><th>Total</th><th>Saldo</th><th>Status</th></tr></thead><tbody>{purchaseRows.map(p=><tr key={p.id}><td>{p.due_date}</td><td>{p.supplier_name||'—'}</td><td>{p.description}</td><td>{brl(p.amount_cents)}</td><td>{String(p.status||'').toUpperCase()==='PAGO'?brl(0):brl(p.amount_cents)}</td><td>{p.status||'PENDENTE'}</td></tr>)}{!purchaseRows.length&&<tr><td colSpan="6" className="muted">Nenhum registro neste período.</td></tr>}</tbody></table></div></div>}
  </div>;

  return null;
}

export function UniAndroidSettings({notify}){
 const [operators,setOperators]=useState([]),[devices,setDevices]=useState([]),[active,setActive]=useState(null),[login,setLogin]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[enabled,setEnabled]=useState(false),[busy,setBusy]=useState(false);
 const refresh=async()=>{try{const [ops,devs]=await Promise.all([window.api.mobile.operators(),window.api.mobile.devices()]);setOperators(ops||[]);setDevices(devs||[])}catch(e){notify(e)}};
 useEffect(()=>{refresh()},[]);
 const select=o=>{setActive(o);setLogin(o.mobile_login||'');setPassword('');setConfirm('');setEnabled(!!o.mobile_enabled)};
 const save=async()=>{if(!active)return;try{setBusy(true);await window.api.mobile.configureOperator({id:active.id,name:active.name,photo_data:active.photo_data||'',mobile_login:login,mobile_password:password,mobile_password_confirm:confirm,mobile_enabled:enabled});await refresh();setActive(null);notify('Acesso Android atualizado.')}catch(e){notify(e)}finally{setBusy(false)}};
 const release=async d=>{if(!window.confirm('Liberar este aparelho para login de outro operador? As sessões deste aparelho serão encerradas.'))return;try{await window.api.mobile.releaseDevice(d.id);await refresh();notify('Vínculo do aparelho liberado.')}catch(e){notify(e)}};
 return <details className="uni-settings-section"><summary><Smartphone size={18}/> Integração Android e operadores por aparelho</summary><div className="panel"><p className="muted">Cada aparelho fica vinculado a um único operador. O Administrador pode liberar um aparelho nesta tela. As credenciais Android são diferentes das senhas Windows.</p><div className="uni-operators-list">{operators.map(o=><button type="button" key={o.id} className="smallbtn" onClick={()=>select(o)}>{o.name} · {o.mobile_enabled?'Android ativado':'Android desativado'}</button>)}</div>{active&&<div className="uni-mgt-form"><h3>{active.name}</h3><label>Login exclusivo Android<input value={login} onChange={e=>setLogin(e.target.value)} placeholder="operador.android"/></label><label>Nova senha (deixe vazia para manter)<input type="password" value={password} onChange={e=>setPassword(e.target.value)}/></label><label>Confirmar nova senha<input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)}/></label><label><input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/> Habilitar Android</label><div><button className="primary" disabled={busy} onClick={save}>Salvar acesso Android</button><button className="smallbtn" onClick={()=>setActive(null)}>Cancelar</button></div></div>}
 <h3>Aparelhos vinculados</h3>{devices.length?devices.map(d=><div className="uni-device" key={d.id}><span>{d.operator_name} · aparelho {d.id.slice(0,12)}…</span><button className="smallbtn" onClick={()=>release(d)}>Liberar aparelho</button></div>):<p className="muted">Nenhum aparelho vinculado ainda.</p>}<p className="muted">No menu Android da barra superior escolha “Ativar / mostrar conexão segura”, depois informe IP e impressão digital SHA-256 no celular. Utilize uma rede Wi-Fi privada e mantenha o Windows aberto.</p></div></details>;
}
