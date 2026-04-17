import type { MaterialClass } from '../../../scene/types/scene.types';
import {
  applySurfaceBias,
  applyTextureSlotIfAvailable,
  applyWetOverlay,
  applyWetRoad,
  clampRange,
  resolveMaterialTuningOptions,
  resolveOverlayDepthBias,
  resolveShellBucketHex,
  resolveShellSurface,
  resolveTextureDiagnostics,
  scaleEmissive,
  scaleRoughness,
  tuneBillboardColor,
  tunePanelColor,
  tuneShellColor,
  hexToRgb,
  resolvePanelRoughness,
} from './glb-material-factory.scene.utils';

export interface TextureSlot {
  uri: string;
  mimeType?: string;
  sampler?: {
    magFilter?: number;
    minFilter?: number;
    wrapS?: number;
    wrapT?: number;
  };
}

export interface MaterialTextureSlots {
  ground?: TextureSlot;
  roadBase?: TextureSlot;
  sidewalk?: TextureSlot;
  buildingShell?: TextureSlot;
}

export interface MaterialTuningOptions {
  shellLuminanceCap?: number;
  panelLuminanceCap?: number;
  billboardLuminanceCap?: number;
  emissiveBoost?: number;
  roadRoughnessScale?: number;
  wetRoadBoost?: number;
  overlayDepthBias?: number;
  inferenceReasonCodes?: string[];
  weakEvidenceRatio?: number;
  textureSlots?: MaterialTextureSlots;
  enableTexturePath?: boolean;
}

export interface GlbMaterial {
  setBaseColorFactor(value: [number, number, number, number]): GlbMaterial;
  setMetallicFactor(value: number): GlbMaterial;
  setRoughnessFactor(value: number): GlbMaterial;
  setEmissiveFactor(value: [number, number, number]): GlbMaterial;
  setDoubleSided(value: boolean): GlbMaterial;
  setAlphaMode(value: 'OPAQUE' | 'MASK' | 'BLEND'): GlbMaterial;
  setAlphaCutoff(value: number): GlbMaterial;
  setExtras?(value: Record<string, unknown>): GlbMaterial;
  setExtra?(key: string, value: Record<string, unknown>): GlbMaterial;
  setBaseColorTexture?(texture: unknown): GlbMaterial;
}

export interface TextureDiagnostics {
  texturePathActive: boolean;
  fallbackPathActive: boolean;
  textureSlotUsed?: string;
  reason?: string;
}

export interface GlbMaterialDocument {
  createMaterial(name: string): GlbMaterial;
}

export interface FacadeLayerMaterialProfile {
  facadeFamily?: 'brick' | 'concrete' | 'glass' | 'metal' | 'modern_glass';
  facadeVariant?: 'light' | 'mid' | 'dark';
  shellSurfaceBias?: 'matte' | 'balanced' | 'glossy';
  panelSurfaceBias?: 'matte' | 'balanced' | 'glossy';
  panelEmissiveBoost?: number;
  windowType?: 'clear' | 'tinted' | 'reflective' | 'curtain_wall';
  entranceSurface?: 'concrete' | 'metal' | 'glass';
  roofEquipmentSurface?: 'concrete' | 'metal' | 'glass';
  heroCanopyLight?:
    | 'warm_interior'
    | 'cool_interior'
    | 'accent_spot'
    | 'flood_light'
    | 'window_glow';
  heroBillboardTone?:
    | 'red'
    | 'orange'
    | 'yellow'
    | 'green'
    | 'cyan'
    | 'blue'
    | 'purple'
    | 'white'
    | 'pink';
}

export type AccentTone = 'warm' | 'cool' | 'neutral';
export type ShellColorBucket =
  | 'cool-light'
  | 'cool-mid'
  | 'neutral-light'
  | 'neutral-mid'
  | 'neutral-dark'
  | 'warm-light'
  | 'warm-mid'
  | 'brick';

