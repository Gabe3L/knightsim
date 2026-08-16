import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { REPLAY_DURATION_S, telemetryAt } from '../telemetry/mockReplay';
import type { ReplayState, RobotTelemetry } from '../types';

const initialReplay: ReplayState = {
  durationS: REPLAY_DURATION_S,
  currentTimeS: 0,
  playing: false,
  speed: 1,
};

const REPLAY_FRAME_INTERVAL_MS = 1000 / 60;

export const useReplay = () => {
  const [replay, setReplay] = useState<ReplayState>(initialReplay);
  const lastFrameMs = useRef<number | null>(null);
  const nextFrameMs = useRef<number | null>(null);
  const robot = useMemo<RobotTelemetry>(() => telemetryAt(replay.currentTimeS), [replay.currentTimeS]);

  useEffect(() => {
    if (!replay.playing) {
      lastFrameMs.current = null;
      nextFrameMs.current = null;
      return undefined;
    }

    let frameId = 0;
    const tick = (nowMs: number): void => {
      if (nextFrameMs.current !== null && nowMs < nextFrameMs.current - 0.5) {
        frameId = requestAnimationFrame(tick);
        return;
      }

      const previousMs = lastFrameMs.current ?? nowMs;
      lastFrameMs.current = nowMs;
      nextFrameMs.current = (nextFrameMs.current ?? nowMs) + REPLAY_FRAME_INTERVAL_MS;
      if (nextFrameMs.current < nowMs) nextFrameMs.current = nowMs + REPLAY_FRAME_INTERVAL_MS;
      const deltaS = (nowMs - previousMs) / 1000;

      setReplay((current) => {
        const nextTimeS = Math.min(current.durationS, current.currentTimeS + deltaS * current.speed);
        return {
          ...current,
          currentTimeS: nextTimeS,
          playing: nextTimeS < current.durationS,
        };
      });
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [replay.playing]);

  const seek = useCallback((timeS: number) => {
    const nextTimeS = Math.max(0, Math.min(REPLAY_DURATION_S, timeS));
    setReplay((current) => ({ ...current, currentTimeS: nextTimeS }));
  }, []);

  const togglePlaying = useCallback(() => {
    setReplay((current) => ({
      ...current,
      currentTimeS: current.currentTimeS >= current.durationS ? 0 : current.currentTimeS,
      playing: !current.playing,
    }));
  }, []);

  const setSpeed = useCallback((speed: number) => {
    setReplay((current) => ({ ...current, speed }));
  }, []);

  return { replay, robot, seek, togglePlaying, setSpeed };
};
