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
      .slice(0, 36);

    return clusterSource.map((hint, index) => ({
      objectId: `signage-cluster-${index + 1}`,
      anchor: hint.anchor,
      panelCount: Math.max(
        5,
        Math.min(
          18,
          signFeatures.length > 0 ? Math.ceil(signFeatures.length / 3.6) : 7,
        ),
      ),
      palette: hint.palette,
      emissiveStrength: Math.max(0.52, hint.emissiveStrength * 1.14),
      widthMeters: 6.2 + (index % 4) * 1.05,
      heightMeters: 3 + (index % 3) * 0.95,
    }));
  }

  buildLandmarkAnchors(
    placePackage: PlacePackage,
    crossings: SceneCrossingDetail[],
  ) {
    const crossingAnchors = crossings
      .filter((crossing) => crossing.principal)
      .slice(0, 6)
      .map((crossing) => ({
        objectId: crossing.objectId,
        name: crossing.name,
        location: crossing.center,
        kind: 'CROSSING' as const,
      }));

    const landmarkAnchors = placePackage.landmarks.slice(0, 10).map((poi) => ({
      objectId: poi.id,
      name: poi.name,
      location: poi.location,
      kind: 'BUILDING' as const,
    }));

    const poiAnchors = placePackage.pois
      .filter((poi) => poi.type === 'LANDMARK' || poi.type === 'SHOP')
      .slice(0, 6)
      .map((poi) => ({
        objectId: poi.id,
        name: poi.name,
        location: poi.location,
        kind: 'BUILDING' as const,
      }));

    return [...crossingAnchors, ...landmarkAnchors, ...poiAnchors];
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
