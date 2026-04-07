import { FacadeLayerMaterialProfile } from '../../compiler/materials';
import { SceneDetail, SceneMeta } from '../../../scene/types/scene.types';

export function resolveFacadeLayerMaterialProfile(
  sceneMeta: SceneMeta,
  sceneDetail: SceneDetail,
): FacadeLayerMaterialProfile {
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
  const sample = palette.find(Boolean)?.toLowerCase();
  if (!sample) {
    return 'orange';
  }
  if (sample.includes('ff') || sample.startsWith('#ff')) {
    return 'red';
  }
  if (sample.includes('00ff') || sample.includes('00fa')) {
    return 'green';
  }
  if (sample.includes('00ccff') || sample.includes('33aaff')) {
    return 'cyan';
  }
  if (sample.includes('66') && sample.includes('ff')) {
    return 'blue';
  }
  return 'orange';
}
