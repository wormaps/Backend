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
