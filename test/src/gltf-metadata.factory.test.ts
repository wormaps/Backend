import { describe, expect, it } from 'bun:test';

import { GltfMetadataFactory } from '../../src/glb/application/gltf-metadata.factory';

describe('gltf metadata factory', () => {
  it('serializes stable worMap extras metadata', () => {
    const factory = new GltfMetadataFactory();
    const metadata = factory.create({
      sceneId: 'scene-1',
      buildId: 'build-1',
      snapshotBundleId: 'bundle-1',
      finalTier: 'PROCEDURAL_MODEL',
      finalTierReasonCodes: ['TEST'],
      qaSummary: {
        issueCount: 0,
        criticalCount: 0,
        majorCount: 0,
        minorCount: 0,
        infoCount: 0,
        topCodes: [] as string[],
      },
      schemaVersions: {
        sourceSnapshotSchema: 'source-snapshot.v1',
        normalizedEntitySchema: 'normalized-entity-bundle.v1',
        evidenceGraphSchema: 'evidence-graph.v1',
        twinSceneGraphSchema: 'twin-scene-graph.v1',
        renderIntentSchema: 'render-intent.v1',
        meshPlanSchema: 'mesh-plan.v1',
        qaSchema: 'qa.v1',
        manifestSchema: 'manifest.v1',
      },
      meshSummary: {
        nodeCount: 1,
        materialCount: 1,
        primitiveCounts: { building_massing: 1 },
      },
      artifactHash: 'sha256:test',
      sidecarRef: 'sidecar://scene-1.json',
    });

    expect(metadata.extras.value.worMap.sceneId).toBe('scene-1');
    expect(metadata.extras.value.worMap.buildId).toBe('build-1');
    expect(metadata.extras.value.worMap.validationStamp).toMatch(/^sha256:/);
    expect(metadata.sidecar?.value.worMap.sidecarRef).toBe('sidecar://scene-1.json');
    expect(metadata.sidecar?.value.worMap.extrasValidationStamp).toBe(metadata.extras.value.worMap.validationStamp);
  });
});
