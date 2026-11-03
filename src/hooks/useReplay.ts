import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { REPLAY_DURATION_S } from '../telemetry/mockReplay';
import { robotStateAt } from '../telemetry/robotState';
import type { ReplayState, RobotId, RobotTelemetry } from '../types';

const initialReplay: ReplayState = {
  durationS: REPLAY_DURATION_S,
  currentTimeS: 0,
  playing: false,
  speed: 1,
};

const REPLAY_FRAME_INTERVAL_MS = 1000 / 60;

export const useReplay = (robotId: RobotId = 'infantry', demoEnabled = true) => {
  const [replay, setReplay] = useState<ReplayState>(initialReplay);
  const lastFrameMs = useRef<number | null>(null);
  const nextFrameMs = useRef<number | null>(null);
  const robot = useMemo<RobotTelemetry>(() => robotStateAt(replay.currentTimeS, robotId, demoEnabled),
    [replay.currentTimeS, robotId, demoEnabled]);

  useEffect(() => {
    if (!demoEnabled || !replay.playing) {
      lastFrameMs.current = null;
      nextFrameMs.current = null;
      if (!demoEnabled) setReplay((current) => current.playing ? { ...current, playing: false } : current);
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
      // Do not fast-forward an entire recording after the app resumes from sleep.
      const deltaS = Math.min(0.25, Math.max(0, (nowMs - previousMs) / 1000));

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
  }, [replay.playing, demoEnabled]);

  const seek = useCallback((timeS: number) => {
    if (!demoEnabled || !Number.isFinite(timeS)) return;
    lastFrameMs.current = null;
    const nextTimeS = Math.max(0, Math.min(REPLAY_DURATION_S, timeS));
    setReplay((current) => ({ ...current, currentTimeS: nextTimeS }));
  }, [demoEnabled]);

  const togglePlaying = useCallback(() => {
    if (!demoEnabled) return;
    setReplay((current) => ({
      ...current,
      currentTimeS: current.currentTimeS >= current.durationS ? 0 : current.currentTimeS,
      playing: !current.playing,
    }));
  }, [demoEnabled]);

  const setSpeed = useCallback((speed: number) => {
    if (!demoEnabled || !Number.isFinite(speed) || speed <= 0) return;
    lastFrameMs.current = null;
    setReplay((current) => ({ ...current, speed }));
  }, [demoEnabled]);

  return { replay: demoEnabled ? replay : { ...replay, playing: false }, robot, seek, togglePlaying, setSpeed };
};
