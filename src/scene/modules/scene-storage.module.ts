import { Module } from '@nestjs/common';
import { SceneReadService } from '../services/read';
import { SceneRepository } from '../storage/scene.repository';
import { AppLoggerService } from '../../common/logging/app-logger.service';

@Module({
  providers: [AppLoggerService, SceneRepository, SceneReadService],
  exports: [SceneRepository, SceneReadService],
})
export class SceneStorageModule {}
