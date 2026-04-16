import { SceneFacadeVisionService } from './scene-facade-vision.service';
import type { ExternalPlaceDetail } from '../../../places/types/external-place.types';
import type { PlacePackage } from '../../../places/types/place.types';
import { BuildingStyleResolverService } from './building-style-resolver.service';

describe('SceneFacadeVisionService', () => {
  const service = new SceneFacadeVisionService(
    new BuildingStyleResolverService(),
  );

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
    roads: [
      {
        id: 'road-primary-1',
        name: 'Main Street',
        laneCount: 4,
        roadClass: 'primary',
        widthMeters: 18,
        path: [
          { lat: 35.6596, lng: 139.70045 },
          { lat: 35.6593, lng: 139.7007 },
        ],
        direction: 'TWO_WAY',
      },
    ],
    walkways: [],
    pois: [],
    landmarks: [],
    crossings: [
      {
        id: 'crossing-1',
        name: 'Core Crossing',
        type: 'CROSSING',
        crossing: 'traffic_signals',
        crossingRef: null,
        signalized: true,
        path: [
          { lat: 35.6595, lng: 139.7005 },
          { lat: 35.65948, lng: 139.7006 },
        ],
        center: { lat: 35.65949, lng: 139.70056 },
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

  it('infers non-gray fallback palettes for buildings without explicit colors', async () => {
    const hints = await service.buildFacadeHints(place, placePackage, [], []);
    const coreHint = hints[0];
    const edgeHint = hints[1];

    expect(hints).toHaveLength(2);
    expect(coreHint).toBeDefined();
    expect(edgeHint).toBeDefined();
    expect(coreHint.shellPalette).not.toContain('#9ea4aa');
    expect(edgeHint.shellPalette).not.toContain('#9ea4aa');
    expect(coreHint.panelPalette).toBeDefined();
    expect(edgeHint.panelPalette).toBeDefined();
    expect(coreHint.panelPalette!.length).toBeGreaterThan(0);
    expect(edgeHint.panelPalette!.length).toBeGreaterThan(0);
    expect(['glass', 'metal']).toContain(coreHint.materialClass);
    expect(['NEON_CORE', 'COMMERCIAL_STRIP', 'TRANSIT_HUB']).toContain(
      coreHint.contextProfile!,
    );
    expect(coreHint.districtCluster).toBeDefined();
    expect(coreHint.evidenceStrength).toBeDefined();
  });

  it('preserves explicit OSM colors when they exist', async () => {
    const hints = await service.buildFacadeHints(
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
    expect(firstHint.palette).toContain('#445566');
    expect(firstHint.shellPalette).toContain('#445566');
  });

  it('applies weak-evidence palette drift for non-explicit colors', async () => {
    const hints = await service.buildFacadeHints(place, placePackage, [], []);

    expect(hints).toHaveLength(2);
    for (const hint of hints) {
      expect(hint.weakEvidence).toBe(true);
      expect(hint.palette.length).toBeGreaterThanOrEqual(3);
      expect(hint.panelPalette?.length ?? 0).toBeGreaterThanOrEqual(5);
      expect(hint.shellPalette?.length ?? 0).toBeGreaterThanOrEqual(4);
      expect(typeof hint.contextualMaterialUpgrade).toBe('boolean');
      expect(hint.palette).not.toContain('#9ea4aa');
      expect(hint.inferenceReasonCodes).toContain('MISSING_MAPILLARY_IMAGES');
      expect(hint.inferenceReasonCodes).toContain('MISSING_MAPILLARY_FEATURES');
      expect(hint.inferenceReasonCodes).toContain('MISSING_FACADE_COLOR');
      expect(hint.inferenceReasonCodes).toContain('MISSING_FACADE_MATERIAL');
      expect(hint.inferenceReasonCodes).toContain('MISSING_ROOF_SHAPE');
      expect(hint.inferenceReasonCodes).toContain('WEAK_EVIDENCE_RATIO_HIGH');
      expect(hint.inferenceReasonCodes).toContain('DEFAULT_STYLE_RULE');
    }
  });

  it('does not mark weakEvidence when explicit color exists without mapillary data', async () => {
    const hints = await service.buildFacadeHints(
      place,
      {
        ...placePackage,
        buildings: [
          {
            ...placePackage.buildings[0],
            facadeColor: '#556677',
            facadeMaterial: 'concrete',
          },
        ],
      },
      [],
      [],
    );

    expect(hints).toHaveLength(1);
    expect(hints[0].weakEvidence).toBe(false);
    expect(hints[0].inferenceReasonCodes).not.toContain('DEFAULT_STYLE_RULE');
  });

  it('does not mark weakEvidence when auxiliary OSM attributes exist', async () => {
    const hints = await service.buildFacadeHints(
      place,
      {
        ...placePackage,
        buildings: [
          {
            ...placePackage.buildings[0],
            osmAttributes: { building: 'yes', name: 'Aux OSM Building' },
          },
        ],
      },
      [],
      [],
    );

    expect(hints).toHaveLength(1);
    expect(hints[0].weakEvidence).toBe(false);
    expect(hints[0].inferenceReasonCodes).not.toContain('DEFAULT_STYLE_RULE');
    expect(hints[0].inferenceReasonCodes).not.toContain(
      'MISSING_AUXILIARY_DATA',
    );
  });

  it('prepends dominant image-derived color when nearby mapillary image exists', async () => {
    const hints = await service.buildFacadeHints(
      place,
      placePackage,
      [
        {
          id: 'img-1',
          capturedAt: null,
          compassAngle: null,
          location: { lat: 35.65953, lng: 139.70053 },
          sequenceId: null,
          thumbnailUrl: null,
        },
      ],
      [],
    );

    expect(hints).toHaveLength(2);
    expect(hints[0].palette[0]).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('uses nearby image metadata to stabilize dominant color extraction', async () => {
    const hintsA = await service.buildFacadeHints(
      place,
      placePackage,
      [
        {
          id: 'img-a',
          capturedAt: '2026-04-06T00:00:00.000Z',
          compassAngle: 15,
          location: { lat: 35.65953, lng: 139.70053 },
          sequenceId: 'seq-a',
          thumbnailUrl: 'https://example.com/a.jpg',
        },
      ],
      [],
    );
    const hintsB = await service.buildFacadeHints(
      place,
      placePackage,
      [
        {
          id: 'img-a',
          capturedAt: '2026-04-06T00:00:00.000Z',
          compassAngle: 15,
          location: { lat: 35.65953, lng: 139.70053 },
          sequenceId: 'seq-a',
          thumbnailUrl: 'https://example.com/a.jpg',
        },
      ],
      [],
    );

    expect(hintsA[0]?.palette[0]).toBe(hintsB[0]?.palette[0]);
  });

  it('summarizes facade context diagnostics for logging', async () => {
    const hints = await service.buildFacadeHints(place, placePackage, [], []);
    const diagnostics = service.summarizeFacadeContextDiagnostics(
      hints,
      placePackage,
    );

    expect(diagnostics.weakEvidenceCount).toBe(2);
    expect(diagnostics.profileCounts.length).toBeGreaterThan(0);
    expect(diagnostics.materialCounts.length).toBeGreaterThan(0);
    expect(diagnostics.profileMaterialCounts.length).toBeGreaterThan(0);
    expect(diagnostics.contextualUpgradeCount).toBeGreaterThanOrEqual(0);
    expect(diagnostics.districtClusterCounts).toBeDefined();
    expect(diagnostics.evidenceStrengthCounts).toBeDefined();
  });

  it('expands signage clusters through vision pipeline when medium/high hints increase', async () => {
    const hints = await service.buildFacadeHints(place, placePackage, [], []);
    const eligible = hints.filter((hint) => hint.signageDensity !== 'low');

    expect(eligible.length).toBeGreaterThan(0);
  });

  it('preserves district confidence and uses it for district aggregation', async () => {
    const hints = await service.buildFacadeHints(place, placePackage, [], []);
    const districts = service.buildDistrictAtmosphereProfiles(hints);

    expect(
      hints.every((hint) => typeof hint.districtConfidence === 'number'),
    ).toBe(true);
    expect(districts.length).toBeGreaterThan(0);
    expect(districts[0].confidence).toBeGreaterThan(0);
  });
});
