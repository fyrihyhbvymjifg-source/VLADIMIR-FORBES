(()=>{
 const admin=document.getElementById('adminApp');let bound=false;
 if(!admin)return;
 const panel=document.createElement('article');panel.className='setting-card';panel.innerHTML='<h3>🚨 Аварийный режим</h3><p>Временно закрыть отправку сообщений или приём новых заявок.</p><div class="actions"><button class="btn" data-emergency="chatClosed">Закрыть чат</button><button class="btn" data-emergency="requestsClosed">Закрыть заявки</button></div><p class="notice" role="status">Подключение…</p>';
 document.getElementById('view-system')?.prepend(panel);
 let state={},db;const notice=panel.querySelector('.notice');
 function render(){panel.hidden=!window.BRAdminAccess?.can?.('settings');panel.querySelectorAll('button').forEach(b=>{const closed=state[b.dataset.emergency]===true;b.textContent=(closed?'Открыть ':'Закрыть ')+(b.dataset.emergency==='chatClosed'?'чат':'заявки');b.classList.toggle('danger',closed);b.disabled=!window.BRAdminAccess?.canWrite?.('settings');b.setAttribute('aria-pressed',String(closed));});}
 panel.addEventListener('click',async e=>{const b=e.target.closest('[data-emergency]');if(!b||!db||!window.BRAdminAccess?.canWrite?.('settings'))return;b.disabled=true;try{await db.ref('settings/emergency/'+b.dataset.emergency).set(state[b.dataset.emergency]!==true);notice.textContent='Режим сохранён';}catch(err){notice.textContent='Не удалось сохранить: '+(err.code||err.message);}finally{render();}});
 setInterval(()=>{render();if(bound||!window.firebase?.apps?.length)return;db=firebase.database();bound=true;db.ref('settings/emergency').on('value',s=>{state=s.val()||{};render();notice.textContent='Чат: '+(state.chatClosed?'закрыт':'открыт')+' · Заявки: '+(state.requestsClosed?'закрыты':'открыты');},e=>notice.textContent='Ошибка подключения: '+e.code);},1000);
})();
