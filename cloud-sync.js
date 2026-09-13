(()=>{
  if(window.__quraishCloudSyncLoaded)return;
  window.__quraishCloudSyncLoaded=true;

  const API='https://aziritukszzixownhidj.supabase.co/functions/v1/portfolio-sync';
  const PASS_KEY='quraish-portfolio-sync-password';
  const DB='teacher-portfolio-db';
  const STORE='attachments';
  const N=16;

  let connected=false;
  let busy=false;
  let syncTimer=null;
  let pollTimer=null;
  let lastRemoteSig='';
  let lastLocalChange=0;

  const css=document.createElement('style');
  css.textContent=`
  .qcs-btn{position:fixed;left:14px;bottom:calc(14px + env(safe-area-inset-bottom));z-index:9995;border:0;border-radius:999px;padding:11px 15px;background:#173f39;color:#fff;font:700 13px Tahoma,"Segoe UI",Arial,sans-serif;box-shadow:0 8px 26px #0003;cursor:pointer}
  .qcs-btn.on{background:#18745f}.qcs-btn.busy{opacity:.75;pointer-events:none}
  .qcs-msg{position:fixed;left:50%;bottom:calc(68px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:9996;background:#17352f;color:white;border-radius:999px;padding:10px 15px;max-width:90vw;text-align:center;font:12px Tahoma,"Segoe UI",Arial,sans-serif;box-shadow:0 8px 24px #0003}
  `;
  document.head.appendChild(css);

  const btn=document.createElement('button');
  btn.type='button';
  btn.className='qcs-btn';
  btn.textContent='☁️ تفعيل المزامنة';
  document.body.appendChild(btn);

  function msg(t,ms=2600){
    document.querySelector('.qcs-msg')?.remove();
    const e=document.createElement('div');e.className='qcs-msg';e.textContent=t;document.body.appendChild(e);
    setTimeout(()=>e.remove(),ms);
  }
  function setBusy(v){
    busy=v;btn.classList.toggle('busy',v);
    if(v)btn.textContent='☁️ جارِ المزامنة...';
    else if(connected){btn.textContent='☁️ متصل ومتزامن';btn.classList.add('on')}
    else{btn.textContent='☁️ تفعيل المزامنة';btn.classList.remove('on')}
  }
  async function call(action,data={},password=localStorage.getItem(PASS_KEY)||''){
    const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,password,...data})});
    const j=await r.json().catch(()=>({}));
    if(!r.ok){const e=new Error(j.error||'sync_error');e.status=r.status;e.data=j;throw e}
    return j;
  }
  async function upload(sec,file,created,password=localStorage.getItem(PASS_KEY)||''){
    const fd=new FormData();
    fd.append('action','upload');fd.append('password',password);fd.append('section',String(sec));
    fd.append('created',String(created||Date.now()));fd.append('file',file,file.name);
    const r=await fetch(API,{method:'POST',body:fd});
    const j=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(j.error||'upload_error');
    return j.attachment;
  }
  function openDB(){
    return new Promise((resolve,reject)=>{
      const r=indexedDB.open(DB,1);
      r.onupgradeneeded=()=>{
        const db=r.result;
        if(!db.objectStoreNames.contains(STORE)){
          const st=db.createObjectStore(STORE,{keyPath:'id'});
          st.createIndex('sec','sec');st.createIndex('kind','kind');
        }
      };
      r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
    });
  }
  async function localAttachments(){
    try{
      const db=await openDB();
      return await new Promise((res,rej)=>{
        const r=db.transaction(STORE).objectStore(STORE).getAll();
        r.onsuccess=()=>res(r.result||[]);r.onerror=()=>rej(r.error);
      });
    }catch{return []}
  }
  async function replaceLocalAttachments(remote){
    const db=await openDB();
    const rows=[];
    for(const a of remote||[]){
      try{
        const rr=await fetch(a.url,{cache:'no-store'});
        if(!rr.ok)continue;
        const blob=await rr.blob();
        rows.push({
          id:'cloud-'+a.id,sec:Number(a.section),
          kind:(a.type||'').startsWith('image/')?'image':'file',
          name:a.name,type:a.type||blob.type||'application/octet-stream',
          size:Number(a.size||blob.size||0),created:Number(a.created||Date.now()),blob
        });
      }catch(e){console.warn('download attachment failed',a.name,e)}
    }
    await new Promise((res,rej)=>{
      const tx=db.transaction(STORE,'readwrite'),st=tx.objectStore(STORE);
      st.clear();rows.forEach(x=>st.put(x));
      tx.oncomplete=res;tx.onerror=()=>rej(tx.error);
    });
  }
  function textsLocal(){
    const o={};
    for(let i=0;i<N;i++)o[i]=localStorage.getItem('portfolio-text-'+i)||'';
    return o;
  }
  function evidenceLocal(){
    const o={};
    for(let i=0;i<N;i++){
      try{o[i]=JSON.parse(localStorage.getItem('evidence-'+i)||'[]')}catch{o[i]=[]}
    }
    return o;
  }
  function fingerprintLocal(a){
    return [String(a.sec),a.kind||((a.type||'').startsWith('image/')?'image':'file'),a.name,Number(a.size||0),Number(a.created||0)].join('|');
  }
  function fingerprintRemote(a){
    return [String(a.section),(a.type||'').startsWith('image/')?'image':'file',a.name,Number(a.size||0),Number(a.created||0)].join('|');
  }
  function remoteSig(state){
    const clean={
      texts:state.texts||{},
      works:state.works||{},
      attachments:(state.attachments||[]).map(a=>[a.id,a.section,a.name,a.type,Number(a.size||0),Number(a.created||0),a.sort_order||0])
    };
    return JSON.stringify(clean);
  }
  function remoteCount(state){
    let n=Object.keys(state.texts||{}).length;
    n+=Object.values(state.works||{}).reduce((s,a)=>s+(Array.isArray(a)?a.length:0),0);
    n+=(state.attachments||[]).length;
    return n;
  }
  async function seedCloud(password){
    await call('pushSnapshot',{texts:textsLocal(),works:evidenceLocal()},password);
    const local=await localAttachments();
    for(const a of local){
      try{
        const file=new File([a.blob],a.name,{type:a.type||a.blob?.type||'application/octet-stream'});
        await upload(a.sec,file,a.created,password);
      }catch(e){console.warn('seed upload failed',a.name,e)}
    }
  }
  async function applyRemote(state){
    for(let i=0;i<N;i++){
      const t=(state.texts||{})[i] ?? (state.texts||{})[String(i)] ?? '';
      localStorage.setItem('portfolio-text-'+i,t||'');
      const w=(state.works||{})[i] ?? (state.works||{})[String(i)] ?? [];
      localStorage.setItem('evidence-'+i,JSON.stringify(Array.isArray(w)?w:[]));
    }
    await replaceLocalAttachments(state.attachments||[]);
  }
  async function reconcileAttachments(remoteState){
    const local=await localAttachments();
    const remote=remoteState.attachments||[];
    const remoteMap=new Map(remote.map(a=>[fingerprintRemote(a),a]));
    const localMap=new Map(local.map(a=>[fingerprintLocal(a),a]));
    for(const a of local){
      const fp=fingerprintLocal(a);
      if(remoteMap.has(fp))continue;
      const file=new File([a.blob],a.name,{type:a.type||a.blob?.type||'application/octet-stream'});
      await upload(a.sec,file,a.created);
    }
    for(const a of remote){
      const fp=fingerprintRemote(a);
      if(localMap.has(fp))continue;
      await call('deleteAttachment',{id:a.id});
    }
  }
  async function pushLocal(){
    if(!connected||busy)return;
    setBusy(true);
    try{
      await call('pushSnapshot',{texts:textsLocal(),works:evidenceLocal()});
      let r=await call('pull');
      await reconcileAttachments(r.state||{});
      r=await call('pull');
      lastRemoteSig=remoteSig(r.state||{});
      msg('تمت مزامنة التعديلات ✅');
    }catch(e){console.error(e);msg('تعذر رفع التعديلات الآن. ستبقى محفوظة على هذا الجهاز.',4200)}
    finally{setBusy(false)}
  }
  function schedulePush(){
    if(!connected)return;
    lastLocalChange=Date.now();
    clearTimeout(syncTimer);
    syncTimer=setTimeout(pushLocal,1800);
  }
  async function pollRemote(){
    if(!connected||busy)return;
    try{
      const r=await call('pull');
      const sig=remoteSig(r.state||{});
      if(lastRemoteSig && sig!==lastRemoteSig && Date.now()-lastLocalChange>3500){
        setBusy(true);
        msg('وصل تحديث من جهاز آخر، جارِ تطبيقه...',3000);
        await applyRemote(r.state||{});
        lastRemoteSig=sig;
        setTimeout(()=>location.reload(),300);
        return;
      }
      lastRemoteSig=sig;
    }catch(e){console.warn('poll failed',e)}
  }
  async function connect(interactive=true){
    if(busy)return;
    setBusy(true);
    let password=localStorage.getItem(PASS_KEY)||'';
    if(!password&&interactive){
      password=prompt('أنشئ كلمة مزامنة لملف الإنجاز (4 أحرف أو أرقام على الأقل). استخدم الكلمة نفسها في الكمبيوتر والآيفون:')||'';
    }
    if(!password){setBusy(false);return}
    try{
      await call('setup',{},password);
      localStorage.setItem(PASS_KEY,password);
      let r=await call('pull',{},password);
      let state=r.state||{};
      if(remoteCount(state)===0){
        msg('يتم رفع النسخة الموجودة على هذا الجهاز إلى السحابة...',4500);
        await seedCloud(password);
        r=await call('pull',{},password);state=r.state||{};
      }else{
        msg('يتم تنزيل النسخة السحابية إلى هذا الجهاز...',4200);
        await applyRemote(state);
      }
      connected=true;
      lastRemoteSig=remoteSig(state);
      setBusy(false);
      msg('تم ربط الجهاز بالمزامنة السحابية ✅',3400);
      clearInterval(pollTimer);pollTimer=setInterval(pollRemote,20000);
      if(remoteCount(state)>0 && interactive)setTimeout(()=>location.reload(),500);
    }catch(e){
      console.error(e);connected=false;setBusy(false);
      if(e.status===401){
        localStorage.removeItem(PASS_KEY);
        msg('كلمة المزامنة غير صحيحة. اضغط زر المزامنة وحاول مرة أخرى.',5000);
      }else msg('تعذر الاتصال بالسحابة الآن. لم تُحذف أي بيانات من الجهاز.',5000);
    }
  }

  btn.onclick=async()=>{
    if(connected){await pollRemote();msg('تم فحص السحابة ✅')}
    else connect(true);
  };

  document.addEventListener('input',schedulePush,true);
  document.addEventListener('change',()=>setTimeout(schedulePush,1000),true);
  document.addEventListener('click',e=>{
    const t=e.target;
    if(t?.matches?.('[data-add-evidence],[data-del-e],[data-del-a],[data-save],[data-clear]'))setTimeout(schedulePush,1200);
  },true);

  const saved=localStorage.getItem(PASS_KEY);
  if(saved)setTimeout(()=>connect(false),800);
})();