import { ApiProperty } from '@nestjs/swagger';
import { CoordinateDto } from '../common/swagger.common.dto';

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
  @ApiProperty({
    enum: ['OPEN_METEO', 'UNKNOWN'],
  })
  provider!: string;

  @ApiProperty({ nullable: true, example: '2026-04-04' })
  date?: string | null;

  @ApiProperty({ nullable: true, example: '2026-04-04T22:00' })
  localTime?: string | null;
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

  @ApiProperty({
    enum: ['TRAFFIC_LIGHT', 'STREET_LIGHT', 'SIGN_POLE', 'BOLLARD'],
  })
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

  @ApiProperty({ enum: ['OPEN_METEO'] })
  source!: string;
}
