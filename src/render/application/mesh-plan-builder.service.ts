import type { MeshPlan } from '../../../packages/contracts/mesh-plan';
import type { MaterialPlan, MeshPlanNode } from '../../../packages/contracts/mesh-plan';
import type { RenderIntentSet } from '../../../packages/contracts/render-intent';
import type { TwinEntity, TwinSceneGraph } from '../../../packages/contracts/twin-scene-graph';
import type { MeshGeometry } from '../../../packages/core/geometry';

export class MeshPlanBuilderService {
  build(graph: TwinSceneGraph, intentSet: RenderIntentSet): MeshPlan {
    const entityById = new Map(graph.entities.map((entity) => [entity.id, entity]));
    const materials = new Map<MaterialPlan['role'], MaterialPlan>();
    const nodes: MeshPlanNode[] = [];

    for (const intent of intentSet.intents) {
      const entity = entityById.get(intent.entityId);
      if (entity === undefined) {
        continue;
      }

      const nodeSpec = this.resolveNodeSpec(entity, intent.visualMode);
      if (nodeSpec === null) {
        continue;
      }

      const material = this.ensureMaterial(materials, nodeSpec.materialRole);
      nodes.push({
        id: `node:${entity.id}`,
        entityId: entity.id,
        name: `${entity.type}:${intent.visualMode}`,
        primitive: nodeSpec.primitive,
        pivot: this.resolvePivot(entity),
        materialId: material.id,
        geometry: this.resolveGeometry(entity),
      });
    }

    return {
      sceneId: intentSet.sceneId,
      renderPolicyVersion: intentSet.policyVersion,
      nodes,
      materials: [...materials.values()],
      budgets: {
        maxGlbBytes: 30_000_000,
        maxTriangleCount: 250_000,
        maxNodeCount: 1_500,
        maxMaterialCount: 32,
      },
    };
  }

  private resolveNodeSpec(
    entity: TwinEntity,
    visualMode: RenderIntentSet['intents'][number]['visualMode'],
  ): { primitive: MeshPlanNode['primitive']; materialRole: MaterialPlan['role'] } | null {
    if (visualMode === 'excluded') {
      return null;
    }

    switch (entity.type) {
      case 'terrain':
        return {
          primitive: 'terrain',
          materialRole: visualMode === 'placeholder' ? 'debug' : 'terrain',
        };
      case 'road':
        return {
          primitive: 'road',
          materialRole: visualMode === 'placeholder' ? 'debug' : 'road',
        };
      case 'traffic_flow':
        return {
          primitive: 'road',
          materialRole: visualMode === 'traffic_overlay' ? 'debug' : 'road',
        };
      case 'walkway':
        return {
          primitive: 'walkway',
          materialRole: visualMode === 'placeholder' ? 'debug' : 'road',
        };
      case 'building':
        return {
          primitive: 'building_massing',
          materialRole: visualMode === 'placeholder' ? 'debug' : 'building',
        };
      case 'poi':
      default:
        return {
          primitive: 'poi_marker',
          materialRole: visualMode === 'placeholder' ? 'debug' : 'poi',
        };
    }
  }

  private ensureMaterial(
    materials: Map<MaterialPlan['role'], MaterialPlan>,
    role: MaterialPlan['role'],
  ): MaterialPlan {
    const existing = materials.get(role);
    if (existing !== undefined) {
      return existing;
    }

    const created = {
      id: `material:${role}`,
      name: role,
      role,
    } satisfies MaterialPlan;
    materials.set(role, created);
    return created;
  }

  private resolvePivot(entity: TwinEntity): MeshPlanNode['pivot'] {
    switch (entity.type) {
      case 'building': {
        const vertex = entity.geometry.footprint.outer[0];
        return {
          x: vertex?.x ?? 0,
          y: entity.geometry.baseY ?? 0,
          z: vertex?.z ?? 0,
        };
      }
      case 'road':
      case 'walkway':
      case 'traffic_flow': {
        const point = entity.geometry.centerline[0];
        return {
          x: point?.x ?? 0,
          y: point?.y ?? 0,
          z: point?.z ?? 0,
        };
      }
      case 'terrain': {
        const sample = entity.geometry.samples[0];
        return {
          x: sample?.x ?? 0,
          y: sample?.y ?? 0,
          z: sample?.z ?? 0,
        };
      }
      case 'poi':
      default:
        return entity.geometry.point;
    }
  }

  private resolveGeometry(entity: TwinEntity): MeshGeometry | undefined {
    switch (entity.type) {
      case 'building':
        return { kind: 'building', ...entity.geometry };
      case 'road':
      case 'traffic_flow':
        return { kind: 'road', ...entity.geometry };
      case 'walkway':
        return { kind: 'walkway', ...entity.geometry };
      case 'terrain':
        return { kind: 'terrain', ...entity.geometry };
      case 'poi':
      default:
        return { kind: 'poi', ...entity.geometry };
    }
  }
}
