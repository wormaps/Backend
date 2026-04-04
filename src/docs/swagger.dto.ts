import { ApiProperty } from '@nestjs/swagger';

export class MetaDto {
  @ApiProperty({ example: 'req_01HQX8M3F' })
  requestId!: string;

  @ApiProperty({ example: '2026-03-05T08:40:21Z' })
  timestamp!: string;
}

export class ErrorBodyDto {
  @ApiProperty({ example: 'PLACE_NOT_FOUND' })
  code!: string;

  @ApiProperty({ example: '장소를 찾을 수 없습니다.' })
  message!: string;

  @ApiProperty({
    nullable: true,
    example: { placeId: 'unknown-place' },
  })
  detail!: unknown;
}

export class ErrorResponseDto {
  @ApiProperty({ example: false })
  ok!: false;

  @ApiProperty({ example: 404 })
  status!: number;

  @ApiProperty({ type: ErrorBodyDto })
  error!: ErrorBodyDto;

  @ApiProperty({ type: MetaDto })
  meta!: MetaDto;
}

export class CoordinateDto {
  @ApiProperty({ example: 37.4979 })
  lat!: number;

  @ApiProperty({ example: 127.0276 })
  lng!: number;
}

export class Vector3Dto {
  @ApiProperty({ example: 0 })
  x!: number;

  @ApiProperty({ example: 170 })
  y!: number;

  @ApiProperty({ example: 130 })
  z!: number;
}

export class CameraDto {
  @ApiProperty({ type: Vector3Dto })
  topView!: Vector3Dto;

  @ApiProperty({ type: Vector3Dto })
  walkViewStart!: Vector3Dto;
}

export class BoundsDto {
  @ApiProperty({ type: CoordinateDto })
  northEast!: CoordinateDto;

  @ApiProperty({ type: CoordinateDto })
  southWest!: CoordinateDto;
}

export class RegistryInfoDto {
  @ApiProperty({ example: 'gangnam-station' })
  id!: string;

  @ApiProperty({ example: 'gangnam-station' })
  slug!: string;

  @ApiProperty({ example: 'Gangnam Station' })
  name!: string;

  @ApiProperty({ example: 'South Korea' })
  country!: string;

  @ApiProperty({ example: 'Seoul' })
  city!: string;

  @ApiProperty({ type: CoordinateDto })
  location!: CoordinateDto;

  @ApiProperty({ enum: ['CROSSING', 'SQUARE', 'STATION', 'PLAZA'] })
  placeType!: string;

  @ApiProperty({
    type: [String],
    example: ['transit', 'commercial', 'commute'],
  })
  tags!: string[];
}

export class PackageSummaryDto {
  @ApiProperty({ example: '2026.04-mvp' })
  version!: string;

  @ApiProperty({ example: '2026-04-04T00:00:00Z' })
  generatedAt!: string;

  @ApiProperty({ example: 1 })
  buildingCount!: number;

  @ApiProperty({ example: 1 })
  roadCount!: number;

  @ApiProperty({ example: 1 })
  walkwayCount!: number;

  @ApiProperty({ example: 2 })
  poiCount!: number;
}

export class PlaceDetailDto {
  @ApiProperty({ type: RegistryInfoDto })
  registry!: RegistryInfoDto;

  @ApiProperty({ type: PackageSummaryDto })
  packageSummary!: PackageSummaryDto;

  @ApiProperty({ enum: ['DAY', 'EVENING', 'NIGHT'], isArray: true })
  supportedTimeOfDay!: string[];

  @ApiProperty({ enum: ['CLEAR', 'CLOUDY', 'RAIN', 'SNOW'], isArray: true })
  supportedWeather!: string[];
}

export class BuildingDto {
  @ApiProperty({ example: 'building-1' })
  id!: string;

  @ApiProperty({ example: 'Gangnam Commercial Block' })
  name!: string;

  @ApiProperty({ example: 62 })
  heightMeters!: number;

  @ApiProperty({ type: [CoordinateDto] })
  footprint!: CoordinateDto[];

  @ApiProperty({ enum: ['COMMERCIAL', 'TRANSIT', 'MIXED', 'PUBLIC'] })
  usage!: string;
}

export class RoadDto {
  @ApiProperty({ example: 'road-1' })
  id!: string;

  @ApiProperty({ example: 'Teheran-ro' })
  name!: string;

