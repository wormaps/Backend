import {
  BuildingData,
  Coordinate,
  CrossingData,
  LandCoverData,
  LinearFeatureData,
  PlacePackage,
  PoiData,
  RoadData,
  StreetFurnitureData,
  VegetationData,
  WalkwayData,
} from '../../places/types/place.types';
import {
  BuildingFacadeSpec,
  BuildingPodiumSpec,
  BuildingPreset,
  BuildingRoofSpec,
  BuildingSignageSpec,
  DistrictAtmosphereProfile,
  DistrictCluster,
  EvidenceStrength,
  FacadePreset,
  GeometryFallbackReason,
  GeometryStrategy,
  HeroBaseMass,
  IntersectionProfile,
  LandmarkAnnotationManifest,
  MaterialClass,
  RoadDecalLayer,
  RoadDecalShapeKind,
  RoadDecalStyleToken,
  RoadDecalType,
  RoadVisualClass,
  RoofAccentType,
  RoofType,
  SceneFacadeContextDiagnostics,
  SceneFidelityPlan,
  SceneFailureCategory,
  ScenePlaceReadabilityDiagnostics,
  SceneQualityGateResult,
  SceneStructuralCoverage,
  SceneScale,
  SceneStaticAtmosphereProfile,
  SceneWideAtmosphereProfile,
  SceneStatus,
  SceneDetailStatus,
  InferenceReasonCode,
  VisualArchetype,
  VisualRole,
  WindowPatternDensity,
  SceneRoadStripeSet,
} from './scene-domain.types';

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
  failureCategory?: SceneFailureCategory | null;
  qualityGate?: SceneQualityGateResult | null;
}

export interface SceneRoadMeta extends Omit<RoadData, 'id'> {
  objectId: string;
  osmWayId: string;
  center: Coordinate;
  roadVisualClass?: RoadVisualClass;
  terrainOffsetM?: number;
  terrainSampleHeightMeters?: number;
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
  collisionRisk?: 'none' | 'road_overlap';
  groundOffsetM?: number;
  terrainOffsetM?: number;
  terrainSampleHeightMeters?: number;
}

export interface SceneWalkwayMeta extends Omit<WalkwayData, 'id'> {
  objectId: string;
  osmWayId: string;
  terrainOffsetM?: number;
  terrainSampleHeightMeters?: number;
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

export interface SceneStreetFurnitureDetail extends Omit<
  StreetFurnitureData,
  'id'
> {
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
  mainColor?: string;
  accentColor?: string;
  trimColor?: string;
  roofColor?: string;
  weakEvidence?: boolean;
  inferenceReasonCodes?: InferenceReasonCode[];
  contextProfile?: import('./scene-domain.types').SceneFacadeContextProfile;
  districtCluster?: DistrictCluster;
  districtConfidence?: number;
  evidenceStrength?: EvidenceStrength;
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
  collisionRiskCount?: number;
  buildingOverlapCount?: number;
  groundedGapCount?: number;
  averageGroundOffsetM?: number;
  maxGroundOffsetM?: number;
  openShellCount?: number;
  roofWallGapCount?: number;
  invalidSetbackJoinCount?: number;
  terrainAnchoredBuildingCount?: number;
  terrainAnchoredRoadCount?: number;
  terrainAnchoredWalkwayCount?: number;
  averageTerrainOffsetM?: number;
  maxTerrainOffsetM?: number;
  transportTerrainCoverageRatio?: number;
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

export interface SceneTerrainProfile {
  mode: 'FLAT_PLACEHOLDER' | 'LOCAL_DEM_SAMPLES';
  source: 'NONE' | 'LOCAL_FILE';
  hasElevationModel: boolean;
  heightReference: 'ELLIPSOID_APPROX' | 'LOCAL_DEM';
  baseHeightMeters: number;
  sampleCount: number;
  minHeightMeters: number;
  maxHeightMeters: number;
  sourcePath: string | null;
  notes: string;
  samples: Array<{
    location: Coordinate;
    heightMeters: number;
  }>;
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
  qualityGate?: SceneQualityGateResult;
  terrainProfile?: SceneTerrainProfile;
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
  qualityGate?: SceneQualityGateResult;
  staticAtmosphere?: SceneStaticAtmosphereProfile;
  sceneWideAtmosphereProfile?: SceneWideAtmosphereProfile;
  districtAtmosphereProfiles?: DistrictAtmosphereProfile[];
  provenance: {
    mapillaryUsed: boolean;
    mapillaryImageCount: number;
    mapillaryFeatureCount: number;
    mapillaryImageStrategy?:
      | 'bbox'
      | 'bbox_expanded'
      | 'feature_radius'
      | 'none';
    mapillaryImageAttempts?: Array<{
      mode: 'bbox' | 'feature_radius';
      label: string;
      resultCount: number;
    }>;
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

export type { LandmarkAnnotationManifest };