export interface SceneMaterials {
  ground: GlbMaterial;
  roadBase: GlbMaterial;
  roadEdge: GlbMaterial;
  roadMarking: GlbMaterial;
  laneOverlay: GlbMaterial;
  crosswalk: GlbMaterial;
  junctionOverlay: GlbMaterial;
  sidewalk: GlbMaterial;
  curb: GlbMaterial;
  median: GlbMaterial;
  greenStrip: GlbMaterial;
  sidewalkEdge: GlbMaterial;
  trafficLight: GlbMaterial;
  streetLight: GlbMaterial;
  signPole: GlbMaterial;
  bench: GlbMaterial;
  bikeRack: GlbMaterial;
  trashCan: GlbMaterial;
  fireHydrant: GlbMaterial;
  tree: GlbMaterial;
  treeVariation: GlbMaterial;
  bush: GlbMaterial;
  flowerBed: GlbMaterial;
  poi: GlbMaterial;
  landCoverPark: GlbMaterial;
  landCoverWater: GlbMaterial;
  landCoverPlaza: GlbMaterial;
  linearRailway: GlbMaterial;
  linearBridge: GlbMaterial;
  linearWaterway: GlbMaterial;
  roofAccents: Record<AccentTone, GlbMaterial>;
  roofSurfaces: Record<AccentTone, GlbMaterial>;
  buildingPanels: Record<AccentTone, GlbMaterial>;
  billboards: Record<AccentTone, GlbMaterial>;
  landmark: GlbMaterial;
  facadeConcreteMid?: GlbMaterial;
  facadeMetalMid?: GlbMaterial;
  windowGlassReflective?: GlbMaterial;
  windowGlassCurtainWall?: GlbMaterial;
  buildingLightAccentSpot?: GlbMaterial;
  neonSignOrange?: GlbMaterial;
  facadePrimary?: GlbMaterial;
  windowPrimary?: GlbMaterial;
  entrancePrimary?: GlbMaterial;
  roofEquipmentPrimary?: GlbMaterial;
  heroCanopyPrimary?: GlbMaterial;
  heroRoofUnitPrimary?: GlbMaterial;
  heroBillboardPrimary?: GlbMaterial;
  textureDiagnostics?: TextureDiagnostics;
}

