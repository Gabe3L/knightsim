import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { robotProfile } from '../robots/profiles';
import {
  AdaptiveDpr,
  Center,
  Html,
  Line,
  OrbitControls,
  PerspectiveCamera,
  useGLTF,
} from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Component,
  memo,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  type ComponentRef,
  type ErrorInfo,
  type ReactNode,
} from "react";
import { CanvasTexture, SRGBColorSpace, Vector3 } from "three";
import { FIELD_SPECS, fieldWorldX, fieldWorldZ, fieldCameraDistance, fieldCameraDirection } from "../field/fieldSpec";
import { FieldArena } from "../field/FieldArena";
import { fieldCameraActionForCode, type FieldCameraAction } from "../keybindings";
import { configureDracoLoader } from "../loaders/draco";
import { prepareRobotModel } from "../loaders/prepareRobotModel";
import type { ResolvedFieldOverlay } from "../overlays/fieldOverlays";
import type { CameraState, FieldMode, RobotId, RobotModelRecord, RobotTelemetry } from "../types";

interface FieldProps {
  readonly active: boolean;
  readonly robot: RobotTelemetry;
  readonly camera: CameraState;
  readonly mode: FieldMode;
  readonly robots: readonly RobotTelemetry[];
  readonly modelForRobot: (id: RobotId) => RobotModelRecord | null;
  readonly overlays: readonly ResolvedFieldOverlay[];
}

const modeWorldX = fieldWorldX;
const modeWorldZ = fieldWorldZ;

function PlaceholderRobot({ robotId }: Pick<RobotTelemetry, "robotId">) {
  const robot = robotProfile(robotId);
  const { length, width, height } = robot.dimensionsM;
  const side = Math.max(length, width, height);
  const label = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 512;
    const context = canvas.getContext("2d");
    if (!context) return null;

    context.fillStyle = "#000000";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#ffffff";
    context.font = "bold 80px sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(robot.name, canvas.width / 2, canvas.height / 2, canvas.width - 64);

    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    return texture;
  }, [robot.name]);

  useEffect(() => () => label?.dispose(), [label]);

  return (
    // Undo the robot's reflected X axis so the face labels stay readable.
    <mesh position={[0, side / 2, 0]} scale={[-1, 1, 1]} castShadow>
      <boxGeometry args={[side, side, side]} />
      <meshBasicMaterial map={label} color={label ? "#ffffff" : "#000000"} toneMapped={false} />
    </mesh>
  );
}

interface ModelErrorBoundaryProps {
  readonly cacheKey: string;
  readonly robotId: RobotTelemetry['robotId'];
  readonly children: ReactNode;
}

interface ModelErrorBoundaryState {
  readonly failed: boolean;
}

class ModelErrorBoundary extends Component<
  ModelErrorBoundaryProps,
  ModelErrorBoundaryState
> {
  override state: ModelErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ModelErrorBoundaryState {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Unable to render the selected robot model:", error, info);
  }

  override componentDidUpdate(previous: ModelErrorBoundaryProps): void {
    if (this.state.failed && previous.cacheKey !== this.props.cacheKey)
      this.setState({ failed: false });
  }

  override render(): ReactNode {
    return this.state.failed ? <PlaceholderRobot robotId={this.props.robotId} /> : this.props.children;
  }
}

const UploadedRobot = memo(function UploadedRobot({
  model,
}: {
  readonly model: RobotModelRecord;
}) {
  const url = window.knightSim?.robotModels.urlFor(model.id) ?? "";
  const { scene, animations } = useGLTF(url, false, true, configureDracoLoader);
  const prepared = useMemo(() => prepareRobotModel(scene, animations.length > 0), [scene, animations]);
  // A cached template must never be attached to multiple scene parents.
  const object = useMemo(() => cloneSkeleton(prepared.object), [prepared]);
  const { rotationDeg, flipped, scale = 1 } = model.orientation;
  const orientationKey = [
    scale,
    rotationDeg.x,
    rotationDeg.y,
    rotationDeg.z,
    flipped.x,
    flipped.y,
    flipped.z,
  ].join(":");

  return (
    <Center top precise={false} cacheKey={orientationKey}>
      <group
        rotation={[
          (rotationDeg.x * Math.PI) / 180,
          (rotationDeg.y * Math.PI) / 180,
          (rotationDeg.z * Math.PI) / 180,
        ]}
        scale={[(flipped.x ? -1 : 1) * scale, (flipped.y ? -1 : 1) * scale, (flipped.z ? -1 : 1) * scale]}
      >
        <primitive object={object} dispose={null} />
      </group>
    </Center>
  );
});

