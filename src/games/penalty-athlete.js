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
function limb(parent,upperMat,lowerMat,skin,bootMat,keeper,side) {
  const hip=new THREE.Group(); hip.position.set(side*.145,.82,0); parent.add(hip);
  ellipsoid(hip,upperMat,[0,-.11,0],[.135,.22,.14]);
  capsule(hip,.105,.31,upperMat,[0,-.32,0],[0,0,side*.025],24);
  const knee=new THREE.Group(); knee.position.set(0,-.53,.005); hip.add(knee);
  ellipsoid(knee,skin,[0,0,0],[.09,.09,.09]);
  capsule(knee,.074,.29,lowerMat,[0,-.19,0],[0,0,0],20);
  ellipsoid(knee,lowerMat,[0,-.37,0],[.082,.105,.09]);
  const ankle=new THREE.Group(); ankle.position.set(0,-.42,-.005); knee.add(ankle);
  capsule(ankle,.075,.14,lowerMat,[0,-.06,0]);
  const boot=part(ankle,new THREE.BoxGeometry(.17,.105,.32),bootMat,[0,-.17,-.095]);
  boot.scale.set(1,1,1.05);
  for(let i=0;i<5;i++) part(ankle,new THREE.CylinderGeometry(.012,.015,.022,8),mat('#141a20',.8),[-.065+i*.032,-.226,-.21]);
  return {hip,knee,ankle};
}
function arm(parent,shirtMat,skin,gloveMat,keeper,side) {
  const shoulder=new THREE.Group(); shoulder.position.set(side*.285,1.48,0); parent.add(shoulder);
  ellipsoid(shoulder,shirtMat,[0,0,0],[.13,.145,.14]);
  capsule(shoulder,.085,.27,shirtMat,[side*.015,-.22,0],[0,0,side*-.055],22);
  const elbow=new THREE.Group(); elbow.position.set(side*.025,-.39,0); shoulder.add(elbow);
  ellipsoid(elbow,skin,[0,0,0],[.075,.075,.075]);
  capsule(elbow,.064,.23,skin,[side*.012,-.16,.005],[0,0,side*-.025],20);
  const wrist=new THREE.Group(); wrist.position.set(side*.015,-.34,0); elbow.add(wrist);
  ellipsoid(wrist,skin,[0,-.045,0],[.066,.09,.052]);
  if(keeper) {
    part(wrist,new THREE.BoxGeometry(.19,.16,.09),gloveMat,[0,-.13,.035]);
    for(let f=0;f<4;f++) capsule(wrist,.018,.065,gloveMat,[-.065+f*.043,-.22,.055],[0,0,0],10);
  } else {
    ellipsoid(wrist,skin,[0,-.13,.015],[.052,.085,.045]);
    for(let f=0;f<4;f++) capsule(wrist,.012,.045,skin,[-.03+f*.02,-.2,.025],[0,0,0],8);
  }
  return shoulder;
}
function face(parent,skin,hairMat,keeper) {
  const head=new THREE.Group(); head.position.set(0,1.91,.012); parent.add(head);
  ellipsoid(head,skin,[0,0,0],[.158,.195,.145],36);
  for(const side of [-1,1]) {
    ellipsoid(head,skin,[side*.158,-.005,0],[.035,.055,.04],18);
    ellipsoid(head,mat('#f4e8d9'),[side*.061,.025,.132],[.039,.027,.018],18);
    ellipsoid(head,mat('#35251f'),[side*.061,.024,.15],[.016,.019,.009],16);
    ellipsoid(head,mat('#17191d'),[side*.061,.024,.158],[.007,.01,.005],12);
    part(head,new THREE.CapsuleGeometry(.012,.05,4,10),hairMat,[side*.061,.072,.133],[0,0,side*.12]);
  }
  // Nose bridge, nostrils, mouth and chin create a readable three-quarter face.
  capsule(head,.018,.045,skin,[0,-.018,.151],[Math.PI/2,0,0],12);
  ellipsoid(head,skin,[0,-.09,.12],[.045,.035,.035],18);
  part(head,new THREE.BoxGeometry(.052,.009,.012),mat('#713d38'),[0,-.062,.139]);
  ellipsoid(head,skin,[0,-.132,.075],[.078,.045,.08],20);
  const cap=part(head,new THREE.SphereGeometry(1,32,18,0,Math.PI*2,0,Math.PI*.58),hairMat,[0,.105,-.005]);
  cap.scale.set(.163,.14,.15);
  // Hairline and short textured hair tufts.
  for(let i=0;i<7;i++) {
    const a=(i/7)*Math.PI*2;
    ellipsoid(head,hairMat,[Math.cos(a)*.115,.13,Math.sin(a)*.095],[.035,.045,.035],12);
  }
  return head;
}
function crest(parent,shirtMat) {
  const badge=part(parent,new THREE.CircleGeometry(.065,6),mat('#f6d77a',.48,.18),[.16,1.48,.137],[0,0,0]);
  badge.material.side=THREE.DoubleSide;
  part(parent,new THREE.CircleGeometry(.035,6),mat('#fff8dc'),[.16,1.48,.14]);
  return badge;
}
export function createPenaltyAthlete({x,z,shirt,keeper=false,name='PLAYER',number=10,shortColor='#172d4d'}) {
  const group=new THREE.Group(); group.position.set(x,0,z);
  const skin=mat('#956449'), fabric=mat(shirt,.76,.015), shorts=mat(shortColor,.82,.01);
  const sock=mat(keeper?'#dce8f3':'#e9edf0',.9), boot=mat('#101820',.4,.16);
  const hair=mat('#211b19',.94), glove=mat('#f2f5f7',.48,.03);
  const undershirt=mat(keeper?'#1b5c9d':shirt,.84);
  // Athletic torso with layered jersey, collar, sleeves, seams and side panels.
  capsule(group,.245,.39,fabric,[0,1.29,0],[0,0,0],32);
  ellipsoid(group,fabric,[0,1.48,0],[.265,.17,.15],28);
  capsule(group,.105,.12,skin,[0,1.67,0],[0,0,0],20);
  capsule(group,.235,.15,shorts,[0,.88,0],[0,0,0],24);
  part(group,new THREE.TorusGeometry(.09,.018,8,28),mat('#e9d9b0'),[0,1.625,0],[0,0,0]);
  for(const side of [-1,1]) {
    part(group,new THREE.BoxGeometry(.025,.48,.012),mat('#f2e8d6',.9),[side*.205,1.28,.02]);
    ellipsoid(group,fabric,[side*.275,1.46,0],[.105,.12,.12]);
  }
  // Shirt number on back and chest sponsor/crest.
  part(group,new THREE.PlaneGeometry(.17,.2),mat('#fff0c7'),[0,1.31,-.151],[0,Math.PI,0]);
  part(group,new THREE.PlaneGeometry(.12,.15),mat('#fff0c7'),[0,1.31,.151]);
  crest(group,fabric);
  const head=face(group,skin,hair,keeper);
  const armL=arm(group,fabric,skin,glove,keeper,-1), armR=arm(group,fabric,skin,glove,keeper,1);
  const legL=limb(group,shorts,sock,skin,boot,keeper,-1), legR=limb(group,shorts,sock,skin,boot,keeper,1);
  // Neck/shoulder proportions and facial details are kept consistent across player roles.
  const namePlate=new THREE.Group(); namePlate.position.set(0,2.32,0); group.add(namePlate);
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;
  const ctx=canvas.getContext('2d');ctx.fillStyle='rgba(5,12,22,.8)';ctx.beginPath();ctx.roundRect(8,12,496,104,24);ctx.fill();
  ctx.fillStyle=keeper?'#bce5ff':'#fff0bd';ctx.font='900 42px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(name).toUpperCase().slice(0,22),256,65);
  const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:false}));sprite.scale.set(2.2,.55,1);namePlate.add(sprite);
  group.userData={armL,armR,legL,legR,head,keeper,breathPhase:0,number,name};
  return group;
}
export function animatePenaltyAthlete(actor,time,{kick=0,dive=0,side=0}={}) {
  if(!actor)return;
  const u=actor.userData;
  const breathe=Math.sin(time*2.1+u.breathPhase);
  actor.position.y=Math.abs(breathe)*.012;
  u.armL.rotation.z=-.035+breathe*.018-kick*.28-dive*.55*side;
  u.armR.rotation.z=.035-breathe*.018+kick*.32-dive*.55*side;
  u.armL.rotation.x=Math.sin(time*1.8)*.025;
  u.armR.rotation.x=-Math.sin(time*1.8)*.025;
  u.legL.rotation.x=-kick*.72+Math.sin(time*2)*.025;
  u.legR.rotation.x=kick*.38-Math.sin(time*2)*.025;
  u.legL.children?.[1]?.rotation?.set?.(0,0,0);
  u.legR.children?.[1]?.rotation?.set?.(0,0,0);
  if(u.head)u.head.rotation.y=Math.sin(time*.55)*.035;
}
