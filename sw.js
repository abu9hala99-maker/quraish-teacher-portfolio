const INJECT_SCRIPTS='<script src="/viewer-enhance.js?v=2"></script><script src="/cloud-sync.js?v=1"></script>';

self.addEventListener("install",()=>self.skipWaiting());

self.addEventListener("activate",e=>e.waitUntil((async()=>{
  for(const k of await caches.keys()) await caches.delete(k);
  await self.clients.claim();
})()));

self.addEventListener("fetch",e=>{
  const req=e.request;
  if(req.mode==="navigate"){
    e.respondWith((async()=>{
      try{
        const res=await fetch(req);
        const type=res.headers.get("content-type")||"";
        if(!type.includes("text/html")) return res;
        let html=await res.text();
        if(!html.includes("cloud-sync.js")){
          html=html.replace("</body>",INJECT_SCRIPTS+"</body>");
        }
        const headers=new Headers(res.headers);
        headers.delete("content-length");
        headers.delete("content-encoding");
        return new Response(html,{status:res.status,statusText:res.statusText,headers});
      }catch(err){
        return fetch(req);
      }
    })());
    return;
  }
  e.respondWith(fetch(req));
});