import { describe, expect, it } from 'bun:test';
import {
  BuildingFootprintVo,
  SAME_FOOTPRINT_IOU_THRESHOLD,
  isSameBuildingFootprint,
} from './building-footprint.value-object';

describe('BuildingFootprintVo', () => {
  it('computes centroid for a rectangle footprint', () => {
    const footprint = new BuildingFootprintVo([
      { lat: 37.0, lng: 127.0 },
      { lat: 37.0, lng: 127.001 },
      { lat: 37.001, lng: 127.001 },
      { lat: 37.001, lng: 127.0 },
    ]);

    const centroid = footprint.centroid();
    expect(centroid.lat).toBeCloseTo(37.0005, 6);
    expect(centroid.lng).toBeCloseTo(127.0005, 6);
  });

  it('computes bounding box for a footprint', () => {
    const footprint = new BuildingFootprintVo([
      { lat: 37.0, lng: 127.002 },
      { lat: 36.999, lng: 127.0 },
      { lat: 37.001, lng: 127.001 },
    ]);

    expect(footprint.boundingBox()).toEqual({
      minLat: 36.999,
      minLng: 127.0,
      maxLat: 37.001,
      maxLng: 127.002,
    });
  });

  it('returns IoU near 1 for almost-identical footprints', () => {
    const left = new BuildingFootprintVo([
      { lat: 37.0, lng: 127.0 },
      { lat: 37.0, lng: 127.001 },
      { lat: 37.001, lng: 127.001 },
      { lat: 37.001, lng: 127.0 },
    ]);
    const right = new BuildingFootprintVo([
      { lat: 37.00001, lng: 127.00001 },
      { lat: 37.00001, lng: 127.00101 },
      { lat: 37.00101, lng: 127.00101 },
      { lat: 37.00101, lng: 127.00001 },
    ]);

    expect(left.overlapRatio(right)).toBeGreaterThan(0.9);
  });

  it('returns IoU near 1 for identical footprints', () => {
    const footprint = new BuildingFootprintVo([
      { lat: 37.0, lng: 127.0 },
      { lat: 37.0, lng: 127.001 },
      { lat: 37.001, lng: 127.001 },
      { lat: 37.001, lng: 127.0 },
    ]);

    expect(footprint.overlapRatio(footprint)).toBe(1);
  });

  it('returns IoU near 0 for disjoint footprints', () => {
    const left = new BuildingFootprintVo([
      { lat: 37.0, lng: 127.0 },
      { lat: 37.0, lng: 127.001 },
      { lat: 37.001, lng: 127.001 },
      { lat: 37.001, lng: 127.0 },
    ]);
    const right = new BuildingFootprintVo([
      { lat: 37.01, lng: 127.01 },
      { lat: 37.01, lng: 127.011 },
      { lat: 37.011, lng: 127.011 },
      { lat: 37.011, lng: 127.01 },
    ]);

    expect(left.overlapRatio(right)).toBeLessThan(0.05);
  });

  it('treats high IoU below tolerance as different footprints', () => {
    const left = new BuildingFootprintVo([
      { lat: 37.0, lng: 127.0 },
      { lat: 37.0, lng: 127.001 },
      { lat: 37.001, lng: 127.001 },
      { lat: 37.001, lng: 127.0 },
    ]);
    const right = new BuildingFootprintVo([
      { lat: 37.0, lng: 127.0004 },
      { lat: 37.0, lng: 127.0014 },
      { lat: 37.001, lng: 127.0014 },
      { lat: 37.001, lng: 127.0004 },
    ]);

    expect(left.isSameFootprint(right, 0.5)).toBe(false);
  });

  it('treats nearby + high IoU as same footprint', () => {
    const left = [
      { lat: 37.0, lng: 127.0 },
      { lat: 37.0, lng: 127.001 },
      { lat: 37.001, lng: 127.001 },
      { lat: 37.001, lng: 127.0 },
    ];
    const right = [
      { lat: 37.00001, lng: 127.00001 },
      { lat: 37.00001, lng: 127.00101 },
      { lat: 37.00101, lng: 127.00101 },
      { lat: 37.00101, lng: 127.00001 },
    ];

    expect(isSameBuildingFootprint(left, right, 3)).toBe(true);
  });

  it('exposes the same-footprint IoU threshold expected by the roadmap', () => {
    expect(SAME_FOOTPRINT_IOU_THRESHOLD).toBe(0.85);
  });
});
