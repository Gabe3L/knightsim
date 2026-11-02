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

## Robot profiles

Choose a robot from the **Field** dropdown. Preferences open on that robot; each profile has its own model assignment, tuning defaults, and saved connectivity preferences. Examples include Sentry, Infantry, Hero, Engineer, Dart, and Drone. Geometry and tuning values are illustrative, not manufacturer specifications.

The shared registry is [`electron/robotProfiles.json`](electron/robotProfiles.json). To add a robot or another instance of the same chassis:

1. Copy a profile and choose a unique, stable lowercase `id` (for example `infantry-2`) and display `name`. Identity is independent of category and mobility.
2. Set `mobility` to `wheeled`, `omnidirectional`, `tracked`, `legged`, or `aerial`, and set `dimensionsM` (length, width, height). Dimensions control the placeholder; imported GLBs retain their own dimensions and explicit scale.
3. Select an existing rendering `category`: `infantry`, `sentry`, `hero`, or `generic` (`ghost` and `enemy` are also available). Set `capabilities` and `maxHp`/`maxHeat`; use zero for unsupported referee or heat data. Keep `odometry` false unless you supply an overlay adapter—existing odometry data belongs to Infantry.
4. Set `tuning` defaults. Distances/speeds use metres and seconds; `robotMass` is kg, `wheelRadius` is mm, angular speed is degrees/second, control frequency is Hz, and drive current is amperes. Wheel radius is hidden for legged and aerial profiles. `demoPhase` offsets the synthetic controller inputs.
5. Run tests and rebuild/restart Electron. The registry automatically supplies the field selector, settings, sidebar, graph signals, controller inputs, and IPC model-assignment allowlist.

Saved preferences override changed defaults for existing IDs. Do not rename an ID to rename a robot: change its `name` instead. Model-library migration preserves existing and currently unknown robot assignments.

## Coordinates and models

Telemetry uses metres, a horizontal X/Y plane, Z altitude, and degree angles. Model assets use Three.js Y-up, with local +X forward. The field maps telemetry X/Y to world -X/+Z; positive yaw turns +X toward +Y. Roll is about local forward and pitch is about the lateral axis (nose-up positive). Aerial demo samples include altitude, pitch, and roll. Rotation and flips in Preferences adapt asset axes; scale is a uniform multiplier (use `0.001` for millimetre exports). Imported models are centered horizontally and grounded at their lowest point; telemetry altitude offsets that base.

Import self-contained glTF 2.0 `.glb` files. JSON metadata is limited to 32 MiB; binary geometry may be larger. Draco-compressed assets are supported. Static, opaque compatible meshes are batched by material to reduce draw calls. Instanced, skinned, morphing, transparent, partial-draw, and animated models preserve their hierarchy. Each displayed model gets its own scene clone, including independent skeletons. Animated node hierarchies are preserved; clip playback and joint control are not implemented.

Models live in Electron's user-data `robot-models` directory. Library updates are serialized and written through a temporary file plus rename. Invalid/unsupported libraries are reported instead of silently replaced. Back up and repair `library.json` if that error occurs. Orientation belongs to the library asset and is shared by every robot assigned that asset; import a separate copy for a different orientation.

## Current scope

This is a visualization/replay workbench with **synthetic demonstration data**. Selecting a robot changes its preview and telemetry profile; it does not create a physics simulation. All examples follow the same demonstration route, authored for the 3v3 arena; the smaller arena does not constrain that route. Settings store configuration only: physics, collisions, flight dynamics, SSH connections, and hardware control are not implemented. Controller values are synthetic generic mappings, not robot-specific hardware protocols. Odometry overlays currently show Infantry data.

Real robot integration should provide timestamped `RobotTelemetry` samples through the replay hook and signal descriptors, with explicit units and stable robot IDs. Extend the overlay registry and sampling adapter for additional localization sources. Multiple profiles are supported, but the field currently previews one selected robot at a time.

Rendering avoids replay updates in the hidden field and unmounts hidden graph/controller views. Graph curves are cached independently of the moving cursor. Playback ignores non-finite seeks/speeds and caps elapsed frame time after suspension to avoid jumping to the end of a recording.
