# KnightSim

Electron/React workbench for robot replay, 3D field visualization, telemetry graphs, controller inputs, and GLB models loaded from a folder.

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

`npm test` discovers all regression tests automatically. `npm run test:models` runs the model geometry, folder loading, and settings tests. Browser-only development is available with `npx vite`; loading local model folders requires Electron.

`npm start` rebuilds the app before launching Electron so it includes the latest source changes. Use `npm run dev` for live updates while editing.

The production build runs Vite alongside the renderer/configuration type checks and Electron compilation. Both tasks must succeed; a failure stops the other task. Renderer and Vite-configuration checks reuse incremental state in `node_modules/.tmp`; `npx tsc -b --force` forces a fresh check. The shared robot-profile JSON is an explicit renderer input so edits invalidate that cache.

Across the workspace, Left/Right scrub the play bar backward/forward five seconds, Down/Up scrub backward/forward half a second, and Space plays or pauses. These keys control replay even when a button, the sidebar resize handle, scrubber, or speed selector has focus. Holding an arrow repeats the seek; holding Space toggles playback only once. Replay shortcuts are inactive in Preferences and text inputs, and replay remains disabled with Demo off.

Tailwind scans `src/` and `index.html` for classes instead of the entire project, keeping large model binaries out of CSS generation. If UI templates are added elsewhere, register their paths with `@source` in `src/styles.css`.

## Distribute and update

The sidebar above **Settings** shows the installed version and its publication timestamp in the user's local time zone. Installed apps check public GitHub Releases at startup. **Check for updates** checks again; **Update & restart** downloads the newer version, shows progress, and installs it before relaunching. Downloads and restarts happen only after that click. Failed checks/downloads can be retried. Source/development runs show a disabled update button.

The timestamp is GitHub's `published_at` for the installed version's exact `v<version>` release tag. It is cached in the app's user-data `release-metadata.json` for offline use. A first launch without access to that release shows **Publish date unavailable** until a later successful check. A newer release's date never replaces the installed version's date.

Build installers on their target operating systems:

```sh
npm run dist -- --win
npm run dist -- --mac
npm run dist -- --linux
```

Each command rebuilds and writes installers and update metadata to `release/`, without uploading anything. Windows uses NSIS, macOS produces DMG + ZIP, and Linux uses AppImage. Default robot models are bundled in the installed app's resources; user-selected folders and saved preferences remain in user data. Bundled model preferences use a stable key so they survive app moves, upgrades, and changing AppImage mount paths.

To publish an update:

1. Set a higher semantic version with `npm version patch --no-git-tag-version` (or `minor`/`major`), then run `npm test`.
2. Make the release repository public and anonymously readable. The default is `Gabe3L/knightsim`; edit `electron/releaseConfig.json` to use a separate public releases repository if the source repository stays private. The updater and packaging share this configuration. Do not put GitHub tokens in the app.
3. On each supported OS, set `GH_TOKEN` in your build environment with permission to publish releases, then run `npm run release -- --win`, `--mac`, or `--linux`. This uploads installers and metadata into the same **draft** `v<version>` GitHub Release. Build for the architectures you distribute (for example `--mac --x64 --arm64`).
4. Once every platform's assets are uploaded, publish the draft as a normal, non-prerelease GitHub Release. Keep the generated `latest*.yml`, ZIPs, installers/AppImages, and blockmaps together on that release. Users can then install the update from the sidebar.

