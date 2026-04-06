import {
  BuildingData,
  Coordinate,
  CrossingData,
  DensityMetric,
  GlbSources,
  LandCoverData,
  LightingState,
  LinearFeatureData,
  PlacePackage,
  PoiData,
  RoadData,
  StreetFurnitureData,
  SurfaceState,
  WeatherType,
  VegetationData,
  WalkwayData,
} from '../../places/types/place.types';
import { ExternalPlaceDetail } from '../../places/types/external-place.types';
import { TimeOfDay } from '../../places/types/place.types';

export const SCENE_SCALE_VALUES = ['SMALL', 'MEDIUM', 'LARGE'] as const;
export type SceneScale = (typeof SCENE_SCALE_VALUES)[number];
export type SceneStatus = 'PENDING' | 'READY' | 'FAILED';
export type SceneDetailStatus = 'FULL' | 'PARTIAL' | 'OSM_ONLY';
export type MaterialClass = 'glass' | 'concrete' | 'brick' | 'metal' | 'mixed';
export type BuildingPreset =
  | 'glass_tower'
  | 'office_midrise'
  | 'mall_block'
  | 'station_block'
  | 'mixed_midrise'
  | 'small_lowrise';
export type RoofType = 'flat' | 'stepped' | 'gable';
export type VisualArchetype =
  | 'highrise_office'
  | 'commercial_midrise'
  | 'mall_podium'
  | 'hotel_tower'
  | 'apartment_block'
  | 'lowrise_shop'
  | 'house_compact'
  | 'station_like'
  | 'landmark_special';
export type GeometryStrategy =
  | 'simple_extrude'
  | 'podium_tower'
  | 'stepped_tower'
  | 'gable_lowrise'
  | 'courtyard_block'
  | 'fallback_massing';
export type FacadePreset =
  | 'glass_grid'
  | 'retail_sign_band'
  | 'concrete_repetitive'
  | 'mall_panel'
  | 'brick_lowrise'
  | 'station_metal';
export type RoofAccentType = 'flush' | 'crown' | 'terrace' | 'gable';
export type WindowPatternDensity = 'sparse' | 'medium' | 'dense';
export type VisualRole =
  | 'generic'
  | 'hero_landmark'
  | 'edge_landmark'
  | 'retail_edge'
  | 'alley_retail'
  | 'station_edge';
export type HeroBaseMass =
  | 'simple'
  | 'podium_tower'
  | 'stepped_tower'
  | 'corner_tower'
  | 'slab_midrise'
  | 'lowrise_strip';
export type FacadePattern =
  | 'curtain_wall'
  | 'retail_screen'
  | 'mall_sign_band'
  | 'midrise_grid'
  | 'alley_shopfront';
export type FacadeBandType =
  | 'clear'
  | 'retail_sign_band'
  | 'screen_band'
  | 'window_grid'
  | 'solid_panel';
export type UvMode = 'placeholder' | 'atlas_repeat';
export type RoofCrownType = 'none' | 'screen_crown' | 'stepped_crown' | 'parapet_crown';
export type IntersectionProfile =
  | 'scramble_major'
  | 'signalized_standard'
  | 'minor_crossing';
export type HeroIntersectionProfile =
  | 'scramble_primary'
  | 'scramble_secondary'
  | 'signalized_minor';
export type RoadVisualClass =
  | 'arterial_intersection'
  | 'arterial'
  | 'local_street'
  | 'pedestrian_edge';
export type RoadDecalType =
  | 'LANE_OVERLAY'
  | 'STOP_LINE'
  | 'CROSSWALK_OVERLAY'
  | 'JUNCTION_OVERLAY'
  | 'ARROW_MARK';
export type GeometryFallbackReason =
  | 'NONE'
  | 'HAS_HOLES'
  | 'DEGENERATE_RING'
  | 'VERY_THIN_POLYGON'
  | 'SELF_INTERSECTION_RISK'
  | 'TRIANGULATION_FALLBACK';
export type RoadDecalLayer =
  | 'road_base'
  | 'lane_overlay'
  | 'crosswalk_overlay'
  | 'junction_overlay'
  | 'signage_overlay';
export type RoadDecalShapeKind =
  | 'path_strip'
  | 'polygon_fill'
  | 'stripe_set'
  | 'arrow_glyph';
