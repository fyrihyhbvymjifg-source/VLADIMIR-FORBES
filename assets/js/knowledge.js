(function(){
  const root = document.querySelector('[data-knowledge-app]');
  if(!root || !window.BR_KNOWLEDGE_DATA) return;

  const data = window.BR_KNOWLEDGE_DATA.categories || [];
  const cards = root.querySelector('[data-kb-categories]');
  const detail = root.querySelector('[data-kb-detail]');
  const search = root.querySelector('[data-kb-search]');
  const count = root.querySelector('[data-kb-count]');
  const empty = root.querySelector('[data-kb-empty]');

  let activeId = location.hash.replace('#','');
  let activeSection = 'all';
  let query = '';

  const esc = (v='') => String(v).replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  function categoryHay(cat){
    return [
      cat.title,
      cat.subtitle,
      cat.description,
      ...(cat.subsections||[]).flatMap(section => [
        section.title,
        section.summary,
        ...((section.items||[]).flatMap(item=>[item.title,item.meta,item.text,...(item.tags||[])]))
      ])
    ].join(' ').toLowerCase();
  }

  function itemMatches(item, q){
    return !q || [item.title,item.meta,item.text,...(item.tags||[])].join(' ').toLowerCase().includes(q);
  }

  function sectionMatches(section, q){
    return !q || [section.title,section.summary,...(section.items||[]).flatMap(item=>[item.title,item.meta,item.text,...(item.tags||[])])].join(' ').toLowerCase().includes(q);
  }

  function renderCards(){
    const q = query.trim().toLowerCase();
    let shown = 0;
    cards.innerHTML = data.map(cat=>{
      const hide = q && !categoryHay(cat).includes(q);
      if(!hide) shown++;
      const totalItems = (cat.subsections||[]).reduce((sum, section)=>sum + (section.items||[]).length, 0);
      return `<button class="knowledge-category ${cat.id===activeId?'active':''}" data-kb-open="${esc(cat.id)}" ${hide?'hidden':''}>
        <div class="knowledge-category-badge">${(cat.subsections||[]).length} подразделов</div>
        <h3>${esc(cat.title)}</h3>
        <p>${esc(cat.subtitle)}</p>
        <div class="knowledge-category-meta">${totalItems} материалов</div>
        ${cat.image?`<img class="cat-photo" src="${esc(cat.image)}" alt="" loading="lazy">`:`<span class="cat-icon" aria-hidden="true">${esc(cat.icon)}</span>`}
      </button>`;
    }).join('');
    count.textContent = `Разделов: ${shown}`;
    empty.classList.toggle('show', shown === 0);
  }

  function renderDetail(){
    const focused=!!activeId;
    root.classList.toggle('kb-focused',focused);
    detail.hidden=!focused;
    if(!focused){detail.innerHTML='';return;}
    const cat = data.find(x=>x.id===activeId) || data[0];
    if(!cat) return;
    const q = query.trim().toLowerCase();
    const sections = (cat.subsections||[]).filter(section=>sectionMatches(section,q));
    const currentSection = activeSection === 'all'
      ? null
      : (cat.subsections||[]).find(section=>section.id === activeSection) || sections[0] || null;

    const visibleItems = (currentSection ? [currentSection] : sections).flatMap(section =>
      (section.items||[])
        .filter(item=>itemMatches(item,q))
        .map(item=>({ ...item, __sectionTitle: section.title }))
    );

    const sectionControls = [
      `<button class="knowledge-section-card ${activeSection==='all'?'active':''}" data-kb-section="all"><strong>Все материалы</strong><span>${sections.reduce((sum, sec)=>sum+(sec.items||[]).filter(item=>itemMatches(item,q)).length,0)} карточек</span></button>`,
      ...sections.map(section=>{
        const itemsCount = (section.items||[]).filter(item=>itemMatches(item,q)).length;
        return `<button class="knowledge-section-card ${section.id===activeSection?'active':''}" data-kb-section="${esc(section.id)}"><strong>${esc(section.title)}</strong><span>${esc(section.summary||'')}</span><b>${itemsCount} карточек</b></button>`;
      })
    ].join('');

    const itemsMarkup = visibleItems.length
      ? visibleItems.map(item=>`<article class="knowledge-item">
          <div class="item-meta">${esc(item.meta)}</div>
          <div class="item-section-label">${esc(item.__sectionTitle)}</div>
          <h3>${esc(item.title)}</h3>
          <p>${esc(item.text)}</p>
          <a href="${esc(item.source||cat.source)}" target="_blank" rel="noopener noreferrer">Проверить источник ↗</a>
          <div class="item-tags">${(item.tags||[]).slice(0,6).map(t=>`<span>${esc(t)}</span>`).join('')}</div>
        </article>`).join('')
      : `<div class="knowledge-empty show" style="grid-column:1/-1">По этому подразделу пока нет подходящих материалов под текущий поиск.</div>`;

    detail.innerHTML = `<button class="knowledge-source-btn" type="button" data-kb-back>← Назад к разделам</button>
      <div class="knowledge-detail-top">
        <div class="knowledge-title-row">
          <div class="knowledge-detail-icon">${esc(cat.icon)}</div>
          <div>
            <h2>${esc(cat.title)}</h2>
            <p class="knowledge-detail-desc">${esc(cat.description)}</p>
          </div>
        </div>
        <a class="knowledge-source-btn" href="${esc(cat.source)}" target="_blank" rel="noopener noreferrer">Официальный источник ↗</a>
      </div>
      <div class="knowledge-section-head">
        <div>
          <h3>Подразделы</h3>
          <p>Выбери конкретный блок — так страница будет работать как нормальная энциклопедия, а не одна длинная лента.</p>
        </div>
        <div class="knowledge-section-total">${sections.length} подразделов</div>
      </div>
      <div class="knowledge-sections-grid">${sectionControls}</div>
      <div class="knowledge-items">${itemsMarkup}</div>`;
  }

  root.addEventListener('click', e=>{
    if(e.target.closest('[data-kb-back]')){
      activeId='';activeSection='all';query='';search.value='';history.replaceState(null,'',location.pathname+location.search);renderCards();renderDetail();root.scrollIntoView({block:'start'});return;
    }
    const open = e.target.closest('[data-kb-open]');
    if(open){
      activeId = open.dataset.kbOpen;
      activeSection = 'all';
      history.replaceState(null,'','#'+activeId);
      renderCards();
      renderDetail();
      detail.scrollIntoView({behavior:'smooth',block:'start'});
      return;
    }
    const section = e.target.closest('[data-kb-section]');
    if(section){
      activeSection = section.dataset.kbSection;
      renderDetail();
    }
  });

  search.addEventListener('input',()=>{
    query = search.value;
    activeSection = 'all';
    renderCards();
    renderDetail();
  });

  renderCards();
  renderDetail();
})();
