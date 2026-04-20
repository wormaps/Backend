import { ApiProperty } from '@nestjs/swagger';
import {
  DensityMetricDto,
  LightingStateDto,
  PlaybackDto,
  SourceDetailDto,
  SurfaceStateDto,
} from './swagger.scene-core.dto';

export class SceneSnapshotDto {
  @ApiProperty({ example: 'gangnam-station' })
  placeId!: string;

  @ApiProperty({ enum: ['DAY', 'EVENING', 'NIGHT'] })
  timeOfDay!: string;

  @ApiProperty({ enum: ['CLEAR', 'CLOUDY', 'RAIN', 'SNOW'] })
  weather!: string;

  @ApiProperty({ example: '2026-04-04T08:40:21Z' })
  generatedAt!: string;

  @ApiProperty({ enum: ['SYNTHETIC_RULES'] })
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

export class SceneStateResponseDto {
  @ApiProperty({ example: 'google-place-id' })
  placeId!: string;

  @ApiProperty({ example: '2026-04-04T13:00:00Z' })
  updatedAt!: string;

  @ApiProperty({ enum: ['DAY', 'EVENING', 'NIGHT'] })
  timeOfDay!: string;

  @ApiProperty({ enum: ['CLEAR', 'CLOUDY', 'RAIN', 'SNOW'] })
  weather!: string;

  @ApiProperty({ enum: ['SYNTHETIC_RULES'] })
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

export class SceneEntityStateItemDto {
  @ApiProperty({ example: 'entity-1234567890ab' })
  entityId!: string;

  @ApiProperty({ example: 'road-22' })
  objectId!: string;

  @ApiProperty({
    enum: [
      'SCENE',
      'PLACE',
      'BUILDING',
      'ROAD',
      'WALKWAY',
      'POI',
      'CROSSING',
      'STREET_FURNITURE',
      'VEGETATION',
      'LAND_COVER',
      'LINEAR_FEATURE',
      'LANDMARK',
    ],
  })
  kind!: string;

  @ApiProperty({ enum: ['SYNTHETIC_RULES'] })
  stateMode!: string;

  @ApiProperty({ example: 0.4 })
  confidence!: number;

  @ApiProperty({ type: [String], example: ['snapshot-1234567890ab'] })
  sourceSnapshotIds!: string[];
}

export class SceneEntityStateResponseDto {
  @ApiProperty({ example: 'scene-seoul-city-hall' })
  sceneId!: string;

  @ApiProperty({ example: '2026-04-04T13:00:00Z' })
  updatedAt!: string;

  @ApiProperty({ enum: ['DAY', 'EVENING', 'NIGHT'] })
  timeOfDay!: string;

  @ApiProperty({ enum: ['CLEAR', 'CLOUDY', 'RAIN', 'SNOW'] })
  weather!: string;

  @ApiProperty({ enum: ['SYNTHETIC_RULES'] })
  source!: string;

  @ApiProperty({
    example: {
      kind: 'ROAD',
      objectId: 'road-22',
    },
  })
  filters!: Record<string, unknown>;

  @ApiProperty({ example: 12 })
  total!: number;

  @ApiProperty({ type: [SceneEntityStateItemDto] })
  entities!: SceneEntityStateItemDto[];
}
