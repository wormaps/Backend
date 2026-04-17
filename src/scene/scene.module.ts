import { Module } from '@nestjs/common';
import { CacheModule } from '../cache/cache.module';
import { MetricsModule } from '../common/metrics/metrics.module';
import { PlacesModule } from '../places/places.module';
import { SceneGenerationModule } from './modules/scene-generation.module';
import { SceneLiveModule } from './modules/scene-live.module';
import { SceneStorageModule } from './modules/scene-storage.module';
import { SceneVisionModule } from './modules/scene-vision.module';
import { SceneController } from './scene.controller';
import { SceneService } from './scene.service';

@Module({
  imports: [
    PlacesModule,
    CacheModule,
    MetricsModule,
    SceneStorageModule,
    SceneLiveModule,
    SceneVisionModule,
    SceneGenerationModule,
  ],
  controllers: [SceneController],
  providers: [SceneService],
})
export class SceneModule {}
