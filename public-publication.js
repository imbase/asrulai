/* Publication metadata and explicit permission differences; no market/strategy computation. */
(async()=>{
  const snapshot=await RadarDB.snapshot();window.RadarPublication=snapshot;
  const labels={strategyResults:'策略名单',dailyBars:'日K',quotes:'行情报价',heatmaps:'板块报价',leaders:'龙头结果',metals:'金银比',news:'新闻',coverage:'覆盖统计'};
  function apply(){
    const active=document.querySelector('.view.active');if(!active)return;
    let note=active.querySelector(':scope > .publication-notice');
    if(!note){note=document.createElement('p');note.className='publication-notice';active.append(note);}
    const restricted=Object.keys(labels).filter(k=>snapshot.permissions[k]==='RESTRICTED');
    note.textContent=`公开快照 ${snapshot.snapshotVersion} · 行情截至 ${snapshot.marketDate||'未知'} · 主报告 ${snapshot.source.reportMarketDate||'未知'} · 最近成功发布 ${snapshot.publication.publishedAt}`+(restricted.length?`。未确认公开展示许可：${restricted.map(k=>labels[k]).join('、')}；相关数据未上传。`:'');
    const status=document.querySelector('#quadStatus');
    if(status&&snapshot.permissions.strategyResults==='RESTRICTED')status.textContent='策略名单未公开（许可未确认），不是零命中。';
    if(snapshot.permissions.coverage==='RESTRICTED')for(const id of ['mUniverse','mWithData','mBars','mReady','mQualified','aUniverse','aWithData','aReady','aBars','coveragePct','msProgress']){const el=document.getElementById(id);if(el)el.textContent='未公开';}
    if(snapshot.permissions.strategyResults==='RESTRICTED'){
      const summary=document.getElementById('resultSummary');if(summary)summary.textContent='名单及数量未公开；策略筛选只在正式雷达执行。';
      const count=document.getElementById('quadCount');if(count)count.textContent='未公开 · 日K · 1 行 × 2 列';
    }
    if(snapshot.permissions.dailyBars==='RESTRICTED')for(const card of document.querySelectorAll('#intelStrategyStocks .c1-stock-card')){let note=card.querySelector('.bar-permission');if(!note){note=document.createElement('p');note.className='bar-permission';note.textContent='日K未公开：数据展示许可未确认';card.append(note);}}
  }
  const observer=new MutationObserver(()=>requestAnimationFrame(apply));
  // Observe route switches, not our own text mutations.
  document.querySelectorAll('.view').forEach(v=>observer.observe(v,{attributes:true,attributeFilter:['class']}));
  document.addEventListener('click',()=>setTimeout(apply,0));setTimeout(apply,500);apply();
})();
