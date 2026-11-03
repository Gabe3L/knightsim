import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RobotId, RobotModelLibrary, RobotModelOrientation, RobotModelRecord } from '../types';

const EMPTY_LIBRARY: RobotModelLibrary = {
  version: 3,
  directory: './models',
  isDefaultDirectory: true,
  directoryMissing: false,
  issues: [],
  modelIdByRobot: {},
  models: [],
};

const errorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message.replace(/^Error invoking remote method '[^']+': Error: /, '');
  return 'The robot model operation could not be completed.';
};

export function useRobotModels() {
  const api = window.knightSim?.robotModels;
  const [library, setLibrary] = useState<RobotModelLibrary>(EMPTY_LIBRARY);
  const [loading, setLoading] = useState(Boolean(api));
  const [busy, setBusy] = useState(false);
  const pendingCount = useRef(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!api) {
      setLoading(false);
      return undefined;
    }
    api.list()
      .then((next) => {
        if (active) setLibrary(next);
      })
      .catch((nextError: unknown) => {
        if (active) setError(errorMessage(nextError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [api]);

  const run = useCallback(async (
    operation: () => Promise<RobotModelLibrary | null>,
  ): Promise<void> => {
    pendingCount.current += 1;
    setBusy(true);
    setError(null);
    try {
      const next = await operation();
      if (next) setLibrary(next);
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      pendingCount.current -= 1;
      setBusy(pendingCount.current > 0);
    }
  }, []);

  const refreshModels = useCallback(async (): Promise<void> => {
    if (api) await run(() => api.list());
  }, [api, run]);

  const chooseDirectory = useCallback(async (): Promise<void> => {
    if (!api) {
      setError('Model folders are available in the KnightSim desktop app.');
      return;
    }
    await run(() => api.chooseDirectory());
  }, [api, run]);

  const resetDirectory = useCallback(async (): Promise<void> => {
    if (api) await run(() => api.resetDirectory());
  }, [api, run]);

  const setRobotModel = useCallback(async (robotId: RobotId, id: string | null): Promise<void> => {
    if (api) await run(() => api.setForRobot(robotId, id));
  }, [api, run]);

  const updateOrientation = useCallback(async (
    id: string,
    orientation: RobotModelOrientation,
  ): Promise<void> => {
    if (api) await run(() => api.updateOrientation(id, orientation));
  }, [api, run]);

  const clearError = useCallback(() => setError(null), []);
  const modelsById = useMemo(() => new Map(library.models.map((model) => [model.id, model])), [library.models]);
  const modelForRobot = useCallback((robotId: RobotId): RobotModelRecord | null => {
    const modelId = library.modelIdByRobot[robotId];
    return modelId ? modelsById.get(modelId) ?? null : null;
  }, [library.modelIdByRobot, modelsById]);

  return {
    available: Boolean(api),
    busy,
    clearError,
    error,
    chooseDirectory,
    library,
    loading,
    modelForRobot,
    refreshModels,
    resetDirectory,
    setRobotModel,
    updateOrientation,
  };
}
