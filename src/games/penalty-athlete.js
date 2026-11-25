import * as THREE from 'three';

const mat=(color,roughness=.72,metalness=.02)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
function part(parent,geometry,material,position=[0,0,0],rotation=[0,0,0]) {
  const mesh=new THREE.Mesh(geometry,material);
  mesh.position.set(...position); mesh.rotation.set(...rotation);
  mesh.castShadow=true; mesh.receiveShadow=true; parent.add(mesh); return mesh;
}
function capsule(parent,radius,length,material,position,rotation=[0,0,0],radial=20) {
  return part(parent,new THREE.CapsuleGeometry(radius,length,8,radial),material,position,rotation);
}
function ellipsoid(parent,material,position,scale,segments=28) {
  const mesh=part(parent,new THREE.SphereGeometry(1,segments,22),material,position);
  mesh.scale.set(...scale); return mesh;
}
function decalTexture(name,number,keeper=false) {
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;
  const ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,512,512);
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillStyle=keeper?'#eaf5ff':'#fff3cc';
  ctx.shadowColor='rgba(0,0,0,.45)';ctx.shadowBlur=10;
  ctx.font='800 40px Arial';ctx.fillText(String(name||'PLAYER').toUpperCase().slice(0,18),256,78);
  ctx.font='900 250px Arial';ctx.fillText(String(number||10).slice(0,2),256,302);
  ctx.shadowBlur=0;
  return new THREE.CanvasTexture(canvas);
}
function chestNumberTexture(number,keeper=false) {
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
  const ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,128,128);
  ctx.fillStyle=keeper?'#eaf5ff':'#fff3cc';
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='900 104px Arial';
  ctx.shadowColor='rgba(0,0,0,.48)';ctx.shadowBlur=6;
  ctx.fillText(String(number||10).slice(0,2),64,66);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
