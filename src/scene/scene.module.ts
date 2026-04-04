import { Module } from '@nestjs/common';
import { CacheModule } from '../cache/cache.module';
import { PlacesModule } from '../places/places.module';
import { SceneController } from './scene.controller';
import { SceneRepository } from './scene.repository';
import { SceneService } from './scene.service';

@Module({
  imports: [PlacesModule, CacheModule],
  controllers: [SceneController],
  providers: [SceneRepository, SceneService],
})
export class SceneModule {}
