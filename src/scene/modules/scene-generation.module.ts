import { Module } from '@nestjs/common';
import { SceneLiveModule } from './scene-live.module';
import { ScenePlanningModule } from './scene-planning.module';
import { ScenePipelineModule } from './scene-pipeline.module';
import { SceneQualityModule } from './scene-quality.module';
import { SceneStorageModule } from './scene-storage.module';
import { SceneVisionModule } from './scene-vision.module';
import {
  SceneGenerationService,
  SceneQueueManagerService,
  SceneFailureHandlerService,
  SceneSnapshotService,
} from '../services/generation';

@Module({
  imports: [
    SceneLiveModule,
    ScenePlanningModule,
    ScenePipelineModule,
    SceneQualityModule,
    SceneStorageModule,
    SceneVisionModule,
  ],
  providers: [
    SceneQueueManagerService,
    SceneFailureHandlerService,
    SceneSnapshotService,
    SceneGenerationService,
  ],
  exports: [
    SceneQueueManagerService,
    SceneFailureHandlerService,
    SceneSnapshotService,
    SceneGenerationService,
  ],
})
export class SceneGenerationModule {}
