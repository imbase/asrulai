/* Plate detail display only. No strategy, membership or price mutations. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.PlateMembers=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const percent=n=>!finite(n)?'—':(Number(n.toFixed(2))===0?'0.00%':(n>0?'+':'')+n.toFixed(2)+'%');
const color=n=>!finite(n)||n===0?'':n>0?'pos':'neg';
const price=n=>finite(n)&&n>0?n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:4}):'—';
function ranked(rows){return (rows||[]).slice().sort((a,b)=>{
 const av=finite(a.change_percent),bv=finite(b.change_percent);
 if(av!==bv)return av?-1:1;
 return (av?b.change_percent-a.change_percent:0)||String(a.symbol).localeCompare(String(b.symbol),'en');
});}
function markup(item,data,expanded){
 const loading=!data||data.status==='pending',rows=ranked(data?.rows),shown=expanded?rows:rows.slice(0,10);
 const count=data?.total,excluded=data?.excluded_from_ranking||[],partial=!!data&&!loading&&!(data.ranking_complete??data.complete)&&count>0;
 const title=partial?(data.valid>0?'已覆盖成员股涨幅前10（待补全）':'成员股行情暂不可用'):excluded.length?'可排名成员涨幅 TOP 10':'当日领涨 TOP 10';
 const notice=loading?'正在读取全部成员股及富途行情…':data.status==='unavailable'?(data.message||'成员股行情暂不可用'):partial?`部分成员股行情暂不可用 · 有效涨幅 ${data.valid??0} / ${data.ranking_total??count}，暂无法确认完整板块 TOP 10。`:count===0?'该板块暂无成员股。':'';
 const tr=shown.map((r,i)=>`<tr><td>${finite(r.change_percent)?String(i+1).padStart(2,'0'):'—'}</td><td>${esc(r.symbol)}</td><td>${price(r.price)}</td><td class="${color(r.change_percent)}">${percent(r.change_percent)}${!finite(r.change_percent)?`<small>${esc(r.unavailable_reason||'行情缺失')}</small>`:''}</td></tr>`).join('');
 const times=data?.quote_time_min?[data.quote_time_min,data.quote_time_max].filter((x,i,a)=>i===0||x!==a[0]).join(' ～ '):'—';
 return `<header><strong>${esc(item.name)} <span class="${color(item.change_percent)}">${percent(item.change_percent)}</span>｜${expanded?'全部成员股':title}</strong><button type="button" data-members-close aria-label="关闭板块详情">关闭</button></header><p>上涨 ${esc(item.rise??'—')} · 平盘 ${esc(item.equal??'—')} · 下跌 ${esc(item.fall??'—')}${item.leader?` · 领涨股 ${esc(item.leader)}`:''}</p>${notice?`<p class="c1-members-notice" role="status">${esc(notice)}</p>`:''}${excluded.length?`<p class="c1-members-notice">不参与排名：${esc(excluded.join('、'))}（OpenD不支持OTC行情；原始成员名单保留）</p>`:''}${rows.length?`<section class="c1-members-scroll${expanded?' is-expanded':''}" tabindex="0" aria-label="板块成员股涨幅排名"><table class="c1-members-table"><thead><tr><th>排名</th><th>股票代码</th><th>最新价</th><th>当日涨幅</th></tr></thead><tbody>${tr}</tbody></table></section>`:''}${count>0?`<button type="button" data-members-toggle aria-expanded="${expanded}">${expanded?'收起，仅显示 TOP 10':`查看全部成员股（共 ${count} 只）`}</button>`:''}${!loading?`<footer class="c1-members-time">常规行情日期：${esc(data.quote_date||'无法确认')}${data.not_today?'（非今日，最近常规交易日）':''}<br>快照更新时间：${esc(times)} ET<br>交易时段：${data.session==='RTH'?'美股常规交易时段':'无法确认'} · 来源：Futu OpenD<br>日期按富途交易日历及快照时间映射；快照更新时间可能包含扩展时段更新，不代表收盘时间。${data.errors?.length?'<br>'+esc(data.errors.join('；')):''}</footer>`:''}`;
}
function controller({panel,post,port,select,wait=ms=>new Promise(r=>setTimeout(r,ms))}){
 let token=0,current=null,expanded=false,value=null;
 const cache=new Map(),pending=new Map();
 function paint(){if(!current)return;panel.innerHTML=markup(current,value,expanded);
  panel.querySelector('[data-members-close]').onclick=()=>{token++;current=null;panel.hidden=true;select(null);};
  const toggle=panel.querySelector('[data-members-toggle]');if(toggle)toggle.onclick=()=>{expanded=!expanded;paint();};
 }
 async function load(item,connection){
  const key=item.code+'|'+connection,old=cache.get(key);
  if(old&&Date.now()<old.expires_at*1000)return old;
  if(pending.has(key))return pending.get(key);
  const request=(async()=>{
   for(let i=0;i<90;i++){
    const d=await post('display/plate-members',{plate_code:item.code,port:connection});
    if(d.plate_code&&d.plate_code!==item.code)throw Error('板块响应不匹配');
    if(d.status!=='pending'&&!d.refreshing){cache.set(key,d);return d;}
    await wait(1000);
   }
   throw Error('行情请求超时，请稍后重新点击板块');
  })().finally(()=>pending.delete(key));pending.set(key,request);return request;
 }
 async function show(item){
  const id=++token;current=item;expanded=false;value=null;panel.hidden=false;select(item.code);paint();
  try{const d=await load(item,port());if(id!==token)return;value=d;paint();}
  catch(e){if(id!==token)return;value={status:'unavailable',rows:[],message:'成员股行情暂不可用：'+e.message};paint();}
 }
 function reset(){token++;current=null;expanded=false;panel.hidden=true;select(null);}
 function refresh(items){if(!current)return;const item=items.find(x=>x.code===current.code);if(!item){reset();return;}current=item;select(item.code);paint();
  // Revalidate on the existing heatmap refresh, without adding a new timer.
  const id=token;load(item,port()).then(d=>{if(id===token&&current){value=d;paint();}}).catch(()=>{});
 }
 return {show,reset,refresh};
}
return {ranked,markup,percent,controller};
});
