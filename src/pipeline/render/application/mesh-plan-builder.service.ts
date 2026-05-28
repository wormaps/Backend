import { Injectable, Logger } from '@nestjs/common';
import type { MeshPlan } from '../../../shared/contracts';
import type { MaterialPlan, MeshPlanNode } from '../../../shared/contracts';
import type { RenderIntentSet } from '../../../shared/contracts';
import type { TwinEntity, TwinSceneGraph } from '../../../shared/contracts';
import type { MeshGeometry } from '../../../shared/core';

@Injectable()
export class MeshPlanBuilderService {
  private readonly logger = new Logger(MeshPlanBuilderService.name);

  build(graph: TwinSceneGraph, intentSet: RenderIntentSet): MeshPlan {
    this.logger.debug(`Building mesh plan intents=${intentSet.intents.length}`);
    const entityById = new Map(graph.entities.map((entity) => [entity.id, entity]));
    const materials = new Map<string, MaterialPlan>();
    const nodes: MeshPlanNode[] = [];

    for (const intent of intentSet.intents) {
      const entity = entityById.get(intent.entityId);
      if (entity === undefined) continue;
      nodes.push(...this.resolveNodes(entity, intent, materials));
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
        maxMaterialCount: 64,
      },
    };
  }

  private resolveNodes(
    entity: TwinEntity,
    intent: RenderIntentSet['intents'][number],
    materials: Map<string, MaterialPlan>,
  ): MeshPlanNode[] {
    const nodeSpec = this.resolveNodeSpec(entity, intent.visualMode);
    if (nodeSpec === null) return [];

    const material = this.ensureMaterial(materials, nodeSpec.materialRole, entity);
    const bodyId = `node:${entity.id}`;
    const bodyNode: MeshPlanNode = {
      id: bodyId,
      entityId: entity.id,
      name: `${entity.type}:${intent.visualMode}`,
      primitive: nodeSpec.primitive,
      pivot: this.resolvePivot(entity),
      materialId: material.id,
      geometry: this.resolveGeometry(entity),
    };

    const result: MeshPlanNode[] = [bodyNode];

    // Add glass window node as child of building body node.
    // Minimum height: BOTTOM_MARGIN(0.8) + WIN_HEIGHT(1.4) + roof_clearance(0.3) = 2.5 m.
    // Skip window node for very short buildings — avoids placeholder glass artifact.
    const buildingHeight = entity.type === 'building' ? (entity.geometry.height ?? 5) : 0;
    if (entity.type === 'building' && nodeSpec.primitive === 'building_massing' && buildingHeight >= 2.5) {
      const windowMaterial = this.ensureMaterial(materials, 'window', entity);
      result.push({
        id: `window:${entity.id}`,
        entityId: entity.id,
        parentId: bodyId,
        name: `building:windows:${entity.id.slice(-6)}`,
        primitive: 'building_windows',
        pivot: { x: 0, y: 0, z: 0 }, // child node — vertices in world ENU coords, no additional translation
        materialId: windowMaterial.id,
        geometry: this.resolveGeometry(entity),
      });
    }

    return result;
  }

  private resolveNodeSpec(
    entity: TwinEntity,
    visualMode: RenderIntentSet['intents'][number]['visualMode'],
  ): { primitive: MeshPlanNode['primitive']; materialRole: MaterialPlan['role'] } | null {
    if (visualMode === 'excluded') return null;

    switch (entity.type) {
      case 'terrain':
        return {
          primitive: 'terrain',
          materialRole: visualMode === 'placeholder' ? 'debug' : 'terrain',
        };
      case 'road': {
        if (visualMode === 'placeholder') return { primitive: 'road', materialRole: 'debug' };
        const hwType = this.extractHighwayType(entity.tags);
        return { primitive: 'road', materialRole: `road_${hwType}` as MaterialPlan['role'] };
      }
      case 'traffic_flow':
        return {
          primitive: 'road',
          materialRole: visualMode === 'traffic_overlay' ? 'debug' : 'road_residential',
        };
      case 'walkway':
        return {
          primitive: 'walkway',
          materialRole: visualMode === 'placeholder' ? 'debug' : 'road_footway',
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
    materials: Map<string, MaterialPlan>,
    role: MaterialPlan['role'],
    entity: TwinEntity,
  ): MaterialPlan {
    // Buildings get per-entity color from entity ID + OSM building type.
    // All other roles share a single material per role.
    const key = role === 'building' ? `building:${entity.id}` : `role:${role}`;
    const existing = materials.get(key);
    if (existing !== undefined) return existing;

    const baseColor =
      role === 'building'
        ? this.deriveBuildingColor(entity.id, entity.tags)
        : undefined;

    const created: MaterialPlan = {
      id: `material:${key}`,
      name: role === 'building' ? `building:${entity.id.slice(-6)}` : role,
      role,
      baseColor,
    };
    materials.set(key, created);
    return created;
  }

  private extractHighwayType(tags: string[]): string {
    const prefix = 'osm:highway=';
    const tag = tags.find((t) => t.startsWith(prefix));
    if (!tag) return 'residential';
    const type = tag.slice(prefix.length);
    // Collapse link variants and minor roads into groups.
    if (type === 'motorway' || type === 'motorway_link') return 'motorway';
    if (type === 'trunk' || type === 'trunk_link') return 'primary';
    if (type === 'primary' || type === 'primary_link') return 'primary';
    if (type === 'secondary' || type === 'secondary_link') return 'secondary';
    if (type === 'tertiary' || type === 'tertiary_link') return 'tertiary';
    if (type === 'footway' || type === 'path' || type === 'cycleway' || type === 'pedestrian') return 'footway';
    if (type === 'service') return 'service';
    return 'residential';
  }

  /** Floor-tier + entity-ID seeded color. Linear sRGB output. */
  private deriveBuildingColor(entityId: string, tags: string[]): [number, number, number] {
    // Extract floor count from V-World/OSM tags for tier classification.
    const levelsTag = tags.find((t) => t.startsWith('osm:building:levels='));
    const floors = levelsTag ? parseInt(levelsTag.slice('osm:building:levels='.length), 10) : 0;

    let hash = 0;
    for (let i = 0; i < entityId.length; i++) {
      hash = Math.imul(31, hash) + entityId.charCodeAt(i);
    }
    const norm = (Math.abs(hash) % 1000) / 1000;

    let baseHue: number;
    let baseSat: number;
    let baseLight: number;

    if (floors >= 20) {
      // High-rise tower: blue-gray glass curtain wall
      baseHue = 0.58; baseSat = 0.14; baseLight = 0.50 + norm * 0.12;
    } else if (floors >= 10) {
      // Mid-high-rise: concrete + glass mix (cool gray)
      baseHue = 0.56 + norm * 0.08; baseSat = 0.10; baseLight = 0.46 + norm * 0.14;
    } else if (floors >= 5) {
      // Mid-rise: concrete / render plaster (warm neutral)
      baseHue = 0.08 + (norm - 0.5) * 0.12; baseSat = 0.14; baseLight = 0.44 + norm * 0.16;
    } else if (floors >= 2) {
      // Low-rise: brick / terracotta
      baseHue = 0.05 + (norm - 0.5) * 0.10; baseSat = 0.28 + norm * 0.12; baseLight = 0.40 + norm * 0.14;
    } else {
      // Unknown / 1F: vary widely (mix of uses)
      baseHue = (norm * 0.30 + 0.04) % 1; baseSat = 0.20 + norm * 0.14; baseLight = 0.40 + norm * 0.18;
    }

    const hue = ((baseHue) % 1 + 1) % 1;
    return this.hslToLinearRgb(hue, baseSat, baseLight);
  }

  private hslToLinearRgb(h: number, s: number, l: number): [number, number, number] {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const hp = ((h % 1 + 1) % 1) * 6;
    const x = c * (1 - Math.abs((hp % 2) - 1));
    let r = 0;
    let g = 0;
    let b = 0;
    if (hp < 1) { r = c; g = x; }
    else if (hp < 2) { r = x; g = c; }
    else if (hp < 3) { g = c; b = x; }
    else if (hp < 4) { g = x; b = c; }
    else if (hp < 5) { r = x; b = c; }
    else { r = c; b = x; }
    const m = l - c / 2;
    return [
      this.srgbToLinear(r + m),
      this.srgbToLinear(g + m),
      this.srgbToLinear(b + m),
    ];
  }

  private srgbToLinear(v: number): number {
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  }

  private resolvePivot(entity: TwinEntity): MeshPlanNode['pivot'] {
    switch (entity.type) {
      case 'building':
      case 'road':
      case 'walkway':
      case 'traffic_flow':
        // Real geometry uses absolute ENU coords — node stays at world origin.
        return { x: 0, y: 0, z: 0 };
      case 'terrain': {
        const sample = entity.geometry.samples[0];
        return { x: sample?.x ?? 0, y: sample?.y ?? 0, z: sample?.z ?? 0 };
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
