import { z } from 'zod';

import { EvidenceGraphSchema } from './evidence-graph/evidence-graph.schema';
import { MeshPlanSchema } from './mesh-plan/mesh-plan.schema';
import { NormalizedEntityBundleSchema } from './normalized-entity/normalized-entity.schema';
import { QaIssueSchema } from './qa/qa.schema';
import { RenderIntentSetSchema } from './render-intent/render-intent.schema';
import { SchemaVersionSetSchema } from '../core/schemas/index';
import { ProviderBudgetPolicySchema, SourceSnapshotSchema } from './source-snapshot/source-snapshot.schema';
import { SceneBuildManifestSchema } from './manifest/manifest.schema';
import { TwinSceneGraphSchema } from './twin-scene-graph/twin-scene-graph.schema';

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: z.ZodError };

function validateSchema<T extends z.ZodTypeAny>(
  schema: T,
  input: unknown,
): ValidationResult<z.infer<T>> {
  const result = schema.safeParse(input);
  if (!result.success) return { success: false, error: result.error };
  return { success: true, data: result.data };
}

export function validateSourceSnapshot(
  input: unknown,
): ValidationResult<z.infer<typeof SourceSnapshotSchema>> {
  return validateSchema(SourceSnapshotSchema, input);
}

export function validateEvidenceGraph(
  input: unknown,
): ValidationResult<z.infer<typeof EvidenceGraphSchema>> {
  return validateSchema(EvidenceGraphSchema, input);
}

export function validateTwinSceneGraph(
  input: unknown,
): ValidationResult<z.infer<typeof TwinSceneGraphSchema>> {
  return validateSchema(TwinSceneGraphSchema, input);
}

export function validateRenderIntentSet(
  input: unknown,
): ValidationResult<z.infer<typeof RenderIntentSetSchema>> {
  return validateSchema(RenderIntentSetSchema, input);
}

export function validateMeshPlan(input: unknown): ValidationResult<z.infer<typeof MeshPlanSchema>> {
  return validateSchema(MeshPlanSchema, input);
}

export function validateNormalizedEntityBundle(
  input: unknown,
): ValidationResult<z.infer<typeof NormalizedEntityBundleSchema>> {
  return validateSchema(NormalizedEntityBundleSchema, input);
}

export function validateQaIssue(input: unknown): ValidationResult<z.infer<typeof QaIssueSchema>> {
  return validateSchema(QaIssueSchema, input);
}

export function validateSceneBuildManifest(
  input: unknown,
): ValidationResult<z.infer<typeof SceneBuildManifestSchema>> {
  return validateSchema(SceneBuildManifestSchema, input);
}

export function validateSchemaVersionSet(
  input: unknown,
): ValidationResult<z.infer<typeof SchemaVersionSetSchema>> {
  return validateSchema(SchemaVersionSetSchema, input);
}

export function validateProviderBudgetPolicy(
  input: unknown,
): ValidationResult<z.infer<typeof ProviderBudgetPolicySchema>> {
  return validateSchema(ProviderBudgetPolicySchema, input);
}
