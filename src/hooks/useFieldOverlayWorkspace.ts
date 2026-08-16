import { useEffect, useReducer } from 'react';
import {
  FIELD_OVERLAY_STORAGE_KEY,
  defaultFieldOverlayWorkspaceState,
  fieldOverlayWorkspaceReducer,
  parseFieldOverlayWorkspace,
} from '../overlays/fieldOverlays';

function loadWorkspace() {
  try {
    return parseFieldOverlayWorkspace(JSON.parse(
      window.localStorage.getItem(FIELD_OVERLAY_STORAGE_KEY) ?? 'null',
    ));
  } catch {
    return defaultFieldOverlayWorkspaceState();
  }
}

export function useFieldOverlayWorkspace() {
  const [state, dispatch] = useReducer(fieldOverlayWorkspaceReducer, undefined, loadWorkspace);

  useEffect(() => {
    window.localStorage.setItem(FIELD_OVERLAY_STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  return { state, dispatch };
}
