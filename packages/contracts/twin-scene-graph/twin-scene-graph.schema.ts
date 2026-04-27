import { z } from 'zod';

import type { CoordinateFrame, GeoCoordinate, LocalPoint } from '../../core/coordinates';
import type {
  BuildingGeometry,
  FacadeMaterial,
  GeoPolygon,
  PointGeometry,
  RoadGeometry,
  RoofShape,
} from '../../core/geometry';
import type { DerivationRecord, EvidenceValue } from '../evidence-graph';
import type { QaIssue } from '../qa';
import type { SourceEntityRef } from '../source-snapshot';

// ---------------------------------------------------------------------------
// Re-import schemas from sibling contracts
// ---------------------------------------------------------------------------

import { EvidenceValueSchema } from '../evidence-graph/evidence-graph.schema';
import { SourceEntityRefSchema } from '../source-snapshot/source-snapshot.schema';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const RealityTierSchema = z.enum([
  'REALITY_TWIN',
  'STRUCTURAL_TWIN',
  'PROCEDURAL_MODEL',
  'PLACEHOLDER_SCENE',
]);
export type RealityTier = z.infer<typeof RealityTierSchema>;

export const TwinEntityTypeSchema = z.enum([
  'building',
  'road',
  'walkway',
  'poi',
  'terrain',
  'traffic_flow',
]);
export type TwinEntityType = z.infer<typeof TwinEntityTypeSchema>;

// ---------------------------------------------------------------------------
// GeoCoordinate / GeoPolygon / LocalPoint (cross-contract types)
// ---------------------------------------------------------------------------

const GeoCoordinateSchema = z.object({
  lat: z.number(),
  lng: z.number(),
}) satisfies z.ZodType<GeoCoordinate>;

const GeoPolygonSchema = z.object({
  outer: z.array(GeoCoordinateSchema),
  holes: z.array(z.array(GeoCoordinateSchema)).optional(),
}) satisfies z.ZodType<GeoPolygon>;

const LocalPointSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
}) satisfies z.ZodType<LocalPoint>;

const CoordinateFrameSchema = z.object({
  origin: GeoCoordinateSchema,
  axes: z.literal('ENU'),
  unit: z.literal('meter'),
  elevationDatum: z.enum(['LOCAL_DEM', 'ELLIPSOID', 'UNKNOWN']),
}) satisfies z.ZodType<CoordinateFrame>;

// ---------------------------------------------------------------------------
// EvidenceValue sub-schemas for specific property types
// ---------------------------------------------------------------------------

const EvidenceValueStringSchema = EvidenceValueSchema.extend({
  value: z.string(),
}) satisfies z.ZodType<EvidenceValue<string>>;

const EvidenceValueNumberSchema = EvidenceValueSchema.extend({
  value: z.number(),
}) satisfies z.ZodType<EvidenceValue<number>>;

const EvidenceValueBooleanSchema = EvidenceValueSchema.extend({
  value: z.boolean(),
}) satisfies z.ZodType<EvidenceValue<boolean>>;

const EvidenceValueRoofShapeSchema = EvidenceValueSchema.extend({
  value: z.enum(['flat', 'gable', 'hip', 'shed', 'stepped', 'unknown']),
}) satisfies z.ZodType<EvidenceValue<RoofShape>>;

const EvidenceValueFacadeMaterialSchema = EvidenceValueSchema.extend({
  value: z.enum(['concrete', 'glass', 'brick', 'metal', 'stone', 'tile', 'unknown']),
}) satisfies z.ZodType<EvidenceValue<FacadeMaterial>>;

// ---------------------------------------------------------------------------
// SceneScope
// ---------------------------------------------------------------------------

export const SceneScopeSchema = z.object({
  center: GeoCoordinateSchema,
  boundaryType: z.enum(['viewport', 'radius', 'polygon']),
  radiusMeters: z.number().optional(),
  polygon: GeoPolygonSchema.optional(),
  focusPlaceId: z.string().optional(),
  coreArea: GeoPolygonSchema,
  contextArea: GeoPolygonSchema,
  exclusionAreas: z.array(GeoPolygonSchema).optional(),
});
export type SceneScope = z.infer<typeof SceneScopeSchema>;

// ---------------------------------------------------------------------------
// TwinEntityBase
// ---------------------------------------------------------------------------

export const TwinEntityBaseSchema = z.object({
  id: z.string(),
  stableId: z.string(),
  type: TwinEntityTypeSchema,
  confidence: z.number(),
  sourceSnapshotIds: z.array(z.string()),
  sourceEntityRefs: z.array(SourceEntityRefSchema),
  derivation: z.array(z.custom<DerivationRecord>((val) => typeof val === 'object' && val !== null)),
  tags: z.array(z.string()),
  qualityIssues: z.custom<QaIssue[]>((val) => Array.isArray(val)),
});
export type TwinEntityBase = z.infer<typeof TwinEntityBaseSchema>;

