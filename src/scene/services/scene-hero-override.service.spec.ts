import { SceneHeroOverrideService } from './scene-hero-override.service';
import { ExternalPlaceDetail } from '../../places/types/external-place.types';
import { SceneDetail, SceneMeta } from '../types/scene.types';
import { SHIBUYA_SCRAMBLE_CROSSING_OVERRIDE } from '../overrides/shibuya-scramble-crossing.override';

describe('SceneHeroOverrideService', () => {
  const place: ExternalPlaceDetail = {
    provider: 'GOOGLE_PLACES',
    placeId: 'ChIJK9EM68qLGGARacmu4KJj5SA',
    displayName: 'Shibuya Crossing',
    formattedAddress: 'Tokyo',
    location: { lat: 35.659482, lng: 139.7005596 },
    primaryType: 'tourist_attraction',
    types: ['tourist_attraction'],
    googleMapsUri: null,
    viewport: null,
    utcOffsetMinutes: 540,
  };

  const meta: SceneMeta = {
    sceneId: 'scene-shibuya',
    placeId: place.placeId,
    name: place.displayName,
    generatedAt: '2026-04-04T00:00:00Z',
    origin: place.location,
    camera: {
      topView: { x: 0, y: 180, z: 140 },
      walkViewStart: { x: 0, y: 1.7, z: 12 },
    },
    bounds: {
      radiusM: 600,
      northEast: { lat: 35.66, lng: 139.701 },
      southWest: { lat: 35.659, lng: 139.7 },
    },
    stats: {
      buildingCount: 1,
      roadCount: 1,
      walkwayCount: 0,
      poiCount: 0,
    },
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
    detailStatus: 'OSM_ONLY',
    visualCoverage: {
      structure: 1,
      streetDetail: 0.2,
      landmark: 0.2,
      signage: 0.1,
    },
    materialClasses: [],
    landmarkAnchors: [],
    assetProfile: {
      preset: 'MEDIUM',
      budget: {
        buildingCount: 0,
        roadCount: 0,
        walkwayCount: 0,
        poiCount: 0,
        crossingCount: 0,
        trafficLightCount: 0,
        streetLightCount: 0,
        signPoleCount: 0,
        treeClusterCount: 0,
        billboardPanelCount: 0,
      },
      selected: {
        buildingCount: 0,
        roadCount: 0,
        walkwayCount: 0,
        poiCount: 0,
        crossingCount: 0,
        trafficLightCount: 0,
        streetLightCount: 0,
        signPoleCount: 0,
        treeClusterCount: 0,
        billboardPanelCount: 0,
      },
    },
    roads: [
      {
        objectId: 'road-1',
        osmWayId: 'way_1',
        name: 'road',
        laneCount: 2,
        roadClass: 'primary',
        widthMeters: 10,
        direction: 'TWO_WAY',
        path: [
          { lat: 35.6593, lng: 139.7002 },
          { lat: 35.6597, lng: 139.7008 },
        ],
        center: { lat: 35.6595, lng: 139.7005 },
        surface: 'asphalt',
        bridge: false,
      },
    ],
    buildings: [
      {
        objectId: 'building-116806281',
        osmWayId: 'way_11',
        name: 'building',
        heightMeters: 40,
        outerRing: [
          { lat: 35.65972, lng: 139.70078 },
          { lat: 35.65984, lng: 139.70088 },
          { lat: 35.65964, lng: 139.70102 },
        ],
        holes: [],
        footprint: [
          { lat: 35.65972, lng: 139.70078 },
          { lat: 35.65984, lng: 139.70088 },
          { lat: 35.65964, lng: 139.70102 },
        ],
        usage: 'COMMERCIAL',
        preset: 'glass_tower',
        roofType: 'flat',
        facadeColor: null,
        facadeMaterial: null,
        roofColor: null,
        roofMaterial: null,
        roofShape: null,
      },
    ],
    walkways: [],
    pois: [],
  };

  const detail: SceneDetail = {
    sceneId: 'scene-shibuya',
    placeId: place.placeId,
    generatedAt: '2026-04-04T00:00:00Z',
    detailStatus: 'OSM_ONLY',
    crossings: [],
    roadMarkings: [],
    streetFurniture: [],
    vegetation: [],
    landCovers: [],
    linearFeatures: [],
    facadeHints: [],
    signageClusters: [],
    roadDecals: [],
    intersectionProfiles: [],
    geometryDiagnostics: [],
    heroOverridesApplied: [],
    provenance: {
      mapillaryUsed: false,
      mapillaryImageCount: 0,
      mapillaryFeatureCount: 0,
      osmTagCoverage: {
        coloredBuildings: 0,
        materialBuildings: 0,
        crossings: 0,
        streetFurniture: 0,
        vegetation: 0,
      },
      overrideCount: 0,
    },
  };

  it('applies shibuya overrides with higher precedence than base detail', () => {
    const service = new SceneHeroOverrideService();
    const result = service.applyOverrides(place, meta, detail);

    expect(result.detail.heroOverridesApplied.length).toBeGreaterThan(0);
    expect(result.detail.crossings.length).toBeGreaterThan(0);
    expect(result.detail.signageClusters.length).toBeGreaterThan(0);
    expect(result.detail.roadDecals?.length).toBeGreaterThan(0);
    expect(result.meta.detailStatus).toBe('PARTIAL');
    expect(result.meta.landmarkAnchors.length).toBeGreaterThan(0);
    expect(result.meta.buildings[0]?.preset).toBeDefined();
    expect(result.meta.buildings[0]?.facadePreset).toBeDefined();
    expect(result.meta.buildings[0]?.geometryStrategy).toBeDefined();
    expect(result.detail.placeReadabilityDiagnostics?.heroBuildingCount).toBeGreaterThan(0);
    expect(result.detail.placeReadabilityDiagnostics?.scrambleStripeCount).toBeGreaterThan(0);
  });

  it('defines expanded shibuya hero manifest coverage', () => {
    expect(SHIBUYA_SCRAMBLE_CROSSING_OVERRIDE.facadeOverrides.length).toBeGreaterThanOrEqual(12);
    expect(SHIBUYA_SCRAMBLE_CROSSING_OVERRIDE.intersectionOverrides.length).toBeGreaterThanOrEqual(2);
    expect(SHIBUYA_SCRAMBLE_CROSSING_OVERRIDE.streetFurnitureRows.length).toBeGreaterThanOrEqual(6);
  });
});