function Robot({ robot, model, mode }: {
  readonly robot: RobotTelemetry;
  readonly model: RobotModelRecord | null;
  readonly mode: FieldMode;
}) {
  return (
    <group
      name={`robot:${robot.category}`}
      position={[modeWorldX(robot.xM, mode), 0.035 + robot.zM, modeWorldZ(robot.yM, mode)]}
      rotation={[-robot.rollDeg * Math.PI / 180, robot.yawDeg * Math.PI / 180, -robot.pitchDeg * Math.PI / 180, 'YXZ']}
      scale={[-1, 1, 1]}
    >
      {model && window.knightSim?.robotModels ? (
        <ModelErrorBoundary cacheKey={model.id} robotId={robot.robotId}>
          <Suspense fallback={<PlaceholderRobot robotId={robot.robotId} />}>
            <UploadedRobot model={model} />
          </Suspense>
        </ModelErrorBoundary>
      ) : (
        <PlaceholderRobot robotId={robot.robotId} />
      )}
    </group>
  );
}

function FieldOverlayPrimitive({
  overlay,
  layerIndex,
  mode,
}: {
  readonly overlay: ResolvedFieldOverlay;
  readonly layerIndex: number;
  readonly mode: FieldMode;
}) {
  if (!overlay.visible || !overlay.sample.available) return null;
  const { descriptor, sample, color } = overlay;
  const pose = sample.pose;
  const rejected = sample.status === 'rejected';
  const opacity = rejected ? 0.45 : 0.92;
  const layerY = 0.045 + layerIndex * 0.008;
  const headingEnd = pose ? {
    xM: pose.xM + Math.cos((pose.yawDeg * Math.PI) / 180) * 0.48,
    yM: pose.yM + Math.sin((pose.yawDeg * Math.PI) / 180) * 0.48,
  } : null;
  const ellipsePoints: [number, number, number][] = pose && sample.covariance
    ? Array.from({ length: 41 }, (_, index) => {
      const theta = (index / 40) * Math.PI * 2;
      const angle = (sample.covariance!.angleDeg * Math.PI) / 180;
      const localX = Math.cos(theta) * sample.covariance!.majorM;
      const localY = Math.sin(theta) * sample.covariance!.minorM;
      const xM = pose.xM + localX * Math.cos(angle) - localY * Math.sin(angle);
      const yM = pose.yM + localX * Math.sin(angle) + localY * Math.cos(angle);
      return [modeWorldX(xM, mode), layerY, modeWorldZ(yM, mode)];
    })
    : [];

  return (
    <group>
      {sample.path && sample.path.length > 1 ? (
        <Line
          points={sample.path.map((point): [number, number, number] => [
            modeWorldX(point.xM, mode), layerY, modeWorldZ(point.yM, mode),
          ])}
          color={color}
          lineWidth={2}
          dashed
          dashSize={0.12}
          gapSize={0.07}
          transparent
          opacity={opacity}
        />
      ) : null}
      {pose && sample.residualToFused ? (
        <Line
          points={[
            [modeWorldX(pose.xM, mode), layerY, modeWorldZ(pose.yM, mode)],
            [modeWorldX(sample.residualToFused.xM, mode), layerY, modeWorldZ(sample.residualToFused.yM, mode)],
          ]}
          color={color}
          lineWidth={1}
          dashed
          dashSize={0.06}
          gapSize={0.05}
          transparent
          opacity={0.45}
        />
      ) : null}
      {ellipsePoints.length > 0 ? (
        <Line points={ellipsePoints} color={color} lineWidth={1.5} transparent opacity={opacity * 0.76} />
      ) : null}
      {pose ? (
        <>
          <group position={[modeWorldX(pose.xM, mode), layerY, modeWorldZ(pose.yM, mode)]}>
            descriptor.kind === 'fused' ? (
              <>
                <mesh rotation={[-Math.PI / 2, 0, 0]}>
                  <ringGeometry args={[0.28, 0.34, 32]} />
                  <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
                </mesh>
                <mesh>
                  <boxGeometry args={[0.44, 0.04, 0.36]} />
                  <meshBasicMaterial color={color} wireframe transparent opacity={opacity} depthWrite={false} />
                </mesh>
              </>
            ) : (
              <mesh>
                <boxGeometry args={[0.44, 0.035, 0.36]} />
                <meshBasicMaterial color={color} wireframe transparent opacity={opacity} depthWrite={false} />
              </mesh>
            )
          </group>
          {headingEnd ? (
            <Line
              points={[
                [modeWorldX(pose.xM, mode), layerY + 0.025, modeWorldZ(pose.yM, mode)],
                [modeWorldX(headingEnd.xM, mode), layerY + 0.025, modeWorldZ(headingEnd.yM, mode)],
              ]}
              color={color}
              lineWidth={descriptor.kind === 'fused' ? 4 : 2.5}
              transparent
              opacity={opacity}
            />
          ) : null}
          {descriptor.tagId !== undefined ? (
            <Html center position={[modeWorldX(pose.xM, mode), layerY + 0.23, modeWorldZ(pose.yM, mode)]}>
              <span className="field-overlay-label" style={{ color }}>TAG {descriptor.tagId}</span>
            </Html>
          ) : null}
        </>
      ) : null}
    </group>
  );
}

