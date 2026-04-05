import { Module } from '@nestjs/common';
import { CacheModule } from '../cache/cache.module';
import { PlacesModule } from '../places/places.module';
import { GlbBuilderService } from '../assets/glb-builder.service';
import { SceneController } from './scene.controller';
import { SceneService } from './scene.service';
import { SceneHeroOverrideService } from './services/scene-hero-override.service';
import { SceneGenerationService } from './services/scene-generation.service';
import { SceneLiveDataService } from './services/scene-live-data.service';
import { SceneReadService } from './services/scene-read.service';
import { SceneVisionService } from './services/scene-vision.service';
import { SceneRepository } from './storage/scene.repository';

@Module({
  imports: [PlacesModule, CacheModule],
  controllers: [SceneController],
  providers: [
    GlbBuilderService,
    SceneRepository,
    SceneVisionService,
    SceneHeroOverrideService,
    SceneReadService,
    SceneLiveDataService,
    SceneGenerationService,
    SceneService,
  ],
})
export class SceneModule {}
