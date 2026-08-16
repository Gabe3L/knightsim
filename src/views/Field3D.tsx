import { AdaptiveDpr, Box, Center, OrbitControls, PerspectiveCamera, useGLTF } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { Crosshair } from 'lucide-react';
import { Component, memo, Suspense, useEffect, useMemo, type ErrorInfo, type ReactNode } from 'react';
import { BufferGeometry, CanvasTexture, DoubleSide, Float32BufferAttribute, SRGBColorSpace } from 'three';
import { ARCC_2026_FIELD, teamColor } from '../field/fieldSpec';
import { configureDracoLoader } from '../loaders/draco';
import { prepareRobotModel } from '../loaders/prepareRobotModel';
import type { CameraState, RobotModelRecord, RobotTelemetry } from '../types';

interface Field3DProps {
  readonly robot: RobotTelemetry;
  readonly camera: CameraState;
  readonly model: RobotModelRecord | null;
}

const worldX = (xM: number): number => xM - 6;
const worldZ = (yM: number): number => yM - 4;

function PerimeterWall({ position, args }: { readonly position: [number, number, number]; readonly args: [number, number, number] }) {
  return (
    <Box args={args} position={position} castShadow receiveShadow>
      <meshStandardMaterial color="#545e6b" roughness={0.76} metalness={0.18} />
    </Box>
  );
}

function MarkerFace({ marker }: { readonly marker: (typeof ARCC_2026_FIELD.markers)[number] }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext('2d');
    if (context) {
      context.fillStyle = '#05070a';
      context.fillRect(0, 0, 256, 256);
      context.strokeStyle = '#ffffff';
      context.lineWidth = 16;
      context.strokeRect(8, 8, 240, 240);
      context.fillStyle = '#ffffff';
      context.font = '700 132px Arial, sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
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
      rotation={[0, (-marker.facingDeg * Math.PI) / 180, 0]}
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
      0, 0, 0,
      widthM, 0, 0,
      widthM, rightHeight, 0,
      0, leftHeight, 0,
      0, 0, depthM,
      widthM, 0, depthM,
      widthM, rightHeight, depthM,
      0, leftHeight, depthM,
    ]);
    const indices = [
      0, 1, 2, 0, 2, 3,
      4, 7, 6, 4, 6, 5,
      0, 4, 5, 0, 5, 1,
      3, 2, 6, 3, 6, 7,
      0, 3, 7, 0, 7, 4,
      1, 5, 6, 1, 6, 2,
    ];
    const next = new BufferGeometry();
    next.setAttribute('position', new Float32BufferAttribute(vertices, 3));
    next.setIndex(indices);
    next.computeVertexNormals();
    return next;
  }, [ascending, depthM, heightM, widthM]);

  return (
    <mesh geometry={geometry} position={[worldX(xM), 0, worldZ(yM)]} castShadow receiveShadow>
      <meshStandardMaterial color="#65707e" roughness={0.8} />
    </mesh>
  );
}

function PlaceholderRobot() {
  return (
    <>
      <Box args={[0.52, 0.18, 0.46]} position={[0, 0.125, 0]} castShadow>
        <meshStandardMaterial color="#e23b49" roughness={0.42} metalness={0.55} />
      </Box>
      <Box args={[0.3, 0.24, 0.3]} position={[0, 0.315, 0]} castShadow>
        <meshStandardMaterial color="#202936" roughness={0.34} metalness={0.68} />
      </Box>
      <mesh position={[0.34, 0.145, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.09, 0.22, 4]} />
        <meshStandardMaterial color="#fff" emissive="#ff4655" emissiveIntensity={1.5} />
      </mesh>
      {([[-0.19, -0.19], [-0.19, 0.19], [0.19, -0.19], [0.19, 0.19]] as const).map(([x, z], index) => (
        <mesh key={index} position={[x, 0.035, z]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.07, 0.07, 0.08, 14]} />
          <meshStandardMaterial color="#090b0f" roughness={0.8} />
        </mesh>
      ))}
    </>
  );
}

interface ModelErrorBoundaryProps {
  readonly cacheKey: string;
  readonly children: ReactNode;
}

interface ModelErrorBoundaryState {
  readonly failed: boolean;
}

class ModelErrorBoundary extends Component<ModelErrorBoundaryProps, ModelErrorBoundaryState> {
  override state: ModelErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ModelErrorBoundaryState {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unable to render the selected robot model:', error, info);
  }

  override componentDidUpdate(previous: ModelErrorBoundaryProps): void {
    if (this.state.failed && previous.cacheKey !== this.props.cacheKey) this.setState({ failed: false });
  }

