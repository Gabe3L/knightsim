import type { AppUpdater } from 'electron-updater';
import type { AppUpdateState } from './updateTypes.cjs';

type UpdateDriver = Pick<AppUpdater, 'autoDownload' | 'autoInstallOnAppQuit' | 'allowPrerelease'
  | 'checkForUpdates' | 'downloadUpdate' | 'quitAndInstall' | 'on'>;

/** Only the main process owns the updater. A button click authorizes download and restart. */
export class UpdateManager {
  private state: AppUpdateState;
  private operationActive = false;
  private downloaded = false;

  constructor(
    private readonly driver: UpdateDriver,
    currentVersion: string,
    disabledReason: string | null,
    private readonly notify: (state: AppUpdateState) => void,
    private readonly scheduleInstall: (callback: () => void) => void = setImmediate,
  ) {
    this.state = {
      revision: 0,
      currentVersion,
      publishedAt: null,
      loadingPublishedAt: disabledReason === null,
      status: disabledReason ? 'disabled' : 'idle',
      availableVersion: null,
      downloadPercent: 0,
      message: disabledReason,
    };
    driver.autoDownload = false;
    driver.autoInstallOnAppQuit = false;
    driver.allowPrerelease = false;
    driver.on('error', () => this.fail());
    if (disabledReason) return;

    driver.on('update-available', (info) => {
      this.setState({ status: 'available', availableVersion: info.version, message: null });
    });
    driver.on('update-not-available', () => {
      this.setState({ status: 'up-to-date', availableVersion: null, message: null });
    });
    driver.on('download-progress', (progress) => {
      if (this.state.status !== 'downloading') return;
      const downloadPercent = Number.isFinite(progress.percent) ? Math.round(Math.max(0, Math.min(100, progress.percent))) : 0;
      if (downloadPercent !== this.state.downloadPercent) this.setState({ downloadPercent });
    });
    driver.on('update-downloaded', (info) => {
      this.downloaded = true;
      this.setState({ status: 'ready', availableVersion: info.version, downloadPercent: 100, message: null });
    });
    driver.on('update-cancelled', () => this.fail());
  }

  getState(): AppUpdateState { return this.state; }

  setPublishedAt(publishedAt: string | null): void {
    this.setState({ publishedAt, loadingPublishedAt: false });
  }

  private setState(patch: Partial<AppUpdateState>): void {
    this.state = { ...this.state, ...patch, revision: this.state.revision + 1 };
    this.notify(this.state);
  }

  private fail(): void {
    if (this.state.status === 'disabled') return;
    this.setState({ status: 'error', message: this.state.availableVersion
      ? 'Update failed. Check your connection and try again.'
      : 'Unable to check for updates. Retrying automatically.' });
  }

  async check(): Promise<AppUpdateState> {
    if (this.operationActive || this.downloaded || ['disabled', 'ready', 'installing'].includes(this.state.status)) return this.state;
    this.operationActive = true;
    // Keep a known update visible while a background check is pending or offline.
    this.setState({ status: 'checking', message: null });
    try {
      if (!await this.driver.checkForUpdates()) this.fail();
    } catch {
      this.fail();
    } finally {
      this.operationActive = false;
    }
    return this.state;
  }

  async install(): Promise<AppUpdateState> {
    if (this.operationActive || !this.state.availableVersion
      || !['available', 'ready', 'error'].includes(this.state.status)) return this.state;
    this.operationActive = true;
    try {
      if (this.downloaded) {
        this.setState({ status: 'ready', message: null });
      } else {
        this.setState({ status: 'downloading', downloadPercent: 0, message: null });
        await this.driver.downloadUpdate();
      }
      // A resolved download alone is insufficient: the verified download event must arrive first.
      if (!this.downloaded || this.state.status !== 'ready') {
        this.fail();
        return this.state;
      }
      this.setState({ status: 'installing', message: null });
      // Let IPC acknowledge the click before Electron closes its renderer windows.
      this.scheduleInstall(() => {
        try {
          this.driver.quitAndInstall(true, true);
        } catch {
          this.fail();
        }
      });
    } catch {
      this.fail();
    } finally {
      this.operationActive = false;
    }
    return this.state;
  }
}
