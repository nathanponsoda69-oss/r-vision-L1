/* ═══════════════════════════════════════════════════════════════════════════════
   R·VISION EN LIGNE — compte Google, synchronisation entre appareils, classements, amis, tournoi du mois
   Chargé par l1.html, l2.html et bibliotheque.html (une ligne en bas de page). Aucun site de cours n'est modifié :
   les cours écrivent dans le stockage du navigateur comme avant, et c'est ce module qui, depuis un accueil,
   envoie et reçoit ces données.

   01 · stockage, périodes            08 · compte : connexion, liaison au profil, inscription
   02 · clés synchronisées            09 · synchronisation (fusion à trois voies)
   03 · empreintes et fusion          10 · publication : fiche publique, classements
   04 · lecture des cours             11 · classements (semaine, mois, amis)
   05 · registre des jours (scores)   12 · amis
   06 · fiche publique                13 · tournoi du mois : trophées
   07 · Firebase (chargé à la demande) 14 · interface publique window.RVO, démarrage

   Principes
   · Rien ne se charge tant que en-ligne/config.js n'est pas rempli. Ensuite, Firebase (≈ 110 Ko compressés) n'est
     téléchargé qu'APRÈS la scène 3D, et seulement si l'on s'est déjà connecté sur cet appareil (ou si l'on entre
     dans la salle du classement) : l'accueil ne ralentit pas.
   · Synchronisation clé par clé, à trois voies : on garde l'empreinte de chaque valeur au moment de la dernière
     synchro. Si seul l'appareil a changé une clé, il l'envoie ; si seul le cloud l'a changée, on la reprend ; si les
     deux l'ont changée (révisions hors ligne sur deux appareils), on fusionne : maximum des compteurs, union des
     listes, fusion des objets. L'état de la bibliothèque (coffres, orbes) est fusionné d'un bloc, sans doublon.
   · Le compte suit UN profil : celui qui était actif à l'inscription (son pseudo). Sur un nouvel appareil, ce
     profil est recréé à l'identique.
   ═══════════════════════════════════════════════════════════════════════════════ */
import CFG from './config.js';

/* ─────────────── 01 · stockage, périodes ─────────────── */
const LS={get(k){try{return localStorage.getItem(k);}catch(e){return null;}},set(k,v){try{localStorage.setItem(k,v);return true;}catch(e){return false;}},
  del(k){try{localStorage.removeItem(k);}catch(e){}},keys(){const a=[];try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k!=null)a.push(k);}}catch(e){}return a;}};
const J=(s,d)=>{if(s==null)return d;try{const v=JSON.parse(s);return v==null?d:v;}catch(e){return d;}};
const DAY=864e5;
const dayOf=ts=>new Date(ts).toISOString().slice(0,10);                 // journées UTC, comme les frises d'activité des cours
const eDay=d=>Math.round(Date.parse(d+'T00:00:00Z')/DAY);
const addDays=(d,n)=>dayOf(Date.parse(d+'T00:00:00Z')+n*DAY);
const weekOf=d=>{const e=eDay(d);return e-(((e+3)%7)+7)%7;};          // identifiant de semaine = jour (depuis 1970) de son lundi
const monthOf=d=>(+d.slice(0,4))*100+(+d.slice(5,7));                   // 202611
const today=()=>dayOf(Date.now());
const MOIS=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
const monthLabel=m=>MOIS[(m%100)-1]+' '+Math.floor(m/100);
const prevMonth=m=>m%100===1?(Math.floor(m/100)-1)*100+12:m-1;
const fmtD=d=>{const t=new Date(d+'T00:00:00Z');return t.getUTCDate()+' '+MOIS[t.getUTCMonth()];};

/* ─────────────── 02 · clés synchronisées ───────────────
   rvision_<profil>_…          → « @… » dans le cloud (le pseudo est retiré : il est remis à l'arrivée)
   clés des cours sans profil  → « =… » (constitutionnel L1, filiation, régimes politiques, clés partagées)
   Jamais envoyé : la liste des profils de l'appareil, le profil actif, les réglages de l'appareil, l'état interne
   de ce module (clés rvo_…), la bibliothèque en mode test. */
const GLOBAL_RE=/^(rvision_droit_constit_l1_v1|rvision_dp_personality|rvision_aj_shared)$|^(rv2_|dc_filiation_)/;
const SKIP_CK=new Set(['@biblio_test']);
const users=()=>{const u=J(LS.get('rvision_users'),[]);return Array.isArray(u)?u:[];};
const curUser=()=>LS.get('rvision_current_user')||'';
function localMap(p){
  const out={};if(!p)return out;const us=users(),P='rvision_'+p+'_';
  for(const k of LS.keys()){
    if(GLOBAL_RE.test(k)){out['='+k]=LS.get(k);continue;}
    if(k.indexOf(P)!==0)continue;
    /* isolement : avec le profil « max », on ignore les clés d'un profil « max_2 » qui commencent pareil */
    if(us.some(u=>u&&u!==p&&u.length>p.length&&k.indexOf('rvision_'+u+'_')===0))continue;
    const ck='@'+k.slice(P.length);if(SKIP_CK.has(ck))continue;out[ck]=LS.get(k);}
  return out;
}
const toLocal=(ck,p)=>ck.charAt(0)==='@'?'rvision_'+p+'_'+ck.slice(1):ck.slice(1);
function ensureProfile(p){if(!p)return;const us=users();if(!us.includes(p)){us.push(p);LS.set('rvision_users',JSON.stringify(us));}}

/* ─────────────── 03 · empreintes et fusion ─────────────── */
function h53(str,seed){let h1=0xdeadbeef^(seed||0),h2=0x41c6ce57^(seed||0);
  for(let i=0;i<str.length;i++){const c=str.charCodeAt(i);h1=Math.imul(h1^c,2654435761);h2=Math.imul(h2^c,1597334677);}
  h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909);h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909);
  return 4294967296*(2097151&h2)+(h1>>>0);}
const H=v=>v==null?null:h53(String(v)).toString(36)+'.'+String(v).length.toString(36);
const NS=16;                                   // nombre de morceaux (documents) de la sauvegarde d'un compte
const shardOf=ck=>h53(ck,7)%NS;
const NUM_RE=/^-?\d+(\.\d+)?(e[+-]?\d+)?$/i;
const numOf=s=>typeof s==='number'?s:(typeof s==='string'&&NUM_RE.test(s.trim())?+s:null);
/* fusion de deux valeurs JSON : maximum des nombres, OU des booléens, union des listes, fusion des objets */
function deep(x,y){
  if(x==null)return y;if(y==null)return x;
  if(Array.isArray(x)&&Array.isArray(y)){const seen=new Set(x.map(v=>JSON.stringify(v))),out=x.slice();for(const v of y){const s=JSON.stringify(v);if(!seen.has(s)){seen.add(s);out.push(v);}}return out;}
  if(typeof x==='object'&&typeof y==='object'&&!Array.isArray(x)&&!Array.isArray(y)){const o=Object.assign({},x);for(const k in y)o[k]=k in x?deep(x[k],y[k]):y[k];return o;}
  const a=numOf(x),b=numOf(y);if(a!==null&&b!==null)return a>=b?x:y;
  if(typeof x==='boolean'&&typeof y==='boolean')return x||y;
  return x;
}
/* bibliothèque : on garde l'état de l'appareil qui a ouvert le plus de coffres (ses orbes, ses quêtes, sa chance),
   et on y ajoute les objets que l'autre a trouvés — jamais de coffre ni d'orbe en double */
function mergeBiblio(a,b){
  const A=J(a,null),B=J(b,null);if(!A||typeof A!=='object')return b;if(!B||typeof B!=='object')return a;
  const W=(A.opened|0)>=(B.opened|0)?A:B,L=W===A?B:A,o=Object.assign({},W.owned||{});
  for(const id in (L.owned||{}))o[id]=Math.max(o[id]|0,L.owned[id]|0);
  return JSON.stringify(Object.assign({},W,{owned:o,door:!!(W.door||L.door)}));
}
function mergeVal(a,b,ck){
  if(a==null)return b;if(b==null)return a;if(a===b)return a;
  if(ck==='@biblio')return mergeBiblio(a,b);
  const na=numOf(a),nb=numOf(b);if(na!==null&&nb!==null)return na>=nb?a:b;
  const ja=J(a,undefined),jb=J(b,undefined);
  if(ja&&jb&&typeof ja==='object'&&typeof jb==='object'&&Array.isArray(ja)===Array.isArray(jb))return JSON.stringify(deep(ja,jb));
  return a;   // texte libre modifié des deux côtés : l'appareil en cours d'utilisation l'emporte
}

/* ─────────────── 04 · lecture des cours ───────────────
   Même lecteur que les quêtes de la bibliothèque (tous les formats de cours). Le catalogue (nom, matière, XP
   maximale) vient de la L1 et de la L2 : elles le publient, ce module le garde en mémoire pour la bibliothèque. */