  override render(): ReactNode {
    return this.state.failed ? <PlaceholderRobot /> : this.props.children;
  }
}

const UploadedRobot = memo(function UploadedRobot({ model }: { readonly model: RobotModelRecord }) {
  const url = window.knightSim?.robotModels.urlFor(model.id) ?? '';
  const { scene } = useGLTF(url, false, true, configureDracoLoader);
  const prepared = useMemo(() => prepareRobotModel(scene), [scene]);
  const { rotationDeg, flipped } = model.orientation;
  const orientationKey = [
    rotationDeg.x,
    rotationDeg.y,
    rotationDeg.z,
    flipped.x,
    flipped.y,
    flipped.z,
  ].join(':');

  return (
    <Center top precise={false} cacheKey={orientationKey}>
      <group
        rotation={[
          (rotationDeg.x * Math.PI) / 180,
          (rotationDeg.y * Math.PI) / 180,
          (rotationDeg.z * Math.PI) / 180,
        ]}
        scale={[flipped.x ? -1 : 1, flipped.y ? -1 : 1, flipped.z ? -1 : 1]}
      >
        <primitive object={prepared.object} />
      </group>
    </Center>
  );
});

function Robot({ robot, model }: Pick<Field3DProps, 'robot' | 'model'>) {
  return (
    <group
      position={[worldX(robot.xM), 0.035, worldZ(robot.yM)]}
      rotation={[0, (-robot.yawDeg * Math.PI) / 180, 0]}
    >
      {model && window.knightSim?.robotModels ? (
        <ModelErrorBoundary cacheKey={model.id}>
          <Suspense fallback={<PlaceholderRobot />}>
            <UploadedRobot model={model} />
          </Suspense>
        </ModelErrorBoundary>
      ) : <PlaceholderRobot />}
    </group>
  );
}

