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