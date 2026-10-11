(function(){
  const SESSION_KEY = 'brForbesIntroSeen';

  /* One splash per browser-tab session. Reloads and internal page changes do not replay it. */
  try{
    if(sessionStorage.getItem(SESSION_KEY) === '1') return;
    sessionStorage.setItem(SESSION_KEY, '1');
  }catch(_){ /* If sessionStorage is blocked, just show the splash normally. */ }

  const root = document.documentElement;
  const body = document.body;
  if(!body || document.querySelector('.br-site-loader')) return;

  const currentPage = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const explicitContext = String(body.dataset.loaderContext || '').toLowerCase();
  const isGlobalForbes = explicitContext === 'global' || body.classList.contains('forbes-directory-page') || /(^|\/)forbes(?:\.html)?$/i.test(location.pathname);
  const contextLabel = isGlobalForbes
    ? 'ОБЩИЙ FORBES • BLACK RUSSIA'
    : 'FORBES 78 • VLADIMIR';

  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const oldTheme = themeMeta ? themeMeta.getAttribute('content') : '';
  root.classList.add('br-loader-active');
  body.classList.add('br-loader-active');
  if(themeMeta) themeMeta.setAttribute('content','#000000');

  const el = document.createElement('div');
  el.className = 'br-site-loader';
  el.setAttribute('aria-hidden','true');
  el.dataset.loaderContext = isGlobalForbes ? 'global' : 'server78';
  el.innerHTML = `
    <div class="bh-loader-stage">
      <div class="bh-loader-aura" aria-hidden="true"></div>
      <div class="bh-loader-logo" aria-hidden="true">
        <div class="bh-loader-badge">
          <div class="bh-loader-badge-outline"></div>
          <div class="bh-loader-letter">B</div>
          <span class="bh-loader-shape shape-plus"></span>
          <span class="bh-loader-shape shape-square"></span>
          <span class="bh-loader-shape shape-circle"></span>
          <span class="bh-loader-shape shape-triangle"></span>
        </div>
      </div>
      <div class="bh-loader-wordmark">
        <div class="bh-loader-title">BLACK<span>FORBES</span></div>
        <div class="bh-loader-subtitle">games</div>
        <div class="bh-loader-server">${contextLabel}</div>
      </div>
      <div class="bh-loader-line"><span></span></div>
    </div>`;
  body.prepend(el);

  const started = performance.now();
  let finished = false;
  const minVisible = 4400;
  const hardLimit = 5000;

  function unlock(){
    root.classList.remove('br-loader-active');
    body.classList.remove('br-loader-active');
    if(themeMeta && oldTheme) themeMeta.setAttribute('content',oldTheme);
  }

  function finish(){
    if(finished) return;
    finished = true;
    const wait = Math.max(0, minVisible - (performance.now() - started));
    setTimeout(() => {
      el.classList.add('is-leaving');
      setTimeout(() => {
        el.classList.add('is-hidden');
        unlock();
        setTimeout(() => el.remove(), 650);
      }, 300);
    }, wait);
  }

  if(document.readyState === 'complete') finish();
  else window.addEventListener('load', finish, {once:true});
  setTimeout(finish, hardLimit);
})();