// ---------------------------------------------------------------------------
// BuildingProperties
// ---------------------------------------------------------------------------

export const BuildingPropertiesSchema = z.object({
  name: EvidenceValueStringSchema.optional(),
  height: EvidenceValueNumberSchema.optional(),
  levels: EvidenceValueNumberSchema.optional(),
  roofShape: EvidenceValueRoofShapeSchema.optional(),
  facadeMaterial: EvidenceValueFacadeMaterialSchema.optional(),
  facadeColor: EvidenceValueStringSchema.optional(),
  buildingUse: EvidenceValueStringSchema.optional(),
  isLandmark: EvidenceValueBooleanSchema.optional(),
});
export type BuildingProperties = z.infer<typeof BuildingPropertiesSchema>;

// ---------------------------------------------------------------------------
// BuildingGeometry / RoadGeometry / PointGeometry (cross-contract types)
// ---------------------------------------------------------------------------

const LocalPolygonSchema = z.object({
  outer: z.array(LocalPointSchema),
  holes: z.array(z.array(LocalPointSchema)).optional(),
});

const BuildingGeometrySchema = z.object({
  footprint: LocalPolygonSchema,
  terrainSamples: z.array(LocalPointSchema).optional(),
  baseY: z.number().optional(),
  height: z.number().optional(),
}) satisfies z.ZodType<BuildingGeometry>;

const RoadGeometrySchema = z.object({
  centerline: z.array(LocalPointSchema),
  bufferPolygon: LocalPolygonSchema.optional(),
}) satisfies z.ZodType<RoadGeometry>;

const PointGeometrySchema = z.object({
  point: LocalPointSchema,
}) satisfies z.ZodType<PointGeometry>;

// ---------------------------------------------------------------------------
// TwinBuildingEntity
// ---------------------------------------------------------------------------

export const TwinBuildingEntitySchema = TwinEntityBaseSchema.extend({
  type: z.literal('building'),
  geometry: BuildingGeometrySchema,
  properties: BuildingPropertiesSchema,
});
export type TwinBuildingEntity = z.infer<typeof TwinBuildingEntitySchema>;

// ---------------------------------------------------------------------------
// TrafficState
// ---------------------------------------------------------------------------