function limb(parent,upperMat,lowerMat,skin,bootMat,side) {
  const hip=new THREE.Group(); hip.position.set(side*.145,.82,0); parent.add(hip);
  ellipsoid(hip,upperMat,[0,-.11,0],[.135,.22,.14]);
  capsule(hip,.105,.31,upperMat,[0,-.32,0],[0,0,side*.025],24);
  const knee=new THREE.Group(); knee.position.set(0,-.53,.005); hip.add(knee);
  ellipsoid(knee,skin,[0,0,0],[.09,.09,.09]);
  capsule(knee,.074,.29,lowerMat,[0,-.19,0],[0,0,0],20);
  ellipsoid(knee,lowerMat,[0,-.37,0],[.082,.105,.09]);
  // Subtle sock bands and a shin-guard ridge add a recognisable football kit.
  for(const y of [-.13,-.19]) {
    const band=part(knee,new THREE.TorusGeometry(.071,.012,7,24),mat('#f7f7ee',.92),[0,y,0],[Math.PI/2,0,0]);
    band.scale.set(1,1,.94);
  }
  part(knee,new THREE.BoxGeometry(.085,.19,.022),mat('#c8d5df',.82),[0,-.22,.071]);
  const ankle=new THREE.Group(); ankle.position.set(0,-.42,-.005); knee.add(ankle);
  capsule(ankle,.075,.14,lowerMat,[0,-.06,0]);
  // Boots point toward the player's local forward (+Z) direction.
  ellipsoid(ankle,bootMat,[0,-.16,.105],[.095,.075,.19],24);
  part(ankle,new THREE.BoxGeometry(.13,.022,.17),mat('#252e38',.48,.12),[0,-.215,.105]);
  for(let lace=0;lace<4;lace++) {
    part(ankle,new THREE.BoxGeometry(.07,.009,.012),mat('#dce5ed',.5),[0,-.078,.035+lace*.033]);
  }
  for(const x of [-.055,0,.055]) for(const z of [-.005,.075,.145]) {
    part(ankle,new THREE.CylinderGeometry(.012,.012,.025,8),mat('#151c24',.62),[x,-.235,z]);
  }
  return {hip,knee,ankle};
}
function arm(parent,shirtMat,skin,gloveMat,keeper,side) {
  const shoulder=new THREE.Group(); shoulder.position.set(side*.285,.48,0); parent.add(shoulder);
  ellipsoid(shoulder,shirtMat,[0,0,0],[.13,.145,.14]);
  capsule(shoulder,.085,.27,shirtMat,[side*.015,-.22,0],[0,0,side*-.055],22);
  const cuff=part(shoulder,new THREE.TorusGeometry(.075,.014,8,24),mat('#f5f2e8',.82),[side*.025,-.34,0],[Math.PI/2,0,0]);
  const elbow=new THREE.Group(); elbow.position.set(side*.025,-.39,0); shoulder.add(elbow);
  ellipsoid(elbow,skin,[0,0,0],[.075,.075,.075]);
  capsule(elbow,.064,.23,skin,[side*.012,-.16,.005],[0,0,side*-.025],20);
  const wrist=new THREE.Group(); wrist.position.set(side*.015,-.34,0); elbow.add(wrist);
  ellipsoid(wrist,skin,[0,-.045,0],[.066,.09,.052]);
  if(keeper) {
    part(wrist,new THREE.BoxGeometry(.2,.17,.105),gloveMat,[0,-.13,.045]);
    for(let finger=0;finger<4;finger++) capsule(wrist,.018,.075,gloveMat,[-.07+finger*.046,-.22,.065],[0,0,0],10);
    part(wrist,new THREE.BoxGeometry(.11,.07,.1),mat('#d3e2ef',.5),[0,-.035,.07]);
  } else {
    ellipsoid(wrist,skin,[0,-.13,.015],[.052,.085,.045]);
    for(let finger=0;finger<4;finger++) capsule(wrist,.012,.045,skin,[-.03+finger*.02,-.2,.025],[0,0,0],8);
  }
  return {shoulder,elbow,wrist,cuff};
}
function face(parent,skin,hairMat,keeper) {
  const head=new THREE.Group(); head.position.set(0,.91,.012); parent.add(head);
  ellipsoid(head,skin,[0,0,0],[.158,.19,.145],36);
  ellipsoid(head,skin,[0,-.105,.055],[.125,.105,.11],28);
  for(const side of [-1,1]) {
    ellipsoid(head,skin,[side*.158,-.005,0],[.035,.055,.04],18);
    ellipsoid(head,mat('#ead8c6'),[side*.158,-.01,.024],[.014,.026,.01],12);
    // Eyeball, iris and pupil are separate layers, so the face reads at stadium distance.
    ellipsoid(head,mat('#f7f3e9',.34),[side*.061,.025,.132],[.039,.027,.018],20);
    ellipsoid(head,mat('#6f4937',.4),[side*.061,.024,.149],[.017,.019,.009],16);
    ellipsoid(head,mat('#11151a',.3),[side*.061,.024,.157],[.008,.011,.005],12);
    capsule(head,.014,.045,hairMat,[side*.061,.073,.132],[0,0,side*-.12],10);
    capsule(head,.025,.055,hairMat,[side*.062,.078,.127],[0,0,side*.08],10);
  }
  capsule(head,.018,.055,skin,[0,-.018,.151],[Math.PI/2,0,0],12);
  ellipsoid(head,skin,[0,-.09,.12],[.045,.035,.035],18);
  part(head,new THREE.BoxGeometry(.052,.009,.012),mat('#713d38'),[0,-.062,.139]);
  ellipsoid(head,skin,[0,-.132,.075],[.078,.045,.08],20);
  const cap=part(head,new THREE.SphereGeometry(1,32,18,0,Math.PI*2,0,Math.PI*.58),hairMat,[0,.105,-.005]);
  cap.scale.set(.163,.14,.15);
  // Short, layered hairline rather than a smooth featureless helmet.
  for(let i=0;i<9;i++) {
    const a=(i/9)*Math.PI*2;
    ellipsoid(head,hairMat,[Math.cos(a)*.118,.125,Math.sin(a)*.095],[.027,.042,.032],12);
  }
  const fringe=ellipsoid(head,hairMat,[0,.145,.115],[.105,.035,.055],18);
  fringe.rotation.x=-.18;
  if(keeper) {
    // Keeper's hairline is slightly shorter and more compact.
    fringe.scale.set(.095,.026,.045);
  }
  return head;
}
function makeKitBadge(parent) {
  const badge=part(parent,new THREE.CircleGeometry(.064,8),mat('#f4d47c',.42,.18),[.17,.37,.253]);
  badge.material.side=THREE.DoubleSide;
  part(parent,new THREE.CircleGeometry(.034,8),mat('#fff8dc'),[.17,.37,.256]);
  part(parent,new THREE.BoxGeometry(.018,.055,.008),mat('#4b8c70'),[.17,.37,.26]);
  return badge;
}
function addShirtDetails(torso,shirt,shorts,number,name,keeper) {
  // Collar and shoulder seams make the jersey feel like stitched fabric.
  const collar=part(torso,new THREE.TorusGeometry(.105,.018,8,32),mat('#f1e9d5',.82),[0,.655,0],[Math.PI/2,0,0]);
  collar.scale.set(1,.82,1);
  for(const side of [-1,1]) {
    part(torso,new THREE.BoxGeometry(.027,.43,.014),mat('#eee5d2',.85),[side*.205,.26,.025]);
    part(torso,new THREE.BoxGeometry(.018,.24,.018),mat('#f6f0df',.8),[side*.274,.44,0]);
    part(torso,new THREE.BoxGeometry(.035,.018,.13),mat('#f6f0df',.8),[side*.26,.35,0]);
  }
  makeKitBadge(torso);
  const texture=decalTexture(name,number,keeper);
  const decalMat=new THREE.MeshStandardMaterial({map:texture,transparent:true,roughness:.9,metalness:0,side:THREE.DoubleSide,depthWrite:false});
  const back=part(torso,new THREE.PlaneGeometry(.35,.43),decalMat,[0,.31,-.253],[0,Math.PI,0]);
  back.renderOrder=3;
  const chestMat=new THREE.MeshStandardMaterial({map:chestNumberTexture(number,keeper),transparent:true,roughness:.9,metalness:0,side:THREE.DoubleSide,depthWrite:false});
  part(torso,new THREE.PlaneGeometry(.105,.13),chestMat,[-.02,.2,.253]);
  // The shorts receive a waistband, side piping and a subtle hem.
  part(torso,new THREE.BoxGeometry(.22,.018,.012),mat('#e6ddc8',.88),[0,.035,.12]);
  return collar;
}
export function createPenaltyAthlete({x,z,shirt,keeper=false,name='PLAYER',number=10,shortColor='#172d4d'}) {
  const group=new THREE.Group(); group.position.set(x,0,z);
  const tonePalette=['#956449','#b77c58','#754b39','#c18a65'];
  const hairPalette=['#211b19','#30251f','#17191c','#493629'];
  const seed=Math.abs(Number(number)||10);
  const skin=mat(tonePalette[seed%tonePalette.length],.86,.005);
  const fabric=mat(shirt,.79,.01), shorts=mat(shortColor,.84,.01);
  const sockColor=keeper?'#e6edf4':'#f1f0e8';
  const sock=mat(sockColor,.92), boot=mat(keeper?'#f3f5f7':'#101820',.38,.12);
  const hair=mat(hairPalette[(seed+1)%hairPalette.length],.95);
  const glove=mat('#f3f6f8',.48,.025);
  const undershirt=mat(keeper?'#1b5c9d':shirt,.84);
  // The upper body is a separate pivot: lean and twist now move shoulders and head together.
  const torso=new THREE.Group();torso.position.set(0,1.02,0);group.add(torso);
  capsule(torso,.245,.39,fabric,[0,.27,0],[0,0,0],32);
  ellipsoid(torso,fabric,[0,.46,0],[.265,.17,.15],28);
  capsule(torso,.105,.12,skin,[0,.65,0],[0,0,0],20);
  ellipsoid(torso,undershirt,[0,.49,-.005],[.242,.145,.145],28);
  for(const side of [-1,1]) ellipsoid(torso,fabric,[side*.275,.44,0],[.105,.12,.12]);
  addShirtDetails(torso,shirt,shorts,number,name,keeper);
  // Shorts, side panels and belt sit over the hip pivot.
  capsule(group,.235,.15,shorts,[0,.88,0],[0,0,0],24);
  part(group,new THREE.TorusGeometry(.205,.018,8,32),mat('#e8dfc9',.82),[0,.96,0],[Math.PI/2,0,0]);
  for(const side of [-1,1]) {
    part(group,new THREE.BoxGeometry(.022,.25,.012),mat('#f5f0e2',.88),[side*.2,.84,.14]);
    part(group,new THREE.BoxGeometry(.15,.025,.018),mat('#f5f0e2',.88),[side*.17,.755,.17]);
  }
  const head=face(torso,skin,hair,keeper);
  const armL=arm(torso,fabric,skin,glove,keeper,-1), armR=arm(torso,fabric,skin,glove,keeper,1);
  const legL=limb(group,shorts,sock,skin,boot,-1), legR=limb(group,shorts,sock,skin,boot,1);
  // Small boot studs and layered body geometry stay local to this athlete only.
  group.userData={torso,armL,armR,legL,legR,head,keeper,breathPhase:(seed%9)*.31,number,name};
  return group;
}
export function animatePenaltyAthlete(actor,time,{run=0,runPhase=0,kick=0,follow=0,dive=0,side=0}={}) {
  if(!actor)return;
  const u=actor.userData;
  const breath=Math.sin(time*2.05+u.breathPhase);
  const runWave=Math.sin(runPhase);
  const runCounter=Math.sin(runPhase+Math.PI);
  const idle=1-Math.max(run,dive);
  actor.position.y=Math.max(0,Math.abs(breath)*.009*idle+Math.sin(runPhase*2)*.035*run+Math.sin(dive*Math.PI)*.24*dive);
  // Shoulder/torso mechanics: forward lean during acceleration, then a counter-rotation through contact.
  u.torso.rotation.x=-run*.13+kick*.09+follow*.045-dive*.12;
  u.torso.rotation.z=side*dive*.22+Math.sin(time*1.25+u.breathPhase)*.012*idle;
  u.torso.rotation.y=Math.sin(time*.7+u.breathPhase)*.018*idle;
  u.torso.scale.y=1+breath*.004;
  // Opposing arm swing during the approach; arms open and reach during a keeper dive.
  u.armL.shoulder.rotation.x=-runWave*.52-run*.02+kick*.12-follow*.08;
  u.armR.shoulder.rotation.x=-runCounter*.52+run*.02-kick*.12+follow*.08;
  u.armL.shoulder.rotation.z=-.07+run*.12+dive*(-.48-side*.18);
  u.armR.shoulder.rotation.z=.07-run*.12+dive*(.48-side*.18);
  u.armL.elbow.rotation.x=-.58*run-dive*.22+(u.keeper?idle*-.18:0);
  u.armR.elbow.rotation.x=-.58*run-dive*.22+(u.keeper?idle*-.18:0);
  u.armL.wrist.rotation.x=-kick*.12;
  u.armR.wrist.rotation.x=-kick*.12;
  // The left boot strikes through the ball; the planted right leg stabilises the hips.
  u.legL.hip.rotation.x=-runWave*.48-kick*1.02+follow*.19-dive*.35;
  u.legR.hip.rotation.x=-runCounter*.48+kick*.28-follow*.12-dive*.2;
  u.legL.hip.rotation.z=-side*dive*.12;
  u.legR.hip.rotation.z=side*dive*.12;
  u.legL.knee.rotation.x=Math.max(0,runWave)*.58+kick*.12+follow*.2+dive*.65+(u.keeper?idle*.16:0);
  u.legR.knee.rotation.x=Math.max(0,runCounter)*.58+kick*.24+follow*.08+dive*.52+(u.keeper?idle*.16:0);
  u.legL.ankle.rotation.x=kick*.18-run*.08;
  u.legR.ankle.rotation.x=-kick*.12-run*.08;
  if(u.head) {
    u.head.rotation.y=Math.sin(time*.55+u.breathPhase)*.028;
    u.head.rotation.x=-run*.06+kick*.045+dive*.06;
  }
}