function catalog(){
  const C=J(LS.get('rvo_catalog'),{})||{};let ch=false;
  [['L1',window.RV_CATALOG_L1],['L2',window.RV_CATALOG_L2]].forEach(([lv,list])=>{if(!Array.isArray(list))return;
    for(const c of list){if(!c||!c.key)continue;const e={n:String(c.name||c.key).slice(0,80),mx:+c.maxXp||0,lv,sj:c.subject||''};const o=C[c.key];
      if(!o||o.n!==e.n||o.mx!==e.mx||o.lv!==e.lv||o.sj!==e.sj){C[c.key]=e;ch=true;}}});
  if(ch)LS.set('rvo_catalog',JSON.stringify(C));
  return C;
}
function collect(p){
  const C={},ls=k=>LS.get(k),Jk=k=>J(ls(k),null);
  const cnt=r=>{if(r==null)return 0;try{const a=JSON.parse(r);return Array.isArray(a)?a.length:(+a||0);}catch(e){return +r||0;}};
  const ms=v=>{v=+v||0;return v>0&&v<1e11?v*1000:v;};
  const get=id=>C[id]||(C[id]={t:0,a:0,aq:0,ok:0,f:0,x:0,s:0,act:{},lt:0});
  const mx=(o,k,v)=>{v=+v||0;if(v>o[k])o[k]=v;};
  const act=(o,raw)=>{let m=raw;if(typeof m==='string')m=J(m,null);if(!m||typeof m!=='object')return;
    for(const d in m){const v=+m[d]||0;if(v>0&&/^\d{4}-\d\d-\d\d$/.test(d)&&v>(o.act[d]||0))o.act[d]=v;}};
  const ins=(o,d)=>{if(!d||typeof d!=='object')return;mx(o,'t',(+d.totalActiveMs||0)/1000);
    let c=0,w=0;for(const k in d.quiz||{}){const q=d.quiz[k]||{};c+=+q.correct||0;w+=+q.wrong||0;}mx(o,'a',c+w);if(c+w>o.aq){o.aq=c+w;o.ok=c;}
    let fl=0;for(const k in d.flashcards||{}){const f=d.flashcards[k]||{};fl+=+f.flips||(Array.isArray(f.thinkTimesMs)?f.thinkTimesMs.length:0);}mx(o,'f',fl);
    mx(o,'lt',ms(d.lastFlush));for(const k in d.sections||{})mx(o,'lt',ms((d.sections[k]||{}).lastEnter));};
  const us=users(),P='rvision_'+(p?p+'_':''),SUF=/_(xp|succes|quiz|time|lastvisit|activity|insight)$/;
  for(const k of LS.keys()){
    if(k.indexOf(P)!==0)continue;const m=k.match(SUF);if(!m)continue;const id=k.slice(P.length,k.length-m[0].length);if(!id)continue;
    if(us.some(u=>u&&u!==p&&(p?u.length>p.length:true)&&k.indexOf('rvision_'+u+'_')===0))continue;
    const o=get(id),v=ls(k);
    switch(m[1]){case 'xp':mx(o,'x',v);break;case 'succes':mx(o,'s',cnt(v));break;case 'quiz':mx(o,'a',v);break;case 'time':mx(o,'t',v);break;
      case 'lastvisit':mx(o,'lt',ms(v));break;case 'activity':act(o,v);break;case 'insight':ins(o,Jk(k));break;}}
  {const d=Jk('rvision_droit_constit_l1_v1');if(d&&typeof d==='object'){const o=get('co_l1');mx(o,'x',d.xp);mx(o,'s',Array.isArray(d.unlockedIds)?d.unlockedIds.length:d.succesUnlocked);mx(o,'a',(+d.quizAnswered||0)+(+d.vfAnswered||0));}}
  [['dc_filiation_','dc_filiation'],['rv2_','rp']].forEach(([pf,id])=>{const g=k=>ls(pf+k);
    if(g('xp')==null&&g('time')==null&&g('totalMs')==null&&g('qa')==null&&g('quiz_total')==null)return;const o=get(id);
    mx(o,'x',g('xp'));mx(o,'s',cnt(g('succes')));mx(o,'a',g('qa'));mx(o,'a',g('quiz_total'));mx(o,'t',g('time'));mx(o,'t',(+g('totalMs')||0)/1000);mx(o,'lt',ms(g('lastvisit')));act(o,g('activity'));
    const qt=+g('quiz_total')||0;if(qt>o.aq){o.aq=qt;o.ok=Math.min(qt,+g('quiz_ok')||0);}});
  [['rvision_dp_personality','dp_vf2'],['rvision_aj_shared','aj']].forEach(([k,id])=>{const d=Jk(k);if(!d||typeof d!=='object')return;const o=get(id);
    mx(o,'x',d.xp);mx(o,'s',d.succes_unlocked);mx(o,'t',d.session_time);mx(o,'lt',ms(d.last_update));});
  for(const id in C){const o=C[id];let tk=0;for(const d in o.act)tk+=o.act[d];mx(o,'t',tk*15);if(o.ok>o.aq)o.ok=o.aq;}
  return C;
}

/* ─────────────── 05 · registre des jours et score mixte ───────────────
   Comme les quêtes : à chaque passage, on compare les compteurs des cours avec le dernier instantané et on range
   l'écart dans les journées où il a été produit (frise d'activité du cours, sinon sa dernière visite, sinon
   aujourd'hui). Le registre est une clé du profil (rvision_<profil>_online) : il voyage avec la synchro.

   SCORE D'UNE JOURNÉE = temps + progression + régularité
     temps        1 point par minute de révision active, 180 au plus (3 h)
     progression  1 000 points pour un cours entier : l'XP gagnée divisée par l'XP maximale du cours, 250 au plus
     régularité   40 points si la journée est active (15 min ou 15 réponses, la règle des quêtes)
   Semaine (lundi → dimanche, comme les quêtes) et mois = somme des journées. Une grosse journée ≈ 300 points. */
const SCORE={tCap:180,pCap:250,act:40,actT:900,actA:15};
const LKEEP=120;            // jours gardés dans le registre (le tournoi n'a besoin que du mois en cours et du précédent)
const L_WIN=21;
function ledgerKey(p){return 'rvision_'+p+'_online';}
function ledgerUpdate(p){
  if(!p)return null;
  const cat=catalog(),cur=collect(p),td=today(),lo=addDays(td,-L_WIN),K=ledgerKey(p);
  const L=J(LS.get(K),null)||{v:1};if(!L.days||typeof L.days!=='object')L.days={};
  const snapOf=o=>{const a={};for(const d in o.act)if(d>=lo&&d<=td)a[d]=o.act[d];return {t:Math.round(o.t*100)/100,a:o.a,x:o.x,act:a};};
  const B=d=>L.days[d]||(L.days[d]={t:0,a:0,x:0,p:0,c:[]});
  const mxOf=id=>{const c=cat[id];return c&&c.mx>0?c.mx:5000;};
  if(!L.snap||typeof L.snap!=='object'){   // mise en service : on part d'ici, en reprenant le temps déjà passé aujourd'hui
    L.snap={};L.since=td;
    for(const id in cur){const o=cur[id];L.snap[id]=snapOf(o);const tk=o.act[td]||0;if(tk>0){const b=B(td);b.t+=tk*15;if(b.c.indexOf(id)<0)b.c.push(id);}}
    L.last=td;LS.set(K,JSON.stringify(L));return L;}
  const from=L.last&&L.last<=td?L.last:td;let ch=false;
  for(const id in cur){
    const o=cur[id],s=L.snap[id]||{t:0,a:0,x:0,act:{}},D={t:Math.max(0,o.t-(s.t||0)),a:Math.max(0,o.a-(s.a||0)),x:Math.max(0,o.x-(s.x||0))};
    L.snap[id]=snapOf(o);
    if(!(D.t>0||D.a>0||D.x>0))continue;ch=true;
    const W={},pa=s.act||{};let tot=0;
    for(const d in o.act){if(d<from||d<lo||d>td)continue;const n=(o.act[d]||0)-(pa[d]||0);if(n>0){W[d]=n;tot+=n;}}
    if(!tot){let d=o.lt?dayOf(o.lt):td;if(d<from||d>td)d=td;W[d]=1;tot=1;}
    for(const d in W){const w=W[d]/tot,b=B(d);b.t=Math.round((b.t+D.t*w)*100)/100;b.a=Math.round((b.a+D.a*w)*100)/100;b.x=Math.round((b.x+D.x*w)*100)/100;
      b.p=Math.round((b.p+D.x*w/mxOf(id)*1000)*100)/100;if(b.c.indexOf(id)<0)b.c.push(id);}}
  for(const id in L.snap)if(!cur[id]){delete L.snap[id];ch=true;}
  const cut=addDays(td,-LKEEP);for(const d in L.days)if(d<cut){delete L.days[d];ch=true;}
  if(L.last!==td){L.last=td;ch=true;}
  if(ch)LS.set(K,JSON.stringify(L));
  return L;
}
function dayScore(b){if(!b)return {s:0,t:0,p:0,r:0,on:false};const t=Math.round(Math.min((+b.t||0)/60,SCORE.tCap)),p=Math.round(Math.min(+b.p||0,SCORE.pCap)),on=(+b.t||0)>=SCORE.actT||(+b.a||0)>=SCORE.actA,r=on?SCORE.act:0;
  return {s:t+p+r,t,p,r,on};}   // entiers, et s = t + p + r exactement (les règles du serveur le vérifient)
