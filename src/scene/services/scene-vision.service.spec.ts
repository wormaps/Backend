import { SceneVisionService } from './scene-vision.service';
import { MapillaryClient } from '../../places/clients/mapillary.client';
import { ExternalPlaceDetail } from '../../places/types/external-place.types';
import { PlacePackage } from '../../places/types/place.types';

describe('SceneVisionService', () => {
  const place: ExternalPlaceDetail = {
    provider: 'GOOGLE_PLACES',
    placeId: 'google-place-id',
    displayName: 'Seoul City Hall',
    formattedAddress: 'Seoul',
    location: { lat: 37.5665, lng: 126.978 },
    primaryType: 'city_hall',
    types: ['city_hall'],
    googleMapsUri: null,
    viewport: {
      northEast: { lat: 37.567, lng: 126.979 },
      southWest: { lat: 37.566, lng: 126.977 },
    },
    utcOffsetMinutes: 540,
  };

  const placePackage: PlacePackage = {
    placeId: 'google-place-id',
    version: '2026.04-external',
    generatedAt: '2026-04-04T00:00:00Z',
    camera: {
      topView: { x: 0, y: 180, z: 140 },
      walkViewStart: { x: 0, y: 1.7, z: 12 },
    },
    bounds: {
      northEast: { lat: 37.567, lng: 126.979 },
      southWest: { lat: 37.566, lng: 126.977 },
    },
    buildings: [
      {
        id: 'building-1',
        name: 'Building 1',
        heightMeters: 40,
        usage: 'COMMERCIAL',
        outerRing: [
          { lat: 37.5661, lng: 126.9778 },
          { lat: 37.5662, lng: 126.9781 },
          { lat: 37.566, lng: 126.9782 },
        ],
        holes: [],
        footprint: [
          { lat: 37.5661, lng: 126.9778 },
          { lat: 37.5662, lng: 126.9781 },
          { lat: 37.566, lng: 126.9782 },
        ],
        facadeColor: '#4466aa',
        facadeMaterial: 'glass',
        roofColor: '#dfe8f4',
        roofMaterial: 'metal',
        roofShape: 'flat',
      },
    ],
    roads: [
      {
        id: 'road-1',
        name: 'Road 1',
        laneCount: 4,
        roadClass: 'primary',
        widthMeters: 14,
        direction: 'TWO_WAY',
        path: [
          { lat: 37.5661, lng: 126.9778 },
          { lat: 37.5665, lng: 126.978 },
        ],
        surface: 'asphalt',
        bridge: false,
      },
    ],
    walkways: [],
    pois: [],
    landmarks: [],
    crossings: [
      {
        id: 'crossing-1',
        name: 'Crossing 1',
        type: 'CROSSING',
        crossing: 'zebra',
        crossingRef: 'zebra',
        signalized: true,
        path: [
          { lat: 37.56635, lng: 126.9779 },
          { lat: 37.56635, lng: 126.9781 },
        ],
        center: { lat: 37.56635, lng: 126.978 },
      },
    ],
    streetFurniture: [],
    vegetation: [],
    landCovers: [],
    linearFeatures: [],
    diagnostics: {
      droppedBuildings: 0,
      droppedRoads: 0,
      droppedWalkways: 0,
      droppedPois: 0,
      droppedCrossings: 0,
      droppedStreetFurniture: 0,
      droppedVegetation: 0,
      droppedLandCovers: 0,
      droppedLinearFeatures: 0,
    },
  };

  it('falls back to PARTIAL detail status when mapillary fetch fails', async () => {
    const mapillaryClient = {
      isConfigured: jest.fn().mockReturnValue(true),
      getNearbyImages: jest.fn().mockRejectedValue(new Error('boom')),
      getMapFeatures: jest.fn().mockRejectedValue(new Error('boom')),
    } as unknown as MapillaryClient;

    const service = new SceneVisionService(mapillaryClient);
    const result = await service.buildSceneVision(
      'scene-cityhall',
      place,
      placePackage.bounds,
      placePackage,
    );

    expect(result.detail.detailStatus).toBe('PARTIAL');
    expect(result.detail.crossings[0]?.style).toBe('signalized');
    expect(result.detail.facadeHints[0]?.facadeEdgeIndex).toBe(2);
    expect(result.detail.facadeHints[0]?.windowBands).toBeGreaterThan(0);
    expect(result.metaPatch.materialClasses[0]?.className).toBe('glass');
  });
});
