(() => {
 const $=s=>document.querySelector(s);
 const techs=[
 ['vr','VR','虚拟现实','月面考察','LUNAR EXPEDITION','去月面，走近航天服。','选择落点，再拖动画面环顾四周。你移动的是视点，不是展品。','浏览器三维漫游；头显体验还需要双目显示与空间追踪。','VR 通过实时渲染建立虚拟环境。这里可以切换位置、转动视线，观察透视和遮挡随视点变化。'],
 ['ar','AR','增强现实','家具试摆','ROOM PLANNER','这把椅子，放哪里？','放入椅子后，直接拖动摆放；再调整朝向和布料颜色。','真实室内摄影与三维家具合成，未调用摄像头或实时空间识别。','AR 将数字物体与现实空间对齐。这里按摄影透视匹配虚拟地面，演示放置、移动和尺度关系；实际设备还需要空间跟踪。'],
 ['mr','MR','混合现实','展品遮挡','MUSEUM OVERLAY','让展品经过墙后。','让头盔从展墙前移到墙后，对比深度遮挡开关。','预建展厅模拟环境深度，不是实时扫描的现实空间。','MR 让环境几何参与深度计算。虚拟展品应当被前方的真实墙体挡住，才能建立可信的空间关系。'],
 ['pano','360°','全景漫游','机场观察','AIRPORT LOOKOUT','换个方向，看看机场现场。','拖动环视，点击方向点快速定位；用加减按钮调整视野。','摄影：Greg Zaal / Poly Haven · Rostock-Laage Airport · CC0。','球面全景把摄影映射到球体内侧。可以从固定拍摄点环视，缩放视野；不能像三维场景一样自由走动。'],
 ['twin','DT','数字孪生','发动机监测','ENGINE MONITOR','负载变了，温度呢？','启动发动机、增加负载，再切断冷却，观察温度和过热保护。','教学模拟数据，未连接真实发动机，不代表真实设备参数。','数字孪生把具体对象、运行数据与数字模型关联。这里以模拟负载和冷却状态驱动转速、温度与故障保护。'],
 ['sim','SIM','虚拟仿真','机器人巡检','ROBOT INSPECTION','开始一次安全巡检。','关闭检修门、解除急停后启动。途中可按下急停，修正后再继续。','安全联锁与任务流程的概念演示，不是工业机器人操作规程。','虚拟仿真把任务流程与条件约束放进可重复的环境。门禁、急停与任务状态一起决定机器人能否行动。']
 ];
 const defaults=()=>({mode:'vr',view:'landing',yaw:0,pitch:0,orbit:false,placed:false,x:0,z:0,rotation:0,fabric:'copper',depth:0,occlusion:true,load:35,cooling:true,running:false,temperature:26,trip:false,gate:false,armed:false,task:'idle',progress:0});
 const state=defaults(); let viewer,panoReady=false,clock=0,history=[];
 const icons=()=>window.lucide?.createIcons();
 const btn=(action,text)=>`<button class="action" data-action="${action}">${text}</button>`;
 const choices=(key,items)=>`<div class="segmented">${items.map(([v,t])=>`<button data-key="${key}" data-value="${v}" aria-pressed="${String(state[key])===String(v)}">${t}</button>`).join('')}</div>`;
 const range=(name,key,min,max,unit)=>`<label class="range-control">${name}<input type="range" aria-label="${name}" data-range="${key}" min="${min}" max="${max}" value="${state[key]}"><output data-output="${key}">${state[key]}${unit}</output></label>`;
 const check=(key,label)=>`<label class="toggle"><input type="checkbox" data-check="${key}" ${state[key]?'checked':''}>${label}</label>`;
 function announce(text){$('#stage-status').textContent=text;}
 function emit(reset=false){document.dispatchEvent(new CustomEvent('xr:change',{detail:{reset}}));}
 function controls(){
  let h='',a='';
  if(state.mode==='vr') {h=choices('view',[['landing','着陆点'],['suit','走近航天服'],['ridge','登上山脊']]);a='<span class="gesture-hint">拖动环顾</span>';}
  if(state.mode==='ar')h=btn('place',state.placed?'移除椅子':'放入椅子')+range('朝向','rotation',-180,180,'°')+choices('fabric',[['copper','赤陶'],['blue','靛蓝'],['cream','暖白']]);
  if(state.mode==='mr')h=choices('depth',[[0,'展墙前'],[100,'展墙后']])+range('沿轨道移动','depth',0,100,'%')+check('occlusion','深度遮挡');
  if(state.mode==='pano'){h=choices('panoView',[[0,'入口大厅'],[90,'右侧通道'],[180,'回望展区']]);a='<button class="icon-button" data-action="pano-in" aria-label="放大全景">＋</button><button class="icon-button" data-action="pano-out" aria-label="缩小全景">−</button>';}
  if(state.mode==='twin')h=btn('engine',state.running?'停止发动机':'启动发动机')+range('发动机负载','load',0,100,'%')+check('cooling','冷却系统');
  if(state.mode==='sim')h=check('gate','检修门已关闭')+check('armed','急停已解除')+btn('mission',state.task==='paused'?'继续巡检':state.task==='done'?'再次巡检':'开始巡检')+'<button class="emergency" data-action="stop">急停</button>';
  if(['twin','sim','mr'].includes(state.mode))a='<span class="gesture-hint">拖动旋转 · 方向键微调</span>'+btn('orbit',state.orbit?'停止环绕':'自动环绕')+btn('view-reset','复位视角');
  $('#lab-controls').innerHTML=h;$('#stage-actions').innerHTML=a;icons();
 }
 function pano(){
  if(viewer){viewer.resize();viewer.setYaw(0,0);viewer.setPitch(0,0);viewer.setHfov(100,0);return;}
  viewer=pannellum.viewer('panorama',{type:'equirectangular',panorama:'video/source/panorama.jpg',autoLoad:true,hfov:100,minHfov:45,maxHfov:115,showControls:false,mouseZoom:false,keyboardZoom:false,strings:{loadingLabel:'正在载入机场全景'}});
  viewer.on('load',()=>{panoReady=true;announce('固定拍摄点 · 拖动环视');});
  viewer.on('error',()=>announce('全景载入失败，请重置重试'));
 }
 function select(id){
  const t=techs.find(x=>x[0]===id);if(!t)return;
  Object.assign(state,defaults(),{mode:id});history=[];clock=0;
  $('#case-kicker').textContent=t[4];$('#case-title').textContent=t[5];$('#case-description').textContent=t[6];$('#case-note').textContent=t[7];$('#case-principle').textContent=t[8];$('#stage-label').textContent=t[3];
  $('#lab-stage').dataset.mode=id;$('#experiments').dataset.active=id;$('#lab-panel').setAttribute('aria-labelledby','tab-'+id);$('#telemetry').hidden=id!=='twin';$('#panorama').hidden=id!=='pano';$('#lab-canvas').hidden=id==='pano';$('#lab-panel').querySelectorAll('details').forEach(d=>d.open=false);
  document.querySelectorAll('[data-tech]').forEach(b=>{const on=b.dataset.tech===id;b.setAttribute('aria-selected',on);b.tabIndex=on?0:-1;});
  setCaseVideo(t);controls();announce({vr:'着陆点 · 拖动环顾',ar:'点击「放入椅子」，然后拖动摆放',mr:'头盔位于展墙前方',pano:'正在进入机场',twin:'发动机已停止 · 26°C',sim:'等待准备 · 关闭检修门并解除急停'}[id]);
  if(id==='twin')telemetry();if(id==='pano')pano();emit(true);
 }
 function setCaseVideo(t){
  const v=$('#case-video'),id=t[0],dur={vr:15,ar:17,mr:16,pano:16,twin:22,sim:21}[id];
  const revision=id==='vr'?'emu10':'4';v.pause();v.src='film/demos/'+id+'.mp4?v='+revision;v.poster='film/demos/'+id+'-poster.jpg?v='+revision;
  v.setAttribute('aria-label',t[3]+'操作演示');
  v.replaceChildren();const track=document.createElement('track');track.kind='captions';track.label='中文（画面已含字幕）';track.srclang='zh';track.src='film/demos/'+id+'.vtt';v.append(track);v.load();
  $('#case-film-title').textContent=t[3]+' · 操作演示';$('#case-film-time').textContent='00:'+dur;
  $('#case-video-download').href='film/demos/'+id+'.mp4?v='+revision;
 }
 $('#case-film').addEventListener('toggle',()=>{if(!$('#case-film').open)$('#case-video').pause();});
 document.querySelectorAll('video').forEach(v=>v.addEventListener('play',()=>document.querySelectorAll('video').forEach(other=>{if(other!==v)other.pause();})));
 document.addEventListener('visibilitychange',()=>{if(document.hidden)document.querySelectorAll('video').forEach(v=>v.pause());});
 function update(key,value){
  state[key]=value;
  if(key==='view'){state.yaw=0;state.pitch=0;announce({landing:'着陆点 · 拖动环顾',suit:'航天服近景 · 拖动环顾',ridge:'山脊视点 · 拖动环顾'}[value]);}
  if(key==='depth'||key==='occlusion')announce(!state.occlusion?'遮挡关闭 · 展品透过墙体显示':state.depth>65?'展品位于墙后 · 下部被墙遮挡':'沿轨道移动 · 观察前后关系');
  if(key==='fabric'||key==='rotation')announce('椅子已更新 · 拖动椅子调整位置');
  if((key==='gate'||key==='armed')&&state.task==='running'&&(!state.gate||!state.armed)){state.task='paused';announce('巡检暂停 · 请关闭检修门并解除急停');controls();}
  const o=$('[data-output="'+key+'"]');if(o)o.textContent=Math.round(value)+(key==='rotation'?'°':'%');
  const r=$('[data-range="'+key+'"]');if(r)r.value=value;
  document.querySelectorAll('[data-key="'+key+'"]').forEach(b=>b.setAttribute('aria-pressed',String(value)===b.dataset.value));emit();
 }
 $('#tech-tabs').innerHTML=techs.map((t,i)=>`<button class="tech-tab" id="tab-${t[0]}" role="tab" aria-controls="lab-panel" aria-selected="false" tabindex="-1" data-tech="${t[0]}"><span class="tab-top">${t[1]}<small>0${i+1}</small></span><span class="tab-name">${t[2]}</span><span class="tab-case">${t[3]}</span></button>`).join('');
 $('#tech-tabs').onclick=e=>{const b=e.target.closest('[data-tech]');if(b)select(b.dataset.tech);};
 $('#tech-tabs').onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;const tabs=[...document.querySelectorAll('[data-tech]')],i=tabs.indexOf(document.activeElement);if(i<0)return;e.preventDefault();const n=e.key==='Home'?0:e.key==='End'?5:(i+(e.key==='ArrowRight'?1:5))%6;select(tabs[n].dataset.tech);tabs[n].focus();};
 $('#lab-controls').oninput=e=>{if(e.target.dataset.range)update(e.target.dataset.range,Number(e.target.value));};
 $('#lab-controls').onchange=e=>{if(e.target.dataset.check)update(e.target.dataset.check,e.target.checked);};
 $('#lab-panel').onclick=e=>{
  const c=e.target.closest('[data-key]');if(c){const {key,value}=c.dataset;if(key==='panoView'){if(panoReady){viewer.setYaw(+value,350);update(key,+value);announce(c.textContent+' · 固定拍摄点');}}else update(key,key==='depth'?+value:value);}
  const a=e.target.closest('[data-action]')?.dataset.action;if(!a)return;
  if(a==='orbit'){state.orbit=!state.orbit;controls();}
  if(a==='view-reset'){state.yaw=0;state.pitch=0;state.orbit=false;controls();}
  if(a==='place'){state.placed=!state.placed;state.x=0;state.z=0;controls();announce(state.placed?'拖动椅子摆放 · 按方向键也可移动':'椅子已移除');}
  if(a==='engine'){if(state.trip&&state.temperature>65){announce('温度过高 · 开启冷却，降至 65°C 后再启动');return;}state.trip=false;state.running=!state.running;controls();announce(state.running?'发动机运行中 · 调节负载观察变化':'发动机已停止');}
  if(a==='mission'){
   if(!state.gate||!state.armed){announce(!state.gate?'不能启动 · 请先关闭检修门':'不能启动 · 请先解除急停');return;}
   if(state.task==='running')return;if(state.task!=='paused')state.progress=0;state.task='running';controls();announce('巡检进行中 · 可随时按下急停');
  }
  if(a==='stop'){state.armed=false;if(state.task==='running')state.task='paused';controls();announce('急停已触发 · 机器人停止');}
  if(panoReady&&a.startsWith('pano-'))viewer.setHfov(Math.max(45,Math.min(115,viewer.getHfov()+(a==='pano-in'?-15:15))),300);
  emit();
 };
 $('#lab-reset').onclick=()=>{if(state.mode==='pano'&&!panoReady){viewer?.destroy();viewer=null;}select(state.mode);};
 document.querySelectorAll('[data-jump]').forEach(b=>b.onclick=()=>{select(b.dataset.jump);$('#experiments').scrollIntoView({behavior:'smooth'});});
 $('#sources-open').onclick=()=>$('#sources').showModal();$('#sources-close').onclick=()=>$('#sources').close();
 function telemetry(){
  $('#rpm').innerHTML=(state.running?Math.round(700+state.load*35):0)+' <em>rpm</em>';$('#temperature').innerHTML=state.temperature.toFixed(1)+' <em>°C</em>';$('#machine-status').textContent=state.trip?'过热保护':state.running?'运行中':'已停止';$('#machine-status').style.color=state.trip?'#ff775d':'#a5d7ff';
  history.push(state.temperature);if(history.length>70)history.shift();const c=$('#chart').getContext('2d');c.clearRect(0,0,300,90);c.strokeStyle='#ff855c';c.lineWidth=3;c.beginPath();history.forEach((v,i)=>{const x=i*300/69,y=85-(v-20)*.9;i?c.lineTo(x,y):c.moveTo(x,y);});c.stroke();
 }
 function tick(dt){
  if(state.mode==='twin'){
   const target=state.running?state.cooling?35+state.load*.30:70+state.load*.8:26;
   state.temperature+=(target-state.temperature)*Math.min(1,dt*(state.cooling?.5:.22));
   if(state.running&&state.temperature>=90){state.running=false;state.trip=true;controls();announce('过热保护 · 发动机停机，开启冷却后等待降温');}
   clock+=dt;if(clock>.15){clock=0;telemetry();}
  }
  if(state.mode==='sim'&&state.task==='running'){
   state.progress=Math.min(1,state.progress+dt/9);
   if(state.progress===1){state.task='done';controls();announce('巡检完成 · 三个检查点全部通过');}
  }
 }
 window.XRLab={state,select,update,tick,refreshTelemetry:telemetry,getPanorama:()=>viewer,announce};select('vr');icons();
})();
