import { describe, expect, it } from 'bun:test';
import { NodeIO } from '@gltf-transform/core';
import { createWorMapMvpApp } from '../../src/main';
import { baselineFixtures } from '../../fixtures/phase2';

async function buildAndLoadGlb() {
  const app = createWorMapMvpApp();
  const fixture = baselineFixtures[0];
  if (fixture === undefined) throw new Error('Expected baseline fixture.');
  
  const result = await app.services.sceneBuildOrchestrator.run(fixture);
  if (result.kind !== 'completed') {
    throw new Error(`Build failed: ${result.kind}`);
  }
  return result.glbArtifact;
}

describe('GLB smoke test', () => {
  it('loads GLB with gltf-transform NodeIO without errors', async () => {
    const artifact = await buildAndLoadGlb();
    const io = new NodeIO();
    await io.init();
    const document = await io.readBinary(artifact.bytes);
    const root = document.getRoot();
    
    expect(root.listMeshes().length).toBeGreaterThan(0);
    expect(root.listNodes().length).toBeGreaterThan(0);
    expect(root.listMaterials().length).toBeGreaterThan(0);
    expect(root.listScenes().length).toBe(1);
  });
  
  it('has a valid non-empty scene bounding box', async () => {
    const artifact = await buildAndLoadGlb();
    const io = new NodeIO();
    await io.init();
    const document = await io.readBinary(artifact.bytes);
    const root = document.getRoot();
    
    let hasGeometry = false;
    for (const mesh of root.listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute('POSITION');
        if (pos !== null && pos.getCount() > 0) {
          hasGeometry = true;
          const min = pos.getMin([]);
          const max = pos.getMax([]);
          for (let i = 0; i < min.length; i++) {
            expect(Number.isFinite(min[i]!)).toBe(true);
            expect(Number.isFinite(max[i]!)).toBe(true);
          }
        }
      }
    }
    expect(hasGeometry).toBe(true);
  });
  
  it('has material on every primitive', async () => {
    const artifact = await buildAndLoadGlb();
    const io = new NodeIO();
    await io.init();
    const document = await io.readBinary(artifact.bytes);
    const root = document.getRoot();
    
    for (const mesh of root.listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        expect(prim.getMaterial()).not.toBeNull();
      }
    }
  });
  
  it('produces the same bytes on repeated compilation (determinism)', async () => {
    const app = createWorMapMvpApp();
    const fixture = baselineFixtures[0];
    if (fixture === undefined) throw new Error('Expected baseline fixture.');
    
    const result1 = await app.services.sceneBuildOrchestrator.run(fixture);
    const result2 = await app.services.sceneBuildOrchestrator.run(fixture);
    
    if (result1.kind !== 'completed' || result2.kind !== 'completed') {
      throw new Error('Expected completed builds.');
    }
    
    expect(result1.glbArtifact.artifactHash).toBe(result2.glbArtifact.artifactHash);
    expect(result1.glbArtifact.byteLength).toBe(result2.glbArtifact.byteLength);
  });
});
