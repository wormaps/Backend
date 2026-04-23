export type SchemaVersionSet = {
  sourceSnapshotSchema: string;
  normalizedEntitySchema: string;
  evidenceGraphSchema: string;
  twinSceneGraphSchema: string;
  renderIntentSchema: string;
  meshPlanSchema: string;
  qaSchema: string;
  manifestSchema: string;
};

export const SCHEMA_VERSION_SET_V1: SchemaVersionSet = {
  sourceSnapshotSchema: 'source-snapshot.v1',
  normalizedEntitySchema: 'normalized-entity.v1',
  evidenceGraphSchema: 'evidence-graph.v1',
  twinSceneGraphSchema: 'twin-scene-graph.v1',
  renderIntentSchema: 'render-intent.v1',
  meshPlanSchema: 'mesh-plan.v1',
  qaSchema: 'qa.v1',
  manifestSchema: 'manifest.v1',
};

