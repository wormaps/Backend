import { buildSceneAssetSelection } from './scene-asset-profile.utils';
import { SceneDetail, SceneMeta } from '../types/scene.types';

function coordinate(lat: number, lng: number) {
  return { lat, lng };
}

function createRoad(index: number, lat: number, lng: number) {
  return {
    objectId: `road-${index}`,
    osmWayId: `road_${index}`,
    name: `Road ${index}`,
    laneCount: 2,
    roadClass: 'primary',
    widthMeters: 12,
    direction: 'TWO_WAY' as const,
    path: [coordinate(lat, lng), coordinate(lat + 0.00015, lng + 0.00015)],
    center: coordinate(lat + 0.000075, lng + 0.000075),
    surface: null,
    bridge: false,
  };
}

function createWalkway(index: number, lat: number, lng: number) {
  return {
    objectId: `walkway-${index}`,
    osmWayId: `walkway_${index}`,
    name: `Walkway ${index}`,
    widthMeters: 4,
    walkwayType: 'footway',
    path: [coordinate(lat, lng), coordinate(lat + 0.0001, lng + 0.0001)],
    surface: null,
  };
}

function createCrossing(index: number, lat: number, lng: number, principal = false) {
  return {
    objectId: `crossing-${index}`,
    name: `Crossing ${index}`,
    type: 'CROSSING' as const,
    crossing: null,
    crossingRef: null,
    signalized: principal,
    path: [coordinate(lat, lng), coordinate(lat + 0.00008, lng + 0.00008)],
    center: coordinate(lat + 0.00004, lng + 0.00004),
    principal,
    style: 'zebra' as const,
  };
}

describe('buildSceneAssetSelection', () => {
  it('preserves principal crossings and nearby anchor geometry in MEDIUM scenes', () => {
    const roads = Array.from({ length: 430 }, (_, index) =>
      createRoad(index, 37.0002 + index * 0.00001, 127.0002 + index * 0.00001),
    );
    const walkways = Array.from({ length: 530 }, (_, index) =>
      createWalkway(index, 37.0004 + index * 0.00001, 127.0004 + index * 0.00001),
    );
    const crossings = Array.from({ length: 80 }, (_, index) =>
      createCrossing(index, 37.0006 + index * 0.00001, 127.0006 + index * 0.00001),
    );

    const anchor = coordinate(37.0101, 127.0101);
    const anchorRoad = createRoad(9990, 37.01008, 127.01008);
    const competingRoad = createRoad(9991, 37.0112, 127.0112);
    const anchorWalkway = createWalkway(9990, 37.01006, 127.01006);
    const competingWalkway = createWalkway(9991, 37.01118, 127.01118);
    const anchorCrossing = createCrossing(9990, 37.01004, 127.01004);
    const principalCrossingA = createCrossing(9991, 37.014, 127.014, true);
    const principalCrossingB = createCrossing(9992, 37.0144, 127.0144, true);

    const sceneMeta: SceneMeta = {
      sceneId: 'scene-selection-test',
      placeId: 'place-selection-test',
      name: 'Selection Test',
      generatedAt: '2026-04-06T00:00:00Z',
      origin: coordinate(37, 127),
      camera: {
        topView: { x: 0, y: 120, z: 80 },
        walkViewStart: { x: 0, y: 1.7, z: 12 },
      },
      bounds: {
        radiusM: 2200,
        northEast: coordinate(37.02, 127.02),
        southWest: coordinate(36.98, 126.98),
      },
      stats: {
        buildingCount: 0,
        roadCount: roads.length + 2,
        walkwayCount: walkways.length + 2,
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
      detailStatus: 'FULL',
      visualCoverage: {
        structure: 1,
        streetDetail: 1,
        landmark: 1,
        signage: 0.5,
      },
      materialClasses: [],
      landmarkAnchors: [
        {
          objectId: 'anchor-1',
          name: 'Main Crossing',
          location: anchor,
          kind: 'CROSSING',
        },
      ],
      assetProfile: {
        preset: 'MEDIUM',
        budget: {
          buildingCount: 700,
          roadCount: 420,
          walkwayCount: 520,
          poiCount: 220,
          crossingCount: 64,
          trafficLightCount: 60,
          streetLightCount: 90,
          signPoleCount: 120,
          treeClusterCount: 80,
          billboardPanelCount: 160,
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
      roads: [...roads, competingRoad, anchorRoad],
      buildings: [],
      walkways: [...walkways, competingWalkway, anchorWalkway],
      pois: [],
    };

    const sceneDetail: SceneDetail = {
      sceneId: sceneMeta.sceneId,
      placeId: sceneMeta.placeId,
      generatedAt: sceneMeta.generatedAt,
      detailStatus: 'FULL',
      crossings: [...crossings, anchorCrossing, principalCrossingA, principalCrossingB],
      roadMarkings: [],
      streetFurniture: [],
      vegetation: [],
      landCovers: [],
      linearFeatures: [],
      facadeHints: [],
      signageClusters: [],
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

    const selection = buildSceneAssetSelection(sceneMeta, sceneDetail, 'MEDIUM');

    expect(selection.crossings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ objectId: principalCrossingA.objectId }),
        expect.objectContaining({ objectId: principalCrossingB.objectId }),
        expect.objectContaining({ objectId: anchorCrossing.objectId }),
      ]),
    );
    expect(selection.roads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ objectId: anchorRoad.objectId }),
      ]),
    );
    expect(selection.walkways).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ objectId: anchorWalkway.objectId }),
      ]),
    );
    expect(selection.selected.crossingCount).toBe(64);
    expect(selection.selected.roadCount).toBe(420);
    expect(selection.selected.walkwayCount).toBe(520);
  });
});
