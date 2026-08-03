import { Crosshair, LocateFixed, ZoomIn, ZoomOut } from 'lucide-react';
import { useMemo } from 'react';
import { ARCC_2026_FIELD, teamColor } from '../field/fieldSpec';
import type { CameraState, RobotTelemetry } from '../types';

interface Field2DProps {
  readonly robot: RobotTelemetry;
  readonly camera: CameraState;
  readonly onCameraChange: (camera: CameraState) => void;
  readonly onRobotMove: (pose: Pick<RobotTelemetry, 'xM' | 'yM' | 'yawDeg'>) => void;
}

const fieldY = (yM: number): number => ARCC_2026_FIELD.size.widthM - yM;
const rectY = (yM: number, depthM: number): number => fieldY(yM + depthM);
const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

export function Field2D({ robot, camera, onCameraChange, onRobotMove }: Field2DProps) {
  const viewBox = useMemo(() => {
    const width = 12.7 / camera.zoom;
    const height = 8.7 / camera.zoom;
    const centerX = clamp(camera.targetXM, width / 2 - 0.35, 12.35 - width / 2);
    const centerY = clamp(fieldY(camera.targetYM), height / 2 - 0.35, 8.35 - height / 2);
    return `${centerX - width / 2} ${centerY - height / 2} ${width} ${height}`;
  }, [camera]);

  const moveFromPointer = (event: React.PointerEvent<SVGSVGElement>): void => {
    if (event.button !== 0) return;
    const matrix = event.currentTarget.getScreenCTM();
    if (!matrix) return;
    const point = event.currentTarget.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const local = point.matrixTransform(matrix.inverse());
    onRobotMove({
      xM: clamp(local.x, 0.25, 11.75),
      yM: clamp(fieldY(local.y), 0.25, 7.75),
      yawDeg: robot.yawDeg,
    });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const setZoom = (zoom: number): void => onCameraChange({ ...camera, zoom: clamp(zoom, 1, 2.8) });

  return (
    <div className="field-stage field-stage-2d">
      <svg
        className="field-svg"
        viewBox={viewBox}
        role="img"
        aria-label="Top-down ARCC 2026 3v3 battlefield"
        onPointerDown={moveFromPointer}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) moveFromPointer(event);
        }}
        onPointerUp={(event) => event.currentTarget.releasePointerCapture(event.pointerId)}
        onWheel={(event) => setZoom(camera.zoom * (event.deltaY > 0 ? 0.9 : 1.1))}
      >
        <defs>
          <pattern id="floor-grid" width="0.5" height="0.5" patternUnits="userSpaceOnUse">
            <path d="M .5 0 L 0 0 0 .5" fill="none" stroke="#202733" strokeWidth="0.012" />
          </pattern>
          <pattern
            id="rfid-grid"
            width={ARCC_2026_FIELD.rfidPattern.cardWidthM + ARCC_2026_FIELD.rfidPattern.horizontalGapM}
            height={ARCC_2026_FIELD.rfidPattern.cardDepthM + ARCC_2026_FIELD.rfidPattern.verticalGapM}
            patternUnits="userSpaceOnUse"
          >
            <rect
              width={ARCC_2026_FIELD.rfidPattern.cardWidthM}
              height={ARCC_2026_FIELD.rfidPattern.cardDepthM}
              rx=".012"
              fill="none"
              stroke="#54f0b6"
              strokeOpacity=".48"
              strokeWidth=".012"
            />
          </pattern>
          <pattern id="road-ribs" width="0.1" height="0.1" patternUnits="userSpaceOnUse">
            <path d="M .02 .08 L .08 .02" stroke="#7f8999" strokeOpacity=".55" strokeWidth="0.018" strokeLinecap="round" />
          </pattern>
          <filter id="robot-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="0.08" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        <rect x="0" y="0" width="12" height="8" rx="0.04" fill="#11161e" />
        <rect x="0" y="0" width="12" height="8" fill="url(#floor-grid)" />

        {ARCC_2026_FIELD.zones.map((zone) => (
          <g key={zone.id}>
            <rect
              x={zone.xM}
              y={rectY(zone.yM, zone.depthM)}
              width={zone.widthM}
              height={zone.depthM}
              fill={zone.kind === 'capture' ? '#14352f' : teamColor(zone.team)}
              fillOpacity={zone.kind === 'capture' ? 0.72 : 0.13}
              stroke={teamColor(zone.team)}
              strokeWidth="0.035"
              vectorEffect="non-scaling-stroke"
            />
            <rect
              x={zone.xM}
              y={rectY(zone.yM, zone.depthM)}
              width={zone.widthM}
              height={zone.depthM}
              fill="url(#rfid-grid)"
              opacity={zone.kind === 'capture' ? 1 : 0.35}
            />
          </g>
        ))}

        <polygon
          points={ARCC_2026_FIELD.highGround.footprint.map((point) => `${point.xM},${fieldY(point.yM)}`).join(' ')}
          fill="#596271"
          stroke="#8994a5"
          strokeWidth="0.025"
          vectorEffect="non-scaling-stroke"
        />
        {ARCC_2026_FIELD.highGround.lowerDecks.map((deck, index) => (
          <rect key={`deck-${index}`} x={deck.xM} y={rectY(deck.yM, deck.depthM)} width={deck.widthM} height={deck.depthM} fill="#737d8b" opacity=".72" />
        ))}
        <rect
          x={ARCC_2026_FIELD.highGround.upperDeck.xM}
          y={rectY(ARCC_2026_FIELD.highGround.upperDeck.yM, ARCC_2026_FIELD.highGround.upperDeck.depthM)}
          width={ARCC_2026_FIELD.highGround.upperDeck.widthM}
          height={ARCC_2026_FIELD.highGround.upperDeck.depthM}
          fill="#9da7b4"
        />

        {ARCC_2026_FIELD.bumpyRoad.tiles.map((tile) => (
          <rect
            key={tile.id}
            x={tile.xM + 0.012}
            y={rectY(tile.yM, tile.depthM) + 0.012}
            width={tile.widthM - 0.024}
            height={tile.depthM - 0.024}
            rx="0.025"
            fill="#303844"
            stroke="#4d5766"
            strokeWidth="0.01"
          />
        ))}
        {ARCC_2026_FIELD.bumpyRoad.tiles.map((tile) => (
          <rect
            key={`${tile.id}-ribs`}
            x={tile.xM + 0.03}
            y={rectY(tile.yM, tile.depthM) + 0.03}
            width={tile.widthM - 0.06}
            height={tile.depthM - 0.06}
            fill="url(#road-ribs)"
            transform={tile.rotationDeg === 90 ? `rotate(90 ${tile.xM + 0.2} ${rectY(tile.yM, tile.depthM) + 0.2})` : undefined}
          />
        ))}

        {ARCC_2026_FIELD.barriers.map((barrier) => (
          <line
            key={barrier.id}
            x1={barrier.start.xM}
            y1={fieldY(barrier.start.yM)}
            x2={barrier.end.xM}
            y2={fieldY(barrier.end.yM)}
            stroke={teamColor(barrier.team)}
            strokeWidth="0.13"
            strokeLinecap="square"
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {ARCC_2026_FIELD.markers.map((marker) => (
          <g key={marker.id} transform={`translate(${marker.xM} ${fieldY(marker.yM)})`}>
            <rect x="-0.075" y="-0.075" width="0.15" height="0.15" rx=".015" fill="#05070a" stroke="#fff" strokeWidth=".018" />
            <text x="0" y="0.025" textAnchor="middle" fill="#fff" fontSize=".075" fontFamily="ui-monospace" fontWeight="700">{marker.id}</text>
          </g>
        ))}

        <rect x="0" y="0" width="12" height="8" fill="none" stroke="#7d8794" strokeWidth="0.11" vectorEffect="non-scaling-stroke" />

        <g
          transform={`translate(${robot.xM} ${fieldY(robot.yM)}) rotate(${-robot.yawDeg})`}
          filter="url(#robot-glow)"
          className="robot-glyph"
        >
          <circle r="0.34" fill="#ff4655" fillOpacity=".14" stroke="#ff5b66" strokeWidth=".025" />
          <rect x="-0.23" y="-0.2" width="0.46" height="0.4" rx=".055" fill="#df3341" stroke="#ff9299" strokeWidth=".03" />
          <path d="M .08 -.11 L .32 0 L .08 .11 Z" fill="#fff" />
          <circle r=".055" fill="#0c1118" />
        </g>
      </svg>

      <div className="field-overlay field-overlay-left">
        <span className="eyebrow">FIELD COORDINATES</span>
        <strong>X {robot.xM.toFixed(2)} · Y {robot.yM.toFixed(2)} m</strong>
      </div>
      <div className="field-overlay field-overlay-center"><Crosshair size={13} /> Click or drag to reposition</div>
      <div className="zoom-controls">
        <button type="button" onClick={() => setZoom(camera.zoom * 1.2)} aria-label="Zoom in"><ZoomIn size={16} /></button>
        <button type="button" onClick={() => setZoom(camera.zoom / 1.2)} aria-label="Zoom out"><ZoomOut size={16} /></button>
        <button type="button" onClick={() => onCameraChange({ ...camera, targetXM: 6, targetYM: 4, zoom: 1 })} aria-label="Fit field"><LocateFixed size={16} /></button>
      </div>
      <div className="orientation-widget"><span>Y</span><i /><b>X</b></div>
    </div>
  );
}
