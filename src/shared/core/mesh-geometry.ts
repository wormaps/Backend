import { z } from 'zod';

import { LocalPointSchema, LocalPolygonSchema } from './geometry.schema';

export const BuildingMeshGeometrySchema = z.object({
  kind: z.literal('building'),
  footprint: LocalPolygonSchema,
  baseY: z.number().optional(),
  height: z.number().optional(),
  /** Hip/pyramid roof height above topY. 0 = flat. */
  roofRise: z.number().optional(),
  /** OSM roof:shape mapped to a renderer-supported form. */
  roofShape: z.enum(['flat', 'gable', 'hip', 'shed', 'stepped', 'unknown']).optional(),
});

export type BuildingMeshGeometry = z.infer<typeof BuildingMeshGeometrySchema>;

export const RoadMeshGeometrySchema = z.object({
  kind: z.literal('road'),
  centerline: z.array(LocalPointSchema),
  bufferPolygon: LocalPolygonSchema.optional(),
  /** Road half-width in metres (full width = width * 2). */
  width: z.number().optional(),
  /** OSM highway classification for material selection. */
  highwayType: z.string().optional(),
});

export type RoadMeshGeometry = z.infer<typeof RoadMeshGeometrySchema>;

export const WalkwayMeshGeometrySchema = z.object({
  kind: z.literal('walkway'),
  centerline: z.array(LocalPointSchema),
  width: z.number().optional(),
});

export type WalkwayMeshGeometry = z.infer<typeof WalkwayMeshGeometrySchema>;

export const PoiMeshGeometrySchema = z.object({
  kind: z.literal('poi'),
  point: LocalPointSchema,
});

export type PoiMeshGeometry = z.infer<typeof PoiMeshGeometrySchema>;

export const TerrainMeshGeometrySchema = z.object({
  kind: z.literal('terrain'),
  samples: z.array(LocalPointSchema),
});

export type TerrainMeshGeometry = z.infer<typeof TerrainMeshGeometrySchema>;

export const MeshGeometrySchema = z.discriminatedUnion('kind', [
  BuildingMeshGeometrySchema,
  RoadMeshGeometrySchema,
  WalkwayMeshGeometrySchema,
  PoiMeshGeometrySchema,
  TerrainMeshGeometrySchema,
]);

export type MeshGeometry = z.infer<typeof MeshGeometrySchema>;
