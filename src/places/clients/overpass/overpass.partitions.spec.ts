import { describe, expect, it } from 'bun:test';
import { partitionOverpassElements } from './overpass.partitions';
import type { OverpassElement } from './overpass.types';

function way(id: number, ring: Array<{ lat: number; lon: number }>): OverpassElement {
  return {
    type: 'way',
    id,
    tags: {
      building: 'yes',
    },
    geometry: ring,
  };
}

function relation(
  id: number,
  ring: Array<{ lat: number; lon: number }>,
  wayId: number,
): OverpassElement {
  return {
    type: 'relation',
    id,
    tags: {
      building: 'yes',
      type: 'multipolygon',
    },
    members: [
      {
        type: 'way',
        ref: wayId,
        role: 'outer',
        geometry: ring,
      },
    ],
  };
}

describe('partitionOverpassElements', () => {
  it('merges way+relation duplicates and prefers relation', () => {
    const duplicatedRing = [
      { lat: 37.0, lon: 127.0 },
      { lat: 37.0, lon: 127.001 },
      { lat: 37.001, lon: 127.001 },
      { lat: 37.001, lon: 127.0 },
      { lat: 37.0, lon: 127.0 },
    ];

    const result = partitionOverpassElements([
      way(100, duplicatedRing),
      relation(200, duplicatedRing, 999_001),
    ]);

    expect(result.buildingRelations.length).toBe(1);
    expect(result.buildingWays.length).toBe(0);
    expect(result.deduplicatedCount).toBe(1);
    expect(result.mergedWayRelationCount).toBe(1);
  });

  it('keeps relation priority when duplicate relations overlap', () => {
    const duplicatedRing = [
      { lat: 37.0, lon: 127.0 },
      { lat: 37.0, lon: 127.001 },
      { lat: 37.001, lon: 127.001 },
      { lat: 37.001, lon: 127.0 },
      { lat: 37.0, lon: 127.0 },
    ];

    const result = partitionOverpassElements([
      relation(300, duplicatedRing, 999_003),
      relation(301, duplicatedRing, 999_004),
    ]);

    expect(result.buildingRelations.length).toBe(1);
    expect(result.buildingWays.length).toBe(0);
    expect(result.deduplicatedCount).toBe(1);
    expect(result.mergedWayRelationCount).toBe(0);
  });

  it('keeps distinct way and relation when footprints differ', () => {
    const wayRing = [
      { lat: 37.0, lon: 127.0 },
      { lat: 37.0, lon: 127.001 },
      { lat: 37.001, lon: 127.001 },
      { lat: 37.001, lon: 127.0 },
      { lat: 37.0, lon: 127.0 },
    ];
    const relationRing = [
      { lat: 37.01, lon: 127.01 },
      { lat: 37.01, lon: 127.011 },
      { lat: 37.011, lon: 127.011 },
      { lat: 37.011, lon: 127.01 },
      { lat: 37.01, lon: 127.01 },
    ];

    const result = partitionOverpassElements([
      way(101, wayRing),
      relation(201, relationRing, 999_002),
    ]);

    expect(result.buildingRelations.length).toBe(1);
    expect(result.buildingWays.length).toBe(1);
    expect(result.deduplicatedCount).toBe(0);
    expect(result.mergedWayRelationCount).toBe(0);
  });

  it('deduplicates same footprint way and relation even when ids differ', () => {
    const wayRing = [
      { lat: 37.0, lon: 127.0 },
      { lat: 37.0, lon: 127.001 },
      { lat: 37.001, lon: 127.001 },
      { lat: 37.001, lon: 127.0 },
      { lat: 37.0, lon: 127.0 },
    ];
    const relationRing = [
      { lat: 37.00001, lon: 127.00001 },
      { lat: 37.00001, lon: 127.00101 },
      { lat: 37.00101, lon: 127.00101 },
      { lat: 37.00101, lon: 127.00001 },
      { lat: 37.00001, lon: 127.00001 },
    ];

    const result = partitionOverpassElements([
      way(102, wayRing),
      relation(202, relationRing, 999_005),
    ]);

    expect(result.buildingRelations.length).toBe(1);
    expect(result.buildingWays.length).toBe(0);
    expect(result.deduplicatedCount).toBe(1);
    expect(result.deduplicatedByIoUCount).toBe(1);
    expect(result.mergedWayRelationCount).toBe(1);
    expect(result.mergedWayWayCount).toBe(0);
  });

  it('deduplicates duplicate building ways by IoU', () => {
    const wayRingA = [
      { lat: 37.02, lon: 127.02 },
      { lat: 37.02, lon: 127.021 },
      { lat: 37.021, lon: 127.021 },
      { lat: 37.021, lon: 127.02 },
      { lat: 37.02, lon: 127.02 },
    ];
    const wayRingB = [
      { lat: 37.02001, lon: 127.02001 },
      { lat: 37.02001, lon: 127.02101 },
      { lat: 37.02101, lon: 127.02101 },
      { lat: 37.02101, lon: 127.02001 },
      { lat: 37.02001, lon: 127.02001 },
    ];

    const result = partitionOverpassElements([
      way(400, wayRingA),
      way(401, wayRingB),
    ]);

    expect(result.buildingRelations.length).toBe(0);
    expect(result.buildingWays.length).toBe(1);
    expect(result.deduplicatedCount).toBe(1);
    expect(result.deduplicatedByIoUCount).toBe(1);
    expect(result.mergedWayRelationCount).toBe(0);
    expect(result.mergedWayWayCount).toBe(1);
  });

  it('prefers richer relation metadata when duplicate relations overlap', () => {
    const duplicatedRing = [
      { lat: 37.04, lon: 127.04 },
      { lat: 37.04, lon: 127.041 },
      { lat: 37.041, lon: 127.041 },
      { lat: 37.041, lon: 127.04 },
      { lat: 37.04, lon: 127.04 },
    ];

    const poorRelation = relation(500, duplicatedRing, 999_500);
    const richRelation: OverpassElement = {
      ...relation(501, duplicatedRing, 999_501),
      tags: {
        building: 'yes',
        type: 'multipolygon',
        name: 'landmark-tower',
        source: 'survey',
        'building:levels': '21',
        height: '88',
      },
    };

    const result = partitionOverpassElements([poorRelation, richRelation]);

    expect(result.buildingRelations.length).toBe(1);
    expect(result.buildingRelations[0]?.id).toBe(501);
    expect(result.deduplicatedCount).toBe(1);
    expect(result.deduplicatedByIoUCount).toBe(1);
    expect(result.mergedWayRelationCount).toBe(0);
    expect(result.mergedWayWayCount).toBe(0);
  });
});
