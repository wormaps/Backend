import { Injectable } from '@nestjs/common';
import type { ExternalPlaceDetail } from '../../../places/types/external-place.types';
import type { PlacePackage } from '../../../places/types/place.types';
import type { FetchJsonEnvelope } from '../../../common/http/fetch-json';
import type {
  SceneTrafficResponse,
  SceneWeatherResponse,
  ProviderTrace,
  SceneDetail,
  SceneMeta,
  SceneQualityGateResult,
  SceneScale,
  SceneTwinGraph,
  TwinComponent,
  TwinEntity,
  TwinEvidence,
  TwinRelationship,
  ValidationReport,
  TwinEntityKind,
} from '../../types/scene.types';
import { SceneTerrainProfileService } from '../spatial';
import { hashValue } from './twin-hash.utils';
import {
  buildSourceSnapshots,
  collectSnapshotIds,
} from './twin-source-snapshot.builder';
import { buildSpatialFrame } from './twin-spatial-frame.builder';
import { registerAllEntities } from './twin-entity.builders';
import {
  buildValidationReport,
  countTwinPropertyOrigins,
} from './twin-validation.builder';

interface BuildSceneTwinArgs {
  sceneId: string;
  query: string;
  scale: SceneScale;
  place: ExternalPlaceDetail;
  placePackage: PlacePackage;
  meta: SceneMeta;
  detail: SceneDetail;
  assetPath: string;
  qualityGate: SceneQualityGateResult;
  providerTraces: {
    googlePlaces: ProviderTrace;
    overpass: ProviderTrace;
    mapillary?: ProviderTrace | null;
  };
  weatherSnapshot?: SceneWeatherResponse;
  trafficSnapshot?: SceneTrafficResponse;
  liveStateEnvelopes?: {
    weather?: FetchJsonEnvelope[];
    traffic?: FetchJsonEnvelope[];
  };
}

@Injectable()
export class SceneTwinBuilderService {
  constructor(
    private readonly sceneTerrainProfileService: SceneTerrainProfileService,
  ) {}

