import { Injectable } from '@nestjs/common';
import type { FetchJsonEnvelope, FetchLike } from '../../common/http/fetch-json';
import { AppLoggerService } from '../../common/logging/app-logger.service';
import type { ExternalPlaceDetail } from '../types/external-place.types';
import type { PlacePackage } from '../types/place.types';
import { createBoundsFromCenterRadius } from '../utils/geo.utils';
import {
  mapBuildings,
  mapCrossing,
  mapLandCover,
  mapLinearFeature,
  mapPoi,
  mapRoad,
  mapStreetFurniture,
  mapVegetation,
  mapWalkway,
} from './overpass/overpass.mapper';
import {
  collectDedupedElements,
  partitionOverpassElements,
} from './overpass/overpass.partitions';
import { fetchScopeResponseWithTrace } from './overpass/overpass.transport';
import type {
  BuildPlacePackageOptions,
  OverpassElement,
  OverpassResponse,
  OverpassScope,
} from './overpass/overpass.types';

export type { BuildPlacePackageOptions } from './overpass/overpass.types';

@Injectable()
export class OverpassClient {
  private fetcher: FetchLike = fetch;
  private readonly maxEndpointAttempts = 2;
  private readonly fallbackBoundScales = [1, 0.82, 0.64];
  private readonly defaultEndpoints = [
    'https://overpass.private.coffee/api/interpreter',
    'https://overpass-api.de/api/interpreter',
  ];

  constructor(private readonly appLoggerService: AppLoggerService) {}

  withFetcher(fetcher: FetchLike): this {
    this.fetcher = fetcher;
    return this;
  }

  async buildPlacePackage(
    place: ExternalPlaceDetail,
    options: BuildPlacePackageOptions = {},
  ): Promise<PlacePackage> {
    const result = await this.buildPlacePackageWithTrace(place, options);
    return result.placePackage;
  }

