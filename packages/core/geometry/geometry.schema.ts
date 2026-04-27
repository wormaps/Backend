import { z } from 'zod';

export const LocalPointSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
});

export const LocalPolygonSchema = z.object({
  outer: z.array(LocalPointSchema),
  holes: z.array(z.array(LocalPointSchema)).optional(),
});
