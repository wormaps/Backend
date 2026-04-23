import {
  appendFile,
  open,
  mkdir,
  readFile,
  rename,
  stat,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

export class SceneCorruptionError extends Error {
  readonly kind: 'parse-failure' | 'partial-family' | 'empty-file';

  constructor(kind: SceneCorruptionError['kind'], message: string) {
    super(message);
    this.name = 'SceneCorruptionError';
    this.kind = kind;
  }
}

export function parseSceneJson<T>(raw: string, label: string): T {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new SceneCorruptionError('empty-file', `${label} is empty`);
  }
  try {
    return JSON.parse(trimmed) as T;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new SceneCorruptionError('parse-failure', `${label} JSON parse error: ${msg}`);
  }
}

export async function readSceneJsonFile<T>(
  filePath: string,
  label: string,
): Promise<T | null> {
  let raw: string;
  try {
    raw = await readFile(filePath, 'utf8');
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      return null;
    }
    throw err;
  }
  return parseSceneJson<T>(raw, label);
}

export function getSceneDataDir(): string {
  const configured = process.env.SCENE_DATA_DIR?.trim();
  if (configured) {
    return configured;
  }

  return join(process.cwd(), 'data', 'scene');
}

export function getSceneDiagnosticsLogPath(sceneId: string): string {
  return join(getSceneDataDir(), `${sceneId}.diagnostics.log`);
}

export function getSceneGenerationLockPath(sceneId: string): string {
  return join(getSceneDataDir(), `${sceneId}.generation.lock`);
}

export function getSceneGenerationQueuePath(): string {
  return join(getSceneDataDir(), 'generation-queue.json');
}

export function getSceneRecentFailuresPath(): string {
  return join(getSceneDataDir(), 'recent-failures.json');
}

export function getProviderHealthSnapshotPath(): string {
  return join(getSceneDataDir(), 'provider-health.json');
}

export interface SceneRecentFailuresSnapshot {
  failures: Array<{
    sceneId: string;
    attempts: number;
    status: 'FAILED';
    failureCategory: string;
    failureReason: string;
    updatedAt: string;
  }>;
  updatedAt: string;
}

export interface SceneGenerationQueueSnapshot {
  ownerId: string;
  updatedAt: string;
  isProcessingQueue: boolean;
  isShuttingDown: boolean;
  currentProcessingSceneId: string | null;
  queuedSceneIds: string[];
  queueDepth: number;
}

export interface ProviderHealthSnapshotFile {
  providers: Array<{
    provider: string;
    state: 'healthy' | 'degraded' | 'open';
    consecutiveFailures: number;
    lastFailureAt: string | null;
    totalRequests: number;
    totalFailures: number;
  }>;
  trackedAt: string;
}

export async function appendSceneDiagnosticsLog(
  sceneId: string,
  stage: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const filePath = getSceneDiagnosticsLogPath(sceneId);
  await mkdir(getSceneDataDir(), { recursive: true });
  await rotateSceneDiagnosticsLog(filePath);
  await appendFile(
    filePath,
    `${JSON.stringify({
      timestamp: new Date().toISOString(),
      sceneId,
      stage,
      ...payload,
    })}\n`,
    'utf8',
  );
}

