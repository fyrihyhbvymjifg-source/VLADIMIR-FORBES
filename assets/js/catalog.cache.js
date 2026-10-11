(()=>{'use strict';
const config=window.BR_FIREBASE_CONFIG;if(!config?.databaseURL)return;
const prefix='br-public-catalog-v1:'+config.databaseURL+':',maxAge=7*24*60*60*1000;
const types=[['cars','BR_CARS'],['property','BR_PROPERTY'],['pass','BR_PASS_HISTORY']].filter(([,key])=>Array.isArray(window[key]));
window.BRCatalogCache={write(type,rows){try{window.localStorage.setItem(prefix+type,JSON.stringify({time:Date.now(),rows}));}catch{}}};
for(const [type] of types){try{const saved=JSON.parse(window.localStorage.getItem(prefix+type)||'null');if(!saved||!Array.isArray(saved.rows)||Date.now()-saved.time>maxAge)continue;window.dispatchEvent(new CustomEvent('br-catalog-'+type,{detail:saved.rows}));}catch{}}
})();