  @ApiProperty({ example: 5 })
  laneCount!: number;

  @ApiProperty({ example: 'primary' })
  roadClass!: string;

  @ApiProperty({ example: 14 })
  widthMeters!: number;

  @ApiProperty({ type: [CoordinateDto] })
  path!: CoordinateDto[];

  @ApiProperty({ enum: ['ONE_WAY', 'TWO_WAY'] })
  direction!: string;
}

export class WalkwayDto {
  @ApiProperty({ example: 'walkway-1' })
  id!: string;

  @ApiProperty({ example: 'Exit 11 Walkway' })
  name!: string;

  @ApiProperty({ type: [CoordinateDto] })
  path!: CoordinateDto[];

  @ApiProperty({ example: 7 })
  widthMeters!: number;

  @ApiProperty({ example: 'footway' })
  walkwayType!: string;
}

export class PoiDto {
  @ApiProperty({ example: 'poi-1' })
  id!: string;

  @ApiProperty({ example: 'Exit 11' })
  name!: string;

  @ApiProperty({ enum: ['LANDMARK', 'ENTRANCE', 'SIGNAL', 'SHOP'] })
  type!: string;

  @ApiProperty({ type: CoordinateDto })
  location!: CoordinateDto;
}

export class PlacePackageDto {
  @ApiProperty({ example: 'gangnam-station' })
  placeId!: string;

  @ApiProperty({ example: '2026.04-mvp' })
  version!: string;

  @ApiProperty({ example: '2026-04-04T00:00:00Z' })
  generatedAt!: string;

  @ApiProperty({ type: CameraDto })
  camera!: CameraDto;

  @ApiProperty({ type: BoundsDto })
  bounds!: BoundsDto;

  @ApiProperty({ type: [BuildingDto] })
  buildings!: BuildingDto[];

  @ApiProperty({ type: [RoadDto] })
  roads!: RoadDto[];

  @ApiProperty({ type: [WalkwayDto] })
  walkways!: WalkwayDto[];

  @ApiProperty({ type: [PoiDto] })
  pois!: PoiDto[];

  @ApiProperty({ type: [PoiDto] })
  landmarks!: PoiDto[];
}

export class DensityMetricDto {
  @ApiProperty({ enum: ['LOW', 'MEDIUM', 'HIGH'] })
  level!: string;

  @ApiProperty({ example: 74 })
  count!: number;
}

export class LightingStateDto {
  @ApiProperty({ enum: ['BRIGHT', 'SOFT', 'DIM'] })
  ambient!: string;

  @ApiProperty({ example: true })
  neon!: boolean;

  @ApiProperty({ example: true })
  buildingLights!: boolean;

  @ApiProperty({ example: true })
  vehicleLights!: boolean;
}

export class SurfaceStateDto {
  @ApiProperty({ example: false })
  wetRoad!: boolean;

  @ApiProperty({ example: false })
  puddles!: boolean;

  @ApiProperty({ example: true })
  snowCover!: boolean;
}

export class PlaybackDto {
  @ApiProperty({ enum: [1, 2, 4, 8], example: 1 })
  recommendedSpeed!: number;

  @ApiProperty({ example: 0.85 })
  pedestrianAnimationRate!: number;

  @ApiProperty({ example: 0.7 })
  vehicleAnimationRate!: number;
}

export class SourceDetailDto {
  @ApiProperty({ enum: ['MVP_SYNTHETIC_RULES', 'OPEN_METEO_HISTORICAL'] })
  provider!: string;

  @ApiProperty({ nullable: true, example: '2026-04-04' })
  date?: string | null;

  @ApiProperty({ nullable: true, example: '2026-04-04T22:00' })
  localTime?: string | null;
}

export class SceneSnapshotDto {
  @ApiProperty({ example: 'gangnam-station' })
  placeId!: string;

  @ApiProperty({ enum: ['DAY', 'EVENING', 'NIGHT'] })
  timeOfDay!: string;

  @ApiProperty({ enum: ['CLEAR', 'CLOUDY', 'RAIN', 'SNOW'] })
  weather!: string;

  @ApiProperty({ example: '2026-04-04T08:40:21Z' })
  generatedAt!: string;

  @ApiProperty({ enum: ['MVP_SYNTHETIC_RULES'] })
  source!: string;

  @ApiProperty({ type: DensityMetricDto })
  crowd!: DensityMetricDto;

