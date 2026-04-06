import { Injectable } from '@nestjs/common';
import { ExternalPlaceDetail } from '../../places/types/external-place.types';
import { Coordinate } from '../../places/types/place.types';
import { LandmarkAnnotationManifest, SceneMeta } from '../types/scene.types';
import { SHIBUYA_SCRAMBLE_CROSSING_OVERRIDE } from '../overrides/shibuya-scramble-crossing.override';

@Injectable()
export class SceneHeroOverrideMatcherService {
  private readonly manifests = [SHIBUYA_SCRAMBLE_CROSSING_OVERRIDE];
  private readonly fallbackMatchRadiusMeters = 22;

  findManifest(place: ExternalPlaceDetail): LandmarkAnnotationManifest | null {
    return (
      this.manifests.find((manifest) =>
        manifest.match.placeIds.includes(place.placeId) ||
        manifest.match.aliases.some(
          (alias) =>
            place.displayName.toLowerCase().includes(alias.toLowerCase()) ||
            alias.toLowerCase().includes(place.displayName.toLowerCase()),
        ),
      ) ?? null
    );
  }

  findMatchingLandmarkBuilding(
    meta: SceneMeta,
    annotation: LandmarkAnnotationManifest['landmarks'][number],
  ): SceneMeta['buildings'][number] | null {
    const exact = annotation.objectId
      ? meta.buildings.find((building) => building.objectId === annotation.objectId) ?? null
      : null;
    if (exact) {
      return exact;
    }

    const nearest = this.findNearest(meta.buildings, annotation.anchor, (item) =>
      averageCoordinate(item.outerRing) ?? item.outerRing[0],
    );
    if (!nearest) {
      return null;
    }

    const nearestAnchor = averageCoordinate(nearest.outerRing) ?? nearest.outerRing[0];
    return squaredDistance(annotation.anchor, nearestAnchor) <= this.fallbackMatchRadiusMeters ** 2
      ? nearest
      : null;
  }

  resolveLandmarkAssignments(
    meta: SceneMeta,
    manifest: LandmarkAnnotationManifest,
  ): Map<string, LandmarkAnnotationManifest['landmarks'][number]> {
    const assignments = new Map<string, LandmarkAnnotationManifest['landmarks'][number]>();
    const usedBuildings = new Set<string>();

    for (const annotation of manifest.landmarks.filter((item) => item.kind === 'BUILDING')) {
      const matched = this.findPreferredBuilding(meta, annotation, usedBuildings);
      if (!matched) {
        continue;
      }
      assignments.set(matched.objectId, annotation);
      usedBuildings.add(matched.objectId);
    }

    return assignments;
  }

  private findNearest<T>(
    items: T[],
    anchor: Coordinate,
    getPoint: (item: T) => Coordinate,
  ): T | null {
    let best: { item: T; distance: number } | null = null;

    for (const item of items) {
      const point = getPoint(item);
      const distance = squaredDistance(anchor, point);
      if (!best || distance < best.distance) {
        best = { item, distance };
      }
    }

    return best?.item ?? null;
  }

  private findPreferredBuilding(
    meta: SceneMeta,
    annotation: LandmarkAnnotationManifest['landmarks'][number],
    usedBuildings: Set<string>,
  ): SceneMeta['buildings'][number] | null {
    if (annotation.objectId) {
      const exact =
        meta.buildings.find((building) => building.objectId === annotation.objectId) ?? null;
      if (exact && !usedBuildings.has(exact.objectId)) {
        return exact;
      }
    }

    const nearest = this.findNearest(
      meta.buildings.filter((building) => !usedBuildings.has(building.objectId)),
      annotation.anchor,
      (item) => averageCoordinate(item.outerRing) ?? item.outerRing[0],
    );
    if (!nearest) {
      return null;
    }

    const nearestAnchor = averageCoordinate(nearest.outerRing) ?? nearest.outerRing[0];
    return squaredDistance(annotation.anchor, nearestAnchor) <= this.fallbackMatchRadiusMeters ** 2
      ? nearest
      : null;
  }
}

function averageCoordinate(points: Coordinate[]): Coordinate | null {
  if (points.length === 0) {
    return null;
  }

  const total = points.reduce(
    (acc, point) => ({
      lat: acc.lat + point.lat,
      lng: acc.lng + point.lng,
    }),
    { lat: 0, lng: 0 },
  );

  return {
    lat: total.lat / points.length,
    lng: total.lng / points.length,
  };
}

function squaredDistance(a: Coordinate, b: Coordinate): number {
  const dx = (a.lng - b.lng) * 111_320;
  const dy = (a.lat - b.lat) * 111_320;
  return dx * dx + dy * dy;
}
