import type {
  TwinComponent,
  TwinEntity,
  TwinEvidence,
  TwinRelationship,
} from '../../types/scene.types';
import {
  resolveCoordinateCenter,
  resolveEvidenceConfidence,
} from './twin-hash.utils';
import {
  createEntityId,
  createProperty,
  registerEntity,
} from './twin-entity-registration.builder';
import type { SnapshotIds } from './twin-source-snapshot.builder';

export interface EntityBuildContext {
  entities: TwinEntity[];
  components: TwinComponent[];
  relationships: TwinRelationship[];
  evidence: TwinEvidence[];
  sceneId: string;
  snapshotIds: SnapshotIds;
  meta: import('../../types/scene.types').SceneMeta;
  detail: import('../../types/scene.types').SceneDetail;
  scale: string;
  terrainProfile: {
    mode: string;
    hasElevationModel: boolean;
    baseHeightMeters: number;
  };
  place: import('../../../places/types/external-place.types').ExternalPlaceDetail;
}

export function registerSceneEntity(ctx: EntityBuildContext): string {
  const {
    entities,
    components,
    relationships,
    evidence,
    sceneId,
    snapshotIds,
    meta,
    scale,
    terrainProfile,
  } = ctx;
  const sceneEntityId = createEntityId(sceneId, 'scene');

  registerEntity({
    entities,
    components,
    relationships,
    evidence,
    sceneId,
    entityId: sceneEntityId,
    kind: 'SCENE',
    objectId: sceneId,
    label: meta.name,
    sourceObjectId: sceneId,
    sourceSnapshotIds: [snapshotIds.meta, snapshotIds.detail],
    evidenceInputs: [
      {
        kind: 'SEMANTIC',
        sourceSnapshotId: snapshotIds.meta,
        confidence: 1,
        provenance: 'observed',
        summary: 'Scene aggregate derived from canonical scene meta.',
        payload: {
          buildingCount: meta.stats.buildingCount,
          roadCount: meta.stats.roadCount,
          poiCount: meta.stats.poiCount,
        },
      },
    ],
    componentSpecs: [
      {
        kind: 'IDENTITY',
        label: 'Scene Identity',
        properties: [
          createProperty(
            sceneEntityId,
            'name',
            meta.name,
            'string',
            'observed',
            1,
            [snapshotIds.meta],
          ),
          createProperty(
            sceneEntityId,
            'placeId',
            meta.placeId,
            'string',
            'observed',
            1,
            [snapshotIds.meta],
          ),
          createProperty(
            sceneEntityId,
            'scale',
            scale,
            'string',
            'observed',
            1,
            [snapshotIds.meta],
          ),
        ],
      },
      {
        kind: 'SPATIAL',
        label: 'Scene Spatial Frame',
        properties: [
          createProperty(
            sceneEntityId,
            'origin',
            meta.origin,
            'coordinate',
            'observed',
            1,
            [snapshotIds.meta],
          ),
          createProperty(
            sceneEntityId,
            'bounds',
            meta.bounds,
            'json',
            'observed',
            1,
            [snapshotIds.meta],
          ),
          createProperty(
            sceneEntityId,
            'terrainMode',
            terrainProfile.mode,
            'string',
            terrainProfile.hasElevationModel ? 'observed' : 'defaulted',
            terrainProfile.hasElevationModel ? 0.9 : 0.3,
            [snapshotIds.terrain],
          ),
          createProperty(
            sceneEntityId,
            'terrainBaseHeightMeters',
            terrainProfile.baseHeightMeters,
            'number',
            terrainProfile.hasElevationModel ? 'observed' : 'defaulted',
            terrainProfile.hasElevationModel ? 0.9 : 0.3,
            [snapshotIds.terrain],
          ),
        ],
      },
      {
        kind: 'STATE_BINDING',
        label: 'Scene State Binding',
        properties: [
          createProperty(
            sceneEntityId,
            'stateMode',
            'SYNTHETIC_RULES',
            'string',
            'defaulted',
            0.4,
            [snapshotIds.detail],
          ),
        ],
      },
    ],
  });

  return sceneEntityId;
}

