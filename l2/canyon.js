/* R·Vision L2 — le canyon de la finance (module chargé à l'approche du portail par l2.html) */
/* ═══════════════════════════════════════════════════════════════════════════════
   R·VISION — L2 · le canyon de la finance : une gorge de grès façon Antelope, deux temples
   (le Trésor taillé dans la roche pour le droit des affaires, le pavillon mauresque pour l'analyse
   financière), les stèles des statistiques.
   Comme la forêt de la L1 : un rendu à part (son propre canvas), piloté image par image par la page.
   01 · socle : réglages, bruit, tracé de la gorge
   ═══════════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {Pass,FullScreenQuad} from 'three/addons/postprocessing/Pass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {mergeGeometries,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';

const PQ=new URLSearchParams(location.search),CAPTURE=PQ.has('capture');
const MOBILE=matchMedia('(max-width:760px)').matches||/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
let TIER=MOBILE?0:(((navigator.deviceMemory||8)<=4||(navigator.hardwareConcurrency||8)<=4)?1:2);
if(PQ.get('cq')!==null)TIER=Math.max(0,Math.min(2,(+PQ.get('cq'))|0));
const PI=Math.PI,TAU=PI*2;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),clamp01=x=>clamp(x,0,1),lerp=(a,b,t)=>a+(b-a)*t;
const smooth=(a,b,x)=>{const t=clamp01((x-a)/(b-a));return t*t*(3-2*t);};
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const rnd=mulberry(20261115);
const V3=(x,y,z)=>new THREE.Vector3(x,y,z);
function fail(msg){throw new Error(msg);}
const nextTick=()=>new Promise(r=>requestAnimationFrame(()=>setTimeout(r,0)));

/* bruit de valeur (relief des parois, du sol, des temples) */
function hash3(x,y,z){let n=Math.imul(x|0,374761393)^Math.imul(y|0,668265263)^Math.imul(z|0,1440662683);n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967296;}
function vn2(x,y){const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);
  const a=hash3(ix,iy,7),b=hash3(ix+1,iy,7),c=hash3(ix,iy+1,7),d=hash3(ix+1,iy+1,7);return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v;}
function vn3(x,y,z){const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z),fx=x-ix,fy=y-iy,fz=z-iz,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy),w=fz*fz*(3-2*fz);
  const L=(a,b,t)=>a+(b-a)*t;
  return L(L(L(hash3(ix,iy,iz),hash3(ix+1,iy,iz),u),L(hash3(ix,iy+1,iz),hash3(ix+1,iy+1,iz),u),v),L(L(hash3(ix,iy,iz+1),hash3(ix+1,iy,iz+1),u),L(hash3(ix,iy+1,iz+1),hash3(ix+1,iy+1,iz+1),u),v),w);}
function fbm2(x,y,o){let s=0,a=.5,t=0;for(let i=0;i<(o||4);i++){s+=a*vn2(x,y);t+=a;a*=.5;x=x*2.03+17.1;y=y*2.03+3.7;}return s/t;}
function fbm3(x,y,z,o){let s=0,a=.5,t=0;for(let i=0;i<(o||3);i++){s+=a*vn3(x,y,z);t+=a;a*=.5;x=x*2.03+5.1;y=y*2.03+1.7;z=z*2.03+9.3;}return s/t;}
const ridge=v=>1-Math.abs(v*2-1);

/* ─────────────── le tracé : une gorge qui serpente, débouche sur le parvis du Trésor, repart vers la droite,
   puis tourne à gauche vers le cirque du pavillon mauresque (cul-de-sac) ─────────────── */
const CP=[[0,40],[0.6,32],[-0.9,24],[0.8,16],[-0.3,8],[0.3,1],[2.0,-5],[6.5,-8.9],[11.5,-9.3],[16.5,-9.2],[21.5,-8.8],[26.5,-10.2],[31,-11.8],[35,-15.5],[37.6,-22],[38.3,-29],[38.3,-37],[38.4,-45]];
const PATH=(()=>{
  const dense=[];const n=CP.length;
  const cr=(p0,p1,p2,p3,t)=>{const d=(p,q)=>Math.sqrt(Math.hypot(q[0]-p[0],q[1]-p[1]))||1e-4;const t0=0,t1=d(p0,p1),t2=t1+d(p1,p2),t3=t2+d(p2,p3),tt=t1+(t2-t1)*t;
    const L=(A,B,ta,tb)=>[(tb-tt)/(tb-ta)*A[0]+(tt-ta)/(tb-ta)*B[0],(tb-tt)/(tb-ta)*A[1]+(tt-ta)/(tb-ta)*B[1]];
    const A1=L(p0,p1,t0,t1),A2=L(p1,p2,t1,t2),A3=L(p2,p3,t2,t3),B1=L(A1,A2,t0,t2),B2=L(A2,A3,t1,t3);return L(B1,B2,t1,t2);};
  for(let i=0;i<n-1;i++){const p1=CP[i],p2=CP[i+1],p0=i>0?CP[i-1]:[2*p1[0]-p2[0],2*p1[1]-p2[1]],p3=i+2<n?CP[i+2]:[2*p2[0]-p1[0],2*p2[1]-p1[1]];
    for(let k=0;k<60;k++)dense.push(cr(p0,p1,p2,p3,k/60));}
  dense.push(CP[n-1]);
  const acc=[0];for(let i=1;i<dense.length;i++)acc.push(acc[i-1]+Math.hypot(dense[i][0]-dense[i-1][0],dense[i][1]-dense[i-1][1]));
  const LEN=acc[acc.length-1],DS=0.1,N=Math.floor(LEN/DS)+1,X=new Float32Array(N),Z=new Float32Array(N);let j=0;
  for(let i=0;i<N;i++){const s=i*DS;while(j<acc.length-2&&acc[j+1]<s)j++;const f=clamp01((s-acc[j])/((acc[j+1]-acc[j])||1));X[i]=lerp(dense[j][0],dense[j+1][0],f);Z[i]=lerp(dense[j][1],dense[j+1][1],f);}
  const TX=new Float32Array(N),TZ=new Float32Array(N);
  for(let i=0;i<N;i++){const a=Math.max(0,i-3),b=Math.min(N-1,i+3);let dx=X[b]-X[a],dz=Z[b]-Z[a];const l=Math.hypot(dx,dz)||1;TX[i]=dx/l;TZ[i]=dz/l;}
  return {LEN,DS,N,X,Z,TX,TZ};
})();
const _pa={x:0,z:0,tx:0,tz:-1,nx:-1,nz:0};
/* point du tracé : position, tangente (sens de la marche), normale gauche */
function pathAt(s,o){o=o||_pa;const f=clamp(s,0,PATH.LEN-1e-4)/PATH.DS,i=Math.min(PATH.N-2,Math.floor(f)),t=f-i;
  o.x=lerp(PATH.X[i],PATH.X[i+1],t);o.z=lerp(PATH.Z[i],PATH.Z[i+1],t);let tx=lerp(PATH.TX[i],PATH.TX[i+1],t),tz=lerp(PATH.TZ[i],PATH.TZ[i+1],t);const l=Math.hypot(tx,tz)||1;
  o.tx=tx/l;o.tz=tz/l;o.nx=o.tz;o.nz=-o.tx;
  if(s<0){o.x+=o.tx*s;o.z+=o.tz*s;}else if(s>PATH.LEN){o.x+=o.tx*(s-PATH.LEN);o.z+=o.tz*(s-PATH.LEN);}
  return o;}
function sNear(x,z){let b=1e9,bs=0;for(let i=0;i<PATH.N;i++){const d=(PATH.X[i]-x)**2+(PATH.Z[i]-z)**2;if(d<b){b=d;bs=i*PATH.DS;}}return bs;}
const S_PLAZA=sNear(2.0,-5),S_FA=sNear(11.5,-9.3),S_SLOT2=sNear(21.5,-8.8),S_AMPH=sNear(37.6,-22),S_END=PATH.LEN;
const S_START=sNear(0.8,17);
const S_PAV=sNear(38.3,-34.2);   // façade du pavillon mauresque : elle ferme la gorge d'une paroi à l'autre
/* fenêtres de section : 1 dans [a,b], fondu de largeur r */
const win=(s,a,b,r)=>smooth(a-r,a+r,s)*(1-smooth(b-r,b+r,s));
const kPlaza=s=>win(s,S_PLAZA-6.5,S_FA+6.5,2.6);
const kAmph=s=>smooth(S_AMPH-5,S_AMPH+3,s);
const S_ST=[68.5,73.2,77.9];
const kStele=s=>win(s,S_ST[0]-2.6,S_ST[2]+3.7,2.4);
const kOpen=s=>Math.max(kPlaza(s),kAmph(s),0.8*kStele(s));

/* direction VERS le soleil : très haut, un peu derrière nous (il frappe les façades des temples) */
const SUN_D=[0.06,1,0.3],SUN_L=Math.hypot(...SUN_D);
/* puits de lumière : la fente s'élargit et la gorge se cale sur la direction du soleil ; le faisceau descend jusqu'au sable */
const WELLS=[[24.8,3.0,0.45,1],[30.2,2.8,0.55,1],[35.4,2.6,0.42,1],[40.6,2.4,0.4,1],[61.5,2.6,0.4,0.3],[84,2.4,0.34,0.3],[95.5,2.6,0.62,1]];
/* le puits suit le faisceau : à la hauteur y, il est centré là où passe la lumière entrée par la fente en s0 */
function alongSun(s){const p=pathAt(s,_pl);return -(SUN_D[0]*p.tx+SUN_D[2]*p.tz)/SUN_D[1];}
function wellK(s,y,H){let k=0;for(const w of WELLS){const sb=w[0]+(H-y)*alongSun(w[0]);k=Math.max(k,Math.exp(-(((s-sb)/w[1])**2)));}return k;}
function wellA(s){let b=0,a=1;for(const w of WELLS){const k=Math.exp(-(((s-w[0])/(w[1]*2))**2));if(k>b){b=k;a=w[3];}}return a;}
function wellW(s,H){let b=0,bw=0.4;for(const w of WELLS){const k=Math.exp(-(((s-w[0])/w[1])**2));if(k>b){b=k;bw=w[2];}}return bw;}
function latSun(s){const p=pathAt(s,_pl);return (SUN_D[0]*p.nx+SUN_D[2]*p.nz)/SUN_D[1];}
const _pl={x:0,z:0,tx:0,tz:0,nx:0,nz:0};
/* ─────────────── profils de la gorge ───────────────
   largeur au sol (par côté), largeur de la fente au sommet, hauteur du rebord, ventre, méandre en hauteur */
const R_END=7.0;
function rimH(s){return lerp(27.5+3.5*fbm2(s*0.045,1.3,3),30.5,kPlaza(s))+kAmph(s)*1.5;}
function wFloor(s,sd){
  let w=1.0+0.32*Math.sin(s*0.23+sd*1.3)+0.22*Math.sin(s*0.61+2+sd)+0.35*(fbm2(s*0.09+sd*7,2.1,3)-0.5);
  w=Math.max(0.62,w);
  w=lerp(w,sd>0?6.6:2.5,kPlaza(s));                                  // parvis : il se creuse surtout du côté extérieur du virage
  w=lerp(w,7.0+0.4*Math.sin(s*0.3+sd),kAmph(s));                      // cirque du pavillon
  if(sd>0)w=lerp(w,4.7+0.25*Math.sin(s*0.9),kStele(s));                // salle des stèles, creusée côté gauche
  if(s>S_END-R_END){const u=(s-(S_END-R_END))/R_END;w*=Math.sqrt(Math.max(0,1-u*u));}   // fond du cirque : demi-cercle
  return w;}
function wTop(s,sd){
  let w=0.22+0.45*(fbm2(s*0.12+sd*3.1,5.2,3)-0.45)+0.12*Math.max(0,Math.sin(s*0.17+1.1));   // fente étroite, parfois fermée (ponts de roche)
  const H=rimH(s);w=lerp(w,wellW(s,H),wellK(s,H,H));
  w=lerp(w,sd>0?3.2:2.0,kPlaza(s));
  w=lerp(w,sd>0?2.3:2.9,kAmph(s));                                    // le cirque du pavillon s'ouvre sur le ciel : le soleil frappe la façade
  {const ks=kStele(s);if(ks>0){const G=Math.max(Math.exp(-(((s-(S_ST[0]+S_ST[1])/2)/0.85)**2)),Math.exp(-(((s-(S_ST[1]+S_ST[2])/2)/0.85)**2)));w=lerp(w,sd>0?0.95*G-0.18:0.6*G-0.14,ks);}}
  if(s>S_END-R_END){const u=(s-(S_END-R_END))/R_END;w*=Math.sqrt(Math.max(0,1-u*u))*0.8+0.2;}
  return w;}
function belly(s,sd){return (1.0+1.3*(fbm2(s*0.07+sd*11,8.8,3)-0.45))*(1-0.7*kOpen(s));}
function meander(s,y){const a=1.25*(1-0.75*kOpen(s));return a*(Math.sin(y*0.15+s*0.055+1.3)-Math.sin(1.3+s*0.055))+0.6*a*(fbm2(s*0.05,y*0.06+2,2)-0.5)*smooth(0,6,y);}
/* relief « coulé » : larges cannelures qui suivent les strates, bourrelets, cupules */
function carve(s,y,sd){
  const k=1-0.45*kOpen(s);
  const yw=y+1.8*fbm2(s*0.045+sd*3,y*0.035+1,2)+0.06*s*sd*0.2;
  let d=0.30*Math.sin(yw*TAU/2.6+1.7*fbm2(s*0.09,y*0.07+sd,2))                      // grandes cannelures horizontales
       +0.46*(fbm2(s*0.11+sd*13,yw*0.42,4)-0.5)*2                                     // bourrelets étirés le long des strates
       +0.12*Math.sin(yw*TAU/0.85+3*fbm2(s*0.3,y*0.2,2))                               // strates fines
       +0.18*(ridge(fbm2(s*0.35+sd*5,yw*0.9,3))-0.5);                                  // arêtes
  d*=k*smooth(-0.6,1.2,y);
  return d;}
/* décalage latéral (le long de la normale gauche) de la paroi sd (+1 gauche, -1 droite) à l'abscisse s, à la hauteur y */
/* falaise du Trésor : la paroi gauche devient un plan vertical, creusé d'un retrait où la façade est taillée */
const FA={W:6.15,H:18.4,D:2.1,CLIFF:6.9};
function facadeZone(s,y){return win(s,S_FA-9.0,S_FA+9.0,2.4)*(1-smooth(FA.H+1.2,FA.H+6.5,y));}
function wallOff(s,y,sd){
  if(sd>0){const fz=facadeZone(s,y);if(fz>0.999){return FA.CLIFF+recess(s,y)+cliffRough(s,y);}}
  const r=wallOff0(s,y,sd);
  if(sd>0){const fz=facadeZone(s,y);if(fz>0)return lerp(r,FA.CLIFF+recess(s,y)+cliffRough(s,y),fz);}
  return r;}
/* falaise taillée : surface brute (éclats, coups d'outil, érosion), lisse seulement au ras du retrait */
function cliffRough(s,y){const a=s-S_FA,ri=recessIn(s,y);const edge=Math.min(Math.abs(Math.abs(a)-FA.W),Math.abs(y-FA.H));
  return (1-ri)*smooth(0.05,0.9,edge)*(0.18*(fbm2(s*0.35,y*0.35+3,3)-0.5)*2+0.035*(fbm2(s*0.9,y*0.9,2)-0.5))+ri*0.01*(fbm2(s*3,y*3,2)-0.5);}
function recessIn(s,y){const a=s-S_FA;return smooth(-FA.W-0.1,-FA.W+0.1,a)*(1-smooth(FA.W-0.1,FA.W+0.1,a))*(1-smooth(FA.H+0.25*Math.sin(a*1.3)-0.1,FA.H+0.25*Math.sin(a*1.3)+0.1,y));}
/* la porte centrale ouvre sur une salle creusée dans la roche ; les portes latérales sur de petites chambres */
function recess(s,y){const a=s-S_FA;let d=FA.D*recessIn(s,y);
  d+=5.6*smooth(-1.18,-1.08,a)*(1-smooth(1.08,1.18,a))*(1-smooth(5.15,5.3,y));
  for(const c of[-3.3,3.3])d+=1.9*smooth(c-0.66,c-0.56,a)*(1-smooth(c+0.56,c+0.66,a))*(1-smooth(3.35,3.5,y));
  return d;}
function wallOff0(s,y,sd){
  const H=rimH(s),u=clamp01(y/H),wk=wellK(s,y,H);
  const w0=wFloor(s,sd),wt=wTop(s,sd);
  let w=lerp(w0,wt,Math.pow(u,1.15+0.45*fbm2(s*0.07+sd,3.3,2)));
  w+=belly(s,sd)*Math.pow(Math.sin(PI*u),1.5)*smooth(0,0.15,u)*(1-0.55*wk);
  w+=carve(s,y,sd)*(1-0.55*wk);
  if(s>S_END-R_END)w=Math.max(w,0.0);
  let m=lerp(meander(s,y),y*latSun(s),wk*wellA(s));
  const ks=kStele(s);if(ks>0)m=lerp(m,smooth(1.6,7.5,y)*(ST_LAND+latSun(s)*y),ks);   // parois d'aplomb jusqu'à hauteur d'homme, puis la salle penche vers le soleil
  return m+sd*w;}
const ST_LAND=3.5;
/* hauteur du sable : bourrelets contre les parois, longues ondulations, petites dunes sur les parvis */
function sandH(s,o){
  const oL=wallOff(s,0,1),oR=wallOff(s,0,-1),d=Math.min(oL-o,o-oR);
  let h=0.12*(fbm2(s*0.05,3.1,3)-0.5)+0.05*(fbm2(s*0.6,o*0.6,2)-0.5);
  h+=0.5*Math.exp(-Math.max(d,0)/0.75)*(0.7+0.6*fbm2(s*0.25,o*0.3+5,2));
  h+=kOpen(s)*0.28*(fbm2(s*0.13+1,o*0.17,3)-0.45);
  return h;}
function groundAt(x,z){const s=sNear(x,z),p=pathAt(s);const o=(x-p.x)*p.nx+(z-p.z)*p.nz;return flatten(x,z,sandH(s,o));}

/* empreinte de la forme de la gorge : si le tracé ou les parois changent, la lumière précalculée (l2/gi_*.png)
   ne correspond plus ; le canyon le détecte et revient à l'éclairage approché */
function giSig(){let h=0;for(let k=0;k<48;k++){const s=-4+k*2.43;h+=wallOff(s,1+k%7*2.1,1)*1.3-wallOff(s,2+k%5*3.3,-1)*0.7+rimH(s)*0.11+sandH(s,0.3*(k%3-1))*2.1;}return Math.round(h*1e5)/1e5;}

/* ═══════════════════════════════════════════════════════════════════════════════
   02 · rendu : moteur, uniformes communs, lumière rebondie, lanternes ajourées
   ═══════════════════════════════════════════════════════════════════════════════ */
const canvas=document.createElement('canvas');canvas.id='rvc';canvas.setAttribute('aria-hidden','true');canvas.style.cssText='position:fixed;inset:0;width:100%;height:100%;display:none;pointer-events:none';
let renderer;
try{renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'high-performance',stencil:false,preserveDrawingBuffer:CAPTURE});}
catch(e){fail("Ce navigateur n'a pas pu démarrer le rendu 3D (WebGL 2).");}
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=+(PQ.get('cexp')||1.0);
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;
const DPR_MAX=[1.25,1.5,1.75][TIER];
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(48,1,0.05,420);
const SUN=V3(SUN_D[0],SUN_D[1],SUN_D[2]).normalize();
const SUN_COL=new THREE.Color(1.0,0.9,0.76);
const NLAN=14,NBNC=14;
/* bruit 3D en texture (shaders) */
const N3=(()=>{const N=64,d=new Uint8Array(N*N*N),r=mulberry(77);for(let i=0;i<d.length;i++)d[i]=r()*255;
  const t=new THREE.Data3DTexture(d,N,N,N);t.format=THREE.RedFormat;t.minFilter=t.magFilter=THREE.LinearFilter;t.wrapS=t.wrapT=t.wrapR=THREE.RepeatWrapping;t.needsUpdate=true;return t;})();
const U={uTime:{value:0},uN3:{value:N3},uGI:{value:+(PQ.get('cgi')||1.0)},uRim:{value:29},
  uLanP:{value:Array.from({length:NLAN},()=>new THREE.Vector4(0,-99,0,0))},uLanC:{value:Array.from({length:NLAN},()=>new THREE.Vector4(1,.6,.3,7))},uLanX:{value:Array.from({length:NLAN},()=>new THREE.Vector4())},
  uBncP:{value:Array.from({length:NBNC},()=>new THREE.Vector4(0,-99,0,1))},uBncC:{value:Array.from({length:NBNC},()=>new THREE.Vector3())},uPx:{value:600},
  /* lumière rebondie précalculée (l2/gi_*.png) : atlas des parois et du sol, volume de sondes pour les objets */
  uGB:{value:0},uTAc:{value:new THREE.Vector4(0,0,0,0.001)},uGIA:{value:(()=>{const t=new THREE.DataTexture(new Uint8Array(4),1,1);t.needsUpdate=true;return t;})()},
  uGV1:{value:null},uGV2:{value:null},uGV3:{value:null},uGVO:{value:new THREE.Vector4(0,0,0,1)},uGVN:{value:V3(1,1,1)},uGE:{value:new THREE.Vector2(1,1)}};
{const d3=()=>{const t=new THREE.Data3DTexture(new Uint8Array(4),1,1,1);t.needsUpdate=true;return t;};U.uGV1.value=d3();U.uGV2.value=d3();U.uGV3.value=d3();}

/* morceau GLSL commun : bruit, lumière rebondie de la gorge (un faux éclairage global, réglé sur la hauteur et
   l'ouverture du ciel au-dessus), taches de lumière autour des points où tombent les faisceaux, lanternes ajourées
   (le motif des trous se projette sur la roche et tourne quand la lanterne se balance) */
const GLSL_COMMON=`
uniform float uTime,uGI,uRim;uniform highp sampler3D uN3;
uniform vec4 uLanP[${NLAN}],uLanC[${NLAN}],uLanX[${NLAN}];uniform vec4 uBncP[${NBNC}];uniform vec3 uBncC[${NBNC}];
uniform float uGB;uniform vec4 uTAc;uniform sampler2D uGIA;uniform highp sampler3D uGV1,uGV2,uGV3;uniform vec4 uGVO;uniform vec3 uGVN;uniform vec2 uGE;
/* volume de sondes : E(n) = A + B·n par canal (A codé au cube, B/A entre -1 et 1) ; un pas vers le vide évite les fuites de la roche */
vec3 rvVol(vec3 p,vec3 n){vec3 q=(p+n*.28-uGVO.xyz)/uGVO.w;vec3 tc=(vec3(q.x,q.z,q.y)+.5)/uGVN;
  vec4 a=texture(uGV1,tc),b=texture(uGV2,tc),c=texture(uGV3,tc);vec3 A=a.rgb*a.rgb*a.rgb*uGE.y;
  vec3 bR=vec3(a.w,b.x,b.y)*2.-1.,bG=vec3(b.z,b.w,c.x)*2.-1.,bB=c.yzw*2.-1.;
  return max(A*(1.+vec3(dot(bR,n),dot(bG,n),dot(bB,n))),0.);}
vec3 rvAtl(vec2 uv){vec3 c=texture(uGIA,uv).rgb;return c*c*c*uGE.x;}
float rvN(vec3 p){return texture(uN3,p*.015625).r;}
float rvF(vec3 p){return rvN(p)*.5+rvN(p*2.03+.37)*.25+rvN(p*4.07+.71)*.125+rvN(p*8.13+.19)*.0625;}
float rvH(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
vec3 rvGiPal(float h){vec3 c0=vec3(.055,.022,.06),c1=vec3(.42,.12,.07),c2=vec3(1.5,.64,.22),c3=vec3(3.0,2.1,1.25);
  h=clamp(h,0.,1.);return h<.3?mix(c0,c1,h/.3):h<.65?mix(c1,c2,(h-.3)/.35):mix(c2,c3,(h-.65)/.35);}
/* motif d'une lanterne ajourée : 8 facettes, étoiles et points percés, un peu de verre coloré */
float rvLanPat(vec3 d,vec4 X,out vec3 tint){
  d=normalize(d+cross(vec3(X.y,0.,X.z),d));
  float az=atan(d.z,d.x)+X.x,el=asin(clamp(d.y,-1.,1.));
  vec2 q=vec2(az*(48./6.2832),el*(1./.105));vec2 id=floor(q),c=fract(q)-.5;
  float r=length(c),a=atan(c.y,c.x);
  float star=mod(id.x+id.y,2.)<.5?.30+.09*cos(a*8.):.22;
  float fw=max(fwidth(q.x),fwidth(q.y))*1.2+.02;
  float hole=smoothstep(star+fw,star-fw,r);
  float bar=smoothstep(.47,.5-fw*.5,abs(fract(q.x/6.)-.5)*1.)*0.;
  float frame=1.-smoothstep(.0,.06+fw,abs(fract(q.x/6.+.5)-.5)*6.)*.9;
  float h=rvH(id*.37+X.x*0.);tint=mix(vec3(1.),h<.33?vec3(1.,.35,.2):h<.66?vec3(.35,.6,1.):vec3(.4,1.,.5),X.w*step(.4,rvH(id+3.1)));
  float cap=smoothstep(-1.,-.55,el)*(1.-smoothstep(.7,1.2,el));
  return clamp(hole*frame,0.,1.)*cap;}
void rvLanterns(vec3 p,vec3 n,vec3 v,float rough,inout vec3 diff,inout vec3 spec){
  for(int i=0;i<${NLAN};i++){vec4 L=uLanP[i];if(L.w<=0.)continue;vec3 dv=p-L.xyz;float d2=dot(dv,dv),R=uLanC[i].w;if(d2>R*R)continue;
    float d=sqrt(d2);vec3 dir=dv/max(d,1e-4);vec3 tint;float pat=rvLanPat(dir,uLanX[i],tint);
    float att=L.w/(.25+d2*(1.+.35*d))*(1.-smoothstep(R*.4,R,d));
    vec3 c=uLanC[i].rgb*att*mix(vec3(.06),tint,pat)*(uGB>.5?.42:1.);
    float nl=max(dot(n,-dir),0.);diff+=c*nl;
    vec3 hh=normalize(-dir+v);float sh=exp2(10.*(1.-rough)+1.);spec+=c*pow(max(dot(n,hh),0.),sh)*(sh+2.)*.125*nl;}}
vec3 rvBounce(vec3 p,vec3 n){vec3 a=vec3(0.);for(int i=0;i<${NBNC};i++){vec4 B=uBncP[i];vec3 l=B.xyz-p;float d2=dot(l,l),r2=B.w*B.w;
    a+=uBncC[i]*(r2/(r2+d2))*(.3+.7*max(dot(n,l*inversesqrt(max(d2,1e-4))),0.));}return a;}
/* bosselage par les dérivées écran (sans tangentes) */
vec3 rvBump(vec3 surf,vec3 n,float h,float k){vec3 dx=dFdx(surf),dy=dFdy(surf);vec3 r1=cross(dy,n),r2=cross(n,dx);float det=dot(dx,r1);
  vec2 dh=vec2(dFdx(h),dFdy(h))*k;vec3 g=sign(det)*(dh.x*r1+dh.y*r2);vec3 r=abs(det)*n-g;return dot(r,r)>1e-20?normalize(r):n;}
`;
/* patch des MeshStandardMaterial : position monde, couleur / rugosité / relief procéduraux, lumière rebondie et lanternes */
const MATS=[];
function rvMat(params,o){
  o=o||{};const m=new THREE.MeshStandardMaterial(params);
  m.onBeforeCompile=sh=>{
    Object.assign(sh.uniforms,U,o.uniforms||{});
    const AT=o.atlas?['attribute vec2 aB;varying vec2 vB;','vB=aB;','varying vec2 vB;']:['','',''];
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vW;varying vec3 vWN;'+AT[0]+(o.vHead||''))
      .replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvW=(modelMatrix*vec4(transformed,1.)).xyz;vWN=normalize(mat3(modelMatrix)*objectNormal);'+AT[1]+(o.vMain||''));
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vW;varying vec3 vWN;'+AT[2]+GLSL_COMMON+(o.fHead||''))
      .replace('#include <map_fragment>','#include <map_fragment>\n'+(o.fColor||''))
      .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\n'+(o.fRough||''))
      .replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\n'+(o.fNormal||''))
      .replace('#include <lights_fragment_maps>',`#include <lights_fragment_maps>
        {vec3 rvWn=normalize((vec4(normal,0.)*viewMatrix).xyz);vec3 rvV=normalize(cameraPosition-vW);vec3 rvD=vec3(0.),rvS=vec3(0.);
         ${o.fGI||'float rvOpen=.5,rvHn=clamp(vW.y/uRim,0.,1.);'}
         vec3 rvGn=normalize(vWN);
         if(uGB>.5){irradiance+=${o.atlas?'rvAtl(vB)*clamp(1.+1.1*(rvWn.y-rvGn.y),.55,1.6)':'rvVol(vW,rvWn)'}*uGI*${(o.giB!==undefined?o.giB:1).toFixed(3)};}
         else{float rvUp=clamp(rvGn.y*.62+rvWn.y*.18+.32,0.,1.);
         irradiance+=(rvGiPal(rvHn)*mix(.5,1.6,rvOpen)*(.3+.7*rvUp*rvUp)+vec3(.016,.018,.04)*(.3+.7*rvOpen)*(.4+.6*rvUp))*uGI*${(o.giK||1).toFixed(3)}*3.14159;
         irradiance+=rvBounce(vW,rvWn)*3.14159;}
         rvLanterns(vW,rvWn,rvV,material.roughness,rvD,rvS);irradiance+=rvD*3.14159;rvLanSpec=rvS;}`)
      .replace('#include <lights_fragment_end>','#include <lights_fragment_end>\nreflectedLight.directSpecular+=rvLanSpec*material.specularColor*'+(o.specK||'1.0')+';')
      .replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\n'+(o.fEmis||''));
    sh.fragmentShader=sh.fragmentShader.replace('void main() {','vec3 rvLanSpec=vec3(0.);\nvoid main() {');
    if(o.pomSh)sh.fragmentShader=sh.fragmentShader.replace('#include <lights_fragment_begin>',THREE.ShaderChunk.lights_fragment_begin.replace('getDirectionalLightInfo( directionalLight, directLight );','getDirectionalLightInfo( directionalLight, directLight );directLight.color*=rvPomSh;'));
  };
  m.shadowSide=THREE.DoubleSide;
  m.customProgramCacheKey=()=>'rvc_'+(o.key||'x');
  MATS.push(m);return m;}

