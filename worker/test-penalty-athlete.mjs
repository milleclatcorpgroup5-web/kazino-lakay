import assert from 'node:assert/strict';
import { animatePenaltyAthlete } from '../src/games/penalty-athlete.js';

const joint=()=>({rotation:{x:0,y:0,z:0}});
function athlete(keeper=false) {
  return {
    position:{y:0},
    userData:{
      keeper,breathPhase:.4,
      torso:{rotation:{x:0,y:0,z:0},scale:{y:1}},
      head:joint(),
      armL:{shoulder:joint(),elbow:joint(),wrist:joint()},
      armR:{shoulder:joint(),elbow:joint(),wrist:joint()},
      legL:{hip:joint(),knee:joint(),ankle:joint()},
      legR:{hip:joint(),knee:joint(),ankle:joint()}
    }
  };
}
function assertFiniteRig(actor,label) {
  const u=actor.userData;
  const values=[
    actor.position.y,u.torso.rotation.x,u.torso.rotation.y,u.torso.rotation.z,u.torso.scale.y,
    u.head.rotation.x,u.head.rotation.y,u.head.rotation.z,
    u.armL.shoulder.rotation.x,u.armL.shoulder.rotation.y,u.armL.shoulder.rotation.z,
    u.armR.shoulder.rotation.x,u.armR.shoulder.rotation.y,u.armR.shoulder.rotation.z,
    u.armL.elbow.rotation.x,u.armR.elbow.rotation.x,
    u.legL.hip.rotation.x,u.legL.hip.rotation.z,u.legR.hip.rotation.x,u.legR.hip.rotation.z,
    u.legL.knee.rotation.x,u.legR.knee.rotation.x,u.legL.ankle.rotation.x,u.legR.ankle.rotation.x
  ];
  assert.ok(values.every(Number.isFinite), label+' pose must not produce NaN or Infinity.');
}
const striker=athlete(false);
animatePenaltyAthlete(striker,1.25);
assertFiniteRig(striker,'Idle striker');
animatePenaltyAthlete(striker,1.5,{run:1,runPhase:Math.PI/2});
assertFiniteRig(striker,'Run-up striker');
assert.notEqual(striker.userData.armL.shoulder.rotation.x,striker.userData.armR.shoulder.rotation.x,'Arms must counter-swing during the run-up.');
animatePenaltyAthlete(striker,1.8,{kick:1,follow:.45});
assertFiniteRig(striker,'Shot striker');
assert.ok(striker.userData.legL.hip.rotation.x < 0,'Striking leg must swing through the ball.');
const keeper=athlete(true);
animatePenaltyAthlete(keeper,2.1,{dive:1,side:1});
assertFiniteRig(keeper,'Goalkeeper dive');
assert.ok(keeper.position.y >= 0,'Goalkeeper dive must not send the root below the pitch.');
console.log('Penalty athlete rig validation passed (idle, run-up, kick follow-through and goalkeeper dive).');