export function registerPlaceEntity(
  ctx: EntityBuildContext,
  sceneEntityId: string,
): string {
  const {
    entities,
    components,
    relationships,
    evidence,
    sceneId,
    snapshotIds,
    meta,
    place,
  } = ctx;
  const placeEntityId = createEntityId(sceneId, place.placeId);
  registerEntity({
    entities,
    components,
    relationships,
    evidence,
    sceneId,
    entityId: placeEntityId,
    kind: 'PLACE',
    objectId: place.placeId,
    label: place.displayName,
    sourceObjectId: place.placeId,
    sourceSnapshotIds: [snapshotIds.place],
    parentEntityId: sceneEntityId,
    evidenceInputs: [
      {
        kind: 'SEMANTIC',
        sourceSnapshotId: snapshotIds.place,
        confidence: 0.95,
        provenance: 'observed',
        summary: 'Resolved place detail from Google Places.',
        payload: {
          provider: place.provider,
          primaryType: place.primaryType,
          formattedAddress: place.formattedAddress,
        },
      },
    ],
    componentSpecs: [
      {
        kind: 'IDENTITY',
        label: 'Place Identity',
        properties: [
          createProperty(
            placeEntityId,
            'provider',
            place.provider,
            'string',
            'observed',
            0.95,
            [snapshotIds.place],
          ),
          createProperty(
            placeEntityId,
            'displayName',
            place.displayName,
            'string',
            'observed',
            0.95,
            [snapshotIds.place],
          ),
          createProperty(
            placeEntityId,
            'primaryType',
            place.primaryType ?? 'unknown',
            'string',
            'observed',
            0.8,
            [snapshotIds.place],
          ),
        ],
      },
      {
        kind: 'SPATIAL',
        label: 'Place Spatial',
        properties: [
          createProperty(
            placeEntityId,
            'location',
            place.location,
            'coordinate',
            'observed',
            0.95,
            [snapshotIds.place],
          ),
          createProperty(
            placeEntityId,
            'viewport',
            place.viewport ?? meta.bounds,
            'json',
            place.viewport ? 'observed' : 'defaulted',
            place.viewport ? 0.9 : 0.5,
            [snapshotIds.place],
          ),
        ],
      },
    ],
  });

  return placeEntityId;
}

