(()=>{
const defs={
  "off":{label:"Без события",icon:"◌",items:[],accent:"#ff3347",ambient:"radial-gradient(circle at 12% 18%,rgba(255,51,71,.14),transparent 34%),radial-gradient(circle at 88% 10%,rgba(255,255,255,.02),transparent 30%)"},
  "spring":{label:"🌸 Весна",icon:"🌸",items:["🌸", "✿", "🌷"],accent:"#ff78b3",ambient:"radial-gradient(circle at 12% 18%,rgba(255,120,179,.22),transparent 34%),radial-gradient(circle at 88% 10%,rgba(190,104,255,.10),transparent 30%)"},
  "summer":{label:"☀️ Лето",icon:"☀️",items:["☀️", "✨", "🌿"],accent:"#ffc743",ambient:"radial-gradient(circle at 12% 18%,rgba(255,199,67,.24),transparent 34%),radial-gradient(circle at 88% 10%,rgba(58,194,170,.10),transparent 30%)"},
  "autumn":{label:"🍂 Осень",icon:"🍂",items:["🍂", "🍁", "🍃"],accent:"#e98735",ambient:"radial-gradient(circle at 12% 18%,rgba(233,135,53,.25),transparent 34%),radial-gradient(circle at 88% 10%,rgba(166,70,28,.10),transparent 30%)"},
  "winter":{label:"❄️ Зима",icon:"❄️",items:["❄️", "❅", "✦"],accent:"#86caff",ambient:"radial-gradient(circle at 12% 18%,rgba(134,202,255,.22),transparent 34%),radial-gradient(circle at 88% 10%,rgba(203,232,255,.09),transparent 30%)"},
  "halloween":{label:"🎃 Halloween",icon:"🎃",items:["🎃", "🦇", "✦"],accent:"#ff791f",ambient:"radial-gradient(circle at 12% 18%,rgba(255,121,31,.24),transparent 34%),radial-gradient(circle at 88% 10%,rgba(145,68,200,.12),transparent 30%)"},
  "newyear":{label:"🎄 Новый год",icon:"🎄",items:["❄️", "✨", "🎄"],accent:"#55d99a",ambient:"radial-gradient(circle at 12% 18%,rgba(85,217,154,.20),transparent 34%),radial-gradient(circle at 88% 10%,rgba(224,54,72,.09),transparent 30%)"},
  "valentine":{label:"💗 День влюблённых",icon:"💗",items:["💗", "♡", "✨"],accent:"#ff619f",ambient:"radial-gradient(circle at 12% 18%,rgba(255,97,159,.24),transparent 34%),radial-gradient(circle at 88% 10%,rgba(255,180,207,.08),transparent 30%)"},
  "anniversary":{label:"🎉 День проекта",icon:"🎉",items:["🎉", "✨", "★"],accent:"#ffd45c",ambient:"radial-gradient(circle at 12% 18%,rgba(255,212,92,.21),transparent 34%),radial-gradient(circle at 88% 10%,rgba(255,83,105,.10),transparent 30%)"},
  "community":{label:"🎮 День сообщества",icon:"🎮",items:["🎮", "✨", "◆"],accent:"#7f8fff",ambient:"radial-gradient(circle at 12% 18%,rgba(127,143,255,.23),transparent 34%),radial-gradient(circle at 88% 10%,rgba(72,221,255,.08),transparent 30%)"},
  "serverday":{label:"🎂 День сервера 78",icon:"🎂",items:["🎂", "🎉", "✨"],accent:"#ff9b4d",ambient:"radial-gradient(circle at 12% 18%,rgba(255,155,77,.23),transparent 34%),radial-gradient(circle at 88% 10%,rgba(255,95,101,.08),transparent 30%)"},
  "winterbreak":{label:"🎁 Зимние каникулы",icon:"🎁",items:["🎁", "❄️", "✨"],accent:"#73bcff",ambient:"radial-gradient(circle at 12% 18%,rgba(115,188,255,.22),transparent 34%),radial-gradient(circle at 88% 10%,rgba(220,238,255,.08),transparent 30%)"},
  "blackfriday":{label:"🛍️ Black Friday",icon:"%",items:["◆", "%", "✦"],accent:"#f0c94e",ambient:"radial-gradient(circle at 12% 18%,rgba(240,201,78,.18),transparent 34%),radial-gradient(circle at 88% 10%,rgba(255,255,255,.04),transparent 30%)"},
  "cyber":{label:"⚡ Cyber Week",icon:"⚡",items:["⚡", "◇", "✦"],accent:"#2beaff",ambient:"radial-gradient(circle at 12% 18%,rgba(43,234,255,.22),transparent 34%),radial-gradient(circle at 88% 10%,rgba(178,102,255,.11),transparent 30%)"},
  "victory":{label:"⭐ День Победы",icon:"⭐",items:["⭐", "✦", "★"],accent:"#e94a42",ambient:"radial-gradient(circle at 12% 18%,rgba(233,74,66,.22),transparent 34%),radial-gradient(circle at 88% 10%,rgba(243,192,79,.08),transparent 30%)"},
  "knowledge":{label:"🎓 День знаний",icon:"🎓",items:["🎓", "✦", "📘"],accent:"#5ea9ff",ambient:"radial-gradient(circle at 12% 18%,rgba(94,169,255,.22),transparent 34%),radial-gradient(circle at 88% 10%,rgba(242,199,92,.08),transparent 30%)"},
  "tournament":{label:"🏆 Турнир",icon:"🏆",items:["🏆", "✦", "⚡"],accent:"#ffc84d",ambient:"radial-gradient(circle at 12% 18%,rgba(255,200,77,.22),transparent 34%),radial-gradient(circle at 88% 10%,rgba(255,125,71,.07),transparent 30%)"},
  "night":{label:"🌙 Ночная тема",icon:"🌙",items:["🌙", "✦", "★"],accent:"#829cff",ambient:"radial-gradient(circle at 12% 18%,rgba(130,156,255,.21),transparent 34%),radial-gradient(circle at 88% 10%,rgba(199,210,255,.07),transparent 30%)"},
  "forbes":{label:"💎 Forbes Night",icon:"💎",items:["💎", "✦", "◇"],accent:"#d8b15f",ambient:"radial-gradient(circle at 12% 18%,rgba(216,177,95,.20),transparent 34%),radial-gradient(circle at 88% 10%,rgba(142,95,255,.10),transparent 30%)"},
  "garages":{label:"🚗 Garage Fest",icon:"🚗",items:["🚗", "✦", "⟡"],accent:"#ff6b4d",ambient:"radial-gradient(circle at 12% 18%,rgba(255,107,77,.20),transparent 34%),radial-gradient(circle at 88% 10%,rgba(255,37,87,.08),transparent 30%)"},
  "secure":{label:"🔐 Secure Lockdown",icon:"🔐",items:["🔐", "✦", "◆"],accent:"#ff475f",ambient:"radial-gradient(circle at 12% 18%,rgba(255,71,95,.20),transparent 34%),radial-gradient(circle at 88% 10%,rgba(255,255,255,.04),transparent 30%)"},
  "wealth":{label:"💰 Wealth Rush",icon:"💰",items:["💰", "✦", "★"],accent:"#f4ca64",ambient:"radial-gradient(circle at 12% 18%,rgba(244,202,100,.18),transparent 34%),radial-gradient(circle at 88% 10%,rgba(255,160,87,.08),transparent 30%)"},
};
const clean=v=>defs[v]?v:'off';
let mode='off', settings={eventMode:'off'};
function clear(){document.querySelectorAll('.site-event-layer,.site-event-ambient,.site-event-status').forEach(x=>x.remove())}
function statusBadge(d){const el=document.createElement('div');el.className='site-event-status';el.innerHTML=`<span>${d.icon}</span><b>${d.label.replace(/^\S+\s*/, '')||d.label}</b>`;document.body.appendChild(el)}
function apply(v){
  mode=clean(v); const root=document.documentElement; root.dataset.siteEvent=mode; clear();
  if(mode==='off'){root.style.removeProperty('--event-accent'); return;}
  const d=defs[mode]; root.style.setProperty('--event-accent',d.accent);
  const ambient=document.createElement('div'); ambient.className='site-event-ambient'; ambient.style.background=d.ambient; ambient.setAttribute('aria-hidden','true'); document.body.appendChild(ambient);
  if(root.dataset.safeMode==='1'){statusBadge(d);return;}
  const layer=document.createElement('div'); layer.className='site-event-layer'; layer.setAttribute('aria-hidden','true');
  const perf=root.dataset.performance||'balanced', optimized=root.dataset.deviceTier==='optimized';
  const count=perf==='low'?0:(optimized?3:(matchMedia('(max-width:720px)').matches?4:(perf==='max'?9:5)));
  for(let i=0;i<count;i++){const s=document.createElement('span');s.className='site-event-particle';s.textContent=d.items[i%d.items.length];s.style.setProperty('--x',`${5+((i*17)%90)}%`);s.style.setProperty('--size',`${12+(i%3)*4}px`);s.style.setProperty('--opacity',`${.12+(i%4)*.035}`);s.style.setProperty('--duration',`${28+(i%4)*8}s`);s.style.setProperty('--delay',`${-(i*4+2)}s`);s.style.setProperty('--drift',`${i%2?22:-22}px`);layer.appendChild(s)}
  document.body.appendChild(layer);statusBadge(d);
}
function effectiveMode(){
  const base=clean(settings?.eventMode||'off');const s=settings?.eventSchedule;
  if(!s||s.enabled!==true)return base;
  const now=Date.now(),start=Number(s.startAt||0),end=Number(s.endAt||0),scheduled=clean(s.eventMode||'off');
  if(scheduled!=='off'&&start&&end&&now>=start&&now<=end)return scheduled;
  return base;
}
function refresh(){const next=effectiveMode();if(next!==mode)apply(next)}
function localSettings(){try{const k=window.BR_KEYS?.meta;const m=k&&JSON.parse(localStorage.getItem(k)||'{}');return m?.siteSettings||{}}catch{return{}}}
function start(){settings=localSettings();apply(effectiveMode());const cfg=window.BR_FIREBASE_CONFIG;if(cfg&&window.firebase){try{if(!firebase.apps.length)firebase.initializeApp(cfg);firebase.database().ref('settings/siteSettings').on('value',s=>{settings=s.val()||{};refresh()},()=>{});}catch{}}setInterval(refresh,30000);window.addEventListener('br-safe-mode-change',refresh)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
window.BRSiteEvents={apply,get:()=>mode,defs,effectiveMode};

})();
