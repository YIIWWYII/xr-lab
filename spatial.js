import * as T from './assets/three.module.js';
import {GLTFLoader} from './assets/three-addons/GLTFLoader.js';
import {mergeGeometries} from './assets/three-addons/BufferGeometryUtils.js';
import {RoomEnvironment} from './assets/three-addons/RoomEnvironment.js';
const host=document.querySelector('#lab-canvas'),heroHost=document.querySelector('#hero-scene'),state=XRLab.state;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const loader=new GLTFLoader(),cache=new Map(),scenes=new Map();let active,hero,visible=false,heroVisible=true,paused=reduced.matches,queued=false,last=0,renderTime=0,heroTime=0,token=0,frameCount=0,dirty=true;
const heroDrift={x:0,y:0},heroTarget={x:0,y:0};
let effectUntil=0,heroMode="vr",heroToken=0,heroTimer,heroLast=0;const heroCamera=camera();
const stats={samples:[],draws:0,triangles:0};
function renderer(el){const r=new T.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});r.setPixelRatio(Math.min(devicePixelRatio,1.25));r.outputColorSpace=T.SRGBColorSpace;r.toneMapping=T.ACESFilmicToneMapping;r.toneMappingExposure=.85;el.append(r.domElement);return r;}
const render=renderer(host),hr=renderer(heroHost);
const pm=new T.PMREMGenerator(render),room=new RoomEnvironment(),environment=pm.fromScene(room,.08).texture;room.dispose();pm.dispose();
function material(c,rough=.65,metal=0){return new T.MeshStandardMaterial({color:c,roughness:rough,metalness:metal});}
function mesh(g,m,parent,x=0,y=0,z=0){const o=new T.Mesh(g,m);o.position.set(x,y,z);parent.add(o);return o;}
function box(parent,w,h,d,c,x=0,y=0,z=0){return mesh(new T.BoxGeometry(w,h,d),material(c),parent,x,y,z);}
function cylinder(parent,r,h,c,x=0,y=0,z=0){return mesh(new T.CylinderGeometry(r,r,h,40),material(c,.35,.45),parent,x,y,z);}
function lightScene(bg){const s=new T.Scene();if(bg)s.background=new T.Color(bg);s.environment=environment;s.environmentIntensity=.65;s.add(new T.HemisphereLight(0xe4e9ff,0x312334,.8));const k=new T.DirectionalLight(0xffe8d1,2);k.position.set(-4,7,5);s.add(k);const r=new T.DirectionalLight(0x9ebcff,1.4);r.position.set(4,3,-3);s.add(r);return s;}
async function asset(path){
 if(!cache.has(path))cache.set(path,loader.loadAsync(path).then(g=>{
  const seen=new Set();g.scene.traverse(o=>{if(!o.isMesh)return;o.frustumCulled=true;for(const m of Array.isArray(o.material)?o.material:[o.material])for(const v of Object.values(m))if(v?.isTexture&&!seen.has(v)){seen.add(v);const im=v.image;if(im?.width>1024||im?.height>1024){const c=document.createElement('canvas'),k=1024/Math.max(im.width,im.height);c.width=Math.round(im.width*k);c.height=Math.round(im.height*k);c.getContext('2d').drawImage(im,0,0,c.width,c.height);v.image=c;v.needsUpdate=true;}}});return g;}));
 return cache.get(path);
}
function normalized(obj,height){const g=new T.Group();g.add(obj);const b=new T.Box3().setFromObject(obj),size=b.getSize(new T.Vector3()),c=b.getCenter(new T.Vector3()),k=height/size.y;obj.scale.multiplyScalar(k);obj.position.set(-c.x*k,-b.min.y*k,-c.z*k);return g;}
function shadow(parent,x,z,scale=1){const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d'),g=ctx.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'#0009');g.addColorStop(1,'#0000');ctx.fillStyle=g;ctx.fillRect(0,0,64,64);const m=mesh(new T.PlaneGeometry(scale*2,scale*2),new T.MeshBasicMaterial({map:new T.CanvasTexture(c),transparent:true,depthWrite:false}),parent,x,.015,z);m.rotation.x=-Math.PI/2;return m;}
function mergedEngine(source){
 source.updateMatrixWorld(true);const batches=new Map();source.traverse(o=>{if(!o.isMesh)return;const key=o.material.name;if(!batches.has(key))batches.set(key,[]);const g=o.geometry.clone().applyMatrix4(o.matrixWorld);batches.get(key).push(g);});const group=new T.Group();
 for(const [name,list] of batches){const col=name==='Material_22'?0x285769:name==='Material_17'?0xb78445:name==='Material_21'?0x171b20:0x778994;const g=mergeGeometries(list);if(g)group.add(new T.Mesh(g,material(col,.3,.75)));list.forEach(g=>g.dispose());}return group;
}
function plaque(parent,text,x,y,z){const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d');ctx.fillStyle='#16202d';ctx.fillRect(0,0,512,128);ctx.fillStyle='#fa9b70';ctx.font='bold 48px Arial';ctx.fillText(text,26,78);return mesh(new T.PlaneGeometry(2.8,.7),new T.MeshBasicMaterial({map:new T.CanvasTexture(c)}),parent,x,y,z);}
function floor(parent,color){const m=mesh(new T.PlaneGeometry(30,30),material(color,.75,.12),parent);m.rotation.x=-Math.PI/2;return m;}
function studio(parent,color){floor(parent,color);box(parent,13,6,.2,0x403344,0,3,-4);box(parent,.2,6,9,0x352733,-6.5,3,0);for(let i=0;i<7;i++)box(parent,.07,4,.12,0x997251,-5+i*.35,2.3,-3.85);box(parent,3.5,.06,2.5,0x9b705b,0,.04,0);}
function camera(){return new T.PerspectiveCamera(40,1,.1,100);}
function industrialTexture(){const c=document.createElement('canvas');c.width=c.height=512;const x=c.getContext('2d');x.fillStyle='#26353f';x.fillRect(0,0,512,512);x.strokeStyle='#344953';x.lineWidth=3;for(let i=0;i<=512;i+=128){x.beginPath();x.moveTo(i,0);x.lineTo(i,512);x.moveTo(0,i);x.lineTo(512,i);x.stroke();}for(let i=0;i<1500;i++){x.fillStyle=i%2?'#ffffff04':'#0000000c';x.fillRect((i*67)%512,(i*137)%512,2,1);}const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.repeat.set(5,5);return tex;}
function roundedDeck(parent,w,d,h,color,x=0,y=0,z=0){const r=.18,shape=new T.Shape();shape.moveTo(-w/2+r,-d/2);shape.lineTo(w/2-r,-d/2);shape.quadraticCurveTo(w/2,-d/2,w/2,-d/2+r);shape.lineTo(w/2,d/2-r);shape.quadraticCurveTo(w/2,d/2,w/2-r,d/2);shape.lineTo(-w/2+r,d/2);shape.quadraticCurveTo(-w/2,d/2,-w/2,d/2-r);shape.lineTo(-w/2,-d/2+r);shape.quadraticCurveTo(-w/2,-d/2,-w/2+r,-d/2);const g=new T.ExtrudeGeometry(shape,{depth:h,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.035,bevelThickness:.035,curveSegments:6});g.rotateX(-Math.PI/2);return mesh(g,material(color,.34,.5),parent,x,y,z);}
function decorate(a){const root=a.root;if(['twin','sim'].includes(a.mode)){const ground=root.children.find(o=>o.geometry?.type==='PlaneGeometry'&&o.rotation.x===-Math.PI/2);if(ground){ground.material.color.set(0xcccccc);ground.material.map=industrialTexture();ground.material.needsUpdate=true;}for(const x of [-5,5]){box(root,.3,4.7,.35,0x3c5262,x,2.35,-3.7);box(root,.12,3.7,.08,0x7dafc1,x,2.3,-3.47);}for(const x of [-3.6,3.6]){box(root,2.3,.12,.4,0x68899b,x,4.4,-2);}}
 if(a.mode==='twin'){roundedDeck(root,4.4,3.4,.16,0x243846,0,.04,0);for(const x of [-1.65,1.65])for(const z of [-1.15,1.15]){cylinder(root,.075,.07,0xc5d0d5,x,.45,z);}a.heatRing=mesh(new T.TorusGeometry(1.85,.028,6,80),new T.MeshBasicMaterial({color:0x67c9eb,transparent:true,opacity:.2}),root,0,.44,0);a.heatRing.rotation.x=Math.PI/2;const cable=new T.CatmullRomCurve3([new T.Vector3(-1.4,.5,-1),new T.Vector3(-2.1,.3,-1.7),new T.Vector3(-2.4,.12,-2.4),new T.Vector3(-4,.12,-2.5)]);mesh(new T.TubeGeometry(cable,24,.045,8,false),material(0x111923),root);roundedDeck(root,1.1,.8,.12,0x3a5060,-3.8,.05,-2.5);box(root,.95,1.6,.55,0x2b4657,-3.8,.9,-2.5);box(root,.69,.6,.06,0x5c9bab,-3.8,1.25,-2.18);}
 if(a.mode==='sim'){a.scanCone=mesh(new T.ConeGeometry(.82,2.1,32,1,true),new T.MeshBasicMaterial({color:0x59d8e2,transparent:true,opacity:.12,side:T.DoubleSide,depthWrite:false}),root,0,1.05,.25);a.scanCone.visible=false;const points=[new T.Vector3(-1.8,.032,.3),new T.Vector3(-.6,.032,.3),new T.Vector3(1,.032,.3),new T.Vector3(2.5,.032,.3)];a.route=mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),24,.035,6,false),new T.MeshBasicMaterial({color:0x66dcd3,transparent:true,opacity:.3}),root);for(let i=0;i<3;i++){const x=-.9+i*1.6;roundedDeck(root,1.2,1.0,.07,0x3f5968,x,.06,-2);box(root,.85,1.2,.45,0x3c5869,x,.76,-2.35);box(root,.59,.35,.04,0x8ed1db,x,1.07,-2.10);for(let k=0;k<3;k++)box(root,.42,.025,.04,0x203440,x,.77-k*.12,-2.1);}}
 if(a.mode==='mr'){roundedDeck(root,5,4,.12,0x252e45,0,-.1,0);for(const x of [-3.8,3.8]){roundedDeck(root,1.2,1.2,.65,0x52617b,x,0,-1.6);const arch=new T.Mesh(new T.TorusGeometry(.74,.10,10,40,Math.PI),material(0xafa6ab,.22,.65));arch.position.set(x,2,-2.4);root.add(arch);}a.scan=mesh(new T.PlaneGeometry(3.1,3),new T.MeshBasicMaterial({color:0x8bc8ff,transparent:true,opacity:.22,side:T.DoubleSide,depthWrite:false}),root,0,1.6,0);a.scan.visible=false;}
}
const building=new Map();
function build(mode){if(scenes.has(mode))return Promise.resolve(scenes.get(mode));if(!building.has(mode))building.set(mode,buildScene(mode).catch(e=>{building.delete(mode);throw e;}));return building.get(mode);}
async function buildScene(mode){
 if(scenes.has(mode))return scenes.get(mode);
 const s=lightScene({vr:0x191423,ar:0x352932,mr:0x191f35,twin:0x131d27,sim:0x15202b}[mode]),c=camera(),root=new T.Group();s.add(root);const data={scene:s,camera:c,root,mode};
 if(mode==='vr'){
  const gl=await asset('./assets/emu.glb');const actor=normalized(gl.scene.clone(true),2.8);actor.rotation.y=-.2;root.add(actor);data.actor=actor;
  const tex=await new T.TextureLoader().loadAsync('./assets/moon.jpg');tex.colorSpace=T.SRGBColorSpace;tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.repeat.set(9,9);
  const g=new T.PlaneGeometry(45,45,48,48);g.rotateX(-Math.PI/2);const p=g.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i);p.setY(i,(Math.sin(x*.7)*Math.cos(z*.6)*.75)*Math.min(1,Math.hypot(x,z)/6)-.06);}g.computeVertexNormals();mesh(g,new T.MeshStandardMaterial({map:tex,color:0x7d737b,roughness:1}),root);
  for(let i=0;i<14;i++){const r=mesh(new T.IcosahedronGeometry(.25+(i%4)*.15,2),new T.MeshStandardMaterial({map:tex,color:0x66616c,roughness:1}),root,Math.sin(i*2.4)*(4+i%4),.1,Math.cos(i*2.4)*(4+i%4));r.scale.set(1,1.1,.7);}
  const planet=mesh(new T.SphereGeometry(2.3,32,20),new T.MeshStandardMaterial({map:tex,color:0xbda1a3}),root,-13,9,-25);shadow(root,0,0,1.1);
 }else if(mode==='ar'){
  data.backplate=await new T.TextureLoader().loadAsync('./assets/ar-living-room.jpg');data.backplate.colorSpace=T.SRGBColorSpace;s.background=data.backplate;const model=(await asset('./assets/chair.glb')).scene;data.actor=normalized(model,1.45);root.add(data.actor);data.shadow=shadow(root,0,0,1.1);data.fabric=[];model.traverse(o=>{if(o.isMesh&&/fabric/i.test(o.name)){o.material=o.material.clone();o.material.color.set(0xb75a3d);data.fabric.push(o.material);}});
  data.target=mesh(new T.RingGeometry(.7,.77,64),new T.MeshBasicMaterial({color:0xf57c48,transparent:true,opacity:.8,side:T.DoubleSide,depthWrite:false}),root,0,.018,0);data.target.rotation.x=-Math.PI/2;
  data.ripple=mesh(new T.RingGeometry(.82,.90,64),new T.MeshBasicMaterial({color:0xffa274,transparent:true,opacity:0,side:T.DoubleSide,depthWrite:false}),root,0,.025,0);data.ripple.rotation.x=-Math.PI/2;
 }else if(mode==='mr'){
  plaque(root,'03 / DEPTH STUDY',0,3.3,-3.85);floor(root,0x242736);box(root,12,5,.2,0x242b43,0,2.5,-4);const wall=box(root,2.5,1.5,.35,0x9b5445,0,.75,.65);data.wall=wall;box(root,2.7,.12,.55,0xf99a70,0,1.56,.65);
  const helmet=(await asset('./assets/helmet.glb')).scene;data.actor=normalized(helmet,1.55);data.actor.position.y=.62;root.add(data.actor);data.actor.traverse(o=>{if(o.isMesh)o.material=o.material.clone();});
  for(const x of [-4,4]){box(root,.55,3.6,.55,0x4f5b79,x,1.8,-2);box(root,.15,2.8,.08,0xffa575,x,1.7,-1.7);}data.shadow=shadow(root,0,0,1.2);
 }else if(mode==='twin'){
  plaque(root,'05 / POWER UNIT',0,3.8,-3.8);floor(root,0x1b2730);box(root,3.6,.35,2.7,0x3f525d,0,.18,0);box(root,3.75,.05,2.85,0x9c7448,0,.38,0);data.actor=normalized(mergedEngine((await asset('./assets/engine/engine.gltf')).scene),2.4);data.actor.position.y=.41;data.actor.rotation.y=-.45;root.add(data.actor);
  data.fan=new T.Group();root.add(data.fan);data.fan.position.set(2.6,1.2,0);const ring=mesh(new T.TorusGeometry(.7,.08,8,40),material(0x5f7b86,.2,.7),data.fan);for(let i=0;i<6;i++){const g=new T.Group();data.fan.add(g);g.rotation.z=i*Math.PI/3;box(g,.18,.6,.06,0x71a8bb,0,.3,0);}cylinder(root,.2,.5,0x39454d,2.6,.25,0);data.indicator=mesh(new T.SphereGeometry(.12,16,12),new T.MeshBasicMaterial({color:0x69b7dd}),root,-1.9,.55,1.2);
  for(let i=0;i<8;i++)box(root,.025,3.8,.025,0x344955,-5+i*1.4,1.9,-4);shadow(root,0,0,1.9);
 }else if(mode==='pano'){
  const tex=await new T.TextureLoader().loadAsync('./video/source/panorama.jpg');tex.colorSpace=T.SRGBColorSpace;mesh(new T.SphereGeometry(30,48,28),new T.MeshBasicMaterial({map:tex,side:T.BackSide}),root);
 }else if(mode==='sim'){
  plaque(root,'06 / INSPECTION',0,3.2,-3.8);floor(root,0x22323c);const gl=await asset('./assets/robot.glb');data.actor=normalized(gl.scene,2.2);root.add(data.actor);data.mixer=new T.AnimationMixer(gl.scene);data.clips=Object.fromEntries(gl.animations.map(a=>[a.name,data.mixer.clipAction(a)]));data.clips.Idle?.play();
  data.gate=box(root,.15,2.5,3.2,0xd27843,-3,1.25,-.2);box(root,.25,.1,5.6,0xf5a754,-3,.05,-.2);for(let i=0;i<3;i++){const x=-.9+i*1.6;box(root,1.1,.1,1.1,0x273743,x,.05,-2);cylinder(root,.3,.5,0x4a6472,x,.3,-2);const light=mesh(new T.SphereGeometry(.085,12,8),new T.MeshBasicMaterial({color:0xff8455}),root,x,.62,-2);(data.beacons??=[]).push(light);}
  for(let i=0;i<12;i++)box(root,.04,.015,.22,0xffbc66,-2+i*.4,.02,1.4);box(root,10,4,.2,0x20333e,0,2,-4);data.shadow=shadow(root,0,0,.8);
 }
 decorate(data);scenes.set(mode,data);return data;
}
function resize(){for(const [r,el] of [[render,host],[hr,heroHost]])r.setSize(el.clientWidth,el.clientHeight,false);dirty=true;wake();}
new ResizeObserver(resize).observe(host);new ResizeObserver(resize).observe(heroHost);
function coverPhoto(tex,w,h){const aspect=tex.image.width/tex.image.height,view=w/h;tex.repeat.set(Math.min(1,view/aspect),Math.min(1,aspect/view));tex.offset.set((1-tex.repeat.x)/2,(1-tex.repeat.y)/2);}
function drawHero(){
 if(!hero)return;const w=heroHost.clientWidth,h=heroHost.clientHeight,m=w<700,c=heroCamera;c.aspect=w/h;c.clearViewOffset();
 if(heroMode==='vr'){
  c.position.set(0,1.5,m?15.5:7.5);c.lookAt(0,1.45,0);c.setViewOffset(w,h,m?0:-w*.23,m?-h*.17:-h*.015,w,h);
 }else if(heroMode==='pano'){c.position.set(0,1.5,0);c.lookAt(Math.sin(heroTime*.06)*10,1.6,-10);}
 else {const pos={ar:[0,2.2,6.7],mr:[3.6,3.0,9],twin:[5,3.5,9],sim:[5.5,4.0,10]}[heroMode];const focus=new T.Vector3(0,1.2,0),offset=new T.Vector3(...pos).sub(focus);offset.applyAxisAngle(new T.Vector3(0,1,0),Math.sin(heroTime*.18)*.09);if(m)offset.multiplyScalar(1.25);c.position.copy(focus).add(offset);c.lookAt(focus);c.setViewOffset(w,h,m?0:-w*.23,m?-h*(heroMode==='ar'?.07:.12):heroMode==='ar'?-h*.12:0,w,h);}
 c.position.x+=heroDrift.x*.22;c.position.y+=heroDrift.y*.14;c.updateProjectionMatrix();
 const actor=hero.actor,old=actor?{p:actor.position.clone(),r:actor.rotation.clone(),v:actor.visible}:null;
 if(actor){actor.visible=true;if(heroMode==='vr')actor.rotation.set(.04,-.38+Math.sin(heroTime*.18)*.1,-.09);if(heroMode==='ar')actor.position.set(0,0,0);if(heroMode==='sim')actor.position.set(0,0,.25);}
 const extras=[hero.target,hero.ripple,hero.shadow].filter(Boolean).map(o=>({o,v:o.visible,p:o.position.clone()}));if(heroMode==='ar'){hero.target.visible=false;hero.ripple.visible=false;hero.shadow.visible=true;hero.shadow.position.set(0,.015,0);}
 if(hero.backplate)coverPhoto(hero.backplate,w,h);
 hr.render(hero.scene,c);extras.forEach(({o,v,p})=>{o.visible=v;o.position.copy(p);});if(old){actor.position.copy(old.p);actor.rotation.copy(old.r);actor.visible=old.v;}
}
function drawCase(dt){
 const a=active;if(!a)return;const m=host.clientWidth<700;a.camera.aspect=host.clientWidth/host.clientHeight;a.camera.clearViewOffset();
 let pos=[4,3.3,7.5],look=[0,1.1,0];
 if(a.mode==='vr'){
  const views={landing:[4.8,2.3,6],suit:[.6,1.85,3],ridge:[-5,4.3,5]};const base=new T.Vector3(...views[state.view]),focus=new T.Vector3(0,1.35,0),offset=base.sub(focus);offset.applyAxisAngle(new T.Vector3(0,1,0),state.yaw*Math.PI/180);offset.y+=state.pitch*.025;if(m)offset.multiplyScalar(1.16);a.camera.position.copy(focus.clone().add(offset));a.camera.lookAt(focus);if(a.mode==='ar')a.camera.setViewOffset(host.clientWidth,host.clientHeight,-host.clientWidth*.1,-host.clientHeight*.22,host.clientWidth,host.clientHeight);
 }else{
  if(a.mode==='ar'){pos=[0,1.9,5.8];look=[0,.78,0];coverPhoto(a.backplate,host.clientWidth,host.clientHeight);a.actor.visible=state.placed;a.shadow.visible=state.placed;a.actor.position.set(state.x,0,state.z);a.shadow.position.set(state.x,.015,state.z);a.actor.rotation.y=state.rotation*Math.PI/180;a.target.visible=!state.placed;const age=(performance.now()-(a.placedAt||0))/800;a.ripple.visible=state.placed&&age<1&&!reduced.matches;a.ripple.position.set(state.x,.025,state.z);a.ripple.scale.setScalar(1+Math.max(0,age)*.8);a.ripple.material.opacity=Math.max(0,1-age)*.65;a.fabric.forEach(v=>v.color.set({copper:0xb75a3d,blue:0x365883,cream:0xd4c4ad}[state.fabric]));}
  if(a.mode==='mr'){pos=[.8,2.5,7.6];a.actor.position.z=2-state.depth*.035;a.actor.rotation.y=-.2;a.actor.traverse(o=>{if(o.isMesh){o.material.depthTest=state.occlusion;o.renderOrder=state.occlusion?0:20;}});a.shadow.position.z=a.actor.position.z;}
  if(a.mode==='twin'){pos=m?[4.8,3.6,9.5]:[5,3.2,7.8];look=[.3,1.5,0];if(state.running)a.fan.rotation.z-=dt*(3+state.load*.06);a.indicator.material.color.set(state.trip?0xff5135:state.running?0x69cfff:0x526678);}
  if(a.mode==='sim'){
   pos=[5.8,4.8,8];look=[0,1,-.3];const gateTarget=state.gate?-.2:-3.5;a.gate.position.z=window.__xrCapture||reduced.matches?gateTarget:T.MathUtils.damp(a.gate.position.z,gateTarget,14,dt);
   const p=state.progress,x=p<.65?-1.5+p/.65*4:2.5-(p-.65)/.35*4;a.actor.position.set(state.task==='idle'?-1.5:x,0,.25);a.shadow.position.x=a.actor.position.x;a.actor.rotation.y=p<.65?Math.PI/2:-Math.PI/2;
   const motion=state.task==='running'?'Walking':'Idle';if(a.motion!==motion){a.mixer.stopAllAction();a.clips[motion]?.play();a.motion=motion;}a.mixer.update(dt);a.beacons.forEach((b,i)=>b.material.color.set(p>(i+1)*.2?0x70d9d5:0xff8455));
  }
  const focus=new T.Vector3(...look),offset=new T.Vector3(...pos).sub(focus);if(['mr','twin','sim'].includes(a.mode)){const orbit=new T.Spherical().setFromVector3(offset);orbit.theta+=state.yaw*Math.PI/180;orbit.phi=T.MathUtils.clamp(orbit.phi+state.pitch*Math.PI/180,.22,1.42);offset.setFromSpherical(orbit);}if(m&&a.mode!=='ar')offset.multiplyScalar(a.mode==='twin'?1.48:a.mode==='sim'?1.40:1.18);a.camera.position.copy(focus).add(offset);a.camera.lookAt(focus);if(a.mode==='ar')a.camera.setViewOffset(host.clientWidth,host.clientHeight,-host.clientWidth*.1,-host.clientHeight*.22,host.clientWidth,host.clientHeight);
 }
 if(a.mode==='twin')a.actor.traverse(o=>{if(o.isMesh){o.material.emissive.set(0xff5525);o.material.emissiveIntensity=Math.max(0,(state.temperature-45)/100)*.45;}});
 if(a.scanCone){a.scanCone.visible=state.task==='running';a.scanCone.position.x=a.actor.position.x;}
 if(a.heatRing){a.heatRing.material.color.set(state.trip?0xff5036:0x67c9eb);a.heatRing.rotation.z=renderTime*.4;a.heatRing.material.opacity=state.running?.35+state.load*.004:.15;}
 if(a.route){a.route.material.color.set(state.task==='paused'?0xff684a:0x66dcd3);a.route.material.opacity=state.task==='running'?.75:.28;}
 if(a.scan){a.scan.position.z=a.actor.position.z;a.scan.visible=performance.now()<effectUntil&&!reduced.matches;a.scan.material.opacity=.22;}
 a.camera.updateProjectionMatrix();const start=performance.now();render.render(a.scene,a.camera);stats.samples.push(performance.now()-start);if(stats.samples.length>120)stats.samples.shift();stats.draws=render.info.render.calls;stats.triangles=render.info.render.triangles;frameCount++;
}
function moving(){return state.orbit||performance.now()<effectUntil||state.mode==='sim'&&state.task==='running'||state.mode==='twin'&&(state.running||Math.abs(state.temperature-26)>.1);}
window.__caseShot=async(mode,values,time=0)=>{if(state.mode!==mode){XRLab.select(mode);await window.__caseReady;}Object.assign(state,values);XRLab.refreshTelemetry?.();drawCase(0);if(active.fan)active.fan.rotation.z=-time*8;if(active.mixer)active.mixer.setTime(time);render.render(active.scene,active.camera);};
function frame(now){queued=false;const dt=last?Math.min(.1,(now-last)/1000):0;last=now;
 if(document.hidden||window.__xrCapture)return;
 const following=Math.abs(heroTarget.x-heroDrift.x)+Math.abs(heroTarget.y-heroDrift.y)>.005;if(following){heroDrift.x=T.MathUtils.damp(heroDrift.x,heroTarget.x,12,dt);heroDrift.y=T.MathUtils.damp(heroDrift.y,heroTarget.y,12,dt);dirty=true;}
 if(heroVisible&&!paused)heroTime+=dt;
 if(heroVisible&&(dirty||!paused&&now-heroLast>40)){heroLast=now;drawHero();}
 if(visible&&active&&state.mode!=='pano'&&(dirty||moving())){XRLab.tick(dt);renderTime+=dt;if(state.orbit)state.yaw+=dt*10;drawCase(dt);}
 dirty=false;
 if(visible&&moving()||heroVisible&&(!paused||following)){wake();}
}
function wake(){if(!queued){queued=true;requestAnimationFrame(frame);}}
async function activate(){
 const id=++token;dirty=true;if(state.mode==='pano'){active=null;return;}
 const mode=state.mode;host.classList.add('loading');host.setAttribute('aria-busy','true');document.querySelector('#scene-error').hidden=true;
 try{const a=await build(mode);if(id!==token)return;active=a;host.classList.remove('loading');host.setAttribute('aria-busy','false');dirty=true;last=0;document.dispatchEvent(new CustomEvent('xr:ready',{detail:{mode}}));wake();}
 catch(e){console.error(e);if(id===token){host.classList.remove('loading');host.setAttribute('aria-busy','false');document.querySelector('#scene-error').hidden=false;}}
}
document.addEventListener('xr:change',e=>{if(e.detail.reset)window.__caseReady=activate();else{effectUntil=reduced.matches?0:performance.now()+850;if(active?.mode==='ar'&&state.placed&&!active.wasPlaced)active.placedAt=performance.now();if(active?.mode==='ar')active.wasPlaced=state.placed;dirty=true;last=0;wake();}});
new IntersectionObserver(([e])=>{visible=e.isIntersecting;dirty=true;last=0;wake();}).observe(host);
new IntersectionObserver(([e])=>{heroVisible=e.isIntersecting;dirty=true;last=0;armHero();wake();}).observe(heroHost);
document.addEventListener('visibilitychange',()=>{last=0;dirty=true;armHero();wake();});
const pause=document.querySelector('#hero-pause');
const heroItems=[['vr','舱外世界','月面考察 / VR'],['ar','把想法放进房间','真实室内 / 家具试摆'],['mr','现实的另一层','数字展品 / 深度遮挡'],['pano','换个方向，抵达现场','机场大厅 / 360° 全景'],['twin','看见机器的状态','发动机 / 数字孪生'],['sim','先练习，再出发','机器人 / 安全巡检']];
function pauseLabel(){pause.setAttribute('aria-label',paused?'播放轮播':'暂停轮播');pause.title=paused?'播放轮播':'暂停轮播';pause.innerHTML='<i data-lucide="'+(paused?'play':'pause')+'"></i>';window.lucide?.createIcons();document.querySelector('.hero').classList.toggle('reel-paused',paused);}
function armHero(){clearTimeout(heroTimer);if(heroOriginal&&!paused&&heroVisible&&!document.hidden)heroTimer=setTimeout(()=>showHero(heroItems[(heroItems.findIndex(a=>a[0]===heroMode)+1)%6][0]),7000);}
async function showHero(mode){
 const id=++heroToken;heroHost.setAttribute('aria-busy','true');
 try{const next=mode==='vr'?heroOriginal:await build(mode);if(id!==heroToken)return;hero=next;heroMode=mode;heroTime=0;heroHost.dataset.mode=mode;document.querySelector('.hero').dataset.scene=mode;heroHost.setAttribute('aria-label',heroItems.find(a=>a[0]===mode)[1]+'场景预览');
  const index=heroItems.findIndex(a=>a[0]===mode),item=heroItems[index],caption=document.querySelector('.hero-caption');caption.querySelector(':scope > div > span').textContent='EXHIBIT 00'+(index+1);caption.querySelector('b').textContent=item[1];caption.querySelector('p').textContent=item[2];document.querySelectorAll('[data-hero]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.hero===mode?'true':'false'));drawHero();document.dispatchEvent(new CustomEvent('xr:hero',{detail:{mode}}));dirty=true;wake();
 }catch(e){console.error(e);}finally{if(id===heroToken){heroHost.setAttribute('aria-busy','false');armHero();}}
}
document.querySelectorAll('[data-hero]').forEach(b=>b.onclick=()=>{paused=true;pauseLabel();showHero(b.dataset.hero);});
document.querySelector('#hero-enter').onclick=()=>XRLab.select(heroMode);
pause.onclick=()=>{paused=!paused;last=0;dirty=true;pauseLabel();armHero();wake();};
reduced.addEventListener('change',()=>{if(reduced.matches){paused=true;state.orbit=false;effectUntil=0;}pauseLabel();armHero();wake();});pauseLabel();
let heroOriginal;
let drag;host.tabIndex=0;host.setAttribute('aria-label','互动场景：拖动观察或摆放，方向键可操作');
const ray=new T.Raycaster(),plane=new T.Plane(new T.Vector3(0,1,0),0);
function point(e){const b=host.getBoundingClientRect();ray.setFromCamera(new T.Vector2((e.clientX-b.left)/b.width*2-1,-(e.clientY-b.top)/b.height*2+1),active.camera);return ray.ray.intersectPlane(plane,new T.Vector3());}
host.onpointerdown=e=>{if(!active||!['vr','ar','mr','twin','sim'].includes(state.mode)||state.mode==='ar'&&!state.placed)return;state.orbit=false;const orbitButton=document.querySelector('[data-action=orbit]');if(orbitButton)orbitButton.textContent='自动环绕';host.focus({preventScroll:true});host.setPointerCapture(e.pointerId);const p=state.mode==='ar'?point(e):null;drag={x:e.clientX,y:e.clientY,yaw:state.yaw,pitch:state.pitch,px:state.x,pz:state.z,p};};
host.onpointermove=e=>{if(!drag)return;if(['vr','mr','twin','sim'].includes(state.mode)){state.yaw=drag.yaw-(e.clientX-drag.x)*.25;state.pitch=Math.max(-25,Math.min(30,drag.pitch+(e.clientY-drag.y)*.15));}else{const p=point(e);if(p&&drag.p){state.x=Math.max(-2,Math.min(2,drag.px+p.x-drag.p.x));state.z=Math.max(-1.8,Math.min(1.8,drag.pz+p.z-drag.p.z));}}dirty=true;wake();};
host.onpointerup=host.onpointercancel=()=>drag=null;
host.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();if(state.mode==='ar'&&state.placed){state.x=Math.max(-2,Math.min(2,state.x+(e.key==='ArrowRight'?.15:e.key==='ArrowLeft'?-.15:0)));state.z=Math.max(-1.8,Math.min(1.8,state.z+(e.key==='ArrowDown'?.15:e.key==='ArrowUp'?-.15:0)));}else if(['vr','mr','twin','sim'].includes(state.mode)){if(e.key==='ArrowLeft'||e.key==='ArrowRight')state.yaw+=e.key==='ArrowLeft'?-5:5;else state.pitch=Math.max(-25,Math.min(30,state.pitch+(e.key==='ArrowUp'?3:-3)));}dirty=true;wake();};
window.__xrReady=asset('./assets/emu.glb').then(gl=>{const scene=lightScene(),actor=normalized(gl.scene.clone(true),2.8);scene.add(actor);heroOriginal=hero={scene,actor,camera:camera()};heroHost.classList.add('ready');drawHero();armHero();window.__caseReady=activate();return window.__caseReady;});
window.__xrProbe=()=>({mode:state.mode,loaded:[...scenes.keys()],heroMode,heroPaused:paused,heroAngle:heroTime,labFrame:frameCount,draws:stats.draws,triangles:stats.triangles,meanSubmitMs:stats.samples.reduce((a,b)=>a+b,0)/(stats.samples.length||1),state:{...state}});

window.XRHero={select:showHero,pause:()=>{paused=true;pauseLabel();armHero();},get mode(){return heroMode;}};

document.querySelector('.hero').addEventListener('pointermove',e=>{if(reduced.matches||e.pointerType==='touch')return;const r=heroHost.getBoundingClientRect();heroTarget.x=(e.clientX-r.left)/r.width*2-1;heroTarget.y=(e.clientY-r.top)/r.height*2-1;wake();});
document.querySelector('.hero').addEventListener('pointerleave',()=>{heroTarget.x=heroTarget.y=0;wake();});
