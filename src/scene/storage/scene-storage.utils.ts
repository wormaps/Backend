import { join } from 'node:path';

export function getSceneDataDir(): string {
  const configured = process.env.SCENE_DATA_DIR?.trim();
  if (configured) {
    return configured;
  }

  return join(process.cwd(), 'data', 'scenes');
}

