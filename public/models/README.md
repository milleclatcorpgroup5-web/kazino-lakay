# Penalty Lakay — GLB character assets

Place the two character models in this folder with these exact names:

- `penalty-player.glb` — shooter / outfield player
- `penalty-keeper.glb` — goalkeeper with gloves

The Three.js scene loads them with `GLTFLoader`. If a file is missing or cannot be loaded, the current procedural 3D character remains visible; the game logic and controls continue to work.

## Recommended model requirements

- GLB (binary glTF), embedded textures.
- Realistic human proportions, approximately 1.7–2.0 m tall.
- Feet at ground level; Y axis points upward.
- Prefer a rigged humanoid with animation clips named with words such as `idle`, `run`, `kick`, `dive` or `save`.
- Shooter: football shirt, shorts, long socks and boots.
- Goalkeeper: contrasting kit and goalkeeper gloves.
- Keep each model reasonably optimized for mobile (ideally under 8 MB and under 80k triangles).

The loader recolors meshes when their material or mesh names contain `shirt`, `jersey`, `upper`, `torso`, `short`, `pant` or `sock`. Use descriptive names in Blender for team-color changes to work reliably.

Only add models whose license permits use and redistribution in this game. Do not use copyrighted club/player likenesses without permission.
