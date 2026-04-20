import { Module } from '@nestjs/common';
import { PlacesModule } from '../../places/places.module';
import { BuildingStyleResolverService } from '../services/vision/building-style-resolver.service';
import { SceneAtmosphereRecomputeService } from '../services/vision/scene-atmosphere-recompute.service';
import { SceneFacadeAtmosphereService } from '../services/vision/scene-facade-atmosphere.service';
import { SceneAssetProfileService, AssetMaterialClassService } from '../services/asset-profile';
import { SceneFacadeVisionService } from '../services/vision/scene-facade-vision.service';
import { SceneGeometryDiagnosticsService } from '../services/vision/scene-geometry-diagnostics.service';
import { SceneRoadVisionService } from '../services/vision/scene-road-vision.service';
import { SceneSignageVisionService } from '../services/vision/scene-signage-vision.service';
import { SceneTerrainProfileService } from '../services/spatial/scene-terrain-profile.service';
import { SceneTwinBuilderService } from '../services/twin';
import { SceneVisionService } from '../services/vision';

@Module({
  imports: [PlacesModule],
  providers: [
    AssetMaterialClassService,
    SceneAssetProfileService,
    BuildingStyleResolverService,
    SceneRoadVisionService,
    SceneFacadeVisionService,
    SceneFacadeAtmosphereService,
    SceneAtmosphereRecomputeService,
    SceneGeometryDiagnosticsService,
    SceneSignageVisionService,
    SceneTerrainProfileService,
    SceneTwinBuilderService,
    SceneVisionService,
  ],
  exports: [
    AssetMaterialClassService,
    SceneAssetProfileService,
    BuildingStyleResolverService,
    SceneRoadVisionService,
    SceneFacadeVisionService,
    SceneFacadeAtmosphereService,
    SceneAtmosphereRecomputeService,
    SceneGeometryDiagnosticsService,
    SceneSignageVisionService,
    SceneTerrainProfileService,
    SceneTwinBuilderService,
    SceneVisionService,
  ],
})
export class SceneVisionModule {}
