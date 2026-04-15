import { SceneHeroOverrideService } from './scene-hero-override.service';
import { ExternalPlaceDetail } from '../../../places/types/external-place.types';
import { SceneDetail, SceneMeta } from '../../types/scene.types';
import { SHIBUYA_SCRAMBLE_CROSSING_OVERRIDE } from '../../overrides/shibuya-scramble-crossing.override';

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
    structuralCoverage: {
      selectedBuildingCoverage: 0,
      coreAreaBuildingCoverage: 0,
      fallbackMassingRate: 0,
      footprintPreservationRate: 0,
      heroLandmarkCoverage: 0,
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
    annotationsApplied: [],
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

    expect(result.detail.annotationsApplied.length).toBeGreaterThan(0);
    expect(result.detail.crossings.length).toBeGreaterThan(0);
    expect(result.detail.signageClusters.length).toBeGreaterThan(0);
    expect(result.detail.roadDecals?.length).toBeGreaterThan(0);
    expect(result.meta.detailStatus).toBe('PARTIAL');
    expect(result.meta.landmarkAnchors.length).toBeGreaterThan(0);
    expect(result.meta.buildings[0]?.visualRole).toBe('hero_landmark');
    expect(
      result.meta.buildings[0]?.podiumSpec?.canopyEdges.length,
    ).toBeGreaterThan(0);
    expect(
      result.meta.buildings[0]?.signageSpec?.billboardFaces.length,
    ).toBeGreaterThan(0);
    expect(result.meta.buildings[0]?.roofSpec?.roofUnits).toBeGreaterThan(0);
    expect(
      result.meta.buildings[0]?.roofSpec?.roofUnits,
    ).toBeGreaterThanOrEqual(4);
    expect(
      result.meta.buildings[0]?.signageSpec?.signBandLevels,
    ).toBeGreaterThanOrEqual(3);
    expect(result.meta.buildings[0]?.podiumSpec?.levels).toBeGreaterThanOrEqual(
      3,
    );
    expect(result.detail.facadeHints[0]?.facadeSpec).toBeDefined();
    expect(result.detail.facadeHints[0]?.facadeEdgeIndex).not.toBe(0);
    expect(result.detail.facadeHints[0]?.evidenceStrength).toBe('strong');
    expect(
      result.detail.placeReadabilityDiagnostics?.heroBuildingCount,
    ).toBeGreaterThan(0);
    expect(
      result.detail.placeReadabilityDiagnostics?.scrambleStripeCount,
    ).toBeGreaterThan(0);
    expect(
      result.detail.placeReadabilityDiagnostics?.heroIntersectionCount,
    ).toBeGreaterThan(0);
  });

  it('applies exact objectId override without spilling to nearby buildings', () => {
    const service = new SceneHeroOverrideService();
    const crowdedMeta: SceneMeta = {
      ...meta,
      buildings: [
        ...meta.buildings,
        {
          ...meta.buildings[0],
          objectId: 'building-nearby',
          outerRing: [
            { lat: 35.65973, lng: 139.7008 },
            { lat: 35.65985, lng: 139.7009 },
            { lat: 35.65966, lng: 139.70101 },
          ],
        },
      ],
    };

    const result = service.applyOverrides(place, crowdedMeta, detail);
    const exact = result.meta.buildings.find(
      (building) => building.objectId === 'building-116806281',
    );
    const nearby = result.meta.buildings.find(
      (building) => building.objectId === 'building-nearby',
    );

    expect(exact?.visualRole).toBe('hero_landmark');
    expect(nearby?.visualRole).not.toBe('hero_landmark');
  });

  it('defines expanded shibuya hero manifest coverage', () => {
    expect(
      SHIBUYA_SCRAMBLE_CROSSING_OVERRIDE.landmarks.length,
    ).toBeGreaterThanOrEqual(4);
    expect(
      SHIBUYA_SCRAMBLE_CROSSING_OVERRIDE.crossings.length,
    ).toBeGreaterThanOrEqual(5);
    expect(
      SHIBUYA_SCRAMBLE_CROSSING_OVERRIDE.streetFurnitureRows.length,
    ).toBeGreaterThanOrEqual(6);
  });

  it('auto-promotes additional hero context buildings to lift hero coverage', () => {
    const service = new SceneHeroOverrideService();
    const expandedMeta: SceneMeta = {
      ...meta,
      assetProfile: {
        ...meta.assetProfile,
        selected: {
          ...meta.assetProfile.selected,
          buildingCount: 400,
        },
      },
      buildings: Array.from({ length: 28 }, (_, index) => ({
        ...meta.buildings[0],
        objectId: index === 0 ? 'building-116806281' : `context-${index}`,
        osmWayId: `way_context_${index}`,
        usage: index % 3 === 0 ? 'COMMERCIAL' : 'MIXED',
        heightMeters: index % 5 === 0 ? 42 : 26,
        outerRing: [
          { lat: 35.6592 + index * 0.00003, lng: 139.7001 },
          { lat: 35.65926 + index * 0.00003, lng: 139.70018 },
          { lat: 35.65917 + index * 0.00003, lng: 139.70026 },
        ],
      })),
    };
    const expandedDetail: SceneDetail = {
      ...detail,
      facadeHints: expandedMeta.buildings.map((building, index) => ({
        objectId: building.objectId,
        anchor: building.outerRing[0],
        facadeEdgeIndex: 0,
        windowBands: 8,
        billboardEligible: index % 2 === 0,
        palette: ['#778899', '#d4dde8'],
        materialClass: 'glass',
        signageDensity: index % 4 === 0 ? 'high' : 'medium',
        emissiveStrength: index % 4 === 0 ? 0.85 : 0.58,
        glazingRatio: 0.45,
        weakEvidence: index % 6 === 0,
        evidenceStrength: index % 6 === 0 ? 'weak' : 'medium',
      })),
    };

    const result = service.applyOverrides(place, expandedMeta, expandedDetail);

    const promotedHeroes = result.meta.buildings.filter(
      (building) => building.visualRole && building.visualRole !== 'generic',
    );
    expect(promotedHeroes.length).toBeGreaterThanOrEqual(5);
    expect(
      result.detail.annotationsApplied.some((entry) =>
        entry.includes(':auto-hero-promotion:'),
      ),
    ).toBe(true);
    expect(
      result.detail.facadeHints.filter(
        (hint) =>
          hint.visualRole === 'edge_landmark' ||
          hint.visualRole === 'hero_landmark',
      ).length,
    ).toBeGreaterThan(1);
    expect(
      result.meta.buildings
        .filter((building) => building.visualRole === 'edge_landmark')
        .every((building) => (building.signBandLevels ?? 0) >= 2),
    ).toBe(true);
  });

  it('does not auto-promote weak-evidence-only candidates', () => {
    const service = new SceneHeroOverrideService();
    const expandedMeta: SceneMeta = {
      ...meta,
      assetProfile: {
        ...meta.assetProfile,
        selected: {
          ...meta.assetProfile.selected,
          buildingCount: 300,
        },
      },
      buildings: Array.from({ length: 16 }, (_, index) => ({
        ...meta.buildings[0],
        objectId: index === 0 ? 'building-116806281' : `weak-${index}`,
        osmWayId: `weak_way_${index}`,
      })),
    };
    const expandedDetail: SceneDetail = {
      ...detail,
      facadeHints: expandedMeta.buildings.map((building) => ({
        objectId: building.objectId,
        anchor: building.outerRing[0],
        facadeEdgeIndex: 0,
        windowBands: 8,
        billboardEligible: true,
        palette: ['#778899', '#d4dde8'],
        materialClass: 'glass',
        signageDensity: 'high',
        emissiveStrength: 0.9,
        glazingRatio: 0.45,
        weakEvidence: true,
        evidenceStrength: 'weak',
      })),
    };

    const result = service.applyOverrides(place, expandedMeta, expandedDetail);

    expect(
      result.detail.annotationsApplied.some((entry) =>
        entry.includes(':auto-hero-promotion:'),
      ),
    ).toBe(false);
  });
});
