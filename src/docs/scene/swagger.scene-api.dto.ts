import { ApiProperty } from '@nestjs/swagger';
import { ExternalPlaceDetailDto } from '../places/swagger.places.dto';
import {
  DensityMetricDto,
  LightingStateDto,
  PlaybackDto,
  SceneCrossingDetailDto,
  SceneFacadeHintDto,
  SceneRoadMarkingDetailDto,
  SceneSignageClusterDto,
  SceneStreetFurnitureDetailDto,
  SceneVegetationDetailDto,
  SourceDetailDto,
  SurfaceStateDto,
  TrafficSegmentDto,
  WeatherObservationDto,
} from './swagger.scene-core.dto';
import {
  SceneAssetProfileDto,
  ScenePoiMetaDto,
  SceneStructuralCoverageDto,
} from './swagger.scene-meta.dto';

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

  @ApiProperty({
    required: false,
    example: false,
    description:
      'true이면 동일 query/scale의 READY scene이 있어도 재사용하지 않습니다.',
  })
  forceRegenerate?: boolean;
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

  @ApiProperty({
    nullable: true,
    example: '/api/scenes/scene-seoul-city-hall/assets/base.glb',
  })
  assetUrl!: string | null;

  @ApiProperty({ example: '2026-04-04T08:40:21Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-04-04T08:40:21Z' })
  updatedAt!: string;

  @ApiProperty({ nullable: true, example: null })
  failureReason?: string | null;
}

export class BootstrapEndpointsDto {
  @ApiProperty({ example: '/api/scenes/scene-seoul-city-hall/state' })
  state!: string;

  @ApiProperty({ example: '/api/scenes/scene-seoul-city-hall/traffic' })
  traffic!: string;

  @ApiProperty({ example: '/api/scenes/scene-seoul-city-hall/weather' })
  weather!: string;

  @ApiProperty({ example: '/api/scenes/scene-seoul-city-hall/places' })
  places!: string;
}

export class GlbCoverageDto {
  @ApiProperty({ example: true })
  buildings!: boolean;

  @ApiProperty({ example: true })
  roads!: boolean;

  @ApiProperty({ example: true })
  walkways!: boolean;

  @ApiProperty({ example: true })
  crosswalks!: boolean;

  @ApiProperty({ example: true })
  streetFurniture!: boolean;

  @ApiProperty({ example: true })
  vegetation!: boolean;

  @ApiProperty({ example: true })
  pois!: boolean;

  @ApiProperty({ example: true })
  landCovers!: boolean;

  @ApiProperty({ example: true })
  linearFeatures!: boolean;
}

export class OverlaySourcesDto {
  @ApiProperty({ example: '/api/scenes/scene-seoul-city-hall/places' })
  pois!: string;

  @ApiProperty({ example: '/api/scenes/scene-seoul-city-hall/detail' })
  crossings!: string;

  @ApiProperty({ example: '/api/scenes/scene-seoul-city-hall/detail' })
  streetFurniture!: string;

  @ApiProperty({ example: '/api/scenes/scene-seoul-city-hall/detail' })
  vegetation!: string;

  @ApiProperty({ example: '/api/scenes/scene-seoul-city-hall/detail' })
  landCovers!: string;

  @ApiProperty({ example: '/api/scenes/scene-seoul-city-hall/detail' })
  linearFeatures!: string;
}

export class LiveDataModesDto {
  @ApiProperty({ enum: ['LIVE_BEST_EFFORT'] })
  traffic!: string;

  @ApiProperty({ enum: ['CURRENT_OR_HISTORICAL'] })
  weather!: string;

  @ApiProperty({ enum: ['SYNTHETIC_RULES'] })
  state!: string;
}

export class RenderContractDto {
  @ApiProperty({ type: GlbCoverageDto })
  glbCoverage!: GlbCoverageDto;

  @ApiProperty({ type: OverlaySourcesDto })
  overlaySources!: OverlaySourcesDto;

  @ApiProperty({ type: LiveDataModesDto })
  liveDataModes!: LiveDataModesDto;
}

export class GlbSourcesDto {
  @ApiProperty({ example: true })
  googlePlaces!: boolean;

  @ApiProperty({ example: true })
  overpass!: boolean;

  @ApiProperty({ example: true })
  mapillary!: boolean;

  @ApiProperty({ example: false })
  weatherBaked!: false;

  @ApiProperty({ example: false })
  trafficBaked!: false;
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

  @ApiProperty({ type: GlbSourcesDto })
  glbSources!: GlbSourcesDto;

  @ApiProperty({ type: SceneAssetProfileDto })
  assetProfile!: SceneAssetProfileDto;

  @ApiProperty({ type: SceneStructuralCoverageDto })
  structuralCoverage!: SceneStructuralCoverageDto;

  @ApiProperty({ type: BootstrapEndpointsDto })
  liveEndpoints!: BootstrapEndpointsDto;

  @ApiProperty({ type: RenderContractDto })
  renderContract!: RenderContractDto;
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
  annotationsApplied!: string[];

  @ApiProperty({ type: SceneStructuralCoverageDto, required: false })
  structuralCoverage?: SceneStructuralCoverageDto;

  @ApiProperty({ example: { mapillaryUsed: true, mapillaryImageCount: 12 } })
  provenance!: Record<string, unknown>;
}

export class SceneTrafficResponseDto {
  @ApiProperty({ example: '2026-04-04T13:00:00Z' })
  updatedAt!: string;

  @ApiProperty({ type: [TrafficSegmentDto] })
  segments!: TrafficSegmentDto[];

  @ApiProperty({ example: false })
  degraded!: boolean;

  @ApiProperty({ example: 0 })
  failedSegmentCount!: number;
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

  @ApiProperty({ enum: ['OPEN_METEO_CURRENT', 'OPEN_METEO_HISTORICAL'] })
  source!: string;

  @ApiProperty({ nullable: true, example: '2026-04-04T12:00' })
  observedAt!: string | null;
}

export class SceneStateResponseDto {
  @ApiProperty({ example: 'google-place-id' })
  placeId!: string;

  @ApiProperty({ example: '2026-04-04T13:00:00Z' })
  updatedAt!: string;

  @ApiProperty({ enum: ['DAY', 'EVENING', 'NIGHT'] })
  timeOfDay!: string;

  @ApiProperty({ enum: ['CLEAR', 'CLOUDY', 'RAIN', 'SNOW'] })
  weather!: string;

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

export class ScenePlacesResponseDto {
  @ApiProperty({ type: [ScenePoiMetaDto] })
  pois!: ScenePoiMetaDto[];

  @ApiProperty({ type: [ScenePoiMetaDto] })
  landmarks!: ScenePoiMetaDto[];

  @ApiProperty({
    example: [
      { category: 'shop', count: 12, landmarkCount: 1 },
      { category: 'signal', count: 4, landmarkCount: 0 },
    ],
  })
  categories!: Array<Record<string, unknown>>;
}

export class ExternalSceneSnapshotResponseDto {
  @ApiProperty({ type: ExternalPlaceDetailDto })
  place!: ExternalPlaceDetailDto;

  @ApiProperty({ type: SceneSnapshotDto })
  snapshot!: SceneSnapshotDto;

  @ApiProperty({ type: WeatherObservationDto, nullable: true })
  weatherObservation!: WeatherObservationDto | null;
}
