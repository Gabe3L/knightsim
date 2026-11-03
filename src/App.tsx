import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { SettingsDialog } from './components/SettingsDialog';
import { Timeline } from './components/Timeline';
import { TopBar } from './components/TopBar';
import { ARCC_2027_3V3_FIELD } from './field/fieldSpec';
import { FIELD_ROBOT_IDS, fieldRobotsAt } from './field/fieldRobots';
import { useReplay } from './hooks/useReplay';
import { useDemoMode } from './hooks/useDemoMode';
import { useFieldOverlayWorkspace } from './hooks/useFieldOverlayWorkspace';
import { useRobotModels } from './hooks/useRobotModels';
import {
  isLeftSidebarShortcut,
  resolveFieldOverlays,
} from './overlays/fieldOverlays';
import { odometryDebugAt } from './telemetry/odometryDebug';
import { controllerInputById } from './telemetry/controllerInputs';
import {
  defaultGraphColorCategory,
  graphSignalById,
  type GraphSignalConfig,
} from './telemetry/graphSignals';
import type { CameraState, ControllerMode, FieldMode, RobotId, ViewMode } from './types';
import { Field } from './views/Field';
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
const DEFAULT_CAMERA: CameraState = {
  targetXM: ARCC_2027_3V3_FIELD.size.lengthM / 2,
  targetYM: ARCC_2027_3V3_FIELD.size.widthM / 2,
  zoom: 1,
};

