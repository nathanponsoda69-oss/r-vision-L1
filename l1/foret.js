/* R·Vision L1 — module de la forêt de la finance (chargé à l'approche du portail par l1/app.js) */
/* ═══════════════════════════════════════════════════════════════════════════════
   R·VISION — L1 · la forêt de la finance et son sanctuaire (module chargé à l'approche du portail)
   01 · socle : réglages, rendu, bruit, textures
   ═══════════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {Pass,FullScreenQuad} from 'three/addons/postprocessing/Pass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';

const Q=new URLSearchParams(''),CAPTURE=new URLSearchParams(location.search).has('capture');
const MOBILE=matchMedia('(max-width:760px)').matches||/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
let TIER=MOBILE?0:(((navigator.deviceMemory||8)<=4||(navigator.hardwareConcurrency||8)<=4)?1:2);
if(Q.get('q')!==null)TIER=Math.max(0,Math.min(2,+Q.get('q')||0));
const PI=Math.PI,TAU=PI*2;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),clamp01=x=>clamp(x,0,1),lerp=(a,b,t)=>a+(b-a)*t;
const smooth=(a,b,x)=>{const t=clamp01((x-a)/(b-a));return t*t*(3-2*t);};
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const rnd=mulberry(20261114);
const V3=(x,y,z)=>new THREE.Vector3(x,y,z);
const $=id=>document.getElementById(id);
function fail(msg){throw new Error(msg);}

/* bruit de valeur 2D (relief, répartition) */
const _h=(x,y)=>{let n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n);};
function vnoise(x,y){const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy);
  const a=_h(ix,iy),b=_h(ix+1,iy),c=_h(ix,iy+1),d=_h(ix+1,iy+1);return a+(b-a)*sx+(c-a)*sy+(a-b-c+d)*sx*sy;}
function fbm(x,y,o){let s=0,a=.5,f=1,t=0;for(let i=0;i<(o||4);i++){s+=a*vnoise(x*f,y*f);t+=a;a*=.5;f*=2.03;}return s/t;}

const canvas=document.createElement('canvas');canvas.id='rvf';canvas.setAttribute('aria-hidden','true');canvas.style.cssText='position:fixed;inset:0;width:100%;height:100%;display:none;pointer-events:none';
let renderer;
try{renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'high-performance',stencil:false,preserveDrawingBuffer:CAPTURE});}
catch(e){fail("Ce navigateur n'a pas pu démarrer le rendu 3D (WebGL 2).");}
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=+(Q.get('exp')||1.0);
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const DPR_MAX=[1.25,1.5,1.75][TIER];
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(46,1,0.15,400);
const U={uTime:{value:0},uSunV:{value:V3(0,1,0)}};
const SUN=V3(-0.66,0.58,-0.42).normalize();           // direction VERS le soleil : il est devant nous, au-dessus du sanctuaire
const SUN_COL=new THREE.Color(1.0,0.86,0.66),SKY_COL=new THREE.Color(0.55,0.72,0.9);

/* ─────────────── textures : peintes (fichiers) et dessinées (canevas) ─────────────── */
const TEX={};
const TEX_SRC=(()=>{const d=window.RV_TEXDIR||'l1/tex/',v=window.RV_TEXV||'',m={"bark_rough":"f_bark_rough","bark_rough_n":"f_bark_rough_n","ground_moss":"ground_moss","ground_moss_n":"f_ground_moss_n","ground_litter":"ground_litter","rock":"rock","rock_n":"f_rock_n","fern":"fern","wood_cedar":"wood_cedar","wood_cedar_n":"wood_cedar_n"},o={};for(const k in m)o[k]=d+m[k]+'.webp'+v;return o;})();   // textures en fichiers (l1/tex), partagées avec la jungle quand elles sont identiques
function loadTex(k,o){o=o||{};return new Promise(res=>{new THREE.TextureLoader().load(TEX_SRC[k]||('tex/'+k+'.webp'),t=>{
  if(o.srgb!==false)t.colorSpace=THREE.SRGBColorSpace;if(o.rep!==false)t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=TIER?8:2;TEX[k]=t;res(t);},undefined,()=>fail('Texture manquante : '+k));});}
function cv(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
function ctex(c,o){o=o||{};const t=new THREE.CanvasTexture(c);if(o.srgb!==false)t.colorSpace=THREE.SRGBColorSpace;if(o.rep)t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=TIER?8:2;return t;}
/* rameau de résineux : une tige, des rameaux alternés, des aiguilles en peigne */
function texPine(){
  const n=512,c=cv(n,n),x=c.getContext('2d'),r=mulberry(91);x.lineCap='round';
  const needles=(x0,y0,x1,y1,len)=>{const dx=x1-x0,dy=y1-y0,L=Math.hypot(dx,dy),ux=dx/L,uy=dy/L,m=Math.max(2,L/3.2|0);
    for(let i=0;i<m;i++){const t=i/m,px=x0+dx*t,py=y0+dy*t;for(const s of[-1,1]){const a=Math.atan2(uy,ux)+s*(.55+r()*.5),l=len*(.6+r()*.6);
      x.strokeStyle='hsl('+(88+r()*34|0)+','+(34+r()*22|0)+'%,'+(20+r()*24|0)+'%)';x.lineWidth=1.2+r()*1.1;x.beginPath();x.moveTo(px,py);x.lineTo(px+Math.cos(a)*l,py+Math.sin(a)*l);x.stroke();}}};
  const twig=(x0,y0,a,L,w,depth)=>{const x1=x0+Math.cos(a)*L,y1=y0+Math.sin(a)*L;needles(x0,y0,x1,y1,depth?13:17);
    x.strokeStyle='#2a1d12';x.lineWidth=w;x.beginPath();x.moveTo(x0,y0);x.lineTo(x1,y1);x.stroke();
    if(depth<2){const k=Math.max(2,L/34|0);for(let i=1;i<=k;i++){const t=i/(k+1),s=i%2?1:-1;twig(x0+(x1-x0)*t,y0+(y1-y0)*t,a+s*(.75+r()*.3),L*(.5-t*.22)*(.8+r()*.4),w*.55,depth+1);}}};
  twig(n/2,n-6,-PI/2+.03,n-40,5,0);
  for(let i=1;i<=9;i++){const t=i/10,s=i%2?1:-1;twig(n/2,n-6-(n-40)*t,-PI/2+s*(1.0+r()*.25),(n*.46)*(1-t*.78)*(.8+r()*.35),3.2,1);}
  return ctex(c);
}
/* rameau feuillu : tige, rameaux, feuilles lancéolées à nervure claire */
function texLeaf(){
  const n=512,c=cv(1024,1024),x=c.getContext('2d'),r=mulberry(33);x.scale(2,2);x.lineCap='round';
  const leaf=(px,py,a,l)=>{x.save();x.translate(px,py);x.rotate(a);const old=r()<.1,h=old?38+r()*22:66+r()*42,sa=old?50:44+r()*28,li=26+r()*24,w=.26+r()*.12;
    const g=x.createLinearGradient(0,-l*w,0,l*w);g.addColorStop(0,'hsl('+(h|0)+','+(sa|0)+'%,'+((li+13)|0)+'%)');g.addColorStop(.5,'hsl('+(h|0)+','+(sa|0)+'%,'+(li|0)+'%)');g.addColorStop(1,'hsl('+((h+8)|0)+','+(sa|0)+'%,'+((li-7)|0)+'%)');x.fillStyle=g;
    x.beginPath();x.moveTo(0,0);x.bezierCurveTo(l*.25,-l*w*1.25,l*.7,-l*w,l,0);x.bezierCurveTo(l*.7,l*w,l*.25,l*w*1.25,0,0);x.fill();
    x.strokeStyle='hsla('+(h|0)+',55%,'+((li+24)|0)+'%,.85)';x.lineWidth=.9;x.beginPath();x.moveTo(1,0);x.lineTo(l*.95,0);x.stroke();x.lineWidth=.45;
    for(let k=1;k<5;k++){const u=k/5*l;x.beginPath();x.moveTo(u,0);x.lineTo(u+l*.13,-l*w*.62*(1-k/6));x.moveTo(u,0);x.lineTo(u+l*.13,l*w*.62*(1-k/6));x.stroke();}x.restore();};
  const twig=(x0,y0,a,L,w,depth)=>{const x1=x0+Math.cos(a)*L,y1=y0+Math.sin(a)*L,m=Math.max(2,L/26|0);
    x.strokeStyle='#33261a';x.lineWidth=w;x.beginPath();x.moveTo(x0,y0);x.lineTo(x1,y1);x.stroke();
    for(let i=1;i<=m;i++){const t=i/m,s=i%2?1:-1;leaf(x0+(x1-x0)*t,y0+(y1-y0)*t,a+s*(.7+r()*.5),30+r()*26);}leaf(x1,y1,a+(r()-.5)*.4,36+r()*22);
    if(depth<2){const k=Math.max(1,L/60|0);for(let i=1;i<=k;i++){const t=i/(k+1),s=i%2?1:-1;twig(x0+(x1-x0)*t,y0+(y1-y0)*t,a+s*(.6+r()*.35),L*(.55-t*.2)*(.8+r()*.4),w*.6,depth+1);}}};
  twig(n/2,n-4,-PI/2+.04,n-70,4,0);
  for(let i=1;i<=6;i++){const t=i/7,s=i%2?1:-1;twig(n/2,n-4-(n-70)*t,-PI/2+s*(.85+r()*.3),(n*.42)*(1-t*.6)*(.8+r()*.35),2.6,1);}
  return ctex(c);
}
/* silhouette d'un arbre entier (lointains) */
function texTreeFar(seed){
  const w=256,h=1024,c=cv(w,h),x=c.getContext('2d'),r=mulberry(seed);
  x.fillStyle='#231a12';x.beginPath();x.moveTo(w/2-7,h);x.lineTo(w/2-2,40);x.lineTo(w/2+2,40);x.lineTo(w/2+7,h);x.fill();
  const top=30,bot=h*(.42+r()*.14);
  for(let y=top;y<bot;y+=9+r()*10){const t=(y-top)/(bot-top),L=(8+t*105)*(.55+r()*.6);
    for(const s of[-1,1]){if(r()<.18)continue;const yy=y+r()*14,droop=10+t*26;
      for(let k=0;k<26;k++){const u=k/26,px=w/2+s*u*L,py=yy+u*u*droop;x.fillStyle='hsla('+(92+r()*30|0)+','+(30+r()*20|0)+'%,'+(9+r()*14|0)+'%,'+(.5+r()*.5).toFixed(2)+')';
        x.beginPath();x.ellipse(px,py+r()*5,3+r()*7*(1-u*.5),2+r()*4,0,0,TAU);x.fill();}}}
  for(let i=0;i<9;i++){const y=bot+r()*(h*.3),s=r()<.5?-1:1;x.strokeStyle='#231a12';x.lineWidth=1.5;x.beginPath();x.moveTo(w/2,y);x.lineTo(w/2+s*(10+r()*34),y-4+r()*14);x.stroke();}
  return ctex(c);
}
/* grappes de fleurs (arbres violets) et pétale */
function texBlossom(){
  const n=512,c=cv(n,n),x=c.getContext('2d'),r=mulberry(7);
  for(let k=0;k<42;k++){const cx=40+r()*(n-80),cy=40+r()*(n-80),R=18+r()*34;
    for(let i=0;i<46;i++){const a=r()*TAU,d=Math.sqrt(r())*R,l=58+r()*26;x.fillStyle='hsla('+(272+r()*34|0)+','+(48+r()*30|0)+'%,'+((l+4)|0)+'%,'+(.75+r()*.25).toFixed(2)+')';
      x.beginPath();x.ellipse(cx+Math.cos(a)*d,cy+Math.sin(a)*d,2.5+r()*3.5,1.8+r()*2.4,r()*PI,0,TAU);x.fill();}}
  return ctex(c);
}
function texGlow(){const c=cv(128,128),x=c.getContext('2d'),g=x.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.2,'rgba(255,255,255,.5)');g.addColorStop(.5,'rgba(255,255,255,.14)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,128,128);return ctex(c);}
/* tuiles du toit, chevrons du dessous, papier des lanternes */
function texTiles(){const n=256,c=cv(n,n),x=c.getContext('2d');x.fillStyle='#1d2a30';x.fillRect(0,0,n,n);
  for(let i=0;i<8;i++){const g=x.createLinearGradient(i*32,0,i*32+32,0);g.addColorStop(0,'#0e161a');g.addColorStop(.35,'#35505a');g.addColorStop(.6,'#22353d');g.addColorStop(1,'#0e161a');x.fillStyle=g;x.fillRect(i*32,0,32,n);}
  x.fillStyle='rgba(0,0,0,.35)';for(let j=0;j<4;j++)x.fillRect(0,j*64,n,5);return ctex(c,{rep:true});}
function texRafters(){const n=256,c=cv(n,n),x=c.getContext('2d');x.fillStyle='#e9e1d0';x.fillRect(0,0,n,n);
  for(let i=0;i<8;i++){const g=x.createLinearGradient(i*32+6,0,i*32+24,0);g.addColorStop(0,'#7a1c12');g.addColorStop(.5,'#c7391f');g.addColorStop(1,'#7a1c12');x.fillStyle=g;x.fillRect(i*32+6,0,18,n);}return ctex(c,{rep:true});}
function texPaper(){const c=cv(64,128),x=c.getContext('2d'),g=x.createLinearGradient(0,0,0,128);g.addColorStop(0,'#ffcf86');g.addColorStop(.5,'#fff0c2');g.addColorStop(1,'#ffb766');x.fillStyle=g;x.fillRect(0,0,64,128);
  x.strokeStyle='rgba(90,40,10,.55)';x.lineWidth=3;x.strokeRect(1.5,1.5,61,125);x.lineWidth=1.5;for(const y of[42,86]){x.beginPath();x.moveTo(0,y);x.lineTo(64,y);x.stroke();}x.beginPath();x.moveTo(32,0);x.lineTo(32,128);x.stroke();return ctex(c);}

/* ═══════════════════════════════════════════════════════════════════════════════
   02 · le terrain : relief, sentier, clairière
   ═══════════════════════════════════════════════════════════════════════════════ */
const SHRINE=V3(0,0,-15),POD_H=1.5;
const pathX=z=>z>-4?1.7*Math.sin(z*.085+.4)*smooth(-4,6,z):0;
function pathD(x,z){return z>-9&&z<44?Math.abs(x-pathX(z)):1e3;}
function clearK(x,z){                                   // 1 dans la clairière (sentier, parvis, sanctuaire), 0 sous la futaie
  const a=1-smooth(1.9,4.4,pathD(x,z)),b=1-smooth(8.5,12.5,Math.hypot((x-SHRINE.x)*.8,z-SHRINE.z+2));
  return Math.max(a,b);}
function groundH(x,z){
  let h=(fbm(x*.035+3.1,z*.035+7.7,4)-.5)*3.4+(fbm(x*.13,z*.13,3)-.5)*.55;
  h+=smooth(10,60,Math.abs(x))*4.5+smooth(-25,-80,z)*6;                      // la forêt remonte sur les côtés et au fond
  const k=1-smooth(1.2,5.5,pathD(x,z)),ks=1-smooth(9,14,Math.hypot(x-SHRINE.x,z-SHRINE.z));
  h=lerp(h,(fbm(x*.2,z*.2,2)-.5)*.12+smooth(30,-6,z)*.9,k);h=lerp(h,.9,ks);
  return h;}
const FOL=[];                                            // matériaux de feuillage (normale tournée vers le soleil : la lumière les traverse)
function foliage(m,trans,wind,cut){
  if(cut){m.userData.cut=m.alphaTest;m.alphaTest=0;}
  m.onBeforeCompile=sh=>{sh.uniforms.uSunV=U.uSunV;sh.uniforms.uTime=U.uTime;
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nuniform vec3 uSunV;uniform float uTime;')
      .replace('#include <defaultnormal_vertex>','#include <defaultnormal_vertex>\ntransformedNormal=normalize(mix(transformedNormal,uSunV,'+trans.toFixed(2)+'));')
      .replace("#include <project_vertex>","vec4 wP=vec4(transformed,1.);\n#ifdef USE_INSTANCING\nwP=instanceMatrix*wP;vec3 wO=instanceMatrix[3].xyz;\n#else\nvec3 wO=modelMatrix[3].xyz;\n#endif\nfloat wPh=wO.x*.61+wO.z*.47,wG=.5+.5*sin(wO.x*.21+wO.z*.14-uTime*1.1)+.35*sin(wO.x*.08-wO.z*.12-uTime*.43),wK=uv.y*uv.y*"+((wind||0)*1.8).toFixed(3)+"*max(wG,.12);\nwP.x+=(.55+.45*sin(uTime*1.7+wPh))*wK+sin(uTime*4.1+wPh*2.3)*wK*.22;wP.z+=(.3+.4*cos(uTime*1.3+wPh*1.7))*wK;\nvec4 mvPosition=modelViewMatrix*wP;gl_Position=projectionMatrix*mvPosition;");
    sh.fragmentShader=sh.fragmentShader.replace('#include <normal_fragment_begin>','#include <normal_fragment_begin>\nnormal=normalize(vNormal);');
    if(cut)sh.fragmentShader=sh.fragmentShader.replace('#include <alphatest_fragment>','if(diffuseColor.a<mix('+m.userData.cut.toFixed(2)+','+(m.userData.cut+cut).toFixed(2)+',smoothstep(10.,75.,length(vViewPosition))))discard;');};
  m.customProgramCacheKey=()=>'fol'+trans+'_'+(wind||0)+'_'+(cut||0)+'_'+(m.userData.cut||0);FOL.push(m);return m;}
function depthMat(map){return new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,map,alphaTest:.4});}

