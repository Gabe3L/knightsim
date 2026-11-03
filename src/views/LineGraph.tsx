import {
  LineChart,
} from 'lucide-react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type PointerEvent,
} from 'react';
import {
  GRAPH_SIGNAL_DRAG_TYPE,
  graphColorForCategory,
  graphSignalById,
  type GraphSignalConfig,
  type GraphSignalDescriptor,
} from '../telemetry/graphSignals';
import type { ReplayState } from '../types';
import { readTelemetryTopicDrag } from '../telemetry/topicDrag';

interface LineGraphProps {
  readonly demoEnabled: boolean;
  readonly replay: ReplayState;
  readonly signals: readonly GraphSignalConfig[];
  readonly onAddSignal: (id: string) => void;
  readonly onSeek: (timeS: number) => void;
}

interface ChartSize {
  readonly width: number;
  readonly height: number;
}

interface SignalSeries {
  readonly descriptor: GraphSignalDescriptor;
  readonly values: readonly number[];
}

interface UnitLane {
  readonly unit: string;
  readonly series: readonly SignalSeries[];
  readonly min: number;
  readonly max: number;
}

const MIN_CHART_WIDTH = 480;
const MIN_CHART_HEIGHT = 260;
const CHART_MARGIN = { left: 66, right: 20, top: 18, bottom: 34 } as const;
const LANE_GAP = 12;

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const formatTime = (timeS: number): string => {
  const minutes = Math.floor(timeS / 60);
  const seconds = Math.floor(timeS % 60);
  const tenths = Math.floor((timeS % 1) * 10);
  return `${minutes}:${seconds.toString().padStart(2, '0')}.${tenths}`;
};

const formatAxisValue = (value: number): string => {
  const magnitude = Math.abs(value);
  if (magnitude >= 100) return value.toFixed(0);
  if (magnitude >= 10) return value.toFixed(1);
  if (magnitude >= 1) return value.toFixed(2);
  return value.toFixed(3);
};

function paddedRange(values: readonly number[]): readonly [number, number] {
  const finiteValues = values.filter(Number.isFinite);
  if (finiteValues.length === 0) return [-1, 1];
  const minimum = Math.min(...finiteValues);
  const maximum = Math.max(...finiteValues);
  if (minimum === maximum) {
    const padding = Math.max(Math.abs(minimum) * 0.08, 1);
    return [minimum - padding, maximum + padding];
  }
  const padding = (maximum - minimum) * 0.1;
  return [minimum - padding, maximum + padding];
}

function pathFor(
  times: readonly number[],
  values: readonly number[],
  durationS: number,
  min: number,
  max: number,
  x: number,
  y: number,
  width: number,
  height: number,
): string {
  const span = Math.max(0.0001, max - min);
  return values.map((value, index) => {
    const timeS = times[index] ?? 0;
    const pointX = x + (timeS / Math.max(durationS, 0.0001)) * width;
    const pointY = y + height - ((value - min) / span) * height;
    return `${index === 0 ? 'M' : 'L'} ${pointX.toFixed(2)} ${pointY.toFixed(2)}`;
  }).join(' ');
}

