import {
  SceneFacadeHint,
  SceneMeta,
  SceneStaticAtmosphereProfile,
} from '../../../scene/types/scene.types';
import type { MaterialTuningOptions } from '../../compiler/materials';

export function resolveMaterialTuningFromScene(
  _sceneMeta: SceneMeta,
  facadeHints: SceneFacadeHint[],
  staticAtmosphere?: SceneStaticAtmosphereProfile,
): MaterialTuningOptions {
  const highEmissiveFacadeCount = facadeHints.filter(
    (hint) => hint.emissiveStrength >= 0.7,
  ).length;
  const adaptivePanelCap =
    highEmissiveFacadeCount >= 6
      ? 0.74
      : highEmissiveFacadeCount >= 2
        ? 0.7
        : 0.68;

  const atmosphericEmissiveBoost = staticAtmosphere?.emissiveBoost ?? 1;
  const atmosphericRoadRoughnessScale =
    staticAtmosphere?.roadRoughnessScale ?? 1;
  const districtBoost = resolveDistrictEmissiveBoost(facadeHints);
  const districtRoadRoughnessScale =
    resolveDistrictRoadRoughnessScale(facadeHints);

  return {
    shellLuminanceCap: 0.88,
    panelLuminanceCap: adaptivePanelCap,
    billboardLuminanceCap: 0.86,
    emissiveBoost: clamp(atmosphericEmissiveBoost * districtBoost, 0.95, 1.7),
    roadRoughnessScale: clamp(
      atmosphericRoadRoughnessScale * districtRoadRoughnessScale,
      0.76,
      1.2,
    ),
  };
}

function resolveDistrictEmissiveBoost(facadeHints: SceneFacadeHint[]): number {
  if (!facadeHints.length) {
    return 1;
  }
  let nightSignal = 0;
  for (const hint of facadeHints) {
    if (hint.districtCluster === 'nightlife_cluster') {
      nightSignal += 1.45;
    } else if (
      hint.districtCluster === 'core_commercial' ||
      hint.districtCluster === 'tourist_shopping_street'
    ) {
      nightSignal += 1.05;
    } else if (
      hint.districtCluster === 'industrial_lowrise' ||
      hint.districtCluster === 'suburban_detached'
    ) {
      nightSignal -= 0.25;
    }
    if (hint.evidenceStrength === 'strong') {
      nightSignal += 0.18;
    }
  }

  return 1 + nightSignal / (facadeHints.length * 7);
}

function resolveDistrictRoadRoughnessScale(
  facadeHints: SceneFacadeHint[],
): number {
  if (!facadeHints.length) {
    return 1;
  }
  let roughnessSignal = 0;
  for (const hint of facadeHints) {
    if (
      hint.districtCluster === 'riverside_lowrise' ||
      hint.districtCluster === 'coastal_road'
    ) {
      roughnessSignal -= 0.2;
    } else if (
      hint.districtCluster === 'industrial_lowrise' ||
      hint.districtCluster === 'airport_logistics'
    ) {
      roughnessSignal += 0.1;
    }
  }

  return 1 + roughnessSignal / (facadeHints.length * 2.7);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
