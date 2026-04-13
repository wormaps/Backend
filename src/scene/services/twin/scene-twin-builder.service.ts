import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { ExternalPlaceDetail } from '../../../places/types/external-place.types';
import type { Coordinate, PlacePackage } from '../../../places/types/place.types';
import type {
  SceneDetail,
  SceneMeta,
  SceneQualityGateResult,
  SceneScale,
  SceneTwinGraph,
  SourceSnapshotRecord,
  SpatialFrameManifest,
  TwinComponent,
  TwinComponentKind,
  TwinEntity,
  TwinEntityKind,
  TwinEvidence,
  TwinProperty,
  TwinPropertyOrigin,
  TwinRelationship,
  ValidationGateResult,
  ValidationReport,
} from '../../types/scene.types';

interface BuildSceneTwinArgs {
  sceneId: string;
  scale: SceneScale;
  place: ExternalPlaceDetail;
  placePackage: PlacePackage;
  meta: SceneMeta;
  detail: SceneDetail;
  assetPath: string;
  qualityGate: SceneQualityGateResult;
}

interface SnapshotIds {
  place: string;
  placePackage: string;
  meta: string;
  detail: string;
  qualityGate: string;
}

@Injectable()
export class SceneTwinBuilderService {
  build({
    sceneId,
    scale,
    place,
    placePackage,
    meta,
    detail,
    assetPath,
    qualityGate,
  }: BuildSceneTwinArgs): {
    twin: SceneTwinGraph;
    validation: ValidationReport;
  } {
    const generatedAt = meta.generatedAt;
    const snapshots = this.buildSourceSnapshots(
      sceneId,
      place,
      placePackage,
      meta,
      detail,
      qualityGate,
    );
    const snapshotIds = this.collectSnapshotIds(snapshots);
    const spatialFrame = this.buildSpatialFrame(sceneId, meta, generatedAt);
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

    const sceneEntityId = this.createEntityId(sceneId, 'scene');
    const placeEntityId = this.createEntityId(sceneId, place.placeId);

    this.registerEntity({
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
            this.createProperty(
              sceneEntityId,
              'name',
              meta.name,
              'string',
              'observed',
              1,
              [snapshotIds.meta],
            ),
            this.createProperty(
              sceneEntityId,
              'placeId',
              meta.placeId,
              'string',
              'observed',
              1,
              [snapshotIds.meta],
            ),
            this.createProperty(
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
            this.createProperty(
              sceneEntityId,
              'origin',
              meta.origin,
              'coordinate',
              'observed',
              1,
              [snapshotIds.meta],
            ),
            this.createProperty(
              sceneEntityId,
              'bounds',
              meta.bounds,
              'json',
              'observed',
              1,
              [snapshotIds.meta],
            ),
          ],
        },
        {
          kind: 'STATE_BINDING',
          label: 'Scene State Binding',
          properties: [
            this.createProperty(
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

    this.registerEntity({
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
            this.createProperty(
              placeEntityId,
              'provider',
              place.provider,
              'string',
              'observed',
              0.95,
              [snapshotIds.place],
            ),
            this.createProperty(
              placeEntityId,
              'displayName',
              place.displayName,
              'string',
              'observed',
              0.95,
              [snapshotIds.place],
            ),
            this.createProperty(
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
            this.createProperty(
              placeEntityId,
              'location',
              place.location,
              'coordinate',
              'observed',
              0.95,
              [snapshotIds.place],
            ),
            this.createProperty(
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

    const facadeHintByObjectId = new Map(
      detail.facadeHints.map((hint) => [hint.objectId, hint]),
    );
    const landmarkObjectIds = new Set(meta.landmarkAnchors.map((item) => item.objectId));

    for (const building of meta.buildings) {
      const entityId = this.createEntityId(sceneId, building.objectId);
      const facadeHint = facadeHintByObjectId.get(building.objectId);
      const appearanceOrigin = facadeHint
        ? facadeHint.weakEvidence
          ? 'inferred'
          : 'observed'
        : 'defaulted';
      const appearanceConfidence = facadeHint
        ? resolveEvidenceConfidence(facadeHint.evidenceStrength)
        : 0.2;

      this.registerEntity({
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
            summary: 'Building footprint and height derived from normalized Overpass package.',
            payload: {
              osmWayId: building.osmWayId,
              heightMeters: building.heightMeters,
              footprintPoints: building.footprint.length,
            },
          },
          {
            kind: 'APPEARANCE',
            sourceSnapshotId: facadeHint ? snapshotIds.detail : snapshotIds.placePackage,
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
              this.createProperty(
                entityId,
                'name',
                building.name,
                'string',
                'observed',
                0.9,
                [snapshotIds.meta],
              ),
              this.createProperty(
                entityId,
                'osmWayId',
                building.osmWayId,
                'string',
                'observed',
                1,
                [snapshotIds.placePackage],
              ),
              this.createProperty(
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
              this.createProperty(
                entityId,
                'center',
                resolveCoordinateCenter(building.footprint),
                'coordinate',
                'observed',
                0.9,
                [snapshotIds.meta],
              ),
              this.createProperty(
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
              this.createProperty(
                entityId,
                'heightMeters',
                building.heightMeters,
                'number',
                'observed',
                0.9,
                [snapshotIds.placePackage],
              ),
              this.createProperty(
                entityId,
                'roofType',
                building.roofType,
                'string',
                facadeHint ? 'inferred' : 'defaulted',
                facadeHint ? appearanceConfidence : 0.2,
                [facadeHint ? snapshotIds.detail : snapshotIds.meta],
              ),
              this.createProperty(
                entityId,
                'geometryStrategy',
                building.geometryStrategy ?? 'simple_extrude',
                'string',
                facadeHint ? 'inferred' : 'defaulted',
                facadeHint ? appearanceConfidence : 0.2,
                [facadeHint ? snapshotIds.detail : snapshotIds.meta],
              ),
            ],
          },
          {
            kind: 'APPEARANCE',
            label: 'Building Appearance',
            properties: [
              this.createProperty(
                entityId,
                'facadeMaterial',
                building.facadeMaterial ?? facadeHint?.materialClass ?? 'unknown',
                'string',
                building.facadeMaterial ? 'observed' : appearanceOrigin,
                building.facadeMaterial ? 0.95 : appearanceConfidence,
                [building.facadeMaterial ? snapshotIds.placePackage : snapshotIds.detail],
              ),
              this.createProperty(
                entityId,
                'facadeColor',
                building.facadeColor ?? facadeHint?.mainColor ?? 'unknown',
                'string',
                building.facadeColor ? 'observed' : appearanceOrigin,
                building.facadeColor ? 0.95 : appearanceConfidence,
                [building.facadeColor ? snapshotIds.placePackage : snapshotIds.detail],
              ),
              this.createProperty(
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

    for (const road of meta.roads) {
      const entityId = this.createEntityId(sceneId, road.objectId);
      this.registerEntity({
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
              this.createProperty(entityId, 'name', road.name, 'string', 'observed', 0.9, [snapshotIds.meta]),
              this.createProperty(entityId, 'roadClass', road.roadClass, 'string', 'observed', 0.9, [snapshotIds.placePackage]),
            ],
          },
          {
            kind: 'SPATIAL',
            label: 'Road Spatial',
            properties: [
              this.createProperty(entityId, 'path', road.path, 'coordinate_array', 'observed', 0.92, [snapshotIds.placePackage]),
              this.createProperty(entityId, 'center', road.center, 'coordinate', 'observed', 0.9, [snapshotIds.meta]),
            ],
          },
          {
            kind: 'STRUCTURE',
            label: 'Road Structure',
            properties: [
              this.createProperty(entityId, 'widthMeters', road.widthMeters, 'number', 'observed', 0.92, [snapshotIds.placePackage]),
              this.createProperty(entityId, 'laneCount', road.laneCount, 'number', 'observed', 0.92, [snapshotIds.placePackage]),
            ],
          },
        ],
      });
    }

    for (const walkway of meta.walkways) {
      const entityId = this.createEntityId(sceneId, walkway.objectId);
      this.registerEntity({
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
              this.createProperty(entityId, 'path', walkway.path, 'coordinate_array', 'observed', 0.9, [snapshotIds.placePackage]),
            ],
          },
        ],
      });
    }

    for (const poi of meta.pois) {
      const entityId = this.createEntityId(sceneId, poi.objectId);
      this.registerEntity({
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
              this.createProperty(entityId, 'type', poi.type, 'string', 'observed', 0.8, [snapshotIds.meta]),
              this.createProperty(entityId, 'category', poi.category ?? poi.type.toLowerCase(), 'string', 'observed', 0.8, [snapshotIds.meta]),
            ],
          },
          {
            kind: 'SPATIAL',
            label: 'POI Spatial',
            properties: [
              this.createProperty(entityId, 'location', poi.location, 'coordinate', 'observed', 0.85, [snapshotIds.meta]),
            ],
          },
        ],
      });
    }

    for (const crossing of detail.crossings) {
      const entityId = this.createEntityId(sceneId, crossing.objectId);
      this.registerEntity({
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
            payload: {
              style: crossing.style,
              pathPoints: crossing.path.length,
            },
          },
        ],
        componentSpecs: [
          {
            kind: 'SPATIAL',
            label: 'Crossing Spatial',
            properties: [
              this.createProperty(entityId, 'path', crossing.path, 'coordinate_array', 'observed', 0.8, [snapshotIds.detail]),
              this.createProperty(entityId, 'center', crossing.center, 'coordinate', 'observed', 0.8, [snapshotIds.detail]),
            ],
          },
          {
            kind: 'STRUCTURE',
            label: 'Crossing Structure',
            properties: [
              this.createProperty(entityId, 'style', crossing.style, 'string', 'observed', 0.8, [snapshotIds.detail]),
              this.createProperty(entityId, 'signalized', crossing.signalized, 'boolean', 'observed', 0.8, [snapshotIds.detail]),
            ],
          },
        ],
      });
    }

    for (const item of detail.streetFurniture) {
      const entityId = this.createEntityId(sceneId, item.objectId);
      this.registerEntity({
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
            payload: {
              type: item.type,
              principal: item.principal,
            },
          },
        ],
        componentSpecs: [
          {
            kind: 'IDENTITY',
            label: 'Street Furniture Identity',
            properties: [
              this.createProperty(entityId, 'type', item.type, 'string', 'observed', 0.78, [snapshotIds.detail]),
            ],
          },
          {
            kind: 'SPATIAL',
            label: 'Street Furniture Spatial',
            properties: [
              this.createProperty(entityId, 'location', item.location, 'coordinate', 'observed', 0.78, [snapshotIds.detail]),
            ],
          },
        ],
      });
    }

    for (const item of detail.vegetation) {
      const entityId = this.createEntityId(sceneId, item.objectId);
      this.registerEntity({
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
            payload: {
              type: item.type,
              radiusMeters: item.radiusMeters,
            },
          },
        ],
        componentSpecs: [
          {
            kind: 'SPATIAL',
            label: 'Vegetation Spatial',
            properties: [
              this.createProperty(entityId, 'location', item.location, 'coordinate', 'observed', 0.76, [snapshotIds.detail]),
            ],
          },
          {
            kind: 'STRUCTURE',
            label: 'Vegetation Structure',
            properties: [
              this.createProperty(entityId, 'radiusMeters', item.radiusMeters, 'number', 'observed', 0.76, [snapshotIds.detail]),
            ],
          },
        ],
      });
    }