export function createSceneMaterials(
  doc: GlbMaterialDocument,
  tuningOptions: MaterialTuningOptions = {},
): SceneMaterials {
  const tuning = resolveMaterialTuningOptions(tuningOptions);
  const overlayBias = resolveOverlayDepthBias(tuning.overlayDepthBias);
  const overlayCutoff = clampRange(0.022 / overlayBias, 0.008, 0.03);
  const textureDiagnostics = resolveTextureDiagnostics(tuning);

  const ground = doc
    .createMaterial('ground')
    .setBaseColorFactor([0.52, 0.55, 0.5, 1])
    .setMetallicFactor(0)
    .setRoughnessFactor(1);
  applyTextureSlotIfAvailable(
    ground,
    tuning.textureSlots.ground,
    tuning.enableTexturePath,
  );

  const roadBase = doc
    .createMaterial('road-base')
    .setBaseColorFactor([0.14, 0.15, 0.17, 1])
    .setMetallicFactor(0)
    .setRoughnessFactor(
      applyWetRoad(
        scaleRoughness(0.69, tuning.roadRoughnessScale),
        tuning.wetRoadBoost,
      ),
    );
  applyTextureSlotIfAvailable(
    roadBase,
    tuning.textureSlots.roadBase,
    tuning.enableTexturePath,
  );

  const sidewalk = doc
    .createMaterial('sidewalk')
    .setBaseColorFactor([0.58, 0.57, 0.54, 1])
    .setMetallicFactor(0)
    .setRoughnessFactor(0.78);
  applyTextureSlotIfAvailable(
    sidewalk,
    tuning.textureSlots.sidewalk,
    tuning.enableTexturePath,
  );

  return {
    ground,
    roadBase,
    roadEdge: doc
      .createMaterial('road-edge')
      .setBaseColorFactor([0.38, 0.38, 0.36, 1])
      .setMetallicFactor(0)
      .setRoughnessFactor(
        applyWetRoad(
          scaleRoughness(0.76, tuning.roadRoughnessScale),
          tuning.wetRoadBoost,
        ),
      ),
    roadMarking: doc
      .createMaterial('road-marking')
      .setBaseColorFactor([0.96, 0.93, 0.74, 1])
      .setMetallicFactor(0)
      .setAlphaMode('MASK')
      .setAlphaCutoff(overlayCutoff)
      .setDoubleSided(false)
      .setRoughnessFactor(
        applyWetOverlay(
          scaleRoughness(0.82, tuning.roadRoughnessScale),
          tuning.wetRoadBoost,
        ),
      ),
    laneOverlay: doc
      .createMaterial('lane-overlay')
      .setBaseColorFactor([0.98, 0.91, 0.64, 1])
      .setEmissiveFactor(
        scaleEmissive([0.14, 0.12, 0.05], tuning.emissiveBoost),
      )
      .setMetallicFactor(0)
      .setAlphaMode('MASK')
      .setAlphaCutoff(clampRange(overlayCutoff + 0.002, 0.01, 0.032))
      .setDoubleSided(false)
      .setRoughnessFactor(
        applyWetOverlay(
          scaleRoughness(0.74, tuning.roadRoughnessScale),
          tuning.wetRoadBoost,
        ),
      ),
    crosswalk: doc
      .createMaterial('crosswalk')
      .setBaseColorFactor([0.99, 0.99, 0.96, 1])
      .setEmissiveFactor(scaleEmissive([0.2, 0.18, 0.11], tuning.emissiveBoost))
      .setMetallicFactor(0)
      .setAlphaMode('MASK')
      .setAlphaCutoff(clampRange(overlayCutoff + 0.001, 0.01, 0.031))
      .setDoubleSided(false)
      .setRoughnessFactor(
        applyWetOverlay(
          scaleRoughness(0.72, tuning.roadRoughnessScale),
          tuning.wetRoadBoost,
        ),
      ),
    junctionOverlay: doc
      .createMaterial('junction-overlay')
      .setBaseColorFactor([0.99, 0.9, 0.42, 1])
      .setEmissiveFactor(scaleEmissive([0.2, 0.12, 0.04], tuning.emissiveBoost))
      .setMetallicFactor(0)
      .setAlphaMode('MASK')
      .setAlphaCutoff(clampRange(overlayCutoff + 0.003, 0.011, 0.033))
      .setDoubleSided(false)
      .setRoughnessFactor(
        applyWetOverlay(
          scaleRoughness(0.78, tuning.roadRoughnessScale),
          tuning.wetRoadBoost,
        ),
      ),
    sidewalk,
    curb: doc
      .createMaterial('curb')
      .setBaseColorFactor([0.82, 0.81, 0.78, 1])
      .setMetallicFactor(0)
      .setRoughnessFactor(0.76),
    median: doc
      .createMaterial('median')
      .setBaseColorFactor([0.36, 0.55, 0.33, 1])
      .setMetallicFactor(0)
      .setRoughnessFactor(0.93),
    greenStrip: doc
      .createMaterial('green-strip')
      .setBaseColorFactor([0.26, 0.62, 0.3, 1])
      .setMetallicFactor(0)
      .setRoughnessFactor(0.86),
    sidewalkEdge: doc
      .createMaterial('sidewalk-edge')
      .setBaseColorFactor([0.74, 0.73, 0.7, 1])
      .setMetallicFactor(0)
      .setRoughnessFactor(0.82),
    trafficLight: doc
      .createMaterial('traffic-light')
      .setBaseColorFactor([0.12, 0.13, 0.14, 1])
      .setEmissiveFactor(
        scaleEmissive([0.08, 0.02, 0.01], tuning.emissiveBoost),
      )
      .setMetallicFactor(0)
      .setRoughnessFactor(0.92),
    streetLight: doc
      .createMaterial('street-light')
      .setBaseColorFactor([0.34, 0.36, 0.39, 1])
      .setEmissiveFactor(scaleEmissive([0.1, 0.08, 0.03], tuning.emissiveBoost))
      .setMetallicFactor(0.06)
      .setRoughnessFactor(0.76),
    signPole: doc
      .createMaterial('sign-pole')
      .setBaseColorFactor([0.38, 0.41, 0.45, 1])
      .setMetallicFactor(0.04)
      .setRoughnessFactor(0.78),
    bench: doc
      .createMaterial('bench')
      .setBaseColorFactor([0.42, 0.32, 0.22, 1])
      .setMetallicFactor(0)
      .setRoughnessFactor(0.85),
    bikeRack: doc
      .createMaterial('bike-rack')
      .setBaseColorFactor([0.28, 0.28, 0.3, 1])
      .setMetallicFactor(0.12)
      .setRoughnessFactor(0.72),
    trashCan: doc
      .createMaterial('trash-can')
      .setBaseColorFactor([0.32, 0.38, 0.35, 1])
      .setMetallicFactor(0.02)
      .setRoughnessFactor(0.88),
    fireHydrant: doc
      .createMaterial('fire-hydrant')
      .setBaseColorFactor([0.82, 0.22, 0.18, 1])
      .setMetallicFactor(0.08)
      .setRoughnessFactor(0.76),
    tree: doc
      .createMaterial('tree')
      .setBaseColorFactor([0.28, 0.47, 0.27, 1])
      .setMetallicFactor(0)
      .setRoughnessFactor(1),
    treeVariation: doc
      .createMaterial('tree-variation')
      .setBaseColorFactor([0.22, 0.42, 0.2, 1])
      .setMetallicFactor(0)
      .setRoughnessFactor(0.95),
    bush: doc
      .createMaterial('bush')
      .setBaseColorFactor([0.35, 0.55, 0.3, 1])
      .setMetallicFactor(0)
      .setRoughnessFactor(0.9),
    flowerBed: doc
      .createMaterial('flower-bed')
      .setBaseColorFactor([0.65, 0.45, 0.35, 1])
      .setEmissiveFactor(
        scaleEmissive([0.08, 0.04, 0.02], tuning.emissiveBoost),
      )
      .setMetallicFactor(0)
      .setRoughnessFactor(0.85),
    poi: doc
      .createMaterial('poi')
      .setBaseColorFactor([0.93, 0.39, 0.18, 1])
      .setEmissiveFactor(
        scaleEmissive([0.22, 0.08, 0.03], tuning.emissiveBoost),
      )
      .setMetallicFactor(0)
      .setRoughnessFactor(0.8),
    landCoverPark: doc
      .createMaterial('landcover-park')
      .setBaseColorFactor([0.48, 0.67, 0.38, 1])
      .setMetallicFactor(0)
      .setRoughnessFactor(1),
    landCoverWater: doc
      .createMaterial('landcover-water')
      .setBaseColorFactor([0.32, 0.55, 0.72, 1])
      .setMetallicFactor(0)
      .setRoughnessFactor(0.4),
    landCoverPlaza: doc
      .createMaterial('landcover-plaza')
      .setBaseColorFactor([0.86, 0.83, 0.76, 1])
      .setMetallicFactor(0)
      .setRoughnessFactor(0.72),
    linearRailway: doc
      .createMaterial('linear-railway')
      .setBaseColorFactor([0.42, 0.42, 0.44, 1])
      .setMetallicFactor(0)
      .setRoughnessFactor(0.85),
    linearBridge: doc
      .createMaterial('linear-bridge')
      .setBaseColorFactor([0.58, 0.58, 0.6, 1])
      .setMetallicFactor(0)
      .setRoughnessFactor(0.82),
    linearWaterway: doc
      .createMaterial('linear-waterway')
      .setBaseColorFactor([0.25, 0.49, 0.68, 1])
      .setMetallicFactor(0)
      .setRoughnessFactor(0.45),
    roofAccents: {
      cool: doc
        .createMaterial('roof-accent-cool')
        .setBaseColorFactor([0.44, 0.59, 0.74, 1])
        .setMetallicFactor(0)
        .setRoughnessFactor(0.68),
      warm: doc
        .createMaterial('roof-accent-warm')
        .setBaseColorFactor([0.67, 0.46, 0.31, 1])
        .setMetallicFactor(0)
        .setRoughnessFactor(0.7),
      neutral: doc
        .createMaterial('roof-accent-neutral')
        .setBaseColorFactor([0.52, 0.55, 0.6, 1])
        .setMetallicFactor(0)
        .setRoughnessFactor(0.72),
    } as Record<AccentTone, any>,
    roofSurfaces: {
      cool: doc
        .createMaterial('roof-surface-cool')
        .setBaseColorFactor([0.32, 0.42, 0.52, 1])
        .setMetallicFactor(0.02)
        .setRoughnessFactor(0.84),
      warm: doc
        .createMaterial('roof-surface-warm')
        .setBaseColorFactor([0.48, 0.37, 0.28, 1])
        .setMetallicFactor(0)
        .setRoughnessFactor(0.88),
      neutral: doc
        .createMaterial('roof-surface-neutral')
        .setBaseColorFactor([0.4, 0.41, 0.43, 1])
        .setMetallicFactor(0)
        .setRoughnessFactor(0.9),
    } as Record<AccentTone, any>,
    buildingPanels: {
      cool: doc
        .createMaterial('building-panel-cool')
        .setBaseColorFactor([0.16, 0.24, 0.34, 1])
        .setEmissiveFactor(
          scaleEmissive([0.24, 0.32, 0.42], tuning.emissiveBoost),
        )
        .setMetallicFactor(0)
        .setRoughnessFactor(0.78),
      warm: doc
        .createMaterial('building-panel-warm')
        .setBaseColorFactor([0.4, 0.23, 0.13, 1])
        .setEmissiveFactor(scaleEmissive([0.4, 0.2, 0.1], tuning.emissiveBoost))
        .setMetallicFactor(0)
        .setRoughnessFactor(0.78),
      neutral: doc
        .createMaterial('building-panel-neutral')
        .setBaseColorFactor([0.22, 0.24, 0.28, 1])
        .setEmissiveFactor(
          scaleEmissive([0.24, 0.24, 0.28], tuning.emissiveBoost),
        )
        .setMetallicFactor(0)
        .setRoughnessFactor(0.8),
    } as Record<AccentTone, any>,
    billboards: {
      cool: doc
        .createMaterial('billboard-cool')
        .setBaseColorFactor([0.28, 0.63, 0.94, 1])
        .setEmissiveFactor(
          scaleEmissive([0.24, 0.42, 0.62], tuning.emissiveBoost),
        )
        .setMetallicFactor(0)
        .setRoughnessFactor(0.68),
      warm: doc
        .createMaterial('billboard-warm')
        .setBaseColorFactor([0.95, 0.36, 0.28, 1])
        .setEmissiveFactor(
          scaleEmissive([0.72, 0.24, 0.1], tuning.emissiveBoost),
        )
        .setMetallicFactor(0)
        .setRoughnessFactor(0.7),
      neutral: doc
        .createMaterial('billboard-neutral')
        .setBaseColorFactor([0.62, 0.63, 0.66, 1])
        .setEmissiveFactor(
          scaleEmissive([0.46, 0.46, 0.5], tuning.emissiveBoost),
        )
        .setMetallicFactor(0)
        .setRoughnessFactor(0.72),
    } as Record<AccentTone, any>,
    landmark: doc
      .createMaterial('landmark')
      .setBaseColorFactor([0.96, 0.73, 0.18, 1])
      .setEmissiveFactor(
        scaleEmissive([0.25, 0.17, 0.05], tuning.emissiveBoost),
      )
      .setMetallicFactor(0)
      .setRoughnessFactor(0.75),
    textureDiagnostics,
  };
}

