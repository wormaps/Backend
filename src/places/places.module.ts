import { Module } from '@nestjs/common';
import { GooglePlacesClient } from './google-places.client';
import { OpenMeteoClient } from './open-meteo.client';
import { OverpassClient } from './overpass.client';
import { PlacesController } from './places.controller';
import { PlacesService } from './places.service';
import { SnapshotBuilderService } from './snapshot-builder.service';
import { TomTomTrafficClient } from './tomtom-traffic.client';

@Module({
  controllers: [PlacesController],
  providers: [
    PlacesService,
    SnapshotBuilderService,
    GooglePlacesClient,
    OverpassClient,
    OpenMeteoClient,
    TomTomTrafficClient,
  ],
})
export class PlacesModule {}
