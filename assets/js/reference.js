(function(){
  const app=document.querySelector('[data-reference-app]');
  if(!app)return;
  const type=app.dataset.referenceType;
  const search=app.querySelector('[data-ref-search]');
  const chips=app.querySelector('[data-ref-chips]');
  const content=app.querySelector('[data-ref-content]');
  const counter=app.querySelector('[data-ref-counter]');
  let active='all',query='';
  const esc=(v='')=>String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const norm=s=>String(s||'').toLowerCase().replace(/ё/g,'е');

  function commandData(){return window.BR_COMMANDS_DATA||{categories:[]}}
  function termData(){return window.BR_TERMS_DATA||{items:[]}}
  function testData(){return window.BR_TESTS_DATA||{categories:[]}}

  function renderChips(){
    let list=[];
    if(type==='commands')list=commandData().categories.map(x=>x.name);
    if(type==='terms')list=[...new Set(termData().items.map(x=>x.group))];
    if(type==='tests')list=testData().categories.map(x=>x.name);
    chips.innerHTML=`<button class="reference-chip ${active==='all'?'active':''}" data-ref-chip="all">Все</button>`+list.map(x=>`<button class="reference-chip ${active===x?'active':''}" data-ref-chip="${esc(x)}">${esc(x)}</button>`).join('');
  }

  function renderCommands(){
    const q=norm(query);let shown=0;
    const sections=commandData().categories.filter(cat=>active==='all'||cat.name===active).map(cat=>{
      const items=cat.items.filter(i=>!q||norm(`${i.command} ${i.description} ${i.access}`).includes(q)); shown+=items.length;
      if(!items.length)return'';
      return `<section class="reference-section"><div class="reference-section-head"><h2><span class="reference-section-icon">${esc(cat.icon)}</span>${esc(cat.name)}</h2><span>${items.length} команд</span></div><div class="command-table">${items.map(i=>`<div class="command-row"><div class="command-code">${esc(i.command)}</div><div class="command-desc">${esc(i.description)}</div><div class="command-access">${esc(i.access)}</div></div>`).join('')}</div></section>`;
    }).join('');
    counter.textContent=`Показано: ${shown}`;content.innerHTML=sections||'<div class="reference-empty">Ничего не найдено.</div>';
  }

  function renderTerms(){
    const q=norm(query);let shown=0;
    const groups=[...new Set(termData().items.map(x=>x.group))].filter(g=>active==='all'||g===active);
    const html=groups.map(group=>{
      const items=termData().items.filter(i=>i.group===group&&(!q||norm(`${i.term} ${i.full} ${i.meaning}`).includes(q))); shown+=items.length;
      if(!items.length)return'';
      return `<section class="reference-section"><div class="reference-section-head"><h2>📖 ${esc(group)}</h2><span>${items.length} терминов</span></div><div class="term-grid">${items.map(i=>`<article class="term-card"><div class="term-top"><h3>${esc(i.term)}</h3><span class="term-full">${esc(i.full)}</span></div><p>${esc(i.meaning)}</p></article>`).join('')}</div></section>`;
    }).join('');
    counter.textContent=`Показано: ${shown}`;content.innerHTML=html||'<div class="reference-empty">Ничего не найдено.</div>';
  }

  function renderTests(){
    const q=norm(query);let shown=0;
    const html=testData().categories.filter(cat=>active==='all'||cat.name===active).map(cat=>{
      const items=cat.items.filter(i=>!q||norm(`${i.section} ${i.question} ${i.answer}`).includes(q)); shown+=items.length;
      if(!items.length)return'';
      const grouped={};items.forEach(i=>(grouped[i.section]||(grouped[i.section]=[])).push(i));
      return `<section class="reference-section"><div class="reference-section-head"><h2>${esc(cat.icon)} ${esc(cat.name)}</h2><span>${items.length} вопросов</span></div>${cat.note?`<div class="test-note" style="margin:12px 15px 0">${esc(cat.note)}</div>`:''}<div class="test-list">${Object.entries(grouped).map(([section,arr])=>`<div class="test-group-title">${esc(section)}</div>${arr.map(i=>`<article class="test-card"><button class="test-question" type="button"><span>${esc(i.question)}</span><b>+</b></button><div class="test-answer"><strong>Ответ:</strong> ${esc(i.answer)}</div></article>`).join('')}`).join('')}</div></section>`;
    }).join('');
    counter.textContent=`Показано: ${shown}`;content.innerHTML=html||'<div class="reference-empty">Ничего не найдено.</div>';
  }

  function render(){renderChips(); if(type==='commands')renderCommands(); if(type==='terms')renderTerms(); if(type==='tests')renderTests();}
  app.addEventListener('click',e=>{
    const chip=e.target.closest('[data-ref-chip]'); if(chip){active=chip.dataset.refChip;render();return;}
    const q=e.target.closest('.test-question'); if(q){q.closest('.test-card')?.classList.toggle('open');}
  });
  search?.addEventListener('input',()=>{query=search.value;render();});
  render();
})();
