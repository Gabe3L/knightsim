import {
  AdaptiveDpr,
  Box,
  Center,
  Html,
  Line,
  OrbitControls,
  PerspectiveCamera,
  useGLTF,
} from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Crosshair } from "lucide-react";
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
import {
  BufferGeometry,
  CanvasTexture,
  DoubleSide,
  Float32BufferAttribute,
  SRGBColorSpace,
  Vector3,
} from "three";
import { ARCC_2026_1V1_FIELD, ARCC_2026_FIELD, teamColor } from "../field/fieldSpec";
import { fieldCameraActionForCode, type FieldCameraAction } from "../keybindings";
import { configureDracoLoader } from "../loaders/draco";
import { prepareRobotModel } from "../loaders/prepareRobotModel";
import type { ResolvedFieldOverlay } from "../overlays/fieldOverlays";
import { robotRenderProfile } from "../telemetry/robotCategories";
import type { CameraState, FieldMode, RobotModelRecord, RobotTelemetry } from "../types";

interface FieldProps {
  readonly active: boolean;
  readonly robot: RobotTelemetry;
  readonly camera: CameraState;
  readonly mode: FieldMode;
  readonly model: RobotModelRecord | null;
  readonly overlays: readonly ResolvedFieldOverlay[];
}

// The default camera looks from the near marker box toward the far ramps.
// Mirror field x into Three's world x so screen-left remains the red/low-x
// side and screen-right remains the blue/high-x side from that viewpoint.
const worldX = (xM: number): number => 6 - xM;
const worldZ = (yM: number): number => yM - 4;
const modeWorldX = (xM: number, mode: FieldMode): number => (mode === '1v1' ? 2.5 : 6) - xM;
const modeWorldZ = (yM: number, mode: FieldMode): number => yM - (mode === '1v1' ? 2.5 : 4);

const fieldWoodColor = "#424242";
const fieldFloorColor = "#7a7a7a";
const fieldSheetColor = "#111318";
const fieldLightBumpColor = "#5d5f61";
const fieldDarkBumpColor = "#4d5054";

function PerimeterWall({
  position,
  args,
}: {
  readonly position: [number, number, number];
  readonly args: [number, number, number];
}) {
  return (
    <Box args={args} position={position} castShadow receiveShadow>
      <meshStandardMaterial
        color={fieldWoodColor}
        roughness={0.92}
        metalness={0}
      />
    </Box>
  );
}

function ZoneOutline({
  zone,
}: {
  readonly zone: (typeof ARCC_2026_FIELD.zones)[number];
}) {
  const tapeWidthM = ARCC_2026_FIELD.zoneTapeWidthM;
  const innerDepthM = zone.depthM - 2 * tapeWidthM;
  const color = teamColor(zone.team);

  return (
    <group>
      {[zone.yM + tapeWidthM / 2, zone.yM + zone.depthM - tapeWidthM / 2].map(
        (yM) => (
          <mesh
            key={`horizontal-${yM}`}
            position={[worldX(zone.xM + zone.widthM / 2), 0.006, worldZ(yM)]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <planeGeometry args={[zone.widthM, tapeWidthM]} />
            <meshStandardMaterial color={color} roughness={0.9} />
          </mesh>
        ),
      )}
      {[zone.xM + tapeWidthM / 2, zone.xM + zone.widthM - tapeWidthM / 2].map(
        (xM) => (
          <mesh
            key={`vertical-${xM}`}
            position={[worldX(xM), 0.006, worldZ(zone.yM + zone.depthM / 2)]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <planeGeometry args={[tapeWidthM, innerDepthM]} />
            <meshStandardMaterial color={color} roughness={0.9} />
          </mesh>
        ),
      )}
    </group>
  );
}

function MarkerFace({
  marker,
}: {
  readonly marker: (typeof ARCC_2026_FIELD.markers)[number];
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext("2d");
    if (context) {
      context.fillStyle = "#05070a";
      context.fillRect(0, 0, 256, 256);
      context.strokeStyle = "#ffffff";
      context.lineWidth = 16;
      context.strokeRect(8, 8, 240, 240);
      context.fillStyle = "#ffffff";
      context.font = "700 132px Arial, sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(String(marker.id), 128, 136);
    }
    const next = new CanvasTexture(canvas);
    next.colorSpace = SRGBColorSpace;
    return next;
  }, [marker.id]);

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <mesh
      position={[worldX(marker.xM), marker.zM, worldZ(marker.yM)]}
      rotation={[0, (marker.facingDeg * Math.PI) / 180, 0]}
    >
      <planeGeometry args={[marker.sideM, marker.sideM]} />
      <meshBasicMaterial map={texture} side={DoubleSide} toneMapped={false} />
    </mesh>
  );
}

