import { Module } from '@nestjs/common';
import { CacheModule } from './cache/cache.module';
import { HealthModule } from './health/health.module';
import { PlacesModule } from './places/places.module';
import { SceneModule } from './scene/scene.module';

@Module({
  imports: [CacheModule, HealthModule, PlacesModule, SceneModule],
})
export class AppModule {}
