import { z } from 'zod';

import { MeshGeometrySchema } from '../../core/geometry/mesh-geometry';

// ---------------------------------------------------------------------------
// MeshBudget
// ---------------------------------------------------------------------------

export const MeshBudgetSchema = z.object({
  maxGlbBytes: z.number(),
  maxTriangleCount: z.number(),
  maxNodeCount: z.number(),
  maxMaterialCount: z.number(),
});
export type MeshBudget = z.infer<typeof MeshBudgetSchema>;

// ---------------------------------------------------------------------------
// MeshPlanNode
// ---------------------------------------------------------------------------

export const MeshPlanNodeSchema = z.object({
  id: z.string(),
  entityId: z.string(),
  parentId: z.string().optional(),
  name: z.string(),
  primitive: z.enum([
    'terrain',
    'road',
    'walkway',
    'building_massing',
    'poi_marker',
  ]),
  pivot: z.object({
    x: z.number(),
    y: z.number(),
    z: z.number(),
  }),
  materialId: z.string(),
  /** Entity geometry for GLB mesh generation. Falls back to placeholder when undefined. */
  geometry: MeshGeometrySchema.optional(),
});
export type MeshPlanNode = z.infer<typeof MeshPlanNodeSchema>;

// ---------------------------------------------------------------------------
// MaterialPlan
// ---------------------------------------------------------------------------

export const MaterialPlanSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.enum(['terrain', 'road', 'building', 'poi', 'debug']),
});
export type MaterialPlan = z.infer<typeof MaterialPlanSchema>;

// ---------------------------------------------------------------------------
// MeshPlan
// ---------------------------------------------------------------------------

export const MeshPlanSchema = z.object({
  sceneId: z.string(),
  renderPolicyVersion: z.string(),
  nodes: z.array(MeshPlanNodeSchema),
  materials: z.array(MaterialPlanSchema),
  budgets: MeshBudgetSchema,
});
export type MeshPlan = z.infer<typeof MeshPlanSchema>;