function buildGround(){
  const S=220,N=TIER?260:160,g=new THREE.PlaneGeometry(S,S,N,N);g.rotateX(-PI/2);
  const p=g.attributes.position,col=new Float32Array(p.count*3);
  for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i)-12;p.setZ(i,z);p.setY(i,groundH(x,z));
    const ck=clearK(x,z),pk=1-smooth(.5,1.9,pathD(x,z));col[i*3]=ck;col[i*3+1]=pk*.85;col[i*3+2]=fbm(x*.09+9,z*.09,3);}
  g.setAttribute('color',new THREE.BufferAttribute(col,3));g.computeVertexNormals();
  TEX.ground_moss_n.repeat.set(52,52);const m=new THREE.MeshStandardMaterial({map:TEX.ground_moss,normalMap:TEX.ground_moss_n,roughness:.95,vertexColors:true});m.normalScale.set(.9,.9);
  m.onBeforeCompile=sh=>{sh.uniforms.tLit={value:TEX.ground_litter};
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWP;').replace('#include <begin_vertex>','#include <begin_vertex>\nvWP=(modelMatrix*vec4(position,1.)).xyz;');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform sampler2D tLit;varying vec3 vWP;')
      .replace('#include <map_fragment>',`vec3 moss=texture2D(map,vWP.xz*.22).rgb*vec3(1.25,1.45,.8);vec3 lit=texture2D(tLit,vWP.xz*.3).rgb;
        float k=smoothstep(.38,.62,vColor.b+(lit.r-.2)*.5);vec3 gc=mix(lit*1.15,moss,mix(k*.55,.55+k*.45,vColor.r));
        gc=mix(gc,lit*vec3(2.1,1.85,1.45),vColor.g);diffuseColor.rgb=gc;`)
      .replace('#include <color_fragment>','');};
  const mesh=new THREE.Mesh(g,m);mesh.receiveShadow=true;scene.add(mesh);
}

/* ═══════════════════════════════════════════════════════════════════════════════
   03 · la futaie : grands résineux, lointains, feuillus du sous-bois, fougères, herbe, fleurs, roches
   ═══════════════════════════════════════════════════════════════════════════════ */
const M4=new THREE.Matrix4(),QT=new THREE.Quaternion(),EU=new THREE.Euler(),SC=V3(1,1,1),PS=V3();
function inst(geo,mat,list,o){                            // list : [x,y,z, rx,ry,rz, sx,sy,sz, (r,g,b)]
  o=o||{};const im=new THREE.InstancedMesh(geo,mat,list.length),c=new THREE.Color();
  list.forEach((a,i)=>{EU.set(a[3],a[4],a[5],o.order||'YXZ');QT.setFromEuler(EU);M4.compose(PS.set(a[0],a[1],a[2]),QT,SC.set(a[6],a[7],a[8]));im.setMatrixAt(i,M4);if(a.length>9){c.setRGB(a[9],a[10],a[11]);im.setColorAt(i,c);}});
  im.instanceMatrix.needsUpdate=true;if(im.instanceColor)im.instanceColor.needsUpdate=true;im.castShadow=!!o.cast;im.receiveShadow=o.recv!==false;im.frustumCulled=false;
  if(o.depth)im.customDepthMaterial=o.depth;scene.add(im);return im;}
/* carte (feuillage) : pivot en bas, courbée le long de sa longueur */
function cardGeo(w,l,seg,droop,cup){const g=new THREE.PlaneGeometry(w,l,2,seg);g.translate(0,l/2,0);const p=g.attributes.position;
  for(let i=0;i<p.count;i++){const v=p.getY(i)/l,u=p.getX(i)/w;p.setZ(i,droop*v*v*l+(cup||0)*u*u*w*4);}g.computeVertexNormals();return g;}
