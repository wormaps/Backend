import { Injectable } from '@nestjs/common';
import { midpoint } from '../../../places/utils/geo.utils';
import {
  IntersectionProfile,
  LandmarkAnnotationManifest,
  SceneDetail,
  SceneRoadDecal,
} from '../../types/scene.types';
import { mergeByObjectId } from './merge-by-object-id.utils';

@Injectable()
export class SceneCrossingDecalBuilderService {
  buildCrossings(
    detail: SceneDetail,
    manifest: LandmarkAnnotationManifest,
  ): SceneDetail['crossings'] {
    return mergeByObjectId(
      detail.crossings,
      manifest.crossings.map((crossing) => ({
        objectId: crossing.id,
        name: crossing.name,
        type: 'CROSSING' as const,
        crossing: crossing.style,
        crossingRef: crossing.style,
        signalized: crossing.style === 'signalized',
        path: crossing.path,
        center: midpoint(crossing.path) ?? crossing.path[0],
        principal: crossing.importance === 'primary',
        style: crossing.style,
      })),
    );
  }

  buildCrossingDecals(
    manifest: LandmarkAnnotationManifest,
  ): SceneRoadDecal[] {
    return manifest.crossings.map((crossing) => ({
      objectId: `${crossing.id}-stripe`,
      intersectionId: `${crossing.id}-intersection`,
      type: 'CROSSWALK_OVERLAY',
      color: '#f8f8f6',
      emphasis: crossing.importance === 'primary' ? 'hero' : 'standard',
      priority: crossing.importance === 'primary' ? 'hero' : 'standard',
      layer: 'crosswalk_overlay',
      shapeKind: 'path_strip',
      styleToken: 'scramble_white',
      path: crossing.path,
    }));
  }

  buildIntersectionProfiles(
    detail: SceneDetail,
    manifest: LandmarkAnnotationManifest,
  ): SceneDetail['intersectionProfiles'] {
    return mergeByObjectId(
      detail.intersectionProfiles ?? [],
      manifest.crossings.map((crossing) => ({
        objectId: `${crossing.id}-intersection`,
        anchor: midpoint(crossing.path) ?? crossing.path[0],
        profile: resolveCrossingProfile(crossing.importance, crossing.style),
        crossingObjectIds: [crossing.id],
      })),
    );
  }
}

function resolveCrossingProfile(
  importance: LandmarkAnnotationManifest['crossings'][number]['importance'],
  style: LandmarkAnnotationManifest['crossings'][number]['style'],
): IntersectionProfile {
  if (importance === 'primary') {
    return 'scramble_major';
  }
  if (style === 'signalized') {
    return 'signalized_standard';
  }
  return 'minor_crossing';
}
