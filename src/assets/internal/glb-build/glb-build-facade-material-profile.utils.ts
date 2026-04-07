import { FacadeLayerMaterialProfile } from '../../compiler/materials';
import {
  DistrictAtmosphereProfile,
  FacadePattern,
  LightingAtmosphereProfile,
  MaterialFamily,
  MaterialVariant,
  SceneDetail,
  SceneMeta,
  SceneWideAtmosphereProfile,
  WindowPatternDensity,
} from '../../../scene/types/scene.types';

export function resolveFacadeLayerMaterialProfile(
  sceneMeta: SceneMeta,
  sceneDetail: SceneDetail,
): FacadeLayerMaterialProfile {
  const sceneWide = sceneDetail.sceneWideAtmosphereProfile;
  const districtPrimary = sceneDetail.districtAtmosphereProfiles?.[0];
  const baseProfile =
    sceneWide || districtPrimary
      ? resolveAtmosphereBaseProfile(sceneWide, districtPrimary)
      : null;

  const hints = sceneDetail.facadeHints;
  if (!hints.length) {
    return {
      facadeFamily: 'concrete',
      facadeVariant: 'mid',
      shellSurfaceBias: 'balanced',
      panelSurfaceBias: 'balanced',
      panelEmissiveBoost: 1,
      windowType: 'reflective',
      entranceSurface: 'concrete',
      roofEquipmentSurface: 'metal',
      heroCanopyLight: 'accent_spot',
      heroBillboardTone: 'orange',
      ...baseProfile,
    };
  }

  const materialClassCounts = new Map<string, number>();
  const facadePresetCounts = new Map<string, number>();
  const windowDensityCounts = new Map<string, number>();
  let glazingAccumulator = 0;
  let denseSignageCount = 0;
  let emissiveAccumulator = 0;

  for (const hint of hints) {
    materialClassCounts.set(
      hint.materialClass,
      (materialClassCounts.get(hint.materialClass) ?? 0) + 1,
    );
    if (hint.facadePreset) {
      facadePresetCounts.set(
        hint.facadePreset,
        (facadePresetCounts.get(hint.facadePreset) ?? 0) + 1,
      );
    }
    if (hint.windowPatternDensity) {
      windowDensityCounts.set(
        hint.windowPatternDensity,
        (windowDensityCounts.get(hint.windowPatternDensity) ?? 0) + 1,
      );
    }
    glazingAccumulator += hint.glazingRatio;
    emissiveAccumulator += hint.emissiveStrength;
    if (hint.signageDensity === 'high') {
      denseSignageCount += 1;
    }
  }

  const dominantMaterialClass = resolveDominantKey(materialClassCounts);
  const dominantFacadePreset = resolveDominantKey(facadePresetCounts);
  const dominantWindowDensity = resolveDominantKey(windowDensityCounts);
  const averageGlazing = glazingAccumulator / hints.length;
  const averageEmissive = emissiveAccumulator / hints.length;
  const signageRatio = denseSignageCount / hints.length;

  return {
    ...baseProfile,
    facadeFamily: resolveFacadeFamily(
      dominantMaterialClass,
      dominantFacadePreset,
    ),
    facadeVariant: resolveFacadeVariant(sceneMeta, dominantMaterialClass),
    shellSurfaceBias: resolveShellSurfaceBias(dominantMaterialClass),
    panelSurfaceBias: resolvePanelSurfaceBias(dominantFacadePreset),
    panelEmissiveBoost: resolvePanelEmissiveBoost(
      averageEmissive,
      signageRatio,
    ),
    windowType: resolveWindowType(averageGlazing, dominantWindowDensity),
    entranceSurface: resolveEntranceSurface(dominantFacadePreset),
    roofEquipmentSurface: resolveRoofEquipmentSurface(dominantMaterialClass),
    heroCanopyLight: signageRatio >= 0.35 ? 'flood_light' : 'accent_spot',
    heroBillboardTone: resolveHeroBillboardTone(sceneDetail),
  };
}

function resolveAtmosphereBaseProfile(
  sceneWide: SceneWideAtmosphereProfile | undefined,
  districtPrimary: DistrictAtmosphereProfile | undefined,
): FacadeLayerMaterialProfile {
  const source = districtPrimary?.facadeProfile ?? sceneWide?.baseFacadeProfile;
  if (!source) {
    return {};
  }

  return {
    facadeFamily: mapMaterialFamily(source.family),
    facadeVariant: mapMaterialVariant(source.variant),
    shellSurfaceBias: mapShellSurfaceBias(source.family),
    panelSurfaceBias: mapPanelSurfaceBias(source.pattern),
    panelEmissiveBoost: clamp(source.emissiveBoost ?? 1, 0.75, 1.45),
    windowType: mapWindowType(source.windowDensity),
    entranceSurface: mapEntranceSurface(source.family),
    roofEquipmentSurface:
      source.roofEquipmentIntensity === 'high' ? 'metal' : 'concrete',
    heroCanopyLight: mapHeroCanopyLight(source.lightingStyle),
    heroBillboardTone: mapHeroBillboardTone(source.signDensity),
  };
}

