import { z } from 'zod';

import type { RealityTier } from '../twin-scene-graph';

import { RealityTierSchema } from '../twin-scene-graph/twin-scene-graph.schema';

// ---------------------------------------------------------------------------
// RenderIntent
// ---------------------------------------------------------------------------

export const RenderIntentSchema = z.object({
  entityId: z.string(),
  visualMode: z.enum([
    'massing',
    'structural_detail',
    'landmark_asset',
    'traffic_overlay',
    'placeholder',
    'excluded',
  ]),
  allowedDetails: z.object({
    windows: z.boolean(),
    entrances: z.boolean(),
    roofEquipment: z.boolean(),
    facadeMaterial: z.boolean(),
    signage: z.boolean(),
  }),
  lod: z.enum(['L0', 'L1', 'L2']),
  reasonCodes: z.array(z.string()),
  confidence: z.number(),
});
export type RenderIntent = z.infer<typeof RenderIntentSchema>;

// ---------------------------------------------------------------------------
// RenderIntentSet
// ---------------------------------------------------------------------------

export const RenderIntentSetSchema = z.object({
  sceneId: z.string(),
  twinSceneGraphId: z.string(),
  intents: z.array(RenderIntentSchema),
  policyVersion: z.string(),
  generatedAt: z.string(),
  tier: z.object({
    initialCandidate: RealityTierSchema,
    provisional: RealityTierSchema,
    reasonCodes: z.array(z.string()),
  }),
});
export type RenderIntentSet = z.infer<typeof RenderIntentSetSchema>;
