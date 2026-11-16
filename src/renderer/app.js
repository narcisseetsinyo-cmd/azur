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
  in:[["salaire","Salaire","work"],["presta","Prestations clients","handshake"],["vente","Vente","storefront"],["primes","Primes et commissions","workspace_premium"],["secondaire","Activité secondaire","work_history"],["loyers-in","Loyers perçus","real_estate_agent"],["aides","Aides reçues","diversity_1"],["rembourse","Remboursement reçu","undo"],["cadeau","Cadeau reçu","redeem"],["reservoir-in","Retrait du réservoir","water_drop"],["autre-in","Autre entrée","add_circle"]],
  out:[["loyer","Loyer","home"],["alim","Alimentation","shopping_basket"],["transport","Transport","two_wheeler"],["energie","Électricité et eau","bolt"],["gaz","Gaz et charbon","local_fire_department"],["telecom","Internet et crédit","wifi"],["sante","Santé","medical_services"],["mutuelle","Mutuelle et assurance","health_and_safety"],["scolarite","Scolarité et fournitures","school"],["cantine","Cantine et garde","child_care"],["entretien","Entretien moto ou voiture","build"],["personnel","Personnel de maison","cleaning_services"],["frais","Frais bancaires et mobile money","account_balance_wallet"],["pro","Matériel pro","content_cut"],["dette","Remboursement de dette","credit_score"],["famille","Famille","family_restroom"],["parents","Soutien aux parents","elderly"],["ceremonies","Cérémonies","diversity_3"],["depannage","Dépannages et aides","support"],["habits","Habillement et soins","checkroom"],["repas","Repas dehors","restaurant"],["loisirs","Loisirs","celebration"],["cadeaux","Cadeaux et fêtes","featured_seasonal_and_gifts"],["abonnements","Abonnements","subscriptions"],["shopping","Shopping","shopping_bag"],["autre-out","Autre dépense","more_horiz"]],
  save:[["ep1","Épargne 1","savings"],["ep2","Épargne 2","account_balance"],["ep3","Épargne 3","shield"],["urgence","Fonds d'urgence","emergency"],["tontine","Tontine","groups"],["reservoir","Réservoir","water_drop"]],
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
function num(n){const c=cur();return Math.abs(n).toLocaleString("fr-FR",{minimumFractionDigits:c.dec,maximumFractionDigits:c.dec}).replace(/[\u202f\u00a0 ]/g,"\u00a0");}
function fmt(n,sign){const pre=sign?(n>0?"+\u00a0":n<0?"\u2212\u00a0":""):(n<0?"\u2212\u00a0":"");return `${pre}${num(n)}\u00a0${cur().sym}`;}
function short(n){const v=Math.abs(n);if(v>=1e6)return (v/1e6).toLocaleString("fr-FR",{maximumFractionDigits:1})+" M";if(v>=1e3)return Math.round(v/1e3).toLocaleString("fr-FR")+" k";return Math.round(v)+"";}
const parseAmt=s=>{const v=parseFloat(String(s).replace(/[\s  ]/g,"").replace(",","."));return isFinite(v)?v:0;};
const C=window.AzurCalc;
function period(offset=ui.offset){
  const p=C.period(offset,S.config.startDay);const sd=Math.min(28,Math.max(1,+S.config.startDay||1));const start=p.startD,end=p.endD;
  p.label=sd===1?`${cap(MONTHS[start.getMonth()])} ${start.getFullYear()}`:`${cap(MONTHS[end.getMonth()])} ${end.getFullYear()}`;
  p.range=sd===1?"":`${start.getDate()} ${MS[start.getMonth()]} – ${end.getDate()} ${MS[end.getMonth()]}`;
  p.short=MS[end.getMonth()];
  return p;
}
const inPeriod=p=>allTx().filter(t=>t.date>=p.start&&t.date<=p.end);
const sums=list=>C.sums(list);
const byCat=(list,type)=>C.byCat(list,type);
const budgetIds=(type="out")=>Object.keys(S.config.budgets||{}).filter(k=>S.config.budgets[k]>0&&cats(type).some(c=>c.id===k));
/* ---------- Enveloppes (méthode du classeur Budget DS) ---------- */
const ENVS=[
  {id:"dieu",label:"Dieu",sub:"Dîme, offrandes et dons",icon:"church",color:"var(--gift)",t:10},
  {id:"noyau",label:"Le noyau",sub:"Épargne, tontine et projets",icon:"savings",color:"var(--save)",t:10},
  {id:"essentiels",label:"Les essentiels",sub:"Logement, marché, transport, factures",icon:"home",color:"var(--accent)",t:50},
  {id:"dettes",label:"Les dettes",sub:"Mensualités de remboursement",icon:"credit_score",color:"var(--out)",t:20},
  {id:"famille",label:"La famille",sub:"Solidarité planifiée",icon:"family_restroom",color:"#F472B6",t:5},
  {id:"vie",label:"La vie",sub:"Personnel, loisirs, imprévus",icon:"celebration",color:"#7CC4F5",t:5}
];
const ENV_OUT={loyer:"essentiels",alim:"essentiels",transport:"essentiels",energie:"essentiels",gaz:"essentiels",telecom:"essentiels",sante:"essentiels",mutuelle:"essentiels",scolarite:"essentiels",cantine:"essentiels",entretien:"essentiels",personnel:"essentiels",frais:"essentiels",pro:"essentiels",dette:"dettes",famille:"famille",parents:"famille",ceremonies:"famille",depannage:"famille",pret:"famille",cotisation:"famille"};
const defEnv=(type,cat)=>type==="in"?null:type==="gift"?"dieu":type==="save"?"noyau":ENV_OUT[cat]||"vie";
const envOf=(type,cat)=>{if(type==="in")return null;return (S.config.envMap||{})[cat]||defEnv(type,cat);};
const envById=id=>ENVS.find(e=>e.id===id);
const activeDebts=()=>(S.config.debts||[]).filter(d=>debtLeft(d)>0);
function envTargets(){
  const t={};ENVS.forEach(e=>t[e.id]=+((S.config.envTargets||{})[e.id]??e.t));
  const noDebt=!activeDebts().length;
  if(noDebt&&t.dettes){t.noyau+=t.dettes;t.dettes=0;}
  return {t,noDebt};
}
function envTotals(list){const o={};ENVS.forEach(e=>o[e.id]=0);list.forEach(t=>{if(t.type==="in")return;const e=envOf(t.type,t.cat);o[e]=(o[e]||0)+(+t.amount||0);});return o;}
const catsVisible=type=>cats(type).filter(c=>!(S.config.catHidden||{})[c.id]);
/* Dettes */
const debtPaid=d=>allTx().filter(t=>t.debt===d.id).reduce((a,t)=>a+(+t.amount||0),0);
const debtLeft=d=>Math.max(0,(+d.total||0)-debtPaid(d));
/* Réservoir (revenus irréguliers) */
const reservoirBalance=()=>allTx().reduce((a,t)=>t.type==="save"&&t.cat==="reservoir"?a+(+t.amount||0):t.type==="in"&&t.cat==="reservoir-in"?a-(+t.amount||0):a,0);
function signalsFor(list){const s=sums(list),e=envTotals(list);return C.signals({income:s.in,net:s.net,debt:e.dettes,core:e.noyau});}
const LEVEL={good:["Vert","var(--in)"],warn:["Orange","var(--gift)"],bad:["Rouge","var(--out)"]};
function signalsHtml(sig,mode){
  if(!sig)return `<p class="small muted">Les voyants s'allument dès que des entrées sont enregistrées sur le mois.</p>`;
  const it=[["solde","Solde","savings","≥ 10 % vert · 0 à 10 % orange · négatif rouge"],["dette","Endettement","credit_score","< 15 % vert · 15 à 33 % orange · > 33 % rouge"],["epargne","Épargne (le noyau)","trending_up","≥ 10 % vert · 5 à 10 % orange · < 5 % rouge"]];
  return `<div class="signals${mode==="compact"?" compact":""}">${it.map(([k,l,ic,rule])=>{const x=sig[k];const [lv,col]=LEVEL[x.level];return `<div class="sig" style="--c:${col}" title="${esc(rule)}"><span class="sig-dot" aria-hidden="true"></span><div><small>${mode==="compact"?({solde:"Solde",dette:"Dettes",epargne:"Épargne"})[k]:l}</small><strong>${Math.round(x.v*100)} %</strong>${mode==="compact"?"":`<em>${rule}</em>`}</div><span class="sr">Voyant ${lv.toLowerCase()}</span></div>`;}).join("")}</div>`;
}
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
  const p=period(0);const keys=new Set();
  // 1. supprimer les copies mensuelles en double (créées avant cette correction, ou par deux appareils)
  const dup=new Set(C.duplicateRecurring(allTx()));
  if(dup.size)Object.keys(S.tx).forEach(m=>{const n=S.tx[m].filter(t=>!dup.has(t.id));if(n.length!==S.tx[m].length){S.tx[m]=n;keys.add("tx-"+m);}});
  // 2. créer les copies du mois avec un identifiant fixe
  C.recurringPlan(allTx(),p).forEach(tx=>{const m=tx.date.slice(0,7);(S.tx[m]=S.tx[m]||[]).push(tx);keys.add("tx-"+m);});
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
/* Bandeaux : adresse à confirmer, sauvegarde à faire */
/* ---------- Accès (administratrice) ---------- */
let accessPending=0,stopAccess=null,accessData=null;
const isAdmin=()=>!!(window.azur.access&&window.azur.access.isAdmin());
function accessBanner(){
  if(!isAdmin()||!accessPending)return "";
  return `<div class="banner accent">${ms("person_add")}<p><strong>${accessPending} demande${accessPending>1?"s":""} d'accès</strong> en attente de ta validation.</p><div class="btn-row"><button class="btn sm" data-act="access-see" type="button">Voir</button></div></div>`;
}
const dShort=ms=>ms?new Date(ms).toLocaleDateString("fr-FR",{day:"numeric",month:"short",year:"numeric"}):"";
function accessCardHtml(){
  const d=accessData;
  if(!d)return `<p class="small muted">Chargement…</p>`;
  if(d.error)return `<p class="small muted">${esc(d.error)}</p><button class="btn sm" data-act="access-load" type="button">${ms("refresh")}Réessayer</button>`;
  const who=x=>`<div style="min-width:0"><strong>${esc(x.name||"Sans nom")}</strong><small>${esc(x.ident||"")}${x.at?" · "+(x.when||"")+dShort(x.at):""}</small></div>`;
  const req=d.requests.map(x=>`<div class="set-row acc-row">${who({...x,when:"demandé le "})}<div class="btn-row">${x.invite&&!x.invite.expired
      ?`<button class="btn sm" data-act="access-show" data-code="${esc(x.invite.code)}" data-name="${esc(x.name||"")}" type="button">${ms("key")}Code envoyé</button>`
      :`<button class="btn sm primary" data-act="access-approve" data-uid="${esc(x.uid)}" type="button">${ms("verified_user")}Valider</button>`}<button class="btn sm ghost" data-act="access-decline" data-uid="${esc(x.uid)}" data-name="${esc(x.name||"")}" type="button" aria-label="Refuser la demande">${ms("close")}</button></div></div>`).join("");
  const gr=d.granted.map(x=>`<div class="set-row acc-row">${who({...x,when:"depuis le "})}<button class="btn sm" data-act="access-revoke" data-uid="${esc(x.uid)}" data-name="${esc(x.name||"")}" type="button">${ms("person_remove")}Retirer</button></div>`).join("");
  return `<h3 class="acc-h">Demandes en attente</h3>${req||`<p class="small muted">Aucune demande pour l'instant.</p>`}
    <h3 class="acc-h">Personnes autorisées</h3>${gr||`<p class="small muted">Personne d'autre que toi pour l'instant.</p>`}
    <p class="small muted" style="margin-top:10px">Chaque code ne marche que pour le compte qui a fait la demande, une seule fois, pendant 7 jours. Valider à nouveau crée un nouveau code et annule l'ancien.</p>`;
}
async function loadAccess(){
  const r=await window.azur.access.overview();
  accessData=r.ok?r.data:{error:r.error.message};
  const el=$("#access-card");if(el)el.innerHTML=accessCardHtml();
}
function showCode(code,name){
  const pretty=code.replace(/^(.{4})(.{4})$/,"$1-$2");
  const msg=`Bonjour${name?" "+name.split(" ")[0]:""}, voici ton code d'accès à Azur : ${pretty}\nSaisis-le dans Azur après t'être connecté(e). Il ne marche qu'avec ton compte, une seule fois, pendant 7 jours.`;
  const sh=openSheet(`<div class="grab"></div><div class="sheet-h"><h2>Code d'accès${name?" de "+esc(name):""}</h2><button class="icon-btn" data-act="close" type="button" aria-label="Fermer">${ms("close")}</button></div>
    <p class="muted">Envoie ce code à ${name?esc(name.split(" ")[0]):"la personne"}. Il ne fonctionne qu'avec son compte et une seule fois.</p>
    <div class="code-show">${esc(pretty)}</div>
    <div class="sheet-acts"><button class="btn" type="button" id="cd-copy">${ms("content_copy")}Copier</button><a class="btn primary" style="flex:1" id="cd-wa" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(msg)}">${ms("send")}Envoyer par WhatsApp</a></div>
    <button class="btn ghost block" type="button" id="cd-cancel">${ms("block")}Annuler ce code</button>`);
  $("#cd-copy",sh).onclick=()=>copyText(pretty);
  $("#cd-cancel",sh).onclick=async()=>{const r=await window.azur.access.cancelInvite(code);closeSheet();toast(r.ok?"Code annulé.":r.error.message);loadAccess();};
}
function verifyBanner(){
  const u=session.user;if(!u||u.kind!=="email"||u.verified!==false)return "";
  return `<div class="banner accent">${ms("mark_email_unread")}<p>Confirme ton adresse <strong>${esc(u.masked)}</strong> : ouvre le lien reçu par e-mail. Sans confirmation, tu ne pourras pas réinitialiser ton mot de passe en cas d'oubli.</p><div class="btn-row"><button class="btn sm" data-act="verify-check" type="button">C'est fait</button><button class="btn sm ghost" data-act="verify-send" type="button">Renvoyer l'e-mail</button></div></div>`;
}
const DAY=864e5;
function backupDue(){
  const txs=allTx().filter(t=>!t.demo);if(!txs.length)return false;
  let snooze=0;try{snooze=+localStorage.getItem("azur:backup-snooze:"+session.user.id)||0;}catch(e){}
  if(Date.now()<snooze)return false;
  const last=+S.config.lastBackup||0;
  if(last)return Date.now()-last>30*DAY;
  const oldest=txs.reduce((a,t)=>Math.min(a,t.created||Date.parse(t.date)||Date.now()),Date.now());
  return Date.now()-oldest>30*DAY;
}
function backupBanner(){
  if(!backupDue())return "";
  const last=+S.config.lastBackup||0;const days=last?Math.floor((Date.now()-last)/DAY):0;
  return `<div class="banner">${ms("backup")}<p>${last?`Ta dernière sauvegarde date de ${days} jours.`:"Tu n'as encore jamais fait de sauvegarde."} Garde une copie de tes chiffres sur une clé USB ou un autre appareil.</p><div class="btn-row"><button class="btn sm" data-act="backup-now" type="button">Sauvegarder</button><button class="btn sm ghost" data-act="backup-later" type="button">Plus tard</button></div></div>`;
}
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
  let planBanner="";
  if(isNow&&!planOf(p)&&!empty){const pd=Math.round((new Date(today.getFullYear(),today.getMonth(),today.getDate())-p.startD)/864e5);if(pd<10)planBanner=`<div class="banner accent">${ms("edit_calendar")}<p>Prépare ton budget de <strong>${esc(p.label.toLowerCase())}</strong> : donne une mission à chaque franc de tes revenus.</p><button class="btn sm" data-nav="plan" type="button">Préparer mon mois</button></div>`;}
  const base=+S.config.baseIncome||0;let resBanner="";
  if(isNow&&base>0&&left<=10){const inc=s.in-(byCat(L,"in")["reservoir-in"]||0);const bal=reservoirBalance();if(inc<base&&bal>0)resBanner=`<div class="banner">${ms("water_drop")}<p>Ce mois, tes revenus sont sous ton revenu de base de <strong>${fmt(base-inc)}</strong>. Ton réservoir contient ${fmt(bal)}.</p><button class="btn sm" data-act="res-take" type="button">Prendre dans le réservoir</button></div>`;}
  const plan=planOf(p);const pT=plan?planTotals(planLines(p,plan,L,false)):null;const pS=pT?planStatus(pT):null;
  return `${accessBanner()}${verifyBanner()}${demoBanner()}${backupBanner()}${reviewBanner}${planBanner}${resBanner}
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
    <section class="card" ${I()}>
      <div class="card-h"><h2>Les voyants</h2><button class="btn ghost" data-nav="plan" type="button">Mon mois</button></div>
      ${signalsHtml(signalsFor(L),"compact")}
      ${pS?`<p class="plan-chip ${pS.cls}">${ms(pS.ic)}<span>Budget du mois : ${pS.txt}</span></p>`:""}
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
  return `<div class="page-h" style="--i:0"><div><h1>Plafonds habituels</h1><p>Ils s'appliquent à tous les mois et servent de base à ton budget mensuel.</p></div><div class="btn-row">${budgetTabs("budgets")}${L.some(t=>t.type==="in")?`<button class="btn" data-act="split-last" type="button">${ms("call_split")}Répartir une entrée</button>`:""}</div></div>
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
  return `<div class="page-h" style="--i:0"><div><h1>Objectifs et dettes</h1><p>Chaque épargne liée à un objectif le fait avancer ; chaque remboursement fait baisser une dette.</p></div><div class="btn-row"><button class="btn" data-act="sim-open" type="button">${ms("calculate")}Simulateur</button><button class="btn primary" data-act="goal-new" type="button">${ms("add")}Nouvel objectif</button></div></div>
  ${goals.length?`<div class="goals" style="--i:1">${goals.map(g=>{
    const sv=goalSaved(g);const pct=g.target?sv/g.target*100:0;const rest=Math.max(0,g.target-sv);
    let monthly="",dl="Sans échéance";
    if(g.deadline){const [y,m]=g.deadline.split("-").map(Number);dl=`D'ici ${MONTHS[m-1]} ${y}`;const ml=(y*12+m-1)-(now.getFullYear()*12+now.getMonth());monthly=rest<=0?"—":ml>0?fmt(rest/ml):"Échéance passée";}
    const done=pct>=100;
    return `<article class="card goal"><div class="goal-top"><div class="ring">${ring(pct,76,"var(--save)","var(--surface-3)",3.2)}<div class="lbl">${done?ms("check",1):Math.round(pct)+"%"}</div></div><div class="goal-meta"><strong>${ms(g.icon||"flag")} ${esc(g.name)}</strong><span class="num">${fmt(sv)} sur ${fmt(g.target)}</span><span>${dl}</span>${done?`<span><span class="badge">${ms("celebration")}Objectif atteint</span></span>`:""}</div></div>
    <div class="goal-facts"><div class="fact"><small>Reste à épargner</small><strong>${fmt(rest)}</strong></div><div class="fact"><small>Par mois pour y arriver</small><strong>${monthly||"—"}</strong></div></div>
    <div class="goal-acts"><button class="btn primary sm" data-act="goal-fund" data-id="${g.id}" type="button">${ms("add")}Alimenter</button><button class="btn sm" data-act="sim-open" data-id="${g.id}" type="button">${ms("calculate")}Simuler</button><button class="btn sm" data-act="goal-edit" data-id="${g.id}" type="button">${ms("edit")}Modifier</button></div></article>`;}).join("")}</div>`
  :`<section class="card" style="--i:1">${emptyHtml("flag","Donne un but à ton épargne","Un fonds d'urgence, du matériel, un voyage : fixe un montant et une date, Azur calcule combien mettre de côté chaque mois.",`<button class="btn primary" data-act="goal-new" type="button">${ms("add")}Créer mon premier objectif</button>`)}</section>`}
  ${debtsHtml()}
  ${reservoirHtml()}
  <button class="card immo-link" style="--i:5" data-nav="immo" type="button"><span class="ic" style="--c:var(--accent)">${ms("home_work")}</span><span style="min-width:0"><strong>Projets immobiliers</strong><small>${(S.config.props||[]).length?`${(S.config.props||[]).length} bien${(S.config.props||[]).length>1?"s":""} suivi${(S.config.props||[]).length>1?"s":""}`:"Location, terrain ou construction : suis entrées, sorties et rentabilité"}</small></span>${ms("chevron_right")}</button>`;
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
  return `<div class="page-h" style="--i:0"><div><h1>Statistiques</h1><p>${esc(p.label)} comparé à ${esc(pp.label.toLowerCase())}</p></div><div class="btn-row"><button class="btn" data-nav="year" type="button">${ms("calendar_view_month")}Vue annuelle</button><button class="btn" data-nav="review" type="button">${ms("summarize")}Bilan du mois</button></div></div>
  <div class="kpis" style="--i:1">
    <div class="kpi"><small>Entrées</small><strong>${fmt(s.in)}</strong>${deltaHtml(s.in,prev.in,true)}</div>
    <div class="kpi"><small>Sorties</small><strong>${fmt(s.outflow)}</strong>${deltaHtml(s.outflow,prev.outflow,false)}</div>
    <div class="kpi"><small>Taux d'épargne</small><strong>${Math.round(rate)} %</strong><span class="delta ${rate>=prate?"good":"bad"}">${prev.in?(rate>=prate?"+":"−")+Math.abs(Math.round(rate-prate))+" pts":"—"}</span></div>
    <div class="kpi"><small>Dépense moyenne par jour</small><strong>${fmt(s.out/elapsed)}</strong><span class="delta flat">sur ${elapsed} jour${elapsed>1?"s":""}</span></div>
  </div>
  <div class="grid-2">
    <section class="card" style="--i:2"><div class="card-h"><h2>Où part l'argent</h2><span class="small muted">Dépenses</span></div>
      ${tot?`<div class="donut-wrap"><div class="donut"><svg viewBox="0 0 200 200" role="img" aria-label="Répartition des dépenses"><circle cx="100" cy="100" r="74" fill="none" style="stroke:var(--surface-3)" stroke-width="26"/>${segs}</svg><div class="lbl"><div><strong class="num">${short(tot)}</strong><small>${cur().sym} dépensés</small></div></div></div>
      <div class="legend">${outCats.slice(0,8).map((x,i)=>`<div class="lg" style="--c:${PALETTE[i%PALETTE.length]}"><i></i><span>${esc(x.c.label)}</span><b>${short(x.v)}</b><em>${Math.round(x.v/tot*100)} %</em></div>`).join("")}${outCats.length>8?`<div class="small muted">+ ${outCats.length-8} autres catégories</div>`:""}</div></div><p class="small muted chart-sum">Plus grosse dépense : <strong style="color:var(--fg)">${esc(outCats[0].c.label)}</strong>, ${fmt(outCats[0].v)} soit ${Math.round(outCats[0].v/tot*100)} % des dépenses du mois.</p>`:emptyHtml("donut_large","Pas encore de dépenses","Les dépenses du mois apparaîtront ici par catégorie.")}
    </section>
    <section class="card" style="--i:3"><div class="card-h"><h2>Sur six mois</h2><div class="legend-inline"><span style="--c:var(--in)"><i></i>Entrées</span><span style="--c:var(--accent)"><i></i>Sorties</span></div></div>
      <div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc("Entrées et sorties sur six mois : "+months.map(m=>`${m.l} entrées ${short(m.in)}, sorties ${short(m.out)}`).join(" ; "))}">${grid}${bars}</svg></div>
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
    ${session.user.kind==="email"?`<div class="set-row"><div><strong>Mot de passe oublié</strong><small>Reçois sur ta boîte Gmail un lien pour choisir un nouveau mot de passe</small></div><button class="btn" data-act="acc-reset" type="button">${ms("mail")}Recevoir le lien</button></div>`:`<div class="set-row"><div><strong>Récupération du mot de passe</strong><small>Un compte téléphone ne peut pas recevoir d'e-mail de réinitialisation. Garde ton mot de passe en lieu sûr.</small></div></div>`}
    <div class="set-row"><div><strong>Se déconnecter</strong><small>Retour à l'écran de connexion</small></div><button class="btn" data-act="logout" type="button">${ms("logout")}Se déconnecter</button></div>
    <div class="set-row"><div><strong>Oublier ce compte sur cet appareil</strong><small>Pour un ordinateur ou un téléphone partagé : retire le compte de la liste et efface la copie de tes données gardée ici. Tes données restent en ligne.</small></div><button class="btn" data-act="acc-forget" type="button">${ms("phonelink_erase")}Oublier</button></div>
  </section>
  ${isAdmin()?`<section class="card set-sec" id="access-sec" style="--i:1"><div class="card-h" style="margin:0"><h2>Accès à Azur</h2><button class="icon-btn" data-act="access-load" type="button" aria-label="Actualiser">${ms("refresh")}</button></div><div id="access-card">${accessCardHtml()}</div></section>`:""}
  <section class="card set-sec" style="--i:1"><h2>Synchronisation</h2>
    <div class="status" id="sync-card">${syncCardHtml()}</div>
    ${window.azur.legacy?`<div class="set-row"><div><strong>Données de la version 1.0</strong><small>Récupère les opérations enregistrées sur cet ordinateur avant la synchronisation</small></div><button class="btn" data-act="legacy-open" type="button">${ms("move_to_inbox")}Importer</button></div>`:""}
  </section>
  ${window.azurNative&&window.azurNative.updates?`<section class="card set-sec" style="--i:2"><h2>Mises à jour</h2><div id="upd-card">${updCardHtml()}</div></section>`:""}
  <section class="card set-sec" style="--i:2"><h2>Préférences</h2>
    <div class="set-row"><div><strong>Devise</strong><small>Utilisée pour tous les montants</small></div><select class="input" id="set-currency" data-set="currency">${Object.entries(CURRENCIES).map(([k,v])=>`<option value="${k}" ${c.currency===k?"selected":""}>${v.name}</option>`).join("")}</select></div>
    <div class="set-row"><div><strong>Début du mois budgétaire</strong><small>Par exemple le jour où tombe ton salaire</small></div><select class="input" id="set-start" data-set="startDay">${Array.from({length:28},(_,i)=>`<option value="${i+1}" ${+c.startDay===i+1?"selected":""}>Le ${i+1}${i===0?"er":""} du mois</option>`).join("")}</select></div>
    <div class="set-row"><div><strong>Éclaboussures au toucher</strong><small>Petit effet de gouttelettes à chaque clic</small></div><label class="switch" style="--tc:var(--accent)"><span class="sr">Éclaboussures au toucher</span><input type="checkbox" id="set-splash" data-cfg="splash" ${c.splash!==false?"checked":""}><span class="tr"></span></label></div>
    <div class="set-row"><div><strong>Apparence</strong><small>Le mode sombre est la signature d'Azur</small></div><div class="seg-ctl" role="group" aria-label="Apparence">${[["system","Auto"],["dark","Sombre"],["light","Clair"]].map(([k,l])=>`<button type="button" data-act="theme" data-theme-val="${k}" aria-pressed="${c.theme===k}">${l}</button>`).join("")}</div></div>
  </section>
  <section class="card set-sec" style="--i:3"><div class="card-h" style="margin:0"><h2>Catégories</h2><button class="btn sm" data-act="cat-new" type="button">${ms("add")}Ajouter</button></div>
    <p class="small muted" style="margin-top:-6px">Touche une catégorie pour changer son nom, son icône ou son enveloppe, ou pour la masquer des choix.</p>
    ${ORDER.map(t=>`<div class="cat-group"><span class="label">${TYPES[t].plural}</span><div class="chips">${cats(t).map(x=>`<span class="cat-chip${(S.config.catHidden||{})[x.id]?" off":""}" style="--c:${TYPES[t].color}"><button type="button" class="cat-edit" data-act="cat-edit" data-type="${t}" data-id="${x.id}" aria-label="Renommer ${esc(x.label)}">${ms(x.icon)}${esc(x.label)}${ms("edit")}</button>${x.custom?`<button type="button" data-act="cat-del" data-type="${t}" data-id="${x.id}" aria-label="Supprimer ${esc(x.label)}">${ms("close")}</button>`:""}</span>`).join("")}</div></div>`).join("")}
  </section>
  <section class="card set-sec" style="--i:4;--tc:var(--gift)"><h2>Dîme et répartition</h2>
    <div class="set-row"><div><strong>Proposer la dîme</strong><small>À chaque entrée, Azur calcule la dîme et te propose de l'enregistrer</small></div><label class="switch"><span class="sr">Proposer la dîme</span><input type="checkbox" id="set-tithe" data-cfg="tithe" ${(c.tithe||{}).on!==false?"checked":""}><span class="tr"></span></label></div>
    <div class="set-row"><div><strong>Pourcentage de la dîme</strong><small>Appliqué au montant de chaque entrée</small></div><select class="input" id="set-rate" data-cfg="rate">${[5,10,12,15,20,25,30].map(r=>`<option value="${r}" ${+((c.tithe||{}).rate||10)===r?"selected":""}>${r} %</option>`).join("")}</select></div>
    <div class="set-row"><div><strong>Répartir chaque entrée</strong><small>Propose de verser tes semences et tes épargnes selon tes budgets du mois</small></div><label class="switch"><span class="sr">Répartir chaque entrée</span><input type="checkbox" id="set-split" data-cfg="split" ${c.split!==false?"checked":""}><span class="tr"></span></label></div>
  </section>
  <section class="card set-sec" style="--i:4;--tc:var(--save)"><h2>Revenus irréguliers</h2>
    <div class="set-row"><div><strong>Revenu de base mensuel</strong><small>Ce que tu t'accordes chaque mois. Au-delà, Azur propose de verser le surplus au réservoir ; les mois creux, il propose de le reprendre. Laisse vide pour désactiver.</small></div><label><span class="sr">Revenu de base mensuel</span><input class="input b-input" data-base inputmode="numeric" placeholder="Désactivé" value="${c.baseIncome?num(c.baseIncome):""}" style="width:150px"></label></div>
    <div class="set-row"><div><strong>Répartition repère des enveloppes</strong><small>${ENVS.map(e=>`${e.label} ${envTargets().t[e.id]} %`).join(" · ")}</small></div><button class="btn" data-act="env-targets" type="button">${ms("percent")}Modifier</button></div>
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
  const navV={plan:"budgets",year:"stats",review:"stats",prop:"immo"}[v]||v;
  $$("[data-nav]").forEach(b=>{if(b.closest(".tabs-bud"))return;b.setAttribute("aria-current",b.dataset.nav===navV||(navV==="immo"&&b.dataset.nav==="goals"&&b.classList.contains("tab"))?"page":"false");});
  const p=period();$("#period-label").textContent=p.label;$("#period-range").textContent=p.range;
  $("#period").hidden=(v==="settings"||v==="goals"||v==="immo"||v==="prop");
  const el=$("#view");
  const focusId=document.activeElement&&document.activeElement.id&&el.contains(document.activeElement)?document.activeElement.id:null;
  const html={home:vHome,ops:vOps,budgets:vBudgets,goals:vGoals,stats:vStats,settings:vSettings,review:vReview,plan:vPlan,year:vYear,immo:vImmo,prop:vProp}[v]();
  el.classList.remove("enter");
  el.innerHTML=html;
  if(v==="settings"&&isAdmin()&&!accessData)loadAccess();
  if(ui.anim&&!soft&&!reduced){void el.offsetWidth;el.classList.add("enter");}
  ui.anim=false;
  if(focusId){const f=document.getElementById(focusId);if(f&&f.tagName==="INPUT"&&f.type!=="search")f.focus();}
  countUp(el);
}
function countUp(root){
  $$("[data-count]",root).forEach(el=>{
    const key=el.dataset.key,to=+el.dataset.count,from=counts[key]??0;counts[key]=to;
    const show=v=>{el.textContent=(v<0?"\u2212\u00a0":"")+num(Math.round(v*100)/100);};
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
  if(!sheet)return;setTimeout(()=>{if(!sheet&&remoteState)applyRemote();},260);const {el,prevFocus}=sheet;sheet=null;document.body.style.overflow="";
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
  const st={id:t?t.id:null,type:t?t.type:(preset.type||"out"),cat:t?t.cat:(preset.cat||null),pay:t?t.pay:"cash",goal:t?(t.goal||""):(preset.goal||""),debt:t?(t.debt||""):(preset.debt||"")};
  const sh=openSheet(`<div class="grab"></div>
    <div class="sheet-h"><h2>${t?"Modifier l'opération":"Nouvelle opération"}</h2><button class="icon-btn" type="button" data-act="close" aria-label="Fermer">${ms("close")}</button></div>
    <div class="types" role="group" aria-label="Type d'opération">${ORDER.map(k=>`<button class="type-btn" type="button" data-sh="type" data-v="${k}" style="--c:${TYPES[k].color}">${ms(TYPES[k].icon)}${TYPES[k].label}</button>`).join("")}</div>
    <div><label class="amount"><span class="sr">Montant</span><input id="f-amount" inputmode="decimal" autocomplete="off" placeholder="0" value="${t?num(t.amount):preset.amount>0?num(preset.amount):""}"><span>${cur().sym}</span></label><p class="err" id="e-amount"></p></div>
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
  const list=cats(st.type).filter(c=>!(S.config.catHidden||{})[c.id]||c.id===st.cat);if(!list.some(c=>c.id===st.cat))st.cat=null;
  $("#f-cats",sh).innerHTML=list.map(c=>`<button class="chip" type="button" data-sh="cat" data-v="${c.id}" aria-pressed="${c.id===st.cat}">${ms(c.icon)}${esc(c.label)}</button>`).join("");
  const goals=S.config.goals||[];
  const debts=(S.config.debts||[]).filter(d=>debtLeft(d)>0||d.id===st.debt);
  $("#f-goal-wrap",sh).innerHTML=st.type==="out"&&st.cat==="dette"?(debts.length?`<span>Dette concernée</span><div class="chips">${[{id:"",name:"Aucune"},...debts].map(d=>`<button class="chip" type="button" data-sh="debt" data-v="${d.id}" aria-pressed="${st.debt===d.id}">${d.id?ms("credit_score"):""}${esc(d.name)}${d.id?` · reste ${short(debtLeft(d))}`:""}</button>`).join("")}</div>`:`<p class="small muted">Enregistre tes dettes dans Objectifs pour suivre le reste dû.</p>`):st.type==="save"&&goals.length?`<span>Objectif lié</span><div class="chips">${[{id:"",name:"Aucun"},...goals].map(g=>`<button class="chip" type="button" data-sh="goal" data-v="${g.id}" aria-pressed="${st.goal===g.id}">${g.id?ms(g.icon||"flag"):""}${esc(g.name)}</button>`).join("")}</div>`:"";
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
  if(st.type==="out"&&st.cat==="dette"&&st.debt)tx.debt=st.debt;
  const debtBefore=tx.debt?(S.config.debts||[]).find(d=>d.id===tx.debt):null;const leftBefore=debtBefore?debtLeft(debtBefore)+(old&&old.debt===tx.debt?+old.amount||0:0):0;
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
  else if(debtBefore&&leftBefore>0&&debtLeft(debtBefore)<=0)toast(`Bravo, la dette « ${debtBefore.name} » est soldée`);
  else toast(`${old?"Opération modifiée":"Opération ajoutée"} · ${fmt(sign*amount,true)}`);
  if(!old&&tx.type==="in"&&tx.cat!=="reservoir-in")setTimeout(()=>{if(!sheet)openSplit(tx.id,true);},500);
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
    <div class="sheet-h"><h2>Modifier la catégorie</h2><button class="icon-btn" type="button" data-act="close" aria-label="Fermer">${ms("close")}</button></div>
    <p class="small muted">${TYPES[type].plural}${def&&c.label!==def[1]?` · nom d'origine : ${esc(def[1])}`:""}</p>
    <label class="field"><span>Nom</span><input class="input" id="ce-name" maxlength="32" value="${esc(c.label)}"></label><p class="err" id="e-cename"></p>
    <div class="field"><span>Icône</span><div class="icon-grid">${icons.map(i=>`<button type="button" data-sh="cicon" data-v="${i}" aria-pressed="${i===st.icon}" aria-label="${i}">${ms(i)}</button>`).join("")}</div></div>
    ${type!=="in"?`<label class="field"><span>Enveloppe</span><select class="input" data-env>${ENVS.map(e=>`<option value="${e.id}" ${envOf(type,id)===e.id?"selected":""}>${e.label}</option>`).join("")}</select></label>`:""}
    ${!c.custom?`<label class="switch"><input type="checkbox" data-hide ${(S.config.catHidden||{})[id]?"":"checked"}><span class="tr"></span><span>Proposer cette catégorie<br><small class="muted">Décoche pour la retirer des choix lors d'une saisie</small></span></label>`:""}
    <div class="sheet-acts">${changed?`<button class="btn" type="button" data-act="catedit-reset">${ms("restart_alt")}Nom d'origine</button>`:""}<button class="btn primary" type="button" data-act="catedit-save">${ms("check")}Enregistrer</button></div>`,{kind:"catedit",st});
  sh.style.setProperty("--tc",TYPES[type].color);
  setTimeout(()=>{const i=$("#ce-name",sh);if(i){i.focus();i.select();}},60);
}

/* Répartition d'une entrée (dîme + budgets) */
function splitLines(entry,auto){
  const budgets=[];["gift","save"].forEach(type=>budgetIds(type).forEach(id=>budgets.push({type,cat:id,amount:S.config.budgets[id]})));
  const r=C.splitPlan({entry,all:allTx(),p:period(0),tithe:S.config.tithe,splitOn:auto?S.config.split:true,budgets});
  const lines=r.lines.map(l=>{const c=cats(l.type).find(x=>x.id===l.cat)||{label:l.cat,icon:"label"};
    const why=l.kind==="dime"?(r.alreadyTotal?`${l.rate} % de ${fmt(entry.amount)}, moins ce qui est déjà versé`:`${l.rate} % de ${fmt(entry.amount)}`):`Reste ${fmt(l.remaining)} à verser ce mois`;
    return {...l,label:c.label,icon:c.icon,why};});
  const base=+S.config.baseIncome||0;
  if(base>0&&entry.cat!=="reservoir-in"){
    const pL=inPeriod(period(0));const monthIncome=pL.filter(t=>t.type==="in"&&t.cat!=="reservoir-in").reduce((a,t)=>a+(+t.amount||0),0);
    const dep=pL.filter(t=>t.type==="save"&&t.cat==="reservoir").reduce((a,t)=>a+(+t.amount||0),0);
    const left=entry.amount-lines.reduce((a,l)=>a+l.amount,0)-(r.alreadyTotal||0);
    const amt=Math.min(left,C.reservoirShare({entryAmount:entry.amount,monthIncome,base,alreadyDeposited:dep}));
    if(amt>0){const c=cats("save").find(x=>x.id==="reservoir");lines.push({type:"save",cat:"reservoir",amount:amt,kind:"reservoir",label:c.label,icon:c.icon,why:`Au-delà de ton revenu de base de ${fmt(base)}`});}
  }
  lines.already=r.alreadyTotal;lines.alreadyCount=r.alreadyCount;
  return lines;
}
function openSplit(entryId,auto){
  const e=findTx(entryId);if(!e)return;const lines=splitLines(e,auto);
  if(!lines.length){if(!auto)toast(lines.alreadyCount?"Cette entrée a déjà été répartie : il ne reste rien à verser.":"Rien à répartir : active la dîme ou fixe des montants pour tes semences et épargnes.");return;}
  const sh=openSheet(`<div class="grab"></div>
    <div class="sheet-h"><h2>Répartir cette entrée</h2><button class="icon-btn" type="button" data-act="close" aria-label="Fermer">${ms("close")}</button></div>
    <p class="muted">${esc(catOf(e).label)} de <strong style="color:var(--fg)">${fmt(e.amount)}</strong>. Voici ce que je propose d'enregistrer tout de suite, selon ta dîme et tes budgets. Ajuste les montants si besoin.</p>${lines.already?`<div class="notice">${ms("info")}<span>Déjà réparti pour cette entrée : ${fmt(lines.already)}. Les montants ci-dessous en tiennent compte.</span></div>`:""}
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
const niceUp=v=>C.niceUp(v,cur().dec);
function reviewData(off=ui.offset){
  const p=period(off),L=inPeriod(p),s=sums(L),pp=period(off-1),PL=inPeriod(pp),prev=sums(PL);
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
  const sugg=cats("out").map(c=>{const h=[0,1,2].map(k=>byCat(inPeriod(period(off-k)),"out")[c.id]||0);const n=h.filter(x=>x>0).length;if(!n)return null;const avg=h.reduce((a,x)=>a+x,0)/n;const sug=niceUp(avg*1.05);const b=S.config.budgets[c.id]||0;if(b&&Math.abs(sug-b)/b<.1)return null;return {c,avg,sug,b,n};}).filter(Boolean);
  const nextP=period(off+1);
  return {p,pp,L,s,prev,good,watch,sugg,nextP,rate,prate,spent};
}
function vReview(){
  const {p,L,s,prev,good,watch,sugg,nextP}=reviewData();
  return `<div class="page-h" style="--i:0"><div><button class="btn ghost" data-nav="stats" type="button" style="margin-left:-10px">${ms("arrow_back")}Statistiques</button><h1 style="margin-top:4px">Bilan de ${esc(p.label.toLowerCase())}</h1><p>${ui.offset===0?"Mois en cours, le bilan s'affine jusqu'au dernier jour.":"Mois terminé."}</p></div>${L.length?`<button class="btn" data-act="print-review" type="button">${ms("print")}Imprimer</button>`:""}</div>
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
  <div class="grid-2">
    <section class="card" style="--i:4"><div class="card-h"><h2>Les voyants</h2></div>${signalsHtml(signalsFor(L))}</section>
    <section class="card" style="--i:4"><div class="card-h"><h2>Les enveloppes</h2><button class="btn ghost" data-nav="plan" type="button">Mon mois</button></div>${envCompareHtml(p,L,s)}</section>
  </div>
  <section class="card" style="--i:5;--tc:var(--accent)"><div class="card-h" style="align-items:flex-start"><div><h2>Plafonds suggérés pour ${esc(nextP.label.toLowerCase())}</h2><p class="small muted" style="margin-top:4px">Calculés sur la moyenne de tes trois derniers mois, avec une petite marge. Coche ceux que tu veux appliquer.</p></div></div>
    ${sugg.length?`<div>${sugg.map(x=>`<label class="sug"><input type="checkbox" class="ck" data-sug="${x.c.id}" data-val="${x.sug}" checked><span class="ic" style="--c:var(--out)">${ms(x.c.icon)}</span><div style="min-width:0"><strong>${esc(x.c.label)}</strong><small>Moyenne sur ${x.n} mois : ${fmt(x.avg)}</small></div><span class="num">${x.b?short(x.b)+" → ":""}<b>${short(x.sug)}</b></span></label>`).join("")}</div><div class="btn-row" style="margin-top:14px"><button class="btn primary" data-act="apply-sug" type="button">${ms("check")}Appliquer les plafonds cochés</button><button class="btn" data-nav="budgets" type="button">Voir les budgets</button></div>`:`<p class="muted small">Tes plafonds actuels collent déjà à tes habitudes. Rien à changer.</p>`}
  </section>`:`<section class="card" style="--i:2">${emptyHtml("summarize","Pas encore de bilan","Aucune opération sur cette période. Change de mois avec les flèches en haut.")}</section>`}`;
}

function envCompareRows(p,L,s){
  const plan=planOf(p);const T=plan?planTotals(planLines(p,plan,L,false)):null;const e=envTotals(L);const {t}=envTargets();
  return ENVS.map(en=>({en,real:e[en.id],part:s.in?e[en.id]/s.in*100:0,target:t[en.id],plan:T?T.env[en.id].plan:null}));
}
function envCompareHtml(p,L,s){
  if(!s.in)return `<p class="small muted">Les parts s'affichent dès que des entrées sont enregistrées.</p>`;
  return `<div class="env-cmp">${envCompareRows(p,L,s).map(r=>`<div class="ec-row" style="--c:${r.en.color}"><span class="ic" style="--c:${r.en.color}">${ms(r.en.icon)}</span><div style="min-width:0"><div class="ml-top"><span>${r.en.label}</span><span><b>${Math.round(r.part)} %</b> · repère ${r.target} %</span></div><div class="bar ec-bar"><i style="--w:${Math.min(100,r.part)}%;--c:${r.en.color}"></i><em style="left:${Math.min(100,r.target)}%" aria-hidden="true"></em></div><small>${fmt(r.real)}${r.plan!==null?` · prévu ${fmt(r.plan)}`:""}</small></div></div>`).join("")}</div>`;
}

/* ---------- Mon mois : prévu et réel, « chaque franc a une mission » ---------- */
const planKey=p=>p.start;
const planOf=p=>(S.config.plans||{})[planKey(p)]||null;
function realBy(L){const o={};L.forEach(t=>{const k=t.debt?"debt:"+t.debt:t.cat;o[k]=(o[k]||0)+(+t.amount||0);if(t.debt)o.dette=(o.dette||0)+(+t.amount||0);});return o;}
function planLines(p,plan,L,all){
  const real=realBy(L);const pl=plan||{};const out={inc:[],env:{}};
  const keep=(k,c)=>all||(pl[k]>0)||(real[k]>0)||(c&&c.always);
  catsVisible("in").forEach(c=>{if(keep(c.id))out.inc.push({k:c.id,label:c.label,icon:c.icon,type:"in",plan:+pl[c.id]||0,real:real[c.id]||0});});
  ENVS.forEach(e=>out.env[e.id]=[]);
  ["gift","save","out","other"].forEach(type=>catsVisible(type).forEach(c=>{
    if(c.id==="dette")return;
    const env=envOf(type,c.id);
    if(keep(c.id,{always:c.id==="dime"&&(S.config.tithe||{}).on!==false}))out.env[env].push({k:c.id,label:c.label,icon:c.icon,type,plan:+pl[c.id]||0,real:real[c.id]||0});
  }));
  (S.config.debts||[]).forEach(d=>{const k="debt:"+d.id;const left=debtLeft(d);if(left>0||pl[k]>0||real[k]>0)out.env.dettes.push({k,label:d.name,icon:"credit_score",type:"out",plan:+pl[k]||0,real:real[k]||0,debt:d});});
  const loose=(real.dette||0)-(S.config.debts||[]).reduce((a,d)=>a+(real["debt:"+d.id]||0),0);
  if(loose>0||pl.dette>0||(all&&!(S.config.debts||[]).length))out.env.dettes.push({k:"dette",label:"Autres remboursements",icon:"credit_score",type:"out",plan:+pl.dette||0,real:Math.max(0,loose)});
  return out;
}
function planTotals(lines){
  const inc=lines.inc.reduce((a,l)=>a+l.plan,0),incR=lines.inc.reduce((a,l)=>a+l.real,0);
  const env={};let tot=0,totR=0;ENVS.forEach(e=>{const a=lines.env[e.id].reduce((x,l)=>x+l.plan,0),b=lines.env[e.id].reduce((x,l)=>x+l.real,0);env[e.id]={plan:a,real:b};tot+=a;totR+=b;});
  return {inc,incR,env,tot,totR,left:inc-tot};
}
function planStatus(T){
  if(!T.inc)return {cls:"flat",ic:"edit_note",txt:"Commence par tes revenus prévus"};
  if(Math.abs(T.left)<0.5)return {cls:"good",ic:"check_circle",txt:"Équilibré : chaque franc a une mission"};
  if(T.left>0)return {cls:"warn",ic:"help",txt:`${fmt(T.left)} sans mission`};
  return {cls:"bad",ic:"error",txt:`À réduire de ${fmt(-T.left)}`};
}
function budgetTabs(v){return `<div class="seg-ctl tabs-bud" role="tablist" aria-label="Budget"><button type="button" role="tab" data-nav="plan" aria-pressed="${v==="plan"}">${ms("edit_calendar")}Mon mois</button><button type="button" role="tab" data-nav="budgets" aria-pressed="${v==="budgets"}">${ms("tune")}Plafonds habituels</button></div>`;}
function planRow(l,cls){
  const pc=l.plan?l.real/l.plan*100:0;const spend=l.type==="out"||l.type==="other";
  const col=spend?(pc>100?"var(--out)":pc>=80?"var(--gift)":"var(--accent)"):(pc>=100?"var(--in)":TYPES[l.type].color);
  const st=!l.plan?(l.real?`Réel ${fmt(l.real)} · rien de prévu`:"Rien de prévu"):spend?(l.real>l.plan?`<span class="bad">Réel ${fmt(l.real)} · dépassé de ${fmt(l.real-l.plan)}</span>`:`Réel ${fmt(l.real)} · reste ${fmt(l.plan-l.real)}`):(l.real>=l.plan?`<span class="good">Réel ${fmt(l.real)} · atteint</span>`:`Réel ${fmt(l.real)} · encore ${fmt(l.plan-l.real)}`);
  return `<div class="b-row plan-row${cls?" "+cls:""}"><span class="ic" style="--c:${TYPES[l.type].color}">${ms(l.icon)}</span><div class="b-main"><div class="b-top"><span class="b-lbl">${esc(l.label)}</span></div>${l.plan?`<div class="bar"><i style="--w:${Math.min(100,pc)}%;--c:${col}"></i></div>`:""}<span class="b-status">${st}</span></div><label><span class="sr">Prévu ${esc(l.label)}</span><input class="input b-input" id="pl-${esc(l.k.replace(/[^\w-]/g,"_"))}" data-plan="${esc(l.k)}" inputmode="numeric" placeholder="Prévu" value="${l.plan?num(l.plan):""}"></label></div>`;
}
function vPlan(){
  const p=period(),L=inPeriod(p),plan=planOf(p);
  if(!plan){
    const prev=planOf(period(ui.offset-1));const hasCaps=["out","gift","save"].some(t=>budgetIds(t).length);
    return `<div class="page-h" style="--i:0"><div><h1>Mon mois</h1><p>Budget de ${esc(p.label.toLowerCase())}${p.range?" · "+p.range:""}</p></div>${budgetTabs("plan")}</div>
    <section class="card plan-intro" style="--i:1"><span class="ic big" style="--c:var(--accent)">${ms("edit_calendar")}</span><div><h2>Prépare ton budget avant le début du mois</h2><p class="muted">Indique tes revenus prévus, puis donne une mission à chaque franc, enveloppe par enveloppe : Dieu, le noyau, les essentiels, les dettes, la famille et la vie. Au fil du mois, Azur compare le prévu et le réel.</p>
      <div class="acts">${prev?`<button class="btn primary" data-act="plan-start" data-from="prev" type="button">${ms("content_copy")}Reprendre le mois précédent</button>`:""}${hasCaps?`<button class="btn ${prev?"":"primary"}" data-act="plan-start" data-from="caps" type="button">${ms("tune")}Partir de mes plafonds</button>`:""}<button class="btn ${prev||hasCaps?"":"primary"}" data-act="plan-start" data-from="zero" type="button">${ms("add")}Partir de zéro</button></div></div></section>
    <section class="card" style="--i:2"><div class="card-h"><h2>La répartition repère</h2><button class="btn ghost sm" data-act="env-targets" type="button">${ms("tune")}Modifier</button></div>${envTargetsHtml()}</section>`;
  }
  const lines=planLines(p,plan,L,ui.planAll),T=planTotals(lines),st=planStatus(T),{t:tg,noDebt}=envTargets();
  const sig=signalsFor(L);const tithe=S.config.tithe||{};const dimeSug=tithe.on!==false&&T.inc?Math.round(T.inc*(+tithe.rate||10)/100):0;
  const dimePlan=+plan.dime||0;
  let i=0;const I=()=>`style="--i:${i++}"`;
  return `<div class="page-h" ${I()}><div><h1>Mon mois</h1><p>Budget de ${esc(p.label.toLowerCase())}${p.range?" · "+p.range:""} · prévu et réel</p></div>${budgetTabs("plan")}</div>
  <section class="card plan-sum ${st.cls}" ${I()}>
    <div class="plan-sum-top"><div><span class="eyebrow">Revenus prévus</span><strong class="num big">${fmt(T.inc)}</strong></div><div><span class="eyebrow">Attribué aux enveloppes</span><strong class="num big">${fmt(T.tot)}</strong></div><div class="plan-state">${ms(st.ic)}<span>${st.txt}</span></div></div>
    <div class="plan-meter" aria-hidden="true">${ENVS.map(e=>T.inc&&T.env[e.id].plan?`<i style="width:${Math.min(100,T.env[e.id].plan/Math.max(T.inc,T.tot)*100)}%;background:${e.color}" title="${esc(e.label)}"></i>`:"").join("")}</div>
    <div class="plan-real"><span>Réel : entrées <b>${fmt(T.incR)}</b></span><span>sorties <b>${fmt(T.totR)}</b></span><span>solde <b class="${T.incR-T.totR<0?"bad":""}">${fmt(T.incR-T.totR)}</b></span></div>
  </section>
  <section class="card" ${I()}><div class="card-h"><h2>Les voyants</h2><span class="small muted">sur le réel du mois</span></div>${signalsHtml(sig)}</section>
  <section class="card env-card" ${I()} style="--ec:var(--in)">
    <div class="env-h"><span class="ic" style="--c:var(--in)">${ms("south_west")}</span><div><h2>Revenus</h2><p class="small muted">Ce que tu prévois de recevoir, net</p></div><div class="env-tot"><strong class="num">${short(T.inc)}</strong><small>réel ${short(T.incR)}</small></div></div>
    ${lines.inc.map(l=>planRow(l)).join("")||`<p class="small muted">Affiche toutes les catégories pour saisir tes revenus prévus.</p>`}
  </section>
  ${ENVS.map(e=>{const rows=lines.env[e.id];const E=T.env[e.id];const part=T.inc?E.plan/T.inc*100:0;const target=tg[e.id];
    const tag=T.inc&&E.plan?`<span class="env-part ${target&&Math.abs(part-target)<=2?"ok":""}">${Math.round(part)} % · repère ${target} %</span>`:`<span class="env-part">repère ${target} %</span>`;
    const extra=e.id==="dieu"&&dimeSug&&Math.round(dimePlan)!==dimeSug?`<div class="notice">${ms("church")}<span>Dîme de ${tithe.rate||10} % sur tes revenus prévus : ${fmt(dimeSug)}.</span><button class="btn sm" data-act="plan-dime" data-v="${dimeSug}" type="button">Appliquer</button></div>`:
      e.id==="dettes"&&noDebt&&!rows.length?`<p class="small muted">Aucune dette en cours : comme le veut la méthode, les ${(S.config.envTargets||{}).dettes??20} % des dettes vont au noyau.</p>`:"";
    return `<section class="card env-card" ${I()} style="--ec:${e.color}"><div class="env-h"><span class="ic" style="--c:${e.color}">${ms(e.icon)}</span><div><h2>${e.label}</h2><p class="small muted">${e.sub}</p></div><div class="env-tot"><strong class="num">${short(E.plan)}</strong><small>réel ${short(E.real)}</small>${tag}</div></div>${extra}${rows.map(l=>planRow(l)).join("")}${e.id==="dettes"?`<button class="btn ghost sm" data-act="debt-new" type="button" style="margin-top:8px">${ms("add")}Ajouter une dette</button>`:""}</section>`;}).join("")}
  <div class="plan-foot" ${I()}>
    <button class="btn" data-act="plan-all" type="button">${ms(ui.planAll?"visibility_off":"visibility")}${ui.planAll?"Masquer les lignes vides":"Afficher toutes les catégories"}</button>
    <button class="btn" data-act="plan-to-caps" type="button">${ms("tune")}En faire mes plafonds habituels</button>
    <button class="btn" data-act="env-targets" type="button">${ms("percent")}Répartition repère</button>
    <button class="btn danger" data-act="plan-clear" type="button">${ms("delete")}Effacer ce budget</button>
  </div>`;
}
function envTargetsHtml(){
  const {t,noDebt}=envTargets();
  return `<div class="env-targets">${ENVS.map(e=>`<div class="et" style="--c:${e.color}"><span class="ic" style="--c:${e.color}">${ms(e.icon)}</span><span>${e.label}</span><b>${t[e.id]} %</b></div>`).join("")}</div><p class="small muted">Une boussole, pas une prison.${noDebt?" Sans dette en cours, la part des dettes s'ajoute au noyau.":""}</p>`;
}
function startPlan(from){
  const p=period(),plans=S.config.plans=S.config.plans||{};let pl={};
  if(from==="prev")pl={...(planOf(period(ui.offset-1))||{})};
  else if(from==="caps"){["out","gift","save"].forEach(t=>budgetIds(t).forEach(k=>pl[k]=S.config.budgets[k]));
    const prevIn=byCat(inPeriod(period(ui.offset-1)),"in");Object.entries(prevIn).forEach(([k,v])=>{if(k!=="reservoir-in"&&v>0)pl[k]=v;});
    (S.config.debts||[]).forEach(d=>{if(debtLeft(d)>0&&d.monthly>0)pl["debt:"+d.id]=Math.min(+d.monthly,debtLeft(d));});
    const inc=Object.entries(pl).filter(([k])=>cats("in").some(c=>c.id===k)).reduce((a,[,v])=>a+v,0);const tt=S.config.tithe||{};if(tt.on!==false&&inc)pl.dime=Math.round(inc*(+tt.rate||10)/100);}
  plans[planKey(p)]=pl;persist(["config"]);ui.anim=true;render();
  toast(from==="zero"?"Budget du mois créé : commence par tes revenus.":"Budget du mois prêt : ajuste les montants.");
}
function openEnvTargets(){
  const {t}=envTargets();const raw={};ENVS.forEach(e=>raw[e.id]=+((S.config.envTargets||{})[e.id]??e.t));
  const sh=openSheet(`<div class="grab"></div><div class="sheet-h"><h2>Répartition repère</h2><button class="icon-btn" data-act="close" type="button" aria-label="Fermer">${ms("close")}</button></div>
    <p class="muted">La part de tes revenus que tu vises pour chaque enveloppe. Le total doit faire 100 %.</p>
    ${ENVS.map(e=>`<div class="b-row"><span class="ic" style="--c:${e.color}">${ms(e.icon)}</span><div class="b-main"><strong style="font-weight:500">${e.label}</strong><span class="b-status">${e.sub}</span></div><label><span class="sr">Repère ${e.label}</span><input class="input b-input" data-target="${e.id}" inputmode="numeric" value="${raw[e.id]}"></label></div>`).join("")}
    <p class="small" id="et-sum"></p>
    <div class="sheet-acts"><button class="btn" type="button" data-act="et-reset">${ms("restart_alt")}Repères d'origine</button><button class="btn primary" type="button" data-act="et-save">${ms("check")}Enregistrer</button></div>`,{kind:"targets",st:{}});
  sh.style.setProperty("--tc","var(--accent)");etRecalc();
}
function etRecalc(){const el=$("#et-sum");if(!el)return;const s=$$("[data-target]").reduce((a,x)=>a+(parseFloat(x.value)||0),0);el.innerHTML=`Total : <strong class="${Math.round(s)===100?"good":"bad"}">${s} %</strong>${Math.round(s)===100?"":" · il faut 100 %"}`;}

/* ---------- Dettes ---------- */
function openDebt(id){
  const d=id?(S.config.debts||[]).find(x=>x.id===id):null;
  const sh=openSheet(`<div class="grab"></div><div class="sheet-h"><h2>${d?"Modifier la dette":"Nouvelle dette"}</h2><button class="icon-btn" type="button" data-act="close" aria-label="Fermer">${ms("close")}</button></div>
    <label class="field"><span>Créancier ou nom de la dette</span><input class="input" id="d-name" maxlength="40" placeholder="Prêt IMF, tante Akossiwa…" value="${d?esc(d.name):""}"></label><p class="err" id="e-dname"></p>
    <div class="row2" style="grid-template-columns:1fr 1fr"><label class="field"><span>Restant dû au départ (${cur().sym})</span><input class="input" id="d-total" inputmode="numeric" placeholder="300 000" value="${d?num(d.total):""}"></label><label class="field"><span>Mensualité prévue</span><input class="input" id="d-monthly" inputmode="numeric" placeholder="25 000" value="${d&&d.monthly?num(d.monthly):""}"></label></div><p class="err" id="e-dtotal"></p>
    <div class="row2" style="grid-template-columns:1fr 1fr"><label class="field"><span>Frais ou taux (facultatif)</span><input class="input" id="d-rate" maxlength="40" placeholder="2 % par mois" value="${d?esc(d.rate||""):""}"></label><label class="field"><span>Depuis</span><input class="input" type="month" id="d-start" value="${d?esc(d.start||""):todayISO().slice(0,7)}"></label></div>
    <div class="sheet-acts">${d?`<button class="btn danger" type="button" data-act="debt-delete" aria-label="Supprimer la dette">${ms("delete")}</button>`:""}<button class="btn primary" type="button" data-act="debt-save">${ms("check")}${d?"Enregistrer":"Ajouter la dette"}</button></div>`,{kind:"debt",st:{id:d?d.id:null}});
  sh.style.setProperty("--tc","var(--out)");setTimeout(()=>{if(!d)$("#d-name",sh).focus();},60);
}
function saveDebt(){
  const st=sheet.ctx.st,sh=$(".sheet",sheet.el);const name=$("#d-name",sh).value.trim(),total=parseAmt($("#d-total",sh).value),monthly=parseAmt($("#d-monthly",sh).value);
  $("#e-dname",sh).textContent=name?"":"Indique le créancier ou un nom.";$("#e-dtotal",sh).textContent=total>0?"":"Indique le montant restant dû.";
  if(!name||!(total>0))return;
  const list=S.config.debts=S.config.debts||[];const d={id:st.id||"d-"+rid(),name,total,monthly:monthly>0?monthly:0,rate:$("#d-rate",sh).value.trim(),start:$("#d-start",sh).value||""};
  const i=list.findIndex(x=>x.id===d.id);if(i>=0)list[i]=d;else list.push(d);
  persist(["config"]);closeSheet();render(true);toast(i>=0?"Dette modifiée":"Dette ajoutée");
}
function debtsHtml(){
  const list=S.config.debts||[];const L=inPeriod(period());const s=sums(L);const e=envTotals(L);
  const ratio=s.in?e.dettes/s.in:null;const lv=ratio===null?null:ratio<0.15?"good":ratio<=0.33?"warn":"bad";
  return `<section class="card" style="--i:3"><div class="card-h"><div><h2>Mes dettes</h2><p class="small muted" style="margin-top:4px">${ratio===null?"Le ratio d'endettement s'affiche dès qu'il y a des entrées sur le mois.":`Endettement du mois : <strong style="color:${LEVEL[lv][1]}">${Math.round(ratio*100)} %</strong> des entrées (vert sous 15 %, rouge au-delà de 33 %)`}</p></div><button class="btn sm" data-act="debt-new" type="button">${ms("add")}Nouvelle dette</button></div>
  ${list.length?`<div class="debts">${list.map(d=>{const paid=debtPaid(d),left=debtLeft(d),pc=d.total?paid/d.total*100:0;const months=left>0&&d.monthly>0?Math.ceil(left/d.monthly):0;
    return `<article class="debt"><div class="debt-top"><span class="ic" style="--c:var(--out)">${ms(left>0?"credit_score":"task_alt")}</span><div style="min-width:0"><strong>${esc(d.name)}</strong><small>${d.monthly?`${fmt(d.monthly)} par mois`:"Sans mensualité fixe"}${d.rate?` · ${esc(d.rate)}`:""}</small></div><div class="debt-left"><small>Reste dû</small><strong class="num">${fmt(left)}</strong></div></div>
    <div class="bar"><i style="--w:${Math.min(100,pc)}%;--c:${left>0?"var(--accent)":"var(--in)"}"></i></div>
    <div class="debt-meta"><span>Remboursé ${fmt(paid)} sur ${fmt(d.total)}</span><span>${left<=0?`<span class="good">${ms("celebration")} Soldée</span>`:months?`Fin estimée dans ${months} mois`:""}</span></div>
    <div class="goal-acts">${left>0?`<button class="btn primary sm" data-act="debt-pay" data-id="${d.id}" type="button">${ms("payments")}Rembourser</button>`:""}<button class="btn sm" data-act="debt-edit" data-id="${d.id}" type="button">${ms("edit")}Modifier</button></div></article>`;}).join("")}</div>`
  :emptyHtml("credit_score","Aucune dette enregistrée","Prêt d'une IMF, d'un proche, achat à crédit : note ce que tu dois, chaque remboursement fera baisser le reste dû.")}</section>`;
}
function reservoirHtml(){
  const base=+S.config.baseIncome||0,bal=reservoirBalance();
  if(!base&&!bal)return "";
  const s=sums(inPeriod(period()));const inc=s.in-(byCat(inPeriod(period()),"in")["reservoir-in"]||0);
  return `<section class="card reservoir" style="--i:4"><div class="card-h"><div><h2>${ms("water_drop")} Le réservoir</h2><p class="small muted" style="margin-top:4px">Pour lisser les revenus irréguliers : ce qui dépasse ton revenu de base y part, et il comble les mois creux.</p></div></div>
    <div class="goal-facts"><div class="fact"><small>Dans le réservoir</small><strong>${fmt(bal)}</strong></div><div class="fact"><small>Revenu de base</small><strong>${base?fmt(base):"Non défini"}</strong></div></div>
    ${base?`<p class="small muted" style="margin-top:10px">Ce mois : ${fmt(inc)} reçus, ${inc>=base?`soit ${fmt(inc-base)} au-delà du revenu de base`:`il manque ${fmt(base-inc)} pour atteindre le revenu de base`}.</p>`:`<p class="small muted" style="margin-top:10px">Fixe ton revenu de base dans Paramètres › Revenus irréguliers.</p>`}</section>`;
}

/* ---------- Simulateur d'épargne ---------- */
function openSim(goalId){
  const g=goalId?(S.config.goals||[]).find(x=>x.id===goalId):null;const now=new Date();
  let years=10;if(g&&g.deadline){const [y,m]=g.deadline.split("-").map(Number);years=Math.max(1,Math.ceil(((y*12+m-1)-(now.getFullYear()*12+now.getMonth()))/12));}
  const avg=(()=>{let t=0;for(let k=1;k<=3;k++)t+=inPeriod(period(-k)).filter(x=>x.type==="save"&&(!g||x.goal===g.id)).reduce((a,x)=>a+(+x.amount||0),0);return Math.round(t/3);})();
  const st={target:g?g.target:5000000,initial:g?goalSaved(g):0,monthly:avg||25000,rate:0,inflation:2,years,name:g?g.name:""};
  const sh=openSheet(`<div class="grab"></div><div class="sheet-h"><h2>Simulateur d'épargne${g?` · ${esc(g.name)}`:""}</h2><button class="icon-btn" type="button" data-act="close" aria-label="Fermer">${ms("close")}</button></div>
    <p class="muted">Combien deviendra ton épargne régulière, et combien mettre de côté pour atteindre ton objectif à temps.</p>
    <div class="sim-grid">
      <label class="field"><span>Épargne par mois</span><input class="input" data-sim="monthly" inputmode="numeric" value="${num(st.monthly)}"></label>
      <label class="field"><span>Déjà épargné</span><input class="input" data-sim="initial" inputmode="numeric" value="${num(st.initial)}"></label>
      <label class="field"><span>Objectif</span><input class="input" data-sim="target" inputmode="numeric" value="${num(st.target)}"></label>
      <label class="field"><span>Durée souhaitée (années)</span><input class="input" data-sim="years" inputmode="numeric" value="${st.years}"></label>
      <label class="field"><span>Rendement annuel (%)</span><input class="input" data-sim="rate" inputmode="decimal" value="${st.rate}"></label>
      <label class="field"><span>Inflation annuelle (%)</span><input class="input" data-sim="inflation" inputmode="decimal" value="${st.inflation}"></label>
    </div>
    <p class="small muted">Une tontine rapporte 0 %. Pour une banque, une IMF ou une SGI, demande le taux réel.</p>
    <div id="sim-out"></div>`,{kind:"sim",st});
  sh.style.setProperty("--tc","var(--save)");simRecalc();
}
function simRecalc(){
  if(!sheet||sheet.ctx.kind!=="sim")return;const st=sheet.ctx.st;
  $$("[data-sim]").forEach(x=>{const k=x.dataset.sim;const v=k==="rate"||k==="inflation"?parseFloat(String(x.value).replace(",","."))||0:k==="years"?Math.max(1,Math.min(30,parseInt(x.value)||1)):parseAmt(x.value)||0;st[k]=v;});
  const o={monthly:st.monthly,initial:st.initial,rate:st.rate/100,inflation:st.inflation/100};
  const yrs=C.yearsToTarget(o,st.target);const need=C.monthlyNeeded({target:st.target,initial:st.initial,rate:o.rate,years:st.years});
  const H=Math.max(st.years,Math.min(30,yrs||st.years));const rows=C.simulate({...o,years:H});const at=rows[st.years-1];
  const W=600,Hh=180,L0=50,B=24,T=10;const max=Math.max(st.target,rows[rows.length-1].value)*1.05||1;const x=i=>L0+(W-L0-10)*(i/(H));const y=v=>T+(Hh-T-B)*(1-v/max);
  const path=k=>"M"+[[0,st.initial],...rows.map(r=>[r.year,r[k]])].map(([i,v])=>`${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" L");
  const ticks=[0,.5,1].map(f=>`<text x="${L0-6}" y="${y(max*f)+4}" text-anchor="end">${short(max*f)}</text>`).join("")+[...new Set([1,Math.ceil(H/2),H])].map(i=>`<text x="${x(i)}" y="${Hh-6}" text-anchor="${i===H?"end":"middle"}">${i} an${i>1?"s":""}</text>`).join("");
  $("#sim-out").innerHTML=`<div class="sim-res">
    <div class="fact"><small>Objectif atteint en</small><strong>${yrs===null?"plus de 30 ans":yrs===0?"déjà atteint":`${yrs} an${yrs>1?"s":""}`}</strong></div>
    <div class="fact"><small>Pour y arriver en ${st.years} an${st.years>1?"s":""}</small><strong>${fmt(Math.ceil(need))} / mois</strong></div>
    <div class="fact"><small>Valeur après ${st.years} an${st.years>1?"s":""}</small><strong>${fmt(at.value)}</strong></div>
    <div class="fact"><small>Dont gains · en francs d'aujourd'hui</small><strong>${fmt(at.gain)} · ${fmt(at.today)}</strong></div></div>
    <div class="chart sim-chart"><svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Évolution de l'épargne sur ${H} ans">${ticks}<line x1="${L0}" x2="${W-10}" y1="${y(st.target)}" y2="${y(st.target)}" style="stroke:var(--gift)" stroke-dasharray="5 5"/><text x="${W-12}" y="${y(st.target)-6}" text-anchor="end" style="fill:var(--gift)">Objectif</text><path d="${path("paid")}" fill="none" style="stroke:var(--fg-3)" stroke-width="2" stroke-dasharray="4 4"/><path d="${path("value")}" fill="none" style="stroke:var(--save)" stroke-width="3" stroke-linecap="round"/></svg>
    <div class="legend-inline"><span style="--c:var(--save)"><i></i>Valeur acquise</span><span style="--c:var(--fg-3)"><i></i>Versements cumulés</span></div></div>`;
}

/* ---------- Vue annuelle (12 mois) ---------- */
function yearData(){
  const ps=Array.from({length:12},(_,k)=>period(ui.offset-11+k));
  const lists=ps.map(p=>inPeriod(p));const rows=[];
  const add=(type,c,env)=>{const vals=lists.map(L=>L.filter(t=>t.type===type&&t.cat===c.id).reduce((a,t)=>a+(+t.amount||0),0));if(vals.some(v=>v))rows.push({type,env,label:c.label,vals,tot:vals.reduce((a,v)=>a+v,0)});};
  cats("in").forEach(c=>add("in",c,null));
  ENVS.forEach(e=>["gift","save","out","other"].forEach(t=>cats(t).forEach(c=>{if(envOf(t,c.id)===e.id)add(t,c,e.id);})));
  const inc=lists.map(L=>sums(L).in);const months=inc.filter(v=>v>0).length;
  return {ps,lists,rows,inc,incTot:inc.reduce((a,v)=>a+v,0),months};
}
function vYear(){
  const Y=yearData();const {ps,rows,inc,incTot,months}=Y;const all=Y.lists.flat();const s=sums(all);const e=envTotals(all);const sig=C.signals({income:s.in,net:s.net,debt:e.dettes,core:e.noyau});
  const avg=v=>months?v/months:0;const pct=v=>incTot?Math.round(v/incTot*100)+" %":"—";
  const cell=v=>v?`<td>${short(v)}</td>`:`<td class="z">·</td>`;
  const groupRow=(label,vals,cls)=>{const tot=vals.reduce((a,v)=>a+v,0);return `<tr class="${cls}"><th scope="row">${label}</th>${vals.map(cell).join("")}<td class="t">${short(tot)}</td><td>${short(avg(tot))}</td><td>${pct(tot)}</td></tr>`;};
  const body=[groupRow(`${ms("south_west")}Revenus`,inc,"grp in"),...rows.filter(r=>r.type==="in").map(r=>groupRow(esc(r.label),r.vals,"")),
    ...ENVS.map(en=>{const rs=rows.filter(r=>r.env===en.id);if(!rs.length)return "";const vals=ps.map((_,i)=>rs.reduce((a,r)=>a+r.vals[i],0));return groupRow(`<span class="dot" style="background:${en.color}"></span>${en.label}`,vals,"grp")+rs.map(r=>groupRow(esc(r.label),r.vals,"")).join("");}),
    groupRow("Solde du mois",ps.map((_,i)=>sums(Y.lists[i]).net),"grp sold")].join("");
  return `<div class="page-h" style="--i:0"><div><button class="btn ghost" data-nav="stats" type="button" style="margin-left:-12px">${ms("arrow_back")}Statistiques</button><h1 style="margin-top:4px">Vue annuelle</h1><p>De ${esc(ps[0].label.toLowerCase())} à ${esc(ps[11].label.toLowerCase())}</p></div><button class="btn" data-act="year-csv" type="button">${ms("table_view")}Exporter</button></div>
  <div class="kpis" style="--i:1">
    <div class="kpi"><small>Revenus sur 12 mois</small><strong>${fmt(s.in)}</strong><span class="delta flat">${months?`moyenne ${fmt(avg(s.in))} / mois`:"—"}</span></div>
    <div class="kpi"><small>Sorties</small><strong>${fmt(s.outflow)}</strong><span class="delta flat">${pct(s.outflow)} des revenus</span></div>
    <div class="kpi"><small>Le noyau (épargne)</small><strong>${fmt(e.noyau)}</strong><span class="delta flat">${pct(e.noyau)} des revenus</span></div>
    <div class="kpi"><small>Dieu</small><strong>${fmt(e.dieu)}</strong><span class="delta flat">${pct(e.dieu)} des revenus</span></div>
  </div>
  <section class="card" style="--i:2"><div class="card-h"><h2>Les voyants de l'année</h2></div>${signalsHtml(sig)}</section>
  <section class="card" style="--i:3"><div class="card-h"><h2>Mois par mois</h2><span class="small muted">Moyenne sur ${months||0} mois avec des revenus</span></div>
    ${rows.length?`<div class="year-scroll"><table class="year"><thead><tr><th scope="col">Catégorie</th>${ps.map(p=>`<th scope="col">${p.short}</th>`).join("")}<th scope="col">Total</th><th scope="col">Moy./mois</th><th scope="col">% revenus</th></tr></thead><tbody>${body}</tbody></table></div>`:emptyHtml("table_view","Pas encore de données","Les opérations des 12 derniers mois apparaîtront ici.")}
  </section>`;
}
function exportYearCsv(){
  const Y=yearData();const q=v=>`"${String(v).replace(/"/g,'""')}"`;const n=v=>String(Math.round(v*100)/100).replace(".",",");
  const lines=[["Catégorie","Enveloppe",...Y.ps.map(p=>p.label),"Total"].map(q).join(";")];
  lines.push([q("Total des revenus"),q(""),...Y.inc.map(n),n(Y.incTot)].join(";"));
  Y.rows.forEach(r=>lines.push([q(r.label),q(r.type==="in"?"Revenus":envById(r.env).label),...r.vals.map(n),n(r.tot)].join(";")));
  offerFile(`azur-annee-${Y.ps[11].start.slice(0,7)}.csv`,"﻿"+lines.join("\r\n"),"Vue annuelle");
}

/* ---------- Projets immobiliers (classeur ImmoView) ---------- */
const PROP_KINDS=["Location","Construction en cours","Terrain","Résidence principale","Local commercial"];
const PROP_LAND=["Titre foncier","Convention de vente","Attestation de vente","Procédure en cours","Autre"];
const POSTES={in:[["loyers","Loyers perçus","real_estate_agent"],["avance","Avance sur loyers","fast_forward"],["caution-in","Caution reçue (remboursable)","lock"],["apport","Apports personnels","savings"],["financement","Financement (banque ou IMF)","account_balance"],["aides","Aides, subventions","volunteer_activism"],["autres-in","Autres entrées","add_circle"]],
  out:[["materiaux","Matériaux de construction","construction"],["main","Main-d'œuvre","engineering"],["credit","Crédit immobilier","credit_score"],["agence","Frais d'agence ou de gérance","storefront"],["gardiennage","Gardiennage","security"],["eau","Eau","water_drop"],["elec","Électricité","bolt"],["banque","Frais bancaires","account_balance_wallet"],["impots","Impôts et taxes fonciers","receipt"],["entretien","Entretien et réparations","build"],["assurance","Assurance","health_and_safety"],["caution-out","Remboursement de caution","lock_open"],["autres-out","Autres sorties","more_horiz"]]};
const NON_EXPLOIT=["credit","materiaux","main","caution-out"];
const posteOf=(dir,k)=>(POSTES[dir]||[]).find(x=>x[0]===k)||[k,k,"label"];
const propById=id=>(S.config.props||[]).find(x=>x.id===id);
function propStats(pr){const since=iso(new Date(new Date().getFullYear()-1,new Date().getMonth(),new Date().getDate()+1));return C.propertyStats({cost:+pr.cost||0,cash0:+pr.cash0||0,moves:pr.moves||[],since,nonOperating:NON_EXPLOIT});}
const pctTxt=v=>v===null?"—":(Math.round(v*1000)/10).toLocaleString("fr-FR")+" %";
function vImmo(){
  const list=S.config.props||[];
  return `<div class="page-h" style="--i:0"><div><h1>Immobilier</h1><p>Location, terrain ou construction en cours : chaque bien a sa propre trésorerie.</p></div><button class="btn primary" data-act="prop-new" type="button">${ms("add")}Nouveau bien</button></div>
  ${list.length?`<div class="props" style="--i:1">${list.map(pr=>{const st=propStats(pr);return `<button class="card prop-card" type="button" data-act="prop-open" data-id="${pr.id}"><div class="prop-top"><span class="ic" style="--c:var(--accent)">${ms(pr.kind==="Terrain"?"landscape":pr.kind==="Construction en cours"?"construction":"home_work")}</span><div style="min-width:0"><strong>${esc(pr.name)}</strong><small>${esc(pr.kind||"")}${pr.place?" · "+esc(pr.place):""}</small></div>${ms("chevron_right")}</div>
    <div class="goal-facts"><div class="fact"><small>Trésorerie</small><strong class="${st.cash<0?"bad":""}">${fmt(st.cash)}</strong></div><div class="fact"><small>Rendement net</small><strong>${pctTxt(st.net)}</strong></div></div></button>`;}).join("")}</div>`
  :`<section class="card" style="--i:1">${emptyHtml("home_work","Aucun bien suivi","Ajoute un terrain, une maison en location ou une construction en cours pour suivre ses entrées, ses sorties et sa rentabilité.",`<button class="btn primary" data-act="prop-new" type="button">${ms("add")}Ajouter un bien</button>`)}</section>`}`;
}
function vProp(){
  const pr=propById(ui.prop);if(!pr){ui.view="immo";return vImmo();}
  const st=propStats(pr);const moves=[...(pr.moves||[])].sort((a,b)=>b.date.localeCompare(a.date));
  const byPoste={};moves.forEach(m=>{const k=m.dir+":"+m.poste;byPoste[k]=(byPoste[k]||0)+(+m.amount||0);});
  const groups={};moves.forEach(m=>(groups[m.date.slice(0,7)]=groups[m.date.slice(0,7)]||[]).push(m));
  const built=(byPoste["out:materiaux"]||0)+(byPoste["out:main"]||0);
  return `<div class="page-h" style="--i:0"><div><button class="btn ghost" data-nav="immo" type="button" style="margin-left:-12px">${ms("arrow_back")}Immobilier</button><h1 style="margin-top:4px">${esc(pr.name)}</h1><p>${esc(pr.kind||"")}${pr.place?" · "+esc(pr.place):""}${pr.land?" · "+esc(pr.land):""}</p></div><div class="btn-row"><button class="btn" data-act="prop-edit" data-id="${pr.id}" type="button">${ms("edit")}Fiche</button><button class="btn primary" data-act="move-new" type="button">${ms("add")}Mouvement</button></div></div>
  <div class="kpis" style="--i:1">
    <div class="kpi"><small>Trésorerie du bien</small><strong class="${st.cash<0?"bad":""}">${fmt(st.cash)}</strong><span class="delta flat">dont ${fmt(+pr.cash0||0)} au départ</span></div>
    <div class="kpi"><small>Loyers sur 12 mois</small><strong>${fmt(st.rents)}</strong><span class="delta flat">charges ${fmt(st.charges)}</span></div>
    <div class="kpi"><small>Rendement brut · net</small><strong>${pctTxt(st.gross)} · ${pctTxt(st.net)}</strong><span class="delta flat">${pr.cost?`sur ${fmt(pr.cost)}`:"coût total à renseigner"}</span></div>
    <div class="kpi"><small>${built&&!st.rents?"Déjà investi dans la construction":"Années pour amortir"}</small><strong>${built&&!st.rents?fmt(built):st.payback?(Math.round(st.payback*10)/10).toLocaleString("fr-FR")+"\u00a0ans":"—"}</strong><span class="delta flat">${built&&!st.rents?"matériaux et main-d'œuvre":"au rendement net"}</span></div>
  </div>
  <div class="notice" style="--i:2">${ms("info")}<span>La caution est remboursable : ce n'est pas un revenu. Le rendement ne compte ni le crédit, ni la construction, ni les cautions.</span></div>
  <div class="grid-2">
   <section class="card" style="--i:3"><div class="card-h"><h2>Mouvements</h2><span class="small muted">${moves.length} au total</span></div>
    ${moves.length?Object.entries(groups).map(([m,arr])=>{const [y,mo]=m.split("-").map(Number);const n=arr.reduce((a,x)=>a+(x.dir==="in"?1:-1)*(+x.amount||0),0);return `<div class="day-h"><span>${cap(MONTHS[mo-1])} ${y}</span><span class="num">${fmt(n,true)}</span></div>${arr.map(x=>{const [,lbl,ic]=posteOf(x.dir,x.poste);return `<button class="mv-row" type="button" data-act="move-edit" data-id="${x.id}"><span class="ic" style="--c:${x.dir==="in"?"var(--in)":"var(--out)"}">${ms(ic)}</span><span style="min-width:0"><strong>${esc(lbl)}</strong><small>${dayLabel(x.date)}${x.note?" · "+esc(x.note):""}</small></span><b class="num ${x.dir==="in"?"good":""}">${fmt((x.dir==="in"?1:-1)*x.amount,true)}</b></button>`;}).join("")}`;}).join(""):emptyHtml("swap_vert","Aucun mouvement","Loyers encaissés, sacs de ciment, paie du maçon : ajoute chaque entrée et chaque sortie du bien.")}
   </section>
   <div class="col" style="display:flex;flex-direction:column;gap:16px">
    <section class="card" style="--i:4"><div class="card-h"><h2>Par poste</h2><span class="small muted">depuis le début</span></div>
      ${Object.keys(byPoste).length?["in","out"].map(dir=>{const ks=Object.entries(byPoste).filter(([k])=>k.startsWith(dir+":")).sort((a,b)=>b[1]-a[1]);if(!ks.length)return "";const tot=ks.reduce((a,[,v])=>a+v,0);return `<h3 class="acc-h">${dir==="in"?"Entrées":"Sorties"} · ${fmt(tot)}</h3>${ks.map(([k,v])=>{const [,lbl]=posteOf(dir,k.split(":")[1]);return `<div class="ml-row"><div class="ml-top"><span>${esc(lbl)}</span><span>${short(v)}</span></div><div class="bar"><i style="--w:${v/tot*100}%;--c:${dir==="in"?"var(--in)":"var(--out)"}"></i></div></div>`;}).join("")}`;}).join(""):`<p class="small muted">Les totaux par poste apparaîtront ici.</p>`}
    </section>
    <section class="card" style="--i:5"><div class="card-h"><h2>Contacts utiles</h2><button class="btn sm" data-act="contact-new" type="button">${ms("add")}Ajouter</button></div>
      ${(pr.contacts||[]).length?(pr.contacts||[]).map(c=>{const tel=String(c.tel||"").replace(/[^\d+]/g,"");return `<div class="set-row acc-row"><div style="min-width:0"><strong>${esc(c.name||"Sans nom")}</strong><small>${esc(c.role||"")}${c.note?" · "+esc(c.note):""}</small></div><div class="btn-row">${tel?`<a class="btn sm" href="tel:${esc(tel)}">${ms("call")}<span class="sr">Appeler</span></a><a class="btn sm" href="https://wa.me/${esc(tel.replace(/^\+/,""))}" target="_blank" rel="noopener">${ms("chat")}<span class="sr">WhatsApp</span></a>`:""}<button class="btn sm ghost" data-act="contact-edit" data-id="${c.id}" type="button" aria-label="Modifier ${esc(c.name||"")}">${ms("edit")}</button></div></div>`;}).join(""):`<p class="small muted">Locataires, notaire, géomètre, maçon, plombier… garde leurs numéros ici.</p>`}
    </section>
   </div>
  </div>`;
}
function openProp(id){
  const pr=id?propById(id):null;
  const sh=openSheet(`<div class="grab"></div><div class="sheet-h"><h2>${pr?"Fiche du bien":"Nouveau bien"}</h2><button class="icon-btn" type="button" data-act="close" aria-label="Fermer">${ms("close")}</button></div>
    <label class="field"><span>Désignation</span><input class="input" id="p-name" maxlength="50" placeholder="Maison d'Adidogomé" value="${pr?esc(pr.name):""}"></label><p class="err" id="e-pname"></p>
    <label class="field"><span>Localisation (quartier, ville)</span><input class="input" id="p-place" maxlength="60" placeholder="Adidogomé, Lomé" value="${pr?esc(pr.place||""):""}"></label>
    <div class="row2" style="grid-template-columns:1fr 1fr"><label class="field"><span>Type de bien</span><select class="input" id="p-kind">${PROP_KINDS.map(k=>`<option ${pr&&pr.kind===k?"selected":""}>${k}</option>`).join("")}</select></label><label class="field"><span>Situation foncière</span><select class="input" id="p-land">${PROP_LAND.map(k=>`<option ${pr&&pr.land===k?"selected":""}>${k}</option>`).join("")}</select></label></div>
    <div class="row2" style="grid-template-columns:1fr 1fr"><label class="field"><span>Coût total (achat + construction + frais)</span><input class="input" id="p-cost" inputmode="numeric" placeholder="12 000 000" value="${pr&&pr.cost?num(pr.cost):""}"></label><label class="field"><span>Trésorerie de départ</span><input class="input" id="p-cash0" inputmode="numeric" placeholder="0" value="${pr&&pr.cash0?num(pr.cash0):""}"></label></div>
    <div class="sheet-acts">${pr?`<button class="btn danger" type="button" data-act="prop-delete" aria-label="Supprimer le bien">${ms("delete")}</button>`:""}<button class="btn primary" type="button" data-act="prop-save">${ms("check")}${pr?"Enregistrer":"Ajouter le bien"}</button></div>`,{kind:"prop",st:{id:pr?pr.id:null}});
  sh.style.setProperty("--tc","var(--accent)");setTimeout(()=>{if(!pr)$("#p-name",sh).focus();},60);
}
function saveProp(){
  const st=sheet.ctx.st,sh=$(".sheet",sheet.el);const name=$("#p-name",sh).value.trim();$("#e-pname",sh).textContent=name?"":"Donne un nom au bien.";if(!name)return;
  const list=S.config.props=S.config.props||[];const old=st.id?propById(st.id):null;
  const pr={...(old||{moves:[],contacts:[]}),id:st.id||"p-"+rid(),name,place:$("#p-place",sh).value.trim(),kind:$("#p-kind",sh).value,land:$("#p-land",sh).value,cost:parseAmt($("#p-cost",sh).value)||0,cash0:parseAmt($("#p-cash0",sh).value)||0};
  const i=list.findIndex(x=>x.id===pr.id);if(i>=0)list[i]=pr;else list.push(pr);
  persist(["config"]);closeSheet();if(!old){ui.prop=pr.id;ui.view="prop";ui.anim=true;render();}else render(true);toast(old?"Fiche enregistrée":"Bien ajouté");
}
function openMove(id){
  const pr=propById(ui.prop);const m=id?(pr.moves||[]).find(x=>x.id===id):null;const st={id:m?m.id:null,dir:m?m.dir:"out",poste:m?m.poste:null};
  const sh=openSheet(`<div class="grab"></div><div class="sheet-h"><h2>${m?"Modifier le mouvement":"Nouveau mouvement"}</h2><button class="icon-btn" type="button" data-act="close" aria-label="Fermer">${ms("close")}</button></div>
    <div class="types two" role="group" aria-label="Sens"><button class="type-btn" type="button" data-sh="mdir" data-v="in" style="--c:var(--in)">${ms("south_west")}Entrée</button><button class="type-btn" type="button" data-sh="mdir" data-v="out" style="--c:var(--out)">${ms("north_east")}Sortie</button></div>
    <div><label class="amount"><span class="sr">Montant</span><input id="m-amount" inputmode="numeric" autocomplete="off" placeholder="0" value="${m?num(m.amount):""}"><span>${cur().sym}</span></label><p class="err" id="e-mamount"></p></div>
    <div class="field"><span>Poste</span><div class="chips" id="m-postes"></div><p class="err" id="e-mposte"></p></div>
    <div class="row2"><label class="field"><span>Date</span><input class="input" type="date" id="m-date" value="${m?m.date:todayISO()}"></label><label class="field"><span>Note</span><input class="input" id="m-note" maxlength="80" placeholder="20 sacs de ciment" value="${m?esc(m.note||""):""}"></label></div>
    <div class="sheet-acts">${m?`<button class="btn danger" type="button" data-act="move-delete" aria-label="Supprimer">${ms("delete")}</button>`:""}<button class="btn primary" type="button" data-act="move-save">${ms("check")}${m?"Enregistrer":"Ajouter"}</button></div>`,{kind:"move",st});
  moveDyn();setTimeout(()=>{if(!m)$("#m-amount",sh).focus();},60);
}
function moveDyn(){const st=sheet.ctx.st,sh=$(".sheet",sheet.el);sh.style.setProperty("--tc",st.dir==="in"?"var(--in)":"var(--out)");$$('[data-sh="mdir"]',sh).forEach(b=>b.setAttribute("aria-pressed",b.dataset.v===st.dir));if(!POSTES[st.dir].some(x=>x[0]===st.poste))st.poste=null;$("#m-postes",sh).innerHTML=POSTES[st.dir].map(([k,l,i])=>`<button class="chip" type="button" data-sh="mposte" data-v="${k}" aria-pressed="${k===st.poste}">${ms(i)}${l}</button>`).join("");}
function saveMove(){
  const st=sheet.ctx.st,sh=$(".sheet",sheet.el);const amount=parseAmt($("#m-amount",sh).value);
  $("#e-mamount",sh).textContent=amount>0?"":"Saisis un montant.";$("#e-mposte",sh).textContent=st.poste?"":"Choisis un poste.";if(!(amount>0)||!st.poste)return;
  const pr=propById(ui.prop);pr.moves=pr.moves||[];const mv={id:st.id||"m-"+rid(),dir:st.dir,poste:st.poste,amount,date:$("#m-date",sh).value||todayISO(),note:$("#m-note",sh).value.trim()};
  const i=pr.moves.findIndex(x=>x.id===mv.id);if(i>=0)pr.moves[i]=mv;else pr.moves.push(mv);
  persist(["config"]);closeSheet();render(true);toast(`${i>=0?"Mouvement modifié":"Mouvement ajouté"} · ${fmt((mv.dir==="in"?1:-1)*amount,true)}`);
}
function openContact(id){
  const pr=propById(ui.prop);const c=id?(pr.contacts||[]).find(x=>x.id===id):null;
  const roles=["Locataire","Agence ou gérant","Banque ou IMF","Notaire","Géomètre","Maçon / chef de chantier","Plombier","Électricien","Assureur","Autre"];
  const sh=openSheet(`<div class="grab"></div><div class="sheet-h"><h2>${c?"Modifier le contact":"Nouveau contact"}</h2><button class="icon-btn" type="button" data-act="close" aria-label="Fermer">${ms("close")}</button></div>
    <div class="row2" style="grid-template-columns:1fr 1fr"><label class="field"><span>Rôle</span><select class="input" id="ct-role">${roles.map(r=>`<option ${c&&c.role===r?"selected":""}>${r}</option>`).join("")}</select></label><label class="field"><span>Nom</span><input class="input" id="ct-name" maxlength="50" value="${c?esc(c.name||""):""}"></label></div>
    <div class="row2" style="grid-template-columns:1fr 1fr"><label class="field"><span>Téléphone / WhatsApp</span><input class="input" id="ct-tel" inputmode="tel" placeholder="+228 90 00 00 00" value="${c?esc(c.tel||""):""}"></label><label class="field"><span>Notes</span><input class="input" id="ct-note" maxlength="80" placeholder="N° de dossier, adresse…" value="${c?esc(c.note||""):""}"></label></div>
    <p class="err" id="e-ct"></p>
    <div class="sheet-acts">${c?`<button class="btn danger" type="button" data-act="contact-delete" aria-label="Supprimer">${ms("delete")}</button>`:""}<button class="btn primary" type="button" data-act="contact-save">${ms("check")}Enregistrer</button></div>`,{kind:"contact",st:{id:c?c.id:null}});
  sh.style.setProperty("--tc","var(--accent)");
}
function saveContact(){
  const st=sheet.ctx.st,sh=$(".sheet",sheet.el);const name=$("#ct-name",sh).value.trim(),tel=$("#ct-tel",sh).value.trim();
  if(!name&&!tel){$("#e-ct",sh).textContent="Indique au moins un nom ou un numéro.";return;}
  const pr=propById(ui.prop);pr.contacts=pr.contacts||[];const c={id:st.id||"ct-"+rid(),role:$("#ct-role",sh).value,name,tel,note:$("#ct-note",sh).value.trim()};
  const i=pr.contacts.findIndex(x=>x.id===c.id);if(i>=0)pr.contacts[i]=c;else pr.contacts.push(c);
  persist(["config"]);closeSheet();render(true);toast("Contact enregistré");
}

/* ---------- Bilan imprimable (même charte que le logiciel, version papier claire) ---------- */
const PR_TYPE={in:"#0E9C8B",out:"#E0435C",save:"#5B5FE0",gift:"#C98A06",other:"#64748B"};
function prDate(d){return `${d.getDate()===1?"1er":d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;}
function prDonut(list,tot){
  let acc=0;const n=list.length;
  const segs=list.map((x,i)=>{const len=x.v/tot*100,l=Math.max(0,len-(n>1?.6:0));const c=`<circle cx="100" cy="100" r="74" fill="none" stroke="${PALETTE[i%PALETTE.length]}" stroke-width="26" pathLength="100" stroke-dasharray="${l} ${100-l}" stroke-dashoffset="${-acc}" transform="rotate(-90 100 100)"/>`;acc+=len;return c;}).join("");
  return `<svg viewBox="0 0 200 200" aria-hidden="true"><circle cx="100" cy="100" r="74" fill="none" stroke="#E9F4FD" stroke-width="26"/>${segs}</svg>`;
}
function prMonths(off){
  const months=[5,4,3,2,1,0].map(k=>{const pr=period(off-k);const ss=sums(inPeriod(pr));return {l:pr.short,in:ss.in,out:ss.outflow};});
  const max=Math.max(1,...months.flatMap(m=>[m.in,m.out]));
  const W=640,H=200,L0=50,B=24,T=10,cw=(W-L0-8)/6,bw=Math.min(24,cw/3.2),y=v=>T+(H-T-B)*(1-v/max);
  const grid=[0,.5,1].map(f=>`<line x1="${L0}" x2="${W-4}" y1="${y(max*f)}" y2="${y(max*f)}" stroke="#D6E9F9" ${f?'stroke-dasharray="3 4"':""}/><text x="${L0-8}" y="${y(max*f)+4}" text-anchor="end">${short(max*f)}</text>`).join("");
  const bars=months.map((m,i)=>{const cx=L0+cw*i+cw/2;return `<rect x="${cx-bw-2}" y="${y(m.in)}" width="${bw}" height="${Math.max(0,H-B-y(m.in))}" rx="5" fill="${PR_TYPE.in}"/><rect x="${cx+2}" y="${y(m.out)}" width="${bw}" height="${Math.max(0,H-B-y(m.out))}" rx="5" fill="#2E6FD8"/><text x="${cx}" y="${H-6}" text-anchor="middle"${i===5?' class="on"':""}>${m.l}</text>`;}).join("");
  return `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true">${grid}${bars}</svg>`;
}
function prBar(pct,color){return `<div class="pr-bar"><i style="width:${Math.max(0,Math.min(100,pct))}%;background:${color}"></i></div>`;}
const prColor=c=>({"var(--gift)":PR_TYPE.gift,"var(--save)":PR_TYPE.save,"var(--accent)":"#2E6FD8","var(--out)":PR_TYPE.out}[c]||c);
function prSignals(sig){
  if(!sig)return `<p class="pr-empty">Pas d'entrées sur le mois.</p>`;
  const col={good:PR_TYPE.in,warn:PR_TYPE.gift,bad:PR_TYPE.out},lab={good:"vert",warn:"orange",bad:"rouge"};
  return [["solde","Solde du mois","≥ 10 % vert · négatif rouge"],["dette","Endettement","< 15 % vert · > 33 % rouge"],["epargne","Épargne (le noyau)","≥ 10 % vert · < 5 % rouge"]].map(([k,l,r])=>`<div class="pr-sig"><span style="background:${col[sig[k].level]}"></span><div><b>${l}</b><small>${r}</small></div><strong style="color:${col[sig[k].level]}">${Math.round(sig[k].v*100)} % · ${lab[sig[k].level]}</strong></div>`).join("");
}
function printHtml(){
  const R=reviewData(),{p,pp,L,s,prev,good,watch,sugg,nextP,rate,prate,spent}=R;
  const sym=cur().sym,today=new Date();
  const range=`Du ${prDate(p.startD)} au ${prDate(p.endD)}`;
  const [mName,mYear]=[MONTHS[(+S.config.startDay||1)===1?p.startD.getMonth():p.endD.getMonth()],((+S.config.startDay||1)===1?p.startD:p.endD).getFullYear()];
  const kpi=(label,val,delta,cls="")=>`<div class="pr-kpi"><small>${label}</small><strong class="${cls}">${val}</strong>${delta}</div>`;
  /* Où sont allées les entrées */
  const flow=[["out","Dépenses"],["save","Épargne"],["gift","Semences"],["other","Autres sorties"]].map(([t,l])=>({t,l,v:s[t],c:PR_TYPE[t]})).filter(x=>x.v>0);
  if(s.net>0)flow.push({t:"rest",l:"Reste disponible",v:s.net,c:"#7CC4F5"});
  const base=Math.max(s.in,s.outflow)||1;
  const flowHtml=`<div class="pr-flow">${flow.map(x=>`<i style="width:${x.v/base*100}%;background:${x.c}"></i>`).join("")}</div><div class="pr-flow-lg">${flow.map(x=>`<div><span style="--c:${x.c}"></span><b>${x.l}</b><em>${fmt(x.v)}</em><small>${s.in?Math.round(x.v/s.in*100)+" % des entrées":""}</small></div>`).join("")}</div>`;
  /* Dépenses par catégorie */
  const outCats=Object.entries(byCat(L,"out")).map(([id,v])=>({c:catOf({type:"out",cat:id}),v})).filter(x=>x.v>0).sort((a,b)=>b.v-a.v);
  const tot=outCats.reduce((a,x)=>a+x.v,0);
  const donut=tot?`<div class="pr-donut-wrap"><div class="pr-donut">${prDonut(outCats,tot)}<div class="lbl"><strong>${short(tot)}</strong><small>${sym} dépensés</small></div></div><div class="pr-legend">${outCats.slice(0,9).map((x,i)=>`<div style="--c:${PALETTE[i%PALETTE.length]}"><i></i><span>${esc(x.c.label)}</span><b>${short(x.v)}</b><em>${Math.round(x.v/tot*100)} %</em></div>`).join("")}${outCats.length>9?`<div class="more">+ ${outCats.length-9} autres catégories</div>`:""}</div></div>`:`<p class="pr-empty">Aucune dépense sur la période.</p>`;
  /* Budgets */
  const bsec=[["out","Dépenses","Plafond"],["gift","Dépenses semences","Prévu"],["save","Épargnes","Prévu"]].map(([t,title,word])=>{
    const ids=budgetIds(t);if(!ids.length)return "";const sp=t==="out"?spent:byCat(L,t);
    return `<div class="pr-bsec"><h4>${title}</h4>${ids.map(k=>{const c=cats(t).find(x=>x.id===k);const b=S.config.budgets[k],v=sp[k]||0,pc=b?v/b*100:0;
      const col=t==="out"?(pc>100?PR_TYPE.out:pc>=80?PR_TYPE.gift:"#2E6FD8"):PR_TYPE[t];
      const st=t==="out"?(pc>100?`<span class="bad">Dépassé de ${fmt(v-b)}</span>`:`Reste ${fmt(b-v)}`):(v>=b?`<span class="good">Atteint</span>`:`Manque ${fmt(b-v)}`);
      return `<div class="pr-brow"><span class="pr-ic" style="--c:${PR_TYPE[t]}">${ms(c.icon)}</span><div class="m"><div class="t"><span>${esc(c.label)}</span><span>${short(v)} / ${short(b)} <small>(${word.toLowerCase()})</small></span></div>${prBar(pc,col)}<small class="st">${st}</small></div></div>`;}).join("")}</div>`;}).join("");
  /* Objectifs */
  const goals=S.config.goals||[];
  const goalsHtml=goals.length?goals.map(g=>{const sv=goalSaved(g),pc=g.target?sv/g.target*100:0;return `<div class="pr-brow"><span class="pr-ic" style="--c:${PR_TYPE.save}">${ms(g.icon||"flag")}</span><div class="m"><div class="t"><span>${esc(g.name)}</span><span>${Math.round(Math.min(100,pc))} %</span></div>${prBar(pc,PR_TYPE.save)}<small class="st">${fmt(sv)} sur ${fmt(g.target)}${g.deadline?` · échéance ${MONTHS[+g.deadline.slice(5,7)-1]} ${g.deadline.slice(0,4)}`:""}</small></div></div>`;}).join(""):"";
  /* Opérations */
  const ops=[...L].sort((a,b)=>a.date.localeCompare(b.date)||(a.created||0)-(b.created||0));
  const opsHtml=`<table class="pr-ops"><thead><tr><th>Date</th><th>Catégorie</th><th>Note</th><th>Moyen</th><th class="r">Montant</th></tr></thead><tbody>${ops.map(t=>{const d=parseISO(t.date);const pay=(PAYS.find(x=>x[0]===t.pay)||[])[1]||"";const sg=t.type==="in"?1:-1;return `<tr><td class="d">${pad(d.getDate())} ${MS[d.getMonth()]}</td><td><span class="dot" style="background:${PR_TYPE[t.type]}"></span>${esc(catOf(t).label)}</td><td class="n">${esc(t.note||"")}</td><td class="p">${esc(pay)}</td><td class="r ${t.type==="in"?"pos":""}">${fmt(sg*(+t.amount||0),true)}</td></tr>`;}).join("")}</tbody><tfoot><tr><td colspan="4">Solde du mois · ${ops.length} opération${ops.length>1?"s":""}</td><td class="r">${fmt(s.net,true)}</td></tr></tfoot></table>`;
  const sec=(icon,color,title,body,extra="")=>`<section class="pr-card${extra}"><h3><span class="pr-ic sm" style="--c:${color}">${ms(icon)}</span>${title}</h3>${body}</section>`;
  const capIds=budgetIds("out"),capTot=capIds.reduce((a,k)=>a+S.config.budgets[k],0),capUsed=capIds.reduce((a,k)=>a+(spent[k]||0),0),capPct=capTot?capUsed/capTot*100:0;
  return `<article class="pr">
  <header class="pr-head">
    <div class="pr-brand"><img src="${LOGO}" alt=""><span>Azur</span><em>Bilan mensuel</em></div>
    <div class="pr-hero">
      <div><p class="eyebrow">${esc(range)}</p><h1>Bilan de <span>${mName}</span> ${mYear}</h1><p class="who">${esc(session.user?session.user.displayName:"")} · imprimé le ${prDate(today)}</p></div>
      <div class="pr-net"><small>Solde du mois</small><strong>${fmt(s.net)}</strong><span>${L.length} opération${L.length>1?"s":""}${capTot?` · ${Math.round(capPct)} % des plafonds utilisés`:""}</span></div>
    </div>
  </header>
  <div class="pr-kpis">
    ${kpi("Entrées",fmt(s.in),deltaHtml(s.in,prev.in,true))}
    ${kpi("Sorties",fmt(s.outflow),deltaHtml(s.outflow,prev.outflow,false))}
    ${kpi("Taux d'épargne",Math.round(rate)+" %",`<span class="delta ${rate>=prate?"good":"bad"}">${prev.in?(rate>=prate?"+":"−")+Math.abs(Math.round(rate-prate))+" pts":"—"}</span>`)}
    ${kpi("Semences versées",fmt(s.gift),deltaHtml(s.gift,prev.gift,true))}
  </div>
  <p class="pr-cmp">Variations comparées à ${esc(pp.label.toLowerCase())}.</p>
  ${sec("account_balance_wallet","#2E6FD8","Où sont allées tes entrées",s.in||s.outflow?flowHtml:`<p class="pr-empty">Aucune opération.</p>`)}
  ${s.in?`<div class="pr-grid">
    ${sec("traffic","#2E6FD8","Les voyants",prSignals(signalsFor(L)))}
    ${sec("mail","#2E6FD8","Les enveloppes",`<div class="pr-env">${envCompareRows(p,L,s).map(r=>`<div class="pr-brow"><span class="pr-ic" style="--c:${prColor(r.en.color)}">${ms(r.en.icon)}</span><div class="m"><div class="t"><span>${r.en.label}</span><span>${Math.round(r.part)} % <small>(repère ${r.target} %)</small></span></div>${prBar(r.part,prColor(r.en.color))}<small class="st">${fmt(r.real)}${r.plan!==null?` · prévu ${fmt(r.plan)}`:""}</small></div></div>`).join("")}</div>`)}
  </div>`:""}
  <div class="pr-grid">
    ${sec("donut_large",PR_TYPE.out,"Dépenses par catégorie",donut)}
    ${sec("insights","#2E6FD8","Sur six mois",`<div class="pr-legend-inline"><span style="--c:${PR_TYPE.in}"><i></i>Entrées</span><span style="--c:#2E6FD8"><i></i>Sorties</span></div><div class="pr-chart">${prMonths(ui.offset)}</div>`)}
  </div>
  <div class="pr-grid">
    ${sec("thumb_up",PR_TYPE.in,"Ce qui s'est bien passé",good.length?good.join(""):`<p class="pr-empty">Rien de marquant pour l'instant.</p>`)}
    ${sec("visibility",PR_TYPE.gift,"À surveiller",watch.length?watch.join(""):`<p class="pr-empty">Aucun point d'alerte. Beau travail.</p>`)}
  </div>
  ${bsec?sec("donut_small","#2E6FD8","Budgets du mois",`<div class="pr-bgrid">${bsec}</div>`," pr-break-ok"):""}
  ${goalsHtml?sec("flag",PR_TYPE.save,"Objectifs d'épargne",`<div class="pr-bgrid one">${goalsHtml}</div>`):""}
  ${sugg.length?sec("tips_and_updates","#2E6FD8",`Plafonds suggérés pour ${esc(nextP.label.toLowerCase())}`,`<table class="pr-sug"><thead><tr><th>Catégorie</th><th class="r">Moyenne</th><th class="r">Plafond actuel</th><th class="r">Suggéré</th></tr></thead><tbody>${sugg.map(x=>`<tr><td>${esc(x.c.label)}</td><td class="r">${fmt(x.avg)}</td><td class="r">${x.b?fmt(x.b):"—"}</td><td class="r"><b>${fmt(x.sug)}</b></td></tr>`).join("")}</tbody></table><p class="pr-note">Calculés sur la moyenne de tes trois derniers mois, avec une petite marge.</p>`):""}
  ${sec("receipt_long","#2E6FD8","Détail des opérations",opsHtml," pr-break-ok")}
  <footer class="pr-foot"><img src="${LOGO}" alt=""><span><b>Azur</b> · Ton budget, clair comme le ciel.</span></footer>
</article>`;
}
/* Ctrl+P ou Cmd+P depuis l'écran Bilan : on imprime aussi la version mise en page */
window.addEventListener("beforeprint",()=>{
  const html=document.documentElement;if(html.classList.contains("printing")||ui.view!=="review"||!inPeriod(period()).length)return;
  let root=$("#print-root");if(!root){root=document.createElement("div");root.id="print-root";document.body.appendChild(root);}
  root.innerHTML=printHtml();html.classList.add("printing");
  const done=()=>{html.classList.remove("printing");root.innerHTML="";window.removeEventListener("afterprint",done);};
  window.addEventListener("afterprint",done);
});
async function printReview(){
  if(!inPeriod(period()).length){toast("Aucune opération à imprimer sur ce mois.");return;}
  let root=$("#print-root");if(!root){root=document.createElement("div");root.id="print-root";document.body.appendChild(root);}
  root.innerHTML=printHtml();
  const html=document.documentElement,title=document.title;
  html.classList.add("printing");document.title=`Azur - Bilan ${period().label}`;
  try{await document.fonts.ready;}catch(e){}
  await Promise.all($$("img",root).map(i=>i.complete?0:new Promise(r=>{i.onload=i.onerror=r;})));
  const done=()=>{html.classList.remove("printing");document.title=title;root.innerHTML="";window.removeEventListener("afterprint",done);};
  window.addEventListener("afterprint",done);
  window.print();
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
  /* Dette, budget du mois et bien immobilier d'exemple */
  const debt={id:"d-demo",name:"Prêt IMF (moto)",total:360000,monthly:30000,rate:"1,5 % par mois",start:ym(-5),demo:true};
  S.config.debts=[...(S.config.debts||[]).filter(d=>!d.demo),debt];
  for(let k=5;k>=0;k--){const base=new Date(now.getFullYear(),now.getMonth()-k,1);const d=iso(new Date(base.getFullYear(),base.getMonth(),5));if(d>today)continue;const m=d.slice(0,7);(S.tx[m]=S.tx[m]||[]).push({id:rid(),type:"out",amount:30000,cat:"dette",catLabel:"Remboursement de dette",date:d,note:"Mensualité IMF",pay:"tmoney",rec:false,created:Date.now(),demo:true,debt:"d-demo"});keys.add("tx-"+m);}
  const p0=period(0);const plans=S.config.plans=S.config.plans||{};
  if(!plans[planKey(p0)]){plans[planKey(p0)]={salaire:320000,presta:100000,dime:42000,offrande:10000,don:10000,ep1:20000,ep2:30000,urgence:15000,loyer:75000,alim:65000,transport:30000,energie:20000,telecom:10000,sante:15000,pro:15000,"debt:d-demo":30000,famille:15000,loisirs:10000,shopping:8000,_demo:1};}
  const mv=(dir,poste,amount,k,day,note)=>{const d=new Date(now.getFullYear(),now.getMonth()-k,day);return {id:"m-"+rid(),dir,poste,amount,date:iso(d),note};};
  S.config.props=[...(S.config.props||[]).filter(x=>!x.demo),{id:"p-demo",name:"Studio d'Agoè",place:"Agoè, Lomé",kind:"Location",land:"Titre foncier",cost:9000000,cash0:150000,demo:true,
    moves:[mv("in","caution-in",90000,5,2,"Caution du locataire"),...[5,4,3,2,1,0].map(k=>mv("in","loyers",45000,k,3,"Loyer")),...[4,1].map(k=>mv("out","gardiennage",15000,k,10,"")),mv("out","entretien",38000,2,14,"Plomberie salle d'eau"),mv("out","impots",25000,3,20,"Taxe foncière")].filter(m=>m.date<=today),
    contacts:[{id:"ct-1",role:"Locataire",name:"Kossi A.",tel:"+228 90 12 34 56",note:"Bail depuis mai"},{id:"ct-2",role:"Plombier",name:"Edem",tel:"+228 91 22 33 44",note:""}]}];
  S.config.demo=true;
  persist(["config",...keys]);ui.anim=true;render();toast("Exemples chargés sur six mois");
}
function clearDemo(){
  const keys=new Set(["config"]);
  Object.keys(S.tx).forEach(m=>{const n=S.tx[m].filter(t=>!t.demo);if(n.length!==S.tx[m].length){S.tx[m]=n;keys.add("tx-"+m);}});
  (S.config.demoBudgetKeys||[]).forEach(k=>delete S.config.budgets[k]);
  S.config.goals=(S.config.goals||[]).filter(g=>!g.demo);
  S.config.debts=(S.config.debts||[]).filter(d=>!d.demo);S.config.props=(S.config.props||[]).filter(x=>!x.demo);
  Object.keys(S.config.plans||{}).forEach(k=>{if(S.config.plans[k]._demo)delete S.config.plans[k];});
  delete S.config.demo;delete S.config.demoBudgetKeys;
  persist([...keys]);ui.anim=true;render();toast("Exemples effacés");
}
async function offerFile(filename,data,label){
  const r=await window.azur.file.save(filename,data);
  if(r.ok&&r.data.saved)toast(`${label} enregistré`);else if(!r.ok)toast("Enregistrement impossible : "+r.error.message);
  return !!(r.ok&&r.data.saved);
}
function exportCsv(){
  const rows=[["Date","Type","Catégorie","Montant","Devise","Mode de paiement","Note","Objectif"]];
  allTx().sort((a,b)=>a.date.localeCompare(b.date)).forEach(t=>{const g=t.goal?(S.config.goals.find(x=>x.id===t.goal)||{}).name:"";rows.push([t.date,TYPES[t.type].label,catOf(t).label,String(t.amount).replace(".",","),cur().sym,(PAYS.find(p=>p[0]===t.pay)||["",""])[1],t.note||"",g||""]);});
  const csv="﻿"+rows.map(r=>r.map(v=>/[;"\n]/.test(v)?`"${String(v).replace(/"/g,'""')}"`:v).join(";")).join("\r\n");
  offerFile(`azur-operations-${todayISO()}.csv`,csv,"Export");
}
async function exportJson(){
  const ok=await offerFile(`azur-sauvegarde-${todayISO()}.json`,JSON.stringify({app:"azur",version:1,saved:new Date().toISOString(),config:S.config,tx:S.tx},null,1),"Sauvegarde");
  if(ok){S.config.lastBackup=Date.now();persist(["config"]);render(true);}
}
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
    else if(k==="debt"){st.debt=v;txDyn();}
    else if(k==="mdir"){st.dir=v;moveDyn();}
    else if(k==="mposte"){st.poste=v;$("#e-mposte").textContent="";moveDyn();}
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
    case "plan-start":startPlan(a.dataset.from);break;
    case "plan-dime":{const pl=planOf(period());if(pl){pl.dime=+a.dataset.v;persist(["config"]);render(true);toast("Dîme prévue mise à jour");}break;}
    case "plan-all":ui.planAll=!ui.planAll;render(true);break;
    case "plan-to-caps":confirmBox("En faire tes plafonds habituels ?","Les montants prévus de ce mois (dépenses, semences et épargnes) deviendront tes plafonds pour tous les mois.","Remplacer",()=>{const pl=planOf(period())||{};["out","gift","save","other"].forEach(t=>cats(t).forEach(c=>{if(pl[c.id]>0)S.config.budgets[c.id]=pl[c.id];else delete S.config.budgets[c.id];}));persist(["config"]);render(true);toast("Plafonds habituels mis à jour");});break;
    case "plan-clear":confirmBox("Effacer le budget du mois ?","Les montants prévus de ce mois seront effacés. Tes opérations ne changent pas.","Effacer",()=>{delete (S.config.plans||{})[planKey(period())];persist(["config"]);ui.anim=true;render();toast("Budget du mois effacé");});break;
    case "env-targets":openEnvTargets();break;
    case "et-reset":$$("[data-target]").forEach(x=>{x.value=envById(x.dataset.target).t;});etRecalc();break;
    case "et-save":{const o={};let tot=0;$$("[data-target]").forEach(x=>{const v=Math.max(0,parseFloat(x.value)||0);o[x.dataset.target]=v;tot+=v;});if(Math.round(tot)!==100){toast("Le total doit faire 100 %.");return;}S.config.envTargets=o;persist(["config"]);closeSheet();render(true);toast("Répartition repère enregistrée");break;}
    case "debt-new":openDebt();break;
    case "debt-edit":openDebt(id);break;
    case "debt-save":saveDebt();break;
    case "debt-delete":{const did=sheet.ctx.st.id;closeSheet(true);const d=(S.config.debts||[]).find(x=>x.id===did);confirmBox("Supprimer la dette ?",`« ${d?d.name:""} » sera supprimée. Les remboursements déjà enregistrés restent dans ton historique.`,"Supprimer",()=>{S.config.debts=S.config.debts.filter(x=>x.id!==did);persist(["config"]);render(true);toast("Dette supprimée");});break;}
    case "debt-pay":{const d=(S.config.debts||[]).find(x=>x.id===id);if(d)openTx(null,{type:"out",cat:"dette",debt:d.id,amount:Math.min(+d.monthly||0,debtLeft(d))||""});break;}
    case "sim-open":openSim(id);break;
    case "year-csv":exportYearCsv();break;
    case "res-take":{const base=+S.config.baseIncome||0;const L=inPeriod(period());const inc=sums(L).in-(byCat(L,"in")["reservoir-in"]||0);openTx(null,{type:"in",cat:"reservoir-in",amount:Math.max(0,Math.min(base-inc,reservoirBalance()))});break;}
    case "prop-new":openProp();break;
    case "prop-open":ui.prop=id;go("prop");break;
    case "prop-edit":openProp(id);break;
    case "prop-save":saveProp();break;
    case "prop-delete":{const pid=sheet.ctx.st.id;closeSheet(true);const pr=propById(pid);confirmBox("Supprimer ce bien ?",`« ${pr?pr.name:""} », ses mouvements et ses contacts seront supprimés.`,"Supprimer",()=>{S.config.props=S.config.props.filter(x=>x.id!==pid);persist(["config"]);ui.view="immo";ui.anim=true;render();toast("Bien supprimé");});break;}
    case "move-new":openMove();break;
    case "move-edit":openMove(id);break;
    case "move-save":saveMove();break;
    case "move-delete":{const mid=sheet.ctx.st.id;const pr=propById(ui.prop);pr.moves=(pr.moves||[]).filter(x=>x.id!==mid);persist(["config"]);closeSheet();render(true);toast("Mouvement supprimé");break;}
    case "contact-new":openContact();break;
    case "contact-edit":openContact(id);break;
    case "contact-save":saveContact();break;
    case "contact-delete":{const cid=sheet.ctx.st.id;const pr=propById(ui.prop);pr.contacts=(pr.contacts||[]).filter(x=>x.id!==cid);persist(["config"]);closeSheet();render(true);toast("Contact supprimé");break;}
    case "logout":logout();break;
    case "acc-rename":openAccount("rename");break;
    case "acc-password":openAccount("password");break;
    case "access-see":go("settings");setTimeout(()=>{const e=$("#access-sec");if(e)e.scrollIntoView({behavior:reduced?"auto":"smooth",block:"start"});},120);break;
    case "access-load":accessData=null;{const e=$("#access-card");if(e)e.innerHTML=accessCardHtml();}loadAccess();break;
    case "access-approve":(async()=>{a.disabled=true;const r=await window.azur.access.approve(a.dataset.uid);a.disabled=false;if(!r.ok){toast(r.error.message);return;}showCode(r.data.code,r.data.name);loadAccess();})();break;
    case "access-show":showCode(a.dataset.code,a.dataset.name);break;
    case "access-decline":confirmBox(`Refuser la demande de ${a.dataset.name||"cette personne"} ?`,"La demande disparaît de la liste. La personne pourra en faire une nouvelle en se reconnectant.","Refuser",async()=>{const r=await window.azur.access.decline(a.dataset.uid);toast(r.ok?"Demande refusée.":r.error.message);loadAccess();});break;
    case "access-revoke":confirmBox(`Retirer l'accès de ${a.dataset.name||"cette personne"} ?`,"Elle ne pourra plus ouvrir son budget. Ses données ne sont pas effacées : si tu lui redonnes l'accès plus tard, elle les retrouvera.","Retirer",async()=>{const r=await window.azur.access.revoke(a.dataset.uid);toast(r.ok?"Accès retiré.":r.error.message);loadAccess();});break;
    case "verify-send":(async()=>{const r=await window.azur.account.sendVerification();toast(r.ok?`E-mail envoyé à ${r.data}. Pense aux courriers indésirables.`:r.error.message);})();break;
    case "verify-check":(async()=>{const r=await window.azur.account.verification();if(r.ok&&r.data.verified){session.user={...session.user,verified:true};render(true);toast("Adresse confirmée, merci.");}else toast(r.ok?"Pas encore confirmée. Ouvre le lien reçu par e-mail, puis réessaie.":r.error.message);})();break;
    case "backup-now":exportJson();break;
    case "backup-later":try{localStorage.setItem("azur:backup-snooze:"+session.user.id,String(Date.now()+7*DAY));}catch(e){}render(true);break;
    case "acc-forget":confirmBox("Oublier ce compte sur cet appareil ?","Le compte disparaîtra de la liste de cet appareil et la copie locale de tes données sera effacée. Tes données restent en ligne : tu les retrouveras en te reconnectant, avec Internet.","Oublier",async()=>{const r=await window.azur.account.forgetDevice();if(!r.ok){toast(r.error.message);return;}window.AzurApp.stop();location.reload();});break;
    case "acc-reset":(async()=>{const r=await window.azur.account.sendReset();toast(r.ok?`Lien envoyé à ${r.data}. Vérifie aussi les courriers indésirables.`:r.error.message);})();break;
    case "legacy-open":openLegacy();break;
    case "upd-check":window.azurNative.updates.check().then(r=>{if(r.ok){upd.status=r.data;renderUpd();if(r.data.state==="uptodate")toast("Azur est à jour.");}});upd.status={...(upd.status||{}),state:"checking"};renderUpd();break;
    case "upd-restart":window.azurNative.updates.restart();break;
    case "legacy-go":legacyImport();break;
    case "acc-delete":openAccount("delete");break;
    case "acc-submit":submitAccount();break;
    case "copy-code":copyText(a.dataset.code);break;
    case "split-last":{const e=inPeriod(period()).filter(t=>t.type==="in").sort((a,b)=>b.date.localeCompare(a.date)||(b.created||0)-(a.created||0))[0];if(e)openSplit(e.id,false);break;}
    case "split-confirm":confirmSplit();break;
    case "review-prev":ui.offset=-1;go("review");break;
    case "print-review":printReview();break;
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
  if(e.key==="Enter"&&sheet&&e.target.tagName==="INPUT"&&e.target.type!=="checkbox"){const k=sheet.ctx.kind;if(k==="tx")saveTx();else if(k==="goal")saveGoal();else if(k==="debt")saveDebt();else if(k==="prop")saveProp();else if(k==="move")saveMove();else if(k==="contact")saveContact();else if(k==="cat")$('[data-act="cat-save"]').click();else if(k==="catedit")$('[data-act="catedit-save"]').click();else if(k==="account")submitAccount();else if(k==="legacy")legacyImport();}
});
document.addEventListener("input",e=>{
  const t=e.target;
  if(t.id==="q"){ui.q=t.value;$("#ops-list").innerHTML=opsList();return;}
  if(t.dataset.target!==undefined){etRecalc();return;}
  if(t.dataset.sim&&(t.dataset.sim==="rate"||t.dataset.sim==="inflation"||t.dataset.sim==="years")){simRecalc();return;}
  if(t.id==="f-amount"||t.id==="g-target"||t.id==="g-initial"||t.dataset.budget||t.dataset.plan||t.dataset.sim||t.dataset.base!==undefined||["d-total","d-monthly","p-cost","p-cash0","m-amount"].includes(t.id)||t.dataset.splitAmt!==undefined){
    const dec=cur().dec>0&&t.id==="f-amount";
    let v=t.value.replace(/[^\d,.]/g,"").replace(".",",");
    let [i,f]=v.split(",");i=(i||"").replace(/^0+(?=\d)/,"");
    const fi=i?Number(i).toLocaleString("fr-FR").replace(/[  ]/g," "):"";
    t.value=dec&&f!==undefined?`${fi||"0"},${f.slice(0,2)}`:fi;
    if(t.id==="f-amount")$("#e-amount").textContent="";
    if(t.dataset.splitAmt!==undefined)splitRecalc();
    if(t.dataset.sim)simRecalc();
  }
});
document.addEventListener("change",e=>{
  const t=e.target;
  if(t.dataset.split!==undefined){splitRecalc();return;}
  if(t.dataset.cfg){const k=t.dataset.cfg;S.config.tithe=S.config.tithe||{on:true,rate:10};if(k==="tithe")S.config.tithe.on=t.checked;else if(k==="rate")S.config.tithe.rate=+t.value;else if(k==="split")S.config.split=t.checked;else if(k==="splash")S.config.splash=t.checked;persist(["config"]);toast("Préférence enregistrée");return;}
  if(t.dataset.plan){const p=period();const plans=S.config.plans=S.config.plans||{};const pl=plans[planKey(p)]=plans[planKey(p)]||{};const v=parseAmt(t.value);if(v>0)pl[t.dataset.plan]=v;else delete pl[t.dataset.plan];persist(["config"]);render(true);return;}
  if(t.dataset.base!==undefined){const v=parseAmt(t.value);if(v>0)S.config.baseIncome=v;else delete S.config.baseIncome;persist(["config"]);render(true);toast(v>0?"Revenu de base enregistré":"Revenu de base désactivé");return;}
  if(t.dataset.env){S.config.envMap=S.config.envMap||{};const st=sheet&&sheet.ctx.st;if(st){if(t.value===defEnv(st.type,st.id))delete S.config.envMap[st.id];else S.config.envMap[st.id]=t.value;persist(["config"]);toast("Enveloppe enregistrée");}return;}
  if(t.dataset.hide!==undefined){const st=sheet&&sheet.ctx.st;if(st){S.config.catHidden=S.config.catHidden||{};if(t.checked)delete S.config.catHidden[st.id];else S.config.catHidden[st.id]=true;persist(["config"]);render(true);toast(t.checked?"Catégorie affichée dans les choix":"Catégorie masquée des choix");}return;}
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
  if(reduced||e.button>0||S.config.splash===false)return;
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
/* ---------- Mises à jour (logiciel seulement) ---------- */
let upd={status:null,shell:"",uiv:"",toasted:""};
function updCardHtml(){
  const st=upd.status||{state:"idle"};const sh=st.shell||null;
  let line="Azur vérifie les mises à jour au démarrage, puis toutes les 6 heures.",btn=`<button class="btn" data-act="upd-check" type="button">${ms("refresh")}Rechercher</button>`;
  if(st.state==="checking")line="Recherche en cours…";
  else if(st.state==="ready"){line=`Une nouvelle version de l'interface (${esc(st.ui)}) est prête. Elle s'appliquera au prochain démarrage.`;btn=`<button class="btn primary" data-act="upd-restart" type="button">${ms("restart_alt")}Redémarrer maintenant</button>`;}
  else if(st.message)line=esc(st.message);
  let shellLine="";
  if(sh&&sh.state==="downloading"&&sh.version)shellLine=`Téléchargement du logiciel ${esc(sh.version||"")}${sh.percent!=null?" : "+sh.percent+" %":"…"}`;
  else if(sh&&sh.state==="ready"){shellLine=`Le logiciel ${esc(sh.version)} est prêt et s'installera au redémarrage.`;btn=`<button class="btn primary" data-act="upd-restart" type="button">${ms("restart_alt")}Redémarrer et mettre à jour</button>`;}
  else if(sh&&sh.state==="manual")shellLine=`Une nouvelle version complète du logiciel (${esc(sh.version)}) est disponible. Télécharge-la sur la page protégée, puis installe-la par-dessus l'actuelle : <a href="https://narcisseetsinyo-cmd.github.io/azur/telecharger/" target="_blank" rel="noopener">ouvrir la page de téléchargement</a>.`;
  return `<div class="set-row"><div><strong>Version ${esc(upd.shell)}${upd.uiv&&upd.uiv!==upd.shell?` · interface ${esc(upd.uiv)}`:""}</strong><small>${line}</small>${shellLine?`<small style="margin-top:4px">${shellLine}</small>`:""}</div>${btn}</div>`;
}
function renderUpd(){const c=$("#upd-card");if(c)c.innerHTML=updCardHtml();}
if(window.azurNative&&window.azurNative.updates){
  window.azurNative.updates.info().then(r=>{if(r.ok){upd.shell=r.data.shell;upd.uiv=r.data.ui;upd.status=r.data.status;renderUpd();}});
  window.azurNative.updates.onStatus(st=>{
    upd.status=st;renderUpd();
    const key=(st.state==="ready"?"ui"+st.ui:"")+(st.shell&&st.shell.state==="ready"?"sh"+st.shell.version:"");
    if(key&&key!==upd.toasted&&session.user){upd.toasted=key;toast("Une mise à jour d'Azur est prête.","Redémarrer",()=>window.azurNative.updates.restart());}
  });
}

/* ---------- Synchronisation ---------- */
let stopRemote=null,stopStatus=null,remoteState=null;
const SYNC={synced:["cloud_done","Synchronisé","var(--in)"],pending:["cloud_sync","Envoi en cours…","var(--accent)"],connecting:["cloud_sync","Connexion…","var(--accent)"],offline:["cloud_off","Hors ligne","var(--gift)"]};
function syncCardHtml(){const st=(window.azur.sync.status()||{}).state||"offline";const [ic,lb,c]=SYNC[st]||SYNC.offline;
  return `<span class="ic" style="--c:${c}">${ms(ic)}</span><div><strong>${lb}</strong><p class="small muted">${st==="offline"?"Pas de connexion Internet. Continue normalement : tes changements sont gardés sur cet appareil et seront envoyés dès que la connexion reviendra.":"Tes données sont enregistrées dans ton compte Azur en ligne et se mettent à jour toutes seules sur tes autres appareils : Mac, Windows et version web. Une copie reste sur cet appareil pour travailler hors ligne."}</p></div>`;}
function renderSync(st){
  const el=$("#sync");const [ic,lb,c]=SYNC[st.state]||SYNC.offline;
  if(el){el.innerHTML=`${ms(ic)}<span>${lb}</span>`;el.style.setProperty("--c",c);el.title=lb;}
  const card=$("#sync-card");if(card)card.innerHTML=syncCardHtml();
}
function applyRemote(){
  if(!remoteState||!session.user)return;
  if(sheet)return; // on attend la fermeture de la fenêtre en cours
  const next={config:{...defaultConfig(),...(remoteState.config||{})},tx:remoteState.tx||{}};
  const sameTx=JSON.stringify(Object.values(next.tx).flat().map(t=>t.id+":"+JSON.stringify(t)).sort())===JSON.stringify(Object.values(S.tx).flat().map(t=>t.id+":"+JSON.stringify(t)).sort());
  const sameCfg=!remoteState.config||JSON.stringify(next.config)===JSON.stringify(S.config);
  remoteState=null;
  if(sameTx&&sameCfg)return;
  S=next;applyTheme();
  const fe=document.activeElement;if(fe&&fe.dataset&&fe.dataset.budget)return; // ne pas interrompre une saisie
  render(true);
}
/* Import des données de la version 1.0 (logiciel seulement) */
async function maybeOfferLegacy(){
  if(!window.azur.legacy)return;
  let done=false;try{done=localStorage.getItem("azur:legacy-done:"+session.user.id)==="1";}catch(e){}
  if(done||allTx().length)return;
  const r=await window.azur.legacy.list();if(!r.ok||!r.data.length)return;
  toast("Des données de la version 1.0 sont sur cet ordinateur.","Importer",openLegacy);
}
async function openLegacy(){
  const r=await window.azur.legacy.list();
  if(!r.ok||!r.data.length){toast("Aucune donnée de la version 1.0 sur cet ordinateur.");return;}
  const sh=openSheet(`<div class="grab"></div><div class="sheet-h"><h2>Importer la version 1.0</h2><button class="icon-btn" type="button" data-act="close" aria-label="Fermer">${ms("close")}</button></div>
    <p class="muted">Choisis l'ancien compte de cet ordinateur et saisis son mot de passe. Ses opérations, budgets et objectifs seront ajoutés à ton compte synchronisé.</p>
    <div class="field"><span>Ancien compte</span><select class="input" id="lg-acc">${r.data.map(a=>`<option value="${esc(a.id)}">${esc(a.displayName)} · ${esc(a.masked)}</option>`).join("")}</select></div>
    <label class="field"><span>Mot de passe de l'ancien compte</span><input class="input" type="password" id="lg-pw" autocomplete="current-password"></label>
    <p class="err" id="lg-err"></p>
    <div class="sheet-acts"><button class="btn primary" type="button" data-act="legacy-go">${ms("move_to_inbox")}Importer</button></div>`,{kind:"legacy"},"dialog");
  setTimeout(()=>{const f=$("#lg-pw",sh);if(f)f.focus();},60);
}
async function legacyImport(){
  const id=$("#lg-acc").value,pw=$("#lg-pw").value;
  if(!pw){$("#lg-err").textContent="Saisis le mot de passe de l'ancien compte.";return;}
  const r=await window.azur.legacy.load(id,pw);
  if(!r.ok){$("#lg-err").textContent=r.error.message;return;}
  const old=r.data||{};const keys=new Set();let n=0;
  const have=new Set(allTx().map(t=>t.id));
  Object.values(old.tx||{}).flat().forEach(t=>{if(!t||!t.id||have.has(t.id))return;const m=t.date.slice(0,7);(S.tx[m]=S.tx[m]||[]).push(t);keys.add("tx-"+m);n++;});
  if(old.config){const c=old.config;S.config={...S.config,...c,budgets:{...(c.budgets||{}),...(S.config.budgets||{})},goals:[...(S.config.goals||[]),...(c.goals||[]).filter(g=>!(S.config.goals||[]).some(x=>x.id===g.id))]};keys.add("config");}
  persist([...keys]);
  try{localStorage.setItem("azur:legacy-done:"+session.user.id,"1");}catch(e){}
  closeSheet();ui.anim=true;render();toast(`${n} opération${n>1?"s":""} importée${n>1?"s":""}`);
}

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
    stopRemote=window.azur.data.onRemote(st=>{remoteState=st;applyRemote();});
    stopStatus=window.azur.sync.onStatus(renderSync);
    maybeOfferLegacy();
    accessData=null;accessPending=0;
    if(isAdmin())stopAccess=window.azur.access.onRequests(n=>{const ch=n!==accessPending;accessPending=n;if(ch&&!sheet&&ui.view==="home")render();if(ui.view==="settings")loadAccess();});
  },
  stop(){
    if(stopRemote)stopRemote();if(stopStatus)stopStatus();if(stopAccess)stopAccess();stopRemote=stopStatus=stopAccess=null;remoteState=null;accessData=null;accessPending=0;
    session.user=null;closeSheet(true);
    S={config:defaultConfig(),tx:{}};
    $("#view").innerHTML="";$(".app").hidden=true;$(".tabbar").hidden=true;
    const t=$(".toast");if(t)t.remove();
    document.documentElement.removeAttribute("data-theme");
  }
};
window.azur.app.info().then(r=>{if(r.ok)ui.version=r.data.ui&&r.data.ui!==r.data.version?r.data.version+" (interface "+r.data.ui+")":r.data.version;});
window.azur.auth.onLocked(()=>{if(session.user)lockApp();});

/* Version web : mise en cache pour l'ouvrir sans Internet (sans effet dans le logiciel) */
if("serviceWorker" in navigator&&(location.protocol==="https:"||location.hostname==="localhost")){
  const hadController=!!navigator.serviceWorker.controller;
  navigator.serviceWorker.register("sw.js",{updateViaCache:"none"}).catch(()=>{});
  navigator.serviceWorker.addEventListener("controllerchange",()=>{if(hadController)toast("Une nouvelle version d'Azur est prête.","Recharger",()=>location.reload());});
}
})();
