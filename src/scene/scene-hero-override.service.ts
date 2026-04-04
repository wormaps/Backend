import { Injectable } from '@nestjs/common';
import { ExternalPlaceDetail } from '../places/external-place.types';
import { midpoint } from '../places/geo.utils';
import { Coordinate } from '../places/place.types';
import {
  SceneCrossingDetail,
  SceneDetail,
  SceneFacadeHint,
  SceneLandmarkAnchor,
  SceneMeta,
  SceneSignageCluster,
  SceneStreetFurnitureDetail,
} from './scene.types';
import {
  HeroOverrideManifest,
  SHIBUYA_SCRAMBLE_CROSSING_OVERRIDE,
} from './hero-overrides/shibuya-scramble-crossing.override';

@Injectable()
export class SceneHeroOverrideService {
  private readonly manifests = [SHIBUYA_SCRAMBLE_CROSSING_OVERRIDE];

  applyOverrides(
    place: ExternalPlaceDetail,
    meta: SceneMeta,
    detail: SceneDetail,
  ): {
    meta: SceneMeta;
    detail: SceneDetail;
  } {
    const manifest = this.findManifest(place);
    if (!manifest) {
      return { meta, detail };
    }

    const facadeHints = this.mergeFacadeHints(meta, detail, manifest);
    const crossings = mergeByObjectId(
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
        principal: crossing.principal ?? true,
        style: crossing.style,
      })),
    );
    const streetFurniture = mergeByObjectId(
      detail.streetFurniture,
      manifest.streetFurniture.map((item) => ({
        objectId: item.id,
        name: item.id,
        type: item.type,
        location: item.location,
        principal: item.principal ?? true,
      })),
    );
    const signageClusters = mergeByObjectId(
      detail.signageClusters,
      manifest.signageClusters.map((cluster) => ({
        objectId: cluster.id,
        anchor: cluster.anchor,
        panelCount: cluster.panelCount,
        palette: cluster.palette,
        emissiveStrength: cluster.emissiveStrength,
        widthMeters: cluster.widthMeters,
        heightMeters: cluster.heightMeters,
      })),
    );
    const landmarkAnchors = mergeByObjectId(
      meta.landmarkAnchors,
      manifest.landmarkAnchors.map((anchor) => ({
        objectId: anchor.id,
        name: anchor.name,
        location: anchor.location,
        kind: anchor.kind,
      })),
    );
    const heroOverridesApplied = [
      ...detail.heroOverridesApplied,
      manifest.id,
      ...manifest.crossings.map((item) => item.id),
      ...manifest.signageClusters.map((item) => item.id),
      ...manifest.facadeOverrides.map((item) => item.id),
    ];

    const mergedDetail: SceneDetail = {
      ...detail,
      detailStatus: detail.detailStatus === 'OSM_ONLY' ? 'PARTIAL' : detail.detailStatus,
      crossings,
      streetFurniture,
      facadeHints,
      signageClusters,
      heroOverridesApplied,
      provenance: {
        ...detail.provenance,
        overrideCount: heroOverridesApplied.length,
      },
    };

    const mergedMeta: SceneMeta = {
      ...meta,
      detailStatus: mergedDetail.detailStatus,
      landmarkAnchors,
      materialClasses: summarizeMaterialClasses(facadeHints),
      visualCoverage: {
        structure: meta.visualCoverage.structure,
        streetDetail: clampCoverage(meta.visualCoverage.streetDetail + 0.25),
        landmark: clampCoverage(meta.visualCoverage.landmark + 0.35),
        signage: clampCoverage(meta.visualCoverage.signage + 0.4),
      },
    };

    return {
      meta: mergedMeta,
      detail: mergedDetail,
    };
  }

  private mergeFacadeHints(
    meta: SceneMeta,
    detail: SceneDetail,
    manifest: HeroOverrideManifest,
  ): SceneFacadeHint[] {
    const overridden = manifest.facadeOverrides.map((override) => {
      const nearestBuilding = findNearest(meta.buildings, override.anchor, (item) =>
        averageCoordinate(item.footprint) ?? item.footprint[0],
      );
      return {
        objectId: nearestBuilding?.objectId ?? override.id,
        anchor: override.anchor,
        palette: override.palette,
        materialClass: override.materialClass,
        signageDensity: override.signageDensity,
        emissiveStrength: override.emissiveStrength,
        glazingRatio: override.glazingRatio,
      };
    });

    return mergeByObjectId(detail.facadeHints, overridden);
  }

  private findManifest(place: ExternalPlaceDetail): HeroOverrideManifest | null {
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
}

function findNearest<T>(
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

function mergeByObjectId<
  T extends { objectId: string },
>(base: T[], overrides: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of base) {
    map.set(item.objectId, item);
  }
  for (const item of overrides) {
    map.set(item.objectId, item);
  }
  return [...map.values()];
}

function summarizeMaterialClasses(facadeHints: SceneFacadeHint[]) {
  const grouped = new Map<
    SceneFacadeHint['materialClass'],
    { buildingCount: number; palette: string[] }
  >();

  for (const hint of facadeHints) {
    const current = grouped.get(hint.materialClass) ?? {
      buildingCount: 0,
      palette: [],
    };
    current.buildingCount += 1;
    current.palette = [...new Set([...current.palette, ...hint.palette])].slice(0, 3);
    grouped.set(hint.materialClass, current);
  }

  return [...grouped.entries()].map(([className, value]) => ({
    className,
    palette: value.palette,
    buildingCount: value.buildingCount,
  }));
}

function clampCoverage(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}