function periodScore(L,days){const o={s:0,t:0,p:0,r:0,d:0};for(const d of days){const x=dayScore(L&&L.days&&L.days[d]);o.s+=x.s;o.t+=x.t;o.p+=x.p;o.r+=x.r;if(x.on)o.d++;}return o;}
function periods(){
  const td=today(),w=weekOf(td),ws=dayOf(w*DAY),m=monthOf(td),wd=[],md=[];
  for(let i=0;i<7;i++){const d=addDays(ws,i);if(d<=td)wd.push(d);}
  for(let d=td.slice(0,8)+'01';monthOf(d)===m&&d<=td;d=addDays(d,1))md.push(d);
  let mEnd=td;while(monthOf(addDays(mEnd,1))===m)mEnd=addDays(mEnd,1);
  return {today:td,week:{id:w,start:ws,end:addDays(ws,6),days:wd,label:'Semaine du '+fmtD(ws)+' au '+fmtD(addDays(ws,6))},
    month:{id:m,days:md,end:mEnd,left:eDay(mEnd)-eDay(td)+1,label:monthLabel(m)}};
}
function myScores(p){const L=J(LS.get(ledgerKey(p)),null),P=periods();return {week:Object.assign({id:P.week.id},periodScore(L,P.week.days)),month:Object.assign({id:P.month.id},periodScore(L,P.month.days)),since:L&&L.since||null};}

/* ─────────────── 06 · fiche publique ─────────────── */
function publicStats(p){
  const cat=catalog(),cur=collect(p),L=J(LS.get(ledgerKey(p)),null),P=periods(),courses=[];let tot=0;
  for(const id in cur){const o=cur[id],c=cat[id];tot+=o.t;if(!(o.x>0||o.t>=60))continue;
    const m=Math.max(c&&c.mx?Math.min(1,o.x/c.mx):0,Math.min(1,Math.floor(o.t/5400)*.25));   // même règle que les accueils : XP ou paliers de 1 h 30
    courses.push({n:c?c.n:id,lv:c?c.lv:'',m:Math.round(m*100)/100,t:Math.round(o.t/60)});}
  courses.sort((a,b)=>b.m-a.m||b.t-a.t);
  const wk=[];for(let i=7;i>=0;i--){const ws=dayOf((P.week.id-7*i)*DAY);let t=0;for(let k=0;k<7;k++){const b=L&&L.days&&L.days[addDays(ws,k)];if(b)t+=+b.t||0;}wk.push(Math.round(t/60));}
  let streak=0;for(let d=P.today;;d=addDays(d,-1)){const x=dayScore(L&&L.days&&L.days[d]);if(x.on)streak++;else if(d!==P.today)break;if(streak>400)break;}
  return {c:courses.slice(0,40),wk,st:streak,tt:Math.round(tot/60)};
}

/* ─────────────── 07 · Firebase, chargé à la demande ─────────────── */
const S={cfg:!!CFG,sdk:'idle',err:'',user:null,uid:null,pseudo:'',meta:null,prof:null,onboarded:false,needLink:null,
  sync:{busy:false,last:+(LS.get('rvo_last')||0)||0,err:''},boot:false};
let FB=null,sdkP=null;
function sdk(){
  if(!CFG)return Promise.reject(new Error('non configuré'));
  if(sdkP)return sdkP;
  S.sdk='loading';emit();
  const base=new URL('./vendor/',import.meta.url).href;
  sdkP=Promise.all([import(base+'firebase-app.js'),import(base+'firebase-auth.js'),import(base+'firebase-firestore-lite.js')]).then(([app,auth,fs])=>{
    const A=app.initializeApp(CFG);FB={app,auth,fs,A,au:auth.getAuth(A),db:fs.getFirestore(A)};
    try{FB.au.languageCode='fr';}catch(e){}
    S.sdk='ready';emit();
    auth.onAuthStateChanged(FB.au,u=>{onUser(u).catch(e=>fail('compte',e));});
    return FB;
  }).catch(e=>{S.sdk='error';S.err='Impossible de joindre le service en ligne ('+(e&&e.message||e)+').';sdkP=null;emit();throw e;});
  return sdkP;
}
const D=(...p)=>FB.fs.doc(FB.db,...p);
const Col=(...p)=>FB.fs.collection(FB.db,...p);
function fail(where,e){const m=(e&&(e.code||e.message))||String(e);console.warn('[R·Vision en ligne] '+where+' :',e);S.err=errFr(m);emit();}
function errFr(m){
  if(/permission|insufficient/i.test(m))return 'Accès refusé par le serveur (règles de sécurité). Vérifie que firestore.rules a bien été publié.';
  if(/network|unavailable|offline|failed to fetch/i.test(m))return 'Pas de connexion au serveur — nouvel essai plus tard.';
  if(/popup-blocked/i.test(m))return 'Le navigateur a bloqué la fenêtre de connexion. Autorise les fenêtres surgissantes pour ce site.';
  if(/popup-closed|cancelled-popup/i.test(m))return 'Connexion annulée.';
  if(/unauthorized-domain/i.test(m))return 'Ce site n’est pas autorisé dans Firebase (Authentication → Paramètres → Domaines autorisés).';
  if(/quota|resource-exhausted/i.test(m))return 'Quota gratuit du jour atteint — la synchro reprendra demain.';
  return 'Erreur : '+m;
}

/* ─────────────── 08 · compte : connexion, liaison au profil, inscription ─────────────── */
async function signIn(){
  await sdk();const {auth}=FB,pr=new auth.GoogleAuthProvider();pr.setCustomParameters({prompt:'select_account'});
  S.err='';emit();
  try{await auth.signInWithPopup(FB.au,pr);}
  catch(e){if(e&&/popup-blocked|operation-not-supported/.test(e.code||'')){LS.set('rvo_auth','1');await auth.signInWithRedirect(FB.au,pr);return;}fail('connexion',e);throw e;}
}
async function signOut(){if(!FB)return;try{await sync('sortie');}catch(e){}await FB.auth.signOut(FB.au);}
async function onUser(u){
  if(!u){Object.assign(S,{user:null,uid:null,pseudo:'',meta:null,prof:null,onboarded:false,needLink:null});LS.del('rvo_auth');emit();return;}
  LS.set('rvo_auth','1');const c0=curUser();
  S.user={name:u.displayName||'',email:u.email||''};S.uid=u.uid;S.err='';emit();
  const ms=await FB.fs.getDoc(D('users',u.uid,'sync','meta'));S.meta=ms.exists()?ms.data():null;
  const ps=await FB.fs.getDoc(D('profiles',u.uid));S.prof=ps.exists()?ps.data():null;S.onboarded=!!S.prof;
  S.pseudo=(S.meta&&S.meta.p)||'';
  linkCheck();emit();
  if(S.pseudo)await sync('connexion');
  if(S.onboarded){await publish(true).catch(e=>fail('publication',e));settle().catch(e=>fail('tournoi',e));}
  profEvt(c0);emit();
}
/* le profil actif de l'appareil a changé (connexion sur un nouvel appareil, inscription) : la page le recharge */
function profEvt(c0){if(curUser()!==c0)window.dispatchEvent(new CustomEvent('rvision:synced',{detail:{keys:['*'],profile:true}}));}
/* le compte suit un profil (S.pseudo). Profil actif différent sur cet appareil → on le signale, sans rien imposer */
function linkCheck(){
  const c=curUser();S.needLink=null;
  if(!S.pseudo)return;
  if(!c){ensureProfile(S.pseudo);LS.set('rvision_current_user',S.pseudo);return;}
  if(c!==S.pseudo)S.needLink={account:S.pseudo,local:c};
}
/* choix proposé par le Registre : « use » = passer sur le profil du compte ; « merge » = verser le profil actif dans
   celui du compte (fusion clé par clé, rien n'est effacé), puis passer dessus */
function link(choice){
  const L=S.needLink;if(!L)return;
  if(choice==='merge'){const A=localMap(L.local),PA='rvision_'+L.account+'_';
    for(const ck in A){if(ck.charAt(0)!=='@')continue;const k=PA+ck.slice(1),cur=LS.get(k),mv=mergeVal(cur,A[ck],ck);if(mv!=null&&mv!==cur)LS.set(k,mv);}}
  ensureProfile(L.account);LS.set('rvision_current_user',L.account);S.needLink=null;emit();
  sync('liaison').catch(e=>fail('synchro',e));
  window.dispatchEvent(new CustomEvent('rvision:synced',{detail:{keys:['*'],profile:true}}));
}
const HANDLE_RE=/^[a-z0-9_]{3,20}$/;
function slug(s){return String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9_]+/g,'_').replace(/^_+|_+$/g,'').slice(0,20);}
/* inscription au mode en ligne : pseudo public unique (@…) et visibilité ; pseudo local si l'appareil n'en a pas */
async function onboard(o){
  await sdk();if(!S.uid)throw new Error('Connecte-toi d’abord.');
  const h=slug(o.handle),vis=o.vis==='friends'?'friends':'public';
  if(!HANDLE_RE.test(h))throw new Error('Pseudo en ligne : 3 à 20 caractères (lettres, chiffres, _).');
  let p=S.pseudo||curUser()||String(o.pseudo||'').trim().slice(0,20);
  if(!p)throw new Error('Choisis d’abord un prénom ou pseudo.');const c0=curUser();
  const {fs}=FB,hr=D('handles',h),hs=await fs.getDoc(hr);
  if(hs.exists()&&hs.data().uid!==S.uid)throw new Error('@'+h+' est déjà pris — essaie une variante.');
  if(!hs.exists())await fs.setDoc(hr,{uid:S.uid,t:Date.now()});
  if(S.prof&&S.prof.h&&S.prof.h!==h){try{await fs.deleteDoc(D('handles',S.prof.h));}catch(e){}}
  ensureProfile(p);if(!curUser())LS.set('rvision_current_user',p);
  if(!S.pseudo){S.pseudo=p;await fs.setDoc(D('users',S.uid,'sync','meta'),{p,c:Date.now(),u:Date.now()},{merge:true});S.meta=Object.assign({},S.meta||{},{p});}
  S.prof=Object.assign({},S.prof||{},{n:p,h,vis});S.onboarded=true;linkCheck();emit();
  await sync('inscription');await publish(true);settle().catch(()=>{});profEvt(c0);emit();
}
async function setVis(vis){
  if(!S.onboarded)return;vis=vis==='friends'?'friends':'public';S.prof.vis=vis;emit();
  if(vis==='friends'){const P=periods();await Promise.all([FB.fs.deleteDoc(D('weeks',String(P.week.id),'e',S.uid)),FB.fs.deleteDoc(D('months',String(P.month.id),'e',S.uid))]).catch(()=>{});}
  LS.del('rvo_pub_'+S.uid);await publish(true);BOARD.c={};
}