export function App() {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const usesWindowsSidebarLayout = isWindows || (isMac && isFullScreen);
  const minSidebarWidth = usesWindowsSidebarLayout
    ? COMPACT_SIDEBAR_WIDTH_WITHOUT_WINDOW_CONTROLS
    : COMPACT_SIDEBAR_WIDTH_WITH_WINDOW_CONTROLS;
  const [activeView, setActiveView] = useState<ViewMode>('field');
  const [fieldMode, setFieldMode] = useState<FieldMode>('3v3');
  const [controllerMode, setControllerMode] = useState<ControllerMode>('dji');
  const [controllerInputIds, setControllerInputIds] = useState<readonly string[]>([]);
  const [graphSignals, setGraphSignals] = useState<readonly GraphSignalConfig[]>([]);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [sidebarResizing, setSidebarResizing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const sidebarResizingRef = useRef(false);
  const sidebarDragStart = useRef({ pointerX: 0, width: DEFAULT_SIDEBAR_WIDTH });
  const expandedSidebarWidthRef = useRef(DEFAULT_SIDEBAR_WIDTH);
  const [robotId, setRobotId] = useState<RobotId>('sentry');
  const { demoEnabled, setDemoEnabled } = useDemoMode();
  const { replay, robot, seek, togglePlaying, setSpeed } = useReplay(robotId, demoEnabled);
  const robotModels = useRobotModels();
  const fieldRobots = useMemo(() => fieldRobotsAt(replay.currentTimeS, fieldMode, demoEnabled),
    [replay.currentTimeS, fieldMode, demoEnabled]);
  const changeFieldMode = (mode: FieldMode): void => {
    setFieldMode(mode);
    setRobotId((current) => FIELD_ROBOT_IDS[mode].includes(current) ? current : FIELD_ROBOT_IDS[mode][0]!);
  };
  const { state: fieldOverlayWorkspace, dispatch: dispatchFieldOverlay } = useFieldOverlayWorkspace();
  const fieldOverlays = useMemo(() => resolveFieldOverlays(
    fieldOverlayWorkspace.items,
    demoEnabled ? odometryDebugAt(replay.currentTimeS) : [],
  ), [fieldOverlayWorkspace.items, replay.currentTimeS, demoEnabled]);

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
      if (isLeftSidebarShortcut(event, platform)) {
        event.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleSidebar]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    return () => window.cancelAnimationFrame(frame);
  }, [activeView, sidebarWidth]);

  const resizeSidebarByKeyboard = useCallback((nextWidth: number) => {
    setSidebarWidth(clamp(nextWidth, minSidebarWidth, MAX_SIDEBAR_WIDTH));
  }, [minSidebarWidth]);

  const addGraphSignal = useCallback((id: string) => {
    if (!graphSignalById(id)) return;
    setGraphSignals((current) => current.some((item) => item.id === id)
      ? current
      : [...current, { id, colorCategory: defaultGraphColorCategory(current.length) }]);
    setActiveView('graph');
  }, []);

  const toggleControllerInput = useCallback((id: string) => {
    const descriptor = controllerInputById(id);
    if (!descriptor) return;
    setControllerInputIds((current) => current.includes(id)
      ? current.filter((currentId) => currentId !== id)
      : [
        ...current.filter((currentId) => controllerInputById(currentId)?.control !== descriptor.control),
        id,
      ]);
    setActiveView('controller');
  }, []);

  const toggleGraphSignal = useCallback((id: string) => {
    if (!graphSignalById(id)) return;
    setGraphSignals((current) => current.some((item) => item.id === id)
      ? current.filter((item) => item.id !== id)
      : [...current, { id, colorCategory: defaultGraphColorCategory(current.length) }]);
    setActiveView('graph');
  }, []);

  const toggleFieldOverlay = useCallback((id: string) => {
    dispatchFieldOverlay({ type: 'toggle-visibility', id });
    setActiveView('field');
  }, []);

  return (
    <div
      className={[
        'app-shell',
        usesWindowsSidebarLayout && 'app-shell-windows',
        sidebarResizing && 'sidebar-is-resizing',
      ].filter(Boolean).join(' ')}
      style={{
        '--sidebar-width': `${sidebarWidth}px`,
      } as React.CSSProperties}
    >
      <Sidebar
        compact={sidebarWidth < COMPACT_SIDEBAR_WIDTH}
        maxWidth={MAX_SIDEBAR_WIDTH}
        minWidth={minSidebarWidth}
        robot={robot}
        demoEnabled={demoEnabled}
        currentTimeS={replay.currentTimeS}
        width={sidebarWidth}
        controllerInputIds={controllerInputIds}
        graphSignalIds={graphSignals.map((signal) => signal.id)}
        overlays={fieldOverlays}
        onToggleControllerInput={toggleControllerInput}
        onToggleGraphSignal={toggleGraphSignal}
        onToggleFieldOverlay={toggleFieldOverlay}
        onOpenSettings={() => setSettingsOpen(true)}
        onResize={resizeSidebar}
        onResizeEnd={stopSidebarResize}
        onResizeKeyboard={resizeSidebarByKeyboard}
        onResizeStart={startSidebarResize}
      />
      <div className="app-main">
        <TopBar
          activeView={activeView}
          demoEnabled={demoEnabled}
          onDemoChange={setDemoEnabled}
          controllerMode={controllerMode}
          fieldMode={fieldMode}
          onControllerModeChange={setControllerMode}
          onFieldModeChange={changeFieldMode}
          onViewChange={setActiveView}
        />
        <main className="workspace">
          <div
            className={activeView === 'field' ? 'workspace-view workspace-view-active' : 'workspace-view'}
            aria-hidden={activeView !== 'field'}
          >
            <Field
              active={activeView === 'field' && !settingsOpen}
              robot={robot}
              camera={DEFAULT_CAMERA}
              mode={fieldMode}
              overlays={fieldOverlays}
              robots={fieldRobots}
              modelForRobot={robotModels.modelForRobot}
            />
          </div>
          <div
            className={activeView === 'graph' ? 'workspace-view workspace-view-active' : 'workspace-view'}
            aria-hidden={activeView !== 'graph'}
          >
            {activeView === 'graph' ? <LineGraph
              demoEnabled={demoEnabled}
              replay={replay}
              signals={graphSignals}
              onAddSignal={addGraphSignal}
              onSeek={seek}
            /> : null}
          </div>
          <div
            className={activeView === 'controller' ? 'workspace-view workspace-view-active' : 'workspace-view'}
            aria-hidden={activeView !== 'controller'}
          >
            {activeView === 'controller' ? <ControllerView
              demoEnabled={demoEnabled}
              controllerMode={controllerMode}
              currentTimeS={replay.currentTimeS}
              selectedInputIds={controllerInputIds}
            /> : null}
          </div>
        </main>
        <Timeline disabled={!demoEnabled} replay={replay} onSeek={seek} onTogglePlaying={togglePlaying} onSpeedChange={setSpeed} />
      </div>
      {settingsOpen ? (
        <SettingsDialog
          initialRobotId={robotId}
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
