import * as THREE from 'three';

const THEMES = {
  crash:['#071c2b','#20d6bc','#f3c96b'], slots:['#210d2b','#f2b64c','#e84b86'],
  roulette:['#10261d','#d9b66e','#b92d3c'], blackjack:['#102c27','#d9b66e','#f5f0df'],
  baccarat:['#241226','#e5bd73','#c94b62'], keno:['#10253b','#65c7ed','#f5cf67'],
  dice:['#18263b','#f4d16f','#6ed6d0'], mines:['#132a27','#62e2c0','#e7bd70'],
  plinko:['#21173b','#c6a0ff','#55d9ce'], penalty:['#092b20','#e8d18a','#f3f6f1'],
  coinflip:['#252016','#f3cf70','#c5a4ff'], limbo:['#111d37','#65b9ff','#d8a6ff'],
  hilo:['#142d26','#e4c477','#e8efff'], scratch:['#29152a','#edbd68','#f18cb4'],
  wheel:['#21182c','#e9c26d','#71d9c5'], sicbo:['#241727','#dcb46d','#e45d69'],
  casinowar:['#122a2c','#e1c176','#c9d5ef'], dragontiger:['#2a171c','#efb85e','#69c9e8'],
  andarbahar:['#102c26','#d8bd79','#b6d7cb'], threecard:['#16233c','#e3c77c','#d3a7ff'],
  holdem:['#102d26','#dfc47a','#b9d8c7'], bingo:['#152541','#edc96c','#6fd9d0']
};
const LABELS = {
  crash:'SKY RUNWAY',slots:'GOLD REELS',roulette:'ROYAL WHEEL',blackjack:'21 TABLE',baccarat:'BACCARAT ROOM',
  keno:'NUMBER VAULT',dice:'DICE ARENA',mines:'MINE SHAFT',plinko:'PLINKO TOWER',penalty:'NATIONAL STADIUM',
  coinflip:'GOLD MINT',limbo:'ORBIT CHAMBER',hilo:'HIGH LOW CLUB',scratch:'GOLD TICKET VAULT',
  wheel:'FORTUNE HALL',sicbo:'THREE DICE ROOM',casinowar:'DUEL ARENA',dragontiger:'EASTERN PAVILION',
  andarbahar:'ROYAL COURT',threecard:'POKER SALON',holdem:'TEXAS CARD ROOM',bingo:'BINGO GRAND HALL'
};
let active = null;
const material = (color, roughness=.58, metalness=.12) => new THREE.MeshStandardMaterial({color,roughness,metalness});
function box(scene,x,y,z,sx,sy,sz,color,rx=0,ry=0,rz=0) {
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),material(color));
  mesh.position.set(x,y,z); mesh.rotation.set(rx,ry,rz); scene.add(mesh); return mesh;
}
function sphere(scene,x,y,z,r,color,segments=24) {
  const mesh=new THREE.Mesh(new THREE.SphereGeometry(r,segments,Math.max(12,Math.floor(segments*.65))),material(color,.34,.2));
  mesh.position.set(x,y,z); scene.add(mesh); return mesh;
}
function cylinder(scene,x,y,z,rt,rb,h,color,segments=48) {
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,segments),material(color,.38,.42));
  mesh.position.set(x,y,z); scene.add(mesh); return mesh;
}
function torus(scene,x,y,z,r,tube,color,rx=Math.PI/2) {
  const mesh=new THREE.Mesh(new THREE.TorusGeometry(r,tube,12,96),material(color,.3,.7));
  mesh.position.set(x,y,z); mesh.rotation.x=rx; scene.add(mesh); return mesh;
}
function addLights(scene,accent) {
  scene.add(new THREE.HemisphereLight(0xd9edff,0x182033,2.0));
  const key=new THREE.DirectionalLight(0xffffff,3.1); key.position.set(5,9,7); scene.add(key);
  const rim=new THREE.PointLight(accent,36,18); rim.position.set(-5,3,-3); scene.add(rim);
}
function addStadium(scene,accent) {
  box(scene,0,-.32,0,14,.35,10,'#176b3d');
  for(let i=-4;i<=4;i++) box(scene,i*1.45,-.12,0,.018,.012,9.5,'#bce8c5');
  box(scene,0,-.1,0,7,.015,.02,'#e4f4df');
  torus(scene,0,-.09,0,1.1,.012,'#d7f1dc');
  for(let side of [-1,1]) {
    box(scene,side*7,1.25,0,.45,3.1,10,'#26384c');
    for(let row=0;row<4;row++) for(let col=0;col<18;col++)
      box(scene,side*7+(side*.02),2.9+row*.28,-4.5+col*.52,.38,.18,.32,(row+col)%3===0?accent:'#74849a');
    for(let x=-5.5;x<=5.5;x+=3.7) {
      cylinder(scene,x,4.4,-4.7,.045,.045,1.4,'#d8e5ef',10);
      sphere(scene,x,5.15,-4.7,.19,'#fff4c4',16);
    }
  }
  // Goal frame, net and penalty spot.
  box(scene,0,1.18,-4.45,3.65,.13,.13,'#f7f7f1');
  box(scene,-1.76,.57,-4.45,.13,1.25,.13,'#f7f7f1');
  box(scene,1.76,.57,-4.45,.13,1.25,.13,'#f7f7f1');
  for(let x=-1.55;x<=1.56;x+=.22) box(scene,x,.58,-4.32,.012,1.1,.012,'#d8e3df');
  for(let y=.1;y<=1.1;y+=.18) box(scene,0,y,-4.32,3.35,.012,.012,'#d8e3df');
  sphere(scene,0,.035,-1.6,.055,'#ffffff');
  // 3D striker and keeper silhouettes.
  cylinder(scene,-.65,.75,-1.0,.22,.25,.8,'#e5e9ed',16);
  sphere(scene,-.65,1.32,-1.0,.2,'#a96f4c',20);
  box(scene,-.65,.88,-1.0,.46,.56,.26,'#123f99');
  cylinder(scene,-.65,.22,-.92,.08,.1,.48,'#111827',12);
  cylinder(scene,-.65,.22,-1.12,.08,.1,.48,'#111827',12);
  box(scene,0,.76,-4.05,.42,.6,.22,'#e7c33c');
  sphere(scene,0,1.2,-4.05,.18,'#a96f4c',20);
  const ball=sphere(scene,-.65,.18,-.25,.16,'#f5f7f5',24);
  for(let i=0;i<5;i++) {
    const patch=sphere(scene,-.65+Math.cos(i*1.256)*.12,.18+Math.sin(i*1.256)*.12,-.25,.035,'#17212a',10);
  }
  return {ball};
}
function buildScene(scene,id,accent,secondary) {
  const animated=[];
  if(id==='penalty') return {animated,ball:addStadium(scene,accent).ball};
  // Each game gets its own architectural silhouette and signature props.
  switch(id) {
    case 'crash':
      box(scene,0,-.35,0,12,.25,8,'#102b40');
      for(let i=0;i<8;i++) { const p=box(scene,-5+i*1.4,-.17,2-i*.55,.12,.03,2.2,accent); p.rotation.z=-.28; }
      for(let i=0;i<4;i++) { const cloud=sphere(scene,-4+i*2.5,1.4,-2,.65,'#315b73',16); cloud.scale.set(1.7,.55,.8); animated.push(cloud); }
      const plane=box(scene,0,1.1,0,1.2,.18,.48,'#e8edf5',0,0,-.12); animated.push(plane); break;
    case 'slots':
      box(scene,0,-.2,0,7,.3,5,'#32142f');
      for(let i=-1;i<=1;i++){box(scene,i*1.65,1.2,-.8,1.25,2.6,.5,'#d69b3f');const reel=cylinder(scene,i*1.65,1.2,-.48,.48,.48,1.7,'#f4d98c',32); reel.rotation.x=Math.PI/2; animated.push(reel);sphere(scene,i*1.65,1.2,-.1,.27,secondary);}
      box(scene,0,2.8,-.8,5.6,.45,.7,accent); break;
    case 'roulette':
      cylinder(scene,0,-.1,0,2.7,2.7,.35,'#5c351b');cylinder(scene,0,.12,0,2.3,2.3,.2,'#18251f');torus(scene,0,.28,0,2.12,.17,accent);
      for(let i=0;i<37;i++){const a=i*Math.PI*2/37;const p=box(scene,Math.cos(a)*1.72,.32,Math.sin(a)*1.72,.27,.16,.22,i%2? '#a82b39':'#121820');p.rotation.y=-a; }
      cylinder(scene,0,.43,0,.7,.9,.18,'#c69b50');const wheel=torus(scene,0,.54,0,1.25,.07,secondary);animated.push(wheel);break;
    case 'blackjack':case 'baccarat':case 'casinowar':case 'dragontiger':case 'andarbahar':case 'threecard':case 'holdem':
      cylinder(scene,0,-.22,0,3.4,3.4,.45,'#422a1c');cylinder(scene,0,.02,0,3.22,3.22,.12,id==='baccarat'?'#5a1735':'#126044');
      for(let i=0;i<5;i++){const card=box(scene,-1.9+i*.95,.24,-.25,.62,.06,1.05,'#f2eee1',0,(i-2)*.09,0);animated.push(card);box(scene,-1.9+i*.95,.28,-.25,.5,.015,.84,i%2?accent:secondary);}
      if(id==='dragontiger'){sphere(scene,-2.2,.85,-1.5,.58,accent);sphere(scene,2.2,.85,-1.5,.58,secondary);}
      if(id==='holdem'){for(let i=0;i<5;i++) sphere(scene,-1.5+i*.75,.5,1.25,.2,'#e9c56b',12);}
      break;
    case 'keno':case 'bingo':
      cylinder(scene,0,-.25,0,3.4,3.4,.35,'#173b55');
      for(let i=0;i<(id==='keno'?18:25);i++){const a=i*2.4;const r=1.2+(i%3)*.48;const orb=sphere(scene,Math.cos(a)*r,.55+(i%4)*.24,Math.sin(a)*r,.2+(i%2)*.04,i%2?accent:secondary,16);animated.push(orb);}
      if(id==='bingo') torus(scene,0,.15,0,2.5,.12,accent); break;
    case 'dice':case 'sicbo':
      box(scene,0,-.25,0,6,.35,5,'#1d4b46');
      for(let i=0;i<(id==='dice'?2:3);i++){const die=box(scene,(i-(id==='dice'?.5:1))*1.5,.65,0,.95,.95,.95,'#f4f1e9');die.rotation.set(.35+i*.18,.4+i*.5,.2);animated.push(die);sphere(scene,die.position.x,.65,.49,.09,'#162238',12);}
      break;
    case 'mines':
      box(scene,0,-.25,0,6,.35,5,'#1c493c');
      for(let i=0;i<25;i++){const x=(i%5-2)*1.05,z=(Math.floor(i/5)-2)*.85;box(scene,x,.04,z,.88,.16,.7,'#276b57');if(i%4===0){const gem=sphere(scene,x,.4,z,.22,accent,8);gem.scale.y=1.5;animated.push(gem);} }
      break;
    case 'plinko':
      box(scene,0,-.3,0,5,.3,5,'#39245c');
      for(let row=0;row<8;row++)for(let col=0;col<=row;col++){const x=(col-row/2)*.65,z=-2.4+row*.58;sphere(scene,x,.35,z,.085,accent,10);}
      const drop=sphere(scene,0,2.5,1,.19,'#f6d46d');animated.push(drop);break;
    case 'coinflip':
      cylinder(scene,0,.15,0,1.35,1.35,.22,'#9b722f');torus(scene,0,.28,0,1.15,.13,accent);
      const coin=cylinder(scene,0,.75,0,.83,.83,.18,'#d7a943',64);coin.rotation.x=Math.PI/2;animated.push(coin);
      sphere(scene,0,.88,0,.48,secondary,32);break;
    case 'limbo':
      torus(scene,0,.8,0,2.15,.09,accent);torus(scene,0,.8,0,1.45,.06,secondary);
      for(let i=0;i<9;i++){const orb=sphere(scene,Math.cos(i*.7)*2,.8+Math.sin(i*.9)*.7,Math.sin(i*.7)*2,.13,accent,12);animated.push(orb);}
      break;
    case 'hilo':
      box(scene,0,-.2,0,6,.3,4,'#164b3d');
      for(let i=0;i<2;i++){const card=box(scene,(i?1:-1)*1.2,.65,0,1.1,.12,1.65,'#eee9db',0,i?-.2:.2,0);animated.push(card);box(scene,(i?1:-1)*1.2,.73,0,.86,.02,1.35,i?secondary:accent);}
      break;
    case 'scratch':
      box(scene,0,-.2,0,5,.3,4,'#4c2b42');
      for(let i=0;i<3;i++){const tile=box(scene,(i-1)*1.4,.55,0,1.05,.16,1.6,'#d8b36c',0,0,(i-1)*.08);animated.push(tile);torus(scene,(i-1)*1.4,.68,0,.35,.045,secondary);}
      break;
    case 'wheel':
      cylinder(scene,0,-.15,0,2.5,2.5,.28,'#5a3d21');const rotor=cylinder(scene,0,.3,0,2.25,2.25,.16,accent,64);rotor.rotation.x=Math.PI/2;animated.push(rotor);
      torus(scene,0,.45,0,2.15,.12,secondary);cylinder(scene,0,.65,0,.3,.4,.35,'#f4d68a');break;
    case 'scratch': break;
    default:
      cylinder(scene,0,-.2,0,2.8,2.8,.3,'#24443b');
      for(let i=0;i<8;i++) {const p=sphere(scene,Math.cos(i*.78)*1.7,.5,Math.sin(i*.78)*1.7,.35,i%2?accent:secondary);animated.push(p);}
  }
  return {animated};
}
export function mountGame3D(container, gameId) {
  if(!container || !THEMES[gameId]) return () => {};
  if(active?.container===container) return active.dispose;
  if(active) active.dispose();
  let renderer;
  try {
    const [bg,accent,secondary]=THEMES[gameId];
    const scene=new THREE.Scene();scene.background=new THREE.Color(bg);
    scene.fog=new THREE.Fog(bg,9,24);
    const camera=new THREE.PerspectiveCamera(42,1,.1,80);
    camera.position.set(0,4.8,9.6);camera.lookAt(0,.45,0);
    renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    renderer.domElement.className='three-scene-canvas';renderer.domElement.setAttribute('aria-hidden','true');
    container.appendChild(renderer.domElement);
    addLights(scene,accent);
    const floor= new THREE.Mesh(new THREE.PlaneGeometry(22,22),material(bg,.92,0));floor.rotation.x=-Math.PI/2;floor.position.y=-.42;scene.add(floor);
    const stage=buildScene(scene,gameId,accent,secondary);
    const ring=torus(scene,0,-.29,0,4.1,.025,accent);ring.material.transparent=true;ring.material.opacity=.45;
    const labelGroup=new THREE.Group();scene.add(labelGroup);
    const clock=new THREE.Clock();let frame=0;let disposed=false;let raf=0;
    const resize=()=>{const w=Math.max(1,container.clientWidth),h=Math.max(1,container.clientHeight);camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);};
    const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(resize):null;observer?.observe(container);resize();
    const animate=()=>{if(disposed)return;raf=requestAnimationFrame(animate);const t=clock.getElapsedTime();frame++;
      stage.animated.forEach((obj,i)=>{obj.rotation.y+=.003+(i%3)*.001;obj.position.y+=Math.sin(t*1.25+i)*.0018;});
      if(stage.ball){stage.ball.position.x=-.65+Math.sin(t*.7)*.035;stage.ball.rotation.x+=.018;stage.ball.rotation.z+=.025;}
      ring.rotation.z+=.0015;
      camera.position.x=Math.sin(t*.12)*.14;camera.lookAt(0,.45,0);
      renderer.render(scene,camera);
    };
    animate();
    const dispose=()=>{disposed=true;cancelAnimationFrame(raf);observer?.disconnect();renderer.dispose();scene.traverse(o=>{o.geometry?.dispose?.();if(o.material){if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material.dispose();}});renderer.domElement.remove();if(active?.container===container)active=null;};
    active={container,dispose,gameId};
    return dispose;
  } catch(error) {
    console.warn('[Kazino Lakay 3D]',gameId,error?.message||error);
    renderer?.dispose?.();container.querySelector('.three-scene-canvas')?.remove();
    return () => {};
  }
}
export function disposeGame3D() { if(active) active.dispose(); }
