/* All values come from the rating's own normalized money and asset calculation. */
const BRExplorerMath = {
  known: p => !!p && (p.wealthKnown || Number(p.assetValue) > 0),
  gap: (a,b) => Math.max(0,Number(b.netWorth)-Number(a.netWorth)),
  progress: (a,b) => Number(b.netWorth)>0 ? Math.min(100,Math.max(0,Number(a.netWorth)/Number(b.netWorth)*100)) : 0,
  nearest: (players,p) => players.filter(x => x.id!==p.id && BRExplorerMath.known(x))
    .sort((a,b) => Math.abs(a.netWorth-p.netWorth)-Math.abs(b.netWorth-p.netWorth)).slice(0,3)
};
if (typeof module !== 'undefined') module.exports = BRExplorerMath;
if (typeof document !== 'undefined') (() => {
  'use strict';
  const mount=document.querySelector('#rating .shell'); if(!mount)return;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=v=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0}).format(Number(v)||0)+' ₽';
  const params=new URLSearchParams(location.search);
  let players=window.BR_MINIPROFILE_PLAYERS||[], left=params.get('compareA')||'',right=params.get('compareB')||'';
  const panel=document.createElement('section');panel.className='fx-panel';panel.setAttribute('aria-labelledby','fxTitle');
  panel.innerHTML=`<div class="fx-heading"><div><span class="fx-eyebrow">FORBES 78 / PLAYER MATCH</span><h2 id="fxTitle">Лицом к лицу</h2><p>Два игрока. Один экран. Вся разница в цифрах.</p></div><span class="fx-tag">Сравнение игроков</span></div><div class="fx-tabs" role="tablist" aria-label="Инструменты рейтинга"><button id="fxCompareTab" role="tab" aria-selected="true" aria-controls="fxCompare">Сравнение</button><button id="fxRadarTab" role="tab" aria-selected="false" aria-controls="fxRadar" tabindex="-1">Радар и цель</button></div><div class="fx-selectors"><label>Первый игрок<select id="fxLeft"></select></label><button class="fx-swap" aria-label="Поменять игроков местами" type="button">⇄</button><label>Второй игрок / цель<select id="fxRight"></select></label></div><div id="fxCompare" role="tabpanel" aria-labelledby="fxCompareTab"></div><div id="fxRadar" role="tabpanel" aria-labelledby="fxRadarTab" hidden></div><div class="fx-footer"><small>Расчёт по опубликованным данным. Неуказанные суммы не считаются подтверждённым нулём.</small><button type="button" class="fx-share">Поделиться сравнением ↗</button></div><p class="fx-status" role="status" aria-live="polite"></p>`;
  mount.append(panel);
  const jump=document.createElement('button');jump.type='button';jump.className='fx-share';jump.textContent='Сравнить игроков ↗';
  mount.querySelector('.section-head')?.append(jump);
  jump.onclick=()=>{panel.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',block:'start'});panel.querySelector('#fxLeft').focus({preventScroll:true});};

  const aSelect=panel.querySelector('#fxLeft'),bSelect=panel.querySelector('#fxRight');
  const compare=panel.querySelector('#fxCompare'),radar=panel.querySelector('#fxRadar');
  function update(){
    if(!players.some(p=>String(p.id)===left))left=String(players[0]?.id||'');
    if(!players.some(p=>String(p.id)===right)||right===left)right=String(players.find(p=>String(p.id)!==left)?.id||'');
    const options='<option value="">Выберите игрока</option>'+players.map(p=>`<option value="${esc(p.id)}">#${Number(p.rank)||'—'} · ${esc(p.nick)}</option>`).join('');
    aSelect.innerHTML=options;bSelect.innerHTML=options;aSelect.value=left;bSelect.value=right;render();
  }
  const short=v=>new Intl.NumberFormat('ru-RU',{notation:'compact',maximumFractionDigits:2}).format(Number(v)||0)+' ₽';
  const playerCard=(p,side)=>{
    const src=String(p.avatar||'');
    const safe=/^https:\/\//i.test(src)||/^assets\//.test(src)||/^data:image\/(png|jpeg|webp);base64,/i.test(src);
    const initials=String(p.nick||'BR').split(/[_ ]/).slice(0,2).map(x=>x[0]).join('').toUpperCase();
    return `<article class="fx-player-card fx-player-${side}"><div class="fx-player-top"><span class="fx-player-avatar">${safe?`<img src="${esc(src)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">`:esc(initials)}</span><span class="fx-player-rank">#${Number(p.rank)||'—'} <small>в рейтинге</small></span></div><h3>${esc(p.nick)}</h3><p>${esc(p.name||'Vladimir / 78')}</p><span class="fx-player-label">Опубликованное состояние</span><strong class="fx-player-money">${BRExplorerMath.known(p)?esc(short(p.netWorth)):'Не указано'}</strong>${!p.wealthKnown?'<small class="fx-partial">Баланс не указан</small>':''}</article>`;
  };
  const value=(p,key)=>key==='netWorth'?BRExplorerMath.known(p)?fmt(p.netWorth)+(p.wealthKnown?'':' *'):'Не указано':key==='cashValue'?p.cashValue!==null&&p.cashValue!==undefined?fmt(p.cashValue):'Не указано':key==='assetValue'?fmt(p.assetValue):Number(p[key])||0;
  function render(){
    const a=players.find(p=>String(p.id)===left),b=players.find(p=>String(p.id)===right);
    if(!a||!b){compare.innerHTML='<p class="fx-empty">Для сравнения нужны два игрока в рейтинге.</p>';radar.innerHTML=compare.innerHTML;return;}
    if(a.id===b.id){compare.innerHTML='<p class="fx-empty">Выберите двух разных игроков.</p>';radar.innerHTML=compare.innerHTML;return;}
    const rows=[['Состояние','netWorth'],['Деньги','cashValue'],['Стоимость имущества','assetValue'],['Бизнесы','businessCount'],['Дома','houseCount'],['Гаражи','garageCount']];
    const both=BRExplorerMath.known(a)&&BRExplorerMath.known(b),diff=Math.abs(Number(a.netWorth)-Number(b.netWorth));
    const lead=a.netWorth>b.netWorth?a:b;
    const verdict=both?(diff===0?'Состояния равны':`${esc(lead.nick)} впереди по сумме`):'Есть неполные данные';
    compare.innerHTML=`<div class="fx-match"><div>${playerCard(a,'a')}</div><span class="fx-versus" aria-hidden="true">VS</span><div>${playerCard(b,'b')}</div></div><div class="fx-difference"><span><i aria-hidden="true">↗</i><b>${verdict}</b></span><strong>${both?esc(short(diff)):'—'}<small>разница в состоянии</small></strong></div><div class="fx-table-wrap"><table class="fx-table"><caption class="fx-sr">Сравнение ${esc(a.nick)} и ${esc(b.nick)}</caption><thead><tr><th scope="col">ПОКАЗАТЕЛИ</th><th scope="col">${esc(a.nick)}</th><th scope="col">${esc(b.nick)}</th></tr></thead><tbody>${rows.map(([label,key])=>{
      const max=Math.max(Number(a[key])||0,Number(b[key])||0),money=['netWorth','cashValue','assetValue'].includes(key);
      return `<tr><th scope="row">${label}</th>${[a,b].map((p,i)=>`<td><b>${value(p,key)}</b>${max>0&&(!money||key!=='netWorth'||BRExplorerMath.known(p))&&p[key]!==null?`<div class="fx-stat-bar fx-bar-${i}"><i style="width:${Math.max(0,Number(p[key])||0)/max*100}%"></i></div>`:''}</td>`).join('')}</tr>`;
    }).join('')}</tbody></table></div><p class="fx-note">* При неизвестном балансе показана стоимость заполненного имущества. Объекты считаются по спискам профиля.</p>`;

    if(!BRExplorerMath.known(a)){radar.innerHTML='<p class="fx-empty">У первого игрока пока нет опубликованных сумм. Радар появится после обновления данных администрацией.</p>';return;}
    const nearest=BRExplorerMath.nearest(players,a),gap=BRExplorerMath.gap(a,b),pct=BRExplorerMath.progress(a,b);
    radar.innerHTML=`<div class="fx-radar-grid"><article class="fx-goal"><span class="fx-eyebrow">ЦЕЛЬ · ${esc(b.nick)}</span>${BRExplorerMath.known(b)?`<h3>${gap>0?'До состояния цели':'Цель по сумме достигнута'}</h3><strong class="fx-value">${fmt(gap)}</strong><div class="fx-meter" role="progressbar" aria-label="Состояние относительно цели" aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div><p>${pct.toFixed(1)}% от опубликованного состояния цели.</p>`:'<h3>У цели нет опубликованной суммы</h3>'}<small>Это сравнение известных сумм, а не прогноз места в рейтинге.</small>${!a.wealthKnown||!b.wealthKnown?'<p class="fx-note">Есть неполные данные: часть балансов не указана.</p>':''}</article><article class="fx-neighbors"><span class="fx-eyebrow">БЛИЖАЙШИЕ ПО СОСТОЯНИЮ</span>${nearest.map(p=>`<button type="button" data-target="${esc(p.id)}"><span><b>${esc(p.nick)}</b><small>#${Number(p.rank)||'—'} · ${fmt(p.netWorth)}${p.wealthKnown?'':' *'}</small></span><span>${p.netWorth>=a.netWorth?'+':'−'}${fmt(Math.abs(p.netWorth-a.netWorth))} →</span></button>`).join('')||'<p>У других игроков пока нет сумм для сравнения.</p>'}</article></div><div class="fx-assets"><span>В опубликованном состоянии ${esc(a.nick)}</span><div><b>Деньги: ${value(a,'cashValue')}</b><b>Имущество: ${fmt(a.assetValue)}</b></div></div>`;
    radar.querySelectorAll('[data-target]').forEach(btn=>btn.addEventListener('click',()=>{right=btn.dataset.target;bSelect.value=right;render();}));
  }
  aSelect.addEventListener('change',()=>{left=aSelect.value;render();});bSelect.addEventListener('change',()=>{right=bSelect.value;render();});
  panel.querySelector('.fx-swap').addEventListener('click',()=>{[left,right]=[right,left];aSelect.value=left;bSelect.value=right;render();});
  const tabs=[panel.querySelector('#fxCompareTab'),panel.querySelector('#fxRadarTab')];
  function tab(index){tabs.forEach((t,i)=>{t.setAttribute('aria-selected',String(i===index));t.tabIndex=i===index?0:-1;});compare.hidden=index!==0;radar.hidden=index!==1;compare.style.setProperty('display',index===0?'block':'none','important');radar.style.setProperty('display',index===1?'block':'none','important');}
  tabs.forEach((t,i)=>{t.onclick=()=>tab(i);t.onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const j=e.key==='Home'?0:e.key==='End'?1:1-i;tab(j);tabs[j].focus();}};});
  tab(0);
  panel.querySelector('.fx-share').onclick=async()=>{
    const status=panel.querySelector('.fx-status');if(!left||!right||left===right){status.textContent='Выберите двух разных игроков.';return;}
    const url=new URL(location.href);url.searchParams.set('compareA',left);url.searchParams.set('compareB',right);url.hash='fxTitle';
    try{await navigator.clipboard.writeText(url.href);status.textContent='Ссылка на сравнение скопирована.';}catch{status.replaceChildren();const input=document.createElement('input');input.readOnly=true;input.value=url.href;input.setAttribute('aria-label','Ссылка на сравнение');status.append(input);input.select();}
  };
  window.addEventListener('br:miniprofile-players',e=>{players=e.detail||[];update();});update();
  const filters=document.querySelector('.toolbar-right');
  if(filters){const button=document.createElement('button');button.type='button';button.className='fx-filter-toggle';button.textContent='Фильтры';button.setAttribute('aria-expanded','false');const extras=[...filters.querySelectorAll('[data-filter]')].filter(b=>!['all','filled','empty'].includes(b.dataset.filter));extras.forEach(x=>x.classList.add('fx-extra-filter'));button.onclick=()=>{const open=filters.classList.toggle('fx-filters-open');button.setAttribute('aria-expanded',String(open));button.textContent=open?'Скрыть фильтры':'Фильтры';};filters.prepend(button);}
})();