  async buildPlacePackageWithTrace(
    place: ExternalPlaceDetail,
    options: BuildPlacePackageOptions = {},
  ): Promise<{
    placePackage: PlacePackage;
    upstreamEnvelopes: FetchJsonEnvelope[];
  }> {
    const bounds =
      options.bounds ??
      (options.radiusM
        ? createBoundsFromCenterRadius(place.location, options.radiusM)
        : (place.viewport ??
          createBoundsFromCenterRadius(place.location, 300)));

    const scopes: Array<{
      name: OverpassScope;
      required: boolean;
    }> = [
      { name: 'core', required: true },
      { name: 'street', required: false },
      { name: 'environment', required: false },
    ];

    const responses: OverpassResponse[] = [];
    const upstreamEnvelopes: FetchJsonEnvelope[] = [];
    for (const [index, scope] of scopes.entries()) {
      try {
        const traced = await fetchScopeResponseWithTrace(
          bounds,
          scope.name,
          {
            requestId: options.requestId ?? null,
            sceneId: options.sceneId,
            batch: index,
          },
          {
            appLoggerService: this.appLoggerService,
            fetcher: this.fetcher,
            maxEndpointAttempts: this.maxEndpointAttempts,
            fallbackBoundScales: this.fallbackBoundScales,
            defaultEndpoints: this.defaultEndpoints,
          },
        );
        responses.push(traced.response);
        upstreamEnvelopes.push(...traced.upstreamEnvelopes);
      } catch (error) {
        if (scope.required) {
          throw error;
        }
        this.appLoggerService.warn('overpass.scope.degraded', {
          requestId: options.requestId ?? null,
          sceneId: options.sceneId,
          provider: 'overpass',
          step: 'overpass_scope',
          batch: index,
          scope: scope.name,
          error,
        });
        responses.push({ elements: [] });
      }
    }

    const elements = collectDedupedElements(responses);
    const partitioned = partitionOverpassElements(elements);

    this.appLoggerService.info('overpass.partition.category_counts', {
      requestId: options.requestId ?? null,
      sceneId: options.sceneId,
      provider: 'overpass',
      step: 'overpass_partition',
      categories: {
        buildingWays: partitioned.buildingWays.length,
        buildingRelations: partitioned.buildingRelations.length,
        roadWays: partitioned.roadWays.length,
        walkwayWays: partitioned.walkwayWays.length,
        crossingWays: partitioned.crossingWays.length,
        poiNodes: partitioned.poiNodes.length,
        furnitureNodes: partitioned.furnitureNodes.length,
        vegetationNodes: partitioned.vegetationNodes.length,
        landCoverWays: partitioned.landCoverWays.length,
        linearFeatureWays: partitioned.linearFeatureWays.length,
      },
      deduplicatedCount: partitioned.deduplicatedCount,
      deduplicatedByIoUCount: partitioned.deduplicatedByIoUCount,
      mergedWayRelationCount: partitioned.mergedWayRelationCount,
      mergedWayWayCount: partitioned.mergedWayWayCount,
    });

    this.appLoggerService.info('overpass.dedup.complete', {
      requestId: options.requestId ?? null,
      sceneId: options.sceneId,
      provider: 'overpass',
      step: 'overpass_partition',
      totalInput: rawBuildingElementCount(partitioned),
      afterIoUDedup:
        partitioned.buildingRelations.length + partitioned.buildingWays.length,
      removedByIoU: partitioned.deduplicatedByIoUCount,
      mergedWayRelationCount: partitioned.mergedWayRelationCount,
      mergedWayWayCount: partitioned.mergedWayWayCount,
    });

    const buildings = mapBuildings([
      ...partitioned.buildingWays,
      ...partitioned.buildingRelations,
    ]);
    const roads = partitioned.roadWays
      .map((way) => mapRoad(way))
      .filter(
        (value): value is NonNullable<ReturnType<typeof mapRoad>> =>
          value !== null,
      );
    const walkways = partitioned.walkwayWays
      .map((way) => mapWalkway(way))
      .filter(
        (value): value is NonNullable<ReturnType<typeof mapWalkway>> =>
          value !== null,
      );
    const crossings = partitioned.crossingWays
      .map((way) => mapCrossing(way))
      .filter(
        (value): value is NonNullable<ReturnType<typeof mapCrossing>> =>
          value !== null,
      );
    const pois = partitioned.poiNodes
      .map((node) => mapPoi(node))
      .filter(
        (value): value is NonNullable<ReturnType<typeof mapPoi>> =>
          value !== null,
      );
    const streetFurniture = partitioned.furnitureNodes
      .map((node) => mapStreetFurniture(node))
      .filter(
        (value): value is NonNullable<ReturnType<typeof mapStreetFurniture>> =>
          value !== null,
      );
    const vegetation = partitioned.vegetationNodes
      .map((node) => mapVegetation(node))
      .filter(
        (value): value is NonNullable<ReturnType<typeof mapVegetation>> =>
          value !== null,
      );
    const landCovers = partitioned.landCoverWays
      .map((way) => mapLandCover(way))
      .filter(
        (value): value is NonNullable<ReturnType<typeof mapLandCover>> =>
          value !== null,
      );
    const linearFeatures = partitioned.linearFeatureWays
      .map((way) => mapLinearFeature(way))
      .filter(
        (value): value is NonNullable<ReturnType<typeof mapLinearFeature>> =>
          value !== null,
      );
    const landmarks = pois.filter((poi) => poi.type === 'LANDMARK');

    return {
      placePackage: {
        placeId: place.placeId,
        version: '2026.04-external',
        generatedAt: new Date().toISOString(),
        camera: {
          topView: { x: 0, y: 180, z: 140 },
          walkViewStart: { x: 0, y: 1.7, z: 12 },
        },
        bounds,
        buildings,
        roads,
        walkways,
        pois,
        landmarks,
        crossings,
        streetFurniture,
        vegetation,
        landCovers,
        linearFeatures,
        diagnostics: {
          droppedBuildings:
            partitioned.buildingWays.length +
            partitioned.buildingRelations.length -
            buildings.length,
          deduplicatedBuildings: partitioned.deduplicatedCount,
          deduplicatedBuildingsByIoU: partitioned.deduplicatedByIoUCount,
          mergedWayRelationBuildings: partitioned.mergedWayRelationCount,
          mergedWayWayBuildings: partitioned.mergedWayWayCount,
          droppedRoads: partitioned.roadWays.length - roads.length,
          droppedWalkways: partitioned.walkwayWays.length - walkways.length,
          droppedPois: partitioned.poiNodes.length - pois.length,
          droppedCrossings: partitioned.crossingWays.length - crossings.length,
          droppedStreetFurniture:
            partitioned.furnitureNodes.length - streetFurniture.length,
          droppedVegetation:
            partitioned.vegetationNodes.length - vegetation.length,
          droppedLandCovers:
            partitioned.landCoverWays.length - landCovers.length,
          droppedLinearFeatures:
            partitioned.linearFeatureWays.length - linearFeatures.length,
        },
      },
      upstreamEnvelopes,
    };
  }
}

function rawBuildingElementCount(partitioned: {
  buildingRelations: OverpassElement[];
  buildingWays: OverpassElement[];
  deduplicatedCount: number;
}): number {
  return (
    partitioned.buildingRelations.length +
    partitioned.buildingWays.length +
    partitioned.deduplicatedCount
  );
}
