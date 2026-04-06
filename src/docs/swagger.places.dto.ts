import { ApiProperty } from '@nestjs/swagger';
import { BoundsDto, CameraDto, CoordinateDto } from './swagger.common.dto';

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
