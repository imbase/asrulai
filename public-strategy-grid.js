/* Presentation only: consumes existing filtered results; favorites use a dedicated meta key. */
(() => {
  'use strict';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pct=n=>Number.isFinite(n)?`${n>=0?'+':''}${(n*100).toFixed(2)}%`:'—';
  let page=0,pool=false,favorites=[],loaded=false,loading=false,busy=false,lastKey='',context;
  const key='strategyUserFavoritesV1';
  // Favorites always use the durable local API. Never fall back to an empty browser DB.
  const prefix='userFavoriteV2:';
  const normalize=s=>String(s||'').trim().toUpperCase().replace(/^US\./,'');
  async function store(op,extra={}){
    let rows=[];try{rows=JSON.parse(localStorage.getItem('asrulai.publicFavorites')||'[]');}catch(_){}
    if(op==='all')return rows;
    if(op==='put'){
      for(const record of extra.values||[]){const i=rows.findIndex(x=>x.key===record.key);if(i>=0)rows[i]=record;else rows.push(record);}
      localStorage.setItem('asrulai.publicFavorites',JSON.stringify(rows));return (extra.values||[]).length;
    }
    throw Error('公开页面不支持该存储操作');
  }
  async function readFavorites(){
    const rows=await store('all');if(!Array.isArray(rows))throw Error('自选数据无效');
    const old=rows.find(r=>r.key===key),items=old?.items||[];
    if(!Array.isArray(items))throw Error('旧自选数据无效');
    const map=new Map(items.map(r=>[normalize(r.symbol),{...r,symbol:normalize(r.symbol)}]));
    for(const r of rows.filter(r=>typeof r.key==='string'&&r.key.startsWith(prefix))){
      const symbol=normalize(r.symbol);if(!symbol||r.key!==prefix+symbol||typeof r.deleted!=='boolean')throw Error('自选记录无效');
      if(r.deleted)map.delete(symbol);else map.set(symbol,{...r.item,symbol});
    }
    return [...map.values()].filter(r=>r.symbol);
  }
  async function saveFavorite(item,deleted){
    const symbol=normalize(item.symbol);if(!/^[A-Z0-9][A-Z0-9.\/-]{0,31}$/.test(symbol))throw Error('股票代码无效');
    const record={key:prefix+symbol,id:prefix+symbol,symbol,updatedAt:new Date().toISOString(),deleted,item:{...item,symbol}};
    const count=await store('put',{values:[record]});if(count!==1)throw Error('自选写入未确认');
    return record;
  }
  async function load(){
    if(loaded||loading)return;loading=true;
    try{favorites=await readFavorites();loaded=true;}catch(e){const status=document.querySelector('#quadStatus');if(status)status.textContent='自选池读取失败，原数据保留，请刷新重试';}
    finally{loading=false;if(loaded&&context)paint();}
  }
  function setup(){
    if(document.querySelector('#strategyQuad'))return;
    const panel=document.querySelector('#view-results .table-panel');panel.classList.add('quad-host');
    const section=document.createElement('div');section.id='strategyQuad';
    section.innerHTML='<aside class="quad-menu" aria-label="选股策略"></aside><div class="quad-main"><header class="quad-toolbar"><strong id="quadTitle"></strong><span id="quadCount"></span><span class="quad-pager"><button id="quadPrev">上页</button><span id="quadPage"></span><button id="quadNext">下页</button></span></header><p id="quadStatus" role="status"></p><div id="quadCharts"></div></div>';
    const filters=document.createElement('details');filters.className='quad-filters';filters.innerHTML='<summary>筛选、排序与导出</summary>';panel.prepend(filters);filters.append(panel.querySelector('.table-toolbar'));
    panel.append(section);
    const menu=section.querySelector('aside');
    menu.innerHTML='<h3>选股策略</h3><button data-mode="results">策略结果</button><button data-mode="pool">★ 自选池</button><hr>'+Array.from(document.querySelector('#personalPatternFilter').options).filter(o=>o.value).map(o=>`<button data-strategy="${esc(o.value)}">${esc(o.textContent)}</button>`).join('');
    menu.onclick=e=>{const b=e.target.closest('button');if(!b)return;pool=b.dataset.mode==='pool';page=0;
      if(b.dataset.strategy!==undefined){document.querySelector('#personalPatternFilter').value=b.dataset.strategy;context.refresh();}
      else if(!pool){document.querySelector('#personalPatternFilter').value='';context.refresh();}else paint();};
    document.querySelector('#quadPrev').onclick=()=>{page=Math.max(0,page-1);paint();};
    document.querySelector('#quadNext').onclick=()=>{page++;paint();};
  }
  // Hide retired strategy labels in saved favorites without changing persisted records.
  function retirementView(row){
    const retired=new Set(['round_bottom','gap_up_run','strong_xianren','ma_confluence_volume_surge','secondary_volume_surge_launch','volume_contract_pullback','rubbing_line','pullback_confirm','ma_confluence_breakout']);
    const removed=(row.personalPatterns||[]).filter(p=>retired.has(p.id)),labels=new Set(removed.map(p=>p.label));
    return {...row,personalPatterns:(row.personalPatterns||[]).filter(p=>!retired.has(p.id)),tags:(row.tags||[]).filter(t=>!labels.has(t)&&!/^(最高优先：缩量双阴|优先策略：缩量双阴)/.test(String(t)))};
  }
  function paint(){
    if(!context)return;
    const {list,report,draw}=context;
    const rows=(pool?favorites.map(f=>(report.results||[]).find(r=>r.symbol===f.symbol)||f):list).map(retirementView);
    const pages=Math.max(1,Math.ceil(rows.length/2));page=Math.max(0,Math.min(page,pages-1));
    const selected=document.querySelector('#personalPatternFilter');
    document.querySelector('#quadTitle').textContent=pool?'自选池':selected.value?selected.selectedOptions[0].textContent:'策略结果';
    document.querySelector('#quadCount').textContent=pool&&!loaded?'正在恢复自选…':`${rows.length} 只 · 日K · 1 行 × 2 列`;
    document.querySelector('#quadPage').textContent=`${page+1} / ${pages}`;
    document.querySelector('#quadPrev').disabled=page===0;document.querySelector('#quadNext').disabled=page>=pages-1;
    document.querySelectorAll('.quad-menu button').forEach(b=>b.classList.toggle('active',pool?b.dataset.mode==='pool':selected.value?b.dataset.strategy===selected.value:b.dataset.mode==='results'));
    const visible=rows.slice(page*2,page*2+2),target=document.querySelector('#quadCharts');
    target.innerHTML=visible.length?visible.map(item=>{
      const saved=favorites.some(x=>x.symbol===item.symbol);
      return `<article class="c1-stock-card"><header class="quad-stock-head"><strong><button type="button" class="quad-symbol-link" data-detail="${esc(item.symbol)}" title="打开 ${esc(item.symbol)} 专业K线">${esc(item.symbol)}</button></strong><span>${esc(item.name||'')}</span><b class="${item.change1d>=0?'pos':'neg'}">${pct(item.change1d)}</b><button data-favorite="${esc(item.symbol)}" aria-pressed="${saved}" ${!loaded||busy?'disabled':''}>${saved?'★ 已自选':'☆ 加自选'}</button></header><div class="c1-strategy"><small>${esc((item.personalPatterns||[]).map(x=>x.label).join(' · ')||(item.tags||[]).join(' · '))}</small></div><p class="c1-sector"></p></article>`;
    }).join(''):`<p class="quad-empty">${pool?(!loaded?'正在读取当前浏览器的自选；如读取失败，请刷新重试。':'自选池暂无股票，请在图表右上角点击“加自选”。'):(context.report?.strategyDataMissing?'暂无数据':'当前策略没有命中结果。')}</p>`;
    window.C1Display.cards(target,visible,draw);
    target.querySelectorAll('[data-detail]').forEach(b=>b.onclick=()=>window.dispatchEvent(new CustomEvent('radar:open-detail',{detail:b.dataset.detail})));
    target.querySelectorAll('[data-favorite]').forEach(b=>b.onclick=async()=>{
      if(busy||!loaded)return;busy=true;target.querySelectorAll('[data-favorite]').forEach(x=>x.disabled=true);
      const symbol=b.dataset.favorite,item=visible.find(x=>x.symbol===symbol);
      const deleting=favorites.some(x=>normalize(x.symbol)===normalize(symbol));
      try{
        await saveFavorite({symbol:item.symbol,name:item.name||'',close:item.close,change1d:item.change1d,personalPatterns:item.personalPatterns||[],tags:item.tags||[],savedAt:new Date().toISOString()},deleting);
        favorites=deleting?favorites.filter(x=>normalize(x.symbol)!==normalize(symbol)):[...favorites.filter(x=>normalize(x.symbol)!==normalize(symbol)),{...item,symbol:normalize(symbol)}];
        document.querySelector('#quadStatus').textContent='自选池已保存在当前浏览器';
      }
      catch(e){document.querySelector('#quadStatus').textContent='自选保存失败，未更改自选池，请重试';}
      finally{busy=false;paint();}
    });
  }
  window.StrategyGrid={render(list,report,draw,refresh){setup();context={list,report,draw,refresh};const next=list.map(x=>x.symbol).join('|')+document.querySelector('#personalPatternFilter').value;if(next!==lastKey){page=0;lastKey=next;}paint();load();}};
})();
