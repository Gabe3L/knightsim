import { LocateFixed, ZoomIn, ZoomOut } from 'lucide-react';
import { useMemo } from 'react';
import { ARCC_2026_FIELD, teamColor } from '../field/fieldSpec';
import type { ResolvedFieldOverlay } from '../overlays/fieldOverlays';
import { robotRenderProfile } from '../telemetry/robotCategories';
import type { CameraState, RobotTelemetry } from '../types';

interface Field2DProps {
  readonly robot: RobotTelemetry;
  readonly camera: CameraState;
  readonly overlays: readonly ResolvedFieldOverlay[];
  readonly onCameraChange: (camera: CameraState) => void;
}

const fieldY = (yM: number): number => ARCC_2026_FIELD.size.widthM - yM;
const rectY = (yM: number, depthM: number): number => fieldY(yM + depthM);
const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const fieldWoodColor = '#73777a';
const fieldSheetColor = '#111318';

function FieldOverlayGlyph({ overlay }: { readonly overlay: ResolvedFieldOverlay }) {
  if (!overlay.visible || !overlay.sample.available) return null;
  const { descriptor, sample, color } = overlay;
  const pose = sample.pose;
  const rejected = sample.status === 'rejected';
  const opacity = rejected ? 0.5 : 0.92;
  const dash = rejected ? '.08 .055' : undefined;

  return (
    <g opacity={opacity} data-overlay-id={overlay.id}>
      {sample.path && sample.path.length > 1 ? (
        <polyline
          points={sample.path.map((point) => `${point.xM},${fieldY(point.yM)}`).join(' ')}
          fill="none"
          stroke={color}
          strokeWidth=".035"
          strokeDasharray=".11 .055"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
      {pose && sample.residualToFused ? (
        <line
          x1={pose.xM}
          y1={fieldY(pose.yM)}
          x2={sample.residualToFused.xM}
          y2={fieldY(sample.residualToFused.yM)}
          stroke={color}
          strokeOpacity=".48"
          strokeWidth=".018"
          strokeDasharray=".055 .05"
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
      {pose && sample.covariance ? (
        <ellipse
          cx={pose.xM}
          cy={fieldY(pose.yM)}
          rx={sample.covariance.majorM}
          ry={sample.covariance.minorM}
          transform={`rotate(${-sample.covariance.angleDeg} ${pose.xM} ${fieldY(pose.yM)})`}
          fill={color}
          fillOpacity=".055"
          stroke={color}
          strokeOpacity=".72"
          strokeWidth=".018"
          strokeDasharray={dash}
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
      {pose ? (
        <g transform={`translate(${pose.xM} ${fieldY(pose.yM)}) rotate(${-pose.yawDeg})`}>
          {descriptor.kind === 'ground-truth' ? (
            <path d="M 0 -.29 L .29 0 L 0 .29 L -.29 0 Z" fill="#090d13" fillOpacity=".76" stroke={color} strokeWidth=".035" vectorEffect="non-scaling-stroke" />
          ) : descriptor.kind === 'fused' ? (
            <>
              <circle r=".34" fill={color} fillOpacity=".13" stroke={color} strokeWidth=".055" vectorEffect="non-scaling-stroke" />
              <rect x="-.22" y="-.18" width=".44" height=".36" rx=".045" fill="#090d13" fillOpacity=".72" stroke={color} strokeWidth=".028" vectorEffect="non-scaling-stroke" />
            </>
          ) : (
            <rect x="-.22" y="-.18" width=".44" height=".36" rx=".045" fill="#090d13" fillOpacity=".7" stroke={color} strokeWidth=".03" strokeDasharray={dash} vectorEffect="non-scaling-stroke" />
          )}
          <line x1="0" y1="0" x2=".42" y2="0" stroke={color} strokeWidth=".045" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          <path d="M .42 0 L .31 -.075 L .31 .075 Z" fill={color} />
          {descriptor.tagId !== undefined ? (
            <text
              className="field-overlay-svg-label"
              transform={`rotate(${pose.yawDeg})`}
              x="0"
              y="-.31"
              textAnchor="middle"
              fill={color}
              fontSize=".13"
              fontFamily="Inter, system-ui, sans-serif"
              fontWeight="750"
            >
              TAG {descriptor.tagId}
            </text>
          ) : null}
        </g>
      ) : null}
    </g>
  );
}

const barrierPoints = (
  barrier: (typeof ARCC_2026_FIELD.barriers)[number],
  thicknessM = barrier.thicknessM,
): string => {
  const dx = barrier.end.xM - barrier.start.xM;
  const dy = barrier.end.yM - barrier.start.yM;
  const length = Math.hypot(dx, dy);
  const offsetX = (-dy / length) * thicknessM / 2;
  const offsetY = (dx / length) * thicknessM / 2;
  const points: ReadonlyArray<readonly [number, number]> = [
    [barrier.start.xM + offsetX, barrier.start.yM + offsetY],
    [barrier.end.xM + offsetX, barrier.end.yM + offsetY],
    [barrier.end.xM - offsetX, barrier.end.yM - offsetY],
    [barrier.start.xM - offsetX, barrier.start.yM - offsetY],
  ];
  return points.map(([xM, yM]) => `${xM},${fieldY(yM)}`).join(' ');
};

export function Field2D({ robot, camera, overlays, onCameraChange }: Field2DProps) {
  const robotProfile = robotRenderProfile(robot.category);
  const viewBox = useMemo(() => {
    const width = 12.7 / camera.zoom;
    const height = 8.7 / camera.zoom;
    const centerX = clamp(camera.targetXM, width / 2 - 0.35, 12.35 - width / 2);
    const centerY = clamp(fieldY(camera.targetYM), height / 2 - 0.35, 8.35 - height / 2);
    return `${centerX - width / 2} ${centerY - height / 2} ${width} ${height}`;
  }, [camera]);

  const setZoom = (zoom: number): void => onCameraChange({ ...camera, zoom: clamp(zoom, 1, 2.8) });

  return (
    <div className="field-stage field-stage-2d">
      <svg
        className="field-svg"
        viewBox={viewBox}
        role="img"
        aria-label="Top-down ARCC 2026 3v3 battlefield"
        onWheel={(event) => setZoom(camera.zoom * (event.deltaY > 0 ? 0.9 : 1.1))}
      >
        <defs>
          <pattern id="floor-grid" width="0.5" height="0.5" patternUnits="userSpaceOnUse">
            <path d="M .5 0 L 0 0 0 .5" fill="none" stroke="#202733" strokeWidth="0.012" />
          </pattern>
          <pattern
            id="rfid-grid"
            width={2 * (ARCC_2026_FIELD.rfidPattern.cardWidthM + ARCC_2026_FIELD.rfidPattern.horizontalGapM)}
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
            <rect
              x={ARCC_2026_FIELD.rfidPattern.cardWidthM + ARCC_2026_FIELD.rfidPattern.horizontalGapM}
              y={(ARCC_2026_FIELD.rfidPattern.cardDepthM + ARCC_2026_FIELD.rfidPattern.verticalGapM) / 2}
              width={ARCC_2026_FIELD.rfidPattern.cardWidthM}
              height={ARCC_2026_FIELD.rfidPattern.cardDepthM}
              rx=".012"
              fill="none"
              stroke="#54f0b6"
              strokeOpacity=".48"
              strokeWidth=".012"
            />
            <rect
              x={ARCC_2026_FIELD.rfidPattern.cardWidthM + ARCC_2026_FIELD.rfidPattern.horizontalGapM}
              y={-(ARCC_2026_FIELD.rfidPattern.cardDepthM + ARCC_2026_FIELD.rfidPattern.verticalGapM) / 2}
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

        {ARCC_2026_FIELD.zones.map((zone) => {
          const tapeWidthM = ARCC_2026_FIELD.zoneTapeWidthM;
          return (
            <g key={zone.id}>
            <rect
              x={zone.xM}
              y={rectY(zone.yM, zone.depthM)}
              width={zone.widthM}
              height={zone.depthM}
              fill="url(#rfid-grid)"
              opacity={zone.kind === 'capture' ? 1 : 0.35}
            />
              <rect
                x={zone.xM + tapeWidthM / 2}
                y={rectY(zone.yM, zone.depthM) + tapeWidthM / 2}
                width={zone.widthM - tapeWidthM}
                height={zone.depthM - tapeWidthM}
                fill="none"
                stroke={teamColor(zone.team)}
                strokeWidth={tapeWidthM}
              />
            </g>
          );
        })}

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
        {ARCC_2026_FIELD.highGround.innerRamps.map((ramp, index) => (
          <rect key={`inner-ramp-${index}`} x={ramp.xM} y={rectY(ramp.yM, ramp.depthM)} width={ramp.widthM} height={ramp.depthM} fill="#8c96a3" opacity=".82" />
        ))}
        <rect
          x={ARCC_2026_FIELD.highGround.centerBarrier.xM}
          y={rectY(
            ARCC_2026_FIELD.highGround.centerBarrier.yM,
            ARCC_2026_FIELD.highGround.centerBarrier.depthM,
          )}
          width={ARCC_2026_FIELD.highGround.centerBarrier.widthM}
          height={ARCC_2026_FIELD.highGround.centerBarrier.depthM}
          fill={fieldWoodColor}
        />

        <rect
          x={ARCC_2026_FIELD.centralPlatform.xM}
          y={rectY(ARCC_2026_FIELD.centralPlatform.yM, ARCC_2026_FIELD.centralPlatform.depthM)}
          width={ARCC_2026_FIELD.centralPlatform.widthM}
          height={ARCC_2026_FIELD.centralPlatform.depthM}
          fill={fieldWoodColor}
          stroke="#92979b"
          strokeWidth=".018"
          vectorEffect="non-scaling-stroke"
        />

        {ARCC_2026_FIELD.bumpyRoad.tiles.map((tile) => (
          <rect
            key={tile.id}
            x={tile.xM}
            y={rectY(tile.yM, tile.depthM)}
            width={tile.widthM}
            height={tile.depthM}
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
          <g key={barrier.id}>
            <polygon points={barrierPoints(barrier)} fill={fieldWoodColor} />
            {barrier.heightM > ARCC_2026_FIELD.barrierConstruction.woodHeightM && (
              <polygon
                points={barrierPoints(barrier, ARCC_2026_FIELD.barrierConstruction.sheetThicknessM)}
                fill={fieldSheetColor}
              />
            )}
          </g>
        ))}

        {ARCC_2026_FIELD.markers.map((marker) => (
          <g key={marker.id} transform={`translate(${marker.xM} ${fieldY(marker.yM)}) rotate(${marker.facingDeg})`}>
            <rect x={-marker.sideM / 2} y="-.018" width={marker.sideM} height=".036" rx=".006" fill="#05070a" stroke="#fff" strokeWidth=".012" />
            <text transform={`rotate(${-marker.facingDeg})`} x="0" y="-.055" textAnchor="middle" fill="#fff" fontSize=".07" fontFamily="Inter, system-ui, sans-serif" fontWeight="700">{marker.id}</text>
          </g>
        ))}

        <path
          d={`M 0 0 H 12 V 8 H 0 Z M ${-ARCC_2026_FIELD.wall.thicknessM} ${-ARCC_2026_FIELD.wall.thicknessM} V ${8 + ARCC_2026_FIELD.wall.thicknessM} H ${12 + ARCC_2026_FIELD.wall.thicknessM} V ${-ARCC_2026_FIELD.wall.thicknessM} Z`}
          fill={fieldWoodColor}
          fillRule="evenodd"
        />

        <g
          transform={`translate(${robot.xM} ${fieldY(robot.yM)}) rotate(${-robot.yawDeg})`}
          filter="url(#robot-glow)"
          className={`robot-glyph robot-glyph-${robot.category}`}
          data-robot-category={robot.category}
        >
          <circle r="0.34" fill={robotProfile.halo} fillOpacity=".14" stroke={robotProfile.haloStroke} strokeWidth=".025" />
          <rect x="-0.23" y="-0.2" width="0.46" height="0.4" rx=".055" fill={robotProfile.body} stroke={robotProfile.bodyStroke} strokeWidth=".03" />
          <path d="M .08 -.11 L .32 0 L .08 .11 Z" fill="#fff" />
          <circle r=".055" fill="#0c1118" />
        </g>

        <g className="field-overlay-layer" aria-label="Field overlays">
          {overlays.map((overlay) => <FieldOverlayGlyph key={overlay.id} overlay={overlay} />)}
        </g>
      </svg>

      <div className="field-overlay field-overlay-left">
        <span className="eyebrow">FIELD COORDINATES</span>
        <strong>X {robot.xM.toFixed(2)} · Y {robot.yM.toFixed(2)} m</strong>
      </div>
      <div className="zoom-controls">
        <button type="button" onClick={() => setZoom(camera.zoom * 1.2)} aria-label="Zoom in"><ZoomIn size={16} /></button>
        <button type="button" onClick={() => setZoom(camera.zoom / 1.2)} aria-label="Zoom out"><ZoomOut size={16} /></button>
        <button type="button" onClick={() => onCameraChange({ ...camera, targetXM: 6, targetYM: 4, zoom: 1 })} aria-label="Fit field"><LocateFixed size={16} /></button>
      </div>
      <div className="orientation-widget"><span>Y</span><i /><b>X</b></div>
    </div>
  );
}
