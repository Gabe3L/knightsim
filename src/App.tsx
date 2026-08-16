import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FieldOverlaySidebar } from './components/FieldOverlaySidebar';
import { Sidebar } from './components/Sidebar';
import { SettingsDialog } from './components/SettingsDialog';
import { Timeline } from './components/Timeline';
import { TopBar } from './components/TopBar';
import { ARCC_2026_FIELD } from './field/fieldSpec';
import { useReplay } from './hooks/useReplay';
import { useFieldOverlayWorkspace } from './hooks/useFieldOverlayWorkspace';
import { useRobotModels } from './hooks/useRobotModels';
import {
  COLLAPSED_FIELD_SIDEBAR_WIDTH,
  MAX_FIELD_SIDEBAR_WIDTH,
  MIN_FIELD_SIDEBAR_WIDTH,
  isFieldSidebarCollapsed,
  isFieldSidebarShortcut,
  isLeftSidebarShortcut,
  resolveFieldOverlays,
} from './overlays/fieldOverlays';
import { odometryDebugAt } from './telemetry/odometryDebug';
import type { CameraState, ViewMode } from './types';
import { Field2D } from './views/Field2D';
import { Field3D } from './views/Field3D';
import { LineGraph } from './views/LineGraph';

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));
const DEFAULT_SIDEBAR_WIDTH = 292;
const isWindows = window.knightSim?.platform === 'win32';
// The macOS traffic lights start at x=16 and span roughly 52px. The extra room
// keeps them comfortably contained instead of letting the resize edge crowd them.
const MIN_SIDEBAR_WIDTH = isWindows ? 64 : 96;
const MAX_SIDEBAR_WIDTH = 480;
const COMPACT_SIDEBAR_WIDTH = 190;

