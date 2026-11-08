(function(){
  const html = document.querySelector('#view-intel');
  const $ = s => html.querySelector(s);
  var $$=function(s){return Array.prototype.slice.call(html.querySelectorAll(s))};
  var KEY='asrulai_lit_20261108c';
  var MOTION='asrulai_motion_off';

  /* ===== 五幕时间线（10 秒）=====
     开场：墨起 0–0.5s → 绽放 0.5–5.6s → 吐金 5.8s 起 → 汇聚 → 仪器上线 9.2–10s
     点花同步：收拢同步 0–1.5s（表盘旋转）→ 绽放 1.5–6.6s → 吐金 → 汇聚 → 收尾  */
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  function readPreference(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  }
  var motionOff=function(){ return readPreference(MOTION)==='1'; };
  var syncBtn=$('#syncBtn');
  var syncMode=false;
  var cv=$('#fx'), ctx=cv.getContext('2d');
  var dpr=Math.min(window.devicePixelRatio||1,2);

  function sizeCv(){
    cv.width=innerWidth*dpr; cv.height=innerHeight*dpr;
    cv.style.width=innerWidth+'px'; cv.style.height=innerHeight+'px';
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  window.addEventListener('resize',()=>{if(running) sizeCv();});

  var running=false;
  var weak=navigator.hardwareConcurrency&&navigator.hardwareConcurrency<=4;
  var TEXT_N=weak?4:6, DUST_N=weak?40:72;

  var litSet={};

  function flowerCenter(){
    var r=$('.flower-img').getBoundingClientRect();
    return {x:r.left+r.width*.5, y:r.top+r.height*.46};
  }
  function quad(p0,p1,p2,t){
    var u=1-t;
    return {x:u*u*p0.x+2*u*t*p1.x+t*t*p2.x, y:u*u*p0.y+2*u*t*p1.y+t*t*p2.y};
  }
  function lit(el){
    if(!el||litSet[el.dataset.litId]) return;
    litSet[el.dataset.litId]=1;
    el.classList.add('on');
    try{ if(navigator.vibrate) navigator.vibrate(6); }catch(e){}
  }

  var particles=[], T0=0;

  function spawn(){
    var c=flowerCenter();
    var targets=$$('[data-lit]');
    targets.forEach(function(el,i){ el.dataset.litId=i; });
    const pool = targets.map(el => el.textContent.trim()).filter(text => /[0-9]/.test(text));
    var pi=0;

    function make(target,text){
      var ang=Math.random()*Math.PI*2;
      var dist=(text?220:160)+Math.random()*(text?260:230);
      var out={x:c.x+Math.cos(ang)*dist, y:c.y+Math.sin(ang)*dist*.85};
      var hold=(text?.1:.05)+Math.random()*.2;
      var end=null;
      if(target){
        var r=target.getBoundingClientRect();
        end={x:r.left+r.width/2, y:r.top+r.height/2};
      }
      var ap=end?{x:end.x+(Math.random()*280-140), y:end.y-110-Math.random()*160} : {x:out.x+(Math.random()*240-120), y:out.y+(Math.random()*240-240)};
      particles.push({
        text:text, size:text?(11+Math.random()*3.5):(1.4+Math.random()*1.6),
        t0:5800+Math.random()*700,
        burstDur:text?(650+Math.random()*260):(850+Math.random()*440),
        hold:hold, gDur:text?(1150+Math.random()*420):(0),
        out:out, ap:ap, end:end, targetEl:target||null,
        delayG:end?(Math.random()*1100):0,
        curve:text?(.3+Math.random()*.4):.18,
        alpha:0, dead:false
      });
      pi++;
    }

    targets.forEach(function(el){
      if (!el.getClientRects().length || el.getBoundingClientRect().top > innerHeight + 200) return;
      for(var k=0;k<TEXT_N;k++) make(el, pool[(pi+k*3)%pool.length] || '·');
    });
    for(var d=0;d<DUST_N;d++) make(null,null);
  }

  var platesOn=false;
  function frame(now){
    if(!running) return;
    if (!html.classList.contains('active')) { finish(); return; }
    if(!T0) T0=now;
    var el=now-T0;

    if(el>=(syncMode?1500:500)){                        /* 同步完成 / 墨起：花瓣逐层晕开 */
      html.classList.remove('fold');
      html.classList.remove('syncing');
    }
    if(el>=5600) html.classList.add('solid');            /* 四层花瓣交棒给完整单图 */
    if(el>=5800 && !platesOn){                           /* 板块依次升起 */
      platesOn=true;
      $$('.plate').forEach(function(p,i){
        p.style.setProperty('--briefing-delay', (500+i*180)+'ms');
        p.classList.add('on');
      });
    }
    if(el>=5800 && particles.length===0) spawn();        /* 吐金 */

    ctx.clearRect(0,0,innerWidth,innerHeight);
    var allDead=true;
    for(var i=0;i<particles.length;i++){
      var p=particles[i];
      if(p.dead) continue;
      var lt=el-p.t0;
      if(lt<0){ allDead=false; continue; }
      var pos, alpha=0;
      if(lt<p.burstDur){                                /* 第一段：从花心迸出 */
        var u=lt/p.burstDur, e=1-Math.pow(1-u,3);
        var start=flowerCenter();
        pos=quad(start, {x:(start.x+p.out.x)/2+(p.out.y-start.y)*p.curve, y:(start.y+p.out.y)/2-(p.out.x-start.x)*p.curve}, p.out, e);
        alpha=Math.min(1,lt/160);
      } else if(lt<p.burstDur+p.hold){                  /* 悬停 */
        pos=p.out; alpha=1;
      } else if(p.end){                                 /* 第二段：汇聚入位 */
        var gt=lt-p.burstDur-p.hold-p.delayG;
        if(gt<0){ pos=p.out; alpha=1; }
        else{
          var v=Math.min(1,gt/p.gDur), ee=v<.5?2*v*v:1-Math.pow(-2*v+2,2)/2;
          pos=quad(p.out, p.ap, p.end, ee);
          alpha=v>.9?(1-v)*10:1;
          if(v>=1){ p.dead=true; lit(p.targetEl||null); continue; }
        }
      } else {                                          /* 自由尘：飘散熄灭 */
        var ft=(lt-p.burstDur-p.hold)/1300;
        if(ft>=1){ p.dead=true; continue; }
        pos={x:p.out.x+(p.ap.x-p.out.x)*ft, y:p.out.y+(p.ap.y-p.out.y)*ft+ft*ft*40};
        alpha=1-ft;
        allDead=false;
    }
      if(p.dead) continue;
      allDead=false;
      ctx.globalAlpha=Math.max(0,Math.min(1,alpha));
      if(p.text){
        ctx.font='600 '+p.size+'px ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace';
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.shadowColor='rgba(176,138,46,.45)'; ctx.shadowBlur=6;
        ctx.fillStyle='#B08A2E';
        ctx.fillText(p.text,pos.x,pos.y);
        ctx.shadowBlur=0;
      }else{
        ctx.fillStyle='#B08A2E';
        ctx.beginPath(); ctx.arc(pos.x,pos.y,p.size,0,6.2832); ctx.fill();
      }
    }
    ctx.globalAlpha=1;

    if(el>=9200) litTargetsFallback();
    if(el>=10000 || (el>9600 && allDead)){ finish(); return; }
    requestAnimationFrame(frame);
  }

  /* 兜底：粒子未覆盖到的目标，仪器上线时全部点亮 */
  var fbDone=false;
  function litTargetsFallback(){
    if(fbDone) return; fbDone=true;
    $$('[data-lit]').forEach(function(el){ el.classList.add('on'); });
  }

  function finish(){
    if(!running) return;
    running=false;
    html.classList.remove('cer','fold','syncing','solid');
    $$('[data-lit]').forEach(function(el){ el.classList.add('on'); });
    $$('.plate').forEach(function(p){ p.classList.add('on'); });
    ctx.clearRect(0,0,innerWidth,innerHeight);
    document.body.classList.remove('briefing-ceremony');
    cv.width=cv.height=1;
    $('#skip').disabled=true;
    syncBtn.disabled=false;
    syncBtn.textContent='↻ 更新最新交易日数据';
    try{localStorage.setItem(KEY,'1')}catch(e){}
  }

  function onSkip(e){
    var t=e.target;
    if(t?.closest('#skip, #replay, #flower')) return;
    finish();
  }
  window.addEventListener('pointerdown',onSkip,true);

  /* 点花同步动画在现有刷新成功后开始。 */
  function startCeremony(sync){
    if(running || motion.matches || motionOff() || !html.classList.contains('active')) return;
    sizeCv();
    $('#skip').disabled=false;
    syncMode=!!sync;
    particles.length=0; litSet={}; fbDone=false; platesOn=false; T0=0;
    $$('.plate').forEach(function(p){ p.classList.remove('on'); });
    $$('[data-lit]').forEach(function(el){ el.classList.remove('on'); });
    running=true;
    document.body.classList.add('briefing-ceremony');
    html.classList.add('cer','fold');
    if(syncMode){
      html.classList.add('syncing');
      syncBtn.disabled=true;
      syncBtn.textContent='同步中 ···';
    }
    requestAnimationFrame(frame);
  }

  $('#skip').onclick=finish;
  $('#skip').disabled=true;
  $('#replay').onclick=()=>startCeremony(false);
  motion.addEventListener('change',e=>{if(e.matches) finish();});
  function requestRefresh(){
    if (!running && !$('#refreshIntelBtn').disabled) $('#refreshIntelBtn').click();
  }
  syncBtn.onclick=requestRefresh;
  $('.flower-hit').onclick=requestRefresh;
  document.addEventListener('radar:briefing-refreshed',()=>startCeremony(true));

  const nav=$('.sidenav'), handle=$('.side-tab');
  function openNav(open){
    html.classList.toggle('briefing-nav-open',open);
    handle.setAttribute('aria-expanded',String(open));
  }
  nav.addEventListener('mouseenter',()=>openNav(true));
  nav.addEventListener('mouseleave',()=>openNav(nav.contains(document.activeElement)));
  nav.addEventListener('focusin',()=>openNav(true));
  nav.addEventListener('focusout',e=>{if(!nav.contains(e.relatedTarget)) openNav(false);});
  handle.onclick=()=>openNav(true);

  const settings=document.querySelector('#view-settings');
  const controls=document.createElement('div');
  controls.className='cine-settings-controls';
  controls.innerHTML='<label><input type="checkbox" id="cineMotion"> 开场点灯仪式</label><label><input type="checkbox" id="cineCompact"> 紧凑密度</label>';
  settings.prepend(controls);
  const motionControl=controls.querySelector('#cineMotion');
  motionControl.checked=!motionOff();
  const drawer = $('#briefingPreferences'), motionSwitch = $('#briefingMotion');
  function setMotion(enabled){
    try{localStorage.setItem(MOTION,enabled?'0':'1');}catch{}
    motionControl.checked=enabled;
    motionSwitch.setAttribute('aria-checked',String(enabled));
    if(!enabled) finish();
  }
  motionSwitch.setAttribute('aria-checked',String(motionControl.checked));
  motionSwitch.onclick=()=>setMotion(motionSwitch.getAttribute('aria-checked')!=='true');
  motionControl.onchange=()=>setMotion(motionControl.checked);
  $('#briefingSettings').onclick=()=>drawer.showModal();
  drawer.querySelector('[data-home-go]').addEventListener('click',()=>drawer.close());
  drawer.addEventListener('click',event=>{if(event.target===drawer) drawer.close();});
  controls.querySelector('#cineCompact').onchange=e=>document.body.classList.toggle('compact',e.target.checked);

  const syncView=()=>{
    const active=html.classList.contains('active') && !html.hidden;
    document.body.classList.toggle('c1-market-view',active);
    if(!active){finish();openNav(false);}
  };
  new MutationObserver(syncView).observe(html,{attributes:true,attributeFilter:['class','hidden']});
  syncView();
  let refreshed = false;
  try {
    refreshed = sessionStorage.getItem('asrulai_briefing_refreshed') === '1';
    sessionStorage.removeItem('asrulai_briefing_refreshed');
  } catch {}
  if (refreshed) startCeremony(true);
  else if (!readPreference(KEY)) startCeremony(false);
})();
