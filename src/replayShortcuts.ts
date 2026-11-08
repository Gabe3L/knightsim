import { REPLAY_KEYBINDINGS } from './keybindings';
import type { ReplayState } from './types';

interface ReplayShortcutOptions {
  readonly disabled: boolean;
  readonly replay: ReplayState;
  readonly onSeek: (timeS: number) => void;
  readonly onTogglePlaying: () => void;
}

export function handleReplayShortcut(event: KeyboardEvent, options: ReplayShortcutOptions): void {
  if (event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
  const binding = REPLAY_KEYBINDINGS.find(({ codes }) => codes.includes(event.code));
  if (!binding) return;

  const target = event.target as HTMLElement | null;
  if (target?.isContentEditable || target?.closest?.(
    'input:not([type="range"]), textarea, [contenteditable="true"], [role="textbox"]',
  )) return;

  // Capture both key phases before focused controls can resize, scroll, change
  // their value, or activate a button on Space release.
  event.preventDefault();
  event.stopImmediatePropagation();
  if (options.disabled || event.type !== 'keydown') return;

  if (binding.action === 'toggle-playing') {
    if (!event.repeat) options.onTogglePlaying();
  } else {
    const stepS = event.code === 'ArrowUp' || event.code === 'ArrowDown' ? 0.5 : 5;
    const offsetS = binding.action === 'back' ? -stepS : stepS;
    options.onSeek(Math.max(0, Math.min(options.replay.durationS, options.replay.currentTimeS + offsetS)));
  }
}
