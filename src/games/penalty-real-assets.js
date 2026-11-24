import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// CC0 MakeHuman soccer athlete, textured and real-world scale.
// The asset is fetched lazily only in Penalty Lakay; the existing rig remains
// as a safe fallback if the remote model cannot be loaded.
const PLAYER_MODEL_URL = 'https://files.innerscene.com/library/soccer-player-standing-3d-person-team-sports-f55b1b4f/16deaf31cfd8f6f067ca/professional-soccer-standing.glb';
let playerTemplatePromise;

function loadTemplate() {
  if (!playerTemplatePromise) {
    const loader = new GLTFLoader();
    playerTemplatePromise = loader.loadAsync(PLAYER_MODEL_URL).then(({ scene }) => {
      scene.traverse((node) => {
        if (!node.isMesh) return;
        node.castShadow = true;
        node.receiveShadow = true;
        if (node.material) {
          const mats = Array.isArray(node.material) ? node.material : [node.material];
          mats.forEach((mat) => {
            mat.roughness = Math.max(.48, mat.roughness ?? .7);
            mat.metalness = 0;
          });
        }
      });
      const bounds = new THREE.Box3().setFromObject(scene);
      const height = Math.max(.1, bounds.max.y - bounds.min.y);
      const scale = 2.18 / height;
      scene.scale.setScalar(scale);
      const scaledBounds = new THREE.Box3().setFromObject(scene);
      scene.position.y -= scaledBounds.min.y;
      return scene;
    });
  }
  return playerTemplatePromise;
}

export async function upgradePenaltyAthletes(striker, keeper) {
  try {
    const template = await loadTemplate();
    for (const actor of [striker, keeper]) {
      if (!actor) continue;
      const namePlate = actor.children[actor.children.length - 1];
      actor.children.forEach((child) => { child.visible = false; });
      if (namePlate) namePlate.visible = true;
      const model = template.clone(true);
      model.name = 'CC0-realistic-soccer-athlete';
      actor.add(model);
      actor.userData.realModelLoaded = true;
    }
    return true;
  } catch (error) {
    console.warn('[Penalty Lakay] CC0 athlete model unavailable; using local rig.', error);
    return false;
  }
}
