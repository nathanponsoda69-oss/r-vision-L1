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
  LS.set('rvo_auth','1');
  S.user={name:u.displayName||'',email:u.email||''};S.uid=u.uid;S.err='';emit();
  const ms=await FB.fs.getDoc(D('users',u.uid,'sync','meta'));S.meta=ms.exists()?ms.data():null;
  const ps=await FB.fs.getDoc(D('profiles',u.uid));S.prof=ps.exists()?ps.data():null;S.onboarded=!!S.prof;
  S.pseudo=(S.meta&&S.meta.p)||'';
  linkCheck();emit();
  if(S.pseudo)await sync('connexion');
  if(S.onboarded){await publish(true).catch(e=>fail('publication',e));settle().catch(e=>fail('tournoi',e));}
  emit();
}
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
  if(!p)throw new Error('Choisis d’abord un prénom ou pseudo.');
  const {fs}=FB,hr=D('handles',h),hs=await fs.getDoc(hr);
  if(hs.exists()&&hs.data().uid!==S.uid)throw new Error('@'+h+' est déjà pris — essaie une variante.');
  if(!hs.exists())await fs.setDoc(hr,{uid:S.uid,t:Date.now()});
  if(S.prof&&S.prof.h&&S.prof.h!==h){try{await fs.deleteDoc(D('handles',S.prof.h));}catch(e){}}
  ensureProfile(p);if(!curUser())LS.set('rvision_current_user',p);
  if(!S.pseudo){S.pseudo=p;await fs.setDoc(D('users',S.uid,'sync','meta'),{p,c:Date.now(),u:Date.now()},{merge:true});S.meta=Object.assign({},S.meta||{},{p});}
  S.prof=Object.assign({},S.prof||{},{n:p,h,vis});S.onboarded=true;linkCheck();emit();
  await sync('inscription');await publish(true);settle().catch(()=>{});emit();
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
  let m=prevMonth(cm);const todo=[];
  for(let i=0;i<3&&m>=joined;i++,m=prevMonth(m)){if(m===prevMonth(cm)&&day<3)continue;if(!done.includes(m))todo.push(m);}
  for(const mm of todo){
    const qs=await FB.fs.getDocs(FB.fs.query(Col('months',String(mm),'e'),FB.fs.orderBy('s','desc'),FB.fs.limit(3))),pod=[];
    qs.forEach(d=>pod.push({uid:d.id,n:d.data().n,h:d.data().h,s:d.data().s}));
    LS.set('rvo_podium_'+mm,JSON.stringify(pod));
    if(pod[0]&&pod[0].uid===S.uid&&pod[0].s>0){const k='rvision_'+S.pseudo+'_trophees',t=trophies();
      if(!t.some(x=>x.m===mm)){t.push({m:mm,s:pod[0].s});t.sort((a,b)=>a.m-b.m);LS.set(k,JSON.stringify(t));emitT('trophy',{m:mm,s:pod[0].s});}}
    done.push(mm);}
  if(todo.length){LS.set(sk,JSON.stringify(done.slice(-24)));await publish(true);sync('trophée');}
}
const podium=m=>J(LS.get('rvo_podium_'+m),null);

/* ─────────────── 14 · interface publique, démarrage ─────────────── */
const EV=new EventTarget();
let emitQ=0;
function emit(){if(emitQ)return;emitQ=requestAnimationFrame?requestAnimationFrame(fire):setTimeout(fire,16);}
function fire(){emitQ=0;const st=state();EV.dispatchEvent(new CustomEvent('state',{detail:st}));window.dispatchEvent(new CustomEvent('rvision:online',{detail:st}));footer(st);}
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
window.RVO={
  version:'1.0',ready:!!CFG,
  on:(t,f)=>EV.addEventListener(t,e=>f(e.detail)),
  state,ensure,signIn,signOut,onboard,setVis,link,syncNow,
  board,profileOf,friends,requestFriend,acceptFriend,removeFriend,
  periods,myScores:()=>myScores(S.pseudo||curUser()),myStats:()=>publicStats(S.pseudo||curUser()),trophies,podium,
  slug,monthLabel,SCORE,
  _t:{mergeVal,deep,mergeBiblio,localMap,toLocal,H,shardOf,weekOf,monthOf,dayScore,periodScore,ledgerUpdate,collect,S,sync,dirty,publicStats,
    inject:fb=>{FB=fb;S.sdk='ready';}}   // pour les tests uniquement
};
/* démarrage après la scène : l'accueil 3D garde toute la bande passante au chargement */
if(CFG){
  const go=()=>setTimeout(()=>{(window.requestIdleCallback||(f=>setTimeout(f,1)))(start,{timeout:4000});},/[?&]salle=classement/.test(location.search)?0:3500);
  if(document.readyState==='complete')go();else addEventListener('load',go,{once:true});
}
emit();
