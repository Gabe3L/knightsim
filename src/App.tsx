import { useCallback, useEffect, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Timeline } from './components/Timeline';
import { TopBar } from './components/TopBar';
import { ARCC_2026_FIELD } from './field/fieldSpec';
import { useReplay } from './hooks/useReplay';
import type { CameraState, RobotTelemetry, ViewMode } from './types';
import { Field2D } from './views/Field2D';
import { Field3D } from './views/Field3D';

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

export function App() {
  const [activeView, setActiveView] = useState<ViewMode>('2d');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [camera, setCamera] = useState<CameraState>({
    targetXM: ARCC_2026_FIELD.size.lengthM / 2,
    targetYM: ARCC_2026_FIELD.size.widthM / 2,
    zoom: 1,
    followRobot: false,
  });
  const { replay, robot, seek, togglePlaying, setSpeed, moveRobot } = useReplay();

  const updateRobot = useCallback((pose: Pick<RobotTelemetry, 'xM' | 'yM' | 'yawDeg'>) => {
    moveRobot(pose);
    setCamera((current) => current.followRobot
      ? { ...current, targetXM: pose.xM, targetYM: pose.yM }
      : current);
  }, [moveRobot]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, select, textarea, button')) return;
      const stepM = event.shiftKey ? 0.5 : 0.16;
      const next = { xM: robot.xM, yM: robot.yM, yawDeg: robot.yawDeg };

      if (event.key.toLowerCase() === 'w') next.yM += stepM;
      else if (event.key.toLowerCase() === 's') next.yM -= stepM;
      else if (event.key.toLowerCase() === 'a') next.xM -= stepM;
      else if (event.key.toLowerCase() === 'd') next.xM += stepM;
      else if (event.key.toLowerCase() === 'q') next.yawDeg += 5;
      else if (event.key.toLowerCase() === 'e') next.yawDeg -= 5;
      else return;

      event.preventDefault();
      updateRobot({
        xM: clamp(next.xM, 0.25, 11.75),
        yM: clamp(next.yM, 0.25, 7.75),
        yawDeg: ((next.yawDeg + 540) % 360) - 180,
      });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [robot, updateRobot]);

  useEffect(() => {
    if (!camera.followRobot) return;
    setCamera((current) => ({ ...current, targetXM: robot.xM, targetYM: robot.yM }));
  }, [camera.followRobot, robot.xM, robot.yM]);

  return (
    <div className={sidebarCollapsed ? 'app-shell sidebar-is-collapsed' : 'app-shell'}>
      <Sidebar
        collapsed={sidebarCollapsed}
        robot={robot}
        onToggle={() => setSidebarCollapsed((collapsed) => !collapsed)}
      />
      <div className="app-main">
        <TopBar activeView={activeView} onViewChange={setActiveView} />
        <main className="workspace">
          <section className="viewport-panel">
            <div className="viewport-titlebar">
              <div>
                <span className="eyebrow">BATTLEFIELD / 3V3</span>
                <h1>{activeView === '2d' ? 'Orthographic overview' : 'Spatial overview'}</h1>
              </div>
              <label className="follow-toggle">
                <input
                  type="checkbox"
                  checked={camera.followRobot}
                  onChange={(event) => setCamera((current) => ({
                    ...current,
                    followRobot: event.currentTarget.checked,
                    targetXM: event.currentTarget.checked ? robot.xM : current.targetXM,
                    targetYM: event.currentTarget.checked ? robot.yM : current.targetYM,
                  }))}
                />
                <span /> Follow robot
              </label>
            </div>
            <div className="viewport-content">
              {activeView === '2d' ? (
                <Field2D robot={robot} camera={camera} onCameraChange={setCamera} onRobotMove={updateRobot} />
              ) : (
                <Field3D robot={robot} camera={camera} onRobotMove={updateRobot} />
              )}
            </div>
          </section>
        </main>
        <Timeline replay={replay} onSeek={seek} onTogglePlaying={togglePlaying} onSpeedChange={setSpeed} />
      </div>
    </div>
  );
}
