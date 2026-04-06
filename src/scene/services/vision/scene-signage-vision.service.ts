import { Injectable } from '@nestjs/common';
import type { MapillaryClient } from '../../../places/clients/mapillary.client';
import type { ExternalPlaceDetail } from '../../../places/types/external-place.types';
import type { PlacePackage } from '../../../places/types/place.types';
import type {
  SceneCrossingDetail,
  SceneFacadeHint,
  SceneSignageCluster,
} from '../../types/scene.types';

@Injectable()
export class SceneSignageVisionService {
  buildSignageClusters(
    place: ExternalPlaceDetail,
    mapillaryFeatures: Awaited<ReturnType<MapillaryClient['getMapFeatures']>>,
    facadeHints: SceneFacadeHint[],
  ): SceneSignageCluster[] {
    const signFeatures = mapillaryFeatures.filter((feature) =>
      feature.type.toLowerCase().includes('sign'),
    );
    const clusterSource = facadeHints
      .filter((hint) => hint.signageDensity !== 'low')
      .sort((left, right) => {
        const leftDist = squaredDistance(left.anchor, place.location);
        const rightDist = squaredDistance(right.anchor, place.location);
        return leftDist - rightDist;
      })
      .slice(0, 12);

    return clusterSource.map((hint, index) => ({
      objectId: `signage-cluster-${index + 1}`,
      anchor: hint.anchor,
      panelCount: Math.max(
        2,
        Math.min(
          8,
          signFeatures.length > 0 ? Math.ceil(signFeatures.length / 8) : 3,
        ),
      ),
      palette: hint.palette,
      emissiveStrength: Math.max(0.35, hint.emissiveStrength),
      widthMeters: 5 + (index % 3),
      heightMeters: 2.4 + (index % 2) * 0.8,
    }));
  }

  buildLandmarkAnchors(
    placePackage: PlacePackage,
    crossings: SceneCrossingDetail[],
  ) {
    const crossingAnchors = crossings
      .filter((crossing) => crossing.principal)
      .slice(0, 4)
      .map((crossing) => ({
        objectId: crossing.objectId,
        name: crossing.name,
        location: crossing.center,
        kind: 'CROSSING' as const,
      }));

    const landmarkAnchors = placePackage.landmarks.slice(0, 6).map((poi) => ({
      objectId: poi.id,
      name: poi.name,
      location: poi.location,
      kind: 'BUILDING' as const,
    }));

    return [...crossingAnchors, ...landmarkAnchors];
  }
}

function squaredDistance(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const dx = (a.lng - b.lng) * 111_320;
  const dy = (a.lat - b.lat) * 111_320;
  return dx * dx + dy * dy;
}