export type RoadDecalStyleToken =
  | 'default'
  | 'scramble_white'
  | 'stopline_white'
  | 'arrow_yellow'
  | 'junction_amber';
export type SceneFidelityMode =
  | 'PROCEDURAL_ONLY'
  | 'MATERIAL_ENRICHED'
  | 'LANDMARK_ENRICHED'
  | 'REALITY_OVERLAY_READY';
export type SceneRealitySourceType =
  | 'OSM'
  | 'GOOGLE_PLACES'
  | 'MAPILLARY'
  | 'CURATED_ASSET_PACK'
  | 'PHOTOREAL_3D_TILES'
  | 'CAPTURED_MESH';
export type SceneEvidenceLevel = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';
export type SceneFacadeContextProfile =
  | 'NEON_CORE'
  | 'COMMERCIAL_STRIP'
  | 'TRANSIT_HUB'
  | 'CIVIC_CLUSTER'
  | 'RESIDENTIAL_EDGE';

export interface BuildingPodiumSpec {
  levels: number;
  setbacks: number;
  cornerChamfer: boolean;
  canopyEdges: number[];
}

export interface BuildingFacadeSpec {
  atlasId?: string | null;
  uvMode?: UvMode;
  emissiveMaskId?: string | null;
  facadePattern: FacadePattern;
  lowerBandType: FacadeBandType;
  midBandType: FacadeBandType;
  topBandType: FacadeBandType;
  windowRepeatX: number;
  windowRepeatY: number;
}

export interface BuildingSignageSpec {
  billboardFaces: number[];
  signBandLevels: number;
  screenFaces: number[];
  emissiveZones: number;
}

export interface BuildingRoofSpec {
  roofUnits: number;
  crownType: RoofCrownType;
  parapet: boolean;
}

export interface SceneRoadStripeSet {
  centerPath: Coordinate[];
  stripeCount: number;
  stripeDepth: number;
  halfWidth: number;
}

export interface ScenePlaceReadabilityDiagnostics {
  heroBuildingCount: number;
  heroIntersectionCount: number;
  scrambleStripeCount: number;
  billboardPlaneCount: number;
  canopyCount: number;
  roofUnitCount: number;
  emissiveZoneCount: number;
  streetFurnitureRowCount: number;
}

export interface SceneStructuralCoverage {
  selectedBuildingCoverage: number;
  coreAreaBuildingCoverage: number;
  fallbackMassingRate: number;
  footprintPreservationRate: number;
  heroLandmarkCoverage: number;
}

export interface SceneRealitySourceReference {
  sourceType: SceneRealitySourceType;
  enabled: boolean;
  coverage: 'NONE' | 'LANDMARK' | 'CORE' | 'FULL';
  reason: string;
}

export interface SceneFacadeContextCount {
  key: string;
  count: number;
}

export interface SceneFacadeContextDiagnostics {
  weakEvidenceCount: number;
  contextualUpgradeCount: number;
  explicitColorBuildingCount: number;
  profileCounts: SceneFacadeContextCount[];
  materialCounts: SceneFacadeContextCount[];
  profileMaterialCounts: SceneFacadeContextCount[];
}

export interface SceneFidelityPlan {
  currentMode: SceneFidelityMode;
  targetMode: SceneFidelityMode;
  phase: 'PHASE_1_BASELINE' | 'PHASE_2_HYBRID_FOUNDATION';
  coreRadiusM: number;
  priorities: string[];
  evidence: {
    structure: SceneEvidenceLevel;
    facade: SceneEvidenceLevel;
    signage: SceneEvidenceLevel;
    streetFurniture: SceneEvidenceLevel;
    landmark: SceneEvidenceLevel;
  };
  sourceRegistry: SceneRealitySourceReference[];
}

export interface SceneLandmarkFacadeHint {
  palette?: string[];
  shellPalette?: string[];
  panelPalette?: string[];
  materialClass?: MaterialClass;
  signageDensity?: 'low' | 'medium' | 'high';
  emissiveStrength?: number;
  glazingRatio?: number;
  facadeEdgeIndex?: number | null;
  visualRole?: VisualRole;
}

export interface SceneLandmarkAnnotation {
  id: string;
  objectId?: string;
  anchor: Coordinate;
  importance: 'primary' | 'secondary';
  kind: 'BUILDING' | 'CROSSING' | 'PLAZA';
  name: string;
  facadeHint?: SceneLandmarkFacadeHint;
}