const TrafficStateSchema = z.object({
  currentSpeedKph: z.number().optional(),
  freeFlowSpeedKph: z.number().optional(),
  confidence: z.number().optional(),
  closure: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// RoadProperties
// ---------------------------------------------------------------------------

const EvidenceValueTrafficStateSchema = EvidenceValueSchema.extend({
  value: TrafficStateSchema,
});

export const RoadPropertiesSchema = z.object({
  name: EvidenceValueStringSchema.optional(),
  highwayClass: EvidenceValueStringSchema.optional(),
  lanes: EvidenceValueNumberSchema.optional(),
  widthMeters: EvidenceValueNumberSchema.optional(),
  surface: EvidenceValueStringSchema.optional(),
  trafficState: EvidenceValueTrafficStateSchema.optional(),
});
export type RoadProperties = z.infer<typeof RoadPropertiesSchema>;

// ---------------------------------------------------------------------------
// TwinRoadEntity
// ---------------------------------------------------------------------------

export const TwinRoadEntitySchema = TwinEntityBaseSchema.extend({
  type: z.literal('road'),
  geometry: RoadGeometrySchema,
  properties: RoadPropertiesSchema,
});
export type TwinRoadEntity = z.infer<typeof TwinRoadEntitySchema>;

// ---------------------------------------------------------------------------
// PoiProperties
// ---------------------------------------------------------------------------

const EvidenceValueRecordSchema = EvidenceValueSchema.extend({
  value: z.record(z.string(), z.string()),
});

export const PoiPropertiesSchema = z.object({
  name: EvidenceValueStringSchema.optional(),
  category: EvidenceValueStringSchema.optional(),
  placeId: EvidenceValueStringSchema.optional(),
  osmTags: EvidenceValueRecordSchema.optional(),
});
export type PoiProperties = z.infer<typeof PoiPropertiesSchema>;

// ---------------------------------------------------------------------------
// TwinPoiEntity
// ---------------------------------------------------------------------------

export const TwinPoiEntitySchema = TwinEntityBaseSchema.extend({
  type: z.literal('poi'),
  geometry: PointGeometrySchema,
  properties: PoiPropertiesSchema,
});
export type TwinPoiEntity = z.infer<typeof TwinPoiEntitySchema>;

// ---------------------------------------------------------------------------
// TwinWalkwayEntity
// ---------------------------------------------------------------------------

export const TwinWalkwayEntitySchema = TwinEntityBaseSchema.extend({
  type: z.literal('walkway'),
  geometry: RoadGeometrySchema,
  properties: z.record(z.string(), EvidenceValueSchema),
});
export type TwinWalkwayEntity = z.infer<typeof TwinWalkwayEntitySchema>;

// ---------------------------------------------------------------------------
// TwinTerrainEntity
// ---------------------------------------------------------------------------

export const TwinTerrainEntitySchema = TwinEntityBaseSchema.extend({
  type: z.literal('terrain'),
  geometry: z.object({ samples: z.array(LocalPointSchema) }),
  properties: z.record(z.string(), EvidenceValueSchema),
});
export type TwinTerrainEntity = z.infer<typeof TwinTerrainEntitySchema>;

// ---------------------------------------------------------------------------
// TwinTrafficFlowEntity
// ---------------------------------------------------------------------------

export const TwinTrafficFlowEntitySchema = TwinEntityBaseSchema.extend({
  type: z.literal('traffic_flow'),
  geometry: RoadGeometrySchema,
  properties: z.object({ trafficState: EvidenceValueTrafficStateSchema }),
});
export type TwinTrafficFlowEntity = z.infer<typeof TwinTrafficFlowEntitySchema>;

// ---------------------------------------------------------------------------
// TwinEntity (union)
// ---------------------------------------------------------------------------

export const TwinEntitySchema = z.discriminatedUnion('type', [
  TwinBuildingEntitySchema,
  TwinRoadEntitySchema,
  TwinPoiEntitySchema,
  TwinWalkwayEntitySchema,
  TwinTerrainEntitySchema,
  TwinTrafficFlowEntitySchema,
]);
export type TwinEntity = z.infer<typeof TwinEntitySchema>;

// ---------------------------------------------------------------------------
// SceneRelationship
// ---------------------------------------------------------------------------

export const SceneRelationshipSchema = z.object({
  id: z.string(),
  fromEntityId: z.string(),
  toEntityId: z.string(),
  relation: z.enum([
    'adjacent_to',
    'contains',
    'intersects',
    'duplicates',
    'conflicts',
    'matches_traffic_fragment',
    'supports_access',
  ]),
  confidence: z.number(),
  reasonCodes: z.array(z.string()),
});
export type SceneRelationship = z.infer<typeof SceneRelationshipSchema>;

// ---------------------------------------------------------------------------
// SceneStateLayer
// ---------------------------------------------------------------------------

export const SceneStateLayerSchema = z.object({
  id: z.string(),
  type: z.enum(['weather', 'traffic', 'time']),
  entityIds: z.array(z.string()),
  sourceSnapshotIds: z.array(z.string()),
});
export type SceneStateLayer = z.infer<typeof SceneStateLayerSchema>;

// ---------------------------------------------------------------------------
// TerrainLayer
// ---------------------------------------------------------------------------

export const TerrainLayerSchema = z.object({
  mode: z.enum(['FLAT_PLACEHOLDER', 'DEM_FUSED', 'LOCAL_DEM']),
  sourceSnapshotIds: z.array(z.string()),
});
export type TerrainLayer = z.infer<typeof TerrainLayerSchema>;

// ---------------------------------------------------------------------------
// TwinSceneGraphMetadata
// ---------------------------------------------------------------------------

export const TwinSceneGraphMetadataSchema = z.object({
  initialRealityTierCandidate: RealityTierSchema,
  observedRatio: z.number(),
  inferredRatio: z.number(),
  defaultedRatio: z.number(),
  coreEntityCount: z.number(),
  contextEntityCount: z.number(),
  qualityIssues: z.custom<QaIssue[]>((val) => Array.isArray(val)),
});
export type TwinSceneGraphMetadata = z.infer<typeof TwinSceneGraphMetadataSchema>;

// ---------------------------------------------------------------------------
// TwinSceneGraph
// ---------------------------------------------------------------------------

export const TwinSceneGraphSchema = z.object({
  sceneId: z.string(),
  scope: SceneScopeSchema,
  coordinateFrame: CoordinateFrameSchema,
  entities: z.array(TwinEntitySchema),
  relationships: z.array(SceneRelationshipSchema),
  evidenceGraphId: z.string(),
  terrain: TerrainLayerSchema.optional(),
  stateLayers: z.array(SceneStateLayerSchema),
  metadata: TwinSceneGraphMetadataSchema,
});
export type TwinSceneGraph = z.infer<typeof TwinSceneGraphSchema>;
