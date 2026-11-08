import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import profiles from './robotProfiles.json';
import {
  EMPTY_FOLDER_SETTINGS, EMPTY_MODEL_SETTINGS, isRecord, isRobotId,
  normalizeModelSettings, normalizeOrientation,
  type RobotModelFolderSettings, type RobotModelLibrary, type RobotModelRecord, type RobotModelSettings,
} from './modelLibrary.cjs';
import { listModelSources, resolveModelSource } from './modelSources.cjs';
import { validateGlb } from './validateGlb.cjs';

/** Model binaries stay in the selected folder. Only preferences are written to app storage. */
export class RobotModelStore {
  private library: RobotModelLibrary | undefined;
  readonly defaultDirectory: string;

  constructor(defaultDirectory: string, private readonly settingsPath: string, private readonly defaultFolderKey?: string) {
    this.defaultDirectory = path.resolve(defaultDirectory);
  }

  private async readSettings(): Promise<RobotModelSettings> {
    try {
      const settings = normalizeModelSettings(JSON.parse(await readFile(this.settingsPath, 'utf8')), this.defaultDirectory);
      if (settings.directory !== null && !path.isAbsolute(settings.directory)) {
        throw new Error('The model folder must be an absolute path.');
      }
      return settings;
    } catch (error) {
      if (isRecord(error) && error.code === 'ENOENT') return EMPTY_MODEL_SETTINGS;
      throw new Error('Unable to read robot model settings. Restore or repair library.json before making changes.', { cause: error });
    }
  }

  private folder(settings: RobotModelSettings): RobotModelFolderSettings {
    return settings.folders[settings.directory ?? this.defaultFolderKey ?? this.defaultDirectory]
      ?? settings.folders[settings.directory ?? this.defaultDirectory] ?? EMPTY_FOLDER_SETTINGS;
  }

  private withFolder(settings: RobotModelSettings, folder: RobotModelFolderSettings): RobotModelSettings {
    return { ...settings, folders: { ...settings.folders, [settings.directory ?? this.defaultFolderKey ?? this.defaultDirectory]: folder } };
  }

  private async scan(settings: RobotModelSettings): Promise<RobotModelLibrary> {
    const directory = settings.directory ?? this.defaultDirectory;
    const folder = this.folder(settings);
    const directoryStats = await stat(directory).catch((error: unknown) => {
      if (isRecord(error) && error.code === 'ENOENT') return null;
      throw error;
    });
    if (directoryStats && !directoryStats.isDirectory()) throw new Error('The selected model folder is not a directory.');
    const issues: { fileName: string; message: string }[] = [];
    const sources = directoryStats ? await listModelSources(directory) : [];
    const models: RobotModelRecord[] = [];
    for (const sourceFileName of sources) {
      try {
        const sourcePath = await resolveModelSource(directory, sourceFileName);
        const sizeBytes = await validateGlb(sourcePath);
        const fileStats = await stat(sourcePath);
        models.push({
          id: createHash('sha256').update(sourcePath).digest('hex'),
          name: path.basename(sourceFileName, path.extname(sourceFileName)),
          sourceFileName,
          sizeBytes,
          revision: `${fileStats.mtimeMs}-${fileStats.ctimeMs}-${sizeBytes}`,
          orientation: folder.orientationByFile[sourceFileName] ?? normalizeOrientation(null),
        });
      } catch (error) {
        issues.push({ fileName: sourceFileName, message: error instanceof Error ? error.message : 'Unable to read this model.' });
      }
    }
    const byFile = new Map(models.map((model) => [model.sourceFileName, model.id]));
    const robotIds = new Set([...profiles.map((profile) => profile.id), ...Object.keys(folder.modelFileByRobot)]);
    return {
      version: 3,
      directory,
      isDefaultDirectory: directory === this.defaultDirectory,
      directoryMissing: !directoryStats,
      models,
      modelIdByRobot: Object.fromEntries([...robotIds].map((id) => [
        id, byFile.get(folder.modelFileByRobot[id] ?? '') ?? null,
      ])),
      issues,
    };
  }

  private async commit(settings: RobotModelSettings): Promise<RobotModelLibrary> {
    // Scan first so unreadable folders do not replace a working configuration.
    const library = await this.scan(settings);
    await mkdir(path.dirname(this.settingsPath), { recursive: true });
    const temporaryPath = `${this.settingsPath}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporaryPath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
      await rename(temporaryPath, this.settingsPath);
    } finally {
      await unlink(temporaryPath).catch(() => undefined);
    }
    this.library = library;
    return library;
  }

  async list(): Promise<RobotModelLibrary> {
    const library = await this.scan(await this.readSettings());
    this.library = library;
    return library;
  }

  async getDirectory(): Promise<string> {
    return (await this.readSettings()).directory ?? this.defaultDirectory;
  }

  async setDirectory(directory: string | null): Promise<RobotModelLibrary> {
    if (directory !== null) {
      if (!path.isAbsolute(directory) || !(await stat(directory)).isDirectory()) {
        throw new Error('Choose an existing model folder.');
      }
      directory = path.resolve(directory);
    }
    return this.commit({ ...await this.readSettings(), directory: directory === this.defaultDirectory ? null : directory });
  }

  async setForRobot(robotId: unknown, id: unknown): Promise<RobotModelLibrary> {
    if (!isRobotId(robotId)) throw new Error('Invalid robot identifier.');
    const settings = await this.readSettings();
    const library = await this.scan(settings);
    const model = library.models.find((candidate) => candidate.id === id);
    if (id !== null && !model) throw new Error('That robot model is no longer available. Refresh the model folder.');
    const folder = this.folder(settings);
    return this.commit(this.withFolder(settings, {
      ...folder,
      modelFileByRobot: { ...folder.modelFileByRobot, [robotId]: model?.sourceFileName ?? null },
    }));
  }

  async updateOrientation(id: unknown, orientation: unknown): Promise<RobotModelLibrary> {
    const settings = await this.readSettings();
    const library = await this.scan(settings);
    const model = library.models.find((candidate) => candidate.id === id);
    if (!model) throw new Error('That robot model is no longer available. Refresh the model folder.');
    const folder = this.folder(settings);
    return this.commit(this.withFolder(settings, {
      ...folder,
      orientationByFile: { ...folder.orientationByFile, [model.sourceFileName]: normalizeOrientation(orientation) },
    }));
  }

  async resolveModel(id: string): Promise<string | null> {
    const library = this.library ?? await this.list();
    const model = library.models.find((candidate) => candidate.id === id);
    if (!model) return null;
    try {
      const sourcePath = await resolveModelSource(library.directory, model.sourceFileName);
      await validateGlb(sourcePath);
      return sourcePath;
    } catch {
      return null;
    }
  }
}
