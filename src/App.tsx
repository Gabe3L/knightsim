import { useCallback, useEffect, useRef, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { SettingsDialog } from './components/SettingsDialog';
import { Timeline } from './components/Timeline';
import { TopBar } from './components/TopBar';
import { ARCC_2026_FIELD } from './field/fieldSpec';
import { useReplay } from './hooks/useReplay';
import { useRobotModels } from './hooks/useRobotModels';
import type { CameraState, ViewMode } from './types';
import { Field2D } from './views/Field2D';
import { Field3D } from './views/Field3D';

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));
const DEFAULT_SIDEBAR_WIDTH = 292;
// The macOS traffic lights start at x=16 and span roughly 52px. The extra room
// keeps them comfortably contained instead of letting the resize edge crowd them.
const MIN_SIDEBAR_WIDTH = 96;
const MAX_SIDEBAR_WIDTH = 480;
const COMPACT_SIDEBAR_WIDTH = 190;
const isWindows = window.knightSim?.platform === 'win32';

export function App() {
  const [activeView, setActiveView] = useState<ViewMode>('2d');
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [sidebarResizing, setSidebarResizing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const sidebarResizingRef = useRef(false);
  const sidebarDragStart = useRef({ pointerX: 0, width: DEFAULT_SIDEBAR_WIDTH });
  const [camera, setCamera] = useState<CameraState>({
    targetXM: ARCC_2026_FIELD.size.lengthM / 2,
    targetYM: ARCC_2026_FIELD.size.widthM / 2,
    zoom: 1,
    followRobot: false,
  });
  const { replay, robot, seek, togglePlaying, setSpeed } = useReplay();
  const robotModels = useRobotModels();

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
      className={[
        'app-shell',
        isWindows && 'app-shell-windows',
        sidebarResizing && 'sidebar-is-resizing',
      ].filter(Boolean).join(' ')}
      style={{ '--sidebar-width': `${sidebarWidth}px` } as React.CSSProperties}
    >
      <Sidebar
        compact={sidebarWidth < COMPACT_SIDEBAR_WIDTH}
        maxWidth={MAX_SIDEBAR_WIDTH}
        minWidth={MIN_SIDEBAR_WIDTH}
        robot={robot}
        width={sidebarWidth}
        onOpenSettings={() => setSettingsOpen(true)}
        onResize={resizeSidebar}
        onResizeEnd={stopSidebarResize}
        onResizeKeyboard={resizeSidebarByKeyboard}
        onResizeStart={startSidebarResize}
      />
      <div className="app-main">
        <TopBar
          activeView={activeView}
          onViewChange={setActiveView}
        />
        <main className="workspace">
          {activeView === '2d' ? (
            <Field2D robot={robot} camera={camera} onCameraChange={setCamera} />
          ) : (
            <Field3D robot={robot} camera={camera} model={robotModels.modelForRobot(robot.robotId)} />
          )}
        </main>
        <Timeline replay={replay} onSeek={seek} onTogglePlaying={togglePlaying} onSpeedChange={setSpeed} />
      </div>
      {settingsOpen ? (
        <SettingsDialog
          busy={robotModels.busy}
          error={robotModels.error}
          library={robotModels.library}
          loading={robotModels.loading}
          onClearError={robotModels.clearError}
          onClose={() => setSettingsOpen(false)}
          onImport={(robotId) => void robotModels.importModel(robotId)}
          onRemove={(id) => void robotModels.removeModel(id)}
          onSelect={(robotId, id) => void robotModels.setRobotModel(robotId, id)}
          onUpdateOrientation={(id, orientation) => void robotModels.updateOrientation(id, orientation)}
        />
      ) : null}
    </div>
  );
}
