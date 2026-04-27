import { describe, expect, it } from 'bun:test';

import { GlbCompilerService } from '../../src/glb/application/glb-compiler.service';

describe('glb compiler metadata', () => {
  it('includes mesh and QA summaries in the artifact contract', async () => {
    const compiler = new GlbCompilerService();
    const artifact = await compiler.compile({
      buildId: 'build-glb',
      snapshotBundleId: 'bundle-glb',
      meshPlan: {
        sceneId: 'scene-glb',
        renderPolicyVersion: 'render-policy.v1',
        nodes: [
          {
            id: 'node:building-1',
            entityId: 'building-1',
            name: 'building:massing',
            primitive: 'building_massing',
            pivot: { x: 0, y: 0, z: 0 },
            materialId: 'material:building',
          },
          {
            id: 'node:poi-1',
            entityId: 'poi-1',
            name: 'poi:placeholder',
            primitive: 'poi_marker',
            pivot: { x: 1, y: 0, z: 1 },
            materialId: 'material:debug',
          },
        ],
        materials: [
          { id: 'material:building', name: 'building', role: 'building' },
          { id: 'material:debug', name: 'debug', role: 'debug' },
        ],
        budgets: {
          maxGlbBytes: 30_000_000,
          maxTriangleCount: 250_000,
          maxNodeCount: 1_500,
          maxMaterialCount: 32,
        },
      },
      finalTier: 'PROCEDURAL_MODEL',
      qaSummary: {
        issueCount: 1,
        criticalCount: 0,
        majorCount: 1,
        minorCount: 0,
        infoCount: 0,
        warnActionCount: 0,
        recordActionCount: 0,
        failBuildCount: 0,
        downgradeTierCount: 0,
        stripDetailCount: 0,
        topCodes: ['COMPLIANCE_PROVIDER_POLICY_RISK'],
      },
    });

    expect(artifact.sceneId).toBe('scene-glb');
    expect(artifact.finalTier).toBe('PROCEDURAL_MODEL');
    expect(artifact.qaSummary.issueCount).toBe(1);
    expect(artifact.artifactHash).toMatch(/^sha256:/);
    expect(artifact.gltfMetadata.extras.value.worMap.sceneId).toBe('scene-glb');
    expect(artifact.gltfMetadata.extras.value.worMap.artifactHash).toBe(artifact.artifactHash);
    expect(artifact.meshSummary).toEqual({
      nodeCount: 2,
      materialCount: 2,
      primitiveCounts: {
        building_massing: 1,
        poi_marker: 1,
      },
    });
    expect(artifact.byteLength).toBeGreaterThan(0);
  });

  it('produces valid triangle indices for road and walkway primitives', async () => {
    const compiler = new GlbCompilerService();
    const artifact = await compiler.compile({
      buildId: 'build-road',
      snapshotBundleId: 'bundle-road',
      meshPlan: {
        sceneId: 'scene-road',
        renderPolicyVersion: 'render-policy.v1',
        nodes: [
          {
            id: 'node:road-1',
            entityId: 'road-1',
            name: 'road:traffic_overlay',
            primitive: 'road',
            pivot: { x: 0, y: 0, z: 0 },
            materialId: 'material:road',
            geometry: {
              kind: 'road',
              centerline: [
                { x: 0, y: 0, z: 0 },
                { x: 10, y: 0, z: 0 },
                { x: 20, y: 0, z: 5 },
              ],
            },
          },
          {
            id: 'node:walkway-1',
            entityId: 'walkway-1',
            name: 'walkway:massing',
            primitive: 'walkway',
            pivot: { x: 0, y: 0, z: 0 },
            materialId: 'material:road',
            geometry: {
              kind: 'walkway',
              centerline: [
                { x: 0, y: 0, z: 0 },
                { x: 5, y: 0, z: 5 },
              ],
            },
          },
        ],
        materials: [
          { id: 'material:road', name: 'road', role: 'road' },
        ],
        budgets: {
          maxGlbBytes: 30_000_000,
          maxTriangleCount: 250_000,
          maxNodeCount: 1_500,
          maxMaterialCount: 32,
        },
      },
      finalTier: 'PROCEDURAL_MODEL',
      qaSummary: {
        issueCount: 0,
        criticalCount: 0,
        majorCount: 0,
        minorCount: 0,
        infoCount: 0,
        warnActionCount: 0,
        recordActionCount: 0,
        failBuildCount: 0,
        downgradeTierCount: 0,
        stripDetailCount: 0,
        topCodes: [],
      },
    });

    expect(artifact.byteLength).toBeGreaterThan(0);
    expect(artifact.meshSummary.nodeCount).toBe(2);

    const { NodeIO } = await import('@gltf-transform/core');
    const io = new NodeIO();
    await io.init();
    const document = await io.readBinary(new Uint8Array(artifact.bytes));
    const root = document.getRoot();

    let badMod3 = 0;
    let totalPrimitives = 0;
    for (const mesh of root.listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        totalPrimitives++;
        const indices = prim.getIndices();
        if (indices) {
          const count = indices.getCount();
          if (count % 3 !== 0) {
            badMod3++;
          }
        }
      }
    }

    expect(totalPrimitives).toBe(2);
    expect(badMod3).toBe(0);
  });

  it('extrudes buildings with custom height from geometry', async () => {
    const compiler = new GlbCompilerService();
    const artifact = await compiler.compile({
      buildId: 'build-height',
      snapshotBundleId: 'bundle-height',
      meshPlan: {
        sceneId: 'scene-height',
        renderPolicyVersion: 'render-policy.v1',
        nodes: [
          {
            id: 'node:building-tall',
            entityId: 'building-tall',
            name: 'building:massing',
            primitive: 'building_massing',
            pivot: { x: 0, y: 0, z: 0 },
            materialId: 'material:building',
            geometry: {
              kind: 'building',
              footprint: {
                outer: [
                  { x: 0, y: 0, z: 0 },
                  { x: 10, y: 0, z: 0 },
                  { x: 10, y: 0, z: 10 },
                  { x: 0, y: 0, z: 10 },
                ],
              },
              baseY: 0,
              height: 25,
            },
          },
        ],
        materials: [
          { id: 'material:building', name: 'building', role: 'building' },
        ],
        budgets: {
          maxGlbBytes: 30_000_000,
          maxTriangleCount: 250_000,
          maxNodeCount: 1_500,
          maxMaterialCount: 32,
        },
      },
      finalTier: 'PROCEDURAL_MODEL',
      qaSummary: {
        issueCount: 0,
        criticalCount: 0,
        majorCount: 0,
        minorCount: 0,
        infoCount: 0,
        warnActionCount: 0,
        recordActionCount: 0,
        failBuildCount: 0,
        downgradeTierCount: 0,
        stripDetailCount: 0,
        topCodes: [],
      },
    });

    expect(artifact.byteLength).toBeGreaterThan(0);

    const { NodeIO } = await import('@gltf-transform/core');
    const io = new NodeIO();
    await io.init();
    const document = await io.readBinary(new Uint8Array(artifact.bytes));
    const root = document.getRoot();

    let foundMaxY = -Infinity;
    let foundMinY = Infinity;
    for (const mesh of root.listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        const positions = prim.getAttribute('POSITION');
        if (positions) {
          const arr = positions.getArray();
          if (arr) {
            for (let i = 1; i < arr.length; i += 3) {
              const y = arr[i]!;
              if (y > foundMaxY) foundMaxY = y;
              if (y < foundMinY) foundMinY = y;
            }
          }
        }
      }
    }

    // baseY=0, height=25 -> vertices should reach y=25.
    expect(foundMaxY).toBe(25);
    expect(foundMinY).toBe(0);
  });
});
