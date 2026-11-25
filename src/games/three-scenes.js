import * as THREE from 'three';
import { createPenaltyAthlete, animatePenaltyAthlete } from './penalty-athlete.js';
import { attachPenaltyRig } from './penalty-rig.js';

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
const smooth01 = (value) => { const n=Math.max(0,Math.min(1,Number(value)||0)); return n*n*(3-2*n); };
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

function makeLabelSprite(text,color='#ffffff') {
  const canvas=document.createElement('canvas'); canvas.width=512; canvas.height=128;
  const ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,512,128);
  ctx.fillStyle='rgba(3,12,25,.78)';
  ctx.beginPath(); ctx.moveTo(36,18); ctx.lineTo(476,18); ctx.quadraticCurveTo(500,18,500,42); ctx.lineTo(500,88); ctx.quadraticCurveTo(500,112,476,112); ctx.lineTo(36,112); ctx.quadraticCurveTo(12,112,12,88); ctx.lineTo(12,42); ctx.quadraticCurveTo(12,18,36,18); ctx.closePath(); ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,.72)'; ctx.lineWidth=4; ctx.stroke();
  ctx.fillStyle=color; ctx.font='900 42px Arial'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.shadowColor='#000'; ctx.shadowBlur=8; ctx.fillText(String(text).toUpperCase().slice(0,24),256,66);
  const texture=new THREE.CanvasTexture(canvas); texture.colorSpace=THREE.SRGBColorSpace;
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false}));
  sprite.scale.set(2.25,.56,1); return sprite;
}
function makeBodyPart(parent,geometry,mat,pos,rot=[0,0,0]) {
  const mesh=new THREE.Mesh(geometry,mat); mesh.position.set(...pos); mesh.rotation.set(...rot);
  mesh.castShadow=true; mesh.receiveShadow=true; parent.add(mesh); return mesh;
}
function addFootballer(scene,x,z,shirt,keeper=false,name='PLAYER',number=10,shortColor='#172d4d') {
  const athlete=createPenaltyAthlete({x,z,shirt,keeper,name,number,shortColor});
  scene.add(athlete);
  return athlete;
}
function addCrowd(scene,accent) {
  const crowdGeo=new THREE.SphereGeometry(.045,6,5);
  const palette=['#d9e1ea','#b8c5d4','#e7c9a3','#4c78a8','#d84d59','#e2c65e','#f2f4f5','#17253a'];
  const crowdMat=palette.map(c=>material(c,.92,.01));
  const inst=crowdMat.map(m=>new THREE.InstancedMesh(crowdGeo,m,320));
  inst.forEach(mesh=>{mesh.castShadow=false;mesh.receiveShadow=false;mesh.count=0;scene.add(mesh);});
  let n=0;
  for(let tier=0;tier<12;tier++) for(let seat=0;seat<180;seat++) {
    const angle=(seat/179)*Math.PI;
    const x=Math.cos(angle)*(5.1+tier*.38);
    const z=-4.8+Math.sin(angle)*(2.2+tier*.2);
    const y=1.35+tier*.23+(seat%5)*.018;
    const idx=(seat*7+tier*13)%palette.length, mesh=inst[idx], k=mesh.count;
    const obj=new THREE.Object3D(); obj.position.set(x,y,z); obj.scale.set(.85,1.15,.85); obj.rotation.y=(seat%9)*.12; obj.updateMatrix();
    mesh.setMatrixAt(k,obj.matrix); mesh.count++; n++;
  }
  inst.forEach(mesh=>{mesh.instanceMatrix.needsUpdate=true;});
  // Two waving black supporter flags.
  for(let i=0;i<3;i++) {
    const pole=box(scene,-4.8+i*4.8,2.5,-5.05,.025,1.8,.025,'#aeb9c8');
    const flag=box(scene,-4.5+i*4.8,3.05,-5.05,.62,.34,.025,'#10131b'); flag.userData.wave=i*.8; scene.userData.penaltyFlags ||= []; scene.userData.penaltyFlags.push(flag);
  }
}
function addAdBoard(scene) {
  const canvas=document.createElement('canvas'); canvas.width=1024; canvas.height=128;
  const ctx=canvas.getContext('2d');
  const grad=ctx.createLinearGradient(0,0,1024,0); grad.addColorStop(0,'#713b89'); grad.addColorStop(.5,'#d84e9d'); grad.addColorStop(1,'#47246e');
  ctx.fillStyle=grad; ctx.fillRect(0,0,1024,128);
  ctx.fillStyle='#ffffff'; ctx.font='900 48px Arial'; ctx.textAlign='center'; ctx.fillText('KAZINO LAKAY  •  PENALTY LAKAY',512,57);
  ctx.fillStyle='#76f0bd'; ctx.font='800 24px Arial'; ctx.fillText('JWE AK PASYON  •  JWE AK RESPÈ',512,96);
  const tex=new THREE.CanvasTexture(canvas); tex.colorSpace=THREE.SRGBColorSpace;
  const board=new THREE.Mesh(new THREE.PlaneGeometry(9.2,1.15),new THREE.MeshBasicMaterial({map:tex}));
  board.position.set(0,1.1,-5.65); scene.add(board);
}
function makePitchGrassTexture() {
  const canvas=document.createElement('canvas'); canvas.width=512; canvas.height=512;
  const ctx=canvas.getContext('2d'); ctx.fillStyle='#176b38'; ctx.fillRect(0,0,512,512);
  for(let i=0;i<14;i++){ctx.fillStyle=i%2?'rgba(104,177,87,.12)':'rgba(3,45,20,.10)';ctx.fillRect(0,i*512/14,512,512/14);}
  let seed=90210; const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<18000;i++){const x=rand()*512,y=rand()*512;ctx.strokeStyle=rand()>.5?'rgba(145,194,104,.22)':'rgba(3,39,18,.2)';ctx.lineWidth=.5+rand();ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+(rand()-.5)*3,y-2-rand()*5);ctx.stroke();}
  const tex=new THREE.CanvasTexture(canvas); tex.colorSpace=THREE.SRGBColorSpace; tex.wrapS=tex.wrapT=THREE.RepeatWrapping; tex.repeat.set(2,2); tex.anisotropy=4; return tex;
}
function addStadium(scene,accent,options={}) {
  const team=options.team||{};
  const shirt=team.primary||'#d52d45', shorts=team.secondary||'#143b7b';
  // Full pitch surface with procedural grass-blade texture and mowing bands.
  const pitch=new THREE.Mesh(new THREE.PlaneGeometry(15,13),new THREE.MeshStandardMaterial({map:makePitchGrassTexture(),roughness:.96,metalness:0})); pitch.rotation.x=-Math.PI/2; pitch.position.y=-.165; pitch.receiveShadow=true; scene.add(pitch);
  box(scene,0,-.34,0,15,.32,13,'#14552f');
  for(let i=0;i<14;i++) box(scene,-6.95+i*1.07,-.158,0,1.04,.006,12.7,i%2?'#197441':'#21824a');
  // Penalty box, six-yard box, goal line and spot.
  box(scene,0,-.145,-5.1,15,.014,.025,'#f5f8ed');
  for(const [w,z,d] of [[7.4,-3.35,3.5],[3.5,-4.2,1.65]]) {
    box(scene,-w/2,-.135,z,w,.018,.025,'#f5f8ed');
    box(scene,w/2,-.135,z,.025,.018,d,'#f5f8ed');
    box(scene,0,-.135,z-d/2,w,.018,.025,'#f5f8ed');
  }
  sphere(scene,0,-.105,-2.2,.065,'#ffffff',16);
  // Midfield markings and centre circle complete the full-size pitch composition.
  box(scene,0,-.132,0,15,.014,.025,'#f5f8ed');
  const centreRing=new THREE.Mesh(new THREE.RingGeometry(1.08,1.12,64),new THREE.MeshBasicMaterial({color:'#f5f8ed',side:THREE.DoubleSide}));
  centreRing.rotation.x=-Math.PI/2; centreRing.position.set(0,-.125,0); scene.add(centreRing);
  sphere(scene,0,-.105,0,.045,'#f5f8ed',12);
  // Penalty arc (D) and corner arcs.
  const arcCurve=new THREE.EllipseCurve(0,0,1.72,1.72,Math.PI*.08,Math.PI*.92,false,0);
  const arcPoints=arcCurve.getPoints(48).map(p=>new THREE.Vector3(p.x,-.126,-2.2+p.y));
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(arcPoints),new THREE.LineBasicMaterial({color:'#f5f8ed'})));
  for(const cx of [-7.15,7.15]) for(const cz of [-6.05,6.05]) {
    const pts=[]; for(let i=0;i<=12;i++){const a=(i/12)*Math.PI/2;pts.push(new THREE.Vector3(cx+Math.cos(a)*.38,-.125,cz+Math.sin(a)*.38));}
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:'#f5f8ed'})));
  }
  // Stadium bowl, distant stands and roof.
  for(const side of [-1,1]) {
    for(let tier=0;tier<8;tier++) {
      const x=side*(6.5+tier*.35), y=1.25+tier*.28;
      box(scene,x,y,-.1,.3,.18,11.6,'#33465d');
    }
    box(scene,side*8.1,3.25,-.1,.12,6.4,12,'#9caabd');
    box(scene,side*6.4,4.25,-.1,3.8,.13,12.4,'#26364b');
    for(let z=-5;z<=5;z+=2.5) {
      const beam=box(scene,side*6.9,3.85,z,.08,1.0,.08,'#b8c5d4'); beam.rotation.z=side*.3;
      const lamp=box(scene,side*6.7,4.75,z,.72,.18,.34,'#fff2c5');
      lamp.material.emissive=new THREE.Color('#fff0bd'); lamp.material.emissiveIntensity=.8;
      const light=new THREE.PointLight(0xffedc2,11,9); light.position.set(side*6.7,4.8,z); scene.add(light);
    }
  }
  addCrowd(scene,accent); addAdBoard(scene);
  // 3D goal frame and fine tensioned white net.
  const goalZ=-4.9, goalW=3.9, goalH=1.65;
  const postMat=material('#f8faf7',.28,.16);
  const post=(x,y,z,sx,sy,sz)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),postMat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;scene.add(m);};
  post(0,goalH,goalZ,goalW,.085,.085);
  post(-goalW/2,goalH/2,goalZ,.085,goalH,.085); post(goalW/2,goalH/2,goalZ,.085,goalH,.085);
  post(0,.04,goalZ+.95,goalW,.055,.055);
  // Recessed net roof, back and side panels: visible depth from the broadcast camera.
  const netMat=new THREE.LineBasicMaterial({color:'#e8f0ec',transparent:true,opacity:.48});
  for(let x=-goalW/2;x<=goalW/2;x+=.24) {
    const back=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x,.08,goalZ+.95),new THREE.Vector3(x,goalH-.05,goalZ+.95)]),netMat); scene.add(back);
    const roof=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x,goalH,goalZ),new THREE.Vector3(x,goalH,goalZ+.95)]),netMat); scene.add(roof);
  }
  for(const side of [-1,1]) for(let y=.12;y<=goalH;y+=.16) {
    const sideNet=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(side*goalW/2,y,goalZ),new THREE.Vector3(side*goalW/2,y,goalZ+.95)]),netMat); scene.add(sideNet);
  }
  for(let x=-goalW/2;x<=goalW/2;x+=.16) {
    const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x,.08,goalZ+.04),new THREE.Vector3(x,goalH-.05,goalZ+.04)]),new THREE.LineBasicMaterial({color:'#e8f0ec'})); scene.add(line);
  }
  for(let y=.08;y<=goalH;y+=.13) {
    const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-goalW/2,y,goalZ+.04),new THREE.Vector3(goalW/2,y,goalZ+.04)]),new THREE.LineBasicMaterial({color:'#e8f0ec'})); scene.add(line);
  }
  // Keeper at the centre of the goal; shooter is framed from behind on the lower-right.
  const keeper=addFootballer(scene,0,-4.35,'#2772c8',true,options.keeperName||'ANGELO PERUZZI',1,'#18253a');
  keeper.rotation.y=0;
  const striker=addFootballer(scene,0,1.05,shirt,false,options.playerName||team.player?.name||'LIONEL MESSI',numberForTeam(team),shorts);
  striker.rotation.y=Math.PI;
  // Match ball on the penalty spot with panel geometry and a soft contact shadow.
  const ballGroup=new THREE.Group(); ballGroup.position.set(0,.015,-2.2); scene.add(ballGroup);
  const ballMat=material('#f8f8f2',.3,.02);
  makeBodyPart(ballGroup,new THREE.SphereGeometry(.17,32,24),ballMat,[0,0,0]);
  for(let i=0;i<5;i++) {
    const a=i*Math.PI*2/5, patch=new THREE.Mesh(new THREE.CircleGeometry(.047,5),material('#17212a',.68,.01));
    patch.position.set(Math.cos(a)*.145,Math.sin(a)*.145,.095); ballGroup.add(patch);
  }
  const shadow=new THREE.Mesh(new THREE.CircleGeometry(.25,24),new THREE.MeshBasicMaterial({color:'#06130b',transparent:true,opacity:.38}));
  shadow.rotation.x=-Math.PI/2; shadow.position.set(0,-.16,0); ballGroup.add(shadow);
  return {ball:ballGroup,striker,keeper};
}
function numberForTeam(team) { return Number(team.player?.shirtNumber||10); }

