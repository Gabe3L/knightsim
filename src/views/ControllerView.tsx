import { useMemo } from 'react';
import {
  controllerInputById,
  type ControllerControl,
  type ControllerInputDescriptor,
} from '../telemetry/controllerInputs';
import type { ControllerMode } from '../types';

interface ControllerViewProps {
  readonly controllerMode: ControllerMode;
  readonly currentTimeS: number;
  readonly selectedInputIds: readonly string[];
}

const classNames = (...values: Array<string | false>): string => values.filter(Boolean).join(' ');

interface AlternativeControllerProps {
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

function KeyboardMouseController({
  inputClass,
  leftX,
  leftY,
  mapped,
  rightActive,
  rightMapped,
  rightX,
  rightY,
}: AlternativeControllerProps) {
  const keyClass = (control: ControllerControl, active?: boolean): string => classNames(
    'kbm-key',
    inputClass(control, active === undefined ? undefined : mapped(control) && active),
  );

  return (
    <div className="kbm-controller" role="img" aria-label="Keyboard and mouse controller input monitor">
      <div className="kbm-keyboard">
        <div className="kbm-function-row">
          <span className={keyClass('record')}>R</span>
          <span className={keyClass('shutter')}>F</span>
          <span className={keyClass('return-home')}>H</span>
          <span className={keyClass('pause')}>P</span>
        </div>
        <div className="kbm-movement-grid">
          <span className={keyClass('left-stick-y', leftY > 0.06)}>W</span>
          <span className={keyClass('left-stick-x', leftX < -0.06)}>A</span>
          <span className={keyClass('left-stick-y', leftY < -0.06)}>S</span>
          <span className={keyClass('left-stick-x', leftX > 0.06)}>D</span>
        </div>
        <div className="kbm-bottom-row">
          <span className={keyClass('custom-1')}>SHIFT</span>
          <span className={keyClass('power')}>SPACE</span>
          <span className={keyClass('custom-2')}>CTRL</span>
        </div>
      </div>

      <svg className="kbm-mouse" viewBox="0 0 250 390" aria-hidden="true">
        <defs>
          <linearGradient id="mouse-shell" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#e9edf0" />
            <stop offset="1" stopColor="#aeb7bd" />
          </linearGradient>
        </defs>
        <path className="kbm-mouse-shell" d="M125 18 C58 18 29 72 29 157 V241 C29 326 67 371 125 371 C183 371 221 326 221 241 V157 C221 72 192 18 125 18 Z" />
        <path className={inputClass('record')} d="M37 150 C41 75 70 35 116 32 V150 Z" />
        <path className={inputClass('shutter')} d="M134 32 C180 35 209 75 213 150 H134 Z" />
        <path className="kbm-mouse-divider" d="M125 22 V151 M31 158 H219" />
        <g className={inputClass('gimbal-dial', mapped('gimbal-dial'))}>
          <rect className="kbm-mouse-wheel" x="111" y="75" width="28" height="58" rx="14" />
          {[87, 97, 107, 117].map((y) => <line className="kbm-wheel-tick" x1="117" x2="133" y1={y} y2={y} key={y} />)}
        </g>
        <g className={classNames('remote-input', rightMapped && 'remote-input-mapped', rightActive && 'remote-input-active')}>
          <circle className="kbm-mouse-motion" cx={125 + rightX * 24} cy={245 - rightY * 24} r="17" />
          <path className="kbm-mouse-motion-cross" d="M125 200 V290 M80 245 H170" />
        </g>
        <text className="kbm-device-label" x="125" y="345" textAnchor="middle">AIM</text>
      </svg>
    </div>
  );
}

function GamepadController({
  inputClass,
  leftActive,
  leftMapped,
  leftX,
  leftY,
  mapped,
  rightActive,
  rightMapped,
  rightX,
  rightY,
  variant,
}: AlternativeControllerProps & { readonly variant: 'xbox' | 'ps5' }) {
  const isXbox = variant === 'xbox';
  const leftStick = isXbox ? { x: 254, y: 252 } : { x: 276, y: 346 };
  const rightStick = isXbox ? { x: 429, y: 350 } : { x: 444, y: 346 };
  const faceLabels = isXbox ? ['Y', 'B', 'A', 'X'] : ['△', '○', '×', '□'];
  const faceControls: readonly ControllerControl[] = ['record', 'shutter', 'return-home', 'pause'];

  const stick = (
    side: 'left' | 'right',
    center: { readonly x: number; readonly y: number },
    xValue: number,
    yValue: number,
    isMapped: boolean,
    isActive: boolean,
  ) => (
    <g
      className={classNames('remote-input gamepad-stick', isMapped && 'remote-input-mapped', isActive && 'remote-input-active')}
      aria-label={`${side} joystick`}
    >
      <circle className="gamepad-stick-bezel" cx={center.x} cy={center.y} r="53" />
      <circle className="gamepad-stick-well" cx={center.x} cy={center.y} r="42" />
      <circle className="gamepad-stick-range" cx={center.x} cy={center.y} r="26" />
      <circle className="gamepad-stick-knob" cx={center.x + xValue * 20} cy={center.y - yValue * 20} r="25" />
    </g>
  );

  return (
    <svg
      className={classNames('controller-gamepad', `controller-gamepad-${variant}`)}
      viewBox="0 0 720 600"
      role="img"
      aria-label={`${isXbox ? 'Xbox' : 'PlayStation 5'} controller input monitor`}
    >
      <defs>
        <linearGradient id={`gamepad-shell-${variant}`} x1="0" y1="0" x2="0.8" y2="1">
          <stop offset="0" stopColor={isXbox ? '#34383d' : '#f4f5f6'} />
          <stop offset="1" stopColor={isXbox ? '#111418' : '#c9ced2'} />
        </linearGradient>
        <filter id={`gamepad-shadow-${variant}`} x="-30%" y="-30%" width="160%" height="190%">
          <feDropShadow dx="0" dy="18" stdDeviation="18" floodColor="#000" floodOpacity="0.55" />
        </filter>
      </defs>
      <ellipse className="remote-floor-shadow" cx="360" cy="520" rx="230" ry="26" />
      <path
        className="gamepad-shell"
        style={{ fill: `url(#gamepad-shell-${variant})`, filter: `url(#gamepad-shadow-${variant})` }}
        d={isXbox
          ? 'M207 159 Q248 124 306 130 H414 Q472 124 513 159 Q556 197 581 282 L610 425 Q619 479 583 501 Q548 521 516 480 L448 394 H272 L204 480 Q172 521 137 501 Q101 479 110 425 L139 282 Q164 197 207 159 Z'
          : 'M207 157 Q247 127 302 133 H418 Q473 127 513 157 Q552 187 577 269 L612 421 Q626 484 583 505 Q547 522 513 476 L453 397 H267 L207 476 Q173 522 137 505 Q94 484 108 421 L143 269 Q168 187 207 157 Z'}
      />
      {!isXbox ? <path className="gamepad-ps5-panel" d="M274 155 Q360 123 446 155 L430 337 Q360 370 290 337 Z" /> : null}

      <g className={inputClass('custom-1')}>
        <path className="gamepad-shoulder" d="M182 172 Q218 137 271 140 L262 168 Q218 168 190 197 Z" />
        <text className="gamepad-shoulder-label" x="224" y="161" textAnchor="middle">L1</text>
      </g>
      <g className={inputClass('custom-2')}>
        <path className="gamepad-shoulder" d="M458 140 Q511 137 547 172 L539 197 Q502 168 458 168 Z" />
        <text className="gamepad-shoulder-label" x="496" y="161" textAnchor="middle">R1</text>
      </g>

      {stick('left', leftStick, leftX, leftY, leftMapped, leftActive)}
      {stick('right', rightStick, rightX, rightY, rightMapped, rightActive)}

      <g className={inputClass('gimbal-dial', mapped('gimbal-dial'))} aria-label="Directional pad">
        <path className="gamepad-dpad" d={isXbox
          ? 'M273 304 H294 V283 H320 V304 H341 V330 H320 V351 H294 V330 H273 Z'
          : 'M202 239 H224 V217 H249 V239 H271 V264 H249 V286 H224 V264 H202 Z'}
        />
      </g>

      {faceLabels.map((label, index) => {
        const positions = [[504, 226], [543, 265], [504, 304], [465, 265]] as const;
        const [x, y] = positions[index]!;
        return (
          <g className={inputClass(faceControls[index]!)} key={label}>
            <circle className="gamepad-face-button" cx={x} cy={y} r="19" />
            <text className="gamepad-face-label" x={x} y={y + 5} textAnchor="middle">{label}</text>
          </g>
        );
      })}

      <g className={inputClass('flight-mode', mapped('flight-mode'))}>
        <rect className="gamepad-menu-button" x="320" y="235" width="31" height="18" rx="8" />
      </g>
      <g className={inputClass('power')}>
        <circle className="gamepad-home-button" cx="380" cy="245" r="18" />
        <text className="gamepad-home-label" x="380" y="250" textAnchor="middle">{isXbox ? 'X' : 'PS'}</text>
      </g>
    </svg>
  );
}

export function ControllerView({ controllerMode, currentTimeS, selectedInputIds }: ControllerViewProps) {
  const inputs = useMemo(() => selectedInputIds
    .map(controllerInputById)
    .filter((input): input is ControllerInputDescriptor => Boolean(input)), [selectedInputIds]);
  const byControl = useMemo(() => new Map(inputs.map((input) => [input.control, input])), [inputs]);

  const value = (control: ControllerControl): number => byControl.get(control)?.sampleAt(currentTimeS) ?? 0;
  const mapped = (...controls: readonly ControllerControl[]): boolean => controls.some((control) => byControl.has(control));
  const pressed = (control: ControllerControl): boolean => mapped(control) && value(control) >= 0.5;
  const inputClass = (control: ControllerControl, active = pressed(control)): string => classNames(
    'remote-input',
    mapped(control) && 'remote-input-mapped',
    active && 'remote-input-active',
  );

  const leftX = value('left-stick-x');
  const leftY = value('left-stick-y');
  const rightX = value('right-stick-x');
  const rightY = value('right-stick-y');
  const leftMapped = mapped('left-stick-x', 'left-stick-y');
  const rightMapped = mapped('right-stick-x', 'right-stick-y');
  const leftActive = leftMapped && (Math.abs(leftX) > 0.06 || Math.abs(leftY) > 0.06);
  const rightActive = rightMapped && (Math.abs(rightX) > 0.06 || Math.abs(rightY) > 0.06);
  const flightMode = value('flight-mode');
  return (
    <section className="controller-stage" aria-label="Controller input monitor">
      <div className="controller-canvas">
        <div className="controller-ambient-glow" aria-hidden="true" />
        {controllerMode === 'kbm' ? (
          <KeyboardMouseController
            inputClass={inputClass}
            leftActive={leftActive}
            leftMapped={leftMapped}
            leftX={leftX}
            leftY={leftY}
            mapped={mapped}
            rightActive={rightActive}
            rightMapped={rightMapped}
            rightX={rightX}
            rightY={rightY}
          />
        ) : controllerMode === 'xbox' || controllerMode === 'ps5' ? (
          <GamepadController
            inputClass={inputClass}
            leftActive={leftActive}
            leftMapped={leftMapped}
            leftX={leftX}
            leftY={leftY}
            mapped={mapped}
            rightActive={rightActive}
            rightMapped={rightMapped}
            rightX={rightX}
            rightY={rightY}
            variant={controllerMode}
          />
        ) : (
        <svg
          className="controller-remote"
          viewBox="0 0 720 600"
          role="img"
          aria-label="White dual-stick remote controller with all controls"
        >
          <defs>
            <linearGradient id="controller-shell" x1="0" y1="0" x2="0.8" y2="1">
              <stop offset="0" stopColor="#f8fafb" />
              <stop offset="0.48" stopColor="#e9edf0" />
              <stop offset="1" stopColor="#cfd5d9" />
            </linearGradient>
            <linearGradient id="controller-shell-edge" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ffffff" />
              <stop offset="1" stopColor="#b8c0c5" />
            </linearGradient>
            <radialGradient id="controller-well" cx="42%" cy="34%" r="72%">
              <stop offset="0" stopColor="#283039" />
              <stop offset="0.55" stopColor="#11161c" />
              <stop offset="1" stopColor="#05080b" />
            </radialGradient>
            <radialGradient id="controller-stick" cx="36%" cy="28%" r="70%">
              <stop offset="0" stopColor="#77818b" />
              <stop offset="0.24" stopColor="#353c43" />
              <stop offset="1" stopColor="#0a0d10" />
            </radialGradient>
            <filter id="controller-shadow" x="-30%" y="-30%" width="160%" height="190%">
              <feDropShadow dx="0" dy="20" stdDeviation="20" floodColor="#00060b" floodOpacity="0.52" />
            </filter>
            <filter id="controller-active-glow" x="-100%" y="-100%" width="300%" height="300%">
              <feDropShadow dx="0" dy="0" stdDeviation="8" floodColor="#ef4764" floodOpacity="0.9" />
            </filter>
          </defs>

          <ellipse className="remote-floor-shadow" cx="360" cy="548" rx="218" ry="25" />

          <g className="remote-handle">
            <path d="M270 180 L272 132 Q274 112 294 112 H426 Q446 112 448 132 L450 180" />
            <path d="M287 164 L289 136 Q290 129 299 129 H421 Q430 129 431 136 L433 164" />
          </g>

          <g className="remote-antenna">
            <path d="M360 161 L360 48" />
            <rect x="354" y="33" width="12" height="120" rx="6" />
            <path d="M346 169 Q360 150 374 169 L379 184 H341 Z" />
          </g>

          <g className={inputClass('record')} aria-label="Record button">
            <path className="remote-shoulder" d="M154 181 Q158 148 190 139 L226 149 L215 181 Z" />
            <circle className="remote-button-core remote-record-core" cx="188" cy="160" r="12" />
            <circle className="remote-record-mark" cx="188" cy="160" r="5" />
            <text className="remote-small-label" x="188" y="132" textAnchor="middle">REC</text>
          </g>
          <g className={inputClass('shutter')} aria-label="Shutter button">
            <path className="remote-shoulder" d="M494 149 L530 139 Q562 148 566 181 H505 Z" />
            <circle className="remote-button-core" cx="532" cy="160" r="12" />
            <circle className="remote-shutter-mark" cx="532" cy="160" r="5.5" />
            <text className="remote-small-label" x="532" y="132" textAnchor="middle">PHOTO</text>
          </g>

          <g filter="url(#controller-shadow)">
            <path
              className="remote-shell"
              d="M174 166 Q211 148 265 148 H455 Q509 148 546 166 Q570 177 579 210 L594 412 Q597 477 557 508 Q526 533 470 538 H250 Q194 533 163 508 Q123 477 126 412 L141 210 Q150 177 174 166 Z"
            />
            <path className="remote-shell-highlight" d="M165 205 Q184 171 239 168 H481 Q536 171 555 205" />
          </g>

          <g className={classNames('remote-input', mapped('gimbal-dial') && 'remote-input-mapped', mapped('gimbal-dial') && Math.abs(value('gimbal-dial')) > 0.05 && 'remote-input-active')} aria-label="Gimbal dial">
            <rect className="remote-side-control" x="132" y="216" width="37" height="72" rx="15" />
            <g transform={`rotate(${value('gimbal-dial') * 24} 151 252)`}>
              <rect className="remote-dial" x="140" y="225" width="22" height="54" rx="10" />
              {[-16, -8, 0, 8, 16].map((offset) => (
                <line className="remote-dial-tick" x1="144" x2="158" y1={252 + offset} y2={252 + offset} key={offset} />
              ))}
            </g>
            <text className="remote-small-label" x="151" y="303" textAnchor="middle">DIAL</text>
          </g>

          <g className={classNames('remote-input', mapped('flight-mode') && 'remote-input-mapped', mapped('flight-mode') && 'remote-input-active')} aria-label="Flight mode switch">
            <rect className="remote-side-control" x="551" y="216" width="37" height="72" rx="15" />
            <path className="remote-switch-track" d="M569 231 V273" />
            <g transform={`translate(0 ${flightMode * 18})`}>
              <circle className="remote-switch-knob" cx="569" cy="252" r="10" />
              <path className="remote-switch-cap" d="M565 252 L569 235 L573 252 Z" />
            </g>
            <text className="remote-small-label" x="569" y="303" textAnchor="middle">MODE</text>
          </g>

          <g className={classNames('remote-input remote-joystick', leftMapped && 'remote-input-mapped', leftActive && 'remote-input-active')} aria-label="Left joystick">
            <circle className="remote-stick-bezel" cx="236" cy="302" r="69" />
            <circle className="remote-stick-well" cx="236" cy="302" r="56" />
            <path className="remote-stick-guide" d="M187 302 H285 M236 253 V351" />
            <circle className="remote-stick-range" cx="236" cy="302" r="32" />
            <g transform={`translate(${leftX * 23} ${-leftY * 23})`}>
              <path className="remote-stick-stem" d="M231 302 L227 278 H245 L241 302 Z" />
              <circle className="remote-stick-knob" cx="236" cy="278" r="21" />
              <circle className="remote-stick-knurl" cx="236" cy="278" r="13" />
            </g>
            <text className="remote-control-label" x="236" y="388" textAnchor="middle">LEFT STICK</text>
          </g>

          <g className={classNames('remote-input remote-joystick', rightMapped && 'remote-input-mapped', rightActive && 'remote-input-active')} aria-label="Right joystick">
            <circle className="remote-stick-bezel" cx="484" cy="302" r="69" />
            <circle className="remote-stick-well" cx="484" cy="302" r="56" />
            <path className="remote-stick-guide" d="M435 302 H533 M484 253 V351" />
            <circle className="remote-stick-range" cx="484" cy="302" r="32" />
            <g transform={`translate(${rightX * 23} ${-rightY * 23})`}>
              <path className="remote-stick-stem" d="M479 302 L475 278 H493 L489 302 Z" />
              <circle className="remote-stick-knob" cx="484" cy="278" r="21" />
              <circle className="remote-stick-knurl" cx="484" cy="278" r="13" />
            </g>
            <text className="remote-control-label" x="484" y="388" textAnchor="middle">RIGHT STICK</text>
          </g>

          <g className={inputClass('return-home')} aria-label="Return to home button">
            <circle className="remote-face-button" cx="304" cy="417" r="22" />
            <path className="remote-face-icon remote-home-icon" d="M293 418 L304 408 L315 418 M297 415 V427 H311 V415" />
            <text className="remote-control-label" x="304" y="454" textAnchor="middle">RTH</text>
          </g>
          <g className={inputClass('pause')} aria-label="Pause button">
            <circle className="remote-face-button" cx="360" cy="417" r="22" />
            <path className="remote-face-icon" d="M354 408 V426 M366 408 V426" />
            <text className="remote-control-label" x="360" y="454" textAnchor="middle">PAUSE</text>
          </g>
          <g className={inputClass('power')} aria-label="Power button">
            <circle className="remote-face-button remote-power-button" cx="416" cy="417" r="22" />
            <path className="remote-face-icon" d="M416 405 V418 M407 411 A13 13 0 1 0 425 411" />
            <text className="remote-control-label" x="416" y="454" textAnchor="middle">POWER</text>
          </g>

          <g className={inputClass('custom-1')} aria-label="Custom button 1">
            <rect className="remote-custom-button" x="245" y="474" width="52" height="29" rx="10" />
            <text className="remote-button-text" x="271" y="493" textAnchor="middle">C1</text>
          </g>
          <g className={inputClass('custom-2')} aria-label="Custom button 2">
            <rect className="remote-custom-button" x="423" y="474" width="52" height="29" rx="10" />
            <text className="remote-button-text" x="449" y="493" textAnchor="middle">C2</text>
          </g>

          <g className="remote-status-lights" aria-hidden="true">
            {[0, 1, 2, 3].map((index) => <circle cx={342 + index * 12} cy="494" r="3.2" key={index} />)}
          </g>
          <g className="remote-screws" aria-hidden="true">
            {[[174, 202], [546, 202], [156, 432], [564, 432]].map(([x, y]) => (
              <g transform={`translate(${x} ${y})`} key={`${x}-${y}`}>
                <circle r="8" /><path d="M-3 -3 L3 3 M3 -3 L-3 3" />
              </g>
            ))}
          </g>
        </svg>
        )}
      </div>
    </section>
  );
}
