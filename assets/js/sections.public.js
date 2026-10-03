(()=>{
  'use strict';
  const type=document.body?.dataset.directory==='servers'?'servers':'techs';
  const $=s=>document.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const rowsOf=v=>Array.isArray(v)?v.filter(Boolean):(v&&typeof v==='object'?Object.values(v).filter(Boolean):[]);
  const cleanUrl=v=>/^https?:\/\//i.test(String(v||''))?String(v):'';
  function serverColor(name){const key=String(name||'').split('·').pop().trim().toUpperCase();const colors={RED:'#df363c',GREEN:'#269b51',BLUE:'#2874d2',YELLOW:'#ad880c',ORANGE:'#dd7323',PURPLE:'#833cce',LIME:'#608e14',PINK:'#c54791',CHERRY:'#b52f53',BLACK:'#424854',INDIGO:'#5351bc',WHITE:'#727f91',MAGENTA:'#af2fc2',CRIMSON:'#bc2d48',GOLD:'#b18a26',AZURE:'#158bbc',PLATINUM:'#778694',AQUA:'#168e9c',GRAY:'#687383',ICE:'#3b8ca8',CHILLI:'#bf4633',CHOCO:'#896044',KHABAROVSK:'#009bcc',SURGUT:'#6530df'};if(colors[key])return colors[key];let n=0;for(const c of key)n=(n*31+c.charCodeAt(0))>>>0;return 'hsl('+(n%360)+' 62% 43%)';}
  const fallback={
    techs:window.BR_DIRECTORY_SEED?.techs||[],
    servers:window.BR_DIRECTORY_SEED?.servers||[{id:'server-78',order:1,number:'78',name:'Vladimir',forum:'https://forum.blackrussia.online/forums/Сервер-№78-vladimir.3465/',vk:'https://vk.ru/vladimir.blackrussia',note:'Основной сервер рейтинга BLACK RUSSIA FORBES',active:true}]
  };
  const titles={techs:{kicker:'🛠️ Состав проекта',title:'Технические администраторы',description:'Действующие технические специалисты BLACK RUSSIA по направлению логирование. Обновлено: 27.09.2026, 03:00 MSK.'},servers:{kicker:'🚀 BLACK RUSSIA',title:'Серверы BLACK RUSSIA',description:'Список серверов проекта и быстрые ссылки на форум и сообщества.'}};
  let rows=[...fallback[type]], source='local';
  function normalize(x,i){
    if(type==='techs')return {id:String(x?.id||`tech-${i+1}`),order:Number(x?.order)||i+1,nick:String(x?.nick||''),name:String(x?.name||''),role:String(x?.role||'Технический администратор'),server:String(x?.server||''),vk:cleanUrl(x?.vk),note:String(x?.note||''),active:x?.active!==false};
    return {id:String(x?.id||`server-${i+1}`),order:Number(x?.order)||i+1,number:String(x?.number||''),name:String(x?.name||''),status:['unknown','working','maintenance','issues'].includes(x?.status)?x.status:'unknown',responsible:String(x?.responsible||''),link:cleanUrl(x?.link),forum:cleanUrl(x?.forum),vk:cleanUrl(x?.vk),note:String(x?.note||''),active:x?.active!==false};
  }
  function initials(x){const s=type==='techs'?(x.nick||x.name||'BR'):(x.number||x.name||'BR');return String(s).replace(/[^\p{L}\p{N}]+/gu,' ').trim().split(/\s+/).slice(0,2).map(v=>v[0]||'').join('').toUpperCase()||'BR'}
  function render(){
    const q=String($('#directorySearch')?.value||'').trim().toLocaleLowerCase('ru');
    const activeOnly=$('#directoryFilter')?.value==='active';
    const list=rows.filter(x=>(!activeOnly||x.active!==false)&&(!q||Object.values(x).some(v=>String(v??'').toLocaleLowerCase('ru').includes(q))));
    const box=$('#directoryGrid');if(!box)return;
    if(type==='techs'){
      box.innerHTML=list.length?list.map((x,i)=>`<article class="directory-card" style="--server-color:${serverColor(type==='techs'?x.server:x.name)}"><span class="directory-rank">#${i+1}</span><div class="directory-card-head"><span class="directory-avatar">${esc(initials(x))}</span><div><h3>${esc(x.name||x.nick||'Технический администратор')}</h3><small>${esc(x.nick?`@${x.nick}`:x.role)}</small></div></div><div class="directory-tags"><span class="directory-tag">${esc(x.role||'Тех. администратор')}</span>${x.server?`<span class="forum-server-badge">Сервер ${esc(x.server)}</span>`:''}</div>${x.note?`<p>${esc(x.note)}</p>`:''}${x.vk?`<div class="directory-links"><a href="${esc(x.vk)}" target="_blank" rel="noopener">VK ↗</a></div>`:''}</article>`).join(''):'<div class="directory-empty"><strong>Список пока пуст</strong><span>Добавьте технических администраторов через админ-панель.</span></div>';
    }else{
      box.innerHTML=list.length?list.map((x,i)=>`<article class="directory-card" style="--server-color:${serverColor(type==='techs'?x.server:x.name)}"><span class="directory-rank">#${i+1}</span><div class="directory-card-head"><span class="directory-avatar">${esc(initials(x))}</span><div><h3><span class="forum-server-badge">${esc(x.number?`Сервер ${x.number} · ${x.name||'BLACK RUSSIA'}`:x.name||'Сервер BLACK RUSSIA')}</span></h3><small>${esc(({unknown:'Статус не указан',working:'🟢 Работает',maintenance:'🟠 Техработы',issues:'🔴 Проблемы'})[x.status]||'Статус не указан')}</small></div></div>${x.note?`<p>${esc(x.note)}</p>`:''}${x.responsible?`<p>Ответственные: ${esc(x.responsible)}</p>`:''}<div class="directory-links">${x.link?`<a href="${esc(x.link)}" target="_blank" rel="noopener">Открыть ↗</a>`:''}${x.forum?`<a href="${esc(x.forum)}" target="_blank" rel="noopener">Форум ↗</a>`:''}${x.vk?`<a href="${esc(x.vk)}" target="_blank" rel="noopener">VK ↗</a>`:''}</div></article>`).join(''):'<div class="directory-empty"><strong>Список пока пуст</strong><span>Добавьте серверы через админ-панель.</span></div>';
    }
    const count=$('#directoryCount');if(count)count.textContent=String(list.length);
    const state=$('#directorySource');if(state)state.textContent=source==='firebase'?'Firebase • LIVE':'Локальный список';
  }
  function setRows(model,kind){const incoming=rowsOf(model?.rows).map(normalize);rows=(model?.initialized||incoming.length)?incoming.sort((a,b)=>a.order-b.order):[...fallback[type]];source=kind;render();}
  function init(){
    const t=titles[type];const kicker=$('#directoryKicker'),title=$('#directoryTitle'),desc=$('#directoryDescription');if(kicker)kicker.textContent=t.kicker;if(title)title.textContent=t.title;if(desc)desc.textContent=t.description;
    $('#directorySearch')?.addEventListener('input',render);$('#directoryFilter')?.addEventListener('change',render);render();
    try{const cfg=window.BR_FIREBASE_CONFIG;if(!cfg||!window.firebase)return;if(!firebase.apps.length)firebase.initializeApp(cfg);firebase.database().ref(`settings/directories/${type}`).on('value',snap=>setRows(snap.val()||{},'firebase'),()=>render());}catch(e){console.warn('Directory sync unavailable',e)}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
