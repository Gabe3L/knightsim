import { useId } from 'react';
import type { ControllerControl } from '../telemetry/controllerInputs';

export interface AlternativeControllerProps {
  readonly inputClass: (control: ControllerControl, active?: boolean) => string;
  readonly leftActive: boolean;
  readonly leftMapped: boolean;
  readonly leftX: number;
  readonly leftY: number;
  readonly mapped: (...controls: readonly ControllerControl[]) => boolean;
  readonly rightActive: boolean;
  readonly rightMapped: boolean;
  readonly rightX: number;
  readonly rightY: number;
}

// Stylized front elevation of the white DualSense. Paired hardware mirrors
// around x=360; vertical shading keeps the neutral illustration evenly lit.
export function DualSenseController({
  inputClass, leftActive, leftMapped, leftX, leftY, mapped,
  rightActive, rightMapped, rightX, rightY,
}: AlternativeControllerProps) {
  const id = useId().replace(/:/g, '');
  const paint = (name: string) => `url(#${id}-${name})`;
  const stick = (side: 'Left' | 'Right', cx: number, x: number, y: number, isMapped: boolean, active: boolean) => (
    <g className={`remote-input dualsense-stick${isMapped ? ' remote-input-mapped' : ''}${active ? ' remote-input-active' : ''}`} aria-label={`${side} joystick`}>
      <circle className="dualsense-stick-surround" cx={cx} cy="333" r="45" />
      <circle className="dualsense-stick-socket" cx={cx} cy="333" r="37" fill={paint('socket')} />
      <g transform={`translate(${cx + x * 12} ${333 - y * 12})`}>
        <circle className="dualsense-stick-cap" r="29" fill={paint('stick')} />
        <circle className="dualsense-stick-rim" r="25.5" />
        <circle className="dualsense-stick-center" r="21" />
      </g>
    </g>
  );
  const faceButtons: readonly { control: ControllerControl; name: string; x: number; y: number; symbol: string }[] = [
    { control: 'record', name: 'Triangle', x: 526, y: 202, symbol: 'M-10 8 L0 -10 L10 8 Z' },
    { control: 'shutter', name: 'Circle', x: 564, y: 240, symbol: 'M10 0 A10 10 0 1 1 -10 0 A10 10 0 1 1 10 0' },
    { control: 'return-home', name: 'Cross', x: 526, y: 278, symbol: 'M-8 -8 L8 8 M8 -8 L-8 8' },
    { control: 'pause', name: 'Square', x: 488, y: 240, symbol: 'M-8 -8 H8 V8 H-8 Z' },
  ];

  return (
    <svg className="controller-gamepad controller-gamepad-ps5" viewBox="0 0 720 600" role="img" aria-label="PlayStation 5 DualSense controller input monitor">
      <defs>
        <linearGradient id={`${id}-shell`} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#f8f9ff" /><stop offset="1" stopColor="#dce1ed" />
        </linearGradient>
        <linearGradient id={`${id}-touchpad`} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#eef1fa" /><stop offset="1" stopColor="#dce2f0" />
        </linearGradient>
        <linearGradient id={`${id}-trim`} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#303646" /><stop offset="1" stopColor="#222838" />
        </linearGradient>
        <radialGradient id={`${id}-socket`} cx="50%" cy="50%" r="65%">
          <stop stopColor="#161c29" /><stop offset="1" stopColor="#303849" />
        </radialGradient>
        <radialGradient id={`${id}-stick`} cx="50%" cy="50%" r="80%">
          <stop stopColor="#424c60" /><stop offset="1" stopColor="#30394c" />
        </radialGradient>
        <linearGradient id={`${id}-button`} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#f7f9ff" /><stop offset="1" stopColor="#e0e6f2" />
        </linearGradient>
        <path id={`${id}-trigger`} d="M170 159 L174 132 Q200 117 231 123 L238 153 Z" />
        <path id={`${id}-shoulder`} d="M163 166 L169 145 Q199 129 239 135 L244 158 Z" />
        <filter id={`${id}-shadow`} x="-25%" y="-25%" width="150%" height="165%">
          <feDropShadow dx="0" dy="10" stdDeviation="10" floodColor="#000" floodOpacity="0.4" />
        </filter>
      </defs>
      <ellipse className="remote-floor-shadow" cx="360" cy="499" rx="247" ry="19" />

      <g fill={paint('trim')} stroke="#090b10" strokeWidth="2">
        <use href={`#${id}-trigger`} />
        <use href={`#${id}-trigger`} transform="translate(720 0) scale(-1 1)" />
      </g>
      <g className={inputClass('custom-1')} aria-label="L1 shoulder button">
        <use className="dualsense-shoulder" href={`#${id}-shoulder`} />
        <text className="dualsense-shoulder-label" x="203" y="149" textAnchor="middle">L1</text>
      </g>
      <g className={inputClass('custom-2')} aria-label="R1 shoulder button">
        <use className="dualsense-shoulder" href={`#${id}-shoulder`} transform="translate(720 0) scale(-1 1)" />
        <text className="dualsense-shoulder-label" x="517" y="149" textAnchor="middle">R1</text>
      </g>

      <g filter={paint('shadow')}>
        <path className="dualsense-shell" fill={paint('shell')} d="M181 150 C225 133 278 135 313 137 H407 C442 135 495 133 539 150 C561 160 580 207 594 254 C612 312 630 395 619 449 C616 470 606 486 588 488 L556 487 C535 447 518 408 495 384 C484 374 474 377 459 378 H261 C246 377 236 374 225 384 C202 408 185 447 164 487 L132 488 C114 486 104 470 101 449 C90 395 108 312 126 254 C140 207 159 160 181 150 Z" />
        <path className="dualsense-trim" fill={paint('trim')} d="M249 159 Q360 139 471 159 L458 250 C459 275 477 293 494 317 C526 363 552 423 578 487 L556 487 C535 447 518 408 495 384 C484 374 474 377 459 378 H261 C246 377 236 374 225 384 C202 408 185 447 164 487 L142 487 C168 423 194 363 226 317 C243 293 261 275 262 250 Z" />
        <path className="dualsense-shell-highlight" d="M181 153 Q219 139 249 142 M471 142 Q501 139 539 153" />
      </g>

      <path className="dualsense-light-bar" d="M253 153 L267 244 Q270 260 284 264 M467 153 L453 244 Q450 260 436 264" />
      <g aria-label="Touchpad">
        <path className="dualsense-touchpad" fill={paint('touchpad')} d="M264 147 Q360 138 456 147 Q462 148 460 158 L447 246 Q445 257 432 258 H288 Q275 257 273 246 L260 158 Q258 148 264 147 Z" />
      </g>

      <g className={inputClass('gimbal-dial', mapped('gimbal-dial'))} aria-label="Directional pad">
        {[0, 90, 180, 270].map((angle) => (
          <g transform={`translate(194 240) rotate(${angle})`} key={angle}>
            <path className="dualsense-dpad-button" fill={paint('button')} d="M-13 -41 Q0 -46 13 -41 L13 -22 L0 -10 L-13 -22 Z" />
            <path className="dualsense-dpad-arrow" d="M-4 -30 L0 -34 L4 -30 Z" />
          </g>
        ))}
      </g>
      {faceButtons.map(({ control, name, x, y, symbol }) => (
        <g className={inputClass(control)} aria-label={`${name} button`} transform={`translate(${x} ${y})`} key={control}>
          <circle className="dualsense-face-seat" r="20" />
          <circle className="dualsense-face-button" r="17.5" fill={paint('button')} />
          <path className="dualsense-face-symbol" d={symbol} />
        </g>
      ))}

      <g aria-label="Create button" transform="rotate(-12 238 183)">
        <rect className="dualsense-small-button" x="233" y="172" width="10" height="24" rx="5" />
        <path className="dualsense-small-icon" d="M232 161 L228 157 M238 160 V154 M244 161 L248 157" />
      </g>
      <g className={inputClass('flight-mode', mapped('flight-mode'))} aria-label="Options button" transform="rotate(12 482 183)">
        <rect className="dualsense-small-button" x="477" y="172" width="10" height="24" rx="5" />
        <path className="dualsense-small-icon" d="M477 154 H487 M477 158 H487 M477 162 H487" />
      </g>

      <g className="dualsense-speaker" aria-label="Speaker">
        {[[-12, -4, 4, 12], [-9, -3, 3, 9], [-6, 0, 6]].map((row, index) => row.map((x) => (
          <circle cx={360 + x} cy={278 + index * 6} r="1.8" key={`${index}-${x}`} />
        )))}
      </g>
      <g className="dualsense-player-indicator" aria-hidden="true">
        {[-12, -6, 0, 6, 12].map((x) => <rect x={359 + x} y="266" width="2" height="3" rx="1" key={x} />)}
      </g>
      {stick('Left', 274, leftX, leftY, leftMapped, leftActive)}
      {stick('Right', 446, rightX, rightY, rightMapped, rightActive)}

      <g className={inputClass('power')} aria-label="PlayStation button" transform="translate(360 324) scale(0.7)">
        <path className="dualsense-ps-button" d="M-8 -14 L3 -10 Q12 -7 11 0 Q10 5 4 3 V-5 L0 -7 V15 L-8 12 Z M-11 2 L-18 5 Q-25 9 -15 12 L-11 13 V8 L-16 7 L-11 5 Z M4 7 L14 3 Q22 2 24 6 Q27 10 17 13 L4 17 V12 L17 8 L13 7 L4 10 Z" />
      </g>
      <g aria-label="Microphone mute button">
        <rect className="dualsense-mute-button" x="347" y="354" width="26" height="7" rx="3.5" />
        <path className="dualsense-microphone" d="M358 367 V371 Q360 374 362 371 V367 M355 370 Q355 376 360 376 Q365 376 365 370 M360 376 V379 M355 365 L365 378" />
      </g>
    </svg>
  );
}
