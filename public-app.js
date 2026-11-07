(function () {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const state = { report:null, intelligence:null, page:1, filter:'qualified', sort:'default', chartSymbol:'', chartBars:[], chartZoom:1, chartOffset:0, chartRange:'120', chartMas:{5:true,10:true,20:true,30:true,120:false}, chartGaps:true, chartDrag:null, chartHover:-1, chartLoadingMore:false, inlineChartGeneration:0, inlineChartObserver:null, inlineChartResizeObservers:[], inlineChartRecords:new Map(), inlineChartRows:new Map() };
  const INLINE_YEAR_SESSIONS=250, INLINE_WARMUP_SESSIONS=30, INLINE_MIN_VISIBLE_SESSIONS=20;
  const InlineViewport=window.RadarInlineChartViewport;
  const VIEW_INFO={home:['今日总览','公开快照总览'],intel:['最新行情','市场概况、政策与宏观、策略机会观察'],leaders:['龙头扫描','本机雷达发布的龙头与主线快照'],data:['数据中心','公开快照覆盖率与发布状态'],results:['策略选股','只读扫描结果与K线展示'],rules:['形态规则','高层规则名称；筛选与确认参数均为内部参数'],settings:['设置','阅读偏好与公开快照说明']};
  const RadarEngine={normalizedBars(bars){return (bars||[]).map(b=>({d:String(b.d||b.t||b.date||'').slice(0,10),o:Number(b.o??b.open),h:Number(b.h??b.high),l:Number(b.l??b.low),c:Number(b.c??b.close),v:Number(b.v??b.volume??0),a:b.a??b.amount,vw:b.vw??b.vwap,dataSource:b.dataSource,adjustment:b.adjustment,adjusted:b.adjusted,change_rate:b.change_rate,last_close:b.last_close})).filter(b=>b.d&&[b.o,b.h,b.l,b.c].every(Number.isFinite)).sort((a,b)=>a.d.localeCompare(b.d));}};
  function escapeHTML(value){return String(value==null?'':value).replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));}
  function fmtInt(value){return Number(value||0).toLocaleString('zh-CN');}
  function fmtMoney(value){const n=Number(value||0);if(n>=1e9)return `$${(n/1e9).toFixed(1)}B`;if(n>=1e6)return `$${(n/1e6).toFixed(1)}M`;if(n>=1e3)return `$${(n/1e3).toFixed(0)}K`;return `$${n.toFixed(0)}`;}
  function fmtPrice(value){return Number(value||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:4});}
  function fmtPct(value){return `${Number(value||0)>=0?'+':''}${(Number(value||0)*100).toFixed(2)}%`;}
  function safeNewsUrl(value){return /^https:\/\/[^\s]+$/i.test(String(value||''))?String(value):'';}
  function barAmount(bar){if(!bar)return 0;const explicit=Number(bar.amount??bar.a??bar.dollarVolume);if(Number.isFinite(explicit)&&explicit>0)return explicit;const volume=Number(bar.v??bar.volume)||0,vwap=Number(bar.vwap??bar.vw);return (Number.isFinite(vwap)&&vwap>0?vwap:Number(bar.c??bar.close)||0)*volume;}
  const DAILY_SOURCE_LABELS={massive:'Massive','futu-qfq':'富途前复权','alpaca-sip':'Alpaca SIP补缺','alpaca-iex':'Alpaca IEX补缺','yahoo-fallback':'Yahoo补缺','sqlite-import':'SQLite导入','csv-import':'CSV导入','legacy-unknown':'历史来源未标记'};
  function localBarProvenance(bar){const source=RadarDB.canonicalSource(bar&&bar.dataSource);return {...bar,dataSource:source,adjustment:String(bar&&bar.adjustment||RadarDB.adjustmentForSource(source,bar&&bar.adjusted))};}
  function sourceLabel(bar){return DAILY_SOURCE_LABELS[RadarDB.canonicalSource(bar&&bar.dataSource)]||String(bar&&bar.dataSource||'未知');}
  function adjustmentLabel(bar){return ({'split-adjusted':'拆分调整','all-adjusted':'全调整',QFQ:'前复权',raw:'不复权',unknown:'未标记'})[String(bar&&bar.adjustment||'unknown')]||String(bar.adjustment||'');}
  function summarizeDailySources(bars){const counts=new Map();(bars||[]).forEach(bar=>{const label=sourceLabel(bar);counts.set(label,(counts.get(label)||0)+1);});return [...counts.entries()].sort((a,b)=>b[1]-a[1]).map(([label,count])=>`${label} ${count}`).join(' / ')||'无日K';}
  let toastTimer;
  function toast(message,error){const el=$('#toast');el.textContent=message;el.className=`toast show${error?' error':''}`;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{el.className='toast';},4200);}
  function switchView(name){if(name==='results')renderResults();document.body.classList.toggle('c1-b-chart-view',name==='results');document.body.classList.toggle('c1-market-view',name==='intel');$$('.view').forEach(v=>v.classList.remove('active'));$$('.nav-item').forEach(v=>v.classList.toggle('active',v.dataset.view===name));const target=$(`#view-${name}`);if(target)target.classList.add('active');$('#pageTitle').textContent=VIEW_INFO[name][0];$('#pageSubtitle').textContent=VIEW_INFO[name][1];window.scrollTo({top:0,behavior:'smooth'});}
  async function refreshCoverage(){const c=await RadarDB.coverage();$('#mUniverse').textContent=fmtInt(c.universe);$('#mWithData').textContent=fmtInt(c.symbolsWithData);$('#mBars').textContent=`${fmtInt(c.totalBars)} 根日K`;$('#mReady').textContent=fmtInt(c.ready);$('#cUniverse').textContent=fmtInt(c.universe);$('#cReady').textContent=fmtInt(c.ready);$('#cLatest').textContent=c.latest||'—';$('#aUniverse').textContent=fmtInt(c.universe);$('#aWithData').textContent=fmtInt(c.symbolsWithData);$('#aReady').textContent=fmtInt(c.ready);$('#aBars').textContent=fmtInt(c.totalBars);$('#aLatest').textContent=c.latest||'—';const pct=c.universe?Math.min(100,c.ready/c.universe*100):0;$('#coveragePct').textContent=`${pct.toFixed(pct>=10?0:1)}%`;$('#coverageRing').style.setProperty('--pct',`${pct}%`);$('#setupNotice').classList.toggle('hidden',c.ready>0);$('#coverageTip').textContent='覆盖率沿用本机发布时的审计口径。';$('#msLocalDate').textContent=c.latest||'—';$('#msLastSuccess').textContent=c.latest||'—';$('#msResult').textContent='公开快照已读取';return c;}
  function filteredResults(){
    const strategy=$('#personalPatternFilter').value;
    // The saved local display projection is authoritative, including membership and order.
    const selected=state.snapshot?.strategies?.find(s=>s.id===strategy);
    let list=selected?selected.picks.map(r=>({...r,qualified:true,personalPatterns:[{id:selected.id,label:selected.name}]})):(state.report?.results||[]).slice();
    const q=$('#resultSearch').value.trim().toUpperCase(),stage=$('#stageFilter').value;
    if(q)list=list.filter(r=>String(r.symbol).includes(q)||String(r.name||'').toUpperCase().includes(q));
    if(stage)list=list.filter(r=>r.stage===stage);
    return list;
  }
  function renderResults(){const r=state.report||{results:[]};const coveragePct=r.universe?r.ready/r.universe*100:0;$('#resultSummary').innerHTML=[['候选池',fmtInt(r.universe||r.scanned)],['实际扫描',fmtInt(r.scanned)],['具备历史数据',fmtInt(r.ready)],['正式候选',fmtInt(r.qualified)],['形态观察',fmtInt(r.results.filter(x=>(x.personalPatterns||[]).length).length)],['快照交易日',r.marketDate||r.date||'—'],['覆盖率',`${coveragePct.toFixed(1)}%`]].map(([k,v])=>`<span>${k}<b>${v}</b></span>`).join('');window.StrategyGrid.render(filteredResults(),r,drawInlineChart,()=>{state.page=1;renderResults();});}
  function renderHomeCandidates(){if(!state.report)return;const list=state.report.results.filter(r=>r.qualified).slice(0,8);$('#mQualified').textContent=fmtInt(state.report.qualified||list.length);$('#homeCandidates').classList.toggle('empty-state',!list.length);$('#homeCandidates').innerHTML=list.length?list.map(r=>`<div class="candidate-item" data-symbol="${escapeHTML(r.symbol)}"><div class="score-bubble">${escapeHTML(r.score??'—')}</div><div><strong>${escapeHTML(r.symbol)} · ${escapeHTML(r.stage||'')}</strong><small>${escapeHTML((r.tags||[]).slice(0,3).join(' · '))}</small></div><em>${escapeHTML(r.candidateTier||'观察')}</em></div>`).join(''):'本次快照没有正式候选。';$$('#homeCandidates [data-symbol]').forEach(el=>el.onclick=()=>openDetail(el.dataset.symbol));}
  function c1NewsCard(article){const url=safeNewsUrl(article&&article.url),stamp=article&&article.created_at,time=stamp&&Number.isFinite(Date.parse(stamp))?new Date(stamp).toLocaleString('zh-CN'):'发布时间未知';return `<article class="c1-news-card"><h4>${escapeHTML(article?.headline||'无标题')}</h4><p>${escapeHTML(article?.summary||'')}</p><footer><span>${escapeHTML(article?.source||'公开新闻')} · ${escapeHTML(time)}</span>${url?`<a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">原文 ↗</a>`:''}</footer></article>`;}
  let c1PolicyExpanded=false;
  function renderIntelligence(){const d=state.intelligence;if(!d){window.C1Display?.market();renderStrategyObservations();return;}$('#intelAsOf').textContent=d.generatedAt?`情报更新 ${new Date(d.generatedAt).toLocaleString('zh-CN')}`:'情报更新时间未知';window.C1Display?.market();const policies=(d.policyNews||[]).slice().sort((a,b)=>(Date.parse(b.created_at||'')||0)-(Date.parse(a.created_at||'')||0));$('#intelPolicy').innerHTML=policies.length?policies.slice(0,c1PolicyExpanded?24:6).map(c1NewsCard).join(''):'<p class="c1-empty">暂无最新资讯</p>';$('#intelPolicyMore').hidden=policies.length<=6;$('#intelPolicyMore').textContent=c1PolicyExpanded?'收起':'查看更多';renderStrategyObservations();renderLeaderScan();}
  function renderStrategyObservations() {
    const target = $("#intelStrategyStocks");
    if (!target) return;
    if (target.dataset.fixedWatch === "v1") return;
    target.dataset.fixedWatch = "v1";
    const items = ["SLV", "QQQI", "SCHD", "VGT", "URA", "VST", "XLP"].map(symbol => ({symbol}));
    $("#c1ScanAsOf").textContent = "固定观察池 · 日 K 线 · 7只标的";
    target.innerHTML = items.map(item => `<article class="c1-stock-card"><div class="c1-stock-head"><strong>${item.symbol}</strong><div class="c1-watch-quote"><span class="c1-watch-price">—</span><b class="c1-watch-change">—</b></div></div><small class="c1-watch-time">正在读取行情…</small><div class="c1-strategy" hidden></div></article>`).join("");
    window.C1Display?.cards(target, items, drawInlineChart);
  }

  window.radarRefreshObservations=renderStrategyObservations;

  function cancelInlineCharts() {
    state.inlineChartGeneration++;
    if (state.inlineChartObserver) state.inlineChartObserver.disconnect();
    state.inlineChartResizeObservers.forEach(observer => observer.disconnect());
    state.inlineChartObserver = null;
    state.inlineChartResizeObservers = [];
    state.inlineChartRecords = new Map();
    state.inlineChartRows = new Map();
  }

  function inlineChartHTML(item) {
    const symbol = escapeHTML(item.symbol);
    const company = escapeHTML(item.name || item.exchange || "");
    const title = `${symbol} · ${company} · 近1年（约250个交易日）日线`;
    return `<tr class="inline-chart-row" data-inline-symbol="${symbol}"><td colspan="8">
      <section class="inline-futu-chart size-large" data-symbol="${symbol}" data-size="large">
        <header><b>${title}</b><span class="inline-ma-legend">MA5 · MA10 · MA20 · MA30</span><span class="inline-chart-gap-key">跳空区</span><span class="inline-chart-interaction-hint">滚轮缩放 · 拖动平移 · 十字光标定位日期 · 双击复位</span><button type="button" class="inline-chart-detail" data-inline-detail="${symbol}">打开专业K线</button></header>
        <div class="inline-canvas-wrap"><canvas class="inline-price-chart" aria-label="${title}"></canvas><div class="inline-chart-tooltip" hidden></div><span class="inline-chart-loading">正在读取本地日K…</span></div>
      </section>
    </td></tr>`;
  }

  function drawInlineChart(canvas, inputBars) {
    if (!canvas || !inputBars || !inputBars.length) return false;
    const periods = [5, 10, 20, 30];
    let derived = canvas._inlineDerived;
    if (!derived || derived.source !== inputBars) {
      const warm = RadarEngine.normalizedBars(inputBars);
      const yearStart = 0;
      const yearBars = warm.slice(yearStart);
      if (yearBars.length < 2) return false;
      const fullSeries = {};
      periods.forEach(period => { fullSeries[period] = maSeries(warm, period).slice(yearStart); });
      const gapStart = Math.max(0, yearStart - 1);
      const gapShift = yearStart - gapStart;
      derived = {
        source:inputBars,
        yearBars,
        priorBar:yearStart > 0 ? warm[yearStart - 1] : null,
        fullSeries,
        fullGaps:chartGaps(warm.slice(gapStart))
          .filter(gap => gap.i >= gapShift)
          .map(gap => ({ ...gap, i:gap.i - gapShift, fill:gap.fill < 0 ? -1 : gap.fill - gapShift })),
        dataKey:`${yearBars.length}|${yearBars[0].d}|${yearBars.at(-1).d}`
      };
      canvas._inlineDerived = derived;
    }
    const { yearBars, fullSeries, fullGaps, dataKey } = derived;
    if (canvas._inlineDataKey !== dataKey || !canvas._inlineView) {
      canvas._inlineDataKey = dataKey;
      canvas._inlineView = InlineViewport.normalize({ visibleCount:Math.min(INLINE_YEAR_SESSIONS, yearBars.length), offset:0 }, yearBars.length, INLINE_MIN_VISIBLE_SESSIONS);
    }
    const viewport = InlineViewport.range(canvas._inlineView, yearBars.length, INLINE_MIN_VISIBLE_SESSIONS);
    const { visibleCount, offset, start, end } = viewport;
    canvas._inlineView = { visibleCount, offset };
    const all = yearBars.slice(start, end);
    const series = {};
    periods.forEach(period => { series[period] = fullSeries[period].slice(start, end); });
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 40 || rect.height < 40) return false;
    // One visible chart supports native Retina resolution up to DPR 3.
    const ratio = Math.min(3, window.devicePixelRatio || 1);
    const w = Math.round(rect.width), h = Math.round(rect.height);
    const bitmapWidth = Math.round(w * ratio), bitmapHeight = Math.round(h * ratio);
    if (canvas.width !== bitmapWidth || canvas.height !== bitmapHeight) {
      canvas.width = bitmapWidth; canvas.height = bitmapHeight;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const left = 10, right = 58, top = 24, bottom = 20;
    const volumeH = Math.max(32, Math.round(h * .24));
    const priceBottom = h - bottom - volumeH - 8;
    const plotW = w - left - right;
    const pitch = plotW / all.length;
    const candleW = Math.max(1, Math.min(8, pitch * .62));
    const x = index => left + (index + .5) * pitch;
    const colors = { 5:"#2c94ff", 10:"#262626", 20:"#ff6268", 30:"#7b32ff" };
    const priceValues = all.flatMap((bar, index) => [bar.h, bar.l, ...periods.map(p => series[p][index]).filter(Number.isFinite)]);
    let min = Math.min(...priceValues), max = Math.max(...priceValues);
    const margin = (max - min) * .07 || Math.max(.01, max * .02);
    min -= margin; max += margin;
    const y = value => top + (max - value) / Math.max(1e-9, max - min) * (priceBottom - top);
    ctx.font = "10px -apple-system,BlinkMacSystemFont,PingFang SC,sans-serif";
    ctx.strokeStyle = "#dce3e9"; ctx.fillStyle = "#65717e"; ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const yy = top + i / 4 * (priceBottom - top);
      ctx.beginPath(); ctx.moveTo(left, yy); ctx.lineTo(w - right, yy); ctx.stroke();
      ctx.fillText((max - i / 4 * (max - min)).toFixed(max < 10 ? 3 : 2), w - right + 6, yy + 3);
    }
    const gaps = fullGaps
      .filter(gap => gap.i < end && (gap.fill < 0 || gap.fill >= start))
      .map(gap => ({ ...gap, i:gap.i - start, fill:gap.fill < 0 ? -1 : gap.fill - start }));
    gaps.forEach(gap => {
      const start = Math.max(0, gap.i), end = Math.min(all.length - 1, gap.fill < 0 ? all.length - 1 : gap.fill);
      if (start > end) return;
      ctx.fillStyle = gap.up ? "#ff9f1a" : "#65849f";
      ctx.globalAlpha = gap.fill < 0 ? .16 : .08;
      ctx.fillRect(x(start) - pitch / 2, y(gap.hi), x(end) - x(start) + pitch, Math.max(1, y(gap.lo) - y(gap.hi)));
      ctx.globalAlpha = 1;
      ctx.fillStyle = gap.up ? "#d96c00" : "#517087";
      if (!canvas.closest("#quadCharts")) ctx.fillText(`${gap.up ? "向上" : "向下"}跳空`, Math.max(left, x(start) - 16), Math.max(top + 10, y(gap.hi) - 3));
    });
    periods.forEach(period => {
      ctx.strokeStyle = colors[period]; ctx.lineWidth = 1.25; ctx.beginPath(); let begun = false;
      series[period].forEach((value, index) => {
        if (!Number.isFinite(value)) return;
        if (!begun) { ctx.moveTo(x(index), y(value)); begun = true; }
        else ctx.lineTo(x(index), y(value));
      });
      ctx.stroke();
    });
    ctx.fillStyle="#526170"; ctx.fillText(`VOL · 截至 ${yearBars.at(-1).d.slice(0,10)}`,left,priceBottom+18);
    const maxAmount = Math.max(...all.map(bar => bar.v || 0), 1);
    all.forEach((bar, index) => {
      const rising = bar.c >= bar.o;
      // Keep both directions solid so the enlarged one-year chart retains
      // the dense, high-contrast Futu-like candle appearance.
      const color = rising ? "#09a600" : "#f21d1d";
      const xx = x(index); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(xx, y(bar.h)); ctx.lineTo(xx, y(bar.l)); ctx.stroke();
      const yy = y(Math.max(bar.o, bar.c)), bodyH = Math.max(1, y(Math.min(bar.o, bar.c)) - yy);
      ctx.fillRect(xx - candleW / 2, yy, candleW, bodyH);
      const amountH = (bar.v || 0) / maxAmount * Math.max(1, volumeH - 15);
      ctx.fillRect(xx - candleW / 2, h - bottom - amountH, candleW, amountH);
    });
    ctx.strokeStyle = "#dce3e9"; ctx.beginPath(); ctx.moveTo(left, priceBottom + 5); ctx.lineTo(w - right, priceBottom + 5); ctx.stroke();
    ctx.fillStyle = "#65717e";
    const dateStep = Math.max(1, Math.ceil(all.length / 10));
    for (let index = 0; index < all.length; index += dateStep) ctx.fillText(all[index].d.slice(5), x(index) - 13, h - 5);
    const last = all[all.length - 1];
    const lastColor = last.c >= last.o ? "#09a600" : "#f21d1d";
    ctx.fillStyle = lastColor; ctx.fillRect(w - right + 2, y(last.c) - 8, right - 4, 16);
    ctx.fillStyle = "#fff"; ctx.fillText(fmtPrice(last.c), w - right + 6, y(last.c) + 3);
    const hover = canvas._inlineHover;
    if (hover && Number.isInteger(hover.index) && hover.index >= 0 && hover.index < all.length) {
      const xx = x(hover.index), yy = Math.max(top, Math.min(priceBottom, hover.y));
      ctx.setLineDash([4, 3]); ctx.strokeStyle = "#6888a4"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(xx, top); ctx.lineTo(xx, h - bottom); ctx.moveTo(left, yy); ctx.lineTo(w - right, yy); ctx.stroke();
      ctx.setLineDash([]);
      const date = all[hover.index].d.slice(0, 10);
      const labelW = 72;
      ctx.fillStyle = "#354a5d"; ctx.fillRect(Math.max(left, Math.min(w - right - labelW, xx - labelW / 2)), h - 17, labelW, 15);
      ctx.fillStyle = "#fff"; ctx.fillText(date, Math.max(left + 4, Math.min(w - right - labelW + 4, xx - labelW / 2 + 4)), h - 6);
      const hoverPrice = max - (yy - top) / Math.max(1, priceBottom - top) * (max - min);
      ctx.fillStyle = "#354a5d"; ctx.fillRect(w - right + 2, yy - 7, right - 4, 14);
      ctx.fillStyle = "#fff"; ctx.fillText(fmtPrice(hoverPrice), w - right + 6, yy + 3);
    }
    const legend = canvas.closest(".inline-futu-chart").querySelector(".inline-ma-legend");
    if (legend) {
      const legendHTML = periods.map(period => `<i style="color:${colors[period]}">MA${period} ${fmtPrice(series[period].at(-1))}</i>`).join("");
      if (legend._inlineValue !== legendHTML) {
        legend.innerHTML = legendHTML;
        legend._inlineValue = legendHTML;
      }
    }
    canvas._inlineGeometry = { all, gaps, left, right, top, bottom:h - bottom, priceBottom, pitch, x, y, min, max, universeLength:yearBars.length, start, end };
    return true;
  }
  function hoverChange(bar, previous, symbol) {
    const missing = { amount:"--", percent:"--", className:"" };
    if (!bar || !previous || ![bar.c,previous.c].every(x => typeof x === "number" && Number.isFinite(x) && x > 0)) return missing;
    if (bar.d && previous.d && previous.d >= bar.d) return missing;
    if (["dataSource","adjustment","adjusted"].some(k => (bar[k] ?? "") !== (previous[k] ?? ""))) return missing;
    const delta = bar.c - previous.c;
    const rate = ChartChangeRates.get(symbol, bar, previous);
    if (!Number.isFinite(delta)) return missing;
    const signed = value => { const rounded = value.toFixed(2); return Number(rounded) === 0 ? "0.00" : (value > 0 ? "+" : "") + rounded; };
    return { amount:signed(delta), percent:rate === null ? "--" : signed(rate)+"%", className:rate === null || rate === 0 ? "" : rate > 0 ? "pos" : "neg" };
  }

  function bindInlineChart(section) {
    if (!section || section.dataset.interactionsBound === "1") return;
    section.dataset.interactionsBound = "1";
    const symbol = section.dataset.symbol;
    const canvas = section.querySelector(".inline-price-chart");
    const tooltip = section.querySelector(".inline-chart-tooltip");
    const rateBars = state.inlineChartRecords.get(symbol)?.bars || canvas._inlineDerived?.yearBars || [];
    ChartChangeRates.prepare(symbol, rateBars, $("#futuPort")?.value).then(() => { tooltip._inlineValueKey = null; });
    const redraw = () => {
      const record = state.inlineChartRecords.get(symbol);
      if (record && record.bars) drawInlineChart(canvas, record.bars);
    };
    const finishDrag = event => {
      if (!canvas._inlineDrag) return;
      if (canvas.releasePointerCapture && event && Number.isInteger(event.pointerId)) {
        try { canvas.releasePointerCapture(event.pointerId); } catch (_) {}
      }
      canvas._inlineDrag = null;
      canvas.classList.remove("dragging");
    };
    canvas.addEventListener("wheel", event => {
      const geometry = canvas._inlineGeometry;
      if (!geometry || geometry.universeLength <= INLINE_MIN_VISIBLE_SESSIONS) return;
      const rect = canvas.getBoundingClientRect();
      const wheelUnit = event.deltaMode === 1 ? 16 : (event.deltaMode === 2 ? Math.max(1, rect.height) : 1);
      const delta = (Number(event.deltaY) || 0) * wheelUnit;
      if (!delta) return;
      const minVisible = Math.min(INLINE_MIN_VISIBLE_SESSIONS, geometry.universeLength);
      const atZoomInLimit = canvas._inlineView.visibleCount <= minVisible && delta < 0;
      const atZoomOutLimit = canvas._inlineView.visibleCount >= geometry.universeLength && delta > 0;
      // At a zoom boundary let the wheel continue scrolling the result page;
      // otherwise a 320px chart under the pointer makes the UI feel frozen.
      if (atZoomInLimit || atZoomOutLimit) {
        canvas._inlineWheelDelta = 0;
        canvas._inlineWheelAt = 0;
        return;
      }
      event.preventDefault();
      const now = Date.now();
      const pending = canvas._inlineWheelAt && now - canvas._inlineWheelAt <= 160 ? canvas._inlineWheelDelta : 0;
      canvas._inlineWheelAt = now;
      const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left - geometry.left) / Math.max(1, rect.width - geometry.left - geometry.right)));
      const step = InlineViewport.accumulateZoom(
        canvas._inlineView, geometry.universeLength, ratio, delta, pending,
        INLINE_MIN_VISIBLE_SESSIONS, 8
      );
      canvas._inlineWheelDelta = step.pendingDelta;
      if (!step.changed) return;
      canvas._inlineView = step.view;
      canvas._inlineHover = null; tooltip.hidden = true; redraw();
    }, { passive:false });
    canvas.addEventListener("pointerdown", event => {
      if (event.button !== 0 || !canvas._inlineGeometry) return;
      canvas._inlineWheelDelta = 0; canvas._inlineWheelAt = 0;
      canvas._inlineDrag = { pointerId:event.pointerId, x:event.clientX, offset:canvas._inlineView.offset };
      if (canvas.setPointerCapture) {
        try { canvas.setPointerCapture(event.pointerId); } catch (_) {}
      }
      canvas.classList.add("dragging");
      canvas._inlineHover = null; tooltip.hidden = true; event.preventDefault();
    });
    canvas.addEventListener("pointermove", event => {
      const geometry = canvas._inlineGeometry;
      if (!geometry) return;
      if (canvas._inlineDrag) {
        const deltaBars = Math.round((event.clientX - canvas._inlineDrag.x) / Math.max(.1, geometry.pitch));
        canvas._inlineView = InlineViewport.pan(
          { visibleCount:canvas._inlineView.visibleCount, offset:canvas._inlineDrag.offset },
          geometry.universeLength,
          deltaBars,
          INLINE_MIN_VISIBLE_SESSIONS
        );
        if (!canvas._inlineDragFrame) canvas._inlineDragFrame = requestAnimationFrame(() => {
          canvas._inlineDragFrame = 0; redraw();
        });
        return;
      }
      const rect = canvas.getBoundingClientRect();
      const localX = event.clientX - rect.left, localY = event.clientY - rect.top;
      const index = Math.max(0, Math.min(geometry.all.length - 1, Math.floor((localX - geometry.left) / geometry.pitch)));
      canvas._inlineHover = { index, y:localY };
      if (!canvas._inlineHoverFrame) canvas._inlineHoverFrame = requestAnimationFrame(() => {
        canvas._inlineHoverFrame = 0; redraw();
      });
      const bar = geometry.all[index];
      const absoluteIndex = geometry.start + index;
      const previous = absoluteIndex > 0
        ? canvas._inlineDerived.yearBars[absoluteIndex - 1]
        : canvas._inlineDerived.priorBar;
      const change = hoverChange(bar, previous, symbol);
      const gap = geometry.gaps.filter(item => index >= item.i && (item.fill < 0 || index <= item.fill)).at(-1);
      const tooltipKey = `${canvas._inlineDataKey}|${absoluteIndex}|${gap ? `${gap.i}|${gap.fill}` : ""}`;
      if (tooltip._inlineValueKey !== tooltipKey) {
        tooltip.innerHTML = `<b>${escapeHTML(bar.d.slice(0, 10))}</b><br>开 ${fmtPrice(bar.o)}　高 ${fmtPrice(bar.h)}<br>低 ${fmtPrice(bar.l)}　收 ${fmtPrice(bar.c)}<br><span class="${change.className}">涨跌额 ${change.amount}　涨跌幅 ${change.percent}</span><br>成交量 ${fmtInt(bar.v || 0)}<br>成交额 ${fmtMoney(barAmount(bar))}${gap ? `<br><em>${gap.up ? "向上" : "向下"}跳空 ${fmtPrice(gap.lo)}–${fmtPrice(gap.hi)} · ${gap.fill < 0 ? "未回补" : "已回补"}</em>` : ""}`;
        tooltip._inlineValueKey = tooltipKey;
      }
      tooltip.hidden = false;
      tooltip.style.left = `${Math.max(8, Math.min(rect.width - 190, localX + 12))}px`;
      tooltip.style.top = `${Math.max(8, Math.min(rect.height - 142, localY + 12))}px`;
    });
    canvas.addEventListener("pointerleave", () => {
      canvas._inlineHover = null;
      tooltip.hidden = true;
      redraw();
    });
    canvas.addEventListener("pointerup", finishDrag);
    canvas.addEventListener("pointercancel", finishDrag);
    canvas.addEventListener("dblclick", event => {
      const geometry = canvas._inlineGeometry;
      if (!geometry) return;
      canvas._inlineWheelDelta = 0; canvas._inlineWheelAt = 0;
      canvas._inlineView = InlineViewport.normalize({ visibleCount:Math.min(INLINE_YEAR_SESSIONS, geometry.universeLength), offset:0 }, geometry.universeLength, INLINE_MIN_VISIBLE_SESSIONS);
      canvas._inlineHover = null; tooltip.hidden = true; redraw(); event.preventDefault();
    });
    if (typeof ResizeObserver === "function") {
      let resizeFrame = 0;
      const observer = new ResizeObserver(() => {
        if (section.dataset.drawn !== "1" || !section.isConnected || resizeFrame) return;
        resizeFrame = requestAnimationFrame(() => { resizeFrame = 0; redraw(); });
      });
      observer.observe(section.querySelector(".inline-canvas-wrap"));
      state.inlineChartResizeObservers.push(observer);
    }
  }
  const displayBarCache = new Map();
  async function prepareInlineCharts(symbols) {
    cancelInlineCharts();
    const generation = state.inlineChartGeneration;
    const uniqueSymbols = [...new Set((symbols || []).filter(Boolean))];
    if (!uniqueSymbols.length) return;
    // One readonly transaction replaces N individual database round trips.
    const missing = uniqueSymbols.filter(symbol => !displayBarCache.has(symbol));
    const loaded = missing.length ? await RadarDB.getMany("bars", missing) : [];
    loaded.forEach((record,i) => { if(record) displayBarCache.set(missing[i], {symbol:record.symbol,bars:(record.bars||[]).slice(-280)}); });
    while(displayBarCache.size>80) displayBarCache.delete(displayBarCache.keys().next().value);
    const records = uniqueSymbols.map(symbol=>displayBarCache.get(symbol));
    if (generation !== state.inlineChartGeneration) return;
    records.forEach((record, index) => state.inlineChartRecords.set(uniqueSymbols[index], record ? {
      symbol: record.symbol, bars: (record.bars || []).slice(-(INLINE_YEAR_SESSIONS + INLINE_WARMUP_SESSIONS))
    } : null));
    $$(".inline-futu-chart:not(.c1-observation-chart)").forEach(bindInlineChart);
    const onEntries = entries => {
      entries.forEach(entry => {
        const section = entry.target;
        const symbol = section.dataset.symbol;
        const canvas = section.querySelector("canvas");
        const loading = section.querySelector(".inline-chart-loading");
        if (!entry.isIntersecting) {
          if (section.dataset.drawn === "1" && Math.abs(entry.boundingClientRect.top) > innerHeight * 2) {
            // Release offscreen bitmap memory; the cached one-year bars are
            // still small and the chart is redrawn if the user scrolls back.
            canvas.width = 1; canvas.height = 1; section.dataset.drawn = "0";
          }
          return;
        }
        if (section.dataset.drawn === "1") return;
        const record = state.inlineChartRecords.get(symbol);
        const ok = drawInlineChart(canvas, (record && record.bars) || []);
        const title=section.querySelector("header b");
        if(title) title.textContent=title.textContent.replace(/ · (近1年.*|最近 .*个交易日日线)$/u,` · 最近 ${Math.min(250,record?.bars?.length||0)} 个交易日日线`);
        section.dataset.drawn = ok ? "1" : "0";
        loading.textContent = ok ? "" : "本地日K不足，点击右侧按钮查看详情";
        loading.hidden = ok;
      });
    };
    if (typeof IntersectionObserver === "function") {
      const observer = new IntersectionObserver(onEntries, { rootMargin: "280px 0px", threshold: .01 });
      state.inlineChartObserver = observer;
      $$(".inline-futu-chart:not(.c1-observation-chart)").forEach(section => observer.observe(section));
    } else {
      // WebViews/tests without IntersectionObserver still get charts, but in
      // short animation-frame batches so the main thread remains responsive.
      const sections = $$(".inline-futu-chart:not(.c1-observation-chart)");
      for (let offset = 0; offset < sections.length; offset += 3) {
        await new Promise(resolve => requestAnimationFrame(resolve));
        onEntries(sections.slice(offset, offset + 3).map(target => ({ target, isIntersecting:true, boundingClientRect:target.getBoundingClientRect() })));
      }
    }
    $$('[data-inline-detail]').forEach(button => button.addEventListener("click", event => {
      event.stopPropagation(); openDetail(button.dataset.inlineDetail);
    }));
  }

  function renderLeaderScan() {
    const d = state.intelligence;
    if (!d || !d.leaderScan) return;
    const scan = d.leaderScan;
    $("#leaderAsOf").textContent = `生成于 ${new Date(d.generatedAt).toLocaleString("zh-CN")}`;
    const diagnostics = scan.diagnostics || {};
    const diagnosticNotes = [];
    if (diagnostics.fallbackUsed) diagnosticNotes.push("新闻题材确认不足，当前仅展示已明确标注的本地量价主线观察");
    if (diagnostics.offMarketDate > 0) diagnosticNotes.push(`有${fmtInt(diagnostics.offMarketDate)}只股票的最后交易日与全市场主日期不一致，已隔离而未污染扫描`);
    if (!(scan.mainlines || []).length && diagnostics.reason) diagnosticNotes.push(`空结果原因：${diagnostics.reason}`);
    const limitations = [...(d.limitations || []).filter(Boolean), ...diagnosticNotes];
    $("#leaderLimitations").classList.toggle("hidden", !limitations.length);
    $("#leaderLimitations").innerHTML = limitations.length ? `<strong>数据口径提示：</strong>${limitations.map(escapeHTML).join("；")}` : "";
    const quoteLink = x => `<a class="quote-link" href="${escapeHTML(x.quoteUrl || `https://www.futunn.com/stock/${encodeURIComponent(x.symbol)}-US`)}" target="_blank" rel="noopener noreferrer">${escapeHTML(x.symbol)}</a>`;
    const memberChip = x => `<a class="member-chip" href="${escapeHTML(x.quoteUrl || `https://www.futunn.com/stock/${encodeURIComponent(x.symbol)}-US`)}" target="_blank" rel="noopener noreferrer"><b>${escapeHTML(x.rank === 1 ? "龙头" : x.rank === 2 ? "第二龙头" : x.rank === 3 ? "第三龙头" : `相关${x.rank}`)}</b> ${escapeHTML(x.symbol)} <span class="${x.dayChange >= 0 ? "pos" : "neg"}">${fmtPct(x.dayChange)}</span></a>`;
    $("#mainlineList").innerHTML = (scan.mainlines || []).length ? scan.mainlines.map((x, i) => `<article class="mainline-card"><div class="mainline-rank">${i + 1}</div><div class="mainline-body"><h3>${escapeHTML(x.label)} <span class="mainline-phase">${escapeHTML(x.phase)}</span></h3><p>候选${fmtInt(x.members)}只 · 5日上涨${fmtInt(x.positive)}只 · 平均5日 <b class="${x.avg5 >= 0 ? "pos" : "neg"}">${fmtPct(x.avg5)}</b> · 龙头 ${quoteLink((x.rankedMembers || [])[0] || { symbol: x.leader })}</p><div class="member-strip">${(x.rankedMembers || []).slice(0, 12).map(memberChip).join("")}</div><small>${escapeHTML((x.evidence || []).join(" · "))}</small></div><span class="confidence ${x.confidence === "较高" ? "high" : x.confidence === "较低" ? "low" : ""}">${escapeHTML(x.confidence)}</span></article>`).join("") : `<div class="empty-state">${escapeHTML(diagnostics.reason || "当前新闻与本地日K尚未形成可确认主线")}<br><small>新闻 ${fmtInt(diagnostics.newsCount)} 条 · 可用日K ${fmtInt(diagnostics.profileCount)} 只 · 市场主日期 ${escapeHTML(diagnostics.latestDate || "未知")}</small></div>`;
    $("#leaderList").innerHTML = (scan.leaders || []).length ? scan.leaders.map(x => `<article class="leader-card"><div class="leader-symbol"><h3>${quoteLink(x)}</h3><small>${escapeHTML(x.name || "")}</small><b class="${x.dayChange >= 0 ? "pos" : "neg"}">${fmtPct(x.dayChange)}</b></div><div class="leader-reason"><h4>${escapeHTML(x.rank === 1 ? "龙头" : x.rank === 2 ? "第二龙头" : "第三龙头")} · ${escapeHTML(x.theme)} · ${escapeHTML(x.linePhase)}</h4><p>20日 ${fmtPct(x.return20)} · 5日 ${fmtPct(x.return5)} · 量比 ${Number(x.volRatio || 0).toFixed(2)} · ${x.breakout20 ? "突破近20日高点" : "尚未突破近20日高点"}</p><small>${escapeHTML((x.evidence || []).join(" · "))}</small></div><span class="confidence ${x.lineConfidence === "较高" ? "high" : x.lineConfidence === "较低" ? "low" : ""}">${escapeHTML(x.lineConfidence)}</span></article>`).join("") : `<div class="empty-state">${escapeHTML(diagnostics.reason || "尚未发现可归属到新闻题材的龙头候选")}</div>`;
  }

  function chartVisibleCount(total) { const base = state.chartRange === "120" ? 120 : state.chartRange === "250" ? 250 : total; return Math.max(20, Math.min(total, Math.round(base / Math.max(1, state.chartZoom)))); }

  function maSeries(bars, period) { const out=[]; let sum=0; bars.forEach((b,i)=>{ sum+=b.c; if(i>=period) sum-=bars[i-period].c; out.push(i>=period-1 ? sum/period : null); }); return out; }
  function chartGaps(bars) { const out=[]; for(let i=1;i<bars.length;i++){ const p=bars[i-1],b=bars[i], up=b.l>p.h, down=b.h<p.l; if(!up&&!down) continue; const lo=up?p.h:b.h, hi=up?b.l:p.l; let fill=-1; for(let j=i+1;j<bars.length;j++){ if((up&&bars[j].l<=lo)||(down&&bars[j].h>=hi)){fill=j;break;} } out.push({i,lo,hi,up,fill}); } return out; }
  function chartDerived(inputBars) {
    const cached = state.chartDerived;
    const last = inputBars && inputBars.length ? inputBars[inputBars.length - 1] : null;
    const signature = `${inputBars ? inputBars.length : 0}:${last && (last.d || last.t || last.date) || ""}:${last && (last.c || last.close) || ""}`;
    if (cached && cached.input === inputBars && cached.signature === signature) return cached;
    const all = RadarEngine.normalizedBars(inputBars);
    const series = {}; [5,10,20,30,120].forEach(p => { series[p] = maSeries(all, p); });
    state.chartDerived = { input: inputBars, signature, all, series, gaps: chartGaps(all) };
    return state.chartDerived;
  }
  function updateChartHover(event) { const g=state.chartGeometry, canvas=$("#priceChart"); if(!g||!canvas)return; const rect=canvas.getBoundingClientRect(); const idx=Math.max(g.start,Math.min(g.end-1,Math.round(g.start+(event.clientX-rect.left-g.left)/g.pitch))); state.chartHover=idx; state.chartHoverY=Math.max(g.top, Math.min(g.bottom, event.clientY-rect.top)); const derived=chartDerived(state.chartBars), all=derived.all, b=all[idx], prev=all[idx-1]; if(!b)return; const change=hoverChange(b,prev,state.chartSymbol); const maText=[5,10,20,30,120].filter(p=>state.chartMas[p]).map(p=>`MA${p} ${fmtPrice(derived.series[p][idx])}`).join("　"); const gap=derived.gaps.filter(x=>idx>=x.i&&(x.fill<0||idx<=x.fill)).at(-1); const gapText=gap ? `<br><em class="gap-info">${gap.up?"向上":"向下"}跳空：${all[gap.i].d.slice(0,10)}　${fmtPrice(gap.lo)}–${fmtPrice(gap.hi)}　${gap.fill<0?"未回补":"已回补"}</em>` : ""; const provenance=b.dataSource?`<br><small>来源 ${escapeHTML(sourceLabel(b))} · 口径 ${escapeHTML(adjustmentLabel(b))}</small>`:""; const detail=`<b>${b.d}</b><br>开 ${fmtPrice(b.o)}　高 ${fmtPrice(b.h)}<br>低 ${fmtPrice(b.l)}　收 ${fmtPrice(b.c)}<br><span class="${change.className}">涨跌额 ${change.amount}　涨跌幅 ${change.percent}</span><br>成交量 ${fmtInt(b.v||0)}　成交额 ${fmtMoney(barAmount(b))}<br><small>${maText}</small>${provenance}${gapText}`; $("#chartTooltip").innerHTML=detail; $("#chartTooltip").style.display="block"; $("#chartTooltip").style.left=`${Math.max(8,Math.min(rect.width-220,event.clientX-rect.left+12))}px`; $("#chartTooltip").style.top=`${Math.max(8,Math.min(rect.height-160,event.clientY-rect.top+12))}px`; drawChart(canvas,state.chartBars); }
  function drawChart(canvas,inputBars){ if(!canvas)return; const derived=chartDerived(inputBars),all=derived.all,series=derived.series,gaps=derived.gaps; if(all.length<2)return; state.chartAll=all; const count=chartVisibleCount(all.length), end=Math.max(count,all.length-state.chartOffset), start=end-count, bars=all.slice(start,end); const rect=canvas.getBoundingClientRect(),ratio=window.devicePixelRatio||1,w=Math.max(620,rect.width),h=Math.max(420,rect.height); canvas.width=w*ratio;canvas.height=h*ratio;const ctx=canvas.getContext("2d"); if(!ctx)return; ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,w,h); const left=12,right=72,top=18,bottom=25,volH=Math.max(90,h*.24),priceBottom=h-bottom-volH-10,plotW=w-left-right,pitch=plotW/Math.max(1,bars.length),cw=Math.max(1,Math.min(18,pitch*.68)),x=i=>left+(i-start+.5)*pitch; const periods=[5,10,20,30,120], colors={5:"#f3f5f8",10:"#f3c846",20:"#bc78ff",30:"#47a8ff",120:"#8b97a7"}; const vals=bars.flatMap((b,i)=>[b.h,b.l,...periods.filter(p=>state.chartMas[p]).map(p=>series[p][start+i]).filter(Number.isFinite)]);let min=Math.min(...vals),max=Math.max(...vals),m=(max-min)*.08||max*.02;min-=m;max+=m;const y=v=>top+(max-v)/(max-min)*(priceBottom-top);ctx.font="10px -apple-system";ctx.strokeStyle="#1c3550";ctx.fillStyle="#7590aa";for(let i=0;i<=5;i++){const yy=top+i/5*(priceBottom-top);ctx.beginPath();ctx.moveTo(left,yy);ctx.lineTo(w-right,yy);ctx.stroke();ctx.fillText((max-i/5*(max-min)).toFixed(2),w-right+7,yy+3);} if(state.chartGaps){gaps.forEach(g=>{const a=Math.max(start,g.i),z=Math.min(end-1,g.fill<0?end-1:g.fill);if(a>z)return;ctx.fillStyle=g.up?"#ef5350":"#27b778";ctx.globalAlpha=g.fill<0?.19:.10;ctx.fillRect(x(a)-pitch/2,y(g.hi),x(z)-x(a)+pitch,Math.max(1,y(g.lo)-y(g.hi)));ctx.globalAlpha=1;});} periods.filter(p=>state.chartMas[p]).forEach(p=>{ctx.strokeStyle=colors[p];ctx.lineWidth=1.25;ctx.beginPath();let begun=false;for(let i=start;i<end;i++){const v=series[p][i];if(!Number.isFinite(v))continue;if(!begun){ctx.moveTo(x(i),y(v));begun=true;}else ctx.lineTo(x(i),y(v));}ctx.stroke();}); const maxVol=Math.max(...bars.map(b=>b.v||0),1);bars.forEach((b,j)=>{const i=start+j,up=b.c>=b.o,color=up?"#09a600":"#f21d1d",xx=x(i);ctx.strokeStyle=color;ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(xx,y(b.h));ctx.lineTo(xx,y(b.l));ctx.stroke();const yy=y(Math.max(b.o,b.c)),hh=Math.max(1,y(Math.min(b.o,b.c))-yy);ctx.fillRect(xx-cw/2,yy,cw,hh);const vh=(b.v||0)/maxVol*(volH-16);ctx.globalAlpha=.75;ctx.fillRect(xx-cw/2,h-bottom-vh,cw,vh);ctx.globalAlpha=1;});ctx.strokeStyle="#29435e";ctx.beginPath();ctx.moveTo(left,priceBottom+6);ctx.lineTo(w-right,priceBottom+6);ctx.stroke();const tick=Math.max(1,Math.ceil(bars.length/7));ctx.fillStyle="#7590aa";for(let i=start;i<end;i+=tick){ctx.fillText(all[i].d.slice(5),x(i)-13,h-7);}const last=all[end-1];ctx.fillStyle=last.c>=last.o?"#09a600":"#f21d1d";ctx.fillRect(w-right+2,y(last.c)-7,64,14);ctx.fillStyle="#fff";ctx.fillText(fmtPrice(last.c),w-right+6,y(last.c)+3);if(state.chartHover>=start&&state.chartHover<end){const xx=x(state.chartHover), yy=Math.max(top,Math.min(h-bottom,state.chartHoverY||top));ctx.setLineDash([3,3]);ctx.strokeStyle="#a8c2dc";ctx.beginPath();ctx.moveTo(xx,top);ctx.lineTo(xx,h-bottom);ctx.moveTo(left,yy);ctx.lineTo(w-right,yy);ctx.stroke();ctx.setLineDash([]);}const legend=periods.filter(p=>state.chartMas[p]).map(p=>`<span style="color:${colors[p]}">MA${p} ${fmtPrice(series[p][end-1])}</span>`).join("　");$("#chartStatus").innerHTML=`${legend}<br><small>实心绿涨红跌 · ${bars.length}根K · 左拖加载更多</small>`;state.chartGeometry={start,end,left,pitch,top,bottom:h-bottom}; }

  async function openDetail(symbol){
    if(!state.report)return;const item=state.report.results.find(r=>r.symbol===symbol);if(!item)return;
    const record=await RadarDB.get('bars',symbol),localBars=((record&&record.bars)||[]).map(localBarProvenance),latest=localBars.at(-1)||{},previous=localBars.at(-2)||latest;
    const latestChange=Number.isFinite(Number(latest.c))&&Number(previous.c)?(latest.c/previous.c-1)*100:Number(item.change1d||0)*100;
    const metrics=item.metrics||{},board=item.rankingBreakdown||{};
    $('#detailContent').innerHTML=`<div class="detail-head"><div class="big-score">${escapeHTML(item.score??'—')}</div><div><h2>${escapeHTML(item.symbol)} · ${escapeHTML(item.name||'')}</h2><p>已发布综合分 · ${escapeHTML(item.candidateTier||'')} · ${escapeHTML(item.stage||'')} · ${escapeHTML(item.date||state.report.marketDate||'')} · ${fmtInt(localBars.length)} 根公开日K</p></div></div>
      <div class="chart-quote-strip"><div><span>最新价</span><b>$${fmtPrice(latest.c||item.close)}</b></div><div><span>涨跌幅</span><b class="${latestChange>=0?'pos':'neg'}">${latestChange>=0?'+':''}${latestChange.toFixed(2)}%</b></div><div><span>开 / 高 / 低 / 收</span><b>${fmtPrice(latest.o)} / ${fmtPrice(latest.h)} / ${fmtPrice(latest.l)} / ${fmtPrice(latest.c)}</b></div><div><span>成交量 / 成交额</span><b>${fmtInt(latest.v||0)} / ${fmtMoney(barAmount(latest))}</b></div><div><span>所属行业</span><b>${escapeHTML(item.industry||item.sector||'待数据源补充')}</b></div></div>
      <div class="chart-toolbar pro-chart-toolbar"><b>专业K线与量能</b><span id="chartStatus">公开日K · 滚轮缩放、拖动平移</span><div class="chart-periods"><button class="active" data-chart="5Y">日线</button></div></div>
      <div class="chart-controls"><div><button class="active" data-chart-range="120">最新120日</button><button data-chart-range="250">250日</button><button data-chart-range="all">全部历史</button></div><div class="ma-switches"><label><input type="checkbox" data-chart-ma="5" checked>MA5</label><label><input type="checkbox" data-chart-ma="10" checked>MA10</label><label><input type="checkbox" data-chart-ma="20" checked>MA20</label><label><input type="checkbox" data-chart-ma="30" checked>MA30</label><label><input type="checkbox" data-chart-ma="120">MA120</label><label><input type="checkbox" id="chartGapToggle" checked>显示缺口</label></div></div>
      <div class="chart-wrap pro-chart-wrap"><canvas id="priceChart"></canvas><div class="chart-tooltip" id="chartTooltip"></div></div>
      <div class="score-grid"><div><span>趋势</span><strong>${escapeHTML(metrics.trendScore??'—')}</strong></div><div><span>量价</span><strong>${escapeHTML(metrics.volumeScore??'—')}</strong></div><div><span>形态</span><strong>${escapeHTML(metrics.patternScore??'—')}</strong></div><div><span>个人形态加分</span><strong>${escapeHTML(metrics.personalScore??'—')}</strong></div><div><span>吸筹迹象</span><strong>${escapeHTML(metrics.accumulationScore??'—')}</strong></div><div><span>相对强度</span><strong>${escapeHTML(metrics.relativeScore??'—')}</strong></div><div><span>风险扣分</span><strong>${escapeHTML(metrics.riskPoints??'—')}</strong></div><div><span>板块合计</span><strong>${escapeHTML(board.boardTotal??'—')}</strong></div><div><span>形态合计</span><strong>${escapeHTML(board.patternTotal??'—')}</strong></div><div><span>数据日期</span><strong>${escapeHTML(item.date||state.report.marketDate||'—')}</strong></div></div>
      <div class="personal-match-box"><h3>已发布标签</h3><div>${(item.tags||[]).map(x=>`<span class="tag personal-tag">${escapeHTML(x)}</span>`).join('')||'<span class="tag">无额外标签</span>'}</div></div>
      <div class="detail-columns"><div class="detail-box"><h3>候选层级</h3><p>${escapeHTML(item.candidateTier||item.stage||'观察')}</p></div><div class="detail-box"><h3>筛选与确认条件</h3><p>内部参数。公开页只展示既有结果、标签和分数，不展示扫描算法。</p></div></div>
      <p class="audit-tip">以上是本机雷达已发布的人工观察结果，不是自动买卖指令，也不构成投资建议。</p>`;
    $('#detailModal').classList.add('open');$('#detailModal').setAttribute('aria-hidden','false');state.chartSymbol=symbol;state.chartBars=localBars;state.chartZoom=1;state.chartOffset=0;state.chartRange='120';state.chartHover=-1;state.chartDerived=null;
    if(localBars.length)requestAnimationFrame(()=>drawChart($('#priceChart'),state.chartBars));bindPublicChart();
  }
  function bindPublicChart(){
    if(state.chartBindingsController)state.chartBindingsController.abort();state.chartBindingsController=new AbortController();const signal=state.chartBindingsController.signal,canvas=$('#priceChart'),redraw=()=>drawChart(canvas,state.chartBars);
    $$('[data-chart-range]').forEach(btn=>btn.addEventListener('click',()=>{state.chartRange=btn.dataset.chartRange;state.chartOffset=0;$$('[data-chart-range]').forEach(x=>x.classList.toggle('active',x===btn));redraw();},{signal}));
    $$('[data-chart-ma]').forEach(box=>box.addEventListener('change',()=>{state.chartMas[box.dataset.chartMa]=box.checked;redraw();},{signal}));
    $('#chartGapToggle').addEventListener('change',e=>{state.chartGaps=e.target.checked;redraw();},{signal});
    canvas.addEventListener('wheel',event=>{event.preventDefault();const rect=canvas.getBoundingClientRect(),before=chartVisibleCount(state.chartBars.length),ratio=Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width));state.chartZoom=Math.max(1,Math.min(28,state.chartZoom*(event.deltaY<0?1.18:1/1.18)));const after=chartVisibleCount(state.chartBars.length);state.chartOffset=Math.max(0,Math.round(state.chartOffset+(before-after)*(1-ratio)));redraw();},{passive:false,signal});
    canvas.addEventListener('mousedown',e=>{state.chartDrag={x:e.clientX,offset:state.chartOffset};canvas.classList.add('dragging');},{signal});window.addEventListener('mouseup',()=>{state.chartDrag=null;canvas.classList.remove('dragging');},{signal});
    canvas.addEventListener('mousemove',e=>{if(state.chartDrag){const rect=canvas.getBoundingClientRect(),pitch=Math.max(3,rect.width/chartVisibleCount(state.chartBars.length));state.chartOffset=Math.max(0,Math.min(Math.max(0,state.chartBars.length-chartVisibleCount(state.chartBars.length)),Math.round(state.chartDrag.offset+(e.clientX-state.chartDrag.x)/pitch)));redraw();}else updateChartHover(e);},{signal});
    canvas.addEventListener('mouseleave',()=>{state.chartHover=-1;$('#chartTooltip').style.display='none';redraw();},{signal});
  }
  function closeModal(){if(state.chartBindingsController)state.chartBindingsController.abort();$('#detailModal').classList.remove('open');$('#detailModal').setAttribute('aria-hidden','true');}
  function renderRules(snapshot){
    const patterns=snapshot.patterns||[],core=patterns.slice(0,5),personal=patterns.slice(5);
    const card=(x,kind)=>`<article class="rule-card ${kind}"><b>${kind==='personal'?'个人形态':'高层规则'}</b><h3>${escapeHTML(x.name||'形态')}</h3><p>${escapeHTML(x.description||'只展示高层观察说明。')}</p><p><strong>参数：内部参数</strong></p></article>`;
    $('#publicCoreRules').innerHTML=core.map(x=>card(x,x.name==='出货风险'?'risk':'gate')).join('');$('#publicPersonalRules').innerHTML=personal.map(x=>card(x,'personal')).join('');
  }
  function renderDataCenter(snapshot){
    const dc=snapshot.dataCenter||{},latest=snapshot.coverage?.latest||'—';$('#msLocalDate').textContent=latest;$('#msLastSuccess').textContent=dc.mainScan?.reportMarketDate||latest;$('#msReturned').textContent=dc.report?.status||snapshot.report?.status||'已保存';$('#msResult').textContent='只读快照已就绪';$('#progressText').textContent=snapshot.generatedAt?`发布于 ${new Date(snapshot.generatedAt).toLocaleString('zh-CN')}`:'只读快照已就绪';$('#taskLog').textContent='本页面只读取公开结果，不修改雷达数据库，不执行同步、扫描或连接测试。';
  }
  function csvCell(value){return `"${String(value==null?'':value).replace(/"/g,'""')}"`;}
  function downloadBlob(name,content,type){const blob=content instanceof Blob?content:new Blob([content],{type:type||'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);}
  function publicRows(){return (state.report?.results||[]).filter(r=>r.qualified);}
  function exportCSV(){if(!state.report)return toast('快照尚未读取',true);const rows=[['排名','代码','名称','综合分','等级','候选层级','技术阶段','形态标签','收盘价','日涨跌','数据日期']];publicRows().forEach((r,i)=>rows.push([i+1,r.symbol,r.name,r.score,r.grade,r.candidateTier,r.stage,(r.personalPatterns||[]).map(x=>x.label).join('/')||(r.tags||[]).join('/'),r.close,r.change1d,r.date||state.report.marketDate]));downloadBlob(`asrulai_公开结果_${state.report.marketDate||state.report.generatedAt.slice(0,10)}.csv`,'\ufeff'+rows.map(row=>row.map(csvCell).join(',')).join('\n'),'text/csv;charset=utf-8');}
  function exportHTML(){if(!state.report)return toast('快照尚未读取',true);const rows=publicRows().map((x,i)=>`<tr><td>${i+1}</td><td><b>${escapeHTML(x.symbol)}</b><br><small>${escapeHTML(x.name||'')}</small></td><td>${escapeHTML(x.score??'—')}</td><td>${escapeHTML(x.candidateTier||x.stage||'')}</td><td>${escapeHTML((x.tags||[]).join('、'))}</td><td>${escapeHTML(x.date||state.report.marketDate||'')}</td></tr>`).join('');const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>asrulai 公开观察结果</title><style>body{font-family:-apple-system,PingFang SC,Arial;margin:36px;color:#172333}table{width:100%;border-collapse:collapse}th,td{padding:9px;border:1px solid #dbe3eb;text-align:left}th{background:#13283d;color:white}.note{color:#65758a;line-height:1.7}</style><body><h1>asrulai 点灯人 · 公开观察结果</h1><p class="note">数据日期：${escapeHTML(state.report.marketDate||'—')}。仅含已发布结果、既有分数和标签；筛选条件为内部参数。</p><table><thead><tr><th>#</th><th>股票</th><th>既有分数</th><th>层级/阶段</th><th>标签</th><th>日期</th></tr></thead><tbody>${rows||'<tr><td colspan="6">本次无正式候选</td></tr>'}</tbody></table></body></html>`;downloadBlob(`asrulai_公开报告_${state.report.marketDate||state.report.generatedAt.slice(0,10)}.html`,html,'text/html;charset=utf-8');}
  function exportDiagnostics(){const s=state.snapshot||{};downloadBlob('asrulai_公开状态.json',JSON.stringify({generatedAt:s.generatedAt,marketDate:s.marketDate,coverage:s.coverage,status:'public-readonly',barsSymbols:Object.keys(s.bars||{}).length},null,2),'application/json;charset=utf-8');}
  async function reloadPublic(){await RadarDB.reload();window.location.reload();}
  function bindEvents(){
    $$('.nav-item').forEach(btn=>btn.addEventListener('click',()=>switchView(btn.dataset.view)));$$('[data-go]').forEach(btn=>btn.addEventListener('click',()=>switchView(btn.dataset.go)));
    ['#quickScanBtn','#runScanBtn','#homeQuickScan'].forEach(id=>$(id)?.addEventListener('click',()=>toast('这是公开只读镜像。请在本机雷达扫描后运行发布脚本更新。')));
    ['#refreshIntelBtn','#refreshLeaderBtn','#testAllSourcesBtn'].forEach(id=>$(id)?.addEventListener('click',reloadPublic));$('#exportDiagnosticsBtn').onclick=exportDiagnostics;$('#refreshCoverageBtn').onclick=()=>refreshCoverage().then(()=>toast('公开覆盖统计已刷新'));
    $$('.filter-tabs button').forEach(btn=>btn.addEventListener('click',()=>{$$('.filter-tabs button').forEach(x=>x.classList.remove('active'));btn.classList.add('active');state.filter=btn.dataset.filter;state.page=1;renderResults();}));
    $('#resultSearch').addEventListener('input',()=>{clearTimeout(state.resultRenderTimer);state.resultRenderTimer=setTimeout(renderResults,120);});$('#stageFilter').addEventListener('change',renderResults);$('#personalPatternFilter').addEventListener('change',renderResults);$$('[data-result-sort]').forEach(btn=>btn.addEventListener('click',()=>{state.sort=btn.dataset.resultSort;renderResults();}));
    $('#exportCsvBtn').onclick=exportCSV;$('#exportHtmlBtn').onclick=exportHTML;$('#intelPolicyMore').onclick=()=>{c1PolicyExpanded=!c1PolicyExpanded;renderIntelligence();};$('#modalClose').onclick=closeModal;$('#detailModal').onclick=e=>{if(e.target.id==='detailModal')closeModal();};document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});window.addEventListener('radar:open-detail',e=>openDetail(e.detail));
    try{const prefs=JSON.parse(localStorage.getItem('asrulai.readingPreferences')||'{}');if(prefs.pageSize)$('#pageSize').value=prefs.pageSize;if(prefs.showManualPlan!==undefined)$('#showManualPlan').checked=!!prefs.showManualPlan;}catch(_){}
    $('#saveSettingsBtn').onclick=()=>{localStorage.setItem('asrulai.readingPreferences',JSON.stringify({pageSize:$('#pageSize').value,showManualPlan:$('#showManualPlan').checked}));toast('阅读偏好已保存在当前浏览器');};$('#pageSize').onchange=renderResults;
    $('#clearDataBtn').onclick=()=>{if(!confirm('只清除当前浏览器中的阅读偏好和自选标记，不影响本机雷达。继续吗？'))return;localStorage.removeItem('asrulai.readingPreferences');localStorage.removeItem('asrulai.publicFavorites');toast('当前浏览器的阅读偏好与自选标记已清除');};
  }
  async function init(){
    bindEvents();const advanced=document.createElement('details');advanced.className='result-more';advanced.innerHTML='<summary>排序与导出</summary><div class="result-more-body"><small>排序和导出只处理已发布结果，不包含内部参数。</small></div>';$('.table-toolbar').appendChild(advanced);$$('[data-result-sort],#exportCsvBtn,#exportHtmlBtn').forEach(button=>advanced.querySelector('div').appendChild(button));
    const controls=$('.result-controls'),scanDetails=document.createElement('details');scanDetails.className='scan-preferences';scanDetails.innerHTML='<summary>扫描参数与统计</summary>';controls.parentNode.insertBefore(scanDetails,controls);scanDetails.appendChild(controls);scanDetails.appendChild($('#resultSummary'));
    const snapshot=await RadarDB.open().then(()=>RadarDB.snapshot());state.snapshot=snapshot;state.report=snapshot.report;state.intelligence=snapshot.intelligence;
    $('#serverDot').classList.add('ok');$('#serverStatus').textContent='正常 · 只读';$('#asOf').textContent=state.report?.generatedAt?`快照时间 ${new Date(state.report.generatedAt).toLocaleString('zh-CN')}`:'公开快照';
    renderHomeCandidates();renderResults();renderIntelligence();renderRules(snapshot);renderDataCenter(snapshot);await refreshCoverage();switchView('intel');document.documentElement.dataset.radarReady='1';
  }
  window.RadarChartTest={hoverChange,chartGaps,maSeries,drawChart,drawInlineChart,bindInlineChart,chartVisibleCount,InlineViewport};
  init().catch(error=>{console.error(error);toast(`公开快照初始化失败：${error.message}`,true);$('#serverStatus').textContent='读取失败';});
})();
