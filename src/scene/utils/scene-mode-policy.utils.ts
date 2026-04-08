import type { SceneFidelityMode } from '../types/scene.types';

export type SceneModePolicyId =
  | 'procedural_only'
  | 'enriched'
  | 'overlay_ready'
  | 'hero'
  | 'showcase';

export interface SceneModePolicy {
  id: SceneModePolicyId;
  stage: {
    includeRoadDecal: boolean;
    includeEmissiveBillboard: boolean;
    includeHeroBuilding: boolean;
    includeMinorFurniture: boolean;
    includeLandmarkExtras: boolean;
  };
  density: {
    furniture: 'low' | 'medium' | 'high';
  };
  materialLevel: 'base' | 'enhanced' | 'showcase';
  weatherLighting: 'base' | 'adaptive' | 'cinematic';
}

export const MODE_POLICY_MATRIX: Record<SceneModePolicyId, SceneModePolicy> = {
  procedural_only: {
    id: 'procedural_only',
    stage: {
      includeRoadDecal: false,
      includeEmissiveBillboard: false,
      includeHeroBuilding: false,
      includeMinorFurniture: false,
      includeLandmarkExtras: false,
    },
    density: {
      furniture: 'low',
    },
    materialLevel: 'base',
    weatherLighting: 'base',
  },
  enriched: {
    id: 'enriched',
    stage: {
      includeRoadDecal: true,
      includeEmissiveBillboard: false,
      includeHeroBuilding: false,
      includeMinorFurniture: true,
      includeLandmarkExtras: false,
    },
    density: {
      furniture: 'medium',
    },
    materialLevel: 'enhanced',
    weatherLighting: 'adaptive',
  },
  overlay_ready: {
    id: 'overlay_ready',
    stage: {
      includeRoadDecal: true,
      includeEmissiveBillboard: true,
      includeHeroBuilding: true,
      includeMinorFurniture: true,
      includeLandmarkExtras: true,
    },
    density: {
      furniture: 'medium',
    },
    materialLevel: 'enhanced',
    weatherLighting: 'adaptive',
  },
  hero: {
    id: 'hero',
    stage: {
      includeRoadDecal: true,
      includeEmissiveBillboard: true,
      includeHeroBuilding: true,
      includeMinorFurniture: true,
      includeLandmarkExtras: true,
    },
    density: {
      furniture: 'high',
    },
    materialLevel: 'showcase',
    weatherLighting: 'cinematic',
  },
  showcase: {
    id: 'showcase',
    stage: {
      includeRoadDecal: true,
      includeEmissiveBillboard: true,
      includeHeroBuilding: true,
      includeMinorFurniture: true,
      includeLandmarkExtras: true,
    },
    density: {
      furniture: 'high',
    },
    materialLevel: 'showcase',
    weatherLighting: 'cinematic',
  },
};

export function resolveSceneModePolicy(
  targetMode?: SceneFidelityMode,
  currentMode?: SceneFidelityMode,
): SceneModePolicy {
  if (targetMode === 'PROCEDURAL_ONLY') {
    return MODE_POLICY_MATRIX.procedural_only;
  }
  if (targetMode === 'REALITY_OVERLAY_READY') {
    return MODE_POLICY_MATRIX.overlay_ready;
  }
  if (targetMode === 'LANDMARK_ENRICHED') {
    return MODE_POLICY_MATRIX.hero;
  }
  if (targetMode === 'MATERIAL_ENRICHED') {
    return MODE_POLICY_MATRIX.enriched;
  }
  if (currentMode === 'LANDMARK_ENRICHED') {
    return MODE_POLICY_MATRIX.hero;
  }
  if (currentMode === 'MATERIAL_ENRICHED') {
    return MODE_POLICY_MATRIX.enriched;
  }
  return MODE_POLICY_MATRIX.procedural_only;
}

export function resolveFurnitureDensityScale(
  density: SceneModePolicy['density']['furniture'],
): number {
  if (density === 'high') {
    return 1;
  }
  if (density === 'medium') {
    return 0.72;
  }
  return 0.42;
}
