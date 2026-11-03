import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { Box3, DoubleSide, Mesh, ShaderMaterial } from 'three';
import { cameraBarrierOpacity } from './CameraFlightBounds';

const vertexShader = `
  varying vec2 barrierPosition;
  void main() {
    barrierPosition = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const fragmentShader = `
  uniform float opacity;
  varying vec2 barrierPosition;
  void main() {
    vec2 grid = abs(fract(barrierPosition - 0.5) - 0.5)
      / max(fwidth(barrierPosition) * 1.5, vec2(0.0001));
    float line = 1.0 - min(min(grid.x, grid.y), 1.0);
    gl_FragColor = vec4(1.0, 0.08, 0.14, opacity * (0.18 + line * 0.72));
  }
`;

interface BarrierFaceProps {
  readonly axis: 'x' | 'y' | 'z';
  readonly limit: number;
  readonly position: [number, number, number];
  readonly rotation: [number, number, number];
  readonly size: [number, number];
}

function BarrierFace({ axis, limit, position, rotation, size }: BarrierFaceProps) {
  const mesh = useRef<Mesh>(null);
  const material = useRef<ShaderMaterial>(null);
  // Each face appears independently so only the nearby boundary lights up.
  useFrame(({ camera }) => {
    if (!mesh.current || !material.current) return;
    const opacity = cameraBarrierOpacity(Math.abs(camera.position[axis] - limit));
    mesh.current.visible = opacity > 0;
    material.current.uniforms.opacity!.value = opacity;
  });
  return <mesh ref={mesh} position={position} rotation={rotation} visible={false}>
    <planeGeometry args={size} />
    <shaderMaterial ref={material} vertexShader={vertexShader} fragmentShader={fragmentShader}
      uniforms={{ opacity: { value: 0 } }} transparent depthWrite={false} side={DoubleSide} toneMapped={false} />
  </mesh>;
}

export function CameraFlightBarrier({ bounds }: { readonly bounds: Box3 }) {
  const { min, max } = bounds;
  const width = max.x - min.x, height = max.y - min.y, depth = max.z - min.z;
  const x = (min.x + max.x) / 2, y = (min.y + max.y) / 2, z = (min.z + max.z) / 2;
  // Keep the visible surface beyond the stop point, clear of the camera's near plane.
  const offset = 0.25;
  return <group name="camera-flight-barrier">
    <BarrierFace axis="x" limit={min.x} position={[min.x - offset, y, z]} rotation={[0, Math.PI / 2, 0]} size={[depth, height]} />
    <BarrierFace axis="x" limit={max.x} position={[max.x + offset, y, z]} rotation={[0, Math.PI / 2, 0]} size={[depth, height]} />
    <BarrierFace axis="z" limit={min.z} position={[x, y, min.z - offset]} rotation={[0, 0, 0]} size={[width, height]} />
    <BarrierFace axis="z" limit={max.z} position={[x, y, max.z + offset]} rotation={[0, 0, 0]} size={[width, height]} />
    <BarrierFace axis="y" limit={max.y} position={[x, max.y + offset, z]} rotation={[Math.PI / 2, 0, 0]} size={[width, depth]} />
  </group>;
}
