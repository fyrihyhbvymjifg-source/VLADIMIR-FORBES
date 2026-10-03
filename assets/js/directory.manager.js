(() => {
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
  const uid=()=>`d-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  let model={admins:{updated:'',rows:[]},leaders:{updated:'',rows:[]}};
  let editKind='', editId='', dragState=null;
  const staticAdmins=Array.isArray(window.BR_ADMIN_DIRECTORY?.rows)?window.BR_ADMIN_DIRECTORY.rows.map((r,i)=>({...r,id:r.id||`seed-admin-${i}`})):[];
  const adminGroups=['Руководство сервера','Руководство направлений','Старшие администраторы','Старшие следящие','Администраторы','Следящие','Старшие модераторы','Модераторы','Младшие модераторы'];
  const adminRolePresets=[
    ['Специальный Администратор','spec-admin'],['Заместитель Специального Администратора','spec-deputy'],
    ['Главный Администратор','ga'],['Основной Заместитель ГА','deputy'],['Заместитель ГА','deputy'],
    ['Куратор Администрации','curator'],['Куратор агентов поддержки','curator'],['Куратор организаций','curator'],
    ['Зам. куратора администрации','deputy-curator'],['Зам. куратора агентов поддержки','deputy-curator'],['Зам. куратора организаций','deputy-curator'],
    ['Старший Администратор','senior-admin'],
    ['Ст. След. Крим','senior-watch'],['Ст. След. АП','senior-watch'],['Ст. След. Соц','senior-watch'],['Ст. След. Сил','senior-watch'],
    ['Администратор','admin'],
    ['След. ГИБДД','watch'],['След. Арз. ОПГ','watch'],['След. УМВД','watch'],['След. ФСИН','watch'],['След. Пра-во','watch'],['След. ФСБ','watch'],['След. Бат. ОПГ','watch'],['След. АП','watch'],['След. ЦБ','watch'],['След. МО','watch'],['След. СМИ','watch'],
    ['Старший модератор','senior-mod'],['Модератор','mod'],['Младший модератор','junior-mod']
  ];
  const forumRolePresets=[
    ['Технический специалист','tech'],['Куратор Технических Специалистов','tech-lead'],['Заместитель Куратора Технических Специалистов','tech-deputy'],
    ['Главный куратор форума','forum-chief'],['Главный редактор группы','group-chief'],['Главный следящий за битвами семей','family-chief'],
    ['КФ','kf'],['ГКФ','gkf'],['ЗГКФ','zgkf'],['РГ','rg'],['ГРГ','grg'],['КО','ko'],['ЗКО','zko'],
    ['Главный Следящий • ГОСС','gs'],['Зам. Главного Следящего • ГОСС','zgs'],['Главный Следящий • Форум','gs-forum'],['Главный Следящий • Хелперы','gs-helper']
  ];
  const forumRoleToneMap={'технический специалист':'tech','куратор технических специалистов':'tech-lead','заместитель куратора технических специалистов':'tech-deputy','кф':'kf','гкф':'gkf','згкф':'zgkf','рг':'rg','грг':'grg','ко':'ko','зко':'zko','главный следящий • госс':'gs','зам. главного следящего • госс':'zgs','главный следящий • форум':'gs-forum','главный следящий • хелперы':'gs-helper','главный куратор форума':'forum-chief','главный редактор группы':'group-chief','главный следящий за битвами семей':'family-chief'};
  function roleTone(role=''){
    const r=String(role).toLowerCase();
    if(/^специальный администратор/.test(r))return 'spec-admin';
    if(/^заместитель специального администратора/.test(r))return 'spec-deputy';
    if(/главный администратор/.test(r))return 'ga';
    if(/основной заместитель га|^заместитель га/.test(r))return 'deputy';
    if(/^зам\. куратора/.test(r))return 'deputy-curator';
    if(/^куратор/.test(r))return 'curator';
    if(/старший администратор/.test(r))return 'senior-admin';
    if(/^ст\. след\./.test(r))return 'senior-watch';
    if(/^след\./.test(r))return 'watch';
    if(/^администратор$/i.test(String(role)))return 'admin';
    if(/старший модератор/.test(r))return 'senior-mod';
    if(/^модератор$/.test(r))return 'mod';
    if(/младший модератор/.test(r))return 'junior-mod';
    return 'custom';
  }
  function forumRoleTone(role=''){const k=String(role||'').toLowerCase();return forumRoleToneMap[k]||(/техническ/.test(k)?'tech':'custom');}
  function splitLegacyRoles(role='',extra=[]){
    const parts=String(role||'').split('|').map(x=>x.trim()).filter(Boolean),primary=parts.shift()||'';
    const merged=[...(Array.isArray(extra)?extra:[]),...parts];
    return {primary,extra:[...new Set(merged.map(x=>String(x).trim()).filter(Boolean))]};
  }
  function extraRoleBadges(r){return (r.extraRoles||[]).map(x=>`<span class="forum-role-badge forum-tone-${forumRoleTone(x)}">${esc(x)}</span>`).join('');}
  function rolePresetMarkup(current=''){
    return `<details class="admin-role-presets"><summary><span>🎨 Основная должность</span><small>${adminRolePresets.length} вариантов • выбирается одна</small></summary><div class="admin-role-preset-grid">${adminRolePresets.map(([label,tone])=>`<button type="button" class="admin-role-preset role-tone-${tone}${label===current?' selected':''}" data-admin-role-choice="${esc(label)}">${esc(label)}</button>`).join('')}</div></details>`;
  }
  function forumRoleMarkup(current=[]){const set=new Set(current||[]);return `<div class="forum-role-editor"><div class="forum-role-editor-head"><b>🏷️ Дополнительные роли форума</b><small>Отдельно от должности • можно выбрать несколько</small></div><div class="forum-role-preset-grid">${forumRolePresets.map(([label,tone])=>`<label class="forum-role-choice forum-tone-${tone}${set.has(label)?' selected':''}"><input type="checkbox" name="extraRoles" value="${esc(label)}" ${set.has(label)?'checked':''}><span>${esc(label)}</span></label>`).join('')}</div><label class="forum-custom-role">Своя роль форума<input class="input" name="extraRoleCustom" placeholder="Например: отдельная форумная роль"></label></div>`;}

  const leaderOrganizations=['Правительство','Армия','Больница','СМИ','ГИБДД','УМВД','ФСИН','ФСБ','Арзамасская ОПГ','Батыревская ОПГ','Лыткаринская ОПГ'];
  const leaderSeed=[
    {organization:'Правительство',leader:'',date:''},
    {organization:'Армия',leader:'Nikita_Yakimov',date:'09.09.2026'},
    {organization:'Больница',leader:'',date:''},
    {organization:'СМИ',leader:'Jeka_Rulkov',date:'15.09.2026'},
    {organization:'ГИБДД',leader:'',date:''},
    {organization:'УМВД',leader:'Jackson_Kageyoshi',date:'15.09.2026'},
    {organization:'ФСИН',leader:'Alexsey_Majors',date:'22.08.2026'},
    {organization:'ФСБ',leader:'Ivan_Nikitino',date:'06.08.2026'},
    {organization:'Арзамасская ОПГ',leader:'Miko_Washington',date:'15.09.2026'},
    {organization:'Батыревская ОПГ',leader:'Bruno_Verona',date:'15.09.2026'},
    {organization:'Лыткаринская ОПГ',leader:'Miko_Rahmatov',date:'17.09.2026'}
  ];
  function fmtToday(){return new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date());}
  function getMeta(){return window.BRAdminGetMeta?.()||{};}
  function saveModel(){
    model.admins.rows.forEach((r,i)=>r.order=i);
    model.leaders.rows.forEach((r,i)=>r.order=i);
    const meta=getMeta();
    window.BRAdminSetMeta?.({directories:{...(meta.directories||{}),admins:model.admins,leaders:model.leaders}});
    renderAll();
  }
  function normalizeAdmin(r,i=0){const sr=splitLegacyRoles(r?.role,r?.extraRoles);return {id:String(r?.id||`admin-${i}-${Date.now()}`),group:String(r?.group||'Администраторы'),nick:String(r?.nick||''),role:sr.primary,date:String(r?.date||''),vk:String(r?.vk||''),forum:String(r?.forum||''),extraRoles:sr.extra,order:Number.isFinite(Number(r?.order))?Number(r.order):i};}
  function normalizeLeader(r,i=0){return {id:String(r?.id||`leader-${i}-${Date.now()}`),organization:String(r?.organization||r?.faction||r?.org||''),leader:String(r?.leader||r?.nick||''),date:String(r?.date||''),vk:String(r?.vk||''),forum:String(r?.forum||''),note:String(r?.note||''),order:Number.isFinite(Number(r?.order))?Number(r.order):i};}
  function cleanLeaders(rows){
    const normalized=(Array.isArray(rows)?rows:[]).map(normalizeLeader).filter(r=>leaderOrganizations.includes(r.organization));
    const byOrg=new Map(normalized.map(r=>[r.organization,r]));
    return leaderOrganizations.map((org,i)=>{const old=byOrg.get(org);return normalizeLeader({...leaderSeed[i],...(old||{}),organization:org,order:Number.isFinite(Number(old?.order))?Number(old.order):i,id:old?.id||`leader-slot-${i}`},i);}).sort((a,b)=>a.order-b.order);
  }
  function loadFromMeta(){
    const dirs=getMeta().directories||{};
    model.admins={updated:String(dirs.admins?.updated||window.BR_ADMIN_DIRECTORY?.updated||''),rows:(Array.isArray(dirs.admins?.rows)?dirs.admins.rows:staticAdmins).map(normalizeAdmin).sort((a,b)=>a.order-b.order)};
    model.leaders={updated:String(dirs.leaders?.updated||'14.09.2026'),rows:cleanLeaders(Array.isArray(dirs.leaders?.rows)?dirs.leaders.rows:leaderSeed)};
  }
  function adminGroupOptions(selected=''){return adminGroups.map(g=>`<option value="${esc(g)}"${g===selected?' selected':''}>${esc(g)}</option>`).join('');}
  function leaderOrgOptions(selected=''){return leaderOrganizations.map(g=>`<option value="${esc(g)}"${g===selected?' selected':''}>${esc(g)}</option>`).join('');}
  function moveRow(kind,id,dir){const arr=model[kind].rows,i=arr.findIndex(x=>x.id===id),j=i+dir;if(i<0||j<0||j>=arr.length)return;[arr[i],arr[j]]=[arr[j],arr[i]];model[kind].updated=fmtToday();saveModel();}
  function moveButtons(kind,r,i,total){return `<span class="directory-move-controls"><button type="button" data-move-directory="${kind}" data-id="${esc(r.id)}" data-dir="-1" ${i===0?'disabled':''} title="Поднять">↑</button><button type="button" data-move-directory="${kind}" data-id="${esc(r.id)}" data-dir="1" ${i===total-1?'disabled':''} title="Опустить">↓</button></span>`;}
  function renderAdmins(){
    const list=$('#adminManageList'); if(!list)return;
    const filter=$('#adminManageGroup');
    if(filter&&!filter.dataset.ready){filter.innerHTML='<option value="all">Все разделы</option>'+adminGroups.map(g=>`<option value="${esc(g)}">${esc(g)}</option>`).join('');filter.dataset.ready='1';}
    const q=String($('#adminManageSearch')?.value||'').toLowerCase().trim(), g=filter?.value||'all';
    const rows=model.admins.rows.filter(r=>(g==='all'||r.group===g)&&(!q||[r.nick,r.role,...(r.extraRoles||[]),r.date,r.group].join(' ').toLowerCase().includes(q)));
    const freeDrag=!q&&g==='all';
    $('#adminManageCount') && ($('#adminManageCount').textContent=String(model.admins.rows.length));
    $('#adminManageUpdated') && ($('#adminManageUpdated').textContent=model.admins.updated||'—');
    if(!rows.length){list.innerHTML='<div class="notice">Ничего не найдено.</div>';return;}
    list.innerHTML=rows.map((r,visibleIndex)=>{const realIndex=model.admins.rows.findIndex(x=>x.id===r.id);return `<div class="directory-manage-row directory-manage-row-v2" data-directory-row="admins" data-id="${esc(r.id)}" draggable="${freeDrag?'true':'false'}"><div class="directory-drag-handle" title="Перетащи для изменения порядка">⋮⋮</div><div class="directory-manage-primary"><b>${esc(r.nick||'Без ника')}</b><small>${esc(r.group)}</small></div><div class="directory-manage-secondary"><span class="admin-role-badge role-tone-${roleTone(r.role)}">${esc(r.role||'Должность не указана')}</span><div class="forum-role-badges">${extraRoleBadges(r)}</div><small>${r.date?`Назначен: ${esc(r.date)}`:'Дата не указана'}</small></div><div class="directory-manage-links"><span>${r.vk?'VK ✓':'VK —'}</span><span>${r.forum?'Форум ✓':'Форум —'}</span></div><div class="directory-manage-actions">${moveButtons('admins',r,realIndex,model.admins.rows.length)}<button class="btn" data-edit-directory="admins" data-id="${esc(r.id)}">Изменить</button><button class="btn danger" data-delete-directory="admins" data-id="${esc(r.id)}">Удалить</button></div></div>`}).join('');
  }
  function renderLeaders(){
    const list=$('#leaderManageList'); if(!list)return;
    const q=String($('#leaderManageSearch')?.value||'').toLowerCase().trim();
    const rows=model.leaders.rows.filter(r=>!q||[r.organization,r.leader,r.date,r.note].join(' ').toLowerCase().includes(q));
    const assigned=model.leaders.rows.filter(r=>r.leader).length, freeDrag=!q;
    $('#leaderManageCount') && ($('#leaderManageCount').textContent=`${assigned} / ${model.leaders.rows.length}`);
    $('#leaderManageUpdated') && ($('#leaderManageUpdated').textContent=model.leaders.updated||'—');
    if(!rows.length){list.innerHTML='<div class="notice">Ничего не найдено.</div>';return;}
    list.innerHTML=rows.map(r=>{const i=model.leaders.rows.findIndex(x=>x.id===r.id);return `<div class="directory-manage-row directory-manage-row-v2 leader-manage-row${r.leader?'':' is-vacant'}" data-directory-row="leaders" data-id="${esc(r.id)}" draggable="${freeDrag?'true':'false'}"><div class="directory-drag-handle" title="Перетащи для изменения порядка">⋮⋮</div><div class="directory-manage-primary"><b>${esc(r.organization)}</b><small>${r.leader?'Лидер назначен':'Свободная должность'}</small></div><div class="directory-manage-secondary"><b>${esc(r.leader||'Не назначен')}</b><small>${r.date?`Назначен: ${esc(r.date)}`:'Дата не указана'}</small></div><div class="directory-manage-links"><span>${r.vk?'VK ✓':'VK —'}</span><span>${r.forum?'Форум ✓':'Форум —'}</span></div><div class="directory-manage-actions">${moveButtons('leaders',r,i,model.leaders.rows.length)}<button class="btn" data-edit-directory="leaders" data-id="${esc(r.id)}">Изменить</button><button class="btn danger" data-delete-directory="leaders" data-id="${esc(r.id)}">Очистить</button></div></div>`}).join('');
  }
  function renderAll(){renderAdmins();renderLeaders();}
  function openEditor(kind,id=''){
    editKind=kind; editId=id;
    const modal=$('#directoryEditModal'),title=$('#directoryEditTitle'),form=$('#directoryEditForm'); if(!modal||!form)return;
    if(kind==='admins'){
      const r=model.admins.rows.find(x=>x.id===id)||normalizeAdmin({group:'Администраторы'});
      title.textContent=id?'Редактировать администратора':'Добавить администратора';
      form.innerHTML=`<label>Раздел<select class="input" name="group">${adminGroupOptions(r.group)}</select></label><label>Игровой Nick_Name<input class="input" name="nick" value="${esc(r.nick)}" required></label><label class="wide admin-role-field">Должность<div class="admin-role-input-wrap"><input class="input" name="role" value="${esc(r.role)}" required data-admin-role-input><span class="admin-role-live admin-role-badge role-tone-${roleTone(r.role)}" data-admin-role-preview>${esc(r.role||'Своя должность')}</span></div>${rolePresetMarkup(r.role)}${forumRoleMarkup(r.extraRoles)}</label><label>Дата назначения<input class="input" name="date" value="${esc(r.date)}" placeholder="22.09.2026"></label><label>VK<input class="input" name="vk" value="${esc(r.vk)}" placeholder="https://vk.com/..."></label><label class="wide">Форум<input class="input" name="forum" value="${esc(r.forum)}" placeholder="https://forum.blackrussia.online/..."></label>`;
    }else{
      const r=model.leaders.rows.find(x=>x.id===id)||normalizeLeader({organization:leaderOrganizations[0]});
      title.textContent='Редактировать лидера';
      form.innerHTML=`<label>Фракция<select class="input" name="organization">${leaderOrgOptions(r.organization)}</select></label><label>Игровой Nick_Name<input class="input" name="leader" value="${esc(r.leader)}" placeholder="Оставь пустым, если место свободно"></label><label>Дата назначения<input class="input" name="date" value="${esc(r.date)}" placeholder="22.09.2026"></label><label>VK<input class="input" name="vk" value="${esc(r.vk)}" placeholder="https://vk.com/..."></label><label class="wide">Форум<input class="input" name="forum" value="${esc(r.forum)}" placeholder="https://forum.blackrussia.online/..."></label>`;
    }
    modal.classList.add('open');
  }
  function closeEditor(){editKind='';editId='';$('#directoryEditModal')?.classList.remove('open');}
  function submitEditor(){
    const form=$('#directoryEditForm');if(!form||!editKind)return;const fd=new FormData(form),data=Object.fromEntries(fd.entries());data.extraRoles=fd.getAll('extraRoles').map(x=>String(x).trim()).filter(Boolean);const custom=String(data.extraRoleCustom||'').trim();if(custom)data.extraRoles.push(custom);data.extraRoles=[...new Set(data.extraRoles)];delete data.extraRoleCustom;
    if(editKind==='admins'){
      if(!String(data.nick||'').trim()||!String(data.role||'').trim())return alert('Заполни ник и должность');
      const row=normalizeAdmin({...data,id:editId||uid(),order:editId?(model.admins.rows.find(x=>x.id===editId)?.order??model.admins.rows.length):model.admins.rows.length});const i=model.admins.rows.findIndex(x=>x.id===editId);if(i>=0)model.admins.rows[i]=row;else model.admins.rows.push(row);model.admins.updated=fmtToday();
    }else{
      const org=String(data.organization||'').trim();if(!org)return alert('Выбери фракцию');
      let i=model.leaders.rows.findIndex(x=>x.id===editId);if(i<0)i=model.leaders.rows.findIndex(x=>x.organization===org);
      const current=i>=0?model.leaders.rows[i]:normalizeLeader({organization:org,order:model.leaders.rows.length});
      const row=normalizeLeader({...current,...data,id:current.id,organization:org,order:current.order});
      if(i>=0)model.leaders.rows[i]=row;else model.leaders.rows.push(row);model.leaders.updated=fmtToday();
    }
    saveModel();closeEditor();
  }
  function del(kind,id){if(kind==='leaders'){const r=model.leaders.rows.find(x=>x.id===id);if(!r)return;if(!confirm('Очистить лидера этой фракции?'))return;r.leader='';r.date='';r.vk='';r.forum='';r.note='';model.leaders.updated=fmtToday();saveModel();return;}if(!confirm('Удалить запись?'))return;model.admins.rows=model.admins.rows.filter(x=>x.id!==id);model.admins.updated=fmtToday();saveModel();}
  function parseGviz(resp){
    const rows=Array.isArray(resp?.table?.rows)?resp.table.rows:[], val=c=>c?.f!=null?String(c.f):c?.v!=null?String(c.v):'';
    const out=[];
    rows.forEach(r=>{const a=(r.c||[]).map(val).map(x=>x.trim());const org=leaderOrganizations.find(o=>a.includes(o));if(!org)return;const leader=(a[0]&&a[0]!=='-'&&!/игровой/i.test(a[0]))?a[0]:'';const date=a.find(x=>/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(x))||'';out.push(normalizeLeader({organization:org,leader,date}));});
    return cleanLeaders(out);
  }
  function importGoogle(){
    const cb=`BRLeadersImport_${Date.now()}`;window[cb]=resp=>{try{const rows=parseGviz(resp);model.leaders.rows=rows;model.leaders.updated=fmtToday();saveModel();alert(`Импорт завершён. Назначено лидеров: ${rows.filter(x=>x.leader).length}`);}catch{alert('Не удалось разобрать таблицу');}finally{delete window[cb];document.getElementById(cb)?.remove();}};
    const sc=document.createElement('script');sc.id=cb;sc.src=`https://docs.google.com/spreadsheets/d/1FFR21CpXOjlOTmpLOZ3XbpPQ89Vmkq04uxQHxRntHgM/gviz/tq?gid=2021697&headers=0&tqx=out:json;responseHandler:${cb}`;sc.onerror=()=>{delete window[cb];sc.remove();alert('Google Sheets недоступен. Проверь доступ по ссылке.');};document.head.appendChild(sc);
  }
  function bindDrag(){
    document.addEventListener('dragstart',e=>{const row=e.target.closest('[data-directory-row][draggable="true"]');if(!row)return;dragState={kind:row.dataset.directoryRow,id:row.dataset.id};row.classList.add('is-dragging');e.dataTransfer.effectAllowed='move';});
    document.addEventListener('dragend',e=>{e.target.closest('[data-directory-row]')?.classList.remove('is-dragging');$$('[data-directory-row]').forEach(x=>x.classList.remove('is-drag-over'));dragState=null;});
    document.addEventListener('dragover',e=>{const row=e.target.closest('[data-directory-row][draggable="true"]');if(!row||!dragState||row.dataset.directoryRow!==dragState.kind||row.dataset.id===dragState.id)return;e.preventDefault();$$('[data-directory-row]').forEach(x=>x.classList.remove('is-drag-over'));row.classList.add('is-drag-over');});
    document.addEventListener('drop',e=>{const row=e.target.closest('[data-directory-row][draggable="true"]');if(!row||!dragState||row.dataset.directoryRow!==dragState.kind||row.dataset.id===dragState.id)return;e.preventDefault();const arr=model[dragState.kind].rows,from=arr.findIndex(x=>x.id===dragState.id),to=arr.findIndex(x=>x.id===row.dataset.id);if(from<0||to<0)return;const [item]=arr.splice(from,1);arr.splice(to,0,item);model[dragState.kind].updated=fmtToday();saveModel();});
  }
  function bind(){
    $('#addAdminEntryBtn')?.addEventListener('click',()=>openEditor('admins'));
    $('#addLeaderEntryBtn')?.addEventListener('click',()=>{const free=model.leaders.rows.find(x=>!x.leader);openEditor('leaders',free?.id||model.leaders.rows[0]?.id||'');});
    $('#importLeadersBtn')?.addEventListener('click',importGoogle);
    $('#adminManageSearch')?.addEventListener('input',renderAdmins);$('#adminManageGroup')?.addEventListener('change',renderAdmins);$('#leaderManageSearch')?.addEventListener('input',renderLeaders);$('#directoryEditForm')?.addEventListener('input',e=>{const input=e.target.closest('[data-admin-role-input]');if(input){const preview=$('#directoryEditForm [data-admin-role-preview]');if(preview){preview.textContent=input.value||'Своя должность';preview.className=`admin-role-live admin-role-badge role-tone-${roleTone(input.value)}`;}}const fr=e.target.closest('.forum-role-choice input');if(fr)fr.closest('.forum-role-choice')?.classList.toggle('selected',fr.checked);});
    document.addEventListener('click',e=>{const roleChoice=e.target.closest('[data-admin-role-choice]');if(roleChoice){const input=$('#directoryEditForm [data-admin-role-input]');if(input){input.value=roleChoice.dataset.adminRoleChoice||'';input.dispatchEvent(new Event('input',{bubbles:true}));$$('[data-admin-role-choice]').forEach(x=>x.classList.toggle('selected',x===roleChoice));}return;}const edit=e.target.closest('[data-edit-directory]');if(edit){openEditor(edit.dataset.editDirectory,edit.dataset.id);return;}const delb=e.target.closest('[data-delete-directory]');if(delb){del(delb.dataset.deleteDirectory,delb.dataset.id);return;}const mv=e.target.closest('[data-move-directory]');if(mv){moveRow(mv.dataset.moveDirectory,mv.dataset.id,Number(mv.dataset.dir)||0);return;}if(e.target.closest('[data-directory-close]'))closeEditor();});
    $('#saveDirectoryEntryBtn')?.addEventListener('click',submitEditor);bindDrag();
  }
  loadFromMeta();renderAll();bind();
  window.addEventListener('br-admin-meta-changed',()=>{loadFromMeta();renderAll();});
  setTimeout(()=>{try{if(window.firebase){if(!firebase.apps.length&&window.BR_FIREBASE_CONFIG)firebase.initializeApp(window.BR_FIREBASE_CONFIG);firebase.database().ref('settings/directories').on('value',snap=>{const v=snap.val();if(!v)return;if(v.admins)model.admins={updated:String(v.admins.updated||model.admins.updated||''),rows:(Array.isArray(v.admins.rows)?v.admins.rows:Object.values(v.admins.rows||{})).map(normalizeAdmin).sort((a,b)=>a.order-b.order)};if(v.leaders)model.leaders={updated:String(v.leaders.updated||model.leaders.updated||''),rows:cleanLeaders(Array.isArray(v.leaders.rows)?v.leaders.rows:Object.values(v.leaders.rows||{}))};renderAll();});}}catch(e){console.warn('Directory sync',e);}},600);
})();