let CARD,CARD2;
/* trouées : couloirs laissés libres en direction du soleil, pour que la lumière tombe sur le temple et par flaques sur le sentier */
const WELLS=[[0,-9.2,1.5,5],[-3.5,-14,1.7,6],[2.6,-17,1.5,7],[pathX(26),26,1.9,10],[pathX(15),15,2.1,10],[pathX(4.5),4.5,2.2,10]];
let HIT=null;const DOOR=V3(),ALTAR=V3(),STELE=[];
const STN=[-.622,.783],STL=[[13.5,-14.5],[18.2,-10.2],[22.4,-5.2]];                    // stèles : normale commune, emplacements
const ANIM=[[-14.3,4.8],[-14.4,16.3],[-16.1,15.3],[-14.1,-5.2],[-15.8,-6.2]];
for(const q of STL){for(const t of[0,1.6,3.2,4.8,6.4,8])ANIM.push([q[0]+STN[0]*t,q[1]+STN[1]*t]);for(const u of[-2.4,2.4])for(const t of[0,2.4,5])ANIM.push([q[0]+STN[1]*u+STN[0]*t,q[1]-STN[0]*u+STN[1]*t]);}   // emplacements gardés libres pour les cervidés
const TREES=[];                                          // {x,z,h,r,lean,la} : tous les grands troncs
function buildTrees(){
  /* répartition : dense partout sauf la clairière ; quelques arbres posés à la main pour cadrer la vue */
  const hand=[[5.6,19,.2,2.9],[-6.2,23,-.12,.2],[7.8,6,.13,2.6],[-8.4,9,.05,0],[-4.6,31,.07,.9],[10.5,27,.1,3.3],[-11,-2,.05,1],[9.6,-7,.07,2.4],[-3.8,38,.03,0],[4.9,36,.05,3],[4,-31,.04,2],[-2,-37,.02,0],[11,-25,.05,3],[14,-15,.05,2.5],[.5,-45,.02,0],[-6.5,-41,.03,1],[7.5,-40,.03,2],[-4.4,8.5,.06,.4],[4.3,14.5,.08,2.8],[-3.9,17,.05,.2]];
  for(const a of hand)TREES.push({x:a[0],z:a[1],h:(a[1]<-20?34:27)+rnd()*8,r:.34+rnd()*.2,lean:a[2],la:a[3]});
  let tries=0;const NT=TIER?170:110;
  while(TREES.length<NT&&tries<9000){tries++;const x=(rnd()-.5)*150,z=-95+rnd()*140;
    if(clearK(x,z)>.25||ANIM.some(a=>Math.hypot(a[0]-x,a[1]-z)<2.6))continue;if(WELLS.some(w=>{const sl=Math.hypot(SUN.x,SUN.z),dx=x-w[0],dz=z-w[1],al=(dx*SUN.x+dz*SUN.z)/sl,pe=Math.abs(dx*SUN.z-dz*SUN.x)/sl;return al>w[3]&&al<40&&pe<w[2]+al*.045;}))continue;if(TREES.some(t=>Math.hypot(t.x-x,t.z-z)<(Math.hypot(x,z-10)<45?3.1:5)))continue;
    TREES.push({x,z,h:22+rnd()*15,r:.24+rnd()*.3,lean:(rnd()<.2?.1:.03)*(.4+rnd()),la:rnd()*TAU});}
  /* troncs : cylindre effilé, empattement, écorce */
  const tg=new THREE.CylinderGeometry(.42,1,1,14,10,true);tg.translate(0,.5,0);
  {const p=tg.attributes.position,uv=tg.attributes.uv;for(let i=0;i<p.count;i++){const y=p.getY(i),a=Math.atan2(p.getZ(i),p.getX(i)),fl=1+.75*Math.pow(1-clamp01(y/.07),2.4)*(.75+.35*Math.sin(a*3+1)+.2*Math.sin(a*7));
      const k=(1-y*.58)*fl/(1-y*.58);p.setX(i,p.getX(i)*k+Math.sin(y*4.2)*.8*y);p.setZ(i,p.getZ(i)*k+Math.sin(y*2.6+1.3)*.6*y);uv.setXY(i,uv.getX(i)*2,y*11);}tg.computeVertexNormals();const tc=new Float32Array(p.count*3);for(let i=0;i<p.count;i++){const k=smooth(0,.085,p.getY(i))*(.8+.2*Math.sin(Math.atan2(p.getZ(i),p.getX(i))*2.));tc[i*3]=lerp(.5,1,k);tc[i*3+1]=lerp(.78,1,k);tc[i*3+2]=lerp(.36,1,k);}tg.setAttribute('color',new THREE.BufferAttribute(tc,3));}
  const bark=new THREE.MeshStandardMaterial({map:TEX.bark_rough,normalMap:TEX.bark_rough_n,roughness:.94,color:0x9a8f84});bark.normalScale.set(2.3,2.3);
  const near=[],far=[];
  for(const t of TREES){const d=Math.hypot(t.x,t.z-12);(d<62?near:far).push(t);}
  const trunkList=TREES.map(t=>[t.x,groundH(t.x,t.z)-.25,t.z,t.lean*Math.cos(t.la),rnd()*TAU,t.lean*Math.sin(t.la),t.r,t.h,t.r].concat((()=>{const v=.78+rnd()*.5,w=rnd();return[v*lerp(1,1.2,w),v*lerp(1,.9,w),v*lerp(1,.76,w)];})()));
  {const bt=bark.clone();bt.vertexColors=true;inst(tg,bt,trunkList,{cast:true,order:'XZY'});}
  /* branches mortes sur le fût, comme sur les vrais pins de sous-bois */
  const sg=new THREE.CylinderGeometry(.012,.05,1,5,1,false);sg.translate(0,.5,0);const stubs=[];
  for(const t of near){const n=5+(rnd()*8|0),gy=groundH(t.x,t.z);for(let i=0;i<n;i++){const y=3+rnd()*t.h*.42,a=rnd()*TAU,L=.25+rnd()*rnd()*1.5,rr=t.r*(1-y/t.h*.58)*.9;
      stubs.push([t.x+Math.cos(a)*rr+t.lean*Math.cos(t.la)*0+Math.sin(t.lean*Math.sin(t.la))*0,gy+y,t.z+Math.sin(a)*rr,0,-a+PI/2,0,1,1,1,a,L]);}}
  inst(sg,bark,stubs.map(s=>[s[0],s[1],s[2],PI/2-.6+rnd()*.9,s[4],0,1+rnd(),s[10],1+rnd()]),{cast:false});
  /* houppier : verticilles de rameaux (une carte à plat + une carte de chant) */
  const pine=new THREE.MeshStandardMaterial({map:TEX.pine,alphaTest:.42,side:THREE.DoubleSide,roughness:.8,color:0xc8dca0});foliage(pine,.72,.14,.22);
  const bg=CARD=cardGeo(1,1,3,.16,.05),cards=[],cards2=[],woodL=[],bg2=CARD2=cardGeo(1,1,3,0,0).rotateY(PI/2);
  for(const t of near){const gy=groundH(t.x,t.z),y0=t.h*(.42+rnd()*.16),H=t.h-y0,lx=Math.sin(t.lean*Math.sin(t.la)),lz=-Math.sin(t.lean*Math.cos(t.la));
    for(let y=y0;y<t.h+.8;y+=1.0+rnd()*.7){const tt=(y-y0)/H,L=lerp(5.6,1.2,Math.pow(tt,.8))*(.55+rnd()*.6)*(t.h/30),k=4+(rnd()*3|0),a0=rnd()*TAU;
      for(let i=0;i<k;i++){if(rnd()<.18)continue;const a=a0+i/k*TAU+(rnd()-.5)*.5,pitch=lerp(1.72,1.05,tt)+(rnd()-.5)*.25,cx=t.x-lx*y*0+Math.sin(t.lean*Math.sin(t.la))*y*-1*0,sh=.75+rnd()*.5;
        const px=t.x+(-Math.sin(t.lean*Math.sin(t.la)))*y,pz=t.z+Math.sin(t.lean*Math.cos(t.la))*y;
        if(Math.hypot(t.x,t.z-12)<46)woodL.push([px,gy+y,pz,pitch,a,0,.035+L*.012,L*.82,.035+L*.012]);cards.push([px,gy+y,pz,pitch,a,0,L*.72,L,1,sh*.9,sh,sh*.8]);cards2.push([px,gy+y,pz,pitch,a,0,1,L*.94,L*.6,sh*.8,sh*.95,sh*.7]);}}}
  {const wgeo=new THREE.CylinderGeometry(.22,1,1,5,1,true);wgeo.translate(0,.5,0);inst(wgeo,bark,woodL,{cast:false,order:'YXZ'});}inst(bg,pine,cards,{cast:true,depth:depthMat(TEX.pine),order:'YXZ'});inst(bg2,pine,cards2,{cast:true,depth:depthMat(TEX.pine),order:'YXZ'});
  /* lointains : silhouettes entières, deux plans croisés */
  const fg=new THREE.PlaneGeometry(1,1);fg.translate(0,.5,0);
  for(let v=0;v<2;v++){const tx=texTreeFar(300+v*17),fm=new THREE.MeshStandardMaterial({map:tx,alphaTest:.4,side:THREE.DoubleSide,roughness:1,color:0x9db08a});foliage(fm,.6,.05,.12);
    const L=[];far.forEach((t,i)=>{if(i%2!==v)return;const gy=groundH(t.x,t.z),w=t.h*.34,a=rnd()*PI;L.push([t.x,gy,t.z,0,a,0,w,t.h*1.02,1],[t.x,gy,t.z,0,a+PI/2,0,w,t.h*1.02,1]);});
    /* troisième rideau, tout au fond */
    for(let i=0;i<(TIER?170:90);i++){const a=rnd()*TAU,d=82+rnd()*66,x=Math.cos(a)*d*1.2,z=12+Math.sin(a)*d,h=26+rnd()*16;if(i%2!==v)continue;L.push([x,groundH(x,z)-1,z,0,rnd()*PI,0,h*.34,h,1]);}
    inst(fg,fm,L,{cast:true,depth:depthMat(tx)});}
}
/* feuillus du sous-bois et buissons : amas de cartes de feuillage, très lumineux à contre-jour */
function buildUnderstory(){
  const leaf=new THREE.MeshStandardMaterial({map:TEX.leafb,alphaTest:.4,side:THREE.DoubleSide,roughness:.65,color:0xffffff});foliage(leaf,.82,.1,.2);
  const L=[],L2=[],stems=[];
  const bark=new THREE.MeshStandardMaterial({map:TEX.bark_rough,normalMap:TEX.bark_rough_n,roughness:.95,color:0x6f6558});
  const sg=new THREE.CylinderGeometry(.45,1,1,7,1,true);sg.translate(0,.5,0);
  const branch=(x,y,z,pitch,a,len,tint)=>{const v=.8+rnd()*.45,c=[tint[0]*v,tint[1]*v,tint[2]*v];L.push([x,y,z,pitch,a,0,len*.8,len,1,c[0],c[1],c[2]]);L2.push([x,y,z,pitch,a,0,1,len*.95,len*.7,c[0]*.9,c[1]*.92,c[2]*.9]);};
  /* jeunes arbres : une tige, des rameaux étagés tournés vers la lumière (posés à la main pour encadrer, puis au hasard) */
  const sap=[[-3.6,22,6.5],[3.9,25.5,5],[-5.2,13,8],[6.4,12,7],[-2.9,28.6,3.2],[12,16,9],[-13,18,8.5],[2.6,31.5,2.6]];
  for(let i=0;i<(TIER?46:24);i++){const x=(rnd()-.5)*84,z=-40+rnd()*74;if(clearK(x,z)>.75||TREES.some(t=>Math.hypot(t.x-x,t.z-z)<1.6))continue;if(x>-13&&x<7&&z>-9&&z<10)continue;if(ANIM.some(a=>Math.hypot(a[0]-x,a[1]-z)<2.4))continue;sap.push([x,z,3.5+rnd()*6.5]);}
  for(const s of sap){const gy=groundH(s[0],s[1]),h=s[2],ry=rnd()*TAU;stems.push([s[0],gy-.1,s[1],0,ry,0,.04+h*.009,h*.92,.04+h*.009]);
    const tint=rnd()<.5?[1.05,1.3,.6]:[.8,1.1,.5],nb=(TIER?5:3)*h|0;
    for(let k=0;k<nb;k++){const t=k/nb,y=h*(.28+t*.72),len=(1.9-1.1*t)*(h/7+.35)*(.6+rnd()*.6);branch(s[0],gy+y,s[1],lerp(1.38,.55,t*t)+(rnd()-.5)*.3,rnd()*TAU,len,tint);}}
  /* buissons bas */
  for(let i=0;i<(TIER?90:50);i++){const x=(rnd()-.5)*70,z=-34+rnd()*72;if(pathD(x,z)<1.6||Math.hypot(x-SHRINE.x,z-SHRINE.z)<9.5||(Math.abs(x)<4.6&&z<5&&z>-10)||ANIM.some(a=>Math.hypot(a[0]-x,a[1]-z)<1.8))continue;
    const gy=groundH(x,z),n=5+(rnd()*5|0),sz=.7+rnd()*.9,tint=rnd()<.6?[.85,1.15,.5]:[1.05,1.25,.6];for(let k=0;k<n;k++)branch(x+(rnd()-.5)*.3,gy,z+(rnd()-.5)*.3,.25+rnd()*.95,rnd()*TAU,sz*(.7+rnd()*.6),tint);}
  inst(sg,bark,stems,{cast:true,order:'XZY'});inst(CARD,leaf,L,{cast:true,depth:depthMat(TEX.leafb),order:'YXZ'});inst(CARD2,leaf,L2,{cast:true,depth:depthMat(TEX.leafb),order:'YXZ'});
  /* fougères : touffes de frondes */
  const fern=new THREE.MeshStandardMaterial({map:TEX.fern,alphaTest:.45,side:THREE.DoubleSide,roughness:.75,color:0xcfe890});foliage(fern,.75,.02);
  const fgeo=new THREE.PlaneGeometry(1,.3,6,1);fgeo.translate(.5,0,0);{const p=fgeo.attributes.position;for(let i=0;i<p.count;i++){const u=p.getX(i),w=p.getY(i);p.setXYZ(i,u,Math.sin(u*2.2)*.42-u*u*.3,w);}fgeo.computeVertexNormals();}
  const F=[];for(let i=0;i<(TIER?260:130);i++){const x=(rnd()-.5)*76,z=-36+rnd()*76;if(pathD(x,z)<1.3||Math.hypot(x-SHRINE.x,z-SHRINE.z)<9)continue;const gy=groundH(x,z),n=6+(rnd()*4|0),s=.7+rnd()*.9,a0=rnd()*TAU,v=.7+rnd()*.5;
    for(let k=0;k<n;k++)F.push([x,gy+.02,z,0,a0+k/n*TAU+(rnd()-.5)*.4,.25+rnd()*.5,s,s,s,v*.8,v,v*.6]);}
  inst(fgeo,fern,F,{cast:false,order:'YZX'});
}
/* herbe : touffes de brins effilés, plus drue là où le soleil tombe ; fleurs des bois */
function buildGrass(){
  const pos=[],uv=[],nor=[],idx=[];let vi=0;const B=6,r=mulberry(5);
  for(let b=0;b<B;b++){const a=r()*TAU,d=r()*.16,bx=Math.cos(a)*d,bz=Math.sin(a)*d,h=.2+r()*.3,w=.011+r()*.009,ya=r()*TAU,bend=.08+r()*.26,S=4;
    for(let s=0;s<=S;s++){const v=s/S,ww=w*(1-v*.92),ox=Math.cos(ya)*ww,oz=Math.sin(ya)*ww,fx=-Math.sin(ya)*bend*v*v,fz=Math.cos(ya)*bend*v*v;
      pos.push(bx-ox+fx,v*h,bz-oz+fz,bx+ox+fx,v*h,bz+oz+fz);uv.push(0,v,1,v);nor.push(0,1,0,0,1,0);if(s<S){idx.push(vi,vi+1,vi+3,vi,vi+3,vi+2);}vi+=2;}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));g.setIndex(idx);
  const m=new THREE.MeshStandardMaterial({side:THREE.DoubleSide,roughness:.6,color:0xffffff});foliage(m,.55,.1);
  const base=m.onBeforeCompile;m.onBeforeCompile=sh=>{base(sh);sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying float vH;').replace('#include <begin_vertex>','#include <begin_vertex>\nvH=uv.y;');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying float vH;').replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb*=mix(vec3(.09,.16,.04),vec3(.3,.5,.1),vH*vH*.6+vH*.4);');};
  m.customProgramCacheKey=()=>'grass';
  const L=[],N=[9000,26000,46000][TIER];let tries=0;
  while(L.length<N&&tries<N*6){tries++;const near=rnd()<.62,x=near?(rnd()-.5)*26:(rnd()-.5)*74,z=near?-8+rnd()*42:-34+rnd()*74,ck=clearK(x,z),pd=pathD(x,z);
    if(Math.hypot(x-SHRINE.x,z-SHRINE.z)<8.6&&Math.abs(x)<7.4&&z<-8.6)continue;if(pd<.75&&z<-3)continue;
    const dens=(.16+.84*ck)*(pd<.95?.07:1)*(.35+.65*fbm(x*.3,z*.3,2));if(rnd()>dens)continue;
    const s=(.55+rnd()*.75)*(.75+.5*ck),v=.75+rnd()*.5;L.push([x,groundH(x,z)-.02,z,0,rnd()*TAU,0,s*1.3,s,s*1.3,v*(.9+rnd()*.25),v,v*(.8+rnd()*.3)]);}
  inst(g,m,L,{cast:false});
  /* fleurs : corolles blanches, mauves, quelques coquelicots */
  const fgeo=new THREE.CircleGeometry(.035,6);fgeo.rotateX(-PI/2);const fm=new THREE.MeshStandardMaterial({side:THREE.DoubleSide,roughness:.5});foliage(fm,.8,0);
  const FL=[],pal=[[1.3,1.3,1.2],[1.3,1.3,1.2],[1.3,1.3,1.2],[1.0,.8,1.35],[.95,.7,1.3],[1.5,.2,.12],[1.4,1.15,.3]];
  for(let i=0;i<(TIER?1500:700);i++){const cx=(rnd()-.5)*20,cz=-6+rnd()*38;if(clearK(cx,cz)<.5||pathD(cx,cz)<.8)continue;const c=pal[(rnd()*pal.length)|0],n=1+(rnd()*5|0);
    for(let k=0;k<n;k++){const x=cx+(rnd()-.5)*.9,z=cz+(rnd()-.5)*.9,s=.7+rnd()*.9;FL.push([x,groundH(x,z)+.22+rnd()*.3,z,(rnd()-.5)*.7,rnd()*TAU,(rnd()-.5)*.7,s,s,s,c[0],c[1],c[2]]);}}
  inst(fgeo,fm,FL,{cast:false});
}
function buildRocks(){
  const g=new THREE.SphereGeometry(1,30,22),p=g.attributes.position,uv=[];
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),n=1+(fbm(x*1.1+5+z*.7,y*1.3+z*1.1,3)-.5)*.85;p.setXYZ(i,x*n,y*n*.72,z*n);uv.push(x*.9+z*.4,y*.9+z*.5);}
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.computeVertexNormals();
  const m=new THREE.MeshStandardMaterial({map:TEX.rock,normalMap:TEX.rock_n,roughness:.92,color:0xb9b4ac});
  m.onBeforeCompile=sh=>{sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWN;').replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\n#ifdef USE_INSTANCING\nvWN=normalize(mat3(modelMatrix)*mat3(instanceMatrix)*objectNormal);\n#else\nvWN=normalize(mat3(modelMatrix)*objectNormal);\n#endif');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vWN;').replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb=mix(diffuseColor.rgb,vec3(.13,.2,.05),smoothstep(.25,.75,vWN.y)*.85);');};
  m.customProgramCacheKey=()=>'rockmoss';
  const L=[[-4.2,0,24.6,.9],[-5.4,0,25.6,.5],[2.9,0,20,.45],[3.4,0,8.6,1.05],[-3.3,0,5.4,.7],[-2.2,0,15.5,.3],[6.8,0,1,1.3],[-7.5,0,-3.5,1.6],[1.9,0,28.5,.35]];
  for(let i=0;i<34;i++){const x=(rnd()-.5)*70,z=-35+rnd()*72;if(pathD(x,z)<3.4||Math.hypot(x-SHRINE.x,z-SHRINE.z)<9)continue;L.push([x,0,z,.25+rnd()*rnd()*1.6]);}
  inst(g,m,L.map(a=>[a[0],groundH(a[0],a[2])+a[3]*.12,a[2],(rnd()-.5)*.6,rnd()*TAU,(rnd()-.5)*.6,a[3]*(.8+rnd()*.5),a[3]*(.7+rnd()*.5),a[3]*(.8+rnd()*.5)]),{cast:true});
  /* troncs couchés, souche */
  const bark=new THREE.MeshStandardMaterial({map:TEX.bark_rough,normalMap:TEX.bark_rough_n,roughness:.95,color:0x7d7468});
  const lg=new THREE.CylinderGeometry(.8,1,1,12,1,false);lg.rotateZ(PI/2);{const uv2=lg.attributes.uv;for(let i=0;i<uv2.count;i++)uv2.setXY(i,uv2.getX(i)*2,uv2.getY(i)*5);}
  inst(lg,bark,[[8.2,groundH(8.2,10)+.2,10,0,-1.1,-.03,5,.26,.26],[-9.5,groundH(-9.5,-1)+.3,-1,0,.3,.05,7.5,.4,.4]],{cast:true});
}
/* dalles du sentier : pierres disjointes mangées par l'herbe, puis parvis continu devant le sanctuaire */
function buildPath(){
  const sm=new THREE.MeshStandardMaterial({map:TEX.rock,normalMap:TEX.rock_n,roughness:.9,color:new THREE.Color(2.3,2.2,2.02)});
  const g=new THREE.BoxGeometry(1,1,1),L=[];
  for(let z=33;z>-2.5;z-=.95+rnd()*.5){const n=rnd()<.25?1:2,x0=pathX(z);for(let i=0;i<n;i++){if(rnd()<.06)continue;const w=.7+rnd()*.7,d=.6+rnd()*.5,x=x0+(n===1?0:(i-.5)*1.2)+(rnd()-.5)*.3,zz=z+(rnd()-.5)*.3;
      L.push([x,groundH(x,zz)-.02-rnd()*.03,zz,(rnd()-.5)*.07,(rnd()-.5)*.5,(rnd()-.5)*.07,w,.12,d]);}}
  for(let z=-2.6;z>-8.7;z-=1.02)for(let i=-2;i<=2;i++){const x=i*1.02+((Math.round(z*10)&1)?.25:0);L.push([x,.86,z,0,(rnd()-.5)*.04,0,.98,.14,.98]);}
  inst(g,sm,L,{cast:true});
}

/* ═══════════════════════════════════════════════════════════════════════════════
   04 · le sanctuaire : laque vermillon, toits retroussés, lanternes, torii, arbres en fleurs
   ═══════════════════════════════════════════════════════════════════════════════ */