/* ═══════════════════════════════════════════════════════════════════════════════
   03 · la gorge : deux nappes de grès (une par paroi), le plateau au-dessus, le lit de sable
   ═══════════════════════════════════════════════════════════════════════════════ */
/* grès : strates ondulées (couleur prise le long d'une coordonnée de strate déformée), lamines fines en relief,
   poussière de sable sur les replats ; la lumière rebondie dépend de la hauteur et de l'ouverture du ciel (attribut aG) */
/* coordonnée de strate : horizontale, ondulée à grande échelle, inclinée par endroits (litage oblique) */
const STRATA=`float rvStrata(vec3 P){return P.y+1.5*rvF(P*.035)+.45*rvF(P*.11+3.)+.1*(P.x+P.z)*(rvN(P*.025+9.)-.5);}
/* lamines : profil en dents de scie (la couche dure forme une petite lèvre, la tendre se creuse en dessous) ;
   deux octaves, effacées quand elles deviennent plus fines que le pixel */
float rvLam(float st,vec3 P,float sp,out float k){float ph=st*sp+.45*rvN(P*.23+vec3(st*.05));k=1.-smoothstep(.12,.4,fwidth(ph));
  float f=fract(ph);return (smoothstep(0.,.14,f)-smoothstep(.14,1.,f)*.92)*k;}
float rvLamH(vec3 P,out float lip){float st=rvStrata(P);float sp=2.8+2.4*rvN(vec3(st*.11,.5,.2)),k1,k2;
  float a=rvLam(st,P,sp,k1),b=rvLam(st+.37,P*1.7,sp*(3.1+1.6*rvN(vec3(st*.4,.3,.8))),k2);float m=smoothstep(.3,.75,rvN(vec3(st*.6,.9,.3)+P*.03)),m2=smoothstep(.35,.8,rvN(vec3(st*1.3,.2,.5)+P*.05));
  lip=a*m;return a*(.35+.65*m)+b*.12*m2;}`;
const SANDSTONE_COLOR=`
  float rvSt=rvStrata(vW);
  /* couleur : bandes larges et fines (grès rouge, couches crème, lits lie-de-vin), grain, vernis du désert en coulures */
  float rvB1=rvN(vec3(rvSt*.21,.31,.77)),rvB2=rvN(vec3(rvSt*.9,.13,.41)),rvB3=rvN(vec3(rvSt*2.7,.73,.19)),rvB4=rvN(vec3(rvSt*7.9,.21,.63));
  vec3 rvC=mix(vec3(.66,.30,.14),vec3(.86,.50,.28),smoothstep(.2,.85,rvB1));
  rvC=mix(rvC,vec3(.40,.13,.07),smoothstep(.58,.88,rvB2)*.55);
  rvC=mix(rvC,vec3(.93,.70,.50),smoothstep(.72,.93,rvB3)*.42);
  rvC*=.9+.2*rvB4;
  float rvTa=1.-.8*(1.-smoothstep(uTAc.w*.55,uTAc.w,length(vW.xz-uTAc.xz)));                // falaise du Trésor : lisse, sans lamines serrées
  float rvLip,rvLk=LINEK*mix(1.,.35,clamp(vG.y*1.4-.4,0.,1.))*rvTa;float rvLh=rvLamH(vW,rvLip);
  rvC*=1.+(.05*rvLip-.02*(1.-rvLh))*rvLk;                                         // lèvres claires, creux plus sombres
  float rvGr=rvN(vW*31.)*(1.-smoothstep(.004,.02,fwidth(vW.y)));rvC*=.97+.06*rvGr;
  rvC*=.92+.16*rvF(vW*.09+1.7);
  float rvVa=smoothstep(.66,.92,rvN(vec3(vW.x*1.3,vW.y*.04,vW.z*1.3)+11.))*smoothstep(6.,16.,vW.y)*smoothstep(.45,.9,vG.y)*.6;
  rvC*=1.-.38*rvVa*LINEK;                                                          // coulures sombres sous les rebords
  float rvSpl=smoothstep(.74,.8,rvF(vW*.55+4.2))*LINEK;rvC=mix(rvC,rvC*1.12+vec3(.05,.035,.02),rvSpl*.7);   // écailles fraîches, plus claires
  rvC=mix(rvC,rvC*1.08+vec3(.03,.02,.01),(1.-smoothstep(.3,1.8,vW.y))*.6);        // pied poli par le sable
  rvC=mix(rvC,vec3(.80,.50,.29),smoothstep(.6,.93,vWN.y)*.55);                     // sable posé sur les replats
  diffuseColor.rgb=rvC*TINT;`;
const SANDSTONE_NORMAL=`
  {float rvLp;float lk=LINEK*mix(1.,.3,clamp(vG.y*1.4-.4,0.,1.))*(1.-.8*(1.-smoothstep(uTAc.w*.55,uTAc.w,length(vW.xz-uTAc.xz))));
   float h=.0028*rvLamH(vW,rvLp)*lk+.008*rvF(vW*.7)+.0009*rvF(vW*6.)+.0005*rvN(vW*55.)*(1.-smoothstep(.003,.012,fwidth(vW.y)))
     -.0025*smoothstep(.74,.8,rvF(vW*.55+4.2))*LINEK;
   normal=rvBump(-vViewPosition,normal,h,1.);}`;
function sandstoneMat(key,tint,extra){extra=extra||{};
  return rvMat({color:0xffffff,roughness:.86,metalness:0,envMapIntensity:extra.env||0.0,side:extra.side||THREE.FrontSide},{key,
    vHead:'attribute vec2 aG;varying vec2 vG;',vMain:'vG=aG;',fHead:'varying vec2 vG;'+STRATA,
    fColor:SANDSTONE_COLOR.replace('TINT',tint||'vec3(1.)').replace(/LINEK/g,(extra.lines!==undefined?extra.lines:1).toFixed(2))+(extra.fColor||''),fNormal:SANDSTONE_NORMAL.replace(/LINEK/g,(extra.lines!==undefined?extra.lines:1).toFixed(2))+(extra.fNormal||''),
    fRough:'roughnessFactor=mix(.7,.9,rvN(vW*.3));',fGI:'float rvOpen=vG.y,rvHn=vG.x;',giK:extra.giK||1,atlas:!extra.noAtlas,giB:extra.giB});}

const WALLS=[];
/* une paroi : grille (abscisse s × hauteur), lignes plus serrées près du sol ; au sommet la nappe se retourne
   à l'horizontale et s'étend loin vers l'extérieur (le plateau) : le soleil n'entre que par la fente */
async function buildWall(sd,mat){
  const ds=[0.30,0.19,0.15][TIER],NY=[70,104,132][TIER];
  const s0=-6,s1=S_END+0.01,NS=Math.ceil((s1-s0)/ds)+1;
  const EXT=[[0.25,0.18],[0.8,0.42],[2.2,0.7],[6,0.9],[16,0.6],[34,0.2]];
  const NR=NY+1+EXT.length;
  const pos=new Float32Array(NS*NR*3),aG=new Float32Array(NS*NR*2),aB=new Float32Array(NS*NR*2),rg=sd>0?0:1;
  const pa={x:0,z:0,tx:0,tz:0,nx:0,nz:0};
  for(let i=0;i<NS;i++){
    const s=Math.min(s0+i*ds,S_END);pathAt(s,pa);const H=rimH(s),open=clamp01((wTop(s,1)+wTop(s,-1))/2.4);
    for(let j=0;j<=NY;j++){const t=j/NY,y=-1.2+(H+1.2)*Math.pow(t,1.32);
      let off=wallOff(s,y,sd);
      const k=(i*NR+j)*3;pos[k]=pa.x+pa.nx*off;pos[k+1]=y;pos[k+2]=pa.z+pa.nz*off;
      aG[(i*NR+j)*2]=clamp01(y/H);aG[(i*NR+j)*2+1]=open;aB.set(atlasUV(s,rg,t),(i*NR+j)*2);}
    const offT=wallOff(s,H,sd);
    for(let e=0;e<EXT.length;e++){const j=NY+1+e,ex=EXT[e],off=offT+sd*ex[0],y=H+ex[1]+(e>2?1.2*(fbm2(s*0.05+e,sd*3,2)-0.5):0);
      const k=(i*NR+j)*3;pos[k]=pa.x+pa.nx*off;pos[k+1]=y;pos[k+2]=pa.z+pa.nz*off;aG[(i*NR+j)*2]=1;aG[(i*NR+j)*2+1]=1;aB.set(atlasUV(s,rg,1),(i*NR+j)*2);}
    if(i%120===119)await nextTick();
  }
  const idx=new Uint32Array((NS-1)*(NR-1)*6);let q=0;
  for(let i=0;i<NS-1;i++)for(let j=0;j<NR-1;j++){const a=i*NR+j,b=(i+1)*NR+j,c=i*NR+j+1,d=(i+1)*NR+j+1;
    if(sd>0){idx[q++]=a;idx[q++]=b;idx[q++]=c;idx[q++]=b;idx[q++]=d;idx[q++]=c;}else{idx[q++]=a;idx[q++]=c;idx[q++]=b;idx[q++]=b;idx[q++]=c;idx[q++]=d;}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('aG',new THREE.BufferAttribute(aG,2));g.setAttribute('aB',new THREE.BufferAttribute(aB,2));g.setIndex(new THREE.BufferAttribute(idx,1));
  g.computeVertexNormals();g.computeBoundingSphere();
  const m=new THREE.Mesh(g,mat);m.castShadow=true;m.receiveShadow=true;scene.add(m);WALLS.push(m);
  return m;}

/* le lit de sable : un ruban qui suit le tracé, d'une paroi à l'autre (les pieds de paroi s'y enfoncent) */
let FLOOR=null;
function sandMat(){
  const NS=[0,5,9][TIER];
  return rvMat({color:0xffffff,roughness:.95,metalness:0,envMapIntensity:0},{key:'sand',atlas:true,
    vHead:'attribute vec2 aG;attribute vec2 aS;varying vec2 vG;varying vec2 vS;',vMain:'vG=aG;vS=aS;',
    fHead:`varying vec2 vG;varying vec2 vS;float rvGl=0.,sdR,sdF,sdPx;vec2 sdUV;
      /* rides de vent (asymétriques : pente douce au vent, raide sous le vent), zones lisses, piétinement et traces de pas */
      float sdH(vec2 p){vec2 wd=vec2(.62,-.78);float w=rvF(vec3(p*.07,0.))*4.+.9*rvN(vec3(p*.45,3.));
        float ph=dot(p,wd)*36.+w*2.2;float f=fract(ph/6.2832);float rip=smoothstep(0.,.72,f)*(1.-smoothstep(.72,1.,f));
        float a=smoothstep(.22,.62,rvF(vec3(p*.17,7.)))*(1.-.75*vG.x);rip=mix(rip,.5,smoothstep(.012,.035,sdPx));
        float h=.55+.45*(rip-.5)*a*2.+.12*(rvF(vec3(p*2.2,1.))-.5);
        /* traces de pas : gauche, droite, tous les 0,72 m le long de la marche */
        float sp=vS.x/.72;float id=floor(sp+.5);float side=mod(id,2.)<.5?-1.:1.;vec2 q=vec2((fract(sp+.5)-.5)*.72,vS.y-side*.13-.08*sin(id*1.7));
        float fp=1.-smoothstep(.7,1.,length(q/vec2(.15,.065)));fp*=vG.x*step(.35,fract(sin(id*12.9898)*43758.5453));
        return clamp(h-.55*fp,0.,1.);}`,
    fColor:`sdPx=length(fwidth(vW.xz));
      vec3 V=normalize(cameraPosition-vW);vec2 uv=vec2(vW.x,-vW.z);
      ${NS>0?`{const int N=${NS};float ls=1./float(N);vec2 dd=-vec2(V.x,-V.z)/max(V.y,.3)*.022*ls;float cl=1.;float h=sdH(uv);for(int i=0;i<N;i++){if(h>=cl)break;uv+=dd;cl-=ls;h=sdH(uv);}}`:''}
      sdUV=uv;float hh=sdH(uv);sdR=hh;
      vec3 P=vec3(uv.x,vW.y,-uv.y);float f=rvF(P*.22);
      vec3 c=mix(vec3(.56,.28,.13),vec3(.74,.43,.22),smoothstep(.25,.8,f));
      c*=.9+.16*rvN(P*5.3);c=mix(c,vec3(.52,.25,.12),smoothstep(.62,.86,rvF(P*.9+4.))*.25);
      c=mix(c*vec3(.86,.8,.78),c*vec3(1.08,1.05,1.),smoothstep(.35,.85,hh));                       // crêtes claires, creux plus grossiers
      c*=1.-.18*vG.x*smoothstep(.5,.2,hh);                                                          // sable remué sur le chemin
      vec2 cell=floor(P.xz*70.);rvGl=step(.982,rvH(cell));
      diffuseColor.rgb=c;`,
    fRough:'roughnessFactor=mix(.96,.28,rvGl);',
    fNormal:`{float e=.006,hx=sdH(sdUV+vec2(e,0.)),hy=sdH(sdUV+vec2(0.,e));vec3 g=vec3(-(hx-sdR)/e,0.,(hy-sdR)/e)*.022;
      vec3 nW=normalize(normalize(vWN)+g*smoothstep(.0,.35,vWN.y)+vec3(rvN(vW*31.)-.5,0.,rvN(vW*29.+3.)-.5)*.04*(1.-smoothstep(.003,.012,sdPx)));
      normal=normalize((viewMatrix*vec4(nW,0.)).xyz);}`,
    fGI:'float rvOpen=vG.y,rvHn=.02;',giK:1.15});}
async function buildFloor(){
  const ds=[0.3,0.2,0.16][TIER],NX=[40,64,84][TIER];
  const s0=-6,s1=S_END,NS=Math.ceil((s1-s0)/ds)+1,pos=new Float32Array(NS*(NX+1)*3),aG=new Float32Array(NS*(NX+1)*2),aB=new Float32Array(NS*(NX+1)*2),aS=new Float32Array(NS*(NX+1)*2);
  const pa={x:0,z:0,tx:0,tz:0,nx:0,nz:0};
  for(let i=0;i<NS;i++){const s=Math.min(s0+i*ds,S_END);pathAt(s,pa);const oL=wallOff(s,0,1)+0.9,oR=wallOff(s,0,-1)-0.9,open=clamp01((wTop(s,1)+wTop(s,-1))/2.4);
    for(let j=0;j<=NX;j++){const o=lerp(oR,oL,j/NX),k=(i*(NX+1)+j);pos[k*3]=pa.x+pa.nx*o;pos[k*3+1]=flatten(pa.x+pa.nx*o,pa.z+pa.nz*o,sandH(s,o));pos[k*3+2]=pa.z+pa.nz*o;const wl=eyeLat(s,0.22*Math.sin(s*0.21)+0.1*Math.sin(s*0.53));aG[k*2]=Math.exp(-(((o-wl)/0.75)**2))*(s>S_START-3?1:0);aG[k*2+1]=open;aB.set(atlasUV(s,2,j/NX),k*2);aS[k*2]=s;aS[k*2+1]=o-wl;}
    if(i%150===149)await nextTick();}
  const idx=new Uint32Array((NS-1)*NX*6);let q=0;
  for(let i=0;i<NS-1;i++)for(let j=0;j<NX;j++){const a=i*(NX+1)+j,b=(i+1)*(NX+1)+j,c=a+1,d=b+1;idx[q++]=a;idx[q++]=b;idx[q++]=c;idx[q++]=b;idx[q++]=d;idx[q++]=c;}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('aG',new THREE.BufferAttribute(aG,2));g.setAttribute('aB',new THREE.BufferAttribute(aB,2));g.setAttribute('aS',new THREE.BufferAttribute(aS,2));g.setIndex(new THREE.BufferAttribute(idx,1));g.computeVertexNormals();
  FLOOR=new THREE.Mesh(g,sandMat());FLOOR.receiveShadow=true;FLOOR.castShadow=true;scene.add(FLOOR);}
/* aplanissements (parvis des temples) : renseignés par les temples avant la construction du sol */
const FLAT=[];   // {x,z,r,h,k}
function flatten(x,z,h){for(const f of FLAT){const d=Math.hypot(x-f.x,z-f.z);const k=1-smooth(f.r*0.55,f.r,d);if(k>0)h=lerp(h,f.h,k);}return h;}

/* ═══════════════════════════════════════════════════════════════════════════════
   04 · lumière : soleil haut (il n'entre que par la fente), ciel, reflets
   ═══════════════════════════════════════════════════════════════════════════════ */
let sun,hemi,sky,ENVTEX=null;
const SH={cx:1e9,cz:1e9,E:[30,38,42][TIER],dirty:true,n:0};
function buildLight(){
  hemi=new THREE.HemisphereLight(0x9ab8e2,0x7a3416,0.05);scene.add(hemi);
  sun=new THREE.DirectionalLight(SUN_COL,+(PQ.get('csun')||2.7));scene.add(sun,sun.target);
  sun.castShadow=true;const s=sun.shadow,E=SH.E,ms=[2048,3072,4096][TIER];s.mapSize.set(ms,ms);s.camera.left=-E;s.camera.right=E;s.camera.top=E;s.camera.bottom=-E;s.camera.near=1;s.camera.far=150;
  s.bias=-.0004;s.normalBias=.035;s.radius=1.6;
  sky=new THREE.Mesh(new THREE.SphereGeometry(400,32,16),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,uniforms:{uSun:{value:SUN},uN:{value:N3},uTime:U.uTime},
    vertexShader:`varying vec3 vD;void main(){vD=normalize(position);vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p.xyww;}`,
    fragmentShader:`uniform vec3 uSun;uniform highp sampler3D uN;uniform float uTime;varying vec3 vD;void main(){vec3 d=normalize(vD);float h=clamp(d.y,0.,1.);
      vec3 c=mix(vec3(2.4,2.4,2.4),vec3(.5,.95,2.4),pow(h,.6));float s=max(dot(d,uSun),0.);
      if(d.y>0.){vec2 q=d.xz/(d.y+.25)*.9+vec2(uTime*.004,uTime*.0016);float n=texture(uN,vec3(q*.35,.3)).r*.5+texture(uN,vec3(q*.9,.6)).r*.3+texture(uN,vec3(q*2.3,.1)).r*.2;
        float cl=smoothstep(.5,.74,n)*smoothstep(.0,.3,d.y);vec3 cc=vec3(3.,2.9,2.75)*(.7+.5*smoothstep(.55,.8,n))+vec3(2.,1.6,1.)*pow(s,6.);c=mix(c,cc,cl*.9);}
      c+=vec3(3.,2.4,1.6)*(pow(s,6.)*.8+pow(s,60.)*3.)+vec3(40.,34.,26.)*pow(s,900.);gl_FragColor=vec4(c,1.);}`}));
  sky.frustumCulled=false;sky.renderOrder=-10;scene.add(sky);
  /* reflets : intérieur chaud et sombre, une fente blanche au zénith */
  const pm=new THREE.PMREMGenerator(renderer),es=new THREE.Scene();
  es.add(new THREE.Mesh(new THREE.SphereGeometry(50,48,24),new THREE.ShaderMaterial({side:THREE.BackSide,
    vertexShader:`varying vec3 vD;void main(){vD=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec3 vD;void main(){vec3 d=normalize(vD);vec3 c=mix(vec3(.20,.07,.03),vec3(.55,.24,.09),smoothstep(-.3,.6,d.y));c+=vec3(3.5,3.,2.6)*smoothstep(.93,.99,d.y)*smoothstep(.25,.0,abs(d.x));gl_FragColor=vec4(c,1.);}`})));
  ENVTEX=pm.fromScene(es,0.03).texture;pm.dispose();   // posée seulement sur les métaux, le verre, le marbre (pas en environnement de scène : elle éclairerait toute la roche)
}
/* le cadre de la carte d'ombre suit la caméra (recalé sur les texels) ; recalculé seulement quand il bouge */
function shadowFollow(force){
  const c=camera.position;if(!force&&Math.hypot(c.x-SH.cx,c.z-SH.cz)<SH.E*0.3)return false;
  const tx=c.x+(_fw.x)*SH.E*0.45,tz=c.z+(_fw.z)*SH.E*0.45;
  const tex=2*SH.E/sun.shadow.mapSize.x;
  /* recalage sur la grille des texels, dans le repère de la lumière */
  const lz=SUN.clone().negate(),lx=new THREE.Vector3(0,1,0).cross(lz).normalize(),ly=lz.clone().cross(lx);
  const p=V3(tx,6,tz);let a=Math.round(p.dot(lx)/tex)*tex,b=Math.round(p.dot(ly)/tex)*tex,cz=p.dot(lz);
  p.copy(lx).multiplyScalar(a).addScaledVector(ly,b).addScaledVector(lz,cz);
  sun.target.position.copy(p);sun.position.copy(p).addScaledVector(SUN,80);sun.target.updateMatrixWorld();sun.updateMatrixWorld();
  SH.cx=c.x;SH.cz=c.z;renderer.shadowMap.needsUpdate=true;return true;}
const _fw=new THREE.Vector3();

/* ═══════════════════════════════════════════════════════════════════════════════
   05 · post-traitement : l'air éclairé (faisceaux découpés par la fente, pris dans la poussière), occlusion,
   éblouissement, étalonnage chaud
   ═══════════════════════════════════════════════════════════════════════════════ */
