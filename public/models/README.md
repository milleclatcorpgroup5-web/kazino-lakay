# Penalty Lakay realistic player assets

The striker and goalkeeper are generated as separate rigged GLB assets from Ara 3D Gen.

## Source and licensing

- Generator: Ara 3D Gen, MIT-licensed code.
- Character base assets: MakeHuman CC0 1.0.
- Motion clips: CMU Graphics Lab Motion Capture Database; the source documents free commercial use, with the original database terms retained in the export.
- Project-specific character settings are stored in `characters/penalty-shooter.json` and `characters/penalty-keeper.json`.

## Generated runtime files

The workflow creates:

- `public/models/penalty-shooter.glb`
- `public/models/penalty-keeper.glb`

The files are generated after the workflow is present on the default `main` branch and the character configuration is merged. The workflow commits the generated assets so Cloudflare Pages can serve them locally; the game does not fetch character models from a third-party CDN.

## Regeneration

Run **Actions → Build realistic Penalty Lakay GLB characters → Run workflow** on `main`, or merge a change to either character JSON file. The workflow reports each model's final size. The mobile target is 3 MB per model; if either export exceeds that target, reduce detail/clip count or add a verified glTF compression pass before deployment.

## Runtime contract

Both GLBs must contain a skinned humanoid mesh, a Mixamo-name game rig, and the role-specific animation clips. The runtime loader checks for a skinned mesh and embedded clips before it hides the old placeholder geometry. Missing files produce an explicit on-screen error instead of silently showing the procedural mannequin.
