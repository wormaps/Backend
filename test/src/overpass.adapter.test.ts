import { describe, expect, it } from 'bun:test';

import type { SceneScope } from '../../packages/contracts/twin-scene-graph';
import { OverpassAdapter, type OverpassElement } from '../../src/providers/infrastructure/overpass.adapter';

class TestOverpassAdapter extends OverpassAdapter {
  constructor(private readonly elements: OverpassElement[]) {
    super('http://example.invalid');
  }

  protected override async executeQuery(_query: string): Promise<OverpassElement[]> {
    return this.elements;
  }
}

const scope: SceneScope = {
  center: { lat: 37.5665, lng: 126.978 },
  boundaryType: 'radius',
  radiusMeters: 150,
  coreArea: { outer: [] },
  contextArea: { outer: [] },
};

describe('overpass adapter coordinate conversion', () => {
  it('converts WGS84 geometry to local ENU meters around scope center', async () => {
    const center = scope.center;
    const northEast = { lat: center.lat + 0.0001, lon: center.lng + 0.0001 };
    const southEast = { lat: center.lat - 0.0001, lon: center.lng + 0.0001 };
    const southWest = { lat: center.lat - 0.0001, lon: center.lng - 0.0001 };

    const adapter = new TestOverpassAdapter([
      {
        type: 'way',
        id: 101,
        geometry: [northEast, southEast, southWest],
        tags: { building: 'yes' },
      },
    ]);

    const buildings = await adapter.queryBuildings(scope);
    expect(buildings.length).toBe(1);

    const footprint = (buildings[0]?.geometry as { footprint: { outer: Array<{ x: number; y: number; z: number }> } }).footprint.outer;
    expect(footprint.length).toBe(3);

    for (const p of footprint) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
      expect(Number.isFinite(p.z)).toBe(true);
      // Must be local meters near origin, not raw lon/lat degrees.
      expect(Math.abs(p.x)).toBeLessThan(100);
      expect(Math.abs(p.z)).toBeLessThan(100);
    }

    // North of origin should map to positive z (using z := ENU north).
    expect(footprint[0]!.z).toBeGreaterThan(0);
    // South of origin should map to negative z.
    expect(footprint[1]!.z).toBeLessThan(0);
    // East of origin should map to positive x.
    expect(footprint[0]!.x).toBeGreaterThan(0);
    expect(footprint[1]!.x).toBeGreaterThan(0);
  });

  it('keeps center point near local origin when matching scope center', async () => {
    const center = scope.center;
    const adapter = new TestOverpassAdapter([
      {
        type: 'way',
        id: 202,
        geometry: [
          { lat: center.lat, lon: center.lng },
          { lat: center.lat + 0.00005, lon: center.lng },
        ],
        tags: { highway: 'residential' },
      },
    ]);

    const roads = await adapter.queryRoads(scope);
    expect(roads.length).toBe(1);

    const centerline = (roads[0]?.geometry as { centerline: Array<{ x: number; y: number; z: number }> }).centerline;
    expect(centerline.length).toBe(2);

    // First point equals origin, should be very close to 0,0 in local frame.
    expect(Math.abs(centerline[0]!.x)).toBeLessThan(0.2);
    expect(Math.abs(centerline[0]!.z)).toBeLessThan(0.2);
  });
});

describe('overpass adapter building height parsing', () => {
  it('parses building:height tag into geometry.height', async () => {
    const adapter = new TestOverpassAdapter([
      {
        type: 'way',
        id: 301,
        geometry: [
          { lat: scope.center.lat, lon: scope.center.lng },
          { lat: scope.center.lat + 0.0001, lon: scope.center.lng },
          { lat: scope.center.lat + 0.0001, lon: scope.center.lng + 0.0001 },
        ],
        tags: { building: 'yes', height: '12.5' },
      },
    ]);

    const buildings = await adapter.queryBuildings(scope);
    expect(buildings.length).toBe(1);
    expect((buildings[0]?.geometry as { height?: number }).height).toBe(12.5);
    expect((buildings[0]?.geometry as { levels?: number }).levels).toBeUndefined();
  });

  it('parses building:levels tag into geometry.levels', async () => {
    const adapter = new TestOverpassAdapter([
      {
        type: 'way',
        id: 302,
        geometry: [
          { lat: scope.center.lat, lon: scope.center.lng },
          { lat: scope.center.lat + 0.0001, lon: scope.center.lng },
          { lat: scope.center.lat + 0.0001, lon: scope.center.lng + 0.0001 },
        ],
        tags: { building: 'yes', 'building:levels': '5' },
      },
    ]);

    const buildings = await adapter.queryBuildings(scope);
    expect(buildings.length).toBe(1);
    expect((buildings[0]?.geometry as { levels?: number }).levels).toBe(5);
    expect((buildings[0]?.geometry as { height?: number }).height).toBeUndefined();
  });

  it('ignores invalid height and levels values', async () => {
    const adapter = new TestOverpassAdapter([
      {
        type: 'way',
        id: 303,
        geometry: [
          { lat: scope.center.lat, lon: scope.center.lng },
          { lat: scope.center.lat + 0.0001, lon: scope.center.lng },
          { lat: scope.center.lat + 0.0001, lon: scope.center.lng + 0.0001 },
        ],
        tags: { building: 'yes', height: 'unknown', 'building:levels': 'zero' },
      },
    ]);

    const buildings = await adapter.queryBuildings(scope);
    expect(buildings.length).toBe(1);
    expect((buildings[0]?.geometry as { height?: number }).height).toBeUndefined();
    expect((buildings[0]?.geometry as { levels?: number }).levels).toBeUndefined();
  });
});
