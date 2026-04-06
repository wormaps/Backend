import { ApiProperty } from '@nestjs/swagger';
import { PlacePackageDto } from './swagger.places.dto';
import { ExternalPlaceDetailDto } from './swagger.places.dto';
import { ExternalSceneSnapshotResponseDto } from './swagger.scene-api.dto';
import { WeatherObservationDto } from './swagger.scene-core.dto';

export class ExternalPlacePackageResponseDto {
  @ApiProperty({ type: ExternalPlaceDetailDto })
  place!: ExternalPlaceDetailDto;

  @ApiProperty({ type: PlacePackageDto })
  package!: PlacePackageDto;
}

export { ExternalSceneSnapshotResponseDto, WeatherObservationDto };
