import { Box, OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { Canvas, type ThreeEvent } from '@react-three/fiber';
import { Crosshair, MousePointer2 } from 'lucide-react';
import { useMemo } from 'react';
import { BufferGeometry, DoubleSide, Float32BufferAttribute } from 'three';
import { ARCC_2026_FIELD, teamColor } from '../field/fieldSpec';
import type { CameraState, RobotTelemetry } from '../types';

interface Field3DProps {
  readonly robot: RobotTelemetry;
  readonly camera: CameraState;
  readonly onRobotMove: (pose: Pick<RobotTelemetry, 'xM' | 'yM' | 'yawDeg'>) => void;
}

const worldX = (xM: number): number => xM - 6;
const worldZ = (yM: number): number => yM - 4;

function Wall({ position, rotation, width }: { readonly position: [number, number, number]; readonly rotation: [number, number, number]; readonly width: number }) {
  return (
    <mesh position={position} rotation={rotation} receiveShadow>
      <planeGeometry args={[width, ARCC_2026_FIELD.wall.heightM]} />
      <meshStandardMaterial color="#545e6b" roughness={0.76} metalness={0.18} side={DoubleSide} />
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

function Arena({ robot, onRobotMove }: Pick<Field3DProps, 'robot' | 'onRobotMove'>) {
  const moveOnField = (event: ThreeEvent<PointerEvent>): void => {
    event.stopPropagation();
    onRobotMove({
      xM: Math.max(0.25, Math.min(11.75, event.point.x + 6)),
      yM: Math.max(0.25, Math.min(7.75, event.point.z + 4)),
      yawDeg: robot.yawDeg,
    });
  };

  return (
    <>
      <ambientLight intensity={1.25} />
      <directionalLight position={[-3, 12, 6]} intensity={2.7} castShadow shadow-mapSize={[2048, 2048]} />
      <hemisphereLight args={['#b7d4ff', '#15181d', 0.8]} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow onPointerDown={moveOnField}>
        <planeGeometry args={[12, 8]} />
        <meshStandardMaterial color="#151a22" roughness={0.95} />
      </mesh>
      <gridHelper args={[12, 24, '#354050', '#252d38']} position={[0, 0.002, 0]} />

      {ARCC_2026_FIELD.zones.map((zone) => (
        <mesh
          key={zone.id}
          position={[worldX(zone.xM + zone.widthM / 2), 0.006, worldZ(zone.yM + zone.depthM / 2)]}
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
          onPointerDown={moveOnField}
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

      {ARCC_2026_FIELD.bumpyRoad.tiles.map((tile) => (
        <Box
          key={tile.id}
          args={[tile.widthM - 0.012, ARCC_2026_FIELD.bumpyRoad.bumpHeightM, tile.depthM - 0.012]}
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
          <mesh
            key={barrier.id}
            position={[
              worldX((barrier.start.xM + barrier.end.xM) / 2),
              barrier.heightM / 2,
              worldZ((barrier.start.yM + barrier.end.yM) / 2),
            ]}
            rotation={[0, -angle, 0]}
            castShadow
          >
            <planeGeometry args={[length, barrier.heightM]} />
            <meshStandardMaterial color={teamColor(barrier.team)} roughness={0.64} metalness={0.24} side={DoubleSide} />
          </mesh>
        );
      })}

      {ARCC_2026_FIELD.markers.map((marker) => (
        <mesh
          key={marker.id}
          position={[worldX(marker.xM), marker.zM, worldZ(marker.yM)]}
          rotation={[0, (-marker.facingDeg * Math.PI) / 180, 0]}
        >
          <planeGeometry args={[marker.sideM, marker.sideM]} />
          <meshBasicMaterial color="#f5f7fa" side={DoubleSide} />
        </mesh>
      ))}

      <Wall position={[0, ARCC_2026_FIELD.wall.heightM / 2, -4]} rotation={[0, 0, 0]} width={12} />
      <Wall position={[0, ARCC_2026_FIELD.wall.heightM / 2, 4]} rotation={[0, Math.PI, 0]} width={12} />
      <Wall position={[-6, ARCC_2026_FIELD.wall.heightM / 2, 0]} rotation={[0, Math.PI / 2, 0]} width={8} />
      <Wall position={[6, ARCC_2026_FIELD.wall.heightM / 2, 0]} rotation={[0, -Math.PI / 2, 0]} width={8} />

      <group
        position={[worldX(robot.xM), 0.035, worldZ(robot.yM)]}
        rotation={[0, (-robot.yawDeg * Math.PI) / 180, 0]}
      >
        <Box args={[0.52, 0.18, 0.46]} position={[0, 0.16, 0]} castShadow>
          <meshStandardMaterial color="#e23b49" roughness={0.42} metalness={0.55} />
        </Box>
        <Box args={[0.3, 0.24, 0.3]} position={[0, 0.35, 0]} castShadow>
          <meshStandardMaterial color="#202936" roughness={0.34} metalness={0.68} />
        </Box>
        <mesh position={[0.34, 0.18, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <coneGeometry args={[0.09, 0.22, 4]} />
          <meshStandardMaterial color="#fff" emissive="#ff4655" emissiveIntensity={1.5} />
        </mesh>
        {([[-0.19, -0.19], [-0.19, 0.19], [0.19, -0.19], [0.19, 0.19]] as const).map(([x, z], index) => (
          <mesh key={index} position={[x, 0.07, z]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 0.08, 14]} />
            <meshStandardMaterial color="#090b0f" roughness={0.8} />
          </mesh>
        ))}
      </group>
    </>
  );
}

export function Field3D({ robot, camera, onRobotMove }: Field3DProps) {
  const distanceScale = 1 / Math.max(0.7, camera.zoom);
  return (
    <div className="field-stage field-stage-3d">
      <Canvas shadows dpr={[1, 1.75]} gl={{ antialias: true, alpha: false }}>
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
        <Arena robot={robot} onRobotMove={onRobotMove} />
        <OrbitControls
          makeDefault
          target={[worldX(camera.targetXM), 0, worldZ(camera.targetYM)]}
          minDistance={4.5}
          maxDistance={25}
          maxPolarAngle={Math.PI / 2.05}
          enableDamping
          dampingFactor={0.08}
        />
      </Canvas>
      <div className="field-overlay field-overlay-left">
        <span className="eyebrow">PERSPECTIVE CAMERA</span>
        <strong>ARCC 2026 · METRES</strong>
      </div>
      <div className="field-overlay field-overlay-center"><MousePointer2 size={13} /> Click floor to reposition</div>
      <div className="three-hint"><Crosshair size={13} /> Orbit · scroll to zoom · right-drag to pan</div>
    </div>
  );
}
