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

  return {
    shellLuminanceCap: 0.82,
    panelLuminanceCap: adaptivePanelCap,
    billboardLuminanceCap: 0.78,
    emissiveBoost: atmosphericEmissiveBoost,
    roadRoughnessScale: atmosphericRoadRoughnessScale,
  };
}
