(()=>{
  const KEY='br78_performance_mode_v1';
  const VALID=new Set(['max','balanced','low']);
  const labels={max:'Максимум качества',balanced:'Баланс',low:'Слабое устройство'};
  const root=document.documentElement;
  const stored=()=>{try{return localStorage.getItem(KEY)||''}catch{return ''}};
  const norm=v=>VALID.has(v)?v:'balanced';
  const render=mode=>{
    root.dataset.performance=mode;
    document.querySelectorAll('[data-performance-choice]').forEach(btn=>btn.classList.toggle('active',btn.dataset.performanceChoice===mode));
    const label=document.getElementById('performanceCurrentLabel'); if(label) label.textContent=labels[mode]||labels.balanced;
    const status=document.getElementById('performanceStatus'); if(status) status.textContent=labels[mode]||labels.balanced;
  };
  let current=norm(stored()||'balanced');
  render(current);
  window.BRPerformance={
    get:()=>current,
    hasOverride:()=>!!stored(),
    set(mode){current=norm(mode);try{localStorage.setItem(KEY,current)}catch{}render(current);window.dispatchEvent(new CustomEvent('br-performance-change',{detail:{mode:current}}));},
    setDefault(mode){if(stored()) return; current=norm(mode);render(current);},
    clearOverride(){try{localStorage.removeItem(KEY)}catch{}current='balanced';render(current);}
  };
  document.addEventListener('click',e=>{const b=e.target.closest('[data-performance-choice]');if(!b)return;window.BRPerformance.set(b.dataset.performanceChoice);});
  document.addEventListener('DOMContentLoaded',()=>render(current));
})();
