/* Home presentation adapter: moves existing nodes, never changes market inputs. */
(() => {
 'use strict';
 const $=s=>document.querySelector(s),page=$('#view-intel');
 let metals=null;
 function metalsMarkup(){
  const ticks=[20,40,85,100,120].map(n=>`<span class="rs-tick" style="left:${n-20}%">${n}</span>`).join('');
  return `<header class="gsr-title"><h3>金银比摆钟</h3><span>XAU ÷ XAG</span><button type="button" data-gsr-refresh aria-label="读取金银比每日缓存">↻</button></header>
    <div class="ratio-scale"><div class="rs-track"><span class="rs-band" style="left:20%;width:45%"></span><i class="rs-petal" hidden></i><output class="rs-val" data-lit>—</output>${ticks}</div></div>
    <div class="gsr-status"><span class="gsr-state">● 现货数据未配置</span></div>
    <div hidden><span class="gsr-number">—</span><span class="gsr-pointer" hidden></span><span class="gsr-hint"></span><span data-metal="gold"></span><span data-metal="silver"></span><span class="gsr-source"></span><span class="gsr-daily"></span></div>
    <span class="gsr-time"></span><div class="gsr-tools"><button type="button" data-gsr-diagnose>验证API</button><button type="button" data-gsr-demo aria-pressed="false">模拟演示</button></div>`;

 }
 function syncMetals(){if(!metals)return;if(document.body.classList.contains('c1-market-view')&&!document.hidden)metals.start();else metals.stop();}
 function enhanceMarket(){
  const layout=$('#c1MarketBoard .c1-market-layout');if(!layout||layout.dataset.glassReady)return;
  layout.dataset.glassReady='1';
  const quoteNodes=[...layout.querySelectorAll('[data-market-quote]')];
  const market=document.createElement('section');market.className='home-market-card plate';market.setAttribute('aria-label','市场概况');
  const title=$('#c1OverviewTitle');
  if(title) market.append(title);
  for(const row of quoteNodes) for(const el of row.querySelectorAll('.c1-quote-price,b')) el.dataset.lit='';
  const sub=document.createElement('p');sub.className='home-market-sub';sub.textContent='主要指数与防御资产';market.append(sub);
  const rows=document.createElement('div');rows.className='home-quote-rows';quoteNodes.forEach(n=>rows.append(n));market.append(rows);
  const note=document.createElement('small');note.className='home-market-time';note.textContent='Yahoo · 常规时段 · 各标的时间见报价';market.append(note);
  layout.querySelectorAll('.c1-quote-column').forEach(n=>n.remove());layout.prepend(market);
  const heat=layout.querySelector('.c1-heat-panel');heat.classList.add('plate');
  const count=document.createElement('p');count.className='home-heat-count';count.textContent='完整板块集合 / 等面积展示';heat.append(count);
  const card=document.createElement('section');card.className='home-metals-card plate ratio';card.setAttribute('aria-label','金银比摆钟');card.innerHTML=metalsMarkup();layout.append(card);
  const notes=$('#c1MarketBoard .c1-market-foot');if(notes)$('#homeSourceNotes').append(notes);
  metals?.destroy();
  metals=MetalsRatio.createController(card,{observeResize:false});
  const value=card.querySelector('.gsr-number'), readout=card.querySelector('.rs-val'), petal=card.querySelector('.rs-petal');
  const update=()=>{
   const number=Number(card.dataset.ratio ?? value.textContent);
   const valid=Number.isFinite(number);
   const position=Math.max(0,Math.min(100,number-20));
   petal.hidden=!valid;
   petal.style.left=valid?position+'%':'';
   readout.style.left=valid?`clamp(14px, ${position}%, 100% - 14px)`:'50%';
   readout.textContent=value.textContent;
  };
  new MutationObserver(update).observe(value,{childList:true,characterData:true,subtree:true});
  update();syncMetals();
 }
 function updateHeatCount(){
  const count=$('.home-heat-count'),grid=$('#c1HeatGrid');
  if(!count||!grid)return;
  const cells=[...grid.querySelectorAll('button')];
  const text=`${cells.length||'—'} 个板块 / 等面积展示 · 滚动查看全部`;
  if(count.textContent!==text)count.textContent=text;
  let leader=null,top=0;
  for(const cell of cells){
   const change=cell.querySelector('b');
   change.dataset.lit='';
   const value=parseFloat(change.textContent);
   cell.dataset.tone=value<0?'down':value>=2?'t1':value>=.7?'t2':'t3';
   if(value>top){top=value;leader=cell;}
  }
  for(const cell of cells)cell.classList.toggle('flower-tile',cell===leader);
 }
 const marketObserver=new MutationObserver(()=>{enhanceMarket();updateHeatCount();});marketObserver.observe($('#c1MarketBoard'),{childList:true,subtree:true});enhanceMarket();
 document.querySelectorAll('[data-home-go]').forEach(b=>b.onclick=()=>document.querySelector(`.nav-item[data-view="${b.dataset.homeGo}"]`)?.click());
 $('#homeQuickScan').onclick=()=>$('#quickScanBtn').click();
 function clock(){const text=new Date().toLocaleString('zh-CN',{timeZone:'America/New_York',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});$('#homeClock').textContent='纽约时间 '+text;}
 clock();setInterval(()=>{if(!document.hidden&&page.classList.contains('active'))clock();},15000);
 new MutationObserver(()=>{clock();syncMetals();if(typeof window.radarRefreshObservations==='function')window.radarRefreshObservations();}).observe(document.body,{attributes:true,attributeFilter:['class']});
 const pool=$('#intelStrategyStocks'), tabs=document.createElement('div');
 tabs.className='cine-watch-tabs';
 tabs.setAttribute('role','group');
 tabs.setAttribute('aria-label','固定观察池');
 const watchLayout=document.createElement('div');
 watchLayout.className='briefing-watch plate';
 pool.before(watchLayout);
 watchLayout.append(tabs,pool);
 let selected='SLV';
 function watch(){
  for(const card of pool.querySelectorAll(':scope > .c1-stock-card')){
   const name=card.querySelector('strong')?.textContent;
   if(!name)continue;
   let button=[...tabs.children].find(node=>node.dataset.symbol===name);
   if(!button){
    button=document.createElement('button');
    button.type='button';
    button.className='wl-row';
    button.dataset.symbol=name;
    const label=document.createElement('span'), change=document.createElement('b');
    label.className='wl-name';label.textContent=name;
    change.className='wl-pct';change.dataset.lit='';
    button.append(label,change);
    button.onclick=()=>{selected=name;watch();};
    tabs.append(button);
   }
   const change=card.querySelector('.c1-watch-change'), badge=button.querySelector('.wl-pct');
   if(badge.textContent!==change.textContent)badge.textContent=change.textContent;
   badge.classList.toggle('up',change.classList.contains('pos'));
   badge.classList.toggle('down',change.classList.contains('neg'));
   button.setAttribute('aria-pressed',String(name===selected));
   card.classList.toggle('cine-selected',name===selected);
   card.querySelector('.c1-watch-price').dataset.lit='';
  }
 }
 new MutationObserver(watch).observe(pool,{childList:true,characterData:true,subtree:true});
 watch();
 $('#intelPolicy').classList.add('plate');
 page.querySelector('.briefing-content').append(page.querySelector('.home-footer'));
 document.addEventListener('visibilitychange',syncMetals);
 window.addEventListener('pagehide',()=>{metals?.destroy();marketObserver.disconnect();});
})();
