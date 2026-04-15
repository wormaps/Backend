import { Coordinate } from '../../places/types/place.types';

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
  | 'repetitive_windows'
  | 'balcony_stack'
  | 'vertical_mullion'
  | 'horizontal_band'
  | 'blank_wall_heavy'
  | 'sign_band'
  | 'podium_retail'
  | 'hotel_window_grid'
  | 'industrial_panel'
  | 'warehouse_siding'
  | 'old_apartment_balcony'
  | 'mixed_use_ground_retail'
  | 'temple_roof_layer'
  | 'shopping_arcade'
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
export type RoofCrownType =
  | 'none'
  | 'screen_crown'
  | 'stepped_crown'
  | 'parapet_crown';
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

export type InferenceReasonCode =
  | 'MISSING_MAPILLARY_IMAGES'
  | 'MISSING_MAPILLARY_FEATURES'
  | 'MISSING_FACADE_COLOR'
  | 'MISSING_FACADE_MATERIAL'
  | 'MISSING_ROOF_SHAPE'
  | 'MISSING_ELEVATION_MODEL'
  | 'WEAK_EVIDENCE_RATIO_HIGH'
  | 'DEFAULT_STYLE_RULE'
  | 'GEOMETRY_FALLBACK_TRIGGERED'
  | 'MISSING_AUXILIARY_DATA'
  | 'UNKNOWN_INFERENCE_REASON';
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

export type EvidenceStrength = 'none' | 'weak' | 'medium' | 'strong';

export type MaterialFamily =
  | 'glass'
  | 'concrete'
  | 'panel'
  | 'brick'
  | 'metal'
  | 'stone'
  | 'plaster'
  | 'wood'
  | 'tile'
  | 'mixed';

export type MaterialVariant =
  | 'glass_cool_light'
  | 'glass_cool_dark'
  | 'glass_reflective_blue'
  | 'concrete_old_gray'
  | 'concrete_residential_beige'
  | 'concrete_warm_white'
  | 'brick_red_lowrise'
  | 'brick_dark_aged'
  | 'tile_pink_apartment'
  | 'metal_station_silver'
  | 'metal_industrial_dark'
  | 'stone_luxury_beige'
  | 'wood_natural'
  | 'plaster_old_town_white'
  | 'mixed_neutral_light';

export type RoofStyle =
  | 'flat'
  | 'gable'
  | 'stepped'
  | 'setback'
  | 'podium_tower'
  | 'mechanical_heavy'
  | 'rooftop_garden'
  | 'sloped_tile'
  | 'industrial_sawtooth'
  | 'temple_roof'
  | 'warehouse_low_slope';

export type DistrictCluster =
  | 'core_commercial'
  | 'secondary_retail'
  | 'office_mixed'
  | 'luxury_residential'
  | 'old_residential'
  | 'industrial_lowrise'
  | 'nightlife_cluster'
  | 'station_district'
  | 'green_park_edge'
  | 'riverside_lowrise'
  | 'suburban_detached'
  | 'coastal_road'
  | 'mountain_slope_settlement'
  | 'temple_shrine_district'
  | 'university_district'
  | 'airport_logistics'
  | 'landmark_plaza'
  | 'stadium_zone'
  | 'tourist_shopping_street';

export type StreetAtmosphereProfile =
  | 'clean_office'
  | 'dense_signage'
  | 'luxury_minimal'
  | 'tourist_heavy'
  | 'nightlife_dense'
  | 'industrial_sparse'
  | 'residential_quiet'
  | 'riverside_open'
  | 'park_green'
  | 'station_busy'
  | 'coastal_relaxed'
  | 'mountain_compact';

export type VegetationProfile =
  | 'sparse_tree_line'
  | 'dense_tree_line'
  | 'roadside_planters'
  | 'pocket_park'
  | 'forest_edge'
  | 'coastal_palm'
  | 'mountain_shrub'
  | 'residential_small_tree'
  | 'urban_minimal_green';