macOS automatic updates require a Developer ID signed app. Configure electron-builder's `CSC_LINK` / `CSC_KEY_PASSWORD` signing credentials and Apple notarization credentials (`APPLE_API_KEY`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`, or the supported Apple ID credentials) in the release environment before shipping. See [electron-builder's signing instructions](https://www.electron.build/v26/docs/features/code-signing/) and [update requirements](https://www.electron.build/v26/docs/features/auto-update/). An unsigned local package can be used to inspect the layout, but cannot validate a macOS update.

Before distributing publicly, test two published versions on each target OS: install the older version, click **Update & restart**, and verify that the relaunched app reports the new version and its release timestamp. This requires actual hosted release artifacts and signing credentials; the regression tests use an injected updater to verify the download/restart sequence without installing software.

## Robot profiles

Choose a field format from the top bar. Preferences open on a robot in that format; use the robot picker in Preferences to edit any profile. Each profile has its own model assignment and saved connectivity preferences. Examples include Sentry, Infantry, Hero, Engineer, Dart, and Drone. Geometry values are illustrative, not manufacturer specifications.

The shared registry is [`electron/robotProfiles.json`](electron/robotProfiles.json). To add a robot or another instance of the same chassis:

1. Copy a profile and choose a unique, stable lowercase `id` (for example `infantry-2`) and display `name`. Identity is independent of category and mobility.
2. Set `mobility` to `wheeled`, `omnidirectional`, `tracked`, `legged`, or `aerial`, and set `dimensionsM` (length, width, height). Robots without a model appear as black cubes with their display name on every face; the cube side uses the largest profile dimension. GLBs retain their own dimensions and explicit scale.
3. Select an existing rendering `category`: `infantry`, `sentry`, `hero`, or `generic` (`ghost` and `enemy` are also available). Set `capabilities` and `maxHp`/`maxHeat`; use zero for unsupported referee or heat data. Keep `odometry` false unless you supply an overlay adapter—existing odometry data belongs to Infantry.
4. Set `demoPhase` to offset the synthetic controller inputs.
5. Run tests and rebuild/restart Electron. The registry automatically supplies the field selector, settings, sidebar, graph signals, controller inputs, and IPC model-assignment allowlist.

Saved preferences override changed defaults for existing IDs. Do not rename an ID to rename a robot: change its `name` instead. Model-library migration preserves existing and currently unknown robot assignments.

## Coordinates and models

Models load directly from the selected folder, which defaults to `./models` in the application/project root. In **Preferences → Appearance**, use **Choose folder** to select any model directory, then choose a model for each robot in the **Robot model** dropdown. The app remembers the folder across restarts. **Use ./models** returns to the default, and **Refresh** picks up added, changed, or removed files without restarting. Only regular `.glb` files directly inside the folder are listed; subdirectories and symbolic links are excluded. Invalid GLBs are reported individually. An empty or missing folder uses the labeled black cube fallback.

Telemetry uses metres, a horizontal X/Y plane, Z altitude, and degree angles. Model assets use Three.js Y-up, with local +X forward. The field maps telemetry X/Y to world -X/+Z; positive yaw turns +X toward +Y. Roll is about local forward and pitch is about the lateral axis (nose-up positive). Aerial demo samples include altitude, pitch, and roll. Rotation and flips in Preferences adapt asset axes; scale is a uniform multiplier (use `0.001` for millimetre exports). Models are centered horizontally and grounded at their lowest point; telemetry altitude offsets that base.

Use self-contained glTF 2.0 `.glb` files. JSON metadata is limited to 32 MiB; binary geometry may be larger. Draco-compressed assets are supported. Static, opaque compatible meshes are batched by material to reduce draw calls. Instanced, skinned, morphing, transparent, partial-draw, and animated models preserve their hierarchy. Each displayed model gets its own scene clone, including independent skeletons. Animated node hierarchies are preserved; clip playback and joint control are not implemented.

Appearance includes a live model preview next to the transform controls. Drag to orbit, Shift-drag or right-drag to pan, and scroll to zoom; flips, rotations, and applied scale changes update the preview using the same rendering as the field. Panning moves the camera and its focus together, so you can inspect different parts of the model. The camera stays in place while editing; **Reset view** fits the current model again. Selecting a different robot or model fits its preview automatically.

Model files stay in their source folder. Only the selected folder, assignments, and transforms are saved in Electron's user-data `robot-models/library.json`. Each folder remembers its own assignments and transforms, including when a file temporarily disappears. Settings updates are serialized and written through a temporary file plus rename. Invalid/unsupported settings are reported instead of silently replaced. Back up and repair `library.json` if that error occurs. Orientation is shared by robots using the same file; duplicate the source file for a different orientation. Old imported-library settings reconnect to matching source filenames in the default folder; existing stored model copies are left untouched.

## Game fields

The 1v1, 3v3, Drone, and Dart views follow the **November 1, 2026 Season 2 manual** in [`docs/Event Rules - November 1st.pdf`](docs/Event%20Rules%20-%20November%201st.pdf). **Sentry** uses the same field and preview route as 1v1, with the Sentry robot in place of Infantry. The 3v3 model includes the new walls, high grounds, objectives, scoring areas, pipe chutes, bumpy roads, and limbo bars. The drone layout has its own base and launch zone, separated by the dimensioned 25 m and 6 m offsets. **Dart** uses the same blue base and a red 1 × 0.6 m starting zone whose centre is offset 25.5 m and 3 m from the base centre (Figure 7-1, pp. 45–46). Both challenge fields have display floor padding rather than perimeter walls. Each field starts at an end corner with a low, 22° downward view along the field. Drone and Dart start at the launch end, looking toward the base. The camera then flies independently: drag to look from the current position, use WASD to fly, Q/E to lower/raise, and scroll to move forward/back. Shift-drag or middle-drag pans in the view plane. Switching fields smoothly transitions to that field’s last camera position and direction over 0.8 seconds, easing in and out. Manual camera input takes over immediately; resizing preserves the active flight pose within the new window’s flight limits. Camera movement stays above the floor and within a tight viewing area around each field, including an altitude limit. The limits leave a little room beyond the fitted overview, even in narrow windows. A red grid barrier fades in within 1.5 m of the outer walls or ceiling and disappears as you move back toward the field. Keyboard flight, panning, and scrolling all respect these limits.

The camera stops 0.35 m short of the barrier so it cannot sit in the grid. Resizing or interrupting a field transition brings an out-of-bounds camera back inside this clearance immediately, including when you only drag to look around.

Field specifications in [`src/field/fieldSpec.ts`](src/field/fieldSpec.ts) record their manual references and illustrative details. The Dart tape width follows the other fields; the manual does not separately dimension it. Base shell and armor outlines are illustrative.

## Current scope

This is a visualization/replay workbench with **synthetic demonstration data**. The **Demo** switch in the top bar controls the sample data in every view. It starts on for a new installation and remembers its last setting across restarts. With Demo off, all robots show offline, field robots remain at their starting positions, telemetry values are unavailable, graphs wait for a connection, controller inputs are neutral, and sample replay controls are disabled. Turning Demo back on restores the sample data and replay position, with playback paused.

Each field uses its own preview routes: ground robots follow clear corridors, and the drone takes off from and returns to its starting zone. Connectivity settings store preferences only; SSH connections and hardware control are not implemented, so robots remain offline with Demo off until a live telemetry source is implemented. Controller values are synthetic generic mappings, not robot-specific hardware protocols. Odometry overlays currently show Infantry data.

Real robot integration should provide timestamped `RobotTelemetry` samples through the robot-state adapter, replay hook, and signal descriptors, with explicit units and stable robot IDs. Extend the overlay registry and sampling adapter for additional localization sources. The field previews the lineup for its format (Infantry for 1v1, Sentry, the three 3v3 robots, Drone, or Dart). The Dart preview follows an illustrative flight from its starting zone toward the base; ballistics and hit scoring are not implemented.

Rendering avoids replay updates in the hidden field and unmounts hidden graph/controller views. Graph curves are cached independently of the moving cursor. Playback ignores non-finite seeks/speeds and caps elapsed frame time after suspension to avoid jumping to the end of a recording.
