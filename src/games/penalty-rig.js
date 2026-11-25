import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

// Quaternius "Animated Men" CC0 model, pinned to a source commit.
// It is loaded lazily; the procedural Penalty Lakay players remain visible if
// this public asset cannot be reached on a low-bandwidth connection.
export const PENALTY_PLAYER_MODEL_URL =
  'https://cdn.jsdelivr.net/gh/kendrekaran/striker-3d@57847f87ff3d924712a1bb37df9dae391aedc315/assets/player.glb';

let templatePromise = null;

function normalizedClipName(name) {
  return String(name || '')
    .replace(/^HumanArmature\\|Man_/, '')
    .split('|').pop()
    .replace(/^Man_/, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();
}

function measureRig(scene) {
  scene.updateMatrixWorld(true);
  const bounds = new THREE.Box3();
  const meshBounds = new THREE.Box3();
  scene.traverse((object) => {
    if (!object.isSkinnedMesh) return;
    if (typeof object.computeBoundingBox === 'function') object.computeBoundingBox();
    if (object.boundingBox) {
      meshBounds.copy(object.boundingBox).applyMatrix4(object.matrixWorld);
      bounds.union(meshBounds);
    }
  });
  if (bounds.isEmpty()) bounds.setFromObject(scene);
  const height = bounds.max.y - bounds.min.y;
  if (!Number.isFinite(height) || height < 0.2) {
    throw new Error('The rigged footballer model has an invalid height.');
  }
  return { scale: 1.96 / height, minY: bounds.min.y };
}

export async function loadPenaltyRigTemplate() {
  if (!templatePromise) {
    templatePromise = (async () => {
      const loader = new GLTFLoader();
      loader.setCrossOrigin('anonymous');
      const gltf = await loader.loadAsync(PENALTY_PLAYER_MODEL_URL);
      if (!gltf.scene || !gltf.animations?.length) {
        throw new Error('The footballer model is missing its scene or animation clips.');
      }
      const clips = new Map();
      for (const clip of gltf.animations) {
        const key = normalizedClipName(clip.name);
        if (key && !clips.has(key)) clips.set(key, clip);
      }
      const fit = measureRig(gltf.scene);
      return { scene: gltf.scene, clips, fit };
    })().catch((error) => {
      templatePromise = null;
      throw error;
    });
  }
  return templatePromise;
}

function kitMaterial(source, { shirt, shorts, keeper }) {
  const target = source.clone();
  const name = String(source.name || '').toLowerCase();
  if (name.includes('shirt')) {
    target.color.set(shirt);
    if (name.includes('shirt2')) target.color.multiplyScalar(0.78);
  } else if (name.includes('pants')) {
    target.color.set(shorts);
  } else if (name.includes('socks')) {
    target.color.set(keeper ? '#eaf1f7' : '#f0f0e9');
  } else if (name.includes('shoes')) {
    target.color.set(keeper ? '#f0f4f8' : '#111820');
  }
  if ('roughness' in target) target.roughness = Math.max(target.roughness || 0, 0.68);
  return target;
}

function makeShirtDecal(name, number, mirrored = false) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  if (mirrored) {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff4d4';
  ctx.shadowColor = 'rgba(0,0,0,.5)';
  ctx.shadowBlur = 9;
  ctx.font = '800 42px Arial';
  ctx.fillText(String(name || 'PLAYER').toUpperCase().slice(0, 18), 256, 86);
  ctx.font = '900 250px Arial';
  ctx.fillText(String(number || 10).slice(0, 2), 256, 310);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function addShirtDecals(actor, options) {
  const makePlane = (z, rotationY, mirrored) => {
    const map = makeShirtDecal(options.name, options.number, mirrored);
    if (!map) return;
    const material = new THREE.MeshBasicMaterial({
      map, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -2
    });
    const decal = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.43), material);
    decal.position.set(0, 1.28, z);
    decal.rotation.y = rotationY;
    decal.renderOrder = 5;
    actor.add(decal);
  };
  // The model faces local +Z. Attach one decal to the chest and one to the back.
  makePlane(0.145, 0, false);
  makePlane(-0.145, Math.PI, true);
}