function Ramp({
  xM,
  yM,
  widthM,
  depthM,
  heightM,
  ascending,
}: {
  readonly xM: number;
  readonly yM: number;
  readonly widthM: number;
  readonly depthM: number;
  readonly heightM: number;
  readonly ascending: boolean;
}) {
  const geometry = useMemo(() => {
    const leftHeight = ascending ? 0 : heightM;
    const rightHeight = ascending ? heightM : 0;
    const vertices = new Float32Array([
      0,
      0,
      0,
      widthM,
      0,
      0,
      widthM,
      rightHeight,
      0,
      0,
      leftHeight,
      0,
      0,
      0,
      depthM,
      widthM,
      0,
      depthM,
      widthM,
      rightHeight,
      depthM,
      0,
      leftHeight,
      depthM,
    ]);
    // Leave the hidden bottom open so it cannot z-fight with the arena floor.
    const indices = [
      0, 2, 1, 0, 3, 2, 4, 6, 7, 4, 5, 6, 3, 6, 2, 3, 7, 6, 0, 7, 3, 0, 4, 7, 1,
      6, 5, 1, 2, 6,
    ];
    const next = new BufferGeometry();
    next.setAttribute("position", new Float32BufferAttribute(vertices, 3));
    next.setIndex(indices);
    next.addGroup(0, 12, 1);
    next.addGroup(12, 6, 0);
    next.addGroup(18, 12, 1);
    next.computeVertexNormals();
    return next;
  }, [ascending, depthM, heightM, widthM]);

  const edgePoints = useMemo<readonly [number, number, number][]>(() => {
    const leftHeight = ascending ? 0 : heightM;
    const rightHeight = ascending ? heightM : 0;
    const highX = ascending ? widthM : 0;

    return [
      // Floor perimeter.
      [0, 0, 0],
      [widthM, 0, 0],
      [0, 0, depthM],
      [widthM, 0, depthM],
      [0, 0, 0],
      [0, 0, depthM],
      [widthM, 0, 0],
      [widthM, 0, depthM],
      // The two exposed sides of the sloped surface.
      [0, leftHeight, 0],
      [widthM, rightHeight, 0],
      [0, leftHeight, depthM],
      [widthM, rightHeight, depthM],
      // Uprights on the tall end. The top edge across the ramp is omitted:
      // it meets the adjacent deck at the same elevation and should not read
      // as a seam between the two surfaces.
      [highX, 0, 0],
      [highX, heightM, 0],
      [highX, 0, depthM],
      [highX, heightM, depthM],
    ];
  }, [ascending, depthM, heightM, widthM]);

  return (
    <mesh
      geometry={geometry}
      position={[worldX(xM), 0, worldZ(yM)]}
      scale={[-1, 1, 1]}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial
        attach="material-0"
        color={fieldFloorColor}
        roughness={0.88}
      />
      <meshStandardMaterial
        attach="material-1"
        color={fieldWoodColor}
        roughness={0.92}
        metalness={0}
      />
      <Line
        points={edgePoints}
        segments
        color="#090a0c"
        lineWidth={4}
        scale={1.002}
      />
    </mesh>
  );
}