const VOL_FS=`
#include <packing>
uniform sampler2D tDepth,tShadow;uniform highp sampler3D uN;uniform mat4 uInvProj,uCamW,uShadowM;uniform vec3 uSunDir,uSunCol,uAmbCol,uCam;uniform float uTime,uSigma,uMaxD,uFrame,uRim,uNear;uniform vec4 uPlume[4],uOpen[2];uniform vec4 uLanP[NLANV],uLanC[NLANV];varying vec2 vUv;
float vis(vec3 p){vec4 sc=uShadowM*vec4(p,1.);sc.xyz/=sc.w;if(sc.x<0.||sc.x>1.||sc.y<0.||sc.y>1.||sc.z>1.)return 0.;return step(sc.z-.0015,unpackRGBAToDepth(texture2D(tShadow,sc.xy)));}
void main(){
  float dz=texture2D(tDepth,vUv).x;vec4 v=uInvProj*vec4(vUv*2.-1.,dz*2.-1.,1.);v/=v.w;vec3 wp=(uCamW*vec4(v.xyz,1.)).xyz;vec3 rd=wp-uCam;float dist=length(rd);rd/=dist;dist=min(dist,uMaxD);
  float c=max(dot(rd,uSunDir),0.),ph=.85+1.1*pow(c,4.)+1.8*pow(c,40.);
  float dt=dist/float(STEPS),j=fract(52.9829189*fract(dot(gl_FragCoord.xy+uFrame*5.588238,vec2(.06711056,.00583715))));
  vec3 acc=vec3(0.);float T=1.;
  for(int i=0;i<STEPS;i++){vec3 p=uCam+rd*(float(i)+j)*dt;
    float n=texture(uN,p*.0065+vec3(uTime*.0012,-uTime*.003,uTime*.0008)).r,n2=texture(uN,p*.026-vec3(uTime*.002,uTime*.007,0.)).r;
    float low=exp(-max(p.y,0.)*.14);
    float op=0.;for(int k=0;k<2;k++){vec4 o=uOpen[k];op=max(op,1.-smoothstep(o.w*.55,o.w,length(p.xz-o.xy)));}
    float dB=uSigma*(.3+1.3*n)*(.55+.9*n2)*(.6+2.2*low)*mix(1.,.035,op);   // poussière fine : ne se voit que dans la lumière (peu sur les parvis)
    for(int k=0;k<4;k++){vec4 q=uPlume[k];if(q.w<=0.)continue;vec3 e=p-q.xyz;e.y*=.45;dB+=q.w*uSigma*10.*exp(-dot(e,e)/1.6)*(.4+1.2*n2);}
    float dA=uSigma*.18*(.5+n)*(.5+low)*mix(1.,.3,op);                                // brume d'ambiance, très légère
    float hy=clamp(p.y/uRim,0.,1.);vec3 amb=uAmbCol*(.25+2.2*hy*hy);
    vec3 lg=vec3(0.);for(int k=0;k<4;k++){vec4 L=uLanP[k];if(L.w<=0.)continue;vec3 e=p-L.xyz;float d2=dot(e,e);lg+=uLanC[k].rgb*L.w/(1.+d2*2.6)*(1.-smoothstep(6.,20.,d2));}
    acc+=T*lg*uSigma*(.6+1.4*n2)*(.7+1.5*low)*.9*dt;                                  // halo des lanternes dans la poussière
    float nf=smoothstep(.15,uNear,(float(i)+j)*dt);                                  // pas de voile blanc quand on traverse un faisceau
    acc+=T*(uSunCol*ph*vis(p)*dB*nf+amb*dA)*dt;T*=exp(-(dA+dB*.25)*dt);}
  gl_FragColor=vec4(acc,T);
}`;
class AirPass extends Pass{
  constructor(rtScene){super();this.rtScene=rtScene;
    const vs=`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
    this.vol=new THREE.ShaderMaterial({vertexShader:vs,fragmentShader:VOL_FS,defines:{STEPS:[16,32,52][TIER],NLANV:NLAN},depthTest:false,depthWrite:false,
      uniforms:{tDepth:{value:null},tShadow:{value:null},uN:{value:N3},uInvProj:{value:new THREE.Matrix4()},uCamW:{value:new THREE.Matrix4()},uShadowM:{value:new THREE.Matrix4()},uSunDir:{value:SUN},
        uSunCol:{value:new THREE.Color(1,.84,.62).multiplyScalar(+(PQ.get('cray')||8.5))},uAmbCol:{value:new THREE.Color(.95,.42,.16).multiplyScalar(+(PQ.get('camb')||.6)*(GIB.on?.3:1))},uCam:{value:V3()},uTime:U.uTime,
        uSigma:{value:+(PQ.get('csig')||.011)},uMaxD:{value:90},uNear:{value:2.4},uFrame:{value:0},uRim:U.uRim,uPlume:{value:Array.from({length:4},()=>new THREE.Vector4())},uLanP:U.uLanP,uLanC:U.uLanC,uOpen:{value:[new THREE.Vector4(8,-11,0,14),new THREE.Vector4(38.3,-29,0,13)]}}});
    this.comp=new THREE.ShaderMaterial({vertexShader:vs,depthTest:false,depthWrite:false,uniforms:{tScene:{value:null},tVol:{value:null},tAO:{value:null},tDepth:{value:null},uNearC:{value:.05},uFarC:{value:420},uPx:{value:new THREE.Vector2()}},
      fragmentShader:`uniform sampler2D tScene,tVol,tAO,tDepth;uniform vec2 uPx;uniform float uNearC,uFarC;varying vec2 vUv;
        float lz(vec2 uv){float d=texture2D(tDepth,uv).x*2.-1.;return 2.*uNearC*uFarC/(uFarC+uNearC-d*(uFarC-uNearC));}
        void main(){
        /* suréchantillonnage guidé par la profondeur : l'air d'un mur ne déborde pas sur le ciel de la fente (et inversement) */
        float z0=lz(vUv);vec2 base=(floor(vUv/uPx-.5)+.5)*uPx;vec4 a=vec4(0.);float ws=0.;
        for(int i=-1;i<=2;i++)for(int j=-1;j<=2;j++){vec2 q=base+vec2(float(i),float(j))*uPx;vec2 dd=abs(q-vUv)/uPx;float wb=max(0.,1.6-dd.x)*max(0.,1.6-dd.y);
          float z=lz(q);float wz=exp(-abs(z-z0)/(.15*z0+.1));float w=wb*(wz+.002);a+=texture2D(tVol,q)*w;ws+=w;}
        a/=max(ws,1e-6);
        float o=texture2D(tAO,vUv).r*.28+(texture2D(tAO,vUv+uPx*vec2(1.2,.4)).r+texture2D(tAO,vUv+uPx*vec2(-1.2,-.4)).r+texture2D(tAO,vUv+uPx*vec2(-.4,1.2)).r+texture2D(tAO,vUv+uPx*vec2(.4,-1.2)).r)*.18;
        vec3 sc=texture2D(tScene,vUv).rgb;if(any(isnan(sc))||any(isinf(sc)))sc=vec3(0.);if(any(isnan(a)))a=vec4(0.,0.,0.,1.);sc*=mix(o,1.,smoothstep(.3,2.2,dot(sc,vec3(.3,.6,.1)))*.55);vec3 outc=sc*a.a+a.rgb;if(any(isnan(outc))||any(isinf(outc)))outc=vec3(0.);gl_FragColor=vec4(clamp(outc,0.,2000.),1.);}`});
    this.ao=new THREE.ShaderMaterial({vertexShader:vs,depthTest:false,depthWrite:false,defines:{NS:[8,12,16][TIER]},uniforms:{tDepth:{value:null},uInvProj:{value:new THREE.Matrix4()},uProj:{value:new THREE.Matrix4()}},
      fragmentShader:`uniform sampler2D tDepth;uniform mat4 uInvProj,uProj;varying vec2 vUv;
        vec3 vp(vec2 uv){float d=texture2D(tDepth,uv).x;vec4 v=uInvProj*vec4(uv*2.-1.,d*2.-1.,1.);return v.xyz/v.w;}
        void main(){vec3 p=vp(vUv);if(-p.z>110.){gl_FragColor=vec4(1.);return;}vec3 cn=cross(dFdx(p),dFdy(p));if(dot(cn,cn)<1e-24){gl_FragColor=vec4(1.);return;}vec3 n=normalize(cn);
          float a0=6.2832*fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715)))),occ=0.;
          for(int i=0;i<NS;i++){float t=(float(i)+.5)/float(NS),r=mix(.06,1.2,t*t),a=a0+float(i)*2.39996;
            vec2 o=vec2(cos(a),sin(a))*r*vec2(uProj[0][0],uProj[1][1])*.5/max(-p.z,.3);vec3 d=vp(vUv+o)-p;float l=length(d);
            occ+=max(dot(n,d)/max(l,1e-4)-.14,0.)*smoothstep(2.,.08,l);}
          gl_FragColor=vec4(clamp(1.-occ*2.0/float(NS),0.,1.));}`});
    /* accumulation dans le temps (la trame du pas aléatoire se fond en grain fin) */
    this.acc=new THREE.ShaderMaterial({vertexShader:vs,depthTest:false,depthWrite:false,uniforms:{tCur:{value:null},tPrev:{value:null},uK:{value:0}},
      fragmentShader:`uniform sampler2D tCur,tPrev;uniform float uK;varying vec2 vUv;void main(){gl_FragColor=mix(texture2D(tCur,vUv),texture2D(tPrev,vUv),uK);}`});
    this.blur=new THREE.ShaderMaterial({vertexShader:vs,depthTest:false,depthWrite:false,uniforms:{tSrc:{value:null},tDepth:{value:null},uDir:{value:new THREE.Vector2(1,0)},uPx:{value:new THREE.Vector2()},uNearC:{value:.05},uFarC:{value:420}},
      fragmentShader:`uniform sampler2D tSrc,tDepth;uniform vec2 uDir,uPx;uniform float uNearC,uFarC;varying vec2 vUv;
        float lz(vec2 uv){float d=texture2D(tDepth,uv).x*2.-1.;return 2.*uNearC*uFarC/(uFarC+uNearC-d*(uFarC-uNearC));}
        void main(){float z0=lz(vUv);vec4 s=vec4(0.);float ws=0.;for(int i=-4;i<=4;i++){vec2 q=vUv+uDir*uPx*float(i)*.9;float w=exp(-float(i*i)/7.)*exp(-abs(lz(q)-z0)/(.12*z0+.1));s+=texture2D(tSrc,q)*w;ws+=w;}gl_FragColor=s/max(ws,1e-5);}`});
    this.rtB=[0,1].map(()=>new THREE.WebGLRenderTarget(4,4,{type:THREE.HalfFloatType,depthBuffer:false}));
    this.fsq=new FullScreenQuad(this.vol);this.rt=new THREE.WebGLRenderTarget(4,4,{type:THREE.HalfFloatType,depthBuffer:false});this.rtAO=new THREE.WebGLRenderTarget(4,4,{depthBuffer:false});this.frame=0;
    this.rtA=[new THREE.WebGLRenderTarget(4,4,{type:THREE.HalfFloatType,depthBuffer:false}),new THREE.WebGLRenderTarget(4,4,{type:THREE.HalfFloatType,depthBuffer:false})];this.ai=0;this.lastCam=new THREE.Matrix4();}
  setSize(w,h){const k=TIER===2?.5:.4;this.rt.setSize(Math.max(2,w*k|0),Math.max(2,h*k|0));this.rtA.forEach(r=>r.setSize(Math.max(2,w*k|0),Math.max(2,h*k|0)));this.rtB.forEach(r=>r.setSize(Math.max(2,w*k|0),Math.max(2,h*k|0)));this.rtAO.setSize(Math.max(2,w*.5|0),Math.max(2,h*.5|0));this.comp.uniforms.uPx.value.set(1/this.rt.width,1/this.rt.height);}
  render(r,writeBuffer){const u=this.vol.uniforms;u.tDepth.value=this.rtScene.depthTexture;u.tShadow.value=sun.shadow.map?sun.shadow.map.texture:null;if(!u.tShadow.value)return;
    u.uInvProj.value.copy(camera.projectionMatrixInverse);u.uCamW.value.copy(camera.matrixWorld);u.uShadowM.value.copy(sun.shadow.matrix);u.uCam.value.copy(camera.position);u.uFrame.value=CAPTURE?0:(this.frame++%8);
    this.fsq.material=this.vol;r.setRenderTarget(this.rt);this.fsq.render(r);
    {const e=camera.matrixWorld.elements,l=this.lastCam.elements;let mv=0;for(let i=0;i<16;i++)mv+=Math.abs(e[i]-l[i]);this.lastCam.copy(camera.matrixWorld);
     const A=this.acc.uniforms,cur=this.rtA[this.ai],prev=this.rtA[1-this.ai];A.tCur.value=this.rt.texture;A.tPrev.value=prev.texture;A.uK.value=CAPTURE?0:(mv>0.5?0.15:mv>0.05?0.45:0.7);
     this.fsq.material=this.acc;r.setRenderTarget(cur);this.fsq.render(r);this.volTex=cur.texture;this.ai=1-this.ai;
     const B=this.blur.uniforms;B.tDepth.value=this.rtScene.depthTexture;B.uNearC.value=camera.near;B.uFarC.value=camera.far;B.uPx.value.set(1/cur.width,1/cur.height);this.fsq.material=this.blur;
     B.tSrc.value=cur.texture;B.uDir.value.set(1,0);r.setRenderTarget(this.rtB[0]);this.fsq.render(r);
     B.tSrc.value=this.rtB[0].texture;B.uDir.value.set(0,1);r.setRenderTarget(this.rtB[1]);this.fsq.render(r);this.volTex=this.rtB[1].texture;}
    const ua=this.ao.uniforms;ua.tDepth.value=this.rtScene.depthTexture;ua.uInvProj.value.copy(camera.projectionMatrixInverse);ua.uProj.value.copy(camera.projectionMatrix);this.fsq.material=this.ao;r.setRenderTarget(this.rtAO);this.fsq.render(r);this.comp.uniforms.tAO.value=this.rtAO.texture;
    this.comp.uniforms.tDepth.value=this.rtScene.depthTexture;this.comp.uniforms.uNearC.value=camera.near;this.comp.uniforms.uFarC.value=camera.far;
    this.comp.uniforms.tScene.value=this.rtScene.texture;this.comp.uniforms.tVol.value=this.volTex||this.rt.texture;this.fsq.material=this.comp;r.setRenderTarget(this.renderToScreen?null:writeBuffer);this.fsq.render(r);}
}
/* exposition automatique, comme l'œil (ou un appareil photo) : mesure pondérée au centre de la luminance de l'image,
   adaptation progressive ; la fente sombre s'ouvre, les parvis ensoleillés se referment */
class ExposurePass extends Pass{
  constructor(){super();const vs=`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
    this.mLum=new THREE.ShaderMaterial({vertexShader:vs,depthTest:false,depthWrite:false,uniforms:{tSrc:{value:null}},
      fragmentShader:`uniform sampler2D tSrc;varying vec2 vUv;void main(){float s=0.;for(int i=0;i<4;i++)for(int j=0;j<4;j++){vec2 o=(vec2(float(i),float(j))-1.5)/vec2(128.,72.);
        vec3 c=texture2D(tSrc,vUv+o).rgb;s+=log(clamp(dot(c,vec3(.2126,.7152,.0722)),2e-4,30.));}
        vec2 q=(vUv-.5)*vec2(1.,1.3);float w=exp(-dot(q,q)*5.)+.12;gl_FragColor=vec4(s/16.*w,w,0.,1.);}`});
    this.mAvg=new THREE.ShaderMaterial({vertexShader:vs,depthTest:false,depthWrite:false,uniforms:{tSrc:{value:null},tPrev:{value:null},uK:{value:1}},
      fragmentShader:`uniform sampler2D tSrc,tPrev;uniform float uK;void main(){vec2 a=vec2(0.);for(int i=0;i<32;i++)for(int j=0;j<18;j++)a+=texture2D(tSrc,(vec2(float(i),float(j))+.5)/vec2(32.,18.)).rg;
        float l=a.x/a.y;float p=texture2D(tPrev,vec2(.5)).r;gl_FragColor=vec4(mix(p,l,uK),0.,0.,1.);}`});
    this.mApp=new THREE.ShaderMaterial({vertexShader:vs,depthTest:false,depthWrite:false,uniforms:{tDiffuse:{value:null},tExp:{value:null},uKey:{value:+(PQ.get('ckey')||.075)},uLo:{value:.35},uHi:{value:12}},
      fragmentShader:`uniform sampler2D tDiffuse,tExp;uniform float uKey,uLo,uHi;varying vec2 vUv;void main(){float l=exp(texture2D(tExp,vec2(.5)).r);
        vec3 c=texture2D(tDiffuse,vUv).rgb*clamp(uKey/l,uLo,uHi);if(any(isnan(c)))c=vec3(0.);gl_FragColor=vec4(clamp(c,0.,6e4),1.);}`});
    const o={type:THREE.HalfFloatType,depthBuffer:false};this.r32=new THREE.WebGLRenderTarget(32,18,o);this.r1=[new THREE.WebGLRenderTarget(1,1,{type:THREE.FloatType,depthBuffer:false}),new THREE.WebGLRenderTarget(1,1,{type:THREE.FloatType,depthBuffer:false})];
    this.i=0;this.first=true;this.dt=1/60;this.fsq=new FullScreenQuad(this.mLum);}
  render(r,writeBuffer,readBuffer){
    this.mLum.uniforms.tSrc.value=readBuffer.texture;this.fsq.material=this.mLum;r.setRenderTarget(this.r32);this.fsq.render(r);
    const cur=this.r1[this.i],prev=this.r1[1-this.i];const A=this.mAvg.uniforms;A.tSrc.value=this.r32.texture;A.tPrev.value=prev.texture;
    A.uK.value=(CAPTURE||this.first)?1:1-Math.exp(-this.dt*(this.dt>0?0.65:1));this.first=false;this.fsq.material=this.mAvg;r.setRenderTarget(cur);this.fsq.render(r);this.i=1-this.i;
    const P=this.mApp.uniforms;P.tDiffuse.value=readBuffer.texture;P.tExp.value=cur.texture;this.fsq.material=this.mApp;r.setRenderTarget(this.renderToScreen?null:writeBuffer);this.fsq.render(r);}
}
let rtScene,composer,air,bloom,grade,expo;
function buildPost(){
  rtScene=new THREE.WebGLRenderTarget(4,4,{type:THREE.HalfFloatType,samples:[0,2,(devicePixelRatio||1)>1.5?2:4][TIER]});rtScene.depthTexture=new THREE.DepthTexture(4,4);
  composer=new EffectComposer(renderer,new THREE.WebGLRenderTarget(4,4,{type:THREE.HalfFloatType}));
  air=new AirPass(rtScene);composer.addPass(air);
  expo=new ExposurePass();composer.addPass(expo);
  bloom=new UnrealBloomPass(new THREE.Vector2(256,256),+(PQ.get('cbloom')||.22),.75,1.7);composer.addPass(bloom);
  composer.addPass(new OutputPass());
  grade=new ShaderPass({uniforms:{tDiffuse:{value:null},uTime:U.uTime},
    vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`uniform sampler2D tDiffuse;uniform float uTime;varying vec2 vUv;void main(){vec2 px=1./vec2(textureSize(tDiffuse,0));vec3 c=texture2D(tDiffuse,vUv).rgb;
      vec3 bl=(texture2D(tDiffuse,vUv+vec2(px.x,0.)).rgb+texture2D(tDiffuse,vUv-vec2(px.x,0.)).rgb+texture2D(tDiffuse,vUv+vec2(0.,px.y)).rgb+texture2D(tDiffuse,vUv-vec2(0.,px.y)).rgb)*.25;
      c=max(c+(c-bl)*.4,0.);float l=dot(c,vec3(.299,.587,.114));
      c=mix(c,c*c*(3.-2.*c),.42);c=mix(c*vec3(.96,.84,1.16),c,smoothstep(.02,.22,l));c=mix(c,c*vec3(1.05,1.0,.86),smoothstep(.45,.9,l));c=mix(vec3(l),c,1.04);
      vec2 q=vUv-.5;c*=mix(.58,1.,smoothstep(.95,.22,length(q*vec2(1.,.85))));float g=fract(sin(dot(gl_FragCoord.xy+fract(uTime)*91.7,vec2(12.9898,78.233)))*43758.5453);c+=(g-.5)*.02;gl_FragColor=vec4(c,1.);}`});
  composer.addPass(grade);
}
const PERF={scale:1,acc:0,n:0,drops:0};
function resize(){
  const w=innerWidth,h=innerHeight,dpr=Math.min(devicePixelRatio||1,DPR_MAX)*PERF.scale;
  renderer.setPixelRatio(dpr);renderer.setSize(w,h,false);rtScene.setSize(w*dpr|0,h*dpr|0);composer.setPixelRatio(dpr);composer.setSize(w,h);
  camera.aspect=w/h;camera.fov=w/h<.8?66:w/h<1.25?56:48;camera.updateProjectionMatrix();U.uPx.value=h*dpr/(2*Math.tan(camera.fov*PI/360));
}

/* ═══════════════════════════════════════════════════════════════════════════════
   06 · pilotage par la L2 : la page donne la position du parcours (P), la zone, l'état de la salle et le voile ;
   ici on marche (pas, légères instabilités), on regarde, on dessine
   ═══════════════════════════════════════════════════════════════════════════════ */
const LIFE=[];                       // fonctions appelées à chaque image (vent, lézards, sable, lanternes…)
const STA=[];                        // stations : {s, pos, tgt, door, inside}
const HITS=[];                       // volumes cliquables des deux temples
const STELE=[];                      // stèles : {g, c:[4 coins locaux], n:{x,z}, x, z, cy, pw, ph}
const WALK={s:0,v:0,dep:-1,goal:0,first:true,ph:0,mode:0};
const CAM={p:V3(),t:V3(),mx:0,my:0,snap:true};
const GP=V3(),GT=V3(),TV=V3(),TV2=V3(),CALM=matchMedia('(prefers-reduced-motion: reduce)').matches;
const RAY=new THREE.Raycaster(),NDC=new THREE.Vector2();
let API=null,TT=0,wasOn=false,FR=0,OVER=-1,veil=null,tipEl=null,CK=0,DT=.016,WHITE=0;
const _p1={x:0,z:0,tx:0,tz:0,nx:0,nz:0},_p2={x:0,z:0,tx:0,tz:0,nx:0,nz:0};
/* les yeux restent dans le vide entre les parois (à 0,5 m au moins de la roche, de la hanche au-dessus de la tête) */
function eyeLat(s,lat){let oL=1e9,oR=-1e9;for(const y of[1.0,1.7,2.3]){oL=Math.min(oL,wallOff(s,y,1));oR=Math.max(oR,wallOff(s,y,-1));}
  return oL-oR<1.0?(oL+oR)/2:clamp(lat,oR+0.5,oL-0.5);}
function eyeAt(s,lat,out){lat=eyeLat(s,lat);pathAt(s,_p1);const x=_p1.x+_p1.nx*lat,z=_p1.z+_p1.nz*lat;out.set(x,flatten(x,z,sandH(s,lat))+1.66,z);return out;}
function stelePose(i){const st=STELE[i],th=Math.tan(camera.fov*PI/360),d=Math.max(st.pw/(.78*2*th*camera.aspect),st.ph/(.8*2*th));
  GP.set(st.x+st.n.x*d,0,st.z+st.n.z*d);GP.y=Math.max(st.cy+.05,groundAt(GP.x,GP.z)+1.45);GT.set(st.x,st.cy,st.z);}
const _ga=V3(),_gb=V3();
/* pose de marche : sur le tracé, regard porté devant soi ; près d'une station, on rejoint son point de vue */
function walkPose(){
  const dirF=Math.abs(WALK.v)>0.05?Math.sign(WALK.v):(STA[WALK.goal]?Math.sign(STA[WALK.goal].s-WALK.s)||1:1);
  const lat=0.22*Math.sin(WALK.s*0.21)+0.1*Math.sin(WALK.s*0.53);
  eyeAt(WALK.s,lat,GP);
  pathAt(WALK.s+dirF*7.5,_p2);GT.set(_p2.x,GP.y+0.35,_p2.z);
  const G=STA[WALK.goal];if(G){const b=1-smooth(1.2,10,Math.abs(G.s-WALK.s));const e=b*b*(3-2*b);GP.lerp(G.pos,e*e);GT.lerp(G.tgt,e);}
  const D=STA[WALK.dep];if(D&&WALK.dep!==WALK.goal){const b=1-smooth(0.6,7,Math.abs(D.s-WALK.s));const pr=G?clamp01(Math.abs(G.s-WALK.s)/(Math.abs(G.s-D.s)||1)):1;const e=b*b*(3-2*b)*pr;GP.lerp(D.pos,e*e);GT.lerp(D.tgt,e);}
}
function goalOf(P){if(P>API.P_STATS-.5&&STELE.length)return 2+clamp(Math.round(P-API.P_STATS),0,STELE.length-1);return P<API.P_FIN+.5?0:1;}
function basePose(P,dt){
  for(let i=0;i<STELE.length;i++){if(!STA[2+i])continue;stelePose(i);STA[2+i].pos.copy(GP);STA[2+i].tgt.copy(GT);}   // poses des stèles (selon le format de l'écran)
  const g=goalOf(P);
  if(g!==WALK.goal){WALK.dep=WALK.goal;WALK.goal=g;WALK.first=false;WALK.vm=0;}
  const G=STA[g];
  if(G&&P>API.P_FIN-.3){const dist=G.s-WALK.s;
    /* chaque trajet dure 12 à 15 s, quelle que soit sa longueur (13 s pour l'arrivée, 13,5 s entre les temples) */
    if(!WALK.vm)WALK.vm=Math.max(0.6,fitV(Math.abs(dist),Math.min(WALK.first?8:13.5,2.2+Math.abs(dist)*0.9)));
    const vmax=WALK.vm,vt=Math.abs(dist)<0.01?0:Math.sign(dist)*Math.min(vmax,Math.sqrt(2*W_ACC*Math.abs(dist))+0.04);
    WALK.v+=(vt-WALK.v)*(1-Math.exp(-dt*W_K));WALK.s+=WALK.v*dt;if((dist>0&&WALK.s>G.s)||(dist<0&&WALK.s<G.s)){WALK.s=G.s;WALK.v=0;}}
  else WALK.v=0;
  walkPose();
  WALK.mode=(g>=2&&Math.abs(STA[g].s-WALK.s)<0.6)?2:0;
  /* arrivée par le portail : on lève d'abord les yeux vers la fente éblouissante, puis on regarde devant soi */
  const up=1-smooth(API.P_CUT,API.P_FIN-.08,P);if(up>0){GT.y+=up*up*16;GT.lerp(GP,up*0.25);}
}
/* durée d'un trajet (même dynamique que la marche) et vitesse de croisière qui le fait tenir en T secondes */
const W_ACC=0.85,W_K=2.2;
function tripT(d,vm){let x=0,v=0,t=0;const h=1/60;while(t<60){const r=d-x;const vt=r<0.01?0:Math.min(vm,Math.sqrt(2*W_ACC*r)+0.04);v+=(vt-v)*(1-Math.exp(-h*W_K));x+=v*h;t+=h;if(x>=d)return t;}return t;}
function fitV(d,T){let a=0.2,b=14;for(let i=0;i<22;i++){const m=(a+b)/2;if(tripT(d,m)>T)a=m;else b=m;}return b;}
function snapTo(P){const g=goalOf(P);WALK.goal=WALK.dep=g;WALK.s=STA[g]?STA[g].s:S_START;WALK.v=0;WALK.vm=0;WALK.first=false;CAM.snap=true;}
/* homographie carré → quadrilatère écran : même calcul que le mur de la L2, appliqué aux stèles */
function quad(q,w,h){const x0=q[0],y0=q[1],x1=q[2],y1=q[3],x2=q[4],y2=q[5],x3=q[6],y3=q[7],sx=x0-x1+x2-x3,sy=y0-y1+y2-y3;let a,b,c,d,e,f,g,hh;
  if(Math.abs(sx)<1e-6&&Math.abs(sy)<1e-6){a=x1-x0;b=x3-x0;c=x0;d=y1-y0;e=y3-y0;f=y0;g=0;hh=0;}
  else{const dx1=x1-x2,dx2=x3-x2,dy1=y1-y2,dy2=y3-y2,den=dx1*dy2-dx2*dy1;g=(sx*dy2-dx2*sy)/den;hh=(dx1*sy-sx*dy1)/den;a=x1-x0+g*x1;b=x3-x0+hh*x3;c=x0;d=y1-y0+g*y1;e=y3-y0+hh*y3;f=y0;}
  const F=v=>(Math.abs(v)<1e-12?0:v).toFixed(10);return 'matrix3d('+F(a/w)+','+F(d/w)+',0,'+F(g/w)+','+F(b/h)+','+F(e/h)+',0,'+F(hh/h)+',0,0,1,0,'+F(c)+','+F(f)+',0,1)';}
function panels(){const els=document.querySelectorAll('#wallui .wp'),W=innerWidth,H=innerHeight;
  STELE.forEach((st,i)=>{const el=els[i];if(!el||el.style.visibility==='hidden')return;const w=parseFloat(el.style.width),h=parseFloat(el.style.height);if(!w||!h)return;const pts=[];
    for(const c of st.c){TV.copy(c);st.g.localToWorld(TV);if(TV2.copy(TV).applyMatrix4(camera.matrixWorldInverse).z>-camera.near*1.5){el.style.visibility='hidden';return;}TV.project(camera);pts.push((TV.x*.5+.5)*W,(-TV.y*.5+.5)*H);}
    el.style.transform=quad(pts,w,h);});}
const TIPS=['Entrer · donjon de lave — Droit des affaires','Entrer · donjon de lave — Comptabilité des sociétés'];
function setOver(o,e){if(o===OVER&&o<0)return;OVER=o;API.canvas.style.cursor=o>=0?'pointer':'';canvas.style.cursor=o>=0?'pointer':'';tipEl.style.opacity=o>=0?'1':'0';
  if(o>=0){tipEl.textContent=TIPS[o];if(e){tipEl.style.left=e.clientX+'px';tipEl.style.top=e.clientY+'px';}}}
{let hovT=0;addEventListener('pointermove',e=>{CAM.mx=e.clientX/innerWidth*2-1;CAM.my=-(e.clientY/innerHeight*2-1);if(!wasOn||!HITS.length)return;const n=performance.now();if(n-hovT<70)return;hovT=n;
    let o=-1;if(e.target===API.canvas&&CK<.02&&WALK.mode===0){NDC.set(CAM.mx,CAM.my);RAY.setFromCamera(NDC,camera);let bd=1e9;HITS.forEach((h,i)=>{const r=RAY.intersectObject(h);if(r.length&&r[0].distance<bd&&r[0].distance<38){bd=r[0].distance;o=i;}});}setOver(o,e);});}
/* clic (ou toucher : pas de survol sur écran tactile) : on vise directement le temple sous le doigt */
addEventListener('click',e=>{if(!wasOn||e.target!==API.canvas||CK>=.02||WALK.mode!==0)return;let o=OVER;
  if(o<0){NDC.set(e.clientX/innerWidth*2-1,-(e.clientY/innerHeight*2-1));RAY.setFromCamera(NDC,camera);let bd=1e9;HITS.forEach((h,i)=>{const r=RAY.intersectObject(h);if(r.length&&r[0].distance<bd&&r[0].distance<38){bd=r[0].distance;o=i;}});}
  if(o>=0){ENTER_I=o;API.enter(o);}});
let ENTER_I=0;
function tick(dt,P,zone,ck,warming,nveil,nodraw){
  if(ck>0.001&&CK<=0.001)ENTER_I=OVER>=0?OVER:Math.min(1,WALK.goal);
  CK=ck;const on=zone==='fin'&&ck<.5&&!warming;
  try{sndTick(dt,on);}catch(e){if(!SND.err){SND.err=e;console.warn('[RVC] son',e);}}
  /* voiles : blanc à l'arrivée (suite de l'éclair du portail), sombre pendant la plongée dans un temple et les sauts du rail */
  if(veil){const vk=zone==='fin'||ck>0?clamp01(1-Math.abs(ck-.5)/.13):0,nv=zone==='fin'?(nveil||0):0;WHITE=zone==='fin'?1-smooth(API.P_CUT,API.P_CUT+.4,P):0;
    const dk=Math.max(vk,nv);veil.style.background=WHITE>dk?'#fff6ea':'#0b0503';veil.style.opacity=String(Math.max(dk,WHITE*0.95));}
  if(on!==wasOn){wasOn=on;canvas.style.display=on?'block':'none';window.RVC.covers=on;
    if(on){resize();if(ck<.01&&P<API.P_FIN+.5&&P<API.P_FIN-0.05){WALK.s=S_START;WALK.v=0;WALK.vm=0;WALK.goal=0;WALK.dep=-1;WALK.first=true;WALK.mode=0;CAM.snap=true;}else snapTo(P);}else setOver(-1);}
  if(!on)return;
  if((nveil||0)>0.97)snapTo(P);
  dt=Math.min(.05,Math.max(.001,dt));TT=CAPTURE?(window.RVC.capT||14.3):TT+dt;U.uTime.value=TT;DT=dt;
  basePose(P,dt);
  if(ck>0&&STA[ENTER_I]&&STA[ENTER_I].door){const u=clamp01(ck/.5),e=u*u*(3-2*u);GP.lerp(STA[ENTER_I].door,e);GT.lerp(STA[ENTER_I].inside,e);}
  const par=WALK.mode===2?.25:1;GT.x+=CAM.mx*1.1*par;GT.y+=CAM.my*.7*par;
  const moving=Math.abs(WALK.v)>0.05;
  const a=CAM.snap?1:1-Math.exp(-dt*(WALK.mode===2?2.4:moving?6:2.6));CAM.p.lerp(GP,a);CAM.t.lerp(GT,CAM.snap?1:1-Math.exp(-dt*(moving?3.2:2.4)));CAM.snap=false;
  const sp=WALK.mode?0:Math.abs(WALK.v),k=CALM?0:clamp(sp/1.1,0,1.4),q=CALM||WALK.mode===2?0:1;WALK.ph+=dt*TAU*1.75*clamp(sp/1.1,0,1.5);const ph=WALK.ph,t=TT;
  camera.position.copy(CAM.p);camera.position.y+=Math.sin(ph)*.03*k+Math.sin(t*1.15)*.006*q;camera.position.x+=Math.sin(ph*.5)*.035*k+Math.sin(t*.31)*.012*q;
  camera.lookAt(CAM.t.x+(Math.sin(t*.43+1)*.05+Math.sin(ph*.5+.5)*.05*k)*q,CAM.t.y+Math.sin(ph+.9)*.035*k+Math.sin(t*.57)*.03*q,CAM.t.z);camera.rotateZ(Math.sin(ph*.5)*.006*k+Math.sin(t*.37)*.0016*q);
  camera.updateMatrixWorld();camera.getWorldDirection(_fw);
  if(nodraw){for(const f of LIFE)f(TT,DT);return;}
  draw();
  panels();window.RVC.frames=FR;
  if(!CAPTURE){PERF.acc+=dt;if(++PERF.n>=90){const avg=PERF.acc/PERF.n;PERF.acc=0;PERF.n=0;if(avg>1/26&&PERF.drops<4){PERF.drops++;if(PERF.drops===1){air.vol.defines.STEPS=Math.max(10,air.vol.defines.STEPS-10);air.vol.needsUpdate=true;air.ao.defines.NS=8;air.ao.needsUpdate=true;}else{PERF.scale*=.86;resize();}}}}
}
function draw(){
  for(const f of LIFE)f(TT,DT);
  shadowFollow(FR<2);
  if(FR<3)renderer.shadowMap.needsUpdate=true;FR++;
  sky.position.copy(camera.position);
  expo.dt=DT;if(CAM.snap||FR<2)expo.first=true;
  renderer.setRenderTarget(rtScene);renderer.render(scene,camera);composer.render();
}
/* lumière rebondie précalculée : l2/gi.json + deux images (atlas des parois et du sol, volume de sondes) ;
   si elles manquent ou ne correspondent plus à la forme de la gorge, on garde l'éclairage approché */
const GIB={on:false,meta:null};
async function loadGI(){
  if(PQ.get('cbake')==='0')return;
  try{const q=new URL(import.meta.url).search,u=f=>new URL('./'+f+q,import.meta.url);
    const meta=await (await fetch(u('gi.json'))).json();
    if(meta.v!==1||Math.abs(meta.sig-giSig())>1e-4){console.warn('[RVC] lumière précalculée périmée (la gorge a changé de forme) : éclairage approché');return;}
    const px=async f=>{const r=await fetch(u(f));if(!r.ok)throw new Error(f);const bm=await createImageBitmap(await r.blob(),{premultiplyAlpha:'none',colorSpaceConversion:'none'});
      const c=document.createElement('canvas');c.width=bm.width;c.height=bm.height;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(bm,0,0);return x.getImageData(0,0,bm.width,bm.height);};
    const [ia,iv]=await Promise.all([px('gi_parois.png'),px('gi_volume.png')]);
    const ta=new THREE.DataTexture(new Uint8Array(ia.data.buffer.slice(0)),ia.width,ia.height);ta.minFilter=ta.magFilter=THREE.LinearFilter;ta.needsUpdate=true;
    const V=meta.vol,NX=V.nx,NY=V.ny,NZ=V.nz,W4=NX*4,d=iv.data,T=[0,1,2].map(()=>new Uint8Array(NX*NY*NZ*4));
    for(let row=0;row<NY*NZ;row++)for(let ix=0;ix<NX;ix++){const o=(row*NX+ix)*4,g=c=>(row*W4+NX*c+ix)*4,a=g(0),r=g(1),gg=g(2),bb=g(3);
      T[0][o]=d[a];T[0][o+1]=d[a+1];T[0][o+2]=d[a+2];T[0][o+3]=d[r];T[1][o]=d[r+1];T[1][o+1]=d[r+2];T[1][o+2]=d[gg];T[1][o+3]=d[gg+1];
      T[2][o]=d[gg+2];T[2][o+1]=d[bb];T[2][o+2]=d[bb+1];T[2][o+3]=d[bb+2];}
    const t3=T.map(a=>{const t=new THREE.Data3DTexture(a,NX,NZ,NY);t.format=THREE.RGBAFormat;t.minFilter=t.magFilter=THREE.LinearFilter;t.wrapS=t.wrapT=t.wrapR=THREE.ClampToEdgeWrapping;t.needsUpdate=true;return t;});
    U.uGIA.value=ta;U.uGV1.value=t3[0];U.uGV2.value=t3[1];U.uGV3.value=t3[2];U.uGVO.value.set(V.x0,V.y0,V.z0,V.st);U.uGVN.value.set(NX,NZ,NY);U.uGE.value.set(meta.atlas.emax,V.emax);
    U.uGB.value=1;GIB.on=true;GIB.meta=meta;
  }catch(e){console.warn('[RVC] lumière précalculée indisponible',e);}}
/* coordonnées dans l'atlas : abscisse le long de la gorge, ordonnée dans la bande de la paroi (r=0 : +1, r=1 : −1) ou du sol (r=2) */
function atlasUV(s,r,t){const A=GIB.meta?GIB.meta.atlas:null;if(!A)return [0,0];const n=r<2?A.vw:A.vf,o=r===0?0:r===1?A.vw:2*A.vw;
  return [(s-A.s0)/(A.s1-A.s0),(o+clamp(t*n,0.5,n-0.5))/A.h];}
/* ═══════════════════════════════════════════════════════════════════════════════
   16 · le son du canyon (WebAudio, tout est synthétisé ; branché sur le bouton « Son » de la page) :
   vent qui gronde et siffle dans la fente (plus fort là où elle se resserre), sable qui ruisselle des
   rebords, crépitement des lanternes proches, pas dans le sable, eau du bassin, cris des martinets ;
   sons placés dans l'espace (HRTF) et renvoyés dans la réverbération de la page (l'écho de la gorge)
   ═══════════════════════════════════════════════════════════════════════════════ */
