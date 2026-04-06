import { ApiProperty } from '@nestjs/swagger';
import { CameraDto, CoordinateDto } from './swagger.common.dto';

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

  @ApiProperty({ example: [[{ lat: 35.6597, lng: 139.7008 }]] })
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

export class SceneStructuralCoverageDto {
  @ApiProperty({ example: 0.62 })
  selectedBuildingCoverage!: number;

  @ApiProperty({ example: 0.91 })
  coreAreaBuildingCoverage!: number;

  @ApiProperty({ example: 0.08 })
  fallbackMassingRate!: number;

  @ApiProperty({ example: 0.92 })
  footprintPreservationRate!: number;

  @ApiProperty({ example: 1 })
  heroLandmarkCoverage!: number;
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
    example: [{ className: 'glass', palette: ['#8eb7d9'], buildingCount: 23 }],
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

  @ApiProperty({ type: SceneStructuralCoverageDto })
  structuralCoverage!: SceneStructuralCoverageDto;

  @ApiProperty({ type: [SceneRoadMetaDto] })
  roads!: SceneRoadMetaDto[];

  @ApiProperty({ type: [SceneBuildingMetaDto] })
  buildings!: SceneBuildingMetaDto[];

  @ApiProperty({ type: [SceneWalkwayMetaDto] })
  walkways!: SceneWalkwayMetaDto[];

  @ApiProperty({ type: [ScenePoiMetaDto] })
  pois!: ScenePoiMetaDto[];
}