/* ─────────────── 09 · synchronisation (fusion à trois voies) ─────────────── */
let syncP=null,syncAgain=false;
function sync(why){
  if(!S.uid||!S.pseudo||!FB)return Promise.resolve(false);
  if(syncP){syncAgain=true;return syncP;}
  S.sync.busy=true;S.sync.err='';emit();
  syncP=doSync(why).then(r=>{S.sync.last=Date.now();LS.set('rvo_last',String(S.sync.last));return r;})
    .catch(e=>{S.sync.err=errFr((e&&(e.code||e.message))||String(e));console.warn('[R·Vision en ligne] synchro :',e);return false;})
    .finally(()=>{S.sync.busy=false;syncP=null;emit();if(syncAgain){syncAgain=false;setTimeout(()=>sync('suite'),400);}});
  return syncP;
}
async function doSync(why){
  const {fs}=FB,uid=S.uid,p=S.pseudo,pres=users().includes(p);
  const kKey='rvo_rev_'+uid,bKey='rvo_base_'+uid,known=J(LS.get(kKey),{})||{},base=J(LS.get(bKey),{})||{};
  /* profil supprimé exprès sur cet appareil après une synchro : on ne touche à rien (ni effacement dans le cloud,
     ni résurrection locale). Il revient si l'on rechoisit ce profil ou si l'on se reconnecte. */
  if(!pres&&Object.keys(base).length&&curUser()!==p)return {skipped:'profil absent de cet appareil',why};
  if(pres)ledgerUpdate(p);
  const metaRef=D('users',uid,'sync','meta'),mSnap=await fs.getDoc(metaRef),meta=mSnap.exists()?mSnap.data():{};
  const rr=meta.r||{};
  const changed=[];for(let i=0;i<NS;i++)if((rr['s'+i]|0)!==(known['s'+i]|0))changed.push(i);
  const R={};await Promise.all(changed.map(async i=>{const d=await fs.getDoc(D('users',uid,'sync','s'+i));R[i]=d.exists()?(d.data().d||{}):{};}));
  const Lm=localMap(p),keys=new Set([...Object.keys(Lm),...Object.keys(base)]);changed.forEach(i=>{for(const k in R[i])keys.add(k);});
  /* garde-fou : une disparition massive des données de l'appareil (profil supprimé sur l'index, stockage vidé…)
     n'est jamais recopiée dans le cloud — on restaure au lieu d'effacer */
  let dels=0;for(const ck of keys)if(Lm[ck]==null&&base[ck])dels++;
  const nBase=Object.keys(base).length,massive=!pres||dels>20||(dels>=2&&dels>=nBase*.25);   // une remise à zéro d'un cours (quelques clés) passe ; un quart du profil, non
  const W={},nb=Object.assign({},base),got=[];let pushed=0;
  const put=(ck,v)=>{(W[shardOf(ck)]=W[shardOf(ck)]||{})[ck]=v;pushed++;};
  const setLocal=(ck,v)=>{const k=toLocal(ck,p);if(v==null)LS.del(k);else LS.set(k,v);got.push(ck);};
  const BIG=900000;
  for(const ck of keys){
    const sh=shardOf(ck),read=changed.indexOf(sh)>=0,lv=Lm[ck],lh=H(lv),bh=base[ck]||null;
    let rv=read?R[sh][ck]:undefined,rh=read?H(rv):bh;
    if(lv!=null&&lv.length>BIG)continue;                       // valeur trop grosse pour un document : laissée sur l'appareil
    if(lh===rh){if(lh)nb[ck]=lh;else delete nb[ck];continue;}
    if(lv==null&&massive){                                       // absente ici à cause d'un effacement massif → on restaure
      if(read){if(rv!=null){setLocal(ck,rv);nb[ck]=rh;}else delete nb[ck];}
      else{const d=await fs.getDoc(D('users',uid,'sync','s'+sh));R[sh]=d.exists()?(d.data().d||{}):{};changed.push(sh);rv=R[sh][ck];if(rv!=null){setLocal(ck,rv);nb[ck]=H(rv);}else delete nb[ck];}
      continue;}
    if(lh===bh){setLocal(ck,rv);if(rh)nb[ck]=rh;else delete nb[ck];continue;}          // seul le cloud a changé
    if(rh===bh){put(ck,lv==null?null:lv);if(lh)nb[ck]=lh;else delete nb[ck];continue;}  // seul l'appareil a changé
    const mv=mergeVal(lv,rv,ck);                                   // les deux ont changé : fusion
    if(mv==null){setLocal(ck,null);put(ck,null);delete nb[ck];continue;}
    if(mv!==lv)setLocal(ck,mv);if(mv!==rv)put(ck,mv);nb[ck]=H(mv);
  }
  const nk=Object.assign({},known);changed.forEach(i=>{nk['s'+i]=rr['s'+i]|0;});
  const shards=Object.keys(W);
  if(shards.length){
    const b=fs.writeBatch(FB.db),inc={};
    for(const sh of shards){const o={};for(const ck in W[sh])o[ck]=W[sh][ck]==null?fs.deleteField():W[sh][ck];
      b.set(D('users',uid,'sync','s'+sh),{d:o},{merge:true});inc['s'+sh]=fs.increment(1);nk['s'+sh]=(rr['s'+sh]|0)+1;}
    b.set(metaRef,{p,r:inc,u:Date.now(),c:meta.c||Date.now()},{merge:true});
    await b.commit();
  }else if(!mSnap.exists()){await fs.setDoc(metaRef,{p,r:{},u:Date.now(),c:Date.now()},{merge:true});}
  LS.set(bKey,JSON.stringify(nb));LS.set(kKey,JSON.stringify(nk));
  if(!pres&&got.length)ensureProfile(p);
  if(got.length){ledgerUpdate(p);window.dispatchEvent(new CustomEvent('rvision:synced',{detail:{keys:got}}));emitT('synced',{keys:got});}
  return {pulled:got.length,pushed,why};
}
/* l'appareil a-t-il des changements à envoyer ? (comparaison locale, sans réseau) */
function dirty(){if(!S.uid||!S.pseudo)return false;const base=J(LS.get('rvo_base_'+S.uid),{})||{},Lm=localMap(S.pseudo);
  for(const ck in Lm)if(base[ck]!==H(Lm[ck]))return true;for(const ck in base)if(Lm[ck]==null)return true;return false;}

/* ─────────────── 10 · publication : fiche publique, entrées des classements ─────────────── */
let pubT=0;
async function publish(force){
  if(!S.onboarded||!S.uid||!FB)return;
  if(!force&&Date.now()-pubT<45000)return;pubT=Date.now();
  const p=S.pseudo,sc=myScores(p),st=publicStats(p),tr=trophies(),pr=S.prof;
  const doc={n:p.slice(0,24),h:pr.h,vis:pr.vis,w:{id:sc.week.id,s:sc.week.s,t:sc.week.t,p:sc.week.p,r:sc.week.r,d:sc.week.d},
    m:{id:sc.month.id,s:sc.month.s,t:sc.month.t,p:sc.month.p,r:sc.month.r,d:sc.month.d},st,tr:tr.slice(-24),u:Date.now()};
  const sig=H(JSON.stringify(Object.assign({},doc,{u:0}))),k='rvo_pub_'+S.uid;
  if(!force&&LS.get(k)===sig)return;
  const {fs}=FB,b=fs.writeBatch(FB.db);
  b.set(D('profiles',S.uid),doc);
  if(pr.vis==='public'){
    const e=x=>({n:doc.n,h:doc.h,s:x.s,t:x.t,p:x.p,r:x.r,d:x.d,u:doc.u});
    b.set(D('weeks',String(sc.week.id),'e',S.uid),e(sc.week));b.set(D('months',String(sc.month.id),'e',S.uid),e(sc.month));}
  await b.commit();S.prof=doc;LS.set(k,sig);BOARD.c={};emit();
}