const SND={ready:false,k:0,step:0,nb:3};
function sndPan(x,y,z){const p=SND.A.createPanner();p.panningModel='HRTF';p.distanceModel='inverse';p.refDistance=1.4;p.rolloffFactor=1.25;p.maxDistance=80;
  if(p.positionX){p.positionX.value=x;p.positionY.value=y;p.positionZ.value=z;}else p.setPosition(x,y,z);return p;}
function sndInit(AU){const A=AU.ctx;SND.A=A;SND.AU=AU;
  const out=A.createGain();out.gain.value=0;out.connect(AU.bus);SND.out=out;
  const rev=A.createGain();rev.gain.value=0.5;rev.connect(AU.revIn);out.connect(rev);
  const loop=b=>{const s=A.createBufferSource();s.buffer=b;s.loop=true;s.start(0,Math.random()*(b.duration-0.1));return s;};
  /* vent : grondement grave + deux sifflements à Q élevé dont la hauteur dérive */
  {const n=loop(AU.pink),lp=AU.filt('lowpass',300,0.5),g=A.createGain();g.gain.value=0;n.connect(lp);lp.connect(g);g.connect(out);
   const wh=[0,1].map(i=>{const b=AU.filt('bandpass',540+i*410,16),gg=A.createGain(),pn=A.createStereoPanner();gg.gain.value=0;pn.pan.value=i?0.55:-0.55;n.connect(b);b.connect(gg);gg.connect(pn);pn.connect(out);return {b,g:gg};});
   SND.wind={g,lp,wh};}
  /* sable qui ruisselle : une source à chaque filet */
  SND.falls=FALLS.slice(0,10).map(f=>{const n=loop(AU.white),bp=AU.filt('bandpass',2600,0.6),hp=AU.filt('highpass',900,0.5),g=A.createGain(),pn=sndPan(f.x,f.y+3,f.z);g.gain.value=0;n.connect(bp);bp.connect(hp);hp.connect(g);g.connect(pn);pn.connect(out);return {g,f};});
  /* lanternes : souffle de flamme continu + crépitements, sur les deux plus proches */
  SND.lan=[0,1].map(()=>{const pn=sndPan(0,-50,0),g=A.createGain();g.gain.value=0;g.connect(pn);pn.connect(out);const n=loop(AU.pink),lp=AU.filt('lowpass',420,0.5),fg=A.createGain();fg.gain.value=0.35;n.connect(lp);lp.connect(fg);fg.connect(g);return {pn,g,next:0};});
  /* eau du bassin : clapotis (bruit filtré dont la bande tremble) */
  if(TB.fountainC){const c=TB.fountainC,n=loop(AU.white),bp=AU.filt('bandpass',1500,1.1),g=A.createGain(),pn=sndPan(c.x,c.y+0.2,c.z);g.gain.value=0;n.connect(bp);bp.connect(g);g.connect(pn);pn.connect(out);SND.water={g,bp};}
  SND.ready=true;}
function sndBurst(t,dest,f,q,dur,v,type){const A=SND.A,s=A.createBufferSource();s.buffer=SND.AU.white;const b=SND.AU.filt(type||'bandpass',f,q),g=A.createGain();
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(v,t+0.004);g.gain.exponentialRampToValueAtTime(0.0005,t+dur);s.connect(b);b.connect(g);g.connect(dest);s.start(t,Math.random()*1.5);s.stop(t+dur+0.05);}
/* un pas dans le sable : crissement (bruit filtré) + appui sourd */
function sndStep(t,v,pan){const A=SND.A,p=A.createStereoPanner();p.pan.value=pan;p.connect(SND.out);sndBurst(t,p,1100+Math.random()*700,0.8,0.14+Math.random()*0.05,v,'bandpass');sndBurst(t+0.012,p,260,1.2,0.09,v*0.9,'lowpass');sndBurst(t+0.05,p,3800,0.7,0.07,v*0.25,'bandpass');}
/* cri de martinet : glissando aigu, modulé, en rafale */
function sndSwift(t,pn){const A=SND.A;const n=2+(Math.random()*3|0);for(let i=0;i<n;i++){const t0=t+i*(0.16+Math.random()*0.1),o=A.createOscillator(),m=A.createOscillator(),mg=A.createGain(),g=A.createGain();
  o.type='sawtooth';o.frequency.setValueAtTime(5200+Math.random()*900,t0);o.frequency.exponentialRampToValueAtTime(3900+Math.random()*600,t0+0.22);m.frequency.value=38+Math.random()*20;mg.gain.value=420;m.connect(mg);mg.connect(o.frequency);
  const bp=SND.AU.filt('bandpass',4800,2.2);g.gain.setValueAtTime(0,t0);g.gain.linearRampToValueAtTime(0.05,t0+0.02);g.gain.exponentialRampToValueAtTime(0.0005,t0+0.24);o.connect(bp);bp.connect(g);g.connect(pn);o.start(t0);m.start(t0);o.stop(t0+0.3);m.stop(t0+0.3);}}
function sndTick(dt,on){
  const AU=API&&API.audio?API.audio():null;if(!AU||!AU.ctx)return;if(!SND.ready)sndInit(AU);
  const A=SND.A,t=A.currentTime,L=A.listener,c=camera.position;
  SND.k+=((on&&AU.on?1:0)-SND.k)*Math.min(1,dt*1.5);SND.out.gain.setTargetAtTime(SND.k*0.95,t,0.1);if(SND.k<0.01)return;
  camera.getWorldDirection(_sv);if(L.positionX){L.positionX.value=c.x;L.positionY.value=c.y;L.positionZ.value=c.z;L.forwardX.value=_sv.x;L.forwardY.value=_sv.y;L.forwardZ.value=_sv.z;L.upX.value=0;L.upY.value=1;L.upZ.value=0;}
  else{L.setPosition(c.x,c.y,c.z);L.setOrientation(_sv.x,_sv.y,_sv.z,0,1,0);}
  const T=TT,gust=0.5+0.5*Math.sin(T*0.21)*Math.sin(T*0.077+1.3),s=sNearFast(c.x,c.z),wd=Math.max(0.6,wallOff(s,c.y+4,1)-wallOff(s,c.y+4,-1)),narrow=clamp01(1.6/wd);
  const W=SND.wind;W.g.gain.setTargetAtTime((0.05+0.11*gust)*(0.6+0.6*narrow),t,0.3);W.lp.frequency.setTargetAtTime(220+260*gust,t,0.4);
  W.wh.forEach((h,i)=>{h.g.gain.setTargetAtTime(0.022*narrow*Math.max(0,Math.sin(T*(0.13+i*0.05)+i*2.1))*(0.4+gust),t,0.4);h.b.frequency.setTargetAtTime((540+i*410)*(1+0.12*Math.sin(T*0.31+i)),t,0.5);});
  for(const F of SND.falls){const cyc=(T*.06+F.f.ph)%1,k=(cyc<0.08?cyc/0.08:cyc<0.32?1:cyc<0.45?1-(cyc-0.32)/0.13:0);F.g.gain.setTargetAtTime(0.06*k*(0.7+0.3*Math.random()),t,0.08);}
  /* lanternes les plus proches */
  const near=LAN.slice().sort((a,b)=>a.d-b.d);
  SND.lan.forEach((S,i)=>{const e=near[i];if(!e){S.g.gain.setTargetAtTime(0,t,0.2);return;}const p=S.pn;if(p.positionX){p.positionX.value=e.pos.x;p.positionY.value=e.pos.y;p.positionZ.value=e.pos.z;}else p.setPosition(e.pos.x,e.pos.y,e.pos.z);
    S.g.gain.setTargetAtTime(0.05*(e.f||1),t,0.2);
    if(t>=S.next){S.next=t-Math.log(1-Math.random()*0.999)/5;sndBurst(t+0.01,p,2200+Math.random()*2500,1.4,0.006+Math.random()*0.02,0.12+Math.random()*0.25,'bandpass');}});
  if(SND.water){SND.water.g.gain.setTargetAtTime(0.09,t,0.3);SND.water.bp.frequency.setTargetAtTime(1100+700*Math.random(),t,0.05);}
  /* pas : deux par cycle de balancement, plus forts quand on marche vite */
  const sp=Math.abs(WALK.v);const st=Math.floor(WALK.ph/PI);if(st!==SND.step){SND.step=st;if(sp>0.25&&WALK.mode!==2)sndStep(t+0.01,0.09*clamp(sp/2,0.4,1.2),st%2?0.18:-0.18);}
  /* martinets, de temps en temps, quelque part au-dessus */
  if(t>(SND.nb||0)){SND.nb=t+5+Math.random()*11;const H=rimH(s);const pn=sndPan(c.x+(Math.random()-0.5)*8,Math.min(H-2,c.y+12+Math.random()*8),c.z+(Math.random()-0.5)*8);pn.connect(SND.out);sndSwift(t+0.05,pn);}}
const _sv=V3();
export async function init(api){
  API=api;window.RVC={ready:false,covers:false,canvas,frames:0,capT:null};
  api.canvas.after(canvas);
  veil=document.createElement('div');veil.style.cssText='position:fixed;inset:0;background:#0b0503;opacity:0;pointer-events:none';canvas.after(veil);
  tipEl=document.createElement('div');tipEl.style.cssText='position:fixed;z-index:7;pointer-events:none;transform:translate(16px,18px);font:700 11px/1 ui-monospace,Menlo,monospace;letter-spacing:.12em;text-transform:uppercase;color:#fff;background:rgba(0,0,0,.55);border:1px solid rgba(255,190,120,.7);padding:8px 11px;opacity:0;transition:opacity .2s;white-space:nowrap';document.body.appendChild(tipEl);
  const steps=[loadGI,buildLight,()=>buildWall(1,sandstoneMat('wall')),()=>buildWall(-1,WALLS[0].material),buildTemples,buildFloor,buildDecor,buildPost];
  for(const f of steps){const t0=performance.now();await f();if(CAPTURE)console.log('[RVC] étape',steps.indexOf(f),Math.round(performance.now()-t0),'ms');await nextTick();}
  resize();addEventListener('resize',()=>{if(wasOn)resize();});
  /* préparation : tous les shaders compilés et une image dessinée hors écran (pas d'à-coup à l'arrivée) */
  try{const S=STA[0];camera.position.copy(S.pos);camera.lookAt(S.tgt);camera.updateMatrixWorld();camera.getWorldDirection(_fw);
    if(renderer.compileAsync)await renderer.compileAsync(scene,camera);draw();renderer.shadowMap.needsUpdate=true;FR=0;}catch(e){console.warn('[RVC] préparation',e);}
  window.RVC.tick=tick;window.RVC.enter=i=>API.enter(i);window.RVC.ready=true;
  window.RVC.debug={LIZ,LAN,camera,scene,renderer,STA,STELE,WALK,PATH,pathAt,wallOff,sandH,U,FLAT,TA,TB,SND,get sun(){return sun;},get hemi(){return hemi;},get air(){return air;},get expo(){return expo;},get bloom(){return bloom;},MATS,
    view(pos,tgt,t){wasOn=true;canvas.style.display='block';resize();TT=t||14.3;U.uTime.value=TT;camera.position.set(pos[0],pos[1],pos[2]);camera.lookAt(tgt[0],tgt[1],tgt[2]);camera.updateMatrixWorld();camera.getWorldDirection(_fw);shadowFollow(true);DT=1/60;draw();},
    sim(P,dt,n,draw){for(let i=0;i<n;i++)tick(dt,P,'fin',0,false,0,!(draw&&i===n-1));}};
}

/* ═══════════════════════════════════════════════════════════════════════════════
   07 · outils de taille : primitives subdivisées, profils tournés, érosion (le grès s'use : arêtes adoucies,
   piqûres, base rongée par le sable)
   ═══════════════════════════════════════════════════════════════════════════════ */
const _m4=new THREE.Matrix4(),_q4=new THREE.Quaternion(),_e4=new THREE.Euler(),_s4=new THREE.Vector3();
function place(g,x,y,z,rx,ry,rz,sx,sy,sz){_e4.set(rx||0,ry||0,rz||0);_q4.setFromEuler(_e4);_s4.set(sx||1,sy||1,sz||1);_m4.compose(V3(x,y,z),_q4,_s4);g.applyMatrix4(_m4);return g;}
function nrm(g){g=mergeVertices(g,1e-4);g.computeVertexNormals();return g;}
function clean(g){g=g.index?g.toNonIndexed():g;for(const k of Object.keys(g.attributes))if(k!=='position')g.deleteAttribute(k);return g;}
/* boîte subdivisée (pour que l'érosion arrondisse seulement les arêtes) — centre (x,y,z) */
function sbox(w,h,d,x,y,z,ry,step){step=step||0.22;const g=new THREE.BoxGeometry(w,h,d,Math.max(1,Math.round(w/step)),Math.max(1,Math.round(h/step)),Math.max(1,Math.round(d/step)));return place(clean(g),x,y,z,0,ry||0,0);}
/* profil tourné, densifié en hauteur ; mod(x,y,z,θ) peut sculpter le rayon */
function lathe(pts,seg,step,mod){const P=[];for(let i=0;i<pts.length-1;i++){const a=pts[i],b=pts[i+1],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/(step||0.1)));for(let k=0;k<n;k++){const t=k/n;P.push(new THREE.Vector2(lerp(a[0],b[0],t),lerp(a[1],b[1],t)));}}
  P.push(new THREE.Vector2(...pts[pts.length-1]));const g=new THREE.LatheGeometry(P,seg||24);
  if(mod){const p=g.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),r=Math.hypot(x,z);if(r<1e-5)continue;const th=Math.atan2(z,x),k=mod(r,y,th)/r;p.setXYZ(i,x*k,y,z*k);}}
  return clean(g);}
/* extrusion d'un profil plan (fronton, arcs) */
function extr(shape,depth,steps,bev){return clean(new THREE.ExtrudeGeometry(shape,{depth,steps:steps||1,bevelEnabled:!!bev,bevelThickness:bev||0,bevelSize:bev||0,bevelSegments:2,curveSegments:24}));}
/* fusion + érosion : soudure des sommets, normales lissées, déplacement le long des normales par un bruit de pierre */
function erode(list,amp,opt){opt=opt||{};let g=mergeGeometries(list,false);g=mergeVertices(g,1e-3);g.computeVertexNormals();
  const p=g.attributes.position,n=g.attributes.normal,o=opt.o||V3(),sc=opt.freq||2.2;
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),wx=x+o.x,wy=y+o.y,wz=z+o.z;
    let d=(fbm3(wx*sc,wy*sc,wz*sc,2)-0.5)*0.7*amp+(vn3(wx*sc*4.3,wy*sc*4.3,wz*sc*4.3)-0.5)*0.9*amp;
    d-=Math.max(0,fbm3(wx*sc*3.1+7,wy*sc*3.1,wz*sc*3.1,2)-0.6)*amp*2.6;                 // piqûres
    if(opt.base)d-=amp*1.6*Math.max(0,1-(y)/opt.base)*fbm3(wx*1.3,wy*4,wz*1.3,2);          // pied rongé par le sable
    p.setXYZ(i,x+n.getX(i)*d,y+n.getY(i)*d,z+n.getZ(i)*d);}
  g.computeVertexNormals();return g;}
/* attribut de lumière rebondie pour les volumes posés dans la gorge : hauteur relative, ouverture du ciel */
function giAttr(g,mesh,open,rim){mesh.updateMatrixWorld(true);const p=g.attributes.position,a=new Float32Array(p.count*2),v=V3();
  for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);a[i*2]=clamp01(v.y/(rim||29));a[i*2+1]=open;}g.setAttribute('aG',new THREE.BufferAttribute(a,2));}

/* ═══════════════════════════════════════════════════════════════════════════════
   08 · le Trésor (droit des affaires) : façade hellénistique taillée dans la falaise, deux ordres,
   portique à six colonnes et fronton, tholos à toit conique et urne, demi-frontons, statues rongées
   ═══════════════════════════════════════════════════════════════════════════════ */
const TA={};
function colGeo(h,r,cap,seg){                                              // colonne : base attique, fût galbé, chapiteau corinthien usé
  const b=0.16*r/0.3,prof=[[0,0],[r*1.42,0],[r*1.42,b*0.9],[r*1.3,b*1.1],[r*1.32,b*1.5],[r*1.12,b*1.9],[r*1.16,b*2.3],[r*1.02,b*2.6]];
  const H=h-cap;for(let k=1;k<=8;k++){const t=k/8;prof.push([r*(1.0+0.035*Math.sin(t*PI*0.85)-0.08*t),lerp(b*2.6,H,t)]);}
  prof.push([r*0.98,H+0.02],[r*1.05,H+0.06],[r*0.93,H+0.1]);
  for(let k=1;k<=6;k++){const t=k/6;prof.push([r*(0.93+0.42*t*t),H+0.1+(cap-0.32)*t]);}
  prof.push([r*1.55,h-0.2],[r*1.6,h-0.12],[r*1.6,h],[0,h]);
  return lathe(prof,seg||26,0.09,(rr,y,th)=>{if(y<H+0.08||y>h-0.21)return rr;const t=(y-H-0.1)/(cap-0.3);   // feuilles d'acanthe : deux rangs de lobes, volutes aux angles
    const l1=Math.max(0,Math.cos(th*8))**3*0.12*Math.sin(clamp01(t/0.55)*PI),l2=Math.max(0,Math.cos(th*8+PI/8*0))**2*0;const vol=Math.max(0,Math.cos(th*4+PI/4))**8*0.22*smooth(0.55,0.95,t);
    return rr+r*(l1+l2+vol);});}
/* panneau sculpté (relief par parallaxe et ombres propres) sur un plan tourné vers +z du repère d'un groupe */
function reliefMat(root,key,hfn,colfn,dep){
  const uni={uRI:{value:new THREE.Matrix4()},uRR:{value:new THREE.Matrix3()},uSunL:{value:V3()}};
  const sync=()=>{root.updateMatrixWorld(true);uni.uRI.value.copy(root.matrixWorld).invert();uni.uRR.value.setFromMatrix4(root.matrixWorld);
    uni.uSunL.value.copy(SUN).applyMatrix3(new THREE.Matrix3().setFromMatrix4(uni.uRI.value)).normalize();};sync();
  return rvMat({color:0xffffff,roughness:.88,metalness:0},{key,uniforms:uni,
    vHead:'varying vec3 vL;varying vec3 vEyeL;uniform mat4 uRI;',vMain:'vL=(uRI*vec4(vW,1.)).xyz;vEyeL=mat3(uRI)*(cameraPosition-vW);',
    fHead:`uniform mat3 uRR;uniform vec3 uSunL;varying vec3 vL;varying vec3 vEyeL;float rvPomSh=1.;vec2 rlUV;float rlH;
      ${hfn}
      vec2 rlPom(vec2 uv,vec3 v){const int NS=${[5,9,12][TIER]};float ls=1./float(NS);vec2 dd=-v.xy/max(v.z,.3)*${dep.toFixed(3)}*ls;float cl=1.;vec2 p=uv;float h=rlHF(p);
        for(int i=0;i<NS;i++){if(h>=cl)break;p+=dd;cl-=ls;h=rlHF(p);}vec2 pp=p-dd;float hp=rlHF(pp);float a=(h-cl)/max((h-cl)-(hp-cl-ls),1e-4);return mix(p,pp,clamp(a,0.,1.));}`,
    fColor:`rlUV=${TIER>0?'rlPom(vL.xy,normalize(vEyeL))':'vL.xy'};rlH=rlHF(rlUV);
      {float s=0.;vec2 dd=uSunL.xy/max(uSunL.z,.05)*${dep.toFixed(3)};for(int i=1;i<=4;i++){float t=float(i)/4.*(1.-rlH);s=max(s,(rlHF(rlUV+dd*t)-rlH-t)*7.);}rvPomSh=uSunL.z>.02?1.-clamp(s,0.,1.):0.;}
      ${colfn}`,
    fNormal:`{float e=.004;float hx=rlHF(rlUV+vec2(e,0.)),hy=rlHF(rlUV+vec2(0.,e));vec3 nT=normalize(vec3(-(hx-rlH)/e*${dep.toFixed(3)},-(hy-rlH)/e*${dep.toFixed(3)},1.));normal=normalize((viewMatrix*vec4(uRR*nT,0.)).xyz);}`,
    fGI:'float rvOpen=.8,rvHn=clamp(vW.y/30.,0.,1.);',pomSh:true});}
/* grès sculpté du Trésor : couleur commune aux panneaux (bandes roses, crème et rouille de Pétra, usure) */
const TR_COL=`float bnd=vW.y*1.25+.9*rvF(vW*.07);float bb=rvN(vec3(bnd*.7,.3,.5));
  vec3 c=bb<.38?vec3(.78,.44,.33):bb<.7?vec3(.86,.62,.45):vec3(.62,.27,.15);c*=.9+.16*rvF(vW*1.7);
  c*=mix(.62,1.,smoothstep(.1,.8,rlH));c*=1.-.3*smoothstep(.55,.85,rvN(vec3((vW.x+vW.z)*2.4,vW.y*.09,vW.z*.6)))*smoothstep(1.5,7.,vW.y);diffuseColor.rgb=c;`;
async function buildTempleA(){
  const pa=pathAt(S_FA,{});const ox=pa.x+pa.nx*FA.CLIFF,oz=pa.z+pa.nz*FA.CLIFF;
  const root=new THREE.Group();root.position.set(ox,0,oz);root.rotation.y=Math.atan2(-pa.nx,-pa.nz);scene.add(root);TA.root=root;
  /* repère local : x le long de la falaise, y vers le haut, z vers le visiteur ; la falaise est en z=0, le fond du retrait en z=-FA.D */
  const G=[];const Z0=-0.35;                                                // plan des colonnes
  /* emmarchement, socle */
  G.push(sbox(12.0,0.18,2.4,0,0.09,0.6),sbox(11.6,0.18,2.0,0,0.27,0.35),sbox(11.2,0.2,1.7,0,0.46,0.15));
  G.push(sbox(12.2,0.56,FA.D+0.2,0,0.28,-FA.D/2-0.1));
  /* six colonnes de l'ordre inférieur, et leurs pilastres engagés */
  const YB=0.56,CH=6.3,CR=0.31,XS=[-5.1,-3.3,-1.15,1.15,3.3,5.1];
  const GC=[];XS.forEach((x,i)=>{GC.push(place(colGeo(CH,CR,0.82),x,YB,Z0));
    if(i===0||i===5){G.push(sbox(0.85,CH,0.5,x+(i?0.32:-0.32),YB+CH/2,Z0-0.42));}});
  /* entablement : architrave, frise, corniche à denticules */
  const YE=YB+CH;
  G.push(sbox(11.4,0.46,0.92,0,YE+0.23,Z0-0.05),sbox(11.2,0.08,0.96,0,YE+0.5,Z0-0.05));
  G.push(sbox(11.2,0.56,0.82,0,YE+0.82,Z0-0.12));
  for(let k=0;k<44;k++){const x=-5.55+k*(11.1/43);G.push(sbox(0.12,0.12,0.1,x,YE+1.16,Z0+0.34,0,0.2));}       // denticules
  G.push(sbox(11.9,0.14,1.18,0,YE+1.29,Z0+0.06),sbox(12.1,0.2,1.24,0,YE+1.46,Z0+0.08));
  /* frise : rinceaux et vases en faible relief (bosses régulières) */
  TA.carve=[[11.0,0.5,0,YE+0.82,Z0+0.293]];
  /* fronton du portique (au-dessus des quatre colonnes centrales) */
  const YP=YE+1.56,PW=4.6,PH=1.55;
  {const sh=new THREE.Shape();sh.moveTo(-PW,0);sh.lineTo(PW,0);sh.lineTo(0,PH);sh.lineTo(-PW,0);G.push(place(extr(sh,0.7),0,YP,Z0-0.45));
   const ang=Math.atan2(PH,PW),L=Math.hypot(PW,PH)+0.28;
   for(const sx of[-1,1]){G.push(place(clean(new THREE.BoxGeometry(L,0.24,1.05,Math.round(L/0.2),2,4)),sx*PW/2,YP+PH/2+0.1,Z0+0.02,0,0,-sx*ang));}
   TA.tymp=[PW,PH,YP,Z0+0.255];
   for(const sx of[-1,0,1])G.push(place(clean(new THREE.SphereGeometry(0.28,12,9)),sx*PW*0.98,YP+(sx?0.28:PH+0.32),Z0+0.05,0,0,0,0.9,1.3,0.8));}   // acrotères
  /* attique entre les deux ordres */
  const YA=YP+PH+0.1;
  G.push(sbox(12.0,YA-YE-1.56,0.6,0,(YE+1.56+YA)/2,Z0-0.8));
  G.push(sbox(12.3,0.42,1.3,0,YA+0.21,Z0-0.1),sbox(12.5,0.12,1.4,0,YA+0.48,Z0-0.08));
  /* ordre supérieur : tholos central, pavillons latéraux à demi-frontons */
  const YU=YA+0.54,UH=4.4,TR=1.42,TZ=Z0-0.55;
  G.push(place(lathe([[0,0],[TR+0.25,0],[TR+0.25,0.25],[TR-0.05,0.3],[TR-0.05,UH],[0,UH]],36,0.15),0,YU,TZ));        // tambour
  for(let k=0;k<7;k++){const a=(k/6-0.5)*2.4,x=Math.sin(a)*(TR+0.2),z=TZ+Math.cos(a)*(TR+0.2);GC.push(place(colGeo(UH,0.2,0.55,18),x,YU,z));}
  G.push(place(lathe([[0,0],[TR+0.42,0],[TR+0.48,0.18],[TR+0.36,0.22],[TR+0.36,0.62],[TR+0.52,0.72],[TR+0.55,0.86],[0,0.86]],40,0.1),0,YU+UH,TZ));   // entablement circulaire
  G.push(place(lathe([[TR+0.42,0],[TR*0.5,0.7],[0.32,1.25],[0,1.32]],40,0.12),0,YU+UH+0.86,TZ));                        // toit en tente
  G.push(place(lathe([[0,0],[0.3,0],[0.34,0.1],[0.22,0.22],[0.2,0.3],[0.42,0.55],[0.5,0.82],[0.42,1.02],[0.24,1.12],[0.26,1.2],[0.12,1.3],[0,1.38]],22,0.06),0,YU+UH+2.15,TZ));   // l'urne
  for(const sx of[-1,1]){
    const xin=sx*2.55,xout=sx*5.35;
    G.push(sbox(3.2,0.3,1.0,sx*3.95,YU+0.15,Z0-0.2));
    for(const x of[xin,xout]){GC.push(place(colGeo(UH-0.3,0.22,0.6,18),x,YU+0.3,Z0-0.15));}
    G.push(sbox(3.4,0.42,0.9,sx*3.95,YU+UH+0.21,Z0-0.15),sbox(3.6,0.16,1.05,sx*3.95,YU+UH+0.5,Z0-0.08));
    const hs=new THREE.Shape();hs.moveTo(0,0);hs.lineTo(2.9,0);hs.lineTo(0,1.15);hs.lineTo(0,0);                          // demi-fronton : haut contre le tholos
    const hp=extr(hs,0.75);if(sx<0)hp.scale(-1,1,1);G.push(place(hp,sx*2.3,YU+UH+0.58,Z0-0.55));
    G.push(place(clean(new THREE.BoxGeometry(3.25,0.2,1.0,14,2,4)),sx*3.75,YU+UH+0.58+0.62,Z0-0.08,0,0,-sx*Math.atan2(1.15,2.9)));}
  G.push(sbox(12.0,UH+1.4,0.5,0,YU+(UH+1.4)/2,-FA.D+0.25));                                                            // fond de l'ordre supérieur
  /* mur du portique, porte centrale (encadrement mouluré, linteau), portes latérales */
  {const sh=new THREE.Shape();sh.moveTo(-5.8,0);sh.lineTo(5.8,0);sh.lineTo(5.8,CH);sh.lineTo(-5.8,CH);sh.lineTo(-5.8,0);
   const dW=1.15,dH=4.7,hole=new THREE.Path();hole.moveTo(-dW,0.02);hole.lineTo(dW,0.02);hole.lineTo(dW,dH);hole.lineTo(-dW,dH);hole.lineTo(-dW,0.02);sh.holes.push(hole);
   for(const sx of[-1,1]){const h2=new THREE.Path(),cx=sx*3.3;h2.moveTo(cx-0.62,0.02);h2.lineTo(cx+0.62,0.02);h2.lineTo(cx+0.62,2.9);h2.lineTo(cx-0.62,2.9);h2.lineTo(cx-0.62,0.02);sh.holes.push(h2);}
   G.push(place(extr(sh,0.45,1),0,YB,-FA.D+0.2));
   for(const sx of[-1,1]){G.push(sbox(0.28,dH+0.2,0.18,sx*(dW+0.14),YB+dH/2,-FA.D+0.74));}
   G.push(sbox(2.9,0.3,0.24,0,YB+dH+0.25,-FA.D+0.76),sbox(3.2,0.14,0.34,0,YB+dH+0.47,-FA.D+0.78));
   const ls=new THREE.Shape();ls.moveTo(-1.6,0);ls.lineTo(1.6,0);ls.lineTo(0,0.62);ls.lineTo(-1.6,0);G.push(place(extr(ls,0.28),0,YB+dH+0.55,-FA.D+0.6));}
  /* statues rongées (cavaliers en bas, figures en haut) */
  const blob=(x,y,z,sx,sy,sz,rz)=>{const g=clean(new THREE.IcosahedronGeometry(1,3));place(g,x,y,z,0,0,rz||0,sx,sy,sz);return g;};
  const cap=(r,l,x,y,z,rx,rz)=>place(clean(new THREE.CapsuleGeometry(r,l,4,8)),x,y,z,rx||0,0,rz||0);
  const figure=(x,y,z,h,k,horse)=>{const sx=k?1:-1;
    G.push(place(lathe([[0,0],[0.34,0],[0.3,0.08],[0.27,0.35],[0.22,0.55],[0.19,0.62],[0.2,0.7],[0.23,0.78],[0.2,0.86],[0.14,0.91],[0.08,0.93],[0,0.94]].map(q=>[q[0]*h*0.42,q[1]*h]),16,0.06,
      (rr,yy,th)=>rr*(1+0.07*Math.cos(th*9+yy*3.1)*smooth(0.05*h,0.6*h,yy)*(1-smooth(0.62*h,0.75*h,yy)))),x,y,z,0,0,0,1,1,0.5));      // drapé à plis
    G.push(blob(x,y+h*1.0,z+0.04,h*0.07,h*0.085,h*0.068));                                                                 // tête
    G.push(blob(x+sx*h*0.12,y+h*0.62,z+0.05,h*0.05,h*0.24,h*0.05,sx*0.45),blob(x-sx*h*0.1,y+h*0.74,z+0.09,h*0.045,h*0.14,h*0.045,-sx*0.9));   // bras usés contre le corps
    G.push(sbox(h*0.32,h*0.06,h*0.22,x,y-h*0.03,z,0,0.2));                                                                   // socle
  };
  for(const sx of[-1,1]){figure(sx*4.2,YB+0.1,-FA.D+0.8,2.7,sx<0,true);figure(sx*1.9,YU+0.32,-FA.D+0.78,2.4,sx>0);figure(sx*4.65,YU+0.32,-FA.D+0.78,2.3,sx<0);}
  figure(0,YU+0.3,TZ-0.95,2.2,true);
  const geo=mergeGeometries([erode(G,0.03,{o:V3(ox,0,oz),freq:2.6,base:1.2}),erode(GC,0.009,{o:V3(ox,0,oz),freq:3.5,base:1.0})]);
  const mat=sandstoneMat('facade','vec3(1.0,.9,.92)',{noAtlas:true,giK:1.0,lines:0.0,fColor:`
    float rvStk=smoothstep(.5,.85,rvN(vec3((vW.x+vW.z)*2.4,vW.y*.09,vW.z*.6)))*smoothstep(1.5,7.,vW.y)*(.6+.4*rvN(vW*.4));diffuseColor.rgb*=1.-.34*rvStk;
    float rvPale=smoothstep(.58,.8,rvF(vW*.22+5.));diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(1.12,1.06,1.02)+.03,rvPale*.5);
    float rvPit=smoothstep(.7,.85,rvN(vW*11.))*smoothstep(.5,.75,rvN(vW*1.3));diffuseColor.rgb*=1.-.12*rvPit;
    diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.62,.36,.22),.3*smoothstep(.7,.0,vW.y));
    {float bnd=vW.y*1.25+.9*rvF(vW*.07);float bb=rvN(vec3(bnd*.7,.3,.5));vec3 pb=bb<.38?vec3(1.06,.86,.86):bb<.7?vec3(1.08,1.02,.92):vec3(.86,.68,.6);diffuseColor.rgb*=mix(vec3(1.),pb,.75);}`,
    fNormal:`{float h=.004*rvN(vW*9.)+.006*smoothstep(.62,.8,rvN(vW*7.))*smoothstep(.4,.7,rvN(vW*1.3))*-1.+.002*rvN(vW*31.);normal=rvBump(-vViewPosition,normal,h,1.);}`});
  const mesh=new THREE.Mesh(geo,mat);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);root.updateMatrixWorld(true);giAttr(geo,mesh,1,30.5);TA.mesh=mesh;
  /* frise sculptée : rinceaux qui ondulent, rosaces, vases ; tympan : couronne d'acanthe et buste effacé — le tout rongé par le vent */
  {const fm=reliefMat(root,'trfrieze',`float rlHF(vec2 p){float y=p.y-${(YE+0.82).toFixed(3)},x=p.x;float u=fract(x)-.5,ux=fract(x+.5)-.5;
      float ros=1.-smoothstep(.1,.15,length(vec2(u,y))*(1.+.28*cos(atan(y,u)*8.)));float boss=1.-smoothstep(.02,.04,length(vec2(u,y)));
      float w=.05+.06*sin(clamp((y+.2)/.4,0.,1.)*3.1416);float vas=(1.-smoothstep(w-.012,w+.012,abs(ux)))*step(-.2,y)*step(y,.17);
      float sc=1.-smoothstep(.018,.04,abs(y-.12*sin(x*12.566)));float leaf=(1.-smoothstep(.03,.06,length(vec2(fract(x*4.)-.5,(y-.12*sin(x*12.566)-.06*sign(sin(x*12.566)))*3.)*.25)));
      float fr=max(1.-smoothstep(.0,.02,y+.23),smoothstep(.21,.23,y));
      float h=max(max(max(ros*.85,boss),vas*.9),max(max(sc*.75,leaf*.6),fr));
      return .15+.85*h*(.5+.5*smoothstep(.25,.7,rvF(vec3(p*2.6,1.7))));}`,TR_COL,0.05);
    for(const [w,h,x,y,z] of TA.carve){const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),fm);m.position.set(x,y,z);m.receiveShadow=true;root.add(m);}
    const [PW,PH,YP,ZT]=TA.tymp;const ts=new THREE.Shape();ts.moveTo(-PW+0.55,0.24);ts.lineTo(PW-0.55,0.24);ts.lineTo(0,PH-0.12);ts.lineTo(-PW+0.55,0.24);
    const tm=reliefMat(root,'trtymp',`float rlHF(vec2 p){vec2 q=vec2(p.x,p.y-${(TA.tymp[2]+0.62).toFixed(3)});float r=length(q*vec2(1.,1.25)),a=atan(q.y,q.x);
      float wreath=(1.-smoothstep(.04,.07,abs(r-.42)))*(.6+.4*abs(sin(a*14.)));float bust=1.-smoothstep(.2,.26,length((q-vec2(0.,.02))*vec2(1.3,1.)));
      float head=1.-smoothstep(.07,.1,length(q-vec2(0.,.2)));float ac=(1.-smoothstep(.03,.06,abs(q.y+.05-.18*cos(q.x*5.)*exp(-abs(q.x)*.6))))*step(.55,abs(q.x));
      float sp=sin(atan(q.y,q.x-sign(q.x)*1.4)+log(length(q-vec2(sign(q.x)*1.4,0.))+.05)*6.)*.5+.5;float scr=smoothstep(.6,.9,sp)*(1.-smoothstep(.25,.4,length(q-vec2(sign(q.x)*1.4,0.))));
      float h=max(max(wreath,max(bust,head)*.9),max(ac*.7,scr*.75));return .1+.9*h*(.4+.6*smoothstep(.3,.75,rvF(vec3(p*2.2,4.1))));}`,TR_COL,0.07);
    const tg=new THREE.ShapeGeometry(ts);const tmesh=new THREE.Mesh(tg,tm);tmesh.position.set(0,YP,ZT);tmesh.receiveShadow=true;root.add(tmesh);}
  const W=v=>v.clone().applyMatrix4(root.matrixWorld);
  TA.door=W(V3(0,YB+1.7,1.2));TA.inside=W(V3(0,YB+1.6,-FA.D-3.5));TA.center=W(V3(0,8.4,0));
  FLAT.push({x:W(V3(0,0,2.5)).x,z:W(V3(0,0,2.5)).z,r:6.5,h:0.02});
  /* volume cliquable */
  const hit=new THREE.Mesh(new THREE.BoxGeometry(13,18,4),new THREE.MeshBasicMaterial({colorWrite:false,depthWrite:false}));hit.position.set(0,9,-0.3);root.add(hit);HITS[0]=hit;
  /* station : on s'arrête au débouché du défilé, la façade en biais, toute entière dans le cadre */
  const sSt=S_PLAZA-0.6;STA[0]={s:sSt,pos:eyeAt(sSt,-0.9,V3()),tgt:W(V3(0.8,8.2,0)),door:TA.door,inside:TA.inside};
  TA.L=W(V3(0,0,0));U.uTAc.value.set(TA.L.x,0,TA.L.z,13);
}
/* ═══════════════════════════════════════════════════════════════════════════════
   09 · les lanternes : laiton ajouré (étoiles et points percés), verre teinté, flamme qui vacille ; suspendues,
   elles se balancent au vent et le motif de leurs trous, projeté sur la roche, tourne avec elles
   ═══════════════════════════════════════════════════════════════════════════════ */
