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
  meta: import('../../types/scene.types').SceneMeta;
}

export function registerRoads(
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

  for (const road of meta.roads) {
    const entityId = createEntityId(sceneId, road.objectId);
    registerEntity({
      entities,
      components,
      relationships,
      evidence,
      sceneId,
      entityId,
      kind: 'ROAD',
      objectId: road.objectId,
      label: road.name,
      sourceObjectId: road.osmWayId,
      sourceSnapshotIds: [snapshotIds.placePackage, snapshotIds.meta],
      parentEntityId: sceneEntityId,
      evidenceInputs: [
        {
          kind: 'GEOMETRY',
          sourceSnapshotId: snapshotIds.placePackage,
          confidence: 0.92,
          provenance: 'observed',
          summary: 'Road geometry derived from normalized Overpass package.',
          payload: {
            osmWayId: road.osmWayId,
            pathPoints: road.path.length,
            widthMeters: road.widthMeters,
          },
        },
      ],
      componentSpecs: [
        {
          kind: 'IDENTITY',
          label: 'Road Identity',
          properties: [
            createProperty(
              entityId,
              'name',
              road.name,
              'string',
              'observed',
              0.9,
              [snapshotIds.meta],
            ),
            createProperty(
              entityId,
              'roadClass',
              road.roadClass,
              'string',
              'observed',
              0.9,
              [snapshotIds.placePackage],
            ),
          ],
        },
        {
          kind: 'SPATIAL',
          label: 'Road Spatial',
          properties: [
            createProperty(
              entityId,
              'path',
              road.path,
              'coordinate_array',
              'observed',
              0.92,
              [snapshotIds.placePackage],
            ),
            createProperty(
              entityId,
              'center',
              road.center,
              'coordinate',
              'observed',
              0.9,
              [snapshotIds.meta],
            ),
          ],
        },
        {
          kind: 'STRUCTURE',
          label: 'Road Structure',
          properties: [
            createProperty(
              entityId,
              'widthMeters',
              road.widthMeters,
              'number',
              'observed',
              0.92,
              [snapshotIds.placePackage],
            ),
            createProperty(
              entityId,
              'laneCount',
              road.laneCount,
              'number',
              'observed',
              0.92,
              [snapshotIds.placePackage],
            ),
            createProperty(
              entityId,
              'terrainOffsetM',
              road.terrainOffsetM ?? 0,
              'number',
              road.terrainSampleHeightMeters !== undefined
                ? 'observed'
                : 'defaulted',
              road.terrainSampleHeightMeters !== undefined ? 0.82 : 0.2,
              [snapshotIds.terrain],
            ),
          ],
        },
      ],
    });
  }
}

export function registerWalkways(
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

  for (const walkway of meta.walkways) {
    const entityId = createEntityId(sceneId, walkway.objectId);
    registerEntity({
      entities,
      components,
      relationships,
      evidence,
      sceneId,
      entityId,
      kind: 'WALKWAY',
      objectId: walkway.objectId,
      label: walkway.name,
      sourceObjectId: walkway.osmWayId,
      sourceSnapshotIds: [snapshotIds.placePackage, snapshotIds.meta],
      parentEntityId: sceneEntityId,
      evidenceInputs: [
        {
          kind: 'GEOMETRY',
          sourceSnapshotId: snapshotIds.placePackage,
          confidence: 0.9,
          provenance: 'observed',
          summary: 'Walkway path derived from normalized Overpass package.',
          payload: {
            osmWayId: walkway.osmWayId,
            pathPoints: walkway.path.length,
          },
        },
      ],
      componentSpecs: [
        {
          kind: 'SPATIAL',
          label: 'Walkway Spatial',
          properties: [
            createProperty(
              entityId,
              'path',
              walkway.path,
              'coordinate_array',
              'observed',
              0.9,
              [snapshotIds.placePackage],
            ),
            createProperty(
              entityId,
              'terrainOffsetM',
              walkway.terrainOffsetM ?? 0,
              'number',
              walkway.terrainOffsetM != null ? 'observed' : 'defaulted',
              walkway.terrainOffsetM != null ? 0.82 : 0.4,
              [snapshotIds.meta, snapshotIds.terrain],
            ),
          ],
        },
      ],
    });
  }
}

export function registerPois(
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
  const landmarkObjectIds = new Set(
    meta.landmarkAnchors.map((item) => item.objectId),
  );

  for (const poi of meta.pois) {
    const entityId = createEntityId(sceneId, poi.objectId);
    registerEntity({
      entities,
      components,
      relationships,
      evidence,
      sceneId,
      entityId,
      kind: landmarkObjectIds.has(poi.objectId) ? 'LANDMARK' : 'POI',
      objectId: poi.objectId,
      label: poi.name,
      sourceObjectId: poi.placeId ?? poi.objectId,
      sourceSnapshotIds: [snapshotIds.placePackage, snapshotIds.meta],
      parentEntityId: sceneEntityId,
      evidenceInputs: [
        {
          kind: 'SEMANTIC',
          sourceSnapshotId: snapshotIds.meta,
          confidence: poi.isLandmark ? 0.9 : 0.8,
          provenance: 'observed',
          summary: 'POI overlay derived from scene meta.',
          payload: {
            type: poi.type,
            category: poi.category ?? poi.type.toLowerCase(),
            isLandmark: poi.isLandmark,
          },
        },
      ],
      componentSpecs: [
        {
          kind: 'IDENTITY',
          label: 'POI Identity',
          properties: [
            createProperty(
              entityId,
              'type',
              poi.type,
              'string',
              'observed',
              0.8,
              [snapshotIds.meta],
            ),
            createProperty(
              entityId,
              'category',
              poi.category ?? poi.type.toLowerCase(),
              'string',
              'observed',
              0.8,
              [snapshotIds.meta],
            ),
          ],
        },
        {
          kind: 'SPATIAL',
          label: 'POI Spatial',
          properties: [
            createProperty(
              entityId,
              'location',
              poi.location,
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
