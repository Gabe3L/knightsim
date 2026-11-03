# KnightSim

Electron/React workbench for robot replay, 3D field visualization, telemetry graphs, controller inputs, and imported GLB models.

## Run and verify

Use Node.js 22.15+ (or a compatible newer release).

```sh
npm ci
npm run dev
npm test
npm run typecheck
npm run build
npm start
```

`npm test` discovers all regression tests automatically. `npm run test:models` runs the model geometry and library tests. Browser-only development is available with `npx vite`; model import requires Electron.

`npm start` rebuilds the app before launching Electron so it includes the latest source changes. Use `npm run dev` for live updates while editing.

The production build runs Vite alongside the renderer/configuration type checks and Electron compilation. Both tasks must succeed; a failure stops the other task. Renderer and Vite-configuration checks reuse incremental state in `node_modules/.tmp`; `npx tsc -b --force` forces a fresh check. The shared robot-profile JSON is an explicit renderer input so edits invalidate that cache.

Tailwind scans `src/` and `index.html` for classes instead of the entire project, keeping large model binaries out of CSS generation. If UI templates are added elsewhere, register their paths with `@source` in `src/styles.css`.

## Robot profiles

Choose a robot from the **Field** dropdown. Preferences open on that robot; each profile has its own model assignment, tuning defaults, and saved connectivity preferences. Examples include Sentry, Infantry, Hero, Engineer, Dart, and Drone. Geometry and tuning values are illustrative, not manufacturer specifications.

The shared registry is [`electron/robotProfiles.json`](electron/robotProfiles.json). To add a robot or another instance of the same chassis:

1. Copy a profile and choose a unique, stable lowercase `id` (for example `infantry-2`) and display `name`. Identity is independent of category and mobility.
2. Set `mobility` to `wheeled`, `omnidirectional`, `tracked`, `legged`, or `aerial`, and set `dimensionsM` (length, width, height). Robots without a model appear as black cubes with their display name on every face; the cube side uses the largest profile dimension. Imported GLBs retain their own dimensions and explicit scale.
3. Select an existing rendering `category`: `infantry`, `sentry`, `hero`, or `generic` (`ghost` and `enemy` are also available). Set `capabilities` and `maxHp`/`maxHeat`; use zero for unsupported referee or heat data. Keep `odometry` false unless you supply an overlay adapter—existing odometry data belongs to Infantry.
4. Set `tuning` defaults. Distances/speeds use metres and seconds; `robotMass` is kg, `wheelRadius` is mm, angular speed is degrees/second, control frequency is Hz, and drive current is amperes. Wheel radius is hidden for legged and aerial profiles. `demoPhase` offsets the synthetic controller inputs.
5. Run tests and rebuild/restart Electron. The registry automatically supplies the field selector, settings, sidebar, graph signals, controller inputs, and IPC model-assignment allowlist.

Saved preferences override changed defaults for existing IDs. Do not rename an ID to rename a robot: change its `name` instead. Model-library migration preserves existing and currently unknown robot assignments.

## Coordinates and models

Telemetry uses metres, a horizontal X/Y plane, Z altitude, and degree angles. Model assets use Three.js Y-up, with local +X forward. The field maps telemetry X/Y to world -X/+Z; positive yaw turns +X toward +Y. Roll is about local forward and pitch is about the lateral axis (nose-up positive). Aerial demo samples include altitude, pitch, and roll. Rotation and flips in Preferences adapt asset axes; scale is a uniform multiplier (use `0.001` for millimetre exports). Imported models are centered horizontally and grounded at their lowest point; telemetry altitude offsets that base.

Import self-contained glTF 2.0 `.glb` files. JSON metadata is limited to 32 MiB; binary geometry may be larger. Draco-compressed assets are supported. Static, opaque compatible meshes are batched by material to reduce draw calls. Instanced, skinned, morphing, transparent, partial-draw, and animated models preserve their hierarchy. Each displayed model gets its own scene clone, including independent skeletons. Animated node hierarchies are preserved; clip playback and joint control are not implemented.

Models live in Electron's user-data `robot-models` directory. Library updates are serialized and written through a temporary file plus rename. Invalid/unsupported libraries are reported instead of silently replaced. Back up and repair `library.json` if that error occurs. Orientation belongs to the library asset and is shared by every robot assigned that asset; import a separate copy for a different orientation.

## Game fields

The 1v1, 3v3, Drone, and Dart views follow the **November 1, 2026 Season 2 manual** in [`docs/Event Rules - November 1st.pdf`](docs/Event%20Rules%20-%20November%201st.pdf). **Sentry** uses the same field and preview route as 1v1, with the Sentry robot in place of Infantry. The 3v3 model includes the new walls, high grounds, objectives, scoring areas, pipe chutes, bumpy roads, and limbo bars. The drone layout has its own base and launch zone, separated by the dimensioned 25 m and 6 m offsets. **Dart** uses the same blue base and a red 1 × 0.6 m starting zone whose centre is offset 25.5 m and 3 m from the base centre (Figure 7-1, pp. 45–46). Both challenge fields have display floor padding rather than perimeter walls. Each field starts with its own elevated overview, framing the floor and preview flight height with space above the timeline. Drone and Dart views look across the course to show both the launch zone and base. The camera then flies independently: drag to look from the current position, use WASD to fly, Q/E to lower/raise, and scroll to move forward/back. Shift-drag or middle-drag pans in the view plane. Switching fields restores that field’s last camera position and direction; resizing preserves the active flight pose. Camera movement has no field boundaries or orbit-distance limits.

Field specifications in [`src/field/fieldSpec.ts`](src/field/fieldSpec.ts) record their manual references and illustrative details. The Dart tape width follows the other fields; the manual does not separately dimension it. Base shell and armor outlines are illustrative.

## Current scope

This is a visualization/replay workbench with **synthetic demonstration data**. Selecting a robot changes its active telemetry profile and model preferences; it does not create a physics simulation. Each field uses its own preview routes: ground robots follow clear corridors, and the drone takes off from and returns to its starting zone. Settings store configuration only: physics, collisions, flight dynamics, SSH connections, and hardware control are not implemented. Controller values are synthetic generic mappings, not robot-specific hardware protocols. Odometry overlays currently show Infantry data.

Real robot integration should provide timestamped `RobotTelemetry` samples through the replay hook and signal descriptors, with explicit units and stable robot IDs. Extend the overlay registry and sampling adapter for additional localization sources. The field previews the lineup for its format (Infantry for 1v1, Sentry, the three 3v3 robots, Drone, or Dart); the selector chooses the active telemetry profile. The Dart preview follows an illustrative flight from its starting zone toward the base; ballistics and hit scoring are not implemented.

Rendering avoids replay updates in the hidden field and unmounts hidden graph/controller views. Graph curves are cached independently of the moving cursor. Playback ignores non-finite seeks/speeds and caps elapsed frame time after suspension to avoid jumping to the end of a recording.
