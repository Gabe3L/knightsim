import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DataSidebar } from './components/DataSidebar';
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
  isFieldSidebarCollapsed,
  isRightSidebarShortcut,
  isLeftSidebarShortcut,
  resolveFieldOverlays,
} from './overlays/fieldOverlays';
import { odometryDebugAt } from './telemetry/odometryDebug';
import { controllerInputById } from './telemetry/controllerInputs';
import {
  defaultGraphColorCategory,
  graphSignalById,
  type GraphColorCategory,
  type GraphSignalConfig,
} from './telemetry/graphSignals';
import type { CameraState, RobotCategory, RobotId, ViewMode } from './types';
import { Field2D } from './views/Field2D';
import { Field3D } from './views/Field3D';
import { LineGraph } from './views/LineGraph';
import { ControllerView } from './views/ControllerView';

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));
const DEFAULT_SIDEBAR_WIDTH = 292;
const isWindows = window.knightSim?.platform === 'win32';
const isMac = window.knightSim?.platform === 'darwin';
// The macOS traffic lights start at x=16 and span roughly 52px. The extra room
// keeps them comfortably contained instead of letting the resize edge crowd them.
const COMPACT_SIDEBAR_WIDTH_WITH_WINDOW_CONTROLS = 96;
const COMPACT_SIDEBAR_WIDTH_WITHOUT_WINDOW_CONTROLS = 64;
const MAX_SIDEBAR_WIDTH = 480;
const COMPACT_SIDEBAR_WIDTH = 190;

