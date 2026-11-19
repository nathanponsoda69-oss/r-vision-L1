/* ═══════════════════════════════════════════════════════════════════════════════
   R·Vision — portraits de profil (avatars) · fichier commun à l1.html, l2.html et bibliotheque.html
   ───────────────────────────────────────────────────────────────────────────────
   · 30 portraits tirés de chefs-d'œuvre du domaine public (Wikimedia Commons), recadrés en médaillon,
     dans avatars/<id>.webp (256 × 256). Le crédit de chaque œuvre est affiché dans la galerie.
   · On les obtient dans les coffres de la bibliothèque : palier Rare, mêlés aux six objets rares.
   · Clés (partagées et synchronisées comme le reste du profil) :
       rvision_<profil>_biblio  → .owned[id] = nombre d'exemplaires tirés (écrit par la bibliothèque)
       rvision_<profil>_avatar  → id du portrait porté (vide = l'initiale)
   · API : window.RVAV = { LIST, byId, url, owned, get, set, paint, img, openPicker, count }
   · Événement : window « rvision:avatar » {detail:{user,id}} à chaque changement (et depuis un autre onglet).
   ═══════════════════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
if(window.RVAV)return;
const VER='4';
const BASE=(()=>{try{return new URL('avatars/',document.currentScript&&document.currentScript.src||location.href).href;}catch(e){return 'avatars/';}})();

/* n : nom · d : légende (le ton des objets de la bibliothèque) · a : artiste · o : œuvre · y : date · k : apprenti | familier */
const LIST=[
/*LIST-BEGIN*/
{id:'av_etudiante',k:'apprenti',n:'L’Étudiante à lunettes',d:'Un crayon dans le chignon, un autre derrière l’oreille. Elle a toujours le bon article sous la main.',a:'Pixel art R·Vision',o:'portrait original',y:'2026'},
{id:'av_capuche',k:'apprenti',n:'L’Étudiant à capuche',d:'Casque sur les oreilles, capuche relevée : il a mis le monde en sourdine jusqu’aux partiels.',a:'Pixel art R·Vision',o:'portrait original',y:'2026'},
{id:'av_avocate',k:'apprenti',n:'L’Avocate',d:'Robe noire, rabat blanc. Elle plaide déjà dans sa tête pendant les TD.',a:'Pixel art R·Vision',o:'portrait original',y:'2026'},
{id:'av_juge',k:'apprenti',n:'Le Président de chambre',d:'Toque, hermine et robe rouge. Il a tout entendu, il n’a encore rien dit.',a:'Pixel art R·Vision',o:'portrait original',y:'2026'},
{id:'av_professeur',k:'apprenti',n:'Le Professeur',d:'Trente ans d’amphi, un nœud papillon, et cette question à laquelle personne n’a jamais su répondre.',a:'Pixel art R·Vision',o:'portrait original',y:'2026'},
{id:'av_punk',k:'apprenti',n:'Le Punk de l’amphi',d:'Crête verte au dernier rang, mais c’est lui qui a la meilleure note en droit des contrats.',a:'Pixel art R·Vision',o:'portrait original',y:'2026'},
{id:'av_aventurier',k:'apprenti',n:'L’Aventurier',d:'Chapeau cabossé, foulard rouge. Il fouille les archives comme d’autres les temples perdus.',a:'Pixel art R·Vision',o:'portrait original',y:'2026'},
{id:'av_detective',k:'apprenti',n:'Le Détective',d:'Casquette à double visière et pipe : il raisonne comme on rédige un cas pratique.',a:'Pixel art R·Vision',o:'portrait original',y:'2026'},
{id:'av_mage',k:'apprenti',n:'Le Vieux Mage',d:'Sa barbe a vu passer trois réformes du Code civil. Il les connaît toutes.',a:'Pixel art R·Vision',o:'portrait original',y:'2026'},
{id:'av_sorciere',k:'apprenti',n:'La Sorcière',d:'Elle transforme les fiches en souvenirs. C’est sa seule formule, et elle marche.',a:'Pixel art R·Vision',o:'portrait original',y:'2026'},
{id:'av_apprenti',k:'apprenti',n:'L’Apprenti sorcier',d:'Capuche trop grande et sourire trop large : il apprend vite, il casse parfois.',a:'Pixel art R·Vision',o:'portrait original',y:'2026'},
{id:'av_alchimiste',k:'apprenti',n:'L’Alchimiste',d:'Lunettes de laboratoire sur le front. Il cherchait l’or, il a trouvé la méthode.',a:'Pixel art R·Vision',o:'portrait original',y:'2026'},
{id:'av_astronome',k:'apprenti',n:'L’Astronome',d:'Une capuche pleine d’étoiles. Elle lit le ciel comme on lit une constellation de jurisprudence.',a:'Pixel art R·Vision',o:'portrait original',y:'2026'},
{id:'av_druidesse',k:'apprenti',n:'La Druidesse',d:'Couronne de feuilles et yeux verts : elle garde la forêt de la finance.',a:'Pixel art R·Vision',o:'portrait original',y:'2026'},
{id:'av_glacier',k:'apprenti',n:'La Gardienne du glacier',d:'Couronne de glace, regard givré. Elle garde la grotte bleue de la L2 et ne perd jamais son sang-froid.',a:'Pixel art R·Vision',o:'portrait original',y:'2026'},
{id:'av_samourai',k:'apprenti',n:'Le Samouraï',d:'Bandeau rouge, chignon haut : la discipline du temple japonais de la L1.',a:'Pixel art R·Vision',o:'portrait original',y:'2026'},
{id:'av_ninja',k:'apprenti',n:'La Kunoichi',d:'Personne ne l’a vue entrer à la bibliothèque. Personne ne l’a vue en sortir.',a:'Pixel art R·Vision',o:'portrait original',y:'2026'},
{id:'av_nomade',k:'apprenti',n:'Le Nomade des dunes',d:'Il a traversé le désert de la L2 avec un turban, une gourde et son plan en deux parties.',a:'Pixel art R·Vision',o:'portrait original',y:'2026'},
{id:'av_pharaon',k:'apprenti',n:'Le Pharaon',d:'Gardien de la pyramide. Il ne s’agenouille que devant la Constitution.',a:'Pixel art R·Vision',o:'portrait original',y:'2026'},
{id:'av_chevalier',k:'apprenti',n:'Le Chevalier',d:'Une armure, un panache rouge et un serment : ne jamais rendre une copie blanche.',a:'Pixel art R·Vision',o:'portrait original',y:'2026'},
{id:'av_pirate',k:'apprenti',n:'La Pirate',d:'Bandeau sur l’œil, trésor dans la tête. Elle aborde les sujets d’examen sans demander la permission.',a:'Pixel art R·Vision',o:'portrait original',y:'2026'},
{id:'av_elfe',k:'apprenti',n:'L’Elfe',d:'Oreilles pointues, mémoire millénaire : elle n’oublie jamais une date.',a:'Pixel art R·Vision',o:'portrait original',y:'2026'},
{id:'av_nain',k:'apprenti',n:'Le Nain forgeron',d:'Il forge ses arguments comme des lames : à chaud, et à coups de marteau.',a:'Pixel art R·Vision',o:'portrait original',y:'2026'},
{id:'av_vampire',k:'apprenti',n:'Le Vampire',d:'Il ne révise que la nuit. Le jour, il dort sur le Code.',a:'Pixel art R·Vision',o:'portrait original',y:'2026'},
{id:'av_golem',k:'apprenti',n:'Le Golem',d:'Pierre, mousse et yeux qui brillent. Lent à démarrer, impossible à arrêter.',a:'Pixel art R·Vision',o:'portrait original',y:'2026'},
{id:'av_diablotin',k:'apprenti',n:'Le Diablotin',d:'Échappé du donjon de lave. Il se fait l’avocat du diable, par vocation.',a:'Pixel art R·Vision',o:'portrait original',y:'2026'},
{id:'av_chat_fenetre',k:'familier',n:'Le Chat à la fenêtre',d:'La fête passe au loin, il reste à son poste. Discipline.',a:'Pixel art R·Vision',o:'portrait original',y:'2026'},
{id:'av_chat_sorcier',k:'familier',n:'Le Chat sorcier',d:'Il a volé le chapeau de la sorcière et ne compte pas le rendre.',a:'Pixel art R·Vision',o:'portrait original',y:'2026'},
{id:'av_hibou',k:'familier',n:'Le Harfang messager',d:'Une lettre scellée dans les serres : il ne livre que les bonnes nouvelles.',a:'Pixel art R·Vision',o:'portrait original',y:'2026'},
{id:'av_kitsune',k:'familier',n:'La Kitsune',d:'Renard blanc aux flammes bleues. On dit qu’une queue lui pousse à chaque partiel réussi.',a:'Pixel art R·Vision',o:'portrait original',y:'2026'},
{id:'av_greffier',k:'apprenti',n:'Le Greffier',d:'Une plume derrière l’oreille : il note tout, même ce que le professeur a dit trop vite.',a:'Pixel art R·Vision',o:'portrait original',y:'2026'},
{id:'av_majeure',k:'apprenti',n:'La Major de promo',d:'Toque carrée, gland doré, sourire franc. Le haut du classement, c’est chez elle.',a:'Pixel art R·Vision',o:'portrait original',y:'2026'},
{id:'av_bibliothecaire',k:'apprenti',n:'La Bibliothécaire',d:'Elle retrouve n’importe quel arrêt de la Cour de cassation en moins d’une minute. Et elle exige le silence.',a:'Pixel art R·Vision',o:'portrait original',y:'2026'},
{id:'av_notaire',k:'apprenti',n:'Le Notaire',d:'Moustache impeccable, lunettes d’or : rien ne se signe sans lui.',a:'Pixel art R·Vision',o:'portrait original',y:'2026'},
{id:'av_fiscaliste',k:'apprenti',n:'La Fiscaliste',d:'Lunettes d’or, chignon serré. Elle lit le Code général des impôts comme un roman. Une vocation.',a:'Pixel art R·Vision',o:'portrait original',y:'2026'},
{id:'av_epuise',k:'apprenti',n:'L’Étudiant épuisé',d:'Troisième café, quatrième chapitre. Les cernes sont la médaille du partiel.',a:'Pixel art R·Vision',o:'portrait original',y:'2026'},
{id:'av_escrimeur',k:'apprenti',n:'Le Maître d’armes',d:'Masque grillagé, lame levée : il pare les objections et touche au cœur de l’argument.',a:'Pixel art R·Vision',o:'portrait original',y:'2026'},
{id:'av_banquier',k:'apprenti',n:'Le Banquier',d:'Haut-de-forme et monocle : il calcule les intérêts composés de tête. Côté finance de la L1.',a:'Pixel art R·Vision',o:'portrait original',y:'2026'},
{id:'av_sherif',k:'apprenti',n:'Le Shérif',d:'Une étoile sur la poitrine : la loi, c’est lui, du moins jusqu’au contrôle de constitutionnalité.',a:'Pixel art R·Vision',o:'portrait original',y:'2026'},
{id:'av_viking',k:'apprenti',n:'La Viking',d:'Casque à cornes, tresses blondes. Elle aborde les partiels comme un raid.',a:'Pixel art R·Vision',o:'portrait original',y:'2026'},
{id:'av_astronaute',k:'apprenti',n:'L’Astronaute',d:'Elle révise en apesanteur : rien ne la fait redescendre.',a:'Pixel art R·Vision',o:'portrait original',y:'2026'},
{id:'av_roi',k:'apprenti',n:'Le Roi',d:'Une couronne et une barbe rousse. Il a lu Montesquieu et il n’a pas aimé.',a:'Pixel art R·Vision',o:'portrait original',y:'2026'},
{id:'av_reine',k:'apprenti',n:'La Reine',d:'Elle règne sur l’amphi depuis le premier rang.',a:'Pixel art R·Vision',o:'portrait original',y:'2026'},
{id:'av_fee',k:'apprenti',n:'La Fée',d:'Un coup de baguette, et le plan en deux parties apparaît. Elle ne le fait que pour les meilleurs.',a:'Pixel art R·Vision',o:'portrait original',y:'2026'},
{id:'av_moine',k:'apprenti',n:'Le Moine shaolin',d:'Dix mille heures de méditation : la concentration absolue pendant les quatre heures de l’examen.',a:'Pixel art R·Vision',o:'portrait original',y:'2026'},
{id:'av_ronin',k:'apprenti',n:'Le Rōnin au chapeau de paille',d:'Sans maître ni école, il apprend seul sur les routes du Japon. Et il apprend bien.',a:'Pixel art R·Vision',o:'portrait original',y:'2026'},
{id:'av_fantome',k:'apprenti',n:'Le Fantôme',d:'Il hante la bibliothèque depuis 1896. Il cherche encore la cote d’un livre.',a:'Pixel art R·Vision',o:'portrait original',y:'2026'},
{id:'av_momie',k:'apprenti',n:'La Momie',d:'Sortie de la pyramide de la L2, encore couverte de bandelettes. Elle a tout son temps.',a:'Pixel art R·Vision',o:'portrait original',y:'2026'},
{id:'av_creature',k:'apprenti',n:'La Créature',d:'Assemblée à partir de morceaux de fiches. Elle tient, et c’est tout ce qui compte.',a:'Pixel art R·Vision',o:'portrait original',y:'2026'},
{id:'av_gobelin',k:'apprenti',n:'Le Gobelin',d:'Grandes oreilles, dents pointues : il négocie chaque point du barème.',a:'Pixel art R·Vision',o:'portrait original',y:'2026'},
{id:'av_automate',k:'apprenti',n:'L’Automate',d:'Remonté chaque matin, il récite le Code civil sans jamais se tromper d’alinéa.',a:'Pixel art R·Vision',o:'portrait original',y:'2026'},
{id:'av_sirene',k:'apprenti',n:'La Sirène',d:'Son chant attire les marins ; ses fiches attirent toute la promo.',a:'Pixel art R·Vision',o:'portrait original',y:'2026'},
{id:'av_dragon',k:'familier',n:'Le Dragon',d:'Il garde son trésor de fiches dans une caverne. Il crache du feu sur ceux qui les empruntent sans rendre.',a:'Pixel art R·Vision',o:'portrait original',y:'2026'},
{id:'av_corbeau',k:'familier',n:'Le Corbeau',d:'Il tient en son bec un fromage, et cette fois il ne le lâchera pas : il a lu la fable.',a:'Pixel art R·Vision',o:'portrait original',y:'2026'},
{id:'av_panda_roux',k:'familier',n:'Le Panda roux',d:'Il dort seize heures par jour et révise les huit autres. L’équilibre parfait.',a:'Pixel art R·Vision',o:'portrait original',y:'2026'},
{id:'av_crapaud',k:'familier',n:'Le Crapaud couronné',d:'Un baiser et il redeviendrait prince. Il préfère rester crapaud et réviser tranquille.',a:'Pixel art R·Vision',o:'portrait original',y:'2026'},
{id:'av_loup',k:'familier',n:'Le Loup',d:'Il chasse en meute : groupes de travail du jeudi soir.',a:'Pixel art R·Vision',o:'portrait original',y:'2026'},
{id:'av_lapin_blanc',k:'familier',n:'Le Lapin en retard',d:'« En retard, en retard ! » Il consulte sa montre comme on consulte le calendrier des partiels.',a:'Pixel art R·Vision',o:'portrait original',y:'2026'},
{id:'av_raton',k:'familier',n:'Le Raton laveur',d:'Masque de bandit, mais il ne vole que des idées. Et il cite toujours ses sources.',a:'Pixel art R·Vision',o:'portrait original',y:'2026'},
{id:'av_axolotl',k:'familier',n:'L’Axolotl',d:'Il régénère tout ce qu’il perd. Comme une bonne révision.',a:'Pixel art R·Vision',o:'portrait original',y:'2026'}
/*LIST-END*/
];
const byId={};LIST.forEach((a,i)=>{a.i=i;byId[a.id]=a;});

