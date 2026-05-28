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

export type RealityTier =
  | 'REALITY_TWIN'
  | 'STRUCTURAL_TWIN'
  | 'PROCEDURAL_MODEL'
  | 'PLACEHOLDER_SCENE';

export type SceneScope = {
  center: GeoCoordinate;
  boundaryType: 'viewport' | 'radius' | 'polygon';
  radiusMeters?: number;
  polygon?: GeoPolygon;
  focusPlaceId?: string;
  coreArea: GeoPolygon;
  contextArea: GeoPolygon;
  exclusionAreas?: GeoPolygon[];
};

export type TwinEntityType =
  | 'building'
  | 'road'
  | 'walkway'
  | 'poi'
  | 'terrain'
  | 'traffic_flow';

export type TwinEntityBase = {
  id: string;
  stableId: string;
  type: TwinEntityType;
  confidence: number;
  sourceSnapshotIds: string[];
  sourceEntityRefs: SourceEntityRef[];
  derivation: DerivationRecord[];
  tags: string[];
  qualityIssues: QaIssue[];
};

export type BuildingProperties = {
  name?: EvidenceValue<string>;
  height?: EvidenceValue<number>;
  levels?: EvidenceValue<number>;
  roofShape?: EvidenceValue<RoofShape>;
  facadeMaterial?: EvidenceValue<FacadeMaterial>;
  facadeColor?: EvidenceValue<string>;
  buildingUse?: EvidenceValue<string>;
  isLandmark?: EvidenceValue<boolean>;
};

export type TwinBuildingEntity = TwinEntityBase & {
  type: 'building';
  geometry: BuildingGeometry;
  properties: BuildingProperties;
};

export type TrafficState = {
  currentSpeedKph?: number;
  freeFlowSpeedKph?: number;
  confidence?: number;
  closure?: boolean;
};

export type RoadProperties = {
  name?: EvidenceValue<string>;
  highwayClass?: EvidenceValue<string>;
  lanes?: EvidenceValue<number>;
  widthMeters?: EvidenceValue<number>;
  surface?: EvidenceValue<string>;
  trafficState?: EvidenceValue<TrafficState>;
};

export type TwinRoadEntity = TwinEntityBase & {
  type: 'road';
  geometry: RoadGeometry;
  properties: RoadProperties;
};

export type PoiProperties = {
  name?: EvidenceValue<string>;
  category?: EvidenceValue<string>;
  placeId?: EvidenceValue<string>;
  osmTags?: EvidenceValue<Record<string, string>>;
};

export type TwinPoiEntity = TwinEntityBase & {
  type: 'poi';
  geometry: PointGeometry;
  properties: PoiProperties;
};

export type TwinWalkwayEntity = TwinEntityBase & {
  type: 'walkway';
  geometry: RoadGeometry;
  properties: Record<string, EvidenceValue<unknown>>;
};

export type TwinTerrainEntity = TwinEntityBase & {
  type: 'terrain';
  geometry: { samples: LocalPoint[] };
  properties: Record<string, EvidenceValue<unknown>>;
};

export type TwinTrafficFlowEntity = TwinEntityBase & {
  type: 'traffic_flow';
  geometry: RoadGeometry;
  properties: { trafficState: EvidenceValue<TrafficState> };
};

export type TwinEntity =
  | TwinBuildingEntity
  | TwinRoadEntity
  | TwinPoiEntity
  | TwinWalkwayEntity
  | TwinTerrainEntity
  | TwinTrafficFlowEntity;

export type SceneRelationship = {
  id: string;
  fromEntityId: string;
  toEntityId: string;
  relation:
    | 'adjacent_to'
    | 'contains'
    | 'intersects'
    | 'duplicates'
    | 'conflicts'
    | 'matches_traffic_fragment'
    | 'supports_access';
  confidence: number;
  reasonCodes: string[];
};

export type SceneStateLayer = {
  id: string;
  type: 'weather' | 'traffic' | 'time';
  entityIds: string[];
  sourceSnapshotIds: string[];
};

export type TerrainLayer = {
  mode: 'FLAT_PLACEHOLDER' | 'DEM_FUSED' | 'LOCAL_DEM';
  sourceSnapshotIds: string[];
};

export type TwinSceneGraphMetadata = {
  initialRealityTierCandidate: RealityTier;
  observedRatio: number;
  inferredRatio: number;
  defaultedRatio: number;
  coreEntityCount: number;
  contextEntityCount: number;
  qualityIssues: QaIssue[];
};

export type TwinSceneGraph = {
  sceneId: string;
  scope: SceneScope;
  coordinateFrame: CoordinateFrame;
  entities: TwinEntity[];
  relationships: SceneRelationship[];
  evidenceGraphId: string;
  terrain?: TerrainLayer;
  stateLayers: SceneStateLayer[];
  metadata: TwinSceneGraphMetadata;
};