function HighGroundDeck({
  xM,
  yM,
  widthM,
  depthM,
  heightM,
}: {
  readonly xM: number;
  readonly yM: number;
  readonly widthM: number;
  readonly depthM: number;
  readonly heightM: number;
}) {
  return (
    <Box
      args={[widthM, heightM, depthM]}
      position={[worldX(xM + widthM / 2), heightM / 2, worldZ(yM + depthM / 2)]}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial
        attach="material-0"
        color={fieldWoodColor}
        roughness={0.92}
        metalness={0}
      />
      <meshStandardMaterial
        attach="material-1"
        color={fieldWoodColor}
        roughness={0.92}
        metalness={0}
      />
      <meshStandardMaterial
        attach="material-2"
        color={fieldFloorColor}
        roughness={0.88}
      />
      <meshStandardMaterial
        attach="material-3"
        color={fieldWoodColor}
        roughness={0.92}
        metalness={0}
      />
      <meshStandardMaterial
        attach="material-4"
        color={fieldWoodColor}
        roughness={0.92}
        metalness={0}
      />
      <meshStandardMaterial
        attach="material-5"
        color={fieldWoodColor}
        roughness={0.92}
        metalness={0}
      />
    </Box>
  );
}

function PlaceholderRobot({ category }: Pick<RobotTelemetry, "category">) {
  const profile = robotRenderProfile(category);
  return (
    <>
      <Box args={[0.52, 0.18, 0.46]} position={[0, 0.125, 0]} castShadow>
        <meshStandardMaterial
          color={profile.body}
          roughness={0.42}
          metalness={0.55}
        />
      </Box>
      <Box args={[0.3, 0.24, 0.3]} position={[0, 0.315, 0]} castShadow>
        <meshStandardMaterial
          color="#202936"
          roughness={0.34}
          metalness={0.68}
        />
      </Box>
      <mesh position={[0.34, 0.145, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.09, 0.22, 4]} />
        <meshStandardMaterial
          color="#fff"
          emissive={profile.emissive}
          emissiveIntensity={1.5}
        />
      </mesh>
      {(
        [
          [-0.19, -0.19],
          [-0.19, 0.19],
          [0.19, -0.19],
          [0.19, 0.19],
        ] as const
      ).map(([x, z], index) => (
        <mesh
          key={index}
          position={[x, 0.035, z]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[0.07, 0.07, 0.08, 14]} />
          <meshStandardMaterial color="#090b0f" roughness={0.8} />
        </mesh>
      ))}
    </>
  );
}

interface ModelErrorBoundaryProps {
  readonly cacheKey: string;
  readonly category: RobotTelemetry['category'];
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
    return this.state.failed ? <PlaceholderRobot category={this.props.category} /> : this.props.children;
  }
}

const UploadedRobot = memo(function UploadedRobot({
  model,
}: {
  readonly model: RobotModelRecord;
}) {
  const url = window.knightSim?.robotModels.urlFor(model.id) ?? "";
  const { scene } = useGLTF(url, false, true, configureDracoLoader);
  const prepared = useMemo(() => prepareRobotModel(scene), [scene]);
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
        <primitive object={prepared.object} />
      </group>
    </Center>
  );
});

