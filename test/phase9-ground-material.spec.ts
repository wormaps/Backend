import { describe, expect, it } from 'bun:test';
import { resolveGroundMaterialProfile } from '../src/assets/compiler/materials/ground-material-profile.utils';
import type { LandCoverData } from '../src/places/types/place.types';

describe('Phase 9.4 Ground material branching by landcover', () => {
  it('returns sand/default profile when no landCovers', () => {
    const profile = resolveGroundMaterialProfile([]);
    expect(profile.roughness).toBe(1.0);
    expect(profile.metallic).toBe(0);
  });

  it('returns grass profile for park landCover', () => {
    const landCovers: LandCoverData[] = [
      { id: 'lc-1', type: 'PARK', polygon: [{ lat: 35.6, lng: 139.7 }] },
    ];
    const profile = resolveGroundMaterialProfile(landCovers);
    expect(profile.baseColor[1]).toBeGreaterThan(0.4);
    expect(profile.roughness).toBe(1.0);
  });

  it('returns water profile for water landCover', () => {
    const landCovers: LandCoverData[] = [
      { id: 'lc-1', type: 'WATER', polygon: [{ lat: 35.6, lng: 139.7 }] },
    ];
    const profile = resolveGroundMaterialProfile(landCovers);
    expect(profile.metallic).toBe(0.1);
    expect(profile.roughness).toBe(0.0);
    expect(profile.baseColor[2]).toBeGreaterThan(0.5);
  });

  it('returns paved profile for plaza landCover', () => {
    const landCovers: LandCoverData[] = [
      { id: 'lc-1', type: 'PLAZA', polygon: [{ lat: 35.6, lng: 139.7 }] },
    ];
    const profile = resolveGroundMaterialProfile(landCovers);
    expect(profile.roughness).toBe(0.9);
    expect(profile.baseColor[0]).toBeLessThan(0.3);
  });

  it('uses dominant type when multiple landCovers exist', () => {
    const landCovers: LandCoverData[] = [
      { id: 'lc-1', type: 'PARK', polygon: [{ lat: 35.6, lng: 139.7 }] },
      { id: 'lc-2', type: 'PARK', polygon: [{ lat: 35.601, lng: 139.7 }] },
      { id: 'lc-3', type: 'WATER', polygon: [{ lat: 35.602, lng: 139.7 }] },
    ];
    const profile = resolveGroundMaterialProfile(landCovers);
    expect(profile.roughness).toBe(1.0);
    expect(profile.baseColor[1]).toBeGreaterThan(0.4);
  });
});
