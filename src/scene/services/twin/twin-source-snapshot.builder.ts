import type { ExternalPlaceDetail } from '../../../places/types/external-place.types';
import type { PlacePackage } from '../../../places/types/place.types';
import type { FetchJsonEnvelope } from '../../../common/http/fetch-json';
import type {
  ProviderTrace,
  SceneDetail,
  SceneMeta,
  SceneQualityGateResult,
  SceneTrafficResponse,
  SceneWeatherResponse,
  SceneScale,
  SearchQuerySnapshotPayload,
  SourceSnapshotRecord,
  TerrainSnapshotPayload,
} from '../../types/scene.types';
import { hashValue } from './twin-hash.utils';

export interface SnapshotIds {
  place: string;
  placePackage: string;
  terrain: string;
  meta: string;
  detail: string;
  qualityGate: string;
}

export function collectSnapshotIds(
  snapshots: SourceSnapshotRecord[],
): SnapshotIds {
  return {
    place: snapshots.find((snapshot) => snapshot.kind === 'PLACE_DETAIL')!
      .snapshotId,
    placePackage: snapshots.find(
      (snapshot) => snapshot.kind === 'PLACE_PACKAGE',
    )!.snapshotId,
    terrain: snapshots.find((snapshot) => snapshot.kind === 'TERRAIN_PROFILE')!
      .snapshotId,
    meta: snapshots.find((snapshot) => snapshot.kind === 'SCENE_META')!
      .snapshotId,
    detail: snapshots.find((snapshot) => snapshot.kind === 'SCENE_DETAIL')!
      .snapshotId,
    qualityGate: snapshots.find((snapshot) => snapshot.kind === 'QUALITY_GATE')!
      .snapshotId,
  };
}

export function createSnapshot(
  sceneId: string,
  provider: SourceSnapshotRecord['provider'],
  kind: SourceSnapshotRecord['kind'],
  payload: SourceSnapshotRecord['payload'],
  fallbackCapturedAt: string,
  request: SourceSnapshotRecord['request'],
  responseSummary: SourceSnapshotRecord['responseSummary'],
  evidenceMeta?: SourceSnapshotRecord['evidenceMeta'],
  upstreamEnvelopes?: SourceSnapshotRecord['upstreamEnvelopes'],
): SourceSnapshotRecord {
  const contentHash = hashValue(payload);
  return {
    snapshotId: `snapshot-${hashValue(`${sceneId}:${provider}:${kind}`).slice(0, 12)}`,
    provider,
    kind,
    schemaVersion: 'dt.v0',
    capturedAt:
      (payload as { generatedAt?: string; decidedAt?: string }).generatedAt ??
      (payload as { decidedAt?: string }).decidedAt ??
      fallbackCapturedAt,
    contentHash,
    replayable: true,
    storage: 'INLINE_JSON',
    request,
    responseSummary,
    evidenceMeta,
    upstreamEnvelopes,
    payload,
  };
}

