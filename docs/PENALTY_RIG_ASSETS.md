# Penalty Lakay — skinned player asset

## Character model

- Asset: Quaternius “Animated Men” rigged character, `player.glb`
- Source repository: https://github.com/kendrekaran/striker-3d
- Source file: `assets/player.glb`
- Pinned source commit: `57847f87ff3d924712a1bb37df9dae391aedc315`
- Delivery: lazy-loaded through jsDelivr; the binary is not duplicated in this repository.
- License: CC0 1.0 Universal. The source repository includes `assets/LICENSE-quaternius.txt`.

The model is loaded once, then cloned with `SkeletonUtils.clone` for the striker and goalkeeper. Each clone gets its own skinned geometry, kit materials, name/number decals and `THREE.AnimationMixer`. The existing points game, shot event, result flow and procedural 3D model fallback remain separate from the asset loader.

## Animation coverage and remaining work

The rig provides humanoid locomotion clips such as idle, walk and run. Its general-purpose punch and jump clips are temporary stand-ins for the shot-contact and goalkeeper-dive states. They are not authentic soccer motion-capture clips.

The next animation pass should retarget soccer-specific clips (approach/run-up, right- and left-footed strike, keeper dive left/right, recovery and celebration) onto this exact skeleton. Do not label the current generic punch/jump clips as FIFA-level football motion capture.
## Soccer-specific motion-capture source

A suitable next-stage source has been identified: [Anderson Rohr — Free mocap pack 05: Soccer](https://andersonrohr.gumroad.com/l/mocap_pack5).

The creator lists 21 FBX motions at 60 fps, including:
- `01_Dribble_01` to `03_Dribble_03`
- `08_Side_Foot_Kick`, `09_Power_Kick`
- `10_Penalty_Kick_01`, `11_Penalty_Kick_02`
- `15_Goalkeeper_Save_01` to `17_Goalkeeper_Save_03`
- Three goal celebrations and defending/throw-in actions.

The creator states it is free for personal and commercial projects, attribution is not required, but the pack may not be redistributed or repackaged as a standalone product. It is a 130 MB ZIP with Rokoko Default, iClone and UE5 Manny skeleton variants.

These are FBX source motions, not ready-to-play clips for the Quaternius rig. They must be retargeted and checked (foot contact, facing direction, root motion, scale and frame range) before being merged into the runtime GLB. The runtime resolver is prepared to prefer `Penalty_Kick_01/02`, `Power_Kick`, `Side_Foot_Kick` and `Goalkeeper_Save_01/02/03`; it continues to use generic clips until a valid retargeted asset exists.

Do not check in the source ZIP wholesale. Add only the retargeted/optimized derived animation asset needed by the game, with the source, license and clip names documented here.