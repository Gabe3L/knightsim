import { useEffect, useState } from 'react';

const DEMO_MODE_STORAGE_KEY = 'knightsim:demo-mode:v1';

function loadDemoMode(): boolean {
  try {
    // Keep the existing demo experience on first launch, then remember either choice.
    return window.localStorage.getItem(DEMO_MODE_STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function useDemoMode() {
  const [demoEnabled, setDemoEnabled] = useState(loadDemoMode);

  useEffect(() => {
    try {
      window.localStorage.setItem(DEMO_MODE_STORAGE_KEY, String(demoEnabled));
    } catch {
      // The toggle still works for this session if storage is unavailable.
    }
  }, [demoEnabled]);

  return { demoEnabled, setDemoEnabled };
}