export type RoadAtmosphereProfile =
  | 'wide_arterial'
  | 'dense_crosswalk'
  | 'bus_lane_heavy'
  | 'narrow_alley'
  | 'riverside_road'
  | 'industrial_truck_route'
  | 'pedestrian_street'
  | 'shopping_street'
  | 'nightlife_street'
  | 'coastal_drive'
  | 'mountain_curve_road';

export type LightingAtmosphereProfile =
  | 'bright_daylight'
  | 'overcast_soft'
  | 'warm_evening'
  | 'neon_night'
  | 'rainy_reflection'
  | 'snowy_diffuse'
  | 'luxury_warm'
  | 'industrial_cold'
  | 'nightlife_emissive'
  | 'park_dim';

export type WeatherMoodOverlay =
  | 'sunny_clear'
  | 'cloudy'
  | 'rainy'
  | 'wet_road'
  | 'foggy'
  | 'snowy'
  | 'dusk'
  | 'night'
  | 'humid_summer'
  | 'cold_winter';

export interface BuildingFacadeProfile {
  family: MaterialFamily;
  variant: MaterialVariant;
  pattern: FacadePattern;
  roofStyle: RoofStyle;
  evidence: EvidenceStrength;
  emissiveBoost?: number;
  signDensity?: 'low' | 'medium' | 'high';
  windowDensity?: WindowPatternDensity;
  balconyType?: 'none' | 'minimal' | 'stacked' | 'continuous';
  podiumStyle?: 'none' | 'compact' | 'retail' | 'grand';
  canopyType?: 'none' | 'flat' | 'awning' | 'arcade';
  entranceEmphasis?: 'low' | 'medium' | 'high';
  roofEquipmentIntensity?: 'low' | 'medium' | 'high';
  lightingStyle?: LightingAtmosphereProfile;
}

export interface DistrictAtmosphereProfile {
  districtCluster: DistrictCluster;
  confidence: number;
  evidenceStrength: EvidenceStrength;
  buildingCount: number;
  facadeProfile: BuildingFacadeProfile;
  streetAtmosphere: StreetAtmosphereProfile;
  vegetationProfile: VegetationProfile;
  roadProfile: RoadAtmosphereProfile;
  lightingProfile: LightingAtmosphereProfile;
  weatherOverlay: WeatherMoodOverlay;
}

export interface SceneWideAtmosphereProfile {
  cityTone:
    | 'dense_commercial'
    | 'mixed_commercial'
    | 'suburban_residential'
    | 'industrial_fringe'
    | 'coastal_tourist_town'
    | 'mountain_village'
    | 'balanced_mixed';
  evidenceStrength: EvidenceStrength;
  baseFacadeProfile: BuildingFacadeProfile;
  streetAtmosphere: StreetAtmosphereProfile;
  vegetationProfile: VegetationProfile;
  roadProfile: RoadAtmosphereProfile;
  lightingProfile: LightingAtmosphereProfile;
  weatherOverlay: WeatherMoodOverlay;
}

export type SceneStaticAtmospherePreset =
  | 'DAY_CLEAR'
  | 'EVENING_BALANCED'
  | 'NIGHT_NEON';

export interface SceneStaticAtmosphereProfile {
  preset: SceneStaticAtmospherePreset;
  emissiveBoost: number;
  roadRoughnessScale: number;
  wetRoadBoost: number;
}

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
  weakEvidenceRatio: number;
  contextualUpgradeCount: number;
  explicitColorBuildingCount: number;
  profileCounts: SceneFacadeContextCount[];
  materialCounts: SceneFacadeContextCount[];
  profileMaterialCounts: SceneFacadeContextCount[];
  districtClusterCounts?: SceneFacadeContextCount[];
  evidenceStrengthCounts?: SceneFacadeContextCount[];
}