  @ApiProperty({ type: DensityMetricDto })
  vehicles!: DensityMetricDto;

  @ApiProperty({ type: LightingStateDto })
  lighting!: LightingStateDto;

  @ApiProperty({ type: SurfaceStateDto })
  surface!: SurfaceStateDto;

  @ApiProperty({ type: PlaybackDto })
  playback!: PlaybackDto;

  @ApiProperty({ type: SourceDetailDto, required: false })
  sourceDetail?: SourceDetailDto;
}

export class CreateSceneRequestDto {
  @ApiProperty({ example: 'Seoul City Hall' })
  query!: string;

  @ApiProperty({
    required: false,
    enum: ['SMALL', 'MEDIUM', 'LARGE'],
    example: 'MEDIUM',
  })
  scale?: string;
}

export class SceneEntityDto {
  @ApiProperty({ example: 'scene-seoul-city-hall' })
  sceneId!: string;

  @ApiProperty({ nullable: true, example: 'ChIJ123456789' })
  placeId!: string | null;

  @ApiProperty({ example: 'Seoul City Hall' })
  name!: string;

  @ApiProperty({ example: 37.5665 })
  centerLat!: number;

  @ApiProperty({ example: 126.978 })
  centerLng!: number;

  @ApiProperty({ example: 600 })
  radiusM!: number;

  @ApiProperty({ enum: ['PENDING', 'READY', 'FAILED'] })
  status!: string;

  @ApiProperty({ example: '/api/scenes/scene-seoul-city-hall/meta' })
  metaUrl!: string;

  @ApiProperty({ nullable: true, example: '/api/scenes/scene-seoul-city-hall/assets/base.glb' })
  assetUrl!: string | null;

  @ApiProperty({ example: '2026-04-04T08:40:21Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-04-04T08:40:21Z' })
  updatedAt!: string;

  @ApiProperty({ nullable: true, example: null })
  failureReason?: string | null;
}

export class SceneRoadMetaDto {
  @ApiProperty({ example: 'road-123' })
  objectId!: string;

  @ApiProperty({ example: 'way_123' })
  osmWayId!: string;

  @ApiProperty({ example: 'Teheran-ro' })
  name!: string;

  @ApiProperty({ example: 4 })
  laneCount!: number;

  @ApiProperty({ example: 'primary' })
  roadClass!: string;

  @ApiProperty({ example: 14 })
  widthMeters!: number;

  @ApiProperty({ enum: ['ONE_WAY', 'TWO_WAY'] })
  direction!: string;

  @ApiProperty({ type: [CoordinateDto] })
  path!: CoordinateDto[];

  @ApiProperty({ type: CoordinateDto })
  center!: CoordinateDto;
}

export class SceneBuildingMetaDto {
  @ApiProperty({ example: 'building-456' })
  objectId!: string;

  @ApiProperty({ example: 'way_456' })
  osmWayId!: string;

  @ApiProperty({ required: false, example: 'City Hall' })
  name?: string;

  @ApiProperty({ example: 40 })
  heightMeters!: number;

  @ApiProperty({ type: [CoordinateDto] })
  outerRing!: CoordinateDto[];

  @ApiProperty({
    example: [[{ lat: 35.6597, lng: 139.7008 }]],
  })
  holes!: CoordinateDto[][];

  @ApiProperty({ type: [CoordinateDto] })
  footprint!: CoordinateDto[];

  @ApiProperty({ enum: ['COMMERCIAL', 'TRANSIT', 'MIXED', 'PUBLIC'] })
  usage!: string;

  @ApiProperty({
    enum: [
      'glass_tower',
      'office_midrise',
      'mall_block',
      'station_block',
      'mixed_midrise',
      'small_lowrise',
    ],
  })
  preset!: string;

  @ApiProperty({ enum: ['flat', 'stepped', 'gable'] })
  roofType!: string;

  @ApiProperty({ nullable: true, example: '#8eb7d9' })
  facadeColor!: string | null;

  @ApiProperty({ nullable: true, example: 'glass' })
  facadeMaterial!: string | null;

  @ApiProperty({ nullable: true, example: '#dfe8f4' })
  roofColor!: string | null;

  @ApiProperty({ nullable: true, example: 'metal' })
  roofMaterial!: string | null;

  @ApiProperty({ nullable: true, example: 'flat' })
  roofShape!: string | null;
}