export interface SceneStreetFurnitureRowHint {
  id: string;
  type: 'TRAFFIC_LIGHT' | 'STREET_LIGHT' | 'SIGN_POLE';
  points: Coordinate[];
  principal?: boolean;
}

export interface LandmarkAnnotationManifest {
  id: string;
  match: {
    placeIds: string[];
    aliases: string[];
  };
  landmarks: SceneLandmarkAnnotation[];
  crossings: Array<{
    id: string;
    name: string;
    path: Coordinate[];
    style: 'zebra' | 'signalized';
    importance: 'primary' | 'secondary';
  }>;
  signageClusters: Array<{
    id: string;
    anchor: Coordinate;
    panelCount: number;
    palette: string[];
    emissiveStrength: number;
    widthMeters: number;
    heightMeters: number;
  }>;
  streetFurnitureRows: SceneStreetFurnitureRowHint[];
}

export interface SceneEntity {
  sceneId: string;
  placeId: string | null;
  name: string;
  centerLat: number;
  centerLng: number;
  radiusM: number;
  status: SceneStatus;
  metaUrl: string;
  assetUrl: string | null;
  createdAt: string;
  updatedAt: string;
  failureReason?: string | null;
}

export interface SceneRoadMeta extends Omit<RoadData, 'id'> {
  objectId: string;
  osmWayId: string;
  center: Coordinate;
  roadVisualClass?: RoadVisualClass;
}

export interface SceneBuildingMeta extends Omit<BuildingData, 'id'> {
  objectId: string;
  osmWayId: string;
  preset: BuildingPreset;
  roofType: RoofType;
  visualArchetype?: VisualArchetype;
  geometryStrategy?: GeometryStrategy;
  facadePreset?: FacadePreset;
  podiumLevels?: number;
  setbackLevels?: number;
  cornerChamfer?: boolean;
  roofAccentType?: RoofAccentType;
  windowPatternDensity?: WindowPatternDensity;
  signBandLevels?: number;
  emissiveBandStrength?: number;
  visualRole?: VisualRole;
  baseMass?: HeroBaseMass;
  facadeSpec?: BuildingFacadeSpec;
  podiumSpec?: BuildingPodiumSpec;
  signageSpec?: BuildingSignageSpec;
  roofSpec?: BuildingRoofSpec;
}

export interface SceneWalkwayMeta extends Omit<WalkwayData, 'id'> {
  objectId: string;
  osmWayId: string;
}

export interface ScenePoiMeta extends Omit<PoiData, 'id' | 'location'> {
  objectId: string;
  placeId?: string;
  location: Coordinate;
  category?: string;
  isLandmark: boolean;
}

export interface SceneCrossingDetail extends Omit<CrossingData, 'id'> {
  objectId: string;
  principal: boolean;
  style: 'zebra' | 'signalized' | 'unknown';
}

export interface SceneRoadMarkingDetail {
  objectId: string;
  type: 'LANE_LINE' | 'STOP_LINE' | 'CROSSWALK';
  color: string;
  path: Coordinate[];
}

export interface SceneStreetFurnitureDetail extends Omit<StreetFurnitureData, 'id'> {
  objectId: string;
  principal: boolean;
}

export interface SceneVegetationDetail extends Omit<VegetationData, 'id'> {
  objectId: string;
}

export interface SceneFacadeHint {
  objectId: string;
  anchor: Coordinate;
  facadeEdgeIndex: number | null;
  windowBands: number;
  billboardEligible: boolean;
  palette: string[];
  materialClass: MaterialClass;
  signageDensity: 'low' | 'medium' | 'high';
  emissiveStrength: number;
  glazingRatio: number;
  visualArchetype?: VisualArchetype;
  geometryStrategy?: GeometryStrategy;
  facadePreset?: FacadePreset;
  podiumLevels?: number;
  setbackLevels?: number;
  cornerChamfer?: boolean;
  roofAccentType?: RoofAccentType;
  windowPatternDensity?: WindowPatternDensity;
  signBandLevels?: number;
  shellPalette?: string[];
  panelPalette?: string[];
  weakEvidence?: boolean;
  contextProfile?: SceneFacadeContextProfile;
  contextualMaterialUpgrade?: boolean;
  visualRole?: VisualRole;
  baseMass?: HeroBaseMass;
  facadeSpec?: BuildingFacadeSpec;
  podiumSpec?: BuildingPodiumSpec;
  signageSpec?: BuildingSignageSpec;
  roofSpec?: BuildingRoofSpec;
}

