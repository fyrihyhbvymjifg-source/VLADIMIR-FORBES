(function(){
  'use strict';

  const DEFAULT_PUBLIC_NAV = {
    admins: true,
    techs: true,
    cars: true, property: true, blackpass: true,
    servers: true,
    leaders: true,
    events: true,
    chat: true,
    support: true,
    achievements: true,
    knowledge: true,
    settings: true,
    login: true
  };

  const ICONS = {
    trophy:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4h8v4c0 3.3-1.8 5.7-4 5.7S8 11.3 8 8V4Z"/><path d="M8 6H5v1.5C5 10 6.5 11 9 11M16 6h3v1.5c0 2.5-1.5 3.5-4 3.5M12 14v3M8.5 20h7M10 17h4"/></svg>',
    globe:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c2.2 2.2 3.3 4.9 3.3 8S14.2 17.8 12 20M12 4c-2.2 2.2-3.3 4.9-3.3 8S9.8 17.8 12 20"/></svg>',
    users:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="9" r="3"/><circle cx="17" cy="10" r="2.2"/><path d="M3.8 19c.7-3.3 2.5-5 5.2-5s4.5 1.7 5.2 5M14 15c2.6-.5 4.8.8 5.6 3.3"/></svg>',
    techs:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 5.5 4 4M13 7l4 4M4 20l5.5-5.5M7.5 4.5a4 4 0 0 0 5 5L8 14l2 2 4.5-4.5a4 4 0 0 0 5-5l-3 3-2-2 3-3a4 4 0 0 0-5 5L8 14"/></svg>',
    servers:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="6" rx="1.5"/><rect x="4" y="14" width="16" height="6" rx="1.5"/><path d="M8 7h.01M8 17h.01M12 7h5M12 17h5"/></svg>',
    crown:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 8 4 3 4-6 4 6 4-3-1.5 9h-13L4 8Z"/><path d="M7 20h10"/></svg>',
    fire:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 3c1.1 3.7-.3 5.2-1.8 6.8-1.2 1.3-2.2 2.6-1.1 4.8.6-2 1.9-2.9 3.4-4.1 1.7 1.8 3 3.6 3 5.7A4.6 4.6 0 0 1 12 21a6 6 0 0 1-6-6.1C6 10.8 9 8.6 13 3Z"/></svg>',
    chat:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5.5h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-8l-4.5 3v-3H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z"/></svg>',
    ticket:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16v4a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4V7Z"/><path d="M9 7v11"/></svg>',
    medal:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 3 4 6 4-6M10 8 7 3M14 8l3-5"/><circle cx="12" cy="14" r="5"/><path d="m10 14 1.3 1.3L14.5 12"/></svg>',
    book:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5c3.3-.8 5.8-.2 8 1.7v12c-2.2-1.9-4.7-2.5-8-1.7v-12ZM20 5.5c-3.3-.8-5.8-.2-8 1.7v12c2.2-1.9 4.7-2.5 8-1.7v-12Z"/></svg>',
    gear:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"/><circle cx="12" cy="12" r="7"/></svg>',
    login:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 5H5v14h5M13 8l4 4-4 4M8 12h9"/></svg>'
  };

  function currentPage(){
    const raw = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    return raw || 'index.html';
  }

  function readLocalSiteSettings(){
    try{
      const key = window.BR_KEYS?.meta || 'br78_forbes_meta_v1';
      const parsed = JSON.parse(localStorage.getItem(key) || '{}');
      return parsed && parsed.siteSettings && typeof parsed.siteSettings === 'object' ? parsed.siteSettings : {};
    }catch(_){ return {}; }
  }

  function getSiteSettings(){
    const src = (window.BRCurrentSiteSettings && typeof window.BRCurrentSiteSettings === 'object')
      ? window.BRCurrentSiteSettings
      : readLocalSiteSettings();
    const publicNav = src && src.publicNav && typeof src.publicNav === 'object' ? src.publicNav : {};
    const forbes78Nav = src && src.forbes78Nav && typeof src.forbes78Nav === 'object' ? src.forbes78Nav : publicNav;
    const forbesGlobalNav = src && src.forbesGlobalNav && typeof src.forbesGlobalNav === 'object' ? src.forbesGlobalNav : publicNav;
    return {
      ...src,
      publicNav: {...DEFAULT_PUBLIC_NAV, ...publicNav},
      forbes78Nav: {...DEFAULT_PUBLIC_NAV, ...forbes78Nav},
      forbesGlobalNav: {...DEFAULT_PUBLIC_NAV, ...forbesGlobalNav}
    };
  }

  function isGlobalForbesPage(page){
    return page === 'forbes.html' || page === 'forbes-apply.html';
  }

  function visibilityForPage(page){
    const settings = getSiteSettings();
    return isGlobalForbesPage(page)
      ? (settings.forbesGlobalNav || DEFAULT_PUBLIC_NAV)
      : (settings.forbes78Nav || settings.publicNav || DEFAULT_PUBLIC_NAV);
  }

  function escapeHtml(value){
    return String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }

  function isActive(key, page){
    if(key === 'forbes78') return page === 'index.html' || page === '';
    if(key === 'forbesGlobal') return page === 'forbes.html' || page === 'forbes-apply.html';
    if(key === 'login') return page === 'forbes-login.html' || page === 'profile.html';
    const map = {
      admins:'admins.html', techs:'techs.html', servers:'servers.html', cars:'garage.html', property:'garage.html#property', blackpass:'black-pass.html', leaders:'leaders.html', events:'events.html', chat:'chat.html',
      support:'support.html', achievements:'achievements.html', knowledge:'knowledge.html'
    };
    return map[key] === page;
  }

  function navLink({href,label,key,icon,cls='', attrs={}, badge=''}){
    const page = currentPage();
    const classes = ['br-nav-link', cls, isActive(key,page) ? 'active' : ''].filter(Boolean).join(' ');
    const attrsText = Object.entries(attrs).map(([k,v]) => v === '' ? k : `${k}="${escapeHtml(v)}"`).join(' ');
    return `<a href="${escapeHtml(href)}" class="${escapeHtml(classes)}" data-nav-key="${escapeHtml(key)}"${attrsText ? ` ${attrsText}` : ''}>`+
      `<span class="nav-ico nav-ico-${escapeHtml(key)}">${ICONS[icon] || ''}</span>`+
      `<span class="nav-text">${escapeHtml(label)}</span>`+
      (badge ? `<span class="nav-mini-badge">${escapeHtml(badge)}</span>` : '')+
      `</a>`;
  }

  function buildReferenceNav(nav){
    const show = visibilityForPage(currentPage());
    const ranking = [
      navLink({href:'index.html',label:'Forbes 78',key:'forbes78',icon:'trophy',cls:'nav-pill forbes-home-link'}),
      navLink({href:'forbes.html',label:'Общий Forbes',key:'forbesGlobal',icon:'globe',cls:'nav-pill general-forbes-link'})
    ];
    const sections = [];
    if(show.admins) sections.push(navLink({href:'admins.html',label:'Администрация',key:'admins',icon:'users'}));
    if(show.techs) sections.push(navLink({href:'techs.html',label:'Тех. администраторы',key:'techs',icon:'techs'}));
    if(show.servers) sections.push(navLink({href:'servers.html',label:'Серверы',key:'servers',icon:'servers'}));
    if(show.leaders) sections.push(navLink({href:'leaders.html',label:'Лидеры',key:'leaders',icon:'crown'}));
    if(show.events) sections.push(navLink({href:'events.html',label:'События',key:'events',icon:'fire',badge:'NEW'}));
    if(show.chat) sections.push(navLink({href:'chat.html',label:'Чат',key:'chat',icon:'chat'}));
    if(show.support) sections.push(navLink({href:'support.html',label:'Поддержка',key:'support',icon:'ticket'}));
    if(show.achievements) sections.push(navLink({href:'achievements.html',label:'Достижения',key:'achievements',icon:'medal'}));
    if(show.cars) sections.push(navLink({href:'garage.html',label:'Автомобили',key:'cars',icon:'servers'}));
    if(show.property) sections.push(navLink({href:'garage.html#property',label:'Недвижимость',key:'property',icon:'book'}));
    if(show.blackpass) sections.push(navLink({href:'black-pass.html',label:'Black Pass',key:'blackpass',icon:'ticket'}));
    if(show.knowledge) sections.push(navLink({href:'knowledge.html',label:'База знаний',key:'knowledge',icon:'book'}));
    const actions = [];
    if(show.settings) actions.push(navLink({href:'#',label:'Настройки',key:'settings',icon:'gear',cls:'user-settings-nav',attrs:{'data-open-user-settings':''}}));
    if(show.login) actions.push(navLink({href:'forbes-login.html',label:'Войти',key:'login',icon:'login',cls:'nav-login-link'}));

    nav.innerHTML = `
      <div class="nav-group nav-rankings" data-nav-label="Forbes">${ranking.join('')}</div>
      <div class="nav-group nav-sections" data-nav-label="Разделы">${sections.join('')}</div>
      <div class="nav-group nav-actions" data-nav-label="Аккаунт">${actions.join('')}</div>`;
    nav.dataset.brGeneratedNav = 'reference-v10';
  }

  function setHeaderBottom(inner){
    const topbar = inner.closest('.topbar');
    if(!topbar) return;
    const r = topbar.getBoundingClientRect();
    document.documentElement.style.setProperty('--mobile-header-bottom', `${Math.max(0, r.bottom)}px`);
  }

  function installMobileToggle(inner, nav){
    let toggle = inner.querySelector('.mobile-nav-toggle');
    if(toggle && toggle.dataset.brRefBound === '1') return;

    if(!toggle){
      toggle = document.createElement('button');
      toggle.className = 'mobile-nav-toggle';
      toggle.type = 'button';
      toggle.innerHTML = '<span></span><span></span><span></span>';
      inner.insertBefore(toggle, nav);
    }

    toggle.dataset.brRefBound = '1';
    toggle.setAttribute('aria-label','Открыть меню');
    toggle.setAttribute('aria-expanded','false');

    const closeMenu = () => {
      inner.classList.remove('nav-open');
      document.body.classList.remove('public-nav-open');
      document.documentElement.classList.remove('nav-menu-open');
      toggle.setAttribute('aria-expanded','false');
      toggle.setAttribute('aria-label','Открыть меню');
      setHeaderBottom(inner);
    };
    const openMenu = () => {
      setHeaderBottom(inner);
      inner.classList.add('nav-open');
      document.body.classList.add('public-nav-open');
      document.documentElement.classList.add('nav-menu-open');
      toggle.setAttribute('aria-expanded','true');
      toggle.setAttribute('aria-label','Закрыть меню');
    };

    // Use capture so this remains stable even on pages with old menu handlers.
    toggle.addEventListener('click', e => {
      e.preventDefault();
      e.stopImmediatePropagation();
      inner.classList.contains('nav-open') ? closeMenu() : openMenu();
    }, true);
    nav.addEventListener('click', e => {
      if(e.target.closest('a') && window.innerWidth <= 1120) closeMenu();
    });
    document.addEventListener('click', e => {
      if(window.innerWidth <= 1120 && !inner.contains(e.target)) closeMenu();
    });
    window.addEventListener('resize', () => {
      setHeaderBottom(inner);
      if(window.innerWidth > 1120) closeMenu();
    }, {passive:true});
    setHeaderBottom(inner);
  }

  function normalizeBrand(topbar){
    const brand = topbar.querySelector('.brand');
    if(!brand) return;
    const mark = brand.querySelector('.brand-mark');
    const copy = brand.querySelector('.brand-copy');
    if(mark) mark.textContent = 'BR';
    if(copy){
      const strong = copy.querySelector('strong');
      const sub = copy.querySelector('span');
      if(strong && !strong.id) strong.textContent = 'BLACK RUSSIA • FORBES';
      if(sub && !sub.id) sub.textContent = 'SERVER 78 • VLADIMIR';
    }
  }

  function enhanceTopbar(){
    const topbar = document.querySelector('.topbar');
    if(!topbar || topbar.closest('.main')) return;
    const inner = topbar.querySelector('.topbar-inner');
    const nav = topbar.querySelector('.nav');
    const brand = topbar.querySelector('.brand');
    if(!inner || !nav || !brand) return;

    topbar.classList.remove('br-topbar-v3');
    topbar.classList.add('br-topbar-reference');
    normalizeBrand(topbar);
    const page=currentPage().replace(/\.html$/,'');
    if(!['index','forbes',''].includes(page)){
      document.body.classList.add('br-focused-page');
      let origin='index.html';
      try{if(sessionStorage.getItem('br-nav-origin')==='forbes.html')origin='forbes.html';}catch{}
      nav.innerHTML='<a class="br-nav-link" href="'+(['commands','terms','tests'].includes(page)?'knowledge.html':origin)+'">← Назад</a>';
      return;
    }
    try{sessionStorage.setItem('br-nav-origin',page==='forbes'?'forbes.html':'index.html');}catch{}
    buildReferenceNav(nav);
    installMobileToggle(inner, nav);

    window.addEventListener('br-site-settings', () => {
      buildReferenceNav(nav);
    });
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enhanceTopbar, {once:true});
  else enhanceTopbar();
})();