export function App() {
  const [activeView, setActiveView] = useState<ViewMode>('2d');
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [sidebarResizing, setSidebarResizing] = useState(false);
  const [fieldSidebarResizing, setFieldSidebarResizing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const sidebarResizingRef = useRef(false);
  const sidebarDragStart = useRef({ pointerX: 0, width: DEFAULT_SIDEBAR_WIDTH });
  const expandedSidebarWidthRef = useRef(DEFAULT_SIDEBAR_WIDTH);
  const fieldSidebarResizingRef = useRef(false);
  const fieldSidebarDragStart = useRef({ pointerX: 0, width: 0 });
  const [camera, setCamera] = useState<CameraState>({
    targetXM: ARCC_2026_FIELD.size.lengthM / 2,
    targetYM: ARCC_2026_FIELD.size.widthM / 2,
    zoom: 1,
    followRobot: false,
  });
  const { replay, robot, seek, togglePlaying, setSpeed } = useReplay();
  const robotModels = useRobotModels();
  const { state: fieldOverlayWorkspace, dispatch: dispatchFieldOverlay } = useFieldOverlayWorkspace();
  const fieldOverlays = useMemo(() => resolveFieldOverlays(
    fieldOverlayWorkspace.items,
    odometryDebugAt(replay.currentTimeS),
  ), [fieldOverlayWorkspace.items, replay.currentTimeS]);

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
    if (!sidebarResizingRef.current) return;
    sidebarResizingRef.current = false;
    setSidebarWidth((currentWidth) => {
      if (currentWidth < COMPACT_SIDEBAR_WIDTH) return MIN_SIDEBAR_WIDTH;
      expandedSidebarWidthRef.current = currentWidth;
      return currentWidth;
    });
    setSidebarResizing(false);
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarWidth((currentWidth) => {
      if (currentWidth < COMPACT_SIDEBAR_WIDTH) return expandedSidebarWidthRef.current;
      expandedSidebarWidthRef.current = currentWidth;
      return MIN_SIDEBAR_WIDTH;
    });
  }, []);

  const startFieldSidebarResize = useCallback((pointerX: number) => {
    fieldSidebarDragStart.current = { pointerX, width: fieldOverlayWorkspace.sidebarWidth };
    fieldSidebarResizingRef.current = true;
    setFieldSidebarResizing(true);
  }, [fieldOverlayWorkspace.sidebarWidth]);

  const resizeFieldSidebar = useCallback((pointerX: number) => {
    if (!fieldSidebarResizingRef.current) return;
    const nextWidth = fieldSidebarDragStart.current.width
      + fieldSidebarDragStart.current.pointerX
      - pointerX;
    dispatchFieldOverlay({ type: 'set-sidebar-width', width: nextWidth });
  }, [dispatchFieldOverlay]);

  const stopFieldSidebarResize = useCallback(() => {
    if (!fieldSidebarResizingRef.current) return;
    fieldSidebarResizingRef.current = false;
    dispatchFieldOverlay({ type: 'finish-sidebar-resize' });
    setFieldSidebarResizing(false);
  }, [dispatchFieldOverlay]);

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

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (isFieldSidebarShortcut(event) && activeView !== 'graph') {
        event.preventDefault();
        dispatchFieldOverlay({ type: 'toggle-sidebar' });
      } else if (isLeftSidebarShortcut(event)) {
        event.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeView, dispatchFieldOverlay, toggleSidebar]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    return () => window.cancelAnimationFrame(frame);
  }, [activeView, fieldOverlayWorkspace.sidebarWidth]);

  const resizeSidebarByKeyboard = useCallback((nextWidth: number) => {
    setSidebarWidth(clamp(nextWidth, MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH));
  }, []);

  const resizeFieldSidebarByKeyboard = useCallback((nextWidth: number) => {
    dispatchFieldOverlay({ type: 'set-sidebar-width', width: nextWidth });
    dispatchFieldOverlay({ type: 'finish-sidebar-resize' });
  }, [dispatchFieldOverlay]);

  const fieldViewActive = activeView === '2d' || activeView === '3d';

  return (
    <div
      className={[
        'app-shell',
        isWindows && 'app-shell-windows',
        sidebarResizing && 'sidebar-is-resizing',
        fieldSidebarResizing && 'field-sidebar-is-resizing',
      ].filter(Boolean).join(' ')}
      style={{
        '--sidebar-width': `${sidebarWidth}px`,
        '--field-sidebar-width': `${fieldViewActive ? fieldOverlayWorkspace.sidebarWidth : 0}px`,
      } as React.CSSProperties}
    >
      <Sidebar
        compact={sidebarWidth < COMPACT_SIDEBAR_WIDTH}
        maxWidth={MAX_SIDEBAR_WIDTH}
        minWidth={MIN_SIDEBAR_WIDTH}
        robot={robot}
        currentTimeS={replay.currentTimeS}
        width={sidebarWidth}
        onAddFieldOverlay={(id) => {
          dispatchFieldOverlay({ type: 'add', id });
          dispatchFieldOverlay({ type: 'expand-sidebar' });
        }}
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
          <div
            className={activeView === '2d' ? 'workspace-view workspace-view-active' : 'workspace-view'}
            aria-hidden={activeView !== '2d'}
          >
            <Field2D robot={robot} camera={camera} overlays={fieldOverlays} onCameraChange={setCamera} />
          </div>
          <div
            className={activeView === '3d' ? 'workspace-view workspace-view-active' : 'workspace-view'}
            aria-hidden={activeView !== '3d'}
          >
            <Field3D robot={robot} camera={camera} overlays={fieldOverlays} model={robotModels.modelForRobot(robot.robotId)} />
          </div>
          <div
            className={activeView === 'graph' ? 'workspace-view workspace-view-active' : 'workspace-view'}
            aria-hidden={activeView !== 'graph'}
          >
            <LineGraph replay={replay} onSeek={seek} />
          </div>
        </main>
        <Timeline replay={replay} onSeek={seek} onTogglePlaying={togglePlaying} onSpeedChange={setSpeed} />
      </div>
      {fieldViewActive ? (
        <FieldOverlaySidebar
          collapsed={isFieldSidebarCollapsed(fieldOverlayWorkspace.sidebarWidth)}
          maxWidth={MAX_FIELD_SIDEBAR_WIDTH}
          minWidth={COLLAPSED_FIELD_SIDEBAR_WIDTH}
          overlays={fieldOverlays}
          width={fieldOverlayWorkspace.sidebarWidth}
          onAdd={(id) => dispatchFieldOverlay({ type: 'add', id })}
          onClear={() => dispatchFieldOverlay({ type: 'clear-all' })}
          onCollapse={() => dispatchFieldOverlay({ type: 'toggle-sidebar' })}
          onExpand={() => dispatchFieldOverlay({ type: 'expand-sidebar' })}
          onHideAll={() => dispatchFieldOverlay({ type: 'hide-all' })}
          onMove={(id, direction) => dispatchFieldOverlay({ type: 'move', id, direction })}
          onRemove={(id) => dispatchFieldOverlay({ type: 'remove', id })}
          onResize={resizeFieldSidebar}
          onResizeEnd={stopFieldSidebarResize}
          onResizeKeyboard={resizeFieldSidebarByKeyboard}
          onResizeStart={startFieldSidebarResize}
          onToggleVisibility={(id) => dispatchFieldOverlay({ type: 'toggle-visibility', id })}
        />
      ) : null}
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