let PLC=0;const PLN=()=>TIER>0&&PLC++<(TIER>1?9:5);
const VIOLET=[];                                         // houppiers violets : ils teintent les rayons qui les traversent
const LAMPS=[];
/* ombre naturelle sous les toits : plus on s'enfonce sous l'avant-toit, moins le ciel éclaire */
const OCC={v:{value:new THREE.Vector4()},y:{value:0}};
function occl(m){m.onBeforeCompile=sh=>{sh.uniforms.uOc=OCC.v;sh.uniforms.uOy=OCC.y;
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vOW;').replace('#include <project_vertex>','#include <project_vertex>\n#ifdef USE_INSTANCING\nvOW=(modelMatrix*instanceMatrix*vec4(transformed,1.)).xyz;\n#else\nvOW=(modelMatrix*vec4(transformed,1.)).xyz;\n#endif');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vOW;uniform vec4 uOc;uniform float uOy;').replace('#include <lights_fragment_end>','#include <lights_fragment_end>\n{vec2 q=abs(vOW.xz-uOc.xy);float e=min(uOc.z-q.x,uOc.w-q.y),un=smoothstep(uOy+.5,uOy-.5,vOW.y)*smoothstep(-.4,.4,e),oc=mix(1.,mix(.72,.17,smoothstep(0.,3.4,e)),un);reflectedLight.indirectDiffuse*=oc;reflectedLight.indirectSpecular*=oc;}');};
  m.customProgramCacheKey=()=>'occl';return m;}
function mossify(m){m.onBeforeCompile=sh=>{sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWN;').replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\n#ifdef USE_INSTANCING\nvWN=normalize(mat3(modelMatrix)*mat3(instanceMatrix)*objectNormal);\n#else\nvWN=normalize(mat3(modelMatrix)*objectNormal);\n#endif');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vWN;').replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb=mix(diffuseColor.rgb,vec3(.13,.2,.05),smoothstep(.35,.8,vWN.y)*.7);');};m.customProgramCacheKey=()=>'moss2';return m;}
function cloth(m,mode){m.side=THREE.DoubleSide;m.onBeforeCompile=sh=>{sh.uniforms.uTime=U.uTime;sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nuniform float uTime;').replace('#include <begin_vertex>','#include <begin_vertex>\nfloat cw='+(mode?'clamp(-position.y/2.4,0.,1.)':'clamp((position.x-.03)/.62,0.,1.)')+',cp=modelMatrix[3].x*1.7+modelMatrix[3].z;transformed.z+=(sin(uTime*2.1+position.y*2.4+cp)*.09+sin(uTime*3.7+position.y*5.1+cp*2.)*.035)*cw;');};m.customProgramCacheKey=()=>'cloth'+mode;return m;}
function texBanner(bg,fg,ac){const c=cv(128,704),x=c.getContext('2d');x.fillStyle=bg;x.fillRect(0,0,128,704);x.fillStyle=ac;x.fillRect(0,0,128,26);x.fillRect(0,38,128,8);x.fillRect(0,672,128,32);
  x.fillStyle=fg;x.beginPath();x.arc(64,130,44,0,TAU);x.fill();x.fillStyle=bg;for(const y of[112,128,144])x.fillRect(34,y,60,8);
  for(let i=0;i<4;i++){const y=250+i*100;x.fillStyle=fg;x.beginPath();x.moveTo(64,y-34);x.lineTo(96,y);x.lineTo(64,y+34);x.lineTo(32,y);x.fill();x.fillStyle=bg;x.beginPath();x.arc(64,y,9,0,TAU);x.fill();}
  x.globalAlpha=.07;x.fillStyle='#000';for(let y=0;y<704;y+=3)x.fillRect(0,y,128,1);x.globalAlpha=1;return ctex(c);}
function buildShrine(){
  const R=new THREE.Group();R.position.copy(SHRINE);scene.add(R);
  const S=o=>new THREE.MeshStandardMaterial(o),P=o=>new THREE.MeshPhysicalMaterial(o);
  const red=P({color:0xc8321c,roughness:.42,clearcoat:.5,clearcoatRoughness:.35}),redD=P({color:0x8e2014,roughness:.5,clearcoat:.3});
  const gold=S({color:0xe2b24a,roughness:.3,metalness:1,emissive:0x3a2600,emissiveIntensity:.6}),white=S({color:0xf1ead9,roughness:.85});
  const dark=S({map:TEX.wood_cedar,normalMap:TEX.wood_cedar_n,color:0x4a3a30,roughness:.7}),stone=S({map:TEX.rock,normalMap:TEX.rock_n,color:new THREE.Color(1.9,1.84,1.72),roughness:.9});
  const teal=S({color:0x2f8f88,roughness:.5}),paper=new THREE.MeshBasicMaterial({map:texPaper(),color:new THREE.Color(2.6,2.1,1.5),fog:false});
  const bronze=S({color:0x3a2c1c,roughness:.42,metalness:.85}),stoneM=mossify(stone.clone());[red,redD,gold,white,dark,stone,teal].forEach(occl);
  const add=(m,x,y,z,cast)=>{m.position.set(x,y,z);m.castShadow=cast!==false;m.receiveShadow=true;R.add(m);return m;};
  const box=(w,h,d,mt,x,y,z)=>add(new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mt),x,y,z);
  const cyl=(rt,rb,h,mt,x,y,z,s)=>add(new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,s||20),mt),x,y,z);
  const uvS=(m,sc)=>{const g=m.geometry,uv=g.attributes.uv,p=g.attributes.position,n=g.attributes.normal;for(let i=0;i<uv.count;i++){const ax=Math.abs(n.getX(i)),ay=Math.abs(n.getY(i));
      if(ay>.5)uv.setXY(i,p.getX(i)/sc,p.getZ(i)/sc);else if(ax>.5)uv.setXY(i,p.getZ(i)/sc,p.getY(i)/sc);else uv.setXY(i,p.getX(i)/sc,p.getY(i)/sc);}return m;};
  const W=12.4,D=8.4,Y0=.9,YF=Y0+POD_H;OCC.v.value.set(SHRINE.x,SHRINE.z,W/2+2.1,D/2+2.1);OCC.y.value=YF+.3+4.3+.45;                 // podium : de Y0 à YF
  /* podium de pierre à deux assises, escalier, rampes */
  uvS(box(W+2.2,.5,D+2.2,stone,0,Y0+.25,0),2.2);uvS(box(W+1,POD_H-.5,D+1,stone,0,Y0+.5+(POD_H-.5)/2,0),2.2);uvS(box(W+1.3,.14,D+1.3,stone,0,YF+.02,0),2.2);
  const NS=7;for(let i=0;i<NS;i++)uvS(box(4.4,POD_H/NS+.02,.42,stone,0,Y0+POD_H/NS*(i+.5),D/2+.5+(NS-i)*.4),1.6);
  for(const s of[-1,1]){const rail=box(.16,.16,NS*.4+1.0,red,s*2.5,Y0+POD_H/2+1.0,D/2+.5+NS*.2+.25);rail.rotation.x=Math.atan2(POD_H,NS*.4);
    for(let i=0;i<4;i++){const z=D/2+.75+i*(NS*.4-.1)/3,y=Y0+POD_H*(1-i/3.25);box(.18,1.25,.18,red,s*2.5,y+.5,z);cyl(.13,.13,.1,gold,s*2.5,y+1.16,z,10);}
    uvS(box(.5,POD_H*.8,NS*.4+.7,stone,s*2.9,Y0+POD_H*.4,D/2+.5+NS*.2),1.6);}
  /* plancher, colonnes, entretoises, consoles */
  uvS(box(W,.22,D,dark,0,YF+.2,0),1.4);
  const CH=4.3,cx=[-5.5,-3.3,-1.1,1.1,3.3,5.5],cz=[3.6,0,-3.6];
  for(const x of cx)for(const z of cz){if(z===0&&Math.abs(x)<5)continue;cyl(.21,.23,CH,red,x,YF+.3+CH/2,z);cyl(.3,.34,.2,stone,x,YF+.36,z,14);cyl(.25,.25,.16,gold,x,YF+.3+CH-.5,z,14);}
  for(const z of cz){box(W-.3,.3,.24,red,0,YF+.3+CH-.2,z);box(W-.3,.16,.18,teal,0,YF+.3+CH-.62,z);}
  for(const x of[-5.5,5.5]){box(.24,.3,D-1,red,x,YF+.3+CH-.2,0);box(.18,.16,D-1,teal,x,YF+.3+CH-.62,0);}
  for(const x of cx)for(const z of[3.6,-3.6]){box(.5,.16,.5,gold,x,YF+.3+CH+.03,z);box(.9,.2,.3,redD,x,YF+.3+CH+.2,z+(z>0?.25:-.25));}
  /* murs de fond et de côté : panneaux de plâtre blanc, lattis sombre ; garde-corps de la galerie */
  for(let i=0;i<5;i++){box(2.0,CH-1.0,.08,white,-4.4+i*2.2,YF+.3+(CH-1)/2+.5,-3.6,false);box(.07,CH-1,.1,dark,-4.4+i*2.2,YF+.3+(CH-1)/2+.5,-3.55,false);box(2.0,.07,.1,dark,-4.4+i*2.2,YF+.3+CH*.5,-3.55,false);}
  for(const s of[-1,1]){box(.08,CH-1,3.3,white,s*5.5,YF+.3+(CH-1)/2+.5,-1.8,false);box(.1,.07,3.3,dark,s*5.48,YF+.3+CH*.5,-1.8,false);}
  for(const s of[-1,1]){box(W/2-2.4,.1,.1,red,s*(W/4+1.2),YF+1.25,D/2-.1);box(W/2-2.4,.08,.08,red,s*(W/4+1.2),YF+.8,D/2-.1);for(let i=0;i<4;i++)box(.1,1.0,.1,red,s*(2.5+i*1.2),YF+.8,D/2-.1);}
  /* autel au centre (là où reposera l'objet d'économie), rideau, corde sacrée */
  box(2.2,.9,1.0,dark,0,YF+.75,-1.6);box(2.5,.1,1.2,red,0,YF+1.25,-1.6);cyl(.2,.13,.26,gold,0,YF+1.43,-1.6,24);
  const cur=new THREE.PlaneGeometry(6.4,1.5,24,4);{const p=cur.attributes.position;for(let i=0;i<p.count;i++){const y=p.getY(i);p.setZ(i,Math.sin(p.getX(i)*5.2)*.07*(.75-y));}cur.computeVertexNormals();}
  const cm=S({color:0xf4f0ff,roughness:.9,side:THREE.DoubleSide,emissive:0x6a4fa0,emissiveIntensity:.25});foliage(cm,.5,.03);add(new THREE.Mesh(cur,cm),0,YF+.3+CH-1.1,3.72);
  for(const s of[-1,1])box(1.0,1.5,.03,S({color:0x7b4fc4,roughness:.9,side:THREE.DoubleSide}),s*2.2,YF+.3+CH-1.1,3.76,false);
  const rope=[];for(let i=0;i<=20;i++){const u=i/20;rope.push(V3(-3.2+u*6.4,YF+.3+CH-.9-Math.sin(u*PI)*.55,3.95));}
  add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rope),40,.09,8),S({color:0xd9c79a,roughness:1})),0,0,0);
  for(let i=1;i<6;i++){const u=i/6;box(.16,.42,.02,white,-3.2+u*6.4,YF+.3+CH-1.2-Math.sin(u*PI)*.55,3.97,false).rotation.z=.2*(i%2?1:-1);}
  /* toit à quatre versants, concave, aux angles retroussés ; dessous à chevrons ; rive dorée */
  const tiles=texTiles(),raft=texRafters();
  const roof=(W2,D2,Wr,ye,yr,over,lift,cy,ridge)=>{
    const pt=(side,u,v)=>{const hw=lerp(Wr/2,W2/2+over,v),hd=v*(D2/2+over),y=ye+(yr-ye)*Math.pow(1-v,1.9)+lift*Math.pow(Math.abs(u),3)*v*v;
      return side===0?[u*hw,y,hd]:side===1?[u*hw,y,-hd]:side===2?[hw,y,u*hd]:[-hw,y,u*hd];};
    const tm=S({map:tiles,roughness:.45,metalness:.25,color:0xffffff,side:THREE.DoubleSide}),um=occl(S({map:raft,roughness:.7,side:THREE.DoubleSide}));
    for(let side=0;side<4;side++){const nu=28,nv=10,pos=[],uv=[],idx=[];
      for(let j=0;j<=nv;j++)for(let i=0;i<=nu;i++){const u=i/nu*2-1,v=j/nv,p=pt(side,u,v);pos.push(p[0],p[1],p[2]);uv.push((u*.5+.5)*lerp(Wr,W2+over*2,v)*(side<2?1:.55)/1.6,v*3);}
      for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){const a=j*(nu+1)+i,b=a+1,c=a+nu+1,d=c+1;idx.push(a,c,b,b,c,d);}
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();
      add(new THREE.Mesh(g,tm),0,cy,0);const g2=g.clone();const um2=add(new THREE.Mesh(g2,um),0,cy-.16,0,false);um2.scale.set(.985,1,.985);
      const edge=[];for(let i=0;i<=nu;i++){const p=pt(side,i/nu*2-1,1);edge.push(V3(p[0],p[1],p[2]));}
      add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(edge),48,.085,6),gold),0,cy-.05,0,false);add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(edge),48,.14,6),white),0,cy-.2,0,false);}
    /* chevrons : une vraie rangée de bois sous l'avant-toit */
    {const rg=new THREE.BoxGeometry(.08,.11,1),L=[],dm=new THREE.Object3D(),A=V3(),B=V3();
      for(let side=0;side<4;side++){const n=Math.round((side<2?W2+over*2:D2+over*2)/.38);for(let i=0;i<n;i++){const u=(i+.5)/n*2-1,a=pt(side,u*.98,.42),b=pt(side,u*.98,.99);A.set(a[0],a[1]+cy-.27,a[2]);B.set(b[0],b[1]+cy-.27,b[2]);
          dm.position.copy(A).lerp(B,.5);dm.lookAt(B);dm.scale.set(1,1,A.distanceTo(B));dm.updateMatrix();L.push(dm.matrix.clone());}}
      const im=new THREE.InstancedMesh(rg,red,L.length);L.forEach((m,i)=>im.setMatrixAt(i,m));im.receiveShadow=true;im.frustumCulled=false;R.add(im);}
    /* arêtiers et faîtage */
    for(const sx of[-1,1])for(const sz of[-1,1]){const h=[];for(let j=0;j<=10;j++){const p=pt(sz>0?0:1,sx,j/10);h.push(V3(p[0],p[1]+.06,p[2]));}add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(h),24,.13,6),redD),0,cy,0);
      const tip=pt(sz>0?0:1,sx,1);cyl(.02,.14,.7,gold,tip[0]+sx*.1,cy+tip[1]+.3,tip[2]+sz*.1,8);}
    if(ridge){box(Wr+.5,.34,.34,redD,0,cy+yr+.1,0);box(Wr+.7,.1,.46,gold,0,cy+yr+.3,0);for(const s of[-1,1]){const f=box(.14,1.3,.2,gold,s*(Wr/2+.25),cy+yr+.75,0);f.rotation.z=-s*.5;const f2=box(.14,1.3,.2,gold,s*(Wr/2+.25),cy+yr+.75,0);f2.rotation.z=s*.28;}}
  };
  const YE=YF+.3+CH+.45;
  roof(W,D,6.2,0,1.9,2.1,1.05,YE);
  /* étage-lanterne et second toit */
  box(6.0,1.9,3.6,white,0,YE+1.9+.6,0);for(const x of[-3,-1,1,3])for(const z of[-1.8,1.8])cyl(.14,.14,1.9,red,x,YE+1.9+.6,z,12);
  for(const z of[-1.82,1.82])for(let i=0;i<3;i++)box(1.5,1.0,.06,S({color:0x2a1c14,roughness:.6}),-2+i*2,YE+2.6,z,false);
  box(6.5,.22,4.1,red,0,YE+1.9+1.6,0);box(6.4,.18,4.0,red,0,YE+1.55,0);
  roof(6.2,3.8,3.4,0,1.7,1.5,.8,YE+3.75,true);
  /* lanternes de papier suspendues, lanternes de pierre le long du parvis */
  /* lanternes suspendues : chapeau de bronze à six pans, cage de papier à montants, gland — elles se balancent à leur crochet */
  const lcap=new THREE.LatheGeometry([[0,0],[.05,0],[.07,-.05],[.2,-.12],[.33,-.15],[.37,-.12],[.34,-.17],[.2,-.2],[0,-.2]].map(p=>new THREE.Vector2(p[0],p[1])),6);
  const lbody=new THREE.CylinderGeometry(.2,.2,.46,6,1,true),lring=new THREE.CylinderGeometry(.215,.215,.03,6),lpost=new THREE.BoxGeometry(.022,.48,.022),lbot=new THREE.CylinderGeometry(.2,.11,.06,6),ltas=new THREE.ConeGeometry(.04,.16,8,1,true),tasM=S({color:0xb8321e,roughness:.9,side:THREE.DoubleSide});
  const glowM=()=>new THREE.SpriteMaterial({map:TEX.glow,color:0xffb060,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true,opacity:.5,fog:false});
  const lamp=(x,y,z,s,lit)=>{const g=new THREE.Group();g.position.set(x,y,z);g.scale.setScalar(s||1);R.add(g);
    const mk=(geo,mt,py,sh)=>{const o=new THREE.Mesh(geo,mt);o.position.y=py;o.castShadow=sh!==false;g.add(o);return o;};
    mk(new THREE.CylinderGeometry(.012,.012,.4,5),bronze,-.2);mk(lcap,bronze,-.4);mk(lbody,paper,-.83,false);mk(lring,bronze,-.6);mk(lring,bronze,-1.06);mk(lbot,bronze,-1.1);
    for(let i=0;i<6;i++){const o=mk(lpost,bronze,-.83,false);o.position.x=Math.cos(i*PI/3+PI/6)*.205;o.position.z=Math.sin(i*PI/3+PI/6)*.205;}
    mk(new THREE.CylinderGeometry(.007,.007,.14,4),tasM,-1.2,false);mk(ltas,tasM,-1.34,false);
    const sp=new THREE.Sprite(glowM());sp.scale.setScalar(2);sp.position.y=-.83;g.add(sp);
    let pl=null;if(lit&&PLN()){pl=new THREE.PointLight(0xffa858,14,10,2);pl.position.set(x,y-1,z+.25);R.add(pl);}LAMPS.push({sp,pl,ph:rnd()*TAU,g,amp:.045+rnd()*.04});return g;};
  for(const x of[-4.4,-2.2,2.2,4.4])lamp(x,YF+.3+CH-.32,4.25,1,true);
  for(const x of[-4.4,4.4])lamp(x,YF+.3+CH-.3,-.6,1.15,false);
  /* lanternes de pierre : socle à degrés, fût bagué, foyer à six pans, chapeau retroussé couvert de mousse */
  const toro=(x,z,s,lit)=>{const g=new THREE.Group(),y=groundH(SHRINE.x+x,SHRINE.z+z);g.position.set(x,y-.03,z);g.scale.setScalar(s);g.rotation.y=rnd()*.5;R.add(g);
    const L=(pts,seg,mt,py)=>{const o=new THREE.Mesh(new THREE.LatheGeometry(pts.map(p=>new THREE.Vector2(p[0],p[1])),seg),mt);o.position.y=py;o.castShadow=o.receiveShadow=true;g.add(o);return o;};
    L([[0,0],[.4,0],[.42,.08],[.3,.14],[.3,.2],[.2,.26],[.14,.3]],6,stoneM,0);L([[.13,0],[.115,.35],[.15,.4],[.115,.45],[.13,.8],[.2,.86]],14,stoneM,.3);L([[0,0],[.2,0],[.34,.1],[.36,.16],[0,.16]],6,stoneM,1.16);
    const f=new THREE.Mesh(new THREE.CylinderGeometry(.2,.2,.34,6,1,true),paper);f.position.y=1.49;g.add(f);
    for(let i=0;i<6;i++){const c=new THREE.Mesh(new THREE.BoxGeometry(.055,.36,.055),stoneM);c.position.set(Math.cos(i*PI/3+PI/6)*.215,1.49,Math.sin(i*PI/3+PI/6)*.215);c.castShadow=true;g.add(c);}
    L([[0,.34],[.07,.3],[.16,.14],[.36,.04],[.52,0],[.6,.07],[.58,-.01],[.3,-.04],[0,-.04]],6,stoneM,1.68);L([[0,0],[.07,.02],[.1,.1],[.06,.18],[0,.24]],10,stoneM,2.0);
    const sp=new THREE.Sprite(glowM());sp.scale.setScalar(1.7);sp.position.y=1.49;g.add(sp);
    let pl=null;if(lit&&PLN()){pl=new THREE.PointLight(0xffa858,9,7.5,2);pl.position.set(x,y+1.5*s,z);R.add(pl);}LAMPS.push({sp,pl,ph:rnd()*TAU});};
  [[-3.1,7.4],[3.1,7.4],[-3.1,10.6],[3.1,10.6],[-3.3,13.8],[3.3,13.8]].forEach((p,i)=>toro(p[0],p[1],1,i<4));
  toro(-7.6,5.4,1.25,false);toro(7.6,5.4,1.25,false);
  /* torii : deux fûts inclinés, linteau relevé aux extrémités, entretoise, tablette */
  const torii=(x,z,ry,s)=>{const g=new THREE.Group();g.position.set(x,groundH(x,z),z);g.rotation.y=ry;g.scale.setScalar(s);scene.add(g);
    const m=(geo,mt,px,py,pz,rz)=>{const o=new THREE.Mesh(geo,mt);o.position.set(px,py,pz);if(rz)o.rotation.z=rz;o.castShadow=o.receiveShadow=true;g.add(o);return o;};
    for(const sx of[-1,1]){m(new THREE.CylinderGeometry(.2,.25,5.4,18),red,sx*2.25,2.7,0,sx*.035);m(new THREE.CylinderGeometry(.34,.38,.5,18),S({color:0x1c1c20,roughness:.6}),sx*2.34,.25,0);}
    const N=24,top=[],cap=[];for(let i=0;i<=N;i++){const u=i/N*2-1;top.push(V3(u*3.5,5.5+Math.pow(Math.abs(u),2.6)*.42,0));cap.push(V3(u*3.72,5.82+Math.pow(Math.abs(u),2.6)*.5,0));}
    const tg=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(top),40,.24,10);tg.scale(1,1,.9);m(tg,red,0,0,0);
    const cg=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cap),40,.2,8);cg.scale(1,.7,1.5);m(cg,S({color:0x15161a,roughness:.5,metalness:.2}),0,1.72,0);
    m(new THREE.BoxGeometry(5.4,.3,.24),red,0,4.35,0);m(new THREE.BoxGeometry(.5,.82,.12),S({color:0x15161a,roughness:.5}),0,4.92,0);m(new THREE.BoxGeometry(.4,.7,.14),gold,0,4.92,0);
    for(const sx of[-1,1])m(new THREE.BoxGeometry(.12,.3,.3),gold,sx*2.4,4.35,0);};
  torii(pathX(9),9,0,1.15);
  /* ── mobilier : ce qui fait qu'un sanctuaire est habité ── */
  const F=YF+.31,BT=YF+.3+CH,AT=YF+1.3;
  const wood=occl(S({map:TEX.wood_cedar,normalMap:TEX.wood_cedar_n,color:0x9a7a56,roughness:.65})),straw=occl(S({color:0xd8c38e,roughness:.95})),lac=occl(P({color:0x16100e,roughness:.25,clearcoat:.8})),cush=occl(S({color:0x6b3fa8,roughness:.9})),bamboo=S({color:0x9aa857,roughness:.5});
  {const c=cv(256,256),x=c.getContext('2d');x.fillStyle='#2a1a12';x.fillRect(0,0,256,256);x.strokeStyle='#8e2014';x.lineWidth=14;x.strokeRect(0,0,256,256);x.strokeStyle='#d9a93c';x.lineWidth=3;x.strokeRect(9,9,238,238);x.fillStyle='#d9a93c';x.beginPath();x.arc(128,128,16,0,TAU);x.fill();
    const t=ctex(c,{rep:true});t.repeat.set(10,7);box(W-.4,.06,D-.4,occl(S({map:t,roughness:.6})),0,BT+.34,0).castShadow=false;}                     // plafond à caissons
  box(1.5,.55,.7,wood,0,F+.28,2.7);for(let i=0;i<9;i++)box(.07,.05,.72,lac,-.64+i*.16,F+.58,2.7);for(const sx of[-1,1])for(const sz of[-1,1])box(.1,.58,.1,gold,sx*.72,F+.29,2.7+sz*.32);   // tronc à offrandes
  {const g=new THREE.Group();g.position.set(0,BT-.35,3.3);R.add(g);const bell=new THREE.Mesh(new THREE.SphereGeometry(.17,16,12),gold);bell.scale.y=.85;bell.position.y=-.1;g.add(bell);
    const r1=S({color:0xb8321e,roughness:.9}),r2=S({color:0xe8dcc0,roughness:.9});for(let i=0;i<14;i++){const sg=new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,.16,8),i%2?r1:r2);sg.position.y=-.34-i*.155;sg.castShadow=true;g.add(sg);}
    const ts=new THREE.Mesh(new THREE.ConeGeometry(.09,.3,10),r1);ts.position.y=-2.62;g.add(ts);SWING.push({g,ph:1.3,amp:.03});}                                    // cloche et corde tressée
  for(const sx of[-1,1]){cyl(.02,.05,.8,gold,sx*.95,AT+.4,-1.6,8);cyl(.028,.028,.16,white,sx*.95,AT+.88,-1.6,8);const fl=new THREE.Sprite(glowM());fl.scale.setScalar(.4);fl.position.set(sx*.95,AT+1.02,-1.6);R.add(fl);LAMPS.push({sp:fl,pl:null,ph:rnd()*TAU,base:.95});
    box(.5,.04,.3,lac,sx*.5,AT+.02,-1.3);for(let i=0;i<3;i++){const fr=new THREE.Mesh(new THREE.SphereGeometry(.055,10,8),S({color:sx>0?0xe08a2a:0xd9c84a,roughness:.6}));add(fr,sx*.5-.1+i*.1,AT+.1,-1.3+(i%2)*.05);}}
  if(TIER>0){const pl=new THREE.PointLight(0xffb070,18,11,2);pl.position.set(0,F+2.3,-.4);R.add(pl);}
  {const c=cv(1024,400),x=c.getContext('2d'),r=mulberry(77),g=x.createLinearGradient(0,0,0,400);g.addColorStop(0,'#e0b44e');g.addColorStop(1,'#b98a2c');x.fillStyle=g;x.fillRect(0,0,1024,400);
    x.strokeStyle='rgba(120,80,10,.22)';for(let i=0;i<1024;i+=57)x.strokeRect(i,0,57,400);for(let j=0;j<400;j+=57){x.beginPath();x.moveTo(0,j);x.lineTo(1024,j);x.stroke();}
    for(const m of[['#34506a',250,110],['#1f3a4a',300,80],['#15301f',350,50]]){x.fillStyle=m[0];x.beginPath();x.moveTo(0,400);for(let i=0;i<=1024;i+=16)x.lineTo(i,m[1]-m[2]*Math.pow(fbm(i*.006+m[1],1.3,3),1.5)*1.6+m[2]*.3);x.lineTo(1024,400);x.fill();}
    x.fillStyle='rgba(240,205,120,.9)';for(let k=0;k<7;k++){const cx=r()*1024,cy=60+r()*200;for(let i=0;i<6;i++){x.beginPath();x.ellipse(cx+i*34-80,cy+(r()-.5)*14,46,13,0,0,TAU);x.fill();}}
    x.fillStyle='#b3261a';x.beginPath();x.arc(790,95,46,0,TAU);x.fill();
    const sm=occl(S({map:ctex(c),roughness:.45,metalness:.3,side:THREE.DoubleSide}));
    for(let i=0;i<6;i++){const pg=new THREE.PlaneGeometry(.92,2.3),uv=pg.attributes.uv;for(let k=0;k<uv.count;k++)uv.setX(k,(i+uv.getX(k))/6);add(new THREE.Mesh(pg,sm),-2.1+i*.84,F+1.2,-3.12).rotation.y=(i%2?1:-1)*.42;}
    box(5.3,.06,.5,lac,0,F+.03,-3.12);}                                                                                                                         // paravent à fond d'or
  {const c=cv(128,128),x=c.getContext('2d');x.fillStyle='#efe6d2';x.fillRect(0,0,128,128);x.fillStyle='#b3261a';x.beginPath();x.arc(64,56,30,0,TAU);x.fill();x.fillStyle='#16100e';x.fillRect(20,100,88,10);x.fillRect(56,28,16,58);
    const lm=occl(S({map:ctex(c),roughness:.8})),brl=(bx,by,bz)=>{cyl(.33,.33,.62,straw,bx,by,bz,18);add(new THREE.Mesh(new THREE.PlaneGeometry(.42,.42),lm),bx,by,bz+.335,false);for(const yy of[-.2,.2])add(new THREE.Mesh(new THREE.TorusGeometry(.335,.018,6,24),wood),bx,by+yy,bz,false).rotation.x=PI/2;};
    for(let i=0;i<3;i++)brl(3.2+i*.7,F+.31,-2.7);for(let i=0;i<2;i++)brl(3.55+i*.7,F+.93,-2.7);}                                                                 // tonneaux de saké offerts
  box(1.4,.06,.7,lac,-3.9,F+.34,-2.5);for(const sx of[-1,1])for(const sz of[-1,1])box(.06,.32,.06,lac,-3.9+sx*.62,F+.16,-2.5+sz*.28);
  for(const q of[[-4.5,-1.5],[-3.4,-1.45],[-3.95,-1.1]])box(.55,.1,.55,cush,q[0],F+.05,q[1]).rotation.y=rnd();
  {const v=new THREE.Mesh(new THREE.LatheGeometry([[0,0],[.1,0],[.14,.1],[.1,.3],[.05,.38],[.07,.42]].map(q=>new THREE.Vector2(q[0],q[1])),14),occl(S({color:0x2f8f88,roughness:.3})));add(v,-3.9,F+.37,-2.5);
    for(let i=0;i<4;i++){const tw=cyl(.006,.01,.9,wood,-3.9+(i-1.5)*.05,F+1.15,-2.5,5);tw.rotation.z=(i-1.5)*.22;tw.rotation.x=(rnd()-.5)*.4;const b=new THREE.Mesh(new THREE.SphereGeometry(.05,8,6),S({color:0xc9a0f0,roughness:.6}));add(b,-3.9+(i-1.5)*.16,F+1.5+rnd()*.12,-2.5+(rnd()-.5)*.2,false);}}
  /* dehors : râtelier d'ex-voto, bassin d'ablution, brûle-parfum, bannières */
  {const x0=5.9,z0=8.2,gy=groundH(x0,SHRINE.z+z0);for(const sx of[-1,1])box(.1,2,.1,wood,x0+sx,gy+1,z0);for(const yy of[.9,1.3,1.7])box(2.1,.05,.05,wood,x0,gy+yy,z0);box(2.5,.06,.6,dark,x0,gy+2.05,z0);
    const EL=[];for(const yy of[.82,1.22,1.62])for(let i=0;i<12;i++){if(rnd()<.12)continue;EL.push([x0-.9+i*.165+(rnd()-.5)*.02,gy+yy-.02,SHRINE.z+z0+.04+rnd()*.03,(rnd()-.5)*.25,(rnd()-.5)*.5,(rnd()-.5)*.2,1,1,1,1.1+rnd()*.3,.85+rnd()*.25,.55+rnd()*.2]);}
    inst(new THREE.BoxGeometry(.15,.11,.012),S({color:0xd9b88a,roughness:.8}),EL,{cast:false});}
  {const x0=-5.9,z0=8.3,gy=groundH(x0,SHRINE.z+z0);uvS(box(1.5,.7,.9,stoneM,x0,gy+.35,z0),1.2);box(1.2,.02,.62,P({color:0x0c2a2c,roughness:.04,clearcoat:1}),x0,gy+.705,z0).castShadow=false;
    cyl(.035,.035,1.3,bamboo,x0-.35,gy+.65,z0-.5,8);const sp=cyl(.028,.028,.6,bamboo,x0-.1,gy+1.2,z0-.38,8);sp.rotation.z=PI/2;sp.rotation.y=-.45;
    for(const k of[-.2,.2]){const l=cyl(.012,.012,.62,bamboo,x0+k,gy+.76,z0+.02,6);l.rotation.x=PI/2;cyl(.05,.045,.07,bamboo,x0+k,gy+.77,z0+.3,10);}}
  {const x0=2.3,z0=9.8,gy=groundH(x0,SHRINE.z+z0),lg=q=>new THREE.LatheGeometry(q.map(a=>new THREE.Vector2(a[0],a[1])),18);
    add(new THREE.Mesh(lg([[0,0],[.26,0],[.3,.06],[.12,.12],[.1,.34],[.34,.46],[.42,.66],[.38,.74],[.3,.74]]),bronze),x0,gy,z0);add(new THREE.Mesh(lg([[.3,0],[.34,.04],[.2,.16],[.05,.22],[.06,.3],[0,.32]]),bronze),x0,gy+.74,z0);
    for(let i=0;i<7;i++){const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:TEX.glow,color:0xcfd4d8,depthWrite:false,transparent:true,opacity:0,fog:false}));scene.add(sp);SMOKE.push({sp,o:i/7,x:SHRINE.x+x0,y:gy+1.0,z:SHRINE.z+z0});}}
  {const NB=[cloth(S({map:texBanner('#b5301c','#f3ead6','#e0b040'),roughness:.9}),0),cloth(S({map:texBanner('#f1ead9','#6b3fa8','#b5301c'),roughness:.9}),0),cloth(S({map:texBanner('#27304f','#e0b040','#f1ead9'),roughness:.9}),0)];
    const nob=(x,z,ci)=>{const g=new THREE.Group();g.position.set(x,groundH(x,z),z);g.rotation.y=(rnd()-.5)*.5;scene.add(g);const pole=new THREE.Mesh(new THREE.CylinderGeometry(.03,.04,4.6,8),lac);pole.position.y=2.3;pole.castShadow=true;g.add(pole);
      const bar=new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,.7,6),lac);bar.rotation.z=PI/2;bar.position.set(.33,4.45,0);g.add(bar);const cg=new THREE.PlaneGeometry(.62,3.4,5,22);cg.translate(.34,2.72,0);const c=new THREE.Mesh(cg,NB[ci]);c.castShadow=c.receiveShadow=true;g.add(c);};
    [[-3.2,4],[11.6,3.7]].forEach((q,i)=>{nob(pathX(q[0])-q[1],q[0],i%3);nob(pathX(q[0])+q[1],q[0],(i+1)%3);});
    const hb=cloth(S({map:texBanner('#6b3fa8','#f3ead6','#e0b040'),roughness:.9}),1);for(const sx of[-1,1]){const cg=new THREE.PlaneGeometry(.5,2.4,3,14);cg.translate(0,-1.2,0);add(new THREE.Mesh(cg,hb),sx*5.5,BT-.75,4.05);}}
  {const PL=[];for(let i=0;i<(TIER?800:350);i++){const x=(rnd()-.5)*13,z=SHRINE.z-4+rnd()*17,lz=z-SHRINE.z;let y;if(Math.abs(x)<W/2&&Math.abs(lz)<D/2)y=F+.012;else if(lz>D/2+3.4&&Math.abs(x)<2.5)y=.945;else continue;const h=rnd();
      PL.push([x,y,z,0,rnd()*TAU,0,1+rnd(),1,1+rnd()*1.5,lerp(.6,1.2,h),lerp(.4,.6,h),lerp(1.1,.95,h)]);}
    const pg=new THREE.CircleGeometry(.03,5);pg.rotateX(-PI/2);inst(pg,S({roughness:.6,side:THREE.DoubleSide}),PL,{cast:false});}                                // pétales tombés sur le plancher et le parvis
  /* ── le sanctuaire se clique : la L1 ouvre alors la salle de cours japonaise ── */
  HIT=new THREE.Mesh(new THREE.BoxGeometry(W+3,9.5,D+3),new THREE.MeshBasicMaterial({colorWrite:false,depthWrite:false}));HIT.position.set(SHRINE.x,YF+4.2,SHRINE.z);scene.add(HIT);
  DOOR.set(0,F+1.6,SHRINE.z+3.4);ALTAR.set(0,F+1.4,SHRINE.z-2.6);
  /* ── stèles de statistiques : trois dalles dressées ; la L1 y projette ses panneaux (vue d'ensemble, activité, analyse) ── */
  {const por=innerWidth/innerHeight<.9,SW=por?2.9:5.3,SH=por?4.6:3.05,PW=por?2.5:4.9,PH=por?PW*7.1/4.8:PW*4.8/10.16,PY=por?.35:.3,slate=S({color:0x0b0d0e,roughness:.55});
    STL.forEach((q,i)=>{const gy=groundH(q[0],q[1]),g=new THREE.Group();g.position.set(q[0]-SHRINE.x,gy-.1,q[1]-SHRINE.z);g.rotation.y=Math.atan2(STN[0],STN[1]);R.add(g);
      const sg=new THREE.BoxGeometry(SW,SH,.44,16,12,2),p=sg.attributes.position;for(let k=0;k<p.count;k++){const x=p.getX(k),y=p.getY(k)+SH/2,t=y/SH,tp=1-.08*t*t-.2*smooth(.86,1,t)*Math.abs(x)/(SW/2);
        p.setXYZ(k,x*tp+(vnoise(y*2+i*7,x*3)-.5)*.09,y+(vnoise(x*2+i,5)-.5)*.16*t,p.getZ(k)*(1-.2*t)+(vnoise(x*2,y*2+i*3)-.5)*.06);}sg.computeVertexNormals();
      const m=new THREE.Mesh(sg,stoneM);m.position.y=.3;m.castShadow=m.receiveShadow=true;g.add(m);const pl=new THREE.Mesh(new THREE.BoxGeometry(SW+.5,.36,.95),stoneM);pl.position.y=.16;pl.castShadow=pl.receiveShadow=true;g.add(pl);
      const pn=new THREE.Mesh(new THREE.PlaneGeometry(PW+.14,PH+.14),slate);pn.position.set(0,.3+PY+PH/2,.24);g.add(pn);
      const y0=.3+PY,y1=y0+PH;STELE.push({g,c:[V3(-PW/2,y1,.25),V3(PW/2,y1,.25),V3(PW/2,y0,.25),V3(-PW/2,y0,.25)],x:q[0],z:q[1],cy:gy-.1+y0+PH/2,pw:PW,ph:PH});});
    toro(STL[0][0]+STN[0]*1.6+STN[1]*-3.4-SHRINE.x,STL[0][1]+STN[1]*1.6-STN[0]*-3.4-SHRINE.z,1,true);toro(STL[2][0]+STN[0]*1.6+STN[1]*3.4-SHRINE.x,STL[2][1]+STN[1]*1.6-STN[0]*3.4-SHRINE.z,1,true);
    toro((STL[0][0]+STL[1][0])/2+STN[0]*.4-SHRINE.x,(STL[0][1]+STL[1][1])/2+STN[1]*.4-SHRINE.z,.9,false);toro((STL[1][0]+STL[2][0])/2+STN[0]*.4-SHRINE.x,(STL[1][1]+STL[2][1])/2+STN[1]*.4-SHRINE.z,.9,false);}
  /* arbres en fleurs : tronc tors, charpentières, houppier de grappes violettes, pétales qui tombent */
  const bl=new THREE.MeshStandardMaterial({map:TEX.blossom,alphaTest:.35,side:THREE.DoubleSide,roughness:.6,color:0xffffff,emissive:0x5a2f9a,emissiveIntensity:.08});foliage(bl,.85,.09,.2);
  const bgeo=cardGeo(1,1,2,.1,.07);bgeo.translate(0,-.5,0);const BL=[],bark=S({map:TEX.bark_rough,normalMap:TEX.bark_rough_n,color:0x4a3f3a,roughness:.9});
  const vtree=(x,z,h,sp)=>{const gy=groundH(x,z),a0=rnd()*TAU,pts=[];for(let i=0;i<=6;i++){const u=i/6;pts.push(V3(x+Math.sin(u*2.4+a0)*.5*u,gy-.2+u*h*.62,z+Math.cos(u*1.9+a0)*.45*u));}
    const tr=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),20,.3,9),bark);tr.castShadow=true;{const p=tr.geometry.attributes.position,c=tr.geometry.parameters;}scene.add(tr);
    const topP=pts[6],cy=gy+h*.8;
    for(let k=0;k<6;k++){const a=k/6*TAU+rnd(),e=V3(x+Math.cos(a)*sp*.6,cy+(rnd()-.3)*h*.12,z+Math.sin(a)*sp*.6),br=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([topP,topP.clone().lerp(e,.5).add(V3(0,h*.08,0)),e]),10,.09,6),bark);br.castShadow=true;scene.add(br);
      for(let i=0;i<(TIER?44:26);i++){const aa=rnd()*TAU,ph=Math.acos(1-rnd()*1.7),d=sp*.5*(.3+rnd()*.7),s=.8+rnd()*.8,v=.85+rnd()*.4;
        const hue=rnd();BL.push([e.x+Math.sin(ph)*Math.cos(aa)*d,e.y+Math.cos(ph)*d*.55-rnd()*.5,e.z+Math.sin(ph)*Math.sin(aa)*d,(rnd()-.5)*1.5,rnd()*TAU,(rnd()-.5)*1.2,s,s*1.15,1,v*lerp(.9,1.3,hue),v*lerp(.9,.8,hue),v*lerp(1.1,.95,hue)]);}}
    VIOLET.push(new THREE.Vector4(x,cy,z,sp));};
  vtree(-6.4,3.5,8.5,4.4);vtree(-9.6,-6.5,10.5,5.2);vtree(9.8,-8.5,11.5,5.6);vtree(-7.2,-23,13,6.2);vtree(8.4,-22,12,5.8);
  inst(bgeo,bl,BL,{cast:true,depth:depthMat(TEX.blossom),order:'YXZ'});
  const NP=TIER?420:200,pp=new Float32Array(NP*3),ps=new Float32Array(NP*4);for(let i=0;i<NP;i++){const v=VIOLET[i%VIOLET.length];pp[i*3]=v.x+(rnd()-.5)*v.w*2.6;pp[i*3+1]=0;pp[i*3+2]=v.z+(rnd()-.5)*v.w*2.6+2;for(let k=0;k<4;k++)ps[i*4+k]=rnd();}
  const pg=new THREE.BufferGeometry();pg.setAttribute('position',new THREE.BufferAttribute(pp,3));pg.setAttribute('aS',new THREE.BufferAttribute(ps,4));
  const pm=new THREE.ShaderMaterial({uniforms:{uTime:U.uTime,uPx:{value:300}},transparent:true,depthWrite:false,
    vertexShader:`attribute vec4 aS;uniform float uTime,uPx;varying float vA;varying float vR;void main(){float t=fract(aS.x+uTime*(.035+aS.y*.03));vec3 p=position;p.y=1.+13.*(1.-t);p.x+=sin(t*9.+aS.z*6.28)*1.1+t*2.2;p.z+=cos(t*7.+aS.w*6.28)*.9+t*1.5;
      vA=smoothstep(0.,.08,t)*smoothstep(1.,.9,t);vR=aS.w*6.28+uTime*(1.+aS.z*2.);vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=uPx*(.022+.03*aS.z)/max(.8,-mv.z);}`,
    fragmentShader:`varying float vA;varying float vR;void main(){vec2 q=gl_PointCoord-.5;float c=cos(vR),s=sin(vR);q=vec2(q.x*c-q.y*s,q.x*s+q.y*c);float d=length(q*vec2(1.,2.1));if(d>.5)discard;gl_FragColor=vec4(mix(vec3(.5,.32,.8),vec3(.86,.7,.98),smoothstep(.5,0.,d)),vA*.9);}`});
  const petals=new THREE.Points(pg,pm);petals.frustumCulled=false;scene.add(petals);U.uPx=pm.uniforms.uPx;
}

