import { useEffect, useState } from 'react';
import { Download, LoaderCircle, RefreshCw } from 'lucide-react';
import type { AppUpdateState } from '../../electron/updateTypes.cjs';

const INITIAL_STATE: AppUpdateState = {
  revision: -1,
  currentVersion: __APP_VERSION__,
  publishedAt: null,
  loadingPublishedAt: false,
  status: 'disabled',
  availableVersion: null,
  downloadPercent: 0,
  message: 'Updates are available in the installed app.',
};

export function AppUpdate() {
  const [state, setState] = useState(INITIAL_STATE);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const acceptState = (next: AppUpdateState): void => {
    setState((current) => next.revision >= current.revision ? next : current);
  };

  useEffect(() => {
    const api = window.knightSim?.updates;
    if (!api) return;
    let active = true;
    const receive = (next: AppUpdateState): void => { if (active) acceptState(next); };
    const unsubscribe = api.onChange(receive);
    void api.getState().then(receive).catch(() => {
      if (active) setConnectionError('Unable to connect to the updater. Restart the app to try again.');
    });
    return () => { active = false; unsubscribe(); };
  }, []);

  const busy = ['checking', 'downloading', 'installing'].includes(state.status);
  const canInstall = state.availableVersion !== null;
  // The updater offers one cumulative app update, even if several versions were skipped.
  const updateCount = canInstall ? 1 : 0;
  const label = state.status === 'checking' ? 'Checking for updates…'
    : state.status === 'downloading' ? `Downloading… ${state.downloadPercent}%`
      : state.status === 'installing' ? 'Restarting…'
        : canInstall ? (state.status === 'error' ? 'Retry update & restart' : 'Update & restart')
          : state.status === 'error' ? 'Update check failed. Retrying automatically.'
            : state.status === 'up-to-date' ? 'You’re up to date.' : 'Updates are checked automatically.';
  const accessibleLabel = updateCount ? `${updateCount} update available. ${label}` : label;
  const publishedDate = state.publishedAt ? new Date(state.publishedAt) : null;
  const publishedLabel = publishedDate ? `Published ${publishedDate.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short',
  })}` : state.loadingPublishedAt ? 'Loading publish date…'
    : state.status === 'disabled' ? 'Development build' : 'Publish date unavailable';
  const message = connectionError ?? state.message
    ?? (state.status === 'downloading' || state.status === 'installing' ? label
      : canInstall ? `${updateCount} update available: version ${state.availableVersion}. Click to update and restart.` : null);
  const title = [`KnightSim ${state.currentVersion}`, publishedLabel, message, label].filter(Boolean).join('\n');

  const handleUpdate = async (): Promise<void> => {
    const api = window.knightSim?.updates;
    if (!api || !canInstall || busy) return;
    setConnectionError(null);
    try {
      acceptState(await api.install());
    } catch {
      setConnectionError('Unable to connect to the updater. Try again.');
    }
  };

  return (
    <div className="sidebar-update" title={title}>
      <div className="sidebar-version">
        <span>KnightSim {state.currentVersion}</span>
        {publishedDate ? <time dateTime={state.publishedAt!} title={publishedDate.toISOString()}>{publishedLabel}</time>
          : <span className="sidebar-published-at">{publishedLabel}</span>}
      </div>
      <button
        className={`sidebar-settings sidebar-update-button${canInstall ? ' update-available' : ''}`}
        type="button"
        aria-label={accessibleLabel}
        disabled={busy || !canInstall}
        onClick={() => void handleUpdate()}
      >
        <span className="sidebar-update-icon" aria-hidden="true">
          {busy ? <LoaderCircle className="update-spinner" size={17} />
            : canInstall ? <Download size={17} /> : <RefreshCw size={17} />}
          {updateCount > 0 && <span className="sidebar-update-badge">{updateCount}</span>}
        </span>
      </button>
      <div className={`sidebar-update-message${state.status === 'error' || connectionError ? ' update-error' : ''}`} role="status" aria-live="polite">
        {message}
      </div>
    </div>
  );
}
