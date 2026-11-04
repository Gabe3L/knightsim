import { Center, useGLTF } from '@react-three/drei';
import { Component, memo, useEffect, useMemo, type ErrorInfo, type ReactNode } from 'react';
import { CanvasTexture, SRGBColorSpace } from 'three';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { configureDracoLoader } from '../loaders/draco';
import { prepareRobotModel } from '../loaders/prepareRobotModel';
import { robotProfile } from '../robots/profiles';
import type { RobotModelRecord, RobotTelemetry } from '../types';

export function PlaceholderRobot({ robotId }: Pick<RobotTelemetry, "robotId">) {
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
  readonly fallback?: ReactNode;
}

interface ModelErrorBoundaryState {
  readonly failed: boolean;
}

export class ModelErrorBoundary extends Component<
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
    return this.state.failed
      ? this.props.fallback ?? <PlaceholderRobot robotId={this.props.robotId} />
      : this.props.children;
  }
}

export const RobotModel = memo(function RobotModel({
  model,
}: {
  readonly model: RobotModelRecord;
}) {
  const url = window.knightSim?.robotModels.urlFor(model.id, model.revision) ?? "";
  const { scene, animations } = useGLTF(url, false, true, configureDracoLoader);
  const prepared = useMemo(() => prepareRobotModel(scene, animations.length > 0), [scene, animations]);
  // A cached template must never be attached to multiple scene parents.
  const object = useMemo(() => cloneSkeleton(prepared.object), [prepared]);
  const { rotationDeg, flipped, scale = 1 } = model.orientation;
  const orientationKey = [
    model.id,
    model.revision,
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

