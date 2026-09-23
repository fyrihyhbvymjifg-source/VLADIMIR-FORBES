(()=>{
  const KEY='br78_user_site_settings_v1';
  const EFFECT_DEFAULT_MIGRATION_KEY='br78_effects_default_off_v1';
  const DEFAULTS={theme:'inherit',accent:'#ff3347',performance:'inherit',background:false,animations:false,particles:false,glass:false};
  const THEMES=new Set(['inherit','black-red','cyber-blue','gold','neon-purple','dark','custom']);
  const PERF=new Set(['inherit','max','balanced','low']);
  const root=document.documentElement;
  const read=()=>{
    try{
      let x=JSON.parse(localStorage.getItem(KEY)||'{}');
      x=x&&typeof x==='object'?x:{};
      if(localStorage.getItem(EFFECT_DEFAULT_MIGRATION_KEY)!=='1'){
        x={...x,background:false,animations:false,particles:false,glass:false};
        localStorage.setItem(KEY,JSON.stringify(x));
        localStorage.setItem(EFFECT_DEFAULT_MIGRATION_KEY,'1');
      }
      return {...DEFAULTS,...x};
    }catch{return {...DEFAULTS}}
  };
  let state=read();
  let applying=false;
  const normalize=s=>({
    theme:THEMES.has(s.theme)?s.theme:'inherit',
    accent:/^#[0-9a-f]{6}$/i.test(String(s.accent||''))?String(s.accent):'#ff3347',
    performance:PERF.has(s.performance)?s.performance:'inherit',
    background:s.background!==false,
    animations:s.animations!==false,
    particles:s.particles!==false,
    glass:s.glass!==false
  });
  const apply=()=>{
    state=normalize(state); applying=true;
    if(state.theme!=='inherit') root.dataset.theme=state.theme;
    root.style.setProperty('--custom-accent',state.accent);
    root.classList.toggle('user-no-background',!state.background);
    root.classList.toggle('user-no-animations',!state.animations);
    root.classList.toggle('user-no-particles',!state.particles);
    root.classList.toggle('user-no-glass',!state.glass);
    if(state.performance==='inherit'){window.BRPerformance?.clearOverride?.();}else if(window.BRPerformance?.set) window.BRPerformance.set(state.performance); else root.dataset.performance=state.performance;
    applying=false;
    document.querySelectorAll('[data-user-setting-current]').forEach(el=>el.textContent=state.performance==='max'?'Максимум качества':state.performance==='low'?'Слабое устройство':state.performance==='balanced'?'Баланс':'По умолчанию проекта');
  };
  const save=next=>{state=normalize({...state,...next});try{localStorage.setItem(KEY,JSON.stringify(state))}catch{}apply();window.dispatchEvent(new CustomEvent('br-user-settings-change',{detail:{...state}}));};
  const reset=()=>{state={...DEFAULTS};try{localStorage.removeItem(KEY)}catch{}apply();fill();};
  const fill=()=>{
    const modal=document.getElementById('userSettingsModal'); if(!modal)return;
    const set=(id,val)=>{const e=document.getElementById(id);if(e)e.value=val};
    set('userTheme',state.theme); set('userAccent',state.accent); set('userPerformance',state.performance);
    [['userBackground','background'],['userAnimations','animations'],['userParticles','particles'],['userGlass','glass']].forEach(([id,k])=>{const e=document.getElementById(id);if(e)e.checked=!!state[k]});
    const accentWrap=document.getElementById('userAccentWrap'); if(accentWrap) accentWrap.hidden=state.theme!=='custom';
  };
  const open=()=>{fill();document.getElementById('userSettingsModal')?.classList.add('open');document.body.classList.add('modal-open')};
  const close=()=>{document.getElementById('userSettingsModal')?.classList.remove('open');document.body.classList.remove('modal-open')};
  const inject=()=>{
    if(document.getElementById('userSettingsModal'))return;
    document.body.insertAdjacentHTML('beforeend',`<div class="user-settings-modal" id="userSettingsModal" aria-hidden="true"><div class="user-settings-backdrop" data-user-settings-close></div><section class="user-settings-card" role="dialog" aria-modal="true" aria-label="Личные настройки сайта"><div class="user-settings-head"><div><span>⚙️ Личные настройки</span><h2>Настрой сайт под себя</h2><p>Сохраняется только в этом браузере. Firebase не используется.</p></div><button type="button" class="user-settings-x" data-user-settings-close>×</button></div><div class="user-settings-grid"><label><span>🎨 Тема</span><select id="userTheme"><option value="inherit">Тема проекта</option><option value="black-red">Black Red</option><option value="cyber-blue">Cyber Blue</option><option value="gold">Gold Edition</option><option value="neon-purple">Neon Purple</option><option value="dark">Dark Original</option><option value="custom">Свой цвет</option></select></label><label id="userAccentWrap"><span>🎯 Свой акцент</span><input id="userAccent" type="color" value="#ff3347"></label><label class="wide"><span>⚡ Производительность</span><select id="userPerformance"><option value="inherit">Как в проекте</option><option value="max">Максимум качества</option><option value="balanced">Баланс</option><option value="low">Слабое устройство</option></select></label></div><div class="user-toggle-list"><label><input id="userBackground" type="checkbox"><span><b>🌌 Эффекты фона</b><small>Декоративное свечение и фоновые элементы</small></span></label><label><input id="userAnimations" type="checkbox"><span><b>✨ Анимации</b><small>Плавные переходы и эффекты карточек</small></span></label><label><input id="userParticles" type="checkbox"><span><b>🫧 Частицы</b><small>Пузырьки и фоновые частицы</small></span></label><label><input id="userGlass" type="checkbox"><span><b>🧊 Glass / Blur</b><small>Стеклянный эффект интерфейса</small></span></label></div><div class="user-settings-actions"><button type="button" class="user-settings-reset" id="userSettingsReset">Сбросить</button><button type="button" class="user-settings-save" id="userSettingsSave">Сохранить</button></div></section></div>`);
    fill();
    document.getElementById('userTheme')?.addEventListener('change',e=>{const w=document.getElementById('userAccentWrap');if(w)w.hidden=e.target.value!=='custom'});
    document.getElementById('userSettingsSave')?.addEventListener('click',()=>{save({theme:document.getElementById('userTheme')?.value,accent:document.getElementById('userAccent')?.value,performance:document.getElementById('userPerformance')?.value,background:!!document.getElementById('userBackground')?.checked,animations:!!document.getElementById('userAnimations')?.checked,particles:!!document.getElementById('userParticles')?.checked,glass:!!document.getElementById('userGlass')?.checked});close()});
    document.getElementById('userSettingsReset')?.addEventListener('click',reset);
  };
  document.addEventListener('click',e=>{if(e.target.closest('[data-open-user-settings]')){e.preventDefault();open()}if(e.target.closest('[data-user-settings-close]'))close()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
  document.addEventListener('DOMContentLoaded',()=>{inject();apply()});
  // Firebase can change the global theme later. A local override must stay local and win.
  new MutationObserver(()=>{if(applying||state.theme==='inherit')return;if(root.dataset.theme!==state.theme){applying=true;root.dataset.theme=state.theme;applying=false}}).observe(root,{attributes:true,attributeFilter:['data-theme']});
  window.BRUserSettings={get:()=>({...state}),set:save,reset,open,apply};
  apply();
})();
