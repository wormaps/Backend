import type { MaterialClass } from '../../../scene/types/scene.types';
import {
  applySurfaceBias,
  applyTextureSlotIfAvailable,
  resolveMaterialTuningOptions,
  resolveShellBucketHex,
  resolveShellSurface,
  tuneBillboardColor,
  tunePanelColor,
  tuneShellColor,
  hexToRgb,
  clampRange,
  resolvePanelRoughness,
} from './glb-material-factory.scene.utils';

export { createSceneMaterials } from './glb-material-factory.scene-materials';

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
  resolvedFallbackSource?: 'PLACE_CHARACTER' | 'DISTRICT_TYPE' | 'STATIC_DEFAULT';
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
