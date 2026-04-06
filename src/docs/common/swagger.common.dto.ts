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