const LS={get(k){try{return localStorage.getItem(k);}catch(e){return null;}},set(k,v){try{if(v==null||v==='')localStorage.removeItem(k);else localStorage.setItem(k,v);return true;}catch(e){return false;}}};
const cur=()=>LS.get('rvision_current_user')||'';
const url=id=>byId[id]?BASE+id+'.webp?v='+VER:'';
function owned(u){
  u=u==null?cur():u;const o=new Set();if(!u)return o;
  try{const b=JSON.parse(LS.get('rvision_'+u+'_biblio')||'null');if(b&&b.owned)for(const k in b.owned)if(byId[k]&&b.owned[k]>0)o.add(k);}catch(e){}
  return o;
}
function get(u){u=u==null?cur():u;if(!u)return '';const id=LS.get('rvision_'+u+'_avatar')||'';return byId[id]&&owned(u).has(id)?id:'';}
function set(u,id){u=u==null?cur():u;if(!u)return false;if(id&&(!byId[id]||!owned(u).has(id)))return false;
  LS.set('rvision_'+u+'_avatar',id||'');fire(u,id||'');return true;}
function fire(user,id){try{window.dispatchEvent(new CustomEvent('rvision:avatar',{detail:{user,id}}));}catch(e){}}
addEventListener('storage',e=>{const k=e.key||'';const m=/^rvision_(.+)_(avatar|biblio)$/.exec(k);if(m)fire(m[1],get(m[1]));});
addEventListener('rvision:synced',()=>fire(cur(),get(cur())));

const esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
/* remplit un rond (<i>) : portrait si le profil en porte un, sinon l'initiale */
function paint(el,u,fallback){
  if(!el)return;const id=get(u);
  if(id){el.classList.add('av');el.innerHTML='<img src="'+url(id)+'" alt="" decoding="async" draggable="false">';}
  else{el.classList.remove('av');el.textContent=fallback!=null?fallback:(u?String(u).charAt(0).toUpperCase():'?');}
}
/* image prête pour une toile (classement) ; cb appelé au chargement */
const IMG={};
function img(id,cb){if(!byId[id])return null;let o=IMG[id];
  if(!o){o=IMG[id]={im:new Image(),ok:false,cbs:[]};o.im.decoding='async';o.im.onload=()=>{o.ok=true;o.cbs.splice(0).forEach(f=>{try{f();}catch(e){}});};o.im.src=url(id);}
  if(o.ok)return o.im;if(cb)o.cbs.push(cb);return null;}

/* ─────────────── styles (ronds de la barre, liste des profils, galerie) ─────────────── */
function css(){
  if(document.getElementById('rvav-css'))return;const s=document.createElement('style');s.id='rvav-css';s.textContent=`
#prof i.av{overflow:hidden;width:24px;height:24px;margin:-2px 0;}
#prof i.av,.pm-u i.av{padding:0;border-radius:50%;background:#0c0a12!important;border-color:rgba(230,194,122,.85)!important;}
#prof i.av img,.pm-u i.av img{display:block;width:100%;height:100%;object-fit:cover;border-radius:50%;pointer-events:none;image-rendering:pixelated;}
#prof:hover i.av{box-shadow:0 0 0 2px rgba(230,194,122,.35);}
.pm-u i.pm-av{position:relative;cursor:zoom-in;border-radius:50%;transition:transform .25s,box-shadow .25s;}
.pm-u i.pm-av:hover,.pm-u i.pm-av:focus-visible{transform:scale(1.08);box-shadow:0 0 0 2px var(--pa,#ffc58a);outline:none;}
.pm-u i.pm-av::after{content:'✎';position:absolute;right:-5px;bottom:-5px;width:16px;height:16px;display:grid;place-items:center;border-radius:50%;
  background:var(--pa,#ffc58a);color:#1b120d;font:700 9px/1 system-ui,sans-serif;box-shadow:0 2px 6px rgba(0,0,0,.5);}
.pm-u i.pm-av:not(.av){border-radius:50%;}
#rvav{position:fixed;inset:0;z-index:90;display:grid;place-items:center;padding:16px;background:radial-gradient(120% 90% at 50% 45%,rgba(10,8,12,.35),rgba(6,5,8,.86));
  backdrop-filter:blur(8px) saturate(1.1);-webkit-backdrop-filter:blur(8px) saturate(1.1);opacity:0;pointer-events:none;transition:opacity .45s ease;
  font-family:var(--mono,"JetBrains Mono",ui-monospace,monospace);color:#f6f1ea;--pa:#e6c27a;--rare:#4f9eff;}
#rvav.on{opacity:1;pointer-events:auto;}
#rvav .av-box{position:relative;width:min(860px,100%);max-height:calc(100vh - 32px);display:flex;flex-direction:column;
  background:linear-gradient(180deg,rgba(20,16,22,.86),rgba(10,8,12,.94));border:1px solid rgba(255,255,255,.1);
  box-shadow:0 40px 120px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.06);transform:translateY(14px) scale(.985);transition:transform .7s cubic-bezier(.2,.8,.2,1);}
#rvav.on .av-box{transform:none;}
#rvav .av-c{position:absolute;width:16px;height:16px;border:0 solid var(--pa);opacity:.9;}
#rvav .av-c.tl{top:-1px;left:-1px;border-top-width:1px;border-left-width:1px;}#rvav .av-c.tr{top:-1px;right:-1px;border-top-width:1px;border-right-width:1px;}
#rvav .av-c.bl{bottom:-1px;left:-1px;border-bottom-width:1px;border-left-width:1px;}#rvav .av-c.br{bottom:-1px;right:-1px;border-bottom-width:1px;border-right-width:1px;}
#rvav .av-top{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:22px 28px 0;font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:rgba(246,241,234,.5);}
#rvav .av-top b{font-weight:500;color:var(--pa);}
#rvav .av-x{font:inherit;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:rgba(246,241,234,.55);background:none;border:0;cursor:pointer;padding:6px 0 6px 8px;}
#rvav .av-x:hover{color:#fff;}
#rvav .av-main{display:grid;grid-template-columns:276px 1fr;gap:28px;padding:18px 28px 24px;min-height:0;overflow:hidden;}
#rvav .av-pv{display:flex;flex-direction:column;align-items:center;text-align:center;min-width:0;}
#rvav .av-med{position:relative;width:216px;height:216px;border-radius:50%;margin:6px 0 18px;
  box-shadow:0 0 0 1px rgba(230,194,122,.95),0 0 0 7px rgba(14,11,16,.95),0 0 0 8px rgba(230,194,122,.4),0 24px 60px rgba(0,0,0,.65);}
#rvav .av-med img{width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;transition:filter .5s;image-rendering:pixelated;}
#rvav .av-med.lock img{filter:blur(9px) grayscale(1) brightness(.32);}
#rvav .av-med.lock::after{content:'';position:absolute;inset:0;margin:auto;width:34px;height:40px;opacity:.85;
  background:no-repeat center/contain url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 28' fill='none' stroke='%23e6c27a' stroke-width='1.6'%3E%3Crect x='3' y='12' width='18' height='14' rx='2'/%3E%3Cpath d='M7 12V8a5 5 0 0 1 10 0v4'/%3E%3Ccircle cx='12' cy='19' r='1.6' fill='%23e6c27a'/%3E%3C/svg%3E");}
#rvav .av-med .av-glint{position:absolute;inset:0;border-radius:50%;pointer-events:none;background:linear-gradient(115deg,transparent 35%,rgba(255,240,200,.22) 48%,transparent 60%);
  background-size:260% 100%;animation:avGlint 5.5s ease-in-out infinite;}
#rvav .av-chips{display:flex;gap:8px;justify-content:center;margin-bottom:10px;}
#rvav .av-chip{font-size:9px;letter-spacing:.18em;text-transform:uppercase;padding:4px 8px;border:1px solid currentColor;}
#rvav .av-chip.r{color:var(--rare);}#rvav .av-chip.o{color:var(--pa);}#rvav .av-chip.l{color:rgba(246,241,234,.45);}
#rvav .av-n{font-family:var(--serif,Cinzel,"Cormorant Garamond",Georgia,serif);font-size:21px;line-height:1.2;letter-spacing:.02em;margin:2px 0 8px;color:#fff;}
#rvav .av-d{font-size:11.5px;line-height:1.65;color:rgba(246,241,234,.72);max-width:32ch;margin:0 auto 10px;font-family:Georgia,"Times New Roman",serif;font-style:italic;}
#rvav .av-cr{font-size:9.5px;line-height:1.6;letter-spacing:.06em;color:rgba(246,241,234,.42);max-width:34ch;}
#rvav .av-btns{display:flex;flex-direction:column;gap:8px;width:100%;margin-top:16px;}
#rvav .av-b{position:relative;font:inherit;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#fff;background:transparent;border:1px solid rgba(255,255,255,.22);
  padding:11px 14px;cursor:pointer;transition:background .25s,color .25s,border-color .25s;}
#rvav .av-b.p{border-color:var(--pa);color:var(--pa);}
#rvav .av-b.p:hover:not(:disabled){background:var(--pa);color:#1b120d;}
#rvav .av-b:hover:not(:disabled){border-color:#fff;}
#rvav .av-b:disabled{opacity:.38;cursor:default;}
#rvav .av-gr{display:flex;flex-direction:column;min-height:0;}
#rvav .av-gh{display:flex;justify-content:space-between;align-items:baseline;gap:10px;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:rgba(246,241,234,.5);margin-bottom:10px;}
#rvav .av-gh b{color:#fff;font-size:15px;letter-spacing:.06em;font-variant-numeric:tabular-nums;}
#rvav .av-bar{height:2px;background:rgba(255,255,255,.1);margin-bottom:14px;}#rvav .av-bar i{display:block;height:100%;background:linear-gradient(90deg,var(--pa),#fff3c4);}
#rvav .av-tabs{display:flex;gap:16px;margin-bottom:12px;font-size:10px;letter-spacing:.16em;text-transform:uppercase;}
#rvav .av-tabs button{font:inherit;background:none;border:0;border-bottom:1px solid transparent;color:rgba(246,241,234,.45);padding:0 0 4px;cursor:pointer;}
#rvav .av-tabs button.on{color:#fff;border-color:var(--pa);}
#rvav .av-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(80px,1fr));gap:14px 12px;overflow-y:auto;padding:4px 6px 6px 4px;margin:0 -6px 0 -4px;
  scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.18) transparent;max-height:min(470px,calc(100vh - 220px));}
#rvav .av-t{position:relative;display:flex;flex-direction:column;align-items:center;gap:6px;background:none;border:0;padding:0;cursor:pointer;color:inherit;font:inherit;}
#rvav .av-t span{display:block;width:72px;height:72px;border-radius:50%;overflow:hidden;box-shadow:0 0 0 1px rgba(255,255,255,.18);transition:box-shadow .25s,transform .25s;background:#0c0a12;}
#rvav .av-t img{width:100%;height:100%;object-fit:cover;display:block;image-rendering:pixelated;}
#rvav .av-t.lock img{filter:blur(4px) grayscale(1) brightness(.3);}
#rvav .av-t em{font-style:normal;font-size:8.5px;letter-spacing:.06em;line-height:1.3;color:rgba(246,241,234,.6);text-align:center;max-width:84px;min-height:2.6em;}
#rvav .av-t.lock em{color:rgba(246,241,234,.28);}
#rvav .av-t:hover span{transform:translateY(-2px);box-shadow:0 0 0 1px rgba(230,194,122,.7);}
#rvav .av-t.sel span{box-shadow:0 0 0 2px var(--pa),0 0 18px rgba(230,194,122,.35);}
#rvav .av-t.worn::after{content:'';position:absolute;top:-1px;right:6px;width:10px;height:10px;border-radius:50%;background:var(--pa);box-shadow:0 0 0 2px #0d0a10;}
#rvav .av-t.new::before{content:'Nouveau';position:absolute;top:-6px;left:50%;transform:translateX(-50%);z-index:1;font-size:7.5px;letter-spacing:.14em;text-transform:uppercase;
  background:var(--rare);color:#fff;padding:2px 5px;}
#rvav .av-ft{padding:0 28px 18px;font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:rgba(246,241,234,.36);display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;}
#rvav .av-ft a{color:var(--pa);text-decoration:none;}#rvav .av-ft a:hover{text-decoration:underline;}
@keyframes avGlint{0%,55%{background-position:120% 0}85%,100%{background-position:-60% 0}}
@media (max-width:700px){#rvav .av-main{grid-template-columns:1fr;gap:16px;overflow-y:auto;}#rvav .av-med{width:144px;height:144px;}
  #rvav .av-grid{max-height:none;overflow:visible;grid-template-columns:repeat(auto-fill,minmax(66px,1fr));}#rvav .av-t span{width:54px;height:54px;}
  #rvav .av-btns{flex-direction:row;grid-column:1/-1;margin-top:12px;}
  #rvav .av-pv{display:grid;grid-template-columns:118px 1fr;column-gap:16px;text-align:left;align-items:start;}
  #rvav .av-med{width:108px;height:108px;margin:6px 0 0 4px;grid-row:1/span 4;}#rvav .av-chips{justify-content:flex-start;margin-bottom:6px;}
  #rvav .av-n{font-size:17px;margin:0 0 4px;}#rvav .av-d{margin:0 0 6px;font-size:11px;max-width:none;}#rvav .av-cr{max-width:none;}
  #rvav .av-top{font-size:9px;letter-spacing:.12em;}#rvav .av-top .av-lbl{display:none;}#rvav .av-btns .av-b{flex:1;padding:10px 8px;font-size:10px;}#rvav .av-top{padding:18px 18px 0;}#rvav .av-main{padding:14px 18px 18px;}#rvav .av-ft{padding:0 18px 14px;}}
@media (prefers-reduced-motion:reduce){#rvav .av-med .av-glint{animation:none;}}`;
  (document.head||document.documentElement).appendChild(s);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',css);else css();

/* ─────────────── galerie (fenêtre ouverte par un clic sur le portrait du profil actif) ─────────────── */
const PK={el:null,u:'',sel:'',tab:'all',seen:null};
function seenKey(u){return 'rvision_'+u+'_avatar_seen';}
function openPicker(u,opts){
  u=u==null?cur():u;css();
  if(!PK.el){
    const m=document.createElement('div');m.id='rvav';m.setAttribute('role','dialog');m.setAttribute('aria-modal','true');m.setAttribute('aria-hidden','true');m.setAttribute('aria-label','Galerie des portraits');
    m.innerHTML=`<div class="av-box"><i class="av-c tl"></i><i class="av-c tr"></i><i class="av-c bl"></i><i class="av-c br"></i>
      <div class="av-top"><span>02 — <span class="av-lbl">Galerie des </span>portraits · <b class="av-who"></b></span><button type="button" class="av-x">[ Fermer ]</button></div>
      <div class="av-main"><div class="av-pv"></div><div class="av-gr"><div class="av-gh"><span>Collection</span><b class="av-cnt"></b></div><div class="av-bar"><i></i></div>
        <div class="av-tabs" role="tablist"><button type="button" data-t="all">Tous</button><button type="button" data-t="own">Obtenus</button><button type="button" data-t="lock">À trouver</button></div>
        <div class="av-grid"></div></div></div>
      <div class="av-ft"><span>Pixel art original R·Vision</span><a href="bibliotheque.html">Ouvrir un coffre →</a></div></div>`;
    document.body.appendChild(m);PK.el=m;
    m.querySelector('.av-x').addEventListener('click',close);
    m.addEventListener('click',e=>{if(e.target===m)close();});
    m.querySelectorAll('.av-tabs button').forEach(b=>b.addEventListener('click',()=>{PK.tab=b.dataset.t;render();}));
    addEventListener('keydown',e=>{if(!PK.el||!PK.el.classList.contains('on'))return;
      if(e.key==='Escape'){e.stopImmediatePropagation();close();}
      else if(e.key==='ArrowRight'||e.key==='ArrowLeft'){const L=vis(),i=L.indexOf(PK.sel),n=L[(i+(e.key==='ArrowRight'?1:-1)+L.length)%L.length];if(n){PK.sel=n;render();}}},true);
    addEventListener('rvision:avatar',()=>{if(PK.el.classList.contains('on'))render();});
  }
  PK.u=u;PK.tab='all';PK.opts=opts||{};
  try{PK.seen=new Set(JSON.parse(LS.get(seenKey(u))||'[]'));}catch(e){PK.seen=new Set();}
  const ow=owned(u),w=get(u);PK.sel=w||[...ow][0]||LIST[0].id;
  render();PK.el.classList.add('on');PK.el.setAttribute('aria-hidden','false');
  setTimeout(()=>{try{const t=PK.el.querySelector('.av-t.sel');t.focus({preventScroll:true});if(!matchMedia('(max-width:700px)').matches)t.scrollIntoView({block:'nearest'});PK.el.querySelector('.av-main').scrollTop=0;}catch(e){}},80);
  LS.set(seenKey(u),JSON.stringify([...ow]));   // les « Nouveau » s'effacent à la visite suivante
}
function close(){if(!PK.el)return;PK.el.classList.remove('on');PK.el.setAttribute('aria-hidden','true');if(PK.opts&&PK.opts.onClose)try{PK.opts.onClose();}catch(e){}}
function vis(){const ow=owned(PK.u);return LIST.filter(a=>PK.tab==='all'||(PK.tab==='own')===ow.has(a.id)).map(a=>a.id);}
function render(){
  const m=PK.el,u=PK.u,ow=owned(u),w=get(u),a=byId[PK.sel]||LIST[0],has=ow.has(a.id);
  m.querySelector('.av-who').textContent=u||'—';
  m.querySelector('.av-cnt').textContent=String(ow.size).padStart(2,'0')+' / '+LIST.length;
  m.querySelector('.av-bar i').style.width=(ow.size/LIST.length*100).toFixed(1)+'%';
  m.querySelectorAll('.av-tabs button').forEach(b=>b.classList.toggle('on',b.dataset.t===PK.tab));
  const pv=m.querySelector('.av-pv');
  pv.innerHTML=`<div class="av-med${has?'':' lock'}"><img src="${url(a.id)}" alt="">${has?'<i class="av-glint"></i>':''}</div>
    <div class="av-chips"><span class="av-chip r">Rare</span>${has?(a.id===w?'<span class="av-chip o">Porté</span>':'<span class="av-chip o">Obtenu</span>'):'<span class="av-chip l">À trouver</span>'}</div>
    <p class="av-n">${has?esc(a.n):'Portrait voilé'}</p>
    <p class="av-d">${has?esc(a.d):'Il dort au fond d’un coffre de la bibliothèque. Les quêtes donnent des orbes, les orbes ouvrent les coffres : les portraits sortent au palier Rare.'}</p>
    ${has?`<p class="av-cr">${esc(a.a)} — <i>${esc(a.o)}</i>, ${esc(a.y)}</p>`:''}
    <div class="av-btns"><button type="button" class="av-b p av-wear"${!has||a.id===w?' disabled':''}>${a.id===w?'Portrait porté':'Porter ce portrait'}</button>
      <button type="button" class="av-b av-none"${w?'':' disabled'}>Revenir à l’initiale</button></div>`;
  pv.querySelector('.av-wear').addEventListener('click',()=>{if(set(u,a.id))render();});
  pv.querySelector('.av-none').addEventListener('click',()=>{set(u,'');render();});
  const g=m.querySelector('.av-grid'),L=vis(),st=g.scrollTop;
  g.innerHTML=L.length?L.map(id=>{const x=byId[id],o=ow.has(id);
    return `<button type="button" class="av-t${o?'':' lock'}${id===PK.sel?' sel':''}${id===w?' worn':''}${o&&PK.seen&&!PK.seen.has(id)?' new':''}" data-id="${id}" aria-label="${o?esc(x.n):'Portrait à trouver'}"><span><img src="${url(id)}" alt="" loading="lazy" decoding="async"></span><em>${o?esc(x.n):'· · ·'}</em></button>`;}).join('')
    :`<p style="grid-column:1/-1;font-size:11px;color:rgba(246,241,234,.5);padding:20px 0">${PK.tab==='own'?'Aucun portrait pour l’instant : ils sortent des coffres de la bibliothèque.':'Collection complète — bravo.'}</p>`;
  g.querySelectorAll('.av-t').forEach(b=>{b.addEventListener('click',()=>{PK.sel=b.dataset.id;render();if(matchMedia('(max-width:700px)').matches)m.querySelector('.av-main').scrollTo({top:0,behavior:'smooth'});});
    b.addEventListener('dblclick',()=>{if(set(u,b.dataset.id))render();});});
  g.scrollTop=st;
}

window.RVAV={LIST,byId,url,owned,get,set,paint,img,openPicker,closePicker:close,count:()=>LIST.length,esc};
})();
