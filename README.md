# KnightSim

KnightSim is an initial desktop replay and field-visualization MVP inspired by the workflow of FRC AdvantageScope. It uses Electron, Vite, React, strict TypeScript, Tailwind CSS, SVG, and React Three Fiber.

## Included in the MVP

- Synchronized 2D SVG and 3D React Three Fiber battlefield views
- Shared robot pose and camera focus state across tabs
- Mock replay with play/pause, seek, five-second rewind, speed, and timestamp
- Robot inspector for field pose, yaw, HP, heat, and connection status
- Click/drag field placement plus `WASD` movement and `Q`/`E` rotation
- Electron context isolation, renderer sandboxing, disabled Node integration, navigation restrictions, and a minimal preload bridge
- One reusable typed ARCC field spec consumed by both renderers

## Requirements

- Node.js 20 or newer
- npm 10 or newer

## Install and run

```bash
npm install
npm run dev
```

The Vite renderer opens in an Electron window. You can also build and launch the production bundle:

```bash
npm run build
npm start
```

Type-check both the renderer and Electron processes:

```bash
npm run typecheck
```

## Architecture

```text
electron/
  main.cts            secure BrowserWindow lifecycle
  preload.cts         narrow, read-only renderer bridge
src/
  components/         navigation, inspector, replay timeline
  field/fieldSpec.ts  typed, metre-based ARCC 2026 geometry
  hooks/useReplay.ts  replay clock and shared robot state
  telemetry/          deterministic mock telemetry
  views/              SVG 2D and React Three Fiber 3D renderers
```

`src/field/fieldSpec.ts` is the single source of truth for field geometry. The field coordinate origin is the lower-left inner corner in the top-down view; +x points from the red side toward blue, and +y points toward the high-ground long wall. The 3D renderer maps this to Three.js x/z while keeping elevation on Three.js y.

## ARCC manual fidelity

The battlefield specification is transcribed from `manual.pdf`, section 3.2 and Figures 3-1 through 3-10 (printed pages 14-20). All stored dimensions use metres; millimetre annotations are converted through a single helper. It includes:

- 12 m × 8 m inner field and 420 mm perimeter walls
- Mirrored red/blue starting and resupply zones (1500 mm × 2000 mm)
- Central 2000 mm × 2000 mm RFID capture point
- Dimensioned 210 mm/410 mm high-ground levels, 15° approaches, and 784 mm approach runs
- Five-row, 400 mm-tile bumpy roads with the Figure 3-9 stepped outline and 3.7 mm surface height
- Team barriers and all ten Figure 3-10 visual-marker centres
- 150 mm visual markers and RFID-overlay treatment

The source manual allows a ±10% component error and uses parenthesized reference dimensions for some assemblies. The spec keeps the published values and records figure provenance beside the geometry instead of inventing additional construction dimensions.

## Current MVP boundaries

This first pass uses deterministic mock telemetry and a stylized robot mesh. File import, NetworkTables/log adapters, project persistence, and physically simulated collision are natural next milestones. The battlefield geometry module is deliberately independent from those systems so it can remain the canonical source for later replay and simulation work.
