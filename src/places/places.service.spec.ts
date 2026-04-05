import { Test, TestingModule } from '@nestjs/testing';
import { AppException } from '../common/errors/app.exception';
import { GooglePlacesClient } from './clients/google-places.client';
import { OpenMeteoClient } from './clients/open-meteo.client';
import { OverpassClient } from './clients/overpass.client';
import { PlacesService } from './places.service';
import { ExternalPlacesService } from './services/external-places.service';
import { PlaceCatalogService } from './services/place-catalog.service';
import { PlaceSnapshotService } from './services/place-snapshot.service';
import { SnapshotBuilderService } from './snapshot/snapshot-builder.service';

describe('PlacesService', () => {
  let service: PlacesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlacesService,
        PlaceCatalogService,
        ExternalPlacesService,
        PlaceSnapshotService,
        SnapshotBuilderService,
        {
          provide: GooglePlacesClient,
          useValue: {
            searchText: jest.fn(),
            getPlaceDetail: jest.fn(),
          },
        },
        {
          provide: OverpassClient,
          useValue: {
            buildPlacePackage: jest.fn(),
          },
        },
        {
          provide: OpenMeteoClient,
          useValue: {
            getHistoricalObservation: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PlacesService>(PlacesService);
  });

  it('should return registered places', () => {
    const places = service.getPlaces();

    expect(places).toHaveLength(4);
    expect(places[0]?.id).toBe('shibuya-crossing');
  });

  it('should return place package by id', () => {
    const placePackage = service.getPlacePackage('times-square');

    expect(placePackage.placeId).toBe('times-square');
    expect(placePackage.buildings).toHaveLength(1);
  });

  it('should throw an app exception for unknown place', () => {
    expect(() => service.getPlaceDetail('unknown-place')).toThrow(AppException);
  });
});