function FieldOverlays({ overlays, mode }: Pick<FieldProps, 'overlays' | 'mode'>) {
  return overlays.map((overlay, index) => (
    <FieldOverlayPrimitive key={overlay.id} overlay={overlay} layerIndex={index} mode={mode} />
  ));
}

function AdaptiveReplayQuality({ robot }: Pick<FieldProps, "robot">) {
  const regress = useThree((state) => state.performance.regress);
  const initialDpr = useThree((state) => state.viewport.initialDpr);

  useEffect(() => {
    regress();
  }, [regress, robot.xM, robot.yM, robot.yawDeg]);

  return initialDpr > 1 ? <AdaptiveDpr /> : null;
}

const CAMERA_FLIGHT_SPEED_MPS = 5;

const isEditableTarget = (target: EventTarget | null): boolean => (
  target instanceof HTMLElement
  && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
);

function FieldCameraFlightControls({ active, camera: cameraState, mode }: Pick<FieldProps, 'active' | 'camera' | 'mode'>) {
  const sceneCamera = useThree((state) => state.camera);
  const invalidate = useThree((state) => state.invalidate);
  const controlsRef = useRef<ComponentRef<typeof OrbitControls>>(null);
  const pressedActions = useRef(new Set<FieldCameraAction>());
  const forward = useMemo(() => new Vector3(), []);
  const right = useMemo(() => new Vector3(), []);
  const movement = useMemo(() => new Vector3(), []);
  const vertical = useMemo(() => new Vector3(0, 1, 0), []);

  useEffect(() => {
    pressedActions.current.clear();
    if (!active) return;

    const handleKeyDown = (event: KeyboardEvent): void => {
      const action = fieldCameraActionForCode(event.code);
      if (!action || event.metaKey || event.ctrlKey || event.altKey || isEditableTarget(event.target)) return;
      event.preventDefault();
      pressedActions.current.add(action);
      invalidate();
    };
    const handleKeyUp = (event: KeyboardEvent): void => {
      const action = fieldCameraActionForCode(event.code);
      if (action) pressedActions.current.delete(action);
    };
    const stopMovement = (): void => pressedActions.current.clear();

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', stopMovement);
    return () => {
      pressedActions.current.clear();
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', stopMovement);
    };
  }, [active, invalidate]);

  useFrame((_state, delta) => {
    if (!active || pressedActions.current.size === 0 || !controlsRef.current) return;

    sceneCamera.getWorldDirection(forward);
    right.set(1, 0, 0).applyQuaternion(sceneCamera.quaternion);
    movement.set(0, 0, 0);

    if (pressedActions.current.has('forward')) movement.add(forward);
    if (pressedActions.current.has('back')) movement.sub(forward);
    if (pressedActions.current.has('right')) movement.add(right);
    if (pressedActions.current.has('left')) movement.sub(right);
    if (pressedActions.current.has('up')) movement.add(vertical);
    if (pressedActions.current.has('down')) movement.sub(vertical);

    if (movement.lengthSq() === 0) return;
    movement.normalize().multiplyScalar(CAMERA_FLIGHT_SPEED_MPS * Math.min(delta, 0.1));
    sceneCamera.position.add(movement);
    controlsRef.current.target.add(movement);
    controlsRef.current.update();
    invalidate();
  });

  return (
    <OrbitControls
      key={mode}
      ref={controlsRef}
      makeDefault
      target={[
        modeWorldX(mode === '3v3' ? cameraState.targetXM : FIELD_SPECS[mode].size.lengthM / 2, mode),
        0,
        modeWorldZ(mode === '3v3' ? cameraState.targetYM : FIELD_SPECS[mode].size.widthM / 2, mode),
      ]}
      minDistance={mode === '1v1' || mode === 'sentry' ? 3 : 4.5}
      maxDistance={mode === 'drone' ? 150 : 40}
      maxPolarAngle={Math.PI / 2.05}
      enableDamping
      regress
      dampingFactor={0.08}
    />
  );
}

