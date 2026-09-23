(()=>{
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];

  function installAtmosphere(){
    if(!$('.v89-atmosphere')){
      const wrap=document.createElement('div');
      wrap.className='v89-atmosphere';wrap.setAttribute('aria-hidden','true');
      wrap.innerHTML='<i class="v89-grid"></i><i class="v89-aurora"></i><i class="v89-beam"></i><i class="v89-dust"></i>';
      document.body.prepend(wrap);
    }
    if(!$('.v89-cursor-glow')){
      const glow=document.createElement('div');glow.className='v89-cursor-glow';glow.setAttribute('aria-hidden','true');document.body.appendChild(glow);
    }
  }

  function installPointerLight(){
    if(document.documentElement.dataset.deviceTier==='optimized'||document.documentElement.dataset.safeMode==='1'||matchMedia('(pointer:coarse)').matches)return;
    let raf=0,x=innerWidth*.5,y=innerHeight*.28;
    const paint=()=>{raf=0;document.documentElement.style.setProperty('--v89-mx',`${x}px`);document.documentElement.style.setProperty('--v89-my',`${y}px`);};
    addEventListener('pointermove',e=>{x=e.clientX;y=e.clientY;if(!raf)raf=requestAnimationFrame(paint);},{passive:true});
  }

  function bindTopCard(card){
    if(card.dataset.v89Tilt==='1')return;card.dataset.v89Tilt='1';
    if(document.documentElement.dataset.deviceTier==='optimized'||document.documentElement.dataset.safeMode==='1'||matchMedia('(pointer:coarse)').matches||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    card.addEventListener('pointermove',e=>{
      const r=card.getBoundingClientRect();
      const px=(e.clientX-r.left)/r.width-.5,py=(e.clientY-r.top)/r.height-.5;
      card.style.setProperty('--ry',`${(px*5.5).toFixed(2)}deg`);
      card.style.setProperty('--rx',`${(-py*4.5).toFixed(2)}deg`);
    });
    card.addEventListener('pointerleave',()=>{card.style.setProperty('--ry','0deg');card.style.setProperty('--rx','0deg');});
  }
  function bindTopCards(){ $$('.elite-top-card').forEach(bindTopCard); }

  function installSecureLogin(){
    const card=$('.login-card');if(!card)return;
    if(!$('.v89-login-security',card)){
      const status=document.createElement('div');status.className='v89-login-security';
      status.innerHTML='<span><i></i> FIREBASE ONLINE</span><span>RBAC PROTECTED</span><span>SERVER 78 SECURE</span>';
      const hint=$('.login-hint',card);(hint||card).insertAdjacentElement(hint?'afterend':'beforeend',status);
    }
    const error=$('#loginError');if(error&&'MutationObserver'in window){
      let last='';new MutationObserver(()=>{const now=error.textContent.trim();if(now&&now!==last){card.classList.remove('v89-login-error');void card.offsetWidth;card.classList.add('v89-login-error');setTimeout(()=>card.classList.remove('v89-login-error'),360);}last=now;}).observe(error,{childList:true,subtree:true,characterData:true});
    }
  }


  function installAdminHero(){
    const dashboard=document.querySelector('#view-dashboard');
    if(!dashboard || dashboard.querySelector('.v90-admin-hero')) return;
    const anchor=dashboard.querySelector('.view-head');
    if(!anchor) return;
    const hero=document.createElement('section');
    hero.className='v90-admin-hero';
    hero.innerHTML=`<div class="v90-admin-copy"><h3>GOD PANEL • PREMIUM CONTROL</h3><p>Быстрое управление игроками, событиями сайта, доступами и рейтингом Forbes. Всё в одном месте, с живой атмосферой и быстрыми действиями.</p><div class="v90-admin-badges"><span>Игровой стиль</span><span>Glass UI</span><span>RBAC</span><span>Secure access</span></div><div class="v90-admin-actions"><button class="accent" type="button" data-go="players">Игроки</button><button type="button" data-go="events">События сайта</button><button type="button" data-go="admins">Доступы</button><button type="button" data-go="system">Система</button></div></div><div class="v90-admin-meta"><div class="v90-admin-stat"><span>Сотрудники</span><b id="v90AdminStatStaff">—</b></div><div class="v90-admin-stat"><span>Игроков</span><b id="v90AdminStatPlayers">—</b></div><div class="v90-admin-stat"><span>Состояние системы</span><b id="v90AdminStatSystem">ONLINE</b></div><div class="v90-admin-stat"><span>Время сервера</span><b id="v90AdminClock">--:--</b></div></div>`;
    anchor.insertAdjacentElement('afterend',hero);
    hero.querySelectorAll('[data-go]').forEach(btn=>btn.addEventListener('click',()=>document.querySelector(`.nav-btn[data-view="${btn.dataset.go}"]`)?.click()));
  }

  function syncAdminHero(){
    const players=(window.BR_PLAYERS||window.players||[]).length||document.querySelectorAll('#playersList .player-card').length||document.querySelectorAll('#ranking .rank-row').length||0;
    const staff=document.querySelectorAll('.staff-card,.staff-user-card,.admin-staff-row,[data-staff-row]').length || document.querySelectorAll('#staffList .list-item').length || 0;
    const p=document.getElementById('v90AdminStatPlayers'); if(p) p.textContent=String(players||'—');
    const s=document.getElementById('v90AdminStatStaff'); if(s) s.textContent=String(staff||'—');
    const c=document.getElementById('v90AdminClock'); if(c){
      const tick=()=>{const d=new Date(); c.textContent=d.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});};
      tick();
      if(!c.dataset.ticking){ c.dataset.ticking='1'; setInterval(tick,1000); }
    }
  }

  function watchDynamicTop(){
    if('MutationObserver' in window){
      const grid=$('#podiumGrid');
      if(grid) new MutationObserver(()=>bindTopCards()).observe(grid,{childList:true});

      const watched=[
        document.getElementById('playersList'),
        document.getElementById('staffList'),
        document.getElementById('ranking'),
        document.getElementById('dashboardGrid')
      ].filter(Boolean);
      let syncQueued=false;
      const queueSync=()=>{
        if(syncQueued) return;
        syncQueued=true;
        requestAnimationFrame(()=>{ syncQueued=false; syncAdminHero(); });
      };
      watched.forEach(el=>new MutationObserver(queueSync).observe(el,{childList:true,subtree:false}));
      window.addEventListener('hashchange',queueSync,{passive:true});
      window.addEventListener('focus',queueSync,{passive:true});
      setTimeout(queueSync,250);
      setTimeout(queueSync,1200);
    }
  }



  function installMobileNav(){
    const inner=document.querySelector('.topbar-inner');
    const nav=inner?.querySelector('.nav');
    const brand=inner?.querySelector('.brand');
    if(!inner||!nav||!brand) return;
    if(inner.closest('.main')) return;
    if(inner.querySelector('.mobile-nav-toggle')) return;

    const btn=document.createElement('button');
    btn.type='button';
    btn.className='mobile-nav-toggle';
    btn.setAttribute('aria-label','Открыть меню');
    btn.setAttribute('aria-expanded','false');
    btn.innerHTML='<span></span><span></span><span></span>';
    brand.insertAdjacentElement('afterend', btn);

    const syncHeaderBottom=()=>{
      const r=inner.closest('.topbar')?.getBoundingClientRect();
      if(r) document.documentElement.style.setProperty('--mobile-header-bottom',`${Math.max(0,r.bottom)}px`);
    };
    const close=()=>{
      inner.classList.remove('nav-open');
      document.body.classList.remove('public-nav-open');
      btn.setAttribute('aria-expanded','false');
      btn.setAttribute('aria-label','Открыть меню');
      syncHeaderBottom();
    };
    const open=()=>{
      syncHeaderBottom();
      inner.classList.add('nav-open');
      document.body.classList.add('public-nav-open');
      btn.setAttribute('aria-expanded','true');
      btn.setAttribute('aria-label','Закрыть меню');
    };
    btn.addEventListener('click',e=>{
      e.preventDefault();
      e.stopPropagation();
      inner.classList.contains('nav-open') ? close() : open();
    });
    nav.querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>close()));
    document.addEventListener('click',e=>{ if(!inner.contains(e.target)) close(); });
    window.addEventListener('resize',()=>{ syncHeaderBottom(); if(window.innerWidth>760) close(); },{passive:true});
    syncHeaderBottom();
  }
  function init(){
    installAtmosphere();installPointerLight();installSecureLogin();installAdminHero();installMobileNav();bindTopCards();watchDynamicTop();syncAdminHero();
    document.documentElement.dataset.premiumUi='v89';
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
