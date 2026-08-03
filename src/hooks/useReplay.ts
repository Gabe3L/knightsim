import { useCallback, useEffect, useRef, useState } from 'react';
import { REPLAY_DURATION_S, telemetryAt } from '../telemetry/mockReplay';
import type { ReplayState, RobotTelemetry } from '../types';

const initialReplay: ReplayState = {
  durationS: REPLAY_DURATION_S,
  currentTimeS: 0,
  playing: false,
  speed: 1,
};

export const useReplay = () => {
  const [replay, setReplay] = useState<ReplayState>(initialReplay);
  const [robot, setRobot] = useState<RobotTelemetry>(() => telemetryAt(0));
  const lastFrameMs = useRef<number | null>(null);

  useEffect(() => {
    if (!replay.playing) {
      lastFrameMs.current = null;
      return undefined;
    }

    let frameId = 0;
    const tick = (nowMs: number): void => {
      const previousMs = lastFrameMs.current ?? nowMs;
      lastFrameMs.current = nowMs;
      const deltaS = (nowMs - previousMs) / 1000;

      setReplay((current) => {
        const nextTimeS = Math.min(current.durationS, current.currentTimeS + deltaS * current.speed);
        setRobot(telemetryAt(nextTimeS));
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
    setRobot(telemetryAt(nextTimeS));
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

  const moveRobot = useCallback((next: Pick<RobotTelemetry, 'xM' | 'yM' | 'yawDeg'>) => {
    setReplay((current) => ({ ...current, playing: false }));
    setRobot((current) => ({ ...current, ...next }));
  }, []);

  return { replay, robot, seek, togglePlaying, setSpeed, moveRobot };
};
