(()=>{'use strict';
const root=document.documentElement;
const conn=navigator.connection||navigator.mozConnection||navigator.webkitConnection||null;
const mobileMQ=window.matchMedia?.('(max-width: 820px), (pointer: coarse)');
function optimized(){return !!(mobileMQ?.matches||conn?.saveData||(Number(navigator.deviceMemory||8)<=4));}
function applyDeviceMode(){root.dataset.brDeviceOptimized=optimized()?'1':'0';}
applyDeviceMode();
try{mobileMQ?.addEventListener?.('change',applyDeviceMode);conn?.addEventListener?.('change',applyDeviceMode);}catch{}

const criticalSelector='.hero,.topbar,.community-top,.events-hero,.login-card,.gate-card,.profile-hero,.podium';
function tuneImage(img){if(!(img instanceof HTMLImageElement))return;if(!img.hasAttribute('decoding'))img.decoding='async';if(!img.hasAttribute('loading')&&!img.closest(criticalSelector))img.loading='lazy';if(!img.hasAttribute('fetchpriority')&&!img.closest(criticalSelector))img.setAttribute('fetchpriority','low');}
function tuneTree(node){if(!(node instanceof Element))return;if(node.matches?.('img'))tuneImage(node);node.querySelectorAll?.('img').forEach(tuneImage);}
function start(){document.querySelectorAll('img').forEach(tuneImage);const mo=new MutationObserver(list=>{for(const m of list)for(const n of m.addedNodes)tuneTree(n)});mo.observe(document.body,{childList:true,subtree:true});
  document.addEventListener('visibilitychange',()=>root.toggleAttribute('data-br-hidden',document.hidden),{passive:true});
  root.toggleAttribute('data-br-hidden',document.hidden);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
