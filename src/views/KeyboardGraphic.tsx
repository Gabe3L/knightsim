import { useId } from 'react';
import type { ControllerControl } from '../telemetry/controllerInputs';
import type { AlternativeControllerProps } from './DualSenseController';

interface Keycap {
  readonly label: string;
  readonly units?: number;
  readonly gap?: number;
}
const key = (label: string, units = 1): Keycap => ({ label, units });
const letters = (labels: string): Keycap[] => labels.split(' ').map((label) => key(label));
const rows: readonly (readonly Keycap[])[] = [
  [key('esc'), { label: 'F1', gap: .5 }, ...letters('F2 F3 F4'), { label: 'F5', gap: .25 }, ...letters('F6 F7 F8'), { label: 'F9', gap: .25 }, ...letters('F10 F11 F12'), { label: 'delete', gap: .25 }],
  [...letters('` 1 2 3 4 5 6 7 8 9 0 − ='), key('backspace', 2)],
  [key('tab', 1.5), ...letters('Q W E R T Y U I O P [ ]'), key('\\', 1.5)],
  [key('caps', 1.75), ...letters("A S D F G H J K L ; '"), key('enter', 2.25)],
  [key('shift', 2.25), ...letters('Z X C V B N M , . /'), key('shift', .75), key('↑')],
  [key('ctrl', 1.25), key('win', 1.25), key('alt', 1.25), key('space', 5.25), key('alt'), key('fn'), key('ctrl'), key('←'), key('↓'), key('→')],
];

export function KeyboardGraphic({ inputClass, leftX, leftY, mapped }: Pick<AlternativeControllerProps, 'inputClass' | 'leftX' | 'leftY' | 'mapped'>) {
  const id = useId().replace(/:/g, '');
  const controls: Readonly<Record<string, ControllerControl>> = {
    W: 'left-stick-y', A: 'left-stick-x', S: 'left-stick-y', D: 'left-stick-x',
    R: 'record', F: 'shutter', H: 'return-home', P: 'pause',
    shift: 'custom-1', space: 'power', ctrl: 'custom-2',
  };
  const keyState = (label: string): string => {
    const control = controls[label];
    if (!control) return '';
    const directions: Readonly<Record<string, boolean>> = {
      W: leftY > .06, A: leftX < -.06, S: leftY < -.06, D: leftX > .06,
    };
    return inputClass(control, label in directions ? mapped(control) && directions[label] : undefined);
  };
  return (
    <svg className="kbm-keyboard" viewBox="0 0 756 350" aria-label="Compact mechanical keyboard with staggered keys">
      <defs>
        <linearGradient id={`${id}-case`} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#414959" /><stop offset="1" stopColor="#2a3141" />
        </linearGradient>
        <linearGradient id={`${id}-cap`} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#f7f9ff" /><stop offset="1" stopColor="#e0e6f2" />
        </linearGradient>
      </defs>
      <rect className="keyboard-case-edge" x="8" y="14" width="740" height="326" rx="22" />
      <rect className="keyboard-case" x="8" y="6" width="740" height="326" rx="22" fill={`url(#${id}-case)`} />
      <path className="keyboard-case-highlight" d="M30 13 H726" />
      <rect className="keyboard-plate" x="24" y="24" width="708" height="286" rx="11" />
      {rows.map((row, rowIndex) => {
        let unit = 0;
        return row.map(({ label, units = 1, gap = 0 }, index) => {
          unit += gap;
          const x = 32 + unit * 46;
          const y = 32 + rowIndex * 44 + (rowIndex > 0 ? 8 : 0);
          const width = units * 46 - 5;
          unit += units;
          const modifier = label.length > 1 && !/^F\d+$/.test(label) && label !== 'space';
          const tone = modifier || /^F\d+$/.test(label) || '↑←↓→'.includes(label) || ['W', 'A', 'S', 'D'].includes(label) ? ' keyboard-key-slate' : '';
          return (
            <g className={`keyboard-key${tone} ${keyState(label)}`} transform={`translate(${x} ${y})`} aria-label={`${label} key`} key={`${rowIndex}-${index}`}>
              <rect className="keyboard-key-side" y="3" width={width} height="37" rx="6" />
              <rect className="keyboard-key-top" width={width} height="34" rx="6" fill={`url(#${id}-cap)`} />
              <path className="keyboard-key-highlight" d={`M6 4 H${width - 6}`} />
              <text className={`keyboard-key-legend${label.length > 2 ? ' keyboard-key-legend-small' : ''}`} x="8" y="15">{label}</text>
              {['F', 'J'].includes(label) ? <path className="keyboard-homing-bar" d={`M${width / 2 - 4} 27 h8`} /> : null}
            </g>
          );
        });
      })}
      <g className="keyboard-case-detail" aria-hidden="true">
        <path d="M34 321 H94" />
        <circle cx="684" cy="321" r="2.5" /><circle cx="698" cy="321" r="2.5" />
        <path d="M714 318 L718 321 L714 324 L710 321 Z" />
      </g>
    </svg>
  );
}
