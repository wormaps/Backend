import { mkdir, appendFile } from 'node:fs/promises';
import { join } from 'node:path';

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

export async function appendSceneDiagnosticsLog(
  sceneId: string,
  stage: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const filePath = getSceneDiagnosticsLogPath(sceneId);
  await mkdir(getSceneDataDir(), { recursive: true });
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
