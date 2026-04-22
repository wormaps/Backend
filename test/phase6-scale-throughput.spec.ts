import { describe, expect, it } from 'bun:test';
import {
  resolveBuildingOverlapObjectIds,
  resolveOverlapAreas,
} from '../src/scene/pipeline/steps/scene-geometry-correction.logic';

const METERS_TO_DEGREES = 1 / 111_320;

describe('Phase 6 Scale Gate - building overlap sweep', () => {
  it('calculates overlap area only for spatially intersecting buildings', () => {
    const meta = createMeta([
      createBuilding('a', 0, 0, 2, 2),
      createBuilding('b', 1, 1, 2, 2),
      createBuilding('c', 20, 20, 2, 2),
    ]);

    const overlapObjectIds = resolveBuildingOverlapObjectIds(meta);
    const areas = resolveOverlapAreas(meta, overlapObjectIds);

    expect(overlapObjectIds.has('a')).toBe(true);
    expect(overlapObjectIds.has('b')).toBe(true);
    expect(overlapObjectIds.has('c')).toBe(false);
    expect(areas.get('a')).toBeCloseTo(1, 5);
    expect(areas.get('b')).toBeCloseTo(1, 5);
    expect(areas.has('c')).toBe(false);
  });

  it('keeps sparse large-scene overlap checks bounded by nearby candidates', () => {
    const buildings = Array.from({ length: 4_200 }, (_value, index) =>
      createBuilding(`building-${index}`, index * 10, 0, 2, 2),
    );
    const meta = createMeta(buildings);

    const overlapObjectIds = resolveBuildingOverlapObjectIds(meta);
    const areas = resolveOverlapAreas(meta, overlapObjectIds);

    expect(overlapObjectIds.size).toBe(0);
    expect(areas.size).toBe(0);
  });

  it('does not report area for padding-only adjacency', () => {
    const meta = createMeta([
      createBuilding('a', 0, 0, 2, 2),
      createBuilding('b', 2.2, 0, 2, 2),
    ]);

    const overlapObjectIds = resolveBuildingOverlapObjectIds(meta);
    const areas = resolveOverlapAreas(meta, overlapObjectIds);

    expect(overlapObjectIds.has('a')).toBe(true);
    expect(overlapObjectIds.has('b')).toBe(true);
    expect(areas.size).toBe(0);
  });

  it('handles empty building list', () => {
    const meta = createMeta([]);

    const overlapObjectIds = resolveBuildingOverlapObjectIds(meta);
    const areas = resolveOverlapAreas(meta, overlapObjectIds);

    expect(overlapObjectIds.size).toBe(0);
    expect(areas.size).toBe(0);
  });

  it('handles single building with no overlaps', () => {
    const meta = createMeta([createBuilding('solo', 0, 0, 5, 5)]);

    const overlapObjectIds = resolveBuildingOverlapObjectIds(meta);
    const areas = resolveOverlapAreas(meta, overlapObjectIds);

    expect(overlapObjectIds.size).toBe(0);
    expect(areas.size).toBe(0);
  });

  it('accumulates area correctly for a building overlapping multiple others', () => {
    // Building 'center' at (5,5) size 4x4 overlaps both 'left' and 'right'
    const meta = createMeta([
      createBuilding('left', 3, 5, 4, 4),
      createBuilding('center', 5, 5, 4, 4),
      createBuilding('right', 7, 5, 4, 4),
    ]);

    const overlapObjectIds = resolveBuildingOverlapObjectIds(meta);
    const areas = resolveOverlapAreas(meta, overlapObjectIds);

    expect(overlapObjectIds.has('left')).toBe(true);
    expect(overlapObjectIds.has('center')).toBe(true);
    expect(overlapObjectIds.has('right')).toBe(true);
    // Each pair overlaps by 2m * 4m = 8m²
    // 'center' overlaps with both, so its area should be ~16
    expect(areas.get('center')).toBeCloseTo(16, 5);
    expect(areas.get('left')).toBeCloseTo(8, 5);
    expect(areas.get('right')).toBeCloseTo(8, 5);
  });

  it('returns consistent results between overlapObjectIds and areas', () => {
    const meta = createMeta([
      createBuilding('a', 0, 0, 3, 3),
      createBuilding('b', 2, 2, 3, 3),
      createBuilding('c', 10, 10, 3, 3),
      createBuilding('d', 11, 11, 3, 3),
    ]);

    const overlapObjectIds = resolveBuildingOverlapObjectIds(meta);
    const areas = resolveOverlapAreas(meta, overlapObjectIds);

    // Every building with area > 0 must be in overlapObjectIds
    for (const [id, area] of areas.entries()) {
      expect(overlapObjectIds.has(id)).toBe(true);
      expect(area).toBeGreaterThan(0);
    }
    // Buildings in overlapObjectIds that have actual overlap must have area entries
    // (padding-only adjacency may be in overlapObjectIds but not in areas)
  });

  it('handles dense cluster of overlapping buildings', () => {
    const clusterSize = 50;
    const buildings = Array.from({ length: clusterSize }, (_value, index) =>
      createBuilding(`cluster-${index}`, index * 0.5, index * 0.5, 3, 3),
    );
    const meta = createMeta(buildings);

    const overlapObjectIds = resolveBuildingOverlapObjectIds(meta);
    const areas = resolveOverlapAreas(meta, overlapObjectIds);

    // All buildings in a dense cluster should overlap
    expect(overlapObjectIds.size).toBe(clusterSize);
    expect(areas.size).toBe(clusterSize);
    // Every building should have positive area
    for (const area of areas.values()) {
      expect(area).toBeGreaterThan(0);
    }
  });

  it('handles large scene with mixed sparse and dense regions', () => {
    const buildings: unknown[] = [];
    for (let i = 0; i < 2000; i += 1) {
      buildings.push(createBuilding(`sparse-${i}`, i * 15, 0, 2, 2));
    }
    for (let i = 0; i < 100; i += 1) {
      buildings.push(
        createBuilding(`dense-${i}`, 35000 + (i % 10) * 1.5, Math.floor(i / 10) * 1.5, 3, 3),
      );
    }
    const meta = createMeta(buildings);

    const overlapObjectIds = resolveBuildingOverlapObjectIds(meta);
    const areas = resolveOverlapAreas(meta, overlapObjectIds);

    const sparseOverlaps = [...overlapObjectIds].filter((id) => id.startsWith('sparse-'));
    expect(sparseOverlaps.length).toBe(0);
    const denseOverlaps = [...overlapObjectIds].filter((id) => id.startsWith('dense-'));
    expect(denseOverlaps.length).toBe(100);
    expect(areas.size).toBe(100);
  });
});

function createMeta(buildings: unknown[]) {
  return {
    sceneId: 'phase6-scale-scene',
    origin: { lat: 0, lng: 0 },
    buildings,
  } as any;
}

function createBuilding(
  objectId: string,
  xMeters: number,
  yMeters: number,
  widthMeters: number,
  depthMeters: number,
) {
  const minLat = yMeters * METERS_TO_DEGREES;
  const maxLat = (yMeters + depthMeters) * METERS_TO_DEGREES;
  const minLng = xMeters * METERS_TO_DEGREES;
  const maxLng = (xMeters + widthMeters) * METERS_TO_DEGREES;

  return {
    objectId,
    outerRing: [
      { lat: minLat, lng: minLng },
      { lat: minLat, lng: maxLng },
      { lat: maxLat, lng: maxLng },
      { lat: maxLat, lng: minLng },
    ],
  };
}
