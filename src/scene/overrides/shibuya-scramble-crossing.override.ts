import { Coordinate } from '../../places/types/place.types';
import {
  BuildingPreset,
  FacadePreset,
  GeometryStrategy,
  MaterialClass,
  RoofAccentType,
  RoofType,
  SceneRoadDecal,
  VisualArchetype,
  WindowPatternDensity,
} from '../types/scene.types';

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
    objectId?: string;
    anchor: Coordinate;
    preset?: BuildingPreset;
    roofType?: RoofType;
    heightMultiplier?: number;
    visualArchetype?: VisualArchetype;
    geometryStrategy?: GeometryStrategy;
    facadePreset?: FacadePreset;
    podiumLevels?: number;
    setbackLevels?: number;
    cornerChamfer?: boolean;
    roofAccentType?: RoofAccentType;
    signBandLevels?: number;
    windowPatternDensity?: WindowPatternDensity;
    shellPalette?: string[];
    panelPalette?: string[];
    palette: string[];
    materialClass: MaterialClass;
    signageDensity: 'low' | 'medium' | 'high';
    emissiveStrength: number;
    glazingRatio: number;
    billboardEligible?: boolean;
    facadeEdgeIndex?: number | null;
  }>;
  roadDecalOverrides: SceneRoadDecal[];
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
      shellPalette: ['#2d3a4b', '#5b6b7f'],
      panelPalette: ['#f44336', '#f9d423', '#ffffff'],
      materialClass: 'glass',
      visualArchetype: 'landmark_special',
      geometryStrategy: 'stepped_tower',
      facadePreset: 'glass_grid',
      podiumLevels: 3,
      setbackLevels: 2,
      cornerChamfer: true,
      roofAccentType: 'crown',
      signBandLevels: 2,
      windowPatternDensity: 'dense',
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
      shellPalette: ['#4c5968', '#8ba0b8'],
      panelPalette: ['#29b6f6', '#ffffff'],
      materialClass: 'glass',
      visualArchetype: 'landmark_special',
      geometryStrategy: 'podium_tower',
      facadePreset: 'glass_grid',
      podiumLevels: 2,
      setbackLevels: 1,
      cornerChamfer: true,
      roofAccentType: 'terrace',
      signBandLevels: 2,
      windowPatternDensity: 'dense',
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
      shellPalette: ['#7e4b3a', '#b87957'],
      panelPalette: ['#ef5350', '#ffee58', '#ffffff'],
      materialClass: 'mixed',
      visualArchetype: 'mall_podium',
      geometryStrategy: 'podium_tower',
      facadePreset: 'mall_panel',
      podiumLevels: 4,
      setbackLevels: 1,
      cornerChamfer: true,
      roofAccentType: 'flush',
      signBandLevels: 3,
      windowPatternDensity: 'medium',
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
      shellPalette: ['#53708d', '#8ea8c0'],
      panelPalette: ['#dfeaf4', '#ffffff'],
      materialClass: 'glass',
      visualArchetype: 'highrise_office',
      geometryStrategy: 'stepped_tower',
      facadePreset: 'glass_grid',
      podiumLevels: 2,
      setbackLevels: 2,
      cornerChamfer: true,
      roofAccentType: 'terrace',
      signBandLevels: 1,
      windowPatternDensity: 'dense',
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
      shellPalette: ['#d8d8d4', '#bbbbbb'],
      panelPalette: ['#f9d423', '#ffffff'],
      materialClass: 'concrete',
      visualArchetype: 'mall_podium',
      geometryStrategy: 'podium_tower',
      facadePreset: 'mall_panel',
      podiumLevels: 3,
      setbackLevels: 1,
      cornerChamfer: true,
      roofAccentType: 'flush',
      signBandLevels: 3,
      windowPatternDensity: 'medium',
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
      shellPalette: ['#8b8f95', '#c4c7c9'],
      panelPalette: ['#f0f1f2', '#d8dee3'],
      materialClass: 'metal',
      visualArchetype: 'station_like',
      geometryStrategy: 'podium_tower',
      facadePreset: 'station_metal',
      podiumLevels: 3,
      setbackLevels: 1,
      cornerChamfer: false,
      roofAccentType: 'crown',
      signBandLevels: 1,
      windowPatternDensity: 'medium',
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
      shellPalette: ['#65717d', '#a8b2bc'],
      panelPalette: ['#dde2e7', '#ffffff'],
      materialClass: 'glass',
      visualArchetype: 'commercial_midrise',
      geometryStrategy: 'simple_extrude',
      facadePreset: 'glass_grid',
      podiumLevels: 2,
      setbackLevels: 0,
      cornerChamfer: false,
      roofAccentType: 'flush',
      signBandLevels: 1,
      windowPatternDensity: 'dense',
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
      shellPalette: ['#6b8199', '#a9c0d4'],
      panelPalette: ['#e9f1f7', '#ffffff'],
      materialClass: 'glass',
      visualArchetype: 'highrise_office',
      geometryStrategy: 'stepped_tower',
      facadePreset: 'glass_grid',
      podiumLevels: 2,
      setbackLevels: 2,
      cornerChamfer: true,
      roofAccentType: 'terrace',
      signBandLevels: 1,
      windowPatternDensity: 'dense',
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
      shellPalette: ['#7a6352', '#b0927f'],
      panelPalette: ['#ef5350', '#ffee58'],
      materialClass: 'mixed',
      visualArchetype: 'mall_podium',
      geometryStrategy: 'podium_tower',
      facadePreset: 'retail_sign_band',
      podiumLevels: 3,
      setbackLevels: 1,
      cornerChamfer: false,
      roofAccentType: 'flush',
      signBandLevels: 2,
      windowPatternDensity: 'medium',
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
      shellPalette: ['#969a9e', '#c7c9cb'],
      panelPalette: ['#ececec', '#f6f6f6'],
      materialClass: 'concrete',
      visualArchetype: 'commercial_midrise',
      geometryStrategy: 'simple_extrude',
      facadePreset: 'concrete_repetitive',
      podiumLevels: 2,
      setbackLevels: 0,
      cornerChamfer: false,
      roofAccentType: 'flush',
      signBandLevels: 1,
      windowPatternDensity: 'medium',
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
      shellPalette: ['#7b4a3b', '#aa765d'],
      panelPalette: ['#d6bea7', '#f1ebe6'],
      materialClass: 'brick',
      visualArchetype: 'lowrise_shop',
      geometryStrategy: 'gable_lowrise',
      facadePreset: 'brick_lowrise',
      podiumLevels: 1,
      setbackLevels: 0,
      cornerChamfer: false,
      roofAccentType: 'gable',
      signBandLevels: 1,
      windowPatternDensity: 'sparse',
      signageDensity: 'medium',
      emissiveStrength: 0.38,
      glazingRatio: 0.16,
    },
  ],
  roadDecalOverrides: [
    {
      objectId: 'override-road-decal-main-crosswalk',
      type: 'CROSSWALK_OVERLAY',
      color: '#f8f8f6',
      emphasis: 'hero',
      polygon: [
        { lat: 35.65981, lng: 139.7002 },
        { lat: 35.6592, lng: 139.70094 },
        { lat: 35.65908, lng: 139.70082 },
        { lat: 35.65969, lng: 139.70008 },
      ],
    },
    {
      objectId: 'override-road-decal-main-crosswalk-east-west',
      type: 'CROSSWALK_OVERLAY',
      color: '#f8f8f6',
      emphasis: 'hero',
      polygon: [
        { lat: 35.65963, lng: 139.69992 },
        { lat: 35.65948, lng: 139.70118 },
        { lat: 35.65934, lng: 139.70115 },
        { lat: 35.65949, lng: 139.69989 },
      ],
    },
    {
      objectId: 'override-road-decal-main-junction',
      type: 'JUNCTION_OVERLAY',
      color: '#eadb87',
      emphasis: 'hero',
      polygon: [
        { lat: 35.65958, lng: 139.70025 },
        { lat: 35.65974, lng: 139.70056 },
        { lat: 35.65947, lng: 139.70088 },
        { lat: 35.65924, lng: 139.70055 },
      ],
    },
    {
      objectId: 'override-road-decal-stop-line-north',
      type: 'STOP_LINE',
      color: '#ffffff',
      emphasis: 'hero',
      path: [
        { lat: 35.65986, lng: 139.70013 },
        { lat: 35.65976, lng: 139.70098 },
      ],
    },
    {
      objectId: 'override-road-decal-arrow-main',
      type: 'ARROW_MARK',
      color: '#f7f2a2',
      emphasis: 'hero',
      polygon: [
        { lat: 35.65936, lng: 139.70045 },
        { lat: 35.65942, lng: 139.70061 },
        { lat: 35.6593, lng: 139.7006 },
      ],
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