  build({
    sceneId,
    query,
    scale,
    place,
    placePackage,
    meta,
    detail,
    assetPath,
    qualityGate,
    providerTraces,
    weatherSnapshot,
    trafficSnapshot,
    liveStateEnvelopes,
  }: BuildSceneTwinArgs): {
    twin: SceneTwinGraph;
    validation: ValidationReport;
  } {
    const generatedAt = meta.generatedAt;
    const terrainProfile =
      meta.terrainProfile ??
      this.sceneTerrainProfileService.resolve(sceneId, meta);

    const snapshots = buildSourceSnapshots(
      sceneId,
      query,
      scale,
      providerTraces,
      terrainProfile,
      place,
      placePackage,
      meta,
      detail,
      qualityGate,
      weatherSnapshot,
      trafficSnapshot,
      liveStateEnvelopes,
    );
    const snapshotIds = collectSnapshotIds(snapshots);

    const spatialFrame = buildSpatialFrame(
      sceneId,
      meta,
      generatedAt,
      terrainProfile,
    );

    const buildId = `build-${hashValue(
      snapshots.map((snapshot) => snapshot.contentHash).join(':'),
    ).slice(0, 12)}`;
    const delivery = {
      buildId,
      sceneId,
      generatedAt,
      scale,
      artifacts: [
        {
          artifactId: `artifact-${hashValue(`${sceneId}:glb`).slice(0, 12)}`,
          type: 'GLB' as const,
          apiPath: `/api/scenes/${sceneId}/assets/base.glb`,
          localPath: assetPath,
          derivedFromSnapshotIds: [
            snapshotIds.place,
            snapshotIds.placePackage,
            snapshotIds.meta,
            snapshotIds.detail,
          ],
          semanticMetadataCoverage: 'PARTIAL' as const,
        },
        {
          artifactId: `artifact-${hashValue(`${sceneId}:meta`).slice(0, 12)}`,
          type: 'SCENE_META' as const,
          apiPath: `/api/scenes/${sceneId}/meta`,
          localPath: null,
          derivedFromSnapshotIds: [snapshotIds.meta],
          semanticMetadataCoverage: 'PARTIAL' as const,
        },
        {
          artifactId: `artifact-${hashValue(`${sceneId}:detail`).slice(0, 12)}`,
          type: 'SCENE_DETAIL' as const,
          apiPath: `/api/scenes/${sceneId}/detail`,
          localPath: null,
          derivedFromSnapshotIds: [snapshotIds.detail],
          semanticMetadataCoverage: 'PARTIAL' as const,
        },
      ],
    };

    const entities: TwinEntity[] = [];
    const components: TwinComponent[] = [];
    const relationships: TwinRelationship[] = [];
    const evidence: TwinEvidence[] = [];

    registerAllEntities({
      entities,
      components,
      relationships,
      evidence,
      sceneId,
      snapshotIds,
      meta,
      detail,
      scale,
      terrainProfile,
      place,
    });

    const sceneEntityId = `entity-${hashValue(`${sceneId}:scene`).slice(0, 12)}`;

    const entityStateBindings = buildEntityStateBindings(
      entities,
      components,
      snapshotIds.detail,
    );

    const validation = buildValidationReport({
      sceneId,
      generatedAt,
      twinEntityCount: entities.length,
      twinComponentCount: components.length,
      evidenceCount: evidence.length,
      deliveryArtifactCount: delivery.artifacts.length,
      spatialFrame,
      assetPath,
      qualityGate,
      detail,
      sceneStateBindingCount: 1,
      entityStateBindingCount: entityStateBindings.length,
      twinPropertyOriginCounts: countTwinPropertyOrigins(components),
    });

    const twin: SceneTwinGraph = {
      twinId: `twin-${hashValue(sceneId).slice(0, 12)}`,
      sceneId,
      buildId,
      generatedAt,
      sourceSnapshots: {
        manifestId: `snapshots-${hashValue(sceneId).slice(0, 12)}`,
        sceneId,
        generatedAt,
        snapshots,
      },
      spatialFrame,
      entities,
      relationships,
      components,
      evidence,
      delivery,
      stateChannels: [
        {
          channelId: `state-${hashValue(`${sceneId}:synthetic`).slice(0, 12)}`,
          mode: 'SYNTHETIC_RULES',
          bindingScope: 'SCENE',
          entityId: sceneEntityId,
          bindings: [
            {
              entityId: sceneEntityId,
              componentKind: 'STATE_BINDING',
              propertyNames: ['stateMode'],
            },
          ],
          supportedQueries: ['timeOfDay', 'weather', 'date'],
          notes: 'Scene synthetic rules state channel입니다.',
        },
        {
          channelId: `state-${hashValue(`${sceneId}:entity-synthetic`).slice(0, 12)}`,
          mode: 'SYNTHETIC_RULES',
          bindingScope: 'ENTITY',
          entityId: sceneEntityId,
          bindings: entityStateBindings,
          supportedQueries: ['timeOfDay', 'weather', 'date'],
          notes:
            'Entity synthetic rules state channel입니다. entity kind/objectId 기반 조회를 지원합니다.',
        },
      ],
      landmarkAnchors: meta.landmarkAnchors,
      stats: {
        entityCount: entities.length,
        componentCount: components.length,
        relationshipCount: relationships.length,
        evidenceCount: evidence.length,
      },
    };

    return { twin, validation };
  }
}

function buildEntityStateBindings(
  entities: TwinEntity[],
  components: TwinComponent[],
  detailSnapshotId: string,
): Array<{
  entityId: string;
  componentKind: 'STATE_BINDING';
  propertyNames: ['stateMode'];
}> {
  const excludedKinds = new Set<TwinEntityKind>(['SCENE', 'PLACE']);
  const entityIds = entities
    .filter((entity) => !excludedKinds.has(entity.kind))
    .map((entity) => entity.entityId);

  const existingStateBindingEntities = new Set(
    components
      .filter((component) => component.kind === 'STATE_BINDING')
      .map((component) => component.entityId),
  );

  for (const entityId of entityIds) {
    if (existingStateBindingEntities.has(entityId)) {
      continue;
    }
    const componentId = `component-${hashValue(`${entityId}:STATE_BINDING:Entity State Binding`).slice(0, 12)}`;
    components.push({
      componentId,
      entityId,
      kind: 'STATE_BINDING',
      label: 'Entity State Binding',
      properties: [
        {
          propertyId: `property-${hashValue(`${entityId}:stateMode`).slice(0, 12)}`,
          name: 'stateMode',
          value: 'SYNTHETIC_RULES',
          valueType: 'string',
          origin: 'defaulted',
          confidence: 0.4,
          sourceSnapshotIds: [detailSnapshotId],
          evidenceIds: [],
        },
      ],
    });
    const targetEntity = entities.find(
      (entity) => entity.entityId === entityId,
    );
    if (targetEntity) {
      targetEntity.componentIds.push(componentId);
    }
  }

  return entityIds.map((entityId) => ({
    entityId,
    componentKind: 'STATE_BINDING',
    propertyNames: ['stateMode'] as const,
  }));
}