/* ── la vie : cerf, biches et faon à contre-jour, oiseaux qui traversent les trouées, papillons dans les flaques de soleil ── */
const LIFE=[];let DT=.016,RUNNING=false;
function buildAnimals(){
  const FUR=new THREE.MeshStandardMaterial({color:0x7a5638,roughness:.92}),DK=new THREE.MeshStandardMaterial({color:0x1c1612,roughness:.6}),BONE=new THREE.MeshStandardMaterial({color:0xcbb99a,roughness:.7});
  const SG=new THREE.SphereGeometry(1,18,12),YY=V3(0,1,0),CR=[];
  const seg=(par,a,b,r1,r2,mt)=>{const d=b.clone().sub(a),m=new THREE.Mesh(new THREE.CylinderGeometry(r2,r1,d.length(),9),mt||FUR);m.position.copy(a).addScaledVector(d,.5);m.quaternion.setFromUnitVectors(YY,d.clone().normalize());m.castShadow=true;par.add(m);return m;};
  const blob=(par,x,y,z,sx,sy,sz,mt)=>{const m=new THREE.Mesh(SG,mt||FUR);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;par.add(m);return m;};
  const SL=Math.hypot(SUN.x,SUN.z),FX=SUN.x/SL,FZ=SUN.z/SL,RYF=Math.atan2(-FZ,FX);       // ils fuient vers la lumière, le long de la trouée
  const deer=(x,z,ry,s,stag,graze,trig,grp)=>{const g=new THREE.Group(),b=new THREE.Group();g.position.set(x,groundH(x,z)-.02,z);g.rotation.y=ry;g.scale.setScalar(s);scene.add(g);g.add(b);
    blob(b,0,1.02,0,.56,.27,.2);blob(b,.3,.99,0,.26,.3,.21);blob(b,-.32,1.03,0,.27,.275,.21);blob(b,.47,1.1,0,.16,.17,.13);blob(b,-.62,1.12,0,.07,.1,.05,BONE);
    const legs=[];for(const sz of[-1,1]){const zf=sz*.1,f=new THREE.Group(),h=new THREE.Group();f.position.set(.36,.98,zf);h.position.set(-.4,1,zf);b.add(f,h);
      seg(f,V3(0,0,0),V3(.02,-.48,0),.07,.038);seg(f,V3(.02,-.48,0),V3(0,-.91,0),.034,.026);seg(f,V3(0,-.91,0),V3(.01,-.98,0),.03,.034,DK);
      seg(h,V3(0,0,0),V3(-.1,-.48,0),.085,.04);seg(h,V3(-.1,-.48,0),V3(-.04,-.93,0),.034,.026);seg(h,V3(-.04,-.93,0),V3(-.03,-1,0),.03,.034,DK);legs.push(f,h);}
    const nk=new THREE.Group();nk.position.set(.5,1.14,0);nk.rotation.z=graze?-.9:.95;b.add(nk);seg(nk,V3(-.06,-.04,0),V3(.52,0,0),.15,.085);
    const hd=new THREE.Group();hd.position.set(.54,0,0);nk.add(hd);blob(hd,.07,.02,0,.13,.09,.078);seg(hd,V3(.12,0,0),V3(.3,-.035,0),.06,.036);blob(hd,.31,-.035,0,.035,.03,.03,DK);
    const ears=[];for(const sz of[-1,1]){const e=new THREE.Mesh(new THREE.ConeGeometry(.04,.16,6),FUR);e.position.set(-.02,.1,sz*.075);e.rotation.x=sz*.9;e.rotation.z=.35;hd.add(e);ears.push(e);
      if(stag){const c=[V3(0,.09,sz*.04),V3(-.06,.3,sz*.14),V3(-.02,.52,sz*.24),V3(.1,.68,sz*.26),V3(.22,.74,sz*.2)],t=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(c),16,.016,6),BONE);t.castShadow=true;hd.add(t);
        seg(hd,c[1],V3(.12,.36,sz*.2),.014,.006,BONE);seg(hd,c[2],V3(.14,.6,sz*.34),.013,.006,BONE);seg(hd,c[3],V3(.08,.86,sz*.3),.012,.005,BONE);}}
    CR.push({g,b,nk,hd,ears,legs,ph:rnd()*TAU,graze,trig,grp,hx:x,hz:z,ry,st:0,tm:0,gp:rnd()*3,v:0,d:0,lag:rnd()*.5});};
  const PRF=Math.atan2(FX,FZ);                                                               // de profil par rapport au sentier
  deer(ANIM[0][0],ANIM[0][1],PRF,1.25,true,false,17,0);deer(ANIM[1][0],ANIM[1][1],PRF+PI,1.05,false,true,16,1);deer(ANIM[2][0],ANIM[2][1],PRF+.5,.6,false,true,16,1);
  deer(ANIM[3][0],ANIM[3][1],PRF,1.05,false,true,14,2);deer(ANIM[4][0],ANIM[4][1],PRF+PI-.4,.62,false,false,14,2);
  LIFE.push(t=>{let run=false;
    for(const c of CR){const dc=Math.hypot(camera.position.x-c.g.position.x,camera.position.z-c.g.position.z);
      if(c.st===0&&(dc<c.trig+4||CR.some(o=>o.grp===c.grp&&o.st>0))){c.st=1;c.tm=0;}
      if(c.st===1){c.tm+=DT;if(c.tm>.9+c.lag&&(dc<c.trig||CR.some(o=>o.grp===c.grp&&o.st===2))){c.st=2;c.tm=0;}}
      if(c.st===3&&WALK.s<.02&&CAM.mode===0){c.st=0;c.g.visible=true;c.g.position.set(c.hx,groundH(c.hx,c.hz)-.02,c.hz);c.g.rotation.y=c.ry;c.b.position.y=0;c.b.rotation.z=0;c.d=0;c.v=0;for(const l of c.legs)l.rotation.z=0;}
      if(c.st===2){run=true;c.tm+=DT;c.v=Math.min(8.6,c.v+DT*13);let dr=RYF-c.g.rotation.y;dr=Math.atan2(Math.sin(dr),Math.cos(dr));c.g.rotation.y+=dr*Math.min(1,DT*6);
        const hx=Math.cos(c.g.rotation.y),hz=-Math.sin(c.g.rotation.y),x=c.g.position.x+hx*c.v*DT,z=c.g.position.z+hz*c.v*DT;c.d+=c.v*DT;c.gp+=DT*12.5;
        c.g.position.set(x,groundH(x,z)-.02,z);c.b.position.y=Math.abs(Math.sin(c.gp*.5+.4))*.24;c.b.rotation.z=Math.sin(c.gp+1)*.1;
        c.legs[0].rotation.z=c.legs[2].rotation.z=Math.sin(c.gp)*.8+.15;c.legs[1].rotation.z=c.legs[3].rotation.z=Math.sin(c.gp+2.4)*.85-.1;c.nk.rotation.z=.6+Math.sin(c.gp)*.06;c.hd.rotation.z=-.5;c.hd.rotation.y=0;
        if(c.d>60){c.st=3;c.g.visible=false;}continue;}
      const al=c.st===1?0:(c.graze?smooth(-.2,.4,Math.sin(t*.19+c.ph)):smooth(.93,1,Math.sin(t*.11+c.ph))*.6),a=lerp(.95,-.9,al)+Math.sin(t*.7+c.ph)*.02;
      c.nk.rotation.z+=(a-c.nk.rotation.z)*Math.min(1,DT*5);c.hd.rotation.z=-c.nk.rotation.z*.55-.25;c.hd.rotation.y=c.st===1?.9:(1-al)*Math.sin(t*.31+c.ph*2)*.55;
      c.ears[0].rotation.z=.35+Math.max(0,Math.sin(t*2.3+c.ph*5)-.8)*2.2;c.ears[1].rotation.z=.35+Math.max(0,Math.sin(t*1.9+c.ph*3)-.8)*2.2;}
    RUNNING=run;});
  /* oiseaux */
  const wg=new THREE.BufferGeometry();wg.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,.14,0,0,.04,0,.36],3));const bm=new THREE.MeshBasicMaterial({color:0x0d110d,side:THREE.DoubleSide,fog:false}),BD=[];
  for(let i=0;i<(TIER?8:4);i++){const g=new THREE.Group(),wr=new THREE.Mesh(wg,bm),wl=new THREE.Mesh(wg,bm);wl.scale.z=-1;const b=new THREE.Mesh(new THREE.ConeGeometry(.035,.2,5),bm);b.rotation.z=-PI/2;b.position.x=.05;g.add(wr,wl,b);scene.add(g);
    BD.push({g,wr,wl,ph:rnd(),y:8+rnd()*8,z:-34+rnd()*46,sp:.035+rnd()*.03,dir:rnd()<.3?-1:1});}
  LIFE.push(t=>{for(const b of BD){const u=(t*b.sp+b.ph)%1;b.g.position.set(lerp(-48,48,u)*b.dir,b.y+Math.sin(t*.8+b.ph*9)*.6,b.z+Math.sin(u*6+b.ph*20)*4);b.g.rotation.y=b.dir>0?0:PI;const f=Math.sin(t*11+b.ph*30)*.85;b.wr.rotation.x=-f;b.wl.rotation.x=f;}});
  /* papillons */
  const ws=new THREE.Shape();ws.moveTo(0,.005);ws.bezierCurveTo(.02,.07,.085,.075,.075,.02);ws.bezierCurveTo(.07,0,.04,-.005,.03,-.008);ws.bezierCurveTo(.06,-.02,.06,-.065,.03,-.06);ws.bezierCurveTo(.012,-.055,.004,-.03,0,-.012);const pw=new THREE.ShapeGeometry(ws,6);pw.rotateX(-PI/2);const BF=[],spots=[[pathX(26)-1,26],[pathX(15)+1.4,15.5],[.2,3],[-2,20.5]];
  for(let i=0;i<(TIER?14:7);i++){const c=spots[i%spots.length],g=new THREE.Group(),m=new THREE.MeshStandardMaterial({color:i%3?0xf4efd8:0xf0d060,side:THREE.DoubleSide,emissive:0x555040,roughness:.8}),r=new THREE.Mesh(pw,m),lg=new THREE.Group(),l=new THREE.Mesh(pw,m);lg.scale.x=-1;lg.add(l);const bd=new THREE.Mesh(new THREE.CylinderGeometry(.004,.004,.08,4),DK);bd.rotation.x=PI/2;g.add(r,lg,bd);g.scale.setScalar(.8);scene.add(g);
    BF.push({g,r,l,ph:rnd()*TAU,x:c[0],z:c[1]});}
  LIFE.push(t=>{for(const b of BF){const x=b.x+Math.sin(t*.5+b.ph)*1.4+Math.sin(t*1.7+b.ph*3)*.3,z=b.z+Math.cos(t*.43+b.ph*1.3)*1.4;b.g.position.set(x,groundH(x,z)+.55+Math.sin(t*.9+b.ph*2)*.25+Math.sin(t*6+b.ph)*.05,z);b.g.rotation.y=t*.6+b.ph;const f=.25+Math.abs(Math.sin(t*20+b.ph))*1.1;b.r.rotation.z=f;b.l.rotation.z=f;}});
}