function mapMaterialFamily(
  family: MaterialFamily,
): FacadeLayerMaterialProfile['facadeFamily'] {
  if (family === 'glass') return 'glass';
  if (family === 'metal') return 'metal';
  if (family === 'brick') return 'brick';
  if (family === 'concrete') return 'concrete';
  if (family === 'panel') return 'modern_glass';
  return 'concrete';
}

function mapMaterialVariant(
  variant: MaterialVariant,
): FacadeLayerMaterialProfile['facadeVariant'] {
  if (
    variant.includes('dark') ||
    variant === 'metal_industrial_dark' ||
    variant === 'concrete_old_gray'
  ) {
    return 'dark';
  }
  if (
    variant.includes('light') ||
    variant.includes('white') ||
    variant.includes('beige')
  ) {
    return 'light';
  }
  return 'mid';
}

function mapShellSurfaceBias(
  family: MaterialFamily,
): FacadeLayerMaterialProfile['shellSurfaceBias'] {
  if (family === 'glass' || family === 'metal' || family === 'panel') {
    return 'glossy';
  }
  if (family === 'brick' || family === 'plaster' || family === 'stone') {
    return 'matte';
  }
  return 'balanced';
}

function mapPanelSurfaceBias(
  pattern: FacadePattern,
): FacadeLayerMaterialProfile['panelSurfaceBias'] {
  if (
    pattern === 'curtain_wall' ||
    pattern === 'vertical_mullion' ||
    pattern === 'shopping_arcade'
  ) {
    return 'glossy';
  }
  if (
    pattern === 'industrial_panel' ||
    pattern === 'warehouse_siding' ||
    pattern === 'blank_wall_heavy'
  ) {
    return 'matte';
  }
  return 'balanced';
}

function mapWindowType(
  windowDensity: WindowPatternDensity | undefined,
): FacadeLayerMaterialProfile['windowType'] {
  if (windowDensity === 'dense') {
    return 'curtain_wall';
  }
  if (windowDensity === 'medium') {
    return 'reflective';
  }
  return 'tinted';
}

function mapEntranceSurface(
  family: MaterialFamily,
): FacadeLayerMaterialProfile['entranceSurface'] {
  if (family === 'glass' || family === 'panel') {
    return 'glass';
  }
  if (family === 'metal') {
    return 'metal';
  }
  return 'concrete';
}

function mapHeroCanopyLight(
  lighting: LightingAtmosphereProfile | undefined,
): FacadeLayerMaterialProfile['heroCanopyLight'] {
  if (lighting === 'nightlife_emissive' || lighting === 'neon_night') {
    return 'flood_light';
  }
  if (lighting === 'luxury_warm' || lighting === 'warm_evening') {
    return 'warm_interior';
  }
  if (lighting === 'industrial_cold') {
    return 'cool_interior';
  }
  return 'accent_spot';
}

