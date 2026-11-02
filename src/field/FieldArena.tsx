import { memo, useEffect, useMemo } from 'react';
import {
  BoxGeometry, BufferGeometry, CatmullRomCurve3, DoubleSide, ExtrudeGeometry,
  Float32BufferAttribute, Shape, TubeGeometry, Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { FieldMode } from '../types';
import {
  ARCC_2027_3V3_FIELD as three, ARCC_2027_1V1_FIELD as one, ARCC_2027_DRONE_FIELD as drone,
  FIELD_SPECS, teamColor, type FieldZone, type Platform, type RampSpec, type RectM,
} from './fieldSpec';

const WOOD = '#ad8d60';
const SHEET = '#202122';
const FLOOR = '#797979';

function Block({ xM, yM, widthM, depthM, heightM, baseM = 0, color = WOOD }:
  RectM & { readonly heightM: number; readonly baseM?: number; readonly color?: string }) {
  return <mesh position={[xM + widthM / 2, baseM + heightM / 2, yM + depthM / 2]} castShadow receiveShadow>
    <boxGeometry args={[widthM, heightM, depthM]} />
    <meshStandardMaterial color={color} roughness={0.9} />
  </mesh>;
}

function Tape({ xM, yM, widthM, depthM, tapeWidthM, team, elevationM = 0.004 }:
  Omit<FieldZone, 'id'> & { readonly elevationM?: number }) {
  return <group>
    {[yM, yM + depthM - tapeWidthM].map((y) =>
      <Block key={`h-${y}`} xM={xM} yM={y} widthM={widthM} depthM={tapeWidthM}
        heightM={0.001} baseM={elevationM} color={teamColor(team)} />)}
    {[xM, xM + widthM - tapeWidthM].map((x) =>
      <Block key={`v-${x}`} xM={x} yM={yM + tapeWidthM} widthM={tapeWidthM} depthM={depthM - 2 * tapeWidthM}
        heightM={0.001} baseM={elevationM} color={teamColor(team)} />)}
  </group>;
}

// Wall local length is +x. Panels are inset in the wood frame on both faces.
function FramedWall({ lengthM, heightM, thicknessM, panelSides = [-1, 1] }: { readonly lengthM: number; readonly heightM: number; readonly thicknessM: number; readonly panelSides?: readonly number[] }) {
  const frame = 0.019;
  return <group>
    <mesh position={[0, heightM / 2, 0]} castShadow receiveShadow>
      <boxGeometry args={[lengthM, heightM, thicknessM]} />
      <meshStandardMaterial color={WOOD} roughness={0.95} />
    </mesh>
    {panelSides.map((side) => <mesh key={side} position={[0, heightM / 2, side * (thicknessM / 2 + 0.0005)]} receiveShadow>
      <boxGeometry args={[lengthM - 2 * frame, heightM - 2 * frame, 0.001]} />
      <meshStandardMaterial color={SHEET} roughness={0.9} />
    </mesh>)}
  </group>;
}

function Perimeter({ mode }: { readonly mode: '1v1' | '3v3' }) {
  const { size, wall } = FIELD_SPECS[mode];
  const t = wall.thicknessM;
  return <group name="perimeter">
    {[-t / 2, size.widthM + t / 2].map((y, index) => <group key={`h-${y}`} position={[size.lengthM / 2, 0, y]}>
      <FramedWall lengthM={size.lengthM + 2 * t} heightM={wall.heightM} thicknessM={t} panelSides={[index === 0 ? 1 : -1]} />
    </group>)}
    {[-t / 2, size.lengthM + t / 2].map((x, index) => <group key={`v-${x}`} position={[x, 0, size.widthM / 2]} rotation={[0, Math.PI / 2, 0]}>
      <FramedWall lengthM={size.widthM} heightM={wall.heightM} thicknessM={t} panelSides={[index === 0 ? 1 : -1]} />
    </group>)}
  </group>;
}

function Deck(deck: Platform) {
  // One-metre modules reproduce the seams of the plywood deck in the drawings.
  const columns = Math.round(deck.widthM);
  const rows = Math.round(deck.depthM);
  return <group name={deck.id}>
    {Array.from({ length: columns * rows }, (_, index) => {
      const x = deck.xM + index % columns;
      const y = deck.yM + Math.floor(index / columns);
      return <group key={index}>
        <Block xM={x} yM={y} widthM={1} depthM={1} heightM={deck.heightM - 0.004} />
        <Block xM={x + 0.001} yM={y + 0.001} widthM={0.998} depthM={0.998}
          heightM={0.004} baseM={deck.heightM - 0.004} color={FLOOR} />
      </group>;
    })}
  </group>;
}

function Ramp(ramp: RampSpec) {
  const geometry = useMemo(() => {
    const l = ramp.ascending ? 0 : ramp.heightM;
    const r = ramp.ascending ? ramp.heightM : 0;
    const w = ramp.widthM, d = ramp.depthM;
    const next = new BufferGeometry();
    next.setAttribute('position', new Float32BufferAttribute([
      0,0,0, w,0,0, w,r,0, 0,l,0, 0,0,d, w,0,d, w,r,d, 0,l,d,
    ], 3));
    next.setIndex([0,2,1, 0,3,2, 4,5,6, 4,6,7, 3,6,2, 3,7,6, 0,7,3, 0,4,7, 1,6,5, 1,2,6]);
    next.addGroup(0, 12, 0); next.addGroup(12, 6, 1); next.addGroup(18, 12, 0);
    next.computeVertexNormals();
    return next;
  }, [ramp.ascending, ramp.widthM, ramp.depthM, ramp.heightM]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh name={ramp.id} position={[ramp.xM, 0, ramp.yM]} geometry={geometry} castShadow receiveShadow>
    <meshStandardMaterial attach="material-0" color={WOOD} roughness={0.9} side={DoubleSide} />
    <meshStandardMaterial attach="material-1" color={FLOOR} roughness={0.9} side={DoubleSide} />
  </mesh>;
}

function BumpyRoad() {
  const road = three.bumpyRoad;
  const geometries = useMemo(() => {
    const bases: BufferGeometry[] = [], bumps: BufferGeometry[] = [];
    const radius = road.bumpWidthM / 2;
    const halfRun = road.bumpLengthM / 2 - radius;
    const shape = new Shape();
    shape.absarc(halfRun, 0, radius, -Math.PI / 2, Math.PI / 2, false);
    shape.absarc(-halfRun, 0, radius, Math.PI / 2, 3 * Math.PI / 2, false);
    shape.closePath();
    const bump = new ExtrudeGeometry(shape, { depth: road.bumpHeightM, bevelEnabled: false, curveSegments: 8 });
    bump.rotateX(-Math.PI / 2);
    for (const tile of road.tiles) {
      const cx = tile.xM + tile.widthM / 2, cy = tile.yM + tile.depthM / 2;
      bases.push(new BoxGeometry(tile.widthM, road.baseThicknessM, tile.depthM)
        .translate(cx, road.baseThicknessM / 2, cy));
      for (let i = 0; i < road.bumpCount; i++) {
        const offset = road.edgeMarginM + radius + i * (road.bumpWidthM + road.bumpGapM) - road.tileSizeM / 2;
        const part = bump.clone().translate(0, road.baseThicknessM, offset);
        if (tile.rotationDeg === 90) part.rotateY(Math.PI / 2);
        part.translate(cx, 0, cy);
        bumps.push(part);
      }
    }
    const merged = [mergeGeometries(bases), mergeGeometries(bumps)];
    [...bases, ...bumps, bump].forEach((part) => part.dispose());
    return merged;
  }, [road]);
  useEffect(() => () => geometries.forEach((geometry) => geometry.dispose()), [geometries]);
  return <group name="bumpy-road">
    {geometries.map((geometry, i) => <mesh key={i} geometry={geometry} receiveShadow>
      <meshStandardMaterial color={i ? '#464646' : '#242424'} roughness={1} />
    </mesh>)}
  </group>;
}

function LimboBars() {
  return <group name="limbo-bars">{three.limboBars.map((bar) => <group key={bar.id} name={bar.id}>
    <Block {...bar} heightM={bar.beamHeightM} baseM={bar.clearanceM} />
    {bar.id === 'central-limbo' ? <>
      {/* Beam overlaps the wall to the end of the tall sheet. */}
      <Block xM={bar.xM} yM={bar.yM - 0.2205} widthM={bar.widthM} depthM={0.2205}
        heightM={bar.beamHeightM} baseM={bar.clearanceM} />
      <Block xM={bar.xM} yM={6 - bar.beamHeightM} widthM={bar.widthM} depthM={bar.beamHeightM} heightM={bar.clearanceM} />
    </> : <>
      {/* Figure 3-13 has a second rail level with the 410 mm upper tier. */}
      <Block {...bar} depthM={1.3} heightM={bar.beamHeightM} baseM={0.41} />
      {[0.25, 0.75].map((y) => <Block key={y} xM={bar.xM} yM={y} widthM={bar.widthM}
        depthM={bar.beamHeightM} heightM={0.41 - bar.clearanceM - bar.beamHeightM} baseM={bar.clearanceM + bar.beamHeightM} />)}
    </>}
  </group>)}</group>;
}

function ScoringAreas() {
  const { chute } = three;
  const chuteGeometry = useMemo(() => {
    const face = new Shape();
    face.moveTo(-0.1, -0.1); face.lineTo(0.1, -0.1); face.lineTo(0.1, 0.1); face.lineTo(-0.1, 0.1); face.closePath();
    const hole = new Shape(); hole.absarc(0, 0, chute.openingDiameterM / 2, 0, Math.PI * 2, true);
    face.holes.push(hole);
    return new ExtrudeGeometry(face, { depth: 0.17, bevelEnabled: false, curveSegments: 32 });
  }, [chute]);
  useEffect(() => () => chuteGeometry.dispose(), [chuteGeometry]);
  return <group name="scoring-areas">
    {three.scoringAreas.map((area) => <group key={area.id} name={area.id}>
      <Block {...area} color={FLOOR} />
      <Tape {...area} xM={area.xM - three.scoringTapeWidthM} yM={area.yM - three.scoringTapeWidthM}
        widthM={area.widthM + 2 * three.scoringTapeWidthM} depthM={area.depthM + 2 * three.scoringTapeWidthM}
        tapeWidthM={three.scoringTapeWidthM} />
    </group>)}
    {three.pipeChutes.map((chute) => <mesh key={chute.id} name={chute.id}
      geometry={chuteGeometry} position={[chute.xM, chute.zM, chute.yM]} castShadow receiveShadow>
      <meshStandardMaterial color="#999c9f" metalness={0.55} roughness={0.5} />
    </mesh>)}
  </group>;
}

function Objectives() {
  const { cube, bucket, pipes, donuts, donut, pole } = three.objectives;
  const poleGeometry = useMemo(() => {
    // The manual explicitly leaves the zig-zag profile for a future release.
    const curve = new CatmullRomCurve3([
      new Vector3(0,0,0), new Vector3(0,0.07,0), new Vector3(0.065,0.135,0),
      new Vector3(0.035,0.2,0), new Vector3(-0.065,0.275,0), new Vector3(-0.045,0.34,0),
      new Vector3(0,0.41,0), new Vector3(0,pole.heightM,0),
    ]);
    return new TubeGeometry(curve, 48, 0.009, 8, false);
  }, [pole.heightM]);
  useEffect(() => () => poleGeometry.dispose(), [poleGeometry]);
  return <group name="objectives">
    <Block xM={cube.xM - cube.sideM / 2} yM={cube.yM - cube.sideM / 2}
      widthM={cube.sideM} depthM={cube.sideM} heightM={cube.sideM} baseM={cube.zM} color="#edc529" />
    <group position={[bucket.xM, 0, bucket.yM]} name="bucket-and-ten-pipes">
      <mesh position={[0, bucket.heightM / 2, 0]}>
        <cylinderGeometry args={[bucket.diameterM / 2, bucket.diameterM / 2, bucket.heightM, 40, 1, true]} />
        <meshStandardMaterial color="#929b9d" side={DoubleSide} metalness={0.4} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.003, 0]}><cylinderGeometry args={[0.1, 0.1, 0.006, 40]} />
        <meshStandardMaterial color="#929b9d" /></mesh>
      {Array.from({ length: pipes.redCount + pipes.blueCount }, (_, index) => {
        const angle = index * Math.PI * 2 / 10;
        return <mesh key={index} position={[Math.cos(angle) * 0.06, pipes.lengthM / 2 + 0.006, Math.sin(angle) * 0.06]}
          rotation={[0.08 * Math.cos(angle), 0, 0.08 * Math.sin(angle)]}>
          <cylinderGeometry args={[pipes.outerDiameterM / 2, pipes.outerDiameterM / 2, pipes.lengthM, 12, 1, true]} />
          <meshStandardMaterial color={teamColor(index < pipes.redCount ? 'red' : 'blue')} side={DoubleSide} />
        </mesh>;
      })}
    </group>
    {donuts.map((position, index) => <group key={index} position={[position.xM, position.zM, position.yM]} name={`donut-pole-${index}`}>
      <Block xM={-pole.plateSideM / 2} yM={-pole.plateSideM / 2} widthM={pole.plateSideM}
        depthM={pole.plateSideM} heightM={0.004} color="#929b9d" />
      <mesh geometry={poleGeometry}><meshStandardMaterial color="#85898c" metalness={0.65} roughness={0.45} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, donut.thicknessM / 2 + 0.004, 0]}>
        <torusGeometry args={[(donut.outerDiameterM + donut.innerDiameterM) / 4, donut.thicknessM / 2, 12, 40]} />
        <meshStandardMaterial color="#f0c221" roughness={0.55} />
      </mesh>
    </group>)}
  </group>;
}

