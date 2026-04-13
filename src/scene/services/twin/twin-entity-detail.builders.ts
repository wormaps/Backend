import type {
  TwinComponent,
  TwinEntity,
  TwinEvidence,
  TwinRelationship,
} from '../../types/scene.types';
import {
  createEntityId,
  createProperty,
  registerEntity,
} from './twin-entity-registration.builder';
import type { SnapshotIds } from './twin-source-snapshot.builder';

interface EntityBuildContext {
  entities: TwinEntity[];
  components: TwinComponent[];
  relationships: TwinRelationship[];
  evidence: TwinEvidence[];
  sceneId: string;
  snapshotIds: SnapshotIds;
  detail: import('../../types/scene.types').SceneDetail;
  meta: import('../../types/scene.types').SceneMeta;
}

export function registerCrossings(
  ctx: EntityBuildContext,
  sceneEntityId: string,
): void {
  const {
    entities,
    components,
    relationships,
    evidence,
    sceneId,
    snapshotIds,
    detail,
  } = ctx;

  for (const crossing of detail.crossings) {
    const entityId = createEntityId(sceneId, crossing.objectId);
    registerEntity({
      entities,
      components,
      relationships,
      evidence,
      sceneId,
      entityId,
      kind: 'CROSSING',
      objectId: crossing.objectId,
      label: crossing.name,
      sourceObjectId: crossing.objectId,
      sourceSnapshotIds: [snapshotIds.detail],
      parentEntityId: sceneEntityId,
      evidenceInputs: [
        {
          kind: 'GEOMETRY',
          sourceSnapshotId: snapshotIds.detail,
          confidence: 0.8,
          provenance: 'observed',
          summary: 'Crossing overlay derived from scene road vision.',
          payload: { style: crossing.style, pathPoints: crossing.path.length },
        },
      ],
      componentSpecs: [
        {
          kind: 'SPATIAL',
          label: 'Crossing Spatial',
          properties: [
            createProperty(
              entityId,
              'path',
              crossing.path,
              'coordinate_array',
              'observed',
              0.8,
              [snapshotIds.detail],
            ),
            createProperty(
              entityId,
              'center',
              crossing.center,
              'coordinate',
              'observed',
              0.8,
              [snapshotIds.detail],
            ),
          ],
        },
        {
          kind: 'STRUCTURE',
          label: 'Crossing Structure',
          properties: [
            createProperty(
              entityId,
              'style',
              crossing.style,
              'string',
              'observed',
              0.8,
              [snapshotIds.detail],
            ),
            createProperty(
              entityId,
              'signalized',
              crossing.signalized,
              'boolean',
              'observed',
              0.8,
              [snapshotIds.detail],
            ),
          ],
        },
      ],
    });
  }
}

export function registerStreetFurniture(
  ctx: EntityBuildContext,
  sceneEntityId: string,
): void {
  const {
    entities,
    components,
    relationships,
    evidence,
    sceneId,
    snapshotIds,
    detail,
  } = ctx;

  for (const item of detail.streetFurniture) {
    const entityId = createEntityId(sceneId, item.objectId);
    registerEntity({
      entities,
      components,
      relationships,
      evidence,
      sceneId,
      entityId,
      kind: 'STREET_FURNITURE',
      objectId: item.objectId,
      label: item.name,
      sourceObjectId: item.objectId,
      sourceSnapshotIds: [snapshotIds.detail],
      parentEntityId: sceneEntityId,
      evidenceInputs: [
        {
          kind: 'SEMANTIC',
          sourceSnapshotId: snapshotIds.detail,
          confidence: 0.78,
          provenance: 'observed',
          summary: 'Street furniture detail derived from scene vision.',
          payload: { type: item.type, principal: item.principal },
        },
      ],
      componentSpecs: [
        {
          kind: 'IDENTITY',
          label: 'Street Furniture Identity',
          properties: [
            createProperty(
              entityId,
              'type',
              item.type,
              'string',
              'observed',
              0.78,
              [snapshotIds.detail],
            ),
          ],
        },
        {
          kind: 'SPATIAL',
          label: 'Street Furniture Spatial',
          properties: [
            createProperty(
              entityId,
              'location',
              item.location,
              'coordinate',
              'observed',
              0.78,
              [snapshotIds.detail],
            ),
          ],
        },
      ],
    });
  }
}

export function registerVegetation(
  ctx: EntityBuildContext,
  sceneEntityId: string,
): void {
  const {
    entities,
    components,
    relationships,
    evidence,
    sceneId,
    snapshotIds,
    detail,
  } = ctx;

  for (const item of detail.vegetation) {
    const entityId = createEntityId(sceneId, item.objectId);
    registerEntity({
      entities,
      components,
      relationships,
      evidence,
      sceneId,
      entityId,
      kind: 'VEGETATION',
      objectId: item.objectId,
      label: item.name,
      sourceObjectId: item.objectId,
      sourceSnapshotIds: [snapshotIds.detail],
      parentEntityId: sceneEntityId,
      evidenceInputs: [
        {
          kind: 'SEMANTIC',
          sourceSnapshotId: snapshotIds.detail,
          confidence: 0.76,
          provenance: 'observed',
          summary: 'Vegetation detail derived from scene vision.',
          payload: { type: item.type, radiusMeters: item.radiusMeters },
        },
      ],
      componentSpecs: [
        {
          kind: 'SPATIAL',
          label: 'Vegetation Spatial',
          properties: [
            createProperty(
              entityId,
              'location',
              item.location,
              'coordinate',
              'observed',
              0.76,
              [snapshotIds.detail],
            ),
          ],
        },
        {
          kind: 'STRUCTURE',
          label: 'Vegetation Structure',
          properties: [
            createProperty(
              entityId,
              'radiusMeters',
              item.radiusMeters,
              'number',
              'observed',
              0.76,
              [snapshotIds.detail],
            ),
          ],
        },
      ],
    });
  }
}

