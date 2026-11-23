import {UniManagement,UniAndroidSettings} from './uni-management.jsx';
import {WorkspaceQuickActions,WorkspaceFavoritesBar,WorkspacePreferences,PendingTasksPanel,UniSmartInsights,readFavorites,readWorkspacePrefs} from './workspace-tools.jsx';
import React,{useEffect,useMemo,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {createPortal} from 'react-dom';
import * as I from 'lucide-react';
import appLogo from './Logo-Jhonnie-Beer.jpeg';
import cashRegisterSound from './cash-register.mp3';
import './style.css';
import './rainbow.css';
import './ux.css';
import './nl-layout-polish.css';

const brl=v=>(Number(v||0)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const gramsToKg=v=>(Math.max(0,Number(v||0))/1000).toLocaleString('pt-BR',{minimumFractionDigits:3,maximumFractionDigits:3});
const weightLabel=v=>`${gramsToKg(v)} kg`;
const kgInputToGrams=v=>{let s=String(v??'').trim().replace(/\s/g,'');if(!s)return 0;if(s.includes(',')&&s.includes('.'))s=s.replace(/\./g,'').replace(',','.');else if(s.includes(','))s=s.replace(',','.');const n=Number(s);return Number.isFinite(n)?Math.max(0,Math.round(n*1000)):0};
const isWeightLikeMode=m=>['WEIGHT','MIX_WEIGHT'].includes(String(m||'UNIT'));
const isVolumeLikeMode=m=>['VOLUME_L','VOLUME_ML','MIX_VOLUME_L','MIX_VOLUME_ML'].includes(String(m||'UNIT'));
const volumeInputToMl=(value,mode)=>{const raw=String(value??'').trim().replace(/\s/g,'').replace(',','.');const n=Number(raw);if(!Number.isFinite(n)||n<0)return 0;return Math.round(mode==='VOLUME_L'||mode==='MIX_VOLUME_L'?n*1000:n)};
const volumeLabel=ml=>`${(Number(ml||0)/1000).toLocaleString('pt-BR',{minimumFractionDigits:3,maximumFractionDigits:3})} L (${Number(ml||0)} ml)`;
const stockLabel=p=>String(p?.sale_mode||'UNIT')==='WEIGHT'?weightLabel(p?.stock):isVolumeLikeMode(p?.sale_mode)?volumeLabel(p?.stock):`${Number(p?.stock||0)} ${p?.unit||'un'}`;
const minStockLabel=p=>String(p?.sale_mode||'UNIT')==='WEIGHT'?weightLabel(p?.min_stock):isVolumeLikeMode(p?.sale_mode)?volumeLabel(p?.min_stock):`${Number(p?.min_stock||0)} ${p?.unit||'un'}`;
const cartItemTotal=i=>isWeightLikeMode(i?.sale_mode)?Math.round(Number(i?.price_cents||0)*Number(i?.weight_grams||0)/1000):isVolumeLikeMode(i?.sale_mode)?(String(i.sale_mode).endsWith('_L')?Math.round(Number(i?.price_cents||0)*Number(i?.volume_ml||0)/1000):Math.round(Number(i?.price_cents||0)*Number(i?.volume_ml||0))):Number(i?.price_cents||0)*Number(i?.qty||0);
const onlyDigits=v=>String(v??'').replace(/\D/g,'');
const centsFromInput=v=>{let s=String(v??'').trim().replace(/\s/g,'').replace(/R\$/gi,'');s=s.replace(/\./g,'').replace(',','.');const n=Number(s);return Number.isFinite(n)?Math.round(n*100):0};
const priceText=c=>c?`R$ ${(Number(c)/100).toFixed(2).replace('.',',')}`:'';
const phoneMask=v=>{const d=onlyDigits(v).slice(0,11);if(d.length<=2)return d;if(d.length<=7)return `(${d.slice(0,2)}) ${d.slice(2)}`;if(d.length<=11)return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;return d};
const maskCPF=v=>{const d=onlyDigits(v).slice(0,11);if(d.length<=3)return d;if(d.length<=6)return `${d.slice(0,3)}.${d.slice(3)}`;if(d.length<=9)return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`;return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`};
const maskCNPJ=v=>{const d=onlyDigits(v).slice(0,14);if(d.length<=2)return d;if(d.length<=5)return `${d.slice(0,2)}.${d.slice(2)}`;if(d.length<=8)return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5)}`;if(d.length<=12)return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8)}`;return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`};
const maskCEP=v=>{const d=onlyDigits(v).slice(0,8);return d.length>5?`${d.slice(0,5)}-${d.slice(5)}`:d};
const firstName=v=>String(v||'').trim().split(/\s+/)[0]||'';
const fmtDate=v=>new Date(v).toLocaleString('pt-BR');
const fmtTime=v=>new Date(v).toLocaleTimeString('pt-BR');
const fmtDateOnly=v=>{if(!v)return '—';const s=String(v);const d=/^\d{4}-\d{2}-\d{2}$/.test(s)?new Date(s+'T12:00:00'):new Date(s);return Number.isNaN(d.getTime())?'—':d.toLocaleDateString('pt-BR')};
const icons={
 layers:I.Layers,flame:I.Flame,calendar:I.CalendarDays,sparkles:I.Sparkles,circle:I.Circle,bowl:I.CupSoda,'cup-soda':I.CupSoda,droplets:I.Droplets,wind:I.Wind,cigar:I.Cigarette,smoke:I.Wind,package:I.Package,gem:I.Gem,leaf:I.Leaf,sun:I.Sun,moon:I.Moon,heart:I.Heart,star:I.Star,
 shopping:I.ShoppingBag,shoppingCart:I.ShoppingCart,shoppingBasket:I.ShoppingBasket,store:I.Store,tags:I.Tags,tag:I.Tag,barcode:I.Barcode,boxes:I.Boxes,box:I.Box,packageOpen:I.PackageOpen,packageCheck:I.PackageCheck,
 shirt:I.Shirt,footprints:I.Footprints,glasses:I.Glasses,crown:I.Crown,watch:I.Watch,handbag:I.ShoppingBag,backpack:I.Backpack,
 smartphone:I.Smartphone,monitor:I.Monitor,laptop:I.Laptop,tablet:I.Tablet,keyboard:I.Keyboard,mouse:I.Mouse,headphones:I.Headphones,speaker:I.Speaker,tv:I.Tv,radio:I.Radio,gamepad:I.Gamepad2,camera:I.Camera,
 sofa:I.Sofa,armchair:I.Armchair,bed:I.BedDouble,lamp:I.Lamp,refrigerator:I.Refrigerator,washingMachine:I.WashingMachine,microwave:I.Microwave,fan:I.Fan,home:I.Home,house:I.Home,
 flower:I.Flower2,flower2:I.Flower2,sprout:I.Sprout,tree:I.TreePine,trees:I.Trees,shovel:I.Shovel,tractor:I.Tractor,mountain:I.Mountain,tent:I.TentTree,
 utensils:I.Utensils,utensilsCrossed:I.UtensilsCrossed,coffee:I.Coffee,pizza:I.Pizza,chefHat:I.ChefHat,cookingPot:I.CookingPot,soup:I.Soup,sandwich:I.Sandwich,beef:I.Beef,fish:I.Fish,drumstick:I.Drumstick,milk:I.Milk,egg:I.Egg,cherry:I.Cherry,banana:I.Banana,citrus:I.Citrus,grape:I.Grape,carrot:I.Carrot,wheat:I.Wheat,cake:I.CakeSlice,cookie:I.Cookie,candy:I.Candy,beer:I.Beer,wine:I.Wine,martini:I.Martini,glassWater:I.GlassWater,snowflake:I.Snowflake,
 dog:I.Dog,cat:I.Cat,bird:I.Bird,rabbit:I.Rabbit,paw:I.PawPrint,bone:I.Bone,
 plane:I.Plane,car:I.Car,truck:I.Truck,bus:I.Bus,ship:I.Ship,train:I.TrainFront,bike:I.Bike,fuel:I.Fuel,battery:I.BatteryCharging,gauge:I.CircleGauge,mapPin:I.MapPin,
 gift:I.Gift,music:I.Music,ticket:I.Ticket,party:I.PartyPopper,
 bookOpen:I.BookOpen,book:I.Book,notebook:I.NotebookPen,printer:I.Printer,briefcaseBusiness:I.BriefcaseBusiness,briefcase:I.Briefcase,factory:I.Factory,warehouse:I.Warehouse,building:I.Building2,school:I.School,graduation:I.GraduationCap,library:I.Library,
 key:I.Key,lock:I.Lock,shield:I.ShieldCheck,wallet:I.Wallet,creditCard:I.CreditCard,banknote:I.Banknote,coins:I.Coins,piggyBank:I.PiggyBank,landmark:I.Landmark,badgeDollar:I.BadgeDollarSign,
 hammer:I.Hammer,wrench:I.Wrench,scissors:I.Scissors,paintbrush:I.Paintbrush,palette:I.Palette,sprayCan:I.SprayCan,ruler:I.Ruler,construction:I.Construction,hardHat:I.HardHat,
 stethoscope:I.Stethoscope,pill:I.Pill,heartPulse:I.HeartPulse,ambulance:I.Ambulance,syringe:I.Syringe,baby:I.Baby,dumbbell:I.Dumbbell,trophy:I.Trophy,medal:I.Medal,
 smile:I.Smile,calendarClock:I.CalendarClock,clock:I.Clock,clipboard:I.ClipboardList,receipt:I.ReceiptText,percent:I.Percent,calculator:I.Calculator,settings:I.Settings
};
const ICON_OPTIONS=[
 ['package','Produtos'],['shopping','Sacolas / Compras'],['shoppingBasket','Cesta'],['shoppingCart','Carrinho / Vendas'],['store','Loja'],['tags','Etiquetas'],['tag','Tag'],['barcode','Código de barras'],['boxes','Caixas'],['box','Caixa / Embalagem'],['packageOpen','Pacote aberto'],['packageCheck','Pacote conferido'],
 ['shirt','Roupas'],['footprints','Calçados'],['glasses','Óculos'],['crown','Acessórios premium'],['gem','Joias'],['watch','Relógios'],['handbag','Bolsas'],['backpack','Mochilas'],
 ['smartphone','Celulares'],['monitor','Informática'],['laptop','Notebook'],['tablet','Tablet'],['keyboard','Teclado'],['mouse','Mouse'],['headphones','Fones'],['speaker','Áudio'],['tv','TV'],['radio','Rádio'],['gamepad','Games'],['camera','Fotografia'],
 ['house','Casa'],['sofa','Móveis'],['armchair','Poltronas'],['bed','Cama / Quarto'],['lamp','Iluminação'],['refrigerator','Geladeiras'],['washingMachine','Lavanderia'],['microwave','Eletrodomésticos'],['fan','Climatização'],
 ['utensils','Alimentos'],['utensilsCrossed','Restaurante'],['coffee','Cafeteria'],['pizza','Pizzaria'],['chefHat','Cozinha'],['cookingPot','Panelas / Refeições'],['soup','Sopas'],['sandwich','Lanches'],['beef','Carnes'],['fish','Peixes'],['drumstick','Aves'],['milk','Laticínios'],['egg','Ovos'],['cherry','Frutas'],['banana','Hortifruti'],['citrus','Cítricos'],['grape','Uvas / Vinhos'],['carrot','Legumes'],['wheat','Grãos / Padaria'],['cake','Confeitaria'],['cookie','Biscoitos'],['candy','Doces'],['cup-soda','Refrigerantes'],['beer','Cervejas'],['wine','Vinhos'],['martini','Drinks'],['glassWater','Bebidas'],['snowflake','Gelo / Congelados'],
 ['dog','Cães'],['cat','Gatos'],['bird','Aves / Pet'],['rabbit','Pequenos animais'],['paw','Pet Shop'],['bone','Acessórios Pet'],
 ['car','Automotivo'],['truck','Caminhões / Logística'],['bus','Transporte'],['ship','Náutico'],['train','Ferroviário'],['plane','Viagens / Aviação'],['bike','Bicicletas'],['fuel','Combustíveis'],['battery','Baterias'],['gauge','Painel / Desempenho'],['mapPin','Localização'],
 ['leaf','Jardim'],['flower','Flores'],['sprout','Mudas'],['tree','Árvores'],['trees','Paisagismo'],['shovel','Jardinagem'],['tractor','Agrícola'],['mountain','Outdoor'],['tent','Camping'],
 ['heart','Beleza / Bem-estar'],['sparkles','Destaques / Estética'],['smile','Cuidados pessoais'],['scissors','Salão / Corte'],['paintbrush','Pintura'],['palette','Artes'],['sprayCan','Tintas / Spray'],
 ['stethoscope','Saúde'],['pill','Farmácia'],['heartPulse','Clínica'],['ambulance','Emergência'],['syringe','Vacinas / Insumos'],['baby','Bebê'],['dumbbell','Academia'],['trophy','Esportes'],['medal','Premiações'],
 ['book','Livros'],['bookOpen','Educação'],['notebook','Papelaria / Anotações'],['printer','Impressão'],['briefcase','Escritório'],['briefcaseBusiness','Serviços'],['factory','Indústria'],['warehouse','Estoque'],['building','Empresas / Prédios'],['school','Escola'],['graduation','Cursos'],['library','Biblioteca'],
 ['hammer','Ferramentas'],['wrench','Manutenção'],['ruler','Medição'],['construction','Construção'],['hardHat','Obras'],
 ['wallet','Financeiro'],['creditCard','Cartões'],['banknote','Dinheiro'],['coins','Moedas'],['piggyBank','Economia'],['landmark','Banco'],['badgeDollar','Preços'],['calculator','Cálculos'],['percent','Promoções'],
 ['key','Chaves'],['lock','Segurança'],['shield','Proteção'],['calendar','Eventos'],['calendarClock','Agendamentos'],['clock','Horários'],['gift','Presentes'],['music','Música'],['ticket','Ingressos'],['party','Festas'],
 ['flame','Velas / Energia'],['droplets','Líquidos'],['wind','Aromas / Ventilação'],['sun','Verão'],['moon','Noite'],['star','Favoritos'],['circle','Diversos']
];
const SIDEBAR_OPTIONAL_MENUS=[['produtos','Produtos'],['kits','Kits / Combos'],['clientes','Clientes'],['fornecedores','Fornecedores'],['estoque','Estoque'],['analise-estoque','Análise de Estoque'],['rentabilidade','Rentabilidade'],['metas-financeiras','Metas Financeiras'],['compras','Compras'],['financeiro','Compras e Financeiro'],['relatorios','Relatórios'],['fiscal','Fiscal'],['anotacoes','Anotações'],['backup','Backup'],['email','E-mails'],['ze-delivery','Zé Delivery'],['diagnostico','Diagnóstico'],['atividades','Atividades'],['ajuda','Ajuda'],['config','Configurações']];
const sidebarMenuSettingKey=id=>`sidebar_menu_${id}`;
const sidebarMenuEnabled=(settings,id)=>String(settings?.[sidebarMenuSettingKey(id)]??'1')!=='0';
const withSidebarMenuDefaults=settings=>{const next={...settings,ux_grouped_sidebar:settings?.ux_grouped_sidebar??'1',ux_mode:settings?.ux_mode??'compact'};for(const[id]of SIDEBAR_OPTIONAL_MENUS){const k=sidebarMenuSettingKey(id);if(next[k]===undefined||next[k]===null||next[k]==='')next[k]='1'}return next};
const categoryIconFor=(p)=>icons[p?.category_icon]||icons[p?.icon]||I.Package;
const DATA_REFRESH_EVENT='unipdv-data-refresh';
function dataChanged(){window.dispatchEvent(new Event(DATA_REFRESH_EVENT));}
function useDataRefresh(){const[v,setV]=useState(0);useEffect(()=>{const fn=()=>setV(x=>x+1);window.addEventListener(DATA_REFRESH_EVENT,fn);return()=>window.removeEventListener(DATA_REFRESH_EVENT,fn)},[]);return v}


class ScreenBoundary extends React.Component{constructor(p){super(p);this.state={error:null}}static getDerivedStateFromError(error){return{error}}componentDidCatch(error,info){this.props.onError?.(error,info)}render(){if(this.state.error)return <div className="errorbox"><I.TriangleAlert/><div><h3>Não foi possível carregar {this.props.name}</h3><p>{this.state.error.message||'Erro inesperado.'}</p><button onClick={()=>this.setState({error:null})}>Tentar novamente</button></div></div>;return this.props.children}}
function ErrorBoundary({children,name}){return <ScreenBoundary name={name}>{children}</ScreenBoundary>}
function Loading({children,loading}){return loading?<div className="loading"><I.LoaderCircle className="spin"/><span>Carregando...</span></div>:children}
function Modal({title,close,children,wide=false}){return createPortal(<div className="overlay ux-modal-overlay" role="dialog" aria-modal="true" aria-label={title}><div className={`modal ${wide?'wide':''}`}><div className="modalhead"><h2>{title}</h2><button className="iconbtn" onClick={close} aria-label="Fechar janela" title="Fechar"><I.X/></button></div>{children}</div></div>,document.body)}
function CurrencyInput({value,onChange,placeholder='R$ 0,00'}){const[raw,setRaw]=useState(priceText(value));useEffect(()=>setRaw(priceText(value)),[value]);return <input inputMode="decimal" value={raw} placeholder={placeholder} onChange={e=>setRaw(e.target.value)} onBlur={()=>{const c=centsFromInput(raw);onChange(c);setRaw(priceText(c))}}/>}
function PaymentMoneyInput({value,onChange}){const[raw,setRaw]=useState(priceText(value));useEffect(()=>setRaw(priceText(value)),[value]);return <input inputMode="decimal" value={raw} placeholder="R$ 0,00" onChange={e=>setRaw(e.target.value)} onBlur={()=>{const c=centsFromInput(raw);onChange(c);setRaw(priceText(c))}} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur()}}/>}


function selectNodeText(node){
 if(node==null||typeof node==='boolean')return '';
 if(typeof node==='string'||typeof node==='number')return String(node);
 if(Array.isArray(node))return node.map(selectNodeText).join('');
 if(React.isValidElement(node))return selectNodeText(node.props?.children);
 return '';
}
function flattenSelectOptions(children,group=null,out=[]){
 React.Children.forEach(children,child=>{
  if(child==null||typeof child==='boolean')return;
  if(React.isValidElement(child)){
   if(child.type===React.Fragment){flattenSelectOptions(child.props.children,group,out);return}
   if(child.type==='optgroup'){
    flattenSelectOptions(child.props.children,selectNodeText(child.props.label)||'',out);
    return;
   }
   if(child.type==='option'){
    const label=selectNodeText(child.props.children);
    const raw=child.props.value==null?label:child.props.value;
    out.push({
     value:String(raw??''),
     label,
     group,
     disabled:!!child.props.disabled
    });
   }
  }
 });
 return out;
}
function ThemedSelect({value,onChange,disabled=false,children,...rest}){
 const buttonRef=useRef(null),popupRef=useRef(null);
 const[open,setOpen]=useState(false),[popup,setPopup]=useState(null),[active,setActive]=useState(-1);
 const options=useMemo(()=>flattenSelectOptions(children),[children]);
 const currentValue=String(value??'');
 const selectedIndex=options.findIndex(x=>x.value===currentValue);
 const selected=selectedIndex>=0?options[selectedIndex]:options.find(x=>!x.disabled)||null;
 const firstEnabled=()=>options.findIndex(x=>!x.disabled);
 const moveActive=delta=>setActive(prev=>{
  if(!options.length)return -1;
  let i=prev>=0?prev:(selectedIndex>=0?selectedIndex:firstEnabled());
  for(let tries=0;tries<options.length;tries++){
   i=(i+delta+options.length)%options.length;
   if(!options[i]?.disabled)return i;
  }
  return prev;
 });
 const measure=()=>{
  const el=buttonRef.current;
  if(!el)return;
  const r=el.getBoundingClientRect(),cs=getComputedStyle(el),app=el.closest('.app'),acs=app?getComputedStyle(app):cs;
  const vw=window.innerWidth,vh=window.innerHeight;
  const left=Math.max(8,Math.min(r.left,vw-Math.max(220,r.width)-8));
  const width=Math.max(220,Math.min(Math.max(r.width,220),vw-16));
  const below=Math.max(0,vh-r.bottom-8),above=Math.max(0,r.top-8);
  const useAbove=below<190&&above>below;
  const maxHeight=Math.max(120,Math.min(420,useAbove?above:below||above||220));
  const top=useAbove?Math.max(8,r.top-maxHeight-4):Math.min(vh-maxHeight-8,r.bottom+4);
  setPopup({
   left,top,width,maxHeight,
   bg:cs.backgroundColor||'#0f1215',
   fg:cs.color||'#f5f7fa',
   border:cs.borderColor||'#30363e',
   accent:(acs.getPropertyValue('--accent')||'#d7a62c').trim(),
   panel:(acs.getPropertyValue('--panel2')||cs.backgroundColor||'#15191e').trim()
  });
 };
 const openMenu=()=>{
  if(disabled)return;
  setOpen(true);
  setActive(selectedIndex>=0?selectedIndex:firstEnabled());
  requestAnimationFrame(measure);
 };
 const closeMenu=()=>setOpen(false);
 const choose=opt=>{
  if(!opt||opt.disabled)return;
  const event={target:{value:opt.value},currentTarget:{value:opt.value}};
  onChange?.(event);
  setOpen(false);
  requestAnimationFrame(()=>buttonRef.current?.focus());
 };
 useEffect(()=>{
  if(!open)return;
  const outside=e=>{
   if(buttonRef.current?.contains(e.target)||popupRef.current?.contains(e.target))return;
   setOpen(false);
  };
  const onResize=()=>measure();
  const onScroll=()=>measure();
  document.addEventListener('pointerdown',outside,true);
  window.addEventListener('resize',onResize);
  window.addEventListener('scroll',onScroll,true);
  return()=>{
   document.removeEventListener('pointerdown',outside,true);
   window.removeEventListener('resize',onResize);
   window.removeEventListener('scroll',onScroll,true);
  };
 },[open,options.length,currentValue]);
 useEffect(()=>{if(disabled&&open)setOpen(false)},[disabled,open]);
 const onKeyDown=e=>{
  if(disabled)return;
  if(e.key==='ArrowDown'){e.preventDefault();if(!open)openMenu();else moveActive(1);return}
  if(e.key==='ArrowUp'){e.preventDefault();if(!open)openMenu();else moveActive(-1);return}
  if(e.key==='Enter'||e.key===' '){e.preventDefault();if(!open)openMenu();else if(active>=0)choose(options[active]);return}
  if(e.key==='Escape'&&open){e.preventDefault();closeMenu()}
 };
 const groups=[];
 let lastGroup=Symbol('initial');
 options.forEach((opt,index)=>{
  if(opt.group!==lastGroup){if(opt.group)groups.push({kind:'group',label:opt.group,key:`g-${opt.group}-${index}`});lastGroup=opt.group}
  groups.push({kind:'option',opt,index,key:`o-${index}-${opt.value}`});
 });
 const popupStyle=popup?{
  left:popup.left,top:popup.top,width:popup.width,maxHeight:popup.maxHeight,
  '--ts-bg':popup.bg,'--ts-fg':popup.fg,'--ts-border':popup.border,'--ts-accent':popup.accent,'--ts-panel':popup.panel
 }:undefined;
 return <span className={`themed-select${disabled?' disabled':''}${open?' open':''}`}>
  <button
   {...rest}
   ref={buttonRef}
   type="button"
   className="themed-select-button"
   disabled={disabled}
   role="combobox"
   aria-haspopup="listbox"
   aria-expanded={open}
   onClick={()=>open?closeMenu():openMenu()}
   onKeyDown={onKeyDown}
  ><span>{selected?.label||''}</span><I.ChevronDown aria-hidden="true"/></button>
  {open&&popup&&createPortal(<div ref={popupRef} className="themed-select-popup" style={popupStyle} role="listbox" onKeyDown={onKeyDown}>
   {groups.map(row=>row.kind==='group'
    ?<div className="themed-select-group" key={row.key}>{row.label}</div>
    :<button type="button" key={row.key} role="option" aria-selected={row.opt.value===currentValue} disabled={row.opt.disabled} className={`themed-select-option${row.opt.value===currentValue?' selected':''}${row.index===active?' active':''}`} onMouseEnter={()=>setActive(row.index)} onClick={()=>choose(row.opt)}>{row.opt.value===currentValue?<I.Check aria-hidden="true"/>:<span className="themed-select-checkspace"/>}<span>{row.opt.label}</span></button>
   )}
  </div>,document.body)}
 </span>;
}

const VIEW_MODE_OPTIONS={
 details:{label:'Detalhes',icon:I.ListChecks},
 list:{label:'Lista compacta',icon:I.List},
 blocks:{label:'Blocos',icon:I.LayoutGrid}
};
function useViewMode(scope,initial='details'){
 const[value,setValue]=useState(()=>{try{const saved=localStorage.getItem(`pdv:view:${scope}`);return VIEW_MODE_OPTIONS[saved]?saved:initial}catch{return initial}});
 const change=mode=>{if(!VIEW_MODE_OPTIONS[mode])return;setValue(mode);try{localStorage.setItem(`pdv:view:${scope}`,mode)}catch{}};
 return[value,change];
}
function ViewModeMenu({value,onChange,modes=['details','list','blocks']}){
 const[open,setOpen]=useState(false);
 const current=VIEW_MODE_OPTIONS[value]||VIEW_MODE_OPTIONS.details;
 const CurrentIcon=current.icon;
 return <span className="ux-view-menu"><button type="button" className="smallbtn ux-view-trigger" onClick={()=>setOpen(v=>!v)} title="Alterar visualização"><CurrentIcon/><span>Visualização</span><I.ChevronDown/></button>{open&&<span className="ux-view-popover">{modes.map(mode=>{const opt=VIEW_MODE_OPTIONS[mode],Icon=opt.icon;return <button type="button" key={mode} className={value===mode?'active':''} onClick={()=>{onChange(mode);setOpen(false)}}><Icon/><span>{opt.label}</span>{value===mode&&<I.Check/>}</button>})}</span>}</span>
}

function QuotePrintSheet({q,settings}){
 const pct=Number(q.discount_percent||0);
 return <div className="legacy-print-root">
  <style>{`@media screen{.legacy-print-root{display:none!important}}@media print{@page{size:A4 portrait;margin:14mm}html,body,#root{margin:0!important;padding:0!important;background:#fff!important;height:auto!important;overflow:visible!important}.app{display:block!important;min-height:0!important;background:#fff!important;height:auto!important;overflow:visible!important}.app>aside,.app>main>header,.toast{display:none!important}.app>main{display:block!important;width:100%!important;margin:0!important;padding:0!important;overflow:visible!important}.pagehost{display:block!important;margin:0!important;padding:0!important;overflow:visible!important}.pagehost>.pagehidden{display:none!important}.pagehost>.pagevisible{display:block!important}.quotespage>*{display:none!important}.quotespage>.legacy-print-root{display:block!important}.legacy-print-root{width:100%!important;color:#222!important;background:#fff!important;font-family:Arial,Helvetica,sans-serif!important;font-size:11px!important}.legacy-print-top{display:flex!important;justify-content:space-between!important;align-items:flex-start!important;border-bottom:2px solid #222!important;padding-bottom:12px!important;margin-bottom:16px!important}.legacy-print-brand{display:flex!important;gap:12px!important;align-items:center!important}.legacy-print-logo{width:58px!important;height:58px!important;object-fit:contain!important}.legacy-print-store{font-size:18px!important;font-weight:700!important}.legacy-print-sub{color:#666!important;margin-top:3px!important}.legacy-print-number{text-align:right!important}.legacy-print-number strong{display:block!important;font-size:20px!important}.legacy-print-meta{display:grid!important;grid-template-columns:1fr 1fr!important;gap:8px!important;border:1px solid #ccc!important;padding:10px!important;margin-bottom:16px!important}.legacy-print-meta b{display:block!important;margin-bottom:3px!important}.legacy-print-meta span{color:#555!important}.legacy-print-table{width:100%!important;border-collapse:collapse!important}.legacy-print-table th,.legacy-print-table td{border:1px solid #ccc!important;padding:7px!important;text-align:left!important}.legacy-print-table th{background:#eee!important}.legacy-print-table td:nth-child(2),.legacy-print-table td:nth-child(3),.legacy-print-table td:nth-child(4){text-align:right!important}.legacy-print-totals{margin-left:auto!important;width:300px!important;margin-top:14px!important}.legacy-print-totals div{display:flex!important;justify-content:space-between!important;padding:5px 0!important}.legacy-print-grand{font-size:16px!important;font-weight:700!important;border-top:2px solid #222!important;margin-top:4px!important;padding-top:8px!important}.legacy-print-note{border:1px solid #ddd!important;padding:10px!important;margin-top:14px!important;white-space:pre-wrap!important}.legacy-print-valid{margin-top:12px!important;color:#555!important}.legacy-print-foot{margin-top:28px!important;padding-top:10px!important;border-top:1px solid #ddd!important;color:#666!important;font-size:9px!important;text-align:center!important}}`}</style>
  <div className="legacy-print-top"><div className="legacy-print-brand"><img className="legacy-print-logo" src={settings.logo_data||appLogo} alt="Logo"/><div><div className="legacy-print-store">{settings.store_name||'Uni-PDV'}</div>{settings.company_phone&&<div className="legacy-print-sub">Telefone: {settings.company_phone}</div>}{settings.company_cnpj&&<div className="legacy-print-sub">CNPJ: {settings.company_cnpj}</div>}{settings.company_address&&<div className="legacy-print-sub">{settings.company_address}</div>}</div></div><div className="legacy-print-number"><div>ORÇAMENTO</div><strong>#{q.number}</strong><div>Emitido em {fmtDateOnly(q.created_at)}</div></div></div>
  <div className="legacy-print-meta"><div><b>Cliente</b><span>{q.customer_name||'Cliente não informado'}</span></div><div><b>Telefone</b><span>{q.customer_phone||'—'}</span></div><div><b>Endereço</b><span>{q.customer_address||'—'}</span></div><div><b>Validade</b><span>{fmtDateOnly(q.valid_until)}</span></div></div>
  <table className="legacy-print-table"><thead><tr><th>Produto / Item</th><th>Qtd.</th><th>Valor unitário</th><th>Total</th></tr></thead><tbody>{(q.items||[]).length?(q.items||[]).map(i=><tr key={i.id}><td>{i.name}{i.mix_items?.length&&String(i.sale_mode||'').startsWith('MIX_')?<><br/><small>{i.mix_items.map(x=>String(i.sale_mode).startsWith('MIX_VOLUME_')?`${x.name} · ${volumeLabel(x.volume_ml)}`:`${x.quantity} ${x.name} · ${weightLabel(x.weight_grams||0)}`).join(' · ')}</small></>:null}</td><td>{isWeightLikeMode(i.sale_mode)?`${weightLabel(i.weight_grams)}${Number(i.unit_count||0)>0?` · ${Number(i.unit_count)} un.`:''}`:isVolumeLikeMode(i.sale_mode)?volumeLabel(i.volume_ml):i.quantity}</td><td>{brl(i.unit_price_cents)}{isWeightLikeMode(i.sale_mode)?'/kg':isVolumeLikeMode(i.sale_mode)?(String(i.sale_mode).endsWith('_L')?'/L':'/ml'):''}</td><td>{brl(i.total_cents)}</td></tr>):<tr><td colSpan="4">Nenhum item.</td></tr>}</tbody></table>
  <div className="legacy-print-totals"><div><span>Subtotal</span><b>{brl(q.subtotal_cents)}</b></div>{Number(q.discount_cents)>0&&<div><span>Desconto{pct>0?` (${pct.toLocaleString('pt-BR',{maximumFractionDigits:2})}%)`:''}</span><b>- {brl(q.discount_cents)}</b></div>}{Number(q.delivery_cents)>0&&<div><span>Entrega</span><b>+ {brl(q.delivery_cents)}</b></div>}<div className="legacy-print-grand"><span>Total do orçamento</span><b>{brl(q.total_cents)}</b></div></div>
  {q.notes&&<div className="legacy-print-note"><b>Observações</b><br/>{q.notes}</div>}
  <div className="legacy-print-valid">Validade deste orçamento: {fmtDateOnly(q.valid_until)}. Este documento é um orçamento e não representa uma venda realizada.</div>
  <div className="legacy-print-foot">{settings.store_name||'Uni-PDV'} · Orçamento #{q.number}</div>
 </div>;
}

function QuoteWeightModal({product,initialWeightGrams=0,initialUnitCount=0,close,confirm,notify}){
 const initialWeight=initialWeightGrams>0?gramsToKg(initialWeightGrams):'1,000';
 const[weightText,setWeightText]=useState(initialWeight),[unitsText,setUnitsText]=useState(()=>String(initialUnitCount>0?initialUnitCount:Math.max(0,Math.round((kgInputToGrams(initialWeight)/1000)*Number(product.default_units_per_kg||0))))),[unitsTouched,setUnitsTouched]=useState(initialUnitCount>0);
 const grams=kgInputToGrams(weightText),suggested=Math.max(0,Math.round((grams/1000)*Number(product.default_units_per_kg||0))),units=Math.max(0,Math.round(Number(unitsText||0))),total=Math.round(Number(product.price_cents||0)*grams/1000);
 useEffect(()=>{if(!unitsTouched)setUnitsText(String(suggested))},[grams,suggested,unitsTouched]);
 const done=()=>{if(grams<=0)return notify('Informe um peso maior que zero para o orçamento.');confirm(product,grams,units);close()};
 return <Modal wide title={`Peso estimado · ${product.name}`} close={close}><p className="muted">No orçamento o peso é uma estimativa e não baixa estoque. Ao converter em venda, o PDV exigirá uma nova pesagem antes do pagamento.</p><div className="scale-weigh-grid"><div className="scale-reading-card"><I.Scale/><span>Peso estimado</span><strong>{weightLabel(grams)}</strong><small>Preço: {brl(product.price_cents)}/kg</small></div><div className="scale-reading-card total"><I.CircleDollarSign/><span>Valor estimado</span><strong>{brl(total)}</strong><small>Sem movimentar estoque</small></div><div className="scale-reading-card net"><I.Boxes/><span>Unidades estimadas</span><strong>{units} un.</strong><small>{Number(product.track_unit_stock||0)===1?'Estoque unitário do próprio produto':product.linked_unit_product_id?(product.linked_unit_name||'Produto unitário vinculado'):'Quantidade informativa'}</small></div></div><div className="formgrid"><label>Peso estimado (kg)<input autoFocus inputMode="decimal" value={weightText} onChange={e=>setWeightText(e.target.value)} placeholder="1,000"/></label><label>Quantidade de unidades<input inputMode="numeric" type="number" min="0" step="1" value={unitsText} onChange={e=>{setUnitsTouched(true);setUnitsText(e.target.value)}}/><small className="muted">Sugestão: {suggested} un. {Number(product.default_units_per_kg||0)>0?`(${Number(product.default_units_per_kg)} un./kg)`:''}. Pode ser ajustada manualmente.</small></label></div><div className="modalactions"><button onClick={close}>Cancelar</button><button className="primary" onClick={done}><I.Plus/> Usar no orçamento</button></div></Modal>
}

function Orcamentos({settings,notify}){
 const[products,setProducts]=useState([]),[allProducts,setAllProducts]=useState([]),[cats,setCats]=useState([]),[kits,setKits]=useState([]),[customers,setCustomers]=useState([]),[quotes,setQuotes]=useState([]),[cart,setCart]=useState([]),[customer,setCustomer]=useState(null),[customerPicker,setCustomerPicker]=useState(false),[q,setQ]=useState(''),[cat,setCat]=useState(null),[showKits,setShowKits]=useState(false),[validUntil,setValidUntil]=useState(''),[discountPct,setDiscountPct]=useState(0),[deliveryCents,setDeliveryCents]=useState(0),[notes,setNotes]=useState(''),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[statusFilter,setStatusFilter]=useState('ABERTO'),[printQuote,setPrintQuote]=useState(null),[quoteWeight,setQuoteWeight]=useState(null),[quoteMix,setQuoteMix]=useState(null),[quoteVolume,setQuoteVolume]=useState(null),[quoteVolumeMix,setQuoteVolumeMix]=useState(null),[editingQuote,setEditingQuote]=useState(null);
 const refresh=useDataRefresh();
 const[quoteView,setQuoteView]=useViewMode('orcamentos','details');
 const load=async()=>{setLoading(true);try{const[a,b,c,d,e,all]=await Promise.all([window.api.products.list(q,cat),window.api.categories.list(),window.api.customers.list(),window.api.quotes.list(),window.api.kits.list(null),window.api.products.list('')]);setProducts(a);setAllProducts(all||[]);setCats(b.filter(x=>x.name!=='Kits / Combos'));setCustomers(c);setQuotes(d);setKits(e)}catch(e){notify(e)}finally{setLoading(false)}};
 useEffect(()=>{load()},[q,cat,refresh]);
 useEffect(()=>{if(!validUntil){const d=new Date();d.setDate(d.getDate()+7);setValidUntil(d.toISOString().slice(0,10))}},[]);
 useEffect(()=>{if(!printQuote)return;let cancelled=false;const run=async()=>{await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const img=document.querySelector('.legacy-print-logo');if(img&&!img.complete)await Promise.race([new Promise(resolve=>{const done=()=>resolve();img.addEventListener('load',done,{once:true});img.addEventListener('error',done,{once:true})}),new Promise(resolve=>setTimeout(resolve,1000))]);if(cancelled)return;try{window.print()}catch(e){notify(e)}finally{if(!cancelled)setTimeout(()=>setPrintQuote(null),0)}};run();return()=>{cancelled=true}},[printQuote]);
 const filteredQuotes=useMemo(
  ()=>statusFilter==='TODOS'
    ? quotes
    : quotes.filter(x=>x.status===statusFilter),
  [quotes,statusFilter]
);
 const visibleKits=useMemo(()=>{const term=q.trim().toLocaleLowerCase('pt-BR');return term?kits.filter(k=>String(k.name||'').toLocaleLowerCase('pt-BR').includes(term)||String(k.sku||'').toLocaleLowerCase('pt-BR').includes(term)):kits},[kits,q]);
 const subtotal=cart.reduce((s,i)=>s+cartItemTotal(i),0);const discountPercent=Math.min(100,Math.max(0,Number(discountPct||0)));const disc=Math.min(subtotal,Math.round(subtotal*discountPercent/100));const delivery=Math.max(0,Number(deliveryCents||0));const total=subtotal-disc+delivery;
 const add=p=>{if(String(p.sale_mode||'UNIT')==='WEIGHT'){setQuoteWeight({product:p,editId:null,weight_grams:0,unit_count:0});return}if(isVolumeLikeMode(p.sale_mode)){setQuoteVolume({product:p,editId:null,volume_ml:0});return}setCart(c=>{const found=c.find(x=>x.product_id===p.id&&!x.kit_id);return found?c.map(x=>x.product_id===p.id&&!x.kit_id?{...x,qty:x.qty+1}:x):[...c,{id:`p${p.id}`,product_id:p.id,kit_id:null,name:p.name,price_cents:p.price_cents,qty:1,sale_mode:'UNIT'}]})};
 const applyWeight=(product,grams,units)=>{const editId=quoteWeight?.editId;setCart(c=>{if(editId)return c.map(x=>x.id===editId?{...x,weight_grams:grams,unit_count:units,default_units_per_kg:product.default_units_per_kg||0,linked_unit_product_id:product.linked_unit_product_id||null,linked_unit_name:product.linked_unit_name||'',sale_mode:'WEIGHT',qty:1}:x);const id=`p${product.id}`,found=c.find(x=>x.id===id);if(found&&found.sale_mode==='WEIGHT')return c.map(x=>x.id===id?{...x,weight_grams:Number(x.weight_grams||0)+grams,unit_count:Number(x.unit_count||0)+units}:x);return[...c,{id,product_id:product.id,kit_id:null,name:product.name,price_cents:product.price_cents,qty:1,sale_mode:'WEIGHT',weight_grams:grams,unit_count:units,default_units_per_kg:product.default_units_per_kg||0,linked_unit_product_id:product.linked_unit_product_id||null,linked_unit_name:product.linked_unit_name||''}]})};
 const editWeight=i=>setQuoteWeight({product:i,editId:i.id,weight_grams:Number(i.weight_grams||0),unit_count:Number(i.unit_count||0)});
 const applyQuoteVolume=(product,ml)=>{const editId=quoteVolume?.editId;const row={id:editId||`v${product.id}`,product_id:product.id,kit_id:null,name:product.name,price_cents:Number(product.price_cents||0),qty:1,sale_mode:product.sale_mode,volume_ml:Number(ml||0)};setCart(c=>editId?c.map(x=>x.id===editId?row:x):[...c,row])};
 const applyQuoteVolumeMix=(mix,ml,items)=>{const editId=quoteVolumeMix?.editId;const row={id:editId||`vm${mix.id}`,product_id:null,kit_id:Number(mix.id),name:mix.name,price_cents:Number(mix.price_cents||0),qty:1,sale_mode:mix.kit_type,volume_ml:Number(ml||0),mix_items:items||[],mix_category_id:mix.mix_category_id||null,volume_product_id:mix.volume_product_id||null};setCart(c=>editId?c.map(x=>x.id===editId?row:x):[...c,row])};
 const editQuoteVolume=i=>setQuoteVolume({product:{...i,sale_mode:i.sale_mode,price_cents:i.price_cents},editId:i.id,volume_ml:Number(i.volume_ml||0)});
 const editQuoteVolumeMix=i=>setQuoteVolumeMix({mix:kits.find(k=>Number(k.id)===Number(i.kit_id))||{...i,kit_type:i.sale_mode},editId:i.id,volume_ml:Number(i.volume_ml||0),mix_items:i.mix_items||[]});
 const applyQuoteMix=(mix,grams,items)=>{const normalized=(items||[]).map(x=>({product_id:Number(x.product_id),name:x.name||'',quantity:Math.max(0,Math.round(Number(x.quantity||0))),weight_grams:Math.max(0,Math.round(Number(x.weight_grams||0)))})).filter(x=>x.product_id&&x.quantity>0&&x.weight_grams>0);const unitCount=normalized.reduce((sum,x)=>sum+x.quantity,0),totalWeight=normalized.reduce((sum,x)=>sum+x.weight_grams,0),editId=quoteMix?.editId,id=editId||`m${mix.id}`;const row={id,product_id:null,kit_id:Number(mix.id),name:mix.name,price_cents:Number(mix.price_cents||0),qty:1,sale_mode:'MIX_WEIGHT',weight_grams:totalWeight,unit_count:unitCount,mix_items:normalized,mix_category_id:mix.mix_category_id||null,mix_category_name:mix.mix_category_name||'',weight_product_id:mix.weight_product_id||null};setCart(c=>editId?c.map(x=>x.id===editId?row:x):[...c,row])};
 const addKit=k=>{if(['MIX_VOLUME_L','MIX_VOLUME_ML'].includes(String(k.kit_type||''))){const existing=cart.find(x=>x.sale_mode===k.kit_type&&Number(x.kit_id)===Number(k.id));setQuoteVolumeMix({mix:k,editId:existing?.id||null,volume_ml:Number(existing?.volume_ml||0),mix_items:existing?.mix_items||[]});return}if(String(k.kit_type||'STANDARD')==='MIX_WEIGHT'){const existing=cart.find(x=>x.sale_mode==='MIX_WEIGHT'&&Number(x.kit_id)===Number(k.id));setQuoteMix({mix:k,editId:existing?.id||null,weight_grams:Number(existing?.weight_grams||0),mix_items:existing?.mix_items||[]});return}setCart(c=>{const found=c.find(x=>x.kit_id===k.id);return found?c.map(x=>x.kit_id===k.id?{...x,qty:x.qty+1}:x):[...c,{id:`k${k.id}`,product_id:null,kit_id:k.id,name:k.name,price_cents:k.price_cents,qty:1,sale_mode:'UNIT'}]})};
 const remove=id=>setCart(c=>c.filter(x=>x.id!==id));
 const resetEditor=()=>{setCart([]);setCustomer(null);setDiscountPct(0);setDeliveryCents(0);setNotes('');setEditingQuote(null);const d=new Date();d.setDate(d.getDate()+7);setValidUntil(d.toISOString().slice(0,10));setQuoteWeight(null);setQuoteMix(null);setQuoteVolume(null);setQuoteVolumeMix(null)};
 const startEditQuote=async id=>{try{const detail=await window.api.quotes.detail(id);if(detail.status==='CONVERTIDO')throw new Error('Orçamentos convertidos em venda não podem ser editados.');const rows=(detail.items||[]).map(i=>{const product=allProducts.find(p=>Number(p.id)===Number(i.product_id));return{id:`qi${i.id}`,product_id:i.product_id||null,kit_id:i.kit_id||null,name:i.name,price_cents:Number(i.unit_price_cents||0),qty:Number(i.quantity||1),sale_mode:i.sale_mode||'UNIT',weight_grams:Number(i.weight_grams||0),volume_ml:Number(i.volume_ml||0),unit_count:Number(i.unit_count||0),linked_unit_product_id:i.linked_unit_product_id||product?.linked_unit_product_id||null,linked_unit_name:product?.linked_unit_name||'',default_units_per_kg:Number(product?.default_units_per_kg||0),mix_items:i.mix_items||[]}});setCart(rows);setCustomer(customers.find(c=>Number(c.id)===Number(detail.customer_id))||(detail.customer_id?{id:detail.customer_id,name:detail.customer_name||'Cliente'}:null));setValidUntil(detail.valid_until||'');setDiscountPct(Number(detail.discount_percent||0));setDeliveryCents(Number(detail.delivery_cents||0));setNotes(detail.notes||'');setEditingQuote({id:Number(detail.id),number:Number(detail.number),status:detail.status});window.scrollTo({top:0,behavior:'smooth'});notify(`Orçamento #${detail.number} carregado para edição.`)}catch(e){notify(e)}};
 const save=async()=>{try{if(!cart.length)throw new Error('Adicione pelo menos um produto ou Kit / Combo ao orçamento.');setSaving(true);const payload={items:cart.map(i=>({product_id:i.product_id||null,kit_id:i.kit_id||null,name:i.name,quantity:i.qty,unit_price_cents:i.price_cents,sale_mode:i.sale_mode||'UNIT',weight_grams:i.weight_grams||0,unit_count:i.unit_count||0,linked_unit_product_id:i.linked_unit_product_id||null,mix_items:i.mix_items||[],volume_ml:i.volume_ml||0})),customer_id:customer?.id||null,valid_until:validUntil||null,discount_percent:discountPercent,delivery_cents:delivery,notes,operator:settings.operator||'Caixa'};const saved=editingQuote?await window.api.quotes.update(editingQuote.id,payload):await window.api.quotes.create(payload);const wasEditing=!!editingQuote;resetEditor();await load();dataChanged();notify(wasEditing?`Orçamento #${saved.number} atualizado com sucesso.`:`Orçamento #${saved.number} salvo com sucesso.`)}catch(e){notify(e)}finally{setSaving(false)}};
 const pdf=async id=>{try{const path=await window.api.quotes.pdf(id);if(path)notify(`PDF do orçamento salvo em: ${path}`)}catch(e){notify(e)}};
 const print=async id=>{try{setPrintQuote(await window.api.quotes.detail(id))}catch(e){notify(e)}};const markFailed=async id=>{
  try{
    await window.api.quotes.setStatus(id,'INSUCESSO');
    await load();
    notify('Orçamento marcado como insucesso.');
  }catch(e){
    notify(e);
  }
};const convertToSale=id=>{
  window.dispatchEvent(
    new CustomEvent('quote-to-sale',{
      detail:{id:Number(id)}
    })
  );
};
 const del=async id=>{if(!confirm('Excluir este orçamento?'))return;try{await window.api.quotes.delete(id);await load();notify('Orçamento excluído.')}catch(e){notify(e)}};
 return <div className="quotespage"><div className="toolbar"><div><h2>{editingQuote?`Editar orçamento #${editingQuote.number}`:'Novo orçamento'}</h2><p className="muted">{editingQuote?'Inclua, remova ou altere itens sem criar outro orçamento. O número original será preservado.':'Monte o orçamento com produtos e Kits / Combos sem baixar estoque. O PDF pode ser enviado pelo WhatsApp ou outro aplicativo e também impresso em A4.'}</p><small className="muted">Produtos por kg podem entrar com peso e quantidade de unidades estimados. Ao converter em venda, a pesagem real precisa ser confirmada.</small></div>{editingQuote&&<button className="smallbtn" onClick={resetEditor}><I.X/> Cancelar edição</button>}</div>
  <div className="quoteeditor"><section className="panel quotecatalog"><div className="search"><I.Search/><input placeholder="Buscar produto, código ou Kit / Combo..." value={q} onChange={e=>setQ(e.target.value)}/></div><div className="categorystrip"><button className={!showKits&&!cat?'cat active':'cat'} onClick={()=>{setShowKits(false);setCat(null)}}><I.LayoutGrid/><span>Todos</span></button><button className={showKits?'cat active':'cat'} onClick={()=>{setShowKits(true);setCat(null)}}><I.Layers/><span>Kits / Combos</span></button>{cats.map(c=>{const Icon=icons[c.icon]||I.Package;return <button className={!showKits&&String(cat)===String(c.id)?'cat active':'cat'} key={c.id} onClick={()=>{setShowKits(false);setCat(String(cat)===String(c.id)?null:c.id)}}><Icon/><span>{c.name}</span></button>})}</div><Loading loading={loading}><div className="quoteproductgrid">{!showKits&&products.map(p=><button className="productcard" key={p.id} onClick={()=>add(p)}><div className="pcicon">{React.createElement(categoryIconFor(p))}</div><div className="pname">{p.name}</div><small>{p.category||'Diversos'}{p.sale_mode==='WEIGHT'?` · ${stockLabel(p)}`:''}</small><strong>{brl(p.price_cents)}{p.sale_mode==='WEIGHT'?<em>/kg</em>:p.sale_mode==='VOLUME_L'?<em>/L</em>:p.sale_mode==='VOLUME_ML'?<em>/ml</em>:null}</strong>{p.sale_mode==='WEIGHT'?<span className="product-weight-badge"><I.Scale/> peso estimado</span>:isVolumeLikeMode(p.sale_mode)?<span className="product-weight-badge"><I.Beaker/> volume</span>:null}</button>)}{showKits&&visibleKits.map(k=><button className="productcard kitcard" key={`kit-${k.id}`} onClick={()=>addKit(k)}><div className="pcicon"><I.Layers/></div><div className="pname">{k.name}</div><small>Kit / Combo{k.sku?` • ${k.sku}`:''}</small><strong>{brl(k.price_cents)}{k.kit_type==='MIX_VOLUME_L'?<em>/L</em>:k.kit_type==='MIX_VOLUME_ML'?<em>/ml</em>:k.kit_type==='MIX_WEIGHT'?<em>/kg</em>:null}</strong></button>)}{!showKits&&!products.length&&<div className="empty compact"><I.Package/><p>Nenhum produto encontrado.</p></div>}{showKits&&!visibleKits.length&&<div className="empty compact"><I.Layers/><p>Nenhum Kit / Combo encontrado.</p></div>}</div></Loading></section>
  <section className="panel quotecart"><div className="paneltitle"><h2>Orçamento atual</h2><span>{cart.reduce((n,x)=>n+(isWeightLikeMode(x.sale_mode)?1:Number(x.qty||0)),0)} item(ns)</span></div><div className="quoteform"><div className="selectionrow"><button className="selectorbtn" onClick={()=>setCustomerPicker(true)}><I.UserRoundSearch/><span>{customer?customer.name:'Escolher cliente (opcional)'}</span></button>{customer&&<button className="clearbtn" onClick={()=>setCustomer(null)}>×</button>}</div><label>Validade<input type="date" value={validUntil} onChange={e=>setValidUntil(e.target.value)}/></label></div><div className="quotecartlist">{cart.length?cart.map(i=><div className="cartrow" key={i.id}><div><b>{i.name}</b>{i.sale_mode==='WEIGHT'?<small>{weightLabel(i.weight_grams)} × {brl(i.price_cents)}/kg{Number(i.unit_count||0)>0?` · ${Number(i.unit_count)} un. estimadas`:''}</small>:String(i.sale_mode||'').startsWith('MIX_VOLUME_')?<><small>{volumeLabel(i.volume_ml)} × {brl(i.price_cents)}/{String(i.sale_mode).endsWith('_L')?'L':'ml'} · {(i.mix_items||[]).length} componente(s)</small><small>{(i.mix_items||[]).map(x=>x.name+' · '+volumeLabel(x.volume_ml)).join(' · ')}</small></>:['VOLUME_L','VOLUME_ML'].includes(String(i.sale_mode||''))?<small>{volumeLabel(i.volume_ml)} × {brl(i.price_cents)}/{i.sale_mode==='VOLUME_L'?'L':'ml'}</small>:i.sale_mode==='MIX_WEIGHT'?<><small>{weightLabel(i.weight_grams)} × {brl(i.price_cents)}/kg · {Number(i.unit_count||0)} un. · {(i.mix_items||[]).length} cor(es)</small><small>{(i.mix_items||[]).map(x=>`${x.quantity} ${x.name} · ${weightLabel(x.weight_grams||0)}`).join(' · ')}</small></>:<small>{i.kit_id?'Kit / Combo · ':''}{brl(i.price_cents)} un.</small>}</div>{isVolumeLikeMode(i.sale_mode)?<div className="qty"><button className="smallbtn" onClick={()=>i.sale_mode.startsWith('MIX_VOLUME_')?editQuoteVolumeMix(i):editQuoteVolume(i)}><I.Beaker/> Alterar volume</button><button className="dangerlink" onClick={()=>remove(i.id)}>×</button></div>:i.sale_mode==='WEIGHT'?<div className="qty"><button className="smallbtn" onClick={()=>editWeight(i)}><I.Scale/> Alterar peso</button><button className="dangerlink" onClick={()=>remove(i.id)}>×</button></div>:i.sale_mode==='MIX_WEIGHT'?<div className="qty"><button className="smallbtn" onClick={()=>setQuoteMix({mix:kits.find(k=>Number(k.id)===Number(i.kit_id))||i,editId:i.id,weight_grams:i.weight_grams||0,mix_items:i.mix_items||[]})}><I.Scale/> Alterar Mix</button><button className="dangerlink" onClick={()=>remove(i.id)}>×</button></div>:<div className="qty"><button onClick={()=>setCart(c=>c.map(x=>x.id===i.id?{...x,qty:Math.max(1,x.qty-1)}:x))}>−</button><b>{i.qty}</b><button onClick={()=>setCart(c=>c.map(x=>x.id===i.id?{...x,qty:x.qty+1}:x))}>+</button><button className="dangerlink" onClick={()=>remove(i.id)}>×</button></div>}<strong>{brl(cartItemTotal(i))}</strong></div>):<div className="empty"><I.FileText/><p>Adicione produtos ou Kits / Combos para montar o orçamento.</p></div>}</div><div className="quotefoot"><label>Desconto (%)<div className="percentinput"><input type="number" min="0" max="100" step="0.01" inputMode="decimal" value={discountPct} onChange={e=>{const raw=String(e.target.value||'').replace(',','.');const n=Number(raw);setDiscountPct(raw===''?0:Math.min(100,Math.max(0,Number.isFinite(n)?n:0)))}} placeholder="0"/><span>%</span></div></label><label>Valor da entrega<CurrencyInput value={deliveryCents} onChange={setDeliveryCents} placeholder="R$ 0,00"/></label><label>Observações<textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Prazo, forma de entrega, condições, etc."/></label><div className="quotevalues"><span>Subtotal <b>{brl(subtotal)}</b></span><span>Desconto ({discountPercent.toLocaleString('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:2})}%) <b>- {brl(disc)}</b></span>{delivery>0&&<span>Entrega <b>+ {brl(delivery)}</b></span>}<strong>Total <b>{brl(total)}</b></strong></div><button className="primary big" disabled={!cart.length||saving} onClick={save}><I.Save/> {saving?'Salvando...':editingQuote?'Salvar alterações':'Salvar orçamento'}</button></div></section></div>
  <section className="panel"><div className="toolbar inline"><div><h2>Orçamentos salvos</h2><p className="muted">Acompanhe os orçamentos em aberto, convertidos em venda ou sem sucesso.</p></div>
<div className="actions">
  <button className={statusFilter==='ABERTO'?'smallbtn active':'smallbtn'} onClick={()=>setStatusFilter('ABERTO')}>Em aberto</button>
  <button className={statusFilter==='CONVERTIDO'?'smallbtn active':'smallbtn'} onClick={()=>setStatusFilter('CONVERTIDO')}>Convertidos</button>
  <button className={statusFilter==='INSUCESSO'?'smallbtn active':'smallbtn'} onClick={()=>setStatusFilter('INSUCESSO')}>Insucesso</button>
  <button className={statusFilter==='TODOS'?'smallbtn active':'smallbtn'} onClick={()=>setStatusFilter('TODOS')}>Todos</button>
  <ViewModeMenu value={quoteView} onChange={setQuoteView}/>
</div></div><div className={`table panel ux-collection ux-view-${quoteView}`}><table><thead><tr><th>Nº</th><th>Data</th><th>Cliente</th><th>Validade</th><th>Total</th><th>Status</th><th></th></tr></thead><tbody>{filteredQuotes.map(x=><tr key={x.id}><td data-label="Nº"><b>#{x.number}</b></td><td data-label="Data">{fmtDate(x.created_at)}</td><td data-label="Cliente">{x.customer_name||'—'}</td><td data-label="Validade">{x.valid_until?new Date(x.valid_until+'T12:00:00').toLocaleDateString('pt-BR'):'—'}</td><td data-label="Total" className="money">{brl(x.total_cents)}</td><td data-label="Status"><span className={`badge ${x.status==='INSUCESSO'?'danger':x.status==='CONVERTIDO'?'ok':'warn'}`}>{x.status}</span></td><td data-label="Ações" className="actions">
{x.status!=='CONVERTIDO'&&<button className="smallbtn" onClick={()=>startEditQuote(x.id)} title="Editar este orçamento mantendo o mesmo número"><I.Pencil/> Editar</button>}
{x.status==='ABERTO'&&
  <button
    className="smallbtn"
    onClick={()=>convertToSale(x.id)}
    title="Carregar este orçamento em Vendas"
  >
    <I.ShoppingCart/> Converter em venda
  </button>
}
  {x.status==='ABERTO'&&
    <button
      className="smallbtn"
      onClick={()=>markFailed(x.id)}
      title="Marcar como insucesso"
    >
      <I.X/> Insucesso
    </button>
  }<button className="smallbtn" onClick={()=>pdf(x.id)}><I.FileText/> PDF / WhatsApp</button><button className="smallbtn" onClick={()=>print(x.id)}><I.Printer/> A4</button>{x.status!=='CONVERTIDO'&&
  <button
    className="iconbtn"
    onClick={()=>del(x.id)}
    title="Excluir"
  >
    <I.Trash2/>
  </button>
}</td></tr>)}{!filteredQuotes.length&&<tr><td colSpan="7" className="muted">Nenhum orçamento salvo.</td></tr>}</tbody></table></div></section>{quoteWeight&&<QuoteWeightModal product={quoteWeight.product} initialWeightGrams={quoteWeight.weight_grams||0} initialUnitCount={quoteWeight.unit_count||0} close={()=>setQuoteWeight(null)} confirm={applyWeight} notify={notify}/>} {quoteVolume&&<VolumeEntryModal product={quoteVolume.product} close={()=>setQuoteVolume(null)} notify={notify} confirm={ml=>applyQuoteVolume(quoteVolume.product,ml)}/>} {quoteVolumeMix&&<MixVolumeModal mix={quoteVolumeMix.mix} products={allProducts} initialItems={quoteVolumeMix.mix_items||[]} close={()=>setQuoteVolumeMix(null)} notify={notify} confirm={(ml,items)=>applyQuoteVolumeMix(quoteVolumeMix.mix,ml,items)}/>} {quoteMix&&<MixWeightModal mix={quoteMix.mix} products={allProducts} estimate initialWeightGrams={quoteMix.weight_grams||0} initialMixItems={quoteMix.mix_items||[]} close={()=>setQuoteMix(null)} confirm={(grams,items)=>applyQuoteMix(quoteMix.mix,grams,items)} notify={notify}/>} {printQuote&&<QuotePrintSheet q={printQuote} settings={settings}/>} {customerPicker&&<CustomerPickerModal customers={customers} selected={customer} close={()=>setCustomerPicker(false)} choose={c=>{setCustomer(c);setCustomerPicker(false)}}/>}</div>;
}

function HelpTip({text}){const[open,setOpen]=useState(false);return <span className="help-tip"><button type="button" className="help-tip-button" title="Ajuda" onClick={()=>setOpen(v=>!v)}><I.CircleHelp/></button>{open&&<span className="help-tip-popover">{text}</span>}</span>}

function HomeDashboard({overview,go}){
 const o=overview||{};
 const agenda=(o.agenda||[]).slice(0,5);
 return <div className="ux-home">
  <div className="ux-welcome panel"><div><span className="eyebrow">VISÃO GERAL</span><h2>O que você precisa fazer agora?</h2><p className="muted">As ações mais usadas estão reunidas aqui para facilitar a rotina da loja.</p></div><button className="primary ux-main-action" onClick={()=>go('vendas')}><I.ShoppingCart/> Nova venda <span>F2</span></button></div>
  {!o.cash&&<button className="home-cash-closed" onClick={()=>go('caixa')}><I.LockKeyhole/><span><strong>CAIXA FECHADO</strong><small>Abra o caixa antes de registrar vendas.</small></span><b>Abrir caixa <I.ChevronRight/></b></button>}
  <div className="ux-home-cards">
   <button className={`ux-home-card ${o.cash?'ok':'warn'}`} onClick={()=>go('caixa')}><I.WalletCards/><span>Caixa</span><strong>{o.cash?'Aberto':'Fechado'}</strong><small>{o.cash?`Desde ${new Date(o.cash.opened_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}`:'Abra antes de vender'}</small></button>
   <button className="ux-home-card" onClick={()=>go('agenda')}><I.CalendarClock/><span>Agenda de hoje</span><strong>{(o.agenda||[]).length}</strong><small>compromisso(s) pendente(s)</small></button>
   <button className={`ux-home-card ${(o.lowStock||[]).length?'warn':''}`} onClick={()=>go('estoque')}><I.TriangleAlert/><span>Estoque mínimo</span><strong>{Number(o.lowStockCount??(o.lowStock||[]).length)}</strong><small>produto(s) no mínimo ou abaixo</small></button>
   <button className={`ux-home-card ${Number(o.debt?.n||0)>0?'warn':''}`} onClick={()=>go('clientes')}><I.HandCoins/><span>Clientes com dívida</span><strong>{Number(o.debt?.n||0)}</strong><small>{brl(o.debt?.total||0)} em aberto</small></button>
   <button className="ux-home-card" onClick={()=>go('orcamentos')}><I.FileText/><span>Orçamentos abertos</span><strong>{Number(o.openQuotes||0)}</strong><small>aguardando retorno</small></button>
   <button className="ux-home-card" onClick={()=>go('relatorios')}><I.ReceiptText/><span>Vendas de hoje</span><strong>{Number(o.sales?.count||0)}</strong><small>{brl(o.sales?.total||0)}</small></button>
  </div>
  <div className="ux-home-grid">
   <section className="panel ux-home-section"><div className="toolbar inline"><div><h2>Próximos compromissos</h2><p className="muted">Agenda de hoje em ordem de horário.</p></div><button className="smallbtn" onClick={()=>go('agenda')}>Abrir Agenda</button></div>{agenda.length?<div className="ux-agenda-mini">{agenda.map(a=><button key={`${a.agenda_source||'customer'}:${a.id}`} onClick={()=>go('agenda')}><b>{String(a.scheduled_at||'').slice(11,16)}</b><span>{a.customer_name}</span><small>{a.title}</small></button>)}</div>:<div className="ux-empty-inline"><I.CalendarCheck2/> Nenhum compromisso pendente hoje.</div>}</section>
   <section className="panel ux-home-section"><div className="toolbar inline"><div><h2>Segurança do sistema</h2><p className="muted">Informações que ajudam a manter o PDV protegido.</p></div></div><div className="ux-system-summary"><div><I.DatabaseBackup/><span>Último backup</span><b>{o.lastBackupAt?fmtDate(o.lastBackupAt):'Ainda não registrado'}</b></div><div><I.FileCheck2/><span>NFC-e pendentes</span><b>{Number(o.fiscalPending||0)}</b></div><button className="smallbtn" onClick={()=>go('diagnostico')}><I.Stethoscope/> Abrir diagnóstico</button></div></section>
  </div>
  <UniSmartInsights overview={o} go={go}/>
 </div>
}

function GlobalSearchBox({go}){const[q,setQ]=useState(''),[rows,setRows]=useState([]),[open,setOpen]=useState(false);useEffect(()=>{let live=true;const t=setTimeout(async()=>{if(q.trim().length<2){if(live)setRows([]);return}try{const r=await window.api.ux.search(q);if(live){setRows(r||[]);setOpen(true)}}catch{}},180);return()=>{live=false;clearTimeout(t)}},[q]);const choose=x=>{go(x.page);setQ('');setRows([]);setOpen(false)};return <div className="ux-global-search"><I.Search/><input value={q} onFocus={()=>q.length>=2&&setOpen(true)} onChange={e=>setQ(e.target.value)} placeholder="Pesquisar produto, cliente, venda ou orçamento..."/>{q&&<button className="ux-search-clear" onClick={()=>{setQ('');setRows([])}}><I.X/></button>}{open&&rows.length>0&&<div className="ux-search-results">{rows.map((x,i)=><button key={`${x.type}-${x.id}-${i}`} onClick={()=>choose(x)}><span className="ux-search-type">{x.type==='product'?'Produto':x.type==='customer'?'Cliente':x.type==='quote'?'Orçamento':'Venda'}</span><b>{x.title}</b><small>{x.subtitle}</small></button>)}</div>}</div>}

function NotificationPanel({rows,close,go}){return <div className="ux-notifications"><div className="ux-notifications-head"><div><b>Central de Notificações</b><small>Itens que merecem sua atenção</small></div><button className="iconbtn" onClick={close}><I.X/></button></div><div className="ux-notification-list">{rows.length?rows.map(n=><button key={n.id} className={`ux-notification ${n.kind||'info'}`} onClick={()=>{go(n.page);close()}}><span className="ux-notification-icon">{n.kind==='danger'?<I.CircleAlert/>:n.kind==='warning'?<I.TriangleAlert/>:n.kind==='ok'?<I.CircleCheck/>:<I.Info/>}</span><span><b>{n.title}</b><small>{n.message}</small></span><I.ChevronRight/></button>):<div className="ux-empty-inline"><I.CircleCheck/> Nenhuma pendência importante agora.</div>}</div></div>}

const HELP_TOPICS={
 inicio:['Início','Use esta tela para começar o dia. Ela mostra caixa, agenda, estoque mínimo, dívidas e orçamentos em aberto.'],
 vendas:['Vendas','Abra o caixa, escolha produtos, cliente quando necessário e operador. Depois clique em Pagamento. F10 também abre o pagamento quando já estiver nesta tela.'],
 caixa:['Caixa','Abra o caixa no início do expediente e feche ao terminar. O cancelamento de venda fica no fim desta tela, em uma área protegida.'],
 agenda:['Agenda','Clique em um dia para agendar serviços, recebimentos, entregas de vendas confirmadas ou rotinas internas como compras, contas e inventário.'],
 produtos:['Produtos','Cadastre produtos e use Categorias/Subcategorias para organizar. Estoque mínimo gera aviso ao abrir o sistema.'],
 kits:['Kits / Combos e Mix por Peso','Use Kit/Combo normal para composição fixa. Use Mix por Peso quando várias cores forem contadas individualmente e pesadas juntas; o preço é calculado por kg e cada cor baixa seu próprio estoque.'],
 estoque:['Estoque','Use Entrada e Saída para movimentos manuais. Produtos no mínimo ou abaixo ficam destacados e aparecem nas notificações.'],
 clientes:['Clientes','Cadastre PF/PJ e consulte o histórico. Vendas a prazo ficam vinculadas ao saldo do cliente.'],
 orcamentos:['Orçamentos','Monte sem baixar estoque. Orçamentos não convertidos podem ser editados mantendo o mesmo número; ao salvar uma revisão, um orçamento marcado como insucesso volta para Em aberto.'],
 fiscal:['Fiscal','Emita NFC-e somente após conferir os dados fiscais. Venda com NFC-e autorizada precisa ter o documento fiscal cancelado antes do cancelamento da venda.'],
 backup:['Backup','Mantenha o backup automático ativo e faça um manual antes de mudanças importantes.'],
 config:['Configurações','Aqui você escolhe o modo Essencial/Completo, sidebar e configura a balança eletrônica. Produtos por peso trabalham com preço por kg e estoque em gramas.']
};
function HelpCenter({page,go}){const topic=HELP_TOPICS[page]||['Central de Ajuda','Escolha uma das orientações abaixo.'];const cards=[['vendas','Como fazer uma venda',I.ShoppingCart],['caixa','Abrir e fechar o caixa',I.WalletCards],['clientes','Venda a prazo e clientes',I.Users],['agenda','Usar a Agenda',I.CalendarClock],['produtos','Cadastrar produtos',I.Package],['kits','Kit / Combo e Mix por Peso',I.Scale],['orcamentos','Criar e converter orçamento',I.FileText],['backup','Backup e segurança',I.DatabaseBackup],['fiscal','NFC-e',I.FileCheck2],['config','Balança eletrônica',I.Scale]];return <div className="ux-help"><section className="panel ux-help-current"><I.CircleHelp/><div><span className="eyebrow">AJUDA DESTA TELA</span><h2>{topic[0]}</h2><p>{topic[1]}</p></div></section><section className="ux-help-grid">{cards.map(([id,label,Icon])=><button className="panel" key={id} onClick={()=>go(id)}><Icon/><b>{label}</b><small>Ir para a função</small></button>)}</section><section className="panel"><h2>Fluxo básico para novos usuários</h2><div className="ux-help-steps"><span><b>1</b>Abrir o caixa</span><span><b>2</b>Fazer a venda</span><span><b>3</b>Escolher pagamento</span><span><b>4</b>Conferir Agenda/pendências</span><span><b>5</b>Fechar o caixa</span></div></section></div>}

function ZeDeliveryPage({settings,saved,notify}){
 const pick=x=>({ze_enabled:String(x.ze_enabled||'0'),ze_store_name:x.ze_store_name||'Jhonnie Beer',ze_store_code:x.ze_store_code||'',ze_environment:x.ze_environment||'production',ze_auto_accept:String(x.ze_auto_accept||'0'),ze_order_sound:String(x.ze_order_sound??'1'),ze_sync_products:String(x.ze_sync_products||'0'),ze_default_fulfillment:x.ze_default_fulfillment||'DELIVERY',ze_notes:x.ze_notes||''});
 const [s,setS]=useState(()=>pick(settings)),[saving,setSaving]=useState(false),[tab,setTab]=useState('overview');
 const [credentialStatus,setCredentialStatus]=useState({configured:false,clientIdHint:''}),[credentialLoading,setCredentialLoading]=useState(false),[credentialSaving,setCredentialSaving]=useState(false);
 const [clientId,setClientId]=useState(''),[clientSecret,setClientSecret]=useState(''),[showSecret,setShowSecret]=useState(false);
 const loadCredentialStatus=async()=>{try{setCredentialLoading(true);setCredentialStatus(await window.api.zeDelivery.credentialsStatus())}catch(e){notify(e)}finally{setCredentialLoading(false)}};
 useEffect(()=>{loadCredentialStatus()},[]);
 const saveCredentials=async()=>{if(!clientId.trim()||!clientSecret){notify('Informe o Client ID e o Client Secret.');return}try{setCredentialSaving(true);await window.api.zeDelivery.saveCredentials({clientId:clientId.trim(),clientSecret});setClientSecret('');setShowSecret(false);await loadCredentialStatus();notify('Credenciais do Zé Delivery armazenadas com proteção do Windows.')}catch(e){notify(e)}finally{setCredentialSaving(false)}};
 const removeCredentials=async()=>{if(!window.confirm('Remover as credenciais salvas do Zé Delivery deste computador?'))return;try{setCredentialSaving(true);await window.api.zeDelivery.deleteCredentials();setClientId('');setClientSecret('');await loadCredentialStatus();notify('Credenciais removidas deste computador.')}catch(e){notify(e)}finally{setCredentialSaving(false)}};
 useEffect(()=>setS(pick(settings)),[settings]);
 const update=(k,v)=>setS(x=>({...x,[k]:v}));
 const save=async()=>{try{setSaving(true);await window.api.settings.set(s);await saved();notify('Preferências do módulo Zé Delivery salvas.')}catch(e){notify(e)}finally{setSaving(false)}};
 const configured=!!credentialStatus.configured;
 return <div className="settings ze-delivery-page">
  <div className="panel ze-hero"><div className="ze-brand-icon"><I.Package/></div><div className="ze-hero-copy"><span className="compact-kicker">CANAL DE VENDAS • INTEGRAÇÃO</span><h2>Zé Delivery</h2><p>Centralize a preparação e o acompanhamento dos pedidos recebidos pelo canal Zé Delivery.</p></div><span className="badge warn">{configured?'CREDENCIAIS REGISTRADAS':'AGUARDANDO CREDENCIAIS'}</span></div>
  <div className="ze-tabs"><button className={tab==='overview'?'active':''} onClick={()=>setTab('overview')}><I.LayoutDashboard/> Visão geral</button><button className={tab==='settings'?'active':''} onClick={()=>setTab('settings')}><I.Settings/> Configurações</button><button className={tab==='orders'?'active':''} onClick={()=>setTab('orders')}><I.ClipboardList/> Pedidos</button><button className={tab==='catalog'?'active':''} onClick={()=>setTab('catalog')}><I.Package/> Produtos</button></div>
  {tab==='overview'&&<><div className="ze-stat-grid"><div className="panel ze-stat"><small>Conexão</small><b>Não conectada</b><span>Aguardando acesso oficial</span></div><div className="panel ze-stat"><small>Pedidos recebidos</small><b>—</b><span>Disponível após homologação</span></div><div className="panel ze-stat"><small>Última sincronização</small><b>—</b><span>Nenhuma sincronização realizada</span></div></div><div className="panel"><div className="toolbar inline"><div><h3>Preparação da integração</h3><p className="muted">A seção já está disponível para configurar o comportamento do canal. A comunicação real será ativada quando forem fornecidos os dados oficiais e o contrato técnico da integração.</p></div><I.Workflow/></div><div className="ze-checklist"><div><I.CheckCircle2/><span><b>Área própria no PDV</b><small>Menu, painel e configurações separados da Central de Notificações.</small></span><span className="badge ok">Pronto</span></div><div><I.CheckCircle2/><span><b>Preferências operacionais</b><small>Nome da loja, código, ambiente, alertas e regras iniciais.</small></span><span className="badge ok">Pronto</span></div><div><I.Clock3/><span><b>Autenticação e sincronização oficial</b><small>Depende das credenciais, documentação e autorização do Zé Delivery.</small></span><span className="badge warn">Pendente</span></div><div><I.Clock3/><span><b>Recebimento e atualização de pedidos</b><small>Será conectado ao fluxo de vendas/estoque após validar os eventos e regras da API.</small></span><span className="badge warn">Pendente</span></div></div></div></>}
  {tab==='settings'&&<div className="panel"><div className="toolbar inline"><div><h3>Configurações do canal</h3><p className="muted">Defina as preferências agora. Nenhuma conexão externa será iniciada nesta etapa.</p></div><I.SlidersHorizontal/></div><div className="formgrid"><label>Ativação do módulo<ThemedSelect value={s.ze_enabled} onChange={e=>update('ze_enabled',e.target.value)}><option value="0">Desativado</option><option value="1">Preparar para ativação</option></ThemedSelect></label><label>Ambiente pretendido<ThemedSelect value={s.ze_environment} onChange={e=>update('ze_environment',e.target.value)}><option value="production">Produção</option><option value="sandbox">Homologação / Sandbox (se disponibilizado)</option></ThemedSelect></label><label>Nome da loja<input value={s.ze_store_name} onChange={e=>update('ze_store_name',e.target.value)} placeholder="Jhonnie Beer"/></label><label>Código/identificador da loja<input value={s.ze_store_code} onChange={e=>update('ze_store_code',e.target.value)} placeholder="Será informado pelo Zé Delivery"/></label><label>Tipo padrão de atendimento<ThemedSelect value={s.ze_default_fulfillment} onChange={e=>update('ze_default_fulfillment',e.target.value)}><option value="DELIVERY">Entrega</option><option value="PICKUP">Retirada (se habilitada pelo canal)</option></ThemedSelect></label><label>Aceite automático de pedidos<ThemedSelect value={s.ze_auto_accept} onChange={e=>update('ze_auto_accept',e.target.value)}><option value="0">Não — confirmar manualmente</option><option value="1">Sim — somente após homologação</option></ThemedSelect></label><label>Alerta sonoro de novo pedido<ThemedSelect value={s.ze_order_sound} onChange={e=>update('ze_order_sound',e.target.value)}><option value="1">Ativado</option><option value="0">Desativado</option></ThemedSelect></label><label>Sincronização de catálogo<ThemedSelect value={s.ze_sync_products} onChange={e=>update('ze_sync_products',e.target.value)}><option value="0">Manual / revisar antes de enviar</option><option value="1">Preparar sincronização automática (após homologação)</option></ThemedSelect></label><label className="span2">Observações internas<textarea value={s.ze_notes} onChange={e=>update('ze_notes',e.target.value)} placeholder="Anotações sobre a configuração da loja..."/></label></div><div className="panel ze-credentials-panel"><div className="toolbar inline"><div><h3>Credenciais de integração</h3><p className="muted">Cadastre os dados fornecidos pelo portal/parceiro oficial do Zé Delivery quando estiverem disponíveis.</p></div><I.ShieldCheck/></div>
  <div className="ze-security-note"><I.LockKeyhole/><span><b>Armazenamento protegido neste Windows</b><small>Client ID e Client Secret são criptografados pelo Electron safeStorage e ficam fora do banco de preferências. O segredo nunca é devolvido à interface nem exibido após salvar.</small></span></div>
  <div className="formgrid"><label>Client ID<input autoComplete="off" spellCheck="false" value={clientId} onChange={e=>setClientId(e.target.value)} placeholder={credentialStatus.configured?'Informe para substituir o Client ID':'Cole aqui o Client ID quando receber'}/></label><label>Client Secret<div style={{display:'flex',gap:8}}><input style={{flex:1}} autoComplete="new-password" type={showSecret?'text':'password'} value={clientSecret} onChange={e=>setClientSecret(e.target.value)} placeholder="Informe o Client Secret para salvar ou substituir"/><button type="button" className="smallbtn" onClick={()=>setShowSecret(v=>!v)}>{showSecret?<I.EyeOff/>:<I.Eye/>}</button></div></label></div>
  <div className="ze-credential-status"><span className={credentialStatus.configured?'badge ok':'badge warn'}>{credentialLoading?'Verificando...':credentialStatus.configured?'Credenciais salvas neste computador':'Credenciais ainda não cadastradas'}</span>{credentialStatus.configured&&<small>Client ID: {credentialStatus.clientIdHint||'registrado'} · segredo oculto</small>}</div>
  <div className="modalactions"><button className="primary" disabled={credentialSaving||credentialLoading||!clientId.trim()||!clientSecret} onClick={saveCredentials}><I.Save/> {credentialSaving?'Salvando...':'Salvar credenciais'}</button>{credentialStatus.configured&&<button className="danger" disabled={credentialSaving} onClick={removeCredentials}><I.Trash2/> Remover credenciais</button>}</div>
  <p className="muted small">O teste de conexão será habilitado somente depois que a documentação oficial informar o endereço de autenticação, o fluxo OAuth e o ambiente autorizado. Nenhuma chamada externa é feita nesta etapa.</p>
 </div><div className="modalactions"><button className="primary" disabled={saving} onClick={save}><I.Save/> {saving?'Salvando...':'Salvar configurações'}</button></div></div>}
  {tab==='orders'&&<div className="panel"><div className="toolbar inline"><div><h3>Pedidos do Zé Delivery</h3><p className="muted">Caixa de entrada reservada para os pedidos do canal.</p></div><I.ClipboardList/></div><div className="empty"><I.PackageOpen/><p><b>Nenhum pedido sincronizado.</b></p><p>A listagem será alimentada pela integração oficial após autenticação e homologação. Não há pedidos fictícios ou dados de demonstração.</p></div></div>}
  {tab==='catalog'&&<div className="panel"><div className="toolbar inline"><div><h3>Vínculo de produtos</h3><p className="muted">Preparação para relacionar o catálogo do PDV aos itens publicados no Zé Delivery.</p></div><I.Tags/></div><div className="empty"><I.Package/><p><b>Catálogo ainda não sincronizado.</b></p><p>O mapeamento de SKU, identificadores externos, disponibilidade, preço e regras de estoque será habilitado quando o formato oficial do catálogo estiver confirmado.</p></div></div>}
 </div>
}

function DiagnosticsPage({notify}){const[data,setData]=useState(null),[loading,setLoading]=useState(true);const load=async()=>{setLoading(true);try{setData(await window.api.ux.diagnostics())}catch(e){notify(e)}finally{setLoading(false)}};useEffect(()=>{load()},[]);if(loading)return <Loading loading/>;const row=(ok,label,detail)=><div className={`ux-diag-row ${ok?'ok':'warn'}`}><span>{ok?<I.CircleCheck/>:<I.TriangleAlert/>}</span><div><b>{label}</b><small>{detail}</small></div></div>;return <div className="settings"><div className="panel"><div className="toolbar inline"><div><h2>Diagnóstico do sistema</h2><p className="muted">Verificação rápida para suporte e manutenção.</p></div><button className="smallbtn" onClick={load}><I.RefreshCw/> Atualizar</button></div>{row(data.database,'Banco de dados',data.database?`Integridade OK · ${data.userData}`:`Falha: ${data.databaseDetail}`)}{row(data.foreignKeyViolations===0,'Integridade dos vínculos',data.foreignKeyViolations===0?'Nenhuma violação de chave estrangeira':`${data.foreignKeyViolations} violação(ões) de chave estrangeira`)}{row(data.orphanSaleItems===0&&data.orphanSalePayments===0,'Consistência das vendas',data.orphanSaleItems===0&&data.orphanSalePayments===0?'Itens e pagamentos vinculados corretamente':`Itens sem venda: ${data.orphanSaleItems}; pagamentos sem venda: ${data.orphanSalePayments}`)}{row(data.invalidFinanceEntries===0,'Consistência financeira',data.invalidFinanceEntries===0?'Lançamentos com valor, tipo e situação válidos':`${data.invalidFinanceEntries} lançamento(s) com campos inválidos`)}{row(data.backupDirectoryExists,'Pasta de backup',data.backupDirectory)}{row(!!data.lastBackupAt,'Último backup',data.lastBackupAt?`${fmtDate(data.lastBackupAt)} · ${data.lastBackupPath}`:'Nenhum backup registrado nesta instalação')}{row(!data.lastBackupError,'Último erro de backup',data.lastBackupError||'Nenhuma falha de backup registrada')}{row(data.certificateConfigured&&data.certificateExists,'Certificado NFC-e',data.certificateConfigured?(data.certificateExists?'Arquivo localizado':'Arquivo configurado, mas não localizado'):'Não configurado')}{row(data.emailConfigured,'E-mail',data.emailConfigured?'Servidor configurado':'Não configurado')}{row(!data.scaleEnabled||data.scaleMode==='SIMULATION'||data.scaleLastStatus==='OK','Balança eletrônica',!data.scaleEnabled?'Desativada':data.scaleMode==='SIMULATION'?'Modo simulação/manual':data.scaleLastStatus==='OK'?`${data.scalePort} testada${data.scaleLastTestAt?` · ${fmtDate(data.scaleLastTestAt)}`:''}`:`${data.scalePort} · ${data.scaleLastError||'aguardando teste'}`)}{row(true,'Compatibilidade',`Versão ${data.version} · Electron ${data.electron} · Node ${data.node}`)}</div></div>}

const ACTIVITY_GROUP_LABELS={all:'Todas',cash:'Caixa',sales:'Vendas',products:'Produtos / Categorias',stock:'Estoque',system:'Sistema'};
function ActivityPage({notify}){
 const today=new Date().toISOString().slice(0,10);
 const[rows,setRows]=useState([]),[loading,setLoading]=useState(true),[mode,setMode]=useState('daily'),[date,setDate]=useState(today),[month,setMonth]=useState(today.slice(0,7)),[group,setGroup]=useState('all');
 const load=async()=>{setLoading(true);try{setRows(await window.api.activity.list({mode,date,month,group,limit:1500}))}catch(e){notify(e)}finally{setLoading(false)}};
 useEffect(()=>{load()},[mode,date,month,group]);
 const byDay=useMemo(()=>rows.reduce((acc,x)=>{const key=String(x.created_at||'').slice(0,10)||'Sem data';(acc[key]||(acc[key]=[])).push(x);return acc},{}),[rows]);
 const days=Object.keys(byDay).sort((a,b)=>b.localeCompare(a));
 return <div className="activitypage">
  <div className="panel">
   <div className="toolbar inline"><div><h2>Histórico de atividades</h2><p className="muted">Auditoria diária de caixa, vendas, produtos, categorias, estoque e ações administrativas. Valores financeiros são exibidos em Reais (R$).</p></div><button className="smallbtn" onClick={load}><I.RefreshCw/> Atualizar</button></div>
   <div className="reportfilters activityfilters"><button className={mode==='daily'?'smallbtn active':'smallbtn'} onClick={()=>setMode('daily')}>Diário</button><button className={mode==='monthly'?'smallbtn active':'smallbtn'} onClick={()=>setMode('monthly')}>Mensal</button>{mode==='daily'?<input type="date" value={date} onChange={e=>setDate(e.target.value)}/>:<input type="month" value={month} onChange={e=>setMonth(e.target.value)}/>}</div>
   <div className="ux-report-tabs activity-tabs">{Object.entries(ACTIVITY_GROUP_LABELS).map(([id,label])=><button key={id} className={group===id?'active':''} onClick={()=>setGroup(id)}>{label}</button>)}</div>
  </div>
  <Loading loading={loading}><div className="ux-activity-days">{days.length?days.map(day=><section className="panel ux-activity-day" key={day}><div className="ux-activity-day-head"><div><I.CalendarDays/><h3>{fmtDateOnly(day)}</h3></div><span>{byDay[day].length} atividade(s)</span></div><div className="ux-activity-list">{byDay[day].map(x=><div key={x.id}><span className="ux-activity-time">{fmtTime(x.created_at)}</span><div className="ux-activity-main"><b>{x.action}</b><small><span className={`activity-group group-${x.event_group||'system'}`}>{ACTIVITY_GROUP_LABELS[x.event_group]||'Sistema'}</span>{x.operator||'Sistema'}{x.entity_type?` · ${x.entity_type}${x.entity_id?` #${x.entity_id}`:''}`:''}</small>{x.details&&<p>{x.details}</p>}</div>{Number(x.amount_cents||0)>0&&<strong className="ux-activity-value">{brl(x.amount_cents)}</strong>}</div>)}</div></section>):<div className="panel ux-empty-inline">Nenhuma atividade encontrada no período e filtro selecionados.</div>}</div></Loading>
 </div>
}

function FirstUseGuide({close}){const steps=[['Abra o caixa','O sistema bloqueia vendas enquanto o caixa estiver fechado.'],['Faça uma venda','Adicione os produtos e escolha cliente/operador quando necessário.'],['Finalize o pagamento','Escolha dinheiro, PIX, débito, crédito ou venda a prazo.'],['Acompanhe a Agenda','Serviços, recebimentos, entregas e rotinas internas aparecem no calendário.'],['Observe os avisos','O sino reúne estoque mínimo, agenda, orçamentos e pendências fiscais.']];return <Modal wide title="Guia rápido do operador" close={close}><p className="muted">Este guia aparece somente na primeira utilização deste operador neste computador.</p><div className="ux-guide-steps">{steps.map((x,i)=><div key={x[0]}><b>{i+1}</b><span><strong>{x[0]}</strong><small>{x[1]}</small></span></div>)}</div><div className="modalactions"><button className="primary" onClick={close}>Entendi, começar</button></div></Modal>}

function StockOpeningAlert({items,count,close,go}){return <Modal wide title="Atenção ao estoque" close={close}><div className="ux-stock-alert"><I.TriangleAlert/><div><h3>{Number(count||items.length)} produto(s) atingiram o estoque mínimo</h3><p>Este aviso aparece uma vez a cada abertura do sistema, inclusive quando o estoque já estava abaixo do mínimo.</p></div></div><div className="ux-stock-list">{items.slice(0,12).map(x=><div key={x.id}><b>{x.name}</b><span className="badge warn">{stockLabel(x)} · mínimo {minStockLabel(x)}</span></div>)}{Number(count||items.length)>12&&<small className="muted">E mais {Number(count||items.length)-12} produto(s).</small>}</div><div className="modalactions"><button onClick={close}>Ver depois</button><button className="primary" onClick={()=>{close();go('estoque')}}><I.Warehouse/> Ir para Estoque</button></div></Modal>}


function MixVolumeModal({mix,products,close,confirm,notify,initialItems=[]}){
 const mode=String(mix.kit_type||'MIX_VOLUME_L'),[search,setSearch]=useState(''),[selected,setSelected]=useState(()=>new Map((initialItems||[]).map(x=>[Number(x.product_id),{product_id:Number(x.product_id),name:x.name||x.product_name||'',volume_text:mode==='MIX_VOLUME_L'?(Number(x.volume_ml||0)/1000).toLocaleString('pt-BR',{minimumFractionDigits:3,maximumFractionDigits:3}):String(x.volume_ml||'')}])));
 const eligible=(products||[]).filter(p=>['VOLUME_L','VOLUME_ML'].includes(String(p.sale_mode||'UNIT'))&&(!mix.mix_category_id||String(p.category_id)===String(mix.mix_category_id)||String(p.parent_id)===String(mix.mix_category_id))).filter(p=>!search||String(p.name||'').toLowerCase().includes(search.toLowerCase())||String(p.sku||'').toLowerCase().includes(search.toLowerCase()));
 const rows=Array.from(selected.values()).map(x=>{const p=(products||[]).find(p=>Number(p.id)===Number(x.product_id))||{};return {...x,name:x.name||p.name||'Produto',stock:Number(p.stock||0),volume_ml:volumeInputToMl(x.volume_text,mode)}});
 const totalMl=rows.reduce((s,x)=>s+Number(x.volume_ml||0),0),total=mode==='MIX_VOLUME_L'?Math.round(Number(mix.price_cents||0)*totalMl/1000):Math.round(Number(mix.price_cents||0)*totalMl);
 const add=p=>setSelected(prev=>{const n=new Map(prev);if(!n.has(Number(p.id)))n.set(Number(p.id),{product_id:Number(p.id),name:p.name,volume_text:''});return n});
 const setVolume=(id,v)=>setSelected(prev=>{const n=new Map(prev),x=n.get(Number(id));if(x)n.set(Number(id),{...x,volume_text:v});return n});
 const done=()=>{if(!rows.length)return notify('Selecione ao menos um produto com volume.');const invalid=rows.find(x=>x.volume_ml<=0||x.volume_ml>x.stock);if(invalid)return notify('Confira o volume de '+invalid.name+'. Disponível: '+volumeLabel(invalid.stock));confirm(totalMl,rows.map(x=>({product_id:x.product_id,name:x.name,volume_ml:x.volume_ml,quantity:1})));close()};
 return <Modal wide title={(mode==='MIX_VOLUME_L'?'Mix por Litro':'Mix por Mililitro')+' · '+mix.name} close={close}><p className="muted">Selecione os produtos líquidos que compõem o Mix e informe o volume utilizado de cada um. O estoque de cada produto será baixado em mililitros.</p><div className="scale-weigh-grid"><div className="scale-reading-card"><I.Beaker/><span>Volume total</span><strong>{volumeLabel(totalMl)}</strong><small>Soma dos componentes</small></div><div className="scale-reading-card total"><I.CircleDollarSign/><span>Valor calculado</span><strong>{brl(total)}</strong><small>{brl(mix.price_cents)}/{mode==='MIX_VOLUME_L'?'L':'ml'}</small></div></div><label>Buscar produto líquido<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nome, SKU ou código de barras"/></label><div className="actions" style={{flexWrap:'wrap',marginTop:8}}>{eligible.slice(0,30).map(p=><button type="button" className="smallbtn" key={p.id} onClick={()=>add(p)}>{p.name} · estoque {volumeLabel(p.stock)}</button>)}</div><div style={{display:'grid',gap:8,marginTop:12}}>{rows.map(x=><div className="panel" key={x.product_id} style={{display:'grid',gridTemplateColumns:'minmax(140px,1fr) 140px auto',gap:8,alignItems:'end'}}><b>{x.name}<small className="muted" style={{display:'block'}}>Disponível: {volumeLabel(x.stock)}</small></b><label style={{margin:0}}>{mode==='MIX_VOLUME_L'?'Volume (L)':'Volume (ml)'}<input inputMode="decimal" value={x.volume_text} onChange={e=>setVolume(x.product_id,e.target.value)} placeholder={mode==='MIX_VOLUME_L'?'0,250':'250'}/></label><button type="button" className="iconbtn danger" onClick={()=>setSelected(prev=>{const n=new Map(prev);n.delete(x.product_id);return n})}><I.Trash2/></button></div>)}</div><div className="modalactions"><button onClick={close}>Cancelar</button><button className="primary" disabled={!rows.length||rows.some(x=>x.volume_ml<=0||x.volume_ml>x.stock)} onClick={done}><I.Check/> Confirmar Mix · {brl(total)}</button></div></Modal>;
}
function VolumeEntryModal({product,close,confirm,notify}){
 const mode=String(product.sale_mode||'VOLUME_L');
 const [value,setValue]=useState(product.volume_ml!=null?(mode==='VOLUME_L'?(Number(product.volume_ml)/1000).toLocaleString('pt-BR',{minimumFractionDigits:3,maximumFractionDigits:3}):String(product.volume_ml)):(mode==='VOLUME_L'?'1,000':'250'));
 const ml=volumeInputToMl(value,mode),total=mode==='VOLUME_L'?Math.round(Number(product.price_cents||0)*ml/1000):Math.round(Number(product.price_cents||0)*ml);
 return <Modal wide title={'Volume · '+product.name} close={close}><div className="scale-weigh-grid"><div className="scale-reading-card"><I.Beaker/><span>Volume informado</span><strong>{volumeLabel(ml)}</strong><small>{mode==='VOLUME_L'?'Preço por litro':'Preço por mililitro'}</small></div><div className="scale-reading-card total"><I.CircleDollarSign/><span>Valor calculado</span><strong>{brl(total)}</strong><small>{brl(product.price_cents)} / {mode==='VOLUME_L'?'L':'ml'}</small></div></div><label>{mode==='VOLUME_L'?'Volume (litros)':'Volume (mililitros)'}<input autoFocus inputMode="decimal" value={value} onChange={e=>setValue(e.target.value)} placeholder={mode==='VOLUME_L'?'1,000':'250'}/></label><div className="modalactions"><button onClick={close}>Cancelar</button><button className="primary" disabled={ml<=0||ml>Number(product.stock||0)} onClick={()=>{if(ml<=0)return notify('Informe um volume maior que zero.');if(ml>Number(product.stock||0))return notify('Volume maior que o estoque disponível.');confirm(ml);close()}}><I.Check/> Confirmar volume · {brl(total)}</button></div><p className="muted">O estoque é controlado internamente em mililitros para manter a conversão entre L e ml precisa.</p></Modal>;
}
function ScaleWeighModal({product,close,addWeighted,notify}){
 const[cfg,setCfg]=useState(null),[captured,setCaptured]=useState(0),[tareText,setTareText]=useState('0,000'),[manualText,setManualText]=useState(''),[raw,setRaw]=useState(''),[busy,setBusy]=useState(false),[unitsText,setUnitsText]=useState('0'),[unitsTouched,setUnitsTouched]=useState(false);
 useEffect(()=>{window.api.scale.settings().then(setCfg).catch(notify)},[]);
 const tare=kgInputToGrams(tareText),net=Math.max(0,Number(captured||0)-tare),total=Math.round(Number(product.price_cents||0)*net/1000),remaining=Math.max(0,Number(product.stock||0)-net),suggestedUnits=Math.max(0,Math.round((net/1000)*Number(product.default_units_per_kg||0))),unitCount=Math.max(0,Math.round(Number(unitsText||0)));
 const internalUnits=Number(product.track_unit_stock||0)===1,linkedUnits=!internalUnits&&!!product.linked_unit_product_id,unitTracking=internalUnits||linkedUnits,unitStock=internalUnits?Number(product.unit_stock||0):linkedUnits?Number(product.linked_unit_stock||0):0,unitName=internalUnits?product.name:(product.linked_unit_name||'Produto unitário vinculado');
 useEffect(()=>{if(!unitsTouched)setUnitsText(String(suggestedUnits))},[net,suggestedUnits,unitsTouched]);
 const useManual=()=>{const g=kgInputToGrams(manualText);if(g<=0)return notify('Informe um peso maior que zero.');setCaptured(g);setRaw('Peso informado manualmente')};
 const capture=async()=>{if(busy)return;try{setBusy(true);const r=await window.api.scale.capture();setCaptured(Number(r.grams||0));setRaw(r.raw||'');dataChanged()}catch(e){dataChanged();notify(e)}finally{setBusy(false)}};
 const confirm=()=>{if(net<=0)return notify('O peso líquido precisa ser maior que zero.');if(net>Number(product.stock||0))return notify(`Estoque insuficiente. Disponível: ${weightLabel(product.stock)}.`);if(unitTracking&&unitCount>unitStock)return notify(`Estoque unitário insuficiente em ${unitName}. Disponível: ${unitStock} un.`);addWeighted({...product,_unit_tracking:unitTracking},net,unitCount);close()};
 if(!cfg)return <Modal title={`Pesagem · ${product.name}`} close={close}><Loading loading/></Modal>;
 return <Modal wide title={`Pesagem · ${product.name}`} close={close}><div className="scale-weigh-grid"><div className="scale-reading-card"><I.Scale/><span>Peso bruto</span><strong>{weightLabel(captured)}</strong><small>{raw||'Aguardando leitura'}</small></div><div className="scale-reading-card net"><I.PackageCheck/><span>Peso líquido</span><strong>{weightLabel(net)}</strong><small>Tara: {weightLabel(tare)}</small></div><div className="scale-reading-card total"><I.CircleDollarSign/><span>Valor calculado</span><strong>{brl(total)}</strong><small>{brl(product.price_cents)}/kg</small></div><div className="scale-reading-card"><I.Boxes/><span>Unidades desta pesagem</span><strong>{unitCount} un.</strong><small>{unitTracking?`${unitName} · baixa de estoque ativa`:'Somente informação; ative o controle unitário no cadastro para baixar estoque'}</small></div></div><div className="panel scale-stock-note"><span>Estoque disponível</span><b>{weightLabel(product.stock)}</b><span>Restante após venda</span><b>{weightLabel(remaining)}</b>{unitTracking&&<><span>Estoque unitário disponível</span><b>{unitStock} un.</b><span>Restante unitário</span><b>{Math.max(0,unitStock-unitCount)} un.</b></>}</div>{cfg.enabled&&cfg.mode==='SERIAL'?<div className="panel scale-capture-panel"><div><h3>Balança serial</h3><p className="muted">Porta {cfg.port} · {cfg.baudRate} bps · unidade recebida em {cfg.inputUnit}</p></div><button className="primary" disabled={busy} onClick={capture}><I.Scale/> {busy?'Lendo...':'Capturar peso da balança'}</button></div>:<div className="panel scale-sim-panel"><div><h3>Modo simulação/manual</h3><p className="muted">Use este modo enquanto a balança física ainda não estiver instalada.</p></div></div>}<div className="formgrid"><label>Tara (kg)<input inputMode="decimal" value={tareText} onChange={e=>setTareText(e.target.value)} placeholder="0,000"/></label>{(!cfg.enabled||cfg.mode==='SIMULATION'||cfg.allowManual)&&<label>Peso manual/simulado (kg)<div className="inlinefield"><input inputMode="decimal" value={manualText} onChange={e=>setManualText(e.target.value)} placeholder="1,235" onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();useManual()}}}/><button className="smallbtn" type="button" onClick={useManual}>Aplicar</button></div></label>}<label>Quantidade de unidades contidas no peso<input type="number" inputMode="numeric" min="0" step="1" value={unitsText} onChange={e=>{setUnitsTouched(true);setUnitsText(e.target.value)}}/><small className="muted">Sugestão: {suggestedUnits} un. {Number(product.default_units_per_kg||0)>0?`(${Number(product.default_units_per_kg)} un./kg)`:''}. Você pode informar mais ou menos conforme a pesagem real.</small></label></div><div className="modalactions"><button onClick={close}>Cancelar</button><button className="primary" disabled={net<=0||net>Number(product.stock||0)||(unitTracking&&unitCount>unitStock)} onClick={confirm}><I.ShoppingCart/> Adicionar {weightLabel(net)} · {unitCount} un. à venda</button></div></Modal>
}


function MixWeightModal({mix,products,close,confirm,notify,initialWeightGrams=0,initialMixItems=[],estimate=false}){
 const[cfg,setCfg]=useState(null),[tareText,setTareText]=useState('0,000'),[busyId,setBusyId]=useState(null),[search,setSearch]=useState(''),[selected,setSelected]=useState(()=>new Map((initialMixItems||[]).map(x=>[Number(x.product_id),{product_id:Number(x.product_id),name:x.name||x.product_name||'',quantity:Math.max(0,Math.round(Number(x.quantity||0))),weight_text:Number(x.weight_grams||0)>0?gramsToKg(x.weight_grams):''}]))) ;
 useEffect(()=>{window.api.scale.settings().then(setCfg).catch(()=>setCfg({enabled:false,mode:'SIMULATION',allowManual:true}))},[]);
 const eligible=useMemo(()=>{const term=search.trim().toLocaleLowerCase('pt-BR');return (products||[]).filter(p=>String(p.sale_mode||'UNIT')==='UNIT'&&(!mix.mix_category_id||String(p.category_id)===String(mix.mix_category_id)||String(p.parent_id)===String(mix.mix_category_id))).filter(p=>!term||String(p.name||'').toLocaleLowerCase('pt-BR').includes(term)||String(p.sku||'').toLocaleLowerCase('pt-BR').includes(term)||String(p.barcode||'').includes(term)).slice(0,80)},[products,search,mix.mix_category_id]);
 const rows=useMemo(()=>Array.from(selected.values()).map(x=>{const p=(products||[]).find(p=>Number(p.id)===Number(x.product_id))||{};return {...x,name:x.name||p.name||'Produto',stock:Number(p.stock||0),weight_grams:kgInputToGrams(x.weight_text||'')}}),[selected,products]);
 const unitCount=rows.reduce((s,x)=>s+Math.max(0,Math.round(Number(x.quantity||0))),0),totalWeight=rows.reduce((s,x)=>s+Math.max(0,Number(x.weight_grams||0)),0),total=Math.round(Number(mix.price_cents||0)*totalWeight/1000);
 const base=(products||[]).find(p=>Number(p.id)===Number(mix.weight_product_id||0));const baseStock=Number(base?.stock||0);
 const invalidRows=rows.filter(x=>x.quantity<=0||x.quantity>x.stock||x.weight_grams<=0);
 const addProduct=p=>{setSelected(prev=>{const n=new Map(prev);if(!n.has(Number(p.id)))n.set(Number(p.id),{product_id:Number(p.id),name:p.name,quantity:1,weight_text:''});return n});setSearch('')};
 const setQty=(id,v)=>setSelected(prev=>{const n=new Map(prev);const cur=n.get(Number(id));if(!cur)return n;const qty=Math.max(0,Math.round(Number(v||0)));if(qty<=0)n.delete(Number(id));else n.set(Number(id),{...cur,quantity:qty});return n});
 const setWeight=(id,v)=>setSelected(prev=>{const n=new Map(prev);const cur=n.get(Number(id));if(cur)n.set(Number(id),{...cur,weight_text:v});return n});
 const removeRow=id=>setSelected(prev=>{const n=new Map(prev);n.delete(Number(id));return n});
 const captureRow=async id=>{if(estimate||busyId)return;try{setBusyId(Number(id));const r=await window.api.scale.capture();const tare=kgInputToGrams(tareText);const net=Math.max(0,Number(r.grams||0)-tare);if(net<=0)return notify('O peso líquido desta cor precisa ser maior que zero.');setWeight(id,gramsToKg(net));dataChanged()}catch(e){notify(e)}finally{setBusyId(null)}};
 const done=()=>{if(!rows.length)return notify('Selecione pelo menos uma cor/produto para o Mix.');if(invalidRows.length){const x=invalidRows[0];if(x.quantity<=0||x.quantity>x.stock)return notify(`Confira a quantidade de ${x.name}. Disponível: ${x.stock} un.`);return notify(`Informe o peso de ${x.name}.`)}if(totalWeight<=0)return notify(estimate?'Informe os pesos estimados das cores do Mix.':'Informe o peso de cada cor do Mix.');if(base&&totalWeight>baseStock)return notify(`Estoque-base em kg insuficiente. Disponível: ${weightLabel(baseStock)}.`);confirm(totalWeight,rows.map(x=>({product_id:x.product_id,name:x.name,quantity:x.quantity,weight_grams:x.weight_grams})));close()};
 if(!cfg)return <Modal wide title={`${estimate?'Mix estimado':'Mix por Peso'} · ${mix.name}`} close={close}><Loading loading/></Modal>;
 return <Modal wide title={`${estimate?'Mix estimado':'Mix por Peso'} · ${mix.name}`} close={close}>
  <p className="muted">Adicione uma cor de cada vez, informe quantas velas foram separadas e o peso daquela quantidade. O PDV soma tudo dentro do mesmo Mix.</p>
  <div className="scale-weigh-grid">
   <div className="scale-reading-card"><I.Scale/><span>Peso total</span><strong>{weightLabel(totalWeight)}</strong><small>Soma dos pesos das cores</small></div>
   <div className="scale-reading-card"><I.Boxes/><span>Total de unidades</span><strong>{unitCount} un.</strong><small>{rows.length} cor(es)/produto(s)</small></div>
   <div className="scale-reading-card total"><I.CircleDollarSign/><span>Valor {estimate?'estimado':'calculado'}</span><strong>{brl(total)}</strong><small>{brl(mix.price_cents)}/kg</small></div>
  </div>
  {base&&<div className="panel scale-stock-note"><span>Estoque-base em peso</span><b>{weightLabel(baseStock)}</b><span>Restante após o Mix</span><b>{weightLabel(Math.max(0,baseStock-totalWeight))}</b></div>}
  {!estimate&&cfg.enabled&&cfg.mode==='SERIAL'&&<div className="formgrid" style={{marginTop:12}}><label>Tara por pesagem (kg)<input inputMode="decimal" value={tareText} onChange={e=>setTareText(e.target.value)} placeholder="0,000"/><small className="muted">Ao capturar uma cor, esta tara será descontada da leitura bruta.</small></label></div>}
  <div className="panel" style={{marginTop:12}}>
   <div className="toolbar inline"><div><h3>Composição do mesmo Mix</h3><p className="muted">{mix.mix_category_name?`Produtos da categoria ${mix.mix_category_name}. `:''}Pesquise a cor, informe quantidade e peso e continue adicionando as próximas.</p></div><span className="badge ok">{rows.length} cor(es)</span></div>
   <div className="search"><I.Search/><input autoFocus value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar próxima cor, nome, SKU ou código de barras..."/></div>
   {search.trim()&&<div className="pickerlist" style={{maxHeight:180,overflow:'auto',marginTop:8}}>{eligible.map(p=><button className="pickeritem" key={p.id} onClick={()=>addProduct(p)} disabled={selected.has(Number(p.id))}><span><b>{p.name}</b><small>Estoque: {Number(p.stock||0)} {p.unit||'un'}</small></span>{selected.has(Number(p.id))?<I.Check/>:<I.Plus/>}</button>)}{!eligible.length&&<div className="empty compact"><p>Nenhum produto encontrado.</p></div>}</div>}
   <div style={{marginTop:10,maxHeight:330,overflow:'auto',display:'grid',gap:8}}>{rows.length?rows.map(x=><div key={x.product_id} className="panel" style={{padding:10,display:'grid',gridTemplateColumns:'minmax(160px,1fr) 105px 135px auto',gap:8,alignItems:'end'}}><div><b>{x.name}</b><small className="muted" style={{display:'block'}}>Disponível: {x.stock} un. · Peso informado: {weightLabel(x.weight_grams)}</small></div><label style={{margin:0}}>Quantidade<input type="number" min="1" max={x.stock} step="1" value={x.quantity} onChange={e=>setQty(x.product_id,e.target.value)}/></label><label style={{margin:0}}>Peso desta cor (kg)<input inputMode="decimal" value={x.weight_text} onChange={e=>setWeight(x.product_id,e.target.value)} placeholder="0,450"/></label><div style={{display:'flex',gap:6}}>{!estimate&&cfg.enabled&&cfg.mode==='SERIAL'&&<button type="button" className="smallbtn" disabled={busyId===x.product_id} onClick={()=>captureRow(x.product_id)}><I.Scale/> {busyId===x.product_id?'Lendo...':'Capturar'}</button>}<button type="button" className="iconbtn danger" title="Remover cor" onClick={()=>removeRow(x.product_id)}><I.Trash2/></button></div></div>):<div className="empty compact"><I.Boxes/><p>Pesquise a primeira cor e adicione ao Mix.</p></div>}</div>
  </div>
  {Number(initialWeightGrams||0)>0&&rows.length>1&&rows.every(x=>!x.weight_grams)&&<p className="hint">Este Mix foi criado numa versão anterior com apenas peso total ({weightLabel(initialWeightGrams)}). Informe agora o peso individual de cada cor.</p>}
  <div className="modalactions"><button onClick={close}>Cancelar</button><button className="primary" disabled={!rows.length||invalidRows.length>0||(base&&totalWeight>baseStock)} onClick={done}><I.ShoppingCart/> {estimate?'Usar no orçamento':'Adicionar à venda'} · {weightLabel(totalWeight)} · {unitCount} un.</button></div>
 </Modal>
}

function ScaleConfigPanel({settings,saved,notify}){
 const pick=src=>({scale_enabled:String(src.scale_enabled||'0'),scale_mode:src.scale_mode||'SIMULATION',scale_port:src.scale_port||'COM1',scale_baud_rate:String(src.scale_baud_rate||'9600'),scale_data_bits:String(src.scale_data_bits||'8'),scale_parity:src.scale_parity||'None',scale_stop_bits:src.scale_stop_bits||'One',scale_handshake:src.scale_handshake||'None',scale_read_timeout_ms:String(src.scale_read_timeout_ms||'1800'),scale_request_type:src.scale_request_type||'NONE',scale_request_text:src.scale_request_text||'',scale_input_unit:src.scale_input_unit||'kg',scale_regex:src.scale_regex||'',scale_stable_token:src.scale_stable_token||'',scale_allow_manual:String(src.scale_allow_manual??'1')});
 const[s,setS]=useState(()=>pick(settings)),[ports,setPorts]=useState([]),[busy,setBusy]=useState(false),[status,setStatus]=useState(null);
 useEffect(()=>setS(pick(settings)),[settings]);
 const listPorts=async()=>{try{const p=await window.api.scale.listPorts();setPorts(p||[]);if(p?.length&&!p.includes(s.scale_port))setS(x=>({...x,scale_port:p[0]}))}catch(e){notify(e)}};
 useEffect(()=>{listPorts();window.api.scale.status().then(setStatus).catch(()=>{})},[]);
 const save=async()=>{try{setBusy(true);await window.api.settings.set(s);await saved();dataChanged();notify('Configuração da balança salva.')}catch(e){notify(e)}finally{setBusy(false)}};
 const test=async()=>{try{setBusy(true);await window.api.settings.set(s);const r=await window.api.scale.test();setStatus(await window.api.scale.status());await saved();dataChanged();notify(r.message||'Balança testada com sucesso.')}catch(e){setStatus(await window.api.scale.status().catch(()=>null));dataChanged();notify(e)}finally{setBusy(false)}};
 return <div className="panel scale-config"><div className="toolbar inline"><div><h2>Balança eletrônica</h2><p className="muted">Produtos vendidos por peso usam preço por kg e estoque interno em gramas. O modo Simulação permite testar sem equipamento físico.</p></div><span className={`badge ${status?.ready?'ok':s.scale_enabled==='1'?'warn':''}`}>{s.scale_enabled!=='1'?'DESATIVADA':s.scale_mode==='SIMULATION'?'SIMULAÇÃO':status?.ready?'PRONTA':'NÃO TESTADA'}</span></div><div className="formgrid"><label>Ativação<ThemedSelect value={s.scale_enabled} onChange={e=>setS({...s,scale_enabled:e.target.value})}><option value="0">Desativada</option><option value="1">Ativada</option></ThemedSelect></label><label>Modo<ThemedSelect value={s.scale_mode} onChange={e=>setS({...s,scale_mode:e.target.value})}><option value="SIMULATION">Simulação / peso manual</option><option value="SERIAL">Serial RS-232 / USB (porta COM)</option></ThemedSelect></label>{s.scale_mode==='SERIAL'&&<><label>Porta COM<div className="inlinefield"><ThemedSelect value={s.scale_port} onChange={e=>setS({...s,scale_port:e.target.value})}>{[...new Set([s.scale_port,...ports])].filter(Boolean).map(x=><option key={x}>{x}</option>)}</ThemedSelect><button className="smallbtn" type="button" onClick={listPorts}><I.RefreshCw/></button></div></label><label>Baud rate<ThemedSelect value={s.scale_baud_rate} onChange={e=>setS({...s,scale_baud_rate:e.target.value})}>{['1200','2400','4800','9600','19200','38400','57600','115200'].map(x=><option key={x}>{x}</option>)}</ThemedSelect></label><label>Bits de dados<ThemedSelect value={s.scale_data_bits} onChange={e=>setS({...s,scale_data_bits:e.target.value})}><option>7</option><option>8</option></ThemedSelect></label><label>Paridade<ThemedSelect value={s.scale_parity} onChange={e=>setS({...s,scale_parity:e.target.value})}><option value="None">Nenhuma</option><option value="Even">Par</option><option value="Odd">Ímpar</option></ThemedSelect></label><label>Stop bits<ThemedSelect value={s.scale_stop_bits} onChange={e=>setS({...s,scale_stop_bits:e.target.value})}><option value="One">1</option><option value="Two">2</option></ThemedSelect></label><label>Controle de fluxo<ThemedSelect value={s.scale_handshake} onChange={e=>setS({...s,scale_handshake:e.target.value})}><option value="None">Nenhum</option><option value="XOnXOff">XON/XOFF</option><option value="RequestToSend">RTS/CTS</option><option value="RequestToSendXOnXOff">RTS/CTS + XON/XOFF</option></ThemedSelect></label><label>Timeout de leitura (ms)<input type="number" min="300" max="10000" value={s.scale_read_timeout_ms} onChange={e=>setS({...s,scale_read_timeout_ms:e.target.value})}/></label><label>Comando de solicitação<ThemedSelect value={s.scale_request_type} onChange={e=>setS({...s,scale_request_type:e.target.value})}><option value="NONE">Nenhum — balança transmite continuamente</option><option value="ENQ">ENQ (0x05)</option><option value="TEXT">Texto personalizado</option></ThemedSelect></label>{s.scale_request_type==='TEXT'&&<label>Texto/comando<input value={s.scale_request_text} onChange={e=>setS({...s,scale_request_text:e.target.value})}/></label>}<label>Unidade enviada pela balança<ThemedSelect value={s.scale_input_unit} onChange={e=>setS({...s,scale_input_unit:e.target.value})}><option value="kg">kg</option><option value="g">gramas</option></ThemedSelect></label><label>Token de estabilidade (opcional)<input value={s.scale_stable_token} onChange={e=>setS({...s,scale_stable_token:e.target.value})} placeholder="Ex.: ST"/></label><label className="span2">Expressão de extração (opcional)<input value={s.scale_regex} onChange={e=>setS({...s,scale_regex:e.target.value})} placeholder="Ex.: ([0-9]+[.,][0-9]+)"/><small className="muted">Deixe vazio para o PDV utilizar automaticamente o último número recebido.</small></label></>}<label>Permitir peso manual de contingência<ThemedSelect value={s.scale_allow_manual} onChange={e=>setS({...s,scale_allow_manual:e.target.value})}><option value="1">Sim</option><option value="0">Não</option></ThemedSelect></label></div>{status?.lastError&&<div className="note warning"><I.TriangleAlert/><div><b>Último teste</b><small>{status.lastError}</small></div></div>}<div className="modalactions"><button className="smallbtn" disabled={busy} onClick={test}><I.Scale/> Testar balança</button><button className="primary" disabled={busy} onClick={save}><I.Save/> Salvar balança</button></div></div>
}

function CompactLauncher({nav,go,overview}){const groups=[...new Set(nav.map(x=>x[3]))];return <div className="compact-launcher"><div className="compact-hero"><div><span className="compact-kicker">PAINEL DE OPERAÇÕES</span><h2>Jhonnie Beer</h2><p>Atalhos rápidos para todas as áreas do sistema.</p></div><div className="compact-indicators"><span className={overview?.cash?'ok':''}><I.WalletCards/> {overview?.cash?'Caixa aberto':'Caixa fechado'}</span><span><I.Bell/> Central de notificações</span></div></div>{groups.map(group=><section className="compact-menu-group" key={group}><h3>{group}</h3><div className="compact-menu-grid">{nav.filter(x=>x[3]===group).map(([id,label,Icon])=><button className="compact-menu-tile" key={id} onClick={()=>go(id)}><span className="compact-menu-icon"><Icon/></span><b>{label}</b><I.ChevronRight className="compact-menu-arrow"/></button>)}</div></section>)}</div>}
function SystemApp(){
 const [quickActionsOpen,setQuickActionsOpen]=useState(false);
 const [pendingTasksOpen,setPendingTasksOpen]=useState(false);
 const [workspacePrefsOpen,setWorkspacePrefsOpen]=useState(false);
 const [favorites,setFavorites]=useState(()=>readFavorites());
 const [workspacePrefs,setWorkspacePrefs]=useState(()=>readWorkspacePrefs());
 const[page,setPage]=useState('inicio'),[settings,setSettings]=useState(withSidebarMenuDefaults({store_name:'Jhonnie Beer',current_operator_id:'',current_operator_name:'',current_operator_photo:'',ux_grouped_sidebar:'1'})),[toast,setToast]=useState(null),[theme,setTheme]=useState('jhonnie'),[sidebarCollapsed,setSidebarCollapsed]=useState(()=>localStorage.getItem('unipdv-sidebar-collapsed')==='1'),[overview,setOverview]=useState(null),[notifications,setNotifications]=useState([]),[notificationOpen,setNotificationOpen]=useState(false),[guideOpen,setGuideOpen]=useState(false),[stockAlert,setStockAlert]=useState(null),[helpContext,setHelpContext]=useState('inicio'),[visited,setVisited]=useState(()=>new Set(['inicio'])),[scaleStatus,setScaleStatus]=useState(null);
 const notify=(e,action=null)=>{const message=e?.message||String(e);const kind=e instanceof Error||e?.code?'danger':(e?.kind||'info');setToast({message,kind,action});clearTimeout(window.__pdvToastTimer);window.__pdvToastTimer=setTimeout(()=>setToast(null),action?8500:4500)};
 const refreshUx=async()=>{try{const[o,n,sc]=await Promise.all([window.api.ux.overview(),window.api.ux.notifications(),window.api.scale.status()]);setOverview(o);setNotifications(n||[]);setScaleStatus(sc)}catch{}};
 const reload=async()=>{try{const s=await window.api.settings.get();setSettings(x=>({...x,...s}));setTheme(s.theme||'jhonnie');await refreshUx()}catch(e){notify(e)}};
 useEffect(()=>{try{localStorage.setItem('uni-favorite-actions-v1',JSON.stringify(favorites))}catch{}},[favorites]);
 useEffect(()=>{try{localStorage.setItem('uni-workspace-prefs-v1',JSON.stringify(workspacePrefs));document.body.classList.toggle('nl-workspace-compact',!!workspacePrefs.compact)}catch{}return()=>document.body.classList.remove('nl-workspace-compact')},[workspacePrefs]);
 const printCurrentPage=()=>{const clean=()=>{document.body.classList.remove('nl-print-current');window.removeEventListener('afterprint',clean)};document.body.classList.add('nl-print-current');window.addEventListener('afterprint',clean);requestAnimationFrame(()=>requestAnimationFrame(()=>{try{window.print()}catch{clean()}}));setTimeout(clean,60000)};
 const go=id=>{setVisited(v=>{const n=new Set(v);n.add(id);return n});setPage(id);setNotificationOpen(false)};
 const openHelp=()=>{setHelpContext(page);setVisited(v=>{const n=new Set(v);n.add('ajuda');return n});setPage('ajuda');setNotificationOpen(false)};
 useEffect(()=>{reload();const fn=t=>{setTheme(t);window.api.settings.set({theme:t}).catch(()=>{})};window.api.theme.onChange(fn);const op=e=>{setSettings(x=>({...x,current_operator_id:e.detail?.id||'',current_operator_name:e.detail?.name||'',current_operator_photo:e.detail?.photo_data||'',current_operator_role:e.detail?.role==='admin'?'admin':'operator'}));refreshUx()};window.addEventListener('operator-changed',op);const nav=e=>e.detail&&go(e.detail);window.addEventListener('app:navigate',nav);const changed=()=>refreshUx();window.addEventListener(DATA_REFRESH_EVENT,changed);return()=>{window.removeEventListener('operator-changed',op);window.removeEventListener('app:navigate',nav);window.removeEventListener(DATA_REFRESH_EVENT,changed)}},[]);
 useEffect(()=>{const fn=()=>go('vendas');window.addEventListener('quote-to-sale',fn);return()=>window.removeEventListener('quote-to-sale',fn)},[]);
 useEffect(()=>{let active=true;const check=async()=>{try{const due=await window.api.agenda.dueAlerts();if(active&&due?.length){playAgendaAlert();notify({message:`Agenda: ${due.map(x=>x.customer_name+' — '+x.title).join(' | ')}`,kind:'warning'});refreshUx()}}catch{}};check();const timer=setInterval(check,30000);return()=>{active=false;clearInterval(timer)}},[]);
 useEffect(()=>{const t=setInterval(()=>refreshUx(),60000);return()=>clearInterval(t)},[]);
 useEffect(()=>{if(!overview)return;if(!sessionStorage.getItem('pdv-stock-opening-alert-shown')&&(overview.lowStock||[]).length){sessionStorage.setItem('pdv-stock-opening-alert-shown','1');setStockAlert({items:overview.lowStock,count:Number(overview.lowStockCount??overview.lowStock.length)})}},[overview]);
 useEffect(()=>{const id=settings.current_operator_id||'padrao';const key=`unipdv-guide-${id}`;if(settings.current_operator_id&&!localStorage.getItem(key))setGuideOpen(true)},[settings.current_operator_id]);
 useEffect(()=>{const key=e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setQuickActionsOpen(v=>!v);return;}if((e.ctrlKey||e.metaKey)&&e.shiftKey&&e.key.toLowerCase()==='p'){e.preventDefault();printCurrentPage();return;}if(e.altKey&&!e.ctrlKey&&!e.metaKey&&/^[1-5]$/.test(e.key)){const target=favorites[Number(e.key)-1];if(target){e.preventDefault();go(target)}return;}if(e.altKey||e.ctrlKey||e.metaKey)return;const map={F2:'vendas',F3:'clientes',F4:'produtos',F6:'agenda',F8:'caixa'};if(map[e.key]){e.preventDefault();go(map[e.key]);return}if(e.key==='F10'){e.preventDefault();go('vendas');setTimeout(()=>window.dispatchEvent(new Event('shortcut:checkout')),120)}if(e.key==='F1'){e.preventDefault();openHelp()}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[page,favorites]);
 const nav=[['inicio','Início',I.House,'Operação'],['caixa','Caixa',I.WalletCards,'Operação'],['vendas','Vendas',I.ShoppingCart,'Operação'],['orcamentos','Orçamentos',I.FileText,'Operação'],['agenda','Agenda',I.CalendarClock,'Operação'],['produtos','Produtos',I.Package,'Cadastros'],['kits','Kits / Combos',I.Layers,'Cadastros'],['clientes','Clientes',I.Users,'Cadastros'],['fornecedores','Fornecedores',I.Truck,'Cadastros'],['estoque','Estoque',I.Warehouse,'Gestão'],['analise-estoque','Análise de Estoque',I.ChartNoAxesCombined,'Gestão'],['rentabilidade','Rentabilidade',I.TrendingUp,'Gestão'],['metas-financeiras','Metas Financeiras',I.Target,'Gestão'],['compras','Compras',I.Truck,'Gestão'],['financeiro','Compras e Financeiro',I.ClipboardList,'Gestão'],['relatorios','Relatórios',I.ReceiptText,'Gestão'],['fiscal','Fiscal',I.FileCheck2,'Gestão'],['anotacoes','Anotações',I.NotebookPen,'Gestão'],['backup','Backup',I.DatabaseBackup,'Sistema'],['email','E-mails',I.Mail,'Sistema'],['ze-delivery','Zé Delivery',I.Package,'Integrações'],['diagnostico','Diagnóstico',I.Stethoscope,'Sistema'],['atividades','Atividades',I.History,'Sistema'],['ajuda','Ajuda',I.CircleHelp,'Sistema'],['config','Configurações',I.Settings,'Sistema']];
 const mode=String(settings.ux_mode||'complete')==='compact'?'compact':'complete';const visibleNav=nav.filter(x=>x[3]==='Operação'||sidebarMenuEnabled(settings,x[0]));const grouped=String(settings.ux_grouped_sidebar||'1')!=='0';
 const pages={inicio:mode==='compact'?<CompactLauncher nav={nav} go={go} overview={overview}/>:<HomeDashboard overview={overview} go={go}/>,caixa:<CaixaFinanceiro settings={settings} notify={notify}/>,vendas:<Caixa settings={settings} notify={notify}/>,orcamentos:<Orcamentos settings={settings} notify={notify}/>,produtos:<Produtos notify={notify}/>,estoque:<Estoque notify={notify}/>,'analise-estoque':<UniManagement type="stock" notify={notify}/>,'rentabilidade':<UniManagement type="profit" notify={notify}/>,'metas-financeiras':<UniManagement type="goals" notify={notify}/>,compras:<UniManagement type="purchases" notify={notify}/>,kits:<Kits notify={notify}/>,clientes:<Clientes notify={notify}/>,fornecedores:<Fornecedores notify={notify}/>,financeiro:<Financeiro notify={notify}/>,agenda:<Agenda notify={notify}/>,relatorios:<Relatorios notify={notify}/>,fiscal:<Fiscal notify={notify}/>,anotacoes:<Notes notify={notify}/>,backup:<Backup notify={notify}/>,email:<Emails notify={notify}/>, 'ze-delivery':<ZeDeliveryPage settings={settings} saved={reload} notify={notify}/>,diagnostico:<DiagnosticsPage notify={notify}/>,atividades:<ActivityPage notify={notify}/>,ajuda:<HelpCenter page={helpContext} go={go}/>,config:<Config settings={settings} saved={reload} notify={notify}/>};
 const groups=[...new Set(visibleNav.map(x=>x[3]))];const current=nav.find(x=>x[0]===page)||nav[0];const notifCount=notifications.reduce((n,x)=>n+Math.max(1,Number(x.count||0)),0);
 const pendingCount=(!overview?.cash?1:0)+(Number(overview?.lowStockCount??(overview?.lowStock||[]).length)>0?1:0)+(Number(overview?.debt?.n||0)>0?1:0)+(Number(overview?.openQuotes||0)>0?1:0)+(Number(overview?.fiscalPending||0)>0?1:0)+notifications.length;
 const renderItem=([id,label,Icon])=><button className={`nav-${id} ${page===id?'active':''}`} onClick={()=>id==='ajuda'?openHelp():go(id)} key={id}><Icon/><span>{label}</span>{id==='estoque'&&Number(overview?.lowStockCount??(overview?.lowStock?.length||0))>0&&<em className="nav-count">{Number(overview?.lowStockCount??(overview?.lowStock?.length||0))}</em>}</button>;
 return <div className={`app theme-${theme} ${sidebarCollapsed?'sidebar-collapsed':''} ux-mode-${mode}`}><aside><button className="sidebar-toggle" title={sidebarCollapsed?'Expandir sidebar':'Recolher sidebar'} aria-label={sidebarCollapsed?'Expandir sidebar':'Recolher sidebar'} onClick={()=>setSidebarCollapsed(v=>{const n=!v;localStorage.setItem('unipdv-sidebar-collapsed',n?'1':'0');return n})}>{sidebarCollapsed?<I.PanelLeftOpen/>:<I.PanelLeftClose/>}</button><div className="brand"><div className="logoMark">{settings.logo_data?<img src={settings.logo_data} alt="Logo"/>:<img src={appLogo} alt="Uni-PDV"/>}</div><div><b>{settings.store_name||'Uni-PDV'}</b><span>PDV • Gestão</span></div></div><nav className={grouped?'nav-grouped':''}>{grouped?groups.map(g=><div className="nav-group" key={g}><small>{g}</small>{visibleNav.filter(x=>x[3]===g).map(renderItem)}</div>):visibleNav.map(renderItem)}</nav><div className="sidefoot"><span className="online-status"><span className="dot"/> Sistema online</span></div></aside><main><header className="ux-topbar"><div className="ux-breadcrumb">{mode==='compact'&&page!=='inicio'&&<button className="compact-home-button" onClick={()=>go('inicio')} title="Voltar ao painel"><I.LayoutDashboard/><span>Painel</span></button>}<small>Início /</small><h1>{current[1]}</h1></div><GlobalSearchBox go={go}/><div className="nl-global-tools"><button className="nl-tool-button" onClick={()=>setQuickActionsOpen(true)} title="Ações rápidas (Ctrl+K)"><I.Zap/><span>Ações rápidas</span></button><button className="nl-tool-button" onClick={()=>setPendingTasksOpen(true)} title="Central de pendências"><I.ClipboardCheck/><span>Pendências</span>{pendingCount>0&&<em>{Math.min(99,pendingCount)}</em>}</button><button className="nl-tool-button" onClick={()=>setWorkspacePrefsOpen(true)} title="Personalizar espaço de trabalho"><I.SlidersHorizontal/><span>Personalizar</span></button></div><div className="ux-status-actions"><button className={`ux-status-pill ${overview?.cash?'ok':'warn'}`} onClick={()=>go('caixa')} title="Situação do caixa"><I.WalletCards/><span>{overview?.cash?'Caixa aberto':'Caixa fechado'}</span></button><button className={`ux-status-pill ${settings.current_operator_name?'ok':'warn'}`} title="Operador atual"><I.UserRound/><span>{firstName(settings.current_operator_name)||'Sem operador'}</span></button><button className={`ux-status-pill backup ${overview?.lastBackupAt?'ok':'warn'}`} onClick={()=>go('backup')} title={overview?.lastBackupAt?`Último backup: ${fmtDate(overview.lastBackupAt)}`:'Nenhum backup registrado'}><I.DatabaseBackup/><span>{overview?.lastBackupAt?'Backup OK':'Backup?'}</span></button>{scaleStatus?.enabled&&<button className={`ux-status-pill scale ${scaleStatus?.ready?'ok':'warn'}`} onClick={()=>go('config')} title={scaleStatus?.mode==='SERIAL'?`Balança ${scaleStatus?.port||''}`:'Configuração da balança'}><I.Scale/><span>{scaleStatus?.mode==='SIMULATION'?'Balança simulação':scaleStatus?.ready?'Balança pronta':'Balança?'}</span></button>}<div className="ux-notification-wrap"><button className="ux-icon-status" onClick={()=>setNotificationOpen(v=>!v)} title="Notificações"><I.Bell/>{notifCount>0&&<span>{notifCount>99?'99+':notifCount}</span>}</button>{notificationOpen&&<NotificationPanel rows={notifications} close={()=>setNotificationOpen(false)} go={go}/>}</div><button className="ux-icon-status" onClick={()=>go('config')} title="Configurações"><I.Settings/></button><button className="ux-icon-status" onClick={openHelp} title="Ajuda (F1)"><I.CircleHelp/></button><Clock/></div></header><div className="ux-shortcut-strip"><span>F2 Venda</span><span>F3 Clientes</span><span>F4 Produtos</span><span>F6 Agenda</span><span>F8 Caixa</span><span>F10 Pagamento</span><span>F1 Ajuda</span><span>Ctrl+K Ações rápidas</span><span>Ctrl+Shift+P Imprimir</span></div>{workspacePrefs.showFavorites&&<WorkspaceFavoritesBar favorites={favorites} go={go}/>}<div className="pagehost">{nav.map(([id,label])=>visited.has(id)?<div key={id} className={page===id?'pagevisible':'pagehidden'}><ErrorBoundary name={label}>{pages[id]}</ErrorBoundary></div>:null)}</div></main>{toast&&<div className={`toast ux-toast ${toast.kind||'info'}`}><span>{toast.kind==='danger'?<I.CircleAlert/>:toast.kind==='warning'?<I.TriangleAlert/>:<I.CircleCheck/>}</span><b>{toast.message}</b>{toast.action&&<button onClick={async()=>{try{await toast.action.run();setToast(null);dataChanged();notify(toast.action.doneMessage||'Ação desfeita.')}catch(e){notify(e)}}}>{toast.action.label||'Desfazer'}</button>}<button className="ux-toast-close" onClick={()=>setToast(null)}><I.X/></button></div>}{guideOpen?<FirstUseGuide close={()=>{const id=settings.current_operator_id||'padrao';localStorage.setItem(`unipdv-guide-${id}`,'1');setGuideOpen(false)}}/>:stockAlert?<StockOpeningAlert items={stockAlert.items} count={stockAlert.count} close={()=>setStockAlert(null)} go={go}/>:null}<WorkspaceQuickActions open={quickActionsOpen} close={()=>setQuickActionsOpen(false)} go={go} nav={nav} favorites={favorites} setFavorites={setFavorites} onPrint={printCurrentPage}/><PendingTasksPanel open={pendingTasksOpen} close={()=>setPendingTasksOpen(false)} overview={overview} notifications={notifications} go={go} onPrint={printCurrentPage}/><WorkspacePreferences open={workspacePrefsOpen} close={()=>setWorkspacePrefsOpen(false)} prefs={workspacePrefs} setPrefs={setWorkspacePrefs}/></div>
}

function Emails({notify}){const[s,setS]=useState({email_host:'',email_port:'587',email_secure:'0',email_sender_name:'',email_user:'',email_from:''}),[password,setPassword]=useState(''),[to,setTo]=useState(''),[subject,setSubject]=useState('Documento enviado pelo Uni-PDV'),[textBody,setTextBody]=useState('Segue o documento enviado pelo Uni-PDV.'),[attachments,setAttachments]=useState([]),[busy,setBusy]=useState(false);useEffect(()=>{window.api.email.settings().then(setS).catch(notify)},[]);const save=async()=>{try{await window.api.email.saveSettings({...s,email_password:password});setPassword('');notify('Configuração de e-mail salva.')}catch(e){notify(e)}};const test=async()=>{try{await window.api.email.test();notify('Conexão SMTP testada com sucesso.')}catch(e){notify(e)}};const choose=async()=>{try{setAttachments(await window.api.email.chooseAttachments())}catch(e){notify(e)}};const send=async()=>{try{setBusy(true);await window.api.email.send({to,subject,text:textBody,attachments});setTo('');setAttachments([]);notify('E-mail enviado com sucesso.')}catch(e){notify(e)}finally{setBusy(false)}};return <div className="settings"><div className="panel"><h2>Configuração do envio</h2><p className="muted">Configure a conta SMTP usada para enviar cupons, notas fiscais, PDFs, XML e imagens. Para Outlook/Microsoft 365, use o servidor SMTP da sua conta e, quando exigido, senha de aplicativo ou credencial autorizada.</p><div className="formgrid"><label>Servidor SMTP<input value={s.email_host||''} onChange={e=>setS({...s,email_host:e.target.value})} placeholder="smtp.office365.com"/></label><label>Porta<input type="number" value={s.email_port||587} onChange={e=>setS({...s,email_port:e.target.value})}/></label><label>Segurança<ThemedSelect value={s.email_secure||'0'} onChange={e=>setS({...s,email_secure:e.target.value})}><option value="0">STARTTLS / TLS</option><option value="1">SSL/TLS direto</option></ThemedSelect></label><label>Nome do usuário/remetente<input value={s.email_sender_name||''} onChange={e=>setS({...s,email_sender_name:e.target.value})} placeholder="Nome que aparecerá no envio"/></label><label>Endereço de e-mail do remetente<input type="email" value={s.email_from||''} onChange={e=>setS({...s,email_from:e.target.value})} placeholder="remetente@exemplo.com"/></label><label>Senha do e-mail<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Deixe em branco para manter"/></label></div><div className="modalactions"><button className="smallbtn" onClick={test}>Testar conexão</button><button className="primary" onClick={save}>Salvar configuração</button></div></div><div className="panel"><h2>Enviar cupom / nota fiscal</h2><div className="formgrid"><label>Destinatário<input type="email" value={to} onChange={e=>setTo(e.target.value)} placeholder="cliente@exemplo.com"/></label><label>Assunto<input value={subject} onChange={e=>setSubject(e.target.value)}/></label><label className="span2">Mensagem<textarea rows="4" value={textBody} onChange={e=>setTextBody(e.target.value)}/></label></div><div className="emailattach"><button className="smallbtn" onClick={choose}><I.Paperclip/> Anexar PDF, JPG, JPEG, PNG, BMP ou XML</button>{attachments.length?<ul>{attachments.map(x=><li key={x}>{x}</li>)}</ul>:<p className="muted">Nenhum anexo selecionado.</p>}</div><button className="primary big" disabled={busy||!to} onClick={send}><I.Send/> {busy?'Enviando...':'Enviar e-mail'}</button></div></div>}
function Clock(){const[t,setT]=useState(new Date());useEffect(()=>{const id=setInterval(()=>setT(new Date()),1000);return()=>clearInterval(id)},[]);return <div className="clock"><I.Clock3/><b>{t.toLocaleTimeString('pt-BR')}</b></div>}

function CustomerPickerModal({customers,selected,close,choose}){
 const [q,setQ]=useState('');
 const filtered=customers.filter(c=>{const term=q.trim().toLowerCase();return !term||String(c.name||'').toLowerCase().includes(term)||String(c.phone||'').includes(term)||String(c.id||'').includes(term)});
 return <Modal title="Escolher cliente" close={close} wide><div className="search"><I.Search/><input autoFocus placeholder="Pesquisar por nome, telefone ou código..." value={q} onChange={e=>setQ(e.target.value)}/></div><div className="pickerlist">{filtered.length?filtered.map(c=><button className={`pickeritem ${selected?.id===c.id?'selected':''}`} key={c.id} onClick={()=>choose(c)}><span><b>#{c.id} · {c.name}</b><small>{c.phone||'Sem telefone'}{Number(c.debit_cents||0)>0?` · Débito ${brl(c.debit_cents)}`:''}</small></span><I.ChevronRight/></button>):<div className="empty compact"><I.Users/><p>Nenhum cliente encontrado.</p></div>}</div><div className="modalactions"><button onClick={close}>Cancelar</button><button onClick={()=>choose(null)}>Sem cliente</button></div></Modal>
}
function OperatorPickerModal({operators,selected,close,choose}){
 const [q,setQ]=useState('');
 const filtered=operators.filter(o=>String(o.name||'').toLowerCase().includes(q.trim().toLowerCase())||String(o.id||'').includes(q.trim()));
 return <Modal title="Escolher operador" close={close} wide><div className="search"><I.Search/><input autoFocus placeholder="Pesquisar por nome ou código..." value={q} onChange={e=>setQ(e.target.value)}/></div><div className="pickerlist">{filtered.length?filtered.map(o=><button className={`pickeritem ${selected?.id===o.id?'selected':''}`} key={o.id} onClick={()=>choose(o)}>{o.photo_data?<img className="pickeravatar" src={o.photo_data}/>:<span className="pickeravatar fallback"><I.UserRound/></span>}<span><b>#{o.id} · {o.name}</b><small>Operador</small></span><I.ChevronRight/></button>):<div className="empty compact"><I.Users/><p>Nenhum operador encontrado.</p></div>}</div><div className="modalactions"><button onClick={close}>Cancelar</button></div></Modal>
}
function CheckoutModal({total,subtotal,discountPercent,discountCents,payments,setPayments,customer,onClose,onFinish,addPayment}){ const[printReceipt,setPrintReceipt]=useState(false),[scheduleReceipt,setScheduleReceipt]=useState(false),[receiptAt,setReceiptAt]=useState(''),[alertAt,setAlertAt]=useState(''),[submitting,setSubmitting]=useState(false);
 const update=(idx,patch)=>setPayments(ps=>ps.map((p,i)=>i===idx?{...p,...patch}:p));
 const remove=(idx)=>setPayments(ps=>ps.filter((_,i)=>i!==idx));
 const calc=(p)=>{const original=Math.max(0,Number(p.original_cents||0));const fee=p.method==='Cartão de crédito'?Math.max(0,Number(p.fee_percent||0)):0;const feeC=Math.round(original*fee/100);return {...p,fee_percent:fee,fee_cents:feeC,final_cents:original+feeC,installments:p.method==='Cartão de crédito'?Math.max(1,Number(p.installments||1)):1}};
 const rows=payments.map(calc); const paidBase=rows.reduce((sum,p)=>sum+Number(p.original_cents||0),0); const totalFees=rows.reduce((sum,p)=>sum+Number(p.fee_cents||0),0); const paidFinal=rows.reduce((sum,p)=>sum+(p.method==='Venda a prazo'?Number(p.original_cents||0):Number(p.final_cents||0)),0); const totalWithFees=total+totalFees; const balance=Math.max(0,total-paidBase); const hasCredit=rows.some(p=>p.method==='Venda a prazo'); const hasCash=rows.some(p=>p.method==='Dinheiro'); const cashOnlyOverpay=rows.length===1&&rows[0]?.method==='Dinheiro'&&Number(rows[0]?.original_cents||0)>total; const change=cashOnlyOverpay?Math.max(0,Number(rows[0].original_cents||0)-total):0; const overWithoutCash=paidBase>total&&!hasCash; const mixedOverpay=paidBase>total&&hasCash&&!cashOnlyOverpay;
 const canConfirm=((paidBase>=total)||hasCredit)&&!overWithoutCash&&!mixedOverpay&&(!hasCredit||!!customer)&&(!scheduleReceipt||!!receiptAt);
 return <Modal title="Finalizar pagamento" close={onClose} wide>
  <div className="checkoutsummary"><div><span>Subtotal</span><b>{brl(subtotal)}</b></div>{discountCents>0&&<div><span>Desconto ({Number(discountPercent||0).toLocaleString('pt-BR',{maximumFractionDigits:2})}%)</span><b>- {brl(discountCents)}</b></div>}<div><span>Total da venda</span><b>{brl(total)}</b></div>{totalFees>0&&<><div><span>Taxas do cartão</span><b>+ {brl(totalFees)}</b></div><div><span>Total com taxas</span><b>{brl(totalWithFees)}</b></div></>}<div><span>Valor pago agora</span><b>{brl(Math.min(Math.max(0,paidFinal-change),totalWithFees))}</b></div><div className={balance>0?'warntext':change>0?'oktext':''}><span>{balance>0?'Saldo devedor':change>0?'Troco':'Situação'}</span><b>{balance>0?brl(balance):change>0?brl(change):'Valor exato'}</b></div></div>
  {customer&&<div className="selected-customer"><I.UserRound/><span>Cliente selecionado</span><b>{customer.name}</b></div>}
  <div className="paymentlist">{rows.map((pay,i)=><div className="paymentrow" key={i}>
   <label>Meio<ThemedSelect value={pay.method} onChange={e=>update(i,{method:e.target.value,original_cents:e.target.value==='Venda a prazo'?0:pay.original_cents})}><option>Dinheiro</option><option>PIX</option><option>Cartão de débito</option><option>Cartão de crédito</option><option>Venda a prazo</option></ThemedSelect></label>
   <label>{pay.method==='Venda a prazo'?'Valor pago agora (pode ser R$ 0,00)':pay.method==='Dinheiro'?'Valor recebido':'Valor'}{pay.method==='Dinheiro'?<PaymentMoneyInput value={pay.original_cents} onChange={v=>update(i,{original_cents:v})}/>:<input inputMode="decimal" value={priceText(pay.original_cents)} onChange={e=>update(i,{original_cents:centsFromInput(e.target.value)})} onBlur={e=>update(i,{original_cents:centsFromInput(e.target.value)})}/>}</label>
   {pay.method==='Cartão de crédito'&&<><label>Parcelas<input type="number" min="1" value={pay.installments||1} onChange={e=>update(i,{installments:Number(e.target.value)||1})}/></label><label>Taxa %<input type="number" min="0" step="0.01" value={pay.fee_percent||0} onChange={e=>update(i,{fee_percent:Number(e.target.value)||0})}/></label></>}
   <div className="paymentfinal"><small>{pay.method==='Venda a prazo'?'Pago na entrada':'Total'}</small><b>{brl(pay.method==='Venda a prazo'?pay.original_cents:pay.final_cents)}</b></div><button className="iconbtn danger" disabled={rows.length===1} onClick={()=>remove(i)}><I.Trash2/></button>
  </div>)}</div>
  {hasCredit&&<div className="credit-schedule panel"><label className="printoption"><input type="checkbox" checked={scheduleReceipt} onChange={e=>setScheduleReceipt(e.target.checked)}/> Agendar recebimento do saldo devedor</label>{scheduleReceipt&&<div className="formgrid"><label>Data e hora do recebimento<input type="datetime-local" value={receiptAt} onChange={e=>setReceiptAt(e.target.value)}/></label><label>Data e hora do alerta<input type="datetime-local" value={alertAt} onChange={e=>setAlertAt(e.target.value)}/></label></div>}<p className="muted">O agendamento ficará ligado a esta venda e aparecerá na Agenda de Recebimentos.</p></div>}
  {change>0&&hasCash&&<div className="changebox"><I.CreditCard/><span>Troco a devolver ao cliente</span><strong>{brl(change)}</strong></div>}
  <label className="printoption"><input type="checkbox" checked={printReceipt} onChange={e=>setPrintReceipt(e.target.checked)}/> Imprimir cupom de venda ao finalizar</label><div className="modalactions"><button onClick={addPayment}><I.Plus/> Adicionar pagamento</button><button onClick={onClose}>Cancelar</button><button className="primary" disabled={!canConfirm||submitting} onClick={async()=>{if(submitting)return;setSubmitting(true);try{setPayments(rows);await onFinish(change,printReceipt,rows,scheduleReceipt?{scheduled_at:receiptAt,alert_at:alertAt}:null)}finally{setSubmitting(false)}}}><I.Check/> {submitting?'Processando...':'Confirmar venda'}</button></div>
  {hasCredit&&!customer&&<p className="hint">Selecione o cliente na tela da venda antes de confirmar a venda a prazo.</p>}
 </Modal>
}

let saleSoundAudio=null;
function fallbackSaleSound(){try{const C=window.AudioContext||window.webkitAudioContext;if(!C)return;const ctx=new C();const t=ctx.currentTime;[[740,0],[980,.08],[1320,.17]].forEach(([f,o])=>{const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type='sine';osc.frequency.value=f;gain.gain.setValueAtTime(.0001,t+o);gain.gain.exponentialRampToValueAtTime(.05,t+o+.01);gain.gain.exponentialRampToValueAtTime(.0001,t+o+.12);osc.connect(gain);gain.connect(ctx.destination);osc.start(t+o);osc.stop(t+o+.13)});setTimeout(()=>ctx.close().catch(()=>{}),600)}catch{}}
function playSaleSound(){try{if(!saleSoundAudio){saleSoundAudio=new Audio(cashRegisterSound);saleSoundAudio.preload='auto';saleSoundAudio.volume=.28}saleSoundAudio.pause();saleSoundAudio.currentTime=0;const p=saleSoundAudio.play();if(p&&typeof p.catch==='function')p.catch(()=>fallbackSaleSound())}catch{fallbackSaleSound()}}


function QuotePickerModal({quotes,close,choose}){
  const[q,setQ]=useState('');

  const filtered=(quotes||[]).filter(x=>{
    const term=q.trim().toLocaleLowerCase('pt-BR');
    return !term
      ||String(x.number||'').includes(term)
      ||String(x.customer_name||'').toLocaleLowerCase('pt-BR').includes(term);
  });

  return <Modal title="Orçamentos em aberto" close={close} wide>
    <div className="search">
      <I.Search/>
      <input
        autoFocus
        placeholder="Pesquisar por número ou cliente..."
        value={q}
        onChange={e=>setQ(e.target.value)}
      />
    </div>

    <div className="pickerlist">
      {filtered.length
        ?filtered.map(x=>
          <button
            className="pickeritem"
            key={x.id}
            onClick={()=>choose(x)}
          >
            <span>
              <b>#{x.number} · {x.customer_name||'Cliente não informado'}</b>
              <small>{fmtDate(x.created_at)} · {brl(x.total_cents)}</small>
            </span>
            <I.ChevronRight/>
          </button>
        )
        :<div className="empty compact">
          <I.FileText/>
          <p>Nenhum orçamento em aberto.</p>
        </div>
      }
    </div>

    <div className="modalactions">
      <button onClick={close}>Cancelar</button>
    </div>
  </Modal>;
}

function Caixa({settings,notify}){
 const[products,setProducts]=useState([]),[allProducts,setAllProducts]=useState([]),[cats,setCats]=useState([]),[cat,setCat]=useState(null),[q,setQ]=useState(''),[kits,setKits]=useState([]),[cart,setCart]=useState([]),[volumeProduct,setVolumeProduct]=useState(null),[customer,setCustomer]=useState(null),[customers,setCustomers]=useState([]),[customerPicker,setCustomerPicker]=useState(false),[operatorPicker,setOperatorPicker]=useState(false),[operators,setOperators]=useState([]),[operator,setOperator]=useState(null),[payments,setPayments]=useState([]),[discountPct,setDiscountPct]=useState(0),[deliveryCents,setDeliveryCents]=useState(0),[deliveryRequired,setDeliveryRequired]=useState(false),[loading,setLoading]=useState(true),[checkoutOpen,setCheckoutOpen]=useState(false),[change,setChange]=useState(0),[cashOpen,setCashOpen]=useState(false),[barcode,setBarcode]=useState(''),[quotes,setQuotes]=useState([]),[quotePicker,setQuotePicker]=useState(false),[sourceQuote,setSourceQuote]=useState(null),[weighingProduct,setWeighingProduct]=useState(null),[mixWeighing,setMixWeighing]=useState(null),[mixVolume,setMixVolume]=useState(null);
 const refresh=useDataRefresh();
 const[catalogView,setCatalogView]=useViewMode('vendas-catalogo','blocks');
 const load=async()=>{setLoading(true);try{const [c,cs,os,cash,qs,all]=await Promise.all([
  window.api.categories.list(),
  window.api.customers.list(),
  window.api.operators.list(),
  window.api.cash.current(),
  window.api.quotes.list(),
  window.api.products.list('')
]);setCashOpen(!!cash);setQuotes((qs||[]).filter(x=>x.status==='ABERTO'));setAllProducts(all||[]);setCats(c);setCustomers(cs);setOperators(os);const current=os.find(o=>String(o.id)===String(settings.current_operator_id));setOperator(current||os[0]||null);const kitCat=c.find(x=>x.name==='Kits / Combos');const kitSelected=kitCat&&String(cat)===String(kitCat.id);if(kitSelected){setProducts([]);setKits(await window.api.kits.list(kitCat.id))}else{setProducts(await window.api.products.list(q,cat));setKits(cat?[]:await window.api.kits.list(null))}}catch(e){notify(e)}finally{setLoading(false)}};
  useEffect(()=>{load()},[q,cat,settings.current_operator_id,refresh]);
 const add=(x,isKit=false)=>{if(isKit&&['MIX_VOLUME_L','MIX_VOLUME_ML'].includes(String(x.kit_type||''))){const existing=cart.find(i=>i.sale_mode===x.kit_type&&Number(i.kit_id)===Number(x.id));setMixVolume({mix:x,editId:existing?.id||null,volume_ml:Number(existing?.volume_ml||0),mix_items:existing?.mix_items||[]});return}if(isKit&&String(x.kit_type||'STANDARD')==='MIX_WEIGHT'){const existing=cart.find(i=>i.sale_mode==='MIX_WEIGHT'&&Number(i.kit_id)===Number(x.id));setMixWeighing({mix:x,editId:existing?.id||null,weight_grams:Number(existing?.weight_grams||0),mix_items:existing?.mix_items||[]});return}if(!isKit&&String(x.sale_mode||'UNIT')==='WEIGHT'){setWeighingProduct(x);return}if(!isKit&&isVolumeLikeMode(x.sale_mode)){setVolumeProduct(x);return}setCart(c=>{const id=(isKit?'k':'p')+x.id,old=c.find(i=>i.id===id);if(old&&!isKit&&x.item_type!=='SERVICE'&&Number(old.qty)>=Number(x.stock||0)){notify(`Estoque disponível de ${x.name}: ${x.stock} ${x.unit||'un'}.`);return c}return old?c.map(i=>i.id===id?{...i,qty:i.qty+1,stock:(isKit||x.item_type==='SERVICE')?null:x.stock,unit:x.unit||'un'}:i):[...c,{id,name:x.name,price_cents:x.price_cents,qty:1,stock:(isKit||x.item_type==='SERVICE')?null:x.stock,unit:x.unit||'un',sale_mode:'UNIT',kit_id:isKit?x.id:null,product_id:isKit?null:x.id}]})};
 const addVolume=(product,ml)=>setCart(c=>{const id=product._replaceCartId||('v'+product.id);const old=c.find(i=>i.id===id);const next=Number(old?.volume_ml||0)+Number(ml||0);if(product._replaceCartId)return c.map(i=>i.id===id?{...i,volume_ml:Number(ml),qty:1,needs_volume:false}:i);if(next>Number(product.stock||0)){notify('Volume maior que o estoque disponível.');return c}return old?c.map(i=>i.id===id?{...i,volume_ml:next}:i):[...c,{id,name:product.name,price_cents:product.price_cents,qty:1,volume_ml:Number(ml),stock:product.stock,unit:product.unit,sale_mode:product.sale_mode,kit_id:null,product_id:product.id}]});
 const addWeighted=(x,grams,unitCount=0)=>setCart(c=>{const id=x._replaceCartId||('p'+x.id),old=c.find(i=>i.id===id);if(x._replaceCartId){return c.map(i=>i.id===id?{...i,weight_grams:Number(grams||0),unit_count:Number(unitCount||0),stock:x.stock,linked_unit_product_id:x.linked_unit_product_id||null,linked_unit_name:x.linked_unit_name||'',linked_unit_stock:Number(x.linked_unit_stock||0),track_unit_stock:Number(x.track_unit_stock||0),unit_stock:Number(x.unit_stock||0),unit_min_stock:Number(x.unit_min_stock||0),default_units_per_kg:Number(x.default_units_per_kg||0),sale_mode:'WEIGHT',unit:'kg',qty:1,needs_weigh:false}:i)}const current=Number(old?.weight_grams||0),next=current+Number(grams||0),currentUnits=Number(old?.unit_count||0),nextUnits=currentUnits+Number(unitCount||0);if(next>Number(x.stock||0)){notify(`Estoque disponível de ${x.name}: ${weightLabel(x.stock)}.`);return c}if(Number(x.track_unit_stock||0)===1&&nextUnits>Number(x.unit_stock||0)){notify(`Estoque unitário disponível de ${x.name}: ${Number(x.unit_stock||0)} un.`);return c}if(Number(x.track_unit_stock||0)!==1&&x.linked_unit_product_id&&nextUnits>Number(x.linked_unit_stock||0)){notify(`Estoque unitário disponível de ${x.linked_unit_name||x.name}: ${Number(x.linked_unit_stock||0)} un.`);return c}return old?c.map(i=>i.id===id?{...i,weight_grams:next,unit_count:nextUnits,stock:x.stock,linked_unit_product_id:x.linked_unit_product_id||null,linked_unit_name:x.linked_unit_name||'',linked_unit_stock:Number(x.linked_unit_stock||0),track_unit_stock:Number(x.track_unit_stock||0),unit_stock:Number(x.unit_stock||0),unit_min_stock:Number(x.unit_min_stock||0),default_units_per_kg:Number(x.default_units_per_kg||0),sale_mode:'WEIGHT',unit:'kg',qty:1,needs_weigh:false}:i):[...c,{id,name:x.name,price_cents:x.price_cents,qty:1,weight_grams:Number(grams||0),unit_count:Number(unitCount||0),stock:x.stock,unit:'kg',sale_mode:'WEIGHT',linked_unit_product_id:x.linked_unit_product_id||null,linked_unit_name:x.linked_unit_name||'',linked_unit_stock:Number(x.linked_unit_stock||0),track_unit_stock:Number(x.track_unit_stock||0),unit_stock:Number(x.unit_stock||0),unit_min_stock:Number(x.unit_min_stock||0),default_units_per_kg:Number(x.default_units_per_kg||0),needs_weigh:false,kit_id:null,product_id:x.id}]});const addMixVolume=(mix,ml,items,replaceId=null)=>setCart(c=>{const mode=String(mix.kit_type),id=replaceId||('mv'+mix.id),normalized=(items||[]).map(x=>({product_id:Number(x.product_id),name:x.name||'',quantity:1,volume_ml:Math.max(0,Math.round(Number(x.volume_ml||0)))})).filter(x=>x.product_id&&x.volume_ml>0);const row={id,name:mix.name,price_cents:Number(mix.price_cents||0),qty:1,volume_ml:Number(ml||0),sale_mode:mode,kit_id:Number(mix.id),product_id:null,mix_items:normalized,needs_volume:false};return replaceId?c.map(x=>x.id===replaceId?row:x):[...c,row]});
 const addMixWeighted=(mix,grams,mixItems,replaceId=null)=>setCart(c=>{
  const id=replaceId||`m${mix.id}`;
  const normalized=(mixItems||[]).map(x=>({product_id:Number(x.product_id),name:x.name||'',quantity:Math.max(0,Math.round(Number(x.quantity||0))),weight_grams:Math.max(0,Math.round(Number(x.weight_grams||0)))})).filter(x=>x.product_id&&x.quantity>0&&x.weight_grams>0);
  if(replaceId){const unitCount=normalized.reduce((s,x)=>s+x.quantity,0);const row={id,name:mix.name,price_cents:Number(mix.price_cents||0),qty:1,weight_grams:Number(grams||0),unit_count:unitCount,sale_mode:'MIX_WEIGHT',kit_type:'MIX_WEIGHT',kit_id:Number(mix.id),product_id:null,mix_items:normalized,mix_category_id:mix.mix_category_id||null,mix_category_name:mix.mix_category_name||'',weight_product_id:mix.weight_product_id||null,needs_weigh:false};return c.map(x=>x.id===replaceId?row:x)}
  const old=c.find(x=>x.id===id&&x.sale_mode==='MIX_WEIGHT');
  if(old){
    const map=new Map((old.mix_items||[]).map(x=>[Number(x.product_id),{...x,quantity:Number(x.quantity||0)}]));
    for(const x of normalized){const cur=map.get(x.product_id);map.set(x.product_id,{product_id:x.product_id,name:x.name||cur?.name||'',quantity:Number(cur?.quantity||0)+x.quantity,weight_grams:Number(cur?.weight_grams||0)+x.weight_grams})}
    const merged=[...map.values()],unitCount=merged.reduce((s,x)=>s+Number(x.quantity||0),0);
    return c.map(x=>x.id===id?{...x,weight_grams:Number(x.weight_grams||0)+Number(grams||0),unit_count:unitCount,mix_items:merged,needs_weigh:false}:x);
  }
  const unitCount=normalized.reduce((s,x)=>s+x.quantity,0);
  return [...c,{id,name:mix.name,price_cents:Number(mix.price_cents||0),qty:1,weight_grams:Number(grams||0),unit_count:unitCount,sale_mode:'MIX_WEIGHT',kit_type:'MIX_WEIGHT',kit_id:Number(mix.id),product_id:null,mix_items:normalized,mix_category_id:mix.mix_category_id||null,mix_category_name:mix.mix_category_name||'',weight_product_id:mix.weight_product_id||null,needs_weigh:false}];
});const loadQuote=async q=>{
  try{
    const detail=await window.api.quotes.detail(q.id);

    if(detail.status!=='ABERTO')
      throw new Error(`O orçamento #${detail.number} não está mais em aberto.`);

    const allProductsNow=await window.api.products.list('');
    const allKitsNow=await window.api.kits.list(null);
    setAllProducts(allProductsNow||[]);
    const productMap=new Map((allProductsNow||[]).map(p=>[Number(p.id),p]));
    const kitMap=new Map((allKitsNow||[]).map(k=>[Number(k.id),k]));
    setCart((detail.items||[]).map(i=>{
      const mode=String(i.sale_mode||'UNIT');
      if(mode==='WEIGHT'&&i.product_id){
        const p=productMap.get(Number(i.product_id))||{};
        return {id:`p${i.product_id}`,name:i.name,price_cents:Number(i.unit_price_cents||p.price_cents||0),qty:1,weight_grams:Number(i.weight_grams||0),unit_count:Number(i.unit_count||0),sale_mode:'WEIGHT',unit:'kg',stock:Number(p.stock||0),linked_unit_product_id:p.linked_unit_product_id||null,linked_unit_name:p.linked_unit_name||'',linked_unit_stock:Number(p.linked_unit_stock||0),track_unit_stock:Number(p.track_unit_stock||0),unit_stock:Number(p.unit_stock||0),unit_min_stock:Number(p.unit_min_stock||0),default_units_per_kg:Number(p.default_units_per_kg||0),needs_weigh:true,kit_id:null,product_id:i.product_id};
      }
      if(['MIX_VOLUME_L','MIX_VOLUME_ML'].includes(mode)&&i.kit_id){
        const k=kitMap.get(Number(i.kit_id))||{};
        return {id:`vm${i.kit_id}`,name:i.name,price_cents:Number(i.unit_price_cents||k.price_cents||0),qty:1,volume_ml:Number(i.volume_ml||0),sale_mode:mode,kit_type:mode,mix_items:i.mix_items||[],mix_category_id:k.mix_category_id||null,volume_product_id:k.volume_product_id||null,needs_volume:true,kit_id:i.kit_id,product_id:null};
      }
      if(['VOLUME_L','VOLUME_ML'].includes(mode)&&i.product_id){
        const p=productMap.get(Number(i.product_id))||{};
        return {id:`v${i.product_id}`,name:i.name,price_cents:Number(i.unit_price_cents||p.price_cents||0),qty:1,volume_ml:Number(i.volume_ml||0),sale_mode:mode,unit:p.unit||'ml',stock:Number(p.stock||0),needs_volume:true,kit_id:null,product_id:i.product_id};
      }
      if(mode==='MIX_WEIGHT'&&i.kit_id){
        const k=kitMap.get(Number(i.kit_id))||{};
        return {id:`m${i.kit_id}`,name:i.name,price_cents:Number(i.unit_price_cents||k.price_cents||0),qty:1,weight_grams:Number(i.weight_grams||0),unit_count:Number(i.unit_count||0),sale_mode:'MIX_WEIGHT',kit_type:'MIX_WEIGHT',mix_items:i.mix_items||[],mix_category_id:k.mix_category_id||null,mix_category_name:k.mix_category_name||'',weight_product_id:k.weight_product_id||null,needs_weigh:true,kit_id:i.kit_id,product_id:null};
      }
      return {id:i.kit_id?`k${i.kit_id}`:`p${i.product_id}`,name:i.name,price_cents:Number(i.unit_price_cents||0),qty:Number(i.quantity||1),sale_mode:'UNIT',kit_id:i.kit_id||null,product_id:i.product_id||null};
    }));

    const selectedCustomer=detail.customer_id
      ? customers.find(c=>String(c.id)===String(detail.customer_id))
      : null;

    setCustomer(selectedCustomer||null);
    setDiscountPct(Number(detail.discount_percent||0));
    setDeliveryCents(Number(detail.delivery_cents||0));
    setDeliveryRequired(Number(detail.delivery_cents||0)>0);
    setPayments([]);
    setSourceQuote(detail);
    setQuotePicker(false);

    notify(`Orçamento #${detail.number} carregado para venda.`);
  }catch(e){
    notify(e);
  }
};
useEffect(()=>{
  const fn=async e=>{
    const id=Number(e.detail?.id||0);
    if(!id)return;

    try{
      const quote=await window.api.quotes.detail(id);
      await loadQuote(quote);
    }catch(err){
      notify(err);
    }
  };

  window.addEventListener('quote-to-sale',fn);

  return()=>{
    window.removeEventListener('quote-to-sale',fn);
  };
},[customers]);
 const subtotal=cart.reduce((s,i)=>s+cartItemTotal(i),0);const discountPercent=Math.min(100,Math.max(0,Number(discountPct||0)));const discountCents=Math.min(subtotal,Math.round(subtotal*discountPercent/100));const total=subtotal-discountCents+Math.max(0,Number(deliveryCents||0));const paid=payments.reduce((s,p)=>s+(p.original_cents||0),0);const due=Math.max(0,total-paid);
 const beginCheckout=()=>{if(!cashOpen){notify('É necessário abrir o caixa antes de realizar uma venda. Abra o caixa no menu Caixa.');return}if(!cart.length)return;if(deliveryRequired&&!customer){notify('Selecione o cliente antes de continuar: esta venda está marcada para entrega.');return}const pendingWeight=cart.find(i=>isWeightLikeMode(i.sale_mode)&&i.needs_weigh);if(pendingWeight){notify(`Confirme a pesagem/composição real de "${pendingWeight.name}" antes do pagamento.`);return}const pendingVolume=cart.find(i=>isVolumeLikeMode(i.sale_mode)&&(!Number(i.volume_ml||0)||i.needs_volume));if(pendingVolume){notify(`Confirme o volume de "${pendingVolume.name}" antes do pagamento.`);return}setPayments([{method:'Dinheiro',original_cents:total,fee_percent:0,fee_cents:0,final_cents:total,installments:1}]);setCheckoutOpen(true)};
 useEffect(()=>{const fn=()=>beginCheckout();window.addEventListener('shortcut:checkout',fn);return()=>window.removeEventListener('shortcut:checkout',fn)},[cashOpen,cart,total]);
 const finish=async(changeValue=0,printReceipt=false,normalizedPayments=payments,receiptSchedule=null)=>{try{const paidBase=normalizedPayments.reduce((sum,p)=>sum+Math.max(0,Number(p.original_cents||0)),0);const currentDue=Math.max(0,total-paidBase);if(currentDue>0&&!customer)throw new Error('Selecione um cliente para venda a prazo.');const id=await window.api.sales.create({items:cart.map(i=>({kit_id:i.kit_id,product_id:i.product_id,name:i.name,quantity:i.qty,weight_grams:i.weight_grams||0,volume_ml:i.volume_ml||0,unit_count:i.unit_count||0,sale_mode:i.sale_mode||'UNIT',unit_price_cents:i.price_cents,mix_items:i.mix_items||[]})),payments:normalizedPayments,customer_id:customer?.id||null,customer_name:customer?.name||'',operator:operator?.name||settings.operator||'Caixa',discount_percent:discountPercent,change_cents:changeValue,delivery_cents:Math.max(0,Number(deliveryCents||0)),delivery_required:deliveryRequired?1:0,
receipt_schedule:receiptSchedule,
quote_id:sourceQuote?.id||null});if(printReceipt){try{await window.api.sales.print(id)}catch(printErr){notify('Venda registrada, mas não foi possível imprimir o cupom: '+(printErr?.message||printErr))}}playSaleSound();setCart([]);setCustomer(null);setPayments([]);setDiscountPct(0);setDeliveryCents(0);setDeliveryRequired(false);setSourceQuote(null);setCheckoutOpen(false);setChange(0);await load();dataChanged();notify(`Venda #${id} registrada com sucesso.`)}catch(e){notify(e)}};
 const addPayment=()=>setPayments(p=>[...p,{method:'PIX',original_cents:Math.max(0,total-p.reduce((s,x)=>s+x.original_cents,0)),fee_percent:0,fee_cents:0,final_cents:0,installments:1}]);
 const kitCategory=cats.find(x=>x.name==='Kits / Combos');
 const scan=async e=>{if(e.key!=='Enter')return;e.preventDefault();const code=onlyDigits(barcode);if(!code)return;try{const p=await window.api.products.barcode(code);add(p);setBarcode('')}catch(err){notify(err);setBarcode('')}};
 return <div className="pos">{!cashOpen&&<div className="cash-required-banner"><I.Lock/><div><b>Caixa fechado</b><span>Abra o caixa no menu Caixa para poder realizar vendas.</span></div></div>}<section className="catalog panel"><div className="barcodebox"><I.ScanLine/><input value={barcode} onChange={e=>setBarcode(e.target.value)} onKeyDown={scan} placeholder="Passe o leitor no código de barras e pressione Enter..."/><span>Leitor USB/Bluetooth</span></div><div className="search"><I.Search/><input placeholder="Buscar produto ou código..." value={q} onChange={e=>setQ(e.target.value)}/></div><div className="categorystrip"><button className={!cat?'cat active':'cat'} onClick={()=>setCat(null)}><I.LayoutGrid/>Todos</button>{cats.map(c=>{const Icon=icons[c.icon]||I.Package;return <button className={String(cat)===String(c.id)?'cat active':'cat'} key={c.id} onClick={()=>setCat(c.id)}><Icon/><span>{c.name}</span></button>})}</div><Loading loading={loading}><div className="catalog-section-head"><h3 className="sectionlabel">{String(cat)===String(kitCategory?.id)?'Kits / Combos':'Produtos'}</h3>{String(cat)!==String(kitCategory?.id)&&<ViewModeMenu value={catalogView} onChange={setCatalogView}/>}</div>{String(cat)!==String(kitCategory?.id)&&<div className={`productgrid ux-sales-products ux-view-${catalogView}`}> {products.map(p=><button className="productcard" onClick={()=>add(p)} key={p.id}><div className="pcicon">{React.createElement(categoryIconFor(p))}</div><div className="pname">{p.name}</div><small>{p.category||'Diversos'} • estoque {stockLabel(p)}</small><strong>{brl(p.price_cents)}{p.sale_mode==='WEIGHT'?<em>/kg</em>:p.sale_mode==='VOLUME_L'?<em>/L</em>:p.sale_mode==='VOLUME_ML'?<em>/ml</em>:null}</strong>{p.sale_mode==='WEIGHT'&&<span className="product-weight-badge"><I.Scale/> pesar</span>}</button>)}</div>}{(String(cat)===String(kitCategory?.id)||!cat)&&<>{!cat&&<h3 className="sectionlabel">Combos / Kits</h3>}<div className="kitgrid">{kits.map(k=>{const mix=String(k.kit_type||'STANDARD')==='MIX_WEIGHT',volumeMix=['MIX_VOLUME_L','MIX_VOLUME_ML'].includes(String(k.kit_type||''));return <button className="kitcard" onClick={()=>add(k,true)} key={k.id}>{mix?<I.Scale/>:volumeMix?<I.Beaker/>:<I.Layers/>}<b>{k.name}</b><strong>{brl(k.price_cents)}{mix?<em>/kg</em>:k.kit_type==='MIX_VOLUME_L'?<em>/L</em>:k.kit_type==='MIX_VOLUME_ML'?<em>/ml</em>:null}</strong>{mix&&<small>Mix por Peso</small>}{k.kit_type==='MIX_VOLUME_L'&&<small>Mix por Litro</small>}{k.kit_type==='MIX_VOLUME_ML'&&<small>Mix por Mililitro</small>}</button>})}</div></>}</Loading></section><section className="cart panel"><div className="paneltitle"><h2>Venda atual</h2><span>{cart.reduce((n,x)=>n+(isWeightLikeMode(x.sale_mode)?1:Number(x.qty||0)),0)} item(ns)</span></div><div className="selectionrow">
  <button
    className="selectorbtn"
    onClick={()=>setQuotePicker(true)}
  >
    <I.FileText/>
    <span>
      {sourceQuote
        ? `Orçamento #${sourceQuote.number}`
        : 'Carregar orçamento em aberto'}
    </span>
  </button>

  {sourceQuote&&
    <button
      className="clearbtn"
      title="Desvincular orçamento"
      onClick={()=>{
        setSourceQuote(null);
        setCart([]);
        setCustomer(null);
        setDiscountPct(0);
        setDeliveryCents(0);
        setDeliveryRequired(false);
        setPayments([]);
      }}
    >
      ×
    </button>
  }
</div><div className="cartlist">{cart.length?cart.map(i=><div className="cartrow" key={i.id}><div><b>{i.name}</b>{i.sale_mode==='WEIGHT'?<small>{i.needs_weigh?'Peso do orçamento — confirmar pesagem: ':''}{weightLabel(i.weight_grams)} × {brl(i.price_cents)}/kg{Number(i.unit_count||0)>0?` · ${Number(i.unit_count)} un.`:''} · restante: {weightLabel(Math.max(0,Number(i.stock||0)-Number(i.weight_grams||0)))}{i.linked_unit_product_id?` · estoque unitário restante: ${Math.max(0,Number(i.linked_unit_stock||0)-Number(i.unit_count||0))} un.`:''}</small>:String(i.sale_mode||'').startsWith('MIX_VOLUME_')?<><small>{volumeLabel(i.volume_ml)} × {brl(i.price_cents)}/{String(i.sale_mode).endsWith('_L')?'L':'ml'} · {(i.mix_items||[]).length} componente(s)</small><small>{(i.mix_items||[]).map(x=>x.name+' · '+volumeLabel(x.volume_ml)).join(' · ')}</small></>:isVolumeLikeMode(i.sale_mode)?<small>{volumeLabel(i.volume_ml)} × {brl(i.price_cents)}/{String(i.sale_mode).endsWith('_L')?'L':'ml'} · restante: {volumeLabel(Math.max(0,Number(i.stock||0)-Number(i.volume_ml||0)))}</small>:i.sale_mode==='MIX_WEIGHT'?<><small>{i.needs_weigh?'Mix do orçamento — confirmar composição/pesagem: ':''}{weightLabel(i.weight_grams)} × {brl(i.price_cents)}/kg · {Number(i.unit_count||0)} un. · {(i.mix_items||[]).length} cor(es)</small>{i.mix_items?.length?<small>{i.mix_items.map(x=>`${x.quantity} ${x.name} · ${weightLabel(x.weight_grams||0)}`).join(' · ')}</small>:null}</>:<small>{brl(i.price_cents)} un.{i.product_id&&i.stock!=null?` · restante após venda: ${Math.max(0,Number(i.stock)-Number(i.qty))} ${i.unit||'un'}`:''}</small>}</div>{i.sale_mode==='WEIGHT'?<div className="qty weight-qty"><button className={i.needs_weigh?'smallbtn danger':'smallbtn'} onClick={()=>setWeighingProduct({...i,id:i.product_id,_replaceCartId:i.id})}><I.Scale/> {i.needs_weigh?'Confirmar pesagem':'Ajustar pesagem'}</button><button className="dangerlink" onClick={()=>setCart(c=>c.filter(x=>x.id!==i.id))}>×</button></div>:String(i.sale_mode||'').startsWith('MIX_VOLUME_')?<div className="qty weight-qty"><button className="smallbtn" onClick={()=>{const mix=kits.find(k=>Number(k.id)===Number(i.kit_id))||i;setMixVolume({mix,editId:i.id,volume_ml:i.volume_ml||0,mix_items:i.mix_items||[]})}}><I.Beaker/> Ajustar Mix</button><button className="dangerlink" onClick={()=>setCart(c=>c.filter(x=>x.id!==i.id))}>×</button></div>:isVolumeLikeMode(i.sale_mode)?<div className="qty weight-qty"><button className="smallbtn" onClick={()=>setVolumeProduct({...i,...(allProducts.find(p=>Number(p.id)===Number(i.product_id))||{}),_replaceCartId:i.id,volume_ml:i.volume_ml})}><I.Beaker/> Ajustar volume</button><button className="dangerlink" onClick={()=>setCart(c=>c.filter(x=>x.id!==i.id))}>×</button></div>:String(i.sale_mode||'').startsWith('MIX_VOLUME_')?<div className="qty weight-qty"><button className="smallbtn" onClick={()=>{const mix=kits.find(k=>Number(k.id)===Number(i.kit_id))||i;setMixVolume({mix,editId:i.id,volume_ml:i.volume_ml||0,mix_items:i.mix_items||[]})}}><I.Beaker/> Ajustar Mix</button><button className="dangerlink" onClick={()=>setCart(c=>c.filter(x=>x.id!==i.id))}>×</button></div>:i.sale_mode==='MIX_WEIGHT'?<div className="qty weight-qty"><button className={i.needs_weigh?'smallbtn danger':'smallbtn'} onClick={()=>{const mix=kits.find(k=>Number(k.id)===Number(i.kit_id))||i;setMixWeighing({mix,editId:i.id,weight_grams:i.needs_weigh?0:(i.weight_grams||0),mix_items:i.mix_items||[]})}}><I.Scale/> {i.needs_weigh?'Confirmar Mix':'Ajustar Mix'}</button><button className="dangerlink" onClick={()=>setCart(c=>c.filter(x=>x.id!==i.id))}>×</button></div>:<div className="qty"><button onClick={()=>setCart(c=>c.map(x=>x.id===i.id?{...x,qty:Math.max(1,x.qty-1)}:x))}>−</button><b>{i.qty}</b><button disabled={!!i.product_id&&i.stock!=null&&Number(i.qty)>=Number(i.stock)} onClick={()=>setCart(c=>c.map(x=>x.id===i.id?{...x,qty:x.qty+1}:x))}>+</button><button className="dangerlink" onClick={()=>setCart(c=>c.filter(x=>x.id!==i.id))}>×</button></div>}<strong>{brl(cartItemTotal(i))}</strong></div>):<div className="empty"><I.ShoppingCart/><p>Adicione produtos, serviços ou combos.</p></div>}</div><div className="checkout"><div className="selectionrow"><button className="selectorbtn" onClick={()=>setCustomerPicker(true)}><I.UserRoundSearch/><span>{customer?customer.name:'Escolher cliente'}</span></button>{customer&&<button className="clearbtn" onClick={()=>setCustomer(null)}>×</button>}<button className="selectorbtn operatorbtn" onClick={()=>setOperatorPicker(true)}>{operator?.photo_data?<img src={operator.photo_data}/>:<I.UserRound/>}<span>{operator?.name||'Escolher operador'}</span></button></div><div className="formgrid"><label>Desconto (%)<div className="percentinput"><input type="number" min="0" max="100" step="0.01" inputMode="decimal" value={discountPct} onChange={e=>{const raw=String(e.target.value||'').replace(',','.');const n=Number(raw);setDiscountPct(raw===''?0:Math.min(100,Math.max(0,Number.isFinite(n)?n:0)))}} placeholder="0"/><span>%</span></div></label><label>Destino da compra<ThemedSelect value={deliveryRequired?'DELIVERY':'PICKUP'} onChange={e=>setDeliveryRequired(e.target.value==='DELIVERY')}><option value="PICKUP">Retirada na loja</option><option value="DELIVERY">Entrega ao cliente</option></ThemedSelect></label><label>Valor da entrega<CurrencyInput value={deliveryCents} onChange={setDeliveryCents} placeholder="R$ 0,00"/></label>{deliveryRequired&&<div className="ux-settings-note span2"><I.Truck/><span>Esta venda ficará marcada para entrega. Selecione um cliente para usar os dados de endereço e agendar a entrega depois na Agenda.</span></div>}</div><div className="salevalues"><span>Subtotal <b>{brl(subtotal)}</b></span>{discountCents>0&&<span>Desconto ({discountPercent.toLocaleString('pt-BR',{maximumFractionDigits:2})}%) <b>- {brl(discountCents)}</b></span>}{Number(deliveryCents||0)>0&&<span>Entrega <b>+ {brl(Number(deliveryCents||0))}</b></span>}<div className="total"><span>Total da venda</span><b>{brl(total)}</b></div></div><button className="primary big" disabled={!cart.length||!cashOpen} onClick={beginCheckout}><I.CreditCard/> Pagamento</button></div></section>{customerPicker&&<CustomerPickerModal customers={customers} selected={customer} close={()=>setCustomerPicker(false)} choose={c=>{setCustomer(c);setCustomerPicker(false)}}/>}{operatorPicker&&<OperatorPickerModal operators={operators} selected={operator} close={()=>setOperatorPicker(false)} choose={async o=>{setOperator(o);await window.api.settings.set({current_operator_id:o.id,current_operator_name:o.name,current_operator_photo:o.photo_data||'',current_operator_role:o.role==='admin'?'admin':'operator'});window.dispatchEvent(new CustomEvent('operator-changed',{detail:o}));setOperatorPicker(false)}}/>}{quotePicker&&
  <QuotePickerModal
    quotes={quotes}
    close={()=>setQuotePicker(false)}
    choose={loadQuote}
  />
}{checkoutOpen&&<CheckoutModal total={total} subtotal={subtotal} discountPercent={discountPercent} discountCents={discountCents} payments={payments} setPayments={setPayments} customer={customer} onClose={()=>setCheckoutOpen(false)} onFinish={finish} addPayment={addPayment}/>} {mixVolume&&<MixVolumeModal mix={mixVolume.mix} products={allProducts} initialItems={mixVolume.mix_items||[]} close={()=>setMixVolume(null)} confirm={(ml,items)=>addMixVolume(mixVolume.mix,ml,items,mixVolume.editId||null)} notify={notify}/>} {volumeProduct&&<VolumeEntryModal product={volumeProduct} close={()=>setVolumeProduct(null)} confirm={ml=>addVolume(volumeProduct,ml)} notify={notify}/>} {weighingProduct&&<ScaleWeighModal product={weighingProduct} close={()=>setWeighingProduct(null)} addWeighted={addWeighted} notify={notify}/>} {mixWeighing&&<MixWeightModal mix={mixWeighing.mix} products={allProducts} initialWeightGrams={mixWeighing.weight_grams||0} initialMixItems={mixWeighing.mix_items||[]} close={()=>setMixWeighing(null)} confirm={(grams,items)=>addMixWeighted(mixWeighing.mix,grams,items,mixWeighing.editId||null)} notify={notify}/>}</div>
}
function CategoryManager({notify,close}){
 const[cats,setCats]=useState([]),
       [mainName,setMainName]=useState(''),
       [mainIcon,setMainIcon]=useState('package'),
       [sub,setSub]=useState({name:'',parent_id:'',icon:'package'}),
       [edit,setEdit]=useState(null),
       [editMain,setEditMain]=useState(null),
       [saving,setSaving]=useState(false),
       [deleteTarget,setDeleteTarget]=useState(null);

 const subInputRef=useRef(null);

 const load=async()=>{
   try{
     setCats(await window.api.categories.list())
   }catch(e){
     notify(e)
   }
 };

 useEffect(()=>{
   load()
 },[]);

 const mains=cats.filter(c=>!c.parent_id&&c.name!=='Kits / Combos');
 const adegaPresets=[['Cervejas','beer'],['Destilados','martini'],['Vinhos','wine'],['Refrigerantes','cup-soda'],['Gelo','snowflake']];
 const createAdegaPresets=async()=>{
   if(saving)return;
   setSaving(true);
   try{
     const existing=new Set(cats.filter(c=>!c.parent_id).map(c=>String(c.name||'').trim().toLocaleLowerCase('pt-BR')));
     const missing=adegaPresets.filter(([name])=>!existing.has(name.toLocaleLowerCase('pt-BR')));
     for(const[name,icon]of missing)await window.api.categories.save({name,parent_id:null,icon});
     await load();dataChanged();
     notify(missing.length? `${missing.length} categorias de adega adicionadas.`:'As categorias de adega já estão cadastradas.');
   }catch(e){notify(e)}finally{setSaving(false)}
 };


 const reset=()=>{
   setEdit(null);
   setEditMain(null);
   setMainName('');
   setMainIcon('package');
   setSub({name:'',parent_id:'',icon:'package'});
 };

 const saveMain=async()=>{
   try{
     if(!mainName.trim())
       throw new Error('Informe o nome da categoria principal.');

     setSaving(true);

     await window.api.categories.save({
       id:editMain?.id||null,
       name:mainName.trim(),
       parent_id:null,
       icon:mainIcon
     });

     const was=!!editMain;

     setMainName('');
     setMainIcon('package');
     setEditMain(null);

     await load();
     dataChanged();

     notify(
       was
         ? 'Categoria principal atualizada.'
         : 'Categoria principal cadastrada.'
     );
   }catch(e){
     notify(e)
   }finally{
     setSaving(false)
   }
 };

 const saveSub=async()=>{
   try{
     if(!sub.parent_id)
       throw new Error('Selecione a categoria principal.');

     if(!sub.name.trim())
       throw new Error('Informe o nome da subcategoria.');

     setSaving(true);

     await window.api.categories.save({
       id:edit?.id||null,
       name:sub.name.trim(),
       parent_id:Number(sub.parent_id),
       icon:sub.icon||'package'
     });

     const was=!!edit;
     const parent=sub.parent_id;

     setEdit(null);

     setSub({
       name:'',
       parent_id:parent,
       icon:'package'
     });

     await load();
     dataChanged();

     requestAnimationFrame(()=>{
       subInputRef.current?.focus()
     });

     notify(
       was
         ? 'Subcategoria atualizada.'
         : 'Subcategoria cadastrada.'
     );
   }catch(e){
     notify(e)
   }finally{
     setSaving(false)
   }
 };

 const editSub=c=>{
   setEditMain(null);
   setEdit(c);

   setSub({
     name:c.name,
     parent_id:c.parent_id||'',
     icon:c.icon||'package'
   });

   requestAnimationFrame(()=>{
     subInputRef.current?.focus()
   });
 };

 const remove=async id=>{
   try{
     await window.api.categories.delete(id);

     setDeleteTarget(null);

     setEdit(null);
     setEditMain(null);

     setMainName('');
     setMainIcon('package');

     setSub({
       name:'',
       parent_id:'',
       icon:'package'
     });

     await load();

     const deletedId=id;
     notify('Categoria excluída.',{label:'Desfazer',doneMessage:'Categoria restaurada.',run:async()=>{await window.api.categories.restore(deletedId);await load()}});

     setTimeout(()=>{
       dataChanged()
     },0);
   }catch(e){
     setDeleteTarget(null);
     notify(e)
   }
 };

 return <>
   <Modal
     wide
     title="Categorias e subcategorias"
     close={close}
   >
     <p className="muted">
       Crie livremente as categorias principais e cadastre subcategorias
       dentro de cada uma. A mesma subcategoria pode existir em categorias
       principais diferentes. Escolha um ícone específico para identificar
       visualmente os produtos.
     </p>

     <div className="category-create-box adega-category-presets"><div><h3><I.Beer/> Categorias para adega</h3><p className="muted">Adicione rapidamente as categorias mais usadas na Jhonnie Beer. As categorias existentes serão preservadas.</p></div><div className="adega-preset-list">{adegaPresets.map(([name,icon])=>{const Icon=icons[icon]||I.Package;const exists=mains.some(c=>String(c.name).trim().toLocaleLowerCase('pt-BR')===name.toLocaleLowerCase('pt-BR'));return <span className={exists?'adega-preset exists':'adega-preset'} key={name}><Icon/>{name}{exists&&<I.Check/>}</span>})}</div><div className="modalactions"><button type="button" className="primary" disabled={saving||adegaPresets.every(([name])=>mains.some(c=>String(c.name).trim().toLocaleLowerCase('pt-BR')===name.toLocaleLowerCase('pt-BR')))} onClick={createAdegaPresets}>{saving?'Adicionando...':'Adicionar categorias de adega'}</button></div></div>
     <div className="category-manager-grid">

       <div className="category-create-box">
         <h3>
           {editMain
             ? 'Editar categoria principal'
             : 'Nova categoria principal'}
         </h3>

         <div className="formgrid">
           <label className="span2">
             Nome da categoria

             <input
               autoFocus={!!editMain}
               value={mainName}
               onChange={e=>setMainName(e.target.value)}
               placeholder="Ex.: Perfumaria, Bebidas, Eletrônicos..."
               onKeyDown={e=>{
                 if(e.key==='Enter'){
                   e.preventDefault();
                   saveMain();
                 }
               }}
             />
           </label>

           <label>
             Ícone da categoria

             <ThemedSelect
               value={mainIcon}
               onChange={e=>setMainIcon(e.target.value)}
             >
               {ICON_OPTIONS.map(([id,label])=>
                 <option value={id} key={id}>
                   {label}
                 </option>
               )}
             </ThemedSelect>
           </label>
         </div>

         <div className="modalactions">
           <button
             type="button"
             onClick={reset}
           >
             Limpar
           </button>

           <button
             type="button"
             className="primary"
             disabled={saving}
             onClick={saveMain}
           >
             {editMain
               ? 'Atualizar categoria'
               : 'Adicionar categoria'}
           </button>
         </div>
       </div>


       <div className="category-create-box">
         <h3>
           {edit
             ? 'Editar subcategoria'
             : 'Nova subcategoria'}
         </h3>

         <div className="formgrid">
           <label>
             Categoria principal

             <ThemedSelect
               value={sub.parent_id||''}
               onChange={e=>setSub({
                 ...sub,
                 parent_id:e.target.value
               })}
             >
               <option value="">
                 Selecione
               </option>

               {mains.map(c=>
                 <option value={c.id} key={c.id}>
                   {c.name}
                 </option>
               )}
             </ThemedSelect>
           </label>

           <label>
             Subcategoria

             <input
               ref={subInputRef}
               value={sub.name}
               onChange={e=>setSub({
                 ...sub,
                 name:e.target.value
               })}
               placeholder="Ex.: O Boticário, Linha Premium..."
               onKeyDown={e=>{
                 if(e.key==='Enter'){
                   e.preventDefault();
                   saveSub();
                 }
               }}
             />
           </label>

           <label>
             Ícone da subcategoria

             <ThemedSelect
               value={sub.icon||'package'}
               onChange={e=>setSub({
                 ...sub,
                 icon:e.target.value
               })}
             >
               {ICON_OPTIONS.map(([id,label])=>
                 <option value={id} key={id}>
                   {label}
                 </option>
               )}
             </ThemedSelect>
           </label>
         </div>

         <div className="modalactions">
           <button
             type="button"
             onClick={reset}
           >
             Limpar
           </button>

           <button
             type="button"
             className="primary"
             disabled={saving}
             onClick={saveSub}
           >
             {edit
               ? 'Atualizar subcategoria'
               : 'Adicionar subcategoria'}
           </button>
         </div>
       </div>

     </div>


     <div className="subcategorygroups">

       {mains.map(m=>{
         const children=cats.filter(
           c=>String(c.parent_id)===String(m.id)
         );

         const MI=icons[m.icon]||I.Package;

         return (
           <div
             className="subcategorygroup"
             key={m.id}
           >
             <div className="subcategorygrouphead">
               <div>
                 <h3>
                   <MI/> {m.name}
                 </h3>

                 <span>
                   {children.length} subcategoria(s)
                 </span>
               </div>

               <div>
                 <button
                   type="button"
                   className="iconbtn"
                   onClick={()=>{
                     setEdit(null);
                     setEditMain(m);
                     setMainName(m.name);
                     setMainIcon(m.icon||'package');
                   }}
                   title="Editar categoria principal"
                 >
                   <I.Pencil/>
                 </button>

                 <button
                   type="button"
                   className="iconbtn danger"
                   onClick={()=>setDeleteTarget({
                     id:m.id,
                     name:m.name,
                     type:'categoria principal'
                   })}
                   title="Excluir categoria principal"
                 >
                   <I.Trash2/>
                 </button>
               </div>
             </div>


             {children.length
               ? children.map(c=>{
                   const CI=icons[c.icon]||MI;

                   return (
                     <div
                       className="subcategoryrow"
                       key={c.id}
                     >
                       <span>
                         <CI/> {c.name}
                       </span>

                       <div>
                         <button
                           type="button"
                           className="iconbtn"
                           onClick={()=>editSub(c)}
                           title="Editar"
                         >
                           <I.Pencil/>
                         </button>

                         <button
                           type="button"
                           className="iconbtn danger"
                           onClick={()=>setDeleteTarget({
                             id:c.id,
                             name:c.name,
                             type:'subcategoria'
                           })}
                           title="Excluir"
                         >
                           <I.Trash2/>
                         </button>
                       </div>
                     </div>
                   );
                 })

               : <p className="muted">
                   Nenhuma subcategoria cadastrada.
                 </p>
             }

           </div>
         );
       })}


       {!mains.length&&
         <div className="empty compact">
           <I.Tags/>
           <p>
             Nenhuma categoria principal cadastrada.
           </p>
         </div>
       }

     </div>


     <div className="modalactions">
       <button
         type="button"
         onClick={close}
       >
         Fechar
       </button>
     </div>

   </Modal>


   {deleteTarget&&
     <Modal
       title="Confirmar exclusão"
       close={()=>setDeleteTarget(null)}
     >
       <div className="delete-confirm">

         <p>
           Deseja realmente excluir esta {deleteTarget.type}?
         </p>

         <h3>
           {deleteTarget.name}
         </h3>

         <p className="muted">
           Esta operação removerá a categoria da lista ativa do sistema.
         </p>

         <div className="modalactions">

           <button
             type="button"
             onClick={()=>setDeleteTarget(null)}
           >
             Cancelar
           </button>

           <button
             type="button"
             className="dangerbtn"
             onClick={()=>remove(deleteTarget.id)}
           >
             <I.Trash2/> Excluir
           </button>

         </div>
       </div>
     </Modal>
   }

 </>
}

function BulkCategoryModal({items,cats,close,done,notify}){const mains=cats.filter(c=>!c.parent_id&&c.name!=='Kits / Combos');const[selected,setSelected]=useState(()=>new Set(items.map(p=>p.id)));const[category,setCategory]=useState('');const toggle=id=>setSelected(s=>{const n=new Set(s);n.has(id)?n.delete(id):n.add(id);return n});const save=async()=>{try{if(!selected.size)throw new Error('Selecione pelo menos um produto.');if(!category)throw new Error('Selecione a categoria ou subcategoria.');await window.api.products.bulkCategory({product_ids:[...selected],category_id:Number(category)});notify(`${selected.size} produto(s) associado(s) à categoria.`);done();close()}catch(e){notify(e)}};return <Modal wide title="Adicionar vários produtos à categoria" close={close}><p className="muted">Selecione os produtos e a categoria ou subcategoria. A alteração será aplicada a todos os produtos selecionados.</p><div className="formgrid"><label className="span2">Categoria / Subcategoria<ThemedSelect value={category} onChange={e=>setCategory(e.target.value)}><option value="">Selecione</option>{mains.map(m=><optgroup key={m.id} label={m.name}><option value={m.id}>{m.name} (principal)</option>{cats.filter(c=>String(c.parent_id)===String(m.id)).map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</optgroup>)}</ThemedSelect></label></div><div className="bulk-product-list">{items.map(p=><label key={p.id} className="bulk-product-row"><input type="checkbox" checked={selected.has(p.id)} onChange={()=>toggle(p.id)}/><span>{p.name}</span><small>{p.category||'Sem categoria'}</small></label>)}</div><div className="modalactions"><button onClick={close}>Cancelar</button><button className="primary" onClick={save}>Aplicar aos selecionados</button></div></Modal>}

function Produtos({notify}){
 const[items,setItems]=useState([]),[cats,setCats]=useState([]),[suppliers,setSuppliers]=useState([]),[cat,setCat]=useState(null),[q,setQ]=useState(''),[open,setOpen]=useState(false),[edit,setEdit]=useState(null),[catOpen,setCatOpen]=useState(false),[bulkOpen,setBulkOpen]=useState(false),[deleteTarget,setDeleteTarget]=useState(null),[loading,setLoading]=useState(true);const refresh=useDataRefresh();
 const[view,setView]=useViewMode('produtos','details');
 const load=async()=>{setLoading(true);try{const[a,b,c]=await Promise.all([window.api.products.list(q,cat),window.api.categories.list(),window.api.suppliers.list('')]);setItems(a);setCats(b);setSuppliers(c)}catch(e){notify(e)}finally{setLoading(false)}};useEffect(()=>{load()},[q,cat,refresh]);
 const mainCats=cats.filter(c=>!c.parent_id&&c.name!=='Kits / Combos');
 return <><div className="toolbar"><div className="search compact"><I.Search/><input placeholder="Pesquisar produto, categoria, subcategoria ou código de barras..." value={q} onChange={e=>setQ(e.target.value)}/></div><ViewModeMenu value={view} onChange={setView}/><button className="smallbtn" onClick={()=>setCatOpen(true)}><I.Tags/> Categorias / Subcategorias</button><button className="smallbtn" onClick={()=>setBulkOpen(true)} disabled={!items.length}><I.ListChecks/> Adicionar vários</button><button className="primary" onClick={()=>{setEdit(null);setOpen(true)}}><I.Plus/> Novo produto</button></div>
 <div className="categorystrip"><button className={!cat?'cat active':'cat'} onClick={()=>setCat(null)}><I.LayoutGrid/><span>Todos</span></button>{mainCats.map(c=>{const Icon=icons[c.icon]||I.Package;return <button className={String(cat)===String(c.id)?'cat active':'cat'} key={c.id} onClick={()=>setCat(String(cat)===String(c.id)?null:c.id)}><Icon/><span>{c.name}</span></button>})}</div>
 <Loading loading={loading}><div className={`table panel ux-collection ux-view-${view}`}><table><thead><tr><th>Produto</th><th>Categoria / Subcategoria</th><th>Fornecedor</th><th>Preço</th><th>Estoque</th><th>Mín.</th><th></th></tr></thead><tbody>{items.map(p=>{const Icon=categoryIconFor(p);return <tr key={p.id}><td data-label="Produto"><span className="tableproducticon"><Icon/></span><b>{p.name}</b><small>{p.barcode?`Barras: ${p.barcode}`:(p.sku||'Sem SKU')}</small></td><td data-label="Categoria">{p.parent_category?`${p.parent_category} / ${p.category}`:(p.category||'—')}</td><td data-label="Fornecedor">{p.supplier_name||'—'}</td><td data-label="Preço" className="money">{brl(p.price_cents)}{p.sale_mode==='WEIGHT'?<small>/kg</small>:p.sale_mode==='VOLUME_L'?<small>/L</small>:p.sale_mode==='VOLUME_ML'?<small>/ml</small>:null}</td><td data-label="Estoque"><span className={p.stock<=p.min_stock?'badge warn':'badge'}>{stockLabel(p)}</span>{p.sale_mode==='WEIGHT'&&<small className="weight-product-tag"><I.Scale/> por peso{Number(p.track_unit_stock||0)===1?` · estoque unitário: ${Number(p.unit_stock||0)} un.`:p.linked_unit_product_id&&p.linked_unit_name?` · ${p.linked_unit_name}: ${Number(p.linked_unit_stock||0)} un.`:''}</small>}</td><td data-label="Mínimo">{minStockLabel(p)}</td><td data-label="Ações"><div className="rowactions"><button className="iconbtn" onClick={()=>{setEdit(p);setOpen(true)}} title="Editar produto"><I.Pencil/></button><button className="iconbtn danger" onClick={()=>setDeleteTarget(p)} title="Excluir produto"><I.Trash2/></button></div></td></tr>})}</tbody></table>{!items.length&&<div className="empty compact"><I.Package/><p>Nenhum produto encontrado.</p></div>}</div></Loading>
 {open&&<ProductModal edit={edit} cats={cats.filter(c=>c.name!=='Kits / Combos')} suppliers={suppliers} close={()=>setOpen(false)} done={()=>{load();dataChanged()}} notify={notify}/>} {catOpen&&<CategoryManager notify={notify} close={()=>setCatOpen(false)}/>} {bulkOpen&&<BulkCategoryModal items={items} cats={cats} close={()=>setBulkOpen(false)} done={()=>{load();dataChanged()}} notify={notify}/>} {deleteTarget&&<Modal title="Excluir produto" close={()=>setDeleteTarget(null)}><p>Deseja excluir <b>{deleteTarget.name}</b>?</p><p className="muted">O produto será ocultado. Se ele não estiver em um Kit/Combo, você poderá desfazer a exclusão pela mensagem exibida em seguida.</p><div className="modalactions"><button onClick={()=>setDeleteTarget(null)}>Cancelar</button><button className="dangerbtn" onClick={async()=>{const x=deleteTarget;try{await window.api.products.delete(x.id);setDeleteTarget(null);await load();dataChanged();notify('Produto excluído.',{label:'Desfazer',doneMessage:'Produto restaurado.',run:async()=>{await window.api.products.restore(x.id);await load()}})}catch(e){notify(e)}}}><I.Trash2/> Excluir produto</button></div></Modal>}</>
}
function ProductModal({edit,cats,suppliers,close,done,notify}){
 const mainCats=cats.filter(c=>!c.parent_id&&c.name!=='Kits / Combos');
 const initialMain=edit?.parent_id||edit?.category_id||'';const initialSub=edit?.parent_id?edit.category_id:'';
 const initialMode=String(edit?.sale_mode||'UNIT');
 const[p,setP]=useState(edit?{...edit,sale_mode:initialMode,main_category_id:initialMain,category_id:initialSub,linked_unit_product_id:edit.linked_unit_product_id||'',default_units_per_kg:Number(edit.default_units_per_kg||0),track_unit_stock:Number(edit.track_unit_stock||0),unit_stock:Number(edit.unit_stock||0),unit_min_stock:Number(edit.unit_min_stock||0)}:{item_type:'PRODUCT',duration_minutes:60,name:'',sku:'',barcode:'',category_id:'',main_category_id:'',supplier_id:'',price_cents:0,cost_cents:0,stock:0,min_stock:0,unit:'un',sale_mode:'UNIT',linked_unit_product_id:'',default_units_per_kg:0,track_unit_stock:0,unit_stock:0,unit_min_stock:0,ncm:'',cfop:'',cst_csosn:'',origin:'0'});
 const[stockText,setStockText]=useState(initialMode==='WEIGHT'?gramsToKg(edit?.stock||0):initialMode==='VOLUME_L'?(Number(edit?.stock||0)/1000).toLocaleString('pt-BR',{minimumFractionDigits:3,maximumFractionDigits:3}):String(edit?.stock??0));
 const[minText,setMinText]=useState(initialMode==='WEIGHT'?gramsToKg(edit?.min_stock||0):initialMode==='VOLUME_L'?(Number(edit?.min_stock||0)/1000).toLocaleString('pt-BR',{minimumFractionDigits:3,maximumFractionDigits:3}):String(edit?.min_stock??0));
 const[unitProducts,setUnitProducts]=useState([]);
 useEffect(()=>{window.api.products.list('').then(rows=>setUnitProducts((rows||[]).filter(x=>String(x.sale_mode||'UNIT')==='UNIT'&&String(x.id)!==String(edit?.id||'')))).catch(()=>setUnitProducts([]))},[edit?.id]);
 const subs=cats.filter(c=>String(c.parent_id)===String(p.main_category_id));
 const linkedUnit=unitProducts.find(x=>String(x.id)===String(p.linked_unit_product_id||''));
 const changeMode=mode=>{setP({...p,sale_mode:mode,unit:mode==='WEIGHT'?'kg':mode==='VOLUME_L'?'L':mode==='VOLUME_ML'?'ml':(['kg','L','ml'].includes(p.unit)?'un':p.unit),linked_unit_product_id:mode==='WEIGHT'?p.linked_unit_product_id:'',default_units_per_kg:mode==='WEIGHT'?p.default_units_per_kg:0,track_unit_stock:mode==='WEIGHT'?p.track_unit_stock:0,unit_stock:mode==='WEIGHT'?p.unit_stock:0,unit_min_stock:mode==='WEIGHT'?p.unit_min_stock:0});setStockText(mode==='VOLUME_L'?'0,000':'0');setMinText(mode==='VOLUME_L'?'0,000':'0')};
 const setInternalTracking=checked=>setP({...p,track_unit_stock:checked?1:0,linked_unit_product_id:checked?'':p.linked_unit_product_id});
 const setLinked=e=>setP({...p,linked_unit_product_id:e.target.value,track_unit_stock:e.target.value?0:p.track_unit_stock});
 const save=async()=>{try{if(!p.name.trim())throw new Error('Informe o nome.');const categoryId=p.category_id||p.main_category_id||null;const weighted=p.sale_mode==='WEIGHT',volume=p.sale_mode==='VOLUME_L'||p.sale_mode==='VOLUME_ML';const stock=p.item_type==='SERVICE'?0:weighted?kgInputToGrams(stockText):volume?volumeInputToMl(stockText,p.sale_mode):Math.max(0,Math.round(Number(stockText||0)));const minStock=p.item_type==='SERVICE'?0:weighted?kgInputToGrams(minText):volume?volumeInputToMl(minText,p.sale_mode):Math.max(0,Math.round(Number(minText||0)));await window.api.products.save({...p,stock,min_stock:minStock,unit:weighted?'kg':p.sale_mode==='VOLUME_L'?'L':p.sale_mode==='VOLUME_ML'?'ml':p.unit,category_id:categoryId?Number(categoryId):null,unit_stock:weighted?Math.max(0,Math.round(Number(p.unit_stock||0))):0,unit_min_stock:weighted?Math.max(0,Math.round(Number(p.unit_min_stock||0))):0});close();done()}catch(e){notify(e)}};
 return <Modal title={edit?'Editar produto/serviço':'Novo produto/serviço'} close={close} wide><div className="formgrid"><label>Cadastro de<ThemedSelect value={p.item_type||'PRODUCT'} onChange={e=>{const item_type=e.target.value;setP({...p,item_type,sale_mode:item_type==='SERVICE'?'UNIT':p.sale_mode,stock:item_type==='SERVICE'?0:p.stock,min_stock:item_type==='SERVICE'?0:p.min_stock});if(item_type==='SERVICE'){setStockText('0');setMinText('0')}}}><option value="PRODUCT">Produto físico</option><option value="SERVICE">Serviço (sem controle de estoque)</option></ThemedSelect></label>{p.item_type==='SERVICE'&&<label>Duração prevista (minutos)<input type="number" min="5" max="1440" value={p.duration_minutes||60} onChange={e=>setP({...p,duration_minutes:Number(e.target.value)||60})}/></label>}<label>Nome<input autoFocus value={p.name} onChange={e=>setP({...p,name:e.target.value})}/></label><label>SKU<input value={p.sku||''} onChange={e=>setP({...p,sku:e.target.value})}/></label><label>Tipo de venda<ThemedSelect disabled={p.item_type==='SERVICE'} value={p.sale_mode||'UNIT'} onChange={e=>changeMode(e.target.value)}><option value="UNIT">Por unidade</option><option value="WEIGHT">Por peso (kg)</option><option value="VOLUME_L">Por litro (L)</option><option value="VOLUME_ML">Por mililitro (ml)</option></ThemedSelect></label><label>Unidade{p.sale_mode==='WEIGHT'?<input value="kg" readOnly/>:p.sale_mode==='VOLUME_L'?<input value="L" readOnly/>:p.sale_mode==='VOLUME_ML'?<input value="ml" readOnly/>:<ThemedSelect value={p.unit} onChange={e=>setP({...p,unit:e.target.value})}><option>un</option><option>cx</option><option>pct</option><option>kg</option><option>g</option></ThemedSelect>}</label><label className="span2 barcodefield">Código de barras<input inputMode="numeric" value={p.barcode||''} onChange={e=>setP({...p,barcode:onlyDigits(e.target.value).slice(0,20)})} placeholder="Use um leitor USB/Bluetooth ou digite o código" onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();e.currentTarget.blur()}}}/><small className="muted">O código identifica o produto. Se for vendido por peso, após a leitura o PDV abrirá a janela de pesagem.</small><button type="button" className="smallbtn" onClick={e=>e.currentTarget.parentElement.querySelector('input').focus()}><I.ScanLine/> Ativar leitura do código</button></label><label>Categoria principal<ThemedSelect value={p.main_category_id||''} onChange={e=>setP({...p,main_category_id:e.target.value,category_id:''})}><option value="">Selecione</option>{mainCats.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</ThemedSelect></label><label>Subcategoria<ThemedSelect value={p.category_id||''} disabled={!p.main_category_id||!subs.length} onChange={e=>setP({...p,category_id:e.target.value})}><option value="">{subs.length?'Sem subcategoria':'Sem subcategorias'}</option>{subs.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</ThemedSelect></label><label>Fornecedor<ThemedSelect value={p.supplier_id||''} onChange={e=>setP({...p,supplier_id:e.target.value})}><option value="">Sem fornecedor</option>{(suppliers||[]).map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</ThemedSelect></label><label>{p.sale_mode==='WEIGHT'?'Preço por kg':p.sale_mode==='VOLUME_L'?'Preço por litro':p.sale_mode==='VOLUME_ML'?'Preço por ml':'Preço'}<CurrencyInput value={p.price_cents} onChange={v=>setP({...p,price_cents:v})}/></label><label>{p.sale_mode==='WEIGHT'?'Custo por kg':p.sale_mode==='VOLUME_L'?'Custo por litro':p.sale_mode==='VOLUME_ML'?'Custo por ml':'Custo'}<CurrencyInput value={p.cost_cents} onChange={v=>setP({...p,cost_cents:v})}/></label>{p.item_type!=='SERVICE'&&<><label>{p.sale_mode==='WEIGHT'?'Estoque atual (kg)':p.sale_mode==='VOLUME_L'?'Estoque atual (L)':p.sale_mode==='VOLUME_ML'?'Estoque atual (ml)':'Estoque atual'}<input type="text" inputMode={['WEIGHT','VOLUME_L','VOLUME_ML'].includes(p.sale_mode)?'decimal':'numeric'} value={stockText} onChange={e=>setStockText(e.target.value)} placeholder={p.sale_mode==='WEIGHT'||p.sale_mode==='VOLUME_L'?'0,000':'0'}/></label><label>{p.sale_mode==='WEIGHT'?'Estoque mínimo (kg)':p.sale_mode==='VOLUME_L'?'Estoque mínimo (L)':p.sale_mode==='VOLUME_ML'?'Estoque mínimo (ml)':'Estoque mínimo'}<input type="text" inputMode={['WEIGHT','VOLUME_L','VOLUME_ML'].includes(p.sale_mode)?'decimal':'numeric'} value={minText} onChange={e=>setMinText(e.target.value)} placeholder={p.sale_mode==='WEIGHT'||p.sale_mode==='VOLUME_L'?'0,000':'0'}/></label></>}{p.sale_mode==='WEIGHT'&&p.item_type!=='SERVICE'&&<><label className="span2 printoption"><input type="checkbox" checked={Number(p.track_unit_stock||0)===1} onChange={e=>setInternalTracking(e.target.checked)}/> Controlar também estoque unitário neste mesmo produto</label>{Number(p.track_unit_stock||0)===1&&<><label>Estoque unitário atual<input type="number" min="0" step="1" value={p.unit_stock||0} onChange={e=>setP({...p,unit_stock:Math.max(0,Math.round(Number(e.target.value||0)))})}/></label><label>Estoque unitário mínimo<input type="number" min="0" step="1" value={p.unit_min_stock||0} onChange={e=>setP({...p,unit_min_stock:Math.max(0,Math.round(Number(e.target.value||0)))})}/></label></>}<label>Unidades aproximadas por kg<input type="number" min="0" step="1" value={p.default_units_per_kg||0} onChange={e=>setP({...p,default_units_per_kg:Math.max(0,Math.round(Number(e.target.value||0)))})}/><small className="muted">Ex.: 32 velas por kg. Serve como sugestão; na venda o operador pode informar uma quantidade diferente.</small></label><label className="span2">Ou usar outro produto unitário vinculado<ThemedSelect value={p.linked_unit_product_id||''} disabled={Number(p.track_unit_stock||0)===1} onChange={setLinked}><option value="">Não usar produto separado</option>{unitProducts.map(x=><option key={x.id} value={x.id}>{x.name} · estoque {x.stock} {x.unit||'un'}</option>)}</ThemedSelect><small className="muted">Opcional. Se usar o controle unitário do próprio produto, este vínculo fica desativado.</small></label>{p.linked_unit_product_id&&<label>Estoque do produto vinculado<input value={linkedUnit?`${linkedUnit.stock} ${linkedUnit.unit||'un'}`:'Carregando...'} readOnly/></label>}<div className="span2 note"><I.Scale/><div><b>Produto vendido por peso com controle duplo</b><small>A venda sempre registra o peso em kg e a quantidade de unidades informada. Se o controle unitário estiver ativo, baixa os dois saldos na mesma transação e o cancelamento devolve ambos.</small></div></div></>}<label>NCM<input value={p.ncm||''} onChange={e=>setP({...p,ncm:e.target.value})}/></label><label>CFOP<input value={p.cfop||''} onChange={e=>setP({...p,cfop:e.target.value})}/></label><label>CST / CSOSN<input value={p.cst_csosn||''} onChange={e=>setP({...p,cst_csosn:e.target.value})}/></label><label>Origem<ThemedSelect value={p.origin||'0'} onChange={e=>setP({...p,origin:e.target.value})}><option value="0">0 - Nacional</option><option value="1">1 - Importação direta</option><option value="2">2 - Adquirida no mercado interno</option></ThemedSelect></label></div><div className="modalactions"><button onClick={close}>Cancelar</button><button className="primary" onClick={save}>Salvar</button></div></Modal>
}

function Estoque({notify}){
 const[items,setItems]=useState([]),[analysis,setAnalysis]=useState([]),[analysisMode,setAnalysisMode]=useState('alerts'),[cats,setCats]=useState([]),[kits,setKits]=useState([]),[suppliers,setSuppliers]=useState([]),[cat,setCat]=useState(null),[q,setQ]=useState(''),[selected,setSelected]=useState(null),[kind,setKind]=useState(null),[qty,setQty]=useState(''),[unitQty,setUnitQty]=useState('0'),[supplierId,setSupplierId]=useState(''),[reason,setReason]=useState(''),[loading,setLoading]=useState(true);
 const[view,setView]=useViewMode('estoque','details');
 const refresh=useDataRefresh();
 const load=async()=>{setLoading(true);try{const[ps,cs,ks,ss,sa]=await Promise.all([window.api.products.list(''),window.api.categories.list(),window.api.kits.list(),window.api.suppliers.list(''),window.api.stock.analysis()]);setItems(ps);setAnalysis(sa||[]);setCats(cs);setKits(ks);setSuppliers(ss||[])}catch(e){notify(e)}finally{setLoading(false)}};
 useEffect(()=>{load()},[refresh]);
 const kitCat=cats.find(c=>c.name==='Kits / Combos');
 const isKits=String(cat)===String(kitCat?.id);
 const visibleItems=items.filter(p=>(!cat||String(p.category_id)===String(cat))&&(!q||String(p.name||'').toLowerCase().includes(q.toLowerCase())||String(p.sku||'').toLowerCase().includes(q.toLowerCase())));
 const visibleKits=kits.filter(k=>!q||String(k.name||'').toLowerCase().includes(q.toLowerCase())||String(k.sku||'').toLowerCase().includes(q.toLowerCase()));
 const stockMap=new Map(items.map(p=>[Number(p.id),p]));
 const kitInfo=k=>{const parts=String(k.items||'').split(',').filter(Boolean).map(v=>{const[a,b]=v.split(':');return{product_id:Number(a),quantity:Number(b)}});const invalidWeight=parts.some(x=>String(stockMap.get(x.product_id)?.sale_mode||'UNIT')==='WEIGHT');const available=invalidWeight?0:(parts.length?Math.min(...parts.map(x=>Math.floor((Number(stockMap.get(x.product_id)?.stock||0))/Math.max(1,x.quantity)))):0);return{parts,available,invalidWeight}};
 const analysisFiltered=analysis.filter(p=>analysisMode==='alerts'?p.low_stock:analysisMode==='no-turnover'?p.no_turnover_90d:analysisMode==='excess'?p.excess_stock:analysisMode==='reorder'?p.suggested_reorder>0:true);
 const exportStockCsv=()=>{const cols=['Produto','SKU','Código de barras','Categoria','Estoque atual','Estoque mínimo','Vendido últimos 90 dias','Última venda','Dias estimados','Sugestão reposição','Valor de custo em estoque'];const esc=v=>'\"'+String(v??'').replace(/\"/g,'\"\"')+'\"';const rows=[cols,...analysisFiltered.map(p=>[p.name,p.sku,p.barcode,p.category,p.sale_mode==='WEIGHT'||p.sale_mode==='VOLUME_L'?(Number(p.stock||0)/1000).toLocaleString('pt-BR',{maximumFractionDigits:3}):p.stock,p.sale_mode==='WEIGHT'||p.sale_mode==='VOLUME_L'?(Number(p.min_stock||0)/1000).toLocaleString('pt-BR',{maximumFractionDigits:3}):p.min_stock,p.sale_mode==='WEIGHT'||p.sale_mode==='VOLUME_L'?(Number(p.sold_qty_90d||0)/1000).toLocaleString('pt-BR',{maximumFractionDigits:3}):p.sold_qty_90d,p.last_sold_at||'',p.estimated_days_left??'',p.sale_mode==='VOLUME_ML'?Number(p.suggested_reorder||0):p.suggested_reorder, (Number(p.stock_value_cents||0)/100).toFixed(2).replace('.',',')])];const csv='\uFEFF'+rows.map(r=>r.map(esc).join(';')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download='analise-estoque.csv';a.click();URL.revokeObjectURL(url)};
 const openMove=(p,k)=>{setSelected(p);setKind(k);setQty(p.sale_mode==='WEIGHT'||p.sale_mode==='VOLUME_L'?'1,000':p.sale_mode==='VOLUME_ML'?'1000':'1');setUnitQty(p.sale_mode==='WEIGHT'&&Number(p.track_unit_stock||0)===1?String(Math.max(0,Math.round(Number(p.default_units_per_kg||0)))):'0');setSupplierId(k==='IN'&&p.supplier_id?String(p.supplier_id):'');setReason(k==='IN'?'Entrada manual':'Saída manual')};
 const save=async()=>{try{const weighted=selected?.sale_mode==='WEIGHT',volume=['VOLUME_L','VOLUME_ML'].includes(selected?.sale_mode);const n=weighted?kgInputToGrams(qty):volume?volumeInputToMl(qty,selected.sale_mode):Number(qty);if(weighted){if(!Number.isInteger(n)||n<=0)throw new Error('Informe um peso maior que zero em kg.')}else if(volume){if(!Number.isInteger(n)||n<=0)throw new Error('Informe um volume maior que zero.')}else if(!Number.isInteger(n)||n<=0)throw new Error('Informe uma quantidade inteira maior que zero.');const units=selected?.sale_mode==='WEIGHT'&&Number(selected?.track_unit_stock||0)===1?Math.max(0,Math.round(Number(unitQty||0))):0;await window.api.stock.move({product_id:selected.id,kind,quantity:n,unit_quantity:units,supplier_id:kind==='IN'&&supplierId?Number(supplierId):null,reason:reason||'Movimentação manual'});notify(kind==='IN'?'Entrada registrada.':'Saída registrada.');setSelected(null);setKind(null);await load();dataChanged()}catch(e){notify(e)}};
 return <><div className="toolbar"><div><h2>Controle de Estoque</h2><p className="muted">Consulte categorias, disponibilidade dos Kits / Combos e recomendações de reposição baseadas no giro dos últimos 90 dias.</p></div></div>
 <div className="stock-analysis-grid"><div className="panel stock-analysis-card"><span>Estoque baixo / mínimo</span><strong>{analysis.filter(p=>p.low_stock).length}</strong><small>Inclui produtos sem saldo</small></div><div className="panel stock-analysis-card"><span>Sem giro há 90 dias</span><strong>{analysis.filter(p=>p.no_turnover_90d).length}</strong><small>Sem venda registrada no período</small></div><div className="panel stock-analysis-card"><span>Possível excesso</span><strong>{analysis.filter(p=>p.excess_stock).length}</strong><small>Estoque acima de cerca de 60 dias de giro</small></div><div className="panel stock-analysis-card"><span>Valor de custo em estoque</span><strong>{brl(analysis.reduce((sum,p)=>sum+Number(p.stock_value_cents||0),0))}</strong><small>Estimativa pelo custo cadastrado</small></div></div>
 <div className="panel stock-analysis-panel"><div className="toolbar inline"><div><h3>Análise e reposição</h3><p className="muted">Sugestão para aproximadamente 30 dias de demanda, respeitando o estoque mínimo. Use como apoio, não como pedido automático.</p></div><button className="smallbtn" onClick={exportStockCsv}><I.Download/> Exportar CSV</button></div><div className="stock-analysis-filters"><button className={analysisMode==='alerts'?'cat active':'cat'} onClick={()=>setAnalysisMode('alerts')}>Estoque baixo</button><button className={analysisMode==='reorder'?'cat active':'cat'} onClick={()=>setAnalysisMode('reorder')}>Repor</button><button className={analysisMode==='no-turnover'?'cat active':'cat'} onClick={()=>setAnalysisMode('no-turnover')}>Sem giro (90 dias)</button><button className={analysisMode==='excess'?'cat active':'cat'} onClick={()=>setAnalysisMode('excess')}>Possível excesso</button><button className={analysisMode==='all'?'cat active':'cat'} onClick={()=>setAnalysisMode('all')}>Todos</button></div><div className="table ux-collection"><table><thead><tr><th>Produto</th><th>Saldo</th><th>Mínimo</th><th>Vendas 90 dias</th><th>Dias estimados</th><th>Reposição sugerida</th><th>Situação</th></tr></thead><tbody>{analysisFiltered.map(p=><tr key={p.id}><td><b>{p.name}</b><small>{p.sku||p.barcode||'Sem código'} · {p.category||'Sem categoria'}</small></td><td>{p.sale_mode==='WEIGHT'?gramsLabel(p.stock):isVolumeLikeMode(p.sale_mode)?volumeLabel(p.stock):`${p.stock} ${p.unit||'un'}`}</td><td>{p.sale_mode==='WEIGHT'?gramsLabel(p.min_stock):isVolumeLikeMode(p.sale_mode)?volumeLabel(p.min_stock):`${p.min_stock} ${p.unit||'un'}`}</td><td>{p.sale_mode==='WEIGHT'?gramsLabel(p.sold_qty_90d):isVolumeLikeMode(p.sale_mode)?volumeLabel(p.sold_qty_90d):p.sold_qty_90d}</td><td>{p.estimated_days_left===null?'Sem giro':`${p.estimated_days_left} dias`}</td><td><b>{p.sale_mode==='WEIGHT'?gramsLabel(p.suggested_reorder):isVolumeLikeMode(p.sale_mode)?volumeLabel(p.suggested_reorder):`${p.suggested_reorder} ${p.unit||'un'}`}</b></td><td>{p.out_of_stock?<span className="badge danger">Sem estoque</span>:p.low_stock?<span className="badge warn">Abaixo do mínimo</span>:p.no_turnover_90d?<span className="badge">Sem giro</span>:p.excess_stock?<span className="badge warn">Possível excesso</span>:<span className="badge ok">Regular</span>}</td></tr>)}{!analysisFiltered.length&&<tr><td colSpan="7" className="muted">Nenhum produto nesta categoria de análise.</td></tr>}</tbody></table></div></div>
 <div className="toolbar"><div className="search compact"><I.Search/><input placeholder="Pesquisar produto ou Kit / Combo..." value={q} onChange={e=>setQ(e.target.value)}/></div><ViewModeMenu value={view} onChange={setView}/></div><div className="categorystrip"><button className={!cat?'cat active':'cat'} onClick={()=>setCat(null)}><I.LayoutGrid/>Todos</button>{cats.map(c=>{const Icon=c.name==='Kits / Combos'?I.Layers:(icons[c.icon]||I.Package);return <button className={String(cat)===String(c.id)?'cat active':'cat'} key={c.id} onClick={()=>setCat(String(cat)===String(c.id)?null:c.id)}><Icon/><span>{c.name}</span></button>})}</div><Loading loading={loading}>{isKits?<div className={`table panel ux-collection ux-view-${view}`}><table><thead><tr><th>Kit / Combo</th><th>Preço</th><th>Composição</th><th>Disponibilidade</th><th>Status</th></tr></thead><tbody>{visibleKits.map(k=>{const info=kitInfo(k);return <tr key={k.id}><td data-label="Kit / Combo"><b>{k.name}</b><small>{k.sku||'Sem SKU'}</small></td><td data-label="Preço" className="money">{brl(k.price_cents)}</td><td data-label="Composição">{info.parts.length?info.parts.map(x=>`${stockMap.get(x.product_id)?.name||'Produto'} × ${x.quantity}`).join(' · '):'Sem composição'}</td><td data-label="Disponibilidade"><span className={info.available>0?'badge':'badge warn'}>{info.available} kit(s)</span></td><td data-label="Status"><span className={info.available>0?'badge':'badge warn'}>{info.invalidWeight?'Revisar: contém produto por peso':info.available>0?'Disponível pelos componentes':'Indisponível'}</span></td></tr>})}</tbody></table>{!visibleKits.length&&<div className="empty compact"><I.Layers/><p>Nenhum Kit / Combo encontrado.</p></div>}</div>:<div className={`table panel ux-collection ux-view-${view}`}><table><thead><tr><th>Produto</th><th>Categoria</th><th>Saldo</th><th>Custo</th><th>Mín.</th><th>Ações</th></tr></thead><tbody>{visibleItems.map(p=><tr key={p.id}><td data-label="Produto"><b>{p.name}</b><small>{p.sku||'Sem SKU'}{p.sale_mode==='WEIGHT'?' · vendido por peso':''}</small></td><td data-label="Categoria">{p.category||'—'}</td><td data-label="Saldo"><span className={p.stock<=p.min_stock?'badge warn':'badge'}>{stockLabel(p)}</span>{p.sale_mode==='WEIGHT'&&Number(p.track_unit_stock||0)===1&&<small className="weight-product-tag"><I.Boxes/> Estoque unitário: {Number(p.unit_stock||0)} un. · mínimo {Number(p.unit_min_stock||0)}</small>}{p.sale_mode==='WEIGHT'&&Number(p.track_unit_stock||0)!==1&&p.linked_unit_product_id&&<small className="weight-product-tag"><I.Boxes/> {p.linked_unit_name||'Estoque unitário'}: {Number(p.linked_unit_stock||0)} un.</small>}</td><td data-label="Custo">{brl(p.cost_cents)}{p.sale_mode==='WEIGHT'?'/kg':p.sale_mode==='VOLUME_L'?'/L':p.sale_mode==='VOLUME_ML'?'/ml':''}</td><td data-label="Mínimo">{minStockLabel(p)}</td><td data-label="Ações"><button className="smallbtn" onClick={()=>openMove(p,'IN')}><I.ArrowDownToLine/> Entrada</button><button className="smallbtn" onClick={()=>openMove(p,'OUT')}><I.ArrowUpFromLine/> Saída</button></td></tr>)}</tbody></table>{!visibleItems.length&&<div className="empty compact"><I.Package/><p>Nenhum produto encontrado nesta categoria.</p></div>}</div>}</Loading>{selected&&<Modal title={`${kind==='IN'?'Entrada':'Saída'} de estoque`} close={()=>setSelected(null)}><p><b>{selected.name}</b><br/><span className="muted">Estoque atual: {stockLabel(selected)}</span></p><div className="formgrid"><label>{selected.sale_mode==='WEIGHT'?'Peso (kg)':selected.sale_mode==='VOLUME_L'?'Volume (L)':selected.sale_mode==='VOLUME_ML'?'Volume (ml)':'Quantidade'}<input autoFocus type="text" inputMode={['WEIGHT','VOLUME_L','VOLUME_ML'].includes(selected.sale_mode)?'decimal':'numeric'} value={qty} onChange={e=>setQty(e.target.value)} placeholder={selected.sale_mode==='WEIGHT'||selected.sale_mode==='VOLUME_L'?'1,000':selected.sale_mode==='VOLUME_ML'?'1000':'1'}/></label>{selected.sale_mode==='WEIGHT'&&Number(selected.track_unit_stock||0)===1&&<label>Unidades<input type="number" min="0" step="1" value={unitQty} onChange={e=>setUnitQty(e.target.value)}/></label>}{kind==='IN'&&<label className="span2">Fornecedor (opcional)<ThemedSelect value={supplierId} onChange={e=>setSupplierId(e.target.value)}><option value="">Não informar fornecedor</option>{suppliers.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</ThemedSelect><small>Se o produto possui fornecedor cadastrado, ele é sugerido automaticamente. Você pode alterar ou deixar em branco.</small></label>}<label className="span2">Motivo<input value={reason} onChange={e=>setReason(e.target.value)}/></label></div>{selected.sale_mode==='WEIGHT'&&<p className="muted">O valor informado em kg será armazenado internamente em gramas.</p>}{['VOLUME_L','VOLUME_ML'].includes(selected.sale_mode)&&<p className="muted">O volume será armazenado internamente em mililitros.</p>}<div className="modalactions"><button onClick={()=>setSelected(null)}>Cancelar</button><button className="primary" onClick={save}>Confirmar {kind==='IN'?'entrada':'saída'}</button></div></Modal>}</>}

function Kits({notify}){
 const[kits,setKits]=useState([]),[products,setProducts]=useState([]),[cats,setCats]=useState([]),[open,setOpen]=useState(false),[deleteKit,setDeleteKit]=useState(null),[deleteBusy,setDeleteBusy]=useState(false),[k,setK]=useState({name:'',sku:'',price_cents:0,category_id:'',kit_type:'STANDARD',weight_product_id:'',volume_product_id:'',mix_category_id:'',items:[]});
 const[view,setView]=useViewMode('kits','blocks');
 const refresh=useDataRefresh();
 const load=()=>Promise.all([window.api.kits.list(),window.api.products.list(''),window.api.categories.list()]).then(([a,b,c])=>{setKits(a);setProducts(b);setCats(c)}).catch(notify);
 useEffect(()=>{load()},[refresh]);
 const kitCat=cats.find(x=>x.name==='Kits / Combos');
 const standardProducts=products.filter(p=>String(p.sale_mode||'UNIT')==='UNIT');
 const weightProducts=products.filter(p=>String(p.sale_mode||'UNIT')==='WEIGHT');
 const volumeProducts=products.filter(p=>['VOLUME_L','VOLUME_ML'].includes(String(p.sale_mode||'UNIT')));
 const mixCats=cats.filter(c=>c.name!=='Kits / Combos'&&!c.parent_id);
 const openNew=()=>{setK({name:'',sku:'',price_cents:0,category_id:kitCat?.id||'',kit_type:'STANDARD',weight_product_id:'',volume_product_id:'',mix_category_id:'',items:[]});setOpen(true)};
 const openEdit=x=>{const items=String(x.items||'').split(',').filter(Boolean).map(v=>{const [product_id,quantity]=v.split(':');return{product_id:Number(product_id),quantity:Number(quantity)}});setK({...x,kit_type:x.kit_type||'STANDARD',weight_product_id:x.weight_product_id||'',volume_product_id:x.volume_product_id||'',mix_category_id:x.mix_category_id||'',items});setOpen(true)};
 const save=async()=>{try{if(!k.name.trim())throw new Error('Informe o nome do combo.');if(!k.category_id)throw new Error('A categoria Kits / Combos é obrigatória.');if(k.kit_type==='MIX_WEIGHT'&&Number(k.price_cents||0)<=0)throw new Error('Informe o preço por kg do Mix por Peso.');if(k.kit_type==='MIX_VOLUME_L'&&Number(k.price_cents||0)<=0)throw new Error('Informe o preço por litro do Mix.');if(k.kit_type==='MIX_VOLUME_ML'&&Number(k.price_cents||0)<=0)throw new Error('Informe o preço por mililitro do Mix.');await window.api.kits.save(k);setOpen(false);await load();dataChanged();notify(k.id?(k.kit_type==='MIX_WEIGHT'?'Mix por Peso atualizado.':k.kit_type==='MIX_VOLUME_L'?'Mix por Litro atualizado.':k.kit_type==='MIX_VOLUME_ML'?'Mix por Mililitro atualizado.':'Combo atualizado.'):(k.kit_type==='MIX_WEIGHT'?'Mix por Peso cadastrado.':k.kit_type==='MIX_VOLUME_L'?'Mix por Litro cadastrado.':k.kit_type==='MIX_VOLUME_ML'?'Mix por Mililitro cadastrado.':'Combo cadastrado.'))}catch(e){notify(e)}};
 const removeKit=async()=>{if(!deleteKit||deleteBusy)return;try{setDeleteBusy(true);await window.api.kits.delete(deleteKit.id);const name=deleteKit.name;setDeleteKit(null);await load();dataChanged();notify(`${name} excluído com segurança. O histórico de vendas foi preservado.`)}catch(e){notify(e)}finally{setDeleteBusy(false)}};
 return <><div className="toolbar"><div><h2>Kits / Combos</h2><p className="muted">Cadastre combos fixos ou Mix por Peso. O Mix permite pesar várias cores juntas e baixar cada cor individualmente do estoque.</p></div><div className="actions"><ViewModeMenu value={view} onChange={setView} modes={['list','blocks']}/><button className="primary" onClick={openNew}><I.Plus/> Novo Kit / Mix</button></div></div>
 <div className={`cards ux-kit-view ux-view-${view}`}>{kits.map(x=>{const isMix=['MIX_WEIGHT','MIX_VOLUME_L','MIX_VOLUME_ML'].includes(String(x.kit_type||'STANDARD'));return <div className="simplecard" key={x.id}>{isMix?<I.Scale/>:<I.Layers/>}<h3>{x.name}</h3><b>{brl(x.price_cents)}{x.kit_type==='MIX_WEIGHT'?'/kg':x.kit_type==='MIX_VOLUME_L'?'/L':x.kit_type==='MIX_VOLUME_ML'?'/ml':''}</b><small>{isMix?`${x.kit_type==='MIX_WEIGHT'?'Mix por Peso':x.kit_type==='MIX_VOLUME_L'?'Mix por Litro':'Mix por Mililitro'}${x.mix_category_name?` · ${x.mix_category_name}`:''}${x.weight_product_name?` · estoque-base: ${x.weight_product_name}`:''}${x.volume_product_name?` · estoque-base: ${x.volume_product_name}`:''}`:(x.items||'Sem composição')}</small><div className="rowactions"><button className="smallbtn" onClick={()=>openEdit(x)}><I.Pencil/> Editar</button><button className="smallbtn danger" onClick={()=>setDeleteKit(x)}><I.Trash2/> Excluir</button></div></div>})}</div>
 {open&&<Modal wide title={k.id?'Editar Kit / Mix':'Novo Kit / Mix'} close={()=>setOpen(false)}>
  <div className="formgrid">
   <label>Tipo<ThemedSelect value={k.kit_type||'STANDARD'} onChange={e=>setK({...k,kit_type:e.target.value,items:e.target.value==='STANDARD'?k.items:[]})}><option value="STANDARD">Kit / Combo normal</option><option value="MIX_WEIGHT">Mix por Peso</option><option value="MIX_VOLUME_L">Mix por Litro (L)</option><option value="MIX_VOLUME_ML">Mix por Mililitro (ml)</option></ThemedSelect></label>
   <label>Nome<input value={k.name} onChange={e=>setK({...k,name:e.target.value})} placeholder={k.kit_type==='MIX_WEIGHT'?'Ex.: Velas Palito Sortidas por KG':'Nome do combo'}/></label>
   <label>SKU<input value={k.sku||''} onChange={e=>setK({...k,sku:e.target.value})}/></label>
   <label>Categoria<ThemedSelect value={k.category_id||kitCat?.id||''} onChange={e=>setK({...k,category_id:e.target.value})}><option value={kitCat?.id||''}>Kits / Combos</option></ThemedSelect></label>
   <label>{k.kit_type==='MIX_WEIGHT'?'Preço por kg':k.kit_type==='MIX_VOLUME_L'?'Preço por litro':k.kit_type==='MIX_VOLUME_ML'?'Preço por mililitro':'Preço'}<CurrencyInput value={k.price_cents} onChange={v=>setK({...k,price_cents:v})}/></label>
   {k.kit_type!=='STANDARD'&&<><label>Categoria dos produtos do Mix<ThemedSelect value={k.mix_category_id||''} onChange={e=>setK({...k,mix_category_id:e.target.value})}><option value="">Todas as categorias compatíveis</option>{mixCats.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</ThemedSelect><small className="muted">Na venda, a busca mostrará produtos desta categoria e de suas subcategorias.</small></label>{k.kit_type==='MIX_WEIGHT'?<label>Estoque-base em kg (opcional)<ThemedSelect value={k.weight_product_id||''} onChange={e=>setK({...k,weight_product_id:e.target.value})}><option value="">Não baixar um estoque geral em kg</option>{weightProducts.map(p=><option key={p.id} value={p.id}>{p.name} · {stockLabel(p)}</option>)}</ThemedSelect><small className="muted">Se escolhido, além das cores será baixado o peso total deste produto-base.</small></label>:<label>Estoque-base de volume (opcional)<ThemedSelect value={k.volume_product_id||''} onChange={e=>setK({...k,volume_product_id:e.target.value})}><option value="">Não baixar estoque-base adicional</option>{volumeProducts.map(p=><option key={p.id} value={p.id}>{p.name} · {stockLabel(p)}</option>)}</ThemedSelect><small className="muted">Se escolhido, o volume total do Mix também será baixado deste produto-base.</small></label>}</>}
  </div>
  {k.kit_type!=='STANDARD'?<div className="panel" style={{marginTop:12}}><h3>Composição dinâmica</h3><p className="muted">{k.kit_type==='MIX_WEIGHT'?'Na venda, pesquise cada cor, informe a quantidade e o peso de cada uma. O sistema soma os componentes e calcula o preço por kg.':'Na venda, selecione os produtos líquidos e informe o volume de cada componente. O sistema soma os mililitros e calcula o preço por '+(k.kit_type==='MIX_VOLUME_L'?'litro.':'mililitro.')}</p><div className="ux-help-steps"><span><b>1</b>Pesquisar os produtos</span><span><b>2</b>Informar quantidade ou volume</span><span><b>3</b>Repetir para os componentes</span><span><b>4</b>Finalizar um único Mix</span></div></div>:<><h3>Composição fixa</h3><div className="kititems">{standardProducts.map(p=><label key={p.id}><span>{p.name}</span><input type="number" min="0" value={k.items.find(i=>i.product_id===p.id)?.quantity||0} onChange={e=>{const n=Number(e.target.value);let items=k.items.filter(i=>i.product_id!==p.id);if(n>0)items.push({product_id:p.id,quantity:n});setK({...k,items})}}/></label>)}</div></>}
  <div className="modalactions"><button onClick={()=>setOpen(false)}>Cancelar</button><button className="primary" onClick={save}>{k.kit_type==='MIX_WEIGHT'?'Salvar Mix por Peso':k.kit_type==='MIX_VOLUME_L'?'Salvar Mix por Litro':k.kit_type==='MIX_VOLUME_ML'?'Salvar Mix por Mililitro':'Salvar combo'}</button></div>
 </Modal>}
 {deleteKit&&<Modal title="Excluir Kit / Combo" close={()=>!deleteBusy&&setDeleteKit(null)}><div className="ux-warning-box"><I.TriangleAlert/><span>Deseja excluir <b>{deleteKit.name}</b>? O cadastro será desativado, mas vendas anteriores continuarão intactas. Se existir orçamento em aberto usando este item, a exclusão será bloqueada.</span></div><div className="modalactions"><button disabled={deleteBusy} onClick={()=>setDeleteKit(null)}>Cancelar</button><button className="dangerbtn" disabled={deleteBusy} onClick={removeKit}><I.Trash2/> {deleteBusy?'Excluindo...':'Excluir Kit / Combo'}</button></div></Modal>}
 </>
}
function Clientes({notify}){const[items,setItems]=useState([]),[open,setOpen]=useState(false),[edit,setEdit]=useState(null),[ledger,setLedger]=useState(null),[search,setSearch]=useState('');const refresh=useDataRefresh();const[view,setView]=useViewMode('clientes','details');const load=()=>window.api.customers.list().then(setItems).catch(notify);useEffect(()=>{load()},[refresh]);const filtered=useMemo(()=>{const q=search.trim().toLocaleLowerCase('pt-BR');if(!q)return items;return items.filter(c=>[c.name,c.cpf,c.cnpj,c.phone,c.city,c.neighborhood].some(v=>String(v||'').toLocaleLowerCase('pt-BR').includes(q)))},[items,search]);return <><div className="toolbar customers-toolbar"><div><h2>Clientes</h2><p className="muted">Cadastre Pessoa Física ou Jurídica, consulte rapidamente e acesse o histórico financeiro.</p></div><div className="customer-tools"><div className="searchbox"><I.Search/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Pesquisar cliente, CPF/CNPJ, telefone ou cidade..."/></div><ViewModeMenu value={view} onChange={setView}/><button className="primary" onClick={()=>{setEdit(null);setOpen(true)}}><I.UserPlus/> Novo cliente</button></div></div><div className={`table panel customers-table ux-collection ux-view-${view}`}><table><thead><tr><th>Cliente</th><th>Tipo</th><th>CPF/CNPJ</th><th>Telefone</th><th>Endereço</th><th>Saldo / débito</th><th></th></tr></thead><tbody>{filtered.map(c=><tr key={c.id}><td data-label="Cliente"><b>{c.name}</b></td><td data-label="Tipo">{c.person_type==='PJ'?'Pessoa Jurídica':'Pessoa Física'}</td><td data-label="CPF/CNPJ">{c.person_type==='PJ'?(c.cnpj?maskCNPJ(c.cnpj):'—'):(c.cpf?maskCPF(c.cpf):'—')}</td><td data-label="Telefone">{c.phone?phoneMask(c.phone):'—'}</td><td data-label="Endereço">{[c.address,c.address_number,c.neighborhood,c.city,c.state].filter(Boolean).join(', ')||'—'}</td><td data-label="Saldo / débito"><span className={c.balance_cents?'badge warn':'badge'}>{brl(c.balance_cents)}</span></td><td data-label="Ações"><button className="smallbtn" onClick={()=>setLedger(c.id)}>Histórico</button><button className="iconbtn" onClick={()=>{setEdit(c);setOpen(true)}}><I.Pencil/></button></td></tr>)}{!filtered.length&&<tr><td colSpan="7" className="muted">Nenhum cliente encontrado.</td></tr>}</tbody></table></div>{open&&<CustomerModal edit={edit} close={()=>setOpen(false)} done={()=>{load();dataChanged()}} notify={notify}/>} {ledger&&<LedgerModal id={ledger} close={()=>setLedger(null)} notify={notify}/>}</>}

function CustomerModal({edit,close,done,notify}){const normalize=x=>x?{...x,person_type:x.person_type||'PF',phone:phoneMask(x.phone||''),cpf:maskCPF(x.cpf||''),cnpj:maskCNPJ(x.cnpj||''),cep:maskCEP(x.cep||'')}:{name:'',person_type:'PF',phone:'',cpf:'',rg:'',cnpj:'',email:'',address:'',address_number:'',address_complement:'',neighborhood:'',city:'',state:'',cep:'',ie:'',im:''};const[c,setC]=useState(normalize(edit));const save=async()=>{try{if(!c.name.trim())return notify(c.person_type==='PJ'?'Informe a Razão Social / Nome.':'Informe o nome do cliente.');if(c.person_type==='PJ'&&onlyDigits(c.cnpj).length!==14)return notify('Informe o CNPJ com 14 dígitos.');await window.api.customers.save({...c,phone:onlyDigits(c.phone),cpf:onlyDigits(c.cpf),cnpj:onlyDigits(c.cnpj),cep:onlyDigits(c.cep)});notify(edit?'Cliente atualizado.':'Cliente cadastrado.');close();done()}catch(e){notify(e)}};return <Modal title={edit?'Editar cliente':'Novo cliente'} close={close} wide><div className="formgrid"><label>Tipo de pessoa<ThemedSelect value={c.person_type} onChange={e=>setC({...c,person_type:e.target.value})}><option value="PF">Pessoa Física</option><option value="PJ">Pessoa Jurídica</option></ThemedSelect></label><label>{c.person_type==='PJ'?'Nome / Razão Social*':'Nome completo*'}<input autoFocus value={c.name} onChange={e=>setC({...c,name:e.target.value})}/></label>{c.person_type==='PF'?<><label>CPF (opcional)<input inputMode="numeric" value={c.cpf} onChange={e=>setC({...c,cpf:maskCPF(e.target.value)})}/></label><label>RG (opcional)<input value={c.rg||''} onChange={e=>setC({...c,rg:e.target.value})}/></label></>:<><label>CNPJ*<input inputMode="numeric" value={c.cnpj} onChange={e=>setC({...c,cnpj:maskCNPJ(e.target.value)})}/></label><label>Inscrição Estadual (opcional)<input value={c.ie||''} onChange={e=>setC({...c,ie:e.target.value})}/></label><label>Inscrição Municipal (opcional)<input value={c.im||''} onChange={e=>setC({...c,im:e.target.value})}/></label></>}<label>Telefone (opcional)<input inputMode="numeric" value={c.phone} onChange={e=>setC({...c,phone:phoneMask(e.target.value)})} placeholder="(00) 00000-0000"/></label><label>E-mail (opcional)<input type="email" value={c.email||''} onChange={e=>setC({...c,email:e.target.value})}/></label><label>CEP (opcional)<input inputMode="numeric" value={c.cep||''} onChange={e=>setC({...c,cep:maskCEP(e.target.value)})}/></label><label className="span2">Endereço / Logradouro (opcional)<input value={c.address||''} onChange={e=>setC({...c,address:e.target.value})}/></label><label>Número (opcional)<input value={c.address_number||''} onChange={e=>setC({...c,address_number:e.target.value})}/></label><label>Complemento (opcional)<input value={c.address_complement||''} onChange={e=>setC({...c,address_complement:e.target.value})}/></label><label>Bairro (opcional)<input value={c.neighborhood||''} onChange={e=>setC({...c,neighborhood:e.target.value})}/></label><label>Cidade (opcional)<input value={c.city||''} onChange={e=>setC({...c,city:e.target.value})}/></label><label>UF (opcional)<input maxLength="2" value={c.state||''} onChange={e=>setC({...c,state:e.target.value.toUpperCase()})}/></label></div><p className="muted customerhint">* Obrigatório. Para Pessoa Física, CPF e RG são opcionais. Para Pessoa Jurídica, somente Nome/Razão Social e CNPJ são obrigatórios.</p><div className="modalactions"><button onClick={close}>Cancelar</button><button className="primary" onClick={save}>Salvar cliente</button></div></Modal>}

function LedgerModal({id,close,notify}){const[data,setData]=useState(null),[pay,setPay]=useState(0),[method,setMethod]=useState('Dinheiro');const load=()=>window.api.customers.ledger(id).then(setData).catch(notify);useEffect(()=>{load()},[id]);if(!data)return <Modal title="Histórico" close={close}><Loading loading/></Modal>;return <Modal wide title={`Histórico · ${data.customer.name}`} close={close}><div className="ledgerhead"><div><span>Saldo atual</span><strong>{brl(data.customer.balance_cents)}</strong></div><div className="paymentbox"><CurrencyInput value={pay} onChange={setPay}/><ThemedSelect value={method} onChange={e=>setMethod(e.target.value)}><option>Dinheiro</option><option>PIX</option><option>Cartão</option></ThemedSelect><button className="primary" disabled={!pay} onClick={async()=>{try{await window.api.customers.payment({customer_id:id,amount_cents:pay,method});setPay(0);await load();dataChanged()}catch(e){notify(e)}}}>Registrar pagamento</button></div></div><h3>Compras / débitos</h3><div className="timeline">{data.sales.map(s=><div className="timelineitem" key={s.id}><b>Venda #{s.id}</b><span>{fmtDate(s.sold_at)}</span><strong>{brl(s.total_cents)}</strong><small>{s.payment} · débito {brl(s.due_cents)}</small></div>)}</div><h3>Pagamentos recebidos</h3><div className="timeline">{data.payments.map(p=><div className="timelineitem" key={p.id}><b>Pagamento</b><span>{fmtDate(p.created_at)}</span><strong>{brl(p.amount_cents)}</strong><small>{p.method}</small></div>)}</div></Modal>}

function Fornecedores({notify}){
 const[items,setItems]=useState([]),[search,setSearch]=useState(''),[open,setOpen]=useState(false),[edit,setEdit]=useState(null),[loading,setLoading]=useState(true);
 const[view,setView]=useViewMode('fornecedores','details');
 const load=async()=>{setLoading(true);try{setItems(await window.api.suppliers.list(search))}catch(e){notify(e)}finally{setLoading(false)}};
 useEffect(()=>{load()},[search]);
 const remove=async(id)=>{if(!confirm('Excluir este fornecedor?'))return;try{await window.api.suppliers.delete(id);notify('Fornecedor excluído.');await load();dataChanged()}catch(e){notify(e)}};
 return <>
  <div className="toolbar"><div><h2>Fornecedores</h2><p className="muted">Cadastre e mantenha os dados dos fornecedores da loja.</p></div><div className="actions"><ViewModeMenu value={view} onChange={setView}/><button className="primary" onClick={()=>{setEdit(null);setOpen(true)}}><I.Plus/> Novo fornecedor</button></div></div>
  <div className="panel suppliersearch"><div className="search"><I.Search/><input placeholder="Pesquisar por nome, documento, telefone ou e-mail..." value={search} onChange={e=>setSearch(e.target.value)}/></div></div>
  {loading?<Loading loading/>:<div className={`table panel ux-collection ux-view-${view}`}><table><thead><tr><th>Fornecedor</th><th>Documento</th><th>Telefone</th><th>E-mail</th><th>Endereço</th><th></th></tr></thead><tbody>
   {items.length?items.map(x=><tr key={x.id}><td data-label="Fornecedor"><b>{x.name}</b>{x.notes&&<small className="table-note">{x.notes}</small>}</td><td data-label="Documento">{x.document||'—'}</td><td data-label="Telefone">{x.phone||'—'}</td><td data-label="E-mail">{x.email||'—'}</td><td data-label="Endereço">{x.address||'—'}</td><td data-label="Ações" className="actions"><button className="iconbtn" title="Editar" onClick={()=>{setEdit(x);setOpen(true)}}><I.Pencil/></button><button className="iconbtn danger" title="Excluir" onClick={()=>remove(x.id)}><I.Trash2/></button></td></tr>):<tr><td colSpan="6"><div className="empty compact"><I.Truck/><p>Nenhum fornecedor cadastrado.</p></div></td></tr>}
  </tbody></table></div>}
  {open&&<SupplierModal edit={edit} close={()=>setOpen(false)} done={async()=>{await load();dataChanged()}} notify={notify}/>}</>
}
function SupplierModal({edit,close,done,notify}){
 const[s,setS]=useState(edit?{...edit}:{name:'',document:'',phone:'',email:'',address:'',notes:''});
 const save=async()=>{try{if(!s.name.trim())return notify('Informe o nome do fornecedor.');await window.api.suppliers.save(s);notify(edit?'Fornecedor atualizado.':'Fornecedor cadastrado.');close();done()}catch(e){notify(e)}};
 return <Modal wide title={edit?'Editar fornecedor':'Novo fornecedor'} close={close}><div className="formgrid">
  <label>Nome / razão social*<input autoFocus value={s.name} onChange={e=>setS({...s,name:e.target.value})}/></label>
  <label>CPF/CNPJ<input value={s.document||''} onChange={e=>setS({...s,document:e.target.value})}/></label>
  <label>Telefone<input value={s.phone||''} onChange={e=>setS({...s,phone:e.target.value})}/></label>
  <label>E-mail<input type="email" value={s.email||''} onChange={e=>setS({...s,email:e.target.value})}/></label>
  <label className="span2">Endereço<input value={s.address||''} onChange={e=>setS({...s,address:e.target.value})}/></label>
  <label className="span2">Observações<textarea rows="4" value={s.notes||''} onChange={e=>setS({...s,notes:e.target.value})}/></label>
 </div><div className="modalactions"><button onClick={close}>Cancelar</button><button className="primary" onClick={save}>Salvar fornecedor</button></div></Modal>
}
function Vendas({notify}){const[d,setD]=useState(new Date().toISOString().slice(0,10)),[items,setItems]=useState([]);const refresh=useDataRefresh();const[view,setView]=useViewMode('vendas','details');const load=()=>window.api.sales.list(d).then(setItems).catch(notify);useEffect(()=>{load()},[d,refresh]);return <><div className="toolbar"><div><h2>Vendas do dia</h2><p className="muted">Operador, cliente, meios de pagamento, parcelas, taxas, valores e situação da venda.</p></div><div className="actions"><ViewModeMenu value={view} onChange={setView}/><label>Data <input type="date" value={d} onChange={e=>setD(e.target.value)}/></label></div></div><div className={`table panel ux-collection ux-view-${view}`}><table><thead><tr><th>Hora</th><th>Status</th><th>Operador</th><th>Itens</th><th>Cliente</th><th>Destino</th><th>Meios / condições</th><th>Pago</th><th>Débito</th><th>Total</th><th>Fiscal</th></tr></thead><tbody>{items.map(x=><tr key={x.id} className={x.status==='CANCELADA'?'sale-canceled':''}><td data-label="Hora">{fmtTime(x.sold_at)}</td><td data-label="Status"><span className={`badge ${x.status==='CANCELADA'?'danger':'ok'}`}>{x.status||'CONCLUÍDA'}</span></td><td data-label="Operador">{x.operator||'—'}</td><td data-label="Itens">{x.items}</td><td data-label="Cliente">{x.customer_name||'—'}</td><td data-label="Destino">{Number(x.delivery_required||0)===1?<span className="badge warn">ENTREGA</span>:<span className="badge">RETIRADA</span>}</td><td data-label="Pagamento">{x.payment_details||x.payment}</td><td data-label="Pago">{brl(x.amount_paid_cents)}</td><td data-label="Débito">{brl(x.due_cents)}</td><td data-label="Total" className="money">{brl(x.total_cents)}</td><td data-label="Fiscal">{x.status==='CANCELADA'?<small>{x.canceled_reason||'Cancelada'}</small>:x.fiscal_id?<span className="badge warn">{x.fiscal_status}</span>:<button className="smallbtn" onClick={async()=>{try{await window.api.fiscal.issue(x.id);load()}catch(e){notify(e)}}}><I.FileCheck2/> NFC-e</button>}</td></tr>)}</tbody></table></div></>}
function Fiscal({notify}){
 const[docs,setDocs]=useState([]),[pending,setPending]=useState([]),[s,setS]=useState({}),[password,setPassword]=useState(''),[certInfo,setCertInfo]=useState(null),[loading,setLoading]=useState(false);
 const load=()=>Promise.all([window.api.fiscal.list(),window.api.fiscal.pendingSales(),window.api.fiscal.settings()]).then(([a,b,c])=>{setDocs(a);setPending(b);setS(c)}).catch(notify);
 useEffect(()=>{load()},[]);
 const save=async()=>{try{setLoading(true);await window.api.fiscal.saveSettings({...s,fiscal_cert_password:password});setPassword('');await load();notify('Configuração NFC-e salva com segurança.')}catch(e){notify(e)}finally{setLoading(false)}};
 const chooseCert=async()=>{try{const p=await window.api.fiscal.chooseCertificate();if(p){setS(x=>({...x,fiscal_cert_path:p}));notify('Certificado selecionado. Clique em Salvar configuração.')}}catch(e){notify(e)}};
 const certTest=async()=>{try{const info=await window.api.fiscal.certificateInfo({path:s.fiscal_cert_path,password:password||undefined});setCertInfo(info);notify('Certificado A1 lido com sucesso.')}catch(e){notify(e)}};
 const sefazTest=async()=>{try{const r=await window.api.fiscal.testStatus();notify(`SEFAZ-SP: ${r.cStat||''} · ${r.xMotivo||'resposta recebida'}`)}catch(e){notify(e)}};
 const issue=async id=>{try{setLoading(true);const r=await window.api.fiscal.issue(id);notify(`${r.status}: ${r.reason||'processamento concluído'}`);load()}catch(e){notify(e)}finally{setLoading(false)}};
 const contingency=async id=>{try{const reason=prompt('Justificativa da contingência offline:','Indisponibilidade técnica do ambiente autorizador');if(!reason)return;const r=await window.api.fiscal.contingency(id,reason);notify(`NFC-e criada em contingência offline: ${r.key}`);load()}catch(e){notify(e)}};
 const cancel=async d=>{try{const reason=prompt('Justificativa do cancelamento (mínimo 15 caracteres):','Cancelamento por erro na operação de venda');if(!reason)return;const r=await window.api.fiscal.cancel(d.id,reason);notify(`${r.status}: ${r.reason||''}`);load()}catch(e){notify(e)}};
 const danfe=async d=>{try{const p=await window.api.fiscal.danfe(d.id);notify(`DANFE PDF gerado em: ${p}`)}catch(e){notify(e)}};
 return <div className="fiscalpage">
  <div className="panel fiscalintro"><I.ShieldCheck/><div><h2>NFC-e São Paulo — emissão fiscal</h2><p className="muted">Módulo para certificado A1, CSC, assinatura XML, homologação/produção, autorização síncrona, QR Code, DANFE, cancelamento e contingência offline.</p><small className="muted">O ambiente de produção somente deve ser ativado depois do credenciamento e testes do contribuinte na SEFAZ-SP.</small></div></div>
  <div className="panel"><div className="toolbar inline"><div><h2>Configuração fiscal</h2><p className="muted">Dados usados na geração e transmissão da NFC-e modelo 65.</p></div><span className={`badge ${s.fiscal_environment==='producao'?'ok':'warn'}`}>{s.fiscal_environment==='producao'?'PRODUÇÃO':'HOMOLOGAÇÃO'}</span></div>
   <div className="formgrid">
    <label>Ambiente<ThemedSelect value={s.fiscal_environment||'homologacao'} onChange={e=>setS({...s,fiscal_environment:e.target.value})}><option value="homologacao">Homologação</option><option value="producao">Produção</option></ThemedSelect></label>
    <label>Série<input value={s.fiscal_series||'1'} onChange={e=>setS({...s,fiscal_series:e.target.value})}/></label>
    <label>Próximo número<input type="number" min="1" value={s.fiscal_next_number||1} onChange={e=>setS({...s,fiscal_next_number:e.target.value})}/></label>
    <label>CRT<ThemedSelect value={s.company_crt||'1'} onChange={e=>setS({...s,company_crt:e.target.value})}><option value="1">1 — Simples Nacional</option><option value="2">2 — Simples Nacional, excesso sublimite</option><option value="3">3 — Regime Normal</option></ThemedSelect></label>
    <label>CNPJ<input value={s.company_cnpj||''} onChange={e=>setS({...s,company_cnpj:e.target.value})}/></label>
    <label>Inscrição estadual<input value={s.company_ie||''} onChange={e=>setS({...s,company_ie:e.target.value})}/></label>
    <label>Razão social<input value={s.company_legal_name||''} onChange={e=>setS({...s,company_legal_name:e.target.value})}/></label>
    <label>Nome fantasia<input value={s.company_fantasy_name||''} onChange={e=>setS({...s,company_fantasy_name:e.target.value})}/></label>
    <label className="span2">Endereço fiscal <input placeholder="Rua, número, bairro, município, UF, CEP" value={s.company_address||''} onChange={e=>setS({...s,company_address:e.target.value})}/></label>
    <label>Código IBGE município<input value={s.company_city_code||'3502804'} onChange={e=>setS({...s,company_city_code:e.target.value})}/></label>
    <label>CSC — ID<input value={s.fiscal_csc_id||''} onChange={e=>setS({...s,fiscal_csc_id:e.target.value})}/></label>
    <label className="span2">CSC — Token<input type="password" value={s.fiscal_csc_token||''} onChange={e=>setS({...s,fiscal_csc_token:e.target.value})}/></label>
    <label className="span2">Certificado A1 (.pfx/.p12)<div className="inlinefield"><input readOnly value={s.fiscal_cert_path||''} placeholder="Nenhum certificado selecionado"/><button className="smallbtn" onClick={chooseCert}><I.FolderOpen/> Selecionar</button></div></label>
    <label>Senha do A1<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Deixe em branco para manter a salva"/></label>
    <label>QR Code<ThemedSelect value={s.fiscal_qrcode_version||'100'} onChange={e=>setS({...s,fiscal_qrcode_version:e.target.value})}><option value="100">100 — padrão atual SP</option></ThemedSelect></label>
   </div>
   <div className="modalactions"><button className="smallbtn" onClick={certTest}><I.BadgeCheck/> Testar certificado</button><button className="smallbtn" onClick={sefazTest}><I.Globe2/> Testar SEFAZ-SP</button><button className="primary" disabled={loading} onClick={save}><I.Save/> Salvar configuração</button></div>
   {certInfo&&<div className="note"><I.BadgeCheck/><div><b>Certificado válido para leitura</b><br/><small>{certInfo.subject}<br/>Válido de {fmtDate(certInfo.validFrom)} até {fmtDate(certInfo.validTo)}</small></div></div>}
  </div>
  <div className="panel"><div className="toolbar inline"><div><h2>Vendas pendentes de NFC-e</h2><p className="muted">A emissão é vinculada à venda já registrada no caixa.</p></div></div>{pending.length?pending.map(x=><div className="fiscalpendingrow" key={x.id}><span><b>Venda #{x.id}</b> · {fmtDate(x.sold_at)} · {brl(x.total_cents)}<small>{x.items}</small></span><div className="rowactions"><button className="smallbtn" onClick={()=>issue(x.id)}><I.Send/> Emitir NFC-e</button><button className="smallbtn" onClick={()=>contingency(x.id)}><I.WifiOff/> Contingência offline</button></div></div>):<p className="muted">Nenhuma venda pendente.</p>}</div>
  <div className="table panel"><div className="toolbar inline"><div><h2>Documentos fiscais</h2><p className="muted">XMLs e protocolos são arquivados localmente por ambiente e período.</p></div><button className="smallbtn" onClick={async()=>{try{const r=await window.api.fiscal.transmitPending();notify(`Contingências processadas: ${r.length}`);load()}catch(e){notify(e)}}}><I.UploadCloud/> Transmitir contingências</button></div><table><thead><tr><th>Número</th><th>Série</th><th>Venda</th><th>Chave</th><th>Status</th><th>Protocolo</th><th></th></tr></thead><tbody>{docs.map(d=><tr key={d.id}><td>{d.number}</td><td>{d.series}</td><td>#{d.sale_id}</td><td className="mono">{d.access_key||'—'}</td><td><span className={`badge ${d.status==='AUTORIZADA'?'ok':d.status==='CANCELADA'?'danger':'warn'}`}>{d.status}</span></td><td>{d.protocol||'—'}</td><td className="actions"><button className="smallbtn" onClick={()=>danfe(d)}><I.Printer/> DANFE</button>{d.status==='AUTORIZADA'&&<button className="smallbtn danger" onClick={()=>cancel(d)}><I.XCircle/> Cancelar</button>}</td></tr>)}</tbody></table></div>
 </div>
}

function CaixaFinanceiro({settings,notify}){
 const defaultCashEnabled=String(settings.cash_default_opening_enabled||'0')==='1';
 const defaultCashCents=Math.max(0,Number(settings.cash_default_opening_cents||0));
 const[current,setCurrent]=useState(null),[drawerBusy,setDrawerBusy]=useState(false),[drawerHistory,setDrawerHistory]=useState([]),[opening,setOpening]=useState(()=>defaultCashEnabled?defaultCashCents:0),[openingNote,setOpeningNote]=useState(''),[saveOpeningDefault,setSaveOpeningDefault]=useState(false),[openingTouched,setOpeningTouched]=useState(false),[history,setHistory]=useState([]),[operators,setOperators]=useState([]),[cashOperator,setCashOperator]=useState(null),[loading,setLoading]=useState(true),[openingBusy,setOpeningBusy]=useState(false),[closing,setClosing]=useState(false),[preview,setPreview]=useState(false),[withdrawOpen,setWithdrawOpen]=useState(false),[withdrawAmount,setWithdrawAmount]=useState(0),[withdrawReason,setWithdrawReason]=useState(''),[withdrawBusy,setWithdrawBusy]=useState(false),[cancelId,setCancelId]=useState(''),[cancelSale,setCancelSale]=useState(null),[cancelReason,setCancelReason]=useState(''),[cancelConfirm,setCancelConfirm]=useState(''),[cancelBusy,setCancelBusy]=useState(false);
 const refresh=useDataRefresh();
 const load=async()=>{setLoading(true);try{const[c,h,os,dh]=await Promise.all([window.api.cash.current(),window.api.cash.history({from:new Date().toISOString().slice(0,10),to:new Date().toISOString().slice(0,10)}),window.api.operators.list(),window.api.cash.drawerHistory(30)]);setCurrent(c);setHistory(h);setDrawerHistory(dh||[]);setOperators(os);if(!cashOperator){const preferred=os.find(o=>String(o.id)===String(settings.current_operator_id));setCashOperator(preferred||os[0]||null)}}catch(e){notify(e)}finally{setLoading(false)}};
 useEffect(()=>{load()},[settings.current_operator_id,refresh]);
 useEffect(()=>{if(!current&&!openingTouched)setOpening(defaultCashEnabled?defaultCashCents:0)},[current,defaultCashEnabled,defaultCashCents,openingTouched]);
 const openCash=async()=>{if(openingBusy)return;setOpeningBusy(true);try{const cents=Number(opening||0);if(!cashOperator&&operators.length)throw new Error('Selecione o operador responsável pela abertura do caixa.');if(cashOperator){await window.api.settings.set({current_operator_id:cashOperator.id,current_operator_name:cashOperator.name,current_operator_photo:cashOperator.photo_data||'',current_operator_role:cashOperator.role==='admin'?'admin':'operator'});window.dispatchEvent(new CustomEvent('operator-changed',{detail:cashOperator}))}if(saveOpeningDefault){await window.api.settings.set({cash_default_opening_enabled:'1',cash_default_opening_cents:String(Math.max(0,Math.round(cents)))})}const c=await window.api.cash.open({opening_cents:cents,operator:cashOperator?.name||settings.operator||'Caixa',notes:openingNote});setOpening(0);setOpeningTouched(false);setSaveOpeningDefault(false);setOpeningNote('');setCurrent(c);dataChanged();notify(saveOpeningDefault?'Caixa aberto e fundo de troco padrão atualizado.':'Caixa aberto com sucesso. Você já pode iniciar vendas.')}catch(e){notify(e)}finally{setOpeningBusy(false)}};
 const openDrawer=async()=>{if(drawerBusy)return;setDrawerBusy(true);try{const r=await window.api.cash.openDrawer();await load();notify(r?.ok?'Comando de abertura enviado à impressora.':'A impressora não confirmou a abertura: '+(r?.error||'verifique a conexão.'))}catch(e){notify(e)}finally{setDrawerBusy(false)}};
 const closeCash=async()=>{if(closing)return;setClosing(true);try{const c=await window.api.cash.close({});setPreview(false);setCurrent(null);await load();dataChanged();notify(`Caixa fechado com sucesso. Saldo estimado do fechamento: ${brl(c.expected_total_cents)}`)}catch(e){notify(e)}finally{setClosing(false)}};
 const withdrawCash=async()=>{if(withdrawBusy)return;try{setWithdrawBusy(true);if(Number(withdrawAmount||0)<=0)throw new Error('Informe o valor da retirada.');if(withdrawReason.trim().length<3)throw new Error('Informe o motivo da retirada.');const c=await window.api.cash.withdraw({amount_cents:Number(withdrawAmount||0),reason:withdrawReason.trim(),operator:settings.current_operator_name||cashOperator?.name||settings.operator||'Caixa'});setCurrent(c);setWithdrawAmount(0);setWithdrawReason('');setWithdrawOpen(false);await load();dataChanged();notify('Retirada registrada e vinculada ao caixa atual.')}catch(e){notify(e)}finally{setWithdrawBusy(false)}};
 const findSale=async()=>{try{const id=Number(cancelId);if(!id)throw new Error('Informe o número da venda.');const d=await window.api.sales.detail(id);if(!d?.sale)throw new Error('Venda não encontrada.');setCancelSale(d);setCancelReason('');setCancelConfirm('')}catch(e){notify(e)}};
 const cancel=async()=>{if(cancelBusy)return;try{setCancelBusy(true);const id=Number(cancelSale?.sale?.id);if(cancelConfirm.trim().toUpperCase()!==`CANCELAR ${id}`)throw new Error(`Digite CANCELAR ${id} para confirmar.`);const r=await window.api.sales.cancel({id,reason:cancelReason,operator:settings.current_operator_name||settings.operator||'Administrador'});setCancelSale(null);setCancelId('');setCancelReason('');setCancelConfirm('');await load();dataChanged();notify(`Venda #${r.id} cancelada. Estoque e pendências relacionadas foram ajustados.`)}catch(e){notify(e)}finally{setCancelBusy(false)}};
 return <div className="cashpage">
  <div className="cashhero panel"><div><div className="ux-title-with-help"><h2>Controle de Caixa</h2><HelpTip text="Abra o caixa antes da primeira venda e feche no fim do expediente. O cancelamento de venda fica em uma área protegida no final desta página."/></div><p className="muted">Abertura e fechamento diário do caixa, com vínculo automático das vendas realizadas enquanto o caixa estiver aberto.</p></div><span className={`badge ${current?'ok':'warn'}`}>{current?'CAIXA ABERTO':'CAIXA FECHADO'}</span></div>
  {!current?<div className="panel"><h2>Abertura de caixa</h2>{defaultCashEnabled&&<div className="ux-settings-note"><I.Info/><span>Fundo de troco padrão configurado: <b>{brl(defaultCashCents)}</b>. Você pode alterar o valor somente para esta abertura.</span></div>}<div className="formgrid"><label>Valor inicial / fundo de troco*<CurrencyInput value={opening} onChange={v=>{setOpening(v);setOpeningTouched(true)}}/></label><label>Operador responsável<ThemedSelect value={cashOperator?.id||''} onChange={e=>setCashOperator(operators.find(o=>String(o.id)===String(e.target.value))||null)}><option value="">{operators.length?'Selecione o operador':'Nenhum operador cadastrado — usar Caixa'}</option>{operators.map(o=><option value={o.id} key={o.id}>{o.name}</option>)}</ThemedSelect></label><label className="span2">Observação (opcional)<input value={openingNote} onChange={e=>setOpeningNote(e.target.value)} placeholder="Ex.: fundo de troco"/></label><label className="span2 printoption"><input type="checkbox" checked={saveOpeningDefault} onChange={e=>setSaveOpeningDefault(e.target.checked)}/> Salvar este valor como fundo de troco padrão diário</label></div><div className="modalactions"><button className="primary" disabled={openingBusy} onClick={openCash}><I.Unlock/> {openingBusy?'Abrindo...':'Abrir caixa'}</button></div><p className="muted">O valor inicial é dinheiro já existente no caixa para troco e não é contabilizado como venda. No fechamento ele aparece separado das vendas. O operador escolhido aqui fica registrado no fechamento; o operador da venda continua podendo ser escolhido separadamente na tela <b>Vendas</b>.</p></div>:<div className="panel"><div className="toolbar inline"><div><h2>Caixa aberto</h2><p className="muted">Abertura: {fmtDate(current.opened_at)} · operador: {current.operator||'—'}</p></div><div className="actions"><button className="smallbtn" onClick={()=>setWithdrawOpen(true)}><I.WalletCards/> Registrar retirada</button>{(settings.current_operator_role==='admin'||String(settings.cash_drawer_manual_operator_access||'0')==='1')&&<button className="smallbtn" disabled={drawerBusy} onClick={openDrawer}><I.Unlock/> {drawerBusy?'Acionando...':'Abrir gaveta'}</button>}<button className="dangerbtn" disabled={closing} onClick={()=>setPreview(true)}><I.Lock/> Fechar caixa</button></div></div><div className="cashcards"><div><span>Valor inicial</span><strong>{brl(current.opening_cents)}</strong></div><div><span>Vendas vinculadas</span><strong>{current.sales_count}</strong></div><div><span>Total vendido</span><strong>{brl(current.total_sales_cents)}</strong></div><div><span>Retiradas</span><strong>{brl(current.total_withdrawals_cents)}</strong></div><div><span>Saldo estimado</span><strong>{brl(current.expected_total_cents)}</strong></div></div></div>}
  {withdrawOpen&&current&&<Modal title="Registrar retirada de caixa" close={()=>!withdrawBusy&&setWithdrawOpen(false)}><div className="ux-warning-box"><I.Info/><span>Use esta função para sangria ou qualquer retirada de dinheiro. O motivo é obrigatório e aparecerá no relatório diário do caixa.</span></div><div className="formgrid"><label>Valor da retirada*<CurrencyInput value={withdrawAmount} onChange={setWithdrawAmount}/></label><label>Saldo estimado disponível<input value={brl(current.expected_total_cents)} disabled/></label><label className="span2">Motivo da retirada*<textarea rows="3" value={withdrawReason} onChange={e=>setWithdrawReason(e.target.value)} placeholder="Ex.: pagamento de despesa, troco para outra operação, retirada administrativa..."/></label></div><div className="modalactions"><button disabled={withdrawBusy} onClick={()=>setWithdrawOpen(false)}>Cancelar</button><button className="primary" disabled={withdrawBusy||Number(withdrawAmount||0)<=0||withdrawReason.trim().length<3} onClick={withdrawCash}><I.WalletCards/> {withdrawBusy?'Registrando...':'Confirmar retirada'}</button></div></Modal>}
  {preview&&current&&<Modal title="Fechamento de caixa" close={()=>setPreview(false)} wide><div className="closepreview"><div className="cashcards"><div><span>Valor inicial</span><strong>{brl(current.opening_cents)}</strong></div><div><span>Total vendido no dia</span><strong>{brl(current.total_sales_cents)}</strong></div><div><span>Retiradas</span><strong>{brl(current.total_withdrawals_cents)}</strong></div><div><span>Quantidade de vendas</span><strong>{current.sales_count}</strong></div><div><span>Saldo estimado</span><strong>{brl(current.expected_total_cents)}</strong></div></div>{current.withdrawals?.length>0&&<><h3>Retiradas registradas</h3><div className="table"><table><thead><tr><th>Horário</th><th>Operador</th><th>Motivo</th><th>Valor</th></tr></thead><tbody>{current.withdrawals.map(w=><tr key={w.id}><td>{fmtTime(w.created_at)}</td><td>{w.operator||'—'}</td><td>{w.reason}</td><td className="money">{brl(w.amount_cents)}</td></tr>)}</tbody></table></div></>}<h3>Itens vendidos no dia</h3><div className="table"><table><thead><tr><th>Item</th><th>Quantidade</th><th>Valor total</th></tr></thead><tbody>{current.items?.map((x,i)=><tr key={i}><td>{x.name}</td><td>{x.sale_mode==='WEIGHT'?`${weightLabel(x.weight_grams)}${Number(x.unit_count||0)>0?` · ${Number(x.unit_count)} un.`:''}`:isVolumeLikeMode(x.sale_mode)?volumeLabel(x.volume_ml):x.quantity}</td><td className="money">{brl(x.total_cents)}</td></tr>)}{!current.items?.length&&<tr><td colSpan="3" className="muted">Nenhum item vendido neste caixa.</td></tr>}</tbody></table></div><div className="modalactions"><button onClick={()=>setPreview(false)}>Voltar</button><button className="dangerbtn" disabled={closing} onClick={closeCash}><I.Lock/> {closing?'Fechando...':'Confirmar fechamento'}</button></div></div></Modal>}
  <div className="panel"><div className="toolbar inline"><div><h2>Fechamentos recentes</h2><p className="muted">Resumo dos caixas encerrados.</p></div></div><div className="table"><table><thead><tr><th>Abertura</th><th>Fechamento</th><th>Operador</th><th>Inicial</th><th>Vendas</th><th>Retiradas</th><th>Saldo estimado</th><th>Status</th></tr></thead><tbody>{history.map(c=><tr key={c.id}><td>{fmtDate(c.opened_at)}</td><td>{c.closed_at?fmtDate(c.closed_at):'—'}</td><td>{c.operator||'—'}</td><td>{brl(c.opening_cents)}</td><td>{brl(c.total_sales_cents)}</td><td>{brl(c.total_withdrawals_cents)}</td><td className="money">{brl(c.expected_total_cents)}</td><td><span className={`badge ${c.closing_status==='FECHADO'?'ok':'warn'}`}>{c.closing_status}</span></td></tr>)}{!history.length&&<tr><td colSpan="8" className="muted">Nenhum fechamento registrado hoje.</td></tr>}</tbody></table></div></div>
  <section className="panel"><div className="toolbar inline"><div><h2>Histórico de abertura da gaveta</h2><p className="muted">Registro de acionamentos automáticos e manuais, com operador e resultado.</p></div><button className="smallbtn" onClick={load}><I.RefreshCw/> Atualizar</button></div><div className="table"><table><thead><tr><th>Data e hora</th><th>Origem</th><th>Operador</th><th>Impressora</th><th>Resultado</th><th>Detalhe</th></tr></thead><tbody>{drawerHistory.map(x=><tr key={x.id}><td>{fmtDate(x.created_at)}</td><td>{x.source==='AUTO'?'Automática':'Manual'}</td><td>{x.operator||'—'}</td><td>{x.printer||'—'}</td><td><span className={x.success?'badge ok':'badge danger'}>{x.success?'Enviado':'Falha'}</span></td><td>{x.error||'—'}</td></tr>)}{!drawerHistory.length&&<tr><td colSpan="6" className="muted">Nenhum acionamento registrado.</td></tr>}</tbody></table></div></section>
  <section className="panel ux-danger-zone"><div className="toolbar inline"><div><span className="eyebrow">ÁREA ADMINISTRATIVA</span><h2>Cancelar uma venda</h2><p className="muted">Esta função fica aqui para reduzir cancelamentos acidentais. A venda não é apagada: fica marcada como CANCELADA no histórico.</p></div><I.ShieldAlert/></div><div className="ux-cancel-sale-search"><label>Número da venda<input inputMode="numeric" value={cancelId} onChange={e=>setCancelId(onlyDigits(e.target.value))} placeholder="Ex.: 154"/></label><button className="smallbtn" onClick={findSale}><I.Search/> Localizar venda</button></div></section>
  {cancelSale&&<Modal wide title={`Cancelamento protegido · Venda #${cancelSale.sale.id}`} close={()=>setCancelSale(null)}><div className="ux-cancel-summary"><div><span>Data</span><b>{fmtDate(cancelSale.sale.sold_at)}</b></div><div><span>Cliente</span><b>{cancelSale.sale.customer_name||'Sem cliente'}</b></div><div><span>Total</span><b>{brl(cancelSale.sale.total_cents)}</b></div><div><span>Situação</span><b>{cancelSale.sale.status||'CONCLUÍDA'}</b></div></div><div className="ux-warning-box"><I.TriangleAlert/><span>O cancelamento devolve ao estoque as movimentações registradas pela venda. Se houve pagamento, faça também a devolução financeira ao cliente quando aplicável. Se houver NFC-e ativa, o sistema bloqueará esta ação até a regularização fiscal.</span></div><div className="formgrid"><label className="span2">Motivo do cancelamento*<textarea rows="3" value={cancelReason} onChange={e=>setCancelReason(e.target.value)} placeholder="Explique por que a venda está sendo cancelada."/></label><label className="span2">Confirmação de segurança<input value={cancelConfirm} onChange={e=>setCancelConfirm(e.target.value)} placeholder={`Digite CANCELAR ${cancelSale.sale.id}`}/><small>Para evitar clique errado, digite exatamente <b>CANCELAR {cancelSale.sale.id}</b>.</small></label></div><div className="modalactions"><button onClick={()=>setCancelSale(null)}>Não cancelar</button><button className="dangerbtn" disabled={cancelBusy||cancelReason.trim().length<5||cancelConfirm.trim().toUpperCase()!==`CANCELAR ${cancelSale.sale.id}`} onClick={cancel}><I.XCircle/> {cancelBusy?'Cancelando...':'Cancelar venda definitivamente'}</button></div></Modal>}
 </div>
}

function Agenda({notify}){
 const localDateKey=d=>{const x=d||new Date(),pad=n=>String(n).padStart(2,'0');return `${x.getFullYear()}-${pad(x.getMonth()+1)}-${pad(x.getDate())}`};
 const blank=()=>({customer_id:'',title:'',date:'',time:'09:00',alert_time:'',notes:'',task_kind:'COMPRAS_ESTOQUE',sale_id:'',delivery_method:'LOJA',delivery_address:'',delivery_phone:''});
 const taskLabels={COMPRAS_ESTOQUE:'Compra para estoque',PAGAR_CONTA:'Pagar conta da loja',INVENTARIO:'Realizar inventário',OUTRO:'Outra tarefa interna'};
 const todayKey=localDateKey(),[items,setItems]=useState([]),[customers,setCustomers]=useState([]),[catalog,setCatalog]=useState([]),[deliverySales,setDeliverySales]=useState([]),[selectedDate,setSelectedDate]=useState(todayKey),[monthCursor,setMonthCursor]=useState(()=>{const d=new Date();return new Date(d.getFullYear(),d.getMonth(),1)}),[dayOpen,setDayOpen]=useState(false),[kind,setKind]=useState(null),[editing,setEditing]=useState(null),[form,setForm]=useState(blank()),[loading,setLoading]=useState(true);const refresh=useDataRefresh();
 const load=async()=>{setLoading(true);try{await window.api.agenda.reconcile();const[a,c,p,k]=await Promise.all([window.api.agenda.list({}),window.api.customers.list(),window.api.products.list('',null),window.api.kits.list(null)]);setItems(a||[]);setCustomers((c||[]).sort((x,y)=>x.name.localeCompare(y.name,'pt-BR')));setCatalog([...(p||[]).map(x=>({key:`P:${x.id}`,name:x.name,kind:'Produto/Serviço'})),...(k||[]).map(x=>({key:`K:${x.id}`,name:x.name,kind:'Kit/Combo'}))].sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')))}catch(e){notify(e)}finally{setLoading(false)}};useEffect(()=>{load()},[refresh]);
 const loadDeliverySales=async customerId=>{if(!customerId){setDeliverySales([]);return}try{setDeliverySales(await window.api.agenda.deliverySales(Number(customerId))||[])}catch(e){setDeliverySales([]);notify(e)}};
 const customerAddress=c=>[c?.address,c?.address_number,c?.address_complement,c?.neighborhood,c?.city,c?.state].filter(Boolean).join(', ');
 const dateLabel=k=>new Date(k+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'}),dateOf=a=>String(a.scheduled_at||'').slice(0,10);
 const selectedItems=useMemo(()=>items.filter(a=>dateOf(a)===selectedDate).sort((a,b)=>String(a.scheduled_at).localeCompare(String(b.scheduled_at))),[items,selectedDate]);
 const receipts=selectedItems.filter(a=>a.type==='RECEBIMENTO'),services=selectedItems.filter(a=>a.type==='SERVICO'),deliveries=selectedItems.filter(a=>a.type==='ENTREGA'),internals=selectedItems.filter(a=>a.type==='INTERNO');
 const customerAgenda=[...services,...deliveries].sort((a,b)=>String(a.scheduled_at).localeCompare(String(b.scheduled_at)));
 const nowLocal=new Date().toLocaleString('sv-SE').replace(' ','T').slice(0,16),overdue=items.filter(a=>a.type==='RECEBIMENTO'&&a.status==='PENDENTE'&&String(a.scheduled_at)<nowLocal),absent=items.filter(a=>a.type==='SERVICO'&&a.attendance==='NAO_COMPARECEU'),internalDue=items.filter(a=>a.type==='INTERNO'&&a.status==='PENDENTE'&&String(a.scheduled_at)<nowLocal);
 const openDay=k=>{setSelectedDate(k);setDayOpen(true);setKind(null);setEditing(null);setDeliverySales([]);setForm({...blank(),date:k})};
 const beginNew=t=>{setEditing(null);setKind(t);setDeliverySales([]);setForm({...blank(),date:selectedDate,task_kind:t==='INTERNO'?'COMPRAS_ESTOQUE':'COMPRAS_ESTOQUE',delivery_method:'LOJA'})};
 const beginEdit=a=>{const d=dateOf(a),tm=String(a.scheduled_at||'').slice(11,16),at=String(a.alert_at||'');setEditing(a);setKind(a.type);setForm({customer_id:String(a.customer_id||''),title:a.title||'',date:d,time:tm||'09:00',alert_time:at.slice(0,10)===d?at.slice(11,16):'',notes:a.notes||'',task_kind:a.task_kind||'OUTRO',sale_id:a.sale_id?String(a.sale_id):'',delivery_method:a.delivery_method||'LOJA',delivery_address:a.delivery_address||'',delivery_phone:a.delivery_phone||''});if(a.type==='ENTREGA'&&a.customer_id)loadDeliverySales(a.customer_id);else setDeliverySales([])};
 const chooseCustomerForDelivery=async value=>{const c=customers.find(x=>String(x.id)===String(value));setForm(f=>({...f,customer_id:value,sale_id:'',delivery_address:c?customerAddress(c):'',delivery_phone:c?.phone||''}));await loadDeliverySales(value)};
 const save=async()=>{try{if(!kind)throw new Error('Escolha o tipo do agendamento.');const date=form.date||selectedDate,scheduled_at=`${date}T${form.time||'09:00'}`,alert_at=form.alert_time?`${date}T${form.alert_time}`:null;if(kind==='INTERNO'){const title=(form.title||taskLabels[form.task_kind]||'Tarefa interna').trim();const payload={id:editing?.id,agenda_source:editing?.agenda_source||'internal',type:'INTERNO',task_kind:form.task_kind,title,scheduled_at,alert_at,notes:form.notes};if(editing)await window.api.agenda.update(payload);else await window.api.agenda.create(payload)}else{const c=customers.find(x=>String(x.id)===String(form.customer_id));if(!c)throw new Error('Selecione um cliente.');if(kind==='RECEBIMENTO'&&!editing&&Number(c.balance_cents||0)<=0)throw new Error('Este cliente não possui saldo devedor para agendar recebimento.');if(kind==='ENTREGA'&&!form.sale_id)throw new Error('Selecione a venda confirmada que será entregue.');const payload={id:editing?.id,agenda_source:editing?.agenda_source||'customer',type:kind,customer_id:c.id,title:kind==='SERVICO'?(form.title||'Serviço agendado'):kind==='ENTREGA'?(form.title||`Entrega da venda #${form.sale_id}`):'Recebimento de saldo devedor',scheduled_at,alert_at,amount_cents:kind==='RECEBIMENTO'?(editing?Number(editing.amount_cents||0):Number(c.balance_cents||0)):0,sale_id:kind==='ENTREGA'?Number(form.sale_id):editing?.sale_id||null,delivery_method:kind==='ENTREGA'?form.delivery_method:'',delivery_address:kind==='ENTREGA'?form.delivery_address:'',delivery_phone:kind==='ENTREGA'?form.delivery_phone:'',notes:form.notes};if(editing)await window.api.agenda.update(payload);else await window.api.agenda.create(payload)}setSelectedDate(date);setMonthCursor(new Date(Number(date.slice(0,4)),Number(date.slice(5,7))-1,1));setKind(null);setEditing(null);setDeliverySales([]);setForm({...blank(),date});await load();notify(editing?'Agendamento atualizado.':kind==='INTERNO'?'Tarefa interna agendada.':kind==='ENTREGA'?'Entrega agendada.':kind==='SERVICO'?'Serviço agendado.':'Pagamento agendado.')}catch(e){notify(e)}};
 const attendance=async(id,v)=>{try{await window.api.agenda.attendance({id,attendance:v});await load();notify(v==='COMPARECEU'?'Comparecimento confirmado.':'Ausência registrada.')}catch(e){notify(e)}};
 const receive=async id=>{try{const r=await window.api.agenda.completePayment({id,method:'Dinheiro'});await load();dataChanged();notify(r.remaining_cents>0?`Recebimento confirmado: ${r.customer_name} · ${brl(r.paid_cents)}. Saldo devedor restante: ${brl(r.remaining_cents)}.`:`Recebimento confirmado: ${r.customer_name} · ${brl(r.paid_cents)}. Saldo devedor zerado.`)}catch(e){notify(e)}};
 const completeDelivery=async(id,result)=>{try{await window.api.agenda.completeDelivery({id,result});await load();notify(result==='ENTREGUE'?'Entrega confirmada.':'Entrega marcada como não realizada.')}catch(e){notify(e)}};
 const completeTask=async id=>{try{await window.api.agenda.completeTask({id});await load();notify('Tarefa interna concluída.')}catch(e){notify(e)}};
 const actionsFor=a=>a.status==='PENDENTE'?<div className="actions">{a.type==='RECEBIMENTO'?<button className="primary smallbtn" onClick={()=>receive(a.id)}><I.BadgeDollarSign/> Confirmar pagamento</button>:a.type==='SERVICO'?<><button className="smallbtn" onClick={()=>attendance(a.id,'COMPARECEU')}><I.Check/> Compareceu</button><button className="smallbtn" onClick={()=>attendance(a.id,'NAO_COMPARECEU')}><I.X/> Não compareceu</button></>:a.type==='ENTREGA'?<><button className="primary smallbtn" onClick={()=>completeDelivery(a.id,'ENTREGUE')}><I.PackageCheck/> Entregue</button><button className="smallbtn" onClick={()=>completeDelivery(a.id,'NAO_ENTREGUE')}><I.PackageX/> Não entregue</button></>:<button className="primary smallbtn" onClick={()=>completeTask(a.id)}><I.CheckCircle2/> Concluir tarefa</button>}<button className="smallbtn" onClick={()=>beginEdit(a)}><I.Pencil/> Editar</button></div>:<button className="smallbtn" onClick={()=>beginEdit(a)}><I.Pencil/> Editar</button>;
 const year=monthCursor.getFullYear(),month=monthCursor.getMonth(),first=new Date(year,month,1),lastDay=new Date(year,month+1,0).getDate(),lead=first.getDay(),cells=[];for(let i=0;i<lead;i++)cells.push(null);for(let d=1;d<=lastDay;d++)cells.push(d);while(cells.length%7)cells.push(null);const keyFor=d=>`${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
 return <div className="agenda-calendar-page">
  <div className="agenda-alertbar"><div><h2><I.CalendarDays/> Agenda</h2><p className="muted">Clientes, entregas e rotinas internas da loja em um único calendário.</p></div><div className="agenda-alertchips">{overdue.length>0&&<button className="agenda-chip danger" onClick={()=>openDay(dateOf(overdue[0]))}><I.BellRing/> {overdue.length} pagamento(s) pendente(s)</button>}{internalDue.length>0&&<button className="agenda-chip warn" onClick={()=>openDay(dateOf(internalDue[0]))}><I.CalendarDays/> {internalDue.length} tarefa(s) interna(s) pendente(s)</button>}{absent.length>0&&<span className="agenda-chip warn"><I.UserX/> {absent.length} não comparecimento(s)</span>}</div></div>
  <section className="panel calendar-panel"><div className="calendar-head"><button className="iconbtn" onClick={()=>setMonthCursor(new Date(year,month-1,1))}><I.ChevronLeft/></button><h2>{monthCursor.toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}</h2><button className="iconbtn" onClick={()=>setMonthCursor(new Date(year,month+1,1))}><I.ChevronRight/></button><button className="smallbtn" onClick={()=>{const d=new Date();setMonthCursor(new Date(d.getFullYear(),d.getMonth(),1));openDay(todayKey)}}>Hoje</button></div><div className="calendar-weekdays">{['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(x=><b key={x}>{x}</b>)}</div><div className="calendar-grid">{cells.map((d,i)=>{if(!d)return <div className="calendar-empty" key={'e'+i}/>;const k=keyFor(d),dayItems=items.filter(a=>dateOf(a)===k),p=dayItems.filter(a=>a.type==='RECEBIMENTO').length,sv=dayItems.filter(a=>a.type==='SERVICO').length,dl=dayItems.filter(a=>a.type==='ENTREGA').length,ti=dayItems.filter(a=>a.type==='INTERNO').length,hasDue=dayItems.some(a=>a.status==='PENDENTE'&&String(a.scheduled_at)<nowLocal);return <button key={k} className={`calendar-day ${k===todayKey?'today':''} ${k===selectedDate?'selected':''} ${hasDue?'has-due':''}`} onClick={()=>openDay(k)}><span className="day-number">{d}</span><span className="day-dots">{p>0&&<em className="dot payment" title={`${p} pagamento(s)`}><I.CircleDollarSign/><strong>{p}</strong></em>}{sv>0&&<em className="dot service" title={`${sv} serviço(s)`}><I.CalendarCheck2/><strong>{sv}</strong></em>}{dl>0&&<em className="dot delivery" title={`${dl} entrega(s)`}><I.Truck/><strong>{dl}</strong></em>}{ti>0&&<em className="dot internal" title={`${ti} tarefa(s) interna(s)`}><I.ClipboardList/><strong>{ti}</strong></em>}</span></button>})}</div></section>
  <section className="agenda-today"><div className="agenda-day-title"><div><h2>{selectedDate===todayKey?'Agenda de hoje':`Agenda de ${new Date(selectedDate+'T12:00:00').toLocaleDateString('pt-BR')}`}</h2><p className="muted">Em ordem do horário mais cedo para o mais tarde.</p></div><button className="primary" onClick={()=>openDay(selectedDate)}><I.CalendarPlus/> Novo agendamento</button></div><Loading loading={loading}><div className="agenda-columns agenda-columns-three"><AgendaColumn side="payment" title="Pagamentos" icon={<I.WalletCards/>} rows={receipts} empty="Nenhum pagamento programado." render={a=><AgendaCard key={`p:${a.id}`} a={a} type="payment" overdue={a.status==='PENDENTE'&&String(a.scheduled_at)<nowLocal} action={actionsFor(a)}/>} /><AgendaColumn side="service" title="Serviços e entregas" icon={<I.BriefcaseBusiness/>} rows={customerAgenda} empty="Nenhum serviço ou entrega programado." render={a=><AgendaCard key={`c:${a.id}`} a={a} type={a.type==='ENTREGA'?'delivery':'service'} action={actionsFor(a)}/>} /><AgendaColumn side="internal" title="Rotinas da loja" icon={<I.ClipboardList/>} rows={internals} empty="Nenhuma tarefa interna programada." render={a=><AgendaCard key={`i:${a.id}`} a={a} type="internal" overdue={a.status==='PENDENTE'&&String(a.scheduled_at)<nowLocal} action={actionsFor(a)}/>} /></div></Loading></section>
  {dayOpen&&<Modal wide title={dateLabel(selectedDate)} close={()=>setDayOpen(false)}><div className="day-modal-actions agenda-choice-grid"><button className={kind==='RECEBIMENTO'&&!editing?'choice active':'choice'} onClick={()=>beginNew('RECEBIMENTO')}><I.WalletCards/><b>Pagamento</b><small>Receber saldo devedor</small></button><button className={kind==='SERVICO'&&!editing?'choice active':'choice'} onClick={()=>beginNew('SERVICO')}><I.BriefcaseBusiness/><b>Serviço</b><small>Atendimento de cliente</small></button><button className={kind==='ENTREGA'&&!editing?'choice active':'choice'} onClick={()=>beginNew('ENTREGA')}><I.Truck/><b>Entrega</b><small>Compra já confirmada</small></button><button className={kind==='INTERNO'&&!editing?'choice active':'choice'} onClick={()=>beginNew('INTERNO')}><I.ClipboardList/><b>Tarefa interna</b><small>Compras, contas e inventário</small></button></div>{kind&&<div className="panel agenda-create"><h3>{editing?'Editar agendamento':'Novo agendamento'}</h3><div className="formgrid">{kind!=='INTERNO'&&<label>Cliente<ThemedSelect value={form.customer_id} onChange={e=>kind==='ENTREGA'?chooseCustomerForDelivery(e.target.value):setForm({...form,customer_id:e.target.value})}><option value="">Selecione um cliente</option>{customers.map(c=><option key={c.id} value={c.id}>{c.name}{kind==='RECEBIMENTO'?` — ${Number(c.balance_cents||0)>0?brl(c.balance_cents):'sem saldo devedor'}`:''}</option>)}</ThemedSelect></label>}{kind==='SERVICO'&&<label>Produto / serviço / combo<ThemedSelect value={form.title} onChange={e=>setForm({...form,title:e.target.value})}><option value="">Selecione um item cadastrado</option>{catalog.map(x=><option key={x.key} value={x.name}>{x.name} — {x.kind}</option>)}</ThemedSelect></label>}{kind==='INTERNO'&&<><label>Rotina<ThemedSelect value={form.task_kind} onChange={e=>setForm({...form,task_kind:e.target.value,title:e.target.value==='OUTRO'?form.title:''})}><option value="COMPRAS_ESTOQUE">Compra para estoque</option><option value="PAGAR_CONTA">Pagar conta da loja</option><option value="INVENTARIO">Realizar inventário</option><option value="OUTRO">Outra tarefa interna</option></ThemedSelect></label><label>Descrição personalizada<input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder={taskLabels[form.task_kind]}/></label></>}{kind==='ENTREGA'&&<><label>Venda confirmada<ThemedSelect value={form.sale_id} onChange={e=>setForm({...form,sale_id:e.target.value,title:e.target.value?`Entrega da venda #${e.target.value}`:form.title})}><option value="">Selecione a venda</option>{deliverySales.map(s=><option key={s.id} value={s.id}>Venda #{s.id} · {fmtDate(s.sold_at)} · {brl(s.total_cents)}{Number(s.delivery_required||0)===1?' · MARCADA PARA ENTREGA':''}</option>)}</ThemedSelect></label><label>Tipo da entrega<ThemedSelect value={form.delivery_method} onChange={e=>setForm({...form,delivery_method:e.target.value})}><option value="LOJA">Entregador da loja</option><option value="APP">Motorista de aplicativo</option></ThemedSelect></label><label className="span2">Endereço da entrega<input value={form.delivery_address} onChange={e=>setForm({...form,delivery_address:e.target.value})} placeholder="Endereço do cliente"/></label><label>Telefone para entrega<input value={form.delivery_phone} onChange={e=>setForm({...form,delivery_phone:e.target.value})}/></label></>}<label>Data<input type="date" value={form.date||selectedDate} onChange={e=>setForm({...form,date:e.target.value})}/></label><label>Horário<input type="time" value={form.time} onChange={e=>setForm({...form,time:e.target.value})}/></label><label>Horário do alerta<input type="time" value={form.alert_time} onChange={e=>setForm({...form,alert_time:e.target.value})}/></label><label className="span2">Observações<input value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label></div><div className="modalactions"><button onClick={()=>{setKind(null);setEditing(null);setDeliverySales([])}}>Cancelar</button><button className="primary" onClick={save}><I.Save/> {editing?'Salvar alterações':'Salvar agendamento'}</button></div></div>}<div className="day-modal-list"><h3>Compromissos deste dia</h3>{selectedItems.length?selectedItems.map(a=><AgendaCard key={`${a.agenda_source||'customer'}:${a.id}`} a={a} type={a.type==='RECEBIMENTO'?'payment':a.type==='ENTREGA'?'delivery':a.type==='INTERNO'?'internal':'service'} compact overdue={a.status==='PENDENTE'&&String(a.scheduled_at)<nowLocal} action={actionsFor(a)}/>):<p className="muted">Nenhum agendamento para este dia.</p>}</div></Modal>}
 </div>
}
function AgendaColumn({title,icon,rows,empty,render,side}){return <div className={`agenda-column ${side}`}><h3>{icon}{title}<span>{rows.length}</span></h3><div className="agenda-scroll">{rows.length?rows.map(render):<div className="agenda-empty">{empty}</div>}</div></div>}
function AgendaCard({a,type,action,overdue=false,compact=false}){const taskLabels={COMPRAS_ESTOQUE:'Compra para estoque',PAGAR_CONTA:'Pagar conta da loja',INVENTARIO:'Realizar inventário',OUTRO:'Tarefa interna'};const deliveryLabel=a.delivery_method==='APP'?'Motorista de aplicativo':'Entregador da loja';let meta='';if(type==='payment')meta=`${a.status==='CONCLUIDO'?'Valor recebido':'Valor previsto'}: ${brl(a.status==='CONCLUIDO'?a.paid_cents:(a.amount_cents||a.balance_cents))}`;else if(type==='delivery')meta=`${deliveryLabel}${a.sale_id?` · Venda #${a.sale_id}`:''}${a.delivery_address?` · ${a.delivery_address}`:''}`;else if(type==='internal')meta=taskLabels[a.task_kind]||'Tarefa interna';else meta=a.attendance==='COMPARECEU'?'Compareceu':a.attendance==='NAO_COMPARECEU'?'Não compareceu':'Aguardando confirmação';let status='AGENDADO',klass=overdue?'danger':'warn';if(a.status==='CONCLUIDO'){klass=a.attendance==='NAO_COMPARECEU'||a.attendance==='NAO_ENTREGUE'?'danger':'ok';status=type==='payment'?'PAGO':type==='delivery'?(a.attendance==='NAO_ENTREGUE'?'NÃO ENTREGUE':'ENTREGUE'):type==='internal'?'CONCLUÍDA':a.attendance==='COMPARECEU'?'COMPARECEU':'NÃO COMPARECEU'}else if(overdue)status=type==='payment'?'PAGAMENTO PENDENTE':type==='internal'?'TAREFA PENDENTE':'ATRASADO';return <div className={`agenda-card ${type} ${overdue?'overdue':''} ${compact?'compact':''}`}><div className="agenda-time">{String(a.scheduled_at||'').slice(11,16)}</div><div className="agenda-card-body"><b>{type==='internal'?'Loja':a.customer_name}</b><span>{a.title}</span>{a.notes&&<small>{a.notes}</small>}<small>{meta}</small>{type==='delivery'&&a.delivery_phone&&<small>Contato: {phoneMask(a.delivery_phone)}</small>}</div><div className="agenda-card-status"><span className={`badge ${klass}`}>{status}</span>{action}</div></div>}

function Financeiro({notify}){
 const today=new Date().toISOString().slice(0,10),month=today.slice(0,7);
 const [mode,setMode]=useState('month'),[monthValue,setMonthValue]=useState(month),[from,setFrom]=useState(today),[to,setTo]=useState(today),[type,setType]=useState('TODOS'),[status,setStatus]=useState('TODOS'),[search,setSearch]=useState(''),[data,setData]=useState({rows:[],summary:{}}),[suppliers,setSuppliers]=useState([]),[loading,setLoading]=useState(true),[open,setOpen]=useState(false),[edit,setEdit]=useState(null);
 const [view,setView]=useViewMode('financeiro','details');
 const dateRange=mode==='month'?{from:`${monthValue}-01`,to:`${monthValue}-31`}:{from,to};
 const load=async()=>{setLoading(true);try{const [d,s]=await Promise.all([window.api.finance.list({...dateRange,type,status,search}),window.api.suppliers.list('')]);setData(d);setSuppliers(s)}catch(e){notify(e)}finally{setLoading(false)}};
 useEffect(()=>{load()},[mode,monthValue,from,to,type,status,search]);
 const money=brl;
 const statusLabel=s=>s==='PAGO'?'Pago':s==='CANCELADO'?'Cancelado':'Pendente';
 const save=async item=>{try{await window.api.finance.save(item);notify(edit?'Lançamento atualizado.':'Lançamento cadastrado.');setOpen(false);setEdit(null);await load();dataChanged()}catch(e){notify(e)}};
 const markPaid=async x=>{const method=prompt('Forma de pagamento (ex.: Pix, dinheiro, cartão, transferência):',x.payment_method||'Pix');if(method===null)return;try{await window.api.finance.markPaid({id:x.id,payment_method:method,paid_at:today});notify('Lançamento marcado como pago.');await load();dataChanged()}catch(e){notify(e)}};
 const cancel=async x=>{if(!confirm(`Cancelar o lançamento “${x.description}”? O registro será mantido no histórico.`))return;try{await window.api.finance.delete(x.id);notify('Lançamento cancelado.');await load();dataChanged()}catch(e){notify(e)}};
 return <>
  <div className="toolbar"><div><h2>Compras e Financeiro</h2><p className="muted">Controle contas a pagar, compras de fornecedores e despesas operacionais. Os lançamentos não alteram o estoque automaticamente.</p></div><div className="actions"><ViewModeMenu value={view} onChange={setView}/><button className="primary" onClick={()=>{setEdit(null);setOpen(true)}}><I.Plus/> Novo lançamento</button></div></div>
  <div className="cashcards report-summary-cards">
   <div><span>Total pendente no período</span><strong>{money(data.summary?.pending||0)}</strong></div>
   <div><span>Vencido (pendente)</span><strong className={Number(data.summary?.overdue)>0?'text-danger':''}>{money(data.summary?.overdue||0)}</strong></div>
   <div><span>Total pago dos lançamentos listados</span><strong>{money(data.summary?.paid||0)}</strong></div>
   <div><span>Lançamentos listados</span><strong>{data.summary?.count||0}</strong></div>
  </div>
  <div className="panel"><div className="toolbar inline"><div className="reportfilters"><button className={mode==='month'?'smallbtn active':'smallbtn'} onClick={()=>setMode('month')}>Mensal</button><button className={mode==='range'?'smallbtn active':'smallbtn'} onClick={()=>setMode('range')}>Período</button>{mode==='month'?<label>Mês <input type="month" value={monthValue} onChange={e=>setMonthValue(e.target.value)}/></label>:<><label>De <input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>Até <input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label></>}<ThemedSelect value={type} onChange={e=>setType(e.target.value)}><option value="TODOS">Compras e despesas</option><option value="COMPRA">Compras</option><option value="DESPESA">Despesas</option></ThemedSelect><ThemedSelect value={status} onChange={e=>setStatus(e.target.value)}><option value="TODOS">Todos os status</option><option value="PENDENTE">Pendentes</option><option value="PAGO">Pagos</option><option value="CANCELADO">Cancelados</option></ThemedSelect></div><div className="search"><I.Search/><input placeholder="Buscar descrição, categoria ou observação..." value={search} onChange={e=>setSearch(e.target.value)}/></div></div></div>
  <Loading loading={loading}><div className={`table panel ux-collection ux-view-${view}`}><table><thead><tr><th>Tipo / descrição</th><th>Fornecedor</th><th>Categoria</th><th>Emissão</th><th>Vencimento</th><th>Valor</th><th>Status</th><th>Pagamento</th><th>Ações</th></tr></thead><tbody>{(data.rows||[]).map(x=><tr key={x.id}><td data-label="Descrição"><b>{x.description}</b>{x.notes&&<small className="table-note">{x.notes}</small>}<small>{x.entry_type==='COMPRA'?'Compra':'Despesa'}</small></td><td data-label="Fornecedor">{x.supplier_name||'—'}</td><td data-label="Categoria">{x.category||'Outros'}</td><td data-label="Emissão">{fmtDateOnly(x.issue_date)}</td><td data-label="Vencimento"><span className={x.status==='PENDENTE'&&x.due_date<today?'badge danger':'badge'}>{fmtDateOnly(x.due_date)}</span></td><td data-label="Valor" className="money">{money(x.amount_cents)}</td><td data-label="Status"><span className={`badge ${x.status==='PAGO'?'ok':x.status==='CANCELADO'?'danger':x.due_date<today?'warn':''}`}>{statusLabel(x.status)}</span></td><td data-label="Pagamento">{x.status==='PAGO'?`${fmtDateOnly(x.paid_at)}${x.payment_method?' · '+x.payment_method:''}`:x.payment_method||'—'}</td><td data-label="Ações" className="actions"><button className="iconbtn" title="Editar" disabled={x.status==='PAGO'} onClick={()=>{setEdit(x);setOpen(true)}}><I.Pencil/></button>{x.status==='PENDENTE'&&<button className="smallbtn" onClick={()=>markPaid(x)}>Marcar pago</button>}{x.status!=='CANCELADO'&&x.status!=='PAGO'&&<button className="iconbtn danger" title="Cancelar lançamento" onClick={()=>cancel(x)}><I.XCircle/></button>}</td></tr>)}{!data.rows?.length&&<tr><td colSpan="9"><div className="empty compact"><I.ClipboardList/><p>Nenhum lançamento encontrado no período.</p></div></td></tr>}</tbody></table></div></Loading>
  {open&&<FinanceEntryModal edit={edit} suppliers={suppliers} close={()=>{setOpen(false);setEdit(null)}} save={save} notify={notify}/>}
 </>;
}
function FinanceEntryModal({edit,suppliers,close,save,notify}){
 const today=new Date().toISOString().slice(0,10);const [v,setV]=useState(edit?{...edit}:{entry_type:'COMPRA',description:'',supplier_id:'',category:'Estoque / mercadorias',amount_cents:0,issue_date:today,due_date:today,status:'PENDENTE',paid_at:'',payment_method:'',notes:''});
 const submit=()=>{if(!v.description.trim())return notify('Informe a descrição do lançamento.');if(!Number(v.amount_cents)||Number(v.amount_cents)<=0)return notify('Informe um valor maior que zero.');if(!v.issue_date||!v.due_date)return notify('Informe as datas de emissão e vencimento.');save({...v,supplier_id:v.supplier_id||null,amount_cents:Math.round(Number(v.amount_cents))})};
 return <Modal wide title={edit?'Editar lançamento financeiro':'Novo lançamento financeiro'} close={close}><div className="formgrid"><label>Tipo de lançamento*<ThemedSelect value={v.entry_type} onChange={e=>setV({...v,entry_type:e.target.value,category:e.target.value==='COMPRA'?'Estoque / mercadorias':'Despesas gerais'})}><option value="COMPRA">Compra / conta de fornecedor</option><option value="DESPESA">Despesa operacional</option></ThemedSelect></label><label>Descrição*<input autoFocus value={v.description} onChange={e=>setV({...v,description:e.target.value})} placeholder="Ex.: compra de mercadorias, aluguel..."/></label><label>Fornecedor (opcional)<ThemedSelect value={v.supplier_id||''} onChange={e=>setV({...v,supplier_id:e.target.value})}><option value="">Sem fornecedor vinculado</option>{suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</ThemedSelect></label><label>Categoria<input value={v.category||''} onChange={e=>setV({...v,category:e.target.value})} placeholder="Ex.: mercadorias, aluguel, energia"/></label><label>Valor total (R$)*<CurrencyInput value={v.amount_cents} onChange={n=>setV({...v,amount_cents:n})}/></label><label>Data de lançamento*<input type="date" value={v.issue_date||today} onChange={e=>setV({...v,issue_date:e.target.value})}/></label><label>Data de vencimento*<input type="date" value={v.due_date||today} onChange={e=>setV({...v,due_date:e.target.value})}/></label><label>Status<ThemedSelect value={v.status||'PENDENTE'} onChange={e=>setV({...v,status:e.target.value})}><option value="PENDENTE">Pendente</option><option value="PAGO">Pago</option><option value="CANCELADO">Cancelado</option></ThemedSelect></label>{v.status==='PAGO'&&<><label>Data do pagamento<input type="date" value={v.paid_at||today} onChange={e=>setV({...v,paid_at:e.target.value})}/></label><label>Forma de pagamento<input value={v.payment_method||''} onChange={e=>setV({...v,payment_method:e.target.value})} placeholder="Pix, dinheiro, cartão..."/></label></>}<label className="span2">Observações<textarea rows="3" value={v.notes||''} onChange={e=>setV({...v,notes:e.target.value})}/></label></div><p className="muted">Este registro organiza o financeiro; ele não movimenta o estoque e não altera vendas ou a estimativa de rentabilidade.</p><div className="modalactions"><button onClick={close}>Cancelar</button><button className="primary" onClick={submit}>Salvar lançamento</button></div></Modal>
}

function Relatorios({notify}){
 const today=new Date().toISOString().slice(0,10);
 const[mode,setMode]=useState('daily'),[date,setDate]=useState(today),[month,setMonth]=useState(today.slice(0,7)),[data,setData]=useState(null),[loading,setLoading]=useState(false),[exporting,setExporting]=useState(false),[section,setSection]=useState('summary');
 const[view,setView]=useViewMode('relatorios','details');
 const load=async()=>{setLoading(true);try{setData(mode==='daily'?await window.api.reports.daily(date):await window.api.reports.monthly(month))}catch(e){notify(e)}finally{setLoading(false)}};
 useEffect(()=>{load()},[mode,date,month]);
 const sales=data?.sales||[],cash=data?.cash||[],withdrawals=data?.withdrawals||[],productEvents=data?.product_events||[],stockMovements=data?.stock_movements||[],activities=data?.activities||[],items=data?.items||[],tot=data?.totals||{};
 const exportReport=async(format)=>{setExporting(true);try{const file=await window.api.reports.export({format,mode,date,month});if(file)notify(`Relatório exportado com sucesso: ${file}`)}catch(e){notify(e)}finally{setExporting(false)}};
 const groupLabel=g=>ACTIVITY_GROUP_LABELS[g]||'Sistema';
 const entityLabel=t=>({product:'Produto',category:'Categoria',stock:'Estoque',sale:'Venda',cash:'Caixa',cash_withdrawal:'Retirada',unit_stock:'Estoque unitário'}[t]||t||'Registro');
 const stockQty=x=>['WEIGHT','MIX_WEIGHT'].includes(String(x.sale_mode||'UNIT'))?`${(Number(x.quantity||0)/1000).toLocaleString('pt-BR',{minimumFractionDigits:3,maximumFractionDigits:3})} kg`:`${Number(x.quantity||0).toLocaleString('pt-BR')} ${x.unit||'un'}`;
 const tabs=[
  ['summary','Resumo',I.LayoutDashboard],
  ['sales','Vendas',I.ShoppingCart],
  ['cash','Caixa',I.WalletCards],
  ['products','Produtos / Categorias',I.Package],
  ['stock','Estoque',I.Warehouse],
  ['profitability','Rentabilidade',I.ReceiptText],
  ['activities','Atividades',I.History]
 ];
 return <div className="reportpage">
  <div className="panel">
   <div className="toolbar inline">
    <div><h2>Relatórios</h2><p className="muted">Central consolidada de vendas, caixa, produtos, categorias, estoque e atividades. Escolha o período e o tipo de relatório que deseja consultar.</p></div>
    <div className="reportfilters"><ViewModeMenu value={view} onChange={setView}/><button className={mode==='daily'?'smallbtn active':'smallbtn'} onClick={()=>setMode('daily')}>Diário</button><button className={mode==='monthly'?'smallbtn active':'smallbtn'} onClick={()=>setMode('monthly')}>Mensal</button>{mode==='daily'?<input type="date" value={date} onChange={e=>setDate(e.target.value)}/>:<input type="month" value={month} onChange={e=>setMonth(e.target.value)}/>}<button className="smallbtn" disabled={exporting||loading||!data} onClick={()=>exportReport('pdf')}><I.FileCheck2/> PDF</button><button className="smallbtn" disabled={exporting||loading||!data} onClick={()=>exportReport('xlsx')}><I.ReceiptText/> Excel</button></div>
   </div>
   <div className="ux-report-tabs">{tabs.map(([id,label,Icon])=><button key={id} className={section===id?'active':''} onClick={()=>setSection(id)}><Icon/>{label}</button>)}</div>
  </div>
  <Loading loading={loading}>{data&&<>
   <div className="cashcards report-summary-cards">
    <div><span>Vendas</span><strong>{tot.count||0}</strong></div>
    <div><span>Total vendido</span><strong>{brl(tot.total)}</strong></div>
    <div><span>Recebido</span><strong>{brl(tot.paid)}</strong></div>
    <div><span>Débitos</span><strong>{brl(tot.due)}</strong></div>
    <div><span>Retiradas</span><strong>{brl(data.withdrawal_total_cents||0)}</strong></div>
    <div><span>Entradas de estoque</span><strong>{data.stock_in_count||0}</strong></div>
    <div><span>Saídas de estoque</span><strong>{data.stock_out_count||0}</strong></div>
    <div><span>Atividades</span><strong>{activities.length}</strong></div>
   </div>

   {section==='summary'&&<div className="report-overview-grid">
    <div className="panel"><h2>Visão geral do período</h2><div className="report-kpis"><div><span>Movimentações de caixa</span><b>{cash.length+withdrawals.length}</b></div><div><span>Produtos / categorias</span><b>{productEvents.length}</b></div><div><span>Movimentações de estoque</span><b>{stockMovements.length}</b></div><div><span>Itens vendidos</span><b>{items.length}</b></div></div><p className="muted">Use os botões acima para abrir cada relatório detalhado. PDF e Excel exportam todas as áreas em um único arquivo.</p></div>
    <div className="panel"><h2>Últimas atividades do período</h2><div className="report-mini-list">{activities.slice(0,8).map(x=><div key={x.id}><span className="activity-group">{groupLabel(x.event_group)}</span><div><b>{x.action}</b><small>{fmtDate(x.created_at)} · {x.operator||'Sistema'}</small></div>{Number(x.amount_cents||0)>0&&<strong>{brl(x.amount_cents)}</strong>}</div>)}{!activities.length&&<p className="muted">Nenhuma atividade registrada no período.</p>}</div></div>
   </div>}

   {section==='sales'&&<div className="panel"><h2>Vendas</h2>{mode==='daily'?<div className={`table ux-collection ux-view-${view}`}><table><thead><tr><th>Hora</th><th>Venda</th><th>Operador</th><th>Cliente</th><th>Destino</th><th>Pagamento</th><th>Total</th></tr></thead><tbody>{sales.map(x=><tr key={x.id}><td data-label="Hora">{fmtTime(x.sold_at)}</td><td data-label="Venda">#{x.id}</td><td data-label="Operador">{x.operator||'—'}</td><td data-label="Cliente">{x.customer_name||'—'}</td><td data-label="Destino">{Number(x.delivery_required||0)===1?'Entrega':'Retirada'}</td><td data-label="Pagamento">{x.payment||'—'}</td><td data-label="Total" className="money">{brl(x.total_cents)}</td></tr>)}{!sales.length&&<tr><td colSpan="7" className="muted">Nenhuma venda no período.</td></tr>}</tbody></table></div>:<div className={`table ux-collection ux-view-${view}`}><table><thead><tr><th>Data</th><th>Vendas</th><th>Total vendido</th><th>Recebido</th><th>Débitos</th></tr></thead><tbody>{sales.map(x=><tr key={x.date}><td data-label="Data">{new Date(x.date+'T12:00:00').toLocaleDateString('pt-BR')}</td><td data-label="Vendas">{x.count}</td><td data-label="Total vendido" className="money">{brl(x.total)}</td><td data-label="Recebido">{brl(x.paid)}</td><td data-label="Débitos">{brl(x.due)}</td></tr>)}{!sales.length&&<tr><td colSpan="5" className="muted">Nenhuma venda no período.</td></tr>}</tbody></table></div>}<h3 className="report-subtitle">Itens vendidos</h3><div className={`table ux-collection ux-view-${view}`}><table><thead><tr><th>Item</th><th>Quantidade</th><th>Total</th></tr></thead><tbody>{items.map((x,i)=><tr key={`${x.name}-${i}`}><td data-label="Item">{x.name}</td><td data-label="Quantidade">{['WEIGHT','MIX_WEIGHT'].includes(String(x.sale_mode||'UNIT'))?`${(Number(x.weight_grams||0)/1000).toLocaleString('pt-BR',{minimumFractionDigits:3,maximumFractionDigits:3})} kg`:x.quantity}</td><td data-label="Total" className="money">{brl(x.total_cents)}</td></tr>)}{!items.length&&<tr><td colSpan="3" className="muted">Nenhum item vendido no período.</td></tr>}</tbody></table></div></div>}

   {section==='cash'&&<><div className="panel"><h2>Caixa</h2><div className={`table ux-collection ux-view-${view}`}><table><thead><tr><th>Abertura</th><th>Fechamento</th><th>Operador</th><th>Valor inicial</th><th>Vendas</th><th>Retiradas</th><th>Saldo estimado</th><th>Status</th></tr></thead><tbody>{cash.map(x=><tr key={x.id}><td data-label="Abertura">{fmtDate(x.opened_at)}</td><td data-label="Fechamento">{x.closed_at?fmtDate(x.closed_at):'—'}</td><td data-label="Operador">{x.operator||'—'}</td><td data-label="Valor inicial">{brl(x.opening_cents)}</td><td data-label="Vendas">{brl(x.total_sales_cents)}</td><td data-label="Retiradas">{brl(x.total_withdrawals_cents)}</td><td data-label="Saldo estimado" className="money">{brl(x.expected_total_cents)}</td><td data-label="Status"><span className={`badge ${x.closing_status==='FECHADO'?'ok':'warn'}`}>{x.closing_status}</span></td></tr>)}{!cash.length&&<tr><td colSpan="8" className="muted">Nenhuma movimentação de caixa no período.</td></tr>}</tbody></table></div></div><div className="panel"><h2>Retiradas / sangrias</h2><div className={`table ux-collection ux-view-${view}`}><table><thead><tr><th>Data/hora</th><th>Operador</th><th>Motivo</th><th>Valor</th></tr></thead><tbody>{withdrawals.map(w=><tr key={w.id}><td data-label="Data/hora">{fmtDate(w.created_at)}</td><td data-label="Operador">{w.operator||'—'}</td><td data-label="Motivo">{w.reason}</td><td data-label="Valor" className="money">{brl(w.amount_cents)}</td></tr>)}{!withdrawals.length&&<tr><td colSpan="4" className="muted">Nenhuma retirada no período.</td></tr>}</tbody></table></div></div></>}

   {section==='products'&&<div className="panel"><h2>Produtos / Categorias</h2><p className="muted">Cadastros, edições, exclusões, restaurações e alterações de categorias realizadas no período.</p><div className={`table ux-collection ux-view-${view}`}><table><thead><tr><th>Data/hora</th><th>Ação</th><th>Registro</th><th>Operador</th><th>Detalhes</th><th>Valor</th></tr></thead><tbody>{productEvents.map(x=><tr key={x.id}><td data-label="Data/hora">{fmtDate(x.created_at)}</td><td data-label="Ação">{x.action}</td><td data-label="Registro">{entityLabel(x.entity_type)}{x.entity_id?` #${x.entity_id}`:''}</td><td data-label="Operador">{x.operator||'Sistema'}</td><td data-label="Detalhes">{x.details||'—'}</td><td data-label="Valor" className="money">{Number(x.amount_cents||0)>0?brl(x.amount_cents):'—'}</td></tr>)}{!productEvents.length&&<tr><td colSpan="6" className="muted">Nenhuma alteração de produtos ou categorias no período.</td></tr>}</tbody></table></div></div>}

   {section==='profitability'&&<><div className="cashcards report-summary-cards">
    <div><span>Faturamento dos itens</span><strong>{brl(data.profitability_totals?.revenue_cents||0)}</strong></div>
    <div><span>Receita com custo conhecido</span><strong>{brl(data.profitability_totals?.revenue_with_cost_cents||0)}</strong></div>
    <div><span>Custo estimado</span><strong>{brl(data.profitability_totals?.estimated_cost_cents||0)}</strong></div>
    <div><span>Lucro bruto estimado</span><strong>{brl(data.profitability_totals?.estimated_gross_profit_cents||0)}</strong></div>
    <div><span>Margem estimada</span><strong>{data.profitability_totals?.estimated_margin_percent==null?'—':`${data.profitability_totals.estimated_margin_percent.toLocaleString('pt-BR',{maximumFractionDigits:2})}%`}</strong></div>
    <div><span>Itens sem custo válido</span><strong>{data.profitability_totals?.missing_cost_lines||0}</strong></div>
   </div><div className="panel"><h2>Rentabilidade estimada por produto</h2><p className="muted">Estimativa com base no custo atualmente cadastrado. Não representa lucro líquido: não desconta impostos, taxas de cartão, despesas operacionais nem rateia descontos da venda. Itens de Mix por Peso e itens sem custo positivo são excluídos da margem estimada e aparecem como sem custo válido.</p><div className={`table ux-collection ux-view-${view}`}><table><thead><tr><th>Produto / item</th><th>Linhas</th><th>Faturamento</th><th>Receita com custo conhecido</th><th>Custo estimado</th><th>Lucro bruto estimado</th><th>Margem</th><th>Custo</th></tr></thead><tbody>{(data.profitability||[]).map(x=><tr key={x.id}><td data-label="Produto / item"><b>{x.name}</b></td><td data-label="Linhas">{x.lines}</td><td data-label="Faturamento" className="money">{brl(x.revenue_cents)}</td><td data-label="Receita com custo conhecido">{brl(x.revenue_with_cost_cents)}</td><td data-label="Custo estimado">{brl(x.estimated_cost_cents)}</td><td data-label="Lucro bruto estimado" className="money">{brl(x.estimated_gross_profit_cents)}</td><td data-label="Margem">{x.estimated_margin_percent==null?'—':`${x.estimated_margin_percent.toLocaleString('pt-BR',{maximumFractionDigits:2})}%`}</td><td data-label="Custo">{x.missing_cost_lines? <span className="badge warn">Parcial / ausente</span>:<span className="badge ok">Disponível</span>}</td></tr>)}{!(data.profitability||[]).length&&<tr><td colSpan="8" className="muted">Nenhum item vendido no período.</td></tr>}</tbody></table></div></div></>}

   {section==='stock'&&<div className="panel"><h2>Estoque</h2><p className="muted">Entradas e saídas manuais, ajustes por cadastro e movimentações automáticas geradas por vendas e cancelamentos.</p><div className={`table ux-collection ux-view-${view}`}><table><thead><tr><th>Data/hora</th><th>Movimento</th><th>Produto</th><th>Quantidade</th><th>Motivo</th><th>Fornecedor</th><th>Valor ref.</th></tr></thead><tbody>{stockMovements.map(x=><tr key={x.id}><td data-label="Data/hora">{fmtDate(x.created_at)}</td><td data-label="Movimento"><span className={`badge ${x.kind==='IN'?'ok':'warn'}`}>{x.kind==='IN'?'Entrada':'Saída'}</span></td><td data-label="Produto">{x.product_name||`Produto #${x.product_id}`}</td><td data-label="Quantidade">{stockQty(x)}</td><td data-label="Motivo">{x.reason||'—'}</td><td data-label="Fornecedor">{x.supplier_name||'—'}</td><td data-label="Valor ref." className="money">{Number(x.value_cents||0)>0?brl(x.value_cents):'—'}</td></tr>)}{!stockMovements.length&&<tr><td colSpan="7" className="muted">Nenhuma movimentação de estoque no período.</td></tr>}</tbody></table></div></div>}

   {section==='activities'&&<div className="panel"><h2>Atividades</h2><p className="muted">Auditoria consolidada de todas as atividades registradas no período. Valores são apresentados em Reais (R$).</p><div className={`table ux-collection ux-view-${view}`}><table><thead><tr><th>Data/hora</th><th>Grupo</th><th>Ação</th><th>Operador</th><th>Registro</th><th>Detalhes</th><th>Valor</th></tr></thead><tbody>{activities.map(x=><tr key={x.id}><td data-label="Data/hora">{fmtDate(x.created_at)}</td><td data-label="Grupo"><span className="activity-group">{groupLabel(x.event_group)}</span></td><td data-label="Ação">{x.action}</td><td data-label="Operador">{x.operator||'Sistema'}</td><td data-label="Registro">{entityLabel(x.entity_type)}{x.entity_id?` #${x.entity_id}`:''}</td><td data-label="Detalhes">{x.details||'—'}</td><td data-label="Valor" className="money">{Number(x.amount_cents||0)>0?brl(x.amount_cents):'—'}</td></tr>)}{!activities.length&&<tr><td colSpan="7" className="muted">Nenhuma atividade registrada no período.</td></tr>}</tbody></table></div></div>}
  </>}</Loading>
 </div>
}
function Notes({notify}){
 const[items,setItems]=useState([]),[search,setSearch]=useState(''),[editing,setEditing]=useState(null),[open,setOpen]=useState(false),[deleteTarget,setDeleteTarget]=useState(null),[loading,setLoading]=useState(true);
 const load=async()=>{setLoading(true);try{setItems(await window.api.notes.list(search))}catch(e){notify(e)}finally{setLoading(false)}};
 useEffect(()=>{load()},[search]);
 const remove=async(n)=>{try{await window.api.notes.delete(n.id);setDeleteTarget(null);if(editing?.id===n.id){setEditing(null);setOpen(false)}await load();notify('Anotação excluída.',{label:'Desfazer',doneMessage:'Anotação restaurada.',run:async()=>{await window.api.notes.restore(n.id);await load()}})}catch(e){notify(e)}};
 const grouped=useMemo(()=>{const m=new Map();for(const n of items){const d=new Date(n.updated_at).toLocaleDateString('pt-BR');if(!m.has(d))m.set(d,[]);m.get(d).push(n)}return [...m.entries()]},[items]);
 return <div className="notesPage">
  <div className="panel"><div className="toolbar inline"><div><h2>Anotações</h2><p className="muted">Registre lembretes e informações do dia. As anotações ficam salvas com data e hora.</p></div><button className="primary" onClick={()=>{setEditing(null);setOpen(true)}}><I.Plus/> Nova anotação</button></div>
   <div className="search"><I.Search/><input placeholder="Pesquisar anotações..." value={search} onChange={e=>setSearch(e.target.value)}/></div>
  </div>
  <Loading loading={loading}><div className="notesGroups">{grouped.length?grouped.map(([date,rows])=><section className="notesDay" key={date}><div className="notesDayHead"><I.CalendarDays/><b>{date}</b><span>{rows.length} {rows.length===1?'anotação':'anotações'}</span></div><div className="notesGrid">{rows.map(n=><article className="noteCard" key={n.id}><div className="noteCardHead"><div><h3>{n.title||'Sem título'}</h3><small>{fmtDate(n.updated_at)}{n.created_at!==n.updated_at?' · editada':''}</small></div><div className="noteActions"><button className="iconbtn" title="Editar" onClick={()=>{setEditing(n);setOpen(true)}}><I.Pencil/></button><button className="iconbtn danger" title="Excluir" onClick={()=>setDeleteTarget(n)}><I.Trash2/></button></div></div><p>{n.content}</p></article>)}</div></section>):<div className="empty"><I.NotebookPen/><h3>Nenhuma anotação encontrada</h3><p>Crie sua primeira anotação para começar.</p></div>}</div></Loading>
  {open&&<NoteModal edit={editing} close={()=>setOpen(false)} done={load} notify={notify}/>} {deleteTarget&&<Modal title="Excluir anotação" close={()=>setDeleteTarget(null)}><p>Excluir a anotação <b>{deleteTarget.title||'Sem título'}</b>?</p><div className="modalactions"><button onClick={()=>setDeleteTarget(null)}>Cancelar</button><button className="dangerbtn" onClick={()=>remove(deleteTarget)}><I.Trash2/> Excluir</button></div></Modal>}</div>
}
function NoteModal({edit,close,done,notify}){const[n,setN]=useState(edit?{...edit}:{title:'',content:''});const[busy,setBusy]=useState(false);const save=async()=>{if(!n.content.trim()){notify('Digite o conteúdo da anotação.');return}setBusy(true);try{await window.api.notes.save(n);notify(edit?'Anotação atualizada.':'Anotação salva.');close();done()}catch(e){notify(e)}finally{setBusy(false)}};return <Modal title={edit?'Editar anotação':'Nova anotação'} close={close} wide><div className="noteform"><label>Título <input autoFocus value={n.title||''} onChange={e=>setN({...n,title:e.target.value})} placeholder="Ex.: Pedido para amanhã"/></label><label>Anotação* <textarea rows="12" value={n.content||''} onChange={e=>setN({...n,content:e.target.value})} placeholder="Digite a anotação..."/></label>{edit&&<p className="muted">Criada em {fmtDate(edit.created_at)} · última edição {fmtDate(edit.updated_at)}</p>}</div><div className="modalactions"><button onClick={close}>Cancelar</button><button className="primary" disabled={busy} onClick={save}><I.Save/> {busy?'Salvando...':'Salvar anotação'}</button></div></Modal>}

function OperatorsPanel({notify}){const[items,setItems]=useState([]),[edit,setEdit]=useState(null),[open,setOpen]=useState(false),[isAdmin,setIsAdmin]=useState(false);const load=()=>window.api.operators.list().then(setItems).catch(notify);useEffect(()=>{window.api.settings.get().then(x=>setIsAdmin(x.current_operator_role==='admin')).catch(()=>{})},[]);useEffect(()=>{if(isAdmin)load()},[isAdmin]);if(!isAdmin)return null;const remove=async id=>{try{await window.api.operators.delete(id);await load();dataChanged();notify('Operador desativado.')}catch(e){notify(e)}};return <div className="panel"><div className="toolbar inline"><div><h2>Operadores</h2><p className="muted">Somente o Administrador pode cadastrar e alterar operadores.</p></div><button className="primary" onClick={()=>{setEdit(null);setOpen(true)}}><I.Plus/> Novo operador</button></div><div className="operatorcards">{items.map(o=><div className="operatorcard" key={o.id}>{o.photo_data?<img src={o.photo_data}/>:<div className="operatorphoto"><I.UserRound/></div>}<div><b>{o.name}</b><small>{o.role==='admin'?'Administrador':'Operador'}</small></div><div className="operatoractions"><button className="iconbtn" onClick={()=>{setEdit(o);setOpen(true)}}><I.Pencil/></button>{o.role!=='admin'&&<button className="iconbtn danger" onClick={()=>remove(o.id)}><I.Trash2/></button>}</div></div>)}</div>{open&&<OperatorModal edit={edit} close={()=>setOpen(false)} done={load} notify={notify}/>}</div>}
function OperatorModal({edit,close,done,notify}){const[o,setO]=useState(edit?{...edit,password:''}:{name:'',photo_data:'',password:''});const save=async()=>{try{await window.api.operators.save(o);dataChanged();notify(edit?'Operador atualizado.':'Operador cadastrado.');close();done()}catch(e){notify(e)}};const photo=async()=>{try{const p=await window.api.logo.choose();if(p)setO({...o,photo_data:p})}catch(e){notify(e)}};const isAdmin=edit?.role==='admin';return <Modal title={edit?'Editar operador':'Novo operador'} close={close}><div className="operatorform"><div className="profile-photo-row"><div className="operatorphoto large">{o.photo_data?<img src={o.photo_data}/>:<I.UserRound/>}</div><button className="smallbtn" onClick={photo}><I.ImagePlus/> Escolher foto</button></div><label>Nome do operador*<input autoFocus value={o.name} onChange={e=>setO({...o,name:e.target.value})} disabled={isAdmin}/></label><label>Perfil<input value={isAdmin?'Administrador':'Operador'} readOnly/></label><label>Senha (mínimo 8 caracteres){edit&&<small className="muted"> (deixe em branco para manter)</small>}<input type="password" value={o.password||''} onChange={e=>setO({...o,password:e.target.value})}/></label></div><div className="modalactions"><button onClick={close}>Cancelar</button><button className="primary" onClick={save}>Salvar operador</button></div></Modal>}

function Backup({notify}){const[s,setS]=useState({enabled:'0',frequency:'daily',time:'23:00',day_of_week:'1',day_of_month:'1',keep_auto:'30',last_backup_at:'',last_backup_path:'',backup_last_error:''}),[busy,setBusy]=useState(false);
 const load=async()=>{try{const x=await window.api.settings.get();setS({enabled:String(x.backup_schedule_enabled||'0'),frequency:x.backup_frequency||'daily',time:x.backup_time||'23:00',day_of_week:x.backup_day_of_week||'1',day_of_month:x.backup_day_of_month||'1',keep_auto:String(x.backup_retention_count||'30'),last_backup_at:x.last_backup_at||'',last_backup_path:x.last_backup_path||'',backup_last_error:x.backup_last_error||''})}catch(e){notify(e)}};
 useEffect(()=>{load()},[]);
 const save=async()=>{if(busy)return;try{setBusy(true);await window.api.backup.schedule(s);await load();notify('Programação de backup salva.')}catch(e){notify(e)}finally{setBusy(false)}};
 const create=async()=>{if(busy)return;try{setBusy(true);const f=await window.api.backup.create();await load();dataChanged();notify('Backup local validado e criado em: '+f)}catch(e){await load();notify(e)}finally{setBusy(false)}};
 const restore=async()=>{if(busy)return;try{setBusy(true);const r=await window.api.backup.restore();await load();if(r?.restored)notify('Backup restaurado. Atualizando sistema...')}catch(e){await load();notify(e)}finally{setBusy(false)}};
 const verify=async()=>{if(busy)return;try{setBusy(true);const r=await window.api.backup.verifyLatest();await load();notify('Último backup verificado com sucesso: '+r.path)}catch(e){notify(e)}finally{setBusy(false)}};
 const showDate=d=>{if(!d)return 'Nenhum registro';const dt=new Date(d);return Number.isNaN(dt.getTime())?d:dt.toLocaleString('pt-BR')};
 const lastResult=s.backup_last_error?'FALHA':(s.last_backup_at?'SUCESSO':'Sem registros');
 return <div className="settings"><div className="panel"><h2>Backup</h2><p className="muted">Cópias consistentes do SQLite são verificadas antes de serem aceitas. A restauração confere a identidade da loja, pede confirmação e cria uma cópia de segurança antes de substituir o banco.</p><div className="backupactions"><button className="primary" disabled={busy} onClick={create}><I.DatabaseBackup/> Fazer backup local agora</button><button className="smallbtn" disabled={busy} onClick={restore}><I.Upload/> Restaurar backup</button><button className="smallbtn" disabled={busy||!s.last_backup_path} onClick={verify}><I.ShieldCheck/> Verificar último backup</button><button className="smallbtn" disabled={busy} onClick={load}><I.RefreshCw/> Atualizar situação</button></div></div>
 <div className="panel"><h2>Situação do backup local</h2><div className="formgrid"><div><b>Última tentativa:</b> {showDate(s.last_backup_at)}</div><div><b>Resultado:</b> {lastResult}</div><div><b>Tipo:</b> {s.last_backup_at?'Manual':'—'}</div><div><b>Último sucesso:</b> {s.backup_last_error?'Nenhum registro':showDate(s.last_backup_at)}</div><div className="span2"><b>Arquivo:</b> <span style={{overflowWrap:'anywhere'}}>{s.last_backup_path||'—'}</span></div>{s.backup_last_error&&<div className="span2"><b>Mensagem:</b> {s.backup_last_error}</div>}</div></div>
 <div className="panel"><h2>Backup automático local</h2><p className="muted">O agendamento dentro do aplicativo funciona quando ele está aberto. O projeto também inclui o modo técnico --backup-once para uso por uma tarefa agendada do Windows; a tarefa precisa ser configurada e testada no computador onde o aplicativo está instalado.</p><div className="formgrid"><label className="span2">Ativação<ThemedSelect value={s.enabled} onChange={e=>setS({...s,enabled:e.target.value})}><option value="0">Desativado</option><option value="1">Ativado</option></ThemedSelect></label><label>Frequência<ThemedSelect value={s.frequency} onChange={e=>setS({...s,frequency:e.target.value})}><option value="daily">Diário</option><option value="weekly">Semanal</option><option value="monthly">Mensal</option></ThemedSelect></label><label>Horário<input type="time" value={s.time} onChange={e=>setS({...s,time:e.target.value})}/></label>{s.frequency==='weekly'&&<label>Dia da semana<ThemedSelect value={s.day_of_week} onChange={e=>setS({...s,day_of_week:e.target.value})}><option value="0">Domingo</option><option value="1">Segunda-feira</option><option value="2">Terça-feira</option><option value="3">Quarta-feira</option><option value="4">Quinta-feira</option><option value="5">Sexta-feira</option><option value="6">Sábado</option></ThemedSelect></label>}{s.frequency==='monthly'&&<label>Dia do mês<input type="number" min="1" max="31" value={s.day_of_month} onChange={e=>setS({...s,day_of_month:e.target.value})}/></label>}<label>Manter últimos backups automáticos<input type="number" min="1" max="365" value={s.keep_auto} onChange={e=>setS({...s,keep_auto:e.target.value})}/></label></div><div className="backupactions"><button className="primary" disabled={busy} onClick={save}>Salvar programação</button></div></div></div>}

function LoginPasswordPanel({notify}){const[current,setCurrent]=useState(''),[next,setNext]=useState(''),[busy,setBusy]=useState(false);const save=async()=>{try{setBusy(true);await window.api.auth.changePassword({current,next});setCurrent('');setNext('');notify('Senha do Administrador alterada com sucesso.')}catch(e){notify(e)}finally{setBusy(false)}};return <div className="panel"><h2>Senha de acesso</h2><p className="muted">Usuário de acesso ao sistema: <b>Administrador</b>. Informe a senha atual para definir uma nova senha de acesso.</p><div className="formgrid"><label>Senha atual<input type="password" value={current} onChange={e=>setCurrent(e.target.value)}/></label><label>Nova senha (mínimo 8 caracteres)<input type="password" value={next} onChange={e=>setNext(e.target.value)}/></label></div><button className="primary" disabled={busy||!current||!next} onClick={save}>Alterar senha</button></div>}

function Config({settings,saved,notify}){const[s,setS0]=useState(withSidebarMenuDefaults(settings)),[saving,setSaving]=useState(false),[dirty,setDirty]=useState(false);const dirtyRef=useRef(false);const setS=x=>{dirtyRef.current=true;setDirty(true);setS0(x)};useEffect(()=>{if(!dirtyRef.current)setS0(withSidebarMenuDefaults(settings))},[settings]);const save=async()=>{if(saving)return;try{setSaving(true);await window.api.settings.set(s);dirtyRef.current=false;setDirty(false);await saved();notify('Configurações salvas com sucesso.')}catch(e){notify(e)}finally{setSaving(false)}};return <div className="settings">{dirty&&<div className="settings-unsaved">Há alterações não salvas nas configurações. <button className="smallbtn" onClick={()=>{dirtyRef.current=false;setDirty(false);setS0(withSidebarMenuDefaults(settings))}}>Descartar alterações</button></div>}<div className="uni-settings-intro"><h2>Configurações do Jhonnie Beer</h2><p>Organize a operação, personalização, operadores, Android e dispositivos. Seus temas atuais permanecem inalterados.</p></div>
 <details className="uni-settings-section" open><summary>Empresa e operação</summary><div className="panel"><div className="toolbar inline"><div><h2>Empresa e operação</h2><p className="muted">Informações gerais usadas pelo sistema.</p></div><HelpTip text="Esses dados identificam a loja em telas, relatórios e documentos."/></div><div className="formgrid"><label>Nome da loja<input value={s.store_name||''} onChange={e=>setS({...s,store_name:e.target.value})}/></label><label>Razão social<input value={s.company_legal_name||''} onChange={e=>setS({...s,company_legal_name:e.target.value})}/></label><label>Nome fantasia<input value={s.company_fantasy_name||''} onChange={e=>setS({...s,company_fantasy_name:e.target.value})}/></label><label>CNPJ<input value={s.company_cnpj||''} onChange={e=>setS({...s,company_cnpj:e.target.value})}/></label><label>Telefone da loja<input value={s.company_phone||''} onChange={e=>setS({...s,company_phone:e.target.value})} placeholder="(00) 00000-0000"/></label><label>Inscrição estadual<input value={s.company_ie||''} onChange={e=>setS({...s,company_ie:e.target.value})}/></label><label className="span2">Endereço<input value={s.company_address||''} onChange={e=>setS({...s,company_address:e.target.value})}/></label></div></div></details>
 <details className="uni-settings-section" open><summary>Caixa e fundo de troco</summary><div className="panel"><div className="toolbar inline"><div><h2>Caixa e fundo de troco</h2><p className="muted">Defina um valor padrão para agilizar a abertura diária do caixa. O operador sempre poderá alterar o valor naquele dia.</p></div><I.WalletCards/></div><div className="formgrid"><label>Usar fundo de troco padrão<ThemedSelect value={String(s.cash_default_opening_enabled||'0')} onChange={e=>setS({...s,cash_default_opening_enabled:e.target.value})}><option value="0">Não — informar manualmente</option><option value="1">Sim — preencher automaticamente</option></ThemedSelect></label><label>Valor padrão diário<CurrencyInput value={Math.max(0,Number(s.cash_default_opening_cents||0))} onChange={v=>setS({...s,cash_default_opening_cents:String(v)})}/></label></div><div className="ux-settings-note"><I.Info/><span>Esse valor representa somente o dinheiro inicial disponível para troco. Ele não entra como venda e fica registrado separadamente em cada abertura e fechamento de caixa.</span></div><h3>Gaveta de dinheiro (Epson TM-T88V)</h3><div className="formgrid"><label>Impressora de cupom<input value={s.cash_drawer_printer_name||'EPSON TM-T88V'} onChange={e=>setS({...s,cash_drawer_printer_name:e.target.value})} placeholder="Nome da impressora no Windows"/></label><label>Pino de acionamento<ThemedSelect value={String(s.cash_drawer_pin||'2')} onChange={e=>setS({...s,cash_drawer_pin:e.target.value})}><option value="2">Pino 2 (padrão Epson)</option><option value="5">Pino 5</option></ThemedSelect></label><label>Pulso de abertura (ms)<input type="number" min="20" max="500" step="10" value={s.cash_drawer_pulse_on_ms||'100'} onChange={e=>setS({...s,cash_drawer_pulse_on_ms:e.target.value})}/></label><label>Pausa do pulso (ms)<input type="number" min="20" max="500" step="10" value={s.cash_drawer_pulse_off_ms||'100'} onChange={e=>setS({...s,cash_drawer_pulse_off_ms:e.target.value})}/></label><label>Abertura automática após pagamento<ThemedSelect value={String(s.cash_drawer_auto_enabled??'1')} onChange={e=>setS({...s,cash_drawer_auto_enabled:e.target.value})}><option value="1">Ativada</option><option value="0">Desativada</option></ThemedSelect></label>{settings.current_operator_role==='admin'&&<label>Permitir abertura manual por operadores<ThemedSelect value={String(s.cash_drawer_manual_operator_access||'0')} onChange={e=>setS({...s,cash_drawer_manual_operator_access:e.target.value})}><option value="0">Não — somente Administrador</option><option value="1">Sim — permitir aos operadores</option></ThemedSelect></label>}</div><div className="ux-settings-note"><I.Info/><span>O comando é enviado em formato ESC/POS RAW pela fila do Windows. O RJ-11, a pinagem e a compatibilidade elétrica da gaveta precisam ser confirmados no equipamento antes do uso real.</span></div></div></details>
 <details className="uni-settings-section" open><summary>Interface e menus</summary><div className="panel"><div className="toolbar inline"><div><h2>Aparência e navegação</h2><p className="muted">Personalize a organização e escolha quais módulos auxiliares aparecem na barra lateral. Nenhum dado ou recurso é apagado.</p></div><I.LayoutDashboard/></div><div className="formgrid"><label>Modo de navegação<ThemedSelect value={String(s.ux_mode||'complete')} onChange={e=>setS({...s,ux_mode:e.target.value})}><option value="complete">Modo Completo — menus tradicionais</option><option value="compact">Modo Compacto — painel de atalhos</option></ThemedSelect></label><label>Organização da sidebar<ThemedSelect value={String(s.ux_grouped_sidebar??'1')} onChange={e=>setS({...s,ux_grouped_sidebar:e.target.value})}><option value="1">Agrupada por assunto</option><option value="0">Lista simples</option></ThemedSelect></label></div><div className="ux-settings-note"><I.Info/><span>Os menus de operação — Início, Caixa, Vendas, Orçamentos e Agenda — permanecem sempre visíveis. Os demais podem ser ocultados ou exibidos abaixo.</span></div><div className="sidebar-menu-settings">{SIDEBAR_OPTIONAL_MENUS.map(([id,label])=>{const key=sidebarMenuSettingKey(id);return <label className="sidebar-menu-toggle" key={id}><input type="checkbox" checked={String(s[key]??'1')!=='0'} onChange={e=>setS({...s,[key]:e.target.checked?'1':'0'})}/><span><b>{label}</b><small>{id==='config'?'Mesmo oculto, Configurações continua acessível pelo ícone de engrenagem no topo.':'Mostrar este menu na sidebar.'}</small></span></label>})}</div><div className="modalactions"><button className="smallbtn" onClick={()=>window.dispatchEvent(new CustomEvent('app:navigate',{detail:'ajuda'}))}><I.CircleHelp/> Central de Ajuda</button><button className="smallbtn" onClick={()=>window.dispatchEvent(new CustomEvent('app:navigate',{detail:'diagnostico'}))}><I.Stethoscope/> Diagnóstico</button></div></div></details>
 <details className="uni-settings-section"><summary>Operadores do Windows</summary><OperatorsPanel notify={notify}/></details>{settings.current_operator_role==='admin'&&<UniAndroidSettings notify={notify}/>}
 <details className="uni-settings-section"><summary>Balança e periféricos</summary><ScaleConfigPanel settings={settings} saved={saved} notify={notify}/></details>
 <details className="uni-settings-section" open><summary>Identidade visual</summary><div className="panel"><h2>Identidade visual</h2><div className="logoConfig"><div className="logoPreview">{s.logo_data?<img src={s.logo_data} alt="Logo"/>:<img src={appLogo} alt="Uni-PDV"/>}</div><div><h3>Ícone da loja</h3><p className="muted">Escolha uma imagem para aparecer no aplicativo.</p><button className="smallbtn" onClick={async()=>{try{const logo=await window.api.logo.choose();if(logo){const ns={...s,logo_data:logo};setS(ns);await window.api.settings.set({logo_data:logo});await saved();notify('Ícone da loja atualizado.')}}catch(e){notify(e)}}}><I.ImagePlus/> Trocar ícone</button></div></div></div></details>
 <div className="ux-config-save"><button className="primary" disabled={saving} onClick={save}><I.Save/> {saving?'Salvando...':'Salvar configurações'}</button></div>
 </div>}

function Login({onLogin}){const[u,setU]=useState(''),[p,setP]=useState(''),[busy,setBusy]=useState(false),[err,setErr]=useState(''),[theme,setTheme]=useState('jhonnie');useEffect(()=>{window.api.settings.get().then(s=>setTheme(s.theme||'jhonnie')).catch(()=>{})},[]);const submit=async e=>{e.preventDefault();setBusy(true);setErr('');try{const r=await window.api.auth.login({username:u,password:p});onLogin(r)}catch(x){setErr(x.message||'Não foi possível entrar.')}finally{setBusy(false)}};return <div className={`login-screen theme-${theme}`}><form className="login-card" onSubmit={submit}><div className="login-logo"><img src={appLogo}/></div><h1>Jhonnie Beer</h1><p>Sistema de Ponto de Vendas</p><label>Usuário<input autoFocus value={u} onChange={e=>setU(e.target.value)} placeholder="Administrador"/></label><label>Senha<input type="password" value={p} onChange={e=>setP(e.target.value)} placeholder="Senha"/></label>{err&&<div className="login-error">{err}</div>}<button className="primary big" disabled={busy}>{busy?'Entrando...':'Entrar'}</button><div className="login-about">Jhonnie Beer · PDV personalizado · Uni Softwares</div></form></div>}
function App(){const[auth,setAuth]=useState(()=>{try{return JSON.parse(sessionStorage.getItem('unipdv-session')||'null')}catch{return null}});const doLogin=a=>{sessionStorage.setItem('unipdv-session',JSON.stringify(a));setAuth(a)};const logout=async()=>{try{await window.api.auth.logout()}catch{}sessionStorage.removeItem('unipdv-session');setAuth(null)};useEffect(()=>{const fn=()=>logout();window.addEventListener('session:logout',fn);window.addEventListener('session:lock',fn);return()=>{window.removeEventListener('session:logout',fn);window.removeEventListener('session:lock',fn)}},[]);return auth?<ErrorBoundary name="Sistema"><SystemApp/></ErrorBoundary>:<Login onLogin={doLogin}/>}

createRoot(document.getElementById('root')).render(<App/>);
