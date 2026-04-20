import { Injectable } from '@nestjs/common';
import { AppLoggerService } from '../../../common/logging/app-logger.service';
import {
  LandmarkAnnotationManifest,
  SceneMeta,
} from '../../types/scene.types';
import { SceneHeroOverrideMatcherService } from './scene-hero-override-matcher.service';
import { buildHeroEnhancement } from './hero-enhancement.utils';

@Injectable()
export class SceneLandmarkApplierService {
  constructor(
    private readonly matcher: SceneHeroOverrideMatcherService,
    private readonly appLoggerService: AppLoggerService,
  ) {}

  resolveLandmarkAssignments(
    meta: SceneMeta,
    manifest: LandmarkAnnotationManifest,
  ): Map<string, LandmarkAnnotationManifest['landmarks'][number]> {
    return this.matcher.resolveLandmarkAssignments(meta, manifest);
  }

  applyLandmarkAnnotations(
    buildings: SceneMeta['buildings'],
    landmarkAssignments: Map<
      string,
      LandmarkAnnotationManifest['landmarks'][number]
    >,
  ): SceneMeta['buildings'] {
    return buildings.map((building) => {
      const annotation = landmarkAssignments.get(building.objectId);
      if (!annotation) {
        return building;
      }

      const enhancement = buildHeroEnhancement(building, annotation);
      return {
        ...building,
        visualRole:
          annotation.facadeHint?.visualRole ??
          (annotation.importance === 'primary'
            ? 'hero_landmark'
            : 'edge_landmark'),
        facadeColor:
          annotation.facadeHint?.shellPalette?.[0] ?? building.facadeColor,
        emissiveBandStrength:
          annotation.facadeHint?.emissiveStrength ??
          building.emissiveBandStrength,
        baseMass: enhancement.baseMass,
        podiumSpec: enhancement.podiumSpec,
        signageSpec: enhancement.signageSpec,
        roofSpec: enhancement.roofSpec,
        facadeSpec: enhancement.facadeSpec,
      };
    });
  }
}