function Robot({ robot, model, mode }: Pick<FieldProps, "robot" | "model" | "mode">) {
  return (
    <group
      name={`robot:${robot.category}`}
      position={[modeWorldX(robot.xM, mode), 0.035, modeWorldZ(robot.yM, mode)]}
      rotation={[0, (robot.yawDeg * Math.PI) / 180, 0]}
      scale={[-1, 1, 1]}
    >
      {model && window.knightSim?.robotModels ? (
        <ModelErrorBoundary cacheKey={model.id} category={robot.category}>
          <Suspense fallback={<PlaceholderRobot category={robot.category} />}>
            <UploadedRobot model={model} />
          </Suspense>
        </ModelErrorBoundary>
      ) : (
        <PlaceholderRobot category={robot.category} />
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

const Arena = memo(function Arena() {
  return (
    <>
      <ambientLight intensity={1.25} />
      <directionalLight
        position={[-3, 12, 6]}
        intensity={2.7}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <hemisphereLight args={["#b7d4ff", "#15181d", 0.8]} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[12, 8]} />
        <meshStandardMaterial color={fieldFloorColor} roughness={0.95} />
      </mesh>

      {ARCC_2026_FIELD.zones.map((zone) => (
        <ZoneOutline key={zone.id} zone={zone} />
      ))}

      {ARCC_2026_FIELD.highGround.lowerDecks.map((deck, index) => (
        <HighGroundDeck
          key={`lower-${index}`}
          xM={deck.xM}
          yM={deck.yM}
          widthM={deck.widthM}
          depthM={deck.depthM}
          heightM={ARCC_2026_FIELD.highGround.lowerHeightM}
        />
      ))}
      <Ramp
        xM={ARCC_2026_FIELD.highGround.footprint[0]!.xM}
        yM={6}
        widthM={ARCC_2026_FIELD.highGround.approachRunM}
        depthM={2}
        heightM={ARCC_2026_FIELD.highGround.lowerHeightM}
        ascending
      />
      <Ramp
        xM={9}
        yM={6}
        widthM={ARCC_2026_FIELD.highGround.approachRunM}
        depthM={2}
        heightM={ARCC_2026_FIELD.highGround.lowerHeightM}
        ascending={false}
      />
      {ARCC_2026_FIELD.highGround.innerRamps.map((ramp, index) => (
        <Ramp
          key={`inner-ramp-${index}`}
          xM={ramp.xM}
          yM={ramp.yM}
          widthM={ramp.widthM}
          depthM={ramp.depthM}
          heightM={ARCC_2026_FIELD.highGround.lowerHeightM}
          ascending={ramp.ascending}
        />
      ))}
      <Box
        args={[
          ARCC_2026_FIELD.highGround.centerBarrier.widthM,
          ARCC_2026_FIELD.highGround.centerBarrier.heightM,
          ARCC_2026_FIELD.highGround.centerBarrier.depthM,
        ]}
        position={[
          worldX(
            ARCC_2026_FIELD.highGround.centerBarrier.xM +
              ARCC_2026_FIELD.highGround.centerBarrier.widthM / 2,
          ),
          ARCC_2026_FIELD.highGround.centerBarrier.heightM / 2,
          worldZ(
            ARCC_2026_FIELD.highGround.centerBarrier.yM +
              ARCC_2026_FIELD.highGround.centerBarrier.depthM / 2,
          ),
        ]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color={fieldWoodColor}
          roughness={0.92}
          metalness={0}
        />
      </Box>

      <Box
        args={[
          ARCC_2026_FIELD.centralPlatform.widthM,
          ARCC_2026_FIELD.centralPlatform.heightM,
          ARCC_2026_FIELD.centralPlatform.depthM,
        ]}
        position={[
          worldX(
            ARCC_2026_FIELD.centralPlatform.xM +
              ARCC_2026_FIELD.centralPlatform.widthM / 2,
          ),
          ARCC_2026_FIELD.centralPlatform.heightM / 2,
          worldZ(
            ARCC_2026_FIELD.centralPlatform.yM +
              ARCC_2026_FIELD.centralPlatform.depthM / 2,
          ),
        ]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color={fieldWoodColor}
          roughness={0.92}
          metalness={0}
        />
      </Box>

      {ARCC_2026_FIELD.bumpyRoad.tiles.map((tile) => (
        <Box
          key={tile.id}
          args={[
            tile.widthM,
            ARCC_2026_FIELD.bumpyRoad.bumpHeightM,
            tile.depthM,
          ]}
          position={[
            worldX(tile.xM + tile.widthM / 2),
            ARCC_2026_FIELD.bumpyRoad.bumpHeightM / 2,
            worldZ(tile.yM + tile.depthM / 2),
          ]}
          receiveShadow
        >
          <meshStandardMaterial
            color={
              tile.rotationDeg === 0 ? fieldDarkBumpColor : fieldLightBumpColor
            }
            roughness={1}
          />
        </Box>
      ))}

      {ARCC_2026_FIELD.barriers.map((barrier) => {
        const dx = worldX(barrier.end.xM) - worldX(barrier.start.xM);
        const dy = worldZ(barrier.end.yM) - worldZ(barrier.start.yM);
        const length = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx);
        const woodHeightM = Math.min(
          barrier.heightM,
          ARCC_2026_FIELD.barrierConstruction.woodHeightM,
        );
        const sheetHeightM = Math.max(0, barrier.heightM - woodHeightM);
        return (
          <group
            key={barrier.id}
            position={[
              worldX((barrier.start.xM + barrier.end.xM) / 2),
              0,
              worldZ((barrier.start.yM + barrier.end.yM) / 2),
            ]}
            rotation={[0, -angle, 0]}
          >
            <Box
              args={[length, woodHeightM, barrier.thicknessM]}
              position={[0, woodHeightM / 2, 0]}
              castShadow
              receiveShadow
            >
              <meshStandardMaterial
                color={fieldWoodColor}
                roughness={0.92}
                metalness={0}
              />
            </Box>
            {sheetHeightM > 0 && (
              <Box
                args={[
                  length,
                  sheetHeightM,
                  ARCC_2026_FIELD.barrierConstruction.sheetThicknessM,
                ]}
                position={[0, woodHeightM + sheetHeightM / 2, 0]}
                castShadow
                receiveShadow
              >
                <meshStandardMaterial
                  color={fieldSheetColor}
                  roughness={0.78}
                  metalness={0.04}
                />
              </Box>
            )}
          </group>
        );
      })}

      {ARCC_2026_FIELD.markers.map((marker) => (
        <MarkerFace key={marker.id} marker={marker} />
      ))}

      <PerimeterWall
        position={[
          0,
          ARCC_2026_FIELD.wall.heightM / 2,
          -4 - ARCC_2026_FIELD.wall.thicknessM / 2,
        ]}
        args={[
          12 + 2 * ARCC_2026_FIELD.wall.thicknessM,
          ARCC_2026_FIELD.wall.heightM,
          ARCC_2026_FIELD.wall.thicknessM,
        ]}
      />
      <PerimeterWall
        position={[
          0,
          ARCC_2026_FIELD.wall.heightM / 2,
          4 + ARCC_2026_FIELD.wall.thicknessM / 2,
        ]}
        args={[
          12 + 2 * ARCC_2026_FIELD.wall.thicknessM,
          ARCC_2026_FIELD.wall.heightM,
          ARCC_2026_FIELD.wall.thicknessM,
        ]}
      />
      <PerimeterWall
        position={[
          -6 - ARCC_2026_FIELD.wall.thicknessM / 2,
          ARCC_2026_FIELD.wall.heightM / 2,
          0,
        ]}
        args={[
          ARCC_2026_FIELD.wall.thicknessM,
          ARCC_2026_FIELD.wall.heightM,
          8,
        ]}
      />
      <PerimeterWall
        position={[
          6 + ARCC_2026_FIELD.wall.thicknessM / 2,
          ARCC_2026_FIELD.wall.heightM / 2,
          0,
        ]}
        args={[
          ARCC_2026_FIELD.wall.thicknessM,
          ARCC_2026_FIELD.wall.heightM,
          8,
        ]}
      />
    </>
  );
});

const OneVOneArena = memo(function OneVOneArena() {
  const { size, wall } = ARCC_2026_1V1_FIELD;
  const halfLength = size.lengthM / 2;
  const halfWidth = size.widthM / 2;

  return (
    <>
      <ambientLight intensity={1.25} />
      <directionalLight
        position={[-3, 10, 5]}
        intensity={2.7}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <hemisphereLight args={["#b7d4ff", "#15181d", 0.8]} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[size.lengthM, size.widthM]} />
        <meshStandardMaterial color={fieldFloorColor} roughness={0.95} />
      </mesh>

      {ARCC_2026_1V1_FIELD.zones.map((zone) => (
        <group key={zone.id}>
          <mesh
            position={[
              modeWorldX(zone.xM + zone.widthM / 2, '1v1'),
              0.006,
              modeWorldZ(zone.yM + zone.depthM / 2, '1v1'),
            ]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <planeGeometry args={[zone.widthM, zone.depthM]} />
            <meshStandardMaterial color={teamColor(zone.team)} transparent opacity={0.08} roughness={0.9} />
          </mesh>
          <Line
            points={[
              [modeWorldX(zone.xM, '1v1'), 0.012, modeWorldZ(zone.yM, '1v1')],
              [modeWorldX(zone.xM + zone.widthM, '1v1'), 0.012, modeWorldZ(zone.yM, '1v1')],
              [modeWorldX(zone.xM + zone.widthM, '1v1'), 0.012, modeWorldZ(zone.yM + zone.depthM, '1v1')],
              [modeWorldX(zone.xM, '1v1'), 0.012, modeWorldZ(zone.yM + zone.depthM, '1v1')],
              [modeWorldX(zone.xM, '1v1'), 0.012, modeWorldZ(zone.yM, '1v1')],
            ]}
            color={teamColor(zone.team)}
            lineWidth={2}
            transparent
            opacity={0.72}
          />
        </group>
      ))}

      {ARCC_2026_1V1_FIELD.bunkers.map((bunker) => (
        <Box
          key={bunker.id}
          args={[bunker.lengthM, bunker.heightM, bunker.depthM]}
          position={[
            modeWorldX(bunker.center.xM, '1v1'),
            bunker.heightM / 2,
            modeWorldZ(bunker.center.yM, '1v1'),
          ]}
          rotation={[0, -(bunker.rotationDeg * Math.PI) / 180, 0]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color={fieldWoodColor} roughness={0.92} metalness={0} />
        </Box>
      ))}

      <PerimeterWall
        position={[0, wall.heightM / 2, -halfWidth - wall.thicknessM / 2]}
        args={[size.lengthM + 2 * wall.thicknessM, wall.heightM, wall.thicknessM]}
      />
      <PerimeterWall
        position={[0, wall.heightM / 2, halfWidth + wall.thicknessM / 2]}
        args={[size.lengthM + 2 * wall.thicknessM, wall.heightM, wall.thicknessM]}
      />
      <PerimeterWall
        position={[-halfLength - wall.thicknessM / 2, wall.heightM / 2, 0]}
        args={[wall.thicknessM, wall.heightM, size.widthM]}
      />
      <PerimeterWall
        position={[halfLength + wall.thicknessM / 2, wall.heightM / 2, 0]}
        args={[wall.thicknessM, wall.heightM, size.widthM]}
      />
    </>
  );
});

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
        modeWorldX(mode === '1v1' ? 2.5 : cameraState.targetXM, mode),
        0,
        modeWorldZ(mode === '1v1' ? 2.5 : cameraState.targetYM, mode),
      ]}
      minDistance={mode === '1v1' ? 3 : 4.5}
      maxDistance={25}
      maxPolarAngle={Math.PI / 2.05}
      enableDamping
      regress
      dampingFactor={0.08}
    />
  );
}

export function Field({ active, robot, camera, mode, model, overlays }: FieldProps) {
  const distanceScale = 1 / Math.max(0.7, camera.zoom);
  const targetXM = mode === '1v1' ? 2.5 : camera.targetXM;
  const targetYM = mode === '1v1' ? 2.5 : camera.targetYM;
  const framingScale = mode === '1v1' ? 0.72 : 1;
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
        <fog attach="fog" args={["#0b0f15", 14, 26]} />
        <PerspectiveCamera
          makeDefault
          fov={43}
          near={0.05}
          far={100}
          position={[
            modeWorldX(targetXM, mode),
            8.4 * distanceScale * framingScale,
            modeWorldZ(targetYM, mode) - 8.8 * distanceScale * framingScale,
          ]}
        />
        {mode === '1v1' ? <OneVOneArena /> : <Arena />}
        <Robot robot={robot} model={model} mode={mode} />
        <FieldOverlays overlays={overlays} mode={mode} />
        <AdaptiveReplayQuality robot={robot} />
        <FieldCameraFlightControls active={active} camera={camera} mode={mode} />
      </Canvas>
    </div>
  );
}
