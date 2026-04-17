import { Module } from '@nestjs/common';
import { SceneReadService } from '../services/read';
import { SceneRepository } from '../storage/scene.repository';

@Module({
  providers: [SceneRepository, SceneReadService],
  exports: [SceneRepository, SceneReadService],
})
export class SceneStorageModule {}
