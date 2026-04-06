import { Coordinate } from '../../places/types/place.types';
import {
  BuildingFacadeSpec,
  BuildingPreset,
  BuildingPodiumSpec,
  BuildingRoofSpec,
  BuildingSignageSpec,
  FacadePreset,
  GeometryStrategy,
  HeroBaseMass,
  HeroIntersectionProfile,
  MaterialClass,
  RoofAccentType,
  RoofType,
  SceneRoadDecal,
  SceneRoadStripeSet,
  VisualRole,
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
    visualRole?: VisualRole;
    baseMass?: HeroBaseMass;
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
    facadeSpec?: BuildingFacadeSpec;
    podiumSpec?: BuildingPodiumSpec;
    signageSpec?: BuildingSignageSpec;
    roofSpec?: BuildingRoofSpec;
  }>;
  intersectionOverrides: Array<{
    id: string;
    intersectionId: string;
    profile: HeroIntersectionProfile;
    crossingObjectIds: string[];
    crosswalkPolygons: Coordinate[][];
    stripeSets: SceneRoadStripeSet[];
    stopLines: Coordinate[][];
    laneArrows: Coordinate[][];
    junctionPaint?: Coordinate[];
    pedestrianIslands?: Coordinate[][];
  }>;
  roadDecalOverrides: SceneRoadDecal[];
  streetFurnitureRows: Array<{
    id: string;
    type: 'TRAFFIC_LIGHT' | 'STREET_LIGHT' | 'SIGN_POLE';
    points: Coordinate[];
    principal?: boolean;
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
      objectId: 'building-116806281',
      visualRole: 'hero_landmark',
      baseMass: 'stepped_tower',
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
      podiumSpec: {
        levels: 3,
        setbacks: 2,
        cornerChamfer: true,
        canopyEdges: [0, 1],
      },
      facadeSpec: {
        atlasId: 'shibuya-qfront-placeholder',
        uvMode: 'placeholder',
        emissiveMaskId: 'qfront-main-screen',
        facadePattern: 'curtain_wall',
        lowerBandType: 'screen_band',
        midBandType: 'window_grid',
        topBandType: 'screen_band',
        windowRepeatX: 8,
        windowRepeatY: 14,
      },
      signageSpec: {
        billboardFaces: [0, 1],
        signBandLevels: 2,
        screenFaces: [0],
        emissiveZones: 3,
      },
      roofSpec: {
        roofUnits: 4,
        crownType: 'screen_crown',
        parapet: true,
      },
    },
    {
      id: 'override-facade-qfront',
      anchor: { lat: 35.65938, lng: 139.70096 },
      objectId: 'building-142438894',
      visualRole: 'hero_landmark',
      baseMass: 'corner_tower',
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
      podiumSpec: {
        levels: 2,
        setbacks: 1,
        cornerChamfer: true,
        canopyEdges: [0],
      },
      facadeSpec: {
        atlasId: 'shibuya-tsutaya-placeholder',
        uvMode: 'placeholder',
        emissiveMaskId: 'tsutaya-screen',
        facadePattern: 'curtain_wall',
        lowerBandType: 'screen_band',
        midBandType: 'window_grid',
        topBandType: 'screen_band',
        windowRepeatX: 7,
        windowRepeatY: 12,
      },
      signageSpec: {
        billboardFaces: [0, 1],
        signBandLevels: 2,
        screenFaces: [0, 1],
        emissiveZones: 4,
      },
      roofSpec: {
        roofUnits: 5,
        crownType: 'stepped_crown',
        parapet: true,
      },
    },
    {
      id: 'override-facade-center-gai',
      anchor: { lat: 35.6595, lng: 139.69994 },
      objectId: 'building-1335178869',
      visualRole: 'retail_edge',
      baseMass: 'podium_tower',
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
      facadeSpec: {
        atlasId: 'center-gai-placeholder',
        uvMode: 'placeholder',
        facadePattern: 'mall_sign_band',
        lowerBandType: 'retail_sign_band',
        midBandType: 'solid_panel',
        topBandType: 'screen_band',
        windowRepeatX: 5,
        windowRepeatY: 7,
      },
      podiumSpec: {
        levels: 4,
        setbacks: 1,
        cornerChamfer: true,
        canopyEdges: [0, 1, 2],
      },
      signageSpec: {
        billboardFaces: [0, 1, 2],
        signBandLevels: 3,
        screenFaces: [0],
        emissiveZones: 4,
      },
      roofSpec: {
        roofUnits: 3,
        crownType: 'none',
        parapet: true,
      },
    },
    {
      id: 'override-facade-east-tower',
      anchor: { lat: 35.65962, lng: 139.70114 },
      objectId: 'building-142438895',
      visualRole: 'edge_landmark',
      baseMass: 'stepped_tower',
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
      facadeSpec: {
        atlasId: 'east-tower-placeholder',
        uvMode: 'placeholder',
        facadePattern: 'curtain_wall',
        lowerBandType: 'window_grid',
        midBandType: 'window_grid',
        topBandType: 'solid_panel',
        windowRepeatX: 6,
        windowRepeatY: 13,
      },
      podiumSpec: {
        levels: 2,
        setbacks: 2,
        cornerChamfer: true,
        canopyEdges: [0],
      },
      signageSpec: {
        billboardFaces: [0],
        signBandLevels: 1,
        screenFaces: [],
        emissiveZones: 1,
      },
      roofSpec: {
        roofUnits: 4,
        crownType: 'stepped_crown',
        parapet: true,
      },
    },
    {
      id: 'override-facade-west-mall',
      anchor: { lat: 35.65956, lng: 139.69974 },
      objectId: 'building-844691964',
      visualRole: 'edge_landmark',
      baseMass: 'slab_midrise',
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
      facadeSpec: {
        atlasId: 'west-mall-placeholder',
        uvMode: 'placeholder',
        facadePattern: 'mall_sign_band',
        lowerBandType: 'retail_sign_band',
        midBandType: 'solid_panel',
        topBandType: 'screen_band',
        windowRepeatX: 4,
        windowRepeatY: 6,
      },
      podiumSpec: {
        levels: 3,
        setbacks: 1,
        cornerChamfer: true,
        canopyEdges: [0, 1],
      },
      signageSpec: {
        billboardFaces: [0, 1],
        signBandLevels: 3,
        screenFaces: [0],
        emissiveZones: 3,
      },
      roofSpec: {
        roofUnits: 2,
        crownType: 'parapet_crown',
        parapet: true,
      },
    },
    {
      id: 'override-facade-station-edge',
      anchor: { lat: 35.65915, lng: 139.70096 },
      objectId: 'building-155538676',
      visualRole: 'station_edge',
      baseMass: 'podium_tower',
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
      facadeSpec: {
        atlasId: 'station-edge-placeholder',
        uvMode: 'placeholder',
        facadePattern: 'retail_screen',
        lowerBandType: 'retail_sign_band',
        midBandType: 'solid_panel',
        topBandType: 'solid_panel',
        windowRepeatX: 5,
        windowRepeatY: 4,
      },
      podiumSpec: {
        levels: 3,
        setbacks: 1,
        cornerChamfer: false,
        canopyEdges: [1, 2],
      },
      signageSpec: {
        billboardFaces: [1],
        signBandLevels: 1,
        screenFaces: [1],
        emissiveZones: 2,
      },
      roofSpec: {
        roofUnits: 6,
        crownType: 'parapet_crown',
        parapet: true,
      },
    },
    {
      id: 'override-facade-south-corner',
      anchor: { lat: 35.65905, lng: 139.70045 },
      objectId: 'building-155807205',
      visualRole: 'edge_landmark',
      baseMass: 'podium_tower',
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
      facadeSpec: {
        atlasId: 'south-corner-placeholder',
        uvMode: 'placeholder',
        facadePattern: 'curtain_wall',
        lowerBandType: 'retail_sign_band',
        midBandType: 'window_grid',
        topBandType: 'solid_panel',
        windowRepeatX: 6,
        windowRepeatY: 10,
      },
      podiumSpec: {
        levels: 2,
        setbacks: 0,
        cornerChamfer: true,
        canopyEdges: [0],
      },
      signageSpec: {
        billboardFaces: [0],
        signBandLevels: 1,
        screenFaces: [],
        emissiveZones: 1,
      },
      roofSpec: {
        roofUnits: 3,
        crownType: 'none',
        parapet: true,
      },
    },
    {
      id: 'override-facade-northwest-tower',
      anchor: { lat: 35.65996, lng: 139.70006 },
      objectId: 'building-136690966',
      visualRole: 'edge_landmark',
      baseMass: 'stepped_tower',
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
      facadeSpec: {
        atlasId: 'northwest-tower-placeholder',
        uvMode: 'placeholder',
        facadePattern: 'curtain_wall',
        lowerBandType: 'window_grid',
        midBandType: 'window_grid',
        topBandType: 'solid_panel',
        windowRepeatX: 6,
        windowRepeatY: 12,
      },
      podiumSpec: {
        levels: 2,
        setbacks: 2,
        cornerChamfer: true,
        canopyEdges: [0],
      },
      signageSpec: {
        billboardFaces: [0],
        signBandLevels: 1,
        screenFaces: [],
        emissiveZones: 1,
      },
      roofSpec: {
        roofUnits: 4,
        crownType: 'stepped_crown',
        parapet: true,
      },
    },
    {
      id: 'override-facade-hachiko-side',
      anchor: { lat: 35.65912, lng: 139.70118 },
      visualRole: 'retail_edge',
      baseMass: 'slab_midrise',
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
      facadeSpec: {
        atlasId: 'hachiko-side-placeholder',
        uvMode: 'placeholder',
        facadePattern: 'retail_screen',
        lowerBandType: 'retail_sign_band',
        midBandType: 'solid_panel',
        topBandType: 'screen_band',
        windowRepeatX: 4,
        windowRepeatY: 5,
      },
      podiumSpec: {
        levels: 3,
        setbacks: 1,
        cornerChamfer: false,
        canopyEdges: [0, 1],
      },
      signageSpec: {
        billboardFaces: [0, 1],
        signBandLevels: 2,
        screenFaces: [0],
        emissiveZones: 3,
      },
      roofSpec: {
        roofUnits: 2,
        crownType: 'none',
        parapet: true,
      },
    },
    {
      id: 'override-facade-central-midrise',
      anchor: { lat: 35.65944, lng: 139.70042 },
      visualRole: 'retail_edge',
      baseMass: 'slab_midrise',
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
      facadeSpec: {
        atlasId: 'central-midrise-placeholder',
        uvMode: 'placeholder',
        facadePattern: 'midrise_grid',
        lowerBandType: 'retail_sign_band',
        midBandType: 'window_grid',
        topBandType: 'solid_panel',
        windowRepeatX: 5,
        windowRepeatY: 8,
      },
      podiumSpec: {
        levels: 2,
        setbacks: 0,
        cornerChamfer: false,
        canopyEdges: [0],
      },
      signageSpec: {
        billboardFaces: [],
        signBandLevels: 1,
        screenFaces: [],
        emissiveZones: 1,
      },
      roofSpec: {
        roofUnits: 2,
        crownType: 'none',
        parapet: true,
      },
    },
    {
      id: 'override-facade-southwest-lowrise',
      anchor: { lat: 35.6591, lng: 139.69986 },
      objectId: 'building-60739635',
      visualRole: 'alley_retail',
      baseMass: 'lowrise_strip',
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
      facadeSpec: {
        atlasId: 'southwest-lowrise-placeholder',
        uvMode: 'placeholder',
        facadePattern: 'alley_shopfront',
        lowerBandType: 'retail_sign_band',
        midBandType: 'window_grid',
        topBandType: 'solid_panel',
        windowRepeatX: 3,
        windowRepeatY: 3,
      },
      podiumSpec: {
        levels: 1,
        setbacks: 0,
        cornerChamfer: false,
        canopyEdges: [0],
      },
      signageSpec: {
        billboardFaces: [],
        signBandLevels: 1,
        screenFaces: [],
        emissiveZones: 1,
      },
      roofSpec: {
        roofUnits: 1,
        crownType: 'none',
        parapet: false,
      },
    },
    {
      id: 'override-facade-stream-edge',
      anchor: { lat: 35.65924, lng: 139.70128 },
      visualRole: 'edge_landmark',
      baseMass: 'slab_midrise',
      preset: 'office_midrise',
      roofType: 'flat',
      heightMultiplier: 1.05,
      palette: ['#7d8792', '#b3bec9', '#ecf1f5'],
      shellPalette: ['#7d8792', '#b3bec9'],
      panelPalette: ['#ecf1f5', '#ffffff'],
      materialClass: 'glass',
      visualArchetype: 'commercial_midrise',
      geometryStrategy: 'podium_tower',
      facadePreset: 'glass_grid',
      podiumLevels: 2,
      setbackLevels: 1,
      cornerChamfer: true,
      roofAccentType: 'flush',
      signBandLevels: 1,
      windowPatternDensity: 'dense',
      signageDensity: 'medium',
      emissiveStrength: 0.58,
      glazingRatio: 0.48,
      facadeSpec: {
        atlasId: 'stream-edge-placeholder',
        uvMode: 'placeholder',
        facadePattern: 'curtain_wall',
        lowerBandType: 'retail_sign_band',
        midBandType: 'window_grid',
        topBandType: 'solid_panel',
        windowRepeatX: 6,
        windowRepeatY: 9,
      },
      podiumSpec: {
        levels: 2,
        setbacks: 1,
        cornerChamfer: true,
        canopyEdges: [0],
      },
      signageSpec: {
        billboardFaces: [0],
        signBandLevels: 1,
        screenFaces: [],
        emissiveZones: 1,
      },
      roofSpec: {
        roofUnits: 2,
        crownType: 'none',
        parapet: true,
      },
    },
    {
      id: 'override-facade-alley-strip',
      anchor: { lat: 35.65968, lng: 139.69966 },
      objectId: 'building-114755219',
      visualRole: 'alley_retail',
      baseMass: 'lowrise_strip',
      preset: 'small_lowrise',
      roofType: 'flat',
      heightMultiplier: 1.02,
      palette: ['#735546', '#b78972', '#ead9cc'],
      shellPalette: ['#735546', '#b78972'],
      panelPalette: ['#ffffff', '#f9d423'],
      materialClass: 'mixed',
      visualArchetype: 'lowrise_shop',
      geometryStrategy: 'simple_extrude',
      facadePreset: 'retail_sign_band',
      podiumLevels: 1,
      setbackLevels: 0,
      cornerChamfer: false,
      roofAccentType: 'flush',
      signBandLevels: 2,
      windowPatternDensity: 'sparse',
      signageDensity: 'high',
      emissiveStrength: 0.62,
      glazingRatio: 0.22,
      billboardEligible: true,
      facadeSpec: {
        atlasId: 'alley-strip-placeholder',
        uvMode: 'placeholder',
        facadePattern: 'alley_shopfront',
        lowerBandType: 'retail_sign_band',
        midBandType: 'window_grid',
        topBandType: 'solid_panel',
        windowRepeatX: 4,
        windowRepeatY: 3,
      },
      podiumSpec: {
        levels: 1,
        setbacks: 0,
        cornerChamfer: false,
        canopyEdges: [0, 1],
      },
      signageSpec: {
        billboardFaces: [0],
        signBandLevels: 2,
        screenFaces: [],
        emissiveZones: 2,
      },
      roofSpec: {
        roofUnits: 1,
        crownType: 'none',
        parapet: false,
      },
    },
  ],
  intersectionOverrides: [
    {
      id: 'override-intersection-main',
      intersectionId: 'override-crossing-main',
      profile: 'scramble_primary',
      crossingObjectIds: ['override-crossing-north-south', 'override-crossing-east-west'],
      crosswalkPolygons: [],
      stripeSets: [
        {
          centerPath: [
            { lat: 35.65978, lng: 139.70023 },
            { lat: 35.65918, lng: 139.70088 },
          ],
          stripeCount: 9,
          stripeDepth: 0.95,
          halfWidth: 8.4,
        },
        {
          centerPath: [
            { lat: 35.65958, lng: 139.69995 },
            { lat: 35.65942, lng: 139.70112 },
          ],
          stripeCount: 9,
          stripeDepth: 0.95,
          halfWidth: 8.4,
        },
      ],
      stopLines: [
        [
          { lat: 35.65986, lng: 139.70013 },
          { lat: 35.65976, lng: 139.70098 },
        ],
        [
          { lat: 35.65925, lng: 139.70008 },
          { lat: 35.65913, lng: 139.70092 },
        ],
      ],
      laneArrows: [
        [
          { lat: 35.65936, lng: 139.70045 },
          { lat: 35.65942, lng: 139.70061 },
          { lat: 35.6593, lng: 139.7006 },
        ],
        [
          { lat: 35.65962, lng: 139.7003 },
          { lat: 35.65967, lng: 139.70047 },
          { lat: 35.65955, lng: 139.70046 },
        ],
      ],
      junctionPaint: [
        { lat: 35.65958, lng: 139.70025 },
        { lat: 35.65974, lng: 139.70056 },
        { lat: 35.65947, lng: 139.70088 },
        { lat: 35.65924, lng: 139.70055 },
      ],
      pedestrianIslands: [],
    },
    {
      id: 'override-intersection-east',
      intersectionId: 'override-crossing-east',
      profile: 'scramble_secondary',
      crossingObjectIds: ['override-crossing-southeast'],
      crosswalkPolygons: [],
      stripeSets: [
        {
          centerPath: [
            { lat: 35.65936, lng: 139.70094 },
            { lat: 35.65896, lng: 139.70052 },
          ],
          stripeCount: 6,
          stripeDepth: 0.8,
          halfWidth: 6.4,
        },
      ],
      stopLines: [],
      laneArrows: [],
      junctionPaint: undefined,
      pedestrianIslands: [],
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
  streetFurnitureRows: [
    {
      id: 'row-traffic-north',
      type: 'TRAFFIC_LIGHT',
      principal: true,
      points: [
        { lat: 35.65982, lng: 139.70022 },
        { lat: 35.6598, lng: 139.70046 },
      ],
    },
    {
      id: 'row-traffic-south',
      type: 'TRAFFIC_LIGHT',
      principal: true,
      points: [
        { lat: 35.65918, lng: 139.70052 },
        { lat: 35.65914, lng: 139.70076 },
      ],
    },
    {
      id: 'row-street-east',
      type: 'STREET_LIGHT',
      points: [
        { lat: 35.65926, lng: 139.70108 },
        { lat: 35.65942, lng: 139.70116 },
        { lat: 35.65958, lng: 139.7012 },
      ],
    },
    {
      id: 'row-street-west',
      type: 'STREET_LIGHT',
      points: [
        { lat: 35.6593, lng: 139.69988 },
        { lat: 35.65948, lng: 139.69982 },
        { lat: 35.65968, lng: 139.69976 },
      ],
    },
    {
      id: 'row-sign-center-gai',
      type: 'SIGN_POLE',
      points: [
        { lat: 35.65952, lng: 139.69996 },
        { lat: 35.65962, lng: 139.6999 },
        { lat: 35.65972, lng: 139.69984 },
      ],
    },
    {
      id: 'row-sign-hachiko',
      type: 'SIGN_POLE',
      points: [
        { lat: 35.65918, lng: 139.70102 },
        { lat: 35.65924, lng: 139.7011 },
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
