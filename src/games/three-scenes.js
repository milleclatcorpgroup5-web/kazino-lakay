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
function addFootballer(scene,x,z,shirt,keeper=false,name='PLAYER',number=10,shortColor='#172d4d',targetHeight=keeper?1.90:1.70) {
  const athlete=createPenaltyAthlete({x,z,shirt,keeper,name,number,shortColor,targetHeight});
  scene.add(athlete);
  return athlete;
}
function addCrowd(scene,accent) {
  // Dense, low-poly spectators begin directly behind the advertising strip.
  const crowdGeo=new THREE.SphereGeometry(.055,7,6);
  const palette=['#d9e1ea','#b8c5d4','#e7c9a3','#4c78a8','#d84d59','#e2c65e','#f2f4f5','#17253a'];
  const mats=palette.map(color=>material(color,.94,.01));
  const batches=mats.map(mat=>new THREE.InstancedMesh(crowdGeo,mat,600));
  batches.forEach(mesh=>{mesh.count=0;mesh.castShadow=false;mesh.receiveShadow=false;scene.add(mesh);});
  for(let tier=0;tier<14;tier++) for(let seat=0;seat<300;seat++) {
    const across=(seat/299-.5)*47;
    const x=across+(tier%2)*.035;
    const z=-15.5-tier*.34;
    const y=1.05+tier*.24+(seat%4)*.012;
    const idx=(seat*7+tier*11)%palette.length, mesh=batches[idx], index=mesh.count;
    const person=new THREE.Object3D();
    person.position.set(x,y,z);
    person.scale.set(.78,1.22,.82);
    person.rotation.y=((seat%7)-3)*.035;
    person.updateMatrix();
    mesh.setMatrixAt(index,person.matrix); mesh.count++;
  }
  batches.forEach(mesh=>{mesh.instanceMatrix.needsUpdate=true;});
  scene.userData.penaltyFlags=[];
  for(let i=0;i<5;i++) {
    const x=-18+i*9;
    box(scene,x,2.5,-15.2,.035,2.0,.035,'#aeb9c8');
    const flag=box(scene,x+.45,3.15,-15.2,.9,.55,.035,'#10131b');
    flag.userData.wave=i*.8; scene.userData.penaltyFlags.push(flag);
  }
}

function addAdBoard(scene) {
  const canvas=document.createElement('canvas'); canvas.width=2048; canvas.height=256;
  const ctx=canvas.getContext('2d');
  const grad=ctx.createLinearGradient(0,0,2048,0);
  grad.addColorStop(0,'#713b89'); grad.addColorStop(.5,'#d84e9d'); grad.addColorStop(1,'#47246e');
  ctx.fillStyle=grad; ctx.fillRect(0,0,2048,256);
  ctx.fillStyle='#ffffff'; ctx.font='900 88px Arial'; ctx.textAlign='center';
  ctx.fillText('KAZINO LAKAY  •  PENALTY LAKAY',1024,112);
  ctx.fillStyle='#76f0bd'; ctx.font='800 48px Arial';
  ctx.fillText('JWE AK PASYON  •  JWE AK RESPÈ',1024,194);
  const tex=new THREE.CanvasTexture(canvas); tex.colorSpace=THREE.SRGBColorSpace;
  const board=new THREE.Mesh(new THREE.PlaneGeometry(45.32,.9),new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide}));
  board.position.set(0,.45,-14.5); scene.add(board);
}

