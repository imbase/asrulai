/* Display metadata only. No price writes, strategy inputs, polling or hover requests. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.ChartChangeRates=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const cache=new Map();
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const date=b=>String(b?.d||b?.t||'').slice(0,10);
const positive=n=>finite(n)&&n>0;
const same=(a,b)=>positive(a)&&positive(b)&&Math.abs(a-b)<=Math.max(.0051,Math.abs(b)*1e-6);
function match(bar,previous,rows){
 if(!bar||!previous||date(previous)>=date(bar))return null;
 const row=rows.get(date(bar));if(!row||!finite(row.change_rate))return null;
 if(!['o','h','l','c'].every(k=>same(bar[k],row[k])))return null;
 const prior=rows.get(date(previous));
 if(!prior||![previous.c,prior.c].every(positive)||!same(previous.c,prior.c))return null;
 const earlier=[...rows.keys()].filter(d=>d<date(bar)).sort().at(-1);
 if(earlier!==date(previous))return null; // Missing local trading session must not masquerade as previous close.
 if(positive(row.last_close)&&!same(row.last_close,previous.c))return null;
 return row.change_rate; // OpenD percentage points, never multiplied by 100.
}
function calculated(bar,previous){
 if(!bar||!previous||!date(bar)||!date(previous)||date(previous)>=date(bar)||!positive(bar.c)||!positive(previous.c))return null;
 // Only adjacent records supplied by the existing chart, with the same price basis.
 for(const key of ['dataSource','adjustment','adjusted']){
  if(bar[key]!=null&&previous[key]!=null&&bar[key]!==previous[key])return null;
 }
 const rate=(bar.c/previous.c-1)*100;
 return finite(rate)?rate:null;
}
function get(symbol,bar,previous){const direct=match(bar,previous,cache.get(String(symbol||'').toUpperCase())?.rows||new Map());return finite(direct)?direct:calculated(bar,previous);} 
function format(rate){if(!finite(rate))return '--';const s=rate.toFixed(2);return Number(s)===0?'0.00%':(rate>0?'+':'')+s+'%';}
function prepare(symbol,bars,port){return Promise.resolve();}
function bind(canvas,bars,symbol,port){
 if(canvas._changeRateBound)return;canvas._changeRateBound=true;
 const tooltip=document.createElement('div');tooltip.className='inline-chart-tooltip';tooltip.hidden=true;canvas.parentElement.append(tooltip);
 let hovered=null;
 const paint=()=>{if(!hovered)return;const g=canvas._inlineGeometry;if(!g)return;const b=g.all[hovered.index];if(!b)return;
  const all=canvas._inlineDerived?.yearBars||[],i=(g.start||0)+hovered.index,previous=i>0?all[i-1]:canvas._inlineDerived?.priorBar;
  const rate=get(symbol,b,previous);tooltip.textContent='';const value=document.createElement('span');value.className=finite(rate)&&rate!==0?(rate>0?'pos':'neg'):'';value.textContent='当日涨跌幅 '+format(rate);tooltip.append(value);tooltip.hidden=false;
  tooltip.style.left=Math.max(8,Math.min(hovered.width-190,hovered.x+12))+'px';tooltip.style.top=Math.max(8,Math.min(hovered.height-42,hovered.y+12))+'px';
 };
 canvas.addEventListener('pointermove',e=>{const g=canvas._inlineGeometry;if(!g||e.buttons)return;const rect=canvas.getBoundingClientRect();hovered={index:Math.max(0,Math.min(g.all.length-1,Math.floor((e.clientX-rect.left-g.left)/g.pitch))),x:e.clientX-rect.left,y:e.clientY-rect.top,width:rect.width,height:rect.height};paint();});
 const hide=()=>{tooltip.hidden=true;hovered=null;};canvas.addEventListener('pointerleave',hide);canvas.addEventListener('pointerdown',hide);canvas.addEventListener('wheel',hide,{passive:true});
 prepare(symbol,bars,port).then(paint);
}
return {prepare,get,format,bind,match,calculated};
});
