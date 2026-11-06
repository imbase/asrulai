// V1 shell binding for the existing Mac UI. Never mutates chart descendants or data.
(()=>{'use strict';const $=s=>document.querySelector(s);
const paths={menu:'M4 6h16M4 12h16M4 18h16',market:'M3 17l5-5 4 3 8-10M15 5h5v5',leaders:'M12 3l2.8 5.7L21 9.6l-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z',strategies:'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',filter:'M4 5h16M7 12h10M10 19h4',chevron:'M9 5l7 7-7 7',close:'M6 6l12 12M18 6L6 18',search:'M21 21l-5.2-5.2M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',download:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',cloud:'M6 18h12a4 4 0 0 0 0-8 6 6 0 0 0-11.5-2A5 5 0 0 0 6 18Z',eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6'};
const icon=n=>`<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[n]}"/></svg>`;
document.body.classList.add('ui-preview');
const header=document.createElement('header');header.className='preview-global';header.innerHTML=`<div class="preview-brand"><a class="preview-wordmark" href="#"><span><span>asrulai</span><small>点 灯 人</small></span></a></div><div class="preview-account-slot"></div>`;document.body.prepend(header);
header.querySelector('a').onclick=e=>{e.preventDefault();$('.nav-item[data-view="intel"]').click();};
const rail=$('.sidebar'),nav=rail.querySelector('nav');nav.id='previewNavigation';nav.setAttribute('aria-label','全局导航');
for(const b of nav.querySelectorAll('.nav-item')){const name=b.textContent.trim().replace(/^[◉♢◎⌁◇⚙]\s*/,'');b.setAttribute('aria-label',name);b.title=name;b.textContent=name;}
header.insertBefore(nav,header.querySelector('.preview-account-slot'));header.querySelector('.preview-account-slot').append($('.sidebar-status'));rail.hidden=true;
function setup(){
 const menu=$('.quad-menu');if(!menu||$('#previewStrategyDrawer'))return;
 const table=$('#view-results .table-panel'),command=document.createElement('div');command.className='preview-command';
 command.innerHTML=`<div class="preview-command-top"><div class="preview-selection"><button id="previewStrategyToggle" aria-controls="previewStrategyDrawer" aria-expanded="false">${icon('menu')}<span>选择策略</span><span class="preview-strategy-number">12</span></button><div id="previewSelectionTitle"></div></div><div id="previewPagination"></div></div><div class="preview-command-bottom"><nav id="previewTabs" aria-label="研究结果模式"></nav><div id="previewTools"><label class="preview-search">${icon('search')}</label><button id="previewFilterToggle" aria-controls="previewFilters" aria-expanded="false">${icon('filter')}<span>筛选</span></button></div></div>`;
 table.prepend(command);$('#previewSelectionTitle').append($('#quadTitle'),$('#quadCount'));$('#previewPagination').append($('.quad-pager'));$('#previewTools .preview-search').append($('#resultSearch'));$('#resultSearch').setAttribute('aria-label','搜索股票代码或名称');
 // Relocate the original pager; keep its page calculations and handlers untouched.
 const pager=$('#previewPagination');pager.setAttribute('role','navigation');pager.setAttribute('aria-label','策略结果分页');table.append(pager);
 const charts=$('#quadCharts');let locatePending=false;
 const locateCards=()=>{
  if(!locatePending)return;
  window.scrollTo({top:window.scrollY+charts.getBoundingClientRect().top-8,behavior:'instant'});
  const dates=[...charts.querySelectorAll('.c1-local-date')];
  if(!charts.querySelector('.c1-stock-card')||(dates.length&&dates.every(x=>!x.textContent.includes('正在读取'))))locatePending=false;
 };
 const pageResize=new ResizeObserver(locateCards);pageResize.observe(charts);
 new MutationObserver(()=>{if(locatePending)requestAnimationFrame(locateCards);}).observe(charts,{childList:true,subtree:true,characterData:true});
 for(const button of pager.querySelectorAll('button'))button.addEventListener('click',()=>{
  // Only position the outer scroller after the original synchronous page handler.
  locatePending=true;requestAnimationFrame(locateCards);
 });
 const advanced=$('.result-more');if(advanced)$('#previewTools').append(advanced);
 const filters=$('.quad-filters');filters.id='previewFilters';filters.open=false;command.after(filters);$('#previewFilterToggle').onclick=()=>{filters.open=!filters.open;$('#previewFilterToggle').setAttribute('aria-expanded',String(filters.open));};
 const tabs=$('#previewTabs');tabs.setAttribute('role','tablist');
 for(const b of menu.querySelectorAll('[data-mode]')){b.textContent=b.dataset.mode==='pool'?'自选池':'策略结果';b.setAttribute('role','tab');tabs.append(b);}
 // Moving the original buttons preserves identity; delegate to the original menu handler.
 tabs.onclick=e=>{if(e.target.closest('button')){menu.onclick(e);syncTabs();}};
 const drawer=document.createElement('aside');drawer.id='previewStrategyDrawer';drawer.setAttribute('aria-label','策略选择抽屉');drawer.innerHTML=`<header><h2>选择策略 <span>12</span></h2><button id="previewDrawerClose" aria-label="收起策略抽屉">${icon('close')}</button></header>`;drawer.append(menu);command.append(drawer);
 const scrim=document.createElement('button');scrim.className='preview-scrim';scrim.setAttribute('aria-label','关闭策略抽屉');scrim.hidden=true;document.body.append(scrim);
 const setDrawer=open=>{document.body.classList.toggle('preview-drawer-open',open);$('#previewStrategyToggle').setAttribute('aria-expanded',String(open));scrim.hidden=true;drawer.inert=!open;};setDrawer(false);
 $('#previewStrategyToggle').onclick=()=>setDrawer(!document.body.classList.contains('preview-drawer-open'));$('#previewDrawerClose').onclick=scrim.onclick=()=>setDrawer(false);
 let index=0;for(const b of menu.querySelectorAll('[data-strategy]')){const name=b.textContent;b.setAttribute('aria-label',name);b.innerHTML=`<span class="preview-strategy-index" aria-hidden="true">${String(++index).padStart(2,'0')}</span><span>${name}</span>${icon('chevron')}`;}
 menu.addEventListener('click',e=>{if(e.target.closest('button')){setDrawer(false);syncTabs();}});
 function syncTabs(){const pool=$('#quadTitle').textContent==='自选池';for(const b of tabs.children){const active=(b.dataset.mode==='pool')===pool;b.classList.toggle('active',active);b.setAttribute('aria-selected',String(active));}}
 new MutationObserver(syncTabs).observe($('#quadTitle'),{childList:true,subtree:true});syncTabs();
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){setDrawer(false);$('#previewStrategyToggle').focus();}});
 document.addEventListener('click',e=>{if(!drawer.contains(e.target)&&!$('#previewStrategyToggle').contains(e.target))setDrawer(false);});
 document.querySelectorAll('.nav-item').forEach(b=>b.addEventListener('click',()=>setDrawer(false)));
 // The existing two-card grid stays intact inside its own scrollable viewport.
 const region=$('#strategyQuad');region.tabIndex=0;region.setAttribute('role','region');region.setAttribute('aria-label','双列K线结果，可左右滚动');
 const hint=document.createElement('div');hint.className='preview-scroll-help';hint.hidden=true;hint.innerHTML='<span>窗口较窄，可左右滚动查看完整双列K线</span><button type="button" aria-label="结果向左滚动">← 向左</button><button type="button" aria-label="结果向右滚动">向右 →</button>';region.before(hint);
 const [left,right]=hint.querySelectorAll('button');left.onclick=()=>region.scrollBy({left:-500,behavior:'smooth'});right.onclick=()=>region.scrollBy({left:500,behavior:'smooth'});
 const syncScroll=()=>{hint.hidden=region.scrollWidth<=region.clientWidth+1;left.disabled=region.scrollLeft<=1;right.disabled=region.scrollLeft+region.clientWidth>=region.scrollWidth-1;};
 new ResizeObserver(syncScroll).observe(region);region.addEventListener('scroll',syncScroll,{passive:true});syncScroll();
}
const observer=new MutationObserver(()=>{if($('.quad-menu')){setup();observer.disconnect();}});observer.observe($('#view-results'),{childList:true,subtree:true});setup();
})();