export async function writeFileAtomically(
  filePath: string,
  data: string | Uint8Array | Buffer,
  options?: Parameters<typeof writeFile>[2],
): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}-${randomUUID()}`;
  await writeFile(tempPath, data, options);
  await rename(tempPath, filePath);
}

export async function writeSceneGenerationQueueSnapshot(
  snapshot: SceneGenerationQueueSnapshot,
): Promise<void> {
  await writeFileAtomically(
    getSceneGenerationQueuePath(),
    JSON.stringify(snapshot, null, 2),
    'utf8',
  );
}

export async function writeSceneRecentFailuresSnapshot(
  snapshot: SceneRecentFailuresSnapshot,
): Promise<void> {
  await writeFileAtomically(
    getSceneRecentFailuresPath(),
    JSON.stringify(snapshot, null, 2),
    'utf8',
  );
}

export async function readSceneRecentFailuresSnapshot(): Promise<SceneRecentFailuresSnapshot | null> {
  return readSceneJsonFile<SceneRecentFailuresSnapshot>(
    getSceneRecentFailuresPath(),
    'recent-failures',
  );
}

export async function readSceneGenerationQueueSnapshot(): Promise<SceneGenerationQueueSnapshot | null> {
  return readSceneJsonFile<SceneGenerationQueueSnapshot>(
    getSceneGenerationQueuePath(),
    'generation-queue',
  );
}

export async function writeProviderHealthSnapshot(
  snapshot: ProviderHealthSnapshotFile,
): Promise<void> {
  await writeFileAtomically(
    getProviderHealthSnapshotPath(),
    JSON.stringify(snapshot, null, 2),
    'utf8',
  );
}

export async function readProviderHealthSnapshot(): Promise<ProviderHealthSnapshotFile | null> {
  return readSceneJsonFile<ProviderHealthSnapshotFile>(
    getProviderHealthSnapshotPath(),
    'provider-health',
  );
}

async function rotateSceneDiagnosticsLog(filePath: string): Promise<void> {
  const maxBytes = 1024 * 1024;
  const maxBackups = 3;
  const currentSize = await readFileSize(filePath);
  if (currentSize === null || currentSize < maxBytes) {
    return;
  }

  for (let index = maxBackups - 1; index >= 1; index -= 1) {
    const source = `${filePath}.${index}`;
    const target = `${filePath}.${index + 1}`;
    if (await exists(source)) {
      await safeRename(source, target);
    }
  }

  if (await exists(filePath)) {
    await safeRename(filePath, `${filePath}.1`);
  }
}

export async function tryAcquireSceneGenerationLock(
  sceneId: string,
  ownerId: string,
  staleAfterMs = 15 * 60 * 1000,
): Promise<boolean> {
  const lockPath = getSceneGenerationLockPath(sceneId);
  await mkdir(getSceneDataDir(), { recursive: true });
  try {
    const handle = await open(lockPath, 'wx');
    try {
      await handle.writeFile(
        JSON.stringify({
          sceneId,
          ownerId,
          acquiredAt: new Date().toISOString(),
        }),
        'utf8',
      );
    } finally {
      await handle.close();
    }
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error;
    }

    const isStale = await isGenerationLockStale(lockPath, staleAfterMs);
    if (!isStale) {
      return false;
    }

    await safeUnlink(lockPath);
    return tryAcquireSceneGenerationLock(sceneId, ownerId, staleAfterMs);
  }
}

export async function releaseSceneGenerationLock(
  sceneId: string,
  ownerId: string,
): Promise<void> {
  const lockPath = getSceneGenerationLockPath(sceneId);
  try {
    const raw = await readFileIfExists(lockPath);
    if (!raw) {
      return;
    }
    const parsed = JSON.parse(raw) as { ownerId?: string };
    if (parsed.ownerId !== ownerId) {
      return;
    }
    await safeUnlink(lockPath);
  } catch {
    return;
  }
}

async function isGenerationLockStale(
  lockPath: string,
  staleAfterMs: number,
): Promise<boolean> {
  try {
    const raw = await readFileIfExists(lockPath);
    if (!raw) {
      return false;
    }
    const parsed = JSON.parse(raw) as { acquiredAt?: string };
    const acquiredAtMs = parsed.acquiredAt ? Date.parse(parsed.acquiredAt) : NaN;
    if (!Number.isFinite(acquiredAtMs)) {
      return true;
    }
    return Date.now() - acquiredAtMs > staleAfterMs;
  } catch {
    return true;
  }
}

async function readFileSize(filePath: string): Promise<number | null> {
  try {
    return (await stat(filePath)).size;
  } catch {
    return null;
  }
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function safeRename(from: string, to: string): Promise<void> {
  try {
    await unlink(to);
  } catch {
    // ignore missing target
  }
  await rename(from, to);
}

async function safeUnlink(filePath: string): Promise<void> {
  try {
    await unlink(filePath);
  } catch {
    // ignore missing file
  }
}

async function readFileIfExists(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return null;
  }
}