export async function attachPenaltyRig(actor, { isActive = () => true } = {}) {
  if (!actor?.userData || actor.userData.rigRoot) return false;
  try {
    const template = await loadPenaltyRigTemplate();
    if (!isActive() || actor.userData.rigRoot) return false;

    const keeper = Boolean(actor.userData.keeper);
    const rig = SkeletonUtils.clone(template.scene);
    rig.name = keeper ? 'PenaltyGoalkeeperRig' : 'PenaltyStrikerRig';
    rig.scale.multiplyScalar(template.fit.scale);
    rig.position.y = -template.fit.minY * template.fit.scale;
    rig.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = true;
      object.receiveShadow = true;
      if (object.isSkinnedMesh) object.frustumCulled = false;
      object.material = Array.isArray(object.material)
        ? object.material.map((material) => kitMaterial(material, {
          shirt: actor.userData.shirtColor || (keeper ? '#2772c8' : '#123b89'),
          shorts: actor.userData.shortColor || '#172d4d',
          keeper
        }))
        : kitMaterial(object.material, {
          shirt: actor.userData.shirtColor || (keeper ? '#2772c8' : '#123b89'),
          shorts: actor.userData.shortColor || '#172d4d',
          keeper
        });
    });

    // Keep the procedural athlete in memory as a reliable no-network fallback,
    // but hide its primitive body once the skinned character is ready.
    for (const child of [...actor.children]) child.visible = false;
    actor.add(rig);

    const mixer = new THREE.AnimationMixer(rig);
    actor.userData.rigRoot = rig;
    actor.userData.rigMixer = mixer;
    actor.userData.rigClips = template.clips;
    actor.userData.rigActions = new Map();
    actor.userData.rigActiveAction = null;
    actor.userData.rigActiveMode = null;
    addShirtDecals(actor, {
      name: actor.userData.name,
      number: actor.userData.number
    });
    return true;
  } catch (error) {
    console.warn('[Penalty Lakay] Rigged model unavailable; keeping the procedural 3D player.', error);
    return false;
  }
}

export function getPenaltyRigMode({ run = 0, kick = 0, dive = 0 } = {}) {
  if (dive > 0.2) return 'dive';
  if (kick > 0.32) return 'kick';
  if (run > 0.12) return 'run';
  return 'idle';
}

function findClip(clips, mode) {
  const preferences = {
    idle: ['idle', 'idleloop'],
    run: ['run', 'sprint', 'jog', 'walk'],
    // The CC0 base pack has no dedicated soccer strike or keeper-save clip.
    // Use its closest one-shots until the football-specific mocap clips arrive.
    kick: ['socc kick', 'kick', 'punch'],
    dive: ['goalkeeperdive', 'dive', 'roll', 'jump', 'fall']
  };
  const keys = preferences[mode] || [];
  for (const key of keys) {
    const exact = clips.get(key.replace(/[^a-z0-9]/gi, '').toLowerCase());
    if (exact) return exact;
  }
  return null;
}

export function updatePenaltyRigAnimation(actor, delta, pose = {}) {
  const userData = actor?.userData;
  if (!userData?.rigMixer || !userData.rigClips) return;
  const mode = getPenaltyRigMode(pose);
  const clip = findClip(userData.rigClips, mode);
  if (clip) {
    let action = userData.rigActions.get(clip.name);
    if (!action) {
      action = userData.rigMixer.clipAction(clip);
      userData.rigActions.set(clip.name, action);
    }
    if (userData.rigActiveAction !== action || userData.rigActiveMode !== mode) {
      const oneShot = mode === 'kick' || mode === 'dive';
      action.reset();
      action.enabled = true;
      action.setLoop(oneShot ? THREE.LoopOnce : THREE.LoopRepeat, oneShot ? 1 : Infinity);
      action.clampWhenFinished = oneShot;
      if (userData.rigActiveAction && userData.rigActiveAction !== action) {
        userData.rigActiveAction.fadeOut(0.12);
      }
      action.fadeIn(0.14).play();
      userData.rigActiveAction = action;
      userData.rigActiveMode = mode;
    }
    if (mode === 'run') userData.rigActiveAction.timeScale = 1.08;
    else userData.rigActiveAction.timeScale = 1;
  }
  userData.rigMixer.update(Math.max(0, Math.min(0.05, Number(delta) || 0)));
}