/* ─────────────── 11 · classements ─────────────── */
const BOARD={c:{}};
async function board(kind,id){
  await sdk();const P=periods();kind=kind||'week';
  const pid=id||(kind==='month'?P.month.id:P.week.id),ck=kind+':'+pid,hit=BOARD.c[ck];
  if(hit&&Date.now()-hit.t<60000)return hit.v;
  let rows=[],me=null,rank=null;
  if(kind==='friends'){
    const F=await friends(),sc=S.pseudo?myScores(S.pseudo):null;
    for(const f of F.friends){if(!f.prof)continue;const w=f.prof.w&&f.prof.w.id===P.week.id?f.prof.w:{s:0,t:0,p:0,r:0,d:0};rows.push({uid:f.uid,n:f.prof.n,h:f.prof.h,s:w.s,t:w.t,p:w.p,r:w.r,d:w.d});}
    if(S.onboarded&&sc)rows.push({uid:S.uid,n:S.pseudo,h:S.prof.h,s:sc.week.s,t:sc.week.t,p:sc.week.p,r:sc.week.r,d:sc.week.d});
    rows.sort((a,b)=>b.s-a.s);
  }else{
    const {fs}=FB,col=Col(kind==='month'?'months':'weeks',String(pid),'e');
    const qs=await fs.getDocs(fs.query(col,fs.orderBy('s','desc'),fs.limit(50)));
    qs.forEach(d=>rows.push(Object.assign({uid:d.id},d.data())));
    if(S.uid&&S.onboarded&&S.prof.vis==='public'&&!rows.some(r=>r.uid===S.uid)){
      const sc=myScores(S.pseudo),x=kind==='month'?sc.month:sc.week;
      if((kind==='month'?P.month.id:P.week.id)===pid){
        try{const c=await fs.getCount(fs.query(col,fs.where('s','>',x.s)));rank=c.data().count+1;}catch(e){}
        me={uid:S.uid,n:S.pseudo,h:S.prof.h,s:x.s,t:x.t,p:x.p,r:x.r,d:x.d,rank};}}
  }
  rows.forEach((r,i)=>{r.rank=i+1;r.me=r.uid===S.uid;});
  const v={kind,id:pid,rows,me,at:Date.now()};BOARD.c[ck]={t:Date.now(),v};return v;
}
async function profileOf(uid){await sdk();const d=await FB.fs.getDoc(D('profiles',uid));return d.exists()?Object.assign({uid},d.data()):null;}

/* ─────────────── 12 · amis ───────────────
   friendships/<uidA_uidB> (ordre alphabétique) : {m:[a,b], from, to, st:'pending'|'accepted', fn, fh, tn, th} */
const pairId=(a,b)=>a<b?a+'_'+b:b+'_'+a;
let FR={t:0,v:null};
async function friends(fresh){
  await sdk();if(!S.uid)return {friends:[],incoming:[],outgoing:[]};
  if(!fresh&&FR.v&&Date.now()-FR.t<30000)return FR.v;
  const {fs}=FB,col=Col('friendships'),all=[];
  const [a,b]=await Promise.all([fs.getDocs(fs.query(col,fs.where('from','==',S.uid))),fs.getDocs(fs.query(col,fs.where('to','==',S.uid)))]);
  a.forEach(d=>all.push(Object.assign({id:d.id},d.data())));b.forEach(d=>all.push(Object.assign({id:d.id},d.data())));
  const out={friends:[],incoming:[],outgoing:[]};
  for(const f of all){const other=f.from===S.uid?f.to:f.from,n=f.from===S.uid?f.tn:f.fn,h=f.from===S.uid?f.th:f.fh,it={id:f.id,uid:other,n:n||h,h};
    if(f.st==='accepted')out.friends.push(it);else if(f.to===S.uid)out.incoming.push(it);else out.outgoing.push(it);}
  await Promise.all(out.friends.map(async f=>{try{f.prof=await profileOf(f.uid);if(f.prof){f.n=f.prof.n;f.h=f.prof.h;}}catch(e){f.prof=null;}}));
  FR={t:Date.now(),v:out};return out;
}
async function requestFriend(handle){
  await sdk();if(!S.onboarded)throw new Error('Inscris-toi d’abord au mode en ligne.');
  const h=slug(String(handle||'').replace(/^@/,''));if(!HANDLE_RE.test(h))throw new Error('Pseudo invalide.');
  const {fs}=FB,hs=await fs.getDoc(D('handles',h));if(!hs.exists())throw new Error('Personne ne s’appelle @'+h+'.');
  const to=hs.data().uid;if(to===S.uid)throw new Error('C’est toi !');
  const id=pairId(S.uid,to),ref=D('friendships',id),ex=await fs.getDoc(ref);
  if(ex.exists()){const f=ex.data();if(f.st==='accepted')throw new Error('@'+h+' est déjà ton ami.');
    if(f.to===S.uid){await acceptFriend(id);return 'accepted';}throw new Error('Demande déjà envoyée à @'+h+'.');}
  let tn=h;try{const pr=await fs.getDoc(D('profiles',to));if(pr.exists())tn=pr.data().n||h;}catch(e){}
  await fs.setDoc(ref,{m:[S.uid,to].sort(),from:S.uid,to,st:'pending',fn:S.pseudo,fh:S.prof.h,tn,th:h,t:Date.now()});
  FR.t=0;BOARD.c={};return 'sent';
}
async function acceptFriend(id){await sdk();await FB.fs.updateDoc(D('friendships',id),{st:'accepted',at:Date.now()});FR.t=0;BOARD.c={};}
async function removeFriend(id){await sdk();await FB.fs.deleteDoc(D('friendships',id));FR.t=0;BOARD.c={};}

/* ─────────────── 13 · tournoi du mois : trophées ───────────────
   Le classement du mois est figé deux jours après la fin du mois (les dernières révisions ont le temps d'arriver).
   Le premier remporte la coupe : elle s'ajoute à sa clé rvision_<profil>_trophees (synchronisée) et à sa fiche.
   La bibliothèque l'expose sous les cloches de la tablette des trophées. Seuls les profils publics concourent. */
const trophies=()=>{const p=S.pseudo||curUser();const t=p?J(LS.get('rvision_'+p+'_trophees'),[]):[];return Array.isArray(t)?t:[];};
async function settle(){
  if(!S.onboarded||!FB)return;
  const td=today(),cm=monthOf(td),day=+td.slice(8,10),joined=monthOf(dayOf((S.meta&&S.meta.c)||Date.now())),sk='rvo_settled_'+S.uid,done=J(LS.get(sk),[])||[];
  let m=prevMonth(cm);const todo=[],res=[];
  for(let i=0;i<3&&m>=joined;i++,m=prevMonth(m)){if(m===prevMonth(cm)&&day<3)continue;if(!done.includes(m))todo.push(m);}
  for(const mm of todo){
    const qs=await FB.fs.getDocs(FB.fs.query(Col('months',String(mm),'e'),FB.fs.orderBy('s','desc'),FB.fs.limit(3))),pod=[];
    qs.forEach(d=>pod.push({uid:d.id,n:d.data().n,h:d.data().h,s:d.data().s}));
    LS.set('rvo_podium_'+mm,JSON.stringify(pod));
    const won=!!(pod[0]&&pod[0].uid===S.uid&&pod[0].s>0);
    if(won){const k='rvision_'+S.pseudo+'_trophees',t=trophies();
      if(!t.some(x=>x.m===mm)){t.push({m:mm,s:pod[0].s});t.sort((a,b)=>a.m-b.m);LS.set(k,JSON.stringify(t));emitT('trophy',{m:mm,s:pod[0].s});}}
    /* ma place : seulement si j'ai concouru (ligne publique avec des points) */
    let mine=null;try{const d=await FB.fs.getDoc(D('months',String(mm),'e',S.uid));if(d.exists())mine=d.data();}catch(e){}
    if(mine&&mine.s>0){let rank=won?1:(pod.findIndex(x=>x.uid===S.uid)+1)||null;
      if(!rank){try{const c=await FB.fs.getCount(FB.fs.query(Col('months',String(mm),'e'),FB.fs.where('s','>',mine.s)));rank=c.data().count+1;}catch(e){}}
      res.push({m:mm,won,rank,s:mine.s,w:pod[0]||null});}
    done.push(mm);}
  /* résultat du tournoi : animation spéciale, une seule fois par mois clôturé */
  const last=res.sort((a,b)=>b.m-a.m)[0],sk2='rvo_mres_'+S.uid;
  if(last&&LS.get(sk2)!==String(last.m)){LS.set(sk2,String(last.m));setTimeout(()=>monthShow(last),900);}
  if(todo.length){LS.set(sk,JSON.stringify(done.slice(-24)));await publish(true);sync('trophée');}
}
const podium=m=>J(LS.get('rvo_podium_'+m),null);

