(function(root){'use strict';
const clone=x=>JSON.parse(JSON.stringify(x));
function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function cells(b,skip=-1){const a=Array(b.n*b.n).fill(0);for(const [x,y] of b.walls)a[y*b.n+x]=-1;b.cars.forEach((c,i)=>{if(c.out||i===skip)return;for(let k=0;k<c.len;k++)a[(c.y+(c.axis==='v'?k:0))*b.n+c.x+(c.axis==='h'?k:0)]=i+1});return a}
function canMove(b,i,d){const c=b.cars[i];if(!c||c.out||![-1,1].includes(d))return false;const x=c.x+(c.axis==='h'?d:0),y=c.y+(c.axis==='v'?d:0);if(x<0||y<0||x+(c.axis==='h'?c.len:1)>b.n||y+(c.axis==='v'?c.len:1)>b.n)return false;const a=cells(b,i);for(let k=0;k<c.len;k++)if(a[(y+(c.axis==='v'?k:0))*b.n+x+(c.axis==='h'?k:0)])return false;return true}
function canExit(b,i){const c=b.cars[i];if(!c||c.out)return false;if(b.order&&b.order.find(j=>!b.cars[j].out)!==i)return false;const a=cells(b,i);let p=c.axis==='h'?c.x:c.y;let start=c.dir===1?p+c.len:p-1;for(let k=start;k>=0&&k<b.n;k+=c.dir){const x=c.axis==='h'?k:c.x,y=c.axis==='v'?k:c.y;if(a[y*b.n+x])return false}return true}
function action(b,a){if(a.exit){if(!canExit(b,a.i))return false;b.cars[a.i].out=true;return true}if(!canMove(b,a.i,a.d))return false;const c=b.cars[a.i];c[c.axis==='h'?'x':'y']+=a.d;return true}
function key(b){return b.cars.map(c=>c.out?'x':c.axis==='h'?c.x:c.y).join(',')}
// Breadth-first search to the next exit. Removing a car never blocks a later solution.
function nextExit(board,limit=40000){const b=clone(board),q=[{b,prev:-1,a:null}],seen=new Set([key(b)]);for(let at=0;at<q.length&&at<limit;at++){const node=q[at];for(let i=0;i<b.cars.length;i++){if(canExit(node.b,i)){let path=[{i,exit:true}],p=at;while(q[p].a){path.push(q[p].a);p=q[p].prev}return path.reverse()}}for(let i=0;i<b.cars.length;i++)for(const d of [-1,1])if(canMove(node.b,i,d)){const nb=clone(node.b);action(nb,{i,d});const k=key(nb);if(!seen.has(k)){seen.add(k);q.push({b:nb,prev:at,a:{i,d}})}}}return null}
function solve(b,limit=40000){b=clone(b);const steps=[];while(b.cars.some(c=>!c.out)){const p=nextExit(b,limit);if(!p)return null;for(const a of p){action(b,a);steps.push(a)}}return steps}
function generate(seed,chapter){const r=rng(seed),n=chapter<2?6:chapter<4?7:8,b={n,walls:[],cars:[]};const target=5+chapter*2;
for(let k=0;k<Math.max(0,chapter-1);k++){const x=1+Math.floor(r()*(n-2)),y=1+Math.floor(r()*(n-2));if(!b.walls.some(w=>w[0]===x&&w[1]===y))b.walls.push([x,y])}
for(let tries=0;tries<600&&b.cars.length<target;tries++){const axis=r()<.5?'h':'v',dir=r()<.5?-1:1,len=chapter>0&&r()<.32?3:2,lane=Math.floor(r()*n),p=Math.floor(r()*(n-len+1)),c={axis,dir,len,x:axis==='h'?p:lane,y:axis==='v'?p:lane,out:false};const a=cells(b);let free=true;for(let k=0;k<len;k++)if(a[(c.y+(axis==='v'?k:0))*n+c.x+(axis==='h'?k:0)])free=false;if(!free)continue;b.cars.push(c);
for(let z=0;z<20+chapter*8;z++){const i=Math.floor(r()*b.cars.length),d=r()<.5?-1:1;action(b,{i,d})}}
return b}
const api={clone,rng,cells,canMove,canExit,action,nextExit,solve,generate};if(typeof module!=='undefined')module.exports=api;else root.ParkingEngine=api;
})(typeof self==='undefined'?globalThis:self);
