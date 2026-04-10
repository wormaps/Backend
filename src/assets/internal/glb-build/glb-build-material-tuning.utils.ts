import {
  SceneFacadeHint,
  SceneMeta,
  SceneStaticAtmosphereProfile,
} from '../../../scene/types/scene.types';
import type { MaterialTuningOptions } from '../../compiler/materials';
import { resolveSceneFidelityModeSignal } from '../../../scene/utils/scene-fidelity-mode-signal.utils';
import type { SceneFidelityMode } from '../../../scene/types/scene.types';

export function resolveMaterialTuningFromScene(
  _sceneMeta: SceneMeta,
  facadeHints: SceneFacadeHint[],
  staticAtmosphere?: SceneStaticAtmosphereProfile,
  targetMode?: SceneFidelityMode,
): MaterialTuningOptions {
  const highEmissiveFacadeCount = facadeHints.filter(
    (hint) => hint.emissiveStrength >= 0.7,
  ).length;
  const adaptivePanelCap =
    highEmissiveFacadeCount >= 6
      ? 0.82
      : highEmissiveFacadeCount >= 2
        ? 0.8
        : 0.78;

  const atmosphericEmissiveBoost = staticAtmosphere?.emissiveBoost ?? 1;
  const atmosphericRoadRoughnessScale =
    staticAtmosphere?.roadRoughnessScale ?? 1;
  const atmosphericWetRoadBoost = staticAtmosphere?.wetRoadBoost ?? 0;
  const districtBoost = resolveDistrictEmissiveBoost(facadeHints);
  const districtRoadRoughnessScale =
    resolveDistrictRoadRoughnessScale(facadeHints);
  const modeSignal = resolveSceneFidelityModeSignal(targetMode);
  const weakEvidenceRatio =
    facadeHints.length > 0
      ? facadeHints.filter((hint) => hint.weakEvidence).length /
        facadeHints.length
      : 0;
  const overlayDepthBias = clamp(1.08 + weakEvidenceRatio * 0.7, 0.96, 1.92);

  return {
    shellLuminanceCap: clamp(0.92 + weakEvidenceRatio * 0.05, 0.9, 0.97),
    panelLuminanceCap: clamp(
      adaptivePanelCap + weakEvidenceRatio * 0.06,
      0.78,
      0.9,
    ),
    billboardLuminanceCap: 0.9,
    emissiveBoost: clamp(
      atmosphericEmissiveBoost * districtBoost * modeSignal.emissiveMultiplier,
      0.95,
      1.85,
    ),
    roadRoughnessScale: clamp(
      atmosphericRoadRoughnessScale *
        districtRoadRoughnessScale *
        modeSignal.roadRoughnessMultiplier,
      0.76,
      1.2,
    ),
    wetRoadBoost: clamp(
      atmosphericWetRoadBoost + modeSignal.wetRoadOffset,
      0,
      0.72,
    ),
    overlayDepthBias,
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
