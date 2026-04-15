import {
  createGraphIntent,
  summarizeGraphIntents,
} from './glb-build-graph-intent';

describe('glb-build-graph-intent', () => {
  it('creates graph intent with normalized defaults', () => {
    const intent = createGraphIntent('building_shell_1', {
      sourceObjectIds: ['b1'],
    });

    expect(intent.meshName).toBe('building_shell_1');
    expect(intent.semanticCategory).toBe('scene');
    expect(intent.sourceObjectIdsCount).toBe(1);
  });

  it('summarizes load tiers, lod buckets, and instancing groups', () => {
    const intents = [
      createGraphIntent('n1', {
        loadTier: 'high',
        selectionLod: 'HIGH',
        progressiveOrder: 1,
        instanceGroupKey: 'building_shell:glass:HIGH',
      }),
      createGraphIntent('n2', {
        loadTier: 'medium',
        selectionLod: 'MEDIUM',
        progressiveOrder: 2,
        instanceGroupKey: 'building_shell:glass:HIGH',
      }),
      createGraphIntent('n3', {
        loadTier: 'low',
        selectionLod: 'LOW',
      }),
      createGraphIntent('n4', {}),
    ];

    const summary = summarizeGraphIntents(intents);

    expect(summary.totalNodes).toBe(4);
    expect(summary.progressiveOrderedCount).toBe(2);
    expect(summary.byLoadTier.high).toBe(1);
    expect(summary.byLoadTier.medium).toBe(1);
    expect(summary.byLoadTier.low).toBe(1);
    expect(summary.byLoadTier.unknown).toBe(1);
    expect(summary.bySelectionLod.HIGH).toBe(1);
    expect(summary.bySelectionLod.MEDIUM).toBe(1);
    expect(summary.bySelectionLod.LOW).toBe(1);
    expect(summary.bySelectionLod.UNKNOWN).toBe(1);
    expect(summary.instancingGroups[0]).toEqual({
      key: 'building_shell:glass:HIGH',
      count: 2,
    });
    expect(summary.byStage).toEqual({
      transport: 0,
      street_context: 0,
      building_hero: 0,
    });
  });

  it('summarizes stage-level graph intents', () => {
    const summary = summarizeGraphIntents(
      [createGraphIntent('n1', {})],
      [
        {
          stage: 'transport',
          semanticCategory: 'transport',
          sourceCount: 12,
          selectedCount: 8,
          loadTier: 'high',
        },
        {
          stage: 'building_hero',
          semanticCategory: 'building',
          sourceCount: 200,
          selectedCount: 120,
          loadTier: 'medium',
        },
      ],
    );

    expect(summary.byStage).toEqual({
      transport: 1,
      street_context: 0,
      building_hero: 1,
    });
  });
});
