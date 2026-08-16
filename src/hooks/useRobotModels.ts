import { useCallback, useEffect, useState } from 'react';
import type { RobotId, RobotModelLibrary, RobotModelOrientation, RobotModelRecord } from '../types';

const EMPTY_LIBRARY: RobotModelLibrary = {
  version: 2,
  modelIdByRobot: { sentry: null, infantry: null, hero: null },
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
    setBusy(true);
    setError(null);
    try {
      const next = await operation();
      if (next) setLibrary(next);
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setBusy(false);
    }
  }, []);

  const importModel = useCallback(async (robotId: RobotId): Promise<void> => {
    if (!api) {
      setError('Robot models can only be imported from the KnightSim desktop app.');
      return;
    }
    await run(() => api.import(robotId));
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

  const removeModel = useCallback(async (id: string): Promise<void> => {
    if (api) await run(() => api.remove(id));
  }, [api, run]);

  const clearError = useCallback(() => setError(null), []);
  const modelForRobot = useCallback((robotId: RobotId): RobotModelRecord | null => {
    const modelId = library.modelIdByRobot[robotId];
    return library.models.find((model) => model.id === modelId) ?? null;
  }, [library]);

  return {
    available: Boolean(api),
    busy,
    clearError,
    error,
    importModel,
    library,
    loading,
    modelForRobot,
    removeModel,
    setRobotModel,
    updateOrientation,
  };
}
