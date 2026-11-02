import profiles from './robotProfiles.json';

type Axis = 'x' | 'y' | 'z';
type RobotId = string;

const ROBOT_IDS: readonly RobotId[] = profiles.map((profile) => profile.id);

export interface RobotModelOrientation {
  readonly scale: number;
  readonly rotationDeg: Record<Axis, number>;
  readonly flipped: Record<Axis, boolean>;
}

export interface RobotModelRecord {
  readonly id: string;
  readonly name: string;
  readonly sourceFileName: string;
  readonly sizeBytes: number;
  readonly importedAt: string;
  readonly orientation: RobotModelOrientation;
}

export interface RobotModelLibrary {
  readonly version: 2;
  readonly modelIdByRobot: Readonly<Partial<Record<RobotId, string | null>>>;
  readonly models: readonly RobotModelRecord[];
}

export const EMPTY_MODEL_LIBRARY: RobotModelLibrary = {
  version: 2,
  modelIdByRobot: Object.fromEntries(ROBOT_IDS.map((id) => [id, null])),
  models: [],
};

export const MODEL_ID_PATTERN = /^[0-9a-f-]{36}$/;

export const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

export const isRobotId = (value: unknown): value is RobotId => (
  typeof value === 'string' && ROBOT_IDS.includes(value as RobotId)
);

export function normalizeOrientation(value: unknown): RobotModelOrientation {
  const orientation = isRecord(value) ? value : {};
  const rotation = isRecord(orientation.rotationDeg) ? orientation.rotationDeg : {};
  const flipped = isRecord(orientation.flipped) ? orientation.flipped : {};
  const normalizeRotation = (axis: Axis): number => {
    const candidate = rotation[axis];
    if (typeof candidate !== 'number' || !Number.isFinite(candidate)) return 0;
    return ((Math.round(candidate / 90) * 90) % 360 + 360) % 360;
  };
  return {
    scale: typeof orientation.scale === 'number' && Number.isFinite(orientation.scale) && orientation.scale > 0
      ? orientation.scale : 1,
    rotationDeg: { x: normalizeRotation('x'), y: normalizeRotation('y'), z: normalizeRotation('z') },
    flipped: {
      x: flipped.x === true,
      y: flipped.y === true,
      z: flipped.z === true,
    },
  };
}

function normalizeModel(value: unknown): RobotModelRecord | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== 'string' || !MODEL_ID_PATTERN.test(value.id)) return null;
  if (typeof value.name !== 'string' || typeof value.sourceFileName !== 'string') return null;
  if (typeof value.sizeBytes !== 'number' || !Number.isFinite(value.sizeBytes)) return null;
  if (typeof value.importedAt !== 'string') return null;
  return {
    id: value.id,
    name: value.name,
    sourceFileName: value.sourceFileName,
    sizeBytes: Math.max(0, Math.round(value.sizeBytes)),
    importedAt: value.importedAt,
    orientation: normalizeOrientation(value.orientation),
  };
}

/** Preserve old assignments while making new profiles available automatically. */
export function normalizeModelLibrary(parsed: unknown): RobotModelLibrary {
  if (!isRecord(parsed) || !Array.isArray(parsed.models)
    || (parsed.version !== undefined && parsed.version !== 1 && parsed.version !== 2)) {
    throw new Error('Invalid or unsupported robot model library.');
  }
  if (parsed.version === 2 && !isRecord(parsed.modelIdByRobot)) {
    throw new Error('Invalid robot model assignments.');
  }
  const models = parsed.models.map(normalizeModel);
  if (models.some((model) => model === null)) throw new Error('Invalid robot model record.');
  const validModels = models as RobotModelRecord[];
  const ids = new Set(validModels.map((model) => model.id));
  if (ids.size !== validModels.length) throw new Error('Duplicate model identifiers.');
  const assignments = isRecord(parsed.modelIdByRobot) ? parsed.modelIdByRobot : null;
  const legacyId = typeof parsed.activeModelId === 'string' && ids.has(parsed.activeModelId)
    ? parsed.activeModelId : validModels[0]?.id ?? null;
  const robotIds = new Set([...ROBOT_IDS, ...Object.keys(assignments ?? {})]);
  const modelIdByRobot = Object.fromEntries([...robotIds].map((id) => {
    const candidate = assignments?.[id];
    return [id, typeof candidate === 'string' && ids.has(candidate)
      ? candidate : assignments ? null : legacyId];
  }));
  return { version: 2, models: validModels, modelIdByRobot };
}

// Every read/modify/write transaction runs to completion before the next starts.
// A failed import must not poison the queue for subsequent operations.
let pending: Promise<unknown> = Promise.resolve();
export function serializeModelOperation<T>(operation: () => Promise<T>): Promise<T> {
  const next = pending.then(operation);
  pending = next.catch(() => undefined);
  return next;
}
