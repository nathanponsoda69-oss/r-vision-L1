/* R·Vision L1 — jungle, espace d'ambre, portail (page : l1.html ; textures : l1/tex ; forêt : l1/foret.js) */
/* ═══════════════════════════════════════════════════════════════
   R·VISION L1 — JUNGLE
   01 · Cœur : moteur, uniformes partagés, bruit GLSL, patch matériaux
═══════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { RoundedBoxGeometry as RoundedBoxGeometry0 } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

/* Boîte arrondie : même résultat, au bit près, que RoundedBoxGeometry de three.js, mais la partie
   qui ne dépend pas des dimensions (gabarit, normales, angles des arrondis) est calculée une seule
   fois par finesse — des centaines de boîtes (grottes, blocs, finance) se construisent ~10× plus vite. */
const _RBT=new Map();
function rbTemplate(seg){
  let T=_RBT.get(seg);if(T)return T;
  const base=new THREE.BoxGeometry(1,1,1,seg,seg,seg),g2=base.toNonIndexed();
  const P=g2.attributes.position.array,n=P.length/3,faceTris=P.length/6,half=0.5/seg;
  const S=new Float64Array(n*3),N=new Float64Array(n*3),R0=new Float64Array(n),R1=new Float64Array(n),F0=new Uint8Array(n),F1=new Uint8Array(n),SD=new Uint8Array(n);
  const pos=new THREE.Vector3(),nor=new THREE.Vector3(),tn=new THREE.Vector3(),fd=new THREE.Vector3();
  const AX=[['z','y','y','z'],['z','y','y','z'],['x','z','z','x'],['x','z','z','x'],['x','y','y','x'],['x','y','y','x']];
  const DIR=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
  const ang=(uvAxis,projAxis)=>{tn.copy(nor);tn[projAxis]=0;tn.normalize();return [1.0-(tn.angleTo(fd)/(Math.PI/4)),Math.sign(tn[uvAxis])===1?1:0];};
  for(let i=0,k=0;i<P.length;i+=3,k++){
    pos.fromArray(P,i);nor.copy(pos);
    nor.x-=Math.sign(nor.x)*half;nor.y-=Math.sign(nor.y)*half;nor.z-=Math.sign(nor.z)*half;nor.normalize();
    S[i]=Math.sign(pos.x);S[i+1]=Math.sign(pos.y);S[i+2]=Math.sign(pos.z);N[i]=nor.x;N[i+1]=nor.y;N[i+2]=nor.z;
    const side=Math.floor(i/faceTris);SD[k]=side;fd.set(DIR[side][0],DIR[side][1],DIR[side][2]);const ax=AX[side];
    const a=ang(ax[0],ax[1]),b=ang(ax[2],ax[3]);R0[k]=a[0];F0[k]=a[1];R1[k]=b[0];F1[k]=b[1];}
  T={n,S,N,R0,R1,F0,F1,SD,groups:base.groups.map(g=>({start:g.start,count:g.count,materialIndex:g.materialIndex}))};
  base.dispose();g2.dispose();_RBT.set(seg,T);return T;
}
function rbUv(ratio,pos,radius,sideLength){
  const totArcLength=2*Math.PI*radius/4,centerLength=Math.max(sideLength-2*radius,0);
  const arcUvRatio=0.5*totArcLength/(totArcLength+centerLength);
  if(pos)return ratio*arcUvRatio;
  const lenUv=centerLength/(totArcLength+centerLength);return lenUv+arcUvRatio+arcUvRatio*(1.0-ratio);
}
class RoundedBoxGeometry extends THREE.BufferGeometry{
  constructor(width=1,height=1,depth=1,segments=2,radius=0.1){
    super();
    const seg=segments*2+1;
    radius=Math.min(width/2,height/2,depth/2,radius);
    if(seg===1||!(seg>1)||seg!==Math.floor(seg)){const g=new RoundedBoxGeometry0(width,height,depth,segments,radius);this.copy(g);this.type='BoxGeometry';this.parameters=Object.assign({},g.parameters);g.dispose();return;}
    this.type='BoxGeometry';this.parameters={width:1,height:1,depth:1,widthSegments:seg,heightSegments:seg,depthSegments:seg};
    const T=rbTemplate(seg),n=T.n,S=T.S,N=T.N;
    const pa=new Float32Array(n*3),na=new Float32Array(n*3),ua=new Float32Array(n*2);
    const bx=width/2-radius,by=height/2-radius,bz=depth/2-radius;
    for(let i=0,j=0,k=0;k<n;i+=3,j+=2,k++){
      const nx=N[i],ny=N[i+1],nz=N[i+2];
      pa[i]=bx*S[i]+nx*radius;pa[i+1]=by*S[i+1]+ny*radius;pa[i+2]=bz*S[i+2]+nz*radius;
      na[i]=nx;na[i+1]=ny;na[i+2]=nz;
      const r0=T.R0[k],f0=T.F0[k],r1=T.R1[k],f1=T.F1[k];
      switch(T.SD[k]){
        case 0:ua[j]=rbUv(r0,f0,radius,depth);ua[j+1]=1.0-rbUv(r1,f1,radius,height);break;
        case 1:ua[j]=1.0-rbUv(r0,f0,radius,depth);ua[j+1]=1.0-rbUv(r1,f1,radius,height);break;
        case 2:ua[j]=1.0-rbUv(r0,f0,radius,width);ua[j+1]=rbUv(r1,f1,radius,depth);break;
        case 3:ua[j]=1.0-rbUv(r0,f0,radius,width);ua[j+1]=1.0-rbUv(r1,f1,radius,depth);break;
        case 4:ua[j]=1.0-rbUv(r0,f0,radius,width);ua[j+1]=1.0-rbUv(r1,f1,radius,height);break;
        case 5:ua[j]=rbUv(r0,f0,radius,width);ua[j+1]=1.0-rbUv(r1,f1,radius,height);break;}
    }
    this.setAttribute('position',new THREE.Float32BufferAttribute(pa,3));
    this.setAttribute('normal',new THREE.Float32BufferAttribute(na,3));
    this.setAttribute('uv',new THREE.Float32BufferAttribute(ua,2));
    T.groups.forEach(g=>this.addGroup(g.start,g.count,g.materialIndex));
  }
  copy(source){super.copy(source);this.parameters=Object.assign({},source.parameters);return this;}
}

const Q = new URLSearchParams(location.search);
const CAPTURE = Q.has('capture');
if(CAPTURE) document.documentElement.classList.add('capture');
const REDUCED = !CAPTURE && window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const MOBILE = !CAPTURE && (matchMedia('(max-width: 760px)').matches || /Android|iPhone|iPad/i.test(navigator.userAgent));

/* RNG déterministe (rendus reproductibles) */
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const rand = mulberry32(20261002);

/* Bruit JS (pour la géométrie) */
function h2(x,y){let n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n);}
/* vn2 ne lit h2 qu'aux nœuds entiers de la grille : chaque valeur est gardée (cache à adressage direct).
   Math.sin d'un grand argument est lent ; le résultat est strictement le même (vérifié au bit près sur tout le relief). */
const H2N=1<<18,H2M=H2N-1,H2X=new Int32Array(H2N),H2Y=new Int32Array(H2N),H2V=new Float64Array(H2N).fill(NaN);
function h2i(ix,iy){const k=(Math.imul(ix,73856093)^Math.imul(iy,19349663))&H2M;if(H2X[k]===ix&&H2Y[k]===iy&&H2V[k]===H2V[k])return H2V[k];const v=h2(ix,iy);H2X[k]=ix;H2Y[k]=iy;H2V[k]=v;return v;}
function vn2(x,y){const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;const ux=fx*fx*(3-2*fx),uy=fy*fy*(3-2*fy);
  const a=h2i(ix,iy),b=h2i(ix+1,iy),c=h2i(ix,iy+1),d=h2i(ix+1,iy+1);return a+(b-a)*ux+(c-a)*uy+(a-b-c+d)*ux*uy;}
function fbm2(x,y,o=5){let s=0,a=.5;for(let i=0;i<o;i++){s+=a*vn2(x,y);x=x*2.03+17.1;y=y*2.03+3.7;a*=.5;}return s;}
const smooth=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};
const clamp01=x=>x<0?0:x>1?1:x;
const lerp=(a,b,t)=>a+(b-a)*t;
const easeInOut=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
const easeOut=t=>1-Math.pow(1-t,3);

/* ── Uniformes partagés par toute la scène ── */
const SUN_DIR = new THREE.Vector3(-0.70, 0.26, 0.66).normalize();
const U = {
  uTime:{value:0},
  uFogColor:{value:new THREE.Color('#c6b29e')},
  uFogDensity:{value:0.0037},
  uFogHeight:{value:0.05},
  uFogY0:{value:0.0},
  uFogStart:{value:0.0},
  uFogCeil:{value:0.0},       // brume supplémentaire sous la voûte (grottes)
  uMistCol:{value:new THREE.Color('#9cc6e4')},uMistK:{value:0.0},uMistH:{value:2.0},   // manteau de brume au sol (grottes)      // distance à partir de laquelle le brouillard commence (grottes : les livres restent nets)
  uSunDir:{value:SUN_DIR.clone()},
  uSunColor:{value:new THREE.Color('#ffd2a0')},
  uWind:{value:new THREE.Vector2(0.88,0.47).normalize()},
  uDust:{value:1.0},
  uGlowCol:{value:new THREE.Color('#ffd2a0').multiplyScalar(0.32)}, // halo du soleil dans le brouillard
  uGlowPow:{value:6.0},
  uLum:{value:1.0},            // luminosité ambiante (1 le jour, ~0,2 la nuit) pour les particules non éclairées
  uLantern:{value:0.0},        // lanternes et feux (0 le jour, 1 la nuit)
  /* révélation */
  uPyrReveal:{value:40.0},     // y au-dessus duquel la pyramide est solide (descend de 40 à -2)
  uPyrWire:{value:40.0},       // y au-dessus duquel le filaire de la pyramide apparaît
  uTerrainReveal:{value:-1.0}, // rayon solide du terrain
  uTerrainWire:{value:-1.0},   // rayon filaire du terrain
  uWireAlpha:{value:1.0},
  uRevealGlow:{value:1.0},
  uRevealColor:{value:new THREE.Color('#fff3e0')},
  /* survol pyramide */
  uHover:{value:new THREE.Vector3(0,-100,0)},
  uHoverAmt:{value:0},
  uN3:{value:null},            // bruit 3D précalculé (voir plus bas)
};
/* Bruit de valeur précalculé dans une texture 3D 64³ (répétée) : une seule lecture filtrée par le
   matériel remplace 8 hachages + 7 mélanges. C'est le cœur du coût de tous les shaders (sable,
   pierres, brume, poussière) : la carte graphique travaille 5 à 8 fois moins pour le même rendu. */
{const N=64,d=new Uint8Array(N*N*N);const fr=x=>x-Math.floor(x);
 for(let z=0;z<N;z++)for(let y=0;y<N;y++)for(let x=0;x<N;x++){
   let px=fr(x*0.1031),py=fr(y*0.1031),pz=fr(z*0.1031);const dd=px*(pz+31.32)+py*(py+31.32)+pz*(px+31.32);px+=dd;py+=dd;pz+=dd;
   d[(z*N+y)*N+x]=Math.round(fr((px+py)*pz)*255);}
 const t=new THREE.Data3DTexture(d,N,N,N);t.format=THREE.RedFormat;t.type=THREE.UnsignedByteType;
 t.minFilter=t.magFilter=THREE.LinearFilter;t.wrapS=t.wrapT=t.wrapR=THREE.RepeatWrapping;t.unpackAlignment=1;t.generateMipmaps=false;t.needsUpdate=true;
 U.uN3.value=t;}

/* ── Bibliothèque GLSL ── */
const GLSL_NOISE = /* glsl */`
// NaN / infini (bits d'exposant tous à 1) : test robuste, insensible aux optimisations « fast-math » des GPU
bool rvBad(vec3 c){uvec3 u=floatBitsToUint(c)&uvec3(0x7f800000u);return any(equal(u,uvec3(0x7f800000u)));}
vec3 rvSafe(vec3 c,vec3 f){return rvBad(c)?f:c;}
float rvHash(vec3 p){p=fract(p*0.1031);p+=dot(p,p.zyx+31.32);return fract((p.x+p.y)*p.z);}
uniform highp sampler3D uN3;
// bruit de valeur lissé : une lecture trilinéaire, coordonnées lissées (astuce « smoothstep » d'iq)
float rvNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return texture(uN3,(mod(i,64.0)+f+0.5)*0.015625).r;}
float rvFbm(vec3 p){float a=0.5,s=0.0;for(int i=0;i<5;i++){s+=a*rvNoise(p);p=p*2.03+vec3(1.7,9.2,3.1);a*=0.5;}return s;}
float rvFbm3(vec3 p){float a=0.5,s=0.0;for(int i=0;i<3;i++){s+=a*rvNoise(p);p=p*2.03+vec3(1.7,9.2,3.1);a*=0.5;}return s;}
#ifdef RV_FRAG
vec3 rvPerturb(vec3 pos,vec3 n,float h,float k){
  vec3 dpx=dFdx(pos),dpy=dFdy(pos);float dhx=dFdx(h),dhy=dFdy(h);
  vec3 r1=cross(dpy,n),r2=cross(n,dpx);float det=dot(dpx,r1);
  vec3 g=sign(det)*(dhx*r1+dhy*r2);vec3 r=abs(det)*n-k*g;float l2=dot(r,r);return l2>1e-20?r*inversesqrt(l2):n;}
// relief par gradient calculé dans le monde (différences finies) : pas de blocs de 2×2 pixels
// comme avec les dérivées d'écran — net à toute distance. nV : normale (vue) ; gW : gradient (monde)
vec3 rvBumpW(vec3 nV,vec3 gW,float k){
  vec3 nW=normalize((vec4(nV,0.0)*viewMatrix).xyz);vec3 gT=gW-nW*dot(gW,nW);
  return normalize((viewMatrix*vec4(normalize(nW-k*gT),0.0)).xyz);}
#endif
`;
const GLSL_FOG = /* glsl */`
uniform float uTime;uniform vec3 uFogColor;uniform float uFogDensity;uniform float uFogHeight;uniform float uFogY0;uniform float uFogStart;uniform float uFogCeil;uniform vec3 uMistCol;uniform float uMistK;uniform float uMistH;
uniform vec3 uSunDir;uniform vec3 uSunColor;uniform vec2 uWind;uniform float uDust;uniform vec3 uGlowCol;uniform float uGlowPow;uniform float uLum;uniform float uLantern;
vec3 rvFogColor(vec3 dir){return uFogColor+uGlowCol*pow(max(dot(dir,uSunDir),0.0),uGlowPow);}
vec3 rvApplyFog(vec3 col,vec3 wpos){
  vec3 V=wpos-cameraPosition;float d=length(V);
  float hy=max(wpos.y-uFogY0,0.0);
  // au loin, la brume enveloppe aussi le haut des collines (plus de crêtes sombres sur le ciel)
  float dens=uFogDensity*mix(exp(-hy*uFogHeight),1.0,smoothstep(140.0,620.0,d))+uFogCeil*smoothstep(2.4,4.6,hy);
  float n=rvFbm3(vec3(wpos.xz*0.011-uWind*uTime*1.4,uTime*0.06));
  dens*=mix(0.45,1.75,n*uDust+(1.0-uDust)*0.5);
  float f=1.0-exp(-max(d-uFogStart,0.0)*dens);
  col=mix(col,rvFogColor(V/max(d,1e-4)),clamp(f,0.0,1.0));
  // manteau de brume au sol : densité exp(-h·y) intégrée le long du rayon (formule exacte), qui dérive lentement
  if(uMistK>0.0){
    float y0=max(cameraPosition.y-uFogY0,0.0),dy=hy-y0,e0=exp(-uMistH*y0),e1=exp(-uMistH*hy);
    float I=abs(dy)>0.01?d*(e0-e1)/(uMistH*dy):d*e0;
    float mn=rvFbm3(vec3(wpos.xz*0.45+vec2(uTime*0.06,-uTime*0.04),uTime*0.05));
    col=mix(col,uMistCol,clamp(1.0-exp(-uMistK*I*mix(0.35,1.65,mn)),0.0,0.92));
  }
  return col;
}`;

const GLSL_REVEAL=`uniform float uPyrReveal;uniform float uPyrWire;uniform float uTerrainReveal;uniform float uTerrainWire;uniform float uWireAlpha;uniform float uRevealGlow;uniform vec3 uRevealColor;uniform vec3 uHover;uniform float uHoverAmt;\n`;
/* ── Patch générique des matériaux standard ──
   opts: {uniforms, vHead, vMain, fHead, fDiscard, fColor, fRough, fNormal, fEmissive} */
function patch(mat, opts, key){
  /* dissolution (objets de sable) : le solide n'apparaît que là où le bruit < uSolid */
  if(opts.dissolve){
    opts.fHead=(opts.fHead||'')+'uniform float uSolid;uniform vec3 uEdgeCol;float rvDn=0.0;';
    opts.fDiscard='rvDn=rvNoise(vRvL*2.6)*0.65+rvNoise(vRvL*7.0+3.1)*0.35;if(rvDn>uSolid*1.04-0.02)discard;'+(opts.fDiscard||'');
    opts.fEmissive=(opts.fEmissive||'')+'totalEmissiveRadiance+=uEdgeCol*smoothstep(uSolid*1.04-0.08,uSolid*1.04-0.02,rvDn)*step(0.002,uSolid)*(1.0-step(0.985,uSolid))*1.1;';
    key+='-d';
  }
  mat.onBeforeCompile = (sh)=>{
    Object.assign(sh.uniforms, U, opts.uniforms||{});
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRvW;\nvarying vec3 vRvN;\n'+(opts.vNoise?GLSL_NOISE:'')+(opts.vHead||''))
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n'+(opts.vNormal||''))
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n'+(opts.vBegin||''))
      .replace('#include <project_vertex>', `#include <project_vertex>
        vec4 rvW4=vec4(transformed,1.0);
        #ifdef USE_INSTANCING
          rvW4=instanceMatrix*rvW4;
        #endif
        rvW4=modelMatrix*rvW4; vRvW=rvW4.xyz;
        vec3 rvN3=objectNormal;
        #ifdef USE_INSTANCING
          rvN3=mat3(instanceMatrix)*rvN3;
        #endif
        vRvN=normalize(mat3(modelMatrix)*rvN3);
        ${opts.vMain||''}`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n#define RV_FRAG\nvarying vec3 vRvW;\nvarying vec3 vRvN;\n'+GLSL_NOISE+GLSL_FOG+GLSL_REVEAL+(opts.fHead||''))
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n'+(opts.fDiscard||''))
      .replace('#include <color_fragment>', '#include <color_fragment>\n'+(opts.fColor||''))
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n'+(opts.fRough||''))
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n'+(opts.fNormal||''))
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n'+(opts.fEmissive||''))
      .replace('#include <fog_fragment>', 'gl_FragColor.rgb=rvApplyFog(gl_FragColor.rgb,vRvW);');
    (opts.reps||[]).forEach(([a,b])=>{sh.fragmentShader=sh.fragmentShader.replace(a,b);});
    if(opts.onShader) opts.onShader(sh);
  };
  mat.customProgramCacheKey = ()=>'rv-'+key;
  mat.fog = false;
  return mat;
}

/* ── Moteur ── */
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({canvas, antialias:false, powerPreference:'high-performance', preserveDrawingBuffer:CAPTURE});
/* résolution interne : un budget de pixels par type de scène plutôt qu'une simple densité d'écran.
   Le désert (terrain, faune, poussière) reste à ~1,45 Mpx ; la glace, la finance et le mur
   montent à ~2 Mpx ; les grottes (scènes fermées, peu de lumières, sans ombre ni réfraction)
   montent jusqu'à ~3,8 Mpx, soit presque la définition native d'un écran Retina.
   La qualité adaptative ajuste ensuite en direct, séparément pour chaque type de scène. */
const DPR_BUDGET=MOBILE?{desert:1.5e6,scene:1.4e6,cave:2.0e6}:{desert:2.9e6,scene:2.4e6,cave:3.8e6};   // jungle : feuillage fin → résolution élevée
function dprFor(cls){
  if(CAPTURE) return +(Q.get('dpr')||1);
  return Math.min(window.devicePixelRatio||1, MOBILE?1.75:2, Math.max(1, Math.sqrt((DPR_BUDGET[cls]||DPR_BUDGET.desert)/Math.max(1,window.innerWidth*window.innerHeight))));
}
const DPR = dprFor('desert');
renderer.setPixelRatio(DPR);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;   // + rayon : bords d'ombre lisses, même au soleil rasant

let VW = CAPTURE ? +(Q.get('w')||1280) : window.innerWidth;
let VH = CAPTURE ? +(Q.get('h')||720) : window.innerHeight;
renderer.setSize(VW, VH, !CAPTURE);
if(CAPTURE){canvas.style.width=VW+'px';canvas.style.height=VH+'px';}

const scene = new THREE.Scene();
scene.background = U.uFogColor.value.clone();
const camera = new THREE.PerspectiveCamera(30, VW/VH, 0.5, 3000);

const rt = new THREE.WebGLRenderTarget(VW*DPR, VH*DPR, {type:THREE.HalfFloatType, samples: MOBILE?0:(DPR>=1.5?2:4)});
rt.depthTexture=new THREE.DepthTexture(VW*DPR, VH*DPR);   // profondeur lue par le « brouillard flouté »
const composer = new EffectComposer(renderer, rt);
/* la copie de la cible (renderTarget2) clonait la texture de profondeur en PARTAGEANT sa source : sans
   anticrénelage (mobile), les deux cibles écrivaient dans la même profondeur que la passe de brume lisait
   → boucle de rétroaction, dessin refusé par le GPU, écran noir. Chaque cible reçoit sa propre profondeur. */
composer.renderTarget2.depthTexture=new THREE.DepthTexture(VW*DPR, VH*DPR);
composer.setPixelRatio(DPR);
composer.setSize(VW, VH);
const renderPass=new RenderPass(scene, camera);
composer.addPass(renderPass);
/* ── Brouillard flouté (comme la brume des dunes) : plus un point est loin, plus il est doux.
   Deux passes (horizontale puis verticale) pondérées par le flou de chaque échantillon : le proche,
   net, ne bave jamais sur le lointain. Lit la profondeur de l'image qui vient d'être rendue. ── */
const FOGBLUR_FS=`#include <packing>
  uniform sampler2D tDiffuse;uniform sampler2D tDepth;uniform vec2 uDir;uniform float uNear;uniform float uFar;uniform float uStart;uniform float uEnd;uniform float uMax;uniform int uTaps;varying vec2 vUv;
  float amt(vec2 uv){float z=texture2D(tDepth,uv).x;float d=-perspectiveDepthToViewZ(z,uNear,uFar);return smoothstep(uStart,uEnd,d);}
  void main(){
    vec4 c0=texture2D(tDiffuse,vUv);float a0=amt(vUv);
    if(a0<0.004){gl_FragColor=c0;return;}
    vec2 px=uDir/vec2(textureSize(tDiffuse,0))*uMax*a0;
    vec4 s=c0;float w=1.0;
    for(int i=1;i<=5;i++){if(i>uTaps)break;float fi=float(i);float g=exp(-fi*fi/10.0);vec2 o=px*fi*0.6;
      float wp=g*amt(vUv+o),wm=g*amt(vUv-o);
      s+=texture2D(tDiffuse,vUv+o)*wp+texture2D(tDiffuse,vUv-o)*wm;w+=wp+wm;}
    gl_FragColor=s/w;}`;
class FogBlurPass extends Pass{
  constructor(){super();this.needsSwap=true;this.enabled=false;
    const mk=d=>new THREE.ShaderMaterial({uniforms:{tDiffuse:{value:null},tDepth:{value:null},uDir:{value:d},uNear:{value:0.5},uFar:{value:3000},uStart:{value:40},uEnd:{value:170},uMax:{value:2.5},uTaps:{value:5}},
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:FOGBLUR_FS,depthTest:false,depthWrite:false});
    this.mH=mk(new THREE.Vector2(1,0));this.mV=mk(new THREE.Vector2(0,1));this.q=new FullScreenQuad(this.mH);this.tmp=null;}
  set(o){for(const m of [this.mH,this.mV])for(const k in o)m.uniforms[k].value=o[k];}
  render(renderer,writeBuffer,readBuffer){
    if(!this.tmp||this.tmp.width!==readBuffer.width||this.tmp.height!==readBuffer.height){if(this.tmp)this.tmp.dispose();this.tmp=new THREE.WebGLRenderTarget(readBuffer.width,readBuffer.height,{type:THREE.HalfFloatType,depthBuffer:false});}
    const dep=readBuffer.depthTexture;
    this.mH.uniforms.tDiffuse.value=readBuffer.texture;this.mH.uniforms.tDepth.value=dep;this.q.material=this.mH;
    renderer.setRenderTarget(this.tmp);this.q.render(renderer);
    this.mV.uniforms.tDiffuse.value=this.tmp.texture;this.mV.uniforms.tDepth.value=dep;this.q.material=this.mV;
    renderer.setRenderTarget(this.renderToScreen?null:writeBuffer);this.q.render(renderer);
  }
}
const fogBlur=new FogBlurPass();
/* relevé de la profondeur de la scène (la cible de rendu alterne d'une image à l'autre) */
class DepthTapPass extends Pass{constructor(){super();this.needsSwap=false;this.tex=null;}render(r,w,read){this.tex=read.depthTexture;}}
const depthTap=new DepthTapPass();
composer.addPass(depthTap);
composer.addPass(fogBlur);
/* ── Rayons de soleil volumétriques : pour chaque pixel (à demi-résolution), on avance dans la brume
   entre la caméra et la surface vue, et l'on regarde à chaque pas si le soleil y arrive (carte d'ombre).
   Les trouées de la canopée découpent ainsi de vrais faisceaux dans l'air humide ; diffusion vers l'avant
   (plus fort face au soleil). Ajoutés à l'image dans la passe suivante, légèrement floutés. ── */
const GODRAY_FS=`#include <packing>
  uniform sampler2D tDepth;uniform sampler2D tShadow;uniform mat4 uShadowM;uniform mat4 uInvProj;uniform mat4 uCamW;uniform vec3 uCamPos;uniform vec3 uSunDir;
  uniform float uMaxD;uniform float uWY;uniform float uG;uniform float uSig;uniform sampler2D tCol;uniform vec2 uSunUV;uniform float uRad;uniform float uAsp;uniform int uSteps;
  varying vec2 vUv;
  void main(){
    float z=texture2D(tDepth,vUv).x;
    vec4 vp=uInvProj*vec4(vUv*2.0-1.0,z*2.0-1.0,1.0);vp/=vp.w;
    vec3 wp=(uCamW*vec4(vp.xyz,1.0)).xyz;vec3 rd=wp-uCamPos;float D=length(rd);rd/=max(D,1e-4);D=min(D,uMaxD);
    float c=dot(rd,uSunDir);float g=uG;float ph=(1.0-g*g)/pow(max(1.0+g*g-2.0*g*c,1e-3),1.5)*0.25+0.12;
    float j=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(0.06711056,0.00583715))));
    float dt=D/float(uSteps),acc=0.0,tot=0.0;
    for(int i=0;i<28;i++){if(i>=uSteps)break;float t=(float(i)+j)*dt;vec3 p=uCamPos+rd*t;
      vec4 sc=uShadowM*vec4(p,1.0);float lit=0.3;
      if(sc.x>0.002&&sc.x<0.998&&sc.y>0.002&&sc.y<0.998&&sc.z<1.0)lit=step(sc.z-0.0015,unpackRGBAToDepth(texture2D(tShadow,sc.xy)));
      // diffusion par la brume (plus dense au ras de l'eau), atténuée par la brume traversée
      float w=exp(-max(p.y-uWY,0.0)*0.045)*exp(-uSig*t)*uSig*dt;acc+=lit*w;tot+=w;}
    // seule la lumière au-dessus de la moyenne compte (la brume uniforme est déjà dans le brouillard) : des faisceaux, pas un voile
    float vol=max(acc-0.42*tot,0.0)*ph*1.6;
    // soleil bas, dans le champ : les trouées de ciel entre les feuilles s'étirent en rayons vers le soleil (diffusion radiale)
    float rad=0.0;
    if(uRad>0.001){vec2 dl=uSunUV-vUv;float L=length(dl*vec2(uAsp,1.0));vec2 st=dl*min(1.0,0.8/max(L,1e-3))/32.0;
      vec2 uv=vUv+st*j;float w=1.0;
      for(int i=0;i<32;i++){if(uv.x>0.0&&uv.y>0.0&&uv.x<1.0&&uv.y<1.0){float sky=step(0.99999,texture2D(tDepth,uv).x);float l=dot(texture2D(tCol,uv).rgb,vec3(0.3,0.59,0.11));rad+=sky*smoothstep(0.3,1.8,l)*w;}
        w*=0.955;uv+=st;}
      rad=rad/32.0*uRad*(0.35+1.0/(1.0+L*L*6.0));}
    gl_FragColor=vec4(vec3(vol+rad*4.0),1.0);}`;
class GodRayPass extends Pass{
  constructor(){super();this.needsSwap=false;this.enabled=false;this.rt=null;this.light=null;
    this.m=new THREE.ShaderMaterial({uniforms:{tDepth:{value:null},tShadow:{value:null},uShadowM:{value:new THREE.Matrix4()},uInvProj:{value:new THREE.Matrix4()},uCamW:{value:new THREE.Matrix4()},
      uCamPos:{value:new THREE.Vector3()},uSunDir:{value:new THREE.Vector3(0,1,0)},uMaxD:{value:150},uWY:{value:0},uG:{value:0.55},uSig:{value:0.004},tCol:{value:null},uSunUV:{value:new THREE.Vector2(0.5,1.5)},uRad:{value:0},uAsp:{value:1.6},uSteps:{value:28}},
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:GODRAY_FS,depthTest:false,depthWrite:false});
    this.q=new FullScreenQuad(this.m);}
  render(renderer,writeBuffer,readBuffer){
    const L=this.light;if(!L||!L.shadow.map){sanePass.uniforms.uRayCol.value.setRGB(0,0,0);return;}
    const sh=PLV().god[1],w=Math.max(2,readBuffer.width>>sh),h=Math.max(2,readBuffer.height>>sh);
    if(!this.rt||this.rt.width!==w||this.rt.height!==h){if(this.rt)this.rt.dispose();this.rt=new THREE.WebGLRenderTarget(w,h,{type:THREE.HalfFloatType,depthBuffer:false});}
    const u=this.m.uniforms;u.tDepth.value=depthTap.tex;u.tShadow.value=L.shadow.map.texture;u.uShadowM.value.copy(L.shadow.matrix);u.tCol.value=readBuffer.texture;u.uAsp.value=readBuffer.width/readBuffer.height;
    u.uInvProj.value.copy(camera.projectionMatrixInverse);u.uCamW.value.copy(camera.matrixWorld);u.uCamPos.value.setFromMatrixPosition(camera.matrixWorld);
    renderer.setRenderTarget(this.rt);this.q.render(renderer);
    sanePass.uniforms.tRays.value=this.rt.texture;
  }
}
const godRay=new GodRayPass();
composer.addPass(godRay);
/* Garde-fou : un seul pixel NaN (ou infini) suffit à noircir un grand bloc d'écran en traversant la bloom
   (et tout l'écran s'il atteint ses derniers niveaux). On le remplace par la moyenne de ses voisins sains. */
const sanePass=new ShaderPass({uniforms:{tDiffuse:{value:null},uSafe:{value:U.uFogColor.value},tRays:{value:null},uRayCol:{value:new THREE.Color(0,0,0)}},
  vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
  fragmentShader:`uniform sampler2D tDiffuse;uniform vec3 uSafe;uniform sampler2D tRays;uniform vec3 uRayCol;varying vec2 vUv;
  bool bad(vec4 c){uvec4 u=floatBitsToUint(c)&uvec4(0x7f800000u);return any(equal(u,uvec4(0x7f800000u)));}
  void main(){vec4 c=texture2D(tDiffuse,vUv);
    if(bad(c)){vec2 tx=1.0/vec2(textureSize(tDiffuse,0));vec4 s=vec4(0.0);float n=0.0;
      for(int i=0;i<8;i++){float a=float(i)*0.7853982;vec4 q=texture2D(tDiffuse,vUv+vec2(cos(a),sin(a))*tx*(i<4?1.5:3.0));if(!bad(q)){s+=q;n+=1.0;}}
      // tout le voisinage proche est corrompu : on cherche plus loin (jamais de plaque noire)
      if(n<0.5){for(int i=0;i<16;i++){float a=float(i)*0.3927+0.2;float r=(i<8?7.0:18.0);vec4 q=texture2D(tDiffuse,vUv+vec2(cos(a),sin(a))*tx*r);if(!bad(q)){s+=q;n+=1.0;}}}
      c=n>0.0?s/n:vec4(uSafe,1.0);}
    if(uRayCol.r+uRayCol.g+uRayCol.b>0.0){vec2 tr=1.5/vec2(textureSize(tRays,0));vec3 r=texture2D(tRays,vUv).rgb*0.25;
      r+=(texture2D(tRays,vUv+vec2(tr.x,0.0)).rgb+texture2D(tRays,vUv-vec2(tr.x,0.0)).rgb+texture2D(tRays,vUv+vec2(0.0,tr.y)).rgb+texture2D(tRays,vUv-vec2(0.0,tr.y)).rgb)*0.125;
      r+=(texture2D(tRays,vUv+tr).rgb+texture2D(tRays,vUv-tr).rgb+texture2D(tRays,vUv+vec2(tr.x,-tr.y)).rgb+texture2D(tRays,vUv-vec2(tr.x,-tr.y)).rgb)*0.0625;
      c.rgb+=r*uRayCol;}
    gl_FragColor=vec4(clamp(c.rgb,vec3(0.0),vec3(16000.0)),c.a);}`});
composer.addPass(sanePass);
const bloom = new UnrealBloomPass(new THREE.Vector2(VW, VH), 0.42, 0.55, 0.92);
composer.addPass(bloom);
/* ── Reflets d'objectif (prononcés) : le soleil (ou la lune) vu par l'objectif — halo, étoile, traînée
   anamorphique horizontale, fantômes colorés alignés sur le centre, anneau irisé, voile d'éblouissement.
   Visibilité mesurée dans l'image (ciel visible et lumineux autour du disque, lissée dans le temps) :
   les reflets s'allument quand le soleil perce entre les feuilles et s'éteignent derrière un tronc. ── */
const FLARE_VIS_FS=`uniform sampler2D tDepth;uniform sampler2D tColor;uniform sampler2D tPrev;uniform vec2 uSun;uniform float uAsp;uniform float uR;uniform float uMix;
  void main(){vec2 c=uSun;vec2 o2=c-0.5;float m=max(abs(o2.x),abs(o2.y));if(m>0.49)c=0.5+o2*(0.49/m);   // hors champ : on regarde le bord
    float v=0.0,n=0.0;
    for(int j=-4;j<=4;j++)for(int i=-4;i<=4;i++){vec2 o=vec2(float(i),float(j))/4.0;if(dot(o,o)>1.0)continue;
      vec2 uv=clamp(c+o*uR*vec2(1.0/uAsp,1.0),0.001,0.999);
      float sky=step(0.99999,texture2D(tDepth,uv).x);float l=dot(texture2D(tColor,uv).rgb,vec3(0.3,0.59,0.11));
      v+=sky*smoothstep(0.35,1.6,l);n+=1.0;}
    float cur=v/n;float prev=texture2D(tPrev,vec2(0.5)).r;gl_FragColor=vec4(vec3(mix(prev,cur,uMix)),1.0);}`;
const FLARE_FS=`uniform sampler2D tDiffuse;uniform sampler2D tVis;uniform vec2 uSun;uniform float uAsp;uniform vec3 uCol;uniform float uK;uniform float uOff;
  varying vec2 vUv;
  float disc(vec2 p,vec2 c,float r,float soft){return smoothstep(r,r*(1.0-soft),length((p-c)*vec2(uAsp,1.0)));}
  float hexa(vec2 p,vec2 c,float r){vec2 q=abs((p-c)*vec2(uAsp,1.0));float d=max(q.x*0.866+q.y*0.5,q.y);return smoothstep(r,r*0.82,d)*(0.6+0.4*smoothstep(r*0.5,r,d));}
  void main(){vec4 base=texture2D(tDiffuse,vUv);float vis=texture2D(tVis,vec2(0.5)).r*uK;
    if(vis<0.002){gl_FragColor=base;return;}
    vec2 d=(vUv-uSun)*vec2(uAsp,1.0);float r=length(d);float an=atan(d.y,d.x);
    vec3 c=vec3(0.0);float on=uOff;                       // 1 : soleil dans le champ, 0 : loin hors champ
    c+=uCol*(exp(-r*10.0)*2.2+exp(-r*3.0)*0.35+exp(-r*0.9)*0.08);                        // halo
    float st=pow(abs(cos(an*3.0+0.3)),60.0)+pow(abs(cos(an*4.0+1.2)),90.0)*0.7+pow(abs(cos(an*11.0+0.7)),20.0)*0.25;
    c+=uCol*st*exp(-r*3.2)*1.3*on;                                                         // étoile
    float dy=abs(vUv.y-uSun.y),dx=abs(vUv.x-uSun.x)*uAsp;
    c+=vec3(0.5,0.72,1.0)*(exp(-dy*160.0)*exp(-dx*1.1)*2.2+exp(-dy*38.0)*exp(-dx*2.4)*0.4)*on;    // traînée anamorphique
    vec2 ax=vec2(0.5)-uSun;
    c+=vec3(0.65,0.85,1.0)*hexa(vUv,uSun+ax*0.22,0.022)*0.55;
    c+=vec3(1.0,0.62,0.3)*hexa(vUv,uSun+ax*0.5,0.04)*0.42;
    c+=vec3(0.45,1.0,0.6)*disc(vUv,uSun+ax*0.78,0.065,0.35)*0.22;
    c+=vec3(0.95,0.85,0.45)*disc(vUv,uSun+ax*1.05,0.02,0.5)*0.6;
    c+=vec3(0.5,0.6,1.0)*hexa(vUv,uSun+ax*1.3,0.1)*0.26;
    c+=vec3(1.0,0.45,0.75)*disc(vUv,uSun+ax*1.62,0.16,0.7)*0.15;
    c+=vec3(1.0,0.9,0.55)*disc(vUv,uSun+ax*2.05,0.055,0.45)*0.38;
    {vec2 rc=uSun+ax*1.0;float rr=length((vUv-rc)*vec2(uAsp,1.0));                         // anneau irisé
     c+=vec3(smoothstep(0.035,0.0,abs(rr-0.44)),smoothstep(0.035,0.0,abs(rr-0.425)),smoothstep(0.035,0.0,abs(rr-0.41)))*0.11;}
    c+=uCol*0.07;                                                                          // voile d'éblouissement
    gl_FragColor=vec4(base.rgb+c*vis,base.a);}`;
class FlarePass extends Pass{
  constructor(){super();this.needsSwap=true;this.enabled=false;
    this.vis=[0,1].map(()=>new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:false}));this.vi=0;
    this.mV=new THREE.ShaderMaterial({uniforms:{tDepth:{value:null},tColor:{value:null},tPrev:{value:null},uSun:{value:new THREE.Vector2()},uAsp:{value:1.6},uR:{value:0.018},uMix:{value:0.2}},
      vertexShader:'void main(){gl_Position=vec4(position.xy,0.0,1.0);}',fragmentShader:FLARE_VIS_FS,depthTest:false,depthWrite:false});
    this.m=new THREE.ShaderMaterial({uniforms:{tDiffuse:{value:null},tVis:{value:null},uSun:{value:new THREE.Vector2()},uAsp:{value:1.6},uCol:{value:new THREE.Color()},uK:{value:0},uOff:{value:1}},
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:FLARE_FS,depthTest:false,depthWrite:false});
    this.qV=new FullScreenQuad(this.mV);this.q=new FullScreenQuad(this.m);this.colTex=null;}
  render(renderer,writeBuffer,readBuffer){
    const a=this.vis[this.vi],b=this.vis[1-this.vi];this.vi=1-this.vi;
    const asp=readBuffer.width/readBuffer.height;
    this.mV.uniforms.tDepth.value=depthTap.tex;this.mV.uniforms.tColor.value=readBuffer.texture;this.mV.uniforms.tPrev.value=a.texture;this.mV.uniforms.uAsp.value=asp;
    this.mV.uniforms.uSun.value.copy(this.m.uniforms.uSun.value);
    renderer.setRenderTarget(b);this.qV.render(renderer);
    this.m.uniforms.tDiffuse.value=readBuffer.texture;this.m.uniforms.tVis.value=b.texture;this.m.uniforms.uAsp.value=asp;
    renderer.setRenderTarget(this.renderToScreen?null:writeBuffer);this.q.render(renderer);
  }
}
const flarePass=new FlarePass();
composer.addPass(flarePass);
composer.addPass(new OutputPass());
/* Anticrénelage de l'image finale (FXAA) : lisse les escaliers que le MSAA ne voit pas (reflets, détails des shaders,
   et tout l'écran sur téléphone, où le MSAA est coupé). Placé avant le grain, pour ne pas le brouiller. */
const aaPass=new ShaderPass({uniforms:{tDiffuse:{value:null}},
  vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
  fragmentShader:`uniform sampler2D tDiffuse;varying vec2 vUv;
  void main(){vec2 px=1.0/vec2(textureSize(tDiffuse,0));vec4 M=texture2D(tDiffuse,vUv);const vec3 lu=vec3(0.299,0.587,0.114);
    float lNW=dot(texture2D(tDiffuse,vUv+vec2(-1.0,-1.0)*px).rgb,lu),lNE=dot(texture2D(tDiffuse,vUv+vec2(1.0,-1.0)*px).rgb,lu),
          lSW=dot(texture2D(tDiffuse,vUv+vec2(-1.0,1.0)*px).rgb,lu),lSE=dot(texture2D(tDiffuse,vUv+vec2(1.0,1.0)*px).rgb,lu),lM=dot(M.rgb,lu);
    float lMin=min(lM,min(min(lNW,lNE),min(lSW,lSE))),lMax=max(lM,max(max(lNW,lNE),max(lSW,lSE)));
    if(lMax-lMin<max(0.03,lMax*0.09)){gl_FragColor=M;return;}                       // zone unie : rien à lisser
    vec2 dir=vec2(-((lNW+lNE)-(lSW+lSE)),(lNW+lSW)-(lNE+lSE));
    float rd=max((lNW+lNE+lSW+lSE)*0.03125,0.0078125),rc=1.0/(min(abs(dir.x),abs(dir.y))+rd);
    dir=clamp(dir*rc,vec2(-8.0),vec2(8.0))*px;
    vec3 A=0.5*(texture2D(tDiffuse,vUv+dir*(1.0/3.0-0.5)).rgb+texture2D(tDiffuse,vUv+dir*(2.0/3.0-0.5)).rgb);
    vec3 B=A*0.5+0.25*(texture2D(tDiffuse,vUv-dir*0.5).rgb+texture2D(tDiffuse,vUv+dir*0.5).rgb);
    float lB=dot(B,lu);gl_FragColor=vec4((lB<lMin||lB>lMax)?A:B,M.a);}`});
aaPass.enabled=MOBILE;   // ordinateur : le MSAA suffit et l'image reste nette ; téléphone : seul anticrénelage disponible
composer.addPass(aaPass);

/* Passe finale : aberration chromatique, vignette, grain, brume de chaleur, transitions */
const FinalShader = {
  uniforms:{tDiffuse:{value:null},uTime:{value:0},uRes:{value:new THREE.Vector2(VW,VH)},uCA:{value:0.0005},uGlitch:{value:0},uFade:{value:0},uFadeColor:{value:new THREE.Color('#c6b29e')},uGrain:{value:0.03},uHeat:{value:0},uNight:{value:0},uSharp:{value:0.15},uGrade:{value:1}},
  vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
  fragmentShader:`
  uniform sampler2D tDiffuse;uniform float uTime;uniform vec2 uRes;uniform float uCA;uniform float uGlitch;uniform float uFade;uniform vec3 uFadeColor;uniform float uGrain;uniform float uHeat;uniform float uNight;uniform float uSharp;uniform float uGrade;
  varying vec2 vUv;
  float hh(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
  void main(){
    vec2 uv=vUv;
    // brume de chaleur : ondulation légère dans la moitié basse
    float hz=smoothstep(0.62,0.25,uv.y)*uHeat;
    uv.x+=sin(uv.y*140.0+uTime*3.1)*0.00055*hz+sin(uv.y*61.0-uTime*2.3)*0.0004*hz;
    // glitch de transition
    if(uGlitch>0.0){float band=step(0.82,hh(vec2(floor(uv.y*38.0),floor(uTime*24.0))));uv.x+=(hh(vec2(floor(uv.y*38.0),uTime))-0.5)*0.06*uGlitch*band;}
    vec2 c=uv-0.5;float r2=dot(c,c);
    float ca=uCA*(1.0+r2*6.0)+uGlitch*0.012;
    vec3 col;
    col.r=texture2D(tDiffuse,uv+c*ca*2.0).r;
    col.g=texture2D(tDiffuse,uv).g;
    col.b=texture2D(tDiffuse,uv-c*ca*2.0).b;
    // netteté : masque flou sur la luminance (4 voisins), borné pour ne pas créer de halos
    if(uSharp>0.0){vec2 tx=1.0/vec2(textureSize(tDiffuse,0));
      vec3 nb=texture2D(tDiffuse,uv+vec2(tx.x,0.0)).rgb+texture2D(tDiffuse,uv-vec2(tx.x,0.0)).rgb+texture2D(tDiffuse,uv+vec2(0.0,tx.y)).rgb+texture2D(tDiffuse,uv-vec2(0.0,tx.y)).rgb;
      float dl=dot(col-nb*0.25,vec3(0.299,0.587,0.114));col+=clamp(dl*uSharp,-0.06,0.06);}
    // nuit : vision scotopique (désaturation bleutée des basses lumières, les lumières chaudes restent)
    if(uNight>0.0){float L=dot(col,vec3(0.299,0.587,0.114));float k=uNight*(1.0-smoothstep(0.25,0.7,L));col=mix(col,L*vec3(0.62,0.78,1.12),k*0.75);}
    // vignette douce
    col*=mix(1.0,0.78,smoothstep(0.18,0.75,r2*1.6));
    // grain
    float g=hh(uv*uRes+fract(uTime*7.31)*vec2(91.7,37.3))-0.5;
    col+=g*uGrain;
    // courbe de contraste douce
    vec3 cc=clamp(col,0.0,1.0);col=mix(col,cc*cc*(3.0-2.0*cc),0.32);
    // étalonnage de la jungle : ombres vert-bleu profondes, hautes lumières chaudes, verts un peu plus riches
    if(uGrade>0.0){float L=dot(col,vec3(0.299,0.587,0.114));
      vec3 tone=mix(vec3(0.94,1.0,1.03),vec3(1.035,1.01,0.965),smoothstep(0.12,0.7,L));
      vec3 gcol=col*tone;gcol=mix(vec3(L),gcol,1.12);gcol=mix(gcol,gcol*gcol*(3.0-2.0*gcol),0.18);
      col=mix(col,max(gcol,0.0),uGrade);}
    {vec3 cc=clamp(col,0.0,1.0);cc=cc*cc*(3.0-2.0*cc);col=mix(col,cc,0.36);col=mix(vec3(dot(col,vec3(0.299,0.587,0.114))),col,1.07);}   // contraste : ombres plus denses, lumières plus vives
    col=mix(col,uFadeColor,uFade);
    gl_FragColor=vec4(col,1.0);
  }`
};
const finalPass = new ShaderPass(FinalShader);
composer.addPass(finalPass);

function onResize(){
  if(CAPTURE) return;
  VW=window.innerWidth;VH=window.innerHeight;
  renderer.setSize(VW,VH);composer.setSize(VW,VH);
  camera.aspect=VW/VH;camera.updateProjectionMatrix();
  finalPass.uniforms.uRes.value.set(VW,VH);
}
window.addEventListener('resize', onResize);
camera.aspect=VW/VH;camera.updateProjectionMatrix();

/* Pointeur (NDC) */
const pointer = {x:0,y:0,sx:0,sy:0,inside:false,moved:false};
window.addEventListener('pointermove',e=>{pointer.x=e.clientX/VW*2-1;pointer.y=-(e.clientY/VH)*2+1;pointer.inside=true;pointer.moved=true;});
document.addEventListener('pointerleave',()=>{pointer.inside=false;});

/* ═══ 01b · Textures haute définition ═══
   Peintes en amont (tex/gen_leaves.py, tex/gen_surfaces.py) : rameaux feuillus, feuilles larges,
   écorces, sols, roche, normales d'eau. Intégrées dans la page (WebP), décodées au chargement.
   Filtrées par la carte graphique (mipmaps + anisotrope) : c'est ce qui rend feuilles, troncs
   et sols nets à toute distance, sans grésillement. Suffixe _n : normales (+ rugosité en alpha).
   Chargement en flux : chaque texture arrive dans son propre <script> à la fin de la page et se
   décode hors du fil principal (ImageBitmap) pendant que la scène se construit. Les objets
   texture existent dès le départ (les matériaux s'y branchent) ; l'image s'y pose à l'arrivée. */
const RV_TEX_NAMES=["banana", "banana_n", "bark_fern", "bark_fern_n", "bark_kapok", "bark_kapok_n", "bark_palm", "bark_palm_n", "bark_rough", "bark_rough_n", "bark_stem", "bark_stem_n", "bark_vine", "bark_vine_n", "canopy", "canopy_n", "colocasia", "colocasia_n", "fern", "fern_n", "ground_litter", "ground_litter_n", "ground_moss", "ground_moss_n", "ground_mud", "ground_mud_n", "leaf_atlas", "leaf_atlas_n", "palm", "palm_n", "rock", "rock_n", "water_n", "tatami", "tatami_n", "thatch", "thatch_n", "washi", "wood_cedar", "wood_cedar_n"];   // toutes les textures, dans leur ordre d'arrivée
const RV_TEX_LATE=["tatami", "tatami_n", "washi", "thatch", "thatch_n", "wood_cedar", "wood_cedar_n"];    // grottes et finance : attendues seulement en second temps
const TEX={};
const TEXST={crit:0,late:0,nCrit:0,nLate:0,done:new Set(),wait:[],fail:0,mode:''};
/* ImageBitmap (décodage hors du fil principal) : seulement sur les navigateurs Chromium (Chrome, Edge,
   Android), où le rendu a été vérifié identique. Safari et Firefox gardent le chemin d'origine (image
   classique), qui a fait ses preuves. */
const TEX_BMP=(()=>{
  if(typeof createImageBitmap==='undefined'||typeof fetch==='undefined'||Q.has('img'))return false;
  const b=navigator.userAgentData&&navigator.userAgentData.brands;
  return !!(b&&b.some(x=>/Chromium|Google Chrome|Microsoft Edge/i.test(x.brand)));
})();
function texInit(){
  const maxA=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  for(const k of RV_TEX_NAMES){
    const t=new THREE.Texture();
    const atlas=/^(leaf_atlas|banana|colocasia|fern|palm)(_n)?$/.test(k);
    t.wrapS=t.wrapT=atlas?THREE.ClampToEdgeWrapping:THREE.RepeatWrapping;
    t.anisotropy=maxA;t.colorSpace=k.endsWith('_n')?THREE.NoColorSpace:THREE.SRGBColorSpace;
    t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;t.generateMipmaps=true;
    TEX[k]=t;
    if(RV_TEX_LATE.includes(k))TEXST.nLate++;else TEXST.nCrit++;
  }
}
async function texImg(uri){
  const img=new Image();img.decoding='async';img.src=uri;
  try{await img.decode();}catch(e){await new Promise((ok,ko)=>{if(img.complete&&img.naturalWidth)ok();else{img.onload=ok;img.onerror=ko;}});}
  if(!(img.naturalWidth>0))throw new Error('image vide');
  return img;
}
/* base64 → Blob. D'abord par fetch (décodage hors du fil principal) ; si la page est bridée et refuse fetch sur une
   adresse data: (aperçus intégrés, certaines politiques de sécurité), on décode sur place — décidé une fois pour toutes. */
let TEX_NOFETCH=false;
async function texBlob(uri,b64){
  if(!TEX_NOFETCH){try{return await (await fetch(uri)).blob();}catch(e){TEX_NOFETCH=true;}}
  const s=atob(b64),n=s.length,u=new Uint8Array(n);for(let i=0;i<n;i++)u[i]=s.charCodeAt(i);
  return new Blob([u],{type:'image/webp'});
}
async function texDecode(k,b64){
  const t=TEX[k];if(!t||TEXST.done.has(k))return;
  // b64 : Blob (fichier déjà téléchargé par l'amorce), adresse de fichier (nouvel essai), ou base64 (ancien format)
  const isBlob=typeof Blob!=='undefined'&&b64 instanceof Blob,isUrl=!isBlob&&typeof b64==='string'&&b64.startsWith('l1/');
  const uri=isBlob?null:isUrl?b64:'data:image/webp;base64,'+b64;
  let img=null,flip=true;
  if(TEX_BMP){
    try{const blob=isBlob?b64:await texBlob(uri,b64);
      const bmp=await createImageBitmap(blob,{imageOrientation:'flipY',premultiplyAlpha:'none',colorSpaceConversion:'none'});
      if(bmp&&bmp.width>0&&bmp.height>0){img=bmp;flip=false;}   // déjà retournée au décodage
    }catch(e){console.warn('texture (bitmap)',k,e);}
  }
  for(let a=0;a<2&&!img;a++){const u=uri||URL.createObjectURL(b64);try{img=await texImg(u);flip=true;}catch(e){console.warn('texture (image)',k,e);}finally{if(!uri)URL.revokeObjectURL(u);}}   // chemin d'origine, deux essais
  if(!img){
    TEXST.fail++;
    const c=document.createElement('canvas');c.width=c.height=1;const g=c.getContext('2d');
    g.fillStyle=k.endsWith('_n')?'rgba(128,128,255,0.78)':'rgb(200,200,200)';g.fillRect(0,0,1,1);img=c;
  }
  if(!TEXST.mode)TEXST.mode=img.close?'bitmap':'image';
  t.image=img;t.flipY=flip;t.needsUpdate=true;
  if(img.close)t.onUpdate=()=>{t.onUpdate=null;try{img.close();}catch(e){}};   // une fois envoyée à la carte graphique, la copie décodée est libérée (mémoire des téléphones)
  TEXST.done.add(k);if(RV_TEX_LATE.includes(k))TEXST.late++;else TEXST.crit++;
  TEXST.wait=TEXST.wait.filter(w=>{if(w.test()){w.res();return false;}return true;});
}
/* au plus quatre décodages à la fois (mémoire des téléphones), dans l'ordre d'arrivée */
const TEXQ={run:0,list:[]};
function texQueue(k,b){TEXQ.list.push([k,b]);texPump();}
function texPump(){
  while(TEXQ.run<4&&TEXQ.list.length){const [k,b]=TEXQ.list.shift();TEXQ.run++;
    texDecode(k,b).catch(e=>console.warn('texture',k,e)).finally(()=>{TEXQ.run--;texPump();});}
}
/* branche le flux : ce qui est déjà arrivé, puis chaque texture à son arrivée */
function texStart(){
  texInit();
  const Q=window.RVTQ||[];
  for(let i=0;i<Q.length;i++){const q=Q[i];if(q){Q[i]=null;texQueue(q[0],q[1]);}}
  window.RVTcb=(k,b)=>{const Q2=window.RVTQ;if(Q2&&Q2.length&&Q2[Q2.length-1]&&Q2[Q2.length-1][0]===k)Q2[Q2.length-1]=null;texQueue(k,b);};
}
const texReady=late=>new Promise(res=>{const test=()=>TEXST.crit>=TEXST.nCrit&&(!late||TEXST.late>=TEXST.nLate);if(test())res();else TEXST.wait.push({test,res});});
const texFrac=()=>(TEXST.crit+TEXST.late)/Math.max(1,TEXST.nCrit+TEXST.nLate);
// texture neutre si une texture manque (le rendu reste correct)
const TEX_BLANK=(()=>{const t=new THREE.DataTexture(new Uint8Array([128,128,255,200]),1,1);t.needsUpdate=true;return t;})();
const TEX_WHITE=(()=>{const t=new THREE.DataTexture(new Uint8Array([200,200,200,255]),1,1);t.needsUpdate=true;return t;})();
const tx=(k)=>TEX[k]||(k.endsWith('_n')?TEX_BLANK:TEX_WHITE);

/* ═══ 02 · Ciel, lumière, environnement ═══
   Ciel procédural piloté par l'heure (09_tod.js) : dégradé horizon → zénith, halo solaire,
   disque, couche de nuages éclairée par le soleil rasant, étoiles, Voie lactée, lune. */
const SKY_U={
  uZenith:{value:new THREE.Color('#9d9893')},uHorizon:{value:new THREE.Color('#c6b29e')},uGradK:{value:3.0},
  uGlowSky:{value:new THREE.Color('#ffd2a0')},uGlowI:{value:0.32},uGlowP:{value:6.0},uGlowH:{value:4.0},
  uDiskDir:{value:SUN_DIR.clone()},uDiskCol:{value:new THREE.Color('#ffe2bd')},uDiskI:{value:1.4},uDiskSize:{value:0.012},
  uCloudCov:{value:0.08},uCloudLit:{value:new THREE.Color('#f3e6d6')},uCloudDark:{value:new THREE.Color('#b8a898')},uCloudI:{value:0.6},
  uStars:{value:0},uMilky:{value:0},uMoonDir:{value:new THREE.Vector3(-0.3,0.55,0.78).normalize()},uMoonI:{value:0},
  uBright:{value:1.0},uSkyIn:{value:1.0},
};
const SKY_FRAG = "#define RV_FRAG\n"+GLSL_NOISE + `
  uniform float uTime;uniform vec3 uFogColor;uniform vec3 uSunDir;uniform vec3 uGlowCol;uniform float uGlowPow;uniform vec2 uWind;
  uniform vec3 uZenith;uniform vec3 uHorizon;uniform float uGradK;
  uniform vec3 uGlowSky;uniform float uGlowI;uniform float uGlowP;uniform float uGlowH;
  uniform vec3 uDiskDir;uniform vec3 uDiskCol;uniform float uDiskI;uniform float uDiskSize;
  uniform float uCloudCov;uniform vec3 uCloudLit;uniform vec3 uCloudDark;uniform float uCloudI;
  uniform float uStars;uniform float uMilky;uniform vec3 uMoonDir;uniform float uMoonI;uniform float uBright;uniform float uSkyIn;
  varying vec3 vDir;
  float stars(vec3 d,float sc,float th){
    vec3 q=d*sc;vec3 c=floor(q);vec3 f=fract(q);
    float h=rvHash(c);if(h<th)return 0.0;
    vec3 p=vec3(rvHash(c+1.7),rvHash(c+3.1),rvHash(c+5.3))*0.7+0.15;
    float r=length(f-p);
    float mag=pow((h-th)/(1.0-th),3.0);
    float tw=0.75+0.25*sin(uTime*(1.5+h*4.0)+h*60.0);
    return smoothstep(0.11,0.0,r)*(0.25+3.5*mag)*tw;
  }
  void main(){
    vec3 d=normalize(vDir);
    float y=d.y;
    float yp=max(y,0.0);
    // dégradé : horizon (= brouillard + halo du brouillard) → zénith
    float cs=dot(d,uSunDir);
    vec3 hor=uFogColor+uGlowCol*pow(max(cs,0.0),uGlowPow);
    float t=1.0-exp(-yp*uGradK);
    vec3 col=mix(hor,uZenith,t);
    // halo du soleil : large dans l'axe, et bande lumineuse le long de l'horizon côté soleil
    float cd=dot(d,uDiskDir);
    // (sûr : jamais de racine négative ni de puissance d'un nombre négatif — sinon NaN, et la bloom noircit l'écran)
    vec2 a=d.xz/max(length(d.xz),1e-4),b=uDiskDir.xz/max(length(uDiskDir.xz),1e-4);
    float az=clamp(dot(a,b)*0.5+0.5,0.0,1.0);
    float band=exp(-yp*uGlowH)*pow(az,2.2);
    col+=uGlowSky*uGlowI*(pow(max(cd,0.0),uGlowP)*0.8+band*0.9);
    // couche de nuages (projetée sur un plan) : éclairée par le soleil rasant
    if(uCloudCov>0.001){
      vec2 uv=d.xz/(yp+0.06)*0.55+uWind*uTime*0.0016;
      float n=rvFbm(vec3(uv.x*1.3,uv.y*2.6,uTime*0.004));
      float n2=rvFbm3(vec3(uv*4.0,1.7));
      float dens=smoothstep(1.0-uCloudCov,1.0-uCloudCov+0.28,n*0.85+n2*0.25);
      dens*=smoothstep(-0.008,0.018,y)*(1.0-smoothstep(0.55,0.95,y)*0.6);
      float lit=pow(clamp(cd*0.5+0.5,0.0,1.0),2.2);
      float rim=pow(max(cd,0.0),12.0)*(1.0-dens)*2.0;
      vec3 cc=mix(uCloudDark,uCloudLit,clamp(lit*0.85+n2*0.3,0.0,1.0))*uCloudI;
      cc+=uCloudLit*rim*uCloudI;
      col=mix(col,cc,dens*0.92);
    }
    // nuit : étoiles, Voie lactée, lune
    if(uStars>0.001){
      float ext=smoothstep(0.0,0.09,y);
      vec3 N=normalize(vec3(0.85,0.28,-0.46));
      float mw=dot(d,N);
      float bandW=exp(-mw*mw/0.014);
      float bandO=exp(-mw*mw/0.06);
      vec3 mwT=normalize(cross(N,vec3(0.0,1.0,0.0)));
      float along=dot(d,mwT);
      float neb=rvFbm(d*46.0+3.0)*0.7+rvFbm(d*12.0)*0.3;
      float lane=smoothstep(0.5,0.7,rvFbm(d*38.0+11.0))*smoothstep(0.035,0.0,abs(mw+0.008+0.02*(neb-0.5)));
      float core=0.5+0.9*smoothstep(-0.3,0.9,along);
      float mwI=(bandW*(0.4+0.9*neb)+bandO*0.25)*core*(1.0-lane*0.85)*uMilky;
      col+=(vec3(0.45,0.5,0.68)*mwI*0.13+vec3(0.85,0.72,0.6)*bandW*neb*neb*core*0.06*uMilky)*ext;
      float st=stars(d,300.0,0.958)+stars(d,110.0,0.965)*1.6+stars(d,520.0,0.93)*0.5*(0.3+bandW*2.5);
      vec3 sc=mix(vec3(0.75,0.85,1.0),vec3(1.0,0.86,0.7),rvHash(floor(d*300.0)+9.0));
      col+=sc*st*uStars*ext*0.9;
    }
    if(uMoonI>0.001){
      float cm=dot(d,uMoonDir);
      float disk=smoothstep(0.99985,0.99993,cm);
      float mare=rvFbm3(d*900.0)*0.35;
      col+=vec3(0.95,0.97,1.0)*disk*(1.0-mare)*uMoonI*2.4;
      col+=vec3(0.35,0.42,0.6)*pow(max(cm,0.0),180.0)*uMoonI*0.35+vec3(0.2,0.25,0.38)*pow(max(cm,0.0),12.0)*uMoonI*0.06;
    }
    // disque solaire (voilé par la poussière près de l'horizon)
    float dk=smoothstep(cos(uDiskSize),cos(uDiskSize*0.75),cd);
    float horV=smoothstep(-0.01,0.03,uDiskDir.y)*0.6+0.4;
    col+=uDiskCol*(dk*uDiskI*2.2*horV+pow(max(cd,0.0),320.0)*uDiskI*0.25)*step(-0.004,y);
    // voiles de poussière en altitude
    float n=rvFbm3(vec3(d.xz/(yp+0.35)*1.6-uWind*uTime*0.03,uTime*0.01));
    col=mix(col,hor*1.02,n*0.16*(1.0-t*0.6));
    // sous l'horizon : brume
    if(y<0.0) col=mix(col,uFogColor,smoothstep(0.0,-0.04,y));
    col=mix(uFogColor,col,uSkyIn);
    col=rvSafe(col,uFogColor);
    gl_FragColor=vec4(col*uBright,1.0);
  }`;
const skyMat = new THREE.ShaderMaterial({
  uniforms: Object.assign({}, SKY_U, U),
  vertexShader:`varying vec3 vDir;void main(){vDir=normalize(position);vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.0);gl_Position=p.xyww;}`,
  fragmentShader: SKY_FRAG,
  side: THREE.BackSide, depthWrite:false, depthTest:true
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(1800, 48, 24), skyMat);
sky.frustumCulled = false;
sky.renderOrder = -10;
scene.add(sky);

/* Lumière du soleil (ou de la lune) + ombres autour de la pagode */
const sun = new THREE.DirectionalLight(new THREE.Color('#ffd6a8'), 3.6);
sun.position.copy(SUN_DIR).multiplyScalar(160);
sun.castShadow = true;
sun.shadow.mapSize.set(MOBILE?2048:3072, MOBILE?2048:3072);
const sc = sun.shadow.camera; sc.left=-46; sc.right=46; sc.top=46; sc.bottom=-46; sc.near=10; sc.far=420;
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.06; sun.shadow.radius = 2.6;
scene.add(sun); scene.add(sun.target);
const hemi = new THREE.HemisphereLight(new THREE.Color('#cdbdb0'), new THREE.Color('#7a5a3e'), 0.22);
scene.add(hemi);

/* Environnement (reflets diffus) : ciel rendu dans une PMREM, régénéré quand l'heure change */
const ENV={pm:null,scene:null,ground:null,mat:null,tex:null};
function buildEnv(groundCol){
  if(!ENV.pm){
    ENV.pm=new THREE.PMREMGenerator(renderer);
    ENV.scene=new THREE.Scene();
    ENV.mat=skyMat.clone();ENV.mat.uniforms=Object.assign({},skyMat.uniforms,{uBright:{value:1.15},uSkyIn:{value:1}});
    ENV.scene.add(new THREE.Mesh(new THREE.SphereGeometry(50,32,16),ENV.mat));
    ENV.ground=new THREE.Mesh(new THREE.CircleGeometry(48,32),new THREE.MeshBasicMaterial({color:new THREE.Color('#4a5a30')}));
    ENV.ground.rotation.x=-Math.PI/2;ENV.ground.position.y=-2;ENV.scene.add(ENV.ground);
  }
  if(groundCol) ENV.ground.material.color.copy(groundCol);
  const old=ENV.tex;
  ENV.tex=ENV.pm.fromScene(ENV.scene,0.035).texture;
  if(scene.environment===old||!scene.environment) scene.environment=ENV.tex;
  if(old) old.dispose();
  if(typeof SYS!=='undefined') SYS.envDesert=ENV.tex;
  return ENV.tex;
}

/* ═══ 03 · Jungle tropicale : le lagon du temple oublié ═══
   La pagode (0,0) sort directement de l'eau d'un lagon sombre, cerné par un mur de jungle.
   Un long bras d'eau mène vers la berge où se tient la caméra (au sud-est) ; un second bras
   s'enfonce derrière le temple jusqu'à une cascade, au fond, dans la brume. Au-delà des berges,
   des collines couvertes de forêt montent vers des sommets noyés dans les nuages. */
const PYR={H:33,half:9.2};   // gabarit du temple (lu par l'intro) — complété par 04_pagode

const JF={
  water:0,                                 // niveau du lagon
  camAz:0.42,camR:88,                      // la caméra : sur la berge, au bout du bras d'eau
  fallsAz:3.95,fallsR:106,                 // la cascade : au bout du bras qui passe derrière le temple
};
JF.cam=new THREE.Vector3(Math.sin(JF.camAz)*JF.camR,0,Math.cos(JF.camAz)*JF.camR);
JF.falls={x:Math.sin(JF.fallsAz)*JF.fallsR,z:Math.cos(JF.fallsAz)*JF.fallsR,top:30};
JF.falls.yaw=Math.atan2(-JF.falls.x,-JF.falls.z);   // la falaise regarde le temple
const angD=(a,b)=>{const d=a-b;return Math.atan2(Math.sin(d),Math.cos(d));};
/* rayon du rivage du lagon selon la direction (vue du temple) ; un second bras s'enfonce vers la cascade */
function lagoonR(a){
  const d1=angD(a,JF.camAz),d2=angD(a,JF.fallsAz);
  return 41-9*Math.exp(-d1*d1/0.06)+Math.exp(-d2*d2/0.035)*60+(5*Math.sin(3*a+0.7)+3.5*Math.sin(5*a+2.2)+2*Math.sin(9*a+1.1))*(1-0.85*Math.exp(-d1*d1/0.15));
}
/* le chenal : une rivière lente qui mène de la caméra au lagon, entre deux berges de terre.
   Demi-largeur selon la distance d à la caméra (les berges convergent vers le temple : lignes de fuite) */
function chanW(d){return 3.6+0.135*d+(Math.sin(d*0.21+1.3)*0.9+Math.sin(d*0.47+0.4)*0.45)*smooth(4,14,d);}
const smin=(a,b,k)=>{const h=Math.min(1,Math.max(0,0.5+0.5*(b-a)/k));return b+(a-b)*h-k*h*(1-h);};
function shoreD(x,z){   // < 0 : dans l'eau
  const sdL=Math.hypot(x,z)-lagoonR(Math.atan2(x,z));
  const dx=x-JF.cam.x,dz=z-JF.cam.z,d=-(dx*JF.cam.x+dz*JF.cam.z)/JF.camR,l=(dx*JF.cam.z-dz*JF.cam.x)/JF.camR;
  const sdC=Math.max(Math.abs(l)-chanW(Math.max(d,0))-(vn2(x*0.19+4.1,z*0.19)-0.5)*1.8*smooth(3,10,d),-(d+1.5));
  return smin(sdL,sdC,5);
}
/* écart angulaire à l'axe temple → caméra (0 = dans l'axe) */
function camWedge(x,z){return Math.abs(angD(Math.atan2(x,z),JF.camAz));}
/* repère de la falaise (x latéral, z vers le temple) */
function fallsLocal(x,z){const F=JF.falls,dx=x-F.x,dz=z-F.z,s=Math.sin(F.yaw),c=Math.cos(F.yaw);return {lx:dx*c-dz*s,lz:dx*s+dz*c};}

function groundH(x,z){
  /* chaque terme multiplié par un poids nul est sauté (résultat identique, ~2× plus rapide) */
  const r=Math.hypot(x,z),sd=shoreD(x,z);
  const wB=smooth(-4,0.8,sd);
  let h;
  // fond du lagon (vase sombre), puis la berge qui remonte doucement
  const bottom=wB<1?-0.7-Math.min(1,Math.max(0,-sd)/9)*2.9+(fbm2(x*0.08,z*0.08,3)-0.5)*0.7:0;
  // berge : pente douce depuis l'eau, petites bosses et creux (pas de dalle plate)
  let bank=0;
  if(wB>0){const k1=smooth(6,22,sd),k2=smooth(0.5,4,sd);
    bank=0.05+smooth(0,10,sd)*0.8+smooth(10,40,sd)*1.9;
    if(k1>0)bank+=(fbm2(x*0.05+3,z*0.05-1,4)-0.5)*2.6*k1;
    if(k2>0)bank+=(fbm2(x*0.22+7,z*0.22,3)-0.5)*0.5*k2;
    bank+=(fbm2(x*0.9,z*0.9,2)-0.5)*0.1;}
  h=wB===0?bottom:wB===1?bank:lerp(bottom,bank,wB);
  h=Math.max(h,lerp(-12,0.14,smooth(0.2,2.2,sd)));   // pas de flaques dans la forêt
  // collines boisées derrière le mur de jungle
  {const kh=smooth(25,170,sd);
   if(kh>0){const n=fbm2(x*0.0085+1.3,z*0.0085-0.7,5);h+=Math.max(0,n-0.28)*95*kh+smooth(18,120,sd)*7;}
   else h+=smooth(18,120,sd)*7;}
  // sommets lointains dans les nuages
  {const kp=smooth(240,650,r);
   if(kp>0){const m=1-Math.abs(fbm2(x*0.0032+7,z*0.0032-3,5)*2-1);h+=kp*(m*m*210+fbm2(x*0.012,z*0.012,3)*30);}}
  // crête et falaise de la cascade (habillée d'un maillage de roche) ; vasque au pied
  {const F=JF.falls,L=fallsLocal(x,z),ax=Math.abs(L.lx),dz=L.lz+3;
   const wx=smooth(90,38,ax),sg=smooth(8,24,ax);
   const front=lerp(smooth(0.5,-5,dz),smooth(16,-34,dz),sg),back=smooth(-110,-70,dz);
   const wk=wx*front*back;
   const crest=wk===0?0:(F.top+1+(sg>0?(fbm2(x*0.03,z*0.03,3)-0.5)*7*sg:0))*wx*front*back;
   h=Math.max(h,h*0.35+crest);}
  return h;
}
const duneH=groundH;   // compatibilité avec le moteur (projection, particules)

/* ── la flore est placée une fois ici (le sol en tient compte : ombre des couronnes) ── */
JF.trees=[];JF.rocks=[];JF.groves=[];JF.logs=[];
/* repères vus de la caméra : f = vers le temple, r = droite de l'écran */
JF.f=new THREE.Vector3(-JF.cam.x,0,-JF.cam.z).normalize();JF.r=new THREE.Vector3(-JF.f.z,0,JF.f.x);
/* point sur la berge : à d mètres devant la caméra, en partant sur le côté jusqu'à être à sdT m dans les terres */
function bankPoint(d,side,sdT){const p=new THREE.Vector3();for(let s=0;s<60;s+=0.25){p.copy(JF.cam).addScaledVector(JF.f,d).addScaledVector(JF.r,side*s);if(shoreD(p.x,p.z)>=sdT)break;}p.y=groundH(p.x,p.z);return p;}
/* point de berge vu sous un angle donné depuis la caméra d'accueil (négatif : à gauche), à sdT m dans les terres */
// on cherche la distance d à laquelle la berge du chenal (à sdT m dans les terres) est vue sous l'angle voulu
function rayBank(deg,sdT){const side=Math.sign(deg)||1,tg=Math.tan(Math.abs(deg)*Math.PI/180);let best=null;
  for(let d=18;d<58;d+=0.5){const p=bankPoint(d,side,sdT);const v=p.clone().sub(JF.cam);const l=Math.abs(v.dot(JF.r)),dd=v.dot(JF.f);
    if(l<=dd*tg){best=p;break;}best=p;}
  return best;}
(function placeFlora(){
  const rr=mulberry32(7712);const T=JF.trees;
  // les scènes de vie : cacaoyère (rive droite), campement des explorateurs perdus et sentier des chasseurs (rive gauche)
  // placées par l'angle sous lequel la caméra d'accueil les voit (entre les plantes du premier plan et le temple)
  // (distances choisies pour que la caméra d'accueil les voie entre le premier plan et le temple : ~15–20° de l'axe)
  JF.cacao=bankPoint(44,1,3.6);JF.cacao.r=5.5;
  JF.camp=bankPoint(40,-1,2.6);
  // le sentier des chasseurs : il sort de la forêt, longe la berge gauche, puis replonge sous les arbres avant le campement
  JF.huntPath=[bankPoint(28.5,-1,9),bankPoint(30,-1,4),bankPoint(31.5,-1,2.5),bankPoint(33.5,-1,2.4),bankPoint(35.5,-1,2.5),bankPoint(37,-1,4.5),bankPoint(37.8,-1,8.5)];
  const inZone=(x,z)=>Math.hypot(x-JF.cacao.x,z-JF.cacao.z)<JF.cacao.r||Math.hypot(x-JF.camp.x,z-JF.camp.z)<6||JF.huntPath.some(p=>Math.hypot(x-p.x,z-p.z)<4);
  JF.inZone=inZone;
  const ok=(x,z,sd0,sd1,sp)=>{const sd=shoreD(x,z);if(sd<sd0||sd>sd1)return false;
    if(Math.hypot(x-JF.cam.x,z-JF.cam.z)<9)return false;if(inZone(x,z))return false;
    for(const t of T){if(Math.hypot(t.x-x,t.z-z)<sp*(t.kind==='kapok'?1.3:0.85))return false;}return true;};
  const place=(kind,n,sd0,sd1,sp,opt={})=>{let k=0,g=0;while(k<n&&g<12000){g++;
    const a=rr()*Math.PI*2,r=30+rr()*150;const x=Math.sin(a)*r,z=Math.cos(a)*r;
    if(!ok(x,z,sd0,sd1,sp))continue;T.push(Object.assign({kind,x,z,y:groundH(x,z),seed:rr()},opt));k++;}};
  // fromagers géants (contreforts, lianes) qui dominent le mur de jungle
  place('kapok',26,9,38,13);
  // palmiers penchés au-dessus de l'eau, sur la bande de terre des berges
  place('palm',40,0.8,8,4.2);
  // arbres de canopée (en retrait : la berge reste dégagée), bananiers, fougères arborescentes
  place('broad',MOBILE?150:215,6.5,60,5.2);
  place('under',MOBILE?70:150,4.5,32,3.2);
  place('banana',60,3,18,3.0);
  place('treefern',40,4.5,28,3.8);
  // cacaoyers dans la clairière de la rive droite
  for(let k=0,g=0;k<8&&g<800;g++){const a=rr()*Math.PI*2,d=Math.sqrt(rr())*JF.cacao.r*0.85;const x=JF.cacao.x+Math.cos(a)*d,z=JF.cacao.z+Math.sin(a)*d;
    if(shoreD(x,z)<2.5)continue;if(T.some(t=>t.kind==='cacao'&&Math.hypot(t.x-x,t.z-z)<3.4))continue;T.push({kind:'cacao',x,z,y:groundH(x,z),seed:rr()});k++;}
  // bosquets de bambous
  for(let k=0,g=0;k<5&&g<600;g++){const a=rr()*Math.PI*2,r=50+rr()*60;const x=Math.sin(a)*r,z=Math.cos(a)*r;const sd=shoreD(x,z);
    if(sd<8||sd>24||camWedge(x,z)<0.22||inZone(x,z))continue;JF.groves.push({x,z,r:6+rr()*3,n:55+Math.floor(rr()*30)});k++;}
  // rochers moussus et troncs couchés sur les berges
  for(let i=0,g=0;i<70&&g<5000;g++){const a=rr()*Math.PI*2,r=30+rr()*120;const x=Math.sin(a)*r,z=Math.cos(a)*r;const sd=shoreD(x,z);
    if(sd<-1.2||sd>12)continue;if(Math.hypot(x-JF.cam.x,z-JF.cam.z)<34||inZone(x,z))continue;JF.rocks.push({x,z,s:0.6+rr()*1.6,seed:rr(),moss:1});i++;}
  JF.rocks.forEach(o=>o.y=groundH(o.x,o.z));
  for(let i=0,g=0;i<14&&g<4000;g++){const a=rr()*Math.PI*2,r=34+rr()*100;const x=Math.sin(a)*r,z=Math.cos(a)*r;const sd=shoreD(x,z);
    if(sd<-2||sd>8||inZone(x,z)||Math.hypot(x-JF.cam.x,z-JF.cam.z)<62)continue;JF.logs.push({x,z,a:rr()*Math.PI,L:5+rr()*7,r:0.35+rr()*0.35,seed:rr()});i++;}
  // lanternes : quatre aux angles du soubassement, six à moitié noyées dans le bras d'eau
  JF.lanterns=[[7.6,7.6,0,2],[-7.6,7.6,0,2],[7.6,-7.6,0,2],[-7.6,-7.6,0,2]];
  for(let i=0;i<6;i++){const d=19+i*5.4,side=i%2?1:-1;const p=JF.cam.clone().addScaledVector(JF.f,d).addScaledVector(JF.r,side*chanW(d)*0.5);
    JF.lanterns.push([p.x,p.z,(rr()-0.5)*0.32,1]);}
})();

/* ── carte des éléments du sol (proche, ±160 m) : rive humide, ombre des couronnes ── */
function bakeJungleData(N,E,trees,groves){
  /* ombre des couronnes : chaque arbre ne touche que les pixels de son rayon d'influence
     (même somme, dans le même ordre, que la boucle complète — ~100× plus rapide) */
  const d=new Uint8Array(N*N*4),AO=new Float64Array(N*N);
  const R={kapok:12,broad:7,under:3,palm:3.5,banana:2.2,treefern:2.5,cacao:3};
  const px=i=>((i+0.5)/N*2-1)*E,ix=v=>(v/E+1)/2*N-0.5;
  const range=(c,rad)=>[Math.max(0,Math.floor(ix(c-rad))-1),Math.min(N-1,Math.ceil(ix(c+rad))+1)];
  const XS=new Float64Array(N);for(let i=0;i<N;i++)XS[i]=px(i);
  for(const t of trees){const rr=R[t.kind]||5,lim=rr*rr*5,ex=t.kind==='kapok'||t.kind==='broad',c2=(t.kind==='kapok'?3.2:1.4)**2;
    const [i0,i1]=range(t.x,Math.sqrt(lim)),[j0,j1]=range(t.z,Math.sqrt(lim));
    for(let j=j0;j<=j1;j++){const z=XS[j];for(let i=i0;i<=i1;i++){const x=XS[i];
      const dd=(t.x-x)**2+(t.z-z)**2;if(dd<lim)AO[j*N+i]+=Math.exp(-dd/(rr*rr))+(ex?Math.exp(-dd/c2)*0.6:0);}}}
  for(const g of groves){const k=g.r*g.r*1.4,rad=Math.sqrt(k*24);   // au-delà : contribution < 1e-10
    const [i0,i1]=range(g.x,rad),[j0,j1]=range(g.z,rad);
    for(let j=j0;j<=j1;j++){const z=XS[j];for(let i=i0;i<=i1;i++){const x=XS[i];const dd=(g.x-x)**2+(g.z-z)**2;AO[j*N+i]+=Math.exp(-dd/k)*0.8;}}}
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){
    const x=XS[i],z=XS[j],q=j*N+i,k=q*4;
    const sd=shoreD(x,z);
    d[k]=Math.round(255*smooth(8,0,sd)*(sd>-2?1:0.6));
    d[k+1]=Math.round(255*Math.min(1,AO[q]));
    d[k+2]=Math.round(255*smooth(-0.5,-6,sd));
    d[k+3]=Math.round(255*smooth(12,26,sd));
  }
  return d;
}
/* ── calculs du relief (grilles de hauteurs + carte du sol) : dans un fil à part (Web Worker),
   pendant que le reste de la jungle se construit. Mêmes fonctions, mêmes nombres, au bit près. ── */
const terrainParams=()=>({N:MOBILE?220:320,E:900,n2:110,M:MOBILE?70:120,HN:320,HE:170,BN:MOBILE?512:1024,BE:160});
function terrainCompute(P,trees,groves,noBake){
  const M1=P.N+1,X=new Float32Array(M1),Hh=new Float32Array(M1*M1);
  const map=t=>{const v=t*2-1;return Math.sign(v)*v*v*P.E;};
  for(let i=0;i<=P.N;i++)X[i]=map(i/P.N);
  for(let j=0;j<=P.N;j++)for(let i=0;i<=P.N;i++)Hh[j*M1+i]=groundH(X[i],X[j]);
  const mp=t=>{const v=t*2-1;return Math.sign(v)*v*v*420;};
  const R=new Float64Array((P.n2+1)*(P.n2+1));let w=0;
  for(let j=0;j<=P.n2;j++)for(let i=0;i<=P.n2;i++){R[w++]=groundH(mp(i/P.n2),mp(j/P.n2));}
  const Wr=new Float64Array((P.M+1)*(P.M+1));w=0;
  for(let j=0;j<=P.M;j++){const z=mp(j/P.M);for(let i=0;i<=P.M;i++){Wr[w++]=groundH(mp(i/P.M),z);}}
  const Hm=new Float64Array(P.HN*P.HN);
  for(let j=0;j<P.HN;j++)for(let i=0;i<P.HN;i++){Hm[j*P.HN+i]=groundH((i/(P.HN-1)*2-1)*P.HE,(j/(P.HN-1)*2-1)*P.HE);}
  const bake=noBake?null:bakeJungleData(P.BN,P.BE,trees,groves);
  return {Hh,R,Wr,Hm,bake};
}
const TERR={p:null,ms:0,worker:false};
function terrainWorkerSrc(){
  const jf={water:JF.water,camAz:JF.camAz,camR:JF.camR,fallsAz:JF.fallsAz,fallsR:JF.fallsR,cam:{x:JF.cam.x,y:JF.cam.y,z:JF.cam.z},falls:{x:JF.falls.x,z:JF.falls.z,top:JF.falls.top,yaw:JF.falls.yaw}};
  return '"use strict";\nconst JF='+JSON.stringify(jf)+';\n'
    +['smooth','lerp','angD','smin'].map(k=>'const '+k+'='+({smooth,lerp,angD,smin})[k].toString()+';').join('\n')+'\n'
    +'const H2N=1<<18,H2M=H2N-1,H2X=new Int32Array(H2N),H2Y=new Int32Array(H2N),H2V=new Float64Array(H2N).fill(NaN);\n'
    +[h2,h2i,vn2,fbm2,lagoonR,chanW,shoreD,fallsLocal,groundH,bakeJungleData,terrainCompute].map(f=>f.toString()).join('\n')
    +'\nconst FIN_C='+JSON.stringify({x:FIN_C.x,y:FIN_C.y,z:FIN_C.z})+',TER='+JSON.stringify(TER)+',SHRINE_LV='+SHRINE_LV+',STELE_LV='+STELE_LV+';\n'
    +[fract1,finField,finGridCompute].map(f=>f.toString()).join('\n')
    +'\nonmessage=e=>{if(e.data.bakeOnly){const P=e.data.P,t9=performance.now();const b=bakeJungleData(P.BN,P.BE,e.data.trees,e.data.groves);postMessage({bake:b,ms:performance.now()-t9},[b.buffer]);return;}'
    +'const t0=performance.now();const r=terrainCompute(e.data.P,e.data.trees,e.data.groves,e.data.noBake);r.ms=performance.now()-t0;postMessage(r,[r.Hh.buffer,r.R.buffer,r.Wr.buffer,r.Hm.buffer].concat(r.bake?[r.bake.buffer]:[]));'
    +'const t1=performance.now();const f=finGridCompute(e.data.G);f.ms=performance.now()-t1;postMessage({fin:f},[f.X.buffer,f.Z.buffer,f.h.buffer,f.w.buffer,f.st.buffer,f.t.buffer,f.rb.buffer,f.Hm.buffer]);};';
}
/* lancé dès le début du chargement ; si les workers sont indisponibles, calcul sur place */
function terrainStart(){
  const P=terrainParams(),trees=JF.trees.map(t=>({x:t.x,z:t.z,kind:t.kind})),groves=JF.groves.map(g=>({x:g.x,z:g.z,r:g.r}));
  const local=()=>{const t0=performance.now();const r=terrainCompute(P,trees,groves);r.ms=performance.now()-t0;return r;};
  if((navigator.hardwareConcurrency||4)<=2&&!Q.has('worker')){TERR.p=null;return null;}   // deux cœurs : le fil à part ne ferait que ralentir le reste
  TERR.p=new Promise(res=>{
    try{const url=URL.createObjectURL(new Blob([terrainWorkerSrc()],{type:'text/javascript'}));const w=new Worker(url);
      // ≥ 4 cœurs : la carte du sol part dans un second fil, en parallèle des grilles de hauteurs (mêmes nombres)
      const two=(navigator.hardwareConcurrency||4)>=4;let w2=null,bakeP=null;
      if(two){try{w2=new Worker(url);bakeP=new Promise((ok,ko)=>{w2.onmessage=e=>{RV_BOOT.push(['bakeCalc',Math.round(e.data.ms)]);ok(e.data.bake);w2.terminate();};w2.onerror=e=>{e.preventDefault&&e.preventDefault();ko(e);};});
        w2.postMessage({bakeOnly:true,P,trees,groves});}catch(e){w2=null;bakeP=null;}}
      let finRes;FINPRE.p=new Promise(r2=>{finRes=r2;});
      w.onmessage=e=>{if(e.data.fin){FINPRE.r=e.data.fin;RV_BOOT.push(['finCalc',Math.round(e.data.fin.ms)]);finRes();w.terminate();URL.revokeObjectURL(url);}
        else{TERR.worker=true;const r=e.data;
          if(bakeP)bakeP.then(b=>{r.bake=b;res(r);},()=>{r.bake=bakeJungleData(P.BN,P.BE,trees,groves);res(r);});else res(r);}};
      w.onerror=e=>{console.warn('terrain worker',e.message);e.preventDefault&&e.preventDefault();finRes&&finRes();res(local());};
      w.postMessage({P,trees,groves,G:finGridParams(),noBake:!!bakeP});
    }catch(e){res(local());}
  });
  return TERR.p;
}
/* textures du sol créées tout de suite (les matériaux s'y branchent) ; remplies à l'arrivée des calculs */
function terrainPrep(){
  const P=terrainParams();
  JF.tex=new THREE.DataTexture(new Uint8Array(P.BN*P.BN*4),P.BN,P.BN,THREE.RGBAFormat,THREE.UnsignedByteType);
  JF.tex.magFilter=THREE.LinearFilter;JF.tex.minFilter=THREE.LinearFilter;
  const ht=new THREE.DataTexture(new Uint16Array(P.HN*P.HN),P.HN,P.HN,THREE.RedFormat,THREE.HalfFloatType);
  ht.minFilter=ht.magFilter=THREE.LinearFilter;
  JF.heightTex=ht;JF.HE=P.HE;
  return {heightTex:ht,heightExtent:P.HE};
}
function buildTerrain(R){
  if(!R){const P0=terrainParams();R=terrainCompute(P0,JF.trees,JF.groves);}
  if(!JF.tex)terrainPrep();
  const TP=terrainParams(),N=TP.N,E=TP.E;
  const g=new THREE.BufferGeometry();
  const pos=new Float32Array((N+1)*(N+1)*3),nor=new Float32Array((N+1)*(N+1)*3);
  const map=t=>{const v=t*2-1;return Math.sign(v)*v*v*E;};
  const M1=N+1,X=new Float32Array(M1),Hh=new Float32Array(M1*M1);
  for(let i=0;i<=N;i++)X[i]=map(i/N);
  Hh.set(R.Hh);
  let p=0;
  for(let j=0;j<=N;j++)for(let i=0;i<=N;i++){
    const i0=Math.max(0,i-1),i1=Math.min(N,i+1),j0=Math.max(0,j-1),j1=Math.min(N,j+1);
    const hx=(Hh[j*M1+i1]-Hh[j*M1+i0])/(X[i1]-X[i0]),hz=(Hh[j1*M1+i]-Hh[j0*M1+i])/(X[j1]-X[j0]);
    const l=Math.hypot(hx,1,hz);
    pos[p]=X[i];pos[p+1]=Hh[j*M1+i];pos[p+2]=X[j];nor[p]=-hx/l;nor[p+1]=1/l;nor[p+2]=-hz/l;p+=3;}
  const idx=new Uint32Array(N*N*6);let q=0;
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){const a=j*(N+1)+i,b=a+1,c=a+N+1,d=c+1;idx[q++]=a;idx[q++]=c;idx[q++]=b;idx[q++]=b;idx[q++]=c;idx[q++]=d;}
  g.setAttribute('position',new THREE.BufferAttribute(pos,3));
  g.setAttribute('normal',new THREE.BufferAttribute(nor,3));
  g.setIndex(new THREE.BufferAttribute(idx,1));
  g.computeBoundingSphere();

  JF.tex.image.data.set(R.bake);JF.tex.needsUpdate=true;
  const la=JF.lanterns.map(l=>new THREE.Vector3(l[0],0,l[1]));
  const TU={uJF:{value:JF.tex},uLants:{value:la},uWY:{value:JF.water},
    uLit:{value:tx('ground_litter')},uLitN:{value:tx('ground_litter_n')},uMoss:{value:tx('ground_moss')},uMossN:{value:tx('ground_moss_n')},
    uMud:{value:tx('ground_mud')},uMudN:{value:tx('ground_mud_n')},uRock:{value:tx('rock')},uRockN:{value:tx('rock_n')},uCan:{value:tx('canopy')},uCanN:{value:tx('canopy_n')}};
  const mat=patch(new THREE.MeshStandardMaterial({color:new THREE.Color('#ffffff'),roughness:0.95,metalness:0}),{
    uniforms:TU,
    fHead:`uniform sampler2D uJF;uniform vec3 uLants[10];uniform float uWY;
      uniform sampler2D uLit;uniform sampler2D uLitN;uniform sampler2D uMoss;uniform sampler2D uMossN;uniform sampler2D uMud;uniform sampler2D uMudN;uniform sampler2D uRock;uniform sampler2D uRockN;uniform sampler2D uCan;uniform sampler2D uCanN;
      vec4 rvJ=vec4(0.0);float rvDap=1.0;float rvWet=0.0;float rvCaus=0.0;vec4 rvNm=vec4(0.5,0.5,1.0,0.9);
      // mélange par hauteur : les transitions suivent le relief des textures (pas de fondu baveux)
      vec4 rvHB(vec4 w,vec4 h){vec4 x=w*(0.35+h);float m=max(max(x.x,x.y),max(x.z,x.w))-0.18;vec4 r=max(x-m,0.0);return r/max(r.x+r.y+r.z+r.w,1e-4);}`,
    fDiscard:`
      {float lD=length(vRvW.xz);if(lD>uTerrainReveal-16.0){float rrD=lD+(rvFbm3(vec3(vRvW.xz*0.05,2.0))-0.5)*30.0;
      if(rrD>uTerrainReveal) discard;}}`,
    fColor:`
      vec2 pp=vRvW.xz;float rr=length(pp);
      float slope=1.0-clamp(vRvN.y,0.0,1.0);
      rvJ=(abs(pp.x)<159.0&&abs(pp.y)<159.0)?texture2D(uJF,pp/320.0+0.5):vec4(0.0,0.6,0.0,1.0);
      // deux échelles de litière, alternées par grandes plages (aucune répétition visible)
      float mac=rvFbm3(vec3(pp*0.022,1.0));
      vec2 uL=pp/3.4;vec2 uL2=vec2(pp.y,-pp.x)/4.3+0.37;
      vec4 lA=texture2D(uLit,uL),lB=texture2D(uLit,uL2);float lm=smoothstep(0.42,0.58,mac);
      vec4 lit=mix(lA,lB,lm);vec4 litN=mix(texture2D(uLitN,uL),texture2D(uLitN,uL2),lm);
      vec4 mos=texture2D(uMoss,pp/2.6),mosN=texture2D(uMossN,pp/2.6);
      vec4 mud=texture2D(uMud,pp/3.0),mudN=texture2D(uMudN,pp/3.0);
      vec2 uR=abs(vRvN.x)>abs(vRvN.z)?vec2(pp.y,vRvW.y):vec2(pp.x,vRvW.y);uR=mix(pp,uR,smoothstep(0.35,0.6,slope))/4.5;
      vec4 rck=texture2D(uRock,uR),rckN=texture2D(uRockN,uR);
      float mp=smoothstep(0.4,0.66,rvFbm3(vec3(pp*0.045,5.0)))*(1.0-rvJ.g*0.5);
      // berge : vase mouillée au bord de l'eau, puis une bande de terre battue (latérite) avant le mur de jungle
      rvWet=smoothstep(0.6,0.95,rvJ.r);float earth=smoothstep(0.04,0.35,rvJ.r)*(1.0-rvWet)*(1.0-smoothstep(0.42,0.62,slope));
      // terre battue : latérite brun-rouge, semée de feuilles mortes
      {float md=dot(mud.rgb,vec3(0.333))/0.0065;vec3 lat=vec3(0.115,0.06,0.03)*clamp(0.4+0.6*md,0.3,1.7)*mix(0.8,1.15,rvNoise(vec3(pp*0.12,5.0)));
       lat=mix(lat,lit.rgb*1.15,smoothstep(0.42,0.72,rvNoise(vec3(pp*0.35,3.0)))*0.6);
       mud.rgb=mix(mud.rgb,lat,earth*(0.75+0.25*rvNoise(vec3(pp*0.4,7.0))));mudN=mix(mudN,vec4(mix(mudN.xyz,litN.xyz,0.4),0.9),earth);}
      vec4 w=vec4((1.0-mp)*(1.0-earth*0.75),mp*0.9*(1.0-earth),rvWet*1.3+earth*1.1,smoothstep(0.42,0.62,slope)*1.6);
      vec4 hh=vec4(dot(lit.rgb,vec3(1.2)),dot(mos.rgb,vec3(1.5)),dot(mud.rgb,vec3(1.0))+0.2,dot(rck.rgb,vec3(1.0)));
      vec4 bw=rvHB(w,hh);
      vec3 ground=lit.rgb*bw.x+mos.rgb*bw.y+mud.rgb*bw.z+rck.rgb*bw.w;
      rvNm=litN*bw.x+mosN*bw.y+mudN*bw.z+rckN*bw.w;
      ground*=mix(0.86,1.1,rvFbm3(vec3(pp*0.06,3.0)));
      ground=mix(ground,ground*0.62,rvJ.g*0.55*(1.0-earth*0.6));      // sous les couronnes, au pied des troncs
      // fond du lagon : vase, puis l'eau assombrit ; reflets de lumière ondulants (caustiques)
      float uw=smoothstep(uWY+0.05,uWY-0.35,vRvW.y);
      ground=mix(ground,mud.rgb*0.55,uw);
      {vec2 q=pp*1.15;float c1=rvNoise(vec3(q+vec2(uTime*0.11,uTime*0.07),uTime*0.35)),c2=rvNoise(vec3(q*1.37-vec2(uTime*0.09,-uTime*0.12),uTime*0.27+5.0));
       rvCaus=pow(1.0-abs(c1-c2),9.0)*uw*exp(-max(uWY-vRvW.y,0.0)*0.9);}
      // au-delà du mur de jungle : le tapis de la canopée vu d'en haut
      float cnK=rvJ.a*(1.0-smoothstep(0.55,0.75,slope)*0.6);
      vec4 cn=texture2D(uCan,pp/7.0),cnN=texture2D(uCanN,pp/7.0);
      ground=mix(ground,cn.rgb*mix(0.85,1.15,rvNoise(vec3(pp*0.03,9.0))),cnK);rvNm=mix(rvNm,cnN,cnK);
      diffuseColor.rgb=ground;
      // taches de lumière sous les feuillages
      {float under=clamp(max(rvJ.g,smoothstep(70.0,120.0,rr))*(1.0-rvJ.b),0.0,1.0);float dn=rvFbm3(vec3(pp*0.3+vec2(uTime*0.03,uTime*0.02),uTime*0.05));
       rvDap=mix(1.0,0.22+0.78*smoothstep(0.42,0.62,dn),under);}`,
    fRough:`roughnessFactor=clamp(rvNm.a,0.05,1.0);`,
    fNormal:`
      {vec3 nt=rvNm.xyz*2.0-1.0;nt.xy*=1.15;
       vec3 Nw=normalize(vRvN);vec3 Tw=normalize(vec3(1.0,0.0,0.0)-Nw*Nw.x);vec3 Bw=cross(Nw,Tw);
       vec3 nw=normalize(Tw*nt.x-Bw*nt.y+Nw*nt.z);
       normal=normalize((viewMatrix*vec4(nw,0.0)).xyz);}`,
    fEmissive:`
      if(uLantern>0.01){vec3 lc=vec3(1.0,0.6,0.28);float s=0.0;
        for(int i=0;i<10;i++){vec2 dl=vRvW.xz-uLants[i].xz;s+=exp(-dot(dl,dl)/6.0);}
        totalEmissiveRadiance+=diffuseColor.rgb*lc*s*uLantern*0.8;}
      if(uRevealGlow>0.001){float lE=length(vRvW.xz);if(lE>uTerrainReveal-22.0){float rrE=lE+(rvFbm3(vec3(vRvW.xz*0.05,2.0))-0.5)*30.0;
      totalEmissiveRadiance+=uRevealColor*smoothstep(uTerrainReveal-6.0,uTerrainReveal,rrE)*uRevealGlow*0.75;}}`,
    reps:[['#include <lights_fragment_maps>','#include <lights_fragment_maps>\nreflectedLight.directDiffuse*=rvDap*(1.0+rvCaus*6.0);reflectedLight.directSpecular*=rvDap;']],
  },'jgnd');
  const mesh=new THREE.Mesh(g,mat);
  mesh.receiveShadow=true;
  scene.add(mesh);
  // version allégée du sol pour le reflet du lagon (seules les berges y comptent)
  {const n2=TP.n2,rp=new Float32Array((n2+1)*(n2+1)*3);let w2=0;const mp=t=>{const v=t*2-1;return Math.sign(v)*v*v*420;};
   let kR=0;for(let j=0;j<=n2;j++)for(let i=0;i<=n2;i++){const x=mp(i/n2),z=mp(j/n2);rp[w2++]=x;rp[w2++]=R.R[kR++];rp[w2++]=z;}
   const ri=[];for(let j=0;j<n2;j++)for(let i=0;i<n2;i++){const a=j*(n2+1)+i,b=a+1,c=a+n2+1,d=c+1;ri.push(a,c,b,b,c,d);}
   const rg=new THREE.BufferGeometry();rg.setAttribute('position',new THREE.BufferAttribute(rp,3));rg.setIndex(ri);rg.computeVertexNormals();
   const rm=new THREE.Mesh(rg,mat);rm.layers.set(1);scene.add(rm);}

  /* Filaire du terrain (révélation) */
  const M=TP.M;
  const wpos=new Float32Array((M+1)*(M+1)*3);let w=0;
  const map2=t=>{const v=t*2-1;return Math.sign(v)*v*v*420;};
  let kW=0;for(let j=0;j<=M;j++){const z=map2(j/M);for(let i=0;i<=M;i++){const x=map2(i/M);wpos[w++]=x;wpos[w++]=Math.max(R.Wr[kW++],JF.water)+0.12;wpos[w++]=z;}}
  const li=[];for(let j=0;j<=M;j++)for(let i=0;i<=M;i++){const a=j*(M+1)+i;if(i<M)li.push(a,a+1);if(j<M)li.push(a,a+M+1);if(i<M&&j<M&&((i+j)%3===0))li.push(a,a+M+2);}
  const wg=new THREE.BufferGeometry();wg.setAttribute('position',new THREE.BufferAttribute(wpos,3));wg.setIndex(li);
  const wire=new THREE.LineSegments(wg,REVEAL_WIRE_MAT);wire.frustumCulled=false;wire.renderOrder=2;
  scene.add(wire);

  /* Carte des hauteurs (particules, profondeur de l'eau) */
  const HN=TP.HN,HE=TP.HE,ht=JF.heightTex,hd=ht.image.data;
  for(let k=0;k<HN*HN;k++)hd[k]=THREE.DataUtils.toHalfFloat(R.Hm[k]);
  ht.needsUpdate=true;
  return {mesh,wire,heightTex:ht,heightExtent:HE};
}

/* filaire de révélation partagé (arbres, rochers, lanternes…) et apparition radiale */
const REVEAL_WIRE_MAT=new THREE.ShaderMaterial({uniforms:U,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
  vertexShader:`varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.0);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
  fragmentShader:"#define RV_FRAG\n"+GLSL_NOISE+`uniform float uTerrainWire;uniform float uTerrainReveal;uniform float uWireAlpha;uniform vec3 uRevealColor;uniform float uFogDensity;
    varying vec3 vW;
    void main(){
      float rr=length(vW.xz)+(rvFbm3(vec3(vW.xz*0.05,2.0))-0.5)*30.0;
      if(rr>uTerrainWire) discard;
      float front=smoothstep(uTerrainWire-30.0,uTerrainWire,rr);
      float solid=step(rr,uTerrainReveal);
      float fog=exp(-length(cameraPosition-vW)*uFogDensity*0.8);
      float a=uWireAlpha*(0.3+0.85*front)*mix(1.0,0.1,solid)*fog;
      gl_FragColor=vec4(uRevealColor*a,a);
    }`});
const GLSL_TREVEAL=`
  {float lT=length(vRvW.xz);if(lT>uTerrainReveal-16.0){float rrT=lT+(rvFbm3(vec3(vRvW.xz*0.05,2.0))-0.5)*30.0;
  if(rrT>uTerrainReveal) discard;}}`;
const GLSL_TREVEAL_E=`
  if(uRevealGlow>0.001){float lTE=length(vRvW.xz);if(lTE>uTerrainReveal-21.0){float rrTE=lTE+(rvFbm3(vec3(vRvW.xz*0.05,2.0))-0.5)*30.0;
  totalEmissiveRadiance+=uRevealColor*smoothstep(uTerrainReveal-5.0,uTerrainReveal,rrTE)*uRevealGlow*0.9;}}`;

/* ═══ 04 · Pagode à cinq toits, oubliée au milieu du lagon ═══
   Soubassement de granit qui plonge dans l'eau, cinq étages de bois vermillon et d'enduit patinés,
   toits de cuivre vert-de-gris envahis de mousse et de plantes, lianes qui pendent des avant-toits,
   clochettes de bronze aux angles, flèche (sōrin) à neuf anneaux.
   Sous la souris, les pans de toit se soulèvent un à un (comme les pierres de la pyramide de la
   L2) et dévoilent la lumière dorée qui dort sous les charpentes. Le panneau « L1 » (gaku) est
   accroché au-dessus de la porte. */
const PAG=(function(){
  const plH=1.3,plHW=8.6;
  const hw=[4.7,4.05,3.45,2.9,2.4],h=[3.5,2.15,2.0,1.9,1.85],ov=[3.5,3.25,3.05,2.9,2.8];
  const rise=[1.45,1.35,1.3,1.25,2.6],up=[1.05,0.95,0.88,0.82,0.78],brk=0.95,thick=0.5;
  const T=[];let yb=plH;
  for(let i=0;i<5;i++){const yE=yb+h[i]+brk;
    T.push({i,hw:hw[i],h:h[i],yb,yE,R:hw[i]+ov[i],rIn:i<4?hw[i+1]+0.05:0.55,rise:rise[i],up:up[i],thick,sIn:hw[i]+0.35,ySIn:yE-0.06});
    yb=yE+rise[i];}
  return {plH,plHW,T,apex:yb,brk};
})();
PYR.H=PAG.apex+7.4;PYR.half=PAG.plHW;

function paintPlaqueL1(){
  const W=512,H=340,cv=document.createElement('canvas');cv.width=W;cv.height=H;const c=cv.getContext('2d');
  // laque noire veinée
  const bg=c.createLinearGradient(0,0,0,H);bg.addColorStop(0,'#1d1510');bg.addColorStop(1,'#0c0806');c.fillStyle=bg;c.fillRect(0,0,W,H);
  for(let i=0;i<900;i++){c.fillStyle='rgba(255,220,180,'+(Math.random()*0.025)+')';c.fillRect(Math.random()*W,Math.random()*H,Math.random()*40+4,1);}
  // cadre vermillon, filet d'or
  c.strokeStyle='#8e2219';c.lineWidth=26;c.strokeRect(13,13,W-26,H-26);
  const gold=c.createLinearGradient(0,40,0,H-40);gold.addColorStop(0,'#f7dc8e');gold.addColorStop(0.45,'#c18c34');gold.addColorStop(0.55,'#e9c264');gold.addColorStop(1,'#a8762a');
  c.strokeStyle=gold;c.lineWidth=5;c.strokeRect(30,30,W-60,H-60);
  // « L1 » au pinceau d'or
  c.strokeStyle=gold;c.lineCap='round';c.lineJoin='round';
  c.lineWidth=34;c.beginPath();c.moveTo(150,84);c.quadraticCurveTo(146,170,148,248);c.quadraticCurveTo(200,244,262,250);c.stroke();
  c.lineWidth=32;c.beginPath();c.moveTo(318,118);c.quadraticCurveTo(350,100,372,74);c.quadraticCurveTo(370,170,372,250);c.stroke();
  c.lineWidth=26;c.beginPath();c.moveTo(322,252);c.lineTo(422,250);c.stroke();
  // reflets
  c.globalCompositeOperation='lighter';c.strokeStyle='rgba(255,240,200,0.25)';c.lineWidth=6;
  c.beginPath();c.moveTo(140,90);c.lineTo(140,240);c.stroke();c.beginPath();c.moveTo(362,86);c.lineTo(362,240);c.stroke();
  c.globalCompositeOperation='source-over';
  const t=new THREE.CanvasTexture(cv);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;
}

/* ── pan de toit (côté +z) : tuiles dessus, chevrons dessous, rive, joues ── */
function roofTop(t,u,v){const s=t.R+(t.rIn-t.R)*v,au=Math.abs(u);
  let y=t.yE+t.rise*Math.pow(v,1.45)+t.up*Math.pow(au,2.6)*Math.pow(1-v,1.8);
  y+=0.17*smooth(0.935,0.995,au)*(1-0.4*v);
  return new THREE.Vector3(u*s,y,s);}
function roofBot(t,u,v){const s=t.R+(t.sIn-t.R)*v,au=Math.abs(u),y0=t.yE-t.thick;
  const y=y0+(t.ySIn-y0)*Math.pow(v,0.8)+t.up*0.93*Math.pow(au,2.6)*Math.pow(1-v,1.8);
  return new THREE.Vector3(u*s,y,s);}
function gridGeo(nu,nv,fn,attr,outDir){
  const pos=[],at=[],idx=[];
  for(let j=0;j<=nv;j++)for(let i=0;i<=nu;i++){const r=fn(i/nu,j/nv);pos.push(r.p.x,r.p.y,r.p.z);at.push(...r.a);}
  for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){const a=j*(nu+1)+i,b=a+1,c=a+nu+1,d=c+1;idx.push(a,b,c,b,d,c);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('aRoof',new THREE.Float32BufferAttribute(at,4));g.setIndex(idx);
  // orientation : la normale du triangle central doit regarder vers outDir(p)
  const m=Math.floor(nv/2)*(nu+1)+Math.floor(nu/2);const P=k=>new THREE.Vector3(pos[k*3],pos[k*3+1],pos[k*3+2]);
  const n=P(m+1).sub(P(m)).cross(P(m+nu+1).sub(P(m)));if(n.dot(outDir(P(m)))<0){for(let k=0;k<idx.length;k+=3){const s=idx[k+1];idx[k+1]=idx[k+2];idx[k+2]=s;}g.setIndex(idx);}
  g.computeVertexNormals();return g;
}
function roofPanelGeo(t){
  const NU=MOBILE?22:30,NV=MOBILE?9:13;
  // longueur de pente cumulée (pour des rangs de tuiles réguliers)
  const slopeAt=(u,v,fn)=>{let s=0,p=fn(t,u,0);const n=12;for(let k=1;k<=n;k++){const q=fn(t,u,v*k/n);s+=q.distanceTo(p);p=q;}return s;};
  const top=gridGeo(NU,NV,(a,b)=>{const u=a*2-1,p=roofTop(t,u,b);return {p,a:[p.x,slopeAt(u,b,roofTop),0,Math.abs(u)]};},0,()=>new THREE.Vector3(0,1,0));
  const bot=gridGeo(NU,NV,(a,b)=>{const u=a*2-1,p=roofBot(t,u,b);return {p,a:[p.x,(t.R-p.z),1,Math.abs(u)]};},0,()=>new THREE.Vector3(0,-1,0));
  const fas=gridGeo(NU,2,(a,b)=>{const u=a*2-1,p=roofTop(t,u,0).lerp(roofBot(t,u,0),b);return {p,a:[p.x,b,2,Math.abs(u)]};},0,()=>new THREE.Vector3(0,0,1));
  const side=sg=>gridGeo(NV,2,(a,b)=>{const p=roofTop(t,sg,a).lerp(roofBot(t,sg,a),b);return {p,a:[p.z,b,3,1]};},0,()=>new THREE.Vector3(sg,0,-1));
  const inner=gridGeo(NU,2,(a,b)=>{const u=a*2-1,p=roofTop(t,u,1).lerp(roofBot(t,u,1),b);return {p,a:[p.x,b,3,Math.abs(u)]};},0,()=>new THREE.Vector3(0,0,-1));
  const g=mergeGeometries([top,bot,fas,side(1),side(-1),inner]);
  g.setAttribute('aLift',new THREE.InstancedBufferAttribute(new Float32Array(4),1));
  return g;
}

function buildPyramid(){
  const grp=new THREE.Group();scene.add(grp);
  const {T,plH,plHW,apex}=PAG;
  const GLSL_PREV=`
      if(vRvW.y<uPyrReveal+0.8){float yy=vRvW.y+(rvFbm3(vec3(vRvW.xz*0.35,0.0))-0.5)*1.6;
      if(yy<uPyrReveal) discard;}`;
  const GLSL_PREV_E=`
      if(uRevealGlow>0.001&&vRvW.y<uPyrReveal+2.0){float yyE=vRvW.y+(rvFbm3(vec3(vRvW.xz*0.35,0.0))-0.5)*1.6;
      totalEmissiveRadiance+=uRevealColor*smoothstep(uPyrReveal+1.2,uPyrReveal,yyE)*uRevealGlow*1.3;}`;
  const HOVER=`float dH=length(vRvW-uHover);float rvHG=exp(-dH*dH/18.0)*uHoverAmt;`;

  /* ─── corps : murs, frises de consoles, cœur lumineux, soubassement, balcons ─── */
  const parts=[];
  const addBox=(w,hh,d,x,y,z,b)=>{const g=new THREE.BoxGeometry(w,hh,d);g.translate(x,y,z);const n=g.attributes.position.count;const a=new Float32Array(n*4);for(let k=0;k<n;k++)a.set(b,k*4);g.setAttribute('aB',new THREE.BufferAttribute(a,4));g.deleteAttribute('uv');parts.push(g);return g;};
  // soubassement + marches (devant)
  const PB=-4;   // le soubassement plonge jusqu'au fond du lagon
  addBox(plHW*2,plH-PB,plHW*2,0,(plH+PB)/2,0,[plHW,plH-PB,PB,3]);
  for(let s=0;s<5;s++){const top=plH-(s+1)*0.42;addBox(3.6,top-PB,0.6,0,(top+PB)/2,plHW+0.3+s*0.6,[1.8,top-PB,PB,3]);}
  T.forEach(t=>{
    addBox(t.hw*2,t.h,t.hw*2,0,t.yb+t.h/2,0,[t.hw,t.h,t.yb,0]);                        // murs
    addBox(t.sIn*2,PAG.brk-0.05,t.sIn*2,0,t.yb+t.h+(PAG.brk-0.05)/2,0,[t.sIn,PAG.brk,t.yb+t.h,1]);   // frise de consoles
    // cœur : sous le toit, épouse la pente (tronc de pyramide) ; il s'illumine sous la souris
    const top=t.rIn-0.12,bot=t.R-1.25,y0=t.yE-0.02,y1=t.yE+t.rise-0.14;
    const cg=new THREE.CylinderGeometry(top*Math.SQRT2,bot*Math.SQRT2,y1-y0,4,1,true);cg.rotateY(Math.PI/4);cg.translate(0,(y0+y1)/2,0);
    const n=cg.attributes.position.count,a=new Float32Array(n*4);for(let k=0;k<n;k++)a.set([t.hw,1,y0,2],k*4);cg.setAttribute('aB',new THREE.BufferAttribute(a,4));cg.deleteAttribute('uv');parts.push(cg);
    if(t.i>0) addBox((t.hw+0.62)*2,0.22,(t.hw+0.62)*2,0,t.yb+0.06,0,[t.hw+0.62,0.22,t.yb,4]);   // plancher du balcon
  });
  const bodyMat=patch(new THREE.MeshStandardMaterial({color:new THREE.Color('#ffffff'),roughness:0.82,metalness:0}),{
    uniforms:{uCore:{value:new THREE.Color('#ffc980')}},
    vHead:`attribute vec4 aB;varying vec4 vB;varying float vK;varying vec3 vP;`,
    vMain:`float uu=abs(normal.z)>0.5?position.x:(abs(normal.x)>0.5?position.z:position.x);vB=vec4(uu,position.y-aB.z,aB.x,aB.y);vK=aB.w;vP=position;`,
    fHead:`uniform vec3 uCore;varying vec4 vB;varying float vK;varying vec3 vP;float rvWin=0.0;float rvBH=0.0;`,
    fDiscard:GLSL_PREV,
    fColor:`
      float k=vK,hw=vB.z,H=vB.w,u=vB.x,vv=vB.y;
      vec3 plaster=vec3(0.7,0.67,0.58)*mix(0.88,1.04,rvNoise(vP*2.7));
      vec3 verm=vec3(0.5,0.15,0.09),dark=vec3(0.1,0.065,0.045);
      vec3 c=plaster;
      if(k<0.5){
        // trois travées : porte au centre, fenêtres à barreaux sur les côtés
        float bw=2.0*hw/3.0,bf=(u+hw)/bw,bay=floor(clamp(bf,0.0,2.999)),bu=fract(bf);
        float top=H-0.62,bot=0.12;
        if(vv>bot&&vv<top&&bu>0.09&&bu<0.91){
          vec2 dp=vec2((bu-0.09)/0.82,(vv-bot)/(top-bot));
          if(abs(bay-1.0)<0.5&&H>3.0){
            c=vec3(0.4,0.11,0.07)*mix(0.8,1.08,rvNoise(vec3(vP.y*14.0,u*1.5,1.0)));
            float seam=smoothstep(0.012,0.004,abs(dp.x-0.5));
            vec2 sg=vec2(fract(dp.x*10.0),fract(dp.y*7.0));float stud=smoothstep(0.26,0.14,length(sg-0.5))*step(0.06,dp.y)*step(dp.y,0.94);
            c=mix(c,vec3(0.86,0.64,0.25),stud*0.9);c*=1.0-seam*0.7;rvBH=stud*0.012-seam*0.01;
          }else if(dp.y<0.3&&H>3.0){c=vec3(0.36,0.1,0.065);rvBH=-smoothstep(0.08,0.0,min(dp.x,1.0-dp.x))*0.01;}
          else{float bf2=abs(fract(dp.x*(H>3.0?9.0:7.0))-0.5);float isBar=smoothstep(0.36,0.42,bf2);
            float rail=smoothstep(0.42,0.47,abs(fract(dp.y*2.0)-0.5));isBar=max(isBar,rail);
            c=mix(vec3(0.05,0.035,0.03),verm*1.1,isBar);rvWin=1.0-isBar;rvBH=isBar*0.015;}
        }else if(vv>top&&vv<H-0.32){c=plaster*0.97;}
      }else if(k<1.5){
        // consoles empilées (masu) vermillon et enduit
        // frise sous l'avant-toit : poteaux vermillon au droit des colonnes et des milieux de travée, enduit blanc
        float hwB=hw-0.35,bw2=2.0*hwB/6.0;float fu=(u+hwB)/bw2;float du=abs(fract(fu+0.5)-0.5)*bw2;
        float strut=step(du,0.13),band=step(vv,0.17)+step(0.78,vv);
        c=mix(plaster*0.95,verm,clamp(strut+band,0.0,1.0));
        c*=mix(0.7,1.0,smoothstep(0.0,0.5,vv));rvBH=strut*0.02+band*0.01;
      }else if(k<2.5){
        c=vec3(0.24,0.14,0.08)*mix(0.8,1.1,rvNoise(vP*5.0));
      }else if(k<3.5){
        // granit : grands blocs, mousse dans les joints et au pied
        vec2 q=abs(vRvN.y)>0.5?vP.xz/vec2(1.45,1.45):vec2(u/1.15,vP.y/0.65);
        q.x+=step(0.5,fract(q.y*0.5))*0.5;vec2 fq=abs(fract(q)-0.5);float jt=smoothstep(0.45,0.49,max(fq.x,fq.y));
        c=mix(vec3(0.45,0.44,0.41),vec3(0.58,0.56,0.52),rvHash(vec3(floor(q),3.0)))*mix(0.85,1.06,rvNoise(vP*3.0));
        c=mix(c,vec3(0.14,0.22,0.06),jt*0.7);
        c=mix(c,vec3(0.17,0.26,0.07),smoothstep(0.35,0.75,rvFbm3(vP*0.9))*0.55);
        // ligne d'eau : pierre mouillée, algues, puis le noir du lagon
        float wl=smoothstep(1.1,0.0,vP.y);c=mix(c,c*vec3(0.42,0.46,0.36),wl);
        c=mix(c,vec3(0.06,0.12,0.04),smoothstep(0.5,-0.1,vP.y)*smoothstep(0.3,0.6,rvNoise(vec3(vP.xz*2.0,vP.y*6.0)))*0.8);
        c*=mix(1.0,0.35,smoothstep(0.0,-1.2,vP.y));
        rvBH=-jt*0.03;
      }else{c=vec3(0.22,0.14,0.09)*mix(0.85,1.1,rvNoise(vec3(vP.xz*8.0,2.0)));}
      if(k<1.5){float st=smoothstep(0.45,0.85,rvNoise(vec3(u*2.6,vP.y*0.22,vP.x+vP.z)))*smoothstep(0.0,H,vv);
        c*=mix(1.0,0.62,st);c=mix(c,vec3(0.12,0.2,0.05),smoothstep(0.5,0.0,vv)*smoothstep(0.35,0.7,rvNoise(vP*1.7))*0.6);}
      diffuseColor.rgb=c;`,
    fNormal:`normal=rvPerturb(-vViewPosition,normal,rvBH,1.0);`,
    fEmissive:HOVER+`
      float fl=0.85+0.15*sin(uTime*7.3+vP.x*3.0)*sin(uTime*3.1+vP.y);
      totalEmissiveRadiance+=vec3(1.0,0.52,0.2)*rvWin*(uLantern*0.95+rvHG*2.0)*fl;
      if(vK>1.5&&vK<2.5)totalEmissiveRadiance+=uCore*2.8*smoothstep(0.0,0.55,rvHG);
      `+GLSL_PREV_E,
  },'pgbody');
  const body=new THREE.Mesh(mergeGeometries(parts),bodyMat);body.castShadow=true;body.receiveShadow=true;grp.add(body);

  /* ─── charpente vermillon : colonnes, linteaux, consoles en saillie, garde-corps ─── */
  const tp=[];const VERM=new THREE.Color('#9a3424'),DARK=new THREE.Color('#2a1a12'),GOLDC=new THREE.Color('#c99a3a');
  const tbox=(w,hh,d,x,y,z,col,ry)=>{const g=new THREE.BoxGeometry(w,hh,d);if(ry)g.rotateY(ry);g.translate(x,y,z);g.deleteAttribute('uv');const n=g.attributes.position.count,c=new Float32Array(n*3);for(let k=0;k<n;k++)c.set([col.r,col.g,col.b],k*3);g.setAttribute('color',new THREE.BufferAttribute(c,3));tp.push(g);};
  T.forEach(t=>{
    const cs=[-t.hw,-t.hw/3,t.hw/3,t.hw];
    for(let s=0;s<4;s++){const ry=s*Math.PI/2,cos=Math.cos(ry),sin=Math.sin(ry);
      const R=(x,z)=>[x*cos+z*sin,-x*sin+z*cos];
      cs.forEach((c,ci)=>{if(ci===3)return;   // chaque coin n'est traité qu'une fois (colonne d'angle posée plus bas)
        const [x,z]=R(c,t.hw+0.02);if(ci>0)tbox(0.36,t.h,0.36,x,t.yb+t.h/2,z,VERM);

      });
      // linteau haut, et linteau bas au rez-de-chaussée
      const [lx,lz]=R(0,t.hw+0.09);tbox(s%2?0.2:t.hw*2+0.5,0.28,s%2?t.hw*2+0.5:0.2,lx,t.yb+t.h-0.3,lz,VERM);
      if(t.i===0){tbox(s%2?0.18:t.hw*2+0.3,0.22,s%2?t.hw*2+0.3:0.18,lx,t.yb+0.95,lz,VERM);
        const [kx,kz]=R(0,t.hw+0.5);tbox(s%2?0.5:t.hw*2+1.6,0.3,s%2?t.hw*2+1.6:0.5,kx,t.yb+0.15,kz,DARK);}   // galerie basse
      // garde-corps du balcon
      if(t.i>0){const e=t.hw+0.55;const n=Math.max(3,Math.round(e*2/0.85));
        for(let k=0;k<=n;k++){const [px,pz]=R(-e+k*2*e/n,e);tbox(0.1,0.62,0.1,px,t.yb+0.48,pz,VERM);}
        const [rx,rz]=R(0,e);tbox(s%2?0.09:e*2+0.12,0.08,s%2?e*2+0.12:0.09,rx,t.yb+0.78,rz,VERM);tbox(s%2?0.07:e*2,0.06,s%2?e*2:0.07,rx,t.yb+0.45,rz,VERM);}
    }
    [[1,1],[1,-1],[-1,1],[-1,-1]].forEach(([sx,sz])=>tbox(0.4,t.h,0.4,sx*(t.hw+0.02),t.yb+t.h/2,sz*(t.hw+0.02),VERM));
  });
  const trimMat=patch(new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.55,metalness:0}),{
    fDiscard:GLSL_PREV,
    fColor:`diffuseColor.rgb*=mix(0.82,1.08,rvFbm3(vec3(vRvW.x*3.0,vRvW.y*0.6,vRvW.z*3.0)));`,
    fEmissive:HOVER+`totalEmissiveRadiance+=diffuseColor.rgb*vec3(1.0,0.7,0.4)*rvHG*0.6;`+GLSL_PREV_E,
  },'pgtrim');
  const trim=new THREE.Mesh(mergeGeometries(tp),trimMat);trim.castShadow=true;trim.receiveShadow=true;grp.add(trim);

  /* ─── toits : 5 étages × 4 pans, chacun mobile ─── */
  const roofMat=patch(new THREE.MeshStandardMaterial({color:new THREE.Color('#ffffff'),roughness:0.62,metalness:0.05}),{
    uniforms:{uCore:{value:new THREE.Color('#ffc980')}},
    vHead:`attribute vec4 aRoof;attribute float aLift;varying vec4 vRoof;varying float vLift;`,
    vMain:`vRoof=aRoof;vLift=aLift;`,
    fHead:`uniform vec3 uCore;varying vec4 vRoof;varying float vLift;float rvRH=0.0;float rvMoss=0.0;`,
    fDiscard:GLSL_PREV,
    fColor:`
      float part=vRoof.z,al=vRoof.x,sl=vRoof.y,au=vRoof.w;
      vec3 c;
      if(part<0.5){
        // tuiles de cuivre vert-de-gris : couvre-joints ronds, rangs qui se chevauchent, coulures
        float rx=fract(al/0.4)-0.5,ry=fract(sl/0.34);
        float cover=smoothstep(0.25,0.17,abs(rx));
        vec3 pat=mix(vec3(0.08,0.24,0.21),vec3(0.2,0.42,0.36),rvFbm3(vec3(al*0.35,sl*0.35,3.0)));
        float run=smoothstep(0.5,0.85,rvNoise(vec3(al*2.4,sl*0.12,5.0)));
        pat*=mix(1.0,0.66,run*0.55);
        pat=mix(pat,pat*1.14,cover*0.45);
        pat*=mix(0.72,1.0,smoothstep(0.0,0.2,ry));
        float rid=smoothstep(0.925,0.965,au);
        pat=mix(pat,vec3(0.09,0.22,0.19),rid*0.75);
        pat=mix(pat,vec3(0.12,0.2,0.1),smoothstep(0.62,0.85,rvNoise(vec3(al*1.3,sl*1.3,9.0)))*smoothstep(1.4,0.0,sl)*0.3);
        // la jungle reprend le toit : coussins de mousse dans les creux, plus épais vers la rive et les arêtiers
        float mz=rvFbm3(vec3(al*0.9,sl*0.7,17.0))*0.8+smoothstep(1.8,0.0,sl)*0.3+rid*0.25+(1.0-cover)*0.18+rvNoise(vec3(al*3.1,sl*3.1,7.0))*0.2;
        rvMoss=smoothstep(0.55,0.95,mz);
        pat=mix(pat,mix(vec3(0.05,0.1,0.02),vec3(0.12,0.21,0.04),rvNoise(vec3(al*3.0,sl*3.0,4.0))),rvMoss);
        c=pat;
        rvRH=(cover*sqrt(max(0.0,1.0-(rx/0.21)*(rx/0.21)))*0.05*(1.0-rid)+smoothstep(0.0,0.12,ry)*0.012+rid*0.04)*(1.0-rvMoss*0.7)+rvMoss*rvNoise(vec3(al*9.0,sl*9.0,2.0))*0.03;
      }else if(part<1.5){
        // sous-face : chevrons vermillon sur planches claires, plus sombre vers le cœur
        float rf=abs(fract(al/0.3)-0.5);float raft=smoothstep(0.17,0.12,rf);
        c=mix(vec3(0.82,0.76,0.6),vec3(0.66,0.17,0.1),raft);
        c*=mix(0.65,1.0,smoothstep(2.6,0.2,sl));rvRH=raft*0.03;
      }else if(part<2.5){
        // rive : bois sombre, têtes de chevrons blanches, filet d'or
        float rf=abs(fract(al/0.3)-0.5);float head=smoothstep(0.13,0.09,rf)*step(0.3,sl)*step(sl,0.85);
        c=mix(vec3(0.12,0.075,0.055),vec3(0.86,0.82,0.7),head);
        c=mix(c,vec3(0.82,0.6,0.22),smoothstep(0.14,0.06,sl));rvRH=head*0.01;
      }else{c=vec3(0.15,0.09,0.06);}
      diffuseColor.rgb=c;`,
    fRough:`roughnessFactor=vRoof.z<0.5?mix(0.58,0.95,rvMoss):0.75;`,
    fNormal:`normal=rvPerturb(-vViewPosition,normal,rvRH,1.0);`,
    fEmissive:HOVER+`
      if(vRoof.z>0.5&&(vRoof.z<1.5||vRoof.z>2.5))totalEmissiveRadiance+=uCore*(vLift*1.4+rvHG*0.35)*(vRoof.z>2.5?1.6:0.55);
      `+GLSL_PREV_E,
  },'pgroof');
  const pieces=[];const roofMeshes=[];
  T.forEach(t=>{
    const g=roofPanelGeo(t);
    const m=new THREE.InstancedMesh(g,roofMat,4);m.castShadow=true;m.receiveShadow=true;m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    grp.add(m);roofMeshes.push(m);
    for(let k=0;k<4;k++){
      const c=new THREE.Vector3(0,t.yE+t.rise*0.35,(t.R+t.rIn)/2);
      const ry=k*Math.PI/2;
      const cw=c.clone().applyAxisAngle(new THREE.Vector3(0,1,0),ry);
      const out=new THREE.Vector3(0,1,0.6).normalize().applyAxisAngle(new THREE.Vector3(0,1,0),ry);
      pieces.push({t,k,ry,c,cw,out,mesh:m,slot:k,off:0,vel:0,idle:0,seed:rand(),roll:(rand()-0.5)*0.12,M:new THREE.Matrix4()});
    }
  });

  /* ─── la jungle sur le temple : lianes qui pendent des avant-toits, touffes sur les tuiles.
     Chaque pan emporte sa végétation quand il se soulève. ─── */
  const growMat=patch(new THREE.MeshStandardMaterial({color:new THREE.Color('#ffffff'),vertexColors:true,roughness:0.85,side:THREE.DoubleSide,alphaToCoverage:true,envMapIntensity:0.25}),{
    uniforms:{uAtlas:{value:tx('leaf_atlas')}},
    vHead:`uniform float uTime;uniform vec2 uWind;attribute vec4 aGr;varying vec4 vGr;varying vec2 vGU;`,
    vBegin:`if(aGr.x>0.5){float k=uv.y*uv.y*aGr.y;transformed.xz+=vec2(uWind.x,uWind.y)*k*0.08*(sin(uTime*1.4+aGr.z*9.0)*0.8+sin(uTime*3.1+aGr.z*4.0)*0.3);}`,
    vMain:`vGr=aGr;vGU=uv;`,
    fHead:`varying vec4 vGr;varying vec2 vGU;float rvGA=1.0;`+GLSL_LEAF+GLSL_AA_ALPHA,
    fDiscard:GLSL_PREV+`
      if(vGr.x>0.5){
        // liane : tige fine, feuilles alternées le long du brin
        float L=vGr.y,x=vGU.x*2.0-1.0,yy=vGU.y*L/0.17;float ci=floor(yy),cf=fract(yy);
        float side=mod(ci,2.0)*2.0-1.0;vec2 d=vec2(x-side*0.42,(cf-0.5)*0.55);float an=side*0.6;d=mat2(cos(an),-sin(an),sin(an),cos(an))*d;
        float lf=1.0-smoothstep(0.75,1.0,length(d*vec2(1.0,1.7))/0.4);lf*=step(0.15,rvHash(vec3(ci,vGr.z,1.0)));
        float stem=smoothstep(0.08,0.04,abs(x));
        float lod=smoothstep(0.25,0.6,fwidth(yy));
        rvGA=mix(max(lf,stem),smoothstep(0.75,0.45,abs(x))*0.9,lod)*smoothstep(1.0,0.9,vGU.y);
      }else rvGA=rvLeafA(vGU,vGr.z,0.0);
      if(rvGA<0.3)discard;`,
    fColor:`diffuseColor.a=rvAA(rvGA);if(vGr.x<0.5)diffuseColor.rgb=rvLeafC*1.35*vec3(0.85,1.0,0.75);diffuseColor.rgb*=mix(0.75,1.15,rvLeafH)*mix(0.85,1.1,rvNoise(vRvW*3.0));`,
    fNormal:`normal=normalize(vNormal);`,
    fEmissive:`{vec3 Vd=normalize(vRvW-cameraPosition);totalEmissiveRadiance+=diffuseColor.rgb*uSunColor*pow(max(dot(Vd,uSunDir),0.0),6.0)*0.18;}`+GLSL_PREV_E,
    reps:[['#include <aomap_fragment>','reflectedLight.directSpecular*=0.25;\n#include <aomap_fragment>']],
  },'pggrow');
  const growMeshes=[];
  T.forEach((t,ti)=>{
    const rr2=mulberry32(900+ti),pos=[],nor=[],uv=[],gr=[],colA=[],idx=[];
    const push=(p,n,u,v,a,c)=>{pos.push(p.x,p.y,p.z);nor.push(n.x,n.y,n.z);uv.push(u,v);gr.push(...a);colA.push(c.r,c.g,c.b);};
    // lianes
    const NV=7+(4-ti)*2;
    for(let k=0;k<NV;k++){const u=(rr2()*2-1)*0.92;const top=roofBot(t,u,0.04);const L=0.9+rr2()*(ti===0?3.4:t.h+0.6);const sd=rr2()*10;
      const c=new THREE.Color().setRGB(0.1+rr2()*0.05,0.2+rr2()*0.07,0.05);const b=pos.length/3,NS=10;
      for(let j=0;j<=NS;j++){const v=j/NS;const p=top.clone().add(new THREE.Vector3(Math.sin(v*3+sd)*0.12,-v*L,0.05+Math.sin(v*2.2+sd)*0.15+v*0.12));
        const n=new THREE.Vector3(0,0,1);push(p.clone().add(new THREE.Vector3(-0.22,0,0)),n,0,v,[1,L,sd,0],c);push(p.clone().add(new THREE.Vector3(0.22,0,0)),n,1,v,[1,L,sd,0],c);}
      for(let j=0;j<NS;j++){const q=b+j*2;idx.push(q,q+1,q+2,q+1,q+3,q+2);}}
    // touffes sur les tuiles (fougères, herbes) : trois cartes croisées
    const NT=2+Math.floor(rr2()*2);
    for(let k=0;k<NT;k++){const u=(rr2()*2-1)*0.8,v=0.04+rr2()*0.35;const p0=roofTop(t,u,v);const sc=0.25+rr2()*0.3,sd=rr2()*10;
      const c=new THREE.Color().setRGB(0.07+rr2()*0.04,0.15+rr2()*0.05,0.035);
      for(let cI=0;cI<3;cI++){const a=cI/3*Math.PI+rr2()*0.4;const ax=new THREE.Vector3(Math.cos(a),0,Math.sin(a));const b=pos.length/3;
        [[-1,0],[1,0],[1,1],[-1,1]].forEach(([x,y])=>{const p=p0.clone().addScaledVector(ax,x*sc).add(new THREE.Vector3(0,y*sc*1.2-0.05,0));push(p,new THREE.Vector3(0,1,0).addScaledVector(ax,x*0.3).normalize(),x*0.5+0.5,y,[0,0,sd+cI,0],c);});
        idx.push(b,b+1,b+2,b,b+2,b+3);}}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));
    g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('aGr',new THREE.Float32BufferAttribute(gr,4));g.setAttribute('color',new THREE.Float32BufferAttribute(colA,3));g.setIndex(idx);
    const m=new THREE.InstancedMesh(g,growMat,4);m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);m.frustumCulled=false;grp.add(m);growMeshes.push(m);
    pieces.filter(P=>P.t===t).forEach(P=>{P.grow=m;});
  });

  /* ─── clochettes de bronze aux coins (fūtaku) ─── */
  const bellG=(()=>{const prof=[[0,0],[0.05,0],[0.06,0.05],[0.1,0.1],[0.13,0.25],[0.16,0.38],[0.19,0.46],[0.17,0.48],[0.0,0.47]].map(([r,y])=>new THREE.Vector2(r,-y));
    const g=new THREE.LatheGeometry(prof,12);const plate=new THREE.BoxGeometry(0.16,0.26,0.012);plate.translate(0,-0.78,0);const cord=new THREE.CylinderGeometry(0.008,0.008,0.22,4);cord.translate(0,-0.58,0);
    [g,plate,cord].forEach(x=>{if(x.attributes.uv)x.deleteAttribute('uv');});return mergeGeometries([g,plate,cord].map(x=>x.toNonIndexed()));})();
  const metalMat=patch(new THREE.MeshStandardMaterial({color:new THREE.Color('#8a6a38'),roughness:0.36,metalness:0.85}),{
    uniforms:{uGoldY:{value:apex+6.0}},
    fHead:`uniform float uGoldY;float rvPat=0.0;`,
    fDiscard:GLSL_PREV,
    fColor:`
      float gold=step(uGoldY,vRvW.y);
      rvPat=smoothstep(0.45,0.75,rvFbm3(vRvW*2.2))*(0.5+0.5*clamp(vRvN.y,0.0,1.0))*(1.0-gold);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.86,0.66,0.28),gold);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.3,0.55,0.46),rvPat*0.8);`,
    fRough:`roughnessFactor=mix(0.34,0.8,rvPat);`,
    reps:[['#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nmetalnessFactor=mix(metalnessFactor,0.0,rvPat);']],
    fEmissive:GLSL_PREV_E,
  },'pgmetal');
  const bells=new THREE.InstancedMesh(bellG,metalMat,20);bells.instanceMatrix.setUsage(THREE.DynamicDrawUsage);bells.castShadow=true;grp.add(bells);

  /* ─── flèche (sōrin) ─── */
  const sp=[];const at=(g,y)=>{g.translate(0,y,0);if(g.attributes.uv)g.deleteAttribute('uv');sp.push(g.index?g.toNonIndexed():g);};
  at(new THREE.BoxGeometry(1.3,0.45,1.3),apex+0.12);
  at(new THREE.SphereGeometry(0.62,18,8,0,Math.PI*2,0,Math.PI/2),apex+0.34);
  at(new THREE.LatheGeometry([[0.2,0],[0.42,0.06],[0.58,0.2],[0.64,0.34],[0.5,0.36]].map(([r,y])=>new THREE.Vector2(r,y)),18),apex+0.9);
  at(new THREE.CylinderGeometry(0.09,0.11,5.9,10),apex+4.1);
  for(let j=0;j<9;j++)at(new THREE.TorusGeometry(0.6-j*0.028,0.055,6,22).rotateX(Math.PI/2),apex+1.5+j*0.41);
  at(new THREE.LatheGeometry([[0.05,0],[0.3,0.2],[0.4,0.5],[0.32,0.85],[0.1,1.05]].map(([r,y])=>new THREE.Vector2(r,y)),10),apex+5.15);
  at(new THREE.SphereGeometry(0.22,14,10),apex+6.45);
  at(new THREE.LatheGeometry([[0,0],[0.2,0.08],[0.27,0.25],[0.2,0.45],[0.06,0.6],[0,0.66]].map(([r,y])=>new THREE.Vector2(r,y)),14),apex+6.62);
  // pommeaux dorés des garde-corps
  T.forEach(t=>{if(t.i===0)return;const e=t.hw+0.55;[[1,1],[1,-1],[-1,1],[-1,-1]].forEach(([sx,sz])=>{const g=new THREE.SphereGeometry(0.09,8,6);g.translate(sx*e,t.yb+0.86,sz*e);g.deleteAttribute('uv');sp.push(g.toNonIndexed());});});
  const spire=new THREE.Mesh(mergeGeometries(sp),metalMat);spire.castShadow=true;grp.add(spire);

  /* ─── panneau « L1 » au-dessus de la porte ─── */
  const ptex=paintPlaqueL1();
  const pw=patch(new THREE.MeshStandardMaterial({color:new THREE.Color('#22150e'),roughness:0.5}),{fDiscard:GLSL_PREV},'pgplq0');
  const pf=patch(new THREE.MeshStandardMaterial({map:ptex,roughness:0.4,metalness:0.25,emissive:new THREE.Color('#ffffff'),emissiveMap:ptex,emissiveIntensity:0.12}),{fDiscard:GLSL_PREV,
    fEmissive:`totalEmissiveRadiance*=1.0+uLantern*3.0;`},'pgplq');
  const plaque=new THREE.Mesh(new THREE.BoxGeometry(1.9,1.26,0.12),[pw,pw,pw,pw,pf,pw]);
  plaque.position.set(0,T[0].yb+T[0].h-0.12,T[0].hw+0.48);plaque.rotation.x=-0.1;plaque.castShadow=true;grp.add(plaque);

  /* ─── filaire de révélation ─── */
  const L=[];const seg=(a,b)=>{L.push(a.x,a.y,a.z,b.x,b.y,b.z);};
  const boxE=(hx,y0,y1,hz)=>{const c=[[-hx,-hz],[hx,-hz],[hx,hz],[-hx,hz]];for(let k=0;k<4;k++){const [ax,az]=c[k],[bx,bz]=c[(k+1)%4];
    seg(new THREE.Vector3(ax,y0,az),new THREE.Vector3(bx,y0,bz));seg(new THREE.Vector3(ax,y1,az),new THREE.Vector3(bx,y1,bz));seg(new THREE.Vector3(ax,y0,az),new THREE.Vector3(ax,y1,az));}};
  boxE(plHW,0,plH,plHW);   // (la partie noyée n'a pas de filaire)
  T.forEach(t=>{boxE(t.hw,t.yb,t.yb+t.h,t.hw);boxE(t.sIn,t.yb+t.h,t.yE,t.sIn);
    for(let k=0;k<4;k++){const ry=k*Math.PI/2,Y=new THREE.Vector3(0,1,0);
      const n=16;for(let i=0;i<n;i++){seg(roofTop(t,i/n*2-1,0).applyAxisAngle(Y,ry),roofTop(t,(i+1)/n*2-1,0).applyAxisAngle(Y,ry));}
      for(let j=0;j<8;j++){seg(roofTop(t,1,j/8).applyAxisAngle(Y,ry),roofTop(t,1,(j+1)/8).applyAxisAngle(Y,ry));}
      seg(roofTop(t,-1,1).applyAxisAngle(Y,ry),roofTop(t,1,1).applyAxisAngle(Y,ry));}});
  seg(new THREE.Vector3(0,apex,0),new THREE.Vector3(0,apex+7.3,0));
  for(let j=0;j<9;j++){const y=apex+1.5+j*0.41,r=0.6;for(let a=0;a<8;a++){const a0=a/8*Math.PI*2,a1=(a+1)/8*Math.PI*2;seg(new THREE.Vector3(Math.cos(a0)*r,y,Math.sin(a0)*r),new THREE.Vector3(Math.cos(a1)*r,y,Math.sin(a1)*r));}}
  const eg=new THREE.BufferGeometry();eg.setAttribute('position',new THREE.Float32BufferAttribute(L,3));
  const em=new THREE.ShaderMaterial({uniforms:U,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    vertexShader:`varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.0);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader:`uniform float uPyrWire;uniform float uPyrReveal;uniform float uWireAlpha;uniform vec3 uRevealColor;varying vec3 vW;
      void main(){
        if(vW.y<uPyrWire) discard;
        float front=smoothstep(uPyrWire+2.5,uPyrWire,vW.y);
        float solid=step(uPyrReveal,vW.y);
        float a=uWireAlpha*(0.45+1.4*front)*mix(1.0,0.0,solid);
        gl_FragColor=vec4(uRevealColor*a,a);
      }`});
  const edges=new THREE.LineSegments(eg,em);edges.frustumCulled=false;edges.renderOrder=3;grp.add(edges);

  /* ─── enveloppe invisible pour le survol ─── */
  const pg=[];{const b=new THREE.BoxGeometry(plHW*2,plH,plHW*2);b.translate(0,plH/2,0);pg.push(b);}
  T.forEach(t=>{const b=new THREE.BoxGeometry(t.sIn*2,t.h+PAG.brk,t.sIn*2);b.translate(0,t.yb+(t.h+PAG.brk)/2,0);pg.push(b);
    const f=new THREE.CylinderGeometry(t.rIn*Math.SQRT2,t.R*Math.SQRT2,t.rise+0.55,4,1);f.rotateY(Math.PI/4);f.translate(0,t.yE-0.5+(t.rise+0.55)/2,0);pg.push(f.toNonIndexed());});
  {const s=new THREE.CylinderGeometry(0.7,0.7,7.3,8);s.translate(0,apex+3.6,0);pg.push(s.toNonIndexed());}
  const proxy=new THREE.Mesh(mergeGeometries(pg.map(x=>{x.deleteAttribute('uv');x.deleteAttribute('normal');return x.index?x.toNonIndexed():x;})),new THREE.MeshBasicMaterial());
  proxy.updateMatrixWorld(true);
  const _hits=[];
  function hitEnvelope(ro,rd){const rc=new THREE.Raycaster(ro,rd,0,600);_hits.length=0;proxy.raycast(rc,_hits);if(!_hits.length)return null;_hits.sort((a,b)=>a.distance-b.distance);return _hits[0].point;}

  /* ─── animation des pans : ressort amorti + soulèvements autonomes ─── */
  const Y=new THREE.Vector3(0,1,0),X=new THREE.Vector3(1,0,0),Zv=new THREE.Vector3(0,0,1);
  const mT=new THREE.Matrix4(),mR=new THREE.Matrix4(),mC=new THREE.Matrix4(),mTl=new THREE.Matrix4(),mRl=new THREE.Matrix4(),mCi=new THREE.Matrix4();
  const bellM=new THREE.Matrix4(),bq=new THREE.Quaternion(),bp=new THREE.Vector3(),bs=new THREE.Vector3(1,1,1);
  function setPiece(P){
    mT.makeTranslation(P.out.x*P.off,P.out.y*P.off,P.out.z*P.off);
    mR.makeRotationY(P.ry);mC.makeTranslation(P.c.x,P.c.y,P.c.z);mCi.makeTranslation(-P.c.x,-P.c.y,-P.c.z);
    mTl.makeRotationX(-P.off*0.2);mRl.makeRotationZ(P.roll*P.off);
    P.M.copy(mT).multiply(mR).multiply(mC).multiply(mTl).multiply(mRl).multiply(mCi);
    P.mesh.setMatrixAt(P.slot,P.M);
    P.mesh.geometry.attributes.aLift.setX(P.slot,Math.min(1,P.off/1.2));
    if(P.grow){P.grow.setMatrixAt(P.slot,P.M);P.grow.instanceMatrix.needsUpdate=true;}
  }
  const bellTip=t=>new THREE.Vector3(t.R*0.985,t.yE+t.up-t.thick*0.55,t.R*0.985);
  function setBell(P,i,time){
    const tip=bellTip(P.t).applyMatrix4(P.M);
    const sw=Math.sin(time*(1.6+P.seed)+P.seed*20)*(0.06+0.02*Math.sin(time*0.37+P.seed*9))+P.vel*0.08;
    bq.setFromAxisAngle(new THREE.Vector3(Math.cos(P.ry+0.6),0,-Math.sin(P.ry+0.6)).normalize(),sw);
    bellM.compose(tip,bq,bs);bells.setMatrixAt(i,bellM);
  }
  pieces.forEach(setPiece);roofMeshes.forEach(m=>{m.instanceMatrix.needsUpdate=true;m.geometry.attributes.aLift.needsUpdate=true;});
  pieces.forEach((P,i)=>setBell(P,i,0));bells.instanceMatrix.needsUpdate=true;

  const hoverPt=new THREE.Vector3(0,-100,0);let hoverOn=0,idleTimer=2.5;
  function update(dt,t,ray,enabled){
    let hp=null;
    if(enabled&&ray) hp=hitEnvelope(ray.origin,ray.direction);
    if(hp){hoverPt.lerp(hp,hoverOn>0.01?0.35:1);hoverOn=Math.min(1,hoverOn+dt*5);}
    else hoverOn=Math.max(0,hoverOn-dt*2.5);
    U.uHover.value.copy(hoverPt);U.uHoverAmt.value=hoverOn;
    if(enabled){idleTimer-=dt;
      if(idleTimer<=0){idleTimer=2.4+rand()*2.8;
        const c=pieces[Math.floor(rand()*pieces.length)];
        pieces.forEach(P=>{const same=P===c,adj=(P.t===c.t&&Math.abs(((P.k-c.k)%4+4)%4-2)===1)||(P.k===c.k&&Math.abs(P.t.i-c.t.i)===1);
          if(same)P.idle=Math.max(P.idle,0.7+rand()*0.35);else if(adj)P.idle=Math.max(P.idle,0.22+rand()*0.18);});}}
    let dirty=new Set();
    for(const P of pieces){
      let target=P.idle*0.95;
      if(hoverOn>0){const d2=P.cw.distanceToSquared(hoverPt);target=Math.max(target,Math.exp(-d2/14.0)*2.0*hoverOn);}
      P.idle=Math.max(0,P.idle-dt*0.5);
      const acc=(target-P.off)*34-P.vel*7.2;P.vel+=acc*dt;P.off+=P.vel*dt;
      if(Math.abs(P.off)>0.0004||Math.abs(P.vel)>0.0004){setPiece(P);dirty.add(P.mesh);}
      else if(P.off!==0){P.off=0;P.vel=0;setPiece(P);dirty.add(P.mesh);}
    }
    dirty.forEach(m=>{m.instanceMatrix.needsUpdate=true;m.geometry.attributes.aLift.needsUpdate=true;});
    pieces.forEach((P,i)=>setBell(P,i,t));bells.instanceMatrix.needsUpdate=true;
  }
  function topLifted(nb){
    const arr=pieces.map((P,i)=>i).filter(i=>pieces[i].off>0.35).sort((a,b)=>pieces[b].off-pieces[a].off);
    return arr.slice(0,nb).map(i=>{const P=pieces[i],t=P.t;
      const pos=new THREE.Vector3(0,t.yE-t.thick*0.4,t.R+0.02).applyMatrix4(P.M);
      const cpos=new THREE.Vector3((P.seed>0.5?1:-1)*t.R*0.9,t.yE+t.up*0.7,t.R*0.9).applyMatrix4(P.M);
      return {i,pos,cpos,off:P.off};});
  }
  function pickCap(rc){return rc.intersectObject(plaque,false).length>0;}
  grp.traverse(o=>{if(o.isMesh)o.layers.enable(1);});   // la pagode se reflète dans le lagon
  return {grp,mesh:body,core:body,edges,blocks:pieces,update,topLifted,count:pieces.length,hitEnvelope,pickCap,plaque,pieces};
}

/* ═══ 05 · Atmosphère de la jungle : bancs de brume au ras du sol, pollen dans la lumière,
   lucioles la nuit, embruns au pied de la cascade ═══
   Même interface que le vent de sable de la L2 (streaks / clouds / tick) : le moteur s'en sert
   tel quel. « streaks » = poussières de lumière (pollen le jour, lucioles la nuit) ;
   « clouds » = bancs de brume et embruns. */
function buildMist(heightTex,HE){
  /* — pollen et lucioles — */
  const N=MOBILE?1400:3200,BOX=62;
  const g=new THREE.InstancedBufferGeometry();
  g.setAttribute('position',new THREE.BufferAttribute(new Float32Array([-1,-1,0, 1,-1,0, 1,1,0, -1,1,0]),3));
  g.setIndex([0,1,2,0,2,3]);
  const aP=new Float32Array(N*3),aR=new Float32Array(N*4);
  for(let i=0;i<N;i++){aP[i*3]=rand()*2-1;aP[i*3+1]=rand();aP[i*3+2]=rand()*2-1;aR[i*4]=rand();aR[i*4+1]=rand();aR[i*4+2]=rand();aR[i*4+3]=rand();}
  g.setAttribute('aP',new THREE.InstancedBufferAttribute(aP,3));g.setAttribute('aR',new THREE.InstancedBufferAttribute(aR,4));
  g.instanceCount=N;
  const streakU=Object.assign({uHeight:{value:heightTex},uHE:{value:HE},uBox:{value:BOX},uRes:{value:new THREE.Vector2(VW*DPR,VH*DPR)},uAlpha:{value:0},uWT:{value:0},uMotes:{value:1},uFly:{value:0},uCen:{value:new THREE.Vector3(18,0,40)},uWY:{value:JF.water}},U);
  const sm=new THREE.ShaderMaterial({uniforms:streakU,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    vertexShader:`
      uniform sampler2D uHeight;uniform float uHE;uniform float uBox;uniform vec2 uRes;uniform float uTime;uniform vec2 uWind;uniform float uWT;uniform float uFly;uniform float uMotes;uniform vec3 uCen;uniform float uWY;
      attribute vec3 aP;attribute vec4 aR;
      varying vec2 vQ;varying float vA;varying vec3 vW;varying float vFly;
      void main(){
        float fly=step(aR.x,0.075);vFly=fly;
        vec2 xz=aP.xz*uBox+uWind*uWT*(0.6+aR.y*0.8)*(1.0-fly)
          +vec2(sin(uTime*0.21+aR.z*30.0),cos(uTime*0.17+aR.w*30.0))*(fly>0.5?2.6:1.2);
        xz=mod(xz+uBox,2.0*uBox)-uBox;vec2 rel=xz;xz+=uCen.xz;
        float h=max(texture2D(uHeight,clamp(xz/uHE*0.5+0.5,0.0,1.0)).r,uWY);
        float y=h+(fly>0.5?0.4+aP.y*2.6+sin(uTime*0.9+aR.z*9.0)*0.35:0.3+pow(aP.y,1.4)*15.0+sin(uTime*0.35+aR.w*7.0)*0.6);
        vec3 c=vec3(xz.x,y,xz.y);vW=c;
        vec4 p=projectionMatrix*viewMatrix*vec4(c,1.0);
        if(p.w<0.5){gl_Position=vec4(2.0,2.0,2.0,1.0);vA=0.0;return;}
        float px=fly>0.5?4.5+aR.y*3.5:1.3+aR.y*1.6;
        px*=clamp(28.0/p.w,0.6,2.2);
        gl_Position=p+vec4(position.xy*px/uRes*2.0*p.w,0.0,0.0);
        vQ=position.xy;
        float edge=smoothstep(uBox,uBox*0.75,abs(rel.x))*smoothstep(uBox,uBox*0.75,abs(rel.y));
        // lucioles : clignotent par impulsions, seulement la nuit ; pollen : surtout dans le contre-jour
        float blink=pow(max(sin(uTime*(0.8+aR.w*0.9)+aR.z*40.0),0.0),6.0);
        vA=edge*(fly>0.5?uFly*(0.15+0.85*blink):uMotes*(0.12+0.3*aR.z));
      }`,
    fragmentShader:`
      uniform float uAlpha;uniform float uFogDensity;uniform vec3 uSunColor;uniform vec3 uSunDir;uniform float uLum;
      varying vec2 vQ;varying float vA;varying vec3 vW;varying float vFly;
      void main(){
        float r=length(vQ);if(r>1.0)discard;
        vec3 V=normalize(vW-cameraPosition);float d=length(cameraPosition-vW);
        float fog=exp(-d*uFogDensity*1.4);
        vec3 col;float a;
        if(vFly>0.5){col=vec3(0.75,1.0,0.35)*1.6;a=vA*(smoothstep(1.0,0.0,r)*0.6+smoothstep(0.35,0.0,r));}
        else{float bs=pow(max(dot(V,uSunDir),0.0),6.0);col=(vec3(1.0,0.95,0.8)*uLum*0.5+uSunColor*bs*2.2);a=vA*smoothstep(1.0,0.2,r)*(0.35+bs*2.0);}
        a*=uAlpha*fog;if(a<0.003)discard;
        gl_FragColor=vec4(col*a,a);
      }`});
  const streaks=new THREE.Mesh(g,sm);streaks.frustumCulled=false;streaks.renderOrder=7;scene.add(streaks);

  /* — bancs de brume + embruns de la cascade — */
  const C=MOBILE?26:56,CB=150,NS=8;
  const cg=new THREE.InstancedBufferGeometry();
  cg.setAttribute('position',new THREE.BufferAttribute(new Float32Array([-1,-1,0, 1,-1,0, 1,1,0, -1,1,0]),3));
  cg.setIndex([0,1,2,0,2,3]);
  const cP=new Float32Array(C*3),cR=new Float32Array(C*4),cA=new Float32Array(C*4);
  for(let i=0;i<C;i++){cP[i*3]=rand()*2-1;cP[i*3+1]=rand();cP[i*3+2]=rand()*2-1;cR[i*4]=rand();cR[i*4+1]=rand();cR[i*4+2]=rand();cR[i*4+3]=rand();
    if(i<NS){const F=JF.falls,fx=Math.sin(F.yaw),fz=Math.cos(F.yaw);cA.set([F.x+fx*(1+rand()*4)+(rand()-0.5)*5*fz,0.6,F.z+fz*(1+rand()*4)-(rand()-0.5)*5*fx,1],i*4);}}
  cg.setAttribute('aP',new THREE.InstancedBufferAttribute(cP,3));cg.setAttribute('aR',new THREE.InstancedBufferAttribute(cR,4));cg.setAttribute('aAnc',new THREE.InstancedBufferAttribute(cA,4));
  cg.instanceCount=C;
  const cloudU=Object.assign({uHeight:{value:heightTex},uHE:{value:HE},uBoxC:{value:CB},uAlphaC:{value:0},uWT:{value:0},uMist:{value:0.6},uWY:{value:JF.water}},U);
  const cm=new THREE.ShaderMaterial({uniforms:cloudU,transparent:true,depthWrite:false,
    vertexShader:`
      uniform sampler2D uHeight;uniform float uHE;uniform float uBoxC;uniform float uTime;uniform vec2 uWind;uniform float uWT;uniform float uWY;
      attribute vec3 aP;attribute vec4 aR;attribute vec4 aAnc;
      varying vec2 vQ;varying vec4 vR;varying vec3 vW;varying float vEdge;varying float vAnc;
      void main(){
        vAnc=aAnc.w;vec3 c;float size;
        if(aAnc.w>0.5){
          // embruns : montent, gonflent et s'effacent en boucle
          float cyc=fract(uTime*0.07+aR.x);size=5.0+aR.y*5.0+cyc*6.0;
          c=aAnc.xyz+vec3(sin(aR.z*20.0+uTime*0.2)*2.0,cyc*9.0+size*0.2,0.0);
          vEdge=smoothstep(0.0,0.15,cyc)*smoothstep(1.0,0.55,cyc)*1.8;
        }else{
          vec2 xz=aP.xz*uBoxC+uWind*uWT*(1.2+aR.x*1.6);
          xz=mod(xz+uBoxC,2.0*uBoxC)-uBoxC;
          size=10.0+aR.y*22.0;
          float h=max(texture2D(uHeight,clamp(xz/uHE*0.5+0.5,0.0,1.0)).r,uWY);
          c=vec3(xz.x,h+size*0.1+aP.y*2.5,xz.y);
          vEdge=smoothstep(uBoxC,uBoxC*0.7,abs(xz.x))*smoothstep(uBoxC,uBoxC*0.7,abs(xz.y));
        }
        vW=c;
        vec3 right=vec3(viewMatrix[0][0],viewMatrix[1][0],viewMatrix[2][0]);
        vec3 up=vec3(viewMatrix[0][1],viewMatrix[1][1],viewMatrix[2][1]);
        vec3 p=c+right*position.x*size*2.3+up*position.y*size*0.5;
        gl_Position=projectionMatrix*viewMatrix*vec4(p,1.0);
        vQ=position.xy;vR=aR;
        float dc=length(c-cameraPosition);vEdge*=smoothstep(size*0.8,size*2.0,dc);
        if(vEdge<0.002)gl_Position=vec4(2.0,2.0,2.0,1.0);
      }`,
    fragmentShader:"#define RV_FRAG\n"+GLSL_NOISE+`
      uniform float uAlphaC;uniform float uTime;uniform vec3 uFogColor;uniform vec3 uSunColor;uniform vec3 uSunDir;uniform float uMist;uniform float uLum;uniform float uFogDensity;
      varying vec2 vQ;varying vec4 vR;varying vec3 vW;varying float vEdge;varying float vAnc;
      void main(){
        float k=vAnc>0.5?1.0:uMist;
        float a0=(0.05+0.11*vR.w)*uAlphaC*vEdge*k*smoothstep(-1.0,-0.3,vQ.y);
        if(a0<0.002)discard;
        float r=length(vQ);if(r>1.3)discard;
        float n=rvFbm3(vec3(vQ*vec2(1.3,2.8)+vR.zw*30.0+vec2(-uTime*0.03,0.0),uTime*0.05+vR.x*5.0));
        float m=smoothstep(1.0,0.15,r+(n-0.5)*0.95);
        float a=m*a0;
        vec3 V=normalize(vW-cameraPosition);
        float s=pow(max(dot(V,uSunDir),0.0),4.0);
        vec3 col=mix(uFogColor*1.08,vec3(0.92,0.95,0.94)*(0.3+0.7*uLum),vAnc>0.5?0.75:0.35)*mix(0.95,1.06,n)+uSunColor*s*0.3;
        col=mix(col,uFogColor,(1.0-exp(-length(cameraPosition-vW)*uFogDensity*0.6))*0.6);
        if(a<0.002)discard;
        gl_FragColor=vec4(col,a);
      }`});
  const clouds=new THREE.Mesh(cg,cm);clouds.frustumCulled=false;clouds.renderOrder=6;scene.add(clouds);
  function tick(dt,k){const w=dt*(k===undefined?1:k);streakU.uWT.value+=w;cloudU.uWT.value+=w;
    if(TOD.cur){streakU.uMotes.value=TOD.cur.motes===undefined?1:TOD.cur.motes;streakU.uFly.value=TOD.cur.fly||0;cloudU.uMist.value=TOD.cur.mist===undefined?0.6:TOD.cur.mist;}}
  return {streaks,clouds,streakU,cloudU,tick};
}

/* ═══ 05 · Vent de sable : traînées de grains + nuages de poussière ═══ */
function buildWind(heightTex, HE, opt={}){
  const CEN=opt.center||new THREE.Vector3();const SPD=opt.speed||1;const PAR=opt.parent||scene;
  /* — Traînées de grains au ras du sol — */
  const N = opt.N||(MOBILE?2600:7500), BOX=opt.box||78;
  const g=new THREE.InstancedBufferGeometry();
  g.setAttribute('position',new THREE.BufferAttribute(new Float32Array([-1,-1,0, 1,-1,0, 1,1,0, -1,1,0]),3));
  g.setIndex([0,1,2,0,2,3]);
  const aP=new Float32Array(N*3),aR=new Float32Array(N*4);
  for(let i=0;i<N;i++){aP[i*3]=rand()*2-1;aP[i*3+1]=rand();aP[i*3+2]=rand()*2-1;aR[i*4]=rand();aR[i*4+1]=rand();aR[i*4+2]=rand();aR[i*4+3]=rand();}
  g.setAttribute('aP',new THREE.InstancedBufferAttribute(aP,3));
  g.setAttribute('aR',new THREE.InstancedBufferAttribute(aR,4));
  g.instanceCount=N;
  const streakU=Object.assign({uHeight:{value:heightTex},uHE:{value:HE},uBox:{value:BOX},uRes:{value:new THREE.Vector2(VW*DPR,VH*DPR)},uAlpha:{value:0},uCen:{value:CEN},uSpd:{value:SPD},uLift:{value:opt.lift||1},uWT:{value:0}},U);
  const sm=new THREE.ShaderMaterial({uniforms:streakU,transparent:true,depthWrite:false,
    vertexShader:`
      uniform sampler2D uHeight;uniform float uHE;uniform float uBox;uniform vec2 uRes;uniform float uTime;uniform vec2 uWind;uniform float uDust;uniform vec3 uCen;uniform float uSpd;uniform float uLift;uniform float uWT;
      attribute vec3 aP;attribute vec4 aR;
      varying vec2 vQ;varying float vA;varying vec3 vW;
      void main(){
        float spd=(10.0+aR.x*16.0)*uSpd;
        vec2 xz=aP.xz*uBox+uWind*uWT*spd;
        xz=mod(xz+uBox,2.0*uBox)-uBox;
        float h=texture2D(uHeight,clamp(xz/uHE*0.5+0.5,0.0,1.0)).r;
        float lift=pow(aP.y,2.6)*3.4*uLift;
        float y=h+0.04+lift+sin(uTime*2.7+aR.z*6.283)*0.12*aP.y;
        vec3 c=vec3(xz.x,y,xz.y)+uCen;
        vec3 c2=c+vec3(uWind.x,0.0,uWind.y)*(1.1+aR.y*2.2)*(uSpd>1.01?0.45:1.0);
        vec4 p1=projectionMatrix*viewMatrix*vec4(c,1.0);
        vec4 p2=projectionMatrix*viewMatrix*vec4(c2,1.0);
        vW=c;
        if(p1.w<0.5||p2.w<0.5){gl_Position=vec4(2.0,2.0,2.0,1.0);vA=0.0;return;}
        vec2 a=p1.xy/p1.w*uRes*0.5, b=p2.xy/p2.w*uRes*0.5;
        vec2 t=b-a;float L=length(t);t=L>1e-3?t/L:vec2(1.0,0.0);
        vec2 n=vec2(-t.y,t.x);
        float wpx=(0.8+aR.w*1.1);
        vec2 px=mix(a,b,position.x*0.5+0.5)-t*wpx*0.5*(1.0-position.x)*0.0+n*position.y*wpx*0.5;
        gl_Position=vec4(px/(uRes*0.5)*p1.w,p1.z,p1.w);
        vQ=position.xy;
        float edge=smoothstep(uBox,uBox*0.78,abs(xz.x))*smoothstep(uBox,uBox*0.78,abs(xz.y));
        float near=smoothstep(1.5,6.0,p1.w);
        vA=edge*near*(0.16+0.36*aR.z)*(1.0-aP.y*0.55)*uDust;
      }`,
    fragmentShader:`
      uniform float uAlpha;uniform vec3 uFogColor;uniform float uFogDensity;uniform vec3 uSunColor;uniform float uLum;
      varying vec2 vQ;varying float vA;varying vec3 vW;
      void main(){
        float a=vA*uAlpha*(1.0-abs(vQ.x))*(1.0-abs(vQ.y)*0.6);
        float d=length(cameraPosition-vW);
        float fog=exp(-d*uFogDensity);
        vec3 col=mix(uFogColor,vec3(0.98,0.88,0.74)*uLum+uSunColor*0.05,fog);
        if(a<0.004) discard;
        gl_FragColor=vec4(col,a*fog*0.9+a*0.1);
      }`});
  const streaks=new THREE.Mesh(g,sm);streaks.frustumCulled=false;streaks.renderOrder=5;
  PAR.add(streaks);

  /* — Nuages de poussière en suspension — */
  const C = opt.C||(MOBILE?18:40), CB=150;
  const cg=new THREE.InstancedBufferGeometry();
  cg.setAttribute('position',new THREE.BufferAttribute(new Float32Array([-1,-1,0, 1,-1,0, 1,1,0, -1,1,0]),3));
  cg.setIndex([0,1,2,0,2,3]);
  const cP=new Float32Array(C*3),cR=new Float32Array(C*4);
  for(let i=0;i<C;i++){cP[i*3]=rand()*2-1;cP[i*3+1]=rand();cP[i*3+2]=rand()*2-1;cR[i*4]=rand();cR[i*4+1]=rand();cR[i*4+2]=rand();cR[i*4+3]=rand();}
  cg.setAttribute('aP',new THREE.InstancedBufferAttribute(cP,3));
  cg.setAttribute('aR',new THREE.InstancedBufferAttribute(cR,4));
  cg.instanceCount=C;
  const cloudU=Object.assign({uBoxC:{value:CB},uAlphaC:{value:0},uCen:{value:CEN},uSpd:{value:SPD},uWT:{value:0}},U);
  const cm=new THREE.ShaderMaterial({uniforms:cloudU,transparent:true,depthWrite:false,
    vertexShader:`
      uniform float uBoxC;uniform float uTime;uniform vec2 uWind;uniform vec3 uCen;uniform float uSpd;uniform float uWT;
      attribute vec3 aP;attribute vec4 aR;
      varying vec2 vQ;varying vec4 vR;varying vec3 vW;varying float vEdge;
      void main(){
        float spd=(5.0+aR.x*7.0)*uSpd;
        vec2 xz=aP.xz*uBoxC+uWind*uWT*spd;
        xz=mod(xz+uBoxC,2.0*uBoxC)-uBoxC;
        float size=12.0+aR.y*30.0;
        vec3 c=vec3(xz.x,size*0.32+aP.y*10.0,xz.y)+uCen;
        vW=c;
        vec3 right=vec3(viewMatrix[0][0],viewMatrix[1][0],viewMatrix[2][0]);
        vec3 up=vec3(viewMatrix[0][1],viewMatrix[1][1],viewMatrix[2][1]);
        vec3 p=c+right*position.x*size*2.2+up*position.y*size*0.55;
        gl_Position=projectionMatrix*viewMatrix*vec4(p,1.0);
        vQ=position.xy;vR=aR;
        vEdge=smoothstep(uBoxC,uBoxC*0.7,abs(xz.x))*smoothstep(uBoxC,uBoxC*0.7,abs(xz.y));
        // un nuage tout près de la caméra couvrirait tout l'écran (des dizaines de couches à calculer) :
        // il s'efface en approchant, et disparaît complètement (zéro calcul) quand on est dedans
        float dc=length(c-cameraPosition);vEdge*=smoothstep(size*0.7,size*1.7,dc);
        if(vEdge<0.002)gl_Position=vec4(2.0,2.0,2.0,1.0);
      }`,
    fragmentShader:"#define RV_FRAG\n"+GLSL_NOISE+`
      uniform float uAlphaC;uniform float uTime;uniform vec3 uFogColor;uniform vec3 uSunColor;uniform vec3 uSunDir;uniform float uDust;
      varying vec2 vQ;varying vec4 vR;varying vec3 vW;varying float vEdge;
      void main(){
        float a0=(0.065+0.115*vR.w)*uAlphaC*vEdge*uDust*smoothstep(-1.0,-0.35,vQ.y);
        if(a0<0.002) discard;
        float r=length(vQ);if(r>1.3) discard;   // coins du quad : toujours transparents
        float n=rvFbm3(vec3(vQ*vec2(1.2,2.6)+vR.zw*30.0+vec2(-uTime*0.05,0.0),uTime*0.08+vR.x*5.0));
        float m=smoothstep(1.0,0.15,r+(n-0.5)*0.9);
        float a=m*a0;
        vec3 V=normalize(vW-cameraPosition);
        float s=pow(max(dot(V,uSunDir),0.0),5.0);
        vec3 col=uFogColor*mix(0.97,1.06,n)+uSunColor*s*0.22;
        if(a<0.002) discard;
        gl_FragColor=vec4(col,a);
      }`});
  const clouds=new THREE.Mesh(cg,cm);clouds.frustumCulled=false;clouds.renderOrder=6;
  PAR.add(clouds);
  function tick(dt,k){streakU.uWT.value+=dt*(k===undefined?1:k);cloudU.uWT.value+=dt*(k===undefined?1:k);}
  return {streaks,clouds,streakU,cloudU,tick};
}

/* ═══ 05c · Rayons de lumière dans les sous-bois ═══
   Le soleil (ou la lune) est derrière la caméra : la diffusion volumétrique vers l'avant ne
   montre presque rien. Ces faisceaux, posés dans les trouées de la canopée des deux rives,
   donnent les rayons visibles sans voiler le temple : colonnes douces orientées selon la
   direction de la lumière, bords fondus, scintillement lent de la poussière, atténuées par
   la brume. Jamais au-dessus du lagon (le temple reste net). */
function buildSunBeams(){
  const grp=new THREE.Group();scene.add(grp);
  const BU={uTime:U.uTime,uCol:{value:new THREE.Color()},uK:{value:0},uNight:{value:0},uFogD:U.uFogDensity,uN3:U.uN3,uBS:{value:MOBILE?6:12}};
  const mat=new THREE.ShaderMaterial({uniforms:BU,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.BackSide,defines:{BSTEPS:MOBILE?6:12},
    vertexShader:`attribute float aSeed;attribute float aR;varying vec3 vO;varying vec3 vCam;varying vec3 vW;varying float vSeed;varying float vR;
      void main(){vec4 w=modelMatrix*vec4(position,1.0);vW=w.xyz;vO=position;vCam=(inverse(modelMatrix)*vec4(cameraPosition,1.0)).xyz;vSeed=aSeed;vR=aR;gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader:'#define RV_FRAG\n'+GLSL_NOISE+`uniform float uTime;uniform vec3 uCol;uniform float uK;uniform float uNight;uniform float uFogD;uniform int uBS;
      varying vec3 vO;varying vec3 vCam;varying vec3 vW;varying float vSeed;varying float vR;
      vec3 rvPal(float t){t=fract(t)*5.0;vec3 a=vec3(1.0,0.3,0.2),b=vec3(1.0,0.74,0.24),c=vec3(0.28,0.95,0.48),d=vec3(0.26,0.52,1.0),e=vec3(0.74,0.38,1.0);return t<1.0?mix(a,b,t):t<2.0?mix(b,c,t-1.0):t<3.0?mix(c,d,t-2.0):t<4.0?mix(d,e,t-3.0):mix(e,a,t-4.0);}
      void main(){
        vec3 o=vCam,d=vO-vCam;                                  // rayon dans le repère du faisceau : t=0 la caméra, t=1 la face arrière
        float Rm=vR*1.35,a=dot(d.xz,d.xz),b=dot(o.xz,d.xz),c=dot(o.xz,o.xz)-Rm*Rm,t0=0.0;
        if(c>0.0){float h=b*b-a*c;if(h<=0.0||a<1e-8)discard;t0=max(0.0,(-b-sqrt(h))/a);}   // entrée dans le volume
        if(o.y<0.0&&d.y>0.0)t0=max(t0,-o.y/d.y);
        if(o.y>1.0&&d.y<0.0)t0=max(t0,(1.0-o.y)/d.y);
        if(t0>=1.0)discard;
        float wl=distance(cameraPosition,vW),dtt=(1.0-t0)/float(uBS);
        float j=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(0.06711056,0.00583715))));
        float acc=0.0;
        for(int i=0;i<BSTEPS;i++){if(i>=uBS)break;
          float t=t0+(float(i)+j)*dtt;vec3 p=o+d*t;
          float r=vR*mix(1.0,1.35,clamp(p.y,0.0,1.0)),rad=length(p.xz)/r;
          if(rad>1.0||p.y<0.0||p.y>1.0)continue;
          float core=1.0-rad*rad;core*=core;                     // cœur dense, bords fondus
          float along=smoothstep(0.0,0.3,p.y)*smoothstep(1.0,0.62,p.y);   // naît dans la canopée, s'éteint au sol
          float st=smoothstep(0.3,0.7,rvNoise(vec3(p.xz/r*2.6+vSeed*17.0,vSeed*5.0)));   // trouées entre les feuilles : stries constantes le long du rayon
          vec3 wp=mix(cameraPosition,vW,t);
          float dust=0.5+rvNoise(vec3(wp.x*0.21,wp.y*0.21-uTime*0.05,wp.z*0.21)+vSeed*7.0);
          acc+=core*along*(0.22+0.78*st)*dust;
        }
        float fog=exp(-wl*mix(t0,1.0,0.5)*max(uFogD,0.002)*1.6)*smoothstep(3.0,14.0,wl);
        float A=uK*acc*dtt*wl*BGAIN*fog*(0.6+0.4*fract(vSeed*13.7));
        if(A<0.002)discard;
        vec3 tn=mix(vec3(1.0,0.9,0.76),rvPal(vSeed*3.7+0.9*rvNoise(vec3(vO.xz/vR*1.5+vSeed*9.0,vSeed))),0.6)*1.15;{float lc=max(dot(uCol,vec3(0.3,0.59,0.11)),1e-4);tn=mix(tn,mix(uCol/lc,vec3(1.0),0.5)*0.836,uNight);}gl_FragColor=vec4(vec3(dot(uCol,vec3(0.3,0.59,0.11)))*tn*A,1.0);
      }`.replace('BGAIN','1.5')});
  /* tache de lumière au pied de chaque faisceau : ombre des feuilles qui bouge sur le sol, scintillement sur l'eau */
  const poolMat=new THREE.ShaderMaterial({uniforms:BU,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,
    vertexShader:`attribute float aSeed;attribute float aWet;varying vec2 vUv;varying vec3 vW;varying float vSeed;varying float vWet;
      void main(){vUv=uv;vSeed=aSeed;vWet=aWet;vec4 w=modelMatrix*vec4(position,1.0);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader:'#define RV_FRAG\n'+GLSL_NOISE+`uniform float uTime;uniform vec3 uCol;uniform float uK;uniform float uNight;varying vec2 vUv;varying vec3 vW;varying float vSeed;varying float vWet;
      vec3 rvPal(float t){t=fract(t)*5.0;vec3 a=vec3(1.0,0.3,0.2),b=vec3(1.0,0.74,0.24),c=vec3(0.28,0.95,0.48),d=vec3(0.26,0.52,1.0),e=vec3(0.74,0.38,1.0);return t<1.0?mix(a,b,t):t<2.0?mix(b,c,t-1.0):t<3.0?mix(c,d,t-2.0):t<4.0?mix(d,e,t-3.0):mix(e,a,t-4.0);}
      void main(){float d=length(vUv-0.5)*2.0;float m=1.0-smoothstep(0.25,1.0,d);m*=m;
        float dp=0.3+0.7*smoothstep(0.34,0.6,rvNoise(vec3(vW.xz*0.8+vSeed*20.0,uTime*0.06)));              // ombre mouvante du feuillage
        float sp=vWet>0.5?0.45+7.0*pow(rvNoise(vec3(vW.xz*5.0+vec2(uTime*0.25,0.0),uTime*0.8)),5.0):1.0;   // éclats sur l'eau
        vec3 tn=mix(vec3(1.0,0.9,0.76),rvPal(vSeed*3.7+0.9*rvNoise(vec3(vW.xz*0.45+vSeed*9.0,vSeed))),0.6)*1.15;
        float A=uK*m*dp*sp*0.34;if(A<0.003)discard;{float lc=max(dot(uCol,vec3(0.3,0.59,0.11)),1e-4);tn=mix(tn,mix(uCol/lc,vec3(1.0),0.5)*0.836,uNight);}gl_FragColor=vec4(vec3(dot(uCol,vec3(0.3,0.59,0.11)))*tn*A,1.0);}`});
  const beams=[];
  const rr=mulberry32(4242);
  const C=JF.cam,f=JF.f,r=JF.r;
  let tries=0;
  while(beams.length<(MOBILE?10:22)&&tries<1600){tries++;
    const d=16+rr()*100,side=rr()<0.5?-1:1,nd=0.28+rr()*0.8,lat=side*nd*d*0.4287;   // dans le cadre de la vue d'accueil, de part et d'autre du temple
    const x=C.x+f.x*d+r.x*lat,z=C.z+f.z*d+r.z*lat;
    const wet=shoreD(x,z)<1.5;if(wet&&rr()<0.55)continue;                                     // trouée dans la canopée, au-dessus de la terre ferme
    if(beams.some(b=>Math.hypot(b.x-x,b.z-z)<5.5))continue;
    const R=(0.5+rr()*1.4)*(0.7+d/110),top=groundH(x,z)+8+rr()*9;
    const g=new THREE.CylinderGeometry(R*1.35,R,1,14,1,false);g.translate(0,0.5,0);   // volume fermé · y=0 : trouée (étroite) · y=1 : vers le sol (élargi)
    const sd=new Float32Array(g.attributes.position.count).fill(rr());g.setAttribute('aSeed',new THREE.BufferAttribute(sd,1));
    g.setAttribute('aR',new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(R),1));
    const m=new THREE.Mesh(g,mat);m.frustumCulled=false;m.renderOrder=7;grp.add(m);
    m.position.set(x,top,z);
    const pg=new THREE.PlaneGeometry(1,1);pg.setAttribute('aSeed',new THREE.BufferAttribute(new Float32Array(4).fill(sd[0]),1));pg.setAttribute('aWet',new THREE.BufferAttribute(new Float32Array(4).fill(0),1));
    const pool=new THREE.Mesh(pg,poolMat);pool.rotation.x=-Math.PI/2;pool.frustumCulled=false;pool.renderOrder=6;grp.add(pool);
    beams.push({m,x,z,top,H:10,R,pool});
  }
  const _q=new THREE.Quaternion(),_L=new THREE.Vector3(),_last=new THREE.Vector3(),_p=new THREE.Vector3();
  function update(k,dir,col){
    BU.uK.value=k;BU.uCol.value.copy(col);grp.visible=k>0.002;
    if(!grp.visible)return;
    _L.copy(dir).normalize();if(_L.y<0.12){_L.y=0.12;_L.normalize();}
    if(_L.dot(_last)>0.99995)return;_last.copy(_L);
    // le faisceau descend le long de la lumière (−L) ; il s'arrête au sol, au bord de l'eau, ou après 30 m
    _q.setFromUnitVectors(new THREE.Vector3(0,1,0),_L.clone().negate());
    for(const b of beams){
      let H=30;
      for(let t=2;t<=30;t+=2){_p.set(b.x,b.top,b.z).addScaledVector(_L,-t);
        if(_p.y<groundH(_p.x,_p.z)+0.3||_p.y<JF.water+0.15){H=Math.max(5,t-1);break;}}
      b.H=H;b.m.quaternion.copy(_q);b.m.scale.set(1,H,1);
      _p.set(b.x,b.top,b.z).addScaledVector(_L,-H);const gh=groundH(_p.x,_p.z),wet=gh<JF.water,e=b.R*1.35*2.5;
      b.pool.visible=H<29.5;   // faisceau qui n'atteint ni le sol ni l'eau : pas de tache
      b.pool.position.set(_p.x,Math.max(gh,JF.water)+0.1,_p.z);b.pool.scale.set(e/Math.max(0.5,_L.y),e,1);b.pool.rotation.z=Math.atan2(_L.x,_L.z)+Math.PI/2;
      b.pool.geometry.attributes.aWet.array.fill(wet?1:0);b.pool.geometry.attributes.aWet.needsUpdate=true;
    }
  }
  return {grp,beams,update,BU};
}

/* ═══ 06 · Intro : constellation de lignes + chorégraphie de révélation ═══ */
function buildConstellation(){
  const NP=MOBILE?80:150, C=new THREE.Vector3(0,16,0);
  const pts=[];
  for(let i=0;i<NP;i++){
    const u=rand()*2-1, th=rand()*Math.PI*2, r=18+Math.pow(rand(),0.7)*80;
    const s=Math.sqrt(1-u*u);
    pts.push(new THREE.Vector3(Math.cos(th)*s*r, u*r*0.5, Math.sin(th)*s*r).add(C));
  }
  const pos=[],aT=[],aD=[],seen=new Set();
  pts.forEach((p,i)=>{
    const near=pts.map((q,j)=>[j,p.distanceToSquared(q)]).filter(x=>x[0]!==i).sort((a,b)=>a[1]-b[1]).slice(0,2);
    for(const [j] of near){const key=i<j?i+'_'+j:j+'_'+i;if(seen.has(key))continue;seen.add(key);
      const d=rand()*0.9+ (p.distanceTo(C)/90)*0.5;
      pos.push(p.x,p.y,p.z,pts[j].x,pts[j].y,pts[j].z);aT.push(0,1);aD.push(d,d);}
  });
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('aT',new THREE.Float32BufferAttribute(aT,1));
  g.setAttribute('aD',new THREE.Float32BufferAttribute(aD,1));
  const CU=Object.assign({uConst:{value:0},uConstOut:{value:1}},U);
  const m=new THREE.ShaderMaterial({uniforms:CU,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    vertexShader:`attribute float aT;attribute float aD;varying float vT;varying float vD;varying vec3 vW;
      void main(){vT=aT;vD=aD;vec4 w=modelMatrix*vec4(position,1.0);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader:`uniform float uConst;uniform float uConstOut;uniform vec3 uRevealColor;uniform float uFogDensity;
      varying float vT;varying float vD;varying vec3 vW;
      void main(){float l=clamp((uConst-vD)/0.45,0.0,1.0);if(vT>l)discard;
        float d=length(cameraPosition-vW);float fog=exp(-d*uFogDensity*0.7);
        float a=uConstOut*(0.28+0.72*smoothstep(l-0.15,l,vT))*fog;
        gl_FragColor=vec4(uRevealColor*a,a);}`});
  const lines=new THREE.LineSegments(g,m);lines.frustumCulled=false;
  // nœuds
  const pg=new THREE.BufferGeometry();
  const pp=[],pd=[];pts.forEach(p=>{pp.push(p.x,p.y,p.z);pd.push(rand()*0.9+(p.distanceTo(C)/90)*0.5);});
  pg.setAttribute('position',new THREE.Float32BufferAttribute(pp,3));pg.setAttribute('aD',new THREE.Float32BufferAttribute(pd,1));
  const pm=new THREE.ShaderMaterial({uniforms:CU,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    vertexShader:`attribute float aD;varying float vA;uniform float uConst;uniform float uConstOut;
      void main(){vA=smoothstep(aD,aD+0.2,uConst)*uConstOut;vec4 mv=modelViewMatrix*vec4(position,1.0);gl_PointSize=3.2*(60.0/-mv.z)+1.2;gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`uniform vec3 uRevealColor;varying float vA;void main(){vec2 c=gl_PointCoord-0.5;float a=smoothstep(0.5,0.1,length(c))*vA;gl_FragColor=vec4(uRevealColor*a,a);}`});
  const nodes=new THREE.Points(pg,pm);nodes.frustumCulled=false;
  const grp=new THREE.Group();grp.add(lines);grp.add(nodes);scene.add(grp);
  return {grp,CU};
}

/* Poses de caméra */
const CAM_TARGET_HERO=new THREE.Vector3(0,12.5,0);
/* plan d'accueil : sur la berge, à hauteur d'homme (≈ 2,3 m au-dessus de l'eau), le regard levé vers la pagode */
const POSE_START={th:-0.95,ph:0.78,r:170,ty:10};
const POSE_HERO={th:0.42,ph:-0.0885,r:88,ty:10.1};
function camFromPose(p,out,tgt){
  const cp=Math.cos(p.ph);
  out.set(Math.sin(p.th)*cp*p.r, p.ty+Math.sin(p.ph)*p.r, Math.cos(p.th)*cp*p.r);
  tgt.set(0,p.ty,0);
}
/* trajectoire de drone : on survole l'espace en train de se modéliser, puis on descend
   lentement vers le plan d'ensemble (spline de Catmull-Rom, départ et arrivée amortis) */
const INTRO_END=13.5;
const CAM_KEYS=[
  {t:0.0, th:-0.95,ph:0.78,r:170,ty:10.0},
  {t:4.5, th:-0.25,ph:0.5, r:150,ty:11.5},
  {t:8.8, th:0.38, ph:0.17,r:124,ty:12.5},
  {t:13.0,th:0.42, ph:-0.0885,r:88,ty:10.1},
];
function camKeyAt(T){
  const D=CAM_KEYS[CAM_KEYS.length-1].t;
  const x=clamp01(T/D);const e=x<0.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2;   // lent → fluide → lent
  const s=e*0.55+x*0.45;const tt=s*D;
  let i=0;while(i<CAM_KEYS.length-2&&CAM_KEYS[i+1].t<tt)i++;
  const k0=CAM_KEYS[Math.max(0,i-1)],k1=CAM_KEYS[i],k2=CAM_KEYS[i+1],k3=CAM_KEYS[Math.min(CAM_KEYS.length-1,i+2)];
  const u=(tt-k1.t)/(k2.t-k1.t);
  const cr=(a,b,c,d)=>0.5*((2*b)+(-a+c)*u+(2*a-5*b+4*c-d)*u*u+(-a+3*b-3*c+d)*u*u*u);
  return {th:cr(k0.th,k1.th,k2.th,k3.th),ph:cr(k0.ph,k1.ph,k2.ph,k3.ph),r:cr(k0.r,k1.r,k2.r,k3.r),ty:cr(k0.ty,k1.ty,k2.ty,k3.ty)};
}

/* Chorégraphie (T = secondes depuis la fin du chargement) */
function introAt(T, sys){
  const k=(a,b)=>clamp01((T-a)/(b-a));
  // constellation : se tisse lentement, puis s'efface quand le terrain prend corps
  sys.cons.CU.uConst.value=lerp(0,1.9,easeOut(k(0.0,4.5)));
  sys.cons.CU.uConstOut.value=1-easeInOut(k(6.0,8.5));
  sys.cons.grp.rotation.y=T*0.02;
  sys.cons.grp.visible=T<8.6;
  // pagode : arêtes tracées de la flèche vers le soubassement, puis la matière remplit le filaire
  U.uPyrWire.value=lerp(PYR.H+1.5,-2,easeInOut(k(1.2,5.2)));
  U.uPyrReveal.value=lerp(PYR.H+1.5,-2,easeInOut(k(4.8,8.8)));
  // terrain et forêt : le maillage s'étend depuis la pagode, la matière suit
  U.uTerrainWire.value=lerp(-40,640,Math.pow(k(2.0,8.0),1.5));
  U.uTerrainReveal.value=lerp(-40,1150,Math.pow(k(6.2,12.4),1.7));
  U.uWireAlpha.value=1-easeInOut(k(10.0,12.8));
  U.uRevealGlow.value=1-easeInOut(k(10.0,12.8));
  SKY_U.uSkyIn.value=easeInOut(k(8.0,12.0));
  // brume et pollen
  const w=easeInOut(k(9.0,13.0));
  sys.wind.streakU.uAlpha.value=w;
  sys.wind.cloudU.uAlphaC.value=w;
  U.uDust.value=(0.35+0.65*w)*TOD.cur.dust;
  return camKeyAt(T);
}

/* Caméra « physique » : la position et le point visé suivent la trajectoire avec inertie
   (ressort amorti), un léger tremblé de drone, un roulis dans les virages, une focale qui
   se resserre pendant l'approche. */
const CAMR={pos:new THREE.Vector3(),vel:new THREE.Vector3(),tgt:new THREE.Vector3(),tv:new THREE.Vector3(),init:false,lastTh:0,roll:0,fov:30,fovAdd:0};
function smoothDampV(cur,target,vel,st,dt){
  const o=2/st,x=o*dt,e=1/(1+x+0.48*x*x+0.235*x*x*x);
  const cx=cur.x-target.x,cy=cur.y-target.y,cz=cur.z-target.z;
  const tx=(vel.x+o*cx)*dt,ty=(vel.y+o*cy)*dt,tz=(vel.z+o*cz)*dt;
  vel.set((vel.x-o*tx)*e,(vel.y-o*ty)*e,(vel.z-o*tz)*e);
  cur.set(target.x+(cx+tx)*e,target.y+(cy+ty)*e,target.z+(cz+tz)*e);
}
const _crP=new THREE.Vector3(),_crT=new THREE.Vector3();
function camRig(pose,dt,T){
  camFromPose(pose,_crP,_crT);
  if(!CAMR.init||dt<=0){CAMR.pos.copy(_crP);CAMR.tgt.copy(_crT);CAMR.vel.set(0,0,0);CAMR.tv.set(0,0,0);CAMR.init=true;CAMR.lastTh=pose.th;}
  else{smoothDampV(CAMR.pos,_crP,CAMR.vel,0.55,dt);smoothDampV(CAMR.tgt,_crT,CAMR.tv,0.4,dt);}
  // tremblé de drone (fort pendant le vol, une simple respiration ensuite)
  const A=lerp(0.32,0.06,smooth(INTRO_END-2,INTRO_END+1.5,T))*(REDUCED?0:1);
  const nx=fbm2(T*0.31,1.7,3)-0.5,ny=fbm2(T*0.27,8.3,3)-0.5,nz=fbm2(T*0.23,4.1,3)-0.5;
  camera.position.set(CAMR.pos.x+nx*A,CAMR.pos.y+ny*A*0.7,CAMR.pos.z+nz*A);
  camera.up.set(0,1,0);camera.lookAt(CAMR.tgt);
  // roulis : on s'incline dans le virage (vitesse latérale) + micro-roulis
  const dth=dt>0?(pose.th-CAMR.lastTh)/dt:0;CAMR.lastTh=pose.th;
  CAMR.roll+=((-dth*0.22)-CAMR.roll)*Math.min(1,dt*1.5);
  camera.rotateZ(CAMR.roll+(fbm2(T*0.19,2.2,2)-0.5)*0.012*A/0.32);
  // focale : 36° au départ, 30° sur le plan d'ensemble
  const fov=lerp(36,30,smooth(0,INTRO_END,T))+CAMR.fovAdd;
  if(Math.abs(camera.fov-fov)>1e-3){camera.fov=fov;camera.updateProjectionMatrix();}
}

/* ═══ 07 · Interface : textes qui se décodent, numéros de blocs, chargement ═══ */
const GLYPHS='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789#/*+=-_[]';
function glyph(){return GLYPHS[Math.floor(Math.random()*GLYPHS.length)];}

/* Chaque élément [data-scr] : on mémorise ses nœuds texte, puis on les « décode » au rythme de l'horloge de scène */
const SCR=[];
document.querySelectorAll('#hud [data-scr]').forEach((el,i)=>{
  const nodes=[];
  const walk=n=>{n.childNodes.forEach(c=>{if(c.nodeType===3&&c.textContent.trim().length)nodes.push({n:c,txt:c.textContent});else if(c.nodeType===1)walk(c);});};
  walk(el);
  const total=nodes.reduce((a,o)=>a+o.txt.length,0);
  SCR.push({el,nodes,total,start:null,dur:0.55+total*0.012,order:i});
  el.addEventListener('mouseenter',()=>{const s=SCR.find(x=>x.el===el);if(s&&s.start!==null&&s.done)s.replay=true;});
});
function hudStart(T){document.getElementById('hud').classList.add('on');SCR.forEach(s=>{s.start=T+s.order*0.12;s.done=false;});}
function hudUpdate(T){
  for(const s of SCR){
    if(s.start===null) continue;
    if(s.replay){s.start=T;s.done=false;s.replay=false;s.dur=0.45+s.total*0.006;}
    if(s.done) continue;
    const p=(T-s.start)/s.dur;
    if(p<0){s.nodes.forEach(o=>{o.n.textContent='';});continue;}
    let idx=0;
    for(const o of s.nodes){
      let out='';
      for(let c=0;c<o.txt.length;c++,idx++){
        const ch=o.txt[c];
        const lim=p*s.total*1.25-idx;
        if(ch===' '||ch==='\n'){out+=ch;continue;}
        if(lim>=s.total*0.25) out+=ch;
        else if(lim>-6) out+=glyph();
        else out+='';
      }
      o.n.textContent=out;
    }
    if(p>=1.05){s.nodes.forEach(o=>{o.n.textContent=o.txt;});s.done=true;}
  }
}

/* Survol de la pyramide : croix + numéro sur chaque pierre soulevée, reliées par un
   réseau de traits fins (comme les blocs de l'igloo) */
const tagWrap=document.getElementById('tags');
const NETN=6;
const NET_SVG=document.createElementNS('http://www.w3.org/2000/svg','svg');NET_SVG.setAttribute('class','net');tagWrap.appendChild(NET_SVG);
const NET_L=[];for(let i=0;i<NETN*3;i++){const l=document.createElementNS('http://www.w3.org/2000/svg','line');NET_SVG.appendChild(l);NET_L.push(l);}
const NET_X=[];for(let i=0;i<NETN;i++){const g=document.createElementNS('http://www.w3.org/2000/svg','path');g.setAttribute('class','x');NET_SVG.appendChild(g);NET_X.push(g);}
const TAGS=Array.from({length:NETN},()=>{const d=document.createElement('div');d.className='tag';tagWrap.appendChild(d);return d;});
const NET_A=new Map();   // apparition progressive de chaque pierre
const _v=new THREE.Vector3();
function tagsUpdate(list,dt=0.016){
  const pts=[];
  for(const it of list){
    _v.copy(it.pos).project(camera);if(_v.z>1)continue;
    const x=(_v.x*0.5+0.5)*VW,y=(-_v.y*0.5+0.5)*VH;
    let a=NET_A.get(it.i)||0;a=Math.min(1,a+dt*4);NET_A.set(it.i,a);
    let cx=x,cy=y;if(it.cpos){_v.copy(it.cpos).project(camera);cx=(_v.x*0.5+0.5)*VW;cy=(-_v.y*0.5+0.5)*VH;}
    pts.push({x,y,cx,cy,i:it.i,a:a*Math.min(1,(it.off-0.3)*3)});
  }
  for(const k of [...NET_A.keys()]) if(!list.find(it=>it.i===k)) NET_A.delete(k);
  // arêtes : chaque pierre vers ses deux plus proches voisines (sans doublon)
  const E=[];const key=new Set();
  pts.forEach((p,i)=>{pts.map((q,j)=>[j,(p.x-q.x)**2+(p.y-q.y)**2]).filter(e=>e[0]!==i).sort((a,b)=>a[1]-b[1]).slice(0,2).forEach(([j])=>{const k=i<j?i+'_'+j:j+'_'+i;if(!key.has(k)){key.add(k);E.push([i,j]);}});});
  let li=0;
  const setL=(x1,y1,x2,y2,a)=>{const l=NET_L[li++];if(!l)return;l.setAttribute('x1',x1.toFixed(1));l.setAttribute('y1',y1.toFixed(1));
    l.setAttribute('x2',(x1+(x2-x1)*Math.min(1,a*1.3)).toFixed(1));l.setAttribute('y2',(y1+(y2-y1)*Math.min(1,a*1.3)).toFixed(1));l.style.opacity=(a*0.85).toFixed(2);};
  E.forEach(([i,j])=>setL(pts[i].x,pts[i].y,pts[j].x,pts[j].y,Math.min(pts[i].a,pts[j].a)));
  pts.forEach(p=>{if(Math.hypot(p.cx-p.x,p.cy-p.y)>4)setL(p.x,p.y,p.cx,p.cy,p.a*0.8);});
  for(;li<NET_L.length;li++) NET_L[li].style.opacity='0';
  NET_X.forEach((g,i)=>{const p=pts[i];if(!p){g.style.opacity='0';return;}const r=5;
    g.setAttribute('d',`M${(p.x-r).toFixed(1)} ${p.y.toFixed(1)}H${(p.x+r).toFixed(1)}M${p.x.toFixed(1)} ${(p.y-r).toFixed(1)}V${(p.y+r).toFixed(1)}`);g.style.opacity=p.a.toFixed(2);});
  TAGS.forEach((d,i)=>{const p=pts[i];if(!p){d.classList.remove('on');return;}
    d.style.left=(p.x-8)+'px';d.style.top=(p.y-11)+'px';d.textContent=String(p.i).padStart(2,'0');d.classList.add('on');});
}

/* Chargement */
const ldGlyph=document.getElementById('ld-glyph'),ldPct=document.getElementById('ld-pct'),loaderEl=document.getElementById('loader');
let loadP=0;
function loaderTick(t){
  const L=10,on=Math.round(loadP*L);let s='';
  for(let i=0;i<L;i++){
    const ph=Math.sin(t*9+i*0.9);
    s+= i<on ? (ph>0.2?'+':'=') : (ph>0.55?'=':'-');
  }
  ldGlyph.textContent=s;
  ldPct.textContent=String(Math.round(loadP*100)).padStart(3,'0');
  if(window.RVL)RVL.set(loadP);   // la constellation du chargeur se tisse à mesure
}

/* ═══ 08 · Musique et ambiance — entièrement synthétisées (aucun fichier) ═══
   ▸ MUSIQUE GÉNÉRATIVE, dans l'esprit des musiques de Minecraft : piano doux réverbéré,
     boîte à musique, harpe pincée, piano électrique chaud. Chaque lieu a son morceau (tonalité,
     tempo, instruments, grille d'accords) ; la mélodie est faite de MOTIFS qui reviennent
     (A, A variée, B, A…) séparés de silences, sur un accompagnement en arpèges qui avance
     doucement. Les motifs se renouvellent peu à peu : la musique ne se répète jamais à
     l'identique mais reste fredonnable.
       désert ............ mode hijaz (oriental, façon désert de Zelda) : oud, flûte ney, darbouka douce
       blocs de glace .... do lydien, très calme : boîte à musique cristalline, piano lointain
       grotte de glace ... la mineur, piano grave et boîte à musique, mystérieux
       portail ........... fa lydien, arpèges qui montent : l'élan de l'aventure
       finance ........... ré mineur, piano électrique chaud et harpe : le plus entraînant
       grotte aux torches  mi phrygien, harpe grave et piano électrique, envoûtant
       mur de statistiques fa majeur, piano paisible
   ▸ AMBIANCE très en retrait : souffle du désert, givre, rumeur des grottes, sable qui tourne,
     feu des torches, gouttes ; effets ponctuels (impacts, craquements, éclatement, sable,
     plongée, traversée du portail).
   Le mélange des lieux (audioMix, dans 99_main) est recalculé à chaque image. Les notes sont
   programmées à l'avance sur l'horloge audio (précision à l'échantillon). */
const AUDIO={ctx:null,on:false,L:null,t:0,next:{},kind:''};
const NOTE=n=>440*Math.pow(2,(n-69)/12);
/* ── morceaux : accords {b: basse, t: notes de l'accord}, gamme de la mélodie, instruments ── */
const SC_DOR=[57,59,60,62,64,65,67,69,71,72,74,76,77,79,81,83,84,86,88];
const PIECES={
  // jungle (jour) : gamme yo sur ré (ré mi sol la si) — pentatonique japonaise lumineuse ;
  // arpège pincé façon koto (cordes de Karplus-Strong), flûte soufflée façon shakuhachi, basse de biwa,
  // un taiko très lointain de temps en temps — doux, entraînant, qui donne envie d'explorer
  desert:{bpm:80,cpb:1,arp:'pluck',arpOct:0,div:0.5,pat:[0,2,1,3,0,2,3,1],prob:0.86,arpV:0.12,
    mel:'ney',melV:0.15,reg:[67,84],bassV:0.12,bass:'oud',padV:0.024,plan:['R','A','A2','R','B','A','R','R'],
    perc:[[0,'d',0.9],[2.5,'d',0.45]],percV:0.035,
    scale:[62,64,67,69,71,74,76,79,81,83,86,88],
    chords:[{b:38,t:[62,67,69,74]},{b:40,t:[64,67,71,76]},{b:43,t:[62,67,71,74]},{b:45,t:[64,69,71,76]}]},
  // jungle (nuit) : gamme in (miyako-bushi) sur ré (ré mi♭ sol la si♭) — mystérieuse et apaisée
  nuit:{bpm:62,cpb:2,arp:'pluck',arpOct:0,div:1,pat:[0,2,1,3,0,2,3,1],prob:0.72,arpV:0.1,
    mel:'ney',melV:0.12,reg:[67,82],bassV:0.1,bass:'oud',padV:0.026,plan:['R','A','R','A2','R','B'],
    scale:[62,63,67,69,70,74,75,79,81,82,86],
    chords:[{b:38,t:[62,67,69,74]},{b:39,t:[63,67,70,74]},{b:43,t:[62,67,70,74]},{b:38,t:[62,67,69,74]}]},
  ice:{bpm:60,cpb:2,arp:'box',arpOct:12,div:1,pat:[0,2,4,3,1,4,2,3],prob:0.78,arpV:0.105,
    mel:'piano',melV:0.19,reg:[72,88],bassV:0.13,bass:'piano',padV:0.04,plan:['A','R','A2','R','B','R'],
    scale:[60,62,64,67,69,72,74,76,79,81,84,86,88,91,93],   // do pentatonique (aucune note qui grince)
    chords:[{b:36,t:[64,67,71,74,76]},{b:33,t:[64,67,69,71,72]},{b:41,t:[64,65,69,71,72]},{b:43,t:[62,64,67,71,74]}]},
  icecave:{bpm:54,cpb:2,arp:'piano',arpOct:-12,div:1,pat:[0,1,2,4,3,2,1,2],prob:0.85,arpV:0.13,
    mel:'box',melV:0.12,reg:[76,90],bassV:0.15,bass:'piano',padV:0.045,plan:['R','A','R','A2','R','B'],
    scale:[57,60,62,64,67,69,72,74,76,79,81,84,86,88,91],   // la mineur pentatonique
    chords:[{b:33,t:[69,72,76,83,84]},{b:41,t:[69,72,76,77,81]},{b:38,t:[69,72,74,77,81]},{b:40,t:[69,71,76,81,83]}]},
  portal:{bpm:80,cpb:1,arp:'box',arpOct:12,div:0.5,pat:[0,1,2,3,4,3,2,1],prob:0.85,arpV:0.07,arp2:'pluck',
    mel:'piano',melV:0.2,reg:[72,86],bassV:0.14,bass:'piano',padV:0.04,plan:['A','A2','B','A'],
    scale:[65,67,69,71,72,74,76,77,79,81,83,84,86,88],
    chords:[{b:41,t:[65,69,72,76,77]},{b:43,t:[67,71,74,79,83]},{b:45,t:[64,69,72,76,79]},{b:48,t:[64,67,72,76,79]}]},
  fin:{bpm:78,cpb:1,arp:'pluck',arpOct:0,div:0.5,pat:[0,3,1,4,2,3,1,4],prob:0.85,arpV:0.11,comp:[0,1.5,2.5],compV:0.05,
    mel:'piano',melV:0.22,reg:[67,81],bassV:0.16,bass:'epiano',bassBeats:[0,2],padV:0.03,plan:['A','A2','R','B','A','A2','R','R'],
    scale:[57,60,62,65,67,69,72,74,77,79,81,84,86],   // ré mineur pentatonique
    chords:[{b:38,t:[60,62,65,69,72]},{b:34,t:[58,62,65,69,74]},{b:43,t:[58,62,65,67,69]},{b:45,t:[57,62,64,67,69]}]},
  sandcave:{bpm:62,cpb:2,arp:'pluck',arpOct:-12,div:0.5,pat:[0,2,1,2,3,2,1,2],prob:0.78,arpV:0.13,
    mel:'epiano',melV:0.17,reg:[64,79],bassV:0.18,bass:'piano',padV:0.04,plan:['R','A','A2','R','B','R'],
    scale:[59,60,62,64,65,67,69,71,72,74,76,77,79,81,83],
    chords:[{b:40,t:[59,64,67,71,76]},{b:41,t:[60,65,69,72,77]},{b:38,t:[57,62,65,69,74]},{b:40,t:[59,64,68,71,76]}]},
  stats:{bpm:70,cpb:1,arp:'piano',arpOct:0,div:0.5,pat:[0,2,4,2,1,3,4,3],prob:0.78,arpV:0.11,
    mel:'box',melV:0.11,reg:[77,89],bassV:0.15,bass:'piano',padV:0.03,plan:['R','A','R','A2','R','R'],
    scale:[60,62,65,67,69,72,74,77,79,81,84,86,89,91],   // fa majeur pentatonique
    chords:[{b:41,t:[60,64,65,69,72]},{b:45,t:[60,64,67,69,72]},{b:46,t:[60,62,65,69,74]},{b:48,t:[60,64,67,69,72]}]},
};
const MUS={name:null,P:null,next:0,bar:0,A:null,A2:null,B:null,cyc:0,rest:0};

function audioInit(ctx){
  const A=ctx||new (window.AudioContext||window.webkitAudioContext)();
  const master=A.createGain();master.gain.value=0;
  const comp=A.createDynamicsCompressor();comp.threshold.value=-16;comp.knee.value=14;comp.ratio.value=2.5;comp.attack.value=0.02;comp.release.value=0.4;
  master.connect(comp);comp.connect(A.destination);
  const gain=(v,to)=>{const g=A.createGain();g.gain.value=v;if(to)g.connect(to);return g;};
  const filt=(type,f,q)=>{const b=A.createBiquadFilter();b.type=type;b.frequency.value=f;b.Q.value=q===undefined?0.7:q;return b;};
  const bus=gain(1,master);
  // réverbération : réponse impulsionnelle générée (4,2 s, sombre et douce) — l'écho des grandes salles
  const rev=A.createConvolver();
  {const len=Math.floor(A.sampleRate*4.2),ir=A.createBuffer(2,len,A.sampleRate);
   for(let c=0;c<2;c++){const d=ir.getChannelData(c);let lp=0;for(let i=0;i<len;i++){const t=i/len;const w=(Math.random()*2-1)*Math.pow(1-t,2.6);lp+=(w-lp)*0.26;d[i]=i<A.sampleRate*0.02?0:lp*1.7;}}
   rev.buffer=ir;}
  const revIn=gain(1);revIn.connect(rev);const revOut=gain(0.9,master);rev.connect(revOut);
  const send=(node,amt)=>{const s=gain(amt,revIn);node.connect(s);return s;};
  // bruits : rose (boucle 4 s, stéréo) et blanc
  const len=A.sampleRate*4,pink=A.createBuffer(2,len,A.sampleRate);
  for(let ch=0;ch<2;ch++){const d=pink.getChannelData(ch);let b0=0,b1=0,b2=0;
    for(let i=0;i<len;i++){const w=Math.random()*2-1;b0=0.99765*b0+w*0.0990460;b1=0.96300*b1+w*0.2965164;b2=0.57000*b2+w*1.0526913;d[i]=(b0+b1+b2+w*0.1848)*0.11;}}
  const white=A.createBuffer(1,A.sampleRate*2,A.sampleRate);{const d=white.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;}
  const src=A.createBufferSource();src.buffer=pink;src.loop=true;src.start();
  const L={};
  // — ambiance (bruits filtrés, doux, très en retrait derrière la musique) —
  L.wind=gain(0,bus);L.lpW=filt('lowpass',380,0.4);src.connect(L.lpW);L.lpW.connect(L.wind);
  L.air=gain(0,bus);L.bpA=filt('bandpass',600,0.8);src.connect(L.bpA);L.bpA.connect(L.air);send(L.air,0.4);
  L.frost=gain(0,bus);{const f=filt('highpass',6000,0.5);src.connect(f);f.connect(L.frost);send(L.frost,0.6);}
  L.room=gain(0,bus);{const f=filt('bandpass',150,0.8);src.connect(f);f.connect(L.room);send(L.room,0.5);}
  L.sand=gain(0,bus);L.panS=A.createStereoPanner();{const f=filt('bandpass',800,0.9);src.connect(f);f.connect(L.panS);L.panS.connect(L.sand);send(L.sand,0.2);}
  L.roar=gain(0,bus);{const f=filt('lowpass',260,0.5);src.connect(f);f.connect(L.roar);send(L.roar,0.3);}
  // — bus de la musique (envoi généreux dans la réverbération) —
  L.mus=gain(0,bus);L.musRev=gain(0,revIn);
  Object.assign(AUDIO,{ctx:A,master,bus,revIn,white,pink,L,gain,filt,KS:{}});
}
function audioToggle(){
  if(!AUDIO.ctx) audioInit();
  AUDIO.on=!AUDIO.on;
  const t=AUDIO.ctx.currentTime;
  if(AUDIO.ctx.state==='suspended') AUDIO.ctx.resume();
  AUDIO.master.gain.cancelScheduledValues(t);
  AUDIO.master.gain.setTargetAtTime(AUDIO.on?0.9:0,t,0.4);
  if(AUDIO.on){MUS.next=0;MUS.name=null;}
  const b=document.getElementById('snd');b.setAttribute('aria-pressed',AUDIO.on?'true':'false');b.querySelector('span').textContent='Son : '+(AUDIO.on?'on':'off');
}
const _set=(p,v,t,tau)=>{if(!isFinite(v))return;p.setTargetAtTime(v,t===undefined?AUDIO.ctx.currentTime:t,tau===undefined?0.35:tau);};

/* ════════ instruments ════════ */
function musOut(node,pan,rev){const A=AUDIO.ctx;const p=A.createStereoPanner();p.pan.value=Math.max(-1,Math.min(1,pan||0));node.connect(p);p.connect(AUDIO.L.mus);
  if(rev){const s=A.createGain();s.gain.value=rev;p.connect(s);s.connect(AUDIO.L.musRev);}}
/* piano doux : partiels harmoniques qui s'éteignent d'autant plus vite qu'ils sont aigus */
function insPiano(m,v,t,dur,pan){
  const A=AUDIO.ctx,f=NOTE(m),out=A.createGain();
  const tau=Math.min(2.6,1.7*Math.pow(261.6/f,0.42));
  out.gain.setValueAtTime(0,t);out.gain.linearRampToValueAtTime(v,t+0.009);out.gain.setTargetAtTime(v*0.5,t+0.005,0.09);out.gain.setTargetAtTime(0,t+0.1,tau);
  out.gain.setTargetAtTime(0,t+Math.max(0.12,dur),0.4);
  [[1,1],[2,0.24],[3,0.07],[4,0.025]].forEach(([k,a])=>{const o=A.createOscillator();o.frequency.value=f*k*(1+(k-1)*0.0006);
    const g=A.createGain();g.gain.setValueAtTime(a,t);g.gain.setTargetAtTime(0,t,tau/(k*0.85));o.connect(g);g.connect(out);o.start(t);o.stop(t+dur+2.2);});
  musOut(out,pan,0.55);
}
/* boîte à musique / célesta : FM douce, attaque nette, extinction rapide */
function insBox(m,v,t,dur,pan){
  const A=AUDIO.ctx,f=NOTE(m),car=A.createOscillator(),mod=A.createOscillator(),mg=A.createGain(),g=A.createGain();
  car.frequency.value=f;mod.frequency.value=f*4;mg.gain.setValueAtTime(f*0.42,t);mg.gain.setTargetAtTime(0,t,0.05);
  mod.connect(mg);mg.connect(car.frequency);
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(v,t+0.005);g.gain.setTargetAtTime(0,t+0.006,0.45);
  car.connect(g);musOut(g,pan,0.75);car.start(t);mod.start(t);car.stop(t+2.4);mod.stop(t+2.4);
}
/* piano électrique chaud : FM 1:1, brillance qui retombe */
function insEP(m,v,t,dur,pan){
  const A=AUDIO.ctx,f=NOTE(m),car=A.createOscillator(),mod=A.createOscillator(),mg=A.createGain(),g=A.createGain();
  car.frequency.value=f;mod.frequency.value=f;mg.gain.setValueAtTime(f*0.75,t);mg.gain.setTargetAtTime(f*0.1,t,0.35);
  mod.connect(mg);mg.connect(car.frequency);
  const tau=Math.min(2.2,1.5*Math.pow(261.6/f,0.3));
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(v,t+0.006);g.gain.setTargetAtTime(0,t+0.01,tau);g.gain.setTargetAtTime(0,t+Math.max(0.12,dur),0.3);
  car.connect(g);musOut(g,pan,0.45);car.start(t);mod.start(t);car.stop(t+dur+2);mod.stop(t+dur+2);
}
/* harpe pincée (corde de Karplus-Strong, calculée une fois par note) */
function ksBuf(m){
  const K=AUDIO.KS;if(K[m])return K[m];
  const A=AUDIO.ctx,sr=A.sampleRate,f=NOTE(m),len=Math.floor(sr*2.0),b=A.createBuffer(1,len,sr),d=b.getChannelData(0);
  const N=Math.max(2,Math.round(sr/f)),buf=new Float32Array(N);let lp=0;
  for(let i=0;i<N;i++){const w=Math.random()*2-1;lp+=(w-lp)*0.45;buf[i]=lp;}
  const damp=0.9975-Math.min(0.006,f/120000);let idx=0;
  for(let i=0;i<len;i++){const a=buf[idx],c=buf[(idx+1)%N];buf[idx]=(a+c)*0.5*damp;d[i]=a;idx=(idx+1)%N;}
  let mx=1e-6;for(let i=0;i<Math.min(len,N*6);i++)mx=Math.max(mx,Math.abs(d[i]));const k=0.8/mx;for(let i=0;i<len;i++)d[i]*=k*Math.min(1,i/16);
  return K[m]=b;
}
function insPluck(m,v,t,dur,pan){
  const A=AUDIO.ctx,s=A.createBufferSource();s.buffer=ksBuf(m);
  const lp=AUDIO.filt('lowpass',2000,0.5),g=A.createGain();g.gain.value=v;s.connect(lp);lp.connect(g);musOut(g,pan,0.45);s.start(t);s.stop(t+2.0);
}
/* nappe très douce qui suit l'accord (sinus, attaque lente) */
function insPad(notes,v,t,dur){
  const A=AUDIO.ctx,g=A.createGain();g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(v,t+Math.min(1.6,dur*0.4));g.gain.setTargetAtTime(0,t+dur*0.85,0.8);
  const lp=AUDIO.filt('lowpass',1400,0.4);lp.connect(g);
  notes.forEach((n,i)=>{const o=A.createOscillator();o.type=i%2?'triangle':'sine';o.frequency.value=NOTE(n);o.detune.value=(i%2?4:-4);const og=A.createGain();og.gain.value=1/notes.length;o.connect(og);og.connect(lp);o.start(t);o.stop(t+dur+3);});
  musOut(g,0,0.7);
}
/* oud : corde pincée plus nasale, avec la petite glissade d'attaque des doigts */
function insOud(m,v,t,dur,pan){
  const A=AUDIO.ctx,s=A.createBufferSource();s.buffer=ksBuf(m);s.playbackRate.setValueAtTime(0.975,t);s.playbackRate.exponentialRampToValueAtTime(1,t+0.045);
  const lp=AUDIO.filt('lowpass',2300,1.6),g=A.createGain();g.gain.value=v;s.connect(lp);lp.connect(g);musOut(g,pan,0.4);s.start(t);s.stop(t+2.0);
}
/* flûte ney : sinus doux, vibrato qui s'installe, souffle filtré autour de la note */
function insNey(m,v,t,dur,pan){
  const A=AUDIO.ctx,f=NOTE(m),o=A.createOscillator(),o2=A.createOscillator(),vib=A.createOscillator(),vg=A.createGain(),g=A.createGain(),h2=A.createGain();
  o.frequency.value=f;o2.type='triangle';o2.frequency.value=f*2;h2.gain.value=0.1;
  vib.frequency.value=5.1;vg.gain.setValueAtTime(0,t);vg.gain.linearRampToValueAtTime(f*0.007,t+Math.min(0.7,dur*0.7));vib.connect(vg);vg.connect(o.frequency);
  const rel=Math.max(0.15,dur);
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(v,t+0.09);g.gain.setTargetAtTime(v*0.78,t+0.09,0.5);g.gain.setTargetAtTime(0,t+rel,0.2);
  o.connect(g);o2.connect(h2);h2.connect(g);musOut(g,pan,0.65);
  const n=A.createBufferSource();n.buffer=AUDIO.pink;n.loop=true;const bp=AUDIO.filt('bandpass',f*2.2,3),ng=A.createGain();
  ng.gain.setValueAtTime(0,t);ng.gain.linearRampToValueAtTime(v*2.6,t+0.05);ng.gain.setTargetAtTime(v*0.7,t+0.06,0.15);ng.gain.setTargetAtTime(0,t+rel,0.15);
  n.connect(bp);bp.connect(ng);musOut(ng,pan,0.5);
  [o,o2,vib].forEach(x=>{x.start(t);x.stop(t+rel+1.2);});n.start(t,Math.random()*2);n.stop(t+rel+1.2);
}
/* darbouka très douce : « doum » grave, « tek » sec */
function insDoum(v,t){const A=AUDIO.ctx,o=A.createOscillator(),g=A.createGain();o.frequency.setValueAtTime(105,t);o.frequency.exponentialRampToValueAtTime(56,t+0.13);
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(v,t+0.005);g.gain.setTargetAtTime(0,t+0.01,0.1);o.connect(g);musOut(g,0,0.25);o.start(t);o.stop(t+0.7);}
function insTek(v,t,pan){const A=AUDIO.ctx,s=A.createBufferSource();s.buffer=AUDIO.white;const bp=AUDIO.filt('bandpass',2900,1.6),g=A.createGain();
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(v,t+0.002);g.gain.setTargetAtTime(0,t+0.004,0.022);s.connect(bp);bp.connect(g);musOut(g,pan,0.2);s.start(t,Math.random());s.stop(t+0.2);}
const INS={piano:insPiano,box:insBox,epiano:insEP,pluck:insPluck,oud:insOud,ney:insNey};

/* ════════ composition ════════ */
const RHY=[[1.5,0.5,1,1,2,2],[1,1,0.5,0.5,1,3,1],[0.5,0.5,1,2,1,1,2],[2,1,1,1.5,0.5,2],[1,0.5,0.5,2,1,1,2],[3,1,1,1,2],[1,1,1,1,4],[0.5,0.5,0.5,0.5,2,1,3]];
function mkMotif(){
  const rh=RHY[Math.floor(Math.random()*RHY.length)];let s=0,b=0;const n=[];
  rh.forEach((d,i)=>{if(i>0){const r=Math.random();s+=r<0.34?1:r<0.68?-1:r<0.8?2:r<0.92?-2:(Math.random()<0.5?3:-3);}s=Math.max(-4,Math.min(5,s));n.push({b,d,s});b+=d;});
  n[n.length-1].s=Math.round(n[n.length-1].s/2)*2;   // la phrase se pose sur une note de l'accord
  return n;
}
function varMotif(M){const n=M.map(x=>Object.assign({},x));const k=n.length;
  if(k>2){n[k-2].s+=Math.random()<0.5?1:-1;n[k-1].s=Math.round((n[k-1].s+(Math.random()<0.5?2:-2))/2)*2;}return n;}
function pickPiece(m){
  const c=[['desert',(m.desert||0)*(1-(m.night||0)*0.9)],['nuit',(m.desert||0)*(m.night||0)*0.9],['ice',m.ice||0],['icecave',m.icecave||0],
    ['portal',(m.portal||0)>0.45?(m.portal||0)+0.2:0],['fin',m.fin||0],['sandcave',m.sandcave||0],['stats',m.stats||0]];
  c.sort((a,b)=>b[1]-a[1]);return c[0][1]>0.4?c[0][0]:null;
}
function scheduleBar(P,bar,t0){
  const bt=60/P.bpm,ci=Math.floor(bar/P.cpb)%P.chords.length,ch=P.chords[ci],newCh=bar%P.cpb===0;
  const R=Math.random,hv=v=>v*(0.82+0.3*R()),jit=()=>(R()-0.5)*0.016;
  // basse (et nappe) au changement d'accord
  const bb=P.bassBeats||[0];
  bb.forEach(b=>{if(b===0&&!newCh&&!P.bassBeats)return;INS[P.bass](ch.b+(b?12:0),hv(P.bassV)*(b?0.7:1),t0+b*bt,bt*4*P.cpb*0.9,-0.05);});
  if(newCh&&P.padV)insPad([ch.b+12,ch.t[0],ch.t[2]],P.padV,t0,bt*4*P.cpb);
  // arpège
  const steps=Math.round(4/P.div);
  for(let k=0;k<steps;k++){if(R()>P.prob)continue;
    const ix=P.pat[(k+(bar%2)*steps)%P.pat.length],n=ch.t.length,note=ch.t[ix%n]+P.arpOct+(ix>=n?12:0);
    const ins=(P.arp2&&k%2)?P.arp2:P.arp;INS[ins](note,hv(P.arpV)*(k===0?1.06:1),t0+k*P.div*bt+jit(),P.div*bt*1.6,(note-66)/40);}
  // percussions (désert) : entrent après deux mesures, avec quelques notes fantômes
  if(P.perc&&bar>=2)P.perc.forEach(([b,k,a])=>{if(R()<0.12)return;const tt=t0+b*bt+jit();if(k==='d')insDoum(hv(P.percV)*a,tt);else insTek(hv(P.percV*0.55)*a,tt,(R()-0.5)*0.5);});
  // accords plaqués à contretemps (finance)
  if(P.comp)P.comp.forEach(b=>{[ch.t[0],ch.t[1],ch.t[3]].forEach((n,j)=>insEP(n,hv(P.compV),t0+b*bt+j*0.008,bt*0.8,(j-1)*0.25));});
  // mélodie : phrases de 2 mesures (A, A variée, B, silences)
  const sec=Math.floor(bar/2)%P.plan.length,part=P.plan[sec],half=bar%2;
  if(bar%(P.plan.length*2)===0){MUS.cyc++;if(!MUS.A||MUS.cyc%3===0){MUS.A=mkMotif();MUS.A2=varMotif(MUS.A);}MUS.B=mkMotif();}
  const M=part==='A'?MUS.A:part==='A2'?MUS.A2:part==='B'?MUS.B:null;
  if(M){
    // ancrage : note de l'accord la plus proche du centre du registre
    const mid=(P.reg[0]+P.reg[1])/2,tones=[];ch.t.forEach(n=>{for(let o=-24;o<=24;o+=12)tones.push(n+o);});
    const anc=tones.sort((a,b)=>Math.abs(a-mid)-Math.abs(b-mid))[0];
    let ai=0,bd=1e9;P.scale.forEach((n,i)=>{const d=Math.abs(n-anc);if(d<bd){bd=d;ai=i;}});
    M.forEach(x=>{if(x.b<half*4||x.b>=half*4+4)return;
      let i=Math.max(0,Math.min(P.scale.length-1,ai+x.s));let n=P.scale[i];
      while(n>P.reg[1])n-=12;while(n<P.reg[0])n+=12;
      // une note un demi-ton au-dessus d'une note de l'accord grince : on la pose sur la note de l'accord la plus proche
      const pcs=[ch.b,...ch.t].map(c=>((c%12)+12)%12);
      if(!P.raw&&pcs.some(c=>((n-c)%12+12)%12===1)){let best=n,bd2=99;[ch.b,...ch.t].forEach(c=>{for(let o=-36;o<=36;o+=12){const cand=c+o;const d=Math.abs(cand-n);if(d<bd2&&d>0){bd2=d;best=cand;}}});n=best;}
      INS[P.mel](n,hv(P.melV),t0+(x.b-half*4)*bt+jit(),x.d*bt*0.95,0.08);});
  }
}
function musicTick(t,m){
  const want=pickPiece(m);
  if(MUS.next<t)MUS.next=t+0.08;
  let guard=0;
  while(MUS.next<t+0.35&&guard++<4){
    if(want!==MUS.name){MUS.name=want;MUS.P=want?PIECES[want]:null;MUS.bar=0;MUS.cyc=0;MUS.A=null;MUS.rest=want?1:0;}
    const P=MUS.P;if(!P){MUS.next+=0.5;continue;}
    const bar=240/P.bpm;
    if(MUS.rest){MUS.rest=0;MUS.next+=bar*0.5;continue;}   // une demi-mesure de respiration entre deux morceaux
    scheduleBar(P,MUS.bar,MUS.next);MUS.next+=bar;MUS.bar++;
  }
}

/* m : poids des lieux (0…1), calculés dans 99_main/audioMix */
function audioUpdate(T,m){
  if(!AUDIO.on||!AUDIO.ctx) return;
  const A=AUDIO.ctx,t=A.currentTime,L=AUDIO.L;m=m||{desert:1};
  const w=k=>m[k]||0;
  musicTick(t,m);
  events(T,m,t);
  if(t-AUDIO.t<0.1) return;AUDIO.t=t;
  const des=w('desert'),ice=w('ice'),ic=w('icecave'),por=w('portal'),fin=w('fin'),st=w('stats'),sc=w('sandcave'),air=w('air'),night=w('night');
  // musique : volume selon la présence du lieu (silence pendant la montée dans les nuages)
  const mw=Math.max(des,ice,ic,por,fin,st,sc);
  _set(L.mus.gain,0.62*Math.min(1,mw*1.3),t,0.8);_set(L.musRev.gain,0.66*(1+0.3*(ic+sc)),t,0.8);
  // ambiance, très douce
  const g=(0.45+0.35*Math.sin(T*0.31)+0.2*Math.sin(T*0.83+1.3));
  _set(L.wind.gain,Math.max(0.12,g)*0.18*des*(1-0.4*night)+0.02*st);
  _set(L.lpW.frequency,280+g*260);
  _set(L.air.gain,0.36*air,t,0.5);_set(L.bpA.frequency,380+2200*w('airK'),t,0.6);
  _set(L.frost.gain,0.022*ice+0.015*ic,t,0.8);
  _set(L.room.gain,0.11*ic+0.13*sc,t,0.8);
  _set(L.roar.gain,(0.07*sc+0.015*ic)*(0.75+0.25*Math.random()),t,0.1);
  _set(L.sand.gain,(0.07*fin*(0.65+0.35*Math.sin(T*0.6))+0.015*st+0.022*des),t,0.4);
  _set(L.panS.pan,Math.sin(T*0.85)*0.8,t,0.15);
}
/* ── effets d'ambiance générés ── */
function events(T,m,t){
  const N=AUDIO.next,w=k=>m[k]||0,R=Math.random;
  const due=(k,iv)=>{if(N[k]===undefined)N[k]=t+iv*R();if(t>=N[k]){N[k]=t+iv*(0.5+R());return true;}return false;};
  if(w('icecave')>0.3&&due('drip',2.4))sfxDrip(0.028*w('icecave'),R()*1.6-0.8,1);
  const cr=w('sandcave')*9+w('icecave')*1.5;
  if(cr>0.3){if(N.crk===undefined)N.crk=t;if(t>=N.crk){N.crk=t-Math.log(1-R()*0.999)/cr;sfxCrackle(0.03*Math.min(1,w('sandcave')+w('icecave')*0.5),R()*1.6-0.8);}}
  if(w('desert')*w('night')>0.25&&due('crk2',1.1))sfxCricket(0.007*w('desert')*w('night'),[-0.6,0.15,0.7][Math.floor(R()*3)]);
  if(w('desert')*(1-w('night'))>0.3&&due('bird',3.2))sfxBird(0.006*w('desert')*(1-w('night')),R()*1.6-0.8);
  // jungle : cigales qui montent et retombent le jour, grenouilles la nuit, clapotis de l'eau
  if(w('desert')*(1-w('night'))>0.3&&due('cicada',9))sfxCicada(0.0045*w('desert')*(1-w('night')),R()*1.4-0.7);
  if(w('desert')*w('night')>0.3&&due('frog',1.8))sfxFrog(0.01*w('desert')*w('night'),R()*1.6-0.8);
  if(w('desert')>0.3&&due('lap',2.6))sfxNoise(0.25+R()*0.3,'bandpass',500+R()*500,1.2,0.006*w('desert'),R()*1.2-0.6,0.3,0.06);
}
function sfxOut(node,pan,rev){const A=AUDIO.ctx;const p=A.createStereoPanner();p.pan.value=pan||0;node.connect(p);p.connect(AUDIO.bus);if(rev){const s=AUDIO.gain(rev,AUDIO.revIn);p.connect(s);}return p;}
function sfxBell(f,amp,pan,dec){
  const A=AUDIO.ctx,t=A.currentTime;const car=A.createOscillator(),mod=A.createOscillator(),mg=A.createGain(),g=A.createGain();
  car.frequency.value=f;mod.frequency.value=f*3.5;mg.gain.setValueAtTime(f*1.1,t);mg.gain.exponentialRampToValueAtTime(f*0.04,t+dec*0.5);
  mod.connect(mg);mg.connect(car.frequency);
  g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(amp,t+0.006);g.gain.exponentialRampToValueAtTime(0.0001,t+dec);
  car.connect(g);sfxOut(g,pan,0.9);car.start(t);mod.start(t);car.stop(t+dec+0.05);mod.stop(t+dec+0.05);
}
function sfxDrip(amp,pan,rev){
  const A=AUDIO.ctx,t=A.currentTime;const o=A.createOscillator();const f=1100+Math.random()*1100;o.frequency.setValueAtTime(f,t);o.frequency.exponentialRampToValueAtTime(f*1.8,t+0.045);
  const g=A.createGain();g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(amp,t+0.004);g.gain.exponentialRampToValueAtTime(0.0001,t+0.11);
  o.connect(g);sfxOut(g,pan,rev);o.start(t);o.stop(t+0.13);
}
function sfxNoise(dur,type,f,q,amp,pan,rev,attack,buf){
  const A=AUDIO.ctx,t=A.currentTime;const s=A.createBufferSource();s.buffer=buf||AUDIO.white;
  const b=AUDIO.filt(type,f,q);const g=A.createGain();g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(amp,t+(attack||0.002));g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  s.connect(b);b.connect(g);sfxOut(g,pan,rev);s.start(t,Math.random()*1.5);s.stop(t+dur+0.05);return {b,g,t};
}
/* oiseau de la forêt : deux ou trois glissés rapides, très loin */
function sfxBird(amp,pan){
  const A=AUDIO.ctx,t=A.currentTime;const o=A.createOscillator();o.type='sine';const g=A.createGain();g.gain.value=0;
  const f0=2400+Math.random()*1600,k=2+Math.floor(Math.random()*3);
  for(let i=0;i<k;i++){const t0=t+i*(0.09+Math.random()*0.05),up=Math.random()<0.6;
    o.frequency.setValueAtTime(f0*(up?0.85:1.2),t0);o.frequency.exponentialRampToValueAtTime(f0*(up?1.3:0.8),t0+0.07);
    g.gain.setValueAtTime(0,t0);g.gain.linearRampToValueAtTime(amp,t0+0.012);g.gain.linearRampToValueAtTime(0,t0+0.075);}
  o.connect(g);sfxOut(g,pan,0.5);o.start(t);o.stop(t+k*0.15+0.1);
}
function sfxCicada(amp,pan){
  const A=AUDIO.ctx,t=A.currentTime,d=3+Math.random()*3;const s=A.createBufferSource();s.buffer=AUDIO.white;s.loop=true;
  const bp=AUDIO.filt('bandpass',5200+Math.random()*900,6);const am=A.createOscillator();am.frequency.value=38+Math.random()*12;const amg=A.createGain();amg.gain.value=0.5;
  const g=A.createGain();g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(amp,t+d*0.4);g.gain.exponentialRampToValueAtTime(0.0001,t+d);
  const vca=A.createGain();vca.gain.value=0.5;am.connect(amg);amg.connect(vca.gain);
  s.connect(bp);bp.connect(vca);vca.connect(g);sfxOut(g,pan,0.2);s.start(t,Math.random());am.start(t);s.stop(t+d+0.1);am.stop(t+d+0.1);
}
function sfxFrog(amp,pan){
  const A=AUDIO.ctx,t=A.currentTime;const o=A.createOscillator();o.type='triangle';const f=140+Math.random()*160;const g=A.createGain();g.gain.value=0;
  const k=1+Math.floor(Math.random()*3);
  for(let i=0;i<k;i++){const t0=t+i*0.16;o.frequency.setValueAtTime(f*1.25,t0);o.frequency.exponentialRampToValueAtTime(f,t0+0.09);g.gain.setValueAtTime(0,t0);g.gain.linearRampToValueAtTime(amp,t0+0.015);g.gain.linearRampToValueAtTime(0,t0+0.11);}
  const lp=AUDIO.filt('lowpass',900,0.8);o.connect(lp);lp.connect(g);sfxOut(g,pan,0.35);o.start(t);o.stop(t+k*0.16+0.2);
}
function sfxCrackle(amp,pan){sfxNoise(0.004+Math.random()*0.02,'bandpass',1400+Math.random()*2600,1.0,amp*(0.3+Math.random()),pan,0.2);}
function sfxCricket(amp,pan){
  const A=AUDIO.ctx,t=A.currentTime;const o=A.createOscillator();o.frequency.value=4300+Math.random()*400;const g=A.createGain();g.gain.value=0;
  for(let k=0;k<3+Math.floor(Math.random()*2);k++){const t0=t+k*0.05;g.gain.setValueAtTime(0,t0);g.gain.linearRampToValueAtTime(amp,t0+0.008);g.gain.linearRampToValueAtTime(0,t0+0.03);}
  o.connect(g);sfxOut(g,pan,0.2);o.start(t);o.stop(t+0.3);
}
let lastThud=0;
/* pagode : les clochettes de bronze tintent quand un pan de toit se soulève */
function audioThud(T,strength){
  if(!AUDIO.on||!AUDIO.ctx||T-lastThud<0.45) return;lastThud=T;
  const n=[79,81,83,86,88][Math.floor(Math.random()*5)];
  sfxBell(NOTE(n),0.011*strength,(Math.random()-0.5)*0.8,2.4);
  if(Math.random()<0.4)setTimeout(()=>{if(AUDIO.on)sfxBell(NOTE(n+(Math.random()<0.5?2:-3)),0.006*strength,(Math.random()-0.5)*0.8,2.0);},90+Math.random()*120);
}
document.getElementById('snd').addEventListener('click',audioToggle);
/* Glace : craquements pendant la fonte, gouttes */
let lastCrack=0,lastDrip=0;
function audioCrack(T,strength){
  if(!AUDIO.on||!AUDIO.ctx||T-lastCrack<0.06) return;lastCrack=T;
  const A=AUDIO.ctx,t=A.currentTime,len=Math.floor(A.sampleRate*0.12);
  const buf=A.createBuffer(1,len,A.sampleRate),d=buf.getChannelData(0);
  for(let i=0;i<len;i++){const e=Math.exp(-i/(len*0.08));d[i]=(Math.random()*2-1)*e*(Math.random()<0.3?1:0.35);}
  const s=A.createBufferSource();s.buffer=buf;
  const hp=A.createBiquadFilter();hp.type='bandpass';hp.frequency.value=2200+Math.random()*2600;hp.Q.value=1.4;
  const g=A.createGain();g.gain.value=0.11*strength;
  s.connect(hp);hp.connect(g);sfxOut(g,Math.random()*0.8-0.4,0.35);s.start(t);
}
function audioDrip(T){
  if(!AUDIO.on||!AUDIO.ctx||T-lastDrip<0.15) return;lastDrip=T;
  sfxDrip(0.022,Math.random()*0.6-0.3,0.5);
}
/* éclatement cristallin (bloc / livre libéré) : une gerbe descendante dans la gamme du morceau en cours */
function audioShatter(T,strength){
  if(!AUDIO.on||!AUDIO.ctx)return;strength=strength||1;
  const sc=(MUS.P?MUS.P.scale:PIECES.ice.scale).slice(-8).reverse();
  sc.forEach((n,i)=>setTimeout(()=>{if(AUDIO.on)sfxBell(NOTE(n),0.022*strength,Math.random()*1.6-0.8,1.6+Math.random());},i*55+Math.random()*30));
}
/* effondrement de sable (cocon de la finance, livres ensablés) */
function audioSand(T,strength){
  if(!AUDIO.on||!AUDIO.ctx)return;strength=strength||1;
  const n=sfxNoise(1.4,'lowpass',800,0.6,0.13*strength,0,0.25,0.04,AUDIO.pink);n.b.frequency.exponentialRampToValueAtTime(200,n.t+1.3);
  audioThud(T,0.7*strength);
}
/* plongée dans une grotte (dir -1) ou remontée (dir +1) : souffle filtré qui balaie */
function audioWhoosh(dir){
  if(!AUDIO.on||!AUDIO.ctx)return;
  const n=sfxNoise(1.6,'bandpass',dir<0?2200:300,1.2,0.11,0,0.5,0.5,AUDIO.pink);
  n.b.frequency.exponentialRampToValueAtTime(dir<0?260:2200,n.t+1.5);
}
/* traversée du portail : grondement grave et doux + souffle */
function audioBoom(){
  if(!AUDIO.on||!AUDIO.ctx)return;const A=AUDIO.ctx,t=A.currentTime;
  const o=A.createOscillator();o.frequency.setValueAtTime(55,t);o.frequency.exponentialRampToValueAtTime(30,t+2.4);
  const g=A.createGain();g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(0.18,t+0.12);g.gain.exponentialRampToValueAtTime(0.0001,t+2.8);
  o.connect(g);sfxOut(g,0,0.6);o.start(t);o.stop(t+2.9);
  audioWhoosh(1);
}

/* ═══ 09 · Heure du jour : cinq ambiances selon l'horloge du visiteur ═══
   08 h–11 h  AUBE         brume du matin couchée sur la forêt, lumière dorée rasante
   11 h–16 h  JOUR         lumière claire et humide, brume légère sur les collines
   16 h–18 h  COUCHANT     heure dorée, brume chaude dans les vallons
   18 h–20 h  CRÉPUSCULE   ciel mauve et rose, les lanternes s'allument, premières lucioles
   20 h–08 h  NUIT         clair de lune, étoiles, lanternes, lucioles
   Chaque ambiance a un état de début (a) et de fin (b) : la lumière dérive lentement à
   l'intérieur d'une plage, puis bascule en fondu de 3 min quand on franchit l'heure.
   ?heure=17 ou ?heure=17:30 force l'heure (tests). */
const TOD_NAMES=['AUBE','JOUR','COUCHANT','CRÉPUSCULE','NUIT'];
const TOD_RANGES=[[8,11],[11,16],[16,18],[18,20],[20,32]];
let TOD_FORCED=(()=>{const q=Q.get('heure');if(q===null)return null;const m=String(q).split(/[:hH]/);const h=(+m[0]||0)+(+(m[1]||0))/60;return isFinite(h)?((h%24)+24)%24:null;})();
function todHourNow(){
  if(TOD_FORCED!==null) return TOD_FORCED;
  const d=new Date();return d.getHours()+d.getMinutes()/60+d.getSeconds()/3600;
}
function todPhaseOf(h){
  for(let i=0;i<4;i++){const [a,b]=TOD_RANGES[i];if(h>=a&&h<b)return {i,u:(h-a)/(b-a)};}
  const hh=h<8?h+24:h;return {i:4,u:(hh-20)/12};
}

/* Réglages. Couleurs en hex, directions en [x,y,z] (normalisées ensuite).
   mist : bancs de brume au sol · motes : pollen dans la lumière · fly : lucioles.
   Les clés ice* règlent l'espace d'ambre des blocs (miel le jour, cuivre au couchant, braise la nuit). */
const TOD_RAW=[
  { // AUBE — la brume du matin couche la forêt, lumière dorée rasante, pollen dans les rayons
    a:{sunDir:[-0.135,0.208,0.969],sunCol:'#ffc58a',sunI:2.6,hemiSky:'#9fb4c8',hemiGnd:'#3a4a24',hemiI:0.5,envI:0.4,
       fog:'#b4c2ac',fogD:0.0052,fogH:0.05,zenith:'#6f93c4',gradK:2.4,glowFog:'#ffd49a',glowFogI:0.45,glowPow:4.5,
       glowSky:'#ffd090',glowI:1.0,glowP:3,glowH:4.5,diskCol:'#ffe2b0',diskI:1.3,diskSize:0.016,
       cloudCov:0.42,cloudLit:'#ffc8b8',cloudDark:'#8090a8',cloudI:1.1,stars:0,milky:0,moonI:0,
       rays:2.0,beams:0.28,flare:0.6,expo:0.96,bloomS:0.4,bloomT:0.88,heat:0,grain:0.03,lum:0.8,dust:0.35,windK:0.35,lantern:0.15,camPh:-0.02,camTy:1.0,mist:1.0,marsh:0.022,motes:0.9,fly:0,
       iceTop:'#60493b',iceMid:'#977457',iceBot:'#3e2b20',iceGlow:'#ffd6a4',iceFog:'#906f50'},
    b:{sunDir:[0.001,0.530,0.848],sunCol:'#ffe2bc',sunI:3.2,hemiSky:'#b6c8d2',hemiI:0.42,fog:'#a9bea8',fogD:0.005,zenith:'#7d9fc4',
       glowFog:'#ffe0b0',glowFogI:0.5,glowSky:'#ffe0b8',glowI:0.45,glowP:5,cloudCov:0.25,cloudLit:'#fff0e0',cloudDark:'#9aa6b4',cloudI:0.85,
       expo:1.04,lum:0.95,lantern:0,mist:0.7,marsh:0.012,motes:1.0,camPh:0,camTy:0,
       iceTop:'#6a4f36',iceMid:'#a27d52',iceBot:'#432f1d',iceGlow:'#ffe0a8',iceFog:'#997850'},
  },
  { // JOUR — lumière claire et humide, brume légère sur les collines
    a:{sunDir:[0.602,0.669,0.436],sunCol:'#fff0d6',sunI:4.0,hemiSky:'#b9cfdd',hemiGnd:'#3e4e26',hemiI:0.3,envI:0.4,
       fog:'#9db7a2',fogD:0.0027,fogH:0.05,zenith:'#6d97c8',gradK:2.8,glowFog:'#fff0d0',glowFogI:0.3,glowPow:5,
       glowSky:'#fff4dc',glowI:0.25,glowP:6,glowH:4,diskCol:'#fff6e0',diskI:1.4,diskSize:0.012,
       cloudCov:0.3,cloudLit:'#ffffff',cloudDark:'#a8b4c0',cloudI:0.8,stars:0,milky:0,moonI:0,
       rays:1.6,beams:0.18,flare:0.5,expo:1.0,bloomS:0.38,bloomT:0.93,heat:0,grain:0.028,lum:1.0,dust:0.35,windK:0.6,lantern:0,mist:0.35,marsh:0,motes:1.0,fly:0,
       iceTop:'#6d5130',iceMid:'#a7844f',iceBot:'#46311b',iceGlow:'#ffe2a0',iceFog:'#9e7c4d'},
    b:{sunDir:[0.807,0.530,0.261],sunCol:'#ffe8c4'},
  },
  { // COUCHANT — l'heure dorée : soleil rasant, brume chaude dans les vallons
    a:{sunDir:[0.853,0.358,0.379],sunCol:'#ffbf6a',sunI:3.3,hemiSky:'#a8b8c8',hemiGnd:'#4a4224',hemiI:0.34,envI:0.34,
       fog:'#c8b48c',fogD:0.0037,fogH:0.06,zenith:'#6e8cbc',gradK:2.2,glowFog:'#ffc060',glowFogI:0.55,glowPow:4.5,
       glowSky:'#ffc65a',glowI:1.1,glowP:3,glowH:4,diskCol:'#fff0b8',diskI:1.6,diskSize:0.015,
       cloudCov:0.35,cloudLit:'#ffd8a0',cloudDark:'#8a92a8',cloudI:0.9,stars:0,milky:0,moonI:0,
       rays:2.2,beams:0.26,flare:0.6,expo:1.0,bloomS:0.42,bloomT:0.88,heat:0,grain:0.03,lum:0.92,dust:0.35,windK:0.4,lantern:0,mist:0.7,marsh:0.005,motes:1.0,fly:0,
       iceTop:'#5f3922',iceMid:'#9b6335',iceBot:'#3a2214',iceGlow:'#ffbe6a',iceFog:'#905c33'},
    b:{sunDir:[0.959,0.156,0.238],sunCol:'#ffa848',fog:'#c2a888',glowFog:'#ffa848',glowSky:'#ffb04c',cloudLit:'#ffc088',lum:0.85,lantern:0.08,
       iceTop:'#542e1c',iceMid:'#90562c',iceBot:'#331c10',iceGlow:'#ffaa55',iceFog:'#84502b'},
  },
  { // CRÉPUSCULE — ciel mauve et rose, les lanternes s'allument, premières lucioles
    a:{sunDir:[0.984,0.052,0.172],sunCol:'#ff8a5a',sunI:2.4,hemiSky:'#6c6a96',hemiGnd:'#2a2418',hemiI:0.3,envI:0.26,
       fog:'#86749a',fogD:0.0055,fogH:0.05,zenith:'#3e4a7c',gradK:2.6,glowFog:'#ff8a60',glowFogI:0.55,glowPow:4.0,
       glowSky:'#ff7a50',glowI:0.9,glowP:4,glowH:5,diskCol:'#ffb080',diskI:1.2,diskSize:0.016,
       cloudCov:0.45,cloudLit:'#ff9a7a',cloudDark:'#4a4466',cloudI:1.0,stars:0,milky:0,moonI:0,
       rays:0.8,beams:0.1,flare:0.3,expo:1.06,bloomS:0.6,bloomT:0.86,heat:0,grain:0.03,lum:0.62,dust:0.35,windK:0.3,lantern:0.55,camPh:-0.02,camTy:1.0,mist:0.8,marsh:0.012,motes:0.4,fly:0.35,
       iceTop:'#4e2c22',iceMid:'#8a5038',iceBot:'#2a1712',iceGlow:'#f0a070',iceFog:'#7e4a34'},
    b:{sunDir:[0.995,0.017,0.103],sunCol:'#d85a5a',sunI:1.8,fog:'#5a5070',zenith:'#262e58',glowFog:'#e05a50',glowSky:'#d04a48',
       cloudLit:'#e0705a',cloudDark:'#30304e',hemiI:0.24,lum:0.45,lantern:0.85,fly:0.7,motes:0.15,
       iceTop:'#43241e',iceMid:'#7a4232',iceBot:'#24130f',iceGlow:'#e08a62',iceFog:'#6e3e2e'},
  },
  { // NUIT — clair de lune bleu, lanternes et lucioles, brume argentée
    a:{sunDir:[-0.25,0.85,0.46],sunCol:'#9ab2ec',sunI:2.5,hemiSky:'#36507e',hemiGnd:'#101814',hemiI:0.55,envI:0.42,
       fog:'#16263a',fogD:0.0045,fogH:0.05,zenith:'#02050a',gradK:2.2,glowFog:'#30486a',glowFogI:0.12,glowPow:8,
       glowSky:'#3a5080',glowI:0.1,glowP:8,glowH:6,diskDir:[-0.25,0.85,0.46],diskCol:'#d8e2ff',diskI:0,diskSize:0.012,
       cloudCov:0.15,cloudLit:'#26314c',cloudDark:'#080c16',cloudI:0.5,stars:1.0,milky:0.8,moonDir:[-0.25,0.85,0.46],moonI:1.0,
       rays:3.6,beams:0.24,flare:0.3,expo:1.6,bloomS:0.65,bloomT:0.78,heat:0,grain:0.042,lum:0.3,dust:0.3,windK:0.3,lantern:1.0,camPh:-0.04,camTy:2.0,night:0.6,mist:0.75,marsh:0.008,motes:0,fly:1.0,
       iceTop:'#2a1a10',iceMid:'#5a3a20',iceBot:'#160d07',iceGlow:'#e0a050',iceFog:'#4e3220'},
    b:{},
  },
];
const TOD_COL=new Set(['sunCol','hemiSky','hemiGnd','fog','zenith','glowFog','glowSky','diskCol','cloudLit','cloudDark','iceTop','iceMid','iceBot','iceGlow','iceFog']);
const TOD_DIR=new Set(['sunDir','diskDir','moonDir']);
function todMk(o){const r={};for(const k in o){const v=o[k];r[k]=TOD_COL.has(k)?new THREE.Color(v):TOD_DIR.has(k)?new THREE.Vector3(...v).normalize():v;}return r;}
const TOD_K=TOD_RAW.map(p=>{const a=Object.assign({diskDir:p.a.sunDir,moonDir:[-0.32,0.58,0.75],camPh:0,camTy:0,night:0},p.a);const b=Object.assign({},a,p.b);if(!p.b.diskDir&&p.b.sunDir)b.diskDir=p.b.sunDir;return {a:todMk(a),b:todMk(b)};});
function todClone(p){const r={};for(const k in p){const v=p[k];r[k]=(v&&v.clone)?v.clone():v;}return r;}
function todLerp(out,a,b,t){
  for(const k in a){const x=a[k],y=b[k];
    if(x&&x.isColor){(out[k]||(out[k]=new THREE.Color())).copy(x).lerp(y,t);}
    else if(x&&x.isVector3){(out[k]||(out[k]=new THREE.Vector3())).copy(x).lerp(y,t).normalize();}
    else out[k]=x+(y-x)*t;}
  return out;
}
const TOD={i:-1,u:0,cur:{},from:null,xf:1,XF:180,chk:0,envT:0,envDirty:true,name:'',ground:new THREE.Color()};
function todTarget(out){
  const {i,u}=todPhaseOf(todHourNow());
  return {i,u,p:todLerp(out||{},TOD_K[i].a,TOD_K[i].b,smooth(0,1,u))};
}
/* menu dev : forcer une heure (null = horloge réelle) ; bascule rapide (2,5 s) */
function todForce(h){TOD_FORCED=(h===null||h===undefined)?null:((h%24)+24)%24;TOD.XF=2.5;TOD.chk=0;TOD.envT=237;}
function todInit(){
  const t=todTarget(TOD.cur);TOD.i=t.i;TOD.u=t.u;TOD.name=TOD_NAMES[t.i];TOD.xf=1;
  todApply();TOD.envDirty=true;
}
const _todTmp={};
function todUpdate(dt){
  TOD.chk-=dt;
  if(TOD.chk<=0){TOD.chk=1;
    const t=todTarget(_todTmp);TOD.u=t.u;
    if(t.i!==TOD.i){TOD.from=todClone(TOD.cur);TOD.xf=0;TOD.i=t.i;TOD.name=TOD_NAMES[t.i];}
    TOD.tgt=t.p;
  }
  if(TOD.tgt){
    if(TOD.xf<1){TOD.xf=Math.min(1,TOD.xf+dt/TOD.XF);todLerp(TOD.cur,TOD.from,TOD.tgt,smooth(0,1,TOD.xf));
      TOD.envT+=dt;if(TOD.envT>15||TOD.xf>=1){TOD.envT=0;TOD.envDirty=true;}if(TOD.xf>=1)TOD.XF=180;}
    else{todLerp(TOD.cur,TOD.cur,TOD.tgt,Math.min(1,dt*(TOD.XF<10?1.5:0.5)));TOD.envT+=dt;if(TOD.envT>240){TOD.envT=0;TOD.envDirty=true;}}
  }
  todApply();
}
/* applique l'ambiance : ciel, lumières (intensités de base), valeurs globales du désert */
function todApply(){
  const c=TOD.cur,S=SKY_U;
  S.uZenith.value.copy(c.zenith);S.uGradK.value=c.gradK;
  S.uGlowSky.value.copy(c.glowSky);S.uGlowI.value=c.glowI;S.uGlowP.value=c.glowP;S.uGlowH.value=c.glowH;
  S.uDiskDir.value.copy(c.diskDir);S.uDiskCol.value.copy(c.diskCol);S.uDiskI.value=c.diskI;S.uDiskSize.value=c.diskSize;
  S.uCloudCov.value=c.cloudCov;S.uCloudLit.value.copy(c.cloudLit);S.uCloudDark.value.copy(c.cloudDark);S.uCloudI.value=c.cloudI;
  S.uStars.value=c.stars;S.uMilky.value=c.milky;S.uMoonDir.value.copy(c.moonDir);S.uMoonI.value=c.moonI;
  sun.color.copy(c.sunCol);sun.userData.baseI=c.sunI;
  hemi.color.copy(c.hemiSky);hemi.groundColor.copy(c.hemiGnd);hemi.userData.baseI=c.hemiI;
  U.uLantern.value=c.lantern;
  // sol vu par l'environnement : mousse éclairée par le soleil et le ciel
  TOD.ground.set('#4a5a30').multiply(_todC.copy(c.sunCol).multiplyScalar(clamp01(c.sunI*Math.max(c.sunDir.y,0.02)*0.55+0.05)).add(_todC2.copy(c.hemiSky).multiplyScalar(c.hemiI*0.6)));
}
const _todC=new THREE.Color(),_todC2=new THREE.Color();
/* valeurs globales quand on est dans la jungle (appelée par la zone et à chaque image) */
function todDesertGlobals(fogMul){
  const c=TOD.cur;
  U.uFogColor.value.copy(c.fog);U.uFogDensity.value=c.fogD*(fogMul||1);U.uFogHeight.value=c.fogH;
  U.uSunDir.value.copy(c.sunDir);U.uSunColor.value.copy(c.sunCol).multiplyScalar(Math.min(1,c.sunI/3.6));
  U.uGlowCol.value.copy(c.glowFog).multiplyScalar(c.glowFogI);U.uGlowPow.value=c.glowPow;U.uLum.value=c.lum;
  renderer.toneMappingExposure=c.expo;bloom.strength=c.bloomS;bloom.threshold=c.bloomT;
  finalPass.uniforms.uHeat.value=c.heat;finalPass.uniforms.uGrain.value=c.grain*0.33;finalPass.uniforms.uNight.value=c.night;
  scene.environmentIntensity=c.envI;
  sun.intensity=c.sunI*1.16;hemi.intensity=c.hemiI*0.76;
  // brume de marécage : nappe basse au ras de l'eau (aube surtout), qui dérive par lambeaux
  U.uMistK.value=c.marsh||0;U.uMistH.value=1.1;U.uMistCol.value.copy(c.fog).lerp(_todC.setRGB(0.9,0.93,0.9),0.3).multiplyScalar(0.55+0.45*c.lum);
}

/* ═══ 10 · Espace d'ambre chaud : fond miel, brume dorée, poussière de résine, textes flous ═══
   Inspiré de l'espace gris d'igloo, viré vers l'ambre (L1). Tout l'espace vit loin sous la
   jungle (ICE_ORIGIN) ; les couleurs suivent l'heure du visiteur (clés ice* de 09_tod). */
const ICE_ORIGIN = new THREE.Vector3(0,-4000,0);
const ICE_PAL = {
  fog:  new THREE.Color('#91714f'),
  top:  new THREE.Color('#6b5440'),
  mid:  new THREE.Color('#977751'),
  bot:  new THREE.Color('#3e2c1e'),
  glow: new THREE.Color('#ffd9a0'),
};

function buildIceSpace(){
  const root = new THREE.Group();
  root.position.copy(ICE_ORIGIN);
  scene.add(root);

  /* — Fond : dégradé rouge sourd, halo derrière le bloc, nappes de brume lentes, trame de points — */
  const bgU = {uN3:U.uN3,
    uTime:U.uTime, uDot:{value:150*DPR}, uDotA:{value:0.055},
    uTop:{value:ICE_PAL.top}, uMid:{value:ICE_PAL.mid}, uBot:{value:ICE_PAL.bot}, uGlow:{value:ICE_PAL.glow},
    uGlowDir:{value:new THREE.Vector3(0,0,-1)}, uBright:{value:1},
  };
  const bgMat = new THREE.ShaderMaterial({
    uniforms:bgU, depthWrite:false, depthTest:false, side:THREE.BackSide,
    vertexShader:`varying vec3 vDir;void main(){vDir=normalize(position);vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.0);gl_Position=p.xyww;}`,
    fragmentShader:"#define RV_FRAG\n"+GLSL_NOISE+`
      uniform float uTime;uniform float uDot;uniform float uDotA;uniform vec3 uTop;uniform vec3 uMid;uniform vec3 uBot;uniform vec3 uGlow;uniform vec3 uGlowDir;uniform float uBright;
      varying vec3 vDir;
      void main(){
        vec3 d=normalize(vDir);
        vec3 col=d.y>0.0?mix(uMid,uTop,smoothstep(0.0,0.75,d.y)):mix(uMid,uBot,smoothstep(0.0,-0.65,d.y));
        float g=max(dot(d,uGlowDir),0.0);
        col=mix(col,uGlow,pow(g,9.0)*0.3+pow(g,40.0)*0.3+pow(g,220.0)*0.2);
        col*=0.7+0.3*pow(g,40.0);   // vignette : le halo d'ambre au centre, les bords plus profonds
        // nappes de brume : grandes masses floues qui dérivent
        float n=rvFbm3(d*2.4+vec3(uTime*0.012,uTime*0.004,-uTime*0.008));
        float n2=rvFbm3(d*5.5+vec3(-uTime*0.02,0.0,uTime*0.01)+4.0);
        col*=0.93+0.12*n+0.04*n2;
        // voiles de brume dorée qui passent lentement devant le halo
        float veil=smoothstep(0.52,0.8,rvFbm3(d*3.2+vec3(uTime*0.018,-uTime*0.006,uTime*0.01)+9.0));
        col+=uGlow*veil*(0.07+0.16*pow(g,3.0));
        // trame de points fixe à l'écran (comme igloo)
        vec2 q=mod(gl_FragCoord.xy+uDot*0.5,uDot)-uDot*0.5;
        col+=vec3(1.0,0.88,0.66)*smoothstep(1.7,0.5,length(q))*uDotA;
        gl_FragColor=vec4(col*uBright,1.0);
      }`
  });
  const bg = new THREE.Mesh(new THREE.SphereGeometry(400, 48, 24), bgMat);
  bg.frustumCulled=false; bg.renderOrder=-20;
  scene.add(bg);

  /* — Lumière studio : clé chaude en haut à gauche, contre-jour rosé, débouchage bas — */
  const key = new THREE.DirectionalLight(new THREE.Color('#ffe8c8'), 2.6);
  key.position.set(-6, 9, 7); root.add(key); root.add(key.target); key.target.position.set(0,2,0);
  const rim = new THREE.DirectionalLight(new THREE.Color('#ffcf8a'), 1.4);
  rim.position.set(7, 4, -8); root.add(rim); root.add(rim.target); rim.target.position.set(0,2,0);
  const fill = new THREE.DirectionalLight(new THREE.Color('#c08a52'), 0.5);
  fill.position.set(2, -6, 6); root.add(fill); root.add(fill.target); fill.target.position.set(0,2,0);

  /* — Textes flous en arrière-plan (références propres à chaque matière, profondeur de champ) — */
  const texts = [];
  function addTexts(words,yC){
    words.forEach((w,i)=>{
      const cv=document.createElement('canvas');cv.width=1024;cv.height=256;
      const cx=cv.getContext('2d');
      const blur=16+rand()*20;
      // flou portable : on ne dessine que l'ombre du texte (fonctionne aussi sous Safari)
      cx.font='700 120px "JetBrains Mono", ui-monospace, monospace';
      cx.textBaseline='middle';cx.shadowColor='rgba(255,228,182,1)';cx.shadowBlur=blur;cx.shadowOffsetX=2048;
      cx.fillStyle='#000';cx.fillText(w,40-2048,128);
      const tex=new THREE.CanvasTexture(cv);tex.colorSpace=THREE.SRGBColorSpace;
      const m=new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,opacity:0.0,fog:false,toneMapped:true});
      const sc=2.2+rand()*2.6;
      const mesh=new THREE.Mesh(new THREE.PlaneGeometry(sc*4,sc),m);
      const side=i%2?1:-1;
      mesh.position.set(side*(14+rand()*18),yC+(rand()-0.3)*18,-26-rand()*34);
      mesh.userData={base:mesh.position.clone(),sp:0.05+rand()*0.12,ph:rand()*6.28,op:0.014+rand()*0.022};
      mesh.renderOrder=-5;
      root.add(mesh);texts.push(mesh);
    });
  }

  /* — Poussière de résine en suspension : un espace calme (aucun vent), des grains dorés
     qui dérivent très lentement sur toute la hauteur du parcours — */
  const MN=MOBILE?380:900,mp=new Float32Array(MN*3),mr=new Float32Array(MN*4);
  for(let i=0;i<MN;i++){mp[i*3]=(rand()*2-1)*16;mp[i*3+1]=12-rand()*(SUBJECTS_N*16+30);mp[i*3+2]=-28+rand()*40;mr[i*4]=rand();mr[i*4+1]=rand();mr[i*4+2]=rand();mr[i*4+3]=rand();}
  const mg=new THREE.BufferGeometry();mg.setAttribute('position',new THREE.BufferAttribute(mp,3));mg.setAttribute('aR',new THREE.BufferAttribute(mr,4));
  const motes=new THREE.Points(mg,new THREE.ShaderMaterial({uniforms:{uTime:U.uTime,uCol:{value:ICE_PAL.glow},uPx:{value:DPR}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    vertexShader:`uniform float uTime;uniform float uPx;attribute vec4 aR;varying float vA;
      void main(){vec3 p=position+vec3(sin(uTime*0.05*(0.5+aR.x)+aR.y*6.28)*1.6,sin(uTime*0.035*(0.5+aR.z)+aR.w*6.28)*1.2,cos(uTime*0.04*(0.5+aR.y)+aR.x*6.28)*1.4);
        vec4 mv=modelViewMatrix*vec4(p,1.0);float d=-mv.z;
        vA=smoothstep(1.5,5.0,d)*(1.0-smoothstep(26.0,48.0,d))*(0.35+0.65*aR.w)*(0.6+0.4*sin(uTime*(0.4+aR.z)+aR.x*20.0));
        gl_PointSize=(1.3+2.9*aR.z*aR.z+3.5*step(0.93,aR.x))*uPx*(14.0/max(d,1.0))+0.6;gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`uniform vec3 uCol;varying float vA;void main(){float r=length(gl_PointCoord-0.5);float a=smoothstep(0.5,0.0,r)*vA*0.42;if(a<0.003)discard;gl_FragColor=vec4(mix(uCol,vec3(1.0,0.84,0.5),0.45)*a,a);}`}));
  motes.frustumCulled=false;motes.renderOrder=6;root.add(motes);

  return {root,bg,bgU,lights:[key,rim,fill],texts,addTexts,motes,
    update(dt,T,cam){
      bg.position.copy(cam.position);
      for(const m of texts){
        const u=m.userData;
        m.position.y=u.base.y+Math.sin(T*u.sp+u.ph)*0.8;
        m.position.x=u.base.x+Math.sin(T*u.sp*0.7+u.ph*2.0)*1.2;
        m.material.opacity=u.op;
        m.quaternion.copy(cam.quaternion);
      }
    }
  };
}

/* Teinte de l'espace selon l'heure du visiteur (aube bleutée, jour sable, couchant bleu et or,
   crépuscule rouge, nuit bleu profond) : les couleurs sont modifiées sur place, tous les
   matériaux qui les référencent suivent ; les lumières studio prennent la couleur du halo. */
const _icT=new THREE.Color();
function icePalApply(lights){
  const c=TOD.cur;if(!c.iceMid)return;
  ICE_PAL.top.copy(c.iceTop);ICE_PAL.mid.copy(c.iceMid);ICE_PAL.bot.copy(c.iceBot);ICE_PAL.glow.copy(c.iceGlow);ICE_PAL.fog.copy(c.iceFog);
  if(lights){const [key,rim,fill]=lights;
    key.color.set('#ffe8c8').lerp(c.iceGlow,0.2);
    rim.color.copy(c.iceGlow).lerp(_icT.set('#ffffff'),0.45);
    fill.color.copy(c.iceMid).multiplyScalar(1.25);}
}
/* Environnement studio (reflets de l'or et de l'ambre), aux couleurs de l'heure */
function buildIceEnv(){
  const pm=new THREE.PMREMGenerator(renderer);
  const es=new THREE.Scene();
  const eT=new THREE.Color('#8a6a48'),eM=new THREE.Color('#5e4430'),eB=new THREE.Color('#251a10');
  if(TOD.cur.iceMid){eT.copy(TOD.cur.iceTop).multiplyScalar(1.5);eM.copy(TOD.cur.iceMid).multiplyScalar(0.72);eB.copy(TOD.cur.iceBot).multiplyScalar(0.72);}
  const sph=new THREE.Mesh(new THREE.SphereGeometry(50,48,24),new THREE.ShaderMaterial({side:THREE.BackSide,
    uniforms:{uTop:{value:eT},uMid:{value:eM},uBot:{value:eB}},
    vertexShader:`varying vec3 vD;void main(){vD=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`uniform vec3 uTop;uniform vec3 uMid;uniform vec3 uBot;varying vec3 vD;void main(){vec3 d=normalize(vD);vec3 c=d.y>0.0?mix(uMid,uTop,smoothstep(0.0,0.8,d.y)):mix(uMid,uBot,smoothstep(0.0,-0.5,d.y));gl_FragColor=vec4(c,1.0);}`}));
  es.add(sph);
  const panel=(w,h,col,k,pos)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color(col).multiplyScalar(k),side:THREE.DoubleSide}));m.position.copy(pos);m.lookAt(0,0,0);es.add(m);};
  panel(22,14,'#fff0d8',7.0,new THREE.Vector3(-24,26,20));   // boîte à lumière principale
  panel(4,38,'#ffd8a0',6.0,new THREE.Vector3(38,4,-14));     // bande de contre-jour
  panel(30,30,'#f5e0c0',1.6,new THREE.Vector3(0,46,0));      // plafond diffus
  panel(18,6,'#d99a5a',1.2,new THREE.Vector3(6,-4,40));      // débouchage chaud
  panel(6,22,'#fff',4.0,new THREE.Vector3(-40,6,-18));
  panel(3,26,'#fff',3.0,new THREE.Vector3(30,10,36));      // découpe arrière gauche
  const tex=pm.fromScene(es,0.02).texture;pm.dispose();
  return tex;
}

/* ═══ 11 · Matériaux des objets + outils communs (scan au survol, points critiques) ═══ */

/* Laiton patiné (balance, garde du glaive, bagues du marteau) */
function matBrass(wetU,dis){
  return patch(new THREE.MeshStandardMaterial({color:new THREE.Color('#c8994f'),metalness:1,roughness:0.3,envMapIntensity:1.25}),{
    uniforms:wetU,
    vHead:'varying vec3 vRvL;',vMain:'vRvL=transformed;',
    fHead:'varying vec3 vRvL;uniform float uObjWet;',
    fColor:`
      float bn=rvFbm3(vRvL*3.3);
      float tarn=smoothstep(0.52,0.82,rvFbm3(vRvL*8.0+3.0));
      diffuseColor.rgb*=mix(0.84,1.05,bn);
      diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(0.52,0.42,0.30),tarn*0.5);
      diffuseColor.rgb*=1.0-uObjWet*0.12;`,
    fRough:`roughnessFactor=clamp(0.19+0.2*rvFbm3(vRvL*6.0+1.0)+0.14*smoothstep(0.52,0.82,rvFbm3(vRvL*8.0+3.0))+0.05*rvNoise(vec3(vRvL.x*40.0,vRvL.y*3.0,vRvL.z*40.0)),0.08,0.7);
      roughnessFactor=mix(roughnessFactor,0.07,uObjWet*0.75);`,
    dissolve:!!dis,
  },'brass');
}

/* Marbre noir veiné (socle de la balance) */
function matMarbleBlack(){
  return patch(new THREE.MeshPhysicalMaterial({color:new THREE.Color('#181514'),roughness:0.16,clearcoat:1,clearcoatRoughness:0.05,envMapIntensity:1.1}),{
    vHead:'varying vec3 vRvL;',vMain:'vRvL=transformed;',
    fHead:'varying vec3 vRvL;',
    fColor:`
      vec3 q=vRvL*2.6;float w=rvFbm(q*1.2);
      float v=abs(sin((q.x*0.8+q.y*1.9+q.z*0.6)*2.2+w*8.0));
      float vein=smoothstep(0.06,0.0,v)*0.85+smoothstep(0.22,0.0,v)*0.14;
      float cl=rvFbm3(q*3.0+5.0);
      diffuseColor.rgb=mix(diffuseColor.rgb*mix(0.8,1.25,cl),vec3(0.64,0.56,0.45),vein*0.55);`,
    fRough:`roughnessFactor=0.14+0.1*rvFbm3(vRvL*9.0);`,
  },'marbleK');
}

/* Marbre blanc (temple) */
function matMarbleWhite(wetU){
  return patch(new THREE.MeshPhysicalMaterial({color:new THREE.Color('#e6dfd4'),roughness:0.3,clearcoat:0.25,clearcoatRoughness:0.25,envMapIntensity:1.0}),{
    uniforms:wetU,
    vHead:'varying vec3 vRvL;',vMain:'vRvL=transformed;',
    fHead:'varying vec3 vRvL;uniform float uObjWet;',
    fColor:`
      vec3 q=vRvL*1.7;float w=rvFbm(q*1.4+2.0);
      float v=abs(sin((q.x*1.1-q.y*0.6+q.z*0.8)*2.6+w*7.0));
      float vein=smoothstep(0.05,0.0,v)*0.5+smoothstep(0.2,0.0,v)*0.12;
      float cl=rvFbm3(q*2.4+9.0);
      diffuseColor.rgb*=mix(0.9,1.04,cl);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.50,0.47,0.45),vein*0.5);
      // salissure douce dans les parties basses, comme une pierre exposée
      diffuseColor.rgb*=mix(0.86,1.0,smoothstep(-0.2,0.9,vRvL.y+(rvFbm3(q*3.0)-0.5)*0.6));
      diffuseColor.rgb*=1.0-uObjWet*0.08;`,
    fRough:`roughnessFactor=mix(0.22+0.16*rvFbm3(vRvL*7.0),0.08,uObjWet*0.7);`,
  },'marbleW');
}

/* Acier poli brossé (lame) — gravure dorée dans la gouttière */
function matSteel(wetU,engrave){
  wetU.uEngr={value:engrave};
  return patch(new THREE.MeshStandardMaterial({color:new THREE.Color('#d8dbdf'),metalness:1,roughness:0.2,envMapIntensity:1.6}),{
    uniforms:wetU,
    vHead:'varying vec3 vRvL;attribute vec2 aB;varying vec2 vB;',vMain:'vRvL=transformed;vB=aB;',
    fHead:'varying vec3 vRvL;varying vec2 vB;uniform float uObjWet;uniform sampler2D uEngr;float rvGold=0.0;',
    fColor:`
      float brush=rvNoise(vec3(vRvL.x*260.0,vRvL.y*2.2,vRvL.z*260.0));
      diffuseColor.rgb*=mix(0.9,1.03,brush);
      // gravure : « DURA LEX, SED LEX » le long de la gouttière, face avant
      vec2 eu=vec2((vRvL.y-0.95)/1.95,0.5-vB.x/0.34);
      if(vRvL.z>0.0&&eu.x>0.0&&eu.x<1.0&&eu.y>0.0&&eu.y<1.0) rvGold=texture2D(uEngr,eu).r;
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.86,0.64,0.30),rvGold);
      diffuseColor.rgb*=1.0-uObjWet*0.05;`,
    fRough:`
      float edge=smoothstep(0.62,0.9,abs(vB.x));
      roughnessFactor=0.09+0.1*rvNoise(vec3(vRvL.x*180.0,vRvL.y*3.0,vRvL.z*180.0))+0.1*smoothstep(0.6,0.85,rvFbm3(vRvL*vec3(9.0,1.5,9.0)));
      roughnessFactor=mix(roughnessFactor,0.06,edge*0.8);
      roughnessFactor=mix(roughnessFactor,0.3,rvGold);
      roughnessFactor=mix(roughnessFactor,0.05,uObjWet*0.6);`,
  },'steel');
}

/* Cuir sombre de la fusée */
function matLeather(wetU,dis,col){
  return patch(new THREE.MeshStandardMaterial({color:new THREE.Color(col||'#3a2418'),metalness:0,roughness:0.62,envMapIntensity:0.9}),{
    uniforms:wetU,
    vHead:'varying vec3 vRvL;',vMain:'vRvL=transformed;',
    fHead:'varying vec3 vRvL;uniform float uObjWet;',
    fColor:`diffuseColor.rgb*=mix(0.75,1.15,rvFbm3(vRvL*30.0));diffuseColor.rgb*=1.0-uObjWet*0.25;`,
    fRough:`roughnessFactor=mix(0.5+0.2*rvNoise(vRvL*80.0),0.2,uObjWet);`,
    fNormal:`normal=rvPerturb(-vViewPosition,normal,rvFbm3(vRvL*90.0)*0.002+rvNoise(vRvL*240.0)*0.0006,1.0);`,
    dissolve:!!dis,
  },'leather');
}

/* Noyer verni (marteau, socle) */
function matWood(wetU,dis){
  return patch(new THREE.MeshPhysicalMaterial({color:new THREE.Color('#4a2817'),roughness:0.42,clearcoat:0.7,clearcoatRoughness:0.12,envMapIntensity:1.0}),{
    uniforms:wetU,
    vHead:'varying vec3 vRvL;',vMain:'vRvL=transformed;',
    fHead:'varying vec3 vRvL;uniform float uObjWet;',
    fColor:`
      vec3 q=vRvL;
      float warp=rvFbm3(q*vec3(3.0,0.5,3.0))*6.0;
      float grain=sin(q.x*34.0+q.z*11.0+warp);
      float fine=rvNoise(vec3(q.x*90.0,q.y*4.0,q.z*90.0));
      diffuseColor.rgb*=mix(0.62,1.12,smoothstep(-0.6,0.9,grain))*mix(0.88,1.06,fine);
      diffuseColor.rgb*=1.0-uObjWet*0.2;`,
    fRough:`roughnessFactor=mix(0.36+0.1*rvNoise(vRvL*40.0),0.12,uObjWet);`,
    dissolve:!!dis,
  },'wood');
}

/* Pierre de grès (segments du portail) */
function matStone(){
  return patch(new THREE.MeshStandardMaterial({color:new THREE.Color('#c9ab86'),roughness:0.9,metalness:0,envMapIntensity:0.9}),{
    vHead:'varying vec3 vRvL;',vMain:'vRvL=transformed;',
    fHead:'varying vec3 vRvL;',
    fColor:`
      float n1=rvFbm(vRvL*0.9);
      vec3 base=diffuseColor.rgb*mix(0.78,1.08,n1);
      base*=1.0-smoothstep(0.66,0.84,rvFbm3(vRvL*1.8))*0.22;
      base*=1.0-smoothstep(0.78,0.9,rvNoise(vRvL*14.0))*0.25;
      float topSand=smoothstep(0.5,0.95,vRvN.y)*smoothstep(0.3,0.7,rvFbm3(vRvL*1.5));
      base=mix(base,vec3(0.86,0.66,0.44),topSand*0.6);
      diffuseColor.rgb=base*mix(0.95,1.05,rvNoise(vRvL*5.0));`,
    fRough:`roughnessFactor=0.84+0.14*rvNoise(vRvL*5.0);`,
    fNormal:`
      float hb=rvFbm(vRvL*1.4)*0.12+rvFbm3(vRvL*4.6)*0.04+rvNoise(vRvL*17.0)*0.01-smoothstep(0.66,0.84,rvFbm3(vRvL*1.8))*0.07;
      normal=rvPerturb(-vViewPosition,normal,hb,1.0);`,
  },'pstone');
}

/* Papier (contrat) — texture de texte, dissolvable */
function matPaper(wetU,map){
  return patch(new THREE.MeshStandardMaterial({color:new THREE.Color('#efe6d4'),map,roughness:0.8,metalness:0}),{
    uniforms:wetU,vHead:'varying vec3 vRvL;',vMain:'vRvL=transformed;',fHead:'varying vec3 vRvL;',
    fColor:`diffuseColor.rgb*=mix(0.92,1.03,rvFbm3(vRvL*12.0));`,dissolve:true,
  },'paper');
}
/* Cire à cacheter, rouge profond */
function matWax(wetU){
  return patch(new THREE.MeshPhysicalMaterial({color:new THREE.Color('#7e1612'),roughness:0.28,clearcoat:0.8,clearcoatRoughness:0.2}),{
    uniforms:wetU,vHead:'varying vec3 vRvL;',vMain:'vRvL=transformed;',fHead:'varying vec3 vRvL;',
    fColor:`diffuseColor.rgb*=mix(0.8,1.1,rvFbm3(vRvL*20.0));`,dissolve:true,
  },'wax');
}
/* Verre teinté (bougies du graphique) */
function matGlass(wetU,col,att){
  return patch(new THREE.MeshPhysicalMaterial({color:new THREE.Color(col),roughness:0.05,transmission:1,thickness:0.18,ior:1.5,attenuationColor:new THREE.Color(att),attenuationDistance:0.55,specularIntensity:1,envMapIntensity:1.5}),{
    uniforms:wetU,vHead:'varying vec3 vRvL;',vMain:'vRvL=transformed;',fHead:'varying vec3 vRvL;',dissolve:true,
  },'glass');
}
/* Pierre sombre polie (socle du graphique) */
function matSlate(wetU){
  return patch(new THREE.MeshPhysicalMaterial({color:new THREE.Color('#2a2422'),roughness:0.35,clearcoat:0.6,clearcoatRoughness:0.2}),{
    uniforms:wetU,vHead:'varying vec3 vRvL;',vMain:'vRvL=transformed;',fHead:'varying vec3 vRvL;',
    fColor:`diffuseColor.rgb*=mix(0.75,1.2,rvFbm3(vRvL*6.0));`,dissolve:true,
  },'slate');
}

/* Maillage de scan (survol façon igloo) : arêtes + sommets d'une version basse définition */
function makeScanU(){return {uHoverL:{value:new THREE.Vector3(0,-9999,0)},uScanR:{value:0},uScanA:{value:0},uTime:U.uTime};}
function scanMaterial(scanU,pts){
  return new THREE.ShaderMaterial({uniforms:scanU,transparent:true,depthTest:false,depthWrite:false,blending:THREE.AdditiveBlending,
    vertexShader:`uniform vec3 uHoverL;uniform float uScanR;uniform float uScanA;uniform float uTime;varying float vA;
      void main(){vec4 w=modelMatrix*vec4(position,1.0);
        float d=length(w.xyz-uHoverL);
        float h=fract(sin(dot(position,vec3(12.9898,78.233,37.719)))*43758.5453);
        float edge=smoothstep(uScanR,uScanR-0.35,d+h*0.25);
        float ring=smoothstep(0.25,0.0,abs(d-uScanR+0.1))*0.8;
        vA=(edge*${pts?'0.55':'0.2'}+ring*${pts?'0.6':'0.35'})*uScanA*(0.65+0.35*step(0.5,fract(h*7.0+uTime*1.3)));
        gl_Position=projectionMatrix*viewMatrix*w;${pts?'gl_PointSize=1.7*'+DPR.toFixed(2)+';':''}}`,
    fragmentShader:`varying float vA;void main(){${pts?'vec2 c=gl_PointCoord-0.5;if(dot(c,c)>0.25)discard;':''}gl_FragColor=vec4(vec3(1.0,0.97,0.94)*vA,vA);}`});
}
function addScan(list,parent,scanU){
  if(!list.length) return;
  const m=mergeGeometries(list.map(g=>{const n=g.index?g.toNonIndexed():g;const o=new THREE.BufferGeometry();o.setAttribute('position',n.attributes.position);return o;}),false);
  const w=new THREE.LineSegments(new THREE.WireframeGeometry(m),scanMaterial(scanU,false));w.renderOrder=20;w.frustumCulled=false;parent.add(w);
  const p=new THREE.Points(m,scanMaterial(scanU,true));p.renderOrder=21;p.frustumCulled=false;parent.add(p);
}

/* Points critiques : échantillon des sommets de l'objet (repère de son parent) */
function sampleKP(group,maxN=900){
  group.updateMatrixWorld(true);
  const inv=new THREE.Matrix4().copy(group.matrixWorld).invert();
  const all=[];const v=new THREE.Vector3();
  group.traverse(o=>{
    if(!o.isMesh||o.isInstancedMesh||!o.geometry||!o.geometry.attributes.position) return;
    if(o.material&&o.material.isShaderMaterial) return;
    const pa=o.geometry.attributes.position;
    const m=new THREE.Matrix4().multiplyMatrices(inv,o.matrixWorld);
    for(let i=0;i<pa.count;i++){v.fromBufferAttribute(pa,i).applyMatrix4(m);all.push([v.x,v.y,v.z]);}
  });
  if(all.length<=maxN) return all;
  // on garde les extrêmes (enveloppe) + un échantillon régulier
  const out=[];const step=all.length/maxN;
  for(let i=0;i<maxN;i++) out.push(all[Math.floor(i*step)]);
  for(let a=0;a<3;a++){let lo=all[0],hi=all[0];all.forEach(p=>{if(p[a]<lo[a])lo=p;if(p[a]>hi[a])hi=p;});out.push(lo,hi);}
  return out;
}

/* Gravure : texte blanc sur noir dans une texture (lue comme masque) */
function textMask(txt,w=2048,h=128,font='700 84px "JetBrains Mono", ui-monospace, monospace',spacing=0.18){
  const cv=document.createElement('canvas');cv.width=w;cv.height=h;const c=cv.getContext('2d');
  c.fillStyle='#000';c.fillRect(0,0,w,h);c.fillStyle='#fff';c.font=font;c.textBaseline='middle';c.textAlign='center';
  if('letterSpacing' in c) c.letterSpacing=Math.round(h*spacing)+'px';
  c.fillText(txt,w/2,h/2+2);
  const t=new THREE.CanvasTexture(cv);t.anisotropy=4;return t;
}

/* ═══ 11 · Droit civil : balance de justice (laiton patiné, socle de marbre noir) ═══
   Géométrie procédurale fine : socle mouluré, colonne cannelée, fléau galbé,
   chaînes maillon par maillon, plateaux tournés. Hauteur ≈ 4 unités, base en y=0. */
function latheProfile(pts,seg){return new THREE.LatheGeometry(pts.map(p=>new THREE.Vector2(p[0],p[1])),seg);}
function ogee(out,r0,y0,r1,y1,n){for(let i=1;i<=n;i++){const t=i/n;const s=t<.5?2*t*t:1-2*(1-t)*(1-t);out.push([r0+(r1-r0)*s,y0+(y1-y0)*t]);}}

const BAL = {pivotY:3.42, half:1.34, droop:0.05, rimDrop:1.81, panR:0.47, attachR:0.43};

function balanceParts(lo){
  /* lo=true : version basse définition pour le maillage de scan */
  const S=lo?1:0, seg=lo?14:96, segS=lo?10:48;
  const P={static:[],beam:[],hang:[],marble:[]};
  // — socle en marbre —
  const pl=[[0,0],[0.80,0],[0.815,0.008],[0.82,0.03],[0.82,0.085],[0.808,0.095],[0.79,0.10]];
  ogee(pl,0.79,0.10,0.66,0.22,lo?3:14);
  pl.push([0.655,0.226],[0.655,0.255],[0.64,0.262],[0.60,0.27],[0.585,0.28],[0.585,0.33],[0.57,0.34]);
  ogee(pl,0.57,0.34,0.47,0.392,lo?2:10);
  pl.push([0.46,0.40],[0,0.40]);
  P.marble.push(latheProfile(lo?pl.filter((p,i)=>i%2===0||p[0]===0):pl,seg));
  // — pied tourné en laiton —
  const ft=[[0,0.40],[0.40,0.40],[0.408,0.41],[0.404,0.424],[0.37,0.432],[0.345,0.44]];
  for(let i=1;i<=(lo?3:16);i++){const t=i/(lo?3:16);ft.push([0.13+0.215*Math.pow(1-t,2.2),0.44+0.18*t]);}
  ft.push([0.152,0.625],[0.158,0.64],[0.152,0.655],[0.11,0.662],[0,0.662]);
  P.static.push(latheProfile(ft,seg));
  // — colonne cannelée (16 cannelures) —
  const colH=3.20-0.662;
  const col=new THREE.CylinderGeometry(0.066,0.085,colH,lo?10:96,lo?6:24,true);
  if(!lo){const pa=col.attributes.position;for(let i=0;i<pa.count;i++){const x=pa.getX(i),z=pa.getZ(i);const a=Math.atan2(z,x);const f=1-0.075*Math.pow(Math.max(0,Math.cos(a*16)),1.6);pa.setX(i,x*f);pa.setZ(i,z*f);}col.computeVertexNormals();}
  col.translate(0,0.662+colH/2,0);P.static.push(col);
  // — nœud décoratif à mi-hauteur —
  const kn=[[0,1.84]];for(let i=0;i<=(lo?4:20);i++){const t=i/(lo?4:20);kn.push([0.075+0.06*Math.sin(Math.PI*t)+0.012*Math.sin(Math.PI*3*t),1.84+0.22*t]);}kn.push([0,2.06]);
  P.static.push(latheProfile(kn,seg));
  // — bagues —
  if(!lo){[[0.70,0.094,0.016],[1.83,0.082,0.012],[2.07,0.082,0.012],[3.165,0.075,0.014]].forEach(([y,r,t])=>{const g=new THREE.TorusGeometry(r,t,10,64);g.rotateX(Math.PI/2);g.translate(0,y,0);P.static.push(g);});}
  // — chapiteau —
  const cp=[[0,3.20],[0.075,3.20],[0.092,3.212],[0.086,3.226]];
  for(let i=1;i<=(lo?3:12);i++){const t=i/(lo?3:12);cp.push([0.086+0.07*Math.pow(t,1.6),3.226+0.074*t]);}
  cp.push([0.158,3.31],[0.152,3.325],[0.13,3.332],[0,3.332]);
  P.static.push(latheProfile(cp,seg));
  // — chape (joues) + axe —
  [-1,1].forEach(sd=>{const g=new RoundedBoxGeometry(0.17,0.24,0.022,lo?1:3,0.009);g.translate(0,3.43,sd*0.058);P.static.push(g);});
  if(!lo){const pin=new THREE.CylinderGeometry(0.017,0.017,0.16,20);pin.rotateX(Math.PI/2);pin.translate(0,BAL.pivotY,0);P.static.push(pin);}
  // — arc indicateur + montants —
  if(!lo){const arc=new THREE.TorusGeometry(0.52,0.0065,8,48,0.56);arc.rotateZ(Math.PI/2-0.28);arc.translate(0,BAL.pivotY,-0.03);P.static.push(arc);
    [-1,1].forEach(sd=>{const a=new THREE.Vector3(sd*0.06,3.53,-0.03),b=new THREE.Vector3(sd*0.52*Math.sin(0.28),BAL.pivotY+0.52*Math.cos(0.28),-0.03);
      const L=a.distanceTo(b);const g=new THREE.CylinderGeometry(0.0055,0.0065,L,8);g.translate(0,L/2,0);
      const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());g.applyQuaternion(q);g.translate(a.x,a.y,a.z);P.static.push(g);});}
  // — fléau : balayage galbé, section ovale, perles décoratives (repère : pivot à l'origine) —
  {const NS=lo?14:150,NR=lo?6:24,pos=[],idx=[];
    for(let i=0;i<=NS;i++){const u=i/NS,x=(u*2-1)*BAL.half,ax=Math.abs(x)/BAL.half;
      let r=0.021+0.031*Math.pow(1-ax,1.5);
      r+=0.011*Math.exp(-Math.pow((ax-0.36)/0.03,2))+0.009*Math.exp(-Math.pow((ax-0.74)/0.028,2));
      const y=-BAL.droop*ax*ax;
      for(let j=0;j<=NR;j++){const a=j/NR*Math.PI*2;pos.push(x,y+Math.sin(a)*r*1.22,Math.cos(a)*r*0.86);}}
    for(let i=0;i<NS;i++)for(let j=0;j<NR;j++){const a=i*(NR+1)+j,b=a+NR+1;idx.push(a,b,a+1,b,b+1,a+1);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();P.beam.push(g);}
  {const g=new THREE.SphereGeometry(0.072,lo?8:40,lo?6:24);g.scale(1,1,0.72);P.beam.push(g);}
  [-1,1].forEach(sd=>{const g=new THREE.SphereGeometry(0.032,lo?6:24,lo?4:16);g.translate(sd*(BAL.half+0.018),-BAL.droop,0);P.beam.push(g);
    if(!lo){const t=new THREE.ConeGeometry(0.014,0.05,16);t.rotateZ(-sd*Math.PI/2);t.translate(sd*(BAL.half+0.07),-BAL.droop,0);P.beam.push(t);}});
  {const g=new THREE.ConeGeometry(0.0125,0.52,lo?5:16,1);g.translate(0,0.07+0.26,0);P.beam.push(g);}
  // — suspension : anneaux, plateau (repère : extrémité du fléau à l'origine) —
  if(!lo){const a=new THREE.TorusGeometry(0.028,0.0065,10,24);a.rotateY(Math.PI/2);a.translate(0,-0.045,0);P.hang.push(a);
    const b=new THREE.TorusGeometry(0.028,0.0065,10,24);b.translate(0,-0.098,0);P.hang.push(b);
    const c=new THREE.TorusGeometry(0.032,0.0075,10,28);c.rotateX(Math.PI/2);c.translate(0,-0.15,0);P.hang.push(c);}
  const pan=[[0,-0.14],[0.12,-0.137],[0.24,-0.125],[0.33,-0.10],[0.40,-0.068],[0.445,-0.035],[0.468,-0.01],[0.478,0.0],[0.485,0.006],[0.488,0.014],[0.482,0.02],[0.47,0.018],[0.458,0.005],[0.44,-0.022],[0.39,-0.058],[0.32,-0.088],[0.23,-0.11],[0.12,-0.121],[0,-0.124]];
  {const g=latheProfile(lo?pan.filter((p,i)=>i%2===0||i===pan.length-1):pan,seg);g.translate(0,-BAL.rimDrop,0);P.hang.push(g);}
  if(!lo){for(let k=0;k<3;k++){const th=Math.PI/6+k*Math.PI*2/3;const g=new THREE.TorusGeometry(0.017,0.0048,8,16);g.rotateY(-th+Math.PI/2);g.translate(Math.cos(th)*BAL.panR,-BAL.rimDrop+0.034,Math.sin(th)*BAL.panR);P.hang.push(g);}}
  return P;
}

function buildBalance(){
  const grp=new THREE.Group();
  const wetU={uObjWet:{value:0}};
  const brass=matBrass(wetU),marble=matMarbleBlack();
  const P=balanceParts(false);
  const staticG=new THREE.Group(),beamG=new THREE.Group();
  beamG.position.set(0,BAL.pivotY,0);
  grp.add(staticG,beamG);
  const add=(g,list,mat)=>list.forEach(geo=>{const m=new THREE.Mesh(geo,mat);g.add(m);});
  add(staticG,P.static,brass);add(staticG,P.marble,marble);add(beamG,P.beam,brass);
  const hangs=[-1,1].map(sd=>{
    const h=new THREE.Group();grp.add(h);
    add(h,P.hang,brass);
    // chaînes : trois brins de maillons alternés
    const linkG=new THREE.TorusGeometry(0.019,0.0048,6,14);linkG.scale(1,1.5,1);
    const pitch=0.046,mats=[];
    for(let k=0;k<3;k++){
      const th=Math.PI/6+k*Math.PI*2/3;
      const A=new THREE.Vector3(Math.cos(th)*0.03,-0.15,Math.sin(th)*0.03);
      const B=new THREE.Vector3(Math.cos(th)*BAL.panR,-BAL.rimDrop+0.034,Math.sin(th)*BAL.panR);
      const d=B.clone().sub(A),L=d.length();d.normalize();
      const n=Math.max(2,Math.round(L/pitch));
      const q0=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d);
      for(let i=0;i<n;i++){
        const p=A.clone().addScaledVector(d,(i+0.5)/n*L);
        const q=q0.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),(i%2)*Math.PI/2+th));
        mats.push(new THREE.Matrix4().compose(p,q,new THREE.Vector3(1,1,1)));
      }
    }
    const im=new THREE.InstancedMesh(linkG,brass,mats.length);mats.forEach((m,i)=>im.setMatrixAt(i,m));h.add(im);
    return {g:h,sd};
  });
  const scanU=makeScanU();
  const lo=balanceParts(true);
  addScan([...lo.static,...lo.marble],staticG,scanU);addScan(lo.beam,beamG,scanU);
  hangs.forEach(h=>addScan(lo.hang,h.g,scanU));

  const anchors={tl:new THREE.Vector3(),tr:new THREE.Vector3(0,3.99,0),br:new THREE.Vector3(0.6,0.25,0.3)};
  const drips=[new THREE.Vector3(),new THREE.Vector3()];
  let ang=0;
  function update(dt,T,freedom){
    // une fois libérée, la balance oscille doucement, sans fin
    ang=freedom*(Math.sin(T*0.83)*0.055+Math.sin(T*0.31+1.2)*0.03);
    beamG.rotation.z=ang;
    hangs.forEach(h=>{
      const x=h.sd*BAL.half,y=-BAL.droop;
      const c=Math.cos(ang),s=Math.sin(ang);
      h.g.position.set(x*c-y*s,BAL.pivotY+x*s+y*c,0);
      h.g.rotation.z=-ang*0.6*freedom+Math.sin(T*1.7+h.sd)*0.012*freedom;
      h.g.rotation.x=Math.sin(T*1.3+h.sd*2.0)*0.01*freedom;
    });
    anchors.tl.set(hangs[0].g.position.x,hangs[0].g.position.y,0);
    drips[0].set(hangs[0].g.position.x,hangs[0].g.position.y-BAL.rimDrop-0.14,0);
    drips[1].set(hangs[1].g.position.x,hangs[1].g.position.y-BAL.rimDrop-0.14,0);
  }
  update(0,0,0);
  return {group:grp,update,scanU,wetU,
    anchorW:(k,v)=>grp.localToWorld(v.copy(anchors[k])),
    dripW:(v)=>grp.localToWorld(v.copy(drips[rand()<0.5?0:1]).add(new THREE.Vector3((rand()-0.5)*0.3,0,(rand()-0.5)*0.3)))};
}

/* ═══ 13 · Droit pénal : le glaive de justice ═══
   Épée d'armes à lame droite, pointe en bas : lame en acier à section losangée et
   gouttière (gravure dorée « DURA LEX, SED LEX »), garde et pommeau à roue en laiton,
   fusée gainée de cuir et filée. Hauteur ≈ 4,07 unités. Libéré : il tourne lentement. */
const GLV={L:3.1,guardY:3.12};

function glaiveParts(lo){
  const P={steel:[],brass:[],leather:[]};
  /* — lame — */
  {
    const L=GLV.L,NS=lo?12:190;
    const XS=lo?[1,0.4,0,-0.4]:[1,0.72,0.45,0.30,0.20,0.08,0,-0.08,-0.20,-0.30,-0.45,-0.72];
    const W=y=>y<0.5?0.1*Math.pow(Math.max(y,0)/0.5,0.62):0.1+0.026*((y-0.5)/(L-0.5));
    const Tk=y=>(0.012+0.015*(y/L))*Math.min(1,Math.pow(Math.max(y,0.0001)/0.45,0.5));
    const Fu=y=>smooth(0.75,1.15,y)*(1-smooth(2.8,2.95,y));
    const ring=(w,t,f)=>{
      const zf=lo?[0,0.9,1-0.6*f,0.9]:[0,0.55,0.88,1.0,1-0.55*f,1-0.66*f,1-0.7*f,1-0.66*f,1-0.55*f,1.0,0.88,0.55];
      const pts=[];
      for(let i=0;i<XS.length;i++) pts.push([XS[i]*w,zf[i]*t,XS[i]]);
      pts.push([-w,0,-1]);
      for(let i=XS.length-1;i>=1;i--) pts.push([XS[i]*w,-zf[i]*t,XS[i]]);
      return pts;
    };
    const pos=[],ab=[],idx=[];let RN=0;
    for(let i=0;i<=NS;i++){
      const y=L*Math.pow(i/NS,1.15);
      const r=ring(W(y),Tk(y),Fu(y));RN=r.length;
      r.forEach(p=>{pos.push(p[0],y,p[1]);ab.push(p[2],y/L);});
    }
    for(let i=0;i<NS;i++)for(let j=0;j<RN;j++){const a=i*RN+j,b=i*RN+(j+1)%RN,c=a+RN,d=b+RN;idx.push(a,c,b,b,c,d);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('aB',new THREE.Float32BufferAttribute(ab,2));
    g.setIndex(idx);g.computeVertexNormals();P.steel.push(g);
  }
  /* — garde : barre légèrement arquée, section carrée adoucie, quillons terminés en boutons — */
  {
    const NS=lo?10:120,NR=lo?4:20,pos=[],idx=[],H=0.6;
    for(let i=0;i<=NS;i++){const u=i/NS,x=(u*2-1)*H,ax=Math.abs(x)/H;
      const y=GLV.guardY-0.05*ax*ax;const s=1-0.22*ax;
      for(let j=0;j<=NR;j++){const a=j/NR*Math.PI*2;const c=Math.cos(a),sn=Math.sin(a);
        const k=Math.pow(Math.abs(c),0.6)*Math.sign(c),l=Math.pow(Math.abs(sn),0.6)*Math.sign(sn);
        pos.push(x,y+l*0.033*s,k*0.042*s);}}
    for(let i=0;i<NS;i++)for(let j=0;j<NR;j++){const a=i*(NR+1)+j,b=a+NR+1;idx.push(a,b,a+1,b,b+1,a+1);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();P.brass.push(g);
    [-1,1].forEach(sd=>{const b=new THREE.SphereGeometry(0.045,lo?6:24,lo?4:16);b.scale(1,0.9,0.95);b.translate(sd*(H+0.02),GLV.guardY-0.05,0);P.brass.push(b);});
    const e=new RoundedBoxGeometry(0.15,0.14,0.105,lo?1:3,0.025);e.translate(0,GLV.guardY,0);P.brass.push(e);
  }
  /* — fusée : cuir filé en spirale + viroles — */
  {
    const y0=GLV.guardY+0.07,y1=y0+0.6;
    const c=new THREE.CylinderGeometry(0.052,0.059,y1-y0,lo?8:64,lo?3:90,true);
    if(!lo){const pa=c.attributes.position;for(let i=0;i<pa.count;i++){const x=pa.getX(i),y=pa.getY(i),z=pa.getZ(i);const a=Math.atan2(z,x);
      const rib=Math.pow(Math.max(0,Math.cos(a+y*2*Math.PI*11)),6)*0.006;const f=1+rib/0.055;pa.setX(i,x*f);pa.setZ(i,z*f);}c.computeVertexNormals();}
    c.translate(0,(y0+y1)/2,0);P.leather.push(c);
    if(!lo){[y0,y1].forEach(y=>{const t=new THREE.TorusGeometry(0.061,0.011,10,40);t.rotateX(Math.PI/2);t.translate(0,y,0);P.brass.push(t);});}
    /* — pommeau à roue — */
    const pm=[[0,-0.05],[0.09,-0.05],[0.118,-0.04],[0.132,-0.018],[0.136,0],[0.132,0.018],[0.118,0.04],[0.09,0.05],[0,0.05]];
    const w=latheProfile(pm,lo?10:72);w.rotateX(Math.PI/2);w.translate(0,y1+0.13,0);P.brass.push(w);
    if(!lo){[-1,1].forEach(sd=>{const b=new THREE.SphereGeometry(0.05,24,12,0,Math.PI*2,0,Math.PI/2);b.scale(1,0.4,1);b.rotateX(sd*Math.PI/2);b.translate(0,y1+0.13,sd*0.048);P.brass.push(b);});
      const pe=new THREE.CylinderGeometry(0.022,0.028,0.05,16);pe.translate(0,y1+0.285,0);P.brass.push(pe);}
  }
  return P;
}

function buildGlaive(){
  const grp=new THREE.Group();
  const wetU={uObjWet:{value:0}};
  const engr=textMask('DURA LEX, SED LEX',2048,128,'700 78px "JetBrains Mono", ui-monospace, monospace',0.1);
  const steel=matSteel(wetU,engr),brass=matBrass(wetU),leather=matLeather(wetU);
  const inner=new THREE.Group();inner.scale.setScalar(1.12);grp.add(inner);
  const P=glaiveParts(false);
  P.steel.forEach(g=>inner.add(new THREE.Mesh(g,steel)));
  P.brass.forEach(g=>inner.add(new THREE.Mesh(g,brass)));
  P.leather.forEach(g=>inner.add(new THREE.Mesh(g,leather)));
  const scanU=makeScanU();
  const lo=glaiveParts(true);addScan([...lo.steel,...lo.brass,...lo.leather],inner,scanU);
  const anchors={tl:new THREE.Vector3(-0.6,3.08,0),tr:new THREE.Vector3(0,4.05,0),br:new THREE.Vector3(0.1,1.15,0)};
  const drips=[new THREE.Vector3(0,0.02,0),new THREE.Vector3(0.62,3.05,0),new THREE.Vector3(-0.62,3.05,0)];
  let spin=0;
  function update(dt,T,freedom){
    // libéré : rotation lente, légère lévitation
    spin+=dt*0.45*freedom;
    inner.rotation.y=spin;
    inner.position.y=Math.sin(T*0.7)*0.06*freedom;inner.rotation.z=Math.sin(T*0.4)*0.05*freedom;
  }
  return {group:grp,inner,update,scanU,wetU,
    anchorW:(k,v)=>inner.localToWorld(v.copy(anchors[k])),
    dripW:(v)=>inner.localToWorld(v.copy(drips[Math.floor(rand()*drips.length)]))};
}

/* ═══ 14 · Droit administratif : le temple à fronton ═══
   Maquette de temple classique en marbre blanc : crépis à trois degrés, colonnes
   cannelées à chapiteau dorique, cella et sa porte, entablement portant la devise
   « LIBERTÉ · ÉGALITÉ · FRATERNITÉ », fronton à médaillon, acrotères.
   Libéré : la porte s'éclaire, le temple pivote doucement. */
function frontonParts(lo){
  const P={marble:[],door:[]};
  const box=(w,h,d,x,y,z)=>{const g=lo?new THREE.BoxGeometry(w,h,d):new RoundedBoxGeometry(w,h,d,2,Math.min(0.012,h*0.3,w*0.3,d*0.3));g.translate(x,y,z);return g;};
  // crépis
  [[3.60,1.90,0.05],[3.44,1.74,0.15],[3.28,1.58,0.25]].forEach(([w,d,y])=>P.marble.push(box(w,0.1,d,0,y,0)));
  // colonnes
  const colPos=[];[-1.35,-0.81,-0.27,0.27,0.81,1.35].forEach(x=>colPos.push([x,0.56]));
  [[-1.35,0.0],[-1.35,-0.56],[1.35,0.0],[1.35,-0.56]].forEach(p=>colPos.push(p));
  const shaftH=1.68,y0=0.40;
  const shaft=new THREE.CylinderGeometry(0.098,0.118,shaftH,lo?8:80,lo?1:6,true);
  if(!lo){const pa=shaft.attributes.position;for(let i=0;i<pa.count;i++){const x=pa.getX(i),z=pa.getZ(i);const a=Math.atan2(z,x);const f=1-0.06*Math.pow(Math.max(0,Math.cos(a*20)),1.4);pa.setX(i,x*f);pa.setZ(i,z*f);}shaft.computeVertexNormals();}
  shaft.translate(0,y0+shaftH/2,0);
  const parts=[shaft];
  parts.push(box(0.29,0.05,0.29,0,0.325,0));
  if(!lo){const t=new THREE.TorusGeometry(0.122,0.024,10,48);t.rotateX(Math.PI/2);t.translate(0,0.376,0);parts.push(t);}
  const ech=[[0,2.08],[0.098,2.08],[0.104,2.09],[0.12,2.115],[0.142,2.135],[0.152,2.15],[0,2.15]];
  parts.push(latheProfile(ech,lo?8:48));
  parts.push(box(0.33,0.05,0.33,0,2.175,0));
  colPos.forEach(([x,z])=>parts.forEach(g=>{const c=g.clone();c.translate(x,0,z);P.marble.push(c);}));
  // cella + encadrement de porte
  P.marble.push(box(2.3,1.8,0.95,0,1.2,-0.275));
  if(!lo){P.marble.push(box(0.1,1.12,0.05,-0.33,0.86,0.215),box(0.1,1.12,0.05,0.33,0.86,0.215),box(0.76,0.1,0.05,0,1.47,0.215));}
  P.door.push(box(0.56,1.06,0.03,0,0.83,0.2));
  // entablement
  P.marble.push(box(3.12,0.16,1.5,0,2.28,0),box(3.12,0.2,1.46,0,2.46,0),box(3.34,0.07,1.62,0,2.595,0),box(3.42,0.035,1.68,0,2.6475,0));
  // fronton
  {const sh=new THREE.Shape();sh.moveTo(-1.62,0);sh.lineTo(1.62,0);sh.lineTo(0,0.6);sh.lineTo(-1.62,0);
    const g=new THREE.ExtrudeGeometry(sh,{depth:1.44,bevelEnabled:false});g.translate(0,2.665,-0.75);P.marble.push(g);}
  const th=Math.atan2(0.64,1.70);
  [-1,1].forEach(sd=>{const g=lo?new THREE.BoxGeometry(1.86,0.055,1.64):new RoundedBoxGeometry(1.86,0.055,1.64,2,0.012);g.rotateZ(-sd*th);g.translate(sd*0.86,2.665+0.33+0.02,0);P.marble.push(g);});
  if(!lo){
    const md=new THREE.CylinderGeometry(0.15,0.15,0.035,40);md.rotateX(Math.PI/2);md.translate(0,2.86,0.70);P.marble.push(md);
    const lr=new THREE.TorusGeometry(0.185,0.016,10,48);lr.translate(0,2.86,0.70);P.marble.push(lr);
    P.marble.push(box(0.11,0.15,0.09,0,3.36,0.7),box(0.1,0.11,0.08,-1.66,2.73,0.7),box(0.1,0.11,0.08,1.66,2.73,0.7));
  }
  return P;
}

function buildFronton(){
  const grp=new THREE.Group();
  const wetU={uObjWet:{value:0}};
  const marble=matMarbleWhite(wetU);
  const doorM=new THREE.MeshStandardMaterial({color:new THREE.Color('#1a1210'),roughness:0.6,metalness:0,emissive:new THREE.Color('#ffc58a'),emissiveIntensity:0});
  const inner=new THREE.Group();grp.add(inner);
  const P=frontonParts(false);
  P.marble.forEach(g=>inner.add(new THREE.Mesh(g,marble)));
  P.door.forEach(g=>inner.add(new THREE.Mesh(g,doorM)));
  // devise gravée et dorée sur la frise
  const motto=textMask('LIBERTÉ · ÉGALITÉ · FRATERNITÉ',2048,128,'700 74px "JetBrains Mono", ui-monospace, monospace',0.12);
  const mm=new THREE.MeshStandardMaterial({color:new THREE.Color('#b08a4a'),metalness:0.85,roughness:0.32,alphaMap:motto,alphaTest:0.5});
  const mp=new THREE.Mesh(new THREE.PlaneGeometry(2.9,0.145),mm);mp.position.set(0,2.46,0.7315);inner.add(mp);
  const scanU=makeScanU();
  const lo=frontonParts(true);addScan([...lo.marble,...lo.door],inner,scanU);
  const anchors={tl:new THREE.Vector3(-1.62,2.72,0.7),tr:new THREE.Vector3(0,3.38,0.7),br:new THREE.Vector3(1.75,0.08,0.9)};
  const drips=[new THREE.Vector3(-1.7,2.55,0.8),new THREE.Vector3(1.7,2.55,0.8),new THREE.Vector3(1.78,0.0,0.92),new THREE.Vector3(-1.78,0.0,0.92)];
  function update(dt,T,freedom){
    inner.rotation.y=Math.sin(T*0.22)*0.55*freedom;
    doorM.emissiveIntensity=freedom*(1.1+0.15*Math.sin(T*2.1));
  }
  return {group:grp,inner,update,scanU,wetU,
    anchorW:(k,v)=>inner.localToWorld(v.copy(anchors[k])),
    dripW:(v)=>inner.localToWorld(v.copy(drips[Math.floor(rand()*drips.length)]))};
}

/* ═══ 15 · Anglais juridique : le marteau de juge (gavel) et son socle ═══
   Noyer verni tourné, bague centrale et virole en laiton, socle mouluré à disque
   de frappe. Saisi en pleine levée ; libéré, il frappe le socle à intervalles réguliers. */
const GAV={bx:-0.40,blockH:0.24,hand:1.75,rest:-0.45,scale:1.35};

function marteauParts(lo){
  const P={wood:[],brass:[],gavWood:[],gavBrass:[]};
  const seg=lo?12:72;
  // socle
  const sb=[[0,0],[0.70,0],[0.72,0.02],[0.72,0.09],[0.70,0.11]];ogee(sb,0.70,0.11,0.61,0.215,lo?2:10);sb.push([0.60,0.24],[0,0.24]);
  {const g=latheProfile(sb,seg);g.translate(GAV.bx,0,0);P.wood.push(g);}
  if(!lo){const d=new THREE.CylinderGeometry(0.34,0.34,0.014,64);d.translate(GAV.bx,0.247,0);P.brass.push(d);
    const r=new THREE.TorusGeometry(0.52,0.007,8,96);r.rotateX(Math.PI/2);r.translate(GAV.bx,0.241,0);P.brass.push(r);}
  // tête (axe vertical, centrée sur l'origine du repère du marteau)
  const half=[[0,0],[0.19,0],[0.215,0.006],[0.232,0.024],[0.237,0.05],[0.237,0.085],[0.225,0.097],[0.225,0.112],[0.242,0.128],[0.25,0.17],[0.25,0.33],[0.24,0.36],[0.232,0.375],[0.232,0.42],[0.236,0.5]];
  const full=half.concat(half.slice(0,-1).reverse().map(p=>[p[0],1-p[1]]));
  {const g=latheProfile(lo?full.filter((p,i)=>i%2===0||p[0]===0):full,seg);g.translate(0,-0.5,0);P.gavWood.push(g);}
  {const g=latheProfile([[0.236,0.42],[0.256,0.425],[0.262,0.44],[0.262,0.56],[0.256,0.575],[0.236,0.58]],seg);g.translate(0,-0.5,0);P.gavBrass.push(g);}
  // manche (le long de +x, partant du centre de la tête)
  const hp=[[0,0],[0.05,0],[0.052,0.25],[0.058,0.36],[0.062,0.40],[0.064,0.8],[0.07,1.3],[0.076,1.65],[0.082,1.72],[0.086,1.75],[0.078,1.78],[0.08,1.82],[0.09,1.92],[0.098,2.0],[0.094,2.08],[0.07,2.13],[0,2.15]];
  {const g=latheProfile(lo?hp.filter((p,i)=>i%2===0||p[0]===0):hp,lo?8:48);g.rotateZ(-Math.PI/2);P.gavWood.push(g);}
  if(!lo){const g=latheProfile([[0.058,0.26],[0.086,0.28],[0.09,0.31],[0.086,0.345],[0.058,0.36]],48);g.rotateZ(-Math.PI/2);P.gavBrass.push(g);}
  return P;
}

function buildMarteau(){
  const grp=new THREE.Group();
  const wetU={uObjWet:{value:0}};
  const wood=matWood(wetU),brass=matBrass(wetU);
  const inner=new THREE.Group();inner.scale.setScalar(GAV.scale);grp.add(inner);
  const pivot=new THREE.Group();pivot.position.set(GAV.bx+GAV.hand,GAV.blockH+0.005+0.5,0);inner.add(pivot);
  const gav=new THREE.Group();gav.position.set(-GAV.hand,0,0);pivot.add(gav);
  const P=marteauParts(false);
  P.wood.forEach(g=>inner.add(new THREE.Mesh(g,wood)));P.brass.forEach(g=>inner.add(new THREE.Mesh(g,brass)));
  P.gavWood.forEach(g=>gav.add(new THREE.Mesh(g,wood)));P.gavBrass.forEach(g=>gav.add(new THREE.Mesh(g,brass)));
  pivot.rotation.z=GAV.rest;
  const scanU=makeScanU();
  const lo=marteauParts(true);addScan([...lo.wood,...lo.brass],inner,scanU);addScan([...lo.gavWood,...lo.gavBrass],gav,scanU);
  const A={tl:[gav,new THREE.Vector3(0,0.5,0)],tr:[gav,new THREE.Vector3(2.12,0,0)],br:[inner,new THREE.Vector3(GAV.bx+0.6,0.12,0.4)]};
  const drips=[[gav,new THREE.Vector3(0,-0.5,0)],[inner,new THREE.Vector3(GAV.bx+0.65,0.0,0.2)],[inner,new THREE.Vector3(GAV.bx-0.65,0.0,-0.1)],[gav,new THREE.Vector3(1.9,-0.06,0)]];
  let cyc=0,impact=false;
  function strike(t){ // angle du coup selon la phase du cycle (s)
    if(t<0.6) return lerp(GAV.rest,GAV.rest-0.1,easeInOut(t/0.6));
    if(t<0.74){const u=(t-0.6)/0.14;return lerp(GAV.rest-0.1,0,u*u);}
    if(t<0.84) return -0.06*Math.sin((t-0.74)/0.1*Math.PI);
    if(t<1.3) return 0;
    if(t<2.5) return lerp(0,GAV.rest,easeInOut((t-1.3)/1.2));
    return GAV.rest;
  }
  function update(dt,T,freedom){
    impact=false;
    if(freedom>0.98){const prev=cyc;cyc=(cyc+dt)%4.2;if(prev<0.74&&cyc>=0.74)impact=true;}
    else cyc=2.6;
    pivot.rotation.z=lerp(GAV.rest,strike(cyc),freedom);
    return impact;
  }
  return {group:grp,inner,update,scanU,wetU,
    anchorW:(k,v)=>A[k][0].localToWorld(v.copy(A[k][1])),
    dripW:(v)=>{const d=drips[Math.floor(rand()*drips.length)];return d[0].localToWorld(v.copy(d[1]));},
    impact:()=>impact};
}

/* ═══ 15b · Les objets de la L1 pris dans l'ambre ═══
   Droit civil : le Code civil des Français (1804) · Histoire du droit : la couronne et le
   sceptre (regalia de la monarchie) · Anglais juridique : le Capitole des États-Unis.
   (Droit constitutionnel garde le temple à fronton, colonnade et devise de l'art. 2 C.)
   Même contrat que les objets de glace : {group, inner, update(dt,T,liberté), scanU, wetU,
   anchorW(k,v), dripW(v)} ; base en y = 0, échelle ≈ 3 unités. */

/* fusion sûre : tout en non indexé, attributs position / normal / uv seulement */
function rvMerge(list){
  return mergeGeometries(list.map(g=>{const n=g.index?g.toNonIndexed():g;const o=new THREE.BufferGeometry();
    o.setAttribute('position',n.attributes.position);o.setAttribute('normal',n.attributes.normal);
    o.setAttribute('uv',n.attributes.uv||new THREE.BufferAttribute(new Float32Array(n.attributes.position.count*2),2));return o;}),false);
}
/* Or jaune (couronne, sceptre, dorures) */
function matGold(wetU){
  return patch(new THREE.MeshStandardMaterial({color:new THREE.Color('#e2b252'),metalness:1,roughness:0.22,envMapIntensity:1.35}),{
    uniforms:wetU,vHead:'varying vec3 vRvL;',vMain:'vRvL=transformed;',fHead:'varying vec3 vRvL;uniform float uObjWet;',
    fColor:`diffuseColor.rgb*=mix(0.9,1.05,rvFbm3(vRvL*5.0));diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(0.78,0.62,0.4),smoothstep(0.62,0.9,rvFbm3(vRvL*14.0+2.0))*0.35);`,
    fRough:`roughnessFactor=clamp(0.14+0.16*rvFbm3(vRvL*9.0+1.0)+0.04*rvNoise(vRvL*60.0),0.06,0.5);roughnessFactor=mix(roughnessFactor,0.07,uObjWet*0.7);`,
  },'gold');
}
/* Velours (coussin, bonnet de la couronne) : reflet rasant (sheen) */
function matVelvet(wetU,col,key){
  return patch(new THREE.MeshPhysicalMaterial({color:new THREE.Color(col),roughness:0.92,metalness:0,sheen:1,sheenRoughness:0.42,sheenColor:new THREE.Color(col).lerp(new THREE.Color('#ffffff'),0.45),envMapIntensity:0.7}),{
    uniforms:wetU,vHead:'varying vec3 vRvL;',vMain:'vRvL=transformed;',fHead:'varying vec3 vRvL;uniform float uObjWet;',
    fColor:`diffuseColor.rgb*=mix(0.8,1.1,rvFbm3(vRvL*7.0))*(1.0-uObjWet*0.15);`,
    fNormal:`normal=rvPerturb(-vViewPosition,normal,rvNoise(vRvL*160.0)*0.0012,1.0);`,
  },key);
}
/* Pierres précieuses : facettes nettes, éclat vif (sans transmission : déjà dans l'ambre) */
function matGem(col,key){
  return patch(new THREE.MeshPhysicalMaterial({color:new THREE.Color(col),metalness:0.1,roughness:0.05,clearcoat:1,clearcoatRoughness:0.02,
    emissive:new THREE.Color(col),emissiveIntensity:0.18,envMapIntensity:2.0,flatShading:true,specularIntensity:1}),{},key);
}
function matPearl(){
  return patch(new THREE.MeshPhysicalMaterial({color:new THREE.Color('#f3eee4'),metalness:0,roughness:0.22,clearcoat:0.6,iridescence:0.7,iridescenceIOR:1.6,envMapIntensity:1.3}),{},'pearl');
}

/* ───── fleur de lys : réunion de 5 formes extrudées (pétale central, deux pétales recourbés,
   bandeau, pied à trois pointes) ; base en y = 0, hauteur 1, face vers +z ───── */
function fleurGeo(depth,bev){
  const mk=(cmds,mirror)=>{const s=new THREE.Shape();const X=p=>mirror?-p[0]:p[0];
    cmds.forEach(c=>{if(c[0]==='M')s.moveTo(X(c[1]),c[1][1]);else if(c[0]==='L')s.lineTo(X(c[1]),c[1][1]);else s.bezierCurveTo(X(c[1]),c[1][1],X(c[2]),c[2][1],X(c[3]),c[3][1]);});
    return s;};
  const central=[['M',[0,0.40]],['C',[0.15,0.48],[0.16,0.76],[0,1.0]],['C',[-0.16,0.76],[-0.15,0.48],[0,0.40]]];
  const side=[['M',[0.05,0.40]],['C',[0.07,0.62],[0.28,0.84],[0.43,0.74]],['C',[0.53,0.67],[0.50,0.50],[0.37,0.47]],['C',[0.45,0.55],[0.41,0.65],[0.33,0.64]],['C',[0.22,0.62],[0.17,0.50],[0.15,0.40]],['L',[0.05,0.40]]];
  const band=[['M',[-0.21,0.33]],['L',[0.21,0.33]],['L',[0.21,0.42]],['L',[-0.21,0.42]],['L',[-0.21,0.33]]];
  const low=[['M',[-0.07,0.34]],['C',[-0.2,0.31],[-0.31,0.22],[-0.27,0.07]],['C',[-0.21,0.15],[-0.11,0.2],[-0.04,0.17]],['L',[0,0.0]],['L',[0.04,0.17]],['C',[0.11,0.2],[0.21,0.15],[0.27,0.07]],['C',[0.31,0.22],[0.2,0.31],[0.07,0.34]],['L',[-0.07,0.34]]];
  const shapes=[mk(central),mk(side),mk(side,true),mk(band),mk(low)];
  const gs=shapes.map((s,i)=>{const g=new THREE.ExtrudeGeometry(s,{depth:depth*(i===3?1.25:1),bevelEnabled:bev>0,bevelThickness:bev,bevelSize:bev*0.8,bevelSegments:2,curveSegments:10});g.translate(0,0,-depth*(i===3?1.25:1)/2);return g;});
  return rvMerge(gs);
}

/* ═══════════════ DROIT CIVIL · le Code civil des Français (1804) ═══════════════
   Reliure de veau fauve, dos à nerfs, pièce de titre en maroquin rouge, filets dorés,
   tranche supérieure dorée, signet de soie. Debout sur un socle de marbre noir.
   Libéré : le plat s'ouvre sur la page de titre de l'édition originale. */
const CCV={H:2.3,W:1.62,T:0.6,c:0.05,s:0.035,yb:0.2};
function ccvCoverTex(){
  const W=740,H=1050,cv=document.createElement('canvas');cv.width=W;cv.height=H;const c=cv.getContext('2d');
  c.fillStyle='#000';c.fillRect(0,0,W,H);c.strokeStyle='#fff';c.fillStyle='#fff';
  // double filet d'encadrement + roulette intérieure
  c.lineWidth=7;c.strokeRect(34,34,W-68,H-68);c.lineWidth=2.5;c.strokeRect(50,50,W-100,H-100);
  c.setLineDash([3,7]);c.lineWidth=3;c.strokeRect(64,64,W-128,H-128);c.setLineDash([]);
  // fleurons d'angle
  const flr=(x,y,r)=>{c.save();c.translate(x,y);for(let k=0;k<4;k++){c.rotate(Math.PI/2);c.beginPath();c.ellipse(0,-r*0.55,r*0.22,r*0.55,0,0,6.283);c.fill();}c.beginPath();c.arc(0,0,r*0.2,0,6.283);c.fill();c.restore();};
  [[96,96],[W-96,96],[96,H-96],[W-96,H-96]].forEach(([x,y])=>flr(x,y,26));
  c.textAlign='center';c.textBaseline='middle';
  const serif='"Times New Roman", Georgia, "DejaVu Serif", serif';
  c.font='700 92px '+serif;c.fillText('CODE',W/2,300);c.fillText('CIVIL',W/2,402);
  c.font='600 46px '+serif;c.fillText('DES FRANÇAIS',W/2,486);
  c.lineWidth=3;c.beginPath();c.moveTo(W/2-150,548);c.lineTo(W/2+150,548);c.stroke();
  // couronne de laurier
  c.save();c.translate(W/2,700);c.lineWidth=3;c.beginPath();c.arc(0,0,92,Math.PI*0.62,Math.PI*2.38);c.stroke();
  for(let k=0;k<22;k++){const a=Math.PI*0.66+k/21*Math.PI*1.68;if(Math.abs(a-Math.PI*1.5)<0.12)continue;const x=Math.cos(a)*92,y=Math.sin(a)*92;
    c.save();c.translate(x,y);c.rotate(a+(k<11?0.6:-0.6)+Math.PI/2);c.beginPath();c.ellipse(0,0,7,19,0,0,6.283);c.fill();c.restore();}
  c.font='700 44px '+serif;c.fillText('AN XII',0,4);c.restore();
  c.font='700 70px '+serif;c.fillText('1804',W/2,900);
  const t=new THREE.CanvasTexture(cv);t.anisotropy=4;return t;
}
function ccvTitleTex(){
  const W=740,H=1050,cv=document.createElement('canvas');cv.width=W;cv.height=H;const c=cv.getContext('2d');
  c.fillStyle='#efe4cb';c.fillRect(0,0,W,H);
  // rousseurs du papier ancien
  const r=mulberry32(1804);for(let i=0;i<90;i++){c.fillStyle=`rgba(150,105,55,${0.03+r()*0.06})`;c.beginPath();c.arc(r()*W,r()*H,2+r()*16,0,6.283);c.fill();}
  c.fillStyle='#1d1712';c.textAlign='center';c.textBaseline='middle';
  const serif='"Times New Roman", Georgia, "DejaVu Serif", serif';
  c.font='700 74px '+serif;c.fillText('CODE CIVIL',W/2,190);
  c.font='italic 40px '+serif;c.fillText('des',W/2,262);
  c.font='700 66px '+serif;c.fillText('FRANÇAIS.',W/2,330);
  c.fillRect(W/2-120,392,240,3);
  c.font='600 34px '+serif;c.fillText('ÉDITION ORIGINALE',W/2,452);c.fillText('ET SEULE OFFICIELLE.',W/2,498);
  // fleuron central
  c.save();c.translate(W/2,630);for(let k=0;k<8;k++){c.rotate(Math.PI/4);c.beginPath();c.ellipse(0,-26,7,22,0,0,6.283);c.fill();}c.beginPath();c.arc(0,0,8,0,6.283);c.fill();c.restore();
  c.font='600 36px '+serif;c.fillText('À PARIS,',W/2,780);
  c.font='500 26px '+serif;c.fillText("DE L'IMPRIMERIE DE LA RÉPUBLIQUE.",W/2,834);
  c.fillRect(W/2-60,880,120,2);
  c.font='600 34px '+serif;c.fillText('AN XII. — 1804.',W/2,930);
  const t=new THREE.CanvasTexture(cv);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;
}
function ccvSpineTex(){
  const W=256,H=200,cv=document.createElement('canvas');cv.width=W;cv.height=H;const c=cv.getContext('2d');
  c.fillStyle='#6e1712';c.fillRect(0,0,W,H);c.strokeStyle='#d8b060';c.lineWidth=4;c.strokeRect(10,10,W-20,H-20);
  c.fillStyle='#e0bc6a';c.textAlign='center';c.textBaseline='middle';const serif='"Times New Roman", Georgia, "DejaVu Serif", serif';
  c.font='700 46px '+serif;c.fillText('CODE',W/2,72);c.fillText('CIVIL',W/2,128);
  const t=new THREE.CanvasTexture(cv);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;
}
function ccvMarbleTex(){
  // papier marbré « peigné » des reliures de l'époque : bandes ondulées bleu, rouge, ocre
  const W=512,H=720,cv=document.createElement('canvas');cv.width=W;cv.height=H;const c=cv.getContext('2d');
  c.fillStyle='#2c3e66';c.fillRect(0,0,W,H);const r=mulberry32(77);const cols=['#2c3e66','#9a3a2a','#c9a14e','#e8dcc0','#1d2a48','#6f2a20'];
  for(let k=0;k<160;k++){c.strokeStyle=cols[Math.floor(r()*cols.length)];c.lineWidth=2+r()*9;c.globalAlpha=0.55+r()*0.45;
    const y0=r()*H,ph=r()*6.28,amp=6+r()*22;c.beginPath();for(let x=0;x<=W;x+=8){const y=y0+Math.sin(x*0.035+ph)*amp+Math.sin(x*0.11+ph*2)*amp*0.3;x?c.lineTo(x,y):c.moveTo(x,y);}c.stroke();}
  c.globalAlpha=1;const t=new THREE.CanvasTexture(cv);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;
}
function codeCivilParts(lo){
  const {H,W,T,c,s,yb}=CCV;const P={leather:[],page:[],cover:[],plinth:[],silk:[]};
  const box=(w,h,d,x,y,z,r)=>{const g=lo||!r?new THREE.BoxGeometry(w,h,d):new RoundedBoxGeometry(w,h,d,2,r);g.translate(x,y,z);return g;};
  // socle de marbre noir mouluré
  P.plinth.push(box(2.15,0.13,1.25,0,0.065,0,0.02),box(2.0,0.07,1.12,0,0.165,0,0.015));
  // bloc des pages : tranche de gouttière légèrement creuse (dos arrondi)
  {const g=new THREE.BoxGeometry(W-s-0.06,H-2*s,T-2*c,lo?1:6,1,lo?1:10);const pa=g.attributes.position;const hz=(T-2*c)/2;
    for(let i=0;i<pa.count;i++){const x=pa.getX(i),z=pa.getZ(i);if(x>0)pa.setX(i,x-0.035*(1-(z/hz)*(z/hz)));}
    g.computeVertexNormals();g.translate(-W/2+0.06+(W-s-0.06)/2,yb+H/2,0);P.page.push(g);}
  // plat arrière (le plat avant est dans son propre groupe : il pivote sur la charnière)
  P.leather.push(box(W-0.02,H,c,-W/2+0.02+(W-0.02)/2,yb+H/2,-T/2+c/2,0.012));
  P.cover.push(box(W-0.02,H,c,(W-0.02)/2,H/2,-c/2,0.012));
  // dos arrondi + nerfs
  const rz=T/2+c*0.2,rx=0.13;
  {const g=new THREE.CylinderGeometry(rz,rz,H,lo?8:32,1,true,Math.PI,Math.PI);g.scale(rx/rz,1,1);g.translate(-W/2+0.03,yb+H/2,0);P.leather.push(g);}
  for(let k=0;k<(lo?3:5);k++){const y=yb+H*(0.2+k*(lo?0.3:0.15));const g=new THREE.TorusGeometry(rz,0.022,lo?4:8,lo?8:28,Math.PI);
    g.rotateX(Math.PI/2);g.rotateY(-Math.PI/2);g.scale(rx/rz,1,1);g.translate(-W/2+0.03,y,0);P.leather.push(g);}
  // coiffes : tranchefiles de soie aux deux extrémités du dos
  if(!lo){[yb+s*0.8,yb+H-s*0.8].forEach(y=>{const g=new THREE.CylinderGeometry(0.022,0.022,T-2*c-0.04,10);g.rotateX(Math.PI/2);g.translate(-W/2+0.075,y,0);P.silk.push(g);});
    // signet : ruban de soie qui sort en bas et retombe sur le socle
    const pts=[];for(let i=0;i<=14;i++){const u=i/14;pts.push(new THREE.Vector3(0.05+u*0.3+Math.sin(u*3.0)*0.05,yb+0.003,0.06+u*0.46));}
    const pos=[],uv=[],idx=[];pts.forEach((p,i)=>{const q=pts[Math.min(14,i+1)].clone().sub(pts[Math.max(0,i-1)]).normalize();const w=0.034;
      pos.push(p.x-q.z*w,p.y,p.z+q.x*w,p.x+q.z*w,p.y,p.z-q.x*w);uv.push(0,i/14,1,i/14);if(i<pts.length-1){const a=i*2;idx.push(a,a+2,a+1,a+1,a+2,a+3);}});
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();P.silk.push(g);}
  return P;
}
function buildCodeCivil(){
  const {H,W,T,c,s,yb}=CCV;
  const grp=new THREE.Group();const wetU={uObjWet:{value:0}};
  const inner=new THREE.Group();inner.rotation.y=0.5;grp.add(inner);
  const leather=matLeather(wetU,false,'#7a4424');   // veau fauve
  const marble=matMarbleBlack();
  const paperM=patch(new THREE.MeshStandardMaterial({color:new THREE.Color('#e7dcc2'),roughness:0.9}),{
    uniforms:wetU,vHead:'varying vec3 vRvL;',vMain:'vRvL=transformed;',fHead:'varying vec3 vRvL;',
    fColor:`float fe=0.9+0.1*sin(vRvL.z*1300.0+rvNoise(vRvL*40.0)*3.0);diffuseColor.rgb*=fe;
      float top=smoothstep(${(yb+H-s-0.004).toFixed(4)},${(yb+H-s).toFixed(4)},vRvL.y);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.86,0.64,0.3),top);`,
    reps:[['#include <metalnessmap_fragment>',`#include <metalnessmap_fragment>
      metalnessFactor=smoothstep(${(yb+H-s-0.004).toFixed(4)},${(yb+H-s).toFixed(4)},vRvL.y)*0.9;`]],
  },'ccvpaper');
  const silkM=patch(new THREE.MeshPhysicalMaterial({color:new THREE.Color('#8e1b1b'),roughness:0.4,sheen:1,sheenColor:new THREE.Color('#e8a0a0'),side:THREE.DoubleSide}),{},'silk');
  const giltM=new THREE.MeshStandardMaterial({color:new THREE.Color('#d9ab50'),metalness:0.9,roughness:0.28,alphaMap:ccvCoverTex(),alphaTest:0.5});
  const P=codeCivilParts(false);
  P.plinth.forEach(g=>inner.add(new THREE.Mesh(g,marble)));
  P.page.forEach(g=>inner.add(new THREE.Mesh(g,paperM)));
  P.leather.forEach(g=>inner.add(new THREE.Mesh(g,leather)));
  P.silk.forEach(g=>inner.add(new THREE.Mesh(g,silkM)));
  // page de titre (sous le plat avant)
  const tp=new THREE.Mesh(new THREE.PlaneGeometry(W-s-0.14,H-2*s-0.1),new THREE.MeshStandardMaterial({map:ccvTitleTex(),roughness:0.9}));
  tp.position.set(-W/2+0.06+(W-s-0.06)/2+0.02,yb+H/2,T/2-c+0.002);inner.add(tp);
  // plat avant : groupe sur la charnière
  const hinge=new THREE.Group();hinge.position.set(-W/2+0.02,yb,T/2-c/2+c/2);inner.add(hinge);
  P.cover.forEach(g=>hinge.add(new THREE.Mesh(g,leather)));
  const gilt=new THREE.Mesh(new THREE.PlaneGeometry(W-0.12,H-0.1),giltM);gilt.position.set((W-0.02)/2,H/2,0.0025);hinge.add(gilt);
  const endp=new THREE.Mesh(new THREE.PlaneGeometry(W-0.14,H-0.14),new THREE.MeshStandardMaterial({map:ccvMarbleTex(),roughness:0.75}));
  endp.position.set((W-0.02)/2+0.02,H/2,-c-0.002);endp.rotation.y=Math.PI;hinge.add(endp);
  // dos : pièce de titre rouge et fleurons dorés entre les nerfs
  {const rx=0.13,x0=-W/2+0.03-rx-0.003;
   const lab=new THREE.Mesh(new THREE.PlaneGeometry(0.25,0.22),new THREE.MeshStandardMaterial({map:ccvSpineTex(),roughness:0.45,metalness:0.1}));
   lab.position.set(x0,yb+H*0.725,0);lab.rotation.y=-Math.PI/2;inner.add(lab);
   const fm=(()=>{const cv=document.createElement('canvas');cv.width=cv.height=256;const c=cv.getContext('2d');c.fillStyle='#000';c.fillRect(0,0,256,256);c.fillStyle='#fff';c.translate(128,128);
     for(let k=0;k<4;k++){c.rotate(Math.PI/2);c.beginPath();c.ellipse(0,-52,17,44,0,0,6.283);c.fill();c.beginPath();c.ellipse(36,-36,8,20,Math.PI/4,0,6.283);c.fill();}
     c.beginPath();c.arc(0,0,16,0,6.283);c.fill();const t=new THREE.CanvasTexture(cv);t.anisotropy=4;return t;})();
   const fl=new THREE.MeshStandardMaterial({color:new THREE.Color('#d9ab50'),metalness:0.9,roughness:0.3,alphaMap:fm,alphaTest:0.5});
   [0.275,0.425,0.575].forEach(f=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(0.2,0.2),fl);m.position.set(x0,yb+H*f,0);m.rotation.y=-Math.PI/2;inner.add(m);});
   const yr=new THREE.Mesh(new THREE.PlaneGeometry(0.25,0.1),new THREE.MeshStandardMaterial({color:new THREE.Color('#d9ab50'),metalness:0.9,roughness:0.3,alphaMap:textMask('1804',512,200,'700 150px "Times New Roman", Georgia, serif',0.05),alphaTest:0.5}));
   yr.position.set(x0,yb+H*0.87,0);yr.rotation.y=-Math.PI/2;inner.add(yr);}
  const scanU=makeScanU();
  const lo=codeCivilParts(true);addScan([...lo.leather,...lo.page,...lo.plinth],inner,scanU);addScan(lo.cover,hinge,scanU);
  const A={tl:[inner,new THREE.Vector3(-W/2,yb+H,0)],tr:[hinge,new THREE.Vector3(W-0.05,H-0.05,0)],br:[inner,new THREE.Vector3(0.95,0.1,0.55)]};
  const drips=[[hinge,new THREE.Vector3(W-0.1,0.0,0)],[inner,new THREE.Vector3(0.9,0.0,0.5)],[inner,new THREE.Vector3(-0.9,0.0,-0.4)],[inner,new THREE.Vector3(-W/2,yb,0)]];
  let ang=0;
  function update(dt,T,freedom){
    // le plat s'ouvre lentement, le livre respire un peu
    const tgt=-0.06-2.5*easeInOut(clamp01(freedom))+Math.sin(T*0.6)*0.03*freedom;
    ang+=(tgt-ang)*Math.min(1,dt*2.2);hinge.rotation.y=ang;
    inner.rotation.y=0.5+Math.sin(T*0.2)*0.25*freedom;
  }
  return {group:grp,inner,update,scanU,wetU,
    anchorW:(k,v)=>A[k][0].localToWorld(v.copy(A[k][1])),
    dripW:(v)=>{const d=drips[Math.floor(rand()*drips.length)];return d[0].localToWorld(v.copy(d[1]));}};
}

/* ═══════════════ HISTOIRE DU DROIT · la couronne et le sceptre ═══════════════
   Couronne royale fermée : bandeau d'or serti de rubis, saphirs et émeraudes, rangs de perles,
   huit fleurs de lys, huit demi-arcs perlés qui se rejoignent sous la fleur de lys sommitale,
   bonnet de velours bleu de France. Sceptre fleurdelisé couché sur un coussin de velours
   cramoisi à galon et glands d'or. Libéré : la couronne s'élève et tourne sur elle-même. */
const CRN={R:0.52,bh:0.24,y0:0.47,arcH:0.6,sc:1.2};
function cushionGeo(lo){
  const N=lo?6:40,g=new THREE.BoxGeometry(2,1,2,N,lo?2:6,N);const pa=g.attributes.position;
  for(let i=0;i<pa.count;i++){let x=pa.getX(i),y=pa.getY(i),z=pa.getZ(i);
    const ax=Math.abs(x)*2/2,az=Math.abs(z)*2/2;   // −1..1 → 0..1
    const fx=Math.pow(Math.max(0,1-Math.pow(Math.min(1,Math.abs(x)),3.2)),0.55),fz=Math.pow(Math.max(0,1-Math.pow(Math.min(1,Math.abs(z)),3.2)),0.55);
    const puff=0.12+0.88*fx*fz;
    // coins pincés, bords arrondis
    const rr=1-0.06*Math.pow(ax*az,3);
    pa.setXYZ(i,x*0.95*rr,(y*puff*0.5+0.25)+0.0*(ax+az),z*0.95*rr);}
  g.computeVertexNormals();return g;
}
function crownParts(lo){
  const {R,bh,y0,arcH}=CRN;const P={gold:[],velvet:[],cushion:[],ruby:[],sapph:[],emer:[],pearl:[],diam:[]};
  const seg=lo?12:72;
  // coussin + galon (passepoil) + glands
  P.cushion.push(cushionGeo(lo));
  if(!lo){const pts=[];for(let i=0;i<64;i++){const a=i/64*Math.PI*2;const c=Math.cos(a),s=Math.sin(a);const k=1/Math.pow(Math.pow(Math.abs(c),4)+Math.pow(Math.abs(s),4),0.25);pts.push(new THREE.Vector3(c*k*0.94,0.25,s*k*0.94));}
    P.gold.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts,true),160,0.028,8,true));
    [[1,1],[1,-1],[-1,1],[-1,-1]].forEach(([sx,sz])=>{const t=latheProfile([[0,0],[0.06,0.01],[0.085,0.08],[0.09,0.2],[0.05,0.26],[0.035,0.3],[0.05,0.33],[0,0.36]],18);
      t.rotateX(Math.PI);t.translate(sx*0.93,0.4,sz*0.93);P.gold.push(t);});}
  // bandeau
  {const b=new THREE.CylinderGeometry(R,R*0.98,bh,seg,1,true);b.translate(0,y0+bh/2,0);P.gold.push(b);
   const bi=new THREE.CylinderGeometry(R*0.96,R*0.94,bh,seg,1,true);bi.scale(-1,1,1);bi.translate(0,y0+bh/2,0);P.gold.push(bi);
   [y0+0.02,y0+bh-0.02].forEach(y=>{const t=new THREE.TorusGeometry(R+0.006,0.022,lo?4:8,seg);t.rotateX(Math.PI/2);t.translate(0,y,0);P.gold.push(t);});}
  // bonnet de velours
  {const pr=[];for(let i=0;i<=(lo?4:20);i++){const u=i/(lo?4:20);pr.push([R*0.95*Math.cos(u*Math.PI/2)*(1+0.08*Math.sin(u*Math.PI)),y0+bh*0.6+Math.sin(u*Math.PI/2)*(arcH*0.92)]);}
   pr[pr.length-1][0]=0;P.velvet.push(latheProfile(pr,seg));}
  // fleurs de lys et demi-arcs
  const NF=8,top=y0+bh+arcH;
  const fl=lo?new THREE.BoxGeometry(0.2,0.3,0.03).translate(0,0.15,0):fleurGeo(0.035,0.006);
  for(let k=0;k<NF;k++){const a=k/NF*Math.PI*2,big=k%2===0,sz=big?0.3:0.2;
    const g=fl.clone();g.scale(sz,sz,sz);g.translate(0,0,R+0.012);g.rotateY(a);g.translate(0,y0+bh-0.03,0);P.gold.push(g);
    // pierre sur le bandeau, sous chaque fleur
    const gem=big?new THREE.OctahedronGeometry(0.055,0):new THREE.IcosahedronGeometry(0.04,0);gem.scale(1,1.3,0.55);gem.translate(0,y0+bh/2,R+0.02);gem.rotateY(a);
    (big?(k%4===0?P.ruby:P.sapph):P.emer).push(gem);
    // perles entre les pierres
    if(!lo)for(let j=0;j<2;j++){const pa=a+(j?1:-1)*Math.PI/NF*0.55;const pe=new THREE.SphereGeometry(0.022,10,8);pe.translate(Math.sin(pa)*(R+0.015),y0+bh/2,Math.cos(pa)*(R+0.015));P.pearl.push(pe);}
    // demi-arc : part du sommet de la fleur, monte en s'arrondissant jusqu'au centre
    if(big){const pts=[];for(let i=0;i<=16;i++){const u=i/16;const r=(R+0.01)*Math.cos(u*Math.PI/2)*(1+0.12*Math.sin(u*Math.PI));const y=y0+bh+sz*0.62+(top-(y0+bh+sz*0.62))*Math.sin(u*Math.PI/2);pts.push(new THREE.Vector3(Math.sin(a)*r,y,Math.cos(a)*r));}
      P.gold.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),lo?6:40,0.024,lo?4:8,false));
      if(!lo)for(let i=2;i<15;i+=1){const p=pts[i];const pe=new THREE.SphereGeometry(0.018,8,6);pe.translate(p.x*1.03,p.y+0.026,p.z*1.03);P.pearl.push(pe);}}
  }
  // sommet : globe crucifère simplifié → bouton + grande fleur de lys double face
  {const k=latheProfile([[0,0],[0.07,0.01],[0.09,0.05],[0.07,0.09],[0.03,0.1],[0,0.1]],lo?8:28);k.translate(0,top-0.04,0);P.gold.push(k);
   const g=fl.clone();g.scale(0.36,0.36,0.36);g.translate(0,top+0.05,0);P.gold.push(g);
   const g2=fl.clone();g2.scale(0.36,0.36,0.36);g2.rotateY(Math.PI/2);g2.translate(0,top+0.05,0);P.gold.push(g2);}
  return P;
}
function scepterParts(lo){
  const P={gold:[],pearl:[],ruby:[]};const seg=lo?8:40;
  // hampe le long de +x, de 0 à 2,45 ; nœuds tournés ; tête fleurdelisée
  const L=2.2;
  {const g=new THREE.CylinderGeometry(0.03,0.034,L,seg);g.rotateZ(-Math.PI/2);g.translate(L/2,0,0);P.gold.push(g);}
  const knop=(x,r,h)=>{const g=latheProfile([[0,-h/2],[r*0.6,-h/2],[r,-h*0.15],[r,h*0.15],[r*0.6,h/2],[0,h/2]],seg);g.rotateZ(-Math.PI/2);g.translate(x,0,0);P.gold.push(g);};
  knop(0.0,0.06,0.1);knop(0.5,0.05,0.08);knop(1.1,0.065,0.12);knop(1.7,0.05,0.08);knop(2.08,0.075,0.16);
  if(!lo){[0.5,1.7].forEach(x=>{const r=new THREE.OctahedronGeometry(0.04,0);r.translate(x,0,0.05);P.ruby.push(r);});
    for(let k=0;k<10;k++){const a=k/10*Math.PI*2;const p=new THREE.SphereGeometry(0.016,8,6);p.translate(1.1,Math.cos(a)*0.068,Math.sin(a)*0.068);P.pearl.push(p);}}
  const f=lo?new THREE.BoxGeometry(0.3,0.42,0.04).translate(0,0.21,0):fleurGeo(0.06,0.008);
  const f1=f.clone();f1.scale(0.42,0.42,0.42);f1.rotateZ(-Math.PI/2);f1.translate(2.13,0,0);P.gold.push(f1);
  const f2=f.clone();f2.scale(0.42,0.42,0.42);f2.rotateZ(-Math.PI/2);f2.rotateX(Math.PI/2);f2.translate(2.13,0,0);P.gold.push(f2);
  return P;
}
function buildCouronne(){
  const grp=new THREE.Group();const wetU={uObjWet:{value:0}};
  const inner=new THREE.Group();inner.scale.setScalar(CRN.sc);grp.add(inner);
  const gold=matGold(wetU),velB=matVelvet(wetU,'#1f3a8a','velB'),velR=matVelvet(wetU,'#7a1020','velR');
  const ruby=matGem('#b3001b','ruby'),sapph=matGem('#1a3cc8','sapph'),emer=matGem('#0e8a4a','emer'),pearl=matPearl();
  const crown=new THREE.Group();inner.add(crown);
  const P=crownParts(false);
  const add=(list,m,par)=>{if(list.length)par.add(new THREE.Mesh(rvMerge(list),m));};
  add(P.cushion,velR,inner);
  const cushionGold=[],crownGold=[];P.gold.forEach((g,i)=>{(i<5?cushionGold:crownGold).push(g);});
  add(cushionGold,gold,inner);add(crownGold,gold,crown);add(P.velvet,velB,crown);
  add(P.ruby,ruby,crown);add(P.sapph,sapph,crown);add(P.emer,emer,crown);add(P.pearl,pearl,crown);
  crown.position.set(-0.1,0,-0.25);
  // sceptre couché en travers, devant la couronne, la tête relevée sur le galon
  const sc=new THREE.Group();const S=scepterParts(false);
  add(S.gold,gold,sc);add(S.pearl,pearl,sc);add(S.ruby,ruby,sc);
  sc.position.set(-0.98,0.37,0.74);sc.rotation.set(0,0.25,0.1);inner.add(sc);
  const scanU=makeScanU();
  const lo=crownParts(true),slo=scepterParts(true);
  addScan([...lo.cushion],inner,scanU);addScan([...lo.gold.slice(0),...lo.velvet],crown,scanU);addScan(slo.gold,sc,scanU);
  const top=CRN.y0+CRN.bh+CRN.arcH;
  const A={tl:[crown,new THREE.Vector3(0,top+0.35,0)],tr:[sc,new THREE.Vector3(2.3,0.1,0)],br:[inner,new THREE.Vector3(0.9,0.12,0.9)]};
  const drips=[[inner,new THREE.Vector3(0.93,0.05,0.93)],[inner,new THREE.Vector3(-0.93,0.05,0.93)],[crown,new THREE.Vector3(0.5,CRN.y0,0.2)],[sc,new THREE.Vector3(1.1,-0.05,0)]];
  function update(dt,T,freedom){
    const f=easeInOut(clamp01(freedom));
    crown.position.y=f*(0.35+Math.sin(T*0.9)*0.04);
    crown.rotation.y=T*0.35*f;crown.rotation.z=Math.sin(T*0.5)*0.03*f;
  }
  return {group:grp,inner,update,scanU,wetU,
    anchorW:(k,v)=>A[k][0].localToWorld(v.copy(A[k][1])),
    dripW:(v)=>{const d=drips[Math.floor(rand()*drips.length)];return d[0].localToWorld(v.copy(d[1]));}};
}

/* ═══════════════ ANGLAIS JURIDIQUE · le Capitole des États-Unis ═══════════════
   Maquette de marbre : terrasse, corps central à portique (8 colonnes, fronton), ailes du Sénat
   et de la Chambre avec leurs portiques, balustrades, fenêtres ; dôme sur tambour à péristyle,
   attique, côtes, lanterne (tholos) et statue de la Liberté. Libéré : la lanterne s'allume —
   comme lorsque le Congrès siège — et les fenêtres s'éclairent. */
function capWindowTex(cols,rows,arch){
  const W=1024,H=512,cv=document.createElement('canvas');cv.width=W;cv.height=H;const c=cv.getContext('2d');
  c.fillStyle='#000';c.fillRect(0,0,W,H);c.fillStyle='#fff';
  const cw=W/cols,rh=H/rows;
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const x=i*cw+cw*0.3,y=j*rh+rh*0.2,w=cw*0.4,h=rh*0.62;
    c.fillRect(x,y+(arch?w*0.5:0),w,h-(arch?w*0.5:0));if(arch&&j===0){c.beginPath();c.arc(x+w/2,y+w*0.5,w/2,Math.PI,0);c.fill();}}
  const t=new THREE.CanvasTexture(cv);t.anisotropy=4;return t;
}
function capitolParts(lo){
  const P={marble:[],dome:[],wins:[],lantern:[]};
  const box=(w,h,d,x,y,z)=>{const g=new THREE.BoxGeometry(w,h,d);g.translate(x,y,z);return g;};
  const seg=lo?8:24;
  const col=(r,h)=>{const g=new THREE.CylinderGeometry(r*0.88,r,h,lo?6:16,1,false);return g;};
  const colAt=(list,x,y,z,r,h)=>{const s=col(r,h);s.translate(x,y+h/2,z);list.push(s);if(!lo){const b=box(r*2.6,r*0.7,r*2.6,x,y+r*0.35,z);const cp=box(r*2.7,r*0.8,r*2.7,x,y+h-r*0.4,z);list.push(b,cp);}};
  const pediment=(list,w,d,x,y,z,h)=>{const sh=new THREE.Shape();sh.moveTo(-w/2,0);sh.lineTo(w/2,0);sh.lineTo(0,h);sh.lineTo(-w/2,0);const g=new THREE.ExtrudeGeometry(sh,{depth:d,bevelEnabled:false});g.translate(x,y,z-d/2);list.push(g);
    if(!lo){const c1=box(w+0.06,0.03,d+0.04,x,y-0.015,z);list.push(c1);}};
  const M=P.marble;
  // terrasse + emmarchement
  M.push(box(3.95,0.12,2.0,0,0.06,0.1),box(3.85,0.05,1.9,0,0.145,0.1));
  for(let k=0;k<3;k++){const h=0.04*(k+1);M.push(box(0.84-k*0.04,h,0.08*(3-k)+0.02,0,0.17+h/2,0.76+0.04*(3-k)));}
  const y1=0.17;
  // corps central
  M.push(box(1.32,0.8,1.12,0,y1+0.4,-0.08));
  M.push(box(1.4,0.06,1.2,0,y1+0.83,-0.08),box(1.36,0.08,1.16,0,y1+0.9,-0.08));   // corniche + attique
  // portique central : 8 colonnes, entablement, fronton
  const zp=0.66;
  for(let i=0;i<8;i++){const x=-0.49+i*0.14;colAt(M,x,y1+0.12,zp,0.034,0.58);}
  M.push(box(1.12,0.12,0.32,0,y1+0.06,0.62));   // stylobate du portique
  M.push(box(1.16,0.09,0.32,0,y1+0.74,zp-0.06));
  pediment(M,1.2,0.3,0,y1+0.785,zp-0.06,0.2);
  // liaisons et ailes
  [-1,1].forEach(sd=>{
    M.push(box(0.36,0.68,0.8,sd*0.84,y1+0.34,-0.12),box(0.4,0.05,0.84,sd*0.84,y1+0.705,-0.12));
    const xc=sd*1.45;
    M.push(box(1.0,0.72,1.0,xc,y1+0.36,-0.06),box(1.06,0.05,1.06,xc,y1+0.745,-0.06),box(1.02,0.06,1.02,xc,y1+0.8,-0.06));
    // balustrade
    if(!lo)for(let i=0;i<22;i++){const x=xc-0.48+i*0.0457;M.push(box(0.014,0.05,0.014,x,y1+0.86,0.44));}
    if(!lo)M.push(box(1.02,0.012,0.02,xc,y1+0.89,0.44));
    // portique d'aile : 6 colonnes + fronton
    for(let i=0;i<6;i++){const x=xc-0.3+i*0.12;colAt(M,x,y1+0.06,0.56,0.028,0.56);}
    M.push(box(0.76,0.06,0.16,xc,y1+0.03,0.54),box(0.78,0.07,0.22,xc,y1+0.655,0.52));
    pediment(M,0.82,0.2,xc,y1+0.69,0.52,0.13);
    // fenêtres (décalques) : façades avant et côtés
    P.wins.push({w:0.34,h:0.5,x:xc+(sd>0?0.33:-0.33),y:y1+0.34,z:0.441,ry:0,cols:2,rows:2});
    P.wins.push({w:0.34,h:0.5,x:xc-(sd>0?0.33:-0.33),y:y1+0.34,z:0.441,ry:0,cols:2,rows:2});
    P.wins.push({w:0.9,h:0.5,x:xc+sd*0.501,y:y1+0.36,z:-0.06,ry:sd*Math.PI/2,cols:6,rows:2});
  });
  P.wins.push({w:0.24,h:0.5,x:-0.55,y:y1+0.42,z:0.482,ry:0,cols:1,rows:2},{w:0.24,h:0.5,x:0.55,y:y1+0.42,z:0.482,ry:0,cols:1,rows:2});
  // dôme : soubassement, tambour à péristyle, attique, coupole à côtes, lanterne, statue
  const D=P.dome,yd=y1+0.94;
  {D.push(new THREE.CylinderGeometry(0.5,0.52,0.1,seg*2).translate(0,yd+0.05,0));
   D.push(new THREE.CylinderGeometry(0.38,0.38,0.3,seg*2).translate(0,yd+0.25,0));
   const NC=lo?8:28;for(let i=0;i<NC;i++){const a=i/NC*Math.PI*2;colAt(D,Math.cos(a)*0.46,yd+0.1,Math.sin(a)*0.46,0.018,0.28);}
   D.push(new THREE.CylinderGeometry(0.5,0.5,0.04,seg*2).translate(0,yd+0.4,0));
   if(!lo){const t=new THREE.TorusGeometry(0.49,0.01,6,64);t.rotateX(Math.PI/2);t.translate(0,yd+0.43,0);D.push(t);}
   D.push(new THREE.CylinderGeometry(0.39,0.4,0.14,seg*2).translate(0,yd+0.49,0));
   // coupole (profil légèrement surhaussé)
   const pr=[];const NP=lo?5:22;for(let i=0;i<=NP;i++){const u=i/NP;pr.push([0.38*Math.cos(u*Math.PI/2)*(1+0.04*Math.sin(u*Math.PI)),yd+0.56+0.52*Math.pow(Math.sin(u*Math.PI/2),0.92)]);}
   pr[NP][0]=0.0;pr.splice(NP,0,[0.085,yd+0.56+0.52*0.985]);D.push(latheProfile(pr,seg*2));
   if(!lo){for(let k=0;k<18;k++){const a=k/18*Math.PI*2;const pts=[];for(let i=0;i<=12;i++){const u=i/12*0.93;pts.push(new THREE.Vector3(Math.cos(a)*0.385*Math.cos(u*Math.PI/2)*(1+0.04*Math.sin(u*Math.PI)),yd+0.56+0.52*Math.pow(Math.sin(u*Math.PI/2),0.92)+0.004,Math.sin(a)*0.385*Math.cos(u*Math.PI/2)*(1+0.04*Math.sin(u*Math.PI))));}
     D.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),16,0.008,4,false));}}
   // lanterne (tholos)
   const yl=yd+1.07;
   for(let i=0;i<(lo?4:10);i++){const a=i/(lo?4:10)*Math.PI*2;colAt(D,Math.cos(a)*0.075,yl,Math.sin(a)*0.075,0.008,0.11);}
   D.push(new THREE.CylinderGeometry(0.095,0.095,0.02,20).translate(0,yl+0.12,0));
   D.push(latheProfile([[0.09,0],[0.085,0.02],[0.06,0.05],[0.03,0.065],[0,0.07]],20).translate(0,yl+0.13,0));
   P.lantern.push(new THREE.CylinderGeometry(0.06,0.06,0.1,16).translate(0,yl+0.055,0));
   // statue de la Liberté (silhouette)
   D.push(new THREE.CylinderGeometry(0.012,0.022,0.06,8).translate(0,yl+0.23,0),new THREE.SphereGeometry(0.012,8,6).translate(0,yl+0.268,0),new THREE.CylinderGeometry(0.016,0.016,0.012,8).translate(0,yl+0.2,0));}
  return P;
}
function buildCapitole(){
  const grp=new THREE.Group();const wetU={uObjWet:{value:0}};
  const inner=new THREE.Group();grp.add(inner);
  const marble=matMarbleWhite(wetU);marble.color.set('#b8b3ab');   // marbre un peu grisé : se détache dans l'ambre et sur le fond miel
  const winM=new THREE.MeshStandardMaterial({color:new THREE.Color('#2b2620'),roughness:0.25,metalness:0.2,emissive:new THREE.Color('#ffc874'),emissiveIntensity:0,transparent:false});
  const lanM=new THREE.MeshStandardMaterial({color:new THREE.Color('#fff2d0'),roughness:0.4,emissive:new THREE.Color('#ffd27e'),emissiveIntensity:0});
  const P=capitolParts(false);
  inner.add(new THREE.Mesh(rvMerge(P.marble),marble));inner.add(new THREE.Mesh(rvMerge(P.dome),marble));
  inner.add(new THREE.Mesh(rvMerge(P.lantern),lanM));
  const texCache={};
  P.wins.forEach(w=>{const k=w.cols+'x'+w.rows;const tex=texCache[k]||(texCache[k]=capWindowTex(w.cols,w.rows,true));
    const m=winM.clone();m.alphaMap=tex;m.alphaTest=0.5;
    const pl=new THREE.Mesh(new THREE.PlaneGeometry(w.w,w.h),m);pl.position.set(w.x,w.y,w.z);pl.rotation.y=w.ry;inner.add(pl);w.mat=m;});
  const scanU=makeScanU();
  const lo=capitolParts(true);addScan([...lo.marble,...lo.dome],inner,scanU);
  const yl=0.17+0.94+1.07;
  const A={tl:[inner,new THREE.Vector3(0,yl+0.28,0)],tr:[inner,new THREE.Vector3(1.9,0.98,0.4)],br:[inner,new THREE.Vector3(1.6,0.08,1.0)]};
  const drips=[[inner,new THREE.Vector3(1.9,0.05,0.75)],[inner,new THREE.Vector3(-1.9,0.05,0.75)],[inner,new THREE.Vector3(0,1.1,0.5)],[inner,new THREE.Vector3(0.5,1.5,0.0)]];
  function update(dt,T,freedom){
    inner.rotation.y=Math.sin(T*0.2)*0.45*freedom;
    lanM.emissiveIntensity=freedom*(1.6+0.2*Math.sin(T*1.7));
    P.wins.forEach(w=>{w.mat.emissiveIntensity=freedom*0.55;});
  }
  return {group:grp,inner,update,scanU,wetU,
    anchorW:(k,v)=>A[k][0].localToWorld(v.copy(A[k][1])),
    dripW:(v)=>{const d=drips[Math.floor(rand()*drips.length)];return d[0].localToWorld(v.copy(d[1]));}};
}

/* ═══ 12 · Bloc d'ambre brut (L1) : forme taillée, 4 phases (trouble, translucide, fissures, éclat), intérieur ═══
   La forme est calculée dans le shader de sommets (sphère cubique déformée en polyèdre). La maîtrise
   (0→1) éclaircit l'ambre mat jusqu'au translucide, puis le fend ; à 75 % il éclate à l'arrivée. */

/* — Courbe de fonte : dérivée de l'encombrement de l'objet prisonnier —
   jusqu'à 50 % la glace couvre tout l'objet (marge contrôlée), puis elle ne retient plus
   que sa partie basse (45 %, puis 17 %), avant de disparaître. */
function boundsOf(pts){const b={x0:1e9,x1:-1e9,y0:1e9,y1:-1e9,z0:1e9,z1:-1e9};pts.forEach(p=>{b.x0=Math.min(b.x0,p[0]);b.x1=Math.max(b.x1,p[0]);b.y0=Math.min(b.y0,p[1]);b.y1=Math.max(b.y1,p[1]);b.z0=Math.min(b.z0,p[2]);b.z1=Math.max(b.z1,p[2]);});
  b.cx=(b.x0+b.x1)/2;b.cz=(b.z0+b.z1)/2;b.ax=(b.x1-b.x0)/2;b.az=(b.z1-b.z0)/2;b.H=b.y1-b.y0;return b;}
function deriveMeltKeys(kp){
  const B=boundsOf(kp),y0=B.y0,H=B.H;
  const low=f=>{const pts=kp.filter(p=>p[1]<=y0+f*H);return boundsOf(pts.length>3?pts:kp);};
  const L1=low(0.445),L2=low(0.17);
  const K=(m,top,bot,c,hx,hz,k,frost,wet,th)=>({m,cx:c.cx,cz:c.cz,cy:(top+bot)/2,hy:(top-bot)/2,hx,hz,k,frost,wet,th});
  return [
    K(0.00,B.y1+0.66,y0-0.62,B,Math.max(B.ax+0.40,1.35),Math.max(B.az+0.58,1.12),0.025,1.00,0.00,1.9),
    K(0.25,B.y1+0.42,y0-0.48,B,Math.max(B.ax+0.34,1.28),Math.max(B.az+0.48,1.05),0.055,0.58,0.50,1.8),
    K(0.50,B.y1+0.22,y0-0.40,B,Math.max(B.ax+0.23,1.18),Math.max(B.az+0.37,0.96),0.11,0.32,0.85,1.6),
    K(0.75,y0+0.445*H,y0-0.38,L1,Math.max(L1.ax+0.11,1.0),Math.max(L1.az+0.26,0.85),0.17,0.24,1.00,1.2),
    K(0.90,y0+0.17*H,y0-0.33,L2,Math.max(L2.ax+0.23,0.6),Math.max(L2.az+0.16,0.55),0.17,0.20,1.00,0.9),
    K(1.00,y0+0.08*H,y0-0.21,L2,Math.max(L2.ax*0.85,0.45),Math.max(L2.az*0.98,0.42),0.15,0.18,1.00,0.7),
  ];
}
function meltState(keys,m){
  m=clamp01(m);
  let i=0;while(i<keys.length-2&&m>keys[i+1].m)i++;
  const a=keys[i],b=keys[i+1];
  let t=(m-a.m)/(b.m-a.m);t=t*t*(3-2*t);
  const o={};for(const k in a)o[k]=a[k]+(b[k]-a[k])*t;
  o.m=m;return o;
}
const PHASES=[
  {id:'0',  name:'BRUT'},
  {id:'I',  name:'TROUBLE'},
  {id:'II', name:'TRANSLUCIDE'},
  {id:'III',name:'FISSURES'},
  {id:'IV', name:'LIBÉRÉ'},
];
/* intact tant qu'aucun XP ; puis 0–25 / 25–50 / 50–75 / 75–100 % */
function phaseOf(m,hasXP){if(!hasXP||m<=0)return 0;if(m<0.25)return 1;if(m<0.5)return 2;if(m<0.75)return 3;return 4;}

function cubeSphereGeo(res){
  const F=[[[1,0,0],[0,0,-1],[0,1,0]],[[-1,0,0],[0,0,1],[0,1,0]],[[0,1,0],[1,0,0],[0,0,-1]],[[0,-1,0],[1,0,0],[0,0,1]],[[0,0,1],[1,0,0],[0,1,0]],[[0,0,-1],[-1,0,0],[0,1,0]]];
  const pos=[],idx=[];let base=0;
  for(const [N,A,B] of F){
    for(let j=0;j<=res;j++)for(let i=0;i<=res;i++){
      const u=Math.tan((i/res*2-1)*Math.PI/4),v=Math.tan((j/res*2-1)*Math.PI/4);
      const x=N[0]+u*A[0]+v*B[0],y=N[1]+u*A[1]+v*B[1],z=N[2]+u*A[2]+v*B[2];const l=Math.hypot(x,y,z);
      pos.push(x/l,y/l,z/l);
    }
    for(let j=0;j<res;j++)for(let i=0;i<res;i++){const a=base+j*(res+1)+i,b=a+1,c=a+res+2,d=a+res+1;idx.push(a,b,c,a,c,d);}
    base+=(res+1)*(res+1);
  }
  const g=new THREE.BufferGeometry();
  const pa=new Float32Array(pos);
  g.setAttribute('position',new THREE.BufferAttribute(pa,3));
  g.setAttribute('normal',new THREE.BufferAttribute(pa.slice(),3));
  g.setIndex(idx);
  return g;
}

/* ─────────────── L'AMBRE BRUT ───────────────
   Un bloc d'ambre brut, taillé comme la glace : polyèdre irrégulier (plans de taille arrondis par un
   « soft-min »), éclats conchoïdaux, rainures et stries de coulée, piqûres. Surface mate et poussiéreuse
   au départ : on devine l'objet. Plus la maîtrise monte, plus l'ambre s'éclaircit et devient
   translucide (TROUBLE → TRANSLUCIDE), puis il se fend (FISSURES : « soleils » dorés) et éclate.
   Dedans : couches de coulée teintées, lignes de poussière, bulles, trouble, débris ; et de vraies
   inclusions (moustique, fourmi, feuille). */
const ICE_GLSL_V=`
uniform vec4 uPl[24];uniform vec4 uBite[10];uniform vec3 uBoxC;uniform vec3 uRefS;uniform float uRound;uniform float uChip;uniform float uGroove;uniform float uScallop;uniform float uVanish;
varying vec3 vRvL;varying vec3 vRvRef;varying float vRvG;
float rvWorley(vec3 p){vec3 i=floor(p),f=fract(p);float d=8.0;
  for(int z=-1;z<=1;z++)for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec3 o=vec3(float(x),float(y),float(z));
    vec3 r=o+vec3(rvHash(i+o),rvHash(i+o+19.1),rvHash(i+o+47.3))-f;d=min(d,dot(r,r));}
  return sqrt(d);}
float rvPolyR(vec3 d){
  float t[24];float tm=1e4;
  for(int i=0;i<24;i++){float dn=dot(d,uPl[i].xyz);t[i]=dn>0.002?uPl[i].w/dn:1e4;tm=min(tm,t[i]);}
  float s=0.0;for(int i=0;i<24;i++)s+=exp(-(t[i]-tm)/uRound);
  float r=tm-uRound*log(s);
  // éclats : on recule jusqu'à la sphère d'éclat (cassure conchoïdale, typique de l'ambre)
  for(int j=0;j<10;j++){
    vec3 oc=uBoxC-uBite[j].xyz;float R=uBite[j].w;
    float b=dot(oc,d),c=dot(oc,oc)-R*R,h=b*b-c;
    if(h>0.0){float tn=-b-sqrt(h),tf=-b+sqrt(h);
      if(tn<r&&tf>r){float k=smoothstep(0.0,0.12,r-tn);r=mix(r,tn,k);}}
  }
  return r;
}
vec3 rvIceSurf(vec3 d,out float g){
  float r=rvPolyR(d);
  vec3 ref=d*uRefS;
  float ch=1.0-abs(rvNoise(ref*2.3)*2.0-1.0);
  // stries de coulée (fines, serrées) et rainures (larges, profondes), dans deux directions
  float st=rvNoise(vec3(ref.x*2.6,ref.y*0.22,ref.z*2.6))*0.55+rvNoise(vec3(ref.x*6.0,ref.y*0.45,ref.z*6.0))*0.45;
  vec3 rq=vec3(ref.x+ref.y*0.35,ref.y,ref.z-ref.y*0.2);
  float g1=smoothstep(0.55,0.85,rvNoise(vec3(rq.x*1.6,rq.y*0.15+3.0,rq.z*1.6)));
  float g2=smoothstep(0.62,0.9,rvNoise(vec3(ref.x*0.2+7.0,ref.y*1.7,ref.z*1.7)));
  g=max(g1,g2*0.8);
  float lo=rvFbm3(ref*0.75+5.0)-0.5;
  float w=rvWorley(ref*1.9);
  float sc=max(0.0,1.0-w*w*2.6);
  float disp=lo*0.12-uChip*ch*ch*ch-0.06*st-uGroove*g-uScallop*sc;
  return uBoxC+d*max((r+disp)*uVanish,0.01);
}`;

const ICE_GLSL_F=`
uniform vec4 uPl[24];uniform vec3 uBoxC;uniform float uMelt;uniform float uFrost;uniform float uCrk;uniform float uClar;
uniform vec3 uCamL;uniform mat3 uV2L;uniform vec4 uCrN[6];uniform vec4 uCrP[6];uniform vec3 uFlowN;
uniform vec3 uCloudCol;uniform vec3 uDebCol;uniform vec3 uSpCol;uniform float uHoverIce;
varying vec3 vRvL;varying vec3 vRvRef;varying float vRvG;
float rvTransK=1.0;float rvPat=0.0;float rvCrkL=0.0;
float rvInside(vec3 p){float m=-1e4;for(int i=0;i<24;i++){m=max(m,dot(p-uBoxC,uPl[i].xyz)-uPl[i].w);}return m;}
float rvCell(vec3 p){vec3 i=floor(p),f=fract(p);float d1=8.0,d2=8.0;
  for(int z=-1;z<=1;z++)for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec3 o=vec3(float(x),float(y),float(z));
    vec3 r=o+vec3(rvHash(i+o),rvHash(i+o+19.1),rvHash(i+o+47.3))-f;float d=dot(r,r);if(d<d1){d2=d1;d1=d;}else if(d<d2)d2=d;}
  return sqrt(d2)-sqrt(d1);}
`;

/* intérieur, ajouté après la transmission (le décor et l'objet réfractés sont dans totalDiffuse) */
const ICE_INTERIOR=`
{
  vec3 rvNv=normalize(uV2L*normal);
  vec3 rvVd=normalize(vRvL-uCamL);
  vec3 rvRd=refract(rvVd,rvNv,0.65);
  if(dot(rvRd,rvRd)<0.01) rvRd=rvVd;
  float rvJ=rvHash(vec3(gl_FragCoord.xy,fract(uTime)*91.0));
  vec3 col=totalDiffuse;
  // couches de résine : chaque coulée a sa teinte (miel → cognac), poussière aux limites
  {vec3 pm=vRvL+rvRd*0.45;float s=dot(pm-uBoxC,uFlowN)*2.1+rvFbm3(pm*0.55+2.0)*2.6;
   float t=rvHash(vec3(floor(s),7.0,3.0));
   col*=mix(vec3(1.06,1.0,0.9),vec3(0.8,0.52,0.28),t*0.85);
   for(int k=0;k<3;k++){vec3 p=vRvL+rvRd*(0.12+float(k)*0.3);if(rvInside(p)>-0.02) break;
     float sk=dot(p-uBoxC,uFlowN)*2.1+rvFbm3(p*0.55+2.0)*2.6;float fr=fract(sk);float e=min(fr,1.0-fr);
     float line=smoothstep(0.04,0.0,e);float dust=step(0.6,rvNoise(p*26.0))*line;
     col=mix(col,col*vec3(0.62,0.42,0.22),line*0.3);col=mix(col,vec3(0.16,0.09,0.04),dust*0.45);}}
  // bulles d'air (quelques-unes étirées par la coulée)
  for(int k=3;k>=0;k--){
    float tt=0.08+float(k)*0.17;vec3 p=vRvL+rvRd*tt;
    if(rvInside(p)>-0.03) continue;
    vec3 q=p*6.0;vec3 ci=floor(q);vec3 f=fract(q)-0.5;
    float h=rvHash(ci+float(k)*13.0);
    if(h>0.85){vec3 o=(vec3(rvHash(ci+3.1),rvHash(ci+5.7),rvHash(ci+8.3))-0.5)*0.5;
      float r=0.022+0.065*pow(rvHash(ci+1.9),2.0);vec3 dv=f-o;dv.y*=mix(1.0,0.4,step(0.96,h));
      float dd=length(dv);
      float rim=smoothstep(r,r*0.78,dd)*smoothstep(r*0.45,r*0.9,dd);
      float hi=smoothstep(r*0.35,0.0,length(dv-vec3(-r*0.35,r*0.4,0.0)));
      col=mix(col,col*0.45,rim*0.55);col+=vec3(1.0,0.92,0.75)*hi*0.55;}
  }
  // « soleils » : disques de fracture dorés, deux de naissance, les autres s'ouvrent quand l'ambre se fend
  for(int k=0;k<6;k++){
    vec3 cn=uCrN[k].xyz;float den=dot(rvRd,cn);if(abs(den)<0.03) continue;
    float tt=dot(uCrP[k].xyz-vRvL,cn)/den;if(tt<0.0||tt>2.2) continue;
    vec3 q=vRvL+rvRd*tt;if(rvInside(q)>-0.05) continue;
    float grow=k<2?0.4+0.6*uCrk:smoothstep(0.0,1.0,uCrk*1.7-float(k-2)*0.22);
    float R=uCrP[k].w*grow;if(R<0.02) continue;
    vec3 dq=q-uCrP[k].xyz;float rr=length(dq);
    vec3 ax=normalize(cross(cn,abs(cn.y)<0.9?vec3(0.0,1.0,0.0):vec3(1.0,0.0,0.0)));float ang=atan(dot(dq,cross(cn,ax)),dot(dq,ax));
    float Rw=R*(1.0+0.12*sin(ang*7.0+float(k))+0.06*sin(ang*13.0+float(k)*2.0));
    float ins=smoothstep(Rw,Rw*0.9,rr);
    float ring=0.86+0.14*sin(rr*26.0/max(R,0.25));
    float fres=pow(max(1.0-abs(den),0.0),1.5);
    col=mix(col,uSpCol*(0.4+1.3*fres)*ring,ins*0.42);col+=uSpCol*smoothstep(0.02,0.0,abs(rr-Rw))*0.45;
  }
  // trouble laiteux (dense au départ, se dissipe avec la maîtrise), poussière et débris végétaux
  float aA=0.0;vec3 aC=vec3(0.0);
  for(int i=0;i<ICE_STEPS;i++){
    float tt=(float(i)+rvJ)*0.1;vec3 p=vRvL+rvRd*tt;float ins=-rvInside(p);if(ins<0.0) break;
    float fb=rvFbm3(p*1.3+3.0);
    float fr=(0.25+0.75*smoothstep(0.45,0.85,fb))*uFrost*uFrost*0.075;
    float sd=smoothstep(0.9,0.98,rvNoise(p*14.0))*0.05;
    float a=(fr+sd)*(1.0-aA);
    aC+=mix(uCloudCol*(0.85+0.3*fb),uDebCol,sd/(fr+sd+1e-4))*a;aA+=a;
  }
  col=col*(1.0-aA)+aC;
  totalDiffuse=mix(totalDiffuse,col,rvTransK);
}
`;

/* ───── inclusions : moustique, fourmi, fragment de feuille et brindille ───── */
function amberInclusionMeshes(){
  const body=new THREE.MeshStandardMaterial({color:new THREE.Color('#2b1a10'),roughness:0.42,metalness:0.05});
  const antM=new THREE.MeshStandardMaterial({color:new THREE.Color('#4a1e0c'),roughness:0.38,metalness:0.05});
  const wingTex=(()=>{const cv=document.createElement('canvas');cv.width=256;cv.height=64;const c=cv.getContext('2d');
    c.fillStyle='#000';c.fillRect(0,0,256,64);c.fillStyle='#777';c.beginPath();c.ellipse(128,32,124,26,0,0,6.283);c.fill();
    c.strokeStyle='#fff';c.lineWidth=2.2;for(const y of [20,28,36,44]){c.beginPath();c.moveTo(6,32);c.quadraticCurveTo(120,y,250,32+(y-32)*0.4);c.stroke();}
    c.lineWidth=1.2;for(let x=40;x<240;x+=34){c.beginPath();c.moveTo(x,12);c.lineTo(x+8,52);c.stroke();}
    c.strokeStyle='#ccc';c.lineWidth=2;c.beginPath();c.ellipse(128,32,124,26,0,0,6.283);c.stroke();
    const t=new THREE.CanvasTexture(cv);return t;})();
  const wingM=new THREE.MeshStandardMaterial({color:new THREE.Color('#d8cdb8'),roughness:0.3,side:THREE.DoubleSide,alphaMap:wingTex,alphaHash:true,transparent:false});
  const V=(x,y,z)=>new THREE.Vector3(x,y,z);
  const ell=(rx,ry,rz,x,y,z)=>{const g=new THREE.SphereGeometry(1,12,9);g.scale(rx,ry,rz);g.translate(x,y,z);return g;};
  const seg=(a,b,r0,r1)=>{const d=b.clone().sub(a),L=d.length();const g=new THREE.CylinderGeometry(r1,r0,L,5,1,true);g.translate(0,L/2,0);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0,1,0),d.normalize()));g.translate(a.x,a.y,a.z);return g;};
  const leg=(list,pts,r)=>{for(let i=0;i<pts.length-1;i++)list.push(seg(pts[i],pts[i+1],r*(1-i*0.2),r*(1-(i+1)*0.2)));};
  // moustique : longueur ≈ 0,42 (axe +x vers l'avant)
  const mosq=new THREE.Group();
  {const P=[ell(0.05,0.045,0.04,0,0,0),ell(0.03,0.028,0.028,0.07,-0.005,0),ell(0.12,0.026,0.026,-0.15,-0.02,0),ell(0.05,0.022,0.022,-0.27,-0.035,0)];
   P.push(ell(0.016,0.018,0.016,0.085,0.005,0.018),ell(0.016,0.018,0.016,0.085,0.005,-0.018));
   P.push(seg(V(0.095,-0.01,0),V(0.22,-0.06,0),0.005,0.003));
   for(const s of [1,-1]){P.push(seg(V(0.09,0.01,0.01*s),V(0.15,0.05,0.05*s),0.003,0.0015));
     [[0.03,0.55],[0.0,0.0],[-0.03,-0.6]].forEach(([x,a])=>{const c=Math.cos(a),sn=Math.sin(a);
       leg(P,[V(x,-0.02,0.03*s),V(x+0.08*sn+0.02,0.03,(0.03+0.09*c)*s),V(x+0.16*sn+0.03,-0.09,(0.03+0.2*c)*s),V(x+0.24*sn+0.04,-0.16,(0.03+0.3*c)*s)],0.005);});}
   mosq.add(new THREE.Mesh(rvMerge(P),body));
   for(const s of [1,-1]){const w=new THREE.Mesh(new THREE.PlaneGeometry(0.26,0.065),wingM);w.rotation.set(-Math.PI/2,0,0);w.position.set(-0.11,0.04,0.075*s);w.rotation.y=0.22*s;w.rotation.x=-Math.PI/2+0.25*s;mosq.add(w);}}
  // fourmi : longueur ≈ 0,3
  const ant=new THREE.Group();
  {const P=[ell(0.036,0.03,0.04,0.11,0.01,0),ell(0.06,0.026,0.024,0.035,0.012,0),ell(0.016,0.022,0.016,-0.03,0.012,0),ell(0.065,0.048,0.05,-0.1,0.016,0)];
   for(const s of [1,-1]){P.push(seg(V(0.14,0.0,0.012*s),V(0.17,-0.01,0.025*s),0.007,0.002));
     leg(P,[V(0.14,0.03,0.015*s),V(0.15,0.07,0.04*s),V(0.2,0.06,0.07*s)],0.0035);
     [[0.06,0.5],[0.035,0.0],[0.01,-0.55]].forEach(([x,a])=>{const c=Math.cos(a),sn=Math.sin(a);
       leg(P,[V(x,0.0,0.015*s),V(x+0.05*sn,0.04,(0.015+0.06*c)*s),V(x+0.1*sn,-0.03,(0.015+0.11*c)*s),V(x+0.13*sn,-0.05,(0.015+0.15*c)*s)],0.006);});}
   ant.add(new THREE.Mesh(rvMerge(P),antM));}
  // fragment de feuille (déchiré, veiné) + brindille fourchue
  const leaf=new THREE.Group();
  {const sh=new THREE.Shape();const N=26;for(let i=0;i<=N;i++){const t=i/N*Math.PI*2;let r=1.0;if(t>3.6&&t<4.6)r*=0.55+0.25*Math.sin(t*9.0);const x=Math.cos(t)*0.22,y=Math.sin(t)*0.09*r*(1-0.35*Math.cos(t));i?sh.lineTo(x*(t>3.6&&t<4.6?0.85:1),y):sh.moveTo(x,y);}
   const g=new THREE.ShapeGeometry(sh,10);const pa=g.attributes.position;for(let i=0;i<pa.count;i++){const x=pa.getX(i),y=pa.getY(i);pa.setZ(i,0.35*x*x+0.25*y*y-0.02);}g.computeVertexNormals();
   const tex=(()=>{const cv=document.createElement('canvas');cv.width=256;cv.height=128;const c=cv.getContext('2d');c.fillStyle='#6e4a1e';c.fillRect(0,0,256,128);
     c.strokeStyle='#3a220c';c.lineWidth=4;c.beginPath();c.moveTo(0,64);c.lineTo(256,64);c.stroke();c.lineWidth=1.6;
     for(let x=20;x<240;x+=22){c.beginPath();c.moveTo(x,64);c.quadraticCurveTo(x+14,40,x+28,6);c.stroke();c.beginPath();c.moveTo(x,64);c.quadraticCurveTo(x+14,88,x+28,122);c.stroke();}
     const r=mulberry32(5);for(let i=0;i<40;i++){c.fillStyle=`rgba(40,22,8,${0.15+r()*0.25})`;c.beginPath();c.arc(r()*256,r()*128,2+r()*7,0,6.283);c.fill();}
     const t=new THREE.CanvasTexture(cv);t.colorSpace=THREE.SRGBColorSpace;return t;})();
   const uv=g.attributes.uv;for(let i=0;i<uv.count;i++){uv.setXY(i,pa.getX(i)/0.44+0.5,pa.getY(i)/0.2+0.5);}
   leaf.add(new THREE.Mesh(g,new THREE.MeshStandardMaterial({map:tex,roughness:0.75,side:THREE.DoubleSide})));
   const tw=new THREE.MeshStandardMaterial({color:new THREE.Color('#4a3018'),roughness:0.85});
   const c1=new THREE.CatmullRomCurve3([V(-0.3,-0.06,0.03),V(-0.1,-0.05,0.05),V(0.08,-0.07,0.02),V(0.26,-0.03,0.0)]);
   const c2=new THREE.CatmullRomCurve3([V(-0.02,-0.055,0.045),V(0.05,-0.0,0.08),V(0.1,0.05,0.1)]);
   leaf.add(new THREE.Mesh(new THREE.TubeGeometry(c1,16,0.013,6,false),tw),new THREE.Mesh(new THREE.TubeGeometry(c2,8,0.008,5,false),tw));}
  return {mosq,ant,leaf};
}

function buildIceBlock(KP){
  const r=mulberry32(KP.length*131+7);
  const KEYS=deriveMeltKeys(KP),B0=boundsOf(KP);
  // l'ambre ne fond pas : la coque garde la forme de départ à toutes les phases
  const K0=KEYS[0];KEYS.forEach(k=>{k.cx=K0.cx;k.cy=K0.cy;k.cz=K0.cz;k.hx=K0.hx;k.hy=K0.hy;k.hz=K0.hz;});
  const RES=MOBILE?72:120;
  const geo=cubeSphereGeo(RES);
  /* plans de taille : 6 faces inclinées, deux grandes cassures, 8 coins abattus, 8 facettes libres */
  const PL=[];
  const jit=(v,a)=>new THREE.Vector3(v[0]+(r()-0.5)*a,v[1]+(r()-0.5)*a,v[2]+(r()-0.5)*a).normalize();
  [[1,0,0],[-1,0,0],[0.26,1,0.1],[0,-1,0],[0,0,1],[0,0,-1]].forEach(v=>PL.push({n:jit(v,0.24),f:1}));
  PL.push({n:new THREE.Vector3(-0.75,0.62,0.18).normalize(),f:0.80});PL.push({n:new THREE.Vector3(0.62,-0.55,0.35).normalize(),f:0.84});
  for(let sx=-1;sx<=1;sx+=2)for(let sy=-1;sy<=1;sy+=2)for(let sz=-1;sz<=1;sz+=2)PL.push({n:jit([sx,sy,sz],0.6),f:0.70+r()*0.16});
  for(let i=0;i<8;i++){const v=new THREE.Vector3(r()-0.5,r()-0.5,r()-0.5).normalize();PL.push({n:v,f:0.84+r()*0.12});}
  const HH=[K0.hx,K0.hy,K0.hz],C0=new THREE.Vector3(K0.cx,K0.cy,K0.cz);
  const supOf=n=>Math.abs(n.x)*HH[0]+Math.abs(n.y)*HH[1]+Math.abs(n.z)*HH[2];
  // l'ambre couvre chaque point critique de l'objet (marge 0,34)
  PL.forEach(p=>{const sup=supOf(p.n);let need=0;KP.forEach(k=>{need=Math.max(need,p.n.x*(k[0]-C0.x)+p.n.y*(k[1]-C0.y)+p.n.z*(k[2]-C0.z)+0.34);});
    if(p.f*sup<need)p.f=Math.min(1.3,need/sup);});
  const plU=PL.map(p=>{const w=p.f*supOf(p.n);return new THREE.Vector4(p.n.x,p.n.y,p.n.z,w);});
  /* éclats conchoïdaux sur les arêtes et les coins, rayon borné par les points critiques */
  const BITE=[];
  for(let j=0;j<10;j++){
    const dir=new THREE.Vector3(r()-0.5,(r()-0.5)*1.2,(r()-0.5)).normalize();
    const tgt=new THREE.Vector3(C0.x+Math.sign(dir.x)*HH[0]*(0.6+r()*0.4),C0.y+Math.sign(dir.y)*HH[1]*(0.5+r()*0.5),C0.z+Math.sign(dir.z)*HH[2]*(0.7+r()*0.3));
    const R=0.45+r()*0.75;const c=tgt.clone().add(dir.multiplyScalar(R*0.72));
    let Rm=R;KP.forEach(k=>{const dd=Math.hypot(k[0]-c.x,k[1]-c.y,k[2]-c.z)-0.36;Rm=Math.min(Rm,dd);});
    BITE.push({c,R:Math.max(0.05,Rm)});
  }
  const biteU=BITE.map(b=>new THREE.Vector4(b.c.x,b.c.y,b.c.z,b.R));
  const insideHull=(p,m)=>plU.every(u=>u.x*(p.x-C0.x)+u.y*(p.y-C0.y)+u.z*(p.z-C0.z)<=u.w-m)&&BITE.every(b=>p.distanceTo(b.c)>b.R+m);
  /* « soleils » : centres dans l'ambre, plans quelconques */
  const crN=[],crP=[];
  for(let k=0;k<6;k++){const n=new THREE.Vector3(r()-0.5,(r()-0.5)*0.8,r()-0.5).normalize();crN.push(new THREE.Vector4(n.x,n.y,n.z,0));
    let c=null;for(let t=0;t<80&&!c;t++){const q=new THREE.Vector3(C0.x+(r()*2-1)*HH[0]*0.8,C0.y+(r()*2-1)*HH[1]*0.8,C0.z+(r()*2-1)*HH[2]*0.7);if(insideHull(q,0.25))c=q;}
    c=c||C0.clone();crP.push(new THREE.Vector4(c.x,c.y,c.z,(k<2?0.18:0.3)+r()*(k<2?0.12:0.35)));}
  const flowN=new THREE.Vector3(0.22+r()*0.2,1,0.1+r()*0.2).normalize();
  const IU={
    uPl:{value:plU},uBite:{value:biteU},uBoxC:{value:C0.clone()},uRefS:{value:new THREE.Vector3(...HH)},
    uRound:{value:0.035},uChip:{value:0.055},uGroove:{value:0.085},uScallop:{value:0.04},uVanish:{value:1},
    uMelt:{value:0},uFrost:{value:1},uCrk:{value:0},uClar:{value:0},
    uCamL:{value:new THREE.Vector3()},uV2L:{value:new THREE.Matrix3()},uCrN:{value:crN},uCrP:{value:crP},uFlowN:{value:flowN},
    uCloudCol:{value:new THREE.Color('#f0c27c')},uDebCol:{value:new THREE.Color('#2e1a0a')},uSpCol:{value:new THREE.Color('#ffd27a')},uHoverIce:{value:0},
  };
  const mat=new THREE.MeshPhysicalMaterial({color:new THREE.Color('#ffe2b4'),metalness:0,roughness:0.4,transmission:1,thickness:(HH[0]+HH[1]+HH[2])/3*1.1,ior:1.54,
    dispersion:MOBILE?0:0.06,attenuationColor:new THREE.Color('#eba04c'),attenuationDistance:2.2,specularIntensity:0.8,clearcoat:0,clearcoatRoughness:0.2,envMapIntensity:0.9});
  const transChunk=THREE.ShaderChunk.transmission_fragment.replace('material.transmission = transmission;','material.transmission = transmission*rvTransK;');
  patch(mat,{
    uniforms:IU,vNoise:true,
    vHead:ICE_GLSL_V,
    vNormal:`
      vec3 rvD=normalize(position);
      vec3 rvAx=abs(rvD.y)<0.95?vec3(0.0,1.0,0.0):vec3(1.0,0.0,0.0);
      vec3 rvT1=normalize(cross(rvD,rvAx));vec3 rvT2=cross(rvD,rvT1);
      float rvG,rvG1,rvG2;
      vec3 rvP=rvIceSurf(rvD,rvG);
      vec3 rvP1=rvIceSurf(normalize(rvD+rvT1*0.0045),rvG1);
      vec3 rvP2=rvIceSurf(normalize(rvD+rvT2*0.0045),rvG2);
      objectNormal=normalize(cross(rvP1-rvP,rvP2-rvP));
      if(dot(objectNormal,rvD)<0.0) objectNormal=-objectNormal;
      vRvL=rvP;vRvRef=rvD*uRefS;vRvG=rvG;`,
    vBegin:'transformed=rvP;',
    fHead:'#define ICE_STEPS '+(MOBILE?6:10)+'\n'+ICE_GLSL_F,
    fColor:`
      // patine de l'ambre brut : voile poussiéreux mat, plus dense dans les rainures ; s'efface avec la maîtrise
      float rvPn=rvFbm3(vRvRef*3.0+1.0);
      rvPat=(1.0-uClar)*(0.16+0.34*smoothstep(0.4,0.78,rvPn))+vRvG*0.3*(1.0-0.7*uClar);
      rvPat=clamp(rvPat,0.0,0.85);
      vec3 rvPc=mix(vec3(0.42,0.22,0.08),vec3(0.72,0.52,0.28),smoothstep(0.3,0.8,rvFbm3(vRvRef*7.0+5.0)));
      rvPc*=mix(0.85,1.08,rvNoise(vRvRef*40.0));
      diffuseColor.rgb=mix(diffuseColor.rgb,rvPc,rvPat);
      rvTransK=1.0-rvPat*0.88;
      // fêlures qui gagnent la surface quand l'ambre se fend
      float rvFm=smoothstep(1.0-uCrk*0.4,1.06-uCrk*0.4,rvFbm3(vRvRef*1.1+9.0));
      rvCrkL=smoothstep(0.02,0.0,rvCell(vRvRef*1.3+5.0))*rvFm*step(0.001,uCrk);`,
    fRough:`
      roughnessFactor=mix(0.34,0.08,uClar)+0.16*vRvG*(1.0-uClar*0.5)+0.12*rvPat;
      roughnessFactor=clamp(mix(roughnessFactor,0.3,rvCrkL),0.05,0.85);`,
    fNormal:`
      // stries serrées de coulée + grain mat (atténué quand l'ambre s'éclaircit)
      float rvH=rvNoise(vec3(vRvRef.x*9.0,vRvRef.y*0.9,vRvRef.z*9.0))*0.55+rvNoise(vec3(vRvRef.x*22.0,vRvRef.y*1.6,vRvRef.z*22.0))*0.35
        +rvNoise(vec3(vRvRef.x*55.0,vRvRef.y*3.5,vRvRef.z*55.0))*0.16;
      float rvGr=rvNoise(vRvRef*70.0)*0.5+rvNoise(vRvRef*150.0)*0.3;
      normal=rvPerturb(-vViewPosition,normal,rvH*mix(0.034,0.02,uClar)+rvGr*0.004*(1.0-uClar)-rvCrkL*0.006,1.0);`,
    fEmissive:`totalEmissiveRadiance+=uSpCol*rvCrkL*0.2;`,
    reps:[['#include <transmission_fragment>',transChunk+ICE_INTERIOR]],
  },'amber2');
  const mesh=new THREE.Mesh(geo,mat);
  geo.boundingSphere=new THREE.Sphere(C0.clone(),Math.hypot(...HH)*1.3+0.3);
  mesh.frustumCulled=true;mesh.renderOrder=2;

  /* inclusions : dans l'épaisseur d'ambre, plutôt côté visiteur, sans toucher l'objet */
  const INC=amberInclusionMeshes();
  const front=new THREE.Vector3(0.36,0.06,0.93).normalize();   // le bloc est tourné d'environ −0,38 rad
  const place1=(o,size,base,want,flat)=>{let best=null,bs=-1e9;
    for(let t=0;t<500;t++){const p=new THREE.Vector3(C0.x+(r()*2-1)*HH[0],C0.y+(r()*2-1)*HH[1],C0.z+(r()*2-1)*HH[2]);
      if(!insideHull(p,size+0.1))continue;
      let md=1e9;for(let i=0;i<KP.length;i+=2){const k=KP[i];md=Math.min(md,Math.hypot(k[0]-p.x,k[1]-p.y,k[2]-p.z));}
      if(md<size*0.75+0.06)continue;
      const q=p.clone().sub(C0).normalize();const sc=q.dot(front)*1.5+q.dot(want)-Math.abs(md-size-0.15)*0.6;
      if(sc>bs){bs=sc;best=p;}}
    if(!best)return false;o.scale.setScalar(size/base);
    o.position.copy(best);o.lookAt(best.clone().add(front));if(flat)o.rotateZ(r()*6.28);else{o.rotateX(Math.PI/2);o.rotateY(r()*6.28);}o.rotateX((r()-0.5)*0.5);o.rotateZ((r()-0.5)*0.3);mesh.add(o);return true;};
  const place=(o,base,want,flat)=>{for(const k of [1.75,1.45,1.2,1.0]){if(place1(o,base*k,base,want,flat))return true;}return false;};
  place(INC.mosq,0.24,new THREE.Vector3(-0.5,0.6,0.4).normalize());
  place(INC.ant,0.17,new THREE.Vector3(0.6,-0.5,0.4).normalize());
  place(INC.leaf,0.25,new THREE.Vector3(0.55,0.5,0.1).normalize(),true);

  const st={m:0,s:meltState(KEYS,0)};
  const _m4=new THREE.Matrix4();
  function setMelt(m){
    const s=meltState(KEYS,m);st.m=m;st.s=s;
    const clar=1-Math.pow(1-clamp01(m/0.62),1.6);   // s'éclaircit vite au début, limpide vers 60 %
    IU.uClar.value=clar;
    IU.uCrk.value=smooth(0.45,0.74,m);
    IU.uFrost.value=lerp(0.85,0.12,clar);
    IU.uRound.value=lerp(0.035,0.055,clar);    // les arêtes s'adoucissent à peine
    IU.uVanish.value=1-smooth(0.955,0.995,m);
    IU.uMelt.value=m;
    mat.attenuationDistance=lerp(2.2,4.4,clar);
    mat.clearcoat=0.35*clar;
    mesh.visible=m<0.995;
    return s;
  }
  function updateCam(cam){
    mesh.updateMatrixWorld();
    IU.uCamL.value.copy(cam.position).applyMatrix4(_m4.copy(mesh.matrixWorld).invert());
    _m4.multiplyMatrices(cam.matrixWorldInverse,mesh.matrixWorld);
    IU.uV2L.value.setFromMatrix4(_m4).transpose();
  }
  setMelt(0);
  return {mesh,mat,IU,st,KEYS,setMelt,updateCam};
}

/* — Gouttes d'eau : se forment sous le bloc (puis sous les plateaux), tombent, s'évanouissent — */
function buildDrips(){
  const N=MOBILE?24:56;
  const g=new THREE.InstancedBufferGeometry();
  g.setAttribute('position',new THREE.BufferAttribute(new Float32Array([-1,-1,0,1,-1,0,1,1,0,-1,1,0]),3));
  g.setIndex([0,1,2,0,2,3]);
  const aD=new Float32Array(N*4),aE=new Float32Array(N*2);
  g.setAttribute('aD',new THREE.InstancedBufferAttribute(aD,4).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('aE',new THREE.InstancedBufferAttribute(aE,2).setUsage(THREE.DynamicDrawUsage));
  g.instanceCount=N;
  const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,
    uniforms:{uFog:{value:new THREE.Color('#d98a2a')}},
    vertexShader:`attribute vec4 aD;attribute vec2 aE;varying vec2 vQ;varying float vA;
      void main(){
        vec4 mv=viewMatrix*vec4(aD.xyz,1.0);
        float s=aD.w;float st=1.0+aE.y*3.6;
        mv.xy+=vec2(position.x*s,position.y*s*st-aE.y*s*0.8);
        gl_Position=projectionMatrix*mv;vQ=position.xy;vA=aE.x;}`,
    fragmentShader:`uniform vec3 uFog;varying vec2 vQ;varying float vA;
      void main(){float r=length(vQ);if(r>1.0||vA<0.004)discard;
        float rim=smoothstep(0.55,1.0,r);
        vec3 c=mix(uFog*1.15,uFog*0.38,rim);
        c+=vec3(1.0,0.9,0.7)*smoothstep(0.32,0.0,length(vQ-vec2(-0.3,0.38)))*1.4;
        gl_FragColor=vec4(c,vA*smoothstep(1.0,0.82,r)*0.92);}`});
  const mesh=new THREE.Mesh(g,mat);mesh.frustumCulled=false;mesh.renderOrder=8;
  const D=[];for(let i=0;i<N;i++)D.push({st:0,t:rand()*3,wait:rand()*2,p:new THREE.Vector3(),loc:new THREE.Vector3(),src:0,v:0,y0:0,s:0.04+rand()*0.035});
  const _w=new THREE.Vector3();
  function update(dt,rate,emit,content){
    // emit(d) remplit d.loc (repère du bloc) et d.src ; le bloc bouge → on suit sa matrice
    for(let i=0;i<N;i++){
      const d=D[i];
      if(d.st===0){d.wait-=dt;if(d.wait<=0&&rate>0.01&&rand()<rate){emit(d);d.st=1;d.t=0;d.grow=1.0+rand()*1.6;}else if(d.wait<=0)d.wait=0.3+rand()*1.2;}
      else if(d.st===1){d.t+=dt;_w.copy(d.loc).applyMatrix4(content.matrixWorld);d.p.copy(_w);if(d.t>d.grow){d.st=2;d.t=0;d.v=0;}}
      else{d.t+=dt;d.v+=6*dt;d.p.y-=d.v*dt;if(d.t>1.35){d.st=0;d.wait=0.2+rand()*1.6/Math.max(rate,0.05);}}
      const k=d.st===1?smooth(0,d.grow,d.t):d.st===2?1:0;
      const a=d.st===1?smooth(0,0.3,d.t):d.st===2?1-smooth(0.7,1.35,d.t):0;
      aD[i*4]=d.p.x-ICE_ORIGIN.x*0;aD[i*4+1]=d.p.y;aD[i*4+2]=d.p.z;aD[i*4+3]=d.s*(0.35+0.65*k);
      aE[i*2]=a;aE[i*2+1]=d.st===2?Math.min(1,d.v/4):(d.st===1?0.25*smooth(0,d.grow,d.t):0);
    }
    g.attributes.aD.needsUpdate=true;g.attributes.aE.needsUpdate=true;
  }
  return {mesh,update};
}

/* ═══ 13 · Vent de sable autour du bloc ═══
   Là où igloo fait dériver des éclats de lignes, ici le sable contourne le bloc :
   chaque grain suit une ligne de courant d'écoulement potentiel autour d'un ellipsoïde
   (fonction de courant de Stokes), avec turbulence dans le sillage. Traînées + voiles. */
const FLOW_GLSL=`
uniform float uTime;uniform vec3 uC;uniform vec3 uRad;uniform vec3 uW;uniform float uLn;uniform float uGust;
float solveRho(float s,float b){
  float r=sqrt(b*b+1.0);
  for(int i=0;i<6;i++){
    float q=s*s+r*r;float iq=inversesqrt(q);float iq3=iq*iq*iq;
    float f=r*r*(1.0-iq3)-b*b;
    float df=2.0*r*(1.0-iq3)+3.0*r*r*r*iq3*iq*iq;
    r=r-f/max(df,1e-3);
    r=max(r,sqrt(max(1.0004-s*s,0.0)));
  }
  return r;
}
vec3 flowPos(float ph,float b,float phi,float seed,float turbK){
  float s=(ph*2.0-1.0)*uLn;
  float rho=solveRho(s,b);
  vec3 W=normalize(uW);vec3 U1=normalize(cross(W,vec3(0.0,1.0,0.0)));vec3 U2=cross(U1,W);
  float sw=phi+smoothstep(0.0,3.0,s)*sin(uTime*0.6+seed*6.28)*0.5;
  vec3 pn=W*s+(U1*cos(sw)+U2*sin(sw))*rho;
  float wake=smoothstep(-0.3,2.4,s)*exp(-max(rho-1.0,0.0)*0.8);
  vec3 tq=pn*0.85+vec3(seed*17.0,uTime*0.4,-uTime*0.25);
  vec3 turb=vec3(rvNoise(tq),rvNoise(tq+11.3),rvNoise(tq+23.7))-0.5;
  pn+=turb*(0.08+0.95*wake)*turbK;
  return uC+pn*uRad;
}`;

function buildSandFlow(parent){
  const FU={uTime:U.uTime,uN3:U.uN3,uC:{value:new THREE.Vector3(0,2,0)},uRad:{value:new THREE.Vector3(2.6,2.7,2.6)},uW:{value:new THREE.Vector3(1,-0.06,0.16).normalize()},
    uLn:{value:3.4},uRes:{value:new THREE.Vector2(VW*DPR,VH*DPR)},uAlpha:{value:0},uAlphaC:{value:0},uGust:{value:0},
    uFogC:{value:ICE_PAL.fog},uSandC:{value:new THREE.Color('#e2c7a4')},uSandD:{value:new THREE.Color('#cfae88')},uCamF:{value:new THREE.Vector3()}};
  const quad=()=>{const g=new THREE.InstancedBufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array([-1,-1,0,1,-1,0,1,1,0,-1,1,0]),3));g.setIndex([0,1,2,0,2,3]);return g;};
  const attrs=(g,n)=>{const a=new Float32Array(n*4),b=new Float32Array(n*4);for(let i=0;i<n*4;i++){a[i]=rand();b[i]=rand();}g.setAttribute('aR',new THREE.InstancedBufferAttribute(a,4));g.setAttribute('aS',new THREE.InstancedBufferAttribute(b,4));g.instanceCount=n;};

  /* — traînées de grains — */
  const N=MOBILE?1800:5200;
  const g=quad();attrs(g,N);
  const sm=new THREE.ShaderMaterial({uniforms:FU,transparent:true,depthWrite:false,
    vertexShader:GLSL_NOISE+FLOW_GLSL+`
      uniform vec2 uRes;attribute vec4 aR;attribute vec4 aS;
      varying vec2 vQ;varying float vA;varying float vD;
      void main(){
        float spd=(0.8+1.3*aR.x)*(1.0+uGust*0.7);
        float ph=fract(aR.y+uTime*spd/(2.0*uLn));
        float tau=0.015+0.06*aS.x*aS.x;
        float ph2=ph-spd*tau/(2.0*uLn);
        float b=0.08+2.3*pow(aR.z,1.7);
        float phi=aR.w*6.2831;
        vec3 c1=flowPos(ph,b,phi,aS.y,1.0),c2=flowPos(ph2,b,phi,aS.y,1.0);
        vec4 w1=modelMatrix*vec4(c1,1.0),w2=modelMatrix*vec4(c2,1.0);
        vec4 p1=projectionMatrix*viewMatrix*w1,p2=projectionMatrix*viewMatrix*w2;
        vA=0.0;
        if(p1.w<0.3||p2.w<0.3){gl_Position=vec4(2.0,2.0,2.0,1.0);return;}
        vec2 a=p1.xy/p1.w*uRes*0.5,bb=p2.xy/p2.w*uRes*0.5;
        vec2 t=a-bb;float L=length(t);t=L>1e-3?t/L:vec2(1.0,0.0);
        vec2 n=vec2(-t.y,t.x);
        float wpx=(0.7+aS.z*0.9)*clamp(uRes.y/900.0,0.85,1.7);
        vec2 px=mix(bb,a,position.x*0.5+0.5)+n*position.y*wpx*0.5+t*position.x*wpx*0.5;
        gl_Position=vec4(px/(uRes*0.5)*p1.w,p1.z,p1.w);
        vQ=position.xy;
        float fade=smoothstep(0.0,0.12,ph)*smoothstep(1.0,0.85,ph);
        float s0=(ph*2.0-1.0)*uLn;
        float near=exp(-max(b-0.9,0.0)*1.9);
        float wakeV=mix(0.45,1.0,smoothstep(-1.2,0.4,s0));
        vA=fade*(0.22+0.6*aS.w*aS.w)*mix(0.12,1.0,near)*wakeV;
        vD=length(w1.xyz-cameraPosition);
      }`,
    fragmentShader:`
      uniform float uAlpha;uniform vec3 uFogC;uniform vec3 uSandC;
      varying vec2 vQ;varying float vA;varying float vD;
      void main(){
        float a=vA*uAlpha*(1.0-abs(vQ.y))*(0.45+0.55*(vQ.x*0.5+0.5));
        if(a<0.003) discard;
        float fog=exp(-max(vD-13.0,0.0)*0.045);
        gl_FragColor=vec4(mix(uFogC,uSandC,fog),a*(0.35+0.65*fog));
      }`});
  const streaks=new THREE.Mesh(g,sm);streaks.frustumCulled=false;streaks.renderOrder=9;parent.add(streaks);

  /* — voiles de poussière (nuées douces qui contournent aussi le bloc) — */
  const C=MOBILE?26:60;
  const cg=quad();attrs(cg,C);
  const cm=new THREE.ShaderMaterial({uniforms:FU,transparent:true,depthWrite:false,depthTest:false,
    vertexShader:GLSL_NOISE+FLOW_GLSL+`
      uniform vec3 uCamF;attribute vec4 aR;attribute vec4 aS;
      varying vec2 vQ;varying vec4 vR;varying float vA;varying float vD;
      void main(){
        float spd=0.35+0.45*aR.x;
        float ph=fract(aR.y+uTime*spd/(2.0*uLn));
        float b=0.75+1.8*aR.z;
        vec3 c=flowPos(ph,b,aR.w*6.2831,aS.y,1.4);
        vec4 w=modelMatrix*vec4(c,1.0);
        float size=0.8+2.2*aS.x;
        vec4 mv=viewMatrix*w;
        mv.xy+=position.xy*size*vec2(1.7,0.85);
        gl_Position=projectionMatrix*mv;
        vQ=position.xy;vR=aS;
        // derrière le bloc : presque invisibles (pas de tri de profondeur pour ces voiles)
        vec3 cw=(modelMatrix*vec4(uC,1.0)).xyz;
        vec3 vd=normalize(cw-cameraPosition);vec3 rel=w.xyz-cw;
        float behind=smoothstep(-0.5,1.0,dot(rel,vd));
        float lat=length(rel-vd*dot(rel,vd));
        float R=max(uRad.x,uRad.y);
        float side=smoothstep(R*0.55,R*1.3,lat);
        vA=smoothstep(0.0,0.15,ph)*smoothstep(1.0,0.8,ph)*(1.0-behind*0.8)*side;
        vD=length(w.xyz-cameraPosition);
      }`,
    fragmentShader:"#define RV_FRAG\n"+GLSL_NOISE+`
      uniform float uAlphaC;uniform float uTime;uniform vec3 uFogC;uniform vec3 uSandD;
      varying vec2 vQ;varying vec4 vR;varying float vA;varying float vD;
      void main(){
        float r=length(vQ);
        float n=rvFbm3(vec3(vQ*vec2(1.3,2.4)+vR.zw*40.0+vec2(-uTime*0.12,0.0),uTime*0.1+vR.x*7.0));
        float m=smoothstep(1.0,0.1,r+(n-0.5)*1.0);
        float a=m*(0.035+0.05*vR.w)*vA*uAlphaC;
        if(a<0.002) discard;
        float fog=exp(-max(vD-13.0,0.0)*0.04);
        gl_FragColor=vec4(mix(uFogC,uSandD*mix(0.95,1.08,n),fog),a);
      }`});
  const clouds=new THREE.Mesh(cg,cm);clouds.frustumCulled=false;clouds.renderOrder=10;parent.add(clouds);
  return {streaks,clouds,FU};
}

/* ═══ 18 · Étiquettes façon igloo : texte mono, filets reliés au bloc, décodage ═══ */
function scrambler(el,txt){return {el,txt,start:null,dur:0.5+txt.length*0.025};}
function scrTick(s,T){
  if(s.start===null){s.el.textContent='';return;}
  const p=(T-s.start)/s.dur;
  if(p>=1){if(s.el.textContent!==s.txt)s.el.textContent=s.txt;return;}
  if(p<0){s.el.textContent='';return;}
  let o='';const L=s.txt.length;
  for(let i=0;i<L;i++){const ch=s.txt[i];const lim=p*L*1.3-i;
    if(ch===' '){o+=' ';continue;}
    o+= lim>=L*0.3?ch:(lim>-5?glyph():'');}
  s.el.textContent=o;
}

function buildLabels(subj){
  const wrap=document.createElement('div');wrap.id='ilbl';
  wrap.innerHTML=`
    <svg id="ilbl-svg" aria-hidden="true"><polyline id="ll-tl"/><polyline id="ll-tr"/><polyline id="ll-br"/>
      <circle id="lc-tl" r="1.8"/><circle id="lc-tr" r="1.8"/><circle id="lc-br" r="1.8"/></svg>
    <div class="il il-tl"><p class="il-k"></p><p class="il-t"></p></div>
    <div class="il il-tr"><p><span class="il-s1"></span><b id="il-pct"></b></p><p><span class="il-s2"></span><b id="il-ph"></b></p></div>
    <div class="il il-br"><p class="il-c"></p><p class="il-cta"></p></div>`;
  document.getElementById('hud').appendChild(wrap);
  const $=s=>wrap.querySelector(s);
  const S=[
    scrambler($('.il-k'),'MATIÈRE_'+String(subj.idx).padStart(2,'0')),
    scrambler($('.il-t'),subj.name),
    scrambler($('.il-s1'),'MAÎTRISE'),
    scrambler($('.il-s2'),'FONTE'),
    scrambler($('.il-c'),subj.courses?String(subj.courses).padStart(2,'0')+' COURS · '+String(subj.done).padStart(2,'0')+' VALIDÉS':'COURS À VENIR'),
    scrambler($('.il-cta'),'CLIQUER POUR EXPLORER'),
  ];
  const pctEl=$('#il-pct'),phEl=$('#il-ph');
  const boxes={tl:$('.il-tl'),tr:$('.il-tr'),br:$('.il-br')};
  const lines={tl:$('#ll-tl'),tr:$('#ll-tr'),br:$('#ll-br')},dots={tl:$('#lc-tl'),tr:$('#lc-tr'),br:$('#lc-br')};
  const sm={};let shown=false,showT=0,lastPh=-1,phT=-9;
  function show(T){if(shown)return;shown=true;showT=T;wrap.classList.add('on');S.forEach((s,i)=>{s.start=T+i*0.09;});}
  let cur=subj,ctaT=-9;
  function setSubject(sj,T){
    cur=sj;
    S[0].txt=sj.kicker||('MATIÈRE_'+String(sj.idx).padStart(2,'0'));S[1].txt=sj.name;
    S[4].txt=sj.cTxt||(sj.courses?String(sj.courses).padStart(2,'0')+' COURS · '+String(sj.done).padStart(2,'0')+' VALIDÉS':'COURS À VENIR');
    S[5].txt=sj.cta||'CLIQUER POUR EXPLORER';S[3].txt=sj.phaseKey||'FONTE';S[2].txt=sj.s1||'MAÎTRISE';
    S.forEach((s,i)=>{s.dur=0.5+s.txt.length*0.025;s.start=T+i*0.07;});lastPh=-1;
    const only=sj.only||['tl','tr','br'];['tl','tr','br'].forEach(k=>{const on=only.includes(k);boxes[k].style.display=on?'':'none';lines[k].style.display=dots[k].style.display=on?'':'none';});
  }
  function flashCTA(T,txt){S[5].txt=txt;S[5].dur=0.5+txt.length*0.02;S[5].start=T;ctaT=T;}
  function setVisible(v){wrap.style.opacity=String(v);wrap.style.visibility=v<0.01?'hidden':'visible';}
  function rescramble(T,which){which.forEach(i=>{S[i].start=T;});}
  const lerpK=(k,v,a)=>{sm[k]=sm[k]===undefined?v:sm[k]+(v-sm[k])*a;return sm[k];};
  function update(T,dt,rect,anc,m,phase){
    if(ctaT>0&&T-ctaT>2.6){ctaT=-9;S[5].txt=cur.cta||'CLIQUER POUR EXPLORER';S[5].start=T;}
    S.forEach(s=>scrTick(s,T));
    if(!shown) return;
    // valeurs vivantes
    pctEl.textContent=(m*100).toFixed(1).replace('.',',').padStart(5,'0')+' %';
    const ph=(cur.phases||PHASES)[phase];
    if(phase!==lastPh){lastPh=phase;phT=T;}
    const pTxt=cur.phaseTxt||(ph.id+' / IV · '+ph.name);
    const pp=clamp01((T-phT)/0.6);
    phEl.textContent=pp<1?pTxt.split('').map((c,i)=>c===' '||i<pp*pTxt.length*1.2-3?c:glyph()).join(''):pTxt;
    // placement autour du rectangle écran du bloc
    const a=Math.min(1,dt*6);
    const w=rect.x1-rect.x0,h=rect.y1-rect.y0;
    const M=18;
    const tlW=boxes.tl.offsetWidth,tlH=boxes.tl.offsetHeight,trW=boxes.tr.offsetWidth,brW=boxes.br.offsetWidth,brH=boxes.br.offsetHeight;
    let tlx=lerpK('tlx',Math.max(M,rect.x0-w*0.30),a),tly=lerpK('tly',Math.max(M+80,rect.y0-tlH*0.2),a);
    let trx=lerpK('trx',Math.min(VW-trW-M,rect.x1-w*0.04),a),try_=lerpK('try',rect.y0+h*0.16,a);
    let brx=lerpK('brx',Math.min(VW-brW-M,rect.x1-brW*0.62+w*0.12),a),bry=lerpK('bry',Math.min(VH-brH-M-50,rect.y1-h*0.30),a);
    boxes.tl.style.transform=`translate(${tlx}px,${tly}px)`;
    boxes.tr.style.transform=`translate(${trx}px,${try_}px)`;
    boxes.br.style.transform=`translate(${brx}px,${bry}px)`;
    // filets : soulignement + diagonale vers le point d'accroche
    const u1y=tly+tlH+6,u1x0=tlx,u1x1=tlx+Math.max(tlW*0.72,90);
    lines.tl.setAttribute('points',`${u1x0},${u1y} ${u1x1},${u1y} ${anc.tl.x},${anc.tl.y}`);
    const u2x=trx-4,u2y=try_+boxes.tr.offsetHeight+3;
    lines.tr.setAttribute('points',`${u2x+22},${u2y} ${u2x},${u2y} ${anc.tr.x},${anc.tr.y}`);
    const u3y=bry+brH+6,u3x1=brx+brW,u3x0=brx-6;
    lines.br.setAttribute('points',`${u3x1},${u3y} ${u3x0},${u3y} ${anc.br.x},${anc.br.y}`);
    for(const k of ['tl','tr','br']){dots[k].setAttribute('cx',anc[k].x);dots[k].setAttribute('cy',anc[k].y);}
  }
  return {show,update,rescramble,setSubject,setVisible,flashCTA,el:wrap,S};
}

/* Panneau de simulation (mode test uniquement) */
function buildDevPanel(onSet){
  const d=document.createElement('div');d.id='dev';
  d.innerHTML=`<p class="dv-k">// Simulation · maîtrise de la matière affichée</p>
    <div class="dv-row"><input id="dv-r" type="range" min="0" max="100" step="0.5" value="0" aria-label="Maîtrise simulée"><b id="dv-v">000 %</b></div>
    <div class="dv-ph">${['0','I','II','III','IV'].map((p,i)=>`<button type="button" data-m="${[0,15,40,65,100][i]}">${p}</button>`).join('')}</div>`;
  document.getElementById('hud').appendChild(d);
  const r=d.querySelector('#dv-r'),v=d.querySelector('#dv-v');
  const set=(x,silent)=>{r.value=x;v.textContent=String(Math.round(x)).padStart(3,'0')+' %';d.querySelectorAll('button').forEach(b=>b.classList.toggle('on',+b.dataset.m===+x));if(!silent)onSet(x/100);};
  r.addEventListener('input',()=>set(+r.value));
  d.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>set(+b.dataset.m)));
  window.addEventListener('keydown',e=>{const i='01234'.indexOf(e.key);if(i>=0)set([0,15,40,65,100][i]);});
  return {set};
}

/* ═══ 19 · Le portail : un torii de pierre moussue qui s'assemble, s'illumine, se traverse ═══
   Les pierres (socle, bases, tambours des piliers, nuki, gakuzuka et sa plaque gravée, kasagi aux
   extrémités relevées) flottent éparpillées dans l'espace d'ambre ; elles viennent se caler une à
   une, de bas en haut. Puis la plaque s'éclaire, un voile de lumière emplit la porte, des lucioles
   y sont aspirées — on la traverse. Mousse sur les dessus, lichens, coulures sombres, lianes.
   Même interface que l'ancien portail : {group, update(dt,T,asm,ign,vis), GU, glowL}. */

/* pierre moussue : granit gris-vert, mousse sur les dessus et dans les creux, lichens, coulures */
function matToriiStone(){
  return patch(new THREE.MeshStandardMaterial({color:new THREE.Color('#ffffff'),roughness:0.9,metalness:0,envMapIntensity:0.7}),{
    vHead:'varying vec3 vRvL;',vMain:'vRvL=transformed;',
    fHead:'varying vec3 vRvL;float rvMs=0.0;',
    fColor:`
      vec3 q=vRvW*0.9;
      float n1=rvFbm(q*0.8);
      vec3 st=mix(vec3(0.26,0.27,0.25),vec3(0.50,0.50,0.46),n1);
      st*=1.0-smoothstep(0.6,0.85,rvFbm3(q*2.2))*0.3;                 // creux sombres
      st*=1.0-smoothstep(0.55,0.8,rvNoise(vec3(q.x*2.0,q.y*0.35,q.z*2.0)))*0.22*smoothstep(0.3,-0.2,vRvN.y);   // coulures
      // mousse : sur les dessus, et en plaques sur les faces (plus dense en bas)
      float up=smoothstep(0.15,0.75,vRvN.y);
      rvMs=clamp(up*smoothstep(0.32,0.6,rvFbm3(q*1.6+3.0))+smoothstep(0.62,0.82,rvFbm3(q*1.2+9.0))*0.7,0.0,1.0);
      vec3 moss=mix(vec3(0.13,0.22,0.05),vec3(0.30,0.40,0.10),rvFbm3(q*6.0))*mix(0.8,1.1,rvNoise(q*30.0));
      st=mix(st,moss,rvMs);
      // lichens : taches pâles
      float li=smoothstep(0.78,0.86,rvNoise(q*3.5+7.0))*(1.0-rvMs);
      st=mix(st,vec3(0.62,0.62,0.48),li*0.7);
      diffuseColor.rgb=st;`,
    fRough:`roughnessFactor=mix(0.86,0.98,rvMs);`,
    fNormal:`
      vec3 q2=vRvW*0.9;
      float hb=rvFbm(q2*1.4)*0.1+rvFbm3(q2*4.6)*0.04+rvNoise(q2*17.0)*0.012-smoothstep(0.6,0.85,rvFbm3(q2*2.2))*0.06+rvMs*rvNoise(q2*40.0)*0.02;
      normal=rvPerturb(-vViewPosition,normal,hb,1.0);`,
  },'toriistone');
}
/* plaque (gaku) : signes gravés (deux caractères anciens, usés), qui s'éclairent à l'embrasement */
function matToriiPlaque(GU){
  return patch(new THREE.MeshStandardMaterial({color:new THREE.Color('#ffffff'),roughness:0.85,metalness:0}),{
    uniforms:{uIgn:GU.uIgn},
    vHead:'varying vec3 vRvL;',vMain:'vRvL=transformed;',
    fHead:`varying vec3 vRvL;uniform float uIgn;float rvGl=0.0;
      float rvSeg(vec2 p,vec2 a,vec2 b){vec2 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0);return length(pa-ba*h);}
      float rvGlyph(vec2 q,float id){float d=1.0;
        for(int k=0;k<6;k++){float h1=rvHash(vec3(id,float(k),1.0)),h2=rvHash(vec3(id,float(k),2.0));
          vec2 a=vec2(floor(h1*4.0)/3.0,floor(fract(h1*7.0)*4.0)/3.0)*0.8+0.1;
          vec2 b=vec2(floor(h2*4.0)/3.0,floor(fract(h2*7.0)*4.0)/3.0)*0.8+0.1;
          if(length(a-b)<0.1)b=vec2(0.5);d=min(d,rvSeg(q,a,b));}
        return smoothstep(0.07,0.035,d);}`,
    fColor:`
      vec3 q=vRvW*0.9;float n1=rvFbm(q*0.8);
      vec3 st=mix(vec3(0.30,0.30,0.27),vec3(0.52,0.51,0.46),n1);
      // cadre et deux caractères sur la face avant
      vec2 u=vec2(vRvL.x/0.62+0.5,vRvL.y/0.95+0.5);
      if(vRvL.z>0.05){
        float fr=step(0.06,u.x)*step(u.x,0.94)*step(0.04,u.y)*step(u.y,0.96)*(1.0-step(0.11,u.x)*step(u.x,0.89)*step(0.08,u.y)*step(u.y,0.92));
        vec2 g=vec2((u.x-0.14)/0.72,(u.y-0.1)/0.8);
        if(g.x>0.0&&g.x<1.0&&g.y>0.0&&g.y<1.0){float row=floor(g.y*2.0);rvGl=rvGlyph(vec2(g.x,fract(g.y*2.0)),row+3.0);}
        rvGl=max(rvGl,fr*0.8);
        rvGl*=1.0-smoothstep(0.66,0.85,rvFbm3(q*2.4))*0.6;
      }
      st*=1.0-rvGl*0.55;
      float ms=smoothstep(0.62,0.8,rvFbm3(q*1.3+9.0))*0.6;st=mix(st,vec3(0.16,0.25,0.06),ms);
      diffuseColor.rgb=st;`,
    fNormal:`normal=rvPerturb(-vViewPosition,normal,rvFbm(vRvW*1.3)*0.06+rvNoise(vRvW*15.0)*0.01-rvGl*0.03,1.0);`,
    fEmissive:`totalEmissiveRadiance+=vec3(1.0,0.78,0.45)*rvGl*uIgn*3.2;`,
  },'toriiplaque');
}

/* géométries du torii (repère du portail : la porte est centrée sur l'origine, face +z) */
const TOR={px:2.55,yb:-4.6,yt:2.95,nuki:1.85,kas:3.15};
function toriiPieces(){
  const P=[];   // {g, pos, rot, kind}
  const lean=0.045;   // les piliers penchent légèrement vers l'intérieur
  const drum=(r0,r1,h,seed)=>{const g=new THREE.CylinderGeometry(r1,r0,h,28,3,false);const pa=g.attributes.position;const r=mulberry32(seed);
    for(let i=0;i<pa.count;i++){const x=pa.getX(i),y=pa.getY(i),z=pa.getZ(i);const a=Math.atan2(z,x);const w=1+0.035*Math.sin(a*3+seed)+0.025*(vn3(x*2+seed,y*2,z*2)-0.5);pa.setXYZ(i,x*w,y,z*w);}
    g.computeVertexNormals();return g;};
  // socle flottant : trois dalles irrégulières
  [[-2.4,0.0,3.4],[0.9,0.25,3.0],[3.0,-0.2,2.4]].forEach(([x,z,s],k)=>{const g=new THREE.CylinderGeometry(s*0.55,s*0.5,0.55,9,1);const pa=g.attributes.position;
    for(let i=0;i<pa.count;i++){const X=pa.getX(i),Y=pa.getY(i),Z=pa.getZ(i);const w=1+(vn3(X*0.9+k*3,Y,Z*0.9)-0.5)*0.35;pa.setXYZ(i,X*w,Y+(Y<0?(vn3(X,Z,k)-0.5)*0.4:0),Z*w*0.75);}
    g.computeVertexNormals();P.push({g,pos:new THREE.Vector3(x,TOR.yb-0.55,z),rot:new THREE.Euler(0,k*0.7,0),kind:'stone'});});
  for(const sx of [-1,1]){
    // base (kamebara) bombée
    {const g=latheProfileT([[0,0],[0.72,0],[0.74,0.12],[0.66,0.34],[0.5,0.46],[0,0.48]],28);P.push({g,pos:new THREE.Vector3(sx*TOR.px,TOR.yb-0.28,0),rot:new THREE.Euler(),kind:'stone'});}
    // trois tambours, joints irréguliers
    const H=TOR.yt-TOR.yb+0.2,hs=[0.36,0.33,0.31];let y=TOR.yb+0.2;
    hs.forEach((f,k)=>{const h=H*f;const r0=0.43-0.025*k,r1=0.43-0.025*(k+1);const g=drum(r0,r1,h,11+k*7+(sx>0?40:0));
      const cx=sx*(TOR.px-lean*(y+h/2-TOR.yb));P.push({g,pos:new THREE.Vector3(cx,y+h/2,0),rot:new THREE.Euler(0,0,sx*lean),kind:'stone'});y+=h;});
  }
  // nuki : poutre basse qui dépasse des piliers
  {const g=new RoundedBoxGeometry(7.0,0.38,0.3,2,0.05);P.push({g,pos:new THREE.Vector3(0,TOR.nuki,0),rot:new THREE.Euler(),kind:'stone'});}
  // gakuzuka (montant central) + plaque gravée
  {const g=new RoundedBoxGeometry(0.34,0.95,0.3,2,0.04);P.push({g,pos:new THREE.Vector3(0,(TOR.nuki+TOR.kas)/2+0.02,0),rot:new THREE.Euler(),kind:'stone'});}
  {const g=new RoundedBoxGeometry(0.62,0.95,0.12,2,0.03);P.push({g,pos:new THREE.Vector3(0,(TOR.nuki+TOR.kas)/2+0.06,0.22),rot:new THREE.Euler(-0.06,0,0),kind:'plaque'});}
  // shimaki + kasagi : linteau aux extrémités relevées (sori), un peu plus épais aux bouts
  {const mk=(L,h,d,lift,seg)=>{const g=new THREE.BoxGeometry(L,h,d,seg,2,2);const pa=g.attributes.position;
     for(let i=0;i<pa.count;i++){const x=pa.getX(i),yy=pa.getY(i),z=pa.getZ(i);const t=Math.abs(x)/(L/2);
       const up=lift*Math.pow(t,2.4);const th=1+0.25*Math.pow(t,3);pa.setXYZ(i,x,yy*th+up+(yy>0?0.02*Math.pow(t,6):0),z*(1+0.1*Math.pow(t,3)));}
     g.computeVertexNormals();return g;};
   const g1=mk(7.6,0.3,0.42,0.22,48);const g2=mk(8.6,0.42,0.56,0.42,64);g2.translate(0,0.36,0);
   const g=mergeGeometries([(g1.index?g1.toNonIndexed():g1),(g2.index?g2.toNonIndexed():g2)]);
   P.push({g,pos:new THREE.Vector3(0,TOR.kas,0),rot:new THREE.Euler(),kind:'kasagi'});}
  return P;
}
function latheProfileT(pts,seg){return new THREE.LatheGeometry(pts.map(p=>new THREE.Vector2(p[0],p[1])),seg);}
/* lianes qui pendent du kasagi et du nuki : tiges et petites feuilles */
function toriiVines(seed){
  const r=mulberry32(seed),stems=[],leaves=[];
  const anchors=[[-3.2,0.05],[-2.0,0.05],[1.2,0.05],[2.9,0.05],[3.7,0.15]];
  anchors.forEach(([x,y0],k)=>{const L=1.2+r()*2.6;const pts=[];for(let i=0;i<=10;i++){const u=i/10;pts.push(new THREE.Vector3(x+Math.sin(u*3+k)*0.12,y0-u*L,0.2+Math.sin(u*2.3+k)*0.12+u*0.08));}
    stems.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),20,0.018,5,false));
    for(let i=1;i<=10;i++){const p=pts[i];if(r()<0.35)continue;for(const s of [-1,1]){const lg=new THREE.PlaneGeometry(0.16,0.1);lg.translate(0.08,0,0);lg.rotateZ(s>0?-0.6:Math.PI+0.6);lg.rotateY((r()-0.5)*1.2);lg.translate(p.x,p.y,p.z);leaves.push(lg);}}});
  return {stem:mergeGeometries(stems.map(g=>{g.deleteAttribute('uv');return (g.index?g.toNonIndexed():g);})),leaf:mergeGeometries(leaves.map(g=>{g.deleteAttribute('uv');return (g.index?g.toNonIndexed():g);}))};
}

function buildPortal(parent,opts={}){
  const grp=new THREE.Group();parent.add(grp);
  const stone=matToriiStone();
  const GU={uTime:U.uTime,uN3:U.uN3,uIgn:{value:0},uCol:{value:new THREE.Color('#fff0dc')},uCol2:{value:new THREE.Color('#ffb46a')}};
  const plaqueM=matToriiPlaque(GU);
  const pieces=[];
  // éparpillées dans l'espace, très loin les unes des autres, au départ
  function scatter(u){const d=new THREE.Vector3(rand()*2-1,rand()*2-1,(rand()*2-1)*0.7).normalize();
    u.st=d.multiplyScalar(6.5+rand()*7.5);u.st.z-=2+rand()*3;
    u.q0=new THREE.Quaternion().setFromEuler(new THREE.Euler(rand()*6.28,rand()*6.28,rand()*6.28));
    u.dr=new THREE.Vector3(rand()-0.5,rand()-0.5,rand()-0.5).multiplyScalar(0.6);u.sp=new THREE.Vector3(rand()-0.5,rand()-0.5,rand()-0.5).multiplyScalar(0.5);u.ph=rand()*6.28;}
  const vines=toriiVines(31);
  const vineStemM=new THREE.MeshStandardMaterial({color:new THREE.Color('#3a3a1c'),roughness:0.85});
  const vineLeafM=new THREE.MeshStandardMaterial({color:new THREE.Color('#3f6a1e'),roughness:0.7,side:THREE.DoubleSide});
  toriiPieces().forEach(p=>{
    const m=new THREE.Mesh(p.g,p.kind==='plaque'?plaqueM:stone);m.castShadow=true;m.receiveShadow=true;
    const fin=p.pos.clone();fin.x+=(rand()-0.5)*0.03;fin.z+=(rand()-0.5)*0.05;
    const qf=new THREE.Quaternion().setFromEuler(p.rot).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler((rand()-0.5)*0.03,(rand()-0.5)*0.03,(rand()-0.5)*0.02)));
    m.userData={fin,qf,d:0};scatter(m.userData);pieces.push(m);grp.add(m);
    if(p.kind==='kasagi'){m.add(new THREE.Mesh(vines.stem,vineStemM),new THREE.Mesh(vines.leaf,vineLeafM));}
  });
  // ordre d'arrivée : de bas en haut, avec un peu de désordre
  pieces.forEach(m=>{m.userData.d=clamp01(0.02+(m.userData.fin.y-TOR.yb)/(TOR.kas-TOR.yb+1)*0.5+rand()*0.12);});

  /* — embrasement : lisières lumineuses, voile, halo, lucioles aspirées — */
  const W0=TOR.px-0.43,Y0=TOR.yb+0.2,Y1=TOR.nuki-0.19;   // ouverture : entre les piliers, sous le nuki
  const OW=W0*2,OH=Y1-Y0,OC=new THREE.Vector3(0,(Y0+Y1)/2,0);
  const edgeMat=new THREE.ShaderMaterial({uniforms:GU,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    vertexShader:`varying vec2 vU;void main(){vU=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`uniform float uIgn;uniform float uTime;uniform vec3 uCol;varying vec2 vU;
      void main(){float f=0.7+0.3*sin(vU.y*18.0-uTime*3.0)*sin(vU.y*7.0+uTime*1.7);float e=smoothstep(0.5,0.0,abs(vU.x-0.5));gl_FragColor=vec4(uCol*4.5*uIgn*f*e,1.0);}`});
  const lip=new THREE.Group();
  for(const sx of [-1,1]){const s=new THREE.Mesh(new THREE.PlaneGeometry(0.12,OH),edgeMat);s.position.set(sx*(W0-0.02),OC.y,0.06);lip.add(s);}
  {const s=new THREE.Mesh(new THREE.PlaneGeometry(0.12,OW),edgeMat);s.rotation.z=Math.PI/2;s.position.set(0,Y1-0.02,0.06);lip.add(s);}
  grp.add(lip);
  const disc=new THREE.Mesh(new THREE.PlaneGeometry(OW,OH),new THREE.ShaderMaterial({uniforms:Object.assign({uS:{value:new THREE.Vector2(OW/2,OH/2)}},GU),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
    vertexShader:`varying vec2 vU;void main(){vU=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:"#define RV_FRAG\n"+GLSL_NOISE+`
      uniform float uIgn;uniform float uTime;uniform vec3 uCol;uniform vec3 uCol2;uniform vec2 uS;varying vec2 vU;
      float web(vec2 p){vec2 i=floor(p),f=fract(p);float d1=8.0,d2=8.0;
        for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 o=vec2(float(x),float(y));vec2 r=o+vec2(rvHash(vec3(i+o,1.0)),rvHash(vec3(i+o,2.0)))-f;float d=dot(r,r);if(d<d1){d2=d1;d1=d;}else if(d<d2)d2=d;}
        return smoothstep(0.06,0.0,sqrt(d2)-sqrt(d1));}
      void main(){
        vec2 q=vU/uS;float bx=max(abs(q.x),abs(q.y));float r=length(q*vec2(1.0,0.7));float a=atan(q.y,q.x);
        float rim=smoothstep(0.8,0.97,bx)*smoothstep(1.0,0.96,bx);
        float body=smoothstep(1.0,0.3,bx);
        vec2 sw=vec2(cos(a+uTime*0.35+r*2.5),sin(a+uTime*0.35+r*2.5))*r*3.5;
        float w=web(sw*1.3+uTime*0.05)*smoothstep(0.15,0.6,r);
        float n=rvFbm3(vec3(sw*0.9,uTime*0.3));
        float core=smoothstep(0.35,0.0,r)*(0.6+0.4*n);
        vec3 col=uCol2*body*0.2*(0.6+0.8*n)+uCol*rim*0.7+uCol*w*0.3+uCol*core*1.3;
        gl_FragColor=vec4(col*uIgn,1.0);
      }`}));
  disc.position.copy(OC);disc.position.z=0.02;grp.add(disc);
  const halo=new THREE.Mesh(new THREE.PlaneGeometry(OW+5,OH+5),new THREE.ShaderMaterial({uniforms:Object.assign({uS:{value:new THREE.Vector2(OW/2,OH/2)}},GU),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
    vertexShader:`varying vec2 vU;void main(){vU=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`uniform float uIgn;uniform vec3 uCol2;uniform vec2 uS;varying vec2 vU;void main(){vec2 d=max(abs(vU)-uS,0.0);float e=length(d);float a=exp(-e*e*1.2)*0.45*step(0.001,e)+exp(-e*e*12.0)*0.3;gl_FragColor=vec4(uCol2*a*uIgn,1.0);}`}));
  halo.position.copy(OC);halo.position.z=-0.02;grp.add(halo);
  // lucioles aspirées vers le centre de la porte
  const NS=MOBILE?500:1400;const sg=new THREE.BufferGeometry();const sp=new Float32Array(NS*3),sr=new Float32Array(NS*4);
  for(let i=0;i<NS;i++){sr[i*4]=rand();sr[i*4+1]=rand();sr[i*4+2]=rand();sr[i*4+3]=rand();}
  sg.setAttribute('position',new THREE.BufferAttribute(sp,3));sg.setAttribute('aR',new THREE.BufferAttribute(sr,4));
  const spk=new THREE.Points(sg,new THREE.ShaderMaterial({uniforms:GU,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    vertexShader:`uniform float uTime;uniform float uIgn;attribute vec4 aR;varying float vA;
      void main(){float ph=fract(aR.x+uTime*(0.1+aR.y*0.15));float r=mix(5.2,0.3,ph*ph);float a=aR.z*6.283+ph*(3.0+aR.w*3.0);
        vec3 p=vec3(cos(a)*r*0.8,${OC.y.toFixed(2)}+sin(a)*r,(aR.w-0.5)*1.6*(1.0-ph));vec4 mv=modelViewMatrix*vec4(p,1.0);
        gl_PointSize=(1.2+aR.y*2.2)*${DPR.toFixed(2)}*(20.0/-mv.z);gl_Position=projectionMatrix*mv;vA=uIgn*smoothstep(0.0,0.15,ph)*smoothstep(1.0,0.8,ph)*(0.4+0.6*aR.w);}`,
    fragmentShader:`uniform vec3 uCol2;uniform vec3 uCol;varying float vA;void main(){vec2 c=gl_PointCoord-0.5;float d=dot(c,c);if(d>0.25)discard;gl_FragColor=vec4(mix(uCol2,uCol,0.5)*vA*2.0*(1.0-d*4.0),1.0);}`}));
  spk.frustumCulled=false;grp.add(spk);
  const glowL=new THREE.PointLight(new THREE.Color('#ffc58a'),0,30,1.6);glowL.position.set(0,OC.y,1.2);grp.add(glowL);

  const _q=new THREE.Quaternion(),_ax=new THREE.Vector3(0,0,1);
  const _a=new THREE.Vector3(),_b=new THREE.Vector3(),_s=new THREE.Vector3(),_ctl=new THREE.Vector3(),_rq=new THREE.Quaternion(),_eu=new THREE.Euler();
  function update(dt,T,asm,ign,vis){
    pieces.forEach(m=>{
      const u=m.userData;const k=clamp01((asm-u.d)/0.42);
      const e=k<1?1-Math.pow(1-k,3)+Math.sin(k*Math.PI)*0.05:1;
      // au repos : les pierres dérivent lentement, chacune tourne sur elle-même
      _s.copy(u.st).addScaledVector(u.dr,Math.sin(T*0.13+u.ph)*1.5);
      _ctl.copy(u.fin).lerp(_s,0.55);_ctl.z+=2.2;_ctl.applyAxisAngle(_ax,0.6*(1-e));
      _a.copy(_s).lerp(_ctl,e);_b.copy(_ctl).lerp(u.fin,e);m.position.copy(_a.lerp(_b,e));
      _rq.setFromEuler(_eu.set(u.sp.x*T,u.sp.y*T,u.sp.z*T));
      m.quaternion.copy(_q.copy(u.q0).multiply(_rq).slerp(u.qf,Math.min(1,e)));
      m.visible=vis!==false;
      if(k>=1) m.position.y=u.fin.y+Math.sin(T*0.8+u.d*20.0)*0.015*(1-ign);
    });
    GU.uIgn.value=ign;lip.visible=disc.visible=halo.visible=spk.visible=ign>0.002;glowL.intensity=ign*40;
  }
  return {group:grp,update,GU,glowL};
}

/* ═══ 20 · Monde économie : rizières en terrasses à flanc de montagne, au matin ═══
   Le versant monte vers le nord (−z) ; il est découpé en terrasses qui suivent les courbes de
   niveau : diguettes herbeuses, murets de terre, rizières inondées (miroirs du ciel), jeunes plants
   en rangs, riz mûr. Deux grandes terrasses plates portent le sanctuaire (objet) et les stèles
   (statistiques). Au loin, trois chaînes de montagnes noyées de brume ; cèdres autour du
   sanctuaire ; le torii traversé se dresse plus haut sur le versant.
   Interface conservée : FIN_ORIGIN, FIN_PAL, PLAT, FIN_W, finField(x,z).h, buildFinance(), buildFinEnv(). */
const FIN_ORIGIN=new THREE.Vector3(0,-8000,0);
const FIN_PAL={fog:new THREE.Color('#c4cdcc'),top:new THREE.Color('#7aa2c4'),mid:new THREE.Color('#e2dcc6'),bot:new THREE.Color('#5f6e5a'),glow:new THREE.Color('#ffe0ae')};
const PLAT=[new THREE.Vector3(0,0,0),new THREE.Vector3(34,0,-12)];
const PED_R=1.25,PED_H=0.7;
const FIN_W=new THREE.Vector2(0.94,0.34).normalize();
const FIN_C=new THREE.Vector3(30,0,-10);
const TER={step:1.15,rw:0.24,bw:0.1,water:0.13,bund:0.3,ground:0.3};
const SHRINE_LV=0, STELE_LV=6;   // indices des terrasses plates du sanctuaire et des stèles

/* champ du sol : versant, terrasses, diguettes, eau ; deux aires aplanies */
function finField(x,z){
  // versant : monte vers −z, ondulé de croupes et de vallons
  const zc=z/(1+Math.abs(z)/150),xc=x/(1+Math.abs(x)/220);   // au loin, le versant s'adoucit
  // croupes et ravines : les terrasses suivent des courbes de niveau sinueuses
  const sp=fbm2(x*0.02+1.3,z*0.02+5.1,3);
  let h0=-0.3*zc+0.05*xc+(fbm2(x*0.011+3.1,z*0.011+7.7,4)-0.5)*11.0+Math.sin(x*0.075+sp*3.0)*2.6*(0.6+0.4*Math.sin(z*0.03))+Math.sin(x*0.031-z*0.02+1.0)*2.2;
  // aires plates : sanctuaire (rond, ouvert vers l'avant) et terrasse des stèles (longue)
  const ds=Math.hypot(x,z*0.85-1.5);const ks=1-smooth(9.5,13,ds);
  const wx=Math.max(0,Math.abs(x-74)-21),wz=Math.max(0,Math.abs(z+18)-12);const kw=1-smooth(0,4,Math.hypot(wx,wz));
  h0=lerp(h0,(SHRINE_LV+0.5)*TER.step,ks);h0=lerp(h0,(STELE_LV+0.5)*TER.step,kw);
  // au-delà de ~85 m, les terrasses s'estompent dans le versant boisé
  const far=smooth(78,96,Math.hypot(x-FIN_C.x,z-FIN_C.z));
  const k=Math.floor(h0/TER.step),t=h0/TER.step-k;
  const riser=smooth(1-TER.rw,1,t);
  const bund=t<TER.bw?Math.sin(Math.PI*t/TER.bw):0;
  const flat=Math.max(ks,kw);
  const inner=smooth(TER.bw,TER.bw+0.04,t)*(1-smooth(1-TER.rw-0.03,1-TER.rw,t));
  let h=(k+riser)*TER.step+(inner*TER.water+bund*TER.bund)*(1-flat)+flat*TER.ground;
  h=lerp(h,h0,far);
  // état de la terrasse : 0 miroir · 1 jeunes plants · 2 riz mûr · 3 terre ferme
  const hs=fract1(Math.sin((k+Math.floor(fbm2(x*0.02,z*0.02,2)*3)*17.0)*12.9898)*43758.5453);
  let st=hs<0.6?0:hs<0.85?1:2;if(flat>0.5||far>0.5)st=3;
  return {h,w:inner*(1-flat)*(1-far),k,t,st,riser:smooth(1-TER.rw,1-TER.rw+0.05,t)*(1-flat),bund:bund*(1-flat)};
}
function fract1(v){return v-Math.floor(v);}
/* grille du sol (terrasses) : calculée d'avance dans le fil du relief (voir 03_jungle, terrainStart),
   pendant le chargement de la jungle — mêmes positions que PlaneGeometry + rotateX + translate, au bit près
   (vérifié à l'usage : au moindre écart, on recalcule sur place) */
const FINPRE={p:null,r:null};
const finGridParams=()=>({RES:MOBILE?280:520,SIZE:180,HR:256,HE:90});
function finGridCompute(G){
  const RES=G.RES,SIZE=G.SIZE,n=(RES+1)*(RES+1),X=new Float32Array(n),Z=new Float32Array(n);
  const h=new Float64Array(n),w=new Float64Array(n),st=new Float64Array(n),t=new Float64Array(n),rb=new Float64Array(n);
  const wh=SIZE/2,hh=SIZE/2,gx=Math.floor(RES),gy=Math.floor(RES),sw=SIZE/gx,sh=SIZE/gy;
  const c=Math.cos(-Math.PI/2),s=Math.sin(-Math.PI/2);
  let k=0;
  for(let iy=0;iy<gy+1;iy++){const y=iy*sh-hh;for(let ix=0;ix<gx+1;ix++){const x=ix*sw-wh;
    let px=Math.fround(x),py=Math.fround(-y),pz=0;
    {const W=1/(0*px+0*py+0*pz+1);const nx=(1*px+0*py+0*pz+0)*W,ny=(0*px+c*py+(-s)*pz+0)*W,nz=(0*px+s*py+c*pz+0)*W;px=Math.fround(nx);py=Math.fround(ny);pz=Math.fround(nz);}
    {const W=1/(0*px+0*py+0*pz+1);const nx=(1*px+0*py+0*pz+FIN_C.x)*W,ny=(0*px+1*py+0*pz+0)*W,nz=(0*px+0*py+1*pz+FIN_C.z)*W;px=Math.fround(nx);py=Math.fround(ny);pz=Math.fround(nz);}
    X[k]=px;Z[k]=pz;const f=finField(px,pz);h[k]=f.h;w[k]=f.w;st[k]=f.st;t[k]=f.t;rb[k]=f.riser+f.bund*2.0;k++;}}
  const Hm=new Float64Array(G.HR*G.HR);
  for(let j=0;j<G.HR;j++)for(let i=0;i<G.HR;i++){Hm[j*G.HR+i]=finField(FIN_C.x+(i/(G.HR-1)*2-1)*G.HE,FIN_C.z+(j/(G.HR-1)*2-1)*G.HE).h;}
  return {RES,X,Z,h,w,st,t,rb,Hm};
}

function buildFinance(){
  const root=new THREE.Group();root.position.copy(FIN_ORIGIN);scene.add(root);
  /* ciel du matin : dégradé, halo du soleil, longues nappes de nuages */
  const SUNV=new THREE.Vector3(-0.62,0.4,0.67).normalize();
  const bgU={uTime:U.uTime,uN3:U.uN3,uTop:{value:FIN_PAL.top},uMid:{value:FIN_PAL.mid},uBot:{value:FIN_PAL.bot},uGlow:{value:FIN_PAL.glow},uGlowDir:{value:SUNV.clone()}};
  const bg=new THREE.Mesh(new THREE.SphereGeometry(500,48,24),new THREE.ShaderMaterial({uniforms:bgU,depthWrite:false,depthTest:false,side:THREE.BackSide,
    vertexShader:`varying vec3 vDir;void main(){vDir=normalize(position);vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.0);gl_Position=p.xyww;}`,
    fragmentShader:"#define RV_FRAG\n"+GLSL_NOISE+`
      uniform float uTime;uniform vec3 uTop;uniform vec3 uMid;uniform vec3 uBot;uniform vec3 uGlow;uniform vec3 uGlowDir;varying vec3 vDir;
      void main(){vec3 d=normalize(vDir);
        vec3 col=d.y>0.0?mix(uMid,uTop,smoothstep(0.02,0.6,d.y)):mix(uMid,uBot,smoothstep(0.0,-0.3,d.y));
        float g=max(dot(d,uGlowDir),0.0);col=mix(col,uGlow,pow(g,5.0)*0.45+pow(g,60.0)*0.4);
        float cl=smoothstep(0.5,0.75,rvFbm3(vec3(d.x*2.2,d.y*9.0,d.z*2.2)+vec3(uTime*0.006,0.0,uTime*0.004)))*smoothstep(0.02,0.12,d.y)*smoothstep(0.45,0.15,d.y);
        col=mix(col,mix(uMid,vec3(1.0,0.96,0.9),0.6),cl*0.45);
        gl_FragColor=vec4(col,1.0);}`}));
  bg.frustumCulled=false;bg.renderOrder=-20;scene.add(bg);

  /* lumière : soleil du matin, doux, de trois quarts arrière gauche */
  const sunF=new THREE.DirectionalLight(new THREE.Color('#ffdcae'),3.1);
  sunF.castShadow=true;sunF.shadow.radius=2.4;sunF.shadow.mapSize.set(MOBILE?1024:2048,MOBILE?1024:2048);
  const sc=sunF.shadow.camera;sc.left=-18;sc.right=18;sc.top=18;sc.bottom=-18;sc.near=1;sc.far=110;sunF.shadow.bias=-0.0005;sunF.shadow.normalBias=0.03;
  root.add(sunF);root.add(sunF.target);
  const hemiF=new THREE.HemisphereLight(new THREE.Color('#cfd9e0'),new THREE.Color('#4c5a3a'),0.45);root.add(hemiF);

  /* sol en terrasses : maillage déplacé sur CPU (eau, état, position dans la terrasse) */
  const SIZE=180,RES=MOBILE?280:520;
  const g=new THREE.PlaneGeometry(SIZE,SIZE,RES,RES);g.rotateX(-Math.PI/2);g.translate(FIN_C.x,0,FIN_C.z);
  const pa=g.attributes.position,aW=new Float32Array(pa.count),aSt=new Float32Array(pa.count),aT=new Float32Array(pa.count*2);
  const pre=FINPRE.r&&FINPRE.r.RES===RES&&FINPRE.r.X.length===pa.count?FINPRE.r:null;let usePre=!!pre;
  if(usePre)for(let i=0;i<pa.count;i++){if(pa.getX(i)!==pre.X[i]||pa.getZ(i)!==pre.Z[i]){usePre=false;console.warn('grille finance : recalcul');break;}}
  if(usePre){for(let i=0;i<pa.count;i++){pa.setY(i,pre.h[i]);aW[i]=pre.w[i];aSt[i]=pre.st[i];aT[i*2]=pre.t[i];aT[i*2+1]=pre.rb[i];}}
  else for(let i=0;i<pa.count;i++){const f=finField(pa.getX(i),pa.getZ(i));pa.setY(i,f.h);aW[i]=f.w;aSt[i]=f.st;aT[i*2]=f.t;aT[i*2+1]=f.riser+f.bund*2.0;}
  g.setAttribute('aW',new THREE.BufferAttribute(aW,1));g.setAttribute('aSt',new THREE.BufferAttribute(aSt,1));g.setAttribute('aT',new THREE.BufferAttribute(aT,2));g.computeVertexNormals();
  const floorMat=patch(new THREE.MeshStandardMaterial({color:new THREE.Color('#ffffff'),roughness:0.9,metalness:0,envMapIntensity:1.0}),{
    vHead:'attribute float aW;attribute float aSt;attribute vec2 aT;varying float vRvWa;varying float vRvSt;varying vec2 vRvT;',vMain:'vRvWa=aW;vRvSt=aSt;vRvT=aT;',
    fHead:'varying float vRvWa;varying float vRvSt;varying vec2 vRvT;float rvWet=0.0;float rvRice=0.0;',
    fColor:`
      vec2 p=vRvW.xz;
      float st=floor(vRvSt+0.5);
      float wtr=smoothstep(0.35,0.75,vRvWa);
      // murets (terre et pierres sèches), diguettes herbeuses
      float ris=clamp(vRvT.y,0.0,1.0),bnd=clamp(vRvT.y-1.0,0.0,1.0);
      vec3 earth=mix(vec3(0.22,0.16,0.1),vec3(0.36,0.27,0.16),rvFbm3(vec3(p*0.7,1.0)));
      // murets : talus d'herbe sur terre, quelques pierres apparentes
      vec3 slopeG=mix(vec3(0.14,0.24,0.06),vec3(0.28,0.38,0.1),rvFbm3(vec3(p*1.1,vRvW.y*1.5)))*mix(0.75,1.05,rvNoise(vec3(p*7.0,vRvW.y*6.0)));
      vec3 wall=mix(slopeG,earth,smoothstep(0.55,0.8,rvFbm3(vec3(p*0.9,vRvW.y*2.0+4.0)))*0.7);
      wall=mix(wall,vec3(0.4,0.39,0.35),smoothstep(0.78,0.9,rvNoise(vec3(p*3.0,vRvW.y*4.0)))*0.5);
      vec3 grass=mix(vec3(0.17,0.27,0.07),vec3(0.36,0.45,0.13),rvFbm3(vec3(p*1.3,3.0)))*mix(0.8,1.1,rvNoise(vec3(p*9.0,2.0)));
      vec3 c=mix(grass,wall,smoothstep(0.25,0.75,ris)*(1.0-smoothstep(0.75,0.9,vRvN.y)));
      // rizière : eau sombre (le reflet vient de l'environnement), jeunes plants en rangs, riz mûr
      vec3 water=vec3(0.66,0.74,0.77);   // miroir : couleur du reflet (métal), teinte d'eau claire
      float rows=smoothstep(0.5,0.8,sin(vRvT.x*170.0))*smoothstep(0.35,0.7,rvNoise(vec3(p*2.2,7.0)));
      vec3 young=mix(vec3(0.22,0.42,0.08),vec3(0.42,0.6,0.14),rvNoise(vec3(p*5.0,1.0)));
      vec3 mature=mix(vec3(0.42,0.5,0.14),vec3(0.66,0.6,0.24),rvFbm3(vec3(p*0.6,4.0)))*mix(0.85,1.08,rvNoise(vec3(p*12.0,5.0)));
      vec3 paddy=water;rvRice=0.0;
      if(st<0.5){paddy=water;}
      else if(st<1.5){rvRice=rows*0.55;paddy=mix(water,young,rvRice);}
      else if(st<2.5){rvRice=0.92;paddy=mature;}
      else{paddy=grass;}
      rvWet=wtr*(1.0-rvRice)*step(st,1.5);
      c=mix(c,paddy,wtr);
      // terres fermes (aires plates) : herbe rase, terre battue
      if(st>2.5&&wtr<0.5)c=mix(grass,earth,smoothstep(0.55,0.75,rvFbm3(vec3(p*0.25,9.0)))*0.55);
      diffuseColor.rgb=c;`,
    fRough:`roughnessFactor=mix(0.9,0.035,rvWet);`,
    fNormal:`
      vec2 q=vRvW.xz;
      float rip=sin(dot(q,vec2(0.8,0.6))*9.0+uTime*1.6+rvNoise(vec3(q*0.6,uTime*0.2))*4.0)*0.5+0.5;
      float hw=rip*0.004+rvNoise(vec3(q*6.0,uTime*0.5))*0.002;
      float hg=rvFbm3(vec3(q*2.0,1.0))*0.05+rvNoise(vec3(q*14.0,2.0))*0.01+rvRice*rvNoise(vec3(q*30.0,3.0))*0.03;
      normal=rvPerturb(-vViewPosition,normal,mix(hg,hw,rvWet),1.0);`,
    reps:[['#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nmetalnessFactor=rvWet*0.92;']],
  },'finterrace');
  const floor=new THREE.Mesh(g,floorMat);floor.receiveShadow=true;root.add(floor);
  // versant lointain (boisé) jusqu'aux montagnes
  {const fg=new THREE.RingGeometry(86,700,160,40);fg.rotateX(-Math.PI/2);fg.translate(FIN_C.x,0,FIN_C.z);const fp=fg.attributes.position;
   for(let i=0;i<fp.count;i++){const x=fp.getX(i),z=fp.getZ(i);fp.setY(i,finField(x,z).h-0.4);}
   fg.computeVertexNormals();
   const farM=patch(new THREE.MeshStandardMaterial({color:new THREE.Color('#ffffff'),roughness:0.95}),{
     fColor:`vec2 p=vRvW.xz;float n=rvFbm3(vec3(p*0.05,1.0));diffuseColor.rgb=mix(vec3(0.1,0.17,0.07),vec3(0.24,0.32,0.12),n)*mix(0.75,1.1,rvNoise(vec3(p*0.4,2.0)));`},'finfar');
   const farG=new THREE.Mesh(fg,farM);farG.receiveShadow=true;root.add(farG);}
  // trois chaînes de montagnes, de plus en plus pâles dans la brume
  {const mtM=patch(new THREE.MeshStandardMaterial({color:new THREE.Color('#ffffff'),roughness:1,envMapIntensity:0.3}),{
     fColor:`float n=rvFbm3(vRvW*0.012);diffuseColor.rgb=mix(vec3(0.12,0.18,0.12),vec3(0.26,0.32,0.22),n)*mix(0.8,1.1,rvNoise(vRvW*0.05));`},'finmount');
   [[260,90,1.0,3],[400,150,1.0,11],[620,240,1.0,23]].forEach(([R,H,_,seed])=>{const NA=240,NY=14;const pos=[],idx=[];
     for(let j=0;j<=NY;j++)for(let i=0;i<=NA;i++){const a=i/NA*Math.PI*2;const v=j/NY;
       const prof=H*(0.35+0.65*fbm2(Math.cos(a)*3+seed,Math.sin(a)*3+seed*0.7,5))*(0.75+0.5*Math.pow(fbm2(a*4.0,seed,3),2));
       const rr=R*(1-0.18*v)+(fbm2(a*6+seed,v*2,3)-0.5)*R*0.08;pos.push(FIN_C.x+Math.cos(a)*rr,-40+v*(prof+40)*(1-0.06*Math.sin(v*3)),FIN_C.z+Math.sin(a)*rr);}
     for(let j=0;j<NY;j++)for(let i=0;i<NA;i++){const a=j*(NA+1)+i,b=a+1,c=a+NA+1,d=c+1;idx.push(a,c,b,b,c,d);}
     const mg=new THREE.BufferGeometry();mg.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));mg.setIndex(idx);mg.computeVertexNormals();
     const m=new THREE.Mesh(mg,mtM);m.frustumCulled=false;root.add(m);});}

  /* plants de riz (premier plan) : touffes en rangs sur les terrasses de jeunes plants et de riz mûr */
  {const NR=MOBILE?5000:16000;const tg=(()=>{const parts=[];for(let k=0;k<3;k++){const b=new THREE.PlaneGeometry(0.05,0.34,1,3);const bp=b.attributes.position;
       for(let i=0;i<bp.count;i++){const y=bp.getY(i)+0.17;bp.setX(i,bp.getX(i)*(1-y/0.4));bp.setZ(i,y*y*0.5);bp.setY(i,y);}
       b.rotateY(k*2.09);b.deleteAttribute('uv');parts.push((b.index?b.toNonIndexed():b));}return mergeGeometries(parts);})();
   const tm=patch(new THREE.MeshStandardMaterial({color:new THREE.Color('#ffffff'),roughness:0.7,side:THREE.DoubleSide}),{
     vHead:'uniform float uTime;',vBegin:'transformed.x+=sin(uTime*1.3+instanceMatrix[3].x*0.7+instanceMatrix[3].z*0.5)*0.03*position.y*3.0;',
     fColor:'diffuseColor.rgb*=vec3(0.95,1.0,0.85);'},'finrice');
   const im=new THREE.InstancedMesh(tg,tm,NR);const m4=new THREE.Matrix4(),q=new THREE.Quaternion(),s=new THREE.Vector3(),pv=new THREE.Vector3();const col=new THREE.Color();
   const r=mulberry32(808);let n=0;
   for(let t=0;t<NR*8&&n<NR;t++){const x=-30+r()*125,z=-55+r()*75;const f=finField(x,z);if(f.w<0.8||f.st<0.5||f.st>2.5)continue;
     const near=Math.min(Math.hypot(x,z),Math.hypot(x-74,z+18));if(near>48&&r()<0.75)continue;
     const mature=f.st>1.5;const sc=mature?1.6+r()*0.6:0.8+r()*0.5;
     q.setFromAxisAngle(new THREE.Vector3(0,1,0),r()*6.28);m4.compose(pv.set(x,f.h-0.02,z),q,s.set(sc,sc*(mature?1.4:1),sc));im.setMatrixAt(n,m4);
     col.setRGB(mature?0.7+r()*0.15:0.32,mature?0.66:0.6+r()*0.15,mature?0.26:0.12);im.setColorAt(n,col);n++;}
   im.count=n;im.receiveShadow=true;im.frustumCulled=false;root.add(im);}

  /* cèdres autour du sanctuaire et sur les croupes */
  {const trunkM=patch(new THREE.MeshStandardMaterial({color:new THREE.Color('#4a3524'),roughness:0.9}),{},'fincedar_t');
   const needleM=patch(new THREE.MeshStandardMaterial({color:new THREE.Color('#ffffff'),roughness:0.85}),{
     fColor:`diffuseColor.rgb=mix(vec3(0.05,0.11,0.06),vec3(0.13,0.22,0.1),rvFbm3(vRvW*1.4))*mix(0.75,1.1,rvNoise(vRvW*6.0));`,
     fNormal:`normal=rvPerturb(-vViewPosition,normal,rvNoise(vRvW*5.0)*0.12,1.0);`},'fincedar_n');
   const tiers=[],trunks=[];const r=mulberry32(919);
   const spots=[[-10.5,-9],[11,-8.5],[-7,-14],[6,-15],[-17,1],[17,-1],[40,-40],[46,-44],[52,-38],[97,-30],[101,-23],[-20,-30],[-26,-22]];
   spots.forEach(([x,z])=>{const gy=finField(x,z).h;const H=11+r()*7;
     const tr=new THREE.CylinderGeometry(0.22,0.38,H*0.5,8);tr.translate(x,gy+H*0.25,z);trunks.push(tr);
     for(let k=0;k<5;k++){const u=k/5;const rr=(1-u)*H*0.2+0.5;const c=new THREE.ConeGeometry(rr,H*0.32,12,3);const cp=c.attributes.position;
       for(let i=0;i<cp.count;i++){const w=1+(vn3(cp.getX(i)*1.5+x,cp.getY(i)*1.5,cp.getZ(i)*1.5+z)-0.5)*0.4;cp.setX(i,cp.getX(i)*w);cp.setZ(i,cp.getZ(i)*w);}
       c.translate(x,gy+H*(0.3+u*0.62),z);tiers.push(c);}});
   const tm=new THREE.Mesh(mergeGeometries(trunks.map(g=>{g.deleteAttribute('uv');return (g.index?g.toNonIndexed():g);})),trunkM);tm.castShadow=true;root.add(tm);
   const nm=new THREE.Mesh(mergeGeometries(tiers.map(g=>{g.deleteAttribute('uv');return (g.index?g.toNonIndexed():g);})),needleM);nm.castShadow=true;nm.receiveShadow=true;root.add(nm);}

  // hauteur pour les voiles de brume
  const HR=256,HE=90;const hd=new Uint16Array(HR*HR);
  const preH=usePre&&HR===256&&HE===90?pre.Hm:null;
  for(let j=0;j<HR;j++)for(let i=0;i<HR;i++){const x=FIN_C.x+(i/(HR-1)*2-1)*HE,z=FIN_C.z+(j/(HR-1)*2-1)*HE;hd[j*HR+i]=THREE.DataUtils.toHalfFloat(preH?preH[j*HR+i]:finField(x,z).h);}
  const heightTex=new THREE.DataTexture(hd,HR,HR,THREE.RedFormat,THREE.HalfFloatType);heightTex.minFilter=heightTex.magFilter=THREE.LinearFilter;heightTex.needsUpdate=true;

  /* socle de l'objet (dans le sanctuaire) : table d'offrandes en bois sur dalle de pierre */
  const pedMat=patch(new THREE.MeshStandardMaterial({color:new THREE.Color('#ffffff'),roughness:0.6,metalness:0,envMapIntensity:0.8}),{
    vHead:'varying vec3 vRvL;',vMain:'vRvL=transformed;',fHead:'varying vec3 vRvL;',
    fColor:`float gr=sin(vRvL.x*40.0+rvFbm3(vRvL*vec3(3.0,0.5,3.0))*8.0)*0.5+0.5;diffuseColor.rgb=mix(vec3(0.20,0.11,0.06),vec3(0.36,0.22,0.12),gr*0.6+0.2*rvNoise(vRvL*30.0));`,
    fRough:`roughnessFactor=0.45+0.2*rvNoise(vRvL*20.0);`},'finped');
  const SHF=SHRINE_LV*TER.step+TER.ground+0.55;   // sol du sanctuaire
  const plats=PLAT.slice(0,FIN_SUBJECTS.length).map((P,i)=>{
    const pg=[];const box=(w,h,d,y)=>{const b=new RoundedBoxGeometry(w,h,d,2,0.03);b.translate(0,y,0);pg.push(b);};
    box(2.6,0.1,2.6,0.05);box(2.2,0.4,2.2,0.3);box(2.6,0.1,2.6,0.55);for(const sx of [-1,1])for(const sz of [-1,1]){const l=new RoundedBoxGeometry(0.14,0.5,0.14,1,0.02);l.translate(sx*1.0,0.3,sz*1.0);pg.push(l);}
    box(2.8,0.08,2.8,PED_H-0.04);
    const m=new THREE.Mesh(mergeGeometries(pg.map(g=>(g.index?g.toNonIndexed():g))),pedMat);m.position.set(P.x,SHF,P.z);m.castShadow=true;m.receiveShadow=true;root.add(m);
    return {P,ped:m,top:SHF+PED_H};
  });

  /* voiles de brume au ras des terrasses */
  const cenW=FIN_C.clone().add(FIN_ORIGIN);
  const wind=buildWind(heightTex,HE,{center:cenW,speed:0.6,parent:root,lift:0.7});

  /* textes flous (vocabulaire de l'économie) */
  const words=['OFFRE','DEMANDE','P.I.B.','INFLATION','ÉLASTICITÉ','COÛT MARGINAL','SMITH 1776','KEYNES','UTILITÉ','MONNAIE'];
  const texts=[];
  words.forEach((w,i)=>{
    const cv=document.createElement('canvas');cv.width=1024;cv.height=256;const cx=cv.getContext('2d');
    cx.font='700 120px "JetBrains Mono", ui-monospace, monospace';cx.textBaseline='middle';cx.shadowColor='rgba(255,250,238,1)';cx.shadowBlur=16+rand()*18;cx.shadowOffsetX=2048;cx.fillStyle='#000';cx.fillText(w,40-2048,128);
    const tex=new THREE.CanvasTexture(cv);tex.colorSpace=THREE.SRGBColorSpace;
    const m=new THREE.Mesh(new THREE.PlaneGeometry(10,2.5),new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,opacity:0.035+rand()*0.03,fog:false}));
    const P=i%2?new THREE.Vector3(74,0,-18):PLAT[0];const ang=rand()*Math.PI*2;m.position.set(P.x+Math.cos(ang)*(26+rand()*20),8+rand()*10,P.z+Math.sin(ang)*(26+rand()*20));
    m.renderOrder=-5;root.add(m);texts.push(m);
  });

  /* le torii traversé : plus haut sur le versant, à droite du sanctuaire, tourné vers lui */
  const portalHi=buildPortal(root);
  {const az=-0.36,dir=new THREE.Vector3(Math.sin(az),0,Math.cos(az)),perp=new THREE.Vector3(dir.z,0,-dir.x);
   const tp=PLAT[0].clone().addScaledVector(dir,-17).addScaledVector(perp,12);const gy=finField(tp.x,tp.z).h;
   portalHi.group.position.set(tp.x,gy-(TOR.yb-0.55)-0.25,tp.z);portalHi.group.rotation.y=Math.atan2(PLAT[0].x-tp.x,PLAT[0].z-tp.z);}
  portalHi.update(0,0,1,0.25);

  return {root,bg,bgU,sun:sunF,hemi:hemiF,SUNV,plats,wind,floorMat,texts,portalHi,shrineFloor:SHF,
    update(dt,T,cam,focus){
      bg.position.copy(cam.position);
      texts.forEach(m=>m.quaternion.copy(cam.quaternion));
      // l'ombre suit ce qu'on regarde
      sunF.target.position.copy(focus);sunF.position.copy(focus).addScaledVector(SUNV,50);
      portalHi.update(dt,T,1,0.22+0.05*Math.sin(T*1.3));
      wind.streakU.uRes.value.set(VW*renderer.getPixelRatio(),VH*renderer.getPixelRatio());
    }};
}

/* Environnement du matin (reflets de l'eau des rizières, du laiton, de l'or) */
function buildFinEnv(){
  const pm=new THREE.PMREMGenerator(renderer);const es=new THREE.Scene();
  es.add(new THREE.Mesh(new THREE.SphereGeometry(50,48,24),new THREE.ShaderMaterial({side:THREE.BackSide,
    uniforms:{uTop:{value:new THREE.Color('#6f9ac0')},uMid:{value:new THREE.Color('#d8d6c8')},uBot:{value:new THREE.Color('#3c4634')}},
    vertexShader:`varying vec3 vD;void main(){vD=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`uniform vec3 uTop;uniform vec3 uMid;uniform vec3 uBot;varying vec3 vD;void main(){vec3 d=normalize(vD);vec3 c=d.y>0.0?mix(uMid,uTop,smoothstep(0.0,0.7,d.y)):mix(uMid,uBot,smoothstep(0.0,-0.25,d.y));gl_FragColor=vec4(c,1.0);}`})));
  const panel=(w,h,col,k,pos)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color(col).multiplyScalar(k),side:THREE.DoubleSide}));m.position.copy(pos);m.lookAt(0,0,0);es.add(m);};
  panel(14,8,'#fff1d8',7.0,new THREE.Vector3(-30,22,32));    // soleil du matin
  panel(40,40,'#eef0ea',1.2,new THREE.Vector3(0,46,0));
  // crêtes sombres à l'horizon : les rizières y reflètent des montagnes
  for(let k=0;k<10;k++){const a=k/10*Math.PI*2;panel(18,5,'#3a4a3a',0.8,new THREE.Vector3(Math.cos(a)*44,3,Math.sin(a)*44));}
  const tex=pm.fromScene(es,0.02).texture;pm.dispose();return tex;
}

/* ═══ 21 · Droit des affaires : mallette en cuir + contrat scellé ═══
   Mallette cognac à coutures, poignée cintrée, fermoirs et coins en laiton ; contrat
   « CONTRAT DE CESSION » appuyé contre elle, ruban et sceau de cire rouge.
   Toute la géométrie est cuite dans le repère de l'objet (base en y = 0). */
function contractTexture(){
  const W=512,H=704,cv=document.createElement('canvas');cv.width=W;cv.height=H;const c=cv.getContext('2d');
  c.fillStyle='#f1e8d6';c.fillRect(0,0,W,H);
  c.fillStyle='#2b241d';c.textAlign='center';
  c.font='700 30px "JetBrains Mono", ui-monospace, monospace';c.fillText('CONTRAT DE CESSION',W/2,72);
  c.font='400 15px "JetBrains Mono", ui-monospace, monospace';c.fillText('DE PARTS SOCIALES',W/2,100);
  c.fillRect(W*0.3,116,W*0.4,1.5);
  c.font='700 13px "JetBrains Mono", ui-monospace, monospace';c.textAlign='left';c.fillText('ENTRE LES SOUSSIGNÉS :',48,150);
  let y=176;const r=mulberry32(77);
  for(let i=0;i<24;i++){const w=W-96-(i%6===5?r()*180+80:r()*30);c.fillStyle='rgba(43,36,29,'+(0.38+r()*0.2)+')';c.fillRect(48,y,w,5);y+=i%6===5?26:16;}
  c.fillStyle='#2b241d';c.font='700 12px "JetBrains Mono", ui-monospace, monospace';c.fillText('ARTICLE 1 — OBJET',48,y+10);
  y+=30;for(let i=0;i<5;i++){c.fillStyle='rgba(43,36,29,0.45)';c.fillRect(48,y,W-96-r()*60,5);y+=16;}
  c.strokeStyle='#1d2a4a';c.lineWidth=2;c.beginPath();c.moveTo(70,H-70);for(let k=0;k<40;k++)c.lineTo(70+k*4.5,H-70-Math.sin(k*0.9)*10-k*0.3);c.stroke();
  c.beginPath();c.moveTo(300,H-66);for(let k=0;k<36;k++)c.lineTo(300+k*4.6,H-66-Math.cos(k*1.1)*9);c.stroke();
  const t=new THREE.CanvasTexture(cv);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;
}

function affairesParts(){
  const P={leather:[],leatherD:[],brass:[],paper:[],wax:[]};
  const rb=(w,h,d,s,r,x,y,z)=>{const g=new RoundedBoxGeometry(w,h,d,s,r);g.translate(x,y,z);return g;};
  // corps + couvercle
  P.leather.push(rb(2.3,1.55,0.56,5,0.09,0,0.775,0));
  P.leatherD.push(rb(2.33,0.055,0.59,2,0.022,0,1.36,0));
  // coutures : fins boudins le long des arêtes frontales
  [[-1,0.42],[1,0.42]].forEach(([sd])=>{const g=new THREE.CylinderGeometry(0.012,0.012,1.3,6);g.translate(sd*1.105,0.7,0.255);P.leatherD.push(g);});
  // poignée cintrée + attaches
  {const cur=new THREE.CatmullRomCurve3([new THREE.Vector3(-0.36,1.58,0),new THREE.Vector3(-0.38,1.80,0),new THREE.Vector3(0,1.9,0),new THREE.Vector3(0.38,1.80,0),new THREE.Vector3(0.36,1.58,0)]);
    const g=new THREE.TubeGeometry(cur,48,0.055,14,false);P.leatherD.push(g);}
  [-0.36,0.36].forEach(x=>P.brass.push(rb(0.17,0.07,0.13,2,0.02,x,1.585,0)));
  // fermoirs
  [-0.72,0.72].forEach(x=>{P.brass.push(rb(0.25,0.17,0.05,2,0.015,x,1.36,0.29));
    const b=new THREE.CylinderGeometry(0.032,0.032,0.03,20);b.rotateX(Math.PI/2);b.translate(x,1.335,0.325);P.brass.push(b);});
  // coins et pieds
  [-1,1].forEach(sx=>{P.brass.push(rb(0.13,0.13,0.6,2,0.03,sx*1.1,0.06,0),rb(0.13,0.13,0.6,2,0.03,sx*1.1,1.49,0));
    [-1,1].forEach(sz=>{const f=new THREE.CylinderGeometry(0.045,0.05,0.035,16);f.translate(sx*0.9,-0.012,sz*0.19);P.brass.push(f);});});
  // contrat appuyé contre la face avant
  const M=new THREE.Matrix4().compose(new THREE.Vector3(0.48,0.78,0.43),new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.17,-0.14,0.05)),new THREE.Vector3(1,1,1));
  for(let k=0;k<3;k++){const g=new THREE.BoxGeometry(1.04,1.45,0.006);g.translate(k*0.012,-k*0.01,-k*0.008);g.applyMatrix4(M);P.paper.push(g);}
  {const g=new THREE.BoxGeometry(0.075,1.62,0.004);g.rotateZ(0.62);g.translate(0.02,-0.05,0.006);g.applyMatrix4(M);P.wax.push(g);}
  {const sp=[[0,0]];for(let i=0;i<=12;i++){const t=i/12;sp.push([0.115+0.025*Math.sin(t*Math.PI),t*0.035]);}sp.push([0,0.035]);
    const g=latheProfile(sp,40);const pa=g.attributes.position;for(let i=0;i<pa.count;i++){const x=pa.getX(i),z=pa.getZ(i),a=Math.atan2(z,x);const f=1+0.06*Math.sin(a*5)+0.03*Math.sin(a*11);pa.setX(i,x*f);pa.setZ(i,z*f);}g.computeVertexNormals();
    g.rotateX(Math.PI/2);g.translate(0.3,-0.48,0.01);g.applyMatrix4(M);P.wax.push(g);
    const e=new THREE.TorusGeometry(0.07,0.008,8,32);e.translate(0.3,-0.48,0.047);e.applyMatrix4(M);P.wax.push(e);}
  return P;
}

function buildAffaires(){
  const grp=new THREE.Group();
  const wetU={uObjWet:{value:0},uSolid:{value:0},uEdgeCol:{value:new THREE.Color('#ffb070')}};
  const leather=matLeather(wetU,true,'#6a3a1d'),leatherD=matLeather(wetU,true,'#3d2213'),brass=matBrass(wetU,true);
  const paper=matPaper(wetU,contractTexture()),wax=matWax(wetU);
  const P=affairesParts();
  const cols={leather:'#7a4524',leatherD:'#4a2a17',brass:'#c8994f',paper:'#efe6d4',wax:'#8e1b14'};
  const mats={leather,leatherD,brass,paper,wax};
  for(const k in P) P[k].forEach(g=>{const m=new THREE.Mesh(g,mats[k]);m.castShadow=true;m.userData.pcol=new THREE.Color(cols[k]);grp.add(m);});
  const A={tl:new THREE.Vector3(-1.15,1.55,0.28),tr:new THREE.Vector3(0.3,1.9,0),br:new THREE.Vector3(1.0,0.2,0.48)};
  return {group:grp,wetU,anchorsL:A,height:1.92};
}

/* ═══ 22 · Analyse financière : graphique en chandeliers ═══
   Sculpture de bureau : socle d'ardoise polie, grille de fils de laiton, onze chandeliers
   en verre teinté (émeraude en hausse, rubis en baisse) traversés de mèches en laiton,
   moyenne mobile en fil d'or. Base en y = 0. */
const CHART_DATA=[[0.10,0.18,0.05,0.22],[0.18,0.13,0.09,0.24],[0.13,0.27,0.11,0.31],[0.27,0.36,0.23,0.42],[0.36,0.30,0.26,0.40],
  [0.30,0.45,0.28,0.50],[0.45,0.58,0.41,0.63],[0.58,0.51,0.46,0.62],[0.51,0.70,0.49,0.75],[0.70,0.84,0.66,0.90],[0.84,0.95,0.80,1.0]];
function chartParts(){
  const P={slate:[],brass:[],up:[],down:[]};
  const B0=0.2,Y0=0.5,H=2.3,X0=-1.4,DX=0.28;
  {const g=new RoundedBoxGeometry(3.3,0.2,1.2,3,0.04);g.translate(0,0.1,0);P.slate.push(g);}
  {const g=new RoundedBoxGeometry(3.32,0.025,0.03,1,0.01);g.translate(0,B0+0.012,0.585);P.brass.push(g);}
  // grille de fond
  for(let i=0;i<7;i++){const x=-1.5+i*0.5;const g=new THREE.CylinderGeometry(0.006,0.006,H+0.5,6);g.translate(x,B0+(H+0.5)/2,-0.42);P.brass.push(g);}
  for(let j=0;j<6;j++){const y=Y0+j*H/5;const g=new THREE.CylinderGeometry(0.006,0.006,3.0,6);g.rotateZ(Math.PI/2);g.translate(0,y,-0.42);P.brass.push(g);}
  [-1.5,1.5].forEach(x=>{const g=new THREE.CylinderGeometry(0.02,0.026,H+0.55,12);g.translate(x,B0+(H+0.55)/2,-0.42);P.brass.push(g);});
  // chandeliers
  const ma=[];
  CHART_DATA.forEach(([o,c,l,h],i)=>{
    const x=X0+i*DX,lo=Y0+Math.min(o,c)*H,hi=Y0+Math.max(o,c)*H;const bh=Math.max(0.05,hi-lo);
    const g=new RoundedBoxGeometry(0.2,bh,0.2,2,Math.min(0.022,bh*0.3));g.translate(x,lo+bh/2,0);(c>=o?P.up:P.down).push(g);
    const w=new THREE.CylinderGeometry(0.011,0.011,(h-l)*H,8);w.translate(x,Y0+(l+h)/2*H,0);P.brass.push(w);
    ma.push(new THREE.Vector3(x,Y0+((i>0?CHART_DATA[i-1][1]:c)+c+(i<CHART_DATA.length-1?CHART_DATA[i+1][1]:c))/3*H,0.16));
  });
  {const g=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ma),120,0.014,8,false);P.brass.push(g);}
  return P;
}
function buildChart(){
  const grp=new THREE.Group();
  const wetU={uObjWet:{value:0},uSolid:{value:0},uEdgeCol:{value:new THREE.Color('#ffb070')}};
  const mats={slate:matSlate(wetU),brass:matBrass(wetU,true),up:matGlass(wetU,'#d9f2e4','#1f9a5c'),down:matGlass(wetU,'#f6dcd8','#b42a22')};
  const cols={slate:'#2c2523',brass:'#c8994f',up:'#2fa86a',down:'#c0392b'};
  const P=chartParts();
  for(const k in P) P[k].forEach(g=>{const m=new THREE.Mesh(g,mats[k]);m.castShadow=k!=='up'&&k!=='down';m.userData.pcol=new THREE.Color(cols[k]);grp.add(m);});
  const A={tl:new THREE.Vector3(-1.5,2.9,-0.42),tr:new THREE.Vector3(1.4,2.75,0),br:new THREE.Vector3(1.55,0.12,0.6)};
  return {group:grp,wetU,anchorsL:A,height:3.0};
}

/* ═══ 22b · Économie : la balance du changeur et les pièces ═══
   Comptoir de changeur japonais : coffret de bois laqué à tiroir et coins de laiton ; balance à fléau
   en laiton sur sa colonne, deux plateaux suspendus à des chaînettes — dans l'un trois koban (pièces
   d'or ovales), dans l'autre un poids fundō en forme de sablier ; à côté, une pile de koban et un
   chapelet de mon (pièces de bronze percées d'un trou carré) enfilées sur une cordelette.
   Formé à l'encre : chaque matériau se dissout avec un liseré de lavis sombre (uSolid).
   Base en y = 0, hauteur ≈ 2,9. */
function matInk(wetU,o){   // matériau d'objet « à l'encre » : dissolution bordée de lavis ; uWash → sculpture de lavis monochrome
  const m=new THREE.MeshStandardMaterial({color:new THREE.Color(o.col),metalness:o.metal||0,roughness:o.rough||0.5,envMapIntensity:o.env||1.0});
  return patch(m,{uniforms:wetU,vHead:'varying vec3 vRvL;',vMain:'vRvL=transformed;',fHead:'varying vec3 vRvL;uniform float uWash;'+(o.fHead||''),
    fColor:(o.fColor||'')+`
      {float rvIe=smoothstep(uSolid*1.04-0.16,uSolid*1.04-0.02,rvDn)*step(0.002,uSolid)*(1.0-step(0.985,uSolid));
       diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.035,0.03,0.03),rvIe*0.92);
       // lavis (sumi-e) : valeurs de gris tirées de la couleur, papier dans les clairs, encre aux contours
       if(uWash>0.001){float L=dot(diffuseColor.rgb,vec3(0.3,0.59,0.11));
         vec3 nv=normalize(vNormal);float nov=abs(dot(nv,normalize(vViewPosition)));
         float gr=rvNoise(vRvL*vec3(9.0,30.0,9.0))*0.5+rvNoise(vRvL*60.0)*0.5;
         float tone=clamp(0.16+L*1.25+(gr-0.5)*0.12,0.06,0.82);
         vec3 wash=mix(vec3(0.05,0.045,0.045),vec3(0.86,0.83,0.77),tone);
         wash*=mix(0.12,1.0,smoothstep(0.05,0.42,nov));            // contour à l'encre
         diffuseColor.rgb=mix(diffuseColor.rgb,wash,uWash);}}`,
    fRough:(o.fRough||'')+`roughnessFactor=mix(roughnessFactor,0.92,uWash);`,
    reps:[['#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\n metalnessFactor=mix(metalnessFactor,0.0,uWash);']],
    dissolve:true},'ink_'+o.key);
}
function changeurParts(){
  /* quatre ensembles : le socle (coffret, colonne, pile de koban, chapelet de mon), le fléau (qui oscille
     autour de son axe) et les deux plateaux suspendus (qui restent d'aplomb au bout du fléau).
     Fléau et plateaux sont donnés dans le repère de leur pivot. */
  const mk=()=>({wood:[],brass:[],gold:[],bronze:[],cord:[],chain:[]});
  const P=mk(),PB=mk(),PL=mk(),PR=mk();
  const rb=(list,w,h,d,x,y,z,r)=>{const g=new RoundedBoxGeometry(w,h,d,2,r||0.02);g.translate(x,y,z);list.push(g);};
  const lathe=(pts,seg)=>new THREE.LatheGeometry(pts.map(p=>new THREE.Vector2(p[0],p[1])),seg);
  // coffret laqué + tiroir, pieds, coins de laiton
  rb(P.wood,2.3,0.42,1.15,0,0.27,0,0.03);rb(P.wood,2.36,0.06,1.2,0,0.5,0,0.02);
  for(const sx of [-1,1])for(const sz of [-1,1]){rb(P.wood,0.16,0.08,0.16,sx*1.05,0.04,sz*0.47,0.02);
    rb(P.brass,0.12,0.44,0.03,sx*1.13,0.27,sz*0.585,0.008);}
  rb(P.wood,1.0,0.22,0.03,0.45,0.25,0.585,0.01);
  {const g=new THREE.TorusGeometry(0.05,0.012,8,20,Math.PI);g.rotateZ(Math.PI);g.translate(0.45,0.25,0.62);P.brass.push(g);}
  // balance : socle tourné, colonne, couronnement
  const bx=-0.4,y0=0.53;
  P.brass.push(lathe([[0,0],[0.26,0],[0.27,0.03],[0.2,0.06],[0.12,0.1],[0.07,0.14],[0,0.14]],40).translate(bx,y0,0));
  {const g=new THREE.CylinderGeometry(0.045,0.055,1.85,20);g.translate(bx,y0+0.14+0.925,0);P.brass.push(g);}
  const yt=y0+2.02;
  P.brass.push(lathe([[0,0],[0.08,0],[0.09,0.04],[0.06,0.1],[0.03,0.14],[0,0.15]],24).translate(bx,yt-0.1,0));
  // fléau (repère du pivot : axe en (bx, yt+0.06, 0)), aiguille, boutons
  const piv=new THREE.Vector3(bx,yt+0.06,0);
  {const g=new RoundedBoxGeometry(1.94,0.07,0.07,2,0.02);PB.brass.push(g);
   const n=new THREE.ConeGeometry(0.025,0.42,8);n.translate(0,0.24,0);PB.brass.push(n);
   const ax=new THREE.CylinderGeometry(0.03,0.03,0.16,12);ax.rotateX(Math.PI/2);PB.brass.push(ax);
   for(const sx of [-1,1]){const k=new THREE.SphereGeometry(0.05,12,8);k.translate(sx*0.97,0,0);PB.brass.push(k);
     const h=new THREE.TorusGeometry(0.035,0.009,6,14);h.translate(sx*0.95,-0.05,0);PB.brass.push(h);}}
  // plateaux (repère : point d'accroche au bout du fléau), trois chaînettes chacun
  const hang=[];
  for(const [sx,L] of [[-1,PL],[1,PR]]){const hx=sx*0.95,hy=-0.04;   // accroche, relative au pivot
    const py=(yt-0.98)-(piv.y+hy);                                   // fond du plateau, relatif à l'accroche
    L.brass.push(lathe([[0,0],[0.3,0.0],[0.34,0.04],[0.35,0.07],[0.33,0.075],[0.3,0.035],[0,0.03]],40).translate(0,py,0));
    for(let k=0;k<3;k++){const a=k/3*Math.PI*2+0.3;const A=new THREE.Vector3(0,0,0),B=new THREE.Vector3(Math.cos(a)*0.31,py+0.07,Math.sin(a)*0.31);
      const d=B.clone().sub(A),Ln=d.length();const g=new THREE.CylinderGeometry(0.007,0.007,Ln,5);g.translate(0,Ln/2,0);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()));L.chain.push(g);}
    hang.push({x:hx,y:hy,py});}
  // koban : ovales d'or martelés
  const koban=(list,x,y,z,ry,rz)=>{const g=new THREE.CylinderGeometry(1,1,0.028,40);g.scale(0.17,1,0.105);g.rotateZ(rz||0);g.rotateY(ry||0);g.translate(x,y,z);list.push(g);};
  for(let k=0;k<3;k++)koban(PL.gold,(k-1)*0.03,hang[0].py+0.06+k*0.03,0.02*k,k*0.5,0.05);
  // fundō : poids en sablier dans l'autre plateau
  PR.brass.push(lathe([[0,0],[0.16,0],[0.17,0.04],[0.11,0.12],[0.07,0.17],[0.11,0.22],[0.16,0.3],[0.15,0.34],[0,0.34]],32).translate(0,hang[1].py+0.04,0));
  // pile de koban sur le coffret, quelques-uns appuyés contre
  for(let k=0;k<11;k++)koban(P.gold,0.72+Math.sin(k*2.3)*0.02,0.55+k*0.03,0.12+Math.cos(k*1.7)*0.02,k*0.37);
  koban(P.gold,0.98,0.68,0.12,0.2,1.15);koban(P.gold,0.5,0.62,-0.05,-0.6,-0.9);
  // chapelet de mon : pièces percées d'un trou carré, enfilées sur une cordelette qui serpente
  {const sh=new THREE.Shape();sh.absarc(0,0,0.085,0,Math.PI*2,false);const hole=new THREE.Path();hole.moveTo(-0.022,-0.022);hole.lineTo(0.022,-0.022);hole.lineTo(0.022,0.022);hole.lineTo(-0.022,0.022);hole.lineTo(-0.022,-0.022);sh.holes.push(hole);
   const mg=new THREE.ExtrudeGeometry(sh,{depth:0.014,bevelEnabled:true,bevelThickness:0.003,bevelSize:0.004,bevelSegments:1,curveSegments:24});mg.translate(0,0,-0.007);
   const pts=[];for(let k=0;k<=30;k++){const u=k/30;pts.push(new THREE.Vector3(-0.95+u*1.15,0.62+Math.sin(u*Math.PI)*0.02,0.38-Math.sin(u*Math.PI*1.6)*0.14));}
   const c=new THREE.CatmullRomCurve3(pts);
   for(let k=0;k<26;k++){const u=0.03+k/26*0.94;const p=c.getPoint(u),tg=c.getTangent(u);const g=mg.clone();
     g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),tg));g.translate(p.x,p.y+0.04,p.z);P.bronze.push(g);}
   P.cord.push(new THREE.TubeGeometry(c,60,0.012,6,false).translate(0,0.04,0));
   const t=lathe([[0,0],[0.03,0.01],[0.045,0.06],[0.04,0.12],[0.015,0.14],[0,0.15]],12);t.rotateZ(Math.PI/2);t.translate(-0.95,0.66,0.38);P.cord.push(t);}
  return {P,PB,PL,PR,piv,hang};
}
function buildChangeur(){
  const grp=new THREE.Group();
  const wetU={uObjWet:{value:0},uSolid:{value:0},uEdgeCol:{value:new THREE.Color('#000000')},uWash:{value:1}};
  const mats={
    wood:matInk(wetU,{key:'wood',col:'#3a1810',rough:0.35,env:0.9,
      fColor:`float gr=sin(vRvL.x*28.0+rvFbm3(vRvL*vec3(2.0,0.4,2.0))*6.0)*0.5+0.5;diffuseColor.rgb*=mix(0.75,1.15,gr*0.5+0.5*rvNoise(vRvL*20.0));`,fRough:`roughnessFactor=0.28+0.15*rvNoise(vRvL*25.0);`}),
    brass:matInk(wetU,{key:'brass',col:'#c99a4e',metal:1,rough:0.3,env:1.3,fColor:`diffuseColor.rgb*=mix(0.82,1.05,rvFbm3(vRvL*4.0));diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(0.55,0.45,0.32),smoothstep(0.55,0.85,rvFbm3(vRvL*9.0+3.0))*0.45);`}),
    gold:matInk(wetU,{key:'gold',col:'#e6b54e',metal:1,rough:0.24,env:1.4,fColor:`float hm=sin(vRvL.x*140.0+sin(vRvL.z*40.0)*2.0)*0.5+0.5;diffuseColor.rgb*=mix(0.9,1.05,hm);`}),
    bronze:matInk(wetU,{key:'bronze',col:'#7a5a30',metal:0.85,rough:0.45,fColor:`diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.28,0.42,0.32),smoothstep(0.5,0.8,rvFbm3(vRvL*14.0))*0.55);`}),
    cord:matInk(wetU,{key:'cord',col:'#8a2a1c',rough:0.85}),
    chain:matInk(wetU,{key:'chain',col:'#b88c48',metal:1,rough:0.35}),
  };
  const cols={wood:'#3a1810',brass:'#c99a4e',gold:'#e6b54e',bronze:'#7a5a30',cord:'#8a2a1c',chain:'#b88c48'};
  const S=changeurParts();
  const fill=(set,parent)=>{for(const k in set){if(!set[k].length)continue;const g=rvMerge(set[k]);const m=new THREE.Mesh(g,mats[k]);m.castShadow=true;m.receiveShadow=true;m.userData.pcol=new THREE.Color(cols[k]);parent.add(m);}};
  fill(S.P,grp);
  const beam=new THREE.Group();beam.position.copy(S.piv);grp.add(beam);fill(S.PB,beam);
  const pans=S.hang.map((h,i)=>{const g=new THREE.Group();g.position.set(S.piv.x+h.x,S.piv.y+h.y,0);grp.add(g);fill(i?S.PR:S.PL,g);return g;});
  /* oscillation du fléau : les plateaux suivent le bout du fléau et restent d'aplomb (légère traîne) */
  const _h=new THREE.Vector3();
  function setBeam(a,sw){beam.rotation.z=a;
    S.hang.forEach((h,i)=>{_h.set(h.x,h.y,0).applyAxisAngle(new THREE.Vector3(0,0,1),a);pans[i].position.set(S.piv.x+_h.x,S.piv.y+_h.y,0);pans[i].rotation.z=-(sw||0)*0.6;});}
  const A={tl:new THREE.Vector3(-1.45,2.6,0),tr:new THREE.Vector3(0.75,2.75,0),br:new THREE.Vector3(1.15,0.3,0.6)};
  return {group:grp,wetU,anchorsL:A,height:2.9,setBeam};
}

/* ═══ 23 · Sculptures de sable : l'objet se forme grain à grain, puis se solidifie ═══
   Comme les sculptures de particules d'igloo : un nuage tourbillonnant converge sur la
   surface de l'objet ; puis, là où le bruit de dissolution passe sous le seuil, le vrai
   matériau apparaît et les grains s'effacent — exactement aux mêmes endroits.
   Une fraction des grains s'envole en permanence dans le vent fort. */
function buildSandForm(obj,count){
  // triangles de l'objet (géométrie cuite dans son repère), pondérés par l'aire
  const tris=[];let total=0;
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),ab=new THREE.Vector3(),ac=new THREE.Vector3(),n=new THREE.Vector3();
  obj.group.children.forEach(m=>{
    if(!m.isMesh) return;const g=m.geometry.index?m.geometry.toNonIndexed():m.geometry;const pa=g.attributes.position;const col=m.userData.pcol||new THREE.Color('#d9a066');
    for(let i=0;i<pa.count;i+=3){a.fromBufferAttribute(pa,i);b.fromBufferAttribute(pa,i+1);c.fromBufferAttribute(pa,i+2);
      ab.subVectors(b,a);ac.subVectors(c,a);n.crossVectors(ab,ac);const ar=n.length()*0.5;if(ar<1e-7)continue;n.normalize();
      total+=ar;tris.push({a:a.clone(),b:b.clone(),c:c.clone(),n:n.clone(),col,cum:total});}
  });
  const N=count;
  const pos=new Float32Array(N*3),nor=new Float32Array(N*3),col=new Float32Array(N*3),rnd=new Float32Array(N*4);
  const sand=new THREE.Color('#d9a066');
  for(let i=0;i<N;i++){
    const r=rand()*total;let lo=0,hi=tris.length-1;while(lo<hi){const mid=(lo+hi)>>1;if(tris[mid].cum<r)lo=mid+1;else hi=mid;}
    const t=tris[lo];let u=rand(),v=rand();if(u+v>1){u=1-u;v=1-v;}
    const p=t.a.clone().addScaledVector(ab.subVectors(t.b,t.a),u).addScaledVector(ac.subVectors(t.c,t.a),v);
    pos.set([p.x,p.y,p.z],i*3);nor.set([t.n.x,t.n.y,t.n.z],i*3);
    const cc=t.col.clone().lerp(sand,0.5);col.set([cc.r,cc.g,cc.b],i*3);
    rnd.set([rand(),rand(),rand(),rand()],i*4);
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('aN',new THREE.BufferAttribute(nor,3));
  g.setAttribute('aC',new THREE.BufferAttribute(col,3));g.setAttribute('aR',new THREE.BufferAttribute(rnd,4));
  const box=new THREE.Box3().setFromBufferAttribute(g.attributes.position);const ctr=box.getCenter(new THREE.Vector3());
  const SU={uTime:U.uTime,uN3:U.uN3,uForm:{value:0},uSolid:obj.wetU.uSolid,uShed:{value:0.05},uCenter:{value:ctr},uW:{value:new THREE.Vector3(1,0,0)},
    uSize:{value:30*DPR},uLight:{value:new THREE.Vector3(-0.5,0.7,0.5).normalize()},uFogColor:U.uFogColor,uFogDensity:U.uFogDensity,uHot:{value:0}};
  const mat=new THREE.ShaderMaterial({uniforms:SU,
    vertexShader:GLSL_NOISE+`
      uniform float uTime;uniform float uForm;uniform float uSolid;uniform float uShed;uniform float uSize;uniform vec3 uCenter;uniform vec3 uW;
      attribute vec3 aN;attribute vec3 aC;attribute vec4 aR;
      varying vec3 vC;varying float vA;varying vec3 vN;varying vec3 vW;varying float vFl;varying float vArr;
      void main(){
        float arr=smoothstep(aR.x*0.6,aR.x*0.6+0.4,uForm);
        float ang=aR.y*6.2832+uTime*(0.25+aR.z*0.45);
        float rad=0.2+pow(aR.z,1.8)*1.0;
        vec3 cloud=uCenter+vec3(cos(ang)*rad,(aR.w-0.5)*2.0*(1.0-aR.z*0.45)+sin(uTime*0.6+aR.y*11.0)*0.2,sin(ang)*rad*0.75);
        cloud+=uW*sin(uTime*0.35+aR.x*6.0)*0.8;
        vec3 p=mix(cloud,position+aN*0.006,arr);
        float sel=step(1.0-uShed,fract(aR.w*7.31+aR.x*3.17));
        float ph=fract(aR.z*13.1+uTime*(0.22+aR.y*0.3));
        float fl=smoothstep(0.0,0.6,ph)*(1.0-step(0.6,ph))*sel*arr;
        vec3 tq=p*1.6+vec3(0.0,uTime*0.5,-uTime*0.4);
        vec3 turb=vec3(rvNoise(tq),rvNoise(tq+11.0),rvNoise(tq+23.0))-0.5;
        p+=uW*fl*fl*5.5+turb*fl*1.4+vec3(0.0,-0.45*fl*fl,0.0);
        float nz=rvNoise(position*2.6)*0.65+rvNoise(position*7.0+3.1)*0.35;
        float onSurf=smoothstep(uSolid*1.04-0.02,uSolid*1.04+0.05,nz);
        vA=fl>0.0?(1.0-smoothstep(0.3,0.6,ph)):onSurf;
        vFl=fl;vArr=arr;
        vec4 w=modelMatrix*vec4(p,1.0);vW=w.xyz;
        vec4 mv=viewMatrix*w;
        gl_Position=projectionMatrix*mv;
        gl_PointSize=uSize*(0.65+aR.y*0.7)/max(-mv.z,0.5);
        vN=normalize(mat3(modelMatrix)*aN);
        vC=aC*(0.8+0.35*aR.w);
      }`,
    fragmentShader:`
      uniform vec3 uLight;uniform vec3 uFogColor;uniform float uFogDensity;uniform float uHot;
      varying vec3 vC;varying float vA;varying vec3 vN;varying vec3 vW;varying float vFl;varying float vArr;
      void main(){
        vec2 c=gl_PointCoord-0.5;float d=dot(c,c);if(d>0.25)discard;
        float h=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);
        if(h>vA)discard;
        float lam=max(dot(normalize(vN),uLight),0.0)*0.75+0.28;
        float grain=0.72+0.4*sqrt(max(0.0,1.0-d*4.0));
        vec3 V=normalize(cameraPosition-vW);float rim=pow(max(1.0-max(dot(normalize(vN),V),0.0),0.0),3.0);
        vec3 col=vC*mix(lam,1.0,vFl*0.6)*grain*1.45*(1.0+uHot)+vC*rim*0.35;
        col=mix(col,vec3(1.0,0.88,0.72)*1.05,(1.0-vArr)*0.5);
        float dist=length(vW-cameraPosition);float fog=1.0-exp(-dist*uFogDensity);
        gl_FragColor=vec4(mix(col,uFogColor,fog),1.0);
      }`});
  const pts=new THREE.Points(g,mat);pts.frustumCulled=false;obj.group.add(pts);
  return {points:pts,SU,center:ctr,box};
}

/* ═══ 23b · Formation à l'encre (L1, économie) ═══
   L'objet est d'abord dessiné dans l'air, comme au pinceau (sumi-e) : chaque arête vive devient un
   trait d'encre noire, posé du bas vers le haut (le tracé avance le long de chaque trait), avec la
   pression qui varie, le grain d'un pinceau sec et des bords effrangés. Puis la matière apparaît
   (dissolution bordée d'un lavis sombre, dans les matériaux de l'objet) et l'encre s'efface.
   Même interface que les sculptures de sable : {points, SU, center, box}. */
function buildInkForm(obj){
  obj.group.updateMatrixWorld(true);
  const inv=new THREE.Matrix4().copy(obj.group.matrixWorld).invert();
  const segs=[];const a=new THREE.Vector3(),b=new THREE.Vector3();const box=new THREE.Box3();
  let mi=0;
  obj.group.traverse(m=>{
    if(!m.isMesh||!m.geometry||!m.geometry.attributes.position)return;
    const eg=new THREE.EdgesGeometry(m.geometry,26);const pa=eg.attributes.position;
    const M=new THREE.Matrix4().multiplyMatrices(inv,m.matrixWorld);
    for(let i=0;i<pa.count;i+=2){a.fromBufferAttribute(pa,i).applyMatrix4(M);b.fromBufferAttribute(pa,i+1).applyMatrix4(M);
      const L2=a.distanceToSquared(b);if(L2<1e-8)continue;
      if(L2<0.0009&&((i*0.6180339)%1)<0.55)continue;   // les détails minuscules (pièces percées, chaînettes) : un trait sur deux, sinon une tache d'encre
      segs.push([a.clone(),b.clone(),mi]);box.expandByPoint(a);box.expandByPoint(b);}
    mi++;eg.dispose();
  });
  const H=Math.max(0.01,box.max.y-box.min.y);
  const N=segs.length;
  const pA=new Float32Array(N*4*3),pB=new Float32Array(N*4*3),aS=new Float32Array(N*4*2),aO=new Float32Array(N*4*2),idx=new Uint32Array(N*6);
  const r=mulberry32(N*7+3);
  segs.forEach(([A,B,m],i)=>{
    // ordre du tracé : du bas vers le haut, objet par objet, avec la main qui hésite un peu
    const y=(Math.min(A.y,B.y)-box.min.y)/H;const o=Math.min(0.97,y*0.72+((m*0.618)%1)*0.18+r()*0.08);const sd=r();
    for(let k=0;k<4;k++){const j=i*4+k;pA.set([A.x,A.y,A.z],j*3);pB.set([B.x,B.y,B.z],j*3);aS.set([k<2?0:1,k%2?1:-1],j*2);aO.set([o,sd],j*2);}
    const q=i*4;idx.set([q,q+1,q+2,q+1,q+3,q+2],i*6);
  });
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.BufferAttribute(pA,3));g.setAttribute('aB',new THREE.BufferAttribute(pB,3));
  g.setAttribute('aS',new THREE.BufferAttribute(aS,2));g.setAttribute('aO',new THREE.BufferAttribute(aO,2));g.setIndex(new THREE.BufferAttribute(idx,1));
  const ctr=box.getCenter(new THREE.Vector3());
  const SU={uTime:U.uTime,uN3:U.uN3,uForm:{value:1},uShed:{value:0},uHot:{value:0},uW:{value:new THREE.Vector3(1,0,0)},uLight:{value:new THREE.Vector3(0,1,0)},
    uDraw:{value:0},uInk:{value:1},uWid:{value:0.012},uFogColor:U.uFogColor,uFogDensity:U.uFogDensity};
  const mat=new THREE.ShaderMaterial({uniforms:SU,transparent:true,depthWrite:false,side:THREE.DoubleSide,   // rubans orientés à l'écran : toujours visibles
    vertexShader:`uniform float uDraw;uniform float uWid;attribute vec3 aB;attribute vec2 aS;attribute vec2 aO;
      varying vec2 vS;varying vec2 vO;varying float vLp;varying vec3 vW;
      void main(){
        vec4 vA=modelViewMatrix*vec4(position,1.0),vB=modelViewMatrix*vec4(aB,1.0);
        vec2 d=vB.xy/max(-vB.z,0.05)-vA.xy/max(-vA.z,0.05);d=length(d)>1e-6?normalize(d):vec2(1.0,0.0);
        vec4 p=mix(vA,vB,aS.x);
        // pression du pinceau : variable d'un trait à l'autre, effilée aux deux bouts
        float pr=0.6+0.8*aO.y;
        p.xy+=vec2(-d.y,d.x)*aS.y*uWid*pr*max(-p.z,1.0)*0.12;
        p.z+=0.012;
        gl_Position=projectionMatrix*p;
        vS=aS;vO=aO;vLp=clamp((uDraw*1.12-aO.x)/0.06,0.0,1.0);vW=(modelMatrix*vec4(mix(position,aB,aS.x),1.0)).xyz;}`,
    fragmentShader:"#define RV_FRAG\n"+GLSL_NOISE+`uniform float uInk;uniform vec3 uFogColor;uniform float uFogDensity;
      varying vec2 vS;varying vec2 vO;varying float vLp;varying vec3 vW;
      void main(){
        if(vS.x>vLp)discard;                                    // le trait avance de A vers B
        float side=abs(vS.y);
        float n=rvNoise(vec3(vS.x*18.0+vO.y*40.0,vS.y*2.2,vO.y*9.0));
        float dry=smoothstep(0.18,0.55,rvNoise(vec3(vS.x*60.0+vO.y*13.0,vS.y*7.0,1.0)));   // pinceau sec : stries claires
        float edge=1.0-smoothstep(0.55,1.0,side+(n-0.5)*0.5);
        float a=edge*mix(1.0,dry,smoothstep(0.3,0.9,side)*0.8)*uInk*0.85;
        a*=smoothstep(0.0,0.08,vLp-vS.x+0.08);
        if(a<0.01)discard;
        vec3 ink=vec3(0.035,0.03,0.03)+vec3(0.05)*(1.0-edge);
        float dist=length(vW-cameraPosition);float fog=1.0-exp(-dist*uFogDensity);
        gl_FragColor=vec4(mix(ink,uFogColor,fog),a);
      }`});
  const mesh=new THREE.Mesh(g,mat);mesh.frustumCulled=false;mesh.renderOrder=9;obj.group.add(mesh);
  return {points:mesh,SU,center:ctr,box};
}

/* ═══ 24 · Données : cours L1, lecture des statistiques du profil, résumés ═══
   Exactement le même stockage que l'accueil L1 (index.html) : chaque cours est lu comme
   l'index le lit (clé du profil rvision_<profil>_<clé>_xp|succes|quiz|time|lastvisit|activity,
   ou ses cas particuliers : préfixe brut, clé partagée, état propre au cours). Le profil actif
   est celui choisi sur l'accueil (rvision_current_user) ; un nouveau profil part de zéro.
   ▸ AJOUTER UN COURS L1 : une ligne dans COURSES_L1, avec la matière (subject) parmi
     l1_civ · l1_con · l1_his · l1_aj · l1_eco. Exemple :
     {id:'dc_obl', key:'dc_obl', subject:'l1_civ', name:'Les obligations', url:'droit_civil_obligations.html', maxXp:5000, maxSuc:60},
   ?demo=1 (réservé au développement) affiche des valeurs de démonstration. */
const COURSES_L1=[
  {id:'dc_pj', key:'dc_pj', subject:'l1_civ',name:'Personnalité juridique',url:'droit_civil_personnalite_L2_v5.html',maxXp:4145,maxSuc:73},
  {id:'dp_vf2',key:'dp_vf2',subject:'l1_civ',name:'Droits de la personnalité',url:'personnalite_vf2.html?from=index',maxXp:4765,maxSuc:70,sharedKey:'rvision_dp_personality'},
  {id:'dc_inc',key:'dc_inc',subject:'l1_civ',name:'Incapacité juridique',url:'droit_civil_incapacite_v4.html',maxXp:5689,maxSuc:89},
  {id:'dc',    key:'dc',    subject:'l1_civ',name:'Mariage & divorce',url:'droit_civil_mariage_divorce2.html',maxXp:6275,maxSuc:65},
  {id:'dc_fil',key:'dc_filiation',subject:'l1_civ',name:'Filiation & autorité parentale',url:'droit_civil_filiation_complet_v2.html',maxXp:600,maxSuc:20,rawPrefix:'dc_filiation_'},
  {id:'co_l1', key:'co_l1', subject:'l1_con',name:'Fondamentaux du droit constitutionnel',url:'droit_constitutionnel_L1.html',maxXp:5000,maxSuc:70,special:'co_l1'},
  {id:'rp',    key:'rp',    subject:'l1_con',name:'Régimes politiques & justice constitutionnelle',url:'regimes_politiques_justice_constitutionnelle_L1.html',maxXp:5000,maxSuc:70,rawPrefix:'rv2_'},
  {id:'ve_rep',key:'ve_rep',subject:'l1_con',name:'Ve République · institutions & pouvoirs',url:'ve_republique_institutions_pouvoirs.html',maxXp:5000,maxSuc:70},
  {id:'co',    key:'co',    subject:'l1_con',name:"L'exécutif sous la Ve République",url:'Droit_Constitution_executif_v2.html',maxXp:375,maxSuc:13},
  {id:'co2',   key:'co2',   subject:'l1_con',name:'Le Conseil constitutionnel',url:'conseil_constitutionnel_v5.html',maxXp:5120,maxSuc:50},
  {id:'h1',    key:'h1',    subject:'l1_his',name:'Vol. 1 — Ancien Régime',url:'histoire_12.html',maxXp:4745,maxSuc:59},
  {id:'h2',    key:'h2',    subject:'l1_his',name:'Vol. 2 — La Révolution française',url:'Histoire_22.html',maxXp:8395,maxSuc:71},
  {id:'h3',    key:'h3',    subject:'l1_his',name:'Vol. 3 — Le XIXᵉ siècle',url:'Histoire_32.html',maxXp:6650,maxSuc:60},
  {id:'h4',    key:'h4',    subject:'l1_his',name:'Vol. 4 — Restauration & XIXᵉ s.',url:'Histoire_42.html',maxXp:7000,maxSuc:65},
  {id:'aj',    key:'aj',    subject:'l1_aj', name:'American Political Institutions',url:'anglais_juridique.html',maxXp:8000,maxSuc:60,sharedKey:'rvision_aj_shared'},
  {id:'mk',    key:'mk',    subject:'l1_eco',name:'Marchés & marchandisation',url:'marches_marchandisation_vF2.html',maxXp:2611,maxSuc:91},
];

const SUBJ_INFO={
  l1_civ:{resume:"Droit des personnes et de la famille : la personnalité juridique et ses attributs, les droits de la personnalité, les incapacités et la protection des majeurs, le mariage et le divorce, la filiation et l'autorité parentale.",
    reperes:['Art. 9 et 16 C. civ.','Art. 414 et s. C. civ.','Art. 310-1 et s. C. civ.']},
  l1_con:{resume:"Droit constitutionnel : la Constitution et le pouvoir constituant, la séparation des pouvoirs et la démocratie, les régimes politiques, puis la Ve République — exécutif, Parlement et Conseil constitutionnel.",
    reperes:['Constitution du 4 octobre 1958','Art. 16 DDHC 1789','Art. 61-1 C. (QPC)']},
  l1_his:{resume:"Histoire du droit et des institutions : l'Ancien Régime, la Révolution française, puis le XIXᵉ siècle — Empire, Restauration, monarchie de Juillet, républiques — et la naissance du droit français moderne.",
    reperes:['Ord. de Villers-Cotterêts, 1539','DDHC, 26 août 1789','Code civil, 21 mars 1804']},
  l1_aj:{resume:"Anglais juridique : les institutions politiques américaines — la Constitution fédérale et le fédéralisme, le Congrès, la présidence, la Cour suprême et le contrôle de constitutionnalité (judicial review).",
    reperes:['U.S. Constitution, 1787','Marbury v. Madison, 1803','Checks and balances']},
  l1_eco:{resume:"Économie : les marchés et la marchandisation — offre, demande et formation des prix, la concurrence et ses limites, les défaillances de marché et le rôle de l'État.",
    reperes:['Offre · demande · prix d’équilibre','Concurrence pure et parfaite','Défaillances de marché']},
};

/* lecture d'un cours — reprise fidèle de readSite() de l'index */
function readL1Course(c,prefix,user){
  const E={xp:0,succes:0,quiz:0,time:0,last:0,activity:{}};
  const ls=k=>{try{return localStorage.getItem(k);}catch(e){return null;}};
  const J=k=>{try{const r=ls(k);return r?JSON.parse(r):null;}catch(e){return null;}};
  const ins=id=>J((user?'rvision_'+user+'_':'rvision_')+id+'_insight');
  const cnt=r=>{if(!r)return 0;try{const a=JSON.parse(r);return Array.isArray(a)?a.length:+a||0;}catch(e){return +r||0;}};
  try{
    if(c.special==='co_l1'){
      const d=J('rvision_droit_constit_l1_v1')||{};
      const r={xp:+(d.xp||0),succes:Array.isArray(d.unlockedIds)?d.unlockedIds.length:+(d.succesUnlocked||0),quiz:(+(d.quizAnswered||0))+(+(d.vfAnswered||0)),time:0,last:0,activity:{}};
      const i2=ins('co_l1');
      if(i2){r.time=Math.round((i2.totalActiveMs||0)/1000);const secs=Object.values(i2.sections||{});r.last=secs.length?Math.max(...secs.map(x=>x.lastEnter||0)):0;
        if(i2.lastFlush){const dk=new Date(i2.lastFlush).toISOString().slice(0,10);r.activity[dk]=Math.round(r.time/15);}}
      return r;
    }
    if(c.rawPrefix){
      const g=k=>ls(c.rawPrefix+k);let activity={};try{activity=JSON.parse(g('activity')||'{}')||{};}catch(e){}
      return {xp:+(g('xp')||0),succes:cnt(g('succes')),quiz:+(g('qa')||0),time:+(g('time')||0),last:+(g('lastvisit')||0),activity};
    }
    if(c.sharedKey){
      const d=J(c.sharedKey);if(!d)return E;
      return {xp:+(d.xp||0),succes:+(d.succes_unlocked||0),quiz:+(d.session_time?Math.round(d.session_time/60):0),time:+(d.session_time||0),last:+(d.last_update||0),activity:{}};
    }
    const g=k=>ls(prefix+c.key+'_'+k);
    let time=+(g('time')||0);
    if(!time){const d=ins(c.key);if(d)time=Math.round((d.totalActiveMs||0)/1000);}
    let activity={};try{activity=JSON.parse(g('activity')||'{}')||{};}catch(e){}
    return {xp:+(g('xp')||0),succes:cnt(g('succes')),quiz:+(g('quiz')||0),time,last:+(g('lastvisit')||0),activity};
  }catch(e){return E;}
}

/* ▸ PROGRESSION : le meilleur des deux entre l'XP et le temps passé.
     Le temps compte par paliers de 25 % : 3 h pour une matière « glace », 2 h 30 pour la
     finance, 1 h 30 pour un cours (un livre se libère donc à 50 % d'XP ou après 3 h). */
const PALIER_ICE=3*3600, PALIER_FIN=2.5*3600, PALIER_COURSE=1.5*3600;
const FIN_KEYS=new Set(['l1_eco']);
function timeProg(sec,palier){return Math.min(1,Math.floor((sec||0)/palier)*0.25);}

/* ▸ FONTE DÉJÀ MONTRÉE : on mémorise l'état affiché de chaque bloc / livre / objet.
     À l'arrivée, l'animation ne se joue que si la progression a augmenté depuis
     (= une leçon a été travaillée) ; rouvrir le site ne la rejoue pas. ?fonte=1 force. */
const SEEN={key:'',data:{}};
function seenLoad(user,real){
  SEEN.key=(user?'rvision_'+user+'_':'rvision_')+'l1_seen'+(real?'':'_demo');
  try{SEEN.data=JSON.parse(localStorage.getItem(SEEN.key)||'{}')||{};}catch(e){SEEN.data={};}
}
function seenGet(id){if(Q.has('fonte'))return null;const v=SEEN.data[id];return typeof v==='number'?v:null;}
function seenSet(id,v){v=Math.round(clamp01(v)*1000)/1000;if(SEEN.data[id]===v)return;SEEN.data[id]=v;try{localStorage.setItem(SEEN.key,JSON.stringify(SEEN.data));}catch(e){}}

const RANKS_L1=[{xp:0,n:'ÉTUDIANT'},{xp:300,n:'JURISTE'},{xp:800,n:'AVOCAT'},{xp:1500,n:'MAGISTRAT'},{xp:3000,n:'DOCTEUR'},{xp:6000,n:'PROFESSEUR'}];

function loadL1Data(subjects){
  let user='';try{user=localStorage.getItem('rvision_current_user')||'';}catch(e){}
  const prefix=user?'rvision_'+user+'_':'rvision_';
  const out={user,subjects:{},real:false};
  let any=false;
  subjects.forEach(sj=>{
    const cs=COURSES_L1.filter(c=>c.subject===sj.key).map(c=>({...c,...readL1Course(c,prefix,user)}));
    cs.forEach(c=>{c.succes=Math.min(c.succes,c.maxSuc||c.succes);});
    const S={courses:cs.length,done:0,xp:0,maxXp:0,succes:0,maxSuc:0,quiz:0,time:0,last:0,activity:{},list:cs};
    cs.forEach(c=>{S.xp+=c.xp;S.maxXp+=c.maxXp||0;S.succes+=c.succes;S.maxSuc+=c.maxSuc||0;S.quiz+=c.quiz;S.time+=c.time;S.last=Math.max(S.last,c.last);
      c.xpM=c.maxXp?Math.min(1,c.xp/c.maxXp):0;c.timeM=timeProg(c.time,PALIER_COURSE);
      c.mastery=Math.max(c.xpM,c.timeM);if(c.mastery>=0.5)S.done++;
      for(const d in c.activity)S.activity[d]=(S.activity[d]||0)+(+c.activity[d]||0);
      if(c.xp>0||c.time>0)any=true;});
    S.xpM=S.maxXp?Math.min(1,S.xp/S.maxXp):0;
    S.timeM=timeProg(S.time,FIN_KEYS.has(sj.key)?PALIER_FIN:PALIER_ICE);
    S.mastery=Math.max(S.xpM,S.timeM);
    out.subjects[sj.key]=S;
  });
  const force=Q.get('demo');
  out.real=force!=='1';
  seenLoad(user,out.real);
  if(!out.real){
    // démonstration : chiffres plausibles, cohérents avec les maîtrises de démo
    const r=mulberry32(4242);
    subjects.forEach(sj=>{const S=out.subjects[sj.key];const m=sj.demo;
      S.mastery=m;S.courses=sj.courses;S.done=sj.done;S.maxXp=sj.courses*900;S.xp=Math.round(S.maxXp*m);
      S.maxSuc=sj.courses*24;S.succes=Math.round(S.maxSuc*m*0.8);S.quiz=Math.round(20+m*180+r()*30);S.time=Math.round((1+m*7+r()*1.5)*3600);
      S.last=Date.now()-Math.round(r()*9)*86400000;S.activity={};
      S.list=Array.from({length:sj.courses},(_,k)=>{const cm=clamp01(m*1.25-0.18*k+(r()-0.5)*0.2);return {id:sj.key+'_demo'+k,name:'Cours '+(k+1),mastery:cm,demo:true};});
      S.done=S.list.filter(c=>c.mastery>=0.5).length;
      for(let d=0;d<84;d++){if(d<4||r()<0.06+m*0.1){const k=new Date(Date.now()-d*86400000).toISOString().slice(0,10);S.activity[k]=Math.round(4+r()*30*m);}}});
  }
  // totaux
  const T={xp:0,maxXp:0,succes:0,maxSuc:0,quiz:0,time:0,last:0,activity:{},courses:0,done:0};
  subjects.forEach(sj=>{const S=out.subjects[sj.key];T.xp+=S.xp;T.maxXp+=S.maxXp;T.succes+=S.succes;T.maxSuc+=S.maxSuc;T.quiz+=S.quiz;T.time+=S.time;T.last=Math.max(T.last,S.last);T.courses+=S.courses;T.done+=S.done;
    for(const d in S.activity)T.activity[d]=(T.activity[d]||0)+S.activity[d];});
  // maîtrise globale : pondérée par le contenu publié (vraies données), moyenne simple en démo
  T.mastery=subjects.reduce((a,sj)=>a+out.subjects[sj.key].mastery,0)/subjects.length;
  T.rank=[...RANKS_L1].reverse().find(r=>T.xp>=r.xp)||RANKS_L1[0];
  // série : jours consécutifs avec activité, jusqu'à aujourd'hui (ou hier)
  let streak=0;for(let d=0;d<400;d++){const k=new Date(Date.now()-d*86400000).toISOString().slice(0,10);if(T.activity[k])streak++;else if(d>0)break;}
  T.streak=streak;
  const weakest=subjects.slice().sort((a,b)=>out.subjects[a.key].mastery-out.subjects[b.key].mastery)[0];
  const best=subjects.slice().sort((a,b)=>out.subjects[b.key].mastery-out.subjects[a.key].mastery)[0];
  T.weakest=weakest;T.best=best;
  out.totals=T;
  return out;
}
function fmtDuree(sec){const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60);return h>0?h+' h '+String(m).padStart(2,'0'):m+' min';}
function fmtDate(ts){if(!ts)return '—';const d=new Date(ts);return String(d.getDate()).padStart(2,'0')+'.'+String(d.getMonth()+1).padStart(2,'0')+'.'+d.getFullYear();}

/* ═══ 25 · Les stèles (L1) : trois stèles de pierre sur la terrasse, chacune porte un écran net ═══
   La dalle (glace teintée de sable, arêtes ébréchées, pied pris dans une congère) reste en 3D.
   Les statistiques ne sont plus gravées dans une texture (floue de près, illisible de loin) :
   chaque panneau est une vraie page HTML/SVG, projetée exactement sur la face avant de sa
   dalle (homographie CSS recalculée à chaque image). Texte vectoriel net à toute taille,
   graphiques en couleur (une couleur par matière), survol et clic natifs.
     1 · Vue d'ensemble : maîtrise globale (anneau par matière), rang, chiffres clés, tableau
     2 · Activité : succès par matière, temps du jour, semaine / mois, dernières sessions
     3 · Analyse : moteur INSIGHT (lacunes, notions denses, à consolider, à surveiller, points forts) */
const WALL={x:62,z:-24};
function wallDims(){const portrait=VW/VH<0.9;return portrait?{W:5.4,H:8.6,D:1.15,portrait:true}:{W:11,H:6.3,D:1.2,portrait:false};}
/* rectangle de l'écran sur la face avant (repère de la dalle) */
function wallPanelRect(D){return D.portrait?{x0:-D.W/2+0.3,x1:D.W/2-0.3,y0:0.5,y1:D.H-1.0}:{x0:-D.W/2+0.42,x1:D.W/2-0.42,y0:0.5,y1:D.H-1.0};}
const WALLST={hm:'week',mo:0,ana:null};
function wToday(){return new Date().toISOString().slice(0,10);}
function wSucDay(key){try{let u=localStorage.getItem('rvision_current_user')||'';return parseInt(localStorage.getItem((u?'rvision_'+u+'_':'rvision_')+'suc_day_'+key)||'0')||0;}catch(e){return 0;}}
const wCol=sj=>(typeof L1_SUBJ_COL!=='undefined'&&L1_SUBJ_COL[sj.key])||'#ffd9a8';
const wEsc=t=>String(t==null?'':t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const wNum=n=>Math.round(n).toLocaleString('fr-FR');
function wHead(data,page,title,D){
  return `<header class="wh"><p><b>${title}</b><span>Licence 1 · 2026–2027</span>${data.real?'':'<span class="dm">démo</span>'}</p><p class="r">${D.portrait?'':'<span>Profil : '+wEsc(data.user?data.user.toUpperCase():'invité')+'</span>'}<b>${page} / 3</b></p></header>`;
}
/* anneau segmenté (SVG) : segs = [{v (0..1 du tour), c, tip}] */
function wRing(segs,center,sub,R=42,sw=9){
  const C=2*Math.PI*R;let off=0;
  const arcs=segs.map((s,i)=>{const len=Math.max(0,s.v*C);const gap=len>3?1.4:0;
    const el=`<circle class="seg" r="${R}" cx="50" cy="50" fill="none" stroke="${s.c}" stroke-width="${sw}" stroke-linecap="butt" style="stroke-dasharray:0 ${C.toFixed(2)};stroke-dashoffset:${(-off).toFixed(2)};--d:${(0.15+i*0.12).toFixed(2)}s" data-dash="${Math.max(0,len-gap).toFixed(2)} ${C.toFixed(2)}"${s.tip?` data-tip="${wEsc(s.tip)}"`:''}/>`;off+=len;return el;}).join('');
  return `<div class="ring"><svg viewBox="0 0 100 100"><circle r="${R}" cx="50" cy="50" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="${sw}"/><g transform="rotate(-90 50 50)">${arcs}</g></svg><div class="rc">${center}${sub?`<small>${sub}</small>`:''}</div></div>`;
}

/* ── 1 · Vue d'ensemble ── */
function wpOverview(data,subjects,D){
  const T=data.totals,td=wToday();let todaySec=0;subjects.forEach(sj=>{todaySec+=((data.subjects[sj.key].activity||{})[td]||0)*15;});
  const n=subjects.length;
  const ring=wRing(subjects.map(sj=>{const S=data.subjects[sj.key];return {v:S.mastery/n,c:wCol(sj),tip:sj.name+' · '+Math.round(S.mastery*100)+' % (part du total : '+Math.round(S.mastery/n*100)+' pts)'};}),
    `<span class="rv"><b data-count="${Math.round(T.mastery*100)}">0</b><i>%</i></span>`,'maîtrise globale');
  const K=[['Temps total',fmtDuree(T.time)],["Aujourd'hui",fmtDuree(todaySec)],['Série',T.streak+' j'],['Succès',T.succes+' / '+T.maxSuc],['Quiz',String(T.quiz)],['Dernière act.',fmtDate(T.last)]];
  const rows=subjects.map((sj,i)=>{const S=data.subjects[sj.key],ph=(sj.phases||PHASES)[phaseOf(S.mastery,S.mastery>0)],m=Math.round(S.mastery*100);
    return `<button type="button" class="wt-r" data-row="${i}" style="--c:${wCol(sj)};--d:${(0.2+i*0.08).toFixed(2)}s">
      <span class="nm"><i class="dot"></i><span><b>${wEsc(sj.name.charAt(0)+sj.name.slice(1).toLowerCase())}</b><small>${(sj.phaseKey||'FONTE')} ${ph.id}/IV · ${ph.name}</small></span></span>
      <span class="ms"><span class="bar"><i data-w="${m}"></i></span><em>${m}<small>%</small></em></span>
      <span class="r">${wNum(S.xp)}</span><span class="r">${Math.min(S.succes,S.maxSuc)}<small>/${S.maxSuc}</small></span></button>`;}).join('');
  const wk=T.weakest;
  return wHead(data,1,'Statistiques',D)+`<div class="wb ov">
    <section class="ov-l">
      <div class="ov-hero">${ring}<div class="ov-rk"><small>Rang</small><b>${wEsc(T.rank.n)}</b><span>${wNum(T.xp)} XP</span><span>${T.done} / ${T.courses} cours validés</span></div></div>
      <div class="kp">${K.map(([l,v])=>`<div><small>${l}</small><b>${wEsc(v)}</b></div>`).join('')}</div>
    </section>
    <section class="ov-r">
      <div class="wt"><div class="wt-h"><span>Matière</span><span>Maîtrise</span><span class="r">XP</span><span class="r">Succès</span></div>${rows}</div>
      <div class="pri" style="--c:${wCol(wk)}"><small>À reprendre en priorité</small><b>→ ${wEsc(wk.name.charAt(0)+wk.name.slice(1).toLowerCase())}</b><em>${Math.round(data.subjects[wk.key].mastery*100)} %</em></div>
    </section></div>`;
}

/* ── 2 · Activité ── */
function wpHeat(data){
  const act=data.totals.activity||{},today=new Date(),tk=wToday();
  const tog=`<div class="tg"><button type="button" data-hm="week" class="${WALLST.hm==='week'?'on':''}">Semaine</button><button type="button" data-hm="month" class="${WALLST.hm==='month'?'on':''}">Mois</button></div>`;
  if(WALLST.hm==='week'){
    const dow=today.getDay()===0?7:today.getDay();const mon=new Date(today);mon.setDate(today.getDate()-(dow-1));
    const J=['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];const cells=[];
    for(let d=0;d<7;d++){const cd=new Date(mon);cd.setDate(mon.getDate()+d);const key=cd.toISOString().slice(0,10);const ses=act[key]||0;cells.push({key,mins:Math.round(ses/4),fut:cd>today&&key!==tk,today:key===tk,suc:wSucDay(key),d:cd,lab:J[d]});}
    const mx=Math.max(1,...cells.filter(q=>!q.fut).map(q=>q.mins));
    return `<h4>Semaine en cours ${tog}</h4><div class="wk">${cells.map((q,i)=>`<div class="${q.today?'td':''}${q.fut?' fu':''}" data-tip="${wEsc(q.d.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})+' · '+(q.mins>0?q.mins+' min':'aucune session')+(q.suc?' · '+q.suc+' succès':''))}">
      <em>${q.mins>0?q.mins+'′':''}</em><span class="tr"><i data-h="${q.fut?0:Math.max(q.mins>0?6:0,q.mins/mx*100)}" style="--d:${(0.2+i*0.06).toFixed(2)}s"></i></span><b>${q.lab}</b><small>${q.d.getDate()}.${String(q.d.getMonth()+1).padStart(2,'0')}</small></div>`).join('')}</div>`;
  }
  const ref=new Date(today.getFullYear(),today.getMonth()+WALLST.mo,1),y=ref.getFullYear(),m=ref.getMonth();
  const off=(ref.getDay()+6)%7,dim=new Date(y,m+1,0).getDate();let cells='';
  for(let i=0;i<off;i++)cells+='<span class="e"></span>';
  for(let d=1;d<=dim;d++){const cd=new Date(y,m,d),key=cd.toISOString().slice(0,10),ses=act[key]||0,fut=cd>today&&key!==tk;
    const lv=fut||!ses?0:ses<=4?1:ses<=12?2:ses<=24?3:4;
    cells+=`<span class="l${lv}${key===tk?' td':''}${fut?' fu':''}" data-tip="${wEsc(cd.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})+' · '+(ses?Math.round(ses/4)+' min':'aucune session'))}">${d}</span>`;}
  return `<h4>${ref.toLocaleDateString('fr-FR',{month:'long',year:'numeric'})} ${tog}</h4><div class="mo-n"><button type="button" data-nav="-1" aria-label="Mois précédent">‹</button><button type="button" data-nav="1" aria-label="Mois suivant" ${WALLST.mo<0?'':'disabled'}>›</button></div>
    <div class="mo"><b>L</b><b>M</b><b>M</b><b>J</b><b>V</b><b>S</b><b>D</b>${cells}</div><div class="lg"><span>moins</span><i class="l1"></i><i class="l2"></i><i class="l3"></i><i class="l4"></i><span>plus</span></div>`;
}
function wpActivity(data,subjects,D){
  const td=wToday();
  const bars=subjects.map((sj,i)=>{const S=data.subjects[sj.key],v=Math.min(S.succes,S.maxSuc),f=S.maxSuc?v/S.maxSuc:0;
    return `<div style="--c:${wCol(sj)}" data-tip="${wEsc(sj.name+' · '+v+' / '+S.maxSuc+' succès')}"><em>${v}</em><span class="tr"><i data-h="${(f*100).toFixed(1)}" style="--d:${(0.2+i*0.08).toFixed(2)}s"></i></span><b>${String(sj.idx).padStart(2,'0')}</b></div>`;}).join('');
  const vals=subjects.map(sj=>((data.subjects[sj.key].activity||{})[td]||0)*15),tot=vals.reduce((a,b)=>a+b,0);
  const ring=wRing(tot?subjects.map((sj,i)=>({v:vals[i]/tot,c:wCol(sj),tip:sj.name+' · '+fmtDuree(vals[i])})).filter(s=>s.v>0):[],`<b>${fmtDuree(tot)}</b>`,tot?"révisé aujourd'hui":'pas encore de session',40,12);
  const vis=subjects.map(sj=>({sj,last:data.subjects[sj.key].last||0})).filter(v=>v.last>0).sort((a,b)=>b.last-a.last).slice(0,5);
  const recent=vis.length?vis.map(v=>{const d=new Date(v.last),tdd=d.toDateString()===new Date().toDateString();
      return `<li style="--c:${wCol(v.sj)}"><i class="dot"></i><span>${wEsc(v.sj.name.charAt(0)+v.sj.name.slice(1).toLowerCase())}</span><em>${tdd?"aujourd'hui "+d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}):d.toLocaleDateString('fr-FR',{day:'numeric',month:'short'})}</em></li>`;}).join('')
    :'<li class="nil">Aucune session — ouvre un cours pour commencer.</li>';
  const legend=subjects.map((sj,i)=>`<li style="--c:${wCol(sj)}"><i class="dot"></i><span>${String(sj.idx).padStart(2,'0')} ${wEsc(sj.name.charAt(0)+sj.name.slice(1).toLowerCase())}</span><em>${vals[i]?fmtDuree(vals[i]):'—'}</em></li>`).join('');
  return wHead(data,2,'Activité',D)+`<div class="wb ac">
    <section class="ac-a"><h4>Succès par matière</h4><div class="bc">${bars}</div></section>
    <section class="ac-b"><h4>Temps aujourd'hui</h4><div class="tday">${ring}<ul class="lgd">${legend}</ul></div></section>
    <section class="ac-c" data-heat>${wpHeat(data)}</section>
    <section class="ac-d"><h4>Dernières sessions</h4><ul class="rec">${recent}</ul></section></div>`;
}

/* ── 3 · Analyse (moteur INSIGHT) ── */
function wpAnalysis(data,subjects,D){
  const A=WALLST.ana||{state:'empty'};
  if(A.state!=='ok'){
    const t=A.state==='start'?'Commence à travailler un cours':A.state==='insufficient'?'Données insuffisantes':'Aucune donnée pour l\'instant';
    const s=A.state==='start'?'Les recommandations apparaissent après 2 minutes actives ou 3 questions de quiz.':A.state==='insufficient'?'Continue à travailler — l\'analyse s\'affine automatiquement.':'Travaille dans tes cours de L1 : l\'analyse de tes points forts et de tes lacunes apparaîtra ici.';
    return wHead(data,3,'Analyse',D)+`<div class="wb an-e"><b>${t}</b><p>${s}</p></div>`;
  }
  const K=[['Temps actif',A.activeLabel,''],['Questions',String(A.totalQs),''],['Cours actifs',A.nCourses+' / '+A.nTotal,''],['Lacunes',String(A.lacunesN),A.lacunesN>0?'bad':'ok']];
  const item=(n,cls)=>`<li class="${cls}" data-tip="${wEsc((n.action||'')+(n.signals&&n.signals.length?' · '+n.signals.slice(0,2).map(s=>s.txt).join(' · '):''))}"${n.url?` data-url="${wEsc(n.url)}"`:''}>
      <span class="sc">${Math.round(n.score)}</span><span class="tx"><b>${wEsc(n.name)}</b><small>${wEsc(String(n.course||''))}${n.section&&n.section!==n.course?' · '+wEsc(n.section):''}</small></span>${n.url?'<i>→</i>':''}</li>`;
  const grp=(title,list,cls,max)=>list&&list.length?`<div class="grp ${cls}"><h4>${title}<em>${list.length}</em></h4><ul>${list.slice(0,max).map(n=>item(n,cls)).join('')}</ul></div>`:'';
  const P=D.portrait,mx=P?2:3;
  const top=A.top?`<div class="top" ${A.top.url?`data-url="${wEsc(A.top.url)}"`:''} data-tip="${wEsc(A.top.action||'')}"><small>À réviser en priorité</small><b>${wEsc(A.top.name)}</b><span>${wEsc(A.top.course||'')}${A.top.section?' · '+wEsc(A.top.section):''}</span><em class="sc">${Math.round(A.top.score)}</em>${A.top.url?'<i>Revoir →</i>':''}</div>`:'';
  const notes=(A.pause?'<p class="nt warn">⏸ Décrochage détecté — une pause de 15 min est recommandée maintenant.</p>':'')+(A.thirty&&A.profile?`<p class="nt">Profil d'apprentissage : <b>${wEsc(A.profile.label)}</b> (${A.profile.pct} %)</p>`:'');
  return wHead(data,3,'Analyse',D)+`<div class="wb an">
    <section class="an-t"><div class="kp k4">${K.map(([l,v,c])=>`<div class="${c}"><small>${l}</small><b>${wEsc(v)}</b></div>`).join('')}</div>${top}${notes}</section>
    <section class="an-c">
      <div class="col">${grp('Lacunes',A.lists.lacunes,'red',mx)}${grp('Notions denses',A.lists.complexes,'violet',2)}</div>
      <div class="col">${grp('À consolider',A.lists.fragiles,'orange',mx)}${grp('À surveiller',A.lists.watch,'blue',2)}</div>
      <div class="col">${grp('Points forts',A.lists.strong,'green',mx)}</div>
    </section></div>`;
}

/* ── dalle de glace (3D) ── */
function buildIceWall(parent,data,subjects,render,offset){
  const D=wallDims();offset=offset||0;
  const SX=Math.round(D.W*10),SY=Math.round(D.H*10),SZ=10;
  const g=new THREE.BoxGeometry(D.W,D.H+0.5,D.D,SX,SY,SZ);g.translate(0,(D.H+0.5)/2-0.5,0);
  const pa=g.attributes.position,sd=rand()*50;
  for(let i=0;i<pa.count;i++){
    let x=pa.getX(i),y=pa.getY(i),z=pa.getZ(i);
    const ex=Math.abs(x)/(D.W/2),top=y/D.H;
    const ytop=D.H-0.32*fbm2(x*0.35+sd,1.3,3)-0.55*Math.max(0,fbm2(x*0.8+sd,7.1,3)-0.52);
    if(y>0) y=y*(ytop/D.H);
    const side=1-0.05*fbm2(y*0.7+sd,3.3,3)-0.08*Math.max(0,fbm2(y*1.4,sd,2)-0.55);
    if(ex>0.8) x=x*lerp(1,side,smooth(0.8,1,ex));
    const edge=Math.max(smooth(0.86,1,ex),smooth(0.9,1,top),smooth(0.75,1,Math.abs(z)/(D.D/2))*0.3);
    const ch=(Math.max(0,fbm2(x*1.6+y*0.9+sd,z*2.0+y*1.3,3)-0.5))*0.5*edge;
    if(z<0) z=z-ch*0.6+0.04*fbm2(x*0.9,y*0.9,3);
    else z=z-ch*(ex>0.85||top>0.9?1:0.15);
    pa.setXYZ(i,x,y,z);
  }
  g.computeVertexNormals();
  const WU={uWall:{value:new THREE.Vector3(D.W,D.H,D.D)},uHot:{value:0}};
  /* stèle de pierre (L1) : granit gris-vert, face avant dressée avec un cadre gravé et une frise de
     signes, arêtes éclatées, mousse au pied et sur le sommet, lichens, coulures sombres */
  const mat=patch(new THREE.MeshStandardMaterial({color:new THREE.Color('#ffffff'),roughness:0.85,metalness:0,envMapIntensity:0.7}),{
    uniforms:WU,
    vHead:'varying vec3 vRvL;varying vec3 vRvNl;',vMain:'vRvL=transformed;vRvNl=objectNormal;',
    fHead:`varying vec3 vRvL;varying vec3 vRvNl;uniform vec3 uWall;uniform float uHot;float rvGv=0.0;float rvMs=0.0;
      float rvSeg(vec2 p,vec2 a,vec2 b){vec2 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0);return length(pa-ba*h);}
      float rvGlyph(vec2 q,float id){float d=1.0;for(int k=0;k<4;k++){float h1=rvHash(vec3(id,float(k),1.0)),h2=rvHash(vec3(id,float(k),2.0));
        vec2 a=vec2(floor(h1*3.0)/2.0,floor(fract(h1*7.0)*3.0)/2.0)*0.8+0.1,b=vec2(floor(h2*3.0)/2.0,floor(fract(h2*7.0)*3.0)/2.0)*0.8+0.1;
        if(length(a-b)<0.1)b=vec2(0.5);d=min(d,rvSeg(q,a,b));}return smoothstep(0.09,0.05,d);}`,
    fColor:`
      vec3 q=vRvL*0.8;float ex=abs(vRvL.x)/(uWall.x*0.5),ey=vRvL.y/uWall.y;
      float front=smoothstep(0.7,0.95,vRvNl.z);
      vec3 st=mix(vec3(0.25,0.26,0.24),vec3(0.45,0.45,0.41),rvFbm(q*0.7));
      st*=1.0-smoothstep(0.6,0.85,rvFbm3(q*2.0))*0.25;
      st*=1.0-smoothstep(0.55,0.8,rvNoise(vec3(q.x*2.0,q.y*0.3,q.z*2.0)))*0.25*(1.0-front*0.6);   // coulures
      // face avant dressée : plus lisse et plus sombre ; cadre gravé ; frise de signes en haut
      st=mix(st,st*0.82,front);
      if(front>0.5){
        float fx=abs(vRvL.x)-(uWall.x*0.5-0.2),fy1=vRvL.y-(uWall.y-0.75),fy0=0.3-vRvL.y;
        float fr=smoothstep(0.035,0.0,abs(max(fx,max(fy1,fy0))+0.05));
        float band=step(uWall.y-0.72,vRvL.y)*step(vRvL.y,uWall.y-0.22)*step(abs(vRvL.x),uWall.x*0.5-0.45);
        float cell=(vRvL.x+uWall.x*0.5)/0.42;float gl=rvGlyph(vec2(fract(cell),(vRvL.y-(uWall.y-0.7))/0.46),floor(cell))*band*step(0.25,rvHash(vec3(floor(cell),3.0,1.0)));
        rvGv=max(fr,gl);
      }
      st*=1.0-rvGv*0.5;
      // mousse : pied de la stèle, sommet, plaques
      rvMs=clamp(smoothstep(0.9,0.05,vRvL.y)*smoothstep(0.35,0.65,rvFbm3(q*1.5))+smoothstep(0.4,0.9,vRvN.y)*smoothstep(0.3,0.6,rvFbm3(q*1.6+3.0))+smoothstep(0.66,0.85,rvFbm3(q*1.2+9.0))*0.5*(1.0-front),0.0,1.0);
      st=mix(st,mix(vec3(0.13,0.22,0.05),vec3(0.3,0.4,0.1),rvFbm3(q*6.0)),rvMs);
      float li=smoothstep(0.8,0.88,rvNoise(q*3.5+7.0))*(1.0-rvMs);st=mix(st,vec3(0.62,0.62,0.5),li*0.6);
      diffuseColor.rgb=st;`,
    fRough:`roughnessFactor=mix(0.88,0.62,smoothstep(0.7,0.95,vRvNl.z))+rvMs*0.1;`,
    fNormal:`
      float hb=rvFbm(vRvL*1.1)*0.06+rvNoise(vRvL*12.0)*0.01-rvGv*0.02+rvMs*rvNoise(vRvL*40.0)*0.015;
      normal=rvPerturb(-vViewPosition,normal,hb,1.0);`,
    fEmissive:`totalEmissiveRadiance+=vec3(1.0,0.82,0.55)*uHot*0.05*rvGv;`,
  },'stele');
  const mesh=new THREE.Mesh(g,mat);mesh.receiveShadow=true;
  const grp=new THREE.Group();grp.add(mesh);const wx=WALL.x+Math.cos(-0.14)*offset,wz=WALL.z-Math.sin(-0.14)*offset;
  {const bg=new RoundedBoxGeometry(D.W+0.9,0.55,D.D+1.1,2,0.06);const bp=bg.attributes.position;
   for(let i=0;i<bp.count;i++){bp.setXYZ(i,bp.getX(i)*(1+(vn3(bp.getX(i),bp.getY(i)*3,bp.getZ(i))-0.5)*0.03),bp.getY(i),bp.getZ(i));}
   bg.computeVertexNormals();bg.translate(0,0.05,0);const base=new THREE.Mesh(bg,mat);base.receiveShadow=true;base.castShadow=true;grp.add(base);}
  grp.position.set(wx,finField(wx,wz).h-0.05,wz);grp.rotation.y=-0.14;parent.add(grp);
  const PR=wallPanelRect(D);
  return {group:grp,mesh,WU,D,PR,render,started:false,t:0,dirty:true,
    center:new THREE.Vector3(wx,grp.position.y+(PR.y0+PR.y1)/2,wz)};
}

/* ── couche HTML : un écran par dalle, projeté sur sa face avant ── */
function buildWallUI(walls,subjects){
  const host=document.createElement('div');host.id='wallui';host.setAttribute('aria-hidden','true');document.body.appendChild(host);
  const _v=new THREE.Vector3();
  const P=walls.map((Wp,i)=>{
    const el=document.createElement('div');el.className='wp'+(Wp.D.portrait?' por':'');host.appendChild(el);
    const st={el,w:0,h:0,shown:false,revealed:false,html:''};
    return st;
  });
  function sizeOf(st,Wp,w){
    const asp=(Wp.PR.y1-Wp.PR.y0)/(Wp.PR.x1-Wp.PR.x0);w=Math.round(w);
    st.w=w;st.h=Math.round(w*asp);st.el.style.width=st.w+'px';st.el.style.height=st.h+'px';
    const fs=Wp.D.portrait?Math.max(9,Math.min(16,w/30)):Math.max(9.5,Math.min(19,w/78));st.el.style.fontSize=fs.toFixed(2)+'px';
  }
  function render(i,data){const Wp=walls[i],st=P[i];
    st.el.innerHTML=Wp.render(data,subjects,Wp.D);st.revealed=false;st.el.classList.remove('on');
    if(Wp.started)reveal(i,true);bind(i);}
  function reveal(i,instant){const st=P[i];if(st.revealed)return;st.revealed=true;const el=st.el;
    const go=()=>{el.classList.add('on');
      el.querySelectorAll('[data-w]').forEach(e=>{e.style.width=e.dataset.w+'%';});
      el.querySelectorAll('[data-h]').forEach(e=>{e.style.height=e.dataset.h+'%';});
      el.querySelectorAll('[data-dash]').forEach(e=>{e.style.strokeDasharray=e.dataset.dash;});
      el.querySelectorAll('[data-count]').forEach(e=>{const N=+e.dataset.count;if(instant){e.textContent=N;return;}const t0=performance.now();
        const stp=now=>{const k=Math.min(1,(now-t0)/1300);e.textContent=String(Math.round(N*(1-Math.pow(1-k,3))));if(k<1)requestAnimationFrame(stp);};requestAnimationFrame(stp);});};
    if(instant){el.classList.add('noanim');go();void el.offsetWidth;el.classList.remove('noanim');}else requestAnimationFrame(go);}
  function bind(i){const el=P[i].el;
    el.querySelectorAll('[data-row]').forEach(b=>b.addEventListener('click',()=>{if(SYS.ovl)SYS.ovl.open(subjects[+b.dataset.row],DATA,T);}));
    el.querySelectorAll('[data-hm]').forEach(b=>b.addEventListener('click',()=>{WALLST.hm=b.dataset.hm;WALLST.mo=0;heat(i);}));
    el.querySelectorAll('[data-url]').forEach(b=>{b.style.cursor='pointer';b.addEventListener('click',()=>window.open(b.dataset.url,'_blank','noopener'));});
    el.querySelectorAll('[data-tip]').forEach(b=>{b.addEventListener('mousemove',()=>wallTip(b.dataset.tip));b.addEventListener('mouseleave',()=>wallTip(null));});
    bindNav(i);}
  function bindNav(i){P[i].el.querySelectorAll('[data-nav]').forEach(b=>b.addEventListener('click',()=>{WALLST.mo=Math.min(0,WALLST.mo+(+b.dataset.nav));heat(i);}));}
  function heat(i){const sec=P[i].el.querySelector('[data-heat]');if(!sec)return;sec.innerHTML=wpHeat(DATA);
    sec.querySelectorAll('[data-hm]').forEach(b=>b.addEventListener('click',()=>{WALLST.hm=b.dataset.hm;WALLST.mo=0;heat(i);}));
    sec.querySelectorAll('[data-tip]').forEach(b=>{b.addEventListener('mousemove',()=>wallTip(b.dataset.tip));b.addEventListener('mouseleave',()=>wallTip(null));});
    bindNav(i);sec.querySelectorAll('[data-h]').forEach(e=>{e.style.height=e.dataset.h+'%';});}
  /* homographie : carré unité → quadrilatère écran (Heckbert), puis matrice CSS pour w×h px */
  function quad(q,w,h){
    const [x0,y0,x1,y1,x2,y2,x3,y3]=q;const sx=x0-x1+x2-x3,sy=y0-y1+y2-y3;let a,b,c,d,e,f,g,hh;
    if(Math.abs(sx)<1e-6&&Math.abs(sy)<1e-6){a=x1-x0;b=x3-x0;c=x0;d=y1-y0;e=y3-y0;f=y0;g=0;hh=0;}
    else{const dx1=x1-x2,dx2=x3-x2,dy1=y1-y2,dy2=y3-y2,den=dx1*dy2-dx2*dy1;g=(sx*dy2-dx2*sy)/den;hh=(dx1*sy-sx*dy1)/den;
      a=x1-x0+g*x1;b=x3-x0+hh*x3;c=x0;d=y1-y0+g*y1;e=y3-y0+hh*y3;f=y0;}
    const F=v=>(Math.abs(v)<1e-12?0:v).toFixed(10);
    return `matrix3d(${F(a/w)},${F(d/w)},0,${F(g/w)},${F(b/h)},${F(e/h)},0,${F(hh/h)},0,0,1,0,${F(c)},${F(f)},0,1)`;
  }
  const cs=[[0,1],[1,1],[1,0],[0,0]];   // HG, HD, BD, BG (u, v : v=1 en haut)
  function update(Pp,dt,visible){
    walls.forEach((Wp,i)=>{const st=P[i];const o=Math.abs(Pp-(P_STATS+i));
      const on=visible&&o<1.15;
      if(!on){if(st.shown){st.shown=false;st.el.style.visibility='hidden';st.el.style.opacity='0';}return;}
      Wp.mesh.updateMatrixWorld();const pts=[];let ok=true;
      for(const [u,v] of cs){_v.set(lerp(Wp.PR.x0,Wp.PR.x1,u),lerp(Wp.PR.y0,Wp.PR.y1,v),Wp.D.D/2+0.01);Wp.mesh.localToWorld(_v);
        const vz=_v.clone().applyMatrix4(camera.matrixWorldInverse).z;if(vz>-camera.near*1.5){ok=false;break;}
        _v.project(camera);pts.push((_v.x*0.5+0.5)*VW,(-_v.y*0.5+0.5)*VH);}
      if(!ok){if(st.shown){st.shown=false;st.el.style.visibility='hidden';}return;}
      const pw=Math.hypot(pts[2]-pts[0],pts[3]-pts[1]);
      // taille CSS = taille à l'écran au repos (rendu du texte à l'échelle 1 : net) ; recalée à l'arrêt
      if(!st.w||(o<0.03&&Math.abs(pw-st.w)/st.w>0.03)){sizeOf(st,Wp,pw);if(!st.html){st.html='1';render(i,DATA);}}
      st.el.style.transform=quad(pts,st.w,st.h);
      const op=(1-smooth(0.55,1.1,o))*smooth(0,0.5,Wp.t||0);
      st.el.style.opacity=op.toFixed(3);st.el.style.visibility=op>0.01?'visible':'hidden';st.el.style.pointerEvents=o<0.3?'auto':'none';
      if(!st.shown){st.shown=true;}
      if(Wp.started&&!st.revealed)reveal(i,false);
    });
  }
  function rerender(){P.forEach((st,i)=>{if(st.html)render(i,DATA);});}
  return {host,panels:P,update,rerender,render};
}

/* ═══ 26 · Panneau de matière ═══
   Dans les grottes (glace / torches) : panneau latéral, la scène reste visible. Ailleurs (clic
   sur une ligne du mur de statistiques) : même contenu, centré.
   Contenu, du plus utile au moins utile :
     1 · maîtrise (barre épaisse) + flamme animée façon Duolingo : record de bonnes réponses
         d'affilée aux quiz de la matière (et série en cours)
     2 · points à revoir, choisis par le moteur INSIGHT (lacunes, notions fragiles) → lien direct
     3 · les livres (cours) : couleur du livre dans la grotte, progression, libéré ou non
     4 · quatre chiffres utiles : temps, réussite aux quiz, questions, dernière séance
     5 · le programme, replié */
const FLAME_SVG=`<svg viewBox="0 0 24 30" aria-hidden="true"><defs>
  <linearGradient id="flo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb02e"/><stop offset="1" stop-color="#ff5a1f"/></linearGradient>
  <linearGradient id="fli" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6c2"/><stop offset="1" stop-color="#ffd43b"/></linearGradient></defs>
  <path class="fo" d="M12 1.2c1.2 5 7.6 8.4 7.6 16.4a7.6 7.6 0 0 1-15.2 0c0-3.4 1.6-5.8 3.7-7.6.1 2 1.3 3.1 2.4 3.1-1.1-4.2-.4-8.4 1.5-11.9z" fill="url(#flo)"/>
  <path class="fi" d="M12 13.4c.8 2.6 3.9 3.6 3.9 6.9a3.9 3.9 0 0 1-7.8 0c0-2.1 1.4-3.3 2.5-4.2.2 1.1.9 1.6 1.4 1.4-.5-1.4-.5-2.9 0-4.1z" fill="url(#fli)"/></svg>`;
function buildOverlay(){
  const o=document.createElement('div');o.id='ovl';o.setAttribute('role','dialog');o.setAttribute('aria-modal','true');o.setAttribute('aria-hidden','true');
  o.innerHTML=`<button type="button" class="ovl-close" aria-label="Fermer">Fermer</button><div class="ovl-in"></div>`;
  document.body.appendChild(o);
  const $=s=>o.querySelector(s);
  const st={open:false};
  let raf=0,tm=0;
  function close(){if(!st.open)return;st.open=false;o.classList.remove('on');o.setAttribute('aria-hidden','true');cancelAnimationFrame(raf);clearTimeout(tm);
    setTimeout(()=>{if(!st.open){o.classList.remove('cave','m-ice','m-sand');$('.ovl-close').textContent='Fermer';}},520);}
  const esc=t=>String(t==null?'':t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  function open(sj,data,T,mode){
    const side=mode==='ice'||mode==='sand';
    const S=data.subjects[sj.key];const phs=(sj.phases||PHASES),ph=phs[phaseOf(S.mastery,S.mastery>0.0005)];
    const I=(typeof subjectInsightL1==='function')?subjectInsightL1(sj.key):{best:0,cur:0,correct:0,total:0,ms:0,review:[],any:false};
    const m=Math.round(S.mastery*100);
    const list=(S.list||[]);const freed=list.filter(c=>(c.mastery||0)>=BOOK_FREE).length;
    const where=(mode==='ice'||mode==='sand')?'SALLE DU TEMPLE':'MATIÈRE';
    const phTxt=(sj.phaseKey||'Fonte').toUpperCase()+' '+ph.id+' / IV · '+ph.name;
    // 1 · progression + flamme
    const fl=I.best>0;
    const prog=`<section class="cp-prog">
      <div class="cp-top"><span class="cp-pct"><b>${m}</b>%</span><span class="cp-ph">${esc(phTxt)}</span></div>
      <div class="cp-row">
        <div class="cp-bar" role="progressbar" aria-valuenow="${m}" aria-valuemin="0" aria-valuemax="100"><i data-w="${m}"></i></div>
        <div class="cp-flame${fl?'':' off'}" title="Record de flamme : ${I.best} bonnes réponses d'affilée">${FLAME_SVG}<span class="sp"><i></i><i></i><i></i></span><b data-n="${I.best}">${fl?0:'0'}</b></div>
      </div>
      <p class="cp-fl">${fl?`Record de flamme : <b>${I.best}</b> bonne${I.best>1?'s':''} réponse${I.best>1?'s':''} d'affilée${I.cur>0?` <span>· série en cours <b>${I.cur}</b></span>`:''}`:`Pas encore de flamme — enchaîne les bonnes réponses aux quiz pour l'allumer.`}</p>
    </section>`;
    // 2 · points à revoir
    const rv=I.review||[];
    const rev=`<section class="cp-sec"><h3>À revoir <em>selon l'algorithme</em></h3>${rv.length?`<ol class="cp-rev">${rv.map(n=>`<li class="${n.cls}">
        <span class="sc">${Math.round(n.score)}</span><span class="tx"><b>${esc(n.name)}</b><small>${esc(String(n.course||'').replace(/^.*? · /,''))}${n.section&&n.section!==n.course?' · '+esc(n.section):''}</small></span>
        ${n.url?`<a href="${esc(n.url)}" target="_blank" rel="noopener" aria-label="Revoir ${esc(n.name)}">Revoir →</a>`:''}</li>`).join('')}</ol>`
      :`<p class="cp-empty">${I.any?'Aucune lacune détectée pour l\'instant — continue comme ça.':'L\'algorithme repère tes points faibles dès 3 questions de quiz ou 2 minutes de travail sur un cours.'}</p>`}</section>`;
    // 3 · livres
    const books=`<section class="cp-sec"><h3>${side?'Rouleaux':'Cours'} <em>${freed} / ${list.length} déroulé${freed>1?'s':''}</em></h3>${list.length?`<ul class="ovl-c">${list.map((c,i)=>{const cm=Math.round((c.mastery||0)*100),fr=(c.mastery||0)>=BOOK_FREE;
        return `<li data-i="${i}" class="${fr?'fr':''}${c.url?' lk':''}"><i class="bk" style="--bk:${BOOK_COLS[i%BOOK_COLS.length]}"></i><span class="oc-n">${esc(c.name)}</span>
          <span class="oc-b"><i style="width:${cm}%"></i><s style="left:${BOOK_FREE*100}%"></s></span><span class="oc-p">${cm}%</span>
          <span class="oc-s">${fr?'DÉROULÉ':'SCELLÉ'}</span>${c.url?`<a class="oc-a" href="${esc(c.url)}" aria-label="Ouvrir ${esc(c.name)}"></a>`:''}</li>`;}).join('')}</ul>`
      :`<p class="cp-empty">Aucun cours publié pour cette matière pour l'instant — ils apparaîtront ici dès qu'ils seront ajoutés.</p>`}</section>`;
    // 4 · chiffres utiles
    const rate=I.total?Math.round(I.correct/I.total*100):null;
    const kpi=`<section class="cp-kpi">
      <div><small>Temps de travail</small><b>${fmtDuree(S.time||Math.round(I.ms/1000))}</b></div>
      <div><small>Réussite aux quiz</small><b>${rate===null?'—':rate+' %'}</b>${rate===null?'':`<span class="mini"><i style="width:${rate}%"></i></span>`}</div>
      <div><small>Questions</small><b>${I.total||S.quiz||0}</b></div>
      <div><small>Dernière séance</small><b>${S.last?fmtDate(S.last):'—'}</b></div></section>`;
    // 5 · programme (replié)
    const inf=SUBJ_INFO[sj.key]||{resume:'',reperes:[]};
    const prg=`<details class="cp-prg"><summary>Programme de la matière</summary><p class="ovl-r">${esc(inf.resume)}</p><ul class="ovl-rep">${inf.reperes.map(r=>`<li>${esc(r)}</li>`).join('')}</ul></details>`;
    $('.ovl-in').innerHTML=`<header class="cp-head"><p class="ovl-k">${String(sj.idx).padStart(2,'0')} · ${where}${data.real?'':' · <span class="demo">DÉMO</span>'}</p><h2 class="ovl-t">${esc(sj.name)}</h2></header>${prog}${rev}${books}${kpi}${prg}`;
    $('.ovl-in').scrollTop=0;
    o.classList.toggle('cave',side);o.classList.toggle('m-ice',mode==='ice');o.classList.toggle('m-sand',mode==='sand');
    $('.ovl-close').textContent=side?'Remonter ↑':'Fermer';
    // clic sur une ligne de cours : ouvre le cours
    o.querySelectorAll('.ovl-c li.lk').forEach(li=>li.addEventListener('click',e=>{if(e.target.closest('a'))return;const a=li.querySelector('a.oc-a');if(a)window.location.href=a.href;}));
    st.open=true;o.classList.add('on');o.setAttribute('aria-hidden','false');if(!side)$('.ovl-close').focus({preventScroll:true});
    // animations : la barre se remplit, puis la flamme compte jusqu'au record et « saute »
    const bar=$('.cp-bar i'),num=$('.cp-flame b'),fx=$('.cp-flame');
    bar.style.width='0%';cancelAnimationFrame(raf);clearTimeout(tm);
    const delay=side?1150:250;
    tm=setTimeout(()=>{bar.style.width=bar.dataset.w+'%';
      const N=+num.dataset.n;if(!N)return;const t0=performance.now(),D=Math.min(1400,500+N*60);
      const stp=now=>{const k=Math.min(1,(now-t0)/D);num.textContent=String(Math.round(N*(1-Math.pow(1-k,3))));if(k<1)raf=requestAnimationFrame(stp);else{fx.classList.remove('pop');void fx.offsetWidth;fx.classList.add('pop');}};
      raf=requestAnimationFrame(stp);},delay);
  }
  $('.ovl-close').addEventListener('click',()=>{if(o.classList.contains('cave')&&typeof caveExit==='function')caveExit();else close();});
  o.addEventListener('click',e=>{if(e.target===o)close();});
  window.addEventListener('keydown',e=>{if(e.key==='Escape'&&!o.classList.contains('cave'))close();});
  return {open,close,st};
}

/* ═══ 27 · Jungle tropicale : fromagers, arbres de canopée, sous-bois, palmiers, bananiers,
   colocases, fougères, cacaoyers, bambous, lianes, mousses pendantes, troncs couchés ═══
   Tout est texturé avec des images peintes en amont (01b_tex) et filtrées par la carte graphique :
   - troncs : écorces (couleur + relief + rugosité) enroulées sans couture, mousse dans les creux ;
   - couronnes : touffes de rameaux feuillus (atlas 4×4) disposés en étoile, ombrées comme un
     volume, traversées par la lumière (translucidité), avec un cœur sombre qui donne la densité ;
   - grandes feuilles (bananier, colocase), palmes, fougères : vraies géométries + textures ;
   - forêt lointaine : volumes texturés « canopée » aux contours découpés en feuillage.
   Alpha anticrénelé (alpha-to-coverage) et compensé avec la distance : pas de grésillement,
   pas de feuillage qui s'évapore au loin. */

/* ── écorces : texture et pas de répétition (m) par type de tube ── */
const BARK={0:'bark_kapok',1:'bark_rough',3:'bark_vine',4:'bark_palm',5:'bark_stem',6:'bark_fern'};
const BARK_TILE={0:2.6,1:1.5,3:0.8,4:1.4,5:1.1,6:0.7};
const BARK_MOSS={0:0.75,1:1.0,3:0.35,4:0.3,5:0.0,6:0.55};
/* tube le long d'une courbe : la texture fait un nombre entier de tours (pas de couture) */
function tubeGeo(P,rad,segs,type,flute){
  const n=P.length,pos=[],uv=[],bk=[],idx=[];const tile=BARK_TILE[type]||1.2;
  let rm=0;for(const r of rad)rm+=r;rm/=n;const nU=Math.max(1,Math.round(2*Math.PI*rm*1.15/tile));
  const vOff=((P[0].x*0.37+P[0].z*0.71)%1+1)%1*7;
  const tang=i=>P[Math.min(n-1,i+1)].clone().sub(P[Math.max(0,i-1)]).normalize();
  const T=tang(0),N=new THREE.Vector3(1,0,0);if(Math.abs(T.dot(N))>0.9)N.set(0,0,1);
  N.sub(T.clone().multiplyScalar(N.dot(T))).normalize();const B=new THREE.Vector3().crossVectors(T,N);
  let along=0;
  for(let i=0;i<n;i++){
    if(i>0){const Tn=tang(i);const ax=new THREE.Vector3().crossVectors(T,Tn);const s=ax.length();
      if(s>1e-6){const ang=Math.asin(Math.min(1,s));ax.normalize();N.applyAxisAngle(ax,ang);B.applyAxisAngle(ax,ang);}T.copy(Tn);along+=P[i].distanceTo(P[i-1]);}
    for(let k=0;k<=segs;k++){const a=k/segs*Math.PI*2,ca=Math.cos(a),sa=Math.sin(a);
      const r=rad[i]*(1+(flute?flute(i/(n-1),a):0));
      const dx=N.x*ca+B.x*sa,dy=N.y*ca+B.y*sa,dz=N.z*ca+B.z*sa;
      pos.push(P[i].x+dx*r,P[i].y+dy*r,P[i].z+dz*r);uv.push(k/segs*nU,along/tile+vOff);bk.push(along,rad[i]);}
  }
  for(let i=0;i<n-1;i++)for(let k=0;k<segs;k++){const a=i*(segs+1)+k,b=a+1,c=a+segs+1,d=c+1;idx.push(a,b,c,b,d,c);}
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  g.setAttribute('aBk',new THREE.Float32BufferAttribute(bk,2));g.setIndex(idx);g.computeVertexNormals();
  // couture : on moyenne les normales des deux bords
  const nr=g.attributes.normal;
  for(let i=0;i<n;i++){const a=i*(segs+1),b=a+segs;const x=nr.getX(a)+nr.getX(b),y=nr.getY(a)+nr.getY(b),z=nr.getZ(a)+nr.getZ(b),l=Math.hypot(x,y,z)||1;nr.setXYZ(a,x/l,y/l,z/l);nr.setXYZ(b,x/l,y/l,z/l);}
  return g;
}
/* ── touffe de rameaux : cartes partant du centre en étoile (chaque carte = un rameau de l'atlas) ── */
function twigClumpGeo(K,seed){
  const pos=[],nor=[],uv=[],cid=[],idx=[];const rr=mulberry32(seed);const up=new THREE.Vector3(0,1,0),X=new THREE.Vector3(1,0,0);
  for(let k=0;k<K;k++){
    const d=new THREE.Vector3(rr()*2-1,rr()*1.3-0.32,rr()*2-1).normalize();
    const base=new THREE.Vector3(rr()-0.5,(rr()-0.5)*0.6,rr()-0.5).multiplyScalar(0.4);
    const L=0.72+rr()*0.42,W=L*0.94;
    const sd=new THREE.Vector3().crossVectors(d,Math.abs(d.y)>0.92?X:up).normalize();sd.applyAxisAngle(d,(rr()-0.5)*1.5);
    const b=pos.length/3,c=rr();const P0=base.clone().addScaledVector(d,-0.06*L);
    [[0,0],[1,0],[1,1],[0,1]].forEach(([s,w])=>{
      const p=P0.clone().addScaledVector(sd,(s-0.5)*W).addScaledVector(d,w*L);p.y-=w*L*0.16;
      pos.push(p.x,p.y,p.z);const q=p.clone().normalize().multiplyScalar(0.8).add(new THREE.Vector3(0,0.42,0)).normalize();nor.push(q.x,q.y,q.z);uv.push(s,w);cid.push(c);});
    idx.push(b,b+1,b+2,b,b+2,b+3);
  }
  return cardGeo(pos,nor,uv,cid,idx);
}
/* plante vue de côté : cartes verticales croisées autour de l'axe (pied en bas) */
function crossGeo(K,seed){
  const pos=[],nor=[],uv=[],cid=[],idx=[];const rr=mulberry32(seed);
  for(let k=0;k<K;k++){const a=k/K*Math.PI+rr()*0.4,ca=Math.cos(a),sa=Math.sin(a),lean=(rr()-0.5)*0.25,c=rr(),b=pos.length/3;
    [[0,0],[1,0],[1,1],[0,1]].forEach(([s,w])=>{const x=(s-0.5)*ca+lean*w*sa,z=(s-0.5)*sa-lean*w*ca,y=w-0.04;pos.push(x,y,z);
      const q=new THREE.Vector3(x*0.6,0.75,z*0.6).normalize();nor.push(q.x,q.y,q.z);uv.push(s,w);cid.push(c);});
    idx.push(b,b+1,b+2,b,b+2,b+3);}
  return cardGeo(pos,nor,uv,cid,idx);
}
/* rideau pendant (mousse, racines aériennes) : accroché en haut (y = 0), tombe jusqu'à y = -1 */
function drapeGeo(){
  const pos=[],nor=[],uv=[],cid=[],idx=[];
  for(let k=0;k<2;k++){const a=k*Math.PI/2+0.3,ca=Math.cos(a),sa=Math.sin(a),b=pos.length/3,c=k*0.5+0.2;
    [[0,0],[1,0],[1,1],[0,1]].forEach(([s,w])=>{pos.push((s-0.5)*ca,w-1,(s-0.5)*sa);nor.push(-sa*0.4,0.9,ca*0.4);uv.push(s,w);cid.push(c);});
    idx.push(b,b+1,b+2,b,b+2,b+3);}
  return cardGeo(pos,nor,uv,cid,idx);
}
function cardGeo(pos,nor,uv,cid,idx){
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('aCid',new THREE.Float32BufferAttribute(cid,1));g.setIndex(idx);
  g.computeBoundingSphere();return g;
}
/* ── fougère : frondes arquées ── */
function fernGeo(F,L0){
  const pos=[],uv=[],idx=[];const rr=mulberry32(909+F);const S=7;
  for(let f=0;f<F;f++){const a=f/F*Math.PI*2+rr()*0.5,e=0.85+rr()*0.4,L=L0*(1.0+rr()*0.45);
    const dh=new THREE.Vector3(Math.cos(a),0,Math.sin(a)),side=new THREE.Vector3(-dh.z,0,dh.x);const b=pos.length/3;
    for(let j=0;j<=S;j++){const s=j/S;const c=dh.clone().multiplyScalar(L*s*0.9).add(new THREE.Vector3(0,L*(s*Math.sin(e)-0.85*s*s)+0.05,0));
      const w=0.25*L;
      [-1,1].forEach(k=>{const p=c.clone().addScaledVector(side,k*w).add(new THREE.Vector3(0,-0.1*w,0));pos.push(p.x,p.y,p.z);uv.push(s,k);});}
    for(let j=0;j<S;j++){const q=b+j*2;idx.push(q,q+1,q+2,q+1,q+3,q+2);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);
  g.computeVertexNormals();return g;
}
function rockGeo(){
  let g=new THREE.IcosahedronGeometry(1,MOBILE?2:3);g.deleteAttribute('uv');g.deleteAttribute('normal');g=mergeVertices(g);
  const p=g.attributes.position;
  for(let i=0;i<p.count;i++){let x=p.getX(i),y=p.getY(i),z=p.getZ(i);
    const k=1+0.3*(vn3(x*1.3+3,y*1.3,z*1.3)-0.5)*2+0.1*(vn3(x*3.6,y*3.6+7,z*3.6)-0.5)*2;x*=k;y*=k;z*=k;
    y=Math.max(y,-0.32);if(x>0.62)x=0.62+(x-0.62)*0.3;if(z<-0.7)z=-0.7+(z+0.7)*0.3;
    p.setXYZ(i,x,y,z);}
  g.computeVertexNormals();return g;
}
/* volume plein de canopée (bosses irrégulières) */
function blobGeo(flat=true){
  let g=new THREE.IcosahedronGeometry(1,1);g.deleteAttribute('uv');g.deleteAttribute('normal');g=mergeVertices(g);
  const p=g.attributes.position,ao=new Float32Array(p.count);
  for(let i=0;i<p.count;i++){let x=p.getX(i),y=p.getY(i),z=p.getZ(i);
    const n=vn3(x*2.1+5,y*2.1,z*2.1)*0.6+vn3(x*4.3,y*4.3+3,z*4.3)*0.4;const k=0.76+n*0.46;ao[i]=n;
    if(flat)y=y<-0.2?-0.2+(y+0.2)*0.35:y;p.setXYZ(i,x*k,y*k,z*k);}
  g.setAttribute('aAO',new THREE.BufferAttribute(ao,1));g.computeVertexNormals();return g;
}
/* cabosse de cacao : fuseau côtelé (10 côtes), pointe en bas */
function podGeo(){
  const pts=[];for(let i=0;i<=9;i++){const t=i/9;pts.push(new THREE.Vector2(Math.max(0.004,Math.pow(Math.sin(Math.PI*Math.pow(t,0.8)),0.75)*0.5*(1-0.3*(1-t))),t-0.5));}
  let g=new THREE.LatheGeometry(pts,12);g.deleteAttribute('uv');g.deleteAttribute('normal');g=mergeVertices(g);
  const p=g.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),a=Math.atan2(z,x);const k=1+0.09*Math.pow(Math.abs(Math.cos(5*a)),0.6);p.setX(i,x*k);p.setZ(i,z*k);}
  g.computeVertexNormals();return g;
}
/* ── grandes feuilles en vraie géométrie ── */
// feuille de bananier : longue palette arquée ; la tige à l'origine, la feuille vers +x ; uv = (travers −1..1, long 0..1)
function bananaLeafGeo(L,W,droop,lo){
  const NS=lo?8:14,NT=lo?4:6,pos=[],uv=[],idx=[];
  const mid=s=>new THREE.Vector3(s*L*0.95,L*(0.32*s-droop*s*s),0);
  for(let i=0;i<=NS;i++){const s=i/NS;const w=W*Math.pow(Math.sin(Math.PI*Math.min(1,0.08+s*0.95)),0.7)*(1-0.15*s);
    for(let j=0;j<=NT;j++){const t=j/NT*2-1;const p=mid(s).add(new THREE.Vector3(0,-Math.abs(t)*w*0.22+t*t*w*0.06,t*w));pos.push(p.x,p.y,p.z);uv.push(t,s);}}
  for(let i=0;i<NS;i++)for(let j=0;j<NT;j++){const a=i*(NT+1)+j,b=a+1,c=a+NT+1,d=c+1;idx.push(a,b,c,b,d,c);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}
// feuille de colocase (« oreille d'éléphant ») : cœur à lobes basaux, pointe vers +x
function heartLeafGeo(L,W,lo){
  const NS=lo?6:10,NT=lo?3:5,parts=[];
  for(const sg of [1,-1]){const pos=[],uv=[],idx=[];
    for(let i=0;i<=NS;i++){const s=-0.38+i/NS*1.38;
      const w=s<0?W*0.82*Math.sqrt(Math.max(0,1-Math.pow(s/0.38,2)))*0.95+0.02:W*Math.pow(Math.max(0,1-s),0.75)*(0.9+0.4*Math.sin(Math.PI*Math.min(1,s*1.4)))*0.82;
      const notch=s<0?(-s/0.38)*W*0.32:0;
      for(let j=0;j<=NT;j++){const t=j/NT;const x=s*L,zz=sg*(notch+t*(w-notch));
        const y=-Math.pow(Math.abs(zz)/W,2)*0.12*L+(s>0?-s*s*0.22*L:0);pos.push(x,y,zz);uv.push(zz/(W*1.05),(s+0.38)/1.38);}}
    for(let i=0;i<NS;i++)for(let j=0;j<NT;j++){const a=i*(NT+1)+j,b=a+1,c=a+NT+1,d=c+1;if(sg>0)idx.push(a,b,c,b,d,c);else idx.push(a,c,b,b,c,d);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);parts.push(g);}
  const g=mergeGeometries(parts);g.computeVertexNormals();return g;
}
// palme de cocotier : rachis arqué, ruban plié en V dont les folioles (texture) retombent
function palmFrondGeo(L){
  const NS=14,pos=[],uv=[],idx=[];
  const mid=s=>new THREE.Vector3(s*L*0.95,L*(0.3*s-0.62*s*s),0);
  for(let i=0;i<=NS;i++){const s=i/NS,c=mid(s),w=L*0.27*Math.pow(Math.sin(Math.PI*Math.min(1,0.1+s*0.93)),0.55)+0.03;
    for(const t of [-1,0,1]){const p=c.clone().add(new THREE.Vector3(0,-Math.abs(t)*w*(0.38+0.45*s),t*w*0.9));pos.push(p.x,p.y,p.z);uv.push(s,t);}}
  for(let i=0;i<NS;i++)for(let j=0;j<2;j++){const a=i*3+j,b=a+1,c=a+3,d=c+1;idx.push(a,b,c,b,d,c);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}

/* ── GLSL partagé ── */
/* repère tangent par dérivées d'écran (normal maps sans attribut de tangente) */
const GLSL_TBN=`mat3 rvTBN(vec3 p,vec3 N,vec2 uv){vec3 q0=dFdx(p),q1=dFdy(p);vec2 s0=dFdx(uv),s1=dFdy(uv);
  vec3 q1p=cross(q1,N),q0p=cross(N,q0);vec3 T=q1p*s0.x+q0p*s1.x;vec3 B=q1p*s0.y+q0p*s1.y;
  float d=max(dot(T,T),dot(B,B));float sc=d==0.0?0.0:inversesqrt(d);return mat3(T*sc,B*sc,N);}`;
/* translucidité : la lumière qui traverse la feuille (atténuée par l'ombre portée) */
// (une feuille mince ne doit pas se faire d'ombre à elle-même : on part de la lumière non ombrée,
//  atténuée en partie seulement par la carte d'ombre — rvTSelf : part de lumière qui passe malgré l'ombre)
const GLSL_TRANS=`vec3 rvTC=vec3(0.0);vec3 rvUn=vec3(0.0);float rvTSelf=0.5;
  void rvTrans(IncidentLight L,vec3 V,vec3 N,inout ReflectedLight rl){
    float sh=clamp(dot(L.color,vec3(1.0))/max(dot(rvUn,vec3(1.0)),1e-4),0.0,1.0);vec3 lc=rvUn*mix(sh,1.0,rvTSelf);
    float fw=pow(clamp(dot(V,-L.direction),0.0,1.0),3.0);float bk=clamp(dot(-N,L.direction),0.0,1.0);
    rl.directDiffuse+=lc*rvTC*(fw*2.0+bk*0.65)*RECIPROCAL_PI;}`;
const RV_RE='RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );';
function rvAddTrans(sh){let c=THREE.ShaderChunk.lights_fragment_begin.split(RV_RE).join(RV_RE+'rvTrans(directLight,geometryViewDir,geometryNormal,reflectedLight);');
  for(const g of ['getDirectionalLightInfo( directionalLight, directLight );','getPointLightInfo( pointLight, geometryPosition, directLight );','getSpotLightInfo( spotLight, geometryPosition, directLight );'])c=c.split(g).join(g+'rvUn=directLight.color;');
  sh.fragmentShader=sh.fragmentShader.replace('#include <lights_fragment_begin>',c);}
/* alpha net à toute distance : compensation des mipmaps, puis rampe d'un pixel (alpha-to-coverage) */
const GLSL_AA_ALPHA=`float rvAA(float a){return clamp((a-0.5)/max(fwidth(a),1e-4)+0.5,0.0,1.0);}
  float rvMipA(float a,vec2 uv,float res){vec2 d=fwidth(uv)*res;return a*(1.0+max(0.0,log2(max(max(d.x,d.y),1e-6)))*0.3);}`;
/* touffes du temple (04_pagode) : rameau de l'atlas choisi par la graine */
const GLSL_LEAF=`uniform sampler2D uAtlas;float rvLeafH=0.5;vec3 rvLeafC=vec3(1.0);
  float rvLeafA(vec2 uv,float seed,float kind){float cell=floor(fract(seed*0.731)*4.0);
    vec2 a=vec2((cell+0.012+uv.x*0.976)*0.25,(3.0+0.012+uv.y*0.976)*0.25);vec4 t=texture2D(uAtlas,a);rvLeafC=t.rgb;rvLeafH=fract(seed*3.17);
    vec2 d=fwidth(a)*2048.0;return t.a*(1.0+max(0.0,log2(max(max(d.x,d.y),1e-6)))*0.3);}`;
/* reflets spéculaires du soleil atténués sur le feuillage (sinon, à contre-jour, les feuilles rasantes deviennent des miroirs blancs) */
const RV_SOFTSPEC=k=>[['#include <aomap_fragment>','reflectedLight.directSpecular*='+k.toFixed(2)+';\n#include <aomap_fragment>']];
const GLSL_DEPTHFIX=sh=>{sh.vertexShader=sh.vertexShader.replace('vec3 rvN3=objectNormal;','vec3 rvN3=normal;');};

function buildProps(pyr){
  const grp=new THREE.Group();scene.add(grp);
  const rr=mulberry32(31337);
  const TR={0:[],1:[],3:[],4:[],5:[],6:[]};          // troncs par écorce
  const tube=(P,rad,segs,type,flute)=>TR[type].push(tubeGeo(P,rad,segs,type,flute));
  const clumps=[],crosses=[],drapes=[];               // feuillage (atlas) : {p,s,yaw,kind,col,crown,sway}
  const big=[],palmG=[],ferns=[],pods=[];
  const blobs=[];                                     // volumes de canopée (loin) et cœurs de couronnes
  const V=(x,y,z)=>new THREE.Vector3(x,y,z);
  const tint=(b,j,h=0)=>{const k=b*(1+(rr()-0.5)*j);return new THREE.Color(k*(1+h*(rr()-0.5)),k*(1+(rr()-0.5)*0.12),k*(1-h*(rr()-0.5)*1.2));};
  const C=JF.cam.clone();C.y=groundH(C.x,C.z);
  const camD=(x,z)=>Math.hypot(x-C.x,z-C.z);
  const toLake=(x,z)=>V(-x,0,-z).normalize();
  const sector=(x,z)=>Math.floor((Math.atan2(x,z)+Math.PI)/(Math.PI*2)*10)%10;
  const inZone=JF.inZone||(()=>false);
  // couronne : touffes sur la coque d'un ellipsoïde (plus serrées dessus), cœur sombre au centre
  function crown(cc,Rx,Ry,kind,base,sway,opt={}){
    const d=camD(cc.x,cc.z),sc0=(opt.sc||1.3)*(1+0.7*smooth(45,150,d)),area=2*Math.PI*Rx*(Rx+Ry)*0.8;
    const NC=Math.round(Math.min(opt.max||72,Math.max(opt.min||12,area/(Math.PI*sc0*sc0)*(opt.cov||0.72))));const cr=[cc.x,cc.y,cc.z,Rx];
    for(let k=0;k<NC;k++){const th=rr()*Math.PI*2,y=Math.pow(rr(),0.7)*1.5-0.5,rh=Math.sqrt(Math.max(0.05,1-y*y*0.8))*(0.72+rr()*0.3);
      const p=cc.clone().add(V(Math.cos(th)*rh*Rx,y*Ry*0.9,Math.sin(th)*rh*Rx));const sc=sc0*(0.8+rr()*0.45);
      clumps.push({p,s:[sc,sc*0.85,sc],yaw:th,kind,col:base.clone().multiplyScalar(0.85+rr()*0.3),crown:cr,sway});}
    if(opt.core!==false){const nb=Rx>6?3:2;for(let j=0;j<nb;j++){const o=V((rr()-0.5)*Rx*0.5,(rr()-0.4)*Ry*0.4,(rr()-0.5)*Rx*0.5);
      blobs.push({p:cc.clone().add(o),s:V(Rx*(0.42+rr()*0.12),Ry*(0.4+rr()*0.12),Rx*(0.42+rr()*0.12)),c:tint(2.0,0.2,0.1),yaw:rr()*6.28,sec:sector(cc.x,cc.z),core:1});}}
    return cr;
  }

  /* ───── fromager (kapok) : contreforts, fût immense, couronne en parasol, épiphytes, lianes ───── */
  function kapok(t){
    const H=34+rr()*10,r0=1.0+rr()*0.45,lean=toLake(t.x,t.z).multiplyScalar(1.5+rr()*2);
    const axis=y=>{const u=clamp01((y+0.8)/H);return V(t.x+lean.x*u*u+Math.sin(u*6+t.seed*20)*0.2,t.y+y,t.z+lean.z*u*u+Math.cos(u*5+t.seed*15)*0.2);};
    const P=[],rad=[];const n=26;
    for(let i=0;i<=n;i++){const u=i/n,y=-0.8+u*(H+0.8);P.push(axis(y));rad.push(r0*Math.pow(1-u*0.9,0.7)*(1+0.35*Math.exp(-Math.max(y,0)/3))+0.1);}
    const ph=t.seed*20;
    tube(P,rad,26,0,(u,a)=>{const y=u*H;return 1.7*Math.pow(Math.max(0,Math.sin(5*a+ph)),3)*Math.exp(-y/3.2)+0.03*Math.sin(17*a+u*30);});
    const top=axis(H*0.8),crownC=axis(H).add(V(0,1.5,0)),Rc=11+rr()*5;
    const base=tint(1.55,0.2,0.15),sway=[t.x,t.z,t.y,0.22/(H*H)];
    const cr=crown(crownC,Rc,4.2,0,base,sway,{sc:1.6,max:90,cov:0.62,core:false});
    const NB=6+Math.floor(rr()*3);
    for(let k=0;k<NB;k++){const a=k/NB*Math.PI*2+rr()*0.5,Ll=Rc*(0.7+rr()*0.3);const dh=V(Math.cos(a),0,Math.sin(a));const BP=[],BR=[];
      for(let j=0;j<=7;j++){const s=j/7;BP.push(top.clone().addScaledVector(dh,Ll*s).add(V(0,Ll*(0.42*s-0.2*s*s)+H*0.02*s,0)));BR.push(r0*0.42*(1-s*0.8));}
      tube(BP,BR,10,0);(JF.kapokBranches=JF.kapokBranches||[]).push(BP.map(v=>v.clone()));
      // rameaux au bout de la branche
      for(let q=0;q<4;q++){const s=0.5+q*0.15;const bp=BP[Math.min(7,Math.round(s*7))];const sc=1.7+rr()*0.6;
        clumps.push({p:bp.clone().add(V((rr()-0.5)*2.5,0.8+rr()*1.4,(rr()-0.5)*2.5)),s:[sc,sc*0.8,sc],yaw:rr()*6.28,kind:0,col:base.clone(),crown:cr,sway});}
      // broméliacées posées sur la branche
      for(let q=0;q<2;q++){const bp=BP[2+Math.floor(rr()*4)];const sc=0.9+rr()*0.5;
        crosses.push({p:bp.clone().add(V(0,BR[3]*0.8,0)),s:[sc,sc*0.8,sc],yaw:rr()*6.28,kind:6,col:tint(1.5,0.2),crown:[bp.x,bp.y,bp.z,2],sway:[bp.x,bp.z,bp.y,0.0]});}
      // mousse et racines aériennes qui pendent
      for(let q=0;q<3;q++){const bp=BP[1+Math.floor(rr()*6)];const L=2.5+rr()*5;const w=1.2+rr()*1.0;
        drapes.push({p:bp.clone().add(V(0,-BR[3]*0.5,0)),s:[w,L,w],yaw:rr()*6.28,kind:rr()<0.6?5:4,col:tint(1.4,0.25),crown:[bp.x,bp.y-L*0.5,bp.z,L],sway:[bp.x,bp.z,bp.y,0.06/(L*L)]});}
      // lianes : elles tombent des branches jusqu'au sol, en courbes molles
      for(let q=0;q<2;q++){const s0=0.4+rr()*0.55,a0=BP[Math.round(s0*7)].clone();const g2=V(a0.x+(rr()-0.5)*4,0,a0.z+(rr()-0.5)*4);g2.y=groundH(g2.x,g2.z)-0.3;
        const LP=[];for(let j=0;j<=16;j++){const s=j/16;const p=a0.clone().lerp(g2,s);p.x+=Math.sin(s*Math.PI)*(rr()-0.5)*1.5;p.z+=Math.sin(s*Math.PI*2)*0.4;LP.push(p);}
        tube(LP,LP.map((_,j)=>0.07+0.03*Math.sin(j*1.3)),5,3);}
    }
    // philodendrons grimpants sur le fût
    for(let q=0;q<7;q++){const y=3+rr()*H*0.55,a=rr()*6.28;const p=axis(y).add(V(Math.cos(a)*rad[Math.round(y/H*n)]*1.05,0,Math.sin(a)*rad[Math.round(y/H*n)]*1.05));const sc=1.1+rr()*0.5;
      clumps.push({p,s:[sc,sc,sc],yaw:a,kind:1,col:tint(1.5,0.2),crown:[p.x,p.y,p.z,1.5],sway:[p.x,p.z,p.y,0.0]});}
  }
  /* ───── arbre de canopée : tronc, maîtresses branches, dôme dense ───── */
  function broad(t){
    const sdT=shoreD(t.x,t.z),H=(sdT<9?7:11)+rr()*(sdT<9?4:9),r0=0.4+rr()*0.3+H*0.022;
    const P=[],rad=[];for(let i=0;i<=10;i++){const u=i/10,y=-0.5+u*(H+0.5);P.push(V(t.x+Math.sin(u*4+t.seed*9)*0.3,t.y+y,t.z+Math.cos(u*5+t.seed*7)*0.3));rad.push(r0*(1+0.7*Math.exp(-Math.max(y,0)/1.1))*(1-u*0.3));}
    tube(P,rad,12,1,(u,a)=>0.3*Math.pow(Math.max(0,Math.sin(4*a+t.seed*9)),2)*Math.exp(-u*5));
    const top=P[P.length-1],Rx=5+rr()*3.5,Ry=4.2+rr()*2.6;const cc=top.clone().add(V(0,Ry*0.85,0));
    const nL=4+Math.floor(rr()*2);for(let k=0;k<nL;k++){const a=k/nL*Math.PI*2+rr()*0.7,Ll=Rx*0.75;const dh=V(Math.cos(a),0,Math.sin(a));
      tube([P[P.length-3],top.clone().addScaledVector(dh,Ll*0.45).add(V(0,Ry*0.5,0)),top.clone().addScaledVector(dh,Ll).add(V(0,Ry*0.85,0))],[r0*0.5,r0*0.32,r0*0.12],7,1);}
    const pk=rr(),base=pk<0.4?tint(1.45,0.2,0.15):pk<0.8?tint(1.7,0.2,0.15):tint(1.95,0.15,0.25);
    const kind=rr()<0.18?3:0;   // quelques arbres à grandes feuilles
    const cr=crown(cc,Rx,Ry,kind,base,[t.x,t.z,t.y,0.3/(Ry*Ry*12)]);
    if(rr()<0.35){const bp=P[7];for(let q=0;q<2;q++){const L=3+rr()*5,w=1+rr();drapes.push({p:top.clone().add(V((rr()-0.5)*Rx,Ry*0.2,(rr()-0.5)*Rx)),s:[w,L,w],yaw:rr()*6.28,kind:5,col:tint(1.3,0.25),crown:[bp.x,bp.y,bp.z,L],sway:[bp.x,bp.z,top.y,0.05/(L*L)]});}}
    return cr;
  }
  /* ───── petit arbre du sous-étage : remplit le mur de jungle ───── */
  function under(t){
    const H=4+rr()*4,r0=0.12+rr()*0.08;
    const P=[],rad=[];for(let i=0;i<=6;i++){const u=i/6;P.push(V(t.x+Math.sin(u*3+t.seed*9)*0.25,t.y-0.3+u*H,t.z+Math.cos(u*4+t.seed*7)*0.25));rad.push(r0*(1-u*0.4)*(1+0.5*Math.exp(-u*8)));}
    tube(P,rad,7,1);
    const cc=P[6].clone().add(V(0,0.6,0)),R=2.2+rr()*1.4;
    crown(cc,R,R*0.8,rr()<0.3?3:1,tint(1.6,0.25,0.15),[t.x,t.z,t.y,0.05/(H*H)],{sc:1.05,min:9,max:22,cov:0.6,core:R>2.8});
  }
  /* ───── cacaoyer : tronc bas qui fourche, grandes feuilles pendantes, cabosses sur le tronc ───── */
  const POD=[new THREE.Color(0.62,0.42,0.06),new THREE.Color(0.55,0.24,0.05),new THREE.Color(0.36,0.09,0.06),new THREE.Color(0.26,0.33,0.06)];
  function cacao(t){
    const H0=1.6+rr()*0.8,H=4.2+rr()*1.6,r0=0.11+rr()*0.04;
    const P=[V(t.x,t.y-0.2,t.z),V(t.x+0.05,t.y+H0*0.5,t.z-0.04),V(t.x,t.y+H0,t.z)];tube(P,[r0*1.3,r0*1.05,r0],8,1);
    const top=P[2],NB=3+Math.floor(rr()*2),cc=top.clone().add(V(0,(H-H0)*0.62,0)),cr=[cc.x,cc.y,cc.z,2.6];
    for(let k=0;k<NB;k++){const a=k/NB*Math.PI*2+rr()*0.6,dh=V(Math.cos(a),0,Math.sin(a));
      const B=[top,top.clone().addScaledVector(dh,0.8).add(V(0,(H-H0)*0.4,0)),top.clone().addScaledVector(dh,1.7).add(V(0,(H-H0)*0.75,0))];tube(B,[r0*0.75,r0*0.5,r0*0.25],6,1);
      for(let q=0;q<5;q++){const p=B[2].clone().add(V((rr()-0.5)*1.6,(rr()-0.3)*1.2,(rr()-0.5)*1.6));const sc=1.15+rr()*0.4;
        clumps.push({p,s:[sc,sc*0.9,sc],yaw:rr()*6.28,kind:3,col:tint(1.6,0.2,0.2),crown:cr,sway:[t.x,t.z,t.y,0.04/(H*H)]});}
      // cabosses sur la branche basse
      for(let q=0;q<2;q++){const s=0.2+rr()*0.5;const p=B[0].clone().lerp(B[1],s);pods.push({p:p.add(V(Math.cos(a+1.5)*r0*0.9,-0.12,Math.sin(a+1.5)*r0*0.9)),yaw:rr()*6.28,tilt:0.25+rr()*0.3,s:0.85+rr()*0.3,c:POD[Math.floor(rr()*4)]});}}
    // cabosses accrochées au tronc (cauliflorie)
    for(let q=0;q<6+Math.floor(rr()*5);q++){const y=0.35+rr()*(H0-0.2),a=rr()*6.28;
      pods.push({p:V(t.x+Math.cos(a)*r0*1.25,t.y+y,t.z+Math.sin(a)*r0*1.25),yaw:a,tilt:0.15+rr()*0.25,s:0.9+rr()*0.35,c:POD[Math.floor(rr()*4)]});}
  }
  /* ───── cocotier : stipe annelé penché vers l'eau, couronne de palmes ───── */
  function palm(t,scale=1,dirOverride){
    const H=(9+rr()*6)*scale,lean=(dirOverride||toLake(t.x,t.z)).clone().multiplyScalar(H*(0.25+rr()*0.25));
    const P=[],rad=[];for(let i=0;i<=14;i++){const u=i/14;P.push(V(t.x+lean.x*u*u,t.y-0.3+u*H,t.z+lean.z*u*u));rad.push(0.22*scale*(1.2-u*0.35)+0.04+0.12*scale*Math.exp(-u*14));}
    tube(P,rad,10,4);
    const top=P[P.length-1];const NF=14+Math.floor(rr()*5);
    for(let f=0;f<NF;f++){const L=(3.8+rr()*1.8)*scale;const g=palmFrondGeo(L);
      const az=f/NF*Math.PI*2+rr()*0.3,el=-0.2+rr()*0.95;
      g.rotateX((rr()-0.5)*0.5);g.rotateZ(el*0.6);g.rotateY(az);g.translate(top.x,top.y,top.z);
      const n=g.attributes.position.count,a=new Float32Array(n*4);const fr=g.attributes.uv;
      for(let i=0;i<n;i++)a.set([fr.getX(i),t.x,t.z,f+t.seed*10],i*4);g.setAttribute('aPf',new THREE.BufferAttribute(a,4));
      const c=tint(1.35,0.2,0.15);if(rr()<0.1)c.setRGB(1.6,1.15,0.55);const cc=new Float32Array(n*3);for(let i=0;i<n;i++)cc.set([c.r,c.g,c.b],i*3);g.setAttribute('color',new THREE.BufferAttribute(cc,3));
      palmG.push(g);}
    // noix de coco
    palm.lastTop=top.clone();
    for(let k=0;k<5;k++){const g=new THREE.SphereGeometry(0.17*scale,10,8);const a=k*1.3;g.translate(top.x+Math.cos(a)*0.26,top.y-0.28,top.z+Math.sin(a)*0.26);
      g.deleteAttribute('uv');const n=g.attributes.position.count;const uvA=new Float32Array(n*2);for(let i=0;i<n;i++){uvA[i*2]=0.5;uvA[i*2+1]=0.0;}g.setAttribute('uv',new THREE.BufferAttribute(uvA,2));
      g.setAttribute('aPf',new THREE.BufferAttribute(new Float32Array(n*4),4));const cc=new Float32Array(n*3);for(let i=0;i<n;i++){cc[i*3]=0.18;cc[i*3+1]=0.13;cc[i*3+2]=0.05;}g.setAttribute('color',new THREE.BufferAttribute(cc,3));palmG.push(g);}
    return top.clone();
  }
  /* grande feuille posée : géométrie + attributs (genre, uv, balancement) */
  function addLeaf(g,kind,c,base,tipK){
    const n=g.attributes.position.count,A=new Float32Array(n*4),cc=new Float32Array(n*3),uv=g.attributes.uv;
    for(let i=0;i<n;i++){A.set([kind,uv.getX(i),uv.getY(i),base],i*4);cc.set([c.r,c.g,c.b],i*3);}
    g.setAttribute('aLf',new THREE.BufferAttribute(A,4));g.setAttribute('color',new THREE.BufferAttribute(cc,3));
    const sw=new Float32Array(n);sw.fill(tipK);g.setAttribute('aLs',new THREE.BufferAttribute(sw,1));
    big.push(g);
  }
  /* ───── bananier : faux-tronc, feuilles immenses déchirées ───── */
  function banana(t,scale=1){
    const H=(2.2+rr()*1.4)*scale;
    tube([V(t.x,t.y-0.2,t.z),V(t.x+0.05,t.y+H*0.5,t.z),V(t.x,t.y+H,t.z)],[0.17*scale,0.14*scale,0.1*scale],9,5);
    const NL=6+Math.floor(rr()*3);
    for(let k=0;k<NL;k++){const L=(2.0+rr()*0.9)*scale,W=(0.36+rr()*0.1)*scale;const g=bananaLeafGeo(L,W,0.4+rr()*0.35,camD(t.x,t.z)>48);
      g.rotateX((rr()-0.5)*0.6);g.rotateZ(0.5+rr()*0.5);g.rotateY(k/NL*Math.PI*2+rr()*0.4);g.translate(t.x,t.y+H*(0.85+rr()*0.15),t.z);
      addLeaf(g,1,tint(1.15,0.2,0.1),t.seed*10+k,0.06*scale);}
  }
  /* ───── colocase : touffe de feuilles en cœur sur de longs pétioles ───── */
  function colocasia(x,z,scale,face){
    const y=groundH(x,z),NL=4+Math.floor(rr()*3);
    for(let k=0;k<NL;k++){const L=(0.9+rr()*0.55)*scale,W=L*0.62;const g=heartLeafGeo(L,W,camD(x,z)>48);
      const az=(face!==undefined?face+(rr()-0.5)*2.2:rr()*6.28),hgt=(0.7+rr()*0.7)*scale,tilt=-0.5-rr()*0.5;
      g.rotateX((rr()-0.5)*0.4);g.rotateZ(tilt);g.rotateY(az);g.translate(x+Math.cos(az)*0.15,y+hgt,z-Math.sin(az)*0.15);
      addLeaf(g,2,tint(1.25,0.25,0.1),rr()*10,0.04*scale);
      const tip=V(x+Math.cos(az)*0.15,y+hgt,z-Math.sin(az)*0.15);tube([V(x,y-0.1,z),V(x,y+hgt*0.5,z).lerp(tip,0.3),tip],[0.035*scale,0.03*scale,0.025*scale],5,5);}
  }

  JF.trees.forEach(t=>{const k=t.kind;
    if(k==='kapok')kapok(t);else if(k==='broad')broad(t);else if(k==='under')under(t);else if(k==='palm')palm(t);else if(k==='banana')banana(t);else if(k==='cacao')cacao(t);
    else if(k==='treefern'){const H=2.5+rr()*3;tube([V(t.x,t.y-0.2,t.z),V(t.x+0.12,t.y+H*0.5,t.z),V(t.x,t.y+H,t.z)],[0.22,0.17,0.15],9,6);
      ferns.push({p:V(t.x,t.y+H-0.1,t.z),s:2.0+rr()*0.7,yaw:rr()*6.28,c:tint(1.3,0.2,0.15),tree:1});}});
  // colocases le long des berges
  for(let k=0,g=0;k<(MOBILE?45:95)&&g<6000;g++){const a=rr()*Math.PI*2,r=30+rr()*130;const x=Math.sin(a)*r,z=Math.cos(a)*r;const sd=shoreD(x,z);
    if(sd<0.4||sd>10||camD(x,z)<7||inZone(x,z))continue;colocasia(x,z,0.8+rr()*0.6);k++;}

  /* ───── troncs couchés, moussus ───── */
  JF.logs.forEach(L=>{const dx=Math.cos(L.a),dz=Math.sin(L.a);const LP=[],LR=[];
    for(let j=0;j<=10;j++){const s=j/10-0.5;const x=L.x+dx*s*L.L,z=L.z+dz*s*L.L;const gy=Math.max(groundH(x,z),JF.water-0.6);LP.push(V(x,gy+L.r*0.55,z));LR.push(L.r*(1-0.25*(s+0.5)));}
    tube(LP,LR,10,1,(u,a)=>0.06*Math.sin(7*a+L.seed*20));
    for(let q=0;q<3;q++){const s=rr()-0.5;const p=V(L.x+dx*s*L.L,0,L.z+dz*s*L.L);p.y=Math.max(groundH(p.x,p.z),JF.water-0.6)+L.r*1.3;
      if(rr()<0.5)ferns.push({p,s:0.5+rr()*0.3,yaw:rr()*6.28,c:tint(1.3,0.2,0.1)});else crosses.push({p:p.clone().add(V(0,-0.2,0)),s:[0.8,0.7,0.8],yaw:rr()*6.28,kind:1,col:tint(1.5,0.2),crown:[p.x,p.y,p.z,1],sway:[p.x,p.z,p.y,0.02]});}});

  /* ───── premier plan, au bord de l'eau : on est dans la jungle ───── */
  {const f=JF.f,r=JF.r;
   const at=(d,s)=>{const p=C.clone().addScaledVector(f,d).addScaledVector(r,s);p.y=groundH(p.x,p.z);return p;};
   const bankAt=(d,side)=>{for(let s2=0.5;s2<14;s2+=0.25){const q2=C.clone().addScaledVector(f,d).addScaledVector(r,side*s2);if(shoreD(q2.x,q2.z)>0.6){q2.y=groundH(q2.x,q2.z);return q2;}}return at(d,side*14);};
   // à gauche : grandes colocases, puis un fromager hors champ dont une branche passe au-dessus
   let p=bankAt(7,-1).addScaledVector(r,-2.5);colocasia(p.x,p.z,1.3);
   p=bankAt(4.5,-1);colocasia(p.x,p.z,1.1);
   p=bankAt(12.5,-1);banana({x:p.x,z:p.z,y:p.y,seed:0.71},1.2);
   // à droite : bananier et cocotier penché au-dessus de l'eau
   p=bankAt(11,1);banana({x:p.x,z:p.z,y:p.y,seed:0.37},1.25);
   p=bankAt(15,1);JF.fgPalmTop=palm({x:p.x,z:p.z,y:p.y,seed:0.61},1.1,f.clone().addScaledVector(r,-0.9).normalize());
   p=bankAt(7.5,1).addScaledVector(r,2.8);colocasia(p.x,p.z,1.2);
   p=bankAt(12,1).addScaledVector(r,3.5);colocasia(p.x,p.z,1.3);
   // fougères et petites plantes au ras de l'eau
   // fougères, petites plantes et feuilles sèches sur les berges proches (sans masquer la berge du fond)
   const inl=(d,sd)=>{const q2=bankAt(d,sd);return q2.addScaledVector(r,sd*(0.3+rr()*4.5)).setY(0);};
   for(let k=0;k<26;k++){const sd=rr()<0.5?-1:1;p=inl(2.5+rr()*13,sd);p.y=groundH(p.x,p.z);ferns.push({p:p.clone().add(V(0,-0.05,0)),s:0.7+rr()*0.6,yaw:rr()*6.28,c:tint(1.3,0.2,0.1)});}
   for(let k=0;k<16;k++){const sd=rr()<0.5?-1:1;p=inl(3+rr()*11,sd);p.y=groundH(p.x,p.z);const sc=1.0+rr()*0.6;crosses.push({p:p.clone().add(V(0,-0.1,0)),s:[sc,sc*0.9,sc],yaw:rr()*6.28,kind:rr()<0.3?8:(rr()<0.2?7:1),col:tint(1.5,0.2),crown:[p.x,p.y+0.5,p.z,1.2],sway:[p.x,p.z,p.y,0.05]});}
   // un fromager hors champ à gauche : sa branche, ses rameaux et ses lianes encadrent le haut gauche de l'image
   const tb=at(7,-8.5),T0=V(tb.x,tb.y+7.5,tb.z),T1=at(11,-4.2).add(V(0,10.5,0)),T2=at(15,-1.6).add(V(0,13.5,0));
   tube([V(tb.x,tb.y-0.5,tb.z),V(tb.x,tb.y+4,tb.z),T0],[1.3,1.0,0.75],18,0,(u,a)=>1.4*Math.pow(Math.max(0,Math.sin(5*a+2)),3)*Math.exp(-u*7));
   tube([T0,T0.clone().lerp(T1,0.5).add(V(0,0.8,0)),T1,T2],[0.5,0.38,0.28,0.18],10,0);
   const cr=[T1.x,T1.y+1,T1.z,6];JF.fgBranch=[T0.clone(),T0.clone().lerp(T1,0.5).add(V(0,0.8,0)),T1.clone(),T2.clone()];
   // une branche morte qui sort de l'eau près de la berge gauche : le perchoir du martin-pêcheur
   {// un chicot mort qui sort de l'eau peu profonde, au pied de la berge gauche : le perchoir du martin-pêcheur
    let b0=bankAt(20,-1);for(let k=0;k<20;k++){const q2=b0.clone().addScaledVector(r,0.15);if(shoreD(q2.x,q2.z)<-0.7)break;b0=q2;}b0.y=JF.water-0.6;
    const up=V(0,1,0),b1=b0.clone().addScaledVector(r,0.25).add(V(0,1.2,0)),b2=b1.clone().addScaledVector(r,0.3).addScaledVector(f,-0.1).add(V(0,0.9,0));
    tube([b0,b0.clone().lerp(b1,0.5).add(V(0.03,0,0.02)),b1,b2],[0.13,0.11,0.08,0.035],8,1);
    const t1=b1.clone().lerp(b2,0.3),t1e=t1.clone().addScaledVector(r,0.75).addScaledVector(f,0.2).add(V(0,0.28,0));tube([t1,t1.clone().lerp(t1e,0.5).add(V(0,0.06,0)),t1e],[0.04,0.03,0.014],6,1);
    const t2=b1.clone().lerp(b0,0.25),t2e=t2.clone().addScaledVector(r,-0.5).addScaledVector(f,0.35).add(V(0,0.4,0));tube([t2,t2e],[0.035,0.012],6,1);
    JF.kfPerch=t1e.clone();}
   for(let k=0;k<26;k++){const s=rr()*0.85;const q=T0.clone().lerp(T2,s).add(V((rr()-0.5)*3.5,0.8+rr()*2.2,(rr()-0.5)*3.5));const sc=1.0+rr()*0.5;
     clumps.push({p:q,s:[sc,sc*0.85,sc],yaw:rr()*6.28,kind:0,col:tint(1.55,0.2,0.15),crown:cr,sway:[q.x,q.z,q.y-3,0.02]});}
   for(let k=0;k<4;k++){const s=0.05+k*0.1,a0=T0.clone().lerp(T1,s);const L=3.5+rr()*4;const LP=[];
     for(let j=0;j<=10;j++){const u=j/10;LP.push(a0.clone().add(V(Math.sin(u*2.5+k)*0.25,-u*L,Math.cos(u*2+k)*0.25)));}
     tube(LP,LP.map((_,j)=>0.03+0.012*Math.sin(j*1.7)),5,3);}
   for(let k=0;k<5;k++){const s=0.1+k*0.17,a0=T0.clone().lerp(T2,s);const L=2.5+rr()*3.5,w=0.9+rr()*0.6;
     drapes.push({p:a0.clone().add(V(0,-0.2,0)),s:[w,L,w],yaw:rr()*6.28,kind:k%2?4:5,col:tint(1.35,0.2),crown:[a0.x,a0.y-L*0.5,a0.z,L],sway:[a0.x,a0.z,a0.y,0.05/(L*L)]});}
  }

  /* ───── le cocotier du campement : il pousse en retrait de la rive, derrière les explorateurs, et se penche
     vers l'eau au-dessus de leurs têtes (le temple reste dégagé). Stipe annelé (écorce peinte), bulbe et racines
     qui s'enfoncent dans la latérite, palmes en vraie géométrie (chaque foliole est un ruban qui retombe),
     palmes jaunissantes et sèches, régimes de noix. */
  const heroFr=[],heroNuts=[];
  {const CP=JF.camp,e=0.5;
   const gx=(shoreD(CP.x+e,CP.z)-shoreD(CP.x-e,CP.z))/(2*e),gz=(shoreD(CP.x,CP.z+e)-shoreD(CP.x,CP.z-e))/(2*e);
   const inl=V(gx,0,gz).normalize();                                   // vers l'intérieur des terres
   const toC=Math.atan2(JF.cam.x-CP.x,JF.cam.z-CP.z);
   const locC=(x,z)=>V(x,0,z).applyAxisAngle(V(0,1,0),toC).add(CP);     // repère du campement (+z vers la caméra)
   const bx=CP.x+inl.x*4.6+JF.f.x*0.8,bz=CP.z+inl.z*4.6+JF.f.z*0.8;
   const B0=V(bx,groundH(bx,bz)-0.3,bz);
   const TG=locC(0.3,1.2);const lean=V(TG.x-B0.x,0,TG.z-B0.z);const LH=lean.length();lean.normalize();
   const side=V(-lean.z,0,lean.x);
   const C1=B0.clone().addScaledVector(lean,LH*0.62).add(V(0,5.6,0)),E=B0.clone().addScaledVector(lean,LH*1.04).add(V(0,13.6,0));
   const bez=u=>{const a=(1-u)*(1-u),b=2*(1-u)*u,c=u*u;return V(B0.x*a+C1.x*b+E.x*c,B0.y*a+C1.y*b+E.y*c,B0.z*a+C1.z*b+E.z*c).addScaledVector(side,Math.sin(u*Math.PI)*0.45);};
   const NT=46,P=[],rad=[];
   for(let i=0;i<=NT;i++){const u=i/NT;P.push(bez(u));rad.push(0.25*(1-u*0.3)+0.2*Math.exp(-u*18)+0.03*Math.sin(u*7.3)*(1-u));}
   tube(P,rad,18,4,(u,a)=>0.02*Math.sin(a*9+u*40));
   const TOP=P[NT].clone(),Tdir=P[NT].clone().sub(P[NT-2]).normalize();
   // gaines des palmes au sommet (manchon fibreux)
   tube([P[NT-2],P[NT].clone().addScaledVector(Tdir,0.2),P[NT].clone().addScaledVector(Tdir,0.75)],[0.3,0.36,0.2],14,6);
   // bulbe racinaire : racines fines qui s'étalent au pied du stipe et plongent dans la terre
   for(let k=0;k<30;k++){const a=k/30*Math.PI*2+rr()*0.2,dir=V(Math.cos(a),0,Math.sin(a));const L=0.45+rr()*0.9;const RP=[];
     const st=B0.clone().add(V(0,0.5+rr()*0.3,0)).addScaledVector(dir,0.3);
     for(let j=0;j<=8;j++){const u=j/8;const q2=st.clone().addScaledVector(dir,u*L);
       q2.y=lerp(st.y,groundH(q2.x,q2.z)-0.05,Math.min(1,u*1.6))-Math.max(0,u-0.7)*0.5+Math.sin(u*9+k)*0.012;RP.push(q2);}
     tube(RP,RP.map((_,j)=>(0.04+rr()*0.016)*(1-j/11)),5,3);}
   // une palme : rachis arqué + folioles (rubans qui retombent de part et d'autre, en V)
   function frond(az,el,L,droop,kind,seed){
     const r2=mulberry32(seed),pos=[],nor=[],uv=[],col=[],fa=[],idx=[];
     const fw=V(Math.cos(az),0,Math.sin(az)),up=V(0,1,0),sd=V(-fw.z,0,fw.x);
     const base=TOP.clone().addScaledVector(Tdir,0.55).addScaledVector(fw,0.18);
     const R=t=>base.clone().addScaledVector(fw,L*t*Math.cos(el)*0.95).addScaledVector(up,L*(Math.sin(el)*t-droop*t*t));
     const Tg=t=>R(Math.min(1,t+0.01)).sub(R(Math.max(0,t-0.01))).normalize();
     const green=kind===0,dry=kind===2;
     const cBase=dry?new THREE.Color(0.32,0.22,0.12):kind===1?new THREE.Color(0.5,0.44,0.15):new THREE.Color(0.16,0.28,0.06);
     // rachis
     const RP=[],RR=[];for(let i=0;i<=12;i++){const t=i/12;RP.push(R(t));RR.push(0.06*(1-t*0.85)+0.008);}
     const rg=tubeGeo(RP,RR,5,4);rg.deleteAttribute('aBk');rg.deleteAttribute('uv');
     {const n=rg.attributes.position.count;const C=new Float32Array(n*3),U2=new Float32Array(n*2),F=new Float32Array(n*4);
      const rc=dry?[0.3,0.21,0.12]:[0.42,0.4,0.16];for(let i=0;i<n;i++){C.set(rc,i*3);U2.set([0,0.02],i*2);const t=Math.floor(i/6)/12;F.set([t,0,seed%97,1],i*4);}
      rg.setAttribute('color',new THREE.BufferAttribute(C,3));rg.setAttribute('uv',new THREE.BufferAttribute(U2,2));rg.setAttribute('aFr',new THREE.BufferAttribute(F,4));heroFr.push(rg);}
     const NL=MOBILE?40:68;
     for(let i=0;i<NL;i++){const t=0.06+0.92*i/NL,Bp=R(t),T=Tg(t),N=new THREE.Vector3().crossVectors(sd,T).normalize();   // N : « dessus » de la palme
       for(const sg of [-1,1]){
         if(dry&&r2()<0.35)continue;if(!green&&r2()<0.12)continue;
         const len=(0.62+0.5*Math.pow(Math.sin(Math.PI*Math.min(1,0.08+t*0.98)),0.6))*(0.86+r2()*0.26)*(L/5)*(1-0.55*t*t);
         const fwdA=0.75+t*0.35+(r2()-0.5)*0.15;                 // angle vers l'avant
         const dropA=(green?0.55:0.9)+t*0.55+(r2()-0.5)*0.2;      // retombée (folioles en V)
         let D=T.clone().multiplyScalar(Math.cos(fwdA)).addScaledVector(sd,sg*Math.sin(fwdA)).normalize();
         D.multiplyScalar(Math.cos(dropA)).addScaledVector(N,-Math.sin(dropA)).normalize();
         const Wd=new THREE.Vector3().crossVectors(D,N).normalize();
         const tint2=0.85+r2()*0.3,tip=r2()<(dry?1:kind===1?0.6:0.18)?1:0;
         const b0=pos.length/3,S=4;
         for(let j=0;j<=S;j++){const u=j/S;const w=0.028*(L/5)*Math.sin(Math.PI*Math.min(1,u*1.05+0.06))*(dry?0.6:1);
           const c=Bp.clone().addScaledVector(sd,sg*0.025).addScaledVector(D,len*u).addScaledVector(N,-len*0.22*u*u*(dry?2:1));
           for(const k of [-1,1]){const q=c.clone().addScaledVector(Wd,k*w).addScaledVector(N,0.006*(1-Math.abs(k)));pos.push(q.x,q.y,q.z);uv.push(k,u);
             const cc=cBase.clone().multiplyScalar(tint2);if(tip&&u>0.72)cc.lerp(new THREE.Color(0.36,0.26,0.12),smooth(0.72,1.0,u));
             col.push(cc.r,cc.g,cc.b);fa.push(t,u,seed%97,0);}}
         for(let j=0;j<S;j++){const q=b0+j*2;idx.push(q,q+1,q+2,q+1,q+3,q+2);}
       }}
     const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
     g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.setAttribute('aFr',new THREE.Float32BufferAttribute(fa,4));g.setIndex(idx);g.computeVertexNormals();
     heroFr.push(g);
   }
   // couronne : palmes jeunes dressées, adultes étalées, vieilles retombantes, sèches pendantes contre le stipe
   const NF=MOBILE?16:25;
   for(let f=0;f<NF;f++){const az=f*2.39996+rr()*0.25,age=f/NF;
     frond(az,0.95-age*1.25+(rr()-0.5)*0.15,(4.8+rr()*1.1)*(age<0.15?0.85:1),0.55+age*0.55,0,1000+f*13);}
   for(let f=0;f<4;f++)frond(f*1.7+0.4,-0.5-rr()*0.3,4.6,0.6,1,2000+f*7);
   for(let f=0;f<5;f++)frond(f*1.31+1.1,-1.25-rr()*0.2,3.8,0.15,2,3000+f*11);
   // régimes de noix sous les palmes
   for(let k=0;k<3;k++){const a=k*2.1+0.4,dir=V(Math.cos(a),0,Math.sin(a));const c0=TOP.clone().addScaledVector(Tdir,0.15).addScaledVector(dir,0.38).add(V(0,-0.25,0));
     for(let n=0;n<5+Math.floor(rr()*3);n++){const q=c0.clone().add(V((rr()-0.5)*0.42,-rr()*0.45,(rr()-0.5)*0.42));
       heroNuts.push({p:q,s:0.16+rr()*0.04,c:[new THREE.Color(0.28,0.36,0.08),new THREE.Color(0.42,0.38,0.1),new THREE.Color(0.3,0.2,0.08)][Math.floor(rr()*3)]});}}
   JF.heroPalm={top:TOP,base:B0};
  }

  /* ───── bambous ───── */
  const culms=[];
  JF.groves.forEach(G=>{for(let k=0;k<G.n;k++){const a=rr()*Math.PI*2,d=Math.sqrt(rr())*G.r;const x=G.x+Math.cos(a)*d,z=G.z+Math.sin(a)*d;
    if(shoreD(x,z)<0.5)continue;
    const H=11+rr()*6,r=0.05+rr()*0.045,tilt=0.04+rr()*0.12*(d/G.r),y=groundH(x,z)-0.2;
    const dirT=V(Math.cos(a),0,Math.sin(a));const q=new THREE.Quaternion().setFromAxisAngle(V(-dirT.z,0,dirT.x),tilt);
    const k2=(0.55+rr()*0.5)/(H*H);
    culms.push({p:V(x,y,z),q,s:V(r,H,r),col:tint(1,0.3).multiplyScalar(rr()<0.15?1.25:1),sway:[x,z,y,k2]});
    const upv=V(0,1,0).applyQuaternion(q);
    for(let j=0;j<3;j++){const h=H*(0.6+j*0.15+rr()*0.06);const ang=rr()*Math.PI*2,off=0.5+rr()*0.8;
      const p=V(x,y,z).addScaledVector(upv,h).add(V(Math.cos(ang)*off,-0.3,Math.sin(ang)*off));const sc=1.3+rr()*0.5;
      clumps.push({p,s:[sc,sc*0.75,sc],yaw:ang,kind:2,col:tint(1.5,0.2,0.15),crown:[G.x,y+H*0.75,G.z,G.r+1.5],sway:[x,z,y,k2]});}
  }});

  /* ───── sous-bois : mur végétal derrière la berge de terre (la berge elle-même reste dégagée) ───── */
  for(let k=0,g=0;k<(MOBILE?520:1500)&&g<30000;g++){const a=rr()*Math.PI*2,r=30+rr()*150;const x=Math.sin(a)*r,z=Math.cos(a)*r;const sd=shoreD(x,z);
    const lo=4.2+2.2*vn3(x*0.05,0,z*0.05);if(sd<lo||sd>40||camD(x,z)<6||inZone(x,z))continue;
    if(sd>16&&rr()<0.45)continue;
    const y=groundH(x,z),sc=1.2+rr()*1.4+smooth(10,30,sd)*0.8;
    if(rr()<0.5)clumps.push({p:V(x,y+0.35+sc*0.42,z),s:[sc*1.2,sc*0.85,sc*1.2],yaw:rr()*6.28,kind:1,col:tint(1.5,0.3,0.15),crown:[x,y+0.8,z,sc*1.3],sway:[x,z,y,0.04]});
    else crosses.push({p:V(x,y-0.05,z),s:[sc*1.3,sc*1.1,sc*1.3],yaw:rr()*6.28,kind:1,col:tint(1.5,0.3,0.15),crown:[x,y+sc*0.5,z,sc],sway:[x,z,y,0.05]});
    k++;}
  // quelques plantes isolées sur la berge, des feuilles mortes en tas
  for(let k=0,g=0;k<(MOBILE?60:150)&&g<8000;g++){const a=rr()*Math.PI*2,r=30+rr()*140;const x=Math.sin(a)*r,z=Math.cos(a)*r;const sd=shoreD(x,z);
    if(sd<0.8||sd>5||camD(x,z)<6||inZone(x,z))continue;const y=groundH(x,z),sc=0.7+rr()*0.6;
    crosses.push({p:V(x,y-0.05,z),s:[sc,sc*0.8,sc],yaw:rr()*6.28,kind:rr()<0.22?7:(rr()<0.3?8:1),col:tint(1.5,0.25,0.15),crown:[x,y+0.4,z,sc],sway:[x,z,y,0.04]});k++;}
  // roseaux et touffes d'herbes le long de l'eau (feuilles lancéolées), plus serrés le long du chenal
  for(let k=0,g=0;k<(MOBILE?260:620)&&g<40000;g++){const a=rr()*Math.PI*2,r=20+rr()*150;const x=Math.sin(a)*r,z=Math.cos(a)*r;const sd=shoreD(x,z);
    const near=camD(x,z)<75;if(sd<-0.3||sd>(near?2.6:1.8)||camD(x,z)<4||inZone(x,z))continue;if(!near&&rr()<0.55)continue;
    const y=groundH(x,z),sc=0.55+rr()*0.55;crosses.push({p:V(x,Math.max(y,JF.water-0.1)-0.05,z),s:[sc*0.9,sc*1.15,sc*0.9],yaw:rr()*6.28,kind:rr()<0.7?2:1,col:tint(1.6,0.3,0.25),crown:[x,y+0.3,z,sc],sway:[x,z,y,0.12]});k++;}
  // fougères au sol
  for(let i=0,g=0;i<(MOBILE?300:760)&&g<14000;g++){const a=rr()*Math.PI*2,r=30+rr()*140;const x=Math.sin(a)*r,z=Math.cos(a)*r;const sd=shoreD(x,z);
    if(sd<(rr()<0.15?0.6:3.5)||sd>40||inZone(x,z))continue;ferns.push({p:V(x,groundH(x,z)-0.05,z),s:0.8+rr()*0.8,yaw:rr()*6.28,c:tint(1.3,0.25,0.15)});i++;}

  /* ───── canopée lointaine : grappes de volumes texturés, noyées dans la brume ───── */
  for(let k=0,g=0;k<(MOBILE?900:2400)&&g<80000;g++){
    const a=rr()*Math.PI*2,r=40+Math.pow(rr(),0.62)*430;const x=Math.sin(a)*r,z=Math.cos(a)*r;const sd=shoreD(x,z);
    if(sd<24)continue;if(camD(x,z)<30)continue;
    const L=fallsLocal(x,z);if(Math.abs(L.lx)<14&&L.lz>-8&&L.lz<14)continue;
    const y=groundH(x,z),H=16+rr()*14+smooth(60,300,r)*8,S=(4.8+rr()*3.6)*(1+smooth(120,400,r)*0.8);
    const pick=rr();const c0=pick<0.4?tint(1.9,0.25,0.2):pick<0.8?tint(2.3,0.25,0.2):tint(2.8,0.2,0.3);
    const cy=y+H*0.78,n=2+Math.floor(rr()*3);
    for(let j=0;j<n;j++){const ox=(rr()-0.5)*S*1.1,oz=(rr()-0.5)*S*1.1,oy=(rr()-0.3)*S*0.45;const sc=S*(0.45+rr()*0.35);
      blobs.push({p:V(x+ox,cy+oy,z+oz),s:V(sc*(1+rr()*0.4),sc*(0.6+rr()*0.3),sc*(1+rr()*0.4)),c:c0.clone().multiplyScalar(0.8+rr()*0.4),yaw:rr()*6.28,sec:sector(x,z)});}
    k++;}

  /* ═══════ matériaux ═══════ */
  const m4=new THREE.Matrix4(),q=new THREE.Quaternion(),e=new THREE.Euler();

  /* écorces : couleur + relief + rugosité ; mousse sur le dessus et au pied, écorce mouillée au ras de l'eau */
  const trunks={};
  for(const ty of [0,1,3,4,5,6]){if(!TR[ty].length)continue;const name=BARK[ty];
    const mat=patch(new THREE.MeshStandardMaterial({map:tx(name),normalMap:tx(name+'_n'),normalScale:new THREE.Vector2(1.35,1.35),roughness:1,envMapIntensity:0.6}),{
      uniforms:{uMossT:{value:tx('ground_moss')},uMossN:{value:tx('ground_moss_n')}},
      vHead:`attribute vec2 aBk;varying vec2 vBk;`,vMain:`vBk=aBk;`,
      fHead:`\n#define MOSSK ${BARK_MOSS[ty].toFixed(2)}\n#define JF_WY ${JF.water.toFixed(2)}
        uniform sampler2D uMossT;uniform sampler2D uMossN;varying vec2 vBk;float rvMk=0.0;float rvWt=0.0;`,
      fDiscard:GLSL_TREVEAL,
      fColor:`{
        diffuseColor.rgb*=mix(0.78,1.18,rvNoise(vRvW*0.06+vec3(3.0)))*1.15;
        float up=clamp(vRvN.y,0.0,1.0),mz=smoothstep(0.3,0.68,rvFbm3(vRvW*0.42));
        float hb=1.0-dot(diffuseColor.rgb,vec3(1.4));       // la mousse gagne d'abord les creux
        rvMk=clamp((max(up*1.15,smoothstep(2.8,0.0,vBk.x)*0.85)*mz+smoothstep(0.1,-0.7,vRvN.z)*0.3*mz)*MOSSK*(0.75+0.5*hb),0.0,0.94);
        vec4 ms=texture2D(uMossT,vMapUv*1.6);
        diffuseColor.rgb=mix(diffuseColor.rgb,ms.rgb*1.35,smoothstep(0.25,0.6,rvMk));
        rvWt=smoothstep(JF_WY+1.6,JF_WY+0.2,vRvW.y);diffuseColor.rgb*=mix(1.0,0.55,rvWt);
      }`,
      fRough:`roughnessFactor=mix(mix(texture2D(normalMap,vNormalMapUv).a,0.8,smoothstep(0.25,0.6,rvMk)),0.25,rvWt*0.8);`,
      fNormal:`{vec3 mn=texture2D(uMossN,vMapUv*1.6).xyz*2.0-1.0;normal=normalize(mix(normal,normalize(tbn*mn),smoothstep(0.25,0.6,rvMk)));}`,
      fEmissive:GLSL_TREVEAL_E,
    },'bark-'+name);
    const m=new THREE.Mesh(mergeGeometries(TR[ty]),mat);m.castShadow=true;m.receiveShadow=true;m.layers.enable(1);grp.add(m);trunks[ty]=m;}

  /* feuillage (atlas de rameaux) — un seul matériau pour les touffes, les plantes croisées et les rideaux pendants.
     genres : 0 canopée · 1 sous-bois · 2 bambou · 3 grandes feuilles (cacaoyer) · 4 racines · 5 mousse · 6 broméliacée · 7 feuilles sèches */
  const CELLS=new Float32Array(80);
  [[0,1,2,3,4,5,12,6],[0,2,3,11,12,0,5,1],[8,8,8,8,8,8,8,8],[12,0,2,4,12,3,7,4],[9,9,9,9,9,9,9,9],[10,10,10,10,10,10,10,10],[13,13,13,13,13,13,13,13],[15,7,15,15,7,15,15,7],[14,0,12,2,14,11,3,5],[0,1,2,3,4,5,12,6]].forEach((l,k)=>l.forEach((c,j)=>CELLS[k*8+j]=c));
  const leafU={uCells:{value:CELLS},uAtlas:{value:tx('leaf_atlas')},uAtlasN:{value:tx('leaf_atlas_n')}};
  const leafOpts={
    uniforms:leafU,
    vHead:`uniform float uTime;uniform vec2 uWind;uniform float uCells[80];attribute vec4 aCrown;attribute vec4 aSway;attribute float aKind;attribute float aCid;varying vec4 vCrown;varying vec2 vAUv;varying float vKind;`,
    vBegin:`
      #ifdef USE_INSTANCING
      {vec3 iw=instanceMatrix[3].xyz;vec3 wp=iw+mat3(instanceMatrix)*transformed;
       float ph=aSway.x*0.13+aSway.y*0.07;float s=sin(uTime*1.25+ph)*0.7+sin(uTime*2.3+ph*1.7)*0.3;
       float hang=step(3.5,aKind)*step(aKind,5.5);
       float hh=mix(max(wp.y-aSway.z,0.0),max(aSway.z-wp.y,0.0),hang);
       vec3 wd=vec3(uWind.x,0.0,uWind.y)*aSway.w*hh*hh*s;
       wd+=vec3(sin(uTime*3.1+aCid*40.0+ph),sin(uTime*2.6+aCid*31.0)*0.6,cos(uTime*3.4+aCid*23.0+ph))*0.028*mix(uv.y,1.0-uv.y,hang);
       transformed+=inverse(mat3(instanceMatrix))*wd;}
      #endif`,
    vMain:`vCrown=aCrown;vKind=aKind;
      {float cell=uCells[int(aKind+0.5)*8+int(min(aCid*8.0,7.0))];float cx=mod(cell,4.0),cy=floor(cell/4.0+0.01);
       vAUv=vec2((cx+0.012+uv.x*0.976)*0.25,(3.0-cy+0.012+uv.y*0.976)*0.25);}`,
    fHead:`uniform sampler2D uAtlas;uniform sampler2D uAtlasN;varying vec4 vCrown;varying vec2 vAUv;varying float vKind;float rvA=1.0;vec4 rvTx=vec4(1.0);`+GLSL_AA_ALPHA,
    fDiscard:GLSL_TREVEAL+`rvTx=texture2D(uAtlas,vAUv);{vec2 d=fwidth(vAUv)*2048.0;float hg=step(3.5,vKind)*step(vKind,5.5);rvA=rvTx.a*(1.0+max(0.0,log2(max(max(d.x,d.y),1e-6)))*mix(0.3,0.06,hg));}if(rvA<0.3)discard;`,
  };
  const leafMat=patch(new THREE.MeshStandardMaterial({color:new THREE.Color('#ffffff'),roughness:0.6,side:THREE.DoubleSide,alphaToCoverage:true,envMapIntensity:0.35}),Object.assign({},leafOpts,{
    fHead:leafOpts.fHead+GLSL_TBN+GLSL_TRANS+`vec4 rvTxN=vec4(0.5,0.5,1.0,0.5);`,
    fColor:`
      diffuseColor.rgb*=rvTx.rgb*1.5;diffuseColor.a=rvAA(rvA);
      float dc=length(vRvW-vCrown.xyz)/max(vCrown.w,0.5);
      float ao=mix(0.5,1.0,smoothstep(0.15,1.05,dc))*mix(0.75,1.08,smoothstep(-0.8,0.8,(vRvW.y-vCrown.y)/max(vCrown.w,0.5)));
      diffuseColor.rgb*=ao;
      if(vKind>3.5&&vKind<5.5)diffuseColor.rgb*=vec3(1.35,1.3,1.05);
      rvTC=diffuseColor.rgb*vec3(1.0,1.2,0.5)*(vKind>6.5?0.4:1.0);rvTSelf=0.55*smoothstep(0.45,1.0,dc);
      rvTxN=texture2D(uAtlasN,vAUv);`,
    fRough:`roughnessFactor=mix(0.9,0.52,rvTxN.a);`,
    fNormal:`{vec3 nS=normalize(vNormal);vec3 nm=rvTxN.xyz*2.0-1.0;nm.xy*=0.9;normal=normalize(rvTBN(-vViewPosition,nS,vAUv)*nm);}`,
    fEmissive:GLSL_TREVEAL_E,
    reps:RV_SOFTSPEC(0.3),
    onShader:rvAddTrans,
  }),'leafA');
  const leafDepth=patch(new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,side:THREE.DoubleSide}),Object.assign({},leafOpts,{
    fDiscard:GLSL_TREVEAL+`rvTx=texture2D(uAtlas,vAUv);rvA=rvMipA(rvTx.a,vAUv,2048.0);if(rvA<0.5)discard;`,onShader:GLSL_DEPTHFIX}),'leafAd');
  // instances regroupées par carreaux de 44 m : chaque carreau est écarté quand il sort du champ (caméra, ombres, reflet)
  const chunk=(list,cell)=>{const g=new Map();list.forEach(c=>{const k=Math.floor(c.p.x/cell)+','+Math.floor(c.p.z/cell);if(!g.has(k))g.set(k,[]);g.get(k).push(c);});if(!g.size)g.set('0',[]);return [...g.values()];};
  function leafMesh(G0,list){
    return chunk(list,44).map(L=>{const G=G0.clone();
      const N=Math.max(1,L.length),aC=new Float32Array(N*4),aS=new Float32Array(N*4),aK=new Float32Array(N);
      const M=new THREE.InstancedMesh(G,leafMat,N);
      L.forEach((c,i)=>{e.set((rr()-0.5)*0.3,c.yaw,(rr()-0.5)*0.3);q.setFromEuler(e);m4.compose(c.p,q,V(c.s[0],c.s[1],c.s[2]));M.setMatrixAt(i,m4);M.setColorAt(i,c.col);
        aC.set(c.crown,i*4);aS.set(c.sway,i*4);aK[i]=c.kind;});
      if(!L.length){M.setMatrixAt(0,m4.makeScale(0,0,0));M.setColorAt(0,new THREE.Color());}
      G.setAttribute('aCrown',new THREE.InstancedBufferAttribute(aC,4));G.setAttribute('aSway',new THREE.InstancedBufferAttribute(aS,4));G.setAttribute('aKind',new THREE.InstancedBufferAttribute(aK,1));
      M.customDepthMaterial=leafDepth;M.castShadow=true;M.receiveShadow=true;M.computeBoundingSphere();M.boundingSphere.radius+=4;M.frustumCulled=true;M.layers.enable(1);grp.add(M);return M;});
  }
  const leaves=leafMesh(twigClumpGeo(MOBILE?8:12,4242),clumps);
  const plants=leafMesh(crossGeo(MOBILE?3:4,5151),crosses);
  const hang=leafMesh(drapeGeo(),drapes);

  /* grandes feuilles (bananiers, colocases) : vraies géométries texturées, nervures en relief, reflets cireux */
  const bigMat=patch(new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.5,side:THREE.DoubleSide,alphaToCoverage:true,envMapIntensity:0.6}),{
    uniforms:{uBan:{value:tx('banana')},uBanN:{value:tx('banana_n')},uCol:{value:tx('colocasia')},uColN:{value:tx('colocasia_n')}},
    vHead:`uniform float uTime;uniform vec2 uWind;attribute vec4 aLf;attribute float aLs;varying vec4 vLf;`,
    vBegin:`{float k=aLs*aLf.z*aLf.z;float ph=aLf.w;transformed+=vec3(uWind.x,0.6,uWind.y)*k*(sin(uTime*1.6+ph)*0.8+sin(uTime*3.7+ph*2.0)*0.3);}`,
    vMain:`vLf=aLf;`,
    fHead:`uniform sampler2D uBan;uniform sampler2D uBanN;uniform sampler2D uCol;uniform sampler2D uColN;varying vec4 vLf;vec4 rvT=vec4(1.0);vec4 rvTN=vec4(0.5,0.5,1.0,0.6);vec2 rvUV=vec2(0.0);float rvA=1.0;`+GLSL_AA_ALPHA+GLSL_TBN+GLSL_TRANS,
    fDiscard:GLSL_TREVEAL+`
      if(vLf.x<1.5){rvUV=vec2(vLf.z,0.5-0.5*vLf.y);rvT=texture2D(uBan,rvUV);rvTN=texture2D(uBanN,rvUV);rvA=rvMipA(rvT.a,rvUV,1024.0);}
      else{rvUV=vec2(clamp(vLf.y*0.5+0.5,0.0,1.0),1.0-vLf.z);rvT=texture2D(uCol,rvUV);rvT.rgb*=2.1;rvTN=texture2D(uColN,rvUV);rvA=1.0;}
      if(rvA<0.3)discard;`,
    fColor:`diffuseColor.rgb*=rvT.rgb*1.3*mix(0.88,1.1,rvNoise(vRvW*1.3));diffuseColor.a=rvAA(rvA);
      diffuseColor.rgb*=mix(0.62,1.0,smoothstep(0.0,0.25,vLf.x<1.5?vLf.z:abs(vLf.z-0.275)*3.0));
      rvTC=diffuseColor.rgb*vec3(0.95,1.05,0.5)*0.6;rvTSelf=0.7;`,
    fRough:`roughnessFactor=clamp(rvTN.a*0.8,0.18,1.0);`,
    fNormal:`{vec3 nm=rvTN.xyz*2.0-1.0;normal=normalize(rvTBN(-vViewPosition,normal,rvUV)*nm);}`,
    fEmissive:GLSL_TREVEAL_E,
    reps:RV_SOFTSPEC(0.35),
    onShader:rvAddTrans,
  },'bigleafT');
  const bigM=new THREE.Mesh(mergeGeometries(big),bigMat);bigM.castShadow=true;bigM.receiveShadow=true;bigM.layers.enable(1);grp.add(bigM);

  /* palmes : ruban plié, folioles peintes (texture), translucides au soleil */
  const palmMat=patch(new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.5,side:THREE.DoubleSide,alphaToCoverage:true,envMapIntensity:0.6}),{
    uniforms:{uPalm:{value:tx('palm')},uPalmN:{value:tx('palm_n')}},
    vHead:`uniform float uTime;uniform vec2 uWind;attribute vec4 aPf;varying vec2 vPU;`,
    vBegin:`{float s=aPf.x;float ph=aPf.y*0.13+aPf.z*0.07+aPf.w;transformed+=vec3(uWind.x,0.35,uWind.y)*s*s*(sin(uTime*1.3+ph)*0.35+sin(uTime*3.1+ph*1.7)*0.12);}`,
    vMain:`vPU=vec2(uv.x,0.5-0.5*uv.y);`,
    fHead:`uniform sampler2D uPalm;uniform sampler2D uPalmN;varying vec2 vPU;vec4 rvT=vec4(1.0);vec4 rvTN=vec4(0.5,0.5,1.0,0.5);float rvA=1.0;`+GLSL_AA_ALPHA+GLSL_TBN+GLSL_TRANS,
    fDiscard:GLSL_TREVEAL+`rvT=texture2D(uPalm,vPU);rvA=rvMipA(rvT.a,vPU,1024.0);if(rvA<0.3)discard;`,
    fColor:`diffuseColor.rgb*=rvT.rgb*1.3;diffuseColor.a=rvAA(rvA);rvTN=texture2D(uPalmN,vPU);rvTC=diffuseColor.rgb*vec3(0.95,1.08,0.5)*0.75;rvTSelf=0.7;`,
    fRough:`roughnessFactor=mix(0.85,0.35,rvTN.a);`,
    fNormal:`{vec3 nm=rvTN.xyz*2.0-1.0;normal=normalize(rvTBN(-vViewPosition,normal,vPU)*nm);}`,
    fEmissive:GLSL_TREVEAL_E,
    reps:RV_SOFTSPEC(0.35),
    onShader:rvAddTrans,
  },'palmT');
  const palms=new THREE.Mesh(mergeGeometries(palmG),palmMat);palms.castShadow=true;palms.receiveShadow=true;palms.layers.enable(1);grp.add(palms);

  /* palmes du cocotier du temple : folioles en vraie géométrie, nervure claire, pointes sèches, translucides au soleil */
  const hfMat=patch(new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.48,side:THREE.DoubleSide,envMapIntensity:0.5}),{
    vHead:`uniform float uTime;uniform vec2 uWind;attribute vec4 aFr;varying vec4 vFr;varying vec2 vHU;`,
    vBegin:`{float t=aFr.x,u=aFr.y,ph=aFr.z*0.37;
      float g=sin(uTime*0.9+ph)*0.6+sin(uTime*2.1+ph*1.3)*0.25+sin(uTime*0.37+ph*0.5)*0.45;
      transformed+=vec3(uWind.x,0.22,uWind.y)*t*t*1.0*g;
      transformed+=vec3(sin(uTime*5.3+ph+t*13.0),cos(uTime*4.7+ph*2.0+t*9.0)*0.6,cos(uTime*5.9+ph+t*11.0))*0.04*u*u*(1.0-aFr.w);}`,
    vMain:`vFr=aFr;vHU=uv;`,
    fHead:`varying vec4 vFr;varying vec2 vHU;`+GLSL_TRANS,
    fDiscard:GLSL_TREVEAL,
    fColor:`{float lf=1.0-vFr.w;
      float mid=smoothstep(0.3,0.0,abs(vHU.x))*lf;
      diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*1.45+vec3(0.03,0.03,0.0),mid*0.7);
      diffuseColor.rgb*=mix(0.72,1.0,smoothstep(0.0,0.3,vHU.y))*mix(0.9,1.08,rvNoise(vRvW*4.0))*mix(1.0,0.82,smoothstep(0.7,1.0,abs(vHU.x))*lf);
      diffuseColor.rgb*=1.02;
      rvTC=diffuseColor.rgb*vec3(0.95,1.1,0.5)*0.62;rvTSelf=0.7;}`,
    fRough:`roughnessFactor=mix(0.62,0.38,smoothstep(0.3,0.0,abs(vHU.x)));`,
    fEmissive:GLSL_TREVEAL_E,
    reps:RV_SOFTSPEC(0.35),
    onShader:rvAddTrans,
  },'herofrond');
  const heroFronds=new THREE.Mesh(mergeGeometries(heroFr),hfMat);heroFronds.castShadow=true;heroFronds.receiveShadow=true;heroFronds.layers.enable(1);grp.add(heroFronds);

  /* bambous : chaumes à nœuds, qui ploient au vent */
  const CG=new THREE.CylinderGeometry(1,1,1,7,10,true);CG.translate(0,0.5,0);CG.deleteAttribute('uv');
  const culmMat=patch(new THREE.MeshStandardMaterial({color:new THREE.Color('#ffffff'),roughness:0.4}),{
    vHead:`uniform float uTime;uniform vec2 uWind;attribute vec4 aSway;varying float vNH;`,
    vBegin:`
      #ifdef USE_INSTANCING
      {vec3 iw=instanceMatrix[3].xyz;vec3 wp=iw+mat3(instanceMatrix)*transformed;
       float ph=aSway.x*0.13+aSway.y*0.07;float s=sin(uTime*1.25+ph)*0.7+sin(uTime*2.3+ph*1.7)*0.3;
       float hh=max(wp.y-aSway.z,0.0);vec3 wd=vec3(uWind.x,0.0,uWind.y)*aSway.w*hh*hh*s;
       transformed+=inverse(mat3(instanceMatrix))*wd;}
      #endif`,
    vMain:`
      #ifdef USE_INSTANCING
      vNH=position.y*length(instanceMatrix[1].xyz);
      #else
      vNH=position.y;
      #endif`,
    fHead:`varying float vNH;float rvBH=0.0;`,
    fDiscard:GLSL_TREVEAL,
    fColor:`float nd=fract(vNH/0.42+0.13);float ring=smoothstep(0.06,0.0,nd)+smoothstep(0.94,1.0,nd);
      vec3 c=mix(vec3(0.16,0.25,0.05),vec3(0.3,0.33,0.1),rvNoise(vec3(vRvW.xz*3.0,vNH*0.3)));
      c=mix(c,vec3(0.32,0.27,0.12),smoothstep(0.55,0.8,rvNoise(vec3(vRvW.xz*9.0,vNH*1.7)))*0.6);
      diffuseColor.rgb*=c*mix(0.9,1.08,rvNoise(vec3(vRvW.xz*20.0,vNH*0.6)));
      diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(0.55,0.55,0.4),ring*0.85);
      rvBH=ring*0.006;`,
    fNormal:`normal=rvPerturb(-vViewPosition,normal,rvBH,1.0);`,
    fEmissive:GLSL_TREVEAL_E,
  },'culm');
  const NB=Math.max(1,culms.length);const swB=new Float32Array(NB*4);
  const bamboo=new THREE.InstancedMesh(CG,culmMat,NB);
  culms.forEach((c,i)=>{m4.compose(c.p,c.q,c.s);bamboo.setMatrixAt(i,m4);bamboo.setColorAt(i,c.col);swB.set(c.sway,i*4);});
  CG.setAttribute('aSway',new THREE.InstancedBufferAttribute(swB,4));
  bamboo.castShadow=true;bamboo.receiveShadow=true;bamboo.frustumCulled=false;bamboo.layers.enable(1);grp.add(bamboo);

  /* fougères (au sol et couronnes des fougères arborescentes) : frondes peintes */
  const FG=fernGeo(8,1.2);
  const fernMat=patch(new THREE.MeshStandardMaterial({color:new THREE.Color('#ffffff'),roughness:0.6,side:THREE.DoubleSide,alphaToCoverage:true,envMapIntensity:0.55}),{
    uniforms:{uFern:{value:tx('fern')},uFernN:{value:tx('fern_n')}},
    vHead:`uniform float uTime;varying vec2 vFU;`,vMain:`vFU=vec2(uv.x,0.5-0.5*uv.y);`,
    vBegin:`
      #ifdef USE_INSTANCING
      {vec3 iw=instanceMatrix[3].xyz;float s=sin(uTime*1.7+iw.x*0.3+iw.z*0.2);transformed.xz+=vec2(0.05,0.03)*s*transformed.y*uv.x*2.0;}
      #endif`,
    fHead:`uniform sampler2D uFern;uniform sampler2D uFernN;varying vec2 vFU;vec4 rvT=vec4(1.0);vec4 rvTN=vec4(0.5,0.5,1.0,0.5);float rvA=1.0;`+GLSL_AA_ALPHA+GLSL_TBN+GLSL_TRANS,
    fDiscard:GLSL_TREVEAL+`rvT=texture2D(uFern,vFU);rvA=rvMipA(rvT.a,vFU,1024.0);if(rvA<0.3)discard;`,
    fColor:`diffuseColor.rgb*=rvT.rgb*1.45*mix(0.7,1.1,vFU.x);diffuseColor.a=rvAA(rvA);rvTN=texture2D(uFernN,vFU);rvTC=diffuseColor.rgb*vec3(1.0,1.2,0.5);rvTSelf=0.6;`,
    fRough:`roughnessFactor=mix(0.85,0.4,rvTN.a);`,
    fNormal:`{vec3 nm=rvTN.xyz*2.0-1.0;normal=normalize(rvTBN(-vViewPosition,normal,vFU)*nm);}`,
    fEmissive:GLSL_TREVEAL_E,
    reps:RV_SOFTSPEC(0.35),
    onShader:rvAddTrans,
  },'fernT');
  const fernM=chunk(ferns,44).map(L=>{const M=new THREE.InstancedMesh(FG,fernMat,Math.max(1,L.length));
    L.forEach((f,i)=>{q.setFromAxisAngle(V(0,1,0),f.yaw);m4.compose(f.p,q,V(f.s,f.s*(f.tree?0.75:0.8+rr()*0.4),f.s));M.setMatrixAt(i,m4);M.setColorAt(i,f.c);});
    M.castShadow=true;M.receiveShadow=true;M.computeBoundingSphere();M.boundingSphere.radius+=2;M.frustumCulled=true;M.layers.enable(1);grp.add(M);return M;});

  /* canopée : volumes texturés (projection triplanaire de la texture « canopée »), contours découpés en feuillage */
  const BG=blobGeo();
  const blobMat=patch(new THREE.MeshStandardMaterial({color:new THREE.Color('#ffffff'),roughness:0.82,alphaToCoverage:true,envMapIntensity:0.5}),{
    uniforms:{uCan:{value:tx('canopy')}},
    vHead:`attribute float aAO;varying float vAO;varying vec3 vBO;`,vMain:`vAO=aAO;vBO=position;`,
    fHead:`uniform sampler2D uCan;varying float vAO;varying vec3 vBO;float rvBA=1.0;vec3 rvCC=vec3(1.0);float rvLum=0.5;`+GLSL_AA_ALPHA+GLSL_TRANS,
    fDiscard:GLSL_TREVEAL+`{vec3 nW=normalize(vRvN);vec3 bw=pow(abs(nW),vec3(4.0));bw/=bw.x+bw.y+bw.z;vec3 p=vRvW/7.0;
      vec4 c=texture2D(uCan,p.zy)*bw.x+texture2D(uCan,p.xz+0.37)*bw.y+texture2D(uCan,p.xy+0.71)*bw.z;rvCC=c.rgb;
      rvLum=clamp(dot(c.rgb,vec3(0.3,0.59,0.11))*42.0,0.0,1.0)*c.a;
      vec3 Vd=normalize(cameraPosition-vRvW);float rim=1.0-abs(dot(nW,Vd));
      rvBA=smoothstep(rim*1.35-0.6,rim*1.35-0.42,rvLum*0.75+rvNoise(vRvW*0.8)*0.3);if(rvBA<0.05)discard;}`,
    fColor:`diffuseColor.a=rvAA(rvBA);diffuseColor.rgb*=rvCC*1.35*mix(0.5,1.1,vAO)*mix(0.62,1.08,smoothstep(-0.4,0.9,vBO.y));rvTC=diffuseColor.rgb*vec3(0.9,1.1,0.5)*0.6;rvTSelf=0.2;`,
    fNormal:`normal=rvPerturb(-vViewPosition,normal,rvLum*0.5,1.0);`,
    fEmissive:GLSL_TREVEAL_E,
    reps:RV_SOFTSPEC(0.35),
    onShader:rvAddTrans,
  },'blobT');
  const canopy=[];
  {const list=blobs.filter(b=>b.core);const cm=new THREE.InstancedMesh(blobGeo(false),blobMat,Math.max(1,list.length));
   list.forEach((b,i)=>{q.setFromAxisAngle(V(0,1,0),b.yaw);m4.compose(b.p,q,b.s);cm.setMatrixAt(i,m4);cm.setColorAt(i,b.c);});
   cm.computeBoundingSphere();cm.castShadow=true;cm.receiveShadow=true;cm.frustumCulled=false;cm.layers.enable(1);grp.add(cm);canopy.push(cm);}
  for(let sec=0;sec<10;sec++){const list=blobs.filter(b=>b.sec===sec&&!b.core);if(!list.length)continue;
    const cm=new THREE.InstancedMesh(BG,blobMat,list.length);
    list.forEach((b,i)=>{q.setFromAxisAngle(V(0,1,0),b.yaw);m4.compose(b.p,q,b.s);cm.setMatrixAt(i,m4);cm.setColorAt(i,b.c);});
    cm.computeBoundingSphere();cm.castShadow=false;cm.receiveShadow=true;cm.frustumCulled=true;cm.layers.enable(1);grp.add(cm);canopy.push(cm);}

  /* rochers moussus : roche texturée (projection triplanaire, en repère propre), mousse sur le dessus */
  const RG=rockGeo();const mossA=new Float32Array(Math.max(1,JF.rocks.length));
  const rockMat=patch(new THREE.MeshStandardMaterial({color:new THREE.Color('#ffffff'),roughness:0.9,envMapIntensity:0.5}),{
    uniforms:{uRock:{value:tx('rock')},uRockN:{value:tx('rock_n')},uMossT:{value:tx('ground_moss')},uMossN:{value:tx('ground_moss_n')}},
    vHead:`attribute float aMoss;varying float vMoss;varying vec3 vRO;varying vec3 vRON;`,vMain:`vMoss=aMoss;vRO=position;vRON=objectNormal;`,
    fHead:`\n#define JF_WY ${JF.water.toFixed(2)}\nuniform sampler2D uRock;uniform sampler2D uRockN;uniform sampler2D uMossT;uniform sampler2D uMossN;varying float vMoss;varying vec3 vRO;varying vec3 vRON;float rvMk=0.0;vec3 rvBW=vec3(0.0);vec3 rvRP=vec3(0.0);`,
    fDiscard:GLSL_TREVEAL,
    fColor:`{rvBW=pow(abs(normalize(vRON)),vec3(4.0));rvBW/=rvBW.x+rvBW.y+rvBW.z;rvRP=vRO*0.85;
      vec3 r=texture2D(uRock,rvRP.zy).rgb*rvBW.x+texture2D(uRock,rvRP.xz).rgb*rvBW.y+texture2D(uRock,rvRP.xy).rgb*rvBW.z;
      vec3 m=texture2D(uMossT,vRvW.xz/1.4).rgb*1.3;
      float lum=dot(r,vec3(0.3,0.59,0.11));
      rvMk=smoothstep(0.1,0.5,vRvN.y+(rvFbm3(vRO*3.0)-0.5)*0.8-lum*4.0)*vMoss;
      vec3 c=mix(r*1.1,m,rvMk);
      c*=mix(1.0,0.5,smoothstep(JF_WY+0.5,JF_WY-0.2,vRvW.y));
      diffuseColor.rgb=c;}`,
    fRough:`roughnessFactor=mix(0.86,0.95,rvMk)*mix(1.0,0.4,smoothstep(JF_WY+0.4,JF_WY,vRvW.y));`,
    // relief par textures de normales (filtrées, sans grésillement) : projection triplanaire en repère monde
    fNormal:`{vec3 nW=normalize(vRvN);
      vec3 tx=texture2D(uRockN,rvRP.zy).xyz*2.0-1.0,ty=texture2D(uRockN,rvRP.xz).xyz*2.0-1.0,tz=texture2D(uRockN,rvRP.xy).xyz*2.0-1.0;
      vec3 nx=vec3(0.0,tx.y,tx.x)*sign(nW.x),ny=vec3(ty.x,0.0,ty.y)*sign(nW.y),nz=vec3(tz.x,tz.y,0.0)*sign(nW.z);
      vec3 pert=(nx*rvBW.x+ny*rvBW.y+nz*rvBW.z)*0.8;
      vec3 mn=texture2D(uMossN,vRvW.xz/1.4).xyz*2.0-1.0;pert=mix(pert,vec3(mn.x,0.0,mn.y)*0.6,rvMk);
      vec3 nn=normalize(nW+pert);normal=normalize((viewMatrix*vec4(nn,0.0)).xyz);}`,
    fEmissive:GLSL_TREVEAL_E,
  },'rockT');
  const rocks=new THREE.InstancedMesh(RG,rockMat,Math.max(1,JF.rocks.length));
  JF.rocks.forEach((o,i)=>{q.setFromEuler(e.set((rr()-0.5)*0.3,rr()*6.28,(rr()-0.5)*0.3));const s=o.s;m4.compose(V(o.x,o.y-0.18*s,o.z),q,V(s*1.25,s*0.7,s));rocks.setMatrixAt(i,m4);mossA[i]=o.moss;});
  RG.setAttribute('aMoss',new THREE.InstancedBufferAttribute(mossA,1));
  rocks.castShadow=true;rocks.receiveShadow=true;rocks.layers.enable(1);grp.add(rocks);

  /* cabosses de cacao */
  const PG=podGeo();
  const podMat=patch(new THREE.MeshStandardMaterial({color:new THREE.Color('#ffffff'),roughness:0.5,envMapIntensity:0.7}),{
    fDiscard:GLSL_TREVEAL,
    fColor:`diffuseColor.rgb*=mix(0.75,1.15,rvNoise(vRvW*14.0))*mix(1.0,0.7,smoothstep(0.62,0.8,rvNoise(vRvW*31.0)));`,
    fEmissive:GLSL_TREVEAL_E,
  },'pod');
  const podM=new THREE.InstancedMesh(PG,podMat,Math.max(1,pods.length));
  pods.forEach((o,i)=>{q.setFromEuler(e.set(o.tilt*Math.sin(o.yaw),o.yaw,o.tilt*Math.cos(o.yaw)));m4.compose(o.p,q,V(0.13*o.s,0.25*o.s,0.13*o.s));podM.setMatrixAt(i,m4);podM.setColorAt(i,o.c);});
  podM.castShadow=true;podM.receiveShadow=true;grp.add(podM);

  const nutM=new THREE.InstancedMesh(new THREE.SphereGeometry(1,14,10),podMat,Math.max(1,heroNuts.length));
  heroNuts.forEach((o,i)=>{m4.compose(o.p,q.setFromEuler(e.set(rr()*0.6,rr()*6.28,rr()*0.6)),V(o.s,o.s*1.12,o.s*0.95));nutM.setMatrixAt(i,m4);nutM.setColorAt(i,o.c);});
  nutM.castShadow=true;nutM.receiveShadow=true;nutM.layers.enable(1);grp.add(nutM);
  return {grp,leaves,plants,hang,bamboo,ferns:fernM,rocks,trunks,canopy,bigM,palms,pods:podM,leafMat,leafDepth,heroFronds};
}

/* ═══ 28 · Le lagon : eau-miroir (vrai reflet), nénuphars, lotus, lanternes de pierre noyées,
   lanternes de papier qui dérivent la nuit, cascade au fond ═══
   Reflet : une seconde caméra, symétrique par rapport à la surface, rend la pagode, la jungle et
   le ciel dans une image deux fois plus petite (plan de coupe oblique : rien sous l'eau ne se
   reflète) ; l'eau la lit en projection, déformée par les rides, mêlée au vert sombre du lagon
   selon l'angle (Fresnel). */

/* ── lanterne de pierre (kasuga-dōrō) ── */
function lanternGeo(){
  const parts=[];const add=(g,y,part)=>{g.translate(0,y,0);if(g.attributes.uv)g.deleteAttribute('uv');g=g.index?g.toNonIndexed():g;const n=g.attributes.position.count;g.setAttribute('aPart',new THREE.Float32BufferAttribute(new Float32Array(n).fill(part),1));parts.push(g);};
  add(new THREE.CylinderGeometry(0.42,0.47,0.18,6),0.09,0);
  add(new THREE.CylinderGeometry(0.2,0.3,0.12,6),0.24,0);
  add(new THREE.CylinderGeometry(0.12,0.14,0.72,10),0.66,0);
  add(new THREE.TorusGeometry(0.135,0.03,5,10).rotateX(Math.PI/2),0.66,0);
  add(new THREE.CylinderGeometry(0.38,0.26,0.17,6),1.1,0);
  add(new THREE.CylinderGeometry(0.25,0.25,0.34,6),1.355,1);
  add(new THREE.CylinderGeometry(0.1,0.58,0.22,6),1.63,0);
  add(new THREE.CylinderGeometry(0.58,0.5,0.05,6),1.505,0);
  add(new THREE.SphereGeometry(0.1,10,8),1.85,0);
  add(new THREE.CylinderGeometry(0.07,0.1,0.08,8),1.76,0);
  const g=mergeGeometries(parts);g.computeVertexNormals();return g;
}

/* accès à l'eau pour la faune (ondes, carpes) */
const WATER={ripple(){},koi:null};
/* ── reflet plan ── */
const REFL={rt:null,cam:new THREE.PerspectiveCamera(),k:MOBILE?0.35:0.6,mat:new THREE.Matrix4(),on:true,
  _p:new THREE.Vector3(),_f:new THREE.Vector3(),_u:new THREE.Vector3(),_pl:new THREE.Plane(),_c:new THREE.Vector4(),_q:new THREE.Vector4()};
function reflRender(){
  if(!REFL.on)return;
  const LQ=PLV(),rk=REFL.k*LQ.refl[0],rs=MOBILE?0:Math.min(2,LQ.refl[1]);
  const pr=renderer.getPixelRatio(),W=Math.max(2,Math.round(VW*pr*rk)),H=Math.max(2,Math.round(VH*pr*rk));
  if(!REFL.rt||REFL.rt.width!==W||REFL.rt.height!==H||REFL.rt.samples!==rs){if(REFL.rt)REFL.rt.dispose();REFL.rt=new THREE.WebGLRenderTarget(W,H,{type:THREE.HalfFloatType,samples:rs,generateMipmaps:true,minFilter:THREE.LinearMipmapLinearFilter});
    if(REFL.mU)REFL.mU.uRefl.value=REFL.rt.texture;}
  const wy=JF.water,rc=REFL.cam;
  camera.updateMatrixWorld();
  REFL._p.setFromMatrixPosition(camera.matrixWorld);
  REFL._f.set(0,0,-1).applyQuaternion(camera.quaternion);REFL._u.set(0,1,0).applyQuaternion(camera.quaternion);
  rc.position.set(REFL._p.x,2*wy-REFL._p.y,REFL._p.z);
  rc.up.set(REFL._u.x,-REFL._u.y,REFL._u.z);
  rc.lookAt(rc.position.x+REFL._f.x,rc.position.y-REFL._f.y,rc.position.z+REFL._f.z);
  rc.fov=camera.fov;rc.aspect=camera.aspect;rc.near=camera.near;rc.far=camera.far;rc.updateProjectionMatrix();rc.updateMatrixWorld();
  // plan de coupe oblique (Lengyel) : ce qui est sous l'eau n'apparaît pas dans le reflet
  const pl=REFL._pl.setFromNormalAndCoplanarPoint(new THREE.Vector3(0,1,0),new THREE.Vector3(0,wy,0));pl.applyMatrix4(rc.matrixWorldInverse);
  const c=REFL._c.set(pl.normal.x,pl.normal.y,pl.normal.z,pl.constant),P=rc.projectionMatrix.elements,q=REFL._q;
  q.x=(Math.sign(c.x)+P[8])/P[0];q.y=(Math.sign(c.y)+P[9])/P[5];q.z=-1;q.w=(1+P[10])/P[14];
  c.multiplyScalar(2/c.dot(q));P[2]=c.x;P[6]=c.y;P[10]=c.z+1-0.003;P[14]=c.w;
  rc.projectionMatrixInverse.copy(rc.projectionMatrix).invert();
  REFL.mat.set(0.5,0,0,0.5,0,0.5,0,0.5,0,0,0.5,0.5,0,0,0,1).multiply(rc.projectionMatrix).multiply(rc.matrixWorldInverse);
  rc.layers.set(1);
  const sa=renderer.shadowMap.autoUpdate;renderer.shadowMap.autoUpdate=false;
  const old=renderer.getRenderTarget();renderer.setRenderTarget(REFL.rt);renderer.clear();renderer.render(scene,rc);renderer.setRenderTarget(old);
  renderer.shadowMap.autoUpdate=sa;
}

function buildOasis(){
  const grp=new THREE.Group();scene.add(grp);
  const F=JF.falls;const rr=mulberry32(4471);
  const V=(x,y,z)=>new THREE.Vector3(x,y,z);
  const m4=new THREE.Matrix4(),q=new THREE.Quaternion();
  sky.layers.enable(1);

  /* ───── l'eau ─────
     Composition physique : reflet (Fresnel de Schlick) + transmission. Ce qui est sous la surface (fond,
     marches noyées, carpes) reste dessiné et l'eau s'y superpose selon la longueur du trajet de la lumière
     dans une eau trouble : transparente au bord, sombre au large. Houle en quatre couches (texture FFT) qui
     dérivent, risées, ondes circulaires (poissons, oiseaux, insectes), sillage ; le soleil s'y reflète par un
     lobe GGX (le chemin de lumière) et des étincelles, éteints là où les arbres font de l'ombre (carte d'ombre). */
  const RIP=Array.from({length:16},()=>new THREE.Vector4(0,0,-99,0)),KOI=Array.from({length:16},()=>new THREE.Vector4(0,0,0,-1));
  REFL.mU={uRefl:{value:null},uReflMat:{value:REFL.mat},uHgt:{value:JF.heightTex},uHE:{value:JF.HE},uWY:{value:JF.water},uReflK:{value:1},uWN:{value:tx('water_n')},
    uBoat:{value:new THREE.Vector4(0,0,0,0)},uRip:{value:RIP},uKoi:{value:KOI},uShadowW:{value:null},uShadowWM:{value:new THREE.Matrix4()},uShOn:{value:0},uSunK:{value:1}};
  let ripI=0;
  WATER.ripple=(x,z,amp)=>{RIP[ripI].set(x,z,U.uTime.value,amp);ripI=(ripI+1)%RIP.length;};
  WATER.koi=KOI;
  const WU=Object.assign({},U,REFL.mU);
  const waterMat=new THREE.ShaderMaterial({uniforms:WU,transparent:true,depthWrite:true,
    blending:THREE.CustomBlending,blendSrc:THREE.OneFactor,blendDst:THREE.OneMinusSrcAlphaFactor,blendSrcAlpha:THREE.OneFactor,blendDstAlpha:THREE.OneMinusSrcAlphaFactor,
    vertexShader:`varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.0);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader:"#define RV_FRAG\n"+THREE.ShaderChunk.packing+GLSL_NOISE+GLSL_FOG+GLSL_REVEAL+`
      uniform sampler2D uRefl;uniform mat4 uReflMat;uniform sampler2D uHgt;uniform float uHE;uniform float uWY;uniform float uReflK;
      uniform sampler2D uWN;uniform vec4 uBoat;uniform vec4 uRip[16];uniform vec4 uKoi[16];
      uniform sampler2D uShadowW;uniform mat4 uShadowWM;uniform float uShOn;uniform float uSunK;
      varying vec3 vW;
      vec2 wn(vec2 p){return texture2D(uWN,p).xy*2.0-1.0;}
      float ggx(float NoH,float a){float a2=a*a;float d=NoH*NoH*(a2-1.0)+1.0;return a2/(3.14159*d*d);}
      float shadowAt(vec3 w){if(uShOn<0.5)return 1.0;vec4 sc=uShadowWM*vec4(w,1.0);
        if(sc.x<0.0||sc.y<0.0||sc.x>1.0||sc.y>1.0||sc.z>1.0)return 1.0;
        vec2 t=1.0/vec2(textureSize(uShadowW,0));float s=0.0;
        for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++)s+=step(sc.z-0.0012,unpackRGBAToDepth(texture2D(uShadowW,sc.xy+vec2(float(i),float(j))*t*1.5)));
        return s/9.0;}
      void main(){
        {float lT=length(vW.xz);if(lT>uTerrainReveal-16.0){float rrT=lT+(rvFbm3(vec3(vW.xz*0.05,2.0))-0.5)*30.0;if(rrT>uTerrainReveal) discard;}}
        vec3 V=cameraPosition-vW;float dist=length(V);V/=dist;
        float gh=texture2D(uHgt,clamp(vW.xz/(2.0*uHE)+0.5,0.0,1.0)).r;float dep=max(uWY-gh,0.0);
        vec2 p=vW.xz;
        // houle : quatre couches qui dérivent ; risées (zones ridées / lisses) ; calme au ras des rives
        float gust=smoothstep(0.3,0.8,rvFbm3(vec3(p*0.028+vec2(uTime*0.013,uTime*0.008),uTime*0.022)));
        float calm=smoothstep(0.0,0.7,dep+0.08);
        float nearK=1.0-smoothstep(12.0,70.0,dist);
        vec2 g=wn(p/13.0+vec2(uTime*0.009,uTime*0.005))*0.42
              +wn(vec2(p.y,-p.x)/5.3+vec2(-uTime*0.016,uTime*0.012))*0.3
              +wn(vec2(p.x+p.y,p.y-p.x)*0.7071/2.2+vec2(uTime*0.03,-uTime*0.022))*0.22*mix(0.45,1.0,gust)
              +wn(p/0.8+vec2(-uTime*0.05,uTime*0.06))*0.16*mix(0.25,1.0,gust)*nearK;
        g*=mix(0.32,1.0,gust)*calm;
        // ondes circulaires
        for(int i=0;i<16;i++){vec4 r=uRip[i];float age=uTime-r.z;if(r.w<=0.0||age<0.0||age>6.0)continue;
          vec2 d=p-r.xy;float rr=length(d);float front=age*0.6;if(rr>front+1.5)continue;
          float env=exp(-pow((rr-front)/(0.16+age*0.14),2.0))*exp(-age*0.7)*r.w+exp(-rr*rr*6.0)*exp(-age*3.0)*r.w*0.6;
          g+=d/max(rr,1e-3)*cos((rr-front)*24.0)*env*1.7;}
        // sillage de la chaloupe : bras en V (angle de Kelvin) + traînée brassée derrière la poupe
        float foam=0.0;
        {vec2 d=p-uBoat.xy;if(uBoat.w>0.0&&dot(d,d)<1600.0){vec2 f=vec2(cos(uBoat.z),sin(uBoat.z)),sd=vec2(-f.y,f.x);float u=dot(d,f),v=dot(d,sd);
          if(u<3.5){float bu=max(-u+1.5,0.0);float arm=abs(v)-bu*0.36-0.6;float wa=exp(-arm*arm/(0.12+bu*0.05))*exp(-bu*0.055)*smoothstep(3.5,1.0,u);
            float tr=exp(-v*v/(0.35+bu*0.05))*exp(-bu*0.09)*smoothstep(-2.8,-3.6,u)*step(u,-2.8);
            float ph=bu*3.2-abs(v)*1.2-uTime*2.6;
            g+=(sd*sign(v)*sin(ph*1.6)*wa*0.75+(f*sin(bu*5.0-uTime*6.0)+sd*cos(v*6.0+uTime*4.0))*tr*0.4)*uBoat.w;
            foam=(wa*0.3*smoothstep(0.4,1.0,sin(ph*1.6)*0.5+0.5)+tr*0.45*rvNoise(vec3(p*3.0,uTime)))*uBoat.w;}}}
        vec3 N=normalize(vec3(g.x*0.46,1.0,g.y*0.46));
        float NoV=max(dot(N,V),1e-3);float F=min(1.0,(0.02+0.98*pow(1.0-NoV,5.0))*1.1+0.035);   // un peu plus miroir
        // reflet plan, déformé par la houle, flouté selon l'agitation et la distance (niveaux de détail)
        vec4 pr=uReflMat*vec4(vW+vec3(N.x,0.0,N.z)*0.95,1.0);vec2 ru=pr.xy/pr.w;
        float bl=clamp(length(g)*1.8+dist*0.0045,0.0,3.0);
        vec3 rf=texture2D(uRefl,ru,bl).rgb;
        rf=mix(uFogColor*(0.7+0.3*uLum),rf,uReflK);
        // ce qu'on voit à travers : trajet dans l'eau trouble (fond, marches, carpes)
        float path=dep/max(NoV,0.18);float Tr=exp(-path*1.45);
        for(int i=0;i<16;i++){vec4 k=uKoi[i];if(k.w<0.0)continue;vec2 d=p-k.xy;if(dot(d,d)>1.2)continue;
          vec2 fw=vec2(cos(k.z),sin(k.z));float u=dot(d,fw),v=dot(d,vec2(-fw.y,fw.x));
          float m=smoothstep(1.0,0.45,(u*u)/0.2+(v*v)/0.022);Tr=mix(Tr,exp(-k.w/max(NoV,0.18)*1.45),m);}
        // corps de l'eau : vert-brun, éclairé par le ciel et (un peu) par le soleil qui le traverse
        float sh=shadowAt(vW);
        vec3 body=vec3(0.03,0.05,0.028)*(0.3+0.7*uLum)+uSunColor*uSunK*0.012*(0.4+0.6*sh)*max(uSunDir.y,0.0);
        body+=uSunColor*uSunK*sh*0.03*pow(max(dot(-V,uSunDir)*0.5+0.5,0.0),6.0)*(1.0-NoV);   // lumière qui passe dans les crêtes, à contre-jour
        // le soleil (ou la lune) : lobe GGX = chemin de lumière ; étincelles sur les rides fines
        vec3 L=normalize(uSunDir);vec3 H=normalize(L+V);float NoH=max(dot(N,H),0.0),VoH=max(dot(V,H),0.0);
        float Fh=0.02+0.98*pow(1.0-VoH,5.0);float up=smoothstep(-0.02,0.08,L.y)*(0.3+0.7*smoothstep(0.05,0.45,L.y));
        vec3 spec=uSunColor*uSunK*(ggx(NoH,0.1)*Fh*0.022/NoV)*up*sh;
        vec2 g2=wn(p/0.35+vec2(uTime*0.11,-uTime*0.09))*0.5;vec3 N2=normalize(vec3((g.x+g2.x)*0.6,1.0,(g.y+g2.y)*0.6));
        float glint=ggx(max(dot(N2,H),0.0),0.018)*smoothstep(0.55,0.9,rvNoise(vec3(p*7.0,uTime*2.5)))*nearK;
        spec+=uSunColor*uSunK*glint*Fh*0.008*up*sh;
        // écume légère au ras des rives
        float shore=smoothstep(0.14,0.0,dep)*smoothstep(0.35,0.75,rvNoise(vec3(p*2.2,uTime*0.4)))*0.55;
        foam=max(foam,shore);
        // composition (alpha prémultiplié)
        float a=clamp(F*uReflK+(1.0-F*uReflK)*(1.0-Tr),0.0,1.0);
        vec3 c=rf*F*uReflK+body*(1.0-F*uReflK)*(1.0-Tr)+spec;
        vec3 fc=vec3(0.36,0.38,0.34)*(0.3+0.7*uLum)+uSunColor*uSunK*0.05*sh;
        c=mix(c,fc,foam);a=max(a,foam);
        // brouillard (sur la couleur « droite »), puis révélation
        vec3 cs=c/max(a,1e-3);cs=rvApplyFog(cs,vW);
        if(uRevealGlow>0.001){float lE=length(vW.xz);if(lE>uTerrainReveal-22.0){float rrE=lE+(rvFbm3(vec3(vW.xz*0.05,2.0))-0.5)*30.0;cs+=uRevealColor*smoothstep(uTerrainReveal-6.0,uTerrainReveal,rrE)*uRevealGlow*0.6;}}
        cs=rvSafe(cs,uFogColor);
        gl_FragColor=vec4(cs*a,a);
      }`});
  const water=new THREE.Mesh(new THREE.CircleGeometry(178,96).rotateX(-Math.PI/2),waterMat);water.position.y=JF.water;water.receiveShadow=false;water.renderOrder=-1;grp.add(water);

  /* ───── nénuphars et lotus ───── */
  const padG=new THREE.CircleGeometry(0.38,20,0.35,Math.PI*2-0.7).rotateX(-Math.PI/2);padG.deleteAttribute('uv');
  const padMat=patch(new THREE.MeshStandardMaterial({color:new THREE.Color('#ffffff'),roughness:0.45,side:THREE.DoubleSide}),{
    fDiscard:GLSL_TREVEAL,
    fColor:`diffuseColor.rgb*=mix(0.78,1.12,rvNoise(vec3(vRvW.xz*9.0,1.0)));`,
    fEmissive:GLSL_TREVEAL_E},'pad');
  const pads=[];
  for(let i=0,g=0;i<(MOBILE?120:260)&&g<20000;g++){const a=rr()*Math.PI*2,r=9.5+rr()*150;const x=Math.sin(a)*r,z=Math.cos(a)*r;const sd=shoreD(x,z);
    const nearT=Math.max(Math.abs(x),Math.abs(z))<14&&rr()<0.6;
    if(!(sd>-9&&sd<-0.8)&&!nearT)continue;if(sd>-0.8)continue;if(Math.max(Math.abs(x),Math.abs(z))<9.3)continue;
    // en colonies : plus dense près des rives et au pied du temple
    if(rr()>0.35+0.65*smooth(-9,-1.5,sd)&&!nearT)continue;
    pads.push({x,z,s:0.6+rr()*1.0,yaw:rr()*6.28,ph:rr()*6.28,c:new THREE.Color().setRGB(0.12+rr()*0.08,0.25+rr()*0.1,0.05)});i++;}
  const padM=new THREE.InstancedMesh(padG,padMat,Math.max(1,pads.length));
  pads.forEach((p,i)=>{padM.setColorAt(i,p.c);});padM.receiveShadow=true;padM.instanceMatrix.setUsage(THREE.DynamicDrawUsage);padM.layers.enable(1);grp.add(padM);
  {const pts=[];for(let k=0;k<10;k++){const g=new THREE.SphereGeometry(0.085,8,6);g.scale(1,0.45,2.3);g.translate(0,0.035,0.13);g.rotateX(-0.55-(k%2)*0.4);g.rotateY(k/10*Math.PI*2+(k%2)*0.3);g.deleteAttribute('uv');pts.push(g.toNonIndexed());}
    const c=new THREE.SphereGeometry(0.055,8,6);c.translate(0,0.07,0);c.deleteAttribute('uv');pts.push(c.toNonIndexed());const g=mergeGeometries(pts);g.computeVertexNormals();
    const lm=patch(new THREE.MeshStandardMaterial({color:new THREE.Color('#f5b4cb'),roughness:0.5,emissive:new THREE.Color('#6a2038'),emissiveIntensity:0.25}),{fDiscard:GLSL_TREVEAL,
      fColor:`diffuseColor.rgb=mix(vec3(1.0,0.86,0.5),diffuseColor.rgb,smoothstep(0.05,0.11,vRvW.y-(${JF.water.toFixed(2)})));`,fEmissive:GLSL_TREVEAL_E},'lotus');
    const pk=pads.filter((p,i)=>i%7===3);const LM=new THREE.InstancedMesh(g,lm,Math.max(1,pk.length));
    pk.forEach((p,i)=>{m4.compose(V(p.x+0.15,JF.water+0.02,p.z),q.setFromAxisAngle(V(0,1,0),p.yaw),V(1.15,1.15,1.15));LM.setMatrixAt(i,m4);});LM.layers.enable(1);grp.add(LM);}

  /* ───── lanternes de pierre (aux angles du temple, et noyées le long du bras d'eau) ───── */
  const LGe=lanternGeo();
  const stoneLMat=patch(new THREE.MeshStandardMaterial({color:new THREE.Color('#ffffff'),roughness:0.9}),{
    vHead:`attribute float aPart;varying float vPart;varying vec3 vLo;`,vMain:`vPart=aPart;vLo=position;`,
    fHead:`varying float vPart;varying vec3 vLo;float rvWinL=0.0;float rvBH=0.0;`,
    fDiscard:GLSL_TREVEAL,
    fColor:`
      float n=rvFbm3(vLo*7.0+vRvW*0.1);vec3 c=mix(vec3(0.26,0.26,0.23),vec3(0.42,0.41,0.37),n);
      c=mix(c,vec3(0.11,0.21,0.05),smoothstep(0.2,0.7,vRvN.y+(rvNoise(vLo*9.0)-0.5)*0.8)*0.85);
      c=mix(c,vec3(0.1,0.16,0.05),smoothstep(0.75,0.0,vRvW.y-(${JF.water.toFixed(2)}))*0.6);
      if(vPart>0.5){float an=atan(vLo.z,vLo.x)+3.14159;float f=fract(an/1.0472);
        float w=step(abs(f-0.5),0.3)*smoothstep(1.22,1.25,vLo.y)*smoothstep(1.49,1.46,vLo.y);
        rvWinL=w;c=mix(c,vec3(0.05,0.03,0.02),w);}
      diffuseColor.rgb=c;rvBH=n*0.02;`,
    fNormal:`normal=rvPerturb(-vViewPosition,normal,rvBH,1.0);`,
    fEmissive:`
      {float fl=0.82+0.12*sin(uTime*9.0+vRvW.x*3.0)+0.06*sin(uTime*23.0+vRvW.z);
       totalEmissiveRadiance+=vec3(1.0,0.58,0.22)*rvWinL*uLantern*3.4*fl;
       if(vPart>0.5)totalEmissiveRadiance+=vec3(1.0,0.6,0.25)*uLantern*0.1*fl;}`+GLSL_TREVEAL_E,
  },'lant');
  const lant=new THREE.InstancedMesh(LGe,stoneLMat,JF.lanterns.length);
  const eL=new THREE.Euler();
  JF.lanterns.forEach(([x,z,tilt,kind],i)=>{const y=kind===2?PAG.plH:(kind===1?JF.water-0.85:groundH(x,z)-0.02);
    eL.set(tilt,Math.atan2(-x,-z)+Math.PI/6,tilt*0.6);q.setFromEuler(eL);m4.compose(V(x,y,z),q,V(1,1,1));lant.setMatrixAt(i,m4);});
  lant.castShadow=true;lant.receiveShadow=true;lant.layers.enable(1);grp.add(lant);
  const fireL=new THREE.PointLight(new THREE.Color('#ff9a4a'),0,18,1.6);fireL.position.set(0,2.4,11.2);grp.add(fireL);

  /* ───── lanternes de papier qui dérivent sur l'eau, la nuit ───── */
  const NFL=MOBILE?14:28;
  const flG=(()=>{const b=new THREE.BoxGeometry(0.34,0.3,0.34);b.translate(0,0.19,0);const base=new THREE.BoxGeometry(0.42,0.05,0.42);base.translate(0,0.025,0);[b,base].forEach(x=>x.deleteAttribute('uv'));
    const g=mergeGeometries([b,base]);const n=g.attributes.position.count,a=new Float32Array(n);for(let i=0;i<n;i++)a[i]=g.attributes.position.getY(i)>0.06?1:0;g.setAttribute('aPaper',new THREE.BufferAttribute(a,1));return g;})();
  // couleurs des lanternes de papier : rouge, bleu, vert, violet (mélangées)
  const FLC=[[1.15,0.05,0.02],[0.08,0.28,1.5],[0.12,1.0,0.16],[0.62,0.1,1.4]];
  {const ca=new Float32Array(NFL*3);for(let i=0;i<NFL;i++)ca.set(FLC[i%4],i*3);flG.setAttribute('aLC',new THREE.InstancedBufferAttribute(ca,3));}
  const flMat=patch(new THREE.MeshStandardMaterial({color:new THREE.Color('#e8d2a8'),roughness:0.8}),{
    vHead:`attribute float aPaper;attribute vec3 aLC;varying float vPaper;varying vec3 vLC;`,vMain:`vPaper=aPaper;vLC=aLC;`,fHead:`varying float vPaper;varying vec3 vLC;`,
    fColor:`if(vPaper<0.5)diffuseColor.rgb=vec3(0.25,0.16,0.08);else diffuseColor.rgb*=mix(vec3(1.0),min(vLC,vec3(1.0)),0.85);`,
    fEmissive:`{float fl=0.85+0.1*sin(uTime*8.0+vRvW.x*7.0)+0.05*sin(uTime*21.0+vRvW.z*5.0);totalEmissiveRadiance+=vLC*vPaper*uLantern*1.9*fl;}`},'floatl');
  const flM=new THREE.InstancedMesh(flG,flMat,NFL);flM.instanceMatrix.setUsage(THREE.DynamicDrawUsage);flM.layers.enable(1);grp.add(flM);
  const FL=[];for(let i=0;i<NFL;i++){const t=rr();const a=JF.camAz+(rr()-0.5)*0.24,r=12+t*58;FL.push({a,r,w:(0.004+rr()*0.006)*(rr()<0.5?1:-1),ph:rr()*6.28,s:0.85+rr()*0.35,dr:(rr()-0.5)*0.15});}

  /* ───── cascade : falaise de basalte, chute ───── */
  const fallGrp=new THREE.Group();fallGrp.position.set(F.x,0,F.z);fallGrp.rotation.y=F.yaw;grp.add(fallGrp);
  const NA=48,NY=30,HW=13,Ht=F.top+1.5;
  const zWall=(x,y)=>{const u=x/HW,t=clamp01((y+1.5)/(Ht+1.5));return -3+1.0-4.5*t-4*smooth(0.82,1,t)-3.2*u*u;};
  const cpos=[],cidx=[];
  for(let j=0;j<=NY;j++)for(let i=0;i<=NA;i++){const x=(i/NA*2-1)*HW,y=-1.5+(Ht+1.5)*j/NY;
    const dz=(vn3(x*0.35,y*0.18,1.3)-0.5)*1.8+(vn3(x*0.9,y*0.5,7)-0.5)*0.6+(Math.floor(y/2.4)%2)*0.3;
    cpos.push(x+(vn3(y*0.3,x*0.2,4)-0.5)*0.8,y,zWall(x,y)+dz);}
  for(let j=0;j<NY;j++)for(let i=0;i<NA;i++){const a=j*(NA+1)+i,b=a+1,c=a+NA+1,d=c+1;cidx.push(a,b,c,b,d,c);}
  const cg=new THREE.BufferGeometry();cg.setAttribute('position',new THREE.Float32BufferAttribute(cpos,3));cg.setIndex(cidx);cg.computeVertexNormals();
  {const n=cg.attributes.normal;const m=Math.floor(NY/2)*(NA+1)+Math.floor(NA/2);
   if(n.getZ(m)<0){for(let k=0;k<cidx.length;k+=3){const s=cidx[k+1];cidx[k+1]=cidx[k+2];cidx[k+2]=s;}cg.setIndex(cidx);cg.computeVertexNormals();}}
  const cliffMat=patch(new THREE.MeshStandardMaterial({color:new THREE.Color('#ffffff'),roughness:0.85}),{
    uniforms:{uFC:{value:new THREE.Vector2(F.x,F.z)}},fHead:`uniform vec2 uFC;float rvBH=0.0;float rvWetC=0.0;`,
    fDiscard:GLSL_TREVEAL,
    fColor:`
      float n=rvFbm3(vRvW*vec3(0.5,0.12,0.5));vec3 c=mix(vec3(0.07,0.08,0.07),vec3(0.17,0.17,0.15),n);
      float ledge=smoothstep(0.3,0.7,vRvN.y);c=mix(c,mix(vec3(0.08,0.17,0.04),vec3(0.2,0.31,0.07),rvNoise(vRvW*1.5)),ledge*0.9);
      c=mix(c,vec3(0.1,0.18,0.05),smoothstep(0.5,0.72,rvFbm3(vRvW*0.8))*0.6);
      rvWetC=smoothstep(7.0,2.0,length(vRvW.xz-uFC));c*=mix(1.0,0.55,rvWetC);
      diffuseColor.rgb=c;rvBH=n*0.25+rvNoise(vRvW*2.0)*0.05;`,
    fRough:`roughnessFactor=mix(0.88,0.25,rvWetC);`,
    fNormal:`normal=rvPerturb(-vViewPosition,normal,rvBH,1.0);`,
    fEmissive:GLSL_TREVEAL_E,
  },'cliff');
  const cliff=new THREE.Mesh(cg,cliffMat);cliff.castShadow=true;cliff.receiveShadow=true;cliff.layers.enable(1);fallGrp.add(cliff);
  const fpos=[],fuv=[],fidx=[];const NFX=10,NFY=44;
  for(let j=0;j<=NFY;j++){const v=j/NFY;const y=F.top-0.4-(F.top-0.4+0.3)*v;
    const zf=zWall(0,y)+1.3+1.8*(1-smooth(0,0.18,v));
    const w=3.4+v*3.0;for(let i=0;i<=NFX;i++){const u=i/NFX*2-1;fpos.push(u*w,y,zf+Math.abs(u)*0.3);fuv.push(u,v);}}
  for(let j=0;j<NFY;j++)for(let i=0;i<NFX;i++){const a=j*(NFX+1)+i,b=a+1,c=a+NFX+1,d=c+1;fidx.push(a,c,b,b,c,d);}
  const fg=new THREE.BufferGeometry();fg.setAttribute('position',new THREE.Float32BufferAttribute(fpos,3));fg.setAttribute('uv',new THREE.Float32BufferAttribute(fuv,2));fg.setIndex(fidx);
  const fallMat=new THREE.ShaderMaterial({uniforms:Object.assign({},U),transparent:true,depthWrite:false,side:THREE.DoubleSide,
    vertexShader:`varying vec2 vU;varying vec3 vW;void main(){vU=uv;vec4 w=modelMatrix*vec4(position,1.0);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader:"#define RV_FRAG\n"+GLSL_NOISE+GLSL_FOG+GLSL_REVEAL+`varying vec2 vU;varying vec3 vW;
      void main(){
        {float lT=length(vW.xz);if(lT>uTerrainReveal-16.0){float rrT=lT+(rvFbm3(vec3(vW.xz*0.05,2.0))-0.5)*30.0;if(rrT>uTerrainReveal) discard;}}
        float n=rvFbm3(vec3(vU.x*6.0,vU.y*9.0-uTime*3.2,uTime*0.4))*0.7+rvNoise(vec3(vU.x*18.0,vU.y*30.0-uTime*7.0,1.0))*0.3;
        float edge=smoothstep(1.0,0.72,abs(vU.x+(rvNoise(vec3(vU.y*6.0,uTime*0.5,3.0))-0.5)*0.3));
        float a=(0.4+0.6*smoothstep(0.38,0.75,n))*edge*smoothstep(0.0,0.03,vU.y);
        a=max(a,smoothstep(0.82,1.0,vU.y)*edge*0.8);
        vec3 c=mix(vec3(0.6,0.7,0.72),vec3(0.95,0.97,0.98),smoothstep(0.4,0.8,n))*(0.35+0.65*uLum)+uSunColor*0.06;
        c=rvApplyFog(c,vW);
        gl_FragColor=vec4(c,a*0.92);
      }`});
  const falls=new THREE.Mesh(fg,fallMat);falls.renderOrder=5;falls.frustumCulled=false;falls.layers.enable(1);fallGrp.add(falls);

  /* ───── animation ───── */
  const _p=V(0,0,0),_q=new THREE.Quaternion(),_s=V(1,1,1),Yv=V(0,1,0),_e=new THREE.Euler();
  function update(dt,T){
    const L=U.uLantern.value;
    fireL.intensity=L*(6+1.2*Math.sin(T*9.0)+0.8*Math.sin(T*17.3));
    pads.forEach((p,i)=>{m4.compose(_p.set(p.x+Math.sin(T*0.3+p.ph)*0.04,JF.water+0.012,p.z+Math.cos(T*0.27+p.ph)*0.04),_q.setFromAxisAngle(Yv,p.yaw+Math.sin(T*0.2+p.ph)*0.08),_s.set(p.s,1,p.s));padM.setMatrixAt(i,m4);});
    padM.instanceMatrix.needsUpdate=true;
    // lanternes de papier : elles n'apparaissent qu'à la tombée de la nuit, dérivent lentement vers le temple et reviennent
    const vis=smooth(0.25,0.6,L);
    FL.forEach((f,i)=>{f.r+= -0.35*dt*(1+0.3*Math.sin(T*0.2+f.ph));if(f.r<11)f.r+=62;f.a+=f.w*dt*6;
      const a=JF.camAz+Math.sin(T*0.05+f.ph)*0.12*(f.r/60)+f.dr;const x=Math.sin(a)*f.r,z=Math.cos(a)*f.r;
      const fade=smooth(11,15,f.r)*smooth(70,58,f.r)*vis;
      _e.set(Math.sin(T*0.9+f.ph)*0.06,f.ph+T*0.1,Math.cos(T*0.8+f.ph)*0.06);_q.setFromEuler(_e);
      m4.compose(_p.set(x,JF.water-0.03+Math.sin(T*1.1+f.ph)*0.02,z),_q,_s.set(f.s*fade+1e-4,f.s*fade+1e-4,f.s*fade+1e-4));flM.setMatrixAt(i,m4);});
    flM.instanceMatrix.needsUpdate=true;
  }
  update(0,0);
  return {grp,update,fireL,water,reflect:reflRender};
}

/* ═══ 29 · Traces au sol — inutiles dans la jungle (mousse et gravier) : fonctions vides,
   gardées pour que le moteur commun n'ait pas à changer. ═══ */
const TRAIL={ready:false};
function initTrails(){}
function trailStamp(){}
function trailsFlush(){}

/* ═══ 30 · Vie de la jungle ═══
   Lot 1 : la lumière de la porte de la pagode (la nuit). Oiseaux, papillons, libellules et
   cerfs arriveront au lot 4 ; l'interface reste celle de la faune de la L2. */
function buildFauna(){
  const grp=new THREE.Group();scene.add(grp);
  // lueur chaude qui s'échappe de la porte de la pagode, sur le gravier
  const campL=new THREE.PointLight(new THREE.Color('#ffb066'),0,15,1.7);campL.position.set(0,2.4,PAG.T[0].hw+1.6);grp.add(campL);
  const ppl=buildPeople();
  const wild=buildWildlife();
  function update(dt,T,on){const L=U.uLantern.value;campL.intensity=L*(7.5+0.8*Math.sin(T*5.3)+0.5*Math.sin(T*12.1));ppl.update(dt,T);wild.update(dt,T);}
  const none=()=>[];
  return {grp,update,agents:[],walkers:[],R:[],sMid:0,campL,ppl,wild,fireL2:ppl.fireL,
    spawnCaravan(){},popCaravan(){},debugPlace(){},startNow(){},scene:none,spawnWalkers(){}};
}

/* ═══ 30b · Les gens de la jungle : cueilleurs de cacao, chasseurs, explorateurs égarés, chaloupe ═══
   Des silhouettes à mi-distance, dans la brume — la vie qui continue autour du temple oublié.
   Chaque personnage est un maillage articulé (squelette de 17 os) animé à la main, sans fichier
   externe : marche (feutrée pour les chasseurs), cueillette, tri des cabosses, lecture de carte,
   longue-vue, coups de rame. Représentation sobre et respectueuse : des gens qui travaillent,
   chassent, se repèrent — aucun costume de carnaval. */

const PPL_BONES=[ // nom, parent, articulation (pose de référence : debout, face +z, 1,75 m)
  ['hips',-1,[0,0.95,0]],['spine',0,[0,1.08,0]],['chest',1,[0,1.27,0]],['neck',2,[0,1.47,0]],['head',3,[0,1.56,0]],
  ['armL',2,[0.185,1.42,0]],['foreL',5,[0.215,1.16,0]],['handL',6,[0.235,0.92,0.01]],
  ['armR',2,[-0.185,1.42,0]],['foreR',8,[-0.215,1.16,0]],['handR',9,[-0.235,0.92,0.01]],
  ['legL',0,[0.095,0.93,0]],['shinL',11,[0.1,0.51,0.01]],['footL',12,[0.1,0.09,-0.005]],
  ['legR',0,[-0.095,0.93,0]],['shinR',14,[-0.1,0.51,0.01]],['footR',15,[-0.1,0.09,-0.005]],
];
const PB={};PPL_BONES.forEach((b,i)=>PB[b[0]]=i);

/* corps : morceaux lisses (ellipsoïdes, segments effilés) rattachés chacun à un os */
function pplBody(o){
  const parts=[],V=(x,y,z)=>new THREE.Vector3(x,y,z),C=c=>c instanceof THREE.Color?c:new THREE.Color(c);
  let KD=-1;const SD=((pplBody.n=(pplBody.n||0)+1)*0.61803)%1;   // KD : nature de la matière (0 peau · 1 tissu · 2 cuir, bois, métal · 3 cheveux ; négatif : déduite de la couleur)
  const add=(g,bone,col)=>{g.deleteAttribute('uv');const n=g.attributes.position.count,c=C(col);
    const ca=new Float32Array(n*3),si=new Uint16Array(n*4),sw=new Float32Array(n*4);
    for(let i=0;i<n;i++){ca[i*3]=c.r;ca[i*3+1]=c.g;ca[i*3+2]=c.b;si[i*4]=bone;sw[i*4]=1;}
    g.setAttribute('color',new THREE.BufferAttribute(ca,3));g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(si,4));g.setAttribute('skinWeight',new THREE.BufferAttribute(sw,4));
    const kd=KD>=0?KD:(c.equals(skin)?0:(KD===-2?(o.boot&&c.equals(boot)?2:1):3)),ak=new Float32Array(n*4);for(let i=0;i<n;i++){ak[i*4]=kd;ak[i*4+2]=1;ak[i*4+3]=SD*0.98;}
    g.setAttribute('aK',new THREE.BufferAttribute(ak,4));parts.push(g);};
  const ell=(x,y,z,rx,ry,rz,bone,col,s=12)=>{const g=new THREE.SphereGeometry(1,s,Math.max(6,Math.round(s*0.7)));g.scale(rx,ry,rz);g.translate(x,y,z);add(g,bone,col);};
  const seg=(a,b,r0,r1,bone,col,s=10,caps=true)=>{const A=V(...a),B=V(...b),d=B.clone().sub(A),L=d.length();
    const g=new THREE.CylinderGeometry(r1,r0,L,s,2,true);g.translate(0,L/2,0);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0,1,0),d.normalize()));g.translate(A.x,A.y,A.z);add(g,bone,col);
    if(caps){ell(A.x,A.y,A.z,r0,r0,r0,bone,col,s);ell(B.x,B.y,B.z,r1,r1,r1,bone,col,s);}};
  const box=(x,y,z,sx,sy,sz,bone,col,rx=0,ry=0,rz=0)=>{const g=new THREE.BoxGeometry(sx,sy,sz);g.rotateX(rx);g.rotateY(ry);g.rotateZ(rz);g.translate(x,y,z);add(g,bone,col);};
  const cyl=(x,y,z,rt,rb,h,bone,col,s=14,open=false,rx=0,rz=0)=>{const g=new THREE.CylinderGeometry(rt,rb,h,s,1,open);g.rotateX(rx);g.rotateZ(rz);g.translate(x,y,z);add(g,bone,col);};
  const w=o.w||1,skin=C(o.skin),shirt=C(o.shirt||o.skin),pants=C(o.pants||o.skin),boot=C(o.boot||o.skin),hair=C(o.hair||'#1a120c');
  // tête
  ell(0,1.655,0.01,0.092,0.113,0.102,PB.head,skin);ell(0,1.598,0.035,0.068,0.058,0.072,PB.head,skin);
  ell(0,1.645,0.102,0.016,0.024,0.022,PB.head,skin);ell(0.091,1.65,0,0.014,0.03,0.02,PB.head,skin);ell(-0.091,1.65,0,0.014,0.03,0.02,PB.head,skin);
  ell(0.034,1.668,0.097,0.011,0.007,0.006,PB.head,'#140e0a',6);ell(-0.034,1.668,0.097,0.011,0.007,0.006,PB.head,'#140e0a',6);
  if(o.hairLong)ell(0,1.63,-0.04,0.1,0.13,0.085,PB.head,hair);
  ell(0,1.688,-0.016,0.097,0.088,0.1,PB.head,hair);
  if(o.beard)ell(0,1.592,0.058,0.072,0.05,0.058,PB.head,o.beard);
  seg([0,1.46,0],[0,1.585,0.005],0.05,0.046,PB.neck,skin,10,false);
  KD=-2;
  // buste
  ell(0,1.325,0,0.165*w,0.17,0.105,PB.chest,shirt);ell(0,1.405,-0.005,0.2*w,0.07,0.095,PB.chest,shirt);
  ell(0,1.15,0.005,0.145*w,0.15,0.095,PB.spine,o.bareBelly?skin:shirt);
  ell(0,0.97,0,0.155*w,0.11,0.1,PB.hips,pants);
  /* ══ Vêtements : de vraies enveloppes de tissu par-dessus le corps ══
     Chaque vêtement est un tube d'anneaux empilés : plis, ourlets, bandes tissées, et surtout des poids d'os MÉLANGÉS
     (le tissu suit le buste, les hanches et les deux jambes à la fois) au lieu de morceaux rigides emboîtés. */
  {const ss=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};   // marche aussi avec a>b
   const lerp2=(a,b,t)=>a+(b-a)*t,bump=(y,c,s)=>Math.exp(-((y-c)/s)*((y-c)/s));
   const prof=(K,y)=>{const n=K.length;if(y>=K[0][0])return K[0];if(y<=K[n-1][0])return K[n-1];let i=1;while(K[i][0]>y)i++;
     const A=K[i-1],B=K[i],u=(A[0]-y)/(A[0]-B[0]),t=u*0.5+ss(0,1,u)*0.5;return [y,lerp2(A[1],B[1],t),lerp2(A[2],B[2],t)];};
   const h1=SD*6.283,h2=SD*17.31+1.3,h3=SD*29.7+2.1;
   const tint=(c,k)=>C(c).clone().multiplyScalar(k),blend=(c,d,k)=>C(c).clone().lerp(C(d),k);
   const shell=(S)=>{const ny=S.ny,ns=S.ns||26,n=(ny+1)*(ns+1),pos=new Float32Array(n*3),ca=new Float32Array(n*3),si=new Uint16Array(n*4),sw=new Float32Array(n*4),ak=new Float32Array(n*4),idx=[];
     const c0=C(S.col);let v=0;
     for(let iy=0;iy<=ny;iy++){const t=iy/ny;for(let ia=0;ia<=ns;ia++,v++){const a=Math.PI+(ia%ns)/ns*Math.PI*2;   // couture dans le dos · a=2π : devant (+z)
       const P=S.at(t,a);pos[v*3]=P.p[0];pos[v*3+1]=P.p[1];pos[v*3+2]=P.p[2];
       const c=P.col||c0;ca[v*3]=c.r;ca[v*3+1]=c.g;ca[v*3+2]=c.b;
       const W=P.w.filter(e=>e[1]>1e-4).slice(0,4);let tw=0;W.forEach(e=>tw+=e[1]);W.forEach((e,k)=>{si[v*4+k]=e[0];sw[v*4+k]=e[1]/tw;});
       ak[v*4]=S.kind==null?1:S.kind;ak[v*4+1]=P.sway||0;ak[v*4+2]=P.ao==null?1:Math.max(0.3,Math.min(1,P.ao));ak[v*4+3]=(S.pat||0)+SD*0.98;
       if(iy<ny&&ia<ns){const i0=v,i1=v+ns+1;idx.push(i0,i1,i0+1,i0+1,i1,i1+1);}}}
     const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();
     const nr=g.attributes.normal;for(let iy=0;iy<=ny;iy++){const i0=iy*(ns+1),i1=i0+ns,x=nr.getX(i0)+nr.getX(i1),y=nr.getY(i0)+nr.getY(i1),z=nr.getZ(i0)+nr.getZ(i1),l=Math.hypot(x,y,z)||1;nr.setXYZ(i0,x/l,y/l,z/l);nr.setXYZ(i1,x/l,y/l,z/l);}
     g.setAttribute('color',new THREE.BufferAttribute(ca,3));g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(si,4));g.setAttribute('skinWeight',new THREE.BufferAttribute(sw,4));
     g.setAttribute('aK',new THREE.BufferAttribute(ak,4));parts.push(g);};
   // poids : buste → ventre → hanches, puis hanches + jambe du côté concerné (le tissu suit le pas)
   const wTorso=(y,x,legK)=>{if(y>=1.30)return [[PB.chest,1]];if(y>=1.12){const t=(1.30-y)/0.18;return [[PB.chest,1-t],[PB.spine,t]];}
     if(y>=0.99){const t=(1.12-y)/0.13;return [[PB.spine,1-t],[PB.hips,t]];}
     const wl=ss(0.98,0.64,y)*legK,sL=ss(-0.05,0.05,x);return [[PB.hips,1-wl],[PB.legL,wl*sL],[PB.legR,wl*(1-sL)]];};
   const dAng=(a,b)=>{let d=(a-b)%(Math.PI*2);if(d>Math.PI)d-=Math.PI*2;if(d<-Math.PI)d+=Math.PI*2;return d;};
   const covered=o.shirt&&!o.bareBelly;
   const KT=[[1.478,0.064,0.062],[1.44,0.15*w,0.088],[1.40,0.208*w,0.103],[1.325,0.183*w,0.122],[1.2,0.167*w,0.117],[1.09,0.162*w,0.114],[1.045,0.158*w,0.107]];
   /* — chemise (explorateurs) ou tunique sans manches (cueilleurs) — */
   if(covered){
     const tun=!!o.tunic,yB=tun?(o.skirt?0.85:0.69):1.04,K=KT.slice();
     if(tun){K.push([0.95,0.18*w,0.132],[yB,(o.skirt?0.208:0.218)*w,o.skirt?0.162:0.17]);}
     const band=tun?blend(shirt,'#ead9ae',0.55):null,plk=tint(shirt,0.86);
     shell({ny:tun?20:13,ns:30,col:shirt,pat:tun?1:0,at:(t,a)=>{
       const yb=tun?yB+0.018*Math.sin(a*3+h1):yB,y=lerp2(1.478,yb,t),k=prof(K,y),sa=Math.sin(a),caa=Math.cos(a);
       const fl=sa*sa*ss(1.40,1.27,y)*ss(1.03,1.13,y),pl=tun?ss(1.03,yB,y):0;
       const pleat=Math.sin(a*7+h1)*0.013+Math.sin(a*12+h2)*0.006;
       let dr=0.007*bump(y,1.105,0.045)*(0.55+0.45*Math.sin(a*9+h1))+0.004*Math.sin(y*55+sa*3+h2)*fl+pl*(pleat+0.008*pl);
       if(tun)dr-=0.012*bump(y,1.045,0.022);                                   // cordelette : la taille est serrée
       const x=(k[1]+dr)*sa,z=0.004+(k[2]+dr)*caa;
       let col=null;if(tun){if(y<yb+0.04||y>1.452)col=band;}else if(Math.abs(dAng(a,0))<0.075&&y<1.455)col=plk;
       return {p:[x,y,z],w:wTorso(y,x,0.58),sway:pl*pl*0.9,col,
         ao:1-0.34*sa*sa*bump(y,1.3,0.07)-0.22*bump(y,1.05,0.02)-0.3*pl*Math.max(0,-pleat/0.019)};}});
     if(tun){KD=2;shell({ny:2,ns:22,kind:2,col:'#6e5532',at:(t,a)=>{const y=1.058-t*0.026,k=prof(K,y),b=0.004+0.005*Math.sin(t*Math.PI);
        return {p:[(k[1]-0.006+b)*Math.sin(a),y,0.004+(k[2]-0.006+b)*Math.cos(a)],w:[[PB.spine,0.5],[PB.hips,0.5]]};}});KD=-2;}
     else{
       // col, poches à rabat, boutons, pattes d'épaule
       cyl(0,1.482,0.004,0.057,0.082,0.044,PB.chest,tint(shirt,1.06),16,true);
       for(const s of [1,-1]){box(0.088*s*w,1.332,0.109,0.066,0.068,0.006,PB.chest,tint(shirt,0.95),0,0.35*s,0);box(0.088*s*w,1.366,0.111,0.07,0.022,0.008,PB.chest,tint(shirt,0.84),0,0.35*s,0);
         box(0.15*s*w,1.461,-0.002,0.075,0.007,0.034,PB.chest,tint(shirt,0.9),0,0,-0.2*s);}
       KD=2;for(let k=0;k<5;k++){const y=1.42-k*0.082,kk=prof(K,y);ell(0,y,0.004+kk[2]+0.003+(y<1.2?0.005*bump(y,1.105,0.045):0),0.0055,0.0055,0.003,y>=1.3?PB.chest:y>=1.12?PB.spine:PB.hips,'#e6dec6',6);}
       for(const s of [1,-1])ell(0.088*s*w+0.0015*s,1.366,0.1165,0.005,0.005,0.003,PB.chest,'#3a2c1c',6);KD=-2;
     }
     // manches courtes : évasées, ourlet, l'emmanchure suit à moitié le buste, à moitié le bras
     if(o.sleeve==='short')for(const s of [1,-1]){const A=PB['arm'+(s>0?'L':'R')],hem=tint(shirt,0.84);
       shell({ny:6,ns:16,col:shirt,at:(t,a)=>{const y=lerp2(1.462,1.258,t),r=lerp2(0.071,0.061,t)+(t>0.8?0.004:0)+0.003*Math.sin(a*5+h2+s)+0.003*Math.sin(y*70+a)*t;
         const wa=0.42+0.58*ss(0,0.4,t);return {p:[lerp2(0.181,0.203,t)*s*w+r*Math.sin(a),y,r*Math.cos(a)],w:[[A,wa],[PB.chest,1-wa]],col:t>0.84?hem:null,ao:1-0.3*Math.max(0,-s*Math.sin(a))*ss(0,0.6,t)}; }});}
   }
   /* — pantalon de toile : genou qui plie en douceur, plis derrière le genou, bouffant au-dessus de la botte — */
   if(o.legs==='long'){
     const yb=o.boot?0.305:0.115,KL=[[0.985,0.093],[0.9,0.089],[0.72,0.077],[0.56,0.069],[0.5,0.067],[0.43,0.063]].concat(o.boot?[[0.365,0.066],[0.305,0.052]]:[[0.115,0.052]]);
     const kl=(y)=>{const n=KL.length;if(y>=KL[0][0])return KL[0][1];if(y<=KL[n-1][0])return KL[n-1][1];let i=1;while(KL[i][0]>y)i++;const u=(KL[i-1][0]-y)/(KL[i-1][0]-KL[i][0]);return lerp2(KL[i-1][1],KL[i][1],u);};
     for(const s of [1,-1]){const A=s>0?'L':'R';
       shell({ny:16,ns:20,col:pants,at:(t,a)=>{const y=lerp2(0.985,yb,t),sa=Math.sin(a),caa=Math.cos(a),back=0.5-0.5*caa,kb=bump(y,0.5,0.07);
         const dr=0.0055*kb*Math.sin(y*85+Math.sin(a+h1)*1.5)*(0.35+0.65*back)+0.004*ss(0.8,0.95,y)*Math.sin(a*3+y*30+h2)+(o.boot?0.008*bump(y,0.375,0.045)*(0.6+0.4*Math.sin(a*6+h1+s)):0)+0.002*Math.sin(a*4+y*18+h3);
         const r=kl(y)+dr,cx=lerp2(0.095,0.1,ss(0.93,0.5,y))*s,cz=y>0.51?0.01*ss(0.93,0.51,y):lerp2(0.01,-0.004,ss(0.51,0.1,y));
         const wh=ss(0.9,0.99,y)*0.65,wsn=ss(0.57,0.44,y);
         return {p:[cx+r*sa,y,cz+r*caa],w:y>0.75?[[PB.hips,wh],[PB['leg'+A],1-wh]]:[[PB['leg'+A],1-wsn],[PB['shin'+A],wsn]],
           ao:1-0.3*kb*back-0.32*Math.max(0,-s*sa)*ss(0.62,0.95,y)-(o.boot?0.25*bump(y,0.31,0.02):0)};}});}
     // fond de culotte : relie les deux jambes aux hanches
     shell({ny:4,ns:26,col:pants,at:(t,a)=>{const y=lerp2(1.04,0.86,t),sa=Math.sin(a),x=(lerp2(0.161,0.176,ss(0,0.7,t))*w+0.003*Math.sin(a*5+h3))*sa,z=(lerp2(0.109,0.114,ss(0,0.6,t))-0.012*ss(0.7,1,t))*Math.cos(a);
       const wl=ss(0.3,1,t)*0.5,sL=ss(-0.05,0.05,x);return {p:[x,y,z],w:[[PB.hips,1-wl],[PB.legL,wl*sL],[PB.legR,wl*(1-sL)]],ao:1-0.25*ss(0.5,1,t)*(1-Math.abs(sa))};}});
   }
   /* — ceinture de cuir et boucle de laiton — */
   if(o.belt){KD=2;shell({ny:2,ns:26,kind:2,col:o.belt,at:(t,a)=>{const y=1.063-t*0.052,b=0.003*Math.sin(t*Math.PI);return {p:[(0.165*w+b)*Math.sin(a),y,0.003+(0.112+b)*Math.cos(a)],w:[[PB.hips,1]]};}});
     box(0,1.037,0.117,0.04,0.036,0.009,PB.hips,'#b9a052');box(0,1.037,0.1205,0.022,0.018,0.006,PB.hips,'#3a2c18');KD=-2;}
   /* — pagne drapé (cueilleuses) : plis qui s'ouvrent vers l'ourlet, pan croisé, bande tissée — */
   if(o.skirt){const K=[[1.045,0.16*w,0.109],[0.95,0.18*w,0.13],[0.8,0.197*w,0.152],[0.47,0.224*w,0.18]],wb=tint(o.skirt,0.68),hb=blend(o.skirt,'#ecdcb2',0.5);
     shell({ny:16,ns:34,col:o.skirt,pat:1,at:(t,a)=>{const yb=0.475+0.028*Math.cos(a-0.6),y=lerp2(1.045,yb,t),k=prof(K,y),pl=ss(1.0,0.5,y),pleat=Math.sin(a*8+h1)*0.016+Math.sin(a*13+h2)*0.007;
       const dr=pl*(pleat+0.006)+0.011*bump(dAng(a,0.6),0,0.11)*(0.3+pl);const x=(k[1]+dr)*Math.sin(a),z=0.004+(k[2]+dr)*Math.cos(a);
       return {p:[x,y,z],w:wTorso(Math.min(y,0.989),x,0.72),sway:ss(0.9,0.5,y),col:y>1.012?wb:t>0.93?hb:null,ao:1-0.36*pl*Math.max(0,-pleat/0.023)-0.2*bump(dAng(a,0.72),0,0.05)};}});}
   /* — chasseurs : pagne court, pan qui pend devant et derrière, ceinture d'étoffe roulée et nouée — */
   if(o.sash&&o.bareBelly){const K=[[1.03,0.158*w,0.106],[0.93,0.177*w,0.127],[0.66,0.194*w,0.148]],wrap=o.pants||'#4a3420';
     shell({ny:9,ns:28,col:wrap,at:(t,a)=>{const yb=0.675+0.022*Math.sin(a*3+h1),y=lerp2(1.03,yb,t),k=prof(K,y),pl=ss(1.0,0.66,y),pleat=Math.sin(a*7+h2)*0.012+Math.sin(a*11+h1)*0.005;
       const dr=pl*(pleat+0.004),x=(k[1]+dr)*Math.sin(a);return {p:[x,y,0.003+(k[2]+dr)*Math.cos(a)],w:wTorso(Math.min(y,0.989),x,0.7),sway:pl*0.7,col:t>0.9?tint(wrap,0.7):null,ao:1-0.35*pl*Math.max(0,-pleat/0.017)};}});
     const flap=(dir,y1,hw)=>shell({ny:8,ns:8,col:o.sash,pat:1,at:(t,a)=>{const y=lerp2(1.0,y1,t),k=prof(K,Math.max(y,0.66)),x=lerp2(hw*0.85,hw,t)*Math.sin(a);
       return {p:[x,y,dir*(k[2]+0.024+0.004*Math.sin(y*38+h3))+0.004*Math.cos(a)],w:wTorso(Math.min(y,0.989),x,0.7),sway:t*1.3,col:t>0.86?tint(o.sash,0.62):null,ao:1-0.15*t};}});
     flap(1,0.5,0.058);flap(-1,0.58,0.062);
     shell({ny:5,ns:26,col:o.sash,at:(t,a)=>{const y=1.078-t*0.092,b=0.006+0.013*Math.sin(t*Math.PI)+0.003*Math.sin(a*14+t*7+h1);
       return {p:[(0.158*w+b)*Math.sin(a),y,0.003+(0.106+b)*Math.cos(a)],w:[[PB.hips,0.75],[PB.spine,0.25]],ao:1-0.25*(1-Math.sin(t*Math.PI))};}});
     // nœud sur la hanche et deux pans qui flottent
     ell(-0.165*w,1.03,0.05,0.026,0.024,0.024,PB.hips,o.sash,8);
     for(let q=0;q<2;q++)shell({ny:6,ns:6,col:o.sash,at:(t,a)=>{const y=lerp2(1.02,0.76+q*0.07,t),hw=lerp2(0.012,0.026,t);
       return {p:[-0.176*w-0.012*t+0.003*Math.cos(a),y,0.052+q*0.022-q*0.03*t+hw*Math.sin(a)],w:wTorso(Math.min(y,0.989),-0.2,0.5),sway:t*1.6,col:t>0.85?tint(o.sash,0.62):null};}});
   }
   // semelles et revers des bottes
   if(o.boot){KD=2;for(const s of [1,-1]){const A=s>0?'L':'R';box(0.1*s,0.012,0.05,0.086,0.022,0.225,PB['foot'+A],'#1c140e');cyl(0.1*s,0.3,-0.005,0.056,0.054,0.026,PB['shin'+A],tint(boot,1.25),12,true);}KD=-2;}
  }
  // bras
  for(const s of [1,-1]){const A=s>0?'L':'R';
    const sh=[0.185*s*w,1.42,0],el=[0.215*s*w,1.16,0],wr=[0.235*s*w,0.92,0.01];
    ell(0.17*s*w,1.415,0,0.065,0.06,0.065,PB.chest,o.sleeve==='none'?skin:shirt);
    if(o.sleeve==='short'){const mid=[(sh[0]+el[0])/2,1.29,0];seg(sh,mid,0.052,0.047,PB['arm'+A],shirt);seg(mid,el,0.042,0.04,PB['arm'+A],skin);}
    else seg(sh,el,0.049,0.041,PB['arm'+A],o.sleeve==='long'?shirt:skin);
    seg(el,wr,0.039,0.031,PB['fore'+A],o.sleeve==='long'?shirt:skin);
    if(o.armband)cyl(el[0]*0.96+sh[0]*0.04,1.3,0,0.05,0.05,0.03,PB['arm'+A],o.armband,10,true);
    ell(0.24*s*w,0.865,0.015,0.028,0.056,0.021,PB['hand'+A],skin);
  }
  // jambes
  for(const s of [1,-1]){const A=s>0?'L':'R';
    const hp=[0.095*s,0.93,0],kn=[0.1*s,0.51,0.01],an=[0.1*s,0.09,-0.005];
    if(o.legs==='shorts'){const mid=[0.098*s,0.7,0.005];seg(hp,mid,0.072,0.06,PB['leg'+A],pants);seg(mid,kn,0.056,0.05,PB['leg'+A],skin);}
    else seg(hp,kn,0.07,0.051,PB['leg'+A],o.legs==='long'?pants:skin);
    seg(kn,an,0.049,0.034,PB['shin'+A],o.legs==='long'?pants:skin);
    if(o.boot)seg([an[0],0.08,an[2]],[an[0],0.3,an[2]],0.047,0.05,PB['shin'+A],boot,10);
    ell(0.1*s,0.045,0.055,0.046,0.04,0.11,PB['foot'+A],o.boot?boot:skin);
  }
  KD=1;
  // coiffes
  if(o.hat==='pith'){ell(0,1.742,0.005,0.124,0.085,0.135,PB.head,o.hatCol);cyl(0,1.712,0.005,0.19,0.19,0.012,PB.head,o.hatCol,20);cyl(0,1.725,0.005,0.126,0.126,0.02,PB.head,'#6a5a3a',20,true);}
  if(o.hat==='fedora'){cyl(0,1.765,0,0.086,0.1,0.11,PB.head,o.hatCol,16);cyl(0,1.712,0,0.172,0.172,0.012,PB.head,o.hatCol,20);cyl(0,1.73,0,0.102,0.102,0.025,PB.head,'#2a1c12',16,true);}
  if(o.hat==='band')cyl(0,1.7,0,0.1,0.1,0.026,PB.head,o.hatCol,16,true);
  KD=2;
  // sacs, outils
  if(o.pack==='backpack'){box(0,1.24,-0.17,0.3,0.38,0.15,PB.chest,'#5a4a30');cyl(0,1.46,-0.17,0.07,0.07,0.34,PB.chest,'#6e5c3c',10,false,0,Math.PI/2);}
  if(o.pack==='basket'){cyl(0,1.17,-0.215,0.2,0.145,0.42,PB.chest,'#8a6a34',14);cyl(0,1.375,-0.215,0.205,0.205,0.03,PB.chest,'#5e4620',14,true);}
  if(o.pack==='quiver'){cyl(0.07,1.3,-0.13,0.04,0.035,0.6,PB.chest,'#6a4a28',10,false,0,-0.35);for(let k=0;k<4;k++)cyl(0.16+k*0.012,1.62,-0.13+k*0.01,0.004,0.004,0.12,PB.chest,'#d8d0b8',4,false,0,-0.35);}
  const hR=[-0.24*w,0.865,0.03],hL=[0.24*w,0.865,0.03];
  if(o.tool==='spear'){cyl(hR[0],hR[1]+0.25,hR[2],0.011,0.013,2.1,PB.handR,'#6b4a2a',6);cyl(hR[0],hR[1]+1.37,hR[2],0.0,0.022,0.16,PB.handR,'#b8b2a0',6);}
  if(o.tool==='bow'){for(let k=0;k<5;k++){const a0=(k/5-0.5)*1.5,a1=((k+1)/5-0.5)*1.5,R=0.75;
      seg([hL[0],hL[1]+Math.sin(a0)*R,hL[2]+0.05-Math.cos(a0)*R*0.3+R*0.3],[hL[0],hL[1]+Math.sin(a1)*R,hL[2]+0.05-Math.cos(a1)*R*0.3+R*0.3],0.011,0.011,PB.handL,'#5a3a1e',5,false);}
    seg([hL[0],hL[1]-0.51,hL[2]+0.095],[hL[0],hL[1]+0.51,hL[2]+0.095],0.002,0.002,PB.handL,'#d8d0b0',3,false);}
  if(o.tool==='machete')box(hR[0],hR[1]-0.22,hR[2]+0.01,0.012,0.36,0.05,PB.handR,'#9a9890');
  if(o.tool==='pole'){cyl(hR[0],hR[1]+0.6,hR[2],0.014,0.014,2.4,PB.handR,'#7a5a32',6);box(hR[0],hR[1]+1.82,hR[2]+0.05,0.01,0.12,0.06,PB.handR,'#a8a698',0.6);}
  if(o.tool==='binoc'){cyl(0.032,1.668,0.17,0.022,0.022,0.11,PB.head,'#1e1a16',10,false,Math.PI/2);cyl(-0.032,1.668,0.17,0.022,0.022,0.11,PB.head,'#1e1a16',10,false,Math.PI/2);}
  if(o.tool==='map')box(0,1.2,0.34,0.42,0.3,0.006,PB.chest,'#d8ccaa',-0.75);
  if(o.tool==='pod')ell(hR[0],hR[1]-0.06,hR[2]+0.04,0.06,0.11,0.06,PB.handR,'#b5741e',10);
  const g=mergeGeometries(parts);g.computeBoundingSphere();return g;
}
/* matériau commun : vêtements tissés, peau légèrement satinée */
let PPL_MAT=null;
function pplMat(){
  if(PPL_MAT)return PPL_MAT;
  PPL_MAT=patch(new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.8,envMapIntensity:0.5,side:THREE.DoubleSide}),{
    // aK : x nature (0 peau · 1 tissu · 2 cuir/bois/métal · 3 cheveux) · y prise au vent · z ombre des plis · w motif + graine
    vHead:`attribute vec4 aK;varying vec4 vK;varying vec3 vRest;uniform float uTime;uniform vec2 uWind;`,
    vBegin:`vK=aK;vRest=position;
      if(aK.y>0.0){float rvPh=dot(position.xz,vec2(9.0,7.0))+position.y*5.0+aK.w*40.0;float rvGu=0.55+0.45*sin(uTime*0.6+aK.w*20.0);
        transformed.xz+=(uWind*0.03*rvGu+vec2(sin(uTime*2.3+rvPh),cos(uTime*1.9+rvPh*1.3))*0.011)*aK.y;}`,
    fHead:`varying vec4 vK;varying vec3 vRest;`,
    fDiscard:GLSL_TREVEAL,
    // tout est calculé dans le repère du corps au repos (vRest) : la trame reste cousue au vêtement quand le personnage marche
    fColor:`float rvKd=floor(vK.x+0.5),rvSd=fract(vK.w),rvPat=floor(vK.w+0.001);
      float rvFw=1.0-smoothstep(0.2,0.8,fwidth(vRest.y)*320.0);     // les fils s'effacent avec la distance (pas de moiré)
      float rvWv=sin(vRest.y*320.0)*0.5+sin((vRest.x+vRest.z*0.8)*300.0)*0.5;
      if(rvKd==1.0){
        diffuseColor.rgb*=1.0+0.11*rvWv*rvFw;
        diffuseColor.rgb*=mix(0.84,1.1,rvNoise(vRest*vec3(34.0,9.0,34.0)+rvSd*9.0))*mix(0.9,1.06,rvNoise(vRest*5.0+rvSd*3.0));   // teinture inégale, fils irréguliers
        if(rvPat>=1.0){float rvS1=smoothstep(0.40,0.46,abs(fract(vRest.y*11.0+rvSd)-0.5)),rvS2=smoothstep(0.46,0.49,abs(fract(vRest.y*11.0+rvSd+0.23)-0.5));
          diffuseColor.rgb*=mix(1.0,0.66,rvS1*0.85);diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*1.5+0.04,rvS2*0.6);}   // rayures tissées
      }else if(rvKd==0.0){diffuseColor.rgb*=mix(0.93,1.05,rvNoise(vRest*26.0));}
      else{diffuseColor.rgb*=mix(0.86,1.08,rvNoise(vRest*60.0))*mix(0.92,1.04,rvNoise(vRest*7.0));}
      diffuseColor.rgb*=mix(0.5,1.0,vK.z);`,
    fRough:`roughnessFactor=rvKd==1.0?0.95:(rvKd==0.0?0.6:(rvKd==3.0?0.5:0.72));`,
    fNormal:`if(rvKd==1.0){float rvHb=rvFw*0.0007*rvWv*2.0+0.0035*rvNoise(vRest*vec3(46.0,12.0,46.0)+rvSd*5.0);normal=rvPerturb(-vViewPosition,normal,rvHb,1.0);}`,
    // duvet du tissu (et léger liseré de la peau) à contre-jour
    fEmissive:`{float rvFr=pow(1.0-abs(dot(normalize(vViewPosition),normal)),3.0);
      if(rvKd==1.0)totalEmissiveRadiance+=diffuseColor.rgb*rvFr*0.22*uLum;else if(rvKd==0.0)totalEmissiveRadiance+=diffuseColor.rgb*vec3(1.0,0.5,0.35)*rvFr*0.1*uLum;}
      `+GLSL_TREVEAL_E,
  },'ppl');
  return PPL_MAT;
}
function pplMake(o,grp){
  const geo=pplBody(o),mat=pplMat();
  const bones=PPL_BONES.map(()=>new THREE.Bone());
  PPL_BONES.forEach(([n,par,h],i)=>{const p=new THREE.Vector3(...h);if(par>=0){bones[par].add(bones[i]);p.sub(new THREE.Vector3(...PPL_BONES[par][2]));}bones[i].position.copy(p);});
  const m=new THREE.SkinnedMesh(geo,mat);m.add(bones[0]);m.updateMatrixWorld(true);m.bind(new THREE.Skeleton(bones));
  m.castShadow=true;m.receiveShadow=true;m.frustumCulled=false;m.layers.enable(1);
  const root=new THREE.Group();const k=(o.h||1.72)/1.75;m.scale.setScalar(k);root.add(m);grp.add(root);
  const B={};PPL_BONES.forEach(([n],i)=>B[n]=bones[i]);
  return {root,mesh:m,B,h:k,base:bones[0].position.clone()};
}
/* ── poses ── */
function pplReset(c){for(const n in c.B)c.B[n].rotation.set(0,0,0);c.B.hips.position.copy(c.base);
  c.B.armL.rotation.z=0.06;c.B.armR.rotation.z=-0.06;c.B.foreL.rotation.x=-0.12;c.B.foreR.rotation.x=-0.12;}
function pplWalk(c,ph,o={}){const B=c.B,cr=o.crouch||0,A=o.amp||0.42;
  for(const [s,q] of [['L',ph],['R',ph+Math.PI]]){B['leg'+s].rotation.x=-A*Math.sin(q)-cr*0.35;B['shin'+s].rotation.x=0.08+cr*0.5+0.62*Math.pow(Math.max(0,Math.cos(q)),1.3);B['foot'+s].rotation.x=-0.12*Math.sin(q)+cr*0.1;}
  B.hips.position.y=c.base.y-0.012-cr*0.09+0.022*Math.cos(2*ph);B.hips.rotation.y=0.08*Math.sin(ph);B.spine.rotation.y=-0.1*Math.sin(ph);
  B.spine.rotation.x=0.04+cr*0.22;B.head.rotation.x=-cr*0.12;
  if(!o.armsBusy){B.armL.rotation.x=0.34*Math.sin(ph);B.armR.rotation.x=-0.34*Math.sin(ph);B.foreL.rotation.x=-0.25-0.12*Math.max(0,-Math.sin(ph));B.foreR.rotation.x=-0.25-0.12*Math.max(0,Math.sin(ph));}
}
function pplSit(c,seat){const B=c.B;B.hips.position.y=seat;B.legL.rotation.x=B.legR.rotation.x=-1.48;B.shinL.rotation.x=B.shinR.rotation.x=1.42;B.legL.rotation.z=0.08;B.legR.rotation.z=-0.08;B.footL.rotation.x=B.footR.rotation.x=0.1;}

function buildPeople(){
  const grp=new THREE.Group();scene.add(grp);
  const rr=mulberry32(5150),V=(x,y,z)=>new THREE.Vector3(x,y,z);
  const SKIN_IND=['#7a4a2c','#6a3f25','#8a5634','#5c3820','#7f5232'],SKIN_EXP=['#e0b494','#c99a74','#b07a56','#d8a888'];
  const pick=a=>a[Math.floor(rr()*a.length)];
  const people=[];
  const G=y=>Math.max(groundH(y.x,y.z),JF.water);
  const faceTo=(c,from,to)=>{c.root.rotation.y=Math.atan2(to.x-from.x,to.z-from.z);};

  /* ── 1. cueilleurs de cacao (rive droite) ── */
  const cac=JF.trees.filter(t=>t.kind==='cacao');
  const CC=JF.cacao;
  const cloth=['#9a3a24','#b8862e','#5d6e3a','#7a2e3a','#c9b48a','#3e5a6a'];
  for(let i=0;i<Math.min(3,cac.length);i++){const t=cac[i];
    const c=pplMake({skin:pick(SKIN_IND),shirt:pick(cloth),sleeve:'none',tunic:true,legs:rr()<0.5?'shorts':'bare',pants:'#5a4630',skirt:i===1?pick(cloth):null,hair:'#120c08',hairLong:i===1,hat:rr()<0.5?'band':null,hatCol:pick(cloth),
      pack:'basket',tool:i===2?'pole':'machete',h:1.58+rr()*0.12},grp);
    const a=rr()*6.28,p=V(t.x+Math.cos(a)*0.75,0,t.z+Math.sin(a)*0.75);p.y=G(p);c.root.position.copy(p);faceTo(c,p,t);
    people.push({c,kind:'harvest',ph:rr()*10,yaw0:c.root.rotation.y});}
  // une cueilleuse assise sur une natte, qui ouvre les cabosses
  const mat=new THREE.Group();grp.add(mat);
  {const p=V(CC.x,0,CC.z);for(let k=0;k<30;k++){const q=V(CC.x+(rr()-0.5)*3,0,CC.z+(rr()-0.5)*3);if(JF.trees.every(t=>t.kind!=='cacao'||Math.hypot(t.x-q.x,t.z-q.z)>1.6)){p.copy(q);break;}}p.y=G(p)+0.02;
   const c=pplMake({skin:pick(SKIN_IND),shirt:'#c9a34a',sleeve:'none',tunic:true,skirt:'#7a2e3a',legs:'bare',hair:'#100a06',hairLong:true,tool:'pod',h:1.56},grp);
   c.root.position.copy(p);c.root.rotation.y=Math.atan2(JF.cam.x-p.x,JF.cam.z-p.z)+0.6;
   people.push({c,kind:'sitpods',ph:rr()*10});
   // natte, tas de cabosses, paniers
   const mg=new THREE.Mesh(new THREE.BoxGeometry(1.6,0.02,1.1),pplStaticMat('#9c8048',1));mg.position.copy(p);mg.rotation.y=c.root.rotation.y;mg.receiveShadow=true;mat.add(mg);
   const podG=new THREE.SphereGeometry(1,10,8);podG.scale(0.06,0.06,0.11);
   const pods=new THREE.InstancedMesh(podG,pplStaticMat('#ffffff',0),26);const m4=new THREE.Matrix4(),qq=new THREE.Quaternion(),e=new THREE.Euler();
   const fw=V(Math.sin(c.root.rotation.y),0,Math.cos(c.root.rotation.y));
   const PC=[new THREE.Color('#b5741e'),new THREE.Color('#c8a020'),new THREE.Color('#7a2a1e'),new THREE.Color('#8a3a12')];
   for(let k=0;k<26;k++){const a=rr()*6.28,d=Math.sqrt(rr())*0.32;const lay=k<16?0:k<23?1:2;
     const q=p.clone().addScaledVector(fw,0.5).add(V(Math.cos(a)*d*(1-lay*0.3),0.055+lay*0.09,Math.sin(a)*d*(1-lay*0.3)));
     m4.compose(q,qq.setFromEuler(e.set(rr()*0.6,rr()*6.28,rr()*0.6)),V(1,1,1));pods.setMatrixAt(k,m4);pods.setColorAt(k,PC[Math.floor(rr()*4)]);}
   pods.castShadow=true;pods.receiveShadow=true;mat.add(pods);
   for(let k=0;k<2;k++){const b=new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.15,0.4,14,1,false),pplStaticMat('#8a6a34',1));const s=k?1:-1;
     b.position.copy(p).add(V(Math.cos(c.root.rotation.y)*0.7*s,0.2,-Math.sin(c.root.rotation.y)*0.7*s));b.castShadow=true;b.receiveShadow=true;mat.add(b);}}

  /* ── 2. les chasseurs, en file indienne sur le sentier de la rive gauche ── */
  const HP=JF.huntPath.map(p=>p.clone());
  const hpL=[0];for(let i=1;i<HP.length;i++)hpL.push(hpL[i-1]+HP[i].distanceTo(HP[i-1]));const HL=hpL[hpL.length-1];
  const hpAt=(s,out)=>{s=Math.max(0,Math.min(HL-1e-3,s));let i=1;while(hpL[i]<s)i++;const t=(s-hpL[i-1])/(hpL[i]-hpL[i-1]);out.p.copy(HP[i-1]).lerp(HP[i],t);out.p.y=groundH(out.p.x,out.p.z);out.yaw=Math.atan2(HP[i].x-HP[i-1].x,HP[i].z-HP[i-1].z);return out;};
  const hunters=[];
  for(let i=0;i<5;i++){const c=pplMake({skin:pick(SKIN_IND),sleeve:'none',bareBelly:true,shirt:null,legs:'shorts',pants:'#4a3420',sash:'#8a2a1a',hair:'#0e0906',hat:'band',hatCol:i%2?'#b8302a':'#d8b040',armband:'#c8a040',
      pack:i===1||i===3?'quiver':null,tool:i===1||i===3?'bow':'spear',h:1.6+rr()*0.12,w:0.96},grp);
    hunters.push({c,kind:'hunt',i,ph:rr()*6});people.push(hunters[i]);}

  /* ── 3. les explorateurs égarés : campement sur la rive gauche ── */
  const CP=JF.camp.clone();CP.y=G(CP);
  const toCam=Math.atan2(JF.cam.x-CP.x,JF.cam.z-CP.z);
  const exp=[];
  const khaki=['#a89468','#9a8a5e','#b4a27a'],trous=['#6e6448','#5e5a40','#7a6a4a'];
  const mkExp=(o)=>pplMake(Object.assign({skin:pick(SKIN_EXP),shirt:pick(khaki),sleeve:'short',legs:'long',pants:pick(trous),boot:'#3e2a1a',belt:'#3a2816',hair:pick(['#3a2a1a','#6a4a2a','#1a1410','#8a6a42']),
    hat:'pith',hatCol:'#d8ccae'},o),grp);
  // le feu de camp, la tente, des caisses
  const camp=new THREE.Group();camp.position.copy(CP);camp.rotation.y=toCam;grp.add(camp);
  const loc=(x,z)=>{const p=V(x,0,z).applyAxisAngle(V(0,1,0),toCam).add(CP);p.y=G(p);return p;};
  {const wood=pplStaticMat('#5a3e24',1),canvas=pplStaticMat('#b9a77d',1),stone=pplStaticMat('#6a6862',1);
   const fire=V(0.3,0,1.1);
   for(let k=0;k<9;k++){const a=k/9*6.28;const s=new THREE.Mesh(new THREE.DodecahedronGeometry(0.11,0),stone);s.position.set(fire.x+Math.cos(a)*0.42,0.05,fire.z+Math.sin(a)*0.42);s.rotation.set(rr()*3,rr()*3,0);s.castShadow=true;camp.add(s);}
   for(let k=0;k<4;k++){const l=new THREE.Mesh(new THREE.CylinderGeometry(0.045,0.05,0.75,7),wood);l.position.set(fire.x,0.12,fire.z);l.rotation.set(Math.PI/2-0.35,k*0.8,0);l.castShadow=true;camp.add(l);}
   // trépied et marmite
   for(let k=0;k<3;k++){const a=k/3*6.28;const foot=V(fire.x+Math.cos(a)*0.42,0,fire.z+Math.sin(a)*0.42),apex=V(fire.x,1.2,fire.z),d=apex.clone().sub(foot);
     const l=new THREE.Mesh(new THREE.CylinderGeometry(0.018,0.018,d.length(),5),wood);l.quaternion.setFromUnitVectors(V(0,1,0),d.clone().normalize());l.position.copy(foot).addScaledVector(d,0.5);camp.add(l);}
   const pot=new THREE.Mesh(new THREE.SphereGeometry(0.15,12,8,0,6.28,0.3,2.6),pplStaticMat('#24221e',1));pot.position.set(fire.x,0.55,fire.z);camp.add(pot);
   // tente (toile en A)
   const tg=new THREE.BufferGeometry();const W=1.1,Hh=1.35,L=2.2;
   tg.setAttribute('position',new THREE.Float32BufferAttribute([-W,0,-L/2, 0,Hh,-L/2, 0,Hh,L/2, -W,0,-L/2, 0,Hh,L/2, -W,0,L/2, W,0,-L/2, W,0,L/2, 0,Hh,L/2, W,0,-L/2, 0,Hh,L/2, 0,Hh,-L/2, -W,0,-L/2, W,0,-L/2, 0,Hh,-L/2],3));tg.computeVertexNormals();
   const tent=new THREE.Mesh(tg,pplStaticMat('#a8966c',1,true));tent.position.set(-2.1,0,-0.4);tent.rotation.y=0.5;tent.castShadow=true;tent.receiveShadow=true;camp.add(tent);
   const crate=new THREE.Mesh(new THREE.BoxGeometry(0.6,0.42,0.42),wood);crate.position.set(1.4,0.21,-0.3);crate.rotation.y=0.3;crate.castShadow=true;camp.add(crate);
   const crate2=crate.clone();crate2.scale.set(0.8,0.8,0.8);crate2.position.set(1.45,0.59,-0.28);crate2.rotation.y=0.6;camp.add(crate2);
   const logS=new THREE.Mesh(new THREE.CylinderGeometry(0.17,0.19,1.6,10),wood);logS.rotation.set(0,0,Math.PI/2);logS.position.set(0.25,0.15,1.95);logS.castShadow=true;camp.add(logS);
   camp.traverse(o=>{if(o.isMesh){o.receiveShadow=true;o.layers.enable(1);}});
   camp.userData.fire=fire;}
  // flammes et fumée
  const fireW=camp.localToWorld(camp.userData.fire.clone());
  const flameMat=new THREE.ShaderMaterial({uniforms:{uTime:U.uTime,uLantern:U.uLantern,uTerrainReveal:U.uTerrainReveal},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
    vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`uniform float uTime;uniform float uLantern;varying vec2 vUv;
      float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
      void main(){vec2 p=vUv;float x=abs(p.x-0.5)*2.0;
        float t=n(vec2(p.x*5.0,p.y*3.0-uTime*3.2))*0.6+n(vec2(p.x*11.0,p.y*7.0-uTime*5.0))*0.4;
        float sh=1.0-smoothstep(0.0,1.0,x/(1.0-p.y*0.85)+p.y*0.25);float f=smoothstep(0.25,0.75,sh*(0.55+t*0.75)-p.y*0.35);
        vec3 c=mix(vec3(1.0,0.35,0.05),vec3(1.0,0.85,0.45),f);gl_FragColor=vec4(c*f*(0.9+uLantern*1.6),1.0);}`});
  const flames=new THREE.Group();flames.position.copy(fireW).add(V(0,0.08,0));grp.add(flames);
  for(let k=0;k<3;k++){const m=new THREE.Mesh(new THREE.PlaneGeometry(0.55,0.8),flameMat);m.position.y=0.38;m.rotation.y=k*Math.PI/3;flames.add(m);}
  const NS=26,smG=new THREE.BufferGeometry();const sp=new Float32Array(NS*3),sd=new Float32Array(NS);for(let i=0;i<NS;i++){sd[i]=i/NS;}
  smG.setAttribute('position',new THREE.BufferAttribute(sp,3));smG.setAttribute('aSeed',new THREE.BufferAttribute(sd,1));
  const smMat=new THREE.ShaderMaterial({uniforms:{uTime:U.uTime,uWind:U.uWind,uScale:{value:VH*renderer.getPixelRatio()},uLum:U.uLum,uFogColor:U.uFogColor},transparent:true,depthWrite:false,
    vertexShader:`attribute float aSeed;uniform float uTime;uniform vec2 uWind;uniform float uScale;varying float vA;
      void main(){float t=fract(uTime*0.07+aSeed);vec3 p=position+vec3(uWind.x*t*4.0+sin(aSeed*40.0+uTime*0.6)*0.3*t,t*7.0,uWind.y*t*4.0+cos(aSeed*31.0)*0.3*t);
        vec4 mv=modelViewMatrix*vec4(p,1.0);gl_Position=projectionMatrix*mv;gl_PointSize=uScale*(0.5+t*2.6)/max(-mv.z,0.5);vA=smoothstep(0.0,0.12,t)*(1.0-t);}`,
    fragmentShader:`varying float vA;uniform float uLum;uniform vec3 uFogColor;void main(){vec2 q=gl_PointCoord*2.0-1.0;float d=dot(q,q);if(d>1.0)discard;float a=(1.0-d)*(1.0-d)*vA*0.32;
      gl_FragColor=vec4(mix(vec3(0.62,0.62,0.6),uFogColor,0.3)*(0.4+0.6*uLum),a);}`});
  const smoke=new THREE.Points(smG,smMat);smoke.position.copy(fireW).add(V(0,0.5,0));smoke.frustumCulled=false;grp.add(smoke);
  const fireL=new THREE.PointLight(new THREE.Color('#ff9a4a'),0,16,1.6);fireL.position.copy(fireW).add(V(0,0.7,0));grp.add(fireL);
  // trois explorateurs : l'un assis au feu, l'autre penché sur sa carte, le dernier scrute la jungle à la longue-vue
  {const c=mkExp({tool:null,beard:'#4a3420',h:1.78});const p=loc(0.25,1.95+0.0);p.y=G(p);c.root.position.copy(p);c.root.rotation.y=toCam+Math.PI;exp.push({c,kind:'sitfire'});
   const c2=mkExp({tool:'map',hat:'fedora',hatCol:'#6a5034',pack:'backpack',h:1.74});const p2=loc(-1.7,0.5);c2.root.position.copy(p2);c2.root.rotation.y=toCam+0.5;exp.push({c:c2,kind:'map'});
   // le dernier, au bord de l'eau, scrute le temple à la longue-vue
   const c3=mkExp({tool:'binoc',pack:'backpack',h:1.8,shirt:'#c4b490'});const p3=loc(2.3,3.0);c3.root.position.copy(p3);c3.root.rotation.y=Math.atan2(-p3.x,-p3.z)-0.5;exp.push({c:c3,kind:'binoc'});}
  exp.forEach(e=>{e.ph=rr()*10;e.yaw0=e.c.root.rotation.y;people.push(e);});

  /* ── 4. la chaloupe : quatre rameurs et un barreur ── */
  const boat=new THREE.Group();grp.add(boat);
  {const BL=6.6;const NS2=18,NR=12,pos=[],idx=[],col=[];
   const hw=s=>0.86*Math.pow(Math.max(0,Math.sin(Math.PI*(0.14+0.86*s))),0.7)+0.02,sheer=s=>0.42+0.55*Math.pow(s-0.42,2),keel=0.38;
   for(let i=0;i<=NS2;i++){const s=i/NS2,x=(s-0.5)*BL,W=hw(s),Ys=sheer(s);
     for(let j=0;j<=NR;j++){const th=(j/NR-0.5)*Math.PI;const z=W*Math.sin(th),y=Ys-(Ys+keel)*Math.pow(Math.cos(th),0.75);pos.push(x,y,z);
       const pl=Math.abs(Math.sin(th*4.5))>0.92?0.7:1.0;col.push(0.36*pl,0.24*pl,0.14*pl);}}
   for(let i=0;i<NS2;i++)for(let j=0;j<NR;j++){const a=i*(NR+1)+j,b=a+1,c=a+NR+1,d=c+1;idx.push(a,c,b,b,c,d);}
   const hg=new THREE.BufferGeometry();hg.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));hg.setAttribute('color',new THREE.Float32BufferAttribute(col,3));hg.setIndex(idx);hg.computeVertexNormals();
   const hullMat=patch(new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.7,side:THREE.DoubleSide,envMapIntensity:0.5}),{
     vHead:`varying vec3 vBO;`,vMain:`vBO=position;`,fHead:`varying vec3 vBO;`,fDiscard:GLSL_TREVEAL,
     fColor:`float pk=smoothstep(0.05,0.0,abs(fract(vBO.y*6.0)-0.5)-0.44);diffuseColor.rgb*=mix(1.0,0.55,pk)*mix(0.8,1.15,rvNoise(vec3(vBO.x*1.5,vBO.y*30.0,vBO.z*30.0)));
       diffuseColor.rgb*=mix(1.0,0.6,smoothstep(0.2,-0.05,vRvW.y-${JF.water.toFixed(2)}));`,fEmissive:GLSL_TREVEAL_E},'hull');
   const hull=new THREE.Mesh(hg,hullMat);boat.add(hull);
   const wood=pplStaticMat('#5e432a',1);
   const floor=new THREE.Mesh(new THREE.BoxGeometry(BL*0.82,0.04,1.1),wood);floor.position.y=0.05;boat.add(floor);
   const rail=pplStaticMat('#3e2c1a',1);
   for(const s of [1,-1]){const rp=[];for(let i=0;i<=NS2;i++){const t=i/NS2;rp.push(V((t-0.5)*BL,sheer(t)+0.02,s*hw(t)));}const rg=tubeGeo(rp,rp.map(()=>0.035),5,1);rg.deleteAttribute('aBk');boat.add(new THREE.Mesh(rg,rail));}
   boat.userData.seats=[];
   for(let k=0;k<5;k++){const x=k<4?-1.45+k*1.05:-2.55;const t=x/BL+0.5;const th=new THREE.Mesh(new THREE.BoxGeometry(0.26,0.05,hw(t)*2-0.05),wood);th.position.set(x,0.38,0);boat.add(th);boat.userData.seats.push({x,w:hw(t),y:sheer(t)});}
   // lanterne de proue (allumée la nuit)
   const lan=new THREE.Mesh(new THREE.SphereGeometry(0.07,10,8),new THREE.MeshStandardMaterial({color:'#2a2018',emissive:new THREE.Color('#ffb060'),emissiveIntensity:0}));lan.position.set(BL*0.47,sheer(0.97)+0.18,0);boat.add(lan);boat.userData.lan=lan;
   boat.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.layers.enable(1);}});}
  // avirons : pivot sur le plat-bord
  const oarG=(()=>{const a=new THREE.CylinderGeometry(0.022,0.026,3.1,6);a.rotateX(Math.PI/2);a.translate(0,0,0.95);const b=new THREE.BoxGeometry(0.03,0.16,0.55);b.translate(0,0,2.25);a.deleteAttribute('uv');b.deleteAttribute('uv');return mergeGeometries([a.toNonIndexed(),b.toNonIndexed()]);})();
  const oars=[];const seats=boat.userData.seats;
  for(let k=0;k<4;k++){const s=k%2?1:-1,st=seats[k];const piv=new THREE.Group();piv.position.set(st.x-0.33,st.y+0.04,s*st.w);boat.add(piv);
    const m=new THREE.Mesh(oarG,pplStaticMat('#7a5a36',1));m.scale.z=s;m.castShadow=true;m.layers.enable(1);piv.add(m);oars.push({piv,s});}
  const rowers=[];
  for(let k=0;k<4;k++){const st=seats[k];const c=mkExp({hat:k%2?'fedora':'pith',hatCol:k%2?'#5e4630':'#d4c8a8',tool:null,h:1.72+rr()*0.08,shirt:pick(['#a89468','#c8bc9a','#8a7a58','#b8a070'])});
    boat.add(c.root);c.root.position.set(st.x,0.0,(k%2?-1:1)*0.12);c.root.rotation.y=-Math.PI/2;rowers.push({c,k});}
  const helm=mkExp({hat:'pith',hatCol:'#e0d6bc',beard:'#6a5a46',h:1.76});boat.add(helm.root);helm.root.position.set(seats[4].x,0,0);helm.root.rotation.y=Math.PI/2;
  // trajet : une boucle tranquille autour du temple, côté caméra
  const BR=27;let bth=JF.camAz+1.2,bphase=0;
  const boatSt={x:0,z:0,hd:0,v:0};

  /* ── animation ── */
  const tmp={p:new THREE.Vector3(),yaw:0};
  let hs=0;
  function update(dt,T){
    const L=U.uLantern.value;
    // feu de camp
    fireL.intensity=(0.6+L*9.0)*(0.85+0.1*Math.sin(T*9.1)+0.06*Math.sin(T*23.7));
    flames.children.forEach((m,k)=>{m.scale.set(1,0.9+0.12*Math.sin(T*7+k*2),1);});
    flames.rotation.y=Math.atan2(camera.position.x-flames.position.x,camera.position.z-flames.position.z);
    boat.userData.lan.material.emissiveIntensity=L*3.0;
    {const rv=U.uTerrainReveal.value,d=Math.hypot(flames.position.x,flames.position.z);flames.visible=smoke.visible=rv>d+2;}
    // cueilleurs
    people.forEach(P=>{const c=P.c;pplReset(c);const B=c.B,t=T+P.ph;
      if(P.kind==='harvest'){const cyc=t%9.0;
        if(cyc<5.5){// bras levés vers les cabosses, petits coups de lame
          const r=smooth(0,0.8,cyc)*(1-smooth(4.8,5.5,cyc)),chop=Math.max(0,Math.sin(t*5.0))*r;
          B.armR.rotation.x=-2.5*r-0.25*chop;B.armR.rotation.z=-0.1;B.foreR.rotation.x=-0.5*r+0.35*chop;
          B.armL.rotation.x=-2.2*r;B.armL.rotation.z=0.25*r;B.foreL.rotation.x=-0.7*r;
          B.head.rotation.x=-0.45*r;B.spine.rotation.x=-0.08*r;}
        else{// se penche, dépose la cabosse dans le panier d'à côté
          const r=smooth(5.5,6.4,cyc)*(1-smooth(8.2,9.0,cyc));B.spine.rotation.x=0.55*r;B.spine.rotation.y=0.6*r;B.head.rotation.x=0.2*r;
          B.armR.rotation.x=-0.7*r;B.foreR.rotation.x=-0.4*r;B.legL.rotation.x=B.legR.rotation.x=-0.25*r;B.shinL.rotation.x=B.shinR.rotation.x=0.45*r;B.hips.position.y=c.base.y-0.08*r;}
        c.root.rotation.y=P.yaw0+0.15*Math.sin(t*0.13);}
      else if(P.kind==='sitpods'){pplSit(c,0.24);B.legL.rotation.y=0.5;B.legR.rotation.y=-0.5;B.spine.rotation.x=0.35;B.head.rotation.x=0.35;
        const k=Math.max(0,Math.sin(t*2.2));B.armR.rotation.x=-0.9-0.5*k;B.foreR.rotation.x=-0.9+0.4*k;B.armL.rotation.x=-0.75;B.foreL.rotation.x=-1.1;B.armL.rotation.z=-0.15;B.armR.rotation.z=0.15;
        if(Math.sin(t*0.3)>0.85){B.head.rotation.x=-0.1;B.head.rotation.y=0.5*Math.sin(t*0.9);}}
      else if(P.kind==='sitfire'){pplSit(c,0.34);B.spine.rotation.x=0.25;B.armL.rotation.x=B.armR.rotation.x=-0.75;B.foreL.rotation.x=B.foreR.rotation.x=-0.65;B.armL.rotation.z=-0.2;B.armR.rotation.z=0.2;
        B.head.rotation.x=0.25+0.1*Math.sin(t*0.4);B.head.rotation.y=0.25*Math.sin(t*0.17);
        if((t%14)<2.5){B.armR.rotation.x=-1.25;B.foreR.rotation.x=-1.5;B.head.rotation.x=0.0;}}   // il boit une gorgée
      else if(P.kind==='map'){B.armL.rotation.x=B.armR.rotation.x=-0.55;B.foreL.rotation.x=B.foreR.rotation.x=-1.05;B.armL.rotation.z=-0.12;B.armR.rotation.z=0.12;
        const look=(t%11)>8.5;B.head.rotation.x=look?-0.05:0.5;B.head.rotation.y=look?0.7*Math.sin(t*0.8):0.0;B.spine.rotation.x=look?0.0:0.12;
        B.legL.rotation.z=0.06;B.legR.rotation.z=-0.06;c.root.rotation.y=P.yaw0+0.25*Math.sin(t*0.07);}
      else if(P.kind==='binoc'){B.armL.rotation.x=B.armR.rotation.x=-1.95;B.foreL.rotation.x=B.foreR.rotation.x=-1.25;B.armL.rotation.z=-0.42;B.armR.rotation.z=0.42;B.foreL.rotation.z=-0.2;B.foreR.rotation.z=0.2;
        B.head.rotation.x=-0.08;c.root.rotation.y=P.yaw0+0.9*Math.sin(t*0.11);B.legL.rotation.z=0.07;B.legR.rotation.z=-0.07;}
    });
    // chasseurs : marche feutrée, en file ; une halte de temps en temps (le premier écoute, la lance levée)
    const halt=Math.max(0,Math.sin(T*0.05))>0.93;
    if(!halt)hs+=dt*0.85;
    const S0=(hs%(HL+12));
    hunters.forEach(H=>{const c=H.c,s=S0-H.i*1.9;pplReset(c);
      if(s<0.5||s>HL-0.5){c.root.visible=false;return;}c.root.visible=true;
      hpAt(s,tmp);c.root.position.copy(tmp.p);c.root.rotation.y=tmp.yaw;
      const ph=hs*4.0+H.i*0.7;
      if(halt){c.B.spine.rotation.x=0.25;c.B.legL.rotation.x=-0.35;c.B.shinL.rotation.x=0.6;c.B.legR.rotation.x=0.15;c.B.shinR.rotation.x=0.4;c.B.hips.position.y=c.base.y-0.1;c.B.head.rotation.y=0.6*Math.sin(T*0.7+H.i);}
      else pplWalk(c,ph,{crouch:0.32,amp:0.38,armsBusy:true});
      // lance ou arc tenus prêts
      c.B.armR.rotation.x=-0.45;c.B.foreR.rotation.x=-1.05;c.B.armR.rotation.z=0.12;c.B.armL.rotation.x=halt&&H.i===0?-1.4:-0.2+0.25*Math.sin(ph);c.B.foreL.rotation.x=-0.5;
      if(H.i===1||H.i===3){c.B.armL.rotation.x=-0.5;c.B.foreL.rotation.x=-0.9;c.B.armR.rotation.x=0.2*Math.sin(ph);c.B.foreR.rotation.x=-0.3;}
    });
    // chaloupe : coups de rame, avancée pulsée, sillage
    bphase+=dt/3.0;const ps=bphase%1,drive=ps<0.42;const cp=drive?1-ps/0.42:(ps-0.42)/0.58;   // cp : 1 = attaque, 0 = dégagé
    const v=0.75+0.65*(drive?Math.sin(ps/0.42*Math.PI):0);bth+=v*dt/BR;
    const bx=Math.sin(bth)*BR,bz=Math.cos(bth)*BR;
    // l'étrave est vers +x local : un lacet de bth la fait suivre la tangente de la boucle
    boat.position.set(bx,JF.water-0.02+0.015*Math.sin(T*1.3),bz);boat.rotation.set(0.01*Math.sin(T*0.9),bth,0.012*Math.sin(T*1.1));
    const fx=Math.cos(bth),fz=-Math.sin(bth);
    if(REFL.mU&&REFL.mU.uBoat)REFL.mU.uBoat.value.set(bx,bz,Math.atan2(fz,fx),Math.min(1,v/1.1));
    oars.forEach(o=>{const sw=lerp(-0.5,0.55,cp);o.piv.rotation.set(0,o.s*sw,0);o.piv.rotateX(o.s*(drive?0.32:0.12));});
    rowers.forEach(R=>{const c=R.c,B=c.B;pplReset(c);pplSit(c,0.42);
      B.spine.rotation.x=lerp(-0.25,0.45,cp);B.head.rotation.x=lerp(0.2,-0.3,cp);
      B.armL.rotation.x=B.armR.rotation.x=lerp(-0.6,-1.35,cp);B.foreL.rotation.x=B.foreR.rotation.x=lerp(-1.25,-0.15,cp);B.armL.rotation.z=-0.1;B.armR.rotation.z=0.1;});
    {const c=helm,B=c.B;pplReset(c);pplSit(c,0.42);B.armR.rotation.x=-0.6;B.foreR.rotation.x=-0.6;B.armR.rotation.z=0.5;B.head.rotation.y=0.5*Math.sin(T*0.2);B.spine.rotation.x=0.05;}
  }
  return {grp,update,fireL,boat,hunters,people};
}
/* matériau simple des accessoires (bois, toile, pierre) */
const PPL_SMATS={};
function pplStaticMat(hex,wood,ds){const k=hex+(wood?'w':'')+(ds?'d':'');if(PPL_SMATS[k])return PPL_SMATS[k];
  const m=patch(new THREE.MeshStandardMaterial({color:new THREE.Color(hex),roughness:0.85,side:ds?THREE.DoubleSide:THREE.FrontSide,envMapIntensity:0.5}),{
    fDiscard:GLSL_TREVEAL,fColor:wood?`diffuseColor.rgb*=mix(0.78,1.12,rvNoise(vRvW*vec3(9.0,25.0,9.0)));`:``,fEmissive:GLSL_TREVEAL_E},'pplS'+(wood?'w':'')+(ds?'d':''));
  PPL_SMATS[k]=m;return m;}

/* ═══ 30c · Les animaux de la jungle ═══
   Carpes koï sous la surface, poissons qui sautent, aras qui traversent le ciel, aigrettes et héron posés
   sur la rive, toucans perchés, martin-pêcheur qui guette depuis sa branche morte, singes
   sur les branches, papillons dans la lumière et libellules au ras de l'eau.
   Tout est animé à la main (aucun fichier externe) ; les ondes qu'ils font naître passent par l'eau. */

/* ── rig générique : morceaux lisses rattachés à des os (même principe que les personnages) ── */
function rigGeo(names){
  const B={};names.forEach((n,i)=>B[n]=i);
  const parts=[],V=(x,y,z)=>new THREE.Vector3(x,y,z),C=c=>c instanceof THREE.Color?c:new THREE.Color(c);
  const add=(g,bone,col)=>{if(g.attributes.uv)g.deleteAttribute('uv');const n=g.attributes.position.count,c=C(col),bi=typeof bone==='string'?B[bone]:bone;
    const ca=new Float32Array(n*3),si=new Uint16Array(n*4),sw=new Float32Array(n*4);
    for(let i=0;i<n;i++){ca[i*3]=c.r;ca[i*3+1]=c.g;ca[i*3+2]=c.b;si[i*4]=bi;sw[i*4]=1;}
    g.setAttribute('color',new THREE.BufferAttribute(ca,3));g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(si,4));g.setAttribute('skinWeight',new THREE.BufferAttribute(sw,4));parts.push(g);};
  return {B,
    ell(x,y,z,rx,ry,rz,bone,col,s=10,rot){const g=new THREE.SphereGeometry(1,s,Math.max(5,Math.round(s*0.7)));g.scale(rx,ry,rz);if(rot)g.rotateX(rot);g.translate(x,y,z);add(g,bone,col);},
    seg(a,b,r0,r1,bone,col,s=7,caps=true){const A=V(...a),Bv=V(...b),d=Bv.clone().sub(A),L=d.length();
      const g=new THREE.CylinderGeometry(r1,r0,L,s,1,true);g.translate(0,L/2,0);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0,1,0),d.normalize()));g.translate(A.x,A.y,A.z);add(g,bone,col);
      if(caps){const e=new THREE.SphereGeometry(r0,s,5);e.translate(A.x,A.y,A.z);add(e,bone,col);const e2=new THREE.SphereGeometry(Math.max(r1,0.002),s,5);e2.translate(Bv.x,Bv.y,Bv.z);add(e2,bone,col);}},
    cone(a,b,r0,bone,col,s=8){const A=V(...a),Bv=V(...b),d=Bv.clone().sub(A),L=d.length();const g=new THREE.ConeGeometry(r0,L,s,1);g.translate(0,L/2,0);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0,1,0),d.normalize()));g.translate(A.x,A.y,A.z);add(g,bone,col);},
    // aile (ou nageoire) plate : contour en éventail
    wing(pts,bone,col){const pos=[],idx=[];pts.forEach(p=>pos.push(p[0],p[1],p[2]));for(let i=1;i<pts.length-1;i++)idx.push(0,i,i+1);
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();add(g,bone,col);},
    geo(){return mergeGeometries(parts);}};
}
function rigMake(defs,build,mat,grp,scale=1){
  const A=rigGeo(defs.map(d=>d[0]));build(A);const geo=A.geo();geo.computeBoundingSphere();
  const bones=defs.map(()=>new THREE.Bone());
  defs.forEach(([n,par,h],i)=>{const p=new THREE.Vector3(...h);if(par>=0){bones[par].add(bones[i]);p.sub(new THREE.Vector3(...defs[par][2]));}bones[i].position.copy(p);});
  const m=new THREE.SkinnedMesh(geo,mat);m.add(bones[0]);m.updateMatrixWorld(true);m.bind(new THREE.Skeleton(bones));
  m.castShadow=true;m.receiveShadow=true;m.frustumCulled=false;m.layers.enable(1);m.scale.setScalar(scale);
  const root=new THREE.Group();root.add(m);grp.add(root);
  const B={},base={};defs.forEach(([n],i)=>{B[n]=bones[i];base[n]=bones[i].position.clone();});
  return {root,mesh:m,B,base,reset(){for(const n in B){B[n].rotation.set(0,0,0);B[n].position.copy(base[n]);B[n].scale.set(1,1,1);}}};
}

function buildWildlife(){
  const grp=new THREE.Group();scene.add(grp);
  const rr=mulberry32(4040),V=(x,y,z)=>new THREE.Vector3(x,y,z);
  const C=JF.cam,F=JF.f,R=JF.r,WY=JF.water;
  const animMat=patch(new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.72,side:THREE.DoubleSide,envMapIntensity:0.5}),{
    fDiscard:GLSL_TREVEAL,fColor:`diffuseColor.rgb*=mix(0.9,1.06,rvNoise(vRvW*40.0));`,fEmissive:GLSL_TREVEAL_E},'anim');
  const m4=new THREE.Matrix4(),q=new THREE.Quaternion(),e=new THREE.Euler(),S=new THREE.Vector3();
  const waterPts=[];   // points d'eau assez profonde, à l'écart du soubassement
  for(let g=0;g<6000&&waterPts.length<500;g++){const a=rr()*Math.PI*2,r=10+rr()*70;const x=Math.sin(a)*r,z=Math.cos(a)*r;
    if(shoreD(x,z)<-2.4&&Math.max(Math.abs(x),Math.abs(z))>10.5&&groundH(x,z)<WY-0.8)waterPts.push(V(x,0,z));}
  const chanPts=waterPts.filter(p=>{const d=p.clone().sub(C).dot(F);return d>8&&d<62;});

  /* ───────── carpes koï (+ deux poissons sauvages qui sautent) ───────── */
  const fishGeo=(()=>{const pos=[],idx=[],ab=[];const NS=14,NR=10;
    const prof=z=>{const t=(z+0.5);return [0.11*Math.pow(Math.sin(Math.PI*Math.min(1,t*0.92+0.04)),0.8)*(0.35+0.65*smooth(0.0,0.35,t)),0.14*Math.pow(Math.sin(Math.PI*Math.min(1,t*0.9+0.05)),0.85)*(0.3+0.7*smooth(0.0,0.4,t))];};
    for(let i=0;i<=NS;i++){const z=-0.42+i/NS*0.92;const [w,h]=prof(z);for(let j=0;j<=NR;j++){const a=j/NR*Math.PI*2;pos.push(Math.cos(a)*w,Math.sin(a)*h*(Math.sin(a)>0?1:0.85),z);ab.push(z,Math.sin(a)>0?1:0);}}
    for(let i=0;i<NS;i++)for(let j=0;j<NR;j++){const a=i*(NR+1)+j,b=a+1,c=a+NR+1,d=c+1;idx.push(a,c,b,b,c,d);}
    const body=new THREE.BufferGeometry();body.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));body.setAttribute('aFz',new THREE.Float32BufferAttribute(ab,2));body.setIndex(idx);body.computeVertexNormals();
    const fin=(pts,flag)=>{const p=[],ix=[],a2=[];pts.forEach(v=>{p.push(...v);a2.push(v[2],flag);});for(let i=1;i<pts.length-1;i++)ix.push(0,i,i+1);
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('aFz',new THREE.Float32BufferAttribute(a2,2));g.setIndex(ix);g.computeVertexNormals();return g;};
    const tail=fin([[0,0,-0.4],[0,0.15,-0.62],[0,0.06,-0.56],[0,0,-0.52],[0,-0.06,-0.56],[0,-0.15,-0.62]],2);
    const dors=fin([[0,0.12,0.1],[0,0.2,-0.02],[0,0.15,-0.2],[0,0.08,-0.28]],2);
    const pL=fin([[0.07,-0.06,0.24],[0.2,-0.1,0.16],[0.12,-0.08,0.1]],2),pR=fin([[-0.07,-0.06,0.24],[-0.2,-0.1,0.16],[-0.12,-0.08,0.1]],2);
    const g=mergeGeometries([body,tail,dors,pL,pR]);return g;})();
  const NK=MOBILE?8:14,NJ=2;
  const fishMat=patch(new THREE.MeshStandardMaterial({color:new THREE.Color('#ffffff'),roughness:0.35,side:THREE.DoubleSide,envMapIntensity:0.8}),{
    vHead:`uniform float uTime;attribute vec2 aFz;attribute vec4 aKo;varying vec3 vKP;varying vec4 vKo;varying vec2 vFz;`,
    vBegin:`{float z=aFz.x;float amp=0.07*aKo.y;float w=sin(uTime*(3.0+aKo.y*5.0)+aKo.x-z*7.0);
      transformed.x+=w*amp*pow(clamp(0.5-z,0.0,1.2),2.0);
      if(aFz.y>1.5&&abs(transformed.x)>0.05)transformed.y+=sin(uTime*4.0+aKo.x)*0.02;}`,
    vMain:`vKP=position;vKo=aKo;vFz=aFz;`,
    fHead:`varying vec3 vKP;varying vec4 vKo;varying vec2 vFz;`,
    fDiscard:GLSL_TREVEAL,
    fColor:`{float k=vKo.w;vec3 p=vKP*8.0+vKo.z*13.0;float n=rvNoise(p)*0.65+rvNoise(p*2.3)*0.35;float n2=rvNoise(p*1.7+5.0);
      vec3 white=vec3(0.86,0.84,0.78),red=vec3(0.82,0.2,0.04),blk=vec3(0.03,0.03,0.035),gold=vec3(0.95,0.62,0.18),org=vec3(0.95,0.42,0.08);
      vec3 c=white;
      if(k<0.5){c=mix(white,red,smoothstep(0.5,0.56,n));}
      else if(k<1.5){c=mix(blk,red,smoothstep(0.5,0.56,n));c=mix(c,white,smoothstep(0.62,0.68,n2));}
      else if(k<2.5){c=gold*mix(0.85,1.1,n);}
      else if(k<3.5){c=mix(org,white,smoothstep(0.66,0.72,n2));}
      else{c=mix(vec3(0.55,0.58,0.6),vec3(0.16,0.2,0.22),smoothstep(-0.02,0.08,vKP.y));}
      if(vFz.y>1.5)c=mix(c,white*0.9,0.45);
      c*=mix(0.8,1.0,smoothstep(-0.1,0.05,vKP.y));
      diffuseColor.rgb=c;}`,
    fEmissive:GLSL_TREVEAL_E,
  },'koi');
  const fishM=new THREE.InstancedMesh(fishGeo,fishMat,NK+NJ);const aKo=new Float32Array((NK+NJ)*4);
  const koi=[];
  const pickPt=bias=>{const A=(chanPts.length&&rr()<bias)?chanPts:waterPts;return A[Math.floor(rr()*A.length)].clone();};
  for(let i=0;i<NK;i++){const p=pickPt(0.5);
    const k={p,h:rr()*6.28,v:0.3,d:0.22+rr()*0.25,s:0.6+rr()*0.3,t:null,surf:rr()*20,kind:[0,0,1,2,3,0,1,3][i%8]};k.t=waterPts[Math.floor(rr()*waterPts.length)].clone();koi.push(k);
    aKo.set([rr()*6.28,0.6+rr()*0.5,rr()*10,k.kind],i*4);}
  for(let j=0;j<NJ;j++)aKo.set([rr()*6.28,1.4,rr()*10,4],(NK+j)*4);
  fishGeo.setAttribute('aKo',new THREE.InstancedBufferAttribute(aKo,4));
  fishM.instanceMatrix.setUsage(THREE.DynamicDrawUsage);fishM.castShadow=false;fishM.receiveShadow=true;fishM.frustumCulled=false;grp.add(fishM);
  const jumps=[{t:-1,next:4+rr()*5},{t:-1,next:9+rr()*6}];

  /* éclaboussures : gouttes (pool de particules) */
  const NDP=120,dropPos=new Float32Array(NDP*3),dropVel=new Float32Array(NDP*3),dropLife=new Float32Array(NDP);let dropI=0;
  const dropG=new THREE.BufferGeometry();dropG.setAttribute('position',new THREE.BufferAttribute(dropPos,3));const dropLA=new THREE.BufferAttribute(dropLife,1);dropG.setAttribute('aL',dropLA);
  const dropMat=new THREE.ShaderMaterial({uniforms:{uScale:{value:VH*renderer.getPixelRatio()},uLum:U.uLum,uSunColor:U.uSunColor},transparent:true,depthWrite:false,
    vertexShader:`attribute float aL;uniform float uScale;varying float vA;void main(){vA=aL;vec4 mv=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*mv;gl_PointSize=uScale*0.035/max(-mv.z,0.5)*step(0.001,aL);}`,
    fragmentShader:`varying float vA;uniform float uLum;uniform vec3 uSunColor;void main(){vec2 q=gl_PointCoord*2.0-1.0;float d=dot(q,q);if(d>1.0)discard;gl_FragColor=vec4((vec3(0.7,0.76,0.75)*(0.3+0.7*uLum)+uSunColor*0.4)*vA,(1.0-d)*vA*0.8);}`});
  const drops=new THREE.Points(dropG,dropMat);drops.frustumCulled=false;grp.add(drops);
  function splash(x,z,n,pw){WATER.ripple(x,z,pw);for(let k=0;k<n;k++){const i=dropI;dropI=(dropI+1)%NDP;const a=rr()*6.28,sp=0.4+rr()*1.2*pw;
    dropPos.set([x,WY+0.02,z],i*3);dropVel.set([Math.cos(a)*sp*0.5,1.2+rr()*2.2*pw,Math.sin(a)*sp*0.5],i*3);dropLife[i]=1;}}

  /* ───────── oiseaux en vol (aras, martin-pêcheur) : ailes battues dans le shader ───────── */
  // régions : 0 dos, 1 ventre, 2 tête, 3 bec, 4 aile intérieure, 5 aile extérieure, 6 queue
  function flyerGeo(o){const parts=[];
    const add=(g,reg,w)=>{if(g.attributes.uv)g.deleteAttribute('uv');const n=g.attributes.position.count;const a=new Float32Array(n*2);for(let i=0;i<n;i++){a[i*2]=reg;a[i*2+1]=w;}g.setAttribute('aRg',new THREE.BufferAttribute(a,2));parts.push(g.index?g.toNonIndexed():g);};
    const ell=(x,y,z,rx,ry,rz,reg)=>{const g=new THREE.SphereGeometry(1,10,7);g.scale(rx,ry,rz);g.translate(x,y,z);add(g,reg,0);};
    const flat=(pts,reg,w)=>{const p=[];for(let i=1;i<pts.length-1;i++)p.push(...pts[0],...pts[i],...pts[i+1]);const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.computeVertexNormals();add(g,reg,w);};
    const L=o.len,Wsp=o.span;
    ell(0,0.01,0,0.06*L,0.055*L,0.17*L,0);ell(0,-0.015,0.01,0.05*L,0.04*L,0.13*L,1);
    ell(0,0.025*L,0.17*L,0.048*L,0.048*L,0.055*L,2);
    {const g=new THREE.ConeGeometry(0.022*L,o.beak*L,6);g.rotateX(Math.PI/2);g.translate(0,0.015*L,(0.22+o.beak/2)*L);add(g,3,0);}
    flat([[0,0,-0.13*L],[0.03*L,0,-0.15*L],[o.tw*L,-0.01*L,-(0.15+o.tail)*L],[0,-0.012*L,-(0.17+o.tail)*L],[-o.tw*L,-0.01*L,-(0.15+o.tail)*L],[-0.03*L,0,-0.15*L]],6,0);
    for(const s of [1,-1]){const sx=v=>v*s;
      flat([[sx(0.04*L),0,0.07*L],[sx(0.04*L),0,-0.09*L],[sx(0.3*Wsp),0,-0.08*Wsp],[sx(0.3*Wsp),0,0.07*Wsp]],4,1);
      flat([[sx(0.3*Wsp),0,0.07*Wsp],[sx(0.3*Wsp),0,-0.08*Wsp],[sx(0.48*Wsp),0,-0.1*Wsp],[sx(0.6*Wsp),0,-0.06*Wsp],[sx(0.62*Wsp),0,0.0],[sx(0.5*Wsp),0,0.05*Wsp]],5,2+(0.3*Wsp-0.04));}
    return mergeGeometries(parts);}
  const PAL=[ // ara rouge, ara bleu et jaune, martin-pêcheur
    '#b81a14','#c4201a','#c41e18','#e8e2d0','#d8a020','#1c48b0','#b8241c',
    '#1d5fb8','#f0c020','#2a6cc0','#1a1a1a','#2266c0','#1b4fa8','#1d5fb8',
    '#1b7fa8','#e07818','#1a6c9a','#1a1a1a','#1d86b0','#16608a','#1a6c9a'].map(c=>new THREE.Color(c));
  const flyMat=patch(new THREE.MeshStandardMaterial({color:new THREE.Color('#ffffff'),roughness:0.6,side:THREE.DoubleSide,envMapIntensity:0.6}),{
    uniforms:{uPal:{value:PAL}},
    vHead:`uniform float uTime;attribute vec2 aRg;attribute vec4 aFl;attribute vec2 aFo;varying vec2 vRg;varying float vSp;`,
    vBegin:`{float sg=sign(position.x);float w=aRg.y;vec3 p=transformed;
      if(w>0.5){float th=aFl.z*sin(uTime*aFl.y+aFl.x)+aFo.y;float th2=th*0.6+aFl.z*0.45*sin(uTime*aFl.y+aFl.x-1.0);
        vec2 qq=vec2(p.x-sg*0.04,p.y);
        if(w>1.5){float el=w-2.0;vec2 r=qq-vec2(sg*el,0.0);   // coude : l'aile extérieure plie un peu en retard
          float a2=th2*sg;r=vec2(cos(a2)*r.x-sin(a2)*r.y,sin(a2)*r.x+cos(a2)*r.y);qq=vec2(sg*el,0.0)+r;}
        float a1=th*sg;qq=vec2(cos(a1)*qq.x-sin(a1)*qq.y,sin(a1)*qq.x+cos(a1)*qq.y);p.x=qq.x+sg*0.04;p.y=qq.y;
        // repli : l'aile se range le long du corps
        float fo=aFo.x;if(fo>0.0){float ang=-sg*fo*1.45;vec2 xz=vec2(p.x-sg*0.04,p.z);xz=vec2(cos(ang)*xz.x-sin(ang)*xz.y,sin(ang)*xz.x+cos(ang)*xz.y);p.x=xz.x*mix(1.0,0.35,fo)+sg*0.04;p.z=xz.y;p.y+=fo*0.02;}}
      transformed=p;}`,
    vMain:`vRg=aRg;vSp=aFl.w;`,
    fHead:`uniform vec3 uPal[21];varying vec2 vRg;varying float vSp;`,
    fDiscard:GLSL_TREVEAL,
    fColor:`{int i=int(vSp+0.5)*7+int(vRg.x+0.5);vec3 c=uPal[0];for(int k=0;k<21;k++){if(k==i)c=uPal[k];}diffuseColor.rgb=c*mix(0.85,1.08,rvNoise(vRvW*30.0));}`,
    fEmissive:GLSL_TREVEAL_E,
  },'flyer');
  function flyerMesh(geo,n){const M=new THREE.InstancedMesh(geo,flyMat,n);const fl=new Float32Array(n*4),fo=new Float32Array(n*2);
    const A=new THREE.InstancedBufferAttribute(fl,4),B=new THREE.InstancedBufferAttribute(fo,2);A.setUsage(THREE.DynamicDrawUsage);B.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aFl',A);geo.setAttribute('aFo',B);M.instanceMatrix.setUsage(THREE.DynamicDrawUsage);M.castShadow=true;M.frustumCulled=false;M.layers.enable(1);grp.add(M);
    for(let i=0;i<n;i++){m4.makeScale(0,0,0);M.setMatrixAt(i,m4);}return {M,A,B,fl,fo};}
  const macG=flyerGeo({len:1.0,span:1.05,beak:0.07,tail:0.42,tw:0.035});
  const kfG=flyerGeo({len:0.6,span:0.55,beak:0.12,tail:0.08,tw:0.03});
  const NMAC=MOBILE?4:7;const MAC=flyerMesh(macG,NMAC),KF=flyerMesh(kfG,1);
  const macaws=[];for(let i=0;i<NMAC;i++)macaws.push({g:Math.floor(i/(NMAC>4?2.4:2)),sp:i%3===2?1:0,ph:rr()*6.28,off:V((rr()-0.5)*3,(rr()-0.5)*1.5,(rr()-0.5)*3)});
  const NG=Math.max(...macaws.map(m=>m.g))+1;const groups=[];for(let g=0;g<NG;g++)groups.push({t:-1,wait:2+g*7+rr()*6,path:null,dur:10});
  function macPath(){const dir=rr()<0.5?1:-1;const d0=30+rr()*28,h=11+rr()*11;
    const pt=(az,d,y)=>{const a=az*Math.PI/180;return C.clone().addScaledVector(F,d*Math.cos(a)).addScaledVector(R,d*Math.sin(a)).setY(y);};
    return [pt(-40*dir,d0+14,h+5),pt(-12*dir,d0,h+rr()*3),pt(10*dir,d0+6,h+1+rr()*4),pt(42*dir,d0+22,h+8)];}
  const cat=(P,t,out)=>{const n=P.length-1,s=Math.min(n-1e-4,Math.max(0,t*n)),i=Math.floor(s),u=s-i;const p0=P[Math.max(0,i-1)],p1=P[i],p2=P[i+1],p3=P[Math.min(n,i+2)];
    const f=(a,b,c,d)=>0.5*((2*b)+(-a+c)*u+(2*a-5*b+4*c-d)*u*u+(-a+3*b-3*c+d)*u*u*u);return out.set(f(p0.x,p1.x,p2.x,p3.x),f(p0.y,p1.y,p2.y,p3.y),f(p0.z,p1.z,p2.z,p3.z));};

  /* ───────── aigrettes et héron : au bord de l'eau, ils marchent, pêchent, s'envolent ───────── */
  // posés sur la terre ferme, au bord de l'eau (plus de vol ni de pêche : ils guettent, tournent la tête, se redressent)
  const WADE=[];[[17,-1],[22.5,1],[24.5,-1],[34,1]].forEach(([d,sd])=>{
    let p=null;for(let s=0;s<24;s+=0.2){const q2=C.clone().addScaledVector(F,d).addScaledVector(R,sd*s);if(shoreD(q2.x,q2.z)>1.1){p=q2;break;}}
    if(p){p.y=groundH(p.x,p.z);WADE.push({p,sd,d});}});
  const egretDefs=[['body',-1,[0,0.56,0]],['neck1',0,[0,0.62,0.12]],['neck2',1,[0,0.8,0.14]],['head',2,[0,0.95,0.19]],
    ['legL',0,[0.05,0.5,0]],['shinL',4,[0.05,0.27,0.02]],['legR',0,[-0.05,0.5,0]],['shinR',6,[-0.05,0.27,0.02]],['wingL',0,[0.07,0.62,0.06]],['wingR',0,[-0.07,0.62,0.06]]];
  const egrets=WADE.map((w,i)=>{const heron=i===3,body=heron?'#8d949c':'#f3f2ec',dark=heron?'#4a5058':'#e8e6de',bill=heron?'#c8a040':'#e8c020';
    const E=rigMake(egretDefs,A=>{
      A.ell(0,0.56,0,0.08,0.09,0.19,'body',body);A.ell(0,0.52,-0.2,0.05,0.035,0.1,'body',dark);
      A.seg([0,0.6,0.13],[0,0.8,0.15],0.03,0.022,'neck1',body);A.seg([0,0.8,0.15],[0,0.95,0.19],0.022,0.019,'neck2',body);
      A.ell(0,0.962,0.21,0.026,0.03,0.045,'head',body);A.cone([0,0.955,0.245],[0,0.948,0.37],0.011,'head',bill);
      if(heron)A.seg([0,0.985,0.19],[0,0.975,0.1],0.006,0.002,'head','#202428');
      for(const s of [1,-1]){const L=s>0?'L':'R';A.seg([0.05*s,0.5,0],[0.05*s,0.27,0.02],0.009,0.007,'leg'+L,'#1e1e1c');A.seg([0.05*s,0.27,0.02],[0.05*s,0.025,0],0.007,0.006,'shin'+L,'#1e1e1c');
        A.seg([0.05*s,0.025,0],[0.05*s,0.02,0.08],0.004,0.003,'shin'+L,'#1e1e1c',4,false);
        A.wing([[0.07*s,0.62,0.12],[0.07*s,0.62,-0.06],[0.45*s,0.62,-0.16],[0.78*s,0.61,-0.08],[0.75*s,0.62,0.03],[0.4*s,0.63,0.1]],'wing'+L,body);}
    },animMat,grp,heron?1.15:1.0);
    const toW=R.clone().multiplyScalar(-w.sd*0.85).addScaledVector(F,0.5);
    E.root.position.copy(w.p);E.home=w.p.clone();E.st='stand';E.t=rr()*5;E.yaw=Math.atan2(toW.x,toW.z)+(rr()-0.5)*1.2;E.fly=null;E.idx=i;return E;});

  /* ───────── toucans perchés ───────── */
  const toucanDefs=[['body',-1,[0,0.12,0]],['head',0,[0,0.24,0.05]],['tail',0,[0,0.06,-0.06]]];
  const perches=[];
  if(JF.fgBranch){const B=JF.fgBranch;perches.push(B[2].clone().lerp(B[3],0.45).add(V(0,0.22,0)));}
  if(JF.fgPalmTop)perches.push(JF.fgPalmTop.clone().add(V(0,0.1,0)));
  const toucans=perches.map((p,i)=>{const T=rigMake(toucanDefs,A=>{
      A.ell(0,0.12,0,0.06,0.09,0.065,'body','#121212',10,0.35);A.ell(0,0.17,0.045,0.045,0.05,0.03,'body','#f2e8b0');A.ell(0,0.07,0.03,0.04,0.025,0.03,'body','#c02020');
      A.ell(0,0.245,0.05,0.045,0.045,0.05,'head','#121212');A.ell(0.033,0.25,0.075,0.012,0.012,0.008,'head','#3a8ad0',6);A.ell(-0.033,0.25,0.075,0.012,0.012,0.008,'head','#3a8ad0',6);
      A.seg([0,0.25,0.085],[0,0.235,0.17],0.026,0.02,'head','#78a030',8,false);A.seg([0,0.235,0.17],[0,0.215,0.25],0.02,0.012,'head','#f0a018',8,false);A.cone([0,0.215,0.25],[0,0.2,0.29],0.012,'head','#d03018');
      A.wing([[0,0.07,-0.04],[0.04,0.06,-0.06],[0.03,-0.08,-0.12],[0,-0.1,-0.12],[-0.03,-0.08,-0.12],[-0.04,0.06,-0.06]],'tail','#101010');
      A.seg([0.025,0.04,0.01],[0.025,0.0,0.02],0.006,0.005,'body','#40506a',4);A.seg([-0.025,0.04,0.01],[-0.025,0.0,0.02],0.006,0.005,'body','#40506a',4);
    },animMat,grp,1.1);T.root.position.copy(p);T.yaw=Math.atan2(C.x-p.x,C.z-p.z)+(rr()-0.5);T.t=rr()*10;T.hop=0;return T;});

  /* ───────── martin-pêcheur perché sur sa branche morte : il guette l'eau, tourne la tête par à-coups ───────── */
  const kfr=mulberry32(707);
  const kfRig=JF.kfPerch?rigMake([['body',-1,[0,0.05,0]],['head',0,[0,0.17,0.03]],['tail',0,[0,0.06,-0.035]]],A=>{
      const blue='#1b7fa8',orange='#e07818',white='#f0ece0';
      A.ell(0,0.105,0,0.042,0.068,0.046,'body',blue,12,0.3);A.ell(0,0.095,0.02,0.036,0.058,0.034,'body',orange,10,0.3);
      A.ell(0,0.112,-0.034,0.013,0.05,0.012,'body','#3ab0e0',8,0.3);
      for(const sx of [1,-1]){A.ell(0.034*sx,0.105,-0.012,0.014,0.058,0.04,'body','#16608a',8,0.35);
        A.ell(0.032*sx,0.183,0.045,0.01,0.013,0.02,'head',orange,6);A.ell(0.03*sx,0.17,0.024,0.008,0.012,0.012,'head',white,6);
        A.ell(0.031*sx,0.196,0.058,0.006,0.006,0.005,'head','#080808',6);
        A.seg([0.012*sx,0.052,0.008],[0.012*sx,0.006,0.012],0.005,0.004,'body','#d04020',5);A.seg([0.012*sx,0.006,0.012],[0.012*sx,0.004,0.035],0.003,0.002,'body','#d04020',4,false);}
      A.ell(0,0.19,0.035,0.04,0.038,0.044,'head',blue,12);A.ell(0,0.167,0.06,0.022,0.014,0.016,'head',white,6);
      A.seg([0,0.188,0.075],[0,0.18,0.16],0.01,0.0025,'head','#1a1410',8,false);
      A.wing([[0,0.065,-0.03],[0.016,0.06,-0.04],[0.013,0.005,-0.074],[-0.013,0.005,-0.074],[-0.016,0.06,-0.04]],'tail','#1d5fb8');
    },animMat,grp,1.7):null;
  if(kfRig){const dw=R.clone().multiplyScalar(0.8).addScaledVector(F,0.45);kfRig.yaw=Math.atan2(dw.x,dw.z);kfRig.t=0;kfRig.next=1;kfRig.hy=0;kfRig.hx=0;kfRig.cy=0;kfRig.cx=0;kfRig.bob=0;}

  /* ───────── singes : sur la branche du premier plan et sur des branches de fromagers ───────── */
  const monkeyDefs=[['hips',-1,[0,0.3,-0.1]],['chest',0,[0,0.32,0.1]],['head',1,[0,0.38,0.24]],
    ['armL',1,[0.075,0.3,0.14]],['foreL',3,[0.075,0.16,0.15]],['armR',1,[-0.075,0.3,0.14]],['foreR',5,[-0.075,0.16,0.15]],
    ['legL',0,[0.07,0.28,-0.14]],['shinL',7,[0.07,0.15,-0.1]],['legR',0,[-0.07,0.28,-0.14]],['shinR',9,[-0.07,0.15,-0.1]],
    ['tail1',0,[0,0.32,-0.2]],['tail2',11,[0,0.3,-0.42]],['tail3',12,[0,0.26,-0.62]]];
  function monkey(){return rigMake(monkeyDefs,A=>{const fur='#3c2a1c',cream='#d6c39e',dark='#1c140e';
    A.ell(0,0.31,-0.08,0.07,0.075,0.11,'hips',fur);A.ell(0,0.33,0.1,0.08,0.085,0.1,'chest',fur);A.ell(0,0.36,0.15,0.075,0.06,0.05,'chest',cream);
    A.ell(0,0.39,0.25,0.055,0.058,0.055,'head',fur);A.ell(0,0.38,0.285,0.04,0.042,0.03,'head',cream);A.ell(0,0.425,0.25,0.05,0.025,0.05,'head',dark);
    A.ell(0.05,0.4,0.24,0.015,0.02,0.01,'head',cream,6);A.ell(-0.05,0.4,0.24,0.015,0.02,0.01,'head',cream,6);
    A.ell(0.018,0.392,0.31,0.008,0.008,0.004,'head','#0a0806',5);A.ell(-0.018,0.392,0.31,0.008,0.008,0.004,'head','#0a0806',5);
    for(const s of [1,-1]){const L=s>0?'L':'R';A.seg([0.075*s,0.3,0.14],[0.075*s,0.16,0.15],0.024,0.02,'arm'+L,fur);A.seg([0.075*s,0.16,0.15],[0.075*s,0.02,0.15],0.019,0.015,'fore'+L,fur);
      A.seg([0.07*s,0.28,-0.14],[0.07*s,0.15,-0.1],0.03,0.022,'leg'+L,fur);A.seg([0.07*s,0.15,-0.1],[0.07*s,0.02,-0.12],0.02,0.015,'shin'+L,fur);}
    A.seg([0,0.32,-0.2],[0,0.3,-0.42],0.015,0.013,'tail1',fur);A.seg([0,0.3,-0.42],[0,0.26,-0.62],0.013,0.011,'tail2',fur);A.seg([0,0.26,-0.62],[0,0.2,-0.8],0.011,0.008,'tail3',fur);
  },animMat,grp,1.25);}
  const branchOk=P=>{const m=P[Math.floor(P.length/2)];const v=m.clone().sub(C);const d=v.dot(F),l=v.dot(R);return d>30&&d<120&&Math.abs(l)/d<0.42;};
  const routes=[];
  if(JF.fgBranch)routes.push({P:JF.fgBranch,r0:0.45,r1:0.18,a:0.12,b:0.9},{P:JF.fgBranch,r0:0.45,r1:0.18,a:0.3,b:0.62});
  (JF.kapokBranches||[]).filter(branchOk).slice(0,2).forEach(P=>routes.push({P,r0:0.45,r1:0.12,a:0.05,b:0.8}));
  const monkeys=routes.map((rt,i)=>{const M=monkey();M.rt=rt;M.s=lerp(rt.a,rt.b,rr());M.dir=rr()<0.5?1:-1;M.st='walk';M.t=rr()*6;M.idx=i;return M;});
  const polyAt=(P,s,out,tan)=>{const n=P.length-1,x=Math.min(n-1e-4,Math.max(0,s*n)),i=Math.floor(x),u=x-i;out.copy(P[i]).lerp(P[i+1],u);if(tan)tan.copy(P[i+1]).sub(P[i]).normalize();return out;};

  /* ───────── papillons et libellules ───────── */
  const insG=(()=>{const parts=[];const add=(pts,reg)=>{const p=[];for(let i=1;i<pts.length-1;i++)p.push(...pts[0],...pts[i],...pts[i+1]);const g=new THREE.BufferGeometry();
      g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));const a=new Float32Array(p.length/3*3);for(let i=0;i<p.length/3;i++){a[i*3]=reg;a[i*3+1]=p[i*3];a[i*3+2]=p[i*3+2];}g.setAttribute('aIn',new THREE.BufferAttribute(a,3));g.computeVertexNormals();parts.push(g);};
    add([[0,0,0.03],[0.006,0,0],[0,0,-0.05],[-0.006,0,0]],0);
    for(const s of [1,-1]){add([[0.004*s,0,0.02],[0.05*s,0,0.045],[0.075*s,0,0.02],[0.06*s,0,-0.005],[0.004*s,0,-0.004]],1);add([[0.004*s,0,-0.004],[0.05*s,0,-0.01],[0.055*s,0,-0.04],[0.025*s,0,-0.05],[0.004*s,0,-0.02]],1);}
    return mergeGeometries(parts);})();
  const dfG=(()=>{const parts=[];const add=(pts,reg)=>{const p=[];for(let i=1;i<pts.length-1;i++)p.push(...pts[0],...pts[i],...pts[i+1]);const g=new THREE.BufferGeometry();
      g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));const a=new Float32Array(p.length/3*3);for(let i=0;i<p.length/3;i++){a[i*3]=reg;a[i*3+1]=p[i*3];a[i*3+2]=p[i*3+2];}g.setAttribute('aIn',new THREE.BufferAttribute(a,3));g.computeVertexNormals();parts.push(g);};
    add([[0,0.004,0.035],[0.005,0,0.02],[0.003,0,-0.08],[0,0.002,-0.085],[-0.003,0,-0.08],[-0.005,0,0.02]],0);
    for(const s of [1,-1]){add([[0.004*s,0,0.02],[0.06*s,0.002,0.03],[0.065*s,0,0.018],[0.004*s,0,0.008]],2);add([[0.004*s,0,0.005],[0.058*s,0.002,0.0],[0.06*s,0,-0.012],[0.004*s,0,-0.006]],2);}
    return mergeGeometries(parts);})();
  const insMat=patch(new THREE.MeshStandardMaterial({color:new THREE.Color('#ffffff'),roughness:0.5,side:THREE.DoubleSide,alphaToCoverage:true,envMapIntensity:0.7}),{
    vHead:`uniform float uTime;attribute vec3 aIn;attribute vec4 aBf;varying vec3 vIn;varying float vSp;`,
    vBegin:`{float sg=sign(position.x);if(aIn.x>0.5){float fr=aBf.y;float th=aIn.x>1.5?0.35*sin(uTime*fr+aBf.x):1.1*sin(uTime*fr+aBf.x)+0.2;
        float a=th*sg;vec2 q=vec2(transformed.x,transformed.y);transformed.x=cos(a)*q.x-sin(a)*q.y;transformed.y=sin(a)*q.x+cos(a)*q.y;}}`,
    vMain:`vIn=aIn;vSp=aBf.z;`,
    fHead:`varying vec3 vIn;varying float vSp;`,
    fDiscard:GLSL_TREVEAL,
    fColor:`{vec3 c;float a=1.0;float r=length(vIn.yz*vec2(1.0,1.2));
      if(vIn.x<0.5)c=vSp<2.5?vec3(0.05,0.04,0.03):(vSp<3.5?vec3(0.1,0.35,0.55):vec3(0.55,0.12,0.06));
      else if(vSp<0.5){c=mix(vec3(0.05,0.35,0.95),vec3(0.02,0.02,0.03),smoothstep(0.04,0.065,r));c+=vec3(0.6)*step(0.92,rvNoise(vec3(vIn.yz*180.0,1.0)))*step(0.055,r);}
      else if(vSp<1.5){c=vec3(0.95,0.8,0.15)*mix(1.0,0.8,smoothstep(0.05,0.07,r));}
      else if(vSp<2.5){c=mix(vec3(0.95,0.45,0.05),vec3(0.03),smoothstep(0.88,0.95,abs(fract(vIn.y*55.0+vIn.z*20.0)-0.5)*2.0)*0.85);c=mix(c,vec3(0.02),smoothstep(0.055,0.07,r));}
      else{c=vec3(0.82,0.86,0.9);a=0.45;}
      diffuseColor.rgb=c;diffuseColor.a=a;}`,
    fRough:`roughnessFactor=vIn.x>1.5?0.15:0.55;`,
    fEmissive:GLSL_TREVEAL_E,
  },'insect');
  const NBF=MOBILE?8:16,NDF=MOBILE?4:9;
  const mkIns=(G,n)=>{const M=new THREE.InstancedMesh(G,insMat,n);const a=new Float32Array(n*4);G.setAttribute('aBf',new THREE.InstancedBufferAttribute(a,4));M.instanceMatrix.setUsage(THREE.DynamicDrawUsage);M.frustumCulled=false;grp.add(M);return {M,a};};
  const BF=mkIns(insG,NBF),DF=mkIns(dfG,NDF);
  const flies=[];
  const bankHome=(dmin,dmax,inl)=>{const sd=rr()<0.5?-1:1,d=lerp(dmin,dmax,rr());let p=C.clone().addScaledVector(F,d);for(let s=0;s<24;s+=0.25){const q2=C.clone().addScaledVector(F,d).addScaledVector(R,sd*s);if(shoreD(q2.x,q2.z)>inl){p=q2;break;}}return p;};
  for(let i=0;i<NBF;i++){const h=bankHome(5,30,0.6+rr()*3);h.y=groundH(h.x,h.z)+0.6+rr()*1.4;flies.push({kind:0,home:h,p:h.clone(),v:V(0,0,0),ph:rr()*100,sp:i%5===0?1:(i%4===1?2:0)});BF.a.set([rr()*6.28,13+rr()*6,flies[i].sp,0],i*4);}
  for(let i=0;i<NDF;i++){const d=8+rr()*40;const h=C.clone().addScaledVector(F,d).addScaledVector(R,(rr()-0.5)*chanW(d)*1.2);h.y=WY+0.35+rr()*0.9;
    flies.push({kind:1,home:h,p:h.clone(),v:V(0,0,0),tgt:h.clone(),tt:0,ph:rr()*100,sp:3+(i%2)});DF.a.set([rr()*6.28,70+rr()*20,3+(i%2),0],i*4);}
  BF.M.geometry.attributes.aBf.needsUpdate=true;DF.M.geometry.attributes.aBf.needsUpdate=true;

  /* ═══════════ animation ═══════════ */
  const tp=V(0,0,0),tq=V(0,0,0),tan=V(0,0,0);
  const kf={st:'perch',t:2+rr()*4,p:JF.kfPerch?JF.kfPerch.clone():C.clone().addScaledVector(F,12),dive:null,yaw:0};
  function setFly(o,i,pos,yaw,pitch,roll,sc,ph,fr,amp,fold,sp,glide){
    e.set(pitch,yaw,roll,'YXZ');q.setFromEuler(e);m4.compose(pos,q,S.set(sc,sc,sc));o.M.setMatrixAt(i,m4);
    o.fl.set([ph,fr,amp,sp],i*4);o.fo.set([fold,glide||0],i*2);}
  function update(dt,T){
    dt=Math.min(dt,0.1);
    // ── koï : promenade lente, demi-tours doux, montée à la surface de temps en temps
    koi.forEach((k,i)=>{const dx=k.t.x-k.p.x,dz=k.t.z-k.p.z;if(dx*dx+dz*dz<2.5)k.t=pickPt(0.6);
      let want=Math.atan2(dx,dz);
      // évite les rives et le soubassement
      const ax=k.p.x+Math.sin(k.h)*2.5,az=k.p.z+Math.cos(k.h)*2.5;if(shoreD(ax,az)>-1.8||Math.max(Math.abs(ax),Math.abs(az))<10.3)want=k.h+1.2;
      let dh=angD(want,k.h);k.h+=Math.max(-0.7*dt,Math.min(0.7*dt,dh));
      k.v+=((0.28+0.12*Math.sin(T*0.3+i))-k.v)*dt;k.p.x+=Math.sin(k.h)*k.v*dt;k.p.z+=Math.cos(k.h)*k.v*dt;
      k.surf-=dt;let d=k.d;if(k.surf<1.6){d=lerp(k.d,0.05,smooth(1.6,0.9,k.surf)*smooth(-0.2,0.4,k.surf));if(k.surf<0.9&&!k.rip){WATER.ripple(k.p.x+Math.sin(k.h)*0.3*k.s,k.p.z+Math.cos(k.h)*0.3*k.s,0.35);k.rip=1;}}
      if(k.surf<-0.3){k.surf=12+rr()*22;k.rip=0;}
      e.set(0,k.h,-dh*0.3);q.setFromEuler(e);m4.compose(tp.set(k.p.x,WY-d,k.p.z),q,S.set(k.s,k.s,k.s));fishM.setMatrixAt(i,m4);
      if(WATER.koi&&i<16)WATER.koi[i].set(k.p.x,k.p.z,Math.atan2(Math.cos(k.h),Math.sin(k.h)),d);});
    // ── poissons qui sautent
    jumps.forEach((J,j)=>{const idx=NK+j;
      if(J.t<0){J.next-=dt;m4.makeScale(0,0,0);fishM.setMatrixAt(idx,m4);
        if(J.next<=0&&chanPts.length){J.p=chanPts[Math.floor(rr()*chanPts.length)].clone();J.h=rr()*6.28;J.t=0;J.dur=0.9+rr()*0.35;J.H=0.45+rr()*0.5;J.L=1.1+rr()*0.8;J.s1=0;J.s2=0;}return;}
      J.t+=dt/J.dur;const u=J.t;if(u>=1){J.t=-1;J.next=5+rr()*9;return;}
      const y=WY-0.3+(J.H+0.3)*4*u*(1-u),x=J.p.x+Math.sin(J.h)*J.L*(u-0.5),z=J.p.z+Math.cos(J.h)*J.L*(u-0.5);
      const vy=(J.H+0.3)*4*(1-2*u),pitch=-Math.atan2(vy,J.L)*0.9;
      if(!J.s1&&y>WY-0.02){J.s1=1;splash(x,z,10,0.6);}
      if(!J.s2&&u>0.55&&y<WY+0.02){J.s2=1;splash(x,z,16,1.0);}
      e.set(pitch,J.h,Math.sin(u*9)*0.3,'YXZ');q.setFromEuler(e);m4.compose(tp.set(x,y,z),q,S.set(0.42,0.42,0.42));fishM.setMatrixAt(idx,m4);});
    fishM.instanceMatrix.needsUpdate=true;
    // ── gouttes
    let any=false;for(let i=0;i<NDP;i++){if(dropLife[i]<=0)continue;any=true;dropVel[i*3+1]-=9.8*dt;dropPos[i*3]+=dropVel[i*3]*dt;dropPos[i*3+1]+=dropVel[i*3+1]*dt;dropPos[i*3+2]+=dropVel[i*3+2]*dt;
      dropLife[i]-=dt*1.4;if(dropPos[i*3+1]<WY)dropLife[i]=0;}
    if(any||true){dropG.attributes.position.needsUpdate=true;dropLA.needsUpdate=true;}
    // ── aras : traversées en petits groupes
    groups.forEach(G=>{if(G.t<0){G.wait-=dt;if(G.wait<=0){G.path=macPath();G.t=0;G.dur=12+rr()*4;}}else{G.t+=dt/G.dur;if(G.t>=1){G.t=-1;G.wait=8+rr()*16;}}});
    macaws.forEach((m,i)=>{const G=groups[m.g];if(G.t<0){m4.makeScale(0,0,0);MAC.M.setMatrixAt(i,m4);return;}
      const t=Math.min(0.999,G.t+(i%3)*0.012);cat(G.path,t,tp);cat(G.path,Math.min(0.999,t+0.01),tq);tq.sub(tp);
      tp.add(m.off).y+=Math.sin(T*1.7+m.ph)*0.25;
      const yaw=Math.atan2(tq.x,tq.z),pitch=-Math.atan2(tq.y,Math.hypot(tq.x,tq.z));const glide=Math.sin(T*0.6+m.ph)>0.55;
      setFly(MAC,i,tp,yaw,pitch,Math.sin(T*0.8+m.ph)*0.25,1.3,m.ph,glide?0:7.5,glide?0.08:0.75,0,m.sp,glide?0.1:0);});
    MAC.M.instanceMatrix.needsUpdate=true;MAC.A.needsUpdate=true;MAC.B.needsUpdate=true;
    // ── martin-pêcheur : immobile sur sa branche, il guette l'eau (tête par à-coups, hochement, queue)
    if(kfRig){const K=kfRig;K.reset();K.t+=dt;
      if(K.t>K.next){K.next=K.t+0.8+kfr()*2.8;K.hy=(kfr()-0.5)*1.7;K.hx=(kfr()-0.3)*0.45;if(kfr()<0.3)K.bob=0.45;}
      K.cy+=(K.hy-K.cy)*Math.min(1,dt*12);K.cx+=(K.hx-K.cx)*Math.min(1,dt*12);
      K.B.head.rotation.y=K.cy;K.B.head.rotation.x=K.cx;
      let bob=0;if(K.bob>0){K.bob-=dt;bob=Math.sin((0.45-K.bob)/0.45*Math.PI*2)*0.12;}
      K.B.body.rotation.x=bob;K.B.tail.rotation.x=0.3*Math.max(0,Math.sin(K.t*2.3))*(Math.sin(K.t*0.37)>0.55?1:0);
      K.root.position.copy(JF.kfPerch).y+=0.015;K.root.rotation.y=K.yaw;}
    // ── aigrettes et héron
    egrets.forEach(E=>{E.reset();const B=E.B;E.t+=dt;
      // ailes repliées le long du corps
      B.wingL.rotation.y=1.5;B.wingR.rotation.y=-1.5;B.wingL.rotation.z=-0.12;B.wingR.rotation.z=0.12;B.wingL.scale.set(0.55,1,1);B.wingR.scale.set(0.55,1,1);
      const cyc=(E.t+E.idx*3.7)%15;
      B.neck1.rotation.x=0.42+0.08*Math.sin(T*0.7+E.idx);B.neck2.rotation.x=-0.85;B.head.rotation.x=0.4;B.head.rotation.y=0.45*Math.sin(T*0.33+E.idx*2);
      if(cyc>9&&cyc<11.8){const k=Math.sin((cyc-9)/2.8*Math.PI);   // se redresse, cou tendu, aux aguets
        B.neck1.rotation.x=lerp(B.neck1.rotation.x,0.05,k);B.neck2.rotation.x=lerp(-0.85,-0.25,k);B.head.rotation.x=lerp(0.4,0.15,k);}
      B.body.rotation.x=0.02*Math.sin(T*0.5+E.idx);
      E.root.position.copy(E.home);E.root.rotation.y=E.yaw;});
    // ── toucans : tête qui tourne, petits sauts
    toucans.forEach((Tc,i)=>{Tc.reset();Tc.t+=dt;const B=Tc.B;B.head.rotation.y=0.9*Math.sin(Tc.t*0.7+i)*(Math.sin(Tc.t*0.23)>0?1:0.3);B.head.rotation.x=0.15*Math.sin(Tc.t*1.3);
      B.tail.rotation.x=0.15*Math.max(0,Math.sin(Tc.t*2.1));
      if(Tc.hop<=0&&rr()<dt*0.08){Tc.hop=0.5;Tc.yaw+=(rr()-0.5)*2.4;}
      let y=0;if(Tc.hop>0){Tc.hop-=dt;y=Math.sin((0.5-Tc.hop)/0.5*Math.PI)*0.12;}
      Tc.root.position.copy(perches[i]).add(V(0,y,0));Tc.root.rotation.y=Tc.yaw;});
    // ── singes : marchent le long de la branche, s'assoient, regardent autour
    monkeys.forEach(M=>{M.reset();const B=M.B,rt=M.rt;M.t-=dt;
      if(M.st==='walk'){M.s+=M.dir*dt*0.055;if(M.s>rt.b||M.s<rt.a){M.dir*=-1;M.s=Math.max(rt.a,Math.min(rt.b,M.s));}
        if(M.t<0){M.st='sit';M.t=5+rr()*8;}
        const ph=T*7+M.idx;B.armL.rotation.x=0.5*Math.sin(ph);B.armR.rotation.x=-0.5*Math.sin(ph);B.legL.rotation.x=-0.5*Math.sin(ph);B.legR.rotation.x=0.5*Math.sin(ph);
        B.foreL.rotation.x=B.foreR.rotation.x=-0.2;B.shinL.rotation.x=0.3+0.3*Math.max(0,Math.sin(ph));B.shinR.rotation.x=0.3+0.3*Math.max(0,-Math.sin(ph));
        B.tail1.rotation.x=-0.3;B.tail2.rotation.x=-0.4+0.15*Math.sin(T*2);B.tail3.rotation.x=-0.3;B.head.rotation.y=0.2*Math.sin(T*0.9);}
      else{if(M.t<0){M.st='walk';M.t=6+rr()*10;M.dir=rr()<0.5?1:-1;}
        B.hips.rotation.x=-1.05;B.chest.rotation.x=0.25;B.head.rotation.x=0.75;B.head.rotation.y=0.8*Math.sin(T*0.5+M.idx);
        B.legL.rotation.x=B.legR.rotation.x=-0.4;B.shinL.rotation.x=B.shinR.rotation.x=1.6;B.armL.rotation.x=-0.6;B.armR.rotation.x=(Math.sin(T*0.4+M.idx)>0.6)?-2.3:-0.5;B.foreR.rotation.x=-0.8;
        B.tail1.rotation.x=1.4;B.tail2.rotation.x=0.3;B.tail3.rotation.x=0.2;}
      polyAt(rt.P,M.s,tp,tan);const rad=lerp(rt.r0,rt.r1,M.s);tp.y+=rad*0.95;
      M.root.position.copy(tp);const dir=M.dir;M.root.rotation.set(0,0,0);M.root.rotation.y=Math.atan2(tan.x*dir,tan.z*dir);M.root.rotateX(-Math.asin(Math.max(-0.8,Math.min(0.8,tan.y*dir)))*(M.st==='walk'?1:0.3));});
    // ── papillons (vol erratique autour d'un point) et libellules (vol stationnaire, élans brusques)
    flies.forEach((f,i)=>{
      if(f.kind===0){const n=T*0.6+f.ph;tq.set(Math.sin(n*1.3)+Math.sin(n*2.9)*0.5,Math.sin(n*1.7)*0.6+Math.sin(n*4.1)*0.25,Math.cos(n*1.1)+Math.cos(n*2.3)*0.5).multiplyScalar(1.6);
        tp.copy(f.home).add(tq);f.v.copy(tp).sub(f.p).multiplyScalar(Math.min(1,dt*1.5));f.p.add(f.v);
        e.set(Math.sin(T*9+f.ph)*0.2,Math.atan2(f.v.x,f.v.z),0,'YXZ');q.setFromEuler(e);m4.compose(f.p,q,S.set(1.6,1.6,1.6));BF.M.setMatrixAt(i,m4);}
      else{const j=i-NBF;f.tt-=dt;if(f.tt<0){f.tt=0.6+rr()*2.4;const d=f.home.clone().add(V((rr()-0.5)*6,0,(rr()-0.5)*6));if(shoreD(d.x,d.z)<-0.5){f.tgt.copy(d);f.tgt.y=WY+0.25+rr()*0.9;}
          if(rr()<0.15)WATER.ripple(f.p.x,f.p.z,0.12);}
        f.v.copy(f.tgt).sub(f.p);const L=f.v.length();if(L>0.05)f.p.addScaledVector(f.v,Math.min(1,dt*4.0));
        f.p.y+=Math.sin(T*3+f.ph)*0.002;
        e.set(0,Math.atan2(f.v.x,f.v.z)||0,0,'YXZ');q.setFromEuler(e);m4.compose(f.p,q,S.set(1.8,1.8,1.8));DF.M.setMatrixAt(j,m4);}});
    BF.M.instanceMatrix.needsUpdate=true;DF.M.instanceMatrix.needsUpdate=true;
  }
  return {grp,update,koi,egrets,toucans,monkeys};
}

/* ═══ 31 · Menu dev (double-clic sur le panneau « L1 » de la pagode, ou l1.html?dev) ═══
   Heure du jour · niveaux de fonte de chaque bloc ·
   navigation rapide · compteur d'images. En mode dev, rien n'est enregistré
   (la mémoire « fonte déjà montrée » reste intacte). Touche D : masquer / afficher. */
const DEV_PHASES=[['Aube',9.5],['Jour',13.5],['Couchant',17],['Crépuscule',19],['Nuit',23]];
const DEV_MELT=[['Intact',0],['Dégel',15],['Ruissel.',40],['Débâcle',65],['Libéré',100]];
function buildDevMenu(open){
  const d=document.createElement('div');d.id='devm';if(!open)d.classList.add('hid');
  const blocks=SUBJECTS.concat(FIN_SUBJECTS);
  d.innerHTML=`
    <button type="button" class="dm-h" aria-expanded="true">////// Menu dev <span>—</span></button>
    <div class="dm-b">
      <p class="dm-k">Heure <b id="dm-hr">--:--</b> <i id="dm-ph"></i></p>
      <div class="dm-row">${DEV_PHASES.map(([n,h])=>`<button type="button" data-h="${h}">${n}</button>`).join('')}</div>
      <div class="dm-row"><input id="dm-hs" type="range" min="0" max="24" step="0.25" value="12" aria-label="Heure simulée"><button type="button" id="dm-auto">Auto</button></div>
      <p class="dm-k">Fonte <i>— bloc à afficher</i></p>
      <div class="dm-row dm-blk">${blocks.map((s,i)=>`<button type="button" data-b="${i}" title="${s.name}">${String(s.idx).padStart(2,'0')}</button>`).join('')}</div>
      <div class="dm-row">${DEV_MELT.map(([n,v])=>`<button type="button" data-m="${v}">${n}<small>${v}%</small></button>`).join('')}</div>
      <div class="dm-row"><input id="dm-ms" type="range" min="0" max="100" step="0.5" value="0" aria-label="Fonte simulée"><b id="dm-mv">000 %</b></div>
      <div class="dm-row"><label><input type="checkbox" id="dm-anim"> animer</label><button type="button" id="dm-replay">Rejouer la fonte</button></div>
      <p class="dm-k">Aller à</p>
      <div class="dm-row"><button type="button" data-p="0">Jungle</button><button type="button" data-p="1">Ambre</button><button type="button" data-p="${P_PORTAL}">Portail</button><button type="button" data-p="${P_FIN}">Finance</button><button type="button" data-p="${P_STATS}">Stats</button></div>
      <div class="dm-row"><button type="button" id="dm-skip">Passer l'intro</button><button type="button" id="dm-fps">Images / s</button><button type="button" id="dm-forget">Oublier les fontes vues</button></div>
    </div>`;
  document.body.appendChild(d);
  const $=s=>d.querySelector(s),$$=s=>[...d.querySelectorAll(s)];
  const st={blk:0};
  const skipIntro=()=>{if(T<INTRO_END){T=INTRO_END;}SC.locked=false;};
  const go=(P,instant)=>{skipIntro();SC.t=P;SC.last=performance.now()-1e4;if(instant)SC.p=P;};
  // heure
  $$('[data-h]').forEach(b=>b.addEventListener('click',()=>{todForce(+b.dataset.h);$('#dm-hs').value=b.dataset.h;}));
  $('#dm-hs').addEventListener('input',e=>todForce(+e.target.value));
  $('#dm-auto').addEventListener('click',()=>todForce(null));
  // fonte
  const target=i=>i<SYS.blocks.length?SYS.blocks[i]:SYS.fins[i-SYS.blocks.length];
  const getV=i=>{const o=target(i);return (i<SYS.blocks.length?o.mT:o.fT)*100;};
  function setMelt(v,replay){
    const i=st.blk,o=target(i),x=clamp01(v/100),anim=$('#dm-anim').checked||replay;
    if(i<SYS.blocks.length){o.mT=x;o.started=true;o.saved=true;if(replay){o.m=0;o.m0=0;o.burst=0;o.burstT=0;o.freeK=0;o.ice.mesh.visible=true;}else if(!anim&&x<ICE_FREE)o.m=x;}
    else{o.fT=x;o.started=true;o.saved=true;if(replay){o.f=0;if(SYS.fincaves){const C=SYS.fincaves.caves[o.i];if(C){C.played=false;C.here=false;C.ct=-1;}}}else if(!anim)o.f=x;}
    show(v);
  }
  function show(v){$('#dm-ms').value=v;$('#dm-mv').textContent=String(Math.round(v)).padStart(3,'0')+' %';$$('[data-m]').forEach(b=>b.classList.toggle('on',Math.abs(+b.dataset.m-v)<0.01));}
  function pickBlock(i){st.blk=i;$$('[data-b]').forEach(b=>b.classList.toggle('on',+b.dataset.b===i));go(i<SYS.blocks.length?i+1:P_FIN+(i-SYS.blocks.length));show(getV(i));}
  $$('[data-b]').forEach(b=>b.addEventListener('click',()=>pickBlock(+b.dataset.b)));
  $$('[data-m]').forEach(b=>b.addEventListener('click',()=>setMelt(+b.dataset.m)));
  $('#dm-ms').addEventListener('input',e=>setMelt(+e.target.value));
  $('#dm-replay').addEventListener('click',()=>setMelt(getV(st.blk),true));
  // vie du désert
  $$('[data-a]').forEach(b=>b.addEventListener('click',()=>{
    skipIntro();if(ZONE!=='desert'||SC.p>0.05)go(0,true);
    if(b.dataset.a==='caravan'){SYS.fauna.popCaravan(3);SYS.fauna.spawnCaravan(SYS.fauna.sMid);}
    else if(b.dataset.a==='walkers'){SYS.fauna.spawnWalkers();}
    else SYS.fauna.startNow(b.dataset.a);
  }));
  $$('[data-sc]').forEach(b=>b.addEventListener('click',()=>{skipIntro();if(ZONE!=='desert'||SC.p>0.05)go(0,true);SYS.fauna.scene(b.dataset.sc,true);}));
  // navigation et outils
  $$('[data-p]').forEach(b=>b.addEventListener('click',()=>go(+b.dataset.p,Math.abs(+b.dataset.p-SC.p)>2)));
  $('#dm-skip').addEventListener('click',skipIntro);
  $('#dm-fps').addEventListener('click',()=>{if(!PERF.el){PERF.el=document.createElement('div');PERF.el.style.cssText='position:fixed;right:10px;top:10px;z-index:99;font:11px JetBrains Mono,monospace;color:#fff;background:rgba(0,0,0,.35);padding:3px 6px';document.body.appendChild(PERF.el);}else{PERF.el.remove();PERF.el=null;}});
  $('#dm-forget').addEventListener('click',()=>{try{Object.keys(localStorage).filter(k=>k.includes('l1_seen')).forEach(k=>localStorage.removeItem(k));}catch(e){}SEEN.data={};$('#dm-forget').textContent='Mémoire vidée';setTimeout(()=>{$('#dm-forget').textContent='Oublier les fontes vues';},1500);});
  // repli, raccourcis
  $('.dm-h').addEventListener('click',()=>{const c=d.classList.toggle('min');$('.dm-h').setAttribute('aria-expanded',String(!c));$('.dm-h span').textContent=c?'+':'—';});
  window.addEventListener('keydown',e=>{if(e.target.tagName==='INPUT')return;
    if(!DEVSTATE.on||d.classList.contains('hid'))return;
    if(e.key==='d'||e.key==='D'){d.classList.add('hid');return;}
    const i='01234'.indexOf(e.key);if(i>=0)setMelt(DEV_MELT[i][1]);});
  // horloge affichée
  setInterval(()=>{const h=todHourNow();$('#dm-hr').textContent=String(Math.floor(h)).padStart(2,'0')+':'+String(Math.floor((h%1)*60)).padStart(2,'0');$('#dm-ph').textContent=TOD.name+(TOD_FORCED===null?' · horloge réelle':' · forcée');},400);
  pickBlockSilently(0);
  function pickBlockSilently(i){st.blk=i;$$('[data-b]').forEach(b=>b.classList.toggle('on',+b.dataset.b===i));show(getV(i));}
  /* compatibilité : le parcours signale le bloc actif quand on y arrive */
  return {toggle(){const h=d.classList.toggle('hid');if(!h)DEVSTATE.on=true;},set(v,silent){const a=activeBlock();if(a){pickBlockSilently(a.i);}else{const fi=Math.round(SC.p)-P_FIN;if(fi>=0&&fi<SYS.fins.length)pickBlockSilently(SYS.blocks.length+fi);}}};
}

/* ═══ 32 · Mer de nuages (transition désert → glace) ═══
   Quand la caméra s'élève au-dessus du désert, des couches de nuages se forment sous elle et
   finissent par engloutir la pyramide. Chaque couche n'apparaît que si la caméra est au-dessus
   (jamais de plafond nuageux vu depuis le sol) ; la couverture est pilotée par le scroll.
   Coût : quelques plans plein écran, bruit lu dans la texture 3D, rien quand la couverture est nulle. */
function buildCloudSea(){
  const LAYERS=[{y:46,a:0.55,s:1.0},{y:62,a:0.7,s:1.35},{y:78,a:0.8,s:1.8},{y:96,a:0.9,s:2.3},{y:116,a:1.0,s:2.9}];
  const grp=new THREE.Group();grp.visible=false;
  const CU={uCov:{value:0},uCamY:{value:0},uLit:{value:new THREE.Color('#fff4e6')},uShade:{value:new THREE.Color('#b9a99a')}};
  const geo=new THREE.PlaneGeometry(2600,2600,1,1);geo.rotateX(-Math.PI/2);
  const mats=LAYERS.map((L,i)=>{
    const u=Object.assign({uLayerY:{value:L.y},uLayerA:{value:L.a},uSeed:{value:i*17.3},uScale:{value:L.s}},CU,U);
    const m=new THREE.ShaderMaterial({uniforms:u,transparent:true,depthWrite:false,side:THREE.DoubleSide,
      vertexShader:`varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.0);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
      fragmentShader:"#define RV_FRAG\n"+GLSL_NOISE+`
        uniform float uCov;uniform float uCamY;uniform vec3 uLit;uniform vec3 uShade;uniform float uLayerY;uniform float uLayerA;uniform float uSeed;uniform float uScale;
        uniform float uTime;uniform vec2 uWind;uniform vec3 uFogColor;uniform float uFogDensity;uniform vec3 uSunDir;
        varying vec3 vW;
        void main(){
          // la couche n'existe que sous la caméra
          float above=smoothstep(8.0,40.0,uCamY-uLayerY);
          float cov=clamp(uCov*1.25-uSeed*0.004,0.0,1.0)*above;
          if(cov<0.002) discard;
          vec2 p=vW.xz/uScale+uWind*uTime*2.2+vec2(uSeed*13.1,uSeed*7.7);
          // cumulus : masses de ~80 m, bords nets, détail fin
          float n=rvFbm3(vec3(p*0.011,uSeed+uTime*0.01))*0.72+rvNoise(vec3(p*0.047,uSeed*2.0))*0.28;
          float d=smoothstep(1.02-cov,1.12-cov,n);
          float r=length(vW.xz-cameraPosition.xz);
          d*=1.0-smoothstep(900.0,1250.0,r);
          float a=d*uLayerA;
          if(a<0.004) discard;
          // éclairage : on compare le bruit vers le soleil (bords exposés clairs, revers dans l'ombre)
          vec2 sd=normalize(uSunDir.xz+vec2(1e-4))*16.0;
          float n2=rvFbm3(vec3((p+sd)*0.011,uSeed+uTime*0.01))*0.72+rvNoise(vec3((p+sd)*0.047,uSeed*2.0))*0.28;
          float lit=clamp(0.5+(n-n2)*4.5+0.3*(d-0.5),0.0,1.0);
          lit=mix(lit,1.0,0.25*smoothstep(0.0,0.5,uSunDir.y));
          vec3 col=mix(uShade,uLit,lit);
          float dist=length(cameraPosition-vW);
          col=mix(col,uFogColor,(1.0-exp(-dist*uFogDensity*0.5))*0.85);
          gl_FragColor=vec4(col,a);
        }`});
    const mesh=new THREE.Mesh(geo,m);mesh.position.y=L.y;mesh.renderOrder=12+i;mesh.frustumCulled=false;grp.add(mesh);   // après lanternes et flammes, couche basse → haute
    return m;
  });
  scene.add(grp);
  const _c=new THREE.Color();
  function update(cov,cam){
    CU.uCov.value=cov;CU.uCamY.value=cam.position.y;grp.visible=cov>0.001;
    // couleur des nuages : lumière du soleil de l'heure, ombre tirée du brouillard
    const c=TOD.cur;
    CU.uLit.value.copy(c.sunCol).lerp(_c.set('#ffffff'),0.55).multiplyScalar(Math.min(1.15,0.55+0.18*c.sunI)*c.lum+0.12);
    CU.uShade.value.copy(c.fog).lerp(c.hemiSky,0.5).multiplyScalar(0.74);
  }
  return {grp,update,CU,mats};
}

/* ═══ 33 · Éclatement de la glace (≥ 75 % pour un bloc, ≥ 50 % pour un livre) ═══
   Une centaine d'éclats de cristal (même verre que la glace) partent du cœur, tournoient dans
   l'espace sans pesanteur, ralentis par une traînée douce, puis s'évanouissent. Plusieurs
   éclatements peuvent se chevaucher (les éclats sont pris à tour de rôle dans une réserve).
   Au repos, le maillage garde un éclat invisible : son programme est compilé pendant le
   préchauffage (pas d'à-coup au premier éclatement). */
function buildShatter(parent,N,opts){
  N=N||(MOBILE?60:110);opts=opts||{};
  // éclat : icosaèdre facetté, déformé par instance (aiguilles, plaquettes, blocs)
  const g=new THREE.IcosahedronGeometry(1,0);g.computeVertexNormals();
  const mat=opts.mat||new THREE.MeshPhysicalMaterial({color:new THREE.Color('#ffd49a'),metalness:0,roughness:0.1,transmission:0.78,thickness:0.5,ior:1.54,
    attenuationColor:new THREE.Color('#e08a30'),attenuationDistance:0.9,specularIntensity:1,clearcoat:1,clearcoatRoughness:0.05,envMapIntensity:1.8,flatShading:true});
  const GRAV=opts.gravity||0,FLOOR=opts.floor===undefined?-1e9:opts.floor;const SZK=opts.size||1;
  const mesh=new THREE.InstancedMesh(g,mat,N);mesh.frustumCulled=false;mesh.renderOrder=3;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  parent.add(mesh);
  const S=[];for(let i=0;i<N;i++)S.push({p:new THREE.Vector3(),v:new THREE.Vector3(),q:new THREE.Quaternion(),w:new THREE.Vector3(),s:new THREE.Vector3(),life:1,t:-1});
  const DUR=2.8;let cur=0,active=0;
  const _m=new THREE.Matrix4(),_q=new THREE.Quaternion(),_e=new THREE.Euler(),_v=new THREE.Vector3(),_c=new THREE.Vector3();
  const zero=new THREE.Matrix4().makeScale(0,0,0);
  for(let i=0;i<N;i++)mesh.setMatrixAt(i,zero);
  mesh.instanceMatrix.needsUpdate=true;mesh.count=1;
  /* fire(centre, demi-axes, repère local→monde, nombre, vitesse) : éclats répartis dans l'ellipsoïde */
  function fire(center,half,content,count,speed){
    count=Math.min(N,count||N);speed=speed||1;
    content.updateMatrixWorld(true);parent.updateMatrixWorld(true);
    _c.copy(center);content.localToWorld(_c);parent.worldToLocal(_c);
    for(let n=0;n<count;n++){
      const o=S[cur];cur=(cur+1)%N;
      let d;do{d=new THREE.Vector3(rand()*2-1,rand()*2-1,rand()*2-1);}while(d.lengthSq()>1);
      const r=Math.pow(rand(),0.35);
      _v.set(center.x+d.x*half.x*r,center.y+d.y*half.y*r,center.z+d.z*half.z*r);content.localToWorld(_v);parent.worldToLocal(_v);
      o.p.copy(_v);
      const dir=_v.clone().sub(_c);if(dir.lengthSq()<1e-4)dir.set(rand()-0.5,rand()-0.5,rand()-0.5);dir.normalize();
      o.v.copy(dir).multiplyScalar((2.6+rand()*4.2)*speed).add(new THREE.Vector3(rand()-0.5,rand()*0.6,rand()-0.5).multiplyScalar(1.4*speed));
      o.q.setFromEuler(_e.set(rand()*6.28,rand()*6.28,rand()*6.28));
      o.w.set(rand()-0.5,rand()-0.5,rand()-0.5).multiplyScalar(9);
      const k=rand(),sz=(0.07+Math.pow(rand(),2.2)*0.34)*Math.min(1.2,0.5+0.5*Math.max(half.x,half.y))*SZK;
      if(k<0.3)o.s.set(sz*0.35,sz*1.9,sz*0.4);         // aiguilles
      else if(k<0.6)o.s.set(sz*1.4,sz*0.28,sz*1.1);     // plaquettes
      else o.s.set(sz,sz*0.8,sz*0.9);                   // blocs
      o.life=0.75+rand()*0.25;o.t=0;
    }
    mesh.count=N;
  }
  function update(dt){
    let any=false;const drag=Math.exp(-dt*1.35);
    for(let i=0;i<N;i++){
      const o=S[i];if(o.t<0)continue;
      o.t+=dt;const T=o.t/DUR;
      if(T>=1){o.t=-1;mesh.setMatrixAt(i,zero);continue;}
      any=true;
      o.v.multiplyScalar(drag);o.v.y-=GRAV*dt;o.p.addScaledVector(o.v,dt);
      if(o.p.y<FLOOR){o.p.y=FLOOR;o.v.y*=-0.25;o.v.x*=0.6;o.v.z*=0.6;o.w.multiplyScalar(0.5);}
      _q.setFromEuler(_e.set(o.w.x*dt,o.w.y*dt,o.w.z*dt));o.q.multiply(_q);o.w.multiplyScalar(Math.exp(-dt*0.6));
      const fade=1-smooth(0.45*o.life,o.life,T);
      _v.copy(o.s).multiplyScalar(Math.max(fade,0.0001));
      _m.compose(o.p,o.q,_v);mesh.setMatrixAt(i,_m);
    }
    if(any||active)mesh.instanceMatrix.needsUpdate=true;
    if(!any)mesh.count=1;
    active=any;
    return any;
  }
  return {mesh,fire,update,mat};
}

/* ═══ 34 · Les salles du temple (les cours) ═══
   Clic sur un bloc d'ambre (droit) ou sur l'objet de l'économie → on entre dans une salle de temple
   japonais : sol de tatamis (bordures de tissu), piliers de hinoki, linteaux, fusuma peints au
   lavis sur fond de nuées d'or (un thème par matière), imposte ajourée, alcôve (tokonoma) avec son
   rouleau suspendu et son ikebana, fenêtre ronde, murs de shōji éclairés par le jour, plafond à
   lattes, lanternes de papier.
   Un cours = un rouleau (makimono) posé sur un présentoir laqué : couverture de brocart, baguettes,
   cordon violet et sceau de papier. À 50 % du cours (ou après 3 h), le sceau se déchire (une seule
   fois), le rouleau se lève, se redresse et se déroule en partie : son titre apparaît, calligraphié.
   Clic : le rouleau se déroule entièrement, puis le cours s'ouvre.
   Même interface que les anciennes grottes (books, setSubject, update, pick, view…). */
const CAVE={on:false,k:0,sj:null,src:null,cv:null,kind:'',zone:'',hov:-1,panelHov:-1,n:0,list:null,saved:null};
const BOOK_COLS=['#7d1f27','#1f3b63','#25563f','#a5722a','#5c2b55','#1e5c63','#6e4b2c','#3d3f73'];
const BOOK_FREE=0.5;
const BOOK_BLANK=(()=>{const t=new THREE.DataTexture(new Uint8Array([232,222,200,255]),1,1);t.colorSpace=THREE.SRGBColorSpace;t.needsUpdate=true;return t;})();
function vn3(x,y,z){const h=(a,b,c)=>{let n=Math.sin(a*127.1+b*311.7+c*74.7)*43758.5453;return n-Math.floor(n);};
  const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z),fx=x-ix,fy=y-iy,fz=z-iz;const ux=fx*fx*(3-2*fx),uy=fy*fy*(3-2*fy),uz=fz*fz*(3-2*fz);
  const l=(a,b,t)=>a+(b-a)*t;
  return l(l(l(h(ix,iy,iz),h(ix+1,iy,iz),ux),l(h(ix,iy+1,iz),h(ix+1,iy+1,iz),ux),uy),l(l(h(ix,iy,iz+1),h(ix+1,iy,iz+1),ux),l(h(ix,iy+1,iz+1),h(ix+1,iy+1,iz+1),ux),uy),uz);}
function fbm3(x,y,z,o=3){let s=0,a=0.5;for(let i=0;i<o;i++){s+=a*vn3(x,y,z);x=x*2.03+5.1;y=y*2.03+1.7;z=z*2.03+9.3;a*=0.5;}return s;}

/* ── peinture au lavis (canvas) : papier bistre, nuées d'or, encre ── */
const TEMPLE_THEMES={1:'montagnes',2:'vagues',3:'pin',4:'bambou',5:'rizieres'};
function inkPaper(c,W,H,r,base){
  c.fillStyle=base||'#e8ddc6';c.fillRect(0,0,W,H);
  for(let k=0;k<W*H/260;k++){c.fillStyle='rgba(110,86,52,'+(0.015+r()*0.03).toFixed(3)+')';c.fillRect(r()*W,r()*H,1+r()*2.5,1+r()*2.5);}
  for(let k=0;k<W/40;k++){c.strokeStyle='rgba(150,120,80,'+(0.03+r()*0.04).toFixed(3)+')';c.lineWidth=0.6+r();c.beginPath();const x=r()*W,y=r()*H;c.moveTo(x,y);c.bezierCurveTo(x+r()*60-30,y+r()*60-30,x+r()*90-45,y+r()*90-45,x+r()*120-60,y+r()*120-60);c.stroke();}
}
function goldClouds(c,W,H,r,n){
  for(let k=0;k<n;k++){const y=r()*H,x=r()*W,w=W*(0.15+r()*0.3),h=H*(0.05+r()*0.06);
    const g=c.createLinearGradient(0,y-h,0,y+h);g.addColorStop(0,'rgba(214,170,78,0)');g.addColorStop(0.35,'rgba(214,170,78,0.62)');g.addColorStop(0.65,'rgba(196,150,60,0.62)');g.addColorStop(1,'rgba(214,170,78,0)');
    c.fillStyle=g;c.beginPath();c.moveTo(x-w/2,y);c.bezierCurveTo(x-w/2,y-h,x-w/4,y-h*1.2,x,y-h*0.9);c.bezierCurveTo(x+w/4,y-h*1.3,x+w/2,y-h,x+w/2,y);
    c.bezierCurveTo(x+w/2,y+h,x+w/4,y+h*1.1,x,y+h*0.8);c.bezierCurveTo(x-w/4,y+h*1.1,x-w/2,y+h,x-w/2,y);c.fill();}
}
function inkMountain(c,x0,x1,base,peak,dark,r,W){
  const pts=[];const N=60;const px=x0+(x1-x0)*(0.3+r()*0.4);
  for(let k=0;k<=N;k++){const t=k/N,x=x0+(x1-x0)*t;const d=Math.abs(x-px)/((x1-x0)*0.5);
    const y=base-(base-peak)*Math.max(0,1-Math.pow(d,1.3))*(0.85+0.15*Math.sin(t*23+r()*2))-Math.sin(t*41)*6*r();pts.push([x,y]);}
  const g=c.createLinearGradient(0,peak,0,base);g.addColorStop(0,'rgba(22,20,18,'+dark+')');g.addColorStop(0.55,'rgba(22,20,18,'+(dark*0.45).toFixed(3)+')');g.addColorStop(1,'rgba(22,20,18,0)');
  c.fillStyle=g;c.beginPath();c.moveTo(x0,base);pts.forEach(p=>c.lineTo(p[0],p[1]));c.lineTo(x1,base);c.closePath();c.fill();
  c.strokeStyle='rgba(18,16,15,'+Math.min(0.9,dark*1.25).toFixed(3)+')';
  for(let k=0;k<N;k++){c.lineWidth=1+3*Math.abs(Math.sin(k*0.7+r()));c.beginPath();c.moveTo(pts[k][0],pts[k][1]);c.lineTo(pts[k+1][0],pts[k+1][1]);c.stroke();}
  // rides de la roche (cun) : petits traits obliques sous la crête
  for(let k=0;k<N*1.4;k++){const p=pts[Math.floor(r()*N)];const L=8+r()*26;c.lineWidth=0.8+r()*1.6;c.strokeStyle='rgba(20,18,16,'+(dark*0.5*r()).toFixed(3)+')';
    c.beginPath();c.moveTo(p[0],p[1]+4+r()*30);c.lineTo(p[0]+(r()-0.5)*L,p[1]+10+r()*40+L);c.stroke();}
}
function inkMist(c,W,y,h){const g=c.createLinearGradient(0,y-h,0,y+h);g.addColorStop(0,'rgba(232,221,198,0)');g.addColorStop(0.5,'rgba(236,227,206,0.85)');g.addColorStop(1,'rgba(232,221,198,0)');c.fillStyle=g;c.fillRect(0,y-h,W,2*h);}
function inkPine(c,x,y,s,r){
  c.strokeStyle='rgba(20,17,14,0.9)';c.lineCap='round';
  let px=x,py=y;const tr=[];for(let k=0;k<14;k++){const nx=px+(Math.sin(k*0.6+r()*2)*14+(k>7?14:-6))*s,ny=py-26*s;tr.push([px,py,nx,ny]);px=nx;py=ny;}
  tr.forEach(([a,b,cc,d],k)=>{c.lineWidth=(18-k)*s*1.1;c.beginPath();c.moveTo(a,b);c.lineTo(cc,d);c.stroke();});
  for(let k=0;k<7;k++){const t=tr[4+Math.floor(r()*9)];const dir=r()<0.5?-1:1;const L=(60+r()*110)*s;
    c.lineWidth=4*s;c.beginPath();c.moveTo(t[2],t[3]);c.quadraticCurveTo(t[2]+dir*L*0.5,t[3]-10*s,t[2]+dir*L,t[3]+(r()*20-6)*s);c.stroke();
    const cx=t[2]+dir*L,cy=t[3]+4*s;
    for(let j=0;j<5;j++){const ex=cx+(r()-0.5)*60*s,ey=cy+(r()-0.5)*18*s;c.fillStyle='rgba(28,40,26,'+(0.35+r()*0.35).toFixed(2)+')';c.beginPath();c.ellipse(ex,ey,(26+r()*24)*s,(8+r()*6)*s,(r()-0.5)*0.4,0,Math.PI*2);c.fill();
      c.strokeStyle='rgba(20,30,18,0.5)';c.lineWidth=1;for(let q=0;q<10;q++){c.beginPath();c.moveTo(ex,ey);c.lineTo(ex+(r()-0.5)*50*s,ey-r()*14*s);c.stroke();}}}
}
function inkBamboo(c,x,y0,y1,w,r,dark){
  c.fillStyle='rgba(30,44,30,'+dark+')';const segs=Math.floor((y0-y1)/(70+r()*30));const sh=(y0-y1)/segs;
  for(let k=0;k<segs;k++){const ya=y0-k*sh,xa=x+Math.sin(k*0.3)*3;c.fillRect(xa-w/2,ya-sh+3,w,sh-6);
    c.fillStyle='rgba(20,30,20,'+(dark*1.1).toFixed(2)+')';c.fillRect(xa-w/2-2,ya-sh-1,w+4,4);c.fillStyle='rgba(30,44,30,'+dark+')';}
  for(let k=0;k<segs*1.6;k++){const ya=y0-r()*(y0-y1),dir=r()<0.5?-1:1,L=40+r()*70,an=(0.3+r()*0.6)*dir;
    c.fillStyle='rgba(22,34,22,'+(dark*(0.6+r()*0.4)).toFixed(2)+')';c.beginPath();c.moveTo(x,ya);
    c.quadraticCurveTo(x+Math.cos(an)*L*0.5*dir+6,ya+Math.sin(an)*L*0.4-6,x+Math.cos(an)*L*dir,ya+Math.sin(Math.abs(an))*L*0.6);
    c.quadraticCurveTo(x+Math.cos(an)*L*0.5*dir-4,ya+Math.sin(an)*L*0.4+6,x,ya);c.fill();}
}
function inkWaves(c,W,H,r){
  for(let row=0;row<6;row++){const y=H*0.42+row*H*0.1;const amp=26+row*6;
    c.strokeStyle='rgba(24,30,40,'+(0.35+row*0.1).toFixed(2)+')';c.lineWidth=2+row*0.6;
    for(let x=-60+row*37%80;x<W+60;x+=120+row*12){c.beginPath();c.moveTo(x,y);c.bezierCurveTo(x+30,y-amp*1.4,x+90,y-amp*1.2,x+110,y-amp*0.2);
      c.bezierCurveTo(x+96,y-amp*0.6,x+80,y-amp*0.5,x+76,y-amp*0.15);c.stroke();
      for(let k=0;k<4;k++){c.fillStyle='rgba(246,240,226,0.9)';c.beginPath();c.arc(x+96+k*5,y-amp*0.9+k*6,2.5,0,6.283);c.fill();}}}
  for(let k=0;k<3;k++){const x=W*(0.15+k*0.32+r()*0.08),y=H*0.62;inkMountain(c,x-120,x+120,y+70,y-60-r()*60,0.75,r,W);}
}
function inkTerraces(c,W,H,r){
  for(let k=0;k<11;k++){const y=H*(0.38+k*0.055);c.strokeStyle='rgba(30,40,30,'+(0.25+k*0.05).toFixed(2)+')';c.lineWidth=2;c.fillStyle='rgba(120,140,110,'+(0.06+k*0.012).toFixed(3)+')';
    c.beginPath();c.moveTo(0,y);for(let x=0;x<=W;x+=24)c.lineTo(x,y+Math.sin(x*0.004+k*1.3)*24+Math.sin(x*0.013+k)*6);c.lineTo(W,H);c.lineTo(0,H);c.closePath();c.fill();
    c.beginPath();c.moveTo(0,y);for(let x=0;x<=W;x+=24)c.lineTo(x,y+Math.sin(x*0.004+k*1.3)*24+Math.sin(x*0.013+k)*6);c.stroke();}
}
function inkSeal(c,x,y,s,txt){
  c.fillStyle='#b8261c';c.fillRect(x,y,s,s);c.fillStyle='rgba(246,238,222,0.95)';c.font='700 '+Math.round(s*0.36)+'px Georgia, serif';c.textAlign='center';c.textBaseline='middle';
  c.fillText(txt[0]||'R',x+s*0.3,y+s*0.3);c.fillText(txt[1]||'V',x+s*0.7,y+s*0.7);c.strokeStyle='rgba(246,238,222,0.8)';c.lineWidth=s*0.04;c.strokeRect(x+s*0.08,y+s*0.08,s*0.84,s*0.84);
}
function inkVertical(c,txt,x,y,size){c.fillStyle='rgba(18,15,13,0.88)';c.font='italic 600 '+size+'px Georgia, "Times New Roman", serif';c.textAlign='center';c.textBaseline='top';
  [...txt].forEach((ch,i)=>{if(ch!==' ')c.fillText(ch,x,y+i*size*1.02);});}
function paintFusuma(theme,name,seed){
  const W=2048,H=640;const cv=document.createElement('canvas');cv.width=W;cv.height=H;const c=cv.getContext('2d');const r=mulberry32(seed);
  inkPaper(c,W,H,r,'#e6dbc2');goldClouds(c,W,H,r,9);
  if(theme==='montagnes'){inkMountain(c,-100,900,H*0.95,H*0.18,0.85,r,W);inkMountain(c,600,1500,H*0.9,H*0.3,0.55,r,W);inkMountain(c,1250,2200,H*0.95,H*0.22,0.75,r,W);
    c.fillStyle='rgba(246,240,226,0.9)';c.fillRect(W*0.54,H*0.32,9,H*0.45);inkMist(c,W,H*0.74,60);inkMist(c,W,H*0.5,30);inkPine(c,W*0.18,H*0.98,0.55,r);}
  else if(theme==='vagues'){inkWaves(c,W,H,r);c.fillStyle='rgba(205,160,70,0.85)';c.beginPath();c.arc(W*0.8,H*0.2,62,0,6.283);c.fill();}
  else if(theme==='pin'){inkMountain(c,900,2100,H*0.9,H*0.45,0.35,r,W);inkMist(c,W,H*0.8,70);inkPine(c,W*0.3,H*1.02,1.0,r);
    c.fillStyle='rgba(205,160,70,0.85)';c.beginPath();c.arc(W*0.72,H*0.24,70,0,6.283);c.fill();
    c.strokeStyle='rgba(20,18,16,0.85)';c.lineWidth=3;c.beginPath();c.moveTo(W*0.6,H*0.4);c.quadraticCurveTo(W*0.62,H*0.35,W*0.64,H*0.4);c.quadraticCurveTo(W*0.66,H*0.35,W*0.68,H*0.4);c.stroke();}   // grue en vol
  else if(theme==='bambou'){for(let k=0;k<14;k++){const x=60+r()*(W-120);inkBamboo(c,x,H+20,-20,10+r()*12,r,(0.3+r()*0.55).toFixed(2));}inkMist(c,W,H*0.86,50);}
  else{inkMountain(c,-60,1200,H*0.6,H*0.15,0.45,r,W);inkMountain(c,900,2150,H*0.6,H*0.22,0.38,r,W);inkMist(c,W,H*0.52,40);inkTerraces(c,W,H,r);}
  {const t=name.replace(/[ ']/g,'');inkVertical(c,t,W-80,36,Math.min(46,Math.floor((H-200)/t.length/1.02)));}inkSeal(c,W-112,H-130,64,'RV');
  const t=new THREE.CanvasTexture(cv);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(16,renderer.capabilities.getMaxAnisotropy());return t;
}
function paintKakejiku(theme,seed){
  const W=320,H=960;const cv=document.createElement('canvas');cv.width=W;cv.height=H;const c=cv.getContext('2d');const r=mulberry32(seed);
  c.fillStyle='#5a4a3a';c.fillRect(0,0,W,H);c.fillStyle='#8a7350';c.fillRect(14,0,W-28,H);   // brocart du montage
  c.save();c.translate(36,120);inkPaper(c,W-72,H-260,r,'#ece2cc');
  if(theme==='bambou'||theme==='rizieres'){inkBamboo(c,(W-72)*0.5,H-260,0,12,r,'0.7');}
  else{c.fillStyle='rgba(205,160,70,0.8)';c.beginPath();c.arc((W-72)*0.62,140,42,0,6.283);c.fill();inkPine(c,(W-72)*0.25,H-260,0.42,r);}
  inkSeal(c,W-72-56,H-260-70,40,'RV');c.restore();
  const t=new THREE.CanvasTexture(cv);t.colorSpace=THREE.SRGBColorSpace;return t;
}

function buildBookCave(kind){
  const scn=new THREE.Scene();scn.background=new THREE.Color('#0b0907');
  const root=new THREE.Group();scn.add(root);
  const RW=7,ZB=-6,ZF=11.5,CH=5.6,LH=2.42;   // demi-largeur, mur du fond, mur avant, plafond, linteau
  const rr=mulberry32(kind==='sand'?913:517);
  const A=Math.min(16,renderer.capabilities.getMaxAnisotropy());

  /* — matériaux — */
  const hinoki=matCedar('troom','#fff1dc',{fl:0,wx:0,env:0.35});
  const dark=matCedar('troomd','#8a6a52',{fl:0,wx:0,env:0.35});
  const lacqU={uAcc:{value:new THREE.Color('#8e1f16')}},shojiU={uDay:{value:new THREE.Color('#fff0d6')}};
  const lacq=patch(new THREE.MeshStandardMaterial({color:new THREE.Color('#141010'),roughness:0.28,metalness:0,envMapIntensity:0.9}),{
    uniforms:lacqU,fHead:'uniform vec3 uAcc;',
    fColor:`{float w=smoothstep(0.55,0.8,rvFbm3(vRvW*6.0))*0.5+smoothstep(0.3,0.0,abs(vRvN.y))*0.0;diffuseColor.rgb=mix(diffuseColor.rgb,uAcc,w);}`},'troomlacq');
  const plaster=patch(new THREE.MeshStandardMaterial({color:new THREE.Color('#ffffff'),roughness:0.95,metalness:0,envMapIntensity:0.3}),{
    fColor:`{float n=rvFbm3(vRvW*0.9);vec3 c=mix(vec3(0.66,0.58,0.46),vec3(0.76,0.69,0.56),n)*mix(0.92,1.04,rvNoise(vRvW*12.0));
       c*=1.0-smoothstep(0.65,0.85,rvFbm3(vRvW*0.4+3.0))*0.12;diffuseColor.rgb=c;}`,
    fNormal:`normal=rvPerturb(-vViewPosition,normal,rvNoise(vRvW*9.0)*0.004,1.0);`},'troomplaster');
  const shojiM=patch(new THREE.MeshStandardMaterial({color:new THREE.Color('#e9e0cf'),map:tx('washi'),roughness:0.9,side:THREE.DoubleSide,emissive:new THREE.Color('#fff0d6'),emissiveIntensity:1}),{
    uniforms:shojiU,fHead:'uniform vec3 uDay;',
    fEmissive:`totalEmissiveRadiance=uDay*(1.15-texture2D(map,vMapUv).a*0.7)*0.62;`},'troomshoji');
  const washiL=patch(new THREE.MeshStandardMaterial({color:new THREE.Color('#d9cbb2'),map:tx('washi'),roughness:0.85,emissive:new THREE.Color('#ffb46a'),emissiveIntensity:1}),{
    fEmissive:`totalEmissiveRadiance*=texture2D(map,vMapUv).a*1.1*(0.93+0.07*sin(uTime*7.0+vRvW.x*3.0));`},'troomandon');
  const tatamiM=patch(new THREE.MeshStandardMaterial({color:new THREE.Color('#ffffff'),map:tx('tatami'),normalMap:tx('tatami_n'),normalScale:new THREE.Vector2(0.8,0.8),roughness:0.8,metalness:0,envMapIntensity:0.35}),{
    fHead:'vec2 rvTU=vec2(0.0);float rvHeri=0.0;float rvMt=0.0;',
    fDiscard:`{vec2 p=vRvW.xz+vec2(63.0,61.2);float row=floor(p.y/0.9);float off=mod(row,2.0)*0.9;float cx=(p.x+off)/1.8;float col=floor(cx);
       vec2 cc=vec2(fract(cx),fract(p.y/0.9));rvTU=vec2(cc.y*0.9,cc.x*1.8)/0.45;
       float e=cc.y*0.9;rvHeri=step(e,0.04)+step(0.86,e);rvMt=rvHash(vec3(row,col,3.0));}`,
    fColor:`{diffuseColor.rgb*=mix(0.86,1.06,rvMt)*mix(vec3(1.0),vec3(1.06,1.0,0.86),rvMt*0.6);
       vec3 heri=mix(vec3(0.06,0.07,0.1),vec3(0.12,0.12,0.16),step(0.5,fract(vRvW.x*12.0+vRvW.z*12.0)));diffuseColor.rgb=mix(diffuseColor.rgb,heri,clamp(rvHeri,0.0,1.0));}`,
    onShader:(sh)=>{const i=sh.fragmentShader.indexOf('void main()');sh.fragmentShader=sh.fragmentShader.slice(0,i)+sh.fragmentShader.slice(i).split('vMapUv').join('rvTU').split('vNormalMapUv').join('rvTU');}},'troomtatami');
  const fusuM=new THREE.MeshStandardMaterial({color:new THREE.Color('#857768'),map:BOOK_BLANK,roughness:0.82,metalness:0.0,envMapIntensity:0.4});
  const kakeM=new THREE.MeshStandardMaterial({color:new THREE.Color('#ffffff'),map:BOOK_BLANK,roughness:0.85});
  const brassM=new THREE.MeshStandardMaterial({color:new THREE.Color('#b8924c'),roughness:0.35,metalness:1});
  const ceramM=patch(new THREE.MeshStandardMaterial({color:new THREE.Color('#3a4a4c'),roughness:0.25,metalness:0}),{
    fColor:`diffuseColor.rgb=mix(vec3(0.16,0.24,0.26),vec3(0.42,0.5,0.46),smoothstep(0.3,0.8,rvFbm3(vRvW*7.0)));`},'troomceram');
  const leafM=new THREE.MeshStandardMaterial({color:new THREE.Color('#3b5a2a'),roughness:0.6,side:THREE.DoubleSide});
  const flowerM=new THREE.MeshStandardMaterial({color:new THREE.Color('#d8576a'),roughness:0.5,emissive:new THREE.Color('#401018'),emissiveIntensity:0.3});

  const P={hin:[],dark:[],lacq:[],plaster:[],shoji:[],washi:[],brass:[],ceram:[],leaf:[],flower:[]};
  const bx=(list,w,h,d,x,y,z,ax,r)=>{let g=new RoundedBoxGeometry(w,h,d,2,r===undefined?0.01:r);if(ax!==undefined&&ax>=0)g=rvWoodUV(g,ax,0.7,rr()*7);g.translate(x,y,z);list.push(g);return g;};
  const plane=(list,w,h,x,y,z,ry,uvs)=>{const g=new THREE.PlaneGeometry(w,h);if(uvs){const u=g.attributes.uv;for(let k=0;k<u.count;k++)u.setXY(k,u.getX(k)*uvs[0],u.getY(k)*uvs[1]);}g.rotateY(ry||0);g.translate(x,y,z);list.push(g);return g;};

  /* — sol de tatamis, seuils — */
  {const g=new THREE.PlaneGeometry(2*RW,ZF-ZB);g.rotateX(-Math.PI/2);g.translate(0,0,(ZF+ZB)/2);const m=new THREE.Mesh(g,tatamiM);root.add(m);}
  /* — murs de plâtre (au-dessus des linteaux, et pans pleins) — */
  plane(P.plaster,2*RW,CH-LH,0,(CH+LH)/2,ZB+0.01,0);
  plane(P.plaster,ZF-ZB,CH-LH,-RW+0.01,(CH+LH)/2,(ZF+ZB)/2,Math.PI/2);plane(P.plaster,ZF-ZB,CH-LH,RW-0.01,(CH+LH)/2,(ZF+ZB)/2,-Math.PI/2);
  plane(P.plaster,2*RW,CH,0,CH/2,ZF-0.01,Math.PI);
  plane(P.plaster,RW-4.4,LH,(RW+4.4)/2,LH/2,ZB+0.01,0);   // pan plein à droite du fond (fenêtre ronde)
  /* — piliers, linteaux (kamoi), nageshi, seuils (shikii) — */
  const posts=[[-RW+0.08,ZB+0.08],[RW-0.08,ZB+0.08],[-4.4,ZB+0.08],[4.4,ZB+0.08],[-RW+0.08,ZF-0.08],[RW-0.08,ZF-0.08]];
  for(let z=ZB+3.6;z<ZF-0.5;z+=3.6){posts.push([-RW+0.08,z],[RW-0.08,z]);}
  posts.forEach(([x,z])=>bx(P.hin,0.16,CH,0.16,x,CH/2,z,1,0.01));
  for(const y of [LH,LH+0.32]){const h=y===LH?0.1:0.14;bx(P.hin,2*RW,h,0.1,0,y,ZB+0.06,0);bx(P.hin,0.1,h,ZF-ZB,-RW+0.06,y,(ZF+ZB)/2,2);bx(P.hin,0.1,h,ZF-ZB,RW-0.06,y,(ZF+ZB)/2,2);}
  bx(P.hin,2*RW,0.05,0.1,0,0.025,ZB+0.06,0);bx(P.hin,0.1,0.05,ZF-ZB,-RW+0.06,0.025,(ZF+ZB)/2,2);bx(P.hin,0.1,0.05,ZF-ZB,RW-0.06,0.025,(ZF+ZB)/2,2);
  /* — plafond à lattes (saobuchi) — */
  {const g=new THREE.PlaneGeometry(2*RW,ZF-ZB);g.rotateX(Math.PI/2);g.translate(0,CH,(ZF+ZB)/2);P.hin.push(rvWoodUV(g,0,0.9,1.7));
   for(let z=ZB+0.45;z<ZF;z+=0.45)bx(P.dark,2*RW,0.05,0.05,0,CH-0.03,z,0,0.005);
   bx(P.dark,2*RW,0.12,0.14,0,CH-0.06,ZB+0.1,0);bx(P.dark,0.14,0.12,ZF-ZB,-RW+0.1,CH-0.06,(ZF+ZB)/2,2);bx(P.dark,0.14,0.12,ZF-ZB,RW-0.1,CH-0.06,(ZF+ZB)/2,2);}
  /* — fusuma peints (quatre vantaux), cadres laqués, poignées ; imposte ajourée — */
  const FW=8.8,FX=0;
  for(const sg of [-1,1]){const g=new THREE.PlaneGeometry(3.3,LH-0.06),uv=g.attributes.uv;for(let i=0;i<uv.count;i++)uv.setX(i,sg<0?uv.getX(i)*0.375:0.625+uv.getX(i)*0.375);g.translate(sg*2.75,(LH-0.06)/2+0.03,ZB+0.03);root.add(new THREE.Mesh(g,fusuM));}
  for(const x of [-4.4,-2.2,-1.1,1.1,2.2,4.4]){bx(P.lacq,0.05,LH-0.06,0.04,x,LH/2,ZB+0.05,-1,0.008);}
  bx(P.lacq,FW,0.05,0.04,FX,LH-0.05,ZB+0.05,-1,0.008);bx(P.lacq,FW,0.05,0.04,FX,0.06,ZB+0.05,-1,0.008);
  for(let k=0;k<4;k++){const x=FX-FW/2+(k+0.5)*FW/4+(k%2?-1:1)*0.82;const h=new THREE.CylinderGeometry(0.045,0.045,0.012,20);h.rotateX(Math.PI/2);h.translate(x,1.0,ZB+0.06);P.brass.push(h);}
  {const y0=LH+0.08,y1=LH+0.3;for(let x=-4.3;x<=4.31;x+=0.18)bx(P.dark,0.025,y1-y0,0.03,x,(y0+y1)/2,ZB+0.06,1,0.004);
   for(const y of [y0,y1])bx(P.dark,8.6,0.03,0.035,0,y,ZB+0.06,0,0.004);}
  /* — tokonoma : alcôve à gauche (toko-bashira, toko-ita laqué, rouleau suspendu, ikebana) — */
  {const x0=-RW+0.16,x1=-4.48,d=0.9;
   plane(P.plaster,x1-x0,LH,(x0+x1)/2,LH/2,ZB-d+0.01,0);plane(P.plaster,d,LH,x0,LH/2,ZB-d/2,Math.PI/2);plane(P.plaster,d,LH,x1,LH/2,ZB-d/2,-Math.PI/2);
   bx(P.lacq,x1-x0,0.14,d,(x0+x1)/2,0.07,ZB-d/2,-1,0.01);
   bx(P.dark,x1-x0,0.12,0.1,(x0+x1)/2,LH-0.3,ZB-0.05,0,0.01);   // otoshigake
   {const g=new THREE.PlaneGeometry(0.62,1.75);g.translate((x0+x1)/2,1.35,ZB-d+0.04);const m=new THREE.Mesh(g,kakeM);root.add(m);}
   bx(P.dark,0.72,0.035,0.035,(x0+x1)/2,2.24,ZB-d+0.06,0,0.01);bx(P.dark,0.72,0.04,0.04,(x0+x1)/2,0.46,ZB-d+0.06,0,0.015);
   const vx=(x0+x1)/2+0.55,vz=ZB-d/2+0.05;
   P.ceram.push(new THREE.LatheGeometry([[0,0],[0.11,0],[0.13,0.05],[0.12,0.2],[0.07,0.32],[0.06,0.38],[0.075,0.42],[0,0.42]].map(p=>new THREE.Vector2(p[0],p[1])),24).translate(vx,0.14,vz));
   for(let k=0;k<5;k++){const a=k*1.3,h=0.5+rr()*0.5;const pts=[new THREE.Vector3(vx,0.5,vz),new THREE.Vector3(vx+Math.cos(a)*0.12,0.5+h*0.5,vz+Math.sin(a)*0.06),new THREE.Vector3(vx+Math.cos(a)*0.3,0.5+h,vz+Math.sin(a)*0.1)];
     const cu=new THREE.CatmullRomCurve3(pts);P.dark.push(new THREE.TubeGeometry(cu,12,0.008,5,false));
     const tip=cu.getPoint(1);const f=new THREE.SphereGeometry(0.035,8,6);f.translate(tip.x,tip.y,tip.z);P.flower.push(f);
     for(let j=0;j<3;j++){const p=cu.getPoint(0.4+j*0.2);const l=new THREE.PlaneGeometry(0.07,0.03);l.rotateZ(rr()*3);l.rotateY(rr()*3);l.translate(p.x,p.y,p.z);P.leaf.push(l);}}}
  /* — fenêtre ronde (marumado) à droite du fond : cadre, papier lumineux, croisillons — */
  {const cx=5.7,cy=1.55,R=0.72;const ring=new THREE.TorusGeometry(R,0.06,10,48);ring.translate(cx,cy,ZB+0.05);P.dark.push(ring);
   const disc=new THREE.CircleGeometry(R,48);const du=disc.attributes.uv;for(let k=0;k<du.count;k++)du.setXY(k,du.getX(k)*1.6,du.getY(k)*1.6);disc.translate(cx,cy,ZB+0.025);P.shoji.push(disc);
   for(let k=-3;k<=3;k++){const L=2*Math.sqrt(Math.max(0,R*R-(k*0.2)*(k*0.2)));bx(P.dark,0.022,L,0.025,cx+k*0.2,cy,ZB+0.045,1,0.004);bx(P.dark,L,0.022,0.025,cx,cy+k*0.2,ZB+0.045,0,0.004);}}
  /* — murs de shōji (côtés) : panneaux, cadres, petits bois — */
  for(const sx of [-1,1]){const x=sx*(RW-0.04);
    for(let z=ZB+0.2;z<ZF-0.3;z+=0.9){const zc=z+0.45,wp=0.88,hp=LH-0.06;
      plane(P.shoji,wp,hp,x,hp/2+0.03,zc,sx>0?-Math.PI/2:Math.PI/2,[wp/0.9,hp/0.9]);
      for(const dz of [-1,1])bx(P.hin,0.05,hp,0.04,x-sx*0.02,hp/2+0.03,zc+dz*wp/2,1,0.004);
      for(let k=1;k<3;k++)bx(P.hin,0.02,hp,0.02,x-sx*0.02,hp/2+0.03,zc-wp/2+k*wp/3,1,0.003);
      for(let k=1;k<7;k++)bx(P.hin,0.02,0.02,wp,x-sx*0.02,0.03+k*hp/7,zc,2,0.003);
      bx(P.hin,0.05,0.3,wp,x-sx*0.025,0.18,zc,2,0.004);}}   // soubassement de bois des shōji
  /* — lanternes de papier (andon) — */
  const andons=[[-5.6,-3.6],[5.0,-4.0],[-5.9,4.5],[5.9,4.0]];
  andons.forEach(([ax,az])=>{const h=1.0;for(const dx of [-1,1])for(const dz of [-1,1])bx(P.dark,0.04,h,0.04,ax+dx*0.22,h/2,az+dz*0.22,1,0.005);
    for(const y of [0.06,h-0.03])bx(P.dark,0.5,0.04,0.5,ax,y,az,0,0.008);
    const w=new THREE.BoxGeometry(0.42,h-0.2,0.42);const wu=w.attributes.uv;for(let k=0;k<wu.count;k++)wu.setXY(k,wu.getX(k)*0.8,wu.getY(k)*1.5);w.translate(ax,h/2,az);P.washi.push(w);});

  const mats={hin:hinoki,dark,lacq,plaster,shoji:shojiM,washi:washiL,brass:brassM,ceram:ceramM,leaf:leafM,flower:flowerM};
  for(const k in P){if(!P[k].length)continue;root.add(new THREE.Mesh(rvMerge(P[k]),mats[k]));}

  /* — lumières (aucune ombre : la salle coûte peu, on la rend presque à la définition native) — */
  const lights=[];
  const hemi=new THREE.HemisphereLight(new THREE.Color('#fff2dc'),new THREE.Color('#5a4430'),0.018);root.add(hemi);hemi.userData.caveI=hemi.intensity;lights.push(hemi);
  const sunL=new THREE.DirectionalLight(new THREE.Color('#ffb070'),0.035);sunL.position.set(-8,6,3);sunL.target.position.set(0,0,-1);root.add(sunL);root.add(sunL.target);sunL.userData.caveI=sunL.intensity;lights.push(sunL);
  const fillL=new THREE.DirectionalLight(new THREE.Color('#fff4e6'),0.01);fillL.position.set(3,4,9);fillL.target.position.set(0,1,-2);root.add(fillL);root.add(fillL.target);fillL.userData.caveI=fillL.intensity;lights.push(fillL);
  andons.slice(0,2).forEach(([ax,az])=>{const L=new THREE.PointLight(new THREE.Color('#ffb46a'),0,7,1.6);L.position.set(ax,0.7,az);L.userData.caveI=1.8;L.userData.ph=rr()*6;root.add(L);lights.push(L);});

  /* — rouleaux et présentoirs — */
  const paperM=new THREE.MeshStandardMaterial({color:new THREE.Color('#efe6d2'),roughness:0.85,side:THREE.DoubleSide});
  const sealM=patch(new THREE.MeshStandardMaterial({color:new THREE.Color('#f1ead9'),roughness:0.8}),{
    vHead:'varying vec2 vRvU;',vMain:'vRvU=uv;',fHead:'varying vec2 vRvU;',
    fColor:`{vec2 q=vec2(fract(vRvU.x*2.0)-0.5,vRvU.y-0.5);float s=step(max(abs(q.x)*1.4,abs(q.y)),0.28);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.68,0.12,0.09),s);}`},'scrollseal');
  const cordM=new THREE.MeshStandardMaterial({color:new THREE.Color('#5a2c6e'),roughness:0.7});
  const rodM=new THREE.MeshStandardMaterial({color:new THREE.Color('#e8dcc0'),roughness:0.35,metalness:0.1});
  const shardM=new THREE.MeshStandardMaterial({color:new THREE.Color('#f2eadb'),roughness:0.9,side:THREE.DoubleSide,flatShading:true});
  const shat=buildShatter(root,MOBILE?50:90,{mat:shardM,gravity:1.6,floor:0.02,size:0.32});
  const brocade=(col)=>patch(new THREE.MeshStandardMaterial({color:new THREE.Color(col),roughness:0.55,metalness:0.15,emissive:new THREE.Color('#000000')}),{
    vHead:'varying vec2 vRvU;',vMain:'vRvU=uv;',fHead:'varying vec2 vRvU;',
    fColor:`{vec2 p=vec2(vRvU.x*18.0,vRvU.y*7.0);vec2 h=vec2(1.0,1.732);vec2 a=mod(p,h)-h*0.5,b=mod(p-h*0.5,h)-h*0.5;vec2 g=dot(a,a)<dot(b,b)?a:b;   // écailles de tortue (kikkō)
       float hx=max(abs(g.x)*0.866+abs(g.y)*0.5,abs(g.y));float line=smoothstep(0.43,0.47,hx);float dot2=smoothstep(0.16,0.12,length(g));
       diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.86,0.68,0.32),max(line*0.85,dot2*0.7));}`},'brocade');
  const LMAX=1.3,SH=0.7,RR=0.088;
  function coverTex(col,title,sub,idx){
    const W=1600,H=860;const cv=document.createElement('canvas');cv.width=W;cv.height=H;const c=cv.getContext('2d');const r=mulberry32(idx*31+7);
    inkPaper(c,W,H,r,'#ede3cd');
    c.fillStyle=col;c.globalAlpha=0.9;c.fillRect(0,0,70,H);c.globalAlpha=1;   // garde de soie, côté baguette
    c.fillStyle='rgba(18,15,13,0.9)';c.textAlign='left';c.textBaseline='alphabetic';
    c.font='600 34px "JetBrains Mono", ui-monospace, monospace';c.fillText('COURS '+String(idx+1).padStart(2,'0'),130,120);
    c.fillRect(130,140,120,3);
    c.font='italic 600 78px Georgia, "Times New Roman", serif';
    const words=String(title).split(' ');let line='';const lines=[];
    words.forEach(w=>{const t=line?line+' '+w:w;if(c.measureText(t).width>560&&line){lines.push(line);line=w;}else line=t;});if(line)lines.push(line);
    lines.slice(0,5).forEach((l,i)=>c.fillText(l,130,250+i*92));
    c.font='500 26px "JetBrains Mono", ui-monospace, monospace';c.fillStyle='rgba(60,46,34,0.85)';c.fillText(sub,130,H-90);
    inkSeal(c,600,H-190,70,'RV');
    // à droite : paysage au lavis (n'apparaît qu'en déroulant)
    c.save();c.translate(760,0);inkMountain(c,0,840,H*0.92,H*0.25,0.6,r,840);inkMist(c,840,H*0.7,60);inkPine(c,140,H*0.98,0.5,r);c.restore();
    const t=new THREE.CanvasTexture(cv);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=A;return t;
  }
  function makeBook(i){
    const holder=new THREE.Group();
    const g=new THREE.Group();holder.add(g);   // le rouleau : axe vertical (y) quand il est déroulé ; couché sur le présentoir au repos
    const edgeM=brocade(BOOK_COLS[i%BOOK_COLS.length]);
    const coverM=new THREE.MeshStandardMaterial({color:0xffffff,roughness:0.85,metalness:0,map:BOOK_BLANK,side:THREE.DoubleSide,emissive:new THREE.Color('#ffe2a8'),emissiveIntensity:0});
    const roll=new THREE.Group();g.add(roll);
    roll.add(new THREE.Mesh(new THREE.CylinderGeometry(RR,RR,SH+0.04,28),edgeM));
    for(const sy of [-1,1]){const rod=new THREE.Mesh(new THREE.CylinderGeometry(0.026,0.026,0.07,14),rodM);rod.position.y=sy*(SH/2+0.055);roll.add(rod);
      const cap=new THREE.Mesh(new THREE.CylinderGeometry(0.034,0.03,0.025,14),brassM);cap.position.y=sy*(SH/2+0.095);roll.add(cap);}
    const endRod=new THREE.Group();g.add(endRod);   // baguette d'extrémité (hassō) : rejoint le rouleau quand tout est enroulé
    endRod.add(new THREE.Mesh(new THREE.CylinderGeometry(0.012,0.012,SH+0.06,8),rodM));
    const sheet=new THREE.Mesh(new THREE.PlaneGeometry(1,SH),coverM);g.add(sheet);   // toujours dans la scène (compilé au préchauffage), réduit à rien quand tout est enroulé
    // scellé : deux tours de cordon violet, nœud, glands, et une bande de papier au cachet rouge
    const chunk=new THREE.Group();roll.add(chunk);
    for(const y of [-0.13,0.13]){const t=new THREE.Mesh(new THREE.TorusGeometry(RR+0.004,0.006,6,28),cordM);t.rotation.x=Math.PI/2;t.position.y=y;chunk.add(t);}
    {const k=new THREE.Mesh(new THREE.SphereGeometry(0.018,8,6),cordM);k.position.set(0,0.13,RR+0.01);chunk.add(k);
     for(const s of [-1,1]){const tl=new THREE.Mesh(new THREE.CylinderGeometry(0.006,0.012,0.16,6),cordM);tl.position.set(s*0.02,0.05,RR+0.02);tl.rotation.z=s*0.2;chunk.add(tl);}
     const band=new THREE.Mesh(new THREE.CylinderGeometry(RR+0.002,RR+0.002,0.07,28,1,true),sealM);band.position.y=-0.02;chunk.add(band);}
    // présentoir laqué (jikudai) : socle, deux montants à berceau, traverse
    const pg=[];const bb=(w,h,d,x,y,z)=>{const q=new RoundedBoxGeometry(w,h,d,2,0.012);q.translate(x,y,z);pg.push(q);};
    bb(0.95,0.06,0.42,0,0.03,0);bb(0.85,0.03,0.34,0,0.075,0);
    for(const sx of [-1,1]){bb(0.06,0.78,0.07,sx*0.33,0.47,0);bb(0.12,0.05,0.12,sx*0.33,0.88,0);
      const cr=new THREE.TorusGeometry(0.075,0.014,8,16,Math.PI);cr.rotateZ(Math.PI);cr.rotateY(Math.PI/2);cr.translate(sx*0.33,0.97,0);pg.push(cr);}
    bb(0.66,0.035,0.035,0,0.45,0);
    const ped=new THREE.Mesh(rvMerge(pg),lacq);ped.scale.setScalar(1.25);
    return {holder,g,roll,endRod,sheet,coverM,edgeM,pages:sheet,hinge:roll,chunk,ped,tex:null,free:0,burst:0,hov:0,c:null,op:0,L:0};
  }
  const books=[];
  for(let i=0;i<8;i++){const b=makeBook(i);root.add(b.holder);root.add(b.ped);b.holder.visible=b.ped.visible=false;books.push(b);}
  /* ══════════ Temple : fenêtre au dragon, lumière qui traverse l'air, décor, vie ══════════ */
  const FXT=[],SHAFTS=[];
  { const S_=(c,r,o)=>new THREE.MeshStandardMaterial(Object.assign({color:new THREE.Color(c),roughness:r==null?0.8:r},o||{}));
    const B_=(w,h,d,m)=>new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m),Cy=(rt,rb,h,m,s)=>new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,s||14),m),Sp=(r,m,a,b)=>new THREE.Mesh(new THREE.SphereGeometry(r,a||14,b||10),m);
    const put=(o,x,y,z,ry,par)=>{o.position.set(x,y,z);if(ry)o.rotation.y=ry;(par||root).add(o);return o;};
    const cvTex=(W,H,draw)=>{const c=document.createElement('canvas');c.width=W;c.height=H;draw(c.getContext('2d'),W,H);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;};
    const beamM=S_('#2a1a10',0.72),postM=S_('#3a2416',0.7),redL=S_('#7c1612',0.32),blackL=S_('#100d0d',0.28),gold=S_('#c9a24a',0.35,{metalness:0.85}),steel=S_('#b9bdc6',0.22,{metalness:0.9}),porc=S_('#e9e6dc',0.25),indigo=S_('#1c2a55',0.9),crim=S_('#7a1a22',0.9),fur=S_('#d8cfc0',0.95),fur2=S_('#3a342e',0.95),pinkM=new THREE.MeshBasicMaterial({color:new THREE.Color(1.5,0.75,0.9)});
    /* — charpente apparente et soubassement de bois — */
    for(const z of [-4.2,-1.2,1.8,4.8,7.8])put(B_(RW*2,0.32,0.28,beamM),0,CH-0.2,z);
    for(const x of [-3.5,3.5])put(B_(0.26,0.3,ZF-ZB,beamM),x,CH-0.5,(ZF+ZB)/2);
    for(const z of [-5.7,-2.7,0.3,3.3,6.3]){put(B_(0.24,CH,0.24,postM),-RW+0.14,CH/2,z);for(let k=0;k<3;k++)put(B_(0.5-k*0.1,0.09,0.34-k*0.04,beamM),-RW+0.3,CH-0.42-k*0.1,z);}
    put(B_(RW*2,0.14,0.5,postM),0,0.07,ZB+0.27);put(B_(0.5,0.14,ZF-ZB,postM),-RW+0.27,0.07,(ZF+ZB)/2);
    /* — fenêtres hautes à treillis (kumiko) sur le mur de gauche : papier chaud, quelques carreaux à peine teintés — */
    const WINZ=[5.2,2.7,0.2,-2.3,-4.6],WW=1.5,WY0=LH+0.55,WY1=CH-0.55,WXL=-RW+0.07;
    const kumiT=cvTex(256,256,(c,W,H)=>{c.fillStyle='#ecd9b0';c.fillRect(0,0,W,H);const nx=5,ny=6,cw=W/nx,ch=H/ny;let sd=11;const rn=()=>(sd=(sd*16807)%2147483647)/2147483647;
      for(let i=0;i<nx;i++)for(let k=0;k<ny;k++){const r=rn();if(r<0.2){c.fillStyle=['#c9d6c0','#d9c2b6','#c2cbd8','#e4c98a'][(rn()*4)|0];c.fillRect(i*cw,k*ch,cw,ch);}}
      c.strokeStyle='#140c07';c.lineWidth=2.2;for(let i=0;i<nx;i++)for(let k=0;k<ny;k++){const x=i*cw,y=k*ch;c.beginPath();c.moveTo(x,y);c.lineTo(x+cw,y+ch);c.moveTo(x+cw,y);c.lineTo(x,y+ch);c.moveTo(x+cw/2,y);c.lineTo(x+cw/2,y+ch);c.stroke();}
      c.lineWidth=7;for(let i=0;i<=nx;i++){c.beginPath();c.moveTo(i*cw,0);c.lineTo(i*cw,H);c.stroke();}for(let k=0;k<=ny;k++){c.beginPath();c.moveTo(0,k*ch);c.lineTo(W,k*ch);c.stroke();}c.lineWidth=20;c.strokeRect(0,0,W,H);});
    const winM=new THREE.MeshBasicMaterial({map:kumiT,color:new THREE.Color(1.25,1.02,0.74)});
    for(const z of WINZ){const p=new THREE.Mesh(new THREE.PlaneGeometry(WW,WY1-WY0),winM);p.rotation.y=Math.PI/2;put(p,WXL,(WY0+WY1)/2,z);put(B_(0.14,0.1,WW+0.2,beamM),WXL,WY0-0.05,z);put(B_(0.14,0.1,WW+0.2,beamM),WXL,WY1+0.05,z);}
    { const n=110,im=new THREE.InstancedMesh(new THREE.BoxGeometry(0.035,CH-LH-0.75,0.05),beamM,n),m4=new THREE.Matrix4();for(let i=0;i<n;i++){m4.makeTranslation(-RW+0.4+i*(RW*2-0.8)/(n-1),(LH+CH)/2-0.1,ZB+0.12);im.setMatrixAt(i,m4);}root.add(im);
      put(B_(RW*2,0.12,0.14,beamM),0,LH+0.22,ZB+0.12);put(B_(RW*2,0.12,0.14,beamM),0,CH-0.42,ZB+0.12);for(const x of [-4.6,-2.3,0,2.3,4.6])put(B_(0.16,CH-LH,0.16,postM),x,(LH+CH)/2,ZB+0.12); }
    /* — porte coulissante entrouverte (mur de gauche) : le couchant passe par la fente — */
    const GZ0=2.15,GZ1=2.95,GY1=2.28,GX=-RW+0.07;
    const sunsetT=cvTex(64,256,(c,W,H)=>{const g=c.createLinearGradient(0,0,0,H);g.addColorStop(0,'#ffcf7a');g.addColorStop(0.45,'#ff8a2e');g.addColorStop(1,'#c23a18');c.fillStyle=g;c.fillRect(0,0,W,H);c.fillStyle='#1a0d06';c.fillRect(0,0,4,H);c.fillRect(W-4,0,4,H);});
    const gp=new THREE.Mesh(new THREE.PlaneGeometry(GZ1-GZ0,GY1),new THREE.MeshBasicMaterial({map:sunsetT,color:new THREE.Color(1.3,1.0,0.8)}));gp.rotation.y=Math.PI/2;put(gp,GX,GY1/2+0.02,(GZ0+GZ1)/2);
    /* — faisceau volumétrique : la fenêtre étirée le long des rayons jusqu'au sol ; chaque point de l'air prend la couleur du carreau
         qu'il voit, le treillis y dessine ses ombres ; la même image se projette, déformée, sur les tatamis — */
    function mkShaft(O,Ux,Uy,d,tex,gain,decK){
      const cs=[O,O.clone().add(Ux),O.clone().add(Uy),O.clone().add(Ux).add(Uy)],fl=cs.map(c=>c.clone().addScaledVector(d,c.y/(-d.y)));
      const bb=new THREE.Box3().setFromPoints(cs.concat(fl)).expandByScalar(0.03),sz=bb.getSize(new THREE.Vector3()),ct=bb.getCenter(new THREE.Vector3());
      const M=new THREE.Matrix3().set(Ux.x,Uy.x,d.x,Ux.y,Uy.y,d.y,Ux.z,Uy.z,d.z).invert();
      const u={uK:{value:0},uG:{value:gain},uTex:{value:tex},uInv:{value:M},uO:{value:O.clone()},uMin:{value:bb.min.clone()},uMax:{value:bb.max.clone()},uTime:U.uTime,uN3:U.uN3};
      const m=new THREE.Mesh(new THREE.BoxGeometry(sz.x,sz.y,sz.z),new THREE.ShaderMaterial({uniforms:u,transparent:true,depthWrite:false,depthTest:false,blending:THREE.AdditiveBlending,side:THREE.BackSide,defines:{BSTEPS:MOBILE?12:26},
        vertexShader:`varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.0);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
        fragmentShader:'#define RV_FRAG\n'+GLSL_NOISE+`uniform float uK;uniform float uG;uniform float uTime;uniform sampler2D uTex;uniform mat3 uInv;uniform vec3 uO;uniform vec3 uMin;uniform vec3 uMax;varying vec3 vW;
          void main(){vec3 ro=cameraPosition,rd=vW-cameraPosition+vec3(1e-5);float dl=length(rd);
            vec3 iv=1.0/rd,ta=(uMin-ro)*iv,tb=(uMax-ro)*iv,tn=min(ta,tb);float t0=max(max(tn.x,tn.y),max(tn.z,0.0));if(t0>=1.0)discard;
            float dt=(1.0-t0)/float(BSTEPS),j=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(0.06711056,0.00583715))));vec3 acc=vec3(0.0);
            for(int i=0;i<BSTEPS;i++){vec3 p=ro+rd*(t0+(float(i)+j)*dt);if(p.y<0.0)continue;vec3 q=uInv*(p-uO);if(q.x<0.0||q.x>1.0||q.y<0.0||q.y>1.0||q.z<0.0)continue;
              vec3 c=texture2D(uTex,q.xy,1.2).rgb;float dust=0.16+1.7*rvNoise(vec3(p.x*0.8,p.y*0.8+uTime*0.04,p.z*0.8+uTime*0.025));dust*=dust*1.1;
              acc+=c*c*dust*exp(-q.z*0.05);}
            vec3 A=min(acc*dt*dl*uG*uK,vec3(1.4));if(max(A.r,max(A.g,A.b))<0.002)discard;gl_FragColor=vec4(A,1.0);}`}));
      m.position.copy(ct);m.renderOrder=7;m.frustumCulled=false;m.visible=false;root.add(m);
      const dg=new THREE.BufferGeometry();dg.setAttribute('position',new THREE.Float32BufferAttribute(fl.flatMap(p=>[p.x,0.022,p.z]),3));dg.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,0,1,1,1],2));dg.setIndex([0,1,2,2,1,3]);
      const dm=new THREE.MeshBasicMaterial({map:tex,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,color:new THREE.Color(0,0,0)});
      const dec=new THREE.Mesh(dg,dm);dec.renderOrder=5;dec.frustumCulled=false;root.add(dec);
      SHAFTS.push({m,u,dm,decK,k:0});}
    const SUND=new THREE.Vector3(0.74,-0.6,-0.3).normalize();
    for(const z of WINZ)mkShaft(new THREE.Vector3(WXL+0.02,WY0,z+WW/2),new THREE.Vector3(0,0,-WW),new THREE.Vector3(0,WY1-WY0,0),SUND,kumiT,0.19,0.4);
    mkShaft(new THREE.Vector3(GX+0.02,0.04,GZ1),new THREE.Vector3(0,0,GZ0-GZ1),new THREE.Vector3(0,GY1,0),new THREE.Vector3(0.87,-0.22,-0.43).normalize(),sunsetT,0.12,0.36);
    /* — reflets des panneaux éclairés sur le sol : une nappe colorée au pied du mur du fond, une lueur chaude le long des shōji — */
    const gradT=cvTex(256,64,(c,W,H)=>{const g=c.createLinearGradient(0,0,W,0);['#ffb060','#ffd9a0','#ffc880','#ffb060'].forEach((k,i,a)=>g.addColorStop(i/(a.length-1),k));c.fillStyle=g;c.fillRect(0,0,W,H);
      const f=c.createLinearGradient(0,0,0,H);f.addColorStop(0,'rgba(0,0,0,0)');f.addColorStop(1,'rgba(0,0,0,1)');c.fillStyle=f;c.fillRect(0,0,W,H);});
    const refl=(w,l,x,z,ry,op)=>{const p=new THREE.Mesh(new THREE.PlaneGeometry(w,l),new THREE.MeshBasicMaterial({map:gradT,transparent:true,opacity:op,blending:THREE.AdditiveBlending,depthWrite:false}));p.rotation.set(-Math.PI/2,0,ry||0);p.position.set(x,0.018,z);p.renderOrder=4;root.add(p);return p;};
    const rf1=refl(9.2,2.2,0,ZB+1.35,0,0.07),rf2=refl(ZF-ZB-2,2.0,-RW+1.25,(ZF+ZB)/2,Math.PI/2,0.07);
    /* — lanternes de papier suspendues : corps galbé nervuré, cerclages laqués, gland — */
    const lanT=cvTex(128,128,(c,W,H)=>{const g=c.createLinearGradient(0,0,0,H);g.addColorStop(0,'#c8501c');g.addColorStop(0.5,'#ffb45a');g.addColorStop(1,'#b8431a');c.fillStyle=g;c.fillRect(0,0,W,H);c.strokeStyle='rgba(60,18,6,0.55)';c.lineWidth=1.5;for(let y=6;y<H;y+=9){c.beginPath();c.moveTo(0,y);c.lineTo(W,y);c.stroke();}});
    const lanM=new THREE.MeshBasicMaterial({map:lanT,color:new THREE.Color(0.9,0.6,0.4)}),lanG=new THREE.LatheGeometry([[0.07,-0.25],[0.15,-0.2],[0.2,-0.08],[0.21,0.02],[0.19,0.14],[0.13,0.22],[0.07,0.25]].map(p=>new THREE.Vector2(p[0],p[1])),20);const lans=[];
    [[-5.2,3.5,-2.2],[-2.6,3.9,-4.9],[3.4,3.7,-4.6],[-5.6,3.3,5.6]].forEach((p,i)=>{const g=new THREE.Group();g.add(new THREE.Mesh(lanG,lanM));
      put(Cy(0.075,0.085,0.05,blackL,14),0,0.275,0,0,g);put(Cy(0.085,0.075,0.05,blackL,14),0,-0.275,0,0,g);put(Cy(0.078,0.078,0.012,gold,14),0,0.25,0,0,g);put(Cy(0.078,0.078,0.012,gold,14),0,-0.25,0,0,g);
      put(Cy(0.005,0.005,CH-p[1]-0.3,blackL,5),0,0.3+(CH-p[1]-0.3)/2,0,0,g);put(Cy(0.004,0.004,0.12,crim,5),0,-0.36,0,0,g);put(new THREE.Mesh(new THREE.ConeGeometry(0.022,0.1,8),crim),0,-0.46,0,0,g).rotation.x=Math.PI;put(g,p[0],p[1],p[2]);lans.push(g);});
    /* — tentures suspendues au fond — */
    const drapes=[];[[-6.2,'#1c2a55'],[-5.2,'#7a1a22'],[5.0,'#e6dcc2'],[6.1,'#1c2a55']].forEach(([x,col],i)=>{const t=cvTex(128,256,(c,W,H)=>{c.fillStyle=col;c.fillRect(0,0,W,H);c.strokeStyle='rgba(240,220,170,0.85)';c.lineWidth=5;c.beginPath();c.arc(W/2,H*0.36,30,0,7);c.stroke();c.beginPath();for(let k=0;k<5;k++){const a=k/5*6.283;c.moveTo(W/2,H*0.36);c.lineTo(W/2+Math.sin(a)*26,H*0.36-Math.cos(a)*26);}c.stroke();c.fillStyle='rgba(0,0,0,0.25)';c.fillRect(0,H-26,W,26);});
      const ge=new THREE.PlaneGeometry(0.95,2.1,5,10),pp=ge.attributes.position;for(let k=0;k<pp.count;k++){const v=0.5-pp.getY(k)/2.1;pp.setZ(k,0.05*Math.sin(pp.getX(k)*9+i)*v);}ge.computeVertexNormals();
      const m=new THREE.Mesh(ge,new THREE.MeshStandardMaterial({map:t,roughness:0.95,side:THREE.DoubleSide}));m.position.y=-1.05;const pv=new THREE.Group();pv.add(m);put(pv,x,2.42,ZB+0.55);drapes.push(pv);});
    put(Cy(0.02,0.02,2.4,postM,6),-5.7,2.44,ZB+0.55).rotation.z=Math.PI/2;put(Cy(0.02,0.02,2.4,postM,6),5.55,2.44,ZB+0.55).rotation.z=Math.PI/2;
    /* — armure de samouraï sur son coffre — */
    { const g=new THREE.Group();put(g,-4.75,0,-4.35,0.42);
      put(B_(0.6,0.42,0.5,blackL),0,0.21,0,0,g);put(B_(0.64,0.03,0.54,gold),0,0.435,0,0,g);
      const doo=Cy(0.25,0.21,0.52,redL,14);doo.scale.z=0.72;put(doo,0,1.0,0,0,g);for(let k=0;k<5;k++)put(B_(0.5,0.012,0.012,gold),0,0.8+k*0.1,0.165,0,g);
      for(let k=-2;k<=2;k++){const p=B_(0.17,0.3,0.03,k%2?blackL:redL);put(p,k*0.18,0.6,0.14-Math.abs(k)*0.03,k*-0.22,g);put(B_(0.17,0.012,0.034,gold),k*0.18,0.5,0.14-Math.abs(k)*0.03,k*-0.22,g);}
      for(const s of [1,-1]){const sd=B_(0.24,0.3,0.04,redL);sd.rotation.z=s*-0.35;put(sd,s*0.36,1.14,0,0,g);put(B_(0.24,0.014,0.045,gold),s*0.38,1.06,0,0,g).rotation.z=s*-0.35;}
      put(Sp(0.115,blackL,12,8),0,1.42,0.01,0,g).scale.set(1,1.05,0.95);put(B_(0.2,0.1,0.06,S_('#2a0d0b',0.4)),0,1.37,0.09,0,g);
      const kab=new THREE.Mesh(new THREE.SphereGeometry(0.17,16,8,0,6.2832,0,Math.PI/2),blackL);put(kab,0,1.47,0,0,g);
      for(let k=0;k<3;k++)put(new THREE.Mesh(new THREE.CylinderGeometry(0.19+k*0.04,0.24+k*0.045,0.06,16,1,true,Math.PI*0.5,Math.PI),k%2?redL:blackL),0,1.44-k*0.055,-0.01,0,g).material.side=THREE.DoubleSide;
      const cr=new THREE.Mesh(new THREE.TorusGeometry(0.15,0.014,6,20,Math.PI),gold);cr.rotation.z=Math.PI;put(cr,0,1.74,0.15,0,g);put(Sp(0.03,gold,8,6),0,1.6,0.16,0,g); }
    /* — râtelier et deux sabres — */
    { const g=new THREE.Group();put(g,-2.95,0,-5.1,0.12);for(const s of [1,-1]){put(B_(0.07,0.62,0.2,blackL),s*0.42,0.31,0,0,g);put(B_(0.12,0.05,0.3,blackL),s*0.42,0.025,0,0,g);}
      [[0.5,1.0],[0.3,0.72]].forEach(([y,L])=>{const cu=new THREE.QuadraticBezierCurve3(new THREE.Vector3(-L/2,y,0.02),new THREE.Vector3(0,y-0.07,0.02),new THREE.Vector3(L/2,y+0.01,0.02));
        g.add(new THREE.Mesh(new THREE.TubeGeometry(cu,20,0.017,8),blackL));const h=Cy(0.019,0.019,L*0.26,crim,8);h.rotation.z=Math.PI/2+0.1;put(h,-L/2-L*0.1,y+0.012,0.02,0,g);put(Cy(0.04,0.04,0.008,gold,12),-L/2+0.01,y,0.02,0,g).rotation.z=Math.PI/2;}); }
    /* — vases et branches de cerisier — */
    const blos=[];const vase=(x,z,h,mat)=>{const pts=[[0,0],[0.1,0],[0.16,h*0.3],[0.13,h*0.62],[0.06,h*0.86],[0.08,h]].map(p=>new THREE.Vector2(p[0],p[1]));put(new THREE.Mesh(new THREE.LatheGeometry(pts,18),mat),x,0,z);
      for(let b=0;b<3;b++){const a=b*2.1+x,c0=new THREE.Vector3(x,h,z),c1=new THREE.Vector3(x+Math.cos(a)*0.25,h+0.45,z+Math.sin(a)*0.2),c2=new THREE.Vector3(x+Math.cos(a)*0.6,h+0.75+b*0.12,z+Math.sin(a)*0.45);const cu=new THREE.QuadraticBezierCurve3(c0,c1,c2);root.add(new THREE.Mesh(new THREE.TubeGeometry(cu,10,0.011,5),postM));
        for(let k=0;k<9;k++){const p=cu.getPoint(0.35+rr()*0.65);blos.push([p.x+(rr()-0.5)*0.1,p.y+(rr()-0.5)*0.08,p.z+(rr()-0.5)*0.1]);}}};
    vase(-6.05,-1.4,0.62,porc);vase(-3.55,-5.25,0.5,S_('#27406e',0.25));vase(4.6,-5.2,0.56,porc);
    /* — table basse, service à thé, coussins — */
    { const g=new THREE.Group();put(g,-1.75,0,1.75,0.2);put(Cy(0.62,0.62,0.05,blackL,24),0,0.33,0,0,g);for(let k=0;k<4;k++)put(B_(0.07,0.31,0.07,blackL),Math.cos(k*1.5708+0.78)*0.44,0.155,Math.sin(k*1.5708+0.78)*0.44,0,g);
      put(Sp(0.09,S_('#3a2a22',0.5),12,9),0.05,0.43,0,0,g).scale.y=0.8;put(Cy(0.012,0.02,0.1,S_('#3a2a22',0.5),6),0.15,0.44,0,0,g).rotation.z=-1.0;const hd=new THREE.Mesh(new THREE.TorusGeometry(0.06,0.008,6,14,Math.PI),S_('#3a2a22',0.5));put(hd,0.05,0.5,0,0,g);
      [[-0.25,0.18],[-0.18,-0.25],[0.3,0.22]].forEach(p=>put(Cy(0.035,0.028,0.05,porc,10),p[0],0.38,p[1],0,g));
      put(B_(0.58,0.09,0.58,crim),0.95,0.045,0.35,0.3,g);put(B_(0.58,0.09,0.58,indigo),-0.2,0.045,1.0,-0.2,g); }
    /* — kimono sur son portant — */
    { const g=new THREE.Group();put(g,-6.05,0,-4.0,0.75);for(const s of [1,-1])put(Cy(0.025,0.025,1.75,blackL,8),s*0.8,0.875,0,0,g);put(Cy(0.022,0.022,1.75,blackL,8),0,1.7,0,0,g).rotation.z=Math.PI/2;put(B_(1.7,0.05,0.3,blackL),0,0.025,0,0,g);
      const kt=cvTex(256,256,(c,W,H)=>{const gr=c.createLinearGradient(0,0,0,H);gr.addColorStop(0,'#8a1a2a');gr.addColorStop(0.6,'#5a1026');gr.addColorStop(1,'#1c1230');c.fillStyle=gr;c.fillRect(0,0,W,H);let sd=5;const rn=()=>(sd=(sd*16807)%2147483647)/2147483647;
        for(let k=0;k<26;k++){const x=rn()*W,y=H*0.35+rn()*H*0.65,r=5+rn()*7;c.fillStyle=k%4?'#f4b8c8':'#e8c46a';for(let p=0;p<5;p++){const a=p/5*6.283;c.beginPath();c.arc(x+Math.cos(a)*r,y+Math.sin(a)*r,r*0.62,0,7);c.fill();}}
        c.fillStyle='#e8c46a';c.fillRect(W/2-7,0,14,H);});
      const km=new THREE.MeshStandardMaterial({map:kt,roughness:0.9,side:THREE.DoubleSide});const kg=new THREE.Group();kg.position.set(0,1.69,0.03);g.add(kg);
      put(new THREE.Mesh(new THREE.PlaneGeometry(0.66,1.4,4,6),km),0,-0.7,0,0,kg);for(const s of [1,-1])put(new THREE.Mesh(new THREE.PlaneGeometry(0.5,0.62,3,3),km),s*0.57,-0.31,0,0,kg);drapes.push(kg); }
    /* — chats : hanches, poitrail, museau, oreilles doublées, yeux qui luisent dans l'ombre, moustaches ; l'un lève la patte, l'autre remue la queue — */
    const eyeM=new THREE.MeshBasicMaterial({color:new THREE.Color(1.3,1.5,0.5)}),whM=new THREE.LineBasicMaterial({color:0xd8d0c0,transparent:true,opacity:0.6});
    const cat=(x,z,ry,m,m2)=>{const g=new THREE.Group();put(g,x,0,z,ry);const E=(rx,ryy,rz,px,py,pz,mm)=>{const o=Sp(1,mm||m,16,12);o.scale.set(rx,ryy,rz);return put(o,px,py,pz,0,g);};
      E(0.115,0.15,0.13,0,0.17,-0.03);for(const s of [1,-1])E(0.075,0.09,0.11,s*0.085,0.085,-0.02);E(0.085,0.12,0.075,0,0.2,0.075,m2);
      const hd=new THREE.Group();hd.position.set(0,0.385,0.085);g.add(hd);const H=(rx,ryy,rz,px,py,pz,mm)=>{const o=Sp(1,mm||m,14,10);o.scale.set(rx,ryy,rz);o.position.set(px,py,pz);hd.add(o);return o;};
      H(0.085,0.075,0.08,0,0,0);for(const s of [1,-1]){H(0.04,0.035,0.035,s*0.045,-0.02,0.05);H(0.028,0.02,0.02,s*0.018,-0.028,0.075,m2);
        const e=new THREE.Mesh(new THREE.ConeGeometry(0.036,0.075,4),m);e.position.set(s*0.052,0.085,-0.005);e.rotation.set(-0.15,s*0.5,s*-0.22);hd.add(e);const ei=new THREE.Mesh(new THREE.ConeGeometry(0.02,0.05,4),pinkM);ei.position.set(s*0.05,0.08,0.008);ei.rotation.copy(e.rotation);hd.add(ei);
        const ey=Sp(1,eyeM,10,8);ey.scale.set(0.014,0.017,0.006);ey.position.set(s*0.036,0.012,0.073);hd.add(ey);const pu=Sp(1,blackL,6,5);pu.scale.set(0.004,0.014,0.004);pu.position.set(s*0.036,0.012,0.078);hd.add(pu);
        const wg=new THREE.BufferGeometry().setFromPoints([0,1,2].flatMap(k=>[new THREE.Vector3(s*0.03,-0.025,0.075),new THREE.Vector3(s*0.13,-0.01-k*0.02,0.06)]));hd.add(new THREE.LineSegments(wg,whM));}
      const no=Sp(0.009,pinkM,6,5);no.position.set(0,-0.012,0.088);hd.add(no);
      const lg=Cy(0.026,0.032,0.2,m2||m,8);put(lg,-0.05,0.1,0.11,0,g);put(Sp(0.034,m2||m,8,6),-0.05,0.02,0.125,0,g).scale.y=0.6;
      const paw=new THREE.Group();paw.position.set(0.05,0.21,0.11);const pm=Cy(0.026,0.032,0.2,m2||m,8);pm.position.y=-0.1;const pf=Sp(0.034,m2||m,8,6);pf.scale.y=0.6;pf.position.set(0,-0.19,0.012);paw.add(pm,pf);g.add(paw);
      const tail=new THREE.Group();tail.position.set(0,0.05,-0.14);tail.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[0,0,0],[0.1,0.0,-0.08],[0.2,0.03,-0.04],[0.24,0.1,0.04],[0.2,0.17,0.07]].map(p=>new THREE.Vector3(p[0],p[1],p[2]))),16,0.02,7),m));g.add(tail);return {g,paw,tail,hd};};
    const c1=cat(-0.72,2.1,-0.25,fur,S_('#efe8dc',0.95)),c2=cat(-2.3,0.1,0.9,fur2,S_('#5a5048',0.95));
    /* — pétales de cerisier : une bouffée de temps en temps, par la porte entrouverte, allumés par le couchant — */
    const NP=MOBILE?40:110,pp=new Float32Array(NP*3),ps=new Float32Array(NP*4);for(let i=0;i<NP;i++){pp[i*3]=GX+0.2;pp[i*3+1]=0.4+rr()*1.9;pp[i*3+2]=GZ0+rr()*(GZ1-GZ0);ps[i*4]=rr();ps[i*4+1]=rr();ps[i*4+2]=rr();ps[i*4+3]=rr();}
    const pg=new THREE.BufferGeometry();pg.setAttribute('position',new THREE.BufferAttribute(pp,3));pg.setAttribute('aS',new THREE.BufferAttribute(ps,4));
    const pts=new THREE.Points(pg,new THREE.ShaderMaterial({uniforms:{uTime:U.uTime,uH:{value:600}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
      vertexShader:`attribute vec4 aS;uniform float uTime;uniform float uH;varying float vA;void main(){float cyc=uTime*0.055+aS.x*0.12;float tt=fract(cyc)*5.0;float live=step(tt,1.0);float t=tt;
        vec3 p=position+vec3(0.87,-0.22,-0.43)*t*9.0*(0.6+0.6*aS.y);p.y+=sin(t*9.0+aS.z*20.0)*0.18-t*0.5*aS.w;p.z+=cos(t*7.0+aS.x*30.0)*0.3;p.y=max(p.y,0.03);
        vA=live*smoothstep(0.0,0.08,t)*(1.0-smoothstep(0.75,1.0,t))*(0.55+0.45*sin(uTime*6.0+aS.w*40.0));vec4 mv=modelViewMatrix*vec4(p,1.0);gl_Position=projectionMatrix*mv;gl_PointSize=uH*(0.016+0.012*aS.z)/max(0.5,-mv.z);}`,
      fragmentShader:`varying float vA;void main(){vec2 q=gl_PointCoord-0.5;float d=1.0-smoothstep(0.2,0.5,length(q*vec2(1.0,1.6)));gl_FragColor=vec4(vec3(1.0,0.5,0.62)*d*vA*1.3,1.0);}`}));
    pts.frustumCulled=false;pts.renderOrder=8;root.add(pts);
    /* — cerisiers nains (bonsaï) : coupe émaillée, tronc tors, branches, nuages de fleurs — */
    const bonsai=(x,y,z,sc,seed)=>{const g=new THREE.Group();put(g,x,y,z,seed);g.scale.setScalar(sc);let sd=seed*977+3;const rn=()=>(sd=(sd*16807)%2147483647)/2147483647;
      put(B_(0.46,0.07,0.3,S_('#22364e',0.25)),0,0.045,0,0,g);put(B_(0.5,0.02,0.34,S_('#2c4666',0.2)),0,0.085,0,0,g);put(B_(0.4,0.012,0.24,S_('#3a3f24',1)),0,0.09,0,0,g);for(const sx of [1,-1])for(const sz of [1,-1])put(B_(0.05,0.02,0.05,S_('#22364e',0.25)),sx*0.18,0.01,sz*0.1,0,g);
      const tr=[[0,0.09,0],[0.05,0.2,0.02],[-0.03,0.32,-0.01],[0.04,0.44,0.03],[0.0,0.54,0.0]].map(p=>new THREE.Vector3(p[0],p[1],p[2]));const tc=new THREE.CatmullRomCurve3(tr);
      g.add(new THREE.Mesh(new THREE.TubeGeometry(tc,14,0.034,7),postM));g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(tr.slice(2)),8,0.022,6),postM));
      for(let b=0;b<6;b++){const t0=0.3+b*0.12,a=b*2.4+seed,p0=tc.getPoint(Math.min(1,t0)),L=0.2+rn()*0.14,p2=new THREE.Vector3(p0.x+Math.cos(a)*L,p0.y+0.06+rn()*0.1,p0.z+Math.sin(a)*L*0.8),p1=p0.clone().lerp(p2,0.5);p1.y+=0.06;
        g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(p0,p1,p2),6,0.011,5),postM));
        for(let k=0;k<16;k++){const q=new THREE.Vector3(p2.x+(rn()-0.5)*0.2,p2.y+(rn()-0.3)*0.12,p2.z+(rn()-0.5)*0.2);g.updateMatrixWorld(true);q.applyMatrix4(g.matrix);blos.push([q.x,q.y,q.z,0.022*sc*(0.7+rn()*0.7),rn()]);}}};
    bonsai(-1.75,0.355,1.75,0.75,1);bonsai(-3.1,0.42,0.9,1.25,2);bonsai(-1.55,0.3,-5.2,1.15,3);bonsai(-0.05,0.42,-11.5,1.2,4);
    put(B_(0.6,0.42,0.42,blackL),-3.1,0.21,0.9);put(B_(0.56,0.3,0.4,blackL),-1.55,0.15,-5.2);put(B_(0.6,0.42,0.42,blackL),-0.05,0.21,-11.5);
    { const bm=new THREE.MeshStandardMaterial({color:0xffffff,roughness:0.7,emissive:new THREE.Color('#ff9ab4'),emissiveIntensity:0.22}),im=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),bm,blos.length),m4=new THREE.Matrix4(),q=new THREE.Quaternion(),cc=new THREE.Color();
      blos.forEach((p,i)=>{const r=p[3]||0.028;m4.compose(new THREE.Vector3(p[0],p[1],p[2]),q,new THREE.Vector3(r,r*0.8,r));im.setMatrixAt(i,m4);cc.setHSL(0.94+0.03*(p[4]||0.5),0.75,0.74+0.12*(p[4]||0.5));im.setColorAt(i,cc);});if(im.instanceColor)im.instanceColor.needsUpdate=true;root.add(im); }
    /* — profondeur : les panneaux du milieu sont ouverts sur une seconde salle (étagères, fenêtre ronde au fond) — */
    { const Z2=-13.2,HW=2.7,inM=S_('#33291c',0.9),woodD=S_('#241710',0.75);
      const fl=new THREE.Mesh(new THREE.PlaneGeometry(HW*2,ZB-Z2),S_('#3b3526',0.95));fl.rotation.x=-Math.PI/2;put(fl,0,0.012,(ZB+Z2)/2);
      for(const sx of [1,-1]){const w=new THREE.Mesh(new THREE.PlaneGeometry(ZB-Z2,LH+0.6),inM);w.rotation.y=-sx*Math.PI/2;put(w,sx*HW,(LH+0.6)/2,(ZB+Z2)/2);for(const z of [-8.2,-10.6])put(B_(0.14,LH+0.6,0.14,woodD),sx*(HW-0.07),(LH+0.6)/2,z);}
      const bw=new THREE.Mesh(new THREE.PlaneGeometry(HW*2,LH+0.6),inM);put(bw,0,(LH+0.6)/2,Z2);const cl=new THREE.Mesh(new THREE.PlaneGeometry(HW*2,ZB-Z2),woodD);cl.rotation.x=Math.PI/2;put(cl,0,LH+0.6,(ZB+Z2)/2);
      for(let r=0;r<6;r++)put(B_(1.5,0.03,0.3,woodD),-1.85,0.3+r*0.42,Z2+0.17);for(let c=0;c<4;c++)put(B_(0.03,2.45,0.3,woodD),-2.6+c*0.5,1.22,Z2+0.17);
      for(let k=0;k<11;k++){const c=(k*7)%3,r=(k*5)%5;put(B_(0.3+((k*3)%3)*0.06,0.12+((k*2)%3)*0.06,0.2,S_(['#5a2a22','#2a3a52','#6a5a34','#3a4a34'][k%4],0.8)),-2.35+c*0.5,0.38+r*0.42+((k*2)%3)*0.03,Z2+0.17);}
      const moonT=cvTex(256,256,(c,W,H)=>{c.fillStyle='#000';c.fillRect(0,0,W,H);const g=c.createRadialGradient(W/2,H/2,10,W/2,H/2,W/2-6);g.addColorStop(0,'#fff0cc');g.addColorStop(0.7,'#f0c890');g.addColorStop(1,'#c88a58');c.fillStyle=g;c.beginPath();c.arc(W/2,H/2,W/2-6,0,7);c.fill();
        c.strokeStyle='#1a0f08';c.lineWidth=5;c.beginPath();c.moveTo(W/2,6);c.lineTo(W/2,H-6);c.moveTo(6,H/2);c.lineTo(W-6,H/2);c.stroke();c.lineWidth=3;c.beginPath();c.moveTo(40,H-30);c.quadraticCurveTo(110,150,200,60);c.moveTo(120,140);c.lineTo(170,150);c.moveTo(150,105);c.lineTo(120,80);c.stroke();c.lineWidth=12;c.beginPath();c.arc(W/2,H/2,W/2-8,0,7);c.stroke();});
      const mw=new THREE.Mesh(new THREE.CircleGeometry(0.85,40),new THREE.MeshBasicMaterial({map:moonT,color:new THREE.Color(1.5,1.3,1.0)}));put(mw,-0.05,1.7,Z2+0.03);
      mkShaft(new THREE.Vector3(-0.9,0.85,Z2+0.06),new THREE.Vector3(1.7,0,0),new THREE.Vector3(0,1.7,0),new THREE.Vector3(-0.2,-0.42,0.88).normalize(),moonT,0.2,0.5); }
    /* — poussière en suspension : elle ne brille que là où passe un rayon — */
    { const ND=MOBILE?160:420,dp=new Float32Array(ND*3),ds=new Float32Array(ND*4);for(let i=0;i<ND;i++){dp[i*3]=-6.6+rr()*9;dp[i*3+1]=0.15+rr()*(CH-1);dp[i*3+2]=-5.6+rr()*13;ds[i*4]=rr();ds[i*4+1]=rr();ds[i*4+2]=rr();ds[i*4+3]=rr();}
      const dg=new THREE.BufferGeometry();dg.setAttribute('position',new THREE.BufferAttribute(dp,3));dg.setAttribute('aS',new THREE.BufferAttribute(ds,4));
      const dm=new THREE.ShaderMaterial({uniforms:{uTime:U.uTime,uH:{value:600},uWz:{value:WINZ.slice(0,5)},uD:{value:SUND},uW:{value:new THREE.Vector4(WXL,WY0,WY1,WW/2)}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
        vertexShader:`attribute vec4 aS;uniform float uTime;uniform float uH;uniform float uWz[5];uniform vec3 uD;uniform vec4 uW;varying float vA;
          void main(){vec3 p=position;p.x+=sin(uTime*(0.05+aS.x*0.07)+aS.y*6.28)*0.5;p.y+=sin(uTime*(0.04+aS.z*0.05)+aS.w*6.28)*0.35;p.z+=cos(uTime*(0.05+aS.y*0.06)+aS.x*6.28)*0.5;
            float t=(p.x-uW.x)/uD.x;vec3 p0=p-uD*t;float lit=0.0;for(int i=0;i<5;i++)lit=max(lit,1.0-smoothstep(uW.w*0.8,uW.w,abs(p0.z-uWz[i])));lit*=step(uW.y,p0.y)*step(p0.y,uW.z);
            vA=lit*(0.45+0.55*sin(uTime*(0.7+aS.w)+aS.x*40.0));vec4 mv=modelViewMatrix*vec4(p,1.0);gl_Position=projectionMatrix*mv;gl_PointSize=uH*(0.006+0.009*aS.z)/max(0.5,-mv.z);}`,
        fragmentShader:`varying float vA;void main(){float d=1.0-smoothstep(0.0,0.5,length(gl_PointCoord-0.5));gl_FragColor=vec4(vec3(1.0,0.86,0.62)*d*d*vA*0.9,1.0);}`});
      const dpt=new THREE.Points(dg,dm);dpt.frustumCulled=false;dpt.renderOrder=8;root.add(dpt);FXT.push(()=>{dm.uniforms.uH.value=pts.material.uniforms.uH.value;}); }
    const bounce=[];if(!MOBILE)[[-1.6,1.0,1.4],[-1.3,1.0,-3.0]].forEach(p=>{const l=new THREE.PointLight(new THREE.Color('#ffd2a0'),0,7.5,1.7);l.position.set(p[0],p[1],p[2]);root.add(l);bounce.push(l);});
    FXT.push((T,dt,inside)=>{bounce.forEach(l=>{l.intensity=SHAFTS[0].k*1.05;});for(const s of SHAFTS){s.k+=((inside?1:0)-s.k)*Math.min(1,dt*1.2);s.m.visible=s.k>0.01;s.u.uK.value=s.k;s.dm.color.setScalar(s.k*s.decK);}
      drapes.forEach((d,i)=>{d.rotation.x=0.03*Math.sin(T*0.6+i*1.7);d.rotation.z=0.012*Math.sin(T*0.45+i);});lans.forEach((l,i)=>{l.rotation.z=0.03*Math.sin(T*0.5+i*2.1);});
      const w=Math.max(0,Math.sin(T*0.35));c1.paw.rotation.x=-1.9*w-0.35*w*Math.sin(T*5.0);c1.tail.rotation.y=0.3*Math.sin(T*0.9);c1.hd.rotation.y=0.25*Math.sin(T*0.31);c2.hd.rotation.y=0.3*Math.sin(T*0.23+1.0);c2.hd.rotation.z=0.08*Math.sin(T*0.5);c2.tail.rotation.y=0.6*Math.sin(T*1.4);c2.paw.rotation.x=-0.25*Math.max(0,Math.sin(T*0.21+2.0));
      pts.material.uniforms.uH.value=renderer.getDrawingBufferSize(new THREE.Vector2()).y;});
    /* — les rouleaux restent lisibles dans la pénombre : une faible lueur propre — */
    books.forEach(b=>b.holder.traverse(o=>{const m=o.material;if(m&&m.isMeshStandardMaterial&&m!==b.coverM&&!m.userData.rvGlow){m.userData.rvGlow=1;m.emissive=m.color.clone();m.emissiveIntensity=0.42;if(m.map)m.emissiveMap=m.map;m.needsUpdate=true;}}));
  }

  /* placement en arc : laisse la droite de l'écran au panneau */
  function layout(n){
    for(let i=0;i<books.length;i++){const b=books[i];const on=i<n;b.holder.visible=b.ped.visible=on;if(!on)continue;
      const u=n>1?i/(n-1):0.5;const a=lerp(-1.05,0.75,u)*(n<4?0.7:1);
      const rad=3.3+(i%2)*0.55;const x=Math.sin(a)*rad-0.5,z=-Math.cos(a)*rad+0.2;
      b.yaw=-a*0.85+(rr()-0.5)*0.12;
      b.ped.position.set(x,0,z);b.ped.rotation.y=b.yaw;
      b.base=new THREE.Vector3(x,0.97*1.25+RR*0.3,z);b.tilt=0;
      b.holder.position.copy(b.base);b.holder.rotation.set(0,b.yaw,0);}
  }
  let themeKey='';
  function setSubject(sj,S){
    const theme=TEMPLE_THEMES[sj.idx]||'montagnes';
    if(themeKey!==theme){themeKey=theme;
      if(fusuM.map&&fusuM.map!==BOOK_BLANK)fusuM.map.dispose();fusuM.map=paintFusuma(theme,sj.name,sj.idx*97+11);fusuM.needsUpdate=true;
      if(kakeM.map&&kakeM.map!==BOOK_BLANK)kakeM.map.dispose();kakeM.map=paintKakejiku(theme,sj.idx*13+5);kakeM.needsUpdate=true;
      // une lumière et une laque propres à chaque salle
      const day={montagnes:'#fff1d8',vagues:'#eef1f2',pin:'#ffe6c4',bambou:'#f1f3dc',rizieres:'#fff0d0'}[theme];
      shojiU.uDay.value.set(day).multiplyScalar(0.065);
      lacqU.uAcc.value.set({montagnes:'#8e1f16',vagues:'#1d2f4a',pin:'#7a1c12',bambou:'#2b3d22',rizieres:'#8a5a1a'}[theme]);}
    const list=(S&&S.list&&S.list.length)?S.list:Array.from({length:4},(_,k)=>({id:sj.key+'_soon'+k,name:'Cours à venir',mastery:0,soon:true}));
    const n=Math.min(books.length,list.length);
    layout(n);
    for(let i=0;i<n;i++){const b=books[i],c=list[i];b.c=c;
      if(b.tex)b.tex.dispose();b.tex=coverTex(BOOK_COLS[i%BOOK_COLS.length],c.name,c.soon?'BIENTÔT DISPONIBLE':'MATIÈRE_'+String(sj.idx).padStart(2,'0')+' · '+sj.name,i);
      b.coverM.map=b.tex;b.coverM.needsUpdate=true;
      const m=clamp01(c.mastery||0),m0=seenStart('book_'+(c.id||sj.key+i),m);
      b.m=m;b.m0=m0;b.burst=(m>=BOOK_FREE&&m0>=BOOK_FREE)?2:0;b.free=b.burst?1:0;b.bt=0;b.op=0;b.opening=false;b.done=null;
      b.chunk.visible=!b.burst;}
    CAVE.n=n;CAVE.list=list;
  }
  function open(i,cb){const b=books[i];if(!b||b.opening)return;b.opening=true;b.op=0;b.done=cb;
    if(!b.burst){b.burst=1;b.chunk.visible=false;shat.fire(new THREE.Vector3(0,0,0),new THREE.Vector3(0.1,0.3,0.1),b.roll,24,0.35);audioSand(T,0.3);}}
  const _v=new THREE.Vector3();
  function update(dt,T,cam,inside){
    for(const f of FXT)f(T,dt,inside);
    lights.forEach(l=>{if(l.isPointLight){const ph=l.userData.ph||0;l.intensity=inside?l.userData.caveI*(0.88+0.08*Math.sin(T*7.3+ph)+0.04*Math.sin(T*17.1+ph)):0;}else l.intensity=inside?l.userData.caveI:0;});
    let delay=0;
    for(let i=0;i<(CAVE.n||0);i++){const b=books[i];
      if(inside&&!b.burst&&b.m>=BOOK_FREE){b.bt+=dt;if(b.bt>0.9+delay){b.burst=1;b.chunk.visible=false;
          shat.fire(new THREE.Vector3(0,0,0),new THREE.Vector3(0.1,0.3,0.1),b.roll,30,0.4);audioSand(T,0.35);
          seenSave('book_'+(b.c.id||i),b.m);}
        delay+=0.45;}
      if(b.burst)b.free=Math.min(1,b.free+dt/1.6);
      if(b.opening){b.op=Math.min(1,b.op+dt/1.0);if(b.op>=1&&b.done){const cb=b.done;b.done=null;cb();}}
      const f=easeInOut(b.free),o=easeInOut(b.op);
      b.hov+=((CAVE.hov===i||CAVE.panelHov===i?1:0)-b.hov)*Math.min(1,dt*6);
      // levé, redressé, déroulé (en partie libéré ; en entier à l'ouverture)
      const up=f*(0.34+Math.sin(T*1.1+i)*0.03)+b.hov*0.05+o*0.25;
      b.holder.position.set(b.base.x,b.base.y+up,b.base.z);
      // à l'ouverture, le rouleau se tourne vers la caméra
      let yaw=b.yaw+Math.sin(T*0.35+i*1.3)*0.08*f+b.hov*0.08;
      if(o>0&&cam){_v.copy(cam.position).sub(b.holder.position);const cy=Math.atan2(_v.x,_v.z);let d=cy-yaw;d=Math.atan2(Math.sin(d),Math.cos(d));yaw+=d*o;}
      b.holder.rotation.set(0,yaw,0);
      b.g.rotation.set(0,0,Math.PI/2*(1-f));
      const L=Math.max(0.0001,lerp(0.42*f,LMAX,o));b.L=L;
      b.roll.position.x=L/2+RR*f*0.6;b.endRod.position.x=-L/2;
      b.sheet.scale.set(L,L>0.002?1:0.0001,1);
      if(b.coverM.map&&b.coverM.map!==BOOK_BLANK){b.coverM.map.repeat.set(L/LMAX,1);b.coverM.map.offset.set(0,0);}
      b.coverM.emissiveIntensity=(0.06+0.1*b.hov)*f+0.12*o;
      b.edgeM.emissive.setRGB(b.hov*0.08,b.hov*0.06,b.hov*0.03);
    }
    shat.update(dt);
  }
  function pick(ray){
    let best=-1,bd=1e9;
    for(let i=0;i<(CAVE.n||0);i++){const b=books[i];b.holder.updateMatrixWorld(true);
      const box=new THREE.Box3().setFromObject(b.g).expandByScalar(0.06);const hit=ray.intersectBox(box,_v);
      if(hit){const d=hit.distanceTo(ray.origin);if(d<bd){bd=d;best=i;}}}
    return best;
  }
  return {kind,temple:true,scene:scn,root,books,setSubject,update,pick,open,shat,lights,layout,
    // air de la salle : un voile chaud et léger (encens), à peine une brume au ras des tatamis
    fog:new THREE.Color('#cdb894'),fogD:0.009,fogStart:9.0,fogH:0.03,fogCeil:0.0,
    mist:new THREE.Color('#f0e0c2'),mistK:0.06,mistH:3.0,expo:0.86,bloom:[0.2,0.96],
    envK:0.016,fade:new THREE.Color('#efe2c8'),
    view:{pos:new THREE.Vector3(1.7,2.3,9.9),tgt:new THREE.Vector3(0.75,1.75,-1.6),top:new THREE.Vector3(0.9,3.0,11.1)}};
}

/* ═══ 35 · Le sanctuaire des rizières (haiden) ═══
   Pavillon de culte shintō ouvert sur l'avant, traité comme la pagode d'accueil :
   – soubassement de granit taillé (joints moussus), marches de pierre, parvis de gravier ratissé ;
   – plancher de cèdre surélevé et sa véranda, piliers ronds sur pierres d'assise, bagues de cuivre
     vert-de-grisé, tirants, consoles (daito) et chevrons apparents sous l'avant-toit ;
   – mur du fond en planches verticales, côtés à claire-voie (la lumière passe entre les lattes),
     plafond à caissons ;
   – grand toit de chaume en demi-croupe (irimoya) : bord épais taillé, pignons de bois, faîtage
     couvert, katsuogi et chigi croisés ;
   – rideau blanc et violet, corde sacrée et papiers en zigzag, lanternes de bronze suspendues,
     lanternes de papier à l'intérieur, lanternes de pierre sur le parvis, gohei, fougères au pied.
   Textures peintes en amont (cèdre veiné, chaume de roseau) : cf. tex/gen_temple.py.
   L'objet repose sur une table d'offrandes (hassokuan) au centre. Même interface que les grottes. */

/* coordonnées de texture « bois » : le fil suit l'axe ax (0 x, 1 y, 2 z), sc mètres par tuile */
function rvWoodUV(g,ax,sc,off){
  g=g.index?g.toNonIndexed():g;
  const p=g.attributes.position,n=g.attributes.normal,uv=new Float32Array(p.count*2);const o0=off||0;
  for(let i=0;i<p.count;i++){const P=[p.getX(i),p.getY(i),p.getZ(i)],N=[Math.abs(n.getX(i)),Math.abs(n.getY(i)),Math.abs(n.getZ(i))];
    const k=N[0]>N[1]?(N[0]>N[2]?0:2):(N[1]>N[2]?1:2);const o=[0,1,2].filter(a=>a!==k);let u,v;
    if(o.includes(ax)){v=P[ax];u=P[o[0]===ax?o[1]:o[0]];}else{u=P[o[0]];v=P[o[1]];}
    uv[i*2]=u/sc+o0;uv[i*2+1]=v/sc+o0*0.37;}
  g.setAttribute('uv',new THREE.BufferAttribute(uv,2));return g;
}
function rvCylUV(g,r,h,sc,off){   // cylindre vertical : u autour, v le long du fil
  const uv=g.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*Math.PI*2*r/sc+(off||0),uv.getY(i)*h/sc+(off||0)*0.53);return g;
}
/* bois de cèdre : texture peinte (veinage, cernes, gerces), patine grise des pluies dehors, pied
   sali et moussu, intérieur resté chaud ; tint : teinte (hinoki plus clair) */
function matCedar(key,tint,o){
  o=o||{};
  const m=new THREE.MeshStandardMaterial({color:new THREE.Color(tint||'#ffffff'),map:tx('wood_cedar'),normalMap:tx('wood_cedar_n'),normalScale:new THREE.Vector2(0.9,0.9),roughness:0.85,metalness:0,envMapIntensity:o.env||0.32});
  return patch(m,{uniforms:{uFL:{value:o.fl||0},uWx:{value:o.wx===undefined?1:o.wx}},
    fHead:'uniform float uFL;uniform float uWx;',
    fColor:`
      {vec3 c=diffuseColor.rgb*1.35;float L=dot(c,vec3(0.3,0.59,0.11));
       float ex=uWx*(0.45+0.55*smoothstep(0.35,0.75,rvFbm3(vRvW*0.35)));
       c=mix(c,vec3(L*1.08,L*1.04,L*0.98)+vec3(0.03),ex*0.42);                       // grisaillement
       float st=smoothstep(0.55,0.85,rvNoise(vec3(vRvW.x*3.0,vRvW.y*0.25,vRvW.z*3.0)))*uWx;c*=1.0-st*0.22;   // coulures
       float foot=smoothstep(0.9,0.0,vRvW.y-uFL)*uWx;c=mix(c,c*vec3(0.55,0.5,0.42),foot*0.7);       // pied sali
       c=mix(c,vec3(0.16,0.24,0.07),foot*smoothstep(0.45,0.75,rvFbm3(vRvW*2.2))*0.75);           // mousse
       diffuseColor.rgb=c;}`,
    fRough:`roughnessFactor=mix(0.78,0.96,texture2D(normalMap,vNormalMapUv).a);`,
  },'cedar_'+key);
}

function diffuseTone(m,c){m.color.set(c);}
function buildFinCaves(FN,fins){
  const caves=[];
  const SHF=FN.shrineFloor;
  const FL=SHF+0.34;                        // dessus du plancher
  const X=3.6,PH=5.5,YT=FL+PH;              // demi-entraxe des piliers, hauteur des piliers
  const Ex=5.6,Ez=5.6,ye=YT+0.3,yr=YT+4.6,XG=2.75,yg=ye+0.46*(yr-ye),zg=Ez*(1-(yg-ye)/(yr-ye)),TH=1.2;   // toit
  const ybot=(z)=>ye-TH+(yr-ye)*(1-Math.abs(z)/Ez);   // dessous du chaume (versants avant/arrière), à la profondeur z

  const woodM=matCedar('ext','#f2e6da',{fl:FL});
  const woodIn=matCedar('int','#e0c8ae',{fl:FL,wx:0.25});
  const hinokiM=matCedar('hin','#fff3e2',{fl:FL,wx:0,env:0.45});
  const thatchM=patch(new THREE.MeshStandardMaterial({color:new THREE.Color('#ffffff'),map:tx('thatch'),normalMap:tx('thatch_n'),normalScale:new THREE.Vector2(1.2,1.2),roughness:0.95,metalness:0,side:THREE.DoubleSide,envMapIntensity:0.45}),{
    vHead:'varying vec3 vRvL;',vMain:'vRvL=transformed;',fHead:'varying vec3 vRvL;',
    fColor:`
      {vec3 q=vRvL;vec3 c=diffuseColor.rgb;
       float up=smoothstep(0.2,0.8,vRvN.y);
       c=mix(c,c*vec3(0.62,0.6,0.55),smoothstep(0.45,0.8,rvFbm3(q*0.5))*0.45);            // chaume ancien, plus sombre
       float ms=smoothstep(0.58,0.78,rvFbm3(q*0.7+4.0))*up;                                 // mousse en plaques sur les versants
       c=mix(c,mix(vec3(0.15,0.24,0.06),vec3(0.3,0.36,0.12),rvNoise(q*7.0)),ms*0.85);
       float under=smoothstep(-0.2,-0.7,vRvN.y);c*=mix(1.0,0.55,under);                    // dessous, dans l'ombre
       diffuseColor.rgb=c;}`,
    fRough:`roughnessFactor=0.92;`,
  },'shrinethatch2');
  const stoneM=patch(new THREE.MeshStandardMaterial({color:new THREE.Color('#ffffff'),roughness:0.9,metalness:0,envMapIntensity:0.6}),{
    vHead:'varying vec3 vRvL;varying vec3 vRvLN;',vMain:'vRvL=transformed;vRvLN=objectNormal;',
    fHead:'varying vec3 vRvL;varying vec3 vRvLN;float rvMs=0.0;float rvJt=0.0;',
    fColor:`
      vec3 an=abs(vRvLN);vec2 q2=an.y>0.6?vRvL.xz/vec2(1.3,1.3):(an.x>an.z?vec2(vRvL.z/1.15,vRvL.y/0.48):vec2(vRvL.x/1.15,vRvL.y/0.48));
      q2.x+=step(0.5,fract(q2.y*0.5))*0.5;vec2 fq=abs(fract(q2)-0.5);rvJt=smoothstep(0.455,0.49,max(fq.x,fq.y));
      vec3 q=vRvW*0.9;float n1=rvFbm(q*0.8);
      vec3 st=mix(vec3(0.33,0.33,0.31),vec3(0.55,0.54,0.5),n1)*mix(0.86,1.08,rvHash(vec3(floor(q2),5.0)));
      st*=1.0-smoothstep(0.6,0.85,rvFbm3(q*2.2))*0.25;
      float up=smoothstep(0.15,0.75,vRvN.y);
      rvMs=clamp(up*smoothstep(0.45,0.7,rvFbm3(q*1.6+3.0))*0.8+rvJt*smoothstep(0.35,0.6,rvFbm3(q*2.0+1.0))+smoothstep(0.66,0.85,rvFbm3(q*1.2+9.0))*0.5,0.0,1.0);
      vec3 moss=mix(vec3(0.12,0.21,0.05),vec3(0.3,0.4,0.1),rvFbm3(q*6.0))*mix(0.8,1.1,rvNoise(q*30.0));
      st=mix(st,vec3(0.12,0.12,0.1),rvJt*0.75);st=mix(st,moss,rvMs);
      float li=smoothstep(0.78,0.86,rvNoise(q*3.5+7.0))*(1.0-rvMs);st=mix(st,vec3(0.64,0.64,0.52),li*0.6);
      diffuseColor.rgb=st;`,
    fRough:`roughnessFactor=mix(0.85,0.98,rvMs);`,
    fNormal:`{vec3 q=vRvW*0.9;float hb=rvFbm(q*1.4)*0.06+rvNoise(q*14.0)*0.012-rvJt*0.05+rvMs*rvNoise(q*40.0)*0.02;normal=rvPerturb(-vViewPosition,normal,hb,1.0);}`,
  },'shrinestone');
  const copperM=patch(new THREE.MeshStandardMaterial({color:new THREE.Color('#5d8a72'),roughness:0.55,metalness:0.55,envMapIntensity:0.9}),{
    fColor:`diffuseColor.rgb=mix(vec3(0.42,0.27,0.16),vec3(0.36,0.58,0.48),smoothstep(0.3,0.7,rvFbm3(vRvW*4.0)));`},'shrinecopper');
  const ropeM=patch(new THREE.MeshStandardMaterial({color:new THREE.Color('#cdbd92'),roughness:0.9}),{
    vHead:'varying vec2 vRvU;',vMain:'vRvU=uv;',fHead:'varying vec2 vRvU;',
    fColor:`diffuseColor.rgb*=mix(0.78,1.05,smoothstep(-0.6,0.6,sin(vRvU.x*260.0+vRvU.y*6.2832*2.0)));`,
    fNormal:`normal=rvPerturb(-vViewPosition,normal,sin(vRvU.x*260.0+vRvU.y*6.2832*2.0)*0.008,1.0);`},'shrinerope');
  const paperM=new THREE.MeshStandardMaterial({color:new THREE.Color('#e4ddcd'),roughness:0.85,side:THREE.DoubleSide});
  const clothM=patch(new THREE.MeshStandardMaterial({color:new THREE.Color('#ffffff'),roughness:0.85,side:THREE.DoubleSide}),{
    vHead:'varying vec2 vRvU;',vMain:'vRvU=uv;',fHead:'varying vec2 vRvU;',
    fColor:`{float u=vRvU.x*7.2;float band=step(0.5,fract(u*0.5));                                   // lés alternés blanc / violet
       vec2 c=vec2(fract(u)-0.5,(vRvU.y-0.5)*1.5);float mon=smoothstep(0.24,0.22,length(c))*smoothstep(0.14,0.16,length(c));   // blason (anneau)
       vec3 col=mix(vec3(0.93,0.92,0.88),vec3(0.3,0.12,0.36),band);col=mix(col,mix(vec3(0.3,0.12,0.36),vec3(0.93,0.92,0.88),band),mon);
       col*=mix(0.82,1.0,0.5+0.5*sin(vRvU.x*90.0));diffuseColor.rgb=col;}`},'shrinecloth');
  const washiM=patch(new THREE.MeshStandardMaterial({color:new THREE.Color('#ffffff'),map:tx('washi'),roughness:0.85,emissive:new THREE.Color('#ffb46a'),emissiveIntensity:1}),{
    fEmissive:`totalEmissiveRadiance*=texture2D(map,vMapUv).a*(0.18+1.4*uLantern)*(0.92+0.08*sin(uTime*7.0+vRvW.x*3.0));`},'shrinewashi');
  diffuseTone(washiM,'#d9cbb2');
  // papier des shōji : lumière du jour qui traverse (plus dense là où les fibres s'accumulent)
  const shojiM=patch(new THREE.MeshStandardMaterial({color:new THREE.Color('#e6dccb'),map:tx('washi'),roughness:0.9,side:THREE.DoubleSide,emissive:new THREE.Color('#fff1da'),emissiveIntensity:1}),{
    fEmissive:`totalEmissiveRadiance*=(1.15-texture2D(map,vMapUv).a*0.7)*(0.32+0.25*uLum)*(1.0-0.6*uLantern)+vec3(1.0,0.62,0.3)*uLantern*0.12;`},'shrineshoji');
  const bronzeM=patch(new THREE.MeshStandardMaterial({color:new THREE.Color('#4a5a44'),roughness:0.5,metalness:0.7,envMapIntensity:1.0}),{
    fColor:`diffuseColor.rgb=mix(vec3(0.3,0.24,0.15),vec3(0.3,0.48,0.4),smoothstep(0.35,0.75,rvFbm3(vRvW*5.0)));`},'shrinebronze');
  const lanternM=patch(new THREE.MeshStandardMaterial({color:new THREE.Color('#ffffff'),roughness:0.9}),{
    vHead:'attribute float aPart;varying float vPart;varying vec3 vLo;',vMain:'vPart=aPart;vLo=position;',
    fHead:'varying float vPart;varying vec3 vLo;float rvWinL=0.0;',
    fColor:`float n=rvFbm3(vLo*7.0+vRvW*0.1);vec3 c=mix(vec3(0.3,0.3,0.27),vec3(0.48,0.47,0.42),n);
      c=mix(c,vec3(0.12,0.22,0.05),smoothstep(0.25,0.75,vRvN.y+(rvNoise(vLo*9.0)-0.5)*0.8)*0.8);
      if(vPart>0.5){float an=atan(vLo.z,vLo.x)+3.14159;float f=fract(an/1.0472);
        float w=step(abs(f-0.5),0.3)*smoothstep(1.22,1.25,vLo.y)*smoothstep(1.49,1.46,vLo.y);rvWinL=w;c=mix(c,vec3(0.05,0.03,0.02),w);}
      diffuseColor.rgb=c;`,
    fEmissive:`{float fl=0.82+0.12*sin(uTime*9.0+vRvW.x*3.0)+0.06*sin(uTime*23.0+vRvW.z);totalEmissiveRadiance+=vec3(1.0,0.58,0.22)*rvWinL*(0.5+3.0*uLantern)*fl;}`},'shrinelant');
  const gravelM=patch(new THREE.MeshStandardMaterial({color:new THREE.Color('#ffffff'),roughness:0.95,metalness:0,envMapIntensity:0.5}),{
    vHead:'varying vec3 vRvL;',vMain:'vRvL=position;',fHead:'varying vec3 vRvL;float rvGh=0.0;',
    fDiscard:`if(abs(vRvL.x)<5.25&&vRvL.y>-5.25&&vRvL.y<5.6)discard;`,
    fColor:`{vec2 p=vRvW.xz;float peb=rvNoise(vec3(p*22.0,1.0))*0.6+rvNoise(vec3(p*55.0,2.0))*0.4;
       float rake=0.5+0.5*sin(-vRvL.y*14.0+sin(vRvL.x*0.6)*0.3);                                     // sillons ratissés
       rvGh=rake*0.02+peb*0.012;
       vec3 c=mix(vec3(0.58,0.57,0.53),vec3(0.82,0.8,0.75),peb)*mix(0.82,1.0,rake);
       float edge=smoothstep(8.0,9.3,length(vRvL.xy));c=mix(c,vec3(0.3,0.33,0.2),edge*0.6);
       diffuseColor.rgb=c;}`,
    fNormal:`normal=rvPerturb(-vViewPosition,normal,rvGh,1.0);`},'shrinegravel');
  const fernM=patch(new THREE.MeshStandardMaterial({color:new THREE.Color('#ffffff'),roughness:0.65,side:THREE.DoubleSide,envMapIntensity:0.5}),{
    uniforms:{uFern:{value:tx('fern')}},
    vHead:'varying vec2 vFU;',vMain:'vFU=vec2(uv.x,0.5-0.5*uv.y);',
    fHead:'uniform sampler2D uFern;varying vec2 vFU;vec4 rvT=vec4(1.0);',
    fDiscard:'rvT=texture2D(uFern,vFU);if(rvT.a<0.42)discard;',
    fColor:'diffuseColor.rgb*=rvT.rgb*1.35;'},'shrinefern');

  fins.forEach((F,i)=>{
    const P=F.plat.P.clone();const gy=finField(P.x,P.z).h;
    const az=-0.36,dir=new THREE.Vector3(Math.sin(az),0,Math.cos(az));
    const grp=new THREE.Group();grp.position.set(P.x,0,P.z);grp.rotation.y=az;FN.root.add(grp);
    if(F.plat.ped)F.plat.ped.visible=false;   // l'ancien socle laisse la place à la table d'offrandes
    const rr=mulberry32(7171+i);
    const parts={wood:[],woodIn:[],hinoki:[],stone:[],thatch:[],copper:[],rope:[],paper:[],cloth:[],washi:[],bronze:[],shoji:[]};
    const bx=(list,w,h,d,x,y,z,ax,r,off)=>{let g=new RoundedBoxGeometry(w,h,d,2,r===undefined?0.02:r);if(ax!==undefined&&ax>=0)g=rvWoodUV(g,ax,0.7,off===undefined?rr()*7:off);g.translate(x,y,z);list.push(g);return g;};
    const sbox=(w,h,d,x,y,z,r)=>{const g=new RoundedBoxGeometry(w,h,d,2,r||0.04);g.translate(x,y,z);parts.stone.push(g);};

    /* ── soubassement de granit, marches, véranda ── */
    sbox(10.6,SHF-gy+0.3,10.6,0,(SHF+gy-0.3)/2,0,0.06);
    sbox(10.9,0.12,10.9,0,SHF-0.04,0,0.04);                                                  // margelle
    for(let k=0;k<3;k++){const h=(SHF-gy)*(k+1)/3;sbox(3.4,h,0.55,0,gy+h/2,5.3+0.55*(3-k)-0.27,0.04);}
    /* plancher : lames de cèdre (fil selon x), véranda à l'avant, poutre de rive */
    for(let k=0;k<14;k++){const z=-X-0.25+k*0.6;bx(parts.woodIn,2*X+0.7,0.1,0.585,0,FL-0.05,z+0.29,0);}
    bx(parts.wood,2*X+0.9,0.22,0.22,0,FL-0.14,X+1.2,0);
    for(const sx of [-1,1])bx(parts.wood,0.22,0.22,2*X+1.4,sx*(X+0.35),FL-0.14,0.35,2);
    for(let k=-2;k<=2;k++){const g=new THREE.CylinderGeometry(0.11,0.12,FL-SHF-0.2,10);rvCylUV(g,0.11,FL-SHF,0.7,rr()*5);g.translate(k*1.75,SHF+(FL-SHF-0.2)/2,X+1.1);parts.wood.push(g);}
    bx(parts.wood,2.6,0.16,0.5,0,SHF+0.08,X+1.55,0);                                         // marche de bois
    { // jupe sombre sous le plancher (on ne voit pas le vide sous la véranda)
      const g=new THREE.BoxGeometry(2*X+0.2,FL-SHF-0.12,0.05);g.translate(0,SHF+(FL-SHF-0.12)/2,X+0.9);parts.woodIn.push(rvWoodUV(g,0,0.7,1.3));}

    /* ── piliers : pierres d'assise, bagues de cuivre, fûts de cèdre ── */
    const posts=[[-X,-X],[X,-X],[-X,X],[X,X],[-X,0],[X,0],[0,-X],[-1.8,-X],[1.8,-X]];   // l'avant reste grand ouvert
    posts.forEach(([x,z])=>{
      const c=new THREE.CylinderGeometry(0.2,0.215,PH+0.3,18,1);rvCylUV(c,0.2,PH,0.7,rr()*9);c.translate(x,FL-0.3+(PH+0.3)/2,z);parts.wood.push(c);
      const s=new THREE.CylinderGeometry(0.36,0.42,0.16,14);s.translate(x,SHF+0.02,z);parts.stone.push(s);
      const b=new THREE.CylinderGeometry(0.225,0.23,0.22,18);b.translate(x,FL+0.11,z);parts.copper.push(b);
      // consoles : bloc daito et bras le long du mur
      bx(parts.wood,0.5,0.26,0.5,x,YT+0.12,z,1,0.03);
      const along=Math.abs(z)>X-0.01?0:2;bx(parts.wood,along===0?1.3:0.22,0.2,along===0?0.22:1.3,x,YT+0.34,z,along,0.02);
      for(const s2 of [-0.5,0,0.5])bx(parts.wood,0.24,0.14,0.24,x+(along===0?s2:0),YT+0.5,z+(along===2?s2:0),1,0.02);
    });
    /* tirants (kashira-nuki) avec abouts saillants, sablière, nageshi, tirant bas, seuil */
    const ring=(y,h,d,list,ends)=>{const L=2*X+(ends?1.0:0.4);
      bx(list,L,h,d,0,y,X,0);bx(list,L,h,d,0,y,-X,0);bx(list,d,h,L,X,y,0,2);bx(list,d,h,L,-X,y,0,2);};
    ring(YT-0.55,0.32,0.24,parts.wood,true);
    ring(YT+0.62,0.3,0.32,parts.wood,true);
    for(const [y,h] of [[FL+2.45,0.24],[FL+1.15,0.18],[FL+0.06,0.14]]){bx(parts.wood,2*X+0.3,h,0.12,0,y,-X-0.18,0);for(const sx of [-1,1])bx(parts.wood,0.12,h,2*X+0.3,sx*(X+0.18),y,0,2);}
    /* mur du fond : planches verticales ; côtés : lambris bas + claire-voie */
    for(let x=-X+0.17;x<X-0.1;x+=0.33){bx(parts.woodIn,0.325,YT-0.7-FL,0.06,x,(FL+YT-0.7)/2,-X+0.02+rr()*0.015,1,0.008);}
    for(const sx of [-1,1]){
      for(let k=0;k<4;k++)bx(parts.woodIn,0.06,0.26,2*X-0.3,sx*X,FL+0.15+k*0.26,0,2,0.008);
      // shōji : quatre panneaux par côté, cadre, petits bois (kumiko), papier éclairé par le jour
      const y0=FL+1.12,y1=YT-0.72,hp=y1-y0;
      for(const zc of [-2.7,-0.9,0.9,2.7]){const wp=1.72;
        for(const dz of [-1,1])bx(parts.woodIn,0.07,hp,0.06,sx*(X-0.04),y0+hp/2,zc+dz*wp/2,1,0.008);
        for(const yy of [y0+0.03,y1-0.03])bx(parts.woodIn,0.07,0.06,wp,sx*(X-0.04),yy,zc,2,0.008);
        for(const off of [-0.05,0.012]){   // petits bois des deux côtés du papier (vus du dedans comme du dehors)
          for(let k=1;k<5;k++)bx(off<0?parts.woodIn:parts.wood,0.03,hp,0.022,sx*(X+off),y0+hp/2,zc-wp/2+k*wp/5,1,0.004);
          for(let k=1;k<8;k++)bx(off<0?parts.woodIn:parts.wood,0.03,0.022,wp,sx*(X+off),y0+k*hp/8,zc,2,0.004);}
        const pg=new THREE.PlaneGeometry(wp,hp);const pu=pg.attributes.uv;for(let k=0;k<pu.count;k++)pu.setXY(k,pu.getX(k)*wp/0.9,pu.getY(k)*hp/0.9);
        pg.rotateY(sx>0?-Math.PI/2:Math.PI/2);pg.translate(sx*(X-0.02),y0+hp/2,zc);parts.shoji.push(pg);}}
    /* plafond à caissons */
    {const g=new THREE.BoxGeometry(2*X,0.04,2*X);g.translate(0,YT-0.18,0);parts.woodIn.push(rvWoodUV(g,0,0.7,2.1));
     for(let k=-3;k<=3;k++){bx(parts.woodIn,2*X,0.12,0.1,0,YT-0.24,k*1.0,0,0.01);bx(parts.woodIn,0.1,0.12,2*X,k*1.0,YT-0.24,0,2,0.01);}}
    /* chevrons apparents sous l'avant-toit (versants avant, arrière, côtés), hors des angles */
    {const rafter=(x0,z0,x1,z1,y0,y1,list)=>{const A=new THREE.Vector3(x0,y0,z0),B=new THREE.Vector3(x1,y1,z1);const d=B.clone().sub(A),L=d.length();
        let g=new THREE.BoxGeometry(0.09,0.12,L);g=rvWoodUV(g,2,0.7,rr()*5);g.translate(0,0,L/2);
        g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),d.normalize()));g.translate(A.x,A.y,A.z);list.push(g);};
     for(let x=-Ex+1.0;x<=Ex-1.0;x+=0.34)for(const sz of [-1,1])rafter(x,sz*(X-0.1),x,sz*(Ez-0.12),ybot(X-0.1)-0.07,ybot(Ez-0.12)-0.07,parts.wood);
     const yside=(x)=>ye-TH+(yg-ye)*(Ex-Math.abs(x))/(Ex-XG);
     for(let z=-Ez+1.0;z<=Ez-1.0;z+=0.34)for(const sx of [-1,1])rafter(sx*(X-0.1),z,sx*(Ex-0.12),z,yside(X-0.1)-0.07,yside(Ex-0.12)-0.07,parts.wood);}

    /* ── toit de chaume en demi-croupe ── */
    {const tri=[];const T3=(a,b,c)=>tri.push(a,b,c);const Q=(a,b,c,d)=>{T3(a,b,c);T3(a,c,d);};
     const V=(x,y,z)=>new THREE.Vector3(x,y,z);
     const top=(dy)=>{const s=[];   // dessus (dy=0) ou dessous (dy=-TH) : versants avant/arrière (hexagones) et croupes
       for(const sz of [1,-1]){const A=V(-Ex,ye+dy,sz*Ez),B=V(Ex,ye+dy,sz*Ez),C=V(XG,yg+dy,sz*zg),D=V(XG,yr+dy,0),E=V(-XG,yr+dy,0),Fq=V(-XG,yg+dy,sz*zg);
         s.push(sz>0?[A,B,C]:[B,A,Fq],sz>0?[A,C,Fq]:[B,Fq,C],sz>0?[Fq,C,D]:[C,Fq,E],sz>0?[Fq,D,E]:[C,E,D]);}
       for(const sx of [1,-1]){const a=V(sx*Ex,ye+dy,-Ez),b=V(sx*Ex,ye+dy,Ez),c=V(sx*XG,yg+dy,zg),d=V(sx*XG,yg+dy,-zg);
         s.push(sx>0?[a,c,b]:[a,b,c],sx>0?[a,d,c]:[a,c,d]);}
       return s;};
     top(0).forEach(t=>T3(...t));
     top(-TH).forEach(t=>T3(t[0],t[2],t[1]));                                          // dessous (normales inversées)
     // bords taillés : pourtour de l'égout, rampants des pignons, pied des pignons
     const edge=(a,b)=>{Q(a.clone().add(V(0,-TH,0)),b.clone().add(V(0,-TH,0)),b,a);};
     edge(V(-Ex,ye,Ez),V(Ex,ye,Ez));edge(V(Ex,ye,-Ez),V(-Ex,ye,-Ez));edge(V(Ex,ye,Ez),V(Ex,ye,-Ez));edge(V(-Ex,ye,-Ez),V(-Ex,ye,Ez));
     for(const sx of [1,-1])for(const sz of [1,-1]){const c=V(sx*XG,yg,sz*zg),d=V(sx*XG,yr,0);if(sx*sz>0)edge(c,d);else edge(d,c);}
     for(const sx of [1,-1]){const c=V(sx*XG,yg,zg),d=V(sx*XG,yg,-zg);if(sx>0)edge(d,c);else edge(c,d);}
     // subdivision + gonflement du chaume (même déplacement pour un même point : pas de fissure)
     let T=tri;for(let lv=0;lv<3;lv++){const o=[];for(let k=0;k<T.length;k+=3){const a=T[k],b=T[k+1],c=T[k+2];const ab=a.clone().lerp(b,0.5),bc=b.clone().lerp(c,0.5),ca=c.clone().lerp(a,0.5);o.push(a,ab,ca,ab,b,bc,ca,bc,c,ab,bc,ca);}T=o;}
     const pos=new Float32Array(T.length*3);T.forEach((v,k)=>{const d=(vn3(v.x*0.45+3.1,v.y*0.45,v.z*0.45)-0.5)*0.32;pos.set([v.x,v.y+d,v.z],k*3);});
     const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.computeVertexNormals();
     // coordonnées : les tiges suivent la pente (v ~ hauteur), u le long de l'égout
     const nn=g.attributes.normal,uv=new Float32Array(T.length*2);
     for(let k=0;k<T.length;k++){const x=pos[k*3],y=pos[k*3+1],z=pos[k*3+2];const nx=Math.abs(nn.getX(k)),nz=Math.abs(nn.getZ(k)),ny=Math.abs(nn.getY(k));
       const u=(nz>nx?x:z)/2.6,v=(ny<0.35?y*1.6:y*1.15+(nz>nx?Math.abs(z):Math.abs(x))*0.4)/2.6;uv[k*2]=u;uv[k*2+1]=v;}
     g.setAttribute('uv',new THREE.BufferAttribute(uv,2));parts.thatch.push(g);
     // faîtage couvert, katsuogi, chigi croisés ; pignons de bois et bardeaux de rive
     bx(parts.wood,2*XG+0.9,0.5,0.95,0,yr+0.05,0,0,0.12);
     bx(parts.wood,2*XG+1.1,0.18,0.5,0,yr+0.36,0,0,0.05);
     for(let k=0;k<5;k++){const g2=new THREE.CylinderGeometry(0.15,0.15,1.35,12);rvCylUV(g2,0.15,1.35,0.7,k);g2.rotateX(Math.PI/2);g2.translate(-XG+0.4+k*(2*XG-0.8)/4,yr+0.6,0);parts.wood.push(g2);}
     for(const sx of [-1,1]){
       for(const sz of [-1,1]){const A=new THREE.Vector3(sx*(XG+0.12),yg-0.25,sz*(zg+0.2)),B=new THREE.Vector3(sx*(XG+0.12),yr+1.25,-sz*0.75);   // chevron de rive prolongé en chigi
         const d=B.clone().sub(A),L=d.length();let g2=new THREE.BoxGeometry(0.09,0.36,L);g2=rvWoodUV(g2,2,0.7,rr()*4);g2.translate(0,0,L/2);
         g2.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),d.normalize()));g2.translate(A.x,A.y,A.z);parts.wood.push(g2);}
       // pignon : planches verticales (triangle)
       const sh=new THREE.Shape();sh.moveTo(-zg+0.15,yg-0.1);sh.lineTo(zg-0.15,yg-0.1);sh.lineTo(0,yr-0.15);sh.lineTo(-zg+0.15,yg-0.1);
       const pg=new THREE.ShapeGeometry(sh);const pu=pg.attributes.uv;for(let k=0;k<pu.count;k++)pu.setXY(k,pu.getX(k)/0.7,pu.getY(k)/0.7);
       pg.rotateY(sx>0?Math.PI/2:-Math.PI/2);pg.translate(sx*(XG-0.02),0,0);parts.wood.push(pg);
       // ornement suspendu (gegyo) sous le faîte
       bx(parts.wood,0.08,0.5,0.4,sx*(XG+0.1),yr-0.55,0,1,0.03);}
    }

    /* ── rideau (blanc et violet) sous le tirant avant, corde sacrée et ses papiers ── */
    {const W=2*X-0.2,Hc=0.4;const g=new THREE.PlaneGeometry(W,Hc,60,4);const p=g.attributes.position;
     for(let k=0;k<p.count;k++){const x=p.getX(k),y=p.getY(k);p.setZ(k,Math.sin(x*5.2)*0.05*(0.5-y/Hc)+Math.sin(x*1.3)*0.02);}
     g.computeVertexNormals();g.translate(0,YT-0.62-Hc/2,X+0.15);parts.cloth.push(g);}
    {const pts=[];for(let k=0;k<=28;k++){const u=k/28;pts.push(new THREE.Vector3(-X+0.15+u*(2*X-0.3),YT-0.6-Math.sin(u*Math.PI)*0.3,X+0.32));}
     const c=new THREE.CatmullRomCurve3(pts);parts.rope.push(new THREE.TubeGeometry(c,90,0.13,10,false));
     for(const u of [0.12,0.3,0.7,0.88]){const p=c.getPoint(u);const pos=[];const W=0.17,Hh=0.14;
       for(let k=0;k<4;k++){const y0=p.y-0.12-k*Hh,xo=(k%2?1:-1)*0.05;pos.push(xo-W/2,y0,0,xo+W/2,y0,0,xo+W/2,y0-Hh,0,xo-W/2,y0,0,xo+W/2,y0-Hh,0,xo-W/2,y0-Hh,0);}
       const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.translate(p.x,0,p.z+0.08);g.computeVertexNormals();parts.paper.push(g);}}

    /* ── intérieur : table d'offrandes (hassokuan), gohei, lanternes de papier ── */
    const AT=FL+0.8;
    bx(parts.hinoki,3.15,0.07,1.75,0,AT-0.035,0,0,0.015);
    for(const sx of [-1,1]){bx(parts.hinoki,0.09,0.08,1.6,sx*1.28,AT-0.11,0,2,0.01);bx(parts.hinoki,0.14,0.06,1.75,sx*1.34,FL+0.03,0,2,0.01);
      for(const z of [-0.6,-0.2,0.2,0.6]){let g=new RoundedBoxGeometry(0.065,0.72,0.08,1,0.012);g=rvWoodUV(g,1,0.7,rr()*3);g.rotateZ(sx*0.07);g.translate(sx*1.31,FL+0.38,z);parts.hinoki.push(g);}}
    for(const sx of [-1,1]){   // gohei : socle, baguette, papiers en zigzag
      bx(parts.hinoki,0.28,0.14,0.28,sx*2.0,FL+0.07,-0.3,1,0.02);
      const r=new THREE.CylinderGeometry(0.018,0.02,1.6,8);rvCylUV(r,0.02,1.6,0.7,sx);r.translate(sx*2.0,FL+0.9,-0.3);parts.hinoki.push(r);
      for(const s2 of [-1,1]){const pos=[];const W=0.075,Hh=0.11;for(let k=0;k<5;k++){const y0=FL+1.62-k*Hh,xo=s2*0.07+(k%2?0.035:-0.035)*s2;pos.push(xo-W/2,y0,0,xo+W/2,y0,0,xo+W/2,y0-Hh,0,xo-W/2,y0,0,xo+W/2,y0-Hh,0,xo-W/2,y0-Hh,0);}
        const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.translate(sx*2.0,0,-0.3);g.computeVertexNormals();parts.paper.push(g);}}
    for(const sx of [-1,1]){   // andon : cadre de bois, panneaux de washi lumineux
      const ax=sx*2.65,az2=-2.5,h=1.05;
      for(const dx of [-1,1])for(const dz of [-1,1])bx(parts.woodIn,0.045,h,0.045,ax+dx*0.25,FL+h/2,az2+dz*0.25,1,0.006);
      for(const y of [FL+0.08,FL+h-0.03])bx(parts.woodIn,0.56,0.05,0.56,ax,y,az2,0,0.01);
      const w=new THREE.BoxGeometry(0.48,h-0.2,0.48);const wu=w.attributes.uv;for(let k=0;k<wu.count;k++)wu.setXY(k,wu.getX(k)*0.9,wu.getY(k)*1.6);w.translate(ax,FL+h/2,az2);parts.washi.push(w);}
    /* lanternes de bronze suspendues aux angles avant */
    for(const sx of [-1,1]){const lx=sx*(X+0.85),lz=X+0.85,ly=YT-0.25;
      for(let k=0;k<6;k++){const an=k/6*Math.PI*2;const bar=new THREE.BoxGeometry(0.035,0.5,0.035);bar.translate(lx+Math.cos(an)*0.19,ly,lz+Math.sin(an)*0.19);parts.bronze.push(bar);}
      for(const yy of [-0.24,0.24]){const rg=new THREE.CylinderGeometry(0.21,0.21,0.04,6);rg.translate(lx,ly+yy,lz);parts.bronze.push(rg);}
      {const inner=new THREE.CylinderGeometry(0.17,0.15,0.46,6);inner.translate(lx,ly,lz);parts.washi.push(inner);}
      const roof=new THREE.ConeGeometry(0.36,0.26,6);roof.translate(lx,ly+0.38,lz);parts.bronze.push(roof);
      const fin=new THREE.SphereGeometry(0.06,8,6);fin.translate(lx,ly+0.56,lz);parts.bronze.push(fin);
      const base=new THREE.CylinderGeometry(0.22,0.14,0.08,6);base.translate(lx,ly-0.29,lz);parts.bronze.push(base);
      const ch=new THREE.CylinderGeometry(0.012,0.012,ybot(lz)-(ly+0.56),5);ch.translate(lx,(ly+0.56+ybot(lz))/2,lz);parts.bronze.push(ch);}

    const add=(list,m,cast)=>{if(!list.length)return null;const g=rvMerge(list);const me=new THREE.Mesh(g,m);me.castShadow=cast!==false;me.receiveShadow=true;grp.add(me);return me;};
    add(parts.stone,stoneM);add(parts.wood,woodM);add(parts.woodIn,woodIn);add(parts.hinoki,hinokiM);add(parts.thatch,thatchM);add(parts.copper,copperM);
    add(parts.rope,ropeM);add(parts.paper,paperM,false);add(parts.cloth,clothM);add(parts.washi,washiM,false);add(parts.bronze,bronzeM);add(parts.shoji,shojiM,false);
    // l'objet repose sur la table (plus de lévitation)
    F.plat.top=AT;F.plat.lift=0.0;F.plat.bob=0;

    /* parvis de gravier ratissé (disque autour du soubassement) */
    {const g=new THREE.CircleGeometry(9.3,72);const gm=new THREE.Mesh(g,gravelM);gm.rotation.x=-Math.PI/2;gm.position.set(0,gy+0.03,0);gm.receiveShadow=true;grp.add(gm);}
    /* lanternes de pierre sur le parvis */
    {const lg=lanternGeo();for(const sx of [-1,1]){const lm=new THREE.Mesh(lg,lanternM);lm.position.set(sx*3.6,gy+0.02,7.9);lm.scale.setScalar(1.4);lm.rotation.y=0.4*sx;lm.castShadow=true;lm.receiveShadow=true;grp.add(lm);}}
    /* fougères au pied du soubassement */
    {const FG=fernGeo(7,0.75);const spots=[];
     for(let k=0;k<64;k++){const side=k%4,t=rr()*2-1;let x,z;const d=5.45+rr()*0.9;
       if(side===0){x=t*5.6;z=-d;}else if(side===1){x=d;z=t*5.6;}else if(side===2){x=-d;z=t*5.6;}else{x=t*5.6;z=d;if(Math.abs(x)<2.2)continue;}
       spots.push([x,z,0.6+rr()*0.7,rr()*6.28]);}
     const M=new THREE.InstancedMesh(FG,fernM,spots.length);const m4=new THREE.Matrix4(),q=new THREE.Quaternion();
     spots.forEach(([x,z,s,a],k)=>{q.setFromAxisAngle(new THREE.Vector3(0,1,0),a);m4.compose(new THREE.Vector3(x,gy,z),q,new THREE.Vector3(s,s*(0.8+rr()*0.4),s));M.setMatrixAt(k,m4);M.setColorAt(k,new THREE.Color().setHSL(0.23+rr()*0.05,0.5,0.42+rr()*0.15));});
     M.castShadow=true;M.receiveShadow=true;grp.add(M);}

    // lumières : lampe chaude devant l'objet, lueur des lanternes de papier
    const objL=new THREE.PointLight(new THREE.Color('#ffd9b0'),0,14,1.4);FN.root.add(objL);
    const inL=new THREE.PointLight(new THREE.Color('#ffb36a'),0,9,1.6);inL.position.set(0,FL+1.1,-2.3).applyAxisAngle(new THREE.Vector3(0,1,0),az).add(new THREE.Vector3(P.x,0,P.z));FN.root.add(inL);
    const haloU={uK:{value:0},uCol:{value:new THREE.Color('#ffe2b8')}};
    const halo=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.ShaderMaterial({uniforms:haloU,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
      vertexShader:`varying vec2 vQ;void main(){vQ=position.xy*2.0;vec4 mv=modelViewMatrix*vec4(0.0,0.0,0.0,1.0);mv.xy+=position.xy*vec2(length(modelMatrix[0].xyz),length(modelMatrix[1].xyz));gl_Position=projectionMatrix*mv;}`,
      fragmentShader:`uniform float uK;uniform vec3 uCol;varying vec2 vQ;void main(){float r=length(vQ);float a=(exp(-r*r*5.0)*0.4+exp(-r*r*40.0)*0.2)*uK;if(a<0.003)discard;gl_FragColor=vec4(uCol*a,a);}`}));
    halo.renderOrder=7;halo.frustumCulled=false;FN.root.add(halo);
    const sid='ink_'+F.sj.key;
    // point d'approche loin devant et bas : la ligne de vue vers l'objet passe sous l'avant-toit
    const top=P.clone().addScaledVector(dir,30);top.y=3.0;
    caves.push({F,grp,R:13,H:9,OC:0,gy,dir,objL,inL,halo,haloU,shaftU:{uK:{value:0}},sid,played:false,ct:-1,here:false,top});
  });

  const _v=new THREE.Vector3();
  /* arrivée (à CHAQUE visite) : l'objet se trace à l'encre en descendant sur la table, le lavis
     remplit la forme, puis le fléau reçoit une poussée et s'équilibre (oscillation amortie, les
     plateaux suivent avec une légère traîne). La maîtrise ne cache plus l'objet : elle le fait passer
     de la sculpture de lavis monochrome (0 %) à la matière (laiton, or, laque) à 100 %. */
  function update(dt,T,cam,P){
    caves.forEach((C,i)=>{
      const F=C.F;const o=P-(P_FIN+i);
      if(Math.abs(o)>0.75&&C.here){C.here=false;C.ct=-1;C.played=false;}
      if(!C.here&&Math.abs(o)<0.3&&P>=P_FIN-0.15){C.here=true;C.ct=0;}
      if(C.ct>=0)C.ct+=dt;
      const t=WARMING?99:(C.ct<0?0:C.ct);
      const TD=2.4;   // durée du tracé à l'encre
      const draw=smooth(0,TD,t),solid=smooth(TD*0.6,TD+1.2,t);
      if(!C.played&&t>=TD+1.2){C.played=true;seenSave(C.sid,1);}
      const f=clamp01(F.f);
      F.obj.wetU.uSolid.value=solid;
      if(F.obj.wetU.uWash)F.obj.wetU.uWash.value=1-smooth(0.06,0.9,f);
      F.sf.SU.uForm.value=1;F.sf.SU.uDraw.value=draw;F.sf.SU.uInk.value=1-smooth(0.3,1.0,solid);
      F.arrK=1-smooth(0,TD+1.0,t);
      if(F.obj.setBeam){const ts=t-(TD+1.0);let a=Math.sin(T*0.5+i)*0.01,w=Math.cos(T*0.5+i)*0.005;
        if(ts>0&&ts<14){const e=Math.exp(-ts/2.0),ph=ts*3.0;a+=-0.17*e*Math.sin(ph);w+=-0.17*e*(3.0*Math.cos(ph)-Math.sin(ph)/2.0);}
        F.obj.setBeam(a,w);}
      F.holder.updateMatrixWorld();_v.set(0,F.obj.height*0.55,0);F.holder.localToWorld(_v);FN.root.worldToLocal(_v);
      C.halo.position.copy(_v);
      C.objL.position.copy(_v).addScaledVector(C.dir,2.6);C.objL.position.y+=1.4;
      C.objL.intensity=(9+15*f)*solid;
      C.inL.intensity=5+9*U.uLantern.value;
      C.haloU.uK.value=(0.1+0.4*f)*solid;const hs=(1.4+F.obj.height*1.0)*(0.7+0.5*f);C.halo.scale.set(hs,hs,1);
    });
  }
  function replay(){caves.forEach(C=>{C.played=false;C.here=false;C.ct=-1;});}
  return {caves,update,replay};
}

/* ═══ 36 · Moteur d'analyse RVISION_INSIGHT v4, repris de l'index L1 ═══
   Le code ci-dessous est celui de l'index (12 dimensions, 20 profils, micro-notions, signaux,
   recommandations), isolé dans son propre espace de noms, avec la même carte des notions
   (NOTION_MAP) et la même lecture des données INSIGHT de chaque cours (dont le cas particulier
   de la filiation). Les « points à revoir » des grottes en sortent directement.
   ▸ AJOUTER LES NOTIONS D'UN COURS : une entrée dans NOTION_MAP_L1 (même format que l'index). */
const NOTION_MAP_L1 = {
  // ── Droit Civil · Personnalité Juridique ─────────────────────
  'pj-cours': {
    label:'Personnalité Juridique — Cours', course:'dc_pj',
    notions:[
      {id:'pj001',name:'Personnalité juridique — définition & fondement',complexity:2,file:'droit_civil_personnalite_L2_v5.html',page:'cours',tab:'c1',search:'Personnalité juridique'},
      {id:'pj002',name:'Attribution à la naissance — conditions cumulatives',complexity:3,file:'droit_civil_personnalite_L2_v5.html',page:'cours',tab:'c1',search:'Attribution à la naissance'},
      {id:'pj003',name:'Infans conceptus — fiction juridique',complexity:3,file:'droit_civil_personnalite_L2_v5.html',page:'cours',tab:'c1',search:'infans conceptus'},
      {id:'pj004',name:'Disparition & Absence — régimes distincts',complexity:3,file:'droit_civil_personnalite_L2_v5.html',page:'cours',tab:'c2',search:'Absence'},
      {id:'pj005',name:'Personnes morales — conditions de naissance',complexity:3,file:'droit_civil_personnalite_L2_v5.html',page:'cours',tab:'c2',search:'Personnes morales'},
      {id:'pj006',name:'État civil — actes, registres & officier',complexity:2,file:'droit_civil_personnalite_L2_v5.html',page:'cours',tab:'c3',search:'État civil'},
      {id:'pj007',name:'Nom de famille — attribution, immuabilité, changement',complexity:3,file:'droit_civil_personnalite_L2_v5.html',page:'cours',tab:'c4',search:'Nom de famille'},
      {id:'pj008',name:'Domicile — unicité, distinction résidence, élection',complexity:2,file:'droit_civil_personnalite_L2_v5.html',page:'cours',tab:'c4',search:'Domicile'},
      {id:'pj009',name:'Art. 16 — Primauté de l\'être humain',complexity:2,file:'droit_civil_personnalite_L2_v5.html',page:'articles',tab:null,search:'Art. 16'},
      {id:'pj010',name:'Changement de sexe — loi 2016, CEDH 2017-2021',complexity:4,file:'droit_civil_personnalite_L2_v5.html',page:'cours',tab:'c3',search:'Changement de sexe'},
      {id:'pj011',name:'Art. 2284 — Droit de gage général (Aubry & Rau)',complexity:4,file:'droit_civil_personnalite_L2_v5.html',page:'articles',tab:null,search:'Art. 2284'},
      {id:'pj012',name:'Protection des majeurs — tutelle, curatelle, sauvegarde',complexity:3,file:'droit_civil_personnalite_L2_v5.html',page:'cours',tab:'c2',search:'protection'},
    ],
  },
  // ── Droit Civil · Incapacité Juridique ─────────────────────────
  'inc-cours': {
    label:'Incapacité Juridique — Cours', course:'dc_inc',
    notions:[
      {id:'inc001',name:'Distinction jouissance / exercice — fondement',complexity:2,file:'droit_civil_incapacite_v4.html',page:'cours',tab:'c1',search:'jouissance'},
      {id:'inc002',name:'Art. 425 — Double condition cumulative (alteration + impossibilite)',complexity:3,file:'droit_civil_incapacite_v4.html',page:'cours',tab:'c1',search:'Art. 425'},
      {id:'inc003',name:'Art. 428 — Subsidiarite : hierarchie imperative des mesures',complexity:4,file:'droit_civil_incapacite_v4.html',page:'cours',tab:'c1',search:'subsidiarite'},
      {id:'inc004',name:'Sauvegarde de justice — maintien de la capacite (art. 435)',complexity:2,file:'droit_civil_incapacite_v4.html',page:'cours',tab:'c2',search:'sauvegarde'},
      {id:'inc005',name:'Curatelle — assistance et double signature (art. 467)',complexity:3,file:'droit_civil_incapacite_v4.html',page:'cours',tab:'c2',search:'curatelle'},
      {id:'inc006',name:'Tutelle — representation generale (art. 473) et actes de disposition (art. 505)',complexity:4,file:'droit_civil_incapacite_v4.html',page:'cours',tab:'c2',search:'tutelle'},
      {id:'inc007',name:'Art. 465 — Nullite de plein droit vs nullite sur preuve de prejudice',complexity:5,file:'droit_civil_incapacite_v4.html',page:'cours',tab:'c3',search:'Art. 465'},
      {id:'inc008',name:'Mandat de protection future — conditions, formes, effets (art. 477-483)',complexity:4,file:'droit_civil_incapacite_v4.html',page:'cours',tab:'c3',search:'mandat de protection'},
      {id:'inc009',name:'Administration legale — pouvoirs des parents (art. 382-387)',complexity:3,file:'droit_civil_incapacite_v4.html',page:'cours',tab:'c4',search:'administration legale'},
      {id:'inc010',name:'Art. 414-3 — Responsabilite civile de l incapable (Ass. Plen. 1984)',complexity:4,file:'droit_civil_incapacite_v4.html',page:'juris',tab:null,search:'Derguini'},
      {id:'inc011',name:'Loi 2007 — Tournant paradigmatique : subsidiarite, proportionnalite, autonomie',complexity:3,file:'droit_civil_incapacite_v4.html',page:'cours',tab:'c1',search:'loi 2007'},
      {id:'inc012',name:'CEDH Shtukaturov — proportionnalite et recours effectif obligatoires',complexity:4,file:'droit_civil_incapacite_v4.html',page:'juris',tab:null,search:'Shtukaturov'},
    ],
  },
  // ── Droit Civil mariage/divorce ──────────────────────────────
  'page-cours': {
    label:'Cours principal', course:'dc',
    notions:[
      {id:'art212',name:'Art. 212 — Devoirs réciproques (respect, fidélité, secours, assistance)',complexity:2,file:'droit_civil_mariage_divorce2.html',page:'cours',tab:'c1',search:'§ 1. Le devoir de respect'},
      {id:'art213',name:'Art. 213 — Direction morale et matérielle de la famille',complexity:2,file:'droit_civil_mariage_divorce2.html',page:'cours',tab:'c1',search:'§ 6. Les devoirs communs'},
      {id:'art215',name:'Art. 215 — Communauté de vie & protection logement familial',complexity:3,file:'droit_civil_mariage_divorce2.html',page:'cours',tab:'c1',search:'La communauté de vie'},
      {id:'art214',name:'Art. 214 — Contribution aux charges du mariage',complexity:3,file:'droit_civil_mariage_divorce2.html',page:'cours',tab:'c2',search:'§ 5. La contribution aux charges'},
      {id:'art220',name:'Art. 220 — Solidarité des dettes ménagères',complexity:3,file:'droit_civil_mariage_divorce2.html',page:'cours',tab:'c2',search:'La solidarité des dettes'},
      {id:'art221',name:'Art. 221-225 — Autonomies bancaire, mobilière, professionnelle',complexity:2,file:'droit_civil_mariage_divorce2.html',page:'cours',tab:'c2',search:'autonomies'},
      {id:'art217',name:'Art. 217 — Habilitation judiciaire',complexity:2,file:'droit_civil_mariage_divorce2.html',page:'cours',tab:'c2',search:'Habilitation judiciaire'},
      {id:'art230',name:'Art. 230 — Divorce par consentement mutuel',complexity:2,file:'droit_civil_mariage_divorce2.html',page:'cours',tab:'c3',search:'Le divorce par consentement mutuel'},
      {id:'art242',name:'Art. 242 — Divorce pour faute (violation grave et renouvelée)',complexity:4,file:'droit_civil_mariage_divorce2.html',page:'cours',tab:'c3',search:'§ 5. Le divorce pour faute'},
      {id:'art246',name:'Art. 246 — Passerelle CM → faute',complexity:3,file:'droit_civil_mariage_divorce2.html',page:'cours',tab:'c3',search:'Passerelle'},
      {id:'art247',name:'Art. 247-1 — Passerelle acceptation → CM',complexity:3,file:'droit_civil_mariage_divorce2.html',page:'cours',tab:'c3',search:'Passerelle'},
      {id:'art249',name:'Art. 249 — Altération définitive du lien conjugal',complexity:3,file:'droit_civil_mariage_divorce2.html',page:'cours',tab:'c3',search:'L\'altération définitive'},
      {id:'art270',name:'Art. 270 — Prestation compensatoire (principe)',complexity:3,file:'droit_civil_mariage_divorce2.html',page:'cours',tab:'c4',search:'Prestation compensatoire'},
      {id:'art271',name:'Art. 271 — Critères de la PC (8 critères)',complexity:4,file:'droit_civil_mariage_divorce2.html',page:'cours',tab:'c4',search:'critères'},
      {id:'art274',name:'Art. 274 — Formes de la PC (capital vs rente)',complexity:3,file:'droit_civil_mariage_divorce2.html',page:'cours',tab:'c4',search:'formes'},
      {id:'cedh2025',name:'CEDH H.W. c. France 23 jan. 2025 — fin du devoir conjugal',complexity:5,file:'droit_civil_mariage_divorce2.html',page:'juris',tab:null,search:'H.W.'},
      {id:'art264',name:'Art. 264 — Nom après divorce (règle + exceptions)',complexity:2,file:'droit_civil_mariage_divorce2.html',page:'cours',tab:'c4',search:'Art. 264'},
    ],
  },
  // ── Histoire I (Ancien Régime) ────────────────────────────────
  'page-chronologie':{label:'Chronologie',course:'h1',notions:[
    {id:'chron_ar',name:'Chronologie Ancien Régime (événements clés)',complexity:2,file:'histoire_12.html',page:'page-chronologie',tab:null},
  ]},
  'page-fiches':{label:'Fiches de révision',course:'h1',notions:[
    {id:'fiche_parl',name:'Les parlements — composition, résistance, remontrances',complexity:4,file:'histoire_12.html',page:'page-fiches',tab:null,search:'parlements'},
    {id:'fiche_noblesse',name:'Noblesse — types, privilèges, anoblissement',complexity:3,file:'histoire_12.html',page:'page-fiches',tab:null,search:'Noblesse'},
    {id:'fiche_lumiere',name:'Lumières — Montesquieu, Rousseau, Voltaire, contrat social',complexity:4,file:'histoire_12.html',page:'page-fiches',tab:null,search:'Lumières'},
    {id:'fiche_conseil',name:'Conseil royal — structure, attributions',complexity:3,file:'histoire_12.html',page:'page-fiches',tab:null,search:'Conseil'},
  ]},
  // ── Histoire II (Révolution) ──────────────────────────────────
  'page-cours':{label:'Cours Révolution',course:'h2',notions:[
    {id:'rev_1789',name:'1789 — États généraux, serment du Jeu de Paume, DDHC',complexity:3,file:'Histoire_22.html',page:'page-cours',tab:null,search:'États généraux'},
    {id:'rev_const',name:'Constitution civile du clergé — schisme, réfractaires',complexity:4,file:'Histoire_22.html',page:'page-cours',tab:null,search:'Constitution civile'},
    {id:'rev_conv',name:'Convention — Girondins vs Montagnards, procès Louis XVI',complexity:4,file:'Histoire_22.html',page:'page-cours',tab:null,search:'Convention'},
    {id:'rev_terreur',name:'Terreur — Comité de salut public, loi des suspects',complexity:4,file:'Histoire_22.html',page:'page-cours',tab:null,search:'Terreur'},
    {id:'rev_therm',name:'Thermidor — chute Robespierre, réaction thermidorienne',complexity:3,file:'Histoire_22.html',page:'page-cours',tab:null,search:'Thermidor'},
    {id:'rev_const93',name:'Constitution 1793 (non appliquée) vs Constitution 1795',complexity:5,file:'Histoire_22.html',page:'page-cours',tab:null,search:'Constitution 1793'},
  ]},
  // ── Droit Constitutionnel L1 — Fondamentaux ────────────────────
  'th-constitution':{label:'La Constitution',course:'co_l1',notions:[
    {id:'col1_burdeau',name:'Burdeau — triple fondement de la Constitution (1980)',complexity:3,file:'droit_constitutionnel_L1.html',page:'page-cours',tab:'th-constitution',search:'Burdeau'},
    {id:'col1_kelsen',name:'Kelsen — Constitution matérielle vs formelle (1962)',complexity:4,file:'droit_constitutionnel_L1.html',page:'page-cours',tab:'th-constitution',search:'Kelsen'},
    {id:'col1_bloc',name:'Bloc de constitutionnalité — CC 71-44 DC, Favoreu',complexity:3,file:'droit_constitutionnel_L1.html',page:'page-cours',tab:'th-constitution',search:'bloc de constitutionnalité'},
    {id:'col1_ivg',name:'Constitutionnalisation IVG 2024 — art. 34, premier pays mondial',complexity:3,file:'droit_constitutionnel_L1.html',page:'page-cours',tab:'th-constitution',search:'IVG'},
    {id:'col1_schmitt',name:'Schmitt — Constitution vs loi constitutionnelle, décision politique',complexity:5,file:'droit_constitutionnel_L1.html',page:'page-cours',tab:'th-constitution',search:'Schmitt'},
    {id:'col1_rigidite',name:'Rigidité constitutionnelle — fondement de la suprématie formelle',complexity:3,file:'droit_constitutionnel_L1.html',page:'page-cours',tab:'th-constitution',search:'rigidité'},
  ]},
  'th-constituant':{label:'Pouvoir constituant',course:'co_l1',notions:[
    {id:'col1_art89',name:'Art. 89 — révision, double voie (Congrès 3/5e / référendum)',complexity:3,file:'droit_constitutionnel_L1.html',page:'page-cours',tab:'th-constituant',search:'Art. 89'},
    {id:'col1_cc92',name:'CC 92-312 DC — souveraineté du pouvoir constituant dérivé',complexity:4,file:'droit_constitutionnel_L1.html',page:'page-cours',tab:'th-constituant',search:'92-312'},
    {id:'col1_cc2003',name:'CC 2003-469 DC — incompétence absolue pour contrôler révisions',complexity:4,file:'droit_constitutionnel_L1.html',page:'page-cours',tab:'th-constituant',search:'2003-469'},
    {id:'col1_limites',name:'Limites explicites (art. 89) vs implicites (identité constitutionnelle)',complexity:4,file:'droit_constitutionnel_L1.html',page:'page-cours',tab:'th-constituant',search:'Limites explicites'},
    {id:'col1_clausetern',name:"Clause d'éternité — art. 79 al. 3 LF, BVerfG, Kesavananda 1973",complexity:5,file:'droit_constitutionnel_L1.html',page:'page-cours',tab:'th-constituant',search:"clause d'éternité"},
  ]},
  'th-etat':{label:"L'État",course:'co_l1',notions:[
    {id:'col1_souv',name:'Souveraineté — qualité non puissance, Carré de Malberg 1920',complexity:3,file:'droit_constitutionnel_L1.html',page:'page-cours',tab:'th-etat',search:'souveraineté'},
    {id:'col1_unitaire',name:'État unitaire décentralisé — art. 1er C° 1958, réforme 2003',complexity:2,file:'droit_constitutionnel_L1.html',page:'page-cours',tab:'th-etat',search:'unitaire'},
    {id:'col1_federal',name:'État fédéral (Allemagne) vs État régional (Espagne) — comparatif',complexity:3,file:'droit_constitutionnel_L1.html',page:'page-cours',tab:'th-etat',search:'fédéral'},
    {id:'col1_corse91',name:'CC 91-290 DC — peuple français unitaire, refus du peuple corse',complexity:4,file:'droit_constitutionnel_L1.html',page:'page-cours',tab:'th-etat',search:'Corse'},
    {id:'col1_idconstit',name:'Identité constitutionnelle de la France — CC 2006-540 DC, primauté UE',complexity:4,file:'droit_constitutionnel_L1.html',page:'page-cours',tab:'th-etat',search:'identité constitutionnelle'},
  ]},
  'th-separation':{label:'Séparation des pouvoirs',course:'co_l1',notions:[
    {id:'col1_montesq',name:'Montesquieu — tripartition canonique, De l\'Esprit des lois 1748',complexity:3,file:'droit_constitutionnel_L1.html',page:'page-cours',tab:'th-separation',search:'Montesquieu'},
    {id:'col1_duguit',name:'Duguit 1928 — Montesquieu n\'a jamais employé séparation des pouvoirs',complexity:4,file:'droit_constitutionnel_L1.html',page:'page-cours',tab:'th-separation',search:'Duguit'},
    {id:'col1_locke',name:'Locke — fragilité humaine, Traité du gouvernement civil 1690',complexity:3,file:'droit_constitutionnel_L1.html',page:'page-cours',tab:'th-separation',search:'Locke'},
    {id:'col1_qpc',name:'QPC art. 61-1 — contrôle a posteriori concret depuis 2010',complexity:3,file:'droit_constitutionnel_L1.html',page:'page-cours',tab:'th-separation',search:'QPC'},
    {id:'col1_debre58',name:'Debré 1958 — dogme caduc mais nécessaire fonctionnellement',complexity:3,file:'droit_constitutionnel_L1.html',page:'page-cours',tab:'th-separation',search:'Debré'},
  ]},
  'th-democratie':{label:'La Démocratie',course:'co_l1',notions:[
    {id:'col1_souv_nat',name:'Souveraineté nationale (Sieyès) vs populaire (Rousseau) — art. 3 C°',complexity:4,file:'droit_constitutionnel_L1.html',page:'page-cours',tab:'th-democratie',search:'souveraineté nationale'},
    {id:'col1_mandat',name:'Mandat représentatif (art. 27 C°) vs mandat impératif',complexity:3,file:'droit_constitutionnel_L1.html',page:'page-cours',tab:'th-democratie',search:'mandat représentatif'},
    {id:'col1_suffrage',name:'Suffrage universel — 1848 masculin, 1944 féminin, 1974 18 ans',complexity:2,file:'droit_constitutionnel_L1.html',page:'page-cours',tab:'th-democratie',search:'suffrage universel'},
    {id:'col1_drousse',name:'D. Rousseau 2014 — dépossession référendaire, TCE 2005 → Lisbonne 2008',complexity:5,file:'droit_constitutionnel_L1.html',page:'page-cours',tab:'th-democratie',search:'dépossession'},
    {id:'col1_rip',name:'RIP art. 11 al. 3 — 1/5e parlementaires + 1/10e électeurs, jamais abouti',complexity:4,file:'droit_constitutionnel_L1.html',page:'page-cours',tab:'th-democratie',search:'RIP'},
    {id:'col1_art11',name:'Art. 11 — référendum législatif, usages gaulliens, révision 2008',complexity:3,file:'droit_constitutionnel_L1.html',page:'page-cours',tab:'th-democratie',search:'Art. 11'},
  ]},
  // ── Droit Constitutionnel ────────────────────────────────────
  'page-executif':{label:"L'exécutif",course:'co',notions:[
    {id:'co_pdre',name:"Président — élection, pouvoirs propres, art. 5, 8, 12, 16",complexity:4,file:'Droit_Constitution_executif_v2.html',page:'page-cours',tab:null,search:'L\'élection présidentielle'},
    {id:'co_pm',name:'Premier ministre — nomination, responsabilité, art. 21',complexity:3,file:'Droit_Constitution_executif_v2.html',page:'page-cours',tab:null,search:'Le Gouvernement'},
    {id:'co_cohabit',name:'Cohabitation — rapports de force, domaines réservés',complexity:5,file:'Droit_Constitution_executif_v2.html',page:'page-cours',tab:null,search:'La Cohabitation'},
    {id:'co_art49',name:'Art. 49-3 — engagement de responsabilité, motion de censure',complexity:5,file:'Droit_Constitution_executif_v2.html',page:'page-cours',tab:null,search:'responsabilité'},
    {id:'co_ord',name:'Ordonnances art. 38 — habilitation, ratification',complexity:4,file:'Droit_Constitution_executif_v2.html',page:'page-cours',tab:null,search:'Les Ordonnances de l\'Article 38'},
  ]},
  // ── Conseil Constitutionnel ──────────────────────────────────
  'c-bloc1':{label:'Composition & Nomination',course:'co2',notions:[
    {id:'cc_art56',name:'Art. 56 — Composition, mandat 9 ans, renouvellement par tiers',complexity:2,file:'conseil_constitutionnel_v5.html',page:'page-cours',tab:'c-bloc1',search:'Art. 56'},
    {id:'cc_membres_droit',name:'Membres de droit — anciens PR, absence de serment et discipline',complexity:3,file:'conseil_constitutionnel_v5.html',page:'page-cours',tab:'c-bloc1',search:'membres de droit'},
    {id:'cc_3_5',name:'Seuil des 3/5e — contrôle parlementaire quasi-infranchissable',complexity:3,file:'conseil_constitutionnel_v5.html',page:'page-cours',tab:'c-bloc1',search:'seuil des 3/5'},
    {id:'cc_ferrand',name:'Affaire Ferrand (2025) — 58/59 contre, nomination maintenue',complexity:4,file:'conseil_constitutionnel_v5.html',page:'page-cours',tab:'c-bloc1',search:'Ferrand'},
    {id:'cc_prop2019',name:'Proposition 2019 — 3 verrous : compétence, délai 10 ans, casier vierge',complexity:4,file:'conseil_constitutionnel_v5.html',page:'page-cours',tab:'c-bloc1',search:'trois verrous'},
    {id:'cc_badinter',name:'Badinter 2012 — asymétrie membres nommés vs membres de droit',complexity:3,file:'conseil_constitutionnel_v5.html',page:'page-cours',tab:'c-bloc1',search:'Badinter'},
    {id:'cc_jeanneney',name:'Jeanneney 2022 — défaut comportemental vs institutionnel des auditions',complexity:3,file:'conseil_constitutionnel_v5.html',page:'page-cours',tab:'c-bloc1',search:'Jeanneney'},
  ]},
  'c-bloc2':{label:'Rôle & Nature juridictionnelle',course:'co2',notions:[
    {id:'cc_art61',name:'Art. 61 — Contrôle a priori, saisine obligatoire et facultative',complexity:2,file:'conseil_constitutionnel_v5.html',page:'page-cours',tab:'c-bloc2',search:'Art. 61'},
    {id:'cc_art61_1',name:'Art. 61-1 — QPC, contrôle a posteriori, filtre CE/Cass',complexity:3,file:'conseil_constitutionnel_v5.html',page:'page-cours',tab:'c-bloc2',search:'QPC'},
    {id:'cc_art62',name:'Art. 62 — Autorité absolue de chose jugée (formule à retenir)',complexity:2,file:'conseil_constitutionnel_v5.html',page:'page-cours',tab:'c-bloc2',search:'Art. 62'},
    {id:'cc_debre',name:'Debré 1958 — CC comme régulateur parlementaire, rejet modèle américain',complexity:3,file:'conseil_constitutionnel_v5.html',page:'page-cours',tab:'c-bloc2',search:'Debré'},
    {id:'cc_hochmann',name:'Hochmann 2019 — motivation obscure, obstacle à la Cour de référence',complexity:5,file:'conseil_constitutionnel_v5.html',page:'page-cours',tab:'c-bloc2',search:'Hochmann'},
    {id:'cc_roblot',name:'Roblot-Troizier 2023 — double ambiguïté congénitale, hiatus QPC',complexity:5,file:'conseil_constitutionnel_v5.html',page:'page-cours',tab:'c-bloc2',search:'double ambiguïté'},
    {id:'cc_rrapi',name:'Rrapi 2018 — arbre (membres de droit) et forêt (vrais problèmes)',complexity:3,file:'conseil_constitutionnel_v5.html',page:'page-cours',tab:'c-bloc2',search:'arbre'},
    {id:'cc_warsmann',name:'Warsmann 2009 — CC comme rouage du pouvoir législatif',complexity:4,file:'conseil_constitutionnel_v5.html',page:'page-cours',tab:'c-bloc2',search:'Warsmann'},
  ]},
  // ── Marchés & Marchandisation ─────────────────────────────────
  'page-marches':{label:'Marchés & Marchandisation',course:'mk',notions:[
    {id:'mk_callon',name:'Callon — théorie de la performativité des marchés',complexity:5,file:'marches_marchandisation_vF2.html',page:'page-marches',tab:null,search:'performativité'},
    {id:'mk_fiske',name:"Fiske — 4 modes d'échange",complexity:4,file:'marches_marchandisation_vF2.html',page:'page-marches',tab:null,search:'Les modèles relationnels de Fiske'},
    {id:'mk_elster',name:'Elster — normes sociales vs rationalité économique',complexity:4,file:'marches_marchandisation_vF2.html',page:'page-marches',tab:null,search:'Les modes d\'allocation identifiés par Elster'},
    {id:'mk_sandel',name:'Sandel — limites morales du marché',complexity:4,file:'marches_marchandisation_vF2.html',page:'page-marches',tab:null,search:'corruption'},
    {id:'mk_hodgson',name:'Hodgson — institutions et habitudes, néo-institutionnalisme',complexity:4,file:'marches_marchandisation_vF2.html',page:'page-marches',tab:null,search:'Hodgson'},
    {id:'mk_gale',name:'Gale-Shapley — algorithme de stable matching',complexity:5,file:'marches_marchandisation_vF2.html',page:'page-marches',tab:null,search:'mariage stable'},
    {id:'mk_marchandisation',name:'Marchandisation — processus, critique, limites',complexity:3,file:'marches_marchandisation_vF2.html',page:'page-marches',tab:null,search:'Qu\'est-ce que la marchandisation'},
  ]},
  // ── Droit Civil · Filiation & Autorité Parentale ─────────────
  'fil-cours':{label:'Filiation — Cours',course:'dc_fil',notions:[
    {id:'fil001',name:'Art. 310-1 — 4 modes légaux d\'établissement de la filiation',complexity:2,file:'droit_civil_filiation_autorite_parentale.html',page:'cours',tab:'c1',search:'modes'},
    {id:'fil002',name:'Possession d\'état — art. 311-1 · Nomen, Tractatus, Fama',complexity:3,file:'droit_civil_filiation_autorite_parentale.html',page:'cours',tab:'c1',search:'possession d\'état'},
    {id:'fil003',name:'Art. 311-2 — 4 caractères : continue, paisible, publique, non équivoque',complexity:3,file:'droit_civil_filiation_autorite_parentale.html',page:'cours',tab:'c1',search:'caractères'},
    {id:'fil004',name:'Présomption pater is est — art. 312 · écartement et rétablissement',complexity:3,file:'droit_civil_filiation_autorite_parentale.html',page:'cours',tab:'c2',search:'pater is est'},
    {id:'fil005',name:'Reconnaissance volontaire — art. 316 · effet relatif, formes authentiques',complexity:3,file:'droit_civil_filiation_autorite_parentale.html',page:'cours',tab:'c1',search:'reconnaissance'},
    {id:'fil006',name:'Art. 333 al. 2 — inattaquabilité à 5 ans (titre + possession d\'état)',complexity:4,file:'droit_civil_filiation_autorite_parentale.html',page:'cours',tab:'c2',search:'inattaquable'},
    {id:'fil007',name:'Actions en filiation — prescription 10 ans (art. 321), délais spéciaux',complexity:4,file:'droit_civil_filiation_autorite_parentale.html',page:'cours',tab:'c2',search:'prescription'},
    {id:'fil008',name:'Accouchement sous X — CNAOP 2002, CEDH Odièvre 2003',complexity:4,file:'droit_civil_filiation_autorite_parentale.html',page:'juris',tab:'j1',search:'Odièvre'},
    {id:'fil009',name:'Adoption plénière vs simple — rupture totale vs maintien lien biologique',complexity:4,file:'droit_civil_filiation_autorite_parentale.html',page:'cours',tab:'c3',search:'adoption'},
    {id:'fil010',name:'PMA — filiation par reconnaissance conjointe anticipée (art. 342-10 à 342-13)',complexity:5,file:'droit_civil_filiation_autorite_parentale.html',page:'cours',tab:'c4',search:'PMA'},
    {id:'fil011',name:'GPA — prohibition art. 16-7, ordre public international, reconnaissance',complexity:5,file:'droit_civil_filiation_autorite_parentale.html',page:'cours',tab:'c4',search:'GPA'},
  ]},
  'fil-ap':{label:'Autorité parentale',course:'dc_fil',notions:[
    {id:'ap001',name:'Art. 371-1 — définition, droits et devoirs, finalité',complexity:2,file:'droit_civil_filiation_autorite_parentale.html',page:'cours',tab:'c5',search:'autorité parentale'},
    {id:'ap002',name:'Exercice conjoint — loi 4 mars 2002 · art. 372',complexity:3,file:'droit_civil_filiation_autorite_parentale.html',page:'cours',tab:'c5',search:'exercice conjoint'},
    {id:'ap003',name:'Art. 373-2 — continuité après séparation, principe fondamental',complexity:3,file:'droit_civil_filiation_autorite_parentale.html',page:'cours',tab:'c5',search:'séparation'},
    {id:'ap004',name:'Délégation de l\'exercice — art. 377 · tiers, beau-parent, familles recomposées',complexity:4,file:'droit_civil_filiation_autorite_parentale.html',page:'cours',tab:'c5',search:'délégation'},
    {id:'ap005',name:'Retrait partiel vs total — art. 378-1, DASEM, enfant en danger',complexity:4,file:'droit_civil_filiation_autorite_parentale.html',page:'cours',tab:'c5',search:'retrait'},
    {id:'ap006',name:'Jouissance légale — art. 386-1, fruits des biens jusqu\'à 16 ans',complexity:3,file:'droit_civil_filiation_autorite_parentale.html',page:'cours',tab:'c6',search:'jouissance légale'},
  ]},
  'fil-juris':{label:'Jurisprudence Filiation',course:'dc_fil',notions:[
    {id:'fjur001',name:'Cass. 1re civ. 2019 — reconnaissance mensongère frauduleuse, art. 336',complexity:4,file:'droit_civil_filiation_autorite_parentale.html',page:'juris',tab:'j2',search:'mensongère'},
    {id:'fjur002',name:'CEDH Odièvre c. France 2003 — marge d\'appréciation, art. 8',complexity:4,file:'droit_civil_filiation_autorite_parentale.html',page:'juris',tab:'j1',search:'Odièvre'},
    {id:'fjur003',name:'Cass. Ass. plén. 2019 — transcription GPA, état civil, intérêt de l\'enfant',complexity:5,file:'droit_civil_filiation_autorite_parentale.html',page:'juris',tab:'j3',search:'transcription'},
  ]},
};
const INSIGHT_L1=(function(){
  const NOTION_MAP=NOTION_MAP_L1;
  let INSIGHT_COURSES=[];
  let readInsight=()=>null;
  function setSource(courses,reader){INSIGHT_COURSES=courses;readInsight=reader;}
/* ────────── code de l'index (inchangé) ────────── */
function fmtDuration(ms){
  const s=Math.round(ms/1000);
  if(s<60) return s+'s';
  const m=Math.floor(s/60),sec=s%60;
  if(m<60) return m+'min'+(sec>0?' '+sec+'s':'');
  return Math.floor(m/60)+'h '+(m%60)+'min';
}
function hex2rgb(h){
  const r=h.replace('#','').match(/../g).map(x=>parseInt(x,16));
  return r.join(',');
}
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function lerp(a,b,t){return a+(b-a)*t;}

/* ══════════════════ SCORING DE BASE ══════════════════ */

function scoreResponseTime(themeData){
  const times=(themeData.responseTimes||[]).filter(t=>t>=300&&t<60000);
  if(!times.length) return null;
  const avg=times.reduce((a,b)=>a+b,0)/times.length;
  if(avg<3000) return 97; if(avg<5000) return 88;
  if(avg<8000) return 74; if(avg<12000) return 58;
  if(avg<18000) return 42; if(avg<28000) return 28;
  return 14;
}

function detectAttentionDrop(themeData){
  const times=(themeData.responseTimes||[]).filter(t=>t>=300&&t<60000);
  if(times.length<5) return {drop:false,ratio:1};
  const half=Math.floor(times.length/2);
  const first=times.slice(0,half).reduce((a,b)=>a+b,0)/half;
  const second=times.slice(half).reduce((a,b)=>a+b,0)/(times.length-half);
  const ratio=second/first;
  return {drop:ratio>1.55, ratio:Math.round(ratio*10)/10};
}

function scoreFCCourse(insightData){
  if(!insightData||!insightData.flashcards) return null;
  const cards=Object.values(insightData.flashcards);
  if(!cards.length) return null;
  let tw=0,ws=0;
  cards.forEach(fc=>{
    const times=(fc.thinkTimesMs||[]).filter(t=>t>=500&&t<120000);
    if(!times.length) return;
    const avg=times.reduce((a,b)=>a+b,0)/times.length;
    const flips=fc.flips||1;
    const s=avg<3000?97:avg<5000?85:avg<8000?70:avg<12000?52:avg<18000?35:18;
    ws+=s*flips; tw+=flips;
  });
  return tw>0?Math.round(ws/tw):null;
}

function scoreBehaviorSection(s){
  if(!s) return 50;
  const visits=Math.max(1,s.visits||1);
  const revScore=visits<=1?100:visits<=2?82:visits<=3?68:visits<=5?50:visits<=8?32:16;
  const hlScore=Math.min(100,(s.highlights||0)*14);
  const msScore=s.mouseActive?72:s._mouseMoves>2?52:32;
  const dwellPerVisit=(s.activeMs||0)/visits;
  // Bonus concentration : dwell élevé mais pas excessif
  const dwellScore=dwellPerVisit<30000?45:dwellPerVisit<120000?75:dwellPerVisit<300000?62:48;
  return clamp(Math.round(revScore*0.38+hlScore*0.22+msScore*0.18+dwellScore*0.22),0,100);
}

function scoreThemeFull(themeData,sectionData){
  const total=(themeData.correct||0)+(themeData.wrong||0);
  if(total<1) return null;
  const partial=total<3;

  const quizRate=(themeData.correct||0)/total;
  let repPenalty=0;
  if(themeData.questions){
    Object.values(themeData.questions).forEach(q=>{
      if((q.wrong||0)>=4) repPenalty+=20;
      else if((q.wrong||0)>=3) repPenalty+=14;
      else if((q.wrong||0)>=2) repPenalty+=7;
    });
  }
  const A1=clamp(quizRate*100-repPenalty,0,100);
  const rtScore=scoreResponseTime(themeData);
  const A2=rtScore!==null?rtScore:55;
  const errStrk=themeData.errorStreak||0;
  const A3=clamp(100-errStrk*20,0,100);
  const quiz=A1*0.5+A2*0.3+A3*0.2;

  const B=scoreBehaviorSection(sectionData);
  const raw=quiz*0.62+B*0.38;
  return {score:clamp(Math.round(raw),0,100),partial,quizRate,A1,A2,A3,B};
}

function scoreCourse(insightData){
  if(!insightData) return null;
  const fc=scoreFCCourse(insightData);
  let ts=[];
  if(insightData.quiz) Object.values(insightData.quiz).forEach(t=>{
    const tot=(t.correct||0)+(t.wrong||0);
    if(tot>=1) ts.push(((t.correct||0)/tot)*100);
  });
  if(!ts.length&&!fc) return null;
  let sc=0,w=0;
  if(ts.length){sc+=(ts.reduce((a,b)=>a+b,0)/ts.length)*0.7;w+=0.7;}
  if(fc!==null){sc+=fc*0.3;w+=0.3;}
  return w>0?Math.round(sc/w):null;
}

function masteryClass(s){return s===null?'unknown':s<40?'red':s<55?'orange':s<75?'blue':'green';}
function masteryColor(s){return s===null?'var(--t3)':s<40?'#ff5f5f':s<55?'#ffaa44':s<75?'#4f9eff':'#52d68a';}

/* ══════════════════ MICRO-PARCELLISATION ══════════════════
   Mappe chaque ID de section/onglet vers :
   - nom lisible
   - notions précises qui la composent
   - poids de complexité (1=facile, 3=dense, 5=très technique)
══════════════════════════════════════════════════════════ */
/* Noms lisibles fallback */
const SECTION_LABELS_EXTRA = {
  'page-accueil':'Accueil','page-quiz':'Quiz','page-flashcards':'Flashcards',
  'page-notions':'Notions clés','page-personnages':'Personnages historiques',
  'page-dissertation':'Dissertation','page-legislature':'Le Parlement',
  'page-relations':'Relations exécutif / législatif','page-auteurs':'Auteurs clés',
  'cours_onglet_mariage':'Formation du mariage','cours_onglet_effets':'Effets du mariage',
  'cours_onglet_divorce':'Causes & procédure du divorce','cours_onglet_effets_div':'Effets du divorce',
};
function secLabel(id){
  if(NOTION_MAP[id]) return NOTION_MAP[id].label;
  return SECTION_LABELS_EXTRA[id]||id.replace(/[-_]/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
}

/* Construire l'URL vers une notion précise dans un cours */
function buildNotionUrl(notion){
  if(!notion||!notion.file) return null;
  let url=notion.file+'?goto='+encodeURIComponent(notion.page||'');
  if(notion.tab) url+='&tab='+encodeURIComponent(notion.tab);
  if(notion.search) url+='&search='+encodeURIComponent(notion.search);
  return url;
}

/* Ouvrir le cours directement à la bonne section */
function goToNotion(notion){
  const url=buildNotionUrl(notion);
  if(url) window.open(url,'_blank');
}

/* ══════════════════ 12 DIMENSIONS ══════════════════
  D1  Vitesse réponse quiz         (0=très lent → 100=très rapide)
  D2  Engagement visuel            (surlignage + souris active)
  D3  Intensité de révision        (revisites, retours cours)
  D4  Fluidité mémorielle          (flashcard hésitation inversée)
  D5  Appétence quiz vs lecture    (ratio questions / dwell)
  D6  Régularité inter-sessions    (nb cours avec >30min actif)
  D7  Résistance à l'erreur        (récupération après erreurs)
  D8  Profondeur d'exploration     (nb sections distinctes visitées)
  D9  Consistance                  (écart-type temps réponse — faible=stable)
  D10 Appétence formules denses    (dwell élevé sections complexes)
  D11 Vitesse d'apprentissage      (score quiz améliore-t-il avec le temps?)
  D12 Autonomie post-erreur        (revient-on au cours après une erreur?)
══════════════════════════════════════════════════════ */
function computeDimensions(allData){
  const dims={D1:50,D2:50,D3:50,D4:50,D5:50,D6:50,D7:50,D8:50,D9:50,D10:50,D11:50,D12:50};
  const acc={};
  for(const k of Object.keys(dims)) acc[k]={sum:0,n:0};
  const add=(k,v)=>{if(v!==null&&!isNaN(v)){acc[k].sum+=v;acc[k].n++;}};

  let activeCourses=0;

  INSIGHT_COURSES.forEach(c=>{
    const d=allData[c.id]; if(!d) return;
    // Exclure les cours survolés (< 2min actif ET < 3 questions)
    const _ms=d.totalActiveMs||0;
    const _qs=Object.values(d.quiz||{}).reduce((s,t)=>(s+(t.correct||0)+(t.wrong||0)),0);
    if(_ms<120000 && _qs<3) return;
    activeCourses++;

    // D1 : vitesse réponse
    if(d.quiz) Object.values(d.quiz).forEach(t=>{
      const rt=scoreResponseTime(t);
      if(rt!==null) add('D1',rt);
    });

    // D2 : engagement visuel
    if(d.sections) Object.values(d.sections).forEach(s=>{
      const hlScore=clamp((s.highlights||0)*15,0,100);
      const msScore=s.mouseActive?78:s._mouseMoves>3?50:25;
      add('D2',(hlScore*0.6+msScore*0.4));
    });

    // D3 : intensité révision
    if(d.sections) Object.values(d.sections).forEach(s=>{
      const v=s.visits||0;
      add('D3',clamp((v-1)*35,0,100));
    });

    // D4 : fluidité mémorielle
    const fc=scoreFCCourse(d); if(fc!==null) add('D4',fc);

    // D5 : ratio quiz / dwell
    const nq=Object.values(d.quiz||{}).reduce((a,t)=>a+(t.correct||0)+(t.wrong||0),0);
    const dwell=Object.values(d.sections||{}).reduce((a,s)=>a+(s.activeMs||0),0)/1000;
    if(dwell>60) add('D5',clamp((nq/(dwell/60))*32,0,100));

    // D6 : régularité (proxy : nb cours avec sessions significatives)
    if((d.totalActiveMs||0)>900000) add('D6',100);
    else if((d.totalActiveMs||0)>300000) add('D6',55);
    else add('D6',15);

    // D7 : résistance à l'erreur (taux de récupération après mauvaises réponses)
    if(d.quiz){
      let totalRecov=0,totalErr=0;
      Object.values(d.quiz).forEach(t=>{
        const wrong=t.wrong||0;
        const correct=t.correct||0;
        const tot=correct+wrong;
        if(tot>=3&&wrong>0){
          // Si après les erreurs le streak remonte → récupération
          const recovScore=clamp(((correct/tot)*100)+(t.streak||0)*5,0,100);
          add('D7',recovScore); totalErr++;
        }
      });
    }

    // D8 : profondeur exploration (nb sections distinctes visitées)
    if(d.sections){
      const nSec=Object.values(d.sections).filter(s=>(s.visits||0)>0).length;
      add('D8',clamp(nSec*15,0,100));
    }

    // D9 : consistance réponse (faible écart-type = stable)
    if(d.quiz) Object.values(d.quiz).forEach(t=>{
      const times=(t.responseTimes||[]).filter(r=>r>=300&&r<60000);
      if(times.length<4) return;
      const avg=times.reduce((a,b)=>a+b,0)/times.length;
      const std=Math.sqrt(times.reduce((a,t)=>a+(t-avg)**2,0)/times.length);
      // Faible std → consistant → score élevé
      const consistScore=clamp(100-(std/avg)*60,0,100);
      add('D9',consistScore);
    });

    // D10 : appétence notions denses (dwell élevé sur sections à complexity>=4)
    if(d.sections) Object.entries(d.sections).forEach(([secId,s])=>{
      const nm=NOTION_MAP[secId];
      if(!nm) return;
      const highComplexNotions=nm.notions.filter(n=>n.complexity>=4).length;
      if(highComplexNotions===0) return;
      const dwellPerVisit=(s.activeMs||0)/Math.max(1,s.visits||1);
      // Dwell long sur sections complexes = appétence technique
      add('D10',clamp((dwellPerVisit/180000)*70,0,100));
    });

    // D11 : vitesse d'apprentissage (amélioration du taux de réussite dans le temps)
    if(d.quiz) Object.values(d.quiz).forEach(t=>{
      const qs=Object.values(t.questions||{});
      if(qs.length<3) return;
      // Proxy : questions répondues plusieurs fois avec amélioration
      const improved=qs.filter(q=>(q.correct||0)>0&&(q.wrong||0)>0&&(q.correct||0)>(q.wrong||0)).length;
      add('D11',clamp((improved/qs.length)*100,0,100));
    });

    // D12 : autonomie post-erreur (revisites après erreurs = self-correction)
    if(d.sections&&d.quiz){
      const totalErrors=Object.values(d.quiz).reduce((a,t)=>a+(t.wrong||0),0);
      const totalRevisits=Object.values(d.sections).reduce((a,s)=>a+Math.max(0,(s.visits||0)-1),0);
      if(totalErrors>0){
        add('D12',clamp((totalRevisits/totalErrors)*40,0,100));
      }
    }
  });

  for(const k of Object.keys(dims)){
    if(acc[k].n>0) dims[k]=Math.round(acc[k].sum/acc[k].n);
  }
  dims._activeCourses=activeCourses;
  dims._dataPoints=Object.values(acc).reduce((a,v)=>a+v.n,0);
  return dims;
}

/* ══════════════════ 20 PROFILS — SCORING PROBABILISTE ══════════════════
   Chaque profil a une fonction score(dims) → 0-100 (probabilité d'appartenance)
   Le profil dominant = celui avec le score le plus élevé
   Les 3 premiers sont affichés avec leur %, le 1er est "actif"
══════════════════════════════════════════════════════════════════════ */
const LEARNER_PROFILES = [
  {
    id:'strategist', label:'Stratège Précis', emoji:'🎯', color:'#6c63ff',
    desc:'Tu traites l\'information de manière chirurgicale. Peu de revisites, réponses rapides et taux d\'erreur bas — tu identifies d\'emblée ce qui est testable et tu y vas directement. Tu n\'es pas là pour tout comprendre, tu es là pour maîtriser ce qui compte.',
    strengths:['Efficacité temporelle élevée','Identification rapide des notions clés','Faible dispersion cognitive'],
    risks:['Peut rater les subtilités doctrinales','Lacunes sur les zones non testées','Fausse confiance possible'],
    advice:(d,notions)=>`Ton ratio quiz/dwell (${d.D5}/100) confirme une approche test-first. ${notions.length?`Reviens sur ${notions[0].name} — c\'est précisément le type de notion que ton profil sous-estime.`:'Anticipe les questions pièges qui jouent sur les exceptions.'}`,
    score:d=>clamp(Math.round((d.D1*0.3+d.D5*0.3+(100-d.D3)*0.2+(100-d.D2)*0.1+d.D7*0.1)),0,100),
    conditions:d=>d.D1>65&&d.D5>60,
  },
  {
    id:'deep_analyst', label:'Analyste en Profondeur', emoji:'🔬', color:'#4f9eff',
    desc:'Tu construis des structures de compréhension denses. Surlignage fréquent, revisites ciblées, temps de réponse mesuré — tu ne mémorises pas, tu comprends. Le risque : t\'attarder trop longtemps sur ce qui est déjà compris.',
    strengths:['Compréhension solide des enchaînements','Mémorisation structurelle durable','Détecte les contradictions dans le cours'],
    risks:['Lenteur relative sur les parties descriptives','Risque de perfectionnisme','Peut perdre le fil de l\'avancement global'],
    advice:(d,notions)=>`Ta dimension D10 (appétence technique : ${d.D10}/100) et D2 (engagement visuel : ${d.D2}/100) te définissent. ${notions.length?`Priorité : ${notions[0].name} — notion que tu as revisitée ${notions[0].visits||'plusieurs'} fois.`:'Tu peux te permettre d\'avancer plus vite sur les sections descriptives.'}`,
    score:d=>clamp(Math.round((d.D2*0.28+(100-d.D1)*0.18+d.D3*0.2+d.D10*0.2+d.D8*0.14)),0,100),
    conditions:d=>d.D2>55&&d.D10>45,
  },
  {
    id:'sprinter', label:'Sprinter Cognitif', emoji:'⚡', color:'#52d68a',
    desc:'Tu avances vite, très vite. Temps de réponse dans le top, peu de revisites, fort appétence quiz — ton cerveau fonctionne en mode scan. Efficace sur les définitions et les règles directes, vulnérable sur les notions qui demandent une mise en contexte.',
    strengths:['Vitesse de traitement élevée','Bonne rétention des règles directes','Endurance cognitive sur de longues sessions'],
    risks:['Articles à nuances (art. 242, 271) sous-estimés','Erreurs sur les exceptions','Peut confondre vitesse et maîtrise'],
    advice:(d,notions)=>`Vitesse D1 : ${d.D1}/100, régularité D9 : ${d.D9}/100. ${d.D9<50?'Ton écart-type de réponse est élevé — tu es rapide mais instable. Ralentis sur les notions à plusieurs conditions cumulatives.':notions.length?`Ralentis spécifiquement sur : ${notions[0].name}.`:'Continue, mais vérifie les notions en orange dans le tableau.'}`,
    score:d=>clamp(Math.round((d.D1*0.38+d.D5*0.25+(100-d.D3)*0.2+(100-d.D10)*0.17)),0,100),
    conditions:d=>d.D1>78,
  },
  {
    id:'rereader', label:'Relecteur Méthodique', emoji:'🔄', color:'#ffaa72',
    desc:'La répétition est ta stratégie. Tu reviens systématiquement sur les sections, tu construis la maîtrise par couches successives. C\'est une approche valide — à condition de ne pas relire passivement mais de t\'auto-tester à chaque passage.',
    strengths:['Mémorisation progressive et solide','Faible oubli sur les sections revisitées','Détecte les incohérences entre passages'],
    risks:['Relecture passive sans bénéfice réel','Temps total de révision élevé','Peut négliger les sections non encore revisitées'],
    advice:(d,notions)=>`D3 (intensité révision) : ${d.D3}/100 — tu revisites beaucoup. ${d.D12>50?`D12 : ${d.D12}/100 — bien, tu reviens au cours après tes erreurs.`:'Mais D12 bas : tu ne reviens pas assez au cours après les erreurs de quiz.'} ${notions.length?`Priorité de relecture : ${notions[0].name}.`:''}`,
    score:d=>clamp(Math.round((d.D3*0.38+d.D4*0.22+(100-d.D5)*0.2+(100-d.D11)*0.2)),0,100),
    conditions:d=>d.D3>55,
  },
  {
    id:'quizzer', label:'Quizzeur Pur', emoji:'🎲', color:'#c084fc',
    desc:'Tu testes avant de comprendre. Le quiz est ton cours. Cette approche de trial-and-error a un avantage neuroscientifique réel (effet testing) — mais elle nécessite un retour immédiat au cours après chaque erreur, que tu ne fais pas toujours.',
    strengths:['Excellent entraînement à l\'examen','L\'effet testing consolide mieux que la relecture','Identifie vite les zones de flou'],
    risks:['Lacunes profondes si on ne revient jamais au cours','Peut apprendre la bonne réponse sans comprendre la règle','Fragilité sur les questions reformulées'],
    advice:(d,notions)=>`D5 : ${d.D5}/100 — fort appétence quiz. D12 : ${d.D12}/100 — ${d.D12>55?'bon, tu reviens au cours après les erreurs.':'critique : tu ne reviens pas assez au cours après tes erreurs. Sans ce retour, le quiz ne consolide rien.'} ${notions.length?`Notion à retourner dans le cours immédiatement : ${notions[0].name}.`:''}`,
    score:d=>clamp(Math.round((d.D5*0.38+(100-d.D3)*0.22+(100-d.D2)*0.2+d.D7*0.2)),0,100),
    conditions:d=>d.D5>70&&d.D3<50,
  },
  {
    id:'flashcard_master', label:'Maître des Flashcards', emoji:'🃏', color:'#ff79c6',
    desc:'Tu fais confiance à la répétition espacée et au rappel actif. Temps d\'hésitation courts, beaucoup de flips — ton système mémoriel est entraîné. La limite est dans les questions de compréhension profonde que les flashcards ne couvrent pas.',
    strengths:['Mémorisation des définitions et règles irréprochable','Rythme de révision efficace','Courbe de progression régulière'],
    risks:['Notions relationnelles (liens entre articles) moins bien mémorisées','Fragile en dissertation si manque de structure'],
    advice:(d,notions)=>`D4 (fluidité mémorielle) : ${d.D4}/100. ${notions.length?`Utilise maintenant les flashcards sur : ${notions[0].name} — c\'est la zone de fragilité identifiée.`:'Crée des flashcards personnalisées sur les notions en orange.'}`,
    score:d=>clamp(Math.round((d.D4*0.45+(100-d.D1)*0.2+(100-d.D5)*0.2+d.D6*0.15)),0,100),
    conditions:d=>d.D4>65,
  },
  {
    id:'deep_thinker', label:'Penseur Lent & Sûr', emoji:'🧠', color:'#a89cff',
    desc:'Tu prends le temps de construire ta réponse. Temps de réponse longs mais écart-type faible — tu es lent et cohérent, pas lent et approximatif. C\'est une signature cognitive de compréhension profonde plutôt que de mémorisation de surface.',
    strengths:['Rarement de mauvaises surprises sur les détails','Compréhension des enchaînements logiques','Faible taux d\'erreur sur les questions complexes'],
    risks:['Pression temporelle à l\'examen','Peut se bloquer sur les formulations inattendues','Tendance à sur-analyser'],
    advice:(d,notions)=>`D1 : ${d.D1}/100 — lent. D9 : ${d.D9}/100 — ${d.D9>65?'mais cohérent, c\'est une force.':'et instable — travaille ta fluidité sur les définitions pures.'} ${notions.length?`Focus sur : ${notions[0].name} — ta compréhension y est incomplète selon les signaux.`:''}`,
    score:d=>clamp(Math.round(((100-d.D1)*0.32+d.D9*0.28+d.D10*0.22+d.D2*0.18)),0,100),
    conditions:d=>d.D1<45&&d.D9>50,
  },
  {
    id:'consistent_worker', label:'Travailleur Régulier', emoji:'📅', color:'#52d68a',
    desc:'Tu ne cherches pas à tout faire en une nuit. Sessions régulières, progression stable — tu laisses la consolidation se faire entre les sessions. La courbe d\'Ebbinghaus travaille pour toi. C\'est le profil le plus favorable à la réussite sur la durée.',
    strengths:['Mémorisation à long terme supérieure','Pas de surcharge cognitive','Progression prévisible et mesurable'],
    risks:['Peut accuser du retard si les révisions s\'espacent trop','Profil qui sous-estime parfois l\'urgence d\'une notion critique'],
    advice:(d,notions)=>`D6 : ${d.D6}/100 — régularité solide. ${notions.length?`Ne laisse pas traîner : ${notions[0].name} est une lacune identifiée — règle-la à la prochaine session (dans 24-48h max).`:'Maintiens cette régularité, elle est ton plus grand avantage.'}`,
    score:d=>clamp(Math.round((d.D6*0.38+d.D9*0.25+d.D3*0.2+d.D7*0.17)),0,100),
    conditions:d=>d.D6>55,
  },
  {
    id:'visual_mapper', label:'Cartographe Visuel', emoji:'👁️', color:'#ff8c5a',
    desc:'Tu apprends en interagissant avec la page. Surlignages fréquents, mouvement souris actif sur les sections clés — tu cartographies mentalement le cours. Les schémas et tableaux sont tes alliés naturels.',
    strengths:['Mémorisation spatiale forte','Bonne structuration des notions','Retrouve facilement dans le cours'],
    risks:['Fragile sans support visuel (examen blanc)','Peut manquer des notions non mises en avant'],
    advice:(d,notions)=>`D2 : ${d.D2}/100. ${notions.length?`Tu as particulièrement interagi avec la zone de ${notions[0].name} — approfondis-la.`:'Crée tes propres schémas sur les notions en rouge.'}`,
    score:d=>clamp(Math.round((d.D2*0.42+(100-d.D1)*0.2+d.D8*0.22+(100-d.D5)*0.16)),0,100),
    conditions:d=>d.D2>68,
  },
  {
    id:'avoider', label:'Éviteur de Difficulté', emoji:'🌊', color:'#ffaa44',
    desc:'Tu contournes l\'inconfort cognitif. Dwell faible sur les sections difficiles, peu d\'interactions sur les notions techniques — tu avances mais tu laisses derrière toi des zones non travaillées. Ce profil est normal au début d\'une session, problématique si persistant.',
    strengths:['Progression subjective rapide','Peu de blocages psychologiques'],
    risks:['Lacunes profondes non détectées','Fausse confiance','Fragilité totale sur les notions évitées'],
    advice:(d,notions)=>{
      const zones=notions.filter(n=>n.isComplex||n.cls==='red').slice(0,2);
      return `D3 bas : ${d.D3}/100 — tu ne reviens pas sur tes difficultés. ${zones.length?`Force-toi 5 minutes sur : ${zones.map(n=>n.name||n.theme).join(' et ')}. L\'inconfort cognitif que tu ressens est exactement le signe que tu apprends.`:'Identifie tes 2 notions les plus floues et travaille-les frontalement.'}`;
    },
    score:d=>clamp(Math.round(((100-d.D3)*0.32+(100-d.D2)*0.28+(100-d.D12)*0.22+(100-d.D10)*0.18)),0,100),
    conditions:d=>d.D3<35&&d.D2<45,
  },
  {
    id:'perfectionist', label:'Perfectionniste Cognitif', emoji:'⚗️', color:'#4f9eff',
    desc:'Tu ne passes à la suite que quand tu te sens sûr. Revisites élevées, surlignage dense, flashcard très travaillées — tu construis une maîtrise rigoureuse mais tu risques de t\'y perdre. La perfection à 80% sur l\'ensemble vaut mieux que 100% sur la moitié.',
    strengths:['Maîtrise profonde des sections revisitées','Peu d\'erreurs sur les notions travaillées','Très solide en dissertation sur les sujets préparés'],
    risks:['Gestion du temps à l\'examen','Couverture partielle du cours','Peut bloquer sur une notion et perdre du temps'],
    advice:(d,notions)=>`D3 : ${d.D3}/100 + D2 : ${d.D2}/100 — tu es dense dans ton travail. ${notions.length?`Mais tu as passé beaucoup de temps sur ${notions[0].name} — selon les signaux, ta compréhension est maintenant suffisante. Passe à la suite.`:'Accepte 75% de maîtrise sur les sections descriptives et réserve ton énergie pour les notions techniques.'}`,
    score:d=>clamp(Math.round((d.D3*0.3+d.D2*0.28+d.D4*0.22+d.D10*0.2)),0,100),
    conditions:d=>d.D3>60&&d.D2>55,
  },
  {
    id:'crisis_mode', label:'Mode Crise', emoji:'🚨', color:'#ff5f5f',
    desc:'Tu révises sous pression temporelle. Sessions longues d\'un coup, temps de réponse qui se dégradent en cours de session, peu de régularité — ton cerveau donne tout en une fois. Ce n\'est pas nul, mais c\'est biologiquement inefficace : la mémoire consolide pendant le sommeil, pas pendant la session.',
    strengths:['Forte motivation à court terme','Capacité à aller vite quand nécessaire'],
    risks:['Oubli massif dans les 48h','Fatigue cognitive en fin de session','Lacunes sur les notions vues en fin de session'],
    advice:(d,notions)=>`D6 : ${d.D6}/100 — peu de régularité. ${notions.length?`En urgence : ${notions.slice(0,2).map(n=>n.name||n.theme).join(', ')} — concentre-toi là.`:'Fais 3 sessions de 45 min plutôt qu\'une session de 3h — c\'est 3× plus efficace neurologiquement.'}`,
    score:d=>clamp(Math.round(((100-d.D1)*0.25+(100-d.D6)*0.3+d.D3*0.25+(100-d.D9)*0.2)),0,100),
    conditions:d=>d.D6<35&&d.D3>40,
  },
  {
    id:'explorer', label:'Explorateur Systémique', emoji:'🗺️', color:'#52d68a',
    desc:'Tu construis la carte avant les détails. Navigation entre sections, plusieurs cours actifs, vision d\'ensemble développée — tu vois les liens entre les notions avant de les maîtriser isolément. C\'est une approche top-down qui fonctionne à condition de revenir ensuite vers le bas.',
    strengths:['Vision transversale (liens entre cours)','Bonne contextualisation des notions','Pas de blocage sur une notion isolée'],
    risks:['Maîtrise de surface si on reste en exploration','Peut passer à côté des nuances techniques'],
    advice:(d,notions)=>`D8 : ${d.D8}/100 — tu explores beaucoup. ${notions.length?`Il est maintenant temps de plonger en profondeur sur : ${notions[0].name}.`:'Tu as ta carte mentale — c\'est le moment de solidifier les zones rouge et orange.'}`,
    score:d=>clamp(Math.round((d.D8*0.35+d.D3*0.25+d.D5*0.2+d.D2*0.2)),0,100),
    conditions:d=>d.D8>60,
  },
  {
    id:'passive_reader', label:'Lecteur Passif', emoji:'📖', color:'#ffc890',
    desc:'Tu lis plus que tu n\'interagis. Dwell élevé, peu de surlignage, peu de quiz — tu traites l\'information mais sans la tester. La lecture passive a un rendement mémoriel 3× inférieur à l\'auto-test actif (études Roediger & Karpicke).',
    strengths:['Compréhension contextuelle','Peu de stress cognitif','Bon pour la première découverte'],
    risks:['Illusion de maîtrise','Oubli rapide sans test','Fausse confiance en session'],
    advice:(d,notions)=>`D2 : ${d.D2}/100 (faible) + D5 : ${d.D5}/100 (faible). Après chaque section, ferme le cours et récite 3 règles à voix haute. ${notions.length?`Commence par : ${notions[0].name}.`:''}`,
    score:d=>clamp(Math.round(((100-d.D2)*0.32+(100-d.D5)*0.28+d.D6*0.2+(100-d.D11)*0.2)),0,100),
    conditions:d=>d.D2<40&&d.D5<45,
  },
  {
    id:'burst_learner', label:'Apprenantx en Rafale', emoji:'💥', color:'#ff5f9e',
    desc:'Tu apprends par pics d\'énergie intense. Périodes d\'activité dense alternées avec des absences — tu n\'es pas irrégulier par manque de motivation mais par mode de fonctionnement cognitif. Ces pics sont très productifs si tu arrives avant que la fatigue s\'installe.',
    strengths:['Productivité maximale en début de session','Créativité associative élevée sous stimulation'],
    risks:['Dégradation rapide en fin de pic','Peu de consolidation entre les sessions','Peut sauter des notions sur l\'élan'],
    advice:(d,notions)=>`Optimise tes pics : travaille les notions les plus difficiles en début de session. ${notions.length?`Maintenant : ${notions[0].name} — c\'est le moment.`:'Pose une alarme à 45 min pour faire une pause avant que la qualité chute.'}`,
    score:d=>clamp(Math.round((d.D3*0.3+(100-d.D6)*0.3+(100-d.D9)*0.22+d.D5*0.18)),0,100),
    conditions:d=>d.D6<40&&d.D3>35,
  },
  {
    id:'multi_modal', label:'Apprenant Multi-Modal', emoji:'🔀', color:'#6c63ff',
    desc:'Tu utilises tous les canaux : quiz, flashcards, cours, interactions, revisites — tu t\'es construit un protocole de révision implicitement optimal. C\'est le profil de l\'étudiant qui finit par s\'améliorer en continu quelle que soit la matière.',
    strengths:['Aucun point de défaillance systémique','S\'adapte à tous les types de questions','Progression régulière et prévisible'],
    risks:['Peut se disperser si trop de canaux simultanés'],
    advice:(d,notions)=>`Profil idéal. ${notions.length?`Le seul point de vigilance : ${notions[0].name} — c\'est ta lacune résiduelle, attaque-la.`:'Continue — concentre l\'énergie sur les zones rouges du tableau.'}`,
    score:d=>clamp(Math.round((d.D2*0.2+d.D4*0.2+d.D5*0.2+d.D3*0.15+d.D12*0.15+d.D6*0.1)),0,100),
    conditions:d=>d.D2>50&&d.D4>50&&d.D5>50,
  },
  {
    id:'self_corrector', label:'Auto-Correcteur', emoji:'✅', color:'#52d68a',
    desc:'Après chaque erreur, tu reviens au cours. C\'est le comportement le plus efficace que l\'on puisse avoir face à une lacune. Tu ne te contentes pas de voir la correction — tu retournes à la source. Très rare.',
    strengths:['Correction immédiate des lacunes','Compréhension de la règle et non juste de la bonne réponse','Fort D12'],
    risks:['Peut ralentir la progression globale si fait sur toutes les erreurs'],
    advice:(d,notions)=>`D12 : ${d.D12}/100 — excellent réflexe de retour au cours. ${notions.length?`Continue avec : ${notions[0].name}.`:'Tu appliques déjà la méthode optimale. Accélère maintenant sur les zones orange.'}`,
    score:d=>clamp(Math.round((d.D12*0.42+d.D7*0.28+d.D3*0.18+d.D5*0.12)),0,100),
    conditions:d=>d.D12>60,
  },
  {
    id:'formula_wrestler', label:'Lutteur de Formules', emoji:'⚙️', color:'#a89cff',
    desc:'Tu bloques sur les formules et règles à conditions multiples. Temps de réponse très élevés sur les notions techniques, dwell long sur les sections denses — tu t\'y bats mais tu ne renonces pas. C\'est un signe d\'apprentissage actif difficile, pas d\'échec.',
    strengths:['Finit par maîtriser ce qu\'il attaque','Peu d\'abandon devant la difficulté'],
    risks:['Coût temporel élevé','Peut se décourager si la formule ne vient pas'],
    advice:(d,notions)=>`D10 : ${d.D10}/100 — fort dwell sur les notions denses. ${notions.length?`Stratégie sur ${notions[0].name} : décompose la règle en sous-conditions numérotées (1. condition → 2. régime → 3. exception). La répétition linéaire ne fonctionne pas sur les formules — il faut une structure.`:'Utilise les schémas SVG du cours — les formules s\'ancrent mieux avec un support visuel.'}`,
    score:d=>clamp(Math.round((d.D10*0.38+(100-d.D1)*0.28+(100-d.D9)*0.2+d.D3*0.14)),0,100),
    conditions:d=>d.D10>55&&d.D1<55,
  },
  {
    id:'blocked', label:'Bloqué sur Notion', emoji:'🧱', color:'#ff5f5f',
    desc:'Tu es face à un mur conceptuel. Erreurs répétées sur les mêmes questions, streak d\'erreurs consécutives, temps de réponse qui augmentent — quelque chose résiste. Ce n\'est pas un problème d\'intelligence, c\'est un problème de formulation : il faut une entrée différente dans la notion.',
    strengths:['La persistance révèle la lacune exacte','Excellent matériau pour un travail ciblé'],
    risks:['Découragement', 'Contamination anxieuse sur les notions voisines'],
    advice:(d,notions)=>`Erreurs répétées détectées. ${notions.length?`Notion exacte en cause : ${notions[0].name}. Stratégie : ignore les autres et travaille uniquement celle-ci pendant 10 minutes. Cherche un exemple concret (jurisprudence, cas pratique).`:'Identifie la question exacte ratée le plus souvent dans le tableau de détail et attaque-la isolément.'}`,
    score:d=>clamp(Math.round(((100-d.D7)*0.3+(100-d.D11)*0.28+(100-d.D1)*0.22+d.D3*0.2)),0,100),
    conditions:d=>d.D7<40&&d.D11<40,
  },
  {
    id:'autonomous', label:'Autonome Confirmé', emoji:'🏆', color:'#52d68a',
    desc:'Tu maîtrises. Scores élevés, temps de réponse rapides, peu de revisites nécessaires, forte progression — tu es dans la phase de consolidation. Les révisions suivantes serviront à maintenir et à travailler les cas complexes.',
    strengths:['Maîtrise large du programme','Bonne préparation à l\'examen','Peut aider à identifier les véritables pièges'],
    risks:['Peut relâcher trop tôt','Zones non encore testées potentiellement fragilisées'],
    advice:(d,notions)=>`D1 : ${d.D1}/100, D7 : ${d.D7}/100, D11 : ${d.D11}/100 — profil solide. ${notions.length?`Seule zone à surveiller : ${notions[0].name}. Ne la laisse pas traîner.`:'Commence à t\'entraîner sur les annales et les cas pratiques — le contenu est là, il faut maintenant le mobiliser sous pression.'}`,
    score:d=>clamp(Math.round((d.D1*0.28+d.D7*0.25+d.D11*0.22+d.D4*0.15+d.D9*0.1)),0,100),
    conditions:d=>d.D1>70&&d.D7>65,
  },
];

/* ─── Scorer tous les profils et retourner le classement ─── */
function rankProfiles(dims){
  const all=LEARNER_PROFILES
    .map(p=>({...p, pct:p.score(dims), eligible:p.conditions?p.conditions(dims):true}));
  const eligible=all.filter(p=>p.eligible).sort((a,b)=>b.pct-a.pct);
  if(eligible.length) return eligible;
  return all.sort((a,b)=>b.pct-a.pct).slice(0,1);
}

/* ══════════════════ HISTORIQUE DE PROFIL ══════════════════ */
const PROFILE_HISTORY_KEY=(()=>{let u='';try{u=localStorage.getItem('rvision_current_user')||'';}catch(e){}return (u?'rvision_'+u+'_':'rvision_')+'l1_profile_history';})();
function getProfileHistory(){
  try{return JSON.parse(localStorage.getItem(PROFILE_HISTORY_KEY)||'[]');}catch(e){return [];}
}
function saveProfileHistory(arr){
  try{localStorage.setItem(PROFILE_HISTORY_KEY,JSON.stringify(arr.slice(-20)));}catch(e){}
}
function recordProfileChange(profileId,pct){
  const hist=getProfileHistory();
  const now=Date.now();
  const last=hist[hist.length-1];
  // N'enregistre que si changement ou >15 min
  if(!last||last.id!==profileId||(now-last.ts)>900000){
    hist.push({id:profileId,pct,ts:now});
    saveProfileHistory(hist);
    return true; // nouveau
  }
  return false;
}

/* ══════════════════ MEMOÏSATION (15 min) ══════════════════ */
let _memo={dims:null,ranked:null,ts:0};
function getCachedProfile(allData){
  const now=Date.now();
  if(_memo.dims&&(now-_memo.ts)<900000) return _memo; // 15 min
  const dims=computeDimensions(allData);
  const ranked=rankProfiles(dims);
  _memo={dims,ranked,ts:now};
  recordProfileChange(ranked[0].id,ranked[0].pct);
  return _memo;
}

/* ══════════════════ MICRO-PARCELLISATION NOTIONS ══════════════════ */
function getNotionSignals(allData){
  /* Retourne un tableau de micro-notions scorées avec signaux détaillés */
  const results=[];

  INSIGHT_COURSES.forEach(c=>{
    const d=allData[c.id]; if(!d) return;
    // Exclure les cours survolés (< 2min actif ET < 3 questions)
    const _ms=d.totalActiveMs||0;
    const _qs=Object.values(d.quiz||{}).reduce((s,t)=>(s+(t.correct||0)+(t.wrong||0)),0);
    if(_ms<120000 && _qs<3) return;
    const sections=d.sections||{};
    const quiz=d.quiz||{};

    // ── Niveau section ──
    Object.entries(sections).forEach(([secId,s])=>{
      const nm=NOTION_MAP[secId];
      const secL=secLabel(secId);
      const behavScore=scoreBehaviorSection(s);
      const visits=s.visits||0;
      const dwellPerV=(s.activeMs||0)/Math.max(1,visits);

      // ── Niveau micro-notion (si NOTION_MAP disponible) ──
      if(nm){
        nm.notions.forEach(notion=>{
          // Cherche quiz associé (matching approximatif par mot-clé)
          const notionKey=notion.id.toLowerCase();
          const matchedTheme=Object.entries(quiz).find(([theme])=>
            theme.toLowerCase().includes(notionKey)||
            notionKey.includes(theme.toLowerCase().replace(/\s+/g,'_').substring(0,6))
          );
          const themeData=matchedTheme?matchedTheme[1]:null;
          const themeRes=themeData?scoreThemeFull(themeData,s):null;

          // Calcul score final
          let score;
          if(themeRes){
            score=themeRes.score;
          } else {
            // Pas de données quiz — score comportemental pondéré par complexité
            const complexPenalty=notion.complexity>=4?15:notion.complexity>=3?8:0;
            score=clamp(behavScore-complexPenalty,0,100);
          }

          // Signaux spécifiques
          const signals=[];
          if(visits>2) signals.push({type:'neg',txt:`${visits} visites — zone revisitée`});
          if(dwellPerV>300000) signals.push({type:'neu',txt:`${Math.round(dwellPerV/60000)}min/visite — notion dense`});
          if(s.highlights>1) signals.push({type:'pos',txt:`${s.highlights} surlignages`});
          if(themeData){
            const tot=(themeData.correct||0)+(themeData.wrong||0);
            if(themeData.wrong>0) signals.push({type:'neg',txt:`${themeData.wrong}/${tot} erreurs quiz`});
            if((themeData.errorStreak||0)>=2) signals.push({type:'neg',txt:`${themeData.errorStreak} erreurs consécutives`});
            const rtArr=(themeData.responseTimes||[]).filter(r=>r>=300&&r<60000);
            if(rtArr.length){
              const avgRT=Math.round(rtArr.reduce((a,b)=>a+b,0)/rtArr.length/1000);
              if(avgRT>15) signals.push({type:'neg',txt:`${avgRT}s moy. de réponse`});
            }
            const dropInfo=detectAttentionDrop(themeData);
            if(dropInfo.drop) signals.push({type:'neg',txt:`concentration ÷${dropInfo.ratio}`});
          }
          if(notion.complexity>=4) signals.push({type:'neu',txt:`complexité ${notion.complexity}/5`});

          // Action recommandée
          let action='';
          const isComplex=dwellPerV>240000&&(!themeData||(themeData.wrong||0)/(Math.max(1,(themeData.correct||0)+(themeData.wrong||0)))<0.35);
          if(score<40) action=`⚡ Lacune — retravailler ${notion.name} maintenant.`;
          else if(score<55) action=`🔁 Fragilité — relire la règle puis auto-test sur cette notion.`;
          else if(isComplex) action=`💜 Notion dense — tu y as passé du temps : auto-teste-toi pour valider la compréhension.`;
          else if(score>=75) action=`✓ Maîtrisé — passe à la suite.`;
          else action=`📌 À surveiller — reviens y dans la prochaine session.`;

          results.push({
            notionId:notion.id,
            name:notion.name,
            section:secL,
            sectionId:secId,
            course:c.name,
            courseId:c.id,
            courseColor:c.color,
            score,
            cls:masteryClass(score),
            complexity:notion.complexity,
            isComplex,
            partial:!themeData||!themeRes,
            signals,
            action,
            visits,
            highlights:s.highlights||0,
            hasDrop:themeData?detectAttentionDrop(themeData).drop:false,
            wrong:themeData?themeData.wrong||0:0,
            errorStreak:themeData?themeData.errorStreak||0:0,
          });
        });
      } else {
        // Section sans NOTION_MAP — signal section générique
        if(visits>=2&&behavScore<60){
          results.push({
            notionId:secId,
            name:secL,
            section:secL,
            sectionId:secId,
            course:c.name,
            courseId:c.id,
            courseColor:c.color,
            score:behavScore,
            cls:masteryClass(behavScore),
            complexity:2,
            isComplex:false,
            partial:true,
            signals:[{type:'neg',txt:`${visits} visites · signal comportemental`}],
            action:`🔍 Section revisitée fréquemment sans données quiz — assure-toi de comprendre.`,
            visits,
            highlights:s.highlights||0,
            hasDrop:false,
            wrong:0,
            errorStreak:0,
          });
        }
      }
    });

    // ── Thèmes quiz sans section associée ──
    Object.entries(quiz).forEach(([theme,t])=>{
      const tot=(t.correct||0)+(t.wrong||0);
      if(tot<1) return;
      // Vérifier si déjà couvert par NOTION_MAP
      const alreadyMapped=results.some(r=>r.courseId===c.id&&r.notionId.includes(theme.toLowerCase().replace(/\s+/g,'_').substring(0,6)));
      if(alreadyMapped) return;

      const sortedSec=Object.entries(sections).sort((a,b)=>(b[1].visits||0)-(a[1].visits||0));
      const bestSec=sortedSec[0]?sortedSec[0][1]:null;
      const res=scoreThemeFull(t,bestSec);
      if(!res) return;
      const rtArr=(t.responseTimes||[]).filter(r=>r>=300&&r<60000);
      const avgRT=rtArr.length?Math.round(rtArr.reduce((a,b)=>a+b,0)/rtArr.length/1000):null;
      const signals=[];
      if(t.wrong>0) signals.push({type:'neg',txt:`${t.wrong}/${tot} erreurs`});
      if((t.errorStreak||0)>=2) signals.push({type:'neg',txt:`${t.errorStreak} erreurs consécutives`});
      if(avgRT&&avgRT>12) signals.push({type:'neg',txt:`${avgRT}s moy.`});
      if(t.streak>4) signals.push({type:'pos',txt:`série ${t.streak}`});

      const score=res.score;
      results.push({
        notionId:theme,
        name:theme,
        section:bestSec?secLabel(sortedSec[0][0]):c.name,
        sectionId:sortedSec[0]?sortedSec[0][0]:null,
        course:c.name,courseId:c.id,courseColor:c.color,
        score,cls:masteryClass(score),complexity:2,isComplex:false,
        partial:res.partial,signals,
        action:score<40?`⚡ Revenir au cours sur : ${theme}.`:
               score<55?`🔁 Consolider : ${theme}.`:
               score>=75?`✓ Maîtrisé.`:`📌 À surveiller.`,
        visits:bestSec?bestSec.visits||0:0,
        highlights:bestSec?bestSec.highlights||0:0,
        hasDrop:detectAttentionDrop(t).drop,
        wrong:t.wrong||0,
        errorStreak:t.errorStreak||0,
      });
    });
  });

  // Trier : lacunes d'abord, puis par score croissant, puis complexité
  return results.sort((a,b)=>{
    const cls={red:0,orange:1,blue:2,green:3,unknown:4};
    const ca=cls[a.cls]??4, cb=cls[b.cls]??4;
    if(ca!==cb) return ca-cb;
    if(a.score!==b.score) return a.score-b.score;
    return b.complexity-a.complexity; // plus complexe d'abord à score égal
  });
}

/* ══════════════════ MOTEUR PRINCIPAL v4 ══════════════════ */

/* ────────── fin du code de l'index ────────── */
  function resetMemo(){_memo={dims:null,ranked:null,ts:0};}
  return {setSource,resetMemo,computeDimensions,rankProfiles,getCachedProfile,getNotionSignals,detectAttentionDrop,LEARNER_PROFILES,buildNotionUrl,masteryColor,masteryClass,getProfileHistory,fmtDuration,scoreCourse,
    get courses(){return INSIGHT_COURSES;},read:(id)=>readInsight(id)};
})();

/* ─────────── Source des données L2 + analyse (même logique que runInsightAnalysis) ─────────── */
const L1_SUBJ_COL={l1_civ:'#4f9eff',l1_con:'#d4b060',l1_his:'#ff8c5a',l1_aj:'#60b4ff',l1_eco:'#52d68a'};
const L1_DEMO_NOTIONS={
  l1_civ:['Acquisition de la personnalité juridique','Droit au respect de la vie privée (art. 9)','Tutelle et curatelle','Conditions de formation du mariage','Divorce pour altération définitive du lien','Établissement de la filiation','Autorité parentale — exercice'],
  l1_con:['Pouvoir constituant originaire et dérivé','Séparation des pouvoirs (Montesquieu)','Régime parlementaire et présidentiel','Article 49 alinéa 3','Président de la République — pouvoirs propres','Saisine du Conseil constitutionnel','QPC (art. 61-1)'],
  l1_his:['Monarchie absolue et lois fondamentales','Parlements d\'Ancien Régime','Nuit du 4 août 1789','Constitution de 1791','Code civil de 1804','Charte de 1814','Monarchie de Juillet'],
  l1_aj:['Federalism and the Tenth Amendment','Checks and balances','Judicial review — Marbury v. Madison','The powers of Congress','The Electoral College','The Bill of Rights'],
  l1_eco:['Loi de l\'offre et de la demande','Prix d\'équilibre','Élasticité-prix','Concurrence pure et parfaite','Externalités','Biens publics'],
};
/* lecture INSIGHT d'un cours — reprise de readInsight() de l'index (cas particulier : filiation) */
function readInsightL1(courseId,u){
  if(courseId==='dc_fil'){
    try{const rp='dc_filiation_';const xpVal=+(localStorage.getItem(rp+'xp')||0);const sucRaw=localStorage.getItem(rp+'succes');let sucCount=0;
      if(sucRaw){try{const arr=JSON.parse(sucRaw);sucCount=Array.isArray(arr)?arr.length:+arr;}catch(e){}}
      const timeMs=+(localStorage.getItem(rp+'totalMs')||0),quizOk=+(localStorage.getItem(rp+'quiz_ok')||0),quizTotal=+(localStorage.getItem(rp+'quiz_total')||0);
      if(xpVal===0&&sucCount===0)return null;const wrong=Math.max(0,quizTotal-quizOk);
      return {totalActiveMs:timeMs,quiz:{'Filiation':{correct:Math.round(quizOk*0.55),wrong:Math.round(wrong*0.55),responseTimes:[]},'AutoriteParentale':{correct:Math.round(quizOk*0.25),wrong:Math.round(wrong*0.25),responseTimes:[]},'Adoption':{correct:Math.round(quizOk*0.2),wrong:Math.round(wrong*0.2),responseTimes:[]}},
        flashcards:{},sections:{'cours':{visits:1,activeMs:timeMs*0.6,highlights:0,mouseActive:true}}};
    }catch(e){return null;}
  }
  try{const r=localStorage.getItem((u?'rvision_'+u+'_':'rvision_')+courseId+'_insight');return r?JSON.parse(r):null;}catch(e){return null;}
}
function shortSubj(n){return n.split(' ').map(w=>w.length>3?w.charAt(0)+w.slice(1).toLowerCase():w.toLowerCase()).join(' ');}
function insightSourceL1(data,subjects){
  const courses=[];
  subjects.forEach(sj=>{const S=data.subjects[sj.key];(S.list||[]).forEach(c=>courses.push({id:c.demo?c.id:c.id||c.key,name:shortSubj(sj.name)+' · '+c.name,color:L1_SUBJ_COL[sj.key]||'#ffffff',subject:sj.key}));});
  let reader;
  if(data.real){
    let u='';try{u=localStorage.getItem('rvision_current_user')||'';}catch(e){}
    reader=id=>readInsightL1(id,u);
  }else{
    // démonstration : données d'apprentissage plausibles, cohérentes avec la maîtrise de chaque cours
    const R=mulberry32(7310),demo={};
    for(const k in NOTION_MAP_L1)if(k.startsWith('demo:'))delete NOTION_MAP_L1[k];
    subjects.forEach(sj=>{const S=data.subjects[sj.key];const names=L1_DEMO_NOTIONS[sj.key]||[];
      (S.list||[]).forEach((c,ci)=>{const id=c.key||c.id,cm=clamp01(c.mastery||0);
        const secId='demo:'+id;const ns=[];
        for(let q=0;q<2&&names.length;q++){const nm=names[(ci*2+q)%names.length];ns.push({id:(id+'_n'+q).toLowerCase(),name:nm,complexity:2+Math.floor(R()*3)});}
        NOTION_MAP_L1[secId]={label:'Séance '+(ci+1),course:id,notions:ns};
        const quiz={};
        ns.forEach((n,q)=>{const tot=4+Math.floor(R()*10);const rate=clamp01(0.3+0.62*cm+(R()-0.5)*0.35-(n.complexity>=4?0.12:0));
          const correct=Math.round(tot*rate);const rts=[];for(let r=0;r<tot;r++)rts.push(2500+R()*(1-cm)*22000+R()*3000+(r>tot/2&&R()<0.25?9000:0));
          const sk=Math.min(correct,Math.round(rate*6));
          quiz[n.id]={correct,wrong:tot-correct,responseTimes:rts,errorStreak:rate<0.45?2+Math.floor(R()*2):0,streak:sk,bestStreak:Math.min(correct,sk+Math.floor(R()*5))};});
        const fc={};for(let f=0;f<3;f++){const t=[];for(let r=0;r<4;r++)t.push(2500+R()*(1-cm)*14000);fc['fc'+f]={thinkTimesMs:t,flips:3+Math.floor(R()*5)};}
        demo[id]={totalActiveMs:Math.round((8+cm*55+R()*15)*60000),pauseCount:Math.floor(R()*3),quiz,flashcards:fc,
          sections:{[secId]:{visits:1+Math.floor((1-cm)*5*R()+R()*2),activeMs:Math.round((4+cm*30)*60000*(0.6+R()*0.6)),highlights:Math.floor(R()*5),mouseActive:R()<0.8}}};
      });});
    reader=id=>demo[id]||null;
  }
  INSIGHT_L1.setSource(courses,reader);INSIGHT_L1.resetMemo();
}
function analyseL1(){
  const E=INSIGHT_L1,C=E.courses;const all={},flt={};let totalActiveMs=0;
  C.forEach(c=>{const d=E.read(c.id);all[c.id]=d;if(d)totalActiveMs+=(d.totalActiveMs||0);});
  let active=false;
  C.forEach(c=>{const d=all[c.id];if(!d){flt[c.id]=null;return;}const ms=d.totalActiveMs||0;const qs=Object.values(d.quiz||{}).reduce((s,t)=>s+(t.correct||0)+(t.wrong||0),0);
    if(ms>=120000||qs>=3){flt[c.id]=d;active=true;}else flt[c.id]=null;});
  const any=Object.values(all).some(d=>d!==null);
  if(!active) return {state:any?'start':'empty',nTotal:C.length};
  const {dims,ranked}=E.getCachedProfile(flt);
  if(!ranked||!ranked.length) return {state:'insufficient',nTotal:C.length};
  const sig=E.getNotionSignals(flt);
  const lacunes=sig.filter(n=>n.cls==='red').slice(0,6),fragiles=sig.filter(n=>n.cls==='orange').slice(0,5),complexes=sig.filter(n=>n.isComplex&&n.cls!=='red').slice(0,3);
  const thirty=totalActiveMs>=1800000,ten=totalActiveMs>=600000;
  const drops=[];C.forEach(c=>{const d=flt[c.id];if(!d||!d.quiz)return;const n=Object.entries(d.quiz).filter(([,t])=>E.detectAttentionDrop(t).drop).length;if(n>=2)drops.push(c.name);});
  const slow=sig.filter(n=>n.signals.some(s=>s.txt.includes('moy. de réponse'))).length;
  const totalQs=Object.values(all).reduce((a,d)=>a+(d?Object.values(d.quiz||{}).reduce((b,t)=>b+(t.correct||0)+(t.wrong||0),0):0),0);
  const nCourses=Object.values(all).filter(d=>d&&Object.keys(d.quiz||{}).length>0).length;
  const h=Math.floor(totalActiveMs/3600000),m=Math.floor((totalActiveMs%3600000)/60000);
  const urlOf=notionUrlL1;
  const top=sig.find(n=>n.cls==='red')||sig.find(n=>n.cls==='orange')||sig[0]||null;
  const strong=sig.filter(n=>n.cls==='green').sort((a,b)=>b.score-a.score).slice(0,3);
  [...lacunes,...fragiles,...complexes,...strong].forEach(n=>{n.url=urlOf(n);});if(top)top.url=urlOf(top);
  return {state:'ok',activeLabel:h>0?h+' h '+(m?String(m).padStart(2,'0'):''):m+' min',totalQs,nCourses,nTotal:C.length,lacunesN:sig.filter(n=>n.cls==='red').length,
    top,pause:drops.length>0||slow>=3,thirty,lists:{lacunes,complexes,fragiles,watch:ten&&sig[0]?[sig[0]]:[],strong},profile:ranked[0],dims};
}

function notionUrlL1(n){for(const sec of Object.values(NOTION_MAP_L1)){const f=(sec.notions||[]).find(x=>x.id===n.notionId||x.name===n.name);if(f)return INSIGHT_L1.buildNotionUrl(f);}return null;}
/* ▸ Résumé d'une matière pour le panneau des grottes :
     record de flamme = plus longue série de bonnes réponses d'affilée aux quiz de la matière.
     Sources, dans l'ordre : clé dédiée rvision_<profil>_<cours>_flame ({best,cur} ou un nombre,
     si une page de cours la tient), champ « flame » de l'insight, puis par thème de quiz
     bestStreak / maxStreak / recordStreak, et à défaut la série en cours (streak).
     Points à revoir = notions rouges / orange du moteur INSIGHT, limitées à la matière. */
function subjectInsightL1(key){
  const E=INSIGHT_L1,C=(E.courses||[]).filter(c=>c.subject===key);
  let best=0,cur=0,correct=0,wrong=0,ms=0;const flt={};
  let u='';try{u=localStorage.getItem('rvision_current_user')||'';}catch(e){}
  C.forEach(c=>{
    if(DATA&&DATA.real){try{const r=localStorage.getItem((u?'rvision_'+u+'_':'rvision_')+c.id+'_flame');if(r){const f=JSON.parse(r);
      if(typeof f==='number')best=Math.max(best,f);else if(f){best=Math.max(best,+f.best||0);cur=Math.max(cur,+f.cur||0);}}}catch(e){}}
    const d=E.read(c.id);if(!d)return;flt[c.id]=d;ms+=d.totalActiveMs||0;
    if(d.flame){best=Math.max(best,+d.flame.best||0);cur=Math.max(cur,+d.flame.cur||0);}
    Object.values(d.quiz||{}).forEach(t=>{correct+=t.correct||0;wrong+=t.wrong||0;
      best=Math.max(best,+(t.bestStreak||t.maxStreak||t.recordStreak||0),+(t.streak||0));cur=Math.max(cur,+(t.streak||0));});
  });
  let review=[];
  try{review=E.getNotionSignals(flt).filter(n=>n.cls==='red'||n.cls==='orange').sort((a,b)=>a.score-b.score).slice(0,4);review.forEach(n=>{n.url=notionUrlL1(n);});}catch(e){}
  return {best,cur,correct,total:correct+wrong,ms,review,n:C.length,any:Object.keys(flt).length>0};
}

/* ═══ 37 · Profil — exactement le même système que l'accueil L1 (index.html) ═══
   Clés partagées avec l'index :
     rvision_current_user → pseudo actif        rvision_users → liste des pseudos connus
     rvision_<pseudo>_<cours>_<stat>           → progression, propre à chaque profil
   Comme sur la L1 : sans profil enregistré sur cet appareil, la fenêtre de profil s'ouvre à
   l'arrivée. Choisir ou créer un profil recharge les vraies données de ce profil (un nouveau
   profil part de zéro). Rien n'est jamais effacé ici : la gestion (suppression) reste sur l'index. */
const L1_XP_IDS=['dc','h1','h2','h3','co_l1','rp','co','ve_rep','co2','mk','aj','dc_pj','dp_vf2','dc_inc','dc_fil'];
function profUsers(){try{return JSON.parse(localStorage.getItem('rvision_users')||'[]')||[];}catch(e){return [];}}
function profCurrent(){try{return localStorage.getItem('rvision_current_user')||'';}catch(e){return '';}}
function profXP(u,ids){let t=0;ids.forEach(id=>{try{t+=+(localStorage.getItem('rvision_'+u+'_'+id+'_xp')||0);}catch(e){}});return t;}
function buildProfile(onChange){
  const chip=document.getElementById('prof');
  const m=document.createElement('div');m.id='pm';m.setAttribute('role','dialog');m.setAttribute('aria-modal','true');m.setAttribute('aria-hidden','true');
  m.innerHTML=`<div class="pm-box">
    <i class="pm-c tl"></i><i class="pm-c tr"></i><i class="pm-c bl"></i><i class="pm-c br"></i>
    <div class="pm-top"><span>01 — Identification · <b>L1</b></span><button type="button" class="pm-x" aria-label="Fermer">[ Fermer ]</button></div>
    <div class="pm-ruler" aria-hidden="true"></div>
    <h2 class="pm-t">Qui révise&nbsp;?</h2>
    <p class="pm-s">Choisis ton profil pour reprendre là où tu t'étais arrêté. Les profils sont partagés entre l'accueil, la L1 et la L2&nbsp;; chacun garde ses propres statistiques.</p>
    <div class="pm-list"></div>
    <p class="pm-sep">Nouveau profil</p>
    <form class="pm-f" autocomplete="off">
      <label class="pm-lb" for="pm-in"><span>Prénom ou pseudo</span><em class="pm-cnt">00 / 20</em></label>
      <input class="pm-in" id="pm-in" type="text" maxlength="20" placeholder="Max…" aria-label="Nouveau profil">
      <button type="submit" class="pm-go"><span>Entrer</span><b aria-hidden="true">→</b></button>
    </form>
    <p class="pm-ft">Enregistré sur cet appareil · rien n'est envoyé</p>
  </div>`;
  document.body.appendChild(m);
  const $=s=>m.querySelector(s);
  const st={open:false};
  const esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  function label(){const u=profCurrent();chip.innerHTML=u?`<i>${esc(u.charAt(0).toUpperCase())}</i><span class="pn">${esc(u)}</span>`:'<i>?</i><span class="pn">Connexion</span>';chip.title=u?'Profil actif — changer de profil':'Choisir un profil';}
  function render(){
    const us=profUsers(),cur=profCurrent();
    $('.pm-list').innerHTML=us.length?us.map(u=>`<button type="button" class="pm-u${u===cur?' on':''}" data-u="${esc(u)}"><i>${esc(u.charAt(0).toUpperCase())}</i><span class="pm-n"><b>${esc(u)}</b><span>L1 · ${profXP(u,L1_XP_IDS).toLocaleString('fr-FR')} XP</span></span><em aria-hidden="true">→</em></button>`).join('')
      :'<p class="pm-none">Aucun profil sur cet appareil pour l\'instant — crée le tien ci-dessous.</p>';
    m.querySelectorAll('.pm-u').forEach(b=>b.addEventListener('click',()=>choose(b.dataset.u)));
  }
  function open(){render();st.open=true;m.classList.add('on');m.setAttribute('aria-hidden','false');setTimeout(()=>{try{$('.pm-in').focus({preventScroll:true});}catch(e){}},250);}
  function close(){st.open=false;m.classList.remove('on');m.setAttribute('aria-hidden','true');}
  function choose(u){u=String(u||'').trim();if(!u)return;
    try{localStorage.setItem('rvision_current_user',u);const us=profUsers();if(!us.includes(u)){us.push(u);localStorage.setItem('rvision_users',JSON.stringify(us));}}catch(e){}
    close();label();if(onChange)onChange(u);}
  $('.pm-f').addEventListener('submit',e=>{e.preventDefault();const v=$('.pm-in').value.trim();if(!v){$('.pm-in').classList.add('err');return;}$('.pm-in').classList.remove('err');$('.pm-in').value='';$('.pm-cnt').textContent='00 / 20';choose(v);});
  $('.pm-x').addEventListener('click',close);
  $('.pm-in').addEventListener('input',()=>{$('.pm-cnt').textContent=String($('.pm-in').value.length).padStart(2,'0')+' / 20';$('.pm-in').classList.remove('err');});
  m.addEventListener('click',e=>{if(e.target===m)close();});
  window.addEventListener('keydown',e=>{if(e.key==='Escape'&&st.open)close();});
  chip.addEventListener('click',open);
  label();
  return {open,close,st,label};
}

/* ═══ 99 · Parcours au scroll : jungle → nuages → 4 blocs → portail → grottes → mur de statistiques ═══
   P (position de scroll) : 0 = clairière de la pagode ; 0→0,5 = la caméra s'élève, la mer de
   nuages engloutit la forêt ; 0,5→1 = arrivée dans l'espace des blocs ; P = 1…4 : blocs (clic = caverne) ;
   P = 5 : pierres du portail éparpillées ; 5→6 : elles s'assemblent ; 6→6,6 : embrasement et
   traversée ; P = 7 : l'économie (clic sur l'objet = grotte aux torches) ;
   P = 8, 9, 10 : mur de statistiques (statistiques, activité, analyse — écrans HTML nets).
   ?p=1 (ou ?scene=ice) : démarrer directement au premier bloc · ?dev : menu dev ouvert */
const SYS={};
const raycaster=new THREE.Raycaster();
const camTgt=new THREE.Vector3();
let T=-0.5, hudShown=false, started=false;   // une demi-seconde derrière le chargeur (premières images)
const DEV=Q.has('dev')||Q.get('scene')==='ice';
const VIEW=Q.get('view')?Q.get('view').split(',').map(Number):null;
const SPACING=16;
const SUBJECTS_N=4;   // nombre de blocs d'ambre (sert à dimensionner l'espace)

/* les quatre matières juridiques de la L1, chacune figée dans un bloc d'ambre :
   Code civil de 1804 · temple à fronton · couronne et sceptre · Capitole */
const SUBJECTS=[
  {key:'l1_civ',idx:1,name:'DROIT CIVIL',phaseKey:'AMBRE',build:()=>buildCodeCivil(),demo:0.40,courses:5,done:2,
   words:['ART. 16','ART. 9','ART. 414','ART. 212','ART. 310-1','ART. 371-1','C. CIV.','1804']},
  {key:'l1_con',idx:2,name:'DROIT CONSTITUTIONNEL',phaseKey:'AMBRE',build:()=>buildFronton(),demo:0.65,courses:5,done:3,
   words:['1958','ART. 16','ART. 49-3','ART. 61-1','QPC','ART. 89','DDHC 1789','ART. 5']},
  {key:'l1_his',idx:3,name:'HISTOIRE DU DROIT',phaseKey:'AMBRE',build:()=>buildCouronne(),demo:0.15,courses:4,done:1,
   words:['1539','1789','1804','1814','1830','1848','ANCIEN RÉGIME','1875']},
  {key:'l1_aj',idx:4,name:'ANGLAIS JURIDIQUE',phaseKey:'AMBRE',build:()=>buildCapitole(),demo:1.0,courses:1,done:1,
   words:['JUDICIAL REVIEW','MARBURY 1803','SCOTUS','FEDERALISM','CHECKS & BALANCES','CONGRESS','DUE PROCESS','BILL OF RIGHTS']},
];
const FIN_PHASES=[{id:'0',name:'ENCRE'},{id:'I',name:'ESQUISSE'},{id:'II',name:'LAVIS'},{id:'III',name:'MATIÈRE'},{id:'IV',name:'ACHEVÉ'}];
const FIN_SUBJECTS=[
  {key:'l1_eco',idx:5,name:'ÉCONOMIE',build:()=>buildChangeur(),scale:1.18,demo:0.6,courses:1,done:0,phaseKey:'FORMATION',phases:FIN_PHASES},
];
const ALL_SUBJ=SUBJECTS.concat(FIN_SUBJECTS);
/* portail : une étape de plus — à SUBJECTS.length+1 les pierres flottent, éparpillées ; elles
   s'assemblent pendant tout le défilement suivant, jusqu'à P_PORTAL */
const P_PORTAL=SUBJECTS.length+2, P_FIN=P_PORTAL+1, P_CUT=P_PORTAL+0.6;
const P_STATS=P_FIN+FIN_SUBJECTS.length;
const PMAX=P_STATS+2;   // le mur de glace a trois panneaux : statistiques, activité, analyse
let DATA=null;
/* recul de caméra en format portrait (tout doit rester dans le cadre) */
const camK=()=>Math.max(1,0.8/(VW/VH));
/* maîtrise : données réelles branchées à l'étape 5 ; d'ici là, valeurs de démonstration */
function masteryOf(sj){return DATA?DATA.subjects[sj.key].mastery:sj.demo;}
/* état de départ d'un bloc : ce qui a déjà été montré (jamais plus que la progression réelle) */
/* dès que le menu dev a servi, plus rien n'est enregistré (la vraie mémoire reste intacte) */
const DEVSTATE={on:DEV};
function seenStart(id,target){const v=seenGet(id);return v===null?0:Math.min(v,target);}
function seenSave(id,v){if(!CAPTURE&&!DEVSTATE.on)seenSet(id,v);}
window.addEventListener('pagehide',()=>{
  (SYS.blocks||[]).forEach(b=>{if(b.started)seenSave(b.sid,b.m);});
  (SYS.fins||[]).forEach(F=>{if(F.started)seenSave(F.sid,F.f);});
});

/* ─────────── Scroll virtuel lissé, aimanté sur chaque section ─────────── */
const SC={p:0,t:0,last:-1e9,touchY:null,locked:true};
const startP=Q.get('scene')==='ice'?1:clamp01(+(Q.get('p')||0)/PMAX)*PMAX;
/* ?p=N&salle=1 (lien « Salle du temple » des cours) : on arrive sur la matière et sa salle s'ouvre d'elle-même */
let SALLE_P=Q.has('salle')?Math.round(startP):0;if(!((SALLE_P>=1&&SALLE_P<=SUBJECTS.length)||SALLE_P===P_FIN))SALLE_P=0;
function scrollBy(d){if(SYS.prof&&SYS.prof.st.open)return;if(CAVE.on){if(d<-0.004&&CAVE.k>0.6)caveExit();return;}if(SC.locked||(SYS.ovl&&SYS.ovl.st.open))return;SC.t=Math.max(0,Math.min(PMAX,SC.t+d));SC.last=performance.now();}
window.addEventListener('wheel',e=>{
  if(e.target&&e.target.closest&&e.target.closest('#ovl.cave,#pm'))return;   // le panneau de la caverne (et la fenêtre de profil) défilent normalement
  e.preventDefault();let d=e.deltaY;if(e.deltaMode===1)d*=33;else if(e.deltaMode===2)d*=VH;
  scrollBy(d/1100);
},{passive:false});
window.addEventListener('touchstart',e=>{SC.touchY=e.touches[0].clientY;},{passive:true});
window.addEventListener('touchmove',e=>{if(SC.touchY===null)return;const y=e.touches[0].clientY;scrollBy((SC.touchY-y)/(VH*0.75));SC.touchY=y;},{passive:true});
window.addEventListener('touchend',()=>{SC.touchY=null;},{passive:true});
window.addEventListener('keydown',e=>{
  if(SYS.prof&&SYS.prof.st.open)return;
  if(CAVE.on){if(['ArrowUp','PageUp','Escape'].includes(e.key)){caveExit();e.preventDefault();}return;}
  if(SC.locked||(SYS.ovl&&SYS.ovl.st.open)) return;
  const n=Math.round(SC.t);
  if(['ArrowDown','PageDown',' '].includes(e.key)){SC.t=Math.min(PMAX,n+1);SC.last=performance.now()-1e4;e.preventDefault();}
  if(['ArrowUp','PageUp'].includes(e.key)){SC.t=Math.max(0,n-1);SC.last=performance.now()-1e4;e.preventDefault();}
});
function scrollTick(dt,now){
  // aimantation : après une courte pause, on rejoint la section la plus proche
  if(now-SC.last>240&&SC.touchY===null){const n=Math.round(SC.t);SC.t+=(n-SC.t)*Math.min(1,dt*3.2);}
  SC.p+=(SC.t-SC.p)*(1-Math.exp(-dt*3.0));
  if(Math.abs(SC.t-SC.p)<1e-4) SC.p=SC.t;
}

/* ─────────── Construction ─────────── */
const DES={fog:new THREE.Color('#c6b29e'),bg:new THREE.Color('#c6b29e'),sun:new THREE.Color('#ffd2a0')};
/* ─── Chargement en deux temps ───
   1) derrière le chargeur : la jungle seule (ce que montre l'intro), compilée et envoyée à la carte graphique ;
   2) pendant les premières secondes de l'intro (le scroll y est bloqué) : les blocs d'ambre, la finance,
      les grottes, les murs de statistiques — construits par petites tranches, puis compilés et préchauffés.
   Le nombre de lumières ne change jamais (des « remplaçants » éteints tiennent la place de toutes celles
   qui viendront plus tard) : un shader compilé tôt reste valable, rien n'est recompilé en cours de route.
   Les calculs du relief (jungle et rizières) tournent dans un fil à part ; les textures se décodent en
   parallèle, à mesure qu'elles arrivent avec la page.
   Arrivée directe sur une matière (?p=…, liens « salle »), mode dev et captures : tout est fait avant. */
const BG={lite:false,done:true,reapply:false,t0:0};
async function boot(){
  try{localStorage.setItem('rvision_level','L1');}catch(e){}
  try{menuInit();}catch(e){console.warn(e);}   // le menu est utilisable avant la scène 3D
  const tick=()=>new Promise(r=>setTimeout(r,0));
  const tB=performance.now();window.RV_BOOT=[['t0',Math.round(tB)]];
  texStart();   // les textures arrivent avec la page et se décodent en parallèle
  terrainStart();   // le relief se calcule dans un fil à part pendant ce temps
  BG.lite=!CAPTURE&&!DEV&&!REDUCED&&startP<0.5&&!SALLE_P&&!Q.has('full');   // sans intro (animations réduites), rien pour masquer le second temps : tout avant
  if(Q.has('lite'))BG.lite=true;   // test
  const S=stepsL1();
  const crit=BG.lite?S.crit:S.crit.concat(S.late.filter(x=>x[0]!=='lights'));
  const nAll=crit.length;
  const prog=k=>{loadP=Math.max(loadP,Math.min(0.97,0.04+0.66*k+0.24*texFrac()));loaderTick(performance.now()/1000);};
  reserveLights();   // la place de toutes les lumières à venir est prise dès maintenant (nombre constant)
  const EARLY=new Set(['terrain','props','fauna','cons','ui','block3','fin','caveSand']);
  for(let i=0;i<crit.length;i++){const t0=performance.now();await crit[i][1]();adoptLights(false);
    // compilation anticipée : la carte graphique compile en parallèle pendant que la suite se construit
    if((!CAPTURE||Q.has('early'))&&!Q.has('nowarm')&&EARLY.has(crit[i][0]))earlyCompile();
    RV_BOOT.push([crit[i][0],Math.round(performance.now()-t0)]);prog((i+1)/nAll);await tick();}
  normalizeLights();
  // textures de la jungle : décodées pendant la construction ; on attend les dernières
  {const t0=performance.now();while(TEXST.crit<TEXST.nCrit){await Promise.race([texReady(false),new Promise(r=>setTimeout(r,60))]);prog(1);}RV_BOOT.push(['texwait',Math.round(performance.now()-t0)]);}
  fixN3(scene);if(ENV.scene)fixN3(ENV.scene);
  introAt(0,SYS);
  const p=introAt(0,SYS);camFromPose(p,camera.position,camTgt);camera.lookAt(camTgt);
  SYS.fauna.spawnCaravan(SYS.fauna.sMid);
  if(!Q.has('nowarm')){const t0=performance.now();
    if(BG.lite) await warmUp(tick,{stages:false,caves:false,only:SYS.desertObjs});   // jungle : compilation seule (la glace et le portail : pendant l'intro)
    else{await texReady(true);await warmUp(tick,{stages:true,caves:true});}
    RV_BOOT.push(['warm',Math.round(performance.now()-t0)]);}
  {const t0=performance.now();preUploadTextures();RV_BOOT.push(['upload',Math.round(performance.now()-t0)]);}
  prog(1);await tick();
  try{ if(document.fonts&&document.fonts.ready) await Promise.race([document.fonts.ready,new Promise(r=>setTimeout(r,BG.lite?600:2500))]); }catch(e){}
  loadP=1;loaderTick(performance.now()/1000);
  SC.p=SC.t=startP;
  if(startP>=0.5){T=INTRO_END;SC.locked=false;}
  applyZone(zoneOf(SC.p),true);
  if(REDUCED){T=Math.max(T,INTRO_END);}
  if(!CAPTURE){PERF.lv=Object.assign(PERF.lv,perfInitial());perfApply(PERF.lv[PERF.cls],true);}   // palier de départ : carte graphique + mémoire de l'appareil
  started=true;RV_BOOT.push(['start',Math.round(performance.now()-tB)]);
  // forêt de la finance : module et textures téléchargés quand tout est calme (le portail s'ouvre ensuite sans attente)
  if(!CAPTURE)setTimeout(()=>{if(RVFH.st)return;const L=[new URL('./foret.js?v=6189f71776',import.meta.url).href].concat(window.RV_PREFETCH||[]);
    const go=()=>{const u=L.shift();if(!u)return;fetch(u,{priority:'low'}).catch(()=>{}).finally(go);};go();go();},15000);BG.ready=performance.now();
  console.info('[R·Vision] jungle prête en '+(BG.ready/1000).toFixed(1)+' s (depuis l\'ouverture de la page)');
  if(BG.lite){BG.done=false;bgBuild(S.late,tick);}
  // comme sur la L1 : aucun profil enregistré sur cet appareil → la fenêtre de profil s'ouvre à l'arrivée
  if(!CAPTURE&&!profCurrent())setTimeout(()=>{if(SYS.prof)SYS.prof.open();},900);
}
// filet de sécurité : tout ShaderMaterial qui lit le bruit 3D reçoit la texture
const fixN3=root=>root.traverse(o=>{const ms=o.material?(Array.isArray(o.material)?o.material:[o.material]):[];ms.forEach(m=>{if(m.isShaderMaterial&&m.uniforms&&!m.uniforms.uN3&&((m.fragmentShader||'').includes('uN3')||(m.vertexShader||'').includes('uN3')))m.uniforms.uN3=U.uN3;});});
/* les étapes de construction : [nom, fonction] — crit = jungle (+ espace de glace et portail, légers,
   qui portent des lumières) ; late = tout ce qui ne se voit qu'après l'intro */
function stepsL1(){
  const crit=[
    ['data',()=>{DATA=loadL1Data(ALL_SUBJ);ALL_SUBJ.forEach(sj=>{const S=DATA.subjects[sj.key];sj.courses=S.courses;sj.done=S.done;});}],
    ['env',()=>{todInit();buildEnv(TOD.ground);TOD.envDirty=false;SYS.envDesert=ENV.tex;
      const fh='#'+TOD.cur.fog.getHexString();document.documentElement.style.setProperty('--haze',fh);}],
    ['prep',()=>{initTrails();SYS.terrain=terrainPrep();}],
    ['pyr',()=>{SYS.pyr=buildPyramid();}],
    ['props',()=>{SYS.props=buildProps(SYS.pyr);}],
    ['oasis',()=>{SYS.oasis=buildOasis();}],
    ['fauna',()=>{SYS.fauna=buildFauna();}],
    ['mist',()=>{SYS.wind=buildMist(SYS.terrain.heightTex,SYS.terrain.heightExtent);SYS.clouds=buildCloudSea();SYS.beams=buildSunBeams();}],
    ['cons',()=>{SYS.cons=buildConstellation();SYS.desertObjs=scene.children.filter(o=>!o.isLight);}],  // les lumières restent visibles (sinon : recompilation)
    ['terrain',async()=>{const R=TERR.p?await TERR.p:(()=>{const t0=performance.now();const r=terrainCompute(terrainParams(),JF.trees,JF.groves);r.ms=performance.now()-t0;return r;})();RV_BOOT.push(['terrainCalc',Math.round(R.ms),TERR.worker?'worker':'local']);const before=new Set(scene.children);SYS.terrain=buildTerrain(R);scene.children.forEach(o=>{if(!before.has(o)&&!o.isLight)SYS.desertObjs.push(o);});}],
    ['ice',()=>{SYS.space=buildIceSpace();icePalApply(SYS.space.lights);SYS.blocks=[];SYS.fins=[];}],
    ['portal',()=>{SYS.portal=buildPortal(SYS.space.root);SYS.portal.group.position.set(0,-SUBJECTS.length*SPACING+2,0);}],
    ['ui',()=>{
      SYS.drips=buildDrips();scene.add(SYS.drips.mesh);
      SYS.lbl=buildLabels(SUBJECTS[0]);
      buildHudExtras();
      SYS.prof=buildProfile(profileApply);
      SYS.iceObjs=[SYS.space.root,SYS.space.bg,SYS.drips.mesh];
      SYS.finObjs=[];}],
  ];
  const late=[
    ['iceEnv',()=>{SYS.envIce=buildIceEnv();SYS.envIceI=TOD.i;}],   // reflets de la glace (rendu sur la carte graphique) : pendant l'intro
    ...SUBJECTS.map((sj,i)=>['block'+i,()=>buildBlock(sj,i)]),
    ['finEnv',()=>{SYS.envFin=buildFinEnv();}],
    ['fin',async()=>{if(FINPRE.p)await FINPRE.p;SYS.fin=buildFinance();SYS.finObjs=[SYS.fin.root,SYS.fin.bg];if(started)SYS.finObjs.forEach(o=>o.visible=(ZONE==='fin'));}],
    ...FIN_SUBJECTS.map((sj,i)=>['finObj'+i,()=>buildFinObj(sj,i)]),
    ['fincaves',()=>{SYS.fincaves=buildFinCaves(SYS.fin,SYS.fins);}],
    ['dev',()=>{SYS.dev=buildDevMenu(DEV);}],   // lit les blocs et la finance
    ['walls',()=>{insightSourceL1(DATA,ALL_SUBJ);WALLST.ana=analyseL1();
      SYS.walls=[buildIceWall(SYS.fin.root,DATA,ALL_SUBJ,wpOverview,0),buildIceWall(SYS.fin.root,DATA,ALL_SUBJ,wpActivity,12.6),buildIceWall(SYS.fin.root,DATA,ALL_SUBJ,wpAnalysis,25.2)];
      SYS.wall=SYS.walls[0];SYS.wallui=buildWallUI(SYS.walls,ALL_SUBJ);SYS.ovl=buildOverlay();}],
    ['fx',()=>{SYS.flow=buildSandFlow(SYS.space.root);SYS.flow.streaks.visible=false;SYS.flow.clouds.visible=false;   // espace calme : plus de vent
      SYS.shatter=buildShatter(SYS.space.root);}],
    ['caveIce',()=>{SYS.cave=buildBookCave('ice');}],
    ['caveSand',()=>{SYS.sandCave=buildBookCave('sand');}],
    ['lights',()=>{adoptLights(true);}],
  ];
  return {crit,late};
}
/* second temps (pendant l'intro) : une tranche par image, puis compilation et préchauffage */
async function bgBuild(late,tick){
  BG.t0=performance.now();
  const gap=()=>new Promise(r=>requestAnimationFrame(()=>setTimeout(r,0)));
  try{
    // on laisse passer les toutes premières images (le chargeur s'efface)
    while(T<0.05&&!document.hidden)await gap();
    for(const [nm,fn] of late){await gap();const t0=performance.now();try{const r=fn();if(r&&r.then){await r;}}catch(e){console.error('bg',nm,e);}RV_BOOT.push(['bg:'+nm,Math.round(performance.now()-t0)]);}
    await texReady(true);
    fixN3(scene);
    {const t0=performance.now();await gap();await warmUp(tick,{stages:true,caves:true,bg:true});RV_BOOT.push(['bg:warm',Math.round(performance.now()-t0)]);}
    await gap();preUploadTextures();
  }catch(e){console.error('bg',e);}
  finally{   // quoi qu'il arrive, le scroll se débloque
    PERF.frames=0;PERF.acc=0;PERF.ring.length=0;PERF.slow=PERF.fast=0;   // la qualité adaptative repart d'une mesure propre
    BG.done=true;RV_BOOT.push(['bg:done',Math.round(performance.now()-BG.t0)]);BG.end=performance.now();
    console.info('[R·Vision] tout le parcours prêt en '+(BG.end/1000).toFixed(1)+' s');
  }
  if(BG.reapply){BG.reapply=false;try{profileApply();}catch(e){console.error(e);}}
}
/* remplaçants éteints : toutes les lumières créées plus tard (oasis, campements, glace, portails, finance,
   grottes de la finance) ont leur place réservée dès le départ — le nombre de lumières par type ne change
   jamais, donc un shader compilé tôt reste valable jusqu'au bout */
function reserveLights(){
  const R=[],F=FIN_SUBJECTS.length;
  const add=l=>{l.userData.dummy=true;scene.add(l);if(l.target)scene.add(l.target);R.push(l);};
  for(let i=0;i<3;i++)add(new THREE.DirectionalLight(0xffffff,0));                 // glace : clé, contre-jour, débouchage
  {const d=new THREE.DirectionalLight(0xffffff,0);d.castShadow=true;d.shadow.mapSize.set(MOBILE?1024:2048,MOBILE?1024:2048);d.shadow.autoUpdate=false;add(d);}   // soleil de la finance
  add(new THREE.HemisphereLight(0xffffff,0x000000,0));                               // ciel de la finance
  for(let i=0;i<5+2*F;i++)add(new THREE.PointLight(0xffffff,0,10,1.6));              // feux, portails, grottes
  SYS.dummyL=R;
  scene.traverse(o=>{if(o.isLight&&!o.userData.dummy)o.userData.adopted=true;});    // soleil et ciel de la jungle : déjà là
}
/* chaque nouvelle lumière passe directement sous la scène (les zones masquées ne la cachent pas)
   et prend la place d'un remplaçant du même type */
function adoptLights(post){
  const L=[];scene.traverse(o=>{if(o.isLight&&!o.userData.dummy&&!o.userData.adopted)L.push(o);});
  for(const l of L){
    l.userData.adopted=true;
    if(l.parent!==scene)scene.attach(l);if(l.target&&l.target.parent!==scene)scene.attach(l.target);
    const i=(SYS.dummyL||[]).findIndex(d=>d.type===l.type&&d.castShadow===l.castShadow);
    if(i>=0){const d=SYS.dummyL.splice(i,1)[0];scene.remove(d);if(d.target)scene.remove(d.target);d.dispose();}
    else console.warn('lumière sans remplaçant',l.type);
    if(post){   // après le premier temps : réglée comme les autres (éteinte hors de sa zone)
      l.userData.baseI=l.intensity;l.layers.enable(1);SYS.allLights.push(l);
      l.intensity=0;if(l.castShadow)l.shadow.autoUpdate=false;}
  }
  if(post&&SYS.fin){SYS.lightsBy.fin=[SYS.fin.sun,SYS.fin.hemi];if(ZONE==='fin')applyZone('fin',true);}
}
/* compilation non bloquante de ce qui existe déjà (même configuration que le rendu réel) */
let _rtE=null;
function earlyCompile(){
  try{_rtE=_rtE||new THREE.WebGLRenderTarget(64,64,{type:THREE.HalfFloatType,samples:rt.samples});
    renderer.setRenderTarget(_rtE);
    // premier temps : seulement ce que montre la jungle (la glace et le portail attendent l'intro)
    if(BG.lite&&SYS.desertObjs)SYS.desertObjs.forEach(o=>renderer.compile(o,camera,scene));else renderer.compile(scene,camera);}catch(e){console.warn(e);}
  renderer.setRenderTarget(null);
}
/* changement de profil : on recharge les vraies données du profil choisi. Au tout début (désert,
   avant la glace), tout est remis en place sans recharger la page ; plus loin, on recharge. */
function profileApply(){
  if(ZONE!=='desert'||SC.p>0.45||CAVE.on){location.reload();return;}
  if(!BG.done){DATA=loadL1Data(ALL_SUBJ);ALL_SUBJ.forEach(sj=>{const S=DATA.subjects[sj.key];sj.courses=S.courses;sj.done=S.done;});BG.reapply=true;const d=document.getElementById('demo');if(d)d.remove();return;}   // le reste se met à jour à la fin du second temps
  DATA=loadL1Data(ALL_SUBJ);ALL_SUBJ.forEach(sj=>{const S=DATA.subjects[sj.key];sj.courses=S.courses;sj.done=S.done;});
  SYS.blocks.forEach(b=>{b.mT=masteryOf(b.sj);b.m0=seenStart(b.sid,b.mT);b.m=b.m0;b.started=false;b.saved=false;b.burst=0;b.burstT=0;b.freeK=0;b.lastPhase=-1;b.s=null;b.ice.mesh.visible=true;});
  SYS.fins.forEach(F=>{F.fT=masteryOf(F.sj);F.f0=seenStart(F.sid,F.fT);F.f=F.f0;F.started=false;F.saved=false;F.lastPhase=-1;});
  SYS.fincaves.caves.forEach(C=>{C.played=false;C.here=false;C.ct=-1;});
  insightSourceL1(DATA,ALL_SUBJ);WALLST.ana=analyseL1();
  SYS.walls.forEach(W=>{W.started=false;W.t=0;});SYS.wallui.rerender();
  const d=document.getElementById('demo');if(d)d.remove();
}
function buildBlock(sj,i){
  SYS.blocks=SYS.blocks||[];
  const obj=sj.build();
  const KP=sampleKP(obj.group);
  const ice=buildIceBlock(KP);
  const B=boundsOf(KP);
  const pivot=new THREE.Group();pivot.position.set(0,-i*SPACING+2,0);SYS.space.root.add(pivot);
  const content=new THREE.Group();content.position.set(-B.cx,-(B.y0+B.y1)/2,-B.cz);pivot.add(content);
  content.add(obj.group,ice.mesh);
  SYS.space.addTexts(sj.words,-i*SPACING+2);
  const mT=masteryOf(sj),m0=seenStart('blk_'+sj.key,mT);
  SYS.blocks.push({sj,i,obj,ice,pivot,content,B,m:m0,m0,mT,act:0,started:false,lastPhase:-1,glitch:0,sid:'blk_'+sj.key});
}
function buildFinObj(sj,i){
  SYS.fins=SYS.fins||[];
  const obj=sj.build();
  const sf=buildInkForm(obj);   // L1 : l'objet se dessine à l'encre
  const plat=SYS.fin.plats[i];
  const holder=new THREE.Group();holder.position.copy(plat.P);holder.position.y=plat.top+0.62;SYS.fin.root.add(holder);
  const K=sj.scale||1;holder.scale.setScalar(K);
  const spin=new THREE.Group();holder.add(spin);   // l'objet tourne sur lui-même (le cocon et le tourbillon restent dans le repère du socle)
  obj.group.position.set(-sf.center.x,0,-sf.center.z);spin.add(obj.group);
  const fT=masteryOf(sj),f0=seenStart('fin_'+sj.key,fT);
  SYS.fins.push({sj,i,obj,sf,holder,spin,plat,k:K,f:f0,f0,fT,started:false,lastPhase:-1,glitch:0,yaw:0,sid:'fin_'+sj.key});
}
/* les lumières restent toujours dans la scène (nombre constant = pas de recompilation
   des shaders au changement de monde) ; on ne joue que sur leur intensité */
function normalizeLights(){
  const L=[];scene.traverse(o=>{if(o.isLight)L.push(o);});
  L.forEach(l=>{if(l.parent!==scene)scene.attach(l);if(l.target&&l.target.parent!==scene)scene.attach(l.target);l.userData.baseI=l.intensity;l.layers.enable(1);});   // couche 1 : le reflet du lagon voit les mêmes lumières (mêmes shaders)
  SYS.lightsBy={desert:[sun,hemi,SYS.oasis.fireL,SYS.fauna.campL,SYS.fauna.fireL2],ice:SYS.space.lights.slice(),fin:SYS.fin?[SYS.fin.sun,SYS.fin.hemi]:[]};
  SYS.allLights=L;
}
async function warmUp(tick,opt={stages:true,caves:true}){
  /* 1) compilation de tous les matériaux (même invisibles) dans la configuration exacte du
     rendu réel (cible hors écran au même format → pas de tone mapping), en parallèle ;
     2) puis, une image à la fois, un dessin minuscule (64 px) de chaque étape du parcours.
     Hors capture, tout cela tourne PENDANT l'intro (le scroll y est bloqué) : le chargement
     n'attend plus la préparation de la glace et de la finance. */
  const rtW=new THREE.WebGLRenderTarget(64,64,{type:THREE.HalfFloatType,samples:rt.samples});
  renderer.setRenderTarget(rtW);
  let pr=null;try{ if(renderer.compileAsync) pr=(opt.only?Promise.all(opt.only.map(o=>renderer.compileAsync(o,camera,scene))):renderer.compileAsync(scene,camera)); }catch(e){}
  renderer.setRenderTarget(null);
  try{ if(pr) await pr; }catch(e){}
  const nextFrame=()=>new Promise(r=>requestAnimationFrame(()=>r()));
  // pendant l'intro (second temps) : une étape par image, entre deux images de l'intro
  const between=()=>new Promise(r=>requestAnimationFrame(()=>setTimeout(r,0)));
  if(opt.stages)for(const P of [1,2,3,4,P_PORTAL-1,P_PORTAL,P_PORTAL+0.4,P_CUT+0.1,P_FIN,P_FIN+1,P_STATS]){
    if(opt.bg) await between(); else if(CAPTURE) await tick(); else{await nextFrame();loadP=Math.min(0.985,loadP+0.012);loaderTick(performance.now()/1000);}
    // bloc synchrone : sauvegarde → étape → dessin minuscule → restauration
    const save={T,p:SC.p,t:SC.t,cap:SC.capNow,zone:ZONE,cam:[CAMR.pos.clone(),CAMR.vel.clone(),CAMR.tgt.clone(),CAMR.tv.clone(),CAMR.init,CAMR.roll],
      b:SYS.blocks.map(b=>({started:b.started,m:b.m,saved:b.saved,lastPhase:b.lastPhase,glitch:b.glitch})),
      f:SYS.fins.map(F=>({started:F.started,f:F.f,saved:F.saved,lastPhase:F.lastPhase,glitch:F.glitch})),
      w:{started:SYS.wall.started,t:SYS.wall.t},pos:camera.position.clone(),q:camera.quaternion.clone(),fov:camera.fov};
    try{
      WARMING=true;T=INTRO_END+1;SC.p=SC.t=P;SC.last=-1e9;CAVE.warm=(P===1);
      frame(0.016,false);renderer.setRenderTarget(rtW);renderer.render(scene,camera);
    }catch(e){}
    WARMING=false;CAVE.warm=false;
    renderer.setRenderTarget(null);
    T=save.T;SC.p=save.p;SC.t=save.t;SC.capNow=save.cap;
    SYS.blocks.forEach((b,i)=>Object.assign(b,save.b[i]));SYS.fins.forEach((F,i)=>Object.assign(F,save.f[i]));Object.assign(SYS.wall,save.w);
    CAMR.pos.copy(save.cam[0]);CAMR.vel.copy(save.cam[1]);CAMR.tgt.copy(save.cam[2]);CAMR.tv.copy(save.cam[3]);CAMR.init=save.cam[4];CAMR.roll=save.cam[5];
    camera.position.copy(save.pos);camera.quaternion.copy(save.q);if(camera.fov!==save.fov){camera.fov=save.fov;camera.updateProjectionMatrix();}
    SYS.lbl.setVisible(0);ICEST.lblIdx=-1;FINST.lblIdx=-1;
    if(save.zone) applyZone(save.zone,true);
    CAMR.init=save.cam[4];   // la zone remise en place ne doit pas recaler la caméra de l'intro
  }
  // grottes : scènes à part, compilées et dessinées une fois (livres, piliers, éclats visibles)
  if(opt.caves)for(const cv of [SYS.cave,SYS.sandCave]){
    if(opt.bg) await between(); else if(CAPTURE) await tick(); else await nextFrame();
    try{const pos=camera.position.clone(),q=camera.quaternion.clone(),fov=camera.fov;
      cv.scene.environment=cv.kind==='ice'?SYS.envIce:SYS.envFin;cv.scene.environmentIntensity=cv.envK;
      cv.layout(8);cv.books.forEach(b=>{b.chunk.visible=true;b.coverM.map=BOOK_BLANK;});cv.shat.mesh.count=1;cv.update(0.016,T,camera,true);
      camera.position.copy(cv.view.pos);camera.lookAt(cv.view.tgt);camera.updateMatrixWorld();
      try{ if(renderer.compileAsync){renderer.setRenderTarget(rtW);const pc=renderer.compileAsync(cv.scene,camera);renderer.setRenderTarget(null);await pc;} }catch(e){}
      renderer.setRenderTarget(rtW);renderer.render(cv.scene,camera);renderer.setRenderTarget(null);
      cv.update(0.016,T,camera,false);cv.layout(0);
      camera.position.copy(pos);camera.quaternion.copy(q);if(camera.fov!==fov){camera.fov=fov;camera.updateProjectionMatrix();}}catch(e){console.warn(e);}
  }
  rtW.dispose();
}
/* envoi anticipé de toutes les textures à la carte graphique (sinon : à-coup au premier affichage) */
function preUploadTextures(){
  const seen=new Set();
  const add=t=>{if(t&&t.isTexture&&!seen.has(t)&&!t.isRenderTargetTexture){seen.add(t);try{renderer.initTexture(t);}catch(e){}}};
  scene.traverse(o=>{const ms=o.material?(Array.isArray(o.material)?o.material:[o.material]):[];
    ms.forEach(m=>{for(const k in m){const v=m[k];if(v&&v.isTexture)add(v);}
      if(m.uniforms)for(const k in m.uniforms){const v=m.uniforms[k]&&m.uniforms[k].value;if(v&&v.isTexture)add(v);else if(Array.isArray(v))v.forEach(add);}});});
  [SYS.envDesert,SYS.envIce,SYS.envFin].forEach(add);
}
function zoneOf(P){return P<0.5?'desert':(P<P_CUT?'ice':'fin');}
/* ═══ 38 · Accès rapide (lot 1) : intro interruptible, rail de parcours cliquable, touches ═══
   - intro : clic, touche, molette ou toucher → avance rapide (×12) jusqu'au plan d'ensemble, comme dans un jeu ;
     intro déjà vue pendant cette session du navigateur (retour d'un cours, bascule L1/L2) → avance rapide d'office ;
   - rail : l'index « 00 01 02 … ∑ » à droite devient cliquable (au survol : nom de la matière et touche) ;
   - clavier : 1…n = matières, 0 ou Début = accueil, Fin = statistiques (touches lues par position : AZERTY sans Maj) ;
   - saut lointain : fondu dans la couleur du lieu, déplacement, fondu de retour (jamais de coupe sèche). */
const NAV={skip:false,init:false,veil:0,jump:null,pending:null,hint:null,hintState:'',home:null,homeOn:null,fc:new THREE.Color(),fcOn:false};
const NAV_FF=12, NAV_KEY='rv_intro_L1';
function navStations(){return SUBJECTS.map((s,i)=>i+1).concat(FIN_SUBJECTS.map((s,j)=>P_FIN+j),[P_STATS]);}
function navBusy(){return !started||WARMING||CAVE.on||MENU.open||!!(SYS.prof&&SYS.prof.st.open)||!!(SYS.ovl&&SYS.ovl.st.open);}
function introSkip(){if(!started||CAPTURE||NAV.skip||T>=INTRO_END-0.3)return false;NAV.skip=true;return true;}
function navGo(P){
  if(navBusy())return;
  if(SC.locked||NAV.jump){NAV.pending=P;if(SC.locked)introSkip();return;}   // pendant l'intro, la fin du chargement ou un saut en cours : on mémorise, on y va juste après
  P=Math.max(0,Math.min(PMAX,P));
  if(Math.abs(P-SC.p)<=1.5){SC.t=P;SC.last=performance.now()-1e4;}
  else NAV.jump={to:P,ph:0,hold:0};
}
function navTick(dt){
  if(WARMING||!started)return;
  if(!NAV.init){NAV.init=true;
    if(!CAPTURE){let seen=false;try{seen=sessionStorage.getItem(NAV_KEY)==='1';sessionStorage.setItem(NAV_KEY,'1');}catch(e){}
      if(((seen&&OPT.intro!=='always')||OPT.intro==='never'||NAV.auto)&&T<INTRO_END-0.3){NAV.skip=true;T=Math.max(T,-0.1);}}}   // options du menu : intro toujours / une fois par session / jamais
  // avance rapide de l'intro (T a déjà avancé de dt : on ajoute le reste)
  if(NAV.skip){if(T<0.8){}   // le chargeur finit de s'effacer à vitesse normale (pas de coupe sèche)
    else if(T<INTRO_END)T=Math.min(INTRO_END,T+dt*(NAV_FF-1));else NAV.skip=false;}
  // destination demandée pendant que le scroll était bloqué
  if(NAV.pending!==null&&!SC.locked&&!NAV.jump){const p=NAV.pending;NAV.pending=null;navGo(p);}
  // saut lointain : voile → déplacement → retour
  if(NAV.jump){const J=NAV.jump;
    if(J.ph===0){NAV.veil=Math.min(1,NAV.veil+dt/0.22);if(NAV.veil>=1){SC.p=SC.t=J.to;SC.last=performance.now()-1e4;J.ph=1;J.hold=0;}}
    else if(J.ph===1){SC.p=SC.t=J.to;if(++J.hold>=3)J.ph=2;}
    else{NAV.veil=Math.max(0,NAV.veil-dt/0.45);if(NAV.veil<=0)NAV.jump=null;}}
  // invite
  if(NAV.hint){
    NAV.waitN=(SC.locked&&T>=INTRO_END-0.3)?(NAV.waitN||0)+1:0;   // « préparation » : seulement si le blocage dure (fin du chargement en arrière-plan)
    const st=(T>0.6&&T<INTRO_END-2.2&&!NAV.skip)?'skip':NAV.waitN>3?'wait':'';
    if(st!==NAV.hintState){NAV.hintState=st;
      if(st==='skip')NAV.hint.textContent=MOBILE?'Touche l’écran — passer l’intro':'Clic ou touche — passer l’intro';
      else if(st==='wait')NAV.hint.textContent='Préparation du parcours…';
      NAV.hint.classList.toggle('on',st!=='');}
  }
  if(NAV.home){const on=SC.p<0.5&&T>=INTRO_END-0.3;if(on!==NAV.homeOn){NAV.homeOn=on;NAV.home.classList.toggle('on',on);if(on)SYS.idx.forEach(e=>e.classList.remove('on'));}}   // à l'accueil, aucune matière ne reste allumée
}
function navBtn(e,name,P,key){
  e.setAttribute('role','button');e.tabIndex=0;e.setAttribute('aria-label',name);e.dataset.n=name;e.dataset.k=key;
  const go=ev=>{ev.preventDefault();ev.stopPropagation();navGo(P);if(e.blur)e.blur();};
  e.addEventListener('click',go);
  e.addEventListener('keydown',ev=>{if(ev.key==='Enter'||ev.key===' ')go(ev);});
}
function navRail(ix){
  ix.removeAttribute('aria-hidden');ix.setAttribute('role','navigation');ix.setAttribute('aria-label','Parcours');
  const st=navStations(),names=ALL_SUBJ.map(s=>s.name).concat(['STATISTIQUES']);
  SYS.idx.forEach((e,i)=>navBtn(e,names[i],st[i],i<ALL_SUBJ.length?String(i+1):'Fin'));
  const h=document.createElement('span');h.textContent='00';ix.insertBefore(h,ix.firstChild);navBtn(h,'ACCUEIL',0,'0');NAV.home=h;   // hors de SYS.idx : les indices existants ne bougent pas
}
{const h=document.createElement('p');h.id='skp';h.className='mono';h.setAttribute('aria-hidden','true');document.getElementById('hud').appendChild(h);NAV.hint=h;}
function navSkipEvt(e){
  if(!started||NAV.skip||T>=INTRO_END-0.3)return;
  const t=e.target;if(MENU.open||(t&&t.closest&&t.closest('#pm,#mm,#dev,#devm,button,a,input')))return;
  if(e.type==='keydown'&&(e.ctrlKey||e.metaKey||e.altKey||['Shift','Control','Alt','Meta','AltGraph','CapsLock','Tab','F5','F11','F12'].includes(e.key)))return;
  introSkip();
}
['pointerdown','wheel','keydown','touchstart'].forEach(n=>window.addEventListener(n,navSkipEvt,{passive:true,capture:true}));
window.addEventListener('keydown',e=>{
  if(e.ctrlKey||e.metaKey||e.altKey)return;
  const t=e.target;if(t&&t.closest&&t.closest('input,textarea,select,[contenteditable]'))return;
  if(navBusy())return;
  let P=null;const m=/^(?:Digit|Numpad)([0-9])$/.exec(e.code||'');
  if(e.key==='Home'||(m&&m[1]==='0'))P=0;
  else if(e.key==='End')P=P_STATS;
  else if(m&&+m[1]<=ALL_SUBJ.length)P=navStations()[+m[1]-1];
  if(P===null)return;
  e.preventDefault();navGo(P);
});

/* ═══ 39 · Menu principal (lot 5) ═══
   - dès le chargement, sous la constellation : « Continuer » (le dernier cours ouvert) et « Matières et cours » ;
     ce sont de simples liens : on rejoint un cours sans attendre que la scène 3D soit prête ;
   - ensuite : bouton [ Menu ] sous le titre, ou touche M ; Échap ferme ;
   - options enregistrées sur l'appareil (rv_opts) : qualité graphique, intro, son. */
const OPT={q:'auto',intro:'session'};try{Object.assign(OPT,JSON.parse(localStorage.getItem('rv_opts')||'{}'));}catch(e){}
const OPT_Q={ultra:0,haute:1,equil:3,eco:5};   // paliers de la qualité adaptative (0 = pleine définition)
function optSave(){try{localStorage.setItem('rv_opts',JSON.stringify(OPT));}catch(e){}}
const MENU={open:false,el:null};
function menuAgo(ms){if(!ms)return '';const d=Math.floor((Date.now()-ms)/864e5);return d<=0?'aujourd’hui':d===1?'hier':'il y a '+d+' j';}
function menuEl(tag,cls,txt,par){const e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined&&txt!==null)e.textContent=txt;if(par)par.appendChild(e);return e;}
function menuData(){
  let D=null;try{D=loadL1Data(ALL_SUBJ);}catch(e){}
  const subs=[];let last=null;
  ALL_SUBJ.forEach((sj,i)=>{const S=D&&D.subjects&&D.subjects[sj.key],list=((S&&S.list)||[]).filter(c=>c.url);list.forEach(c=>{if(c.last&&(!last||c.last>last.last))last=c;});subs.push({sj,i,list});});
  return {subs,last};
}
function menuGo(P){menuClose();if(started)navGo(P);else{NAV.pending=P;NAV.auto=true;}}
function menuBuild(){
  const D=menuData(),m=MENU.el;m.textContent='';
  const box=menuEl('div','mm-in',null,m),h=menuEl('div','mm-h',null,box);menuEl('span','mm-t','MENU',h);
  const x=menuEl('button','mm-x','Fermer ✕',h);x.type='button';x.addEventListener('click',menuClose);
  const g=menuEl('div','mm-g',null,box),a=menuEl('nav','mm-a',null,g),b=menuEl('div','mm-b',null,g);
  if(D.last){const k=menuEl('a','mm-k go','Continuer',a);k.href=D.last.url;menuEl('small',null,D.last.name+' — '+menuAgo(D.last.last),k);}
  const bt=(txt,sub,fn)=>{const k=menuEl('button','mm-k',txt,a);k.type='button';if(sub)menuEl('small',null,sub,k);k.addEventListener('click',fn);return k;};
  const lk=(txt,sub,href)=>{const k=menuEl('a','mm-k',txt,a);k.href=href;if(sub)menuEl('small',null,sub,k);return k;};
  bt('Accueil','Retour au début du parcours',()=>menuGo(0));
  bt('Statistiques','Progression, activité, analyse',()=>menuGo(P_STATS));
  lk('Bibliothèque','Coffres et collection d’objets','bibliotheque.html');
  lk('Licence 2','Changer de niveau','l2.html');
  const o=menuEl('div','mm-o',null,a);
  const grp=(title,key,vals)=>{menuEl('p',null,title,o);const d=menuEl('div',null,null,o);
    vals.forEach(v=>{const bb=menuEl('button',OPT[key]===v[0]?'on':'',v[1],d);bb.type='button';bb.addEventListener('click',()=>{OPT[key]=v[0];optSave();Array.from(d.children).forEach(c=>c.classList.toggle('on',c===bb));});});};
  grp('Qualité graphique','q',[['auto','Auto'],['ultra','Ultra'],['haute','Haute'],['equil','Équilibrée'],['eco','Éco']]);
  grp('Intro','intro',[['always','Toujours'],['session','Une fois par session'],['never','Jamais']]);
  const snd=document.getElementById('snd');
  if(snd){menuEl('p',null,'Son',o);const d=menuEl('div',null,null,o),on0=snd.getAttribute('aria-pressed')==='true',sb=menuEl('button',on0?'on':'',on0?'Activé':'Coupé',d);sb.type='button';
    sb.addEventListener('click',()=>{snd.click();setTimeout(()=>{const on=snd.getAttribute('aria-pressed')==='true';sb.textContent=on?'Activé':'Coupé';sb.classList.toggle('on',on);},80);});}
  const st=navStations();
  D.subs.forEach(S=>{const sec=menuEl('section','mm-s',null,b),h3=menuEl('h3',null,null,sec);menuEl('span',null,String(S.i+1).padStart(2,'0')+' · '+S.sj.name,h3);
    const gb=menuEl('button',null,'Voir dans le parcours →',h3);gb.type='button';gb.addEventListener('click',()=>menuGo(st[S.i]));
    if(!S.list.length){menuEl('div','mm-e','Aucun cours pour l’instant',sec);return;}
    S.list.forEach(c=>{const l=menuEl('a','mm-c',null,sec);l.href=c.url;menuEl('span',null,c.name,l);menuEl('em',null,c.last?menuAgo(c.last):'jamais ouvert',l);
      const bar=menuEl('i',null,null,l),f=menuEl('b',null,null,bar);f.style.width=Math.round(Math.min(1,(c.xp||0)/(c.maxXp||1))*100)+'%';});});
}
function menuOpen(){if(!MENU.el)return;menuBuild();MENU.el.classList.add('on');MENU.open=true;const f=MENU.el.querySelector('.mm-k');if(f&&f.focus)f.focus();}
function menuClose(){if(!MENU.el)return;MENU.el.classList.remove('on');MENU.open=false;}
function menuInit(){
  const m=menuEl('div','',null,document.body);m.id='mm';m.setAttribute('role','dialog');m.setAttribute('aria-modal','true');m.setAttribute('aria-label','Menu');MENU.el=m;
  m.addEventListener('click',e=>{if(e.target===m)menuClose();});
  const b=document.getElementById('mmb');if(b)b.addEventListener('click',menuOpen);
  const ui=document.querySelector('#loader .ld-ui');   // accès immédiat pendant le chargement
  if(ui&&!CAPTURE){const D=menuData(),r=menuEl('div','ld-m',null,ui);
    if(D.last){const k=menuEl('a',null,'Continuer · '+D.last.name,r);k.href=D.last.url;}
    const mb=menuEl('button',null,'Matières et cours',r);mb.type='button';mb.addEventListener('click',menuOpen);}
}
['wheel','touchmove','keydown','pointerdown'].forEach(n=>window.addEventListener(n,e=>{
  if(n==='keydown'&&!e.ctrlKey&&!e.metaKey&&!e.altKey){
    const t=e.target,typing=t&&t.closest&&t.closest('input,textarea,select,[contenteditable]');
    if(e.key==='Escape'&&MENU.open){menuClose();e.stopImmediatePropagation();return;}
    if(!typing&&(e.key==='m'||e.key==='M')&&!(SYS.prof&&SYS.prof.st.open)&&!CAVE.on){if(MENU.open)menuClose();else menuOpen();e.stopImmediatePropagation();return;}}
  if(MENU.open)e.stopImmediatePropagation();   // menu ouvert : la scène ne défile pas
},{capture:true,passive:true}));

function buildHudExtras(){
  const hud=document.getElementById('hud');
  if(!DATA.real){const d=document.createElement('p');d.id='demo';d.textContent='// valeurs de démonstration';hud.appendChild(d);}
  const ix=document.createElement('div');ix.id='idx';ix.setAttribute('aria-hidden','true');
  ix.innerHTML=ALL_SUBJ.map(s=>`<span>${String(s.idx).padStart(2,'0')}</span>`).join('')+'<span>∑</span>';hud.appendChild(ix);
  SYS.idx=[...ix.children];navRail(ix);
  // côté finance : flèches et carrousel façon igloo
  const al=document.createElement('button');al.id='farr-l';al.className='farr';al.setAttribute('aria-label','Matière précédente');al.innerHTML='<svg viewBox="0 0 64 12" aria-hidden="true"><path d="M2 10 L12 2 M2 10 H62" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>';
  const ar=document.createElement('button');ar.id='farr-r';ar.className='farr';ar.setAttribute('aria-label','Matière suivante');ar.innerHTML='<svg viewBox="0 0 64 12" aria-hidden="true"><path d="M62 10 L52 2 M62 10 H2" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>';
  al.addEventListener('click',()=>{SC.t=Math.max(P_FIN,Math.round(SC.t)-1);SC.last=performance.now()-1e4;});
  ar.addEventListener('click',()=>{SC.t=Math.min(PMAX,Math.round(SC.t)+1);SC.last=performance.now()-1e4;});
  hud.appendChild(al);hud.appendChild(ar);
  const car=document.createElement('div');car.id='fcar';
  const short=['ÉCO.'];
  car.innerHTML=FIN_SUBJECTS.map((s,i)=>`<button type="button" data-i="${i}"><span class="cl">${s.name}</span><span class="cs">${short[i]||s.name}</span></button>`).join('')+`<button type="button" data-i="${FIN_SUBJECTS.length}"><span class="cl">STATISTIQUES</span><span class="cs">STATS</span></button>`;
  car.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{SC.t=P_FIN+(+b.dataset.i);SC.last=performance.now()-1e4;}));
  hud.appendChild(car);SYS.car=[...car.children];
}

/* bascule des réglages globaux entre les trois mondes */
/* ═══ Rayons de soleil de la jungle : réglage par ambiance ═══
   multiplicateur appliqué aux faisceaux de la canopée et aux rayons volumétriques (jungle de l'accueil seulement, la forêt n'est pas concernée).
   Deux passes successives des mêmes baisses (AUBE −10 % · JOUR −30 % · COUCHANT −55 %), d'où, par rapport à l'origine :
   AUBE ×0,81 (−19 %) · JOUR ×0,49 (−51 %) · COUCHANT ×0,2025 (−80 %) · CRÉPUSCULE inchangé · NUIT intensité d'origine.
   NUIT : plus d'arc-en-ciel ; la couleur naturelle du clair de lune, à moitié blanchie, à luminosité égale à l'origine.
   Fondu lent (≈ 30 s) quand l'heure change d'ambiance. */
const RAY_BY_TOD=[0.90*0.90,0.70*0.70,0.45*0.45,1,1];
const RAYTUNE={k:null,n:null};
const _rayGray=new THREE.Color();
function rayTune(dt){const t=RAY_BY_TOD[TOD.i],k=t===undefined?1:t,n=TOD.i===4?1:0,a=1-Math.exp(-Math.max(0,dt)/30);
  RAYTUNE.k=RAYTUNE.k===null?k:RAYTUNE.k+(k-RAYTUNE.k)*a;RAYTUNE.n=RAYTUNE.n===null?n:RAYTUNE.n+(n-RAYTUNE.n)*a;return RAYTUNE;}

let ZONE='';
function applyZone(z,force){
  if(z===ZONE&&!force) return;ZONE=z;
  const ice=z==='ice',fin=z==='fin',des=z==='desert';
  SYS.desertObjs.forEach(o=>o.visible=des);
  SYS.iceObjs.forEach(o=>o.visible=ice);
  SYS.finObjs.forEach(o=>o.visible=fin);
  if(!ice) SYS.blocks.forEach(b=>b.pivot.visible=false);
  SYS.allLights.forEach(l=>{l.intensity=0;if(l.castShadow)l.shadow.autoUpdate=false;});
  SYS.lightsBy[z].forEach(l=>{l.intensity=l.userData.baseI;if(l.castShadow){l.shadow.autoUpdate=true;l.shadow.needsUpdate=true;}});
  sky.visible=des;
  if(ice){icePalApply(SYS.space.lights);
    // reflets de l'espace de glace : régénérés seulement si l'heure a changé de période
    if(SYS.envIceI!==TOD.i&&started){const old=SYS.envIce;SYS.envIce=buildIceEnv();SYS.envIceI=TOD.i;if(old)old.dispose();}}
  scene.environment=ice?SYS.envIce:fin?SYS.envFin:SYS.envDesert;scene.environmentIntensity=ice?1.0:fin?0.9:0.38;
  scene.background=(ice?ICE_PAL.mid:fin?FIN_PAL.mid:TOD.cur.fog).clone();
  renderer.toneMappingExposure=ice?0.7:fin?0.78:1.05;
  bloom.strength=ice?0.32:fin?0.4:0.42;bloom.threshold=ice?0.95:fin?0.93:0.92;
  finalPass.uniforms.uHeat.value=ice?0:fin?0.35:0;finalPass.uniforms.uGrade.value=(ice||fin)?0:1;finalPass.uniforms.uGrain.value=PERF.cls==='cave'?0.012:0.03;finalPass.uniforms.uNight.value=0;
  U.uFogY0.value=0;U.uWind.value.set(0.88,0.47).normalize();U.uLum.value=1;U.uGlowPow.value=6;U.uMistK.value=0;   // brume de marécage : jungle seulement
  if(ice){U.uFogColor.value.copy(ICE_PAL.fog);U.uFogDensity.value=0.0085;U.uFogHeight.value=0.0;U.uDust.value=0.6;
    U.uSunColor.value.setRGB(0.10,0.07,0.06);U.uSunDir.value.set(-0.5,0.55,0.65).normalize();U.uGlowCol.value.copy(U.uSunColor.value).multiplyScalar(0.32);}
  else if(fin){U.uFogColor.value.copy(FIN_PAL.fog);U.uFogDensity.value=0.0055;U.uFogHeight.value=0.05;U.uFogY0.value=FIN_ORIGIN.y;U.uDust.value=1.0;
    U.uSunColor.value.set('#ffcf9e');U.uSunDir.value.copy(SYS.fin.SUNV);U.uWind.value.copy(FIN_W);U.uGlowCol.value.copy(U.uSunColor.value).multiplyScalar(0.32);}
  else todDesertGlobals();
  const hud=document.getElementById('hud');hud.classList.toggle('ice',!des);hud.classList.toggle('fin',fin);
  if(des)CAMR.init=false;else if(camera.fov!==30){camera.fov=30;camera.up.set(0,1,0);camera.updateProjectionMatrix();}
  if(!des) tagsUpdate([]);
  SYS.lbl.setVisible(0);ICEST.lblIdx=-1;FINST.lblIdx=-1;
  AUDIO.boost=fin?0.6:0;
  if(!ice&&SYS.portal) SYS.portal.glowL.intensity=0;
  if(!fin&&SYS.fin) SYS.fin.portalHi.glowL.intensity=0;
  if(!fin&&SYS.wallui){SYS.wallui.update(-99,0,false);hud.classList.remove('stats');wallTip(null);}
}

/* ─────────── Bande son : poids de chaque ambiance selon l'endroit ─────────── */
let _audLastP=0;
function audioMix(P){
  const ck=smooth(0.25,0.75,CAVE.k);
  const m={night:clamp01(U.uLantern.value)};
  if(ZONE==='desert'){m.desert=1-smooth(0.3,0.5,P);m.air=smooth(0.06,0.28,P)*(1-smooth(0.44,0.52,P));m.airK=smooth(0.05,0.5,P);}
  else if(ZONE==='ice'){
    m.air=1-smooth(0.5,0.85,P);m.airK=1-0.6*smooth(0.5,0.9,P);
    m.portal=smooth(P_PORTAL-1.6,P_PORTAL-0.4,P);m.asm=smooth(P_PORTAL-1.0,P_PORTAL-0.04,P);m.ign=smooth(P_PORTAL+0.02,P_PORTAL+0.45,P);
    m.icecave=CAVE.cv===SYS.cave?ck:0;
    m.ice=smooth(0.55,0.95,P)*(1-m.portal)*(1-m.icecave);
  }else{
    m.ign=(1-smooth(P_CUT,P_CUT+0.5,P))*0.6;
    const sk=smooth(P_STATS-0.8,P_STATS-0.1,P);
    m.sandcave=CAVE.cv===SYS.sandCave?ck:0;
    m.fin=smooth(P_CUT,P_CUT+0.6,P)*(1-sk)*(1-m.sandcave);m.stats=sk*(1-m.sandcave);
  }
  // traversée du portail : un grondement, une fois, en avançant
  if(_audLastP<P_PORTAL+0.35&&P>=P_PORTAL+0.35&&P-_audLastP<0.5)audioBoom();
  _audLastP=P;
  return m;
}

/* ─────────── Image ─────────── */
const _iv=new THREE.Vector3(),_iv2=new THREE.Vector3(),_iv3=new THREE.Vector3(),_im=new THREE.Matrix4(),_ray=new THREE.Ray();
function projScreen(v){_iv.copy(v).project(camera);return {x:(_iv.x*0.5+0.5)*VW,y:(-_iv.y*0.5+0.5)*VH};}
function activeBlock(){const i=Math.round(SC.p)-1;return (i>=0&&i<SYS.blocks.length&&Math.abs(SC.p-(i+1))<0.5)?SYS.blocks[i]:null;}
const FX={fade:0,glitch:0};
const FLASH=new THREE.Color('#fff4e6');

let WARMING=false;const WARMING_SKIP_REFL=false;
/* ═══ 97 · La forêt (module RVF, intégré dans <script id="rvf-src">) ═══
   Chargé à l'approche du portail ; piloté image par image depuis frame(). Si le module échoue
   (WebGL, réseau three.js…), on retombe sur la scène de finance d'origine. */
const RVFH={st:0,dead:false};
const rvfCovered=()=>!!(window.RVF&&window.RVF.covers);
function rvfEnter(){const F=SYS.fins&&SYS.fins[Math.max(0,FINST.idx||0)];if(F)caveEnter(F.sj,'sand',F);}
function rvfDie(e){console.error('[RVF] module forêt indisponible, retour à la scène d\u2019origine',e);RVFH.dead=true;
  if(window.RVF)window.RVF.covers=false;const c=document.getElementById('rvf');if(c)c.style.display='none';}
function rvfLoad(){
  if(RVFH.st)return;RVFH.st=1;
  const url=new URL('./foret.js?v=6189f71776',import.meta.url).href;
  import(url).then(m=>m.init({canvas,P_FIN,P_STATS,enter:rvfEnter})).then(()=>{RVFH.st=2;}).catch(rvfDie);
}
function rvfFrame(dt,P){
  if(RVFH.dead||WARMING&&RVFH.st!==2)return;
  if(RVFH.st===0){if(P>=P_PORTAL-2||ZONE==='fin')rvfLoad();return;}
  if(RVFH.st!==2||!window.RVF||!window.RVF.tick)return;
  try{window.RVF.tick(dt,P,ZONE,CAVE.cv===SYS.sandCave?CAVE.k:0,WARMING);}catch(e){rvfDie(e);}
}

function frame(dt,draw=true){
  T+=dt;
  navTick(dt);
  U.uTime.value=Math.max(0,T)+10.0;
  finalPass.uniforms.uTime.value=T;
  if(WARMING){}else if(T<0){loaderTick(T);loaderEl.style.opacity='1';}
  else{const o=1-clamp01(T/0.8);loaderEl.style.opacity=String(o);loaderEl.style.pointerEvents='none';if(o<=0) loaderEl.style.display='none';}
  if(SC.locked&&T>INTRO_END-0.3&&!WARMING&&BG.done) SC.locked=false;
  if(SALLE_P&&started&&!SC.locked&&T>INTRO_END+1.4&&DATA&&SYS.ovl&&!CAVE.on&&CAVE.k<0.05&&Math.abs(SC.p-SALLE_P)<0.02){const sp=SALLE_P;SALLE_P=0;
    if(sp===P_FIN){const F=SYS.fins&&SYS.fins[0];if(F)caveEnter(F.sj,'sand',F);}else{const b=SYS.blocks&&SYS.blocks[sp-1];if(b)caveEnter(b.sj,'ice',b);}}
  scrollTick(dt,CAPTURE?SC.capNow:performance.now());
  pointer.sx+=(pointer.x-pointer.sx)*Math.min(1,dt*2.1);
  pointer.sy+=(pointer.y-pointer.sy)*Math.min(1,dt*2.1);
  const P=SC.p;
  todUpdate(dt);
  if(TOD.envDirty&&started){TOD.envDirty=false;buildEnv(TOD.ground);SYS.envDesert=ENV.tex;if(ZONE==='desert')scene.environment=ENV.tex;}
  applyZone(zoneOf(P));
  if(CAVE.cv&&CAVE.zone!==ZONE&&(CAVE.on||CAVE.k>0)){caveExit();CAVE.k=0;caveFrame(0);}
  // transitions : brouillard rouge (désert → glace), éclair blanc (traversée du portail)
  const fc=finalPass.uniforms.uFadeColor.value;
  if(P<0.5){FX.fade=smooth(0.40,0.5,P);FX.glitch=smooth(0.42,0.5,P)*0.6;fc.copy(SYS.clouds.CU.uLit.value).lerp(ICE_PAL.mid,smooth(0.44,0.5,P));}
  else if(P<1){FX.fade=1-smooth(0.5,0.72,P);FX.glitch=1-smooth(0.5,0.8,P);fc.copy(ICE_PAL.mid);}
  else if(P<P_CUT){FX.fade=smooth(P_PORTAL+0.36,P_CUT,P);FX.glitch=Math.max(smooth(P_PORTAL-0.12,P_PORTAL-0.04,P)*(1-smooth(P_PORTAL-0.02,P_PORTAL+0.06,P))*0.4,smooth(P_PORTAL+0.42,P_CUT,P)*0.5);fc.copy(FLASH);}
  else{FX.fade=1-smooth(P_CUT,P_CUT+0.3,P);FX.glitch=(1-smooth(P_CUT,P_CUT+0.25,P))*0.45;fc.copy(FLASH).lerp(FIN_PAL.fog,smooth(P_CUT+0.08,P_CUT+0.3,P));}
  if(NAV.veil>0){if(P>=1&&P<P_CUT)fc.copy(ICE_PAL.mid);if(!NAV.fcOn){NAV.fc.copy(fc);NAV.fcOn=true;}NAV.fc.lerp(fc,Math.min(1,dt*7));fc.copy(NAV.fc);}else NAV.fcOn=false;   // saut du rail : voile dans la couleur du lieu
  finalPass.uniforms.uFade.value=Math.max(FX.fade,NAV.veil);
  if(ZONE!=='desert'){fogBlur.enabled=false;godRay.enabled=false;flarePass.enabled=false;sanePass.uniforms.uRayCol.value.setRGB(0,0,0);}
  if(ZONE==='desert') frameDesert(dt,P); else if(ZONE==='ice') frameIce(dt,P); else frameFin(dt,P);
  rvfFrame(dt,P);
  if(!WARMING){
    if(!hudShown&&T>INTRO_END-2){hudShown=true;hudStart(T);}
    hudUpdate(T);
    audioUpdate(T,audioMix(P));
  }
  trailsFlush(dt);
  const inCaveR=!!(CAVE.cv&&CAVE.k>=0.5);renderPass.scene=inCaveR?CAVE.cv.scene:scene;
  if(!WARMING)perfSwitch(inCaveR?'cave':ZONE==='desert'?'desert':'scene');
  if(draw&&!rvfCovered()) composer.render(dt);
}

/* ombres du soleil : le cadre de la carte d'ombre suit ce que regarde la caméra (devant elle, au ras de l'eau),
   s'agrandit quand on prend de l'altitude, et se cale sur la grille des texels (pas de scintillement) */
const _sf=new THREE.Vector3(),_sx=new THREE.Vector3(),_sy=new THREE.Vector3(),_sc=new THREE.Vector3(),_Y=new THREE.Vector3(0,1,0);
function fitSunShadow(P){
  const R=lerp(64,150,smooth(0.02,0.32,P));
  camera.getWorldDirection(_sf);_sf.y=0;if(_sf.lengthSq()<1e-6)_sf.set(0,0,-1);_sf.normalize();
  _sc.copy(camera.position).addScaledVector(_sf,R*0.8);_sc.y=JF.water+4;
  const L=TOD.cur.sunDir;_sx.crossVectors(_Y,L);if(_sx.lengthSq()<1e-6)_sx.set(1,0,0);_sx.normalize();_sy.crossVectors(L,_sx);
  const tx=2*R/sun.shadow.mapSize.x,a=_sc.dot(_sx),b=_sc.dot(_sy);
  _sc.addScaledVector(_sx,Math.round(a/tx)*tx-a).addScaledVector(_sy,Math.round(b/tx)*tx-b);
  sun.target.position.copy(_sc);sun.target.updateMatrixWorld();
  sun.position.copy(L).multiplyScalar(200).add(_sc);
  const c=sun.shadow.camera;if(c.right!==R){c.left=-R;c.right=R;c.top=R;c.bottom=-R;c.near=5;c.far=520;c.updateProjectionMatrix();}
  // l'eau lit la carte d'ombre elle-même (reflets du soleil éteints sous les arbres)
  sun.updateMatrixWorld();sun.shadow.updateMatrices(sun);
  if(REFL.mU){const m=REFL.mU;m.uShadowW.value=sun.shadow.map?sun.shadow.map.texture:null;m.uShOn.value=sun.shadow.map?1:0;m.uShadowWM.value.copy(sun.shadow.matrix);m.uSunK.value=TOD.cur.sunI;}
}
function frameDesert(dt,P){
  const pose=introAt(Math.max(0,T),SYS);
  const live=T>INTRO_END-0.6&&P<0.03;
  const pk=clamp01((T-(INTRO_END-1.5))/2);
  // au bord de l'eau, entre les feuilles : la souris ne fait que tourner un peu la tête
  pose.th+=(pointer.sx*0.012+Math.sin(T*0.13)*0.004)*pk;
  pose.ph+=(pointer.sy*0.008+Math.sin(T*0.17)*0.002)*pk;
  /* on quitte le désert : la caméra s'élève haut et loin (vue de drone sur les dunes, l'oasis,
     les caravanes), la brume s'éclaircit pour qu'on profite des alentours, puis une mer de nuages
     se forme sous elle et engloutit la pyramide avant l'arrivée dans la glace */
  const kA=easeInOut(smooth(0,0.3,P)),kB=easeInOut(smooth(0.24,0.5,P));
  pose.r=lerp(lerp(pose.r,235,kA),345,kB);pose.ph=lerp(lerp(pose.ph,0.55,kA),0.8,kB);
  pose.th+=0.45*kA+0.22*kB;pose.ty+=6*kA;
  /* format portrait (téléphone) : en vol, on recule (tout reste dans le cadre) ; mais au plan
     d'accueil la caméra reste sur la berge — reculer la ferait entrer dans la forêt et passer sous
     l'eau. On élargit plutôt l'objectif pour que la pagode tienne en largeur. */
  const kP=camK(),heroW=smooth(INTRO_END-5,INTRO_END-0.5,T)*(1-smooth(0.3,0.9,kA));   // reste « comme sur ordinateur » tant qu'on n'est pas monté au-dessus de la forêt
  {const y0=pose.ty+Math.sin(pose.ph)*pose.r;
   pose.r*=lerp(Math.pow(kP,1.25),1,heroW);
   if(heroW>0){const ph2=Math.asin(Math.max(-0.99,Math.min(0.99,(y0-pose.ty)/pose.r)));pose.ph=lerp(pose.ph,ph2,heroW);}}
  const fovP=Math.min(46,Math.max(30,2*Math.atan(Math.tan(10.5*Math.PI/180)/(VW/VH))*180/Math.PI));
  CAMR.fovAdd=7*kA-3*kB+heroW*(fovP-30);
  todDesertGlobals();
  const clear=smooth(0.02,0.2,P)*(1-smooth(0.32,0.46,P));
  U.uFogDensity.value=TOD.cur.fogD*(1-0.55*clear)*(1+2.2*smooth(0.4,0.5,P))/Math.pow(lerp(kP,1,heroW),1.1)*lerp(1,0.4,1-smooth(INTRO_END-3,INTRO_END+0.5,T));   // intro : air plus clair, on voit le décor se générer
  // poussière au ras du sol : s'efface quand on prend de l'altitude
  const dustK=1-smooth(0.04,0.2,P);
  if(T>INTRO_END){SYS.wind.streakU.uAlpha.value=dustK;SYS.wind.cloudU.uAlphaC.value=dustK;}
  SYS.wind.tick(dt,TOD.cur.windK);
  camRig(pose,dt,T);
  if(camera.position.y<JF.water+1.3){camera.position.y=JF.water+1.3;camera.updateMatrixWorld();}
  {PERF.fn=(PERF.fn||0)+1;const n=PLV().sh[1],up=n<=1||PERF.fn%n===0||!sun.shadow.map;
   if(up)fitSunShadow(P);
   if(n>1){sun.shadow.autoUpdate=false;sun.shadow.needsUpdate=up;}else if(!sun.shadow.autoUpdate)sun.shadow.autoUpdate=true;}
  SYS.clouds.update(smooth(0.25,0.47,P),camera);
  // faisceaux dans les trouées de la canopée : visibles à hauteur d'homme, effacés pendant la génération et l'envol
  const RT=rayTune(dt);SYS.beams.BU.uNight.value=RT.n;
  SYS.beams.update((TOD.cur.beams||0)*RT.k*smooth(INTRO_END-1.5,INTRO_END+1.5,T)*(1-smooth(0.04,0.14,P))*Math.min(1.6,TOD.cur.sunI/3.0),TOD.cur.sunDir,TOD.cur.sunCol);
  if(VIEW){camera.position.set(VIEW[0],VIEW[1],VIEW[2]);camTgt.set(VIEW[3],VIEW[4],VIEW[5]);camera.up.set(0,1,0);camera.lookAt(camTgt);}
  if(Q.has('follow')&&SYS.fauna.agents.length){const FK=Q.get('fk');let ag=SYS.fauna.agents.filter(a=>FK?a.kind===FK:a.script);if(!ag.length)ag=SYS.fauna.agents.slice(-1);let cx=0,cz=0;ag.forEach(a=>{cx+=a.pos.x;cz+=a.pos.y;});cx/=ag.length;cz/=ag.length;
    const F=+(Q.get('follow')||9);camTgt.set(cx,duneH(cx,cz)+0.3,cz);camera.position.set(cx+F*0.25,camTgt.y+F*0.38,cz+F);camera.up.set(0,1,0);camera.lookAt(camTgt);}
  let ray=null;
  if(pointer.inside&&live){raycaster.setFromCamera(new THREE.Vector2(pointer.x,pointer.y),camera);ray=raycaster.ray;}
  SYS.pyr.update(dt,T,ray,live);
  SYS.oasis.update(dt,T);
  SYS.fauna.update(dt,T,T>INTRO_END-1);
  const lifted=(live&&U.uHoverAmt.value>0.05)?SYS.pyr.topLifted(5):[];
  tagsUpdate(lifted,dt);
  if(lifted.length&&lifted[0].off>0.6) audioThud(T,Math.min(1,lifted[0].off));
  SYS.wind.streakU.uRes.value.set(VW*renderer.getPixelRatio(),VH*renderer.getPixelRatio());
  SYS.wind.streakU.uCen.value.set(camera.position.x*0.6,0,camera.position.z*0.6);
  finalPass.uniforms.uGlitch.value=FX.glitch*0.9;
  canvas.style.cursor='';
  // reflet du lagon (tant qu'on le voit) et brouillard flouté de la forêt
  const low=P<0.45;REFL.on=P<0.2;   // vu d'en haut, l'eau n'occupe plus qu'un coin de l'image : plus de reflet
  if(REFL.mU)REFL.mU.uReflK.value=1-smooth(0.1,0.19,P);
  if(REFL.on&&!WARMING_SKIP_REFL&&(PLV().refl[2]<=1||PERF.fn%PLV().refl[2]===0||!REFL.rt))reflRender();   // paliers bas : reflet recalculé une image sur deux
  fogBlur.enabled=low&&!(CAVE.cv&&CAVE.k>=0.5);
  // rayons de soleil (volumétriques) : plus forts face au soleil, au ras de l'eau
  {camera.getWorldDirection(_sf);const L=TOD.cur.sunDir,fd=_sf.dot(L);
   const k=(TOD.cur.rays||0)*RAYTUNE.k*(0.6+0.4*smooth(-0.2,0.6,fd))*(1-smooth(0.08,0.3,P))*(CAVE.cv&&CAVE.k>=0.5?0:1);
   godRay.enabled=k>0.01&&PLV().god[0]>0;godRay.light=sun;   // dernier palier seulement : plus de rayons volumétriques
   if(godRay.enabled){const u=godRay.m.uniforms;u.uSunDir.value.copy(L);u.uWY.value=JF.water;u.uMaxD.value=lerp(160,260,smooth(0.02,0.3,P));u.uSig.value=Math.max(0.0025,U.uFogDensity.value*1.3);
     {const c=TOD.cur.sunCol,lc=c.r*0.3+c.g*0.59+c.b*0.11;sanePass.uniforms.uRayCol.value.copy(c).lerp(_rayGray.setRGB(lc,lc,lc),0.5*RAYTUNE.n).multiplyScalar(k*TOD.cur.sunI*0.13);}
     // rayons radiaux quand le soleil est dans le champ (ou juste au bord)
     _sc.copy(L).multiplyScalar(2000).add(camera.position).project(camera);const sx=_sc.x*0.5+0.5,sy=_sc.y*0.5+0.5;
     const out=_sc.z>1?9:Math.max(0,Math.max(Math.abs(sx-0.5),Math.abs(sy-0.5))-0.5);
     u.uSunUV.value.set(sx,sy);u.uRad.value=(1-smooth(0.0,0.45,out))*smooth(-0.03,0.05,L.y)*(TOD.cur.flare||0);}
   else sanePass.uniforms.uRayCol.value.setRGB(0,0,0);}
  // reflets d'objectif : position du soleil à l'écran (même hors champ, jusqu'à un demi-écran au-delà du bord)
  {const L=TOD.cur.sunDir;_sc.copy(L).multiplyScalar(2000).add(camera.position).project(camera);
   const sx=_sc.x*0.5+0.5,sy=_sc.y*0.5+0.5,behind=_sc.z>1;
   const out=Math.max(0,Math.max(Math.abs(sx-0.5),Math.abs(sy-0.5))-0.5);
   const k=(TOD.cur.flare||0)*(behind?0:1)*(1-smooth(0.0,0.75,out))*smooth(-0.03,0.04,L.y)*(1-smooth(0.1,0.3,P))*(CAVE.cv&&CAVE.k>=0.5?0:1);
   flarePass.enabled=k>0.01;
   if(flarePass.enabled){const u=flarePass.m.uniforms;u.uSun.value.set(sx,sy);u.uK.value=k;u.uOff.value=1-smooth(0.0,0.35,out);
     u.uCol.value.copy(TOD.cur.sunCol).multiplyScalar(0.55*Math.min(1.4,TOD.cur.sunI/3.0));}}
  // la pagode reste nette, ce qui est derrière se fond dans la brume ; pendant l'intro (caméra lointaine),
  // la zone nette suit la distance de la caméra : la génération filaire et le décor restent nets
  {const io=1-smooth(INTRO_END-2.5,INTRO_END+0.5,T),dT=camera.position.length();
   const s0=96+60*smooth(0.05,0.3,P),e0=270+300*smooth(0.05,0.3,P);
   fogBlur.set({uStart:lerp(s0,Math.max(s0,dT+60),io),uEnd:lerp(e0,Math.max(e0,dT+420),io),uMax:3.0*renderer.getPixelRatio()*(1-smooth(0.3,0.45,P))*(1-0.6*io)});}
}

/* ─────────── Grottes aux livres (clic sur un bloc de glace / un objet de la finance) ─────────── */
const FROST=new THREE.Color('#fbe6c4'),_caveHaze=new THREE.Color('#6c4a2c'),SAND_FADE=new THREE.Color('#b98a60');
function caveEnter(sj,kind,src){
  if(CAVE.on||CAVE.k>0.05||!SYS.ovl)return;
  const cv=kind==='sand'?SYS.sandCave:SYS.cave;
  CAVE.on=true;CAVE.cv=cv;CAVE.kind=kind;CAVE.zone=kind==='sand'?'fin':'ice';CAVE.src=src;CAVE.sj=sj;CAVE.hov=-1;CAVE.panelHov=-1;
  cv.scene.environment=kind==='ice'?SYS.envIce:SYS.envFin;cv.scene.environmentIntensity=cv.envK;
  cv.setSubject(sj,DATA.subjects[sj.key]);
  SYS.ovl.open(sj,DATA,T,kind);
  const lis=[...document.querySelectorAll('#ovl .ovl-c li')];
  lis.forEach((li,i)=>{li.addEventListener('mouseenter',()=>{CAVE.panelHov=i;});li.addEventListener('mouseleave',()=>{if(CAVE.panelHov===i)CAVE.panelHov=-1;});});
  let h=document.getElementById('cave-hint');if(!h){h=document.createElement('p');h.id='cave-hint';h.textContent=(window.matchMedia&&matchMedia('(pointer:coarse)').matches)?'↓ Balaie vers le bas pour remonter':'↑ Molette vers le haut pour remonter';document.body.appendChild(h);}
  setTimeout(()=>{if(CAVE.on)h.classList.add('on');},1600);
  audioWhoosh(-1);
}
function caveExit(){
  if(!CAVE.on)return;CAVE.on=false;CAVE.hov=-1;caveTip(null);audioWhoosh(1);
  if(SYS.ovl.st.open)SYS.ovl.close();
  const h=document.getElementById('cave-hint');if(h)h.classList.remove('on');
}
function wallTip(txt){
  let el=document.getElementById('wall-tip');if(!el){el=document.createElement('div');el.id='wall-tip';document.body.appendChild(el);}
  if(!txt){el.classList.remove('on');return;}
  el.textContent=txt;el.style.transform='translate('+Math.round((pointer.x*0.5+0.5)*VW+16)+'px,'+Math.round((-pointer.y*0.5+0.5)*VH+18)+'px)';el.classList.add('on');
}
function caveTip(i,p){
  let el=document.getElementById('cave-tip');if(!el){el=document.createElement('div');el.id='cave-tip';document.body.appendChild(el);}
  if(i===null||i<0||!CAVE.cv){el.classList.remove('on');return;}
  const b=CAVE.cv.books[i],c=b.c||{};const m=Math.round((c.mastery||0)*100);
  const st=c.soon?'BIENTÔT DISPONIBLE':b.burst?'DÉROULÉ':(m>=BOOK_FREE*100?'LE SCEAU CÈDE…':'SCELLÉ · ENCORE '+(BOOK_FREE*100-m)+' %');
  el.innerHTML='<b>'+(c.name||'Cours')+'</b><span>'+String(m).padStart(3,'0')+' % · '+st+'</span>'+(c.url?'<i>[ Ouvrir le cours ]</i>':'');
  el.style.transform='translate('+Math.round(p.x+18)+'px,'+Math.round(p.y-20)+'px)';el.classList.add('on');
}
/* position de l'objet dans lequel on plonge (bloc de glace / sculpture de sable) */
function caveSrcPos(out){
  const s=CAVE.src;
  if(CAVE.kind==='ice'){const st=s.s||s.ice.st.s,f=s.free||0;out.set(lerp(st.cx,s.B.cx,f),lerp(st.cy,(s.B.y0+s.B.y1)/2,f),lerp(st.cz,s.B.cz,f));s.content.localToWorld(out);}
  else finObjCenter(s,out);
  return out;
}
/* commun aux deux grottes : plongée (fondu givré / sableux), caméra dans la grotte, réglages de
   rendu propres (rétablis à la sortie), survol des livres. Renvoie l'avancée de la plongée. */
function caveFrame(dt){
  const cv=CAVE.cv;if(!cv)return 0;
  CAVE.k=clamp01(CAVE.k+(CAVE.on?1:-1)*dt/2.2);
  const ck=CAVE.k,inCave=ck>=0.5;
  if(ck>0&&CAVE.src){
    if(!inCave){caveSrcPos(_iv3);const u=easeInOut(ck/0.5);camera.position.lerp(_iv3,u*0.9);camTgt.lerp(_iv3,u);camera.lookAt(camTgt);}
    else{
      const V=cv.view,u=easeOut((ck-0.5)/0.5);
      const por=VW/VH<0.9;   // portrait : livres centrés, panneau en bas
      _iv3.copy(V.top).lerp(V.pos,u);if(por){_iv3.x=0;_iv3.z+=3.5;_iv3.y+=0.6;}_iv3.x+=pointer.sx*0.35*u;_iv3.y+=pointer.sy*0.2*u;camera.position.copy(_iv3);
      _iv2.set(0,0.9,-1).lerp(V.tgt,u);if(por){_iv2.x=-0.4;_iv2.y-=0.5;}camTgt.copy(_iv2);
      camera.up.set(0,1,0);camera.lookAt(camTgt);
      const fv=lerp(30,40,u);if(Math.abs(camera.fov-fv)>1e-3){camera.fov=fv;camera.updateProjectionMatrix();}
    }
    camera.updateMatrixWorld();
  }else if(camera.fov!==30){camera.fov=30;camera.updateProjectionMatrix();}
  cv.update(dt,T,camera,inCave);
  if(inCave){
    if(!CAVE.saved)CAVE.saved={fc:U.uFogColor.value.clone(),fd:U.uFogDensity.value,fh:U.uFogHeight.value,fy:U.uFogY0.value,fs:U.uFogStart.value,fc2:U.uFogCeil.value,mk:U.uMistK.value,dust:U.uDust.value,ex:renderer.toneMappingExposure,bs:bloom.strength,bt:bloom.threshold,heat:finalPass.uniforms.uHeat.value};
    // brume froide et laiteuse (glace) / fumée chaude des torches (grès) : plus claire que les parois, elle les voile
    if(cv.kind==='ice'&&!cv.temple)U.uFogColor.value.copy(ICE_PAL.fog).lerp(cv.fog,0.7);else U.uFogColor.value.copy(cv.fog);
    U.uFogDensity.value=cv.fogD;U.uFogHeight.value=cv.fogH;U.uFogY0.value=0;U.uFogStart.value=cv.fogStart;U.uFogCeil.value=cv.fogCeil;U.uMistK.value=cv.mistK;U.uMistH.value=cv.mistH;U.uMistCol.value.copy(cv.mist);U.uDust.value=0.45;
    renderer.toneMappingExposure=cv.expo;bloom.strength=cv.bloom[0];bloom.threshold=cv.bloom[1];finalPass.uniforms.uHeat.value=0;
  }else if(CAVE.saved){const q=CAVE.saved;U.uFogColor.value.copy(q.fc);U.uFogDensity.value=q.fd;U.uFogHeight.value=q.fh;U.uFogY0.value=q.fy;U.uFogStart.value=q.fs;U.uFogCeil.value=q.fc2;U.uMistK.value=q.mk;U.uDust.value=q.dust;
    renderer.toneMappingExposure=q.ex;bloom.strength=q.bs;bloom.threshold=q.bt;finalPass.uniforms.uHeat.value=q.heat;CAVE.saved=null;}
  if(ck>0){const fz=ck<0.5?smooth(0.12,0.5,ck):1-smooth(0.5,0.82,ck);
    finalPass.uniforms.uFade.value=Math.max(finalPass.uniforms.uFade.value,fz);
    if(cv.temple)finalPass.uniforms.uFadeColor.value.copy(cv.fade);else if(cv.kind==='ice')finalPass.uniforms.uFadeColor.value.copy(ICE_PAL.glow).lerp(FROST,0.6);else finalPass.uniforms.uFadeColor.value.copy(SAND_FADE);}
  if(CAVE.on&&ck>0.9&&pointer.inside){raycaster.setFromCamera(new THREE.Vector2(pointer.x,pointer.y),camera);const h=cv.pick(raycaster.ray);
    CAVE.hov=h;if(h>=0){const b=cv.books[h];b.holder.getWorldPosition(_iv2);caveTip(h,projScreen(_iv2));}else caveTip(null);
    const lis=document.querySelectorAll('#ovl .ovl-c li');lis.forEach((li,i)=>li.classList.toggle('hl',i===h||i===CAVE.panelHov));
    if(!CAPTURE){canvas.style.cursor=h>=0&&cv.books[h].c&&cv.books[h].c.url?'pointer':'';}}
  else if(CAVE.hov>=0&&!CAVE.on){CAVE.hov=-1;caveTip(null);}
  document.getElementById('hud').classList.toggle('incave',ck>0.05);
  return ck;
}
const ICEST={hover:0,scanR:0,wasHov:false,lblIdx:-1,flowIdx:-1,vel:0,lastP:null,spin:0,flash:0};
const ICE_FREE=0.75;   // au-delà : la glace éclate à l'arrivée et l'objet reste libre
function frameIce(dt,P){
  const root=SYS.space.root;
  icePalApply(SYS.space.lights);scene.background.copy(ICE_PAL.mid);U.uFogColor.value.copy(ICE_PAL.fog);
  // caméra : descend d'un bloc à l'autre
  const cz0=17.5*camK();
  const PS=P_PORTAL-1;   // la caméra s'arrête devant le portail ; les pierres viennent à elle
  let camY=-(Math.min(P,PS)-1)*SPACING+2.0,camZ=cz0,par=1,orb=0;
  if(P>PS&&P<=P_PORTAL){const k=easeInOut(clamp01(P-PS));camZ=lerp(cz0*1.6,cz0,k);orb=(1-k)*0.32;}
  if(P>P_PORTAL){const k=clamp01((P-P_PORTAL)/0.6);camZ=lerp(cz0,-3.5,Math.pow(k,1.7));par=1-k;}
  camera.position.set(root.position.x+Math.sin(orb)*camZ+pointer.sx*0.7*par,root.position.y+camY+0.25*par+pointer.sy*0.35*par,root.position.z+Math.cos(orb)*camZ);
  if(orb>0)camTgt.set(root.position.x,root.position.y+camY-0.05*par,root.position.z-2.5);
  else camTgt.set(root.position.x,root.position.y+camY-0.05*par,root.position.z+camZ-20);
  // inertie façon igloo : la vitesse de défilement fait tourner et basculer les blocs, puis tout revient
  {const v=ICEST.lastP===null?0:(P-ICEST.lastP)/Math.max(dt,1e-3);ICEST.lastP=P;
   ICEST.vel+=(Math.max(-2.5,Math.min(2.5,v))-ICEST.vel)*Math.min(1,dt*3.5);
   ICEST.spin+=ICEST.vel*dt*1.9;ICEST.spin*=Math.exp(-dt*0.9);}
  camera.lookAt(camTgt);camera.rotateZ(-ICEST.vel*0.035*par);camera.updateMatrixWorld();

  /* caverne : on plonge dans le bloc (fondu givré), puis on descend de la voûte vers les livres */
  const ck=CAVE.cv===SYS.cave?caveFrame(dt):0;
  U.uFogDensity.value=CAVE.saved?U.uFogDensity.value:0.0085;

  const act=activeBlock();
  let glitchB=0;
  SYS.blocks.forEach(b=>{
    const o=P-(b.i+1);
    const vis=Math.abs(o)<1.05;
    b.pivot.visible=vis;
    if(!vis) return;
    // fonte : démarre quand le bloc arrive au centre, puis rejoint la maîtrise
    if(!b.started&&Math.abs(o)<0.35) b.started=true;
    // ≥ 75 % : la glace éclate dès l'arrivée (une seule fois), l'objet reste libre ensuite
    if(b.burst&&b.mT<ICE_FREE){b.burst=0;b.burstT=0;b.freeK=0;b.ice.mesh.visible=true;}
    if(!b.burst&&b.mT>=ICE_FREE&&b.m0>=ICE_FREE){b.burst=2;b.m=b.mT;b.freeK=1;}
    let tgt=b.started?b.mT:b.m0;
    if(b.mT>=ICE_FREE&&!b.burst){
      tgt=Math.min(b.m0,ICE_FREE-0.02);
      if(b.started&&Math.abs(o)<0.2){b.burstT=(b.burstT||0)+dt;
        if(b.burstT>0.55){const s0=b.s||b.ice.st.s;
          SYS.shatter.fire(_iv.set(s0.cx,s0.cy,s0.cz),_iv2.set(s0.hx,s0.hy,s0.hz),b.content);
          b.burst=1;b.m=b.mT;b.freeK=0;b.glitch=1;ICEST.flash=1;b.ice.mesh.visible=false;
          audioCrack(T,1);audioThud(T,1);audioShatter(T,1);if(!b.saved){b.saved=true;seenSave(b.sid,b.mT);}}}
    }
    if(b.burst){
      if(!b.s)b.s=b.ice.st.s;
      b.freeK=Math.min(1,(b.freeK||0)+dt/1.4);b.act=0;b.ice.mesh.visible=false;
    }else{
      const d=tgt-b.m;const st=Math.sign(d)*Math.min(Math.abs(d),dt*(0.05+0.55*Math.abs(d)));
      b.m+=st;b.act+=((Math.abs(st)/Math.max(dt,1e-4))-b.act)*Math.min(1,dt*3);
      if(b.started&&b.mT<ICE_FREE&&Math.abs(b.m-b.mT)<1e-3&&!b.saved){b.saved=true;seenSave(b.sid,b.mT);}
      b.s=b.ice.setMelt(b.m);
    }
    const s=b.s;
    const ph=phaseOf(b.m,b.m>0.0005);b.phase=ph;
    if(ph!==b.lastPhase){if(b.lastPhase>=0)b.glitch=1;b.lastPhase=ph;}
    b.glitch=Math.max(0,b.glitch-dt*1.6);glitchB=Math.max(glitchB,b.glitch*(1-Math.min(1,Math.abs(o)*3)));
    b.free=b.burst?easeInOut(b.freeK):smooth(0.86,1.0,b.m);
    // le bloc tourne en passant, comme chez igloo : il s'éloigne en arc en rapetissant un peu,
    // et prend l'élan du défilement (rotation, bascule) avant de revenir à sa pose
    const ao=Math.abs(o),sc=1-0.13*smooth(0.2,1.0,ao);
    b.pivot.scale.setScalar(sc);
    // pendant le trajet, le bloc accompagne un moment la caméra : le sortant et l'entrant se croisent à l'écran
    b.pivot.position.set(o*1.5,-b.i*SPACING+2+Math.sin(T*0.6+b.i)*0.05+o*ao*1.2-o*SPACING*0.55*(1-smooth(0.5,1.0,ao)),-ao*2.4);
    b.pivot.rotation.set(0.05-pointer.sy*0.07+Math.sin(T*0.17+b.i)*0.02-o*0.55-ICEST.vel*0.16,
      -0.38+Math.sin(T*0.13+b.i*1.7)*0.3+Math.sin(T*0.051)*0.12+pointer.sx*0.24+o*0.9+ICEST.spin*(0.6+0.15*b.i),
      0.085+Math.sin(T*0.13+b.i)*0.02+o*0.12+ICEST.vel*0.05);
    const imp=b.obj.update(dt,T,b.free);
    if(imp&&Math.abs(o)<0.5) audioThud(T,0.7);
    b.obj.wetU.uObjWet.value=b.burst?0.2:smooth(0.5,0.78,b.m)*(1-0.5*smooth(0.97,1,b.m));
    b.pivot.updateMatrixWorld(true);
    b.ice.updateCam(camera);
  });
  finalPass.uniforms.uGlitch.value=Math.max(FX.glitch*0.9,glitchB*0.35);
  // éclats de glace + éclair blanc bref à l'éclatement
  SYS.shatter.update(dt);
  if(ICEST.flash>0.001){ICEST.flash*=Math.exp(-dt*7);finalPass.uniforms.uFadeColor.value.lerp(FLASH,Math.min(1,ICEST.flash*3));finalPass.uniforms.uFade.value=Math.max(finalPass.uniforms.uFade.value,ICEST.flash*0.32);}

  /* portail : les segments s'assemblent en arrivant, la lèvre s'embrase quand on avance */
  const po=SYS.portal;const pv=P>P_PORTAL-1.75;po.group.visible=pv;
  if(pv){
    // assemblage long : de l'arrivée devant les pierres éparpillées jusqu'au portail complet
    const asm=smooth(P_PORTAL-1.0,P_PORTAL-0.04,P),ign=smooth(P_PORTAL+0.02,P_PORTAL+0.4,P);
    const al=1-smooth(P_PORTAL+0.05,P_PORTAL+0.45,P);   // vu légèrement de biais, puis aligné pour la traversée
    po.group.rotation.set((-0.12+Math.max(0,P_PORTAL-P)*0.1)*al-pointer.sy*0.05*al,(0.26+Math.sin(T*0.2)*0.04)*al+pointer.sx*0.08*al,Math.sin(T*0.25)*0.015);   // le torii reste droit
    po.update(dt,T,asm,Math.max(ign,0.06*asm*asm*(0.5+0.5*Math.sin(T*1.7))));
  }

  /* survol du bloc actif */
  let hov=false;
  const scanTarget=act?act.obj.scanU:null;
  if(act&&pointer.inside&&Math.abs(P-(act.i+1))<0.12&&ck<0.01){
    const s=act.s,f=act.free;
    const cy=lerp(s.cy,(act.B.y0+act.B.y1)/2,f),cx=lerp(s.cx,act.B.cx,f),cz=lerp(s.cz,act.B.cz,f);
    const hx=lerp(Math.max(s.hx,1.0),act.B.ax+0.1,f),hy=lerp(s.hy,act.B.H/2+0.1,f),hz=lerp(s.hz,act.B.az+0.3,f);
    raycaster.setFromCamera(new THREE.Vector2(pointer.x,pointer.y),camera);
    _im.copy(act.content.matrixWorld).invert();
    _ray.copy(raycaster.ray).applyMatrix4(_im);
    const o=_ray.origin.clone().sub(_iv2.set(cx,cy,cz)).divide(_iv.set(hx,hy,hz)),dd=_ray.direction.clone().divide(_iv.set(hx,hy,hz));
    const A=dd.dot(dd),Bq=2*o.dot(dd),C=o.dot(o)-1,disc=Bq*Bq-4*A*C;
    if(disc>0&&(-Bq-Math.sqrt(disc))>0){hov=true;
      const tz=(cz-_ray.origin.z)/_ray.direction.z;const hp=_ray.origin.clone().addScaledVector(_ray.direction,tz).applyMatrix4(act.content.matrixWorld);
      scanTarget.uHoverL.value.lerp(hp,ICEST.hover<0.05?1:Math.min(1,dt*8));
    }
  }
  ICEST.hover+=((hov?1:0)-ICEST.hover)*Math.min(1,dt*(hov?5:2.5));
  ICEST.scanR+=((hov?2.4:0)-ICEST.scanR)*Math.min(1,dt*(hov?1.6:3));
  SYS.blocks.forEach(b=>{const on=b===act;b.obj.scanU.uScanR.value=on?ICEST.scanR:0;b.obj.scanU.uScanA.value=on?ICEST.hover:0;});
  if(!CAPTURE) canvas.style.cursor=hov?'pointer':'';
  if(hov&&!ICEST.wasHov) SYS.lbl.rescramble(T,[0,1,5]);
  ICEST.wasHov=hov;ICEST.hov=hov;

  /* vent de sable et gouttes : suivent le bloc le plus proche */
  const ni=Math.max(0,Math.min(SYS.blocks.length-1,Math.round(P)-1)),nb=SYS.blocks[ni];
  const on=1-smooth(0.28,0.5,Math.abs(P-(ni+1)));
  const fu=SYS.flow.FU;
  if(nb.s){
    const s=nb.s,f=nb.free;
    const cy=lerp(s.cy,(nb.B.y0+nb.B.y1)/2,f);
    _iv.set(lerp(s.cx,nb.B.cx,f),cy,lerp(s.cz,nb.B.cz,f));nb.content.localToWorld(_iv);root.worldToLocal(_iv);
    if(ICEST.flowIdx!==ni){fu.uC.value.copy(_iv);ICEST.flowIdx=ni;}else fu.uC.value.lerp(_iv,Math.min(1,dt*4));
    const rr=Math.max(s.hx,s.hz);
    fu.uRad.value.set(lerp(rr*1.12,nb.B.ax*0.75+0.4,f),lerp(s.hy*1.08,nb.B.H*0.5+0.2,f),lerp(rr*1.12,nb.B.ax*0.75+0.4,f));
    fu.uAlpha.value=on;fu.uAlphaC.value=on;
    fu.uGust.value+=((ICEST.hover*0.6+Math.min(1,nb.act*4)*0.5)-fu.uGust.value)*Math.min(1,dt*2);
    fu.uRes.value.set(VW*renderer.getPixelRatio(),VH*renderer.getPixelRatio());
    const rate=0;   // l'ambre ne goutte pas (il se polit puis se fend)
    SYS.drips.update(dt,rate,(dr)=>{
      if(nb.m<0.7||rand()<0.45){const a=rand()*6.283,r=Math.sqrt(rand())*0.72;dr.loc.set(s.cx+Math.cos(a)*r*s.hx,s.cy-s.hy*0.97+0.05,s.cz+Math.sin(a)*r*s.hz);}
      else{nb.obj.dripW(_iv3);nb.content.worldToLocal(dr.loc.copy(_iv3));}
    },nb.content);
    if(rate>0.2&&rand()<dt*rate*1.5) audioDrip(T);
    if(nb.act>0.02&&rand()<dt*14*Math.min(1,nb.act*5)) audioCrack(T,Math.min(1,nb.act*5));
  }
  SYS.space.update(dt,T,camera);
  _iv.set(0,camY,0);root.localToWorld(_iv);SYS.space.bgU.uGlowDir.value.copy(_iv).sub(camera.position).normalize();

  /* étiquettes : suivent le bloc actif, changent de matière avec un glitch */
  const li=Math.max(0,Math.min(SYS.blocks.length-1,Math.round(P)-1)),lb=SYS.blocks[li];
  const lv=(1-smooth(0.16,0.36,Math.abs(P-(li+1))))*smooth(0.72,0.92,P);
  if(lv>0.01&&lb.s){
    if(ICEST.lblIdx!==li){ICEST.lblIdx=li;SYS.lbl.setSubject(lb.sj,T);SYS.lbl.show(T);}
    const s=lb.s,f=lb.free;
    const cy=lerp(s.cy,(lb.B.y0+lb.B.y1)/2,f),cx=lerp(s.cx,lb.B.cx,f),cz=lerp(s.cz,lb.B.cz,f);
    const hx=lerp(Math.max(s.hx,1.0),lb.B.ax+0.1,f),hy=lerp(s.hy,lb.B.H/2,f),hz=lerp(s.hz,lb.B.az+0.2,f);
    let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
    for(let i=0;i<8;i++){_iv2.set(cx+(i&1?1:-1)*hx*0.92,cy+(i&2?1:-1)*hy*0.95,cz+(i&4?1:-1)*hz*0.9);lb.content.localToWorld(_iv2);const p=projScreen(_iv2);x0=Math.min(x0,p.x);x1=Math.max(x1,p.x);y0=Math.min(y0,p.y);y1=Math.max(y1,p.y);}
    const anc=(iceP,k)=>{lb.content.localToWorld(_iv2.copy(iceP));lb.obj.anchorW(k,_iv3);_iv2.lerp(_iv3,f);return projScreen(_iv2);};
    const anchors={
      tl:anc(_iv.set(s.cx-s.hx*0.62,s.cy+s.hy*0.78,s.cz+s.hz*0.5),'tl'),
      tr:anc(_iv.set(s.cx+s.hx*0.86,s.cy+s.hy*0.52,s.cz+s.hz*0.2),'tr'),
      br:anc(_iv.set(s.cx+s.hx*0.5,s.cy-s.hy*0.5,s.cz+s.hz*0.65),'br'),
    };
    SYS.lbl.update(T,dt,{x0,y0,x1,y1},anchors,lb.m,lb.phase);
  }
  SYS.lbl.setVisible(lv*(1-smooth(0,0.12,ck)));
  SYS.idx.forEach((e,i)=>e.classList.toggle('on',P<SUBJECTS.length+0.5&&i===li));
  if(SYS.dev&&act&&ICEST.devIdx!==act.i){ICEST.devIdx=act.i;SYS.dev.set(act.mT*100,true);}
}

/* ─────────── Côté finance ─────────── */
const FINST={hover:0,lblIdx:-1,hov:false,wasHov:false,camT:new THREE.Vector3()};
function finObjCenter(F,out){out.copy(F.holder.position).add(new THREE.Vector3(0,F.obj.height*0.5*(F.k||1),0));return F.holder.parent.localToWorld(out);}
function frameFin(dt,P){
  const FN=SYS.fin,FC=SYS.fincaves.caves,LI=SYS.fins.length-1;   // LI : dernière matière (une seule en L1 : l'économie)
  const c0=finObjCenter(SYS.fins[0],new THREE.Vector3()),c1=finObjCenter(SYS.fins[SYS.fins.length-1],new THREE.Vector3());
  /* caméra : on descend du portail par l'oculus de la première grotte, on remonte, on survole
     le plateau jusqu'à l'oculus suivant, puis on sort vers le mur de glace */
  const view=(i)=>{const F=SYS.fins[i],c=finObjCenter(F,new THREE.Vector3());const rad=Math.min((2.6*F.obj.height*(F.k||1)+1.7)*camK(),FC[i].R-1.4);
    const az=-0.36+pointer.sx*0.09,el=0.1+pointer.sy*0.035;return {pos:new THREE.Vector3(c.x+Math.sin(az)*Math.cos(el)*rad,c.y+Math.sin(el)*rad,c.z+Math.cos(az)*Math.cos(el)*rad),tgt:c};};
  const topW=(i,dy)=>FC[i].top.clone().add(FIN_ORIGIN).add(new THREE.Vector3(0,dy,0));
  const inW=(i)=>{const V=view(i),c=V.tgt;const d=V.pos.clone().sub(c);d.y=0;d.normalize();return c.clone().addScaledVector(d,V.pos.distanceTo(c)+5.5).add(new THREE.Vector3(0,1.6,0));};   // devant l'entrée, un peu plus haut
  const cr=(pts,u)=>{const n=pts.length-1,sv=clamp01(u)*n,i=Math.min(n-1,Math.floor(sv)),t=sv-i;
    const p0=pts[Math.max(0,i-1)],p1=pts[i],p2=pts[i+1],p3=pts[Math.min(n,i+2)];
    const f=(a,b,c,d)=>0.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t);
    return new THREE.Vector3(f(p0.x,p1.x,p2.x,p3.x),f(p0.y,p1.y,p2.y,p3.y),f(p0.z,p1.z,p2.z,p3.z));};
  let tgt=new THREE.Vector3();const camP=new THREE.Vector3();
  if(P<P_FIN){
    const u=easeInOut(smooth(P_CUT,P_FIN,P)),V0=view(0);
    camP.copy(cr([topW(0,15).add(new THREE.Vector3(0,0,0.05)),topW(0,1.2).add(new THREE.Vector3(0,0,0.2)),inW(0),V0.pos],u));tgt.copy(c0);
  }else if(P<=P_STATS-1){
    const u=easeInOut(clamp01((P-P_FIN)/Math.max(1,FIN_SUBJECTS.length-1))),V0=view(0),V1=view(SYS.fins.length-1);
    const hi=Math.max(topW(0,0).y,topW(LI,0).y)+9;
    const mid0=topW(0,0).lerp(topW(LI,0),0.25);mid0.y=hi;const mid1=topW(0,0).lerp(topW(LI,0),0.75);mid1.y=hi;
    camP.copy(cr([V0.pos,inW(0),topW(0,2),mid0,mid1,topW(LI,2),inW(LI),V1.pos],u));
    tgt.copy(c0).lerp(c1,smooth(0.38,0.62,u));
  }else{
    // devant le mur : chaque panneau de face ; au-delà de P_STATS, on longe le mur d'un panneau à l'autre
    const D=SYS.wall.D,PR=SYS.wall.PR,asp=VW/VH,tn=Math.tan(Math.PI/12);
    // recul : l'écran occupe ~80 % de la largeur (ou ~70 % de la hauteur) — grand et lisible
    const dW=Math.max((PR.x1-PR.x0)/(2*tn*asp*(D.portrait?0.9:0.8)),(PR.y1-PR.y0)/(2*tn*(D.portrait?0.72:0.7)));
    const el=0.04+pointer.sy*0.014,az=-0.14+pointer.sx*0.036;
    const pw=(i)=>{const cw=SYS.walls[i].center.clone();FN.root.localToWorld(cw);return {c:cw,p:new THREE.Vector3(cw.x+Math.sin(az)*Math.cos(el)*dW,cw.y+Math.sin(el)*dW,cw.z+Math.cos(az)*Math.cos(el)*dW)};};
    if(P<=P_STATS){
      const u=easeInOut(clamp01(P-(P_STATS-1))),V1=view(SYS.fins.length-1),W0=pw(0);
      const up=topW(LI,7);up.lerp(W0.p,0.3);
      camP.copy(cr([V1.pos,inW(LI),topW(LI,2),up,W0.p],u));
      tgt.copy(c1).lerp(W0.c,smooth(0.3,0.7,u));
    }else{
      const q=clamp01((P-P_STATS)/2)*2,i0=Math.min(1,Math.floor(q)),t=easeInOut(q-i0),A=pw(i0),B=pw(i0+1),b=Math.sin(t*Math.PI);
      tgt.copy(A.c).lerp(B.c,t);camP.copy(A.p).lerp(B.p,t);
      const back=new THREE.Vector3(Math.sin(az),0,Math.cos(az));camP.addScaledVector(back,b*4.5);camP.y+=b*0.6;
    }
  }
  camera.position.copy(camP);
  camera.up.set(0,1,0);camera.lookAt(tgt);camera.updateMatrixWorld();
  camTgt.copy(tgt);
  // grotte aux torches (clic sur l'objet) : plongée dans la sculpture, puis la grotte
  const ck=CAVE.cv===SYS.sandCave?caveFrame(dt):0;
  // dans une grotte, le ciel n'éclaire plus : seuls l'oculus et l'objet donnent la lumière
  {let kin=0;FC.forEach(C=>{const cx=C.top.x+FIN_ORIGIN.x,cz=C.top.z+FIN_ORIGIN.z,ty=C.top.y+FIN_ORIGIN.y;
     const dh=Math.hypot(camP.x-cx,camP.z-cz);kin=Math.max(kin,(1-smooth(C.R*0.72,C.R*1.0,dh))*(1-smooth(ty-1.2,ty+1.0,camP.y)));});
   FN.hemi.intensity=FN.hemi.userData.baseI*(1-0.25*kin);FC.forEach(C=>{C.shaftU.uK.value=0.4+0.6*kin;});}   // pavillon ouvert : à peine plus sombre sous le toit
  FN.update(dt,T,camera,tgt);
  // plus de traînées de grains au sol : seulement des voiles de poussière très légers
  FN.wind.streaks.visible=false;FN.wind.cloudU.uAlphaC.value=0.16*(1-0.85*(1-smooth(0.15,0.6,Math.abs(P-P_FIN))));   // pas de voile de brume sous le toit du sanctuaireFN.wind.tick(dt*0.45);
  FN.portalHi.glowL.intensity=FN.portalHi.GU.uIgn.value*40;
  finalPass.uniforms.uGlitch.value=FX.glitch;

  // sculptures : se forment à l'arrivée, puis rejoignent la maîtrise
  let glitchB=0;
  const W=new THREE.Vector3(FIN_W.x,0,FIN_W.y);
  SYS.fins.forEach(F=>{
    const o=P-(P_FIN+F.i);
    const vis=Math.abs(o)<1.6||P<P_FIN;F.holder.visible=vis;if(!vis)return;
    if(!F.started&&Math.abs(o)<0.4) F.started=true;
    const tg=F.started?F.fT:F.f0;const d=tg-F.f;F.f+=Math.sign(d)*Math.min(Math.abs(d),dt*(0.04+0.5*Math.abs(d)));
    if(F.started&&Math.abs(F.f-F.fT)<1e-3&&!F.saved){F.saved=true;seenSave(F.sid,F.fT);}
    const f=F.f;
    // l'objet est toujours entier : la forme et la matière sont gérées par la grotte (cocon de sable)
    const cs=F.obj.wetU.uSolid.value>0.6;if(F.cs!==cs){F.cs=cs;F.obj.group.traverse(o=>{if(o.isMesh&&!o.isPoints)o.castShadow=cs;});}
    const hot=(F.i===FINST.idx)?FINST.hover:0;
    // plus aucun grain ne s'envole en continu : les grains ne servent qu'à la formation
    F.sf.SU.uShed.value=0;F.sf.SU.uHot.value=hot*0.15;F.sf.points.visible=F.obj.wetU.uSolid.value<0.999;
    const ph=phaseOf(f,f>0.0005);F.phase=ph;
    if(ph!==F.lastPhase){if(F.lastPhase>=0)F.glitch=1;F.lastPhase=ph;}
    F.glitch=Math.max(0,F.glitch-dt*1.6);glitchB=Math.max(glitchB,F.glitch*(1-Math.min(1,Math.abs(o)*3)));
    // lévitation, et rotation continue sur elle-même (le tourbillon de sable tourne autour)
    F.yaw=-0.3;F.spin.rotation.y=0.3;   // posée sur la table, vue de trois quarts (jamais par la tranche)
    const bob=F.plat.bob??1;F.holder.position.y=F.plat.top+(F.plat.lift??0.62)+Math.sin(T*0.7+F.i*2.0)*0.05*bob+(F.arrK||0)*0.9;
    F.holder.rotation.set(Math.sin(T*0.31+F.i)*0.03*bob,F.yaw,Math.sin(T*0.27)*0.025*bob);
    F.sf.SU.uW.value.copy(W).applyAxisAngle(new THREE.Vector3(0,1,0),-F.yaw);
    F.sf.SU.uLight.value.copy(FN.SUNV);
  });
  finalPass.uniforms.uGlitch.value=Math.max(FX.glitch,glitchB*0.35);

  SYS.fincaves.update(dt,T,camera,P);

  // survol : boîte de l'objet actif
  const ai=Math.round(P)-P_FIN;const act=(ai>=0&&ai<SYS.fins.length&&Math.abs(P-(P_FIN+ai))<0.15)?SYS.fins[ai]:null;
  FINST.idx=act?act.i:-1;
  let hov=false;
  if(act&&pointer.inside&&ck<0.01){
    raycaster.setFromCamera(new THREE.Vector2(pointer.x,pointer.y),camera);
    const bx=act.sf.box.clone().expandByScalar(0.2);act.obj.group.updateMatrixWorld(true);
    _im.copy(act.obj.group.matrixWorld).invert();_ray.copy(raycaster.ray).applyMatrix4(_im);
    hov=_ray.intersectsBox(bx);
  }
  FINST.hover+=((hov?1:0)-FINST.hover)*Math.min(1,dt*(hov?4:2));
  if(!CAPTURE&&!rvfCovered()) canvas.style.cursor=hov?'pointer':'';
  if(hov&&!FINST.wasHov) SYS.lbl.rescramble(T,[0,1,5]);
  FINST.wasHov=hov;FINST.hov=hov;

  // mur de glace : chaque écran s'allume à l'arrivée (graphiques qui se remplissent, chiffres qui défilent)
  SYS.walls.forEach((Wp,i)=>{const o=Math.abs(P-(P_STATS+i));
    if(!Wp.started&&o<0.4){Wp.started=true;Wp.t=0;}
    if(Wp.started)Wp.t+=dt;
    Wp.WU.uHot.value=Wp.started?Math.exp(-Wp.t*1.5):0;});
  SYS.wallui.update(P,dt,ck<0.02);
  document.getElementById('hud').classList.toggle('stats',P>P_STATS-0.5);

  // étiquettes
  const li=Math.max(0,Math.min(SYS.fins.length-1,Math.round(P)-P_FIN)),lf=SYS.fins[li];
  const lv=(1-smooth(0.16,0.36,Math.abs(P-(P_FIN+li))))*smooth(P_FIN-0.25,P_FIN-0.05,P);
  if(lv>0.01){
    if(FINST.lblIdx!==li){FINST.lblIdx=li;SYS.lbl.setSubject(lf.sj,T);SYS.lbl.show(T);}
    let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;const bb=lf.sf.box;
    // repères pris dans le repère du socle (sans la rotation propre) : les étiquettes ne tournent pas avec l'objet
    const og=lf.obj.group.position;lf.holder.updateMatrixWorld();
    for(let i=0;i<8;i++){_iv2.set(i&1?bb.max.x:bb.min.x,i&2?bb.max.y:bb.min.y,i&4?bb.max.z:bb.min.z).add(og);lf.holder.localToWorld(_iv2);const p=projScreen(_iv2);x0=Math.min(x0,p.x);x1=Math.max(x1,p.x);y0=Math.min(y0,p.y);y1=Math.max(y1,p.y);}
    const A=lf.obj.anchorsL;const an=k=>{lf.holder.localToWorld(_iv2.copy(A[k]).add(og));return projScreen(_iv2);};
    SYS.lbl.update(T,dt,{x0,y0,x1,y1},{tl:an('tl'),tr:an('tr'),br:an('br')},lf.f,lf.phase);
  }
  const wi=Math.max(0,Math.min(2,Math.round(P)-P_STATS)),oWi=Math.abs(P-(P_STATS+wi));
  const lvW=P>=P_STATS-1?1-smooth(0.16,0.36,oWi):0;
  if(lvW>0.01){const WLp=SYS.walls[wi];
    if(FINST.lblIdx!==99+wi){FINST.lblIdx=99+wi;const TT=DATA.totals;
      SYS.lbl.setSubject({kicker:'MUR_07 · '+(wi+1)+'/3',name:['STATISTIQUES','ACTIVITÉ','ANALYSE'][wi],s1:'MAÎTRISE',phaseKey:'RANG',phaseTxt:TT.rank.n,cTxt:'MISE À JOUR · '+fmtDate(Date.now()),cta:'CLIQUER UNE MATIÈRE',only:['tl']},T);SYS.lbl.show(T);}
    const D=WLp.D;const cn=(x,y)=>{_iv2.set(x,y,D.D/2);WLp.mesh.localToWorld(_iv2);return projScreen(_iv2);};
    const pts=[cn(-D.W/2,0),cn(D.W/2,0),cn(-D.W/2,D.H),cn(D.W/2,D.H)];
    const rect={x0:Math.min(...pts.map(p=>p.x)),x1:Math.max(...pts.map(p=>p.x)),y0:Math.min(...pts.map(p=>p.y)),y1:Math.max(...pts.map(p=>p.y))};
    rect.y0-=40;rect.x0+=rect.x1*0.0;
    SYS.lbl.update(T,dt,rect,{tl:cn(-D.W*0.45,D.H*0.93),tr:cn(D.W*0.46,D.H*0.9),br:cn(D.W*0.42,D.H*0.06)},DATA.totals.mastery*smooth(0.15,3.0,WLp.t||0),0);
  }
  SYS.lbl.setVisible(rvfCovered()?0:Math.max(lv,lvW)*(1-smooth(0,0.12,ck)));   // forêt affichée : aucune étiquette (les blocs d'ambre gardent les leurs)
  const ci=Math.round(P)-P_FIN;
  SYS.idx.forEach((e,i)=>e.classList.toggle('on',P>=P_FIN-0.3&&i===SUBJECTS.length+Math.min(ci,FIN_SUBJECTS.length)));
  SYS.car.forEach((e,i)=>e.classList.toggle('on',i===Math.min(ci,FIN_SUBJECTS.length)));
  if(SYS.dev&&act&&FINST.devIdx!==act.i){FINST.devIdx=act.i;SYS.dev.set(act.fT*100,true);}
}

/* clic sur un bloc ou une sculpture : la page de cours sera définie ensemble */
/* double-clic sur le panneau « L1 » de la pagode : ouvre / ferme le menu dev */
canvas.addEventListener('dblclick',e=>{
  if(ZONE!=='desert'||!SYS.pyr||!SYS.dev) return;
  raycaster.setFromCamera(new THREE.Vector2(e.clientX/VW*2-1,-(e.clientY/VH)*2+1),camera);
  if(SYS.pyr.pickCap(raycaster)){e.preventDefault();try{window.getSelection().removeAllRanges();}catch(_){}SYS.dev.toggle();}
});
canvas.addEventListener('click',()=>{
  if(!SYS.ovl) return;
  if(CAVE.on){if(CAVE.hov>=0&&CAVE.cv){const c=CAVE.cv.books[CAVE.hov].c;if(c&&c.url){if(CAVE.cv.open)CAVE.cv.open(CAVE.hov,()=>{window.location.href=c.url;});else window.location.href=c.url;}}return;}   // le rouleau se déroule, puis le cours s'ouvre
  if(CAVE.k>0.02)return;
  if(ZONE==='ice'&&ICEST.hov){const b=activeBlock();if(b)caveEnter(b.sj,'ice',b);}
  else if(ZONE==='fin'&&FINST.hov&&!rvfCovered()){const F=SYS.fins[FINST.idx];if(F)caveEnter(F.sj,'sand',F);}
});

/* si la carte graphique coupe le rendu : message, puis rechargement quand elle revient */
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();
  let m=document.getElementById('gllost');if(!m){m=document.createElement('div');m.id='gllost';m.textContent='Le rendu 3D a été interrompu par la carte graphique — reprise en cours…';document.body.appendChild(m);}
  setTimeout(()=>location.reload(),2500);},false);
canvas.addEventListener('webglcontextrestored',()=>location.reload(),false);
let last=performance.now();
/* Qualité adaptative : si la machine peine, on baisse la résolution interne */
const PERF={acc:0,n:0,level:0,el:null,ring:[],slow:0,fast:0,upT:0,downs:{},gpu:'',cls:'desert',lv:{desert:0,scene:0,cave:0},downsBy:{desert:{},scene:{},cave:{}}};
/* Paliers de qualité. 0 = qualité maximale (strictement le rendu d'origine). En descendant, on allège d'abord ce qui
   se voit le moins : anticrénelage, reflet du lagon (moins défini, recalculé une image sur deux), ombres (carte plus
   petite, une image sur deux), puis pas de calcul des rayons — les rayons de lumière restent jusqu'au dernier palier.
   Le reflet et les ombres comptent beaucoup : ils redessinent 2,8 millions de triangles par image en plus de la vue. */
const PERF_K=[1,0.92,0.84,0.76,0.68,0.6,0.52];   // définition (× définition de base)
const PERF_LV=[   // msaa : échantillons max · refl : [échelle, msaa, 1 image sur n] · sh : [échelle de la carte, 1 image sur n] · god : [pas, 1=½ 2=¼ définition] · beam : pas · fog : prises
  {msaa:4,refl:[1,2,1],sh:[1,1],god:[28,1],beam:12,fog:5},
  {msaa:4,refl:[1,2,1],sh:[1,1],god:[28,1],beam:12,fog:5},
  {msaa:2,refl:[0.85,2,1],sh:[0.667,1],god:[22,1],beam:10,fog:5},
  {msaa:2,refl:[0.75,0,2],sh:[0.667,2],god:[18,1],beam:8,fog:4},
  {msaa:0,refl:[0.67,0,2],sh:[0.5,2],god:[14,2],beam:8,fog:3},
  {msaa:0,refl:[0.6,0,2],sh:[0.5,2],god:[12,2],beam:6,fog:3},
  {msaa:0,refl:[0.5,0,3],sh:[0.34,3],god:[0,2],beam:6,fog:2},
];
const SHADOW_BASE=MOBILE?2048:3072;
const PLV=()=>PERF_LV[PERF.level]||PERF_LV[0];
function perfGpu(){if(PERF.gpu)return PERF.gpu;try{const gl=renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');if(ext)PERF.gpu=String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)).replace(/ANGLE \(|\)$/g,'').slice(0,60);}catch(e){}return PERF.gpu;}
/* résolution effective : base du type de scène × palier ; l'anticrénelage (MSAA) suit */
function perfSetPR(r){
  if(Math.abs(renderer.getPixelRatio()-r)>1e-3){renderer.setPixelRatio(r);composer.setPixelRatio(r);composer.setSize(VW,VH);}
  const smp=MOBILE?0:Math.min(r>=1.5?2:4,PLV().msaa);
  [composer.renderTarget1,composer.renderTarget2].forEach(t=>{if(t.samples!==smp){t.samples=smp;t.dispose();}});
  aaPass.enabled=MOBILE||smp===0;   // sans MSAA : l'anticrénelage FXAA prend le relais
}
function perfApply(lv,force){
  lv=Math.max(0,Math.min(PERF_K.length-1,lv));if(lv===PERF.level&&!force)return;
  if(lv>PERF.level&&!force)PERF.downs[lv]=(PERF.downs[lv]||0)+1;
  PERF.level=lv;PERF.lv[PERF.cls]=lv;
  perfSetPR(Math.max(lv>=5?0.55:0.75,dprFor(PERF.cls)*PERF_K[lv]));
  perfKnobs();
  // très bas : moins de poussière en suspension et de traînées (le reste du rendu est identique)
  const lite=lv>=4;[SYS.wind].forEach(w=>{if(!w)return;w.clouds.geometry.instanceCount=Math.ceil(w.clouds.geometry.attributes.aP.count*(lite?0.5:1));w.streaks.geometry.instanceCount=Math.ceil(w.streaks.geometry.attributes.aP.count*(lite?0.6:1));});
  PERF.ring.length=0;PERF.slow=PERF.fast=0;
}
/* leviers du palier courant : carte d'ombre, pas des rayons et des faisceaux, flou de la brume */
function perfKnobs(){
  const L=PLV();
  const s=Math.max(512,Math.round(SHADOW_BASE*L.sh[0]/256)*256);
  if(sun.shadow.mapSize.x!==s){sun.shadow.mapSize.set(s,s);if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null;}sun.shadow.needsUpdate=true;}
  if(SYS.beams&&SYS.beams.BU)SYS.beams.BU.uBS.value=Math.min(MOBILE?6:12,L.beam);
  godRay.m.uniforms.uSteps.value=Math.max(1,L.god[0]);
  fogBlur.set({uTaps:L.fog});
}
/* palier de départ selon la carte graphique, puis celui appris lors des visites précédentes sur cet appareil */
function perfInitial(){
  const g=(perfGpu()||'').toLowerCase();let lv=1;
  if(/swiftshader|llvmpipe|software|basic render|microsoft basic/.test(g))lv=5;
  else if(MOBILE)lv=/apple|adreno \(tm\) [78]\d\d|mali-g(7[1-9]|[89]\d|6[1-9]\d)|immortalis|xclipse/.test(g)?1:2;
  else if(/nvidia|geforce|rtx|gtx|quadro|radeon rx|radeon pro|arc\(tm\) a|apple m\d (pro|max|ultra)|apple m[3-9]/.test(g))lv=0;
  else if(/apple|iris|radeon\(tm\) [678]\d0m|radeon graphics|radeon\(tm\) graphics/.test(g))lv=1;
  else if(/intel/.test(g))lv=2;
  const r={desert:lv,scene:Math.max(0,lv-1),cave:Math.max(0,lv-1)};
  try{const m=JSON.parse(localStorage.getItem('rv_perf')||'null');if(m&&m.gpu===g&&m.lv)for(const k in r)if(m.lv[k]>=0&&m.lv[k]<PERF_K.length)r[k]=m.lv[k];}catch(e){}
  return r;
}
function perfSave(){try{localStorage.setItem('rv_perf',JSON.stringify({gpu:(perfGpu()||'').toLowerCase(),lv:PERF.lv}));}catch(e){}}
/* changement de type de scène (désert / glace-finance / grotte) : chacun garde son propre palier */
function perfSwitch(cls){
  if(cls===PERF.cls)return;
  PERF.cls=cls;PERF.downs=PERF.downsBy[cls];
  finalPass.uniforms.uSharp.value=cls==='cave'?0.4:cls==='scene'?0.26:0.15;
  finalPass.uniforms.uCA.value=cls==='cave'?0:cls==='scene'?0.0003:0.0005;   // pas de franges colorées dans les grottes
  finalPass.uniforms.uGrain.value=cls==='cave'?0.012:0.03;
  if(CAPTURE)return;
  perfApply(PERF.lv[cls],true);PERF.frames=0;PERF.acc=0;
}
if(Q.has('fps')){perfGpu();
  PERF.el=document.createElement('div');PERF.el.style.cssText='position:fixed;right:10px;top:10px;z-index:99;font:11px JetBrains Mono,monospace;color:#fff;background:rgba(0,0,0,.35);padding:3px 6px';document.body.appendChild(PERF.el);}
/* mesure par la médiane des intervalles (insensible aux à-coups isolés de compilation) ;
   baisse rapide si la machine peine, remontée prudente si elle a de la marge */
function perfTick(rawDt){
  if(rawDt>1.0||CAPTURE) return;            // onglet en arrière-plan, capture
  if(OPT.q!=='auto'&&OPT_Q[OPT.q]!==undefined){if(PERF.level!==OPT_Q[OPT.q])perfApply(OPT_Q[OPT.q],true);return;}   // qualité fixée dans le menu : plus d'ajustement automatique
  PERF.acc+=rawDt;PERF.n++;PERF.ring.push(rawDt);if(PERF.ring.length>90)PERF.ring.shift();
  PERF.frames=(PERF.frames||0)+1;const busy=WARMING||PERF.frames<20||!BG.done;   // pendant le second temps : les à-coups de construction ne comptent pas   // les toutes premières images compilent encore
  // urgence : plusieurs images très longues d'affilée (la carte graphique risque de couper des images)
  if(!busy&&rawDt>0.25){if(++PERF.slow>=3){perfApply(PERF.level+2);}}else PERF.slow=0;
  if(PERF.acc>=1.0){
    const s=PERF.ring.slice().sort((a,b)=>a-b),med=s[Math.floor(s.length*0.5)]||0.016;
    if(PERF.el){const I=renderer.info.render;PERF.el.textContent=(BG.ready?'chargement '+(BG.ready/1000).toFixed(1)+' s'+(BG.end?' · tout '+(BG.end/1000).toFixed(1)+' s':'')+' · textures '+TEXST.mode+(TEXST.fail?' ÉCHECS '+TEXST.fail:' ok')+' · ':'')+Math.round(1/med)+' img/s · qualité '+(PERF_K.length-PERF.level)+'/'+PERF_K.length+' · '+renderer.getPixelRatio().toFixed(2)+'× · '+ZONE+' · '+I.calls+' appels · '+Math.round(I.triangles/1000)+'k tri · '+perfGpu();}
    if(!busy&&PERF.ring.length>=8){
      if(med>1/45){perfApply(PERF.level+1);perfSave();}
      else if(med<1/56&&PERF.level>0){PERF.fast++;if(PERF.fast>=5&&performance.now()-PERF.upT>8000&&(PERF.downs[PERF.level]||0)<2){PERF.upT=performance.now();perfApply(PERF.level-1);perfSave();}}
      else PERF.fast=0;
    }
    PERF.acc=0;PERF.n=0;
  }
}
/* Cadence : un écran 120 ou 144 Hz demanderait 120-144 images/s, soit deux fois plus de travail à la carte graphique
   pour une différence à peine visible ici. On mesure la fréquence de l'écran et on dessine une image sur n (≈ 60 /s).
   Panneau plein écran ouvert (matière, profil, menu) : la scène floutée derrière tourne à ~20 images/s. */
const RAF={d:[],n:1,c:0,t:0};
function rafPace(now){
  const d=now-RAF.t;RAF.t=now;if(d>2&&d<60){RAF.d.push(d);if(RAF.d.length>40)RAF.d.shift();}
  if(RAF.d.length>=12&&(RAF.c&63)===0){const s=RAF.d.slice().sort((a,b)=>a-b),hz=1000/s[s.length>>1];RAF.n=Math.max(1,Math.floor(hz/60+0.25));}
  const calm=rvCalm(),n=calm?RAF.n*3:RAF.n;
  return {draw:(RAF.c++%n)===0,calm};
}
const rvCalm=()=>!!((SYS.ovl&&SYS.ovl.st&&SYS.ovl.st.open&&!CAVE.on)||(SYS.prof&&SYS.prof.st&&SYS.prof.st.open)||(typeof MENU!=='undefined'&&MENU.open));
function loop(now){
  requestAnimationFrame(loop);
  if(!started){last=now;loaderTick(now/1000);return;}
  if(document.hidden){last=now;return;}
  const pc=rafPace(now);if(!pc.draw)return;
  const raw=(now-last)/1000;last=now;
  const dt=Math.min(0.05,raw);
  if(PERF.el){renderer.info.autoReset=false;renderer.info.reset();}
  frame(dt);
  if(!pc.calm)perfTick(raw);else PERF.ring.length=0;   // le ralenti volontaire ne doit pas faire baisser la qualité
}

if(CAPTURE)window.SYSDBG={JF,THREE,SYS,renderer,scene,camera,composer,bloom,godRay,sanePass,TOD,sun,AUDIO,audioInit,audioUpdate,audioMix,audioToggle,audioBoom,audioShatter,audioSand,audioWhoosh,musicTick,MUS,PIECES};
window.RV={
  ev(s){return CAPTURE?eval(s):null;},   // tests (capture seulement)
  ready:boot(),
  capture:CAPTURE,
  step(dt){SC.capNow=(SC.capNow||0)+dt*1000;frame(dt);},
  sim(dt,n){for(let i=0;i<n;i++){SC.capNow=(SC.capNow||0)+dt*1000;frame(dt,false);}},
  setTime(t){T=t;},
  fauna(k,x,z,yaw,st){SYS.fauna.debugPlace(k,x,z,yaw,st);},caravan(s,d){SYS.fauna.spawnCaravan(s,d);},animal(k){SYS.fauna.startNow(k);},scene(n,q){return SYS.fauna.scene(n,q).map(a=>a.kind);},walkers(){SYS.fauna.spawnWalkers();},agents(){return SYS.fauna.agents.map(a=>({k:a.kind,st:a.state,sc:a.script,x:+a.pos.x.toFixed(2),z:+a.pos.y.toFixed(2),v:+a.v.toFixed(2),seg:a.seg,fl:+a.flee.toFixed(2)}));},
  info(){renderer.info.autoReset=false;renderer.info.reset();const t0=performance.now();SC.capNow=(SC.capNow||0)+16;frame(1/60);const gl=renderer.getContext();gl.finish();const t1=performance.now();const I=renderer.info;return {ms:Math.round(t1-t0),calls:I.render.calls,tris:I.render.triangles,progs:I.programs.length,geos:I.memory.geometries,tex:I.memory.textures,zone:ZONE};},
  proj(x,z){const v=new THREE.Vector3(x,duneH(x,z)+0.9,z);const d=v.distanceTo(camera.position);v.project(camera);return [+(v.x*0.5+0.5).toFixed(3),+(0.5-v.y*0.5).toFixed(3),Math.round(d),v.z<1];},
  wpos(){return SYS.fauna.walkers.map(W=>{const t=Math.min(1,Math.max(0,W.s/W.len));const x=W.A.x+(W.B.x-W.A.x)*t,z=W.A.y+(W.B.y-W.A.y)*t;return {r:W.route,n:W.mem.length,x:Math.round(x),z:Math.round(z),scr:RV.proj(x,z)};});},
  perfTest(dt,n){for(let i=0;i<(n||1);i++)perfTick(dt);return [PERF.level,+renderer.getPixelRatio().toFixed(3),PERF.fast,Math.round(performance.now()-PERF.upT),JSON.stringify(PERF.downs),PERF.ring.length];},
  dbg(){return {tod:TOD.name,u:TOD.u,fog:U.uFogColor.value.getHexString(),fogD:U.uFogDensity.value,expo:renderer.toneMappingExposure,sunI:sun.intensity,sunC:sun.color.getHexString(),hemiI:hemi.intensity,envI:scene.environmentIntensity,zone:ZONE,glow:U.uGlowCol.value.getHexString(),lum:U.uLum.value,q:PERF.level,pr:renderer.getPixelRatio()};},
  pointer(x,y,inside=true){pointer.x=x;pointer.y=y;pointer.inside=inside;const cc=document.getElementById('capcur');cc.style.left=((x*0.5+0.5)*VW)+'px';cc.style.top=((-y*0.5+0.5)*VH)+'px';cc.style.display=inside?'block':'none';},
  smoothPointer(x,y){pointer.sx=x;pointer.sy=y;},
  scrollTo(p,instant){SC.t=p;SC.last=(SC.capNow||0)-1e5;if(instant)SC.p=p;},
  hold(p){SC.t=SC.p=p;SC.last=Infinity;},
  view(x,y,z,tx,ty,tz){camera.position.set(x,y,z);camera.up.set(0,1,0);camera.lookAt(tx,ty,tz);camera.updateMatrixWorld();},
  render(){composer.render(0.016);},
  cave(i){const b=SYS.blocks[i||0];caveEnter(b.sj,'ice',b);return SYS.cave.books.slice(0,CAVE.n).map(b=>[b.c.name,+(b.c.mastery||0).toFixed(2),b.burst]);},
  sandCave(i){const F=SYS.fins[i||0];caveEnter(F.sj,'sand',F);return SYS.sandCave.books.slice(0,CAVE.n).map(b=>[b.c.name,+(b.c.mastery||0).toFixed(2),b.burst]);},
  caveOut(){caveExit();},
  openPanel(i){SYS.ovl.open(ALL_SUBJ[i],DATA,T);},closePanel(){SYS.ovl.close();},
  setMastery(i,v,instant){if(i<SYS.blocks.length){const b=SYS.blocks[i];b.mT=clamp01(v);b.started=true;if(instant)b.m=b.mT;}else{const F=SYS.fins[i-SYS.blocks.length];F.fT=clamp01(v);F.started=true;if(instant)F.f=F.fT;}},
};
window.RV_STATE=()=>({bg:BG.done,lite:BG.lite,T:+T.toFixed(2),zone:ZONE,locked:SC.locked,started,progs:renderer.info.programs?renderer.info.programs.length:-1,boot:window.RV_BOOT,dummies:(SYS.dummyL||[]).length,lights:(SYS.allLights||[]).length});   // état du chargement (tests)
if(!CAPTURE) requestAnimationFrame(loop);

