import { ROBOT_PROFILES } from '../robots/profiles';
import type { RobotId } from '../types';

export const CONTROLLER_INPUT_DRAG_TYPE = 'application/x-knightsim-controller-input';

export type ControllerInputKind = 'axis' | 'button' | 'switch';
export type ControllerControl =
  | 'left-stick-x'
  | 'left-stick-y'
  | 'right-stick-x'
  | 'right-stick-y'
  | 'gimbal-dial'
  | 'flight-mode'
  | 'record'
  | 'shutter'
  | 'return-home'
  | 'pause'
  | 'power'
  | 'custom-1'
  | 'custom-2';

export interface ControllerInputDescriptor {
  readonly id: string;
  readonly robotId: RobotId;
  readonly robotName: string;
  readonly control: ControllerControl;
  readonly label: string;
  readonly shortLabel: string;
  readonly kind: ControllerInputKind;
  readonly sampleAt: (timeS: number) => number;
  readonly format: (value: number) => string;
}


const axisValue = (timeS: number, phase: number, speed: number): number => (
  Math.sin(timeS * speed + phase) * 0.82
);

const buttonValue = (timeS: number, phase: number, period: number, heldFor: number): number => {
  const position = ((timeS + phase) % period + period) % period;
  return position < heldFor ? 1 : 0;
};

const axisFormat = (value: number): string => `${value >= 0 ? '+' : ''}${value.toFixed(2)}`;
const buttonFormat = (value: number): string => value >= 0.5 ? 'Pressed' : 'Released';
const switchFormat = (value: number): string => value < -0.33 ? 'Sport' : value > 0.33 ? 'Tripod' : 'Normal';

function inputsForRobot(
  robotId: RobotId,
  robotName: string,
  phase: number,
): readonly ControllerInputDescriptor[] {
  const input = (
    control: ControllerControl,
    label: string,
    shortLabel: string,
    kind: ControllerInputKind,
    sampleAt: (timeS: number) => number,
  ): ControllerInputDescriptor => ({
    id: `${robotId}.inputs.${control}`,
    robotId,
    robotName,
    control,
    label,
    shortLabel,
    kind,
    sampleAt,
    format: kind === 'axis' ? axisFormat : kind === 'switch' ? switchFormat : buttonFormat,
  });

  return [
    input('left-stick-x', 'Left stick X', 'L · X', 'axis', (timeS) => axisValue(timeS, phase + 0.4, 0.31)),
    input('left-stick-y', 'Left stick Y', 'L · Y', 'axis', (timeS) => axisValue(timeS, phase + 1.5, 0.23)),
    input('right-stick-x', 'Right stick X', 'R · X', 'axis', (timeS) => axisValue(timeS, phase + 2.4, 0.27)),
    input('right-stick-y', 'Right stick Y', 'R · Y', 'axis', (timeS) => axisValue(timeS, phase + 3.1, 0.19)),
    input('gimbal-dial', 'Gimbal dial', 'Dial', 'axis', (timeS) => axisValue(timeS, phase + 1.1, 0.16)),
    input('flight-mode', 'Flight mode', 'Mode', 'switch', (timeS) => {
      const state = Math.floor((timeS + phase) / 9) % 3;
      return state === 0 ? -1 : state === 1 ? 0 : 1;
    }),
    input('record', 'Record', 'REC', 'button', (timeS) => buttonValue(timeS, phase, 11, 2.4)),
    input('shutter', 'Shutter', 'Photo', 'button', (timeS) => buttonValue(timeS, phase + 4, 13, 1.35)),
    input('return-home', 'Return to home', 'RTH', 'button', (timeS) => buttonValue(timeS, phase + 7, 31, 2.2)),
    input('pause', 'Pause', 'Pause', 'button', (timeS) => buttonValue(timeS, phase + 2.5, 17, 1.8)),
    input('power', 'Power', 'Power', 'button', () => 1),
    input('custom-1', 'Custom button 1', 'C1', 'button', (timeS) => buttonValue(timeS, phase + 5.5, 19, 2.1)),
    input('custom-2', 'Custom button 2', 'C2', 'button', (timeS) => buttonValue(timeS, phase + 9, 23, 2.1)),
  ];
}

export const CONTROLLER_INPUTS: readonly ControllerInputDescriptor[] = ROBOT_PROFILES.filter((robot) => robot.capabilities.controller).flatMap((robot) => (
  inputsForRobot(robot.id, robot.name, robot.demoPhase)
));

const inputById = new Map(CONTROLLER_INPUTS.map((descriptor) => [descriptor.id, descriptor]));

export const controllerInputById = (id: string): ControllerInputDescriptor | null => (
  inputById.get(id) ?? null
);

const inputsByRobot = new Map(ROBOT_PROFILES.map(({ id }) => [
  id, CONTROLLER_INPUTS.filter((descriptor) => descriptor.robotId === id),
]));

export const controllerInputsForRobot = (robotId: RobotId): readonly ControllerInputDescriptor[] => (
  inputsByRobot.get(robotId) ?? []
);

export const controllerInputValueAt = (id: string, timeS: number): number | null => {
  const descriptor = controllerInputById(id);
  if (!descriptor) return null;
  const value = descriptor.sampleAt(timeS);
  return Number.isFinite(value) ? value : null;
};

interface DragDataReader {
  readonly getData: (format: string) => string;
}

export const readControllerInputDragId = (dataTransfer: DragDataReader): string | null => {
  const id = dataTransfer.getData(CONTROLLER_INPUT_DRAG_TYPE);
  return controllerInputById(id)?.id ?? null;
};
