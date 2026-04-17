import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  Length,
  ValidateNested,
} from 'class-validator';
import { ExternalPlaceDetailDto } from '../places/swagger.places.dto';
import {
  DensityMetricDto,
  LightingStateDto,
  SceneCrossingDetailDto,
  SceneFacadeHintDto,
  SceneRoadMarkingDetailDto,
  SceneSignageClusterDto,
  SceneStreetFurnitureDetailDto,
  SceneVegetationDetailDto,
  TrafficSegmentDto,
  WeatherObservationDto,
} from './swagger.scene-core.dto';
import {
  SceneAssetProfileDto,
  ScenePoiMetaDto,
  SceneStructuralCoverageDto,
} from './swagger.scene-meta.dto';
import {
  SceneEntityStateResponseDto,
  SceneSnapshotDto,
  SceneStateResponseDto,
} from './swagger.scene-state.dto';

class CuratedLandmarkDto {
  @ApiProperty({ example: 'lm-1' })
  @IsString()
  @Length(1, 64)
  id!: string;

  @ApiProperty({ example: 'Landmark 1' })
  @IsString()
  @Length(1, 128)
  name!: string;
}

class CuratedFacadeOverrideDto {
  @ApiProperty({ example: 'building-1' })
  @IsString()
  @Length(1, 128)
  objectId!: string;

  @ApiProperty({ example: ['#ff7755'] })
  @IsArray()
  @IsString({ each: true })
  palette!: string[];
}

class CuratedSignageOverrideDto {
  @ApiProperty({ example: 'sign-1' })
  @IsString()
  @Length(1, 128)
  objectId!: string;

  @ApiProperty({ example: 3 })
  @IsInt()
  @Min(1)
  @Max(10)
  panelCount!: number;
}

class CuratedAssetPayloadDto {
  @ApiProperty({ type: [CuratedLandmarkDto], required: false })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CuratedLandmarkDto)
  landmarks?: CuratedLandmarkDto[];

  @ApiProperty({ type: [CuratedFacadeOverrideDto], required: false })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CuratedFacadeOverrideDto)
  facadeOverrides?: CuratedFacadeOverrideDto[];

  @ApiProperty({ type: [CuratedSignageOverrideDto], required: false })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CuratedSignageOverrideDto)
  signageOverrides?: CuratedSignageOverrideDto[];
}

export class CreateSceneRequestDto {
  @ApiProperty({ example: 'Seoul City Hall' })
  @IsString()
  @Length(1, 200)
  query!: string;

  @ApiProperty({
    required: false,
    enum: ['SMALL', 'MEDIUM', 'LARGE'],
    example: 'MEDIUM',
  })
  @IsOptional()
  @IsIn(['SMALL', 'MEDIUM', 'LARGE'])
  scale?: string;

  @ApiProperty({
    required: false,
    example: false,
    description:
      'true이면 동일 query/scale의 READY scene이 있어도 재사용하지 않습니다.',
  })
  @IsOptional()
  @IsBoolean()
  forceRegenerate?: boolean;

  @ApiProperty({
    required: false,
    example: {
      landmarks: [
        { id: 'lm-1', name: 'Landmark 1' },
        { id: 'lm-2', name: 'Landmark 2' },
      ],
      facadeOverrides: [{ objectId: 'building-1', palette: ['#ff7755'] }],
      signageOverrides: [{ objectId: 'sign-1', panelCount: 3 }],
    },
    description:
      'Optional curated asset payload used by scene fidelity planner.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CuratedAssetPayloadDto)
  curatedAssetPayload?: CuratedAssetPayloadDto;
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

  @ApiProperty({ enum: ['SYNTHETIC_RULES', 'SYNTHETIC_RULES_ENTITY_READY'] })
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

  @ApiProperty({
    required: false,
    example: '/api/scenes/scene-seoul-city-hall/twin',
  })
  twinUrl?: string;

  @ApiProperty({
    required: false,
    example: '/api/scenes/scene-seoul-city-hall/validation',
  })
  validationUrl?: string;

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

export class SceneTwinGraphDto {
  @ApiProperty({ example: 'twin-1234567890ab' })
  twinId!: string;

  @ApiProperty({ example: 'scene-seoul-city-hall' })
  sceneId!: string;

  @ApiProperty({ example: 'build-1234567890ab' })
  buildId!: string;

  @ApiProperty({ example: '2026-04-13T12:00:00.000Z' })
  generatedAt!: string;

  @ApiProperty({ type: Object })
  sourceSnapshots!: object;

  @ApiProperty({ type: Object })
  spatialFrame!: object;

  @ApiProperty({ type: [Object] })
  entities!: object[];

  @ApiProperty({ type: [Object] })
  relationships!: object[];

  @ApiProperty({ type: [Object] })
  components!: object[];

  @ApiProperty({ type: [Object] })
  evidence!: object[];

  @ApiProperty({ type: Object })
  delivery!: object;

  @ApiProperty({ type: [Object] })
  stateChannels!: object[];

  @ApiProperty({ type: Object })
  stats!: object;
}

export class ValidationReportDto {
  @ApiProperty({ example: 'validation-1234567890ab' })
  reportId!: string;

  @ApiProperty({ example: 'scene-seoul-city-hall' })
  sceneId!: string;

  @ApiProperty({ example: '2026-04-13T12:00:00.000Z' })
  generatedAt!: string;

  @ApiProperty({ enum: ['PASS', 'WARN', 'FAIL'] })
  summary!: string;

  @ApiProperty({ type: [Object] })
  gates!: object[];

  @ApiProperty({ type: Object, required: false })
  qualityGate?: object;
}

export class SceneEvidenceDto {
  @ApiProperty({ example: 'evidence-1234567890ab' })
  evidenceId!: string;

  @ApiProperty({ example: 'entity-1234567890ab' })
  entityId!: string;

  @ApiProperty({ enum: ['GEOMETRY', 'APPEARANCE', 'STATE', 'SEMANTIC'] })
  kind!: string;

  @ApiProperty({ example: 'snapshot-1234567890ab' })
  sourceSnapshotId!: string;

  @ApiProperty({ example: '2026-04-13T12:00:00.000Z' })
  observedAt!: string;

  @ApiProperty({ example: 0.9 })
  confidence!: number;

  @ApiProperty({ enum: ['observed', 'inferred', 'defaulted'] })
  provenance!: string;

  @ApiProperty({
    example:
      'Building footprint and height derived from normalized Overpass package.',
  })
  summary!: string;

  @ApiProperty({ type: Object })
  payload!: object;
}

export class MidQaReportDto {
  @ApiProperty({ example: 'midqa-build-1234567890ab' })
  reportId!: string;

  @ApiProperty({ example: 'scene-seoul-city-hall' })
  sceneId!: string;

  @ApiProperty({ example: '2026-04-13T12:00:00.000Z' })
  generatedAt!: string;

  @ApiProperty({ enum: ['PASS', 'WARN', 'FAIL'] })
  summary!: string;

  @ApiProperty({ type: Object })
  score!: object;

  @ApiProperty({ type: [Object] })
  checks!: object[];

  @ApiProperty({ type: [Object] })
  findings!: object[];

  @ApiProperty({ type: Object })
  references!: object;
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
