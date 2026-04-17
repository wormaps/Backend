import { Module } from '@nestjs/common';
import { SceneLiveModule } from './scene-live.module';
import { ScenePlanningModule } from './scene-planning.module';
import { ScenePipelineModule } from './scene-pipeline.module';
import { SceneQualityModule } from './scene-quality.module';
import { SceneStorageModule } from './scene-storage.module';
import { SceneVisionModule } from './scene-vision.module';
import { SceneGenerationService } from '../services/generation';

@Module({
  imports: [
    SceneLiveModule,
    ScenePlanningModule,
    ScenePipelineModule,
    SceneQualityModule,
    SceneStorageModule,
    SceneVisionModule,
  ],
  providers: [SceneGenerationService],
  exports: [SceneGenerationService],
})
export class SceneGenerationModule {}
