import { useCallback, useEffect, useRef, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Timeline } from './components/Timeline';
import { TopBar } from './components/TopBar';
import { ARCC_2026_FIELD } from './field/fieldSpec';
import { useReplay } from './hooks/useReplay';
import type { CameraState, RobotTelemetry, ViewMode } from './types';
import { Field2D } from './views/Field2D';
import { Field3D } from './views/Field3D';

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));
const DEFAULT_SIDEBAR_WIDTH = 292;
// The macOS traffic lights start at x=16 and span roughly 52px. The extra room
// keeps them comfortably contained instead of letting the resize edge crowd them.
const MIN_SIDEBAR_WIDTH = 96;
const MAX_SIDEBAR_WIDTH = 480;
const COMPACT_SIDEBAR_WIDTH = 190;

export function App() {
  const [activeView, setActiveView] = useState<ViewMode>('2d');
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [sidebarResizing, setSidebarResizing] = useState(false);
  const sidebarResizingRef = useRef(false);
  const sidebarDragStart = useRef({ pointerX: 0, width: DEFAULT_SIDEBAR_WIDTH });
  const [camera, setCamera] = useState<CameraState>({
    targetXM: ARCC_2026_FIELD.size.lengthM / 2,
    targetYM: ARCC_2026_FIELD.size.widthM / 2,
    zoom: 1,
    followRobot: false,
  });
  const { replay, robot, seek, togglePlaying, setSpeed, moveRobot } = useReplay();

  const updateRobot = useCallback((pose: Pick<RobotTelemetry, 'xM' | 'yM' | 'yawDeg'>) => {
    moveRobot(pose);
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

  const startSidebarResize = useCallback((pointerX: number) => {
    sidebarDragStart.current = { pointerX, width: sidebarWidth };
    sidebarResizingRef.current = true;
    setSidebarResizing(true);
  }, [sidebarWidth]);

  const resizeSidebar = useCallback((pointerX: number) => {
    if (!sidebarResizingRef.current) return;
    const nextWidth = sidebarDragStart.current.width + pointerX - sidebarDragStart.current.pointerX;
    setSidebarWidth(clamp(nextWidth, MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH));
  }, []);

  const stopSidebarResize = useCallback(() => {
    sidebarResizingRef.current = false;
    setSidebarResizing(false);
  }, []);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent): void => resizeSidebar(event.clientX);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopSidebarResize);
    window.addEventListener('pointercancel', stopSidebarResize);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopSidebarResize);
      window.removeEventListener('pointercancel', stopSidebarResize);
    };
  }, [resizeSidebar, stopSidebarResize]);

  const resizeSidebarByKeyboard = useCallback((nextWidth: number) => {
    setSidebarWidth(clamp(nextWidth, MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH));
  }, []);

  return (
    <div
      className={sidebarResizing ? 'app-shell sidebar-is-resizing' : 'app-shell'}
      style={{ '--sidebar-width': `${sidebarWidth}px` } as React.CSSProperties}
    >
      <Sidebar
        compact={sidebarWidth < COMPACT_SIDEBAR_WIDTH}
        maxWidth={MAX_SIDEBAR_WIDTH}
        minWidth={MIN_SIDEBAR_WIDTH}
        robot={robot}
        width={sidebarWidth}
        onResize={resizeSidebar}
        onResizeEnd={stopSidebarResize}
        onResizeKeyboard={resizeSidebarByKeyboard}
        onResizeStart={startSidebarResize}
      />
      <div className="app-main">
        <TopBar
          activeView={activeView}
          connections={[
            { name: 'Sentry', connected: false },
            { name: 'Infantry', connected: robot.connected },
            { name: 'Hero', connected: false },
          ]}
          onViewChange={setActiveView}
        />
        <main className="workspace">
          {activeView === '2d' ? (
            <Field2D robot={robot} camera={camera} onCameraChange={setCamera} onRobotMove={updateRobot} />
          ) : (
            <Field3D robot={robot} camera={camera} onRobotMove={updateRobot} />
          )}
        </main>
        <Timeline replay={replay} onSeek={seek} onTogglePlaying={togglePlaying} onSpeedChange={setSpeed} />
      </div>
    </div>
  );
}
