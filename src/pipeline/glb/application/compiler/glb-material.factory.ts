import type { Document } from '@gltf-transform/core';

import type { MaterialPlan } from '../../../../shared/contracts';

export function createMaterialNodeMap(
  document: Document,
  materials: readonly MaterialPlan[],
): Map<string, ReturnType<Document['createMaterial']>> {
  const materialNodeMap = new Map<string, ReturnType<Document['createMaterial']>>();

  for (const materialPlan of materials) {
    const material = document.createMaterial(materialPlan.name);
    material.setDoubleSided(materialPlan.role === 'debug');

    if (materialPlan.baseColor !== undefined) {
      const [r, g, b] = materialPlan.baseColor;
      material.setBaseColorFactor([r, g, b, 1.0]);
    }

    if (materialPlan.role === 'window') {
      material.setDoubleSided(true);
      material.setBaseColorFactor([0.06, 0.09, 0.14, 1.0]);
      material.setMetallicFactor(0.85);
      material.setRoughnessFactor(0.08);
    }

    if (materialPlan.role === 'terrain') {
      material.setBaseColorFactor([0.072, 0.11, 0.045, 1.0]);
      material.setMetallicFactor(0.0);
      material.setRoughnessFactor(0.95);
    }

    const roadColors: Record<string, [number, number, number, number]> = {
      road_motorway: [0.35, 0.35, 0.365, 1.0],
      road_primary: [0.29, 0.29, 0.3, 1.0],
      road_secondary: [0.23, 0.23, 0.24, 1.0],
      road_tertiary: [0.195, 0.195, 0.202, 1.0],
      road_residential: [0.165, 0.165, 0.172, 1.0],
      road_service: [0.135, 0.135, 0.14, 1.0],
      road_footway: [0.48, 0.455, 0.42, 1.0],
    };

    const roadColor = roadColors[materialPlan.role];
    if (roadColor !== undefined) {
      material.setBaseColorFactor(roadColor);
      material.setMetallicFactor(0.0);
      material.setRoughnessFactor(0.9);
    }

    materialNodeMap.set(materialPlan.id, material);
  }

  return materialNodeMap;
}
