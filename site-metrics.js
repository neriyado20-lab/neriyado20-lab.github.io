(() => {
  'use strict';
  if (location.hostname !== 'neriyado20-lab.github.io' || location.pathname.endsWith('site-stats.html')) return;
  if (navigator.globalPrivacyControl || navigator.doNotTrack === '1') return;
  const endpoint = 'https://sxbfjouuguniegwbevwy.supabase.co/rest/v1/rpc/record_site_metric';
  const key = 'sb_publishable_MqD3lXrftP5B36gcRjpDbw_csTVjpVK';
  const sessionKey = 'gal-einai-metrics-session-v1';
  let memorySession;
  function session() {
    let saved = memorySession;
    try { saved = JSON.parse(sessionStorage.getItem(sessionKey)) || saved; } catch {}
    const now = Date.now();
    if (!saved || now - saved.at > 30*60*1000) saved = {id:crypto.randomUUID(),at:now};
    saved.at=now; memorySession=saved;
    try { sessionStorage.setItem(sessionKey,JSON.stringify(saved)); } catch {}
    return saved.id;
  }
  const seen = new Set();
  function record(kind, item='', title='', once=false) {
    if (document.visibilityState === 'hidden' && kind !== 'download_click') return;
    const sid=session(), dedup=`${sid}:${kind}:${item}`;
    if(once && seen.has(dedup)) return;
    if(once) seen.add(dedup);
    const body=JSON.stringify({p_id:crypto.randomUUID(),p_session:sid,p_kind:kind,
      p_page:(location.pathname==='/'?'/index.html':location.pathname).slice(0,160),
      p_item:String(item).slice(0,240),p_title:String(title).slice(0,160)});
    // Keepalive preserves click events across navigation. Never delay a download.
    fetch(endpoint,{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body,keepalive:true}).catch(()=>{});
  }
  let pageCounted=false;
  function countPage(){if(!pageCounted && document.visibilityState!=='hidden'){pageCounted=true;record('page_view');}}
  document.addEventListener('visibilitychange',countPage); countPage();
  const timers=new Map(), observed=new WeakSet();
  const observer=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{
    for(const e of entries){
      clearTimeout(timers.get(e.target));timers.delete(e.target);
      if(e.isIntersecting && e.intersectionRatio>=0.5){
        timers.set(e.target,setTimeout(()=>{
          const card=e.target.closest?.('[data-example-id]') || e.target;
          if(card.isConnected && !card.hidden && card.dataset.adminHidden!=='true')
            record('cipher_view',card.dataset.exampleId,card.querySelector('h2')?.textContent?.trim()||'',true);
          timers.delete(card);
        },1000));
      }
    }
  },{threshold:[0,0.5]}):null;
  function scan(){
    document.querySelectorAll('[data-example-id]').forEach(card=>{
      if(!observed.has(card)){observed.add(card);observer?.observe(card.querySelector('h2') || card);}
    });
  }
  scan();
  new MutationObserver(scan).observe(document.body,{childList:true,subtree:true});
  function publicTarget(url){return url.origin===location.origin?url.pathname:`${url.hostname}${url.pathname}`;}
  function videoLink(url){return /(^|\.)(youtube\.com|youtu\.be|vimeo\.com)$/.test(url.hostname);}
  function onLink(event){
    if(event.type==='auxclick' && event.button!==1)return;
    const a=event.target.closest?.('a[href]');if(!a)return;
    let u;try{u=new URL(a.href,location.href);}catch{return;}
    if(!/^https?:$/.test(u.protocol))return;
    const card=a.closest('[data-example-id]');
    if(card && (a.matches('.track-view,.sample-image-link') || u.pathname.endsWith('web.html')))
      record('cipher_open',card.dataset.exampleId,card.querySelector('h2')?.textContent?.trim()||'');
    if(a.hasAttribute('download') || (u.origin===location.origin && u.pathname.startsWith('/downloads/')))
      record('download_click',publicTarget(u),u.pathname.split('/').pop()||'');
    if(videoLink(u)) {
      const id=a.dataset.videoId || u.searchParams.get('v') || u.pathname.split('/').filter(Boolean).pop();
      if(id)record('video_open',id,a.dataset.videoTitle||a.textContent.trim());
    }
  }
  document.addEventListener('click',onLink);document.addEventListener('auxclick',onLink);
  document.addEventListener('play',event=>{
    if(event.target.tagName!=='VIDEO')return;
    const v=event.target;
    let id=v.dataset.videoId;
    if(!id){try{id=publicTarget(new URL(v.currentSrc||v.src,location.href));}catch{return;}}
    record('video_play',id,v.dataset.videoTitle||v.getAttribute('aria-label')||'',true);
  },true);
})();