function buildScene(scene,id,accent,secondary,options={}) {
  const animated=[];
  if(id==='penalty') return {animated,...addStadium(scene,accent,options)};
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
export function mountGame3D(container, gameId, options={}) {
  if(!container || !THEMES[gameId]) return () => {};
  if(active?.container===container) return active.dispose;
  if(active) active.dispose();
  let renderer;
  try {
    const [bg,accent,secondary]=THEMES[gameId];
    const scene=new THREE.Scene();scene.background=new THREE.Color(bg);
    scene.fog=new THREE.Fog(bg,9,24);
    const camera=new THREE.PerspectiveCamera(gameId==='penalty'?42:42,1,.1,100);
    if(gameId==='penalty'){camera.position.set(2.7,3.05,8.9);camera.lookAt(0,1.0,-3.25);}else{camera.position.set(0,4.8,9.6);camera.lookAt(0,.45,0);}
    renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
    // Keep mobile GPU load bounded while preserving extra detail on larger screens.
    const renderCap=window.innerWidth<=600?1.35:1.7;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,renderCap));
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.16;
    renderer.domElement.className='three-scene-canvas';renderer.domElement.setAttribute('aria-hidden','true');
    container.appendChild(renderer.domElement);
    addLights(scene,accent);
    const floor= new THREE.Mesh(new THREE.PlaneGeometry(22,22),material(bg,.92,0));floor.rotation.x=-Math.PI/2;floor.position.y=-.42;floor.receiveShadow=true;scene.add(floor);
    const stage=buildScene(scene,gameId,accent,secondary,options);
    const ring=torus(scene,0,-.29,0,4.1,.025,accent);ring.material.transparent=true;ring.material.opacity=.45;
    const labelGroup=new THREE.Group();scene.add(labelGroup);
    const clock=new THREE.Clock();let frame=0;let disposed=false;let raf=0;let shotStartedAt=null;let shotDetail=options.shot?{shot:options.shot,shotX:options.shotX??.5}:null;
    const onPenaltyShot=(event)=>{const detail=event.detail&&typeof event.detail==='object'?event.detail:{};const rawX=Number(detail.shotX??.5);shotDetail={...detail,shotX:Number.isFinite(rawX)?Math.max(.02,Math.min(.98,rawX)):.5};shotStartedAt=clock.getElapsedTime();};
    if(gameId==='penalty') {
      container.addEventListener('penalty-shot-start',onPenaltyShot);
      // Load the shared skinned CC0 character once, then clone it for striker
      // and goalkeeper. If the external asset is unreachable, keep the current
      // procedural 3D athletes instead of blocking the penalty scene.
      Promise.all([
        attachPenaltyRig(stage.striker,{isActive:()=>!disposed}),
        attachPenaltyRig(stage.keeper,{isActive:()=>!disposed})
      ]).then(([strikerReady,keeperReady])=>{
        if(strikerReady||keeperReady) container.dataset.playerRig='skinned';
      }).catch(error=>console.warn('[Penalty Lakay] Skinned player setup failed.',error));
    }
    const resize=()=>{const w=Math.max(1,container.clientWidth),h=Math.max(1,container.clientHeight);camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);};
    const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(resize):null;observer?.observe(container);resize();
    const animate=()=>{if(disposed)return;raf=requestAnimationFrame(animate);const delta=clock.getDelta();const t=clock.elapsedTime;frame++;
      stage.animated.forEach((obj,i)=>{
        const base=obj.userData.baseY ?? (obj.userData.baseY=obj.position.y);
        obj.rotation.y+=.003+(i%3)*.001;
        obj.position.y=base+Math.sin(t*(gameId==='plinko'?2.4:1.25)+i)*.035;
        if(gameId==='dice'||gameId==='sicbo') obj.rotation.x+=.009+(i%2)*.004;
        if(gameId==='roulette'||gameId==='wheel'||gameId==='coinflip') obj.rotation.z+=gameId==='coinflip'?.045:.012;
        if(gameId==='crash'&&i===stage.animated.length-1) obj.position.x=Math.sin(t*.42)*2.1;
        if(gameId==='plinko'&&i===stage.animated.length-1) obj.position.z=1+Math.sin(t*1.7)*.5;
      });
      const penaltyElapsed=shotStartedAt===null?-1:t-shotStartedAt;
      if(stage.ball){if(gameId==='penalty'){
        stage.ball.rotation.x+=.035;stage.ball.rotation.y+=.012;stage.ball.rotation.z+=.022;
        if(penaltyElapsed>=0&&penaltyElapsed<2.1){
          const flight=smooth01((penaltyElapsed-.48)/.78);
          stage.ball.position.y=.015+Math.sin(flight*Math.PI)*.85;
          stage.ball.position.z=-2.2-flight*2.9;
          stage.ball.position.x=((Number(shotDetail?.shotX??.5)-.5)*3.2)*flight;
        }else if(penaltyElapsed>=2.1){
          stage.ball.position.set(0,.015,-2.2);
          if(stage.keeper){stage.keeper.position.set(0,0,-4.35);stage.keeper.rotation.set(0,0,0);}
          shotStartedAt=null;
        }
      }else{stage.ball.position.x=-.72+Math.sin(t*.7)*.035;stage.ball.rotation.x+=.018;stage.ball.rotation.z+=.025;}}
      if(gameId==='penalty'&&stage.striker){
        const elapsed=penaltyElapsed;
        const approach=elapsed<0?0:smooth01(elapsed/.48);
        const run=elapsed>=0&&elapsed<.5?1:0;
        const runPhase=elapsed<0?0:elapsed*Math.PI*2*2.45;
        const kick=elapsed<0?0:smooth01((elapsed-.37)/.21)*(1-smooth01((elapsed-1.05)/.38));
        const follow=elapsed<0?0:smooth01((elapsed-.60)/.24)*(1-smooth01((elapsed-1.45)/.4));
        stage.striker.position.x=-Math.sin(approach*Math.PI)*.08;
        stage.striker.position.z=1.05-2.6*approach;
        stage.striker.rotation.x=-run*.09-kick*.1+follow*.04;
        stage.striker.rotation.z=Math.sin(runPhase)*-.045*run;
        animatePenaltyAthlete(stage.striker,t,{run,runPhase,kick,follow,delta});
      }
      if(gameId==='penalty'&&stage.keeper){
        const dive=penaltyElapsed<0?0:smooth01((penaltyElapsed-.58)/.60);
        const rawSide=(Number(shotDetail?.shotX??.5)-.5)*2;
        const side=Math.max(-1,Math.min(1,rawSide));
        stage.keeper.position.x=side*1.7*dive;
        stage.keeper.rotation.z=side*-.88*dive;
        stage.keeper.rotation.x=-dive*.13;
        stage.keeper.rotation.y=side*.14*dive;
        animatePenaltyAthlete(stage.keeper,t,{dive,side,delta});
      }
      if(gameId==='penalty') scene.userData.penaltyFlags?.forEach(flag=>{flag.rotation.z=Math.sin(t*2.1+flag.userData.wave)*.14;});
      ring.rotation.z+=.0015;
      if(gameId!=='penalty'){camera.position.x=Math.sin(t*.12)*.14;camera.lookAt(0,.45,0);}
      renderer.render(scene,camera);
    };
    animate();
    const dispose=()=>{disposed=true;cancelAnimationFrame(raf);observer?.disconnect();if(gameId==='penalty')container.removeEventListener('penalty-shot-start',onPenaltyShot);renderer.dispose();scene.traverse(o=>{o.geometry?.dispose?.();if(o.material){if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material.dispose();}});renderer.domElement.remove();if(active?.container===container)active=null;};
    active={container,dispose,gameId};
    return dispose;
  } catch(error) {
    console.error('[Kazino Lakay 3D]',gameId,error);
    renderer?.dispose?.();
    container.querySelector('.three-scene-canvas')?.remove();
    // Penalty Lakay is a native 3D experience only: never substitute a 2D imitation.
    if(gameId==='penalty') {
      container.dataset.sceneError='webgl-unavailable';
      container.querySelector('.penalty-scene-unavailable')?.remove();
      const notice=document.createElement('div');
      notice.className='penalty-scene-unavailable';
      notice.setAttribute('role','alert');
      notice.innerHTML='<strong>PENALTY LAKAY 3D PA KA DEMARE</strong><span>Aktive WebGL ak akselerasyon grafik nan navigatè a, epi relouvri jwèt la.</span>';
      container.appendChild(notice);
      container.dispatchEvent(new CustomEvent('penalty-scene-error',{detail:{message:String(error?.message||error)}}));
    }
    return () => {};
  }
}
export function disposeGame3D() { if(active) active.dispose(); }