import type { MaterialClass } from '../../../scene/types/scene.types';

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
  ground: any;
  roadBase: any;
  roadEdge: any;
  roadMarking: any;
  laneOverlay: any;
  crosswalk: any;
  junctionOverlay: any;
  sidewalk: any;
  curb: any;
  median: any;
  sidewalkEdge: any;
  trafficLight: any;
  streetLight: any;
  signPole: any;
  bench: any;
  bikeRack: any;
  trashCan: any;
  fireHydrant: any;
  tree: any;
  treeVariation: any;
  bush: any;
  flowerBed: any;
  poi: any;
  landCoverPark: any;
  landCoverWater: any;
  landCoverPlaza: any;
  linearRailway: any;
  linearBridge: any;
  linearWaterway: any;
  roofAccents: Record<AccentTone, any>;
  roofSurfaces: Record<AccentTone, any>;
  buildingPanels: Record<AccentTone, any>;
  billboards: Record<AccentTone, any>;
  landmark: any;
}

export function createSceneMaterials(doc: any): SceneMaterials {
  return {
    ground: doc
      .createMaterial('ground')
      .setBaseColorFactor([0.64, 0.64, 0.62, 1])
      .setMetallicFactor(0)
      .setRoughnessFactor(1),
    roadBase: doc
      .createMaterial('road-base')
      .setBaseColorFactor([0.2, 0.21, 0.22, 1])
      .setMetallicFactor(0)
      .setRoughnessFactor(0.96),
    roadEdge: doc
      .createMaterial('road-edge')
      .setBaseColorFactor([0.34, 0.34, 0.33, 1])
      .setMetallicFactor(0)
      .setRoughnessFactor(0.94),
    roadMarking: doc
      .createMaterial('road-marking')
      .setBaseColorFactor([0.88, 0.84, 0.65, 1])
      .setMetallicFactor(0)
      .setRoughnessFactor(0.78),
    laneOverlay: doc
      .createMaterial('lane-overlay')
      .setBaseColorFactor([0.84, 0.8, 0.58, 1])
      .setMetallicFactor(0)
      .setRoughnessFactor(0.78),
    crosswalk: doc
      .createMaterial('crosswalk')
      .setBaseColorFactor([0.78, 0.78, 0.75, 1])
      .setMetallicFactor(0)
      .setRoughnessFactor(0.95),
    junctionOverlay: doc
      .createMaterial('junction-overlay')
      .setBaseColorFactor([0.94, 0.84, 0.42, 1])
      .setEmissiveFactor([0.08, 0.06, 0.02])
      .setMetallicFactor(0)
      .setRoughnessFactor(0.74),
    sidewalk: doc
      .createMaterial('sidewalk')
      .setBaseColorFactor([0.62, 0.61, 0.58, 1])
      .setMetallicFactor(0)
      .setRoughnessFactor(0.98),
    curb: doc
      .createMaterial('curb')
      .setBaseColorFactor([0.72, 0.71, 0.68, 1])
      .setMetallicFactor(0)
      .setRoughnessFactor(0.92),
    median: doc
      .createMaterial('median')
      .setBaseColorFactor([0.35, 0.52, 0.32, 1])
      .setMetallicFactor(0)
      .setRoughnessFactor(0.96),
    sidewalkEdge: doc
      .createMaterial('sidewalk-edge')
      .setBaseColorFactor([0.68, 0.67, 0.64, 1])
      .setMetallicFactor(0)
      .setRoughnessFactor(0.94),
    trafficLight: doc
      .createMaterial('traffic-light')
      .setBaseColorFactor([0.12, 0.13, 0.14, 1])
      .setEmissiveFactor([0.08, 0.02, 0.01])
      .setMetallicFactor(0)
      .setRoughnessFactor(0.92),
    streetLight: doc
      .createMaterial('street-light')
      .setBaseColorFactor([0.34, 0.36, 0.39, 1])
      .setEmissiveFactor([0.06, 0.05, 0.02])
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
      .setEmissiveFactor([0.08, 0.04, 0.02])
      .setMetallicFactor(0)
      .setRoughnessFactor(0.85),
    poi: doc
      .createMaterial('poi')
      .setBaseColorFactor([0.93, 0.39, 0.18, 1])
      .setEmissiveFactor([0.22, 0.08, 0.03])
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
      .setBaseColorFactor([0.79, 0.75, 0.66, 1])
      .setMetallicFactor(0)
      .setRoughnessFactor(0.95),
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
        .setEmissiveFactor([0.18, 0.25, 0.34])
        .setMetallicFactor(0)
        .setRoughnessFactor(0.78),
      warm: doc
        .createMaterial('building-panel-warm')
        .setBaseColorFactor([0.4, 0.23, 0.13, 1])
        .setEmissiveFactor([0.3, 0.14, 0.08])
        .setMetallicFactor(0)
        .setRoughnessFactor(0.78),
      neutral: doc
        .createMaterial('building-panel-neutral')
        .setBaseColorFactor([0.22, 0.24, 0.28, 1])
        .setEmissiveFactor([0.18, 0.18, 0.2])
        .setMetallicFactor(0)
        .setRoughnessFactor(0.8),
    } as Record<AccentTone, any>,
    billboards: {
      cool: doc
        .createMaterial('billboard-cool')
        .setBaseColorFactor([0.28, 0.63, 0.94, 1])
        .setEmissiveFactor([0.16, 0.32, 0.5])
        .setMetallicFactor(0)
        .setRoughnessFactor(0.68),
      warm: doc
        .createMaterial('billboard-warm')
        .setBaseColorFactor([0.95, 0.36, 0.28, 1])
        .setEmissiveFactor([0.55, 0.18, 0.08])
        .setMetallicFactor(0)
        .setRoughnessFactor(0.7),
      neutral: doc
        .createMaterial('billboard-neutral')
        .setBaseColorFactor([0.62, 0.63, 0.66, 1])
        .setEmissiveFactor([0.34, 0.34, 0.36])
        .setMetallicFactor(0)
        .setRoughnessFactor(0.72),
    } as Record<AccentTone, any>,
    landmark: doc
      .createMaterial('landmark')
      .setBaseColorFactor([0.96, 0.73, 0.18, 1])
      .setEmissiveFactor([0.25, 0.17, 0.05])
      .setMetallicFactor(0)
      .setRoughnessFactor(0.75),
  };
}