function mapHeroBillboardTone(
  signDensity: 'low' | 'medium' | 'high' | undefined,
): FacadeLayerMaterialProfile['heroBillboardTone'] {
  if (signDensity === 'high') {
    return 'pink';
  }
  if (signDensity === 'medium') {
    return 'orange';
  }
  return 'white';
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function resolveDominantKey(counter: Map<string, number>): string | undefined {
  let topKey: string | undefined;
  let topCount = -1;
  for (const [key, count] of counter.entries()) {
    if (count > topCount) {
      topKey = key;
      topCount = count;
    }
  }
  return topKey;
}

function resolveFacadeFamily(
  dominantMaterialClass?: string,
  dominantFacadePreset?: string,
): FacadeLayerMaterialProfile['facadeFamily'] {
  if (dominantFacadePreset === 'glass_grid') {
    return 'modern_glass';
  }
  if (dominantMaterialClass === 'glass') {
    return 'glass';
  }
  if (dominantMaterialClass === 'metal') {
    return 'metal';
  }
  if (dominantMaterialClass === 'brick') {
    return 'brick';
  }
  return 'concrete';
}

function resolveFacadeVariant(
  sceneMeta: SceneMeta,
  dominantMaterialClass?: string,
): FacadeLayerMaterialProfile['facadeVariant'] {
  const structuralCoverage =
    sceneMeta.structuralCoverage?.footprintPreservationRate ?? 0;
  if (dominantMaterialClass === 'glass') {
    return structuralCoverage >= 0.6 ? 'mid' : 'dark';
  }
  if (dominantMaterialClass === 'brick') {
    return 'dark';
  }
  return structuralCoverage >= 0.75 ? 'light' : 'mid';
}

function resolveShellSurfaceBias(
  dominantMaterialClass?: string,
): FacadeLayerMaterialProfile['shellSurfaceBias'] {
  if (dominantMaterialClass === 'glass') {
    return 'glossy';
  }
  if (dominantMaterialClass === 'brick') {
    return 'matte';
  }
  return 'balanced';
}

function resolvePanelSurfaceBias(
  dominantFacadePreset?: string,
): FacadeLayerMaterialProfile['panelSurfaceBias'] {
  if (dominantFacadePreset === 'glass_grid') {
    return 'glossy';
  }
  if (dominantFacadePreset === 'brick_lowrise') {
    return 'matte';
  }
  return 'balanced';
}

function resolvePanelEmissiveBoost(
  averageEmissive: number,
  signageRatio: number,
): number {
  const emissiveBase = averageEmissive >= 0.65 ? 1.08 : 0.92;
  const signageBoost = signageRatio >= 0.25 ? 1.12 : 1;
  return Math.max(0.8, Math.min(1.35, emissiveBase * signageBoost));
}

function resolveWindowType(
  averageGlazing: number,
  dominantWindowDensity?: string,
): FacadeLayerMaterialProfile['windowType'] {
  if (averageGlazing >= 0.62 || dominantWindowDensity === 'dense') {
    return 'curtain_wall';
  }
  if (averageGlazing >= 0.46) {
    return 'reflective';
  }
  if (averageGlazing >= 0.32) {
    return 'tinted';
  }
  return 'clear';
}

function resolveEntranceSurface(
  dominantFacadePreset?: string,
): FacadeLayerMaterialProfile['entranceSurface'] {
  if (dominantFacadePreset === 'station_metal') {
    return 'metal';
  }
  if (dominantFacadePreset === 'glass_grid') {
    return 'glass';
  }
  return 'concrete';
}

function resolveRoofEquipmentSurface(
  dominantMaterialClass?: string,
): FacadeLayerMaterialProfile['roofEquipmentSurface'] {
  if (dominantMaterialClass === 'metal' || dominantMaterialClass === 'glass') {
    return 'metal';
  }
  return 'concrete';
}

function resolveHeroBillboardTone(
  sceneDetail: SceneDetail,
): FacadeLayerMaterialProfile['heroBillboardTone'] {
  const palette = sceneDetail.signageClusters.flatMap(
    (cluster) => cluster.palette,
  );
  const sample = palette.find(Boolean);
  if (!sample) {
    return 'orange';
  }

  const rgb = hexToRgb(sample);
  if (!rgb) {
    return 'orange';
  }

  const [r, g, b] = rgb;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  if (delta < 0.08 && max > 0.82) {
    return 'white';
  }
  if (delta < 0.08) {
    return 'orange';
  }

  const hue = resolveHue(r, g, b, max, delta);
  if (hue < 22 || hue >= 338) {
    return 'red';
  }
  if (hue < 52) {
    return 'orange';
  }
  if (hue < 78) {
    return 'yellow';
  }
  if (hue < 162) {
    return 'green';
  }
  if (hue < 200) {
    return 'cyan';
  }
  if (hue < 255) {
    return 'blue';
  }
  if (hue < 300) {
    return 'purple';
  }
  if (hue < 338) {
    return 'pink';
  }
  return 'orange';
}

function hexToRgb(hex: string): [number, number, number] | null {
  const raw = hex.replace('#', '').trim();
  const normalized =
    raw.length === 3
      ? raw
          .split('')
          .map((digit) => `${digit}${digit}`)
          .join('')
      : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return null;
  }
  return [
    Number.parseInt(normalized.slice(0, 2), 16) / 255,
    Number.parseInt(normalized.slice(2, 4), 16) / 255,
    Number.parseInt(normalized.slice(4, 6), 16) / 255,
  ];
}

function resolveHue(
  r: number,
  g: number,
  b: number,
  max: number,
  delta: number,
): number {
  if (delta === 0) {
    return 0;
  }
  let hue = 0;
  if (max === r) {
    hue = ((g - b) / delta) % 6;
  } else if (max === g) {
    hue = (b - r) / delta + 2;
  } else {
    hue = (r - g) / delta + 4;
  }
  const degree = hue * 60;
  return degree < 0 ? degree + 360 : degree;
}
