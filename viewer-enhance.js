(()=>{
  if(window.__portfolioViewerReady)return;
  window.__portfolioViewerReady=true;

  const css=`
  .pv-overlay{position:fixed;inset:0;background:rgba(8,24,21,.88);z-index:99999;display:none;align-items:stretch;justify-content:center;padding:env(safe-area-inset-top) 0 env(safe-area-inset-bottom)}
  .pv-overlay.show{display:flex}
  .pv-shell{width:min(1100px,100%);height:100%;background:#f6faf8;display:flex;flex-direction:column;overflow:hidden}
  .pv-head{display:flex;align-items:center;gap:10px;padding:12px 14px;background:#174b43;color:#fff;box-shadow:0 2px 10px #0002}
  .pv-title{font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}
  .pv-btn{border:1px solid #ffffff55;background:#ffffff18;color:#fff;border-radius:12px;padding:9px 12px;text-decoration:none;font:inherit}
  .pv-close{font-size:20px;min-width:44px}
  .pv-body{flex:1;min-height:0;display:grid;place-items:center;overflow:auto;background:#eaf1ee;padding:10px}
  .pv-body img{max-width:100%;max-height:100%;object-fit:contain;border-radius:10px;box-shadow:0 8px 28px #0002;background:#fff}
  .pv-body iframe{width:100%;height:100%;border:0;background:#fff;border-radius:10px}
  @media(max-width:650px){
    .pv-shell{width:100%;border-radius:0}
    .pv-head{padding:10px}
    .pv-btn{padding:8px 10px}
    .pv-body{padding:4px}
  }`;

  const st=document.createElement('style');
  st.id='portfolio-viewer-style';
  st.textContent=css;
  document.head.appendChild(st);

  const ov=document.createElement('div');
  ov.className='pv-overlay';
  ov.setAttribute('role','dialog');
  ov.setAttribute('aria-modal','true');
  ov.innerHTML=`<div class="pv-shell">
    <div class="pv-head">
      <button class="pv-btn pv-close" type="button" aria-label="إغلاق">✕</button>
      <div class="pv-title">معاينة المرفق</div>
      <a class="pv-btn pv-open" target="_blank" rel="noopener">فتح خارجي</a>
    </div>
    <div class="pv-body"></div>
  </div>`;
  document.body.appendChild(ov);

  const body=ov.querySelector('.pv-body');
  const title=ov.querySelector('.pv-title');
  const open=ov.querySelector('.pv-open');

  function close(){
    ov.classList.remove('show');
    body.innerHTML='';
    document.body.style.overflow='';
  }

  function show(url,name,kind){
    title.textContent=name||'معاينة المرفق';
    open.href=url;
    body.innerHTML='';
    if(kind==='image'){
      const img=document.createElement('img');
      img.src=url;
      img.alt=name||'';
      body.appendChild(img);
    }else{
      const frame=document.createElement('iframe');
      frame.src=url;
      frame.title=name||'معاينة ملف PDF';
      body.appendChild(frame);
    }
    ov.classList.add('show');
    document.body.style.overflow='hidden';
  }

  ov.querySelector('.pv-close').onclick=close;
  ov.addEventListener('click',e=>{if(e.target===ov)close()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&ov.classList.contains('show'))close()});

  document.addEventListener('click',e=>{
    const img=e.target.closest('.item img');
    if(img){
      const item=img.closest('.item');
      const a=item&&item.querySelector('.itemactions a');
      if(a){
        e.preventDefault();
        show(a.href,(item.querySelector('.name')||{}).textContent||'صورة','image');
      }
      return;
    }

    const a=e.target.closest('.itemactions a');
    if(!a)return;
    const item=a.closest('.item');
    if(!item)return;
    const name=((item.querySelector('.name')||{}).textContent||'').trim();
    const isImage=!!item.querySelector('img');
    const isPdf=/\.pdf$/i.test(name);

    if(isImage||isPdf){
      e.preventDefault();
      show(a.href,name,isImage?'image':'pdf');
    }
  },true);
})();