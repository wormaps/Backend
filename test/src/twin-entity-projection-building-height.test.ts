import { describe, expect, it } from 'bun:test';

import { TwinEntityProjectionService } from '../../src/twin/application/twin-entity-projection.service';
import type { NormalizedEntityBundle } from '../../packages/contracts/normalized-entity';
import type { TwinBuildingEntity } from '../../packages/contracts/twin-scene-graph';

function createBuildingEntity(geometry: Record<string, unknown>): NormalizedEntityBundle['entities'][number] {
  return {
    id: 'norm:building:1',
    stableId: 'osm:way:1',
    type: 'building',
    geometry,
    sourceEntityRefs: [
      {
        provider: 'osm',
        sourceId: 'osm:way:1',
        sourceSnapshotId: 'snap:osm:1',
      },
    ],
    tags: ['provider:osm', 'entityType:building'],
    issues: [],
  };
}

describe('twin entity projection building height', () => {
  const service = new TwinEntityProjectionService();

  it('uses OSM height when available', () => {
    const bundle: NormalizedEntityBundle = {
      id: 'norm:test',
      sceneId: 'test',
      snapshotBundleId: 'bundle:test',
      entities: [
        createBuildingEntity({
          footprint: { outer: [{ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, { x: 10, y: 0, z: 10 }] },
          baseY: 0,
          height: 15,
        }),
      ],
      issues: [],
      generatedAt: new Date(0).toISOString(),
      normalizationVersion: 'normalization.v1',
    };

    const twins = service.project(bundle);
    expect(twins.length).toBe(1);

    const building = twins[0]! as TwinBuildingEntity;
    expect(building.type).toBe('building');
    expect(building.geometry.height).toBe(15);
    expect(building.properties.height?.value).toBe(15);
    expect(building.properties.height?.provenance).toBe('observed');
    expect(building.properties.height?.reasonCodes).toContain('BUILDING_HEIGHT_FROM_OSM');
  });

  it('infers height from levels when height tag is missing', () => {
    const bundle: NormalizedEntityBundle = {
      id: 'norm:test',
      sceneId: 'test',
      snapshotBundleId: 'bundle:test',
      entities: [
        createBuildingEntity({
          footprint: { outer: [{ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, { x: 10, y: 0, z: 10 }] },
          baseY: 0,
          levels: 4,
        }),
      ],
      issues: [],
      generatedAt: new Date(0).toISOString(),
      normalizationVersion: 'normalization.v1',
    };

    const twins = service.project(bundle);
    const building = twins[0]! as TwinBuildingEntity;
    expect(building.geometry.height).toBe(12);
    expect(building.properties.height?.value).toBe(12);
    expect(building.properties.height?.provenance).toBe('inferred');
    expect(building.properties.height?.reasonCodes).toContain('BUILDING_HEIGHT_FROM_LEVELS');
    expect(building.properties.levels?.value).toBe(4);
    expect(building.properties.levels?.provenance).toBe('observed');
  });

  it('falls back to default height when neither height nor levels are present', () => {
    const bundle: NormalizedEntityBundle = {
      id: 'norm:test',
      sceneId: 'test',
      snapshotBundleId: 'bundle:test',
      entities: [
        createBuildingEntity({
          footprint: { outer: [{ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, { x: 10, y: 0, z: 10 }] },
          baseY: 0,
        }),
      ],
      issues: [],
      generatedAt: new Date(0).toISOString(),
      normalizationVersion: 'normalization.v1',
    };

    const twins = service.project(bundle);
    const building = twins[0]! as TwinBuildingEntity;
    expect(building.geometry.height).toBe(3);
    expect(building.properties.height?.value).toBe(3);
    expect(building.properties.height?.provenance).toBe('defaulted');
    expect(building.properties.height?.reasonCodes).toContain('BUILDING_HEIGHT_FALLBACK');
    expect(building.properties.levels).toBeUndefined();
  });
});
