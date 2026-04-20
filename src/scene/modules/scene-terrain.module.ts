import { Module } from '@nestjs/common';
import { IDemPort } from '../infrastructure/terrain/dem.port';
import { OpenElevationAdapter } from '../infrastructure/terrain/open-elevation.adapter';
import { SceneTerrainFusionStep } from '../pipeline/steps/scene-terrain-fusion.step';
import { SceneTerrainProfileService } from '../services/spatial/scene-terrain-profile.service';
import { AppLoggerService } from '../../common/logging/app-logger.service';

export { DEM_PORT_TOKEN } from '../infrastructure/terrain/dem.token';

@Module({
  providers: [
    AppLoggerService,
    SceneTerrainProfileService,
    {
      provide: IDemPort,
      useClass: OpenElevationAdapter,
    },
    SceneTerrainFusionStep,
  ],
  exports: [SceneTerrainFusionStep, SceneTerrainProfileService, IDemPort],
})
export class SceneTerrainModule {}
