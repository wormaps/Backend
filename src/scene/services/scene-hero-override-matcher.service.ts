import { Injectable } from '@nestjs/common';
import { ExternalPlaceDetail } from '../../places/types/external-place.types';
import { Coordinate } from '../../places/types/place.types';
import { SceneMeta } from '../types/scene.types';
import {
  HeroOverrideManifest,
  SHIBUYA_SCRAMBLE_CROSSING_OVERRIDE,
} from '../overrides/shibuya-scramble-crossing.override';

@Injectable()
export class SceneHeroOverrideMatcherService {
  private readonly manifests = [SHIBUYA_SCRAMBLE_CROSSING_OVERRIDE];

  findManifest(place: ExternalPlaceDetail): HeroOverrideManifest | null {
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

  findMatchingBuilding(
    meta: SceneMeta,
    override: HeroOverrideManifest['facadeOverrides'][number],
  ): SceneMeta['buildings'][number] | null {
    return (
      (override.objectId
        ? meta.buildings.find((building) => building.objectId === override.objectId)
        : null) ??
      this.findNearest(meta.buildings, override.anchor, (item) =>
        averageCoordinate(item.outerRing) ?? item.outerRing[0],
      )
    );
  }

  findApplicableFacadeOverride(
    building: SceneMeta['buildings'][number],
    manifest: HeroOverrideManifest,
  ): HeroOverrideManifest['facadeOverrides'][number] | null {
    const anchor = averageCoordinate(building.outerRing) ?? building.outerRing[0];
    const override =
      manifest.facadeOverrides.find((item) => item.objectId === building.objectId) ??
      this.findNearest(manifest.facadeOverrides, anchor, (item) => item.anchor);

    if (
      !override ||
      (override.objectId && override.objectId !== building.objectId) ||
      squaredDistance(override.anchor, anchor) > 90 ** 2
    ) {
      return null;
    }

    return override;
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
