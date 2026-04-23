import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createWorMapMvpApp } from '../../src/main';

const root = join(import.meta.dir, '../..');

describe('src MVP boundaries', () => {
  it('exposes the clean-slate MVP modules', () => {
    const app = createWorMapMvpApp();

    expect(app.modules.map((module) => module.name)).toEqual([
      'providers',
      'twin',
      'render',
      'qa',
      'glb',
      'build',
    ]);
  });

  it('keeps GLB compiler independent from providers and raw snapshots', () => {
    const glbCompiler = readFileSync(
      join(root, 'src/glb/application/glb-compiler.service.ts'),
      'utf8',
    );

    expect(glbCompiler).not.toContain('providers');
    expect(glbCompiler).not.toContain('SourceSnapshot');
    expect(glbCompiler).not.toContain('SourceEntityRef');
  });

  it('runs the placeholder-scene MVP path without provider APIs', () => {
    const app = createWorMapMvpApp();
    const result = app.services.sceneBuildOrchestrator.run({
      sceneId: 'scene_1',
      buildId: 'build_1',
      snapshotBundleId: 'bundle_1',
      snapshots: [
        {
          id: 'snapshot_1',
          provider: 'osm',
          sceneId: 'scene_1',
          requestedAt: '2026-04-23T00:00:00.000Z',
          queryHash: 'sha256:query',
          responseHash: 'sha256:response',
          storageMode: 'metadata_only',
          status: 'success',
          compliance: {
            provider: 'osm',
            attributionRequired: true,
            attributionText: 'OpenStreetMap contributors',
            retentionPolicy: 'cache_allowed',
            policyVersion: '1.0.0',
          },
        },
      ],
      scope: {
        center: { lat: 37.4979, lng: 127.0276 },
        boundaryType: 'radius',
        radiusMeters: 150,
        coreArea: { outer: [] },
        contextArea: { outer: [] },
      },
    });

    expect(result.build.currentState()).toBe('COMPLETED');
    if (!('twinSceneGraph' in result)) {
      throw new Error('Expected MVP build to complete.');
    }

    const { twinSceneGraph } = result;
    if (twinSceneGraph === undefined) {
      throw new Error('Expected TwinSceneGraph artifact.');
    }

    expect(twinSceneGraph.evidenceGraphId).toBe('evidence:scene_1:bundle_1');
  });
});