export function registerLandCovers(
  ctx: EntityBuildContext,
  sceneEntityId: string,
): void {
  const {
    entities,
    components,
    relationships,
    evidence,
    sceneId,
    snapshotIds,
    detail,
  } = ctx;

  for (const item of detail.landCovers) {
    const entityId = createEntityId(sceneId, item.id);
    registerEntity({
      entities,
      components,
      relationships,
      evidence,
      sceneId,
      entityId,
      kind: 'LAND_COVER',
      objectId: item.id,
      label: item.type,
      sourceObjectId: item.id,
      sourceSnapshotIds: [snapshotIds.detail, snapshotIds.placePackage],
      parentEntityId: sceneEntityId,
      evidenceInputs: [
        {
          kind: 'GEOMETRY',
          sourceSnapshotId: snapshotIds.placePackage,
          confidence: 0.82,
          provenance: 'observed',
          summary: 'Land cover polygon derived from normalized place package.',
          payload: { type: item.type, pointCount: item.polygon.length },
        },
      ],
      componentSpecs: [
        {
          kind: 'SPATIAL',
          label: 'Land Cover Spatial',
          properties: [
            createProperty(
              entityId,
              'polygon',
              item.polygon,
              'coordinate_array',
              'observed',
              0.82,
              [snapshotIds.placePackage],
            ),
          ],
        },
      ],
    });
  }
}

export function registerLinearFeatures(
  ctx: EntityBuildContext,
  sceneEntityId: string,
): void {
  const {
    entities,
    components,
    relationships,
    evidence,
    sceneId,
    snapshotIds,
    detail,
  } = ctx;

  for (const item of detail.linearFeatures) {
    const entityId = createEntityId(sceneId, item.id);
    registerEntity({
      entities,
      components,
      relationships,
      evidence,
      sceneId,
      entityId,
      kind: 'LINEAR_FEATURE',
      objectId: item.id,
      label: item.type,
      sourceObjectId: item.id,
      sourceSnapshotIds: [snapshotIds.detail, snapshotIds.placePackage],
      parentEntityId: sceneEntityId,
      evidenceInputs: [
        {
          kind: 'GEOMETRY',
          sourceSnapshotId: snapshotIds.placePackage,
          confidence: 0.82,
          provenance: 'observed',
          summary: 'Linear feature path derived from normalized place package.',
          payload: { type: item.type, pathPoints: item.path.length },
        },
      ],
      componentSpecs: [
        {
          kind: 'SPATIAL',
          label: 'Linear Feature Spatial',
          properties: [
            createProperty(
              entityId,
              'path',
              item.path,
              'coordinate_array',
              'observed',
              0.82,
              [snapshotIds.placePackage],
            ),
          ],
        },
      ],
    });
  }
}

export function registerLandmarkAnchors(
  ctx: EntityBuildContext,
  sceneEntityId: string,
): void {
  const {
    entities,
    components,
    relationships,
    evidence,
    sceneId,
    snapshotIds,
    meta,
  } = ctx;

  for (const anchor of meta.landmarkAnchors) {
    const entityId = createEntityId(sceneId, `landmark-${anchor.objectId}`);
    registerEntity({
      entities,
      components,
      relationships,
      evidence,
      sceneId,
      entityId,
      kind: 'LANDMARK',
      objectId: `landmark-${anchor.objectId}`,
      label: anchor.name,
      sourceObjectId: anchor.objectId,
      sourceSnapshotIds: [snapshotIds.meta],
      parentEntityId: sceneEntityId,
      evidenceInputs: [
        {
          kind: 'SEMANTIC',
          sourceSnapshotId: snapshotIds.meta,
          confidence: 0.85,
          provenance: 'observed',
          summary:
            'Landmark anchor derived from scene meta landmark detection.',
          payload: { kind: anchor.kind, location: anchor.location },
        },
      ],
      componentSpecs: [
        {
          kind: 'IDENTITY',
          label: 'Landmark Identity',
          properties: [
            createProperty(
              entityId,
              'kind',
              anchor.kind,
              'string',
              'observed',
              0.85,
              [snapshotIds.meta],
            ),
          ],
        },
        {
          kind: 'SPATIAL',
          label: 'Landmark Spatial',
          properties: [
            createProperty(
              entityId,
              'location',
              anchor.location,
              'coordinate',
              'observed',
              0.85,
              [snapshotIds.meta],
            ),
          ],
        },
      ],
    });
  }
}
