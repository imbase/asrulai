/* Independent daily spot display. Never invokes the scanner or stock providers. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.MetalsRatio=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const errors={};
const finite=n=>typeof n==='number'&&Number.isFinite(n)&&n>0;
function zone(r){return r<40?'白银相对过热':r<45?'偏低观察':r<=80?'常规区间':r<85?'偏高观察':r<100?'白银相对低估':'极端高位';}
function angle(r){return (Math.max(20,Math.min(120,r))-78)*1.8;}
function createController(card,{request=fetch,setTimer=setTimeout,clearTimer=clearTimeout,observeResize=true}={}){
 let active=false,timer=null,controller=null,generation=0,demo=false,busy=false,last=null;
 const $=s=>card.querySelector(s);
 function paint(q){
  last=q;
  const valid=finite(q.ratio)&&finite(q.gold?.price)&&finite(q.silver?.price);
  $('.gsr-number').textContent=valid?q.ratio.toFixed(1):'—';
  const needle=$('.gsr-pointer');needle.hidden=!valid;
  if(valid)needle.style.transform=`rotate(${angle(q.ratio)}deg)`;
  for(const leg of ['gold','silver'])$('[data-metal="'+leg+'"]').textContent=valid?'$'+q[leg].price.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}):'—';
  $('.gsr-state').textContent=q.simulated?'● 模拟数据 · '+zone(q.ratio):valid?(q.stale?'● 报价已过期 · ':'● 每日快照 · ')+zone(q.ratio):q.status==='loading'?'● 正在获取今日报价':q.status==='unconfigured'?'● 现货数据未配置':'● 现货报价不可用';
  $('.gsr-hint').textContent=q.out_of_range?'超出20–120量程，数字保留真实值':valid?'仅作相对估值观察，不产生交易指令':'黄金与白银须同源、同币种、同单位';
  const timestamp=q.gold?.as_of;
  $('.gsr-source').textContent=(q.provider||'Metals.Dev')+' · '+(q.simulated?'模拟样本，非真实行情':!valid?'尚无有效报价':q.stale?'过期快照':'每日快照，非实时')+' · USD/金衡盎司';
  $('.gsr-time').textContent=timestamp?'报价 '+new Date(timestamp).toLocaleString('zh-CN',{timeZone:q.day_timezone||'Asia/Shanghai',hour12:false})+' '+(q.day_timezone||'Asia/Shanghai'):'报价时间：— · 数据时区 Asia/Shanghai';
  $('.gsr-daily').textContent=q.simulated?'模拟模式不消耗API额度':q.status==='unconfigured'?'本次快照没有贵金属报价':q.error_code?(errors[q.error_code]||'错误 '+q.error_code)+(q.http_status?' · HTTP '+q.http_status:'')+(q.provider_code?' / '+q.provider_code:'')+' · 可人工验证':'本机每日发布后更新 · 公开页不连接供应商';
  if(!q.simulated&&q.api_calls_today!==undefined)$('.gsr-daily').textContent+=' · 今日调用 '+q.api_calls_today+' 次';
  card.dataset.status=q.status;card.dataset.stale=String(!!q.stale);
 }
 function stop(){active=false;generation++;if(timer!==null)clearTimer(timer);timer=null;controller?.abort();controller=null;busy=false;}
 async function refresh(poll=0){
  if(!active||busy)return;busy=true;const id=generation;controller=new AbortController();const current=controller;
  const timeout=setTimer(()=>current.abort(),8000);
  try{
   const r=await request('/api/metals/spot'+(demo?'?demo=1':''),{signal:current.signal});if(!r.ok)throw Error('HTTP '+r.status);
   const q=await r.json();if(!active||id!==generation)return;paint(q);
   // Only bounded completion checks of our own backend; never a market-price poll.
   if(q.refreshing&&poll<10)timer=setTimer(()=>{timer=null;refresh(poll+1);},700);
  }catch(e){if(active&&id===generation){if(last&&finite(last.ratio))paint({...last,stale:true,status:'stale',error_code:'local_interface_unavailable'});else paint({status:'unavailable',error_code:'local_interface_unavailable'});}}
  finally{clearTimer(timeout);if(id===generation){busy=false;controller=null;}}
 }
 function start(){if(active)return;active=true;generation++;refresh();}
 $('[data-gsr-refresh]').onclick=()=>{if(timer!==null)clearTimer(timer);timer=null;refresh();};
 $('[data-gsr-diagnose]').onclick=()=>{last=null;paint({status:'loading'});refresh();};
 $('[data-gsr-demo]').onclick=()=>{const was=active;stop();last=null;demo=!demo;paint({status:'loading'});$('[data-gsr-demo]').textContent=demo?'退出模拟':'模拟演示';$('[data-gsr-demo]').setAttribute('aria-pressed',String(demo));if(was)start();};
 let resize=null;
 if(observeResize&&typeof ResizeObserver!=='undefined'){
  resize=new ResizeObserver(()=>{const width=$('.gsr-scale-slot').getBoundingClientRect().width,scale=Math.min(1,width/470);$('.gsr-dial').style.transform=`scale(${scale})`;$('.gsr-scale-slot').style.height=`${222*scale}px`;});resize.observe($('.gsr-scale-slot'));
 }
 return {start,stop,refresh,paint,destroy(){stop();resize?.disconnect();},get active(){return active;}};
}
return {zone,angle,createController};
});
