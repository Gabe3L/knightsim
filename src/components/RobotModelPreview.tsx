import { Bounds, GizmoHelper, GizmoViewport, Grid, Html, OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { RotateCcw } from 'lucide-react';
import { Suspense, useRef, useState } from 'react';
import type { Mesh } from 'three';
import { OrbitControls as ThreeOrbitControls } from 'three-stdlib';
import { robotProfile } from '../robots/profiles';
import type { RobotId, RobotModelRecord } from '../types';
import { ModelErrorBoundary, PlaceholderRobot, RobotModel } from './RobotModel';

interface RobotModelPreviewProps {
  readonly robotId: RobotId;
  readonly model: RobotModelRecord | null;
}

function PreviewGround() {
  const floor = useRef<Mesh>(null);

  // Apply the floor limit after camera updates and before the gizmo renders the scene.
  useFrame(({ camera, controls }) => {
    const clearance = camera.near * 2;
    if (camera.position.y < clearance) {
      const lift = clearance - camera.position.y;
      camera.position.y = clearance;
      if (controls instanceof ThreeOrbitControls) controls.target.y += lift;
    }

    if (floor.current) {
      // Cover the visible ground even after panning far from the model.
      floor.current.position.set(camera.position.x, 0, camera.position.z);
      floor.current.scale.setScalar(camera.far * 4);
    }
  }, 0.5);

  return <>
    <mesh ref={floor} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[1, 1]} />
      <meshStandardMaterial color="#272732" roughness={1} polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1} />
    </mesh>
    <Grid infiniteGrid followCamera cellSize={0.1} sectionSize={0.5} cellColor="#424251" sectionColor="#656477" fadeDistance={15} />
  </>;
}

export function RobotModelPreview({ robotId, model }: RobotModelPreviewProps) {
  const [view, setView] = useState(0);
  const robot = robotProfile(robotId);
  const cacheKey = `${robotId}:${model?.id ?? 'placeholder'}:${model?.revision ?? ''}:${view}`;

  return (
    <section className="model-preview" aria-label={`${robot.name} model preview`}>
      <div className="model-preview-heading">
        <strong>Live preview</strong>
        <button className="secondary-button" type="button" onClick={() => setView((current) => current + 1)}>
          <RotateCcw size={13} /> Reset view
        </button>
      </div>
      <div className="model-preview-stage">
        <ModelErrorBoundary
          cacheKey={cacheKey}
          robotId={robotId}
          fallback={<div className="model-preview-unavailable" role="status">Unable to preview this model. Try another model or refresh the model folder.</div>}
        >
          <Canvas
            frameloop="demand"
            dpr={[1, 1.5]}
            gl={{ antialias: true, alpha: false }}
            fallback={<div className="model-preview-unavailable" role="status">3D preview requires WebGL.</div>}
          >
            <color attach="background" args={['#0d0b12']} />
            <ambientLight intensity={1.5} />
            <hemisphereLight args={['#e5e9ff', '#39313f', 2]} />
            <directionalLight position={[4, 6, 3]} intensity={3} />
            <directionalLight position={[-4, 2, -3]} intensity={1.5} />
            <group key={cacheKey}>
              <PerspectiveCamera makeDefault position={[3, 2.3, 3]} fov={40} />
              <OrbitControls makeDefault enablePan screenSpacePanning maxPolarAngle={Math.PI / 2} />
              <Suspense fallback={<Html center><span className="model-preview-status" role="status">Loading model…</span></Html>}>
                {/* Fit on load, resize, or Reset view. Keep the camera steady while editing transforms. */}
                <Bounds fit clip observe margin={1.5} maxDuration={0.2}>
                  {/* Match the field's reflected X axis, centering, and grounding. */}
                  <group scale={[-1, 1, 1]}>
                    {model && window.knightSim?.robotModels
                      ? <RobotModel model={model} />
                      : <PlaceholderRobot robotId={robotId} />}
                  </group>
                </Bounds>
              </Suspense>
            </group>
            <PreviewGround />
            <GizmoHelper alignment="bottom-left" margin={[42, 42]}>
              <GizmoViewport hideNegativeAxes axisColors={['#ef4764', '#83c99a', '#7aa7ed']} labelColor="#15121b" />
            </GizmoHelper>
          </Canvas>
        </ModelErrorBoundary>
      </div>
      <p className="model-preview-hint">Drag to orbit · Shift-drag or right-drag to pan · Scroll to zoom.</p>
    </section>
  );
}