export function LineGraph({
  demoEnabled,
  replay,
  signals,
  onAddSignal,
  onSeek,
}: LineGraphProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [dropActive, setDropActive] = useState(false);
  const [hoverTimeS, setHoverTimeS] = useState<number | null>(null);
  const [chartSize, setChartSize] = useState<ChartSize>({ width: 900, height: 500 });

  useEffect(() => {
    const element = chartRef.current;
    if (!element) return undefined;

    const updateSize = (): void => {
      const bounds = element.getBoundingClientRect();
      setChartSize({
        width: Math.max(MIN_CHART_WIDTH, Math.round(bounds.width)),
        height: Math.max(MIN_CHART_HEIGHT, Math.round(bounds.height)),
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const selectedSignals = useMemo(() => (
    signals
      .map((signal) => graphSignalById(signal.id))
      .filter((descriptor): descriptor is GraphSignalDescriptor => descriptor !== null)
  ), [signals]);
  const signalColorById = useMemo(() => new Map(signals.map((signal) => [
    signal.id,
    graphColorForCategory(signal.colorCategory),
  ])), [signals]);

  const times = useMemo(() => {
    const sampleCount = Math.max(2, Math.min(720, Math.ceil(replay.durationS * 6) + 1));
    return Array.from(
      { length: sampleCount },
      (_, index) => (index / (sampleCount - 1)) * replay.durationS,
    );
  }, [replay.durationS]);

  const lanes = useMemo<readonly UnitLane[]>(() => {
    if (!demoEnabled) return [];
    const grouped = new Map<string, SignalSeries[]>();
    selectedSignals.forEach((descriptor) => {
      const series: SignalSeries = {
        descriptor,
        values: times.map((timeS) => descriptor.sampleAt(timeS)),
      };
      const group = grouped.get(descriptor.unit) ?? [];
      group.push(series);
      grouped.set(descriptor.unit, group);
    });

    return Array.from(grouped, ([unit, series]) => {
      const [min, max] = paddedRange(series.flatMap((item) => item.values));
      return { unit, series, min, max };
    });
  }, [selectedSignals, times, demoEnabled]);

  const width = chartSize.width;
  const height = chartSize.height;
  const plotX = CHART_MARGIN.left;
  const plotY = CHART_MARGIN.top;
  const plotWidth = Math.max(1, width - CHART_MARGIN.left - CHART_MARGIN.right);
  const plotHeight = Math.max(1, height - CHART_MARGIN.top - CHART_MARGIN.bottom);
  const laneCount = Math.max(1, lanes.length);
  const laneHeight = Math.max(24, (plotHeight - LANE_GAP * (laneCount - 1)) / laneCount);
  // Curves depend on samples and layout, not the moving replay cursor.
  const pathsById = useMemo(() => new Map(lanes.flatMap((lane, laneIndex) => {
    const y = plotY + laneIndex * (laneHeight + LANE_GAP);
    return lane.series.map((series) => [series.descriptor.id,
      pathFor(times, series.values, replay.durationS, lane.min, lane.max, plotX, y, plotWidth, laneHeight),
    ] as const);
  })), [lanes, times, replay.durationS, plotX, plotY, plotWidth, laneHeight]);
  const currentX = plotX + (replay.currentTimeS / Math.max(replay.durationS, 0.0001)) * plotWidth;
  const hoverX = hoverTimeS === null
    ? null
    : plotX + (hoverTimeS / Math.max(replay.durationS, 0.0001)) * plotWidth;

  const timeFromPointer = (event: PointerEvent<SVGSVGElement>): number => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const localX = ((event.clientX - bounds.left) / bounds.width) * width;
    const progress = clamp((localX - plotX) / plotWidth, 0, 1);
    return progress * replay.durationS;
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>): void => {
    if (!Array.from(event.dataTransfer.types).includes(GRAPH_SIGNAL_DRAG_TYPE)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setDropActive(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>): void => {
    const relatedTarget = event.relatedTarget;
    if (relatedTarget instanceof Node && event.currentTarget.contains(relatedTarget)) return;
    setDropActive(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    setDropActive(false);
    const topic = readTelemetryTopicDrag(event.dataTransfer);
    if (topic) {
      topic.graphSignalIds.filter((id) => graphSignalById(id) !== null).forEach(onAddSignal);
      return;
    }
    const signalId = event.dataTransfer.getData(GRAPH_SIGNAL_DRAG_TYPE);
    if (!graphSignalById(signalId)) return;
    onAddSignal(signalId);
  };

  return (
    <section
      className={dropActive ? 'line-graph-stage line-graph-drop-active' : 'line-graph-stage'}
      aria-label="Line graph"
      onDragEnter={handleDragOver}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="line-graph-chart" ref={chartRef}>
        {!demoEnabled ? (
          <div className="line-graph-empty" role="status">
            <span aria-hidden="true"><LineChart size={27} /></span>
            <strong>Waiting for robot connection</strong>
            <p>Connect a robot to receive telemetry, or turn on Demo to explore sample data.</p>
          </div>
        ) : selectedSignals.length === 0 ? (
          <div className="line-graph-empty" role="status">
            <span aria-hidden="true"><LineChart size={27} /></span>
            <strong>Select a telemetry signal</strong>
            <p>Open a robot in the sidebar and select the eye beside a numeric field. You can also drag a field or an entire topic onto this canvas.</p>
          </div>
        ) : (
          <svg
            className="line-graph-svg"
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label={`${selectedSignals.length} telemetry signals over ${formatTime(replay.durationS)}`}
            onPointerDown={(event) => onSeek(timeFromPointer(event))}
            onPointerLeave={() => setHoverTimeS(null)}
            onPointerMove={(event) => setHoverTimeS(timeFromPointer(event))}
          >
            <rect x={plotX} y={plotY} width={plotWidth} height={plotHeight} rx="5" className="graph-plot-background" />

            {Array.from({ length: 5 }, (_, index) => {
              const progress = index / 4;
              const x = plotX + progress * plotWidth;
              const timeS = progress * replay.durationS;
              return (
                <g key={`time-${index}`}>
                  <line x1={x} x2={x} y1={plotY} y2={plotY + plotHeight} className="graph-grid-line graph-time-grid" />
                  <text x={x} y={height - 11} textAnchor={index === 0 ? 'start' : index === 4 ? 'end' : 'middle'} className="graph-axis-text">
                    {formatTime(timeS)}
                  </text>
                </g>
              );
            })}

            {lanes.map((lane, laneIndex) => {
              const y = plotY + laneIndex * (laneHeight + LANE_GAP);
              const laneBottom = y + laneHeight;
              const range = Math.max(0.0001, lane.max - lane.min);
              return (
                <g key={lane.unit}>
                  {laneIndex > 0 ? <line x1={plotX} x2={plotX + plotWidth} y1={y - LANE_GAP / 2} y2={y - LANE_GAP / 2} className="graph-lane-divider" /> : null}
                  {[0, 0.5, 1].map((progress) => {
                    const gridY = laneBottom - progress * laneHeight;
                    const value = lane.min + progress * range;
                    return (
                      <g key={`${lane.unit}-${progress}`}>
                        <line x1={plotX} x2={plotX + plotWidth} y1={gridY} y2={gridY} className="graph-grid-line" />
                        <text x={plotX - 9} y={gridY + 3} textAnchor="end" className="graph-axis-text">{formatAxisValue(value)}</text>
                      </g>
                    );
                  })}
                  <text x={10} y={y + 12} className="graph-unit-label">{lane.unit}</text>
                  {lane.series.map((series) => {
                    const selectedValue = series.descriptor.sampleAt(replay.currentTimeS);
                    const selectedY = laneBottom - ((selectedValue - lane.min) / range) * laneHeight;
                    return (
                      <g key={series.descriptor.id}>
                        <path
                          d={pathsById.get(series.descriptor.id)}
                          fill="none"
                          stroke={signalColorById.get(series.descriptor.id) ?? series.descriptor.color}
                          className="graph-series-line"
                        />
                        <circle cx={currentX} cy={selectedY} r="3.2" fill={signalColorById.get(series.descriptor.id) ?? series.descriptor.color} className="graph-current-point" />
                      </g>
                    );
                  })}
                </g>
              );
            })}

            {hoverX !== null ? <line x1={hoverX} x2={hoverX} y1={plotY} y2={plotY + plotHeight} className="graph-hover-cursor" /> : null}
            <line x1={currentX} x2={currentX} y1={plotY} y2={plotY + plotHeight} className="graph-current-cursor" />
          </svg>
        )}
      </div>

      {dropActive ? (
        <div className="line-graph-drop-overlay" aria-hidden="true">
          <span><LineChart size={21} /></span>
          Drop to add signal
        </div>
      ) : null}
    </section>
  );
}