/* ═══════════════════════════════════════════════════════════════════════════════
   05 · lumière : soleil à contre-jour, ombres portées, air éclairé (rayons découpés par les arbres), étalonnage
   ═══════════════════════════════════════════════════════════════════════════════ */
let sun,hemi,sky;
function buildLight(){
  hemi=new THREE.HemisphereLight(0x9fc0e6,0x26301a,+(Q.get('hemi')||.64));scene.add(hemi);
  sun=new THREE.DirectionalLight(SUN_COL,+(Q.get('sun')||5.4));sun.position.copy(SUN).multiplyScalar(150).add(V3(0,0,6));sun.target.position.set(0,0,6);scene.add(sun,sun.target);
  {const f=new THREE.DirectionalLight(0xdfe8c8,+(Q.get('fill')||.18));f.position.set(.3,.5,1);scene.add(f);}   // rebond du sol ensoleillé vers les façades
  sun.castShadow=true;const s=sun.shadow,E=62;s.mapSize.set([1536,3072,4096][TIER],[1536,3072,4096][TIER]);s.camera.left=-E;s.camera.right=E;s.camera.top=E;s.camera.bottom=-E;s.camera.near=10;s.camera.far=330;s.bias=-.0005;s.normalBias=.05;s.radius=2.2;
  /* ciel : dôme très clair, halo du soleil */
  sky=new THREE.Mesh(new THREE.SphereGeometry(380,32,16),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{uSun:{value:SUN},uTime:U.uTime},
    vertexShader:`varying vec3 vD;void main(){vD=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`uniform vec3 uSun;uniform float uTime;varying vec3 vD;
      float hh(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hh(i),hh(i+vec2(1.,0.)),f.x),mix(hh(i+vec2(0.,1.)),hh(i+vec2(1.,1.)),f.x),f.y);}
      float fb(vec2 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*vn(p);p=p*2.03+7.;a*=.5;}return s;}
      void main(){vec3 d=normalize(vD);float h=clamp(d.y,0.,1.);vec3 c=mix(vec3(.55,.72,.9),vec3(.15,.35,.78),pow(h,.5));
        vec2 q=d.xz/(d.y+.22)*1.25+vec2(uTime*.004,uTime*.0015);float n=fb(q),cl=smoothstep(.46,.74,n)*smoothstep(.0,.22,d.y);
        float s=max(dot(d,uSun),0.);vec3 cc=mix(vec3(.66,.71,.8),vec3(1.05,1.,.93),smoothstep(.5,.85,n))+vec3(.5,.36,.2)*pow(s,5.);c=mix(c,cc,cl*.88);
        c+=vec3(1.,.8,.5)*(pow(s,8.)*.7+pow(s,120.)*5.+pow(s,1200.)*60.);gl_FragColor=vec4(c,1.);}`}));
  scene.add(sky);
  /* lointains : deux lignes de crêtes boisées, bleuies par la distance */
  for(const r of[[185,22,20,[.14,.22,.24]],[265,38,34,[.3,.42,.5]]]){const N=720,pos=[],idx=[];
    for(let i=0;i<=N;i++){const a=i/N*TAU,top=r[1]+r[2]*fbm(Math.cos(a)*2.2+r[0],Math.sin(a)*2.2+7,4)+Math.abs(Math.sin(a*170+r[0]))*3.2*(.5+vnoise(a*40,r[0]));
      pos.push(Math.cos(a)*r[0],-8,Math.sin(a)*r[0]+12,Math.cos(a)*r[0],top,Math.sin(a)*r[0]+12);if(i<N){const k=i*2;idx.push(k,k+1,k+3,k,k+3,k+2);}}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);
    scene.add(new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:new THREE.Color(r[3][0],r[3][1],r[3][2]),side:THREE.DoubleSide,fog:false})));}
}
let MOTES=null;
function buildMotes(){
  const N=[700,1800,3200][TIER],p=new Float32Array(N*3),a=new Float32Array(N*3);for(let i=0;i<N;i++){p[i*3]=(rnd()-.5)*32;p[i*3+1]=.3+rnd()*rnd()*11;p[i*3+2]=-26+rnd()*60;a[i*3]=rnd();a[i*3+1]=rnd();a[i*3+2]=rnd();}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(p,3));g.setAttribute('aS',new THREE.BufferAttribute(a,3));
  MOTES=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{uTime:U.uTime,uPx:U.uPx,tShadow:{value:null},uShadowM:{value:new THREE.Matrix4()}},
    vertexShader:`#include <packing>
      attribute vec3 aS;uniform float uTime,uPx;uniform sampler2D tShadow;uniform mat4 uShadowM;varying float vA;
      void main(){vec3 p=position+vec3(sin(uTime*.21+aS.x*6.28)*.7,sin(uTime*.17+aS.y*6.28)*.4,cos(uTime*.19+aS.z*6.28)*.7);
        vec4 sc=uShadowM*vec4(p,1.);sc.xyz/=sc.w;float v=step(sc.z-.0012,unpackRGBAToDepth(texture2D(tShadow,sc.xy)));
        vec4 mv=viewMatrix*vec4(p,1.);float d=-mv.z;vA=v*smoothstep(.5,2.2,d)*smoothstep(40.,14.,d)*(.4+.6*sin(uTime*(1.+aS.x*2.)+aS.y*40.));
        gl_Position=projectionMatrix*mv;gl_PointSize=uPx*(.005+.009*aS.z)/max(d,.6);}`,
    fragmentShader:`varying float vA;void main(){float d=length(gl_PointCoord-.5);if(d>.5||vA<=0.)discard;gl_FragColor=vec4(vec3(1.,.9,.72)*1.5*smoothstep(.5,0.,d)*vA,1.);}`});
  const pts=new THREE.Points(g,MOTES);pts.frustumCulled=false;scene.add(pts);
}
const VOL_FS=`
#include <packing>
uniform sampler2D tDepth,tShadow;uniform highp sampler3D uN;uniform mat4 uInvProj,uCamW,uShadowM;uniform vec3 uSunDir,uSunCol,uAmbCol,uCam;uniform float uTime,uSigma,uMaxD,uFrame;uniform vec4 uVio[5];varying vec2 vUv;
float vis(vec3 p){vec4 sc=uShadowM*vec4(p,1.);sc.xyz/=sc.w;if(sc.x<0.||sc.x>1.||sc.y<0.||sc.y>1.||sc.z>1.)return .4;return step(sc.z-.0012,unpackRGBAToDepth(texture2D(tShadow,sc.xy)));}
void main(){
  float dz=texture2D(tDepth,vUv).x;vec4 v=uInvProj*vec4(vUv*2.-1.,dz*2.-1.,1.);v/=v.w;vec3 wp=(uCamW*vec4(v.xyz,1.)).xyz;vec3 rd=wp-uCam;float dist=length(rd);rd/=dist;dist=min(dist,uMaxD);
  float c=max(dot(rd,uSunDir),0.),ph=.25+.8*pow(c,3.)+.8*pow(c,30.);
  float dt=dist/float(STEPS),j=fract(52.9829189*fract(dot(gl_FragCoord.xy+uFrame*vec2(5.3,3.1),vec2(.06711056,.00583715))));
  vec3 acc=vec3(0.);float T=1.;
  for(int i=0;i<STEPS;i++){vec3 p=uCam+rd*(float(i)+j)*dt;
    float n=texture(uN,p*.045+vec3(uTime*.006,-uTime*.004,uTime*.005)).r,n2=texture(uN,p*.16-vec3(uTime*.01)).r;
    float dens=uSigma*exp(-max(p.y-2.5,0.)*.06)*(.35+1.1*n)*(.7+.6*n2);
    vec3 tint=vec3(1.);for(int k=0;k<5;k++){vec4 q=uVio[k];if(p.y<q.y+2.){vec3 e=p+uSunDir*((q.y-p.y)/uSunDir.y);float d=length(e.xz-q.xz);tint=mix(tint,vec3(.74,.5,1.12),smoothstep(q.w*1.05,q.w*.45,d)*.8);}}
    acc+=T*(uSunCol*ph*vis(p)*tint+uAmbCol)*dens*dt;T*=exp(-dens*dt);}
  gl_FragColor=vec4(acc,T);
}`;
class AirPass extends Pass{
  constructor(rtScene){super();this.rtScene=rtScene;const N=32,d=new Uint8Array(N*N*N),r=mulberry(5);for(let i=0;i<d.length;i++)d[i]=r()*255;
    const t3=new THREE.Data3DTexture(d,N,N,N);t3.format=THREE.RedFormat;t3.minFilter=t3.magFilter=THREE.LinearFilter;t3.wrapS=t3.wrapT=t3.wrapR=THREE.RepeatWrapping;t3.needsUpdate=true;
    const vs=`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
    this.vol=new THREE.ShaderMaterial({vertexShader:vs,fragmentShader:VOL_FS,defines:{STEPS:[16,28,40][TIER]},depthTest:false,depthWrite:false,
      uniforms:{tDepth:{value:null},tShadow:{value:null},uN:{value:t3},uInvProj:{value:new THREE.Matrix4()},uCamW:{value:new THREE.Matrix4()},uShadowM:{value:new THREE.Matrix4()},uSunDir:{value:SUN},
        uSunCol:{value:new THREE.Color(1,.84,.6).multiplyScalar(+(Q.get('ray')||7.5))},uAmbCol:{value:new THREE.Color(.5,.72,.82).multiplyScalar(+(Q.get('amb')||.5))},uCam:{value:V3()},uTime:U.uTime,uSigma:{value:+(Q.get('sig')||.005)},uMaxD:{value:110},uFrame:{value:0},uVio:{value:VIOLET}}});
    this.comp=new THREE.ShaderMaterial({vertexShader:vs,depthTest:false,depthWrite:false,uniforms:{tScene:{value:null},tVol:{value:null},tAO:{value:null},uPx:{value:new THREE.Vector2()}},
      fragmentShader:`uniform sampler2D tScene,tVol,tAO;uniform vec2 uPx;varying vec2 vUv;void main(){vec4 a=texture2D(tVol,vUv)*.2;
        a+=(texture2D(tVol,vUv+uPx*vec2(1.5,.5))+texture2D(tVol,vUv+uPx*vec2(-1.5,-.5))+texture2D(tVol,vUv+uPx*vec2(-.5,1.5))+texture2D(tVol,vUv+uPx*vec2(.5,-1.5)))*.125;
        a+=(texture2D(tVol,vUv+uPx*vec2(3.,1.))+texture2D(tVol,vUv+uPx*vec2(-3.,-1.))+texture2D(tVol,vUv+uPx*vec2(-1.,3.))+texture2D(tVol,vUv+uPx*vec2(1.,-3.)))*.075;
        float o=texture2D(tAO,vUv).r*.28+(texture2D(tAO,vUv+uPx*vec2(1.2,.4)).r+texture2D(tAO,vUv+uPx*vec2(-1.2,-.4)).r+texture2D(tAO,vUv+uPx*vec2(-.4,1.2)).r+texture2D(tAO,vUv+uPx*vec2(.4,-1.2)).r)*.18;
        vec3 sc=texture2D(tScene,vUv).rgb;sc*=mix(o,1.,smoothstep(.3,2.2,dot(sc,vec3(.3,.6,.1)))*.55);gl_FragColor=vec4(sc*a.a+a.rgb,1.);}`});
    this.ao=new THREE.ShaderMaterial({vertexShader:vs,depthTest:false,depthWrite:false,defines:{NS:[8,12,16][TIER]},uniforms:{tDepth:{value:null},uInvProj:{value:new THREE.Matrix4()},uProj:{value:new THREE.Matrix4()}},
      fragmentShader:`uniform sampler2D tDepth;uniform mat4 uInvProj,uProj;varying vec2 vUv;
        vec3 vp(vec2 uv){float d=texture2D(tDepth,uv).x;vec4 v=uInvProj*vec4(uv*2.-1.,d*2.-1.,1.);return v.xyz/v.w;}
        void main(){vec3 p=vp(vUv);if(-p.z>110.){gl_FragColor=vec4(1.);return;}vec3 n=normalize(cross(dFdx(p),dFdy(p)));
          float a0=6.2832*fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715)))),occ=0.;
          for(int i=0;i<NS;i++){float t=(float(i)+.5)/float(NS),r=mix(.1,1.5,t*t),a=a0+float(i)*2.39996;
            vec2 o=vec2(cos(a),sin(a))*r*vec2(uProj[0][0],uProj[1][1])*.5/max(-p.z,.3);vec3 d=vp(vUv+o)-p;float l=length(d);
            occ+=max(dot(n,d)/max(l,1e-4)-.14,0.)*smoothstep(2.4,.1,l);}
          gl_FragColor=vec4(clamp(1.-occ*2.1/float(NS),0.,1.));}`});
    this.fsq=new FullScreenQuad(this.vol);this.rt=new THREE.WebGLRenderTarget(4,4,{type:THREE.HalfFloatType,depthBuffer:false});this.rtAO=new THREE.WebGLRenderTarget(4,4,{depthBuffer:false});this.frame=0;}
  setSize(w,h){const k=TIER===2?.5:.4;this.rt.setSize(Math.max(2,w*k|0),Math.max(2,h*k|0));this.rtAO.setSize(Math.max(2,w*.5|0),Math.max(2,h*.5|0));this.comp.uniforms.uPx.value.set(1/this.rt.width,1/this.rt.height);}
  render(r,writeBuffer){const u=this.vol.uniforms;u.tDepth.value=this.rtScene.depthTexture;u.tShadow.value=sun.shadow.map?sun.shadow.map.texture:null;if(!u.tShadow.value)return;
    u.uInvProj.value.copy(camera.projectionMatrixInverse);u.uCamW.value.copy(camera.matrixWorld);u.uShadowM.value.copy(sun.shadow.matrix);u.uCam.value.copy(camera.position);u.uFrame.value=CAPTURE?0:(this.frame++%8);
    this.fsq.material=this.vol;r.setRenderTarget(this.rt);this.fsq.render(r);
    const ua=this.ao.uniforms;ua.tDepth.value=this.rtScene.depthTexture;ua.uInvProj.value.copy(camera.projectionMatrixInverse);ua.uProj.value.copy(camera.projectionMatrix);this.fsq.material=this.ao;r.setRenderTarget(this.rtAO);this.fsq.render(r);this.comp.uniforms.tAO.value=this.rtAO.texture;
    this.comp.uniforms.tScene.value=this.rtScene.texture;this.comp.uniforms.tVol.value=this.rt.texture;this.fsq.material=this.comp;r.setRenderTarget(this.renderToScreen?null:writeBuffer);this.fsq.render(r);}
}
let rtScene,composer,air,bloom;
function buildPost(){
  rtScene=new THREE.WebGLRenderTarget(4,4,{type:THREE.HalfFloatType,samples:[0,2,(devicePixelRatio||1)>1.5?2:4][TIER]});rtScene.depthTexture=new THREE.DepthTexture(4,4);
  composer=new EffectComposer(renderer,new THREE.WebGLRenderTarget(4,4,{type:THREE.HalfFloatType}));
  air=new AirPass(rtScene);composer.addPass(air);
  bloom=new UnrealBloomPass(new THREE.Vector2(256,256),+(Q.get('bloom')||.24),.8,.92);composer.addPass(bloom);
  composer.addPass(new OutputPass());
  composer.addPass(new ShaderPass({uniforms:{tDiffuse:{value:null},uTime:U.uTime},
    vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`uniform sampler2D tDiffuse;uniform float uTime;varying vec2 vUv;void main(){vec2 px=1./vec2(textureSize(tDiffuse,0));vec3 c=texture2D(tDiffuse,vUv).rgb;vec3 bl=(texture2D(tDiffuse,vUv+vec2(px.x,0.)).rgb+texture2D(tDiffuse,vUv-vec2(px.x,0.)).rgb+texture2D(tDiffuse,vUv+vec2(0.,px.y)).rgb+texture2D(tDiffuse,vUv-vec2(0.,px.y)).rgb)*.25;c=max(c+(c-bl)*.45,0.);float l=dot(c,vec3(.299,.587,.114));
      c=mix(c,c*c*(3.-2.*c),.5);c=mix(c*vec3(.9,1.02,1.08),c*vec3(1.06,1.,.9),smoothstep(.1,.7,l));c=mix(vec3(l),c,1.12);
      vec2 q=vUv-.5;c*=mix(.62,1.,smoothstep(.95,.25,length(q*vec2(1.,.85))));float g=fract(sin(dot(gl_FragCoord.xy+fract(uTime)*91.7,vec2(12.9898,78.233)))*43758.5453);c+=(g-.5)*.022;gl_FragColor=vec4(c,1.);}`}));
}
const PERF={scale:1,acc:0,n:0,drops:0};
function resize(){
  const w=innerWidth,h=innerHeight,dpr=Math.min(devicePixelRatio||1,DPR_MAX)*PERF.scale;
  renderer.setPixelRatio(dpr);renderer.setSize(w,h,false);rtScene.setSize(w*dpr|0,h*dpr|0);composer.setPixelRatio(dpr);composer.setSize(w,h);
  camera.aspect=w/h;camera.fov=w/h<.8?64:w/h<1.25?54:46;camera.updateProjectionMatrix();if(U.uPx)U.uPx.value=h*dpr/(2*Math.tan(camera.fov*PI/360));
}