/* ─────────────── 14 · interface publique, démarrage ─────────────── */
const EV=new EventTarget();
let emitQ=0;
function emit(){if(emitQ)return;emitQ=requestAnimationFrame?requestAnimationFrame(fire):setTimeout(fire,16);}
function fire(){emitQ=0;const st=state();try{accRender();}catch(e){}EV.dispatchEvent(new CustomEvent('state',{detail:st}));window.dispatchEvent(new CustomEvent('rvision:online',{detail:st}));footer(st);}
function emitT(t,d){EV.dispatchEvent(new CustomEvent(t,{detail:d}));}
function state(){return {cfg:S.cfg,sdk:S.sdk,err:S.err,user:S.user,uid:S.uid,pseudo:S.pseudo,local:curUser(),handle:S.prof&&S.prof.h||'',vis:S.prof&&S.prof.vis||'',
  onboarded:S.onboarded,needLink:S.needLink,sync:Object.assign({},S.sync),trophies:trophies()};}
/* fenêtre de profil de la L1 / L2 : la mention « rien n'est envoyé » devient fausse une fois connecté */
function footer(st){try{document.querySelectorAll('.pm-ft').forEach(e=>{if(!e.dataset.rvo0)e.dataset.rvo0=e.textContent;
  e.textContent=st.uid&&st.pseudo?'Profil « '+st.pseudo+' » synchronisé avec ton compte Google'+(st.handle?' · @'+st.handle:''):e.dataset.rvo0;});}catch(e){}}
function ensure(){if(!CFG)return Promise.resolve(null);return sdk().catch(()=>null);}
async function syncNow(){await ensure();if(!S.uid)return false;const r=await sync('manuel');await publish(true).catch(e=>fail('publication',e));return r;}

/* activité de fond : registre des jours, envoi des changements (toutes les 2 min si besoin), sortie de page */
let tick=0;
function background(){
  const p=S.pseudo||curUser();
  try{if(p)ledgerUpdate(p);}catch(e){console.warn(e);}
  if(S.uid&&S.pseudo&&!S.sync.busy){
    if(dirty()||Date.now()-S.sync.last>300000)sync('fond').then(()=>publish(false)).catch(()=>{});
    else publish(false).catch(()=>{});}
}
function start(){
  if(S.boot||!CFG)return;S.boot=true;
  try{catalog();}catch(e){}
  try{const p=curUser();if(p)ledgerUpdate(p);}catch(e){}
  if(LS.get('rvo_auth')==='1')ensure();                       // déjà connecté sur cet appareil : on reprend la session
  tick=setInterval(()=>{if(!document.hidden)background();},120000);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){if(S.uid&&dirty())sync('sortie');}else background();});
  addEventListener('storage',e=>{if(e.key==='rvision_current_user'){S.needLink=null;linkCheck();emit();}});
}

/* ─────────────── 15 · compte dans la fenêtre de profil « Qui révise ? » (L1, L2) ───────────────
   Un bloc « Compte en ligne » s'ajoute de lui-même à la fenêtre de profil des accueils : connexion Google en un clic
   (y compris à la toute première visite, pour retrouver sa progression sur un nouvel appareil), inscription express,
   état de la synchro. Aucune ligne des pages n'est modifiée : le module repère la fenêtre et s'y greffe. */
const ACC={el:null,scr:'',modal:false,prop:null};   // prop : la proposition qui suit la création d'un profil
const GLOGO='<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
function accCss(){
  if(document.getElementById('rvo-acc-css'))return;const st=document.createElement('style');st.id='rvo-acc-css';
  st.textContent='#pm .pm-box{max-height:calc(100vh - 24px);overflow-y:auto;scrollbar-width:thin;}'
   +'.rvo-acc .rvo-t{font-size:11px;line-height:1.6;color:rgba(246,241,234,.62);margin:0 0 12px;}'
   +'.rvo-acc .rvo-g{width:100%;}.rvo-acc .rvo-g svg{width:17px;height:17px;flex:none;background:#fff;border-radius:50%;padding:2px;}'
   +'.rvo-acc .rvo-row{display:flex;gap:10px 16px;flex-wrap:wrap;align-items:center;justify-content:space-between;}'
   +'.rvo-acc .rvo-st{font-size:11px;letter-spacing:.04em;color:rgba(246,241,234,.78);line-height:1.6;}.rvo-acc .rvo-st b{color:var(--pa,#ffc58a);font-weight:700;}'
   +'.rvo-acc .rvo-a,.rvo-prop .rvo-a{font:inherit;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--pa,#ffc58a);text-decoration:none;background:none;border:0;padding:4px 0;cursor:pointer;}'
   +'.rvo-acc .rvo-a.dim,.rvo-prop .rvo-a.dim{color:rgba(246,241,234,.5);}.rvo-acc .rvo-a:hover,.rvo-prop .rvo-a:hover{color:#fff;}'
   +'.rvo-acc .rvo-e{font-size:11px;color:#ff9a8a;margin:8px 0 0;}.rvo-acc .rvo-e:empty{display:none;}'
   +'.rvo-acc .rvo-lb{display:block;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:rgba(246,241,234,.45);margin:12px 0 2px;}'
   +'.rvo-acc .rvo-at{display:flex;align-items:center;gap:6px;}.rvo-acc .rvo-at span{color:var(--pa,#ffc58a);font-weight:700;}.rvo-acc .rvo-at .pm-in,.rvo-acc .rvo-f>.pm-in{width:100%;}'
   +'.rvo-acc .rvo-vis{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:6px 0 12px;}'
   +'.rvo-acc .rvo-vis button{font:inherit;text-align:left;color:rgba(246,241,234,.7);background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.1);border-radius:0;padding:8px 10px;cursor:pointer;}'
   +'.rvo-acc .rvo-vis b{display:block;font-size:11px;color:#fff;letter-spacing:.06em;}.rvo-acc .rvo-vis small{display:block;font-size:9.5px;opacity:.65;line-height:1.4;margin-top:2px;}'
   +'.rvo-acc .rvo-vis button.on{border-color:var(--pa,#ffc58a);background:rgba(255,197,138,.08);}'
   +'.rvo-acc .rvo-f .pm-go{width:100%;}'
   +'.rvo-prop{position:fixed;left:50%;bottom:24px;z-index:80;width:min(430px,calc(100vw - 24px));max-height:calc(100vh - 48px);overflow-y:auto;padding:20px 24px 18px;'
   +'background:linear-gradient(180deg,rgba(18,15,13,.9),rgba(11,9,8,.95));backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border:1px solid rgba(255,255,255,.1);'
   +'color:#f6f1ea;opacity:0;transform:translate(-50%,16px);transition:opacity .45s ease,transform .6s cubic-bezier(.2,.8,.2,1);pointer-events:none;}'
   +'.rvo-prop.on{opacity:1;transform:translate(-50%,0);pointer-events:auto;}'
   +'.rvo-prop .pm-c{position:absolute;width:14px;height:14px;border:0 solid #fff;opacity:.9;}'
   +'.rvo-prop .tl{top:-1px;left:-1px;border-top-width:1px;border-left-width:1px;}.rvo-prop .tr{top:-1px;right:-1px;border-top-width:1px;border-right-width:1px;}'
   +'.rvo-prop .bl{bottom:-1px;left:-1px;border-bottom-width:1px;border-left-width:1px;}.rvo-prop .br{bottom:-1px;right:-1px;border-bottom-width:1px;border-right-width:1px;}'
   +'.rvo-prop .rvo-ph{display:flex;justify-content:space-between;align-items:center;gap:12px;font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:rgba(246,241,234,.5);}'
   +'.rvo-prop .rvo-pt{font-family:var(--logo,inherit);font-weight:800;font-size:19px;line-height:1.2;margin:10px 0 10px;}'
   +'@media (prefers-reduced-motion:reduce){.rvo-prop{transition:none;}}';
  document.head.appendChild(st);
}
function El(t,c,x,p){const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;if(p)p.appendChild(e);return e;}
function accScreen(){return S.sdk==='error'?'err':!S.uid&&(S.sdk==='loading'||(S.sdk==='idle'&&LS.get('rvo_auth')==='1'))?'load':!S.uid?'in':S.needLink?'link':!S.onboarded?'ob':'main';}
function accRender(){accInto(ACC);if(ACC.prop)accInto(ACC.prop);}
function accInto(C){
  const el=C.el;if(!el||!document.body.contains(el))return;const scr=accScreen();
  if(scr===C.scr){if(scr==='main')accStatus(el.querySelector('.rvo-st'));return;}   // même écran : on ne casse pas une saisie en cours
  C.scr=scr;el.textContent='';if(C===ACC)El('p','pm-sep','Compte en ligne',el);
  const err=()=>{const e=El('p','rvo-e',S.err||'',null);return e;};
  if(scr==='err'){El('p','rvo-t','Le service en ligne ne répond pas pour l’instant.',el);const b=El('button','rvo-a','Réessayer',el);b.type='button';b.onclick=()=>{sdkP=null;S.sdk='idle';ensure();};return;}
  if(scr==='load'){El('p','rvo-t','Ouverture de ton compte…',el);return;}
  if(scr==='in'){
    El('p','rvo-t','Connecte-toi pour retrouver ta progression sur tous tes appareils, entrer au classement et ajouter des amis. Déjà inscrit ailleurs ? Ton profil revient en un clic.',el);
    const b=El('button','pm-go rvo-g',null,el);b.type='button';b.innerHTML=GLOGO+'<span>Se connecter avec Google</span>';
    const e=err();el.appendChild(e);
    b.onclick=async()=>{if(C===ACC)ACC.modal=true;b.disabled=true;e.textContent='';try{await signIn();}catch(x){e.textContent=S.err||String(x&&x.message||x);}b.disabled=false;};
    return;}
  if(scr==='link'){const L=S.needLink;
    El('p','rvo-t','Ton compte Google suit le profil « '+L.account+' ». Sur cet appareil, le profil actif est « '+L.local+' ».',el);
    const r=El('div','rvo-row',null,el),a=El('button','rvo-a','Passer sur « '+L.account+' »',r),m=El('button','rvo-a dim','Verser « '+L.local+' » dedans',r);a.type=m.type='button';
    a.onclick=()=>link('use');m.onclick=()=>link('merge');return;}
  if(scr==='ob'){
    const f=El('form','rvo-f',null,el);f.autocomplete='off';
    El('p','rvo-t','Dernière étape : ton pseudo en ligne et qui peut voir ton avancement.',f);
    const local=S.pseudo||curUser();let pin=null;
    if(!local){El('label','rvo-lb','Prénom ou pseudo (ton profil R·Vision)',f);pin=El('input','pm-in',null,f);pin.maxLength=20;pin.placeholder='Max…';}
    El('label','rvo-lb','Pseudo en ligne — unique, sert à t’ajouter en ami',f);
    const at=El('div','rvo-at',null,f);El('span',null,'@',at);const hin=El('input','pm-in',null,at);hin.maxLength=20;hin.placeholder='max';hin.value=slug(local||'');
    if(pin)pin.addEventListener('input',()=>{hin.value=slug(pin.value);});
    const vs=El('div','rvo-vis',null,f);let vis='public';const vb=[];
    [['public','Public','Classement général et tournoi du mois'],['friends','Amis seulement','Seuls tes amis te voient']].forEach(([k,t,d])=>{
      const b=El('button',k==='public'?'on':'',null,vs);b.type='button';El('b',null,t,b);El('small',null,d,b);vb.push(b);b.onclick=()=>{vis=k;vb.forEach(x=>x.classList.toggle('on',x===b));};});
    const go=El('button','pm-go',null,f);go.type='submit';go.innerHTML='<span>Valider</span><b aria-hidden="true">→</b>';const e=El('p','rvo-e',null,f);
    f.addEventListener('submit',async ev=>{ev.preventDefault();e.textContent='';go.disabled=true;
      try{await onboard({handle:hin.value,vis,pseudo:pin?pin.value:''});}catch(x){e.textContent=x&&x.message||String(x);go.disabled=false;}});
    return;}
  /* connecté */
  const r=El('div','rvo-row',null,el);accStatus(El('p','rvo-st',null,r));
  const ac=El('div','rvo-row',null,el),cl=El('a','rvo-a','Classement et amis →',ac),out=El('button','rvo-a dim','Se déconnecter',ac);
  cl.href=new URL('../bibliotheque.html?salle=classement',import.meta.url).href;out.type='button';out.onclick=()=>{signOut();};
  if(C===ACC&&ACC.modal&&curUser()){ACC.modal=false;setTimeout(()=>{const x=document.querySelector('#pm.on .pm-x');if(x)x.click();},1400);}   // connexion lancée d'ici : la fenêtre se referme sur le bon profil
  if(C===ACC.prop)setTimeout(propClose,2600);   // proposition aboutie : elle s'efface d'elle-même
}
/* proposition affichée juste après la création d'un nouveau profil (si l'on n'est pas connecté) */
function propOpen(name){
  if(ACC.prop||S.uid)return;accCss();ensure();
  const w=El('aside','rvo-prop',null,document.body);w.setAttribute('role','dialog');w.setAttribute('aria-label','Sauvegarder ton profil en ligne');
  ['tl','tr','bl','br'].forEach(k=>El('i','pm-c '+k,null,w));
  const h=El('div','rvo-ph',null,w);El('span',null,'Profil « '+name+' » créé',h);const x=El('button','rvo-a dim','Plus tard',h);x.type='button';
  El('p','rvo-pt','Sauvegarde-le avec ton compte Google',w);
  const body=El('div','rvo-acc',null,w);ACC.prop={el:body,scr:'',w};
  x.onclick=propClose;
  requestAnimationFrame(()=>w.classList.add('on'));accInto(ACC.prop);
}
function propClose(){const P=ACC.prop;if(!P)return;ACC.prop=null;P.w.classList.remove('on');setTimeout(()=>P.w.remove(),500);}
function accStatus(p){if(!p)return;p.textContent='';El('span',null,'Connecté · ',p);El('b',null,'@'+((S.prof&&S.prof.h)||''),p);
  El('span',null,' · '+(S.sync.busy?'synchronisation…':S.sync.err?S.sync.err:'synchronisé '+agoTxt(S.sync.last)),p);}
