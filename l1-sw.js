/* R·Vision L1 — cache hors ligne (ne concerne que les fichiers du dossier l1/ ; les autres pages du dépôt n'y passent jamais).
   · Textures (l1/tex…?v=empreinte) : servies depuis le cache, sans réseau — une empreinte ne change jamais de contenu.
   · Code (l1/*.js) : réseau d'abord, cache en secours (hors ligne). Ainsi, un fichier de code remplacé sur GitHub
     est pris en compte même si l'on a oublié de changer son ?v= dans l1.html. */
const CACHE='rv-l1';
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>{
  const req=e.request;if(req.method!=='GET')return;
  const u=new URL(req.url),base=new URL('l1/',self.registration.scope);
  if(u.origin!==base.origin||!u.pathname.startsWith(base.pathname))return;
  const code=u.pathname.endsWith('.js');
  if(!code&&!/[?&]v=/.test(u.search))return;
  e.respondWith((async()=>{
    const c=await caches.open(CACHE);
    const keep=r=>{if(r&&r.ok&&r.status===200){const cp=r.clone();e.waitUntil((async()=>{await c.put(req,cp);
      for(const k of await c.keys()){const x=new URL(k.url);if(x.pathname===u.pathname&&x.search!==u.search)await c.delete(k);}})());}return r;};
    if(code){try{return keep(await fetch(req,{cache:'no-cache'}));}catch(err){const hit=await c.match(req,{ignoreSearch:true});if(hit)return hit;throw err;}}
    const hit=await c.match(req);if(hit)return hit;
    return keep(await fetch(req));})());
});