export interface SceneSignageCluster {
  objectId: string;
  anchor: Coordinate;
  panelCount: number;
  palette: string[];
  emissiveStrength: number;
  widthMeters: number;
  heightMeters: number;
  screenFaces?: number[];
}

export interface SceneLandmarkAnchor {
  objectId: string;
  name: string;
  location: Coordinate;
  kind: 'BUILDING' | 'CROSSING' | 'PLAZA';
}

export interface SceneMaterialClassSummary {
  className: MaterialClass;
  palette: string[];
  buildingCount: number;
}

export interface SceneVisualCoverage {
  structure: number;
  streetDetail: number;
  landmark: number;
  signage: number;
}

export interface SceneIntersectionProfile {
  objectId: string;
  anchor: Coordinate;
  profile: IntersectionProfile;
  crossingObjectIds: string[];
}

export interface SceneRoadDecal {
  objectId: string;
  intersectionId?: string;
  type: RoadDecalType;
  color: string;
  emphasis: 'standard' | 'hero';
  layer?: RoadDecalLayer;
  shapeKind?: RoadDecalShapeKind;
  priority?: 'standard' | 'hero';
  styleToken?: RoadDecalStyleToken;
  path?: Coordinate[];
  polygon?: Coordinate[];
  stripeSet?: SceneRoadStripeSet;
}

export interface SceneGeometryDiagnostic {
  objectId: string;
  strategy: GeometryStrategy;
  fallbackApplied: boolean;
  fallbackReason: GeometryFallbackReason;
  hasHoles: boolean;
  polygonComplexity: 'simple' | 'concave' | 'complex';
}

export interface SceneAssetCounts {
  buildingCount: number;
  roadCount: number;
  walkwayCount: number;
  poiCount: number;
  crossingCount: number;
  trafficLightCount: number;
  streetLightCount: number;
  signPoleCount: number;
  treeClusterCount: number;
  billboardPanelCount: number;
}

export interface SceneMeta {
  sceneId: string;
  placeId: string;
  name: string;
  generatedAt: string;
  origin: Coordinate;
  camera: PlacePackage['camera'];
  bounds: {
    radiusM: number;
    northEast: Coordinate;
    southWest: Coordinate;
  };
  stats: {
    buildingCount: number;
    roadCount: number;
    walkwayCount: number;
    poiCount: number;
  };
  diagnostics: {
    droppedBuildings: number;
    droppedRoads: number;
    droppedWalkways: number;
    droppedPois: number;
    droppedCrossings: number;
    droppedStreetFurniture: number;
    droppedVegetation: number;
    droppedLandCovers: number;
    droppedLinearFeatures: number;
  };
  detailStatus: SceneDetailStatus;
  visualCoverage: SceneVisualCoverage;
  materialClasses: SceneMaterialClassSummary[];
  landmarkAnchors: SceneLandmarkAnchor[];
  assetProfile: {
    preset: SceneScale;
    budget: SceneAssetCounts;
    selected: SceneAssetCounts;
  };
  structuralCoverage: SceneStructuralCoverage;
  fidelityPlan?: SceneFidelityPlan;
  roads: SceneRoadMeta[];
  buildings: SceneBuildingMeta[];
  walkways: SceneWalkwayMeta[];
  pois: ScenePoiMeta[];
}

