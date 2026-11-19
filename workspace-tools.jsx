import React, {useEffect, useMemo, useState} from 'react';
import {createPortal} from 'react-dom';
import {X, Search, Star, Printer, CheckCircle2, AlertTriangle, CircleAlert, Zap, Settings2, ChevronRight, LayoutGrid, RotateCcw} from 'lucide-react';
import './workspace-tools.css';

const DEFAULT_FAVORITES=['vendas','agenda','clientes','orcamentos','relatorios'];
const LABELS={inicio:'Início',caixa:'Caixa',vendas:'Nova venda',orcamentos:'Orçamentos',agenda:'Agenda',produtos:'Produtos e serviços',kits:'Kits / Combos',clientes:'Clientes',fornecedores:'Fornecedores',estoque:'Estoque', 'analise-estoque':'Análise de estoque',rentabilidade:'Rentabilidade','metas-financeiras':'Metas financeiras',compras:'Compras',financeiro:'Compras e Financeiro',relatorios:'Relatórios',fiscal:'Fiscal',anotacoes:'Anotações',backup:'Backup',email:'E-mails',diagnostico:'Diagnóstico',atividades:'Atividades',ajuda:'Ajuda',config:'Configurações'};
const ICONS={vendas:'🛍️',agenda:'📅',clientes:'👥',orcamentos:'📄',relatorios:'📊',caixa:'💳',estoque:'📦',inicio:'🏠',produtos:'📦',compras:'🧾',backup:'🛡️',config:'⚙️'};
function safeRead(key,fallback){try{const v=JSON.parse(localStorage.getItem(key));return v??fallback}catch{return fallback}}
export function readFavorites(){const x=safeRead('uni-favorite-actions-v1',DEFAULT_FAVORITES);return Array.isArray(x)?x.filter(id=>LABELS[id]):DEFAULT_FAVORITES}
export function readWorkspacePrefs(){return safeRead('uni-workspace-prefs-v1',{compact:false,showFavorites:true})}
export function WorkspaceQuickActions({open,close,go,nav,favorites,setFavorites,onPrint}){
 const [q,setQ]=useState('');
 useEffect(()=>{if(open)setQ('')},[open]);
 useEffect(()=>{if(!open)return;const fn=e=>{if(e.key==='Escape')close()};window.addEventListener('keydown',fn);return()=>window.removeEventListener('keydown',fn)},[open,close]);
 const list=useMemo(()=>nav.filter(x=>!q||x[1].toLocaleLowerCase('pt-BR').includes(q.toLocaleLowerCase('pt-BR'))),[nav,q]);
 if(!open)return null;
 return createPortal(<div className="nl-workspace-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)close()}}><section className="nl-workspace-dialog" role="dialog" aria-modal="true" aria-label="Ações rápidas"><header><div><span className="nl-kicker">ATALHO GLOBAL · Ctrl + K</span><h2><Zap size={20}/> Ações rápidas</h2></div><button className="iconbtn" onClick={close} aria-label="Fechar"><X/></button></header><label className="nl-quick-search"><Search/><input autoFocus value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar tela ou ação..."/></label><div className="nl-quick-grid">{list.map(([id,label,Icon])=><button key={id} onClick={()=>{go(id);close()}}><Icon/><span>{label}</span><ChevronRight size={16}/></button>)}<button onClick={()=>{close();onPrint()}}><Printer/><span>Imprimir tela atual</span><ChevronRight size={16}/></button></div><div className="nl-favorites-editor"><div><b><Star size={16}/> Ações favoritas</b><small>Marque as telas que deseja deixar no acesso rápido.</small></div><div className="nl-favorites-checks">{nav.map(([id,label])=><label key={id}><input type="checkbox" checked={favorites.includes(id)} onChange={e=>setFavorites(old=>e.target.checked?[...old,id]:old.filter(x=>x!==id))}/>{label}</label>)}</div><button className="smallbtn" onClick={()=>setFavorites(DEFAULT_FAVORITES)}><RotateCcw size={14}/> Restaurar sugestões</button></div><footer><span>Enter nas ações · Esc fecha · Alt+1–5 abre favoritos</span><button onClick={close}>Concluir</button></footer></section></div>,document.body)
}
export function WorkspaceFavoritesBar({favorites,go}){
 const items=favorites.filter(id=>LABELS[id]).slice(0,8);if(!items.length)return null;
 return <div className="nl-favorite-bar" aria-label="Ações favoritas"><span><Star size={14}/> Favoritos</span>{items.map(id=><button key={id} onClick={()=>go(id)} title={LABELS[id]}><b>{ICONS[id]||'✦'}</b>{LABELS[id]}</button>)}</div>
}
export function WorkspacePreferences({open,close,prefs,setPrefs}){
 if(!open)return null;
 return createPortal(<div className="nl-workspace-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)close()}}><section className="nl-workspace-dialog nl-preferences-dialog" role="dialog" aria-modal="true" aria-label="Personalizar espaço de trabalho"><header><div><span className="nl-kicker">PERSONALIZAÇÃO</span><h2><Settings2 size={20}/> Espaço de trabalho</h2></div><button className="iconbtn" onClick={close} aria-label="Fechar"><X/></button></header><p>As preferências são salvas neste computador e não alteram vendas, estoque ou outros dados do sistema.</p><label className="nl-pref-row"><span><b>Mostrar barra de favoritos</b><small>Acesso às telas mais usadas no topo da área de trabalho.</small></span><input type="checkbox" checked={!!prefs.showFavorites} onChange={e=>setPrefs(p=>({...p,showFavorites:e.target.checked}))}/></label><label className="nl-pref-row"><span><b>Modo compacto</b><small>Reduz espaçamentos para exibir mais conteúdo em telas menores.</small></span><input type="checkbox" checked={!!prefs.compact} onChange={e=>setPrefs(p=>({...p,compact:e.target.checked}))}/></label><footer><button onClick={()=>setPrefs({compact:false,showFavorites:true})} className="smallbtn"><RotateCcw size={14}/> Restaurar padrão</button><button onClick={close}>Concluir</button></footer></section></div>,document.body)
}
export function PendingTasksPanel({open,close,overview,notifications,go,onPrint}){
 if(!open)return null;
 const tasks=[];const o=overview||{};
 if(!o.cash)tasks.push({id:'cash',kind:'warning',title:'Caixa fechado',message:'Abra o caixa antes de registrar vendas.',page:'caixa',action:'Abrir caixa'});
 const low=Number(o.lowStockCount??(o.lowStock||[]).length);if(low>0)tasks.push({id:'stock',kind:'warning',title:'Estoque baixo',message:`${low} item(ns) no mínimo ou abaixo.`,page:'analise-estoque',action:'Ver estoque'});
 if(Number(o.debt?.n||0)>0)tasks.push({id:'debt',kind:'warning',title:'Saldos de clientes em aberto',message:`${o.debt.n} cliente(s) · saldo ${new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(o.debt.total||0)/100)}.`,page:'clientes',action:'Ver clientes'});
 if(Number(o.openQuotes||0)>0)tasks.push({id:'quotes',kind:'info',title:'Orçamentos aguardando retorno',message:`${o.openQuotes} orçamento(s) em aberto.`,page:'orcamentos',action:'Revisar'});
 if(Number(o.fiscalPending||0)>0)tasks.push({id:'fiscal',kind:'warning',title:'Documentos fiscais pendentes',message:`${o.fiscalPending} documento(s) precisam de atenção.`,page:'fiscal',action:'Ver fiscal'});
 (notifications||[]).forEach((n,i)=>{if(!tasks.some(t=>t.page===n.page&&t.title===n.title))tasks.push({id:`n-${n.id||i}`,kind:n.kind||'info',title:n.title,message:n.message,page:n.page||'inicio',action:'Abrir'})});
 return createPortal(<div className="nl-workspace-overlay nl-pending-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)close()}}><section className="nl-workspace-dialog nl-pending-dialog" role="dialog" aria-modal="true" aria-label="Central de pendências"><header><div><span className="nl-kicker">CENTRAL OPERACIONAL</span><h2><CheckCircle2 size={20}/> Pendências e tarefas <em>{tasks.length}</em></h2></div><button className="iconbtn" onClick={close} aria-label="Fechar"><X/></button></header><p>Uma lista única de itens que podem exigir ação. A contagem é informativa e não altera nem conclui tarefas automaticamente.</p><div className="nl-task-list">{tasks.length?tasks.map(t=><article key={t.id}><span className={`nl-task-icon ${t.kind}`}>{t.kind==='danger'?<CircleAlert/>:t.kind==='warning'?<AlertTriangle/>:<CheckCircle2/>}</span><div><b>{t.title}</b><small>{t.message}</small></div><button onClick={()=>{go(t.page);close()}}>{t.action}<ChevronRight size={15}/></button></article>):<div className="nl-task-empty"><CheckCircle2/><b>Nenhuma pendência prioritária identificada</b><span>Você pode imprimir a tela atual ou continuar a rotina normalmente.</span></div>}</div><footer><button className="smallbtn" onClick={()=>{close();onPrint()}}><Printer size={15}/> Imprimir tela atual</button><button onClick={close}>Concluir</button></footer></section></div>,document.body)
}

/** Shared home insight layout derived from NL, adapted to the Uni-PDV overview. */
export function UniSmartInsights({overview,go}){
 const o=overview||{};
 const alerts=[];
 if(!o.cash)alerts.push({level:'warn',title:'Caixa fechado',body:'Abra o caixa antes de iniciar as vendas.',action:'caixa',label:'Abrir caixa'});
 const low=Number(o.lowStockCount??(o.lowStock||[]).length);
 if(low>0)alerts.push({level:'warn',title:'Estoque precisa de atenção',body:`${low} produto(s) no mínimo ou abaixo.`,action:'analise-estoque',label:'Analisar estoque'});
 if(Number(o.debt?.n||0)>0)alerts.push({level:'warn',title:'Valores em aberto de clientes',body:`${Number(o.debt.n)} cliente(s) com saldo pendente.`,action:'clientes',label:'Ver clientes'});
 if(Number(o.openQuotes||0)>0)alerts.push({level:'info',title:'Orçamentos aguardando retorno',body:`${Number(o.openQuotes)} orçamento(s) em aberto.`,action:'orcamentos',label:'Revisar orçamentos'});
 if(Number(o.fiscalPending||0)>0)alerts.push({level:'warn',title:'Documentos fiscais pendentes',body:`${o.fiscalPending} documento(s) precisam de atenção.`,action:'fiscal',label:'Ver fiscal'});
 if(!alerts.length)alerts.push({level:'ok',title:'Nenhum alerta operacional prioritário',body:'Continue acompanhando caixa, estoque e indicadores financeiros.',action:'metas-financeiras',label:'Acompanhar metas'});
 return <section className="panel smart-insights"><div className="toolbar inline"><div><h2>✦ Painel Inteligente</h2><p className="muted">Alertas práticos gerados a partir dos dados atuais do Uni-PDV.</p></div><button className="smallbtn" onClick={()=>go('metas-financeiras')}>Metas financeiras</button></div><div className="smart-insight-list">{alerts.map((a,i)=><article className={`smart-insight ${a.level}`} key={`${a.title}-${i}`}><div><b>{a.title}</b><p>{a.body}</p></div><button className="smallbtn" onClick={()=>go(a.action)}>{a.label}</button></article>)}</div></section>;
}