    for (const item of detail.landCovers) {
      const entityId = this.createEntityId(sceneId, item.id);
      this.registerEntity({
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
            payload: {
              type: item.type,
              pointCount: item.polygon.length,
            },
          },
        ],
        componentSpecs: [
          {
            kind: 'SPATIAL',
            label: 'Land Cover Spatial',
            properties: [
              this.createProperty(entityId, 'polygon', item.polygon, 'coordinate_array', 'observed', 0.82, [snapshotIds.placePackage]),
            ],
          },
        ],
      });
    }

    for (const item of detail.linearFeatures) {
      const entityId = this.createEntityId(sceneId, item.id);
      this.registerEntity({
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
            payload: {
              type: item.type,
              pathPoints: item.path.length,
            },
          },
        ],
        componentSpecs: [
          {
            kind: 'SPATIAL',
            label: 'Linear Feature Spatial',
            properties: [
              this.createProperty(entityId, 'path', item.path, 'coordinate_array', 'observed', 0.82, [snapshotIds.placePackage]),
            ],
          },
        ],
      });
    }

    for (const anchor of meta.landmarkAnchors) {
      const entityId = this.createEntityId(sceneId, `landmark-${anchor.objectId}`);
      this.registerEntity({
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
            summary: 'Landmark anchor derived from scene meta landmark detection.',
            payload: {
              kind: anchor.kind,
              location: anchor.location,
            },
          },
        ],
        componentSpecs: [
          {
            kind: 'IDENTITY',
            label: 'Landmark Identity',
            properties: [
              this.createProperty(entityId, 'kind', anchor.kind, 'string', 'observed', 0.85, [snapshotIds.meta]),
            ],
          },
          {
            kind: 'SPATIAL',
            label: 'Landmark Spatial',
            properties: [
              this.createProperty(entityId, 'location', anchor.location, 'coordinate', 'observed', 0.85, [snapshotIds.meta]),
            ],
          },
        ],
      });
    }

    const validation = this.buildValidationReport({
      sceneId,
      generatedAt,
      twinEntityCount: entities.length,
      twinComponentCount: components.length,
      evidenceCount: evidence.length,
      deliveryArtifactCount: delivery.artifacts.length,
      assetPath,
      qualityGate,
      detail,
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
          supportedQueries: ['timeOfDay', 'weather', 'date'],
          notes:
            '현재는 scene-level synthetic rules state만 지원합니다. entity-level state channel은 아직 구현되지 않았습니다.',
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

  private buildSourceSnapshots(
    sceneId: string,
    place: ExternalPlaceDetail,
    placePackage: PlacePackage,
    meta: SceneMeta,
    detail: SceneDetail,
    qualityGate: SceneQualityGateResult,
  ): SourceSnapshotRecord[] {
    return [
      this.createSnapshot(
        sceneId,
        'GOOGLE_PLACES',
        'PLACE_DETAIL',
        place,
        placePackage.generatedAt,
      ),
      this.createSnapshot(
        sceneId,
        'OVERPASS',
        'PLACE_PACKAGE',
        placePackage,
        placePackage.generatedAt,
      ),
      this.createSnapshot(
        sceneId,
        'SCENE_PIPELINE',
        'SCENE_META',
        meta,
        meta.generatedAt,
      ),
      this.createSnapshot(
        sceneId,
        'SCENE_PIPELINE',
        'SCENE_DETAIL',
        detail,
        detail.generatedAt,
      ),
      this.createSnapshot(
        sceneId,
        'QUALITY_GATE',
        'QUALITY_GATE',
        qualityGate,
        qualityGate.decidedAt,
      ),
    ];
  }

  private collectSnapshotIds(snapshots: SourceSnapshotRecord[]): SnapshotIds {
    return {
      place: snapshots.find((snapshot) => snapshot.kind === 'PLACE_DETAIL')!
        .snapshotId,
      placePackage: snapshots.find((snapshot) => snapshot.kind === 'PLACE_PACKAGE')!
        .snapshotId,
      meta: snapshots.find((snapshot) => snapshot.kind === 'SCENE_META')!
        .snapshotId,
      detail: snapshots.find((snapshot) => snapshot.kind === 'SCENE_DETAIL')!
        .snapshotId,
      qualityGate: snapshots.find((snapshot) => snapshot.kind === 'QUALITY_GATE')!
        .snapshotId,
    };
  }

  private createSnapshot(
    sceneId: string,
    provider: SourceSnapshotRecord['provider'],
    kind: SourceSnapshotRecord['kind'],
    payload: SourceSnapshotRecord['payload'],
    fallbackCapturedAt: string,
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
      payload,
    };
  }

  private buildSpatialFrame(
    sceneId: string,
    meta: SceneMeta,
    generatedAt: string,
  ): SpatialFrameManifest {
    const width = distanceMeters(
      { lat: meta.origin.lat, lng: meta.bounds.southWest.lng },
      { lat: meta.origin.lat, lng: meta.bounds.northEast.lng },
    );
    const depth = distanceMeters(
      { lat: meta.bounds.southWest.lat, lng: meta.origin.lng },
      { lat: meta.bounds.northEast.lat, lng: meta.origin.lng },
    );

    return {
      frameId: `frame-${hashValue(sceneId).slice(0, 12)}`,
      sceneId,
      generatedAt,
      geodeticCrs: 'WGS84',
      localFrame: 'ENU',
      axis: 'Z_UP',
      unit: 'meter',
      heightReference: 'ELLIPSOID_APPROX',
      anchor: meta.origin,
      bounds: {
        northEast: meta.bounds.northEast,
        southWest: meta.bounds.southWest,
      },
      extentMeters: {
        width: roundMetric(width),
        depth: roundMetric(depth),
        radius: meta.bounds.radiusM,
      },
      delivery: {
        glbAxisConvention: 'Y_UP_DERIVED',
        transformRequired: true,
      },
    };
  }

  private registerEntity(args: {
    entities: TwinEntity[];
    components: TwinComponent[];
    relationships: TwinRelationship[];
    evidence: TwinEvidence[];
    sceneId: string;
    entityId: string;
    kind: TwinEntityKind;
    objectId: string;
    label: string;
    sourceObjectId: string;
    sourceSnapshotIds: string[];
    parentEntityId?: string;
    evidenceInputs: Array<Omit<TwinEvidence, 'evidenceId' | 'entityId' | 'observedAt'>>;
    componentSpecs: Array<{
      kind: TwinComponentKind;
      label: string;
      properties: TwinProperty[];
    }>;
  }): void {
    const componentIds: string[] = [];

    args.entities.push({
      entityId: args.entityId,
      objectId: args.objectId,
      kind: args.kind,
      label: args.label,
      sourceObjectId: args.sourceObjectId,
      componentIds,
      tags: [args.kind.toLowerCase()],
    });

    for (const componentSpec of args.componentSpecs) {
      const componentId = `component-${hashValue(
        `${args.entityId}:${componentSpec.kind}:${componentSpec.label}`,
      ).slice(0, 12)}`;
      componentIds.push(componentId);
      args.components.push({
        componentId,
        entityId: args.entityId,
        kind: componentSpec.kind,
        label: componentSpec.label,
        properties: componentSpec.properties,
      });
    }

    if (args.parentEntityId) {
      args.relationships.push({
        relationshipId: `rel-${hashValue(
          `${args.parentEntityId}:${args.entityId}:contains`,
        ).slice(0, 12)}`,
        sourceEntityId: args.parentEntityId,
        targetEntityId: args.entityId,
        type: 'SCENE_CONTAINS',
      });
    }

    args.evidence.push(
      ...args.evidenceInputs.map((item, index) => ({
        evidenceId: `evidence-${hashValue(`${args.entityId}:${index}:${item.summary}`).slice(0, 12)}`,
        entityId: args.entityId,
        kind: item.kind,
        sourceSnapshotId: item.sourceSnapshotId,
        observedAt: new Date().toISOString(),
        confidence: item.confidence,
        provenance: item.provenance,
        summary: item.summary,
        payload: item.payload,
      })),
    );
  }

  private createEntityId(sceneId: string, objectId: string): string {
    return `entity-${hashValue(`${sceneId}:${objectId}`).slice(0, 12)}`;
  }

  private createProperty(
    entityId: string,
    name: string,
    value: unknown,
    valueType: TwinProperty['valueType'],
    origin: TwinPropertyOrigin,
    confidence: number,
    sourceSnapshotIds: string[],
    evidenceIds: string[] = [],
  ): TwinProperty {
    return {
      propertyId: `property-${hashValue(`${entityId}:${name}`).slice(0, 12)}`,
      name,
      value,
      valueType,
      origin,
      confidence: roundConfidence(confidence),
      sourceSnapshotIds,
      evidenceIds,
    };
  }

  private buildValidationReport(args: {
    sceneId: string;
    generatedAt: string;
    twinEntityCount: number;
    twinComponentCount: number;
    evidenceCount: number;
    deliveryArtifactCount: number;
    assetPath: string;
    qualityGate: SceneQualityGateResult;
    detail: SceneDetail;
  }): ValidationReport {
    const geometryGate = this.buildGeometryGate(args.qualityGate);
    const semanticGate = this.buildSemanticGate(
      args.twinEntityCount,
      args.twinComponentCount,
      args.evidenceCount,
    );
    const deliveryGate = this.buildDeliveryGate(
      args.assetPath,
      args.deliveryArtifactCount,
    );
    const stateGate = this.buildStateGate(args.detail);
    const gates = [geometryGate, semanticGate, deliveryGate, stateGate];
    const summary = resolveGateSummary(gates);

    return {
      reportId: `validation-${hashValue(args.sceneId).slice(0, 12)}`,
      sceneId: args.sceneId,
      generatedAt: args.generatedAt,
      summary,
      gates,
      qualityGate: args.qualityGate,
    };
  }

  private buildGeometryGate(
    qualityGate: SceneQualityGateResult,
  ): ValidationGateResult {
    const meshSummary = qualityGate.meshSummary;
    const state =
      meshSummary.criticalEmptyOrInvalidGeometryCount > 0 ||
      meshSummary.criticalPolygonBudgetExceededCount > 0
        ? 'FAIL'
        : meshSummary.emptyOrInvalidGeometryCount > 0 ||
            meshSummary.totalSkipped > 0
          ? 'WARN'
          : 'PASS';

    return {
      gate: 'geometry',
      state,
      reasonCodes:
        state === 'PASS'
          ? []
          : [
              meshSummary.emptyOrInvalidGeometryCount > 0
                ? 'NON_CRITICAL_INVALID_GEOMETRY'
                : null,
              meshSummary.totalSkipped > 0 ? 'SKIPPED_GEOMETRY' : null,
            ].filter((value): value is string => Boolean(value)),
      metrics: {
        totalSkipped: meshSummary.totalSkipped,
        emptyOrInvalidGeometryCount: meshSummary.emptyOrInvalidGeometryCount,
        missingSourceCount: meshSummary.missingSourceCount,
        qualityGateState: qualityGate.state,
      },
    };
  }

  private buildSemanticGate(
    twinEntityCount: number,
    twinComponentCount: number,
    evidenceCount: number,
  ): ValidationGateResult {
    const state =
      twinEntityCount === 0 || twinComponentCount === 0 ? 'FAIL' : 'PASS';
    return {
      gate: 'semantic',
      state,
      reasonCodes: state === 'PASS' ? [] : ['EMPTY_TWIN_GRAPH'],
      metrics: {
        twinEntityCount,
        twinComponentCount,
        evidenceCount,
      },
    };
  }

  private buildDeliveryGate(
    assetPath: string,
    deliveryArtifactCount: number,
  ): ValidationGateResult {
    const hasAsset = assetPath.trim().length > 0;
    return {
      gate: 'delivery',
      state: hasAsset ? 'PASS' : 'FAIL',
      reasonCodes: hasAsset ? [] : ['MISSING_DELIVERY_ASSET'],
      metrics: {
        assetPath,
        deliveryArtifactCount,
      },
    };
  }

  private buildStateGate(detail: SceneDetail): ValidationGateResult {
    return {
      gate: 'state',
      state: 'WARN',
      reasonCodes: ['SCENE_LEVEL_SYNTHETIC_STATE_ONLY'],
      metrics: {
        detailStatus: detail.detailStatus,
        mapillaryUsed: detail.provenance.mapillaryUsed,
      },
    };
  }
}