function FieldPerspectiveCamera({ camera, mode }: Pick<FieldProps, 'camera' | 'mode'>) {
  const aspect = useThree((state) => state.size.width / state.size.height);
  const targetXM = mode === '3v3' ? camera.targetXM : FIELD_SPECS[mode].size.lengthM / 2;
  const targetYM = mode === '3v3' ? camera.targetYM : FIELD_SPECS[mode].size.widthM / 2;
  const distance = fieldCameraDistance(mode, aspect) / Math.max(0.7, camera.zoom);
  const direction = fieldCameraDirection(mode);
  const directionLength = Math.hypot(...direction);
  return <PerspectiveCamera makeDefault fov={43} near={0.05} far={250} position={[
    modeWorldX(targetXM, mode) + distance * direction[0] / directionLength, distance * direction[1] / directionLength,
    modeWorldZ(targetYM, mode) + distance * direction[2] / directionLength,
  ]} />;
}

export const Field = memo(function Field({ active, robot, robots, camera, mode, modelForRobot, overlays }: FieldProps) {
  return (
    <div className="field-stage">
      <Canvas
        key={mode}
        shadows
        frameloop="demand"
        dpr={[1, 1.5]}
        performance={{ min: 0.7, debounce: 250 }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
        }}
      >
        <color attach="background" args={["#0b0f15"]} />
        <fog attach="fog" args={["#0b0f15", mode === 'drone' ? 90 : 35, mode === 'drone' ? 180 : 75]} />
        <FieldPerspectiveCamera camera={camera} mode={mode} />
        <FieldArena mode={mode} />
        {robots.map((fieldRobot) => (
          <Robot key={fieldRobot.robotId} robot={fieldRobot} model={modelForRobot(fieldRobot.robotId)} mode={mode} />
        ))}
        <FieldOverlays overlays={overlays} mode={mode} />
        <AdaptiveReplayQuality robot={robot} />
        <FieldCameraFlightControls active={active} camera={camera} mode={mode} />
      </Canvas>
    </div>
  );
}, (previous, next) => !previous.active && !next.active);
