(() => {
  const K = window.BR_KEYS || {};
  // Passwords and the owner's login/email are not stored in public site files.
  // Firebase Authentication verifies credentials; only the owner UID is used after a successful sign-in.
  const PLAYER_KEY = K.players || 'br78_players_state_v1';
  const DELETED_KEY = K.deleted || 'br78_deleted_players_v1';
  const STATS_KEY = K.stats || 'br78_forbes_stats_v1';
  const DASH_STATS_CACHE_KEY = 'br78_admin_dashboard_stats_fb16';
  const DASH_STATS_TTL = 60 * 60 * 1000; // 1 hour: saves Firebase reads
  const LEGACY_CUSTOM_KEY = 'br78_custom_players';
  const LEGACY_ORDER_KEY = 'br78_players_order';
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];

  // Cross-browser storage helpers. Some Chrome/privacy/embedded modes can throw
  // SecurityError on sessionStorage/localStorage access; login must still work.
  const memorySession = new Map();
  function sessionGet(key){
    try { return window.sessionStorage ? sessionStorage.getItem(key) : (memorySession.get(key) ?? null); }
    catch { return memorySession.get(key) ?? null; }
  }
  function sessionSet(key,value){
    memorySession.set(key,String(value));
    try { if(window.sessionStorage) sessionStorage.setItem(key,String(value)); } catch {}
  }
  function sessionRemove(key){
    memorySession.delete(key);
    try { if(window.sessionStorage) sessionStorage.removeItem(key); } catch {}
  }
  function withTimeout(promise, ms, code='TIMEOUT'){
    return Promise.race([
      Promise.resolve(promise),
      new Promise((_,reject)=>setTimeout(()=>{ const e=new Error(code); e.code=code; reject(e); },ms))
    ]);
  }


  // --- V9.5.6 Error Center: logs stay local, owner switch is synchronized globally through Firebase ---
  const ERROR_LOG_KEY = 'br78_admin_error_log_v94';
  const ERROR_LOG_ENABLED_KEY = 'br78_admin_error_center_global_cache_v956';
  const ERROR_LOG_LIMIT = 120;
  let errorCenterFilter = 'all';
  let errorCenterMute = false;
  let errorCenterControlBound = false;
  let errorCenterControlRef = null;
  let errorCenterControlHandler = null;
  try{ errorCenterMute = localStorage.getItem(ERROR_LOG_ENABLED_KEY)==='0'; }catch{}
  function isErrorCenterEnabled(){ return !errorCenterMute; }
  function updateErrorCenterToggleUI(){
    const btn=document.getElementById('toggleAdminErrorCenterBtn');
    const state=document.getElementById('adminErrorCenterState');
    const note=document.querySelector('.error-center-note');
    const enabled=isErrorCenterEnabled();
    if(btn){
      btn.hidden=!isOwnerAccess();
      btn.textContent=enabled?'Отключить у всех':'Включить у всех';
      btn.classList.toggle('danger',enabled);
      btn.classList.toggle('green',!enabled);
      btn.setAttribute('aria-pressed',enabled?'true':'false');
      btn.title=isOwnerAccess()?'Глобальная настройка для всех сотрудников и устройств':'Изменять может только владелец';
    }
    if(state){
      state.textContent=enabled?'ВКЛЮЧЁН ДЛЯ ВСЕХ':'ОТКЛЮЧЁН ДЛЯ ВСЕХ';
      state.dataset.state=enabled?'on':'off';
    }
    if(note) note.textContent=enabled
      ? 'Глобальный журнал включён владельцем. Сами записи остаются локальными в браузере каждого сотрудника.'
      : 'Владелец отключил Центр ошибок для всех: новые ошибки не записываются ни у одного сотрудника. Старые локальные записи можно очистить.';
    document.querySelector('.error-center-card')?.classList.toggle('error-center-disabled',!enabled);
  }
  function applyGlobalErrorCenterEnabled(enabled){
    errorCenterMute=!Boolean(enabled);
    try{ localStorage.setItem(ERROR_LOG_ENABLED_KEY,enabled?'1':'0'); }catch{}
    updateErrorCenterToggleUI();
  }
  async function setGlobalErrorCenterEnabled(enabled){
    if(!isOwnerAccess()) return showToast('Только владелец может менять Центр ошибок для всех');
    if(!fbDb) return showToast('Firebase ещё не подключён');
    try{
      await withTimeout(fbDb.ref('adminControls/errorCenterEnabled').set(Boolean(enabled)),6000,'ERROR_CENTER_CONTROL_TIMEOUT');
      applyGlobalErrorCenterEnabled(Boolean(enabled));
      showToast(enabled?'Центр ошибок включён у всех':'Центр ошибок отключён у всех');
    }catch(err){
      nativeConsoleWarn('Global error center control failed',err?.code||err?.message||err);
      showToast('Не удалось изменить глобальный режим. Проверь Firebase Rules V9.6.0');
    }
  }
  function bindGlobalErrorCenterControl(){
    if(!fbDb||errorCenterControlBound)return;
    errorCenterControlBound=true;
    errorCenterControlRef=fbDb.ref('adminControls/errorCenterEnabled');
    errorCenterControlHandler=snap=>{
      const raw=snap.val();
      const enabled=raw===null?true:raw!==false;
      applyGlobalErrorCenterEnabled(enabled);
      if(raw===null&&isOwnerAccess()) errorCenterControlRef.set(true).catch(()=>{});
    };
    errorCenterControlRef.on('value',errorCenterControlHandler,err=>{
      nativeConsoleWarn('Global error center read failed',err?.code||err?.message||err);
      updateErrorCenterToggleUI();
    });
  }
  function redactSensitive(value){
    let t=String(value??'');
    t=t.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[email]');
    t=t.replace(/(password|пароль|token|idToken|refreshToken|authorization)\s*[:=]\s*[^\s,;]+/gi,'$1=[hidden]');
    t=t.replace(/AIza[0-9A-Za-z_-]{20,}/g,'[api-key]');
    return t.slice(0,900);
  }
  function readErrorLog(){
    try{const v=JSON.parse(localStorage.getItem(ERROR_LOG_KEY)||'[]');return Array.isArray(v)?v.slice(0,ERROR_LOG_LIMIT):[];}catch{return[];}
  }
  function writeErrorLog(rows){
    try{localStorage.setItem(ERROR_LOG_KEY,JSON.stringify((Array.isArray(rows)?rows:[]).slice(0,ERROR_LOG_LIMIT)));}catch{}
  }
  function errorSourceFromText(text=''){
    const t=String(text).toLowerCase();
    if(t.includes('auth')||t.includes('login')||t.includes('вход')) return 'auth';
    if(t.includes('firebase')||t.includes('database')||t.includes('permission')||t.includes('rules')) return 'firebase';
    if(t.includes('sync')||t.includes('cloud')) return 'sync';
    return 'system';
  }
  function reportAdminError(source,error,level='error',context=''){
    if(errorCenterMute) return;
    try{
      const message=redactSensitive(error?.message||error||'Неизвестная ошибка');
      const code=redactSensitive(error?.code||'');
      const ctx=redactSensitive(context||'');
      const src=String(source||errorSourceFromText(`${message} ${code} ${ctx}`)).slice(0,24);
      const rows=readErrorLog();
      const now=Date.now();
      const normalizedMessage=message.replace(/\[\d{4}-\d{2}-\d{2}T[^\]]+\]\s*/g,'').replace(/set at \/adminChatPresence\/[^ ]+/gi,'set at /adminChatPresence/{uid}');
      const matchIndex=rows.findIndex(x=>x&&x.source===src&&String(x.code||'')===code&&String(x.context||'')===ctx&&String(x.message||'').replace(/\[\d{4}-\d{2}-\d{2}T[^\]]+\]\s*/g,'').replace(/set at \/adminChatPresence\/[^ ]+/gi,'set at /adminChatPresence/{uid}')===normalizedMessage&&now-Number(x.time||0)<5*60*1000);
      if(matchIndex>=0){const prev=rows.splice(matchIndex,1)[0];prev.count=Number(prev.count||1)+1;prev.time=now;prev.message=message;rows.unshift(prev);writeErrorLog(rows);return;}
      rows.unshift({id:`e-${now}-${Math.random().toString(36).slice(2,7)}`,time:now,source:src,level:String(level||'error'),code,message,context:ctx,count:1});
      writeErrorLog(rows);
      if(document.getElementById('adminErrorList')) requestAnimationFrame(()=>renderErrorCenter());
    }catch{}
  }
  function errorLabel(src){return ({auth:'AUTH',firebase:'FIREBASE',sync:'SYNC',system:'SYSTEM'}[src]||String(src||'SYSTEM').toUpperCase());}
  function renderErrorCenter(){
    const box=document.getElementById('adminErrorList'); if(!box) return;
    updateErrorCenterToggleUI();
    const all=readErrorLog();
    const rows=errorCenterFilter==='all'?all:all.filter(x=>x.source===errorCenterFilter);
    const count=document.getElementById('adminErrorCount'); if(count)count.textContent=String(all.length);
    box.innerHTML=rows.length?rows.slice(0,80).map(x=>`<div class="admin-error-row ${escapeHtml(x.level||'error')}"><span class="admin-error-badge">${escapeHtml(errorLabel(x.source))}</span><div><b>${escapeHtml(x.code||x.message||'Ошибка')}</b><p>${escapeHtml(x.message||'—')}</p>${x.context?`<small>${escapeHtml(x.context)}</small>`:''}</div><time>${escapeHtml(fmtDate(Number(x.time||0),true))}${Number(x.count||1)>1?` • ×${Number(x.count)}`:''}</time></div>`).join(''):'<div class="notice">Ошибок пока нет. Новые ошибки Firebase, входа и синхронизации появятся здесь автоматически.</div>';
  }
  function exportErrorLog(){
    const blob=new Blob([JSON.stringify(readErrorLog(),null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`black-russia-error-log-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500);
  }
  const nativeConsoleError=console.error.bind(console);
  console.error=(...args)=>{nativeConsoleError(...args);reportAdminError(errorSourceFromText(args.map(x=>x?.message||x).join(' ')),args.find(x=>x instanceof Error)||args.map(x=>x?.message||x).join(' '),'error');};
  const nativeConsoleWarn=console.warn.bind(console);
  console.warn=(...args)=>{nativeConsoleWarn(...args);const text=args.map(x=>x?.message||x).join(' ');if(/adminChatPresence/i.test(text)&&/permission_denied|PERMISSION_DENIED/i.test(text))return;if(/firebase|auth|login|cloud|sync|database|permission|rules|maintenance/i.test(text))reportAdminError(errorSourceFromText(text),args.find(x=>x instanceof Error)||text,'warn');};
  window.addEventListener('error',e=>reportAdminError('system',e.error||e.message||'window.error','error',e.filename?`${e.filename}:${e.lineno||0}`:''));
  window.addEventListener('unhandledrejection',e=>reportAdminError(errorSourceFromText(e.reason?.message||e.reason||''),e.reason||'unhandled rejection','error','unhandledrejection'));

  // V9.5.4: collapse the old presence-error storm into one readable row.
  try{
    const compactKey='br78_errorlog_compacted_v954';
    if(localStorage.getItem(compactKey)!=='1'){
      const rows=readErrorLog(),kept=[];let presenceRow=null,presenceCount=0,presenceTime=0;
      for(const row of rows){
        const sig=`${row?.code||''} ${row?.message||''} ${row?.context||''}`;
        if(/adminChatPresence|admin presence|read admin presence/i.test(sig)&&/permission|denied/i.test(sig)){
          presenceCount+=Number(row?.count||1);presenceTime=Math.max(presenceTime,Number(row?.time||0));if(!presenceRow)presenceRow={...row};continue;
        }
        kept.push(row);
      }
      if(presenceRow){presenceRow.code='PRESENCE_PERMISSION_DENIED';presenceRow.message='Firebase Rules запрещали доступ к /adminChatPresence. Повторные одинаковые ошибки объединены.';presenceRow.context='live staff presence';presenceRow.count=Math.max(1,presenceCount);presenceRow.time=presenceTime||Date.now();kept.unshift(presenceRow);}
      writeErrorLog(kept);localStorage.setItem(compactKey,'1');
    }
  }catch{}

  let players = [];
  let deletedPlayers = [];
  let wealth = {};
  let history = readJSON(K.history, []);
  let meta = readJSON(K.meta, {});
  let draft = {};
  let playerFilter = 'all';
  let confirmAction = null;
  let authBusy = false;
  let editPlayerId = null;
  let pendingAvatar = '';
  let avatarCrop = {src:'', img:null, naturalW:0, naturalH:0, zoom:1, x:0, y:0, dirty:false};
  const avatarPointers = new Map();
  let avatarGesture = null;
  const ACHIEVEMENTS = {legend:{icon:'👑',label:'Легенда'},top:{icon:'🔥',label:'Топ игрок'},vip:{icon:'💎',label:'VIP'},veteran:{icon:'⭐',label:'Старожил'},newbie:{icon:'🚀',label:'Новичок'},founder:{icon:'🏛️',label:'Основатель'},developer:{icon:'🛠️',label:'Разработчик'},blogger:{icon:'🎥',label:'Блогер'},first_number:{icon:'🥇',label:'Первый номер',rare:true},breakthrough:{icon:'⚡',label:'Прорыв недели',rare:true},centurion:{icon:'💯',label:'100 дней',rare:true},veteran_rare:{icon:'🛡️',label:'Ветеран',rare:true},season_champion:{icon:'🏆',label:'Чемпион сезона',rare:true}};
  const DAY_MS = 24*60*60*1000;
  const NOTIFICATION_TTL = 2*DAY_MS;
  function notificationArray(v){ if(Array.isArray(v)) return v.filter(Boolean); if(v&&typeof v==='object') return Object.keys(v).map(k=>v[k]).filter(Boolean); return []; }
  function pruneGlobalNotifications(ts=Date.now()){
    const cutoff=ts-NOTIFICATION_TTL;
    meta.notifications=notificationArray(meta.notifications).filter(n=>Number(n?.time||0)>=cutoff).sort((a,b)=>Number(b.time||0)-Number(a.time||0)).slice(0,50);
  }
  function addGlobalNotification(type,title,text,icon='🔔',link='index.html',ts=Date.now()){
    pruneGlobalNotifications(ts);
    const cleanTitle=String(title||'Уведомление').slice(0,100), cleanText=String(text||'').slice(0,220);
    const duplicate=meta.notifications.find(n=>String(n?.type||'')===String(type||'info')&&String(n?.title||'')===cleanTitle&&String(n?.text||'')===cleanText&&Math.abs(Number(n?.time||0)-ts)<2500);
    if(duplicate) return;
    meta.notifications.unshift({id:`n-${ts}-${Math.random().toString(36).slice(2,8)}`,type:String(type||'info'),icon:String(icon||'🔔'),title:cleanTitle,text:cleanText,time:ts,link:String(link||'index.html')});
    meta.notifications=meta.notifications.slice(0,50);
  }
  function snapshotAchievementState(){ return new Map(players.map(p=>[p.id,new Set(combinedAchievementKeys(p))])); }
  function notifyAchievementChanges(before,ts=Date.now()){
    players.forEach(p=>{ const old=before.get(p.id)||new Set(); combinedAchievementKeys(p).forEach(k=>{ if(!old.has(k)){ const d=ACHIEVEMENTS[k]; if(d){ addGlobalNotification('achievement',`Новое достижение: ${d.label}`,`${p.nick} получил достижение «${d.label}».`,d.icon,`achievements.html#ach-${k}`,ts); publishForbesEvent({type:'achievement',playerId:p.id,nick:p.nick,achievementKey:k,achievementLabel:d.label,at:ts}); } } }); });
  }
  function notifyLeaderChange(previousLeaderId,ts=Date.now()){
    const leader=players[0]; if(!leader||!previousLeaderId||leader.id===previousLeaderId)return;
    addGlobalNotification('leader','Новый лидер рейтинга',`${leader.nick} теперь занимает место #1.`,'👑','index.html#podium',ts);
  }

  function adminTrendDelta(p, days=7){
    const epoch=Number(p?.achievementEpoch)||0;
    const cutoff=Math.max(Date.now()-days*DAY_MS,epoch);
    const events=(Array.isArray(p?.rankHistory)?p.rankHistory:[]).filter(h=>Number(h?.time)>=cutoff&&Number(h?.from)>0&&Number(h?.to)>0);
    if(epoch && !events.length) return 0;
    let baseline=Number(p?.rank)||0;
    [...events].sort((a,b)=>Number(b.time)-Number(a.time)).forEach(h=>{baseline=Number(h.from)||baseline;});
    return baseline-(Number(p?.rank)||baseline);
  }
  function autoAchievementKeys(p){
    const out=[];
    const epoch=Number(p?.achievementEpoch)||0;
    const ageBase=Math.max(Number(p?.createdAt)||Date.now(),epoch);
    const age=Date.now()-ageBase;
    const events=(Array.isArray(p?.rankHistory)?p.rankHistory:[]).filter(h=>Number(h?.time)>=epoch);
    const firstAfterReset=epoch ? events.some(h=>Number(h?.to)===1) : ((Number(p?.bestRank)||Number(p?.rank)||9999)<=1);
    if(firstAfterReset) out.push('first_number');
    if(adminTrendDelta(p,7)>=5) out.push('breakthrough');
    if(age>=100*DAY_MS) out.push('centurion');
    if(age>=30*DAY_MS) out.push('veteran_rare');
    return out;
  }
  const BUSINESS_TYPES={gas:['⛽','АЗС'],transport:['🚚','ТК — транспортная компания'],construction:['🏗️','СК — строительная компания'],weapon:['🔫','Магазин амуниции / оружия'],shop247:['🛒','Магазин 24/7'],accessories:['👜','Магазин аксессуаров'],clothes:['👕','Магазин одежды'],dealership:['🚘','Автосалон'],service:['🛠️','СТО'],taxi:['🚕','Таксопарк'],casino:['🎰','Казино'],snack:['🥤','Закусочная'],stall:['🌭','Ларёк'],tuning:['🏎️','Стайлинг-центр'],tire:['🛞','Шиномонтажный центр'],tech:['🔧','Технический центр'],nightclub:['🌙','Ночной клуб'],fishing:['🎣','Рыболовный магазин'],other:['🏢','Другое']};
  function normalizeBusinesses(v){return (Array.isArray(v)?v:[]).slice(0,20).map((b,i)=>({id:String(b?.id||`biz-${Date.now()}-${i}`),type:BUSINESS_TYPES[b?.type]?b.type:'other',number:String(b?.number||''),location:String(b?.location||''),name:String(b?.name||''),value:String(b?.value||''),main:!!b?.main}));}
  function normalizeProperties(v){return (Array.isArray(v)?v:[]).filter(x=>String(x?.kind||'house')!=='garage').slice(0,20).map((x,i)=>({id:String(x?.id||`prop-${Date.now()}-${i}`),kind:'house',number:String(x?.number||''),location:String(x?.location||''),note:String(x?.note||''),value:String(x?.value||''),main:!!x?.main}));}
  function normalizeGarages(v,legacyProperties=[]){
    const direct=Array.isArray(v)?v:[];
    const legacy=(Array.isArray(legacyProperties)?legacyProperties:[]).filter(x=>String(x?.kind||'')==='garage');
    const seen=new Set();
    return [...direct,...legacy].slice(0,20).map((x,i)=>({id:String(x?.id||`garage-${Date.now()}-${i}`),kind:'garage',number:String(x?.number||''),location:String(x?.location||''),capacity:String(x?.capacity||''),note:String(x?.note||''),value:String(x?.value||''),main:!!x?.main})).filter(x=>{const k=x.id||`${x.number}|${x.location}`;if(seen.has(k))return false;seen.add(k);return true;});
  }
  let editBusinesses=[];
  let editProperties=[];
  let editGarages=[];
  const collapsedBusinessIds=new Set();
  const collapsedPropertyIds=new Set();
  const collapsedGarageIds=new Set();
  let businessSectionCollapsed=false;
  let propertySectionCollapsed=false;
  let garageSectionCollapsed=false;
  function combinedAchievementKeys(p){ return [...new Set([...(Array.isArray(p?.achievements)?p.achievements:[]),...autoAchievementKeys(p)])].filter(x=>ACHIEVEMENTS[x]); }
  const achievementBadges = p => combinedAchievementKeys(p).map(x => `<span class="achievement-badge a-${x}${ACHIEVEMENTS[x].rare?' rare':''}">${ACHIEVEMENTS[x].icon} ${ACHIEVEMENTS[x].label}</span>`).join('');
  function avatarFrameClass(p) {
    const a = new Set(combinedAchievementKeys(p));
    for (const key of ['founder','developer','blogger','legend','top','vip','veteran','newbie']) if (a.has(key)) return `avatar-frame-${key}`;
    return '';
  }
  function playerInitials(p) {
    return (p?.nick || 'BR').split('_').slice(0,2).map(x => x[0] || '').join('').toUpperCase() || 'BR';
  }
  function adminAvatarHtml(p) {
    const src = safeAvatarSrc(p?.avatar);
    const frame = avatarFrameClass(p);
    return src
      ? `<span class="admin-player-avatar ${frame}"><img src="${escapeHtml(src)}" alt=""></span>`
      : `<span class="admin-player-avatar ${frame}">${escapeHtml(playerInitials(p))}</span>`;
  }


  // --- Firebase realtime sync ---
  const FB_CONFIG = window.BR_FIREBASE_CONFIG || null;
  const FB_ADMIN = window.BR_FIREBASE_ADMIN || {};
  let fbAuth = null;
  let fbDb = null;
  let cloudReady = false;
  let cloudApplying = false;
  let cloudTimer = null;
  let cloudPullTimer = null;
  let cloudListening = false;
  let statsLoadPromise = null;
  let lastForbesEventAt = 0;
  function publishForbesEvent(raw={}) {
    if (!fbDb || !fbAuth?.currentUser) return;
    const type=String(raw.type||'').slice(0,24);
    const playerId=String(raw.playerId||'').slice(0,160);
    const nick=String(raw.nick||'Игрок').slice(0,64);
    if(!type||!playerId) return;
    const requested=Number(raw.at)||Date.now();
    const at=Math.max(requested,lastForbesEventAt+1); lastForbesEventAt=at;
    const payload={type,playerId,nick,at};
    ['oldRank','newRank'].forEach(k=>{const n=Number(raw[k]);if(Number.isFinite(n)&&n>0)payload[k]=n;});
    ['oldValue','newValue','achievementKey','achievementLabel','text'].forEach(k=>{const v=String(raw[k]??'').trim();if(v)payload[k]=v.slice(0,k==='text'?220:100);});
    fbDb.ref('forbesEvents').push(payload).catch(e=>console.warn('Forbes event write skipped',e?.code||e?.message||e));
  }

  // --- Permission-based admin access (V8.8 RBAC) ---
  const OWNER_UID = String(FB_ADMIN.uid || '6EBZp2WqNsaPscVkdPMso1q6uTg1');
  const PERMISSION_DEFS = [
    {id:'dashboard',label:'Главная',icon:'⌂',view:'dashboard'},
    {id:'players_view',label:'Игроки: просмотр',icon:'👁',view:'players'},
    {id:'players_edit',label:'Игроки: добавление и редактирование',icon:'✏️'},
    {id:'players_delete',label:'Игроки: удаление и восстановление',icon:'🗑️'},
    {id:'admins',label:'Администрация',icon:'🛡️',view:'admins'},
    {id:'leaders',label:'Лидеры',icon:'★',view:'leaders'},
    {id:'history',label:'История действий',icon:'↺',view:'history'},
    {id:'stats',label:'Статистика',icon:'▥',view:'stats'},
    {id:'settings',label:'Настройки сайта',icon:'⚙️',view:'settings'},
    {id:'events',label:'События сайта',icon:'✦',view:'events'},
    {id:'chat',label:'Чат администрации',icon:'✉',view:'chat'},
    {id:'support',label:'Поддержка пользователей',icon:'🎫',view:'support'},
    {id:'community_chat',label:'Forbes Chat: просмотр и модерация',icon:'💬'},
    {id:'forbes_requests',label:'Заявки Forbes / изменения',icon:'▤'},
    {id:'vk_contacts',label:'VK контакты: владелец и тех.',icon:'VK'},
    {id:'forbes_events',label:'Лента событий Forbes',icon:'🔥'},
    {id:'cleanup',label:'Чистка',icon:'✦',view:'cleanup'},
    {id:'system',label:'Система',icon:'◈',view:'system'},
    {id:'access_manage',label:'Управление доступами',icon:'🔐'}
  ];
  const ALL_PERMISSION_IDS = PERMISSION_DEFS.map(x=>x.id);
  const ROLE_DEFAULT_PERMISSIONS = {
    owner:ALL_PERMISSION_IDS,
    player_manager:['dashboard','players_view','players_edit','chat','support','community_chat','forbes_requests','forbes_events'],
    ga:['dashboard','admins','leaders','chat','support','community_chat','forbes_requests','forbes_events'],
    custom:[]
  };
  const ACCESS_ROLES = {
    owner:{label:'Владелец'},
    player_manager:{label:'Редактор игроков'},
    ga:{label:'ГА / руководство'},
    custom:{label:'Индивидуальная роль'}
  };
  const VIEW_PERMISSION = Object.fromEntries(PERMISSION_DEFS.filter(x=>x.view).map(x=>[x.view,x.id]));
  let accessProfile = {role:'guest',label:'Гость',uid:'',alias:'',permissions:[],readOnly:false};
  let historyMode='all';
  function adminActor(){return String(accessProfile.alias||accessProfile.label||'Система').slice(0,64);}
  function auditAdminAction(action,target='',details=''){const now=Date.now();history.unshift({time:now,nick:String(target||'Система').slice(0,80),actor:adminActor(),category:'admin',action:String(action||'Действие').slice(0,100),old:String(action||'Действие').slice(0,120),new:String(details||target||'Выполнено').slice(0,180)});saveJSON(K.history,history);}

  function compactBrowserName(){
    const ua=navigator.userAgent||'';
    if(/Edg\//.test(ua))return 'Edge';
    if(/OPR\//.test(ua))return 'Opera';
    if(/YaBrowser\//.test(ua))return 'Yandex';
    if(/Firefox\//.test(ua))return 'Firefox';
    if(/Chrome\//.test(ua))return 'Chrome';
    if(/Safari\//.test(ua))return 'Safari';
    return 'Browser';
  }
  async function writeAdminLoginLog(status='success'){
    const user=fbAuth?.currentUser;if(!user||!fbDb)return;
    const rec={uid:user.uid,alias:String(accessProfile.alias||user.email||'Сотрудник').slice(0,64),role:String(accessProfile.label||accessProfile.role||'Доступ').slice(0,64),status:String(status||'success').slice(0,24),at:Date.now(),browser:compactBrowserName(),device:/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent||'')?'Мобильное':'ПК'};
    try{await fbDb.ref('adminLoginLogs').push(rec);}catch(e){console.warn('Login log write skipped',e?.code||e?.message||e);}
    try{await fbDb.ref(`staffActivity/${user.uid}`).update({lastLoginAt:rec.at,alias:rec.alias,role:rec.role});}catch(e){console.warn('Staff activity write skipped',e?.code||e?.message||e);}
  }
  function renderAdminLoginLogs(rows=[]){
    const box=$('#adminLoginLogList');if(!box)return;
    if(!rows.length){box.innerHTML='<div class="notice">Записей входа пока нет.</div>';return;}
    box.innerHTML=rows.slice(0,40).map(r=>`<div class="admin-login-log-row"><span class="login-log-dot ${r.status==='success'?'ok':'bad'}"></span><div><b>${escapeHtml(r.alias||'Сотрудник')}</b><small>${escapeHtml(r.role||'Доступ')} • ${escapeHtml(r.browser||'Browser')} • ${escapeHtml(r.device||'Устройство')}</small></div><time>${escapeHtml(fmtDate(Number(r.at||0)))}</time></div>`).join('');
  }
  async function loadAdminLoginLogs(){
    if(!canManageAccess()||!fbDb)return;
    const box=$('#adminLoginLogList');if(box)box.innerHTML='<div class="notice">Загрузка журнала…</div>';
    try{const snap=await withTimeout(fbDb.ref('adminLoginLogs').orderByChild('at').limitToLast(40).once('value'),7000,'LOGIN_LOG_TIMEOUT');const v=snap.val()||{};const rows=Object.values(v).filter(Boolean).sort((a,b)=>Number(b.at||0)-Number(a.at||0));renderAdminLoginLogs(rows);}catch(e){if(box)box.innerHTML='<div class="notice">Не удалось загрузить журнал. Проверь Firebase Rules V9.5.</div>';console.warn('Login logs',e);}
  }

  function accessRole(){ return ACCESS_ROLES[accessProfile.role] ? accessProfile.role : 'guest'; }
  function normalizePermissions(raw, role='custom'){
    let list=[];
    if(Array.isArray(raw)) list=raw.map(String);
    else if(raw&&typeof raw==='object') list=Object.keys(raw).filter(k=>raw[k]);
    else list=[...(ROLE_DEFAULT_PERMISSIONS[role]||[])];
    const set=new Set(list.filter(x=>ALL_PERMISSION_IDS.includes(x)));
    if(set.has('players_edit')||set.has('players_delete')) set.add('players_view');
    if(set.has('access_manage')) set.add('system');
    return [...set];
  }
  function permissionObject(list){ return Object.fromEntries(normalizePermissions(list).map(x=>[x,true])); }
  function accessPermissions(){ return accessRole()==='owner' ? ALL_PERMISSION_IDS : normalizePermissions(accessProfile.permissions,accessRole()); }
  function canPermission(name){ return accessRole()==='owner' || accessPermissions().includes(String(name||'')); }
  function isReadOnlyAccess(){ return accessRole()!=='owner' && accessProfile.readOnly===true; }
  function canWritePermission(name){ return accessRole()==='owner' || (!isReadOnlyAccess() && accessPermissions().includes(String(name||''))); }
  function canAccessView(name){ name=String(name||''); if(name==='support') return canPermission('support')||canPermission('community_chat'); const perm=VIEW_PERMISSION[name]; return !!perm && canPermission(perm); }
  function firstAccessibleView(){ return ['dashboard','players','admins','leaders','history','stats','settings','events','chat','support','cleanup','system'].find(canAccessView) || 'dashboard'; }
  function isOwnerAccess(){ return accessRole()==='owner'; }
  function canManageAccess(){ return isOwnerAccess() || canWritePermission('access_manage'); }
  function staffLoginEmail(login){
    const raw=String(login||'').trim();
    if(!raw) return '';
    if(raw.includes('@')) return raw.toLowerCase();
    return `${slug(raw).replace(/_+/g,'_')}@staff.blackrussia-forbes.com`;
  }
  function staffLoginEmailCandidates(login){
    const raw=String(login||'').trim();
    if(!raw) return [];
    if(raw.includes('@')) return [raw.toLowerCase()];
    const current=staffLoginEmail(raw);
    const lower=raw.toLowerCase();
    const legacyKeepDots=`${lower.replace(/[^a-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,32)||'staff'}@staff.blackrussia-forbes.com`;
    const legacyFlat=`${lower.replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,32)||'staff'}@staff.blackrussia-forbes.com`;
    return [...new Set([current,legacyKeepDots,legacyFlat].filter(Boolean))];
  }
  function staffDirectoryKey(email){
    return String(email||'').trim().toLowerCase().replace(/[^a-z0-9_-]+/g,'_').slice(0,120)||'staff';
  }
  async function lookupStaffIdentity(email){
    if(!fbDb||!email)return null;
    const key=staffDirectoryKey(email);
    try{
      const dir=await fbDb.ref(`staffDirectory/${key}`).once('value');
      const dv=dir.val()||{};
      if(dv.uid) return {uid:String(dv.uid),source:'directory',record:dv};
    }catch(e){console.warn('Staff directory lookup skipped',e?.code||e?.message||e);}
    try{
      const all=await fbDb.ref('adminUsers').once('value');
      let found=null;
      all.forEach(c=>{const v=c.val()||{};if(!found&&String(v.email||'').toLowerCase()===String(email).toLowerCase())found={uid:c.key,source:'adminUsers',record:v};});
      return found;
    }catch(e){console.warn('Staff adminUsers lookup failed',e?.code||e?.message||e);return null;}
  }

  async function loadAccessProfile(user){
    if(!user) throw new Error('ACCESS_NO_USER');
    if(OWNER_UID && user.uid===OWNER_UID){
      accessProfile={role:'owner',label:ACCESS_ROLES.owner.label,uid:user.uid,alias:'Calypso_Person',permissions:ALL_PERMISSION_IDS,readOnly:false};
      sessionSet('br78_admin_role_v85','owner');
      return accessProfile;
    }
    if(!fbDb) throw new Error('ACCESS_DB_NOT_READY');
    try{
      const lockSnap=await fbDb.ref('adminControls/staffLockdown').once('value');
      if(lockSnap.val()===true) throw new Error('ACCESS_EMERGENCY_LOCK');
    }catch(lockErr){
      if(String(lockErr?.message||'').includes('ACCESS_EMERGENCY_LOCK')) throw lockErr;
      console.warn('Staff lockdown check skipped',lockErr?.code||lockErr?.message||lockErr);
    }
    let snap;
    try{
      snap=await fbDb.ref(`adminUsers/${user.uid}`).once('value');
    }catch(err){
      const code=String(err?.code||'');
      if(code==='PERMISSION_DENIED'||/permission/i.test(String(err?.message||''))) throw new Error('ACCESS_RULES_DENIED');
      throw err;
    }
    const cfg=snap.val()||{};
    const role=String(cfg.role||'custom');
    if(cfg.active===false || role==='owner') throw new Error('ACCESS_DENIED');
    const permissions=normalizePermissions(cfg.permissions,role);
    if(!permissions.length) throw new Error('ACCESS_DENIED');
    const label=String(cfg.roleLabel||ACCESS_ROLES[role]?.label||'Индивидуальная роль').slice(0,48);
    accessProfile={role:ACCESS_ROLES[role]?role:'custom',label,uid:user.uid,alias:String(cfg.alias||user.email||'Сотрудник'),permissions,readOnly:cfg.readOnly===true};
    sessionSet('br78_admin_role_v85',accessProfile.role);
    return accessProfile;
  }
  function applyAccessUI(){
    const role=accessRole();
    document.body.dataset.adminRole=role;
    document.body.classList.toggle('admin-readonly',isReadOnlyAccess());
    document.querySelectorAll('.nav-btn[data-view]').forEach(btn=>{ btn.hidden=!canAccessView(btn.dataset.view); });
    document.querySelectorAll('[data-owner-only]').forEach(el=>{ el.hidden=!canManageAccess(); });
    const badge=document.getElementById('accessRoleBadge');
    if(badge){badge.textContent=accessProfile.label||'Доступ';badge.dataset.role=role;}
    const canEditPlayers=canWritePermission('players_edit');
    const saveTop=document.getElementById('saveAllTop');
    if(saveTop) saveTop.hidden=!canEditPlayers;
    ['addPlayerBtn','saveAllBtn','saveAllBottom','discardBtn'].forEach(id=>{const el=document.getElementById(id);if(el)el.disabled=!canEditPlayers;});
    const crud=document.querySelector('.crud-box'); if(crud)crud.classList.toggle('permission-locked',!canEditPlayers);
    const dangerousOwnerOnly=['clearHistoryBtn','clearStatsBtn','logoutAllBtn','clearAllDynamicsBtn','pruneDynamicsBtn','clearAmountsBtn','factoryResetBtn','resetAllAchievementsBtn'];
    dangerousOwnerOnly.forEach(id=>{const el=document.getElementById(id);if(el)el.hidden=!isOwnerAccess();});
    const canVkContacts=canPermission('vk_contacts');
    ['siteSettingOwnerVk','siteSettingTechVk','systemOwnerVk','systemTechVk'].forEach(id=>{const el=document.getElementById(id);if(!el)return;const row=el.closest('label');if(row)row.hidden=!canVkContacts;el.disabled=!canWritePermission('vk_contacts');});const systemVkBtn=document.getElementById('systemSaveVkContactsBtn');if(systemVkBtn){systemVkBtn.hidden=!canVkContacts;systemVkBtn.disabled=!canWritePermission('vk_contacts');}const systemVkCard=document.getElementById('systemVkContactsCard');if(systemVkCard)systemVkCard.hidden=!canVkContacts;
    const clearForbesEvents=document.getElementById('clearForbesEventsBtn');
    if(clearForbesEvents) clearForbesEvents.hidden=!canPermission('forbes_events');
    window.BRAdminAccess={role,label:accessProfile.label,alias:accessProfile.alias,uid:accessProfile.uid,permissions:accessPermissions(),readOnly:isReadOnlyAccess(),canView:canAccessView,can:canPermission,canWrite:canWritePermission,isOwner:isOwnerAccess,canManageAccess};
    updateErrorCenterToggleUI();
  }

  function syncControlRuntimeStatus(){const off=document.documentElement.dataset.offline==='1',safe=document.documentElement.dataset.safeMode==='1';const od=document.getElementById('offlineProtectionDot'),sd=document.getElementById('safeModeDot');od?.classList.toggle('off',off);sd?.classList.toggle('off',!safe);const os=document.getElementById('offlineProtectionStatus');if(os)os.textContent=off?'Офлайн • используются локальные данные':'Онлайн • Firebase доступен';const ss=document.getElementById('safeModeStatus');if(ss)ss.textContent=safe?'Включён • максимум стабильности':'Выключен • обычный интерфейс';}
  window.addEventListener('online',syncControlRuntimeStatus,{passive:true});window.addEventListener('offline',syncControlRuntimeStatus,{passive:true});window.addEventListener('br-safe-mode-change',syncControlRuntimeStatus);setInterval(syncControlRuntimeStatus,15000);

  function setFirebaseDiag(message, ok = false) {
    const el = document.getElementById('firebaseDiag');
    if (!el) return;
    el.textContent = message;
    el.style.color = ok ? '#63e6a6' : '#7f8ca3';
  }

  if (FB_CONFIG && FB_CONFIG.projectId) {
    setFirebaseDiag(`Firebase: SDK загружается • ${FB_CONFIG.projectId}`);
  } else {
    setFirebaseDiag('Firebase: конфиг НЕ загружен');
  }

  function initFirebase() {
    if (fbAuth && fbDb) return true;
    if (!FB_CONFIG || !window.firebase) return false;
    try {
      if (!firebase.apps.length) firebase.initializeApp(FB_CONFIG);
      fbAuth = firebase.auth();
      fbDb = firebase.database();
      bindGlobalErrorCenterControl();
      setFirebaseDiag(`Firebase: подключён • ${FB_CONFIG.projectId}`, true);
      return true;
    } catch (err) {
      console.error('Firebase init error', err);
      setFirebaseDiag(`Firebase init error: ${err && err.code ? err.code : err && err.message ? err.message : 'unknown'}`);
      return false;
    }
  }

  function cloudArray(v) {
    if (Array.isArray(v)) return v.filter(Boolean);
    if (v && typeof v === 'object') {
      return Object.keys(v)
        .sort((a,b) => (Number(a) || 0) - (Number(b) || 0))
        .map(k => v[k])
        .filter(Boolean);
    }
    return [];
  }

  function playerForCloud(p) {
    return {
      id: p.id,
      nick: p.nick,
      name: p.name || '',
      vk: p.vk || '#',
      rank: Number(p.rank) || 0,
      createdAt: Number(p.createdAt) || Date.now(),
      bestRank: Number(p.bestRank) || Number(p.rank) || 0,
      ...(p.previousRank ? {previousRank:Number(p.previousRank)} : {}),
      ...(p.deletedAt ? {deletedAt:Number(p.deletedAt)} : {}),
      amount: String(wealth[p.id] || ''),
      achievements: Array.isArray(p.achievements) ? p.achievements : [],
      achievementEpoch: Number(p.achievementEpoch) || 0,
      avatar: String(p.avatar || ''),
      businesses: normalizeBusinesses(p.businesses),
      properties: normalizeProperties(p.properties),
      garages: normalizeGarages(p.garages,p.properties),
      transport: Math.max(0, Number(p.transport) || 0),
      rankHistory: Array.isArray(p.rankHistory) ? p.rankHistory.slice(0, 30) : []
    };
  }

  async function pushCloudState() {
    if (!cloudReady || !fbDb || cloudApplying) return;
    pruneGlobalNotifications();
    try {
      if(isOwnerAccess()){
        await Promise.all([
          fbDb.ref('players').set(players.map(playerForCloud)),
          fbDb.ref('deletedPlayers').set(deletedPlayers.map(playerForCloud)),
          fbDb.ref('history').set(history.slice(0, 1000)),
          fbDb.ref('settings').set({...meta, schemaVersion: 2, syncedAt: Date.now()})
        ]);
      }else{
        const writes=[];
        if(canWritePermission('players_edit')||canWritePermission('players_delete')){
          writes.push(fbDb.ref('players').set(players.map(playerForCloud)));
          writes.push(fbDb.ref('deletedPlayers').set(deletedPlayers.map(playerForCloud)));
          writes.push(fbDb.ref('history').set(history.slice(0,1000)));
        }
        if(canWritePermission('settings')||canWritePermission('events')){
          writes.push(fbDb.ref('settings').set({...meta,schemaVersion:2,syncedAt:Date.now()}));
        }else if(canWritePermission('admins')||canWritePermission('leaders')){
          writes.push(fbDb.ref('settings/directories').set(meta?.directories||{}));
        }
        if(writes.length) await Promise.all(writes);
      }
    } catch (err) {
      console.error('Firebase write error', err);
      showToast('Нет прав или ошибка синхронизации Firebase');
    }
  }

  function scheduleCloudSync() {
    if (!cloudReady || cloudApplying) return;
    clearTimeout(cloudTimer);
    cloudTimer = setTimeout(pushCloudState, 180);
  }

  async function pullCloudState(seedIfEmpty = false) {
    if (!fbDb) return;
    try {
      const [ps, ds, hs, ss] = await Promise.all([
        fbDb.ref('players').once('value'),
        fbDb.ref('deletedPlayers').once('value'),
        fbDb.ref('history').once('value'),
        fbDb.ref('settings').once('value')
      ]);

      if (!ps.exists()) {
        if (seedIfEmpty) await pushCloudState();
        return;
      }

      const activeRaw = cloudArray(ps.val());
      const deletedRaw = cloudArray(ds.val());
      const needsPlayerMigration = [...activeRaw,...deletedRaw].some(x => !Number(x?.createdAt) || !Number(x?.bestRank));
      const used = new Set();
      const nextWealth = {};
      [...activeRaw, ...deletedRaw].forEach(x => {
        const id = String(x?.id || '');
        const amount = String(x?.amount || '').trim();
        if (id && amount) nextWealth[id] = amount;
      });

      cloudApplying = true;
      players = normalizeRoster(activeRaw, used);
      deletedPlayers = normalizeRoster(deletedRaw, used).map(p => ({
        ...p,
        previousRank: Number(p.previousRank) || p.rank,
        deletedAt: Number(p.deletedAt) || Date.now()
      }));
      normalizeRanks();
      wealth = nextWealth;
      draft = {...wealth};
      history = cloudArray(hs.val());
      meta = ss.val() && typeof ss.val() === 'object' ? ss.val() : {};
      const autoRankChanges = autoRankEnabled() ? recalculateRankingByNetWorth(Date.now()) : 0;

      localStorage.setItem(PLAYER_KEY, JSON.stringify(players));
      localStorage.setItem(DELETED_KEY, JSON.stringify(deletedPlayers));
      if (K.wealth) localStorage.setItem(K.wealth, JSON.stringify(wealth));
      if (K.history) localStorage.setItem(K.history, JSON.stringify(history));
      try { if (K.meta) localStorage.setItem(K.meta, JSON.stringify(meta)); } catch {}
      cloudApplying = false;
      renderAll();
      enforceGlobalLogout();
      if (needsPlayerMigration || autoRankChanges) scheduleCloudSync();
    } catch (err) {
      cloudApplying = false;
      console.error('Firebase read error', err);
      showToast('Не удалось получить данные Firebase');
    }
  }

  function startCloudListeners() {
    if (!fbDb || cloudListening) return;
    cloudListening = true;
    ['players','deletedPlayers','history','settings'].forEach(path => {
      fbDb.ref(path).on('value', () => {
        if (!cloudReady || cloudApplying) return;
        clearTimeout(cloudPullTimer);
        cloudPullTimer = setTimeout(() => pullCloudState(false), 120);
      });
    });
  }

  const MAINTENANCE_INTERVAL_MS = 14 * 24 * 60 * 60 * 1000;
  const STALE_VISITOR_MS = 5 * 24 * 60 * 60 * 1000;
  async function runAutomaticMaintenance() {
    if (!fbDb || !cloudReady) return;
    try {
      const last = Number(meta?.maintenance?.lastCleanupAt || 0);
      const now = Date.now();
      if (last && now - last < MAINTENANCE_INTERVAL_MS) return;
      const [vSnap,pSnap] = await Promise.all([
        fbDb.ref('stats/visits').once('value'),
        fbDb.ref('stats/presence').once('value')
      ]);
      const latestByVisitor = new Map();
      const visitRows=[];
      vSnap.forEach(c=>{const v=c.val();if(!v||typeof v!=='object')return;const id=String(v.visitorId||v.sessionId||c.key||'');const ts=Number(v.ts||0);visitRows.push({key:c.key,id,ts});if(id)latestByVisitor.set(id,Math.max(ts,latestByVisitor.get(id)||0));});
      const cutoff=now-STALE_VISITOR_MS;
      const staleVisitors=new Set([...latestByVisitor.entries()].filter(([,ts])=>ts && ts<cutoff).map(([id])=>id));
      const updates={}; let removedVisits=0,removedPresence=0;
      visitRows.forEach(v=>{if(v.id&&staleVisitors.has(v.id)){updates[`stats/visits/${v.key}`]=null;removedVisits++;}});
      pSnap.forEach(c=>{const v=c.val();const lastSeen=Number(v?.lastSeen||0);if(!lastSeen||lastSeen<cutoff){updates[`stats/presence/${c.key}`]=null;removedPresence++;}});
      const maintenance={lastCleanupAt:now,removedVisits,removedPresence,staleAfterDays:5,intervalDays:14};
      updates['settings/maintenance']=maintenance;
      meta={...(meta||{}),maintenance};
      if(Object.keys(updates).length) await fbDb.ref().update(updates);
      try{localStorage.removeItem(DASH_STATS_CACHE_KEY)}catch{}
      console.info(`Auto maintenance: visits ${removedVisits}, presence ${removedPresence}`);
    } catch (err) {
      console.warn('Automatic maintenance skipped', err?.code||err?.message||err);
    }
  }

  async function activateCloud(seedIfEmpty = true) {
    if (!initFirebase()) throw new Error('Firebase SDK не загрузился');
    const user = fbAuth.currentUser;
    if (!user) throw new Error('Firebase пользователь не авторизован');
    if(accessRole()==='guest') await loadAccessProfile(user);
    cloudReady = true;
    await pullCloudState(seedIfEmpty && isOwnerAccess());
    startCloudListeners();
    if(isOwnerAccess()) runAutomaticMaintenance();
    applyAccessUI();
  }

  function waitForFirebaseUser(timeoutMs=5000) {
    if (!initFirebase()) return Promise.resolve(null);
    return new Promise(resolve => {
      let done=false;
      const finish=user=>{ if(done)return; done=true; clearTimeout(timer); try{off&&off();}catch{} resolve(user||null); };
      let off=null;
      const timer=setTimeout(()=>finish(fbAuth.currentUser||null),timeoutMs);
      try { off=fbAuth.onAuthStateChanged(user=>finish(user),()=>finish(null)); }
      catch { finish(fbAuth.currentUser||null); }
    });
  }

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  }
  function readArrayExact(key) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return null;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  function saveJSON(key, val) { try { if(key) localStorage.setItem(key, JSON.stringify(val)); } catch {} if (!cloudApplying) scheduleCloudSync(); }
  window.BRAdminGetMeta = () => meta;
  window.BRAdminSetMeta = patch => {
    meta = {...(meta||{}), ...(patch&&typeof patch==='object'?patch:{})};
    try { if (K.meta) localStorage.setItem(K.meta, JSON.stringify(meta)); } catch {}
    scheduleCloudSync();
    return meta;
  };
  function escapeHtml(v = '') {
    return String(v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  }
  function fmtDate(ts, short = false) {
    if (!ts) return '—';
    const o = short
      ? {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'}
      : {day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'};
    return new Intl.DateTimeFormat('ru-RU', o).format(new Date(ts));
  }
  function parseMoneyAmount(raw) {
    let s=String(raw??'').trim().toLowerCase().replace(/\u00a0/g,' ');
    if(!s) return null;
    s=s.replace(/₽|руб(?:\.|лей|ля)?/gi,'').trim();
    let mult=1;
    const unit=(s.match(/(ккк|kkk|млрд(?:\.|а|ов)?|миллиард(?:а|ов)?|кк|kk|млн(?:\.|а|ов)?|миллион(?:а|ов)?|к|k|тыс(?:\.|яч(?:а|и)?)?)\s*$/i)||[])[1]||'';
    if(unit){
      const u=unit.toLowerCase();
      if(/^(ккк|kkk|млрд|миллиард)/.test(u)) mult=1e9;
      else if(/^(кк|kk|млн|миллион)/.test(u)) mult=1e6;
      else if(/^(к|k|тыс)/.test(u)) mult=1e3;
      s=s.slice(0,s.length-unit.length).trim();
    }
    s=s.replace(/\s+/g,'').replace(',','.');
    if(!/^[-+]?\d+(?:\.\d+)?$/.test(s)) return null;
    const n=Number(s)*mult;
    return Number.isFinite(n)?n:null;
  }
  function compactMoney(raw) {
    const n=parseMoneyAmount(raw); if(n===null) return String(raw??'').trim();
    const a=Math.abs(n); let div=1, unit='';
    if(a>=1e12){div=1e12;unit='трлн';}
    else if(a>=1e9){div=1e9;unit='млрд';}
    else if(a>=1e6){div=1e6;unit='млн';}
    else if(a>=1e3){div=1e3;unit='тыс.';}
    const value=n/div;
    const maxFrac = Math.abs(value)>=100 ? 0 : Math.abs(value)>=10 ? 1 : 2;
    const text=new Intl.NumberFormat('ru-RU',{maximumFractionDigits:maxFrac,minimumFractionDigits:0}).format(value);
    return unit?`${text} ${unit}`:new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0}).format(n);
  }
  function normalizeMoneyInput(raw){const v=String(raw??'').trim();return v?compactMoney(v):'';}
  function assetValuesTotal(p){
    const biz=normalizeBusinesses(p?.businesses).reduce((sum,b)=>sum+(parseMoneyAmount(b.value)||0),0);
    const homes=normalizeProperties(p?.properties).reduce((sum,x)=>sum+(parseMoneyAmount(x.value)||0),0);
    const garages=normalizeGarages(p?.garages,p?.properties).reduce((sum,x)=>sum+(parseMoneyAmount(x.value)||0),0);
    return biz+homes+garages;
  }
  function playerNetWorth(p, obj=wealth){ return Math.max(0,(parseMoneyAmount(obj?.[p.id])||0)+assetValuesTotal(p)); }
  function autoRankEnabled(){ return meta?.autoRankByNetWorth !== false; }
  function recalculateRankingByNetWorth(time=Date.now()){
    if(!autoRankEnabled()) return 0;
    const beforeRanks=snapshotRanks();
    const beforeAchievements=snapshotAchievementState();
    const beforeLeader=players[0]?.id||'';
    const stable=new Map(players.map((p,i)=>[p.id,i]));
    players.sort((a,b)=>{const d=playerNetWorth(b)-playerNetWorth(a);return d||((stable.get(a.id)||0)-(stable.get(b.id)||0));});
    normalizeRanks();
    recordRankChanges(beforeRanks,time);
    notifyAchievementChanges(beforeAchievements,time);
    notifyLeaderChange(beforeLeader,time);
    return players.reduce((n,p)=>n+(Number(beforeRanks.get(p.id)||0)!==Number(p.rank)?1:0),0);
  }
  function playerValue(p, obj = draft) { return String(obj[p.id] || '').trim(); }
  function changedPlayerIds() {
    return players.filter(p => playerValue(p, draft) !== playerValue(p, wealth)).map(p => p.id);
  }
  function showToast(t) {
    const el = $('#toast');
    el.textContent = t;
    el.classList.add('show');
    clearTimeout(showToast.t);
    showToast.t = setTimeout(() => el.classList.remove('show'), 1800);
  }
  async function sha256(s) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  async function sha512(s) {
    const buf = await crypto.subtle.digest('SHA-512', new TextEncoder().encode(String(s)));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  function slug(v = '') {
    return String(v).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32) || 'player';
  }

  const baseIdByNick = new Map((window.BR_PLAYERS || []).map((p, i) => [p.nick, p.id || `base-${i + 1}`]));

  function normalizeRoster(arr, used = new Set()) {
    return (Array.isArray(arr) ? arr : []).map((p, i) => {
      let id = String(p?.id || '');
      if (!id) {
        const baseId = baseIdByNick.get(p?.nick);
        id = baseId && !used.has(baseId) ? baseId : `custom-${slug(p?.nick)}-${Date.now()}-${i}`;
      }
      while (used.has(id)) id = `${id}-x`;
      used.add(id);
      return {
        id,
        nick: String(p?.nick || `Player_${i + 1}`),
        name: String(p?.name || ''),
        vk: String(p?.vk || '#'),
        rank: i + 1,
        createdAt: Number(p?.createdAt) || Date.now(),
        bestRank: Number(p?.bestRank) > 0 ? Math.min(Number(p.bestRank), i + 1) : i + 1,
        previousRank: Number(p?.previousRank) || undefined,
        deletedAt: Number(p?.deletedAt) || undefined,
        achievements: Array.isArray(p?.achievements) ? [...new Set(p.achievements.filter(x => ACHIEVEMENTS[x]))] : [],
        achievementEpoch: Number(p?.achievementEpoch) || 0,
        avatar: String(p?.avatar || ''),
        businesses: normalizeBusinesses(p?.businesses),
        properties: normalizeProperties(p?.properties),
        garages: normalizeGarages(p?.garages,p?.properties),
        transport: Math.max(0, Number(p?.transport) || 0),
        rankHistory: Array.isArray(p?.rankHistory) ? p.rankHistory.slice(0, 30).map(h => ({time:Number(h?.time)||0,from:Number(h?.from)||0,to:Number(h?.to)||0})).filter(h=>h.time&&h.from&&h.to) : []
      };
    });
  }

  function loadRoster() {
    const storedActive = readArrayExact(PLAYER_KEY);
    const storedDeleted = readArrayExact(DELETED_KEY);
    const used = new Set();

    if (storedActive !== null) {
      players = normalizeRoster(storedActive, used);
      deletedPlayers = normalizeRoster(storedDeleted || [], used).map(p => ({
        ...p,
        previousRank: Number(p.previousRank) || p.rank,
        deletedAt: Number(p.deletedAt) || Date.now()
      }));
      normalizeRanks();
      return;
    }

    const legacyOrder = readArrayExact(LEGACY_ORDER_KEY);
    const legacyCustom = readArrayExact(LEGACY_CUSTOM_KEY) || [];
    const source = legacyOrder && legacyOrder.length
      ? legacyOrder
      : [...(window.BR_PLAYERS || []), ...legacyCustom];

    players = normalizeRoster(source, used);
    deletedPlayers = [];
    normalizeRanks();
    persistRoster();
  }

  function normalizeRanks() {
    players.forEach((p, i) => { p.rank = i + 1; p.bestRank = Number(p.bestRank)>0 ? Math.min(Number(p.bestRank), p.rank) : p.rank; p.createdAt = Number(p.createdAt)||Date.now(); });
  }

  function recordRankHistory(p, from, to, time = Date.now()) {
    from = Number(from); to = Number(to);
    if (!p || !from || !to || from === to) return;
    const list = Array.isArray(p.rankHistory) ? p.rankHistory : [];
    const last = list[0];
    if (last && Number(last.from) === from && Number(last.to) === to && Math.abs(Number(last.time||0)-time) < 1500) return;
    list.unshift({time:Number(time)||Date.now(), from, to});
    p.rankHistory = list.slice(0, 30);
  }

  function snapshotRanks() {
    return new Map(players.map(p => [p.id, Number(p.rank)||0]));
  }

  function recordRankChanges(before, time = Date.now()) {
    players.forEach(p => {
      const oldRank = Number(before.get(p.id)||0);
      const newRank = Number(p.rank)||0;
      if (oldRank && newRank && oldRank !== newRank) {
        recordRankHistory(p, oldRank, newRank, time);
        publishForbesEvent({type:'rank',playerId:p.id,nick:p.nick,oldRank,newRank,at:time});
      }
    });
  }

  function persistRoster() {
    normalizeRanks();
    saveJSON(PLAYER_KEY, players);
    saveJSON(DELETED_KEY, deletedPlayers);
  }

  function migrateWealth(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const next = {};
    const all = [...players, ...deletedPlayers];

    all.forEach(p => {
      const byId = source[p.id];
      const byRank = source[String(p.rank)] ?? source[p.rank];
      const v = byId !== undefined ? byId : byRank;
      if (String(v ?? '').trim()) next[p.id] = String(v).trim();
    });

    Object.keys(source).forEach(k => {
      if (!/^\d+$/.test(k) && !Object.prototype.hasOwnProperty.call(next, k) && String(source[k] ?? '').trim()) {
        next[k] = source[k];
      }
    });

    if (JSON.stringify(next) !== JSON.stringify(source)) saveJSON(K.wealth, next);
    return next;
  }

  loadRoster();
  wealth = migrateWealth(readJSON(K.wealth, {}));
  draft = {...wealth};

  function showAdmin() {
    $('#loginScreen').classList.add('hidden');
    const app=$('#adminApp');
    app.style.removeProperty('display');
    app.removeAttribute('data-auth-locked');
    app.classList.remove('hidden');
    renderAll();
  }
  function showLogin() {
    const app=$('#adminApp');
    app.classList.add('hidden');
    app.setAttribute('data-auth-locked','true');
    app.style.setProperty('display','none','important');
    $('#loginScreen').classList.remove('hidden');
    authBusy=false;
    const b=$('#loginForm button[type="submit"]');if(b){b.disabled=false;b.textContent=b.dataset.oldText||'Войти в админ-панель';}
  }
  function isSession() { return sessionGet(K.session) === '1'; }

  async function setBestAuthPersistence(){
    const modes=[firebase.auth.Auth.Persistence.SESSION,firebase.auth.Auth.Persistence.NONE];
    for(const mode of modes){
      try { await withTimeout(fbAuth.setPersistence(mode),3500,'AUTH_PERSISTENCE_TIMEOUT'); return mode; }
      catch(err){ console.warn('Auth persistence mode unavailable',err?.code||err?.message||err); }
    }
    return null;
  }

  // Owner route V9.4.2. The password is NEVER stored in the site.
  // The routing identifiers are intentionally obfuscated so the plain owner login/email
  // are not exposed as readable strings in the public GitHub source.
  function decodeOwnerRoute(value){
    try{return atob(String(value||''));}catch{return '';}
  }
  function ownerEmailForLogin(login){
    const normalized=String(login||'').trim().toLowerCase();
    if(!normalized) return '';

    // Obfuscated owner routing identifiers.
    const aliases=[
      'Y2FseXBzbw==',
      'Y2FseXBzb19wZXJzb24=',
      'Y2FseXBzby5wZXJzb24='
    ].map(decodeOwnerRoute);

    // Obfuscated Firebase Authentication owner email.
    const ownerEmail=decodeOwnerRoute('Y2FseXBzb0BibGFja3J1c3NpYS1mb3JiZXMuY29t').toLowerCase();
    if(aliases.includes(normalized) || normalized===ownerEmail) return ownerEmail;
    return '';
  }

  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    if(authBusy) return;
    const err=$('#loginError');
    const loginBtn=e.currentTarget.querySelector('button[type="submit"]');
    const u=String($('#loginUser')?.value||'').trim();
    const p=String($('#loginPass')?.value||'');
    if(err) err.textContent='';
    if(!u||!p){ if(err)err.textContent='Введите логин и пароль.'; return; }

    authBusy=true;
    if(loginBtn){loginBtn.disabled=true;loginBtn.dataset.oldText=loginBtn.textContent;loginBtn.textContent='Проверяю доступ…';}
    try{
      if(!initFirebase()) throw Object.assign(new Error('Firebase SDK не загрузился'),{code:'auth/sdk-not-ready'});
      await setBestAuthPersistence();
      const email=ownerEmailForLogin(u)||staffLoginEmail(u);
      if(!email) throw Object.assign(new Error('LOGIN_ROUTE_NOT_FOUND'),{code:'auth/invalid-credential'});

      setFirebaseDiag('Firebase: проверка логина…');
      // IMPORTANT: exactly one signIn request per button press.
      const cred=await withTimeout(fbAuth.signInWithEmailAndPassword(email,p),15000,'auth/login-timeout');
      await withTimeout(loadAccessProfile(cred.user),9000,'auth/access-timeout');

      sessionSet(K.session,'1');
      sessionStartedAt=Date.now();
      sessionSet('br78_admin_started_at_fb19',String(sessionStartedAt));
      applyAccessUI();
      showAdmin();
      goView(firstAccessibleView());
      setFirebaseDiag(`Firebase: ${accessProfile.label} • UID ${cred.user.uid.slice(0,8)}…`,true);

      try{
        await withTimeout(activateCloud(true),10000,'database/sync-timeout');
      }catch(syncErr){
        console.warn('Cloud sync unavailable after login',syncErr);
        setFirebaseDiag('Firebase: вход выполнен • синхронизация временно недоступна');
        showToast('Вход выполнен • временно используются локальные данные');
      }

      if(isOwnerAccess()){
        meta.security={...(meta.security||{}),lastLogin:sessionStartedAt,lastLoginDevice:navigator.userAgent.slice(0,180)};
        history.unshift({time:sessionStartedAt,nick:accessProfile.alias||'Владелец',actor:adminActor(),category:'admin',action:'Вход в админ-панель',old:'Безопасность',new:'Вход в админ-панель'});
        saveJSON(K.history,history); saveJSON(K.meta,meta);
      }
      applyAccessUI();
      showToast(`Вход выполнен • ${accessProfile.label}`);
      writeAdminLoginLog('success').catch(()=>{});
    }catch(firebaseErr){
      console.error('Firebase auth error:',firebaseErr);
      const code=String(firebaseErr?.code||'');
      const msg=String(firebaseErr?.message||'');
      const denied=msg.includes('ACCESS_DENIED');
      const rulesDenied=msg.includes('ACCESS_RULES_DENIED');
      const emergencyLocked=msg.includes('ACCESS_EMERGENCY_LOCK');
      // Clear a stale/denied cached Firebase session, but never retry sign-in automatically.
      if(denied||rulesDenied||emergencyLocked){ try{await fbAuth?.signOut();}catch{} }
      const messages={
        'auth/invalid-credential':'Неверный логин или пароль.',
        'auth/wrong-password':'Неверный логин или пароль.',
        'auth/user-not-found':'Неверный логин или пароль.',
        'auth/too-many-requests':'Firebase временно ограничил вход из-за большого числа прошлых попыток. Новая версия не повторяет запросы автоматически — не нажимай вход много раз подряд и попробуй позже.',
        'auth/network-request-failed':'Нет соединения с Firebase. Проверь интернет и VPN/блокировщики.',
        'auth/web-storage-unsupported':'Браузер блокирует хранилище. Разреши данные сайта или открой обычную вкладку.',
        'auth/operation-not-supported-in-this-environment':'Firebase Authentication ограничен в этом режиме браузера. Открой страницу напрямую по HTTPS.',
        'auth/login-timeout':'Firebase слишком долго отвечает. Запрос остановлен без повторной попытки.',
        'auth/access-timeout':'Вход выполнен, но Firebase не успел проверить права аккаунта.',
        'auth/sdk-not-ready':'Firebase SDK не загрузился. Проверь сеть или блокировщик скриптов.'
      };
      if(err){
        err.textContent=emergencyLocked
          ?'Владелец временно отключил вход всех сотрудников. Доступ будет доступен после снятия аварийного режима.'
          :rulesDenied
            ?'Firebase Rules не дают этому сотруднику прочитать собственные права. Обнови Realtime Database Rules из архива V9.6.0.'
            :denied
              ?'Аккаунт существует, но доступ к панели отключён или профиль прав отсутствует. Владелец может восстановить его в Система → Доступы панели.'
              :(messages[code]||'Не удалось войти в панель.');
      }
      setFirebaseDiag('Firebase: вход не выполнен');
    }finally{
      authBusy=false;
      if(loginBtn){loginBtn.disabled=false;loginBtn.textContent=loginBtn.dataset.oldText||'Войти в админ-панель';}
    }
  });

  $('#eyeBtn').addEventListener('click', () => {
    const p = $('#loginPass');
    p.type = p.type === 'password' ? 'text' : 'password';
  });
  $('#logoutBtn').addEventListener('click', async () => {
    sessionRemove(K.session);
    sessionRemove('br78_admin_role_v85');
    accessProfile={role:'guest',label:'Гость',uid:'',alias:'',permissions:[],readOnly:false};
    cloudReady = false;
    try { if (fbAuth) await fbAuth.signOut(); } catch {}
    showLogin();
    $('#loginPass').value = '';
  });

  const viewTitles = {dashboard:'Главная', players:'Игроки', admins:'Список администрации', leaders:'Список лидеров', history:'История', stats:'Статистика', settings:'Настройки', events:'События сайта', chat:'Чат администрации', support:'Поддержка', cleanup:'Чистка', system:'Система'};
  function goView(name) {
    if(!canAccessView(name)){ showToast('Для этого аккаунта раздел недоступен'); name=firstAccessibleView(); }
    $$('.view').forEach(v => v.classList.toggle('active', v.id === `view-${name}`));
    $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === name));
    $('#topTitle').textContent = viewTitles[name] || 'Admin';
    if (name === 'players') renderPlayers();
    if (name === 'history') renderHistory();
    if (name === 'dashboard') renderDashboard();
    if (name === 'stats') renderStats();
    if (name === 'settings' || name === 'events' || name === 'system') renderSiteSettingsForm();
    if((name==='system' || name==='cleanup') && canManageAccess()){
      // Let the System view paint first. Firebase reads run after the frame and cannot blank/freeze navigation.
      renderErrorCenter();
      requestAnimationFrame(()=>setTimeout(()=>{
        Promise.resolve(loadStaffAccessList()).catch(e=>reportAdminError('firebase',e,'warn','load staff access'));
        Promise.resolve(loadAdminLoginLogs()).catch(e=>reportAdminError('firebase',e,'warn','load login logs'));
        Promise.resolve(refreshProjectStatus()).catch(e=>reportAdminError('firebase',e,'warn','project status'));
      },0));
    }
  }
  $$('.nav-btn').forEach(b => b.addEventListener('click', () => goView(b.dataset.view)));
  $$('[data-go]').forEach(b => b.addEventListener('click', () => goView(b.dataset.go)));
  $('#autoRankToggle')?.addEventListener('change',e=>{
    if(!isOwnerAccess()){e.target.checked=autoRankEnabled();return showToast('Менять режим рейтинга может только владелец');}
    meta.autoRankByNetWorth=!!e.target.checked;
    const now=Date.now();
    if(meta.autoRankByNetWorth) recalculateRankingByNetWorth(now);
    meta.updatedAt=now; saveJSON(K.meta,meta); persistRoster(); renderAll();
    showToast(meta.autoRankByNetWorth?'Авторейтинг включён':'Авторейтинг отключён');
  });

  function renderDashboard() {
    const filled = players.filter(p => playerNetWorth(p, wealth)>0).length;
    const now = Date.now();
    const changes24 = history.filter(h => now - Number(h.time || 0) <= 24 * 60 * 60 * 1000).length;
    $('#kpiPlayers').textContent = players.length;
    $('#kpiFilled').textContent = filled;
    $('#kpiEmpty').textContent = players.length - filled;
    $('#kpiChanges').textContent = history.length;
    $('#dashChanges24').textContent = changes24;
    $('#summaryUpdated').textContent = fmtDate(meta.updatedAt);
    $('#summaryPercent').textContent = `${players.length ? Math.round(filled / players.length * 100) : 0}%`;

    const recent = history.slice(0, 6);
    $('#recentHistory').innerHTML = recent.length
      ? recent.map(h => `<div class="recent-row"><div><strong class="${h.playerId?'br-player-hover-target':''}" ${h.playerId?`data-player-id="${escapeHtml(h.playerId)}" data-player-nick="${escapeHtml(h.nick||'')}"`:''}>${escapeHtml(h.nick || 'Система')}</strong><p>${escapeHtml(h.old || '—')} → ${escapeHtml(h.new || '—')}</p></div><time>${fmtDate(h.time, true)}</time></div>`).join('')
      : '<div class="empty-state">Изменений пока нет.</div>';

    renderDashboardStats(false);
  }

  function debounce(fn,ms=140){let t=0;return (...args)=>{clearTimeout(t);t=setTimeout(()=>fn(...args),ms);};}
  function currentSearch() {
    return ($('#playerSearch')?.value || '').trim();
  }

  function visiblePlayers() {
    const q = currentSearch().toLocaleLowerCase('ru');
    return players.filter(p => {
      const achievementText = combinedAchievementKeys(p).map(x => `${x} ${ACHIEVEMENTS[x]?.label || ''}`).join(' ');
      const qok = !q || `${p.nick} ${p.name} ${p.vk || ''} ${achievementText}`.toLocaleLowerCase('ru').includes(q);
      const filled = playerNetWorth(p, draft)>0;
      const fok = playerFilter === 'filled' ? filled : playerFilter === 'empty' ? !filled : (ACHIEVEMENTS[playerFilter] ? combinedAchievementKeys(p).includes(playerFilter) : true);
      return qok && fok;
    });
  }

  function publishAdminMiniProfilePlayers(){
    const rows=players.map(p=>({...p,displayWealth:playerNetWorth(p,draft)>0?compactMoney(playerNetWorth(p,draft)):'Не указано'}));
    window.BR_MINIPROFILE_PLAYERS=rows;
    try{window.dispatchEvent(new CustomEvent('br:miniprofile-players',{detail:rows}));}catch{}
  }

  function renderPlayers() {
    publishAdminMiniProfilePlayers();
    const editAllowed=canWritePermission('players_edit');
    ['newNick','newName','newVk','addPlayerBtn','saveAllBtn','saveAllBottom'].forEach(id=>{const el=document.getElementById(id);if(el)el.disabled=!editAllowed;});
    const toggle=$('#autoRankToggle'); if(toggle){toggle.checked=autoRankEnabled();toggle.disabled=!isOwnerAccess();}
    const tip=$('.drag-tip'); if(tip) tip.textContent=autoRankEnabled()?'⚡ Авторейтинг включён: место считается по деньгам + бизнесам + домам + гаражам. Изменил капитал или имущество — Forbes перестроится автоматически.':'⋮⋮ Ручной режим: на ПК перетаскивай строки мышкой, на телефоне используй ↑ ↓.';
    const list = visiblePlayers();
    const changed = new Set(changedPlayerIds());
    const canEditPlayers = canWritePermission('players_edit');
    const canDeletePlayers = canWritePermission('players_delete');
    const canDrag = canEditPlayers && !autoRankEnabled() && playerFilter === 'all' && !currentSearch();

    $('#playersList').innerHTML = list.length
      ? list.map(p => `<div class="player-row ${canDrag ? '' : 'drag-disabled'}" draggable="${canDrag}" data-player-id="${escapeHtml(p.id)}">
          <div class="rank-drag">
            <span class="drag-handle" title="${autoRankEnabled() ? 'Место рассчитывается автоматически по состоянию' : (canDrag ? 'Перетащи игрока выше или ниже' : 'Очисти поиск и включи фильтр «Все», чтобы менять порядок')}">⋮⋮</span>
            <div class="rank-chip">#${p.rank}</div>
            <div class="move-buttons" aria-label="Изменить место">
              <button class="move-btn" type="button" data-move-player="${escapeHtml(p.id)}" data-move-dir="-1" title="Поднять выше" ${!canDrag || p.rank <= 1 ? 'disabled' : ''}>↑</button>
              <button class="move-btn" type="button" data-move-player="${escapeHtml(p.id)}" data-move-dir="1" title="Опустить ниже" ${!canDrag || p.rank >= players.length ? 'disabled' : ''}>↓</button>
            </div>
          </div>
          <div class="player-id admin-player-id">${adminAvatarHtml(p)}<div class="admin-player-copy"><strong class="br-player-hover-target" data-player-id="${escapeHtml(p.id)}" data-player-nick="${escapeHtml(p.nick)}">${escapeHtml(p.nick)}</strong><span>SERVER 78 • VLADIMIR</span><div class="achievement-line">${achievementBadges(p)}</div></div></div>
          <div class="player-name">${escapeHtml(p.name || '—')}</div>
          <div><input class="amount-input ${changed.has(p.id) ? 'changed' : ''}" data-amount-id="${escapeHtml(p.id)}" value="${escapeHtml(playerValue(p, draft))}" placeholder="Напр. 5 000 000 000 ₽" ${canEditPlayers?'':'disabled'}></div>
          <div class="row-actions">
            <button class="save-one" data-save-one="${escapeHtml(p.id)}" ${canEditPlayers&&changed.has(p.id) ? '' : 'disabled'} ${canEditPlayers?'':'hidden'}>Сохранить</button>
            <button class="row-btn edit" data-edit-player="${escapeHtml(p.id)}" ${canEditPlayers?'':'hidden'}>✏️ Редактировать</button>
            <button class="row-btn danger" data-delete-player="${escapeHtml(p.id)}" title="Удалить игрока" ${canDeletePlayers?'':'hidden'}>🗑️</button>
          </div>
        </div>`).join('')
      : '<div class="empty-state">Игроки не найдены.</div>';

    renderDeletedPlayers();
    bindAmountInputs();
    bindPlayerActions();
    bindDragDrop(canDrag);
    updateUnsaved();
  }

  function renderDeletedPlayers() {
    const panel = $('#deletedPanel');
    const list = $('#deletedPlayersList');
    const count = $('#deletedCount');
    if (!panel || !list || !count) return;

    count.textContent = deletedPlayers.length;
    panel.classList.toggle('hidden', deletedPlayers.length === 0);
    list.innerHTML = deletedPlayers.map(p => `<div class="deleted-row">
      <div><strong class="br-player-hover-target" data-player-id="${escapeHtml(p.id)}" data-player-nick="${escapeHtml(p.nick)}">${escapeHtml(p.nick)}</strong><span>${escapeHtml(p.name || 'Без имени')} • было место #${Number(p.previousRank) || '—'}</span></div>
      <time>${fmtDate(p.deletedAt, true)}</time>
      <button class="btn green" data-restore-player="${escapeHtml(p.id)}" ${canWritePermission('players_delete')?'':'hidden'}>↩ Восстановить</button>
    </div>`).join('');
  }

  function bindAmountInputs() {
    $$('[data-amount-id]').forEach(inp => {
      inp.addEventListener('input', e => {
        const id = e.target.dataset.amountId;
        const p = players.find(x => x.id === id);
        if (!p) return;
        const v = e.target.value.trim();
        if (v) draft[id] = v;
        else delete draft[id];
        const isChanged = playerValue(p, draft) !== playerValue(p, wealth);
        e.target.classList.toggle('changed', isChanged);
        const b = document.querySelector(`[data-save-one="${CSS.escape(id)}"]`);
        if (b) b.disabled = !isChanged;
        updateUnsaved();
      });
      inp.addEventListener('blur',e=>{
        const id=e.target.dataset.amountId,p=players.find(x=>x.id===id);if(!p)return;
        const formatted=normalizeMoneyInput(e.target.value);e.target.value=formatted;
        if(formatted)draft[id]=formatted;else delete draft[id];
        const changed=playerValue(p,draft)!==playerValue(p,wealth);e.target.classList.toggle('changed',changed);
        const b=document.querySelector(`[data-save-one="${CSS.escape(id)}"]`);if(b)b.disabled=!changed;updateUnsaved();
      });
    });

    $$('[data-save-one]').forEach(btn => btn.addEventListener('click', () => savePlayerValues([btn.dataset.saveOne])));
  }

  function bindPlayerActions() {
    $$('[data-edit-player]').forEach(btn => btn.addEventListener('click', () => openEditPlayer(btn.dataset.editPlayer)));
    $$('[data-delete-player]').forEach(btn => btn.addEventListener('click', () => {
      const p = players.find(x => x.id === btn.dataset.deletePlayer);
      if (!p) return;
      ask('Удалить игрока?', `${p.nick} будет перемещён в удалённые. Его можно будет восстановить.`, () => deletePlayer(p.id));
    }));
    $$('[data-restore-player]').forEach(btn => btn.addEventListener('click', () => restorePlayer(btn.dataset.restorePlayer)));
    $$('[data-move-player]').forEach(btn => btn.addEventListener('click', () => {
      if (btn.disabled) return;
      movePlayerByStep(btn.dataset.movePlayer, Number(btn.dataset.moveDir) || 0);
    }));
  }

  function movePlayerByStep(id, direction) {
    if(!canWritePermission('players_edit')) return showToast('Нет права на изменение рейтинга');
    if (!direction || playerFilter !== 'all' || currentSearch()) {
      showToast('Очисти поиск и включи фильтр «Все», чтобы менять порядок');
      return;
    }
    const from = players.findIndex(x => x.id === id);
    if (from < 0) return;
    const to = from + direction;
    if (to < 0 || to >= players.length) return;

    const notificationAchievementsBefore = snapshotAchievementState();
    const notificationLeaderBefore = players[0]?.id || '';
    const moved = players[from];
    const oldRank = moved.rank;
    const beforeRanks = snapshotRanks();
    const now = Date.now();
    [players[from], players[to]] = [players[to], players[from]];
    normalizeRanks();
    recordRankChanges(beforeRanks, now);
    notifyAchievementChanges(notificationAchievementsBefore, now);
    notifyLeaderChange(notificationLeaderBefore, now);
    persistRoster();
    meta.updatedAt = now;
    history.unshift({time:meta.updatedAt, nick:moved.nick, playerId:moved.id, old:`Место #${oldRank}`, new:`Место #${moved.rank}`});
    saveJSON(K.history, history);
    saveJSON(K.meta, meta);
    renderAll();
    showToast(`Порядок сохранён: ${moved.nick} → #${moved.rank}`);
  }

  function bindDragDrop(canDrag) {
    if (!canDrag) return;
    let draggedId = null;

    $$('.player-row').forEach(row => {
      row.addEventListener('dragstart', e => {
        draggedId = row.dataset.playerId;
        row.classList.add('dragging');
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', draggedId);
        }
      });

      row.addEventListener('dragend', () => {
        $$('.player-row').forEach(r => r.classList.remove('dragging', 'drop-target'));
        draggedId = null;
      });

      row.addEventListener('dragenter', e => {
        e.preventDefault();
        if (draggedId && row.dataset.playerId !== draggedId) row.classList.add('drop-target');
      });

      row.addEventListener('dragleave', () => row.classList.remove('drop-target'));
      row.addEventListener('dragover', e => {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      });

      row.addEventListener('drop', e => {
        e.preventDefault();
        row.classList.remove('drop-target');
        const sourceId = draggedId || e.dataTransfer?.getData('text/plain');
        const targetId = row.dataset.playerId;
        if (!sourceId || sourceId === targetId) return;

        const from = players.findIndex(x => x.id === sourceId);
        if (from < 0) return;
        const notificationAchievementsBefore = snapshotAchievementState();
        const notificationLeaderBefore = players[0]?.id || '';
        const oldRank = players[from].rank;
        const beforeRanks = snapshotRanks();
        const now = Date.now();
        const [moved] = players.splice(from, 1);
        const targetIndex = players.findIndex(x => x.id === targetId);
        players.splice(targetIndex < 0 ? players.length : targetIndex, 0, moved);
        normalizeRanks();

        const newRank = moved.rank;
        recordRankChanges(beforeRanks, now);
        notifyAchievementChanges(notificationAchievementsBefore, now);
        notifyLeaderChange(notificationLeaderBefore, now);
        persistRoster();
        meta.updatedAt = now;
        history.unshift({time:meta.updatedAt, nick:moved.nick, playerId:moved.id, old:`Место #${oldRank}`, new:`Место #${newRank}`});
        saveJSON(K.history, history);
        saveJSON(K.meta, meta);
        renderAll();
        showToast(`Порядок сохранён: ${moved.nick} → #${newRank}`);
      });
    });
  }

  function updateUnsaved() {
    const n = changedPlayerIds().length;
    $('#unsavedLabel').textContent = n ? `Несохранённых изменений: ${n}` : 'Нет несохранённых изменений';
  }

  function savePlayerValues(ids) {
    if(!canWritePermission('players_edit')) return showToast('Нет права на редактирование игроков');
    const now = Date.now();
    let count = 0;

    ids.forEach(id => {
      const p = players.find(x => x.id === id);
      if (!p) return;
      const old = playerValue(p, wealth);
      const oldNetWorth = playerNetWorth(p, wealth);
      const next = normalizeMoneyInput(playerValue(p, draft));
      if(next) draft[id]=next; else delete draft[id];
      if (old === next) return;

      if (next) wealth[id] = next;
      else delete wealth[id];

      history.unshift({time:now, nick:p.nick, playerId:p.id, rank:p.rank, old:old || 'Не указано', new:next || 'Не указано'});
      const newNetWorth = playerNetWorth(p, wealth);
      if(oldNetWorth!==newNetWorth) publishForbesEvent({type:'wealth',playerId:p.id,nick:p.nick,oldValue:compactMoney(oldNetWorth),newValue:compactMoney(newNetWorth),at:now});
      count++;
    });

    if (!count) return showToast('Изменений нет');
    const rankChanges=recalculateRankingByNetWorth(now);
    if(rankChanges){
      persistRoster();
      history.unshift({time:now,nick:'Система',old:'Авторейтинг Forbes',new:`Пересчитано мест: ${rankChanges}`});
    }
    meta.updatedAt = now;
    meta.updatedBy = accessProfile.alias || accessProfile.label || 'admin';
    saveJSON(K.wealth, wealth);
    saveJSON(K.history, history);
    saveJSON(K.meta, meta);
    draft = {...wealth};
    renderAll();
    showToast(count === 1 ? 'Изменение сохранено' : `Сохранено изменений: ${count}`);
  }

  function saveAll() { savePlayerValues(changedPlayerIds()); }
  ['#saveAllBtn', '#saveAllBottom', '#saveAllTop'].forEach(sel => $(sel).addEventListener('click', saveAll));
  $('#discardBtn').addEventListener('click', () => {
    draft = {...wealth};
    renderPlayers();
    showToast('Изменения отменены');
  });
  $('#playerSearch').addEventListener('input', debounce(renderPlayers,140));
  $$('[data-player-filter]').forEach(b => b.addEventListener('click', () => {
    playerFilter = b.dataset.playerFilter;
    $$('[data-player-filter]').forEach(x => x.classList.toggle('red', x === b));
    renderPlayers();
  }));
  $('#fillEmptyBtn').addEventListener('click', () => {
    playerFilter = 'empty';
    $$('[data-player-filter]').forEach(x => x.classList.toggle('red', x.dataset.playerFilter === 'empty'));
    renderPlayers();
  });

  function safeAvatarSrc(v = '') {
    const src = String(v || '').trim();
    return /^(data:image\/(png|jpe?g|webp);base64,|https:\/\/)/i.test(src) ? src : '';
  }

  function avatarStageSize() {
    const stage = $('#avatarCropStage');
    return Math.max(180, Math.round(stage?.getBoundingClientRect().width || 240));
  }

  function avatarCropSize() {
    const guide = $('.avatar-crop-guide');
    const rect = guide?.getBoundingClientRect();
    if (rect?.width) return Math.max(140, Math.round(rect.width));
    return Math.max(140, avatarStageSize() - 36);
  }

  function avatarMetrics() {
    const size = avatarCropSize();
    const nw = Math.max(1, avatarCrop.naturalW || 1);
    const nh = Math.max(1, avatarCrop.naturalH || 1);
    const base = Math.max(size / nw, size / nh);
    const scale = base * Math.max(1, Number(avatarCrop.zoom) || 1);
    return {size, nw, nh, base, scale, width:nw*scale, height:nh*scale};
  }


  function clampAvatarCrop() {
    if (!avatarCrop.img) return;
    const m = avatarMetrics();
    const maxX = Math.max(0, (m.width - m.size) / 2);
    const maxY = Math.max(0, (m.height - m.size) / 2);
    avatarCrop.x = Math.max(-maxX, Math.min(maxX, Number(avatarCrop.x) || 0));
    avatarCrop.y = Math.max(-maxY, Math.min(maxY, Number(avatarCrop.y) || 0));
  }

  function renderAvatarPreview() {
    const imgEl = $('#avatarCropImage');
    const initialsEl = $('#avatarCropInitials');
    const zoomEl = $('#avatarZoom');
    if (!imgEl || !initialsEl) return;
    if (zoomEl) zoomEl.value = String(Math.max(1, Math.min(3.5, Number(avatarCrop.zoom) || 1)));
    if (avatarCrop.img && avatarCrop.src) {
      clampAvatarCrop();
      const m = avatarMetrics();
      imgEl.src = avatarCrop.src;
      imgEl.style.display = 'block';
      imgEl.style.width = `${m.width}px`;
      imgEl.style.height = `${m.height}px`;
      imgEl.style.transform = `translate(-50%,-50%) translate(${avatarCrop.x}px,${avatarCrop.y}px)`;
      initialsEl.style.display = 'none';
    } else {
      imgEl.removeAttribute('src');
      imgEl.style.display = 'none';
      const p = players.find(x => x.id === editPlayerId);
      initialsEl.textContent = playerInitials(p);
      initialsEl.style.display = 'grid';
    }
  }

  function renderEditAvatarThumb() {
    const img = $('#editAvatarPreviewImage');
    const initials = $('#editAvatarPreviewInitials');
    const p = players.find(x => x.id === editPlayerId);
    if (!img || !initials) return;
    const src = safeAvatarSrc(pendingAvatar);
    if (src) {
      img.src = src;
      img.style.display = 'block';
      initials.style.display = 'none';
    } else {
      img.removeAttribute('src');
      img.style.display = 'none';
      initials.textContent = playerInitials(p);
      initials.style.display = 'grid';
    }
  }

  function openAvatarEditor() {
    loadAvatarIntoEditor(pendingAvatar, false).then(() => {
      $('#avatarEditorModal')?.classList.add('open');
    });
  }

  function closeAvatarEditor() {
    avatarPointers.clear();
    avatarGesture = null;
    $('#avatarEditorModal')?.classList.remove('open');
  }

  function loadAvatarIntoEditor(src, dirty = false) {
    return new Promise(resolve => {
      const safe = safeAvatarSrc(src);
      avatarCrop = {src:safe, img:null, naturalW:0, naturalH:0, zoom:1, x:0, y:0, dirty};
      if (!safe) { renderAvatarPreview(); return resolve(); }
      const img = new Image();
      if (/^https:\/\//i.test(safe)) img.crossOrigin = 'anonymous';
      img.onload = () => {
        avatarCrop.img = img;
        avatarCrop.naturalW = img.naturalWidth || img.width || 1;
        avatarCrop.naturalH = img.naturalHeight || img.height || 1;
        renderAvatarPreview();
        resolve();
      };
      img.onerror = () => { avatarCrop = {src:'',img:null,naturalW:0,naturalH:0,zoom:1,x:0,y:0,dirty:false}; renderAvatarPreview(); resolve(); };
      img.src = safe;
    });
  }

  function fileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith('image/')) return reject(new Error('Выбери изображение'));
      if (file.size > 15 * 1024 * 1024) return reject(new Error('Фото больше 15 МБ'));
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Не удалось прочитать фото'));
      reader.onload = () => resolve(String(reader.result || ''));
      reader.readAsDataURL(file);
    });
  }

  async function exportAvatarCrop() {
    if (!avatarCrop.img || !avatarCrop.src) return '';
    clampAvatarCrop();
    const m = avatarMetrics();
    const out = 360;
    const k = out / m.size;
    const canvas = document.createElement('canvas');
    canvas.width = out; canvas.height = out;
    const ctx = canvas.getContext('2d', {alpha:false});
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#0d1118';
    ctx.fillRect(0,0,out,out);
    const dw = m.width * k, dh = m.height * k;
    const dx = out/2 - dw/2 + avatarCrop.x*k;
    const dy = out/2 - dh/2 + avatarCrop.y*k;
    try {
      ctx.drawImage(avatarCrop.img, dx, dy, dw, dh);
    } catch {
      throw new Error('Не удалось обработать это фото. Выбери файл с устройства.');
    }
    let quality = .88;
    let data = canvas.toDataURL('image/jpeg', quality);
    while (data.length > 190000 && quality > .48) {
      quality -= .07;
      data = canvas.toDataURL('image/jpeg', quality);
    }
    return data;
  }

  $('#editAvatarFile')?.addEventListener('change', async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await fileAsDataURL(file);
      await loadAvatarIntoEditor(data, true);
      showToast('Фото загружено — настрой кадр и нажми «Сохранить фото»');
    } catch (err) {
      showToast(err?.message || 'Не удалось обработать фото');
    }
    e.target.value = '';
  });

  $('#avatarZoom')?.addEventListener('input', e => {
    if (!avatarCrop.img) return;
    avatarCrop.zoom = Math.max(1, Math.min(3.5, Number(e.target.value) || 1));
    avatarCrop.dirty = true;
    renderAvatarPreview();
  });

  $('#resetAvatarCropBtn')?.addEventListener('click', () => {
    if (!avatarCrop.img) return;
    avatarCrop.zoom = 1; avatarCrop.x = 0; avatarCrop.y = 0; avatarCrop.dirty = true;
    renderAvatarPreview();
  });

  $('#openAvatarEditorBtn')?.addEventListener('click', openAvatarEditor);
  $$('[data-avatar-close]').forEach(x => x.addEventListener('click', closeAvatarEditor));

  $('#applyAvatarCropBtn')?.addEventListener('click', async () => {
    if (!avatarCrop.img || !avatarCrop.src) {
      return showToast('Сначала выбери фотографию');
    }
    try {
      pendingAvatar = await exportAvatarCrop();
      avatarCrop.dirty = false;
      renderEditAvatarThumb();
    renderBusinessEditor();
      closeAvatarEditor();
      showToast('Кадр готов. Нажми «Сохранить игрока»');
    } catch (err) {
      showToast(err?.message || 'Не удалось сохранить кадр');
    }
  });

  $('#removeAvatarBtn')?.addEventListener('click', () => {
    pendingAvatar = '';
    avatarCrop = {src:'', img:null, naturalW:0, naturalH:0, zoom:1, x:0, y:0, dirty:false};
    renderEditAvatarThumb();
    showToast('Фото будет удалено после сохранения игрока');
  });

  const cropStage = $('#avatarCropStage');
  cropStage?.addEventListener('wheel', e => {
    if (!avatarCrop.img) return;
    e.preventDefault();
    avatarCrop.zoom = Math.max(1, Math.min(3.5, avatarCrop.zoom + (e.deltaY < 0 ? .08 : -.08)));
    avatarCrop.dirty = true;
    renderAvatarPreview();
  }, {passive:false});

  function pointDistance(a,b){ return Math.hypot(a.x-b.x,a.y-b.y); }
  cropStage?.addEventListener('pointerdown', e => {
    if (!avatarCrop.img) return;
    cropStage.setPointerCapture?.(e.pointerId);
    avatarPointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    const pts=[...avatarPointers.values()];
    if(pts.length===1){ avatarGesture={type:'drag',startX:pts[0].x,startY:pts[0].y,baseX:avatarCrop.x,baseY:avatarCrop.y}; }
    else if(pts.length>=2){ avatarGesture={type:'pinch',distance:Math.max(1,pointDistance(pts[0],pts[1])),zoom:avatarCrop.zoom}; }
  });
  cropStage?.addEventListener('pointermove', e => {
    if (!avatarPointers.has(e.pointerId) || !avatarCrop.img) return;
    avatarPointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    const pts=[...avatarPointers.values()];
    if(pts.length>=2){
      if(!avatarGesture || avatarGesture.type!=='pinch') avatarGesture={type:'pinch',distance:Math.max(1,pointDistance(pts[0],pts[1])),zoom:avatarCrop.zoom};
      avatarCrop.zoom=Math.max(1,Math.min(3.5,avatarGesture.zoom*pointDistance(pts[0],pts[1])/avatarGesture.distance));
    } else if(pts.length===1){
      if(!avatarGesture || avatarGesture.type!=='drag') avatarGesture={type:'drag',startX:pts[0].x,startY:pts[0].y,baseX:avatarCrop.x,baseY:avatarCrop.y};
      const nextX=avatarGesture.baseX+(pts[0].x-avatarGesture.startX);
      const nextY=avatarGesture.baseY+(pts[0].y-avatarGesture.startY);
      avatarCrop.x=nextX;
      avatarCrop.y=nextY;
    }
    avatarCrop.dirty=true;
    renderAvatarPreview();
  });
  const endAvatarPointer = e => {
    avatarPointers.delete(e.pointerId);
    const pts=[...avatarPointers.values()];
    if(pts.length===1) avatarGesture={type:'drag',startX:pts[0].x,startY:pts[0].y,baseX:avatarCrop.x,baseY:avatarCrop.y};
    else if(!pts.length) avatarGesture=null;
  };
  cropStage?.addEventListener('pointerup',endAvatarPointer);
  cropStage?.addEventListener('pointercancel',endAvatarPointer);

  function renderAchievementSelectionPreview() {
    const selected = $$('[data-achievement-edit]:checked').map(cb => cb.value).filter(k => ACHIEVEMENTS[k]);
    const preview = $('#achievementSelectionPreview');
    const button = $('#openAchievementPickerBtn');
    if (preview) {
      preview.innerHTML = selected.length
        ? selected.map(k => `<span class="achievement-badge a-${k}${ACHIEVEMENTS[k].rare?' rare':''}">${ACHIEVEMENTS[k].icon} ${ACHIEVEMENTS[k].label}</span>`).join('')
        : '<span>Достижения не выбраны</span>';
    }
    if (button) button.textContent = selected.length ? `🏅 Достижения (${selected.length})` : '🏅 Выбрать достижения';
  }

  function openAchievementPicker() {
    renderAchievementSelectionPreview();
    $('#achievementPickerModal')?.classList.add('open');
  }
  function closeAchievementPicker() {
    $('#achievementPickerModal')?.classList.remove('open');
  }

  function businessOptions(selected){return Object.entries(BUSINESS_TYPES).map(([k,v])=>`<option value="${k}"${k===selected?' selected':''}>${v[0]} ${v[1]}</option>`).join('');}
  const BUSINESS_CATALOG = Array.isArray(window.BR_BUSINESS_CATALOG) ? window.BR_BUSINESS_CATALOG : [];
  const PROPERTY_LOCATIONS = Array.isArray(window.BR_PROPERTY_LOCATIONS) ? window.BR_PROPERTY_LOCATIONS : [];
  function businessCatalogDisplay(x){return `${x.name||x.label}${x.number!==''?` #${x.number}`:''} — ${x.location||'локация не указана'}`;}
  function businessCatalogIcon(x){return (BUSINESS_TYPES[x?.type]||BUSINESS_TYPES.other)[0];}
  const BUSINESS_CATALOG_TYPES=[...new Set(BUSINESS_CATALOG.map(x=>x.type))];
  const businessPickerFilters=new Map();
  function businessPickerKey(i){return String(editBusinesses[i]?.id||i);}
  function getBusinessPickerFilter(i){
    const key=businessPickerKey(i);
    if(businessPickerFilters.has(key))return businessPickerFilters.get(key);
    const t=editBusinesses[i]?.type;
    return t&&t!=='other'?t:'all';
  }
  function setBusinessPickerFilter(i,type){businessPickerFilters.set(businessPickerKey(i),type||'all');}
  function businessCatalogMatches(q='',type='all'){
    const needle=String(q||'').trim().toLowerCase();
    let rows=BUSINESS_CATALOG.map((x,index)=>({x,index}));
    if(type&&type!=='all') rows=rows.filter(({x})=>x.type===type);
    if(!needle)return rows;
    return rows.filter(({x})=>[x.name,x.label,x.number,x.location,(BUSINESS_TYPES[x.type]||[])[1]].join(' ').toLowerCase().includes(needle));
  }
  function businessFilterBar(i,active){
    const count=t=>t==='all'?BUSINESS_CATALOG.length:BUSINESS_CATALOG.filter(x=>x.type===t).length;
    const buttons=['all',...BUSINESS_CATALOG_TYPES].map(t=>{const d=t==='all'?['▦','Все']:(BUSINESS_TYPES[t]||BUSINESS_TYPES.other);return `<button type="button" class="business-filter-chip${active===t?' active':''}" data-business-filter="${t}" data-business-filter-index="${i}">${d[0]} ${escapeHtml(d[1])}<small>${count(t)}</small></button>`;}).join('');
    return `<div class="business-picker-toolbar">${buttons}</div>`;
  }
  function renderBusinessPickerResults(input){
    const i=Number(input?.dataset?.businessSearch);if(!Number.isFinite(i))return;
    const menu=document.querySelector(`[data-business-results="${i}"]`);if(!menu)return;
    const filter=getBusinessPickerFilter(i),matches=businessCatalogMatches(input.value,filter);
    const totalLabel=filter==='all'?`${BUSINESS_CATALOG.length} бизнесов в каталоге`:`${matches.length} из ${BUSINESS_CATALOG.filter(x=>x.type===filter).length} в категории`;
    menu.innerHTML=businessFilterBar(i,filter)+`<div class="business-picker-count">${escapeHtml(totalLabel)}${input.value.trim()?` • поиск «${escapeHtml(input.value.trim())}»`:''}</div>`+(matches.length?matches.map(({x,index})=>`<button class="business-picker-option" type="button" data-business-pick="${i}" data-business-catalog-index="${index}"><span class="business-picker-icon">${businessCatalogIcon(x)}</span><span class="business-picker-copy"><b>${escapeHtml(x.name||x.label)}${x.number!==''?` <em>#${escapeHtml(x.number)}</em>`:''}</b><small>${escapeHtml(x.location||'Локация не указана')}</small></span><span class="business-picker-action">Выбрать</span></button>`).join(''):`<div class="business-picker-empty">Ничего не найдено в этой категории. Нажми «Все» или измени поиск.</div>`);
    menu.hidden=false;input.closest('.business-search-picker')?.classList.add('open');
  }
  function closeBusinessPickers(except=null){document.querySelectorAll('[data-business-results]').forEach(x=>{if(x!==except)x.hidden=true;});document.querySelectorAll('.business-search-picker').forEach(x=>{if(!except||!x.contains(except))x.classList.remove('open');});}
  function updateAssetEditorState(){
    const businessBadge=$('#businessCountBadge'), propertyBadge=$('#propertyCountBadge'), garageBadge=$('#garageCountBadge');
    if(businessBadge) businessBadge.textContent=String(editBusinesses.length);
    if(propertyBadge) propertyBadge.textContent=String(editProperties.length);
    if(garageBadge) garageBadge.textContent=String(editGarages.length);
    const bToggle=$('#toggleBusinessSectionBtn'), pToggle=$('#togglePropertySectionBtn'), gToggle=$('#toggleGarageSectionBtn');
    if(bToggle){bToggle.setAttribute('aria-expanded',String(!businessSectionCollapsed));const c=bToggle.querySelector('.asset-section-chevron');if(c)c.textContent=businessSectionCollapsed?'▸':'▾';}
    if(pToggle){pToggle.setAttribute('aria-expanded',String(!propertySectionCollapsed));const c=pToggle.querySelector('.asset-section-chevron');if(c)c.textContent=propertySectionCollapsed?'▸':'▾';}
    if(gToggle){gToggle.setAttribute('aria-expanded',String(!garageSectionCollapsed));const c=gToggle.querySelector('.asset-section-chevron');if(c)c.textContent=garageSectionCollapsed?'▸':'▾';}
    const bList=$('#businessEditorList'), pList=$('#propertyEditorList'), gList=$('#garageEditorList');
    if(bList)bList.hidden=businessSectionCollapsed;
    if(pList)pList.hidden=propertySectionCollapsed;
    if(gList)gList.hidden=garageSectionCollapsed;
    $('.business-editor')?.classList.toggle('is-collapsed',businessSectionCollapsed);
    $('.property-editor')?.classList.toggle('is-collapsed',propertySectionCollapsed);
    $('.garage-editor')?.classList.toggle('is-collapsed',garageSectionCollapsed);
  }
  function renderBusinessEditor(){
    const box=$('#businessEditorList'); if(!box)return;
    updateAssetEditorState();
    if(!editBusinesses.length){box.innerHTML='<div class="notice compact-notice">Бизнесов пока нет. Нажми «+ Добавить бизнес».</div>';return;}
    box.innerHTML=editBusinesses.map((b,i)=>{
      const t=BUSINESS_TYPES[b.type]||BUSINESS_TYPES.other;
      const matched=BUSINESS_CATALOG.find(x=>x.type===b.type&&String(x.number)===String(b.number)&&String(x.location)===String(b.location));
      const closed=collapsedBusinessIds.has(b.id);
      return `<div class="business-edit-row compact collapsible-editor-row${closed?' is-collapsed':''}" data-business-row="${i}" data-row-id="${escapeHtml(b.id)}"><div class="business-edit-row-head"><button class="editor-row-toggle" type="button" data-toggle-business="${i}" aria-expanded="${!closed}"><span class="editor-row-chevron">${closed?'▸':'▾'}</span><span class="editor-row-title"><b>${t[0]} ${escapeHtml(b.name||t[1])}${b.number?` #${escapeHtml(b.number)}`:''}</b><small>${escapeHtml(b.location||'Локация не выбрана')}</small></span></button><button class="btn danger compact-delete" type="button" data-remove-business="${i}">Удалить</button></div><div class="business-edit-grid compact-grid editor-row-body"${closed?' hidden':''}><label class="wide">Найти бизнес<div class="business-search-picker"><div class="business-search-control"><span>⌕</span><input class="input" data-business-search="${i}" value="${matched?escapeHtml(businessCatalogDisplay(matched)):''}" placeholder="АЗС, 24/7, №, город или локация…" autocomplete="off"><button type="button" data-clear-business-search="${i}" aria-label="Очистить поиск">×</button></div><div class="business-search-menu" data-business-results="${i}" hidden></div></div></label><label>Тип<select class="input" data-business-field="type" data-bi="${i}">${businessOptions(b.type)}</select></label><label>Номер / ID<input class="input" data-business-field="number" data-bi="${i}" value="${escapeHtml(b.number)}" placeholder="Напр. 14"></label><label class="wide">Локация<input class="input" data-business-field="location" data-bi="${i}" value="${escapeHtml(b.location)}" placeholder="Заполняется автоматически или вручную"></label><label class="wide">Стоимость для Forbes<input class="input" data-business-field="value" data-bi="${i}" value="${escapeHtml(b.value||'')}" placeholder="Напр. 850кк или 1.4ккк"><small class="field-hint">Добавляется к деньгам игрока при автоматическом расчёте места.</small></label><label class="wide business-toggle"><input type="checkbox" data-business-field="main" data-bi="${i}" ${b.main?'checked':''}> Основной бизнес игрока</label></div></div>`;
    }).join('');
  }
  $('#toggleBusinessSectionBtn')?.addEventListener('click',()=>{businessSectionCollapsed=!businessSectionCollapsed;updateAssetEditorState();});
  $('#addBusinessBtn')?.addEventListener('click',()=>{if(editBusinesses.length>=20)return showToast('Максимум 20 бизнесов на игрока');const b={id:`biz-${Date.now()}`,type:'other',number:'',location:'',name:'',value:'',main:false};editBusinesses.push(b);collapsedBusinessIds.delete(b.id);businessSectionCollapsed=false;renderBusinessEditor();});
  $('#businessEditorList')?.addEventListener('input',e=>{const search=e.target.closest('[data-business-search]');if(search){renderBusinessPickerResults(search);return;}const el=e.target.closest('[data-business-field]');if(!el)return;const i=Number(el.dataset.bi);const f=el.dataset.businessField;if(!editBusinesses[i]||f==='main')return;editBusinesses[i][f]=el.value;});
  $('#businessEditorList')?.addEventListener('change',e=>{
    const el=e.target.closest('[data-business-field]');if(!el)return;const i=Number(el.dataset.bi),f=el.dataset.businessField;if(!editBusinesses[i])return;if(f==='main'){if(el.checked)editBusinesses.forEach((b,j)=>b.main=j===i);else editBusinesses[i].main=false;renderBusinessEditor();}else {editBusinesses[i][f]=f==='value'?normalizeMoneyInput(el.value):el.value;if(f==='value')el.value=editBusinesses[i][f];if(f==='type'){setBusinessPickerFilter(i,el.value);editBusinesses[i].number='';editBusinesses[i].location='';editBusinesses[i].name='';renderBusinessEditor();const input=document.querySelector(`[data-business-search="${i}"]`);if(input){input.value='';renderBusinessPickerResults(input);}}}
  });
  $('#businessEditorList')?.addEventListener('click',e=>{
    const filterBtn=e.target.closest('[data-business-filter]');if(filterBtn){const i=Number(filterBtn.dataset.businessFilterIndex);setBusinessPickerFilter(i,filterBtn.dataset.businessFilter||'all');const input=document.querySelector(`[data-business-search="${i}"]`);if(input)renderBusinessPickerResults(input);return;}
    const pick=e.target.closest('[data-business-pick]');if(pick){const i=Number(pick.dataset.businessPick),x=BUSINESS_CATALOG[Number(pick.dataset.businessCatalogIndex)];if(x&&editBusinesses[i]){editBusinesses[i]={...editBusinesses[i],type:x.type,number:String(x.number||''),location:String(x.location||''),name:String(x.name||x.label||''),main:!!editBusinesses[i].main};setBusinessPickerFilter(i,x.type);renderBusinessEditor();}return;}
    const clear=e.target.closest('[data-clear-business-search]');if(clear){const input=document.querySelector(`[data-business-search="${Number(clear.dataset.clearBusinessSearch)}"]`);if(input){input.value='';input.focus();renderBusinessPickerResults(input);}return;}
    const search=e.target.closest('[data-business-search]');if(search){renderBusinessPickerResults(search);return;}
    const toggle=e.target.closest('[data-toggle-business]');if(toggle){const i=Number(toggle.dataset.toggleBusiness),id=editBusinesses[i]?.id;if(id){collapsedBusinessIds.has(id)?collapsedBusinessIds.delete(id):collapsedBusinessIds.add(id);renderBusinessEditor();}return;}
    const btn=e.target.closest('[data-remove-business]');if(!btn)return;const i=Number(btn.dataset.removeBusiness),id=editBusinesses[i]?.id;if(id)collapsedBusinessIds.delete(id);editBusinesses.splice(i,1);renderBusinessEditor();
  });
  document.addEventListener('click',e=>{if(!e.target.closest('.business-search-picker'))closeBusinessPickers();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeBusinessPickers();});


  function renderPropertyEditor(){
    const box=$('#propertyEditorList'); if(!box)return;
    updateAssetEditorState();
    if(!editProperties.length){box.innerHTML='<div class="notice compact-notice">Домов пока нет. Нажми «+ Добавить дом».</div>';return;}
    const locList=`<datalist id="property-locations">${PROPERTY_LOCATIONS.map(x=>`<option value="${escapeHtml(x)}"></option>`).join('')}</datalist>`;
    box.innerHTML=locList+editProperties.map((x,i)=>{const closed=collapsedPropertyIds.has(x.id);return `<div class="property-edit-row collapsible-editor-row${closed?' is-collapsed':''}" data-property-row="${i}" data-row-id="${escapeHtml(x.id)}"><div class="property-edit-row-head"><button class="editor-row-toggle" type="button" data-toggle-property="${i}" aria-expanded="${!closed}"><span class="editor-row-chevron">${closed?'▸':'▾'}</span><span class="editor-row-title"><b>🏠 Дом${x.number?` #${escapeHtml(x.number)}`:''}</b><small>${escapeHtml(x.location||'Локация не указана')}</small></span></button><button class="btn danger compact-delete" type="button" data-remove-property="${i}">Удалить</button></div><div class="property-edit-grid editor-row-body"${closed?' hidden':''}><label>Номер / ID<input class="input" data-property-field="number" data-pi="${i}" value="${escapeHtml(x.number)}" placeholder="Номер дома"></label><label>Локация<input class="input" list="property-locations" data-property-field="location" data-pi="${i}" value="${escapeHtml(x.location)}" placeholder="Начни вводить район или город"></label><label class="wide">Стоимость для Forbes<input class="input" data-property-field="value" data-pi="${i}" value="${escapeHtml(x.value||'')}" placeholder="Напр. 250 млн"><small class="field-hint">Учитывается вместе с деньгами, бизнесами и гаражами.</small></label><label class="wide">Заметка<input class="input" data-property-field="note" data-pi="${i}" value="${escapeHtml(x.note)}" placeholder="Необязательно"></label><label class="wide business-toggle"><input type="checkbox" data-property-field="main" data-pi="${i}" ${x.main?'checked':''}> Основной дом игрока</label></div></div>`}).join('');
  }
  $('#togglePropertySectionBtn')?.addEventListener('click',()=>{propertySectionCollapsed=!propertySectionCollapsed;updateAssetEditorState();});
  $('#addPropertyBtn')?.addEventListener('click',()=>{if(editProperties.length>=20)return showToast('Максимум 20 домов на игрока');const x={id:`prop-${Date.now()}`,kind:'house',number:'',location:'',note:'',value:'',main:false};editProperties.push(x);collapsedPropertyIds.delete(x.id);propertySectionCollapsed=false;renderPropertyEditor();});
  $('#propertyEditorList')?.addEventListener('input',e=>{const el=e.target.closest('[data-property-field]');if(!el)return;const i=Number(el.dataset.pi),f=el.dataset.propertyField;if(!editProperties[i]||f==='main')return;editProperties[i][f]=el.value;});
  $('#propertyEditorList')?.addEventListener('change',e=>{const el=e.target.closest('[data-property-field]');if(!el)return;const i=Number(el.dataset.pi),f=el.dataset.propertyField;if(!editProperties[i])return;if(f==='main'){if(el.checked)editProperties.forEach((x,j)=>x.main=j===i);else editProperties[i].main=false;renderPropertyEditor();}else{editProperties[i][f]=f==='value'?normalizeMoneyInput(el.value):el.value;if(f==='value')el.value=editProperties[i][f];}});
  $('#propertyEditorList')?.addEventListener('click',e=>{const toggle=e.target.closest('[data-toggle-property]');if(toggle){const i=Number(toggle.dataset.toggleProperty),id=editProperties[i]?.id;if(id){collapsedPropertyIds.has(id)?collapsedPropertyIds.delete(id):collapsedPropertyIds.add(id);renderPropertyEditor();}return;}const btn=e.target.closest('[data-remove-property]');if(!btn)return;const i=Number(btn.dataset.removeProperty),id=editProperties[i]?.id;if(id)collapsedPropertyIds.delete(id);editProperties.splice(i,1);renderPropertyEditor();});

  function renderGarageEditor(){
    const box=$('#garageEditorList'); if(!box)return;
    updateAssetEditorState();
    if(!editGarages.length){box.innerHTML='<div class="notice compact-notice">Гаражей пока нет. Нажми «+ Добавить гараж».</div>';return;}
    const locList=`<datalist id="garage-locations">${PROPERTY_LOCATIONS.map(x=>`<option value="${escapeHtml(x)}"></option>`).join('')}</datalist>`;
    box.innerHTML=locList+editGarages.map((x,i)=>{const closed=collapsedGarageIds.has(x.id);return `<div class="garage-edit-row collapsible-editor-row${closed?' is-collapsed':''}" data-garage-row="${i}" data-row-id="${escapeHtml(x.id)}"><div class="garage-edit-row-head"><button class="editor-row-toggle" type="button" data-toggle-garage="${i}" aria-expanded="${!closed}"><span class="editor-row-chevron">${closed?'▸':'▾'}</span><span class="editor-row-title"><b>Гараж${x.number?` #${escapeHtml(x.number)}`:''}</b><small>${escapeHtml(x.location||'Локация не указана')}</small></span></button><button class="btn danger compact-delete" type="button" data-remove-garage="${i}">Удалить</button></div><div class="garage-edit-grid editor-row-body"${closed?' hidden':''}><label>Номер / ID<input class="input" data-garage-field="number" data-gi="${i}" value="${escapeHtml(x.number)}" placeholder="Номер гаража"></label><label>Локация<input class="input" list="garage-locations" data-garage-field="location" data-gi="${i}" value="${escapeHtml(x.location)}" placeholder="Район или город"></label><label>Вместимость<input class="input" data-garage-field="capacity" data-gi="${i}" value="${escapeHtml(x.capacity)}" placeholder="Напр. 4 авто"></label><label>Стоимость для Forbes<input class="input" data-garage-field="value" data-gi="${i}" value="${escapeHtml(x.value||'')}" placeholder="Напр. 80 млн"></label><label class="wide">Заметка<input class="input" data-garage-field="note" data-gi="${i}" value="${escapeHtml(x.note)}" placeholder="Необязательно"></label><label class="wide business-toggle"><input type="checkbox" data-garage-field="main" data-gi="${i}" ${x.main?'checked':''}> Основной гараж игрока</label></div></div>`}).join('');
  }
  $('#toggleGarageSectionBtn')?.addEventListener('click',()=>{garageSectionCollapsed=!garageSectionCollapsed;updateAssetEditorState();});
  $('#addGarageBtn')?.addEventListener('click',()=>{if(editGarages.length>=20)return showToast('Максимум 20 гаражей на игрока');const x={id:`garage-${Date.now()}`,kind:'garage',number:'',location:'',capacity:'',note:'',value:'',main:false};editGarages.push(x);collapsedGarageIds.delete(x.id);garageSectionCollapsed=false;renderGarageEditor();});
  $('#garageEditorList')?.addEventListener('input',e=>{const el=e.target.closest('[data-garage-field]');if(!el)return;const i=Number(el.dataset.gi),f=el.dataset.garageField;if(!editGarages[i]||f==='main')return;editGarages[i][f]=el.value;});
  $('#garageEditorList')?.addEventListener('change',e=>{const el=e.target.closest('[data-garage-field]');if(!el)return;const i=Number(el.dataset.gi),f=el.dataset.garageField;if(!editGarages[i])return;if(f==='main'){if(el.checked)editGarages.forEach((x,j)=>x.main=j===i);else editGarages[i].main=false;renderGarageEditor();}else{editGarages[i][f]=f==='value'?normalizeMoneyInput(el.value):el.value;if(f==='value')el.value=editGarages[i][f];}});
  $('#garageEditorList')?.addEventListener('click',e=>{const toggle=e.target.closest('[data-toggle-garage]');if(toggle){const i=Number(toggle.dataset.toggleGarage),id=editGarages[i]?.id;if(id){collapsedGarageIds.has(id)?collapsedGarageIds.delete(id):collapsedGarageIds.add(id);renderGarageEditor();}return;}const btn=e.target.closest('[data-remove-garage]');if(!btn)return;const i=Number(btn.dataset.removeGarage),id=editGarages[i]?.id;if(id)collapsedGarageIds.delete(id);editGarages.splice(i,1);renderGarageEditor();});

  function openEditPlayer(id) {
    if(!canWritePermission('players_edit')) return showToast('Нет права на редактирование игроков');
    const p = players.find(x => x.id === id);
    if (!p) return;
    editPlayerId = id;
    $('#editNick').value = p.nick;
    $('#editName').value = p.name;
    $('#editVk').value = p.vk === '#' ? '' : p.vk;
    $('#editRank').value = p.rank;
    $('#editRank').readOnly = autoRankEnabled();
    $('#editRank').title = autoRankEnabled() ? 'Место рассчитывается автоматически по общему состоянию' : 'Ручной режим рейтинга';
    $('#editAmount').value = normalizeMoneyInput(playerValue(p, draft));
    pendingAvatar = String(p.avatar || '');
    editBusinesses = normalizeBusinesses(p.businesses);
    editProperties = normalizeProperties(p.properties);
    editGarages = normalizeGarages(p.garages,p.properties);
    collapsedBusinessIds.clear();
    collapsedPropertyIds.clear();
    collapsedGarageIds.clear();
    businessPickerFilters.clear();
    businessSectionCollapsed=false;
    propertySectionCollapsed=false;
    garageSectionCollapsed=false;
    renderBusinessEditor();
    renderPropertyEditor();
    renderGarageEditor();
    avatarCrop = {src:'', img:null, naturalW:0, naturalH:0, zoom:1, x:0, y:0, dirty:false};
    renderEditAvatarThumb();
    $$('[data-achievement-edit]').forEach(cb => { cb.checked = (p.achievements || []).includes(cb.value); });
    renderAchievementSelectionPreview();
    const autoPrev=$('#autoAchievementPreview'); if(autoPrev){ const keys=autoAchievementKeys(p); autoPrev.innerHTML = keys.length ? `Авто: ${keys.map(k=>`${ACHIEVEMENTS[k].icon} ${ACHIEVEMENTS[k].label}`).join(' • ')}` : 'Автодостижений пока нет. Они появятся по позиции, росту и времени в рейтинге.'; }
    $('#editPlayerModal').classList.add('open');
  }

  function closeEditPlayer() {
    closeAvatarEditor();
    closeAchievementPicker();
    editPlayerId = null;
    $('#editPlayerModal').classList.remove('open');
  }

  $$('[data-edit-close]').forEach(x => x.addEventListener('click', closeEditPlayer));
  $('#openAchievementPickerBtn')?.addEventListener('click', openAchievementPicker);
  $$('[data-achievement-picker-close]').forEach(x => x.addEventListener('click', closeAchievementPicker));
  $('#applyAchievementSelectionBtn')?.addEventListener('click', () => { renderAchievementSelectionPreview(); closeAchievementPicker(); });
  $('#clearAchievementSelectionBtn')?.addEventListener('click', () => {
    $$('[data-achievement-edit]').forEach(cb => { cb.checked = false; });
    renderAchievementSelectionPreview();
  });
  $$('[data-achievement-edit]').forEach(cb => cb.addEventListener('change', renderAchievementSelectionPreview));

  $('#clearPlayerDynamicsBtn')?.addEventListener('click', () => {
    const p = players.find(x => x.id === editPlayerId);
    if (!p) return;
    ask('Очистить динамику игрока?', `График и история позиции ${p.nick} будут удалены. Текущее место #${p.rank} останется.`, () => {
      p.rankHistory = [];
      persistRoster();
      const now=Date.now();
      history.unshift({time:now,nick:p.nick,playerId:p.id,old:'Динамика позиции',new:'Очищена'});
      saveJSON(K.history,history);
      meta.updatedAt=now; saveJSON(K.meta,meta);
      const autoPrev=$('#autoAchievementPreview'); if(autoPrev){ const keys=autoAchievementKeys(p); autoPrev.innerHTML = keys.length ? `Авто: ${keys.map(k=>`${ACHIEVEMENTS[k].icon} ${ACHIEVEMENTS[k].label}`).join(' • ')}` : 'Автодостижений пока нет. Они появятся по позиции, росту и времени в рейтинге.'; }
      renderAll();
      showToast('Динамика игрока очищена');
    });
  });

  $('#saveEditPlayer').addEventListener('click', async () => {
    const p = players.find(x => x.id === editPlayerId);
    if (!p) return closeEditPlayer();
    const notificationAchievementsBefore = snapshotAchievementState();
    const notificationLeaderBefore = players[0]?.id || '';

    const nick = $('#editNick').value.trim();
    const name = $('#editName').value.trim();
    const vk = $('#editVk').value.trim() || '#';
    let desiredRank = Number($('#editRank').value);
    const amount = normalizeMoneyInput($('#editAmount').value);
    $('#editAmount').value = amount;
    const achievements = $$('[data-achievement-edit]:checked').map(cb => cb.value).filter(x => ACHIEVEMENTS[x]);

    if (!nick) return showToast('Введите ник игрока');
    if (!Number.isFinite(desiredRank)) desiredRank = p.rank;
    desiredRank = Math.max(1, Math.min(players.length, Math.round(desiredRank)));

    const now = Date.now();
    const before = `${p.nick} / ${p.name || '—'} / #${p.rank}`;
    const oldAmount = playerValue(p, wealth);
    const oldNetWorth = playerNetWorth(p, wealth);
    const oldRank = p.rank;
    const beforeRanks = snapshotRanks();

    p.nick = nick;
    p.name = name;
    p.vk = vk;
    p.achievements = achievements;
    p.avatar = pendingAvatar || '';
    p.businesses = normalizeBusinesses(editBusinesses);
    p.properties = normalizeProperties(editProperties);
    p.garages = normalizeGarages(editGarages);

    if (!autoRankEnabled() && desiredRank !== oldRank) {
      const from = players.findIndex(x => x.id === p.id);
      players.splice(from, 1);
      players.splice(desiredRank - 1, 0, p);
      normalizeRanks();
      recordRankChanges(beforeRanks, now);
    }

    if (amount) {
      wealth[p.id] = amount;
      draft[p.id] = amount;
    } else {
      delete wealth[p.id];
      delete draft[p.id];
    }

    if(autoRankEnabled()) recalculateRankingByNetWorth(now);
    const after = `${p.nick} / ${p.name || '—'} / #${p.rank}`;
    notifyAchievementChanges(notificationAchievementsBefore, now);
    notifyLeaderChange(notificationLeaderBefore, now);
    history.unshift({time:now, nick:p.nick, playerId:p.id, old:before, new:after});
    if (oldAmount !== amount) {
      history.unshift({time:now, nick:p.nick, playerId:p.id, old:oldAmount || 'Не указано', new:amount || 'Не указано'});
    }
    const newNetWorth = playerNetWorth(p, wealth);
    if(oldNetWorth!==newNetWorth) publishForbesEvent({type:'wealth',playerId:p.id,nick:p.nick,oldValue:compactMoney(oldNetWorth),newValue:compactMoney(newNetWorth),at:now});

    meta.updatedAt = now;
    meta.updatedBy = accessProfile.alias || accessProfile.label || 'admin';
    persistRoster();
    saveJSON(K.wealth, wealth);
    saveJSON(K.history, history);
    saveJSON(K.meta, meta);

    closeEditPlayer();
    renderAll();
    auditAdminAction('Игрок изменён',p.nick,after);
    showToast('Игрок обновлён');
  });

  function deletePlayer(id) {
    if(!canWritePermission('players_delete')) return showToast('Нет права на удаление игроков');
    const notificationAchievementsBefore = snapshotAchievementState();
    const notificationLeaderBefore = players[0]?.id || '';
    const index = players.findIndex(x => x.id === id);
    if (index < 0) return;
    const beforeRanks = snapshotRanks();
    const now = Date.now();
    const [p] = players.splice(index, 1);
    p.previousRank = index + 1;
    p.deletedAt = now;
    deletedPlayers.unshift(p);
    normalizeRanks();
    recordRankChanges(beforeRanks, now);
    notifyAchievementChanges(notificationAchievementsBefore, now);
    notifyLeaderChange(notificationLeaderBefore, now);
    persistRoster();

    history.unshift({time:p.deletedAt, nick:p.nick, playerId:p.id, old:`В рейтинге #${p.previousRank}`, new:'Удалён'});
    publishForbesEvent({type:'removed',playerId:p.id,nick:p.nick,oldRank:p.previousRank,at:p.deletedAt});
    meta.updatedAt = p.deletedAt;
    saveJSON(K.history, history);
    saveJSON(K.meta, meta);

    renderAll();
    auditAdminAction('Игрок удалён',p.nick,`Было место #${p.previousRank}`);
    showToast(`${p.nick} перемещён в удалённые`);
  }

  function restorePlayer(id) {
    if(!canWritePermission('players_delete')) return showToast('Нет права на восстановление игроков');
    const notificationAchievementsBefore = snapshotAchievementState();
    const notificationLeaderBefore = players[0]?.id || '';
    const index = deletedPlayers.findIndex(x => x.id === id);
    if (index < 0) return;
    const beforeRanks = snapshotRanks();
    const [p] = deletedPlayers.splice(index, 1);
    const target = Math.max(0, Math.min(players.length, (Number(p.previousRank) || players.length + 1) - 1));
    const now = Date.now();
    delete p.deletedAt;
    players.splice(target, 0, p);
    normalizeRanks();
    if(autoRankEnabled()) recalculateRankingByNetWorth(now);
    recordRankChanges(beforeRanks, now);
    if (Number(p.previousRank) && Number(p.previousRank) !== Number(p.rank)) recordRankHistory(p, Number(p.previousRank), Number(p.rank), now);
    notifyAchievementChanges(notificationAchievementsBefore, now);
    notifyLeaderChange(notificationLeaderBefore, now);
    persistRoster();

    history.unshift({time:now, nick:p.nick, playerId:p.id, old:'Удалён', new:`Восстановлен на #${p.rank}`});
    publishForbesEvent({type:'restored',playerId:p.id,nick:p.nick,newRank:p.rank,at:now});
    meta.updatedAt = now;
    saveJSON(K.history, history);
    saveJSON(K.meta, meta);

    renderAll();
    auditAdminAction('Игрок восстановлен',p.nick,`Место #${p.rank}`);
    showToast(`${p.nick} восстановлен`);
  }

  $('#addPlayerBtn')?.addEventListener('click', () => {
    if(!canWritePermission('players_edit')) return showToast('Нет права на добавление игроков');
    const nick = $('#newNick').value.trim();
    const name = $('#newName').value.trim();
    const vk = $('#newVk').value.trim();

    if (!nick) return showToast('Введите ник');
    if (players.some(p => p.nick.toLocaleLowerCase('ru') === nick.toLocaleLowerCase('ru'))) {
      return showToast('Игрок с таким ником уже есть');
    }

    const now = Date.now();
    const p = {
      id: `custom-${slug(nick)}-${now}`,
      nick,
      name,
      vk: vk || '#',
      rank: players.length + 1,
      createdAt: now,
      bestRank: players.length + 1,
      achievements: [],
      avatar: '',
      businesses: [],
      properties: [],
      garages: [],
      rankHistory: []
    };
    players.push(p);
    normalizeRanks();
    if(autoRankEnabled()) recalculateRankingByNetWorth(now);
    persistRoster();

    history.unshift({time:now, nick:p.nick, playerId:p.id, old:'—', new:`Добавлен на #${p.rank}`});
    publishForbesEvent({type:'joined',playerId:p.id,nick:p.nick,newRank:p.rank,at:now});
    meta.updatedAt = now;
    saveJSON(K.history, history);
    saveJSON(K.meta, meta);

    $('#newNick').value = '';
    $('#newName').value = '';
    $('#newVk').value = '';
    renderAll();
    auditAdminAction('Игрок добавлен',p.nick,`Место #${p.rank}`);
    showToast('Игрок добавлен');
  });

  function renderHistory() {
    const source=historyMode==='admins'?history.filter(h=>h?.category==='admin'||h?.actor):history;
    const allBtn=document.getElementById('historyShowAll'), adminBtn=document.getElementById('historyShowAdmins');
    allBtn?.classList.toggle('active',historyMode==='all'); adminBtn?.classList.toggle('active',historyMode==='admins');
    $('#historyList').innerHTML = source.length
      ? source.map(h => `<div class="history-row ${h?.category==='admin'?'admin-audit':''}"><time>${fmtDate(h.time)}</time><strong>${escapeHtml(h.nick || 'Система')}${h?.actor?`<small class="history-actor"> • ${escapeHtml(h.actor)}</small>`:''}</strong><span class="old">${escapeHtml(h.action || h.old || '—')}</span><span class="new">${escapeHtml(h.new || '—')}</span></div>`).join('')
      : '<div class="empty-state">Для этого фильтра записей пока нет.</div>';
  }
  $('#historyShowAll')?.addEventListener('click',()=>{historyMode='all';renderHistory()});
  $('#historyShowAdmins')?.addEventListener('click',()=>{historyMode='admins';renderHistory()});

  function statsDayKey(ts = Date.now()) {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function deviceLabel(device) {
    return device === 'mobile' ? '📱 Телефон' : device === 'tablet' ? '📟 Планшет' : '💻 ПК';
  }

  async function loadCloudStats() {
    if (!fbDb) return {visits:[], presence:[]};
    const [vSnap, pSnap] = await Promise.all([
      fbDb.ref('stats/visits').once('value'),
      fbDb.ref('stats/presence').once('value')
    ]);
    const visits = [];
    vSnap.forEach(c => { const v=c.val(); if (v && typeof v==='object') visits.push({...v,_key:c.key}); });
    const presence = [];
    pSnap.forEach(c => { const v=c.val(); if (v && typeof v==='object') presence.push({...v,_key:c.key}); });
    visits.sort((a,b)=>Number(b.ts||0)-Number(a.ts||0));
    return {visits,presence};
  }

  function dedupeVisits24h(rawVisits) {
    const windowMs = 24*60*60*1000;
    const lastByVisitor = new Map();
    const accepted = [];
    [...rawVisits].sort((a,b)=>Number(a.ts||0)-Number(b.ts||0)).forEach(v => {
      const key = String(v.visitorId || v.sessionId || v._key || '');
      const ts = Number(v.ts||0);
      if (!key || !ts) return;
      const last = Number(lastByVisitor.get(key)||0);
      if (!last || ts-last >= windowMs) {
        accepted.push(v);
        lastByVisitor.set(key,ts);
      }
    });
    return accepted.sort((a,b)=>Number(b.ts||0)-Number(a.ts||0));
  }

  function buildStatsSnapshot(cloudStats) {
    const visits = dedupeVisits24h(cloudStats.visits || []);
    const presence = cloudStats.presence || [];
    const now = Date.now();
    const today = statsDayKey(now);
    const yd = new Date(); yd.setDate(yd.getDate()-1); const yesterday = statsDayKey(yd.getTime());
    const unique = new Set(visits.map(v => v.visitorId).filter(Boolean)).size;
    const online = presence.filter(x => now - Number(x.lastSeen||0) < 120000).length;
    const byDay = {}; const devices = {pc:0,mobile:0,tablet:0};
    visits.forEach(v => {
      const k = v.day || statsDayKey(Number(v.ts||now));
      byDay[k]=(byDay[k]||0)+1;
      if (devices[v.device] !== undefined) devices[v.device]++;
    });
    const sumDays = n => {
      let total=0;
      for(let i=0;i<n;i++){
        const d=new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()-i);
        total += Number(byDay[statsDayKey(d.getTime())]||0);
      }
      return total;
    };
    const days=[];
    for(let i=6;i>=0;i--){
      const d=new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()-i);
      const key=statsDayKey(d.getTime());
      days.push({key,label:new Intl.DateTimeFormat('ru-RU',{weekday:'short'}).format(d).replace('.',''),value:Number(byDay[key]||0)});
    }
    const recentCutoff = now - 10 * 60 * 1000;
    const recentMap = new Map();
    presence.filter(v => Number(v.lastSeen||0) >= recentCutoff).forEach(v => {
      const key = String(v.visitorId || v._key || '');
      if (!key) return;
      const prev = recentMap.get(key);
      if (!prev || Number(v.lastSeen||0) > Number(prev.lastSeen||0)) recentMap.set(key, v);
    });
    const recentVisits = [...recentMap.values()]
      .sort((a,b)=>Number(b.lastSeen||0)-Number(a.lastSeen||0))
      .slice(0,20)
      .map(v => ({device:v.device||'pc', lastSeen:Number(v.lastSeen||0)}));
    return {
      fetchedAt: now,
      total: visits.length,
      unique,
      online,
      today: Number(byDay[today]||0),
      yesterday: Number(byDay[yesterday]||0),
      week: sumDays(7),
      month: sumDays(30),
      days,
      devices,
      recentVisits
    };
  }

  function readStatsSnapshotCache() {
    try {
      const parsed = JSON.parse(localStorage.getItem(DASH_STATS_CACHE_KEY) || 'null');
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch { return null; }
  }

  function saveStatsSnapshotCache(snapshot) {
    try { localStorage.setItem(DASH_STATS_CACHE_KEY, JSON.stringify(snapshot)); } catch {}
  }

  async function loadStatsSnapshot(force = false) {
    const cached = readStatsSnapshotCache();
    if (!force && cached && Number(cached.fetchedAt) && Date.now() - Number(cached.fetchedAt) < DASH_STATS_TTL) return cached;
    if (!cloudReady || !fbDb) return cached;
    if (statsLoadPromise) return statsLoadPromise;
    statsLoadPromise = (async () => {
      try {
        const snapshot = buildStatsSnapshot(await loadCloudStats());
        saveStatsSnapshotCache(snapshot);
        return snapshot;
      } finally {
        statsLoadPromise = null;
      }
    })();
    return statsLoadPromise;
  }

  function applyDashboardStats(snapshot) {
    if (!snapshot) {
      $('#dashCloudStatus').textContent = cloudReady ? 'НЕТ ДАННЫХ' : 'OFFLINE';
      return;
    }
    $('#dashToday').textContent = snapshot.today ?? 0;
    $('#dashWeek').textContent = snapshot.week ?? 0;
    $('#dashTotal').textContent = snapshot.total ?? 0;
    $('#dashUnique').textContent = snapshot.unique ?? 0;
    $('#dashMonth').textContent = snapshot.month ?? 0;
    $('#dashOnline').textContent = snapshot.online ?? 0;
    $('#dashStatsUpdated').textContent = fmtDate(Number(snapshot.fetchedAt||0), true);
    const next = Number(snapshot.fetchedAt||0) + DASH_STATS_TTL;
    $('#dashNextRefresh').textContent = next > Date.now() ? fmtDate(next, true) : 'при следующем открытии';
    $('#dashCloudStatus').textContent = 'КЭШ 1 ЧАС';
    const d = snapshot.devices || {mobile:0,pc:0,tablet:0};
    $('#dashDevices').innerHTML = `<span>📱 ${Number(d.mobile||0)}</span><span>💻 ${Number(d.pc||0)}</span><span>📟 ${Number(d.tablet||0)}</span>`;
  }

  async function renderDashboardStats(force = false) {
    try {
      const cached = readStatsSnapshotCache();
      if (cached) applyDashboardStats(cached);
      const snapshot = await loadStatsSnapshot(force);
      if (snapshot) applyDashboardStats(snapshot);
    } catch (err) {
      console.error('Dashboard stats error', err);
      $('#dashCloudStatus').textContent = 'ERROR';
    }
  }

  async function renderStats(force = false) {
    const status = $('#statsCloudStatus');
    if (status) status.textContent = cloudReady ? 'CACHE' : '…';
    try {
      const snapshot = await loadStatsSnapshot(force);
      if (!snapshot) return;
      $('#statsTotalViews').textContent = snapshot.total ?? 0;
      $('#statsUnique').textContent = snapshot.unique ?? 0;
      $('#statsOnline').textContent = snapshot.online ?? 0;
      $('#statsTodayViews').textContent = snapshot.today ?? 0;
      $('#statsYesterday').textContent = snapshot.yesterday ?? 0;
      $('#statsWeek').textContent = snapshot.week ?? 0;
      $('#statsMonth').textContent = snapshot.month ?? 0;
      if (status) status.textContent = '1H CACHE';

      const days = Array.isArray(snapshot.days) ? snapshot.days : [];
      const max=Math.max(1,...days.map(x=>Number(x.value||0)));
      $('#statsChart').innerHTML=days.map(x=>`<div class="stats-bar-col"><div class="stats-bar-value">${x.value}</div><div class="stats-bar-track"><div class="stats-bar-fill" style="height:${Math.max(4,Math.round(Number(x.value||0)/max*100))}%"></div></div><div class="stats-bar-label">${escapeHtml(x.label)}</div></div>`).join('');
      const devices = snapshot.devices || {pc:0,mobile:0,tablet:0};
      const totalDev=Math.max(1,Number(devices.pc||0)+Number(devices.mobile||0)+Number(devices.tablet||0));
      $('#statsDevices').innerHTML=['mobile','pc','tablet'].map(k=>{const pct=Math.round(Number(devices[k]||0)/totalDev*100);return `<div class="device-row"><div><strong>${deviceLabel(k)}</strong><span>${Number(devices[k]||0)} посещений</span></div><div class="device-meter"><i style="width:${pct}%"></i></div><b>${pct}%</b></div>`;}).join('');
      const recentVisits = Array.isArray(snapshot.recentVisits) ? snapshot.recentVisits : [];
      $('#statsRecent').innerHTML=recentVisits.length?recentVisits.map(v=>`<div class="stats-visit-row compact-visit"><span><i></i>${deviceLabel(v.device)}</span><time>${fmtDate(Number(v.lastSeen||0))}</time></div>`).join(''):'<div class="empty-state">За последние 10 минут новых входов нет. Данные обновляются максимум раз в час.</div>';
    } catch (err) {
      console.error('Firebase stats error', err);
      if (status) status.textContent = 'ERROR';
      $('#statsRecent').innerHTML = `<div class="empty-state">Firebase не дал прочитать статистику. Проверь Rules.</div>`;
    }
  }

  function ask(title, text, fn) {
    $('#modalTitle').textContent = title;
    $('#modalText').textContent = text;
    confirmAction = fn;
    $('#confirmModal').classList.add('open');
  }
  function closeModal() {
    confirmAction = null;
    $('#confirmModal').classList.remove('open');
  }
  $$('[data-modal-close]').forEach(x => x.addEventListener('click', closeModal));
  $('#modalConfirm').addEventListener('click', () => {
    const fn = confirmAction;
    closeModal();
    if (fn) fn();
  });

  $('#refreshStatsBtn')?.addEventListener('click', async () => { await renderStats(true); await renderDashboardStats(false); showToast('Firebase статистика обновлена'); });
  $('#refreshDashboardBtn')?.addEventListener('click', async () => { await renderDashboardStats(true); await renderStats(false); showToast('Dashboard обновлён'); });
  setInterval(() => {
    const dashActive = $('#view-dashboard')?.classList.contains('active');
    const statsActive = $('#view-stats')?.classList.contains('active');
    if (dashActive) renderDashboardStats(false);
    if (statsActive) renderStats(false);
  }, DASH_STATS_TTL);
  $('#clearStatsBtn')?.addEventListener('click', () => ask(
    'Очистить Firebase статистику?',
    'Будут удалены все события посещений и онлайн-сессии из Firebase.',
    async () => {
      try { await fbDb.ref('stats').remove(); localStorage.removeItem(DASH_STATS_CACHE_KEY); await renderStats(true); await renderDashboardStats(false); showToast('Firebase статистика очищена'); }
      catch(err){ console.error(err); showToast('Не удалось очистить статистику'); }
    }
  ));

  $('#clearHistoryBtn').addEventListener('click', () => ask(
    'Очистить историю?',
    'Все записи истории будут удалены. Состояния игроков не изменятся.',
    () => {
      history = [];
      saveJSON(K.history, history);
      renderAll();
      showToast('История очищена');
    }
  ));

  $('#clearForbesEventsBtn')?.addEventListener('click', () => {
    if(!canWritePermission('forbes_events')) return showToast('Нет права на очистку ленты событий Forbes');
    ask(
    'Удалить всю историю событий Forbes?',
    'Лента «События» будет полностью очищена у всех пользователей. Игроки, рейтинг, суммы и динамика мест не изменятся.',
    async () => {
      if(!fbDb) return showToast('Firebase ещё не подключён');
      try{
        await fbDb.ref('forbesEvents').remove();
        auditAdminAction('Лента событий','Forbes Events','История полностью очищена');
        showToast('История событий удалена у всех');
      }catch(err){
        console.error('Forbes events clear error',err);
        showToast('Не удалось очистить историю событий');
      }
    }
  );
  });

  $('#clearAllDynamicsBtn')?.addEventListener('click', () => ask(
    'Очистить динамику всех игроков?',
    'Мини-графики и история изменения мест будут очищены у всех игроков. Текущий рейтинг не изменится.',
    () => {
      const now=Date.now();
      players.forEach(p => { p.rankHistory = []; });
      persistRoster();
      history.unshift({time:now,nick:'Calypso_Person',old:'Динамика всех игроков',new:'Очищена'});
      saveJSON(K.history,history); meta.updatedAt=now; saveJSON(K.meta,meta);
      renderAll(); showToast('Динамика всех игроков очищена');
    }
  ));

  $('#pruneDynamicsBtn')?.addEventListener('click', () => ask(
    'Удалить старую динамику?',
    'Будут удалены только записи изменения мест старше 30 дней.',
    () => {
      const cutoff=Date.now()-30*DAY_MS; let removed=0;
      players.forEach(p => { const old=Array.isArray(p.rankHistory)?p.rankHistory:[]; const next=old.filter(h=>Number(h?.time)>=cutoff); removed += old.length-next.length; p.rankHistory=next; });
      persistRoster();
      const now=Date.now(); history.unshift({time:now,nick:'Calypso_Person',old:'Старая динамика',new:`Удалено записей: ${removed}`}); saveJSON(K.history,history); meta.updatedAt=now; saveJSON(K.meta,meta);
      renderAll(); showToast(`Удалено старых записей: ${removed}`);
    }
  ));

  $('#clearAmountsBtn').addEventListener('click', () => ask(
    'Очистить все суммы?',
    'Все заполненные состояния игроков будут удалены.',
    () => {
      wealth = {};
      draft = {};
      meta.updatedAt = Date.now();
      saveJSON(K.wealth, wealth);
      saveJSON(K.meta, meta);
      renderAll();
      showToast('Все суммы очищены');
    }
  ));

  $('#factoryResetBtn').addEventListener('click', () => ask(
    'Полный сброс?',
    'Будут удалены суммы, история, добавленные игроки, порядок и удалённые игроки из этого браузера.',
    () => {
      [K.wealth, K.history, K.meta, PLAYER_KEY, DELETED_KEY, LEGACY_CUSTOM_KEY, LEGACY_ORDER_KEY].forEach(k => k && localStorage.removeItem(k));
      history = [];
      meta = {};
      loadRoster();
      wealth = {};
      draft = {};
      saveJSON(K.wealth, wealth);
      renderAll();
      showToast('Панель сброшена');
    }
  ));

  $('#exportBtn').addEventListener('click', () => {
    const payload = {
      version: 2,
      exportedAt: new Date().toISOString(),
      players,
      deletedPlayers,
      wealth,
      history,
      meta
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `forbes78-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('Резервная копия создана');
  });

  $('#importInput').addEventListener('change', async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!data || typeof data !== 'object') throw new Error();

      if (Array.isArray(data.players)) {
        const used = new Set();
        players = normalizeRoster(data.players, used);
        deletedPlayers = normalizeRoster(Array.isArray(data.deletedPlayers) ? data.deletedPlayers : [], used);
        persistRoster();
      }

      wealth = data.wealth && typeof data.wealth === 'object' ? data.wealth : {};
      history = Array.isArray(data.history) ? data.history : [];
      meta = data.meta && typeof data.meta === 'object' ? data.meta : {};
      draft = {...wealth};

      saveJSON(K.wealth, wealth);
      saveJSON(K.history, history);
      saveJSON(K.meta, meta);
      renderAll();
      renderSiteSettingsForm();
      showToast('Данные импортированы');
    } catch {
      showToast('Не удалось импортировать файл');
    }
    e.target.value = '';
  });

  const SITE_DEFAULTS = {
    name: 'BLACK RUSSIA • FORBES',
    subtitle: 'SERVER 78 • VLADIMIR',
    footerText: 'Неофициальная страница рейтинга сообщества.',
    ownerLabel: 'Автор проекта',
    ownerName: 'Calypso_Person',
    ownerRoles: 'Основатель • Разработчик • Блогер',
    ownerBio: 'Создатель и автор BLACK RUSSIA FORBES 78. Развивает рейтинг, админ-панель и новые функции проекта.',
    ownerVk: 'https://vk.ru/ha1333ha',
    techVk: '',
    creatorCard2Title: 'Разработчик',
    creatorCard2Text: 'Админ-панель, Firebase, рейтинг и новые функции.',
    creatorCard3Title: 'Блогер',
    creatorCard3Text: 'Развивает сообщество и контент вокруг проекта.',
    performanceMode: 'balanced',
    eventMode: 'off',
    maintenanceMode: false,
    maintenanceMessage: 'Сайт временно находится на обслуживании. Мы скоро вернёмся.',
    maintenanceSchedule: {enabled:false,startAt:0,endAt:0},
    autoTimeBackground: false,
    eventSchedule: {enabled:false,eventMode:'off',startAt:0,endAt:0},
    theme: 'black-red',
    customAccent: '#ff3347',
    glass: false
  };

  const SITE_EVENT_DEFS = {
    off:{label:"Без события",icon:"◌",description:"Стандартное оформление сайта без сезонных эффектов."},
    spring:{label:"🌸 Весна",icon:"🌸",description:"Цветущая весна: лепестки, розово-сиреневое свечение и мягкие стеклянные карточки."},
    summer:{label:"☀️ Лето",icon:"☀️",description:"Тёплое лето: закатный свет, золотые искры и глубокий вечерний фон."},
    autumn:{label:"🍂 Осень",icon:"🍂",description:"Осенняя тема: тёмный янтарь, листья и тёплые медно-оранжевые акценты."},
    winter:{label:"❄️ Зима",icon:"❄️",description:"Холодная зима: снег, ледяное свечение и глубокие сине-графитовые поверхности."},
    halloween:{label:"🎃 Halloween",icon:"🎃",description:"Halloween: чёрно-фиолетовая атмосфера, оранжевое свечение, тыквы и летучие мыши."},
    newyear:{label:"🎄 Новый год",icon:"🎄",description:"Новый год: изумрудный фон, снег, праздничные огни и красно-золотые акценты."},
    valentine:{label:"💗 День влюблённых",icon:"💗",description:"Романтическая тема: винный фон, мягкое розовое сияние и лёгкие сердца."},
    anniversary:{label:"🎉 День проекта",icon:"🎉",description:"Фирменный праздник проекта: тёмный графит, красно-золотое свечение и конфетти."},
    community:{label:"🎮 День сообщества",icon:"🎮",description:"День сообщества: индиго, электрические акценты и игровые частицы."},
    serverday:{label:"🎂 День сервера 78",icon:"🎂",description:"Праздник сервера 78 Vladimir: янтарно-красное свечение и праздничные искры."},
    winterbreak:{label:"🎁 Зимние каникулы",icon:"🎁",description:"Спокойные зимние каникулы: подарки, холодное свечение и мягкий снег."},
    blackfriday:{label:"🛍️ Black Friday",icon:"%",description:"Black Friday: почти чёрная тема, золото, строгие линии и минимальный неон."},
    cyber:{label:"⚡ Cyber Week",icon:"⚡",description:"Cyber Week: цифровой сине-фиолетовый неон, импульсы и кибер-акценты."},
    victory:{label:"⭐ День Победы",icon:"⭐",description:"Торжественная тёмная тема с красно-золотыми акцентами и звёздами."},
    knowledge:{label:"🎓 День знаний",icon:"🎓",description:"Начало сезона знаний: тёмный синий фон, золотые акценты и спокойная динамика."},
    tournament:{label:"🏆 Турнир",icon:"🏆",description:"Турнирный режим: графит, золото и спортивное напряжение без лишнего шума."},
    night:{label:"🌙 Ночная тема",icon:"🌙",description:"Ночной ивент: глубокий синий, лунное свечение и редкие звёзды."},
    forbes:{label:"💎 Forbes Night",icon:"💎",description:"Премиум-режим Forbes: графитовый фон, золото, фиолетовый неон и дорогая атмосфера."},
    garages:{label:"🚗 Garage Fest",icon:"🚗",description:"Гаражный ивент: стальной графит, красные огни, дорожная пыль и атмосфера авто-шоу."},
    secure:{label:"🔐 Secure Lockdown",icon:"🔐",description:"Защищённый системный режим: тёмный фон, красные линии, сканер и эффект панели безопасности."},
    wealth:{label:"💰 Wealth Rush",icon:"💰",description:"Золотой ивент для рейтинга: роскошные блики, мягкое золото и премиум-свечение."},
  };

  function currentSiteSettings() {
    const x = meta && meta.siteSettings && typeof meta.siteSettings === 'object' ? meta.siteSettings : {};
    return {...SITE_DEFAULTS, ...x};
  }

  function renderSiteSettingsForm() {
    const x = currentSiteSettings();
    const map = {
      siteSettingName:'name', siteSettingSubtitle:'subtitle', siteSettingFooterText:'footerText',
      siteSettingOwnerLabel:'ownerLabel', siteSettingOwnerName:'ownerName', siteSettingOwnerRoles:'ownerRoles', siteSettingOwnerBio:'ownerBio', siteSettingOwnerVk:'ownerVk', siteSettingTechVk:'techVk', systemOwnerVk:'ownerVk', systemTechVk:'techVk',
siteSettingCreatorCard2Title:'creatorCard2Title', siteSettingCreatorCard2Text:'creatorCard2Text', siteSettingCreatorCard3Title:'creatorCard3Title', siteSettingCreatorCard3Text:'creatorCard3Text'
    };
    Object.entries(map).forEach(([id,key]) => {
      const el = document.getElementById(id);
      if (el && document.activeElement !== el) el.value = x[key] || '';
    });
    const theme = ['black-red','cyber-blue','gold','neon-purple','dark','custom'].includes(x.theme) ? x.theme : 'black-red';
    const themeInput = document.getElementById('siteSettingTheme');
    if (themeInput) themeInput.value = theme;
    $$('[data-site-theme]').forEach(btn => btn.classList.toggle('active', btn.dataset.siteTheme === theme));
    const accent=document.getElementById('siteSettingCustomAccent'); if(accent && document.activeElement!==accent) accent.value=/^#[0-9a-f]{6}$/i.test(String(x.customAccent||''))?x.customAccent:'#ff3347';
    const glass=document.getElementById('siteSettingGlass'); if(glass) glass.checked=x.glass!==false;
    const perf=document.getElementById('siteSettingPerformanceMode'); if(perf && document.activeElement!==perf) perf.value=['max','balanced','low'].includes(x.performanceMode)?x.performanceMode:'balanced';
    const eventSelect=document.getElementById('siteEventQuickSelect');
    const eventMode=SITE_EVENT_DEFS[x.eventMode]?x.eventMode:'off';
    if(eventSelect && document.activeElement!==eventSelect) eventSelect.value=eventMode;
    const eventDef=SITE_EVENT_DEFS[eventMode]||SITE_EVENT_DEFS.off;
    const eventStatus=document.getElementById('siteEventQuickStatus'); if(eventStatus) eventStatus.textContent=eventDef.label;
    const eventDescription=document.getElementById('currentEventDescription'); if(eventDescription) eventDescription.textContent=eventDef.description;
    const eventIcon=document.getElementById('currentEventIcon'); if(eventIcon) eventIcon.textContent=eventDef.icon;
    const eventHero=document.getElementById('eventLiveHero'); if(eventHero) eventHero.dataset.currentEvent=eventMode;
    $$('[data-event-choice]').forEach(btn => { const active=btn.dataset.eventChoice===eventMode; btn.classList.toggle('active',active); const action=btn.querySelector('em'); if(action) action.textContent=active?'✓ Активно':'Активировать'; });
    document.documentElement.style.setProperty('--admin-accent', /^#[0-9a-f]{6}$/i.test(String(x.customAccent||''))?x.customAccent:'#ff3347');
    document.body.classList.toggle('admin-glass', x.glass!==false);
    const sl=document.getElementById('securityLastLogin'); if(sl) sl.textContent=fmtDate(Number(meta?.security?.lastLogin||0));
    renderAnnouncementAdmin();
    renderControlCenterForm();
  }

  function localDateTimeValue(ts){if(!Number(ts))return '';const d=new Date(Number(ts));const off=d.getTimezoneOffset()*60000;return new Date(d.getTime()-off).toISOString().slice(0,16);}
  function renderControlCenterForm(){
    const x=currentSiteSettings();
    const msg=document.getElementById('maintenanceMessage'); if(msg&&document.activeElement!==msg)msg.value=x.maintenanceMessage||SITE_DEFAULTS.maintenanceMessage;
    const ms=document.getElementById('maintenanceStatus'); if(ms)ms.textContent=x.maintenanceMode?'Включён • посетителям показывается техобслуживание':'Выключен • сайт открыт';
    document.getElementById('maintenanceStatusDot')?.classList.toggle('off',!x.maintenanceMode);
    const msch=x.maintenanceSchedule&&typeof x.maintenanceSchedule==='object'?x.maintenanceSchedule:SITE_DEFAULTS.maintenanceSchedule;
    const mEnabled=document.getElementById('maintenanceScheduleEnabled');if(mEnabled)mEnabled.checked=msch.enabled===true;
    const mStart=document.getElementById('maintenanceScheduleStart');if(mStart&&document.activeElement!==mStart)mStart.value=localDateTimeValue(msch.startAt);
    const mEnd=document.getElementById('maintenanceScheduleEnd');if(mEnd&&document.activeElement!==mEnd)mEnd.value=localDateTimeValue(msch.endAt);
    const mStatus=document.getElementById('maintenanceScheduleStatus');if(mStatus){const now=Date.now(),active=msch.enabled&&Number(msch.startAt)<=now&&now<Number(msch.endAt);mStatus.textContent=msch.enabled&&msch.startAt&&msch.endAt?`${active?'Сейчас активно • ':''}${fmtDate(msch.startAt)} → ${fmtDate(msch.endAt)}`:'Расписание не настроено.';}
    const auto=document.getElementById('autoTimeBackgroundInput'); if(auto)auto.checked=x.autoTimeBackground!==false;
    const schedule=x.eventSchedule&&typeof x.eventSchedule==='object'?x.eventSchedule:SITE_DEFAULTS.eventSchedule;
    const mode=document.getElementById('eventScheduleMode'); if(mode){if(!mode.options.length)Object.entries(SITE_EVENT_DEFS).filter(([k])=>k!=='off').forEach(([k,d])=>mode.add(new Option(d.label,k)));mode.value=SITE_EVENT_DEFS[schedule.eventMode]?schedule.eventMode:'spring';}
    const enabled=document.getElementById('eventScheduleEnabled');if(enabled)enabled.checked=schedule.enabled===true;
    const start=document.getElementById('eventScheduleStart');if(start&&document.activeElement!==start)start.value=localDateTimeValue(schedule.startAt);
    const end=document.getElementById('eventScheduleEnd');if(end&&document.activeElement!==end)end.value=localDateTimeValue(schedule.endAt);
    const status=document.getElementById('eventScheduleStatus');if(status){status.textContent=schedule.enabled&&schedule.startAt&&schedule.endAt?`${SITE_EVENT_LABELS[schedule.eventMode]||schedule.eventMode} • ${fmtDate(schedule.startAt)} → ${fmtDate(schedule.endAt)}`:'Расписание не настроено.';}
  }

  async function saveControlSiteSettings(patch,action,details){
    if(isReadOnlyAccess()) return showToast('Режим только просмотра • изменения запрещены');
    meta.siteSettings={...currentSiteSettings(),...patch};meta.updatedAt=Date.now();meta.updatedBy=adminActor();saveJSON(K.meta,meta);
    try{if(fbDb&&cloudReady)await fbDb.ref('settings/siteSettings').update(patch);}catch(err){console.warn('Control Center sync',err?.code||err?.message||err);}
    auditAdminAction(action,'Публичный сайт',details||'Обновлено');renderSiteSettingsForm();renderDashboard();
  }
  $('#enableMaintenanceBtn')?.addEventListener('click',()=>saveControlSiteSettings({maintenanceMode:true,maintenanceMessage:(document.getElementById('maintenanceMessage')?.value||SITE_DEFAULTS.maintenanceMessage).trim().slice(0,180)},'Режим обслуживания','Включён'));
  $('#disableMaintenanceBtn')?.addEventListener('click',()=>saveControlSiteSettings({maintenanceMode:false},'Режим обслуживания','Выключен'));
  $('#saveMaintenanceScheduleBtn')?.addEventListener('click',()=>{const start=Date.parse(document.getElementById('maintenanceScheduleStart')?.value||''),end=Date.parse(document.getElementById('maintenanceScheduleEnd')?.value||''),enabled=!!document.getElementById('maintenanceScheduleEnabled')?.checked;if(enabled&&(!start||!end||end<=start))return showToast('Проверь время начала и окончания');const message=(document.getElementById('maintenanceMessage')?.value||SITE_DEFAULTS.maintenanceMessage).trim().slice(0,180);saveControlSiteSettings({maintenanceMessage:message,maintenanceSchedule:{enabled,startAt:start||0,endAt:end||0}},'Планировщик обслуживания',enabled?`${fmtDate(start)} → ${fmtDate(end)}`:'Выключен');showToast('Расписание обслуживания сохранено')});
  $('#clearMaintenanceScheduleBtn')?.addEventListener('click',()=>{saveControlSiteSettings({maintenanceSchedule:{enabled:false,startAt:0,endAt:0}},'Планировщик обслуживания','Очищен');showToast('Расписание обслуживания очищено')});
  $('#saveAutoTimeBackgroundBtn')?.addEventListener('click',()=>saveControlSiteSettings({autoTimeBackground:!!document.getElementById('autoTimeBackgroundInput')?.checked},'Авто-фон по времени суток',document.getElementById('autoTimeBackgroundInput')?.checked?'Включён':'Выключен'));
  $('#saveEventScheduleBtn')?.addEventListener('click',()=>{const start=Date.parse(document.getElementById('eventScheduleStart')?.value||''),end=Date.parse(document.getElementById('eventScheduleEnd')?.value||''),eventMode=document.getElementById('eventScheduleMode')?.value||'off',enabled=!!document.getElementById('eventScheduleEnabled')?.checked;if(enabled&&(!start||!end||end<=start))return showToast('Проверь дату начала и окончания');saveControlSiteSettings({eventSchedule:{enabled,eventMode,startAt:start||0,endAt:end||0}},'Планировщик событий',enabled?`${SITE_EVENT_LABELS[eventMode]||eventMode}: ${fmtDate(start)} → ${fmtDate(end)}`:'Выключен');showToast('Расписание событий сохранено')});
  $('#clearEventScheduleBtn')?.addEventListener('click',()=>{saveControlSiteSettings({eventSchedule:{enabled:false,eventMode:'off',startAt:0,endAt:0}},'Планировщик событий','Очищен');showToast('Расписание очищено')});


  function setProjectStatus(id,value,state=''){const el=document.getElementById(id);if(!el)return;el.textContent=value;el.dataset.state=state;}
  async function refreshProjectStatus(){
    if(!canManageAccess())return;
    const x=currentSiteSettings(),now=Date.now(),ms=x.maintenanceSchedule||{};
    const scheduled=!!(ms.enabled&&Number(ms.startAt)<=now&&now<Number(ms.endAt));
    setProjectStatus('projectStatusAuth',fbAuth?.currentUser?'OK':'Нет сессии',fbAuth?.currentUser?'ok':'bad');
    setProjectStatus('projectStatusDb',cloudReady?'ONLINE':(navigator.onLine?'Проверка…':'OFFLINE'),cloudReady?'ok':'warn');
    setProjectStatus('projectStatusSync',cloudReady?'Активна':'Локальный кэш',cloudReady?'ok':'warn');
    setProjectStatus('projectStatusPlayers',String(players.length));
    setProjectStatus('projectStatusSite',(x.maintenanceMode||scheduled)?'Обслуживание':'Открыт',(x.maintenanceMode||scheduled)?'warn':'ok');
    setProjectStatus('projectStatusEvent',SITE_EVENT_LABELS[x.eventMode]||x.eventMode||'Без события');
    setProjectStatus('projectStatusUpdated',fmtDate(Number(meta.updatedAt||0)));
    const hint=$('#projectStatusHint');
    try{
      if(fbDb){
        const [conn,staff]=await Promise.all([withTimeout(fbDb.ref('.info/connected').once('value'),4000,'STATUS_TIMEOUT'),withTimeout(fbDb.ref('adminUsers').once('value'),5000,'STATUS_TIMEOUT')]);
        const connected=conn.val()===true,staffRows=Object.values(staff.val()||{}).filter(Boolean);
        setProjectStatus('projectStatusDb',connected?'ONLINE':'OFFLINE',connected?'ok':'bad');
        setProjectStatus('projectStatusStaff',String(staffRows.length));
        if(hint)hint.textContent=connected?'Firebase отвечает • Auth и Database доступны.':'Браузер онлайн, но Realtime Database сейчас не подключена.';
      }
    }catch(e){if(hint)hint.textContent='Не удалось завершить Firebase-проверку. Панель продолжит работать с локальным кэшем.';console.warn('Project status',e);}
  }
  $('#refreshProjectStatusBtn')?.addEventListener('click',refreshProjectStatus);
  $('#refreshAdminLoginLogsBtn')?.addEventListener('click',loadAdminLoginLogs);
  $('#clearAdminLoginLogsBtn')?.addEventListener('click',async()=>{if(!isOwnerAccess()||!fbDb)return;if(!confirm('Очистить журнал входов сотрудников?'))return;try{await fbDb.ref('adminLoginLogs').remove();renderAdminLoginLogs([]);auditAdminAction('Журнал входов','Система','Очищен');showToast('Журнал входов очищен');}catch{showToast('Не удалось очистить журнал входов');}});


  $$('[data-site-theme]').forEach(btn => btn.addEventListener('click', () => {
    const theme = btn.dataset.siteTheme || 'black-red';
    const input = document.getElementById('siteSettingTheme');
    if (input) input.value = theme;
    $$('[data-site-theme]').forEach(x => x.classList.toggle('active', x === btn));
  }));

  const customAccentInput = document.getElementById('siteSettingCustomAccent');
  const activateCustomTheme = () => {
    if (!customAccentInput) return;
    const color = /^#[0-9a-f]{6}$/i.test(customAccentInput.value) ? customAccentInput.value : '#ff3347';
    const themeInput = document.getElementById('siteSettingTheme');
    if (themeInput) themeInput.value = 'custom';
    $$('[data-site-theme]').forEach(x => x.classList.toggle('active', x.dataset.siteTheme === 'custom'));
    document.documentElement.style.setProperty('--admin-accent', color);
    const hint=document.getElementById('customThemeHint'); if(hint) hint.textContent=`Custom активна • ${color.toUpperCase()}`;
  };
  customAccentInput?.addEventListener('input', activateCustomTheme);
  customAccentInput?.addEventListener('change', activateCustomTheme);

  function renderAnnouncementAdmin() {
    const box = document.getElementById('announcementAdminStatus');
    const input = document.getElementById('announcementInput');
    const pin = document.getElementById('announcementPinnedInput');
    if (!box) return;
    const a = meta && meta.announcement && typeof meta.announcement === 'object' ? meta.announcement : null;
    const active = a && String(a.text||'').trim() && Number(a.expiresAt||0) > Date.now();
    if (active) {
      box.innerHTML = `<b>Активно до ${fmtDate(Number(a.expiresAt))}</b><span>${escapeHtml(String(a.text||''))}</span>`;
      if (input && document.activeElement !== input) input.value = String(a.text||'');
      if (pin) pin.checked = !!a.pinned;
    } else {
      box.innerHTML = '<span>Активного объявления нет.</span>';
    }
  }

  $('#publishAnnouncementBtn')?.addEventListener('click', () => {
    const input = document.getElementById('announcementInput');
    const text = String(input?.value || '').trim();
    if (!text) return showToast('Введите текст объявления');
    const now = Date.now();
    meta.announcement = {
      id: `announce-${now}`,
      text: text.slice(0,360),
      author: 'Calypso_Person',
      pinned: !!document.getElementById('announcementPinnedInput')?.checked,
      createdAt: now,
      expiresAt: now + 24*60*60*1000
    };
    meta.updatedAt = now;
    meta.updatedBy = 'Calypso_Person';
    addGlobalNotification('announcement','Новое объявление',text.slice(0,180),'📢','index.html#announcementSection',now);
    saveJSON(K.meta, meta);
    history.unshift({time:now,nick:'Calypso_Person',old:'Объявление',new:'Опубликовано на 24 часа'});
    saveJSON(K.history, history);
    renderAnnouncementAdmin();
    showToast('Объявление опубликовано на 24 часа');
  });

  $('#removeAnnouncementBtn')?.addEventListener('click', () => {
    if (!meta.announcement) return showToast('Активного объявления нет');
    const now=Date.now();
    delete meta.announcement;
    meta.updatedAt=now;
    meta.updatedBy='Calypso_Person';
    saveJSON(K.meta,meta);
    history.unshift({time:now,nick:'Calypso_Person',old:'Объявление',new:'Снято'});
    saveJSON(K.history,history);
    const input=document.getElementById('announcementInput'); if(input) input.value='';
    const pin=document.getElementById('announcementPinnedInput'); if(pin) pin.checked=false;
    renderAnnouncementAdmin();
    showToast('Объявление снято');
  });

  const SITE_EVENT_LABELS=Object.fromEntries(Object.entries(SITE_EVENT_DEFS).map(([key,value])=>[key,value.label]));
  function applySiteEventMode(mode){
    mode=SITE_EVENT_DEFS[mode]?mode:'off';
    const now=Date.now();
    meta.siteSettings={...currentSiteSettings(),eventMode:mode};
    meta.updatedAt=now; meta.updatedBy='Calypso_Person';
    if(mode!=='off') addGlobalNotification('event',`Событие сайта: ${SITE_EVENT_LABELS[mode]}`,`На сайте включено оформление «${SITE_EVENT_LABELS[mode]}».`,'🎉','index.html#top',now);
    history.unshift({time:now,nick:'Calypso_Person',old:'Событие сайта',new:SITE_EVENT_LABELS[mode]});
    saveJSON(K.history,history); saveJSON(K.meta,meta);
    try{ if(fbDb && cloudReady) fbDb.ref("settings/siteSettings/eventMode").set(mode); }catch{}
    renderSiteSettingsForm(); renderDashboard();
    auditAdminAction('Событие сайта','События',SITE_EVENT_LABELS[mode]);
    showToast(mode==='off'?'Событие сайта отключено':`Событие включено: ${SITE_EVENT_LABELS[mode]}`);
  }
  $$('[data-event-choice]').forEach(btn => btn.addEventListener('click', () => applySiteEventMode(btn.dataset.eventChoice || 'off')));
  $('#disableSiteEventBtn')?.addEventListener('click',()=>applySiteEventMode('off'));
  $('#applySiteEventBtn')?.addEventListener('click',()=>applySiteEventMode(document.getElementById('siteEventQuickSelect')?.value||'off'));

  $('#clearGlobalNotificationsBtn')?.addEventListener('click',()=>ask(
    'Очистить уведомления у всех?',
    'Будет удалена общая лента уведомлений из Firebase. Она исчезнет у всех посетителей сайта. Это не удаляет игроков, рейтинг или историю изменений.',
    async ()=>{
      const now=Date.now();
      meta.notifications=[];
      meta.updatedAt=now;
      meta.updatedBy='Calypso_Person';
      history.unshift({time:now,nick:'Calypso_Person',old:'Общие уведомления',new:'Очищены у всех'});
      saveJSON(K.history,history);
      saveJSON(K.meta,meta);
      try{
        if(fbDb && cloudReady) await fbDb.ref('settings/notifications').set(null);
        auditAdminAction('Уведомления','Система','Очищены у всех');
        showToast('Все общие уведомления очищены');
      }catch(err){
        console.error('Global notifications clear error',err);
        showToast('Локально очищено, но Firebase не разрешил общую очистку');
      }
    }
  ));

  $('#resetAllAchievementsBtn')?.addEventListener('click',()=>ask(
    'Сбросить все достижения?',
    'У всех игроков будут удалены ручные награды. Прогресс автоматических достижений начнётся заново с этого момента. Места, фото и суммы не изменятся.',
    ()=>{
      const now=Date.now(); let manualCount=0;
      [...players,...deletedPlayers].forEach(p=>{manualCount += Array.isArray(p.achievements)?p.achievements.length:0; p.achievements=[]; p.achievementEpoch=now;});
      persistRoster();
      history.unshift({time:now,nick:'Calypso_Person',old:'Все достижения',new:`Сброшены • удалено ручных: ${manualCount}`});
      meta.updatedAt=now; meta.updatedBy='Calypso_Person'; meta.achievementResetAt=now;
      saveJSON(K.history,history); saveJSON(K.meta,meta);
      renderAll(); showToast('Все достижения и прогресс автодостижений сброшены');
    }
  ));

  $('#systemSaveVkContactsBtn')?.addEventListener('click', async () => {
    if (!canWritePermission('vk_contacts')) return showToast('Нет права на изменение VK-контактов');
    const ownerVk = String(document.getElementById('systemOwnerVk')?.value || '').trim();
    const techVk = String(document.getElementById('systemTechVk')?.value || '').trim();
    const valid = v => !v || /^https:\/\//i.test(v);
    if (!valid(ownerVk) || !valid(techVk)) return showToast('VK-ссылки должны начинаться с https://');
    const patch = {ownerVk: ownerVk || SITE_DEFAULTS.ownerVk, techVk};
    meta.siteSettings = {...currentSiteSettings(), ...patch};
    meta.updatedAt = Date.now();
    meta.updatedBy = adminActor();
    saveJSON(K.meta, meta);
    try { if (fbDb && cloudReady) await fbDb.ref('settings/siteSettings').update(patch); }
    catch (err) { console.warn('VK contacts sync', err?.code || err?.message || err); return showToast('Не удалось сохранить VK-контакты'); }
    auditAdminAction('VK контакты','Система',`Владелец: ${ownerVk?'настроен':'по умолчанию'} • Тех: ${techVk?'настроен':'не настроен'}`);
    renderSiteSettingsForm();
    const hint=document.getElementById('systemVkContactsHint'); if(hint) hint.textContent=`Сохранено • Владелец: ${ownerVk?'OK':'по умолчанию'} • Тех. администратор: ${techVk?'OK':'не настроен'}`;
    showToast('VK-контакты сохранены');
  });

  $('#saveSiteSettingsBtn')?.addEventListener('click', () => {
    const get = id => (document.getElementById(id)?.value || '').trim();
    const currentSettings = currentSiteSettings();
    meta.siteSettings = {
      ...currentSettings,
      name: get('siteSettingName') || SITE_DEFAULTS.name,
      subtitle: get('siteSettingSubtitle') || SITE_DEFAULTS.subtitle,
      footerText: get('siteSettingFooterText') || SITE_DEFAULTS.footerText,
      ownerLabel: get('siteSettingOwnerLabel') || SITE_DEFAULTS.ownerLabel,
      ownerName: get('siteSettingOwnerName') || SITE_DEFAULTS.ownerName,
      ownerRoles: get('siteSettingOwnerRoles') || SITE_DEFAULTS.ownerRoles,
      ownerBio: get('siteSettingOwnerBio') || SITE_DEFAULTS.ownerBio,
      ownerVk: canWritePermission('vk_contacts') ? (get('siteSettingOwnerVk') || SITE_DEFAULTS.ownerVk) : currentSettings.ownerVk,
      techVk: canWritePermission('vk_contacts') ? (get('siteSettingTechVk') || '') : currentSettings.techVk,
      creatorCard2Title: get('siteSettingCreatorCard2Title') || SITE_DEFAULTS.creatorCard2Title,
      creatorCard2Text: get('siteSettingCreatorCard2Text') || SITE_DEFAULTS.creatorCard2Text,
      creatorCard3Title: get('siteSettingCreatorCard3Title') || SITE_DEFAULTS.creatorCard3Title,
      creatorCard3Text: get('siteSettingCreatorCard3Text') || SITE_DEFAULTS.creatorCard3Text,
      performanceMode: ['max','balanced','low'].includes(get('siteSettingPerformanceMode')) ? get('siteSettingPerformanceMode') : SITE_DEFAULTS.performanceMode,
      eventMode: currentSiteSettings().eventMode || SITE_DEFAULTS.eventMode,
      theme: ['black-red','cyber-blue','gold','neon-purple','dark','custom'].includes(get('siteSettingTheme')) ? get('siteSettingTheme') : SITE_DEFAULTS.theme,
      customAccent: /^#[0-9a-f]{6}$/i.test(get('siteSettingCustomAccent')) ? get('siteSettingCustomAccent') : SITE_DEFAULTS.customAccent,
      glass: !!document.getElementById('siteSettingGlass')?.checked
    };
    meta.updatedAt = Date.now();
    meta.updatedBy = 'Calypso_Person';
    saveJSON(K.meta, meta);
    history.unshift({time:meta.updatedAt, nick:'Calypso_Person', old:'Настройки сайта', new:'Обновлены'});
    saveJSON(K.history, history);
    try{ if(fbDb && cloudReady) fbDb.ref("settings/siteSettings").update(meta.siteSettings||{}); }catch{}
    renderDashboard();
    renderSiteSettingsForm();
    auditAdminAction('Настройки сайта','Настройки',meta.siteSettings.theme);
    showToast(meta.siteSettings.theme === 'custom' ? `Custom тема сохранена • ${meta.siteSettings.customAccent.toUpperCase()}` : 'Настройки сайта сохранены');
  });


  function permissionMarkup(selected=[], prefix='staff-new'){
    const set=new Set(normalizePermissions(selected));
    return PERMISSION_DEFS.map(p=>`<label class="staff-permission-option"><input type="checkbox" data-permission-scope="${escapeHtml(prefix)}" value="${escapeHtml(p.id)}" ${set.has(p.id)?'checked':''}><span class="staff-permission-icon">${p.icon}</span><span>${escapeHtml(p.label)}</span></label>`).join('');
  }
  function selectedPermissionValues(scope){
    return $$(`[data-permission-scope="${CSS.escape(scope)}"]:checked`).map(x=>x.value).filter(x=>ALL_PERMISSION_IDS.includes(x));
  }
  function applyPermissionPreset(scope,preset){
    const values=preset==='player_manager'?ROLE_DEFAULT_PERMISSIONS.player_manager:preset==='ga'?ROLE_DEFAULT_PERMISSIONS.ga:preset==='all'?ALL_PERMISSION_IDS:[];
    const set=new Set(values);
    $$(`[data-permission-scope="${CSS.escape(scope)}"]`).forEach(cb=>{cb.checked=set.has(cb.value);});
  }
  function renderCreatePermissionGrid(){
    const grid=$('#staffPermissionGrid');if(!grid)return;
    grid.innerHTML=permissionMarkup(ROLE_DEFAULT_PERMISSIONS.player_manager,'staff-new');
  }
  function setStaffDiag(text,state=''){
    const el=$('#staffAccessDiag'); if(!el)return;
    el.classList.remove('ok','bad'); if(state)el.classList.add(state);
    const span=el.querySelector('span:last-child'); if(span)span.textContent=text;
  }
  function updateStaffStats(rows=[]){
    const total=rows.length,active=rows.filter(x=>x.active!==false).length,disabled=total-active;
    const rights=rows.reduce((n,r)=>n+normalizePermissions(r.permissions,r.role).length,0);
    const vals={staffStatTotal:total,staffStatActive:active,staffStatDisabled:disabled,staffStatPermissions:rights};
    Object.entries(vals).forEach(([id,v])=>{const el=document.getElementById(id);if(el)el.textContent=String(v);});
  }
  async function disposeSecondary(app){
    if(!app)return;
    try{await app.auth().signOut();}catch{}
    try{await app.delete();}catch{}
  }
  async function loadStaffAccessList(){
    const box=$('#staffAccessList'); if(!box||!fbDb||!canManageAccess())return;
    box.innerHTML='<div class="notice">Загрузка доступов…</div>';
    setStaffDiag('Проверяю права Realtime Database…');
    try{
      const snap=await fbDb.ref('adminUsers').once('value'), rows=[];
      snap.forEach(c=>{const v=c.val()||{}; if(c.key!==OWNER_UID && String(v.role||'')!=='owner') rows.push({uid:c.key,...v});});
      rows.sort((a,b)=>Number(a.createdAt||0)-Number(b.createdAt||0));
      updateStaffStats(rows);
      setStaffDiag('Firebase доступ готов • индивидуальные права активны','ok');
      box.innerHTML=rows.length?rows.map(r=>{
        const perms=normalizePermissions(r.permissions,r.role),scope=`staff-edit-${r.uid}`,label=String(r.roleLabel||ACCESS_ROLES[r.role]?.label||'Индивидуальная роль'),readOnly=r.readOnly===true;
        const chips=perms.slice(0,6).map(id=>{const p=PERMISSION_DEFS.find(x=>x.id===id);return p?`<span>${p.icon} ${escapeHtml(p.label.replace('Игроки: ',''))}</span>`:''}).join('');
        const more=perms.length>6?`<span>+${perms.length-6}</span>`:'';
        return `<article class="staff-access-row ${r.active===false?'is-disabled':''}" data-staff-card="${escapeHtml(r.uid)}"><div class="staff-access-summary"><div class="staff-access-main"><span class="staff-avatar">${escapeHtml((r.alias||'U').slice(0,2).toUpperCase())}</span><div><div class="staff-name-line"><b>${escapeHtml(r.alias||'Сотрудник')}</b><span class="staff-status ${r.active===false?'off':'on'}">${r.active===false?'Отключён':'Активен'}</span>${readOnly?'<span class="staff-status readonly">Только просмотр</span>':''}</div><small>${escapeHtml(label)} • прав: ${perms.length}/${ALL_PERMISSION_IDS.length}</small></div></div><div class="staff-rights-preview">${chips}${more}</div><div class="staff-access-actions"><button class="btn" type="button" data-staff-edit-toggle="${escapeHtml(r.uid)}">⚙ Изменить права</button><button class="btn ${r.active===false?'green':'danger'}" type="button" data-staff-toggle="${escapeHtml(r.uid)}" data-next-active="${r.active===false?'1':'0'}">${r.active===false?'Включить':'Отключить'}</button><button class="btn danger staff-delete-full" type="button" data-staff-delete-full="${escapeHtml(r.uid)}" data-staff-email="${escapeHtml(r.email||'')}" data-staff-alias="${escapeHtml(r.alias||'Сотрудник')}">🗑 Удалить доступ</button></div></div><div class="staff-inline-editor" data-staff-editor="${escapeHtml(r.uid)}" hidden><label class="staff-role-name-field">Название роли<input class="input" data-staff-role-label="${escapeHtml(r.uid)}" value="${escapeHtml(label)}" maxlength="48" placeholder="Например: Тех. специалист"></label><label class="staff-readonly-toggle compact"><input type="checkbox" data-staff-readonly="${escapeHtml(r.uid)}" ${readOnly?'checked':''}><span><b>👁 Только просмотр</b><small>Запрещает изменения данных, но оставляет просмотр разрешённых разделов и чат.</small></span></label><div class="staff-inline-permissions">${permissionMarkup(perms,scope)}</div><div class="staff-editor-footer"><span>Зависимости добавляются автоматически: редактирование → просмотр игроков; управление доступами → система.</span><button class="btn red" type="button" data-staff-save-permissions="${escapeHtml(r.uid)}" data-scope="${escapeHtml(scope)}">Сохранить права</button></div></div></article>`;
      }).join(''):'<div class="notice">Дополнительных аккаунтов пока нет. Создай сотрудника выше и отметь нужные права.</div>';
    }catch(err){
      console.error(err);
      updateStaffStats([]);
      setStaffDiag('Firebase Rules блокируют /adminUsers • установи Rules V9.5','bad');
      box.innerHTML='<div class="notice">Realtime Database запрещает чтение /adminUsers. Нажми «Скопировать Rules», вставь их в Firebase Console → Realtime Database → Rules и нажми Publish.</div>';
    }
  }
  async function checkAdminUsersRules(){
    if(!fbDb) throw new Error('RBAC_DB_NOT_READY');
    const probeKey='__rbac_rule_probe__';
    const probe=fbDb.ref(`adminUsers/${probeKey}`);
    try{
      await probe.set({ruleProbe:true,updatedAt:Date.now(),updatedBy:accessProfile.uid||OWNER_UID});
      await probe.remove();
      return true;
    }catch(err){
      try{await probe.remove();}catch{}
      const e=new Error('RBAC_RULES_BLOCK_ADMIN_USERS');
      e.code=String(err?.code||'PERMISSION_DENIED');
      throw e;
    }
  }
  async function copyFirebaseRules(){
    try{
      const r=await fetch('firebase-database-rules.json?v=9.6.0',{cache:'no-store'});
      if(!r.ok) throw new Error('RULES_FILE_NOT_FOUND');
      const rules=await r.text();
      await navigator.clipboard.writeText(rules);
      showToast('Firebase Rules скопированы');
    }catch(err){
      console.error('Copy Firebase Rules',err);
      showToast('Открой файл firebase-database-rules.json из архива');
    }
  }

  async function createStaffAccount(){
    if(!canManageAccess()||!fbDb)return;
    const alias=String($('#staffLogin')?.value||'').trim();
    const pass=String($('#staffPassword')?.value||'');
    const roleLabel=String($('#staffRoleName')?.value||'').trim()||'Индивидуальная роль';
    const permissions=normalizePermissions(selectedPermissionValues('staff-new'));
    const readOnly=!!document.getElementById('staffReadOnly')?.checked;
    if(!/^[A-Za-z0-9_.-]{3,24}$/.test(alias))return showToast('Логин: 3–24 символа, латиница/цифры/._-');
    if(!permissions.length)return showToast('Выбери хотя бы одно право доступа');

    const email=staffLoginEmail(alias);
    const dirKey=staffDirectoryKey(email);
    let secondary=null, createdFresh=false;
    const btn=$('#createStaffAccessBtn');
    if(btn){btn.disabled=true;btn.textContent='Проверяю Firebase…';}
    setStaffDiag('Проверяю доступы и каталог сотрудников…');
    try{
      await checkAdminUsersRules();
      const existing=await lookupStaffIdentity(email);
      if(existing?.uid){
        const uid=existing.uid;
        const oldSnap=await fbDb.ref(`adminUsers/${uid}`).once('value');
        const old=oldSnap.val()||existing.record||{};
        const profile={alias,email,role:'custom',roleLabel:roleLabel.slice(0,48),permissions:permissionObject(permissions),readOnly,active:true,createdAt:Number(old.createdAt)||Date.now(),updatedAt:Date.now(),createdBy:String(old.createdBy||OWNER_UID),updatedBy:accessProfile.uid||OWNER_UID,loginVersion:'9.5.0'};
        await fbDb.ref(`adminUsers/${uid}`).set(profile);
        try{await fbDb.ref(`staffDirectory/${dirKey}`).set({uid,alias,email,updatedAt:Date.now(),revokedAt:null});}catch(e){console.warn('Staff directory update skipped',e?.code||e?.message||e);}
        $('#staffLogin').value=''; $('#staffPassword').value=''; const ro=document.getElementById('staffReadOnly'); if(ro)ro.checked=false;
        await loadStaffAccessList();
        setStaffDiag(`Доступ восстановлен • ${alias} • пароль Firebase не менялся`,'ok');
        auditAdminAction('Доступ сотрудника восстановлен',alias,roleLabel);
        showToast(`Доступ восстановлен: ${alias} • используй прежний пароль`);
        return;
      }

      if(pass.length<8){setStaffDiag('Для нового аккаунта нужен пароль минимум 8 символов','bad');showToast('Для нового сотрудника введи пароль минимум 8 символов');return;}
      setStaffDiag('Создаю новый Firebase Authentication аккаунт…');
      const appName=`BRStaffCreator_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
      secondary=firebase.initializeApp(FB_CONFIG,appName);
      let cred;
      try{
        cred=await secondary.auth().createUserWithEmailAndPassword(email,pass);
        createdFresh=true;
      }catch(createErr){
        if(String(createErr?.code||'')==='auth/email-already-in-use'){
          const e=new Error('STAFF_ORPHAN_AUTH'); e.code='STAFF_ORPHAN_AUTH'; throw e;
        }
        throw createErr;
      }
      const uid=String(cred?.user?.uid||'');
      if(!uid)throw new Error('STAFF_UID_MISSING');
      const profile={alias,email,role:'custom',roleLabel:roleLabel.slice(0,48),permissions:permissionObject(permissions),readOnly,active:true,createdAt:Date.now(),updatedAt:Date.now(),createdBy:accessProfile.uid||OWNER_UID,updatedBy:accessProfile.uid||OWNER_UID,loginVersion:'9.5.0'};
      await fbDb.ref(`adminUsers/${uid}`).set(profile);
      try{await fbDb.ref(`staffDirectory/${dirKey}`).set({uid,alias,email,createdAt:Date.now(),updatedAt:Date.now(),revokedAt:null});}catch(e){console.warn('Staff directory create skipped',e?.code||e?.message||e);}

      // Verify only Database rules using the already-authenticated secondary session.
      const staffDb=secondary.database();
      const verifySnap=await withTimeout(staffDb.ref(`adminUsers/${uid}`).once('value'),7000,'STAFF_SELF_READ_TIMEOUT');
      const verify=verifySnap.val()||{};
      if(verify.active===false||!normalizePermissions(verify.permissions,verify.role||'custom').length)throw new Error('STAFF_PROFILE_INVALID');

      await disposeSecondary(secondary); secondary=null;
      $('#staffLogin').value=''; $('#staffPassword').value=''; const ro=document.getElementById('staffReadOnly'); if(ro)ro.checked=false;
      await loadStaffAccessList();
      setStaffDiag(`Доступ создан • ${alias} • ${permissions.length} прав`,'ok');
      auditAdminAction('Доступ сотрудника создан',alias,roleLabel);
      showToast(`Доступ создан: ${alias}`);
    }catch(err){
      console.error('Create/recover staff access',err);
      if(createdFresh&&secondary){
        try{const freshUser=secondary.auth().currentUser;if(freshUser)await freshUser.delete();}catch(cleanErr){console.warn('Fresh staff rollback skipped',cleanErr?.code||cleanErr?.message||cleanErr);}
      }
      await disposeSecondary(secondary);
      const code=String(err?.code||''),msg=String(err?.message||'');
      if(code==='STAFF_ORPHAN_AUTH'||msg==='STAFF_ORPHAN_AUTH'){
        setStaffDiag('Auth-аккаунт уже существует, но старый UID не привязан к каталогу','bad');
        showToast('Старый Auth-аккаунт найден. Удали его один раз в Firebase Authentication → Users и создай заново');
      }else if(msg==='STAFF_PROFILE_INVALID'){
        setStaffDiag('Профиль сохранился, но права не прошли проверку','bad');showToast('Проверь Firebase Rules V9.5');
      }else if(msg==='STAFF_SELF_READ_TIMEOUT'){
        setStaffDiag('Firebase слишком долго проверяет права сотрудника','bad');showToast('Проверка Firebase завершилась по таймауту');
      }else if(msg==='RBAC_RULES_BLOCK_ADMIN_USERS'){
        setStaffDiag('Firebase Rules блокируют управление доступами','bad');showToast('Установи Firebase Rules V9.5');
      }else if(code==='PERMISSION_DENIED'||/permission/i.test(msg)){
        setStaffDiag('Firebase Rules не разрешили изменить доступ','bad');showToast('Установи Firebase Rules V9.5');
      }else{
        setStaffDiag('Firebase не смог создать доступ','bad');
        const messages={'auth/operation-not-allowed':'В Firebase не включён Email/Password вход','auth/weak-password':'Firebase считает пароль слишком слабым','auth/invalid-email':'Некорректный логин','auth/network-request-failed':'Нет соединения с Firebase','auth/too-many-requests':'Firebase временно ограничил создание аккаунтов из-за прошлых попыток. Не повторяй запрос много раз подряд.'};
        showToast(messages[code]||'Не удалось создать доступ');
      }
    }finally{
      if(btn){btn.disabled=false;btn.textContent='Создать / восстановить';}
    }
  }
  function openStaffDeleteModal(btn){
    const modal=$('#staffDeleteModal');if(!modal)return;
    modal.dataset.uid=btn.dataset.staffDeleteFull||'';
    modal.dataset.email=btn.dataset.staffEmail||'';
    modal.dataset.alias=btn.dataset.staffAlias||'Сотрудник';
    const name=$('#staffDeleteName');if(name)name.textContent=modal.dataset.alias;
    const err=$('#staffDeleteError');if(err)err.textContent='';
    modal.classList.add('open');
  }
  function closeStaffDeleteModal(){const modal=$('#staffDeleteModal');if(modal)modal.classList.remove('open');}
  async function confirmFullStaffDelete(){
    if(!canManageAccess()||!fbDb)return;
    const modal=$('#staffDeleteModal');
    const uid=String(modal?.dataset.uid||'');
    const email=String(modal?.dataset.email||'');
    const alias=String(modal?.dataset.alias||'Сотрудник');
    const err=$('#staffDeleteError'),btn=$('#confirmStaffDeleteBtn');
    if(err)err.textContent='';
    if(!uid)return;
    try{
      if(btn){btn.disabled=true;btn.textContent='Удаляю доступ…';}
      await fbDb.ref(`adminUsers/${uid}`).remove();
      if(email){try{await fbDb.ref(`staffDirectory/${staffDirectoryKey(email)}`).set({uid,alias,email,updatedAt:Date.now(),revokedAt:Date.now()});}catch(e){console.warn('Staff directory revoke marker skipped',e?.code||e?.message||e);}}
      auditAdminAction('Доступ сотрудника удалён',alias,'Профиль RBAC удалён; Auth-аккаунт сохранён');
      closeStaffDeleteModal();
      await loadStaffAccessList();
      showToast(`Доступ удалён: ${alias}`);
    }catch(ex){
      console.error('Staff access revoke',ex);
      if(err)err.textContent=String(ex?.code||'')==='PERMISSION_DENIED'?'Firebase Rules не разрешили удалить профиль доступа. Установи Rules V9.5.':'Не удалось удалить доступ. Проверь Firebase и соединение.';
    }finally{
      if(btn){btn.disabled=false;btn.textContent='Удалить доступ';}
    }
  }

  renderCreatePermissionGrid();
  $$('[data-permission-preset]').forEach(btn=>btn.addEventListener('click',()=>{applyPermissionPreset('staff-new',btn.dataset.permissionPreset||'none');const label=$('#staffRoleName');if(label&&btn.dataset.permissionPreset==='player_manager')label.value='Редактор игроков';if(label&&btn.dataset.permissionPreset==='ga')label.value='ГА / руководство';if(label&&btn.dataset.permissionPreset==='all')label.value='Полный доступ';}));
  $('#createStaffAccessBtn')?.addEventListener('click',createStaffAccount);
  $('#copyFirebaseRulesBtn')?.addEventListener('click',copyFirebaseRules);
  $('#adminErrorFilter')?.addEventListener('change',e=>{errorCenterFilter=String(e.target.value||'all');renderErrorCenter();});
  $('#toggleAdminErrorCenterBtn')?.addEventListener('click',async()=>{
    const next=!isErrorCenterEnabled();
    await setGlobalErrorCenterEnabled(next);
  });
  $('#clearAdminErrorsBtn')?.addEventListener('click',()=>{if(!confirm('Очистить локальный журнал ошибок в этом браузере?'))return;writeErrorLog([]);renderErrorCenter();showToast('Журнал ошибок очищен');});
  $('#exportAdminErrorsBtn')?.addEventListener('click',exportErrorLog);
  $('#copyAdminErrorsBtn')?.addEventListener('click',async()=>{try{const txt=readErrorLog().map(x=>`[${new Date(x.time).toLocaleString('ru-RU')}] ${errorLabel(x.source)} ${x.code||''} ${x.message}`).join('\n');await navigator.clipboard.writeText(txt||'Ошибок нет');showToast('Ошибки скопированы');}catch(e){reportAdminError('system',e,'warn','copy error log');showToast('Не удалось скопировать журнал');}});
  $('#staffPassEye')?.addEventListener('click',()=>{const input=$('#staffPassword');if(!input)return;input.type=input.type==='password'?'text':'password';});
  $$('[data-staff-delete-close]').forEach(x=>x.addEventListener('click',closeStaffDeleteModal));
  $('#confirmStaffDeleteBtn')?.addEventListener('click',confirmFullStaffDelete);
  $('#staffAccessList')?.addEventListener('click',async e=>{
    const edit=e.target.closest('[data-staff-edit-toggle]');if(edit){const row=$(`[data-staff-editor="${CSS.escape(edit.dataset.staffEditToggle)}"]`);if(row)row.hidden=!row.hidden;return;}
    const save=e.target.closest('[data-staff-save-permissions]');if(save&&canManageAccess()){
      const uid=save.dataset.staffSavePermissions,scope=save.dataset.scope,card=$(`[data-staff-card="${CSS.escape(uid)}"]`),label=String(card?.querySelector(`[data-staff-role-label="${CSS.escape(uid)}"]`)?.value||'').trim()||'Индивидуальная роль',permissions=normalizePermissions(selectedPermissionValues(scope)),readOnly=!!card?.querySelector(`[data-staff-readonly="${CSS.escape(uid)}"]`)?.checked;
      if(!permissions.length)return showToast('Оставь хотя бы одно право');
      try{await fbDb.ref(`adminUsers/${uid}`).update({role:'custom',roleLabel:label.slice(0,48),permissions:permissionObject(permissions),readOnly,updatedAt:Date.now(),updatedBy:accessProfile.uid||OWNER_UID});auditAdminAction('Права сотрудника изменены',label,permissions.join(', '));showToast('Права сотрудника сохранены');await loadStaffAccessList();}catch{showToast('Не удалось сохранить права');}return;
    }
    const del=e.target.closest('[data-staff-delete-full]');if(del&&canManageAccess()){openStaffDeleteModal(del);return;}
    const toggle=e.target.closest('[data-staff-toggle]');if(!toggle||!canManageAccess())return;const active=toggle.dataset.nextActive==='1';
    try{await fbDb.ref(`adminUsers/${toggle.dataset.staffToggle}`).update({active,updatedAt:Date.now(),updatedBy:accessProfile.uid||OWNER_UID});auditAdminAction(active?'Доступ сотрудника включён':'Доступ сотрудника отключён',toggle.dataset.staffToggle,active?'Включён':'Отключён');await loadStaffAccessList();showToast(active?'Доступ включён':'Доступ отключён');}catch{showToast('Не удалось изменить доступ');}
  });

  const ADMIN_IDLE_MS = 30*60*1000;
  let lastAdminActivity = Date.now();
  let sessionStartedAt = Number(sessionGet('br78_admin_started_at_fb19')||0);
  function touchAdminActivity(){ lastAdminActivity=Date.now(); }
  ['pointerdown','keydown','touchstart','scroll'].forEach(ev=>window.addEventListener(ev,touchAdminActivity,{passive:true}));
  async function secureLogout(message='Сессия завершена'){
    try{ if(fbAuth) await fbAuth.signOut(); }catch{}
    sessionRemove(K.session); sessionRemove('br78_admin_started_at_fb19'); sessionRemove('br78_admin_role_v85'); accessProfile={role:'guest',label:'Гость',uid:'',alias:'',permissions:[],readOnly:false};
    showLogin(); const err=$('#loginError'); if(err) err.textContent=message;
  }
  setInterval(()=>{ if(isSession() && Date.now()-lastAdminActivity>=ADMIN_IDLE_MS) secureLogout('Автовыход: 30 минут бездействия.'); },30000);
  $('#logoutAllBtn')?.addEventListener('click',()=>{
    if(!cloudReady) return showToast('Firebase ещё не подключён');
    const now=Date.now();
    meta.security={...(meta.security||{}),logoutBefore:now,lastSecurityAction:now};
    saveJSON(K.meta,meta); showToast('Все активные сессии будут завершены');
    setTimeout(()=>secureLogout('Выполнен выход со всех устройств.'),500);
  });
  function enforceGlobalLogout(){ const cutoff=Number(meta?.security?.logoutBefore||0); if(isSession() && cutoff && sessionStartedAt && sessionStartedAt<cutoff) secureLogout('Эта админ-сессия была завершена владельцем.'); }

  function renderAll() {
    applyAccessUI();
    const visual=currentSiteSettings();
    document.documentElement.style.setProperty('--admin-accent', /^#[0-9a-f]{6}$/i.test(String(visual.customAccent||''))?visual.customAccent:'#ff3347');
    document.body.classList.toggle('admin-glass', visual.glass!==false);
    enforceGlobalLogout();
    // V9.4: render only the open heavy section. This avoids rebuilding players/history on every Firebase update.
    const active=$('.view.active')?.id?.replace('view-','')||'dashboard';
    if(active==='dashboard') renderDashboard();
    if(active==='players') renderPlayers();
    if(active==='history') renderHistory();
    if(active==='stats') renderStats(false);
    if(active==='settings'||active==='events'||active==='system') renderSiteSettingsForm();
    if(active==='system') renderErrorCenter();
    updateUnsaved();
  }

  window.addEventListener('storage', e => {
    if ([PLAYER_KEY, DELETED_KEY].includes(e.key)) {
      loadRoster();
      wealth = migrateWealth(readJSON(K.wealth, {}));
      draft = {...wealth};
      renderAll();
      return;
    }
    if (e.key === STATS_KEY || e.key === DASH_STATS_CACHE_KEY) { renderDashboardStats(false); if ($('#view-stats')?.classList.contains('active')) renderStats(false); return; }
    if ([K.wealth, K.history, K.meta].includes(e.key)) {
      wealth = migrateWealth(readJSON(K.wealth, {}));
      history = readJSON(K.history, []);
      meta = readJSON(K.meta, {});
      draft = {...wealth};
      renderAll();
    }
  });

  window.BRAdminErrorCenter={report:reportAdminError,render:renderErrorCenter,read:readErrorLog,clear:()=>{writeErrorLog([]);renderErrorCenter();},enabled:isErrorCenterEnabled,setEnabled:setGlobalErrorCenterEnabled};

  async function bootAdmin() {
    if(!initFirebase()) return showLogin();
    const user = await waitForFirebaseUser(4500);
    if (user && (isSession() || fbAuth.currentUser)) {
      try {
        await withTimeout(loadAccessProfile(user),7000,'auth/access-timeout');
        applyAccessUI();
        bindGlobalErrorCenterControl();
        showAdmin();
        const activeView=$('.view.active')?.id?.replace('view-','')||'dashboard';
        if(!canAccessView(activeView))goView('dashboard');
        try { await withTimeout(activateCloud(true),9000,'database/sync-timeout'); }
        catch(err){ console.warn('Startup cloud sync unavailable',err); setFirebaseDiag('Firebase: сессия активна • синхронизация временно недоступна'); }
        return;
      } catch (err) {
        console.error(err);
        try{await fbAuth?.signOut();}catch{}
      }
    }
    sessionRemove(K.session);
    sessionRemove('br78_admin_role_v85');
    showLogin();
  }

  bootAdmin();
})();
