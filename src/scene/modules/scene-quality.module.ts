import { Module } from '@nestjs/common';
import { SceneMidQaService } from '../services/qa';
import { SceneQualityGateService } from '../services/generation';

@Module({
  providers: [SceneQualityGateService, SceneMidQaService],
  exports: [SceneQualityGateService, SceneMidQaService],
})
export class SceneQualityModule {}
