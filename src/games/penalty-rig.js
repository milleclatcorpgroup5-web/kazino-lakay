import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

// Locally generated CC0 MakeHuman/Ara assets. Each role has its own skinned GLB.
export const PENALTY_PLAYER_MODEL_URLS = Object.freeze({
  shooter: '/models/penalty-shooter.glb',
  keeper: '/models/penalty-keeper.glb'
});

const templatePromises = new Map();

function normalizedClipName(name) {
  return String(name || '')
    .split('|').pop()
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();
}

function measureRig(root) {
  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3();
  const meshBounds = new THREE.Box3();
  root.traverse((object) => {
    if (!object.isSkinnedMesh) return;
    object.computeBoundingBox?.();
    if (object.boundingBox) {
      meshBounds.copy(object.boundingBox).applyMatrix4(object.matrixWorld);
      bounds.union(meshBounds);
    }
  });
  if (bounds.isEmpty()) bounds.setFromObject(root);
  const height = bounds.max.y - bounds.min.y;
  if (!Number.isFinite(height) || height < 0.2) {
    throw new Error('The generated humanoid GLB has an invalid height.');
  }
  return { height, minY: bounds.min.y };
}

export async function loadPenaltyRigTemplate(keeper = false) {
  const role = keeper ? 'keeper' : 'shooter';
  if (!templatePromises.has(role)) {
    const promise = (async () => {
      const loader = new GLTFLoader();
      const url = PENALTY_PLAYER_MODEL_URLS[role];
      const gltf = await loader.loadAsync(url);
      if (!gltf.scene || !gltf.animations?.length) {
        throw new Error(`The ${role} GLB is missing its scene or animation clips.`);
      }
      const clips = new Map();
      for (const clip of gltf.animations) {
        const key = normalizedClipName(clip.name);
        if (key && !clips.has(key)) clips.set(key, clip);
      }
      const fit = measureRig(gltf.scene);
      const hasSkin = [];
      gltf.scene.traverse((object) => { if (object.isSkinnedMesh) hasSkin.push(object); });
      if (!hasSkin.length) throw new Error(`The ${role} GLB has no skinned humanoid mesh.`);
      return { scene: gltf.scene, clips, fit, url };
    })().catch((error) => {
      templatePromises.delete(role);
      throw error;
    });
    templatePromises.set(role, promise);
  }
  return templatePromises.get(role);
}

function recolorMaterial(source, objectName, kit, keeper) {
  const target = source.clone();
  const label = `${source.name || ''} ${objectName || ''}`.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  const set = (value) => { if (value && target.color) target.color.set(value); };

  if (/football_shirt|uniform_shirt|shirt|jersey|top/.test(label)) {
    set(kit.shirt || (keeper ? '#2a63cf' : '#b3122c'));
  } else if (/short|bottom|trouser/.test(label)) {
    set(kit.shorts || (keeper ? '#1b46a0' : '#b3122c'));
  } else if (/sock/.test(label)) {
    set(kit.socks || (keeper ? '#2a63cf' : '#b3122c'));
  } else if (/shoe|boot/.test(label)) {
    set(kit.boots || (keeper ? '#15181d' : '#19d3e6'));
  } else if (/glove/.test(label)) {
    set(kit.gloves || '#e8e8e8');
  }

  if ('roughness' in target) target.roughness = Math.max(Number(target.roughness) || 0, 0.68);
  if ('metalness' in target) target.metalness = Math.min(Number(target.metalness) || 0, 0.04);
  return target;
}

function makeBackDecal(name, number) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.clearRect(0, 0, 512, 512);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,.42)';
  ctx.shadowBlur = 8;

  const surname = String(name || 'PLAYER').toUpperCase().slice(0, 18);
  const radius = 152;
  const spacing = surname.length > 11 ? 0.085 : 0.105;
  const start = -Math.PI / 2 - ((surname.length - 1) * spacing) / 2;
  ctx.font = '800 36px Arial';
  for (let i = 0; i < surname.length; i++) {
    const angle = start + i * spacing;
    ctx.save();
    ctx.translate(256 + Math.cos(angle) * radius, 118 + Math.sin(angle) * radius);
    ctx.rotate(angle + Math.PI / 2);
    ctx.fillText(surname[i], 0, 0);
    ctx.restore();
  }
  ctx.font = '900 250px Arial';
  ctx.fillText(String(number ?? 10).slice(0, 2), 256, 326);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function addBackDecal(rig, actor) {
  const map = makeBackDecal(actor.userData.name, actor.userData.number);
  if (!map) return;
  const material = new THREE.MeshBasicMaterial({
    map, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -2
  });
  const decal = new THREE.Mesh(new THREE.PlaneGeometry(0.39, 0.43), material);
  decal.name = 'PenaltyPlayerBackNameAndNumber';
  decal.position.set(0, 1.30, -0.151);
  decal.rotation.y = Math.PI;
  decal.renderOrder = 5;
  rig.add(decal);
}

function hideProceduralBody(actor) {
  for (const child of actor.children) child.visible = false;
}

