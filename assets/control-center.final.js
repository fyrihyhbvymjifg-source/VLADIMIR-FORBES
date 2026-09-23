
(()=>{
  const root=document.documentElement;
  const SAFE_KEY='br78_safe_mode_v1';
  const META_KEY=window.BR_KEYS?.meta||'br78_forbes_meta_v1';
  const isAdmin=()=>document.body?.classList.contains('admin-lite')||!!document.getElementById('adminApp');
  let lastSettings={};
  const readSafe=()=>{try{return localStorage.getItem(SAFE_KEY)==='1'}catch{return false}};
  const setSafe=v=>{try{localStorage.setItem(SAFE_KEY,v?'1':'0')}catch{}root.dataset.safeMode=v?'1':'0';syncSafeButton();window.dispatchEvent(new CustomEvent('br-safe-mode-change',{detail:{enabled:v}}));};
  const detectTier=()=>{
    const ua=navigator.userAgent||'';
    const iOS=/iPhone|iPad|iPod/i.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
    const hc=Number(navigator.hardwareConcurrency||8);
    const mem=Number(navigator.deviceMemory||8);
    const saveData=!!navigator.connection?.saveData;
    const reduced=!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const narrow=Math.min(window.innerWidth||9999,window.screen?.width||9999)<=760;
    let score=0;
    if(hc<=2)score+=4;else if(hc<=4)score+=2;
    if(mem&&mem<=2)score+=4;else if(mem&&mem<=4)score+=2;
    if(saveData)score+=2;if(reduced)score+=2;if(narrow)score+=1;if(iOS&&narrow)score+=1;
    const optimized=score>=2,low=score>=4;
    root.dataset.deviceTier=optimized?'optimized':'full';
    root.dataset.smartLowend=low?'low':optimized?'balanced':'full';
    root.dataset.deviceIos=iOS?'1':'0';
    root.dataset.deviceCores=String(hc||0);
    return low;
  };
  function syncSafeButton(){
    const enabled=root.dataset.safeMode==='1';
    const b=document.getElementById('toggleSafeModeBtn'); if(b)b.textContent=enabled?'Выключить безопасный режим':'Включить безопасный режим';
    const s=document.getElementById('safeModeStatus'); if(s)s.textContent=enabled?'Включён • максимум стабильности':'Выключен • обычный интерфейс';
  }
  function offlineBanner(){
    if(document.querySelector('.cc-offline-banner'))return;
    const el=document.createElement('div');el.className='cc-offline-banner';el.innerHTML='<i></i><span>Офлайн-режим • показаны последние сохранённые данные</span>';document.body.appendChild(el);
  }
  function syncOnline(){root.dataset.offline=navigator.onLine?'0':'1';const s=document.getElementById('offlineProtectionStatus');if(s)s.textContent=navigator.onLine?'Онлайн • Firebase доступен':'Офлайн • используются локальные данные';}
  const daypart=()=>{const h=new Date().getHours();return h>=6&&h<11?'morning':h>=11&&h<17?'day':h>=17&&h<23?'evening':'night'};
  function applySiteControl(settings={}){
    lastSettings=settings&&typeof settings==='object'?settings:{};
    const auto=lastSettings.autoTimeBackground===true;
    root.dataset.autoTimeBg=auto?'1':'0';root.dataset.daypart=daypart();
    if(isAdmin())return;
    const now=Date.now(),sch=lastSettings.maintenanceSchedule&&typeof lastSettings.maintenanceSchedule==='object'?lastSettings.maintenanceSchedule:{};
    const scheduled=!!(sch.enabled&&Number(sch.startAt)>0&&Number(sch.endAt)>Number(sch.startAt)&&Number(sch.startAt)<=now&&now<Number(sch.endAt));
    const maint=!!lastSettings.maintenanceMode||scheduled;
    let overlay=document.getElementById('ccMaintenance');
    if(maint&&!overlay){overlay=document.createElement('section');overlay.id='ccMaintenance';overlay.className='cc-maintenance';overlay.innerHTML='<div class="cc-maintenance-card"><div class="cc-maintenance-icon">🛠️</div><h1>Технические работы</h1><p id="ccMaintenanceMessage">Сайт временно находится на обслуживании. Мы скоро вернёмся.</p><small>BLACK RUSSIA • SERVER 78 VLADIMIR</small></div>';document.body.appendChild(overlay);}
    if(overlay){const m=overlay.querySelector('#ccMaintenanceMessage');if(m)m.textContent=String(lastSettings.maintenanceMessage||'Сайт временно находится на обслуживании. Мы скоро вернёмся.');overlay.classList.toggle('show',maint);document.body.style.overflow=maint?'hidden':'';}
  }
  function localSettings(){try{const m=JSON.parse(localStorage.getItem(META_KEY)||'{}');return m?.siteSettings||{}}catch{return{}}}
  function startFirebase(){
    // Admin has its own Firebase layer; do not create duplicate realtime listeners there.
    if(isAdmin()) return;
    const cfg=window.BR_FIREBASE_CONFIG;if(!cfg||!window.firebase)return;
    try{if(!firebase.apps.length)firebase.initializeApp(cfg);const db=firebase.database();db.ref('settings/siteSettings').on('value',s=>applySiteControl(s.val()||{}),()=>applySiteControl(localSettings()));db.ref('.info/connected').on('value',s=>{if(s.val()===false&&navigator.onLine)root.dataset.offline='1';else syncOnline();});}catch{applySiteControl(localSettings())}
  }
  function init(){
    const optimized=detectTier();
    root.dataset.safeMode=readSafe()?'1':'0';
    offlineBanner();syncOnline();applySiteControl(localSettings());syncSafeButton();
    if(optimized) window.BRPerformance?.setDefault?.('low');
    window.addEventListener('online',syncOnline,{passive:true});
    window.addEventListener('offline',syncOnline,{passive:true});
    window.addEventListener('resize',()=>{const opt=detectTier();if(opt)window.BRPerformance?.setDefault?.('low');},{passive:true});
    document.addEventListener('click',e=>{if(e.target.closest('#toggleSafeModeBtn'))setSafe(root.dataset.safeMode!=='1')});
    setInterval(()=>{root.dataset.daypart=daypart();if(!isAdmin())applySiteControl(lastSettings)},60000);
    const boot=()=>startFirebase();
    if('requestIdleCallback'in window) requestIdleCallback(boot,{timeout:1200}); else setTimeout(boot,500);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
  window.BRControlCenter={safeMode:{get:()=>root.dataset.safeMode==='1',set:setSafe},deviceTier:()=>root.dataset.deviceTier||'full',applySiteControl};
})();
