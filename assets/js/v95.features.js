(()=>{
  const $=s=>document.querySelector(s);
  const $$=s=>[...document.querySelectorAll(s)];
  const root=document.documentElement;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=n=>{n=Number(n)||0;if(n>=1e9)return `${(n/1e9).toLocaleString('ru-RU',{maximumFractionDigits:2})} млрд`;if(n>=1e6)return `${(n/1e6).toLocaleString('ru-RU',{maximumFractionDigits:1})} млн`;if(n>=1e3)return `${Math.round(n/1e3).toLocaleString('ru-RU')} тыс`;return `${Math.round(n).toLocaleString('ru-RU')} ₽`;};
  const parseMoney=v=>{const s=String(v??'').toLowerCase().replace(/\s+/g,'').replace(',','.');const m=s.match(/-?\d+(?:\.\d+)?/);if(!m)return 0;let n=Number(m[0])||0;if(/млрд|billion|bn/.test(s))n*=1e9;else if(/млн|million|mln/.test(s))n*=1e6;else if(/тыс|thousand|k\b/.test(s))n*=1e3;return n;};
  const readPlayers=()=>{try{const key=window.BR_KEYS?.players||'br78_players_state_v1';const v=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(v)?v:[];}catch{return[]}};

  function renderPropertyStats(){
    const players=readPlayers();
    let bc=0,hc=0,gc=0,bv=0,hv=0,gv=0;
    const owners=[];
    for(const p of players){
      const businesses=Array.isArray(p?.businesses)?p.businesses:[];
      const props=Array.isArray(p?.properties)?p.properties:[];
      const homes=props.filter(x=>String(x?.kind||'house')!=='garage');
      const legacyGarages=props.filter(x=>String(x?.kind||'')==='garage');
      const garages=[...(Array.isArray(p?.garages)?p.garages:[]),...legacyGarages];
      const val=(arr)=>arr.reduce((s,x)=>s+parseMoney(x?.value),0);
      const pv=val(businesses)+val(homes)+val(garages);
      bc+=businesses.length;hc+=homes.length;gc+=garages.length;bv+=val(businesses);hv+=val(homes);gv+=val(garages);
      if(businesses.length+homes.length+garages.length)owners.push({nick:String(p?.nick||'Игрок'),count:businesses.length+homes.length+garages.length,value:pv});
    }
    const set=(id,val)=>{const e=document.getElementById(id);if(e)e.textContent=val};
    set('propertyStatBusinesses',String(bc));set('propertyStatHomes',String(hc));set('propertyStatGarages',String(gc));
    set('propertyStatBusinessesValue',money(bv));set('propertyStatHomesValue',money(hv));set('propertyStatGaragesValue',money(gv));set('propertyStatTotalValue',money(bv+hv+gv));
    const box=$('#propertyStatsLeaders');
    if(box){
      const topCount=[...owners].sort((a,b)=>b.count-a.count||b.value-a.value)[0];
      const topValue=[...owners].sort((a,b)=>b.value-a.value||b.count-a.count)[0];
      box.innerHTML=owners.length?`<div><span>Больше всего объектов</span><b>${esc(topCount.nick)}</b><small>${topCount.count} объектов</small></div><div><span>Самое дорогое имущество</span><b>${esc(topValue.nick)}</b><small>${money(topValue.value)}</small></div><div><span>Игроков с имуществом</span><b>${owners.length}</b><small>из ${players.length}</small></div>`:'<div class="notice">Имущество пока не добавлено.</div>';
    }
  }

  // --- Smart low-end mode --------------------------------------------------
  const AUTO_KEY='br78_smart_lowend_v95';
  let longTasks=0, lastTier='';
  const hasManualPerf=()=>window.BRPerformance?.hasOverride?.()===true;
  const calcTier=()=>{
    const hc=Number(navigator.hardwareConcurrency||8),mem=Number(navigator.deviceMemory||8),w=Math.min(innerWidth||9999,screen?.width||9999),save=!!navigator.connection?.saveData,reduced=!!matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let score=0,reasons=[];
    if(hc<=2){score+=4;reasons.push(`${hc} потока`)}else if(hc<=4){score+=2;reasons.push(`${hc} потока`)}
    if(mem&&mem<=2){score+=4;reasons.push(`${mem} ГБ RAM`)}else if(mem&&mem<=4){score+=2;reasons.push(`${mem} ГБ RAM`)}
    if(w<=430){score+=2;reasons.push('телефон')}else if(w<=760){score+=1;reasons.push('узкий экран')}
    if(save){score+=2;reasons.push('экономия трафика')}
    if(reduced){score+=2;reasons.push('reduced motion')}
    if(longTasks>=4){score+=2;reasons.push('долгие кадры')}
    const tier=score>=4?'low':score>=2?'balanced':'full';
    return {tier,score,reasons,hc,mem};
  };
  function applySmartLowEnd(){
    const d=calcTier();lastTier=d.tier;root.dataset.smartLowend=d.tier;
    if(!hasManualPerf()){
      if(d.tier==='low')window.BRPerformance?.setDefault?.('low');
      else if(d.tier==='balanced')window.BRPerformance?.setDefault?.('balanced');
    }
    const status=$('#smartLowEndStatus');if(status)status.textContent=d.tier==='low'?`LOW • ${d.reasons.join(', ')||'авто'}`:d.tier==='balanced'?`BALANCE • ${d.reasons.join(', ')||'авто'}`:'FULL • устройство справляется';
    const dot=$('#smartLowEndDot');if(dot){dot.classList.toggle('off',d.tier==='low');dot.classList.toggle('warn',d.tier==='balanced');}
    try{localStorage.setItem(AUTO_KEY,JSON.stringify({tier:d.tier,score:d.score,reasons:d.reasons,at:Date.now()}))}catch{}
  }
  if('PerformanceObserver'in window){try{const po=new PerformanceObserver(list=>{for(const e of list.getEntries())if(e.duration>120)longTasks++;if(longTasks===4||longTasks===8)applySmartLowEnd();});po.observe({type:'longtask',buffered:true});}catch{}}

  function injectSmartLowEndStatus(){
    const card=[...document.querySelectorAll('.control-center-card')].find(x=>/Стабильность/i.test(x.textContent||''));
    if(!card||$('#smartLowEndStatus'))return;
    const ref=card.querySelector('#safeModeStatus')?.closest('.status-line')||card.querySelector('.status-line');
    const row=document.createElement('div');row.className='status-line';row.innerHTML='<i class="status-dot" id="smartLowEndDot"></i><span id="smartLowEndStatus">Авто-оптимизация…</span>';
    ref?.insertAdjacentElement('afterend',row);
  }

  // --- Read-only mode UI ---------------------------------------------------
  function syncReadOnlyUI(){
    const ro=window.BRAdminAccess?.readOnly===true;document.body.classList.toggle('admin-readonly',ro);
    let banner=$('#readOnlyBanner');
    if(ro&&!banner){banner=document.createElement('div');banner.id='readOnlyBanner';banner.className='readonly-banner';banner.innerHTML='<b>👁 Режим только просмотра</b><span>Изменения данных заблокированы Firebase Rules. Чат доступен.</span>';document.querySelector('.content')?.prepend(banner);}
    if(!ro&&banner)banner.remove();
    const protectedControls=$$('#view-players input:not(#playerSearch),#view-players textarea,#view-players select,#view-admins input,#view-admins textarea,#view-admins select,#view-leaders input,#view-leaders textarea,#view-leaders select,#view-settings input,#view-settings textarea,#view-settings select,#view-events input,#view-events textarea,#view-events select,#view-system input:not(#adminErrorFilter),#view-system textarea,#view-system select:not(#adminErrorFilter)');
    protectedControls.forEach(el=>{if(ro){if(!el.disabled){el.dataset.v95RoDisabled='1';el.disabled=true}}else if(el.dataset.v95RoDisabled==='1'){el.disabled=false;delete el.dataset.v95RoDisabled}});
  }

  // --- Admin chat + live staff presence ------------------------------------
  let chatRef=null,chatHandler=null;
  let presenceRef=null,presenceListRef=null,presenceHandler=null,presenceInfoRef=null,presenceInfoHandler=null;
  let presenceHeartbeat=null,presenceBootTimer=null,presenceAuthUnsub=null,presenceUid='';
  let presenceBlocked=false,presenceBlockCode='',presenceErrorReported=false;
  let lastActivityAt=Date.now(),lastPresenceWriteAt=0,lastPresenceState='online';
  let presenceCache={};
  const CHAT_IDLE_MS=5*60*1000;
  const CHAT_STALE_MS=95*1000;
  const OWNER_PRESENCE_KEY='br78_owner_presence_enabled_v954';
  const chatAccess=()=>!!window.BRAdminAccess?.canView?.('chat');
  const OWNER_UID='6EBZp2WqNsaPscVkdPMso1q6uTg1';
  const isOwner=()=>window.BRAdminAccess?.isOwner===true || authUser()?.uid===OWNER_UID;
  function ownerPresenceEnabled(){
    if(!isOwner())return true;
    try{return localStorage.getItem(OWNER_PRESENCE_KEY)!=='0'}catch{return true}
  }
  function saveOwnerPresenceEnabled(value){try{localStorage.setItem(OWNER_PRESENCE_KEY,value?'1':'0')}catch{}}
  function isPermissionError(e){const x=`${e?.code||''} ${e?.message||e||''}`.toLowerCase();return x.includes('permission_denied')||x.includes('permission denied')||x.includes('permission-denied')}
  function presenceAllowed(){return chatAccess()&&ownerPresenceEnabled()&&!presenceBlocked}
  function updateOwnerPresenceControl(){
    const card=$('#ownerPresenceControl');if(!card)return;
    if(!isOwner()){card.hidden=true;return;}card.hidden=false;
    const dot=$('#ownerPresenceStateDot'),text=$('#ownerPresenceStateText'),btn=$('#toggleOwnerPresenceBtn'),retry=$('#retryOwnerPresenceBtn');
    const enabled=ownerPresenceEnabled();
    if(presenceBlocked){if(dot)dot.className='status-dot off';if(text)text.textContent='Firebase Rules блокируют live-статус';if(btn){btn.textContent=enabled?'Отключить статус':'Включить статус';btn.classList.toggle('danger',enabled)}if(retry)retry.hidden=false;return;}
    if(enabled){if(dot)dot.className='status-dot';if(text)text.textContent='Включён на этом устройстве';if(btn){btn.textContent='Отключить статус';btn.classList.add('danger')}if(retry)retry.hidden=true;}
    else{if(dot)dot.className='status-dot off';if(text)text.textContent='Отключён на этом устройстве';if(btn){btn.textContent='Включить статус';btn.classList.remove('danger')}if(retry)retry.hidden=true;}
  }
  function stopPresenceHeartbeat(){if(presenceHeartbeat){clearInterval(presenceHeartbeat);presenceHeartbeat=null}}
  function blockPresence(e,context='admin presence'){
    presenceBlocked=true;presenceBlockCode=String(e?.code||'PERMISSION_DENIED');stopPresenceHeartbeat();
    if(presenceInfoRef&&presenceInfoHandler){try{presenceInfoRef.off('value',presenceInfoHandler)}catch{}presenceInfoRef=presenceInfoHandler=null;}
    if(presenceListRef&&presenceHandler){try{presenceListRef.off('value',presenceHandler)}catch{}presenceListRef=presenceHandler=null;}
    if(!presenceErrorReported){presenceErrorReported=true;const err=new Error('Firebase Rules запрещают /adminChatPresence. Опубликуй firebase-database-rules.json из V9.6.0 или отключи live-статус владельца.');err.code='PRESENCE_PERMISSION_DENIED';window.BRAdminErrorCenter?.report?.('firebase',err,'warn',context);}
    updateOwnerPresenceControl();
  }
  function db(){try{return window.firebase?.apps?.length?firebase.database():null}catch{return null}}
  function authUser(){try{return window.firebase?.auth?.().currentUser||null}catch{return null}}
  function serverTs(){try{return firebase.database.ServerValue.TIMESTAMP}catch{return Date.now()}}
  function chatAlias(){return String(window.BRAdminAccess?.alias||window.BRAdminAccess?.label||authUser()?.email||'Сотрудник').slice(0,64)}
  function chatRole(){return String(window.BRAdminAccess?.label||'Админ').slice(0,64)}
  function fmt(ts){try{return new Date(Number(ts)||0).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}catch{return'—'}}
  function agoText(ts){
    const d=Math.max(0,Date.now()-Number(ts||0));
    if(!ts)return 'давно не появлялся';
    if(d<60e3)return 'был только что';
    const m=Math.floor(d/60e3);if(m<60)return `был ${m} мин назад`;
    const h=Math.floor(m/60);if(h<24)return `был ${h} ч назад`;
    const days=Math.floor(h/24);return `был ${days} дн назад`;
  }
  function normalizedPresence(p){
    const lastSeen=Number(p?.lastSeen||p?.at||0),fresh=Date.now()-lastSeen<CHAT_STALE_MS;
    let state=String(p?.state||'offline');
    if(state==='online'&&!fresh)state='offline';
    if(state==='away'&&Date.now()-lastSeen>10*60e3)state='offline';
    if(!['online','away','offline'].includes(state))state='offline';
    return {...(p||{}),lastSeen,state};
  }
  function presenceLabel(p){
    p=normalizedPresence(p);
    if(p.state==='online')return {state:'online',text:'онлайн'};
    if(p.state==='away')return {state:'away',text:'отошёл'};
    return {state:'offline',text:agoText(p.lastSeen)};
  }
  function renderPresence(data){
    presenceCache=data||{};
    const rows=Object.values(presenceCache).map(normalizedPresence).filter(x=>x?.uid&&x?.alias);
    const order={online:0,away:1,offline:2};
    rows.sort((a,b)=>(order[a.state]??9)-(order[b.state]??9)||Number(b.lastSeen||0)-Number(a.lastSeen||0)||String(a.alias).localeCompare(String(b.alias),'ru'));
    const online=rows.filter(x=>x.state==='online').length;
    window.BRAdminPresenceSnapshot={rows,online,at:Date.now()};
    try{window.dispatchEvent(new CustomEvent('br-admin-presence',{detail:window.BRAdminPresenceSnapshot}));}catch{}
    const count=$('#adminChatOnline');if(count)count.textContent=String(online);
    const list=$('#adminChatPresenceList');
    if(list){
      list.innerHTML=rows.length?rows.map(p=>{
        const st=presenceLabel(p);
        return `<div class="chat-presence-person ${st.state}" title="${esc(st.text)}"><div class="chat-presence-avatar">${esc(String(p.alias||'U').slice(0,2).toUpperCase())}</div><div class="chat-presence-copy"><b>${esc(p.alias||'Сотрудник')}</b><small>${esc(p.role||'Админ')}</small></div><span class="chat-presence-state ${st.state}"><i></i>${esc(st.text)}</span></div>`;
      }).join(''):'<div class="chat-presence-empty">Статусы появятся после входа сотрудников в обновлённую админку.</div>';
    }
    syncMessagePresence();syncStaffCardPresence();
  }
  function syncStaffCardPresence(){
    document.querySelectorAll('[data-staff-card]').forEach(card=>{
      const uid=card.getAttribute('data-staff-card')||'',line=card.querySelector('.staff-name-line');
      if(!line)return;
      const st=presenceLabel(presenceCache[uid]);
      let badge=line.querySelector('.staff-live-presence');
      if(!badge){
        badge=document.createElement('span');
        badge.className='staff-live-presence';
        const dot=document.createElement('i');
        const label=document.createElement('span');
        label.className='staff-live-presence-text';
        badge.append(dot,label);
        line.appendChild(badge);
      }
      const nextClass=`staff-live-presence ${st.state}`;
      if(badge.className!==nextClass)badge.className=nextClass;
      let label=badge.querySelector('.staff-live-presence-text');
      if(!label){label=document.createElement('span');label.className='staff-live-presence-text';badge.appendChild(label);}
      if(label.textContent!==st.text)label.textContent=st.text;
    });
  }
  function syncMessagePresence(){
    document.querySelectorAll('[data-presence-uid]').forEach(el=>{
      const p=presenceCache[el.dataset.presenceUid]||null,st=presenceLabel(p);
      el.className=`chat-message-presence ${st.state}`;el.innerHTML=`<i></i>${esc(st.text)}`;
    });
  }
  function renderChat(data){
    const box=$('#adminChatMessages');if(!box)return;
    const rows=Object.entries(data||{}).map(([id,v])=>({id,...(v||{})})).sort((a,b)=>Number(a.at||0)-Number(b.at||0)).slice(-80);
    const me=authUser()?.uid||'';const nearBottom=box.scrollHeight-box.scrollTop-box.clientHeight<120;
    box.innerHTML=rows.length?rows.map(r=>{const st=presenceLabel(presenceCache[r.uid]);return `<article class="admin-chat-message ${r.uid===me?'mine':''}"><div class="admin-chat-avatar">${esc(String(r.alias||'U').slice(0,2).toUpperCase())}</div><div class="admin-chat-bubble"><div class="admin-chat-meta"><b>${esc(r.alias||'Сотрудник')}</b><span>${esc(r.role||'Админ')}</span><span class="chat-message-presence ${st.state}" data-presence-uid="${esc(r.uid||'')}"><i></i>${esc(st.text)}</span><time>${fmt(r.at)}</time></div><p>${esc(r.text||'').replace(/\n/g,'<br>')}</p></div></article>`}).join(''):'<div class="admin-chat-empty"><b>Сообщений пока нет</b><span>Напиши первое сообщение администрации.</span></div>';
    if(nearBottom||!box.dataset.loaded){requestAnimationFrame(()=>{box.scrollTop=box.scrollHeight;box.dataset.loaded='1'});}
  }
  function desiredPresenceState(){return document.hidden||Date.now()-lastActivityAt>=CHAT_IDLE_MS?'away':'online'}
  async function writePresence(state=desiredPresenceState(),force=false){
    const database=db(),user=authUser();if(!database||!user||!presenceAllowed())return false;
    if(!presenceRef||presenceUid!==user.uid){presenceUid=user.uid;presenceRef=database.ref(`adminChatPresence/${user.uid}`)}
    const now=Date.now();if(!force&&state===lastPresenceState&&now-lastPresenceWriteAt<55000)return true;
    const payload={uid:user.uid,alias:chatAlias(),role:chatRole(),state,lastSeen:serverTs(),activityAt:lastActivityAt};
    try{await presenceRef.set(payload);lastPresenceState=state;lastPresenceWriteAt=now;presenceBlocked=false;presenceBlockCode='';presenceErrorReported=false;updateOwnerPresenceControl();return true}catch(e){if(isPermissionError(e))blockPresence(e,'admin presence');else window.BRAdminErrorCenter?.report?.('firebase',e,'warn','admin presence');return false}
  }
  function armDisconnect(){
    const user=authUser();if(!presenceRef||!user||!presenceAllowed())return;
    try{presenceRef.onDisconnect().set({uid:user.uid,alias:chatAlias(),role:chatRole(),state:'offline',lastSeen:serverTs(),activityAt:lastActivityAt})}catch{}
  }
  async function ensurePresence(forceRetry=false){
    const database=db(),user=authUser();if(!database||!user||!chatAccess())return false;
    if(isOwner()&&!ownerPresenceEnabled()){updateOwnerPresenceControl();return true;}
    if(forceRetry){presenceBlocked=false;presenceBlockCode='';presenceErrorReported=false;}
    if(presenceBlocked){updateOwnerPresenceControl();return false;}
    if(!presenceListRef){
      presenceListRef=database.ref('adminChatPresence');presenceHandler=s=>renderPresence(s.val()||{});presenceListRef.on('value',presenceHandler,e=>{if(isPermissionError(e))blockPresence(e,'read admin presence');else window.BRAdminErrorCenter?.report?.('firebase',e,'warn','read admin presence')});
    }
    if(!presenceInfoRef){
      presenceInfoRef=database.ref('.info/connected');presenceInfoHandler=s=>{if(s.val()===true&&presenceAllowed()){writePresence(desiredPresenceState(),true);armDisconnect();}};presenceInfoRef.on('value',presenceInfoHandler);
    }
    if(!presenceRef||presenceUid!==user.uid){presenceUid=user.uid;presenceRef=database.ref(`adminChatPresence/${user.uid}`);const ok=await writePresence(desiredPresenceState(),true);if(!ok&&presenceBlocked)return false;armDisconnect();}
    if(!presenceHeartbeat&&!presenceBlocked)presenceHeartbeat=setInterval(()=>{if(presenceAllowed())writePresence(desiredPresenceState(),false)},60000);
    updateOwnerPresenceControl();return !presenceBlocked;
  }
  function noteActivity(){
    const wasAway=desiredPresenceState()==='away';lastActivityAt=Date.now();
    if((wasAway||lastPresenceState!=='online')&&presenceAllowed())writePresence('online',true);
  }
  function teardownPresence(){
    stopPresenceHeartbeat();
    if(presenceListRef&&presenceHandler)try{presenceListRef.off('value',presenceHandler)}catch{}presenceListRef=presenceHandler=null;
    if(presenceInfoRef&&presenceInfoHandler)try{presenceInfoRef.off('value',presenceInfoHandler)}catch{}presenceInfoRef=presenceInfoHandler=null;
    presenceRef=null;presenceUid='';presenceCache={};renderPresence({});updateOwnerPresenceControl();
  }
  async function toggleOwnerPresence(){
    if(!isOwner())return;
    const enabled=ownerPresenceEnabled();
    if(enabled){
      if(!presenceBlocked)try{await writePresence('offline',true)}catch{}
      saveOwnerPresenceEnabled(false);presenceBlocked=false;presenceBlockCode='';presenceErrorReported=false;teardownPresence();
    }else{
      saveOwnerPresenceEnabled(true);presenceBlocked=false;presenceBlockCode='';presenceErrorReported=false;teardownPresence();await ensurePresence(true);
    }
    updateOwnerPresenceControl();
  }
  async function retryOwnerPresence(){if(!isOwner())return;presenceBlocked=false;presenceBlockCode='';presenceErrorReported=false;teardownPresence();await ensurePresence(true);updateOwnerPresenceControl();}
  async function startChat(){
    if(!chatAccess())return;const database=db(),user=authUser(),status=$('#adminChatStatus');
    if(!database||!user){if(status)status.innerHTML='<span>Firebase ещё не готов. Попробуй через пару секунд.</span>';return;}
    await ensurePresence();
    if(chatRef)return;
    if(status)status.innerHTML=isOwner()&&!ownerPresenceEnabled()?'<span>● Чат подключён • live-статус владельца отключён</span>':presenceBlocked?'<span>● Чат подключён • live-статусы заблокированы Rules</span>':'<span>● Подключено • сообщения и статусы синхронизируются через Firebase</span>';
    chatRef=database.ref('adminChat').orderByChild('at').limitToLast(80);chatHandler=s=>renderChat(s.val()||{});chatRef.on('value',chatHandler,e=>{if(status)status.innerHTML=`<span>Нет доступа к чату • ${esc(e?.code||'Rules')}</span>`;});
  }
  async function stopChat(){
    if(chatRef&&chatHandler)chatRef.off('value',chatHandler);chatRef=chatHandler=null;
  }
  async function sendChat(){
    const input=$('#adminChatInput'),btn=$('#adminChatSendBtn'),database=db(),user=authUser();const text=String(input?.value||'').trim();
    if(!text||!database||!user||!chatAccess())return;
    noteActivity();
    if(btn){btn.disabled=true;btn.textContent='Отправляю…'}
    try{await database.ref('adminChat').push({uid:user.uid,alias:chatAlias(),role:chatRole(),text:text.slice(0,500),at:Date.now()});input.value='';const c=$('#adminChatChars');if(c)c.textContent='0';}
    catch(e){const s=$('#adminChatStatus');if(s)s.innerHTML=`<span>Не удалось отправить • ${esc(e?.code||'Firebase Rules')}</span>`;}
    finally{if(btn){btn.disabled=false;btn.textContent='Отправить'}input?.focus();}
  }
  async function clearAdminChat(){
    const database=db(),user=authUser(),btn=$('#clearAdminChatBtn');
    if(!database||!user){window.alert('Firebase ещё не подключён. Попробуй через пару секунд.');return;}
    if(!isOwner()){window.alert('Очистка всего чата доступна только владельцу проекта.');return;}
    if(!window.confirm('Очистить ВСЮ историю чата администрации? Это действие нельзя отменить.'))return;
    if(btn){btn.disabled=true;btn.textContent='Очищаю…';}
    try{
      await database.ref('adminChat').remove();
      const box=$('#adminChatMessages');
      if(box)box.innerHTML='<div class="admin-chat-empty"><b>Сообщений пока нет</b><span>История чата очищена владельцем.</span></div>';
      window.alert('Чат администрации очищен.');
    }catch(e){
      window.BRAdminErrorCenter?.report?.('firebase',e,'error','clear admin chat');
      window.alert(e?.code==='PERMISSION_DENIED'||e?.code==='permission_denied'?'Firebase Rules не разрешают очистить чат. Опубликуй firebase-database-rules.json из V9.6.0.':'Не удалось очистить чат: '+(e?.message||e?.code||'Firebase error'));
    }finally{
      if(btn){btn.disabled=false;btn.textContent='Очистить чат админов';}
    }
  }

  function syncActiveView(){
    const name=document.querySelector('.view.active')?.id?.replace('view-','')||'';
    if(name==='chat')startChat();else if(chatRef)stopChat();
    if(name==='stats')renderPropertyStats();
    syncReadOnlyUI();injectSmartLowEndStatus();applySmartLowEnd();
  }

  function init(){
    injectSmartLowEndStatus();applySmartLowEnd();renderPropertyStats();syncReadOnlyUI();
    $('#refreshPropertyStatsBtn')?.addEventListener('click',renderPropertyStats);
    $('#refreshAdminChatBtn')?.addEventListener('click',()=>{stopChat().then(startChat)});
    $('#clearAdminChatBtn')?.addEventListener('click',clearAdminChat);
    $('#toggleOwnerPresenceBtn')?.addEventListener('click',toggleOwnerPresence);
    $('#retryOwnerPresenceBtn')?.addEventListener('click',retryOwnerPresence);
    updateOwnerPresenceControl();
    $('#adminChatForm')?.addEventListener('submit',e=>{e.preventDefault();sendChat()});
    $('#adminChatInput')?.addEventListener('input',e=>{const c=$('#adminChatChars');if(c)c.textContent=String(e.target.value.length)});
    $('#adminChatInput')?.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendChat()}});
    document.addEventListener('click',e=>{noteActivity();if(e.target.closest('.nav-btn[data-view]'))setTimeout(syncActiveView,0)});
    ['keydown','pointerdown','touchstart'].forEach(type=>window.addEventListener(type,noteActivity,{passive:true}));
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)noteActivity();if(presenceAllowed())writePresence(desiredPresenceState(),true)});
    window.addEventListener('resize',()=>{clearTimeout(window.__brV95Resize);window.__brV95Resize=setTimeout(applySmartLowEnd,180)},{passive:true});
    window.addEventListener('storage',e=>{if(e.key===(window.BR_KEYS?.players||'br78_players_state_v1'))renderPropertyStats()});
    const mo=new MutationObserver(()=>syncReadOnlyUI());const app=$('#adminApp');if(app)mo.observe(app,{attributes:true,attributeFilter:['class']});
    const staffList=$('#staffAccessList');
    if(staffList){
      let staffSyncQueued=false;
      const queueStaffSync=()=>{
        if(staffSyncQueued)return;
        staffSyncQueued=true;
        requestAnimationFrame(()=>{staffSyncQueued=false;syncStaffCardPresence();});
      };
      // Observe only replacement/addition of staff cards themselves. Observing the whole subtree
      // caused a feedback loop because the presence badge also mutates the staff card DOM.
      new MutationObserver(queueStaffSync).observe(staffList,{childList:true,subtree:false});
    }
    setTimeout(syncActiveView,300);setTimeout(syncActiveView,1300);
    let attempts=0;
    presenceBootTimer=setInterval(()=>{
      if(document.hidden||presenceBlocked||(isOwner()&&!ownerPresenceEnabled())){if(presenceBlocked||isOwner()&&!ownerPresenceEnabled()){clearInterval(presenceBootTimer);presenceBootTimer=null;}return;}
      attempts++;
      ensurePresence().then(ok=>{
        if(ok||presenceBlocked||attempts>=3){clearInterval(presenceBootTimer);presenceBootTimer=null;}
      }).catch(()=>{if(presenceBlocked||attempts>=3){clearInterval(presenceBootTimer);presenceBootTimer=null;}});
    },3500);
    try{presenceAuthUnsub=firebase.auth().onAuthStateChanged(user=>{presenceBlocked=false;presenceBlockCode='';presenceErrorReported=false;if(user)setTimeout(()=>ensurePresence(),180);else teardownPresence();updateOwnerPresenceControl();})}catch{}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
  window.BRAdminPresence={enabled:ownerPresenceEnabled,toggle:toggleOwnerPresence,retry:retryOwnerPresence,blocked:()=>presenceBlocked};
  window.addEventListener('beforeunload',()=>{try{if(presenceRef&&presenceAllowed())presenceRef.set({uid:presenceUid||authUser()?.uid||'',alias:chatAlias(),role:chatRole(),state:'offline',lastSeen:serverTs(),activityAt:lastActivityAt})}catch{}});
})();
