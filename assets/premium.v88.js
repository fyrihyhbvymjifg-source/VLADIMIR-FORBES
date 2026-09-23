(()=>{
  const $=(s,r=document)=>r.querySelector(s);
  function ensureBackground(){
    if(!$('.bg-particles')){const p=document.createElement('div');p.className='bg-particles';p.setAttribute('aria-hidden','true');document.body.prepend(p);}
    if(!$('.ambient-bubbles')){
      const wrap=document.createElement('div');wrap.className='ambient-bubbles';wrap.setAttribute('aria-hidden','true');
      const bubbles=[['6%','6px','29s','-3s','18px','.16'],['15%','9px','33s','-16s','-22px','.13'],['27%','5px','25s','-7s','16px','.18'],['39%','8px','36s','-21s','-18px','.13'],['52%','11px','39s','-11s','24px','.11'],['66%','6px','31s','-5s','-17px','.15'],['78%','9px','35s','-23s','18px','.12'],['91%','5px','28s','-14s','-12px','.17']];
      bubbles.forEach(v=>{const s=document.createElement('span');['--x','--s','--d','--delay','--drift','--o'].forEach((k,i)=>s.style.setProperty(k,v[i]));wrap.appendChild(s);});
      document.body.prepend(wrap);
    }
  }
  function installServerPanel(){
    if(!document.querySelector('main#top')||$('.server-panel-mini'))return;
    const panel=document.createElement('aside');panel.className='server-panel-mini';panel.setAttribute('aria-label','Информация сервера');
    panel.innerHTML='<span class="sp-kicker">SERVER PANEL</span><b>78 • VLADIMIR</b><span class="sp-status"><i></i><span>Система работает</span></span>';
    document.body.appendChild(panel);
  }
  function installReveal(){
    if(!('IntersectionObserver'in window))return;
    const nodes=[...document.querySelectorAll('.podium-card,.rank-row,.directory-card,.kpi,.panel,.setting-card')].slice(0,80);
    const io=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('premium-visible');io.unobserve(e.target);}}),{threshold:.06});
    nodes.forEach((el,i)=>{el.classList.add('premium-reveal');el.style.transitionDelay=`${Math.min(i%8,5)*28}ms`;io.observe(el);});
  }
  function watchDynamicReveal(){
    if(!('MutationObserver'in window))return;
    const seen=new WeakSet();
    const add=el=>{if(!(el instanceof Element)||seen.has(el))return;seen.add(el);if(el.matches('.staff-access-row,.rank-row,.directory-card')){el.classList.add('premium-reveal');requestAnimationFrame(()=>el.classList.add('premium-visible'));}el.querySelectorAll?.('.staff-access-row,.rank-row,.directory-card').forEach(x=>{if(!seen.has(x)){seen.add(x);x.classList.add('premium-reveal');requestAnimationFrame(()=>x.classList.add('premium-visible'));}});};
    new MutationObserver(ms=>ms.forEach(m=>m.addedNodes.forEach(add))).observe(document.body,{childList:true,subtree:true});
  }
  function init(){ensureBackground();installServerPanel();requestAnimationFrame(installReveal);watchDynamicReveal();document.documentElement.dataset.premiumUi='v88';}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