export class SceneWalkwayMetaDto {
  @ApiProperty({ example: 'walkway-11' })
  objectId!: string;

  @ApiProperty({ example: 'way_11' })
  osmWayId!: string;

  @ApiProperty({ example: 'Main Walkway' })
  name!: string;

  @ApiProperty({ type: [CoordinateDto] })
  path!: CoordinateDto[];

  @ApiProperty({ example: 4 })
  widthMeters!: number;

  @ApiProperty({ example: 'footway' })
  walkwayType!: string;

  @ApiProperty({ nullable: true, example: 'paving_stones' })
  surface!: string | null;
}

export class ScenePoiMetaDto {
  @ApiProperty({ example: 'poi-1' })
  objectId!: string;

  @ApiProperty({ required: false, example: 'google-place-id' })
  placeId?: string;

  @ApiProperty({ example: 'Cafe Example' })
  name!: string;

  @ApiProperty({ enum: ['LANDMARK', 'ENTRANCE', 'SIGNAL', 'SHOP'] })
  type!: string;

  @ApiProperty({ type: CoordinateDto })
  location!: CoordinateDto;

  @ApiProperty({ required: false, example: 'shop' })
  category?: string;

  @ApiProperty({ example: false })
  isLandmark!: boolean;
}

export class SceneMetaBoundsDto {
  @ApiProperty({ example: 600 })
  radiusM!: number;

  @ApiProperty({ type: CoordinateDto })
  northEast!: CoordinateDto;

  @ApiProperty({ type: CoordinateDto })
  southWest!: CoordinateDto;
}

export class SceneMetaStatsDto {
  @ApiProperty({ example: 24 })
  buildingCount!: number;

  @ApiProperty({ example: 8 })
  roadCount!: number;

  @ApiProperty({ example: 5 })
  walkwayCount!: number;

  @ApiProperty({ example: 18 })
  poiCount!: number;
}

export class SceneMetaDiagnosticsDto {
  @ApiProperty({ example: 2 })
  droppedBuildings!: number;

  @ApiProperty({ example: 1 })
  droppedRoads!: number;

  @ApiProperty({ example: 3 })
  droppedWalkways!: number;

  @ApiProperty({ example: 4 })
  droppedPois!: number;
}

export class SceneAssetCountsDto {
  @ApiProperty({ example: 700 })
  buildingCount!: number;

  @ApiProperty({ example: 220 })
  roadCount!: number;

  @ApiProperty({ example: 320 })
  walkwayCount!: number;

  @ApiProperty({ example: 220 })
  poiCount!: number;

  @ApiProperty({ example: 24 })
  crossingCount!: number;

  @ApiProperty({ example: 60 })
  trafficLightCount!: number;

  @ApiProperty({ example: 90 })
  streetLightCount!: number;

  @ApiProperty({ example: 120 })
  signPoleCount!: number;

  @ApiProperty({ example: 80 })
  treeClusterCount!: number;

  @ApiProperty({ example: 160 })
  billboardPanelCount!: number;
}

export class SceneAssetProfileDto {
  @ApiProperty({ enum: ['SMALL', 'MEDIUM', 'LARGE'] })
  preset!: string;

  @ApiProperty({ type: SceneAssetCountsDto })
  budget!: SceneAssetCountsDto;

  @ApiProperty({ type: SceneAssetCountsDto })
  selected!: SceneAssetCountsDto;
}

export class SceneMetaDto {
  @ApiProperty({ example: 'scene-seoul-city-hall' })
  sceneId!: string;

  @ApiProperty({ example: 'google-place-id' })
  placeId!: string;

  @ApiProperty({ example: 'Seoul City Hall' })
  name!: string;

  @ApiProperty({ example: '2026-04-04T08:40:21Z' })
  generatedAt!: string;

  @ApiProperty({ type: CoordinateDto })
  origin!: CoordinateDto;

  @ApiProperty({ type: CameraDto })
  camera!: CameraDto;

  @ApiProperty({ type: SceneMetaBoundsDto })
  bounds!: SceneMetaBoundsDto;

  @ApiProperty({ type: SceneMetaStatsDto })
  stats!: SceneMetaStatsDto;

  @ApiProperty({ type: SceneMetaDiagnosticsDto })
  diagnostics!: SceneMetaDiagnosticsDto;

