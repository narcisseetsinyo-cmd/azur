/* Azur — interface du budget (chargée après connexion) */
(()=>{
"use strict";
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const rid=()=>Math.random().toString(36).slice(2,9)+Date.now().toString(36).slice(-4);
const pad=n=>String(n).padStart(2,"0");
const iso=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const parseISO=s=>{const [y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d);};
const todayISO=()=>iso(new Date());
const MONTHS=["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
const MS=["janv.","févr.","mars","avr.","mai","juin","juil.","août","sept.","oct.","nov.","déc."];
const DAYS=["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"];
const cap=s=>s.charAt(0).toUpperCase()+s.slice(1);
const LOGO="assets/logo.png";
const reduced=matchMedia("(prefers-reduced-motion: reduce)").matches;

const TYPES={
  in:{label:"Entrée",plural:"Entrées",icon:"south_west",color:"var(--in)"},
  out:{label:"Dépense",plural:"Dépenses",icon:"north_east",color:"var(--out)"},
  save:{label:"Épargne",plural:"Épargne",icon:"savings",color:"var(--save)"},
  gift:{label:"Semence",plural:"Semences",icon:"volunteer_activism",color:"var(--gift)"},
  other:{label:"Autre",plural:"Autres",icon:"category",color:"var(--other)"}
};
const ORDER=["in","out","save","gift","other"];
const DEFAULT_CATS={
  in:[["salaire","Salaire","work"],["presta","Prestations clients","handshake"],["vente","Vente","storefront"],["rembourse","Remboursement reçu","undo"],["cadeau","Cadeau reçu","redeem"],["autre-in","Autre entrée","add_circle"]],
  out:[["loyer","Loyer","home"],["alim","Alimentation","shopping_basket"],["transport","Transport","two_wheeler"],["energie","Électricité et eau","bolt"],["telecom","Internet et crédit","wifi"],["sante","Santé","medical_services"],["famille","Famille","family_restroom"],["loisirs","Loisirs","celebration"],["shopping","Shopping","shopping_bag"],["pro","Matériel pro","content_cut"],["autre-out","Autre dépense","more_horiz"]],
  save:[["ep1","Épargne 1","savings"],["ep2","Épargne 2","account_balance"],["ep3","Épargne 3","shield"]],
  gift:[["dime","Dîme","church"],["offrande","Offrandes","favorite"],["don","Dons","volunteer_activism"]],
  other:[["pret","Prêt accordé","payments"],["cotisation","Cotisation","groups_2"],["imprevu","Imprévu","emergency"],["divers","Divers","more_horiz"]]
};
const PAYS=[["cash","Espèces","payments"],["tmoney","T-Money","phone_iphone"],["flooz","Flooz","smartphone"],["bank","Banque ou carte","credit_card"]];
const CURRENCIES={FCFA:{sym:"FCFA",dec:0,name:"Franc CFA (FCFA)"},EUR:{sym:"€",dec:2,name:"Euro (€)"},USD:{sym:"$",dec:2,name:"Dollar US ($)"},GHS:{sym:"GH₵",dec:2,name:"Cedi ghanéen (GH₵)"},NGN:{sym:"₦",dec:0,name:"Naira (₦)"}};
const ICONS=["shield","home","flight","school","storefront","directions_car","favorite","rocket_launch","celebration","devices","content_cut","spa","checkroom","restaurant","local_hospital","child_care","pets","sports_soccer","menu_book","build","brush","local_cafe","fitness_center","savings"];
const PALETTE=["#4FA3E8","#FF6B81","#818CF8","#2DD4BF","#FBBF24","#7CC4F5","#F472B6","#A3E635","#2E6FD8","#94A3B8","#FB923C"];

const defaultConfig=()=>({currency:"FCFA",startDay:1,theme:"system",budgets:{},goals:[],customCats:{in:[],out:[],save:[],gift:[],other:[]},tithe:{on:true,rate:10},split:true});
let S={config:defaultConfig(),tx:{}};
const ui={view:"home",offset:0,filter:"all",q:"",anim:true};
const counts={};

/* ---------- Données ---------- */
const allTx=()=>Object.values(S.tx).flat();
const findTx=id=>allTx().find(t=>t.id===id);
const cats=type=>[...DEFAULT_CATS[type].map(([id,label,icon])=>({id,label:((S.config.catNames||{})[id])||label,icon:((S.config.catIcons||{})[id])||icon})),...((S.config.customCats||{})[type]||[]).map(c=>({...c,custom:true}))];
const catOf=t=>cats(t.type).find(c=>c.id===t.cat)||{id:t.cat,label:t.catLabel||"Sans catégorie",icon:"label"};
const cur=()=>CURRENCIES[S.config.currency]||CURRENCIES.FCFA;
function num(n){const c=cur();return Math.abs(n).toLocaleString("fr-FR",{minimumFractionDigits:c.dec,maximumFractionDigits:c.dec}).replace(/[  ]/g," ");}
function fmt(n,sign){const pre=sign?(n>0?"+ ":n<0?"− ":""):(n<0?"− ":"");return `${pre}${num(n)} ${cur().sym}`;}
function short(n){const v=Math.abs(n);if(v>=1e6)return (v/1e6).toLocaleString("fr-FR",{maximumFractionDigits:1})+" M";if(v>=1e3)return Math.round(v/1e3).toLocaleString("fr-FR")+" k";return Math.round(v)+"";}
const parseAmt=s=>{const v=parseFloat(String(s).replace(/[\s  ]/g,"").replace(",","."));return isFinite(v)?v:0;};
function period(offset=ui.offset){
  const sd=Math.min(28,Math.max(1,+S.config.startDay||1));const t=new Date();let y=t.getFullYear(),m=t.getMonth();
  if(t.getDate()<sd)m--;m+=offset;
  const start=new Date(y,m,sd),end=new Date(y,m+1,sd-1);
  const label=sd===1?`${cap(MONTHS[start.getMonth()])} ${start.getFullYear()}`:`${cap(MONTHS[end.getMonth()])} ${end.getFullYear()}`;
  const range=sd===1?"":`${start.getDate()} ${MS[start.getMonth()]} – ${end.getDate()} ${MS[end.getMonth()]}`;
  return {start:iso(start),end:iso(end),startD:start,endD:end,label,range,short:MS[end.getMonth()],days:Math.round((end-start)/864e5)+1};
}
const inPeriod=p=>allTx().filter(t=>t.date>=p.start&&t.date<=p.end);
function sums(list){const s={in:0,out:0,save:0,gift:0,other:0};list.forEach(t=>{s[t.type]=(s[t.type]||0)+(+t.amount||0);});s.outflow=s.out+s.save+s.gift+s.other;s.net=s.in-s.outflow;return s;}
function byCat(list,type){const m={};list.filter(t=>t.type===type).forEach(t=>{m[t.cat]=(m[t.cat]||0)+(+t.amount||0);});return m;}
const budgetIds=(type="out")=>Object.keys(S.config.budgets||{}).filter(k=>S.config.budgets[k]>0&&cats(type).some(c=>c.id===k));
const goalSaved=g=>(+g.initial||0)+allTx().filter(t=>t.type==="save"&&t.goal===g.id).reduce((a,t)=>a+(+t.amount||0),0);

/* ---------- Stockage : base SQLite locale via le pont sécurisé ---------- */
const session={user:null};
let saveChain=Promise.resolve();
function persist(keys){[...new Set(keys)].forEach(k=>{saveChain=saveChain.then(()=>writeKey(k)).catch(()=>{});});}
async function writeKey(k){
  if(!session.user)return;
  let r;
  if(k==="config")r=await window.azur.data.saveConfig(JSON.parse(JSON.stringify(S.config)));
  else{const m=k.slice(3);r=await window.azur.data.replaceMonth(m,JSON.parse(JSON.stringify(S.tx[m]||[])));if(S.tx[m]&&!S.tx[m].length)delete S.tx[m];}
  if(r&&!r.ok){if(r.error.code==="unauthenticated"){lockApp();toast("Ta session a expiré. Reconnecte-toi.");}else toast("Enregistrement impossible : "+r.error.message);}
}
const allKeys=()=>["config",...Object.keys(S.tx).map(m=>"tx-"+m)];
const cloud={on:false};

/* ---------- Récurrences ---------- */
function applyRecurring(){
  const p=period(0);const all=allTx();const latest={};
  all.forEach(t=>{const k=t.recId||(t.rec?t.id:null);if(!k)return;if(!latest[k]||t.date>latest[k].date)latest[k]=t;});
  const keys=new Set();
  Object.entries(latest).forEach(([k,t])=>{
    if(!t.rec||t.date>=p.start)return;
    const day=+t.date.slice(8);
    const cand=[p.startD,p.endD].map(d=>{const dim=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();return new Date(d.getFullYear(),d.getMonth(),Math.min(day,dim));}).find(d=>iso(d)>=p.start&&iso(d)<=p.end);
    if(!cand)return;
    const tx={...t,id:rid(),recId:k,date:iso(cand),created:Date.now(),auto:true};
    const m=tx.date.slice(0,7);(S.tx[m]=S.tx[m]||[]).push(tx);keys.add("tx-"+m);
  });
  if(keys.size)persist([...keys]);
}

/* ---------- Thème ---------- */
const hostTheme=document.documentElement.getAttribute("data-theme");
function applyTheme(){const t=S.config.theme,r=document.documentElement;if(t==="dark"||t==="light")r.setAttribute("data-theme",t);else if(hostTheme)r.setAttribute("data-theme",hostTheme);else r.removeAttribute("data-theme");}

/* ---------- Composants ---------- */
const ms=(n,f)=>`<span class="ms${f?" f":""}" aria-hidden="true">${n}</span>`;
function deltaHtml(cur,prev,upGood){
  if(!prev&&!cur)return `<span class="delta flat">—</span>`;
  if(!prev)return `<span class="delta flat">nouveau</span>`;
  const d=(cur-prev)/prev;const pct=Math.round(Math.abs(d)*100);
  if(pct===0)return `<span class="delta flat">${ms("trending_flat")}stable</span>`;
  const good=(d>0)===upGood;
  return `<span class="delta ${good?"good":"bad"}">${ms(d>0?"arrow_upward":"arrow_downward")}${pct} %</span>`;
}
function ring(pct,size,color,track,width){
  const r=16-width/2;const off=100-Math.max(0,Math.min(100,pct));
  return `<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="${r}" fill="none" style="stroke:${track}" stroke-width="${width}"/><circle class="prog" cx="16" cy="16" r="${r}" fill="none" style="stroke:${color};stroke-dashoffset:${off}" stroke-width="${width}" stroke-linecap="round" pathLength="100" stroke-dasharray="100"/></svg>`;
}
function dayLabel(d){
  const t=todayISO();const y=iso(new Date(Date.now()-864e5));
  if(d===t)return "Aujourd'hui";if(d===y)return "Hier";
  const D=parseISO(d);const yr=D.getFullYear()!==new Date().getFullYear()?" "+D.getFullYear():"";
  return `${cap(DAYS[D.getDay()])} ${D.getDate()} ${MONTHS[D.getMonth()]}${yr}`;
}
function txRow(t,showDate){
  const c=catOf(t),T=TYPES[t.type];const pay=PAYS.find(p=>p[0]===t.pay);
  const sub=[t.note,pay&&pay[1]].filter(Boolean).join(" · ");
  const sign=t.type==="in"?1:-1;
  const future=t.date>todayISO();
  const D=parseISO(t.date);
  return `<div class="tx-row" data-swipe data-id="${t.id}">
    <button class="tx-del" type="button" data-act="del" data-id="${t.id}">${ms("delete")}Supprimer</button>
    <div class="tx-main" data-act="edit" data-id="${t.id}" role="button" tabindex="0" aria-label="Modifier ${esc(c.label)}">
      <span class="ic" style="--c:${T.color}">${ms(c.icon)}</span>
      <div class="tx-txt"><strong>${esc(c.label)}${t.rec?`<span class="tag">${ms("repeat")}mensuel</span>`:""}${future?`<span class="tag">prévu</span>`:""}</strong><small>${esc(sub||T.label)}</small></div>
      <div class="tx-amt" style="color:${t.type==="in"?"var(--in)":"var(--fg)"}">${fmt(sign*t.amount,true)}${showDate?`<small>${D.getDate()} ${MS[D.getMonth()]}</small>`:""}</div>
    </div></div>`;
}
const emptyHtml=(icon,title,text,btn)=>`<div class="empty">${ms(icon)}<strong>${title}</strong><p>${text}</p>${btn||""}</div>`;
function demoBanner(){
  if(!S.config.demo)return "";
  return `<div class="banner" style="--i:0">${ms("info")}<p>Tu regardes des <strong>données d'exemple</strong>. Efface-les quand tu veux commencer avec tes vrais chiffres.</p><button class="btn sm" data-act="demo-clear" type="button">Effacer les exemples</button></div>`;
}

/* ---------- Vues ---------- */
function vHome(){
  const p=period(),L=inPeriod(p),s=sums(L),prev=sums(inPeriod(period(ui.offset-1)));
  const bIds=budgetIds();const bTotal=bIds.reduce((a,k)=>a+S.config.budgets[k],0);
  const spent=byCat(L,"out");const bSpent=bIds.reduce((a,k)=>a+(spent[k]||0),0);
  let ringPct,ringLbl,ringSub;
  if(bTotal){ringPct=bSpent/bTotal*100;ringLbl=Math.round(ringPct)+"%";ringSub="du budget";}
  else{ringPct=s.in?s.outflow/s.in*100:0;ringLbl=Math.round(ringPct)+"%";ringSub="dépensé";}
  const ringColor=ringPct>=100?"#FF6B81":ringPct>=80?"#FBBF24":"#B5DEFA";
  const isNow=ui.offset===0;const today=new Date();
  const left=isNow?Math.max(1,Math.round((p.endD-new Date(today.getFullYear(),today.getMonth(),today.getDate()))/864e5)+1):0;
  const perDay=isNow&&s.net>0?s.net/left:0;
  const sub=isNow?(s.net>=0?`Il reste ${left} jour${left>1?"s":""} · environ ${fmt(perDay)} par jour`:`Tu as dépassé tes entrées de ${fmt(-s.net)}`):(p.range||"Mois terminé");
  const recent=[...L].sort((a,b)=>b.date.localeCompare(a.date)||(b.created||0)-(a.created||0)).slice(0,5);
  const empty=!allTx().length;
  let i=0;const I=()=>`style="--i:${i++}"`;
  const alerts=bIds.map(k=>({k,c:cats("out").find(c=>c.id===k),b:S.config.budgets[k],s:spent[k]||0})).sort((a,b)=>b.s/b.b-a.s/a.b).slice(0,4);
  const goals=(S.config.goals||[]).slice(0,3);
  let reviewBanner="";
  if(isNow&&allTx().length){const pd=Math.round((new Date(today.getFullYear(),today.getMonth(),today.getDate())-p.startD)/864e5);const pv=period(-1);
    if(pd<7&&inPeriod(pv).length)reviewBanner=`<div class="banner accent">${ms("summarize")}<p>Ton bilan de <strong>${esc(pv.label.toLowerCase())}</strong> est prêt, avec des plafonds suggérés pour ce mois.</p><button class="btn sm" data-act="review-prev" type="button">Voir le bilan</button></div>`;
    else if(left<=3)reviewBanner=`<div class="banner accent">${ms("summarize")}<p>Le mois se termine dans ${left} jour${left>1?"s":""}. Ton bilan de ${esc(p.label.toLowerCase())} se dessine.</p><button class="btn sm" data-nav="review" type="button">Voir le bilan</button></div>`;}
  return `${demoBanner()}${reviewBanner}
  <div class="home-grid">
   <div class="col">
    <article class="hero" id="hero" ${I()}>
      <div class="hero-top"><span class="eyebrow">Disponible · ${esc(p.label)}</span><span class="pill">${ms("person")}${esc(firstName(session.user.displayName))}</span></div>
      <div class="hero-body">
        <div style="min-width:0"><div class="hero-amount"><span data-count="${s.net}" data-key="net" data-mode="num">${(s.net<0?"− ":"")+num(s.net)}</span><small>${cur().sym}</small></div><p class="hero-sub">${sub}</p></div>
        <div class="hero-ring">${ring(ringPct,86,ringColor,"rgba(181,222,250,.16)",3.2)}<div class="lbl"><div><strong>${ringLbl}</strong><small>${ringSub}</small></div></div></div>
      </div>
      <div class="hero-flows">
        <div class="flow"><span>${ms("south_west")}Entrées</span><strong>${fmt(s.in)}</strong></div>
        <div class="flow"><span>${ms("north_east")}Sorties</span><strong>${fmt(s.outflow)}</strong></div>
      </div>
    </article>
    ${empty?`<section class="card welcome" ${I()}><div style="display:flex;align-items:center;gap:14px"><img src="${LOGO}" alt="Logo Azur" width="64" height="64" style="border-radius:16px;flex:none"><h2>Bienvenue dans Azur</h2></div><p class="muted">Enregistre ce qui entre et ce qui sort, fixe tes plafonds et suis tes objectifs d'épargne. Commence par ta première opération, ou découvre l'app avec des exemples.</p><div class="acts"><button class="btn primary" data-act="add" type="button">${ms("add")}Ajouter ma première opération</button><button class="btn" data-act="demo-load" type="button">${ms("auto_awesome")}Voir avec des exemples</button></div></section>`:""}
    <div class="minis" ${I()}>${ORDER.map(t=>{const T=TYPES[t];return `<button class="mini" type="button" data-type="${t}" data-act="filter-go" data-filter="${t}" style="--c:${T.color}"><div class="mini-top"><span class="ic" style="--c:${T.color}">${ms(T.icon)}</span>${deltaHtml(s[t],prev[t],t==="in"||t==="save")}</div><div><div class="mini-label">${T.plural}</div><div class="mini-val"><span data-count="${s[t]}" data-key="m-${t}" data-mode="num">${num(s[t])}</span><span class="mini-cur">${cur().sym}</span></div></div></button>`;}).join("")}</div>
    <section class="card" ${I()}>
      <div class="card-h"><h2>Dernières opérations</h2><button class="btn ghost" data-nav="ops" type="button">Tout voir</button></div>
      ${recent.length?`<div class="list">${recent.map(t=>txRow(t,true)).join("")}</div>`:emptyHtml("receipt_long","Rien pour ce mois","Ajoute une entrée ou une dépense avec le bouton +.")}
    </section>
   </div>
   <div class="col">
    <section class="card" ${I()}>
      <div class="card-h"><h2>Budgets du mois</h2><button class="btn ghost" data-nav="budgets" type="button">Gérer</button></div>
      ${alerts.length?`<div class="mini-list">${alerts.map(a=>{const pct=a.s/a.b*100;const col=pct>=100?"var(--out)":pct>=80?"var(--gift)":"var(--accent)";return `<div class="ml-row"><div class="ml-top"><span>${esc(a.c.label)}</span><span>${short(a.s)} / ${short(a.b)}</span></div><div class="bar"><i style="--w:${Math.min(100,pct)}%;--c:${col}"></i></div></div>`;}).join("")}</div>`:emptyHtml("donut_small","Aucun plafond","Fixe un plafond par catégorie pour être alertée avant de dépasser.",`<button class="btn sm" data-nav="budgets" type="button">Fixer mes plafonds</button>`)}
    </section>
    <section class="card" ${I()}>
      <div class="card-h"><h2>Objectifs d'épargne</h2><button class="btn ghost" data-nav="goals" type="button">Voir</button></div>
      ${goals.length?`<div class="mini-list">${goals.map(g=>{const sv=goalSaved(g);const pct=g.target?sv/g.target*100:0;return `<div class="ml-row"><div class="ml-top"><span>${esc(g.name)}</span><span>${Math.round(Math.min(100,pct))} %</span></div><div class="bar"><i style="--w:${Math.min(100,pct)}%;--c:var(--save)"></i></div></div>`;}).join("")}</div>`:emptyHtml("flag","Pas encore d'objectif","Fonds d'urgence, matériel, voyage : donne un but à ton épargne.",`<button class="btn sm" data-act="goal-new" type="button">Créer un objectif</button>`)}
    </section>
    <section class="card insight" ${I()}>
      <span class="ic">${ms("insights")}</span>
      <div style="min-width:0;display:flex;flex-direction:column;gap:8px"><p>${s.in?`Ce mois-ci, tu as mis de côté <strong>${Math.round(s.save/s.in*100)} %</strong> de tes entrées et donné <strong>${fmt(s.gift)}</strong>.`:"Ajoute tes entrées du mois pour voir ton taux d'épargne."}</p><button class="btn sm" data-nav="stats" type="button" style="align-self:flex-start">${ms("monitoring")}Voir les statistiques</button></div>
    </section>
   </div>
  </div>`;
}

function vOps(){
  const p=period();
  return `<div class="page-h" style="--i:0"><div><h1>Opérations</h1><p>${esc(p.label)}${p.range?" · "+p.range:""}</p></div><button class="btn primary" data-act="add" type="button">${ms("add")}Ajouter</button></div>
  <div class="card ops-tools" style="--i:1">
    <label class="search"><span class="sr">Rechercher</span>${ms("search")}<input class="input" id="q" type="search" autocomplete="off" placeholder="Rechercher une note, une catégorie…" value="${esc(ui.q)}"></label>
    <div class="chips" role="group" aria-label="Filtrer par type">${["all",...ORDER].map(t=>`<button class="chip" type="button" data-act="filter" data-filter="${t}" aria-pressed="${ui.filter===t}" style="--tc:${t==="all"?"var(--accent)":TYPES[t].color}">${t==="all"?"Tout":TYPES[t].plural}</button>`).join("")}</div>
  </div>
  <div id="ops-list" style="--i:2;display:flex;flex-direction:column;gap:16px">${opsList()}</div>`;
}
function opsList(){
  const p=period();const q=ui.q.trim().toLowerCase();
  let L=q?allTx():inPeriod(p);
  if(ui.filter!=="all")L=L.filter(t=>t.type===ui.filter);
  if(q)L=L.filter(t=>[catOf(t).label,t.note,TYPES[t.type].label,(PAYS.find(x=>x[0]===t.pay)||[])[1],String(t.amount)].join(" ").toLowerCase().includes(q));
  L.sort((a,b)=>b.date.localeCompare(a.date)||(b.created||0)-(a.created||0));
  if(!L.length)return `<div class="card">${q?emptyHtml("search_off","Aucun résultat",`Rien ne correspond à « ${esc(ui.q)} ».`):emptyHtml("receipt_long","Aucune opération","Rien d'enregistré pour cette période avec ce filtre.",`<button class="btn primary" data-act="add" type="button">${ms("add")}Ajouter une opération</button>`)}</div>`;
  const s=sums(L);const groups={};L.forEach(t=>(groups[t.date]=groups[t.date]||[]).push(t));
  return `<div class="summary-line"><span>${L.length} opération${L.length>1?"s":""}${q?" · toutes périodes":""}</span>${s.in?`<span class="good">Entrées ${fmt(s.in,false)}</span>`:""}${s.outflow?`<span>Sorties ${fmt(s.outflow)}</span>`:""}<span class="muted">Glisse une ligne vers la gauche pour la supprimer</span></div>
  ${Object.entries(groups).map(([d,arr])=>{const n=sums(arr).net;return `<section class="day"><div class="day-h"><span>${dayLabel(d)}</span><span class="num">${fmt(n,true)}</span></div><div class="card list">${arr.map(t=>txRow(t)).join("")}</div></section>`;}).join("")}`;
}

function budgetSection(type,title,hint,mode,L,i){
  const spent=byCat(L,type);const list=cats(type);const ids=budgetIds(type);
  const total=ids.reduce((a,k)=>a+S.config.budgets[k],0);const used=ids.reduce((a,k)=>a+Math.min(mode==="cap"?Infinity:S.config.budgets[k],spent[k]||0),0);
  const T=TYPES[type];
  const rows=[...list].sort((a,b)=>{if(mode!=="cap")return 0;const ba=S.config.budgets[a.id]>0,bb=S.config.budgets[b.id]>0;if(ba!==bb)return ba?-1:1;return (spent[b.id]||0)-(spent[a.id]||0);}).map(c=>{
    const b=S.config.budgets[c.id]||0;const sp=spent[c.id]||0;const pc=b?sp/b*100:0;let cc,st;
    if(mode==="cap"){cc=pc>=100?"var(--out)":pc>=80?"var(--gift)":"var(--accent)";st=!b?`Pas de plafond${sp?` · dépensé ${fmt(sp)}`:""}`:sp>b?`<span class="bad">Dépassé de ${fmt(sp-b)}</span>`:sp===b?`<span style="color:var(--gift)">Plafond atteint</span>`:pc>=80?`<span style="color:var(--gift)">Attention : plus que ${fmt(b-sp)}</span>`:`Reste ${fmt(b-sp)}`;}
    else{cc=T.color;const verb=type==="save"?"mis de côté":"versé";st=!b?`Aucun montant prévu${sp?` · ${verb} ${fmt(sp)}`:""}`:pc>=100?`<span class="good">${ms("check_circle")} Atteint${sp>b?` · ${fmt(sp-b)} en plus`:""}</span>`:`Encore ${fmt(b-sp)} à ${type==="save"?"mettre de côté":"verser"}`;}
    return `<div class="b-row"><span class="ic" style="--c:${T.color}">${ms(c.icon)}</span><div class="b-main"><div class="b-top"><button type="button" class="b-name" data-act="cat-edit" data-type="${type}" data-id="${c.id}" aria-label="Renommer ${esc(c.label)}"><span class="b-lbl">${esc(c.label)}</span>${ms("edit")}</button><span>${short(sp)}${b?" / "+short(b):""}</span></div>${b?`<div class="bar"><i style="--w:${Math.min(100,pc)}%;--c:${cc}"></i></div>`:""}<span class="b-status">${st}</span></div><label><span class="sr">${mode==="cap"?"Plafond":"Montant prévu"} ${esc(c.label)}</span><input class="input b-input" id="b-${c.id}" data-budget="${c.id}" inputmode="numeric" placeholder="${mode==="cap"?"Plafond":"Prévu"}" value="${b?num(b):""}"></label></div>`;}).join("");
  const pct=total?used/total*100:0;
  return `<section class="card" style="--i:${i}"><div class="card-h" style="align-items:flex-start"><div><h2 style="display:flex;align-items:center;gap:8px"><span class="ic" style="--c:${T.color};width:32px;height:32px;border-radius:10px">${ms(T.icon)}</span>${title}</h2><p class="small muted" style="margin-top:6px">${hint}</p></div>${total?`<div style="text-align:right;flex:none"><strong class="num" style="font-family:var(--font-display);font-size:18px">${short(used)} / ${short(total)}</strong><div class="small muted">${Math.round(pct)} %</div></div>`:""}</div>${rows}</section>`;
}
function vBudgets(){
  const p=period();const L=inPeriod(p);const spent=byCat(L,"out");const list=cats("out");
  const bIds=budgetIds("out");const total=bIds.reduce((a,k)=>a+S.config.budgets[k],0);const used=bIds.reduce((a,k)=>a+(spent[k]||0),0);
  const unbudgeted=list.filter(c=>!bIds.includes(c.id)).reduce((a,c)=>a+(spent[c.id]||0),0);
  const pct=total?used/total*100:0;const col=pct>=100?"var(--out)":pct>=80?"var(--gift)":"var(--accent)";
  const over=bIds.filter(k=>(spent[k]||0)>S.config.budgets[k]).length;
  const plan=["out","gift","save"].reduce((a,t)=>a+budgetIds(t).reduce((x,k)=>x+S.config.budgets[k],0),0);
  const inc=sums(L).in;
  return `<div class="page-h" style="--i:0"><div><h1>Budgets</h1><p>Montants prévus pour ${esc(p.label.toLowerCase())}. Ils s'appliquent à tous les mois.</p></div>${L.some(t=>t.type==="in")?`<button class="btn" data-act="split-last" type="button">${ms("call_split")}Répartir une entrée</button>`:""}</div>
  <section class="card" style="--i:1;display:flex;gap:18px;align-items:center;flex-wrap:wrap">
    <div class="ring" style="width:92px;height:92px">${ring(pct,92,col,"var(--surface-3)",3.4)}<div class="lbl">${Math.round(pct)}%</div></div>
    <div style="flex:1;min-width:200px;display:flex;flex-direction:column;gap:4px">
      <span class="eyebrow">Dépenses sur les catégories suivies</span>
      <strong style="font-family:var(--font-display);font-size:26px;font-weight:600" class="num">${fmt(used)} <span class="muted" style="font-size:16px;font-family:var(--font-body);font-weight:400">sur ${fmt(total)}</span></strong>
      <span class="small ${total-used<0?"bad":"muted"}">${total?(total-used>=0?`Il reste ${fmt(total-used)}`:`Dépassement de ${fmt(used-total)}`):"Saisis un plafond à droite de chaque catégorie."}${over?` · ${over} catégorie${over>1?"s":""} dépassée${over>1?"s":""}`:""}${unbudgeted?` · ${fmt(unbudgeted)} hors plafonds`:""}</span>
      ${plan?`<span class="small muted">Total prévu (dépenses, semences et épargnes) : <strong style="color:var(--fg)">${fmt(plan)}</strong>${inc?` · ${Math.round(plan/inc*100)} % des entrées du mois`:""}</span>`:""}
    </div>
  </section>
  ${budgetSection("out","Dépenses","Un plafond à ne pas dépasser pour chaque catégorie.","cap",L,2)}
  ${budgetSection("gift","Dépenses semences","Dîme, offrandes et dons prévus pour le mois.","plan",L,3)}
  ${budgetSection("save","Épargnes","Ce que tu veux mettre de côté chaque mois.","plan",L,4)}`;
}

function vGoals(){
  const goals=S.config.goals||[];const now=new Date();
  return `<div class="page-h" style="--i:0"><div><h1>Objectifs d'épargne</h1><p>Chaque épargne liée à un objectif le fait avancer.</p></div><button class="btn primary" data-act="goal-new" type="button">${ms("add")}Nouvel objectif</button></div>
  ${goals.length?`<div class="goals" style="--i:1">${goals.map(g=>{
    const sv=goalSaved(g);const pct=g.target?sv/g.target*100:0;const rest=Math.max(0,g.target-sv);
    let monthly="",dl="Sans échéance";
    if(g.deadline){const [y,m]=g.deadline.split("-").map(Number);dl=`D'ici ${MONTHS[m-1]} ${y}`;const ml=(y*12+m-1)-(now.getFullYear()*12+now.getMonth());monthly=rest<=0?"—":ml>0?fmt(rest/ml):"Échéance passée";}
    const done=pct>=100;
    return `<article class="card goal"><div class="goal-top"><div class="ring">${ring(pct,76,"var(--save)","var(--surface-3)",3.2)}<div class="lbl">${done?ms("check",1):Math.round(pct)+"%"}</div></div><div class="goal-meta"><strong>${ms(g.icon||"flag")} ${esc(g.name)}</strong><span class="num">${fmt(sv)} sur ${fmt(g.target)}</span><span>${dl}</span>${done?`<span><span class="badge">${ms("celebration")}Objectif atteint</span></span>`:""}</div></div>
    <div class="goal-facts"><div class="fact"><small>Reste à épargner</small><strong>${fmt(rest)}</strong></div><div class="fact"><small>Par mois pour y arriver</small><strong>${monthly||"—"}</strong></div></div>
    <div class="goal-acts"><button class="btn primary sm" data-act="goal-fund" data-id="${g.id}" type="button">${ms("add")}Alimenter</button><button class="btn sm" data-act="goal-edit" data-id="${g.id}" type="button">${ms("edit")}Modifier</button></div></article>`;}).join("")}</div>`
  :`<section class="card" style="--i:1">${emptyHtml("flag","Donne un but à ton épargne","Un fonds d'urgence, du matériel, un voyage : fixe un montant et une date, Azur calcule combien mettre de côté chaque mois.",`<button class="btn primary" data-act="goal-new" type="button">${ms("add")}Créer mon premier objectif</button>`)}</section>`}`;
}

function vStats(){
  const p=period(),L=inPeriod(p),s=sums(L),pp=period(ui.offset-1),prev=sums(inPeriod(pp));
  const today=todayISO();const elapsed=ui.offset===0?Math.max(1,Math.round((parseISO(today)-p.startD)/864e5)+1):p.days;
  const rate=s.in?s.save/s.in*100:0,prate=prev.in?prev.save/prev.in*100:0;
  const bc=byCat(L,"out");const outCats=Object.entries(bc).map(([id,v])=>({c:catOf({type:"out",cat:id}),v})).sort((a,b)=>b.v-a.v);
  const tot=outCats.reduce((a,x)=>a+x.v,0);
  let acc=0;const segs=outCats.map((x,i)=>{const len=tot?x.v/tot*100:0;const seg=`<circle class="seg" cx="100" cy="100" r="74" fill="none" style="stroke:${PALETTE[i%PALETTE.length]};stroke-dashoffset:${-acc};animation-delay:${i*60}ms" stroke-width="26" pathLength="100" stroke-dasharray="${Math.max(0,len-(outCats.length>1?.6:0))} ${100-Math.max(0,len-(outCats.length>1?.6:0))}"><title>${esc(x.c.label)} : ${fmt(x.v)}</title></circle>`;acc+=len;return seg;}).join("");
  const months=[5,4,3,2,1,0].map(k=>{const pr=period(ui.offset-k);const ss=sums(inPeriod(pr));return {l:pr.short,in:ss.in,out:ss.outflow};});
  const max=Math.max(1,...months.flatMap(m=>[m.in,m.out]));
  const W=640,H=230,L0=52,B=28,T=12,cw=(W-L0-8)/6,bw=Math.min(26,cw/3.2);
  const y=v=>T+(H-T-B)*(1-v/max);
  const grid=[0,.5,1].map(f=>`<line x1="${L0}" x2="${W-4}" y1="${y(max*f)}" y2="${y(max*f)}" style="stroke:var(--line)" stroke-dasharray="${f?"3 4":""}"/><text x="${L0-8}" y="${y(max*f)+4}" text-anchor="end">${short(max*f)}</text>`).join("");
  const bars=months.map((m,i)=>{const cx=L0+cw*i+cw/2;return `<rect class="b" x="${cx-bw-2}" y="${y(m.in)}" width="${bw}" height="${Math.max(0,H-B-y(m.in))}" rx="6" style="fill:var(--in);animation-delay:${i*60}ms"><title>Entrées ${m.l} : ${fmt(m.in)}</title></rect><rect class="b" x="${cx+2}" y="${y(m.out)}" width="${bw}" height="${Math.max(0,H-B-y(m.out))}" rx="6" style="fill:var(--accent);animation-delay:${i*60+30}ms"><title>Sorties ${m.l} : ${fmt(m.out)}</title></rect><text x="${cx}" y="${H-8}" text-anchor="middle" style="${i===5?"fill:var(--fg);font-weight:600":""}">${m.l}</text>`;}).join("");
  return `<div class="page-h" style="--i:0"><div><h1>Statistiques</h1><p>${esc(p.label)} comparé à ${esc(pp.label.toLowerCase())}</p></div><button class="btn" data-nav="review" type="button">${ms("summarize")}Bilan du mois</button></div>
  <div class="kpis" style="--i:1">
    <div class="kpi"><small>Entrées</small><strong>${fmt(s.in)}</strong>${deltaHtml(s.in,prev.in,true)}</div>
    <div class="kpi"><small>Sorties</small><strong>${fmt(s.outflow)}</strong>${deltaHtml(s.outflow,prev.outflow,false)}</div>
    <div class="kpi"><small>Taux d'épargne</small><strong>${Math.round(rate)} %</strong><span class="delta ${rate>=prate?"good":"bad"}">${prev.in?(rate>=prate?"+":"−")+Math.abs(Math.round(rate-prate))+" pts":"—"}</span></div>
    <div class="kpi"><small>Dépense moyenne par jour</small><strong>${fmt(s.out/elapsed)}</strong><span class="delta flat">sur ${elapsed} jour${elapsed>1?"s":""}</span></div>
  </div>
  <div class="grid-2">
    <section class="card" style="--i:2"><div class="card-h"><h2>Où part l'argent</h2><span class="small muted">Dépenses</span></div>
      ${tot?`<div class="donut-wrap"><div class="donut"><svg viewBox="0 0 200 200" role="img" aria-label="Répartition des dépenses"><circle cx="100" cy="100" r="74" fill="none" style="stroke:var(--surface-3)" stroke-width="26"/>${segs}</svg><div class="lbl"><div><strong class="num">${short(tot)}</strong><small>${cur().sym} dépensés</small></div></div></div>
      <div class="legend">${outCats.slice(0,8).map((x,i)=>`<div class="lg" style="--c:${PALETTE[i%PALETTE.length]}"><i></i><span>${esc(x.c.label)}</span><b>${short(x.v)}</b><em>${Math.round(x.v/tot*100)} %</em></div>`).join("")}${outCats.length>8?`<div class="small muted">+ ${outCats.length-8} autres catégories</div>`:""}</div></div>`:emptyHtml("donut_large","Pas encore de dépenses","Les dépenses du mois apparaîtront ici par catégorie.")}
    </section>
    <section class="card" style="--i:3"><div class="card-h"><h2>Sur six mois</h2><div class="legend-inline"><span style="--c:var(--in)"><i></i>Entrées</span><span style="--c:var(--accent)"><i></i>Sorties</span></div></div>
      <div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Entrées et sorties sur six mois">${grid}${bars}</svg></div>
    </section>
  </div>
  <section class="card" style="--i:4"><div class="card-h"><h2>Mois par mois</h2><span class="small muted">vs ${esc(pp.label.toLowerCase())}</span></div>
    ${ORDER.map(t=>{const T=TYPES[t];return `<div class="cmp-row"><span class="ic" style="--c:${T.color}">${ms(T.icon)}</span><div><strong style="font-weight:500">${T.plural}</strong><div>${deltaHtml(s[t],prev[t],t==="in"||t==="save")}</div></div><div><b>${fmt(s[t])}</b><small>avant : ${fmt(prev[t])}</small></div></div>`;}).join("")}
  </section>`;
}

function vSettings(){
  const c=S.config;
  return `<div class="page-h" style="--i:0"><div><h1>Paramètres</h1><p>Personnalise Azur et garde tes données en sécurité.</p></div></div>
  <section class="card set-sec" style="--i:1"><h2>Mon compte</h2>
    <div class="status"><span class="avatar lg">${esc(initials(session.user.displayName))}</span><div style="min-width:0"><strong>${esc(session.user.displayName)}</strong><p class="small muted">${session.user.kind==="email"?"Compte Gmail":"Compte téléphone"} · ${esc(session.user.masked)}</p></div></div>
    <div class="set-row"><div><strong>Nom affiché</strong><small>Visible sur l'écran de connexion de cet ordinateur</small></div><button class="btn" data-act="acc-rename" type="button">${ms("badge")}Modifier</button></div>
    <div class="set-row"><div><strong>Mot de passe</strong><small>Change-le régulièrement et ne le partage avec personne</small></div><button class="btn" data-act="acc-password" type="button">${ms("password")}Changer</button></div>
    <div class="set-row"><div><strong>Code de secours</strong><small>Il permet de choisir un nouveau mot de passe si tu l'oublies</small></div><button class="btn" data-act="acc-code" type="button">${ms("key")}Nouveau code</button></div>
    <div class="set-row"><div><strong>Se déconnecter</strong><small>Retour à l'écran de connexion</small></div><button class="btn" data-act="logout" type="button">${ms("logout")}Se déconnecter</button></div>
  </section>
  <section class="card set-sec" style="--i:1"><h2>Stockage</h2>
    <div class="status"><span class="ic" style="--c:var(--in)">${ms("database")}</span><div><strong>Base de données locale</strong><p class="small muted">Tes données sont enregistrées dans un fichier sur cet ordinateur, séparées de celles des autres comptes. Rien n'est envoyé sur Internet. Fais une sauvegarde de temps en temps, par exemple sur une clé USB.</p></div></div>
    <div class="btn-row"><button class="btn sm" data-act="show-db" type="button">${ms("folder_open")}Afficher le fichier de la base</button></div>
  </section>
  <section class="card set-sec" style="--i:2"><h2>Préférences</h2>
    <div class="set-row"><div><strong>Devise</strong><small>Utilisée pour tous les montants</small></div><select class="input" id="set-currency" data-set="currency">${Object.entries(CURRENCIES).map(([k,v])=>`<option value="${k}" ${c.currency===k?"selected":""}>${v.name}</option>`).join("")}</select></div>
    <div class="set-row"><div><strong>Début du mois budgétaire</strong><small>Par exemple le jour où tombe ton salaire</small></div><select class="input" id="set-start" data-set="startDay">${Array.from({length:28},(_,i)=>`<option value="${i+1}" ${+c.startDay===i+1?"selected":""}>Le ${i+1}${i===0?"er":""} du mois</option>`).join("")}</select></div>
    <div class="set-row"><div><strong>Apparence</strong><small>Le mode sombre est la signature d'Azur</small></div><div class="seg-ctl" role="group" aria-label="Apparence">${[["system","Auto"],["dark","Sombre"],["light","Clair"]].map(([k,l])=>`<button type="button" data-act="theme" data-theme-val="${k}" aria-pressed="${c.theme===k}">${l}</button>`).join("")}</div></div>
  </section>
  <section class="card set-sec" style="--i:3"><div class="card-h" style="margin:0"><h2>Catégories</h2><button class="btn sm" data-act="cat-new" type="button">${ms("add")}Ajouter</button></div>
    <p class="small muted" style="margin-top:-6px">Touche une catégorie pour changer son nom ou son icône.</p>
    ${ORDER.map(t=>`<div class="cat-group"><span class="label">${TYPES[t].plural}</span><div class="chips">${cats(t).map(x=>`<span class="cat-chip" style="--c:${TYPES[t].color}"><button type="button" class="cat-edit" data-act="cat-edit" data-type="${t}" data-id="${x.id}" aria-label="Renommer ${esc(x.label)}">${ms(x.icon)}${esc(x.label)}${ms("edit")}</button>${x.custom?`<button type="button" data-act="cat-del" data-type="${t}" data-id="${x.id}" aria-label="Supprimer ${esc(x.label)}">${ms("close")}</button>`:""}</span>`).join("")}</div></div>`).join("")}
  </section>
  <section class="card set-sec" style="--i:4;--tc:var(--gift)"><h2>Dîme et répartition</h2>
    <div class="set-row"><div><strong>Proposer la dîme</strong><small>À chaque entrée, Azur calcule la dîme et te propose de l'enregistrer</small></div><label class="switch"><span class="sr">Proposer la dîme</span><input type="checkbox" id="set-tithe" data-cfg="tithe" ${(c.tithe||{}).on!==false?"checked":""}><span class="tr"></span></label></div>
    <div class="set-row"><div><strong>Pourcentage de la dîme</strong><small>Appliqué au montant de chaque entrée</small></div><select class="input" id="set-rate" data-cfg="rate">${[5,10,12,15,20,25,30].map(r=>`<option value="${r}" ${+((c.tithe||{}).rate||10)===r?"selected":""}>${r} %</option>`).join("")}</select></div>
    <div class="set-row"><div><strong>Répartir chaque entrée</strong><small>Propose de verser tes semences et tes épargnes selon tes budgets du mois</small></div><label class="switch"><span class="sr">Répartir chaque entrée</span><input type="checkbox" id="set-split" data-cfg="split" ${c.split!==false?"checked":""}><span class="tr"></span></label></div>
  </section>
  <section class="card set-sec" style="--i:5"><h2>Données</h2>
    <div class="set-row"><div><strong>Exporter en tableur</strong><small>Toutes tes opérations au format CSV, lisible dans Excel ou Google Sheets</small></div><button class="btn" data-act="export-csv" type="button">${ms("table_view")}Exporter</button></div>
    <div class="set-row"><div><strong>Sauvegarde complète</strong><small>Un fichier à garder pour restaurer Azur plus tard</small></div><div class="btn-row"><button class="btn" data-act="export-json" type="button">${ms("download")}Sauvegarder</button><button class="btn" data-act="import" type="button">${ms("upload")}Restaurer</button></div></div>
    <div class="set-row"><div><strong>Données d'exemple</strong><small>${c.demo?"Des exemples sont chargés":"Pour découvrir l'app avant de saisir tes chiffres"}</small></div>${c.demo?`<button class="btn" data-act="demo-clear" type="button">Effacer les exemples</button>`:`<button class="btn" data-act="demo-load" type="button">${ms("auto_awesome")}Charger</button>`}</div>
    <div class="set-row"><div><strong>Tout effacer</strong><small>Supprime toutes les opérations, plafonds et objectifs de ce compte</small></div><button class="btn danger" data-act="wipe" type="button">${ms("delete_forever")}Tout effacer</button></div>
    <div class="set-row"><div><strong>Supprimer mon compte</strong><small>Supprime le compte et toutes ses données de cet ordinateur</small></div><button class="btn danger" data-act="acc-delete" type="button">${ms("person_remove")}Supprimer</button></div>
  </section>
  <p class="small muted" style="text-align:center;padding:8px 0 4px">Azur ${esc(ui.version||"")} · ton budget, clair comme le ciel</p>`;
}

/* ---------- Rendu ---------- */
function render(soft){
  const v=ui.view;
  $$("[data-nav]").forEach(b=>b.setAttribute("aria-current",b.dataset.nav===v?"page":"false"));
  const p=period();$("#period-label").textContent=p.label;$("#period-range").textContent=p.range;
  $("#period").hidden=(v==="settings"||v==="goals");
  const el=$("#view");
  const focusId=document.activeElement&&document.activeElement.id&&el.contains(document.activeElement)?document.activeElement.id:null;
  const html={home:vHome,ops:vOps,budgets:vBudgets,goals:vGoals,stats:vStats,settings:vSettings,review:vReview}[v]();
  el.classList.remove("enter");
  el.innerHTML=html;
  if(ui.anim&&!soft&&!reduced){void el.offsetWidth;el.classList.add("enter");}
  ui.anim=false;
  if(focusId){const f=document.getElementById(focusId);if(f&&f.tagName==="INPUT"&&f.type!=="search")f.focus();}
  countUp(el);
}
function countUp(root){
  $$("[data-count]",root).forEach(el=>{
    const key=el.dataset.key,to=+el.dataset.count,from=counts[key]??0;counts[key]=to;
    const show=v=>{el.textContent=(v<0?"− ":"")+num(Math.round(v*100)/100);};
    if(reduced||from===to){show(to);return;}
    const t0=performance.now(),d=900;
    const step=t=>{const k=Math.min(1,(t-t0)/d),e=1-Math.pow(1-k,3);show(from+(to-from)*e);if(k<1)requestAnimationFrame(step);};
    requestAnimationFrame(step);
  });
}
function go(view){if(ui.view===view)return;ui.view=view;ui.anim=true;render();window.scrollTo({top:0,behavior:reduced?"auto":"smooth"});}

/* ---------- Toast + feuilles ---------- */
let toastTimer;
function toast(text,action,fn){
  const old=$(".toast");if(old)old.remove();clearTimeout(toastTimer);
  const t=document.createElement("div");t.className="toast";t.setAttribute("role","status");
  t.innerHTML=`<span>${esc(text)}</span>${action?`<button type="button">${esc(action)}</button>`:""}`;
  if(action)t.querySelector("button").onclick=()=>{fn();t.remove();};
  document.body.appendChild(t);
  toastTimer=setTimeout(()=>{t.classList.add("out");setTimeout(()=>t.remove(),250);},action?5000:2800);
}
let sheet=null;
function openSheet(html,ctx,cls){
  closeSheet(true);
  const o=document.createElement("div");o.className="overlay";
  o.innerHTML=`<div class="sheet ${cls||""}" role="dialog" aria-modal="true">${html}</div>`;
  o.addEventListener("click",e=>{if(e.target===o)closeSheet();});
  $("#layer").appendChild(o);sheet={el:o,ctx,prevFocus:document.activeElement};
  document.body.style.overflow="hidden";
  return o.querySelector(".sheet");
}
function closeSheet(now){
  if(!sheet)return;const {el,prevFocus}=sheet;sheet=null;document.body.style.overflow="";
  if(now||reduced){el.remove();}else{el.classList.add("closing");setTimeout(()=>el.remove(),200);}
  if(prevFocus&&prevFocus.focus&&document.contains(prevFocus))try{prevFocus.focus({preventScroll:true});}catch(e){}
}
function confirmBox(title,text,okLabel,fn){
  const sh=openSheet(`<div class="grab"></div><div class="sheet-h"><h2>${esc(title)}</h2></div><p class="muted">${esc(text)}</p><div class="sheet-acts"><button class="btn" type="button" data-act="close">Annuler</button><button class="btn primary" type="button" id="cf-ok" style="flex:1;background:var(--out);box-shadow:none">${esc(okLabel)}</button></div>`,{kind:"confirm"},"dialog");
  sh.style.setProperty("--tc","var(--out)");
  $("#cf-ok",sh).onclick=()=>{closeSheet();fn();};
  $("#cf-ok",sh).focus();
}

/* Transaction */
function openTx(id,preset){
  preset=preset||{};const t=id?findTx(id):null;
  const st={id:t?t.id:null,type:t?t.type:(preset.type||"out"),cat:t?t.cat:(preset.cat||null),pay:t?t.pay:"cash",goal:t?(t.goal||""):(preset.goal||"")};
  const sh=openSheet(`<div class="grab"></div>
    <div class="sheet-h"><h2>${t?"Modifier l'opération":"Nouvelle opération"}</h2><button class="icon-btn" type="button" data-act="close" aria-label="Fermer">${ms("close")}</button></div>
    <div class="types" role="group" aria-label="Type d'opération">${ORDER.map(k=>`<button class="type-btn" type="button" data-sh="type" data-v="${k}" style="--c:${TYPES[k].color}">${ms(TYPES[k].icon)}${TYPES[k].label}</button>`).join("")}</div>
    <div><label class="amount"><span class="sr">Montant</span><input id="f-amount" inputmode="decimal" autocomplete="off" placeholder="0" value="${t?num(t.amount):""}"><span>${cur().sym}</span></label><p class="err" id="e-amount"></p></div>
    <div class="field"><span>Catégorie</span><div class="chips" id="f-cats"></div><p class="err" id="e-cat"></p></div>
    <div class="field" id="f-goal-wrap"></div>
    <div class="row2"><label class="field"><span>Date</span><input class="input" type="date" id="f-date" value="${t?t.date:todayISO()}"></label><label class="field"><span>Note</span><input class="input" id="f-note" maxlength="80" placeholder="Marché de Hédzranawoé" value="${t?esc(t.note||""):""}"></label></div>
    <div class="field"><span>Mode de paiement</span><div class="chips" id="f-pay">${PAYS.map(([k,l,i])=>`<button class="chip" type="button" data-sh="pay" data-v="${k}">${ms(i)}${l}</button>`).join("")}</div></div>
    <label class="switch"><input type="checkbox" id="f-rec" ${t&&t.rec?"checked":""}><span class="tr"></span><span>Répéter chaque mois<br><small class="muted">Pour le loyer, le salaire, les abonnements</small></span></label>
    <div class="sheet-acts">${t?`<button class="btn danger" type="button" data-act="tx-delete" aria-label="Supprimer">${ms("delete")}</button>`:""}<button class="btn primary" type="button" id="f-save" data-act="tx-save"></button></div>`,{kind:"tx",st});
  txDyn();
  setTimeout(()=>{const a=$("#f-amount",sh);if(a&&!t)a.focus();},60);
}
function txDyn(){
  const st=sheet.ctx.st;const sh=$(".sheet",sheet.el);
  sh.style.setProperty("--tc",TYPES[st.type].color);
  $$('[data-sh="type"]',sh).forEach(b=>b.setAttribute("aria-pressed",b.dataset.v===st.type));
  const list=cats(st.type);if(!list.some(c=>c.id===st.cat))st.cat=null;
  $("#f-cats",sh).innerHTML=list.map(c=>`<button class="chip" type="button" data-sh="cat" data-v="${c.id}" aria-pressed="${c.id===st.cat}">${ms(c.icon)}${esc(c.label)}</button>`).join("");
  const goals=S.config.goals||[];
  $("#f-goal-wrap",sh).innerHTML=st.type==="save"&&goals.length?`<span>Objectif lié</span><div class="chips">${[{id:"",name:"Aucun"},...goals].map(g=>`<button class="chip" type="button" data-sh="goal" data-v="${g.id}" aria-pressed="${st.goal===g.id}">${g.id?ms(g.icon||"flag"):""}${esc(g.name)}</button>`).join("")}</div>`:"";
  $$('[data-sh="pay"]',sh).forEach(b=>b.setAttribute("aria-pressed",b.dataset.v===st.pay));
  const lbl={in:"l'entrée",out:"la dépense",save:"l'épargne",gift:"la semence",other:"l'opération"}[st.type];
  $("#f-save",sh).innerHTML=`${ms("check")}${st.id?"Enregistrer":"Ajouter "+lbl}`;
}
function saveTx(){
  const st=sheet.ctx.st;const sh=$(".sheet",sheet.el);
  const amount=Math.round(parseAmt($("#f-amount",sh).value)*100)/100;let ok=true;
  $("#e-amount",sh).textContent=amount>0?"":"Saisis un montant supérieur à zéro.";if(!(amount>0))ok=false;
  $("#e-cat",sh).textContent=st.cat?"":"Choisis une catégorie.";if(!st.cat)ok=false;
  if(!ok){(amount>0?$("#f-cats .chip",sh):$("#f-amount",sh)).focus();return;}
  const old=st.id?findTx(st.id):null;
  const date=$("#f-date",sh).value||todayISO();
  const c=cats(st.type).find(x=>x.id===st.cat);
  const tx={id:old?old.id:rid(),type:st.type,amount,cat:st.cat,catLabel:c?c.label:"",date,note:$("#f-note",sh).value.trim(),pay:st.pay,rec:$("#f-rec",sh).checked,created:old?(old.created||Date.now()):Date.now()};
  if(old&&old.recId)tx.recId=old.recId;
  if(old&&old.demo)tx.demo=true;
  if(st.type==="save"&&st.goal)tx.goal=st.goal;
  const keys=new Set();
  if(old){const om=old.date.slice(0,7);S.tx[om]=(S.tx[om]||[]).filter(x=>x.id!==old.id);keys.add("tx-"+om);}
  const m=date.slice(0,7);(S.tx[m]=S.tx[m]||[]).push(tx);keys.add("tx-"+m);
  const before=tx.goal?(S.config.goals.find(g=>g.id===tx.goal)):null;
  persist([...keys]);
  const fromRect=$("#f-amount",sh).getBoundingClientRect();
  closeSheet();render(true);
  fly(tx,fromRect);
  const sign=tx.type==="in"?1:-1;
  if(before&&goalSaved(before)>=before.target&&goalSaved(before)-amount<before.target)toast(`Bravo, l'objectif « ${before.name} » est atteint`);
  else toast(`${old?"Opération modifiée":"Opération ajoutée"} · ${fmt(sign*amount,true)}`);
  if(!old&&tx.type==="in")setTimeout(()=>{if(!sheet)openSplit(tx.id,true);},500);
}
function fly(tx,from){
  if(reduced)return;
  const target=ui.view==="home"?$(`.mini[data-type="${tx.type}"]`):null;
  const hero=$("#hero");
  if(hero){hero.classList.remove("bump");void hero.offsetWidth;hero.classList.add("bump");}
  if(!target)return;
  const el=document.createElement("div");el.className="fly";el.style.background=getComputedStyle(target).getPropertyValue("--c")||"var(--accent)";
  el.style.background=TYPES[tx.type].color;el.textContent=fmt((tx.type==="in"?1:-1)*tx.amount,true);
  document.body.appendChild(el);
  const r=target.getBoundingClientRect();const w=el.offsetWidth,h=el.offsetHeight;
  const sx=(from&&from.width?from.left+from.width/2:innerWidth/2)-w/2,sy=(from&&from.top>0?from.top:innerHeight-160)-h/2;
  const tx2=r.left+r.width/2-w/2,ty=r.top+r.height/2-h/2;
  const a=el.animate([{transform:`translate(${sx}px,${sy}px) scale(1)`,opacity:1},{transform:`translate(${(sx+tx2)/2}px,${Math.min(sy,ty)-60}px) scale(1.08)`,opacity:1,offset:.45},{transform:`translate(${tx2}px,${ty}px) scale(.4)`,opacity:0}],{duration:850,easing:"cubic-bezier(.3,.7,.3,1)"});
  el.style.left="0";el.style.top="0";
  a.onfinish=()=>{el.remove();target.classList.remove("bump");void target.offsetWidth;target.classList.add("bump");};
}
let lastDeleted=null;
function deleteTx(id){
  const t=findTx(id);if(!t)return;const m=t.date.slice(0,7);
  S.tx[m]=(S.tx[m]||[]).filter(x=>x.id!==id);lastDeleted=t;persist(["tx-"+m]);render(true);
  toast("Opération supprimée","Annuler",()=>{if(!lastDeleted)return;const lm=lastDeleted.date.slice(0,7);(S.tx[lm]=S.tx[lm]||[]).push(lastDeleted);persist(["tx-"+lm]);lastDeleted=null;render(true);});
}

/* Objectif */
function openGoal(id){
  const g=id?(S.config.goals||[]).find(x=>x.id===id):null;
  const st={id:g?g.id:null,icon:g?(g.icon||"flag"):"shield"};
  const sh=openSheet(`<div class="grab"></div>
    <div class="sheet-h"><h2>${g?"Modifier l'objectif":"Nouvel objectif"}</h2><button class="icon-btn" type="button" data-act="close" aria-label="Fermer">${ms("close")}</button></div>
    <label class="field"><span>Nom</span><input class="input" id="g-name" maxlength="40" placeholder="Fonds d'urgence" value="${g?esc(g.name):""}"></label><p class="err" id="e-gname"></p>
    <div class="row2" style="grid-template-columns:1fr 1fr"><label class="field"><span>Montant visé (${cur().sym})</span><input class="input" id="g-target" inputmode="numeric" placeholder="500 000" value="${g?num(g.target):""}"></label><label class="field"><span>Déjà épargné</span><input class="input" id="g-initial" inputmode="numeric" placeholder="0" value="${g&&g.initial?num(g.initial):""}"></label></div><p class="err" id="e-gtarget"></p>
    <label class="field"><span>Échéance (facultatif)</span><input class="input" type="month" id="g-deadline" value="${g?esc(g.deadline||""):""}"></label>
    <div class="field"><span>Icône</span><div class="icon-grid" id="g-icons">${ICONS.map(i=>`<button type="button" data-sh="gicon" data-v="${i}" aria-pressed="${i===st.icon}" aria-label="${i}">${ms(i)}</button>`).join("")}</div></div>
    <div class="sheet-acts">${g?`<button class="btn danger" type="button" data-act="goal-delete" aria-label="Supprimer l'objectif">${ms("delete")}</button>`:""}<button class="btn primary" type="button" data-act="goal-save">${ms("check")}${g?"Enregistrer":"Créer l'objectif"}</button></div>`,{kind:"goal",st});
  sh.style.setProperty("--tc","var(--save)");
  setTimeout(()=>{if(!g)$("#g-name",sh).focus();},60);
}
function saveGoal(){
  const st=sheet.ctx.st;const sh=$(".sheet",sheet.el);
  const name=$("#g-name",sh).value.trim(),target=parseAmt($("#g-target",sh).value),initial=parseAmt($("#g-initial",sh).value);
  $("#e-gname",sh).textContent=name?"":"Donne un nom à ton objectif.";
  $("#e-gtarget",sh).textContent=target>0?"":"Indique le montant à atteindre.";
  if(!name||!(target>0))return;
  const goals=S.config.goals=S.config.goals||[];
  const g={id:st.id||"g-"+rid(),name,target,initial:initial>0?initial:0,deadline:$("#g-deadline",sh).value||"",icon:st.icon};
  const old=goals.find(x=>x.id===g.id);if(old&&old.demo)g.demo=true;
  const i=goals.findIndex(x=>x.id===g.id);if(i>=0)goals[i]=g;else goals.push(g);
  persist(["config"]);closeSheet();render(true);toast(i>=0?"Objectif modifié":"Objectif créé");
}

/* Catégorie */
function openCat(){
  const st={type:"out",icon:"brush"};
  const sh=openSheet(`<div class="grab"></div>
    <div class="sheet-h"><h2>Nouvelle catégorie</h2><button class="icon-btn" type="button" data-act="close" aria-label="Fermer">${ms("close")}</button></div>
    <div class="types" role="group" aria-label="Type">${ORDER.map(k=>`<button class="type-btn" type="button" data-sh="ctype" data-v="${k}" aria-pressed="${k===st.type}" style="--c:${TYPES[k].color}">${ms(TYPES[k].icon)}${TYPES[k].label}</button>`).join("")}</div>
    <label class="field"><span>Nom</span><input class="input" id="c-name" maxlength="32" placeholder="Produits capillaires"></label><p class="err" id="e-cname"></p>
    <div class="field"><span>Icône</span><div class="icon-grid">${ICONS.map(i=>`<button type="button" data-sh="cicon" data-v="${i}" aria-pressed="${i===st.icon}" aria-label="${i}">${ms(i)}</button>`).join("")}</div></div>
    <div class="sheet-acts"><button class="btn primary" type="button" data-act="cat-save">${ms("check")}Ajouter la catégorie</button></div>`,{kind:"cat",st});
  sh.style.setProperty("--tc",TYPES[st.type].color);
  setTimeout(()=>$("#c-name",sh).focus(),60);
}

function openCatEdit(type,id){
  const c=cats(type).find(x=>x.id===id);if(!c)return;const def=DEFAULT_CATS[type].find(d=>d[0]===id);
  const st={type,id,custom:!!c.custom,icon:c.icon,orig:def?def[1]:c.label,origIcon:def?def[2]:c.icon};
  const icons=ICONS.includes(c.icon)?ICONS:[c.icon,...ICONS];
  const changed=def&&(c.label!==def[1]||c.icon!==def[2]);
  const sh=openSheet(`<div class="grab"></div>
    <div class="sheet-h"><h2>Renommer la catégorie</h2><button class="icon-btn" type="button" data-act="close" aria-label="Fermer">${ms("close")}</button></div>
    <p class="small muted">${TYPES[type].plural}${def&&c.label!==def[1]?` · nom d'origine : ${esc(def[1])}`:""}</p>
    <label class="field"><span>Nom</span><input class="input" id="ce-name" maxlength="32" value="${esc(c.label)}"></label><p class="err" id="e-cename"></p>
    <div class="field"><span>Icône</span><div class="icon-grid">${icons.map(i=>`<button type="button" data-sh="cicon" data-v="${i}" aria-pressed="${i===st.icon}" aria-label="${i}">${ms(i)}</button>`).join("")}</div></div>
    <div class="sheet-acts">${changed?`<button class="btn" type="button" data-act="catedit-reset">${ms("restart_alt")}Nom d'origine</button>`:""}<button class="btn primary" type="button" data-act="catedit-save">${ms("check")}Enregistrer</button></div>`,{kind:"catedit",st});
  sh.style.setProperty("--tc",TYPES[type].color);
  setTimeout(()=>{const i=$("#ce-name",sh);if(i){i.focus();i.select();}},60);
}

/* Répartition d'une entrée (dîme + budgets) */
function splitLines(entry,auto){
  const L=inPeriod(period(0)).filter(t=>t.id!==entry.id);const tc=S.config.tithe||{on:true,rate:10};const rate=+tc.rate||10;
  const lines=[];let left=entry.amount;
  if(tc.on!==false){const c=cats("gift").find(x=>x.id==="dime");if(c){const a=Math.round(entry.amount*rate/100);lines.push({type:"gift",cat:"dime",label:c.label,icon:c.icon,amount:a,why:`${rate} % de ${fmt(entry.amount)}`});left-=a;}}
  if(!auto||S.config.split!==false){
    ["gift","save"].forEach(type=>{const sp=byCat(L,type);budgetIds(type).forEach(id=>{if(id==="dime"&&tc.on!==false)return;const c=cats(type).find(x=>x.id===id);const rem=S.config.budgets[id]-(sp[id]||0);if(rem<=0||left<=0)return;const a=Math.min(rem,left);left-=a;lines.push({type,cat:id,label:c.label,icon:c.icon,amount:a,why:`Reste ${fmt(rem)} à verser ce mois`});});});
  }
  return lines;
}
function openSplit(entryId,auto){
  const e=findTx(entryId);if(!e)return;const lines=splitLines(e,auto);
  if(!lines.length){if(!auto)toast("Rien à répartir : active la dîme ou fixe des montants pour tes semences et épargnes.");return;}
  const sh=openSheet(`<div class="grab"></div>
    <div class="sheet-h"><h2>Répartir cette entrée</h2><button class="icon-btn" type="button" data-act="close" aria-label="Fermer">${ms("close")}</button></div>
    <p class="muted">${esc(catOf(e).label)} de <strong style="color:var(--fg)">${fmt(e.amount)}</strong>. Voici ce que je propose d'enregistrer tout de suite, selon ta dîme et tes budgets. Ajuste les montants si besoin.</p>
    <div>${lines.map((l,i)=>`<div class="split-row" id="spr-${i}"><input type="checkbox" class="ck" id="sp-ck-${i}" data-split="${i}" checked aria-label="Inclure ${esc(l.label)}"><span class="ic" style="--c:${TYPES[l.type].color}">${ms(l.icon)}</span><label for="sp-ck-${i}" style="min-width:0;cursor:pointer"><strong>${esc(l.label)}</strong><small>${l.why}</small></label><input class="input b-input" id="sp-amt-${i}" data-split-amt="${i}" inputmode="numeric" value="${num(l.amount)}" aria-label="Montant ${esc(l.label)}"></div>`).join("")}</div>
    <div class="split-sum"><span>Réparti</span><b id="sp-total"></b><span>Reste disponible sur l'entrée</span><b id="sp-left"></b></div>
    <p class="err" id="e-split"></p>
    <div class="sheet-acts"><button class="btn" type="button" data-act="close">Plus tard</button><button class="btn primary" type="button" id="sp-go" data-act="split-confirm"></button></div>`,{kind:"split",st:{entry:e,lines}});
  sh.style.setProperty("--tc","var(--gift)");splitRecalc();
}
function splitRecalc(){
  if(!sheet||sheet.ctx.kind!=="split")return;const {entry,lines}=sheet.ctx.st;let tot=0,n=0;
  lines.forEach((l,i)=>{const on=$("#sp-ck-"+i).checked;$("#spr-"+i).classList.toggle("off",!on);if(on){const v=parseAmt($("#sp-amt-"+i).value);if(v>0){tot+=v;n++;}}});
  $("#sp-total").textContent=fmt(tot);const lf=entry.amount-tot;$("#sp-left").textContent=fmt(lf);$("#sp-left").className=lf<0?"bad":"";
  $("#sp-go").innerHTML=`${ms("check")}${n?`Enregistrer ${n} opération${n>1?"s":""}`:"Rien à enregistrer"}`;$("#e-split").textContent="";
}
function confirmSplit(){
  const {entry,lines}=sheet.ctx.st;const out=[];
  lines.forEach((l,i)=>{if(!$("#sp-ck-"+i).checked)return;const v=Math.round(parseAmt($("#sp-amt-"+i).value)*100)/100;if(v>0)out.push({...l,amount:v});});
  if(!out.length){$("#e-split").textContent="Coche au moins une ligne avec un montant.";return;}
  const m=entry.date.slice(0,7);S.tx[m]=S.tx[m]||[];
  out.forEach((l,i)=>S.tx[m].push({id:rid(),type:l.type,amount:l.amount,cat:l.cat,catLabel:l.label,date:entry.date,note:`Répartition · ${catOf(entry).label}`,pay:entry.pay,rec:false,created:Date.now()+i,from:entry.id,...(entry.demo?{demo:true}:{})}));
  persist(["tx-"+m]);closeSheet();render(true);
  toast(`${out.length} opération${out.length>1?"s":""} enregistrée${out.length>1?"s":""} · ${fmt(-out.reduce((a,l)=>a+l.amount,0),true)}`);
}

/* Bilan de fin de mois */
function niceUp(v){if(cur().dec)return Math.ceil(v/10)*10;return v<5000?Math.ceil(v/500)*500:Math.ceil(v/1000)*1000;}
function vReview(){
  const p=period(),L=inPeriod(p),s=sums(L),pp=period(ui.offset-1),PL=inPeriod(pp),prev=sums(PL);
  const spent=byCat(L,"out"),pspent=byCat(PL,"out");const good=[],watch=[];
  const item=(icon,color,title,sub)=>`<div class="rv"><span class="ic" style="--c:${color}">${ms(icon)}</span><div><strong>${title}</strong>${sub?`<small>${sub}</small>`:""}</div></div>`;
  if(s.in){if(s.net>=0)good.push(item("account_balance_wallet","var(--in)",`Solde positif : ${fmt(s.net)}`,"Tes entrées ont couvert toutes tes sorties."));else watch.push(item("trending_down","var(--out)",`Solde négatif : ${fmt(s.net)}`,"Les sorties ont dépassé les entrées ce mois-ci."));}
  const rate=s.in?s.save/s.in*100:0,prate=prev.in?prev.save/prev.in*100:0;
  if(s.in){if(rate>=10)good.push(item("savings","var(--save)",`${Math.round(rate)} % de tes entrées mis de côté`,prev.in?(rate>=prate?`En hausse par rapport à ${esc(pp.label.toLowerCase())} (${Math.round(prate)} %).`:`Un peu moins qu'en ${esc(pp.label.toLowerCase())} (${Math.round(prate)} %).`):""));else watch.push(item("savings","var(--save)",`Seulement ${Math.round(rate)} % épargnés`,"Vise au moins 10 % de tes entrées le mois prochain."));}
  const ids=budgetIds("out");const under=ids.filter(k=>(spent[k]||0)<=S.config.budgets[k]),over=ids.filter(k=>(spent[k]||0)>S.config.budgets[k]);
  const lbl=(t,k)=>esc((cats(t).find(c=>c.id===k)||{label:k}).label);
  if(under.length)good.push(item("check_circle","var(--accent)",`${under.length} plafond${under.length>1?"s":""} respecté${under.length>1?"s":""} sur ${ids.length}`,under.slice(0,5).map(k=>lbl("out",k)).join(", ")+(under.length>5?"…":"")));
  over.forEach(k=>watch.push(item("warning","var(--out)",`${lbl("out",k)} : dépassé de ${fmt(spent[k]-S.config.budgets[k])}`,`${fmt(spent[k])} dépensés pour un plafond de ${fmt(S.config.budgets[k])}.`)));
  ["gift","save"].forEach(t=>{const sp=byCat(L,t);budgetIds(t).forEach(k=>{const b=S.config.budgets[k],v=sp[k]||0;if(v>=b)good.push(item(t==="save"?"savings":"volunteer_activism",TYPES[t].color,`${lbl(t,k)} : objectif du mois atteint`,`${fmt(v)} pour ${fmt(b)} prévus.`));else watch.push(item(t==="save"?"savings":"volunteer_activism",TYPES[t].color,`${lbl(t,k)} : ${fmt(b-v)} manquants`,`${fmt(v)} sur ${fmt(b)} prévus.`));});});
  const big=cur().dec?50:5000;
  cats("out").forEach(c=>{const a=spent[c.id]||0,b=pspent[c.id]||0;if(b>0&&a>b*1.25&&a-b>=big)watch.push(item("trending_up","var(--out)",`${esc(c.label)} en hausse de ${Math.round((a/b-1)*100)} %`,`${fmt(a)} contre ${fmt(b)} le mois d'avant.`));else if(b>0&&a>0&&a<b*.8&&b-a>=big)good.push(item("trending_down","var(--in)",`${esc(c.label)} en baisse de ${Math.round((1-a/b)*100)} %`,`${fmt(a)} contre ${fmt(b)} le mois d'avant.`));});
  const sugg=cats("out").map(c=>{const h=[0,1,2].map(k=>byCat(inPeriod(period(ui.offset-k)),"out")[c.id]||0);const n=h.filter(x=>x>0).length;if(!n)return null;const avg=h.reduce((a,x)=>a+x,0)/n;const sug=niceUp(avg*1.05);const b=S.config.budgets[c.id]||0;if(b&&Math.abs(sug-b)/b<.1)return null;return {c,avg,sug,b,n};}).filter(Boolean);
  const nextP=period(ui.offset+1);
  return `<div class="page-h" style="--i:0"><div><button class="btn ghost" data-nav="stats" type="button" style="margin-left:-10px">${ms("arrow_back")}Statistiques</button><h1 style="margin-top:4px">Bilan de ${esc(p.label.toLowerCase())}</h1><p>${ui.offset===0?"Mois en cours, le bilan s'affine jusqu'au dernier jour.":"Mois terminé."}</p></div></div>
  <div class="review-sum" style="--i:1">
    <div class="kpi"><small>Entrées</small><strong>${fmt(s.in)}</strong>${deltaHtml(s.in,prev.in,true)}</div>
    <div class="kpi"><small>Sorties</small><strong>${fmt(s.outflow)}</strong>${deltaHtml(s.outflow,prev.outflow,false)}</div>
    <div class="kpi"><small>Solde du mois</small><strong class="${s.net<0?"bad":""}">${fmt(s.net)}</strong><span class="delta flat">${L.length} opération${L.length>1?"s":""}</span></div>
    <div class="kpi"><small>Semences versées</small><strong>${fmt(s.gift)}</strong>${deltaHtml(s.gift,prev.gift,true)}</div>
  </div>
  ${L.length?`<div class="grid-2">
    <section class="card" style="--i:2"><div class="card-h"><h2>Ce qui s'est bien passé</h2><span class="ic" style="--c:var(--in);width:32px;height:32px">${ms("thumb_up")}</span></div>${good.length?good.join(""):`<p class="muted small">Rien de marquant pour l'instant. Fixe des plafonds et des montants prévus pour que le bilan te dise où tu en es.</p>`}</section>
    <section class="card" style="--i:3"><div class="card-h"><h2>À surveiller</h2><span class="ic" style="--c:var(--gift);width:32px;height:32px">${ms("visibility")}</span></div>${watch.length?watch.join(""):`<p class="muted small">Aucun point d'alerte. Beau travail.</p>`}</section>
  </div>
  <section class="card" style="--i:4;--tc:var(--accent)"><div class="card-h" style="align-items:flex-start"><div><h2>Plafonds suggérés pour ${esc(nextP.label.toLowerCase())}</h2><p class="small muted" style="margin-top:4px">Calculés sur la moyenne de tes trois derniers mois, avec une petite marge. Coche ceux que tu veux appliquer.</p></div></div>
    ${sugg.length?`<div>${sugg.map(x=>`<label class="sug"><input type="checkbox" class="ck" data-sug="${x.c.id}" data-val="${x.sug}" checked><span class="ic" style="--c:var(--out)">${ms(x.c.icon)}</span><div style="min-width:0"><strong>${esc(x.c.label)}</strong><small>Moyenne sur ${x.n} mois : ${fmt(x.avg)}</small></div><span class="num">${x.b?short(x.b)+" → ":""}<b>${short(x.sug)}</b></span></label>`).join("")}</div><div class="btn-row" style="margin-top:14px"><button class="btn primary" data-act="apply-sug" type="button">${ms("check")}Appliquer les plafonds cochés</button><button class="btn" data-nav="budgets" type="button">Voir les budgets</button></div>`:`<p class="muted small">Tes plafonds actuels collent déjà à tes habitudes. Rien à changer.</p>`}
  </section>`:`<section class="card" style="--i:2">${emptyHtml("summarize","Pas encore de bilan","Aucune opération sur cette période. Change de mois avec les flèches en haut.")}</section>`}`;
}

/* ---------- Données : exemples, export ---------- */
function loadDemo(){
  let seed=11;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
  const now=new Date(),today=todayISO();
  const ym=k=>{const d=new Date(now.getFullYear(),now.getMonth()+k,1);return `${d.getFullYear()}-${pad(d.getMonth()+1)}`;};
  const goals=[{id:"g-urgence",name:"Fonds d'urgence",target:600000,initial:120000,deadline:ym(8),icon:"shield",demo:true},{id:"g-ordi",name:"Nouvel ordinateur",target:450000,initial:0,deadline:ym(6),icon:"devices",demo:true}];
  const plan=[["in","salaire",320000,1,"Virement salaire","bank",0,1],["in","presta",65000,12,"Prestation client","tmoney"],["in","presta",42000,23,"Prestation client","flooz"],["out","loyer",75000,3,"Loyer du mois","cash",0,1],["out","alim",18500,2,"Marché de Hédzranawoé","cash"],["out","alim",14200,9,"Supermarché","bank"],["out","alim",16800,16,"Marché d'Adawlato","cash"],["out","alim",12900,24,"Courses de la semaine","cash"],["out","transport",6000,5,"Zém de la semaine","cash"],["out","transport",7500,14,"Taxi-moto","cash"],["out","transport",5500,21,"Zém","cash"],["out","energie",17500,8,"Facture CEET","tmoney"],["out","telecom",10000,4,"Forfait internet","flooz",0,1],["out","sante",8500,18,"Pharmacie","cash"],["out","loisirs",15000,20,"Sortie au bord de mer","cash"],["out","shopping",22000,26,"Pagne et accessoires","cash"],["out","pro",25000,11,"Matériel de travail","tmoney"],["save","ep1",20000,2,"Virement épargne","bank","g-urgence"],["save","ep2",30000,6,"Tontine du groupe","cash"],["save","ep3",15000,15,"Mise de côté","tmoney","g-ordi"],["gift","dime",32000,2,"Dîme du mois","cash"],["gift","offrande",5000,7,"Offrande du culte","cash"],["gift","offrande",5000,21,"Offrande du culte","cash"],["gift","don",15000,19,"Soutien à la famille","tmoney"],["other","cotisation",5000,10,"Cotisation association","cash"]];
  const keys=new Set();
  for(let k=5;k>=0;k--){
    const base=new Date(now.getFullYear(),now.getMonth()-k,1);const dim=new Date(base.getFullYear(),base.getMonth()+1,0).getDate();
    plan.forEach(([type,cat,amt,day,note,pay,goal,fixed])=>{
      if(cat==="sante"&&rnd()<.5)return;
      const d=iso(new Date(base.getFullYear(),base.getMonth(),Math.min(day,dim)));if(d>today)return;
      const a=fixed?amt:Math.round(amt*(.8+rnd()*.4)/500)*500;
      const c=cats(type).find(x=>x.id===cat);
      const tx={id:rid(),type,amount:a,cat,catLabel:c?c.label:"",date:d,note,pay,rec:false,created:Date.now()+k,demo:true};
      if(goal)tx.goal=goal;
      const m=d.slice(0,7);(S.tx[m]=S.tx[m]||[]).push(tx);keys.add("tx-"+m);
    });
  }
  const demoB={loyer:75000,alim:70000,transport:30000,energie:20000,telecom:10000,loisirs:20000,shopping:25000,pro:30000,sante:15000,dime:32000,offrande:10000,don:15000,ep1:20000,ep2:30000,ep3:15000};
  S.config.demoBudgetKeys=[];
  Object.entries(demoB).forEach(([k,v])=>{if(!(S.config.budgets[k]>0)){S.config.budgets[k]=v;S.config.demoBudgetKeys.push(k);}});
  S.config.goals=[...(S.config.goals||[]).filter(g=>!g.demo),...goals];
  S.config.demo=true;
  persist(["config",...keys]);ui.anim=true;render();toast("Exemples chargés sur six mois");
}
function clearDemo(){
  const keys=new Set(["config"]);
  Object.keys(S.tx).forEach(m=>{const n=S.tx[m].filter(t=>!t.demo);if(n.length!==S.tx[m].length){S.tx[m]=n;keys.add("tx-"+m);}});
  (S.config.demoBudgetKeys||[]).forEach(k=>delete S.config.budgets[k]);
  S.config.goals=(S.config.goals||[]).filter(g=>!g.demo);
  delete S.config.demo;delete S.config.demoBudgetKeys;
  persist([...keys]);ui.anim=true;render();toast("Exemples effacés");
}
async function offerFile(filename,data,label){
  const r=await window.azur.file.save(filename,data);
  if(r.ok&&r.data.saved)toast(`${label} enregistré`);else if(!r.ok)toast("Enregistrement impossible : "+r.error.message);
}
function exportCsv(){
  const rows=[["Date","Type","Catégorie","Montant","Devise","Mode de paiement","Note","Objectif"]];
  allTx().sort((a,b)=>a.date.localeCompare(b.date)).forEach(t=>{const g=t.goal?(S.config.goals.find(x=>x.id===t.goal)||{}).name:"";rows.push([t.date,TYPES[t.type].label,catOf(t).label,String(t.amount).replace(".",","),cur().sym,(PAYS.find(p=>p[0]===t.pay)||["",""])[1],t.note||"",g||""]);});
  const csv="﻿"+rows.map(r=>r.map(v=>/[;"\n]/.test(v)?`"${String(v).replace(/"/g,'""')}"`:v).join(";")).join("\r\n");
  offerFile(`azur-operations-${todayISO()}.csv`,csv,"Export");
}
function exportJson(){offerFile(`azur-sauvegarde-${todayISO()}.json`,JSON.stringify({app:"azur",version:1,saved:new Date().toISOString(),config:S.config,tx:S.tx},null,1),"Sauvegarde");}
function importJson(file){
  const r=new FileReader();
  r.onload=()=>{
    let d;try{d=JSON.parse(r.result);}catch(e){toast("Ce fichier n'est pas une sauvegarde Azur valide.");return;}
    if(!d||d.app!=="azur"||typeof d.tx!=="object"){toast("Ce fichier n'est pas une sauvegarde Azur valide.");return;}
    const n=Object.values(d.tx).flat().length;
    confirmBox("Restaurer la sauvegarde ?",`Tes données actuelles seront remplacées par celles du fichier (${n} opérations).`,"Restaurer",()=>{
      const oldKeys=allKeys();S={config:{...defaultConfig(),...(d.config||{})},tx:d.tx};
      persist([...new Set([...oldKeys,...allKeys()])]);applyTheme();ui.anim=true;render();toast("Sauvegarde restaurée");
    });
  };
  r.readAsText(file);
}

/* ---------- Événements ---------- */
let suppress=false;
document.addEventListener("click",e=>{
  const nav=e.target.closest("[data-nav]");if(nav){go(nav.dataset.nav);return;}
  const sh=e.target.closest("[data-sh]");
  if(sh&&sheet){
    const st=sheet.ctx.st,v=sh.dataset.v,k=sh.dataset.sh;
    if(k==="type"){st.type=v;txDyn();}
    else if(k==="cat"){st.cat=v;$("#e-cat").textContent="";txDyn();}
    else if(k==="pay"){st.pay=v;txDyn();}
    else if(k==="goal"){st.goal=v;txDyn();}
    else if(k==="gicon"||k==="cicon"){st.icon=v;$$(`[data-sh="${k}"]`).forEach(b=>b.setAttribute("aria-pressed",b.dataset.v===v));}
    else if(k==="ctype"){st.type=v;$$('[data-sh="ctype"]').forEach(b=>b.setAttribute("aria-pressed",b.dataset.v===v));$(".sheet").style.setProperty("--tc",TYPES[v].color);}
    return;
  }
  const a=e.target.closest("[data-act]");if(!a)return;
  const act=a.dataset.act,id=a.dataset.id;
  switch(act){
    case "add":openTx(null,ui.view==="ops"&&ui.filter!=="all"?{type:ui.filter}:{});break;
    case "edit":{if(suppress)return;const row=a.closest(".tx-row");if(row&&row.classList.contains("open")){row.classList.remove("open");return;}$$(".tx-row.open").forEach(r=>r.classList.remove("open"));openTx(id);break;}
    case "del":deleteTx(id);break;
    case "close":closeSheet();break;
    case "prev":ui.offset--;ui.anim=true;render();break;
    case "next":ui.offset++;ui.anim=true;render();break;
    case "filter":ui.filter=a.dataset.filter;$$('[data-act="filter"]').forEach(b=>b.setAttribute("aria-pressed",b.dataset.filter===ui.filter));$("#ops-list").innerHTML=opsList();break;
    case "filter-go":ui.filter=a.dataset.filter;go("ops");break;
    case "tx-save":saveTx();break;
    case "tx-delete":{const tid=sheet.ctx.st.id;closeSheet(true);deleteTx(tid);break;}
    case "goal-new":openGoal();break;
    case "goal-edit":openGoal(id);break;
    case "goal-fund":openTx(null,{type:"save",goal:id,cat:"ep1"});break;
    case "goal-save":saveGoal();break;
    case "goal-delete":{const gid=sheet.ctx.st.id;closeSheet(true);const g=S.config.goals.find(x=>x.id===gid);confirmBox("Supprimer l'objectif ?",`« ${g?g.name:""} » sera supprimé. Les opérations d'épargne liées restent dans ton historique.`,"Supprimer",()=>{S.config.goals=S.config.goals.filter(x=>x.id!==gid);persist(["config"]);render(true);toast("Objectif supprimé");});break;}
    case "cat-new":openCat();break;
    case "logout":logout();break;
    case "show-db":window.azur.app.showDb();break;
    case "acc-rename":openAccount("rename");break;
    case "acc-password":openAccount("password");break;
    case "acc-code":openAccount("code");break;
    case "acc-delete":openAccount("delete");break;
    case "acc-submit":submitAccount();break;
    case "copy-code":copyText(a.dataset.code);break;
    case "split-last":{const e=inPeriod(period()).filter(t=>t.type==="in").sort((a,b)=>b.date.localeCompare(a.date)||(b.created||0)-(a.created||0))[0];if(e)openSplit(e.id,false);break;}
    case "split-confirm":confirmSplit();break;
    case "review-prev":ui.offset=-1;go("review");break;
    case "apply-sug":{const sel=$$("[data-sug]").filter(x=>x.checked);if(!sel.length){toast("Coche au moins une suggestion.");return;}sel.forEach(x=>{S.config.budgets[x.dataset.sug]=+x.dataset.val;if(S.config.demoBudgetKeys)S.config.demoBudgetKeys=S.config.demoBudgetKeys.filter(k=>k!==x.dataset.sug);});persist(["config"]);render(true);toast(`${sel.length} plafond${sel.length>1?"s":""} mis à jour`);break;}
    case "cat-edit":openCatEdit(a.dataset.type,id);break;
    case "catedit-save":{const st=sheet.ctx.st;const name=$("#ce-name").value.trim();if(!name){$("#e-cename").textContent="Donne un nom à la catégorie.";$("#ce-name").focus();return;}
      if(st.custom){const c=((S.config.customCats||{})[st.type]||[]).find(x=>x.id===st.id);if(c){c.label=name;c.icon=st.icon;}}
      else{const cn=S.config.catNames=S.config.catNames||{};const ci=S.config.catIcons=S.config.catIcons||{};if(name===st.orig)delete cn[st.id];else cn[st.id]=name;if(st.icon===st.origIcon)delete ci[st.id];else ci[st.id]=st.icon;}
      persist(["config"]);closeSheet();render(true);toast("Catégorie modifiée");break;}
    case "catedit-reset":{const st=sheet.ctx.st;if(S.config.catNames)delete S.config.catNames[st.id];if(S.config.catIcons)delete S.config.catIcons[st.id];persist(["config"]);closeSheet();render(true);toast("Nom d'origine rétabli");break;}
    case "cat-save":{const st=sheet.ctx.st;const name=$("#c-name").value.trim();if(!name){$("#e-cname").textContent="Donne un nom à la catégorie.";$("#c-name").focus();return;}const cc=S.config.customCats=S.config.customCats||{};(cc[st.type]=cc[st.type]||[]).push({id:"c-"+rid(),label:name,icon:st.icon});persist(["config"]);closeSheet();render(true);toast("Catégorie ajoutée");break;}
    case "cat-del":{const t=a.dataset.type;const c=(S.config.customCats[t]||[]).find(x=>x.id===id);confirmBox("Supprimer la catégorie ?",`« ${c?c.label:""} » disparaîtra des choix. Les opérations déjà classées gardent leur nom.`,"Supprimer",()=>{S.config.customCats[t]=S.config.customCats[t].filter(x=>x.id!==id);if(S.config.budgets[id])delete S.config.budgets[id];persist(["config"]);render(true);});break;}
    case "theme":S.config.theme=a.dataset.themeVal;applyTheme();persist(["config"]);render(true);break;
    case "export-csv":exportCsv();break;
    case "export-json":exportJson();break;
    case "import":$("#import-file").click();break;
    case "demo-load":loadDemo();break;
    case "demo-clear":clearDemo();break;
    case "wipe":confirmBox("Tout effacer ?","Toutes tes opérations, plafonds et objectifs seront supprimés. Pense à faire une sauvegarde avant.","Tout effacer",()=>{const old=allKeys();S={config:{...defaultConfig(),currency:S.config.currency,startDay:S.config.startDay,theme:S.config.theme},tx:{}};persist(old.concat("config").filter((v,i,arr)=>arr.indexOf(v)===i));ui.anim=true;render();toast("Toutes les données ont été effacées");});break;
  }
});
document.addEventListener("keydown",e=>{
  if(e.key==="Escape"&&sheet){closeSheet();return;}
  if((e.key==="Enter"||e.key===" ")&&e.target.classList&&e.target.classList.contains("tx-main")){e.preventDefault();e.target.click();}
  if(e.key==="Enter"&&sheet&&e.target.tagName==="INPUT"&&e.target.type!=="checkbox"){const k=sheet.ctx.kind;if(k==="tx")saveTx();else if(k==="goal")saveGoal();else if(k==="cat")$('[data-act="cat-save"]').click();else if(k==="catedit")$('[data-act="catedit-save"]').click();else if(k==="account")submitAccount();}
});
document.addEventListener("input",e=>{
  const t=e.target;
  if(t.id==="q"){ui.q=t.value;$("#ops-list").innerHTML=opsList();return;}
  if(t.id==="f-amount"||t.id==="g-target"||t.id==="g-initial"||t.dataset.budget||t.dataset.splitAmt!==undefined){
    const dec=cur().dec>0&&t.id==="f-amount";
    let v=t.value.replace(/[^\d,.]/g,"").replace(".",",");
    let [i,f]=v.split(",");i=(i||"").replace(/^0+(?=\d)/,"");
    const fi=i?Number(i).toLocaleString("fr-FR").replace(/[  ]/g," "):"";
    t.value=dec&&f!==undefined?`${fi||"0"},${f.slice(0,2)}`:fi;
    if(t.id==="f-amount")$("#e-amount").textContent="";
    if(t.dataset.splitAmt!==undefined)splitRecalc();
  }
});
document.addEventListener("change",e=>{
  const t=e.target;
  if(t.dataset.split!==undefined){splitRecalc();return;}
  if(t.dataset.cfg){const k=t.dataset.cfg;S.config.tithe=S.config.tithe||{on:true,rate:10};if(k==="tithe")S.config.tithe.on=t.checked;else if(k==="rate")S.config.tithe.rate=+t.value;else if(k==="split")S.config.split=t.checked;persist(["config"]);toast("Préférence enregistrée");return;}
  if(t.dataset.budget){const v=parseAmt(t.value);if(v>0)S.config.budgets[t.dataset.budget]=v;else delete S.config.budgets[t.dataset.budget];if(S.config.demoBudgetKeys)S.config.demoBudgetKeys=S.config.demoBudgetKeys.filter(k=>k!==t.dataset.budget);persist(["config"]);render(true);return;}
  if(t.dataset.set){S.config[t.dataset.set]=t.dataset.set==="startDay"?+t.value:t.value;persist(["config"]);ui.offset=0;render(true);toast("Préférence enregistrée");return;}
  if(t.id==="import-file"&&t.files&&t.files[0]){importJson(t.files[0]);t.value="";}
});
/* Glisser pour supprimer */
let sw=null;
document.addEventListener("pointerdown",e=>{const row=e.target.closest(".tx-row[data-swipe]");if(!row||e.target.closest(".tx-del"))return;$$(".tx-row.open").forEach(r=>{if(r!==row)r.classList.remove("open");});sw={row,x:e.clientX,y:e.clientY,dx:0,moved:false,open:row.classList.contains("open")};});
document.addEventListener("pointermove",e=>{
  if(!sw)return;const dx=e.clientX-sw.x,dy=e.clientY-sw.y;
  if(!sw.moved){if(Math.abs(dy)>10&&Math.abs(dy)>Math.abs(dx)){sw=null;return;}if(Math.abs(dx)>8){sw.moved=true;sw.row.classList.add("dragging");}else return;}
  const v=Math.min(0,Math.max(-130,(sw.open?-92:0)+dx));sw.dx=v;sw.row.querySelector(".tx-main").style.transform=`translateX(${v}px)`;
});
const endSwipe=()=>{if(!sw)return;const {row,moved,dx}=sw;sw=null;row.classList.remove("dragging");row.querySelector(".tx-main").style.transform="";if(moved){row.classList.toggle("open",dx<-46);suppress=true;setTimeout(()=>suppress=false,60);}};
document.addEventListener("pointerup",endSwipe);document.addEventListener("pointercancel",endSwipe);
/* Ondulation + lumière */
document.addEventListener("pointerdown",e=>{
  const b=e.target.closest(".btn,.fab,.mini,.type-btn");if(!b||reduced)return;
  const r=b.getBoundingClientRect(),s=Math.max(r.width,r.height);
  const sp=document.createElement("span");sp.className="ripple";sp.style.cssText=`width:${s}px;height:${s}px;left:${e.clientX-r.left-s/2}px;top:${e.clientY-r.top-s/2}px`;
  if(getComputedStyle(b).position==="static")b.style.position="relative";b.style.overflow="hidden";
  b.appendChild(sp);setTimeout(()=>sp.remove(),650);
});
document.addEventListener("pointermove",e=>{const h=e.target.closest&&e.target.closest("#hero");if(!h)return;const r=h.getBoundingClientRect();h.style.setProperty("--mx",(e.clientX-r.left)+"px");h.style.setProperty("--my",(e.clientY-r.top)+"px");});

/* Éclaboussures à chaque clic */
const SPLASH=["#4FA3E8","#7CC4F5","#B5DEFA","#2E6FD8","#818CF8"];
document.addEventListener("pointerdown",e=>{
  if(reduced||e.button>0)return;
  const x=e.clientX,y=e.clientY;
  const host=e.target.closest&&e.target.closest("[style*='--c'],[style*='--tc'],.sheet");
  let tint="";if(host){const cs=getComputedStyle(host);tint=(cs.getPropertyValue("--c")||cs.getPropertyValue("--tc")).trim();}
  if(tint.startsWith("var("))tint=getComputedStyle(document.documentElement).getPropertyValue(tint.slice(4,-1)).trim();
  const colors=tint?[tint,tint,...SPLASH.slice(0,3)]:SPLASH;
  const ring=document.createElement("span");ring.className="splash ring";ring.style.cssText=`width:14px;height:14px;color:${colors[0]}`;
  document.body.appendChild(ring);
  ring.animate([{transform:`translate(${x-7}px,${y-7}px) scale(.4)`,opacity:.9},{transform:`translate(${x-7}px,${y-7}px) scale(4.2)`,opacity:0}],{duration:520,easing:"cubic-bezier(.2,.8,.2,1)"}).onfinish=()=>ring.remove();
  const n=12;
  for(let i=0;i<n;i++){
    const d=document.createElement("span");d.className="splash";
    const s=3+Math.random()*6,ang=(i/n)*Math.PI*2+Math.random()*.5,dist=26+Math.random()*42;
    d.style.cssText=`width:${s}px;height:${s}px;background:${colors[i%colors.length]}`;
    document.body.appendChild(d);
    const dx=Math.cos(ang)*dist,dy=Math.sin(ang)*dist;
    d.animate([{transform:`translate(${x-s/2}px,${y-s/2}px) scale(1)`,opacity:1},{transform:`translate(${x-s/2+dx*.75}px,${y-s/2+dy*.75}px) scale(1)`,opacity:.95,offset:.55},{transform:`translate(${x-s/2+dx}px,${y-s/2+dy+14}px) scale(.2)`,opacity:0}],{duration:560+Math.random()*260,easing:"cubic-bezier(.15,.75,.3,1)"}).onfinish=()=>d.remove();
  }
},{passive:true});

/* ---------- Démarrage ---------- */
/* ---------- Compte ---------- */
const initials=n=>String(n||"?").trim().split(/\s+/).slice(0,2).map(w=>w[0]).join("").toUpperCase()||"?";
const firstName=n=>String(n||"").trim().split(/\s+/)[0]||"";
function renderMe(){const el=$("#rail-me");if(!el||!session.user)return;el.innerHTML=`<span class="avatar">${esc(initials(session.user.displayName))}</span><div><strong>${esc(session.user.displayName)}</strong><small>${esc(session.user.masked)}</small></div><button class="icon-btn" type="button" data-act="logout" aria-label="Se déconnecter" title="Se déconnecter">${ms("logout")}</button>`;}
async function copyText(t){try{await navigator.clipboard.writeText(t);toast("Code copié");}catch(e){toast("Copie impossible, note le code à la main.");}}
function openAccount(mode){
  const pw=(id,label,ac)=>`<label class="field"><span>${label}</span><input class="input" type="password" id="${id}" autocomplete="${ac}"></label>`;
  const body={
    rename:`<label class="field"><span>Nom affiché</span><input class="input" id="ac-name" maxlength="40" value="${esc(session.user.displayName)}"></label>`,
    password:pw("ac-old","Mot de passe actuel","current-password")+pw("ac-new","Nouveau mot de passe","new-password")+pw("ac-new2","Confirme le nouveau mot de passe","new-password")+`<p class="small muted">Au moins 8 caractères, avec au moins une lettre et un chiffre.</p>`,
    code:`<p class="muted">Un nouveau code de secours remplacera l'ancien, qui ne fonctionnera plus.</p>`+pw("ac-old","Mot de passe","current-password"),
    delete:`<p class="muted">Le compte <strong style="color:var(--fg)">${esc(session.user.displayName)}</strong> et toutes ses opérations, plafonds et objectifs seront supprimés de cet ordinateur. Pense à faire une sauvegarde avant.</p>`+pw("ac-old","Mot de passe pour confirmer","current-password")
  }[mode];
  const title={rename:"Modifier le nom",password:"Changer le mot de passe",code:"Nouveau code de secours",delete:"Supprimer mon compte"}[mode];
  const btn={rename:"Enregistrer",password:"Changer le mot de passe",code:"Créer un nouveau code",delete:"Supprimer définitivement"}[mode];
  const sh=openSheet(`<div class="grab"></div><div class="sheet-h"><h2>${title}</h2><button class="icon-btn" type="button" data-act="close" aria-label="Fermer">${ms("close")}</button></div>${body}<p class="err" id="ac-err"></p><div class="sheet-acts"><button class="btn primary" type="button" data-act="acc-submit" ${mode==="delete"?'style="background:var(--out);box-shadow:none"':""}>${btn}</button></div>`,{kind:"account",st:{mode}},"dialog");
  if(mode==="delete")sh.style.setProperty("--tc","var(--out)");
  setTimeout(()=>{const f=sh.querySelector("input");if(f)f.focus();},60);
}
async function submitAccount(){
  if(!sheet||sheet.ctx.kind!=="account")return;const mode=sheet.ctx.st.mode;const err=$("#ac-err");const v=id=>($("#"+id)||{}).value||"";
  err.textContent="";let r;
  if(mode==="rename"){r=await window.azur.account.rename(v("ac-name"));if(r.ok){session.user={...session.user,...r.data};closeSheet();renderMe();render(true);toast("Nom modifié");}}
  else if(mode==="password"){if(v("ac-new")!==v("ac-new2")){err.textContent="Les deux nouveaux mots de passe ne sont pas identiques.";return;}r=await window.azur.account.changePassword(v("ac-old"),v("ac-new"));if(r.ok){closeSheet();toast("Mot de passe changé");}}
  else if(mode==="code"){r=await window.azur.account.newRecoveryCode(v("ac-old"));if(r.ok){openSheet(`<div class="grab"></div><div class="sheet-h"><h2>Ton nouveau code de secours</h2></div><p class="muted">Note-le sur papier et garde-le en lieu sûr. Il ne sera plus jamais affiché.</p><div class="code-box">${esc(r.data)}</div><div class="sheet-acts"><button class="btn" type="button" data-act="copy-code" data-code="${esc(r.data)}">${ms("content_copy")}Copier</button><button class="btn primary" type="button" data-act="close">${ms("check")}C'est noté</button></div>`,{kind:"code"},"dialog");}}
  else if(mode==="delete"){r=await window.azur.account.remove(v("ac-old"));if(r.ok){closeSheet(true);window.AzurApp.stop();window.AzurAuth&&window.AzurAuth.show("Compte supprimé.");return;}}
  if(r&&!r.ok)err.textContent=r.error.message;
}
function lockApp(){window.AzurApp.stop();window.AzurAuth&&window.AzurAuth.show();}
async function logout(){await window.azur.auth.logout();lockApp();}

window.AzurApp={
  async start(user){
    session.user=user;
    const r=await window.azur.data.load();
    const d=r.ok?r.data:{config:null,tx:{}};
    S={config:{...defaultConfig(),...(d.config||{})},tx:d.tx||{}};
    Object.assign(ui,{view:"home",offset:0,filter:"all",q:"",anim:true});
    Object.keys(counts).forEach(k=>delete counts[k]);
    applyTheme();
    $(".app").hidden=false;$(".tabbar").hidden=false;
    renderMe();applyRecurring();render();
    window.scrollTo(0,0);
  },
  stop(){
    session.user=null;closeSheet(true);
    S={config:defaultConfig(),tx:{}};
    $("#view").innerHTML="";$(".app").hidden=true;$(".tabbar").hidden=true;
    const t=$(".toast");if(t)t.remove();
    document.documentElement.removeAttribute("data-theme");
  }
};
window.azur.app.info().then(r=>{if(r.ok)ui.version=r.data.version;});
window.azur.auth.onLocked(()=>{if(session.user)lockApp();});
})();
