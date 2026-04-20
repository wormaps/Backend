import { randomUUID } from 'node:crypto';
import { AppLoggerService } from '../../../common/logging/app-logger.service';
import { SceneRepository } from '../../storage/scene.repository';
import {
  getSceneGenerationQueuePath,
  releaseSceneGenerationLock,
  tryAcquireSceneGenerationLock,
  writeSceneGenerationQueueSnapshot,
} from '../../storage/scene-storage.utils';
import type { SceneFailureCategory, SceneScale } from '../../types/scene.types';

export interface QueueDebugSnapshot {
  isProcessingQueue: boolean;
  isShuttingDown: boolean;
  currentProcessingSceneId: string | null;
  queuedSceneIds: string[];
  queueDepth: number;
}

export interface FailureEntry {
  sceneId: string;
  attempts: number;
  status: 'FAILED';
  failureCategory: SceneFailureCategory;
  failureReason: string;
  updatedAt: string;
}