const LAN=[];
let LANMAT=null;
function lanTex(){const W=512,H=256,c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,W,H);x.fillStyle='#000';
  const cw=W/16,ch=H/8;for(let j=0;j<8;j++)for(let i=0;i<16;i++){const cx=(i+0.5)*cw,cy=(j+0.5)*ch;
    if((i+j)%2===0){x.beginPath();for(let k=0;k<16;k++){const a=k/16*TAU,r=(k%2?0.17:0.36)*Math.min(cw,ch);x.lineTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r);}x.closePath();x.fill();}
    else{x.beginPath();x.arc(cx,cy,0.13*Math.min(cw,ch),0,TAU);x.fill();}}
  x.fillStyle='#fff';for(let i=0;i<=16;i+=2)x.fillRect(i*cw-2,0,4,H);x.fillRect(0,0,W,6);x.fillRect(0,H-6,W,6);
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(2,1);t.anisotropy=4;return t;}
function lanMats(){if(LANMAT)return LANMAT;const tex=lanTex();
  LANMAT={brass:new THREE.MeshStandardMaterial({color:0xb98535,metalness:1,roughness:.38,envMap:ENVTEX,envMapIntensity:.7,alphaMap:tex,alphaTest:.5,side:THREE.DoubleSide}),
    solid:new THREE.MeshStandardMaterial({color:0x9a6a2a,metalness:1,roughness:.42,envMap:ENVTEX,envMapIntensity:.6}),
    glass:[0xffb35a,0xff7a3a,0xffd27a].map(c=>new THREE.MeshStandardMaterial({color:0x000000,emissive:c,emissiveIntensity:2.2,roughness:.3,side:THREE.DoubleSide})),
    glow:new THREE.SpriteMaterial({map:(()=>{const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d'),g=x.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.15,'rgba(255,220,160,.55)');g.addColorStop(.45,'rgba(255,170,90,.12)');g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(0,0,128,128);return new THREE.CanvasTexture(c);})(),color:0xffc890,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}),
    link:new THREE.TorusGeometry(.022,.006,5,10)};
  for(const m of[LANMAT.brass,LANMAT.solid])rvLit(m,'lanmetal');
  return LANMAT;}
/* les métaux et le cuir sont aussi éclairés par les lanternes et la lumière rebondie de la gorge */
function rvLit(m,key){m.onBeforeCompile=sh=>{Object.assign(sh.uniforms,U);
  sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vW;varying vec3 vWN;').replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvW=(modelMatrix*vec4(transformed,1.)).xyz;vWN=normalize(mat3(modelMatrix)*objectNormal);');
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vW;varying vec3 vWN;'+GLSL_COMMON).replace('void main() {','vec3 rvLanSpec=vec3(0.);\nvoid main() {')
    .replace('#include <lights_fragment_maps>',`#include <lights_fragment_maps>
      {vec3 rvWn=normalize((vec4(normal,0.)*viewMatrix).xyz);vec3 rvV=normalize(cameraPosition-vW);vec3 rvD=vec3(0.),rvS=vec3(0.);float rvHn=clamp(vW.y/uRim,0.,1.);
       if(uGB>.5)irradiance+=rvVol(vW,rvWn)*uGI;else irradiance+=rvGiPal(rvHn)*(.3+.5*clamp(rvWn.y*.5+.5,0.,1.))*uGI*3.14159+rvBounce(vW,rvWn)*3.14159;rvLanterns(vW,rvWn,rvV,material.roughness,rvD,rvS);irradiance+=rvD*3.14159;rvLanSpec=rvS;}`)
    .replace('#include <lights_fragment_end>','#include <lights_fragment_end>\nreflectedLight.directSpecular+=rvLanSpec*material.specularColor*2.;');};
  m.customProgramCacheKey=()=>'rvl_'+key;return m;}
/* une lanterne marocaine : finial, bulbe ajouré, col, dôme pointu, anneau ; à l'intérieur un verre qui rougeoie */
function lanternMesh(scale,glassI){const M=lanMats(),g=new THREE.Group();
  const prof=[[0.0,-0.36],[0.03,-0.33],[0.05,-0.27],[0.12,-0.2],[0.19,-0.1],[0.215,0.0],[0.2,0.1],[0.15,0.17],[0.1,0.2]].map(q=>new THREE.Vector2(q[0],q[1]));
  const body=new THREE.Mesh(LANGEO.body||(LANGEO.body=new THREE.LatheGeometry(prof,32)),M.brass);g.add(body);
  if(!LANGEO.solid){const parts=[new THREE.LatheGeometry([[0.11,0.19],[0.16,0.22],[0.15,0.26],[0.1,0.31],[0.05,0.38],[0.025,0.43],[0.0,0.47]].map(q=>new THREE.Vector2(q[0],q[1])),24),
      new THREE.TorusGeometry(0.205,0.012,6,32).rotateX(PI/2),new THREE.TorusGeometry(0.035,0.008,6,14).translate(0,0.5,0),new THREE.SphereGeometry(0.028,10,8).translate(0,-0.37,0)];
    LANGEO.solid=mergeGeometries(parts.map(q=>{q=q.index?q.toNonIndexed():q;q.deleteAttribute('uv');return q;}));LANGEO.glass=new THREE.LatheGeometry(prof.map(v=>new THREE.Vector2(v.x*0.8,v.y*0.92)),20);}
  g.add(new THREE.Mesh(LANGEO.solid,M.solid));
  const glass=new THREE.Mesh(LANGEO.glass,M.glass[glassI%3]);g.add(glass);
  const glow=new THREE.Sprite(M.glow);glow.scale.setScalar(1.25);g.add(glow);
  g.scale.setScalar(scale);g.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;}});return {g,glass,glow};}
const LANGEO={};
/* suspendue : pivot au point d'attache, chaîne, lanterne ; posée : socle de laiton */
function addLantern(o){const L=lanternMesh(o.scale||1,o.glass||0);let pivot=null;
  if(o.hang){pivot=new THREE.Group();pivot.position.copy(o.at);scene.add(pivot);const len=o.hang;
    const n=Math.round(len/0.05),links=[];for(let i=0;i<n;i++){const l=LANMAT.link.clone();l.deleteAttribute('uv');place(l,0,-i*0.05-0.025,0,0,i%2?PI/2:0,0,1,1.4,1);links.push(l);}
    pivot.add(new THREE.Mesh(mergeGeometries(links),LANMAT.solid));
    L.g.position.y=-len-0.5*(o.scale||1);pivot.add(L.g);}
  else{L.g.position.copy(o.at).add(V3(0,0.36*(o.scale||1),0));scene.add(L.g);}
  const e={L,pivot,I:o.I||6,R:o.R||7,col:new THREE.Color(o.col||0xffa860),colored:o.colored||0,ph:rnd()*TAU,amp:o.amp||0.05,pos:V3(),tilt:V3(),yaw:rnd()*TAU,t:o.t===undefined?LAN_T:o.t,hk:0};LAN.push(e);return e;}
let LAN_T=-1;
const _lv=V3();
function lanternsTick(t,dt){
  const gust=0.5+0.5*Math.sin(t*0.21)*Math.sin(t*0.077+1.3);
  for(const e of LAN){e.hk+=((OVER>=0&&e.t===OVER?1:0)-e.hk)*Math.min(1,dt*5);const f=(0.84+0.1*Math.sin(t*7.3+e.ph)+0.06*Math.sin(t*17.1+e.ph*3)+0.04*Math.sin(t*31+e.ph))*(1+0.35*e.hk);e.f=f;
    if(e.pivot){const a=e.amp*(0.35+0.65*gust);e.pivot.rotation.z=Math.sin(t*1.7+e.ph)*a;e.pivot.rotation.x=Math.sin(t*1.3+e.ph*1.7)*a*0.7;e.L.g.rotation.y=e.yaw+Math.sin(t*0.4+e.ph)*0.25;e.tilt.set(e.pivot.rotation.x,0,e.pivot.rotation.z);}
    e.L.g.getWorldPosition(e.pos);e.L.glass.material.emissiveIntensity=2.2*f;e.L.glow.material.opacity=0.85;e.L.glow.scale.setScalar(1.15+0.12*f);
    e.d=e.pos.distanceToSquared(camera.position);}
  const near=LAN.slice().sort((a,b)=>a.d-b.d);
  for(let i=0;i<NLAN;i++){const e=near[i];if(!e){U.uLanP.value[i].w=0;continue;}const fade=i>=NLAN-2?0.5:1;
    U.uLanP.value[i].set(e.pos.x,e.pos.y,e.pos.z,e.I*e.f*fade);U.uLanC.value[i].set(e.col.r,e.col.g,e.col.b,e.R);
    U.uLanX.value[i].set(-(e.pivot?e.L.g.rotation.y:e.yaw),e.tilt.x,e.tilt.z,e.colored);}}
function buildLanternsA(){lanMats();LAN_T=0;const r=TA.root,W=v=>v.clone().applyMatrix4(r.matrixWorld);
  const YE=0.56+6.3;
  addLantern({at:W(V3(0,YE-0.05,-0.75)),hang:1.55,scale:1.15,I:7,glass:0,amp:0.06});
  for(const sx of[-1,1])addLantern({at:W(V3(sx*2.25,YE-0.05,-0.55)),hang:1.25,scale:0.95,I:5,glass:1,amp:0.07,colored:0.6});
  for(const sx of[-1,1])addLantern({at:W(V3(sx*1.85,0.56,0.25)),scale:1.0,I:5.5,glass:2});
  addLantern({at:W(V3(0,5.1,-FA.D-2.6)),hang:0.9,scale:1.0,I:6,glass:0,amp:0.02,R:6});
  for(const sx of[-1,1])addLantern({at:W(V3(sx*3.3,0.02,-FA.D-0.9)),scale:0.75,I:3,glass:1,R:4});
  /* sur le chemin : quelques lanternes posées au pied des parois */
  LAN_T=-1;const pa={};for(const [s0,o] of [[29,-0.55],[36.5,0.6],[66,0.55],[75,-0.5]]){pathAt(s0,pa);const w=o>0?wallOff(s0,0.3,1)-0.35:wallOff(s0,0.3,-1)+0.35,x=pa.x+pa.nx*w,z=pa.z+pa.nz*w;
    addLantern({at:V3(x,groundAt(x,z),z),scale:0.8,I:3.2,glass:(s0|0)%3,R:5,colored:0.4});}
}
/* ═══════════════════════════════════════════════════════════════════════════════
   10 · le pavillon mudéjar (analyse financière), façon palais du roi don Pedro à l'Alcázar de Séville :
   un portique de cinq arcs polylobés sur colonnes jumelées de marbre (chapiteaux nasrides, tailloirs), écoinçons
   de stuc ciselé (ataurique), arcs aux claveaux bicolores, bandeau d'écriture coufique, étage aux trois ajimez
   fermés de moucharabiehs, panneaux de sebka, tours d'angle à merlons, grand auvent de cèdre sur corbeaux à
   volutes et sous-face à caissons, toit de tuiles vernissées vertes ; dans le portique : plafond à caissons,
   zelliges, grande porte de bois clouté qui mène au donjon.
   Le décor est sculpté dans le shader (relief par parallaxe, ombres propres du relief) sur une architecture
   réellement construite (profondeurs, épaisseurs, saillies), pour que la lumière du faisceau y accroche.
   ═══════════════════════════════════════════════════════════════════════════════ */
const TB={};
function cvs(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return [c,c.getContext('2d')];}
/* tapis (aussi sur les marches du Trésor) */
function texCarpet(){const W=512,H=768,[c,x]=cvs(W,H),r=mulberry(9);x.fillStyle='#6e1414';x.fillRect(0,0,W,H);
  x.fillStyle='#1d2850';x.fillRect(24,24,W-48,H-48);x.fillStyle='#7d1818';x.fillRect(56,56,W-112,H-112);
  x.strokeStyle='#d6b066';x.lineWidth=5;x.strokeRect(40,40,W-80,H-80);x.strokeRect(62,62,W-124,H-124);
  x.save();x.translate(W/2,H/2);for(let k=0;k<3;k++){x.beginPath();for(let i=0;i<=64;i++){const a=i/64*TAU,rr=(130-k*38)*(1+0.12*Math.cos(a*8));x.lineTo(Math.cos(a)*rr*0.8,Math.sin(a)*rr*1.15);}x.closePath();x.fillStyle=['#1d2850','#d6b066','#7d1818'][k];x.fill();}x.restore();
  for(let i=0;i<500;i++){x.fillStyle=['#d6b066','#e7dcc2','#1d2850','#2f6a4f'][i%4];x.fillRect(70+r()*(W-140),70+r()*(H-140),3,3);}
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;}
function marbleMat(){return rvMat({color:0xffffff,roughness:.22,metalness:0,envMap:ENVTEX,envMapIntensity:.8},{key:'marble',
  fColor:`vec3 P=vW*2.2;float w=rvF(P*vec3(.9,.35,.9))*3.+rvF(P*2.3)*.8;float v=abs(fract(w)-.5)*2.;vec3 c=mix(vec3(.52,.49,.44),vec3(.74,.71,.64),smoothstep(.1,.7,rvF(P*.7)));c=mix(c,vec3(.84,.82,.77),smoothstep(.93,.99,v)*.6);c=mix(c,vec3(.36,.36,.33),smoothstep(.07,.0,v)*.45);
    c*=1.-.25*smoothstep(.55,.85,rvN(vec3(vW.x*6.,vW.y*.4,vW.z*6.)))*smoothstep(1.2,.2,vW.y);diffuseColor.rgb=c;`,
  fRough:'roughnessFactor=mix(.18,.5,rvN(vW*3.));',fGI:'float rvOpen=.6,rvHn=clamp(vW.y/34.,0.,1.);',specK:'2.0'});}
function goldMat(){const m=new THREE.MeshStandardMaterial({color:0xd4a647,metalness:1,roughness:.3,envMap:ENVTEX,envMapIntensity:1.1});return rvLit(m,'gold');}
function woodMat(){return rvMat({color:0xffffff,roughness:.7,metalness:0},{key:'cedar',fColor:`vec3 P=vW;float g=sin((P.y*40.+rvF(P*vec3(.5,3.,.5))*6.))*.5+.5;diffuseColor.rgb=mix(vec3(.18,.08,.035),vec3(.32,.16,.07),g*.6+rvN(P*20.)*.4);`,
  fGI:'float rvOpen=.8,rvHn=clamp(vW.y/34.,0.,1.);'});}

/* ── motifs sculptés (hauteur 0 = fond du creux, 1 = nu du mur), en mètres sur le plan de la façade ── */
const PAV_ARCS=[[-5.6,1.8,5],[-3.1,2.2,5],[0,3.0,7],[3.1,2.2,5],[5.6,1.8,5]];   // centre, ouverture, lobes
const PAV={YI:3.6,PHI:0.36,WF:16,HT:10.0,DW:0.72,DP:3.3};
function pavArc(c,w){const r=w/2/Math.cos(PAV.PHI);return {cx:c,cy:PAV.YI+r*Math.sin(PAV.PHI),r};}
const PAV_GLSL=`
uniform mat4 uRI;uniform mat3 uRR;uniform vec4 uArc[5];uniform vec3 uSunL;
varying vec3 vL;varying vec3 vLN;varying vec3 vEyeL;varying float vK;
float rvPomSh=1.;vec2 pvUV;float pvH,pvK,pvPx=.001;bool pvFr;
float pvh1(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
/* sebka : réseau de losanges aux côtés festonnés, fleurons au cœur des mailles */
float hSebka(vec2 p){vec2 q=p/vec2(.40,.54);float u=q.x+q.y,v=q.x-q.y;
  float du=abs(u-floor(u+.5)),dv=abs(v-floor(v+.5));float wu=.075+.045*abs(sin(v*9.4248)),wv=.075+.045*abs(sin(u*9.4248));
  float b=max(1.-smoothstep(wu*.5,wu,du),1.-smoothstep(wv*.5,wv,dv));b*=.75+.25*smoothstep(0.,wu*.5,wu*.5-min(du,dv)+wu*.25);
  vec2 c=vec2(fract(u)-.5,fract(v)-.5);float r=length(c),a=atan(c.y,c.x);
  float fl=1.-smoothstep(.12,.16,r*(1.+.42*cos(a*4.)));float bo=1.-smoothstep(.025,.045,r);
  return max(max(b,fl*.72),bo*.9);}
/* ataurique : rinceaux en spirale, palmes, tiges qui passent d'une cellule à l'autre */
float hAtau(vec2 p){vec2 q=p/.17;vec2 i=floor(q),f=fract(q)-.5;float s=mod(i.x+i.y,2.)<1.?1.:-1.;
  float r=length(f),a=atan(f.y,f.x)*s+pvh1(i)*6.28;float sp=sin(a+log(r+.03)*7.)*.5+.5;
  float st=smoothstep(.45,.8,sp)*(1.-smoothstep(.3,.47,r))*smoothstep(.02,.06,r);
  float lf=1.-smoothstep(.02,.055,abs(r-.4+.06*cos(a*3.+1.)));float bud=1.-smoothstep(.04,.07,length(f-vec2(.5*s,.5)*.0));
  return clamp(max(max(st*.85,lf*.7),bud*.5),0.,1.);}
/* écriture coufique ornementale : hampes, ligne de base, boucles nouées en tête, rinceau en fond */
float hKufic(vec2 p,float y0,float H){float yy=(p.y-y0)/H,cw=.07,id=floor(p.x/cw),fx=fract(p.x/cw),r=pvh1(vec2(id,3.1)),r2=pvh1(vec2(id,7.7));
  float top=r>.72?.84:r>.5?.6:.4;float stem=(1.-smoothstep(.16,.27,abs(fx-.5)))*step(.32,r)*(1.-smoothstep(top-.03,top,yy))*step(.12,yy);
  float base=1.-smoothstep(.035,.055,abs(yy-.19));float knot=(1.-smoothstep(.12,.2,abs(length(vec2((fx-.5)*cw*2.6,(yy-top)*H*1.8))-.034)/.03))*step(.72,r);
  float hook=(1.-smoothstep(.15,.25,abs(fx-.5-.25*sign(r2-.5))))*step(.86,r2)*(1.-smoothstep(.0,.06,abs(yy-.42)));
  float fr=max(1.-smoothstep(.04,.07,yy),smoothstep(.93,.96,yy));
  return clamp(max(max(max(stem,base),max(knot,hook)),fr),0.,1.);}
/* lacería (bois) : rubans entrecroisés à huit directions */
float hLac(vec2 p){vec2 q=p/.26;float d=1.;for(int k=0;k<4;k++){float an=float(k)*.7854;d=min(d,abs(fract(dot(q,vec2(cos(an),sin(an))))-.5));}return 1.-smoothstep(.07,.11,d);}
/* zellige : étoiles à huit branches, croix entre elles, joints creux ; id de la pièce pour sa couleur et son inclinaison */
float zelD(vec2 p,out vec2 ci,out float rid){vec2 q=p/.3;ci=floor(q+.5);vec2 f=q-ci;
  float ds=min(max(abs(f.x),abs(f.y)),(abs(f.x)+abs(f.y))*.7071);float r=.36;rid=ds<r*.42?0.:ds<r?1.:2.;
  vec2 f2=abs(fract(q)-.5);float g=min(abs(ds-r),abs(ds-r*.42));if(rid>1.5)g=min(g,min(abs(f2.x),abs(f2.y))*1.);return g;}
float hZel(vec2 p){vec2 ci;float rid;float g=zelD(p,ci,rid);return .25+.75*smoothstep(.012,.03,g);}
/* claveaux de l'archivolte : joints rayonnants, arête lobée en relief */
float hVous(vec2 p,out float par){par=0.;float best=9.,h=.5;for(int k=0;k<5;k++){vec4 A=uArc[k];vec2 d=p-A.xy;float rr=length(d)-A.z;if(rr<-.02||rr>.3||abs(rr)>best)continue;best=abs(rr);
    float a=atan(d.y,d.x);float n=A.w*3.;float s=fract(a/3.14159*n);par=mod(floor(a/3.14159*n),2.);
    h=.85-.6*(1.-smoothstep(.02,.06,min(s,1.-s)))-.35*(1.-smoothstep(.0,.03,abs(rr-.27)))+.1*smoothstep(.0,.08,rr);}return clamp(h,0.,1.);}
float pvZone(vec2 p,float k){
  if(k>-.5&&k<6.5)return k;
  float ax=abs(p.x);
  if(k>6.5){if(p.y<1.78)return 4.;if(p.y>1.86&&p.y<2.24)return 3.;                              // mur du fond du portique
    if(ax<1.5&&p.y<4.9)return 2.;if(ax>2.&&ax<5.6&&p.y>2.6&&p.y<5.7)return 1.;return 0.;}
  if(ax>6.5){if(p.y<1.95)return 4.;if(ax>6.74&&ax<7.76&&p.y>2.2&&p.y<9.5)return 1.;return 0.;} // tours d'angle
  for(int i=0;i<5;i++){vec4 A=uArc[i];float rr=length(p-A.xy)-A.z;if(rr>-.02&&rr<.3&&p.y>${PAV.YI.toFixed(2)}-.02)return 5.;
    float hw=A.z*${Math.cos(PAV.PHI).toFixed(4)}+.34,top=A.y+A.z+.28;if(abs(p.x-A.x)<hw&&p.y>${PAV.YI.toFixed(2)}&&p.y<top)return 2.;}  // écoinçons dans l'alfiz
  if(p.y>6.42&&p.y<6.98)return 3.;
  if(p.y>7.25&&p.y<9.7){if(ax<3.)return abs(abs(p.x)-2.15*step(1.,ax))<.76||ax<.76?2.:0.;if(ax>3.25&&ax<6.25)return 1.;}
  return 0.;}
float pavH0(vec2 p,float k){
  if(k<.5)return .55+.12*rvN(vec3(p*9.,2.))+.08*rvN(vec3(p*31.,5.))*(1.-smoothstep(.004,.012,pvPx));
  if(k<1.5)return .22+.78*max(hSebka(p),.3*hAtau(p*1.4)*(1.-smoothstep(.008,.025,pvPx)));
  if(k<2.5)return .2+.8*hAtau(p);
  if(k<3.5)return p.y<4.?.25+.75*max(hKufic(p,1.86,.38),.3*hAtau(p*1.8)):.25+.75*max(hKufic(p,6.42,.56),.3*hAtau(p*1.8));
  if(k<4.5)return hZel(p);
  if(k<5.5){float par;return hVous(p,par);}
  return .3+.7*hLac(p);}
/* plus petit que le pixel, le motif se fond dans sa valeur moyenne (pas de fourmillement quand on marche) */
float pavH(vec2 p,float k){float a=k<.5?0.:k<1.5?smoothstep(.02,.05,pvPx):k<2.5?smoothstep(.012,.04,pvPx):k<3.5?smoothstep(.018,.05,pvPx):k<4.5?smoothstep(.006,.02,pvPx):k<5.5?smoothstep(.02,.06,pvPx):smoothstep(.015,.045,pvPx);
  float m=k<1.5?.62:k<2.5?.55:k<3.5?.58:k<4.5?.9:k<5.5?.7:.6;return a>.999?m:mix(pavH0(p,k),m,a);}
vec2 pvPom(vec2 uv,vec3 v,float k,float dep){const int NS=PSTEPS;float ls=1./float(NS);vec2 dd=-v.xy/max(v.z,.3)*dep*ls;
  float cl=1.;vec2 p=uv;float h=pavH(p,k);
  for(int i=0;i<NS;i++){if(h>=cl)break;p+=dd;cl-=ls;h=pavH(p,k);}
  vec2 pp=p-dd;float hp=pavH(pp,k);float a=(h-cl)/max((h-cl)-(hp-cl-ls),1e-4);return mix(p,pp,clamp(a,0.,1.));}
float pvShadow(vec2 p,float h0,vec3 l,float k,float dep){if(l.z<=.02)return 0.;float s=0.;vec2 dd=l.xy/l.z*dep;
  for(int i=1;i<=5;i++){float t=float(i)/5.*(1.-h0);s=max(s,(pavH(p+dd*t,k)-h0-t)*7.);}return 1.-clamp(s,0.,1.);}
`;
/* matériau unique du pavillon : stuc, zelliges, archivoltes, bois sculpté, selon l'attribut aK (−1 : zones de la façade) */
function pavMat(){
  const uni={uRI:{value:new THREE.Matrix4()},uRR:{value:new THREE.Matrix3()},uArc:{value:PAV_ARCS.map(([c,w,n])=>{const A=pavArc(c,w);return new THREE.Vector4(A.cx,A.cy,A.r,n);})},uSunL:{value:V3()}};
  TB.uni=uni;
  const m=rvMat({color:0xffffff,roughness:.85,metalness:0,envMap:ENVTEX,envMapIntensity:.55},{key:'pavx',uniforms:uni,
    vHead:'attribute float aK;varying vec3 vL;varying vec3 vLN;varying vec3 vEyeL;varying float vK;uniform mat4 uRI;',
    vMain:'vK=aK;vL=(uRI*vec4(vW,1.)).xyz;vLN=mat3(uRI)*vWN;vEyeL=mat3(uRI)*(cameraPosition-vW);',
    fHead:PAV_GLSL.replace('PSTEPS',[6,10,14][TIER]),
    fColor:`
      vec3 Ln=normalize(cross(dFdx(vL),dFdy(vL)));pvFr=Ln.z>.86;vec2 uv=pvFr?vL.xy:abs(Ln.x)>.7?vec2(vL.z*sign(Ln.x),vL.y):vL.xz;
      pvPx=length(fwidth(vL.xy));pvK=pvZone(vL.xy,floor(vK+.5));if(!pvFr&&pvK>.5&&pvK!=4.)pvK=pvK>5.5?6.:0.;
      float dep=pvK>3.5&&pvK<4.5?.012:pvK>5.5?.03:.028;
      if(pvFr&&${TIER>0?'true':'false'})uv=pvPom(uv,normalize(vEyeL),pvK,dep);
      pvUV=uv;pvH=pavH(uv,pvK);
      if(pvFr)rvPomSh=pvShadow(uv,pvH,uSunL,pvK,dep);
      float N1=rvF(vW*.8),N2=rvN(vW*6.);
      vec3 ivory=vec3(.80,.69,.52)*(.9+.14*N1)*(.95+.08*N2);
      vec3 col=ivory;
      if(pvK<.5){col=ivory*(.93+.1*rvF(vW*.25+7.))*mix(1.,.82,smoothstep(.55,.85,rvF(vec3(vW.x*.7,vW.y*.12,vW.z*.7)+1.)));}
      else if(pvK<2.5){vec3 bg=pvK<1.5?vec3(.13,.21,.40):mix(vec3(.46,.16,.09),vec3(.13,.22,.42),smoothstep(.35,.65,rvF(vW*.35)));
        float worn=smoothstep(.25,.75,rvF(vW*1.3+2.));col=mix(mix(ivory*.86,bg,(pvK<1.5?.55:.3)*worn),ivory*1.04,smoothstep(.4,.7,pvH));}
      else if(pvK<3.5){col=mix(mix(vec3(.12,.2,.38),ivory*.75,.3),mix(ivory,vec3(.86,.66,.3),.35),smoothstep(.5,.8,pvH));}
      else if(pvK<4.5){vec2 ci;float rid;float g=zelD(uv,ci,rid);float id=pvh1(ci*1.7+rid*3.3);
        vec3 c=rid<.5?vec3(.86,.83,.74):rid<1.5?(mod(ci.x+ci.y,2.)<1.?vec3(.05,.15,.40):vec3(.05,.30,.20)):(id<.5?vec3(.04,.04,.045):vec3(.62,.40,.10));
        c*=.88+.2*pvh1(ci+rid);c=mix(c,vec3(.32,.32,.3),smoothstep(.006,.025,pvPx)*.35);col=mix(vec3(.42,.38,.32)*(.8+.3*N2),c,max(smoothstep(.012,.026,g),smoothstep(.006,.02,pvPx)));}
      else if(pvK<5.5){float par;float hv=hVous(uv,par);col=mix(par>.5?vec3(.56,.17,.09):ivory*1.05,ivory*.6,1.-smoothstep(.3,.6,hv));}
      else{float g=sin((vL.y*28.+rvF(vW*vec3(2.,.4,2.))*5.))*.5+.5;vec3 wd=mix(vec3(.17,.075,.03),vec3(.33,.16,.07),g*.5+N2*.4);
        col=mix(wd*.55,wd*1.15,smoothstep(.4,.8,pvH));col=mix(col,vec3(.38,.12,.06),.25*(1.-smoothstep(.3,.5,pvH))*step(5.5,pvK));}
      col*=mix(.68,1.,smoothstep(.0,.75,pvH));                                                      // creux plus sombres
      col*=1.-.25*smoothstep(.6,.9,rvN(vec3(vW.x*3.,vW.y*.15,vW.z*3.)+3.))*smoothstep(1.,6.,vW.y);    // coulures
      col=mix(col,vec3(.66,.47,.3),smoothstep(.75,.98,vWN.y)*.5);                                     // sable posé sur les saillies
      diffuseColor.rgb=col;`,
    fRough:'roughnessFactor=pvK>3.5&&pvK<4.5?mix(.55,.1,smoothstep(.4,.8,pvH)):pvK>5.5?.62:.86;',
    fNormal:`{if(pvFr){float e=.0035,dep=pvK>3.5&&pvK<4.5?.012:pvK>5.5?.03:.028;float hx=pavH(pvUV+vec2(e,0.),pvK),hy=pavH(pvUV+vec2(0.,e),pvK);
        vec3 nT=normalize(vec3(-(hx-pvH)/e*dep,-(hy-pvH)/e*dep,1.));
        if(pvK>3.5&&pvK<4.5){vec2 ci;float rid;zelD(pvUV,ci,rid);nT=normalize(nT+vec3(pvh1(ci+rid*7.)-.5,pvh1(ci*3.1+rid)-.5,0.)*.07);}
        normal=normalize((viewMatrix*vec4(uRR*nT,0.)).xyz);}
       else normal=rvBump(-vViewPosition,normal,.004*rvF(vW*3.)+.001*rvN(vW*40.),1.);}`,
    fGI:'float rvOpen=.8,rvHn=clamp(vW.y/34.,0.,1.);',giK:1.1,specK:'(pvK>3.5&&pvK<4.5?3.0:1.0)',pomSh:true});
  return m;}
/* arc polylobé outrepassé : points de l'intrados, de l'imposte gauche à l'imposte droite */
function lobedArc(c,w,n,steps){const A=pavArc(c,w),pts=[],a0=PI+PAV.PHI,a1=-PAV.PHI,L=Math.min(0.16,w*0.07);
  for(let i=0;i<=steps;i++){const t=i/steps,a=lerp(a0,a1,t),k=1-Math.abs(Math.sin(PI*n*t));const r=A.r-L*k*(t>0.02&&t<0.98?1:0);pts.push([A.cx+Math.cos(a)*r,A.cy+Math.sin(a)*r]);}return pts;}
/* une géométrie avec l'attribut de motif aK constant */
function kg(g,k){g=g.index?g.toNonIndexed():g;for(const n of Object.keys(g.attributes))if(n!=='position')g.deleteAttribute(n);g.setAttribute('aK',new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count).fill(k),1));return g;}
async function buildTempleB(){
  const pa=pathAt(S_PAV,{});const root=new THREE.Group();root.position.set(pa.x,0,pa.z);root.rotation.y=Math.atan2(-pa.tx,-pa.tz);scene.add(root);TB.root=root;
  root.updateMatrixWorld(true);
  const {YI,WF,HT,DW,DP}=PAV,Y0=0.45;
  const mPav=pavMat(),mMar=marbleMat(),mGold=goldMat(),mWood=woodMat();TB.mats={mFac:mPav,mMar,mGold,mWood};
  {const U2=TB.uni;U2.uRI.value.copy(root.matrixWorld).invert();U2.uRR.value.setFromMatrix4(root.matrixWorld);U2.uSunL.value.copy(SUN).applyMatrix3(new THREE.Matrix3().setFromMatrix4(U2.uRI.value)).normalize();}
  const G=[],GS=[];
  /* 1 · mur de façade : tours pleines, bandeau au-dessus des arcs, ouvertures polylobées jusqu'au sol du portique */
  {const sh=new THREE.Shape();sh.moveTo(-WF/2,0);sh.lineTo(-6.5,0);sh.lineTo(-6.5,YI);
    for(const [c,w,n] of PAV_ARCS){const P=lobedArc(c,w,n,n*14);for(const p of P.slice(1))sh.lineTo(p[0],p[1]);const nx=c+w/2+0.5;if(c<5)sh.lineTo(nx,YI);}
    sh.lineTo(6.5,0);sh.lineTo(WF/2,0);sh.lineTo(WF/2,HT);sh.lineTo(-WF/2,HT);sh.lineTo(-WF/2,0);
    /* trois ajimez à l'étage : arcs jumeaux (percés) */
    for(const cx of[-2.15,0,2.15]){const h=new THREE.Path();h.moveTo(cx-0.6,7.55);h.lineTo(cx+0.6,7.55);h.lineTo(cx+0.6,8.75);
      for(const c2 of[cx+0.3,cx-0.3])for(let i=1;i<=20;i++){const a=lerp(0,PI,i/20);h.lineTo(c2+Math.cos(a)*0.3,8.75+Math.sin(a)*0.34);}
      h.lineTo(cx-0.6,7.55);sh.holes.push(h);}
    const g=extr(sh,DW,1,0.012);g.translate(0,0,-DW);G.push(kg(g,-1));}
  /* 2 · reliefs construits : alfiz (cadres moulurés), cordons, impostes, appuis, cadres des ajimez */
  const mold=(w,h,d,x,y,z,k)=>G.push(kg(sbox(w,h,d,x,y,z,0,9),k===undefined?0:k));
  for(const [c,w] of PAV_ARCS){const A=pavArc(c,w),top=A.cy+A.r+0.3,hw=w/2+0.36;
    mold(2*hw+0.14,0.11,0.07,c,top,0.035);mold(0.11,top-YI+0.05,0.07,c-hw-0.015,(top+YI)/2,0.035);mold(0.11,top-YI+0.05,0.07,c+hw+0.015,(top+YI)/2,0.035);}
  mold(13.0,0.1,0.12,0,6.36,0.06);mold(13.0,0.1,0.12,0,7.03,0.06);mold(13.2,0.16,0.2,0,9.92,0.1);
  for(const sx of[-1,1]){mold(1.32,0.12,0.12,sx*7.25,2.08,0.06);mold(1.32,0.12,0.12,sx*7.25,9.56,0.06);mold(0.1,7.5,0.1,sx*6.69,5.8,0.05);mold(0.1,7.5,0.1,sx*7.81,5.8,0.05);}
  for(const cx of[-2.15,0,2.15]){mold(1.5,0.12,0.26,cx,7.47,0.13);mold(1.62,0.1,0.08,cx,9.27,0.04);mold(0.09,1.72,0.08,cx-0.78,8.37,0.04);mold(0.09,1.72,0.08,cx+0.78,8.37,0.04);}
  /* 3 · sous les arcs : intrados (épaisseur du mur) et sol du portique */
  /* 4 · tours d'angle : prolongées au-dessus de l'auvent, merlons à gradins */
  for(const sx of[-1,1]){G.push(kg(sbox(1.5,2.9,DW+0.3,sx*7.25,HT+1.45,-DW/2+0.05,0,9),0));
    for(let k=0;k<3;k++){const x=sx*(6.75+k*0.5);G.push(kg(sbox(0.38,0.36,0.5,x,HT+2.9+0.18,-0.2,0,9),0),kg(sbox(0.24,0.22,0.42,x,HT+2.9+0.47,-0.2,0,9),0),kg(place(clean(new THREE.ConeGeometry(0.13,0.2,4)),x,HT+2.9+0.68,-0.2,0,PI/4,0),0));}
    const win=new THREE.Shape();win.moveTo(-0.16,0);win.lineTo(0.16,0);win.lineTo(0.16,0.5);win.absarc(0,0.5,0.16,0,PI,false);win.lineTo(-0.16,0);
    const wg=extr(win,0.06);wg.translate(sx*7.25,HT+0.9,0.07);G.push(kg(wg,0));}
  /* 5 · marches de marbre et sol du portique */
  const mar=[];for(let i=0;i<3;i++){const w=13.0-i*0.5,d=1.65-i*0.55;mar.push(sbox(w,0.15,d,0,0.075+i*0.15,d/2,0,9));}
  mar.push(sbox(13,0.45,DP,0,0.225,-DP/2,0,9));
  const marM=new THREE.Mesh(nrm(mergeGeometries(mar.map(clean))),mMar);marM.receiveShadow=marM.castShadow=true;root.add(marM);
  /* 6 · colonnes jumelées : base, fût mince, astragale, chapiteau nasride (tambour + cube), tailloir */
  {const cols=[],caps=[];const supX=[-4.45,-1.75,1.75,4.45];
    for(const x of supX)for(const z of[-0.18,-0.54]){
      cols.push(place(lathe([[0,0],[0.17,0],[0.17,0.06],[0.13,0.1],[0.15,0.14],[0.115,0.2],[0.105,0.4],[0.1,2.3],[0.12,2.33],[0.12,2.38],[0.1,2.4],[0,2.4]],18,0.12),x,Y0,z));
      GS.push(kg(place(lathe([[0,0],[0.115,0],[0.125,0.05],[0.115,0.09],[0.13,0.14],[0.13,0.2],[0,0.2]],18,0.05),x,Y0+2.4,z),0));
      caps.push(kg(sbox(0.34,0.32,0.34,x,Y0+2.6+0.16,z,0,9),2));}
    for(const x of supX)caps.push(kg(sbox(0.62,0.18,0.86,x,YI-0.09,-0.36,0,9),0));
    const cm=new THREE.Mesh(nrm(mergeGeometries(cols.map(clean))),mMar);cm.castShadow=cm.receiveShadow=true;root.add(cm);
    for(const g of caps)G.push(g.attributes.aK?g:kg(g,0));}
  /* 7 · intérieur du portique : murs latéraux et mur du fond (zelliges, coufique, ataurique), grande porte */
  {const back=new THREE.Shape();back.moveTo(-6.5,0);back.lineTo(6.5,0);back.lineTo(6.5,6.4);back.lineTo(-6.5,6.4);back.lineTo(-6.5,0);
    const dr=new THREE.Path();const dw=1.05,dc=Y0+2.75;dr.moveTo(-dw,Y0);dr.lineTo(dw,Y0);dr.lineTo(dw,dc);for(let i=0;i<=40;i++){const a=lerp(-0.3,PI+0.3,i/40);dr.lineTo(Math.cos(a)*dw*1.08,dc+0.3+Math.sin(a)*dw*1.08);}dr.lineTo(-dw,dc);dr.lineTo(-dw,Y0);back.holes.push(dr);
    const bg=extr(back,0.3);bg.translate(0,0,-DP-0.3);G.push(kg(bg,7));
    for(const sx of[-1,1]){G.push(kg(place(clean(new THREE.PlaneGeometry(DP,6.4)),sx*6.5,3.2,-DP/2,0,-sx*PI/2,0),7));}
    /* encadrement de la porte : alfiz, archivolte saillante */
    mold(3.2,0.12,0.1,0,dc+1.85,-DP+0.05,0);mold(0.12,dc+1.85-Y0,0.1,-1.55,(dc+1.85+Y0)/2,-DP+0.05,0);mold(0.12,dc+1.85-Y0,0.1,1.55,(dc+1.85+Y0)/2,-DP+0.05,0);
    /* vantaux de cèdre clouté, entrouverts ; derrière, une salle sombre où brille une lanterne */
    const leaf=sbox(1.04,dc+0.1-Y0,0.1,0,0,0,0,9);
    for(const s of[-1,1]){const g=kg(leaf.clone(),6);g.translate(-s*0.52,(dc+0.1+Y0)/2,0);g.rotateY(-s*0.32);g.translate(s*1.0,0,-DP-0.15);
      const lm=new THREE.Mesh(nrm(g),mPav);lm.castShadow=true;lm.receiveShadow=true;root.add(lm);}
    /* la salle derrière la porte (on la traverse en plongeant vers le donjon) : zelliges, stuc ciselé, plafond de cèdre, damier de marbre */
    {const RZ=-DP-0.3,RD=5.2,RW=4.4,RH=5.6;
      G.push(kg(place(clean(new THREE.PlaneGeometry(2*RW,RH)),0,RH/2,RZ-RD),7));
      for(const sx of[-1,1])G.push(kg(place(clean(new THREE.PlaneGeometry(RD,RH)),sx*RW,RH/2,RZ-RD/2,0,-sx*PI/2,0),7));
      G.push(kg(place(clean(new THREE.PlaneGeometry(2*RW,RD)),0,RH,RZ-RD/2,PI/2,0,0),8));
      for(let i=1;i<9;i++)G.push(kg(sbox(0.1,0.18,RD,-RW+i*(2*RW/9),RH-0.09,RZ-RD/2,0,9),8));
      const fl=new THREE.Mesh(new THREE.PlaneGeometry(2*RW,RD),rvMat({color:0xffffff,roughness:.18,metalness:0,envMap:ENVTEX,envMapIntensity:.5},{key:'pavfloor2',
        fColor:'vec2 q=floor(vW.xz/.55);float c=mod(q.x+q.y,2.);diffuseColor.rgb=mix(vec3(.74,.70,.62),vec3(.10,.09,.08),c)*(.9+.12*rvF(vW*3.));',fGI:'float rvOpen=.1,rvHn=.1;',giB:.35,specK:'2.5'}));
      fl.rotation.x=-PI/2;fl.position.set(0,Y0,RZ-RD/2);fl.receiveShadow=true;root.add(fl);}}
  /* 8 · plafond du portique : poutres et caissons (bois), sous-face de l'auvent */
  {const W=[];W.push(kg(sbox(13,0.14,DP+DW-0.1,0,6.33,-(DP+DW)/2-0.05,0,9),6));
    for(let i=0;i<=26;i++)W.push(kg(sbox(0.09,0.16,DP,-6.5+i*0.5,6.18,-DW-DP/2+0.36,0,9),8));
    for(let j=0;j<=6;j++)W.push(kg(sbox(13,0.13,0.08,0,6.19,-DW-j*(DP-0.1)/6,0,9),8));
    /* l'auvent : sous-face, bordure sculptée, corbeaux à volutes */
    const EZ=1.55,EY=HT+0.08;W.push(kg(sbox(13.0,0.12,EZ+0.3,0,EY+0.3,EZ/2-0.15,0,9),6));
    W.push(kg(sbox(13.2,0.42,0.12,0,EY+0.25,EZ,0,9),6));
    for(let i=0;i<=24;i++)W.push(kg(sbox(0.06,0.06,EZ,-6.4+i*(12.8/24),EY+0.21,EZ/2,0,9),8));
    const cs=new THREE.Shape();cs.moveTo(0,0);cs.lineTo(0,0.42);cs.lineTo(1.05,0.42);
    const nose=(cx,cy,r)=>{for(let k=1;k<=10;k++){const a=PI/2-k/10*PI;cs.lineTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r);}};
    nose(1.05,0.36,0.06);cs.lineTo(0.8,0.30);nose(0.8,0.24,0.06);cs.lineTo(0.52,0.18);nose(0.52,0.12,0.06);cs.lineTo(0.25,0.06);cs.quadraticCurveTo(0.1,0.0,0,0);
    const cg=extr(cs,0.2);cg.translate(0,0,-0.1);cg.rotateY(-PI/2);
    for(let i=0;i<16;i++){const x=-6.1+i*(12.2/15),g=cg.clone();g.translate(x,HT+0.26-0.42,0.02);W.push(kg(g,8));}
    for(const g of W)G.push(g);}
  /* 9 · tout le décor de stuc / zellige / bois en un seul maillage */
  {const fg=mergeGeometries(G);fg.computeVertexNormals();
    const fac=new THREE.Mesh(fg,mPav);fac.castShadow=fac.receiveShadow=true;root.add(fac);TB.fac=fac;
    const sm=new THREE.Mesh(nrm(mergeGeometries(GS)),mPav);sm.castShadow=sm.receiveShadow=true;root.add(sm);}
  /* 10 · toit de tuiles vernissées (canal), légèrement irrégulières */
  {const T=[],r=mulberry(41),tg=new THREE.CylinderGeometry(0.1,0.085,0.48,7,1,true,0,PI);tg.rotateX(PI/2);tg.rotateZ(PI/2);
    const ang=0.62,L=5.6,E0=[0,HT+0.62,1.7];
    for(let i=0;i<58;i++)for(let j=0;j<11;j++){const x=-6.3+i*0.222,t=j*0.42;const g=clean(tg.clone());
      if(i%2)g.rotateZ(PI);g.translate(0,i%2?0.0:0.075,0);g.rotateX(-ang);g.translate(x+(r()-.5)*0.012,E0[1]+Math.sin(ang)*t+(r()-.5)*0.01,E0[2]-Math.cos(ang)*t);
      const c=r();g.setAttribute('aT',new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count).fill(c),1));T.push(g);}
    const tm=rvMat({color:0xffffff,roughness:.22,metalness:0,envMap:ENVTEX,envMapIntensity:1.0},{key:'tiles',vHead:'attribute float aT;varying float vT;',vMain:'vT=aT;',fHead:'varying float vT;',
      fColor:'diffuseColor.rgb=mix(vec3(.05,.24,.12),vec3(.12,.36,.16),vT)*(.85+.25*rvN(vW*9.))*mix(1.,.7,smoothstep(.6,.9,rvN(vW*1.3)));',fRough:'roughnessFactor=mix(.15,.45,rvN(vW*4.));',
      fGI:'float rvOpen=.9,rvHn=clamp(vW.y/34.,0.,1.);',specK:'2.5'});
    const tmesh=new THREE.Mesh(nrm(mergeGeometries(T)),tm);tmesh.castShadow=tmesh.receiveShadow=true;root.add(tmesh);}
  /* 11 · moucharabiehs des ajimez : treillis de baguettes tournées (vraies baguettes, pas une image) */
  {const L=[];for(const cx of[-2.15,0,2.15])for(const s of[-1,1]){const x0=cx+s*0.3;
      for(let i=-4;i<=4;i++){L.push(sbox(0.02,1.45,0.02,x0+i*0.06,8.3,-0.5,0,9));}
      for(let j=0;j<24;j++){L.push(sbox(0.54,0.02,0.02,x0,7.58+j*0.06,-0.5,0,9));}
      for(let i=-4;i<=4;i++)for(let j=0;j<24;j+=2)L.push(place(clean(new THREE.SphereGeometry(0.016,5,4)),x0+i*0.06+0.03,7.61+j*0.06,-0.5));}
    const lm=rvMat({color:0xffffff,roughness:.7,metalness:0},{key:'lattice2',fColor:'diffuseColor.rgb=vec3(.20,.09,.035)*(.8+.4*rvN(vW*30.));',fGI:'float rvOpen=.4,rvHn=.3;'});
    const lmesh=new THREE.Mesh(nrm(mergeGeometries(L.map(clean))),lm);lmesh.castShadow=true;root.add(lmesh);
    const bk=new THREE.Mesh(new THREE.PlaneGeometry(4.8,1.6),new THREE.MeshBasicMaterial({color:0x140703}));bk.position.set(0,8.35,-DW+0.05);root.add(bk);}
  /* 12 · colonnettes de marbre des ajimez */
  {const C=[];for(const cx of[-2.15,0,2.15])C.push(place(lathe([[0,0],[0.07,0],[0.05,0.06],[0.045,1.0],[0.07,1.08],[0.07,1.2],[0,1.2]],12,0.1),cx,7.55,-0.3));
    const m=new THREE.Mesh(nrm(mergeGeometries(C.map(clean))),mMar);m.castShadow=true;root.add(m);}
  root.updateMatrixWorld(true);
  const W=v=>v.clone().applyMatrix4(root.matrixWorld);
  TB.door=W(V3(0,1.9,1.2));TB.inside=W(V3(0,1.9,-DP-2.2));TB.center=W(V3(0,5.4,0));
  FLAT.push({x:W(V3(0,0,3)).x,z:W(V3(0,0,3)).z,r:6.5,h:0.03});
  const hit=new THREE.Mesh(new THREE.BoxGeometry(13.5,11,3.4),new THREE.MeshBasicMaterial({colorWrite:false,depthWrite:false}));hit.position.set(0,5.5,-0.4);root.add(hit);HITS[1]=hit;
  const sSt=S_PAV-14.6;STA[1]={s:sSt,pos:eyeAt(sSt,-0.25,V3()),tgt:W(V3(0,4.45,0)),door:TB.door,inside:TB.inside};
  /* lanternes : une sous chaque arc, deux sur les marches, une derrière la porte */
  LAN_T=1;
  PAV_ARCS.forEach(([c,w],i)=>{const A=pavArc(c,w);addLantern({at:W(V3(c,A.cy+A.r-0.25,-0.36)),hang:i===2?1.1:0.8,scale:i===2?1.35:1.1,I:i===2?7:5,glass:i%3,amp:0.05,colored:0.7});});
  for(const sx of[-1,1])addLantern({at:W(V3(sx*5.9,0.45,1.0)),scale:1.05,I:4.5,glass:2,colored:0.5});
  addLantern({at:W(V3(0,4.6,-DP-2.6)),hang:1.4,scale:1.0,I:4,glass:1,amp:0.03,colored:0.8,R:6});
}
/* ═══════════════════════════════════════════════════════════════════════════════
   11 · les stèles des statistiques : trois dalles de grès taillées, sommet en arc, cadre mouluré, panneau de
   basalte poli où la L2 projette ses écrans (vue d'ensemble, activité, analyse) ; une lanterne au pied de chacune
   ═══════════════════════════════════════════════════════════════════════════════ */
