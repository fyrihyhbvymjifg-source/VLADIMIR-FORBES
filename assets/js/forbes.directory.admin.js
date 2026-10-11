(()=>{
  const $=s=>document.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const rowsOf=v=>Array.isArray(v)?v.filter(Boolean):(v&&typeof v==='object'?Object.values(v).filter(Boolean):[]);
  const seed=rowsOf(window.BR_FORBES_SEED).map((r,i)=>norm(r,i));
  let editingId='';
  let lastSignature='';
  let requestRows=[];
  let requestFilter='pending';
  let requestDb=null;

  function norm(r,i=0){
    return {
      id:String(r?.id||`forbes-${Date.now()}-${i}`),
      order:Number(r?.order)||i+1,
      nick:String(r?.nick||'').trim(),
      server:String(r?.server||'').trim(),
      name:String(r?.name||'').trim(),
      note:String(r?.note||'').trim(),
      raw:String(r?.raw||'')
    };
  }
  function model(){
    const d=window.BRAdminGetMeta?.()?.directories?.forbes;
    const rr=rowsOf(d?.rows);
    const initialized=!!d?.initialized;
    return {updated:String(d?.updated||''),rows:(initialized?rr:(rr.length?rr:seed)).map(norm).sort((a,b)=>a.order-b.order)};
  }
  function canWrite(){
    const a=window.BRAdminAccess;
    if(!a) return true;
    if(typeof a.isOwner==='function' && a.isOwner()) return true;
    if(a.readOnly) return false;
    return typeof a.canWrite==='function' ? a.canWrite('forbes_global') : true;
  }
  function canWriteRequest(){
    const a=window.BRAdminAccess;
    if(!a) return true;
    if(typeof a.isOwner==='function' && a.isOwner()) return true;
    if(a.readOnly) return false;
    if(typeof a.canWrite!=='function') return true;
    return !!(a.canWrite('forbes_requests') || a.canWrite('forbes_global'));
  }
  function today(){return new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date());}
  function hue(v=''){let h=0;for(const c of String(v||'—'))h=(h*31+c.charCodeAt(0))%360;return h;}
  function serverSort(a,b){const na=parseInt(a.server,10),nb=parseInt(b.server,10);if(Number.isFinite(na)&&Number.isFinite(nb)&&na!==nb)return na-nb;return String(a.server).localeCompare(String(b.server),'ru',{numeric:true})||a.nick.localeCompare(b.nick,'ru');}

  function persist(rows,msg='Изменения сохранены'){
    if(!canWrite()){ alert('У этого аккаунта режим только просмотра.'); return false; }
    rows=rows.map((r,i)=>({...norm(r,i),order:i+1}));
    const meta=window.BRAdminGetMeta?.()||{};
    const directories={...(meta.directories||{}),forbes:{updated:today(),initialized:true,rows}};
    window.BRAdminSetMeta?.({directories});
    lastSignature='';
    render();
    if(msg && window.BRAdminToast) window.BRAdminToast(msg);
    return true;
  }

  function filtered(){
    const m=model();
    const q=String($('#forbesAdminSearch')?.value||'').trim().toLowerCase();
    const s=$('#forbesAdminServer')?.value||'all';
    return m.rows.filter(r=>(s==='all'||r.server===s)&&(!q||[r.nick,r.server,r.name,r.note,r.raw].some(x=>String(x||'').toLowerCase().includes(q))));
  }

  function refreshServerOptions(rows){
    const sel=$('#forbesAdminServer'); if(!sel)return;
    const cur=sel.value||'all';
    const servers=[...new Set(rows.map(r=>r.server).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'ru',{numeric:true}));
    sel.innerHTML='<option value="all">Все серверы</option>'+servers.map(s=>`<option value="${esc(s)}">Сервер ${esc(s)}</option>`).join('');
    sel.value=servers.includes(cur)?cur:'all';
    $('#forbesAdminServers').textContent=servers.length;
  }

  function signature(m){return `${m.updated}|${m.rows.length}|${m.rows.map(r=>`${r.id}:${r.order}:${r.nick}:${r.server}:${r.name}:${r.note}`).join('~')}`;}

  function render(){
    const box=$('#forbesAdminList'); if(!box)return;
    const m=model();
    refreshServerOptions(m.rows);
    $('#forbesAdminCount').textContent=m.rows.length;
    $('#forbesAdminUpdated').textContent=m.updated||'исходный список';
    const list=filtered();
    const writable=canWrite();
    box.innerHTML=list.length?list.map(r=>`<div class="forbes-admin-row" data-forbes-row="${esc(r.id)}">
      <div class="forbes-admin-order">${r.order}</div>
      <div class="forbes-admin-nick" title="${esc(r.nick)}">${esc(r.nick||'—')}</div>
      <div><span class="forbes-admin-server" style="--h:${hue(r.server)}">${esc(r.server||'—')}</span></div>
      <div class="forbes-admin-name" title="${esc(r.name)}">${esc(r.name||'—')}</div>
      <div class="forbes-admin-note" title="${esc(r.note)}">${esc(r.note||'')}</div>
      <div class="forbes-admin-actions">
        <button type="button" data-forbes-up="${esc(r.id)}" title="Выше" ${writable?'':'disabled'}>↑</button>
        <button type="button" data-forbes-down="${esc(r.id)}" title="Ниже" ${writable?'':'disabled'}>↓</button>
        <button type="button" data-forbes-edit="${esc(r.id)}" title="Редактировать" ${writable?'':'disabled'}>✎</button>
        <button type="button" data-forbes-duplicate="${esc(r.id)}" title="Дублировать" ${writable?'':'disabled'}>⧉</button>
        <button type="button" data-forbes-delete="${esc(r.id)}" title="Удалить" ${writable?'':'disabled'}>🗑</button>
      </div>
    </div>`).join(''):'<div class="forbes-admin-empty">Ничего не найдено.</div>';

    document.querySelectorAll('[data-forbes-edit]').forEach(b=>b.onclick=()=>startEdit(b.dataset.forbesEdit));
    document.querySelectorAll('[data-forbes-delete]').forEach(b=>b.onclick=()=>remove(b.dataset.forbesDelete));
    document.querySelectorAll('[data-forbes-up]').forEach(b=>b.onclick=()=>move(b.dataset.forbesUp,-1));
    document.querySelectorAll('[data-forbes-down]').forEach(b=>b.onclick=()=>move(b.dataset.forbesDown,1));
    document.querySelectorAll('[data-forbes-duplicate]').forEach(b=>b.onclick=()=>duplicate(b.dataset.forbesDuplicate));

    ['forbesSaveEntryBtn','forbesSeedResetBtn','forbesClearAllBtn','forbesSortNickBtn','forbesSortServerBtn','forbesRenumberBtn'].forEach(id=>{const e=$('#'+id);if(e)e.disabled=!writable;});
    const imp=$('.forbes-import-label'); if(imp) imp.classList.toggle('is-disabled',!writable);
    lastSignature=signature(m);
  }

  function clearForm(){
    editingId='';
    ['forbesOrderInput','forbesNickInput','forbesServerInput','forbesNameInput','forbesNoteInput'].forEach(id=>{const e=$('#'+id);if(e)e.value='';});
    if($('#forbesFormTitle')) $('#forbesFormTitle').textContent='Добавить запись';
    if($('#forbesSaveEntryBtn')) $('#forbesSaveEntryBtn').textContent='+ Добавить';
    if($('#forbesCancelEditBtn')) $('#forbesCancelEditBtn').hidden=true;
  }

  function startEdit(id){
    const r=model().rows.find(x=>x.id===id); if(!r)return;
    editingId=id;
    $('#forbesOrderInput').value=r.order;
    $('#forbesNickInput').value=r.nick;
    $('#forbesServerInput').value=r.server;
    $('#forbesNameInput').value=r.name;
    $('#forbesNoteInput').value=r.note;
    $('#forbesFormTitle').textContent='Редактировать запись';
    $('#forbesSaveEntryBtn').textContent='Сохранить';
    $('#forbesCancelEditBtn').hidden=false;
    $('#forbesNickInput').focus();
    $('.forbes-admin-editor')?.scrollIntoView({behavior:'smooth',block:'center'});
  }

  function save(){
    if(!canWrite())return;
    const nick=$('#forbesNickInput').value.trim();
    const server=$('#forbesServerInput').value.trim();
    const name=$('#forbesNameInput').value.trim();
    const note=$('#forbesNoteInput').value.trim();
    const desired=Math.max(1,Number($('#forbesOrderInput').value)||999999);
    if(!nick&&!name){alert('Укажи ник/роль или имя.');return;}
    const m=model();
    let row;
    if(editingId){
      const i=m.rows.findIndex(r=>r.id===editingId); if(i<0)return;
      row={...m.rows.splice(i,1)[0],nick,server,name,note,raw:''};
    }else{
      row={id:`forbes-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,order:m.rows.length+1,nick,server,name,note,raw:''};
    }
    const index=Math.min(m.rows.length,Math.max(0,desired-1));
    m.rows.splice(index,0,row);
    if(persist(m.rows,editingId?'Запись общего Forbes обновлена':'Запись добавлена')) clearForm();
  }

  function remove(id){
    const m=model(),r=m.rows.find(x=>x.id===id); if(!r)return;
    if(!confirm(`Удалить запись «${r.nick||r.name||id}» из общего Forbes?`))return;
    if(persist(m.rows.filter(x=>x.id!==id),'Запись удалена') && editingId===id) clearForm();
  }

  function move(id,delta){
    const m=model(),i=m.rows.findIndex(x=>x.id===id); if(i<0)return;
    const j=i+delta; if(j<0||j>=m.rows.length)return;
    [m.rows[i],m.rows[j]]=[m.rows[j],m.rows[i]];
    persist(m.rows,'Порядок обновлён');
  }

  function duplicate(id){
    const m=model(),i=m.rows.findIndex(x=>x.id===id); if(i<0)return;
    const src=m.rows[i];
    const copy={...src,id:`forbes-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,nick:src.nick?`${src.nick}_copy`:src.nick,order:i+2};
    m.rows.splice(i+1,0,copy);
    persist(m.rows,'Запись продублирована');
  }

  function resetSeed(){
    if(!confirm('Вернуть исходные 438 записей? Все текущие изменения общего Forbes будут заменены.'))return;
    if(persist(seed.map(x=>({...x})),'Исходный список восстановлен')) clearForm();
  }
  function clearAll(){
    if(!confirm('Полностью очистить общий Forbes? Публичная страница останется без пользовательских записей до следующего добавления.'))return;
    persist([],'Общий Forbes очищен'); clearForm();
  }
  function renumber(){persist(model().rows,'Нумерация обновлена');}
  function sortNick(){const rows=model().rows.sort((a,b)=>a.nick.localeCompare(b.nick,'ru',{numeric:true,sensitivity:'base'}));persist(rows,'Список отсортирован по нику');}
  function sortServer(){const rows=model().rows.sort(serverSort);persist(rows,'Список отсортирован по серверу');}

  function csvEscape(v){v=String(v??'');return /[",\n;]/.test(v)?`"${v.replace(/"/g,'""')}"`:v;}
  function download(name,type,content){
    const blob=new Blob([content],{type});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function exportJson(){download('black-russia-general-forbes.json','application/json;charset=utf-8',JSON.stringify(model().rows,null,2));}
  function exportCsv(){
    const rows=model().rows;
    const lines=[['order','nick','server','name','note'].join(';'),...rows.map(r=>[r.order,r.nick,r.server,r.name,r.note].map(csvEscape).join(';'))];
    download('black-russia-general-forbes.csv','text/csv;charset=utf-8','\ufeff'+lines.join('\n'));
  }
  function parseCsv(text){
    const lines=String(text).replace(/^\ufeff/,'').split(/\r?\n/).filter(x=>x.trim()); if(!lines.length)return [];
    const delim=(lines[0].match(/;/g)||[]).length >= (lines[0].match(/,/g)||[]).length ? ';' : ',';
    function cells(line){
      const out=[];let cur='',q=false;
      for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(q&&line[i+1]==='"'){cur+='"';i++;}else q=!q;}else if(c===delim&&!q){out.push(cur);cur='';}else cur+=c;}out.push(cur);return out;
    }
    const head=cells(lines[0]).map(x=>x.trim().toLowerCase());
    const hasHead=head.some(x=>['order','nick','server','name','note'].includes(x));
    const start=hasHead?1:0;
    return lines.slice(start).map((line,i)=>{const c=cells(line);const get=(key,idx)=>hasHead?c[head.indexOf(key)]:(c[idx]);return norm({order:Number(get('order',0))||i+1,nick:get('nick',1)||'',server:get('server',2)||'',name:get('name',3)||'',note:get('note',4)||''},i);}).filter(r=>r.nick||r.name);
  }
  async function importFile(file){
    if(!file||!canWrite())return;
    const text=await file.text(); let rows=[];
    try{
      if(file.name.toLowerCase().endsWith('.json')||text.trim().startsWith('[')||text.trim().startsWith('{')){
        const parsed=JSON.parse(text); rows=rowsOf(parsed?.rows||parsed).map((r,i)=>norm(r,i));
      }else rows=parseCsv(text);
    }catch(e){alert('Не удалось прочитать файл. Проверь формат JSON/CSV.');return;}
    if(!rows.length){alert('В файле не найдено записей.');return;}
    if(!confirm(`Импортировать ${rows.length} записей и заменить текущий общий Forbes?`))return;
    persist(rows,`Импортировано записей: ${rows.length}`); clearForm();
  }


  function requestDate(ts){
    if(!Number(ts)) return '—';
    try{return new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(Number(ts)));}catch{return '—';}
  }
  function globalRequests(){
    return requestRows.filter(r=>r && r.scope==='global').sort((a,b)=>Number(b.createdAt||0)-Number(a.createdAt||0));
  }
  const REQUEST_TTL_MS=48*60*60*1000;
  function requestExpiryBase(r){
    // Все заявки хранятся максимум 48 часов с момента отправки,
    // независимо от статуса: pending / approved / rejected.
    return Number(r?.createdAt||0);
  }
  function requestExpiresAt(r){
    const base=requestExpiryBase(r); return base?base+REQUEST_TTL_MS:0;
  }
  function requestExpiryText(r){
    const at=requestExpiresAt(r); if(!at) return '';
    const left=at-Date.now();
    if(left<=0) return 'Истёк срок хранения';
    const h=Math.ceil(left/3600000);
    if(h>=24) return `Удалится примерно через ${Math.ceil(h/24)} дн.`;
    return `Удалится примерно через ${h} ч.`;
  }
  async function deleteRequest(id,{silent=false}={}){
    if(!requestDb||!id) return false;
    if(!canWriteRequest()) { if(!silent) alert('Нет права на удаление заявок.'); return false; }
    try{
      await requestDb.ref('forbesRequests/'+id).remove();
      if(!silent && window.BRAdminToast) window.BRAdminToast('Заявка и её скриншот удалены');
      return true;
    }catch(err){
      console.error(err);
      if(!silent) alert('Не удалось удалить заявку из Firebase.');
      return false;
    }
  }
  async function cleanupExpiredRequests({manual=false}={}){
    if(!requestDb||!canWriteRequest()) return 0;
    const now=Date.now();
    const expired=globalRequests().filter(r=>{
      const at=requestExpiresAt(r);
      return at>0 && at<=now;
    });
    if(!expired.length){
      if(manual && window.BRAdminToast) window.BRAdminToast('Просроченных заявок нет');
      return 0;
    }
    if(manual && !confirm(`Удалить ${expired.length} заявок старше 48 часов? Будут удалены заявки любого статуса и все скриншоты, которые хранятся внутри них.`)) return 0;
    const updates={};
    expired.forEach(r=>{const id=String(r.requestId||r.id||'');if(id) updates[id]=null;});
    try{
      await requestDb.ref('forbesRequests').update(updates);
      if(manual && window.BRAdminToast) window.BRAdminToast(`Удалено заявок: ${expired.length}`);
      return expired.length;
    }catch(err){
      console.error(err);
      if(manual) alert('Не удалось выполнить очистку заявок.');
      return 0;
    }
  }

  async function deleteAllRequests({onlyVisible=false}={}){
    if(!requestDb) return 0;
    if(!canWriteRequest()) { alert('Нет права на удаление заявок.'); return 0; }
    const all=globalRequests();
    const list=onlyVisible && requestFilter!=='all' ? all.filter(r=>(r.status||'pending')===requestFilter) : all;
    if(!list.length){ if(window.BRAdminToast) window.BRAdminToast('Заявок для удаления нет'); return 0; }
    const label=onlyVisible && requestFilter!=='all' ? `в текущей вкладке (${list.length})` : `все заявки (${list.length})`;
    if(!confirm(`Удалить ${label}? Это действие удалит записи из Firebase и скриншоты, сохранённые внутри заявок. Отменить действие будет нельзя.`)) return 0;
    const updates={};
    list.forEach(r=>{const id=String(r.requestId||r.id||''); if(id) updates[id]=null;});
    try{
      await requestDb.ref('forbesRequests').update(updates);
      if(window.BRAdminToast) window.BRAdminToast(`Удалено заявок: ${list.length}`);
      return list.length;
    }catch(err){
      console.error(err);
      alert('Не удалось удалить заявки. Проверь права Firebase Rules для forbesRequests.');
      return 0;
    }
  }

  function renderRequests(){
    const box=$('#forbesRequestList'); if(!box) return;
    const all=globalRequests();
    const pending=all.filter(r=>(r.status||'pending')==='pending');
    const cnt=$('#forbesRequestPendingCount'); if(cnt) cnt.textContent=String(pending.length);
    document.querySelectorAll('[data-forbes-request-filter]').forEach(b=>b.classList.toggle('active',b.dataset.forbesRequestFilter===requestFilter));
    const list=all.filter(r=>requestFilter==='all'||(r.status||'pending')===requestFilter);
    const statusText={pending:'На проверке',approved:'Одобрена',rejected:'Отклонена'};
    box.innerHTML=list.length?list.map(r=>{
      const status=String(r.status||'pending');
      const proofImage=String(r.proofImage||'');
      const proofUrl=String(r.proofUrl||'');
      const vk=String(r.vk||'');
      return `<article class="forbes-request-card" data-request-id="${esc(r.requestId||r.id||'')}">
        <div>
          <div class="forbes-request-meta"><span>Сервер ${esc(r.server||'—')}</span><span class="forbes-request-status ${esc(status)}">${esc(statusText[status]||status)}</span><span>${esc(requestDate(r.createdAt))}</span>${requestExpiryText(r)?`<span class="forbes-request-expiry">${esc(requestExpiryText(r))}</span>`:''}</div>
          <h4>${esc(r.nickname||'Без ника')}${r.name?` · ${esc(r.name)}`:''}</h4>
          ${vk?`<p><b>VK:</b> <a href="${esc(vk)}" target="_blank" rel="noopener noreferrer">${esc(vk)}</a></p>`:''}
          ${r.comment?`<p><b>Комментарий:</b> ${esc(r.comment)}</p>`:''}
          ${r.reviewNote?`<p><b>Решение:</b> ${esc(r.reviewNote)}</p>`:''}
          <div class="forbes-request-actions">${status==='pending'?`<button class="approve" type="button" data-global-request-approve="${esc(r.requestId||r.id||'')}">✓ Одобрить и добавить</button><button class="reject" type="button" data-global-request-reject="${esc(r.requestId||r.id||'')}">Отклонить</button>`:''}<button class="delete" type="button" data-global-request-delete="${esc(r.requestId||r.id||'')}">🗑 Удалить заявку</button></div>
        </div>
        <div class="forbes-request-proof">
          ${proofImage?`<a href="${esc(proofImage)}" target="_blank" rel="noopener noreferrer"><img src="${esc(proofImage)}" alt="Скриншот доказательства"></a>`:'<div class="forbes-request-empty">Скрин не приложен</div>'}
          ${proofUrl?`<a href="${esc(proofUrl)}" target="_blank" rel="noopener noreferrer">Открыть доказательство VK ↗</a>`:''}
        </div>
      </article>`;
    }).join(''):'<div class="forbes-request-empty">В этой категории заявок нет.</div>';
    document.querySelectorAll('[data-global-request-approve]').forEach(b=>b.onclick=()=>approveRequest(b.dataset.globalRequestApprove));
    document.querySelectorAll('[data-global-request-reject]').forEach(b=>b.onclick=()=>rejectRequest(b.dataset.globalRequestReject));
    document.querySelectorAll('[data-global-request-delete]').forEach(b=>b.onclick=async()=>{
      const id=b.dataset.globalRequestDelete;
      const r=globalRequests().find(x=>String(x.requestId||x.id||'')===String(id));
      if(!r) return;
      if(!confirm(`Удалить заявку ${r.nickname||''} (сервер ${r.server||'—'})? Скриншот внутри заявки тоже будет удалён.`)) return;
      await deleteRequest(id);
    });
  }
  async function updateRequest(id,patch){
    if(!requestDb || !id) return false;
    if(!canWriteRequest()) { alert('Нет права на изменение заявок.'); return false; }
    try{await requestDb.ref('forbesRequests/'+id).update(patch); return true;}catch(err){console.error(err);alert('Не удалось обновить заявку в Firebase. Проверь Firebase Rules.');return false;}
  }
  async function approveRequest(id){
    if(!canWrite() || !canWriteRequest()) return alert('Нет права на одобрение заявки и редактирование общего Forbes.');
    const r=globalRequests().find(x=>String(x.requestId||x.id||'')===String(id)); if(!r)return;
    const m=model();
    const existingIndex=m.rows.findIndex(x=>String(x.nick).toLowerCase()===String(r.nickname||'').toLowerCase() && String(x.server)===String(r.server||''));
    if(existingIndex>=0){
      if(!confirm('Этот ник уже есть на указанном сервере. Обновить существующую запись данными из заявки?')) return;
      m.rows[existingIndex]={...m.rows[existingIndex],name:String(r.name||m.rows[existingIndex].name||''),note:'Подтверждено заявкой VK'};
    }else{
      m.rows.push({id:`forbes-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,order:m.rows.length+1,nick:String(r.nickname||''),server:String(r.server||''),name:String(r.name||''),note:'Подтверждено заявкой VK',raw:''});
    }
    if(!persist(m.rows,'Заявка одобрена • игрок добавлен в Общий Forbes')) return;
    const note=prompt('Комментарий к одобрению (необязательно):','')||'';
    await updateRequest(id,{status:'approved',reviewedAt:Date.now(),reviewNote:note.slice(0,300)});
  }
  async function rejectRequest(id){
    if(!canWriteRequest()) return alert('Нет права на обработку заявок.');
    const reason=prompt('Причина отклонения заявки:','Недостаточно подтверждений');
    if(reason===null) return;
    await updateRequest(id,{status:'rejected',reviewedAt:Date.now(),reviewNote:String(reason).trim().slice(0,300)});
  }
  function initRequests(){
    const list=$('#forbesRequestList'); if(!list)return;
    document.querySelectorAll('[data-forbes-request-filter]').forEach(b=>b.addEventListener('click',()=>{requestFilter=b.dataset.forbesRequestFilter||'pending';renderRequests();}));
    try{
      if(!window.firebase || !window.BR_FIREBASE_CONFIG){list.innerHTML='<div class="forbes-request-empty">Firebase недоступен.</div>';return;}
      if(!firebase.apps.length) firebase.initializeApp(window.BR_FIREBASE_CONFIG);
      requestDb=firebase.database();
      requestDb.ref('forbesRequests').on('value',snap=>{
        requestRows=[];
        snap.forEach(child=>requestRows.push({...child.val(),requestId:child.key}));
        renderRequests();
        cleanupExpiredRequests().catch(()=>{});
      },err=>{console.warn(err);list.innerHTML='<div class="forbes-request-empty">Нет доступа к заявкам Firebase.</div>';});
    }catch(err){console.warn(err);list.innerHTML='<div class="forbes-request-empty">Не удалось загрузить заявки.</div>';}
  }

  window.BRForbesAdminRender=render;
  $('#forbesSaveEntryBtn')?.addEventListener('click',save);
  $('#forbesCancelEditBtn')?.addEventListener('click',clearForm);
  $('#forbesSeedResetBtn')?.addEventListener('click',resetSeed);
  $('#forbesClearAllBtn')?.addEventListener('click',clearAll);
  $('#forbesRenumberBtn')?.addEventListener('click',renumber);
  $('#forbesSortNickBtn')?.addEventListener('click',sortNick);
  $('#forbesSortServerBtn')?.addEventListener('click',sortServer);
  $('#forbesExportJsonBtn')?.addEventListener('click',exportJson);
  $('#forbesExportCsvBtn')?.addEventListener('click',exportCsv);
  $('#forbesImportFile')?.addEventListener('change',e=>{const f=e.target.files?.[0];if(f)importFile(f).finally(()=>{e.target.value='';});});
  $('#forbesRequestCleanupBtn')?.addEventListener('click',()=>cleanupExpiredRequests({manual:true}));
  $('#forbesRequestDeleteAllBtn')?.addEventListener('click',()=>deleteAllRequests({onlyVisible:false}));
  $('#forbesAdminSearch')?.addEventListener('input',render);
  $('#forbesAdminServer')?.addEventListener('change',render);
  ['forbesOrderInput','forbesNickInput','forbesServerInput','forbesNameInput','forbesNoteInput'].forEach(id=>$('#'+id)?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();save();}}));

  setInterval(()=>{
    if(requestDb && $('#view-forbes')?.classList.contains('active')) cleanupExpiredRequests().catch(()=>{});
  },5*60*1000);

  setInterval(()=>{
    if(!$('#view-forbes')?.classList.contains('active'))return;
    const m=model(),sig=signature(m); if(sig!==lastSignature)render();
  },1300);
  setInterval(()=>{
    if(!$('#view-forbes')?.classList.contains('active')) return;
    cleanupExpiredRequests().catch(()=>{});
  },10*60*1000);
  initRequests();
  render();
})();
