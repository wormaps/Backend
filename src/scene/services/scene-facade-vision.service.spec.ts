import { SceneFacadeVisionService } from './scene-facade-vision.service';
import type { ExternalPlaceDetail } from '../../places/types/external-place.types';
import type { PlacePackage } from '../../places/types/place.types';

describe('SceneFacadeVisionService', () => {
  const service = new SceneFacadeVisionService();

  const place: ExternalPlaceDetail = {
    provider: 'GOOGLE_PLACES',
    placeId: 'place-1',
    displayName: 'Test Center',
    formattedAddress: 'Test City',
    location: { lat: 35.6595, lng: 139.7005 },
    primaryType: 'point_of_interest',
    types: ['point_of_interest'],
    googleMapsUri: null,
    viewport: null,
    utcOffsetMinutes: 540,
  };

  const placePackage: PlacePackage = {
    placeId: 'place-1',
    version: '1',
    generatedAt: '2026-04-06T00:00:00.000Z',
    camera: {
      topView: { x: 0, y: 160, z: 120 },
      walkViewStart: { x: 0, y: 1.7, z: 8 },
    },
    bounds: {
      northEast: { lat: 35.66, lng: 139.701 },
      southWest: { lat: 35.659, lng: 139.7 },
    },
    buildings: [
      {
        id: 'building-core-commercial',
        name: 'Commercial Core',
        heightMeters: 42,
        outerRing: [
          { lat: 35.65955, lng: 139.70052 },
          { lat: 35.65955, lng: 139.70067 },
          { lat: 35.65942, lng: 139.70067 },
          { lat: 35.65942, lng: 139.70052 },
        ],
        holes: [],
        footprint: [],
        usage: 'COMMERCIAL',
      },
      {
        id: 'building-public-edge',
        name: 'Public Edge',
        heightMeters: 18,
        outerRing: [
          { lat: 35.6587, lng: 139.6999 },
          { lat: 35.6587, lng: 139.70005 },
          { lat: 35.65858, lng: 139.70005 },
          { lat: 35.65858, lng: 139.6999 },
        ],
        holes: [],
        footprint: [],
        usage: 'PUBLIC',
      },
    ],
    roads: [],
    walkways: [],
    pois: [],
    landmarks: [],
    crossings: [],
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

  it('infers non-gray fallback palettes for buildings without explicit colors', () => {
    const hints = service.buildFacadeHints(place, placePackage, [], []);
    const coreHint = hints[0];
    const edgeHint = hints[1];

    expect(hints).toHaveLength(2);
    expect(coreHint).toBeDefined();
    expect(edgeHint).toBeDefined();
    expect(coreHint!.shellPalette).not.toContain('#9ea4aa');
    expect(edgeHint!.shellPalette).not.toContain('#9ea4aa');
    expect(coreHint!.panelPalette).toBeDefined();
    expect(edgeHint!.panelPalette).toBeDefined();
    expect(coreHint!.panelPalette!.length).toBeGreaterThan(0);
    expect(edgeHint!.panelPalette!.length).toBeGreaterThan(0);
  });

  it('preserves explicit OSM colors when they exist', () => {
    const hints = service.buildFacadeHints(
      place,
      {
        ...placePackage,
        buildings: [
          {
            ...placePackage.buildings[0],
            facadeColor: '#445566',
            roofColor: '#ddeeff',
          },
        ],
      },
      [],
      [],
    );
    const firstHint = hints[0];

    expect(firstHint).toBeDefined();
    expect(firstHint!.palette).toContain('#445566');
    expect(firstHint!.shellPalette).toContain('#445566');
  });
});