function ThreeVThree() {
  return <group name="3v3-field">
    <Perimeter mode="3v3" />
    {three.zones.map((zone) => <Tape key={zone.id} {...zone} />)}
    <Deck {...three.centralHighGround.deck} />
    {three.centralHighGround.ramps.map((ramp) => <Ramp key={ramp.id} {...ramp} />)}
    {three.sideHighGrounds.map((deck) => <Deck key={deck.id} {...deck} />)}
    {three.barriers.map((barrier) => {
      const central = barrier.id === 'central-wall';
      return <group key={barrier.id} name={barrier.id}>
        <group position={[barrier.xM + barrier.widthM / 2, 0, barrier.yM + barrier.depthM / 2]}
          rotation={[0, central ? Math.PI / 2 : 0, 0]}>
          <FramedWall lengthM={central ? barrier.depthM : barrier.widthM} heightM={barrier.heightM}
            thicknessM={central ? barrier.widthM : barrier.depthM} />
        </group>
        {barrier.sheetHeightM !== undefined && barrier.sheetLengthM !== undefined && <Block xM={6 - 0.019 / 2} yM={barrier.yM + (barrier.depthM - barrier.sheetLengthM) / 2}
          widthM={0.019} depthM={barrier.sheetLengthM} heightM={barrier.sheetHeightM - barrier.heightM}
          baseM={barrier.heightM} color={SHEET} />}
      </group>;
    })}
    <BumpyRoad />
    <LimboBars />
    <ScoringAreas />
    <Objectives />
  </group>;
}

