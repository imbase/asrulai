/* Display only. Never writes bars, reports, settings or strategy inputs. */
(() => {
  'use strict';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pct = n => Number.isFinite(n) ? `${n>=0?'+':''}${(n*100).toFixed(2)}%` : '—';
  const delay = ms => new Promise(r=>setTimeout(r,ms));
  async function post(path,body) {
    const r=await fetch('/api/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(path==='display/heatmap'||path==='yahoo/chart'?60000:20000)});
    const d=await r.json(); if(!r.ok || d.ok===false) throw new Error(d.detail || d.message || '接口未返回资料'); return d;
  }
  // Share the market panel's in-flight/recent quote without downloading daily history.
  const recentQuotes = new Map();
  function watchQuote(symbol){
    const saved=recentQuotes.get(symbol);
    if(saved && Date.now()-saved.time<60000)return saved.promise;
    const promise=post('yahoo/chart',{symbol,range:'1d'});
    recentQuotes.set(symbol,{time:Date.now(),promise});return promise;
  }
  async function paintWatchQuote(card,symbol){
    try{
      const d=await watchQuote(symbol),m=d.chart?.result?.[0]?.meta;
      if(!card.isConnected)return;
      const price=Number(m?.regularMarketPrice),previous=Number(m?.chartPreviousClose??m?.previousClose);
      const change=Number.isFinite(m?.savedChange) ? m.savedChange : Number.isFinite(price) && Number.isFinite(previous) && price>0 && previous>0?price/previous-1:NaN;
      card.querySelector('.c1-watch-price').textContent=Number.isFinite(price)&&price>0?price.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:4}):'—';
      const node=card.querySelector('.c1-watch-change');node.textContent=pct(change);node.className='c1-watch-change'+(Number.isFinite(change)&&change!==0?(change>0?' pos':' neg'):'');
      const timeText=m?.regularMarketTime>0
        ?'Yahoo 常规时段 · '+new Date(m.regularMarketTime*1000).toLocaleString('zh-CN',{timeZone:'America/New_York'})+' 美东 · 可能延迟'
        :m?.quoteDate?m.quoteDate+' 日 K 收盘 · 公开快照':'公开快照 · 报价时间未提供';
      card.querySelector('.c1-watch-time').textContent=timeText+(m?.dataIssue?' · '+m.dataIssue:'');
    }catch{if(card.isConnected)card.querySelector('.c1-watch-time').textContent='暂无数据';}
  }
  const chartObservers = new WeakMap();
  function plateText(value){
    if(value.status==='unsupported')return `所属资料：${value.message}`;
    const names=key=>(value[key]||[]).map(x=>x.name).filter(Boolean).join('、');
    let text=`行业：${names('industries')||'富途未提供'} · 概念：${names('concepts')||'富途未提供'}`;
    if(names('untyped'))text+=' · 其他所属板块：'+names('untyped');
    if(value.updated_at)text+=' · 资料更新 '+new Date(value.updated_at*1000).toLocaleString('zh-CN');
    return text+' · '+(value.message||'来源：Futu OpenD');
  }
  function plate(symbol,node){
    node.textContent='正在读取OpenD所属资料…';
    let lastText='';
    const update=async()=>{
      if(!node.isConnected)return;
      try{
        const value=await post('display/plates',{symbol});if(!node.isConnected)return;
        lastText=plateText(value);node.textContent=lastText;
        if(value.refreshing||value.status==='pending')setTimeout(update,3000);
        else if(['unavailable','stale'].includes(value.status))setTimeout(update,Math.max(5000,Math.min(300000,((value.next_check_at||Date.now()/1000+60)*1000-Date.now()+200))));
      }catch(e){if(node.isConnected){node.textContent=(lastText?lastText+' · ':'')+'资料服务请求失败，稍后重试：'+e.message;setTimeout(update,60000);}}
    };update();
  }
  function cards(target,items,draw) {
    const old = chartObservers.get(target); old?.observer.disconnect(); old?.resize.disconnect();
    const resize=new ResizeObserver(entries=>{for(const {target:c} of entries){if(c._c1Bars && c.getBoundingClientRect().width)draw(c,c._c1Bars);}});
    const observer=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){observer.unobserve(e.target);load(e.target);}}, {rootMargin:'160px'});
    chartObservers.set(target,{observer,resize});
    async function load(card){
      const symbol=card.dataset.c1Symbol, canvas=card.querySelector('canvas');
      const fixedWatch=Boolean(card.closest('.c1-bottom-watch'));
      if(fixedWatch)paintWatchQuote(card,symbol);
      else plate(symbol,card.querySelector('.c1-sector'));
      try{
        const r=await RadarDB.get('bars',symbol);if(!card.isConnected)return;
        if(!r?.bars?.length){card.querySelector('.c1-local-date').textContent='暂无数据';return;}
        canvas._c1Bars=r.bars;draw(canvas,r.bars);resize.observe(canvas);
        ChartChangeRates.bind(canvas,r.bars,symbol,document.querySelector("#futuPort")?.value);
        const dates=r.bars.map(x=>String(x.d||x.t||'')).sort();
        card.querySelector('.c1-local-date').textContent=`本地 ${r.bars.length} 根 · 截至 ${dates.at(-1)?.slice(0,10)||'未知'} · 滚轮缩放 / 拖动平移`;
        canvas.addEventListener('wheel',e=>{if(!canvas._inlineGeometry)return;e.preventDefault();const n=r.bars.length,v=canvas._inlineView;v.visibleCount=Math.min(n,Math.max(20,Math.round(v.visibleCount*(e.deltaY>0?1.15:0.87))));draw(canvas,r.bars);},{passive:false});
        let drag=null;
        canvas.addEventListener('pointerdown',e=>{drag={x:e.clientX,offset:canvas._inlineView.offset};canvas.setPointerCapture(e.pointerId);});
        canvas.addEventListener('pointermove',e=>{const g=canvas._inlineGeometry;if(!g)return;if(drag){canvas._inlineView.offset=drag.offset+Math.round((e.clientX-drag.x)/g.pitch);}else{const b=canvas.getBoundingClientRect();canvas._inlineHover={index:Math.max(0,Math.min(g.all.length-1,Math.floor((e.clientX-b.left-g.left)/g.pitch))),y:e.clientY-b.top};}draw(canvas,r.bars);});
        if(canvas.closest('#quadCharts, #intelStrategyStocks'))canvas.addEventListener('pointermove',e=>{
          const g=canvas._inlineGeometry;if(!g)return;
          const rect=canvas.getBoundingClientRect(),px=e.clientX-rect.left,py=e.clientY-rect.top;
          const hits=g.gaps.filter(gap=>{const first=Math.max(0,gap.i),last=Math.min(g.all.length-1,gap.fill<0?g.all.length-1:gap.fill);return first<=last&&px>=g.x(first)-g.pitch/2&&px<=g.x(last)+g.pitch/2&&py>=g.y(gap.hi)&&py<=g.y(gap.lo);});
          canvas.title=hits.map(gap=>`${gap.up?'向上':'向下'}跳空 · ${gap.lo.toFixed(2)}–${gap.hi.toFixed(2)} · ${gap.fill<0?'未回补':'已回补'}`).join('\n');
        });
        canvas.addEventListener('pointerup',()=>{drag=null;});canvas.addEventListener('pointercancel',()=>{drag=null;});
        canvas.addEventListener('pointerleave',()=>{canvas._inlineHover=null;draw(canvas,r.bars);});
        card.querySelectorAll('[data-c1-window]').forEach(b=>b.onclick=()=>{canvas._inlineView={visibleCount:b.dataset.c1Window==='all'?r.bars.length:Math.min(250,r.bars.length),offset:0};draw(canvas,r.bars);});
      }catch{card.querySelector('.c1-local-date').textContent=card.closest('.c1-bottom-watch')?'本地日线读取失败；观察池成员保留':'本地日线读取失败；已有扫描结果保留';}
    }
    target.querySelectorAll('.c1-stock-card').forEach((card,i)=>{
      card.dataset.c1Symbol=items[i].symbol;
      const box=document.createElement('section');box.className='inline-futu-chart c1-observation-chart';
      box.innerHTML='<header><span class="inline-ma-legend">MA5 · MA10 · MA20 · MA30</span><button data-c1-window="year">近250日</button><button data-c1-window="all">全部</button></header><canvas class="c1-observation-canvas" aria-label="本地日线图"></canvas><small class="c1-local-date">正在读取本地日线…</small>';
      card.querySelector('.c1-strategy').after(box);observer.observe(card);
    });
  }
  let marketStarted=false, heatKind='INDUSTRY', heatBusy=false, quoteBusy=false, heatGeneration=0;
  let heatItems=[], heatValue=null;
  let memberDetails=null, selectedPlate=null;
  function selectPlate(code){selectedPlate=code;document.querySelectorAll("#c1HeatGrid [data-heat-index]").forEach(b=>b.setAttribute("aria-current",String(heatItems[Number(b.dataset.heatIndex)]?.code===code)));}
  const percent=n=>Number.isFinite(n)?`${n>=0?'+':''}${n.toFixed(2)}%`:'—';
  function heatClass(n){return !Number.isFinite(n)||n===0?'c1-heat-flat':`c1-heat-${n>0?'up':'down'}-${Math.max(1,Math.min(20,Math.ceil(Math.abs(n)*4)))}`;}
  function paintHeat(value){
    heatValue=value;heatItems=value.items||[];
    const grid=document.querySelector('#c1HeatGrid'),status=document.querySelector('#c1HeatStatus');
    if(!grid)return;
    const fetched=value.fetched_at?new Date(value.fetched_at*1000).toLocaleString('zh-CN'):'';
    status.textContent=heatItems.length?`${heatItems.length}个板块 · ${value.status==='stale'?'缓存 · ':''}同步 ${fetched}${value.message?' · '+value.message:''}`:(value.message||'正在同步富途板块…');
    grid.innerHTML=heatItems.length?heatItems.map((x,i)=>{
      const n=x.change_percent,detail=`${x.name} ${percent(n)}\n上涨 ${x.rise??'—'} · 平盘 ${x.equal??'—'} · 下跌 ${x.fall??'—'}\n领涨股 ${x.leader||'暂无'}\n${value.date_note||''}`;
      return `<button type="button" class="c1-heat-cell ${heatClass(n)}" data-heat-index="${i}" title="${esc(detail)}"><span>${esc(x.name)}</span><b>${percent(n)}</b></button>`;
    }).join(''):`<p class="c1-heat-empty">${esc(value.message||'正在读取 OpenD 热力图；其他模块可正常使用。')}</p>`;
    grid.querySelectorAll('button').forEach(b=>b.onclick=()=>showMembers(heatItems[Number(b.dataset.heatIndex)]));
    selectPlate(selectedPlate);memberDetails?.refresh(heatItems);
  }
  function showMembers(item){
    if(!memberDetails)memberDetails=PlateMembers.controller({panel:document.querySelector('#c1HeatDetail'),post,port:()=>document.querySelector('#futuPort')?.value||11111,select:selectPlate});
    return memberDetails.show(item);
  }
  async function refreshHeat(){
    if(heatBusy)return;heatBusy=true;
    const generation=heatGeneration,kind=heatKind;
    try{
      for(let attempt=0;attempt<20;attempt++){
        const d=await post('display/heatmap',{kind});if(generation!==heatGeneration)return;
        paintHeat(d);
        if(!d.refreshing && d.status!=='pending')break;
        await delay(3000);
        if(document.hidden || !document.body.classList.contains('c1-market-view'))break;
      }
    }catch(e){if(generation===heatGeneration)paintHeat({...heatValue,status:'stale',message:'富途热力图暂不可用：'+e.message});}
    finally{heatBusy=false;if(generation!==heatGeneration)refreshHeat();}
  }
  const quoteSymbols=[['^DJI','道琼斯指数'],['QQQ','QQQ'],['VGT','VGT'],['XLP','XLP'],['SCHD','SCHD']];
  async function refreshQuotes(){
    if(quoteBusy)return;quoteBusy=true;
    try{await Promise.allSettled(quoteSymbols.map(async([symbol])=>{
      const node=document.querySelector(`[data-market-quote="${symbol}"]`);if(!node)return;
      try{
        const promise=post('yahoo/chart',{symbol,range:'1d'});
        recentQuotes.set(symbol,{time:Date.now(),promise});
        const d=await promise;
        let m=d.chart?.result?.[0]?.meta;
        if(symbol==='^DJI'){
          const label=node.querySelector('span');
          label.textContent='道琼斯指数';
          if(!(Number(m?.regularMarketPrice)>0)){
            const fallback=await post('yahoo/chart',{symbol:'DIA',range:'1d'});
            const saved=fallback.chart?.result?.[0]?.meta;
            if(Number(saved?.regularMarketPrice)>0){
              m=saved;
              label.textContent='DIA（道指 ETF）';
            }
          }
        }
        const prev=Number(m?.chartPreviousClose??m?.previousClose),price=Number(m?.regularMarketPrice);
        const change=Number.isFinite(m?.savedChange) ? m.savedChange : price>0&&prev>0?price/prev-1:NaN;
        if(!(price>0))throw new Error(m?.dataIssue||'报价字段不完整');
        node.querySelector('.c1-quote-price').textContent=price.toLocaleString('en-US',{maximumFractionDigits:2,minimumFractionDigits:2});
        node.querySelector('b').textContent=pct(change);
        node.querySelector('b').className=Number.isFinite(change)&&change!==0?(change>0?'pos':'neg'):'';
        node.querySelector('small').textContent=m.regularMarketTime>0
          ?new Date(m.regularMarketTime*1000).toLocaleString('zh-CN',{timeZone:'America/New_York',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})+' 美东'
          :m.quoteDate?m.quoteDate+' 日 K 收盘':'公开快照 · 时间未提供';
        node.title=m.dataIssue||(m.regularMarketTime>0
          ?'Yahoo 最新常规时段报价，可能延迟；此时间为报价时间'
          :'公开快照中的已保存报价；缺少的时间或前收价不作猜测');
      }catch(e){node.querySelector('small').textContent='暂无数据';node.title=e.message;}
    }));}finally{quoteBusy=false;}
  }
  function market(){
    if(marketStarted)return;marketStarted=true;
    const board=document.querySelector('#c1MarketBoard');if(!board)return;
    const quoteMarkup=xs=>xs.map(([s,n])=>`<div class="c1-quote-item" data-market-quote="${s}"><span>${n}</span><div class="c1-quote-price">—</div><b>—</b><small>读取报价…</small></div>`).join('');
    board.innerHTML=`<div class="c1-market-layout"><div class="c1-quote-column">${quoteMarkup(quoteSymbols.slice(0,2))}</div><div class="c1-quote-column">${quoteMarkup(quoteSymbols.slice(2))}</div><section class="c1-heat-panel" aria-label="富途板块热力图"><header><strong>板块热力图</strong><div><button type="button" data-heat-kind="INDUSTRY" aria-pressed="true">行业</button><button type="button" data-heat-kind="CONCEPT" aria-pressed="false">概念</button><button type="button" id="c1HeatRefresh">刷新</button></div></header><div id="c1HeatGrid" class="c1-heat-grid"></div><small id="c1HeatStatus" role="status">正在同步…</small><small class="c1-heat-note">等面积 · 按涨跌幅排列 · 绿涨红跌 · 滚动查看全部 · 点击查看成分</small></section></div><div class="c1-market-foot">左侧：Yahoo 常规时段报价，可能延迟。右侧：Futu OpenD 最新返回；接口未提供交易日期，同步时间不代表交易日期。</div><aside id="c1HeatDetail" hidden></aside>`;
    board.querySelectorAll('[data-heat-kind]').forEach(b=>b.onclick=()=>{if(heatKind===b.dataset.heatKind)return;heatKind=b.dataset.heatKind;heatGeneration++;heatValue=null;heatItems=[];memberDetails?.reset();document.querySelector('#c1HeatDetail').hidden=true;board.querySelectorAll('[data-heat-kind]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));paintHeat({items:[]});refreshHeat();});
    document.querySelector('#c1HeatRefresh').onclick=()=>{refreshHeat();refreshQuotes();};
    refreshHeat();refreshQuotes();
    setInterval(()=>{if(!document.hidden&&document.body.classList.contains('c1-market-view')){refreshHeat();refreshQuotes();}},60000);
  }
  window.C1Display={cards,market,plateText};
})();
