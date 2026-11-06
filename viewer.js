/* Public snapshot viewer. No strategies, scores, indicators or provider clients. */
'use strict';
(async()=>{
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),num=x=>Number.isFinite(x)?x.toLocaleString('en-US',{maximumFractionDigits:2}):'—',pct=x=>Number.isFinite(x)?(x>=0?'+':'')+(x*100).toFixed(2)+'%':'—',ts=x=>{const t=Number(x);return Number.isFinite(t)&&t>1e9?new Date(t*1000).toLocaleString('zh-CN',{hour12:false}):(x||'')};
let full,klines;
try{if(location.protocol==='file:'){const fs=$('#full-snapshot').textContent.trim(),ks=$('#klines-snapshot').textContent.trim();if(!fs)throw Error('empty');full=JSON.parse(fs);klines=JSON.parse(ks||'{"items":[]}');}else{[full,klines]=await Promise.all(['full','klines'].map(n=>fetch('data/'+n+'.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('快照读取失败');return r.json();})));}}catch(e){const st=$('#status');if(st)st.textContent='快照无法读取，请检查本地数据文件。';return;}
const ov=full.overview||{},ld=full.leaders||{},dc=full.dataCenter||{};
const bySymbol=new Map((klines.items||[]).map(r=>[r.symbol,r]));
let strategy=(full.strategies||[]).find(s=>(s.picks||[]).length)?.id||(full.strategies||[])[0]?.id,page=0;const charts=[];
const STAGE_LIST=(full.stages||[]).filter(s=>typeof s==='string');
const PAGE_SIZE=12;
$('#stamp').textContent=full.marketDate||full.latestMarketDate||'';
$('#dashboard-time').textContent=(ov.generatedAt||'')+' · 行情截至 '+(ov.stats?.latestDate||full.latestMarketDate||'');
$('#report-time').textContent='数据截至 '+full.marketDate+' · 快照 '+(full.generatedAt||'');
$('#leaders-time').textContent=(ld.generatedAt||'')+' · 数据 '+(ld.latestDate||'');
$('#bottom-time').textContent='观察池快照 '+full.marketDate;
$('#watch-time').textContent='数据截至 '+full.marketDate;
$('#dc-time').textContent=(dc.generatedAt||ov.generatedAt||'')+' · 覆盖至 '+(dc.coverage?.latest||'');
$('#patterns-time').textContent='规则版本 '+(full.engineVersion||'');
$('#strategy').innerHTML=(full.strategies||[]).map(s=>`<option value="${esc(s.id)}">${esc(s.name)}（${s.picksCount??(s.picks||[]).length}）</option>`).join('');
if(strategy)$('#strategy').value=strategy;
for(const s of STAGE_LIST)$('#stage').append(new Option(s,s));
function destroyCharts(){for(const c of charts)c.destroy();charts.length=0;}
function view(name){destroyCharts();for(const m of $$('main'))m.hidden=m.id!==name;for(const b of $$('[data-view]'))b.classList.toggle('active',b.dataset.view===name);window.scrollTo(0,0);({overview:renderOverview,leaders:renderLeaders,bottom:renderBottom,results:renderResults,watchlist:renderWatchlist,datacenter:renderDatacenter,patterns:renderPatterns}[name]||(()=>{}))();}
for(const b of $$('[data-view]'))b.onclick=()=>view(b.dataset.view);
$('.brand').onclick=e=>{e.preventDefault();view('overview');};
$('#strategy').onchange=e=>{strategy=e.target.value;page=0;renderResults();};
$('#search').oninput=()=>{page=0;renderResults();};
$('#stage').onchange=()=>{page=0;renderResults();};
$('#prev').onclick=()=>{page--;renderResults();};
$('#next').onclick=()=>{page++;renderResults();};
$('#watch-search').oninput=()=>renderWatchlist();
/* ---------- K 线图 ---------- */
function chart(card,k){const canvas=card.querySelector('canvas'),ctx=canvas.getContext('2d'),bars=k?.bars||[];const mad=k?.ma||{},overlay=[mad['5'],mad['10'],mad['20'],mad['30']];const gaps=((k?.annotations||{}).gaps)||[];let count=bars.length,offset=0,hover=-1,drag=null;
function draw(){const rect=canvas.getBoundingClientRect(),w=rect.width,h=rect.height,dpr=devicePixelRatio||1;if(!w)return;canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#fffefb';ctx.fillRect(0,0,w,h);if(!bars.length){ctx.fillStyle='#aaa192';ctx.font='12px sans-serif';ctx.fillText('暂无已保存日K',20,40);return;}const n=Math.max(1,Math.min(count,bars.length)),start=Math.max(0,bars.length-n-offset),end=Math.min(bars.length,start+n),slice=bars.slice(start,end);const left=9,right=56,top=20,bottom=26,volH=68,priceH=h-top-bottom-volH;const hi=Math.max(...slice.map(b=>b.h)),lo=Math.min(...slice.map(b=>b.l)),pad=Math.max((hi-lo)*.04,hi*.001,.01),high=hi+pad,low=lo-pad,pitch=(w-left-right)/slice.length,x=i=>left+(i-start+.5)*pitch,y=v=>top+(high-v)/(high-low)*priceH;
for(const g of gaps){const gi=g.fromIndex;if(gi==null||gi<start-1||gi>=end)continue;const gx0=x(Math.max(gi,start))-pitch/2,gx1=x(g.fillIndex!=null&&g.fillIndex<end?g.fillIndex:end-1)+pitch/2;if(gx1<=gx0)continue;const gy0=y(Math.max(g.high, g.low)),gy1=y(Math.min(g.high, g.low));ctx.fillStyle=g.direction==='down'?'rgba(176,106,92,.10)':'rgba(79,138,104,.10)';ctx.fillRect(gx0,gy0,gx1-gx0,Math.max(2,gy1-gy0));}
ctx.font='10px sans-serif';ctx.lineWidth=1;for(let t=0;t<5;t++){const val=high-(high-low)*t/4,yy=y(val);ctx.strokeStyle='rgba(96,88,76,.09)';ctx.beginPath();ctx.moveTo(left,yy);ctx.lineTo(w-right,yy);ctx.stroke();ctx.fillStyle='#aaa192';ctx.fillText(num(val),w-right+5,yy+3);}
const maxV=Math.max(1,...slice.map(b=>b.v||0));for(let i=start;i<end;i++){const b=bars[i],up=b.c>=b.o,color=up?'#4f8a68':'#b06a5c',xx=x(i),bw=Math.max(1,Math.min(8,pitch*.7));ctx.strokeStyle=color;ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(xx,y(b.h));ctx.lineTo(xx,y(b.l));ctx.stroke();ctx.fillRect(xx-bw/2,y(Math.max(b.o,b.c)),bw,Math.max(1,Math.abs(y(b.o)-y(b.c))));const vh=(b.v||0)/maxV*(volH-15);ctx.globalAlpha=.65;ctx.fillRect(xx-bw/2,h-bottom-vh,bw,vh);ctx.globalAlpha=1;}
const colors=['#4a86c5','#33383f','#c4553f','#7a5fae'];for(let line=0;line<4;line++){const series=overlay[line];if(!series)continue;ctx.strokeStyle=colors[line];ctx.lineWidth=1.2;ctx.beginPath();let begun=false;for(let i=start;i<end;i++){const v=series[i];if(!Number.isFinite(v))continue;if(!begun){ctx.moveTo(x(i),y(v));begun=true;}else ctx.lineTo(x(i),y(v));}ctx.stroke();}
const last=bars[end-1],ly=y(last.c);ctx.setLineDash([4,4]);ctx.strokeStyle='#2e2a3361';ctx.beginPath();ctx.moveTo(left,ly);ctx.lineTo(w-right,ly);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#2e2a33';ctx.beginPath();ctx.roundRect(w-right+1,ly-8,right-3,17,4);ctx.fill();ctx.fillStyle='#fbf8f1';ctx.fillText(num(last.c),w-right+4,ly+4);ctx.fillStyle='#aaa192';ctx.fillText('VOL',left,h-bottom-volH+12);for(let i=start;i<end;i+=Math.max(1,Math.floor(slice.length/4)))ctx.fillText(bars[i].d.slice(5),x(i)-12,h-7);
if(hover>=start&&hover<end){ctx.setLineDash([3,3]);ctx.strokeStyle='#2e2a3355';ctx.beginPath();ctx.moveTo(x(hover),top);ctx.lineTo(x(hover),h-bottom);ctx.stroke();ctx.setLineDash([]);const b=bars[hover];card.querySelector('.chart-note').textContent=b.d+' · O '+num(b.o)+' H '+num(b.h)+' L '+num(b.l)+' C '+num(b.c)+' V '+num(b.v);}canvas._geom={start,end,pitch,left};}
canvas.onwheel=e=>{e.preventDefault();count=Math.max(Math.min(20,bars.length),Math.min(bars.length,Math.round(count*(e.deltaY>0?1.15:.87))));offset=Math.min(offset,Math.max(0,bars.length-count));draw();};canvas.onpointerdown=e=>{drag={x:e.clientX,offset};canvas.setPointerCapture(e.pointerId);};canvas.onpointermove=e=>{const g=canvas._geom;if(!g)return;if(drag)offset=Math.max(0,Math.min(bars.length-count,drag.offset+Math.round((e.clientX-drag.x)/g.pitch)));else hover=Math.max(g.start,Math.min(g.end-1,Math.floor((e.clientX-canvas.getBoundingClientRect().left-g.left)/g.pitch)+g.start));draw();};canvas.onpointerup=canvas.onpointercancel=()=>drag=null;canvas.onpointerleave=()=>{hover=-1;draw();};canvas.onkeydown=e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();offset=Math.max(0,Math.min(bars.length-count,offset+(e.key==='ArrowLeft'?5:-5)));draw();}};const resize=new ResizeObserver(draw);resize.observe(canvas);draw();return{destroy(){resize.disconnect();}};}
function stockCard(r,k,note){return `<article class="glass stock"><div class="stock-head"><strong>${esc(r.symbol)}</strong><span>${esc(r.name||'')}</span><b class="${(r.change1d??0)>=0?'up':'down-color'}">${pct(r.change1d)}</b><button data-copy="${esc(r.symbol)}">复制代码</button></div><p class="tags">${esc(note||(r.tags||[]).join(' · ')||'')}</p><div class="plot"><header class="plot-head"><span class="legend">MA5 · MA10 · MA20 · MA30 · 缺口阴影</span></header><canvas class="chart" aria-label="${esc(r.symbol)} 日K图" tabindex="0"></canvas><div class="chart-note">${esc(k?('数据截至 '+(k.latestDate||'')+' · '+(k.status||'')):'暂无已保存日K')}</div></div></article>`;}
function bindCards(container,rows){for(const [i,card] of [...container.children].entries()){if(!card.querySelector('canvas'))continue;const row=rows[i],k=bySymbol.get(row.symbol)||bySymbol.get(row.klineSymbol);charts.push(chart(card,k));const btn=card.querySelector('[data-copy]');if(btn)btn.onclick=async e=>{try{if(navigator.clipboard&&isSecureContext)await navigator.clipboard.writeText(row.symbol);else{const t=document.createElement('textarea');t.value=row.symbol;document.body.append(t);t.select();document.execCommand('copy');t.remove();}e.target.textContent='已复制';}catch{e.target.textContent=row.symbol;}};}}
/* ---------- 最新行情 ---------- */
let overviewDone=false;
function renderOverview(){if(overviewDone){return;}overviewDone=true;
$('#quotes').innerHTML=(ov.quotes||[]).map(q=>{const bad=q.status&&q.status!=='SAVED'&&q.status!=='SAVED_CLOSE';return `<div class="quote"><span>${esc(q.name||q.symbol)}</span><b class="${(q.change??0)>=0?'up':'down-color'}">${pct(q.change)}</b><strong>${bad?'—':num(q.price)}</strong><small>${esc(q.status==='UNAVAILABLE'?'暂无数据':(q.time||''))}</small></div>`;}).join('')||'<p>暂无已保存行情</p>';
function heat(kind){const h=(ov.heat||{})[kind];$('#heat').innerHTML=(h?.items||[]).map(x=>`<div class="tile"><span>${esc(x.name)}</span><b class="${(x.change??0)>=0?'up':'down-color'}">${pct(x.change)}</b></div>`).join('');$('#heat-time').textContent=h?.time?('快照 '+ts(h.time)+' · 共 '+h.total+' 个'):'暂无已保存板块快照';for(const b of $$('[data-heat]'))b.classList.toggle('active',b.dataset.heat===kind);}
for(const b of $$('[data-heat]'))b.onclick=()=>heat(b.dataset.heat);heat('industry');
$('#news').innerHTML=(ov.news||[]).map(n=>`<article><h4>${esc(n.headline)}</h4><p>${esc(n.summary)}</p><small>${esc(n.time||'')} · 来源 ${esc(n.source||'')}${n.link?' · <a href="'+esc(n.link)+'" target="_blank" rel="noopener noreferrer">原文</a>':''}</small></article>`).join('')||'<p>暂无已保存资讯</p>';
$('#market-summary').textContent=ov.summary?.text||'暂无已保存市场概况';
const st=ov.stats||{};const tile=(l,v)=>`<div><small>${l}</small><b>${v}</b></div>`;
$('#stats').innerHTML=[tile('市场温度',(st.temperature!=null?st.temperature+'/100':'—')),tile('状态',st.label||'—'),tile('覆盖标的',num(st.total)),tile('上涨',num(st.advancing)),tile('下跌',num(st.declining)),tile('平盘',num(st.unchanged)),tile('上涨占比',pct(st.advRatio)),tile('站上20日线',num(st.above20)+'（'+pct(st.above20Ratio)+'）'),tile('20日新高',num(st.newHigh20)),tile('放量上涨',num(st.highVolumeUp)),tile('中位数涨跌',pct(st.medianReturn)),tile('统计日期',st.latestDate||'—')].join('');
const m=ov.metals;$('#metals').innerHTML=m?`<div class="metal-prices"><div><small>黄金</small><b>${num(m.gold)}</b></div><div><small>白银</small><b>${num(m.silver)}</b></div></div><small>${esc(m.time||'')}${m.stale?' · 数据可能滞后':''}</small>`:'<p>暂无已保存有效报价</p>';
function dial(){const c=$('#metals-dial'),r=c.getBoundingClientRect();if(r.width<40)return;const ratio=m?.ratio,ctx=c.getContext('2d'),p=devicePixelRatio||1;c.width=r.width*p;c.height=r.height*p;ctx.scale(p,p);const cx=r.width/2,cy=r.height-30,rad=Math.min(cx-15,100);ctx.lineWidth=10;[['#cf7a6b',Math.PI,Math.PI*1.2],['#ddb98a',Math.PI*1.2,Math.PI*1.65],['#6fa98c',Math.PI*1.65,Math.PI*2]].forEach(([col,a,b])=>{ctx.strokeStyle=col;ctx.beginPath();ctx.arc(cx,cy,rad,a,b);ctx.stroke();});if(Number.isFinite(ratio)){const a=Math.PI+(Math.max(20,Math.min(120,ratio))-20)/100*Math.PI;ctx.strokeStyle='#2e2a33';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+Math.cos(a)*rad*.85,cy+Math.sin(a)*rad*.85);ctx.stroke();}ctx.fillStyle='#2c2822';ctx.font='600 22px sans-serif';ctx.textAlign='center';ctx.fillText(Number.isFinite(ratio)?ratio.toFixed(1):'—',cx,cy+26);}
new ResizeObserver(dial).observe($('#metals-dial'));dial();}
/* ---------- 龙头扫描 ---------- */
let leadersDone=false;
function renderLeaders(){if(leadersDone)return;leadersDone=true;const dg=ld.diagnostics||{};
$('#leaders-note').textContent=(dg.reason||'')+(dg.fallbackUsed?'（当前为量价主线回退模式）':'')+' · 新闻样本 '+num(dg.newsCount)+' · 主题 '+num(dg.newsThemeCount)+' · 档案 '+num(dg.profileCount);
$('#mainlines').innerHTML=(ld.mainlines||[]).map(m=>`<article class="glass line-card"><header><h3>${esc(m.label)}</h3><span class="badge">${esc(m.phase||'')}</span></header><p class="line-meta">成员 <b>${m.members??'—'}</b> · 上涨 <b class="up">${m.positive??'—'}</b> · 5日 ${pct(m.avg5)} · 20日 ${pct(m.avg20)} · 龙头 <b>${esc(m.leader||'—')}</b> · 置信 ${esc(m.confidence||'')}</p><p class="tags">${esc((m.evidence||[]).join('；')||'暂无直接新闻代码，按本地量价观察')}</p><div class="members">${(m.rankedMembers||[]).slice(0,6).map(r=>`<span class="chip ${(r.dayChange??0)>=0?'up':'down-color'}">${esc(r.symbol)} ${pct(r.dayChange)}</span>`).join('')}</div></article>`).join('')||'<p>暂无主线数据。</p>';
$('#leader-table tbody').innerHTML=(ld.leaders||[]).map(l=>`<tr><td>${l.rank??''}</td><td><b>${esc(l.symbol)}</b> <small>${esc(l.name||'')}</small></td><td>${esc(l.theme||'')}<small>${esc(l.linePhase||'')}</small></td><td>${num(l.price)}</td><td class="${(l.dayChange??0)>=0?'up':'down-color'}">${pct(l.dayChange)}</td><td class="${(l.return5??0)>=0?'up':'down-color'}">${pct(l.return5)}</td><td class="${(l.return20??0)>=0?'up':'down-color'}">${pct(l.return20)}</td><td>${num(l.volRatio)}</td><td>${l.breakout20?'✓':''}</td></tr>`).join('');}
/* ---------- 大跌抄底 ---------- */
let bottomDone=false;
function renderBottom(){if(bottomDone)return;bottomDone=true;const bw=full.bottomWatch||{},syms=bw.symbols||[];
$('#bottom-note').textContent='观察池：'+(syms.join(' · ')||'暂无')+' ·  shaded bands 为历史缺口（上缺绿色 / 下缺红色，填充后不再延伸）';
const items=(bw.items||[]).map(it=>({symbol:it.klineSymbol||it.symbol,name:it.symbol,change1d:null})).filter(it=>bySymbol.has(it.symbol));
const box=$('#bottom-charts');box.innerHTML=items.map(r=>stockCard(r,bySymbol.get(r.symbol))).join('')||'<p>当前快照没有观察池K线。</p>';bindCards(box,items);}
/* ---------- 策略选股 ---------- */
function renderResults(){destroyCharts();const s=(full.strategies||[]).find(s=>s.id===strategy);let rows=s?.picks||[];const q=$('#search').value.trim().toUpperCase(),stage=$('#stage').value;rows=rows.filter(r=>(!q||(r.symbol+' '+(r.name||'')).toUpperCase().includes(q))&&(!stage||r.stage===stage));const pages=Math.max(1,Math.ceil(rows.length/PAGE_SIZE));page=Math.max(0,Math.min(page,pages-1));
$('#title').textContent='策略选股';$('#strategy-name').textContent=s?.name||'策略结果';$('#count').textContent=rows.length+' 只 · 日K · 每页 '+PAGE_SIZE+' 只';$('#page').textContent=(page+1)+' / '+pages;$('#prev').disabled=page===0;$('#next').disabled=page===pages-1;
$('#status').textContent=s?.reason||(s?('状态 '+s.status):'');
const slice=rows.slice(page*PAGE_SIZE,page*PAGE_SIZE+PAGE_SIZE);
$('#charts').innerHTML=slice.map(r=>stockCard(r,bySymbol.get(r.symbol),[r.stage,r.candidateTier].filter(Boolean).join(' · '))).join('')||'<p>当前快照没有对应股票。</p>';
bindCards($('#charts'),slice);}
/* ---------- 自选池 ---------- */
function renderWatchlist(){destroyCharts();let rows=(full.watchlist||[]).slice();const q=$('#watch-search').value.trim().toUpperCase();if(q)rows=rows.filter(r=>(r.symbol+' '+(r.name||'')).toUpperCase().includes(q));$('#watch-status').textContent=rows.length+' 只 · 日K';
$('#watch-charts').innerHTML=rows.map(r=>stockCard({symbol:r.symbol,name:r.name,change1d:null},bySymbol.get(r.symbol),r.note||'自选')).join('')||'<p>当前快照没有自选池。</p>';bindCards($('#watch-charts'),rows);}
/* ---------- 数据中心 ---------- */
let dcDone=false;
function renderDatacenter(){if(dcDone)return;dcDone=true;const cov=dc.coverage||{},sch=dc.dailySchedule||{},scan=dc.mainScan||{},rep=dc.report||{};
$('#dc-note').textContent=(dc.notes||[]).join(' ');
const tile=(l,v)=>`<div><small>${l}</small><b>${v}</b></div>`;
$('#dc-coverage').innerHTML=[tile('证券池',num(cov.universe)),tile('有数据标的',num(cov.symbolsWithData)),tile('就绪（历史足够）',num(cov.ready)),tile('K线总条数',num(cov.totalBars)),tile('最新交易日',cov.latest||'—')].join('');
$('#dc-sync tbody').innerHTML=(dc.syncs||[]).map(s=>`<tr><td>${esc(s.market||'')}</td><td>${esc(s.dataType||'')}</td><td>${esc(s.syncStatus||'')}</td><td>${esc(s.lastSuccessfulMarketDate||'—')}</td><td>${num(s.recordsReceived)} / ${num(s.recordsInserted)} / ${num(s.recordsUpdated)}</td><td>${esc(s.lastErrorCode||'—')}</td><td>${esc(s.lastSyncStartedAt||'')}</td></tr>`).join('')||'<tr><td colspan="7">暂无同步记录</td></tr>';
$('#dc-schedule').innerHTML=[tile('每日定时',sch.enabled?'开启':'关闭'),tile('时区',sch.timezone||'—'),tile('最近成功',sch.last_success||'—'),tile('目标交易日',sch.attempt_target||'—'),tile('已尝试',num(sch.attempts)),tile('下次尝试',ts(sch.next_attempt))].join('');
$('#dc-scan').innerHTML=[tile('扫描状态',scan.status||'—'),tile('目标',scan.target||'—'),tile('进度',(scan.progress??'—')+'%'),tile('补充状态',scan.enrichmentStatus||'—'),tile('开始',scan.startedAt||'—'),tile('结束',scan.finishedAt||'—'),tile('报告',rep.status||'—'),tile('报告交易日',rep.reportMarketDate||'—')].join('');
$('#dc-notes').innerHTML=(dc.notes||[]).map(n=>`<p class="status">· ${esc(n)}</p>`).join('');}
/* ---------- 形态规则 ---------- */
let patternsDone=false;
function renderPatterns(){if(patternsDone)return;patternsDone=true;
$('#pattern-list').innerHTML=(full.patterns||[]).map(p=>`<article class="glass pattern-card"><h3>${esc(p.name)}</h3><p>${esc(p.description||'')}</p><span class="badge">参数：${esc(p.parameters||'内部参数')}</span></article>`).join('')||'<p>暂无形态规则。</p>';}
view('overview');
})().catch(()=>{const st=document.querySelector('#status');if(st)st.textContent='快照格式异常，请重新导出。';});
