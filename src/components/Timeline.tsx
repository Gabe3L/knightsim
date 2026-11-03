import { Pause, Play, RotateCcw, SkipBack } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { ReplayState } from '../types';

interface TimelineProps {
  readonly disabled: boolean;
  readonly replay: ReplayState;
  readonly onSeek: (timeS: number) => void;
  readonly onTogglePlaying: () => void;
  readonly onSpeedChange: (speed: number) => void;
}

const formatTime = (timeS: number): string => {
  const minutes = Math.floor(timeS / 60);
  const seconds = Math.floor(timeS % 60);
  const milliseconds = Math.floor((timeS % 1) * 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
};

export function Timeline({ disabled, replay, onSeek, onTogglePlaying, onSpeedChange }: TimelineProps) {
  const progress = (replay.currentTimeS / replay.durationS) * 100;
  return (
    <footer className={disabled ? 'timeline timeline-disabled' : 'timeline'} title={disabled ? 'Turn on Demo to use replay' : undefined}>
      <div className="transport-controls">
        <button className="transport-secondary" type="button" disabled={disabled} onClick={() => onSeek(0)} aria-label="Restart replay" title="Restart replay">
          <RotateCcw size={15} />
        </button>
        <button className="transport-secondary" type="button" disabled={disabled} onClick={() => onSeek(Math.max(0, replay.currentTimeS - 5))} aria-label="Back five seconds" title="Back 5 seconds">
          <SkipBack size={15} />
        </button>
        <button className="play-button" type="button" disabled={disabled} onClick={onTogglePlaying} aria-label={replay.playing ? 'Pause replay' : 'Play replay'} title={replay.playing ? 'Pause replay' : 'Play replay'}>
          {replay.playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}
        </button>
      </div>

      <div className="timeline-clock">
        <strong>{formatTime(replay.currentTimeS)}</strong>
        <span>/ {formatTime(replay.durationS)}</span>
      </div>

      <div
        className="scrubber-wrap"
        style={{ '--timeline-progress': `${progress}%` } as CSSProperties}
      >
        <div className="scrubber-fill" style={{ width: `${progress}%` }} />
        <div className="event-tick tick-a" />
        <div className="event-tick tick-b" />
        <div className="scrubber-head" aria-hidden="true" />
        <input
          className="scrubber"
          disabled={disabled}
          type="range"
          min={0}
          max={replay.durationS}
          step={0.01}
          value={replay.currentTimeS}
          onChange={(event) => onSeek(Number(event.currentTarget.value))}
          aria-label="Replay position"
        />
      </div>

      <label className="speed-control">
        <span>SPEED</span>
        <select aria-label="Replay speed" disabled={disabled} value={replay.speed} onChange={(event) => onSpeedChange(Number(event.currentTarget.value))}>
          {[0.25, 0.5, 1, 1.5, 2].map((speed) => <option key={speed} value={speed}>{speed}×</option>)}
        </select>
      </label>
    </footer>
  );
}
