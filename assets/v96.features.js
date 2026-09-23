(()=>{
  'use strict';
  const $=s=>document.querySelector(s);
  const $$=s=>[...document.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const OWNER_UID=String(window.BR_FIREBASE_ADMIN?.uid||window.BR_FIREBASE_CONFIG?.adminUid||'6EBZp2WqNsaPscVkdPMso1q6uTg1');
  const SOUND_KEY='br78_admin_chat_sound_v96';
  const ERROR_LOG_KEY='br78_admin_error_log_v94';
  const ERROR_CLEAN_APPLIED_KEY='br78_error_cleanup_before_applied_v96';
  const LOCK_NOTICE_KEY='br78_staff_lockdown_notice_v96';
  let db=null,auth=null;
  let lockdownRef=null,lockdownHandler=null,lockdown=false;
  let pinRef=null,pinHandler=null;
  let readRef=null,readHandler=null,lastReadAt=0;
  let unreadRef=null,unreadHandler=null,latestChatRows=[],latestMessageAt=0,chatBaselineReady=false;
  let activityRef=null,activityHandler=null,activityCache={},activityBootstrapDone=false;
  let cleanupRef=null,cleanupHandler=null;
  let soundEnabled=true,audioUnlocked=false,audioCtx=null;
  let bootTimer=null;
  try{soundEnabled=localStorage.getItem(SOUND_KEY)!=='0'}catch{}

  function access(){return window.BRAdminAccess||null}
  function isOwner(){return access()?.isOwner===true}
  function canChat(){return access()?.canView?.('chat')===true||access()?.can?.('chat')===true}
  function canPin(){return isOwner()||(!access()?.readOnly&&access()?.can?.('chat')&&access()?.can?.('admins')&&access()?.can?.('leaders'))}
  function user(){try{return auth?.currentUser||firebase.auth().currentUser||null}catch{return null}}
  function ensureFirebase(){
    try{
      if(!window.firebase?.apps?.length)return false;
      auth=firebase.auth();db=firebase.database();return !!db&&!!auth;
    }catch{return false}
  }
  function toast(msg){const t=$('#toast');if(!t)return window.alert(msg);t.textContent=msg;t.classList.add('show');clearTimeout(t.__v96Timer);t.__v96Timer=setTimeout(()=>t.classList.remove('show'),2300)}
  function fmtLastLogin(ts){
    ts=Number(ts||0);if(!ts)return {text:'ещё не входил',state:'never'};
    const d=new Date(ts),now=new Date(),startToday=new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime(),startThat=new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime();
    const time=d.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}),days=Math.floor((startToday-startThat)/86400000);
    if(days<=0)return {text:`сегодня ${time}`,state:'recent'};
    if(days===1)return {text:`вчера ${time}`,state:'recent'};
    if(days<30)return {text:`${days} дн. назад`,state:'old'};
    return {text:d.toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric'})+' '+time,state:'old'};
  }

  // ---- Staff last login ---------------------------------------------------
  function annotateStaffLastLogin(){
    $$('[data-staff-card]').forEach(card=>{
      const uid=card.dataset.staffCard||'',main=card.querySelector('.staff-access-main>div');if(!uid||!main)return;
      const info=fmtLastLogin(activityCache[uid]?.lastLoginAt);
      let row=main.querySelector('.staff-last-login');
      if(!row){row=document.createElement('div');row.className='staff-last-login';main.appendChild(row)}
      row.dataset.state=info.state;row.innerHTML=`<span>🕒</span><b>Последний вход:</b><span>${esc(info.text)}</span>`;
    });
  }
  async function bootstrapStaffActivityFromLogs(){
    if(activityBootstrapDone||!isOwner()||!db)return;activityBootstrapDone=true;
    try{
      const snap=await db.ref('adminLoginLogs').orderByChild('at').limitToLast(200).once('value'),latest={};
      snap.forEach(c=>{const v=c.val()||{},uid=String(v.uid||''),at=Number(v.at||0);if(uid&&v.status==='success'&&at&&(!latest[uid]||at>latest[uid].lastLoginAt))latest[uid]={lastLoginAt:at,alias:String(v.alias||'Сотрудник').slice(0,64),role:String(v.role||'Доступ').slice(0,64)}});
      const updates={};Object.entries(latest).forEach(([uid,v])=>{if(!activityCache[uid]?.lastLoginAt)updates[`staffActivity/${uid}`]=v});
      if(Object.keys(updates).length)await db.ref().update(updates);
    }catch{}
  }
  function bindStaffActivity(){
    if(!db||!access()?.canManageAccess?.()||activityRef)return;
    activityRef=db.ref('staffActivity');
    activityHandler=s=>{activityCache=s.val()||{};annotateStaffLastLogin();bootstrapStaffActivityFromLogs()};
    activityRef.on('value',activityHandler,()=>{});
  }

  // ---- Emergency lock -----------------------------------------------------
  function updateLockUI(){
    const card=$('#emergencyStaffLockCard'),status=$('#emergencyStaffLockStatus'),btn=$('#toggleStaffLockdownBtn');
    if(card)card.hidden=!isOwner();
    if(status){status.classList.toggle('locked',lockdown);status.innerHTML=`<i></i><span>${lockdown?'АВАРИЙНЫЙ РЕЖИМ ВКЛЮЧЁН • сотрудники заблокированы':'Доступ сотрудников работает'}</span>`}
    if(btn){btn.textContent=lockdown?'Вернуть доступ сотрудникам':'Отключить всех сотрудников';btn.classList.toggle('danger',!lockdown);btn.classList.toggle('green',lockdown)}
  }
  async function toggleLockdown(){
    if(!isOwner()||!db)return toast('Только владелец может использовать аварийное отключение');
    const next=!lockdown;
    if(next&&!confirm('Аварийно отключить ВСЕХ сотрудников кроме владельца? Их активные сессии будут завершены.'))return;
    try{await db.ref('adminControls/staffLockdown').set(next);toast(next?'Сотрудники аварийно отключены':'Доступ сотрудников восстановлен')}catch(e){toast('Не удалось изменить режим. Проверь Firebase Rules V9.6')}
  }
  function forceStaffLogout(){
    if(isOwner()||!lockdown)return;
    try{localStorage.setItem(LOCK_NOTICE_KEY,'1')}catch{}
    try{sessionStorage.removeItem(window.BR_KEYS?.session||'br78_admin_session_v1');sessionStorage.removeItem('br78_admin_role_v85')}catch{}
    Promise.resolve(auth?.signOut?.()).finally(()=>location.reload());
  }
  function bindLockdown(){
    if(!db||lockdownRef)return;
    lockdownRef=db.ref('adminControls/staffLockdown');
    lockdownHandler=s=>{lockdown=s.val()===true;updateLockUI();forceStaffLogout()};
    lockdownRef.on('value',lockdownHandler,()=>{});
  }

  // ---- Pinned admin chat --------------------------------------------------
  function renderPinned(v){
    const panel=$('#adminChatPinned'),text=$('#adminChatPinnedText'),meta=$('#adminChatPinnedMeta'),setBtn=$('#setAdminChatPinnedBtn'),clearBtn=$('#clearAdminChatPinnedBtn');if(!panel)return;
    const has=!!v&&!!String(v.text||'').trim();panel.hidden=!has&&!canPin();
    if(text)text.textContent=has?String(v.text):'Важное сообщение пока не закреплено.';
    if(meta)meta.textContent=has?`${v.alias||'Администрация'} • ${new Date(Number(v.pinnedAt||v.at||Date.now())).toLocaleString('ru-RU')}`:'Закрепить может владелец или ГА.';
    if(setBtn){setBtn.hidden=!canPin();setBtn.textContent=has?'Изменить закреп':'Закрепить сообщение'}
    if(clearBtn)clearBtn.hidden=!has||!canPin();
  }
  async function setPinned(){
    if(!canPin()||!db)return;
    let current=$('#adminChatPinnedText')?.textContent||'';if(current==='Важное сообщение пока не закреплено.')current='';
    const text=prompt('Текст закреплённого сообщения:',current);if(text===null)return;const clean=text.trim().slice(0,500);if(!clean)return toast('Сообщение пустое');
    const u=user();try{await db.ref('adminChatPinned').set({text:clean,uid:u?.uid||'',alias:String(access()?.alias||'Администрация').slice(0,64),role:String(access()?.label||'Админ').slice(0,64),pinnedAt:Date.now()});toast('Сообщение закреплено')}catch(e){toast('Не удалось закрепить. Проверь права ГА / Rules')}
  }
  async function clearPinned(){if(!canPin()||!db)return;if(!confirm('Убрать закреплённое сообщение?'))return;try{await db.ref('adminChatPinned').remove();toast('Закреп убран')}catch{toast('Не удалось убрать закреп')}}
  function bindPinned(){if(!db||!canChat()||pinRef)return;pinRef=db.ref('adminChatPinned');pinHandler=s=>renderPinned(s.val());pinRef.on('value',pinHandler,()=>renderPinned(null))}

  // ---- Unread + sound -----------------------------------------------------
  function updateSoundUI(){const b=$('#adminChatSoundBtn');if(!b)return;b.dataset.enabled=soundEnabled?'1':'0';b.textContent=soundEnabled?'🔊 Звук: Вкл':'🔇 Звук: Выкл'}
  function toggleSound(){soundEnabled=!soundEnabled;try{localStorage.setItem(SOUND_KEY,soundEnabled?'1':'0')}catch{};unlockAudio();updateSoundUI();toast(soundEnabled?'Звук чата включён':'Звук чата выключен')}
  function unlockAudio(){audioUnlocked=true;try{audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume()}catch{}}
  function beep(){if(!soundEnabled||!audioUnlocked)return;try{audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)();const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.frequency.value=660;g.gain.setValueAtTime(.0001,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.055,audioCtx.currentTime+.015);g.gain.exponentialRampToValueAtTime(.0001,audioCtx.currentTime+.13);o.connect(g);g.connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+.14)}catch{}}
  function renderUnread(){
    const me=user()?.uid||'',count=latestChatRows.filter(r=>r.uid!==me&&Number(r.at||0)>Number(lastReadAt||0)).length,b=$('#adminChatUnreadBadge');if(!b)return;
    b.hidden=count<=0;b.textContent=count>99?'99+':String(count);
  }
  async function markChatRead(){
    if(!db||!user()||!canChat())return;const max=Math.max(latestMessageAt,Date.now());lastReadAt=max;renderUnread();
    try{await db.ref(`adminReadState/${user().uid}/chatLastReadAt`).set(max)}catch{}
  }
  function activeView(){return $('.view.active')?.id?.replace('view-','')||''}
  function bindUnread(){
    if(!db||!user()||!canChat()||unreadRef)return;
    readRef=db.ref(`adminReadState/${user().uid}/chatLastReadAt`);readHandler=s=>{lastReadAt=Number(s.val()||0);renderUnread()};readRef.on('value',readHandler,()=>{});
    unreadRef=db.ref('adminChat').orderByChild('at').limitToLast(60);
    unreadHandler=s=>{
      const rows=Object.entries(s.val()||{}).map(([id,v])=>({id,...(v||{})})).sort((a,b)=>Number(a.at||0)-Number(b.at||0));const prev=latestMessageAt;latestChatRows=rows;latestMessageAt=rows.reduce((m,r)=>Math.max(m,Number(r.at||0)),0);
      if(chatBaselineReady&&latestMessageAt>prev){const fresh=rows.filter(r=>Number(r.at||0)>prev&&r.uid!==user()?.uid);if(fresh.length)beep()}
      chatBaselineReady=true;renderUnread();if(activeView()==='chat'&&!document.hidden)setTimeout(markChatRead,250);
    };
    unreadRef.on('value',unreadHandler,()=>{});
  }

  // ---- Dashboard online ---------------------------------------------------
  function renderDashboardPresence(detail){
    const list=$('#dashboardStaffOnlineList'),count=$('#dashboardStaffOnlineCount');if(!list)return;
    const rows=Array.isArray(detail?.rows)?detail.rows:[];const online=rows.filter(x=>x.state==='online');if(count)count.textContent=`${online.length} онлайн`;
    list.innerHTML=online.length?online.slice(0,8).map(p=>`<div class="dashboard-staff-online-person"><div class="dashboard-staff-online-avatar">${esc(String(p.alias||'U').slice(0,2).toUpperCase())}</div><div><b>${esc(p.alias||'Сотрудник')}</b><small>${esc(p.role||'Админ')} • онлайн</small></div></div>`).join(''):'<div class="dashboard-staff-online-empty">Сейчас сотрудников онлайн нет.</div>';
  }

  // ---- Global local-error cleanup ----------------------------------------
  function pruneLocalErrors(cutoff){
    cutoff=Number(cutoff||0);if(!cutoff)return 0;
    try{
      const rows=window.BRAdminErrorCenter?.read?.()||JSON.parse(localStorage.getItem(ERROR_LOG_KEY)||'[]');const next=rows.filter(x=>Number(x?.time||0)>=cutoff),removed=rows.length-next.length;
      localStorage.setItem(ERROR_LOG_KEY,JSON.stringify(next));localStorage.setItem(ERROR_CLEAN_APPLIED_KEY,String(cutoff));window.BRAdminErrorCenter?.render?.();return removed;
    }catch{return 0}
  }
  function bindErrorCleanup(){
    if(!db||cleanupRef)return;cleanupRef=db.ref('adminControls/errorCleanupBefore');cleanupHandler=s=>{const cutoff=Number(s.val()||0);let applied=0;try{applied=Number(localStorage.getItem(ERROR_CLEAN_APPLIED_KEY)||0)}catch{};if(cutoff&&cutoff>applied)pruneLocalErrors(cutoff)};cleanupRef.on('value',cleanupHandler,()=>{});
  }

  // ---- Old data cleanup ---------------------------------------------------
  function cleanupDays(){return Math.max(7,Number($('#oldDataCleanupDays')?.value||30)||30)}
  function cleanupResult(text,bad=false){const el=$('#oldDataCleanupResult');if(!el)return;el.textContent=text;el.className=`cleanup-result ${bad?'bad':'ok'}`}
  async function deleteOldChildren(path,timeField,cutoff){
    const snap=await db.ref(path).once('value'),updates={};let n=0;snap.forEach(c=>{const v=c.val()||{},t=Number(v?.[timeField]||0);if(!t||t<cutoff){updates[c.key]=null;n++}});if(n)await db.ref(path).update(updates);return n;
  }
  async function cleanupOld(kind,ask=true){
    if(!isOwner()||!db)return toast('Очистка доступна только владельцу');const days=cleanupDays(),cutoff=Date.now()-days*86400000;
    const labels={chat:'сообщения чата',logs:'журнал входов',presence:'старые статусы',errors:'локальные ошибки у всех устройств',all:'все перечисленные старые данные'};
    if(ask&&!confirm(`Удалить ${labels[kind]} старше ${days} дней?`))return;
    cleanupResult('Очистка…');try{
      let parts=[];
      if(kind==='chat'||kind==='all')parts.push(`чат: ${await deleteOldChildren('adminChat','at',cutoff)}`);
      if(kind==='logs'||kind==='all')parts.push(`входы: ${await deleteOldChildren('adminLoginLogs','at',cutoff)}`);
      if(kind==='presence'||kind==='all')parts.push(`presence: ${await deleteOldChildren('adminChatPresence','lastSeen',cutoff)}`);
      if(kind==='errors'||kind==='all'){await db.ref('adminControls/errorCleanupBefore').set(cutoff);const n=pruneLocalErrors(cutoff);parts.push(`ошибки: очищено локально ${n}, команда отправлена всем`)}
      cleanupResult(`Готово • ${parts.join(' • ')||'нечего удалять'}`);toast('Старые данные очищены');
    }catch(e){window.BRAdminErrorCenter?.report?.('firebase',e,'error','old data cleanup');cleanupResult(`Ошибка: ${e?.code||e?.message||'Firebase'}`,true)}
  }

  function syncOwnerOnly(){$$('[data-real-owner-only]').forEach(el=>el.hidden=!isOwner());updateLockUI()}
  function bindViewClicks(){
    document.addEventListener('click',e=>{
      unlockAudio();const nav=e.target.closest('.nav-btn[data-view]');if(nav?.dataset.view==='chat')setTimeout(markChatRead,120);
      if(nav?.dataset.view==='system'||nav?.dataset.view==='cleanup')setTimeout(()=>{bindStaffActivity();annotateStaffLastLogin();syncOwnerOnly()},180);
    });
    window.addEventListener('keydown',unlockAudio,{once:true});window.addEventListener('touchstart',unlockAudio,{once:true,passive:true});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden&&activeView()==='chat')markChatRead()});
  }
  function showLockNotice(){try{if(localStorage.getItem(LOCK_NOTICE_KEY)==='1'){localStorage.removeItem(LOCK_NOTICE_KEY);const err=$('#loginError');if(err)err.textContent='Владелец временно отключил вход всех сотрудников.'}}catch{}}

  function proxyClick(sourceId){const btn=$(sourceId);if(!btn)return toast('Нужное действие пока не найдено');btn.click()}
  function syncCleanupDays(){const quick=$('#cleanupQuickDays'),base=$('#oldDataCleanupDays');if(quick&&base)base.value=quick.value}
  async function clearForbesServiceHistory(kind){
    if(!isOwner()||!db)return toast('Очистка доступна только владельцу');
    const config={
      applications:{path:'forbesService/applications',title:'ВСЕ заявки Forbes',confirm:'Удалить ВСЕ заявки Forbes, включая активные заявки на изменение данных?'},
      links:{path:'forbesService/linkRequests',title:'историю запросов привязки',confirm:'Удалить всю историю запросов привязки Forbes? Уже подтверждённые связи аккаунтов с игроками сохранятся.'}
    }[kind];
    if(!config)return;
    if(!confirm(config.confirm))return;
    if(!confirm(`Подтверди ещё раз: очистить ${config.title}?`))return;
    try{await db.ref(config.path).remove();toast(kind==='applications'?'Заявки Forbes очищены':'История привязок очищена')}
    catch(e){window.BRAdminErrorCenter?.report?.('firebase',e,'error',`cleanup ${kind}`);toast('Не удалось очистить. Проверь Firebase Rules')}
  }

  function bindButtons(){
    $('#toggleStaffLockdownBtn')?.addEventListener('click',toggleLockdown);
    $('#setAdminChatPinnedBtn')?.addEventListener('click',setPinned);$('#clearAdminChatPinnedBtn')?.addEventListener('click',clearPinned);$('#adminChatSoundBtn')?.addEventListener('click',toggleSound);
    $('#cleanupOldChatBtn')?.addEventListener('click',()=>cleanupOld('chat'));$('#cleanupOldLoginLogsBtn')?.addEventListener('click',()=>cleanupOld('logs'));$('#cleanupOldPresenceBtn')?.addEventListener('click',()=>cleanupOld('presence'));$('#cleanupOldErrorsBtn')?.addEventListener('click',()=>cleanupOld('errors'));$('#cleanupOldAllBtn')?.addEventListener('click',()=>cleanupOld('all'));
    $('#cleanupErrorsQuickBtn')?.addEventListener('click',()=>proxyClick('#clearAdminErrorsBtn'));$('#cleanupAdminChatQuickBtn')?.addEventListener('click',()=>proxyClick('#clearAdminChatBtn'));$('#cleanupAdminLoginLogsQuickBtn')?.addEventListener('click',()=>proxyClick('#clearAdminLoginLogsBtn'));$('#cleanupNotificationsQuickBtn')?.addEventListener('click',()=>proxyClick('#clearGlobalNotificationsBtn'));$('#cleanupDynamicsQuickBtn')?.addEventListener('click',()=>proxyClick('#clearAllDynamicsBtn'));$('#cleanupDynamicsOldQuickBtn')?.addEventListener('click',()=>proxyClick('#pruneDynamicsBtn'));$('#cleanupAmountsQuickBtn')?.addEventListener('click',()=>proxyClick('#clearAmountsBtn'));$('#cleanupAchievementsQuickBtn')?.addEventListener('click',()=>proxyClick('#resetAllAchievementsBtn'));$('#cleanupFactoryResetQuickBtn')?.addEventListener('click',()=>proxyClick('#factoryResetBtn'));$('#cleanupForbesApplicationsQuickBtn')?.addEventListener('click',()=>clearForbesServiceHistory('applications'));$('#cleanupForbesLinkRequestsQuickBtn')?.addEventListener('click',()=>clearForbesServiceHistory('links'));$('#cleanupQuickDays')?.addEventListener('change',syncCleanupDays);$('#cleanupQuickOldChatBtn')?.addEventListener('click',()=>{syncCleanupDays();cleanupOld('chat')});$('#cleanupQuickOldLoginLogsBtn')?.addEventListener('click',()=>{syncCleanupDays();cleanupOld('logs')});$('#cleanupQuickOldPresenceBtn')?.addEventListener('click',()=>{syncCleanupDays();cleanupOld('presence')});$('#cleanupQuickOldErrorsBtn')?.addEventListener('click',()=>{syncCleanupDays();cleanupOld('errors')});$('#cleanupQuickOldAllBtn')?.addEventListener('click',()=>{syncCleanupDays();cleanupOld('all')});
  }
  function startFeatures(){
    if(!ensureFirebase()||!access()||!user())return false;
    syncOwnerOnly();bindLockdown();bindPinned();bindUnread();bindStaffActivity();bindErrorCleanup();annotateStaffLastLogin();updateSoundUI();
    if(window.BRAdminPresenceSnapshot)renderDashboardPresence(window.BRAdminPresenceSnapshot);
    return true;
  }
  function init(){
    bindButtons();bindViewClicks();updateSoundUI();showLockNotice();
    window.addEventListener('br-admin-presence',e=>renderDashboardPresence(e.detail||{}));
    const staff=$('#staffAccessList');if(staff){let queued=false;new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;annotateStaffLastLogin()})}).observe(staff,{childList:true,subtree:false})}
    let attempts=0;bootTimer=setInterval(()=>{attempts++;if(startFeatures()||attempts>20){clearInterval(bootTimer);bootTimer=null}},500);startFeatures();
    try{firebase.auth().onAuthStateChanged(()=>setTimeout(startFeatures,250))}catch{}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
