import { PlacePackage, PlaceDetail, RegistryInfo } from '../types/place.types';

export const PLACE_REGISTRY_FIXTURES: RegistryInfo[] = [
  {
    id: 'shibuya-crossing',
    slug: 'shibuya-crossing',
    name: 'Shibuya Crossing',
    country: 'Japan',
    city: 'Tokyo',
    location: { lat: 35.6595, lng: 139.7005 },
    placeType: 'CROSSING',
    tags: ['tourism', 'crossing', 'nightlife'],
  },
  {
    id: 'times-square',
    slug: 'times-square',
    name: 'Times Square',
    country: 'United States',
    city: 'New York',
    location: { lat: 40.758, lng: -73.9855 },
    placeType: 'SQUARE',
    tags: ['tourism', 'commercial', 'billboard'],
  },
  {
    id: 'gangnam-station',
    slug: 'gangnam-station',
    name: 'Gangnam Station',
    country: 'South Korea',
    city: 'Seoul',
    location: { lat: 37.4979, lng: 127.0276 },
    placeType: 'STATION',
    tags: ['transit', 'commercial', 'commute'],
  },
  {
    id: 'gwanghwamun-square',
    slug: 'gwanghwamun-square',
    name: 'Gwanghwamun Square',
    country: 'South Korea',
    city: 'Seoul',
    location: { lat: 37.5714, lng: 126.9769 },
    placeType: 'PLAZA',
    tags: ['public', 'landmark', 'open-space'],
  },
];

