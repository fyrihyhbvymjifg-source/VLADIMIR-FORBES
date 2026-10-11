(()=>{
 const host=document.getElementById('supportAdminChatWrap');if(!host)return;
 const card=document.createElement('article');card.className='setting-card';card.innerHTML='<h3>Забаненные в Forbes Chat</h3><div class="actions"><button class="btn" data-refresh-bans>Обновить список</button><button class="btn" data-unban-self>Разбанить мой аккаунт чата</button></div><p role="status" data-ban-status></p><div data-banned-list></div>';host.prepend(card);
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const writable=()=>window.BRAdminAccess?.canWrite?.('community_chat');
 const database=()=>firebase.apps[0].database();
 const status=t=>card.querySelector('[data-ban-status]').textContent=t;
 async function unban(uid){if(!writable())return status('Нет права на модерацию чата');try{await database().ref('communityChat/bans/'+uid).remove();status('Бан снят. Мут изменяется отдельно.');await load();}catch(e){status('Не удалось снять бан: '+(e.code||e.message));}}
 async function load(){if(!window.BRAdminAccess?.can?.('community_chat'))return;try{const raw=(await database().ref('communityChat/bans').once('value')).val()||{};card.querySelector('[data-banned-list]').innerHTML=Object.entries(raw).map(([uid,r])=>`<div class="notice"><b>${esc(r.nick||uid)}</b><p>${esc(r.reason||'Бан чата')}</p>${writable()?`<button class="btn" data-unban-uid="${esc(uid)}">Разбан</button>`:''}</div>`).join('')||'<p>Забаненных нет.</p>';}catch(e){status('Список недоступен. Обновите Firebase Rules. Можно использовать разбан своего аккаунта.');}}
 card.addEventListener('click',e=>{const b=e.target.closest('[data-unban-uid]');if(b)unban(b.dataset.unbanUid);if(e.target.closest('[data-refresh-bans]'))load();if(e.target.closest('[data-unban-self]')){const u=firebase.apps.find(a=>a.name==='forbesPublic')?.auth().currentUser||firebase.apps[0]?.auth().currentUser;if(u)unban(u.uid);else status('Сначала войдите в аккаунт');}});
 document.getElementById('supportAdminChatTab')?.addEventListener('click',load);
 document.getElementById('communityModList')?.addEventListener('click',e=>{const b=e.target.closest('[data-explicit-unban]');if(b)unban(b.dataset.uid);});
 const list=document.getElementById('communityModList');if(list)new MutationObserver(()=>{list.querySelectorAll('[data-ban]').forEach(b=>{if(b.parentElement.querySelector('[data-explicit-unban]'))return;const n=document.createElement('button');n.className='btn';n.textContent='Разбан';n.dataset.explicitUnban='';n.dataset.uid=b.dataset.uid;b.after(n);});}).observe(list,{childList:true,subtree:true});
})();
