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
  const key=new THREE.DirectionalLight(0xffffff,3.1); key.position.set(5,9,7); key.castShadow=true; key.shadow.mapSize.set(1024,1024); scene.add(key);
  const rim=new THREE.PointLight(accent,36,18); rim.position.set(-5,3,-3); scene.add(rim);
}
function addFootballer(scene,x,z,shirt,keeper=false) {
  const group=new THREE.Group(); group.position.set(x,0,z); scene.add(group);
  const skin=material('#9a6749',.72,.02), fabric=material(shirt,.7,.02), shorts=material(keeper?'#26364b':'#172d4d',.78,.02), boots=material('#101820',.55,.08);
  const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.27,.48,5,10),fabric); torso.position.y=1.12; group.add(torso);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.19,20,16),skin); head.position.y=1.68; group.add(head);
  const hair=new THREE.Mesh(new THREE.SphereGeometry(.195,16,10,0,Math.PI*2,0,Math.PI*.48),material('#17191d')); hair.position.y=1.76; group.add(hair);
  for(const side of [-1,1]) {
    const arm=new THREE.Mesh(new THREE.CapsuleGeometry(.085,.43,4,8),fabric); arm.position.set(side*.34,1.12,.015); arm.rotation.z=side*(keeper?.72:.18); group.add(arm);
    const hand=new THREE.Mesh(new THREE.SphereGeometry(.09,12,10),skin); hand.position.set(side*(keeper?.68:.39),keeper?1.35: .82,.02); group.add(hand);
    const leg=new THREE.Mesh(new THREE.CapsuleGeometry(.105,.48,4,8),shorts); leg.position.set(side*.13,.48,0); leg.rotation.z=side*.06; group.add(leg);
    const boot=new THREE.Mesh(new THREE.BoxGeometry(.17,.1,.31),boots); boot.position.set(side*.13,.12,-.07); group.add(boot);
  }
  return group;
}
function addStadium(scene,accent) {
  // Full-size pitch and marked penalty area.
  box(scene,0,-.34,0,15,.32,11,'#176b3d');
  for(let i=0;i<10;i++) box(scene,-6.7+i*1.48,-.165,0,1.43,.012,10.65,i%2?'#197441':'#1c8048');
  for(let x=-6;x<=6;x+=1.5) box(scene,x,-.145,0,.018,.012,10.4,'#c8e8cf');
  box(scene,0,-.14,0,.025,.014,10.4,'#eaf5e8');
  box(scene,0,-.13,0,15,.014,.025,'#eaf5e8');
  torus(scene,0,-.12,0,1.05,.018,'#eaf5e8');
  // Penalty box and six-yard box lines facing the camera.
  for(const [w,d,z] of [[7.4,3.2,-3.35],[3.5,1.45,-4.15]]) {
    box(scene,-w/2,-.12,z,w,.014,.022,'#edf6eb');
    box(scene,w/2,-.12,z,w,.014,.022,'#edf6eb');
    box(scene,0,-.12,z-d/2,.022,.014,d,'#edf6eb');
  }
  sphere(scene,0,-.095,-2.2,.055,'#ffffff',12);
  // Stadium bowl, tiered seats and roof canopy.
  for(const side of [-1,1]) {
    box(scene,side*7.65,1.05,0,.48,2.7,11.4,'#26364b');
    for(let tier=0;tier<7;tier++) {
      const y=2.1+tier*.28, z=-5.15+tier*.12;
      box(scene,side*(7.1+tier*.12),y,0,.32,.16,11.1,'#34465e');
      for(let seat=0;seat<34;seat++) {
        const color=(seat+tier)%7===0?accent:(seat+tier)%3===0?'#d5dce5':'#65758c';
        box(scene,side*(7.15+tier*.12),y+.13,-5.15+seat*.31,.25,.15,.23,color);
      }
    }
    // Roof supports and canopy.
    box(scene,side*7.1,4.45,0,.16,.18,11.8,'#9ba9b8');
    box(scene,side*5.2,4.75,0,4.2,.12,11.7,'#26364b');
    for(let z=-5;z<=5;z+=2.5) {
      const beam=box(scene,side*6.1,4.35,z,.09,1.0,.09,'#b5c2cf'); beam.rotation.z=side*.32;
    }
    // Floodlight banks.
    for(let z=-4.5;z<=4.5;z+=3) {
      const mast=box(scene,side*7.0,4.0,z,.075,2.0,.075,'#d4dce5');
      const lamp=box(scene,side*6.9,5.05,z,.72,.18,.34,'#fff2c5');
      lamp.material.emissive=new THREE.Color('#fff0bd'); lamp.material.emissiveIntensity=.5;
      const light=new THREE.PointLight(0xffedc2,9,8); light.position.set(side*6.7,4.9,z); scene.add(light);
    }
  }
  // Goal frame, tensioned net grid and rear supports.
  const goalZ=-4.9, goalW=3.7, goalH=1.35;
  box(scene,0,goalH,goalZ,goalW,.095,.095,'#f7f8f3');
  for(const x of [-goalW/2,goalW/2]) box(scene,x,goalH/2,goalZ,.095,goalH,.095,'#f7f8f3');
  box(scene,0,.045,goalZ+.8,goalW,.07,.07,'#e8eee9');
  for(const x of [-goalW/2,goalW/2]) box(scene,x,.68,goalZ+.8,.07,1.35,.07,'#dfe8e5');
  for(let x=-goalW/2+.08;x<goalW/2;x+=.19) box(scene,x,.68,goalZ+.1,.012,1.25,.012,'#d8e5e2');
  for(let y=.12;y<1.35;y+=.16) box(scene,0,y,goalZ+.1,goalW-.08,.012,.012,'#d8e5e2');
  // Keeper and penalty taker, with articulated silhouettes.
  const striker=addFootballer(scene,-.72,-1.25,'#123f99',false);
  striker.rotation.y=.12;
  const keeper=addFootballer(scene,0,-4.55,'#e5b82d',true);
  keeper.scale.set(.94,.94,.94);
  // Football with raised black pentagon panels.
  const ballGroup=new THREE.Group(); ballGroup.position.set(-.72,.19,-.28); scene.add(ballGroup);
  const ball=new THREE.Mesh(new THREE.SphereGeometry(.17,32,24),material('#f7f7f1',.34,.03)); ballGroup.add(ball);
  for(let i=0;i<5;i++) {
    const a=i*Math.PI*2/5;
    const patch=new THREE.Mesh(new THREE.CircleGeometry(.045,5),material('#17212a',.65,.02));
    patch.position.set(Math.cos(a)*.145,Math.sin(a)*.145,.09); ballGroup.add(patch);
  }
  return {ball:ballGroup};
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
  // Add recognizable set pieces so each 3D room has a distinct identity.
  switch(id) {
    case 'blackjack':
      for (const x of [-2.35,2.35]) { const chip=cylinder(scene,x,.34,.9,.34,.34,.12,x<0?'#b83b45':'#2869a8',32); chip.rotation.x=Math.PI/2; animated.push(chip); }
      box(scene,0,.38,-2.35,2.1,.12,.16,'#d8bd79'); break;
    case 'baccarat':
      for(let i=0;i<3;i++){const shoe=box(scene,-2.1+i*2.1,.46,-1.7,.85,.22,1.15,'#5a1735',0,(i-1)*.08,0);animated.push(shoe);}
      torus(scene,0,.38,1.65,.82,.08,'#e5bd73'); break;
    case 'casinowar':
      for(const x of [-1.55,1.55]){const crest=sphere(scene,x,.95,-1.1,.32,x<0?accent:secondary);animated.push(crest);}
      box(scene,0,.3,1.75,2.6,.08,.12,'#d9c28a'); break;
    case 'dragontiger':
      for(const x of [-2.25,2.25]){const orb=sphere(scene,x,.92,-1.15,.7,x<0?accent:secondary,32);animated.push(orb);torus(scene,x,.92,-1.15,.78,.055,'#e6c77c',0);} break;
    case 'andarbahar':
      cylinder(scene,0,.36,1.25,.78,.78,.12,'#d3ae64',48);
      for(let i=0;i<7;i++){const bead=sphere(scene,Math.cos(i*Math.PI*2/7)*1.55,.42,Math.sin(i*Math.PI*2/7)*1.55,.13,accent,12);animated.push(bead);} break;
    case 'threecard':
      for(let i=0;i<3;i++){const card=box(scene,(i-1)*.92,.56,1.2,.68,.09,1.05,'#f4edda',0,(i-1)*.12,0);animated.push(card);} break;
    case 'holdem':
      for(let i=0;i<2;i++){const card=box(scene,-.55+i*1.1,.62,-1.65,.72,.09,1.05,'#f7f0df',0,(i?1:-1)*.08,0);animated.push(card);}
      for(let i=0;i<5;i++){const card=box(scene,-1.8+i*.9,.44,.85,.55,.07,.82,'#f7f0df',0,(i-2)*.035,0);animated.push(card);} break;
    case 'keno':
      for(let i=0;i<5;i++){const tube=cylinder(scene,-2+i,.52,1.75,.18,.18,.8,'#d5e8f1',24);tube.rotation.z=.18;animated.push(tube);} break;
    case 'bingo':
      {const cage=new THREE.Mesh(new THREE.IcosahedronGeometry(1.15,1),material('#b8d6e4',.38,.45));cage.position.set(0,1.05,-1.1);scene.add(cage);animated.push(cage);}
      for(let i=0;i<6;i++){const ball=sphere(scene,Math.cos(i)*1.25,.7,Math.sin(i)*1.25,.18,i%2?accent:secondary,16);animated.push(ball);} break;
    case 'dice': case 'sicbo':
      for(let i=0;i<(id==='dice'?2:3);i++){const die=box(scene,(i-(id==='dice'?.5:1))*1.25,.95,1.2,.82,.82,.82,'#fff9ed');die.rotation.set(.2+i*.3,.4+i*.5,.1);animated.push(die);} break;
    case 'mines':
      for(let i=0;i<5;i++){const marker=torus(scene,(i-2)*.82,.28,1.55,.22,.045,'#ef7d55',0);animated.push(marker);} break;
    case 'plinko':
      for(let i=0;i<7;i++){const bin=box(scene,(i-3)*.62,.18,2.35,.55,.32,.62,i===3?'#d8bd79':'#49366b');animated.push(bin);} break;
    case 'scratch':
      for(let i=0;i<3;i++){const prize=sphere(scene,(i-1)*1.4,.88,1.15,.28,i===1?accent:secondary,20);animated.push(prize);} break;
    case 'wheel':
      for(let i=0;i<8;i++){const marker=sphere(scene,Math.cos(i*Math.PI/4)*2.15,.48,Math.sin(i*Math.PI/4)*2.15,.12,i%2?accent:secondary,12);animated.push(marker);} break;
    case 'coinflip': torus(scene,0,.9,0,.96,.07,secondary,0); break;
    case 'limbo':
      for(let i=0;i<3;i++){const gate=torus(scene,0,.7+i*.58,-.6,.95+i*.22,.045,i%2?accent:secondary,0);animated.push(gate);} break;
    case 'crash':
      {const horizon=box(scene,0,2.35,-2.2,7,.035,.035,'#8cc9df');horizon.material.emissive=new THREE.Color('#8cc9df');horizon.material.emissiveIntensity=.35;} break;
    case 'slots':
      for(let i=-1;i<=1;i++){const crown=torus(scene,i*1.65,2.65,-.8,.42,.08,secondary,0);animated.push(crown);} break;
    case 'roulette':
      for(let i=0;i<8;i++){const marker=sphere(scene,Math.cos(i*Math.PI/4)*2.15,.48,Math.sin(i*Math.PI/4)*2.15,.12,i%2?accent:secondary,12);animated.push(marker);} break;
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
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
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
      stage.animated.forEach((obj,i)=>{
        const base=obj.userData.baseY ?? (obj.userData.baseY=obj.position.y);
        obj.rotation.y+=.003+(i%3)*.001;
        obj.position.y=base+Math.sin(t*(gameId==='plinko'?2.4:1.25)+i)*.035;
        if(gameId==='dice'||gameId==='sicbo') obj.rotation.x+=.009+(i%2)*.004;
        if(gameId==='roulette'||gameId==='wheel'||gameId==='coinflip') obj.rotation.z+=gameId==='coinflip'?.045:.012;
        if(gameId==='crash'&&i===stage.animated.length-1) obj.position.x=Math.sin(t*.42)*2.1;
        if(gameId==='plinko'&&i===stage.animated.length-1) obj.position.z=1+Math.sin(t*1.7)*.5;
      });
      if(stage.ball){stage.ball.position.x=-.72+Math.sin(t*.7)*.035;stage.ball.rotation.x+=.018;stage.ball.rotation.z+=.025;}
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