export const PLACE_PACKAGE_FIXTURES: Record<string, PlacePackage> = {
  'shibuya-crossing': {
    placeId: 'shibuya-crossing',
    version: '2026.04-mvp',
    generatedAt: '2026-04-04T00:00:00Z',
    camera: {
      topView: { x: 0, y: 180, z: 120 },
      walkViewStart: { x: 8, y: 1.7, z: 20 },
    },
    bounds: {
      northEast: { lat: 35.6602, lng: 139.7012 },
      southWest: { lat: 35.6589, lng: 139.6997 },
    },
    buildings: [
      {
        id: 'shibuya-109',
        name: 'Shibuya 109',
        heightMeters: 45,
        usage: 'COMMERCIAL',
        outerRing: [
          { lat: 35.6599, lng: 139.6999 },
          { lat: 35.66, lng: 139.7001 },
          { lat: 35.6598, lng: 139.7002 },
        ],
        holes: [],
        footprint: [
          { lat: 35.6599, lng: 139.6999 },
          { lat: 35.66, lng: 139.7001 },
          { lat: 35.6598, lng: 139.7002 },
        ],
      },
      {
        id: 'tsutaya',
        name: 'QFRONT',
        heightMeters: 38,
        usage: 'COMMERCIAL',
        outerRing: [
          { lat: 35.6596, lng: 139.7004 },
          { lat: 35.6597, lng: 139.7007 },
          { lat: 35.6595, lng: 139.7008 },
        ],
        holes: [],
        footprint: [
          { lat: 35.6596, lng: 139.7004 },
          { lat: 35.6597, lng: 139.7007 },
          { lat: 35.6595, lng: 139.7008 },
        ],
      },
    ],
    roads: [
      {
        id: 'dogenzaka',
        name: 'Dogenzaka Street',
        laneCount: 3,
        roadClass: 'primary',
        widthMeters: 10.5,
        direction: 'TWO_WAY',
        path: [
          { lat: 35.6591, lng: 139.6999 },
          { lat: 35.6598, lng: 139.7005 },
          { lat: 35.6601, lng: 139.7011 },
        ],
      },
    ],
    walkways: [
      {
        id: 'shibuya-crosswalk-main',
        name: 'Main Crosswalk',
        widthMeters: 10,
        walkwayType: 'footway',
        path: [
          { lat: 35.6593, lng: 139.7002 },
          { lat: 35.6596, lng: 139.7005 },
          { lat: 35.6599, lng: 139.7009 },
        ],
      },
    ],
    pois: [
      {
        id: 'hachiko-exit',
        name: 'Hachiko Exit',
        type: 'ENTRANCE',
        location: { lat: 35.6594, lng: 139.7006 },
      },
      {
        id: 'signal-north',
        name: 'North Signal',
        type: 'SIGNAL',
        location: { lat: 35.6598, lng: 139.7004 },
      },
    ],
    landmarks: [
      {
        id: 'hachiko',
        name: 'Hachiko Statue',
        type: 'LANDMARK',
        location: { lat: 35.6591, lng: 139.7005 },
      },
    ],
    crossings: [],
    streetFurniture: [],
    vegetation: [],
    landCovers: [],
    linearFeatures: [],
    diagnostics: {
      droppedBuildings: 0,
      deduplicatedBuildings: 0,
      mergedWayRelationBuildings: 0,
      droppedRoads: 0,
      droppedWalkways: 0,
      droppedPois: 0,
      droppedCrossings: 0,
      droppedStreetFurniture: 0,
      droppedVegetation: 0,
      droppedLandCovers: 0,
      droppedLinearFeatures: 0,
    },
  },
  'times-square': {
    placeId: 'times-square',
    version: '2026.04-mvp',
    generatedAt: '2026-04-04T00:00:00Z',
    camera: {
      topView: { x: 0, y: 220, z: 160 },
      walkViewStart: { x: 14, y: 1.7, z: 26 },
    },
    bounds: {
      northEast: { lat: 40.759, lng: -73.9847 },
      southWest: { lat: 40.7572, lng: -73.9864 },
    },
    buildings: [
      {
        id: 'one-times-square',
        name: 'One Times Square',
        heightMeters: 110,
        usage: 'COMMERCIAL',
        outerRing: [
          { lat: 40.7581, lng: -73.9857 },
          { lat: 40.7582, lng: -73.9855 },
          { lat: 40.7579, lng: -73.9854 },
        ],
        holes: [],
        footprint: [
          { lat: 40.7581, lng: -73.9857 },
          { lat: 40.7582, lng: -73.9855 },
          { lat: 40.7579, lng: -73.9854 },
        ],
      },
    ],
    roads: [
      {
        id: 'broadway',
        name: 'Broadway',
        laneCount: 4,
        roadClass: 'primary',
        widthMeters: 14,
        direction: 'ONE_WAY',
        path: [
          { lat: 40.7573, lng: -73.9862 },
          { lat: 40.7581, lng: -73.9855 },
          { lat: 40.7588, lng: -73.9849 },
        ],
      },
    ],
    walkways: [
      {
        id: 'times-square-plaza',
        name: 'Pedestrian Plaza',
        widthMeters: 18,
        walkwayType: 'pedestrian',
        path: [
          { lat: 40.7577, lng: -73.9859 },
          { lat: 40.7582, lng: -73.9854 },
        ],
      },
    ],
    pois: [
      {
        id: 'tkts',
        name: 'TKTS Booth',
        type: 'SHOP',
        location: { lat: 40.758, lng: -73.9858 },
      },
    ],
    landmarks: [
      {
        id: 'red-steps',
        name: 'Red Steps',
        type: 'LANDMARK',
        location: { lat: 40.758, lng: -73.9858 },
      },
    ],
    crossings: [],
    streetFurniture: [],
    vegetation: [],
    landCovers: [],
    linearFeatures: [],
    diagnostics: {
      droppedBuildings: 0,
      deduplicatedBuildings: 0,
      mergedWayRelationBuildings: 0,
      droppedRoads: 0,
      droppedWalkways: 0,
      droppedPois: 0,
      droppedCrossings: 0,
      droppedStreetFurniture: 0,
      droppedVegetation: 0,
      droppedLandCovers: 0,
      droppedLinearFeatures: 0,
    },
  },
  'gangnam-station': {
    placeId: 'gangnam-station',
    version: '2026.04-mvp',
    generatedAt: '2026-04-04T00:00:00Z',
    camera: {
      topView: { x: 0, y: 170, z: 130 },
      walkViewStart: { x: 10, y: 1.7, z: 18 },
    },
    bounds: {
      northEast: { lat: 37.4985, lng: 127.0285 },
      southWest: { lat: 37.4972, lng: 127.0267 },
    },
    buildings: [
      {
        id: 'gangnam-central',
        name: 'Gangnam Commercial Block',
        heightMeters: 62,
        usage: 'MIXED',
        outerRing: [
          { lat: 37.4981, lng: 127.0275 },
          { lat: 37.4982, lng: 127.0279 },
          { lat: 37.4978, lng: 127.028 },
        ],
        holes: [],
        footprint: [
          { lat: 37.4981, lng: 127.0275 },
          { lat: 37.4982, lng: 127.0279 },
          { lat: 37.4978, lng: 127.028 },
        ],
      },
    ],
    roads: [
      {
        id: 'teheran-ro',
        name: 'Teheran-ro',
        laneCount: 5,
        roadClass: 'primary',
        widthMeters: 16,
        direction: 'TWO_WAY',
        path: [
          { lat: 37.4973, lng: 127.0268 },
          { lat: 37.4979, lng: 127.0276 },
          { lat: 37.4984, lng: 127.0283 },
        ],
      },
    ],
    walkways: [
      {
        id: 'gangnam-exit-11',
        name: 'Exit 11 Walkway',
        widthMeters: 7,
        walkwayType: 'footway',
        path: [
          { lat: 37.4977, lng: 127.0271 },
          { lat: 37.4979, lng: 127.0276 },
        ],
      },
    ],
    pois: [
      {
        id: 'exit-11',
        name: 'Exit 11',
        type: 'ENTRANCE',
        location: { lat: 37.4978, lng: 127.0272 },
      },
    ],
    landmarks: [
      {
        id: 'gangnam-signage',
        name: 'Gangnam Signage',
        type: 'LANDMARK',
        location: { lat: 37.4979, lng: 127.0276 },
      },
    ],
    crossings: [],
    streetFurniture: [],
    vegetation: [],
    landCovers: [],
    linearFeatures: [],
    diagnostics: {
      droppedBuildings: 0,
      deduplicatedBuildings: 0,
      mergedWayRelationBuildings: 0,
      droppedRoads: 0,
      droppedWalkways: 0,
      droppedPois: 0,
      droppedCrossings: 0,
      droppedStreetFurniture: 0,
      droppedVegetation: 0,
      droppedLandCovers: 0,
      droppedLinearFeatures: 0,
    },
  },
  'gwanghwamun-square': {
    placeId: 'gwanghwamun-square',
    version: '2026.04-mvp',
    generatedAt: '2026-04-04T00:00:00Z',
    camera: {
      topView: { x: 0, y: 190, z: 140 },
      walkViewStart: { x: 12, y: 1.7, z: 24 },
    },
    bounds: {
      northEast: { lat: 37.5721, lng: 126.9778 },
      southWest: { lat: 37.5708, lng: 126.976 },
    },
    buildings: [
      {
        id: 'government-complex',
        name: 'Government Complex Seoul',
        heightMeters: 70,
        usage: 'PUBLIC',
        outerRing: [
          { lat: 37.5719, lng: 126.9772 },
          { lat: 37.572, lng: 126.9776 },
          { lat: 37.5716, lng: 126.9777 },
        ],
        holes: [],
        footprint: [
          { lat: 37.5719, lng: 126.9772 },
          { lat: 37.572, lng: 126.9776 },
          { lat: 37.5716, lng: 126.9777 },
        ],
      },
    ],
    roads: [
      {
        id: 'sejong-daero',
        name: 'Sejong-daero',
        laneCount: 6,
        roadClass: 'primary',
        widthMeters: 20,
        direction: 'TWO_WAY',
        path: [
          { lat: 37.5709, lng: 126.9763 },
          { lat: 37.5714, lng: 126.9769 },
          { lat: 37.5719, lng: 126.9775 },
        ],
      },
    ],
    walkways: [
      {
        id: 'central-plaza-path',
        name: 'Central Plaza Path',
        widthMeters: 12,
        walkwayType: 'pedestrian',
        path: [
          { lat: 37.571, lng: 126.9766 },
          { lat: 37.5717, lng: 126.9772 },
        ],
      },
    ],
    pois: [
      {
        id: 'statue-sejong',
        name: 'Statue of King Sejong',
        type: 'LANDMARK',
        location: { lat: 37.5715, lng: 126.9769 },
      },
    ],
    landmarks: [
      {
        id: 'admiral-yi',
        name: 'Admiral Yi Sun-sin Statue',
        type: 'LANDMARK',
        location: { lat: 37.5712, lng: 126.9768 },
      },
    ],
    crossings: [],
    streetFurniture: [],
    vegetation: [],
    landCovers: [],
    linearFeatures: [],
    diagnostics: {
      droppedBuildings: 0,
      deduplicatedBuildings: 0,
      mergedWayRelationBuildings: 0,
      droppedRoads: 0,
      droppedWalkways: 0,
      droppedPois: 0,
      droppedCrossings: 0,
      droppedStreetFurniture: 0,
      droppedVegetation: 0,
      droppedLandCovers: 0,
      droppedLinearFeatures: 0,
    },
  },
};

export const PLACE_DETAILS_FIXTURES: PlaceDetail[] =
  PLACE_REGISTRY_FIXTURES.map((registry) => {
    const placePackage = PLACE_PACKAGE_FIXTURES[registry.id];

    return {
      registry,
      packageSummary: {
        version: placePackage.version,
        generatedAt: placePackage.generatedAt,
        buildingCount: placePackage.buildings.length,
        roadCount: placePackage.roads.length,
        walkwayCount: placePackage.walkways.length,
        poiCount: placePackage.pois.length + placePackage.landmarks.length,
      },
      supportedTimeOfDay: ['DAY', 'EVENING', 'NIGHT'],
      supportedWeather: ['CLEAR', 'CLOUDY', 'RAIN', 'SNOW'],
    };
  });
