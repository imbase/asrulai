/* Home presentation adapter: moves existing nodes, never changes market inputs. */
(() => {
 'use strict';
 const $=s=>document.querySelector(s),page=$('#view-intel');
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const pct=n=>typeof n==='number'&&Number.isFinite(n)?(n>0?'+':'')+(n*100).toFixed(2)+'%':'—';
 let metals=null;
 function metalsMarkup(){
  const arcs=['100-120','85-100','80-85','45-80','40-45','20-40'].map(x=>`<img class="gsr-arc" src="assets/gsr/${x}.svg" alt="" width="470" height="222">`).join('');
  const ticks=[[20,40,187],[40,75.9048,76.4964],[45,129.7122,88.7122],[80,286.0952,8.2014],[85,291.1047,63.1501],[100,377.5952,76.4964],[120,413.5,187]].map(([n,x,y])=>`<span class="gsr-tick gsr-tick-${n}">${n}</span>`).join('');
  return `<header class="gsr-title"><h3>金银比摆钟</h3><span>XAU ÷ XAG</span><button type="button" data-gsr-refresh aria-label="读取金银比每日缓存" title="读取公开快照；公开页不连接供应商">↻</button></header><div class="gsr-status"><span class="gsr-state">● 现货数据未配置</span><small class="gsr-hint">同源现货 · 每日快照</small></div><div class="gsr-scale-slot"><div class="gsr-dial" role="img" aria-label="金银比风险区间，20至120">${arcs}${ticks}<div class="gsr-pointer" hidden><img src="assets/gsr/pointer.svg" width="40.2274" height="133.337" alt="银灰色指针"></div><img class="gsr-pivot-outer" src="assets/gsr/pivot-outer.svg" width="18" height="18" alt=""><img class="gsr-pivot-inner" src="assets/gsr/pivot-inner.svg" width="8" height="8" alt=""><span class="gsr-number">—</span></div></div><div class="gsr-endpoints"><span>白银相对偏贵</span><span>白银相对偏便宜</span></div><div class="gsr-prices"><div><small>黄金 XAU / USD/金衡盎司</small><strong data-metal="gold">—</strong></div><div><small>白银 XAG / USD/金衡盎司</small><strong data-metal="silver">—</strong></div></div><p class="gsr-thresholds">＜40 过热 · ≥85 相对低估 · ≥100 极端高位</p><footer class="gsr-foot"><span class="gsr-source">Metals.Dev · 每日现货快照</span><span class="gsr-time">报价时间：— · 数据时区 Asia/Shanghai</span><span class="gsr-daily">按需获取 · 上海自然日最多请求一次</span><button type="button" data-gsr-diagnose title="重新读取本机已发布的公开快照">刷新快照</button><button type="button" data-gsr-demo aria-pressed="false">模拟演示</button></footer>`;
 }
 function syncMetals(){if(!metals)return;if(document.body.classList.contains('c1-market-view')&&!document.hidden)metals.start();else metals.stop();}
 function enhanceMarket(){
  const layout=$('#c1MarketBoard .c1-market-layout');if(!layout||layout.dataset.glassReady)return;
  layout.dataset.glassReady='1';
  const quoteNodes=[...layout.querySelectorAll('[data-market-quote]')];
  const market=document.createElement('section');market.className='home-market-card home-glass';market.setAttribute('aria-label','市场概况');
  market.append($('#c1OverviewTitle'));
  const sub=document.createElement('p');sub.className='home-market-sub';sub.textContent='主要指数与防御资产';market.append(sub);
  const rows=document.createElement('div');rows.className='home-quote-rows';quoteNodes.forEach(n=>rows.append(n));market.append(rows);
  const note=document.createElement('small');note.className='home-market-time';note.textContent='Yahoo · 常规时段 · 各标的时间见报价';market.append(note);
  layout.querySelectorAll('.c1-quote-column').forEach(n=>n.remove());layout.prepend(market);
  const heat=layout.querySelector('.c1-heat-panel');heat.classList.add('home-glass');
  const count=document.createElement('p');count.className='home-heat-count';count.textContent='完整板块集合 / 等面积展示';heat.append(count);
  const card=document.createElement('section');card.className='home-metals-card home-glass';card.setAttribute('aria-label','金银比摆钟');card.innerHTML=metalsMarkup();layout.append(card);
  const notes=$('#c1MarketBoard .c1-market-foot');if(notes)$('#homeSourceNotes').append(notes);
  metals=MetalsRatio.createController(card);syncMetals();
 }
 function updateHeatCount(){const count=$('.home-heat-count');if(!count)return;const n=$('#c1HeatGrid').querySelectorAll('button').length,text=`${n||'—'} 个板块 / 等面积展示 · 滚动查看全部`;if(count.textContent!==text)count.textContent=text;}
 const marketObserver=new MutationObserver(()=>{enhanceMarket();updateHeatCount();});marketObserver.observe($('#c1MarketBoard'),{childList:true,subtree:true});enhanceMarket();
 document.querySelectorAll('[data-home-go]').forEach(b=>b.onclick=()=>document.querySelector(`.nav-item[data-view="${b.dataset.homeGo}"]`)?.click());
 $('#homeQuickScan').onclick=()=>$('#quickScanBtn').click();
 function clock(){const text=new Date().toLocaleString('zh-CN',{timeZone:'America/New_York',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});$('#homeClock').textContent='纽约时间 '+text;}
 clock();new MutationObserver(()=>{clock();syncMetals();if(typeof window.radarRefreshObservations==='function')window.radarRefreshObservations();}).observe(document.body,{attributes:true,attributeFilter:['class']});
 document.addEventListener('visibilitychange',syncMetals);
 window.addEventListener('pagehide',()=>{metals?.destroy();marketObserver.disconnect();if(window.candidateObserver)window.candidateObserver.disconnect();});
})();
