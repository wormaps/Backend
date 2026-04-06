import { SceneFidelityPlannerService } from './scene-fidelity-planner.service';
import type { ExternalPlaceDetail } from '../../../places/types/external-place.types';
import type { PlacePackage } from '../../../places/types/place.types';
import type { SceneDetail } from '../../types/scene.types';

describe('SceneFidelityPlannerService', () => {
  const service = new SceneFidelityPlannerService();

  const place: ExternalPlaceDetail = {
    provider: 'GOOGLE_PLACES',
    placeId: 'place-1',
    displayName: 'Shibuya Crossing',
    formattedAddress: 'Tokyo',
    location: { lat: 35.6595, lng: 139.7005 },
    primaryType: 'tourist_attraction',
    types: ['tourist_attraction'],
    googleMapsUri: null,
    viewport: null,
    utcOffsetMinutes: 540,
  };

  const placePackage: PlacePackage = {
    placeId: 'place-1',
    version: '1',
    generatedAt: '2026-04-06T00:00:00.000Z',
    camera: {
      topView: { x: 0, y: 200, z: 140 },
      walkViewStart: { x: 0, y: 1.7, z: 10 },
    },
    bounds: {
      northEast: { lat: 35.66, lng: 139.701 },
      southWest: { lat: 35.659, lng: 139.7 },
    },
    buildings: [
      {
        id: 'building-1',
        name: 'A',
        outerRing: [
          { lat: 35.6595, lng: 139.7005 },
          { lat: 35.6596, lng: 139.7006 },
          { lat: 35.6594, lng: 139.7007 },
        ],
        holes: [],
        footprint: [
          { lat: 35.6595, lng: 139.7005 },
          { lat: 35.6596, lng: 139.7006 },
          { lat: 35.6594, lng: 139.7007 },
        ],
        heightMeters: 50,
        usage: 'COMMERCIAL',
        facadeColor: '#cccccc',
        facadeMaterial: 'glass',
        roofColor: null,
        roofMaterial: null,
        roofShape: null,
        buildingPart: null,
      },
    ],
    roads: [],
    walkways: [],
    pois: [],
    landmarks: [
      {
        id: 'landmark-1',
        name: 'LM',
        type: 'LANDMARK',
        location: { lat: 35.6595, lng: 139.7005 },
      },
    ],
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

  const baseDetail: SceneDetail = {
    sceneId: 'scene-1',
    placeId: 'place-1',
    generatedAt: '2026-04-06T00:00:00.000Z',
    detailStatus: 'FULL',
    crossings: [],
    roadMarkings: [],
    streetFurniture: [],
    vegetation: [],
    landCovers: [],
    linearFeatures: [],
    facadeHints: [],
    signageClusters: [],
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

  it('returns baseline mode when evidence is weak', () => {
    const plan = service.buildPlan(place, 'MEDIUM', placePackage, baseDetail);

    expect(plan.currentMode).toBe('PROCEDURAL_ONLY');
    expect(plan.targetMode).toBe('PROCEDURAL_ONLY');
    expect(plan.phase).toBe('PHASE_1_BASELINE');
    expect(plan.targetCoverageRatio).toBe(0.7);
    expect(plan.achievedCoverageRatio).toBeGreaterThanOrEqual(0);
    expect(plan.coverageGapRatio).toBeGreaterThanOrEqual(0);
    expect(plan.priorities).toContain('전 장소 70% 커버리지 갭 축소');
  });

  it('promotes to landmark enriched when annotations are present', () => {
    const plan = service.buildPlan(place, 'MEDIUM', placePackage, {
      ...baseDetail,
      annotationsApplied: ['ann-1', 'ann-2'],
    });

    expect(plan.currentMode).toBe('LANDMARK_ENRICHED');
    expect(plan.targetMode).toBe('LANDMARK_ENRICHED');
  });

  it('marks scene as reality overlay ready when landmark and mapillary evidence are strong', () => {
    const plan = service.buildPlan(place, 'MEDIUM', placePackage, {
      ...baseDetail,
      annotationsApplied: ['ann-1', 'ann-2'],
      signageClusters: [
        {
          objectId: 'sig-1',
          anchor: { lat: 35.6595, lng: 139.7005 },
          panelCount: 5,
          palette: ['#ff0000'],
          emissiveStrength: 1,
          widthMeters: 4,
          heightMeters: 2,
        },
      ],
      provenance: {
        ...baseDetail.provenance,
        mapillaryUsed: true,
        mapillaryImageCount: 120,
        mapillaryFeatureCount: 85,
        osmTagCoverage: {
          ...baseDetail.provenance.osmTagCoverage,
          coloredBuildings: 1,
          materialBuildings: 1,
        },
      },
    });

    expect(plan.targetMode).toBe('REALITY_OVERLAY_READY');
    expect(plan.phase).toBe('PHASE_2_HYBRID_FOUNDATION');
    expect(plan.evidence.facade).toBe('HIGH');
    expect(plan.achievedCoverageRatio).toBeGreaterThanOrEqual(0.7);
    expect(plan.coverageGapRatio).toBe(0);
    expect(
      plan.sourceRegistry.find((source) => source.sourceType === 'MAPILLARY')
        ?.enabled,
    ).toBe(true);
  });
});