/* ═══════════════════════════════════════════════════════════════════════════════
   06 · pilotage par la L1 : la page mère donne la position du parcours (P), la zone et l'état de la salle ; ici on marche, on regarde, on dessine
   ═══════════════════════════════════════════════════════════════════════════════ */
const SWING=[],SMOKE=[];let SUNI=1,RAYC=null;
const WALK={s:0,v:0,auto:false,ph:0,Z0:32.5,Z1:5.4,LEN:27.1};
const CAM={mode:0,p:V3(),t:V3(),mx:0,my:0,snap:true};
const GP=V3(),GT=V3(),TV=V3(),TV2=V3(),CALM=matchMedia('(prefers-reduced-motion: reduce)').matches;
const RAY=new THREE.Raycaster(),NDC=new THREE.Vector2();
let API=null,TT=0,wasOn=false,FR=0,OVER=false,veil=null,tipEl=null,CK=0;
function stelePose(i){const st=STELE[i],th=Math.tan(camera.fov*PI/360),d=Math.max(st.pw/(.78*2*th*camera.aspect),st.ph/(.8*2*th));GP.set(st.x+STN[0]*d,0,st.z+STN[1]*d);GP.y=Math.max(st.cy+.05,groundH(GP.x,GP.z)+1.45);GT.set(st.x,st.cy,st.z);}
function basePose(P){
  if(P>API.P_STATS-.5){CAM.mode=2;stelePose(clamp(Math.round(P-API.P_STATS),0,2));return;}
  CAM.mode=0;const z=lerp(WALK.Z0,WALK.Z1,WALK.s),x=pathX(z);GP.set(x,groundH(x,z)+1.66,z);GT.set(pathX(z-10)*.35,4.7+WALK.s*.9,-13);}
