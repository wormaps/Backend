import { SceneRoadVisionService } from './scene-road-vision.service';
import type { ExternalPlaceDetail } from '../../../places/types/external-place.types';
import type { PlacePackage } from '../../../places/types/place.types';

function coordinate(lat: number, lng: number) {
  return { lat, lng };
}

describe('SceneRoadVisionService', () => {
  const service = new SceneRoadVisionService();

  it('adds layered hero decals for principal crossings', () => {
    const place: ExternalPlaceDetail = {
      provider: 'GOOGLE_PLACES',
      placeId: 'place-road-vision-test',
      displayName: 'Road Vision Test',
      formattedAddress: 'Tokyo',
      location: coordinate(35.6595, 139.7005),
      primaryType: 'tourist_attraction',
      types: ['tourist_attraction'],
      googleMapsUri: null,
      viewport: null,
      utcOffsetMinutes: 540,
    };

    const placePackage: PlacePackage = {
      placeId: place.placeId,
      version: 'test',
      generatedAt: new Date().toISOString(),
      camera: {
        topView: { x: 0, y: 120, z: 80 },
        walkViewStart: { x: 0, y: 1.7, z: 0 },
      },
      bounds: {
        northEast: coordinate(35.661, 139.702),
        southWest: coordinate(35.658, 139.699),
      },
      roads: [
        {
          id: 'road-main',
          name: 'Main Road',
          laneCount: 3,
          roadClass: 'primary',
          widthMeters: 12,
          direction: 'TWO_WAY',
          path: [coordinate(35.6591, 139.7001), coordinate(35.6599, 139.7009)],
          surface: 'asphalt',
          bridge: false,
        },
      ],
      buildings: [],
      walkways: [],
      pois: [],
      landmarks: [],
      crossings: [
        {
          id: 'crossing-principal',
          name: 'principal crossing',
          type: 'CROSSING',
          crossing: 'zebra',
          crossingRef: 'zebra',
          signalized: true,
          path: [
            coordinate(35.65935, 139.70025),
            coordinate(35.65968, 139.70072),
          ],
          center: coordinate(35.6595, 139.7005),
        },
        {
          id: 'crossing-secondary',
          name: 'secondary crossing',
          type: 'CROSSING',
          crossing: 'marked',
          crossingRef: null,
          signalized: false,
          path: [
            coordinate(35.6602, 139.7012),
            coordinate(35.66035, 139.70135),
          ],
          center: coordinate(35.66025, 139.70125),
        },
      ],
      streetFurniture: [],
      vegetation: [],
      landCovers: [],
      linearFeatures: [],
    };

    const crossings = service.buildCrossings(place, placePackage);
    const principal = crossings.find(
      (item) => item.objectId === 'crossing-principal',
    );
    expect(principal?.principal).toBe(true);

    const roadMarkings = service.buildRoadMarkings(placePackage, crossings);
    const intersectionProfiles = service.buildIntersectionProfiles(
      place,
      crossings,
      placePackage,
    );
    const decals = service.buildRoadDecals(
      placePackage,
      crossings,
      roadMarkings,
      intersectionProfiles,
    );

    const principalPathOverlays = decals.filter(
      (decal) =>
        decal.objectId.startsWith('crossing-principal-scramble-path-') &&
        decal.shapeKind === 'path_strip' &&
        decal.emphasis === 'hero',
    );
    const principalPolygonOverlays = decals.filter(
      (decal) =>
        decal.objectId.startsWith('crossing-principal-scramble-') &&
        decal.shapeKind !== 'path_strip',
    );
    const junctionArrowApproach = decals.find(
      (decal) =>
        decal.objectId === 'crossing-principal-intersection-arrow-approach',
    );

    expect(principalPathOverlays.length).toBeGreaterThanOrEqual(3);
    expect(principalPolygonOverlays.length).toBeGreaterThanOrEqual(2);
    expect(junctionArrowApproach).toBeDefined();
  });
});