function OneVOne() {
  return <group name="1v1-field">
    <Perimeter mode="1v1" />
    {one.zones.map((zone) => <Tape key={zone.id} {...zone} />)}
    {one.bunkers.map((bunker) => <group key={bunker.id} name={bunker.id}
      position={[bunker.center.xM, 0, bunker.center.yM]} rotation={[0, -bunker.rotationDeg * Math.PI / 180, 0]}>
      <FramedWall lengthM={bunker.lengthM} heightM={bunker.heightM} thicknessM={bunker.depthM} />
    </group>)}
  </group>;
}

function DroneBase() {
  const { base } = drone;
  const tilt = base.armorTiltDeg * Math.PI / 180;
  const shell = useMemo(() => {
    const bottomApothem = base.armorCenterRadiusM - 0.012 / Math.cos(tilt) + base.armorCenterHeightM * Math.tan(tilt);
    const topApothem = bottomApothem - base.visual.heightM * Math.tan(tilt);
    const vertices: number[] = [], indices: number[] = [];
    const corners = [new Vector3(0, 0, 2), new Vector3(Math.sqrt(3), 0, -1), new Vector3(-Math.sqrt(3), 0, -1)];
    const outline = corners.flatMap((corner, index) => [
      corner.clone().lerp(corners[(index + 2) % 3]!, base.visual.cornerTrim),
      corner.clone().lerp(corners[(index + 1) % 3]!, base.visual.cornerTrim),
    ]);
    for (const [height, apothem] of [[0, bottomApothem], [base.visual.heightM, topApothem]]) {
      for (const point of outline) vertices.push(point.x * apothem!, height!, point.z * apothem!);
    }
    for (let i = 0; i < 6; i++) {
      const j = (i + 1) % 6;
      indices.push(i, j, j + 6, i, j + 6, i + 6);
    }
    for (let i = 1; i < 5; i++) indices.push(6, 6 + i, 7 + i);
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    return geometry;
  }, [base, tilt]);
  useEffect(() => () => shell.dispose(), [shell]);
  return <group name="blue-base" position={[base.xM, 0, base.yM]}>
    <mesh geometry={shell} castShadow receiveShadow>
      <meshStandardMaterial color="#252729" roughness={0.7} side={DoubleSide} flatShading />
    </mesh>
    {base.armorAnglesDeg.map((angle) => <group key={angle} rotation={[0, angle * Math.PI / 180, 0]}>
      <group name={`armor-module:${angle}`} position={[0, base.armorCenterHeightM, base.armorCenterRadiusM]} rotation={[-tilt, 0, 0]}>
        <mesh position={[0, 0, -0.012]}><boxGeometry args={[base.visual.armorWidthM, base.visual.armorHeightM, 0.018]} />
          <meshStandardMaterial color="#101214" /></mesh>
        <mesh name="armor-attack-face" position={[0, 0, -0.003]}><boxGeometry args={[0.165, 0.085, 0.006]} />
          <meshStandardMaterial color="#31383d" metalness={0.45} roughness={0.5} /></mesh>
        {[-1, 1].map((side) => <mesh key={side} position={[side * 0.098, 0, -0.001]}>
          <boxGeometry args={[0.006, 0.085, 0.008]} /><meshStandardMaterial color="#3559ff" emissive="#173bcf" emissiveIntensity={0.5} />
        </mesh>)}
      </group>
      {/* Blue corner guards and status lights follow the isometric drawing. */}
      <group rotation={[0, Math.PI / 3, 0]}>
        <Block xM={-0.18} yM={0.49} widthM={0.36} depthM={0.18} heightM={0.17} color="#1926b3" />
        <Block xM={-0.17} yM={0.49} widthM={0.34} depthM={0.17} heightM={0.045} baseM={0.17} color="#5555ed" />
      </group>
    </group>)}
    <Block xM={-0.09} yM={-0.08} widthM={0.18} depthM={0.16} heightM={0.025} baseM={base.visual.heightM} color="#121719" />
    <Block xM={-0.16} yM={-0.18} widthM={0.32} depthM={0.035} heightM={0.025} baseM={base.visual.heightM} color="#5955ef" />
  </group>;
}