export async function attachPenaltyRig(actor, { isActive = () => true } = {}) {
  if (!actor?.userData || actor.userData.rigRoot) return false;
  const keeper = Boolean(actor.userData.keeper);
  try {
    const template = await loadPenaltyRigTemplate(keeper);
    if (!isActive() || actor.userData.rigRoot) return false;

    const rig = SkeletonUtils.clone(template.scene);
    rig.name = keeper ? 'PenaltyGoalkeeperGLB' : 'PenaltyShooterGLB';
    const targetHeight = Number(actor.userData.targetHeight) || (keeper ? 1.90 : 1.70);
    const outerScale = Math.max(0.0001, Number(actor.scale.y) || 1);
    const rigScale = targetHeight / (template.fit.height * outerScale);
    rig.scale.setScalar(rigScale);
    rig.position.y = -template.fit.minY * rigScale;

    rig.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = true;
      object.receiveShadow = true;
      if (object.isSkinnedMesh) object.frustumCulled = false;
      const kit = actor.userData.kit || {};
      object.material = Array.isArray(object.material)
        ? object.material.map((entry) => recolorMaterial(entry, object.name, kit, keeper))
        : recolorMaterial(object.material, object.name, kit, keeper);
    });

    // Do not silently display the old primitive mannequin if a realistic GLB is missing.
    hideProceduralBody(actor);
    actor.add(rig);

    const mixer = new THREE.AnimationMixer(rig);
    actor.userData.rigRoot = rig;
    actor.userData.rigMixer = mixer;
    actor.userData.rigClips = template.clips;
    actor.userData.rigActions = new Map();
    actor.userData.rigActiveAction = null;
    actor.userData.rigActiveMode = null;
    actor.userData.rigModelUrl = template.url;
    addBackDecal(rig, actor);
    return true;
  } catch (error) {
    // Keep the detailed animated Three.js athlete visible while the realistic
    // skinned GLB is unavailable. The scene displays an explicit status notice;
    // this is a deliberate fallback, never a silent claim that the GLB loaded.
    actor.userData.rigUnavailable = true;
    actor.userData.rigError = error?.message || 'Unknown GLB loading error';
    console.error(`[Penalty Lakay] Required realistic ${keeper ? 'goalkeeper' : 'shooter'} GLB could not load.`, error);
    return false;
  }
}

export function getPenaltyRigMode({ run = 0, kick = 0, dive = 0, side = 0, keeper = false } = {}) {
  if (dive > 0.2) return side < 0 ? 'diveLeft' : 'diveRight';
  if (kick > 0.32) return 'kick';
  if (run > 0.12) return 'run';
  return keeper ? 'keeperReady' : 'walk';
}

const RIG_CLIP_PREFERENCES = Object.freeze({
  idle: ['idle'],
  walk: ['walk', 'idle'],
  keeperReady: ['goalkeeperready', 'crouch', 'idle'],
  run: ['run', 'walk'],
  // Ara 3D Gen currently exposes no football-specific strike or keeper-dive
  // clips. Use valid shipped humanoid clips rather than asking for nonexistent
  // names, so the exported GLBs still animate on every gameplay state.
  kick: ['shootfootball', 'kickfront', 'run'],
  diveLeft: ['goalkeeperdiveleft', 'goalkeeperlowdiveleft', 'dodgeleft', 'rollforward', 'fall'],
  diveRight: ['goalkeeperdiveright', 'goalkeeperlowdiveright', 'dodgeright', 'rollforward', 'fall'],
  celebrate: ['siucelebration', 'cheer']
});

export function resolvePenaltyRigClip(clips, mode) {
  if (!(clips instanceof Map)) return null;
  for (const key of (RIG_CLIP_PREFERENCES[mode] || [])) {
    const clip = clips.get(key);
    if (clip) return clip;
  }
  return null;
}

export function playPenaltyRigClip(actor, clipName, { loop = false, fade = 0.14 } = {}) {
  const data = actor?.userData;
  if (!data?.rigMixer || !data?.rigClips) return false;
  const key = normalizedClipName(clipName);
  const clip = data.rigClips.get(key);
  if (!clip) return false;
  const action = data.rigMixer.clipAction(clip);
  action.reset();
  action.enabled = true;
  action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
  action.clampWhenFinished = !loop;
  if (data.rigActiveAction && data.rigActiveAction !== action) data.rigActiveAction.fadeOut(fade);
  action.fadeIn(fade).play();
  data.rigActiveAction = action;
  data.rigActiveMode = key;
  return true;
}

export function updatePenaltyRigAnimation(actor, delta, pose = {}) {
  const data = actor?.userData;
  if (!data?.rigMixer || !data?.rigClips) return;
  const mode = getPenaltyRigMode({ ...pose, keeper: Boolean(data.keeper) });
  const clip = resolvePenaltyRigClip(data.rigClips, mode);
  if (clip) {
    let action = data.rigActions.get(clip.name);
    if (!action) {
      action = data.rigMixer.clipAction(clip);
      data.rigActions.set(clip.name, action);
    }
    if (data.rigActiveAction !== action || data.rigActiveMode !== mode) {
      const oneShot = mode === 'kick' || mode === 'diveLeft' || mode === 'diveRight';
      action.reset();
      action.enabled = true;
      action.setLoop(oneShot ? THREE.LoopOnce : THREE.LoopRepeat, oneShot ? 1 : Infinity);
      action.clampWhenFinished = oneShot;
      if (data.rigActiveAction && data.rigActiveAction !== action) data.rigActiveAction.fadeOut(0.14);
      action.fadeIn(0.16).play();
      data.rigActiveAction = action;
      data.rigActiveMode = mode;
    }
    action.timeScale = mode === 'run' ? 1.04 : 1;
  }
  data.rigMixer.update(Math.max(0, Math.min(0.05, Number(delta) || 0)));
}
