(() => {
  const TTL = 2 * 24 * 60 * 60 * 1000;
  const READ_KEY = 'br78_notification_reads_v1';
  const MAX_VISIBLE = 40;
  let feed = [];
  let panel, bell, badge, list;

  const now = () => Date.now();
  const safeParse = (s, fallback) => { try { return JSON.parse(s); } catch { return fallback; } };
  function asArray(v){ if(Array.isArray(v)) return v.filter(Boolean); if(v&&typeof v==='object') return Object.keys(v).map(k=>v[k]).filter(Boolean); return []; }
  function esc(v=''){ return String(v).replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c])); }
  function fmt(ts){ try { return new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(ts)); } catch { return ''; } }
  function readMap(){ const x=safeParse(localStorage.getItem(READ_KEY)||'{}',{}); return x&&typeof x==='object'?x:{}; }
  function saveMap(m){ try{localStorage.setItem(READ_KEY,JSON.stringify(m));}catch{} }
  function pruneReadMap(){ const m=readMap(), cutoff=now()-TTL; let dirty=false; Object.keys(m).forEach(id=>{ if(Number(m[id]||0)<cutoff){delete m[id];dirty=true;} }); if(dirty) saveMap(m); return m; }
  function validFeed(raw){ const cutoff=now()-TTL; return asArray(raw).map(n=>({id:String(n?.id||''),type:String(n?.type||'info'),icon:String(n?.icon||'🔔'),title:String(n?.title||'Уведомление'),text:String(n?.text||''),time:Number(n?.time)||0,link:String(n?.link||'')})).filter(n=>n.id&&n.time>=cutoff).sort((a,b)=>b.time-a.time).slice(0,MAX_VISIBLE); }

  function ensureUI(){
    if(document.getElementById('notificationPanel')) return;
    const settings = document.querySelector('.nav [data-open-user-settings]');
    if(settings){
      bell=document.createElement('button'); bell.type='button'; bell.className='notification-bell'; bell.setAttribute('aria-label','Уведомления'); bell.setAttribute('aria-expanded','false'); bell.innerHTML='<span class="notification-bell-icon">🔔</span><span class="notification-badge" id="notificationBadge">0</span>';
      settings.insertAdjacentElement('afterend',bell);
    } else {
      const creatorSettings=document.querySelector('.creator-settings-button');
      if(creatorSettings){
        bell=document.createElement('button'); bell.type='button'; bell.className='creator-settings-button creator-notification-button'; bell.setAttribute('aria-label','Уведомления'); bell.innerHTML='<span>🔔</span><span><b>Уведомления</b><small>Хранятся 2 дня</small></span><i>→</i><em class="notification-badge" id="notificationBadge">0</em>';
        creatorSettings.insertAdjacentElement('afterend',bell);
      }
    }
    document.body.insertAdjacentHTML('beforeend','<aside class="notification-panel" id="notificationPanel" aria-label="Центр уведомлений"><div class="notification-panel-head"><div class="notification-panel-title"><b>🔔 Уведомления</b><span>Последние события хранятся 2 дня</span></div><div class="notification-panel-actions"><button type="button" id="notificationReadAll">Прочитать все</button><button type="button" id="notificationClearLocal">Скрыть все</button></div></div><div class="notification-list" id="notificationList"></div></aside>');
    panel=document.getElementById('notificationPanel'); badge=document.getElementById('notificationBadge'); list=document.getElementById('notificationList');
    bell?.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();toggle();});
    document.getElementById('notificationReadAll')?.addEventListener('click',()=>markAllRead());
    document.getElementById('notificationClearLocal')?.addEventListener('click',()=>hideAll());
    document.addEventListener('click',e=>{ if(panel?.classList.contains('open')&&!panel.contains(e.target)&&!bell?.contains(e.target)) close(); });
    document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
  }
  function render(){
    if(!panel) ensureUI();
    const reads=pruneReadMap();
    const visible=feed.filter(n=>!reads[`hide:${n.id}`]);
    const unread=visible.filter(n=>!reads[n.id]).length;
    if(badge){badge.textContent=unread>99?'99+':String(unread);badge.classList.toggle('show',unread>0);}
    if(!list)return;
    if(!visible.length){list.innerHTML='<div class="notification-empty">Новых уведомлений нет.<br>Старые записи удаляются через 2 дня.</div>';return;}
    list.innerHTML=visible.map(n=>`<a class="notification-item ${reads[n.id]?'':'unread'}" href="${esc(n.link||'#')}" data-notification-id="${esc(n.id)}"><span class="notification-item-icon">${esc(n.icon)}</span><span class="notification-item-copy"><b>${esc(n.title)}</b><p>${esc(n.text)}</p></span><time>${esc(fmt(n.time))}</time></a>`).join('');
    list.querySelectorAll('[data-notification-id]').forEach(a=>a.addEventListener('click',()=>markRead(a.dataset.notificationId)));
  }
  function markRead(id){const m=readMap();m[id]=now();saveMap(m);render();}
  function markAllRead(){const m=readMap(),t=now();feed.forEach(n=>m[n.id]=t);saveMap(m);render();}
  function hideAll(){const m=readMap(),t=now();feed.forEach(n=>m[`hide:${n.id}`]=t);saveMap(m);render();}
  function open(){panel?.classList.add('open');bell?.classList.add('active');bell?.setAttribute('aria-expanded','true');markAllRead();}
  function close(){panel?.classList.remove('open');bell?.classList.remove('active');bell?.setAttribute('aria-expanded','false');}
  function toggle(){panel?.classList.contains('open')?close():open();}
  function setFeed(raw){feed=validFeed(raw);render();}
  function connect(){
    if(!window.firebase||!window.BR_FIREBASE_CONFIG)return;
    try{if(!firebase.apps.length)firebase.initializeApp(window.BR_FIREBASE_CONFIG);firebase.database().ref('settings/notifications').on('value',s=>setFeed(s.val()),()=>setFeed([]));}catch(e){console.warn('Notification center init skipped',e?.code||e?.message||e);}
  }
  ensureUI();render();connect();
  window.BRNotifications={setFeed,open,close};
})();
