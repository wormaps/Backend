import { ApiProperty } from '@nestjs/swagger';
import {
  PlacePackageDto,
  ExternalPlaceDetailDto,
} from '../places/swagger.places.dto';
import { ExternalSceneSnapshotResponseDto } from '../scene/swagger.scene-api.dto';
import { WeatherObservationDto } from '../scene/swagger.scene-core.dto';

export class ExternalPlacePackageResponseDto {
  @ApiProperty({ type: ExternalPlaceDetailDto })
  place!: ExternalPlaceDetailDto;

  @ApiProperty({ type: PlacePackageDto })
  package!: PlacePackageDto;
}

export { ExternalSceneSnapshotResponseDto, WeatherObservationDto };
