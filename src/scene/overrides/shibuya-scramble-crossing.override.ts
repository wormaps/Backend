import { LandmarkAnnotationManifest } from '../types/scene.types';

export const SHIBUYA_SCRAMBLE_CROSSING_OVERRIDE: LandmarkAnnotationManifest = {
  id: 'shibuya-scramble-crossing',
  match: {
    placeIds: ['ChIJK9EM68qLGGARacmu4KJj5SA'],
    aliases: ['Shibuya Crossing', 'Shibuya Scramble Crossing'],
  },
  landmarks: [
    {
      id: 'landmark-qfront',
      objectId: 'building-116806281',
      name: 'Shibuya QFRONT',
      kind: 'BUILDING',
      importance: 'primary',
      anchor: { lat: 35.65976, lng: 139.70082 },
      facadeHint: {
        visualRole: 'hero_landmark',
        palette: ['#314152', '#5b6b7f', '#dce5f2'],
        shellPalette: ['#314152', '#5b6b7f'],
        panelPalette: ['#f44336', '#f9d423', '#ffffff'],
        materialClass: 'glass',
        signageDensity: 'high',
        emissiveStrength: 1,
        glazingRatio: 0.68,
      },
    },
    {
      id: 'landmark-109',
      name: 'Shibuya 109',
      kind: 'BUILDING',
      importance: 'primary',
      anchor: { lat: 35.65943, lng: 139.69992 },
      facadeHint: {
        visualRole: 'hero_landmark',
        palette: ['#d7dce3', '#f0f2f5', '#ffffff'],
        materialClass: 'concrete',
        signageDensity: 'high',
        emissiveStrength: 0.92,
        glazingRatio: 0.32,
      },
    },
    {
      id: 'landmark-station-front',
      name: 'Shibuya Station Front',
      kind: 'BUILDING',
      importance: 'primary',
      anchor: { lat: 35.65898, lng: 139.70118 },
      facadeHint: {
        visualRole: 'station_edge',
        palette: ['#6f7780', '#aeb7bf', '#dde2e6'],
        materialClass: 'metal',
        signageDensity: 'medium',
        emissiveStrength: 0.62,
        glazingRatio: 0.34,
      },
    },
    {
      id: 'landmark-center-gai',
      name: 'Center Gai Edge',
      kind: 'BUILDING',
      importance: 'secondary',
      anchor: { lat: 35.6596, lng: 139.69998 },
      facadeHint: {
        visualRole: 'retail_edge',
        palette: ['#2d3640', '#55616e', '#f6cf47'],
        materialClass: 'mixed',
        signageDensity: 'high',
        emissiveStrength: 0.86,
        glazingRatio: 0.38,
      },
    },
    {
      id: 'landmark-hachiko-side',
      name: 'Hachiko Plaza Edge',
      kind: 'PLAZA',
      importance: 'secondary',
      anchor: { lat: 35.65916, lng: 139.70103 },
    },
    {
      id: 'landmark-crossing-core',
      name: 'Shibuya Scramble Crossing',
      kind: 'CROSSING',
      importance: 'primary',
      anchor: { lat: 35.659482, lng: 139.7005596 },
    },
  ],
  crossings: [
    {
      id: 'annotation-crossing-main-ns',
      name: 'Shibuya Main Crossing North-South',
      style: 'zebra',
      importance: 'primary',
      path: [
        { lat: 35.65978, lng: 139.70023 },
        { lat: 35.65918, lng: 139.70088 },
      ],
    },
    {
      id: 'annotation-crossing-main-ew',
      name: 'Shibuya Main Crossing East-West',
      style: 'zebra',
      importance: 'primary',
      path: [
        { lat: 35.65958, lng: 139.69995 },
        { lat: 35.65942, lng: 139.70112 },
      ],
    },
    {
      id: 'annotation-crossing-ne',
      name: 'Shibuya Northeast Crossing',
      style: 'signalized',
      importance: 'secondary',
      path: [
        { lat: 35.6599, lng: 139.70074 },
        { lat: 35.65938, lng: 139.70134 },
      ],
    },
    {
      id: 'annotation-crossing-nw',
      name: 'Shibuya Northwest Crossing',
      style: 'signalized',
      importance: 'secondary',
      path: [
        { lat: 35.65994, lng: 139.70008 },
        { lat: 35.65936, lng: 139.69978 },
      ],
    },
    {
      id: 'annotation-crossing-se',
      name: 'Shibuya Southeast Crossing',
      style: 'signalized',
      importance: 'secondary',
      path: [
        { lat: 35.65936, lng: 139.70094 },
        { lat: 35.65896, lng: 139.70052 },
      ],
    },
  ],
  signageClusters: [
    {
      id: 'annotation-signage-qfront',
      anchor: { lat: 35.65974, lng: 139.70084 },
      panelCount: 8,
      palette: ['#f44336', '#f9d423', '#ffffff'],
      emissiveStrength: 1.1,
      widthMeters: 8,
      heightMeters: 3.6,
    },
    {
      id: 'annotation-signage-center-gai',
      anchor: { lat: 35.65956, lng: 139.69995 },
      panelCount: 6,
      palette: ['#29b6f6', '#ef5350', '#ffee58'],
      emissiveStrength: 1,
      widthMeters: 6,
      heightMeters: 2.8,
    },
  ],
  streetFurnitureRows: [
    {
      id: 'annotation-traffic-row-1',
      type: 'TRAFFIC_LIGHT',
      principal: true,
      points: [
        { lat: 35.65977, lng: 139.70027 },
        { lat: 35.6597, lng: 139.70049 },
      ],
    },
    {
      id: 'annotation-traffic-row-2',
      type: 'TRAFFIC_LIGHT',
      principal: true,
      points: [
        { lat: 35.65929, lng: 139.70093 },
        { lat: 35.65942, lng: 139.70099 },
      ],
    },
    {
      id: 'annotation-street-row-1',
      type: 'STREET_LIGHT',
      points: [
        { lat: 35.65979, lng: 139.70098 },
        { lat: 35.65954, lng: 139.70117 },
      ],
    },
    {
      id: 'annotation-street-row-2',
      type: 'STREET_LIGHT',
      points: [
        { lat: 35.65958, lng: 139.69988 },
        { lat: 35.65932, lng: 139.70004 },
      ],
    },
    {
      id: 'annotation-sign-row-1',
      type: 'SIGN_POLE',
      points: [
        { lat: 35.65966, lng: 139.70005 },
        { lat: 35.65937, lng: 139.6999 },
      ],
    },
    {
      id: 'annotation-sign-row-2',
      type: 'SIGN_POLE',
      points: [
        { lat: 35.65922, lng: 139.70087 },
        { lat: 35.65908, lng: 139.70061 },
      ],
    },
  ],
};