export function buildSourceSnapshots(
  sceneId: string,
  query: string,
  scale: SceneScale,
  providerTraces: {
    googlePlaces: ProviderTrace;
    overpass: ProviderTrace;
    mapillary?: ProviderTrace | null;
  },
  terrainProfile: TerrainSnapshotPayload,
  place: ExternalPlaceDetail,
  placePackage: PlacePackage,
  meta: SceneMeta,
  detail: SceneDetail,
  qualityGate: SceneQualityGateResult,
  weatherSnapshot?: SceneWeatherResponse,
  trafficSnapshot?: SceneTrafficResponse,
  liveStateEnvelopes?: {
    weather?: FetchJsonEnvelope[];
    traffic?: FetchJsonEnvelope[];
  },
): SourceSnapshotRecord[] {
  const searchPayload: SearchQuerySnapshotPayload = {
    query,
    scale,
    searchLimit: 1,
    resolvedRadiusM: meta.bounds.radiusM,
  };

  return [
    createSnapshot(
      sceneId,
      'GOOGLE_PLACES',
      'PLACE_SEARCH_QUERY',
      searchPayload,
      providerTraces.googlePlaces.observedAt,
      providerTraces.googlePlaces.requests[0] ?? {
        method: 'DERIVED',
        url: 'google-places-search-missing',
      },
      {
        ...providerTraces.googlePlaces.responseSummary,
        status: 'DERIVED',
        fields: ['query', 'scale', 'resolvedRadiusM'],
      },
      {
        mapperVersion: 'google-places@v1',
        normalizationRulesetId: 'google-places.search.query.v1',
        missingEvidenceKeys: [],
      },
      providerTraces.googlePlaces.upstreamEnvelopes?.slice(0, 1),
    ),
    createSnapshot(
      sceneId,
      'GOOGLE_PLACES',
      'PLACE_DETAIL',
      place,
      providerTraces.googlePlaces.observedAt,
      providerTraces.googlePlaces.requests[1] ?? {
        method: 'DERIVED',
        url: 'google-place-detail-missing',
      },
      {
        ...providerTraces.googlePlaces.responseSummary,
        objectId: place.placeId,
        status: 'SUCCESS',
        fields: [
          'displayName',
          'formattedAddress',
          'location',
          'primaryType',
          'viewport',
          'utcOffsetMinutes',
        ],
      },
      {
        mapperVersion: 'google-places@v1',
        normalizationRulesetId: 'google-places.detail.normalize.v1',
        missingEvidenceKeys: [
          place.viewport ? null : 'viewport',
          place.primaryType ? null : 'primaryType',
        ].filter((value): value is string => Boolean(value)),
      },
      providerTraces.googlePlaces.upstreamEnvelopes?.slice(1, 2),
    ),
    createSnapshot(
      sceneId,
      'OVERPASS',
      'PLACE_PACKAGE',
      placePackage,
      providerTraces.overpass.observedAt,
      providerTraces.overpass.requests[0] ?? {
        method: 'DERIVED',
        url: 'overpass-trace-missing',
      },
      {
        ...providerTraces.overpass.responseSummary,
        status: 'SUCCESS',
        itemCount:
          placePackage.buildings.length +
          placePackage.roads.length +
          placePackage.walkways.length +
          placePackage.pois.length +
          placePackage.crossings.length +
          placePackage.streetFurniture.length +
          placePackage.vegetation.length +
          placePackage.landCovers.length +
          placePackage.linearFeatures.length,
        diagnostics: {
          buildingCount: placePackage.buildings.length,
          roadCount: placePackage.roads.length,
          walkwayCount: placePackage.walkways.length,
          poiCount: placePackage.pois.length,
        },
      },
      {
        mapperVersion: 'overpass@v1',
        normalizationRulesetId: 'overpass.place-package.normalize.v1',
        missingEvidenceKeys: [
          placePackage.buildings.length > 0 ? null : 'buildings',
          placePackage.roads.length > 0 ? null : 'roads',
          placePackage.walkways.length > 0 ? null : 'walkways',
        ].filter((value): value is string => Boolean(value)),
      },
      providerTraces.overpass.upstreamEnvelopes,
    ),
    ...(providerTraces.mapillary
      ? [
          createSnapshot(
            sceneId,
            'MAPILLARY',
            'PROVIDER_TRACE',
            {
              sceneId: detail.sceneId,
              placeId: detail.placeId,
              generatedAt: detail.generatedAt,
              detailStatus: detail.detailStatus,
              crossings: [],
              roadMarkings: [],
              streetFurniture: [],
              vegetation: [],
              landCovers: [],
              linearFeatures: [],
              facadeHints: [],
              signageClusters: [],
              annotationsApplied: [],
              provenance: detail.provenance,
            } as SceneDetail,
            providerTraces.mapillary.observedAt,
            providerTraces.mapillary.requests[0] ?? {
              method: 'DERIVED',
              url: 'mapillary-trace-missing',
            },
            {
              ...providerTraces.mapillary.responseSummary,
              status:
                providerTraces.mapillary.responseSummary.status ?? 'SUCCESS',
            },
            {
              mapperVersion: 'mapillary@v1',
              normalizationRulesetId: 'mapillary.provider-trace.v1',
              missingEvidenceKeys: [
                detail.provenance.mapillaryImageCount > 0
                  ? null
                  : 'mapillaryImages',
                detail.provenance.mapillaryFeatureCount > 0
                  ? null
                  : 'mapillaryFeatures',
              ].filter((value): value is string => Boolean(value)),
            },
            providerTraces.mapillary.upstreamEnvelopes,
          ),
        ]
      : []),
    createSnapshot(
      sceneId,
      'LOCAL_TERRAIN',
      'TERRAIN_PROFILE',
      terrainProfile,
      meta.generatedAt,
      {
        method: 'DERIVED',
        url: terrainProfile.sourcePath ?? 'scene-terrain-profile',
        notes: 'terrain/elevation profile descriptor입니다.',
      },
      {
        status: 'DERIVED',
        diagnostics: {
          mode: terrainProfile.mode,
          sampleCount: terrainProfile.sampleCount,
          hasElevationModel: terrainProfile.hasElevationModel,
        },
      },
      {
        mapperVersion: 'terrain-profile@v1',
        normalizationRulesetId: 'terrain.profile.normalize.v1',
        missingEvidenceKeys: terrainProfile.hasElevationModel
          ? []
          : ['localDemSamples'],
      },
      undefined,
    ),
    ...(weatherSnapshot
      ? [
          createSnapshot(
            sceneId,
            'OPEN_METEO',
            'WEATHER_OBSERVATION',
            {
              source: weatherSnapshot.source,
              date: generatedDate(weatherSnapshot.updatedAt),
              localTime:
                weatherSnapshot.observedAt ?? weatherSnapshot.updatedAt,
              resolvedWeather: weatherSnapshot.preset.toUpperCase(),
              temperatureCelsius: weatherSnapshot.temperature,
              precipitationMm: null,
            },
            weatherSnapshot.updatedAt,
            {
              method: 'DERIVED',
              url: 'scene-weather-live',
              notes: 'Weather observation snapshot from live API cache.',
            },
            {
              status: 'SUCCESS',
              diagnostics: {
                source: weatherSnapshot.source,
                weatherCode: weatherSnapshot.weatherCode,
              },
            },
            {
              mapperVersion: 'open-meteo@v1',
              normalizationRulesetId: 'weather.live.normalize.v1',
              missingEvidenceKeys: [],
            },
            liveStateEnvelopes?.weather,
          ),
        ]
      : []),
    ...(trafficSnapshot
      ? [
          createSnapshot(
            sceneId,
            'TOMTOM',
            'TRAFFIC_FLOW',
            {
              source: trafficSnapshot.provider,
              observedAt: trafficSnapshot.updatedAt,
              segmentCount: trafficSnapshot.segments.length,
              averageCongestionScore:
                trafficSnapshot.segments.length > 0
                  ? Number(
                      (
                        trafficSnapshot.segments.reduce(
                          (sum, segment) => sum + segment.congestionScore,
                          0,
                        ) / trafficSnapshot.segments.length
                      ).toFixed(3),
                    )
                  : 0,
              degraded: trafficSnapshot.degraded,
              failedSegmentCount: trafficSnapshot.failedSegmentCount,
            },
            trafficSnapshot.updatedAt,
            {
              method: 'DERIVED',
              url: 'scene-traffic-live',
              notes: 'Traffic flow snapshot from live API cache.',
            },
            {
              status: trafficSnapshot.degraded ? 'DERIVED' : 'SUCCESS',
              diagnostics: {
                segmentCount: trafficSnapshot.segments.length,
                degraded: trafficSnapshot.degraded,
                failedSegmentCount: trafficSnapshot.failedSegmentCount,
              },
            },
            {
              mapperVersion: 'tomtom@v1',
              normalizationRulesetId: 'traffic.live.normalize.v1',
              missingEvidenceKeys: trafficSnapshot.degraded
                ? ['trafficFlowSegmentErrors']
                : [],
            },
            liveStateEnvelopes?.traffic,
          ),
        ]
      : []),
    createSnapshot(
      sceneId,
      'SCENE_PIPELINE',
      'SCENE_META',
      meta,
      meta.generatedAt,
      {
        method: 'DERIVED',
        url: 'scene-meta-builder',
        notes: 'Scene meta derived artifact snapshot입니다.',
      },
      {
        status: 'DERIVED',
        diagnostics: {
          buildingCount: meta.stats.buildingCount,
          roadCount: meta.stats.roadCount,
          poiCount: meta.stats.poiCount,
        },
      },
      {
        mapperVersion: 'scene-meta-builder@v1',
        normalizationRulesetId: 'scene.meta.derive.v1',
        missingEvidenceKeys: [],
      },
      undefined,
    ),
    createSnapshot(
      sceneId,
      'SCENE_PIPELINE',
      'SCENE_DETAIL',
      detail,
      detail.generatedAt,
      {
        method: 'DERIVED',
        url: 'scene-visual-rules',
        notes: 'Scene detail derived artifact snapshot입니다.',
      },
      {
        status: 'DERIVED',
        diagnostics: {
          crossingCount: detail.crossings.length,
          facadeHintCount: detail.facadeHints.length,
          signageClusterCount: detail.signageClusters.length,
        },
      },
      {
        mapperVersion: 'scene-visual-rules@v1',
        normalizationRulesetId: 'scene.detail.derive.v1',
        missingEvidenceKeys: [
          detail.provenance.mapillaryUsed ? null : 'mapillaryEvidence',
          detail.facadeHints.length > 0 ? null : 'facadeHints',
        ].filter((value): value is string => Boolean(value)),
      },
      undefined,
    ),
    createSnapshot(
      sceneId,
      'QUALITY_GATE',
      'QUALITY_GATE',
      qualityGate,
      qualityGate.decidedAt,
      {
        method: 'DERIVED',
        url: 'scene-quality-gate',
        notes: 'Quality gate evaluation descriptor입니다.',
      },
      {
        status: 'DERIVED',
        diagnostics: {
          state: qualityGate.state,
          totalSkipped: qualityGate.meshSummary.totalSkipped,
          invalidGeometry: qualityGate.meshSummary.emptyOrInvalidGeometryCount,
        },
      },
      {
        mapperVersion: 'scene-quality-gate@v1',
        normalizationRulesetId: 'scene.quality-gate.evaluate.v1',
        missingEvidenceKeys: [],
      },
      undefined,
    ),
  ];
}

function generatedDate(iso: string): string {
  return iso.slice(0, 10);
}
