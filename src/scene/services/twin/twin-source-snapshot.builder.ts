import type { ExternalPlaceDetail } from '../../../places/types/external-place.types';
import type { PlacePackage } from '../../../places/types/place.types';
import type {
  ProviderTrace,
  SceneDetail,
  SceneMeta,
  SceneQualityGateResult,
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
      undefined,
    ),
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
      undefined,
    ),
  ];
}
