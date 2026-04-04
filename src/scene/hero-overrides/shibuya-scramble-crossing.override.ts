import { Coordinate } from '../../places/place.types';
import { BuildingPreset, MaterialClass, RoofType } from '../scene.types';

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
    preset?: BuildingPreset;
    roofType?: RoofType;
    heightMultiplier?: number;
    palette: string[];
    materialClass: MaterialClass;
    signageDensity: 'low' | 'medium' | 'high';
    emissiveStrength: number;
    glazingRatio: number;
    billboardEligible?: boolean;
    facadeEdgeIndex?: number | null;
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
      preset: 'glass_tower',
      roofType: 'stepped',
      heightMultiplier: 1.18,
      palette: ['#2d3a4b', '#5b6b7f', '#dce5f2'],
      materialClass: 'glass',
      signageDensity: 'high',
      emissiveStrength: 1.05,
      glazingRatio: 0.7,
      billboardEligible: true,
    },
    {
      id: 'override-facade-qfront',
      anchor: { lat: 35.65938, lng: 139.70096 },
      preset: 'glass_tower',
      roofType: 'flat',
      heightMultiplier: 1.1,
      palette: ['#4c5968', '#8ba0b8', '#d6dee8'],
      materialClass: 'glass',
      signageDensity: 'high',
      emissiveStrength: 0.95,
      glazingRatio: 0.62,
      billboardEligible: true,
    },
    {
      id: 'override-facade-center-gai',
      anchor: { lat: 35.6595, lng: 139.69994 },
      preset: 'mall_block',
      roofType: 'flat',
      heightMultiplier: 1.05,
      palette: ['#7e4b3a', '#b87957', '#e8d2b7'],
      materialClass: 'mixed',
      signageDensity: 'high',
      emissiveStrength: 0.85,
      glazingRatio: 0.25,
      billboardEligible: true,
    },
    {
      id: 'override-facade-east-tower',
      anchor: { lat: 35.65962, lng: 139.70114 },
      preset: 'glass_tower',
      roofType: 'stepped',
      heightMultiplier: 1.16,
      palette: ['#53708d', '#8ea8c0', '#dfeaf4'],
      materialClass: 'glass',
      signageDensity: 'medium',
      emissiveStrength: 0.72,
      glazingRatio: 0.68,
    },
    {
      id: 'override-facade-west-mall',
      anchor: { lat: 35.65956, lng: 139.69974 },
      preset: 'mall_block',
      roofType: 'flat',
      heightMultiplier: 1.08,
      palette: ['#d8d8d4', '#bbbbbb', '#5d676f'],
      materialClass: 'concrete',
      signageDensity: 'high',
      emissiveStrength: 0.82,
      glazingRatio: 0.22,
      billboardEligible: true,
    },
    {
      id: 'override-facade-station-edge',
      anchor: { lat: 35.65915, lng: 139.70096 },
      preset: 'station_block',
      roofType: 'stepped',
      heightMultiplier: 1.1,
      palette: ['#8b8f95', '#c4c7c9', '#f0f1f2'],
      materialClass: 'metal',
      signageDensity: 'medium',
      emissiveStrength: 0.54,
      glazingRatio: 0.4,
    },
    {
      id: 'override-facade-south-corner',
      anchor: { lat: 35.65905, lng: 139.70045 },
      preset: 'office_midrise',
      roofType: 'flat',
      heightMultiplier: 1.06,
      palette: ['#65717d', '#a8b2bc', '#dde2e7'],
      materialClass: 'glass',
      signageDensity: 'medium',
      emissiveStrength: 0.66,
      glazingRatio: 0.52,
    },
    {
      id: 'override-facade-northwest-tower',
      anchor: { lat: 35.65996, lng: 139.70006 },
      preset: 'glass_tower',
      roofType: 'stepped',
      heightMultiplier: 1.14,
      palette: ['#6b8199', '#a9c0d4', '#e9f1f7'],
      materialClass: 'glass',
      signageDensity: 'medium',
      emissiveStrength: 0.7,
      glazingRatio: 0.64,
    },
    {
      id: 'override-facade-hachiko-side',
      anchor: { lat: 35.65912, lng: 139.70118 },
      preset: 'mall_block',
      roofType: 'flat',
      heightMultiplier: 1.02,
      palette: ['#7a6352', '#b0927f', '#e6d7ca'],
      materialClass: 'mixed',
      signageDensity: 'high',
      emissiveStrength: 0.74,
      glazingRatio: 0.18,
      billboardEligible: true,
    },
    {
      id: 'override-facade-central-midrise',
      anchor: { lat: 35.65944, lng: 139.70042 },
      preset: 'mixed_midrise',
      roofType: 'flat',
      heightMultiplier: 1.04,
      palette: ['#969a9e', '#c7c9cb', '#ececec'],
      materialClass: 'concrete',
      signageDensity: 'medium',
      emissiveStrength: 0.46,
      glazingRatio: 0.24,
    },
    {
      id: 'override-facade-southwest-lowrise',
      anchor: { lat: 35.6591, lng: 139.69986 },
      preset: 'small_lowrise',
      roofType: 'gable',
      heightMultiplier: 1.08,
      palette: ['#7b4a3b', '#aa765d', '#d6bea7'],
      materialClass: 'brick',
      signageDensity: 'medium',
      emissiveStrength: 0.38,
      glazingRatio: 0.16,
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
