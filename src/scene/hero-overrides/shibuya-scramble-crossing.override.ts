import { Coordinate } from '../../places/place.types';
import { MaterialClass } from '../scene.types';

export interface HeroOverrideManifest {
  id: string;
  match: {
    placeIds: string[];
    aliases: string[];
  };
  crossings: Array<{
    id: string;
    name: string;
    path: Coordinate[];
    style: 'zebra' | 'signalized';
    principal?: boolean;
  }>;
  streetFurniture: Array<{
    id: string;
    type: 'TRAFFIC_LIGHT' | 'STREET_LIGHT' | 'SIGN_POLE';
    location: Coordinate;
    principal?: boolean;
  }>;
  signageClusters: Array<{
    id: string;
    anchor: Coordinate;
    panelCount: number;
    palette: string[];
    emissiveStrength: number;
    widthMeters: number;
    heightMeters: number;
  }>;
  facadeOverrides: Array<{
    id: string;
    anchor: Coordinate;
    palette: string[];
    materialClass: MaterialClass;
    signageDensity: 'low' | 'medium' | 'high';
    emissiveStrength: number;
    glazingRatio: number;
  }>;
  landmarkAnchors: Array<{
    id: string;
    name: string;
    location: Coordinate;
    kind: 'BUILDING' | 'CROSSING' | 'PLAZA';
  }>;
}

export const SHIBUYA_SCRAMBLE_CROSSING_OVERRIDE: HeroOverrideManifest = {
  id: 'shibuya-scramble-crossing',
  match: {
    placeIds: ['ChIJK9EM68qLGGARacmu4KJj5SA'],
    aliases: ['Shibuya Crossing', 'Shibuya Scramble Crossing'],
  },
  crossings: [
    {
      id: 'override-crossing-north-south',
      name: 'Shibuya Main Crossing North-South',
      style: 'zebra',
      principal: true,
      path: [
        { lat: 35.65978, lng: 139.70023 },
        { lat: 35.65918, lng: 139.70088 },
      ],
    },
    {
      id: 'override-crossing-east-west',
      name: 'Shibuya Main Crossing East-West',
      style: 'zebra',
      principal: true,
      path: [
        { lat: 35.65958, lng: 139.69995 },
        { lat: 35.65942, lng: 139.70112 },
      ],
    },
    {
      id: 'override-crossing-northeast',
      name: 'Shibuya Northeast Crossing',
      style: 'signalized',
      path: [
        { lat: 35.6599, lng: 139.70074 },
        { lat: 35.65938, lng: 139.70134 },
      ],
    },
    {
      id: 'override-crossing-northwest',
      name: 'Shibuya Northwest Crossing',
      style: 'signalized',
      path: [
        { lat: 35.65994, lng: 139.70008 },
        { lat: 35.65936, lng: 139.69978 },
      ],
    },
    {
      id: 'override-crossing-southeast',
      name: 'Shibuya Southeast Crossing',
      style: 'signalized',
      path: [
        { lat: 35.65936, lng: 139.70094 },
        { lat: 35.65896, lng: 139.70052 },
      ],
    },
  ],
  streetFurniture: [
    {
      id: 'override-traffic-light-1',
      type: 'TRAFFIC_LIGHT',
      principal: true,
      location: { lat: 35.65978, lng: 139.70035 },
    },
    {
      id: 'override-traffic-light-2',
      type: 'TRAFFIC_LIGHT',
      principal: true,
      location: { lat: 35.65928, lng: 139.70094 },
    },
    {
      id: 'override-street-light-1',
      type: 'STREET_LIGHT',
      location: { lat: 35.65982, lng: 139.7009 },
    },
    {
      id: 'override-sign-pole-1',
      type: 'SIGN_POLE',
      location: { lat: 35.65967, lng: 139.70005 },
    },
  ],
  signageClusters: [
    {
      id: 'override-signage-tsutaya',
      anchor: { lat: 35.65974, lng: 139.70084 },
      panelCount: 8,
      palette: ['#f44336', '#f9d423', '#ffffff'],
      emissiveStrength: 1.1,
      widthMeters: 8,
      heightMeters: 3.6,
    },
    {
      id: 'override-signage-center-gai',
      anchor: { lat: 35.65956, lng: 139.69995 },
      panelCount: 6,
      palette: ['#29b6f6', '#ef5350', '#ffee58'],
      emissiveStrength: 1,
      widthMeters: 6,
      heightMeters: 2.8,
    },
  ],
  facadeOverrides: [
    {
      id: 'override-facade-tsutaya',
      anchor: { lat: 35.65976, lng: 139.70082 },
      palette: ['#2d3a4b', '#5b6b7f', '#dce5f2'],
      materialClass: 'glass',
      signageDensity: 'high',
      emissiveStrength: 1.05,
      glazingRatio: 0.7,
    },
    {
      id: 'override-facade-qfront',
      anchor: { lat: 35.65938, lng: 139.70096 },
      palette: ['#4c5968', '#8ba0b8', '#d6dee8'],
      materialClass: 'glass',
      signageDensity: 'high',
      emissiveStrength: 0.95,
      glazingRatio: 0.62,
    },
    {
      id: 'override-facade-center-gai',
      anchor: { lat: 35.6595, lng: 139.69994 },
      palette: ['#7e4b3a', '#b87957', '#e8d2b7'],
      materialClass: 'mixed',
      signageDensity: 'high',
      emissiveStrength: 0.85,
      glazingRatio: 0.25,
    },
  ],
  landmarkAnchors: [
    {
      id: 'override-landmark-crossing',
      name: 'Shibuya Scramble Crossing',
      location: { lat: 35.659482, lng: 139.7005596 },
      kind: 'CROSSING',
    },
    {
      id: 'override-landmark-tsutaya',
      name: 'Shibuya QFRONT',
      location: { lat: 35.65973, lng: 139.70083 },
      kind: 'BUILDING',
    },
    {
      id: 'override-landmark-plaza',
      name: 'Hachiko Plaza Edge',
      location: { lat: 35.65916, lng: 139.70103 },
      kind: 'PLAZA',
    },
  ],
};