function makePitchGrassTexture() {
  // Deterministic, texture-only turf detail: no external image or network request.
  const size=1024;
  const canvas=document.createElement('canvas'); canvas.width=size; canvas.height=size;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#1b713d'; ctx.fillRect(0,0,size,size);

  // Mowing bands vary along local texture Y, so every stripe runs parallel to the goal line.
  const lanes=16, laneHeight=size/lanes;
  for(let i=0;i<lanes;i++) {
    const y=i*laneHeight;
    const grad=ctx.createLinearGradient(0,y,0,y+laneHeight);
    if(i%2) {
      grad.addColorStop(0,'rgba(115,190,105,.025)');
      grad.addColorStop(.18,'rgba(135,205,119,.105)');
      grad.addColorStop(.5,'rgba(125,198,111,.12)');
      grad.addColorStop(.82,'rgba(135,205,119,.105)');
      grad.addColorStop(1,'rgba(115,190,105,.025)');
    } else {
      grad.addColorStop(0,'rgba(3,42,20,.025)');
      grad.addColorStop(.2,'rgba(3,42,20,.075)');
      grad.addColorStop(.5,'rgba(3,42,20,.09)');
      grad.addColorStop(.8,'rgba(3,42,20,.075)');
      grad.addColorStop(1,'rgba(3,42,20,.025)');
    }
    ctx.fillStyle=grad; ctx.fillRect(0,y,size,laneHeight+1);
  }

  // Subtle irregular turf patches break up the repeated stripe pattern.
  let patchSeed=481516;
  const patchRand=()=>{patchSeed=(patchSeed*1664525+1013904223)>>>0;return patchSeed/4294967296;};
  for(let i=0;i<950;i++) {
    const x=patchRand()*size, y=patchRand()*size;
    const radius=5+patchRand()*24;
    const shade=patchRand()>.5?'rgba(166,205,116,.035)':'rgba(0,35,16,.045)';
    const grad=ctx.createRadialGradient(x,y,0,x,y,radius);
    grad.addColorStop(0,shade);
    grad.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=grad;
    ctx.beginPath();
    ctx.arc(x,y,radius,0,Math.PI*2);
    ctx.fill();
  }

  // Fine grass fibres and natural colour variation use a seeded generator,
  // keeping every render visually consistent without a downloaded texture.
  let seed=90210;
  const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<56000;i++) {
    const x=rand()*size, y=rand()*size, light=rand()>.52;
    ctx.strokeStyle=light?'rgba(174,211,133,.20)':'rgba(2,38,17,.24)';
    ctx.lineWidth=.55+rand()*.95;
    ctx.beginPath();
    ctx.moveTo(x,y);
    ctx.lineTo(x+(rand()-.5)*2.8,y-2-rand()*6);
    ctx.stroke();
  }
  for(let i=0;i<7600;i++) {
    const x=rand()*size, y=rand()*size;
    ctx.fillStyle=rand()>.5?'rgba(197,219,143,.13)':'rgba(0,31,13,.14)';
    ctx.fillRect(x,y,1+rand()*2,1+rand()*2);
  }

  const tex=new THREE.CanvasTexture(canvas);
  tex.colorSpace=THREE.SRGBColorSpace;
  tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
  tex.repeat.set(1.35,1.2);
  tex.anisotropy=Math.min(8,rendererAnisotropyLimit());
  tex.generateMipmaps=true;
  tex.minFilter=THREE.LinearMipmapLinearFilter;
  tex.magFilter=THREE.LinearFilter;
  return tex;
}
function rendererAnisotropyLimit() {
  // Textures can be created before the WebGL renderer is available to this helper.
  // A conservative cap works across mobile GPUs and desktop browsers.
  return 4;
}
function addStadium(scene,accent,options={}) {
  const team=options.team||{};
  const shirt=team.primary||'#d52d45', shorts=team.secondary||'#143b7b';

  // All coordinates in this scene are metres. The penalty spot is the origin.
  const GOAL={width:7.32,height:2.44,depth:1.8,lineZ:-11,post:0.12};
  const PENALTY={width:40.32,depth:16.5,sixWidth:18.32,sixDepth:5.5,arcRadius:9.15};
  const BALL={radius:.11,position:[0,.11,0]};
  const ADS={height:.9,z:-14.5};
  const goalLineZ=GOAL.lineZ, spotZ=0;
  const pitchWidth=PENALTY.width+5;
  const cropNearZ=9.5, cropDepth=cropNearZ-goalLineZ, pitchCenterZ=(cropNearZ+goalLineZ)/2;

  const pitch=new THREE.Mesh(
    new THREE.PlaneGeometry(pitchWidth,cropDepth),
    new THREE.MeshStandardMaterial({map:makePitchGrassTexture(),roughness:.96,metalness:0})
  );
  pitch.rotation.x=-Math.PI/2;
  pitch.position.set(0,0,pitchCenterZ);
  pitch.receiveShadow=true; scene.add(pitch);
  box(scene,0,-.16,pitchCenterZ,pitchWidth,.32,cropDepth,'#14552f');

  const lineColor='#f1f4eb';
  const markingMat=new THREE.MeshBasicMaterial({color:'#ffffff',toneMapped:false,depthWrite:false});
  const paintX=(x1,x2,z,thickness=.12)=>{
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(x2-x1,.012,thickness),markingMat);
    mesh.position.set((x1+x2)/2,.008,z); scene.add(mesh); return mesh;
  };
  const paintZ=(x,z1,z2,thickness=.12)=>{
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(thickness,.012,Math.abs(z2-z1)),markingMat);
    mesh.position.set(x,.008,(z1+z2)/2); scene.add(mesh); return mesh;
  };

  // Only the penalty-end crop is drawn; no centre circle or halfway line.
  paintX(-PENALTY.width/2,PENALTY.width/2,goalLineZ);
  const areaEndZ=goalLineZ+PENALTY.depth;
  const sixEndZ=goalLineZ+PENALTY.sixDepth;
  paintX(-PENALTY.width/2,PENALTY.width/2,areaEndZ);
  paintZ(-PENALTY.width/2,goalLineZ,areaEndZ);
  paintZ(PENALTY.width/2,goalLineZ,areaEndZ);
  paintX(-PENALTY.sixWidth/2,PENALTY.sixWidth/2,sixEndZ);
  paintZ(-PENALTY.sixWidth/2,goalLineZ,sixEndZ);
  paintZ(PENALTY.sixWidth/2,goalLineZ,sixEndZ);

  // FIFA penalty arc: 9.15 m radius, only the part outside the penalty area.
  const arcHalfAngle=Math.acos(5.5/PENALTY.arcRadius);
  const arcPoints=[];
  for(let i=0;i<=96;i++) {
    const angle=-arcHalfAngle+(2*arcHalfAngle*i/96);
    arcPoints.push(new THREE.Vector3(Math.sin(angle)*PENALTY.arcRadius,.014,Math.cos(angle)*PENALTY.arcRadius));
  }
  scene.add(new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(arcPoints),
    new THREE.LineBasicMaterial({color:lineColor})
  ));

  const spot=new THREE.Mesh(new THREE.CircleGeometry(.075,40),
    new THREE.MeshBasicMaterial({color:'#ffffff',side:THREE.DoubleSide,toneMapped:false,depthWrite:false}));
  spot.rotation.x=-Math.PI/2; spot.position.set(0,.012,spotZ); scene.add(spot);

  // Advertising strip is 0.9 m high and 3.5 m behind the goal line.
  addAdBoard(scene);
  addCrowd(scene,accent);
  for(const side of [-1,1]) {
    const roof=box(scene,side*23,7,-18,.35,.35,20,'#26364b');
    roof.rotation.z=side*.06;
    for(let i=0;i<8;i++) {
      const x=side*(12+i*1.45);
      const lamp=box(scene,x,6.3,-17,.72,.18,.34,'#fff2c5');
      lamp.material.emissive=new THREE.Color('#fff0bd'); lamp.material.emissiveIntensity=.8;
      const light=new THREE.PointLight(0xffedc2,18,22);
      light.position.set(x,6.2,-16.8); scene.add(light);
    }
  }

  // Regulation goal: 7.32 m clear inside width, 2.44 m clear height, 0.12 m frame.
  const goalW=GOAL.width, goalH=GOAL.height, goalZ=GOAL.lineZ, depth=GOAL.depth;
  const frameMat=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.22,metalness:.05,emissive:'#dce9df',emissiveIntensity:.12});
  const addGoalTube=(length,x,y,z,horizontal=false)=>{
    const mesh=new THREE.Mesh(new THREE.CylinderGeometry(GOAL.post/2,GOAL.post/2,length,20),frameMat);
    mesh.position.set(x,y,z);
    if(horizontal) mesh.rotation.z=Math.PI/2;
    mesh.castShadow=true; mesh.receiveShadow=true; scene.add(mesh); return mesh;
  };
  const postX=goalW/2+GOAL.post/2, crossbarY=goalH+GOAL.post/2;
  addGoalTube(goalH, -postX, goalH/2, goalZ);
  addGoalTube(goalH, postX, goalH/2, goalZ);
  addGoalTube(goalW, 0, crossbarY, goalZ, true);

  // Net has 1.8 m depth and slopes down from the crossbar to its rear floor.
  const backZ=goalZ-depth, backHeight=.42;
  const netMat=new THREE.LineBasicMaterial({color:'#eaf2f5',transparent:true,opacity:.88});
  const line=(points)=>scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),netMat));
  for(let i=0;i<=30;i++) {
    const x=-goalW/2+(goalW*i/30);
    line([new THREE.Vector3(x,goalH,goalZ),new THREE.Vector3(x,backHeight,backZ)]);
    line([new THREE.Vector3(x,0,goalZ),new THREE.Vector3(x,backHeight,backZ)]);
  }
  for(let y=.25;y<goalH;y+=.22) {
    const t=y/goalH;
    const backY=backHeight+(goalH-backHeight)*t;
    line([new THREE.Vector3(-goalW/2,y,goalZ),new THREE.Vector3(goalW/2,y,goalZ)]);
    line([new THREE.Vector3(-goalW/2,backY,backZ),new THREE.Vector3(goalW/2,backY,backZ)]);
  }
  for(const side of [-1,1]) {
    line([new THREE.Vector3(side*goalW/2,goalH,goalZ),new THREE.Vector3(side*goalW/2,backHeight,backZ)]);
    line([new THREE.Vector3(side*goalW/2,0,goalZ),new THREE.Vector3(side*goalW/2,backHeight,backZ)]);
  }
  const netBackdrop=new THREE.Mesh(
    new THREE.PlaneGeometry(goalW,goalH),
    new THREE.MeshBasicMaterial({color:'#071b2b',transparent:true,opacity:.72,side:THREE.DoubleSide,depthWrite:false})
  );
  netBackdrop.position.set(0,goalH/2,backZ+.015); scene.add(netBackdrop);

  // Players are positioned exactly as specified; each visual is fitted to real height.
  const keeper=addFootballer(scene,0,goalLineZ,'#2772c8',true,options.keeperName||'ANGELO PERUZZI',1,'#18253a',1.90);
  keeper.rotation.y=0;
  const striker=addFootballer(scene,2,1.5,shirt,false,options.playerName||team.player?.name||'LIONEL MESSI',numberForTeam(team),shorts,1.70);
  striker.rotation.y=Math.PI;

  // 22 cm ball, centred on the origin with its bottom touching the turf.
  const ballGroup=new THREE.Group(); ballGroup.position.set(...BALL.position); scene.add(ballGroup);
  const ballMat=material('#f8f8f2',.3,.02);
  makeBodyPart(ballGroup,new THREE.SphereGeometry(BALL.radius,32,24),ballMat,[0,0,0]);
  for(let i=0;i<5;i++) {
    const a=i*Math.PI*2/5;
    const patch=new THREE.Mesh(new THREE.CircleGeometry(.047,5),material('#17212a',.68,.01));
    patch.position.set(Math.cos(a)*.145,Math.sin(a)*.145,.095); ballGroup.add(patch);
  }
  const shadow=new THREE.Mesh(new THREE.CircleGeometry(.17,24),
    new THREE.MeshBasicMaterial({color:'#06130b',transparent:true,opacity:.38}));
  shadow.rotation.x=-Math.PI/2; shadow.position.set(0,-.102,0); scene.add(shadow);

  return {ball:ballGroup,striker,keeper,penaltySpotZ:spotZ,goalLineZ};
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
    scene.fog=new THREE.Fog(bg,gameId==='penalty'?48:9,gameId==='penalty'?105:24);
    const camera=new THREE.PerspectiveCamera(gameId==='penalty'?28:42,1,.1,160);
    if(gameId==='penalty'){camera.position.set(.3,2.2,12);camera.lookAt(0,1.2,-11);}else{camera.position.set(0,4.8,9.6);camera.lookAt(0,.45,0);}
    // Android tablets can reject a high-performance/antialiased context even when
    // WebGL2 is available. Start with a conservative mobile context and retry once
    // with the browser's default GPU selection if the first context cannot be made.
    const isMobileGpu=window.innerWidth<=900 || /Android|iPhone|iPad/i.test(navigator.userAgent||'');
    try {
      renderer=new THREE.WebGLRenderer({
        antialias:!isMobileGpu, alpha:false,
        powerPreference:isMobileGpu?'low-power':'high-performance',
        failIfMajorPerformanceCaveat:false, stencil:false, depth:true
      });
    } catch(firstContextError) {
      console.warn('[Kazino Lakay 3D] First WebGL2 context attempt failed; retrying with browser defaults.',firstContextError);
      renderer=new THREE.WebGLRenderer({antialias:false,alpha:false,failIfMajorPerformanceCaveat:false,stencil:false,depth:true});
    }
    // Keep mobile GPU load bounded while preserving extra detail on larger screens.
    const renderCap=window.innerWidth<=600?1.15:1.7;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,renderCap));
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.16;
    renderer.domElement.className='three-scene-canvas';renderer.domElement.setAttribute('aria-hidden','true');
    container.appendChild(renderer.domElement);
    addLights(scene,accent);
    const floor= new THREE.Mesh(new THREE.PlaneGeometry(gameId==='penalty'?70:22,gameId==='penalty'?70:22),material(bg,.92,0));floor.rotation.x=-Math.PI/2;floor.position.y=gameId==='penalty'?-.22:-.42;floor.receiveShadow=true;scene.add(floor);
    const stage=buildScene(scene,gameId,accent,secondary,options);
    const ring=gameId==='penalty'?null:torus(scene,0,-.29,0,4.1,.025,accent);if(ring){ring.material.transparent=true;ring.material.opacity=.45;}
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
          stage.ball.position.y=.11+Math.sin(flight*Math.PI)*.85;
          stage.ball.position.z=stage.penaltySpotZ-flight*(stage.penaltySpotZ-(stage.goalLineZ+.12));
          stage.ball.position.x=((Number(shotDetail?.shotX??.5)-.5)*3.2)*flight;
        }else if(penaltyElapsed>=2.1){
          stage.ball.position.set(0,.11,stage.penaltySpotZ);
          if(stage.keeper){stage.keeper.position.set(0,stage.keeper.userData.groundOffset||0,-11);stage.keeper.rotation.set(0,0,0);}
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
        stage.striker.position.x=2*(1-approach);
        stage.striker.position.z=1.5*(1-approach);
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
      if(ring) ring.rotation.z+=.0015;
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
      const detail=String(error?.message||error||'Erè enkoni');
      const webglRelated=/webgl|context|gpu|shader|renderer/i.test(detail);
      notice.innerHTML='<strong>PENALTY LAKAY 3D PA KA DEMARE</strong><span>' +
        (webglRelated
          ? 'Navigatè a pa rive kreye kontèks WebGL2 la. Eseye dènye vèsyon Chrome oswa verifye sipò WebGL2 sou aparèy la.'
          : 'Gen yon erè pandan jwèt 3D a t ap prepare. Sa pa nesesèman yon pwoblèm akselerasyon grafik.') +
        '</span><small class="penalty-scene-error-detail"></small>';
      const detailNode=notice.querySelector('.penalty-scene-error-detail');
      if(detailNode) detailNode.textContent='Detay teknik: '+detail.slice(0,180);
      container.appendChild(notice);
      container.dispatchEvent(new CustomEvent('penalty-scene-error',{detail:{message:String(error?.message||error)}}));
    }
    return () => {};
  }
}
export function disposeGame3D() { if(active) active.dispose(); }