function resolveEvidenceConfidence(
  strength: 'none' | 'weak' | 'medium' | 'strong' | undefined,
): number {
  switch (strength) {
    case 'strong':
      return 0.9;
    case 'medium':
      return 0.7;
    case 'weak':
      return 0.4;
    case 'none':
      return 0.2;
    default:
      return 0.25;
  }
}

function resolveGateSummary(gates: ValidationGateResult[]): ValidationReport['summary'] {
  if (gates.some((gate) => gate.state === 'FAIL')) {
    return 'FAIL';
  }
  if (gates.some((gate) => gate.state === 'WARN')) {
    return 'WARN';
  }
  return 'PASS';
}

function hashValue(value: unknown): string {
  return createHash('sha1').update(stableStringify(value)).digest('hex');
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sortValue(entry));
  }
  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortValue((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }
  return value;
}

function distanceMeters(start: Coordinate, end: Coordinate): number {
  const metersPerLat = 111_320;
  const metersPerLng =
    111_320 * Math.cos((((start.lat + end.lat) / 2) * Math.PI) / 180);
  const deltaLat = (end.lat - start.lat) * metersPerLat;
  const deltaLng = (end.lng - start.lng) * metersPerLng;
  return Math.sqrt(deltaLat ** 2 + deltaLng ** 2);
}

function roundMetric(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundConfidence(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function resolveCoordinateCenter(points: Coordinate[]): Coordinate {
  if (points.length === 0) {
    return { lat: 0, lng: 0 };
  }

  const totals = points.reduce(
    (acc, point) => ({
      lat: acc.lat + point.lat,
      lng: acc.lng + point.lng,
    }),
    { lat: 0, lng: 0 },
  );

  return {
    lat: totals.lat / points.length,
    lng: totals.lng / points.length,
  };
}