export function registerBuildings(
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
    detail,
  } = ctx;
  const facadeHintByObjectId = new Map(
    detail.facadeHints.map((hint) => [hint.objectId, hint]),
  );

  for (const building of meta.buildings) {
    const entityId = createEntityId(sceneId, building.objectId);
    const facadeHint = facadeHintByObjectId.get(building.objectId);
    const appearanceOrigin = facadeHint
      ? facadeHint.weakEvidence
        ? 'inferred'
        : 'observed'
      : 'defaulted';
    const appearanceConfidence = facadeHint
      ? resolveEvidenceConfidence(facadeHint.evidenceStrength)
      : 0.2;

    registerEntity({
      entities,
      components,
      relationships,
      evidence,
      sceneId,
      entityId,
      kind: 'BUILDING',
      objectId: building.objectId,
      label: building.name,
      sourceObjectId: building.osmWayId,
      sourceSnapshotIds: [snapshotIds.placePackage, snapshotIds.meta],
      parentEntityId: sceneEntityId,
      evidenceInputs: [
        {
          kind: 'GEOMETRY',
          sourceSnapshotId: snapshotIds.placePackage,
          confidence: 0.9,
          provenance: 'observed',
          summary:
            'Building footprint and height derived from normalized Overpass package.',
          payload: {
            osmWayId: building.osmWayId,
            heightMeters: building.heightMeters,
            footprintPoints: building.footprint.length,
          },
        },
        {
          kind: 'APPEARANCE',
          sourceSnapshotId: facadeHint
            ? snapshotIds.detail
            : snapshotIds.placePackage,
          confidence: appearanceConfidence,
          provenance: appearanceOrigin,
          summary: facadeHint
            ? 'Building facade appearance resolved from scene facade hint.'
            : 'No facade hint available, appearance defaults to procedural fallback.',
          payload: {
            facadePreset: building.facadePreset ?? null,
            visualArchetype: building.visualArchetype ?? null,
            facadeColor: building.facadeColor ?? null,
            facadeMaterial: building.facadeMaterial ?? null,
          },
        },
      ],
      componentSpecs: [
        {
          kind: 'IDENTITY',
          label: 'Building Identity',
          properties: [
            createProperty(
              entityId,
              'name',
              building.name,
              'string',
              'observed',
              0.9,
              [snapshotIds.meta],
            ),
            createProperty(
              entityId,
              'osmWayId',
              building.osmWayId,
              'string',
              'observed',
              1,
              [snapshotIds.placePackage],
            ),
            createProperty(
              entityId,
              'usage',
              building.usage,
              'string',
              'observed',
              0.85,
              [snapshotIds.placePackage],
            ),
          ],
        },
        {
          kind: 'SPATIAL',
          label: 'Building Spatial',
          properties: [
            createProperty(
              entityId,
              'center',
              resolveCoordinateCenter(building.footprint),
              'coordinate',
              'observed',
              0.9,
              [snapshotIds.meta],
            ),
            createProperty(
              entityId,
              'footprint',
              building.footprint,
              'coordinate_array',
              'observed',
              0.9,
              [snapshotIds.placePackage],
            ),
          ],
        },
        {
          kind: 'STRUCTURE',
          label: 'Building Structure',
          properties: [
            createProperty(
              entityId,
              'heightMeters',
              building.heightMeters,
              'number',
              'observed',
              0.9,
              [snapshotIds.placePackage],
            ),
            createProperty(
              entityId,
              'roofType',
              building.roofType,
              'string',
              facadeHint ? 'inferred' : 'defaulted',
              facadeHint ? appearanceConfidence : 0.2,
              [facadeHint ? snapshotIds.detail : snapshotIds.meta],
            ),
            createProperty(
              entityId,
              'geometryStrategy',
              building.geometryStrategy ?? 'simple_extrude',
              'string',
              facadeHint ? 'inferred' : 'defaulted',
              facadeHint ? appearanceConfidence : 0.2,
              [facadeHint ? snapshotIds.detail : snapshotIds.meta],
            ),
            createProperty(
              entityId,
              'terrainOffsetM',
              building.terrainOffsetM ?? 0,
              'number',
              building.terrainSampleHeightMeters !== undefined
                ? 'observed'
                : 'defaulted',
              building.terrainSampleHeightMeters !== undefined ? 0.8 : 0.2,
              [snapshotIds.terrain],
            ),
          ],
        },
        {
          kind: 'APPEARANCE',
          label: 'Building Appearance',
          properties: [
            createProperty(
              entityId,
              'facadeMaterial',
              building.facadeMaterial ?? facadeHint?.materialClass ?? 'unknown',
              'string',
              building.facadeMaterial ? 'observed' : appearanceOrigin,
              building.facadeMaterial ? 0.95 : appearanceConfidence,
              [
                building.facadeMaterial
                  ? snapshotIds.placePackage
                  : snapshotIds.detail,
              ],
            ),
            createProperty(
              entityId,
              'facadeColor',
              building.facadeColor ?? facadeHint?.mainColor ?? 'unknown',
              'string',
              building.facadeColor ? 'observed' : appearanceOrigin,
              building.facadeColor ? 0.95 : appearanceConfidence,
              [
                building.facadeColor
                  ? snapshotIds.placePackage
                  : snapshotIds.detail,
              ],
            ),
            createProperty(
              entityId,
              'visualArchetype',
              building.visualArchetype ?? 'unknown',
              'string',
              facadeHint ? 'inferred' : 'defaulted',
              facadeHint ? appearanceConfidence : 0.2,
              [facadeHint ? snapshotIds.detail : snapshotIds.meta],
            ),
          ],
        },
      ],
    });
  }
}
