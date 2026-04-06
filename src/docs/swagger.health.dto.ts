import { ApiProperty } from '@nestjs/swagger';

export class HealthDataDto {
  @ApiProperty({ example: 'wormapb' })
  service!: string;

  @ApiProperty({ example: 120 })
  uptimeSeconds!: number;
}
