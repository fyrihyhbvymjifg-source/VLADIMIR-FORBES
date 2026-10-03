(()=>{
  const $=s=>document.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const rowsOf=v=>Array.isArray(v)?v.filter(Boolean):(v&&typeof v==='object'?Object.values(v).filter(Boolean):[]);
  const seed=rowsOf(window.BR_FORBES_SEED).map((r,i)=>normalize(r,i));
  let rows=[...seed], source='local', updated='';
  function normalize(r,i=0){return {id:String(r?.id||`forbes-${i+1}`),order:Number(r?.order)||i+1,nick:String(r?.nick||''),server:String(r?.server||''),name:String(r?.name||''),note:String(r?.note||''),raw:String(r?.raw||'')};}
  function hue(v=''){let h=0;for(const c of String(v||'—'))h=(h*31+c.charCodeAt(0))%360;return h;}
  function serverSort(a,b){const na=parseInt(a,10),nb=parseInt(b,10);if(Number.isFinite(na)&&Number.isFinite(nb)&&na!==nb)return na-nb;return String(a).localeCompare(String(b),'ru',{numeric:true});}
  function allServers(){return [...new Set(rows.map(r=>r.server.trim()).filter(Boolean))].sort(serverSort);}
  function serverCounts(){const m=new Map();rows.forEach(r=>{const s=r.server.trim();if(s)m.set(s,(m.get(s)||0)+1)});return [...m].sort((a,b)=>b[1]-a[1]||serverSort(a[0],b[0]));}
  function renderFilters(){
    const sel=$('#fdServerSelect'); const current=sel.value||'all'; const servers=allServers();
    sel.innerHTML='<option value="all">Все серверы</option>'+servers.map(s=>`<option value="${esc(s)}">Сервер ${esc(s)}</option>`).join('');
    sel.value=servers.includes(current)?current:'all';
    $('#fdServers').textContent=servers.length;
    const counts=serverCounts().slice(0,18);
    $('#fdServerCloud').innerHTML=`<button class="fd-server-chip ${sel.value==='all'?'active':''}" style="--server-h:42" data-server="all">Все <b>${rows.length}</b></button>`+counts.map(([s,n])=>`<button class="fd-server-chip ${sel.value===s?'active':''}" style="--server-h:${hue(s)}" data-server="${esc(s)}">${esc(s)} <b>${n}</b></button>`).join('');
    document.querySelectorAll('[data-server]').forEach(b=>b.addEventListener('click',()=>{sel.value=b.dataset.server;render();}));
  }
  function filtered(){const q=$('#fdSearch').value.trim().toLowerCase(),sv=$('#fdServerSelect').value;return rows.filter(r=>(sv==='all'||r.server===sv)&&(!q||[r.nick,r.server,r.name,r.note,r.raw].some(x=>String(x||'').toLowerCase().includes(q))));}
  function render(){
    renderFilters(); const list=filtered(); $('#fdVisible').textContent=list.length; $('#fdTotal').textContent=rows.length;
    $('#fdList').innerHTML=list.map(r=>`<article class="fd-row"><div class="fd-cell fd-rank">${r.order}</div><div class="fd-cell"><div class="fd-nick ${r.nick?'':'empty'}">${esc(r.nick||'ник не указан')}${r.note?`<span class="fd-note">${esc(r.note)}</span>`:''}</div></div><div class="fd-cell"><button class="fd-server-badge ${r.server?'':'unknown'}" style="--server-h:${hue(r.server)}" data-row-server="${esc(r.server)}">${esc(r.server||'—')}</button></div><div class="fd-cell fd-name" title="${esc(r.name)}">${esc(r.name||'—')}</div></article>`).join('');
    $('#fdEmpty').hidden=!!list.length;
    document.querySelectorAll('[data-row-server]').forEach(b=>b.addEventListener('click',()=>{if(!b.dataset.rowServer)return;$('#fdServerSelect').value=b.dataset.rowServer;render();window.scrollTo({top:document.querySelector('.fd-panel').offsetTop-70,behavior:'smooth'});}));
  }
  function setModel(model,kind){
    const incoming=rowsOf(model?.rows).map((r,i)=>normalize(r,i)); const initialized=!!model?.initialized; if(initialized||incoming.length)rows=incoming.sort((a,b)=>a.order-b.order); else rows=[...seed];
    updated=String(model?.updated||''); source=kind;
    $('#fdSource').textContent=kind==='firebase'?'Firebase':'Локальный'; $('#fdSyncState').textContent=kind==='firebase'?'LIVE • Firebase':'Резервный список'; $('#fdLiveDot').classList.toggle('live',kind==='firebase');
    $('#fdUpdated').textContent=updated?`Обновлено: ${updated}`:'Исходный импорт'; render();
  }
  $('#fdSearch').addEventListener('input',render); $('#fdServerSelect').addEventListener('change',render); $('#fdReset').addEventListener('click',()=>{$('#fdSearch').value='';$('#fdServerSelect').value='all';render();});
  setModel({rows:seed},'local');
  try{
    if(window.firebase&&window.BR_FIREBASE_CONFIG){if(!firebase.apps.length)firebase.initializeApp(window.BR_FIREBASE_CONFIG);firebase.database().ref('settings/directories/forbes').on('value',snap=>{const v=snap.val();if(v&&(v.initialized||rowsOf(v.rows).length))setModel(v,'firebase');else setModel({rows:seed},'local');},()=>setModel({rows:seed},'local'));}
  }catch(e){console.warn('Forbes directory sync unavailable',e);}
})();