export const FieldArena = memo(function FieldArena({ mode }: { readonly mode: FieldMode }) {
  const spec = FIELD_SPECS[mode];
  return <>
    <ambientLight intensity={1.2} />
    <directionalLight position={[-3, 15, -5]} intensity={2.5} castShadow
      shadow-mapSize={[2048, 2048]} shadow-camera-left={-15} shadow-camera-right={15}
      shadow-camera-top={12} shadow-camera-bottom={-12} shadow-normalBias={0.015} />
    <hemisphereLight args={['#e8efff', '#34302b', 0.8]} />
    <group position={[spec.size.lengthM / 2, 0, -spec.size.widthM / 2]} scale={[-1, 1, 1]}>
      <mesh position={[spec.floor.xM + spec.floor.widthM / 2, -0.001, spec.floor.yM + spec.floor.depthM / 2]}
        rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[spec.floor.widthM, spec.floor.depthM]} />
        <meshStandardMaterial color={FLOOR} roughness={0.95} side={DoubleSide} />
      </mesh>
      {mode === '3v3' ? <ThreeVThree /> : mode === '1v1' ? <OneVOne /> : <group name="drone-field">
        {drone.zones.map((zone) => <Tape key={zone.id} {...zone} />)}
        <DroneBase />
      </group>}
    </group>
  </>;
});
