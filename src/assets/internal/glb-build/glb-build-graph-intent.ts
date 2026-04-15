import type { MeshSemanticTrace } from './glb-build-mesh-node';

export interface GlbGraphIntent {
  meshName: string;
  semanticCategory: string;
  selectionLod?: 'HIGH' | 'MEDIUM' | 'LOW';
  loadTier?: 'high' | 'medium' | 'low';
  progressiveOrder?: number;
  prototypeKey?: string;
  instanceGroupKey?: string;
  sourceObjectIdsCount: number;
}

export interface GlbGraphIntentSummary {
  totalNodes: number;
  progressiveOrderedCount: number;
  byLoadTier: Record<'high' | 'medium' | 'low' | 'unknown', number>;
  bySelectionLod: Record<'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN', number>;
  instancingGroups: Array<{ key: string; count: number }>;
  byStage?: Record<'transport' | 'street_context' | 'building_hero', number>;
}

export interface StageGraphIntent {
  stage: 'transport' | 'street_context' | 'building_hero';
  semanticCategory: string;
  selectionLod?: 'HIGH' | 'MEDIUM' | 'LOW';
  loadTier?: 'high' | 'medium' | 'low';
  progressiveOrder?: number;
  prototypeKey?: string;
  instanceGroupKey?: string;
  sourceCount?: number;
  selectedCount?: number;
}

export function createGraphIntent(
  meshName: string,
  trace: MeshSemanticTrace,
): GlbGraphIntent {
  return {
    meshName,
    semanticCategory: trace.semanticCategory ?? 'scene',
    selectionLod: trace.selectionLod,
    loadTier: trace.loadTier,
    progressiveOrder: trace.progressiveOrder,
    prototypeKey: trace.prototypeKey ?? trace.instanceGroupKey,
    instanceGroupKey: trace.instanceGroupKey,
    sourceObjectIdsCount: trace.sourceObjectIds?.length ?? 0,
  };
}

export function summarizeGraphIntents(
  intents: GlbGraphIntent[],
  stageIntents: StageGraphIntent[] = [],
): GlbGraphIntentSummary {
  const byLoadTier: GlbGraphIntentSummary['byLoadTier'] = {
    high: 0,
    medium: 0,
    low: 0,
    unknown: 0,
  };
  const bySelectionLod: GlbGraphIntentSummary['bySelectionLod'] = {
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
    UNKNOWN: 0,
  };
  const groupCounter = new Map<string, number>();
  let progressiveOrderedCount = 0;

  for (const intent of intents) {
    const tier = intent.loadTier ?? 'unknown';
    byLoadTier[tier] += 1;

    const lod = intent.selectionLod ?? 'UNKNOWN';
    bySelectionLod[lod] += 1;

    if (typeof intent.progressiveOrder === 'number') {
      progressiveOrderedCount += 1;
    }

    if (intent.instanceGroupKey) {
      groupCounter.set(
        intent.instanceGroupKey,
        (groupCounter.get(intent.instanceGroupKey) ?? 0) + 1,
      );
    }
    if (intent.prototypeKey && !groupCounter.has(intent.prototypeKey)) {
      groupCounter.set(
        intent.prototypeKey,
        groupCounter.get(intent.prototypeKey) ?? 0,
      );
    }
  }

  const instancingGroups = [...groupCounter.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 24);

  const byStage: GlbGraphIntentSummary['byStage'] = {
    transport: 0,
    street_context: 0,
    building_hero: 0,
  };
  for (const intent of stageIntents) {
    byStage[intent.stage] += 1;
  }

  return {
    totalNodes: intents.length,
    progressiveOrderedCount,
    byLoadTier,
    bySelectionLod,
    instancingGroups,
    byStage,
  };
}