function agoTxt(ms){if(!ms)return 'à l’instant';const s=(Date.now()-ms)/1000;return s<60?'à l’instant':s<3600?'il y a '+Math.round(s/60)+' min':s<86400?'il y a '+Math.round(s/3600)+' h':'il y a '+Math.round(s/86400)+' j';}
function accMount(){
  const m=document.getElementById('pm'),box=m&&m.querySelector('.pm-box');if(!box)return false;
  if(!ACC.el||!box.contains(ACC.el)){accCss();ACC.el=document.createElement('div');ACC.el.className='rvo-acc';box.insertBefore(ACC.el,box.querySelector('.pm-ft'));ACC.scr='';
    new MutationObserver(()=>{if(m.classList.contains('on')){ensure();accRender();}}).observe(m,{attributes:true,attributeFilter:['class']});   // fenêtre ouverte : Firebase se prépare, le clic ouvrira la connexion sans délai
    if(m.classList.contains('on'))ensure();propHook(m);}
  accRender();return true;
}
function propHook(m){
  const f=m.querySelector('.pm-f');if(!f||f.dataset.rvo)return;f.dataset.rvo='1';
  f.addEventListener('submit',()=>{const v=((f.querySelector('.pm-in')||{}).value||'').trim();
    if(!v||users().includes(v)||S.uid)return;   // profil existant ou déjà connecté : rien à proposer
    setTimeout(()=>{if(curUser()===v&&!S.uid)propOpen(v);},700);},true);
}
function accWatch(){
  if(accMount())return;
  const ob=new MutationObserver(()=>{if(accMount())ob.disconnect();});ob.observe(document.body,{childList:true});
}


/* ─────────────── 16 · fin du tournoi du mois : animation de victoire ou de défaite ───────────────
   Jouée une fois, sur le premier accueil ouvert après la clôture (le 3 du mois suivant). Victoire : rayons d'or,
   la coupe surgit dans un éclat, gerbe d'étincelles. Défaite : la coupe d'argent se dissout en poussière, la place
   obtenue et le nom du vainqueur, puis l'invitation au tournoi suivant. */
const CUP_SVG='<svg viewBox="0 0 200 240" aria-hidden="true"><defs><linearGradient id="rvoM" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--m0)"/><stop offset=".45" stop-color="var(--m1)"/><stop offset=".75" stop-color="var(--m2)"/><stop offset="1" stop-color="var(--m1)"/></linearGradient>'
 +'<linearGradient id="rvoS" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".85"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>'
 +'<clipPath id="rvoC"><path d="M52 22h96v18c0 46-20 76-48 82-28-6-48-36-48-82z"/><path d="M92 120h16v34h-16z"/><path d="M70 156h60l10 18H60z"/><path d="M54 176h92v22H54z"/></clipPath></defs>'
 +'<path d="M52 34c-26 0-34 12-34 26 0 20 18 32 40 36" fill="none" stroke="url(#rvoM)" stroke-width="9"/><path d="M148 34c26 0 34 12 34 26 0 20-18 32-40 36" fill="none" stroke="url(#rvoM)" stroke-width="9"/>'
 +'<g fill="url(#rvoM)"><path d="M52 22h96v18c0 46-20 76-48 82-28-6-48-36-48-82z"/><path d="M92 120h16v34h-16z"/><path d="M70 156h60l10 18H60z"/><path d="M54 176h92v22H54z"/></g>'
 +'<path d="M66 30h12v14c0 30 8 52 20 62-20-6-32-30-32-62z" fill="#fff" opacity=".28"/><path d="M84 92l16-30 16 30z" fill="#fff" opacity=".12"/>'
 +'<g clip-path="url(#rvoC)"><rect class="rvo-shine" x="-120" y="0" width="70" height="240" fill="url(#rvoS)" transform="skewX(-18)"/></g></svg>';
