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
