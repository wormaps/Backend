import type { MaterialClass } from '../../scene/types/scene.types';

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

export function createSceneMaterials(doc: any) {
  return {
    ground: doc
      .createMaterial('ground')
      .setBaseColorFactor([0.82, 0.82, 0.8, 1])
      .setMetallicFactor(0)
      .setRoughnessFactor(1),
    roadBase: doc
      .createMaterial('road-base')
      .setBaseColorFactor([0.28, 0.29, 0.31, 1])
      .setMetallicFactor(0)
      .setRoughnessFactor(1),
    roadMarking: doc
      .createMaterial('road-marking')
      .setBaseColorFactor([0.95, 0.94, 0.78, 1])
      .setMetallicFactor(0)
      .setRoughnessFactor(0.68),
    laneOverlay: doc
      .createMaterial('lane-overlay')
      .setBaseColorFactor([0.96, 0.94, 0.72, 1])
      .setMetallicFactor(0)
      .setRoughnessFactor(0.62),
    crosswalk: doc
      .createMaterial('crosswalk')
      .setBaseColorFactor([0.97, 0.97, 0.97, 1])
      .setMetallicFactor(0)
      .setRoughnessFactor(0.82),
    junctionOverlay: doc
      .createMaterial('junction-overlay')
      .setBaseColorFactor([0.94, 0.84, 0.42, 1])
      .setEmissiveFactor([0.08, 0.06, 0.02])
      .setMetallicFactor(0)
      .setRoughnessFactor(0.74),
    sidewalk: doc
      .createMaterial('sidewalk')
      .setBaseColorFactor([0.78, 0.78, 0.76, 1])
      .setMetallicFactor(0)
      .setRoughnessFactor(1),
    trafficLight: doc
      .createMaterial('traffic-light')
      .setBaseColorFactor([0.18, 0.19, 0.2, 1])
      .setEmissiveFactor([0.22, 0.05, 0.02])
      .setMetallicFactor(0)
      .setRoughnessFactor(0.9),
    streetLight: doc
      .createMaterial('street-light')
      .setBaseColorFactor([0.45, 0.46, 0.48, 1])
      .setEmissiveFactor([0.15, 0.12, 0.05])
      .setMetallicFactor(0)
      .setRoughnessFactor(0.7),
    signPole: doc
      .createMaterial('sign-pole')
      .setBaseColorFactor([0.52, 0.55, 0.58, 1])
      .setMetallicFactor(0)
      .setRoughnessFactor(0.7),
    tree: doc
      .createMaterial('tree')
      .setBaseColorFactor([0.28, 0.47, 0.27, 1])
      .setMetallicFactor(0)
      .setRoughnessFactor(1),
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
        .setBaseColorFactor([0.63, 0.8, 0.96, 1])
        .setMetallicFactor(0)
        .setRoughnessFactor(0.58),
      warm: doc
        .createMaterial('roof-accent-warm')
        .setBaseColorFactor([0.94, 0.66, 0.44, 1])
        .setMetallicFactor(0)
        .setRoughnessFactor(0.62),
      neutral: doc
        .createMaterial('roof-accent-neutral')
        .setBaseColorFactor([0.78, 0.8, 0.83, 1])
        .setMetallicFactor(0)
        .setRoughnessFactor(0.6),
    } as Record<AccentTone, any>,
    buildingPanels: {
      cool: doc
        .createMaterial('building-panel-cool')
        .setBaseColorFactor([0.32, 0.48, 0.66, 1])
        .setEmissiveFactor([0.12, 0.18, 0.25])
        .setMetallicFactor(0)
        .setRoughnessFactor(0.72),
      warm: doc
        .createMaterial('building-panel-warm')
        .setBaseColorFactor([0.74, 0.45, 0.26, 1])
        .setEmissiveFactor([0.26, 0.13, 0.06])
        .setMetallicFactor(0)
        .setRoughnessFactor(0.7),
      neutral: doc
        .createMaterial('building-panel-neutral')
        .setBaseColorFactor([0.42, 0.45, 0.5, 1])
        .setEmissiveFactor([0.14, 0.14, 0.16])
        .setMetallicFactor(0)
        .setRoughnessFactor(0.76),
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
        .setBaseColorFactor([0.85, 0.85, 0.88, 1])
        .setEmissiveFactor([0.28, 0.28, 0.3])
        .setMetallicFactor(0)
        .setRoughnessFactor(0.66),
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
) {
  const [r, g, b] = hexToRgb(resolveShellBucketHex(bucket));
  const surface = resolveShellSurface(materialClass);

  return doc
    .createMaterial(`building-shell-${materialClass}-${bucket}`)
    .setBaseColorFactor([r, g, b, 1])
    .setMetallicFactor(surface.metallicFactor)
    .setRoughnessFactor(surface.roughnessFactor);
}

function resolveShellBucketHex(bucket: ShellColorBucket): string {
  switch (bucket) {
    case 'cool-light':
      return '#d7ebf7';
    case 'cool-mid':
      return '#a8d0ec';
    case 'neutral-light':
      return '#eceef0';
    case 'neutral-mid':
      return '#cfd5db';
    case 'neutral-dark':
      return '#9aa3ab';
    case 'warm-light':
      return '#ecd8c8';
    case 'warm-mid':
      return '#d5ab8f';
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