  @ApiProperty({ enum: ['FULL', 'PARTIAL', 'OSM_ONLY'] })
  detailStatus!: string;

  @ApiProperty({
    example: {
      structure: 1,
      streetDetail: 0.68,
      landmark: 0.74,
      signage: 0.71,
    },
  })
  visualCoverage!: Record<string, number>;

  @ApiProperty({
    example: [
      { className: 'glass', palette: ['#8eb7d9'], buildingCount: 23 },
    ],
  })
  materialClasses!: Array<Record<string, unknown>>;

  @ApiProperty({
    example: [
      {
        objectId: 'override-landmark-crossing',
        name: 'Shibuya Scramble Crossing',
        kind: 'CROSSING',
        location: { lat: 35.659482, lng: 139.7005596 },
      },
    ],
  })
  landmarkAnchors!: Array<Record<string, unknown>>;

  @ApiProperty({ type: SceneAssetProfileDto })
  assetProfile!: SceneAssetProfileDto;

  @ApiProperty({ type: [SceneRoadMetaDto] })
  roads!: SceneRoadMetaDto[];

  @ApiProperty({ type: [SceneBuildingMetaDto] })
  buildings!: SceneBuildingMetaDto[];

  @ApiProperty({ type: [SceneWalkwayMetaDto] })
  walkways!: SceneWalkwayMetaDto[];

  @ApiProperty({ type: [ScenePoiMetaDto] })
  pois!: ScenePoiMetaDto[];
}

export class BootstrapEndpointsDto {
  @ApiProperty({ example: '/api/scenes/scene-seoul-city-hall/traffic' })
  traffic!: string;

  @ApiProperty({ example: '/api/scenes/scene-seoul-city-hall/weather' })
  weather!: string;

  @ApiProperty({ example: '/api/scenes/scene-seoul-city-hall/places' })
  places!: string;
}

export class BootstrapResponseDto {
  @ApiProperty({ example: 'scene-seoul-city-hall' })
  sceneId!: string;

  @ApiProperty({ example: '/api/scenes/scene-seoul-city-hall/assets/base.glb' })
  assetUrl!: string;

  @ApiProperty({ example: '/api/scenes/scene-seoul-city-hall/meta' })
  metaUrl!: string;

  @ApiProperty({ example: '/api/scenes/scene-seoul-city-hall/detail' })
  detailUrl!: string;

  @ApiProperty({ enum: ['FULL', 'PARTIAL', 'OSM_ONLY'] })
  detailStatus!: string;

  @ApiProperty({ type: SceneAssetProfileDto })
  assetProfile!: SceneAssetProfileDto;

  @ApiProperty({ type: BootstrapEndpointsDto })
  liveEndpoints!: BootstrapEndpointsDto;
}

export class SceneCrossingDetailDto {
  @ApiProperty({ example: 'crossing-1' })
  objectId!: string;

  @ApiProperty({ example: 'Main Crossing' })
  name!: string;

  @ApiProperty({ enum: ['CROSSING'] })
  type!: string;

  @ApiProperty({ nullable: true, example: 'zebra' })
  crossing!: string | null;

  @ApiProperty({ nullable: true, example: 'zebra' })
  crossingRef!: string | null;

  @ApiProperty({ example: true })
  signalized!: boolean;

  @ApiProperty({ type: [CoordinateDto] })
  path!: CoordinateDto[];

  @ApiProperty({ type: CoordinateDto })
  center!: CoordinateDto;

  @ApiProperty({ example: true })
  principal!: boolean;

  @ApiProperty({ enum: ['zebra', 'signalized', 'unknown'] })
  style!: string;
}

export class SceneRoadMarkingDetailDto {
  @ApiProperty({ example: 'road-1-lane-line' })
  objectId!: string;

  @ApiProperty({ enum: ['LANE_LINE', 'STOP_LINE', 'CROSSWALK'] })
  type!: string;

  @ApiProperty({ example: '#ffffff' })
  color!: string;

  @ApiProperty({ type: [CoordinateDto] })
  path!: CoordinateDto[];
}

export class SceneStreetFurnitureDetailDto {
  @ApiProperty({ example: 'street-furniture-1' })
  objectId!: string;

  @ApiProperty({ example: 'signal-1' })
  name!: string;

  @ApiProperty({ enum: ['TRAFFIC_LIGHT', 'STREET_LIGHT', 'SIGN_POLE', 'BOLLARD'] })
  type!: string;