async function buildSteles(){
  const por=innerWidth/innerHeight<.9,PW=por?1.85:3.3,PH=por?PW*7.1/4.8:PW*4.8/10.16,SW=PW+0.75,SH=PH+0.95,PY=0.72;
  const basalt=rvLit(new THREE.MeshStandardMaterial({color:0x0d0b0a,roughness:.32,metalness:0,envMap:ENVTEX,envMapIntensity:.35}),'basalt');
  const smat=sandstoneMat('stele','vec3(1.0,.92,.88)',{noAtlas:true,lines:0.2,giK:1.2});
  /* alignées contre la paroi gauche de la salle creusée entre les deux temples, tournées vers le chemin */
  const pa={};
  for(let i=0;i<3;i++){const s0=S_ST[i];pathAt(s0,pa);const off=wallOff(s0,0.6,1)-1.05,x=pa.x+pa.nx*off,z=pa.z+pa.nz*off,gy=groundAt(x,z);const g=new THREE.Group();g.position.set(x,gy-0.08,z);
    const nx=-pa.nx+pa.tx*(i-1)*-0.18,nz=-pa.nz+pa.tz*(i-1)*-0.18;const nl=Math.hypot(nx,nz);g.rotation.y=Math.atan2(nx/nl,nz/nl);scene.add(g);STA[2+i]={s:s0,pos:V3(),tgt:V3()};
    /* dalle : contour à sommet en arc brisé, cadre en creux autour du panneau */
    const sh=new THREE.Shape();const ar=SW/2;sh.moveTo(-SW/2,0);sh.lineTo(SW/2,0);sh.lineTo(SW/2,SH);sh.quadraticCurveTo(SW/2,SH+ar*0.42,0,SH+ar*0.62);sh.quadraticCurveTo(-SW/2,SH+ar*0.42,-SW/2,SH);sh.lineTo(-SW/2,0);
    const hole=new THREE.Path();const x0=-PW/2-0.08,x1=PW/2+0.08,y0=PY-0.08,y1=PY+PH+0.08;hole.moveTo(x0,y0);hole.lineTo(x1,y0);hole.lineTo(x1,y1);hole.lineTo(x0,y1);hole.lineTo(x0,y0);sh.holes.push(hole);
    const front=extr(sh,0.16);front.translate(0,0,0.14);
    const back=extr((()=>{const b=new THREE.Shape();b.moveTo(-SW/2,0);b.lineTo(SW/2,0);b.lineTo(SW/2,SH);b.quadraticCurveTo(SW/2,SH+ar*0.42,0,SH+ar*0.62);b.quadraticCurveTo(-SW/2,SH+ar*0.42,-SW/2,SH);b.lineTo(-SW/2,0);return b;})(),0.32);back.translate(0,0,-0.18);
    const plinth=sbox(SW+0.6,0.42,1.1,0,0.21,0);const step=sbox(SW+1.1,0.18,1.6,0,0.09,0.1);
    const orn=[];for(let k=0;k<9;k++){const a=(k/8-0.5)*1.9;orn.push(place(clean(new THREE.SphereGeometry(0.07,8,6)),Math.sin(a)*ar*0.78,SH+Math.cos(a)*ar*0.36-0.05,0.3,0,0,0,1,1,0.5));}
    const geo=erode([front,back,plinth,step,...orn],0.012,{freq:3,base:0.4});
    const m=new THREE.Mesh(geo,smat);m.castShadow=m.receiveShadow=true;g.add(m);g.updateMatrixWorld(true);giAttr(geo,m,0.6,30);
    const pn=new THREE.Mesh(new THREE.PlaneGeometry(PW+0.12,PH+0.12),basalt);pn.position.set(0,PY+PH/2,0.15);g.add(pn);
    const y0p=PY,y1p=PY+PH;STELE.push({g,c:[V3(-PW/2,y1p,0.16),V3(PW/2,y1p,0.16),V3(PW/2,y0p,0.16),V3(-PW/2,y0p,0.16)],x,z,n:{x:nx/nl,z:nz/nl},cy:gy-0.08+PY+PH/2,pw:PW,ph:PH});
    g.updateMatrixWorld(true);const lp=V3(SW/2+0.55,0.0,0.45).applyMatrix4(g.matrixWorld);addLantern({t:-1,at:V3(lp.x,groundAt(lp.x,lp.z),lp.z),scale:0.9,I:4.2,glass:i,R:6,colored:0.5});
    FLAT.push({x,z,r:3.2,h:gy});}
}
/* ═══════════════════════════════════════════════════════════════════════════════
   12 · les lézards : agames du Levant (hardoun) collés aux parois. Corps et queue en tube déformé à chaque image
   (ondulation latérale qui court de la tête à la queue), pattes à cinématique inverse (coudes écartés, doigts
   étalés, le long 4e orteil des pattes arrière), yeux brillants ; ils filent par à-coups, s'arrêtent net, font
   des « pompes », tournent la tête, et fuient quand on approche
   ═══════════════════════════════════════════════════════════════════════════════ */