export function createBuildingShellMaterial(
  doc: GlbMaterialDocument,
  materialClass: MaterialClass,
  bucket: ShellColorBucket,
  explicitHex?: string,
  tuningOptions: MaterialTuningOptions = {},
  facadeProfile: FacadeLayerMaterialProfile = {},
): GlbMaterial {
  const tuning = resolveMaterialTuningOptions(tuningOptions);
  const [r, g, b] = tuneShellColor(
    hexToRgb(explicitHex ?? resolveShellBucketHex(bucket)),
    materialClass,
    tuning.shellLuminanceCap,
  );
  const surface = resolveShellSurface(materialClass);
  const adjustedSurface = applySurfaceBias(
    surface,
    facadeProfile.shellSurfaceBias,
  );

  const material = doc
    .createMaterial(`building-shell-${materialClass}-${explicitHex ?? bucket}`)
    .setBaseColorFactor([r, g, b, 1])
    .setMetallicFactor(adjustedSurface.metallicFactor)
    .setRoughnessFactor(adjustedSurface.roughnessFactor)
    .setDoubleSided(true);
  applyTextureSlotIfAvailable(
    material,
    tuning.textureSlots.buildingShell,
    tuning.enableTexturePath,
  );
  return material;
}

export function createBuildingPanelMaterial(
  doc: GlbMaterialDocument,
  tone: AccentTone,
  hex: string,
  tuningOptions: MaterialTuningOptions = {},
  facadeProfile: FacadeLayerMaterialProfile = {},
): GlbMaterial {
  const tuning = resolveMaterialTuningOptions(tuningOptions);
  const [r, g, b] = tunePanelColor(
    hexToRgb(hex),
    tone,
    tuning.panelLuminanceCap,
  );
  const emissiveBoost =
    (tone === 'warm' ? 0.28 : tone === 'cool' ? 0.24 : 0.18) *
    tuning.emissiveBoost *
    clampRange(facadeProfile.panelEmissiveBoost ?? 1.0, 0.75, 1.6);
  const panelRoughness = resolvePanelRoughness(facadeProfile.panelSurfaceBias);
  return doc
    .createMaterial(`building-panel-${tone}-${hex}`)
    .setBaseColorFactor([r, g, b, 1])
    .setEmissiveFactor([
      Math.min(0.8, r * emissiveBoost),
      Math.min(0.8, g * emissiveBoost),
      Math.min(0.8, b * emissiveBoost),
    ])
    .setMetallicFactor(0)
    .setRoughnessFactor(panelRoughness);
}

export function createBillboardMaterial(
  doc: GlbMaterialDocument,
  tone: AccentTone,
  hex: string,
  tuningOptions: MaterialTuningOptions = {},
): GlbMaterial {
  const tuning = resolveMaterialTuningOptions(tuningOptions);
  const [r, g, b] = tuneBillboardColor(
    hexToRgb(hex),
    tone,
    tuning.billboardLuminanceCap,
  );
  const emissiveBoost =
    (tone === 'warm' ? 0.46 : tone === 'cool' ? 0.42 : 0.3) *
    tuning.emissiveBoost;
  return doc
    .createMaterial(`billboard-${tone}-${hex}`)
    .setBaseColorFactor([r, g, b, 1])
    .setEmissiveFactor([
      Math.min(1, r * emissiveBoost + 0.06),
      Math.min(1, g * emissiveBoost + 0.06),
      Math.min(1, b * emissiveBoost + 0.06),
    ])
    .setMetallicFactor(0)
    .setRoughnessFactor(0.7);
}
