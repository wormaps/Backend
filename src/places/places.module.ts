import { Module } from '@nestjs/common';
import { GooglePlacesClient } from './clients/google-places.client';
import { MapillaryClient } from './clients/mapillary.client';
import { OpenMeteoClient } from './clients/open-meteo.client';
import { OverpassClient } from './clients/overpass.client';
import { TomTomTrafficClient } from './clients/tomtom-traffic.client';
import { PlacesController } from './places.controller';
import { PlacesService } from './places.service';
import { ExternalPlacesService } from './services/external-places.service';
import { PlaceCatalogService } from './services/place-catalog.service';
import { PlaceSnapshotService } from './services/place-snapshot.service';
import { SnapshotBuilderService } from './snapshot/snapshot-builder.service';

@Module({
  controllers: [PlacesController],
  providers: [
    PlaceCatalogService,
    ExternalPlacesService,
    PlaceSnapshotService,
    PlacesService,
    SnapshotBuilderService,
    GooglePlacesClient,
    OverpassClient,
    MapillaryClient,
    OpenMeteoClient,
    TomTomTrafficClient,
  ],
  exports: [
    PlacesService,
    GooglePlacesClient,
    OverpassClient,
    MapillaryClient,
    OpenMeteoClient,
    TomTomTrafficClient,
  ],
})
export class PlacesModule {}