  @ApiProperty({ type: CoordinateDto })
  location!: CoordinateDto;

  @ApiProperty({ example: true })
  principal!: boolean;
}

export class SceneVegetationDetailDto {
  @ApiProperty({ example: 'vegetation-1' })
  objectId!: string;

  @ApiProperty({ example: 'tree-1' })
  name!: string;

  @ApiProperty({ enum: ['TREE', 'PLANTER', 'GREEN_PATCH'] })
  type!: string;

  @ApiProperty({ type: CoordinateDto })
  location!: CoordinateDto;

  @ApiProperty({ example: 2.4 })
  radiusMeters!: number;
}

export class SceneFacadeHintDto {
  @ApiProperty({ example: 'building-1' })
  objectId!: string;

  @ApiProperty({ type: CoordinateDto })
  anchor!: CoordinateDto;

  @ApiProperty({ nullable: true, example: 1 })
  facadeEdgeIndex!: number | null;

  @ApiProperty({ example: 8 })
  windowBands!: number;

  @ApiProperty({ example: true })
  billboardEligible!: boolean;

  @ApiProperty({ type: [String], example: ['#8eb7d9', '#d9ebf5'] })
  palette!: string[];

  @ApiProperty({ enum: ['glass', 'concrete', 'brick', 'metal', 'mixed'] })
  materialClass!: string;

  @ApiProperty({ enum: ['low', 'medium', 'high'] })
  signageDensity!: string;

  @ApiProperty({ example: 0.85 })
  emissiveStrength!: number;

  @ApiProperty({ example: 0.42 })
  glazingRatio!: number;
}

export class SceneSignageClusterDto {
  @ApiProperty({ example: 'signage-cluster-1' })
  objectId!: string;

  @ApiProperty({ type: CoordinateDto })
  anchor!: CoordinateDto;

  @ApiProperty({ example: 6 })
  panelCount!: number;

  @ApiProperty({ type: [String], example: ['#f44336', '#ffffff'] })
  palette!: string[];

  @ApiProperty({ example: 1 })
  emissiveStrength!: number;

  @ApiProperty({ example: 6 })
  widthMeters!: number;

  @ApiProperty({ example: 3 })
  heightMeters!: number;
}

export class SceneDetailDto {
  @ApiProperty({ example: 'scene-shibuya-scramble-crossing' })
  sceneId!: string;

  @ApiProperty({ example: 'google-place-id' })
  placeId!: string;

  @ApiProperty({ example: '2026-04-04T08:40:21Z' })
  generatedAt!: string;

  @ApiProperty({ enum: ['FULL', 'PARTIAL', 'OSM_ONLY'] })
  detailStatus!: string;

  @ApiProperty({ type: [SceneCrossingDetailDto] })
  crossings!: SceneCrossingDetailDto[];

  @ApiProperty({ type: [SceneRoadMarkingDetailDto] })
  roadMarkings!: SceneRoadMarkingDetailDto[];

  @ApiProperty({ type: [SceneStreetFurnitureDetailDto] })
  streetFurniture!: SceneStreetFurnitureDetailDto[];

  @ApiProperty({ type: [SceneVegetationDetailDto] })
  vegetation!: SceneVegetationDetailDto[];

  @ApiProperty({ example: [{ id: 'land-cover-1', type: 'PARK' }] })
  landCovers!: Array<Record<string, unknown>>;

  @ApiProperty({ example: [{ id: 'linear-feature-1', type: 'RAILWAY' }] })
  linearFeatures!: Array<Record<string, unknown>>;

  @ApiProperty({ type: [SceneFacadeHintDto] })
  facadeHints!: SceneFacadeHintDto[];

  @ApiProperty({ type: [SceneSignageClusterDto] })
  signageClusters!: SceneSignageClusterDto[];

  @ApiProperty({ type: [String] })
  heroOverridesApplied!: string[];

  @ApiProperty({ example: { mapillaryUsed: true, mapillaryImageCount: 12 } })
  provenance!: Record<string, unknown>;
}

export class TrafficSegmentDto {
  @ApiProperty({ example: 'road-1' })
  objectId!: string;

  @ApiProperty({ example: 11 })
  currentSpeed!: number;

  @ApiProperty({ example: 17 })
  freeFlowSpeed!: number;

