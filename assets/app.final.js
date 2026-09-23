(() => {
  const KEYS = window.BR_KEYS || {};
  const PLAYER_KEY = KEYS.players || 'br78_players_state_v1';
  const LEGACY_CUSTOM_KEY = 'br78_custom_players';
  const LEGACY_ORDER_KEY = 'br78_players_order';
  const $ = s => document.querySelector(s);
  const ranking = $('#ranking');
  const podiumGrid = $('#podiumGrid');
  const searchInput = $('#searchInput');
  const resultCount = $('#resultCount');
  const emptyState = $('#emptyState');
  const filledCount = $('#filledCount');
  const visibleCount = $('#visibleCount');
  const updatedAt = $('#updatedAt');
  const modal = $('#profileModal');
  const profileContent = $('#profileContent');
  const toast = $('#toast');
  const filterButtons = [...document.querySelectorAll('[data-filter]')];
  let currentFilter = 'all';
  const ACHIEVEMENTS = {legend:{icon:'👑',label:'Легенда'},top:{icon:'🔥',label:'Топ игрок'},vip:{icon:'💎',label:'VIP'},veteran:{icon:'⭐',label:'Старожил'},newbie:{icon:'🚀',label:'Новичок'},founder:{icon:'🏛️',label:'Основатель'},developer:{icon:'🛠️',label:'Разработчик'},blogger:{icon:'🎥',label:'Блогер'},first_number:{icon:'🥇',label:'Первый номер',rare:true},breakthrough:{icon:'⚡',label:'Прорыв недели',rare:true},centurion:{icon:'💯',label:'100 дней',rare:true},veteran_rare:{icon:'🛡️',label:'Ветеран',rare:true},season_champion:{icon:'🏆',label:'Чемпион сезона',rare:true}};
  const DAY_MS=24*60*60*1000;
  function publicTrendDelta(p,days=7){
    const epoch=Number(p?.achievementEpoch)||0;
    const cutoff=Math.max(Date.now()-days*DAY_MS,epoch);
    const events=(Array.isArray(p?.rankHistory)?p.rankHistory:[]).filter(h=>Number(h?.time)>=cutoff&&Number(h?.from)>0&&Number(h?.to)>0);
    if(epoch && !events.length) return 0;
    let baseline=Number(p?.rank)||0;
    [...events].sort((a,b)=>Number(b.time)-Number(a.time)).forEach(h=>{baseline=Number(h.from)||baseline;});
    return baseline-(Number(p?.rank)||baseline);
  }
  function autoAchievementKeys(p){
    const out=[]; const epoch=Number(p?.achievementEpoch)||0; const ageBase=Math.max(Number(p?.createdAt)||Date.now(),epoch); const age=Date.now()-ageBase;
    const events=(Array.isArray(p?.rankHistory)?p.rankHistory:[]).filter(h=>Number(h?.time)>=epoch);
    const firstAfterReset=epoch ? events.some(h=>Number(h?.to)===1) : ((Number(p?.bestRank)||Number(p?.rank)||9999)<=1);
    if(firstAfterReset) out.push('first_number'); if(publicTrendDelta(p,7)>=5) out.push('breakthrough'); if(age>=100*DAY_MS) out.push('centurion'); if(age>=30*DAY_MS) out.push('veteran_rare'); return out;
  }
  function combinedAchievementKeys(p){return [...new Set([...(Array.isArray(p?.achievements)?p.achievements:[]),...autoAchievementKeys(p)])].filter(x=>ACHIEVEMENTS[x]);}
  const BUSINESS_TYPES={gas:['⛽','АЗС'],transport:['🚚','ТК — транспортная компания'],construction:['🏗️','СК — строительная компания'],weapon:['🔫','Магазин амуниции / оружия'],shop247:['🛒','Магазин 24/7'],accessories:['👜','Магазин аксессуаров'],clothes:['👕','Магазин одежды'],dealership:['🚘','Автосалон'],service:['🛠️','СТО'],taxi:['🚕','Таксопарк'],casino:['🎰','Казино'],snack:['🥤','Закусочная'],stall:['🌭','Ларёк'],tuning:['🏎️','Стайлинг-центр'],tire:['🛞','Шиномонтажный центр'],tech:['🔧','Технический центр'],nightclub:['🌙','Ночной клуб'],fishing:['🎣','Рыболовный магазин'],other:['🏢','Другое']};
  function normalizeBusinesses(v){return (Array.isArray(v)?v:[]).slice(0,20).map((b,i)=>({id:String(b?.id||`biz-${i+1}`),type:BUSINESS_TYPES[b?.type]?b.type:'other',number:String(b?.number||''),location:String(b?.location||''),name:String(b?.name||''),value:String(b?.value||''),main:!!b?.main}));}
  function normalizeProperties(v){return (Array.isArray(v)?v:[]).filter(x=>String(x?.kind||'house')!=='garage').slice(0,20).map((x,i)=>({id:String(x?.id||`prop-${i+1}`),kind:'house',number:String(x?.number||''),location:String(x?.location||''),note:String(x?.note||''),value:String(x?.value||''),main:!!x?.main}));}
  function normalizeGarages(v,legacyProperties=[]){
    const direct=Array.isArray(v)?v:[];
    const legacy=(Array.isArray(legacyProperties)?legacyProperties:[]).filter(x=>String(x?.kind||'')==='garage');
    const seen=new Set();
    return [...direct,...legacy].slice(0,20).map((x,i)=>({id:String(x?.id||`garage-${i+1}`),kind:'garage',number:String(x?.number||''),location:String(x?.location||''),capacity:String(x?.capacity||''),note:String(x?.note||''),value:String(x?.value||''),main:!!x?.main})).filter(x=>{const k=x.id||`${x.number}|${x.location}`;if(seen.has(k))return false;seen.add(k);return true;});
  }
  const achievementBadges = p => combinedAchievementKeys(p).map(x=>`<a class="achievement-badge a-${x}${ACHIEVEMENTS[x].rare?' rare':''}" href="achievements.html#ach-${x}" title="Как получить: ${ACHIEVEMENTS[x].label}">${ACHIEVEMENTS[x].icon} ${ACHIEVEMENTS[x].label}</a>`).join('');
  function avatarFrameClass(p) {
    const a=new Set(combinedAchievementKeys(p));
    for(const key of ['founder','developer','blogger','legend','top','vip','veteran','newbie']) if(a.has(key)) return `avatar-frame-${key}`;
    return '';
  }
  let players = loadPlayers();
  let wealthMap = migrateWealth(readJSON(KEYS.wealth, {}));
  let meta = readJSON(KEYS.meta, {});
  let achievementSyncReady=false;
  function showAchievementUnlock(player,key){ return; }
  function detectAchievementUnlocks(nextPlayers){
    if(!achievementSyncReady){achievementSyncReady=true;return;}
    const oldMap=new Map(players.map(p=>[p.id,new Set(combinedAchievementKeys(p))]));
    const gained=[];
    nextPlayers.forEach(p=>{const old=oldMap.get(p.id)||new Set();combinedAchievementKeys(p).forEach(k=>{if(!old.has(k))gained.push({p,k});});});
    if(gained.length){const rare=gained.find(x=>ACHIEVEMENTS[x.k]?.rare)||gained[0];showAchievementUnlock(rare.p,rare.k);}
  }


  // Firebase public realtime sync. Visitors can read /players and /settings.
  let fbDb = null;
  function initFirebasePublic() {
    if (fbDb) return true;
    if (!window.BR_FIREBASE_CONFIG || !window.firebase) return false;
    try {
      if (!firebase.apps.length) firebase.initializeApp(window.BR_FIREBASE_CONFIG);
      fbDb = firebase.database();
      return true;
    } catch (err) {
      console.error('Firebase init error', err);
      return false;
    }
  }

  function firebaseArray(v) {
    if (Array.isArray(v)) return v.filter(Boolean);
    if (v && typeof v === 'object') {
      return Object.keys(v)
        .sort((a,b) => (Number(a) || 0) - (Number(b) || 0))
        .map(k => v[k])
        .filter(Boolean);
    }
    return [];
  }

  function applyCloudPlayers(raw) {
    const arr = firebaseArray(raw);
    if (!arr.length) return;
    const nextWealth = {};
    arr.forEach(x => {
      const id = String(x?.id || '');
      const amount = String(x?.amount || '').trim();
      if (id && amount) nextWealth[id] = amount;
    });
    const nextPlayers = normalizePlayers(arr);
    detectAchievementUnlocks(nextPlayers);
    players = nextPlayers;
    wealthMap = nextWealth;
    try {
      localStorage.setItem(PLAYER_KEY, JSON.stringify(players));
      if (KEYS.wealth) localStorage.setItem(KEYS.wealth, JSON.stringify(wealthMap));
    } catch {}
    renderPodium();
    renderList();
    updateStats();
    updateOwnerAvatar();
    publishMiniProfilePlayers();
    maybeOpenRequestedProfile();
  }

  function detectDevice() {
    const ua = navigator.userAgent || '';
    const tablet = /iPad|Tablet|PlayBook|Silk/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua));
    if (tablet) return 'tablet';
    if (/Mobi|Android|iPhone|iPod/i.test(ua)) return 'mobile';
    return 'pc';
  }

  function randomId(prefix) {
    try { return `${prefix}-${crypto.randomUUID()}`; } catch { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
  }

  function startFirebaseAnalytics() {
    if (!fbDb) return;
    const VISITOR_KEY='br78_visitor_id_v1';
    const SESSION_CLOUD_KEY='br78_cloud_session_id_v1';
    const LAST_CLOUD_VISIT_KEY='br78_cloud_last_unique_visit_v1';
    const UNIQUE_WINDOW=24*60*60*1000;
    let visitorId=localStorage.getItem(VISITOR_KEY);
    if(!visitorId){ visitorId=randomId('v'); localStorage.setItem(VISITOR_KEY,visitorId); }
    let sessionId=sessionStorage.getItem(SESSION_CLOUD_KEY);
    if(!sessionId){ sessionId=randomId('s'); sessionStorage.setItem(SESSION_CLOUD_KEY,sessionId); }
    const device=detectDevice(), now=Date.now(), day=dayKey(now);
    const lastVisit=Number(localStorage.getItem(LAST_CLOUD_VISIT_KEY)||0);
    if(!lastVisit || now-lastVisit>=UNIQUE_WINDOW){
      const payload={ts:now,day,device,visitorId,sessionId};
      fbDb.ref('stats/visits').push(payload).then(()=>{
        localStorage.setItem(LAST_CLOUD_VISIT_KEY,String(now));
      }).catch(err=>console.warn('Stats visit write denied',err?.code||err));
    }
    const presenceRef=fbDb.ref(`stats/presence/${sessionId.replace(/[.#$\[\]\/]/g,'_')}`);
    const updatePresence=()=>presenceRef.set({visitorId,device,lastSeen:Date.now()}).catch(()=>{});
    updatePresence();
    presenceRef.onDisconnect().remove().catch(()=>{});
    setInterval(updatePresence,45000);
  }

  const SITE_DEFAULTS = {
    name: 'BLACK RUSSIA • FORBES',
    subtitle: 'SERVER 78 • VLADIMIR',
    footerText: 'Неофициальная страница рейтинга сообщества.',
    ownerLabel: 'Автор проекта',
    ownerName: 'Calypso_Person',
    ownerRoles: 'Основатель • Разработчик • Блогер',
    ownerBio: 'Создатель и автор BLACK RUSSIA FORBES 78. Развивает рейтинг, админ-панель и новые функции проекта.',
    ownerVk: 'https://vk.ru/ha1333ha',
    theme: 'black-red',
    customAccent: '#ff3347',
    glass: true,
    performanceMode: 'balanced'
  };

  function siteSettings() {
    const x = meta && meta.siteSettings && typeof meta.siteSettings === 'object' ? meta.siteSettings : {};
    return {...SITE_DEFAULTS, ...x};
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  const ANNOUNCEMENT_DISMISS_KEY='br78_dismissed_announcement_v1';
  let announcementTimer=null;
  const THEMES=new Set(['black-red','cyber-blue','gold','neon-purple','dark','custom']);

  function renderAnnouncement() {
    const section=$('#announcementSection');
    if(!section) return;
    const a=meta && meta.announcement && typeof meta.announcement==='object' ? meta.announcement : null;
    const now=Date.now();
    if(!a || !String(a.text||'').trim() || Number(a.expiresAt||0)<=now){
      section.classList.add('hidden');
      return;
    }
    const id=String(a.id||a.createdAt||'');
    if(id && localStorage.getItem(ANNOUNCEMENT_DISMISS_KEY)===id){
      section.classList.add('hidden');
      return;
    }
    setText('announcementAuthor',String(a.author||'Calypso_Person'));
    setText('announcementText',String(a.text||''));
    setText('announcementTime',fmtDate(Number(a.createdAt)||now));
    const pin=$('#announcementPinned');
    if(pin) pin.style.display=a.pinned?'inline-flex':'none';
    section.dataset.announcementId=id;
    section.classList.remove('hidden');
    clearTimeout(announcementTimer);
    const wait=Math.max(1000,Number(a.expiresAt||0)-now+100);
    announcementTimer=setTimeout(renderAnnouncement,Math.min(wait,2147483647));
  }

  function updateOwnerAvatar() {
    const x = siteSettings();
    const wanted = String(x.ownerName || 'Calypso_Person').trim().toLowerCase();
    const ownerPlayer = players.find(p => String(p?.nick || '').trim().toLowerCase() === wanted)
      || players.find(p => String(p?.name || '').trim().toLowerCase() === wanted)
      || players.find(p => String(p?.nick || '').trim().toLowerCase() === 'calypso_person');
    const src = safeAvatarSrc(ownerPlayer?.avatar || '');
    const initialsText = ownerPlayer ? initials(ownerPlayer) : 'CP';
    const targets = [
      [document.querySelector('.creator-icon'), '👑'],
      [document.querySelector('.owner-easter-avatar'), initialsText]
    ];
    targets.forEach(([el, fallback]) => {
      if (!el) return;
      el.classList.toggle('has-photo', !!src);
      if (src) {
        if (el.dataset.avatarSrc !== src) {
          el.textContent = '';
          const img = document.createElement('img');
          img.src = src;
          img.alt = `Фото ${String(x.ownerName || 'Calypso_Person')}`;
          img.loading = 'lazy';
          img.decoding = 'async';
          el.appendChild(img);
          el.dataset.avatarSrc = src;
        }
      } else {
        el.removeAttribute('data-avatar-src');
        el.textContent = fallback;
      }
    });
  }

  function applySiteSettings() {
    const x = siteSettings();
    const projectTheme=THEMES.has(x.theme)?x.theme:'black-red';
    const localPrefs=window.BRUserSettings?.get?.();
    const theme=localPrefs && localPrefs.theme && localPrefs.theme!=='inherit' ? localPrefs.theme : projectTheme;
    document.documentElement.dataset.theme=theme;
    const accent=/^#[0-9a-f]{6}$/i.test(String(x.customAccent||''))?x.customAccent:'#ff3347';
    document.documentElement.style.setProperty('--custom-accent',accent);
    document.documentElement.classList.toggle('glass-mode',x.glass!==false);
    window.BRPerformance?.setDefault(x.performanceMode||'balanced');
    setText('siteBrandName', x.name);
    setText('siteBrandSubtitle', x.subtitle);
    setText('footerSiteName', x.name);
    setText('footerSiteSubtitle', x.footerText);
    setText('ownerLabel', x.ownerLabel);
    setText('ownerName', x.ownerName);
    setText('ownerRoles', x.ownerRoles);
    setText('ownerModalLabel', `👑 ${x.ownerLabel}`);
    setText('ownerModalName', x.ownerName);
    setText('ownerModalRoles', x.ownerRoles);
    setText('ownerModalBio', x.ownerBio);
    const ownerVk=document.getElementById('ownerVkLink'); if(ownerVk){ ownerVk.href=x.ownerVk||'https://vk.ru/ha1333ha'; ownerVk.style.display=(x.ownerVk||'').trim()?'inline-flex':'none'; }
    updateOwnerAvatar();
    renderAnnouncement();
  }

  const WEEK_MS=7*24*60*60*1000;
  function trendInfo(p,days=7){
    const now=Date.now(), cutoff=now-days*24*60*60*1000;
    const events=(Array.isArray(p?.rankHistory)?p.rankHistory:[]).filter(h=>Number(h?.time)>=cutoff&&Number(h?.from)>0&&Number(h?.to)>0);
    let baseline=Number(p?.rank)||0;
    [...events].sort((a,b)=>Number(b.time)-Number(a.time)).forEach(h=>{baseline=Number(h.from)||baseline;});
    const current=Number(p?.rank)||baseline;
    return {baseline,current,delta:baseline-current,events,cutoff,now};
  }
  function trendPoints(p,days=7){
    const info=trendInfo(p,days);
    const points=[{time:info.cutoff,rank:info.baseline}];
    [...info.events].sort((a,b)=>Number(a.time)-Number(b.time)).forEach(h=>points.push({time:Number(h.time),rank:Number(h.to)}));
    if(!points.length || points[points.length-1].rank!==info.current || info.now-points[points.length-1].time>1000) points.push({time:info.now,rank:info.current});
    return {info,points};
  }
  function movementBadgeHtml(p,compact=false){
    const {delta}=trendInfo(p,7);
    const cls=delta>0?'up':delta<0?'down':'flat';
    const icon=delta>0?'↑':delta<0?'↓':'—';
    const num=delta>0?`+${delta}`:delta<0?`${delta}`:'0';
    const text=compact?`${icon} ${num}`:`${icon} ${num} за 7 дней`;
    return `<span class="movement-badge ${cls}${compact?' compact':''}" title="Динамика места за 7 дней">${text}</span>`;
  }
  function sparklineHtml(p,extraClass=''){
    const {points}=trendPoints(p,7);
    const w=96,h=32,pad=4;
    const ranks=points.map(x=>Number(x.rank)||1);
    const min=Math.min(...ranks), max=Math.max(...ranks), range=Math.max(1,max-min);
    const minT=Math.min(...points.map(x=>x.time)), maxT=Math.max(...points.map(x=>x.time)), tRange=Math.max(1,maxT-minT);
    const coords=points.map(pt=>{
      const x=pad+((pt.time-minT)/tRange)*(w-pad*2);
      const y=pad+((Number(pt.rank)-min)/range)*(h-pad*2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    const {delta}=trendInfo(p,7); const cls=delta>0?'up':delta<0?'down':'flat';
    return `<svg class="rank-spark ${cls} ${extraClass}" viewBox="0 0 ${w} ${h}" aria-label="График позиции за 7 дней" role="img"><polyline points="${coords}"></polyline></svg>`;
  }

  function safeAvatarSrc(v = '') {
    const src = String(v || '').trim();
    return /^(data:image\/(png|jpe?g|webp);base64,|https:\/\/)/i.test(src) ? src : '';
  }

  function profileAvatarHtml(p) {
    const src = safeAvatarSrc(p.avatar), frame = avatarFrameClass(p);
    return src
      ? `<div class="avatar avatar-photo ${frame}"><img src="${escapeHtml(src)}" alt="Фото ${escapeHtml(p.nick)}"></div>`
      : `<div class="avatar ${frame}">${initials(p)}</div>`;
  }

  function rankAvatarHtml(p) {
    const src = safeAvatarSrc(p.avatar), frame = avatarFrameClass(p);
    const avatar=src
      ? `<span class="rank-avatar rank-avatar-photo ${frame}"><img src="${escapeHtml(src)}" alt=""></span>`
      : `<span class="rank-avatar ${frame}">${escapeHtml(initials(p))}</span>`;
    return `<span class="rank-avatar-stack">${avatar}${movementBadgeHtml(p,true)}</span>`;
  }

  function podiumAvatarHtml(p) {
    const src=safeAvatarSrc(p.avatar), frame=avatarFrameClass(p);
    const avatar=src
      ? `<div class="podium-avatar ${frame}"><img src="${escapeHtml(src)}" alt="Фото ${escapeHtml(p.nick)}"></div>`
      : `<div class="podium-avatar ${frame}">${escapeHtml(initials(p))}</div>`;
    return `<div class="podium-avatar-wrap">${avatar}${movementBadgeHtml(p,false)}</div>`;
  }

  function startFirebasePublicSync() {
    if (!initFirebasePublic()) return;
    startFirebaseAnalytics();
    fbDb.ref('players').on('value', snap => {
      if (snap.exists()) applyCloudPlayers(snap.val());
    }, err => console.error('Firebase players read error', err));
    fbDb.ref('settings').on('value', snap => {
      const val = snap.val();
      if (val && typeof val === 'object') {
        meta = val;
        try { if (KEYS.meta) localStorage.setItem(KEYS.meta, JSON.stringify(meta)); } catch {}
        updateStats();
        applySiteSettings();
      }
    }, err => console.error('Firebase settings read error', err));
  }

  const STATS_KEY = KEYS.stats || 'br78_forbes_stats_v1';
  const SESSION_KEY = 'br78_forbes_visit_session_v1';

  function dayKey(ts = Date.now()) {
    const d = new Date(ts);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function trackVisit() {
    const now = Date.now();
    const today = dayKey(now);
    const LOCAL_LAST='br78_local_unique_visit_24h_v1';
    const last=Number(localStorage.getItem(LOCAL_LAST)||0);
    const stats = readJSON(STATS_KEY, {totalViews:0,totalSessions:0,viewsByDay:{},sessionsByDay:{},recent:[]});
    if(!last || now-last>=24*60*60*1000){
      stats.totalViews = Number(stats.totalViews || 0) + 1;
      stats.viewsByDay = stats.viewsByDay && typeof stats.viewsByDay === 'object' ? stats.viewsByDay : {};
      stats.sessionsByDay = stats.sessionsByDay && typeof stats.sessionsByDay === 'object' ? stats.sessionsByDay : {};
      stats.viewsByDay[today] = Number(stats.viewsByDay[today] || 0) + 1;
      stats.totalSessions = Number(stats.totalSessions || 0) + 1;
      stats.sessionsByDay[today] = Number(stats.sessionsByDay[today] || 0) + 1;
      stats.recent = Array.isArray(stats.recent) ? stats.recent : [];
      stats.recent.unshift(now);
      stats.recent = stats.recent.slice(0, 60);
      localStorage.setItem(LOCAL_LAST,String(now));
      localStorage.setItem(STATS_KEY, JSON.stringify(stats));
      if(KEYS.visitors) localStorage.setItem(KEYS.visitors, String(stats.totalViews));
    }
    return Number(stats.totalViews||0);
  }

  const visits = trackVisit();
  const vc = $('#visitCount');
  if (vc) vc.textContent = visits;

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

  function normalizePlayers(arr) {
    const baseIdByNick = new Map((window.BR_PLAYERS || []).map((p, i) => [p.nick, p.id || `base-${i + 1}`]));
    const used = new Set();
    return (Array.isArray(arr) ? arr : []).map((p, i) => {
      let id = String(p?.id || '');
      if (!id) {
        const base = baseIdByNick.get(p?.nick);
        id = base && !used.has(base) ? base : `legacy-${i + 1}-${String(p?.nick || 'player').replace(/[^a-z0-9_-]+/gi, '-')}`;
      }
      while (used.has(id)) id += '-x';
      used.add(id);
      return {
        id,
        nick: String(p?.nick || `Player_${i + 1}`),
        name: String(p?.name || ''),
        vk: String(p?.vk || '#'),
        rank: i + 1,
        createdAt: Number(p?.createdAt) || Date.now(),
        bestRank: Number(p?.bestRank) > 0 ? Math.min(Number(p.bestRank), i + 1) : i + 1,
        achievements: Array.isArray(p?.achievements) ? [...new Set(p.achievements.filter(x => ACHIEVEMENTS[x]))] : [],
        achievementEpoch: Number(p?.achievementEpoch) || 0,
        avatar: String(p?.avatar || ''),
        businesses: normalizeBusinesses(p?.businesses),
        properties: normalizeProperties(p?.properties),
        garages: normalizeGarages(p?.garages,p?.properties),
        rankHistory: Array.isArray(p?.rankHistory) ? p.rankHistory.slice(0,30).map(h=>({time:Number(h?.time)||0,from:Number(h?.from)||0,to:Number(h?.to)||0})).filter(h=>h.time&&h.from&&h.to) : []
      };
    });
  }

  function loadPlayers() {
    const stored = readArrayExact(PLAYER_KEY);
    if (stored !== null) return normalizePlayers(stored);

    const legacyOrder = readArrayExact(LEGACY_ORDER_KEY);
    const legacyCustom = readArrayExact(LEGACY_CUSTOM_KEY) || [];
    const source = legacyOrder && legacyOrder.length
      ? legacyOrder
      : [...(window.BR_PLAYERS || []), ...legacyCustom];

    return normalizePlayers(source);
  }

  function migrateWealth(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const next = {};
    players.forEach(p => {
      const byId = source[p.id];
      const byRank = source[String(p.rank)] ?? source[p.rank];
      const v = byId !== undefined ? byId : byRank;
      if (String(v ?? '').trim()) next[p.id] = String(v).trim();
    });
    Object.keys(source).forEach(k => {
      if (!/^\d+$/.test(k) && !Object.prototype.hasOwnProperty.call(next, k) && String(source[k] ?? '').trim()) next[k] = source[k];
    });
    return next;
  }

  function getWealth(p) { return String(wealthMap[p.id] || '').trim(); }
  function assetValuesTotal(p){return normalizeBusinesses(p?.businesses).reduce((s,b)=>s+(parseMoneyAmount(b.value)||0),0)+normalizeProperties(p?.properties).reduce((s,x)=>s+(parseMoneyAmount(x.value)||0),0)+normalizeGarages(p?.garages,p?.properties).reduce((s,x)=>s+(parseMoneyAmount(x.value)||0),0);}
  function playerNetWorth(p){return Math.max(0,(parseMoneyAmount(getWealth(p))||0)+assetValuesTotal(p));}
  function parseMoneyAmount(raw) {
    let s=String(raw??'').trim().toLowerCase().replace(/\u00a0/g,' '); if(!s)return null;
    s=s.replace(/₽|руб(?:\.|лей|ля)?/gi,'').trim();let mult=1;
    const unit=(s.match(/(ккк|kkk|млрд(?:\.|а|ов)?|миллиард(?:а|ов)?|кк|kk|млн(?:\.|а|ов)?|миллион(?:а|ов)?|к|k|тыс(?:\.|яч(?:а|и)?)?)\s*$/i)||[])[1]||'';
    if(unit){const u=unit.toLowerCase();if(/^(ккк|kkk|млрд|миллиард)/.test(u))mult=1e9;else if(/^(кк|kk|млн|миллион)/.test(u))mult=1e6;else if(/^(к|k|тыс)/.test(u))mult=1e3;s=s.slice(0,s.length-unit.length).trim();}
    s=s.replace(/\s+/g,'').replace(',','.');if(!/^[-+]?\d+(?:\.\d+)?$/.test(s))return null;const n=Number(s)*mult;return Number.isFinite(n)?n:null;
  }
  function compactMoney(raw){const n=parseMoneyAmount(raw);if(n===null)return String(raw??'').trim();const a=Math.abs(n);let d=1,u='';if(a>=1e12){d=1e12;u='трлн';}else if(a>=1e9){d=1e9;u='млрд';}else if(a>=1e6){d=1e6;u='млн';}else if(a>=1e3){d=1e3;u='тыс.';}const v=n/d,max=Math.abs(v)>=100?0:Math.abs(v)>=10?1:2;const text=new Intl.NumberFormat('ru-RU',{maximumFractionDigits:max}).format(v);return u?`${text} ${u}`:new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0}).format(n);}
  function wealthLabel(p) { const total=playerNetWorth(p); return total>0 ? compactMoney(total) : 'Не указано'; }
  function publishMiniProfilePlayers(){
    const rows=players.map(p=>({...p,displayWealth:wealthLabel(p)}));
    window.BR_MINIPROFILE_PLAYERS=rows;
    try{window.dispatchEvent(new CustomEvent('br:miniprofile-players',{detail:rows}));}catch{}
  }
  function escapeHtml(v = '') {
    return String(v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  }
  function initials(p) {
    return (p.nick || 'BR').split('_').slice(0, 2).map(x => x[0]).join('').toUpperCase();
  }
  function fmtDate(ts) {
    if (!ts) return 'ещё не обновлялось';
    try {
      return new Intl.DateTimeFormat('ru-RU', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(ts));
    } catch {
      return '—';
    }
  }
  function podiumClass(rank) { return rank === 1 ? 'first' : rank === 2 ? 'second' : 'third'; }
  function rankProgressHtml(p, compact=false) { return ''; }
  function rankMedal(rank){ return String(rank); }
  const vkIcon = '<span aria-hidden="true" style="font-weight:950">VK</span>';

  const LAST_TOP1_KEY='br78_last_top1_fb17';
  function celebrateNewTop1(){ const leader=players[0]; if(!leader) return; localStorage.setItem(LAST_TOP1_KEY,leader.id); }

  function renderPodium() {
    if (!podiumGrid) return;
    const top=players.slice(0,3);
    const order=[top[1],top[0],top[2]].filter(Boolean);
    const placeLabel=r=>r===1?'ПЕРВОЕ МЕСТО':r===2?'ВТОРОЕ МЕСТО':'ТРЕТЬЕ МЕСТО';
    const crownSvg='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6.5 7.4 10 12 4l4.6 6L21 6.5l-1.7 10H4.7L3 6.5Zm2.6 12h12.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    podiumGrid.innerHTML = order.map(p => {
      const delta=trendInfo(p,7).delta;
      const trendClass=delta>0?'up':delta<0?'down':'flat';
      const trendText=delta>0?`ПОДНЯЛСЯ НА ${delta}`:delta<0?`ОПУСТИЛСЯ НА ${Math.abs(delta)}`:'ПОЗИЦИЯ БЕЗ ИЗМЕНЕНИЙ';
      return `<article class="podium-card elite-top-card ${podiumClass(p.rank)}" data-profile="${escapeHtml(p.id)}" data-rank="${p.rank}" tabindex="0" role="button" aria-label="Открыть профиль ${escapeHtml(p.nick)}"><div class="elite-top-aura" aria-hidden="true"></div><div class="elite-place-head"><span class="elite-rank-number">${p.rank}</span><span class="elite-place-label">${placeLabel(p.rank)}</span>${p.rank===1?`<span class="elite-crown">${crownSvg}</span>`:''}</div><div class="elite-avatar-shell">${podiumAvatarHtml(p)}</div><div class="podium-nick">${escapeHtml(p.nick)}</div><div class="podium-name">${escapeHtml(p.name||'Имя не указано')}</div><div class="elite-top-meta"><span class="elite-trend ${trendClass}">${trendText}</span><span class="elite-best">ЛУЧШЕЕ #${Number(p.bestRank)||p.rank}</span></div><div class="achievement-line public-achievements elite-achievements">${achievementBadges(p)}</div><div class="elite-wealth"><small>ОБЩЕЕ СОСТОЯНИЕ</small><strong>${escapeHtml(wealthLabel(p))}</strong><span>деньги + имущество</span></div><div class="podium-actions elite-actions"><span class="rank-caption">SERVER 78 • VLADIMIR</span><a class="vk-link" href="${escapeHtml(p.vk)}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">${vkIcon}</a></div></article>`;
    }).join('');
    celebrateNewTop1();
  }

  function filteredPlayers() {
    const q = (searchInput?.value || '').trim().toLocaleLowerCase('ru');
    return players.filter(p => {
      const achText=combinedAchievementKeys(p).map(x=>`${x} ${ACHIEVEMENTS[x]?.label||''}`).join(' ');
      const textMatch = !q || `${p.nick} ${p.name} ${p.vk||''} ${achText}`.toLocaleLowerCase('ru').includes(q);
      const amountMatch = currentFilter === 'filled' ? playerNetWorth(p)>0 : currentFilter === 'empty' ? playerNetWorth(p)<=0 : currentFilter === 'business' ? normalizeBusinesses(p.businesses).length>0 : currentFilter === 'house' ? normalizeProperties(p.properties).length>0 : currentFilter === 'garage' ? normalizeGarages(p.garages,p.properties).length>0 : (ACHIEVEMENTS[currentFilter] ? combinedAchievementKeys(p).includes(currentFilter) : true);
      return textMatch && amountMatch;
    });
  }

  let renderListFrame=0;
  let renderListDebounce=0;
  function scheduleRenderList(delay=0){
    clearTimeout(renderListDebounce);
    const run=()=>{if(renderListFrame)cancelAnimationFrame(renderListFrame);renderListFrame=requestAnimationFrame(()=>{renderListFrame=0;renderList();});};
    if(delay>0) renderListDebounce=setTimeout(run,delay); else run();
  }
  function renderList() {
    if (!ranking) return;
    const filtered = filteredPlayers();
    ranking.innerHTML = filtered.map(p => `<div class="rank-row" data-rank="${p.rank}" data-profile="${escapeHtml(p.id)}" tabindex="0" role="button"><div class="rank-place"><div class="rank-num${p.rank<=3?' rank-num-medal':''}"><span>${rankMedal(p.rank)}</span></div>${rankAvatarHtml(p)}</div><div class="identity"><div class="identity-top"><strong>${escapeHtml(p.nick)}</strong>${movementBadgeHtml(p,true)}</div><span class="rank-server">SERVER 78 • VLADIMIR</span><div class="achievement-line public-achievements">${achievementBadges(p)}</div></div><div class="person-name"><span>Игрок</span><b>${escapeHtml(p.name||'Не указано')}</b></div><div class="wealth-cell"><span>Состояние</span><b>${escapeHtml(wealthLabel(p))}</b></div><div class="row-action"><a class="vk-link" href="${escapeHtml(p.vk)}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">${vkIcon}</a></div></div>`).join('');
    if (emptyState) emptyState.style.display = filtered.length ? 'none' : 'block';
    if (resultCount) resultCount.textContent = `Показано ${filtered.length} из ${players.length}`;
    if (visibleCount) visibleCount.textContent = filtered.length;
  }

  function updateStats() {
    if (filledCount) filledCount.textContent = players.filter(p => playerNetWorth(p)>0).length;
    if (updatedAt) updatedAt.textContent = fmtDate(meta.updatedAt);
    const playerCountMeta = $('#playerCountMeta');
    const ratingMax = $('#ratingMax');
    const topCount = $('#topCount');
    if (playerCountMeta) playerCountMeta.textContent = players.length;
    if (ratingMax) ratingMax.textContent = players.length;
    if (topCount) topCount.textContent = players.length;
  }

  function openProfile(id) {
    const p = players.find(x => x.id === id);
    if (!p || !modal || !profileContent) return;
    const rankHistory = (Array.isArray(p.rankHistory) ? p.rankHistory : []).slice(0, 6);
    const rankHistoryHtml = rankHistory.length
      ? `<div class="profile-history"><div class="profile-history-title">История позиции</div>${rankHistory.map(h => { const up=Number(h.to)<Number(h.from); return `<div class="profile-history-row"><span class="rank-move ${up?'up':'down'}">${up?'↑':'↓'} #${Number(h.from)} → #${Number(h.to)}</span><time>${escapeHtml(fmtDate(Number(h.time)))}</time></div>`; }).join('')}</div>`
      : `<div class="profile-history profile-history-empty"><div class="profile-history-title">История позиции</div><p>Изменений места пока нет.</p></div>`;
    profileContent.innerHTML = `<div class="profile-brandline"><b>BLACK RUSSIA</b><span>VLADIMIR / 78</span></div><h2 class="profile-modal-title">Профиль игрока</h2><div class="profile-head">${profileAvatarHtml(p)}<div class="profile-title"><h3>${escapeHtml(p.nick)}</h3><p>${escapeHtml(p.name)}</p><div class="achievement-line public-achievements">${achievementBadges(p)}</div></div></div><div class="profile-feature"><div class="profile-feature-rank"><i>♛</i><div><span>Место в рейтинге</span><b>#${p.rank}</b></div></div><div class="profile-feature-wealth"><span>Состояние</span><b>${escapeHtml(wealthLabel(p))}</b><small>Деньги + бизнесы + дома + гаражи</small></div></div><div class="profile-grid"><div class="profile-stat"><span>Лучшее место</span><b>#${Number(p.bestRank)||p.rank}</b></div><div class="profile-stat"><span>В рейтинге</span><b>${Math.max(1,Math.floor((Date.now()-(Number(p.createdAt)||Date.now()))/DAY_MS)+1)} дн.</b></div><div class="profile-stat"><span>Сервер</span><b>78 Vladimir</b></div><div class="profile-stat"><span>Обновлено</span><b>${escapeHtml(fmtDate(meta.updatedAt))}</b></div></div><div class="profile-trend-card"><div><small>Динамика за 7 дней</small><b>${movementBadgeHtml(p,false)}</b></div>${sparklineHtml(p,'profile-spark')}</div>${rankHistoryHtml}<div class="profile-actions"><button class="business-count-pill profile-action-card" type="button" data-open-business="${escapeHtml(p.id)}"><span>💼 Бизнесы</span><b>${normalizeBusinesses(p.businesses).length}</b></button><button class="property-count-pill profile-action-card" type="button" data-open-property="${escapeHtml(p.id)}"><span>🏠 Дома</span><b>${normalizeProperties(p.properties).length}</b></button><button class="garage-count-pill profile-action-card" type="button" data-open-garage="${escapeHtml(p.id)}"><span>🚗 Гаражи</span><b>${normalizeGarages(p.garages,p.properties).length}</b></button><a class="vk-link profile-action-card" href="${escapeHtml(p.vk)}" target="_blank" rel="noopener noreferrer"><span>VK</span><b>Открыть ↗</b></a></div>`;
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function businessValue(v){return String(v||'').trim()||'—';}
  function openBusinessModal(id){
    const p=players.find(x=>x.id===id); const modalEl=document.getElementById('businessModal'),content=document.getElementById('businessContent'); if(!p||!modalEl||!content)return;
    const list=normalizeBusinesses(p.businesses); const cards=list.map(b=>{const t=BUSINESS_TYPES[b.type]||BUSINESS_TYPES.other;return `<article class="business-card${b.main?' main':''}">${b.main?'<span class="business-main-badge">ОСНОВНОЙ</span>':''}<div class="business-card-top"><span class="business-icon">${t[0]}</span><div class="business-title"><b>${escapeHtml(b.name||t[1])}${b.number?` #${escapeHtml(b.number)}`:''}</b><span>${escapeHtml(b.location||'Локация не указана')}</span>${b.value?`<em class="asset-value">Оценка для Forbes: ${escapeHtml(compactMoney(b.value))}</em>`:''}</div></div></article>`}).join('');
    content.innerHTML=`<div class="business-modal-head"><div><h3>💼 Бизнесы ${escapeHtml(p.nick)}</h3><p>${list.length?`Предприятий: ${list.length}`:'У игрока пока нет добавленных бизнесов.'}</p></div></div>${list.length?`<div class="business-grid">${cards}</div>`:'<div class="business-empty">Бизнесы пока не указаны.</div>'}`;
    modalEl.classList.add('open'); document.body.style.overflow='hidden';
  }
  function openPropertyModal(id){
    const p=players.find(x=>x.id===id);const modalEl=document.getElementById('propertyModal'),content=document.getElementById('propertyContent');if(!p||!modalEl||!content)return;
    const list=normalizeProperties(p.properties);const cards=list.map(x=>`<article class="property-card${x.main?' main':''}"><div class="property-card-head"><span class="property-card-icon">🏠</span><div><b>Дом${x.number?` #${escapeHtml(x.number)}`:''}</b><span>${escapeHtml(x.location||'Локация не указана')}</span>${x.value?`<em class="asset-value">Оценка для Forbes: ${escapeHtml(compactMoney(x.value))}</em>`:''}</div></div>${x.note?`<div class="property-note">${escapeHtml(x.note)}</div>`:''}</article>`).join('');
    content.innerHTML=`<div class="business-modal-head"><div><h3>🏠 Дома ${escapeHtml(p.nick)}</h3><p>${list.length?`Домов: ${list.length}`:'У игрока пока нет добавленных домов.'}</p></div></div>${list.length?`<div class="property-grid">${cards}</div>`:'<div class="business-empty">Дома пока не указаны.</div>'}`;
    modalEl.classList.add('open');document.body.style.overflow='hidden';
  }
  function openGarageModal(id){
    const p=players.find(x=>x.id===id);const modalEl=document.getElementById('garageModal'),content=document.getElementById('garageContent');if(!p||!modalEl||!content)return;
    const list=normalizeGarages(p.garages,p.properties);
    const cards=list.map(x=>`<article class="garage-card${x.main?' main':''}"><div class="garage-card-head"><span class="garage-card-icon">G</span><div><b>Гараж${x.number?` #${escapeHtml(x.number)}`:''}</b><span>${escapeHtml(x.location||'Локация не указана')}</span>${x.capacity?`<small>Вместимость: ${escapeHtml(x.capacity)}</small>`:''}${x.value?`<em class="asset-value">Оценка для Forbes: ${escapeHtml(compactMoney(x.value))}</em>`:''}</div></div>${x.note?`<div class="garage-note">${escapeHtml(x.note)}</div>`:''}</article>`).join('');
    content.innerHTML=`<div class="business-modal-head"><div><h3>Гаражи ${escapeHtml(p.nick)}</h3><p>${list.length?`Гаражей: ${list.length}`:'У игрока пока нет добавленных гаражей.'}</p></div></div>${list.length?`<div class="garage-grid">${cards}</div>`:'<div class="business-empty">Гаражи пока не указаны.</div>'}`;
    modalEl.classList.add('open');document.body.style.overflow='hidden';
  }
  function closeGarageModal(){document.getElementById('garageModal')?.classList.remove('open');if(!modal?.classList.contains('open'))document.body.style.overflow='';}
  function closeBusinessModal(){document.getElementById('businessModal')?.classList.remove('open');if(!modal?.classList.contains('open'))document.body.style.overflow='';}
  function closePropertyModal(){document.getElementById('propertyModal')?.classList.remove('open');if(!modal?.classList.contains('open'))document.body.style.overflow='';}

  let requestedProfileOpened=false;
  function clearProfileQueryParam(){
    try{
      const url=new URL(location.href);
      if(!url.searchParams.has('profile'))return;
      url.searchParams.delete('profile');
      history.replaceState(history.state,'',url.pathname+(url.search||'')+(url.hash||''));
    }catch{}
  }
  function maybeOpenRequestedProfile(){
    if(requestedProfileOpened)return;
    const id=new URLSearchParams(location.search).get('profile');
    if(!id||!players.some(p=>String(p.id)===String(id)))return;
    requestedProfileOpened=true;
    // The query parameter is only a one-time deep-link. Remove it immediately so
    // a normal refresh never re-opens the same profile modal again.
    clearProfileQueryParam();
    setTimeout(()=>openProfile(String(id)),0);
  }

  function closeProfile() {
    clearProfileQueryParam();
    if (modal) {
      modal.classList.remove('open');
      document.body.style.overflow = '';
    }
  }

  function showToast(text) { return; }

  searchInput?.addEventListener('input', () => scheduleRenderList(120));
  filterButtons.forEach(btn => btn.addEventListener('click', () => {
    currentFilter = btn.dataset.filter;
    filterButtons.forEach(b => b.classList.toggle('active', b === btn));
    scheduleRenderList();
  }));

  const ownerModal = $('#ownerModal');
  function openOwner() {
    applySiteSettings();
    ownerModal?.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeOwner() {
    ownerModal?.classList.remove('open');
    if (!modal?.classList.contains('open')) document.body.style.overflow = '';
  }
  $('#creatorTrigger')?.addEventListener('click', openOwner);
  $('#announcementClose')?.addEventListener('click',()=>{
    const section=$('#announcementSection');
    const id=section?.dataset.announcementId||'';
    if(id) localStorage.setItem(ANNOUNCEMENT_DISMISS_KEY,id);
    section?.classList.add('hidden');
  });

  document.addEventListener('click', e => {
    const businessBtn=e.target.closest('[data-open-business]'); if(businessBtn){e.preventDefault();e.stopPropagation();openBusinessModal(businessBtn.dataset.openBusiness);return;}
    if(e.target.matches('[data-close-business]')){closeBusinessModal();return;}
    const propertyBtn=e.target.closest('[data-open-property]'); if(propertyBtn){e.preventDefault();e.stopPropagation();openPropertyModal(propertyBtn.dataset.openProperty);return;}
    if(e.target.matches('[data-close-property]')){closePropertyModal();return;}
    const garageBtn=e.target.closest('[data-open-garage]'); if(garageBtn){e.preventDefault();e.stopPropagation();openGarageModal(garageBtn.dataset.openGarage);return;}
    if(e.target.matches('[data-close-garage]')){closeGarageModal();return;}
    if (e.target.closest('.achievement-badge')) return;
    const target = e.target.closest('[data-profile]');
    if (target) openProfile(target.dataset.profile);
    if (e.target.matches('[data-close-modal]')) closeProfile();
    if (e.target.matches('[data-close-owner]')) closeOwner();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeGarageModal(); closePropertyModal(); closeBusinessModal(); closeProfile(); closeOwner(); }
    const t = e.target.closest?.('[data-profile]');
    if (t && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      openProfile(t.dataset.profile);
    }
  });

  window.addEventListener('storage', e => {
    if (e.key === PLAYER_KEY) {
      players = loadPlayers();
      wealthMap = migrateWealth(readJSON(KEYS.wealth, {}));
      renderPodium();
      renderList();
      updateStats();
      updateOwnerAvatar();
      publishMiniProfilePlayers();
      showToast('Список игроков обновлён');
      return;
    }
    if (e.key === KEYS.wealth || e.key === KEYS.meta) {
      wealthMap = migrateWealth(readJSON(KEYS.wealth, {}));
      meta = readJSON(KEYS.meta, {});
      renderPodium();
      renderList();
      updateStats();
      applySiteSettings();
      showToast('Рейтинг обновлён');
    }
  });

  renderPodium();
  renderList();
  updateStats();
  applySiteSettings();
  publishMiniProfilePlayers();
  maybeOpenRequestedProfile();
  startFirebasePublicSync();
})();
