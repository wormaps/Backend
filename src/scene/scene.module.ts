import { Module } from '@nestjs/common';
import { CacheModule } from '../cache/cache.module';
import { PlacesModule } from '../places/places.module';
import { GlbBuilderService } from '../assets/glb-builder.service';
import { SceneController } from './scene.controller';
import { SceneHeroOverrideService } from './scene-hero-override.service';
import { SceneRepository } from './scene.repository';
import { SceneService } from './scene.service';
import { SceneVisionService } from './scene-vision.service';

@Module({
  imports: [PlacesModule, CacheModule],
  controllers: [SceneController],
  providers: [
    GlbBuilderService,
    SceneRepository,
    SceneVisionService,
    SceneHeroOverrideService,
    SceneService,
  ],
})
export class SceneModule {}
