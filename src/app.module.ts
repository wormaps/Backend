import { Module } from '@nestjs/common';
import { CacheModule } from './cache/cache.module';
import { HealthModule } from './health/health.module';
import { LoggingModule } from './common/logging/logging.module';
import { PlacesModule } from './places/places.module';
import { SceneModule } from './scene/scene.module';

@Module({
  imports: [LoggingModule, CacheModule, HealthModule, PlacesModule, SceneModule],
})
export class AppModule {}