const Arena = memo(function Arena() {
  return (
    <>
      <ambientLight intensity={1.25} />
      <directionalLight position={[-3, 12, 6]} intensity={2.7} castShadow shadow-mapSize={[1024, 1024]} />
      <hemisphereLight args={['#b7d4ff', '#15181d', 0.8]} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[12, 8]} />
        <meshStandardMaterial color="#151a22" roughness={0.95} />
      </mesh>

      {ARCC_2026_FIELD.zones.map((zone) => (
        <mesh
          key={zone.id}
          position={[worldX(zone.xM + zone.widthM / 2), 0.006, worldZ(zone.yM + zone.depthM / 2)]}
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
        >
          <planeGeometry args={[zone.widthM, zone.depthM]} />
          <meshStandardMaterial color={teamColor(zone.team)} transparent opacity={zone.kind === 'capture' ? 0.48 : 0.22} roughness={0.8} />
        </mesh>
      ))}

      {ARCC_2026_FIELD.highGround.lowerDecks.map((deck, index) => (
        <Box
          key={`lower-${index}`}
          args={[deck.widthM, ARCC_2026_FIELD.highGround.lowerHeightM, deck.depthM]}
          position={[
            worldX(deck.xM + deck.widthM / 2),
            ARCC_2026_FIELD.highGround.lowerHeightM / 2,
            worldZ(deck.yM + deck.depthM / 2),
          ]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color="#727c89" roughness={0.78} />
        </Box>
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
          ARCC_2026_FIELD.highGround.upperDeck.widthM,
          ARCC_2026_FIELD.highGround.upperHeightM,
          ARCC_2026_FIELD.highGround.upperDeck.depthM,
        ]}
        position={[
          worldX(6),
          ARCC_2026_FIELD.highGround.upperHeightM / 2,
          worldZ(7.5),
        ]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color="#9ca6b2" roughness={0.72} />
      </Box>

      <Box
        args={[
          ARCC_2026_FIELD.centralPlatform.widthM,
          ARCC_2026_FIELD.centralPlatform.heightM,
          ARCC_2026_FIELD.centralPlatform.depthM,
        ]}
        position={[
          worldX(ARCC_2026_FIELD.centralPlatform.xM + ARCC_2026_FIELD.centralPlatform.widthM / 2),
          ARCC_2026_FIELD.centralPlatform.heightM / 2,
          worldZ(ARCC_2026_FIELD.centralPlatform.yM + ARCC_2026_FIELD.centralPlatform.depthM / 2),
        ]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color="#c3c9d1" roughness={0.72} />
      </Box>

      {ARCC_2026_FIELD.bumpyRoad.tiles.map((tile) => (
        <Box
          key={tile.id}
          args={[tile.widthM, ARCC_2026_FIELD.bumpyRoad.bumpHeightM, tile.depthM]}
          position={[
            worldX(tile.xM + tile.widthM / 2),
            ARCC_2026_FIELD.bumpyRoad.bumpHeightM / 2,
            worldZ(tile.yM + tile.depthM / 2),
          ]}
          receiveShadow
        >
          <meshStandardMaterial color={tile.rotationDeg === 0 ? '#3f4854' : '#303842'} roughness={1} />
        </Box>
      ))}

      {ARCC_2026_FIELD.barriers.map((barrier) => {
        const dx = barrier.end.xM - barrier.start.xM;
        const dy = barrier.end.yM - barrier.start.yM;
        const length = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx);
        return (
          <Box
            key={barrier.id}
            args={[length, barrier.heightM, barrier.thicknessM]}
            position={[
              worldX((barrier.start.xM + barrier.end.xM) / 2),
              barrier.heightM / 2,
              worldZ((barrier.start.yM + barrier.end.yM) / 2),
            ]}
            rotation={[0, -angle, 0]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial color={teamColor(barrier.team)} roughness={0.64} metalness={0.24} />
          </Box>
        );
      })}

      {ARCC_2026_FIELD.markers.map((marker) => <MarkerFace key={marker.id} marker={marker} />)}

      <PerimeterWall
        position={[0, ARCC_2026_FIELD.wall.heightM / 2, -4 - ARCC_2026_FIELD.wall.thicknessM / 2]}
        args={[12 + 2 * ARCC_2026_FIELD.wall.thicknessM, ARCC_2026_FIELD.wall.heightM, ARCC_2026_FIELD.wall.thicknessM]}
      />
      <PerimeterWall
        position={[0, ARCC_2026_FIELD.wall.heightM / 2, 4 + ARCC_2026_FIELD.wall.thicknessM / 2]}
        args={[12 + 2 * ARCC_2026_FIELD.wall.thicknessM, ARCC_2026_FIELD.wall.heightM, ARCC_2026_FIELD.wall.thicknessM]}
      />
      <PerimeterWall
        position={[-6 - ARCC_2026_FIELD.wall.thicknessM / 2, ARCC_2026_FIELD.wall.heightM / 2, 0]}
        args={[ARCC_2026_FIELD.wall.thicknessM, ARCC_2026_FIELD.wall.heightM, 8]}
      />
      <PerimeterWall
        position={[6 + ARCC_2026_FIELD.wall.thicknessM / 2, ARCC_2026_FIELD.wall.heightM / 2, 0]}
        args={[ARCC_2026_FIELD.wall.thicknessM, ARCC_2026_FIELD.wall.heightM, 8]}
      />
    </>
  );
});

function AdaptiveReplayQuality({ robot }: Pick<Field3DProps, 'robot'>) {
  const regress = useThree((state) => state.performance.regress);
  const initialDpr = useThree((state) => state.viewport.initialDpr);

  useEffect(() => {
    regress();
  }, [regress, robot.xM, robot.yM, robot.yawDeg]);

  return initialDpr > 1 ? <AdaptiveDpr /> : null;
}

export function Field3D({ robot, camera, model }: Field3DProps) {
  const distanceScale = 1 / Math.max(0.7, camera.zoom);
  return (
    <div className="field-stage field-stage-3d">
      <Canvas
        shadows
        frameloop="demand"
        dpr={[1, 1.5]}
        performance={{ min: 0.7, debounce: 250 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      >
        <color attach="background" args={['#0b0f15']} />
        <fog attach="fog" args={['#0b0f15', 14, 26]} />
        <PerspectiveCamera
          makeDefault
          fov={43}
          near={0.05}
          far={100}
          position={[
            worldX(camera.targetXM) + 8.6 * distanceScale,
            8.4 * distanceScale,
            worldZ(camera.targetYM) + 8.8 * distanceScale,
          ]}
        />
        <Arena />
        <Robot robot={robot} model={model} />
        <AdaptiveReplayQuality robot={robot} />
        <OrbitControls
          makeDefault
          target={[worldX(camera.targetXM), 0, worldZ(camera.targetYM)]}
          minDistance={4.5}
          maxDistance={25}
          maxPolarAngle={Math.PI / 2.05}
          enableDamping
          regress
          dampingFactor={0.08}
        />
      </Canvas>
      <div className="field-overlay field-overlay-left">
        <span className="eyebrow">PERSPECTIVE CAMERA</span>
        <strong>ARCC 2026 · METRES</strong>
      </div>
      <div className="three-hint"><Crosshair size={13} /> Orbit · scroll to zoom · right-drag to pan</div>
    </div>
  );
}