function monthCss(){
  if(document.getElementById('rvo-mres-css'))return;const st=document.createElement('style');st.id='rvo-mres-css';
  st.textContent='#rvo-mres{position:fixed;inset:0;z-index:300;display:grid;place-items:center;font-family:"JetBrains Mono",monospace;color:#f6f1ea;opacity:0;transition:opacity .7s ease;}'
  +'#rvo-mres.on{opacity:1;}#rvo-mres canvas{position:absolute;inset:0;width:100%;height:100%;}'
  +'#rvo-mres .bg{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 45%,var(--bg0),#030207 72%);}'
  +'#rvo-mres .in{position:relative;text-align:center;padding:24px;max-width:min(560px,92vw);}'
  +'#rvo-mres .cup{width:min(190px,40vw);margin:0 auto 18px;opacity:0;transform:scale(.55) translateY(30px);filter:blur(8px) drop-shadow(0 0 0 transparent);transition:transform 1.4s cubic-bezier(.16,1,.3,1),opacity 1s ease,filter 1.2s ease;}'
  +'#rvo-mres.go .cup{opacity:1;transform:none;filter:blur(0) drop-shadow(0 0 34px var(--glow));}'
  +'#rvo-mres.lost.dust .cup{opacity:0;transform:translateY(-26px) scale(1.04);filter:blur(10px);transition:opacity 2.6s ease,transform 2.6s ease,filter 2.6s ease;}'
  +'#rvo-mres .rvo-shine{animation:rvoShine 3.2s 1.6s ease-in-out infinite;}@keyframes rvoShine{0%{transform:skewX(-18deg) translateX(0)}60%,100%{transform:skewX(-18deg) translateX(420px)}}'
  +'#rvo-mres .k{font-size:11px;letter-spacing:.42em;text-transform:uppercase;color:var(--acc);opacity:0;transform:translateY(8px);transition:all .8s ease 1.1s;}'
  +'#rvo-mres h2{font-family:Cinzel,"Times New Roman",serif;font-weight:700;font-size:clamp(30px,6vw,54px);letter-spacing:.08em;line-height:1.05;margin:10px 0 12px;'
  +'background:linear-gradient(180deg,var(--m0),var(--m1) 55%,var(--m2));-webkit-background-clip:text;background-clip:text;color:transparent;opacity:0;transform:translateY(10px);transition:all .9s ease 1.35s;}'
  +'#rvo-mres p{font-size:12.5px;line-height:1.7;color:rgba(246,241,234,.78);opacity:0;transform:translateY(8px);transition:all .8s ease 1.7s;}'
  +'#rvo-mres p b{color:#fff;}#rvo-mres p.s2{transition-delay:2.1s;margin-top:4px;}'
  +'#rvo-mres button{margin-top:22px;font:inherit;font-size:11px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:#fff;background:transparent;border:1px solid rgba(255,255,255,.4);padding:11px 22px;cursor:pointer;opacity:0;transition:opacity .8s ease 2.6s,background .25s,color .25s;}'
  +'#rvo-mres button:hover{background:var(--acc);color:#120d07;border-color:var(--acc);}'
  +'#rvo-mres.go .k,#rvo-mres.go h2,#rvo-mres.go p,#rvo-mres.go button{opacity:1;transform:none;}'
  +'@media (prefers-reduced-motion:reduce){#rvo-mres *{transition:none!important;animation:none!important;}}';
  document.head.appendChild(st);
}
function monthShow(r){
  if(document.getElementById('rvo-mres'))return;monthCss();
  const win=!!r.won,lab=monthLabel(r.m),o=document.createElement('div');o.id='rvo-mres';o.setAttribute('role','dialog');o.setAttribute('aria-label','Résultat du tournoi de '+lab);
  const V=win?{'--m0':'#fff3c4','--m1':'#f0c25a','--m2':'#9c6a1c','--glow':'rgba(255,200,90,.75)','--acc':'#ffc24a','--bg0':'#2a1b06'}
            :{'--m0':'#f4f7fb','--m1':'#aeb7c2','--m2':'#4d5662','--glow':'rgba(170,200,255,.35)','--acc':'#a9c4ff','--bg0':'#0e1424'};
  for(const k in V)o.style.setProperty(k,V[k]);if(!win)o.classList.add('lost');
  const bg=El('div','bg',null,o),cvs=El('canvas',null,null,o),inn=El('div','in',null,o);
  const cup=El('div','cup',null,inn);cup.innerHTML=CUP_SVG;
  El('div','k',win?'Tournoi de '+lab+' · clôturé':'Tournoi de '+lab+' · clôturé',inn);
  El('h2',null,win?'Vainqueur':(r.rank?r.rank+(r.rank===1?'ᵉʳ':'ᵉ')+' place':'Tournoi terminé'),inn);
  const p1=El('p',null,null,inn),p2=El('p','s2',null,inn);
  if(win){p1.textContent='Tu remportes la Coupe de '+lab+' avec '+r.s.toLocaleString('fr-FR')+' points.';p2.textContent='Elle rejoint la tablette des trophées de ta collection.';}
  else{p1.textContent='Ton score : '+r.s.toLocaleString('fr-FR')+' points.'+(r.w?' La coupe revient à '+r.w.n+(r.w.h?' (@'+r.w.h+')':'')+'.':'');p2.textContent='Le tournoi de '+monthLabel(r.m%100===12?(Math.floor(r.m/100)+1)*100+1:r.m+1)+' est déjà ouvert : la prochaine est pour toi.';}
  const b=El('button',null,'Continuer',inn);b.type='button';
  document.body.appendChild(o);
  /* particules et rayons */
  const x=cvs.getContext('2d'),dpr=Math.min(2,window.devicePixelRatio||1);let W=0,Hh=0;
  const fit=()=>{W=cvs.width=innerWidth*dpr;Hh=cvs.height=innerHeight*dpr;};fit();addEventListener('resize',fit);
  const P=[],rnd=Math.random,t0=performance.now();let run=true;
  const spawn=(n,burst)=>{for(let i=0;i<n;i++){const a=rnd()*Math.PI*2,v=burst?(2+rnd()*7):(.2+rnd()*.8);
    P.push({x:W/2+(burst?0:(rnd()-.5)*W*.2),y:Hh*.42+(burst?0:(rnd()-.5)*Hh*.15),vx:Math.cos(a)*v*dpr,vy:(Math.sin(a)*v-(win?0:1.2))*dpr,l:1,d:.004+rnd()*.01,s:(1+rnd()*2.2)*dpr});}};
  const frame=now=>{if(!run)return;const t=(now-t0)/1000;x.clearRect(0,0,W,Hh);
    if(win&&t>.5){x.save();x.translate(W/2,Hh*.42);x.rotate(t*.12);const k=Math.min(1,(t-.5)/1.2);
      for(let i=0;i<28;i++){x.rotate(Math.PI*2/28);const g=x.createLinearGradient(0,0,0,-Math.max(W,Hh)*.8);g.addColorStop(0,'rgba(255,214,130,'+(.2*k)+')');g.addColorStop(.6,'rgba(255,214,130,'+(.05*k)+')');g.addColorStop(1,'rgba(255,214,130,0)');
        x.fillStyle=g;x.beginPath();x.moveTo(0,0);x.lineTo(-16*dpr,-Math.max(W,Hh)*.8);x.lineTo(16*dpr,-Math.max(W,Hh)*.8);x.closePath();x.fill();}x.restore();}
    if(win&&t>.85&&!frame.b){frame.b=1;spawn(160,true);}
    if(!win&&t>2.2&&!frame.b){frame.b=1;o.classList.add('dust');spawn(220,false);}
    if(win&&rnd()<.35)spawn(1,false);
    x.globalCompositeOperation='lighter';
    for(let i=P.length-1;i>=0;i--){const q=P[i];q.x+=q.vx;q.y+=q.vy;q.vx*=.985;q.vy=q.vy*.985+(win?.03:-.004)*dpr;q.l-=q.d;if(q.l<=0){P.splice(i,1);continue;}
      x.fillStyle=win?'rgba(255,'+(190+rnd()*50|0)+',110,'+q.l+')':'rgba(200,215,240,'+(q.l*.8)+')';x.beginPath();x.arc(q.x,q.y,q.s,0,Math.PI*2);x.fill();}
    x.globalCompositeOperation='source-over';requestAnimationFrame(frame);};
  requestAnimationFrame(()=>{o.classList.add('on');setTimeout(()=>o.classList.add('go'),350);requestAnimationFrame(frame);});
  const close=()=>{o.classList.remove('on');setTimeout(()=>{run=false;removeEventListener('resize',fit);o.remove();},700);};
  b.onclick=close;addEventListener('keydown',function k(e){if(e.key==='Escape'||e.key==='Enter'){removeEventListener('keydown',k);close();}});
}

window.RVO={
  version:'1.0',ready:!!CFG,
  on:(t,f)=>EV.addEventListener(t,e=>f(e.detail)),
  state,ensure,signIn,signOut,onboard,setVis,link,syncNow,
  board,profileOf,friends,requestFriend,acceptFriend,removeFriend,
  periods,myScores:()=>myScores(S.pseudo||curUser()),myStats:()=>publicStats(S.pseudo||curUser()),trophies,podium,
  slug,monthLabel,SCORE,monthShow,   // monthShow({m:202611,won:true,s:3120}) : aperçu de l'animation de fin de mois
  _t:{mergeVal,deep,mergeBiblio,localMap,toLocal,H,shardOf,weekOf,monthOf,dayScore,periodScore,ledgerUpdate,collect,S,sync,dirty,publicStats,
    inject:fb=>{FB=fb;S.sdk='ready';},render:()=>{ACC.scr='';accRender();}}   // pour les tests uniquement
};
/* démarrage après la scène : l'accueil 3D garde toute la bande passante au chargement */
if(CFG){
  if(document.body)accWatch();else addEventListener('DOMContentLoaded',accWatch,{once:true});
  const go=()=>setTimeout(()=>{(window.requestIdleCallback||(f=>setTimeout(f,1)))(start,{timeout:4000});},/[?&]salle=classement/.test(location.search)?0:3500);
  if(document.readyState==='complete')go();else addEventListener('load',go,{once:true});
}
emit();
