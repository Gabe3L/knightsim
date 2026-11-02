import { useId } from 'react';
import type { AlternativeControllerProps } from './DualSenseController';
import type { ControllerControl } from '../telemetry/controllerInputs';

// Xbox Series proportions, rendered with the same soft outlines and restrained
// shading as the DualSense. Only the hardware layout is asymmetric.
export function XboxController({
  inputClass, leftActive, leftMapped, leftX, leftY, mapped,
  rightActive, rightMapped, rightX, rightY,
}: AlternativeControllerProps) {
  const id = useId().replace(/:/g, '');
  const paint = (name: string) => `url(#${id}-${name})`;
  const stick = (side: string, cx: number, cy: number, x: number, y: number, isMapped: boolean, active: boolean) => (
    <g className={`remote-input xbox-stick${isMapped ? ' remote-input-mapped' : ''}${active ? ' remote-input-active' : ''}`} aria-label={`${side} joystick`}>
      <circle className="xbox-stick-surround" cx={cx} cy={cy} r="46" />
      <circle className="xbox-stick-socket" cx={cx} cy={cy} r="38" />
      <g transform={`translate(${cx + x * 12} ${cy - y * 12})`}>
        <circle className="xbox-stick-cap" r="31" fill={paint('stick')} />
        <circle className="xbox-stick-rim" r="26" />
        <circle className="xbox-stick-center" r="22" />
      </g>
    </g>
  );
  const buttons: readonly { control: ControllerControl; label: string; x: number; y: number; color: string }[] = [
    { control: 'record', label: 'Y', x: 515, y: 213, color: '#f3cf55' },
    { control: 'shutter', label: 'B', x: 552, y: 250, color: '#f1777f' },
    { control: 'return-home', label: 'A', x: 515, y: 287, color: '#81d68b' },
    { control: 'pause', label: 'X', x: 478, y: 250, color: '#76b8f3' },
  ];

  return (
    <svg className="controller-gamepad controller-gamepad-xbox" viewBox="0 0 720 600" role="img" aria-label="Xbox Wireless Controller input monitor">
      <defs>
        <linearGradient id={`${id}-shell`} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#414959" /><stop offset="1" stopColor="#2a3141" />
        </linearGradient>
        <linearGradient id={`${id}-grip`} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#303848" /><stop offset="1" stopColor="#242b3a" />
        </linearGradient>
        <radialGradient id={`${id}-stick`} cx="50%" cy="50%" r="65%">
          <stop stopColor="#465269" /><stop offset="1" stopColor="#30394c" />
        </radialGradient>
        <linearGradient id={`${id}-button`} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#343e50" /><stop offset="1" stopColor="#202737" />
        </linearGradient>
        <path id={`${id}-trigger`} d="M181 166 L184 142 Q208 126 245 132 L253 159 Z" />
        <path id={`${id}-bumper`} d="M166 183 Q177 151 214 148 L272 149 L278 170 Q221 165 178 194 Z" />
        <filter id={`${id}-shadow`} x="-25%" y="-25%" width="150%" height="165%">
          <feDropShadow dx="0" dy="10" stdDeviation="10" floodColor="#000" floodOpacity="0.4" />
        </filter>
      </defs>
      <ellipse className="remote-floor-shadow" cx="360" cy="494" rx="236" ry="19" />
      <g className="xbox-trigger" aria-hidden="true">
        <use href={`#${id}-trigger`} />
        <use href={`#${id}-trigger`} transform="translate(720 0) scale(-1 1)" />
      </g>
      <g className={inputClass('custom-1')} aria-label="LB bumper">
        <use className="xbox-bumper" href={`#${id}-bumper`} />
        <text className="xbox-bumper-label" x="220" y="160" textAnchor="middle">LB</text>
      </g>
      <g className={inputClass('custom-2')} aria-label="RB bumper">
        <use className="xbox-bumper" href={`#${id}-bumper`} transform="translate(720 0) scale(-1 1)" />
        <text className="xbox-bumper-label" x="500" y="160" textAnchor="middle">RB</text>
      </g>
      <g filter={paint('shadow')}>
        <path className="xbox-shell" fill={paint('shell')} d="M205 166 C233 146 277 150 312 153 Q360 158 408 153 C443 150 487 146 515 166 C549 189 571 235 584 282 L610 418 C617 454 605 478 582 482 C561 487 545 474 526 449 L474 405 Q463 393 441 394 H279 Q257 393 246 405 L194 449 C175 474 159 487 138 482 C115 478 103 454 110 418 L136 282 C149 235 171 189 205 166 Z" />
        <path className="xbox-grip" fill={paint('grip')} d="M139 283 Q162 327 212 349 L246 405 L194 449 C175 474 159 487 138 482 C115 478 103 454 110 418 Z" />
        <path className="xbox-grip" fill={paint('grip')} d="M581 283 Q558 327 508 349 L474 405 L526 449 C545 474 561 487 582 482 C605 478 617 454 610 418 Z" />
        <path className="xbox-shell-highlight" d="M204 174 C237 154 275 159 311 162 Q360 167 409 162 C445 159 483 154 516 174" />
        <path className="xbox-bottom-seam" d="M283 401 Q360 411 437 401" />
      </g>
      {stick('Left', 223, 247, leftX, leftY, leftMapped, leftActive)}
      {stick('Right', 430, 339, rightX, rightY, rightMapped, rightActive)}

      <g className={inputClass('gimbal-dial', mapped('gimbal-dial'))} aria-label="Hybrid directional pad" transform="translate(300 339)">
        <circle className="xbox-dpad-surround" r="47" />
        <path className="xbox-dpad" d="M-18 -40 H18 L40 -18 V18 L18 40 H-18 L-40 18 V-18 Z" />
        <path className="xbox-dpad-facet" d="M-18 -40 L-11 -14 L-40 -18 M18 -40 L11 -14 L40 -18 M40 18 L11 14 L18 40 M-18 40 L-11 14 L-40 18" />
        <path className="xbox-dpad-cross" d="M-11 -32 H11 V-11 H32 V11 H11 V32 H-11 V11 H-32 V-11 H-11 Z" />
      </g>
      {buttons.map(({ control, label, x, y, color }) => (
        <g className={inputClass(control)} aria-label={`${label} button`} transform={`translate(${x} ${y})`} key={control}>
          <circle className="xbox-face-seat" r="21" />
          <circle className="xbox-face-button" r="18" fill={paint('button')} />
          <text className="xbox-face-label" fill={color} textAnchor="middle" dominantBaseline="central">{label}</text>
        </g>
      ))}
      <g className={inputClass('power')} aria-label="Xbox button" transform="translate(360 197)">
        <circle className="xbox-home-button" r="21" />
        <circle className="xbox-home-disc" r="16" />
        <path className="xbox-logo" d="M-11 -11 Q-6 -15 0 -9 Q6 -15 11 -11 Q5 -10 0 -4 Q-5 -10 -11 -11 Z M-12 12 Q-10 2 0 -6 Q10 2 12 12 Q7 6 0 1 Q-7 6 -12 12 Z" />
      </g>
      <g aria-label="View button" transform="translate(325 258)">
        <circle className="xbox-menu-button" r="13" />
        <path className="xbox-icon" d="M-6 -5 H3 V3 H-6 Z M-2 -8 H7 V0" />
      </g>
      <g className={inputClass('flight-mode', mapped('flight-mode'))} aria-label="Menu button" transform="translate(395 258)">
        <circle className="xbox-menu-button" r="13" />
        <path className="xbox-icon" d="M-5 -4 H5 M-5 0 H5 M-5 4 H5" />
      </g>
      <g aria-label="Share button" transform="translate(360 290)">
        <rect className="xbox-menu-button" x="-11" y="-14" width="22" height="28" rx="10" />
        <path className="xbox-icon" d="M-5 1 V6 H5 V1 M0 2 V-6 M-3 -3 L0 -6 L3 -3" />
      </g>
    </svg>
  );
}
