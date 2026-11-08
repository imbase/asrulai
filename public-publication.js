/* Show publication metadata for the current view. */
(async()=>{
  const snapshot=await RadarDB.snapshot();
  function apply(){
    const active=document.querySelector('.view.active');if(!active)return;
    let note=active.querySelector(':scope > .publication-notice');
    if(!note){note=document.createElement('p');note.className='publication-notice';active.append(note);}
    note.textContent=`公开快照 ${snapshot.snapshotVersion} · 行情截至 ${snapshot.marketDate||'未知'} · 主报告 ${snapshot.source?.reportMarketDate||'未知'} · 最近成功发布 ${snapshot.publication.publishedAt}`;
  }
  const observer=new MutationObserver(()=>requestAnimationFrame(apply));
  // Observe route switches, not our own text mutations.
  document.querySelectorAll('.view').forEach(v=>observer.observe(v,{attributes:true,attributeFilter:['class']}));
  document.addEventListener('click',()=>setTimeout(apply,0));setTimeout(apply,500);apply();
})();