export function App() {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const usesWindowsSidebarLayout = isWindows || (isMac && isFullScreen);
  const minSidebarWidth = usesWindowsSidebarLayout
    ? COMPACT_SIDEBAR_WIDTH_WITHOUT_WINDOW_CONTROLS
    : COMPACT_SIDEBAR_WIDTH_WITH_WINDOW_CONTROLS;
  const [activeView, setActiveView] = useState<ViewMode>('2d');
  const [controllerInputIds, setControllerInputIds] = useState<readonly string[]>([]);
  const [graphSignals, setGraphSignals] = useState<readonly GraphSignalConfig[]>([]);
  const [robotCategories, setRobotCategories] = useState<Readonly<Record<RobotId, RobotCategory>>>({
    sentry: 'sentry',
    infantry: 'infantry',
    hero: 'hero',
  });
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [sidebarResizing, setSidebarResizing] = useState(false);
  const [dataSidebarResizing, setDataSidebarResizing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const sidebarResizingRef = useRef(false);
  const sidebarDragStart = useRef({ pointerX: 0, width: DEFAULT_SIDEBAR_WIDTH });
  const expandedSidebarWidthRef = useRef(DEFAULT_SIDEBAR_WIDTH);
  const dataSidebarResizingRef = useRef(false);
  const dataSidebarDragStart = useRef({ pointerX: 0, width: 0 });
  const [camera, setCamera] = useState<CameraState>({
    targetXM: ARCC_2026_FIELD.size.lengthM / 2,
    targetYM: ARCC_2026_FIELD.size.widthM / 2,
    zoom: 1,
    followRobot: false,
  });
  const { replay, robot, seek, togglePlaying, setSpeed } = useReplay();
  const robotModels = useRobotModels();
  const { state: fieldOverlayWorkspace, dispatch: dispatchFieldOverlay } = useFieldOverlayWorkspace();
  const categorizedRobot = useMemo(() => ({
    ...robot,
    category: robotCategories[robot.robotId],
  }), [robot, robotCategories]);
  const fieldOverlays = useMemo(() => resolveFieldOverlays(
    fieldOverlayWorkspace.items,
    odometryDebugAt(replay.currentTimeS),
  ), [fieldOverlayWorkspace.items, replay.currentTimeS]);

  useEffect(() => {
    const windowState = window.knightSim?.windowState;
    if (!windowState) return;

    let active = true;
    void windowState.isFullScreen().then((nextIsFullScreen) => {
      if (active) setIsFullScreen(nextIsFullScreen);
    });
    const unsubscribe = windowState.onFullScreenChange(setIsFullScreen);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    setSidebarWidth((currentWidth) => (
      currentWidth < COMPACT_SIDEBAR_WIDTH ? minSidebarWidth : currentWidth
    ));
  }, [minSidebarWidth]);

  const startSidebarResize = useCallback((pointerX: number) => {
    sidebarDragStart.current = { pointerX, width: sidebarWidth };
    sidebarResizingRef.current = true;
    setSidebarResizing(true);
  }, [sidebarWidth]);

  const resizeSidebar = useCallback((pointerX: number) => {
    if (!sidebarResizingRef.current) return;
    const nextWidth = sidebarDragStart.current.width + pointerX - sidebarDragStart.current.pointerX;
    setSidebarWidth(clamp(nextWidth, minSidebarWidth, MAX_SIDEBAR_WIDTH));
  }, [minSidebarWidth]);

  const stopSidebarResize = useCallback(() => {
    if (!sidebarResizingRef.current) return;
    sidebarResizingRef.current = false;
    setSidebarWidth((currentWidth) => {
      if (currentWidth < COMPACT_SIDEBAR_WIDTH) return minSidebarWidth;
      expandedSidebarWidthRef.current = currentWidth;
      return currentWidth;
    });
    setSidebarResizing(false);
  }, [minSidebarWidth]);

  const toggleSidebar = useCallback(() => {
    setSidebarWidth((currentWidth) => {
      if (currentWidth < COMPACT_SIDEBAR_WIDTH) return expandedSidebarWidthRef.current;
      expandedSidebarWidthRef.current = currentWidth;
      return minSidebarWidth;
    });
  }, [minSidebarWidth]);

  const startDataSidebarResize = useCallback((pointerX: number) => {
    dataSidebarDragStart.current = { pointerX, width: fieldOverlayWorkspace.sidebarWidth };
    dataSidebarResizingRef.current = true;
    setDataSidebarResizing(true);
  }, [fieldOverlayWorkspace.sidebarWidth]);

  const resizeDataSidebar = useCallback((pointerX: number) => {
    if (!dataSidebarResizingRef.current) return;
    const nextWidth = dataSidebarDragStart.current.width
      + dataSidebarDragStart.current.pointerX
      - pointerX;
    dispatchFieldOverlay({ type: 'set-sidebar-width', width: nextWidth });
  }, [dispatchFieldOverlay]);

  const stopDataSidebarResize = useCallback(() => {
    if (!dataSidebarResizingRef.current) return;
    dataSidebarResizingRef.current = false;
    dispatchFieldOverlay({ type: 'finish-sidebar-resize' });
    setDataSidebarResizing(false);
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
      const platform = window.knightSim?.platform ?? 'win32';
      if (isRightSidebarShortcut(event, platform)) {
        event.preventDefault();
        dispatchFieldOverlay({ type: 'toggle-sidebar' });
      } else if (isLeftSidebarShortcut(event, platform)) {
        event.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dispatchFieldOverlay, toggleSidebar]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    return () => window.cancelAnimationFrame(frame);
  }, [activeView, fieldOverlayWorkspace.sidebarWidth]);

  const resizeSidebarByKeyboard = useCallback((nextWidth: number) => {
    setSidebarWidth(clamp(nextWidth, minSidebarWidth, MAX_SIDEBAR_WIDTH));
  }, [minSidebarWidth]);

  const resizeDataSidebarByKeyboard = useCallback((nextWidth: number) => {
    dispatchFieldOverlay({ type: 'set-sidebar-width', width: nextWidth });
    dispatchFieldOverlay({ type: 'finish-sidebar-resize' });
  }, [dispatchFieldOverlay]);

  const addControllerInput = useCallback((id: string) => {
    const descriptor = controllerInputById(id);
    if (!descriptor) return;
    setControllerInputIds((current) => [
      ...current.filter((currentId) => controllerInputById(currentId)?.control !== descriptor.control),
      descriptor.id,
    ]);
    setActiveView('controller');
  }, []);

  const addGraphSignal = useCallback((id: string) => {
    if (!graphSignalById(id)) return;
    setGraphSignals((current) => current.some((item) => item.id === id)
      ? current
      : [...current, { id, colorCategory: defaultGraphColorCategory(current.length) }]);
    setActiveView('graph');
  }, []);

  const setGraphSignalColor = useCallback((id: string, colorCategory: GraphColorCategory) => {
    setGraphSignals((current) => current.map((item) => (
      item.id === id ? { ...item, colorCategory } : item
    )));
  }, []);

  return (
    <div
      className={[
        'app-shell',
        usesWindowsSidebarLayout && 'app-shell-windows',
        sidebarResizing && 'sidebar-is-resizing',
        dataSidebarResizing && 'data-sidebar-is-resizing',
      ].filter(Boolean).join(' ')}
      style={{
        '--sidebar-width': `${sidebarWidth}px`,
        '--data-sidebar-width': `${fieldOverlayWorkspace.sidebarWidth}px`,
      } as React.CSSProperties}
    >
      <Sidebar
        compact={sidebarWidth < COMPACT_SIDEBAR_WIDTH}
        maxWidth={MAX_SIDEBAR_WIDTH}
        minWidth={minSidebarWidth}
        robot={categorizedRobot}
        currentTimeS={replay.currentTimeS}
        width={sidebarWidth}
        onAddControllerInput={addControllerInput}
        onAddGraphSignal={addGraphSignal}
        onAddFieldOverlay={(id) => {
          dispatchFieldOverlay({ type: 'add', id });
          dispatchFieldOverlay({ type: 'expand-sidebar' });
          setActiveView('2d');
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
            <Field2D robot={categorizedRobot} camera={camera} overlays={fieldOverlays} onCameraChange={setCamera} />
          </div>
          <div
            className={activeView === '3d' ? 'workspace-view workspace-view-active' : 'workspace-view'}
            aria-hidden={activeView !== '3d'}
          >
            <Field3D robot={categorizedRobot} camera={camera} overlays={fieldOverlays} model={robotModels.modelForRobot(robot.robotId)} />
          </div>
          <div
            className={activeView === 'graph' ? 'workspace-view workspace-view-active' : 'workspace-view'}
            aria-hidden={activeView !== 'graph'}
          >
            <LineGraph
              replay={replay}
              signals={graphSignals}
              onAddSignal={addGraphSignal}
              onClearSignals={() => setGraphSignals([])}
              onRemoveSignal={(id) => setGraphSignals((current) => current.filter((item) => item.id !== id))}
              onSeek={seek}
            />
          </div>
          <div
            className={activeView === 'controller' ? 'workspace-view workspace-view-active' : 'workspace-view'}
            aria-hidden={activeView !== 'controller'}
          >
            <ControllerView currentTimeS={replay.currentTimeS} selectedInputIds={controllerInputIds} />
          </div>
        </main>
        <Timeline replay={replay} onSeek={seek} onTogglePlaying={togglePlaying} onSpeedChange={setSpeed} />
      </div>
      <DataSidebar
        view={activeView}
          collapsed={isFieldSidebarCollapsed(fieldOverlayWorkspace.sidebarWidth)}
          controllerInputIds={controllerInputIds}
          currentTimeS={replay.currentTimeS}
          graphSignals={graphSignals}
          maxWidth={MAX_FIELD_SIDEBAR_WIDTH}
          minWidth={COLLAPSED_FIELD_SIDEBAR_WIDTH}
          overlays={fieldOverlays}
          robot={categorizedRobot}
          width={fieldOverlayWorkspace.sidebarWidth}
          onAddControllerInput={addControllerInput}
          onAddGraphSignal={addGraphSignal}
          onAddOverlay={(id) => dispatchFieldOverlay({ type: 'add', id })}
          onClearControllerInputs={() => setControllerInputIds([])}
          onClearGraphSignals={() => setGraphSignals([])}
          onClearOverlays={() => dispatchFieldOverlay({ type: 'clear-all' })}
          onCollapse={() => dispatchFieldOverlay({ type: 'toggle-sidebar' })}
          onExpand={() => dispatchFieldOverlay({ type: 'expand-sidebar' })}
          onHideAllOverlays={() => dispatchFieldOverlay({ type: 'hide-all' })}
          onMoveOverlay={(id, direction) => dispatchFieldOverlay({ type: 'move', id, direction })}
          onRemoveControllerInput={(id) => setControllerInputIds((current) => current.filter((currentId) => currentId !== id))}
          onRemoveGraphSignal={(id) => setGraphSignals((current) => current.filter((item) => item.id !== id))}
          onRemoveOverlay={(id) => dispatchFieldOverlay({ type: 'remove', id })}
          onResize={resizeDataSidebar}
          onResizeEnd={stopDataSidebarResize}
          onResizeKeyboard={resizeDataSidebarByKeyboard}
          onResizeStart={startDataSidebarResize}
          onSetGraphColor={setGraphSignalColor}
          onSetRobotCategory={(category) => setRobotCategories((current) => ({
            ...current,
            [robot.robotId]: category,
          }))}
        onToggleOverlayVisibility={(id) => dispatchFieldOverlay({ type: 'toggle-visibility', id })}
      />
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