const LIZ=[];let LIZMAT=null,LIZMAT2=null;
const LZ={NB:30,M:10,LR:6,LM:6,TR:3,TM:4};
function lizMat(){if(LIZMAT)return LIZMAT;
  LIZMAT=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.62,metalness:0,envMap:ENVTEX,envMapIntensity:.25});
  const old=rvLit(LIZMAT,'lizard').onBeforeCompile;
  LIZMAT.onBeforeCompile=sh=>{old(sh);sh.uniforms.uSkin={value:0};
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute vec3 aL;varying vec3 vL;').replace('#include <begin_vertex>','#include <begin_vertex>\nvL=aL;');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vL;uniform float uSkin;float rvSc=0.;')
      .replace('#include <map_fragment>',`#include <map_fragment>
        {float u=vL.x,v=vL.y,part=vL.z;                                     // u le long du corps, v autour (0,5 = dos), part : 0 corps, 1 pattes, 2 yeux
         vec3 c=uSkin>.5?vec3(.13,.24,.48):vec3(.45,.36,.25);
         float dors=smoothstep(.22,.5,v)*smoothstep(.78,.5,v);
         vec2 sp=vec2(u*38.,v*8.)+vec2(sin(v*9.)*.4,0.);vec2 id=floor(sp),f=fract(sp)-.5;float h=rvH(id);
         float spot=smoothstep(.32,.18,length(f+vec2(h-.5,rvH(id+3.)-.5)*.4))*step(.45,h)*dors*step(u,.5);
         c=mix(c,uSkin>.5?vec3(.32,.55,.85):vec3(.86,.74,.4),spot*.85);
         float band=smoothstep(.42,.5,abs(fract(u*15.)-.5)*2.)*step(.44,u);c=mix(c,uSkin>.5?vec3(.08,.12,.22):vec3(.22,.17,.12),band*.75);
         c=mix(c,vec3(.62,.55,.42),(1.-dors)*smoothstep(.85,.6,abs(v-.5)*2.)*.0+smoothstep(.2,.0,abs(v-.0))*.5+smoothstep(.8,1.,v)*.5);
         c=mix(c,uSkin>.5?vec3(.2,.42,.85):vec3(.6,.5,.26),smoothstep(.13,.06,u)*.6*dors);              // tête
         if(part>.5&&part<1.5)c=(uSkin>.5?vec3(.12,.18,.32):vec3(.4,.33,.24))*(.85+.3*rvH(floor(vec2(u*30.,v*6.))));
         if(part>1.5)c=vec3(.015,.012,.01);
         vec2 sc=vec2(u*420.,v*60.);vec2 g=fract(sc+vec2(0.,floor(sc.x)*.5))-.5;float fw=fwidth(sc.x)+fwidth(sc.y);rvSc=mix(1.-dot(g,g)*2.4,.6,smoothstep(.3,1.,fw));
         c*=.85+.3*rvH(floor(vec2(u*90.,v*14.)))*smoothstep(1.2,.2,fw*.2);diffuseColor.rgb=c*(.94+.06*rvSc);}`)
      .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nif(vL.z>1.5)roughnessFactor=.08;')
      .replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\nif(vL.z<1.5)normal=rvBump(-vViewPosition,normal,rvSc*.00035,1.);');};
  LIZMAT.customProgramCacheKey=()=>'rvl_lizard2';
  LIZMAT2=LIZMAT.clone();LIZMAT2.onBeforeCompile=sh=>{LIZMAT.onBeforeCompile(sh);sh.uniforms.uSkin.value=1;};LIZMAT2.customProgramCacheKey=()=>'rvl_lizard3';
  return LIZMAT;}
/* topologie fixe : corps (anneaux), 4 pattes, 20 doigts, 2 yeux ; positions recalculées à chaque image */
function lizGeo(){const rings=[];const add=(n,m,part)=>{rings.push({n,m,part,off:0});};
  add(LZ.NB,LZ.M,0);for(let k=0;k<4;k++)add(LZ.LR,LZ.LM,1);for(let k=0;k<20;k++)add(LZ.TR,LZ.TM,1);for(let k=0;k<2;k++)add(5,8,2);
  let nv=0,ni=0;for(const r of rings){r.off=nv;nv+=r.n*(r.m+1)+2;ni+=(r.n-1)*r.m*6+r.m*6;}
  const pos=new Float32Array(nv*3),nor=new Float32Array(nv*3),aL=new Float32Array(nv*3),idx=new Uint32Array(ni);let q=0;
  for(const r of rings){const W=r.m+1;for(let i=0;i<r.n-1;i++)for(let j=0;j<r.m;j++){const a=r.off+i*W+j,b=a+W;idx[q++]=a;idx[q++]=b;idx[q++]=a+1;idx[q++]=a+1;idx[q++]=b;idx[q++]=b+1;}
    const c0=r.off+r.n*W,c1=c0+1;for(let j=0;j<r.m;j++){idx[q++]=c0;idx[q++]=r.off+j+1;idx[q++]=r.off+j;idx[q++]=c1;idx[q++]=r.off+(r.n-1)*W+j;idx[q++]=r.off+(r.n-1)*W+j+1;}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('normal',new THREE.BufferAttribute(nor,3));g.setAttribute('aL',new THREE.BufferAttribute(aL,3));g.setIndex(new THREE.BufferAttribute(idx,1));
  g.boundingSphere=new THREE.Sphere(V3(),0.5);return {g,rings,pos,nor,aL};}
/* écrit un tube le long d'une polyligne (points, rayons latéraux / verticaux), anneaux dans le plan normal */
const _t=V3(),_n1=V3(),_n2=V3(),_up=V3(0,1,0),_tmp=V3();
function writeTube(G,ring,P,RW,RH,uA,uB,part,lift){const W=ring.m+1;const {pos,nor,aL}=G;
  for(let i=0;i<ring.n;i++){const a=P[Math.max(0,i-1)],b=P[Math.min(ring.n-1,i+1)];_t.subVectors(b,a).normalize();
    _n1.copy(lift||_up).addScaledVector(_t,-_t.dot(lift||_up));if(_n1.lengthSq()<1e-8)_n1.set(0,0,1);_n1.normalize();_n2.crossVectors(_t,_n1).normalize();
    for(let j=0;j<=ring.m;j++){const th=j/ring.m*TAU,cs=Math.cos(th),sn=Math.sin(th);const k=(ring.off+i*W+j)*3;
      const ox=_n2.x*cs*RW[i]+_n1.x*sn*RH[i],oy=_n2.y*cs*RW[i]+_n1.y*sn*RH[i],oz=_n2.z*cs*RW[i]+_n1.z*sn*RH[i];
      pos[k]=P[i].x+ox;pos[k+1]=P[i].y+oy;pos[k+2]=P[i].z+oz;
      const nx=_n2.x*cs*RH[i]+_n1.x*sn*RW[i],ny=_n2.y*cs*RH[i]+_n1.y*sn*RW[i],nz=_n2.z*cs*RH[i]+_n1.z*sn*RW[i],nl=Math.hypot(nx,ny,nz)||1;
      nor[k]=nx/nl;nor[k+1]=ny/nl;nor[k+2]=nz/nl;aL[k]=lerp(uA,uB,i/(ring.n-1));aL[k+1]=((j/ring.m)+0.25)%1;aL[k+2]=part;}}
  const c0=(ring.off+ring.n*W)*3,c1=c0+3;const A=P[0],B=P[ring.n-1];
  pos[c0]=A.x;pos[c0+1]=A.y;pos[c0+2]=A.z;pos[c1]=B.x;pos[c1+1]=B.y;pos[c1+2]=B.z;
  _t.subVectors(P[1],P[0]).normalize();nor[c0]=-_t.x;nor[c0+1]=-_t.y;nor[c0+2]=-_t.z;_t.subVectors(P[ring.n-1],P[ring.n-2]).normalize();nor[c1]=_t.x;nor[c1+1]=_t.y;nor[c1+2]=_t.z;
  aL[c0]=uA;aL[c0+1]=0.5;aL[c0+2]=part;aL[c1]=uB;aL[c1+1]=0.5;aL[c1+2]=part;}
const PV=n=>Array.from({length:n},()=>V3());
/* gabarit (mètres) : museau en x>0, dos en y>0, flanc gauche en z>0 */
const LZB=(()=>{const n=LZ.NB,xs=[],rw=[],rh=[];for(let i=0;i<n;i++){const t=i/(n-1);const x=t<0.3?lerp(0.135,0.07,t/0.3):t<0.55?lerp(0.07,-0.005,(t-0.3)/0.25):lerp(-0.005,-0.2,Math.pow((t-0.55)/0.45,0.85));xs.push(x);
    let w;if(x>0.118)w=lerp(0.0035,0.0105,(0.135-x)/0.017);else if(x>0.096)w=lerp(0.0105,0.0158,(0.118-x)/0.022);else if(x>0.08)w=lerp(0.0158,0.0118,(0.096-x)/0.016);else if(x>0.065)w=lerp(0.0118,0.0145,(0.08-x)/0.015);
    else if(x>0.03)w=lerp(0.0145,0.0195,(0.065-x)/0.035);else if(x>0.002)w=lerp(0.0195,0.0148,(0.03-x)/0.028);else w=0.0125*Math.pow(Math.max(0,(x+0.2)/0.2),1.15)+0.0009;
    rw.push(w);rh.push(w*(x>0.08?0.6:x>-0.005?0.58:0.85));}
  return {xs,rw,rh};})();
const LEGS=[{x:0.066,z:1,L1:0.024,L2:0.021,fx:0.08,fz:0.034,toes:[0.006,0.009,0.011,0.012,0.008]},{x:0.066,z:-1,L1:0.024,L2:0.021,fx:0.08,fz:0.034,toes:[0.006,0.009,0.011,0.012,0.008]},
  {x:0.004,z:1,L1:0.031,L2:0.028,fx:-0.02,fz:0.041,toes:[0.007,0.011,0.014,0.02,0.01]},{x:0.004,z:-1,L1:0.031,L2:0.028,fx:-0.02,fz:0.041,toes:[0.007,0.011,0.014,0.02,0.01]}];
const _H=V3(),_F=V3(),_K=V3(),_D=V3(),_B=V3();
function lizardPose(L,t){const G=L.G,n=LZ.NB,sp=L.spd,gp=L.gait;const P=L.P,RW=L.RW,RH=L.RH;
  const amp=Math.min(1,sp/0.5),still=1-amp;
  for(let i=0;i<n;i++){const x=LZB.xs[i];const tail=smooth(0.0,-0.2,x),body=smooth(0.09,0.0,x);
    const wave=(0.0025*body+0.012*(body)*(1-tail)+0.026*tail)*amp*Math.sin(TAU*(x/0.2)*1.0-gp*TAU);
    const rest=0.03*tail*tail*Math.sin(L.curl)+0.006*tail*Math.sin(t*0.9+L.ph)*still;
    const headTurn=x>0.07?L.look*(x-0.07)*1.4:0;
    P[i].set(x,LZB.rh[i]*0.92+0.0015+L.push*smooth(-0.02,0.08,x)*0.012+(x>0.085?L.bob*0.004:0),wave+rest+headTurn);RW[i]=LZB.rw[i];RH[i]=LZB.rh[i]*(1+0.04*Math.sin(t*2.4+L.ph)*body);}
  writeTube(G,G.rings[0],P,RW,RH,0,1,0);
  /* pattes : diagonales opposées en phase ; appui puis retour levé */
  for(let k=0;k<4;k++){const lg=LEGS[k],sz=lg.z;const sideIdx=lg.x>0.03?7:16;
    _H.set(lg.x,P[sideIdx].y*0.85,P[sideIdx].z+sz*RW[sideIdx]*0.8);
    const ph=(gp+((k===0||k===3)?0:0.5))%1,stance=ph<0.6,u=stance?ph/0.6:(ph-0.6)/0.4;
    const st=0.024*amp,dx=stance?lerp(st,-st,u):lerp(-st,st,u),lift=stance?0:Math.sin(u*PI)*0.012*amp;
    _F.set(lg.fx+dx+(still>0.5?0.003*Math.sin(L.ph+k):0),0.002+lift+L.push*0.0,sz*lg.fz+P[sideIdx].z*0.6);
    _D.subVectors(_F,_H);const d=Math.min(_D.length(),lg.L1+lg.L2-1e-4);_D.normalize();
    const a=(lg.L1*lg.L1-lg.L2*lg.L2+d*d)/(2*d),h=Math.sqrt(Math.max(0,lg.L1*lg.L1-a*a));
    _B.set(0,0.7,sz*1).addScaledVector(_D,-_D.dot(_tmp.set(0,0.7,sz))).normalize();
    _K.copy(_H).addScaledVector(_D,a).addScaledVector(_B,h);_F.copy(_H).addScaledVector(_D,d);
    const LP=L.LP[k];for(let i=0;i<LZ.LR;i++){const tt=i/(LZ.LR-1);if(tt<0.5)LP[i].lerpVectors(_H,_K,tt*2);else LP[i].lerpVectors(_K,_F,(tt-0.5)*2);}
    const lr=lg.x>0.03?[0.0052,0.0046,0.004,0.0036,0.0031,0.0026]:[0.0066,0.0058,0.005,0.0042,0.0034,0.0027];
    writeTube(G,G.rings[1+k],LP,lr,lr,0.9,0.96,1);
    /* doigts étalés depuis le pied, couchés sur la paroi */
    const base=Math.atan2(sz*0.4,lg.x>0.03?1:-0.6);
    for(let f=0;f<5;f++){const ang=base+sz*(-1.1+f*0.5),len=lg.toes[f];const TP=L.TP[k*5+f];
      for(let i=0;i<LZ.TR;i++){const tt=i/(LZ.TR-1);TP[i].set(_F.x+Math.cos(ang)*len*tt,Math.max(0.0012,_F.y*(1-tt))+0.0008,_F.z+Math.sin(ang)*len*tt*sz*sz);}
      writeTube(G,G.rings[5+k*5+f],TP,[0.0013,0.001,0.0005],[0.0011,0.0008,0.0004],0.97,0.99,1);}}
  /* yeux */
  for(let e=0;e<2;e++){const sz=e?1:-1,ER=0.0028,EP=L.EP[e];const cx=0.1035,cy=P[5].y+0.004,cz=P[5].z+sz*0.0085;
    for(let i=0;i<5;i++){const a=(i/4-0.5)*PI;EP[i].set(cx+Math.sin(a)*ER,cy,cz+0.0004*sz);}
    writeTube(G,G.rings[25+e],EP,[0,ER*0.7,ER,ER*0.7,0],[0,ER*0.7,ER,ER*0.7,0],0.11,0.12,2);}
  /* le tout épouse la courbure de la paroi */
  {const pos=G.pos,sc=L.sc,la=L.la,lb=L.lb,kl=L.kss*la*la+L.kyy*lb*lb+2*L.ksy*la*lb,HX=LZH.x,HH=L.hx;
   for(let k=0;k<pos.length;k+=3){const x=pos[k],z=pos[k+2]*sc;let j=0;while(j<HX.length-2&&x<HX[j+1])j++;const t=clamp01((HX[j]-x)/(HX[j]-HX[j+1]));
     pos[k+1]+=(lerp(HH[j],HH[j+1],t)+0.5*kl*z*z+0.004)/sc;}}
  G.g.attributes.position.needsUpdate=true;G.g.attributes.normal.needsUpdate=true;G.g.attributes.aL.needsUpdate=true;}
/* une paroi vue comme une surface (s, y) : point, repère tangent, normale tournée vers la gorge */
const _wp={x:0,z:0,tx:0,tz:0,nx:0,nz:0};
function wallPt(s,y,sd,out){pathAt(s,_wp);const o=wallOff(s,y,sd);return out.set(_wp.x+_wp.nx*o,y,_wp.z+_wp.nz*o);}
const _a=V3(),_b=V3(),_c=V3(),_d=V3();
function wallFrame(L){const e=0.03;wallPt(L.s,L.y,L.sd,L.pos);wallPt(L.s+e,L.y,L.sd,_a);wallPt(L.s-e,L.y,L.sd,_b);L.ts.subVectors(_a,_b);const ls=L.ts.length()/(2*e);L.ts.normalize();
  wallPt(L.s,L.y+e,L.sd,_c);wallPt(L.s,L.y-e,L.sd,_d);L.ty.subVectors(_c,_d);const ly=L.ty.length()/(2*e);L.ty.normalize();
  L.n.crossVectors(L.ts,L.ty).normalize();pathAt(L.s,_wp);if(L.n.x*(-L.sd*_wp.nx)+L.n.z*(-L.sd*_wp.nz)<0)L.n.negate();L.ls=ls;L.ly=ly;
  /* courbure locale de la paroi (le corps épouse la roche au lieu de s'y enfoncer) */
  const E=0.12*L.sc,dS=E/ls,dY=E/ly,h=v=>_tmp.subVectors(v,L.pos).dot(L.n);
  const hs=h(wallPt(L.s+dS,L.y,L.sd,_a))+h(wallPt(L.s-dS,L.y,L.sd,_b)),hy=h(wallPt(L.s,L.y+dY,L.sd,_c))+h(wallPt(L.s,L.y-dY,L.sd,_d)),hd=h(wallPt(L.s+dS,L.y+dY,L.sd,_a));
  L.kss=hs/(E*E);L.kyy=hy/(E*E);L.ksy=hd/(E*E)-0.5*(L.kss+L.kyy);}
/* profil de la roche sous l'axe du corps (6 points, du museau au bout de la queue) */
const LZH={x:[0.15,0.08,0.02,-0.05,-0.12,-0.21]};
function lizProfile(L){if(!L.hx)L.hx=new Array(6).fill(0);for(let k=0;k<6;k++){const a=LZH.x[k]*L.sc*L.fa,b=LZH.x[k]*L.sc*L.fb;
  L.hx[k]=Math.max(_tmp.subVectors(wallPt(L.s+a/L.ls,L.y+b/L.ly,L.sd,_a),L.pos).dot(L.n),-0.05);}}
const _f=V3(),_r=V3(),_m3=new THREE.Matrix4();
function addLizard(s,y,sd,o){o=o||{};const G=lizGeo();lizMat();const mesh=new THREE.Mesh(G.g,o.blue?LIZMAT2:LIZMAT);mesh.frustumCulled=false;mesh.matrixAutoUpdate=false;scene.add(mesh);
  const sh=new THREE.Mesh(new THREE.PlaneGeometry(0.42,0.2),SHADOWBLOB());sh.matrixAutoUpdate=false;sh.renderOrder=2;scene.add(sh);
  const L={G,mesh,sh,s,y,sd,s0:s,y0:y,th:o.th===undefined?PI/2:o.th,spd:0,vt:0,gait:0,state:'idle',T:1+rnd()*3,dist:0,turn:0,look:0,lookT:0,bob:0,push:0,pushT:-1,curl:rnd()*2-1,ph:rnd()*TAU,
    pos:V3(),ts:V3(),ty:V3(),n:V3(),ls:1,ly:1,P:PV(LZ.NB),RW:new Array(LZ.NB).fill(0),RH:new Array(LZ.NB).fill(0),LP:[PV(LZ.LR),PV(LZ.LR),PV(LZ.LR),PV(LZ.LR)],TP:Array.from({length:20},()=>PV(LZ.TR)),EP:[PV(5),PV(5)],
    sc:o.scale||1,ymin:o.ymin||0.55,ymax:o.ymax||3.6,rs:o.rs||2.6};
  LIZ.push(L);return L;}
let _sb=null;function SHADOWBLOB(){if(_sb)return _sb;const c=document.createElement('canvas');c.width=128;c.height=64;const x=c.getContext('2d'),g=x.createRadialGradient(64,32,2,64,32,60);g.addColorStop(0,'rgba(0,0,0,.55)');g.addColorStop(1,'rgba(0,0,0,0)');x.save();x.scale(1,0.5);x.fillStyle=g;x.fillRect(0,0,128,128);x.restore();
  _sb=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthWrite:false,blending:THREE.MultiplyBlending,premultipliedAlpha:true,color:0xffffff,polygonOffset:true,polygonOffsetFactor:-4});
  _sb.blending=THREE.CustomBlending;_sb.blendSrc=THREE.ZeroFactor;_sb.blendDst=THREE.OneMinusSrcAlphaFactor;return _sb;}
function lizardsTick(t,dt){
  const cam=camera.position;
  for(const L of LIZ){
    wallFrame(L);
    const dc=L.pos.distanceTo(cam);
    /* décisions : immobile → tourner → filer ; fuite si l'on s'approche */
    L.T-=dt;
    if(L.state!=='flee'&&dc<2.3&&L.cool<=0){L.state='flee';const away=_a.subVectors(L.pos,cam);const as=away.dot(L.ts),ay=away.dot(L.ty)+0.6;L.turn=Math.atan2(ay,as);L.dist=0.7+rnd()*0.8;L.vt=1.5+rnd()*0.5;L.cool=6;}
    L.cool=(L.cool||0)-dt;
    if(L.state==='idle'){L.vt=0;if(L.pushT<0&&rnd()<dt*0.18){L.pushT=0;}if(rnd()<dt*0.35)L.lookT=(rnd()-0.5)*0.9;
      if(L.T<=0){const back=Math.abs(L.s-L.s0)>L.rs||L.y<L.ymin+0.1||L.y>L.ymax-0.1;
        L.turn=back?Math.atan2((L.y0-L.y)*L.ly,(L.s0-L.s)*L.ls):L.th+(rnd()-0.5)*2.6;L.state='turn';}}
    else if(L.state==='turn'){let d=((L.turn-L.th+PI)%TAU+TAU)%TAU-PI;const st=Math.sign(d)*Math.min(Math.abs(d),dt*7);L.th+=st;L.vt=0.12;
      if(Math.abs(d)<0.05){L.state='run';L.dist=0.15+rnd()*0.8;L.vt=0.6+rnd()*0.8;}}
    else if(L.state==='run'||L.state==='flee'){if(L.state==='flee'){let d=((L.turn-L.th+PI)%TAU+TAU)%TAU-PI;L.th+=Math.sign(d)*Math.min(Math.abs(d),dt*9);}
      L.dist-=L.spd*dt;if(L.dist<=0.04){L.state='idle';L.T=1.2+rnd()*5;L.vt=0;}}
    const acc=L.vt>L.spd?9:14;L.spd+=Math.sign(L.vt-L.spd)*Math.min(Math.abs(L.vt-L.spd),acc*dt);
    if(L.spd>0.001){const ds=Math.cos(L.th)*L.spd*dt/L.ls,dy=Math.sin(L.th)*L.spd*dt/L.ly;const ns=L.s+ds,ny=clamp(L.y+dy,L.ymin,L.ymax);
      if(ny!==L.y+dy){L.th=-L.th;}L.s=ns;L.y=ny;L.gait=(L.gait+dt*L.spd/0.075)%1;}
    else L.gait=(L.gait*0.9);
    if(L.pushT>=0){L.pushT+=dt;L.push=Math.max(0,Math.sin(L.pushT*PI*3.2))*(L.pushT<0.95?1:0);if(L.pushT>0.95){L.pushT=-1;L.push=0;}}
    L.look+=(L.lookT*(L.state==='idle'?1:0)-L.look)*Math.min(1,dt*6);L.bob=L.state==='idle'?Math.sin(t*1.7+L.ph)*0.3:0;
    /* repère : avant dans le plan tangent, dos selon la normale */
    _f.copy(L.ts).multiplyScalar(Math.cos(L.th)).addScaledVector(L.ty,Math.sin(L.th));_f.addScaledVector(L.n,-_f.dot(L.n)).normalize();_r.crossVectors(L.n,_f).normalize();
    L.fa=_f.dot(L.ts);L.fb=_f.dot(L.ty);_d.crossVectors(_f,L.n);L.la=_d.dot(L.ts);L.lb=_d.dot(L.ty);
    lizProfile(L);
    _m3.makeBasis(_f,L.n,_r.negate());const sc=L.sc;_m3.scale(_tmp.set(sc,sc,sc));_m3.setPosition(L.pos.x+L.n.x*0.002,L.pos.y+L.n.y*0.002,L.pos.z+L.n.z*0.002);
    L.mesh.matrix.copy(_m3);L.mesh.matrixWorldNeedsUpdate=true;
    const vis=dc<26;L.mesh.visible=L.sh.visible=vis;if(vis)lizardPose(L,t);
    _m3.makeBasis(_f,_r.negate(),L.n);_m3.scale(_tmp.set(sc,sc,1));_m3.setPosition(L.pos.x+L.n.x*0.003-_f.x*0.03*sc,L.pos.y+L.n.y*0.003-_f.y*0.03*sc,L.pos.z+L.n.z*0.003-_f.z*0.03*sc);L.sh.matrix.copy(_m3);L.sh.matrixWorldNeedsUpdate=true;
  }}
function buildLizards(){
  addLizard(27.2,1.35,1,{th:1.1,blue:1});addLizard(33.6,2.0,-1,{th:2.4});addLizard(46.4,1.6,-1,{th:1.9,scale:1.1});addLizard(S_FA-7.6,1.5,1,{th:1.4,scale:1.25,rs:1.2,blue:1});
  addLizard(70.9,2.6,1,{th:0.4,scale:1.15});addLizard(97.8,1.9,-1,{th:2.0,scale:1.25,blue:1});addLizard(99.0,2.3,1,{th:1.0,scale:1.25});
  LIFE.push(lizardsTick);}
/* ═══════════════════════════════════════════════════════════════════════════════
   13 · le vivant de l'air : filets de sable qui tombent de la fente (ils scintillent dans les faisceaux et
   soulèvent un nuage en touchant le sol), poussière en suspension, sable que le vent pousse au ras du sol ;
   blocs tombés, bois flotté coincé haut dans la gorge (souvenir des crues), galets
   ═══════════════════════════════════════════════════════════════════════════════ */
