import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from './cache/cache.module';
import { HealthModule } from './health/health.module';
import { GlobalApiKeyGuard } from './common/http/global-api-key.guard';
import { LoggingModule } from './common/logging/logging.module';
import { PlacesModule } from './places/places.module';
import { SceneModule } from './scene/scene.module';
import { validateEnvironment } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
    }),
    LoggingModule,
    CacheModule,
    HealthModule,
    PlacesModule,
    SceneModule,
  ],
  providers: [GlobalApiKeyGuard],
})
export class AppModule {}