/* homographie carré → quadrilatère écran : même calcul que les dalles de la L1, appliqué aux stèles */
function quad(q,w,h){const x0=q[0],y0=q[1],x1=q[2],y1=q[3],x2=q[4],y2=q[5],x3=q[6],y3=q[7],sx=x0-x1+x2-x3,sy=y0-y1+y2-y3;let a,b,c,d,e,f,g,hh;
  if(Math.abs(sx)<1e-6&&Math.abs(sy)<1e-6){a=x1-x0;b=x3-x0;c=x0;d=y1-y0;e=y3-y0;f=y0;g=0;hh=0;}
  else{const dx1=x1-x2,dx2=x3-x2,dy1=y1-y2,dy2=y3-y2,den=dx1*dy2-dx2*dy1;g=(sx*dy2-dx2*sy)/den;hh=(dx1*sy-sx*dy1)/den;a=x1-x0+g*x1;b=x3-x0+hh*x3;c=x0;d=y1-y0+g*y1;e=y3-y0+hh*y3;f=y0;}
  const F=v=>(Math.abs(v)<1e-12?0:v).toFixed(10);return 'matrix3d('+F(a/w)+','+F(d/w)+',0,'+F(g/w)+','+F(b/h)+','+F(e/h)+',0,'+F(hh/h)+',0,0,1,0,'+F(c)+','+F(f)+',0,1)';}
function panels(){const els=document.querySelectorAll('#wallui .wp'),W=innerWidth,H=innerHeight;
  STELE.forEach((st,i)=>{const el=els[i];if(!el||el.style.visibility==='hidden')return;const w=parseFloat(el.style.width),h=parseFloat(el.style.height);if(!w||!h)return;const pts=[];
    for(const c of st.c){TV.copy(c);st.g.localToWorld(TV);if(TV2.copy(TV).applyMatrix4(camera.matrixWorldInverse).z>-camera.near*1.5){el.style.visibility='hidden';return;}TV.project(camera);pts.push((TV.x*.5+.5)*W,(-TV.y*.5+.5)*H);}
    el.style.transform=quad(pts,w,h);});}
function setOver(o,e){if(o===OVER&&!o)return;OVER=o;API.canvas.style.cursor=o?'pointer':'';tipEl.style.opacity=o?'1':'0';if(o&&e){tipEl.style.left=e.clientX+'px';tipEl.style.top=e.clientY+'px';}}
{let hovT=0;addEventListener('pointermove',e=>{CAM.mx=e.clientX/innerWidth*2-1;CAM.my=-(e.clientY/innerHeight*2-1);if(!wasOn||!HIT)return;const n=performance.now();if(n-hovT<80)return;hovT=n;
    let o=false;if(e.target===API.canvas&&CK<.02&&CAM.mode===0&&WALK.s>.3){NDC.set(CAM.mx,CAM.my);RAY.setFromCamera(NDC,camera);o=RAY.intersectObject(HIT).length>0;}setOver(o,e);});}
addEventListener('click',e=>{if(wasOn&&OVER&&e.target===API.canvas&&CK<.02)API.enter();});
function tick(dt,P,zone,ck,warming){
  CK=ck;const on=zone==='fin'&&ck<.5&&!warming;
  if(veil)veil.style.opacity=zone==='fin'||ck>0?String(clamp01(1-Math.abs(ck-.5)/.13)):'0';
  if(on!==wasOn){wasOn=on;canvas.style.display=on?'block':'none';window.RVF.covers=on;
    if(on){resize();if(ck<.01&&P<API.P_FIN+.5){WALK.s=0;WALK.v=0;WALK.auto=true;}else{WALK.s=1;WALK.v=0;}CAM.snap=true;}else setOver(false);}
  if(!on)return;
  dt=Math.min(.05,Math.max(.001,dt));TT=CAPTURE?14.3:TT+dt;U.uTime.value=TT;
  if(P<API.P_STATS-.5){const tv=WALK.auto&&WALK.s<1?1.25/WALK.LEN:0;WALK.v+=(tv-WALK.v)*(1-Math.exp(-dt*3.2));WALK.s=clamp01(WALK.s+WALK.v*dt);}else{WALK.s=1;WALK.v=0;}
  basePose(P);
  if(ck>0){const u=clamp01(ck/.5),e=u*u*(3-2*u);GP.lerp(DOOR,e);GT.lerp(ALTAR,e);}
  const par=CAM.mode===2?.25:1;GT.x+=CAM.mx*1.2*par;GT.y+=CAM.my*.8*par;
  const a=CAM.snap?1:1-Math.exp(-dt*(CAM.mode===2||WALK.s>=1?2.4:7));CAM.p.lerp(GP,a);CAM.t.lerp(GT,CAM.snap?1:1-Math.exp(-dt*2.6));CAM.snap=false;
  const sp=CAM.mode?0:Math.abs(WALK.v)*WALK.LEN,k=CALM?0:clamp(sp/1.05,0,1.3),q=CALM||CAM.mode===2?0:1;WALK.ph+=dt*TAU*1.8*clamp(sp/1.05,0,1.4);const ph=WALK.ph,t=TT;
  camera.position.copy(CAM.p);camera.position.y+=Math.sin(ph)*.028*k+Math.sin(t*1.15)*.006*q;camera.position.x+=Math.sin(ph*.5)*.034*k+Math.sin(t*.31)*.012*q;
  camera.lookAt(CAM.t.x+(Math.sin(t*.43+1)*.05+Math.sin(ph*.5+.5)*.05*k)*q,CAM.t.y+Math.sin(ph+.9)*.035*k+Math.sin(t*.57)*.03*q,CAM.t.z);camera.rotateZ(Math.sin(ph*.5)*.0055*k+Math.sin(t*.37)*.0015*q);
  camera.updateMatrixWorld();U.uSunV.value.copy(SUN).transformDirection(camera.matrixWorldInverse);
  for(const l of LAMPS){const f=.88+.12*Math.sin(TT*7+l.ph)+.05*Math.sin(TT*17+l.ph*3);if(l.sp)l.sp.material.opacity=(l.base||.5)*f;if(l.pl)l.pl.intensity=l.pl.userData.i*f;
    if(l.g){const gu=.55+.45*Math.sin(TT*.23+l.ph);l.g.rotation.z=Math.sin(TT*1.9+l.ph)*l.amp*gu;l.g.rotation.x=Math.sin(TT*1.55+l.ph*1.7)*l.amp*.7*gu;}}
  for(const w of SWING){const gu=.55+.45*Math.sin(TT*.19+w.ph);w.g.rotation.z=Math.sin(TT*1.1+w.ph)*w.amp*gu;w.g.rotation.x=Math.sin(TT*.9+w.ph*2)*w.amp*.6*gu;}
  for(const m of SMOKE){const u=(TT*.09+m.o)%1;m.sp.position.set(m.x+Math.sin(u*5+m.o*9)*.22*u,m.y+u*2.4,m.z+u*.45);m.sp.scale.setScalar(.25+u*1.2);m.sp.material.opacity=.2*Math.sin(u*PI);}
  {const cl=clamp(.93+.1*Math.sin(TT*.11)+.05*Math.sin(TT*.27+1.3),.8,1.06);sun.intensity=SUNI*cl;air.vol.uniforms.uSunCol.value.copy(RAYC).multiplyScalar(cl);}
  DT=dt;for(const f of LIFE)f(TT);
  if(MOTES&&sun.shadow.map){MOTES.uniforms.tShadow.value=sun.shadow.map.texture;MOTES.uniforms.uShadowM.value.copy(sun.shadow.matrix);}
  if(CAPTURE||RUNNING||FR<4||FR%8===0)renderer.shadowMap.needsUpdate=true;FR++;
  renderer.setRenderTarget(rtScene);renderer.render(scene,camera);composer.render();
  panels();window.RVF.frames=FR;
  if(!CAPTURE){PERF.acc+=dt;if(++PERF.n>=90){const avg=PERF.acc/PERF.n;PERF.acc=0;PERF.n=0;if(avg>1/26&&PERF.drops<4){PERF.drops++;if(PERF.drops===1){air.vol.defines.STEPS=20;air.vol.needsUpdate=true;air.ao.defines.NS=8;air.ao.needsUpdate=true;}else{PERF.scale*=.88;resize();}}}}
}
const nextTick=()=>new Promise(r=>requestAnimationFrame(()=>setTimeout(r,0)));
export async function init(api){
  API=api;window.RVF={ready:false,covers:false,canvas,frames:0};
  api.canvas.after(canvas);
  veil=document.createElement('div');veil.style.cssText='position:fixed;inset:0;background:#0b0806;opacity:0;pointer-events:none';canvas.after(veil);
  tipEl=document.createElement('div');tipEl.textContent='Entrer · salle de cours d’économie';tipEl.style.cssText='position:fixed;z-index:7;pointer-events:none;transform:translate(16px,18px);font:700 11px/1 ui-monospace,Menlo,monospace;letter-spacing:.12em;text-transform:uppercase;color:#fff;background:rgba(0,0,0,.55);border:1px solid rgba(255,200,130,.7);padding:8px 11px;opacity:0;transition:opacity .2s;white-space:nowrap';document.body.appendChild(tipEl);
  await Promise.all([loadTex('bark_rough'),loadTex('bark_rough_n',{srgb:false}),loadTex('ground_moss'),loadTex('ground_moss_n',{srgb:false}),loadTex('ground_litter'),loadTex('rock'),loadTex('rock_n',{srgb:false}),loadTex('fern',{rep:false}),loadTex('wood_cedar'),loadTex('wood_cedar_n',{srgb:false})]);
  TEX.pine=texPine();TEX.leafb=texLeaf();TEX.blossom=texBlossom();TEX.glow=texGlow();await nextTick();
  for(const f of[buildLight,buildGround,buildTrees,buildUnderstory,buildGrass,buildRocks,buildPath,buildShrine,buildAnimals,buildMotes,buildPost]){f();await nextTick();}
  for(const l of LAMPS)if(l.pl)l.pl.userData.i=l.pl.intensity;
  renderer.shadowMap.autoUpdate=false;SUNI=sun.intensity;RAYC=air.vol.uniforms.uSunCol.value.clone();resize();addEventListener('resize',()=>{if(wasOn)resize();});
  window.RVF.tick=tick;window.RVF.enter=()=>API.enter();window.RVF.ready=true;
}