const SANDU={uTime:U.uTime,uPx:U.uPx,tShadow:{value:null},uShadowM:{value:new THREE.Matrix4()},uWind:{value:new THREE.Vector3(0.6,0,-0.3)},uCam:{value:V3()},uGust:{value:0}};
const SH_VIS=`#include <packing>
uniform sampler2D tShadow;uniform mat4 uShadowM;
float sunVis(vec3 p){vec4 sc=uShadowM*vec4(p,1.);sc.xyz/=sc.w;if(sc.x<0.||sc.x>1.||sc.y<0.||sc.y>1.)return 0.;return step(sc.z-.002,unpackRGBAToDepth(texture2D(tShadow,sc.xy)));}`;
const FALLS=[];
function buildSandFalls(){
  const E=[];const pa={};
  for(const w of WELLS){const H=rimH(w[0]);pathAt(w[0],pa);const c=(wallOff(w[0],H,1)+wallOff(w[0],H,-1))/2;E.push([pa.x+pa.nx*c,H+0.3,pa.z+pa.nz*c,H]);}
  for(const [s0,k] of [[S_PLAZA+2,0.6],[S_FA-3,-0.7],[S_PAV-6,0.3]]){const H=rimH(s0);pathAt(s0,pa);const o=wallOff(s0,H,k>0?1:-1)*0.92;E.push([pa.x+pa.nx*o,H+0.3,pa.z+pa.nz*o,H]);}
  const NP=[260,700,1200][TIER],N=E.length*NP,pos=new Float32Array(N*3),aR=new Float32Array(N*4),aE=new Float32Array(N*4);
  for(let e=0;e<E.length;e++)for(let i=0;i<NP;i++){const k=e*NP+i;pos.set(E[e].slice(0,3),k*3);aR.set([rnd(),rnd(),rnd(),rnd()],k*4);aE.set([E[e][3],e,(e*0.37)%1,0],k*4);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('aR',new THREE.BufferAttribute(aR,4));g.setAttribute('aE',new THREE.BufferAttribute(aE,4));
  const m=new THREE.ShaderMaterial({uniforms:SANDU,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    vertexShader:SH_VIS+`
      attribute vec4 aR,aE;uniform float uTime,uPx,uGust;uniform vec3 uWind;varying float vA;
      void main(){float H=aE.x,ph=aE.z;
        float cyc=uTime*.06+ph;float on=smoothstep(.0,.08,fract(cyc))*(1.-smoothstep(.32,.45,fract(cyc)));          // le filet coule par épisodes
        float T=2.6+aR.w*.6,t=fract(uTime/T+aR.x);float fall=4.9*t*t*T*T;float y=position.y-fall;
        vec3 p=position+vec3((aR.y-.5)*.12+uWind.x*t*1.2*(.4+uGust),y-position.y,(aR.z-.5)*.12+uWind.z*t*1.2*(.4+uGust));
        p.xz+=(vec2(aR.y,aR.z)-.5)*t*t*.7;
        float land=step(.25,y)*step(y,position.y-.5);vec4 mv=viewMatrix*vec4(p,1.);float d=-mv.z;
        float sv=sunVis(p);vA=on*land*(.025+.55*sv)*smoothstep(.6,2.,d)*(.4+.6*aR.w);
        gl_Position=projectionMatrix*mv;gl_PointSize=max(1.,uPx*(.005+.004*aR.w)/max(d,.5));}`,
    fragmentShader:`varying float vA;void main(){vec2 c=gl_PointCoord-.5;float r=dot(c,c);if(r>.25||vA<.003)discard;gl_FragColor=vec4(vec3(1.,.82,.58)*vA*(1.-r*4.),1.);}`});
  const pts=new THREE.Points(g,m);pts.frustumCulled=false;scene.add(pts);
  /* nuages au point de chute : relayés à l'air éclairé (plumes de poussière) */
  E.forEach((e,i)=>{const H=e[3],x=e[0]-SUN.x*0,z=e[2];FALLS.push({x,z,y:groundAt(x,z)+0.8,ph:(i*0.37)%1});});}
let MOTES=null,DRIFT=null;
function buildMotes(){
  const N=[600,1500,2600][TIER],p=new Float32Array(N*3),a=new Float32Array(N*3);for(let i=0;i<N;i++){p.set([rnd()*24-12,rnd()*rnd()*14,rnd()*24-12],i*3);a.set([rnd(),rnd(),rnd()],i*3);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(p,3));g.setAttribute('aS',new THREE.BufferAttribute(a,3));
  MOTES=new THREE.ShaderMaterial({uniforms:SANDU,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    vertexShader:SH_VIS+`attribute vec3 aS;uniform float uTime,uPx;uniform vec3 uCam,uWind;varying float vA;
      void main(){vec3 q=position+vec3(sin(uTime*.21+aS.x*6.28)*.6,sin(uTime*.17+aS.y*6.28)*.35-uTime*.02,cos(uTime*.19+aS.z*6.28)*.6)+uWind*uTime*.08;
        vec3 p=uCam+mod(q-uCam+12.,24.)-12.;p.y=q.y;
        vec4 mv=viewMatrix*vec4(p,1.);float d=-mv.z;float op=max(1.-smoothstep(7.,13.,length(p.xz-vec2(8.,-11.))),1.-smoothstep(7.,13.,length(p.xz-vec2(38.3,-29.))));vA=sunVis(p)*smoothstep(.4,1.8,d)*smoothstep(22.,9.,d)*(.4+.6*sin(uTime*(1.+aS.x*2.)+aS.y*40.))*mix(1.,.12,op);
        gl_Position=projectionMatrix*mv;gl_PointSize=uPx*(.004+.008*aS.z)/max(d,.5);}`,
    fragmentShader:`varying float vA;void main(){float d=length(gl_PointCoord-.5);if(d>.5||vA<=0.)discard;gl_FragColor=vec4(vec3(1.,.88,.68)*1.6*smoothstep(.5,0.,d)*vA,1.);}`});
  const pts=new THREE.Points(g,MOTES);pts.frustumCulled=false;scene.add(pts);
  /* sable que le vent pousse au ras du sol, par rafales */
  const M=[500,1400,2400][TIER],dp=new Float32Array(M*3),da=new Float32Array(M*4);for(let i=0;i<M;i++){dp.set([rnd()*18-9,0,rnd()*18-9],i*3);da.set([rnd(),rnd(),rnd(),rnd()],i*4);}
  const dg=new THREE.BufferGeometry();dg.setAttribute('position',new THREE.BufferAttribute(dp,3));dg.setAttribute('aR',new THREE.BufferAttribute(da,4));
  DRIFT=new THREE.ShaderMaterial({uniforms:Object.assign({uGround:{value:0}},SANDU),transparent:true,depthWrite:false,
    vertexShader:SH_VIS+`attribute vec4 aR;uniform float uTime,uPx,uGust,uGround;uniform vec3 uCam,uWind;varying float vA;varying vec3 vC;
      void main(){float sp=1.6+2.4*aR.x;vec3 q=position+uWind*uTime*sp*(.35+uGust);vec3 p=uCam+mod(q-uCam+9.,18.)-9.;
        float hop=abs(sin(uTime*(3.+aR.y*5.)+aR.z*30.))*(.03+.12*aR.w*uGust);p.y=uGround+.02+hop;
        vec4 mv=viewMatrix*vec4(p,1.);float d=-mv.z;float sv=sunVis(p);vA=(.22+.9*sv)*smoothstep(.3,1.2,d)*smoothstep(12.,6.,d)*(.25+.75*uGust)*aR.w;
        vC=mix(vec3(.5,.3,.17),vec3(1.,.8,.55),sv);
        gl_Position=projectionMatrix*mv;gl_PointSize=uPx*(.004+.004*aR.y)/max(d,.4);}`,
    fragmentShader:`varying float vA;varying vec3 vC;void main(){float d=length(gl_PointCoord-.5);if(d>.5||vA<=0.01)discard;gl_FragColor=vec4(vC,vA*smoothstep(.5,.1,d));}`});
  const dpts=new THREE.Points(dg,DRIFT);dpts.frustumCulled=false;scene.add(dpts);
  LIFE.push((t,dt)=>{SANDU.uCam.value.copy(camera.position);if(sun.shadow.map){SANDU.tShadow.value=sun.shadow.map.texture;SANDU.uShadowM.value.copy(sun.shadow.matrix);}
    const s=sNearFast(camera.position.x,camera.position.z);const pa=pathAt(s,{});const gust=clamp01(0.35+0.65*Math.sin(t*0.23)*Math.sin(t*0.091+1.7)+0.25*Math.sin(t*1.3));SANDU.uGust.value=gust;
    SANDU.uWind.value.set(pa.tx,0,pa.tz).multiplyScalar(-1);DRIFT.uniforms.uGround.value=flatten(camera.position.x,camera.position.z,sandH(s,0));
    /* plumes : quand un filet touche le sol, la poussière monte dans la lumière */
    const pl=air.vol.uniforms.uPlume.value;const near=FALLS.map(f=>({f,d:(f.x-camera.position.x)**2+(f.z-camera.position.z)**2})).sort((a,b)=>a.d-b.d);
    for(let i=0;i<4;i++){const f=near[i]&&near[i].f;if(!f){pl[i].w=0;continue;}const c=(t*0.06+f.ph)%1;const on=smooth(0.05,0.15,c)*(1-smooth(0.38,0.55,c));pl[i].set(f.x,f.y,f.z,on*0.9);}});}
let _sNF=0;function sNearFast(x,z){let b=1e9,bs=_sNF;const i0=Math.round(_sNF/PATH.DS);for(let i=Math.max(0,i0-80);i<Math.min(PATH.N,i0+80);i++){const d=(PATH.X[i]-x)**2+(PATH.Z[i]-z)**2;if(d<b){b=d;bs=i*PATH.DS;}}
  if(b>16)bs=sNear(x,z);_sNF=bs;return bs;}
function buildDebris(){
  const mat=sandstoneMat('boulder','vec3(.95,.85,.8)',{noAtlas:true,lines:0.6,giK:1});const G=[];const pa={};
  const spots=[[22,-1,0.9],[26,1,0.5],[30.5,-1,0.7],[36,1,0.6],[41,-1,1.1],[52,1,1.4],[60,-1,0.8],[64.5,-1,0.5],[68,-1,0.9],[73,-1,0.6],[77,-1,0.7],[83,1,1.0],[90,-1,1.2],[93,1,0.7]];
  for(const [s0,sd,r] of spots){pathAt(s0,pa);const w=wallOff(s0,0.3,sd)-sd*r*0.6,x=pa.x+pa.nx*w,z=pa.z+pa.nz*w;const g=clean(new THREE.IcosahedronGeometry(1,3));
    const p=g.attributes.position;const sd2=rnd()*50;for(let i=0;i<p.count;i++){const vx=p.getX(i),vy=p.getY(i),vz=p.getZ(i);const k=0.75+0.5*fbm3(vx*1.3+sd2,vy*1.3,vz*1.3,3);p.setXYZ(i,vx*k,vy*k*0.62,vz*k);}
    place(g,x,groundAt(x,z)+r*0.18,z,rnd()*0.3,rnd()*TAU,rnd()*0.3,r,r,r);G.push(g);
    for(let k=0;k<6;k++){const pg=clean(new THREE.IcosahedronGeometry(1,1));const rr=0.04+rnd()*0.09,xx=x+(rnd()-0.5)*1.6,zz=z+(rnd()-0.5)*1.6;place(pg,xx,groundAt(xx,zz)+rr*0.3,zz,rnd(),rnd(),rnd(),rr,rr*0.7,rr);G.push(pg);}}
  const geo=erode(G,0.03,{freq:2});const m=new THREE.Mesh(geo,mat);m.castShadow=m.receiveShadow=true;scene.add(m);giAttr(geo,m,0.4,29);
  /* bois flotté coincé entre les parois, haut dans la gorge */
  {const s0=29.5,y0=6.8;pathAt(s0,pa);const a=wallOff(s0,y0,1)+0.25,b=wallOff(s0,y0,-1)-0.25;const A=V3(pa.x+pa.nx*a,y0+0.3,pa.z+pa.nz*a),B=V3(pa.x+pa.nx*b,y0-0.15,pa.z+pa.nz*b);
   const curve=new THREE.CatmullRomCurve3([A,A.clone().lerp(B,0.35).add(V3(0.1,0.12,0.15)),A.clone().lerp(B,0.7).add(V3(-0.08,-0.05,-0.1)),B]);
   const tg=new THREE.TubeGeometry(curve,40,0.16,10,false);const tp=tg.attributes.position;for(let i=0;i<tp.count;i++){const v=V3(tp.getX(i),tp.getY(i),tp.getZ(i));const n=fbm3(v.x*3,v.y*3,v.z*3,2)-0.5;tp.setXYZ(i,v.x+n*0.05,v.y+n*0.05,v.z+n*0.05);}
   tg.computeVertexNormals();const wm=rvMat({color:0xffffff,roughness:.9},{key:'driftwood',fColor:'vec3 P=vW;float g=sin(dot(P,vec3(9.,2.,9.))+rvF(P*2.)*8.)*.5+.5;diffuseColor.rgb=mix(vec3(.30,.24,.19),vec3(.55,.48,.40),g*.7+rvN(P*30.)*.3);',fGI:'float rvOpen=.4,rvHn=clamp(vW.y/29.,0.,1.);'});
   const log=new THREE.Mesh(tg,wm);log.castShadow=log.receiveShadow=true;scene.add(log);}
}
/* ═══════════════════════════════════════════════════════════════════════════════
   14 · le vent qui se voit : tentures nouées aux arcs du pavillon, tapis et brûle-parfum fumant devant le Trésor,
   touffes d'herbe sèche dans le sable, martinets qui filent sous la fente
   ═══════════════════════════════════════════════════════════════════════════════ */
const WINDU={uTime:U.uTime,uGust:{value:0.5}};
function clothMat(tex,key){const m=new THREE.MeshStandardMaterial({map:tex,roughness:.85,side:THREE.DoubleSide});const old=rvLit(m,key).onBeforeCompile;
  m.onBeforeCompile=sh=>{old(sh);sh.uniforms.uGust=WINDU.uGust;sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nuniform float uGust,uTime;attribute float aHang;')
    .replace('#include <begin_vertex>',`#include <begin_vertex>
      {float k=aHang*aHang;float w=sin(uTime*1.7+position.x*2.1+aHang*3.)*.5+sin(uTime*2.9+aHang*6.+position.x)*.25;transformed.z+=k*(.12+.35*uGust)*w;transformed.x+=k*.06*sin(uTime*1.3+aHang*4.)*(.4+uGust);}`);};
  m.customProgramCacheKey=()=>'rvl_'+key;return m;}
function texCloth(base,b2,gold,seed){const W=256,H=1024,c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d'),r=mulberry(seed);
  x.fillStyle=base;x.fillRect(0,0,W,H);for(let y=0;y<H;y+=96){x.fillStyle=b2;x.fillRect(0,y+30,W,26);x.fillStyle=gold;x.fillRect(0,y+26,W,4);x.fillRect(0,y+56,W,4);
    for(let i=0;i<8;i++){x.beginPath();x.moveTo(i*32+16,y+34);x.lineTo(i*32+26,y+43);x.lineTo(i*32+16,y+52);x.lineTo(i*32+6,y+43);x.closePath();x.fill();}}
  x.fillStyle=gold;x.fillRect(0,H-36,W,10);for(let i=0;i<W;i+=8){x.fillRect(i,H-26,3,26);}
  const im=x.getImageData(0,0,W,H),d=im.data;for(let i=0;i<d.length;i+=4){const n=(r()-0.5)*18;d[i]+=n;d[i+1]+=n;d[i+2]+=n;}x.putImageData(im,0,0);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;}
function clothGeo(w,h,nx,ny,tie){const g=new THREE.PlaneGeometry(w,h,nx,ny);g.translate(0,-h/2,0);const p=g.attributes.position,a=new Float32Array(p.count);
  for(let i=0;i<p.count;i++){const y=-p.getY(i)/h;a[i]=y;if(tie!==undefined){const x=p.getX(i);const pinch=Math.exp(-(((y-tie)/0.18)**2));p.setX(i,x*(1-0.62*pinch));}}
  g.setAttribute('aHang',new THREE.BufferAttribute(a,1));g.computeVertexNormals();return g;}
function buildWind(){
  /* (le pavillon n'a plus de tentures : son décor est sculpté) */
  /* devant le Trésor : un tapis sur les marches, un brûle-parfum de laiton dont la fumée part avec le vent */
  {const r=TA.root;const cp=new THREE.Mesh(new THREE.PlaneGeometry(2.2,3.2,1,1),rvLit(new THREE.MeshStandardMaterial({map:texCarpet(),roughness:.95}),'carpetA'));cp.rotation.x=-PI/2;cp.rotation.z=0.08;cp.position.set(0.3,0.575,0.0);r.add(cp);
   const M=lanMats();const bz=new THREE.Mesh(nrm(lathe([[0,0],[0.16,0],[0.19,0.04],[0.08,0.1],[0.07,0.24],[0.2,0.32],[0.24,0.42],[0.2,0.48],[0,0.48]],20,0.04)),M.solid);bz.position.set(-1.25,0.56,0.55);r.add(bz);
   r.updateMatrixWorld(true);const sp=V3(-1.25,1.06,0.55).applyMatrix4(r.matrixWorld);SMOKE.o=sp;buildSmoke(sp);}
  /* herbes sèches : touffes de brins en éventail, là où le sable reçoit un peu de ciel */
  {const c=document.createElement('canvas');c.width=128;c.height=256;const x=c.getContext('2d'),rr=mulberry(5);x.lineCap='round';
   for(let i=0;i<34;i++){const bx=64+(rr()-0.5)*30,lean=(rr()-0.5)*90,h=150+rr()*100;x.strokeStyle=`hsl(${32+rr()*14},${30+rr()*25}%,${38+rr()*30}%)`;x.lineWidth=1.5+rr()*2;x.beginPath();x.moveTo(bx,256);x.quadraticCurveTo(bx+lean*0.4,256-h*0.6,bx+lean,256-h);x.stroke();}
   const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;
   const gm=new THREE.MeshStandardMaterial({map:tex,alphaTest:.45,side:THREE.DoubleSide,roughness:.9});const old=rvLit(gm,'grass').onBeforeCompile;
   gm.onBeforeCompile=sh=>{old(sh);sh.uniforms.uGust=WINDU.uGust;sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nuniform float uGust,uTime;').replace('#include <begin_vertex>',`#include <begin_vertex>
     {float k=uv.y*uv.y;vec4 wp=modelMatrix*vec4(0.,0.,0.,1.);float w=sin(uTime*2.3+wp.x*.8+wp.z*.6)*.6+sin(uTime*4.1+wp.x*2.)*.25;transformed.x+=k*(.04+.12*uGust)*w;transformed.z+=k*.03*w;}`);};
   gm.customProgramCacheKey=()=>'rvl_grass2';
   const card=new THREE.PlaneGeometry(0.55,0.62);card.translate(0,0.31,0);const cards=[];
   const pa={};const spots=[];for(let k=0;k<70;k++){const s0=S_PLAZA-6+rnd()*(S_END-S_PLAZA-6),sd=rnd()<0.5?1:-1;pathAt(s0,pa);const w=wallOff(s0,0.3,sd)-sd*(0.25+rnd()*0.6);const x=pa.x+pa.nx*w,z=pa.z+pa.nz*w;
     if(kOpen(s0)<0.4&&rnd()<0.75)continue;spots.push([x,z]);}
   const geoAll=[];for(const [x,z] of spots){const y=groundAt(x,z)-0.02,sc=0.6+rnd()*0.8,ry=rnd()*PI;for(let q=0;q<3;q++){const g=card.clone();place(g,x,y,z,0,ry+q*PI/3,0,sc,sc*(0.8+rnd()*0.4),sc);geoAll.push(g);}}
   if(geoAll.length){const mg=mergeGeometries(geoAll);const m=new THREE.Mesh(mg,gm);m.castShadow=true;m.receiveShadow=true;scene.add(m);}}
  buildBirds();
  LIFE.push((t,dt)=>{WINDU.uGust.value=SANDU.uGust.value;});}
const SMOKE={o:null,sp:[]};
function buildSmoke(o){const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d'),g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(255,255,255,.5)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,64,64);
  const tex=new THREE.CanvasTexture(c);for(let i=0;i<14;i++){const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,color:0xd9c9b8,transparent:true,depthWrite:false,opacity:0}));scene.add(sp);SMOKE.sp.push({sp,o:i/14});}
  LIFE.push((t)=>{const w=SANDU.uWind.value,gst=SANDU.uGust.value;for(const m of SMOKE.sp){const u=(t*0.12+m.o)%1;m.sp.position.set(o.x+w.x*u*u*1.6*(0.4+gst)+Math.sin(u*7+m.o*9)*0.08*u,o.y+u*1.9,o.z+w.z*u*u*1.6*(0.4+gst));m.sp.scale.setScalar(0.12+u*0.9);m.sp.material.opacity=0.16*Math.sin(u*PI)*(1-u*0.4);}});}
/* martinets : silhouettes sombres, ailes en faux qui battent puis planent ; ils remontent la gorge haut sous la fente */
/* martinets : corps fuselé, queue fourchue, ailes en faucille qui battent (et parfois planent) */
function buildBirds(){const N=[3,5,7][TIER];const g=new THREE.BufferGeometry();
  const V=[0,0.005,0.14, -0.022,0,0.0, 0.022,0,0.0,  -0.022,0,0.0, 0.022,0,0.0, 0,0,-0.12,  0,0,-0.1,-0.04,0,-0.2,-0.008,0,-0.11,  0,0,-0.1,0.04,0,-0.2,0.008,0,-0.11];
  for(const sx of[-1,1])V.push(sx*0.018,0,0.04, sx*0.19,0,-0.01, sx*0.016,0,-0.05,  sx*0.19,0,-0.01, sx*0.36,0,-0.17, sx*0.016,0,-0.05);
  g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(V),3));g.computeVertexNormals();
  const mat=new THREE.MeshBasicMaterial({color:0x17110d,side:THREE.DoubleSide});const B=[];
  for(let i=0;i<N;i++){const m=new THREE.Mesh(g.clone(),mat);m.frustumCulled=false;scene.add(m);B.push({m,ph:rnd()*TAU,off:rnd()*40,lat:(rnd()-0.5)*1.2,h:13+rnd()*9,sp:9+rnd()*5});}
  const pa={},pb={};
  LIFE.push((t)=>{const cs=sNearFast(camera.position.x,camera.position.z);
    for(const b of B){const cyc=((t*b.sp+b.off*7)%120);const s=clamp(cs-30+cyc*0.55,0,S_END-2);pathAt(s,pa);pathAt(s+1,pb);const H=rimH(s);const c=(wallOff(s,b.h,1)+wallOff(s,b.h,-1))/2+b.lat;
      const y=Math.min(b.h+Math.sin(t*0.9+b.ph)*1.5,H-2);b.m.position.set(pa.x+pa.nx*c,y,pa.z+pa.nz*c);b.m.lookAt(pb.x+pa.nx*c,y-0.1,pb.z+pa.nz*c);
      const fl=Math.sin(t*24+b.ph)*(Math.sin(t*0.7+b.ph)>-0.2?1:0.12);const p=b.m.geometry.attributes.position;for(const i of[13,15,19])p.setY(i,fl*0.07);p.setY(16,fl*0.15);p.setY(22,fl*0.15);for(const i of[21])p.setY(i,fl*0.07);p.needsUpdate=true;b.m.visible=cyc<110;b.m.scale.setScalar(1.25);}});}
/* cailloux : éclats de grès tombés des parois, plus nombreux au pied des murs */
function buildPebbles(){const N=[140,320,520][TIER],G=[],r=mulberry(57),pa={};
  for(let i=0;i<N;i++){const s=lerp(S_START-4,S_END-1.5,r());pathAt(s,pa);const oL=wallOff(s,0.1,1),oR=wallOff(s,0.1,-1),t=r();
    const o=lerp(oR,oL,t<.5?Math.pow(t*2,0.35)*.5:1-Math.pow((1-t)*2,0.35)*.5),x=pa.x+pa.nx*o,z=pa.z+pa.nz*o,sc=0.022+0.075*Math.pow(r(),2.4);
    const g=clean(new THREE.IcosahedronGeometry(1,1)),q=g.attributes.position;for(let k=0;k<q.count;k++){const f=0.75+0.5*r();q.setXYZ(k,q.getX(k)*f,q.getY(k)*f,q.getZ(k)*f);}
    G.push(place(g,x,groundAt(x,z)+sc*0.18,z,r()*3,r()*3,r()*3,sc*(0.8+r()*0.6),sc*(0.4+r()*0.3),sc*(0.8+r()*0.6)));}
  const m=rvMat({color:0xffffff,roughness:.85,metalness:0},{key:'pebble',fColor:'float n=rvF(vW*7.);diffuseColor.rgb=mix(vec3(.42,.18,.09),vec3(.78,.5,.3),n)*(.8+.3*rvN(vW*40.));',fGI:'float rvOpen=.4,rvHn=.03;'});
  const mesh=new THREE.Mesh(nrm(mergeGeometries(G)),m);mesh.castShadow=mesh.receiveShadow=true;scene.add(mesh);}
/* buissons secs accrochés au rebord de la fente : silhouettes contre le ciel, agitées par le vent */
function buildRimShrubs(){const r=mulberry(77),[c,x]=(()=>{const c=document.createElement('canvas');c.width=c.height=256;return [c,c.getContext('2d')];})();
  x.lineCap='round';const br=(px,py,a,l,w,d)=>{if(d>6||l<4)return;const ex=px+Math.cos(a)*l,ey=py-Math.sin(a)*l;x.strokeStyle=`rgb(${60+d*12},${40+d*8},${22+d*4})`;x.lineWidth=w;x.beginPath();x.moveTo(px,py);x.lineTo(ex,ey);x.stroke();
    const n=2+(r()*2|0);for(let i=0;i<n;i++)br(ex,ey,a+(r()-0.5)*1.4,l*(0.62+r()*0.2),w*0.68,d+1);
    if(d>3&&r()<0.5){x.fillStyle=`rgba(${88+r()*30|0},${92+r()*20|0},${48},0.9)`;x.beginPath();x.arc(ex,ey,2+r()*2.5,0,TAU);x.fill();}};
  for(let k=0;k<5;k++)br(128+(r()-0.5)*30,250,PI/2+(r()-0.5)*1.1,48+r()*30,7,0);
  const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;
  const m=rvLit(new THREE.MeshStandardMaterial({map:tex,alphaTest:0.4,side:THREE.DoubleSide,roughness:.9}),'shrub');
  {const o=m.onBeforeCompile;m.onBeforeCompile=sh=>{o(sh);sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nuniform float uTime;').replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.x+=sin(uTime*1.9+modelMatrix[3][0]*.7+modelMatrix[3][2])*.07*uv.y*uv.y;');};}
  const G=[],pa={};const q=new THREE.PlaneGeometry(1,1);q.translate(0,0.5,0);
  for(let s=-2;s<S_END-2;s+=1.6+r()*2.4)for(const sd of[-1,1]){if(r()<0.35)continue;const H=rimH(s);pathAt(s,pa);const o=wallOff(s,H,sd)+sd*(0.35+r()*1.4),sz=0.6+r()*1.1;
    for(const a of[0,PI/2]){const g=q.clone();g.scale(sz*(0.9+r()*0.4),sz,1);g.rotateY(a+r());g.translate(pa.x+pa.nx*o,H+0.12+r()*0.15,pa.z+pa.nz*o);G.push(g);}}
  const mesh=new THREE.Mesh(mergeGeometries(G),m);mesh.castShadow=true;scene.add(mesh);}
function buildRuinsA(){const r=TA.root,G=[];
  const drum=(len,x,z,ry,tilt)=>{const g=lathe([[0,0],[0.31,0],[0.315,len*0.5],[0.31,len],[0,len]],22,0.12);place(g,0,0,0,PI/2,0,0);place(g,x,0.3,z,tilt||0,ry,0);G.push(g);};
  drum(1.05,-5.9,3.6,0.4);drum(0.8,-4.7,4.6,1.9,0.05);drum(0.9,6.4,3.9,-0.7);
  G.push(sbox(0.9,0.6,0.7,6.9,0.25,2.6,0.5),sbox(0.7,0.5,0.6,5.6,0.2,5.0,1.2),sbox(1.1,0.45,0.8,-6.9,0.18,2.3,-0.3));
  {const c=colGeo(1.0,0.31,0.82);place(c,0,-0.05,0,0.35,0,1.2);place(c,4.3,0.25,5.6,0,0.8,0);G.push(c);}
  const geo=erode(G,0.03,{freq:2.4,base:0.5});const m=new THREE.Mesh(geo,TA.mesh.material);m.castShadow=m.receiveShadow=true;r.add(m);r.updateMatrixWorld(true);giAttr(geo,m,1,30.5);}
/* ═══════════════════════════════════════════════════════════════════════════════
   15 · le bassin du pavillon : margelle octogonale de marbre, eau sombre où tremblent les reflets des lanternes,
   petit jet qui retombe en gouttes et dessine des ronds
   ═══════════════════════════════════════════════════════════════════════════════ */
function buildFountain(){const r=TB.root,R=1.25,Z=3.25,KY=0.42;
  const rim=new THREE.Mesh(nrm(lathe([[R-0.18,0],[R+0.12,0],[R+0.12,0.36],[R+0.18,0.42],[R+0.12,0.48],[R-0.12,0.48],[R-0.16,0.4],[R-0.16,0.08]],8,0.06)),TB.mats.mMar);
  rim.rotation.y=PI/8;rim.scale.y=KY;rim.position.set(0,0.0,Z);rim.castShadow=rim.receiveShadow=true;r.add(rim);
  const fl=new THREE.Mesh(new THREE.CircleGeometry(R-0.15,8).rotateX(-PI/2),new THREE.MeshStandardMaterial({color:0x2a3a3a,roughness:.9}));fl.rotation.y=PI/8;fl.position.set(0,0.03,Z);r.add(fl);
  const wm=rvMat({color:0x061416,roughness:.04,metalness:0,envMap:ENVTEX,envMapIntensity:.38},{key:'water',
    fColor:'diffuseColor.rgb=vec3(.008,.02,.022);',fRough:'roughnessFactor=.035;',
    fNormal:`{vec2 q=vW.xz-uFC;float d=length(q);float ring=sin(d*26.-uTime*7.)*exp(-d*1.6)*.5+sin(d*41.-uTime*11.+1.3)*exp(-d*2.4)*.3;
      float w=rvN(vec3(vW.xz*3.,uTime*.25))*.6+rvN(vec3(vW.xz*7.,uTime*.4))*.4;normal=rvBump(-vViewPosition,normal,.0016*ring+.0012*w,1.);}`,
    fHead:'uniform vec2 uFC;',uniforms:{uFC:{value:new THREE.Vector2()}},fGI:'float rvOpen=.5,rvHn=.05;',giK:.6,specK:'6.0'});
  const water=new THREE.Mesh(new THREE.CircleGeometry(R-0.14,8).rotateX(-PI/2),wm);water.rotation.y=PI/8;water.position.set(0,0.36*KY,Z);r.add(water);
  r.updateMatrixWorld(true);const c=V3(0,0.36*KY,Z).applyMatrix4(r.matrixWorld);TB.fountainC=c.clone();
  wm.onBeforeCompile=(o=>sh=>{o(sh);sh.uniforms.uFC.value.set(c.x,c.z);})(wm.onBeforeCompile);
  const sp=new THREE.Mesh(nrm(lathe([[0,0],[0.14,0],[0.12,0.08],[0.05,0.14],[0.045,0.42],[0.08,0.5],[0.03,0.56],[0,0.58]],16,0.04)),lanMats().solid);sp.scale.setScalar(0.8);sp.position.set(0,0.36*KY-0.06,Z);r.add(sp);
  /* le jet : gouttes en parabole, éclairées par les lanternes (additives, discrètes) */
  const N=[120,260,400][TIER],pos=new Float32Array(N*3),a=new Float32Array(N*2);for(let i=0;i<N;i++){pos.set([c.x,c.y,c.z],i*3);a.set([rnd(),rnd()],i*2);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('aR',new THREE.BufferAttribute(a,2));
  const m=new THREE.ShaderMaterial({uniforms:{uTime:U.uTime,uPx:U.uPx},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    vertexShader:`attribute vec2 aR;uniform float uTime,uPx;varying float vA;void main(){float t=fract(uTime*.9+aR.x);float an=aR.y*6.2832;float v=.42+.08*aR.y;
      vec3 p=position+vec3(cos(an)*t*.22,.28+v*t*1.9-4.9*t*t*.62,sin(an)*t*.22);vA=(1.-t)*.5*step(position.y,p.y);vec4 mv=viewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=max(1.,uPx*.012/max(-mv.z,.5));}`,
    fragmentShader:`varying float vA;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;gl_FragColor=vec4(vec3(1.,.86,.62)*vA*smoothstep(.5,.1,d),1.);}`});
  const pts=new THREE.Points(g,m);pts.frustumCulled=false;scene.add(pts);
  FLAT.push({x:c.x,z:c.z,r:2.4,h:0.03});}
async function buildTemples(){
  await buildTempleA();buildRuinsA();buildLanternsA();LIFE.push(lanternsTick);
  await buildTempleB();buildFountain();
  await buildSteles();
  buildLizards();
  buildDebris();buildPebbles();buildRimShrubs();buildSandFalls();buildMotes();buildWind();
}
function buildDecor(){computeBounces();}
/* taches de lumière rebondie : là où chaque faisceau touche le sable, la roche voisine se réchauffe */
function computeBounces(){
  const L=[];const pa={};
  for(const w of WELLS){const H=rimH(w[0]),sl=w[0]+H*alongSun(w[0]);pathAt(sl,pa);const x=pa.x,z=pa.z;
    L.push([x,groundAt(x,z)+0.45,z,2.6,clamp01(w[2]/0.5)*0.9]);}
  for(const s of [S_PLAZA+3,S_FA,S_AMPH+6,S_END-9]){const H=rimH(s);pathAt(s,pa);const c=(wallOff(s,H,1)+wallOff(s,H,-1))/2;const k=H/SUN.y;
    const x=pa.x+pa.nx*c-SUN.x*k,z=pa.z+pa.nz*c-SUN.z*k;L.push([x,groundAt(x,z)+1.2,z,5.0,0.38]);}
  for(const g of [(S_ST[0]+S_ST[1])/2,(S_ST[1]+S_ST[2])/2]){pathAt(g,pa);const x=pa.x+pa.nx*ST_LAND,z=pa.z+pa.nz*ST_LAND;L.push([x,groundAt(x,z)+0.6,z,2.6,0.6]);}
  /* le sable ensoleillé des parvis renvoie une lumière chaude sur le bas des façades */
  if(TA.root){const v=V3(0,0.7,4.2).applyMatrix4(TA.root.matrixWorld);L.push([v.x,v.y,v.z,6.5,0.55]);}
  if(TB.root){const v=V3(0,0.6,3.3).applyMatrix4(TB.root.matrixWorld);L.push([v.x,v.y,v.z,5.5,0.35]);}
  L.slice(0,NBNC).forEach((b,i)=>{U.uBncP.value[i].set(b[0],b[1],b[2],b[3]);U.uBncC.value[i].set(1.0,0.5,0.22).multiplyScalar(b[4]*0.55);});
  window.RVC_BNC=L;}