export interface SceneDetail {
  sceneId: string;
  placeId: string;
  generatedAt: string;
  detailStatus: SceneDetailStatus;
  crossings: SceneCrossingDetail[];
  roadMarkings: SceneRoadMarkingDetail[];
  streetFurniture: SceneStreetFurnitureDetail[];
  vegetation: SceneVegetationDetail[];
  landCovers: LandCoverData[];
  linearFeatures: LinearFeatureData[];
  facadeHints: SceneFacadeHint[];
  signageClusters: SceneSignageCluster[];
  intersectionProfiles?: SceneIntersectionProfile[];
  roadDecals?: SceneRoadDecal[];
  geometryDiagnostics?: SceneGeometryDiagnostic[];
  facadeContextDiagnostics?: SceneFacadeContextDiagnostics;
  placeReadabilityDiagnostics?: ScenePlaceReadabilityDiagnostics;
  annotationsApplied: string[];
  structuralCoverage?: SceneStructuralCoverage;
  fidelityPlan?: SceneFidelityPlan;
  provenance: {
    mapillaryUsed: boolean;
    mapillaryImageCount: number;
    mapillaryFeatureCount: number;
    osmTagCoverage: {
      coloredBuildings: number;
      materialBuildings: number;
      crossings: number;
      streetFurniture: number;
      vegetation: number;
    };
    overrideCount: number;
  };
}

export interface BootstrapResponse {
  sceneId: string;
  assetUrl: string;
  metaUrl: string;
  detailUrl: string;
  detailStatus: SceneDetailStatus;
  glbSources: GlbSources;
  assetProfile: SceneMeta['assetProfile'];
  structuralCoverage: SceneStructuralCoverage;
  fidelityPlan?: SceneFidelityPlan;
  liveEndpoints: {
    state: string;
    traffic: string;
    weather: string;
    places: string;
  };
  renderContract: {
    glbCoverage: {
      buildings: boolean;
      roads: boolean;
      walkways: boolean;
      crosswalks: boolean;
      streetFurniture: boolean;
      vegetation: boolean;
      pois: boolean;
      landCovers: boolean;
      linearFeatures: boolean;
    };
    overlaySources: {
      pois: string;
      crossings: string;
      streetFurniture: string;
      vegetation: string;
      landCovers: string;
      linearFeatures: string;
    };
    liveDataModes: {
      traffic: 'LIVE_BEST_EFFORT';
      weather: 'CURRENT_OR_HISTORICAL';
      state: 'SYNTHETIC_RULES';
    };
  };
}

export interface SceneStateResponse {
  placeId: string;
  updatedAt: string;
  timeOfDay: TimeOfDay;
  weather: WeatherType;
  source: 'MVP_SYNTHETIC_RULES';
  crowd: DensityMetric;
  vehicles: DensityMetric;
  lighting: LightingState;
  surface: SurfaceState;
  playback: {
    recommendedSpeed: 1 | 2 | 4 | 8;
    pedestrianAnimationRate: number;
    vehicleAnimationRate: number;
  };
  sourceDetail?: {
    provider:
      | 'MVP_SYNTHETIC_RULES'
      | 'OPEN_METEO_CURRENT'
      | 'OPEN_METEO_HISTORICAL';
    date?: string;
    localTime?: string;
  };
}

export interface TrafficSegment {
  objectId: string;
  currentSpeed: number;
  freeFlowSpeed: number;
  congestionScore: number;
  status: 'free' | 'moderate' | 'slow' | 'jammed';
  confidence: number | null;
  roadClosure: boolean;
}

export interface SceneTrafficResponse {
  updatedAt: string;
  segments: TrafficSegment[];
  degraded: boolean;
  failedSegmentCount: number;
}

export interface SceneWeatherResponse {
  updatedAt: string;
  weatherCode: number | null;
  temperature: number | null;
  preset: string;
  source: 'OPEN_METEO_CURRENT' | 'OPEN_METEO_HISTORICAL';
  observedAt: string | null;
}

export interface ScenePlaceCategorySummary {
  category: string;
  count: number;
  landmarkCount: number;
}

export interface ScenePlacesResponse {
  pois: ScenePoiMeta[];
  landmarks: ScenePoiMeta[];
  categories: ScenePlaceCategorySummary[];
}

export interface StoredScene {
  requestKey: string;
  query: string;
  scale: SceneScale;
  attempts: number;
  generationSource?: 'api' | 'smoke';
  requestId?: string | null;
  scene: SceneEntity;
  meta?: SceneMeta;
  detail?: SceneDetail;
  place?: ExternalPlaceDetail;
}

export interface SceneCreateOptions {
  forceRegenerate?: boolean;
  requestId?: string | null;
  source?: 'api' | 'smoke';
}

export interface SceneWeatherQuery {
  date?: string;
  timeOfDay: TimeOfDay;
}

export interface SceneStateQuery {
  date?: string;
  timeOfDay: TimeOfDay;
  weather?: WeatherType;
}