export interface SceneFidelityPlan {
  currentMode: SceneFidelityMode;
  targetMode: SceneFidelityMode;
  targetCoverageRatio: number;
  achievedCoverageRatio: number;
  coverageGapRatio: number;
  phase:
    | 'PHASE_1_BASELINE'
    | 'PHASE_2_HYBRID_FOUNDATION'
    | 'PHASE_3_PRODUCTION_LOCK';
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

export type SceneFailureCategory = 'GENERATION_ERROR' | 'QUALITY_GATE_REJECTED';

export type SceneQualityGateState = 'PASS' | 'FAIL' | 'SKIPPED';

export type SceneQualityGateReasonCode =
  | 'COVERAGE_GAP_PRESENT'
  | 'OVERALL_SCORE_BELOW_MIN'
  | 'MODE_DELTA_BELOW_MIN'
  | 'CRITICAL_BUDGET_SKIP'
  | 'CRITICAL_INVALID_GEOMETRY'
  | 'CRITICAL_COLLISION_DETECTED'
  | 'CRITICAL_GROUNDING_GAP_DETECTED'
  | 'CRITICAL_TERRAIN_TRANSPORT_ALIGNMENT_DETECTED'
  | 'CRITICAL_SHELL_CLOSURE_DETECTED'
  | 'CRITICAL_ROOF_WALL_GAP_DETECTED'
  | 'STRUCTURE_SCORE_BELOW_MIN'
  | 'PLACE_READABILITY_SCORE_BELOW_MIN'
  | 'MESH_SKIPPED_COUNT_ABOVE_WARN_MAX'
  | 'MISSING_SOURCE_COUNT_ABOVE_WARN_MAX'
  | 'ORACLE_APPROVAL_REQUIRED';

export type SceneOracleApprovalState =
  | 'NOT_REQUIRED'
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED';

export interface SceneOracleApprovalStatus {
  required: boolean;
  state: SceneOracleApprovalState;
  source: 'auto' | 'approval_file';
  approvalFilePath?: string;
  approvedBy?: string;
  approvedAt?: string;
  note?: string;
}

export interface SceneQualityGateThresholds {
  coverageGapMax: number;
  overallMin: number;
  structureMin: number;
  placeReadabilityMin: number;
  modeDeltaOverallMin: number;
  criticalPolygonBudgetExceededMax: number;
  criticalInvalidGeometryMax: number;
  maxSkippedMeshesWarn: number;
  maxMissingSourceWarn: number;
}

export interface SceneQualityGateScores {
  overall: number;
  breakdown: {
    structure: number;
    atmosphere: number;
    placeReadability: number;
  };
  modeDeltaOverallScore: number;
}

export interface SceneQualityGateMeshSummary {
  totalSkipped: number;
  polygonBudgetExceededCount: number;
  criticalPolygonBudgetExceededCount: number;
  emptyOrInvalidGeometryCount: number;
  criticalEmptyOrInvalidGeometryCount: number;
  selectionCutCount: number;
  missingSourceCount: number;
}

export interface SceneQualityGateArtifactRefs {
  diagnosticsLogPath: string;
  modeComparisonPath: string;
}

export interface SceneQualityGateInput {
  version: 'qg.v1';
  sceneId: string;
  fidelityPlan?: Pick<
    SceneFidelityPlan,
    'phase' | 'targetMode' | 'coverageGapRatio'
  >;
  scores: SceneQualityGateScores;
  meshSummary: SceneQualityGateMeshSummary;
  artifactRefs: SceneQualityGateArtifactRefs;
}

export interface SceneQualityGateResult {
  version: 'qg.v1';
  state: SceneQualityGateState;
  failureCategory?: SceneFailureCategory;
  reasonCodes: SceneQualityGateReasonCode[];
  scores: SceneQualityGateScores;
  thresholds: SceneQualityGateThresholds;
  meshSummary: SceneQualityGateMeshSummary;
  artifactRefs: SceneQualityGateArtifactRefs;
  oracleApproval: SceneOracleApprovalStatus;
  decidedAt: string;
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

export interface StoredSceneCuratedAssetPayload {
  landmarks?: Array<{ id: string; name: string }>;
  facadeOverrides?: Array<{ objectId: string; palette: string[] }>;
  signageOverrides?: Array<{ objectId: string; panelCount: number }>;
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
