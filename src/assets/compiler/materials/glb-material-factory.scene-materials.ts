import type { LandCoverData } from '../../../places/types/place.types';
import type {
  AccentTone,
  FacadeLayerMaterialProfile,
  GlbMaterialDocument,
  MaterialTuningOptions,
  SceneMaterials,
} from './glb-material-factory.scene';
import { resolveGroundMaterialProfile } from './ground-material-profile.utils';
import {
  applySurfaceBias,
  applyTextureSlotIfAvailable,
  applyWetOverlay,
  applyWetRoad,
  clampRange,
  resolveMaterialTuningOptions,
  resolveOverlayDepthBias,
  resolveTextureDiagnostics,
  scaleEmissive,
  scaleRoughness,
} from './glb-material-factory.scene.utils';

export function createSceneMaterials(
  doc: GlbMaterialDocument,
  tuningOptions: MaterialTuningOptions = {},
  landCovers: LandCoverData[] = [],
): SceneMaterials {
  const tuning = resolveMaterialTuningOptions(tuningOptions);
  const overlayBias = resolveOverlayDepthBias(tuning.overlayDepthBias);
  const overlayCutoff = clampRange(0.022 / overlayBias, 0.008, 0.03);
  const textureDiagnostics = resolveTextureDiagnostics(tuning);

  const groundProfile = resolveGroundMaterialProfile(landCovers);
  const ground = doc
    .createMaterial('ground')
    .setBaseColorFactor(groundProfile.baseColor)
    .setMetallicFactor(groundProfile.metallic)
    .setRoughnessFactor(groundProfile.roughness);
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
      .setAlphaMode('BLEND')
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
