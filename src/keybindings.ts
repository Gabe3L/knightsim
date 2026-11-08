export type ReplayAction = 'back' | 'forward' | 'toggle-playing';

interface ReplayKeybinding {
  readonly action: ReplayAction;
  readonly codes: readonly string[];
  readonly keys: readonly string[];
  readonly label: string;
  readonly description: string;
}

export const REPLAY_KEYBINDINGS: readonly ReplayKeybinding[] = [
  {
    action: 'back',
    codes: ['ArrowLeft', 'ArrowDown'],
    keys: ['←', '↓'],
    label: 'Scrub backward',
    description: 'Left rewinds five seconds; Down rewinds half a second.',
  },
  {
    action: 'forward',
    codes: ['ArrowRight', 'ArrowUp'],
    keys: ['→', '↑'],
    label: 'Scrub forward',
    description: 'Right advances five seconds; Up advances half a second.',
  },
  {
    action: 'toggle-playing',
    codes: ['Space'],
    keys: ['Space'],
    label: 'Play / pause',
    description: 'Toggle replay playback.',
  },
];

export type FieldCameraAction = 'forward' | 'back' | 'left' | 'right' | 'up' | 'down';

export interface FieldCameraKeybinding {
  readonly action: FieldCameraAction;
  readonly code: string;
  readonly key: string;
  readonly label: string;
  readonly description: string;
}

export const FIELD_CAMERA_KEYBINDINGS: readonly FieldCameraKeybinding[] = [
  {
    action: 'forward',
    code: 'KeyW',
    key: 'W',
    label: 'Fly camera forward',
    description: 'Move in the direction the camera is facing.',
  },
  {
    action: 'back',
    code: 'KeyS',
    key: 'S',
    label: 'Fly camera back',
    description: 'Move away from the direction the camera is facing.',
  },
  {
    action: 'left',
    code: 'KeyA',
    key: 'A',
    label: 'Fly camera left',
    description: 'Strafe left while keeping the current view direction.',
  },
  {
    action: 'right',
    code: 'KeyD',
    key: 'D',
    label: 'Fly camera right',
    description: 'Strafe right while keeping the current view direction.',
  },
  {
    action: 'up',
    code: 'KeyE',
    key: 'E',
    label: 'Fly camera up',
    description: 'Raise the camera vertically in world space.',
  },
  {
    action: 'down',
    code: 'KeyQ',
    key: 'Q',
    label: 'Fly camera down',
    description: 'Lower the camera vertically in world space.',
  },
];

const FIELD_CAMERA_ACTION_BY_CODE = new Map(
  FIELD_CAMERA_KEYBINDINGS.map(({ action, code }) => [code, action]),
);

export const fieldCameraActionForCode = (code: string): FieldCameraAction | null => (
  FIELD_CAMERA_ACTION_BY_CODE.get(code) ?? null
);