  @ApiProperty({ example: 0.35 })
  congestionScore!: number;

  @ApiProperty({ enum: ['free', 'moderate', 'slow', 'jammed'] })
  status!: string;

  @ApiProperty({ nullable: true, example: 0.92 })
  confidence!: number | null;

  @ApiProperty({ example: false })
  roadClosure!: boolean;
}

export class SceneTrafficResponseDto {
  @ApiProperty({ example: '2026-04-04T13:00:00Z' })
  updatedAt!: string;

  @ApiProperty({ type: [TrafficSegmentDto] })
  segments!: TrafficSegmentDto[];
}

export class SceneWeatherResponseDto {
  @ApiProperty({ example: '2026-04-04T13:00:00Z' })
  updatedAt!: string;

  @ApiProperty({ nullable: true, example: 3 })
  weatherCode!: number | null;

  @ApiProperty({ nullable: true, example: 13.2 })
  temperature!: number | null;

  @ApiProperty({ example: 'cloudy' })
  preset!: string;

  @ApiProperty({ enum: ['OPEN_METEO_HISTORICAL'] })
  source!: string;

  @ApiProperty({ nullable: true, example: '2026-04-04T12:00' })
  observedAt!: string | null;
}

export class ScenePlacesResponseDto {
  @ApiProperty({ type: [ScenePoiMetaDto] })
  pois!: ScenePoiMetaDto[];
}

export class HealthDataDto {
  @ApiProperty({ example: 'wormapb' })
  service!: string;

  @ApiProperty({ example: 120 })
  uptimeSeconds!: number;
}

export class ExternalPlaceSearchItemDto {
  @ApiProperty({ enum: ['GOOGLE_PLACES'] })
  provider!: string;

  @ApiProperty({ example: 'ChIJ...' })
  placeId!: string;

  @ApiProperty({ example: 'Gangnam Station' })
  displayName!: string;

  @ApiProperty({ nullable: true, example: 'Gangnam-daero, Seoul, South Korea' })
  formattedAddress!: string | null;

  @ApiProperty({ type: CoordinateDto })
  location!: CoordinateDto;

  @ApiProperty({ nullable: true, example: 'subway_station' })
  primaryType!: string | null;

  @ApiProperty({
    type: [String],
    example: ['subway_station', 'transit_station'],
  })
  types!: string[];

  @ApiProperty({ nullable: true, example: 'https://maps.google.com/?cid=...' })
  googleMapsUri!: string | null;
}

export class ExternalPlaceDetailDto extends ExternalPlaceSearchItemDto {
  @ApiProperty({ nullable: true, type: BoundsDto })
  viewport!: BoundsDto | null;

  @ApiProperty({ nullable: true, example: 540 })
  utcOffsetMinutes!: number | null;
}

export class WeatherObservationDto {
  @ApiProperty({ example: '2026-04-04' })
  date!: string;

  @ApiProperty({ example: '2026-04-04T22:00' })
  localTime!: string;

  @ApiProperty({ nullable: true, example: -2 })
  temperatureCelsius!: number | null;

  @ApiProperty({ nullable: true, example: 1 })
  precipitationMm!: number | null;

  @ApiProperty({ nullable: true, example: 0 })
  rainMm!: number | null;

  @ApiProperty({ nullable: true, example: 1.4 })
  snowfallCm!: number | null;

  @ApiProperty({ nullable: true, example: 98 })
  cloudCoverPercent!: number | null;

  @ApiProperty({ enum: ['CLEAR', 'CLOUDY', 'RAIN', 'SNOW'] })
  resolvedWeather!: string;

  @ApiProperty({ enum: ['OPEN_METEO_HISTORICAL'] })
  source!: string;
}

export class ExternalPlacePackageResponseDto {
  @ApiProperty({ type: ExternalPlaceDetailDto })
  place!: ExternalPlaceDetailDto;

  @ApiProperty({ type: PlacePackageDto })
  package!: PlacePackageDto;
}

export class ExternalSceneSnapshotResponseDto {
  @ApiProperty({ type: ExternalPlaceDetailDto })
  place!: ExternalPlaceDetailDto;

  @ApiProperty({ type: SceneSnapshotDto })
  snapshot!: SceneSnapshotDto;

  @ApiProperty({ type: WeatherObservationDto, nullable: true })
  weatherObservation!: WeatherObservationDto | null;
}
