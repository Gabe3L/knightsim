export type UpdateStatus = 'disabled' | 'idle' | 'checking' | 'up-to-date' | 'available'
  | 'downloading' | 'ready' | 'installing' | 'error';

export interface AppUpdateState {
  readonly revision: number;
  readonly currentVersion: string;
  readonly publishedAt: string | null;
  readonly loadingPublishedAt: boolean;
  readonly status: UpdateStatus;
  readonly availableVersion: string | null;
  readonly downloadPercent: number;
  readonly message: string | null;
}