export function createBuildingShellMaterial(
  doc: any,
  materialClass: MaterialClass,
  bucket: ShellColorBucket,
  explicitHex?: string,
) {
  const [r, g, b] = tuneShellColor(
    hexToRgb(explicitHex ?? resolveShellBucketHex(bucket)),
    materialClass,
  );
  const surface = resolveShellSurface(materialClass);

  return doc
    .createMaterial(`building-shell-${materialClass}-${explicitHex ?? bucket}`)
    .setBaseColorFactor([r, g, b, 1])
    .setMetallicFactor(surface.metallicFactor)
    .setRoughnessFactor(surface.roughnessFactor);
}

export function createBuildingPanelMaterial(
  doc: any,
  tone: AccentTone,
  hex: string,
) {
  const [r, g, b] = tunePanelColor(hexToRgb(hex), tone);
  const emissiveBoost = tone === 'warm' ? 0.28 : tone === 'cool' ? 0.24 : 0.18;
  return doc
    .createMaterial(`building-panel-${tone}-${hex}`)
    .setBaseColorFactor([r, g, b, 1])
    .setEmissiveFactor([
      Math.min(0.8, r * emissiveBoost),
      Math.min(0.8, g * emissiveBoost),
      Math.min(0.8, b * emissiveBoost),
    ])
    .setMetallicFactor(0)
    .setRoughnessFactor(0.78);
}

