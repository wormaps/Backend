import { describe, expect, it } from 'bun:test';

import type { RenderIntentSet } from '../../packages/contracts/render-intent';
import type { TwinSceneGraph } from '../../packages/contracts/twin-scene-graph';
import { MeshPlanBuilderService } from '../../src/render/application/mesh-plan-builder.service';

function makeGraph(): TwinSceneGraph {
  return {
    sceneId: 'scene-mesh',
    scope: {
      center: { lat: 37.5, lng: 127.0 },
      boundaryType: 'radius',
      radiusMeters: 150,
      coreArea: { outer: [] },
      contextArea: { outer: [] },
    },
    coordinateFrame: {
      origin: { lat: 37.5, lng: 127.0 },
      axes: 'ENU',
      unit: 'meter',
      elevationDatum: 'UNKNOWN',
    },
    evidenceGraphId: 'evidence:scene-mesh',
    relationships: [],
    stateLayers: [],
    metadata: {
      initialRealityTierCandidate: 'PROCEDURAL_MODEL',
      observedRatio: 0.5,
      inferredRatio: 0,
      defaultedRatio: 0.5,
      coreEntityCount: 4,
      contextEntityCount: 0,
      qualityIssues: [],
    },
    entities: [
      {
        id: 'building-1',
        stableId: 'building-1',
        type: 'building',
        confidence: 1,
        sourceSnapshotIds: [],
        sourceEntityRefs: [],
        derivation: [],
        tags: [],
        qualityIssues: [],
        geometry: {
          footprint: {
            outer: [
              { x: 1, y: 0, z: 2 },
              { x: 2, y: 0, z: 2 },
              { x: 2, y: 0, z: 3 },
              { x: 1, y: 0, z: 3 },
            ],
          },
          baseY: 0,
        },
        properties: {},
      },
      {
        id: 'road-1',
        stableId: 'road-1',
        type: 'road',
        confidence: 1,
        sourceSnapshotIds: [],
        sourceEntityRefs: [],
        derivation: [],
        tags: [],
        qualityIssues: [],
        geometry: {
          centerline: [
            { x: 5, y: 0, z: 6 },
            { x: 7, y: 0, z: 6 },
          ],
        },
        properties: {},
      },
      {
        id: 'poi-1',
        stableId: 'poi-1',
        type: 'poi',
        confidence: 0.4,
        sourceSnapshotIds: [],
        sourceEntityRefs: [],
        derivation: [],
        tags: [],
        qualityIssues: [],
        geometry: {
          point: { x: 9, y: 0, z: 10 },
        },
        properties: {
          placeId: {
            value: 'poi-1',
            provenance: 'observed',
            confidence: 0.4,
            source: 'poi-1',
            reasonCodes: [],
          },
        },
      },
      {
        id: 'terrain-1',
        stableId: 'terrain-1',
        type: 'terrain',
        confidence: 1,
        sourceSnapshotIds: [],
        sourceEntityRefs: [],
        derivation: [],
        tags: [],
        qualityIssues: [],
        geometry: {
          samples: [{ x: 11, y: 1, z: 12 }],
        },
        properties: {},
      },
    ],
  };
}

function makeIntentSet(): RenderIntentSet {
  return {
    sceneId: 'scene-mesh',
    twinSceneGraphId: 'scene-mesh',
    policyVersion: 'render-policy.v1',
    generatedAt: new Date(0).toISOString(),
    tier: {
      initialCandidate: 'PROCEDURAL_MODEL',
      provisional: 'PROCEDURAL_MODEL',
      reasonCodes: [],
    },
    intents: [
      {
        entityId: 'building-1',
        visualMode: 'massing',
        allowedDetails: {
          windows: false,
          entrances: false,
          roofEquipment: false,
          facadeMaterial: false,
          signage: false,
        },
        lod: 'L0',
        reasonCodes: [],
        confidence: 1,
      },
      {
        entityId: 'road-1',
        visualMode: 'traffic_overlay',
        allowedDetails: {
          windows: false,
          entrances: false,
          roofEquipment: false,
          facadeMaterial: false,
          signage: false,
        },
        lod: 'L0',
        reasonCodes: [],
        confidence: 1,
      },
      {
        entityId: 'poi-1',
        visualMode: 'placeholder',
        allowedDetails: {
          windows: false,
          entrances: false,
          roofEquipment: false,
          facadeMaterial: false,
          signage: false,
        },
        lod: 'L1',
        reasonCodes: [],
        confidence: 0.4,
      },
      {
        entityId: 'terrain-1',
        visualMode: 'excluded',
        allowedDetails: {
          windows: false,
          entrances: false,
          roofEquipment: false,
          facadeMaterial: false,
          signage: false,
        },
        lod: 'L2',
        reasonCodes: [],
        confidence: 1,
      },
    ],
  };
}

describe('mesh plan builder', () => {
  it('projects intents into concrete nodes and shared materials', () => {
    const builder = new MeshPlanBuilderService();
    const meshPlan = builder.build(makeGraph(), makeIntentSet());

    expect(meshPlan.nodes.map((node) => node.entityId)).toEqual(['building-1', 'road-1', 'poi-1']);
    expect(meshPlan.nodes.map((node) => node.primitive)).toEqual(['building_massing', 'road', 'poi_marker']);
    expect(meshPlan.nodes.map((node) => node.pivot)).toEqual([
      { x: 1, y: 0, z: 2 },
      { x: 5, y: 0, z: 6 },
      { x: 9, y: 0, z: 10 },
    ]);
    expect(meshPlan.materials.map((material) => material.role)).toEqual(['building', 'road', 'debug']);
  });
});