export function createBillboardMaterial(
  doc: any,
  tone: AccentTone,
  hex: string,
) {
  const [r, g, b] = tuneBillboardColor(hexToRgb(hex), tone);
  const emissiveBoost = tone === 'warm' ? 0.46 : tone === 'cool' ? 0.42 : 0.3;
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

function resolveShellBucketHex(bucket: ShellColorBucket): string {
  switch (bucket) {
    case 'cool-light':
      return '#8fa7ba';
    case 'cool-mid':
      return '#6f899d';
    case 'neutral-light':
      return '#b8bec5';
    case 'neutral-mid':
      return '#8f98a1';
    case 'neutral-dark':
      return '#626c75';
    case 'warm-light':
      return '#b69681';
    case 'warm-mid':
      return '#8d6c57';
    case 'brick':
      return '#b36a4f';
  }
}

function resolveShellSurface(materialClass: MaterialClass): {
  metallicFactor: number;
  roughnessFactor: number;
} {
  switch (materialClass) {
    case 'glass':
      return { metallicFactor: 0.02, roughnessFactor: 0.16 };
    case 'metal':
      return { metallicFactor: 0.32, roughnessFactor: 0.42 };
    case 'brick':
      return { metallicFactor: 0, roughnessFactor: 0.94 };
    case 'concrete':
      return { metallicFactor: 0, roughnessFactor: 0.88 };
    default:
      return { metallicFactor: 0.04, roughnessFactor: 0.82 };
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '');
  const red = parseInt(normalized.slice(0, 2), 16) / 255;
  const green = parseInt(normalized.slice(2, 4), 16) / 255;
  const blue = parseInt(normalized.slice(4, 6), 16) / 255;
  return [red, green, blue];
}

function tuneShellColor(
  color: [number, number, number],
  materialClass: MaterialClass,
): [number, number, number] {
  const [r, g, b] = compressLuminance(color, 0.62);
  if (materialClass === 'glass') {
    return [
      clamp01(r * 0.9),
      clamp01(g * 0.94),
      clamp01(Math.max(b * 1.02, r * 0.98)),
    ];
  }
  if (materialClass === 'brick') {
    return [clamp01(r * 0.92), clamp01(g * 0.9), clamp01(b * 0.88)];
  }
  return [clamp01(r * 0.94), clamp01(g * 0.94), clamp01(b * 0.94)];
}

function tunePanelColor(
  color: [number, number, number],
  tone: AccentTone,
): [number, number, number] {
  const [r, g, b] = compressLuminance(color, 0.5);
  if (tone === 'cool') {
    return [clamp01(r * 0.88), clamp01(g * 0.92), clamp01(b * 0.98)];
  }
  if (tone === 'warm') {
    return [clamp01(r * 0.96), clamp01(g * 0.88), clamp01(b * 0.84)];
  }
  return [clamp01(r * 0.9), clamp01(g * 0.9), clamp01(b * 0.9)];
}

function tuneBillboardColor(
  color: [number, number, number],
  tone: AccentTone,
): [number, number, number] {
  const [r, g, b] = compressLuminance(color, 0.66);
  if (tone === 'cool') {
    return [clamp01(r * 0.94), clamp01(g * 0.98), clamp01(b)];
  }
  if (tone === 'warm') {
    return [clamp01(r), clamp01(g * 0.92), clamp01(b * 0.9)];
  }
  return [clamp01(r * 0.95), clamp01(g * 0.95), clamp01(b * 0.95)];
}

function compressLuminance(
  color: [number, number, number],
  maxLuminance: number,
): [number, number, number] {
  const [r, g, b] = color;
  const luminance = r * 0.299 + g * 0.587 + b * 0.114;
  if (luminance <= maxLuminance) {
    return color;
  }
  const scale = maxLuminance / Math.max(luminance, 1e-6);
  return [r * scale, g * scale, b * scale];
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
